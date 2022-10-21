/**
 * Created by Claudio on 2017-05-23.
 */

//console.log('[ClientsUI.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import util from 'util';
// Third-party node modules
//import _und from 'underscore';
// Meteor packages
import { Meteor } from 'meteor/meteor';
import { Accounts } from 'meteor/accounts-base'
import { Roles } from 'meteor/alanning:roles';

// References code in other (Catenis) modules
import { Catenis } from '../Catenis';
import { CatenisNode } from '../CatenisNode';
import { Client } from '../Client';
import { ClientLicense } from '../ClientLicense';
import { License } from '../License';
import { CommonClientLicenseUI } from '../commonUI/CommonClientLicenseUI';
import { CommonServiceAccountUI } from '../commonUI/CommonServiceAccountUI';
import { CommonOwnedDomainsUI } from '../commonUI/CommonOwnedDomainsUI';
import { KeyStore } from '../KeyStore';
import { StandbyPurchasedBcot } from '../StandbyPurchasedBcot';
import { CommonClientForeignBlockchainsUI } from '../commonUI/CommonClientForeignBlockchainsUI';
import { ForeignBlockchain } from '../ForeignBlockchain';
import { AccountRegistration } from '../AccountRegistration';
import { UserRoles } from '../../both/UserRoles';


// Definition of function classes
//

// ClientsUI function class
export function ClientsUI() {
}


// Public ClientsUI object methods
//

/*ClientsUI.prototype.pub_func = function () {
 };*/


// Module functions used to simulate private ClientsUI object methods
//  NOTE: these functions need to be bound to a ClientsUI object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
 }*/


// ClientsUI function class (public) methods
//

