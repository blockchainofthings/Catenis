/**
 * Created by claudio on 23/06/16.
 */

//console.log('[Device.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//  NOTE: the reference of these modules are done sing 'require()' instead of 'import' to
//      to avoid annoying WebStorm warning message: 'default export is not defined in
//      imported module'
const util = require('util');
// Third-party node modules
import config from 'config';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { CriticalSection } from './CriticalSection';
import { TransactionMonitor } from './TransactionMonitor';

// Config entries
const deviceConfig = config.get('device');

// Configuration settings
export const cfgSettings = {
    creditsToSendMessage: deviceConfig.get('creditsToSendMessage'),
    creditsToLogMessage: deviceConfig.get('creditsToLogMessage')
};


// Definition of function classes
//

// Device function class
//
//  Constructor arguments:
//    docDevice: [Object] - Device database doc/rec
//    client: [Object] - instance of Client function class with which device is associated
function Device(docDevice, client) {
    // Make sure that Client instance matches Device doc/rec
    if (docDevice.client_id !== client.doc_id) {
        // Client instance does not match Device doc/rec. Log error and throw exception
        Catenis.logger.ERROR('Device doc/rec does not match given Client instance', {docDevice: docDevice, client: client});
        throw new Meteor.Error('ctn_device_invalid_client', util.format('Device doc/rec (_id: %s, client_id: %s) does not match given Client instance (doc_id: %s)', docDevice._id, docDevice.client_id, client.doc_id));
    }

    // Save associated Client instance
    this.client = client;

    // Save relevant info from Device doc/rec
    this.doc_id = docDevice._id;
    this.deviceId = docDevice.deviceId;
    this.deviceIndex = docDevice.index.deviceIndex;
    this.apiAccessGenKey = docDevice.apiAccessGenKey;
    this.prodUniqueId = docDevice.props != undefined ? docDevice.props.prodUniqueId : undefined;
    this.status = docDevice.status;

    Object.defineProperty(this, 'apiAccessSecret', {
        get: function () {
            // Use API access secret from client is an API access generator key is not defined
            //  for the device
            //noinspection JSPotentiallyInvalidUsageOfThis
            return docDevice.apiAccessGenKey != null ? crypto.createHmac('sha512', docDevice.apiAccessGenKey).update('And here it is: the Catenis API key for device' + this.clientId).digest('hex')
                    : this.client.apiAccessSecret;
        }
    });

    // Instantiate objects to manage blockchain addresses for device
    this.mainAddr = Catenis.module.BlockchainAddress.DeviceMainAddress.getInstance(this.client.ctnNode.ctnNodeIndex, this.client.clientIndex, this.deviceIndex);
    this.readConfirmAddr = Catenis.module.BlockchainAddress.DeviceReadConfirmAddress.getInstance(this.client.ctnNode.ctnNodeIndex, this.client.clientIndex, this.deviceIndex);
    this.assetAddr = Catenis.module.BlockchainAddress.DeviceAssetAddress.getInstance(this.client.ctnNode.ctnNodeIndex, this.client.clientIndex, this.deviceIndex);
    this.assetIssuanceAddr = Catenis.module.BlockchainAddress.DeviceAssetIssuanceAddress.getInstance(this.client.ctnNode.ctnNodeIndex, this.client.clientIndex, this.deviceIndex);

    // Critical section object to avoid concurrent access to database at the
    //  device object level (when updating device status basically)
    this.devDbCS = new CriticalSection();

    // TODO: update ReceivedMessage doc/rec to indicate that message has already been read as messages are read (read confirmation tx received)
}


// Public Device object methods
//

