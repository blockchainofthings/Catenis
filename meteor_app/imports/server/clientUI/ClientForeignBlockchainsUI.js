/**
 * Created by claudio on 2021-07-16
 */

//console.log('[ClientForeignBlockchainUI.js]: This code just ran.');

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
import { CommonClientForeignBlockchainsUI } from '../commonUI/CommonClientForeignBlockchainsUI';


// Definition of function classes
//

// ClientForeignBlockchainUI function class
export function ClientForeignBlockchainUI() {
}


// ClientForeignBlockchainUI function class (public) methods
//

ClientForeignBlockchainUI.initialize = function () {
    Catenis.logger.TRACE('ClientForeignBlockchainUI initialization');
    // Declaration of RPC methods to be called from client
    Meteor.methods({
        updateCurrentClientForeignBcConsumptionProfile: function (blockchainKey, profileName) {
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
                        return Client.getClientByDocId(client_id).updateForeignBlockchainConsumptionProfile(blockchainKey, profileName);
                    }
                    catch (err) {
                        // Error trying to update current client's foreign blockchain consumption profile. Log error and throw exception
                        Catenis.logger.ERROR('Failure updating current client\'s (doc_id: %s) foreign blockchain (%s) consumption profile (%s).', client_id, blockchainKey, profileName, err);
                        throw new Meteor.Error('client.updateForeignBcConsumptionProfile.failure', 'Failure updating current client\'s foreign blockchain consumption profile: ' + err.toString());
                    }
                }
                else {
                    // No active client is associated with currently logged in user.
                    //  Throw exception
                    Catenis.logger.ERROR('updateCurrentClientForeignBcConsumptionProfile remote method: logged in user not associated with a valid, active client', {
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
    Meteor.publish('currentClientForeignBcConsumptionProfiles', function() {
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
                let client;

                try {
                    client = Client.getClientByDocId(docCurrentClient._id);
                }
                catch (err) {
                    // Subscription made with an invalid Client doc/rec ID.
                    //  Make sure that publication is not started, log error and throw exception.
                    //  Note: this should never happen
                    this.stop();
                    Catenis.logger.ERROR('Subscription to method \'currentClientForeignBcConsumptionProfile\' made with an invalid client', {client_id: docCurrentClient._id});
                    throw new Meteor.Error('client-foreign-bc.subscribe.foreign-bc-consumption-prof.invalid-param', 'Subscription to method \'currentClientForeignBcConsumptionProfile\' made with an invalid client');
                }

                for (const [key, profileName] of client.foreignBcConsumptionProfile) {
                    // Add record
                    this.added('ClientFBConsumptionProfile', key, {
                        profileName
                    });
                }

                this.ready();
            }
            else {
                // No active client is associated with currently logged in user.
                //  Make sure that publication is not started and throw exception
                this.stop();
                Catenis.logger.ERROR('currentClientForeignBcConsumptionProfile publication: logged in user not associated with a valid, active client', {
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

    // Declaration of publications
    Meteor.publish('currentClientForeignBlockchains', function() {
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
                let client;

                try {
                    client = Client.getClientByDocId(docCurrentClient._id);
                }
                catch (err) {
                    // Subscription made with an invalid Client doc/rec ID.
                    //  Make sure that publication is not started, log error and throw exception.
                    //  Note: this should never happen
                    this.stop();
                    Catenis.logger.ERROR('Subscription to method \'currentClientForeignBlockchains\' made with an invalid client', {client_id: docCurrentClient._id});
                    throw new Meteor.Error('client-foreign-bc.subscribe.foreign-blockchains.invalid-param', 'Subscription to method \'currentClientForeignBlockchains\' made with an invalid client');
                }

                CommonClientForeignBlockchainsUI.foreignBlockchains.call(this, client);
            }
            else {
                // No active client is associated with currently logged in user.
                //  Make sure that publication is not started and throw exception
                this.stop();
                Catenis.logger.ERROR('currentClientForeignBlockchains publication: logged in user not associated with a valid, active client', {
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

    // Declaration of publications
    Meteor.publish('currentClientForeignBlockchainRecord', function(blockchainKey) {
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
                let client;

                try {
                    client = Client.getClientByDocId(docCurrentClient._id);
                }
                catch (err) {
                    // Subscription made with an invalid Client doc/rec ID.
                    //  Make sure that publication is not started, log error and throw exception.
                    //  Note: this should never happen
                    this.stop();
                    Catenis.logger.ERROR('Subscription to method \'currentClientForeignBlockchainRecord\' made with an invalid client', {client_id: docCurrentClient._id});
                    throw new Meteor.Error('client-foreign-bc.subscribe.foreign-blockchain-record.invalid-param', 'Subscription to method \'currentClientForeignBlockchainRecord\' made with an invalid client');
                }

                const blockchain = Catenis.foreignBlockchains.get(blockchainKey);

                if (!blockchain) {
                    // Subscription made with an invalid foreign blockchain key.
                    //  Make sure that publication is not started, log error and throw exception
                    this.stop();
                    Catenis.logger.ERROR('Subscription to method \'currentClientForeignBlockchainRecord\' made with an invalid foreign blockchain key', {key: blockchainKey});
                    throw new Meteor.Error('client-foreign-bc.subscribe.foreign-blockchain-record.invalid-param', 'Subscription to method \'currentClientForeignBlockchainRecord\' made with an invalid foreign blockchain');
                }

                CommonClientForeignBlockchainsUI.foreignBlockchainRecord.call(this, client, blockchain);
            }
            else {
                // No active client is associated with currently logged in user.
                //  Make sure that publication is not started and throw exception
                this.stop();
                Catenis.logger.ERROR('currentClientForeignBlockchains publication: logged in user not associated with a valid, active client', {
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


// Module code
//

// Lock function class
Object.freeze(ClientForeignBlockchainUI);
