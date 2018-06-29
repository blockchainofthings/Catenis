/**
 * Created by Claudio on 2015-11-27.
 */

//console.log('[Application.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
// Third-party node modules
import config from 'config';
import bitcoinLib from 'bitcoinjs-lib';
// Meteor packages
import { Meteor } from 'meteor/meteor';
import { Roles } from 'meteor/alanning:roles';
import { Accounts } from 'meteor/accounts-base';
// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { TransactionMonitor } from './TransactionMonitor';
import { Device } from './Device';
import { Transaction } from './Transaction';
import { FundSource } from './FundSource';

// Config entries
const appConfig = config.get('application');

// Configuration settings
const cfgSettings = {
    appName: appConfig.get('appName'),
    seedFilename: appConfig.get('seedFilename'),
    cryptoNetwork: appConfig.get('cryptoNetwork'),
    shutdownTimeout: appConfig.get('shutdownTimeout'),
    adminRole: appConfig.get('adminRole'),
    defaultAdminUser: appConfig.has('defaultAdminUser') ? appConfig.get('defaultAdminUser') : undefined,
    defaultAdminPsw: appConfig.has('defaultAdminPsw') ? appConfig.get('defaultAdminPsw') : undefined
};

// Catenis Hub node index
export const ctnHubNodeIndex = 0;

const statusRegEx = {
    stopped: /^stopped(?:$|_)/,
    started: /^started(?:$|_)/,
    paused: /^paused(?:$|_)/,
    rescan: /^.+_blockchain_rescan$/,
    btc_rescan: /^.+_btc.*_blockchain_rescan$/,
    omni_rescan: /^.+_omni.*_blockchain_rescan$/
};


// Definition of function classes
//

// Application function class
export function Application() {
    // Save Catenis node index used by application
    Object.defineProperty(this, 'ctnHubNodeIndex', {
        get: function () {
            return ctnHubNodeIndex;
        }
    });
    
    // Get application seed
    const appSeedPath = path.join(process.env.PWD, cfgSettings.seedFilename),
        encData = fs.readFileSync(appSeedPath, {encoding: 'utf8'});

    Object.defineProperty(this, 'masterSeed', {
        get: function () {
            return conformSeed(Buffer.from(encData, 'base64'));
        }
    });

    if (! isSeedValid(this.masterSeed)) {
        throw new Error('Application (master) seed does not match seed currently recorded onto the database');
    }

    // Identify test prefix if present
    const matchResult = cfgSettings.seedFilename.match(/^seed(?:\.(\w+))?\.dat$/);

    if (matchResult && matchResult.length > 1) {
        this.testPrefix = matchResult[1];
    }

    const encCommonSeed = generateCommonSeed(this.testPrefix);

    Object.defineProperty(this, 'commonSeed', {
        get: function () {
            return conformSeed(encCommonSeed, true, false);
        }
    });

    // Get crypto network
    this.cryptoNetworkName = cfgSettings.cryptoNetwork;
    this.cryptoNetwork = bitcoinLib.networks[this.cryptoNetworkName];

    if (this.cryptoNetwork === undefined) {
        throw new Error('Invalid/unknown crypto network: ' + this.cryptoNetworkName);
    }

    // Set initial application status
    this.status = Application.processingStatus.stopped;

    // Make sure that admin user account is defined
    checkAdminUser.call(this);

    // Set up handler to gracefully shutdown the application
    process.on('SIGTERM', Meteor.bindEnvironment(shutdownHandler, 'Catenis application SIGTERM handler', this));

    // Set up handler for event indicating that transaction used to fund system has been confirmed
    TransactionMonitor.addEventHandler(TransactionMonitor.notifyEvent.sys_funding_tx_conf.name, sysFundingTxConfirmed.bind(this));
}


// Public Application object methods
//

Application.prototype.startProcessing = function () {
    try {
        // Start Catenis Hub node
        Catenis.ctnHubNode.startNode();

        // Start monitoring of blockchain transactions
        Catenis.txMonitor.startMonitoring();

        // Change status to indicate that application has started
        this.status = Catenis.txMonitor.syncingBlocks ? Application.processingStatus.started_syncing_blocks : Application.processingStatus.started;

        // Check if any devices still need to have their addresses funded
        Device.checkDevicesToFund();
        Device.checkDevicesAddrFunding();
    }
    catch (err) {
        if ((err instanceof Meteor.Error) && err.error === 'ctn_sys_no_fund') {
            // System does not have enough funds to operate. Log error pause processing
            Catenis.logger.ERROR('System does not have enough funds to operate. Pausing system processing.');
            pauseNoFunds.call(this);
        }
        else {
            // An error other than failure to deserialize transaction.
            //  Just re-throws it
            throw err;
        }
    }
};

