/**
 * Created by claudio on 2018-12-12.
 */

//console.log('[BcotSaleAllocationShared.js]: This code just ran.');

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

// BcotSaleAllocationShared function class
export function BcotSaleAllocationShared() {
}


// Public BcotSaleAllocationShared object methods
//

/*BcotSaleAllocationShared.prototype.pub_func = function () {
};*/


// Module functions used to simulate private BcotSaleAllocationShared object methods
//  NOTE: these functions need to be bound to a BcotSaleAllocationShared object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// BcotSaleAllocationShared function class (public) methods
//

/*BcotSaleAllocationShared.class_func = function () {
};*/


// BcotSaleAllocationShared function class (public) properties
//

BcotSaleAllocationShared.status = Object.freeze({
    new: Object.freeze({
        name: 'new',
        description: 'BCOT token sale allocation newly created'
    }),
    in_use: Object.freeze({
        name: 'in_use',
        description: 'Report of BCOT products allocated for sale has already been downloaded and they should be available for sale'
    })
});


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(BcotSaleAllocationShared);
