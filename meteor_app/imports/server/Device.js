/**
 * Created by Claudio on 2016-06-23.
 */

//console.log('[Device.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import util from 'util';
import crypto from 'crypto';
// Third-party node modules
import _und from 'underscore';      // NOTE: we dot not use the underscore library provided by Meteor because we need
                                    //        a feature (_und.omit(obj,predicate)) that is not available in that version
import BigNumber from 'bignumber.js';
import Future from 'fibers/future';
// Meteor packages
import { Meteor } from 'meteor/meteor';
// noinspection NpmUsedModulesInstalled
import { Random } from 'meteor/random';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { DeviceShared } from '../both/DeviceShared';
import { CriticalSection } from './CriticalSection';
import { TransactionMonitor } from './TransactionMonitor';
import { BitcoinCore } from './BitcoinCore';
import {
    DeviceMainAddress,
    DeviceReadConfirmAddress,
    DeviceAssetAddress,
    DeviceAssetIssuanceAddress
} from './BlockchainAddress';
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
import {
    cfgSettings as clientCfgSettings,
    Client
} from './Client';
import { Notification } from './Notification';
import { CCFundSource } from './CCFundSource';
import { Billing } from './Billing';
import {
    cfgSettings as assetCfgSetting,
    Asset
} from './Asset';
import { CCTransaction } from './CCTransaction';
import { IssueAssetTransaction } from './IssueAssetTransaction';
import { TransferAssetTransaction } from './TransferAssetTransaction';
import { KeyStore } from './KeyStore';
import { MessageChunk } from './MessageChunk';
import { ProvisionalMessage } from './ProvisionalMessage';
import { BufferMessageReadable } from './BufferMessageReadable';
import { CachedMessageDuplex } from './CachedMessageDuplex';
import {
    cfgSettings as messageCfgSettings
} from './Message';
import { CachedMessage } from './CachedMessage';
import { procCS as spendServCredProcCS } from './SpendServiceCredit';


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
    //  NOTE: arrow functions should NOT be used for the getter/setter of the defined properties.
    //      This is to avoid that, if `this` is referred from within the getter/setter body, it
    //      refers to the object from where the properties have been defined rather than to the
    //      object from where the property is being accessed. Normally, this does not represent
    //      an issue (since the object from where the property is accessed is the same object
    //      from where the property has been defined), but it is especially dangerous if the
    //      object can be cloned.
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
    this.mainAddr = new DeviceMainAddress(this.client.ctnNode.ctnNodeIndex, this.client.clientIndex, this.deviceIndex);
    this.readConfirmAddr = new DeviceReadConfirmAddress(this.client.ctnNode.ctnNodeIndex, this.client.clientIndex, this.deviceIndex);
    this.assetAddr = new DeviceAssetAddress(this.client.ctnNode.ctnNodeIndex, this.client.clientIndex, this.deviceIndex);
    this.assetIssuanceAddr = new DeviceAssetIssuanceAddress(this.client.ctnNode.ctnNodeIndex, this.client.clientIndex, this.deviceIndex);

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
        Catenis.logger.ERROR('Cannot enable a device that is not inactive', {deviceId: this.deviceId});
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
            // TODO: free up coins previously allocated to this device to fund its addresses
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
        const devMainAddrBalance = devMainAddresses.length > 0 ? new FundSource(devMainAddresses, {useUnconfirmedUtxo: true}).getBalance(true) : undefined;

        if (devMainAddrBalance !== undefined && devMainAddrBalance > 0 && devMainAddrBalance !== devMainAddrDistribFund.totalAmount) {
            // Amount funded to device main addresses different than expected.
            //  Log inconsistent condition
            Catenis.logger.WARN(util.format('Amount funded to device (Id: %s) main addresses different than expected. Current amount: %s, expected amount: %s', this.deviceId, Util.formatCoins(devMainAddrBalance), Util.formatCoins(devMainAddrDistribFund.totalAmount)));

            // Indicate that main addresses should not be funded
            devMainAddrDistribFund.amountPerAddress = undefined;
        }

        // If device asset issuance addresses already exist, check if their
        //  balance is as expected
        const assetIssuanceAddrBalance = assetIssuanceAddresses.length > 0 ? new FundSource(assetIssuanceAddresses, {useUnconfirmedUtxo: true}).getBalance(true) : undefined;

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
            // Make sure that device can be activated
            if (newDevStatus === Device.status.active.name && this.client.maximumAllowedDevices && this.client.activeInactiveDevicesCount() >= this.client.maximumAllowedDevices) {
                // Number of active/inactive devices of client already reached the maximum allowed.
                //  Silently reset status to 'inactive'
                newDevStatus = Device.status.inactive.name;
            }

            updateStatus.call(this, newDevStatus);

            this.status = newDevStatus;
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
        const devMainAddrBalance = devMainAddresses.length > 0 ? new FundSource(devMainAddresses, {useUnconfirmedUtxo: true}).getBalance(true) : undefined;

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
            }
            else {
                // Expected funding amount lower than currently funded amount.
                //  Just log inconsistent condition
                Catenis.logger.WARN('Funding of device main addresses higher than expected', {
                    deviceId: this.deviceId,
                    expectedFundingAmount: Util.formatCoins(devMainAddrDistribFund.totalAmount),
                    currentFundingAmount: Util.formatCoins(devMainAddrBalance)
                });

                // Indicates that no additional funding is necessary
                devMainAddrDistribFund.amountPerAddress = undefined;
            }
        }
        else {
            // Amount funded to device main addresses seems to be OK.
            //  Indicates that no additional funding is necessary
            devMainAddrDistribFund.amountPerAddress = undefined;
        }

        // First, check if funding of device asset issuance addresses allocated to unlocked assets are OK
        const devUnlockedAssetIssueAddrs = getUnlockedAssetIssuanceAddresses.call(this);
        let devUnlockedAssetIssueAddrAmount = {};

        if (devUnlockedAssetIssueAddrs.length > 0) {
            const addressBalance = new FundSource(devUnlockedAssetIssueAddrs, {useUnconfirmedUtxo: true}).getBalancePerAddress(true);

            const expectAddrBalance = Service.deviceAssetProvisionCost;

            devUnlockedAssetIssueAddrs.forEach((unlockedAssetIssueAddr) => {
                let balance = addressBalance[unlockedAssetIssueAddr];

                if (balance === undefined) {
                    balance = 0;
                }

                if (expectAddrBalance !== balance) {
                    if (expectAddrBalance > balance) {
                        // Expected funding amount is higher than currently funded amount.
                        //  Allocate amount difference to fix funding of device asset issuance address allocated to unlocked asset
                        Catenis.logger.WARN('Funding of device asset issuance address allocated to unlocked asset lower than expected; preparing to fix it', {
                            deviceId: this.deviceId,
                            unlockedAssetIssueAddr: unlockedAssetIssueAddr,
                            expectAddrBalance: expectAddrBalance,
                            balance: balance,
                            expectedFundingAmount: Util.formatCoins(expectAddrBalance),
                            currentFundingAmount: Util.formatCoins(balance)
                        });
                        devUnlockedAssetIssueAddrAmount[unlockedAssetIssueAddr] = expectAddrBalance - balance;
                        Catenis.logger.DEBUG('>>>>>> devUnlockedAssetIssueAddrAmount:', devUnlockedAssetIssueAddrAmount);
                    }
                    else {
                        // Expected funding amount lower than currently funded amount.
                        //  Just log inconsistent condition
                        Catenis.logger.WARN('Funding of device asset issuance address allocated to unlocked asset higher than expected', {
                            deviceId: this.deviceId,
                            unlockedAssetIssueAddr: unlockedAssetIssueAddr,
                            expectedFundingAmount: Util.formatCoins(expectAddrBalance),
                            currentFundingAmount: Util.formatCoins(balance)
                        });
                    }
                }
            });
        }

        if (Object.keys(devUnlockedAssetIssueAddrAmount).length === 0) {
            devUnlockedAssetIssueAddrAmount = undefined;
        }

        // Check if device asset issuance addresses are already funded
        const devAssetIssueAddrs = this.getAssetIssuanceAddressesInUseExcludeUnlocked(),
            devAssetIssueAddrDistribFund = Service.distributeDeviceAssetIssuanceAddressFund();

        // If device asset issuance addresses already exist, check if their balance is as expected
        const devAssetIssueAddrBalance = devAssetIssueAddrs.length > 0 ? new FundSource(devAssetIssueAddrs, {useUnconfirmedUtxo: true}).getBalance(true) : undefined;

        if (devAssetIssueAddrBalance !== undefined && devAssetIssueAddrBalance > 0 && devAssetIssueAddrBalance !== devAssetIssueAddrDistribFund.totalAmount) {
            // Amount funded to device asset issuance addresses different than expected
            if (devAssetIssueAddrDistribFund.totalAmount > devAssetIssueAddrBalance) {
                // Expected funding amount is higher than currently funded amount.
                //  Allocate amount difference to fix funding of device asset issuance addresses
                Catenis.logger.WARN('Funding of device asset issuance addresses lower than expected; preparing to fix it', {
                    deviceId: this.deviceId,
                    expectedFundingAmount: Util.formatCoins(devAssetIssueAddrDistribFund.totalAmount),
                    currentFundingAmount: Util.formatCoins(devAssetIssueAddrBalance)
                });
                devAssetIssueAddrDistribFund.totalAmount = devAssetIssueAddrDistribFund.totalAmount - devAssetIssueAddrBalance;
                devAssetIssueAddrDistribFund.amountPerAddress = Service.distributeDeviceAssetIssuanceAddressDeltaFund(devAssetIssueAddrDistribFund.totalAmount);
            }
            else {
                // Expected funding amount lower than currently funded amount.
                //  Just log inconsistent condition
                Catenis.logger.WARN('Funding of device asset issuance addresses higher than expected', {
                    deviceId: this.deviceId,
                    expectedFundingAmount: Util.formatCoins(devAssetIssueAddrDistribFund.totalAmount),
                    currentFundingAmount: Util.formatCoins(devAssetIssueAddrBalance)
                });

                // Indicates that no additional funding is necessary
                devAssetIssueAddrDistribFund.amountPerAddress = undefined;
            }
        }
        else {
            // Amount funded to device asset issuance addresses seems to be OK.
            //  Indicates that no additional funding is necessary
            devAssetIssueAddrDistribFund.amountPerAddress = undefined;
        }

        if (devMainAddrDistribFund.amountPerAddress !== undefined || devAssetIssueAddrDistribFund.amountPerAddress !== undefined || devUnlockedAssetIssueAddrAmount !== undefined) {
            // Fix funding of device main addresses
            fundDeviceAddresses.call(this, devMainAddrDistribFund.amountPerAddress, devAssetIssueAddrDistribFund.amountPerAddress, devUnlockedAssetIssueAddrAmount);

            // Make sure that system is properly funded
            Catenis.ctnHubNode.checkFundingBalance();
        }
    });
};

// Send message to another device
//
//  Arguments:
//    targetDeviceId: [String]   - Device ID identifying the device to which the message should be sent
//    message: [Object(Buffer)]  - Object of type Buffer containing the message to be sent
//    readConfirmation: [Boolean] - (optional, default: false) Indicates whether message should be sent with read confirmation enabled
//    encryptMessage: [Boolean]   - (optional, default: true) Indicates whether message should be encrypted before sending it
//    storageScheme: [String]     - (optional, default: 'auto') A field of the CatenisMessage.storageScheme property identifying how the message should be stored
//    storageProvider: [Object]   - (optional, default: defaultStorageProvider) A field of the CatenisMessage.storageProvider property
//                                   identifying the type of external storage to be used to store the message that should not be embedded
//
//  Return value:
//    messageId: [String]       - ID of sent message
Device.prototype.sendMessage = function (targetDeviceId, message, readConfirmation = false, encryptMessage = true, storageScheme = 'auto', storageProvider) {
    return this.sendMessage2(message, targetDeviceId, encryptMessage, storageScheme, readConfirmation, storageProvider).messageId;
};

