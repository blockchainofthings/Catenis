/**
 * Created by Claudio on 2017-05-23.
 */

//console.log('[ClientsUI.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
//import config from 'config';
// Meteor packages
import { Meteor } from 'meteor/meteor';
import { Accounts } from 'meteor/accounts-base'

// References code in other (Catenis) modules
import { Catenis } from '../Catenis';
import { CatenisNode } from '../CatenisNode';
import { Client } from '../Client';


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
        resendEnrollmentEmail: function(clientId){
            if(verifyUserRole()) {
                try {
                    Accounts.sendEnrollmentEmail(clientId);
                }catch(err){
                    Catenis.logger.ERROR('Failure trying to resend enrollment Email to client.', err);
                    throw new Meteor.Error('client.resendEnrollmentEmail.failure', 'Failure trying to resend enrollment Email: ' + err.toString());
                }
            }else{
                Catenis.logger.ERROR('User does not have permission to access method "resendEnrollmentEmail"');
                throw new Meteor.Error('User does not have permission to access method "resendEnrollmentEmail"');
            }

        },

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
        },


        renewClientAPIKey: function(userId, resetAllDeviceKey){

            if(verifyUserRole()){

                var client= Client.getClientByUserId(userId);
                client.renewApiAccessGenKey(resetAllDeviceKey) ;
                return client.apiAccessGenKey;

            }else{

                Catenis.logger.ERROR('User does not have permission to access method "renewClientAPIKey"');
                throw new Meteor.Error('User does not have permission to access method "renewClientAPIKey"');
            }

        }
    });


    // Declaration of publications
    Meteor.publish('catenisClients', function (ctnNodeIndex) {
        if (Roles.userIsInRole(this.userId, 'sys-admin')) {
            ctnNodeIndex = ctnNodeIndex || Catenis.application.ctnHubNodeIndex;

            const ctnNode = CatenisNode.getCatenisNodeByIndex(ctnNodeIndex);

            return Catenis.db.collection.Client.find({
                catenisNode_id: ctnNode.doc_id,
                status: {$ne: 'deleted'}
            }, {
                fields: {
                    _id: 1,
                    user_id: 1,
                    clientId: 1,
                    index: 1,
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

    Meteor.publish('clientRecord', function (user_id) {
        return Catenis.db.collection.Client.find({
            user_id: user_id
        }, {
            fields: {
                _id: 1,
                user_id: 1,
                clientId: 1,
                index: 1,
                props: 1,
                status: 1
            }
        });
    });

    Meteor.publish('clientUser', function (user_id) {
        const client = Catenis.db.collection.Client.findOne({user_id: user_id}, {fields: {user_id: 1}});

        if (client && client.user_id) {
            return Meteor.users.find({_id: client.user_id}, {
                fields: {
                    _id: 1,
                    username: 1,
                    //below added to allow user activation status access.
                    profile:1,
                    //below added to allow license information access.
                }
            });
        }
        else {
            // Nothing to return
            return this.ready();
        }

    });
    //userList returns the information of all user details the user has access to.
    //currently, only differentiates if the user is super user or not.
    Meteor.publish('userList', function(userInfo){

        const user = userInfo;
        if (user) {
            if(user.roles && user.roles.includes('sys-admin')){
                return Meteor.users.find();
            }else{
                return user;
            }
        }
        else {
            // Nothing to return
            return this.ready();
        }
    });

    Meteor.publish('license', function(){

        return Catenis.db.collection.License.find({});

    });

    /*Meteor.publish('clientMessageCredits', function (user_id) {

        let client_id= Catenis.db.collection.Client.findOne({user_id: user_id}).client_id;

        const messageCreditCount = {
            unconfirmed: 0,
            confirmed: 0
        };
        let initializing = true;

        const observeHandle = Catenis.db.collection.ServiceCredit.find({
            client_id: client_id,
            srvCreditType: Client.serviceCreditType.message,
            remainCredits: {$gt: 0}
        },
        {   fields: {
                _id: 1,
                'fundingTx.confirmed': 1,
                remainCredits: 1
            }
        }).observe({
            added: (doc) => {
                // Adjust message credits
                if (doc.fundingTx.confirmed) {
                    messageCreditCount.confirmed += doc.remainCredits;
                }
                else {
                    messageCreditCount.unconfirmed += doc.remainCredits;
                }

                if (!initializing) {
                    this.changed('MessageCredits', 1, {
                        unconfirmed: messageCreditCount.unconfirmed.toLocaleString(),
                        confirmed: messageCreditCount.confirmed.toLocaleString()
                    });
                }
            },

            changed: (newDoc, oldDoc) => {
                // Adjust message credits
                if (oldDoc.fundingTx.confirmed) {
                    messageCreditCount.confirmed -= oldDoc.remainCredits;
                }
                else {
                    messageCreditCount.unconfirmed -= oldDoc.remainCredits;
                }

                if (newDoc.fundingTx.confirmed) {
                    messageCreditCount.confirmed += newDoc.remainCredits;
                }
                else {
                    messageCreditCount.unconfirmed += newDoc.remainCredits;
                }

                this.changed('MessageCredits', 1, {
                    unconfirmed: messageCreditCount.unconfirmed.toLocaleString(),
                    confirmed: messageCreditCount.confirmed.toLocaleString()
                });
            },

            deleted: (oldDoc) => {
                // Adjust message credits
                if (oldDoc.fundingTx.confirmed) {
                    messageCreditCount.confirmed -= oldDoc.remainCredits;
                }
                else {
                    messageCreditCount.unconfirmed -= oldDoc.remainCredits;
                }

                this.changed('MessageCredits', 1, {
                    unconfirmed: messageCreditCount.unconfirmed.toLocaleString(),
                    confirmed: messageCreditCount.confirmed.toLocaleString()
                });
            }
        });

        initializing = false;

        this.added('MessageCredits', 1, {
            unconfirmed: messageCreditCount.unconfirmed.toLocaleString(),
            confirmed: messageCreditCount.confirmed.toLocaleString()
        });
        this.ready();

        this.onStop(() => observeHandle.stop());
    });*/
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