Device.prototype.disable = function () {
    // Make sure that device is not deleted
    if (this.status === Device.status.deleted.name) {
        // Cannot disable a deleted device. Log error and throw exception
        Catenis.logger.ERROR('Cannot disable a deleted device', {deviceId: this.deviceId});
        throw new Meteor.Error('ctn_device_deleted', util.format('Cannot disable a deleted device (deviceId: %s)', this.deviceId));
    }

    // Make sure that device is active
    if (this.status !== Device.status.active.name) {
        // Cannot disable a device that is not active. Log error and throw exception
        Catenis.logger.ERROR('Cannot disable a device that is not active', {deviceId: this.deviceId});
        throw new Meteor.Error('ctn_device_not_active', util.format('Cannot disable a device that is not active (deviceId: %s)', this.deviceId));
    }

    deactivateDevice.call(this);
};

Device.prototype.enable = function () {
    // Make sure that device is not deleted
    if (this.status === Device.status.deleted.name) {
        // Cannot enable a deleted device. Log error and throw exception
        Catenis.logger.ERROR('Cannot enable a deleted device', {deviceId: this.deviceId});
        throw new Meteor.Error('ctn_device_deleted', util.format('Cannot enable a deleted device (deviceId: %s)', this.deviceId));
    }

    // Make sure that device is inactive
    if (this.status !== Device.status.inactive.name) {
        // Cannot enable a device that is not inactive. Log error and throw exception
        Catenis.logger.ERROR('Cannot disable a device that is not inactive', {deviceId: this.deviceId});
        throw new Meteor.Error('ctn_device_not_inactive', util.format('Cannot enable a device that is not inactive (deviceId: %s)', this.deviceId));
    }

    activateDevice.call(this);
};
// TODO: add method renewApiAccessGenKey (same as we have for Client)

Device.prototype.delete = function (deletedDate) {
    if (this.status !== Device.status.deleted.name) {
        deletedDate = deletedDate != undefined ? deletedDate : new Date(Date.now());

        // Retrieve current state of fields that shall be changed
        const docDevice = Catenis.db.collection.Device.findOne({_id: this.doc_id}, {fields: {'props.prodUniqueId': 1, status: 1}}),
            delField = {};

        if (docDevice.props != undefined && docDevice.props.prodUniqueId != undefined) {
            delField.prodUniqueId = docDevice.props.prodUniqueId;
        }

        delField.status = docDevice.status;
        delField.deletedDate = deletedDate;

        try {
            // Update Device doc/rec setting its status to 'deleted'
            Catenis.db.collection.Device.update({_id: this.doc_id}, {
                $set: {
                    status: Device.status.deleted.name,
                    lastStatusChangedDate: deletedDate,
                    _deleted: delField
                }, $unset: {'props.prodUniqueId': ''}
            });
        }
        catch (err) {
            // Error updating Device doc/rec. Log error and throw exception
            Catenis.logger.ERROR(util.format('Error trying to delete device (doc_id: %s).', this.doc_id), err);
            throw new Meteor.Error('ctn_device_update_error', util.format('Error trying to delete device (doc_id: %s)', this.doc_id), err.stack);
        }

        // Update local variables
        this.prodUniqueId = undefined;
        this.status = Device.status.deleted.name;
    }
    else {
        // Device already deleted
        Catenis.logger.WARN('Trying to delete device that is already deleted');
    }
};

