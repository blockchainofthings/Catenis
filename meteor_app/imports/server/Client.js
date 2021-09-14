/**
 * Created by Claudio on 2016-06-22.
 */

//console.log('[Client.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import util from 'util';
import crypto from 'crypto';
// Third-party node modules
import config from 'config';
import _und from 'underscore';     // NOTE: we dot not use the underscore library provided by Meteor because we nee
                                   //        a feature (_und.omit(obj,predicate)) that is not available in that version
import moment from 'moment-timezone';
import BigNumber from 'bignumber.js';
// Meteor packages
import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';
import { Accounts } from 'meteor/accounts-base';
import { Roles } from 'meteor/alanning:roles';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { ClientShared } from '../both/ClientShared';
import { CriticalSection } from './CriticalSection';
import {
    ClientServiceAccountCreditLineAddress,
    ClientServiceAccountDebitLineAddress,
    ClientBcotPaymentAddress
} from './BlockchainAddress';
import { CatenisNode } from './CatenisNode';
import { Device } from './Device';
import { FundSource } from './FundSource';
import { Permission } from './Permission';
import { CCFundSource } from './CCFundSource';
import { ClientLicense } from './ClientLicense';
import { License } from './License';
import { Util } from './Util';
import { KeyStore } from './KeyStore';
import { BcotSaleAllocation } from './BcotSaleAllocation';
import { RedeemBcotTransaction } from './RedeemBcotTransaction';
import { ServiceAccount } from './ServiceAccount';
import { ClientOwnedDomain } from './ClientOwnedDomain';
import { StandbyPurchasedBcot } from './StandbyPurchasedBcot';
import { AdminEmailNotify } from './AdminEmailNotify';
import { ForeignBlockchain } from './ForeignBlockchain';
import { Service } from './Service';
import { Billing } from './Billing';

// Config entries
const clientConfig = config.get('client');

// Configuration settings
export const cfgSettings = {
    firstAccountNumber: clientConfig.get('firstAccountNumber'),
    userNamePrefix: clientConfig.get('userNamePrefix'),
    clientRole: clientConfig.get('clientRole'),
    minLicenseValidityDays: clientConfig.get('minLicenseValidityDays'),
    minLicenseValDaysToReplace: clientConfig.get('minLicenseValDaysToReplace'),
    temporaryLicense: {
        "active": clientConfig.get('temporaryLicense.active'),
        "level": clientConfig.get('temporaryLicense.level'),
        "type": clientConfig.get('temporaryLicense.type')
    },
    creditsConsumption: {
        pastConsumptionPeriod: clientConfig.get('creditsConsumption.pastConsumptionPeriod'),
        minimumBalanceMultiplyFactor: clientConfig.get('creditsConsumption.minimumBalanceMultiplyFactor'),
        balanceFloorMultiplyFactor: clientConfig.get('creditsConsumption.balanceFloorMultiplyFactor'),
        timeToLowBalanceRenotification: clientConfig.get('creditsConsumption.timeToLowBalanceRenotification'),
        servAccBalanceInfoUIRefreshTimeout: clientConfig.get('creditsConsumption.servAccBalanceInfoUIRefreshTimeout')
    },
    deviceDefaultRightsByEvent: clientConfig.get('deviceDefaultRightsByEvent')
};

const accNumberRegEx = /^[A-Z]-(\d{8})$/;
const defaultForeignBlockchainConsumptionProfile = ForeignBlockchain.consumptionProfile.average;


// Definition of function classes
//

// Client function class
//
//  Constructor arguments:
//    docClient: [Object] - Client database doc/rec
//    ctnNode: [Object] - instance of CatenisNode function class with which client is associated
//    initializeDevices: [boolean] - (optional) indicates whether devices associated with this client
//                              should also be initialized. Defaults to false
//    noClientLicense [Boolean] - (optional, default:false) If set, indicates that client license for this client should
//                                 not be instantiated
export function Client(docClient, ctnNode, initializeDevices, noClientLicense = false) {
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
    this.props = docClient.props;
    this.apiAccessGenKey = docClient.apiAccessGenKey;
    this.ownedDomain = new ClientOwnedDomain(this);
    this.timeZone = docClient.timeZone && moment.tz.zone(docClient.timeZone) ? docClient.timeZone : moment.tz.guess();
    this.billingMode = docClient.billingMode;
    this.status = docClient.status;
    this.lastStatusChangedDate = docClient.lastStatusChangedDate;
    /**
     * @type {{emailSentDate: Date?, uiDismissDate: Date?}}
     */
    this.lowServAccBalanceNotify = docClient.lowServAccBalanceNotify || {};

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
                // noinspection JSPotentiallyInvalidUsageOfThis
                return crypto.createHmac('sha512', this.apiAccessGenKey).update('And here it is: the Catenis API key for client' + this.clientId).digest('hex');
            }
        },
        userAccountUsername: {
            get: function () {
                if (!this._user) {
                    getUser.call(this);
                }

                if (this._user) {
                    return this._user.username;
                }
            },
            enumerate: true
        },
        userAccountEmail: {
            get: function () {
                if (!this._user) {
                    getUser.call(this);
                }

                if (this._user && this._user.emails && this._user.emails.length > 0) {
                    let emailIdx = 0;

                    if (this._user.emails.length > 1) {
                        // Has more than one e-mail address associated with it.
                        //  Try to get first one that has already been verified
                        emailIdx = this._user.emails.findIndex((email) => {
                            return email.verified;
                        });

                        if (emailIdx < 0) {
                            emailIdx = 0;
                        }
                    }

                    return this._user.emails[emailIdx].address;
                }
            },
            enumerate: true
        },
        maximumAllowedDevices: {
            get: function () {
                // noinspection JSPotentiallyInvalidUsageOfThis
                return this.clientLicense && this.clientLicense.hasLicense() ? this.clientLicense.license.maximumDevices
                    : (this.clientLicense ? 0 : undefined);
            },
            enumerate: true
        },
        isNew: {
            get: function () {
                // noinspection JSPotentiallyInvalidUsageOfThis
                return this.status === Client.status.new.name;
            },
            enumerable: true
        },
        isActive: {
            get: function () {
                // noinspection JSPotentiallyInvalidUsageOfThis
                return this.status === Client.status.active.name;
            },
            enumerable: true
        },
        isDeleted: {
            get: function () {
                // noinspection JSPotentiallyInvalidUsageOfThis
                return this.status === Client.status.deleted.name;
            },
            enumerable: true
        },
        firstPrepaidActivityDate: {
            get: function () {
                // noinspection JSPotentiallyInvalidUsageOfThis
                const docs = Catenis.db.collection.Billing.find({
                    type: Billing.docType.original.name,
                    clientId: this.clientId,
                    billingMode: Client.billingMode.prePaid
                }, {
                    fields: {
                        createdDate: 1
                    },
                    sort: {
                        createdDate: 1
                    },
                    limit: 1
                }).fetch();

                return docs.length > 0 ? docs[0].createdDate : undefined;
            },
            enumerable: true
        }
    });

    loadForeignBlockchainConsumptionProfile.call(this, docClient);

    // Instantiate objects to manage blockchain addresses for client
    this.servAccCreditLineAddr = new ClientServiceAccountCreditLineAddress(this.ctnNode.ctnNodeIndex, this.clientIndex);
    this.servAccDebitLineAddr = new ClientServiceAccountDebitLineAddress(this.ctnNode.ctnNodeIndex, this.clientIndex);
    this.bcotPaymentAddr = new ClientBcotPaymentAddress(this.ctnNode.ctnNodeIndex, this.clientIndex);

    // Retrieve (HD node) index of last Device doc/rec created for this client
    const docDevice = Catenis.db.collection.Device.findOne({client_id: this.doc_id}, {fields: {'index.deviceIndex': 1}, sort: {'index.deviceIndex': -1}});

    this.lastDeviceIndex = docDevice !== undefined ? docDevice.index.deviceIndex : 0;

    // Critical section object to avoid concurrent access to database at the
    //  client object level (when creating new devices for this client basically)
    this.clnDbCS = new CriticalSection();

    if (initializeDevices) {
        // Instantiate all (non-deleted) devices associated with this client so their
        //  associated addresses are loaded onto local key storage
        Catenis.db.collection.Device.find({client_id: this.doc_id, status: {$ne: Device.status.deleted.name}}).forEach((doc) => {
            // Instantiate Device object
            Catenis.logger.TRACE('About to initialize device', {deviceId: doc.deviceId});
            new Device(doc, this);
        });
    }

    if (!noClientLicense) {
        // Instantiate client license
        this.clientLicense = new ClientLicense(this);

        if (this.status === Client.status.active.name) {
            if (!this.clientLicense.hasLicense() && cfgSettings.temporaryLicense.active) {
                Catenis.logger.DEBUG('Provisioning temporary license for client (clientId: %s)', this.clientId, {
                    temporaryLicense: {
                        level: cfgSettings.temporaryLicense.level,
                        type: cfgSettings.temporaryLicense.type
                    }
                });
                // Provision temporary license
                this.clientLicense.provision(cfgSettings.temporaryLicense.level, cfgSettings.temporaryLicense.type);
            }
            else {
                this.conformNumberOfDevices();
            }
        }
    }
}


// Public Client object methods
//

