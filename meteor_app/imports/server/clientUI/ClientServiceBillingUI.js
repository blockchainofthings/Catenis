/**
 * Created by claudio on 2018-10-16.
 */

//console.log('[ClientServiceBillingUI.js]: This code just ran.');

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
import { Roles } from 'meteor/alanning:roles';

// References code in other (Catenis) modules
import { Catenis } from '../Catenis';
import { Client } from '../Client';
import { Billing } from '../Billing';
import { CommonServiceBillingUI } from '../commonUI/CommonServiceBillingUI';

// Definition of function classes
//

// ClientServiceBillingUI function class
export function ClientServiceBillingUI() {
}


// Public ClientServiceBillingUI object methods
//

/*ClientServiceBillingUI.prototype.pub_func = function () {
};*/


// Module functions used to simulate private ClientServiceBillingUI object methods
//  NOTE: these functions need to be bound to a ClientServiceBillingUI object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// ClientServiceBillingUI function class (public) methods
//

ClientServiceBillingUI.initialize = function () {
    Catenis.logger.TRACE('ClientServiceBillingUI initialization');

    // Declaration of publications
    Meteor.publish('currentClientBillingReport', function(deviceId, startDate, endDate) {
        if (Roles.userIsInRole(this.userId, 'ctn-client')) {
            // Retrieve database doc/rec of client associated with currently logged in user
            const docCurrentClient = Catenis.db.collection.Client.findOne({
                user_id: this.userId,
                status: Client.status.active.name
            }, {
                fields: {
                    clientId: 1
                }
            });

            if (docCurrentClient) {
                return CommonServiceBillingUI.clientBillingReport.call(this, docCurrentClient, deviceId, startDate, endDate);
            }
            else {
                // No active client is associated with currently logged in user.
                //  Make sure that publication is not started and throw exception
                this.stop();
                Catenis.logger.ERROR('currentClientBillingReport publication: logged in user not associated with a valid, active client', {
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

    Meteor.publish('currentClientBillingRecord', function(billing_id) {
        if (Roles.userIsInRole(this.userId, 'ctn-client')) {
            // Retrieve database doc/rec of client associated with currently logged in user
            const docCurrentClient = Catenis.db.collection.Client.findOne({
                user_id: this.userId,
                status: Client.status.active.name
            }, {
                fields: {
                    clientId: 1
                }
            });

            if (docCurrentClient) {
                // Make sure that billing record is associated with currently logged in client
                return Catenis.db.collection.Billing.find({
                    _id: billing_id,
                    type: Billing.docType.original.name,
                    clientId: docCurrentClient.clientId
                }, {
                    fields: {
                        serviceTx: 0,
                        estimatedServiceCost: 0,
                        priceMarkup: 0,
                        servicePaymentTx: 0
                    }
                });
            }
            else {
                // No active client is associated with currently logged in user.
                //  Make sure that publication is not started and throw exception
                this.stop();
                Catenis.logger.ERROR('currentClientBillingRecord publication: logged in user not associated with a valid, active client', {
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


// ClientServiceBillingUI function class (public) properties
//

/*ClientServiceBillingUI.prop = {};*/


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(ClientServiceBillingUI);