Device.prototype.fundAddresses = function () {
    // Make sure that device's status is new
    if (this.status !== Device.status.new.name) {
        // Cannot fund addresses of device the status of which is not new. Log error and throw exception
        Catenis.logger.ERROR('Cannot fund addresses of a device the status of which is not \'new\'', {deviceId: this.deviceId, currentStatus: this.status});
        throw new Meteor.Error('ctn_device_inconsistent_status', util.format('Cannot fund addresses of a device (deviceId: %s) the status of which is not \'new\' (currentStatus: %s)', this.deviceId, this.status));
    }

    let newDevStatus = undefined;

    // Execute code in critical section to avoid UTXOs concurrency
    Catenis.module.FundSource.utxoCS.execute(() => {
        // Check if device main and asset issuance addresses are already funded
        const devMainAddresses = this.mainAddr.listAddressesInUse(),
            assetIssuanceAddresses = this.assetIssuanceAddr.listAddressesInUse(),
            devMainAddrDistribFund = Catenis.module.Service.distributeDeviceMainAddressFund(),
            assetIssuanceAddrDistribFund = Catenis.module.Service.distributeDeviceAssetIssuanceAddressFund();

        // If device main addresses already exist, check if their
        //  balance is as expected
        const devMainAddrBalance = devMainAddresses.length > 0 ? (new Catenis.module.FundSource(devMainAddresses, {})).getBalance() : undefined;

        if (devMainAddrBalance != undefined && devMainAddrBalance > 0 && devMainAddrBalance != devMainAddrDistribFund.totalAmount) {
            // Amount funded to device main addresses different than expected.
            //  Log inconsistent condition
            Catenis.logger.WARN(util.format('Amount funded to device (Id: %s) main addresses different than expected. Current amount: %s, expected amount: %s', this.deviceId, Catenis.module.Util.formatCoins(devMainAddrBalance), Catenis.module.Util.formatCoins(devMainAddrDistribFund.totalAmount)));

            // Indicate that addresses should not be funded
            devMainAddrDistribFund.amountPerAddress = undefined;
        }

        // If device asset issuance addresses already exist, check if their
        //  balance is as expected
        const assetIssuanceAddrBalance = assetIssuanceAddresses.length > 0 ? (new Catenis.module.FundSource(assetIssuanceAddresses, {})).getBalance() : undefined;

        if (assetIssuanceAddrBalance != undefined && assetIssuanceAddrBalance > 0 && assetIssuanceAddrBalance != assetIssuanceAddrDistribFund.totalAmount) {
            // Amount funded to device asset issuance addresses different than expected.
            //  Log inconsistent condition
            Catenis.logger.WARN(util.format('Amount funded to device (Id: %s) asseet issuance addresses different than expected. Current amount: %s, expected amount: %s', this.deviceId, Catenis.module.Util.formatCoins(assetIssuanceAddrBalance), Catenis.module.Util.formatCoins(assetIssuanceAddrDistribFund.totalAmount)));

            // Indicate that addresses should not be funded
            assetIssuanceAddrDistribFund.amountPerAddress = undefined;
        }

        if (devMainAddrDistribFund.amountPerAddress != undefined || assetIssuanceAddrDistribFund.amountPerAddress != undefined) {
            // Device main addresses and/or device asset issuance addresses not funded yet, so fund them now
            fundDeviceAddresses.call(this, devMainAddrDistribFund.amountPerAddress, assetIssuanceAddrDistribFund.amountPerAddress);

            // Set new device status to pending
            newDevStatus = Device.status.pending.name;
        }
        else {
            // Device's addresses are already funded. Set new device status to active
            newDevStatus = Device.status.active.name;
        }

        // Make sure that system is properly funded
        Catenis.ctnHubNode.checkFundingBalance();
    });

    // Execute code in critical section to avoid DB concurrency
    this.devDbCS.execute(() => {
        // Now, update status of device, making sure that device status has not been updated (by a concurrent
        //  task) in the meantime
        const curDevDoc = Catenis.db.collection.Device.findOne({_id: this.doc_id}, {fields: {_id: 1, status: 1}});

        if ((newDevStatus === Device.status.pending.name && curDevDoc.status !== Device.status.new.name)
                || (newDevStatus === Device.status.active.name && curDevDoc.status !== Device.status.new.name && curDevDoc.status !== Device.status.pending.name)) {
            newDevStatus = undefined;
            this.status = curDevDoc.status;
        }

        if (newDevStatus != undefined) {
            try {
                Catenis.db.collection.Device.update({_id: this.doc_id}, {
                    $set: {
                        status: newDevStatus,
                        lastStatusChangedDate: new Date()
                    }
                });

                this.status = newDevStatus;
            }
            catch (err) {
                Catenis.logger.ERROR(util.format('Error trying to update status of device (doc Id: %s) to \'%s\'.', this.doc_id, newDevStatus), err);
                throw new Meteor.Error('ctn_device_update_error', util.format('Error trying to update status of device (doc Id: %s) to \'%s\'', this.doc_id, newDevStatus), err.stack);
            }
        }
    });
};

