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

// References code in other (Catenis) modules
import { Catenis } from '../Catenis';
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
    // Declaration of RPC methods to be called from client
    Meteor.methods({
        addMessageCredits: function (clientId, count) {
            if (!Number.isInteger(count) || count < 0 || count > maxMsgCreditsCount) {
                // Invalid number of message credits to add. Log error and throw exception
                Catenis.logger.ERROR(util.format('Invalid number of message credits to add. Make sure that it is a positive integer not greater than %s', maxMsgCreditsCount.toString()), {count: count});
                throw new Meteor.Error('clients.add-msg-credits.invalid-param', util.format('Invalid number of message credits to add. Make sure that it is a positive integer not greater than %s', maxMsgCreditsCount.toString()));
            }

            Client.getClientByClientId(clientId).addMessageCredit(count);
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
