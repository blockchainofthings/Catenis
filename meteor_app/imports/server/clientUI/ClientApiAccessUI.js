/**
 * Created by claudio on 2018-10-03.
 */

//console.log('[ClientApiAccessUI.js]: This code just ran.');

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


// Definition of function classes
//

// ClientApiAccessUI function class
export function ClientApiAccessUI() {
}


// Public ClientApiAccessUI object methods
//

/*ClientApiAccessUI.prototype.pub_func = function () {
};*/


// Module functions used to simulate private ClientApiAccessUI object methods
//  NOTE: these functions need to be bound to a ClientApiAccessUI object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// ClientApiAccessUI function class (public) methods
//

ClientApiAccessUI.initialize = function () {
    Catenis.logger.TRACE('ClientApiAccessUI initialization');
    // Declaration of RPC methods to be called from client
    Meteor.methods({
        getCurrentClientApiAccessSecret: function () {
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
                        return Client.getClientByDocId(docCurrentClient._id).apiAccessSecret;
                    }
                    catch (err) {
                        // Error trying to get client's API access secret. Log error and throw exception
                        //  WARNING: internal error should NOT be disclosed to client
                        Catenis.logger.ERROR('Failure trying to get current client\'s API access secret.', err);
                        throw new Meteor.Error('client.getCurrentClientApiAccessSecret.failure', 'Failure trying to get current client\'s API access secret');
                    }
                }
                else {
                    // No active client is associated with currently logged in user.
                    //  Throw exception
                    Catenis.logger.ERROR('Logged in user not associated with a valid, active client', {
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
        resetCurrentClientApiAccessSecret: function (resetAllDevicesToo) {
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
                        Client.getClientByDocId(docCurrentClient._id).renewApiAccessGenKey(resetAllDevicesToo);
                    }
                    catch (err) {
                        // Error trying to reset current client's API access secret. Log error and throw exception
                        //  WARNING: internal error should NOT be disclosed to client
                        Catenis.logger.ERROR('Failure trying to renew current client\'s API access generation key.', err);
                        throw new Meteor.Error('client.getCurrentClientApiAccessSecret.failure', 'Failure trying to renew current client\'s API access generation key.');
                    }
                }
                else {
                    // No active client is associated with currently logged in user.
                    //  Throw exception
                    Catenis.logger.ERROR('Logged in user not associated with a valid, active client', {
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
};


// ClientApiAccessUI function class (public) properties
//

/*ClientApiAccessUI.prop = {};*/


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(ClientApiAccessUI);
