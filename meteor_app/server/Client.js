/**
 * Created by claudio on 22/06/16.
 */

//console.log('[Client.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//  NOTE: the reference of these modules are done sing 'require()' instead of 'import' to
//      to avoid annoying WebStorm warning message: 'default export is not defined in
//      imported module'
const util = require('util');
const crypto = require('crypto');
// Third-party node modules
import config from 'config';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { CriticalSection } from './CriticalSection';
import { ServiceCreditsCounter } from './ServiceCreditsCounter';
import { TransactionMonitor } from './TransactionMonitor';

// Config entries
const clientConfig = config.get('client');

// Configuration settings
const cfgSettings = {
    fundPayTxExpenseSafetyFactor: clientConfig.get('fundPayTxExpenseSafetyFactor')
};


// Definition of function classes
//

// Client function class
//
//  Constructor arguments:
//    docClient: [Object] - Client database doc/rec
//    ctnNode: [Object] - instance of CatenisNode function class with which client is associated
//    initializeDevices: [boolean] - (optional) indicates whether devices associated with this client
//                              should also be initialized. Defaults to false.
function Client(docClient, ctnNode, initializeDevices) {
    // Make sure that CatenisNode instance matches Client doc/rec
    if (docClient.catenisNode_id !== ctnNode.doc_id) {
        // CatenisNode instance does not match Client doc/rec. Log error and throw exception
        Catenis.logger.ERROR('Client doc/rec does not match given CatenisNode instance', {docClient: docClient, ctnNode: ctnNode});
        throw new Meteor.Error('ctn_client_invalid_ctn_node', util.format('Client doc/rec (_id: %s, catenisNode_id: %s) does not match given CatenisNode instance (doc_id: %s)', docClient._id, docClient.catenisNode_id, ctnNode.doc_id));
    }

    // Save associated CatenisNode instance
    this.ctnNode = ctnNode;

    // Save relevant info from Client doc/rec
    this.doc_id = docClient._id;
    this.user_id = docClient.user_id;
    this.catenisNode_id = docClient.catenisNode_id;
    this.clientId = docClient.clientId;
    this.clientIndex = docClient.index.clientIndex;
    this.apiAccessGenKey = docClient.apiAccessGenKey;
    this.status = docClient.status;

    Object.defineProperty(this, 'apiAccessSecret', {
        get: function () {
            //noinspection JSPotentiallyInvalidUsageOfThis,JSCheckFunctionSignatures
            return crypto.createHmac('sha512', this.apiAccessGenKey).update('And here it is: the Catenis API key for client' + this.clientId).digest('hex');
        }
    });

    // Instantiate objects to manage blockchain addresses for client
    this.messageCreditAddr = Catenis.module.BlockchainAddress.ClientMessageCreditAddress.getInstance(this.ctnNode.ctnNodeIndex, this.clientIndex);
    this.assetCreditAddr = Catenis.module.BlockchainAddress.ClientAssetCreditAddress.getInstance(this.ctnNode.ctnNodeIndex, this.clientIndex);

    // Retrieve (HD node) index of last Device doc/rec created for this client
    const docDevice = Catenis.db.collection.Device.findOne({client_id: this.doc_id}, {fields: {'index.deviceIndex': 1}, sort: {'index.deviceIndex': -1}});

    this.lastDeviceIndex = docDevice != undefined ? docDevice.index.deviceIndex : 0;

    // Critical section object to avoid concurrent access to database at the
    //  client object level (when creating new devices for this client and
    //  handling service credits basically)
    this.clnDbCS = new CriticalSection();

    if (initializeDevices) {
        // Instantiate all (non-deleted) devices associated with this client so their
        //  associated addresses are loaded onto local key storage
        Catenis.db.collection.Device.find({client_id: this.doc_id, status: {$ne: Catenis.module.Device.status.deleted.name}}).forEach((doc) => {
            // Instantiate Device object
            Catenis.logger.TRACE('About to initialize device', {deviceId: doc.deviceId});
            new Catenis.module.Device(doc, this);
        });
    }
}


// Public Client object methods
//

