/**
 * Created by claudio on 27/11/15.
 */

//console.log('[Application.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//  NOTE: the reference of these modules are done sing 'require()' instead of 'import' to
//      to avoid annoying WebStorm warning message: 'default export is not defined in
//      imported module'
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
// Third-party node modules
import config from 'config';
import bitcoinLib from 'bitcoinjs-lib';
// Meteor packages
import { Meteor } from 'meteor/meteor';

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
    shutdownTimeout: appConfig.get('shutdownTimeout')
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

    // TODO: IMPORTANT: avoid using this seed directly as the base for creating other cryptographically generated data, especially the one that shall be shared with other Catenis nodes. Instead, this seed should be used to generated other specific seeds by hashing it. Then only the specific seed shall be shared and not the base Catenis application see
    Object.defineProperty(this, 'seed', {
        get: function () {
            return decryptSeed(Buffer.from(encData, 'base64'));
        }
    });

    if (! isSeedValid(this.seed)) {
        throw new Error('Application seed does not match seed currently recorded onto the database');
    }

    // Identify test prefix if present
    const matchResult = cfgSettings.seedFilename.match(/^seed(?:\.(\w+))?\.dat$/);

    if (matchResult && matchResult.length > 1) {
        this.testPrefix = matchResult[1];
    }

    // Get crypto network
    this.cryptoNetworkName = cfgSettings.cryptoNetwork;
    this.cryptoNetwork = bitcoinLib.networks[this.cryptoNetworkName];

    if (this.cryptoNetwork === undefined) {
        throw new Error('Invalid/unknown crypto network: ' + this.cryptoNetworkName);
    }

    // Set initial application status
    this.status = Application.processingStatus.stopped;

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


// Module functions used to simulate private Application object methods
//  NOTE: these functions need to be bound to an Application object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

function pauseNoFunds() {
    if (this.isStopped()) {
        // Change application status. At this state, the application should only accept that new fund addresses
        //  are created to send funds to the system
        this.status = Application.processingStatus.paused_no_funds;

        // Make sure that blockchain transaction monitoring is on
        Catenis.txMonitor.startMonitoring();
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

// Receives a buffer with the ciphered seed data,
//  and returns a buffer with the deciphered data
function decryptSeed(encData) {
    const x = [ 78, 87, 108, 79, 77, 49, 82, 65, 89, 122, 69, 122, 75, 71, 103, 104, 84, 121, 115, 61],
        dec = crypto.createDecipher('des-ede3-cbc', Buffer.from(Buffer.from(x).toString(), 'base64').toString());

    const decBuf1 = dec.update(encData),
        decBuf2 = dec.final();

    return Buffer.concat([decBuf1, decBuf2]);
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

function shutdown() {
    Catenis.logger.TRACE('Shutting down application');
    process.exit(Application.exitCode.terminated);
}


// Module code
//

// Lock function class
Object.freeze(Application);
