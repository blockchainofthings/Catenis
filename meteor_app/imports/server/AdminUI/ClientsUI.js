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
//const util = require('util');
// Third-party node modules
//import config from 'config';
// Meteor packages
import { Meteor } from 'meteor/meteor';
import { Accounts } from 'meteor/accounts-base'

// References code in other (Catenis) modules
import { Catenis } from '../Catenis';
import { CatenisNode } from '../CatenisNode';


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
    // Declaration of RPC methods to be called from client
    Meteor.methods({
        createClient: function (ctnNodeIndex, clientInfo) {
            // Try to create meteor client user
            let user_id;

            try {
                const opts = {
                    username: clientInfo.username,
                    password: clientInfo.psw,
                    profile: {
                        name: 'User for Catenis client ' + clientInfo.name
                    }
                };

                user_id = Accounts.createUser(opts);
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
                    username: 1
                }
            });
        }
        else {
            // Nothing to return
            return this.ready();
        }
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