Client.prototype.assignUser = function (user_id) {
    // Make sure that there is no user currently assigned to this client
    if (this.user_id == undefined) {
        // Make sure that user ID is valid
        const docUser = Meteor.users.findOne({_id: user_id}, {fields: {_id: 1, 'services.password': 1, 'profile.client_id': 1}});

        if (docUser == undefined) {
            // ID passed is not from a valid user. Log error and throw exception
            Catenis.logger.ERROR('Invalid user ID for assigning to client', {userId: user_id});
            throw new Meteor.Error('ctn_client_invalid_user_id', util.format('Invalid user ID (%s) for assigning to client', user_id));
        }
        else if (docUser.profile != undefined && docUser.profile.client_id != undefined) {
            // User already assigned to a client. Log error and throw exception
            Catenis.logger.ERROR('User already assigned to a client', {userId: user_id});
            throw new Meteor.Error('ctn_client_user_already_assigned', util.format('User (Id: %s) already assigned to a client', user_id));
        }

        const updtFields = {user_id: user_id},
            userCanLogin = docUser.services != undefined && docUser.services.password != undefined;

        if (userCanLogin) {
            updtFields.status = Client.status.active.name;
            updtFields.lastStatusChangedDate = new Date(Date.now());
        }

        try {
            Catenis.db.collection.Client.update({_id: this.doc_id}, {$set: updtFields});
        }
        catch (err) {
            Catenis.logger.ERROR(util.format('Error trying to update client (doc Id: %s).', this.doc_id), err);
            throw new Meteor.Error('ctn_client_update_error', util.format('Error trying to update client (doc Id: %s)', this.doc_id), err.stack);
        }

        if (userCanLogin) {
            try {
                // Update User doc/rec saving the ID of the client associated with it
                Meteor.users.update({_id: user_id}, {$set: {'profile.client_id': this.doc_id}});
            }
            catch (err) {
                Catenis.logger.ERROR(util.format('Error updating user (Id: %s) associated with client (clientId: %s).', user_id, this.clientId), err);
                throw new Meteor.Error('ctn_client_update_user_error', util.format('Error updating user (Id: %s) associated with client (clientId: %s).', user_id, this.clientId), err.stack);
            }

            // Update local status
            this.status = Client.status.active.name;
        }
    }
    else {
        // Client already has a user assigned to it. Log error
        //  and throw exception
        Catenis.logger.WARN('Trying to assign user to a client that already has a user assigned to it', {client: this});
        throw new Meteor.Error('ctn_client_already_has_user', 'Client already has a user assigned to it');
    }
};

Client.prototype.activate = function () {
    let result = false;

    if (!this.active) {
        if (this.user_id != undefined) {
            // Check if associated user can log in
            const docUser = Meteor.users.findOne({_id: this.user_id}, {fields: {_id: 1, 'services.password': 1}});

            if (docUser != undefined && docUser.services != undefined && docUser.services.password != undefined) {
                // Activate client
                Catenis.db.collection.Client.update({_id: this.doc_id}, {
                    $set: {
                        status: Client.status.active.name,
                        lastStatusChangedDate: new Date(Date.now())
                    }
                });

                this.active = true;
                result = true;
            }
        }
    }
    else {
        // Client already active
        Catenis.logger.WARN('Trying to activate client that is already active', {client: this});
        result = true;
    }

    return result;
};

Client.prototype.renewApiAccessGenKey = function () {
    // Generate new key
    const key = Random.secret();

    try {
        Catenis.db.collection.Client.update({_id: this.doc_id}, {$set: {'apiAccessGenKey': key, 'lastApiAccessGenKeyModifiedDate': new Date(Date.now())}});
    }
    catch (err) {
        Catenis.logger.ERROR('Error updating client default API access generator key', err);
        throw new Meteor.Error('ctn_client_update_error', 'Error updating client default API access generator key', err.stack);
    }

    // Update key locally
    this.apiAccessGenKey = key;
};

