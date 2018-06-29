/**
 * Created by claudio on 23/05/17.
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
import { Roles } from 'meteor/alanning:roles';

// References code in other (Catenis) modules
import { Catenis } from '../Catenis';
import { CatenisNode } from '../CatenisNode';
import { Client } from '../Client';
import { Util } from '../Util';


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
        createClient: function (ctnNodeIndex, clientInfo) {
            if (Roles.userIsInRole(this.userId, 'sys-admin')) {
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
            else {
                // User not logged in or not a system administrator.
                //  Throw exception
                throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
            }
        },
        newBcotPaymentAddress: function (client_id) {
            if (Roles.userIsInRole(this.userId, 'sys-admin')) {
                Catenis.logger.TRACE('>>>>>> newBcotPaymentAddress() remote method called');
                // Retrieve Client doc/rec
                const docClient = Catenis.db.collection.Client.findOne({
                    _id: client_id
                }, {
                    fields: {
                        clientId: 1
                    }
                });

                let client = undefined;

                if (docClient !== undefined) {
                    client = Client.getClientByClientId(docClient.clientId);
                }

                if (client === undefined) {
                    // Invalid client. Log error and throw exception
                    Catenis.logger.ERROR('Could not find client to get blockchain address to receive BCOT token payment', {client_id: client_id});
                    throw new Meteor.Error('clients.bcot-pay-addr.invalid-client', 'Could not find client to get blockchain address to receive BCOT token payment');
                }

                return client.newBcotPaymentAddress();
            }
            else {
                // User not logged in or not a system administrator.
                //  Throw exception
                throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
            }
        }
    });

    // Declaration of publications
    Meteor.publish('serviceAccountBalance', function (client_id) {
        if (Roles.userIsInRole(this.userId, 'sys-admin')) {
            // Retrieve Client doc/rec
            const docClient = Catenis.db.collection.Client.findOne({
                _id: client_id
            }, {
                fields: {
                    clientId: 1
                }
            });

            let client = undefined;

            if (docClient !== undefined) {
                client = Client.getClientByClientId(docClient.clientId);
            }

            if (client === undefined) {
                // Subscription made with an invalid Client doc/rec ID. Log error and throw exception
                Catenis.logger.ERROR('Subscription to method \'serviceAccountBalance\' made with an invalid client', {client_id: client_id});
                throw new Meteor.Error('clients.subscribe.service-account-balance.invalid-param', 'Subscription to method \'serviceAccountBalance\' made with an invalid client');
            }

            const now = new Date();
            this.added('ServiceAccountBalance', 1, {
                balance: Util.formatCatenisServiceCredits(client.serviceAccountBalance())
            });

            const observeHandle = Catenis.db.collection.SentTransaction.find({
                sentDate: {
                    $gte: now
                },
                $or: [{
                    type: 'credit_service_account',
                    'info.creditServiceAccount.clientId': client.clientId
                }, {
                    type: 'spend_service_credit',
                    'info.spendServiceCredit.clientIds': client.clientId
                }]
            }, {
                fields: {
                    _id: 1
                }
            }).observe({
                added: (doc) => {
                    // Get updated service account balance
                    this.changed('ServiceAccountBalance', 1, {
                        balance: Util.formatCatenisServiceCredits(client.serviceAccountBalance())
                    });
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

    Meteor.publish('bcotPayment', function (bcotPayAddress) {
        if (Roles.userIsInRole(this.userId, 'sys-admin')) {
            const typeAndPath = Catenis.keyStore.getTypeAndPathByAddress(bcotPayAddress);

            if (typeAndPath === null) {
                // Subscription made with an invalid address. Log error and throw exception
                Catenis.logger.ERROR('Subscription to method \'bcotPayment\' made with an invalid address', {bcotPayAddress: bcotPayAddress});
                throw new Meteor.Error('clients.subscribe.bcot-payment.invalid-param', 'Subscription to method \'bcotPayment\' made with an invalid address');
            }

            const receivedAmount = {
                unconfirmed: 0,
                confirmed: 0
            };
            let initializing = true;

            const observeHandle = Catenis.db.collection.ReceivedTransaction.find({
                'info.bcotPayment.bcotPayAddressPath': typeAndPath.path
            }, {
                fields: {
                    'confirmation.confirmed': 1,
                    info: 1
                }
            }).observe({
                added: (doc) => {
                    // Get paid amount paid to address
                    if (doc.confirmation.confirmed) {
                        receivedAmount.confirmed += doc.info.bcotPayment.paidAmount;
                    }
                    else {
                        receivedAmount.unconfirmed += doc.info.bcotPayment.paidAmount;
                    }

                    if (!initializing) {
                        this.changed('ReceivedBcotAmount', 1, {
                            unconfirmed: Util.formatCoins(receivedAmount.unconfirmed),
                            confirmed: Util.formatCoins(receivedAmount.confirmed)
                        });
                    }
                },

                changed: (newDoc, oldDoc) => {
                    // Make sure that transaction is being confirmed
                    if (newDoc.confirmation.confirmed && !oldDoc.confirmation.confirmed) {
                        // Get total amount paid to address
                        receivedAmount.confirmed += newDoc.info.bcotPayment.paidAmount;
                        receivedAmount.unconfirmed -= newDoc.info.bcotPayment.paidAmount;

                        if (receivedAmount.unconfirmed < 0) {
                            receivedAmount.unconfirmed = 0;
                        }

                        this.changed('ReceivedBcotAmount', 1, {
                            unconfirmed: Util.formatCoins(receivedAmount.unconfirmed),
                            confirmed: Util.formatCoins(receivedAmount.confirmed)
                        });
                    }
                }
            });

            initializing = false;

            this.added('ReceivedBcotAmount', 1, {
                unconfirmed: Util.formatCoins(receivedAmount.unconfirmed),
                confirmed: Util.formatCoins(receivedAmount.confirmed)
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

    Meteor.publish('catenisClients', function (ctnNodeIndex) {
        if (Roles.userIsInRole(this.userId, 'sys-admin')) {
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


// Module code
//

// Lock function class
Object.freeze(ClientsUI);