Application.prototype.setWaitingBitcoinCoreRescan = function (waiting) {
    if (waiting === undefined) {
        waiting = true;
    }

    if (waiting) {
        this.status = this.isOmniCoreRescanning() ? Application.processingStatus.stopped_btc_omni_blockchain_rescan
                : Application.processingStatus.stopped_btc_blockchain_rescan;
    }
    else {
        this.status = this.isOmniCoreRescanning() ? Application.processingStatus.stopped_omni_blockchain_rescan
                : Application.processingStatus.stopped;
    }
};

Application.prototype.setWaitingOmniCoreRescan = function (waiting) {
    if (waiting === undefined) {
        waiting = true;
    }

    if (waiting) {
        this.status = this.isBitcoinCoreRescanning() ? Application.processingStatus.stopped_btc_omni_blockchain_rescan
            : Application.processingStatus.stopped_omni_blockchain_rescan;
    }
    else {
        this.status = this.isBitcoinCoreRescanning() ? Application.processingStatus.stopped_btc_blockchain_rescan
            : Application.processingStatus.stopped;
    }
};

Application.prototype.setSyncingBlocks = function (syncing) {
    if (syncing === undefined) {
        syncing = true;
    }

    if (syncing) {
        if (this.status === Application.processingStatus.started) {
            this.status = Application.processingStatus.started_syncing_blocks;
        }
    }
    else {
        if (this.status === Application.processingStatus.started_syncing_blocks) {
            this.status = Application.processingStatus.started;
        }
    }
};

Application.prototype.getWaitingBitcoinCoreRescan = function () {
    return this.isBitcoinCoreRescanning();
};

Application.prototype.getWaitingOmniCoreRescan = function () {
    return this.isOmniCoreRescanning();
};

Application.prototype.isRunning = function () {
    return statusRegEx.started.test(this.status.name);
};

Application.prototype.isStopped = function () {
    return statusRegEx.stopped.test(this.status.name);
};

Application.prototype.isPaused = function () {
    return statusRegEx.paused.test(this.status.name);
};

Application.prototype.isRescanningBlockchain = function () {
    return statusRegEx.rescan.test(this.status.name);
};

Application.prototype.isBitcoinCoreRescanning = function () {
    return statusRegEx.btc_rescan.test(this.status.name);
};

Application.prototype.isOmniCoreRescanning = function () {
    return statusRegEx.omni_rescan.test(this.status.name);
};

Application.prototype.cipherData = function (data, decipher = false) {
    const x = [ 65, 97, 68, 88, 51, 70, 87, 110, 113, 110, 69, 88, 102, 76, 83, 104, 116, 99, 98, 84, 100, 70, 54, 89 ];
    const y = crypto.createHmac('sha256', Buffer.from(x)).update(this.masterSeed).digest();
    const cryptoObj = (decipher ? crypto.createDecipher : crypto.createCipher)('des-ede3-cbc', y);

    return Buffer.concat([cryptoObj.update(data), cryptoObj.final()]);
};


// Module functions used to simulate private Application object methods
//  NOTE: these functions need to be bound to an Application object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

function checkAdminUser() {
    if (Roles.getUsersInRole(cfgSettings.adminRole).count() === 0 && cfgSettings.defaultAdminUser && cfgSettings.defaultAdminPsw) {
        Catenis.logger.INFO('Creating default admin user');
        // No admin user defined. Create default admin user
        const adminUserId = Accounts.createUser({
            username: cfgSettings.defaultAdminUser,
            password: this.cipherData(Buffer.from(cfgSettings.defaultAdminPsw, 'hex'), true).toString(),
            profile: {
                name: 'Catenis default admin user'
            }
        });
        Roles.addUsersToRoles(adminUserId, cfgSettings.adminRole);
    }
}

function shutdownHandler() {
    if (this.isRunning() || (this.isPaused() && this.status !== Application.processingStatus.paused_terminating)) {
        Catenis.logger.INFO('Preparing to shutdown the application. Please wait.');

        // Stop blockchain transaction monitoring
        Catenis.txMonitor.stopMonitoring();

        // Start timer to actually terminate the application
        Meteor.setTimeout(shutdown.bind(null, Application.exitCode.terminated), cfgSettings.shutdownTimeout);

        // And change status appropriately
        this.status = Application.processingStatus.paused_terminating;
    }
    else {
        // Shutdown immediately
        shutdown(Application.exitCode.terminated);
    }
}