// Send message to another device
//
//  Arguments:
//    targetDeviceId: [String] // Device ID identifying the device to which the message should be sent
//    message: [Object] // Object of type Buffer containing the message to be sent
//    encryptMessage: [Boolean], // (optional, default: true) Indicates whether message should be encrypted before sending it
//    storageScheme: [String], // (optional, default: 'auto') A field of the Catenis.module.CatenisMessage.storageScheme property identifying how the message should be stored
//      storageProvider: [Object] // (optional, default: defaultStorageProvider) A field of the Catenis.module.CatenisMessage.storageProvider property
//                                //    identifying the type of external storage to be used to store the message that should not be embedded
//    }
Device.prototype.sendMessage = function (targetDeviceId, message, encryptMessage = true, storageScheme = 'auto', storageProvider) {
    // Make sure that device is not deleted
    if (this.status === Device.status.deleted.name) {
        // Cannot send message from a deleted device. Log error and throw exception
        Catenis.logger.ERROR('Cannot send message from a deleted device', {deviceId: this.deviceId});
        throw new Meteor.Error('ctn_device_deleted', util.format('Cannot send message from a deleted device (deviceId: %s)', this.deviceId));
    }

    // Make sure that device is active
    if (this.status !== Device.status.active.name) {
        // Cannot send message from a device that is not active. Log error and throw exception
        Catenis.logger.ERROR('Cannot send message from a device that is not active', {deviceId: this.deviceId});
        throw new Meteor.Error('ctn_device_not_active', util.format('Cannot send message from a device that is not active (deviceId: %s)', this.deviceId));
    }

    // TODO: make sure that this device has permission to send message to target device
    // Check if device's client has enough credits
    const confirmedMsgCredits = this.client.availableMessageCredits().confirmed;

    if (confirmedMsgCredits < cfgSettings.creditsToSendMessage) {
        // Not enough credits to send message. Log error condition and throw exception
        Catenis.logger.ERROR('Not enough credits to send message', {clientId: this.client.clientId, confirmedMsgCredits: confirmedMsgCredits, creditsToSendMessage: cfgSettings.creditsToSendMessage});
        throw new Meteor.Error('ctn_device_no_credits', util.format('Not enough credits to send message (clientId: %s, confirmedMsgCredits: %d, creditsToSendMessage: %d)', this.client.clientId, confirmedMsgCredits, cfgSettings.creditsToSendMessage));
    }

    let targetDevice = undefined;

    try {
        targetDevice = Device.getDeviceByDeviceId(targetDeviceId);

        // Make sure that target device is not deleted
        if (targetDevice.status === Device.status.deleted.name) {
            // Cannot send message to a deleted device. Log error and throw exception
            Catenis.logger.ERROR('Cannot send message to a deleted device', {deviceId: targetDeviceId});
            //noinspection ExceptionCaughtLocallyJS
            throw new Meteor.Error('ctn_device_target_deleted', util.format('Cannot send message to a deleted device (deviceId: %s)', targetDeviceId));
        }

        // Make sure that target device is active
        if (targetDevice.status !== Device.status.active.name) {
            // Cannot send message to a device that is not active. Log error condition and throw exception
            Catenis.logger.ERROR('Cannot send message to a device that is not active', {deviceId: targetDeviceId});
            //noinspection ExceptionCaughtLocallyJS
            throw new Meteor.Error('ctn_device_target_not_active', util.format('Cannot send message to a device that is not active (deviceId: %s)', targetDeviceId));
        }
    }
    catch (err) {
        if ((err instanceof Meteor.Error) && err.error === 'ctn_device_not_found') {
            // No target device available with given device ID. Log error and throw exception
            Catenis.logger.ERROR('Could not find target device with given device ID', {deviceId: targetDeviceId});
            throw new Meteor.Error('ctn_device_target_not_found', util.format('Could not find target device with given device ID (%s)', targetDeviceId));
        }
        else {
            // Otherwise, just re-throws exception
            throw err;
        }
    }

    let sentTxId = undefined;

    // Execute code in critical section to avoid UTXOs concurrency
    Catenis.module.FundSource.utxoCS.execute(() => {
        let sendMsgTransact = undefined;

        try {
            // Prepare transaction to send message to a device
            sendMsgTransact = new Catenis.module.SendMessageTransaction(this, targetDevice, message, {
                encrypted: encryptMessage,
                storageScheme: storageScheme,
                storageProvider: storageProvider
            });

            // Build and send transaction
            sendMsgTransact.buildTransaction();

            sentTxId = sendMsgTransact.sendTransaction();
        }
        catch (err) {
            // Error sending message to another device.
            //  Log error condition
            Catenis.logger.ERROR('Error sending message to another device.', err);

            if (sendMsgTransact != undefined) {
                // Revert output addresses added to transaction
                sendMsgTransact.revertOutputAddresses();
            }

            // Rethrows exception
            throw err;
        }
    });

    return sentTxId;
};

