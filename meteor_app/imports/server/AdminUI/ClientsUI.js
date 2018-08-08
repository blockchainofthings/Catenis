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
//import config from 'config';
// Meteor packages
import { Meteor } from 'meteor/meteor';
import { Accounts } from 'meteor/accounts-base'

// References code in other (Catenis) modules
import { Catenis } from '../Catenis';
import { CatenisNode } from '../CatenisNode';
import { Client } from '../Client';
import { ClientLicense } from '../ClientLicense';
import { License } from '../License';

const maxMsgCreditsCount = 100;

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

                // Try to create Catenis client
                let clientId;

                try {
                    clientId = CatenisNode.getCatenisNodeByIndex(ctnNodeIndex).createClient(props, null, {
                        createUser: true,
                        username: clientInfo.username,
                        email: clientInfo.email,
                        sendEnrollmentEmail: true,
                        timeZone: clientInfo.timeZone
                    });
                }
                catch (err) {
                    // Error trying to create Catenis client. Log error and throw exception
                    Catenis.logger.ERROR('Failure trying to create new Catenis client.', err);
                    throw new Meteor.Error('client.create.failure', 'Failure trying to create new Catenis client: ' + err.toString());
                }

                return clientId;
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
                try {
                    // Try to retrieve client associated with given user
                    const client = Client.getClientByUserId(user_id);

                    if (client.status === Client.status.new.name) {
                        client.activate();
                    }
                }
                catch (err) {
                    // Error trying to activate client. Log error and throw exception
                    Catenis.logger.ERROR('Failure trying to activate Catenis client.', err);
                    throw new Meteor.Error('client.activate.failure', 'Failure trying to activate Catenis client: ' + err.toString());
                }
            }
            else {
                // User not logged in or not a system administrator.
                //  Throw exception
                throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
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
                    const client = Client.getClientByDocId(client_id);

                    return client.apiAccessSecret;
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
                    const client = Client.getClientByDocId(client_id);

                    client.renewApiAccessGenKey(resetAllDevicesToo);
                }
                catch (err) {
                    // Error trying to get client's API access secret. Log error and throw exception
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


        addMessageCredits: function (clientId, count) {
            if(verifyUserRole()) {
                if (!Number.isInteger(count) || count < 0 || count > maxMsgCreditsCount) {
                    // Invalid number of message credits to add. Log error and throw exception
                    Catenis.logger.ERROR(util.format('Invalid number of message credits to add. Make sure that it is a positive integer not greater than %s', maxMsgCreditsCount.toString()), {count: count});
                    throw new Meteor.Error('clients.add-msg-credits.invalid-param', util.format('Invalid number of message credits to add. Make sure that it is a positive integer not greater than %s', maxMsgCreditsCount.toString()));
                }

                Client.getClientByClientId(clientId).addMessageCredit(count);
            }else{

                Catenis.logger.ERROR('User does not have permission to access method "addMessageCredits"');
                throw new Meteor.Error('User does not have permission to access method "addMessageCredits"');

            }
        },


        //added by peter to allow for resending enrollment email.

        //added by peter to allow Meteor account activation on enrollment. called from ../both/ConfigAccounts.js

        activateCurrentUser: function(){
            if( Meteor.user().profile.status!=="Pending" ){
                Catenis.logger.ERROR('Failure trying to activate Meteor user. User is not "pending". ');
                throw new Meteor.Error('client.activateCurrentUser.failure', 'Failure trying to activate current user: User is not "pending"');
            }else{
                try{
                    Meteor.users.update(Meteor.userId(), {$set: {'profile.status': "Activated"}});
                }catch(err){

                    Catenis.logger.ERROR('Failure trying to activate Meteor user.', err);
                    throw new Meteor.Error('client.activateCurrentUser.failure', 'Failure trying to activate current user: ' + err.toString());
                }
            }
        },

        //added by peter to allow admin Meteor account deactivation and activation. called from ClientDetailsTemplate
        changeUserStatus: function(user_id, newStatus){
            let user;
            if(verifyUserRole()){
                try{
                    user=Meteor.users.findOne({"_id": user_id});
                    Meteor.users.update( user, {$set: {'profile.status': newStatus}});
                }catch(err){
                    Catenis.logger.ERROR('Failure trying to change user Status Meteor user.', err);
                    throw new Meteor.Error('client.changeUserStatus.failure', 'Failure trying to change user active status: ' + err.toString());
                }
            }else{
                Catenis.logger.ERROR('User does not have permission to access method "changeUserStatus"');
                throw new Meteor.Error('User does not have permission to access method "changeUserStatus"');
            }

        },
        createUserToEnroll: function (ctnNodeIndex, clientInfo) {
            // Try to create meteor client user
            let user_id;
            let currTime= new Date();

            if(verifyUserRole()){
                try {

                    const opts = {
                        username: clientInfo.username,
                        //got rid of this, as the users will be setting this on their own.
                        // password: clientInfo.psw,

                        // below email and status were added by peter
                        //added this field to send emails.
                        email: clientInfo.email,

                        profile: {
                            name: 'User for Catenis client ' + clientInfo.name,
                            status: "Pending",
                            firstname: clientInfo.firstName,
                            lastname: clientInfo.lastName,
                            company: clientInfo.companyName,
                            license: {
                                licenseType: "Starter",
                                licenseRenewedDate: currTime,
                            },
                            ctnNodeIndex: ctnNodeIndex

                        },


                    };

                    user_id = Accounts.createUser(opts);
                    // peter:  adding this to allow for enrollment email when meteor account is created.
                    Accounts.sendEnrollmentEmail(user_id);
                }

                catch (err) {
                    // Error trying to create meteor user for client. Log error and throw exception
                    Catenis.logger.ERROR('Failure trying to create new user for client.', err);
                    throw new Meteor.Error('client.create-user.failure', 'Failure trying to create new user for client: ' + err.toString());
                }

                return user_id;

            }else{
                Catenis.logger.ERROR('User does not have permission to access method "createClient"');
                throw new Meteor.Error('User does not have permission to access method "createClient"');
            }
        },


        //create Client on enrollment
        createClient: function(user_id){


            // Try to create Catenis client
            let clientId;

            //initially set clientName as user's first&lastName, then later set it to companyName
            let clientName=  Meteor.users.findOne({_id: user_id}).profile.firstName;
            let ctnNodeIndex= Meteor.users.findOne({_id: user_id}).profile.ctnNodeIndex;

            try {
                clientId = CatenisNode.getCatenisNodeByIndex(ctnNodeIndex).createClient(clientName, user_id);
            }
            catch (err) {
                // Error trying to create Catenis client. Log error and throw exception
                Catenis.logger.ERROR('Failure trying to create new Catenis client.', err);
                throw new Meteor.Error('client.create.failure', 'Failure trying to create new Catenis client: ' + err.toString());
            }

            // return clientId;

        },



        //update user's information including the password, email, first and last name, as well as company name.
        //license information is handled on a separate function at updateLicenseAdmin, which is right below this function.
        updateUser: function (clientInfo) {

            const userValue=Meteor.user();

            //    Either has to be in sys-admin role, or the user has to be changing his or her own profile
            const superUser= verifyUserRole();
            const ownProfile= (userValue.username===clientInfo.username);

            if( superUser || ownProfile) {

                try{
                    const user = Meteor.users.findOne({username: clientInfo.username});
                    if (clientInfo.pwd) {
                        //    update client Password
                        try {
                            Accounts.setPassword(user._id, clientInfo.pwd, {logout: !ownProfile});

                        } catch (err) {
                            Catenis.logger.ERROR('Failure trying to update Catenis user pwd', err);
                            throw new Meteor.Error('client.update.failure', 'Failure trying to update user pwd: ' + err.toString());
                        }

                    }
                    //assuming one email per user. ensure that user does not attempt to set email to an email that already exists.
                    if(user.emails && user.emails[0]){

                        if (user.emails && clientInfo.email !== user.emails[0].address) {

                            //update user email
                            let pastEmail = user.emails[0].address;

                            try {
                                Accounts.addEmail(user._id, clientInfo.email);
                            } catch (err) {
                                Catenis.logger.ERROR('Failure trying to update Catenis user email', err);
                                throw new Meteor.Error('client.update.failure', 'Failure trying to update user email: ' + err.toString());
                            }
                            //    if the email was succesfully added, remove the past email
                            try {
                                Accounts.removeEmail(user._id, pastEmail);
                            } catch (err) {
                                Catenis.logger.ERROR('Failure trying to update Catenis user email (delete)', err);
                                throw new Meteor.Error('client.update.failure', 'Failure trying to update user email(delete): ' + err.toString());
                            }
                        }

                    }else{
                        try {

                            Accounts.addEmail(user._id, clientInfo.email);
                        } catch (err) {
                            Catenis.logger.ERROR('Failure trying to update Catenis user email', err);
                            throw new Meteor.Error('client.update.failure', 'Failure trying to update user email: ' + err.toString());
                        }

                    }
                    Meteor.users.update
                    (user,
                        {
                            $set: {
                                'profile.name': clientInfo.name, 'profile.firstname': clientInfo.firstName,
                                'profile.lastname': clientInfo.lastName, 'profile.company': clientInfo.companyName
                            }
                        }
                    );


                }catch(err){
                    Catenis.logger.ERROR('Failure trying to update Catenis user', err);
                    throw new Meteor.Error('client.update.failure', 'Failure trying to update user: ' + err.toString());
                }
            }else{
                Catenis.logger.ERROR('User does not have permission to access method "updateUser"');
                throw new Meteor.Error('User does not have permission to access method "updateUser"');
            }
        },

        //update user license. At this time, it is designed so that only the admin user can update this.
        //this means that users have to request via call/messaging, which will be handled by the admin who logs in and manually changes it.
        //integration with Payment must also be considered in the future.

        updateLicenseAdmin: function(client, newLicenseState){

            if(verifyUserRole()){

                //verify that the user has less devices then would be given by the new license.
                const numUserDevices= Catenis.db.collection.Device.find( {"client_id": {$eq: client._id } } ).count();
                const numDevicesforLicense= Catenis.db.collection.License.findOne({licenseType: newLicenseState}).numAllowedDevices;
                if( numUserDevices > numDevicesforLicense){

                    Catenis.logger.ERROR('Client has too many devices to be reverted into license type: '+ newLicenseState);
                    throw new Meteor.Error('Client has too many devices to be reverted into license type: '+ newLicenseState);

                }else{

                    try{
                        Meteor.users.update(client.user_id,
                            {
                                $set: {
                                    'profile.license.licenseType': newLicenseState,
                                    'profile.license.licenseRenewedDate': new Date(),
                                }
                            }
                        );

                        //    this would be a good place to make corresponding change to the amount of devices that the user can hold.
                        //    Need to discuss what retroactive actions can be taken to remove devices should the user downgrade the license

                    }catch(err){
                        Catenis.logger.ERROR('Failure trying to update user License ', err);
                        throw new Meteor.Error('client.updateLicenseAdmin.failure', 'Failure trying to update user License: ' + err.toString());
                    }

                }
            }else{
                Catenis.logger.ERROR('User does not have permission to access method "updateLicenseAdmin"');
                throw new Meteor.Error('User does not have permission to access method "updateLicenseAdmin"');
            }

        },

        updateLicenseConfig: function(newConfiguration){
            if(verifyUserRole()){

                Catenis.db.collection.License.update({licenseType: "Starter"}, {$set:{numAllowedDevices:newConfiguration.starter}});
                Catenis.db.collection.License.update({licenseType: "Basic"}, {$set:{numAllowedDevices:newConfiguration.basic}});
                Catenis.db.collection.License.update({licenseType: "Professional"}, {$set:{numAllowedDevices:newConfiguration.professional}});
                Catenis.db.collection.License.update({licenseType: "Enterprise"}, {$set:{numAllowedDevices:newConfiguration.enterprise}});

            }else{

                Catenis.logger.ERROR('User does not have permission to access method "updateLicenseConfig"');
                throw new Meteor.Error('User does not have permission to access method "updateLicenseConfig"');
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
                    username: 1,
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
            // include not only License database doc/recs associated with all ClientLicense database doc/recs
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
            
            // Look for License database docs/recs associated with all ClientLicense database docs/recs for a given client
            const observeHandle2 = Catenis.db.collection.ClientLicense.find({
                client_id: client_id
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
                            Catenis.logger.ERROR('Inconsistent License database doc/rec counter in \'allClientLicenseLicenses\' publication, \'changed\' event of observe #2', {
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
                        Catenis.logger.ERROR('Inconsistent License database doc/rec counter in \'allClientLicenseLicenses\' publication, \'removed\' event of observe #2', {
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
};


// ClientsUI function class (public) properties
//

/*ClientsUI.prop = {};*/


// Definition of module (private) functions
//

// Ensure user is in sys-admin role to call certain functions.
function verifyUserRole() {
    try{
        const user = Meteor.user();
        if (user && user.roles && user.roles.includes('sys-admin')) {
            return true;
        }
        else {
            return false;
        }

    }
    catch (err) {
        Catenis.logger.ERROR('Failure trying to verify Meteor user role.', err);
        throw new Meteor.Error('client.verifyUserRole.failure', 'Failure trying to verify role of current user: ' + err.toString());
    }
}


// Module code
//

// Lock function class
Object.freeze(ClientsUI);
