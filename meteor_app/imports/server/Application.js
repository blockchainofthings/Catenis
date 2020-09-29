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
import util from "util";
// Third-party node modules
import config from 'config';
import bitcoinLib from 'bitcoinjs-lib';
import BigNumber from 'bignumber.js';
import _und from 'underscore';
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
import { removeProcessId } from './Startup';
import { makeCtnNodeId } from './CatenisNode';
import { UtxoConsolidation } from './UtxoConsolidation';
import { FundTransaction } from './FundTransaction';
import { Service } from './Service';

// Config entries
const appConfig = config.get('application');

// Configuration settings
const cfgSettings = {
    appName: appConfig.get('appName'),
    ctnNode: {
        index: appConfig.get('ctnNode.index'),
        privKey: appConfig.get('ctnNode.privKey'),
        pubKey: appConfig.get('ctnNode.pubKey')
    },
    environment: appConfig.get('environment'),
    masterSeed: appConfig.get('masterSeed'),
    commonSeed: appConfig.get('commonSeed'),
    testPrefix: appConfig.get('testPrefix'),
    cryptoNetwork: appConfig.get('cryptoNetwork'),
    shutdownTimeout: appConfig.get('shutdownTimeout'),
    adminRole: appConfig.get('adminRole'),
    defaultAdminUser: {
        username: appConfig.has('defaultAdminUser.username') ? appConfig.get('defaultAdminUser.username') : undefined,
        psw: appConfig.has('defaultAdminUser.psw') ? appConfig.get('defaultAdminUser.psw') : undefined,
        email: appConfig.has('defaultAdminUser.email') ? appConfig.get('defaultAdminUser.email') : undefined
    }
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
export function Application(cipherOnly = false, legacyDustFunding = false) {
    if (!cipherOnly) {
        //  NOTE: arrow functions should NOT be used for the getter/setter of the defined properties.
        //      This is to avoid that, if `this` is referred from within the getter/setter body, it
        //      refers to the object from where the properties have been defined rather than to the
        //      object from where the property is being accessed. Normally, this does not represent
        //      an issue (since the object from where the property is accessed is the same object
        //      from where the property has been defined), but it is especially dangerous if the
        //      object can be cloned.
        Object.defineProperty(this, 'masterSeed', {
            get: function () {
                return Catenis.decipherData(cfgSettings.masterSeed);
            }
        });

        if (!isSeedValid(this.masterSeed)) {
            throw new Error('Application (master) seed does not match seed currently recorded onto the database');
        }

        this.legacyDustFunding = legacyDustFunding;

        //  NOTE: arrow functions should NOT be used for the getter/setter of the defined properties.
        //      This is to avoid that, if `this` is referred from within the getter/setter body, it
        //      refers to the object from where the properties have been defined rather than to the
        //      object from where the property is being accessed. Normally, this does not represent
        //      an issue (since the object from where the property is accessed is the same object
        //      from where the property has been defined), but it is especially dangerous if the
        //      object can be cloned.
        Object.defineProperties(this, {
            commonSeed: {
                get: function () {
                    return Catenis.decipherData(cfgSettings.commonSeed);
                }
            },
            ctnNode: {
                get: function () {
                    return {
                        id: makeCtnNodeId(cfgSettings.ctnNode.index),
                        ..._und.extend(config.util.cloneDeep(cfgSettings.ctnNode), {
                            privKey: Catenis.decipherData(cfgSettings.ctnNode.privKey).toString()
                        })
                    }
                },
                enumerable: true
            },
            environment: {
                get: function () {
                    return cfgSettings.environment;
                },
                enumerable: true
            },
            ctnHubNodeIndex: {
                get: function () {
                    return ctnHubNodeIndex;
                },
                enumerable: true
            }
        });

        // Identify test prefix if present
        if (cfgSettings.testPrefix) {
            this.testPrefix = cfgSettings.testPrefix;
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
}


// Public Application object methods
//

Application.prototype.startProcessing = function (fixDustFunding = false) {
    try {
        // Check whether addresses that are funded with a dust amount should be refunded
        //  to use the new, lower dust amount for segregated witness output, and
        //  consolidate their UTXOs if so; then later, when the Catenis node is started,
        //  those addresses shall be funded with the correct dust amount
        if (fixDustFunding) {
            checkFixDustFunding(Catenis.ctnHubNode);
        }

        // Start Catenis Hub node
        Catenis.ctnHubNode.startNode();

        // Start monitoring of blockchain transactions
        Catenis.txMonitor.startMonitoring();

        // Start Catenis off-chain monitoring
        Catenis.ctnOCMonitor.start();

        // Change status to indicate that application has started
        this.status = Catenis.txMonitor.syncingBlocks ? Application.processingStatus.started_syncing_blocks : Application.processingStatus.started;
        Catenis.logger.INFO('Application successfully started.');

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

// Note this method must be called ONLY AFTER the KeyStore module is initialized
Application.prototype.checkAdminUser = function () {
    if (Roles.getUsersInRole(cfgSettings.adminRole).count() === 0 && cfgSettings.defaultAdminUser.username && cfgSettings.defaultAdminUser.psw) {
        Catenis.logger.INFO('Creating default admin user');
        // No admin user defined. Create default admin user
        this.createAdminUser(cfgSettings.defaultAdminUser.username, Catenis.decipherData(cfgSettings.defaultAdminUser.psw).toString(), cfgSettings.defaultAdminUser.email, 'Catenis default admin user');
    }
};

Application.prototype.createAdminUser = function (username, password, email, description) {
    let adminUserId;

    try {
        adminUserId = Accounts.createUser({
            username: username,
            password: password,
            email: email,
            profile: {
                name: description
            }
        });
    }
    catch (err) {
        Catenis.logger.ERROR('Error creating new admin user.', err);

        let errorToThrow;

        if ((err instanceof Meteor.Error) && err.error === 403) {
            if (err.reason === 'Username already exists.') {
                errorToThrow = new Meteor.Error('ctn_duplicate_username', 'Error creating new user: username already exists');
            }
            else if (err.reason === 'Email already exists.') {
                errorToThrow = new Meteor.Error('ctn_duplicate_email', 'Error creating new user: email already exists');
            }
            else if (err.reason === 'Something went wrong. Please check your credentials.') {
                // Generic credentials error. Try to identify what was wrong
                if (username && Meteor.users.findOne({username: username}, {fields:{_id: 1}})) {
                    errorToThrow = new Meteor.Error('ctn_duplicate_username', 'Error creating new user: username already exists');
                }
                else if (email && Meteor.users.findOne({emails: {$elemMatch: {address: email}}}, {fields:{_id: 1}})) {
                    errorToThrow = new Meteor.Error('ctn_duplicate_email', 'Error creating new user: duplicate email address');
                }
            }
        }

        throw errorToThrow ? errorToThrow : new Meteor.Error('ctn_new_user_failure', util.format('Error creating new user: %s', err.toString()));
    }

    Roles.addUsersToRoles(adminUserId, cfgSettings.adminRole);

    return adminUserId;
};

// NOTE: this method should be used with care. It is intended to be used for
//  development purpose only
Application.prototype.refundAddressesWithLegacyDustAmount = function () {
    this.legacyDustFunding = true;

    consolidateUtxosOfAllDustFundedAddresses(Catenis.ctnHubNode);

    // Execute code in critical section to avoid UTXOs concurrency
    FundSource.utxoCS.execute(() => {
        Catenis.ctnHubNode._fundDeviceMainAddresses();
        Catenis.ctnHubNode.checkServiceCreditIssuanceProvision();
        Catenis.ctnHubNode.checkBcotSaleStockProvision();
    });

    Catenis.ctnHubNode.fundAllDevicesAddresses();

    this.legacyDustFunding = false
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
        Catenis.logger.INFO('Shutting down application. Please wait.');

        // Stop blockchain transaction monitoring
        Catenis.txMonitor.stopMonitoring();

        // Stop Catenis off-chain monitoring
        Catenis.ctnOCMonitor.stop();

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

            // Make sure that funds are properly distributed as needed
            Catenis.ctnHubNode.checkFundDistribution();
        });

        // Assume system already started. Check if there are devices to provision
        Device.checkDevicesToFund();
        Device.checkDevicesAddrFunding();
    }
}


// Application function class (public) methods
//

Application.initialize = function (cipherOnly = false, legacyDustFunding = false) {
    Catenis.logger.TRACE('Application initialization');
    // Instantiate App object
    Catenis.application = new Application(cipherOnly, legacyDustFunding);
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
    // Remove process ID file
    removeProcessId();

    Catenis.logger.INFO('Shutdown completed. Exiting application gracefully.');
    process.exit(Application.exitCode.terminated);
}

function checkFixDustFunding(ctnNode) {
    function computeAddressUtxosInfo(allocResult) {
        // Result: a Map object with the following entries:
        //   address => {
        //     legacyDustUtxos: [Array(Object)]  List of UTXOs for that given address the amount of which is a multiple of the legacy dust amount
        //     legacyDustUnits: [Array(Number)]  List with number of legacy dust amount units attributed to each UTXOs for that given address
        //     hasNonLegacyDustUtxos: [Boolean]  Indicates whether there are any UTXOs for that given address that do not have a multiple of the legacy dust amount attributed to it
        //   }
        return allocResult.utxos.reduce((addrUtxosInfo, utxo) => {
            let utxosInfo;

            if (!addrUtxosInfo.has(utxo.address)) {
                addrUtxosInfo.set(utxo.address, utxosInfo = {
                    legacyDustUtxos: [],
                    legacyDustUnits: [],
                    hasNonLegacyDustUtxos: false
                });
            }
            else {
                utxosInfo = addrUtxosInfo.get(utxo.address);
            }

            const legacyDustUnits = new BigNumber(utxo.txout.amount).div(Transaction.legacyDustAmount);

            if (legacyDustUnits.isInteger()) {
                // UTXO has an amount that is a multiple of the legacy dust amount
                utxosInfo.legacyDustUtxos.push(utxo);
                utxosInfo.legacyDustUnits.push(legacyDustUnits.toNumber());
            }
            else {
                // Indicate that address has at least one UTXO the amount of which is not a multiple
                //  of the legacy dust amount
                utxosInfo.hasNonLegacyDustUtxos = true;
            }

            return addrUtxosInfo;
        }, new Map())
    }

    // Execute code in critical section to avoid UTXOs concurrency
    FundSource.utxoCS.execute(() => {
        Catenis.logger.TRACE('Checking if dust funding needs to be fixed and fix it if so');
        const utxoCons = new UtxoConsolidation(ctnNode);
        const fundTransact = new FundTransaction(FundTransaction.fundingEvent.fix_dust_funding);
        let errMessage;

        // Check UTXOs associated with system Service Credit Issuance address
        let fundSrc = new FundSource(ctnNode.serviceCreditIssuanceAddress, {useUnconfirmedUtxo: true});
        let allocResult = fundSrc.allocateUtxosByPredicate();

        if (allocResult) {
            if (!fundSrc.hasUtxoToAllocate()) {
                // Check if address has UTXOs that need to be replaced
                const utxosInfo = computeAddressUtxosInfo(allocResult).get(ctnNode.serviceCreditIssuanceAddress);

                if (utxosInfo.legacyDustUtxos.length > 0) {
                    if (!utxosInfo.hasNonLegacyDustUtxos) {
                        // Add UTXOs to be consolidated
                        utxoCons.addUtxos(utxosInfo.legacyDustUtxos);

                        // Prepare to refund address with new dust amount
                        fundTransact.addMultipleAddressesPayees(
                            ctnNode.servCredIssueAddr.type,
                            ctnNode.serviceCreditIssuanceAddress,
                            utxosInfo.legacyDustUnits.map(count => count * Service.serviceCreditIssuanceAddrAmount)
                        );
                    }
                    else {
                        // Unexpected situation: address is funded with a mixture of legacy and non-legacy dust amount.
                        //  Set error message
                        errMessage = 'System service credit issuance address is funded with a mixture of legacy and non-legacy dust amount; aborting procedure to fix dust funding';
                    }
                }
            }
            else {
                // Not all UTXOs have been allocated. Set error message
                errMessage = 'Not all UTXOs could be allocated to check if funding of system service credit issuance address needs to be fixed; aborting procedure to fix dust funding';
            }
        }
        else {
            // There are no UTXOs associated with system service credit issuance address.
            //  Log warning condition
            Catenis.logger.WARN('No UTXOs available to fix dust funding for system service credit issuance address');
        }

        if (!errMessage && ctnNode.bcotSaleStockAddr) {
            // Check UTXOs associated with system BCOT Sale Stock address
            fundSrc = new FundSource(ctnNode.bcotSaleStockAddress, {useUnconfirmedUtxo: true});
            allocResult = fundSrc.allocateUtxosByPredicate();

            if (allocResult) {
                if (!fundSrc.hasUtxoToAllocate()) {
                    // Check if address has UTXOs that need to be replaced
                    const utxosInfo = computeAddressUtxosInfo(allocResult).get(ctnNode.bcotSaleStockAddress);

                    if (utxosInfo.legacyDustUtxos.length > 0) {
                        // Note: we do not care to check whether there are no UTXOs with non-legacy dust amount
                        //      since it is expected that BCOT tokens be sent to Catenis via UTXOs the amount of
                        //      which is 546 satoshis, which is different than the legacy dust amount

                        // Add UTXOs to be consolidated
                        utxoCons.addUtxos(utxosInfo.legacyDustUtxos);

                        // Prepare to refund address with new dust amount
                        fundTransact.addMultipleAddressesPayees(
                            ctnNode.bcotSaleStockAddr.type,
                            ctnNode.bcotSaleStockAddress,
                            utxosInfo.legacyDustUnits.map(count => count * Service.bcotSaleStockAddrAmount)
                        );
                    }
                }
                else {
                    // Not all UTXOs have been allocated. Set error message
                    errMessage = 'Not all UTXOs could be allocated to check if funding of system BCOT sale stock address needs to be fixed; aborting procedure to fix dust funding';
                }
            }
            else {
                // There are no UTXOs associated with system BCOT sale stock address.
                //  Log warning condition
                Catenis.logger.WARN('No UTXOs available to fix dust funding for system BCOT sale stock address');
            }
        }

        let addrsToSetAsObsolete = [];

        if (!errMessage) {
            // Check UTXOs associated with System Device Main addresses
            fundSrc = new FundSource(ctnNode.deviceMainAddr.listAddressesInUse(), {useUnconfirmedUtxo: true});
            allocResult = fundSrc.allocateUtxosByPredicate();

            if (allocResult) {
                if (!fundSrc.hasUtxoToAllocate()) {
                    // Check if addresses have UTXOs that need to be replaced
                    const addrUtxosInfo = computeAddressUtxosInfo(allocResult);
                    const utxosToConsolidate = [];
                    const amountToRefundByAddress = [];

                    for (let [address, utxosInfo] of addrUtxosInfo) {
                        if (utxosInfo.legacyDustUtxos.length > 0) {
                            if (!utxosInfo.hasNonLegacyDustUtxos && utxosInfo.legacyDustUtxos.length === 1) {
                                // Save UTXOs to be consolidated
                                utxosToConsolidate.push(utxosInfo.legacyDustUtxos[0]);

                                // Save address to be set as obsolete
                                addrsToSetAsObsolete.push(address);

                                // Save amount based on new dust amount that is to be used to refund address
                                amountToRefundByAddress.push(utxosInfo.legacyDustUnits[0] * Service.sysDevMainAddrAmount);
                            }
                            else {
                                // Unexpected situation: address is funded with more than one UTXO.
                                //  Set error message and stop iteration
                                errMessage = 'System device main address is funded with more than one UTXO; aborting procedure to fix dust funding';
                                break;
                            }
                        }
                    }

                    if (!errMessage && utxosToConsolidate.length > 0) {
                        // Add UTXOs to be consolidated
                        utxoCons.addUtxos(utxosToConsolidate);

                        // Prepare to refund addresses
                        fundTransact.addPayees(ctnNode.deviceMainAddr, amountToRefundByAddress);
                    }
                }
                else {
                    // Not all UTXOs have been allocated. Set error message
                    errMessage = 'Not all UTXOs could be allocated to check if funding of system device main addresses needs to be fixed; aborting procedure to fix dust funding';
                }
            }
            else {
                // There are no UTXOs associated with system device main addresses.
                //  Log warning condition
                Catenis.logger.WARN('No UTXOs available to fix dust funding for system device main addresses');
            }
        }

        if (!errMessage) {
            ctnNode.listClients().some(client => {
                return client.listDevices().some(device => {
                    // Check UTXOs associated with device Main addresses
                    let fundSrc = new FundSource(device.mainAddr.listAddressesInUse(), {useUnconfirmedUtxo: true});
                    let allocResult = fundSrc.allocateUtxosByPredicate();

                    if (allocResult) {
                        if (!fundSrc.hasUtxoToAllocate()) {
                            // Check if addresses have UTXOs that need to be replaced
                            const addrUtxosInfo = computeAddressUtxosInfo(allocResult);
                            const utxosToConsolidate = [];
                            const amountToRefundByAddress = [];

                            for (let [address, utxosInfo] of addrUtxosInfo) {
                                if (utxosInfo.legacyDustUtxos.length > 0) {
                                    if (!utxosInfo.hasNonLegacyDustUtxos && utxosInfo.legacyDustUtxos.length === 1) {
                                        // Save UTXOs to be consolidated
                                        utxosToConsolidate.push(utxosInfo.legacyDustUtxos[0]);

                                        // Save address to be set as obsolete
                                        addrsToSetAsObsolete.push(address);

                                        // Save amount based on new dust amount that is to be used to refund address
                                        amountToRefundByAddress.push(utxosInfo.legacyDustUnits[0] * Service.devMainAddrAmount);
                                    }
                                    else {
                                        // Unexpected situation: address is funded with more than one UTXO.
                                        //  Set error message and stop iteration
                                        errMessage = 'Device main address is funded with more than one UTXO; aborting procedure to fix dust funding';
                                        break;
                                    }
                                }
                            }

                            if (!errMessage && utxosToConsolidate.length > 0) {
                                // Add UTXOs to be consolidated
                                utxoCons.addUtxos(utxosToConsolidate);

                                // Prepare to refund addresses
                                fundTransact.addPayees(device.mainAddr, amountToRefundByAddress);
                            }
                        }
                        else {
                            // Not all UTXOs have been allocated. Set error message
                            errMessage = 'Not all UTXOs could be allocated to check if funding of device main addresses needs to be fixed; aborting procedure to fix dust funding';
                        }
                    }
                    else {
                        // There are no UTXOs associated with device main addresses.
                        //  Log warning condition
                        Catenis.logger.WARN('No UTXOs available to fix dust funding for device (deviceId: %s) main addresses', device.deviceId);
                    }

                    if (!errMessage) {
                        // Check UTXOs associated with device Asset Issuance addresses for unlocked assets
                        fundSrc = new FundSource(device.getUnlockedAssetIssuanceAddresses(), {useUnconfirmedUtxo: true});
                        allocResult = fundSrc.allocateUtxosByPredicate();

                        if (allocResult) {
                            if (!fundSrc.hasUtxoToAllocate()) {
                                // Check if addresses have UTXOs that need to be replaced
                                const addrUtxosInfo = computeAddressUtxosInfo(allocResult);
                                let utxosToConsolidate = [];
                                const addressesToRefund = [];
                                const amountsPerUtxoToRefund = [];

                                for (let [address, utxosInfo] of addrUtxosInfo) {
                                    if (utxosInfo.legacyDustUtxos.length > 0) {
                                        if (!utxosInfo.hasNonLegacyDustUtxos) {
                                            // Save UTXOs to be consolidated
                                            utxosToConsolidate = utxosToConsolidate.concat(utxosInfo.legacyDustUtxos);

                                            // Save address to refund
                                            addressesToRefund.push(address);

                                            // Save amounts per output to refund this address
                                            amountsPerUtxoToRefund.push(utxosInfo.legacyDustUnits.map(count => count * Service.devAssetIssuanceAddrAmount(address)));
                                        }
                                        else {
                                            // Unexpected situation: address is funded with a mixture of legacy and non-legacy dust amount.
                                            //  Set error message and stop iteration
                                            errMessage = 'Device asset issuance address (for unlocked asset) is funded with a mixture of legacy and non-legacy dust amount; aborting procedure to fix dust funding';
                                            break;
                                        }
                                    }
                                }

                                if (!errMessage && utxosToConsolidate.length > 0) {
                                    // Add UTXOs to be consolidated
                                    utxoCons.addUtxos(utxosToConsolidate);

                                    // Prepare to refund addresses
                                    fundTransact.addMultipleAddressesPayees(
                                        device.assetIssuanceAddr.type,
                                        addressesToRefund,
                                        amountsPerUtxoToRefund
                                    );
                                }
                            }
                            else {
                                // Not all UTXOs have been allocated. Set error message
                                errMessage = 'Not all UTXOs could be allocated to check if funding of device asset issuance addresses (for unlocked asset) needs to be fixed; aborting procedure to fix dust funding';
                            }
                        }
                        else {
                            // There are no UTXOs associated with device asset issuance addresses.
                            //  Log warning condition
                            Catenis.logger.WARN('No UTXOs available to fix dust funding for device (deviceId: %s) asset issuance addresses (for unlocked asset)', device.deviceId);
                        }
                    }

                    if (!errMessage) {
                        // Check UTXOs associated with device Asset Issuance addresses for locked assets
                        fundSrc = new FundSource(device.getAssetIssuanceAddressesInUseExcludeUnlocked(), {useUnconfirmedUtxo: true});
                        allocResult = fundSrc.allocateUtxosByPredicate();

                        if (allocResult) {
                            if (!fundSrc.hasUtxoToAllocate()) {
                                // Check if addresses have UTXOs that need to be replaced
                                const addrUtxosInfo = computeAddressUtxosInfo(allocResult);
                                const utxosToConsolidate = [];
                                const amountToRefundByAddress = [];

                                for (let [address, utxosInfo] of addrUtxosInfo) {
                                    if (utxosInfo.legacyDustUtxos.length > 0) {
                                        if (!utxosInfo.hasNonLegacyDustUtxos && utxosInfo.legacyDustUtxos.length === 1) {
                                            // Save UTXOs to be consolidated
                                            utxosToConsolidate.push(utxosInfo.legacyDustUtxos[0]);

                                            // Save address to be set as obsolete
                                            addrsToSetAsObsolete.push(address);

                                            // Save amount based on new dust amount that is to be used to refund address
                                            amountToRefundByAddress.push(utxosInfo.legacyDustUnits[0] * Service.devAssetIssuanceAddrAmount());
                                        }
                                        else {
                                            // Unexpected situation: address is funded with more than one UTXO.
                                            //  Set error message and stop iteration
                                            errMessage = 'Device asset issuance address is funded with more than one UTXO; aborting procedure to fix dust funding';
                                            break;
                                        }
                                    }
                                }

                                if (!errMessage && utxosToConsolidate.length > 0) {
                                    // Add UTXOs to be consolidated
                                    utxoCons.addUtxos(utxosToConsolidate);

                                    // Prepare to refund addresses
                                    fundTransact.addPayees(device.assetIssuanceAddr, amountToRefundByAddress);
                                }
                            }
                            else {
                                // Not all UTXOs have been allocated. Set error message
                                errMessage = 'Not all UTXOs could be allocated to check if funding of device asset issuance addresses needs to be fixed; aborting procedure to fix dust funding';
                            }
                        }
                        else {
                            // There are no UTXOs associated with device main addresses.
                            //  Log warning condition
                            Catenis.logger.WARN('No UTXOs available to fix dust funding for device (deviceId: %s) asset issuance addresses', device.deviceId);
                        }
                    }

                    // Stop iterating is there was an error
                    return !!errMessage;
                });
            });
        }

        if (!errMessage) {
            if (utxoCons.hasUtxosToConsolidate()) {
                // Consolidate UTXOs that should be replaced
                try {
                    const consolidationTxids = utxoCons.consolidate();
                    Catenis.logger.INFO('Dust funded UTXOs successfully consolidated', {consolidationTxids});
                }
                catch (err) {
                    // Error consolidating UTXOs to fix dust funding.
                    //  Log error and throw exception
                    Catenis.logger.ERROR('Error consolidating UTXOs to fix dust funding.', err);
                    throw new Error('Error consolidating UTXOs to fix dust funding');
                }

                // Set corresponding addresses as obsolete
                Catenis.keyStore.setAddressListAsObsolete(addrsToSetAsObsolete);

                // Prepare to issue transaction to refund addresses
                if (fundTransact.addPayingSource()) {
                    // Issue transaction to refund addresses
                    try {
                        const refundTxid = fundTransact.sendTransaction();
                        Catenis.logger.INFO('Dust funded UTXOs successfully refunded', {refundTxid});
                    }
                    catch (err) {
                        // Error refunding addresses to fix dust funding.
                        //  Log error and throw exception
                        Catenis.logger.ERROR('Error refunding addresses to fix dust funding.', err);
                        throw new Error('Error refunding addresses to fix dust funding');
                    }
                }
                else {
                    // Unable to allocate funds to pay for refund transaction expense.
                    //  Log error and throw exception
                    Catenis.logger.ERROR('Unable to allocate funds to pay for refund transaction expense');
                    throw new Error('Unable to allocate funds to pay for refund transaction expense');
                }
            }
            else {
                Catenis.logger.DEBUG('No dust funded addresses need to be fixed');
            }
        }
        else {
            // Log error and throw exception
            Catenis.logger.ERROR(errMessage);
            throw new Error(errMessage);
        }
    });
}

// NOTE: this function should be used with care. It is intended to be used for
//  development purpose only
function consolidateUtxosOfAllDustFundedAddresses(ctnNode) {
    function allocationAddresses(allocResult) {
        return Array.from(allocResult.utxos.reduce((addrs, utxo) => {
            if (!addrs.has(utxo.address)) {
                addrs.add(utxo.address);
            }

            return addrs;
        }, new Set()));
    }

    // Execute code in critical section to avoid UTXOs concurrency
    FundSource.utxoCS.execute(() => {
        Catenis.logger.TRACE('Preparing to consolidate UTXOs of all dust funded addresses');
        const utxoCons = new UtxoConsolidation(ctnNode);
        let failed = false;

        // Try to allocate all UTXOs associated with system Service Credit Issuance address
        let fundSrc = new FundSource(ctnNode.servCredIssueAddr.lastAddressKeys().getAddress(), {useUnconfirmedUtxo: true});
        let allocResult = fundSrc.allocateUtxosByPredicate();

        if (allocResult) {
            if (!fundSrc.hasUtxoToAllocate()) {
                // Add allocated UTXOs to be consolidated
                utxoCons.addUtxos(allocResult.utxos);
            }
            else {
                // Not all UTXOs have been allocated. Indicate failure
                failed = true;
            }
        }
        else {
            // There are no UTXOs associated with system service credit issuance address.
            //  Log warning condition
            Catenis.logger.WARN('No UTXOs available for system service credit issuance address');
        }

        if (!failed && ctnNode.bcotSaleStockAddr) {
            // Try to allocate all UTXOs associated with system BCOT Sale Stock address
            fundSrc = new FundSource(ctnNode.bcotSaleStockAddr.lastAddressKeys().getAddress(), {useUnconfirmedUtxo: true});
            allocResult = fundSrc.allocateUtxosByPredicate();

            if (allocResult) {
                if (!fundSrc.hasUtxoToAllocate()) {
                    // Add allocated UTXOs to be consolidated
                    utxoCons.addUtxos(allocResult.utxos);
                }
                else {
                    // Not all UTXOs have been allocated. Indicate failure
                    failed = true;
                }
            }
            else {
                // There are no UTXOs associated with system BCOT sale stock address.
                //  Log warning condition
                Catenis.logger.WARN('No UTXOs available for system BCOT sale stock address');
            }
        }

        let addrsToSetAsObsolete = [];

        if (!failed) {
            // Try to allocate all UTXOs associated with System Device Main addresses
            fundSrc = new FundSource(ctnNode.deviceMainAddr.listAddressesInUse(), {useUnconfirmedUtxo: true});
            allocResult = fundSrc.allocateUtxosByPredicate();

            if (allocResult) {
                if (!fundSrc.hasUtxoToAllocate()) {
                    // Add allocated UTXOs to be consolidated
                    utxoCons.addUtxos(allocResult.utxos);

                    // And set corresponding addresses to be set as obsolete
                    addrsToSetAsObsolete = addrsToSetAsObsolete.concat(allocationAddresses(allocResult));
                }
                else {
                    // Not all UTXOs have been allocated. Indicate failure
                    failed = true;
                }
            }
            else {
                // There are no UTXOs associated with system device main addresses.
                //  Log warning condition
                Catenis.logger.WARN('No UTXOs available for system device main addresses');
            }
        }

        if (!failed) {
            failed = ctnNode.listClients().some(client => {
                return client.listDevices().some(device => {
                    let devFailed = false;

                    // Try to allocate all UTXOs associated with device Main addresses
                    let fundSrc = new FundSource(device.mainAddr.listAddressesInUse(), {useUnconfirmedUtxo: true});
                    let allocResult = fundSrc.allocateUtxosByPredicate();

                    if (allocResult) {
                        if (!fundSrc.hasUtxoToAllocate()) {
                            // Add allocated UTXOs to be consolidated
                            utxoCons.addUtxos(allocResult.utxos);

                            // And set corresponding addresses to be set as obsolete
                            addrsToSetAsObsolete = addrsToSetAsObsolete.concat(allocationAddresses(allocResult));
                        }
                        else {
                            // Not all UTXOs have been allocated. Indicate failure
                            devFailed = true;
                        }
                    }
                    else {
                        // There are no UTXOs associated with device main addresses.
                        //  Log warning condition
                        Catenis.logger.WARN('No UTXOs available for device (deviceId: %s) main addresses', device.deviceId);
                    }

                    if (!devFailed) {
                        // Try to allocate all UTXOs associated with device Asset Issuance addresses
                        fundSrc = new FundSource(device.assetIssuanceAddr.listAddressesInUse(), {useUnconfirmedUtxo: true});
                        allocResult = fundSrc.allocateUtxosByPredicate();

                        if (allocResult) {
                            if (!fundSrc.hasUtxoToAllocate()) {
                                // Add allocated UTXOs to be consolidated
                                utxoCons.addUtxos(allocResult.utxos);

                                // And set corresponding addresses to be set as obsolete
                                addrsToSetAsObsolete = addrsToSetAsObsolete.concat(allocationAddresses(allocResult));
                            }
                            else {
                                // Not all UTXOs have been allocated. Indicate failure
                                devFailed = true;
                            }
                        }
                        else {
                            // There are no UTXOs associated with device asset issuance addresses.
                            //  Log warning condition
                            Catenis.logger.WARN('No UTXOs available for device (deviceId: %s) asset issuance addresses', device.deviceId);
                        }
                    }

                    return devFailed;
                });
            });
        }

        if (!failed) {
            try {
                const consolidationTxids = utxoCons.consolidate();
                Catenis.logger.INFO('Dust funded UTXOs successfully consolidated', {consolidationTxids});
            }
            catch (err) {
                // Error consolidating UTXOs of all dust funded addresses.
                //  Log error and throw exception
                Catenis.logger.ERROR('Error consolidating UTXOs of all dust funded addresses');
                throw new Error('Error consolidating UTXOs of all dust funded addresses');
            }

            // Set corresponding addresses as obsolete
            Catenis.keyStore.setAddressListAsObsolete(addrsToSetAsObsolete);
        }
        else {
            // Not all UTXOs could be allocated to be consolidated.
            //  Log error and throw exception
            Catenis.logger.ERROR('Not all UTXOs could be allocated to be consolidated; aborting procedure consolidate UTXOs of all dust funded addresses');
            throw new Error('Not all UTXOs could be allocated to be consolidated; aborting procedure consolidate UTXOs of all dust funded addresses');
        }
    });
}


// Module code
//

// Lock function class
Object.freeze(Application);