// Log message on the blockchain
//
//  Arguments:
//    message: [Object] // Object of type Buffer containing the message to be logged
//    encryptMessage: [Boolean], // (optional, default: true) Indicates whether message should be encrypted before logging it
//    storageScheme: [String], // (optional, default: 'auto') A field of the Catenis.module.CatenisMessage.storageScheme property identifying how the message should be stored
//      storageProvider: [Object] // (optional, default: defaultStorageProvider) A field of the Catenis.module.CatenisMessage.storageProvider property
//                                //    identifying the type of external storage to be used to store the message that should not be embedded
//    }
Device.prototype.logMessage = function (message, encryptMessage = true, storageScheme = 'auto', storageProvider) {
    // Make sure that device is not deleted
    if (this.status === Device.status.deleted.name) {
        // Cannot log message for a deleted device. Log error and throw exception
        Catenis.logger.ERROR('Cannot log message for a deleted device', {deviceId: this.deviceId});
        throw new Meteor.Error('ctn_device_deleted', util.format('Cannot log message for a deleted device (deviceId: %s)', this.deviceId));
    }

    // Make sure that device is active
    if (this.status !== Device.status.active.name) {
        // Cannot log message for a device that is not active. Log error and throw exception
        Catenis.logger.ERROR('Cannot log message for a device that is not active', {deviceId: this.deviceId});
        throw new Meteor.Error('ctn_device_not_active', util.format('Cannot log message for a device that is not active (deviceId: %s)', this.deviceId));
    }

    // Check if device's client has enough credits
    const confirmedMsgCredits = this.client.availableMessageCredits().confirmed;

    if (confirmedMsgCredits < cfgSettings.creditsToLogMessage) {
        // Not enough credits to log message. Log error condition and throw exception
        Catenis.logger.ERROR('Not enough credits to log message', {clientId: this.client.clientId, confirmedMsgCredits: confirmedMsgCredits, creditsToLogMessage: cfgSettings.creditsToLogMessage});
        throw new Meteor.Error('ctn_device_no_credits', util.format('Not enough credits to log message (clientId: %s, confirmedMsgCredits: %d, creditsToLogMessage: %d)', this.client.clientId, confirmedMsgCredits, cfgSettings.creditsToLogMessage));
    }

    let sentTxId = undefined;

    // Execute code in critical section to avoid UTXOs concurrency
    Catenis.module.FundSource.utxoCS.execute(() => {
        let logMsgTransact = undefined;

        try {
            // Prepare transaction to log message
            logMsgTransact = new Catenis.module.LogMessageTransaction(this, message, {
                encrypted: encryptMessage,
                storageScheme: storageScheme,
                storageProvider: storageProvider
            });

            // Build and send transaction
            logMsgTransact.buildTransaction();

            sentTxId = logMsgTransact.sendTransaction();
        }
        catch (err) {
            // Error logging message
            //  Log error condition
            Catenis.logger.ERROR('Error logging message.', err);

            if (logMsgTransact != undefined) {
                // Revert output addresses added to transaction
                logMsgTransact.revertOutputAddresses();
            }

            // Rethrows exception
            throw err;
        }
    });

    return sentTxId;
};

