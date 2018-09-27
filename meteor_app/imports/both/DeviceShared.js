/**
 * Created by claudio on 2018-09-21.
 */

//console.log('[DeviceShared.js]: This code just ran.');

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

// DeviceShared function class
export function DeviceShared() {
}


// Public DeviceShared object methods
//

/*DeviceShared.prototype.pub_func = function () {
};*/


// Module functions used to simulate private DeviceShared object methods
//  NOTE: these functions need to be bound to a DeviceShared object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// DeviceShared function class (public) methods
//

/*DeviceShared.class_func = function () {
};*/


// DeviceShared function class (public) properties
//

DeviceShared.status = Object.freeze({
    new: Object.freeze({
        name: 'new',
        description: 'Newly created device awaiting activation; funding of device\'s main/asset addresses have not started (due to lack of system funds)'
    }),
    pending: Object.freeze({
        name: 'pending',
        description: 'Awaiting confirmation of funding of device\'s main/asset addresses'
    }),
    active: Object.freeze({
        name: 'active',
        description: 'Device is in its normal use mode; after device\'s main/asset addresses have been funded'
    }),
    inactive: Object.freeze({
        name: 'inactive',
        description: 'Disabled device; device has been put temporarily out of use'
    }),
    deleted: Object.freeze({
        name: 'deleted',
        description: 'Device has been logically deleted'
    })
});


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(DeviceShared);
