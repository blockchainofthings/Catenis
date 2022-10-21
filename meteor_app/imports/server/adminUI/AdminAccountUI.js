/**
 * Created by claudio on 2018-11-15.
 */

//console.log('[AdminAccountUI.js]: This code just ran.');

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

// Definition of function classes
//

// AdminAccountUI function class
export function AdminAccountUI() {
}


// Public AdminAccountUI object methods
//

/*AdminAccountUI.prototype.pub_func = function () {
};*/


// Module functions used to simulate private AdminAccountUI object methods
//  NOTE: these functions need to be bound to a AdminAccountUI object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// AdminAccountUI function class (public) methods
//

AdminAccountUI.initialize = function () {
    Catenis.logger.TRACE('AdminAccountUI initialization');
    // Declaration of RPC methods to be called from client
    Meteor.methods({
        createAdminAccount: function (email, password, description) {
            if (Roles.userIsInRole(this.userId, 'sys-admin')) {
                try {
                    return Catenis.application.createAdminUser(email, password, description);
                }
                catch (err) {
                    // Error trying to create Catenis admin user account. Log error and throw exception
                    Catenis.logger.ERROR('Failure trying to create new Catenis admin user account.', err);
                    throw new Meteor.Error('admin.create.failure', 'Failure trying to create new Catenis admin user account: ' + err.toString());
                }
            }
            else {
                // User not logged in or not a system administrator.
                //  Throw exception
                throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
            }
        }
    });
};


// AdminAccountUI function class (public) properties
//

/*AdminAccountUI.prop = {};*/


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(AdminAccountUI);