// Send message to another device
//
//  Arguments:
//    message [Buffer(Buffer)|Object] {  - The message to be sent. If a Buffer object is passed, it is assumed to be the whole message's contents.
//                                          Otherwise, it is expected that the message be passed in chunks using the following object to control it:
//      dataChunk: [Object(Buffer)], - (optional) The current message data chunk. The actual message's contents should be comprised of one or more data chunks
//      isFinal: [Boolean],         - Indicates whether this is the final (or the single) message data chunk
//      continuationToken: [String] - (optional) Indicates that this is a continuation message data chunk. This should be filled with the value
//                                     returned in the 'continuationToken' field of the response from the previously sent message data chunk
//    }
//    targetDeviceId: [String]   - (optional) Device ID identifying the device to which the message should be sent
//    encryptMessage: [Boolean]   - (optional, default: true) Indicates whether message should be encrypted before sending it
//    storageScheme: [String]     - (optional, default: 'auto') A field of the CatenisMessage.storageScheme property identifying how the message should be stored
//    readConfirmation: [Boolean] - (optional, default: false) Indicates whether message should be sent with read confirmation enabled
//    storageProvider: [Object]   - (optional, default: defaultStorageProvider) A field of the CatenisMessage.storageProvider property
//                                   identifying the type of external storage to be used to store the message that should not be embedded
//    async [Boolean] - (optional, default: false) Indicates whether processing should be done asynchronously. If set to true, a provisional
//                       message ID is returned, which should be used to retrieve the processing outcome by calling the MessageProgress API method
//
//  Return value: {
//    sendResult: {
//      continuationToken: [String] - (optional) Token to be used when sending the following message data chunk. Returned if message passed in chunks
//                                     and last message data chunk was not final
//      messageId: [String]  - (optional) ID of sent message. Returned after the whole message's contents is sent if not doing asynchronous processing
//      provisionalMessageId: [String]  - (optional) Provisional message ID. Returned after the whole message's contents is sent if doing asynchronous processing
//    }
Device.prototype.sendMessage2 = function (message, targetDeviceId, encryptMessage = true, storageScheme = 'auto', readConfirmation = false, storageProvider, async = false) {
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

    let targetDevice = undefined;

    if (targetDeviceId) {
        try {
            // noinspection JSValidateTypes
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
    }

    if (Buffer.isBuffer(message)) {
        // The whole message passed at once (not in chunks)
        if (async) {
            // Asynchronous processing requested. So treat as if message was passed in chunks (with a single chunk)
            message = {
                dataChunk: message,
                isFinal: true
            }
        }
    }
    else {
        // Message passed in chunks
        if (message.isFinal && !message.continuationToken && !async) {
            // This is the only message data chunk, and no asynchronous processing requested.
            //  So treat it as if it was passed not in chunks
            message = message.dataChunk;
        }
    }

    let messageReadable;
    let provisionalMessageId;

    if (!Buffer.isBuffer(message)) {
        // Message passed in chunks

        if (message.dataChunk) {
            // Check whether client can pay for service ahead of time to avoid that client wastes resources
            //  sending a large message to only later find out that it cannot pay for it.
            //  Note, however, that a definitive check shall still be done once the actual processing to log
            //  the message is executed

            // Execute code in critical section to avoid Colored Coins UTXOs concurrency
            CCFundSource.utxoCS.execute(() => {
                const servicePriceInfo = Service.sendMessageServicePrice();

                if (this.client.billingMode === Client.billingMode.prePaid) {
                    // Make sure that client has enough service credits to pay for service
                    const serviceAccountBalance = this.client.serviceAccountBalance();

                    if (serviceAccountBalance < servicePriceInfo.finalServicePrice) {
                        // Client does not have enough credits to pay for service.
                        //  Log error condition and throw exception
                        Catenis.logger.ERROR('Client does not have enough credits to pay for send message service', {
                            serviceAccountBalance: serviceAccountBalance,
                            servicePrice: servicePriceInfo.finalServicePrice
                        });
                        throw new Meteor.Error('ctn_device_low_service_acc_balance', 'Client does not have enough credits to pay for send message service');
                    }
                }
            });

            // Gather message chunks before processing it
            let continuationToken;

            // Execute code in critical section to avoid database concurrency
            MessageChunk.dbCS.execute(() => {
                const provisionalMessage = ProvisionalMessage.recordNewMessageChunk(this.deviceId, Message.action.send, message.continuationToken, message.dataChunk, message.isFinal);

                if (!provisionalMessage.isMessageComplete()) {
                    // Message not yet complete. Prepare to return continuation token
                    continuationToken = provisionalMessage.getContinuationToken()
                }
                else {
                    // The whole message has been received. Get stream to read message's contents
                    //  from provisional message, and provisional message reference (ID)
                    messageReadable = provisionalMessage.getReadableStream();
                    provisionalMessageId = provisionalMessage.provisionalMessageId;

                    // Initialize progress info
                    ProvisionalMessage.updateProcessingProgress(provisionalMessageId, 0);
                }
            });

            if (continuationToken) {
                // Returns continuation token
                return {
                    continuationToken: continuationToken
                }
            }
        }
        else {
            // No data chunk received. Assumes that this is an indication that last data chunk was the final one

            // Execute code in critical section to avoid database concurrency
            MessageChunk.dbCS.execute(() => {
                const provisionalMessage = ProvisionalMessage.getProvisionalMessageByMessageChunkId(message.continuationToken);

                // Finalize message and prepare to continue processing
                provisionalMessage.finalizeMessage(message.continuationToken);

                // Get stream to read message's contents from provisional message, and provisional message reference (ID)
                messageReadable = provisionalMessage.getReadableStream();
                provisionalMessageId = provisionalMessage.provisionalMessageId;

                // Initialize progress info
                ProvisionalMessage.updateProcessingProgress(provisionalMessageId, 0);
            });
        }
    }
    else {
        // The whole message passed at once (not in chunks).
        //  Create stream to read message's contents from buffer
        messageReadable = new BufferMessageReadable(message);
    }

    let messageId = undefined;

    const doProcessing = () => {
        // Execute code in critical section to avoid Colored Coins UTXOs concurrency
        CCFundSource.utxoCS.execute(() => {
            // Execute code in critical section to avoid UTXOs concurrency
            FundSource.utxoCS.execute(() => {
                // Execute code in critical section to avoid concurrent spend service credit tasks
                spendServCredProcCS.execute(() => {
                    const servicePriceInfo = Service.sendMessageServicePrice();
                    let paymentProvisionInfo;

                    if (this.client.billingMode === Client.billingMode.prePaid) {
                        try {
                            paymentProvisionInfo = Catenis.spendServCredit.provisionPaymentForService(this.client, servicePriceInfo.finalServicePrice);
                        }
                        catch (err) {
                            if ((err instanceof Meteor.Error) && err.error === 'ctn_spend_serv_cred_utxo_alloc_error') {
                                // Unable to allocate service credits from client service account to pay for service.
                                //  Log error and throw exception
                                Catenis.logger.ERROR('Client does not have enough credits to pay for send message service', {
                                    serviceAccountBalance: this.client.serviceAccountBalance(),
                                    servicePrice: servicePriceInfo.finalServicePrice
                                });
                                throw new Meteor.Error('ctn_device_low_service_acc_balance', 'Client does not have enough credits to pay for send message service');
                            }
                            else {
                                // Error provisioning spend service credit transaction to pay for service.
                                //  Log error and throw exception
                                Catenis.logger.ERROR('Error provisioning spend service credit transaction to pay for send message service.', err);
                                throw new Error('Error provisioning spend service credit transaction to pay for send message service');
                            }
                        }
                    }
                    else if (this.client.billingMode === Client.billingMode.postPaid) {
                        // Not yet implemented
                        Catenis.logger.ERROR('Processing for postpaid billing mode not yet implemented');
                        throw new Error('Processing for postpaid billing mode not yet implemented');
                    }

                    let sendMsgTransact;

                    try {
                        // Prepare transaction to send message to a device
                        sendMsgTransact = new SendMessageTransaction(this, targetDevice, messageReadable, {
                            readConfirmation: readConfirmation,
                            encrypted: encryptMessage,
                            storageScheme: storageScheme,
                            storageProvider: storageProvider
                        });

                        // Build and send transaction
                        sendMsgTransact.buildTransaction();

                        sendMsgTransact.sendTransaction();

                        // Force polling of blockchain so newly sent transaction is received and processed right away
                        Catenis.txMonitor.pollNow();

                        // Create message and save it to local database
                        messageId = Message.createLocalMessage(sendMsgTransact);
                    }
                    catch (err) {
                        // Error sending message to another device.
                        //  Log error condition
                        Catenis.logger.ERROR('Error sending message to another device.', err);

                        if (sendMsgTransact && !sendMsgTransact.txid) {
                            // Revert output addresses added to transaction
                            sendMsgTransact.revertOutputAddresses();
                        }

                        // Rethrows exception
                        throw err;
                    }

                    try {
                        // Record billing info for service
                        const billing = Billing.createNew(this, sendMsgTransact, servicePriceInfo);

                        let servicePayTransact;

                        if (this.client.billingMode === Client.billingMode.prePaid) {
                            servicePayTransact = Catenis.spendServCredit.confirmPaymentForService(paymentProvisionInfo, sendMsgTransact.txid);
                        }
                        else if (this.client.billingMode === Client.billingMode.postPaid) {
                            // Not yet implemented
                            Catenis.logger.ERROR('Processing for postpaid billing mode not yet implemented');
                            // noinspection ExceptionCaughtLocallyJS
                            throw new Error('Processing for postpaid billing mode not yet implemented');
                        }

                        billing.setServicePaymentTransaction(servicePayTransact);
                    }
                    catch (err) {
                        if ((err instanceof Meteor.Error) && err.error === 'ctn_spend_serv_cred_tx_rejected') {
                            // Spend service credit transaction has been rejected.
                            //  Log warning condition
                            Catenis.logger.WARN('Billing for send message service (serviceTxid: %s) recorded with no service payment transaction', sendMsgTransact.txid);
                        }
                        else {
                            // Error recording billing info for send message service.
                            //  Just log error condition
                            Catenis.logger.ERROR('Error recording billing info for send message service (serviceTxid: %s),', sendMsgTransact.txid, err);
                        }
                    }
                });
            });
        });
    };

    if (async) {
        // Execute processing asynchronously
        Future.task(doProcessing).resolve((err) => {
            ProvisionalMessage.finalizeProcessing(provisionalMessageId, Message.action.send, err, messageId);

            try {
                // Send notification advising that progress of asynchronous message processing has come to an end
                // noinspection JSUnusedAssignment
                this.notifyFinalMessageProgress(provisionalMessageId, ProvisionalMessage.getProvisionalMessageByMessageId(provisionalMessageId).getMessageProgress());
            }
            catch (err) {
                // Error sending notification message. Log error
                Catenis.logger.ERROR('Error sending final message progress notification event for device (doc_id: %s)', this.doc_id, err);
            }
        });

        // Returns provisional message ID, so processing progress can be monitored
        // noinspection JSUnusedAssignment
        return {
            provisionalMessageId: provisionalMessageId
        };
    }
    else {
        // Execute processing immediately (synchronously)
        if (provisionalMessageId) {
            // Make sure to register processing outcome in provisional message
            let error;

            try {
                doProcessing();
            }
            catch (err) {
                error = err;
            }

            if (provisionalMessageId) {
                ProvisionalMessage.finalizeProcessing(provisionalMessageId, Message.action.send, error, messageId);
            }

            if (error) {
                // Just re-throws error
                throw error;
            }
        }
        else {
            doProcessing();
        }

        // Returns resulting message Id
        return {
            messageId: messageId
        };
    }
};


// Log message on the blockchain
//
//  Arguments:
//    message [Object(Buffer)] - Object of type Buffer containing the message to be logged
//    encryptMessage [Boolean] - (optional, default: true) Indicates whether message should be encrypted before logging it
//    storageScheme [String]   - (optional, default: 'auto') A field of the CatenisMessage.storageScheme property identifying how the message should be stored
//    storageProvider [Object] - (optional, default: defaultStorageProvider) A field of the CatenisMessage.storageProvider property
//                                identifying the type of external storage to be used to store the message that should not be embedded
//
//  Return value:
//    messageId: [String]       // ID of logged message
Device.prototype.logMessage = function (message, encryptMessage = true, storageScheme = 'auto', storageProvider) {
    return this.logMessage2(message, encryptMessage, storageScheme, storageProvider).messageId;
};

// Log message on the blockchain
//
//  Arguments:
//    message [Buffer(Buffer)|Object] {  - The message to be logged. If a Buffer object is passed, it is assumed to be the whole message's contents.
//                                          Otherwise, it is expected that the message be passed in chunks using the following object to control it:
//      dataChunk: [Object(Buffer)], - (optional) The current message data chunk. The actual message's contents should be comprised of one or more data chunks
//      isFinal: [Boolean],         - Indicates whether this is the final (or the single) message data chunk
//      continuationToken: [String] - (optional) Indicates that this is a continuation message data chunk. This should be filled with the value
//                                     returned in the 'continuationToken' field of the response from the previously sent message data chunk
//    }
//    encryptMessage [Boolean] - (optional, default: true) Indicates whether message should be encrypted before logging it
//    storageScheme [String]   - (optional, default: 'auto') A field of the CatenisMessage.storageScheme property identifying how the message should be stored
//    storageProvider [Object] - (optional, default: defaultStorageProvider) A field of the CatenisMessage.storageProvider property
//                                identifying the type of external storage to be used to store the message that should not be embedded
//    async [Boolean] - (optional, default: false) Indicates whether processing should be done asynchronously. If set to true, a provisional
//                       message ID is returned, which should be used to retrieve the processing outcome by calling the MessageProgress API method
//
//  Return value:
//    logResult: {
//      continuationToken: [String] - (optional) Token to be used when sending the following message data chunk. Returned if message passed in chunks
//                                     and last message data chunk was not final
//      messageId: [String]  - (optional) ID of logged message. Returned after the whole message's contents is sent if not doing asynchronous processing
//      provisionalMessageId: [String]  - (optional) Provisional message ID. Returned after the whole message's contents is sent if doing asynchronous processing
//    }
Device.prototype.logMessage2 = function (message, encryptMessage = true, storageScheme = 'auto', storageProvider, async = false) {
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

    if (Buffer.isBuffer(message)) {
        // The whole message passed at once (not in chunks)
        if (async) {
            // Asynchronous processing requested. So treat as if message was passed in chunks (with a single chunk)
            message = {
                dataChunk: message,
                isFinal: true
            }
        }
    }
    else {
        // Message passed in chunks
        if (message.isFinal && !message.continuationToken && !async) {
            // This is the only message data chunk, and no asynchronous processing requested.
            //  So treat it as if it was passed not in chunks
            message = message.dataChunk;
        }
    }

    let messageReadable;
    let provisionalMessageId;

    if (!Buffer.isBuffer(message)) {
        // Message passed in chunks

        if (message.dataChunk) {
            // Check whether client can pay for service ahead of time to avoid that client wastes resources
            //  sending a large message to only later find out that it cannot pay for it.
            //  Note, however, that a definitive check shall still be done once the actual processing to log
            //  the message is executed

            // Execute code in critical section to avoid Colored Coins UTXOs concurrency
            CCFundSource.utxoCS.execute(() => {
                const servicePriceInfo = Service.logMessageServicePrice();

                if (this.client.billingMode === Client.billingMode.prePaid) {
                    // Make sure that client has enough service credits to pay for service
                    const serviceAccountBalance = this.client.serviceAccountBalance();

                    if (serviceAccountBalance < servicePriceInfo.finalServicePrice) {
                        // Client does not have enough credits to pay for service.
                        //  Log error condition and throw exception
                        Catenis.logger.ERROR('Client does not have enough credits to pay for log message service', {
                            serviceAccountBalance: serviceAccountBalance,
                            servicePrice: servicePriceInfo.finalServicePrice
                        });
                        throw new Meteor.Error('ctn_device_low_service_acc_balance', 'Client does not have enough credits to pay for log message service');
                    }
                }
            });

            // Gather message chunks before processing it
            let continuationToken;

            // Execute code in critical section to avoid database concurrency
            MessageChunk.dbCS.execute(() => {
                const provisionalMessage = ProvisionalMessage.recordNewMessageChunk(this.deviceId, Message.action.log, message.continuationToken, message.dataChunk, message.isFinal);

                if (!provisionalMessage.isMessageComplete()) {
                    // Message not yet complete. Prepare to return continuation token
                    continuationToken = provisionalMessage.getContinuationToken()
                }
                else {
                    // The whole message has been received. Get stream to read message's contents
                    //  from provisional message, and provisional message reference (ID)
                    messageReadable = provisionalMessage.getReadableStream();
                    provisionalMessageId = provisionalMessage.provisionalMessageId;

                    // Initialize progress info
                    ProvisionalMessage.updateProcessingProgress(provisionalMessageId, 0);
                }
            });

            if (continuationToken) {
                // Returns continuation token
                return {
                    continuationToken: continuationToken
                }
            }
        }
        else {
            // No data chunk received. Assumes that this is an indication that last data chunk was the final one

            // Execute code in critical section to avoid database concurrency
            MessageChunk.dbCS.execute(() => {
                const provisionalMessage = ProvisionalMessage.getProvisionalMessageByMessageChunkId(message.continuationToken);

                // Finalize message and prepare to continue processing
                provisionalMessage.finalizeMessage(message.continuationToken);

                // Get stream to read message's contents from provisional message, and provisional message reference (ID)
                messageReadable = provisionalMessage.getReadableStream();
                provisionalMessageId = provisionalMessage.provisionalMessageId;

                // Initialize progress info
                ProvisionalMessage.updateProcessingProgress(provisionalMessageId, 0);
            });
        }
    }
    else {
        // The whole message passed at once (not in chunks).
        //  Create stream to read message's contents from buffer
        messageReadable = new BufferMessageReadable(message);
    }

    let messageId = undefined;

    const doProcessing = () => {
        // Execute code in critical section to avoid Colored Coins UTXOs concurrency
        CCFundSource.utxoCS.execute(() => {
            // Execute code in critical section to avoid UTXOs concurrency
            FundSource.utxoCS.execute(() => {
                // Execute code in critical section to avoid concurrent spend service credit tasks
                spendServCredProcCS.execute(() => {
                    const servicePriceInfo = Service.logMessageServicePrice();
                    let paymentProvisionInfo;

                    if (this.client.billingMode === Client.billingMode.prePaid) {
                        try {
                            paymentProvisionInfo = Catenis.spendServCredit.provisionPaymentForService(this.client, servicePriceInfo.finalServicePrice);
                        }
                        catch (err) {
                            if ((err instanceof Meteor.Error) && err.error === 'ctn_spend_serv_cred_utxo_alloc_error') {
                                // Unable to allocate service credits from client service account to pay for service.
                                //  Log error and throw exception
                                Catenis.logger.ERROR('Client does not have enough credits to pay for log message service', {
                                    serviceAccountBalance: this.client.serviceAccountBalance(),
                                    servicePrice: servicePriceInfo.finalServicePrice
                                });
                                throw new Meteor.Error('ctn_device_low_service_acc_balance', 'Client does not have enough credits to pay for log message service');
                            }
                            else {
                                // Error provisioning spend service credit transaction to pay for service.
                                //  Log error and throw exception
                                Catenis.logger.ERROR('Error provisioning spend service credit transaction to pay for log message service.', err);
                                throw new Error('Error provisioning spend service credit transaction to pay for log message service');
                            }
                        }
                    }
                    else if (this.client.billingMode === Client.billingMode.postPaid) {
                        // Not yet implemented
                        Catenis.logger.ERROR('Processing for postpaid billing mode not yet implemented');
                        throw new Error('Processing for postpaid billing mode not yet implemented');
                    }

                    let logMsgTransact;

                    try {
                        // Prepare transaction to log message
                        logMsgTransact = new LogMessageTransaction(this, messageReadable, {
                            encrypted: encryptMessage,
                            storageScheme: storageScheme,
                            storageProvider: storageProvider
                        });

                        // Build and send transaction
                        logMsgTransact.buildTransaction();

                        logMsgTransact.sendTransaction();

                        // Force polling of blockchain so newly sent transaction is received and processed right away
                        Catenis.txMonitor.pollNow();

                        // Create message and save it to local database
                        messageId = Message.createLocalMessage(logMsgTransact);
                    }
                    catch (err) {
                        // Error logging message
                        //  Log error condition
                        Catenis.logger.ERROR('Error logging message.', err);

                        if (logMsgTransact && !logMsgTransact.txid) {
                            // Revert output addresses added to transaction
                            logMsgTransact.revertOutputAddresses();
                        }

                        // Rethrows exception
                        throw err;
                    }

                    try {
                        // Record billing info for service
                        const billing = Billing.createNew(this, logMsgTransact, servicePriceInfo);

                        let servicePayTransact;

                        if (this.client.billingMode === Client.billingMode.prePaid) {
                            servicePayTransact = Catenis.spendServCredit.confirmPaymentForService(paymentProvisionInfo, logMsgTransact.txid);
                        }
                        else if (this.client.billingMode === Client.billingMode.postPaid) {
                            // Not yet implemented
                            Catenis.logger.ERROR('Processing for postpaid billing mode not yet implemented');
                            // noinspection ExceptionCaughtLocallyJS
                            throw new Error('Processing for postpaid billing mode not yet implemented');
                        }

                        billing.setServicePaymentTransaction(servicePayTransact);
                    }
                    catch (err) {
                        if ((err instanceof Meteor.Error) && err.error === 'ctn_spend_serv_cred_tx_rejected') {
                            // Spend service credit transaction has been rejected.
                            //  Log warning condition
                            Catenis.logger.WARN('Billing for log message service (serviceTxid: %s) recorded with no service payment transaction', logMsgTransact.txid);
                        }
                        else {
                            // Error recording billing info for log message service.
                            //  Just log error condition
                            Catenis.logger.ERROR('Error recording billing info for log message service (serviceTxid: %s),', logMsgTransact.txid, err);
                        }
                    }
                });
            });
        });
    };

    if (async) {
        // Execute processing asynchronously
        Future.task(doProcessing).resolve((err) => {
            ProvisionalMessage.finalizeProcessing(provisionalMessageId, Message.action.log, err, messageId);

            try {
                // Send notification advising that progress of asynchronous message processing has come to an end
                // noinspection JSUnusedAssignment
                this.notifyFinalMessageProgress(provisionalMessageId, ProvisionalMessage.getProvisionalMessageByMessageId(provisionalMessageId).getMessageProgress());
            }
            catch (err) {
                // Error sending notification message. Log error
                Catenis.logger.ERROR('Error sending final message progress notification event for device (doc_id: %s)', this.doc_id, err);
            }
        });

        // Returns provisional message ID, so processing progress can be monitored
        // noinspection JSUnusedAssignment
        return {
            provisionalMessageId: provisionalMessageId
        };
    }
    else {
        // Execute processing immediately (synchronously)
        if (provisionalMessageId) {
            // Make sure to register processing outcome in provisional message
            let error;

            try {
                doProcessing();
            }
            catch (err) {
                error = err;
            }

            if (provisionalMessageId) {
                ProvisionalMessage.finalizeProcessing(provisionalMessageId, Message.action.log, error, messageId);
            }

            if (error) {
                // Just re-throws error
                throw error;
            }
        }
        else {
            doProcessing();
        }

        // Returns resulting message Id
        return {
            messageId: messageId
        };
    }
};

// Read message previously sent/logged
//
//  Arguments:
//    messageId: [String]  - ID of message to read
//    encoding: [String]  - The encoding that should be used for the returned message
//
//  Return value:
//    readResult: {
//      from: {         - Note: only returned if origin device different than device that issued the request, unless
//                        it is the (rare) case where the device that issued the request sent a message to itself
//        deviceId: [String],     - Catenis ID of the origin device (device that had sent/logged the message)
//        name: [String],         - (only returned if defined and device that issued the request has permission to access this device's main props) Assigned name of the device
//        prodUniqueId: [String]  - (only returned if defined and device that issued the request has permission to access this device's main props) Product unique ID of the device
//      },
//      to: {          - Note: only returned if target device different than device that issued the request
//        deviceId: [String]      - Catenis ID of target device (device to which the message had been sent)
//        name: [String],         - (only returned if defined and device that issued the request has permission to access this device's main props) Assigned name of the device
//        prodUniqueId: [String]  - (only returned if defined and device that issued the request has permission to access this device's main props) Product unique ID of the device
//      }
//      message: [String] - The message's contents formatted using the specified encoding
//    }
Device.prototype.readMessage = function (messageId, encoding) {
    const readResult = this.readMessage2(messageId, encoding);

    // Excluded action property
    delete readResult.action;

    return readResult;
};

// Read message previously sent/logged
//
//  Arguments:
//    messageId: [String]  - ID of message to read
//    encoding: [String]  - The encoding that should be used for the returned message
//
//  Return value:
//    readResult: {
//      action: [String],    - Action originally performed on the message; either 'log' or 'send'
//      from: {         - Note: only returned if origin device different than device that issued the request, unless
//                        it is the (rare) case where the device that issued the request sent a message to itself
//        deviceId: [String],     - Catenis ID of the origin device (device that had sent/logged the message)
//        name: [String],         - (only returned if defined and device that issued the request has permission to access this device's main props) Assigned name of the device
//        prodUniqueId: [String]  - (only returned if defined and device that issued the request has permission to access this device's main props) Product unique ID of the device
//      },
//      to: {          - Note: only returned if target device different than device that issued the request
//        deviceId: [String]      - Catenis ID of target device (device to which the message had been sent)
//        name: [String],         - (only returned if defined and device that issued the request has permission to access this device's main props) Assigned name of the device
//        prodUniqueId: [String]  - (only returned if defined and device that issued the request has permission to access this device's main props) Product unique ID of the device
//      }
//      message: [String] - The message's contents formatted using the specified encoding
//    }
Device.prototype.readMessage2 = function (messageId, encoding) {
    const readResult = this.readMessage3(messageId, encoding);

    // Merge message's contents with message info
    readResult.msgInfo.message = readResult.msgData;

    return readResult.msgInfo;
};

// Read message previously sent/logged
//
//  Arguments:
//    messageId: [String]  - ID of message to read
//    encoding: [String]  - The encoding that should be used for the returned message
//    continuationToken [String]  - (optional) Indicates that this is a continuation call and that the following message data chunk should be returned
//    dataChunkSize [Number]  - (optional) Size, in bytes, of the largest message data chunk that should be returned. This is effectively used to signal
//                               that the message should be retrieved/read in chunks
//    async [Boolean]  - (optional) Indicates whether processing should be done asynchronously. If set to true, a cached message ID is returned,
//                        which should be used to retrieve the processing outcome by calling the MessageProgress API method
//
//  Return value:
//    readResult: {
//      msgInfo: {  - (optional) Returned along with the 'msgData' field for the first (or the only) part of the message's contents returned for a
//                         given message ID
//        action: [String],    - Action originally performed on the message; either 'log' or 'send'
//        from: {         - Note: only returned if origin device different than device that issued the request, unless
//                          it is the (rare) case where the device that issued the request sent a message to itself
//          deviceId: [String],     - Catenis ID of the origin device (device that had sent/logged the message)
//          name: [String],         - (only returned if defined and device that issued the request has permission to access this device's main props) Assigned name of the device
//          prodUniqueId: [String]  - (only returned if defined and device that issued the request has permission to access this device's main props) Product unique ID of the device
//        },
//        to: {          - Note: only returned if target device different than device that issued the request
//          deviceId: [String]      - Catenis ID of target device (device to which the message had been sent)
//          name: [String],         - (only returned if defined and device that issued the request has permission to access this device's main props) Assigned name of the device
//          prodUniqueId: [String]  - (only returned if defined and device that issued the request has permission to access this device's main props) Product unique ID of the device
//        }
//      },
//      msgData: [String],   - (optional) The message's contents formatted using the specified encoding. Returned as a response to the initial call to this API method
//                             with a given message ID (no continuation token) if not doing asynchronous processing, or as a response for a continuation call
//                             (continuation token was passed)
//      continuationToken: [String],  - (optional) Token to be used when requesting the following message data chunk. This is returned along with the 'msgData'
//                                       field if the whole message's contents has not yet been returned
//      cachedMessageId: [String]  - (optional) Cached message ID. Returned as a response to the initial call to this API method with a given message ID
//                                    (no continuation token) if doing asynchronous processing
//    }
Device.prototype.readMessage3 = function (messageId, encoding, continuationToken, dataChunkSize, async = false) {
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

    let messageDuplex;
    let cachedMessageId;

    if (continuationToken) {
        // This is a continuation read message call.
        //  Retrieve next message data chunk from cached message
        let readResult;

        // Execute code in critical section to avoid database concurrency
        MessageChunk.dbCS.execute(() => {
            // noinspection JSUnusedAssignment
            const cachedMessage = CachedMessage.getCachedMessageByMessageChunkId(continuationToken, this.deviceId, messageId);

            readResult = {};

            if (cachedMessage.hasFirstMessageChunk()) {
                readResult.msgInfo = cachedMessage.msgInfo;
            }
            
            // noinspection JSUnusedAssignment
            readResult.msgData = cachedMessage.getDataChunk(continuationToken).toString(encoding);

            const nextContinuationToken = cachedMessage.getContinuationToken();

            if (nextContinuationToken) {
                readResult.continuationToken = nextContinuationToken;
            }
        });

        // noinspection JSUnusedAssignment
        return readResult;
    }
    else {
        // Initial read message call

        if (async && !dataChunkSize) {
            // Asynchronous processing requested while reading the message at once (not in chunks).
            //  So treat it as if message was to be read in chunks.
            //
            //  NOTE: we set the chunk size to 1 byte above the maximum allowed size to signal
            //      this special case so the message is actually read in only one chunk (or an
            //      error is reported if it is too large to be read at once)
            dataChunkSize = messageCfgSettings.maxSizeReadDataChunk + 1;
        }

        if (dataChunkSize) {
            // Requesting to read message in chunks

            // Execute code in critical section to avoid database concurrency
            MessageChunk.dbCS.execute(() => {
                // Get stream to write retrieved message's contents to cached message
                const cachedMessage = CachedMessage.createCachedMessage(this.deviceId, Message.action.read, messageId, dataChunkSize);

                messageDuplex = new CachedMessageDuplex(cachedMessage);
                
                // Save cached message ID
                cachedMessageId = cachedMessage.cachedMessageId;
            });
        }
        // Note: otherwise, no message duplex stream will be initialized now, so a buffer message duplex
        //      stream will be automatically used to write the contents of the retrieved message
    }

    let msgTransact;
    let msgInfo;

    const doProcessing = () => {
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
                            // noinspection JSUnresolvedVariable
                            if (txInfo.walletconflicts.length > 0) {
                                // noinspection JSUnresolvedVariable
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
        msgTransact = message.action === Message.action.log ? LogMessageTransaction.checkTransaction(transact, messageDuplex) :
            (message.action === Message.action.send ? SendMessageTransaction.checkTransaction(transact, messageDuplex) : undefined);

        if (msgTransact !== undefined) {
            // Indicates that message has been read
            if (message.readNow()) {
                // This was the first time that message has been read
                if (message.action === Message.action.send && message.readConfirmationEnabled) {
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
        }
        else {
            // Not a valid Catenis transaction (this should never happen). Log error and throws exception
            Catenis.logger.ERROR('Message is associated with a non-Catenis transaction', {messageId: messageId, txid: txid});
            throw new Meteor.Error('ctn_msg_invalid_tx', util.format('Message (messageId: %s) is associated with a non-Catenis transaction id: %s', messageId, txid));
        }

        msgInfo = getMessageInfo.call(this, message, msgTransact);
    };

    if (async) {
        // Execute processing asynchronously
        Future.task(doProcessing).resolve((err) => {
            CachedMessage.finalizeProcessing(cachedMessageId, err, msgInfo);

            try {
                // Send notification advising that progress of asynchronous message processing has come to an end
                // noinspection JSUnusedAssignment
                this.notifyFinalMessageProgress(cachedMessageId, CachedMessage.getCachedMessageByMessageId(cachedMessageId).getMessageProgress());
            }
            catch (err) {
                // Error sending notification message. Log error
                Catenis.logger.ERROR('Error sending final message progress notification event for device (doc_id: %s)', this.doc_id, err);
            }
        });

        // Returns cached message ID, so processing progress can be monitored
        // noinspection JSUnusedAssignment
        return {
            cachedMessageId: cachedMessageId
        };
    }
    else {
        // Execute processing immediately (synchronously)
        let msgData;
        let nextContinuationToken;

        if (cachedMessageId) {
            // Make sure to register processing outcome in provisional message
            let error;

            try {
                doProcessing();
            }
            catch (err) {
                error = err;
            }

            if (cachedMessageId) {
                // noinspection JSUnusedAssignment
                CachedMessage.finalizeProcessing(cachedMessageId, error, msgInfo);
            }

            if (error) {
                // Just re-throws error
                throw error;
            }

            // Get first message data chunk
            try {
                // Execute code in critical section to avoid database concurrency
                MessageChunk.dbCS.execute(() => {
                    const cachedMessage = CachedMessage.getCachedMessageByMessageId(cachedMessageId);

                    msgData = cachedMessage.getDataChunk(cachedMessage.getContinuationToken());

                    nextContinuationToken = cachedMessage.getContinuationToken();
                });
            }
            catch (err) {
                // Error reading first message data chunk. Log error and throw exception
                Catenis.logger.ERROR('Error reading first message data chunk from cached message (cachedMessageId: %s).', cachedMessageId, err);
                throw new Error(util.format('Error reading first message data chunk (cachedMessageId: %s)', cachedMessageId));
            }
        }
        else {
            doProcessing();

            // Read message's contents directly from Catenis transaction
            // noinspection JSUnusedAssignment
            const messageReadable = msgTransact.messageReadable;
            msgData = Buffer.from('');

            const fut = new Future();

            messageReadable.once('error', (err) => {
                // Error reading message's contents. Log error and throw exception
                Catenis.logger.ERROR('Error reading message\'s contents from Catenis transaction.', err);

                messageReadable.destroy();
                messageReadable.removeAllListeners();

                if (!fut.isResolved()) {
                    fut.throw(new Error('Error reading message\'s contents from Catenis transaction'));
                }
            });

            messageReadable.on('data', (data) => {
                msgData = Buffer.concat([msgData, data]);
            });

            messageReadable.on('end', () => {
                if (!fut.isResolved()) {
                    fut.return();
                }
            });

            fut.wait();

            messageReadable.removeAllListeners();
        }

        // Returns resulting message's contents and info
        // noinspection JSUnusedAssignment
        const readResult = {
            msgInfo: msgInfo,
            msgData: msgData.toString(encoding)
        };

        if (nextContinuationToken) {
            readResult.continuationToken = nextContinuationToken;
        }

        return readResult;
    }
};

// Issue an amount of an asset
//
//  Arguments:
//    ephemeralMessageId [String] - ID of ephemeral message (either a provisional or a cached message) for which to return processing progress
//
//  Return value:
//    msgProgress: {
//      action: [String]            - The action that was to be performed on the message. One of: 'send', 'log' or 'read'
//      progress: {
//        bytesProcessed: [Number], - Total number of bytes of message that had already been processed
//        done: [Boolean],          - Indicates whether processing had been finalized, either successfully or with error
//        success: [Boolean],       - (optional) Indicates whether message had been successfully processed. Only returned after processing
//                                     is finished (done = true)
//        error: {      - (optional) Only returned after processing is finished with error (done = true & success = false)
//          code: [Number],      - Code number of error that took place while processing the message
//          message: [String]    - Text describing the error that took place while processing the message
//        },
//        finishDate: [Date]         - (optional) Date and time when processing was finalized. Only returned after processing is finished (done = true)
//      },
//      result: {  - (optional) Only returned after processing is finished successfully
//        messageId: [String]         - ID of the Catenis message. When sending or logging (action = send or log), it is the ID of the
//                                       resulting message. When reading (action = read), it references the message being read
//        continuationToken: [String] - The token that should be used to complete the read of the message. Only return if action = read
//      }
//    }
Device.prototype.getMessageProgress = function (ephemeralMessageId) {
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

    let msgProgress;

    // Execute code in critical section to avoid database concurrency
    MessageChunk.dbCS.execute(() => {
        // Get ephemeral message. Try first as a provisional message
        let provisionalMessage;

        try {
            provisionalMessage = ProvisionalMessage.getProvisionalMessageByMessageId(ephemeralMessageId, this.deviceId, false);
        }
        catch (err) {
            if (!((err instanceof Meteor.Error) && err.error === 'ctn_prov_msg_not_found')) {
                throw err;
            }
        }

        let cachedMessage;

        if (!provisionalMessage) {
            // Try now as cached message
            try {
                cachedMessage = CachedMessage.getCachedMessageByMessageId(ephemeralMessageId, this.deviceId, false);
            }
            catch (err) {
                let error;

                if ((err instanceof Meteor.Error) && err.error === 'ctn_cach_msg_not_found') {
                    // Throw error indicating that ephemeral was not found
                    error = new Meteor.Error('ctn_ephem_msg_not_found', util.format('Could not find ephemeral message with given message ID (ephemeralMessageId: %s)', ephemeralMessageId));
                }
                else {
                    error = err;
                }

                throw error;
            }
        }

        if (provisionalMessage) {
            // Get provisional message progress
            msgProgress = provisionalMessage.getMessageProgress();
        }
        else {
            // Get cached message progress
            msgProgress = cachedMessage.getMessageProgress();
        }
    });

    // noinspection JSUnusedAssignment
    return msgProgress;
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
        msgCount: queryResult.messages.length,
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
                msgEntry.readConfirmationEnabled = message.readConfirmationEnabled;

                // Make sure that 'message read' info is only shown if message was sent with read confirmation enabled,
                //  and consider message read only if read confirmation has already been received
                if (message.readConfirmationEnabled) {
                    msgEntry.read = message.readConfirmed !== undefined;
                }

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
        Catenis.logger.INFO('Device has no permission to retrieve the other device\'s identification information', {
            deviceId: this.deviceId,
            otherDeviceId: device.deviceId
        });
        throw new Meteor.Error('ctn_device_no_permission', util.format('Device has no permission to retrieve that other device\'s identification information (deviceId: %s, otherDeviceId: %s)', this.deviceId, device.deviceId));
    }

    return device.getIdentityInfo();
};

// Issue an amount of an asset
//
//  Arguments:
//    amount: [Number]      - Amount of asset to be issued (expressed as a fractional amount)
//    assetInfo: [Object|String] { - An object describing the new asset to be created, or the ID of an existing (unlocked) asset
//      name: [String], - The name of the asset
//      description: [String], - (optional) The description of the asset
//      canReissue: [Boolean], - Indicates whether more units of this asset can be issued at another time (an unlocked asset)
//      decimalPlaces: [Number] - The maximum number of decimal places that can be used to represent a fractional amount of this asset
//    }
//    holdingDeviceId: [String] - (optional) Device ID identifying the device for which the asset is being issued and that shall
//                                 hold the total amount of asset issued. If that specified, the amount of asset issued shall
//                                 be held by this device
//
//  Return value: - If issuing a new asset
//    assetId: [String]  - ID of issued asset
//  or: - If reissuing an existing asset
//    totalExistentBalance: [Number]  - Total balance of the asset in existence after specified amount has been reissued
Device.prototype.issueAsset = function (amount, assetInfo, holdingDeviceId) {
    // Make sure that device is not deleted
    if (this.status === Device.status.deleted.name) {
        // Cannot issue asset from a deleted device. Log error and throw exception
        Catenis.logger.ERROR('Cannot issue asset from a deleted device', {deviceId: this.deviceId});
        throw new Meteor.Error('ctn_device_deleted', util.format('Cannot issue asset from a deleted device (deviceId: %s)', this.deviceId));
    }

    // Make sure that device is active
    if (this.status !== Device.status.active.name) {
        // Cannot issue asset from a device that is not active. Log error and throw exception
        Catenis.logger.ERROR('Cannot issue asset from a device that is not active', {deviceId: this.deviceId});
        throw new Meteor.Error('ctn_device_not_active', util.format('Cannot issue asset from a device that is not active (deviceId: %s)', this.deviceId));
    }

    let holdingDevice;

    if (holdingDeviceId !== undefined && holdingDeviceId !== this.deviceId) {
        try {
            holdingDevice = Device.getDeviceByDeviceId(holdingDeviceId);

            // Make sure that holding device is not deleted
            if (holdingDevice.status === Device.status.deleted.name) {
                // Cannot assign issued asset to a deleted device. Log error and throw exception
                Catenis.logger.ERROR('Cannot assign issued asset to a deleted device', {deviceId: holdingDeviceId});
                //noinspection ExceptionCaughtLocallyJS
                throw new Meteor.Error('ctn_device_hold_dev_deleted', util.format('Cannot assign issued asset to a deleted device (deviceId: %s)', holdingDeviceId));
            }

            // Make sure that holding device is active
            if (holdingDevice.status !== Device.status.active.name) {
                // Cannot assign issued asset to a device that is not active. Log error condition and throw exception
                Catenis.logger.ERROR('Cannot assign issued asset to a device that is not active', {deviceId: holdingDeviceId});
                //noinspection ExceptionCaughtLocallyJS
                throw new Meteor.Error('ctn_device_hold_dev_not_active', util.format('Cannot assign issued asset to a device that is not active (deviceId: %s)', holdingDeviceId));
            }
        }
        catch (err) {
            if ((err instanceof Meteor.Error) && err.error === 'ctn_device_not_found') {
                // No holding device available with given device ID. Log error and throw exception
                Catenis.logger.ERROR('Could not find holding device with given device ID', {deviceId: holdingDeviceId});
                throw new Meteor.Error('ctn_device_hold_dev_not_found', util.format('Could not find holding device with given device ID (%s)', holdingDeviceId));
            }
            else {
                // Otherwise, just re-throws exception
                throw err;
            }
        }
    }

    if (holdingDevice === undefined) {
        holdingDevice = this;
    }

    // Make sure that device has permission to assign asset to be issued to holding device
    if (!holdingDevice.shouldAcceptAssetOf(this) || (holdingDevice.deviceId !== this.deviceId && !holdingDevice.shouldAcceptAssetFrom(this))) {
        // Device has no permission rights to assign asset to be issued to holding device
        Catenis.logger.INFO('Device has no permission rights to assign asset to be issued to holding device', {
            deviceId: this.deviceId,
            holdingDeviceId: holdingDevice.deviceId
        });
        throw new Meteor.Error('ctn_device_no_permission', util.format('Device has no permission rights to assign asset to be issued to holding device (deviceId: %s, holdingDeviceId: %s)', this.deviceId, holdingDevice.deviceId));
    }

    let assetId;
    let totalExistentBalance;

    // Execute code in critical section to avoid Colored Coins UTXOs concurrency
    CCFundSource.utxoCS.execute(() => {
        // Execute code in critical section to avoid UTXOs concurrency
        FundSource.utxoCS.execute(() => {
            // Execute code in critical section to avoid concurrent spend service credit tasks
            spendServCredProcCS.execute(() => {
                const servicePriceInfo = Service.issueAssetServicePrice();
                let paymentProvisionInfo;

                if (this.client.billingMode === Client.billingMode.prePaid) {
                    try {
                        paymentProvisionInfo = Catenis.spendServCredit.provisionPaymentForService(this.client, servicePriceInfo.finalServicePrice);
                    }
                    catch (err) {
                        if ((err instanceof Meteor.Error) && err.error === 'ctn_spend_serv_cred_utxo_alloc_error') {
                            // Unable to allocate service credits from client service account to pay for service.
                            //  Log error and throw exception
                            Catenis.logger.ERROR('Client does not have enough credits to pay for issue asset service', {
                                serviceAccountBalance: this.client.serviceAccountBalance(),
                                servicePrice: servicePriceInfo.finalServicePrice
                            });
                            throw new Meteor.Error('ctn_device_low_service_acc_balance', 'Client does not have enough credits to pay for issue asset service');
                        }
                        else {
                            // Error provisioning spend service credit transaction to pay for service.
                            //  Log error and throw exception
                            Catenis.logger.ERROR('Error provisioning spend service credit transaction to pay for issue asset service.', err);
                            throw new Error('Error provisioning spend service credit transaction to pay for issue asset service');
                        }
                    }
                }
                else if (this.client.billingMode === Client.billingMode.postPaid) {
                    // Not yet implemented
                    Catenis.logger.ERROR('Processing for postpaid billing mode not yet implemented');
                    throw new Error('Processing for postpaid billing mode not yet implemented');
                }

                let issueAssetTransact;

                try {
                    // Prepare transaction to issue asset
                    issueAssetTransact = new IssueAssetTransaction(this, holdingDevice, amount, assetInfo);

                    // Build and send transaction
                    issueAssetTransact.buildTransaction();

                    issueAssetTransact.sendTransaction();

                    // Force polling of blockchain so newly sent transaction is received and processed right away
                    Catenis.txMonitor.pollNow();
                }
                catch (err) {
                    // Error issuing asset. Log error condition
                    Catenis.logger.ERROR('Error issuing asset.', err);

                    if (issueAssetTransact && !issueAssetTransact.txid) {
                        // Revert output addresses added to transaction
                        issueAssetTransact.revertOutputAddresses();
                    }

                    // Rethrows exception
                    throw err;
                }

                assetId = issueAssetTransact.assetId;

                if (issueAssetTransact.bnPrevTotalExistentBalance) {
                    // Add final total existent asset balance to result
                    totalExistentBalance = issueAssetTransact.asset.smallestDivisionAmountToAmount(issueAssetTransact.bnPrevTotalExistentBalance.plus(issueAssetTransact.amount));
                }

                try {
                    // Record billing info for service
                    const billing = Billing.createNew(this, issueAssetTransact, servicePriceInfo);

                    let servicePayTransact;

                    if (this.client.billingMode === Client.billingMode.prePaid) {
                        servicePayTransact = Catenis.spendServCredit.confirmPaymentForService(paymentProvisionInfo, issueAssetTransact.txid);
                    }
                    else if (this.client.billingMode === Client.billingMode.postPaid) {
                        // Not yet implemented
                        Catenis.logger.ERROR('Processing for postpaid billing mode not yet implemented');
                        // noinspection ExceptionCaughtLocallyJS
                        throw new Error('Processing for postpaid billing mode not yet implemented');
                    }

                    billing.setServicePaymentTransaction(servicePayTransact);
                }
                catch (err) {
                    if ((err instanceof Meteor.Error) && err.error === 'ctn_spend_serv_cred_tx_rejected') {
                        // Spend service credit transaction has been rejected.
                        //  Log warning condition
                        Catenis.logger.WARN('Billing for issue asset service (serviceTxid: %s) recorded with no service payment transaction', issueAssetTransact.txid);
                    }
                    else {
                        // Error recording billing info for issue asset service.
                        //  Just log error condition
                        Catenis.logger.ERROR('Error recording billing info for issue asset service (serviceTxid: %s),', issueAssetTransact.txid, err);
                    }
                }
            });
        });
    });

    // noinspection JSUnusedAssignment
    return totalExistentBalance !== undefined ? totalExistentBalance : assetId;
};

// Transfer an amount of an asset to a device
//
//  Arguments:
//    receivingDeviceId: [String] - Device ID identifying the device to which the assets are sent
//    amount: [Number]      - Amount of asset to be sent (expressed as a fractional amount)
//    assetId: [String]     - The ID of the asset to transfer
//
//  Return value: - If issuing a new asset
//    remainingBalance: [Number]  - The total balance of the asset held by this device after the transfer
Device.prototype.transferAsset = function (receivingDeviceId, amount, assetId) {
    // Make sure that device is not deleted
    if (this.status === Device.status.deleted.name) {
        // Cannot transfer asset from a deleted device. Log error and throw exception
        Catenis.logger.ERROR('Cannot transfer asset from a deleted device', {deviceId: this.deviceId});
        throw new Meteor.Error('ctn_device_deleted', util.format('Cannot transfer asset from a deleted device (deviceId: %s)', this.deviceId));
    }

    // Make sure that device is active
    if (this.status !== Device.status.active.name) {
        // Cannot transfer asset from a device that is not active. Log error and throw exception
        Catenis.logger.ERROR('Cannot transfer asset from a device that is not active', {deviceId: this.deviceId});
        throw new Meteor.Error('ctn_device_not_active', util.format('Cannot transfer asset from a device that is not active (deviceId: %s)', this.deviceId));
    }

    let receivingDevice;

    if (receivingDeviceId !== this.deviceId) {
        try {
            receivingDevice = Device.getDeviceByDeviceId(receivingDeviceId);

            // Make sure that receiving device is not deleted
            if (receivingDevice.status === Device.status.deleted.name) {
                // Cannot transfer asset to a deleted device. Log error and throw exception
                Catenis.logger.ERROR('Cannot transfer asset to a deleted device', {deviceId: receivingDeviceId});
                //noinspection ExceptionCaughtLocallyJS
                throw new Meteor.Error('ctn_device_recv_dev_deleted', util.format('Cannot transfer asset to a deleted device (deviceId: %s)', receivingDeviceId));
            }

            // Make sure that receiving device is active
            if (receivingDevice.status !== Device.status.active.name) {
                // Cannot transfer asset to a device that is not active. Log error condition and throw exception
                Catenis.logger.ERROR('Cannot transfer asset to a device that is not active', {deviceId: receivingDeviceId});
                //noinspection ExceptionCaughtLocallyJS
                throw new Meteor.Error('ctn_device_recv_dev_not_active', util.format('Cannot transfer asset to a device that is not active (deviceId: %s)', receivingDeviceId));
            }
        }
        catch (err) {
            if ((err instanceof Meteor.Error) && err.error === 'ctn_device_not_found') {
                // No receiving device available with given device ID. Log error and throw exception
                Catenis.logger.ERROR('Could not find receiving device with given device ID', {deviceId: receivingDeviceId});
                throw new Meteor.Error('ctn_device_recv_dev_not_found', util.format('Could not find receiving device with given device ID (%s)', receivingDeviceId));
            }
            else {
                // Otherwise, just re-throws exception
                throw err;
            }
        }
    }

    // Identify asset issuing device
    let issuingDevice;

    try {
        issuingDevice = Asset.getAssetByAssetId(assetId, true).issuingDevice;
    }
    catch (err) {
        if (!((err instanceof Meteor.Error) && err.error === 'ctn_asset_not_found')) {
            // Error trying to identify asset issuing device
            Catenis.logger.ERROR('Error trying to identify asset issuing device', err);
        }
    }

    // Make sure that device has permission to send asset to receiving device
    if ((issuingDevice !== undefined && !receivingDevice.shouldAcceptAssetOf(issuingDevice)) || !receivingDevice.shouldAcceptAssetFrom(this)) {
        // Device has no permission rights to sent asset to receiving device
        Catenis.logger.INFO('Device has no permission rights to send asset to receiving device', {
            deviceId: this.deviceId,
            receivingDeviceId: receivingDevice.deviceId
        });
        throw new Meteor.Error('ctn_device_no_permission', util.format('Device has no permission rights to send asset to receiving device (deviceId: %s, receivingDeviceId: %s)', this.deviceId, receivingDevice.deviceId));
    }

    let remainingBalance;

    // Execute code in critical section to avoid Colored Coins UTXOs concurrency
    CCFundSource.utxoCS.execute(() => {
        // Execute code in critical section to avoid UTXOs concurrency
        FundSource.utxoCS.execute(() => {
            // Execute code in critical section to avoid concurrent spend service credit tasks
            spendServCredProcCS.execute(() => {
                const servicePriceInfo = Service.transferAssetServicePrice();
                let paymentProvisionInfo;

                if (this.client.billingMode === Client.billingMode.prePaid) {
                    try {
                        paymentProvisionInfo = Catenis.spendServCredit.provisionPaymentForService(this.client, servicePriceInfo.finalServicePrice);
                    }
                    catch (err) {
                        if ((err instanceof Meteor.Error) && err.error === 'ctn_spend_serv_cred_utxo_alloc_error') {
                            // Unable to allocate service credits from client service account to pay for service.
                            //  Log error and throw exception
                            Catenis.logger.ERROR('Client does not have enough credits to pay for transfer asset service', {
                                serviceAccountBalance: this.client.serviceAccountBalance(),
                                servicePrice: servicePriceInfo.finalServicePrice
                            });
                            throw new Meteor.Error('ctn_device_low_service_acc_balance', 'Client does not have enough credits to pay for transfer asset service');
                        }
                        else {
                            // Error provisioning spend service credit transaction to pay for service.
                            //  Log error and throw exception
                            Catenis.logger.ERROR('Error provisioning spend service credit transaction to pay for transfer asset service.', err);
                            throw new Error('Error provisioning spend service credit transaction to pay for transfer asset service');
                        }
                    }
                }
                else if (this.client.billingMode === Client.billingMode.postPaid) {
                    // Not yet implemented
                    Catenis.logger.ERROR('Processing for postpaid billing mode not yet implemented');
                    throw new Error('Processing for postpaid billing mode not yet implemented');
                }

                let transferAssetTransact;

                try {
                    // Prepare transaction to transfer asset
                    transferAssetTransact = new TransferAssetTransaction(this, receivingDevice, amount, assetId);

                    // Build and send transaction
                    transferAssetTransact.buildTransaction();

                    transferAssetTransact.sendTransaction();

                    // Force polling of blockchain so newly sent transaction is received and processed right away
                    Catenis.txMonitor.pollNow();
                }
                catch (err) {
                    // Error transferring asset. Log error condition
                    Catenis.logger.ERROR('Error transferring asset.', err);

                    if (transferAssetTransact && !transferAssetTransact.txid) {
                        // Revert output addresses added to transaction
                        transferAssetTransact.revertOutputAddresses();
                    }

                    // Rethrows exception
                    throw err;
                }

                remainingBalance = transferAssetTransact.asset.smallestDivisionAmountToAmount(new BigNumber(transferAssetTransact.prevTotalBalance).minus(transferAssetTransact.amount));

                try {
                    // Record billing info for service
                    const billing = Billing.createNew(this, transferAssetTransact, servicePriceInfo);

                    let servicePayTransact;

                    if (this.client.billingMode === Client.billingMode.prePaid) {
                        servicePayTransact = Catenis.spendServCredit.confirmPaymentForService(paymentProvisionInfo, transferAssetTransact.txid);
                    }
                    else if (this.client.billingMode === Client.billingMode.postPaid) {
                        // Not yet implemented
                        Catenis.logger.ERROR('Processing for postpaid billing mode not yet implemented');
                        // noinspection ExceptionCaughtLocallyJS
                        throw new Error('Processing for postpaid billing mode not yet implemented');
                    }

                    billing.setServicePaymentTransaction(servicePayTransact);
                }
                catch (err) {
                    if ((err instanceof Meteor.Error) && err.error === 'ctn_spend_serv_cred_tx_rejected') {
                        // Spend service credit transaction has been rejected.
                        //  Log warning condition
                        Catenis.logger.WARN('Billing for transfer asset service (serviceTxid: %s) recorded with no service payment transaction', transferAssetTransact.txid);
                    }
                    else {
                        // Error recording billing info for transfer asset service.
                        //  Just log error condition
                        Catenis.logger.ERROR('Error recording billing info for transfer asset service (serviceTxid: %s),', transferAssetTransact.txid, err);
                    }
                }
            });
        });
    });

    // noinspection JSUnusedAssignment
    return remainingBalance;
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

    if ('prodUniqueId' in newProps && this.props.prodUniqueId) {
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
                // noinspection JSUnresolvedVariable
                if ((err.name === 'MongoError' || err.name === 'BulkWriteError') && err.code === 11000 && err.errmsg.search(/index:\s+props\.prodUniqueId/) >= 0) {
                    // Duplicate product unique ID error.
                    Catenis.logger.ERROR(util.format('Cannot update device; product unique ID (%s) already associated with another device', props.prodUniqueId), err);
                    throw new Meteor.Error('ctn_device_duplicate_prodUniqueId', util.format('Cannot update device; product unique ID (%s) already associated with another device', props.prodUniqueId), err.stack);
                }
                else {
                    // Any other error
                    Catenis.logger.ERROR(util.format('Error trying to update device properties (doc_id: %s).', this.doc_id), err);
                    throw new Meteor.Error('ctn_device_update_error', util.format('Error trying to update device properties (doc_id: %s)', this.doc_id), err.stack);
                }
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

Device.prototype.shouldBeNotifiedOfReceivedAssetOf = function (device) {
    return Catenis.permission.hasRight(Permission.event.receive_notify_asset_of.name, this, device);
};

Device.prototype.shouldBeNotifiedOfAssetReceivedFrom = function (device) {
    return Catenis.permission.hasRight(Permission.event.receive_notify_asset_from.name, this, device);
};

Device.prototype.shouldBeNotifiedOfConfirmedAssetOf = function (device) {
    return Catenis.permission.hasRight(Permission.event.receive_notify_confirm_asset_of.name, this, device);
};

Device.prototype.shouldBeNotifiedOfConfirmedAssetFrom = function (device) {
    return Catenis.permission.hasRight(Permission.event.receive_notify_confirm_asset_from.name, this, device);
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

Device.prototype.shouldAcceptAssetOf = function (device) {
    return Catenis.permission.hasRight(Permission.event.receive_asset_of.name, this, device);
};

Device.prototype.shouldAcceptAssetFrom = function (device) {
    return Catenis.permission.hasRight(Permission.event.receive_asset_from.name, this, device);
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

    _und.extend(msgInfo.to, targetDevice.discloseMainPropsTo(this));

    // Dispatch notification message
    Catenis.notification.dispatchNotifyMessage(this.deviceId, Notification.event.sent_msg_read.name, JSON.stringify(msgInfo));
};

Device.prototype.notifyAssetReceived = function (asset, amount, sendingDevice, receivedDate) {
    // Prepare information about received asset to be sent by notification
    const msgInfo = {
        assetId: asset.assetId,
        amount: asset.smallestDivisionAmountToAmount(amount),
        issuer: {
            deviceId: asset.issuingDevice.deviceId,
        },
        from: {
            deviceId: sendingDevice.deviceId,
        },
        receivedDate: receivedDate
    };

    // Add device public properties
    _und.extend(msgInfo.issuer, asset.issuingDevice.discloseMainPropsTo(this));
    _und.extend(msgInfo.issuer, sendingDevice.discloseMainPropsTo(this));

    // Dispatch notification message
    Catenis.notification.dispatchNotifyMessage(this.deviceId, Notification.event.asset_received.name, JSON.stringify(msgInfo));
};

Device.prototype.notifyAssetConfirmed = function (asset, amount, sendingDevice, confirmedDate) {
    // Prepare information about confirmed asset to be sent by notification
    const msgInfo = {
        assetId: asset.assetId,
        amount: asset.smallestDivisionAmountToAmount(amount),
        issuer: {
            deviceId: asset.issuingDevice.deviceId,
        },
        from: {
            deviceId: sendingDevice.deviceId,
        },
        confirmedDate: confirmedDate
    };

    // Add device public properties
    _und.extend(msgInfo.issuer, asset.issuingDevice.discloseMainPropsTo(this));
    _und.extend(msgInfo.issuer, sendingDevice.discloseMainPropsTo(this));

    // Dispatch notification message
    Catenis.notification.dispatchNotifyMessage(this.deviceId, Notification.event.asset_confirmed.name, JSON.stringify(msgInfo));
};

Device.prototype.notifyFinalMessageProgress = function (ephemeralMessageId, msgProgress) {
    // Dispatch notification message
    Catenis.notification.dispatchNotifyMessage(this.deviceId, Notification.event.final_msg_progress.name, JSON.stringify({
        ephemeralMessageId: ephemeralMessageId,
        ...msgProgress
    }));
};
/** End of notification related methods **/

/** Asset related methods **/
Device.prototype.getAssetIssuanceAddressesInUseExcludeUnlocked = function () {
    const unlockedAssetIssueAddrs = getUnlockedAssetIssuanceAddresses.call(this);

    if (unlockedAssetIssueAddrs.length > 0) {
        let unlockedAssetIssueAddrsSet;

        if (unlockedAssetIssueAddrs.length > 20) {
            // Optimization: only instantiate a set object is number of entries is large enough (more than 20).
            //  Otherwise, do lookup through the array itself
            unlockedAssetIssueAddrsSet = new Set(unlockedAssetIssueAddrs);
        }

        return this.assetIssuanceAddr.listAddressesInUse().filter(addr =>
            // Only return addresses that are not an unlocked asset issue address
            !(unlockedAssetIssueAddrsSet ? unlockedAssetIssueAddrsSet.has(addr)
                : unlockedAssetIssueAddrs.some(addr2 => addr2 === addr)));
    }
    else {
        return this.assetIssuanceAddr.listAddressesInUse();
    }
};

// Retrieve the current balance of a given asset held by this device
//
//  Arguments:
//    asset: [Object(Asset)|String] - An object of type Asset or the asset ID
//    convertAmount: [Boolean] - Indicate whether balance amount should be converted from a fractional amount to an
//                                an integer number of the asset's smallest division (according to the asset divisibility)
//
//  Return:
//    balance: {
//      total: [Number], - Total asset balance represented as an integer number of the asset's smallest division (according to the asset divisibility)
//      unconfirmed: [Number] - The unconfirmed asset balance represented as an integer number of the asset's smallest division (according to the asset divisibility)
//    }
Device.prototype.assetBalance = function (asset, convertAmount = true) {
    if (typeof asset === 'string') {
        // Asset ID passed instead, so to retrieve asset
        asset = Asset.getAssetByAssetId(asset, true);
    }

    const balance = Catenis.c3NodeClient.getAssetBalance(asset.ccAssetId, this.assetAddr.listAddressesInUse());

    if (balance !== undefined) {
        if (convertAmount) {
            // Convert amounts into asset's smallest division
            balance.total = asset.amountToSmallestDivisionAmount(balance.total);
            balance.unconfirmed = asset.amountToSmallestDivisionAmount(balance.unconfirmed);
        }
    }
    else {
        // Unable to retrieve Colored Coins asset balance. Log error condition and throw exception
        Catenis.logger.ERROR('Unable to retrieve Colored Coins asset balance', {
            ccAssetId: asset.ccAssetId
        });
    }

    return balance;
};

// Get the current balance of a given asset held by this device
//  (method used by Get Asset Balance API method)
//
//  Arguments:
//   assetId: [String] - ID of asset the balance of which is requested
//
//  Return value:
//   assetBalance: {
//     total: [Number], - The current balance of the asset held by this device, expressed as a decimal number
//     unconfirmed: [Number] - The amount from of the balance that is not yet confirmed
//   }
Device.prototype.getAssetBalance = function (assetId) {
    // Make sure that device is not deleted
    if (this.status === Device.status.deleted.name) {
        // Cannot get asset balance for deleted device. Log error and throw exception
        Catenis.logger.ERROR('Cannot get asset balance for a deleted device', {deviceId: this.deviceId});
        throw new Meteor.Error('ctn_device_deleted', util.format('Cannot get asset balance for a deleted device (deviceId: %s)', this.deviceId));
    }

    // Make sure that device is active
    if (this.status !== Device.status.active.name) {
        // Cannot get asset balance for a device that is not active. Log error and throw exception
        Catenis.logger.ERROR('Cannot get asset balance for a device that is not active', {deviceId: this.deviceId});
        throw new Meteor.Error('ctn_device_not_active', util.format('Cannot get asset balance for a device that is not active (deviceId: %s)', this.deviceId));
    }

    const assetBalance = this.assetBalance(assetId, false);

    if (assetBalance === undefined) {
        // Unable to retrieve Colored Coins asset balance. Throw exception
        throw new Meteor.Error('ctn_device_no_asset_balance', 'Unable to retrieve Colored Coins asset balance');
    }

    return assetBalance;
};

// Return information about a given asset
//  (method used by Retrieve Asset Info API method)
//
//  Arguments:
//   assetId: [String] - ID of the asset the information of which is requested
//
//  Return value:
//   assetInfo: {
//     assetId: [String],     - The ID of the asset
//     name: [String],        - The name of the asset
//     description: [String], - The description of the asset
//     canReissue: [Boolean], - Indicates whether more units of this asset can be reissued
//     decimalPlaces: [Number],  - The maximum number of decimal places that can be used to represent a fractional amount of this asset
//     issuer: {
//       deviceId: [String],  - The ID of the device that issued this asset
//       name: [String],      - (optional) The name of the device
//       prodUniqueId: [String] - (optional) The product unique ID of the device
//     },
//     totalExistentBalance: [Number] - The current total balance of the asset in existence, expressed as a fractional amount
//   }
Device.prototype.retrieveAssetInfo = function (assetId) {
    // Make sure that device is not deleted
    if (this.status === Device.status.deleted.name) {
        // Cannot retrieve asset info for deleted device. Log error and throw exception
        Catenis.logger.ERROR('Cannot retrieve asset info for a deleted device', {deviceId: this.deviceId});
        throw new Meteor.Error('ctn_device_deleted', util.format('Cannot retrieve asset info for a deleted device (deviceId: %s)', this.deviceId));
    }

    // Make sure that device is active
    if (this.status !== Device.status.active.name) {
        // Cannot retrieve asset info for a device that is not active. Log error and throw exception
        Catenis.logger.ERROR('Cannot retrieve asset info for a device that is not active', {deviceId: this.deviceId});
        throw new Meteor.Error('ctn_device_not_active', util.format('Cannot retrieve asset info for a device that is not active (deviceId: %s)', this.deviceId));
    }

    const asset = Asset.getAssetByAssetId(assetId, true);

    let hasAccess = false;

    if (this.deviceId !== asset.issuingDevice.deviceId) {
        // Device is not the issuer of this asset. Check if it currently holds it
        const balance = Catenis.c3NodeClient.getAssetBalance(asset.ccAssetId, this.assetAddr.listAddressesInUse());

        if (balance !== undefined && balance.total > 0) {
            hasAccess = true;
        }
    }
    else {
        hasAccess = true;
    }

    if (!hasAccess) {
        // Device is neither the issuer nor a current holder of that asset, thus it is not allowed
        //  to retrieve the asset info. Throw exception
        throw new Meteor.Error('ctn_device_asset_no_access', 'Device has no access rights to retrieve asset info');
    }

    // Get total existent asset balance
    const assetBalance = Catenis.c3NodeClient.getAssetBalance(asset.ccAssetId);

    if (assetBalance === undefined) {
        // Unable to retrieve Colored Coins asset balance. Log error condition
        Catenis.logger.ERROR('Unable to retrieve Colored Coins asset balance', {
            ccAssetId: asset.ccAssetId
        });
    }

    // Return asset info
    const assetInfo = {
        assetId: assetId,
        name: asset.name,
        description: asset.description,
        canReissue: asset.issuingType === CCTransaction.issuingAssetType.unlocked,
        decimalPlaces: asset.divisibility,
        issuer: {
            deviceId: asset.issuingDevice.deviceId
        },
        totalExistentBalance: assetBalance.total
    };

    _und.extend(assetInfo.issuer, asset.issuingDevice.discloseMainPropsTo(this));

    return assetInfo;
};

// Return list of all assets currently owned by this device
//  (method used by List Owned Assets API method)
//
//  Arguments:
//   limit: [Number] - (optional, default = 'maxRetListEntries') Maximum number of list items that should be returned
//   skip: [Number] - (optional, default = 0) Number of list items that should be skipped (from beginning of list) and not returned
//
//  Return value:
//   result: {
//     ownedAssets: [{ - A list of owned asset objects
//       assetId: [String] - The ID of the asset
//       balance: {
//         total: [Number], - The current balance of that asset held by this device, expressed as a decimal number
//         unconfirmed: [Number] - The amount from of the balance that is not yet confirmed
//       }
//     }],
//     hasMore: [Boolean] - Indicates whether there are more entries that have not been included in the return list
//   }
Device.prototype.listOwnedAssets = function (limit, skip) {
    // Make sure that device is not deleted
    if (this.status === Device.status.deleted.name) {
        // Cannot list owned assets for deleted device. Log error and throw exception
        Catenis.logger.ERROR('Cannot list owned assets for a deleted device', {deviceId: this.deviceId});
        throw new Meteor.Error('ctn_device_deleted', util.format('Cannot list owned assets for a deleted device (deviceId: %s)', this.deviceId));
    }

    // Make sure that device is active
    if (this.status !== Device.status.active.name) {
        // Cannot list owned assets for a device that is not active. Log error and throw exception
        Catenis.logger.ERROR('Cannot list owned assets for a device that is not active', {deviceId: this.deviceId});
        throw new Meteor.Error('ctn_device_not_active', util.format('Cannot list owned assets for a device that is not active (deviceId: %s)', this.deviceId));
    }

    if (!Number.isInteger(limit) || limit <= 0 || limit > assetCfgSetting.maxRetListEntries) {
        limit = assetCfgSetting.maxRetListEntries;
    }

    if (!Number.isInteger(skip) || skip < 0) {
        skip = 0;
    }

    const ccAssetIdBalance = Catenis.c3NodeClient.getOwningAssets(this.assetAddr.listAddressesInUse());
    const result = {
        ownedAssets: [],
        hasMore: false
    };

    if (ccAssetIdBalance !== undefined) {
        const ccAssetIds =  Object.keys(ccAssetIdBalance);
        let endIdx = skip + limit;

        if (endIdx > ccAssetIds.length) {
            endIdx = ccAssetIds.length;
        }

        for (let idx = skip; idx < endIdx; idx++) {
            const ccAssetId = ccAssetIds[idx];

            // Try to get asset from local database
            let asset;

            try {
                asset = Asset.getAssetByCcAssetId(ccAssetId);
            }
            catch (err) {
                if ((err instanceof Meteor.Error) && err.error === 'ctn_asset_not_found') {
                    // Could not find asset with returned Colored Coins asset ID. Log error condition
                    Catenis.logger.ERROR('Could not find asset with returned Colored Coins asset ID', {
                        ccAssetId: ccAssetId
                    });
                }
                else {
                    // Just rethrow exception
                    throw err;
                }
            }

            // noinspection JSUnresolvedVariable
            result.ownedAssets.push({
                assetId: asset !== undefined ? asset.assetId : null,
                balance: {
                    total: ccAssetIdBalance[ccAssetId].totalBalance,
                    unconfirmed: ccAssetIdBalance[ccAssetId].unconfirmedBalance
                }
            });
        }

        result.hasMore = endIdx < ccAssetIds.length;
    }

    return result;
};

// Returned a list of all the assets issued by this device
//  (method used by List Issued Assets API method)
//
//  Arguments:
//   limit: [Number] - (optional, default = 'maxRetListEntries') Maximum number of list items that should be returned
//   skip: [Number] - (optional, default = 0) Number of list items that should be skipped (from beginning of list) and not returned
//
//  Return value:
//   result: {
//     issuedAssets: [{ - A list of issued asset objects
//       assetId: [String] - The ID of the asset
//       totalExistentBalance: [Number] - The current total balance of that asset in existence, expressed as a fractional amount
//     }],
//     hasMore: [Boolean] - Indicates whether there are more entries that have not been included in the return list
//   }
Device.prototype.listIssuedAssets = function (limit, skip) {
    // Make sure that device is not deleted
    if (this.status === Device.status.deleted.name) {
        // Cannot list issued assets for deleted device. Log error and throw exception
        Catenis.logger.ERROR('Cannot list issued assets for a deleted device', {deviceId: this.deviceId});
        throw new Meteor.Error('ctn_device_deleted', util.format('Cannot list issued assets for a deleted device (deviceId: %s)', this.deviceId));
    }

    // Make sure that device is active
    if (this.status !== Device.status.active.name) {
        // Cannot list issued assets for a device that is not active. Log error and throw exception
        Catenis.logger.ERROR('Cannot list issued assets for a device that is not active', {deviceId: this.deviceId});
        throw new Meteor.Error('ctn_device_not_active', util.format('Cannot list issued assets for a device that is not active (deviceId: %s)', this.deviceId));
    }

    if (!Number.isInteger(limit) || limit <= 0 || limit > assetCfgSetting.maxRetListEntries) {
        limit = assetCfgSetting.maxRetListEntries;
    }

    if (!Number.isInteger(skip) || skip < 0) {
        skip = 0;
    }

    const result = {
        issuedAssets: [],
        hasMore: false
    };

    // Retrieve assets issued by this device
    Catenis.db.collection.Asset.find({
        type: Asset.type.device,
        'issuance.entityId': this.deviceId
    }, {
        fields: {
            assetId: 1,
            ccAssetId: 1
        },
        sort: {
            createdDate: 1
        },
        limit: limit + 1,
        skip: skip
    }).forEach((docAsset, idx) => {
        if (idx < limit) {
            // Retrieve total existent asset balance
            const assetBalance = Catenis.c3NodeClient.getAssetBalance(docAsset.ccAssetId);

            if (assetBalance === undefined) {
                // No balance returned for Colored Coins asset. Log error condition
                Catenis.logger.ERROR('No balance returned for Colored Coins asset', {
                    ccAssetId: docAsset.ccAssetId
                })
            }

            result.issuedAssets.push({
                assetId: docAsset.assetId,
                totalExistentBalance: assetBalance !== undefined ? assetBalance.total : null
            });
        }
        else {
            result.hasMore = true;
        }
    });

    return result;
};

// Return a list of issuance events for this asset that took place in a given time frame
//  (method used by Retrieve Asset Issuance History API method)
//
//  Arguments:
//   assetId: [String] - The ID of the asset the issuance history of which is requested
//   startDate: [Date] - (optional) Date and time specifying the start of the filtering time frame. The returned
//                        issuance events must have occurred not before that date/time
//   endDate: [Date] - (optional) Date and time specifying the end of the filtering time frame. The returned
//                        issuance events must have occurred not after that date/time
//
//  Return value:
//   issuanceHistory: {
//     issuanceEvents: [{ - A list of issuance event objects
//       amount: [Number],  - The amount of the asset issued, expressed as a decimal number
//       holdingDevice: {
//         deviceId: [String],    - The ID of the device to which the issued asset amount was assigned
//         name: [String],        - (optional) The name of the device
//         prodUniqueId: [String] - (optional) The product unique ID of the device
//       },
//       date: [Date] - Date end time when asset issuance took place
//     }],
//     countExceeded: [Boolean] - Indicates whether the number of asset issuance events that should have been returned
//                                 is larger than maximum number of asset issuance events that can be returned
//   }
Device.prototype.retrieveAssetIssuanceHistory = function (assetId, startDate, endDate) {
    // Make sure that device is not deleted
    if (this.status === Device.status.deleted.name) {
        // Cannot retrieve asset issuance history for deleted device. Log error and throw exception
        Catenis.logger.ERROR('Cannot retrieve asset issuance history for a deleted device', {deviceId: this.deviceId});
        throw new Meteor.Error('ctn_device_deleted', util.format('Cannot retrieve asset issuance history for a deleted device (deviceId: %s)', this.deviceId));
    }

    // Make sure that device is active
    if (this.status !== Device.status.active.name) {
        // Cannot retrieve asset issuance history for a device that is not active. Log error and throw exception
        Catenis.logger.ERROR('Cannot retrieve asset issuance history for a device that is not active', {deviceId: this.deviceId});
        throw new Meteor.Error('ctn_device_not_active', util.format('Cannot retrieve asset issuance history for a device that is not active (deviceId: %s)', this.deviceId));
    }

    const asset = Asset.getAssetByAssetId(assetId, true);

    if (this.deviceId !== asset.issuingDevice.deviceId) {
        // Device is not the issuer of this asset, thus it is not allowed to retrieve asset issuance history.
        //  Throw exception
        throw new Meteor.Error('ctn_device_asset_no_access', 'Device has no access rights to retrieve asset issuance history');
    }

    // Retrieve asset issuance info
    const txidAssetIssuance = Catenis.c3NodeClient.getAssetIssuance(asset.ccAssetId, false);

    const issuanceEvents = [];
    let countExceeded = false;

    if (txidAssetIssuance !== undefined) {
        const assetIssuanceTxids = Object.keys(txidAssetIssuance);

        // Retrieve asset issuance transactions from local database
        const querySelector = {
            type: 'issue_asset',
            txid: {
                $in: assetIssuanceTxids
            }
        };

        let sentDateConds = [];

        if (startDate !== undefined) {
            sentDateConds.push({
                $gte: startDate
            });
        }

        if (endDate !== undefined) {
            sentDateConds.push({
                $lte: endDate
            });
        }

        if (sentDateConds.length > 0) {
            if (sentDateConds.length === 1) {
                querySelector.sentDate = sentDateConds[0];
            }
            else {
                querySelector.$and = sentDateConds.map((cond) => {
                    return {
                        sentDate: cond
                    }
                });
            }
        }

        const docSentAssetIssueTxs = Catenis.db.collection.SentTransaction.find(querySelector, {
            fields: {
                txid: 1,
                sentDate: 1,
                info: 1
            },
            sort: {
                sentDate: 1
            },
            limit: assetCfgSetting.maxQueryIssuanceCount + 1
        });

        if (docSentAssetIssueTxs.length < assetIssuanceTxids.length) {
            // Not all asset issuance transactions could be retrieved from local database.
            //  Log error condition
            Catenis.logger.ERROR('Not all asset issuance transactions could be retrieved from local database', {
                numAssetIssuanceTxs: assetIssuanceTxids.length,
                numRetrievedAssetIssuanceTxs: docSentAssetIssueTxs.length,
                missingTxids: assetIssuanceTxids.filter(txid => docSentAssetIssueTxs.findIndex(doc => doc.txid === txid) === -1)
            });
        }

        docSentAssetIssueTxs.forEach((doc, idx) => {
            if (idx < assetCfgSetting.maxQueryIssuanceCount) {
                const issuance = {
                    amount: asset.smallestDivisionAmountToAmount(doc.info.issueAsset.amount),
                    holdingDevice: {
                        deviceId: doc.info.issueAsset.holdingDeviceId
                    }
                };

                _und.extend(issuance.holdingDevice, Device.getDeviceByDeviceId(doc.info.issueAsset.holdingDeviceId).discloseMainPropsTo(this));

                issuance.date = doc.sentDate;

                issuanceEvents.push(issuance);
            }
        });

        countExceeded = docSentAssetIssueTxs.length > assetCfgSetting.maxQueryIssuanceCount;
    }
    else {
        // Unable to retrieve Colored Coins asset issuance. Log error condition
        Catenis.logger.ERROR('Unable to retrieve Colored Coins asset issuance', {
            ccAssetId: asset.ccAssetId
        });
    }

    // Return asset issuance history
    return {
        issuanceEvents: issuanceEvents,
        countExceeded: countExceeded
    }
};

// Return list of devices that currently own an amount of a given asset
//  (method used by List Asset Holders API method)
//
//  Arguments:
//   assetId: [String] - The ID of the asset the list of holders of which is requested
//   limit: [Number] - (optional, default = 'maxRetListEntries') Maximum number of list items that should be returned
//   skip: [Number] - (optional, default = 0) Number of list items that should be skipped (from beginning of list) and not returned
//
//  Return values:
//   result: {
//     assetHolders: [{ - A list of asset holder objects
//       holder: {
//         deviceId: [String]   - ID of device that holds an amount of the asset
//         name: [String],        - (optional) The name of the device
//         prodUniqueId: [String] - (optional) The product unique ID of the device
//       },
//       balance: {
//         total: [Number],      - The current balance of that asset held by this device, expressed as a decimal number
//         unconfirmed: [Number] - The amount from of the balance that is not yet confirmed
//       }
//     }],
//     hasMore: [Boolean] - Indicates whether there are more entries that have not been included in the return list
//   }
Device.prototype.listAssetHolders = function (assetId, limit, skip) {
    // Make sure that device is not deleted
    if (this.status === Device.status.deleted.name) {
        // Cannot list asset holders for deleted device. Log error and throw exception
        Catenis.logger.ERROR('Cannot list asset holders for a deleted device', {deviceId: this.deviceId});
        throw new Meteor.Error('ctn_device_deleted', util.format('Cannot list asset holders for a deleted device (deviceId: %s)', this.deviceId));
    }

    // Make sure that device is active
    if (this.status !== Device.status.active.name) {
        // Cannot list asset holders for a device that is not active. Log error and throw exception
        Catenis.logger.ERROR('Cannot list asset holders for a device that is not active', {deviceId: this.deviceId});
        throw new Meteor.Error('ctn_device_not_active', util.format('Cannot list asset holders for a device that is not active (deviceId: %s)', this.deviceId));
    }

    const asset = Asset.getAssetByAssetId(assetId, true);

    if (this.deviceId !== asset.issuingDevice.deviceId) {
        // Device is not the issuer of this asset, thus it is not allowed to list the asset holders.
        //  Throw exception
        throw new Meteor.Error('ctn_device_asset_no_access', 'Device has no access rights to list asset holders');
    }

    if (!Number.isInteger(limit) || limit <= 0 || limit > assetCfgSetting.maxRetListEntries) {
        limit = assetCfgSetting.maxRetListEntries;
    }

    if (!Number.isInteger(skip) || skip < 0) {
        skip = 0;
    }

    const result = {
        assetHolders: [],
        hasMore: false
    };

    // Retrieve asset holders (blockchain addresses)
    const addressAssetBalance = Catenis.c3NodeClient.getAssetHolders(asset.ccAssetId);
    const deviceAssetHolder = new Map();
    const skippedDevices = new Set();
    const discardedDevices = new Set();

    if (addressAssetBalance !== undefined) {
        Object.keys(addressAssetBalance).forEach((address) => {
            const assetBalance = addressAssetBalance[address];

            // Try to get device associated with address
            const addrInfo = Catenis.keyStore.getAddressInfo(address);

            if (addrInfo !== null && addrInfo.type === KeyStore.extKeyType.dev_asst_addr.name) {
                const holdingDevice = CatenisNode.getCatenisNodeByIndex(addrInfo.pathParts.ctnNodeIndex).getClientByIndex(addrInfo.pathParts.clientIndex).getDeviceByIndex(addrInfo.pathParts.deviceIndex);

                if (!deviceAssetHolder.has(holdingDevice.deviceId)) {
                    // Not one of the accepted devices. Check if it is not one of the skipped or discarded devices
                    if (!skippedDevices.has(holdingDevice.deviceId) && !discardedDevices.has(holdingDevice.deviceId)) {
                        // A new device. Check if it should be accepted
                        if (skippedDevices.size < skip) {
                            // Skip device
                            skippedDevices.add(holdingDevice.deviceId);
                        }
                        else if (deviceAssetHolder.size === limit) {
                            // Discard device
                            discardedDevices.add(holdingDevice.deviceId);
                        }
                        else {
                            // Device good to be accepted
                            // noinspection JSUnresolvedVariable
                            const assetHolder = {
                                holder: {
                                    deviceId: holdingDevice.deviceId
                                },
                                balance: {
                                    total: new BigNumber(assetBalance.totalBalance),
                                    unconfirmed: new BigNumber(assetBalance.unconfirmedBalance)
                                }
                            };

                            _und.extend(assetHolder.holder, holdingDevice.discloseMainPropsTo(this));

                            deviceAssetHolder.set(holdingDevice.deviceId, assetHolder);
                        }
                    }
                }
                else {
                    // Device already accepted. Adjust its balance
                    const balance = deviceAssetHolder.get(holdingDevice.deviceId).balance;

                    // noinspection JSUnresolvedVariable
                    balance.total = balance.total.plus(assetBalance.totalBalance);
                    // noinspection JSUnresolvedVariable
                    balance.unconfirmed = balance.unconfirmed.plus(assetBalance.unconfirmedBalance);
                }
            }
            else {
                // Unrecognized asset holding address. Log error condition
                Catenis.logger.ERROR('Unrecognized asset holding address', {
                    assetId: assetId,
                    address: address,
                    addrInfo: addrInfo
                })
            }
        });
    }
    else {
        // Unable to retrieve Colored Coins asset holders. Log error condition
        Catenis.logger.ERROR('Unable to retrieve Colored Coins asset holders', {
            ccAssetId: asset.ccAssetId
        });
    }

    // Prepare to return result
    if (deviceAssetHolder.size > 0) {
        deviceAssetHolder.forEach((assetHolder) => {
            // Convert balance amount to number
            assetHolder.balance.total = assetHolder.balance.total.toNumber();
            assetHolder.balance.unconfirmed = assetHolder.balance.unconfirmed.toNumber();

            result.assetHolders.push(assetHolder);
        });

        result.hasMore = discardedDevices.size > 0;
    }

    return result;
};
/** End of asset related methods **/


// Module functions used to simulate private Device object methods
//  NOTE: these functions need to be bound to a Device object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

// Return list of device asset issuance addresses allocated to unlocked assets
function getUnlockedAssetIssuanceAddresses() {
    return Catenis.db.collection.Asset.find({
        type: Asset.type.device,
        issuingType: CCTransaction.issuingAssetType.unlocked,
        'issuance.entityId': this.deviceId
    }, {
        fields: {
            'issuance.addrPath': 1
        }
    }).map((doc) => {
        const addrInfo = Catenis.keyStore.getAddressInfoByPath(doc.issuance.addrPath);

        return addrInfo !== null ? addrInfo.cryptoKeys.getAddress() : undefined;
    }).filter(addr => addr !== undefined);
}

// NOTE: make sure that this method is called from code executed from the FundSource.utxoCS
//  critical section object
function fundDeviceAddresses(amountPerDevMainAddress, amountPerAssetIssuanceAddress, unlockedAssetIssueAddressAmount) {
    Catenis.logger.TRACE('Funding device addresses', {
        deviceId: this.deviceId,
        amountPerDevMainAddress: amountPerDevMainAddress,
        amountPerAssetIssuanceAddress: amountPerAssetIssuanceAddress,
        unlockedAssetIssueAddressAmount: unlockedAssetIssueAddressAmount
    });
    let fundTransact = undefined;

    try {
        // Prepare transaction to fund device main addresses
        // noinspection JSValidateTypes
        fundTransact = new FundTransaction(FundTransaction.fundingEvent.provision_client_device, this.deviceId);

        if (amountPerDevMainAddress !== undefined) {
            fundTransact.addPayees(this.mainAddr, amountPerDevMainAddress);
        }

        if (amountPerAssetIssuanceAddress !== undefined) {
            fundTransact.addPayees(this.assetIssuanceAddr, amountPerAssetIssuanceAddress);
        }

        if (unlockedAssetIssueAddressAmount !== undefined) {
            Object.keys(unlockedAssetIssueAddressAmount).forEach((address) => {
                fundTransact.addSingleAddressPayee(this.assetIssuanceAddr.type, address, unlockedAssetIssueAddressAmount[address]);
            });
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

function updateStatus(newDevStatus) {
    try {
        Catenis.db.collection.Device.update({_id: this.doc_id}, {
            $set: {
                status: newDevStatus,
                lastStatusChangedDate: new Date()
            }
        });
    }
    catch (err) {
        Catenis.logger.ERROR(util.format('Error trying to update status of device (doc Id: %s) to \'%s\'.', this.doc_id, newDevStatus), err);
        throw new Meteor.Error('ctn_device_update_error', util.format('Error trying to update status of device (doc Id: %s) to \'%s\'', this.doc_id, newDevStatus), err.stack);
    }
}

function activateDevice() {
    // Execute code in critical section to avoid DB concurrency
    this.devDbCS.execute(() => {
        // Get current device status and check if it needs to be updated
        const curDevDoc = Catenis.db.collection.Device.findOne({_id: this.doc_id}, {fields: {_id: 1, status: 1}});

        if (curDevDoc.status !== Device.status.active.name && curDevDoc.status !== Device.status.deleted.name) {
            let newDevStatus = Device.status.active.name;

            // Make sure that device can be activated
            if (curDevDoc.status === Device.status.inactive.name) {
                if (this.client.maximumAllowedDevices && this.client.devicesInUseCount() > this.client.maximumAllowedDevices) {
                    // Number of devices in use of client already reached the maximum allowed.
                    //  Log error and throw exception indicating that device cannot be activated
                    Catenis.logger.ERROR('Cannot activate device; maximum number of allowed devices already reached for client.', {
                        clientId: this.client.clientId,
                        maximumAllowedDevices: this.client.maximumAllowedDevices
                    });
                    throw new Meteor.Error('ctn_client_max_devices', util.format('Cannot activate device; maximum number of allowed devices already reached for client (clientId: %s)', this.client.clientId));
                }
            }
            else {  // curDevDoc.status === Device.status.new.name || curDevDoc.status === Device.status.pending.name
                if (this.client.maximumAllowedDevices && this.client.activeInactiveDevicesCount() >= this.client.maximumAllowedDevices) {
                    // Number of active/inactive devices of client already reached the maximum allowed.
                    //  Silently reset status to 'inactive'
                    newDevStatus = Device.status.inactive.name;
                }
            }

            updateStatus.call(this, newDevStatus);

            this.status = newDevStatus;
        }
        else {
            this.status = curDevDoc.status;

            if (this.status === Device.status.deleted.name) {
                // Log inconsistent condition
                Catenis.logger.WARN('Trying to activate a deleted device', {deviceId: this.deviceId});
            }
            else {  // status == 'active'
                // Log inconsistent condition
                Catenis.logger.WARN('Trying to activate a device that is already activated', {deviceId: this.deviceId});
            }
        }
    });
}

function deactivateDevice() {
    // Execute code in critical section to avoid DB concurrency
    this.devDbCS.execute(() => {
        // Get current device status and check if it needs to be updated
        const curDevDoc = Catenis.db.collection.Device.findOne({_id: this.doc_id}, {fields: {_id: 1, status: 1}});

        if (curDevDoc.status === Device.status.active.name) {
            updateStatus.call(this, Device.status.inactive.name);

            this.status = Device.status.inactive.name;
        }
        else {
            this.status = curDevDoc.status;

            // Log inconsistent condition
            Catenis.logger.WARN('Trying to deactivate a device that is not active', {deviceId: this.deviceId});
        }
    });
}

function getMessageInfo(message, msgTransact) {
    const msgInfo = {
        action: message.action
    };

    if (message.action === Message.action.log) {
        // Logged message
        const originDevice = msgTransact.device;

        // Return only info about device that logged the message only if it is
        //  different from the current device
        if (originDevice.deviceId !== this.deviceId) {
            msgInfo.from = {
                deviceId: originDevice.deviceId
            };

            // Add origin device public properties
            _und.extend(msgInfo.from, originDevice.discloseMainPropsTo(this));
        }
    }
    else if (message.action === Message.action.send) {
        // Sent message
        const originDevice = msgTransact.originDevice;
        const targetDevice = msgTransact.targetDevice;

        if (targetDevice.deviceId === this.deviceId) {
            // Message was sent to current device. So return only info about the device that sent
            //  it no matter what (this will properly accommodate the (rare) case where a device sends
            //  a message to itself)
            msgInfo.from = {
                deviceId: originDevice.deviceId
            };

            // Add origin device public properties
            _und.extend(msgInfo.from, originDevice.discloseMainPropsTo(this));
        }
        else {
            // Message not sent to current device

            // Return info about device that sent the message only if it is not the current device
            if (originDevice.deviceId !== this.deviceId) {
                msgInfo.from = {
                    deviceId: originDevice.deviceId
                };

                // Add origin device public properties
                _und.extend(msgInfo.from, originDevice.discloseMainPropsTo(this));
            }

            // Return info about device to which message was sent
            msgInfo.to = {
                deviceId: targetDevice.deviceId
            };

            // Add target device public properties
            _und.extend(msgInfo.to, targetDevice.discloseMainPropsTo(this));
        }
    }

    return msgInfo;
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

Device.getDeviceByDocId = function (device_id, includeDeleted = true) {
    // Retrieve Device doc/rec
    const query = {
        _id: device_id
    };

    if (!includeDeleted) {
        query.status = {$ne: Device.status.deleted.name};
    }

    const docDevice = Catenis.db.collection.Device.findOne(query);

    if (docDevice === undefined) {
        // No device available with the given doc/rec ID. Log error and throw exception
        Catenis.logger.ERROR('Could not find device with given database rec/doc ID', {device_id: device_id});
        throw new Meteor.Error('ctn_device_not_found', util.format('Could not find device with given database rec/doc ID (%s)', device_id));
    }

    return new Device(docDevice, CatenisNode.getCatenisNodeByIndex(docDevice.index.ctnNodeIndex).getClientByIndex(docDevice.index.clientIndex));
};

Device.activeDevicesCount = function () {
    return Catenis.db.collection.Device.find({status: Device.status.active.name}).count();
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

Device.checkDevicesAddrFunding = function () {
    // Retrieve devices the status of which is neither 'new' nor 'deleted'
    Catenis.db.collection.Device.find({
        $and: [{
            status: {$ne: Device.status.new.name}
        }, {
            status: {$ne: Device.status.deleted.name}
        }]
    }).forEach(doc => {
        try {
            Catenis.logger.TRACE(util.format('Checking funding of main and asset issuance addresses of existing device (deviceId: %s)', doc.deviceId));
            (new Device(doc, CatenisNode.getCatenisNodeByIndex(doc.index.ctnNodeIndex).getClientByIndex(doc.index.clientIndex))).fixFundAddresses();
        }
        catch (err) {
            // Error trying to fund addresses of device. Log error condition
            Catenis.logger.ERROR(util.format('Error checking/fixing funding of main and asset issuance addresses of device (deviceId: %s).', doc.deviceId), err);
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
            // noinspection JSValidateTypes
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
            // noinspection JSValidateTypes
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
//   deviceIds [Array(String)|String] - List of UNIQUE device IDs (or a single device ID) of devices to check existence
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

Device.status = DeviceShared.status;


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

            // Execute code in critical section to avoid UTXOs concurrency
            FundSource.utxoCS.execute(() => {
                // Make sure that system pay tx expense addresses are properly funded
                device.client.ctnNode.checkPayTxExpenseFundingBalance();
            });
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