Device.prototype.readMessage = function (txid) {
    // Make sure that device is not deleted
    if (this.status === Device.status.deleted.name) {
        // Cannot read message for a deleted device. Log error and throw exception
        Catenis.logger.ERROR('Cannot read message for a deleted device', {deviceId: this.deviceId});
        throw new Meteor.Error('ctn_device_deleted', util.format('Cannot read message for a deleted device (deviceId: %s)', this.deviceId));
    }

    // Make sure that device is active
    if (this.status !== Device.status.active.name) {
        // Cannot read message for a device that is not active. Log error and throw exception
        Catenis.logger.ERROR('Cannot read message for a device that is not active', {deviceId: this.deviceId});
        throw new Meteor.Error('ctn_device_not_active', util.format('Cannot read message for a device that is not active (deviceId: %s)', this.deviceId));
    }

    let transact = undefined;

    try {
        transact = Catenis.module.Transaction.fromTxid(txid);
    }
    catch (err) {
        if ((err instanceof Meteor.Error) && err.details != undefined && typeof err.details.code === 'number'
            && err.details.code == Catenis.module.BitcoinCore.rpcErrorCode.RPC_INVALID_ADDRESS_OR_KEY) {
            // Error indicating that transaction id is not valid.
            //  Throws local error
            throw new Meteor.Error('ctn_device_invalid_txid', util.format('This is not a valid transaction id: %s', txid));
        }
        else {
            // An error other than invalid transaction id.
            //  Just re-throws it
            throw err;
        }
    }

    // First, check if this is a send message transaction
    const sendMsgTransact = Catenis.module.SendMessageTransaction.checkTransaction(transact);

    if (sendMsgTransact != undefined) {
        // Make sure that this message was intended to this device
        if (sendMsgTransact.targetDevice.deviceId === this.deviceId) {
            // TODO: check if message has not yet been read, and issue read confirmation transaction if so
            // Return message
            return sendMsgTransact.message;
        }
        else {
            // Throw exception indicating that message is not intended to this device
            throw new Meteor.Error('ctn_device_msg_no_access', 'Device has no access rights to read the message contained in this transaction');
        }
    }
    else {
        // If not, then check if this is a log message transaction
        const logMsgTransact = Catenis.module.LogMessageTransaction.checkTransaction(transact);

        if (logMsgTransact != undefined) {
            // Return message
            return logMsgTransact.message;
        }
        else {
            // Throw exception indicating that this is not a valid Catenis transaction
            throw new Meteor.Error('ctn_device_invalid_tx', 'This is not a valid Catenis message transaction');
        }
    }
};

// TODO: add methods to: issue asset (both locked and unlocked), register/import asset issued elsewhere, transfer asset, etc.


// Module functions used to simulate private Device object methods
//  NOTE: these functions need to be bound to a Device object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

