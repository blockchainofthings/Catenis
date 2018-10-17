/**
 * Created by claudio on 2018-10-13.
 */

//console.log('[PaidServicesUI.js]: This code just ran.');

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
import { CommonPaidServicesUI } from '../commonUI/CommonPaidServicesUI';


// Definition of function classes
//

// PaidServicesUI function class
export function PaidServicesUI() {
}


// Public PaidServicesUI object methods
//

/*PaidServicesUI.prototype.pub_func = function () {
};*/


// Module functions used to simulate private PaidServicesUI object methods
//  NOTE: these functions need to be bound to a PaidServicesUI object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// PaidServicesUI function class (public) methods
//

PaidServicesUI.initialize = function () {
    Catenis.logger.TRACE('PaidServicesUI initialization');

    // Declaration of publications
    Meteor.publish('paidServices', function () {
        if (Roles.userIsInRole(this.userId, 'sys-admin')) {
            CommonPaidServicesUI.paidServices.call(this);
        }
        else {
            // User not logged in or not a system administrator.
            //  Make sure that publication is not started and throw exception
            this.stop();
            throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
        }
    });

    Meteor.publish('paidServiceNames', function () {
        if (Roles.userIsInRole(this.userId, 'sys-admin')) {
            CommonPaidServicesUI.paidServiceNames.call(this);
        }
        else {
            // User not logged in or not a system administrator.
            //  Make sure that publication is not started and throw exception
            this.stop();
            throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
        }
    });

    Meteor.publish('singlePaidService', function (serviceId) {
        if (Roles.userIsInRole(this.userId, 'sys-admin')) {
            CommonPaidServicesUI.singlePaidService.call(this, serviceId);
        }
        else {
            // User not logged in or not a system administrator.
            //  Make sure that publication is not started and throw exception
            this.stop();
            throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
        }
    });

    Meteor.publish('billingPaidServiceName', function (billing_id) {
        if (Roles.userIsInRole(this.userId, 'sys-admin')) {
            CommonPaidServicesUI.billingPaidServiceName.call(this, billing_id);
        }
        else {
            // User not logged in or not a system administrator.
            //  Make sure that publication is not started and throw exception
            this.stop();
            throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
        }
    });
};


// PaidServicesUI function class (public) properties
//

/*PaidServicesUI.prop = {};*/


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(PaidServicesUI);
