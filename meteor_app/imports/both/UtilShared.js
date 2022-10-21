/**
 * Created by claudio on 2019-08-02.
 */

//console.log('[UtilShared.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
//import config from 'config';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules


// Definition of function classes
//

// UtilShared function class
export function UtilShared() {
}


// Public UtilShared object methods
//

/*UtilShared.prototype.pub_func = function () {
};*/


// Module functions used to simulate private UtilShared object methods
//  NOTE: these functions need to be bound to a UtilShared object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// UtilShared function class (public) methods
//

UtilShared.getUserEmail = function (user) {
    if (user && user.emails && user.emails.length > 0) {
        return user.emails[0].address;
    }
};


// UtilShared function class (public) properties
//

/*UtilShared.prototype.pub_func = function () {
};*/


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(UtilShared);
