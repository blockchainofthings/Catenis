/**
 * Created by claudio on 2018-08-27.
 */

//console.log('[ClientShared.js]: This code just ran.');

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

// ClientShared function class
export function ClientShared() {
}


// Public ClientShared object methods
//

/*ClientShared.prototype.pub_func = function () {
};*/


// Module functions used to simulate private ClientShared object methods
//  NOTE: these functions need to be bound to a ClientShared object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// ClientShared function class (public) methods
//

/*ClientShared.class_func = function () {
};*/


// ClientShared function class (public) properties
//

ClientShared.status = Object.freeze({
    new: Object.freeze({
        name: 'new',
        description: 'Newly created client awaiting activation'
    }),
    active: Object.freeze({
        name: 'active',
        description: 'Client is in its normal use mode'
    }),
    deleted: Object.freeze({
        name: 'deleted',
        description: 'Client has been logically deleted'
    })
});


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(ClientShared);