// NOTE: make sure that this method is called from code executed from the FundSource.utxoCS
//  critical section object
function fundDeviceAddresses(amountPerDevMainAddress, amountPerAssetIssuanceAddress) {
    let fundTransact = undefined;

    try {
        // Prepare transaction to fund device main addresses
        fundTransact = new Catenis.module.FundTransaction(Catenis.module.FundTransaction.fundingEvent.provision_client_device, this.deviceId);

        if (amountPerDevMainAddress != undefined) {
            fundTransact.addPayees(this.mainAddr, amountPerDevMainAddress);
        }

        if (amountPerAssetIssuanceAddress != undefined) {
            fundTransact.addPayees(this.assetIssuanceAddr, amountPerAssetIssuanceAddress);
        }

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
        // Error funding device addresses.
        //  Log error condition
        Catenis.logger.ERROR(util.format('Error funding device (deviceId: %s) addresses.', this.deviceId), err);

        if (fundTransact != undefined) {
            // Revert addresses of payees added to transaction
            fundTransact.revertPayeeAddresses();
        }

        // Rethrows exception
        throw err;
    }
}

function activateDevice() {
    if (this.status !== Device.status.deleted.name && this.status !== Device.status.active.name) {
        // Execute code in critical section to avoid DB concurrency
        this.devDbCS.execute(() => {
            // Get current device status and check if it needs to be updated
            const curDevDoc = Catenis.db.collection.Device.findOne({_id: this.doc_id}, {fields: {_id: 1, status: 1}});

            if (curDevDoc.status !== Device.status.active.name && curDevDoc.status !== Device.status.deleted.name) {
                try {
                    Catenis.db.collection.Device.update({_id: this.doc_id}, {
                        $set: {
                            status: Device.status.active.name,
                            lastStatusChangedDate: new Date()
                        }
                    });
                }
                catch (err) {
                    Catenis.logger.ERROR(util.format('Error trying to update status of device (doc Id: %s) to \'active\'.', this.doc_id), err);
                    throw new Meteor.Error('ctn_device_update_error', util.format('Error trying to update status of device (doc Id: %s) to \'active\'', this.doc_id), err.stack);
                }
            }

            this.status = Device.status.active.name;
        });
    }
    else if (this.status === Device.status.deleted.name) {
        // Log inconsistent condition
        Catenis.logger.WARN('Trying to activate an inactive device', {deviceId: this.deviceId});
    }
    else {  // status == 'active'
        // Log inconsistent condition
        Catenis.logger.WARN('Trying to activate a device that is already activated', {deviceId: this.deviceId});
    }
}

function deactivateDevice() {
    if (this.status === Device.status.active.name) {
        // Execute code in critical section to avoid DB concurrency
        this.devDbCS.execute(() => {
            // Get current device status and check if it needs to be updated
            const curDevDoc = Catenis.db.collection.Device.findOne({_id: this.doc_id}, {fields: {_id: 1, status: 1}});

            if (curDevDoc.status === Device.status.active.name) {
                try {
                    Catenis.db.collection.Device.update({_id: this.doc_id}, {
                        $set: {
                            status: Device.status.inactive.name,
                            lastStatusChangedDate: new Date()
                        }
                    });
                }
                catch (err) {
                    Catenis.logger.ERROR(util.format('Error trying to update status of device (doc Id: %s) to \'inactive\'.', this.doc_id), err);
                    throw new Meteor.Error('ctn_device_update_error', util.format('Error trying to update status of device (doc Id: %s) to \'inactive\'', this.doc_id), err.stack);
                }
            }

            this.status = Device.status.inactive.name;
        });
    }
    else {
        // Log inconsistent condition
        Catenis.logger.WARN('Trying to deactivate a device that is not active', {deviceId: this.deviceId});
    }
}

// Device function class (public) methods
//

Device.initialize = function () {
    Catenis.logger.TRACE('Device initialization');
    // Set up handler for event notifying that funding transaction used to provision device has been confirmed
    TransactionMonitor.addEventHandler(TransactionMonitor.notifyEvent.funding_provision_client_device_tx_conf.name, fundingOfAddressesConfirmed);
};

