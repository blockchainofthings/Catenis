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
const _und = require('underscore');     // NOTE: we dot not use the underscore library provided by Meteor because we need
                                        //        a feature (_und.omit(obj,predicate)) that is not available in that version
// Third-party node modules
import config from 'config';
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

    Object.defineProperty(this, 'apiAccessSecret', {
        get: function () {
            // Use API access secret from client is an API access generator key is not defined
            //  for the device
            //noinspection JSPotentiallyInvalidUsageOfThis
            return this.apiAccessGenKey != null ? crypto.createHmac('sha512', this.apiAccessGenKey).update('And here it is: the Catenis API key for device' + this.clientId).digest('hex')
                    : this.client.apiAccessSecret;
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

Device.prototype.renewApiAccessGenKey = function (useClientDefaultKey = false) {
    // Make sure that device is not deleted
    if (this.status !== Device.status.deleted.name &&
        Catenis.db.collection.Device.findOne({_id: this.doc_id, status: Device.status.deleted.name}, {fields:{_id:1}}) != undefined) {
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
        Catenis.db.collection.Device.update({_id: this.doc_id}, {$set: {apiAccessGenKey: key, lastApiAccessGenKeyModifiedDate: new Date(Date.now())}});
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
        const devMainAddrBalance = devMainAddresses.length > 0 ? (new FundSource(devMainAddresses, {})).getBalance() : undefined;

        if (devMainAddrBalance != undefined && devMainAddrBalance > 0 && devMainAddrBalance != devMainAddrDistribFund.totalAmount) {
            // Amount funded to device main addresses different than expected.
            //  Log inconsistent condition
            Catenis.logger.WARN(util.format('Amount funded to device (Id: %s) main addresses different than expected. Current amount: %s, expected amount: %s', this.deviceId, Util.formatCoins(devMainAddrBalance), Util.formatCoins(devMainAddrDistribFund.totalAmount)));

            // Indicate that addresses should not be funded
            devMainAddrDistribFund.amountPerAddress = undefined;
        }

        // If device asset issuance addresses already exist, check if their
        //  balance is as expected
        const assetIssuanceAddrBalance = assetIssuanceAddresses.length > 0 ? (new FundSource(assetIssuanceAddresses, {})).getBalance() : undefined;

        if (assetIssuanceAddrBalance != undefined && assetIssuanceAddrBalance > 0 && assetIssuanceAddrBalance != assetIssuanceAddrDistribFund.totalAmount) {
            // Amount funded to device asset issuance addresses different than expected.
            //  Log inconsistent condition
            Catenis.logger.WARN(util.format('Amount funded to device (Id: %s) asseet issuance addresses different than expected. Current amount: %s, expected amount: %s', this.deviceId, Util.formatCoins(assetIssuanceAddrBalance), Util.formatCoins(assetIssuanceAddrDistribFund.totalAmount)));

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
//    storageScheme: [String], // (optional, default: 'auto') A field of the CatenisMessage.storageScheme property identifying how the message should be stored
//      storageProvider: [Object] // (optional, default: defaultStorageProvider) A field of the CatenisMessage.storageProvider property
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
    FundSource.utxoCS.execute(() => {
        let sendMsgTransact = undefined;

        try {
            // Prepare transaction to send message to a device
            sendMsgTransact = new SendMessageTransaction(this, targetDevice, message, {
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
//    storageScheme: [String], // (optional, default: 'auto') A field of the CatenisMessage.storageScheme property identifying how the message should be stored
//      storageProvider: [Object] // (optional, default: defaultStorageProvider) A field of the CatenisMessage.storageProvider property
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
    FundSource.utxoCS.execute(() => {
        let logMsgTransact = undefined;

        try {
            // Prepare transaction to log message
            logMsgTransact = new LogMessageTransaction(this, message, {
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
        transact = Transaction.fromTxid(txid);
    }
    catch (err) {
        if ((err instanceof Meteor.Error) && err.details != undefined && typeof err.details.code === 'number'
            && err.details.code == BitcoinCore.rpcErrorCode.RPC_INVALID_ADDRESS_OR_KEY) {
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
    const sendMsgTransact = SendMessageTransaction.checkTransaction(transact);

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
        const logMsgTransact = LogMessageTransaction.checkTransaction(transact);

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
        fundTransact = new FundTransaction(FundTransaction.fundingEvent.provision_client_device, this.deviceId);

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

Device.getDeviceByDeviceId = function (deviceId, includeDeleted = true) {
    // Retrieve Device doc/rec
    const query = {
        deviceId: deviceId
    };

    if (!includeDeleted) {
        query.status = {$ne: Device.status.deleted.name};
    }

    const docDevice = Catenis.db.collection.Device.findOne(query);

    if (docDevice == undefined) {
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

    if (docDevice == undefined) {
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
        if ((err instanceof Meteor.Error) && err.details != undefined && typeof err.details.code === 'number'
            && err.details.code == BitcoinCore.rpcErrorCode.RPC_INVALID_ADDRESS_OR_KEY) {
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

    if (sendMsgTransact != undefined) {
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

            if (sendMsgTransact.originDevice.props.public) {
                if (sendMsgTransact.originDevice.props.name != undefined) {
                    result.originDevice.name = sendMsgTransact.originDevice.props.name;
                }

                if (sendMsgTransact.originDevice.props.prodUniqueId != undefined) {
                    result.originDevice.prodUniqueId = sendMsgTransact.originDevice.props.prodUniqueId;
                }
            }
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

        if (logMsgTransact == undefined) {
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

            if (logMsgTransact.device.props.public) {
                if (logMsgTransact.device.props.name != undefined) {
                    result.originDevice.name = logMsgTransact.device.props.name;
                }

                if (logMsgTransact.device.props.prodUniqueId != undefined) {
                    result.originDevice.prodUniqueId = logMsgTransact.device.props.prodUniqueId;
                }
            }
        }
        else {
            // Throw exception indicating generic error condition (no Catenis tx ou device mismatch)
            Catenis.logger.DEBUG('Specified device for getting message proof of origin does not match actual message origin device', {txid: txid, deviceId: deviceId, actualOriginDeviceId: logMsgTransact.device.deviceId});
            throw new Meteor.Error('ctn_msg_proof_invalid_tx_device_mismatch', 'Not a Catenis message transaction or specified device does not match actual message origin device');
        }
    }

    return result;
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

// Lock function class
Object.freeze(Device);
