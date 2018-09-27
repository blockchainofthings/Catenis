/**
 * Created by claudio on 2018-08-02.
 */

//console.log('[LicenseShared.js]: This code just ran.');

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

// LicenseShared function class
export function LicenseShared() {
}


// Public LicenseShared object methods
//

/*LicenseShared.prototype.pub_func = function () {
};*/


// Module functions used to simulate private LicenseShared object methods
//  NOTE: these functions need to be bound to a LicenseShared object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// LicenseShared function class (public) methods
//

/*LicenseShared.class_func = function () {
};*/


// LicenseShared function class (public) properties
//

LicenseShared.status = Object.freeze({
    new: Object.freeze({
        name: 'new',
        description: 'License has been create but is not yet active'
    }),
    active: Object.freeze({
        name: 'active',
        description: 'License is currently active'
    }),
    inactive: Object.freeze({
        name: 'inactive',
        description: 'License is not active anymore'
    })
});


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(LicenseShared);
