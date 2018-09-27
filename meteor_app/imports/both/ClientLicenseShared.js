/**
 * Created by claudio on 2018-07-30.
 */

//console.log('[ClientLicenseShared.js]: This code just ran.');

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

// ClientLicenseShared function class
export function ClientLicenseShared() {
}


// Public ClientLicenseShared object methods
//

/*ClientLicenseShared.prototype.pub_func = function () {
};*/


// Module functions used to simulate private ClientLicenseShared object methods
//  NOTE: these functions need to be bound to a ClientLicenseShared object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// ClientLicenseShared function class (public) methods
//

/*ClientLicenseShared.class_func = function () {
};*/


// ClientLicenseShared function class (public) properties
//

ClientLicenseShared.status = Object.freeze({
    provisioned: Object.freeze({
        name: 'provisioned',
        description: 'License is assigned to client but has not yet been activated'
    }),
    active: Object.freeze({
        name: 'active',
        description: 'License is currently in effect'
    }),
    expired: Object.freeze({
        name: 'expired',
        description: 'License is no longer valid'
    })
});


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(ClientLicenseShared);
