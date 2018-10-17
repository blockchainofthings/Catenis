/**
 * Created by claudio on 2018-10-11.
 */

//console.log('[ClientServiceAccountUI.js]: This code just ran.');

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

// References code in other (Catenis) modules
import { Catenis } from '../Catenis';
import { Client } from '../Client';
import { CommonServiceAccountUI } from '../commonUI/CommonServiceAccountUI';
import { KeyStore } from '../KeyStore';


// Definition of function classes
//

// ClientServiceAccountUI function class
export function ClientServiceAccountUI() {
}


// Public ClientServiceAccountUI object methods
//

/*ClientServiceAccountUI.prototype.pub_func = function () {
};*/


// Module functions used to simulate private ClientServiceAccountUI object methods
//  NOTE: these functions need to be bound to a ClientServiceAccountUI object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// ClientServiceAccountUI function class (public) methods
//

ClientServiceAccountUI.initialize = function () {
    Catenis.logger.TRACE('ClientServiceAccountUI initialization');
    // Declaration of RPC methods to be called from client
    Meteor.methods({
        newCurrentClientBcotPaymentAddress: function () {
            if (Roles.userIsInRole(this.userId, 'ctn-client')) {
                // Retrieve database doc/rec of client associated with currently logged in user
                const docCurrentClient = Catenis.db.collection.Client.findOne({
                    user_id: this.userId,
                    status: Client.status.active.name
                }, {
                    fields: {
                        _id: 1
                    }
                });

                if (docCurrentClient) {
                    try {
                        return Client.getClientByDocId(docCurrentClient._id).newBcotPaymentAddress();
                    }
                    catch (err) {
                        // Error trying to retrieve new BCOT payment address. Log error and throw exception
                        //  WARNING: internal error should NOT be disclosed to client
                        Catenis.logger.ERROR('Failure retrieving BCOT payment address for current client.', err);
                        throw new Meteor.Error('client-srv-account.newCurrentClientBcotPaymentAddress.failure', 'Failure retrieving BCOT payment address for current client');
                    }
                }
                else {
                    // No active client is associated with currently logged in user.
                    //  Throw exception
                    Catenis.logger.ERROR('newCurrentClientBcotPaymentAddress remote method: logged in user not associated with a valid, active client', {
                        user_id: this.userId
                    });
                    throw new Meteor.Error('ctn_client_not_valid', 'Logged in user not associated with a valid client');
                }
            }
            else {
                // User not logged in or not a Catenis client.
                //  Throw exception
                throw new Meteor.Error('ctn_client_no_permission', 'No permission; must be logged in as a Catenis client to perform this task');
            }
        },
    });

    // Declaration of publications
    Meteor.publish('currentClientServiceAccountBalance', function() {
        if (Roles.userIsInRole(this.userId, 'ctn-client')) {
            // Retrieve database doc/rec of client associated with currently logged in user
            const docCurrentClient = Catenis.db.collection.Client.findOne({
                user_id: this.userId,
                status: Client.status.active.name
            }, {
                fields: {
                    _id: 1
                }
            });

            if (docCurrentClient) {
                CommonServiceAccountUI.clientServiceAccountBalance.call(this, Client.getClientByDocId(docCurrentClient._id));
            }
            else {
                // No active client is associated with currently logged in user.
                //  Make sure that publication is not started and throw exception
                this.stop();
                Catenis.logger.ERROR('currentClientServiceAccountBalance publication: logged in user not associated with a valid, active client', {
                    user_id: this.userId
                });
                throw new Meteor.Error('ctn_client_not_valid', 'Logged in user not associated with a valid client');
            }
        }
        else {
            // User not logged in or not a Catenis client.
            //  Make sure that publication is not started and throw exception
            this.stop();
            throw new Meteor.Error('ctn_client_no_permission', 'No permission; must be logged in as a Catenis client to perform this task');
        }
    });

    Meteor.publish('clientBcotPayment', function(bcotPayAddress) {
        if (Roles.userIsInRole(this.userId, 'ctn-client')) {
            // Retrieve database doc/rec of client associated with currently logged in user
            const docCurrentClient = Catenis.db.collection.Client.findOne({
                user_id: this.userId,
                status: Client.status.active.name
            }, {
                fields: {
                    _id: 1
                }
            });

            if (docCurrentClient) {
                const addrTypeAndPath = Catenis.keyStore.getTypeAndPathByAddress(bcotPayAddress);

                if (Client.getClientByDocId(docCurrentClient._id).isValidBcotPaymentAddress(addrTypeAndPath, true)) {
                    CommonServiceAccountUI.bcotPayment.call(this, addrTypeAndPath);
                }
                else {
                    // Invalid BCOT payment address.
                    //  Make sure that publication is not started and throw exception
                    this.stop();
                    Catenis.logger.ERROR('clientBcotPayment publication: invalid BCOT payment address', {
                        user_id: this.userId
                    });
                    throw new Meteor.Error('client-srv-account.subscribe.clientBcotPayment.failure', 'Invalid BCOT payment address');
                }
            }
            else {
                // No active client is associated with currently logged in user.
                //  Make sure that publication is not started and throw exception
                this.stop();
                Catenis.logger.ERROR('clientBcotPayment publication: logged in user not associated with a valid, active client', {
                    user_id: this.userId
                });
                throw new Meteor.Error('ctn_client_not_valid', 'Logged in user not associated with a valid client');
            }
        }
        else {
            // User not logged in or not a Catenis client.
            //  Make sure that publication is not started and throw exception
            this.stop();
            throw new Meteor.Error('ctn_client_no_permission', 'No permission; must be logged in as a Catenis client to perform this task');
        }
    });
};


// ClientServiceAccountUI function class (public) properties
//

/*ClientServiceAccountUI.prop = {};*/


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(ClientServiceAccountUI);