Client.prototype.delete = function (deletedDate) {
    if (this.status !== Client.status.deleted.name) {
        deletedDate = deletedDate != undefined ? deletedDate : new Date(Date.now());

        // Iteratively deletes all devices associated with this client
        Catenis.db.collection.Device.find({
            client_id: this.doc_id,
            status: {$ne: Catenis.module.Device.status.deleted.name}
        }, {fields: {'index.deviceId': 1}}).forEach(doc => {
            this.getDeviceByIndex(doc.index.deviceIndex).delete(deletedDate);
        });

        // Retrieve current state of fields that shall be changed
        const docClient = Catenis.db.collection.Client.findOne({_id: this.doc_id}, {fields: {'user_id': 1, status: 1}}),
            delField = {};

        if (docClient.user_id != undefined) {
            del.user_id = docClient.user_id;
        }

        delField.status = docClient.status;
        delField.deletedDate = deletedDate;

        try {
            // Update Client doc/rec setting its status to 'deleted'
            Catenis.db.collection.Client.update({_id: this.doc_id}, {
                $set: {
                    status: Client.status.deleted.name,
                    lastStatusChangedDate: deletedDate,
                    _deleted: delField
                }, $unset: {'user_id': ''}
            });
        }
        catch (err) {
            // Error updating Client doc/rec. Log error and throw exception
            Catenis.logger.ERROR(util.format('Error trying to delete client (doc_d: %s).', this.doc_id), err);
            throw new Meteor.Error('ctn_client_update_error', util.format('Error trying to delete client (doc_id: %s)', this.doc_id), err.stack);
        }

        // Update local variables
        this.user_id = undefined;
        this.status = Client.status.deleted.name;
    }
    else {
        // Client already deleted
        Catenis.logger.WARN('Trying to delete client that is already deleted', {client: this});
    }
};

Client.prototype.addMessageCredit = function (count) {
    addServiceCredit.call(this, Client.serviceCreditType.message, count);
};

Client.prototype.addAssetCredit = function (count) {
    addServiceCredit.call(this, Client.serviceCreditType.asset, count);
};

Client.prototype.spendMessageCredit = function (count) {
    spendServiceCredit.call(this, Client.serviceCreditType.message, count);
};

Client.prototype.spendAssetCredit = function (count) {
    spendServiceCredit.call(this, Client.serviceCreditType.asset, count);
};

Client.prototype.availableMessageCredits = function () {
    return availableServiceCredits.call(this, Client.serviceCreditType.message);
};

Client.prototype.availableAssetCredits = function () {
    return availableServiceCredits.call(this, Client.serviceCreditType.asset);
};

Client.prototype.getDeviceByIndex = function (deviceIndex) {
    // Retrieve Device doc/rec
    const docDevice = Catenis.db.collection.Device.findOne({
        'index.ctnNodeIndex': this.ctnNode.ctnNodeIndex,
        'index.clientIndex': this.clientIndex,
        'index.deviceIndex': deviceIndex,
        status: {$ne: Client.status.deleted.name}
    });

    if (docDevice == undefined) {
        // No device available with the given index. Log error and throw exception
        Catenis.logger.ERROR(util.format('Could not find device with given index for this client (clientId: %s)', this.clientId), {deviceIndex: deviceIndex});
        throw new Meteor.Error('ctn_device_not_found', util.format('Could not find device with given index (%s) for this client (clientId: %s)', deviceIndex, this.clientId));
    }

    return new Catenis.module.Device(docDevice, this);
};

