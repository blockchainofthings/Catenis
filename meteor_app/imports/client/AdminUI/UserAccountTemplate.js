/**
 * Created by Claudio on 2018-08-25.
 */

//console.log('[UserAccountTemplate.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//  NOTE: the reference of these modules are done sing 'require()' instead of 'import' to
//      to avoid annoying WebStorm warning message: 'default export is not defined in
//      imported module'
//const util = require('util');
// Third-party node modules
//import config from 'config';
// Meteor packages
//import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';

// References code in other (Catenis) modules on the client
//import { Catenis } from '../ClientCatenis';

// Import template UI
import './UserAccountTemplate.html';

// Import dependent templates


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

Template.userAccount.onCreated(function () {
});

Template.userAccount.onDestroyed(function () {
});

Template.userAccount.events({
});

Template.userAccount.helpers({
});
