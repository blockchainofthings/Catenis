/**
 * Created by Claudio on 2018-10-15.
 */

//console.log('[ServiceBillingUI.js]: This code just ran.');

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
import { Billing } from '../Billing';
import { CommonServiceBillingUI } from '../commonUI/CommonServiceBillingUI';

// Definition of function classes
//

// ServiceBillingUI function class
export function ServiceBillingUI() {
}


// Public ServiceBillingUI object methods
//

/*ServiceBillingUI.prototype.pub_func = function () {
 };*/


// Module functions used to simulate private ServiceBillingUI object methods
//  NOTE: these functions need to be bound to a ServiceBillingUI object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
 }*/


// ServiceBillingUI function class (public) methods
//

ServiceBillingUI.initialize = function () {
    Catenis.logger.TRACE('ServiceBillingUI initialization');

    // Declaration of publications
    Meteor.publish('clientBillingReport', function (client_id, deviceId, startDate, endDate) {
        if (Roles.userIsInRole(this.userId, 'sys-admin')) {
            const docClient = Catenis.db.collection.Client.findOne({
                _id: client_id
            }, {
                fields: {
                    clientId: 1
                }
            });

            if (docClient) {
                return CommonServiceBillingUI.clientBillingReport.call(this, docClient, deviceId, startDate, endDate);
            }
            else {
                this.ready();
            }
        }
        else {
            // User not logged in or not a system administrator
            //  Make sure that publication is not started and throw exception
            this.stop();
            throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
        }
    });

    Meteor.publish('billingRecord', function (billing_id) {
        if (Roles.userIsInRole(this.userId, 'sys-admin')) {
            return Catenis.db.collection.Billing.find({
                _id: billing_id,
                type: Billing.docType.original.name,
            });
        }
        else {
            // User not logged in or not a system administrator
            //  Make sure that publication is not started and throw exception
            this.stop();
            throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
        }
    });
};


// ServiceBillingUI function class (public) properties
//

/*ServiceBillingUI.prop = {};*/


// Definition of module (private) functions
//


// Module code
//

// Lock function class
Object.freeze(ServiceBillingUI);
