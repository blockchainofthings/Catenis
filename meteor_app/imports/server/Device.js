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
    DeviceAssetIssuanceAddress,
    DeviceMigratedAssetAddress
} from './BlockchainAddress';
import { DeviceOffChainAddress } from './OffChainAddress';
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
import { LogOffChainMessage } from './LogOffChainMessage';
import { SendOffChainMessage } from './SendOffChainMessage';
import { OffChainMsgReceipt } from './OffChainMsgReceipt';
import { ExportedAsset } from './ExportedAsset';
import { ForeignBlockchain } from './ForeignBlockchain';
import { AssetMigration } from './AssetMigration';
import { NFAssetIssuance } from './NFAssetIssuance';
import { IssueNFAssetTransaction } from './IssueNFAssetTransaction';


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
    this.migratedAssetAddr = new DeviceMigratedAssetAddress(this.client.ctnNode.ctnNodeIndex, this.client.clientIndex, this.deviceIndex);
    this.assetAddr = new DeviceAssetAddress(this.client.ctnNode.ctnNodeIndex, this.client.clientIndex, this.deviceIndex);
    this.assetIssuanceAddr = new DeviceAssetIssuanceAddress(this.client.ctnNode.ctnNodeIndex, this.client.clientIndex, this.deviceIndex);
    this.offChainAddr = new DeviceOffChainAddress(this.client.ctnNode.ctnNodeIndex, this.client.clientIndex, this.deviceIndex);

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