function sysFundingTxConfirmed(data) {
    Catenis.logger.TRACE('Received notification of confirmed system funding transaction', data);
    if (this.status === Application.processingStatus.paused_no_funds) {
        // Parse confirmed transaction to make sure that funding address is loaded
        //  onto local key storage
        Transaction.fromTxid(data.txid);

        // And try to start the system again
        this.startProcessing();
    }
    else {
        // Execute code in critical section to avoid UTXOs concurrency
        FundSource.utxoCS.execute(() => {
            // Make sure that funding balance info is updated
            Catenis.ctnHubNode.checkFundingBalance();
        });

        // Assume system already started. Check if there are devices to provision
        Device.checkDevicesToFund();
        Device.checkDevicesAddrFunding();
    }
}


// Application function class (public) methods
//

Application.initialize = function () {
    Catenis.logger.TRACE('Application initialization');
    // Instantiate App object
    Catenis.application = new Application();
};


// Application function class (public) properties
//

Application.exitCode = Object.freeze({
    terminated: -1
});

Application.processingStatus = Object.freeze({
    stopped: Object.freeze({
        name: 'stopped',
        description: 'Application has not started yet'
    }),
    stopped_btc_blockchain_rescan: Object.freeze({
        name: 'stopped_btc_blockchain_rescan',
        description: 'Application has not started yet, and Bitcoin Core is currently rescanning the blockchain'
    }),
    stopped_omni_blockchain_rescan: Object.freeze({
        name: 'stopped_omni_blockchain_rescan',
        description: 'Application has not started yet, and Omni Core is currently rescanning the blockchain'
    }),
    stopped_btc_omni_blockchain_rescan: Object.freeze({
        name: 'stopped_btc_omni_blockchain_rescan',
        description: 'Application has not started yet, and both Bitcoin Core and Omni Core are currently rescanning the blockchain'
    }),
    started: Object.freeze({
        name: 'started',
        description: 'Application is running normally'
    }),
    started_syncing_blocks: Object.freeze({
        name: 'started_syncing_blocks',
        description: 'Application is running but it is currently processing old blockchain blocks'
    }),
    paused_no_funds: Object.freeze({
        name: 'paused_no_funds',
        description: 'Application could not start due to lack of funds and its processing has been suspended (all API calls should fail), and it awaits funds to try and restart'
    }),
    paused_terminating: Object.freeze({
        name: 'paused_terminating',
        description: 'Application processing has been suspended (all API calls should fail), and it is about to terminate its processing'
    }),
});


// Definition of module (private) functions
//

// Method used to cipher/decipher application seed (both master and common seed)
//
//  Arguments:
//   data [Object(Buffer)] - Buffer containing the plain/ciphered seed
//   decrypt [Boolean] - True if seed should be deciphered, false if seed should be ciphered
//   master [Boolean] - True if master seed, false if common seed
//
//  Return: [Object(Buffer)] - Buffer with ciphered/deciphered seed
function conformSeed(data, decrypt = true, master = true) {
    const x = [ 78, 87, 108, 79, 77, 49, 82, 65, 89, 122, 69, 122, 75, 71, 103, 104, 84, 121, 115, 61],
        y = [97, 69, 65, 120, 77, 50, 77, 119, 75, 121, 104, 48, 100, 48, 53, 120, 74, 106, 85, 61],
        cryptoObj = (decrypt ? crypto.createDecipher : crypto.createCipher)('des-ede3-cbc', Buffer.from(Buffer.from(master ? x : y).toString(), 'base64').toString());

    return Buffer.concat([cryptoObj.update(data), cryptoObj.final()]);
}

function isSeedValid(seed) {
    // Calculate seed HMAC
    const seedHmac = crypto.createHmac('sha256', seed).update('This is it: Catenis App seed', 'utf8').digest('base64');

    // Compare with seedHash on the database
    const docApp = Catenis.db.collection.Application.find({}, {fields: {seedHmac: 1}}).fetch()[0];

    let isValid = false;

    if (docApp.seedHmac !== null) {
        // Check if seed HMAC matches the seed HMAC on the database
        if (docApp.seedHmac === seedHmac) {
            isValid = true;
        }
    }
    else {
        // Application seed not yet defined. Save seed HMAC onto database
        //  and indicate that it is valid
        Catenis.db.collection.Application.update({_id: docApp._id}, {$set: {seedHmac: seedHmac}});
        isValid = true;
    }

    return isValid;
}

function generateCommonSeed(testPrefix) {
    return conformSeed(Random.createWithSeeds(this.masterSeed + ': This is the seed to be used by all Catenis Hubs').id(36) +
        (testPrefix ? ':' + testPrefix.toUpperCase() : ''), false, false);
}

function shutdown() {
    Catenis.logger.TRACE('Shutting down application');
    process.exit(Application.exitCode.terminated);
}


// Module code
//

// Lock function class
Object.freeze(Application);
