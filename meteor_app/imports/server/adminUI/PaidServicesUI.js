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
import _und from 'underscore';
// Meteor packages
import { Meteor } from 'meteor/meteor';
import { Roles } from 'meteor/alanning:roles';

// References code in other (Catenis) modules
import { Catenis } from '../Catenis';
import { PaidService } from '../PaidService';
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

    Meteor.publish('paidServicesHistory', function (startDate, endDate) {
        if (Roles.userIsInRole(this.userId, 'sys-admin')) {
            const result = Catenis.paidService.servicesCostHistoryForPeriod(startDate, endDate);

            result.servicesCostHistory.forEach(historyEntry => {
                this.added('ServicesCostHistory', historyEntry.date.getTime(), {
                    date: historyEntry.date,
                    servicesCost: historyEntry.servicesCost
                });
            });

            // Add average cost record
            this.added('ServicesCostHistory', -1, {
                servicesAverageCost: result.servicesAverageCost
            });

            this.ready();
        }
        else {
            // User not logged in or not a system administrator.
            //  Make sure that publication is not started and throw exception
            this.stop();
            throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
        }
    });

    Meteor.publish('singlePaidServiceHistory', function (serviceName, date) {
        if (Roles.userIsInRole(this.userId, 'sys-admin')) {
            const result = Catenis.paidService.servicesCostHistoryForPeriod(date, date, false);

            if (result.servicesCostHistory.length > 0) {
                const historyEntry = result.servicesCostHistory[0];

                this.added('ServicesCostHistory', historyEntry.date.getTime(), {
                    date: historyEntry.date,
                    servicesCost: _und.pick(historyEntry.servicesCost, serviceName)
                });
            }

            this.ready();
        }
        else {
            // User not logged in or not a system administrator.
            //  Make sure that publication is not started and throw exception
            this.stop();
            throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
        }
    });

    Meteor.publish('paidServicesInfo', function () {
        if (Roles.userIsInRole(this.userId, 'sys-admin')) {
            Object.keys(PaidService.servicesInfo).forEach(serviceName => {
                this.added('PaidService', serviceName, PaidService.servicesInfo[serviceName]);
            });

            this.ready();
        }
        else {
            // User not logged in or not a system administrator.
            //  Make sure that publication is not started and throw exception
            this.stop();
            throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
        }
    });

    Meteor.publish('singlePaidServiceInfo', function (serviceName) {
        if (Roles.userIsInRole(this.userId, 'sys-admin')) {
            const serviceInfo = PaidService.serviceInfo(serviceName);

            if (serviceInfo) {
                this.added('PaidService', serviceName, serviceInfo);
            }

            this.ready();
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

    Meteor.publish('singlePaidService', function (serviceName) {
        if (Roles.userIsInRole(this.userId, 'sys-admin')) {
            CommonPaidServicesUI.singlePaidService.call(this, serviceName);
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
