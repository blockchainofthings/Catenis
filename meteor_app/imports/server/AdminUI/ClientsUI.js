/**
 * Created by claudio on 23/05/17.
 */

//console.log('[ClientsUI.js]: This code just ran.');

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
//import config from 'config';
// Meteor packages
import { Meteor } from 'meteor/meteor';
import { Accounts } from 'meteor/accounts-base'

// References code in other (Catenis) modules
import { Catenis } from '../Catenis';
import { Client } from '../Client';
import { CatenisNode } from '../CatenisNode';


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



//ensure user is in sys-admin role to call certain functions.


// ClientsUI function class (public) method
function verifyUserRole(){
    try{

        var user= Meteor.user();

        if(user && user.roles && user.roles.includes('sys-admin') ){
            return true;
        }else{
            return false;
        }

    }catch(err){
        Catenis.logger.ERROR('Failure trying to verify Meteor user role.', err);
        throw new Meteor.Error('client.verifyUserRole.failure', 'Failure trying to verify role of current user: ' + err.toString());
    }
}



ClientsUI.initialize = function () {
    // Declaration of RPC methods to be called from client
    Meteor.methods({

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

        //added by peter to allow Meteor account activation on enrollment. called from ../both/ConfigLoginForm.js

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
                    user=Meteor.users.findOne({_id: user_id});
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


        createClient: function (ctnNodeIndex, clientInfo) {
            // Try to create meteor client user
            let user_id;
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
                        }
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

                // Try to create Catenis client
                let clientId;
                try {
                    clientId = CatenisNode.getCatenisNodeByIndex(ctnNodeIndex).createClient(clientInfo.name, user_id);
                }
                catch (err) {
                    // Error trying to create Catenis client. Log error and throw exception
                    Catenis.logger.ERROR('Failure trying to create new Catenis client.', err);
                    throw new Meteor.Error('client.create.failure', 'Failure trying to create new Catenis client: ' + err.toString());
                }

                return clientId;



            }else{
                Catenis.logger.ERROR('User does not have permission to access method "changeUserStatus"');
                throw new Meteor.Error('User does not have permission to access method "changeUserStatus"');
            }
        },

        //Unsure if meteor account takes into consideration that this update is a critical section.
        //Do more research and find out.
        updateUser: function (clientInfo) {
            if(verifyUserRole()) {
                const user= Meteor.users.findOne({username: clientInfo.username});
                if(clientInfo.pwd){
                //    update client Password
                    try{
                        Accounts.setPassword(user._id, clientInfo.pwd);

                    }catch(err){
                        Catenis.logger.ERROR('Failure trying to update Catenis user pwd', err);
                        throw new Meteor.Error('client.update.failure', 'Failure trying to update user pwd: ' + err.toString());
                    }

                }
                //assuming one email per user. ensure that user does not attempt to set email to an email that already exists.
                if(clientInfo.email !== user.emails[0].address){
                    //update user email
                    try{
                        Accounts.removeEmail(user._id, user.emails[0].address);
                        Accounts.addEmail(user._id, clientInfo.email);
                    }catch(err){
                        Catenis.logger.ERROR('Failure trying to update Catenis user email', err);
                        throw new Meteor.Error('client.update.failure', 'Failure trying to update user email: ' + err.toString());
                    }

                }
                Meteor.users.update
                (user,
                    {$set:
                        {'profile.name': clientInfo.name, 'profile.firstname':clientInfo.firstName,
                            'profile.lastname': clientInfo.lastName, 'profile.company': clientInfo.companyName}
                    }
                );
            }else{
                Catenis.logger.ERROR('User does not have permission to access method "updateUser"');
                throw new Meteor.Error('User does not have permission to access method "updateUser"');
            }
        }
    });


    // Declaration of publications
    Meteor.publish('catenisClients', function (ctnNodeIndex) {
        ctnNodeIndex = ctnNodeIndex || Catenis.application.ctnHubNodeIndex;

        const docCtnNode = Catenis.db.collection.CatenisNode.findOne({ctnNodeIndex: ctnNodeIndex}, {fields: {_id: 1}});

        if (docCtnNode === undefined) {
            // Subscription made with an invalid Catenis node index. Log error and throw exception
            Catenis.logger.ERROR('Subscription to method \'catenisClients\' made with an invalid Catenis node index', {ctnNodeIndex: ctnNodeIndex});
            throw new Meteor.Error('clients.subscribe.catenis-clients.invalid-param', 'Subscription to method \'catenisClients\' made with an invalid Catenis node index');
        }

        return Catenis.db.collection.Client.find({
            catenisNode_id: docCtnNode._id,
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
    });

    Meteor.publish('clientRecord', function (client_id) {
        return Catenis.db.collection.Client.find({
            _id: client_id
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

    Meteor.publish('clientUser', function (client_id) {
        const client = Catenis.db.collection.Client.findOne({_id: client_id}, {fields: {user_id: 1}});

        if (client && client.user_id) {
            return Meteor.users.find({_id: client.user_id}, {
                fields: {
                    _id: 1,
                    username: 1,
                    //below added to allow user activation status access.
                    profile:1,
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

    Meteor.publish('clientMessageCredits', function (client_id) {
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
    });

};


// ClientsUI function class (public) properties
//

/*ClientsUI.prop = {};*/


// Definition of module (private) functions
//


// Module code
//

// Lock function class
Object.freeze(ClientsUI);
