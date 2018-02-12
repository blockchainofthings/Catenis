/**
 * Created by claudio on 12/05/17.
 */

//console.log('[ConfigLoginForm.js]: This code just ran.');

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
import { Meteor } from 'meteor/meteor';
import { Accounts } from 'meteor/accounts-base';

// Module code
//

// Do not allow users to freely update their own profile
Meteor.users.deny({
    update: function() {
        return true;
    }
});

Accounts.config({
    passwordResetTokenExpirationInDays: 3,
    passwordEnrollTokenExpirationInDays: 7
});