// NOTE: calling this method with `checkStatus` set to false is NOT recommended
//  and should be used only for development purpose
Device.prototype.fundAddresses = function (checkStatus = true) {
    // Make sure that device's status is new
    if (checkStatus && this.status !== Device.status.new.name) {
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

        let unlockedAssetIssueAddressAmount;

        if (this.status !== Device.status.new.name) {
            // Check unlocked asset issuance addresses
            const unlockedAssetIssuanceAddresses = this.getUnlockedAssetIssuanceAddresses();
            const unlockAssetIssueAddrBalance = new FundSource(unlockedAssetIssuanceAddresses, {useUnconfirmedUtxo: true}).getBalance(true);

            if (unlockAssetIssueAddrBalance === 0) {
                // Refund unlocked asset issuance addresses
                unlockedAssetIssueAddressAmount = unlockedAssetIssuanceAddresses.reduce((addressAmount, address) => {
                    let amount = Service.devAssetIssuanceAddrAmount(address);
                    const changeAmount = Service.deviceAssetProvisionCost(address) - amount;

                    if (changeAmount > 0) {
                        amount = [amount, changeAmount];
                    }

                    addressAmount[address] = amount;

                    return addressAmount;
                }, {});
            }
        }

        //if (devMainAddrDistribFund.amountPerAddress !== undefined || assetIssuanceAddrDistribFund.amountPerAddress !== undefined) {
        //    fundDeviceAddresses.call(this, devMainAddrDistribFund.amountPerAddress, assetIssuanceAddrDistribFund.amountPerAddress);
        if (devMainAddrDistribFund.amountPerAddress !== undefined || assetIssuanceAddrDistribFund.amountPerAddress !== undefined || unlockedAssetIssueAddressAmount !== undefined) {
            // Device main addresses and/or device asset issuance addresses not funded yet, or unlocked asset
            //  issuance addresses need to be refunded,  so fund them now
            fundDeviceAddresses.call(this, devMainAddrDistribFund.amountPerAddress, assetIssuanceAddrDistribFund.amountPerAddress, unlockedAssetIssueAddressAmount);

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
        const devUnlockedAssetIssueAddrs = this.getUnlockedAssetIssuanceAddresses();
        let devUnlockedAssetIssueAddrAmount = {};

        if (devUnlockedAssetIssueAddrs.length > 0) {
            const addressBalance = new FundSource(devUnlockedAssetIssueAddrs, {useUnconfirmedUtxo: true}).getBalancePerAddress(true);

            devUnlockedAssetIssueAddrs.forEach((unlockedAssetIssueAddr) => {
                const expectAddrBalance = Service.deviceAssetProvisionCost(unlockedAssetIssueAddr);
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
//    targetDeviceId [String]   - Device ID identifying the device to which the message should be sent
//    message [Object(Buffer)]  - Object of type Buffer containing the message to be sent
//    readConfirmation [Boolean] - (optional, default: false) Indicates whether message should be sent with read confirmation enabled
//    encryptMessage [Boolean]   - (optional, default: true) Indicates whether message should be encrypted before sending it
//    storageScheme [String]     - (optional, default: 'auto') A field of the CatenisMessage.storageScheme property identifying how the message should be stored
//    storageProvider [Object]   - (optional, default: defaultStorageProvider) A field of the CatenisMessage.storageProvider property
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
//    targetDeviceId [String]   - (optional) Device ID identifying the device to which the message should be sent
//    encryptMessage [Boolean]   - (optional, default: true) Indicates whether message should be encrypted before sending it
//    storageScheme [String]     - (optional, default: 'auto') A field of the CatenisMessage.storageScheme property identifying how the message should be stored
//    readConfirmation [Boolean] - (optional, default: false) Indicates whether message should be sent with read confirmation enabled
//    storageProvider [Object]   - (optional, default: defaultStorageProvider) A field of the CatenisMessage.storageProvider property
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
    return this.sendMessage3(message, targetDeviceId, encryptMessage, false, storageScheme, readConfirmation, storageProvider, async);
};

// Send message to another device
//
//  Arguments:
//    message [Buffer(Buffer)|Object] {  - The message to be sent. If a Buffer object is passed, it is assumed to be the whole message's contents.
//                                          Otherwise, it is expected that the message be passed in chunks using the following object to control it:
//      dataChunk: [Object(Buffer)], - (optional) The current message data chunk. The actual message's contents should be comprised of one or more data chunks
//      isFinal: [Boolean],          - Indicates whether this is the final (or the single) message data chunk
//      continuationToken: [String]  - (optional) Indicates that this is a continuation message data chunk. This should be filled with the value
//                                      returned in the 'continuationToken' field of the response from the previously sent message data chunk
//    }
//    targetDeviceId [String]    - (optional) Device ID identifying the device to which the message should be sent
//    encryptMessage [Boolean]   - (optional, default: true) Indicates whether message should be encrypted before sending it
//    offChain [Boolean]         - (optional, default: true) Indicates whether message should be processed as a Catenis off-chain message. Catenis off-chain
//                                  messages are stored on the external storage repository and only later its reference is settled to the blockchain along
//                                  with references of other off-chain messages
//    storageScheme [String]     - (optional, default: 'auto') A field of the CatenisMessage.storageScheme property identifying how the message should be stored
//    readConfirmation [Boolean] - (optional, default: false) Indicates whether message should be sent with read confirmation enabled
//    storageProvider [Object]   - (optional, default: defaultStorageProvider) A field of the CatenisMessage.storageProvider property
//                                  identifying the type of external storage to be used to store the message that should not be embedded
//    async [Boolean]            - (optional, default: false) Indicates whether processing should be done asynchronously. If set to true, a provisional
//                                  message ID is returned, which should be used to retrieve the processing outcome by calling the MessageProgress API method
//
//  Return value: {
//    sendResult: {
//      continuationToken: [String] - (optional) Token to be used when sending the following message data chunk. Returned if message passed in chunks
//                                     and last message data chunk was not final
//      messageId: [String]  - (optional) ID of sent message. Returned after the whole message's contents is sent if not doing asynchronous processing
//      provisionalMessageId: [String]  - (optional) Provisional message ID. Returned after the whole message's contents is sent if doing asynchronous processing
//    }
Device.prototype.sendMessage3 = function (message, targetDeviceId, encryptMessage = true, offChain = true, storageScheme = 'auto', readConfirmation = false, storageProvider, async = false) {
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
                const servicePriceInfo = !offChain ? Service.sendMessageServicePrice() : Service.sendOffChainMessageServicePrice();

                if (this.client.billingMode === Client.billingMode.prePaid) {
                    // Make sure that client has enough service credits to pay for service
                    const serviceAccountBalance = this.client.serviceAccountBalance();

                    if (serviceAccountBalance < servicePriceInfo.finalServicePrice) {
                        // Client does not have enough credits to pay for service.
                        //  Log error condition and throw exception
                        const errMsg = util.format('Client does not have enough credits to pay for send%s message service', offChain ? ' off-chain' : '');
                        Catenis.logger.ERROR(errMsg, {
                            serviceAccountBalance: serviceAccountBalance,
                            servicePrice: servicePriceInfo.finalServicePrice
                        });
                        throw new Meteor.Error('ctn_device_low_service_acc_balance', errMsg);
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
        let servicePaid = false;

        // Execute code in critical section to avoid Colored Coins UTXOs concurrency
        CCFundSource.utxoCS.execute(() => {
            // Execute code in critical section to avoid UTXOs concurrency
            FundSource.utxoCS.execute(() => {
                // Execute code in critical section to avoid concurrent spend service credit tasks
                spendServCredProcCS.execute(() => {
                    const servicePriceInfo = !offChain ? Service.sendMessageServicePrice() : Service.sendOffChainMessageServicePrice();
                    let paymentProvisionInfo;

                    if (this.client.billingMode === Client.billingMode.prePaid) {
                        try {
                            paymentProvisionInfo = Catenis.spendServCredit.provisionPaymentForService(this.client, servicePriceInfo.finalServicePrice);
                        }
                        catch (err) {
                            if ((err instanceof Meteor.Error) && err.error === 'ctn_spend_serv_cred_utxo_alloc_error') {
                                // Unable to allocate service credits from client service account to pay for service.
                                //  Log error and throw exception
                                const errMsg = util.format('Client does not have enough credits to pay for send%s message service', offChain ? ' off-chain' : '');
                                Catenis.logger.ERROR(errMsg, {
                                    serviceAccountBalance: this.client.serviceAccountBalance(),
                                    servicePrice: servicePriceInfo.finalServicePrice
                                });
                                throw new Meteor.Error('ctn_device_low_service_acc_balance', errMsg);
                            }
                            else {
                                // Error provisioning spend service credit transaction to pay for service.
                                //  Log error and throw exception
                                const errMsg = util.format('Error provisioning spend service credit transaction to pay for send%s message service', offChain ? ' off-chain' : '');
                                Catenis.logger.ERROR('%s.', errMsg, err);
                                throw new Error(errMsg);
                            }
                        }
                    }
                    else if (this.client.billingMode === Client.billingMode.postPaid) {
                        // Not yet implemented
                        Catenis.logger.ERROR('Processing for postpaid billing mode not yet implemented');
                        throw new Error('Processing for postpaid billing mode not yet implemented');
                    }

                    let serviceData;
                    let serviceDataRef;

                    if (!offChain) {
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

                        serviceData = sendMsgTransact;
                        serviceDataRef = sendMsgTransact.txid;
                    }
                    else {
                        // Off-Chain message
                        let sendOCMessage;

                        try {
                            // Prepare to log off-chain message
                            sendOCMessage = new SendOffChainMessage(this, targetDevice, messageReadable, {
                                readConfirmation: readConfirmation,
                                encrypted: encryptMessage,
                                storageProvider: storageProvider
                            });

                            // Assemble and save off-chain message
                            sendOCMessage.assemble();

                            // Save off-chain message requesting that associated Catenis off-chain message envelope
                            //  be immediately retrieved so it can be processed by local Catenis node right away
                            sendOCMessage.save(true);

                            // Create message and save it to local database
                            messageId = Message.createLocalOffChainMessage(sendOCMessage);
                        }
                        catch (err) {
                            // Error sending off-chain message
                            //  Log error condition
                            Catenis.logger.ERROR('Error sending off-chain message.', err);

                            if (sendOCMessage && !sendOCMessage.cid) {
                                // Revert off-chain addresses added to Catenis off-chain message envelope
                                sendOCMessage.revertOffChainAddresses();
                            }

                            // Rethrows exception
                            throw err;
                        }

                        serviceData = sendOCMessage;
                        serviceDataRef = sendOCMessage.cid;
                    }

                    try {
                        // Record billing info for service
                        const billing = Billing.createNew(this, serviceData, servicePriceInfo);

                        let servicePayTransact;

                        if (this.client.billingMode === Client.billingMode.prePaid) {
                            servicePayTransact = Catenis.spendServCredit.confirmPaymentForService(paymentProvisionInfo, serviceDataRef);
                        }
                        else if (this.client.billingMode === Client.billingMode.postPaid) {
                            // Not yet implemented
                            Catenis.logger.ERROR('Processing for postpaid billing mode not yet implemented');
                            // noinspection ExceptionCaughtLocallyJS
                            throw new Error('Processing for postpaid billing mode not yet implemented');
                        }

                        servicePaid = true;
                        billing.setServicePaymentTransaction(servicePayTransact);
                    }
                    catch (err) {
                        if ((err instanceof Meteor.Error) && err.error === 'ctn_spend_serv_cred_tx_rejected') {
                            // Spend service credit transaction has been rejected.
                            //  Log warning condition
                            Catenis.logger.WARN('Billing for send%s message service (serviceDataRef: %s) recorded with no service payment transaction', offChain ? ' off-chain' : '', serviceDataRef);
                        }
                        else {
                            // Error recording billing info for send message service.
                            //  Just log error condition
                            Catenis.logger.ERROR('Error recording billing info for send%s message service (serviceDataRef: %s),', offChain ? ' off-chain' : '', serviceDataRef, err);
                        }
                    }
                });
            });
        });

        if (servicePaid) {
            try {
                // Service successfully paid for. Check client service account balance now
                this.client.checkServiceAccountBalance();
            }
            catch (err) {
                // Log error
                Catenis.logger.ERROR('Error while checking for client service account balance.', err);
            }
        }
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
    return this.logMessage3(message, encryptMessage, false, storageScheme, storageProvider, async);
};

// Log message on the blockchain
//
//  Arguments:
//    message [Buffer(Buffer)|Object] {  - The message to be logged. If a Buffer object is passed, it is assumed to be the whole message's contents.
//                                          Otherwise, it is expected that the message be passed in chunks using the following object to control it:
//      dataChunk: [Object(Buffer)], - (optional) The current message data chunk. The actual message's contents should be comprised of one or more data chunks
//      isFinal: [Boolean],          - Indicates whether this is the final (or the single) message data chunk
//      continuationToken: [String]  - (optional) Indicates that this is a continuation message data chunk. This should be filled with the value
//                                      returned in the 'continuationToken' field of the response from the previously sent message data chunk
//    }
//    encryptMessage [Boolean] - (optional, default: true) Indicates whether message should be encrypted before logging it
//    offChain [Boolean]       - (optional, default: true) Indicates whether message should be processed as a Catenis off-chain message. Catenis off-chain
//                                messages are stored on the external storage repository and only later its reference is settled to the blockchain along
//                                with references of other off-chain messages
//    storageScheme [String]   - (optional, default: 'auto') A field of the CatenisMessage.storageScheme property identifying how the message should be stored.
//                                Note that, when the offChain parameter is set to true, this parameter's value is disregarded and the processing is done as
//                                if the value 'external' was passed
//    storageProvider [Object] - (optional, default: defaultStorageProvider) A field of the CatenisMessage.storageProvider property
//                                identifying the type of external storage to be used to store the message that should not be embedded
//    async [Boolean]          - (optional, default: false) Indicates whether processing should be done asynchronously. If set to true, a provisional
//                                message ID is returned, which should be used to retrieve the processing outcome by calling the MessageProgress API method
//
//  Return value:
//    logResult: {
//      continuationToken: [String] - (optional) Token to be used when sending the following message data chunk. Returned if message passed in chunks
//                                     and last message data chunk was not final
//      messageId: [String]  - (optional) ID of logged message. Returned after the whole message's contents is sent if not doing asynchronous processing
//      provisionalMessageId: [String]  - (optional) Provisional message ID. Returned after the whole message's contents is sent if doing asynchronous processing
//    }
Device.prototype.logMessage3 = function (message, encryptMessage = true, offChain = true, storageScheme = 'auto', storageProvider, async = false) {
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
                const servicePriceInfo = !offChain ? Service.logMessageServicePrice() : Service.logOffChainMessageServicePrice();

                if (this.client.billingMode === Client.billingMode.prePaid) {
                    // Make sure that client has enough service credits to pay for service
                    const serviceAccountBalance = this.client.serviceAccountBalance();

                    if (serviceAccountBalance < servicePriceInfo.finalServicePrice) {
                        // Client does not have enough credits to pay for service.
                        //  Log error condition and throw exception
                        const errMsg = util.format('Client does not have enough credits to pay for log%s message service', offChain ? ' off-chain' : '');
                        Catenis.logger.ERROR(errMsg, {
                            serviceAccountBalance: serviceAccountBalance,
                            servicePrice: servicePriceInfo.finalServicePrice
                        });
                        throw new Meteor.Error('ctn_device_low_service_acc_balance', errMsg);
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
        let servicePaid = false;

        // Execute code in critical section to avoid Colored Coins UTXOs concurrency
        CCFundSource.utxoCS.execute(() => {
            // Execute code in critical section to avoid UTXOs concurrency
            FundSource.utxoCS.execute(() => {
                // Execute code in critical section to avoid concurrent spend service credit tasks
                spendServCredProcCS.execute(() => {
                    const servicePriceInfo = !offChain ? Service.logMessageServicePrice() : Service.logOffChainMessageServicePrice();
                    let paymentProvisionInfo;

                    if (this.client.billingMode === Client.billingMode.prePaid) {
                        try {
                            paymentProvisionInfo = Catenis.spendServCredit.provisionPaymentForService(this.client, servicePriceInfo.finalServicePrice);
                        }
                        catch (err) {
                            if ((err instanceof Meteor.Error) && err.error === 'ctn_spend_serv_cred_utxo_alloc_error') {
                                // Unable to allocate service credits from client service account to pay for service.
                                //  Log error and throw exception
                                const errMsg = util.format('Client does not have enough credits to pay for log%s message service', offChain ? ' off-chain' : '');
                                Catenis.logger.ERROR(errMsg, {
                                    serviceAccountBalance: this.client.serviceAccountBalance(),
                                    servicePrice: servicePriceInfo.finalServicePrice
                                });
                                throw new Meteor.Error('ctn_device_low_service_acc_balance', errMsg);
                            }
                            else {
                                // Error provisioning spend service credit transaction to pay for service.
                                //  Log error and throw exception
                                const errMsg = util.format('Error provisioning spend service credit transaction to pay for log%s message service', offChain ? ' off-chain' : '');
                                Catenis.logger.ERROR('%s.', errMsg, err);
                                throw new Error(errMsg);
                            }
                        }
                    }
                    else if (this.client.billingMode === Client.billingMode.postPaid) {
                        // Not yet implemented
                        Catenis.logger.ERROR('Processing for postpaid billing mode not yet implemented');
                        throw new Error('Processing for postpaid billing mode not yet implemented');
                    }

                    let serviceData;
                    let serviceDataRef;

                    if (!offChain) {
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

                        serviceData = logMsgTransact;
                        serviceDataRef = logMsgTransact.txid;
                    }
                    else {
                        // Off-Chain message
                        let logOCMessage;

                        try {
                            // Prepare to log off-chain message
                            logOCMessage = new LogOffChainMessage(this, messageReadable, {
                                encrypted: encryptMessage,
                                storageProvider: storageProvider
                            });

                            // Assemble and save off-chain message
                            logOCMessage.assemble();

                            // Save off-chain message requesting that associated Catenis off-chain message envelope
                            //  be immediately retrieved so it can be processed by local Catenis node right away
                            logOCMessage.save(true);

                            // Create message and save it to local database
                            messageId = Message.createLocalOffChainMessage(logOCMessage);
                        }
                        catch (err) {
                            // Error logging off-chain message
                            //  Log error condition
                            Catenis.logger.ERROR('Error logging off-chain message.', err);

                            if (logOCMessage && !logOCMessage.cid) {
                                // Revert off-chain addresses added to Catenis off-chain message envelope
                                logOCMessage.revertOffChainAddresses();
                            }

                            // Rethrows exception
                            throw err;
                        }

                        serviceData = logOCMessage;
                        serviceDataRef = logOCMessage.cid;
                    }

                    try {
                        // Record billing info for service
                        const billing = Billing.createNew(this, serviceData, servicePriceInfo);

                        let servicePayTransact;

                        if (this.client.billingMode === Client.billingMode.prePaid) {
                            servicePayTransact = Catenis.spendServCredit.confirmPaymentForService(paymentProvisionInfo, serviceDataRef);
                        }
                        else if (this.client.billingMode === Client.billingMode.postPaid) {
                            // Not yet implemented
                            Catenis.logger.ERROR('Processing for postpaid billing mode not yet implemented');
                            // noinspection ExceptionCaughtLocallyJS
                            throw new Error('Processing for postpaid billing mode not yet implemented');
                        }

                        servicePaid = true;
                        billing.setServicePaymentTransaction(servicePayTransact);
                    }
                    catch (err) {
                        if ((err instanceof Meteor.Error) && err.error === 'ctn_spend_serv_cred_tx_rejected') {
                            // Spend service credit transaction has been rejected.
                            //  Log warning condition
                            Catenis.logger.WARN('Billing for log%s message service (serviceDataRef: %s) recorded with no service payment transaction', offChain ? ' off-chain' : '', serviceDataRef);
                        }
                        else {
                            // Error recording billing info for log message service.
                            //  Just log error condition
                            Catenis.logger.ERROR('Error recording billing info for log%s message service (serviceDataRef: %s),', offChain ? ' off-chain' : '', serviceDataRef, err);
                        }
                    }
                });
            });
        });

        if (servicePaid) {
            try {
                // Service successfully paid for. Check client service account balance now
                this.client.checkServiceAccountBalance();
            }
            catch (err) {
                // Log error
                Catenis.logger.ERROR('Error while checking for client service account balance.', err);
            }
        }
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
    return this.readMessage4(messageId, encoding, continuationToken, dataChunkSize, async, false);
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
//    handleOffChainMsg: [Boolean] - Indicates whether off-chain message should be properly handled
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
Device.prototype.readMessage4 = function (messageId, encoding, continuationToken, dataChunkSize, async = false, handleOffChainMsg = true) {
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

    let msgTransport;
    let msgInfo;

    const doProcessing = () => {
        if (handleOffChainMsg && message.isOffChain) {
            // Off-chain message
            const ocMessage = message.action === Message.action.log ? LogOffChainMessage.fromMsgEnvelopeCid(message.ocMsgEnvCid, messageDuplex) :
                (message.action === Message.action.send ? SendOffChainMessage.fromMsgEnvelopeCid(message.ocMsgEnvCid, messageDuplex) : undefined);

            if (ocMessage !== undefined) {
                // Indicates that message has been read
                if (message.readNow()) {
                    // This was the first time that message has been read
                    if (message.action === Message.action.send && message.readConfirmationEnabled && this.shouldSendReadMsgConfirmationTo(ocMessage.originDevice)) {
                        // Save Catenis off-chain message receipt to confirm that off-chain message has been read
                        try {
                            const ocMsgReceipt = new OffChainMsgReceipt();
                            ocMsgReceipt.assemble(ocMessage.ocMsgEnvelope.cid);

                            ocMsgReceipt.save(true);

                            ocMsgReceipt.saveToDatabase();
                        }
                        catch (err) {
                            // Error while trying to save Catenis off-chain message receipt
                            Catenis.logger.ERROR('Error while trying to save Catenis off-chain message receipt to confirm that off-chain message (msgEnvCid: %s) has been read.', ocMessage.ocMsgEnvelope.cid, err);
                        }
                    }
                }

                msgTransport = ocMessage;
            }
            else {
                // Inconsistent Catenis off-chain message envelope (this should never happen). Log error and throws exception
                Catenis.logger.ERROR('Message is associated with an inconsistent Catenis off-chain message envelope', {
                    messageId: messageId,
                    ocMsgEnvCid: message.ocMsgEnvCid,
                });
                throw new Meteor.Error('ctn_msg_invalid_oc_msg', util.format('Message (messageId: %s) is associated with an inconsistent Catenis off-chain message envelope (cid: %s)', messageId, message.ocMsgEnvCid));
            }
        }
        else {
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
                                txInfo = Catenis.bitcoinCore.getTransaction(txid, false, false, false);
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
                            Catenis.logger.ERROR('Message has an invalid transaction id', {
                                messageId: messageId,
                                txid: txid
                            });
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
            let msgTransact = message.action === Message.action.log ? LogMessageTransaction.checkTransaction(transact, messageDuplex) :
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

                msgTransport = msgTransact;
            }
            else {
                // Not a valid Catenis transaction (this should never happen). Log error and throws exception
                Catenis.logger.ERROR('Message is associated with a non-Catenis transaction', {
                    messageId: messageId,
                    txid: txid
                });
                throw new Meteor.Error('ctn_msg_invalid_tx', util.format('Message (messageId: %s) is associated with a non-Catenis transaction id: %s', messageId, txid));
            }
        }

        msgInfo = getMessageInfo.call(this, message, msgTransport);
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
            const messageReadable = msgTransport.messageReadable;
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
//    messageId: [String] - ID of message to get container info
//
//  Return value:
//    containerInfo: {
//      blockchain: {
//        txid: [String],         // ID of blockchain transaction where message is recorded
//                                //  NOTE: due to malleability, the ID of the transaction might change
//                                //    until the transaction is finally confirmed
//        isConfirmed: [Boolean]  // Indicates whether the returned txid is confirmed
//      },
//      externalStorage: {     // Note: only returned if message is stored in an external storage
//        <storage_provider_name>: [String]  // Key: storage provider name. Value: reference to message in external storage
//      }
//    }
//
Device.prototype.retrieveMessageContainer = function (messageId) {
    return this.retrieveMessageContainer2(messageId, false);
};


// Retrieve info about where a message previously sent/logged is recorded
//
//  Arguments:
//    messageId: [String] - ID of message to get container info
//    targetDeviceCanRetrieve: [Boolean] - Indicates whether target device can also retrieve the message container
//
//  Return value:
//    containerInfo: {
//      blockchain: {
//        txid: [String],         // ID of blockchain transaction where message is recorded
//                                //  NOTE: due to malleability, the ID of the transaction might change
//                                //    until the transaction is finally confirmed
//        isConfirmed: [Boolean]  // Indicates whether the returned txid is confirmed
//      },
//      externalStorage: {     // Note: only returned if message is stored in an external storage
//        <storage_provider_name>: [String]  // Key: storage provider name. Value: reference to message in external storage
//      }
//    }
//
Device.prototype.retrieveMessageContainer2 = function (messageId, targetDeviceCanRetrieve = true) {
    return this.retrieveMessageContainer3(messageId, targetDeviceCanRetrieve, false);
};

// Retrieve info about where a message previously sent/logged is recorded
//
//  Arguments:
//    messageId: [String] - ID of message to get container info
//    targetDeviceCanRetrieve: [Boolean] - Indicates whether target device can also retrieve the message container
//    handleOffChainMsg: [Boolean] - Indicates whether off-chain message should be properly handled
//
//  Return value:
//    containerInfo: {
//      offChain: {           - Note: only returned for Catenis off-chain messages
//        cid: [String]          - IPFS CID of Catenis off-chain message envelope data structure that holds the message's contents
//      },
//      blockchain: {         - Note: for Catenis off-chain messages, this property refers to the transaction used to settle off-chain
//                               messages to the blockchain, and it is only returned at a later time after the settlement takes place
//        txid: [String],        - ID of blockchain transaction where message is recorded
//                                  NOTE: due to malleability, the ID of the transaction might change until the it is finally confirmed
//        isConfirmed: [Boolean] - Indicates whether the returned txid is confirmed
//      },
//      externalStorage: {    - Note: only returned if message is stored in an external storage
//        <storage_provider_name>: [String] - Key: storage provider name. Value: reference to message in external storage
//      }
//    }
//
Device.prototype.retrieveMessageContainer3 = function (messageId, targetDeviceCanRetrieve = true, handleOffChainMsg = true) {
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

    // Make sure that device can retrieve the message container. The device that logged/sent
    //  the message (origin device) and the device to which the message is sent (the target
    //  device) can retrieve the message container
    if (!(message.originDeviceId === this.deviceId || (targetDeviceCanRetrieve && message.targetDeviceId === this.deviceId))) {
        // Throw exception indicating that message container cannot be retrieved by this device
        throw new Meteor.Error('ctn_device_msg_no_access', 'Device has no access rights to retrieve message container');
    }

    // Returns message container info
    const containerInfo = {};

    if (handleOffChainMsg && message.isOffChain) {
        // Off-chain message
        containerInfo.offChain = {
            cid: message.ocMsgEnvCid
        };

        if (message.isRecordedToBlockchain) {
            containerInfo.blockchain = {
                txid: message.txid,
                isConfirmed: message.isTxConfirmed
            };
        }
    }
    else {
        containerInfo.blockchain = {
            txid: message.txid,
            isConfirmed: message.isTxConfirmed
        };
    }

    if (message.storageProviderName && message.externalStorageRef) {
        containerInfo.externalStorage = {};

        containerInfo.externalStorage[message.storageProviderName] = message.externalStorageRef;
    }

    return containerInfo;
};

// Retrieve a list of messages logged/sent/received by device that adhere to the specified filtering criteria
//
//  Arguments:
//    filter: [Object] - Object containing properties that specify the filtering criteria. Please refer to Message.query method for details about those properties
//    limit: [Number] - Maximum number of messages that should be returned
//    skip: [Number] - Number of messages that should be skipped (from beginning of list of matching messages) and not returned
//
//  Result:
//    listResult: {
//      msgEntries: [{
//        messageId: [String],  - ID of message
//        action: [String],     - Action originally performed on the message. Valid values: log|send
//        direction: [String],  - (only returned for action = 'send') Direction of the sent message. Valid values: inbound|outbound
//        fromDevice: [Object], - Device that had sent the message. (only returned for messages sent to the current device)
//        toDevice: [Object],   - Device to which message had been sent. (only returned for messages sent from the current device)
//        read: [Boolean],      - Indicates whether the message had already been read
//        date: [Date],         - Date and time when the message had been logged/sent/received
//      }],
//      hasMore: [Boolean] - Indicates whether there are more messages that satisfy the search criteria yet to be returned
//    }
//
Device.prototype.listMessages = function(filter, limit, skip) {
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
    const queryResult = Message.query(this.deviceId, filter, limit, skip);

    const listResult = {
        msgEntries: [],
        msgCount: queryResult.messages.length,
        hasMore: queryResult.hasMore
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
        // Cannot retrieve other device's identification information for a device that is not active. Log error and throw exception
        Catenis.logger.ERROR('Cannot retrieve other device\'s identification information for a device that is not active', {deviceId: this.deviceId});
        throw new Meteor.Error('ctn_device_not_active', util.format('Cannot retrieve other device\'s identification information for a device that is not active (deviceId: %s)', this.deviceId));
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
    let servicePaid = false;

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

                    servicePaid = true;
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

    if (servicePaid) {
        try {
            // Service successfully paid for. Check client service account balance now
            this.client.checkServiceAccountBalance();
        }
        catch (err) {
            // Log error
            Catenis.logger.ERROR('Error while checking for client service account balance.', err);
        }
    }

    // noinspection JSUnusedAssignment
    return totalExistentBalance !== undefined ? totalExistentBalance : assetId;
};

/**
 * @typedef {Object} InitialNonFungibleTokenInfo
 * @property {NonFungibleTokenProps} metadata The non-fungible token's properties
 * @property {Buffer} [contents] Another part of the non-fungible token contents
 */

/**
 * Initial data for creating a non-fungible asset and/or issuing its non-fungible tokens
 * @typedef {Object} IssueNFAssetInitialData
 * @property {(NonFungibleAssetProps|string)} assetPropsOrId Properties of the new non-fungible asset to create, or
 *                                                            external ID of a previously created non-fungible asset
 *                                                            (for reissuance)
 * @property {boolean} encryptNFTContents Indicates whether the non-fungible tokens' contents should be encrypted
 *                                         before being stored (on IPFS)
 * @property {(string|string[])} [holdingDeviceIds] A single ID or a list of ID of the devices that will hold the
 *                                                   non-fungible tokens being issued
 * @property {boolean} asyncProc Indicates whether the operation should be performed asynchronously
 * @property {InitialNonFungibleTokenInfo[]} nfTokenInfos List of information about the non-fungible tokens to issue
 * @property {boolean} isFinal Indicates whether this is the only call for the non-fungible asset issuance operation
 */

/**
 * @typedef {Object} ContinuationNonFungibleTokenInfo
 * @property {Buffer} contents Another part of the non-fungible token contents
 */

/**
 * @typedef {(ContinuationNonFungibleTokenInfo|null)} ContinuationNonFungibleTokenInfoEntry
 */

/**
 * Continuation data for creating a non-fungible asset and/or issuing its non-fungible tokens
 * @typedef {Object} IssueNFAssetContinuationData
 * @property {string} [assetId] ID of the non-fungible asset to reissue
 * @property {string} continuationToken ID that identifies the ongoing non-fungible asset issuance operation
 * @property {ContinuationNonFungibleTokenInfoEntry[]} [nfTokenInfos] List with additional contents data for the
 *                                                                     non-fungible tokens
 * @property {boolean} isFinal Indicates whether this is the final call for the ongoing non-fungible asset issuance
 *                              operation
 */

/**
 * Create a non-fungible asset and/or issue its non-fungible tokens
 * @param {IssueNFAssetInitialData} [initialData] Initial data for creating a non-fungible asset and/or issuing its
 *                                                 non-fungible tokens
 * @param {IssueNFAssetContinuationData} [continuationData] Continuation data for creating a non-fungible asset and/or
 *                                                           issuing its non-fungible tokens
 * @returns {NFAssetIssuanceResult}
 */
Device.prototype.issueNonFungibleAsset = function (initialData, continuationData) {
    // Make sure that device is not deleted
    if (this.status === Device.status.deleted.name) {
        // Cannot issue non-fungible asset from a deleted device. Log error and throw exception
        Catenis.logger.ERROR('Cannot issue non-fungible asset from a deleted device', {deviceId: this.deviceId});
        throw new Meteor.Error('ctn_device_deleted', `Cannot issue non-fungible asset from a deleted device (deviceId: ${this.deviceId})`);
    }

    // Make sure that device is active
    if (this.status !== Device.status.active.name) {
        // Cannot issue non-fungible asset from a device that is not active. Log error and throw exception
        Catenis.logger.ERROR('Cannot issue non-fungible asset from a device that is not active', {
            deviceId: this.deviceId}
        );
        throw new Meteor.Error('ctn_device_not_active', `Cannot issue non-fungible asset from a device that is not active (deviceId: ${this.deviceId})`);
    }

    let nfAssetIssuance;

    if (initialData) {
        // Initiating a new non-fungible asset issuance operation
        if (typeof initialData.assetPropsOrId === 'string') {
            // An asset ID was passed for asset reissuance. Validate asset

            // Make sure that asset exists. Note: it throws ctn_asset_not_found exception otherwise
            const asset = Asset.getAssetByAssetId(initialData.assetPropsOrId, true);

            // Make sure that this is a non-fungible asset
            if (!asset.isNonFungible) {
                Catenis.logger.ERROR('Inconsistent asset for reissuance; expected an non-fungible asset', {
                    assetId: asset.assetId
                });
                throw new Meteor.Error('ctn_issue_nf_asset_fungible', `Inconsistent asset for reissuance; expected an non-fungible asset (assetId: ${asset.assetId})`);
            }

            // Make sure that asset can be reissued
            if (asset.issuingType !== CCTransaction.issuingAssetType.unlocked) {
                Catenis.logger.ERROR('Trying to reissue a locked non-fungible asset', {
                    assetId: asset.assetId
                });
                throw new Meteor.Error('ctn_issue_nf_asset_reissue_locked', `Trying to reissue a locked non-fungible asset (assetId: ${asset.assetId})`);
            }

            // Make sure that the issuing device is the original issuing device
            if (asset.issuingDevice.deviceId !== this.deviceId) {
                Catenis.logger.ERROR('Device trying to reissue asset is not the same as the original issuing device', {
                    assetId: asset.assetId,
                    assetIssuingDeviceId: asset.issuingDevice.deviceId,
                    issuingDeviceId: this.deviceId
                });
                throw new Meteor.Error('ctn_issue_nf_asset_invalid_issuer', `Device (deviceId: ${this.deviceId}) trying to reissue non-fungible asset (assetId: ${asset.assetId}) is not the same as the original issuing device (deviceId: ${asset.issuingDevice.deviceId})`);
            }
        }

        // Validate devices that should hold the issued non-fungible tokens
        let holdingDeviceIds = initialData.holdingDeviceIds || this.deviceId;

        const validateHoldingDevice = holdingDeviceId => {
            let holdingDevice;

            if (holdingDeviceId !== this.deviceId) {
                try {
                    holdingDevice = Device.getDeviceByDeviceId(holdingDeviceId);

                    // Make sure that holding device is not deleted
                    if (holdingDevice.status === Device.status.deleted.name) {
                        // Cannot assign issued non-fungible tokens to a deleted device.
                        //  Log error and throw exception
                        Catenis.logger.ERROR('Cannot assign issued non-fungible tokens to a deleted device', {
                            deviceId: holdingDeviceId
                        });
                        //noinspection ExceptionCaughtLocallyJS
                        throw new Meteor.Error('ctn_issue_nf_asset_hold_dev_deleted', `Cannot assign issued non-fungible tokens to a deleted device (deviceId: ${holdingDeviceId})`);
                    }

                    // Make sure that holding device is active
                    if (holdingDevice.status !== Device.status.active.name) {
                        // Cannot assign issued non-fungible tokens to a device that is not active.
                        //  Log error condition and throw exception
                        Catenis.logger.ERROR('Cannot assign issued non-fungible tokens to a device that is not active', {
                            deviceId: holdingDeviceId
                        });
                        //noinspection ExceptionCaughtLocallyJS
                        throw new Meteor.Error('ctn_issue_nf_asset_hold_dev_not_active', `Cannot assign issued non-fungible tokens to a device that is not active (deviceId: ${holdingDeviceId})`);
                    }
                }
                catch (err) {
                    if ((err instanceof Meteor.Error) && err.error === 'ctn_device_not_found') {
                        // No holding device available with the given device ID.
                        //  Log error and throw exception
                        Catenis.logger.ERROR('Could not find holding device with the given device ID', {
                            deviceId: holdingDeviceId
                        });
                        throw new Meteor.Error('ctn_issue_nf_asset_hold_dev_not_found', `Could not find holding device with the given device ID (${holdingDeviceId})`);
                    }
                    else {
                        // Otherwise, just re-throws exception
                        throw err;
                    }
                }
            }
            else {
                holdingDevice = this;
            }

            // Make sure that device has permission to assign asset to be issued to holding device
            if (!holdingDevice.shouldAcceptAssetOf(this) || (holdingDevice.deviceId !== this.deviceId
                    && !holdingDevice.shouldAcceptAssetFrom(this))) {
                // Device has no permission rights to assign asset to be issued to holding device
                Catenis.logger.INFO('Device has no permission rights to assign non-fungible tokens to be issued to holding device', {
                    deviceId: this.deviceId,
                    holdingDeviceId: holdingDevice.deviceId
                });
                throw new Meteor.Error('ctn_device_no_permission', `Device has no permission rights to assign non-fungible tokens to be issued to holding device (deviceId: ${this.deviceId}, holdingDeviceId: ${holdingDevice.deviceId})`);
            }
        };

        if (Array.isArray(holdingDeviceIds)) {
            holdingDeviceIds.forEach(validateHoldingDevice);
        }
        else {
            validateHoldingDevice(holdingDeviceIds);
        }

        if (!initialData.isFinal) {
            // Check whether client can pay for service ahead of time to avoid that client wastes resources
            //  making various calls to pass all the non-fungible tokens' contents only to find out later that
            //  it cannot pay for it. Note, however, that a definitive check shall still be done once the
            //  issuance operation is finally executed

            // Execute code in critical section to avoid Colored Coins UTXOs concurrency
            CCFundSource.utxoCS.execute(() => {
                const servicePriceInfo = Service.issueNonFungibleAssetServicePrice(
                    Array.isArray(holdingDeviceIds) ? holdingDeviceIds.length : 1
                );

                if (this.client.billingMode === Client.billingMode.prePaid) {
                    // Make sure that client has enough service credits to pay for service
                    const serviceAccountBalance = this.client.serviceAccountBalance();

                    if (serviceAccountBalance < servicePriceInfo.finalServicePrice) {
                        // Client does not have enough credits to pay for service.
                        //  Log error condition and throw exception
                        Catenis.logger.ERROR('Client does not have enough credits to pay for issue non-fungible asset service', {
                            serviceAccountBalance,
                            servicePrice: servicePriceInfo.finalServicePrice
                        });
                        throw new Meteor.Error('ctn_device_low_service_acc_balance', 'Client does not have enough credits to pay for issue non-fungible asset service');
                    }
                }
            });
        }

        // Execute code in critical section to avoid database concurrency
        NFAssetIssuance.dbCS.execute(() => {
            // Instantiate a non-fungible asset issuance object for a new issuance operation
            nfAssetIssuance = new NFAssetIssuance(
                undefined,
                undefined,
                this.deviceId,
                initialData.assetPropsOrId,
                initialData.encryptNFTContents,
                holdingDeviceIds,
                initialData.nfTokenInfos,
                initialData.isFinal,
                initialData.asyncProc
            );
        });
    }
    else if (continuationData) {
        // Continuing an ongoing non-fungible asset issuance operation

        // Execute code in critical section to avoid database concurrency
        NFAssetIssuance.dbCS.execute(() => {
            // Get the corresponding non-fungible asset issuance object
            nfAssetIssuance = NFAssetIssuance.getNFAssetIssuanceByContinuationToken(
                continuationData.continuationToken,
                this.deviceId,
                continuationData.assetId
            );

            // Add the additional contents data for the non-fungible tokens being issued
            nfAssetIssuance.newNFTokenIssuingBatch(continuationData.nfTokenInfos, continuationData.isFinal);
        });
    }
    else {
        // Missing data for issuing non-fungible asset. Nothing to do
        Catenis.logger.WARN('Missing data for issuing non-fungible asset for device (deviceId: %s)', this.deviceId);
        throw new Error('Missing data for issuing non-fungible asset');
    }

    if (!nfAssetIssuance.isComplete) {
        // Issuance data not yet complete. Return continuation token so
        //  issuance operation can be continued
        return {
            continuationToken: nfAssetIssuance.continuationToken
        };
    }

    const doProcessing = () => {
        const result = {};
        let servicePaid = false;

        // Execute code in critical section to avoid Colored Coins UTXOs concurrency
        CCFundSource.utxoCS.execute(() => {
            // Execute code in critical section to avoid UTXOs concurrency
            FundSource.utxoCS.execute(() => {
                // Execute code in critical section to avoid concurrent spend service credit tasks
                spendServCredProcCS.execute(() => {
                    const servicePriceInfo = Service.issueNonFungibleAssetServicePrice(nfAssetIssuance.numberOfHoldingDevices);
                    let paymentProvisionInfo;

                    if (this.client.billingMode === Client.billingMode.prePaid) {
                        try {
                            paymentProvisionInfo = Catenis.spendServCredit.provisionPaymentForService(this.client, servicePriceInfo.finalServicePrice);
                        }
                        catch (err) {
                            if ((err instanceof Meteor.Error) && err.error === 'ctn_spend_serv_cred_utxo_alloc_error') {
                                // Unable to allocate service credits from client service account to pay for service.
                                //  Log error and throw exception
                                Catenis.logger.ERROR('Client does not have enough credits to pay for issue non-fungible asset service', {
                                    serviceAccountBalance: this.client.serviceAccountBalance(),
                                    servicePrice: servicePriceInfo.finalServicePrice
                                });
                                throw new Meteor.Error('ctn_device_low_service_acc_balance', 'Client does not have enough credits to pay for issue non-fungible asset service');
                            }
                            else {
                                // Error provisioning spend service credit transaction to pay for service.
                                //  Log error and throw exception
                                Catenis.logger.ERROR('Error provisioning spend service credit transaction to pay for issue non-fungible asset service.', err);
                                throw new Error('Error provisioning spend service credit transaction to pay for issue non-fungible asset service');
                            }
                        }
                    }
                    else if (this.client.billingMode === Client.billingMode.postPaid) {
                        // Not yet implemented
                        Catenis.logger.ERROR('Processing for postpaid billing mode not yet implemented');
                        throw new Error('Processing for postpaid billing mode not yet implemented');
                    }

                    let issueNFAssetTransact;

                    try {
                        // Prepare transaction to issue asset
                        issueNFAssetTransact = new IssueNFAssetTransaction(this, nfAssetIssuance);

                        // Build and send transaction
                        issueNFAssetTransact.buildTransaction();

                        issueNFAssetTransact.sendTransaction();

                        // Force polling of blockchain so newly sent transaction is received and processed right away
                        Catenis.txMonitor.pollNow();
                    }
                    catch (err) {
                        // Error issuing asset. Log error condition
                        Catenis.logger.ERROR('Error issuing asset.', err);

                        if (issueNFAssetTransact && !issueNFAssetTransact.txid) {
                            // Revert output addresses added to transaction
                            issueNFAssetTransact.revertOutputAddresses();
                        }

                        // Rethrows exception
                        throw err;
                    }

                    if (!nfAssetIssuance.isReissuance) {
                        result.assetId = issueNFAssetTransact.assetId;
                    }

                    result.nonFungibleTokenIds = issueNFAssetTransact.nfTokenIds;

                    try {
                        // Record billing info for service
                        const billing = Billing.createNew(this, issueNFAssetTransact, servicePriceInfo);

                        let servicePayTransact;

                        if (this.client.billingMode === Client.billingMode.prePaid) {
                            servicePayTransact = Catenis.spendServCredit.confirmPaymentForService(paymentProvisionInfo, issueNFAssetTransact.txid);
                        }
                        else if (this.client.billingMode === Client.billingMode.postPaid) {
                            // Not yet implemented
                            Catenis.logger.ERROR('Processing for postpaid billing mode not yet implemented');
                            // noinspection ExceptionCaughtLocallyJS
                            throw new Error('Processing for postpaid billing mode not yet implemented');
                        }

                        servicePaid = true;
                        billing.setServicePaymentTransaction(servicePayTransact);
                    }
                    catch (err) {
                        if ((err instanceof Meteor.Error) && err.error === 'ctn_spend_serv_cred_tx_rejected') {
                            // Spend service credit transaction has been rejected.
                            //  Log warning condition
                            Catenis.logger.WARN('Billing for issue asset service (serviceTxid: %s) recorded with no service payment transaction', issueNFAssetTransact.txid);
                        }
                        else {
                            // Error recording billing info for issue asset service.
                            //  Just log error condition
                            Catenis.logger.ERROR('Error recording billing info for issue asset service (serviceTxid: %s),', issueNFAssetTransact.txid, err);
                        }
                    }
                });
            });
        });

        if (servicePaid) {
            try {
                // Service successfully paid for. Check client service account balance now
                this.client.checkServiceAccountBalance();
            }
            catch (err) {
                // Log error
                Catenis.logger.ERROR('Error while checking for client service account balance.', err);
            }
        }

        return result;
    };

    if (nfAssetIssuance.asyncProc) {
        // Execute processing asynchronously
        Future.task(doProcessing).resolve((err, result) => {
            // Finalize issuance
            result = result || {};
            nfAssetIssuance.finalizeIssuanceProgress(err, result.nonFungibleTokenIds, result.assetId);

            try {
                // Send notification advising that non-fungible asset issuance has been finalized
                // noinspection JSUnusedAssignment
                this.notifyNFAssetIssuanceOutcome(nfAssetIssuance.assetIssuanceId, nfAssetIssuance.getIssuanceProgress());
            }
            catch (err) {
                // Error sending notification message. Log error
                Catenis.logger.ERROR('Error sending non-fungible asset issuance outcome notification event for device (doc_id: %s)', this.doc_id, err);
            }
        });

        // Return non-fungible asset issuance ID so its progress can be monitored
        return {
            assetIssuanceId: nfAssetIssuance.assetIssuanceId,
        }
    }
    else {
        // Execute processing immediately (synchronously)
        let result;
        let error;

        try {
            result = doProcessing();
        }
        catch (err) {
            error = err;
        }

        // Finalize issuance
        result = result || {};
        nfAssetIssuance.finalizeIssuanceProgress(error, result.nonFungibleTokenIds, result.assetId);

        if (error) {
            throw error;
        }

        // Return issuance result
        return result;
    }
}

/**
 * Retrieve information about the progress of a non-fungible asset issuance
 * @param {string} assetIssuanceId The ID of the non-fungible asset issuance
 * @returns {NonFungibleAssetIssuanceProgressInfo}
 */
Device.prototype.getNFAssetIssuanceProgress = function (assetIssuanceId) {
    // Make sure that device is not deleted
    if (this.status === Device.status.deleted.name) {
        // Cannot retrieve non-fungible asset issuance for a deleted device. Log error and throw exception
        Catenis.logger.ERROR('Cannot retrieve non-fungible asset issuance for a deleted device', {deviceId: this.deviceId});
        throw new Meteor.Error('ctn_device_deleted', `Cannot retrieve non-fungible asset issuance for a deleted device (deviceId: ${this.deviceId})`);
    }

    // Make sure that device is active
    if (this.status !== Device.status.active.name) {
        // Cannot retrieve non-fungible asset issuance for a device that is not active. Log error and throw exception
        Catenis.logger.ERROR('Cannot retrieve non-fungible asset issuance from a device that is not active', {
            deviceId: this.deviceId}
        );
        throw new Meteor.Error('ctn_device_not_active', `Cannot retrieve non-fungible asset issuance for a device that is not active (deviceId: ${this.deviceId})`);
    }

    const nfAssetIssuance = NFAssetIssuance.getNFAssetIssuanceByAssetIssuanceId(assetIssuanceId, this.deviceId);

    return nfAssetIssuance.getIssuanceProgress();
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
    let servicePaid = false;

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

                    servicePaid = true;
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

    if (servicePaid) {
        try {
            // Service successfully paid for. Check client service account balance now
            this.client.checkServiceAccountBalance();
        }
        catch (err) {
            // Log error
            Catenis.logger.ERROR('Error while checking for client service account balance.', err);
        }
    }

    // noinspection JSUnusedAssignment
    return remainingBalance;
};

/**
 * Export an asset to a foreign blockchain
 * @param {string} assetId The ID of the asset to export
 * @param {string} foreignBlockchain Name of the foreign blockchain
 * @param {Object} token
 * @param {string} token.name The name of the token to be created on the foreign blockchain
 * @param {string} token.symbol The symbol of the token to be created on the foreign blockchain
 * @param {Object} [options]
 * @param {string} [options.consumptionProfile] Name of foreign blockchain native coin consumption profile to use
 * @param {boolean} [options.estimateOnly] When set, indicates that no asset export should be executed but only the
 *                                          estimated price (in the foreign blockchain's native coin) to fulfill the
 *                                          operation should be returned
 * @return {(ExportedAssetOutcome|string)} Current outcome state of the asset export, or the estimated price (formatted
 *                                          as string value expressed in the foreign blockchain's native coin)
 */
Device.prototype.exportAsset = function (assetId, foreignBlockchain, token, options) {
    // Make sure that device is not deleted
    if (this.status === Device.status.deleted.name) {
        // Cannot export asset for a deleted device. Log error and throw exception
        Catenis.logger.DEBUG('Cannot export asset for a deleted device', {deviceId: this.deviceId});
        throw new Meteor.Error('ctn_device_deleted', `Cannot export asset for a deleted device (deviceId: ${this.deviceId})`);
    }

    // Make sure that device is active
    if (this.status !== Device.status.active.name) {
        // Cannot export asset for a device that is not active. Log error and throw exception
        Catenis.logger.DEBUG('Cannot export asset for a device that is not active', {deviceId: this.deviceId});
        throw new Meteor.Error('ctn_device_not_active', `Cannot export asset for a device that is not active (deviceId: ${this.deviceId})`);
    }

    options = options || {};

    // Get asset to export.
    //  Note: this will throw 'ctn_asset_not_found' if no asset with that asset ID can be found
    const asset = Asset.getAssetByAssetId(assetId, true);

    // Make sure that this asset has been issued by the current device
    if (asset.issuingDevice.deviceId !== this.deviceId) {
        // Device trying to export the asset is not the same as the device that issued the asset
        Catenis.logger.DEBUG('Device trying to export the asset is not the same as the device that issued the asset', {
            assetId,
            assetIssuingDeviceId: asset.issuingDevice.deviceId,
            deviceId: this.deviceId
        });
        throw new Meteor.Error('ctn_device_not_asset_issuer', `Device (deviceId: ${this.deviceId}) trying to export the asset (assetId: ${assetId}) is not the same as the device (deviceId: ${asset.issuingDevice.deviceId}) that issued the asset`);
    }

    // Instantiate asset export
    const expAsset = ExportedAsset.getExportedAsset(asset, foreignBlockchain, this);

    let consumptionProfile;

    if (options.consumptionProfile) {
        consumptionProfile = ForeignBlockchain.consumptionProfile[options.consumptionProfile];
    }

    // Note: this will throw 'ctn_exp_asset_already_exported' if asset is already exported
    return options.estimateOnly
        ? expAsset.estimateExportPrice(token.name, token.symbol, consumptionProfile, true).toString()
        : expAsset.export(token.name, token.symbol, consumptionProfile);
};

/**
 * Get the current outcome state of an exported asset
 * @param {string} assetId The ID of the exported asset
 * @param {string} foreignBlockchain Name of the foreign blockchain
 * @return {ExportedAssetOutcome} Current outcome state of asset export
 */
Device.prototype.getAssetExportOutcome = function (assetId, foreignBlockchain) {
    // Make sure that device is not deleted
    if (this.status === Device.status.deleted.name) {
        // Cannot get asset export outcome for a deleted device. Log error and throw exception
        Catenis.logger.DEBUG('Cannot get asset export outcome for a deleted device', {deviceId: this.deviceId});
        throw new Meteor.Error('ctn_device_deleted', `Cannot get asset export outcome for a deleted device (deviceId: ${this.deviceId})`);
    }

    // Make sure that device is active
    if (this.status !== Device.status.active.name) {
        // Cannot get asset export outcome for a device that is not active. Log error and throw exception
        Catenis.logger.DEBUG('Cannot get asset export outcome for a device that is not active', {deviceId: this.deviceId});
        throw new Meteor.Error('ctn_device_not_active', `Cannot get asset export outcome for a device that is not active (deviceId: ${this.deviceId})`);
    }

    // Get asset that was exported.
    //  Note: this will throw 'ctn_asset_not_found' if no asset with that asset ID can be found
    const asset = Asset.getAssetByAssetId(assetId, true);

    // Instantiate asset export.
    //  Note: this will throw 'ctn_exp_asset_not_found' if asset was not yet exported
    const expAsset = ExportedAsset.getExportedAsset(asset, foreignBlockchain);

    // Make sure that the asset has been exported by the current device
    if (expAsset.owningDevice.deviceId !== this.deviceId) {
        // Device trying to get asset export outcome is not the same as the device that exported the asset
        Catenis.logger.DEBUG('Device trying to get asset export outcome is not the same as the device that exported the asset', {
            assetId,
            foreignBlockchain,
            expAssetOwningDeviceId: expAsset.owningDevice.deviceId,
            deviceId: this.deviceId
        });
        throw new Meteor.Error('ctn_device_not_exp_asset_owner', `Device (deviceId: ${this.deviceId}) trying to get asset export (assetId: ${assetId}, foreignBlockchain: ${foreignBlockchain}) outcome is not the same as the device (deviceId: ${expAsset.owningDevice.deviceId}) that exported the asset`);
    }

    return expAsset.getOutcome();
};

/**
 * List assets exported by the current device, and adhering to the specified filtering criteria
 * @param {Object} [filter]
 * @param {string} [filter.assetId] ID of exported Asset
 * @param {string} [filter.foreignBlockchain] Name of foreign blockchain
 * @param {string} [filter.tokenSymbol] Symbol of exported asset's associated foreign token
 * @param {(string|string[])} [filter.status] A single status or a list of statuses to include
 * @param {boolean} [filter.negateStatus] Indicates whether the specified statuses should be excluded instead
 * @param {Date} [filter.startDate] Date and time specifying the lower bound of the time frame within which the
 *                                   asset has been exported
 * @param {Date} [filter.endDate] Date and time specifying the upper bound of the time frame within which the asset
 *                                 has been exported
 * @param {number} [limit] Maximum number of exported assets that should be returned
 * @param {number} [skip] Number of exported assets that should be skipped (from beginning of list of matching
 *                         exported assets) and not returned
 * @return {{exportedAssets: ExportedAssetOutcome[], hasMore: boolean}}
 */
Device.prototype.listExportedAssets = function (filter, limit, skip) {
    // Make sure that device is not deleted
    if (this.status === Device.status.deleted.name) {
        // Cannot list exported assets for a deleted device. Log error and throw exception
        Catenis.logger.DEBUG('Cannot list exported assets for a deleted device', {deviceId: this.deviceId});
        throw new Meteor.Error('ctn_device_deleted', `Cannot list exported assets for a deleted device (deviceId: ${this.deviceId})`);
    }

    // Make sure that device is active
    if (this.status !== Device.status.active.name) {
        // Cannot list exported assets for a device that is not active. Log error and throw exception
        Catenis.logger.DEBUG('Cannot list exported assets for a device that is not active', {deviceId: this.deviceId});
        throw new Meteor.Error('ctn_device_not_active', `Cannot list exported assets for a device that is not active (deviceId: ${this.deviceId})`);
    }

    return ExportedAsset.query(this.deviceId, filter, limit, skip);
};

/**
 * Migrate an amount of a previously exported asset to/from a foreign blockchain
 * @param {string} assetId The ID of the asset to migrate
 * @param {string} foreignBlockchain Name of the foreign blockchain
 * @param {(Object|string)} migration Object describing the asset migration to be performed, or the ID of an existing
 *                                     asset migration
 * @param {string} migration.direction The migration direction
 * @param {number} migration.amount The amount (expressed as a decimal number) of the asset to be migrated
 * @param {string} [migration.destAddress] The address of the account on the foreign blockchain that should receive
 *                                          the migrated amount (of the corresponding foreign token)
 * @param {Object} [options]
 * @param {string} [options.consumptionProfile] Name of foreign blockchain native coin consumption profile to use
 * @param {boolean} [options.estimateOnly] When set, indicates that no asset migration should be executed but only the
 *                                          estimated price (in the foreign blockchain's native coin) to fulfill the
 *                                          operation should be returned
 * @return {(AssetMigrationOutcome|string)} Current outcome state of the asset migration, or the estimated price
 *                                           (formatted as string value expressed in the foreign blockchain's native
 *                                           coin)
 */
Device.prototype.migrateAsset = function (assetId, foreignBlockchain, migration, options) {
    // Make sure that device is not deleted
    if (this.status === Device.status.deleted.name) {
        // Cannot migrate asset for a deleted device. Log error and throw exception
        Catenis.logger.DEBUG('Cannot migrate asset for a deleted device', {deviceId: this.deviceId});
        throw new Meteor.Error('ctn_device_deleted', `Cannot migrate asset for a deleted device (deviceId: ${this.deviceId})`);
    }

    // Make sure that device is active
    if (this.status !== Device.status.active.name) {
        // Cannot migrate asset for a device that is not active. Log error and throw exception
        Catenis.logger.DEBUG('Cannot migrate asset for a device that is not active', {deviceId: this.deviceId});
        throw new Meteor.Error('ctn_device_not_active', `Cannot migrate asset for a device that is not active (deviceId: ${this.deviceId})`);
    }

    // Get asset to migrate.
    //  Note: this will throw 'ctn_asset_not_found' if no asset with that asset ID can be found
    const asset = Asset.getAssetByAssetId(assetId, true);

    let assetMgr;

    if (typeof migration === 'string') {
        // Try to retrieve existing asset migration.
        //  Note: this will throw 'ctn_asset_mgr_not_found' if no asset migration with that migration ID can be found
        assetMgr = AssetMigration.getAssetMigrationByMigrationId(migration);

        // Make sure that this asset migration corresponds to the asset and foreign blockchain specified
        if (assetMgr.expAsset.asset.assetId !== assetId) {
            Catenis.logger.DEBUG(`Asset migration (migrationId: ${migration}) does not correspond to the specified asset (assetId: ${assetId})`);
            throw new Meteor.Error('ctn_device_mismatched_asset_migration', `Asset migration (migrationId: ${migration}) does not correspond to the specified asset (assetId: ${assetId})`);
        }

        if (assetMgr.expAsset.blockchainKey !== foreignBlockchain) {
            Catenis.logger.DEBUG(`Asset migration (migrationId: ${migration}) does not correspond to the specified foreign blockchain (${foreignBlockchain})`);
            throw new Meteor.Error('ctn_device_mismatched_asset_migration', `Asset migration (migrationId: ${migration}) does not correspond to the specified foreign blockchain (${foreignBlockchain})`);
        }
    }
    else {
        // Instantiate new asset migration.
        //  Note: this will throw 'ctn_exp_asset_not_found' if asset was not yet exported
        //        this will throw 'ctn_asset_mgr_not_exported' if asset is not yet (successfully) exported
        //        this will throw 'ctn_asset_mgr_amount_too_large' if asset to migrate is too large
        assetMgr = AssetMigration.newAssetMigration(
            migration.direction,
            asset,
            foreignBlockchain,
            this,
            migration.amount,
            migration.destAddress
        );
    }

    // Make sure that asset has been exported by the current device
    if (assetMgr.expAsset.owningDevice.deviceId !== this.deviceId) {
        // Device trying to migrate the asset is not the same as the device that exported the asset
        Catenis.logger.DEBUG('Device trying to migrate the asset is not the same as the device that exported the asset', {
            assetId,
            foreignBlockchain: assetMgr.expAsset.blockchainKey,
            expAssetOwningDevice: assetMgr.expAsset.owningDevice.deviceId,
            deviceId: this.deviceId
        });
        throw new Meteor.Error('ctn_device_not_exp_asset_owner', `Device (deviceId: ${this.deviceId}) trying to migrate the asset (assetId: ${assetId}, foreignBlockchain: ${assetMgr.expAsset.blockchainKey}) is not the same as the device (deviceId: ${assetMgr.expAsset.owningDevice.deviceId}) that exported the asset`);
    }

    options = options || {};

    let consumptionProfile;

    if (options.consumptionProfile) {
        consumptionProfile = ForeignBlockchain.consumptionProfile[options.consumptionProfile];
    }

    // Note: this will throw 'ctn_asset_mgr_already_migrated' if asset amount is already migrated
    return options.estimateOnly
        ? assetMgr.estimateMigrationPrice(consumptionProfile, true).toString()
        : assetMgr.migrate(consumptionProfile);
};

/**
 * Get the current outcome state of an exported asset
 * @param {string} migrationId The ID of the asset migration
 * @return {AssetMigrationOutcome} Current outcome state of asset migration
 */
Device.prototype.getAssetMigrationOutcome = function (migrationId) {
    // Make sure that device is not deleted
    if (this.status === Device.status.deleted.name) {
        // Cannot get asset migration outcome for a deleted device. Log error and throw exception
        Catenis.logger.DEBUG('Cannot get asset migration outcome for a deleted device', {deviceId: this.deviceId});
        throw new Meteor.Error('ctn_device_deleted', `Cannot get asset migration outcome for a deleted device (deviceId: ${this.deviceId})`);
    }

    // Make sure that device is active
    if (this.status !== Device.status.active.name) {
        // Cannot get asset migration outcome for a device that is not active. Log error and throw exception
        Catenis.logger.DEBUG('Cannot get asset migration outcome for a device that is not active', {deviceId: this.deviceId});
        throw new Meteor.Error('ctn_device_not_active', `Cannot get asset migration outcome for a device that is not active (deviceId: ${this.deviceId})`);
    }

    // Try to retrieve existing asset migration.
    //  Note: this will throw 'ctn_asset_mgr_not_found' if no asset migration with that migration ID can be found
    const assetMgr = AssetMigration.getAssetMigrationByMigrationId(migrationId);

    // Make sure that the asset has been migrated by the current device
    if (assetMgr.owningDevice.deviceId !== this.deviceId) {
        // Device trying to get asset migration outcome is not the same as the device that migrated the asset
        Catenis.logger.DEBUG('Device trying to get asset migration outcome is not the same as the device that migrated the asset', {
            migrationId,
            assetMgrOwningDeviceId: assetMgr.owningDevice.deviceId,
            deviceId: this.deviceId
        });
        throw new Meteor.Error('ctn_device_not_asset_mgr_owner', `Device (deviceId: ${this.deviceId}) trying to get asset migration (assetId: ${migrationId}) outcome is not the same as the device (deviceId: ${assetMgr.owningDevice.deviceId}) that migrated the asset`);
    }

    return assetMgr.getOutcome();
};

/**
 * List asset migrations done by the current device, and adhering to the specified filtering criteria
 * @param {Object} [filter]
 * @param {string} [filter.assetId] Asset ID
 * @param {string} [filter.foreignBlockchain] Name of foreign blockchain
 * @param {string} [filter.direction] The migration direction
 * @param {(string|string[])} [filter.status] A single status or a list of statuses to include
 * @param {boolean} [filter.negateStatus] Indicates whether the specified statuses should be excluded instead
 * @param {Date} [filter.startDate] Date and time specifying the lower bound of the time frame within which the
 *                                   asset amount has been migrated
 * @param {Date} [filter.endDate] Date and time specifying the upper bound of the time frame within which the asset
 *                                 amount has been migrated
 * @param {number} [limit] Maximum number of exported assets that should be returned
 * @param {number} [skip] Number of exported assets that should be skipped (from beginning of list of matching
 *                         exported assets) and not returned
 * @return {{assetMigrations: AssetMigrationOutcome[], hasMore: boolean}}
 */
Device.prototype.listAssetMigrations = function (filter, limit, skip) {
    // Make sure that device is not deleted
    if (this.status === Device.status.deleted.name) {
        // Cannot list asset migrations for a deleted device. Log error and throw exception
        Catenis.logger.DEBUG('Cannot list asset migrations for a deleted device', {deviceId: this.deviceId});
        throw new Meteor.Error('ctn_device_deleted', `Cannot list asset migrations for a deleted device (deviceId: ${this.deviceId})`);
    }

    // Make sure that device is active
    if (this.status !== Device.status.active.name) {
        // Cannot list asset migrations for a device that is not active. Log error and throw exception
        Catenis.logger.DEBUG('Cannot list asset migrations for a device that is not active', {deviceId: this.deviceId});
        throw new Meteor.Error('ctn_device_not_active', `Cannot list asset migrations for a device that is not active (deviceId: ${this.deviceId})`);
    }

    return AssetMigration.query(this.deviceId, filter, limit, skip);
}

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
    let pubProps = {};

    if (this.props.name) {
        pubProps.name = this.props.name;
    }

    if (this.props.prodUniqueId) {
        pubProps.prodUniqueId = this.props.prodUniqueId;
    }

    const clientPubProps = this.client.getPublicProps();

    if (clientPubProps) {
        pubProps.ownedBy = clientPubProps;
    }

    return pubProps;
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

Device.prototype.notifyAssetExportOutcome = function (outcome) {
    // Dispatch notification message
    Catenis.notification.dispatchNotifyMessage(this.deviceId, Notification.event.asset_export_outcome.name, JSON.stringify(outcome));
};

Device.prototype.notifyAssetMigrationOutcome = function (outcome) {
    // Dispatch notification message
    Catenis.notification.dispatchNotifyMessage(this.deviceId, Notification.event.asset_migration_outcome.name, JSON.stringify(outcome));
};

/**
 * Issue a notification advising that a non-fungible asset issuance has been finalized
 * @param {string} assetIssuanceId The non-fungible asset issuance ID
 * @param {NonFungibleAssetIssuanceProgressInfo} issuanceProgress The final non-fungible asset issuance progress
 */
Device.prototype.notifyNFAssetIssuanceOutcome = function (assetIssuanceId, issuanceProgress) {
    // Dispatch notification message
    Catenis.notification.dispatchNotifyMessage(this.deviceId, Notification.event.nf_asset_issuance_outcome.name, JSON.stringify({
        assetIssuanceId,
        ...issuanceProgress
    }));
}
/** End of notification related methods **/

/** Asset related methods **/
Device.prototype.getAssetIssuanceAddressesInUseExcludeUnlocked = function () {
    const unlockedAssetIssueAddrs = this.getUnlockedAssetIssuanceAddresses();

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

// Return list of device asset issuance addresses allocated to unlocked assets
Device.prototype.getUnlockedAssetIssuanceAddresses = function () {
    return Catenis.db.collection.Asset.find({
        type: Asset.type.device,
        issuingType: CCTransaction.issuingAssetType.unlocked,
        'issuance.entityId': this.deviceId
    }, {
        fields: {
            'issuance.addrPath': 1
        }
    }).map((doc) => {
        const addrInfo = Catenis.keyStore.getAddressInfoByPath(doc.issuance.addrPath, true);

        return addrInfo !== null ? addrInfo.cryptoKeys.getAddress() : undefined;
    }).filter(addr => addr !== undefined);
};

// Retrieve the current balance of a given asset held by this device
//
//  Arguments:
//    asset: [Object(Asset)|String] - An object of type Asset or the asset ID
//    convertAmount: [Boolean] - Indicate whether balance amount should be converted from a fractional amount to an
//                                integer number of the asset's smallest division (according to the asset divisibility)
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

// Retrieve the current migrated balance (held in custody) of a given asset
//
//  Arguments:
//    asset: [Object(Asset)|String] - An object of type Asset or the asset ID
//    convertAmount: [Boolean] - Indicate whether balance amount should be converted from a fractional amount to an
//                                integer number of the asset's smallest division (according to the asset divisibility)
//
//  Return:
//    balance: {
//      total: [Number], - Total asset balance represented as an integer number of the asset's smallest division (according to the asset divisibility)
//      unconfirmed: [Number] - The unconfirmed asset balance represented as an integer number of the asset's smallest division (according to the asset divisibility)
//    }
Device.prototype.migratedAssetBalance = function (asset, convertAmount = true) {
    if (typeof asset === 'string') {
        // Asset ID passed instead, so to retrieve asset
        asset = Asset.getAssetByAssetId(asset, true);
    }

    const balance = Catenis.c3NodeClient.getAssetBalance(asset.ccAssetId, this.migratedAssetAddr.listAddressesInUse());

    if (balance !== undefined) {
        if (convertAmount) {
            // Convert amounts into asset's smallest division
            balance.total = asset.amountToSmallestDivisionAmount(balance.total);
            balance.unconfirmed = asset.amountToSmallestDivisionAmount(balance.unconfirmed);
        }
    }
    else {
        // Unable to retrieve Colored Coins asset balance. Log error condition and throw exception
        Catenis.logger.ERROR('Unable to retrieve Colored Coins asset balance for migrated asset', {
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
//   limit: [Number] - (default: 'maxQueryIssuanceCount') Maximum number of asset issuance events that should be returned
//   skip: [Number] - (default: 0) Number of asset issuance events that should be skipped (from beginning of list of matching events) and not returned
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
//     hasMore: [Boolean] - Indicates whether there are more asset issuance events that satisfy the search criteria yet to be returned
//   }
Device.prototype.retrieveAssetIssuanceHistory = function (assetId, startDate, endDate, limit, skip) {
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
    let hasMore = false;

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

        if (!Number.isInteger(limit) || limit <= 0 || limit > assetCfgSetting.maxQueryIssuanceCount) {
            limit = assetCfgSetting.maxQueryIssuanceCount;
        }

        if (!Number.isInteger(skip) || skip < 0) {
            skip = 0;
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
            skip: skip,
            limit: limit + 1
        }).fetch().forEach((doc, idx) => {
            if (idx < limit) {
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
            else {
                hasMore = true;
            }
        });
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
        hasMore: hasMore
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
//       holder: {      - (optional; not returned for the special entry reporting the migrated asset amount)
//         deviceId: [String]   - ID of device that holds an amount of the asset
//         name: [String],        - (optional) The name of the device
//         prodUniqueId: [String] - (optional) The product unique ID of the device
//       },
//       migrated: true,          - (optional) Indicates that this is the special entry reporting the migrated asset amount
//       balance: {
//         total: [Number],      - The current balance of that asset held by this device or that had been migrated,
//                                  expressed as a decimal number
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
    let migratedBalance;

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
            else if (addrInfo !== null && addrInfo.type === KeyStore.extKeyType.dev_migr_asst_addr.name) {
                // This is actually an amount that had been migrated. So report it separately
                if (!migratedBalance) {
                    // noinspection JSUnresolvedVariable
                    migratedBalance = {
                        total: new BigNumber(assetBalance.totalBalance),
                        unconfirmed: new BigNumber(assetBalance.unconfirmedBalance)
                    };
                }
                else {
                    // noinspection JSUnresolvedVariable
                    migratedBalance.total = migratedBalance.total.plus(assetBalance.totalBalance);
                    // noinspection JSUnresolvedVariable
                    migratedBalance.unconfirmed = migratedBalance.unconfirmed.plus(assetBalance.unconfirmedBalance);
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
    if (deviceAssetHolder.size > 0 || migratedBalance) {
        deviceAssetHolder.forEach((assetHolder) => {
            // Convert balance amount to number
            assetHolder.balance.total = assetHolder.balance.total.toNumber();
            assetHolder.balance.unconfirmed = assetHolder.balance.unconfirmed.toNumber();

            result.assetHolders.push(assetHolder);
        });

        result.hasMore = discardedDevices.size > 0;

        if (migratedBalance) {
            if (deviceAssetHolder.size < limit) {
                // Add special entry with the asset amount that had been migrated
                result.assetHolders.push({
                    migrated: true,
                    balance: {
                        total: migratedBalance.total.toNumber(),
                        unconfirmed: migratedBalance.unconfirmed.toNumber()
                    }
                });
            }
            else {
                // Special entry will not fit. So make sure that it indicates
                //  that some entries were left out
                result.hasMore = true;
            }
        }
    }

    return result;
};
/** End of asset related methods **/


// Module functions used to simulate private Device object methods
//  NOTE: these functions need to be bound to a Device object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

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
            fundTransact.addMultipleAddressesPayees(this.assetIssuanceAddr.type, Object.keys(unlockedAssetIssueAddressAmount), Object.values(unlockedAssetIssueAddressAmount));
        }

        if (fundTransact.addPayingSource()) {
            // Now, issue (create and send) the transaction
            return fundTransact.sendTransaction();
        }
        else {
            // Could not allocate UTXOs to pay for transaction fee.
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

function getMessageInfo(message, msgTransport) {
    const msgInfo = {
        action: message.action
    };

    if (message.action === Message.action.log) {
        // Logged message
        const originDevice = msgTransport.device;

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
        const originDevice = msgTransport.originDevice;
        const targetDevice = msgTransport.targetDevice;

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
