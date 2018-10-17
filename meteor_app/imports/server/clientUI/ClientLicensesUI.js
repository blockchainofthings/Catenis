/**
 * Created by claudio on 2018-10-04.
 */

//console.log('[ClientLicensesUI.js]: This code just ran.');

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
import { CommonClientLicenseUI } from '../commonUI/CommonClientLicenseUI';


// Definition of function classes
//

// ClientLicensesUI function class
export function ClientLicensesUI() {
}


// Public ClientLicensesUI object methods
//

/*ClientLicensesUI.prototype.pub_func = function () {
};*/


// Module functions used to simulate private ClientLicensesUI object methods
//  NOTE: these functions need to be bound to a ClientLicensesUI object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// ClientLicensesUI function class (public) methods
//

ClientLicensesUI.initialize = function () {
    Catenis.logger.TRACE('ClientLicensesUI initialization');

    // Declaration of publications
    Meteor.publish('currentClientAllClientLicenses', function() {
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
                return Catenis.db.collection.ClientLicense.find({
                    client_id: docCurrentClient._id
                });
            }
            else {
                // No active client is associated with currently logged in user.
                //  Make sure that publication is not started and throw exception
                this.stop();
                Catenis.logger.ERROR('currentClientAllClientLicenses publication: logged in user not associated with a valid, active client', {
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

    Meteor.publish('currentClientAllClientLicenseLicenses', function() {
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
                // Include License database doc/recs associated with all ClientLicense database doc/recs
                //  for the current client
                CommonClientLicenseUI.clientAllClientLicenseLicenses.call(this, 'currentClientAllClientLicenseLicenses', docCurrentClient._id);

                this.ready();
            }
            else {
                // No active client is associated with currently logged in user.
                //  Make sure that publication is not started and throw exception
                this.stop();
                Catenis.logger.ERROR('currentClientAllClientLicenseLicenses publication: logged in user not associated with a valid, active client', {
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

    Meteor.publish('currentClientSingleClientLicense', function(clientLicense_id) {
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
                return Catenis.db.collection.ClientLicense.find({
                    _id: clientLicense_id
                });
            }
            else {
                // No active client is associated with currently logged in user.
                //  Make sure that publication is not started and throw exception
                this.stop();
                Catenis.logger.ERROR('currentClientSingleClientLicense publication: logged in user not associated with a valid, active client', {
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

    Meteor.publish('currentClientSingleClientLicenseLicense', function(clientLicense_id) {
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
                const docClientLicense = Catenis.db.collection.ClientLicense.findOne({
                    _id: clientLicense_id
                }, {
                    fields: {
                        license_id: 1
                    }
                });

                if (docClientLicense) {
                    return Catenis.db.collection.License.find({
                        _id: docClientLicense.license_id
                    });
                }
                else {
                    this.ready();
                }
            }
            else {
                // No active client is associated with currently logged in user.
                //  Make sure that publication is not started and throw exception
                this.stop();
                Catenis.logger.ERROR('currentClientSingleClientLicenseLicense publication: logged in user not associated with a valid, active client', {
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


// ClientLicensesUI function class (public) properties
//

/*ClientLicensesUI.prop = {};*/


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(ClientLicensesUI);
