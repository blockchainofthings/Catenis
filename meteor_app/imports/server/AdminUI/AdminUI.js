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
        // NOTE: the access to this (remote) method MUST not be restricted
        //      since it needs to be accessed from the login form too
        getAppEnvironment: function () {
            return Catenis.application.environment;
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
