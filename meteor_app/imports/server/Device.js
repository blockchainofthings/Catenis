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
const crypto = require('crypto');
// Third-party node modules
import config from 'config';
import _und from 'underscore';      // NOTE: we dot not use the underscore library provided by Meteor because we need
                                    //        a feature (_und.omit(obj,predicate)) that is not available in that version
// Meteor packages
import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { CriticalSection } from './CriticalSection';
import { TransactionMonitor } from './TransactionMonitor';
import { BitcoinCore } from './BitcoinCore';
import { DeviceMainAddress, DeviceReadConfirmAddress, DeviceAssetAddress, DeviceAssetIssuanceAddress } from './BlockchainAddress';
import { CatenisNode } from './CatenisNode';
import { FundSource } from './FundSource';
import { FundTransaction } from './FundTransaction';
import { LogMessageTransaction } from './LogMessageTransaction';
import { SendMessageTransaction } from './SendMessageTransaction';
import { Service } from './Service';
import { Transaction } from './Transaction';
import { Util } from './Util';
import { Message } from './Message';
import { ReadConfirmation } from './ReadConfirmation';
import { Permission } from './Permission';
import { cfgSettings as clientCfgSettings } from './Client';
import { Notification } from './Notification';

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
export function Device(docDevice, client) {
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
    this.props = docDevice.props;
    this.apiAccessGenKey = docDevice.apiAccessGenKey;
    this.status = docDevice.status;

    // Properties definition
    Object.defineProperties(this, {
        apiAccessSecret: {
            get: function () {
                // Use API access secret from client is an API access generator key is not defined
                //  for the device
                //noinspection JSPotentiallyInvalidUsageOfThis
                return this.apiAccessGenKey !== null ? crypto.createHmac('sha512', this.apiAccessGenKey).update('And here it is: the Catenis API key for device' + this.clientId).digest('hex')
                    : this.client.apiAccessSecret;
            }
        },
        isActive: {
            get: function () {
                // noinspection JSPotentiallyInvalidUsageOfThis
                return this.status === Device.status.active.name;
            },
            enumerable: true
        },
        isDisabled: {
            get: function () {
                // noinspection JSPotentiallyInvalidUsageOfThis
                return this.status === Device.status.inactive.name;
            },
            enumerable: true
        },
        isDeleted: {
            get: function () {
                // noinspection JSPotentiallyInvalidUsageOfThis
                return this.status === Device.status.deleted.name;
            },
            enumerable: true
        }
    });

    // Instantiate objects to manage blockchain addresses for device
    this.mainAddr = DeviceMainAddress.getInstance(this.client.ctnNode.ctnNodeIndex, this.client.clientIndex, this.deviceIndex);
    this.readConfirmAddr = DeviceReadConfirmAddress.getInstance(this.client.ctnNode.ctnNodeIndex, this.client.clientIndex, this.deviceIndex);
    this.assetAddr = DeviceAssetAddress.getInstance(this.client.ctnNode.ctnNodeIndex, this.client.clientIndex, this.deviceIndex);
    this.assetIssuanceAddr = DeviceAssetIssuanceAddress.getInstance(this.client.ctnNode.ctnNodeIndex, this.client.clientIndex, this.deviceIndex);

    // Critical section object to avoid concurrent access to database at the
    //  device object level (when updating device status basically)
    this.devDbCS = new CriticalSection();
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

Device.prototype.renewApiAccessGenKey = function (useClientDefaultKey = false) {
    // Make sure that device is not deleted
    if (this.status !== Device.status.deleted.name &&
        Catenis.db.collection.Device.findOne({_id: this.doc_id, status: Device.status.deleted.name}, {fields:{_id:1}}) !== undefined) {
        // Device has been deleted. Update its status
        this.status = Device.status.deleted.name;
    }

    if (this.status === Device.status.deleted.name) {
        // Cannot renew API access generator key for deleted device. Log error and throw exception
        Catenis.logger.ERROR('Cannot renew API access generator key for deleted device', {deviceId: this.deviceId});
        throw new Meteor.Error('ctn_device_deleted', util.format('Cannot renew API access generator key for deleted device (deviceId: %s)', this.deviceId));
    }

    // Generate new key
    const key = !useClientDefaultKey ? Random.secret() : null;

    try {
        Catenis.db.collection.Device.update({_id: this.doc_id}, {$set: {apiAccessGenKey: key, lastApiAccessGenKeyModifiedDate: new Date()}});
    }
    catch (err) {
        Catenis.logger.ERROR('Error updating device API access generator key', err);
        throw new Meteor.Error('ctn_device_update_error', 'Error updating device API access generator key', err.stack);
    }

    // Update key locally
    this.apiAccessGenKey = key;
};

Device.prototype.delete = function (deletedDate) {
    if (this.status !== Device.status.deleted.name) {
        deletedDate = deletedDate ? deletedDate : new Date();

        // Retrieve current state of fields that shall be changed
        const docDevice = Catenis.db.collection.Device.findOne({_id: this.doc_id}, {fields: {'props.prodUniqueId': 1, status: 1}}),
            delField = {};

        if (docDevice.props && docDevice.props.prodUniqueId !== undefined) {
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
        this.props.prodUniqueId = undefined;
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
    FundSource.utxoCS.execute(() => {
        // Check if device main and asset issuance addresses are already funded
        const devMainAddresses = this.mainAddr.listAddressesInUse(),
            assetIssuanceAddresses = this.assetIssuanceAddr.listAddressesInUse(),
            devMainAddrDistribFund = Service.distributeDeviceMainAddressFund(),
            assetIssuanceAddrDistribFund = Service.distributeDeviceAssetIssuanceAddressFund();

        // If device main addresses already exist, check if their
        //  balance is as expected
        const devMainAddrBalance = devMainAddresses.length > 0 ? (new FundSource(devMainAddresses, {})).getBalance(true) : undefined;

        if (devMainAddrBalance !== undefined && devMainAddrBalance > 0 && devMainAddrBalance !== devMainAddrDistribFund.totalAmount) {
            // Amount funded to device main addresses different than expected.
            //  Log inconsistent condition
            Catenis.logger.WARN(util.format('Amount funded to device (Id: %s) main addresses different than expected. Current amount: %s, expected amount: %s', this.deviceId, Util.formatCoins(devMainAddrBalance), Util.formatCoins(devMainAddrDistribFund.totalAmount)));

            // Indicate that main addresses should not be funded
            devMainAddrDistribFund.amountPerAddress = undefined;
        }

        // If device asset issuance addresses already exist, check if their
        //  balance is as expected
        const assetIssuanceAddrBalance = assetIssuanceAddresses.length > 0 ? (new FundSource(assetIssuanceAddresses, {})).getBalance(true) : undefined;

        if (assetIssuanceAddrBalance !== undefined && assetIssuanceAddrBalance > 0 && assetIssuanceAddrBalance !== assetIssuanceAddrDistribFund.totalAmount) {
            // Amount funded to device asset issuance addresses different than expected.
            //  Log inconsistent condition
            Catenis.logger.WARN(util.format('Amount funded to device (Id: %s) asset issuance addresses different than expected. Current amount: %s, expected amount: %s', this.deviceId, Util.formatCoins(assetIssuanceAddrBalance), Util.formatCoins(assetIssuanceAddrDistribFund.totalAmount)));

            // Indicate that asset issuance addresses should not be funded
            assetIssuanceAddrDistribFund.amountPerAddress = undefined;
        }

        if (devMainAddrDistribFund.amountPerAddress !== undefined || assetIssuanceAddrDistribFund.amountPerAddress !== undefined) {
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

        if (newDevStatus !== undefined) {
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

Device.prototype.fixFundAddresses = function () {
    // Execute code in critical section to avoid UTXOs concurrency
    FundSource.utxoCS.execute(() => {
        // Check if device main addresses are already funded
        const devMainAddresses = this.mainAddr.listAddressesInUse(),
            devMainAddrDistribFund = Service.distributeDeviceMainAddressFund();

        // If device main addresses already exist, check if their balance is as expected
        const devMainAddrBalance = devMainAddresses.length > 0 ? (new FundSource(devMainAddresses, {})).getBalance(true) : undefined;

        if (devMainAddrBalance !== undefined && devMainAddrBalance > 0 && devMainAddrBalance !== devMainAddrDistribFund.totalAmount) {
            // Amount funded to device main addresses different than expected
            if (devMainAddrDistribFund.totalAmount > devMainAddrBalance) {
                // Expected funding amount is higher than currently funded amount.
                //  Allocate amount difference to fix funding of device main addresses
                Catenis.logger.WARN('Funding of device main addresses lower than expected; preparing to fix it', {
                    deviceId: this.deviceId,
                    expectedFundingAmount: Util.formatCoins(devMainAddrDistribFund.totalAmount),
                    currentFundingAmount: Util.formatCoins(devMainAddrBalance)
                });
                devMainAddrDistribFund.totalAmount = devMainAddrDistribFund.totalAmount - devMainAddrBalance;
                devMainAddrDistribFund.amountPerAddress = Service.distributeDeviceMainAddressDeltaFund(devMainAddrDistribFund.totalAmount);

                // Fix funding of device main addresses
                fundDeviceAddresses.call(this, devMainAddrDistribFund.amountPerAddress);

                // Make sure that system is properly funded
                Catenis.ctnHubNode.checkFundingBalance();
            }
            else {
                // Expected funding amount lower than currently funded amount.
                //  Just log inconsistent condition
                Catenis.logger.WARN('Funding of device main addresses higher than expected', {
                    deviceId: this.deviceId,
                    expectedFundingAmount: Util.formatCoins(devMainAddrDistribFund.totalAmount),
                    currentFundingAmount: Util.formatCoins(devMainAddrBalance)
                });
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
//    storageScheme: [String], // (optional, default: 'auto') A field of the CatenisMessage.storageScheme property identifying how the message should be stored
//    storageProvider: [Object] // (optional, default: defaultStorageProvider) A field of the CatenisMessage.storageProvider property
//                              //    identifying the type of external storage to be used to store the message that should not be embedded
//
//  Return value: {
//    messageId: [String]       // ID of sent message
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

    let messageId;

    // Execute code in critical section to avoid UTXOs concurrency
    FundSource.utxoCS.execute(() => {
        let sendMsgTransact;
        let txid;

        try {
            // Prepare transaction to send message to a device
            sendMsgTransact = new SendMessageTransaction(this, targetDevice, message, {
                encrypted: encryptMessage,
                storageScheme: storageScheme,
                storageProvider: storageProvider
            });

            // Build and send transaction
            sendMsgTransact.buildTransaction();

            txid = sendMsgTransact.sendTransaction();

            // Force polling of blockchain so newly sent transaction is received and processed right away
            Catenis.txMonitor.pollNow();

            // Create message and save it to local database
            messageId = Message.createLocalMessage(sendMsgTransact);
        }
        catch (err) {
            // Error sending message to another device.
            //  Log error condition
            Catenis.logger.ERROR('Error sending message to another device.', err);

            if (sendMsgTransact && !txid) {
                // Revert output addresses added to transaction
                sendMsgTransact.revertOutputAddresses();
            }

            // Rethrows exception
            throw err;
        }
    });

    return messageId;
};

// Log message on the blockchain
//
//  Arguments:
//    message: [Object] // Object of type Buffer containing the message to be logged
//    encryptMessage: [Boolean], // (optional, default: true) Indicates whether message should be encrypted before logging it
//    storageScheme: [String], // (optional, default: 'auto') A field of the CatenisMessage.storageScheme property identifying how the message should be stored
//    storageProvider: [Object] // (optional, default: defaultStorageProvider) A field of the CatenisMessage.storageProvider property
//                              //    identifying the type of external storage to be used to store the message that should not be embedded
//
//  Return value:
//    messageId: [String]       // ID of logged message
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

    let messageId ;

    // Execute code in critical section to avoid UTXOs concurrency
    FundSource.utxoCS.execute(() => {
        let logMsgTransact;
        let txid;

        try {
            // Prepare transaction to log message
            logMsgTransact = new LogMessageTransaction(this, message, {
                encrypted: encryptMessage,
                storageScheme: storageScheme,
                storageProvider: storageProvider
            });

            // Build and send transaction
            logMsgTransact.buildTransaction();

            txid = logMsgTransact.sendTransaction();

            // Force polling of blockchain so newly sent transaction is received and processed right away
            Catenis.txMonitor.pollNow();

            // Create message and save it to local database
            messageId = Message.createLocalMessage(logMsgTransact);
        }
        catch (err) {
            // Error logging message
            //  Log error condition
            Catenis.logger.ERROR('Error logging message.', err);

            if (logMsgTransact && !txid) {
                // Revert output addresses added to transaction
                logMsgTransact.revertOutputAddresses();
            }

            // Rethrows exception
            throw err;
        }
    });

    return messageId;
};

// Read message previously sent/logged
//
//  Arguments:
//    messageId: [String]  // ID of message to read
//
//  Return value:
//    msgInfo: {
//      action: [String],  // The action performed on the message; either 'log' or 'send' (from Message.action)
//      originDevice: [Object],  // Device that logged/sent the message
//      targetDevice: [Object],  // Device to which message was sent (present only action = 'send')
//      message: [Object] // Buffer containing the read message
//    }
//
Device.prototype.readMessage = function (messageId) {
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

    // Get message
    const message = Message.getMessageByMessageId(messageId, this.deviceId);

    // Make sure that device can read the message. For now, just make sure that
    //  device is the one that either logged or to which the message has been sent
    if (!((message.action === Message.action.log && message.originDeviceId === this.deviceId)
            || (message.action === Message.action.send && message.targetDeviceId === this.deviceId))) {
        // Throw exception indicating that message cannot be accessed by this device
        throw new Meteor.Error('ctn_device_msg_no_access', 'Device has no access rights to read the message');
    }

    // Get transaction associated with message
    let txid = message.txid;
    let transact = undefined;
    let alreadyRetried = false;
    let tryAgain;

    do {
        tryAgain = false;

        try {
            transact = Transaction.fromTxid(txid);
        }
        catch (err) {
            if ((err instanceof Meteor.Error) && err.error === 'ctn_btcore_rpc_error' && err.details !== undefined && typeof err.details.code === 'number'
                    && (err.details.code === BitcoinCore.rpcErrorCode.RPC_INVALID_ADDRESS_OR_KEY || err.details.code === BitcoinCore.rpcErrorCode.RPC_INVALID_PARAMETER)) {
                // Error indicating that transaction id is not valid

                if (!alreadyRetried) {
                    // Try to retrieve info about transaction
                    let txInfo;

                    try {
                        // Make sure that error thrown by getTransaction() is not logged.
                        //  This is necessary because any transaction that are not associated
                        //  with a wallet address will make getTransaction() to throw an error
                        //  (with code = RPC_INVALID_ADDRESS_OR_KEY)
                        txInfo = Catenis.bitcoinCore.getTransaction(txid, false, false);
                    }
                    catch (err) {
                        if (!((err instanceof Meteor.Error) && err.error === 'ctn_btcore_rpc_error' && err.details !== undefined && typeof err.details.code === 'number'
                                && err.details.code === BitcoinCore.rpcErrorCode.RPC_INVALID_ADDRESS_OR_KEY)) {
                            // An error other than indication that it is a non-wallet tx id.
                            //  Just re-throws it
                            throw err;
                        }
                    }

                    if (txInfo) {
                        // Checks if tx id had been replaced by another transaction that had already been
                        //  confirmed (possibly) due to malleability
                        if (txInfo.walletconflicts.length > 0) {
                            txInfo.walletconflicts.some((cnfltTxid) => {
                                const cnfltTxInfo = Catenis.bitcoinCore.getTransaction(cnfltTxid);

                                if (cnfltTxInfo.confirmations > 0 && Transaction.areTxsIdentical(cnfltTxInfo, txInfo)) {
                                    // Conflicting (confirmed) tx is identical to original tx. Assume that original tx
                                    //  had its ID replaced due to malleability

                                    // Replace tx id and try to get transaction associated with message again
                                    txid = cnfltTxid;
                                    tryAgain = true;
                                    alreadyRetried = true;

                                    // Stop loop (walletconflicts.some)
                                    return true;
                                }

                                return false;
                            });
                        }
                    }
                }

                if (!tryAgain) {
                    //  Log Error and throws exception
                    Catenis.logger.ERROR('Message has an invalid transaction id', {messageId: messageId, txid: txid});
                    throw new Meteor.Error('ctn_msg_invalid_txid', util.format('Message (messageId: %s) has an invalid transaction id: %s', messageId, txid));
                }
            }
            else {
                // An error other than invalid transaction id.
                //  Just re-throws it
                throw err;
            }
        }
    }
    while (tryAgain);

    // Parse transaction to read its contents
    const msgTransact = message.action === Message.action.log ? LogMessageTransaction.checkTransaction(transact) :
            (message.action === Message.action.send ? SendMessageTransaction.checkTransaction(transact) : undefined);

    if (msgTransact !== undefined) {
        // Indicates that message has been read
        if (message.readNow()) {
            // This was the first time that message has been read
            if (message.action === Message.action.send) {
                // Confirm that message has been read
                const confirmType = this.shouldSendReadMsgConfirmationTo(msgTransact.originDevice) ? ReadConfirmation.confirmationType.spendNotify : ReadConfirmation.confirmationType.spendOnly;

                try {
                    Catenis.readConfirm.confirmMessageRead(msgTransact, confirmType);
                }
                catch (err) {
                    // Error while trying to send confirmation of message read
                    Catenis.logger.ERROR('Error while trying to send confirmation of message read.', err);
                }
            }
        }

        // And returns message info
        const msgInfo = {
            action: message.action
        };

        if (message.action === Message.action.log) {
            msgInfo.originDevice = msgTransact.device;
        }
        else {  // message.action === Message.action.send
            msgInfo.originDevice = msgTransact.originDevice;
            msgInfo.targetDevice = msgTransact.targetDevice;
        }

        msgInfo.message = msgTransact.message ? msgTransact.message : msgTransact.rawMessage;

        return msgInfo;
    }
    else {
        // Not a valid Catenis transaction (this should never happen). Log error and throws exception
        Catenis.logger.ERROR('Message is associated with a non-Catenis transaction', {messageId: messageId, txid: txid});
        throw new Meteor.Error('ctn_msg_invalid_tx', util.format('Message (messageId: %s) is associated with a non-Catenis transaction id: %s', messageId, txid));
    }
};

// Retrieve info about where a message previously sent/logged is recorded
//
//  Arguments:
//    messageId: [String]  // ID of message to get container info
//
//  Return value:
//    containerInfo: {
//      blockchain: {
//        txid: [String],         // ID of blockchain transaction where message is recorded
//                                //  NOTE: due to malleability, the ID of the transaction might change
//                                //    until the it is finally confirmed
//        isConfirmed: [Boolean]  // Indicates whether the returned txid is confirmed
//      },
//      externalStorage: {     // Note: only returned if message is stored in an external storage
//        <storage_provider_name>: [String]  // Key: storage provider name. Value: reference to message in external storage
//      }
//    }
//
Device.prototype.retrieveMessageContainer = function (messageId) {
    // Make sure that device is not deleted
    if (this.status === Device.status.deleted.name) {
        // Cannot retrieve message container for a deleted device. Log error and throw exception
        Catenis.logger.ERROR('Cannot retrieve message container for a deleted device', {deviceId: this.deviceId});
        throw new Meteor.Error('ctn_device_deleted', util.format('Cannot retrieve message container for a deleted device (deviceId: %s)', this.deviceId));
    }

    // Make sure that device is active
    if (this.status !== Device.status.active.name) {
        // Cannot retrieve message container for a device that is not active. Log error and throw exception
        Catenis.logger.ERROR('Cannot retrieve message container for a device that is not active', {deviceId: this.deviceId});
        throw new Meteor.Error('ctn_device_not_active', util.format('Cannot retrieve message container for a device that is not active (deviceId: %s)', this.deviceId));
    }

    // Get message
    const message = Message.getMessageByMessageId(messageId, this.deviceId);

    // Make sure that device can read the message. Only the device that logged/sent
    //  the message can retrieve its container
    if (message.originDeviceId !== this.deviceId) {
        // Throw exception indicating that message container cannot be retrieved by this device
        throw new Meteor.Error('ctn_device_msg_no_access', 'Device has no access rights to retrieve message container');
    }

    // Returns message container info
    const containerInfo = {
        blockchain: {
            txid: message.txid,
            isConfirmed: message.isTxConfirmed
        }
    };

    if (message.storageProviderName && message.externalStorageRef) {
        containerInfo.externalStorage = {};

        containerInfo.externalStorage[message.storageProviderName] = message.externalStorageRef;
    }

    return containerInfo;
};

// Retrieve a list of messages logged/sent/received by device that adhere to the specified filtering criteria
//
//  Arguments:
//    filter: [Object]  // Object containing properties that specify the filtering criteria. Please refer to Message.query method for details about those properties
//
//  Result:
//    listResult: {
//      msgEntries: [{
//        messageId: [String],  // ID of message
//        action: [String],     // Action originally performed on the message. Valid values: log|send
//        direction: [String],  // (only returned for action = 'send') Direction of the sent message. Valid values: inbound|outbound
//        fromDevice: [Object],  // Device that had sent the message. (only returned for messages sent to the current device)
//        toDevice: [Object],     // Device to which message had been sent. (only returned for messages sent from the current device)
//        read: [Boolean],  // Indicates whether the message had already been read
//        date: [Date],     // Date and time when the message had been logged/sent/received
//      }],
//      countExceeded: [Boolean]  // Indicates whether the number of messages that satisfied the query criteria was greater than the maximum
//                                //  number of messages that can be returned, and for that reason the returned list had been truncated
//    }
//
Device.prototype.listMessages = function(filter) {
    // Make sure that device is not deleted
    if (this.status === Device.status.deleted.name) {
        // Cannot list messages for a deleted device. Log error and throw exception
        Catenis.logger.ERROR('Cannot list messages for a deleted device', {deviceId: this.deviceId});
        throw new Meteor.Error('ctn_device_deleted', util.format('Cannot list messages for a deleted device (deviceId: %s)', this.deviceId));
    }

    // Make sure that device is active
    if (this.status !== Device.status.active.name) {
        // Cannot list messages for a device that is not active. Log error and throw exception
        Catenis.logger.ERROR('Cannot list messages for a device that is not active', {deviceId: this.deviceId});
        throw new Meteor.Error('ctn_device_not_active', util.format('Cannot list messages for a device that is not active (deviceId: %s)', this.deviceId));
    }

    // Query messages for this device
    const queryResult = Message.query(this.deviceId, filter);

    const listResult = {
        msgEntries: [],
        countExceeded: queryResult.countExceeded
    };

    queryResult.messages.forEach((message) => {
        let msgEntry = {
            messageId: message.messageId,
            action: message.action
        };

        if (message.action === Message.action.log) {
            msgEntry.read = message.firstReadDate !== undefined;
            msgEntry.date = message.sentDate;
        }
        else if (message.action === Message.action.send) {
            if ((filter.direction === undefined || filter.direction === Message.direction.outbound) && message.originDeviceId === this.deviceId) {
                msgEntry.direction = Message.direction.outbound;
                msgEntry.toDevice = Device.getDeviceByDeviceId(message.targetDeviceId);
                msgEntry.read = message.firstReadDate !== undefined;
                msgEntry.date = message.sentDate;
            }

            if ((filter.direction === undefined || filter.direction === Message.direction.inbound) && message.targetDeviceId === this.deviceId) {
                if (msgEntry.direction !== undefined) {
                    // Special case of a message sent to the same device and no filtering on message direction.
                    //  In this case, split the message into two entries: one with inbound direction
                    //  and the other with outbound direction
                    listResult.msgEntries.push(msgEntry);

                    msgEntry = {
                        messageId: message.messageId,
                        action: message.action
                    };
                }

                msgEntry.direction = Message.direction.inbound;
                msgEntry.fromDevice = Device.getDeviceByDeviceId(message.originDeviceId);
                msgEntry.read = message.firstReadDate !== undefined;
                msgEntry.date = message.receivedDate;
            }
        }

        listResult.msgEntries.push(msgEntry);
    });

    return listResult;
};

Device.prototype.retrieveDeviceIdentityInfo = function (device) {
    // Make sure that device is not deleted
    if (this.status === Device.status.deleted.name) {
        // Cannot retrieve other device's identification information for a deleted device. Log error and throw exception
        Catenis.logger.ERROR('Cannot retrieve other device\'s identification information for a deleted device', {deviceId: this.deviceId});
        throw new Meteor.Error('ctn_device_deleted', util.format('Cannot retrieve other device\'s identification information for a deleted device (deviceId: %s)', this.deviceId));
    }

    // Make sure that device is active
    if (this.status !== Device.status.active.name) {
        // Cannot retrieve other device's identification information for a deleted device. Log error and throw exception
        Catenis.logger.ERROR('Cannot retrieve other device\'s identification information for a deleted device', {deviceId: this.deviceId});
        throw new Meteor.Error('ctn_device_not_active', util.format('Cannot retrieve other device\'s identification information for a deleted device (deviceId: %s)', this.deviceId));
    }

    // Make sure that device has permission to retrieve that other device's identification information
    if (!device.shouldDiscloseIdentityInfoTo(this)) {
        // Device has no permission rights to retrieve that other device's identification info
        Catenis.logger.INFO('Device has no permission to retrieve that other device\'s identification information', {
            deviceId: this.deviceId,
            otherDeviceId: device.deviceId
        });
        throw new Meteor.Error('ctn_device_no_permission', util.format('Device has no permission to retrieve that other device\'s identification information (deviceId: %s, otherDeviceId: %s)', this.deviceId, device.deviceId));
    }

    return device.getIdentityInfo();
};

// Update device properties
//
// Arguments:
//  props: [string] - new name of device
//         or
//         [object] - object containing properties that should be updated and their corresponding new values.
//                     To delete a property, set it as undefined.
//
Device.prototype.updateProperties = function (newProps) {
    newProps = typeof newProps === 'string' ? {name: newProps} : (typeof newProps === 'object' && newProps !== null ? newProps : {});

    if ('prodUniqueId' in newProps) {
        // Avoid that product unique ID of device be changed
        delete newProps.prodUniqueId;
    }

    if (Object.keys(newProps).length > 0) {
        // Validate (pre-defined) properties
        const errProp = {};

        // Allow this property to be undefined so it can be deleted
        if ('name' in newProps && (typeof newProps.name !== 'string' && typeof newProps.name !== 'undefined')) {
            errProp.name = newProps.name;
        }

        // Allow this property to be undefined so it can be deleted
        if ('public' in newProps && (typeof newProps.public !== 'boolean' && typeof newProps.public !== 'undefined')) {
            errProp.public = newProps.public;
        }

        if (Object.keys(errProp).length > 0) {
            const errProps = Object.keys(errProp);

            Catenis.logger.ERROR(util.format('Device.updateProperties method called with invalid propert%s', errProps.length > 1 ? 'ies' : 'y'), errProp);
            throw Error(util.format('Invalid %s propert%s', errProps.join(', '), errProps.length > 1 ? 'ies' : 'y'));
        }

        // Make sure that device is not deleted
        if (this.status === Device.status.deleted.name) {
            // Cannot update properties of a deleted device. Log error and throw exception
            Catenis.logger.ERROR('Cannot update properties of a deleted device', {deviceId: this.deviceId});
            throw new Meteor.Error('ctn_device_deleted', util.format('Cannot update properties of a deleted device (deviceId: %s)', this.deviceId));
        }

        // Retrieve current device properties
        const currProps = Catenis.db.collection.Device.findOne({_id: this.doc_id}, {fields: {props: 1}}).props;
        let props = _und.clone(currProps);

        // Merge properties to update
        _und.extend(props, newProps);

        // Extract properties that are undefined
        props = _und.omit(props, (value) => {
            return _und.isUndefined(value);
        });

        if (!_und.isEqual(props, currProps)) {
            try {
                // Update Device doc/rec setting the new properties
                Catenis.db.collection.Device.update({_id: this.doc_id}, {$set: {props: props}});
            }
            catch (err) {
                // Error updating Device doc/rec. Log error and throw exception
                Catenis.logger.ERROR(util.format('Error trying to update device properties (doc_id: %s).', this.doc_id), err);
                throw new Meteor.Error('ctn_device_update_error', util.format('Error trying to update device properties (doc_id: %s)', this.doc_id), err.stack);
            }

            // Update properties locally too
            this.props = props;
        }
    }
};

Device.prototype.getPublicProps = function () {
    let result = {};

    if (this.props.public) {
        if (this.props.name !== undefined) {
            result.name = this.props.name;
        }

        if (this.props.prodUniqueId !== undefined) {
            result.prodUniqueId = this.props.prodUniqueId;
        }
    }

    return result;
};

Device.prototype.discloseMainPropsTo = function (device) {
    let result = {};

    if (this.shouldDiscloseMainPropsTo(device)) {
        if (this.props.name !== undefined) {
            result.name = this.props.name;
        }

        if (this.props.prodUniqueId !== undefined) {
            result.prodUniqueId = this.props.prodUniqueId;
        }
    }

    return result;
};

// Get device's basic identification information, including client's identification information
Device.prototype.getIdentityInfo = function () {
    const idInfo = this.client.getIdentityInfo();

    idInfo.device = {
        deviceId: this.deviceId
    };

    if (this.props.name !== undefined) {
        idInfo.device.name = this.props.name;
    }

    if (this.props.prodUniqueId !== undefined) {
        idInfo.device.prodUniqueId = this.props.prodUniqueId;
    }

    return idInfo;
};

/** Permission related methods **/
Device.prototype.shouldBeNotifiedOfNewMessageFrom = function (device) {
    return Catenis.permission.hasRight(Permission.event.receive_notify_new_msg.name, this, device);
};

Device.prototype.shouldBeNotifiedOfMessageReadBy = function (device) {
    return Catenis.permission.hasRight(Permission.event.receive_notify_msg_read.name, this, device);
};

Device.prototype.shouldSendReadMsgConfirmationTo = function (device) {
    return Catenis.permission.hasRight(Permission.event.send_read_msg_confirm.name, this, device);
};

Device.prototype.shouldReceiveMsgFrom = function (device) {
    return Catenis.permission.hasRight(Permission.event.receive_msg.name, this, device);
};

Device.prototype.shouldDiscloseMainPropsTo = function (device) {
    return Catenis.permission.hasRight(Permission.event.disclose_main_props.name, this, device);
};

Device.prototype.shouldDiscloseIdentityInfoTo = function (device) {
    return Catenis.permission.hasRight(Permission.event.disclose_identity_info.name, this, device);
};

Device.prototype.checkEffectiveRight = function (eventName, device) {
    // Make sure that device is not deleted
    if (this.status === Device.status.deleted.name) {
        // Cannot check effective permission right for a deleted device. Log error and throw exception
        Catenis.logger.ERROR('Cannot check effective permission right for a deleted device', {deviceId: this.deviceId});
        throw new Meteor.Error('ctn_device_deleted', util.format('Cannot check effective permission right for a deleted device (deviceId: %s)', this.deviceId));
    }

    // Make sure that device is active
    if (this.status !== Device.status.active.name) {
        // Cannot check effective permission right for a device that is not active. Log error and throw exception
        Catenis.logger.ERROR('Cannot check effective permission right for a device that is not active', {deviceId: this.deviceId});
        throw new Meteor.Error('ctn_device_not_active', util.format('Cannot check effective permission right for a device that is not active (deviceId: %s)', this.deviceId));
    }

    return Catenis.permission.hasRight(eventName, this, device);
};

Device.prototype.setRights = function(eventName, rights, isInitial = false) {
    // Make sure that device is not deleted
    if (this.status === Device.status.deleted.name) {
        // Cannot set permission rights for a deleted device. Log error and throw exception
        Catenis.logger.ERROR('Cannot set permission rights for a deleted device', {deviceId: this.deviceId});
        throw new Meteor.Error('ctn_device_deleted', util.format('Cannot set permission rights for a deleted device (deviceId: %s)', this.deviceId));
    }

    // Make sure that device is active
    if (!isInitial && this.status !== Device.status.active.name) {
        // Cannot set permission rights for a device that is not active. Log error and throw exception
        Catenis.logger.ERROR('Cannot set permission rights for a device that is not active', {deviceId: this.deviceId});
        throw new Meteor.Error('ctn_device_not_active', util.format('Cannot set permission rights for a device that is not active (deviceId: %s)', this.deviceId));
    }

    return Catenis.permission.setRights(eventName, this, Permission.fixRightsReplaceOwnHierarchyEntity(rights, this));
};

Device.prototype.getRights = function(eventName) {
    // Make sure that device is not deleted
    if (this.status === Device.status.deleted.name) {
        // Cannot retrieve permission right settings for a deleted device. Log error and throw exception
        Catenis.logger.ERROR('Cannot retrieve permission right setting for a deleted device', {deviceId: this.deviceId});
        throw new Meteor.Error('ctn_device_deleted', util.format('Cannot retrieve permission right setting for a deleted device (deviceId: %s)', this.deviceId));
    }

    // Make sure that device is active
    if (this.status !== Device.status.active.name) {
        // Cannot retrieve permission right settings for a device that is not active. Log error and throw exception
        Catenis.logger.ERROR('Cannot retrieve permission right settings for a device that is not active', {deviceId: this.deviceId});
        throw new Meteor.Error('ctn_device_not_active', util.format('Cannot retrieve permission right settings for a device that is not active (deviceId: %s)', this.deviceId));
    }

    return Catenis.permission.getRights(eventName, this);
};

// Set initial permission rights for device
//
//  Arguments:
//   rightsByEvent [Object] - Object the keys of which should be the defined permission event names.
//                          -  The value for each event name key should be a rights object as defined for the Permission.setRights method
Device.prototype.setInitialRights = function (rightsByEvent) {
    Object.keys(rightsByEvent).forEach((eventName) => {
        if (Permission.isValidEventName(eventName)) {
            this.setRights(eventName, rightsByEvent[eventName], true);
        }
    });
};
/** End of permission related methods **/

/** Notification related methods **/
Device.prototype.notifyNewMessageReceived = function (message, originDevice) {
    // Prepare information about received message to be sent by notification
    const msgInfo = {
        messageId: message.messageId,
        from: {
            deviceId: message.originDeviceId,
        },
        receivedDate: message.receivedDate
    };

    // Add device public properties
    if (originDevice === undefined) {
        originDevice = Device.getDeviceByDeviceId(message.originDeviceId);
    }

    _und.extend(msgInfo.from, originDevice.discloseMainPropsTo(this));

    // Dispatch notification message
    Catenis.notification.dispatchNotifyMessage(this.deviceId, Notification.event.new_msg_received.name, JSON.stringify(msgInfo));
};

Device.prototype.notifyMessageRead = function (message, targetDevice) {
    // Prepare information about read message to be sent by notification
    const msgInfo = {
        messageId: message.messageId,
        to: {
            deviceId: message.targetDeviceId,
        },
        readDate: message.firstReadDate
    };

    // Add device public properties
    if (targetDevice === undefined) {
        targetDevice = Device.getDeviceByDeviceId(message.targetDeviceId);
    }

    _und.extend(msgInfo.from, targetDevice.discloseMainPropsTo(this));

    // Dispatch notification message
    Catenis.notification.dispatchNotifyMessage(this.deviceId, Notification.event.sent_msg_read.name, JSON.stringify(msgInfo));
};
/** End of notification related methods **/

// TODO: add methods to: issue asset (both locked and unlocked), register/import asset issued elsewhere, transfer asset, etc.


// Module functions used to simulate private Device object methods
//  NOTE: these functions need to be bound to a Device object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

// NOTE: make sure that this method is called from code executed from the FundSource.utxoCS
//  critical section object
function fundDeviceAddresses(amountPerDevMainAddress, amountPerAssetIssuanceAddress) {
    Catenis.logger.TRACE('Funding device addresses', {
        deviceId: this.deviceId,
        amountPerDevMainAddress: amountPerDevMainAddress,
        amountPerAssetIssuanceAddress: amountPerAssetIssuanceAddress
    });
    let fundTransact = undefined;

    try {
        // Prepare transaction to fund device main addresses
        fundTransact = new FundTransaction(FundTransaction.fundingEvent.provision_client_device, this.deviceId);

        if (amountPerDevMainAddress !== undefined) {
            fundTransact.addPayees(this.mainAddr, amountPerDevMainAddress);
        }

        if (amountPerAssetIssuanceAddress !== undefined) {
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

        if (fundTransact !== undefined) {
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
        Catenis.logger.WARN('Trying to activate a deleted device', {deviceId: this.deviceId});
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

Device.getDeviceByDeviceId = function (deviceId, includeDeleted = true) {
    // Retrieve Device doc/rec
    const query = {
        deviceId: deviceId
    };

    if (!includeDeleted) {
        query.status = {$ne: Device.status.deleted.name};
    }

    const docDevice = Catenis.db.collection.Device.findOne(query);

    if (docDevice === undefined) {
        // No device available with the given device ID. Log error and throw exception
        Catenis.logger.ERROR('Could not find device with given device ID', {deviceId: deviceId});
        throw new Meteor.Error('ctn_device_not_found', util.format('Could not find device with given device ID (%s)', deviceId));
    }

    return new Device(docDevice, CatenisNode.getCatenisNodeByIndex(docDevice.index.ctnNodeIndex).getClientByIndex(docDevice.index.clientIndex));
};

Device.getDeviceByProductUniqueId = function (prodUniqueId, includeDeleted = true) {
    // Retrieve Device doc/rec
    const query = {
        'props.prodUniqueId': prodUniqueId
    };

    if (!includeDeleted) {
        query.status = {$ne: Device.status.deleted.name};
    }

    const docDevice = Catenis.db.collection.Device.findOne(query);

    if (docDevice === undefined) {
        // No device available with the given product unique ID. Log error and throw exception
        Catenis.logger.ERROR('Could not find device with given product unique ID', {prodUniqueId: prodUniqueId});
        throw new Meteor.Error('ctn_device_not_found', util.format('Could not find device with given product unique ID (%s)', prodUniqueId));
    }

    return new Device(docDevice, CatenisNode.getCatenisNodeByIndex(docDevice.index.ctnNodeIndex).getClientByIndex(docDevice.index.clientIndex));
};

Device.checkDevicesToFund = function () {
    // Retrieve devices the status of which is still 'new'
    Catenis.db.collection.Device.find({status: Device.status.new.name}).forEach(doc => {
        try {
            Catenis.logger.TRACE(util.format('Funding addresses of existing device (deviceId: %s)', doc.deviceId));
            (new Device(doc, CatenisNode.getCatenisNodeByIndex(doc.index.ctnNodeIndex).getClientByIndex(doc.index.clientIndex))).fundAddresses();
        }
        catch (err) {
            // Error trying to fund addresses of device. Log error condition
            Catenis.logger.ERROR(util.format('Error trying to fund addresses of device (deviceId: %s).', doc.deviceId), err);
        }
    });
};

Device.checkDevicesMainAddrFunding = function () {
    // Retrieve devices the status of which is neither 'new' nor 'deleted'
    Catenis.db.collection.Device.find({
        $and: [{
            status: {$ne: Device.status.new.name}
        }, {
            status: {$ne: Device.status.deleted.name}
        }]
    }).forEach(doc => {
        try {
            Catenis.logger.TRACE(util.format('Checking funding of main addresses of existing device (deviceId: %s)', doc.deviceId));
            (new Device(doc, CatenisNode.getCatenisNodeByIndex(doc.index.ctnNodeIndex).getClientByIndex(doc.index.clientIndex))).fixFundAddresses();
        }
        catch (err) {
            // Error trying to fund addresses of device. Log error condition
            Catenis.logger.ERROR(util.format('Error checking/fixing funding of main addresses of device (deviceId: %s).', doc.deviceId), err);
        }
    });
};

// Get Catenis message proof or origin
//
// Arguments:
//  txid: [string] - Internal blockchain ID of Catenis transaction to prove
//  deviceId: [string] - Catenis ID of device that supposedly issued the message (the origin device)
//  textToSign: [string] - A text to be signed
//
Device.getMessageProofOfOrigin = function (txid, deviceId, textToSign) {
    let transact = undefined;

    try {
        transact = Transaction.fromTxid(txid);
    }
    catch (err) {
        if ((err instanceof Meteor.Error) && err.error === 'ctn_btcore_rpc_error' && err.details !== undefined && typeof err.details.code === 'number'
                && (err.details.code === BitcoinCore.rpcErrorCode.RPC_INVALID_PARAMETER || err.details.code === BitcoinCore.rpcErrorCode.RPC_INVALID_ADDRESS_OR_KEY)) {
            // Error indicating that transaction id is not valid.
            //  Throws local error
            throw new Meteor.Error('ctn_msg_poof_invalid_txid', util.format('This is not a valid transaction id: %s', txid));
        }
        else {
            // An error other than invalid transaction id.
            //  Just re-throws it
            throw err;
        }
    }

    // First, check if this is a send message transaction
    const sendMsgTransact = SendMessageTransaction.checkTransaction(transact);
    let result = undefined;

    if (sendMsgTransact !== undefined) {
        // Make sure that designated origin device matches the actual origin device
        if (sendMsgTransact.originDevice.deviceId === deviceId) {
            result = {
                tx: {
                    txid: txid,
                    input1: {
                        address: sendMsgTransact.originDeviceMainAddrKeys.getAddress()
                    }
                },
                Text: {
                    original: textToSign,
                    signed: sendMsgTransact.originDeviceMainAddrKeys.signText(textToSign).toString('base64')
                },
                originDevice: {
                    deviceId: deviceId
                }
            };

            // Add public properties of origin device
            _und.extend(result.originDevice, sendMsgTransact.originDevice.getPublicProps());
        }
        else {
            // Throw exception indicating generic error condition (no Catenis tx ou device mismatch)
            Catenis.logger.DEBUG('Specified device for getting message proof of origin does not match actual message origin device', {txid: txid, deviceId: deviceId, actualOriginDeviceId: sendMsgTransact.originDevice.deviceId});
            throw new Meteor.Error('ctn_msg_proof_invalid_tx_device_mismatch', 'Not a Catenis message transaction or specified device does not match actual message origin device');
        }
    }
    else {
        // If not, then check if this is a log message transaction
        const logMsgTransact = LogMessageTransaction.checkTransaction(transact);

        if (logMsgTransact === undefined) {
            // Throw exception indicating generic error condition (no Catenis tx ou device mismatch)
            Catenis.logger.DEBUG('Specified transaction for getting message proof of origin  is not a valid Catenis message transaction', {txid: txid});
            throw new Meteor.Error('ctn_msg_proof_invalid_tx_device_mismatch', 'Not a Catenis message transaction or specified device does not match actual message origin device');
        }
        // Make sure that designated origin device matches the actual origin device
        else if (logMsgTransact.device.deviceId === deviceId) {
            result = {
                tx: {
                    txid: txid,
                    input1: {
                        address: logMsgTransact.deviceMainAddrKeys.getAddress()
                    }
                },
                Text: {
                    original: textToSign,
                    signed: logMsgTransact.deviceMainAddrKeys.signText(textToSign).toString('base64')
                },
                originDevice: {
                    deviceId: deviceId
                }
            };

            // Add public properties of origin device
            _und.extend(result.originDevice, logMsgTransact.device.getPublicProps());
        }
        else {
            // Throw exception indicating generic error condition (no Catenis tx ou device mismatch)
            Catenis.logger.DEBUG('Specified device for getting message proof of origin does not match actual message origin device', {txid: txid, deviceId: deviceId, actualOriginDeviceId: logMsgTransact.device.deviceId});
            throw new Meteor.Error('ctn_msg_proof_invalid_tx_device_mismatch', 'Not a Catenis message transaction or specified device does not match actual message origin device');
        }
    }

    return result;
};

// Check if a given device exists
//
//  Argument:
//   deviceId [String] - Device ID of device to check existence
//   selfReferenceAccepted [Boolean] - Indicate whether 'self' token should be accepted for device ID
//   wildcardAccepted [Boolean] - Indicate whether wildcard ('*') should be accepted for device ID
//   includeDeleted [Boolean] - Indicate whether deleted devices should also be included in the check
//
//  Result:
//   [Boolean] - Indicates whether the device being checked exists or not
Device.checkExist = function (deviceId, selfReferenceAccepted = false, wildcardAccepted = false, includeDeleted = false) {
    if ((selfReferenceAccepted && deviceId === Permission.entityToken.ownHierarchy) || (wildcardAccepted && deviceId === Permission.entityToken.wildcard)) {
        return true;
    }
    else {
        if (deviceId === undefined) {
            return false;
        }

        const selector = {
            deviceId: deviceId
        };

        if (!includeDeleted) {
            selector.status = {
                $ne: Device.status.deleted.name
            }
        }

        const docDevice = Catenis.db.collection.Device.findOne(selector, {fields: {_id: 1}});

        return docDevice !== undefined;
    }
};

// Check if one or more devices exist
//
//  Argument:
//   deviceIds [Array(String)|String] - List of device IDs (or a single device ID) of devices to check existence
//   selfReferenceAccepted [Boolean] - Indicate whether 'self' token should be accepted for device ID
//   wildcardAccepted [Boolean] - Indicate whether wildcard ('*') should be accepted for device ID
//   includeDeleted [Boolean] - Indicate whether deleted devices should also be included in the check
//
//  Result:
//   result: {
//     doExist: [Boolean] - Indicates whether all devices being checked exist or not
//     nonexistentDeviceIds: [Array(String)] - List of device IDs of devices, from the ones that were being checked, that do not exist
//   }
Device.checkExistMany = function (deviceIds, selfReferenceAccepted = false, wildcardAccepted = false, includeDeleted = false) {
    const result = {};

    if (Array.isArray(deviceIds)) {
        if (deviceIds.length === 0) {
            return {
                doExist: false
            };
        }

        if (selfReferenceAccepted || wildcardAccepted) {
            // Filter out self reference and/or wildcard ID
            deviceIds = deviceIds.filter((deviceId) => (!selfReferenceAccepted || deviceId !== Permission.entityToken.ownHierarchy) && (!wildcardAccepted || deviceId !== Permission.entityToken.wildcard));

            if (deviceIds.length === 0) {
                return {
                    doExist: true
                }
            }
        }

        const selector = {
            deviceId: {
                $in: deviceIds
            }
        };

        if (!includeDeleted) {
            selector.status = {
                $ne: Device.status.deleted.name
            };
        }

        const resultSet = Catenis.db.collection.Device.find(selector, {
            fields: {
                deviceId: 1
            }
        });

        if (resultSet.count() !== deviceIds.length) {
            // Not all IDs returned. Indicated that not exist and identify the ones that do not
            result.doExist = false;
            result.nonexistentDeviceIds = [];
            const existingDeviceIds = new Set(resultSet.fetch().map(doc => doc.deviceId));

            deviceIds.forEach((deviceId) => {
                if (!existingDeviceIds.has(deviceId)) {
                    result.nonexistentDeviceIds.push(deviceId);
                }
            });
        }
        else {
            // Found all indices. Indicate that all exist
            result.doExist = true;
        }
    }
    else {
        // A single device ID had been passed to be checked
        result.doExist = Device.checkExist(deviceIds, selfReferenceAccepted, wildcardAccepted, includeDeleted);

        if (!result.doExist) {
            result.nonexistentDeviceIds = [deviceIds];
        }
    }

    return result;
};


// Make sure that initial permission rights are set for all devices and permission events
Device.checkDeviceInitialRights = function () {
    // Retrieve device ID of all currently defined devices
    const deviceIds = Catenis.db.collection.Device.find({
        status: {$ne: Device.status.deleted.name}
    }, {
        fields: {
            deviceId: 1
        }
    }).map((doc) => doc.deviceId);

    // Identify devices for which initial rights are already set for at least some permission events
    const alreadySetDeviceIdEvents = new Map();

    Catenis.db.collection.Permission.find({
        subjectEntityId: {
            $in: deviceIds
        },
        level: Permission.level.system.name
    }, {
        fields: {
            subjectEntityId: 1,
            event: 1
        }
    }).forEach((doc) => {
        if (!alreadySetDeviceIdEvents.has(doc.subjectEntityId)) {
            alreadySetDeviceIdEvents.set(doc.subjectEntityId, new Set([doc.event]));
        }
        else {
            alreadySetDeviceIdEvents.get(doc.subjectEntityId).add(doc.event);
        }
    });

    // For all existing devices, check if there are any permission event for which
    //  initial rights setting is missing, and fix it
    const numEventsDeviceDefaultRights = Object.keys(clientCfgSettings.deviceDefaultRightsByEvent).length;

    deviceIds.forEach((deviceId) => {
        let alreadySetEvents;

        if (!alreadySetDeviceIdEvents.has(deviceId) || (alreadySetEvents = alreadySetDeviceIdEvents.get(deviceId)).size < numEventsDeviceDefaultRights) {
            // Prepare initial rights containing only the events that are missing...
            const device = Device.getDeviceByDeviceId(deviceId);
            const initialRightsByEvent = _und.omit(device.client.getDeviceDefaultRights(), (rights, event) => alreadySetEvents !== undefined && alreadySetEvents.has(event));

            // And set them
            Catenis.logger.DEBUG('Setting initial permission rights for device', {
                deviceId: deviceId,
                rightsByEvent: initialRightsByEvent
            });
            device.setInitialRights(initialRightsByEvent);
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
        if (device.status === Device.status.pending.name) {
            // Activate device
            activateDevice.call(device, data.txid);
        }
        else {
            // Log unexpected condition
            Catenis.logger.WARN('Unexpected device status processing confirmation of funding of device addresses', {
                deviceId: device.deviceId,
                expectedStatus: Device.status.pending.name,
                currentStatus: device.status
            });
        }
    }
    catch (err) {
        // Just log error condition
        Catenis.logger.ERROR('Error handling event notifying that funding of device addresses has been confirmed.', err);
    }
}


// Module code
//

// Lock function class
Object.freeze(Device);
