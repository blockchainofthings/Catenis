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
//import { Meteor } from 'meteor/meteor';
import { AccountsTemplates } from 'meteor/useraccounts:core';


// Module code
//

AccountsTemplates.configure({
    //this below all was changed by peter just to incorporate Andre's design.
    // forbidClientAccountCreation: true;
    showLabels: false,
    hideSignInLink: true,
    hideSignUpLink: true,
    texts: {
        title: {
            //get rid of their titles
            signIn: "",
            signUp: "",
            forgotPwd:"",
        }
    }


});
