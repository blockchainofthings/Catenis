/**
 * Created by Claudio on 2018-02-12.
 */

//console.log('[License.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import config from 'config';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { variable_name } from './License';

// Config entries
const licenseConfig = config.get('license');

// Configuration settings
export const cfgSettings = {
    defaultLicenses: licenseConfig.get('defaultLicenses')
};


// Definition of function classes
//

// License function class
export function License() {
}


// Public License object methods
//

/*License.prototype.pub_func = function () {
};*/


// Module functions used to simulate private License object methods
//  NOTE: these functions need to be bound to a License object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// License function class (public) methods
//

/*License.class_func = function () {
};*/


// License function class (public) properties
//

/*License.prop = {};*/


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(License);