Device.getDeviceByDeviceId = function (deviceId) {
    // Retrieve Device doc/rec
    const docDevice = Catenis.db.collection.Device.findOne({deviceId: deviceId, status: {$ne: Device.status.deleted.name}});

    if (docDevice == undefined) {
        // No device available with the given device ID. Log error and throw exception
        Catenis.logger.ERROR('Could not find device with given device ID', {deviceId: deviceId});
        throw new Meteor.Error('ctn_device_not_found', util.format('Could not find device with given device ID (%s)', deviceId));
    }

    return new Device(docDevice, Catenis.module.CatenisNode.getCatenisNodeByIndex(docDevice.index.ctnNodeIndex).getClientByIndex(docDevice.index.clientIndex));
};

Device.getDeviceByProductUniqueId = function (prodUniqueId) {
    // Retrieve Device doc/rec
    const docDevice = Catenis.db.collection.Device.findOne({'props.prodUniqueId': prodUniqueId, status: {$ne: Device.status.deleted.name}});

    if (docDevice == undefined) {
        // No device available with the given product unique ID. Log error and throw exception
        Catenis.logger.ERROR('Could not find device with given product unique ID', {prodUniqueId: prodUniqueId});
        throw new Meteor.Error('ctn_device_not_found', util.format('Could not find device with given product unique ID (%s)', prodUniqueId));
    }

    return new Device(docDevice, Catenis.module.CatenisNode.getCatenisNodeByIndex(docDevice.index.ctnNodeIndex).getClientByIndex(docDevice.index.clientIndex));
};

Device.checkDevicesToFund = function () {
    // Retrieve devices the status of which is still 'new'
    Catenis.db.collection.Device.find({status: Device.status.new.name}).forEach(doc => {
        try {
            Catenis.logger.TRACE(util.format('Funding addresses of existing device (deviceId: %s)', doc.deviceId));
            (new Device(doc, Catenis.module.CatenisNode.getCatenisNodeByIndex(doc.index.ctnNodeIndex).getClientByIndex(doc.index.clientIndex))).fundAddresses();
        }
        catch (err) {
            // Error trying to fund addresses of device. Log error condition
            Catenis.logger.ERROR(util.format('Error trying to fund addresses of device (deviceId: %s).', doc.deviceId), err);
        }
    });
};


// Device function class (public) properties
//

Device.status = Object.freeze({
    new: Object.freeze({
        name: 'new',
        description: 'Newly created device awaiting activation; funding of device\'s main/asset addresses have not started (due to lack of system funds)'
    }),
    pending: Object.freeze({
        name: 'pending',
        description: 'Awaiting confirmation of funding of device\'s main/asset addresses'
    }),
    active: Object.freeze({
        name: 'active',
        description: 'Device is in its normal use mode; after device\'s main/asset addresses have been funded'
    }),
    inactive: Object.freeze({
        name: 'inactive',
        description: 'Disabled device; device has been put temporarily out of use'
    }),
    deleted: Object.freeze({
        name: 'deleted',
        description: 'Device has been logically deleted'
    })
});


// Definition of module (private) functions
//

function fundingOfAddressesConfirmed(data) {
    Catenis.logger.TRACE('Received notification of confirmed funding transaction used to provision device', data);
    try {
        // Instantiate device
        const device = Device.getDeviceByDeviceId(data.entityId);

        // Check consistency of device status
        if (device.status !== Device.status.pending.name) {
            // Log unexpected condition
            Catenis.logger.WARN('Unexpected device status processing confirmation of funding of device addresses', {
                deviceId: this.deviceId,
                expectedStatus: Device.status.pending.name,
                currentStatus: this.status
            });
        }

        // Activate device
        activateDevice.call(device, data.txid);
    }
    catch (err) {
        // Just log error condition
        Catenis.logger.ERROR('Error handling event notifying that funding of device addresses has been confirmed.', err);
    }
}


// Module code
//

// Save module function class reference
Catenis.module.Device = Object.freeze(Device);
