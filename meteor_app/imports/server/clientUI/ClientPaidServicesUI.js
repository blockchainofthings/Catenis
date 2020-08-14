/**
 * Created by claudio on 2018-10-13.
 */

//console.log('[ClientPaidServicesUI.js]: This code just ran.');

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

// ClientPaidServicesUI function class
export function ClientPaidServicesUI() {
}


// Public ClientPaidServicesUI object methods
//

/*ClientPaidServicesUI.prototype.pub_func = function () {
};*/


// Module functions used to simulate private ClientPaidServicesUI object methods
//  NOTE: these functions need to be bound to a ClientPaidServicesUI object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// ClientPaidServicesUI function class (public) methods
//

ClientPaidServicesUI.initialize = function () {
    Catenis.logger.TRACE('ClientPaidServicesUI initialization');

    // Declaration of publications
    Meteor.publish('clientPaidServices', function () {
        if (Roles.userIsInRole(this.userId, 'ctn-client')) {
            CommonPaidServicesUI.paidServices.call(this);
        }
        else {
            // User not logged in or not a Catenis client.
            //  Make sure that publication is not started and throw exception
            this.stop();
            throw new Meteor.Error('ctn_client_no_permission', 'No permission; must be logged in as a Catenis client to perform this task');
        }
    });

    Meteor.publish('clientPaidServiceNames', function () {
        if (Roles.userIsInRole(this.userId, 'ctn-client')) {
            CommonPaidServicesUI.paidServiceNames.call(this);
        }
        else {
            // User not logged in or not a Catenis client.
            //  Make sure that publication is not started and throw exception
            this.stop();
            throw new Meteor.Error('ctn_client_no_permission', 'No permission; must be logged in as a Catenis client to perform this task');
        }
    });

    Meteor.publish('clientSinglePaidService', function (serviceName) {
        if (Roles.userIsInRole(this.userId, 'ctn-client')) {
            CommonPaidServicesUI.singlePaidService.call(this, serviceName);
        }
        else {
            // User not logged in or not a Catenis client.
            //  Make sure that publication is not started and throw exception
            this.stop();
            throw new Meteor.Error('ctn_client_no_permission', 'No permission; must be logged in as a Catenis client to perform this task');
        }
    });

    Meteor.publish('clientBillingPaidServiceName', function (billing_id) {
        if (Roles.userIsInRole(this.userId, 'ctn-client')) {
            CommonPaidServicesUI.billingPaidServiceName.call(this, billing_id);
        }
        else {
            // User not logged in or not a Catenis client.
            //  Make sure that publication is not started and throw exception
            this.stop();
            throw new Meteor.Error('ctn_client_no_permission', 'No permission; must be logged in as a Catenis client to perform this task');
        }
    });
};


// ClientPaidServicesUI function class (public) properties
//

/*ClientPaidServicesUI.prop = {};*/


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(ClientPaidServicesUI);
