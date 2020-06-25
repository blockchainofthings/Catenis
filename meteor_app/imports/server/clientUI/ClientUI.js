/**
 * Created by claudio on 2018-10-03.
 */

//console.log('[ClientUI.js]: This code just ran.');

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

// ClientUI function class
export function ClientUI() {
}


// Public ClientUI object methods
//

/*ClientUI.prototype.pub_func = function () {
};*/


// Module functions used to simulate private ClientUI object methods
//  NOTE: these functions need to be bound to a ClientUI object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// ClientUI function class (public) methods
//

ClientUI.initialize = function () {
    Catenis.logger.TRACE('ClientUI initialization');
    // Declaration of RPC methods to be called from client
    Meteor.methods({
        updateCurrentClient: function (clientInfo) {
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
                        const client = Client.getClientByDocId(docCurrentClient._id);

                        // Prepare to update client's properties
                        const props = {
                            firstName: clientInfo.firstName ? clientInfo.firstName : undefined,
                            lastName: clientInfo.lastName ? clientInfo.lastName : undefined,
                            company: clientInfo.company ? clientInfo.company : undefined
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
                    // No active client is associated with currently logged in user.
                    //  Throw exception
                    Catenis.logger.ERROR('updateCurrentClient remote method: logged in user not associated with a valid, active client', {
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
        }
    });

    // Declaration of publications
    Meteor.publish('currentClient', function () {
        if (Roles.userIsInRole(this.userId, 'ctn-client')) {
            return Catenis.db.collection.Client.find({
                user_id: this.userId,
                status: Client.status.active.name
            });
        }
        else {
            // User not logged in or not a Catenis client
            //  Make sure that publication is not started and throw exception
            this.stop();
            throw new Meteor.Error('ctn_client_no_permission', 'No permission; must be logged in as a Catenis client to perform this task');
        }
    });

    Meteor.publish('currentClientUser', function () {
        if (Roles.userIsInRole(this.userId, 'ctn-client')) {
            return Meteor.users.find({
                _id: this.userId
            }, {
                fields: {
                    _id: 1,
                    username: 1,
                    emails: 1
                }
            });
        }
        else {
            // User not logged in or not a Catenis client
            //  Make sure that publication is not started and throw exception
            this.stop();
            throw new Meteor.Error('ctn_client_no_permission', 'No permission; must be logged in as a Catenis client to perform this task');
        }
    });
};


// ClientUI function class (public) properties
//

/*ClientUI.prop = {};*/


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(ClientUI);