// Create new device for this client
//
//  Arguments:
//    props: [string] - device name
//           or
//           {
//      name: [string], - (optional)
//      prodUniqueId: [string], - (optional)
//      (any additional property)
//    }
//    ownApiAccessKey: [boolean]
//
Client.prototype.createDevice = function (props, ownApiAccessKey = false) {
    // Make sure that client is not deleted
    if (this.status === Client.status.deleted.name) {
        // Cannot create device for deleted client. Log error and throw exception
        Catenis.logger.ERROR('Cannot create device for a deleted client', {clientId: this.clientId});
        throw new Meteor.Error('ctn_client_deleted', util.format('Cannot create device for a deleted client (clientId: %s)', this.clientId));
    }

    // Make sure that client is active
    if (this.status !== Client.status.active.name) {
        // Cannot create device for inactive client. Log error and throw exception
        Catenis.logger.ERROR('Cannot create device for an inactive client', {clientId: this.clientId});
        throw new Meteor.Error('ctn_client_inactive', util.format('Cannot create device for an inactive client (clientId: %s)', this.clientId));
    }

    let docDevice = undefined;

    // Execute code in critical section to avoid DB concurrency
    this.clnDbCS.execute(() => {
        // Get next device index and validate it
        let deviceIndex = this.lastDeviceIndex;

        // Get next good device index
        let deviceId = undefined;

        do {
            if (Catenis.keyStore.initDeviceHDNodes(this.ctnNode.ctnNodeIndex, this.clientIndex, ++deviceIndex)) {
                deviceId = newDeviceId(this.ctnNode.ctnNodeIndex, this.clientIndex, deviceIndex);
            }
        }
        while (!deviceId);

        // Prepare to create new Device doc/rec
        docDevice = {
            client_id: this.doc_id,
            deviceId: deviceId,
            index: {
                ctnNodeIndex: this.ctnNode.ctnNodeIndex,
                clientIndex: this.clientIndex,
                deviceIndex: deviceIndex
            },
            props: typeof props === 'object' ? props : (typeof props === 'string' ? {name: props} : {}),
            apiAccessGenKey: ownApiAccessKey ? Random.secret() : null,
            status: Catenis.module.Device.status.new.name,
            createdDate: new Date(Date.now())
        };

        try {
            // Create new Device doc/rec
            docDevice._id = Catenis.db.collection.Device.insert(docDevice);
        }
        catch (err) {
            if (err.name === 'MongoError' && err.code === 11000 && err.errmsg.search(/index:\s+props\.prodUniqueId/) >= 0) {
                // Duplicate product unique ID error.
                Catenis.logger.ERROR(util.format('Cannot create device; product unique ID (%s) already associated with another device', docDevice.props.prodUniqueId), err);
                throw new Meteor.Error('ctn_device_duplicate_prodUniqueId', util.format('Cannot create device; product unique ID (%s) already associated with another device', docDevice.props.prodUniqueId), err.stack);
            }
            else {
                // Any other error inserting doc/rec
                Catenis.logger.ERROR(util.format('Error trying to create new device for client (clientId: %s).', this.clientId), err);
                throw new Meteor.Error('ctn_device_insert_error', util.format('Error trying to create new device for client (clientId: %s)', this.clientId), err.stack);
            }
        }

        // Now, adjust last device index
        this.lastDeviceIndex = deviceIndex;
    });

    // If we hit this point, a Device doc (rec) has been successfully created

    try {
        // Instantiate Device object to fund recently created device
        (new Catenis.module.Device(docDevice, this)).fundAddresses();
    }
    catch (err) {
        // Error trying to fund addresses of newly created device. Log error condition
        Catenis.logger.ERROR(util.format('Error trying to fund addresses of newly created device (deviceId: %s).', docDevice.deviceId), err);
    }

    // Now, return device Id
    return docDevice.deviceId;
};


// Module functions used to simulate private Client object methods
//  NOTE: these functions need to be bound to a Client object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