Client.prototype.assignUser = function (user_id) {
    // Make sure that there is no user currently assigned to this client
    if (this.user_id === undefined) {
        // Make sure that user ID is valid
        const docUser = Meteor.users.findOne({_id: user_id}, {fields: {_id: 1, 'services.password': 1, 'catenis.client_id': 1}});

        if (docUser === undefined) {
            // ID passed is not from a valid user. Log error and throw exception
            Catenis.logger.ERROR('Invalid user ID for assigning to client', {userId: user_id});
            throw new Meteor.Error('ctn_client_invalid_user_id', util.format('Invalid user ID (%s) for assigning to client', user_id));
        }
        else if (Roles.userIsInRole(docUser._id, cfgSettings.clientRole)) {
            // Invalid user role
            Catenis.logger.ERROR('User does not have the expected role for it to be assigned to a client', {userId: user_id});
            throw new Meteor.Error('ctn_client_no_user_role', util.format('User (Id: %s) does not have the expected role for it to be assigned to a client', user_id));
        }
        else if (docUser.catenis !== undefined && docUser.catenis.client_id !== undefined) {
            // User already assigned to a client. Log error and throw exception
            Catenis.logger.ERROR('User already assigned to a client', {userId: user_id});
            throw new Meteor.Error('ctn_client_user_already_assigned', util.format('User (Id: %s) already assigned to a client', user_id));
        }

        const updtFields = {user_id: user_id},
            userCanLogin = docUser.services !== undefined && docUser.services.password !== undefined;

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

        try {
            // Update User doc/rec saving the ID of the client associated with it
            Meteor.users.update({_id: user_id}, {$set: {'catenis.client_id': this.doc_id}});
        }
        catch (err) {
            Catenis.logger.ERROR(util.format('Error updating user (Id: %s) associated with client (clientId: %s).', user_id, this.clientId), err);
            throw new Meteor.Error('ctn_client_update_user_error', util.format('Error updating user (Id: %s) associated with client (clientId: %s).', user_id, this.clientId), err.stack);
        }

        if (userCanLogin) {
            // Update local status
            this.status = Client.status.active.name;
        }

        // Execute code in critical section to avoid UTXOs concurrency
        FundSource.utxoCS.execute(() => {
            // Make sure that system service credit issuance is properly provisioned
            this.ctnNode.checkServiceCreditIssuanceProvision();

            // Make sure that system BCOT token sale stock is properly provisioned
            this.ctnNode.checkBcotSaleStockProvision();
        });
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

    if (this.status !== Client.status.active.name) {
        if (this.user_id !== undefined) {
            // Check if associated user can log in
            const docUser = Meteor.users.findOne({_id: this.user_id}, {fields: {_id: 1, 'services.password': 1}});

            if (docUser !== undefined && docUser.services !== undefined && docUser.services.password !== undefined) {
                // Activate client
                Catenis.db.collection.Client.update({_id: this.doc_id}, {
                    $set: {
                        status: Client.status.active.name,
                        lastStatusChangedDate: new Date(Date.now())
                    }
                });

                this.active = true;

                // Execute code in critical section to avoid UTXOs concurrency
                FundSource.utxoCS.execute(() => {
                    // Make sure that system service credit issuance is properly provisioned
                    this.ctnNode.checkServiceCreditIssuanceProvision();

                    // Make sure that system BCOT token sale stock is properly provisioned
                    this.ctnNode.checkBcotSaleStockProvision();
                });

                // Redeem any purchased BCOT tokens on standby
                Meteor.defer(redeemStandbyBcot.bind(this));

                // Notify system administrators that client account has been activated
                AdminEmailNotify.sendAsync(AdminEmailNotify.notifyMessage.clientAccountActivated, (err) => {
                    // Error sending notification message. Log error condition
                    Catenis.logger.ERROR('Error sending email to system administrators notifying that client account (clientId: %s) has been activated.', this.clientId, err);
                }, this);

                result = true;
            }
            else {
                // User assigned to client cannot log in. Log error
                //  and throw exception
                Catenis.logger.WARN('Trying to activate client the user of which cannot log in', {client: this});
                throw new Meteor.Error('ctn_client_user_no_login', 'Client\'s user cannot log in');
            }
        }
        else {
            // Client does not yet have a user assigned to it. Log error
            //  and throw exception
            Catenis.logger.WARN('Trying to activate client that has no user assigned to it', {client: this});
            throw new Meteor.Error('ctn_client_no_user', 'Client does not have a user assigned to it yet');
        }
    }
    else {
        // Client already active
        Catenis.logger.WARN('Trying to activate client that is already active', {client: this});
        result = true;
    }

    return result;
};

Client.prototype.renewApiAccessGenKey = function (resetAllDevicesToClientDefaultKey = false) {
    // Make sure that client is not deleted
    if (this.status !== Client.status.deleted.name &&
            Catenis.db.collection.Client.findOne({_id: this.doc_id, status: Client.status.deleted.name}, {fields:{_id:1}}) !== undefined) {
        // Client has been deleted. Update its status
        this.status = Client.status.deleted.name;
    }

    if (this.status === Client.status.deleted.name) {
        // Cannot renew shared API access generator key for deleted client. Log error and throw exception
        Catenis.logger.ERROR('Cannot renew shared API access generator key for deleted client', {clientId: this.clientId});
        throw new Meteor.Error('ctn_client_deleted', util.format('Cannot renew shared API access generator key for deleted client (clientId: %s)', this.clientId));
    }

    // Generate new key
    const key = Random.secret();
    const now = new Date(Date.now());

    try {
        Catenis.db.collection.Client.update({_id: this.doc_id}, {$set: {apiAccessGenKey: key, lastApiAccessGenKeyModifiedDate: now}});
    }
    catch (err) {
        Catenis.logger.ERROR('Error updating client shared API access generator key', err);
        throw new Meteor.Error('ctn_client_update_error', 'Error updating client shared API access generator key', err.stack);
    }

    if (resetAllDevicesToClientDefaultKey) {
        try {
            Catenis.db.collection.Device.update({
                client_id: this.doc_id,
                status: {$ne: Device.status.deleted.name},
                apiAccessGenKey: {$ne: null}
            }, {
                $set: {
                    apiAccessGenKey: null,
                    lastApiAccessGenKeyModifiedDate: now
                }
            }, {multi: true});
        }
        catch (err) {
            Catenis.logger.ERROR('Error resetting client\'s devices to use client shared API access generator key', err);
            throw new Meteor.Error('ctn_device_update_error', 'Error resetting client\'s devices to use client shared API access generator key', err.stack);
        }
    }

    // Update key locally
    this.apiAccessGenKey = key;
};

Client.prototype.delete = function (deletedDate) {
    if (this.status !== Client.status.deleted.name) {
        deletedDate = deletedDate !== undefined ? deletedDate : new Date(Date.now());

        // Iteratively deletes all devices associated with this client
        Catenis.db.collection.Device.find({
            client_id: this.doc_id,
            status: {$ne: Device.status.deleted.name}
        }, {fields: {'index.deviceId': 1}}).forEach(doc => {
            this.getDeviceByIndex(doc.index.deviceIndex).delete(deletedDate);
        });

        // Retrieve current state of fields that shall be changed
        const docClient = Catenis.db.collection.Client.findOne({_id: this.doc_id}, {fields: {'user_id': 1, status: 1}}),
            delField = {};

        if (docClient.user_id !== undefined) {
            delField.user_id = docClient.user_id;
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

        if (docClient.user_id) {
            try {
                // Delete user account associated with this client
                Meteor.users.remove({_id: docClient.user_id});
            }
            catch (err) {
                // Error deleting user account associated with deleted client. Log error and throw exception
                Catenis.logger.ERROR(util.format('Error deleting user account (user_id: %s) associated with deleted client.', docClient.user_id), err);
                throw new Meteor.Error('ctn_client_user_delete_error', util.format('Error deleting user account (user_id: %s) associated with deleted client', docClient.user_id), err.stack);
            }
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

Client.prototype.newBcotPaymentAddress = function () {
    return this.bcotPaymentAddr.newAddressKeys().getAddress();
};

Client.prototype.isValidBcotPaymentAddress = function (address, isAddrTypeAndPath = false) {
    const addrTypeAndPath = isAddrTypeAndPath ? address : Catenis.keyStore.getTypeAndPathByAddress(address);
    let addrPathParts;

    return addrTypeAndPath !== null && addrTypeAndPath.type === KeyStore.extKeyType.cln_bcot_pay_addr.name
            && (addrPathParts = KeyStore.getPathParts(addrTypeAndPath)).ctnNodeIndex === this.ctnNode.ctnNodeIndex
            && addrPathParts.clientIndex === this.clientIndex;
};

Client.prototype.assetExportAdminForeignBcAccount = function (blockchainKey) {
    return Catenis.foreignBlockchains.get(blockchainKey).client.privateKeyToAccount(
        '0x' + Catenis.keyStore.getClientAssetExportAdminAddressKeys(this.ctnNode.ctnNodeIndex, this.clientIndex)
        .getPrivateKey()
        .toString('hex')
    );
}

/**
 * Computes client's past credits consumption
 * @param {Date} [now] Date object to be used as current date and time
 * @return {(BigNumber|undefined)} The calculated past credits consumption
 */
Client.prototype.pastCreditsConsumption = function (now) {
    // Determine date range to be used
    now = now || new Date();
    let startDate = new Date(now);
    startDate.setSeconds(now.getSeconds() - cfgSettings.creditsConsumption.pastConsumptionPeriod);

    let firstPrepaidActivityDate = this.firstPrepaidActivityDate;

    if (!firstPrepaidActivityDate) {
        startDate = now;
    }
    else if (startDate < firstPrepaidActivityDate) {
        startDate = firstPrepaidActivityDate;
        // Make sure that this date in included in the range
        startDate.setMilliseconds(startDate.getMilliseconds() - 1);
    }

    const dateRange = {
        startDate,
        endDate: now
    };

    if (dateRange.endDate > dateRange.startDate) {
        return Catenis.db.collection.Billing.find({
            type: Billing.docType.original.name,
            clientId: this.clientId,
            billingMode: Client.billingMode.prePaid,
            $and: [
                {
                    createdDate: {
                        $gt: dateRange.startDate
                    }
                },
                {
                    createdDate: {
                        $lte: dateRange.endDate
                    }
                }
            ]
        }, {
            fields: {
                _id: 1,
                clientId: 1,
                finalServicePrice: 1,
                createdDate: 1
            }
        })
        .fetch()
        .reduce((total, doc)=> {
            return total.plus(doc.finalServicePrice)
        }, new BigNumber(0));
    }
};

/**
 * Returns the minimum expected balance for the client's service account
 * @param {Date} [now] Date object to be used as current date and time
 * @return {BigNumber} Expected minimum balance amount for client's service account
 */
Client.prototype.minimumServiceAccountBalance = function (now) {
    const pastConsumption = this.pastCreditsConsumption(now);
    Catenis.logger.DEBUG('>>>>>> Computed client\'s past credits consumption:', pastConsumption ? Util.formatCatenisServiceCredits(pastConsumption) : pastConsumption);

    let minBalance = pastConsumption
        ? pastConsumption.times(cfgSettings.creditsConsumption.minimumBalanceMultiplyFactor)
        .dp(Catenis.ctnHubNode.serviceCreditAssetInfo().issuingOpts.divisibility, BigNumber.ROUND_HALF_EVEN)
        : new BigNumber(0);

    // Make sure that calculated minimum balance is not below defined balance floor value
    // noinspection JSCheckFunctionSignatures
    const balanceFloor = new BigNumber(Service.highestServicePrice)
        .times(cfgSettings.creditsConsumption.balanceFloorMultiplyFactor)
        .dp(Catenis.ctnHubNode.serviceCreditAssetInfo().issuingOpts.divisibility, BigNumber.ROUND_HALF_EVEN);

    return minBalance.comparedTo(balanceFloor) < 0 ? balanceFloor : minBalance;
};

/**
 * Update client's lowServAccBalanceNotify property with current value from database
 */
Client.prototype.refreshLowServAccBalanceNotify = function () {
    const docClient = Catenis.db.collection.Client.findOne({
        _id: this.doc_id
    }, {
        fields: {
            lowServAccBalanceNotify: 1
        }
    });

    if (docClient) {
        this.lowServAccBalanceNotify = docClient.lowServAccBalanceNotify || {};
    }
}

/**
 * Update the date when low service account balance e-mail notification has last been sent
 * @param {Date} [date] New value for the e-mail notification sent date
 */
Client.prototype.resetLowServAccBalanceNotifyEmailSentDate = function (date) {
    if (date === undefined) {
        date = new Date();
    }

    try {
        Catenis.db.collection.Client.update({
            _id: this.doc_id,
        }, {
            $set: {
                'lowServAccBalanceNotify.emailSentDate': date
            }
        });
    }
    catch (err) {
        // Error updating Client doc/rec. Log error and throw exception
        Catenis.logger.ERROR(util.format('Error trying to update client (doc_id: %s) to reset low service account balance e-mail notification sent date.', this.doc_id), err);
        throw new Meteor.Error('ctn_client_update_error', util.format('Error trying to update client (doc_id: %s) to reset low service account balance e-mail notification sent date', this.doc_id), err.stack);
    }

    // Update local property too
    this.lowServAccBalanceNotify.emailSentDate = date;
};

/**
 * Clear the date when low service account balance e-mail notification has last been sent
 *  so a new e-mail notification can be sent any time
 */
Client.prototype.clearLowServAccBalanceNotifyEmailSentDate = function () {
    this.resetLowServAccBalanceNotifyEmailSentDate(null);
}

/**
 * Update the date when low service account balance UI notification message has last been dismissed
 * @param {Date} [date] New value for the UI notification dismiss date
 */
Client.prototype.resetLowServAccBalanceNotifyUIDismissDate = function (date) {
    if (date === undefined) {
        date = new Date();
    }

    try {
        Catenis.db.collection.Client.update({
            _id: this.doc_id,
        }, {
            $set: {
                'lowServAccBalanceNotify.uiDismissDate': date
            }
        });
    }
    catch (err) {
        // Error updating Client doc/rec. Log error and throw exception
        Catenis.logger.ERROR(util.format('Error trying to update client (doc_id: %s) to reset low service account balance UI notification dismiss date.', this.doc_id), err);
        throw new Meteor.Error('ctn_client_update_error', util.format('Error trying to update client (doc_id: %s) to reset low service account balance UI notification dismiss date', this.doc_id), err.stack);
    }

    // Update local property too
    this.lowServAccBalanceNotify.uiDismissDate = date;
};

/**
 * Clear the date when low service account balance UI notification message has last been dismissed
 *  so the notification message can be displayed again
 */
Client.prototype.clearLowServAccBalanceNotifyUIDismissDate = function () {
    this.resetLowServAccBalanceNotifyUIDismissDate(null);
}

/**
 * @typedef {Object} ClientServAccBalance
 * @property {BigNumber} currentBalance
 * @property {BigNumber} minimumBalance
 * @property {boolean} isLowBalance
 * @property {boolean} canSendNotifyEmail
 * @property {boolean} canDisplayUINotify
 */

/**
 * Check the current state of the client service account balance
 * @param {boolean} [sendNotification=true] Indicates that low balance notification e-mail should be sent (in case of low balance)
 * @param {Date} [now] Date object to be used as current date and time
 * @return {ClientServAccBalance} The current state of the client service account balance
 */
Client.prototype.checkServiceAccountBalance = function (sendNotification = true, now) {
    now = now || new Date();

    const currentBalance = new BigNumber(this.serviceAccountBalance());
    const minimumBalance = this.minimumServiceAccountBalance(now);
    let isLowBalance = false;
    let canSendNotifyEmail = false;
    let canDisplayUINotify = false;

    if (currentBalance.comparedTo(minimumBalance) < 0) {
        // Balance too low
        isLowBalance = true;

        // Check if notification e-mail should be sent now
        if (!this.lowServAccBalanceNotify.emailSentDate) {
            canSendNotifyEmail = true;
        }
        else {
            const latestAllowedSentDate = new Date();
            latestAllowedSentDate.setHours(latestAllowedSentDate.getHours() - cfgSettings.creditsConsumption.timeToLowBalanceRenotification);
            Catenis.logger.DEBUG('>>>>>> Low service account balance e-mail notification:', {
                latestAllowedSentDate,
                lastSendDate: this.lowServAccBalanceNotify.emailSentDate,
            });

            canSendNotifyEmail = this.lowServAccBalanceNotify.emailSentDate <= latestAllowedSentDate;
        }

        if (canSendNotifyEmail && sendNotification) {
            // Send notification e-mail
            Catenis.lowServAccBalanceEmailNtfy.sendAsync(this, (err) => {
                if (err) {
                    Catenis.logger.ERROR('Error sending notification e-mail to warn client of low service account balance.', err);
                }
                else {
                    // Notification e-mail successfully sent. Update sent date
                    try {
                        this.resetLowServAccBalanceNotifyEmailSentDate();
                    }
                    catch (e) {}
                }
            });
        }

        // Check if UI notification message should be displayed
        if (!this.lowServAccBalanceNotify.uiDismissDate) {
            canDisplayUINotify = true;
        }
        else {
            const latestAllowedDismissDate = new Date();
            latestAllowedDismissDate.setHours(latestAllowedDismissDate.getHours() - cfgSettings.creditsConsumption.timeToLowBalanceRenotification);
            Catenis.logger.DEBUG('>>>>>> Low service account balance UI notification message:', {
                latestAllowedDismissDate,
                lastDismissDate: this.lowServAccBalanceNotify.uiDismissDate,
            });

            canDisplayUINotify = this.lowServAccBalanceNotify.uiDismissDate <= latestAllowedDismissDate;
        }
    }

    Catenis.logger.DEBUG('>>>>>> Client service account balance:', {
        currentBalance,
        minimumBalance,
        isLowBalance,
        canSendNotifyEmail,
        canDisplayUINotify
    });
    return {
        currentBalance,
        minimumBalance,
        isLowBalance,
        canSendNotifyEmail,
        canDisplayUINotify
    };
};

// Returns current balance of client's service account
//
//  Arguments:
//   credFundSource: [Object(CCFundSource)] - (optional) Instance of CCFundSource containing UTXOs associated with client's service account credit addresses
//   debtFundSource: [Object(CCFundSource)] - (optional) Instance of CCFundSource containing UTXOs associated with client's service account debit addresses
//
//  Return:
//   balance: [Number] - Amount, in Catenis service credit lowest unit, corresponding to the current balance
Client.prototype.serviceAccountBalance = function (credFundSource, debtFundSource) {
    const servCredAsset = this.ctnNode.getServiceCreditAsset();

    let balance = 0;

    if (servCredAsset !== undefined) {
        if (credFundSource === undefined) {
            credFundSource = new CCFundSource(servCredAsset.ccAssetId, this.servAccCreditLineAddr.listAddressesInUse(), {useUnconfirmedUtxo: true});
        }

        balance = credFundSource.getBalance();

        if (debtFundSource === undefined) {
            debtFundSource = new CCFundSource(servCredAsset.ccAssetId, this.servAccDebitLineAddr.listAddressesInUse(), {useUnconfirmedUtxo: true})
        }

        balance -= debtFundSource.getBalance();
    }

    return balance;
};

Client.prototype.listDevices = function (includeDeleted = true) {
    // Retrieve Device docs/recs associated with this client
    const query = {
        client_id: this.doc_id
    };

    if (!includeDeleted) {
        query.status = {
            $ne: Device.status.deleted.name
        };
    }

    return Catenis.db.collection.Device.find(query).map(doc => new Device(doc, this));
};

Client.prototype.getDeviceByIndex = function (deviceIndex, includeDeleted = true) {
    // Retrieve Device doc/rec
    const query = {
        'index.ctnNodeIndex': this.ctnNode.ctnNodeIndex,
        'index.clientIndex': this.clientIndex,
        'index.deviceIndex': deviceIndex
    };

    if (!includeDeleted) {
        query.status = {$ne: Client.status.deleted.name};
    }

    const docDevice = Catenis.db.collection.Device.findOne(query);

    if (docDevice === undefined) {
        // No device available with the given index. Log error and throw exception
        Catenis.logger.ERROR(util.format('Could not find device with given index for this client (clientId: %s)', this.clientId), {deviceIndex: deviceIndex});
        throw new Meteor.Error('ctn_device_not_found', util.format('Could not find device with given index (%s) for this client (clientId: %s)', deviceIndex, this.clientId));
    }

    return new Device(docDevice, this);
};

// Create new device for this client
//
//  Arguments:
//    props: [string] - device name
//           or
//           {
//      name: [string], - (optional)
//      prodUniqueId: [string], - (optional)
//      public: [boolean] - (optional)
//      (any additional property)
//    }
//    ownApiAccessKey: [boolean]
//    initRightsByEvent: [Object] - (optional) Initial rights for newly created device. Object the keys of which should be the defined permission event names.
//                                -  The value for each event name key should be a rights object as defined for the Permission.setRights method
Client.prototype.createDevice = function (props, ownApiAccessKey = false, initRightsByEvent) {
    props = typeof props === 'string' ? {name: props} : (typeof props === 'object' && props !== null ? props : {});

    // Validate (pre-defined) properties
    const errProp = {};

    if ('name' in props && typeof props.name !== 'string') {
        errProp.name = props.name;
    }

    if ('prodUniqueId' in props && typeof props.prodUniqueId !== 'string') {
        errProp.prodUniqueId = props.prodUniqueId;
    }

    if ('public' in props && typeof props.public !== 'boolean') {
        errProp.public = props.public;
    }

    if (Object.keys(errProp).length > 0) {
        const errProps = Object.keys(errProp);

        Catenis.logger.ERROR(util.format('Client.createDevice method called with invalid propert%s', errProps.length > 1 ? 'ies' : 'y'), errProp);
        throw Error(util.format('Invalid %s propert%s', errProps.join(', '), errProps.length > 1 ? 'ies' : 'y'));
    }

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

    // Check if a new device can be created for this client
    if (this.maximumAllowedDevices !== undefined && this.devicesInUseCount() >= this.maximumAllowedDevices) {
        // Maximum number of allowed devices already reached for this client.
        //  Log error and throw exception
        Catenis.logger.ERROR('Cannot create device; maximum number of allowed devices already reached for client.', {
            clientId: this.clientId,
            maximumAllowedDevices: this.maximumAllowedDevices
        });
        throw new Meteor.Error('ctn_client_max_devices', util.format('Cannot create device; maximum number of allowed devices already reached for client (clientId: %s)', this.clientId));
    }

    let docDevice = undefined;
    let device;

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
            props: props,
            apiAccessGenKey: ownApiAccessKey ? Random.secret() : null,
            status: Device.status.new.name,
            createdDate: new Date(Date.now())
        };

        try {
            // Create new Device doc/rec
            docDevice._id = Catenis.db.collection.Device.insert(docDevice);
        }
        catch (err) {
            if ((err.name === 'MongoError' || err.name === 'BulkWriteError') && err.code === 11000 && err.errmsg.search(/index:\s+props\.prodUniqueId/) >= 0) {
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

        try {
            // Instantiate device and set initial permission rights. If no initial
            //  rights are specified, get the default rights from the client
            device = new Device(docDevice, this);

            device.setInitialRights(initRightsByEvent !== undefined ? initRightsByEvent : device.client.getDeviceDefaultRights());
        }
        catch (err) {
            Catenis.logger.ERROR(util.format('Error setting initial permission rights for newly created device (deviceId: %s).', device.deviceId), err);
            throw new Meteor.Error('ctn_device_init_rights_error', util.format('Error setting initial permission rights for newly created device (deviceId: %s).', device.deviceId), err.stack);
        }

        // Now, adjust last device index
        this.lastDeviceIndex = deviceIndex;
    });

    // If we hit this point, a Device doc (rec) has been successfully created

    try {
        // Fund recently created device
        // noinspection JSUnusedAssignment
        device.fundAddresses();
    }
    catch (err) {
        // Error trying to fund addresses of newly created device. Log error condition
        Catenis.logger.ERROR(util.format('Error trying to fund addresses of newly created device (deviceId: %s).', docDevice.deviceId), err);
    }

    // Now, return device Id
    return docDevice.deviceId;
};

// This includes all but deleted devices
Client.prototype.devicesInUseCount = function () {
    return Catenis.db.collection.Device.find({
        client_id: this.doc_id,
        status: {
            $ne: Device.status.deleted.name
        }
    }).count();
};

Client.prototype.activeDevicesCount = function () {
    return Catenis.db.collection.Device.find({
        client_id: this.doc_id,
        status: Device.status.active.name
    }).count();
};

// This includes both active and inactive devices
Client.prototype.activeInactiveDevicesCount = function () {
    return Catenis.db.collection.Device.find({
        client_id: this.doc_id,
        status: {
            $in: [
                Device.status.active.name,
                Device.status.inactive.name
            ]
        }
    }).count();
};

Client.prototype.conformNumberOfDevices = function () {
    try {
        if (this.clientLicense) {
            if (this.status === Client.status.active.name) {
                if (this.maximumAllowedDevices !== undefined) {
                    const cursorActvDevices = Catenis.db.collection.Device.find({
                        client_id: this.doc_id,
                        status: Device.status.active.name
                    }, {
                        fields: {
                            index: 1
                        },
                        sort: {
                            lastStatusChangedDate: 1
                        }
                    });

                    // Note: we only care to verify the number of active devices because the devices that had
                    //      not yet been activated (status 'new' or 'pending') shall have their status set
                    //      to 'inactive' if required when they are (automatically) activated
                    if (cursorActvDevices.count() > this.maximumAllowedDevices) {
                        // Number of currently active devices exceeds maximum allowed number of active devices.
                        //  Disable devices that were last activated
                        const docActvDevices = cursorActvDevices.fetch();
                        const disabledDevices = [];

                        for (let idx = docActvDevices.length - 1; idx >= this.maximumAllowedDevices; idx--) {
                            const device = this.getDeviceByIndex(docActvDevices[idx].index.deviceIndex);

                            device.disable();
                            disabledDevices.push(device);
                        }

                        if (this.clientLicense.hasLicense()) {
                            // Notify client that some devices have been disabled
                            Catenis.devsDisabEmailNtfy.send({
                                client: this,
                                devices: disabledDevices
                            });
                        }
                    }
                }
            }
            else {
                // Trying to conform number of devices for a non-active client.
                //  Log warning condition
                Catenis.logger.WARN('Trying to conform number of devices for a non-active client.', {
                    clientId: this.clientId,
                    status: this.status
                });
            }
        }
    }
    catch (err) {
        // Log error condition
        Catenis.logger.ERROR('Error trying to conform number of devices of client (clientId: %s)', this.clientId, err);
    }
};

Client.prototype.replaceUserAccountEmail = function (newEmail) {
    // Make sure that client is not deleted
    if (this.status === Client.status.deleted.name) {
        // Cannot replace user account e-mail of a deleted client. Log error and throw exception
        Catenis.logger.ERROR('Cannot replace user account e-mail of a deleted client', {clientId: this.clientId});
        throw new Meteor.Error('ctn_client_deleted', util.format('Cannot replace user account e-mail of a deleted client (clientId: %s)', this.clientId));
    }

    if (!this.userAccountEmail) {
        // Client has no user account e-mail to be replaced. Log error and throw exception
        Catenis.logger.WARN('Client has no user account e-mail to be replaced', {client: this});
        throw new Meteor.Error('ctn_client_no_email', util.format('Client (clientId: %s) has no user account e-mail to be replaced', this.clientId));
    }

    const existingEmail = this.userAccountEmail;

    // Make sure that new e-mail address is different from currently existing e-mail address
    if (newEmail !== existingEmail) {
        try {
            // Add new e-mail address
            Accounts.addEmail(this.user_id, newEmail);
        }
        catch (err) {
            // Error adding new e-mail address to client's user account.
            //  Log error and throw exception
            Catenis.logger.WARN('Error adding new e-mail address to client\'s user account (user_id: %s).', this.user_id, err);
            throw new Meteor.Error('ctn_client_add_email_error', util.format('Error adding new e-mail address to client\'s user account (user_id: %s)', this.user_id), err.stack);
        }

        try {
            // Now, remove previously existing e-mail address
            Accounts.removeEmail(this.user_id, existingEmail);
        }
        catch (err) {
            // Error removing previously existing e-mail address from client's user account.
            //  Log error and throw exception
            Catenis.logger.WARN('Error removing previously existing e-mail address from client\'s user account (user_id: %s).', this.user_id, err);
            throw new Meteor.Error('ctn_client_remove_email_error', util.format('Error removing previously existing e-mail address from client\'s user account (user_id: %s)', this.user_id), err.stack);
        }

        // Reload client user
        getUser.call(this);
    }
};

Client.prototype.updateTimeZone = function (newTimeZone) {
    // Make sure that client is not deleted
    if (this.status === Client.status.deleted.name) {
        // Cannot update time zone of a deleted client. Log error and throw exception
        Catenis.logger.ERROR('Cannot update time zone of a deleted client', {clientId: this.clientId});
        throw new Meteor.Error('ctn_client_deleted', util.format('Cannot update time zone of a deleted client (clientId: %s)', this.clientId));
    }

    // Make sure that time zone is valid
    if (!moment.tz.zone(newTimeZone)) {
        // Invalid time zone to update. Log error and throw exception
        Catenis.logger.ERROR('Client time zone cannot be updated; invalid time zone', {newTimeZone: newTimeZone});
        throw new Meteor.Error('ctn_client_invalid_tz', 'Client time zone cannot be updated; invalid time zone');
    }

    // Retrieve current client time zone
    const currTimeZone = Catenis.db.collection.Client.findOne({
        _id: this.doc_id
    }, {
        fields: {
            timeZone: 1
        }
    }).timeZone;

    // Make sure that it's a different time zone
    if (newTimeZone !== currTimeZone) {
        try {
            // Update Client doc/rec setting the new properties
            Catenis.db.collection.Client.update({
                _id: this.doc_id
            }, {
                $set: {
                    timeZone: newTimeZone
                }
            });
        }
        catch (err) {
            // Error updating Client doc/rec. Log error and throw exception
            Catenis.logger.ERROR(util.format('Error trying to update client time zone field (doc_id: %s).', this.doc_id), err);
            throw new Meteor.Error('ctn_client_update_error', util.format('Error trying to update client time zone field (doc_id: %s)', this.doc_id), err.stack);
        }

        // Update time zone locally too
        this.timeZone = newTimeZone;
    }
};

// Update client properties
//
// Arguments:
//  props: [string] - new name of client
//         or
//         [object] - object containing properties that should be updated and their corresponding new values
//                     To delete a property, set it as undefined.
//
Client.prototype.updateProperties = function (newProps) {
    newProps = typeof newProps === 'string' ? {name: newProps} : (typeof newProps === 'object' && newProps !== null ? newProps : {});

    if (Object.keys(newProps).length > 0) {
        // Validate (pre-defined) properties
        const errProp = {};

        // Allow this property to be undefined so it can be deleted
        if ('name' in newProps && (typeof newProps.name !== 'string' && typeof newProps.name !== 'undefined')) {
            errProp.name = newProps.name;
        }

        if (Object.keys(errProp).length > 0) {
            const errProps = Object.keys(errProp);

            Catenis.logger.ERROR(util.format('Client.updateProperties method called with invalid propert%s', errProps.length > 1 ? 'ies' : 'y'), errProp);
            throw Error(util.format('Invalid %s propert%s', errProps.join(', '), errProps.length > 1 ? 'ies' : 'y'));
        }

        // Make sure that client is not deleted
        if (this.status === Client.status.deleted.name) {
            // Cannot update properties of a deleted client. Log error and throw exception
            Catenis.logger.ERROR('Cannot update properties of a deleted client', {clientId: this.clientId});
            throw new Meteor.Error('ctn_client_deleted', util.format('Cannot update properties of a deleted client (clientId: %s)', this.clientId));
        }

        // Retrieve current client properties
        const currProps = Catenis.db.collection.Client.findOne({_id: this.doc_id}, {fields: {props: 1}}).props;
        let props = _und.clone(currProps);

        // Merge properties to update
        _und.extend(props, newProps);

        // Extract properties that are undefined
        props = _und.omit(props, (value) => {
            return _und.isUndefined(value);
        });

        if (!_und.isEqual(props, currProps)) {
            try {
                // Update Client doc/rec setting the new properties
                Catenis.db.collection.Client.update({_id: this.doc_id}, {$set: {props: props}});
            }
            catch (err) {
                // Error updating Client doc/rec. Log error and throw exception
                Catenis.logger.ERROR(util.format('Error trying to update client properties (doc_id: %s).', this.doc_id), err);
                throw new Meteor.Error('ctn_client_update_error', util.format('Error trying to update client properties (doc_id: %s)', this.doc_id), err.stack);
            }

            // Update properties locally too
            this.props = props;
        }
    }
};

// Return: null if not public, or the following object otherwise: {
//   company: [String],
//   <contact|name>: [String],
//   domains: [Array(String)]
// }
Client.prototype.getPublicProps = function () {
    const pubProps = {};

    if (this.props.company) {
        pubProps.company = this.props.company;
    }

    if (this.props.firstName || this.props.lastName) {
        let contactName = this.props.firstName;

        if (this.props.lastName) {
            if (contactName) {
                contactName += ' ';
            }
            else if (contactName === undefined) {
                contactName = '';
            }

            contactName += this.props.lastName;
        }

        pubProps[pubProps.company ? 'contact' : 'name'] = contactName;
    }

    const verifiedOwnedDomains = this.ownedDomain.verifiedDomainList;

    if (verifiedOwnedDomains.length > 0) {
        pubProps.domains = verifiedOwnedDomains.map(domain => domain.name);
    }

    return pubProps;
};

// Get client's basic identification information, including Catenis node's identification information
Client.prototype.getIdentityInfo = function () {
    const idInfo = this.ctnNode.getIdentityInfo();

    idInfo.client = {
        clientId: this.clientId
    };

    if (this.props.name !== undefined) {
        idInfo.client.name = this.props.name;
    }

    return idInfo;
};

/** License related methods **/
// Provision a license to start in a specific date
//
//  Arguments:
//   license_id [String] - License database doc/rec ID identifying the license to be used
//   startDate [Object(Date)|String] - The date from when the license validity should start. If a Date object is passed,
//                                      that date is converted to the client's local time zone. Otherwise, if a string
//                                      is passed, it should be a calendar date in the format 'YYYY-MM-DD', and it
//                                      designates a date in the client's local time zone.
//                                      NOTE: the license validity always set to start in a day boundary in regards to
//                                          the client's local time zone.
//                                      NOTE 2: if the start date, when converted to the client's local time zone, has
//                                          a time past 12 p.m., one extra day is added to the license validity to
//                                          compensate for the late start.
//   endDate [String] - (optional) The end date used to override the license validity period
//
//  Return:
//   provisionedClientLicense_id [String] - Database doc/rec ID of newly created/provisioned client license
Client.prototype.addLicense = function (license_id, startDate, endDate) {
    // Validate arguments
    const errArg = {};

    if (!isValidLicenseDocId(license_id)) {
        errArg.license_id = license_id;
    }

    if (!isValidLicenseStartDate(startDate)) {
        errArg.startDate = startDate;
    }

    if (endDate && !isValidLicenseEndDate(endDate)) {
        errArg.endDate = endDate;
    }

    if (Object.keys(errArg).length > 0) {
        const errArgs = Object.keys(errArg);

        Catenis.logger.ERROR(util.format('Client.addLicense method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw new Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    // Make sure that client has license support
    if (!this.clientLicense) {
        // Log error condition and throw exception
        Catenis.logger.ERROR('Unable to add new license: client (clientId: %s) has no license support', this.clientId);
        throw new Meteor.Error('ctn_client_no_license_support', util.format('Unable to add new license: client (clientId: %s) has no license support', this.clientId));
    }

    // Get license to be added
    const license = License.getLicenseByDocId(license_id);

    const provisionOpts = {};

    if (endDate) {
        // An end date has been passed to override the license's standard validity period.
        //  Calculate number of days for validity period
        const mtStartDate = typeof startDate === 'string' ? Util.dayTimeZoneToDate(startDate, this.timeZone, true)
            : Util.startOfDayTimeZone(startDate, this.timeZone, true);
        const mtEndDate = Util.dayTimeZoneToDate(endDate, this.timeZone, true);

        const validityDays = mtEndDate.diff(mtStartDate, 'd');

        if (validityDays < cfgSettings.minLicenseValidityDays) {
            // Overridden license validity not with minimum days constraints.
            //  Log error condition and throw exception
            Catenis.logger.ERROR('Overridden license validity is not with minimum days constraints', {
                specifiedValidityDays: validityDays,
                minValidityDays: cfgSettings.minLicenseValidityDays
            });
            throw new Meteor.Error('ctn_client_lic_val_error', 'Overridden license validity is not with minimum days constraints');
        }

        provisionOpts.validityDays = validityDays;
        provisionOpts.compensateLateStart = false;
    }

    // Provision license
    return this.clientLicense.provision(license.level, license.type, startDate, provisionOpts);
};

// Provision a license to start immediately replacing the currently active license
//
//  Arguments:
//   license_id [String] - License database doc/rec ID identifying the license to be used
//
//  Note: when replacing a license, the new license is set to terminate exactly when the current license does
//
//  Return:
//   provisionedClientLicense_id [String] - Database doc/rec ID of newly created/provisioned client license
Client.prototype.replaceLicense = function (license_id) {
    // Validate arguments
    const errArg = {};

    if (!isValidLicenseDocId(license_id)) {
        errArg.license_id = license_id;
    }

    if (Object.keys(errArg).length > 0) {
        const errArgs = Object.keys(errArg);

        Catenis.logger.ERROR(util.format('Client.replaceLicense method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw new Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    // Make sure that client has license support
    if (!this.clientLicense) {
        // Log error condition and throw exception
        Catenis.logger.ERROR('Unable to replace license: client (clientId: %s) has no license support', this.clientId);
        throw new Meteor.Error('ctn_client_no_license_support', util.format('Unable to replace license: client (clientId: %s) has no license support', this.clientId));
    }

    // Make sure that client has a currently active license
    if (!this.clientLicense.hasLicense()) {
        // Log error condition and throw exception
        Catenis.logger.ERROR('Unable to replace license: client (clientId: %s) has no currently active license', this.clientId);
        throw new Meteor.Error('ctn_client_no_license', util.format('Unable to replace license: client (clientId: %s) has no currently active license', this.clientId));
    }

    // Get license to replace existing one
    const license = License.getLicenseByDocId(license_id);

    const mtNow = moment();
    const provisionOpts = {};

    if (license.validityMonths && this.clientLicense.validity.endDate) {
        // Calculate end date for validity period of new (replacing) license
        provisionOpts.validityDays = Math.ceil(moment(this.clientLicense.validity.endDate).diff(mtNow, 'd', true));
        provisionOpts.compensateLateStart = false;

        // Make sure that validity period for new license is not too small
        if (provisionOpts.validityDays < cfgSettings.minLicenseValDaysToReplace) {
            // Log error condition and throw exception
            Catenis.logger.ERROR('Unable to replace license: client license close to expire', {
                clientLicense: this.clientLicense
            });
            throw new Meteor.Error('ctn_client_lic_close_expire', 'Unable to replace license: client license close to expire');
        }
    }

    // Provision license
    return this.clientLicense.provision(license.level, license.type, mtNow.toDate(), provisionOpts);
};

// Provision a license to start right after the provisioned license with the latest end date
//
//  Arguments:
//   license_id [String] - License database doc/rec ID identifying the license to be used
//
//  Note: if current license is provisional renewal, start immediately with same start date
//
//  Return:
//   provisionedClientLicense_id [String] - Database doc/rec ID of newly created/provisioned client license
Client.prototype.renewLicense = function (license_id) {
    // Validate arguments
    const errArg = {};

    if (!isValidLicenseDocId(license_id)) {
        errArg.license_id = license_id;
    }

    if (Object.keys(errArg).length > 0) {
        const errArgs = Object.keys(errArg);

        Catenis.logger.ERROR(util.format('Client.renewLicense method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw new Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    // Make sure that client has license support
    if (!this.clientLicense) {
        // Log error condition and throw exception
        Catenis.logger.ERROR('Unable to renew license: client (clientId: %s) has no license support', this.clientId);
        throw new Meteor.Error('ctn_client_no_license_support', util.format('Unable to replace license: client (clientId: %s) has no license support', this.clientId));
    }

    // Make sure that client has a currently active license
    if (!this.clientLicense.hasLicense()) {
        // Log error condition and throw exception
        Catenis.logger.ERROR('Unable to renew license: client (clientId: %s) has no currently active license', this.clientId);
        throw new Meteor.Error('ctn_client_no_license', util.format('Unable to replace license: client (clientId: %s) has no currently active license', this.clientId));
    }

    // Get license to renew existing one
    const license = License.getLicenseByDocId(license_id);

    // Determine start date
    const startDate = this.clientLicense.provisionalRenewal ? this.clientLicense.validity.startDate : undefined;

    // Provision license
    return this.clientLicense.provision(license.level, license.type, startDate);
};
/** End of license related methods **/

/** Permission related methods **/
// Set the default permission rights to use for newly created devices
//
//  Arguments:
//   rightsByEvent: [Object] - Object the keys of which should be the defined permission event names.
//                           -  The value for each event name key should be a rights object as defined for the Permission.setRights method
Client.prototype.setDeviceDefaultRights = function(rightsByEvent) {
    Object.keys(rightsByEvent).forEach((eventName) => {
        if (Permission.isValidEventName(eventName)) {
            Catenis.permission.setRights(eventName, this, Permission.fixRightsReplaceOwnHierarchyEntity(rightsByEvent[eventName], this));
        }
    });
};

// Retrieve the default permission rights to use for newly created devices
//
//  Result:
//   rightsByEvent: [Object] - Object the keys of which should be the defined permission event names.
//                           -  The value for each event name key should be a rights object as defined for the Permission.setRights method
Client.prototype.getDeviceDefaultRights = function() {
    const rightsByEvent = {};

    Object.keys(Permission.listEvents()).forEach((eventName) => {
        rightsByEvent[eventName] = Catenis.permission.getRights(eventName, this);
    });

    return rightsByEvent;
};
/** End of permission related methods **/

// Redeem purchased Catenis credits (BCOT tokens that get converted into Catenis credits)
//
//  Arguments:
//   purchaseCodes [String|Array(String)] - Purchase codes received after purchase of Catenis credits that are being redeemed
Client.prototype.redeemBcot = function (purchaseCodes) {
    try {
        // Execute code in critical section to avoid BcotSaleAllocationItem database collection concurrency
        BcotSaleAllocation.bcotAllocItemCS.execute(() => {
            const redeemBcotInfo = BcotSaleAllocation.getRedeemBcotInfo(purchaseCodes);

            if (!redeemBcotInfo) {
                // Invalid purchase code. Log error and throw exception
                Catenis.logger.ERROR('Catenis credits cannot be redeemed: one or more of the purchase codes are invalid or have already been redeemed', {
                    purchaseCodes: purchaseCodes
                });
                throw new Meteor.Error('client_bcot_redeem_invalid_codes', 'One or more of the voucher IDs are invalid or have already been redeemed');
            }

            // Execute code in critical section to avoid UTXOs concurrency
            FundSource.utxoCS.execute(() => {
                // Make sure that BCOT token sale stock is enough to fulfill redemption
                const bcotSaleStockBalance = Catenis.bcotSaleStock.balance();

                if (bcotSaleStockBalance.isLessThan(redeemBcotInfo.redeemedAmount)) {
                    // BCOT token sale stock too low. Log error and throw exception
                    Catenis.logger.ERROR('Catenis credits cannot be redeemed: BCOT token sale stock too low', {
                        bcotSaleStockBalance: bcotSaleStockBalance,
                        amountToRedeem: redeemBcotInfo.redeemedAmount
                    });
                    throw new Error('Catenis credits cannot be redeemed: BCOT token sale stock too low');
                }

                // Prepare and send redeem BCOT token transaction
                const redeemBcotTransact = new RedeemBcotTransaction(this, redeemBcotInfo.redeemedAmount.toNumber());

                redeemBcotTransact.buildTransaction();

                redeemBcotTransact.sendTransaction();

                // Mark purchased BCOT products as redeemed
                BcotSaleAllocation.setBcotRedeemed(redeemBcotInfo, this.clientId, redeemBcotTransact.txid);

                // Make sure that BCOT token sale stock info is updated
                Catenis.bcotSaleStock.checkBcotSaleStock();

                // Credit client's service account
                ServiceAccount.CreditServiceAccount(redeemBcotTransact);

                if (this.billingMode === Client.billingMode.prePaid) {
                    // Make sure that system service payment pay tx expense addresses are properly funded
                    this.ctnNode.checkServicePaymentPayTxExpenseFundingBalance();
                }
            });
        });
    }
    catch (err) {
        // Error while redeeming BCOT tokens. Log error and throw exception
        if ((err instanceof Meteor.Error) && err.error === 'client_bcot_redeem_invalid_codes') {
            // Invalid purchase codes. Just rethrow error
            throw err;
        }
        else {
            // Translate any other error into a more generic one
            Catenis.logger.ERROR('Error while redeeming purchased Catenis credits', err);
            throw new Meteor.Error('client_bcot_redeem_error', 'Error allocating Catenis credits while redeeming Catenis vouchers');
        }
    }
};

// Add purchased Catenis credits (BCOT tokens that get converted into Catenis credits) to standby (to be redeemed later)
//
//  Arguments:
//   purchaseCodes [String|Array(String)] - Purchase codes received after purchase of Catenis credits to be added to standby
Client.prototype.addStandbyBcot = function (purchaseCodes) {
    try {
        new StandbyPurchasedBcot(this).addPurchasedCodes(purchaseCodes);
    }
    catch (err) {
        // Error while adding purchased BCOT tokens to standby. Log error and throw exception
        if ((err instanceof Meteor.Error) && err.error === 'standby_bcot_invalid_codes') {
            // Invalid purchase codes. Just rethrow error
            throw err;
        }
        else {
            // Translate any other error into a more generic one
            Catenis.logger.ERROR('Error while adding purchased Catenis credits to standby', err);
            throw new Meteor.Error('client_standby_bcot_add_error', 'Error while adding purchased Catenis credits to standby');
        }
    }
}

// Remove set of purchased Catenis credits (BCOT tokens that get converted into Catenis credits) that are on standby
//  (to be redeemed later)
//
//  Arguments:
//   doc_id [string] - ID of Standby Purchased BCOT database rec/doc to remove
Client.prototype.removeStandbyBcot = function (doc_id) {
    try {
        new StandbyPurchasedBcot(this).removeBatch(doc_id);
    }
    catch (err) {
        // Error while removing purchased BCOT tokens from standby. Log error and throw exception
        Catenis.logger.ERROR('Error while removing purchased Catenis credits from standby', err);
        throw new Meteor.Error('client_standby_bcot_remove_error', 'Error while removing purchased Catenis credits from standby');
    }
}

Client.prototype.updateForeignBlockchainConsumptionProfile = function (blockchainKey, profileName) {
    if (ForeignBlockchain.isValidKey(blockchainKey)
            && ForeignBlockchain.isValidConsumptionProfileName(profileName)) {
        this.foreignBcConsumptionProfile.set(blockchainKey, ForeignBlockchain.consumptionProfile[profileName]);
        saveForeignBlockchainConsumptionProfile.call(this);
    }
}


// Module functions used to simulate private Client object methods
//  NOTE: these functions need to be bound to a Client object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

function getUser() {
    if (this.user_id) {
        this._user = Meteor.users.findOne({
            _id: this.user_id,
            emails: {
                $exists: true
            }
        }, {
            fields: {
                username: 1,
                emails: 1
            }
        });
    }
}

// Redeem all purchased Catenis credits (BCOT tokens that get converted into Catenis credits) that are on standby
function redeemStandbyBcot() {
    try {
        const standbyBcot = new StandbyPurchasedBcot(this);

        if (standbyBcot.hasBatchesToProcess) {
            standbyBcot.processBatches();
        }
    }
    catch (err) {
        Catenis.logger.ERROR('Error redeeming purchased Catenis credits on standby for client (clientId: %s).', this.clientId, err);
    }
}

function loadForeignBlockchainConsumptionProfile(docClient) {
    this.foreignBcConsumptionProfile = new Map();
    let needToSave = false;

    if (Array.isArray(docClient.foreignBlockchainConsumptionProfile)) {
        for (const entry of docClient.foreignBlockchainConsumptionProfile) {
            if (ForeignBlockchain.isValidKey(entry.blockchainKey)
                    && ForeignBlockchain.isValidConsumptionProfileName(entry.profileName)
                    && !this.foreignBcConsumptionProfile.has(entry.blockchainKey)) {
                this.foreignBcConsumptionProfile.set(entry.blockchainKey, ForeignBlockchain.consumptionProfile[entry.profileName]);
            }
            else {
                needToSave = true;
            }
        }
    }

    // Add any missing foreign blockchain entries
    for (const blockchainKey of ForeignBlockchain._keys) {
        if (!this.foreignBcConsumptionProfile.has(blockchainKey)) {
            this.foreignBcConsumptionProfile.set(blockchainKey, defaultForeignBlockchainConsumptionProfile);
            needToSave = true;
        }
    }

    if (needToSave) {
        saveForeignBlockchainConsumptionProfile.call(this);
    }
}

function saveForeignBlockchainConsumptionProfile() {
    try {
        Catenis.db.collection.Client.update({
            _id: this.doc_id
        }, {
            $set: {
                foreignBlockchainConsumptionProfile: Array.from(this.foreignBcConsumptionProfile.keys())
                    .map(blockchainKey => ({
                        blockchainKey,
                        profileName: this.foreignBcConsumptionProfile.get(blockchainKey).name
                    }))
            }
        });
    }
    catch (err) {
        Catenis.logger.ERROR(util.format('Error trying to update client\'s (doc Id: %s) foreign blockchain consumption profile list.', this.doc_id), err);
        throw new Meteor.Error('ctn_client_update_error', util.format('Error trying to update client\'s (doc Id: %s) foreign blockchain consumption profile list', this.doc_id), err.stack);
    }
}


// Client function class (public) methods
//

Client.initialize = function () {
    Catenis.logger.TRACE('Client initialization');
};

Client.createNewUserForClient = function (username, email, deviceName) {
    const opts = {};

    if (typeof username === 'string' && username.length > 0) {
        opts.username = username;
    }

    if (typeof email === 'string' && email.length > 0) {
        opts.email = email;
    }

    opts.profile = {
        name: cfgSettings.userNamePrefix + (typeof deviceName === 'string' && deviceName.length > 0 ? ': ' + deviceName : '')
    };

    let user_id;

    try {
        user_id = Accounts.createUser(opts);
    }
    catch (err) {
        Catenis.logger.ERROR('Error creating new user for client.', err);

        let errorToThrow;

        if ((err instanceof Meteor.Error) && err.error === 403) {
            if (err.reason === 'Username already exists.') {
                errorToThrow = new Meteor.Error('ctn_client_duplicate_username', 'Error creating new user for client: username already exists');
            }
            else if (err.reason === 'Email already exists.') {
                errorToThrow = new Meteor.Error('ctn_client_duplicate_email', 'Error creating new user for client: email already exists');
            }
            else if (err.reason === 'Something went wrong. Please check your credentials.') {
                // Generic credentials error. Try to identify what was wrong
                if (opts.username && Meteor.users.findOne({username: opts.username}, {fields:{_id: 1}})) {
                    errorToThrow = new Meteor.Error('ctn_client_duplicate_username', 'Error creating new user for client: username already exists');
                }
                else if (opts.email && Meteor.users.findOne({emails: {$elemMatch: {address: opts.email}}}, {fields:{_id: 1}})) {
                    errorToThrow = new Meteor.Error('ctn_client_duplicate_email', 'Error creating new user for client: duplicate email address');
                }
            }
        }

        throw errorToThrow ? errorToThrow : new Meteor.Error('ctn_client_new_user_failure', util.format('Error creating new user for client: %s', err.toString()));
    }

    Roles.addUsersToRoles(user_id, cfgSettings.clientRole);

    return user_id;
};

Client.getClientByClientId = function (clientId, includeDeleted = true) {
    // Retrieve Client doc/rec
    const query = {
        clientId: clientId
    };

    if (!includeDeleted) {
        query.status = {$ne: Client.status.deleted.name};
    }

    const docClient = Catenis.db.collection.Client.findOne(query);

    if (docClient === undefined) {
        // No client available with the given client ID. Log error and throw exception
        Catenis.logger.ERROR('Could not find client with given client ID', {clientId: clientId});
        throw new Meteor.Error('ctn_client_not_found', util.format('Could not find client with given client ID (%s)', clientId));
    }

    return new Client(docClient, CatenisNode.getCatenisNodeByIndex(docClient.index.ctnNodeIndex));
};

Client.getClientByDocId = function (client_id, includeDeleted = true, noClientLicense = false) {
    // Retrieve Client doc/rec
    const query = {
        _id: client_id
    };

    if (!includeDeleted) {
        query.status = {$ne: Client.status.deleted.name};
    }

    const docClient = Catenis.db.collection.Client.findOne(query);

    if (docClient === undefined) {
        // No client available with the given doc/rec ID. Log error and throw exception
        Catenis.logger.ERROR('Could not find client with given database rec/doc ID', {client_id: client_id});
        throw new Meteor.Error('ctn_client_not_found', util.format('Could not find client with given database rec/doc ID (%s)', client_id));
    }

    return new Client(docClient, CatenisNode.getCatenisNodeByIndex(docClient.index.ctnNodeIndex), false, noClientLicense);
};

Client.getClientByUserId = function (user_id, includeDeleted = true) {
    // Retrieve Client doc/rec
    const query = {
        user_id: user_id
    };

    if (!includeDeleted) {
        query.status = {$ne: Client.status.deleted.name};
    }

    const docClient = Catenis.db.collection.Client.findOne(query);

    if (docClient === undefined) {
        // No client available associated with given user id. Log error and throw exception
        Catenis.logger.ERROR('Could not find client associated with given user id', {user_id: user_id});
        throw new Meteor.Error('ctn_client_not_found', util.format('Could not find client associated with given user id (%s)', user_id));
    }

    return new Client(docClient, CatenisNode.getCatenisNodeByIndex(docClient.index.ctnNodeIndex));
};

Client.activeClientsCount = function (billingMode) {
    const selector = {
        catenisNode_id: Catenis.ctnHubNode.doc_id,
        status: Client.status.active.name
    };

    if (billingMode !== undefined) {
        selector.billingMode = billingMode
    }

    return Catenis.db.collection.Client.find(selector).count();
};

Client.activePrePaidClientsCount = function () {
    return Client.activeClientsCount(Client.billingMode.prePaid);
};

Client.activePostPaidClientsCount = function () {
    return Client.activeClientsCount(Client.billingMode.postPaid);
};

Client.allActiveClientIndices = function (billingMode) {
    const selector = {
        catenisNode_id: Catenis.ctnHubNode.doc_id,
        status: Client.status.active.name
    };

    if (billingMode !== undefined) {
        selector.billingMode = billingMode
    }

    return Catenis.db.collection.Client.find(selector, {fields: {_id: 0, index: 1}}).map((doc) => doc.index);
};

Client.allActivePrePaidClientIndices = function () {
    return Client.allActiveClientIndices(Client.billingMode.prePaid);
};

Client.allActivePostPaidClientIndices = function () {
    return Client.allActiveClientIndices(Client.billingMode.postPaid);
};

// Returns total balance of all pre-paid client's service account credit line
//
//  Return:
//   balance: [Number] - Amount, in Catenis service credit lowest unit, corresponding to the current balance
Client.allPrePaidClientsServiceAccountCreditLineBalance = function () {
    let balance = 0;
    const servCredAsset = Catenis.ctnHubNode.getServiceCreditAsset();

    if (servCredAsset !== undefined) {
        balance = new CCFundSource(servCredAsset.ccAssetId, Catenis.keyStore.listAllClientServiceAccountCreditLineAddressesInUse(Client.allActivePrePaidClientIndices()), {useUnconfirmedUtxo: true}).getBalance();
    }

    return balance;
};

// Check if a given client exists
//
//  Argument:
//   clientId [String] - Client ID of client to check existence
//   selfReferenceAccepted [Boolean] - Indicate whether 'self' token should be accepted for client ID
//   wildcardAccepted [Boolean] - Indicate whether wildcard ('*') should be accepted for client ID
//   includeDeleted [Boolean] - Indicate whether deleted clients should also be included in the check
//
//  Result:
//   [Boolean] - Indicates whether the client being checked exists or not
Client.checkExist = function (clientId, selfReferenceAccepted = false, wildcardAccepted = false, includeDeleted = false) {
    if ((selfReferenceAccepted && clientId === Permission.entityToken.ownHierarchy) || (wildcardAccepted && clientId === Permission.entityToken.wildcard)) {
        return true;
    }
    else {
        if (clientId === undefined) {
            return false;
        }

        const selector = {
            clientId: clientId
        };

        if (!includeDeleted) {
            selector.status = {
                $ne: Client.status.deleted.name
            }
        }

        const docClient = Catenis.db.collection.Client.findOne(selector, {fields: {_id: 1}});

        return docClient !== undefined;
    }
};

// Check if one or more clients exist
//
//  Argument:
//   clientIds [Array(String)|String] - List of UNIQUE client IDs (or a single client ID) of clients to check existence
//   selfReferenceAccepted [Boolean] - Indicate whether 'self' token should be accepted for client ID
//   wildcardAccepted [Boolean] - Indicate whether wildcard ('*') should be accepted for client ID
//   includeDeleted [Boolean] - Indicate whether deleted clients should also be included in the check
//
//  Result:
//   result: {
//     doExist: [Boolean] - Indicates whether all clients being checked exist or not
//     nonexistentClientIds: [Array(String)] - List of client IDs of clients, from the ones that were being checked, that do not exist
//   }
Client.checkExistMany = function (clientIds, selfReferenceAccepted = false, wildcardAccepted = false, includeDeleted = false) {
    const result = {};

    if (Array.isArray(clientIds)) {
        if (clientIds.length === 0) {
            return {
                doExist: false
            };
        }

        if (selfReferenceAccepted || wildcardAccepted) {
            // Filter out self reference and/or wildcard ID
            clientIds = clientIds.filter((clientId) => (!selfReferenceAccepted || clientId !== Permission.entityToken.ownHierarchy) && (!wildcardAccepted || clientId !== Permission.entityToken.wildcard));

            if (clientIds.length === 0) {
                return {
                    doExist: true
                }
            }
        }

        const selector = {
            clientId: {
                $in: clientIds
            }
        };

        if (!includeDeleted) {
            selector.status = {
                $ne: Client.status.deleted.name
            };
        }

        const resultSet = Catenis.db.collection.Client.find(selector, {
            fields: {
                clientId: 1
            }
        });

        if (resultSet.count() !== clientIds.length) {
            // Not all IDs returned. Indicated that not all exist and identify the ones that do not
            result.doExist = false;
            result.nonexistentClientIds = [];
            const existingClientIds = new Set(resultSet.fetch().map(doc => doc.clientId));

            clientIds.forEach((clientId) => {
                if (!existingClientIds.has(clientId)) {
                    result.nonexistentClientIds.push(clientId);
                }
            });
        }
        else {
            // Found all indices. Indicate that all exist
            result.doExist = true;
        }
    }
    else {
        // A single client ID had been passed to be checked
        result.doExist = Client.checkExist(clientIds, selfReferenceAccepted, wildcardAccepted, includeDeleted);

        if (!result.doExist) {
            result.nonexistentClientIds = [clientIds];
        }
    }

    return result;
};

// Make sure that device default permission rights are set for all clients and permission events
Client.checkDeviceDefaultRights = function () {
    // Retrieve client ID of all currently defined clients
    const clientIds = Catenis.db.collection.Client.find({
        status: {$ne: Client.status.deleted.name}
    }, {
        fields: {
            clientId: 1
        }
    }).map((doc) => doc.clientId);

    // Identity clients for which device default rights are already set for at least some permission events
    const alreadySetClientIdEvents = new Map();

    Catenis.db.collection.Permission.find({
        subjectEntityId: {
            $in: clientIds
        },
        level: Permission.level.system.name
    }, {
        fields: {
            subjectEntityId: 1,
            event: 1
        }
    }).forEach((doc) => {
        if (!alreadySetClientIdEvents.has(doc.subjectEntityId)) {
            alreadySetClientIdEvents.set(doc.subjectEntityId, new Set([doc.event]));
        }
        else {
            alreadySetClientIdEvents.get(doc.subjectEntityId).add(doc.event);
        }
    });

    // For all existing clients, check if there are any permission event for which
    //  device default rights setting is missing, and fix it
    const numEventsDeviceDefaultRights = Object.keys(cfgSettings.deviceDefaultRightsByEvent).length;

    clientIds.forEach((clientId) => {
        let alreadySetEvents;

        if (!alreadySetClientIdEvents.has(clientId) || (alreadySetEvents = alreadySetClientIdEvents.get(clientId)).size < numEventsDeviceDefaultRights) {
            // Prepare device default rights containing only the events that are missing...
            const deviceDefaultRightsByEvent = _und.omit(cfgSettings.deviceDefaultRightsByEvent, (rights, event) => alreadySetEvents !== undefined && alreadySetEvents.has(event));

            // And set them
            Catenis.logger.DEBUG('Setting device default permission rights for client', {
                clientId: clientId,
                rightsByEvent: deviceDefaultRightsByEvent
            });
            Client.getClientByClientId(clientId).setDeviceDefaultRights(deviceDefaultRightsByEvent);
        }
    });
};


// Client function class (public) properties
//

Client.clientCtrl = {};

Client.status = ClientShared.status;

Client.billingMode = Object.freeze({
    prePaid: 'pre-paid',
    postPaid: 'post-paid'
});


// Definition of module (private) functions
//

// Create new device ID dependent on Catenis node index, client index and device index
function newDeviceId(ctnNodeIndex, clientIndex, deviceIndex) {
    let id = 'd' + Random.createWithSeeds(Array.from(Catenis.application.commonSeed.toString() + ':ctnNodeIndex:' + ctnNodeIndex + ',clientIndex:' + clientIndex + ',deviceIndex:' + deviceIndex)).id(19);
    let doc;

    if ((doc = Catenis.db.collection.Device.findOne({deviceId: id}, {fields:{_id: 1, index: 1}}))) {
        // New device ID is already in use. Log warning condition and reset ID
        Catenis.logger.WARN(util.format('Device ID for Catenis node index %d, client index %d and device index %d is already in use', ctnNodeIndex, clientIndex, deviceIndex), {existingDeviceDoc: doc});
        id = undefined;
    }

    return id;
}

function isValidLicenseStartDate(startDate) {
    return (startDate instanceof Date) || (typeof startDate === 'string' && moment(startDate, 'YYYY-MM-DD', true).isValid());
}

function isValidLicenseEndDate(endDate) {
    return typeof endDate === 'string' && moment(endDate, 'YYYY-MM-DD', true).isValid();
}

function isValidLicenseDocId(id) {
    return typeof id === 'string' && id.length > 0;
}

export function parseAccountNumber(strAccNumber) {
    let number = cfgSettings.firstAccountNumber - 1;

    if (typeof strAccNumber === 'string') {
        const match = strAccNumber.match(accNumberRegEx);

        if (match) {
            number = Number.parseInt(match[1]);
        }
    }

    return number;
}

export function formatAccountNumber(number) {
    const strNumber = number.toString();

    return util.format('%s-%s%s', Catenis.application.environment.toUpperCase().substring(0, 1), '00000000'.substring(strNumber.length), strNumber);
}


// Module code
//

// Lock function class
Object.freeze(Client);
