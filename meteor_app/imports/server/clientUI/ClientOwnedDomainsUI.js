/**
 * Created by claudio on 2020-06-19
 */

//console.log('[ClientOwnedDomainsUI.js]: This code just ran.');

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
import { CommonOwnedDomainsUI } from '../commonUI/CommonOwnedDomainsUI';

// Definition of function classes
//

// ClientOwnedDomainsUI function class
export function ClientOwnedDomainsUI() {
}


// Public ClientOwnedDomainsUI object methods
//

/*ClientOwnedDomainsUI.prototype.pub_func = function () {
};*/


// Module functions used to simulate private ClientOwnedDomainsUI object methods
//  NOTE: these functions need to be bound to a ClientOwnedDomainsUI object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// ClientOwnedDomainsUI function class (public) methods
//

ClientOwnedDomainsUI.initialize = function () {
    Catenis.logger.TRACE('ClientOwnedDomainsUI initialization');
    // Declaration of RPC methods to be called from client
    Meteor.methods({
        addCurrentClientOwnedDomain: function (domainName) {
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

                        client.ownedDomain.addDomain(domainName);
                    }
                    catch (err) {
                        // Error trying to add new client owned domain. Log error and throw exception
                        Catenis.logger.ERROR('Failure trying to add new client owned domain.', err);
                        throw new Meteor.Error('client.owned.domain.add.failure', 'Failure trying to add new client owned domain: ' + err.toString());
                    }
                }
                else {
                    // No active client is associated with currently logged in user.
                    //  Throw exception
                    Catenis.logger.ERROR('addCurrentClientOwnedDomain remote method: logged in user not associated with a valid, active client', {
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
        verifyCurrentClientOwnedDomain: function (domainName) {
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

                        return client.ownedDomain.verifyDomain(domainName);
                    }
                    catch (err) {
                        // Error trying to verify client owned domain. Log error and throw exception
                        Catenis.logger.ERROR('Failure trying to verify client owned domain.', err);
                        throw new Meteor.Error('client.owned.domain.verify.failure', 'Failure trying to verify client owned domain: ' + err.toString());
                    }
                }
                else {
                    // No active client is associated with currently logged in user.
                    //  Throw exception
                    Catenis.logger.ERROR('verifyCurrentClientOwnedDomain remote method: logged in user not associated with a valid, active client', {
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
        deleteCurrentClientOwnedDomain: function (domainName) {
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

                        client.ownedDomain.deleteDomain(domainName);
                    }
                    catch (err) {
                        // Error trying to delete client owned domain. Log error and throw exception
                        Catenis.logger.ERROR('Failure trying to delete client owned domain.', err);
                        throw new Meteor.Error('client.owned.domain.delete.failure', 'Failure trying to delete client owned domain: ' + err.toString());
                    }
                }
                else {
                    // No active client is associated with currently logged in user.
                    //  Throw exception
                    Catenis.logger.ERROR('deleteCurrentClientOwnedDomain remote method: logged in user not associated with a valid, active client', {
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
    Meteor.publish('currentClientOwnedDomains', function() {
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
                CommonOwnedDomainsUI.ownedDomains.call(this, docCurrentClient._id);
            }
            else {
                // No active client is associated with currently logged in user.
                //  Make sure that publication is not started and throw exception
                this.stop();
                Catenis.logger.ERROR('currentClientOwnedDomains publication: logged in user not associated with a valid, active client', {
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


// ClientOwnedDomainsUI function class (public) properties
//

/*ClientOwnedDomainsUI.prop = {};*/


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(ClientOwnedDomainsUI);