function addServiceCredit(srvCreditType, count) {
    // Make sure that client is not deleted
    if (this.status === Client.status.deleted.name) {
        // Cannot add service credit to deleted client. Log error and throw exception
        Catenis.logger.ERROR('Cannot add service credit to a deleted client', {clientId: this.clientId});
        throw new Meteor.Error('ctn_client_deleted', util.format('Cannot add service credit to a deleted client (clientId: %s)', this.clientId));
    }

    // Make sure that client is active
    if (this.status !== Client.status.active.name) {
        // Cannot add service credit to inactive client. Log error and throw exception
        Catenis.logger.ERROR('Cannot add service credit to an inactive client', {clientId: this.clientId});
        throw new Meteor.Error('ctn_client_inactive', util.format('Cannot add service credit to an inactive client (clientId: %s)', this.clientId));
    }

    // Validate arguments
    const errArg = {};

    if (!isValidServiceCreditType(srvCreditType)) {
        errArg.srvCreditType = srvCreditType;
    }

    if (!isValidServiceCreditCount(count)) {
        errArg.count = count;
    }

    if (Object.keys(errArg).length > 0) {
        const errArgs = Object.keys(errArg);

        Catenis.logger.ERROR(util.format('Client.addServiceCredit method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw new Meteor.Error('ctn_client_add_srv_credit_inv_args', util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    let fundSrvCreditTxid = undefined;

    try {
        // Execute code in critical section to avoid UTXOs concurrency
        Catenis.module.FundSource.utxoCS.execute(() => {
            // Allocate service credit addresses...
            let distribFund = Catenis.module.Service.distributeClientServiceCreditFund(count);

            // ...and try to fund them
            fundSrvCreditTxid = fundClientServiceCreditAddresses.call(this, srvCreditType, distribFund.amountPerAddress);

            // Allocate system pay tx expense addresses...
            distribFund = (srvCreditType == Client.serviceCreditType.message ? Catenis.module.Service.distributePayMessageTxExpenseFund : Catenis.module.Service.distributePayAssetTxExpenseFund)(count, cfgSettings.fundPayTxExpenseSafetyFactor);

            // ...and try to fund them
            this.ctnNode.fundPayTxExpenseAddresses(distribFund.amountPerAddress);

            // Make sure that system is properly funded
            Catenis.ctnHubNode.checkFundingBalance();
        });
    }
    catch (err) {
        if (fundSrvCreditTxid == undefined) {
            Catenis.logger.ERROR('Error funding client service credit addresses.', err);
            throw new Meteor.Error('ctn_client_srv_credit_fund_error', 'Error funding client service credit addresses', err.stack);
        }
        else {
            Catenis.logger.ERROR('Error funding system pay tx expense addresses.', err);
            throw new Meteor.Error('ctn_client_srv_credit_fund_error', 'Error funding system pay tx expense addresses', err.stack);
        }
    }
    finally {
        if (fundSrvCreditTxid != undefined) {
            try {
                // Record new service credit add transaction to database
                Catenis.db.collection.ServiceCredit.insert({
                    client_id: this.doc_id,
                    srvCreditType: srvCreditType,
                    fundingTx: {
                        txid: fundSrvCreditTxid,
                        confirmed: false
                    },
                    initCredits: count,
                    remainCredits: count,
                    createdDate: new Date(Date.now())
                });
            }
            catch (err) {
                Catenis.logger.ERROR('Error trying to insert ServiceCredit doc/rec.', err);
                //noinspection ThrowInsideFinallyBlockJS
                throw new Meteor.Error('ctn_client_srv_credit_insert_error', 'Error trying to insert ServiceCredit doc/rec', err.stack);
            }
        }
    }
}

function spendServiceCredit(srvCreditType, count) {
    // Make sure that client is not deleted
    if (this.status === Client.status.deleted.name) {
        // Cannot spend service credit from deleted client. Log error and throw exception
        Catenis.logger.ERROR('Cannot spend service credit from a deleted client', {clientId: this.clientId});
        throw new Meteor.Error('ctn_client_deleted', util.format('Cannot spend service credit from a deleted client (clientId: %s)', this.clientId));
    }

    // Make sure that client is active
    if (this.status !== Client.status.active.name) {
        // Cannot spend service credit from inactive client. Log error and throw exception
        Catenis.logger.ERROR('Cannot spend service credit from an inactive client', {clientId: this.clientId});
        throw new Meteor.Error('ctn_client_inactive', util.format('Cannot  spend service credit from an inactive client (clientId: %s)', this.clientId));
    }

    // Validate arguments
    const errArg = {};

    if (!isValidServiceCreditType(srvCreditType)) {
        errArg.srvCreditType = srvCreditType;
    }

    if (!isValidServiceCreditCount(count)) {
        errArg.count = count;
    }

    if (Object.keys(errArg).length > 0) {
        const errArgs = Object.keys(errArg);

        Catenis.logger.ERROR(util.format('Client.spendServiceCredit method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Meteor.Error('ctn_client_spend_srv_credit_inv_args', util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    // Execute code in critical section to avoid DB concurrency
    this.clnDbCS.execute(() => {
        const srvCreditIdsToZero = [];
        let docSrvCreditsToUpdate = undefined,
            remainCount = count;

        // Take into account only already confirmed service credits
        Catenis.db.collection.ServiceCredit.find({client_id: this.doc_id, srvCreditType: srvCreditType, 'fundingTx.confirmed': true, remainCredits: {$gt: 0}}, {fields: {_id: 1, remainCredits: 1}, sort: {createdDate: 1}}).fetch().some((doc) => {
            if (doc.remainCredits <= remainCount) {
                srvCreditIdsToZero.push(doc._id);
                remainCount -= doc.remainCredits;
            }
            else {
                doc.remainCredits -= remainCount;
                docSrvCreditsToUpdate = doc;
                remainCount = 0;
            }

            return remainCount == 0;
        });

        const updateDate = new Date(Date.now());

        if (srvCreditIdsToZero.length > 0) {
            try {
                Catenis.db.collection.ServiceCredit.update({_id: {$in: srvCreditIdsToZero}}, {$set: {remainCredits: 0, latestCreditUpdatedDate: updateDate}}, {multi: true});
            }
            catch (err) {
                Catenis.logger.ERROR('Error trying to set remaining credits of ServiceCredit docs/recs to zero.', err);
                throw new Meteor.Error('ctn_client_srv_credit_update_error', 'Error trying to set remaining credits of ServiceCredit docs/recs to zero', err.stack);
            }
        }

        if (docSrvCreditsToUpdate != undefined) {
            try {
                Catenis.db.collection.ServiceCredit.update({_id: docSrvCreditsToUpdate._id}, {$set: {remainCredits: docSrvCreditsToUpdate.remainCredits, latestCreditUpdatedDate: updateDate}})
            }
            catch (err) {
                Catenis.logger.ERROR('Error trying to update remaining credits of ServiceCredit docs/recs.', err);
                throw new Meteor.Error('ctn_client_srv_credit_update_error', 'Error trying to update remaining credits of ServiceCredit docs/recs', err.stack);
            }
        }

        if (remainCount > 0) {
            // Not all credits have been deleted. There were not enough remaining credits
            Catenis.logger.WARN('Not all credits have been deleted; there were not enough remaining credits', {creditsToDelete: count, previouslyRemainCredits: count - remainCount});
        }
    });
}

// Arguments:
//   srvCreditType: [String] // A property of Client.serviceCreditType
//
// Return:
//   srvCreditCount: [Object of ServiceCreditsCounter]
function availableServiceCredits(srvCreditType) {
    return Catenis.db.collection.ServiceCredit.find({client_id: this.doc_id, srvCreditType: srvCreditType, remainCredits: {$gt: 0}}, {fields: {_id: 1, 'fundingTx.confirmed': 1, remainCredits: 1}}).fetch().reduce((sum, doc) => {
        if (doc.fundingTx.confirmed) {
            sum.addConfirmed(doc.remainCredits);
        }
        else {
            sum.addUnconfirmed(doc.remainCredits);
        }

        return sum;
    }, new ServiceCreditsCounter());
}

// NOTE: make sure that this method is called from code executed from the FundSource.utxoCS
//  critical section object
function fundClientServiceCreditAddresses(srvCreditType, amountPerAddress) {
    let fundTransact = undefined;

    try {
        // Prepare transaction to fund client service credit addresses
        fundTransact = new Catenis.module.FundTransaction(Catenis.module.FundTransaction.fundingEvent.provision_client_srv_credit, this.clientId);

        fundTransact.addPayees(srvCreditType == Client.serviceCreditType.message ? this.messageCreditAddr : this.assetCreditAddr, amountPerAddress);

        if (fundTransact.addPayingSource()) {
            // Now, issue (create and send) the transaction
            return fundTransact.sendTransaction();
        }
        else {
            // Could not allocated UTXOs to pay for transaction fee.
            //  Throw exception
            //noinspection ExceptionCaughtLocallyJS
            throw new Meteor.Error('ctn_sys_no_fund', 'Could not allocate UTXOs from system funding addresses to pay for tx expense');
        }
    }
    catch (err) {
        // Error funding client service credit addresses.
        //  Log error condition
        Catenis.logger.ERROR(util.format('Error funding client (Id: %s) service credit addresses.', this.clientId), err);

        if (fundTransact != undefined) {
            // Revert addresses of payees added to transaction
            fundTransact.revertPayeeAddresses();
        }

        // Rethrows exception
        throw err;
    }
}

function confirmServiceCredits(txid) {
    // Execute code in critical section to avoid DB concurrency
    this.clnDbCS.execute(() => {
        // Retrieve service credit doc/rec
        const docSrvCredit = Catenis.db.collection.ServiceCredit.findOne({
            'fundingTx.txid': txid,
            'fundingTx.confirmed': false
        }, {fields: {_id: 1, srvCreditType: 1, remainCredits: 1}});

        if (docSrvCredit != undefined) {
            // Update service credit doc/rec indicating that it is already confirmed
            Catenis.db.collection.ServiceCredit.update({_id: docSrvCredit._id}, {$set: {'fundingTx.confirmed': true}});
        }
        else {
            // Could not find ServiceCredit doc/rec associated with given transaction ID.
            //  Log inconsistent condition
            Catenis.logger.ERROR('Could not find ServiceCredit doc/rec associated with transaction id', {txid: txid});
        }
    });
}


// Client function class (public) methods
//

Client.initialize = function () {
    Catenis.logger.TRACE('Client initialization');
    // Set up handler for event notifying that funding transaction used to provision client service credits has been confirmed
    TransactionMonitor.addEventHandler(TransactionMonitor.notifyEvent.funding_provision_client_srv_credit_tx_conf.name, serviceCreditsConfirmed);
};

Client.getClientByClientId = function (clientId) {
    // Retrieve Client doc/rec
    const docClient = Catenis.db.collection.Client.findOne({clientId: clientId, status: {$ne: Client.status.deleted.name}});

    if (docClient == undefined) {
        // No client available with the given client ID. Log error and throw exception
        Catenis.logger.ERROR('Could not find client with given client ID', {clientId: clientId});
        throw new Meteor.Error('ctn_client_not_found', util.format('Could not find client with given client ID (%s)', clientId));
    }

    return new Client(docClient, Catenis.module.CatenisNode.getCatenisNodeByIndex(docClient.index.ctnNodeIndex));
};

Client.getClientByUserId = function (user_id) {
    // Retrieve Client doc/rec
    const docClient = Catenis.db.collection.Client.findOne({user_id: user_id, status: {$ne: Client.status.deleted.name}});

    if (docClient == undefined) {
        // No client available associated with given user id. Log error and throw exception
        Catenis.logger.ERROR('Could not find client associated with given user id', {user_id: user_id});
        throw new Meteor.Error('ctn_client_not_found', util.format('Could not find client associated with given user id (%s)', user_id));
    }

    return new Client(docClient, Catenis.module.CatenisNode.getCatenisNodeByIndex(docClient.index.ctnNodeIndex));
};


// Client function class (public) properties
//

Client.clientCtrl = {};

Client.serviceCreditType = Object.freeze({
    message: 'message',
    asset: 'asset'
});

Client.status = Object.freeze({
    new: Object.freeze({
        name: 'new',
        description: 'Newly created client awaiting activation'
    }),
    active: Object.freeze({
        name: 'active',
        description: 'Client is in its normal use mode'
    }),
    deleted: Object.freeze({
        name: 'deleted',
        description: 'Client has been logically deleted'
    })
});


// Definition of module (private) functions
//

// Create new device ID dependent on Catenis node index, client index and device index
function newDeviceId(ctnNodeIndex, clientIndex, deviceIndex) {
    let id = 'd' + Random.createWithSeeds(Array.from(Catenis.application.seed.toString() + ':ctnNodeIndex:' + ctnNodeIndex + ',clientIndex:' + clientIndex + ',deviceIndex:' + deviceIndex)).id(19);
    let doc;

    if ((doc = Catenis.db.collection.Device.findOne({deviceId: id}, {fields:{_id: 1, index: 1}}))) {
        // New device ID is already in use. Log warning condition and reset ID
        Catenis.logger.WARN(util.format('Device ID for Catenis node index %d, client index %d and device index %d is already in use', ctnNodeIndex, clientIndex, deviceIndex), {existingDeviceDoc: doc});
        id = undefined;
    }

    return id;
}

function isValidServiceCreditType(type) {
    return Object.keys(Client.serviceCreditType).some((key) => {
        return Client.serviceCreditType[key] === type;
    });
}

function isValidServiceCreditCount(count) {
    return typeof count === 'number' && Number.isInteger(count) && count > 0;
}

function serviceCreditsConfirmed(data) {
    Catenis.logger.TRACE('Received notification of confirmed funding transaction used to provision client service credits', data);
    try {
        // Instantiate client and confirm service credits
        confirmServiceCredits.call(Client.getClientByClientId(data.entityId), data.txid);
    }
    catch (err) {
        // Just log error condition
        Catenis.logger.ERROR('Error handling event notifying that service credits have been confirmed.', err);
    }
}


// Module code
//

Object.defineProperty(Client, 'totalRemainingCredits', {
    get: function () {
        return Catenis.db.collection.ServiceCredit.find({remainCredits: {$gt: 0}}, {fields: {remainCredits: 1}}).fetch().reduce((sum, doc) => {
            return sum + doc.remainCredits;
        }, 0);
    }
});

// Save module function class reference
Catenis.module.Client = Object.freeze(Client);