ClientsUI.initialize = function () {
    Catenis.logger.TRACE('ClientsUI initialization');
    // Declaration of RPC methods to be called from client
    Meteor.methods({
        createNewClient: function (ctnNodeIndex, clientInfo) {
            if (Roles.userIsInRole(this.userId, 'sys-admin')) {
                // Prepare to create new Catenis client
                const props = {
                    name: clientInfo.name
                };

                if (clientInfo.firstName) {
                    props.firstName = clientInfo.firstName;
                }

                if (clientInfo.lastName) {
                    props.lastName = clientInfo.lastName;
                }

                if (clientInfo.company) {
                    props.company = clientInfo.company;
                }

                if (clientInfo.phone) {
                    props.phone = clientInfo.phone;
                }

                // Try to create Catenis client
                let clientId;

                try {
                    // Note: we postpone sending the account enrollment notification e-mail until a license is
                    //        successfully added to the newly created account
                    clientId = CatenisNode.getCatenisNodeByIndex(ctnNodeIndex).createClient(props, null, {
                        createUser: true,
                        email: clientInfo.email,
                        sendEnrollmentEmail: false,
                        timeZone: clientInfo.timeZone
                    });
                }
                catch (err) {
                    // Error trying to create Catenis client. Log error and throw exception
                    Catenis.logger.ERROR('Failure trying to create new Catenis client.', err);
                    throw new Meteor.Error('client.create.failure', 'Failure trying to create new Catenis client: ' + err.toString());
                }

                // Add license to newly created client
                let client;
                let licenseAdded = false;
                const postCreateErrMsgs = [];

                try {
                    client = Client.getClientByClientId(clientId);

                    if (!clientInfo.licenseInfo.startDate) {
                        clientInfo.licenseInfo.startDate = new Date();
                    }

                    client.addLicense(clientInfo.licenseInfo.license_id, clientInfo.licenseInfo.startDate, clientInfo.licenseInfo.endDate);
                    licenseAdded = true;
                }
                catch (err) {
                    // Error trying to add license to newly created client. Log error and throw exception
                    Catenis.logger.ERROR('Failure trying to add license to newly created client (clientId: %s).', clientId, util.inspect({clientLicenseInfo: clientInfo.licenseInfo}), err);
                    postCreateErrMsgs.push(util.format('Failure trying to add license to newly created client: %s', err.toString()));
                }

                if (licenseAdded) {
                    try {
                        // Send account enrollment notification e-mail now
                        Accounts.sendEnrollmentEmail(client.user_id);
                    }
                    catch (err) {
                        // Error trying to send account enrollment notification e-mail. Log error and throw exception
                        Catenis.logger.ERROR('Failure trying to send account enrollment notification e-mail for newly created client (clientId: %s).', clientId, err);
                        postCreateErrMsgs.push(util.format('Failure trying to send account enrollment notification e-mail for newly created client: %s', err.toString()));
                    }
                }
                else {
                    // No license added. Issue error to communicate that account enrollment could not be sent.
                    postCreateErrMsgs.push('Account enrollment notification e-mail for newly created client could not be sent: account has no license');
                }

                if (clientInfo.standbyPurchasedCodes) {
                    // Add purchased Catenis credits to standby
                    try {
                        new StandbyPurchasedBcot(client).addPurchasedCodes(clientInfo.standbyPurchasedCodes);
                    }
                    catch (err) {
                        Catenis.logger.ERROR('Failure trying to add purchased Catenis credits to standby for newly created client (clientId: %s).', clientId, err);
                        postCreateErrMsgs.push(util.format('Failure trying to add purchased Catenis credits to standby for newly created client: %s', err.toString()));
                    }
                }

                if (postCreateErrMsgs.length > 0) {
                    throw new Meteor.Error('client.create.postCreateFailure', 'Error after client had been successfully created', {
                        errMsgs: postCreateErrMsgs,
                        clientId: clientId
                    });
                }

                return clientId;
            }
            else {
                // User not logged in or not a system administrator.
                //  Throw exception
                throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
            }
        },
        addClientOwnedDomain: function (client_id, domainName) {
            if (Roles.userIsInRole(this.userId, 'sys-admin')) {
                try {
                    const client = Client.getClientByDocId(client_id);

                    client.ownedDomain.addDomain(domainName);
                }
                catch (err) {
                    // Error trying to add new client owned domain. Log error and throw exception
                    Catenis.logger.ERROR('Failure trying to add new client owned domain.', err);
                    throw new Meteor.Error('client.owned.domain.add.failure', 'Failure trying to add new client owned domain: ' + err.toString());
                }
            }
            else {
                // User not logged in or not a system administrator.
                //  Throw exception
                throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
            }
        },
        verifyClientOwnedDomain: function (client_id, domainName) {
            if (Roles.userIsInRole(this.userId, 'sys-admin')) {
                try {
                    const client = Client.getClientByDocId(client_id);

                    return client.ownedDomain.verifyDomain(domainName);
                }
                catch (err) {
                    // Error trying to verify client owned domain. Log error and throw exception
                    Catenis.logger.ERROR('Failure trying to verify client owned domain.', err);
                    throw new Meteor.Error('client.owned.domain.verify.failure', 'Failure trying to verify client owned domain: ' + err.toString());
                }
            }
            else {
                // User not logged in or not a system administrator.
                //  Throw exception
                throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
            }
        },
        deleteClientOwnedDomain: function (client_id, domainName) {
            if (Roles.userIsInRole(this.userId, 'sys-admin')) {
                try {
                    const client = Client.getClientByDocId(client_id);

                    client.ownedDomain.deleteDomain(domainName);
                }
                catch (err) {
                    // Error trying to delete client owned domain. Log error and throw exception
                    Catenis.logger.ERROR('Failure trying to delete client owned domain.', err);
                    throw new Meteor.Error('client.owned.domain.delete.failure', 'Failure trying to delete client owned domain: ' + err.toString());
                }
            }
            else {
                // User not logged in or not a system administrator.
                //  Throw exception
                throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
            }
        },
        updateClient: function (client_id, clientInfo) {
            if (Roles.userIsInRole(this.userId, 'sys-admin')) {
                try {
                    const client = Client.getClientByDocId(client_id);

                    // Prepare to update client's properties
                    const props = {
                        name: clientInfo.name,
                        firstName: clientInfo.firstName ? clientInfo.firstName : undefined,
                        lastName: clientInfo.lastName ? clientInfo.lastName : undefined,
                        company: clientInfo.company ? clientInfo.company : undefined,
                        phone: clientInfo.phone ? clientInfo.phone : undefined
                    };

                    client.updateProperties(props);

                    // Replace user account e-mail address
                    client.replaceUserAccountEmail(clientInfo.email);

                    // Update time zone
                    client.updateTimeZone(clientInfo.timeZone);
                }
                catch (err) {
                    // Error trying to update client data. Log error and throw exception
                    Catenis.logger.ERROR('Failure trying to update client data.', err);
                    throw new Meteor.Error('client.update.failure', 'Failure trying to update client data: ' + err.toString());
                }
            }
            else {
                // User not logged in or not a system administrator.
                //  Throw exception
                throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
            }
        },
        // Note: this method is expected to be called by a Catenis client user, right after its successful enrollment
        activateClient: function (user_id) {
            if (Roles.userIsInRole(this.userId, 'ctn-client')) {
                let client;

                try {
                    // Try to retrieve client associated with given user
                    client = Client.getClientByUserId(user_id);

                    if (client.status === Client.status.new.name) {
                        client.activate();
                    }
                }
                catch (err) {
                    // Error trying to activate client. Log error and throw exception
                    Catenis.logger.ERROR('Failure trying to activate Catenis client.', err);
                    throw new Meteor.Error('client.activate.failure', 'Failure trying to activate Catenis client');
                }

                // Set client user's e-mail address as verified
                try {
                    client.setEmailVerified();
                }
                catch (err) {
                    // Error trying to set client account e-mail address as verified.
                    //  Log error and throw exception
                    Catenis.logger.ERROR('Failure trying to set client account e-mail address as verified.', err);
                    throw new Meteor.Error('client.activate.failure', 'Failure trying to set client account e-mail address as verified');
                }
            }
            else {
                // User not logged in or not a Catenis client.
                //  Throw exception
                throw new Meteor.Error('ctn_client_no_permission', 'No permission; must be logged in as a Catenis client to perform this task');
            }
        },
        // Note: this method is expected to be called by a self-registered user, right after its successful e-mail address verification
        createNewClientForUser: function () {
            if (Roles.userIsInRole(this.userId, UserRoles.selfRegistered)) {
                AccountRegistration.newClient(this.userId);
            }
            else {
                // User not logged in or not a self-registered user.
                //  Throw exception
                throw new Meteor.Error('ctn_user_no_permission', 'No permission; must be logged in as a self-registered user');
            }
        },
        sendEnrollmentEmail: function (client_id){
            if (Roles.userIsInRole(this.userId, 'sys-admin')) {
                try {
                    const client = Client.getClientByDocId(client_id);

                    Accounts.sendEnrollmentEmail(client.user_id);
                }
                catch (err) {
                    // Error trying to send client account enrollment e-mail. Log error and throw exception
                    Catenis.logger.ERROR('Failure trying to send client account enrollment e-mail message.', err);
                    throw new Meteor.Error('client.sendEnrollmentEmail.failure', 'Failure trying to send client account enrollment e-mail message: ' + err.toString());
                }
            }
            else {
                // User not logged in or not a system administrator.
                //  Throw exception
                throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
            }
        },
        sendResetPasswordEmail: function (client_id){
            if (Roles.userIsInRole(this.userId, 'sys-admin')) {
                try {
                    const client = Client.getClientByDocId(client_id);

                    Accounts.sendResetPasswordEmail(client.user_id);
                }
                catch (err) {
                    // Error trying to send e-mail to reset client account's password. Log error and throw exception
                    Catenis.logger.ERROR('Failure trying to send e-mail message to reset client account\'s password.', err);
                    throw new Meteor.Error('client.sendResetPasswordEmail.failure', 'Failure trying to send e-mail message to reset client account\'s password: ' + err.toString());
                }
            }
            else {
                // User not logged in or not a system administrator.
                //  Throw exception
                throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
            }
        },
        getClientApiAccessSecret: function (client_id) {
            if (Roles.userIsInRole(this.userId, 'sys-admin')) {
                try {
                    return Client.getClientByDocId(client_id).apiAccessSecret;
                }
                catch (err) {
                    // Error trying to get client's API access secret. Log error and throw exception
                    Catenis.logger.ERROR('Failure trying to get client\'s API access secret.', err);
                    throw new Meteor.Error('client.getClientApiAccessSecret.failure', 'Failure trying to get client\'s API access secret: ' + err.toString());
                }
            }
            else {
                // User not logged in or not a system administrator.
                //  Throw exception
                throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
            }
        },
        resetClientApiAccessSecret: function (client_id, resetAllDevicesToo) {
            if (Roles.userIsInRole(this.userId, 'sys-admin')) {
                try {
                    Client.getClientByDocId(client_id).renewApiAccessGenKey(resetAllDevicesToo);
                }
                catch (err) {
                    // Error trying to reset client's API access secret. Log error and throw exception
                    Catenis.logger.ERROR('Failure trying to renew client\'s API access generation key.', err);
                    throw new Meteor.Error('client.getClientApiAccessSecret.failure', 'Failure trying to renew client\'s API access generation key: ' + err.toString());
                }
            }
            else {
                // User not logged in or not a system administrator.
                //  Throw exception
                throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
            }
        },
        addClientLicense: function (client_id, clientLicenseInfo) {
            if (Roles.userIsInRole(this.userId, 'sys-admin')) {
                try {
                    const client = Client.getClientByDocId(client_id);

                    if (!clientLicenseInfo.startDate) {
                        clientLicenseInfo.startDate = new Date();
                    }

                    return client.addLicense(clientLicenseInfo.license_id, clientLicenseInfo.startDate, clientLicenseInfo.endDate);
                }
                catch (err) {
                    // Error trying to add new license to client. Log error and throw exception
                    Catenis.logger.ERROR('Failure trying to add new license to client.', util.inspect({clientLicenseInfo: clientLicenseInfo}), err);
                    throw new Meteor.Error('client.addClientLicense.failure', 'Failure trying to add new license to client: ' + err.toString());
                }
            }
            else {
                // User not logged in or not a system administrator.
                //  Throw exception
                throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
            }
        },
        renewClientLicense: function (client_id, license_id) {
            if (Roles.userIsInRole(this.userId, 'sys-admin')) {
                try {
                    const client = Client.getClientByDocId(client_id);

                    return client.renewLicense(license_id);
                }
                catch (err) {
                    // Error trying to renew client license. Log error and throw exception
                    Catenis.logger.ERROR('Failure trying to renew client license (client_id: %s; license_id: %s).', client_id, license_id, err);
                    throw new Meteor.Error('client.renewClientLicense.failure', 'Failure trying to renew client license: ' + err.toString());
                }
            }
            else {
                // User not logged in or not a system administrator.
                //  Throw exception
                throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
            }
        },
        upgradeClientLicense: function (client_id, license_id) {
            if (Roles.userIsInRole(this.userId, 'sys-admin')) {
                try {
                    const client = Client.getClientByDocId(client_id);

                    return client.replaceLicense(license_id);
                }
                catch (err) {
                    // Error trying to upgrade client license. Log error and throw exception
                    Catenis.logger.ERROR('Failure trying to upgrade client license (client_id: %s; license_id: %s).', client_id, license_id, err);
                    throw new Meteor.Error('client.upgradeClientLicense.failure', 'Failure trying to upgrade client license: ' + err.toString());
                }
            }
            else {
                // User not logged in or not a system administrator.
                //  Throw exception
                throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
            }
        },
        expireClientLicense: function (clientLicense_id) {
            if (Roles.userIsInRole(this.userId, 'sys-admin')) {
                try {
                    const clientLicense = new ClientLicense(clientLicense_id);

                    clientLicense.expire();
                }
                catch (err) {
                    // Error trying to expire client license. Log error and throw exception
                    Catenis.logger.ERROR('Failure trying to expire client license (doc_id: %s).', clientLicense_id, err);
                    throw new Meteor.Error('client.expireClientLicense.failure', 'Failure trying to expire client license: ' + err.toString());
                }
            }
            else {
                // User not logged in or not a system administrator.
                //  Throw exception
                throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
            }
        },
        deleteClient: function (client_id) {
            if (Roles.userIsInRole(this.userId, 'sys-admin')) {
                try {
                    Client.getClientByDocId(client_id).delete();
                }
                catch (err) {
                    // Error trying to delete client. Log error and throw exception
                    Catenis.logger.ERROR('Failure trying to delete client (doc_id: %s).', client_id, err);
                    throw new Meteor.Error('client.delete.failure', 'Failure trying to delete client: ' + err.toString());
                }
            }
            else {
                // User not logged in or not a system administrator.
                //  Throw exception
                throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
            }
        },
        newBcotPaymentAddress: function (client_id) {
            if (Roles.userIsInRole(this.userId, 'sys-admin')) {
                try {
                    return Client.getClientByDocId(client_id).newBcotPaymentAddress();
                }
                catch (err) {
                    // Error trying to retrieve new BCOT payment address. Log error and throw exception
                    Catenis.logger.ERROR('Failure retrieving BCOT payment address for client (doc_id: %s).', client_id, err);
                    throw new Meteor.Error('client.newBcotPaymentAddress.failure', 'Failure retrieving BCOT payment address for client: ' + err.toString());
                }
            }
            else {
                // User not logged in or not a system administrator.
                //  Throw exception
                throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
            }
        },
        redeemBcot: function (client_id, purchaseCodes) {
            if (Roles.userIsInRole(this.userId, 'sys-admin')) {
                try {
                    return Client.getClientByDocId(client_id).redeemBcot(purchaseCodes);
                }
                catch (err) {
                    // Error trying to redeem purchased BCOT tokens. Log error and throw exception
                    Catenis.logger.ERROR('Failure redeeming purchased Catenis credits (purchase codes: %s).', purchaseCodes, err);
                    throw new Meteor.Error('client.redeemBcot.failure', 'Failure redeeming Catenis vouchers: ' + err.toString());
                }
            }
            else {
                // User not logged in or not a system administrator.
                //  Throw exception
                throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
            }
        },
        addStandbyBcot: function (client_id, purchaseCodes) {
            if (Roles.userIsInRole(this.userId, 'sys-admin')) {
                try {
                    return Client.getClientByDocId(client_id).addStandbyBcot(purchaseCodes);
                }
                catch (err) {
                    // Error trying to add purchased BCOT tokens to standby. Log error and throw exception
                    Catenis.logger.ERROR('Failure adding purchased Catenis credits to standby (purchase codes: %s).', purchaseCodes, err);
                    throw new Meteor.Error('client.addStandbyBcot.failure', 'Failure adding Catenis vouchers to standby: ' + err.toString());
                }
            }
            else {
                // User not logged in or not a system administrator.
                //  Throw exception
                throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
            }
        },
        removeStandbyBcot: function (client_id, doc_id) {
            if (Roles.userIsInRole(this.userId, 'sys-admin')) {
                try {
                    return Client.getClientByDocId(client_id).removeStandbyBcot(doc_id);
                }
                catch (err) {
                    // Error trying to remove purchased BCOT tokens from standby. Log error and throw exception
                    Catenis.logger.ERROR('Failure removing purchased Catenis credits from standby (doc_id: %s).', doc_id, err);
                    throw new Meteor.Error('client.addStandbyBcot.failure', 'Failure removing Catenis vouchers from standby: ' + err.toString());
                }
            }
            else {
                // User not logged in or not a system administrator.
                //  Throw exception
                throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
            }
        },
        updateForeignBcConsumptionProfile: function (client_id, blockchainKey, profileName) {
            if (Roles.userIsInRole(this.userId, 'sys-admin')) {
                try {
                    return Client.getClientByDocId(client_id).updateForeignBlockchainConsumptionProfile(blockchainKey, profileName);
                }
                catch (err) {
                    // Error trying to update client's foreign blockchain consumption profile. Log error and throw exception
                    Catenis.logger.ERROR('Failure updating client\'s (doc_id: %s) foreign blockchain (%s) consumption profile (%s).', client_id, blockchainKey, profileName, err);
                    throw new Meteor.Error('client.updateForeignBcConsumptionProfile.failure', 'Failure updating client\'s foreign blockchain consumption profile: ' + err.toString());
                }
            }
            else {
                // User not logged in or not a system administrator.
                //  Throw exception
                throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
            }
        },
        dismissLowServAccBalanceUINotify: function (client_id) {
            if (Roles.userIsInRole(this.userId, 'sys-admin')) {
                try {
                    Client.getClientByDocId(client_id).resetLowServAccBalanceNotifyUIDismissDate();
                }
                catch (err) {
                    // Error trying to reset low service account balance UI notification dismiss date. Log error and throw exception
                    Catenis.logger.ERROR('Failure trying to reset client\'s (doc_id: %s) low service account balance UI notification dismiss date.', client_id, err);
                    throw new Meteor.Error('client.dismissLowServAccBalanceUINotify.failure', 'Failure trying to reset client\'s low service account balance UI notification dismiss date: ' + err.toString());
                }
            }
            else {
                // User not logged in or not a system administrator.
                //  Throw exception
                throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
            }
        }
    });

    // Declaration of publications
    Meteor.publish('catenisClients', function (ctnNodeIndex) {
        if (Roles.userIsInRole(this.userId, 'sys-admin')) {
            ctnNodeIndex = ctnNodeIndex || Catenis.application.ctnHubNodeIndex;

            const docCtnNode = Catenis.db.collection.CatenisNode.findOne({
                ctnNodeIndex: ctnNodeIndex
            }, {
                fields: {
                    _id: 1
                }
            });

            if (docCtnNode === undefined) {
                // Subscription made with an invalid Catenis node index.
                //  Log error, make sure that subscription is not started and throw exception
                Catenis.logger.ERROR('Subscription to method \'catenisClients\' made with an invalid Catenis node index', {ctnNodeIndex: ctnNodeIndex});
                this.stop();
                throw new Meteor.Error('clients.subscribe.catenis-clients.invalid-param', 'Subscription to method \'catenisClients\' made with an invalid Catenis node index');
            }

            return Catenis.db.collection.Client.find({
                catenisNode_id: docCtnNode._id,
                status: {
                    $ne: 'deleted'
                }
            }, {
                fields: {
                    _id: 1,
                    clientId: 1,
                    props: 1,
                    status: 1
                }
            });
        }
        else {
            // User not logged in or not a system administrator
            //  Make sure that publication is not started and throw exception
            this.stop();
            throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
        }
    });

    Meteor.publish('clientRecord', function (client_id) {
        if (Roles.userIsInRole(this.userId, 'sys-admin')) {
            return Catenis.db.collection.Client.find({
                _id: client_id
            }, {
                fields: {
                    _id: 1,
                    user_id: 1,
                    clientId: 1,
                    index: 1,
                    props: 1,
                    timeZone: 1,
                    status: 1
                }
            });
        }
        else {
            // User not logged in or not a system administrator
            //  Make sure that publication is not started and throw exception
            this.stop();
            throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
        }
    });

    Meteor.publish('clientUser', function (client_id) {
        if (Roles.userIsInRole(this.userId, 'sys-admin')) {
            return Meteor.users.find({
                'catenis.client_id': client_id
            }, {
                fields: {
                    _id: 1,
                    emails: 1
                }
            });
        }
        else {
            // User not logged in or not a system administrator
            //  Make sure that publication is not started and throw exception
            this.stop();
            throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
        }
    });

    Meteor.publish('ownedDomains', function (client_id) {
        if (Roles.userIsInRole(this.userId, 'sys-admin')) {
            CommonOwnedDomainsUI.ownedDomains.call(this, client_id);
        }
        else {
            // User not logged in or not a system administrator
            //  Make sure that publication is not started and throw exception
            this.stop();
            throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
        }
    });

    Meteor.publish('allLicenses', function() {
        if (Roles.userIsInRole(this.userId, 'sys-admin')) {
            return Catenis.db.collection.License.find({
                status: License.status.active.name
            });
        }
        else {
            // User not logged in or not a system administrator
            //  Make sure that publication is not started and throw exception
            this.stop();
            throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
        }
    });

    Meteor.publish('currentClientLicense', function(client_id) {
        if (Roles.userIsInRole(this.userId, 'sys-admin')) {
            return Catenis.db.collection.ClientLicense.find({
                client_id: client_id,
                status: {
                    $in: [
                        ClientLicense.status.active.name,
                        ClientLicense.status.provisioned.name
                    ]
                }
            }, {
                fields: {
                    _id: 1,
                    client_id: 1,
                    license_id: 1,
                    validity: 1,
                    status: 1,
                    activatedDate: 1
                }
            });
        }
        else {
            // User not logged in or not a system administrator
            //  Make sure that publication is not started and throw exception
            this.stop();
            throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
        }
    });

    Meteor.publish('currentLicense', function(client_id) {
        if (Roles.userIsInRole(this.userId, 'sys-admin')) {
            // Variable used to control doc/recs sent to other party
            const docIdCounter = new Map();
            
            const observeHandle = Catenis.db.collection.ClientLicense.find({
                client_id: client_id,
                status: ClientLicense.status.active.name
            }, {
                fields: {
                    _id: 1,
                    license_id: 1
                }
            }).observe({
                added: (doc) => {
                    // Check if doc/rec has not yet been sent to other party
                    if (!docIdCounter.has(doc.license_id) || docIdCounter.get(doc.license_id) === 0) {
                        const docLicense = Catenis.db.collection.License.findOne({
                            _id: doc.license_id
                        }, {
                            fields: {
                                _id: 1,
                                level: 1,
                                type: 1,
                                maximumDevices: 1
                            }
                        });

                        this.added('License', docLicense._id, {
                            level: docLicense.level,
                            type: docLicense.type,
                            maximumDevices: docLicense.maximumDevices
                        });
                        
                        // Indicate that doc/rec has been sent
                        docIdCounter.set(doc.license_id, 1);
                    }
                    else {
                        // Doc/rec already sent. Just increment counter
                        docIdCounter.set(doc.license_id, docIdCounter.get(doc.license_id) + 1);
                    }
                },
                changed: (newDoc, oldDoc) => {
                    // Only do anything if License database doc/rec has changed.
                    //  Note: this should never happen, but we do it for robustness
                    if (newDoc.license_id !== oldDoc.license_id) {
                        // Process exclusion first
                        let counter;
                        
                        if (docIdCounter.has(oldDoc.license_id) && (counter = docIdCounter.get(oldDoc.license_id)) > 0) {
                            // Decrement counter
                            docIdCounter.set(oldDoc.license_id, --counter);
                            
                            if (counter === 0) {
                                // Exclude sent doc/rec
                                this.removed('License', oldDoc.license_id);
                            }
                        }
                        else {
                            // Inconsistent state. Log error
                            Catenis.logger.ERROR('Inconsistent License database doc/rec counter in \'currentLicense\' publication, \'changed\' event', {
                                oldDoc: oldDoc,
                                newDoc: newDoc,
                                docIdCounter: docIdCounter
                            })
                        }
                        
                        // Process addition now

                        // Check if doc/rec has not yet been sent to other party
                        if (!docIdCounter.has(newDoc.license_id) || docIdCounter.get(newDoc.license_id) === 0) {
                            const docLicense = Catenis.db.collection.License.findOne({
                                _id: newDoc.license_id
                            }, {
                                fields: {
                                    _id: 1,
                                    level: 1,
                                    type: 1,
                                    maximumDevices: 1
                                }
                            });

                            this.added('License', docLicense._id, {
                                level: docLicense.level,
                                type: docLicense.type,
                                maximumDevices: docLicense.maximumDevices
                            });

                            // Indicate that doc/rec has been sent
                            docIdCounter.set(newDoc.license_id, 1);
                        }
                        else {
                            // Doc/rec already sent. Just increment counter
                            docIdCounter.set(newDoc.license_id, docIdCounter.get(newDoc.license_id) + 1);
                        }
                    }
                },
                removed: (doc) => {
                    let counter;

                    if (docIdCounter.has(doc.license_id) && (counter = docIdCounter.get(doc.license_id)) > 0) {
                        // Decrement counter
                        docIdCounter.set(doc.license_id, --counter);

                        if (counter === 0) {
                            // Exclude sent doc/rec
                            this.removed('License', doc.license_id);
                        }
                    }
                    else {
                        // Inconsistent state. Log error
                        Catenis.logger.ERROR('Inconsistent License database doc/rec counter in \'currentLicense\' publication, \'removed\' event', {
                            oldDoc: doc,
                            docIdCounter: docIdCounter
                        })
                    }
                }
            });

            this.ready();

            this.onStop(() => observeHandle.stop());
        }
        else {
            // User not logged in or not a system administrator
            //  Make sure that publication is not started and throw exception
            this.stop();
            throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
        }
    });

    Meteor.publish('allClientLicenses', function(client_id) {
        if (Roles.userIsInRole(this.userId, 'sys-admin')) {
            return Catenis.db.collection.ClientLicense.find({
                client_id: client_id
            });
        }
        else {
            // User not logged in or not a system administrator
            //  Make sure that publication is not started and throw exception
            this.stop();
            throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
        }
    });

    Meteor.publish('allClientLicenseLicenses', function(client_id) {
        if (Roles.userIsInRole(this.userId, 'sys-admin')) {
            // Include not only License database doc/recs associated with all ClientLicense database doc/recs
            //  for a given client but also all currently active License database doc/recs

            const docIdCounter = new Map();
            
            // Look for all active License database doc/recs
            const observeHandle = Catenis.db.collection.License.find({
                status: License.status.active.name
            }, {
                fields: {
                    _id: 1,
                    level: 1,
                    order: 1,
                    type: 1,
                    revision: 1,
                    maximumDevices: 1,
                    status: 1
                }
            }).observe({
                added: (doc) => {
                    // Check if doc/rec has not yet been sent to other party
                    if (!docIdCounter.has(doc._id) || docIdCounter.get(doc._id) === 0) {
                        this.added('License', doc._id, {
                            level: doc.level,
                            order: doc.order,
                            type: doc.type,
                            revision: doc.revision,
                            maximumDevices: doc.maximumDevices,
                            status: doc.status
                        });

                        // Indicate that doc/rec has been sent
                        docIdCounter.set(doc._id, 1);
                    }
                    else {
                        // Doc/rec already sent. Just increment counter
                        docIdCounter.set(doc._id, docIdCounter.get(doc._id) + 1);
                    }
                },
                // Note: no need to monitor changes since we assume that the fields of License database docs/recs
                //      already active cannot be changed
                removed: (doc) => {
                    let counter;

                    if (docIdCounter.has(doc._id) && (counter = docIdCounter.get(doc._id)) > 0) {
                        // Decrement counter
                        docIdCounter.set(doc._id, --counter);

                        if (counter === 0) {
                            // Exclude sent doc/rec
                            this.removed('License', doc._id);
                        }
                    }
                    else {
                        // Inconsistent state. Log error
                        Catenis.logger.ERROR('Inconsistent License database doc/rec counter in \'allClientLicenseLicenses\' publication, \'removed\' event of observe #1', {
                            oldDoc: doc,
                            docIdCounter: docIdCounter
                        })
                    }
                }
            });

            this.onStop(() => {
                observeHandle.stop();
            });

            // Call auxiliary method to include License database doc/recs associated with all ClientLicense
            //  database doc/recs for the current client
            CommonClientLicenseUI.clientAllClientLicenseLicenses.call(this, 'allClientLicenseLicenses', client_id, docIdCounter);

            this.ready();
        }
        else {
            // User not logged in or not a system administrator
            //  Make sure that publication is not started and throw exception
            this.stop();
            throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
        }
    });

    Meteor.publish('singleClientLicense', function(client_id, clientLicense_id) {
        if (Roles.userIsInRole(this.userId, 'sys-admin')) {
            // Include not only the client license identified by the supplied ID but also
            //  any client license for the specified client that is provisioned
            return Catenis.db.collection.ClientLicense.find({
                $or: [{
                    _id: clientLicense_id
                }, {
                    client_id: client_id,
                    status: ClientLicense.status.provisioned.name
                }]
            });
        }
        else {
            // User not logged in or not a system administrator
            //  Make sure that publication is not started and throw exception
            this.stop();
            throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
        }
    });

    Meteor.publish('singleClientLicenseLicenses', function(client_id, clientLicense_id) {
        if (Roles.userIsInRole(this.userId, 'sys-admin')) {
            // include not only License database doc/recs associated with a specific client license
            //  but also all currently active License database doc/recs

            const docIdCounter = new Map();

            // Look for all active License database doc/recs
            const observeHandle = Catenis.db.collection.License.find({
                status: License.status.active.name
            }, {
                fields: {
                    _id: 1,
                    level: 1,
                    order: 1,
                    type: 1,
                    revision: 1,
                    maximumDevices: 1,
                    status: 1
                }
            }).observe({
                added: (doc) => {
                    // Check if doc/rec has not yet been sent to other party
                    if (!docIdCounter.has(doc._id) || docIdCounter.get(doc._id) === 0) {
                        this.added('License', doc._id, {
                            level: doc.level,
                            order: doc.order,
                            type: doc.type,
                            revision: doc.revision,
                            maximumDevices: doc.maximumDevices,
                            status: doc.status
                        });

                        // Indicate that doc/rec has been sent
                        docIdCounter.set(doc._id, 1);
                    }
                    else {
                        // Doc/rec already sent. Just increment counter
                        docIdCounter.set(doc._id, docIdCounter.get(doc._id) + 1);
                    }
                },
                // Note: no need to monitor changes since we assume that the fields of License database docs/recs
                //      already active cannot be changed
                removed: (doc) => {
                    let counter;

                    if (docIdCounter.has(doc._id) && (counter = docIdCounter.get(doc._id)) > 0) {
                        // Decrement counter
                        docIdCounter.set(doc._id, --counter);

                        if (counter === 0) {
                            // Exclude sent doc/rec
                            this.removed('License', doc._id);
                        }
                    }
                    else {
                        // Inconsistent state. Log error
                        Catenis.logger.ERROR('Inconsistent License database doc/rec counter in \'singleClientLicenseLicenses\' publication, \'removed\' event of observe #1', {
                            oldDoc: doc,
                            docIdCounter: docIdCounter
                        })
                    }
                }
            });

            // Look for License database docs/recs associated with the specified client license
            //  or any provisioned client license associated with the specified client
            const observeHandle2 = Catenis.db.collection.ClientLicense.find({
                $or: [{
                    _id: clientLicense_id
                }, {
                    client_id: client_id,
                    status: ClientLicense.status.provisioned.name
                }]
            }, {
                fields: {
                    _id: 1,
                    license_id: 1
                }
            }).observe({
                added: (doc) => {
                    // Check if doc/rec has not yet been sent to other party
                    if (!docIdCounter.has(doc.license_id) || docIdCounter.get(doc.license_id) === 0) {
                        const docLicense = Catenis.db.collection.License.findOne({
                            _id: doc.license_id
                        }, {
                            fields: {
                                _id: 1,
                                level: 1,
                                order: 1,
                                type: 1,
                                revision: 1,
                                maximumDevices: 1,
                                status: 1
                            }
                        });

                        this.added('License', docLicense._id, {
                            level: docLicense.level,
                            order: docLicense.order,
                            type: docLicense.type,
                            revision: docLicense.revision,
                            maximumDevices: docLicense.maximumDevices,
                            status: docLicense.status
                        });

                        // Indicate that doc/rec has been sent
                        docIdCounter.set(doc.license_id, 1);
                    }
                    else {
                        // Doc/rec already sent. Just increment counter
                        docIdCounter.set(doc.license_id, docIdCounter.get(doc.license_id) + 1);
                    }
                },
                changed: (newDoc, oldDoc) => {
                    // Only do anything if License database doc/rec has changed.
                    //  Note: this should never happen, but we do it for robustness
                    if (newDoc.license_id !== oldDoc.license_id) {
                        // Process exclusion first
                        let counter;

                        if (docIdCounter.has(oldDoc.license_id) && (counter = docIdCounter.get(oldDoc.license_id)) > 0) {
                            // Decrement counter
                            docIdCounter.set(oldDoc.license_id, --counter);

                            if (counter === 0) {
                                // Exclude sent doc/rec
                                this.removed('License', oldDoc.license_id);
                            }
                        }
                        else {
                            // Inconsistent state. Log error
                            Catenis.logger.ERROR('Inconsistent License database doc/rec counter in \'singleClientLicenseLicenses\' publication, \'changed\' event of observe #2', {
                                oldDoc: oldDoc,
                                newDoc: newDoc,
                                docIdCounter: docIdCounter
                            })
                        }

                        // Process addition now

                        // Check if doc/rec has not yet been sent to other party
                        if (!docIdCounter.has(newDoc.license_id) || docIdCounter.get(newDoc.license_id) === 0) {
                            const docLicense = Catenis.db.collection.License.findOne({
                                _id: newDoc.license_id
                            }, {
                                fields: {
                                    _id: 1,
                                    level: 1,
                                    order: 1,
                                    type: 1,
                                    revision: 1,
                                    maximumDevices: 1,
                                    status: 1
                                }
                            });

                            this.added('License', docLicense._id, {
                                level: docLicense.level,
                                order: docLicense.order,
                                type: docLicense.type,
                                revision: docLicense.revision,
                                maximumDevices: docLicense.maximumDevices,
                                status: docLicense.status
                            });

                            // Indicate that doc/rec has been sent
                            docIdCounter.set(newDoc.license_id, 1);
                        }
                        else {
                            // Doc/rec already sent. Just increment counter
                            docIdCounter.set(newDoc.license_id, docIdCounter.get(newDoc.license_id) + 1);
                        }
                    }
                },
                removed: (doc) => {
                    let counter;

                    if (docIdCounter.has(doc.license_id) && (counter = docIdCounter.get(doc.license_id)) > 0) {
                        // Decrement counter
                        docIdCounter.set(doc.license_id, --counter);

                        if (counter === 0) {
                            // Exclude sent doc/rec
                            this.removed('License', doc.license_id);
                        }
                    }
                    else {
                        // Inconsistent state. Log error
                        Catenis.logger.ERROR('Inconsistent License database doc/rec counter in \'singleClientLicenseLicenses\' publication, \'removed\' event of observe #2', {
                            oldDoc: doc,
                            docIdCounter: docIdCounter
                        })
                    }
                }
            });

            this.ready();

            this.onStop(() => {
                observeHandle.stop();
                observeHandle2.stop();
            });
        }
        else {
            // User not logged in or not a system administrator
            //  Make sure that publication is not started and throw exception
            this.stop();
            throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
        }
    });

    Meteor.publish('serviceAccountBalance', function (client_id) {
        if (Roles.userIsInRole(this.userId, 'sys-admin')) {
            // Get client object
            let client;

            try {
                client = Client.getClientByDocId(client_id);
            }
            catch (err) {
                // Subscription made with an invalid Client doc/rec ID.
                //  Make sure that publication is not started, log error and throw exception
                this.stop();
                Catenis.logger.ERROR('Subscription to method \'serviceAccountBalance\' made with an invalid client', {client_id: client_id});
                throw new Meteor.Error('clients.subscribe.service-account-balance.invalid-param', 'Subscription to method \'serviceAccountBalance\' made with an invalid client');
            }

            CommonServiceAccountUI.clientServiceAccountBalance.call(this, client);
        }
        else {
            // User not logged in or not a system administrator
            //  Make sure that publication is not started and throw exception
            this.stop();
            throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
        }
    });

    Meteor.publish('bcotPayment', function (bcotPayAddress) {
        if (Roles.userIsInRole(this.userId, 'sys-admin')) {
            const typeAndPath = Catenis.keyStore.getTypeAndPathByAddress(bcotPayAddress);

            if (typeAndPath === null || typeAndPath.type !== KeyStore.extKeyType.cln_bcot_pay_addr.name) {
                // Subscription made with an invalid address. Log error and throw exception
                Catenis.logger.ERROR('Subscription to method \'bcotPayment\' made with an invalid address', {bcotPayAddress: bcotPayAddress});
                throw new Meteor.Error('clients.subscribe.bcot-payment.invalid-param', 'Subscription to method \'bcotPayment\' made with an invalid address');
            }

            CommonServiceAccountUI.bcotPayment.call(this, typeAndPath);
        }
        else {
            // User not logged in or not a system administrator
            //  Make sure that publication is not started and throw exception
            this.stop();
            throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
        }
    });

    Meteor.publish('foreignBcConsumptionProfiles', function () {
        if (Roles.userIsInRole(this.userId, 'sys-admin')) {
            for (const key of Object.keys(ForeignBlockchain.consumptionProfile)) {
                // Add record
                this.added('ForeignBcConsumptionProfile', key, {
                    name: ForeignBlockchain.consumptionProfile[key].name
                });
            }

            this.ready();
        }
        else {
            // User not logged in or not a system administrator
            //  Make sure that publication is not started and throw exception
            this.stop();
            throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
        }
    });

    Meteor.publish('foreignBlockchains', function (client_id) {
        if (Roles.userIsInRole(this.userId, 'sys-admin')) {
            // Get client object
            let client;

            try {
                client = Client.getClientByDocId(client_id);
            }
            catch (err) {
                // Subscription made with an invalid Client doc/rec ID.
                //  Make sure that publication is not started, log error and throw exception
                this.stop();
                Catenis.logger.ERROR('Subscription to method \'foreignBlockchains\' made with an invalid client', {client_id: client_id});
                throw new Meteor.Error('clients.subscribe.foreign-blockchains.invalid-param', 'Subscription to method \'foreignBlockchains\' made with an invalid client');
            }

            CommonClientForeignBlockchainsUI.foreignBlockchains.call(this, client);
        }
        else {
            // User not logged in or not a system administrator
            //  Make sure that publication is not started and throw exception
            this.stop();
            throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
        }
    });

    Meteor.publish('foreignBlockchainRecord', function (client_id, blockchainKey) {
        if (Roles.userIsInRole(this.userId, 'sys-admin')) {
            // Get client object
            let client;

            try {
                client = Client.getClientByDocId(client_id);
            }
            catch (err) {
                // Subscription made with an invalid Client doc/rec ID.
                //  Make sure that publication is not started, log error and throw exception
                this.stop();
                Catenis.logger.ERROR('Subscription to method \'foreignBlockchainRecord\' made with an invalid client', {client_id: client_id});
                throw new Meteor.Error('clients.subscribe.foreign-blockchain-record.invalid-param', 'Subscription to method \'foreignBlockchainRecord\' made with an invalid client');
            }

            // Get foreign blockchain
            const blockchain = Catenis.foreignBlockchains.get(blockchainKey);

            if (!blockchain) {
                // Subscription made with an invalid foreign blockchain key.
                //  Make sure that publication is not started, log error and throw exception
                this.stop();
                Catenis.logger.ERROR('Subscription to method \'foreignBlockchainRecord\' made with an invalid foreign blockchain key', {key: blockchainKey});
                throw new Meteor.Error('clients.subscribe.foreign-blockchain-record.invalid-param', 'Subscription to method \'foreignBlockchainRecord\' made with an invalid foreign blockchain');
            }

            CommonClientForeignBlockchainsUI.foreignBlockchainRecord.call(this, client, blockchain);
        }
        else {
            // User not logged in or not a system administrator
            //  Make sure that publication is not started and throw exception
            this.stop();
            throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
        }
    });
};


// ClientsUI function class (public) properties
//

/*ClientsUI.prop = {};*/


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(ClientsUI);
