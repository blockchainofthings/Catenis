/**
 * Created by claudio on 2016-08-17.
 */

//console.log('[AdminUI.js]: This code just ran.');

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

// Definition of function classes
//

// AdminUI function class
export function AdminUI() {
}


// Public AdminUI object methods
//

/*AdminUI.prototype.pub_func = function () {
};*/


// Module functions used to simulate private AdminUI object methods
//  NOTE: these functions need to be bound to a AdminUI object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// AdminUI function class (public) methods
//

AdminUI.initialize = function () {
    Catenis.logger.TRACE('AdminUI initialization');
    // Declaration of RPC methods to be called from client
    Meteor.methods({
        getAppEnvironment: function () {
            if (Roles.userIsInRole(this.userId, 'sys-admin')) {
                return Catenis.application.environment;
            }
            else {
                // User not logged in or not a system administrator.
                //  Throw exception
                throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
            }
        }
    });
};


// AdminUI function class (public) properties
//

/*AdminUI.prop = {};*/


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(AdminUI);
