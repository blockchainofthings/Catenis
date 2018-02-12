/**
 * Created by claudio on 12/02/18.
 */

//console.log('[LoginFlow.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
//import config from 'config';
// Meteor packages
import { Meteor } from 'meteor/meteor';
import { Accounts } from 'meteor/accounts-base';
import { Catenis } from '../Catenis';

// References code in other (Catenis) modules
//import { variable_name } from './module_name';

// Config entries
/*const config_entryConfig = config.get('config_entry');

// Configuration settings
const cfgSettings = {
    property: config_entryConfig.get('property_name')
};*/


// Definition of function classes
//

// LoginFlow function class
export function LoginFlow() {
}


// Public LoginFlow object methods
//

/*LoginFlow.prototype.pub_func = function () {
};*/


// Module functions used to simulate private LoginFlow object methods
//  NOTE: these functions need to be bound to a LoginFlow object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// LoginFlow function class (public) methods
//

LoginFlow.initialize = function () {
    Catenis.logger.TRACE('LoginFlow initialization');
    Accounts.urls.resetPassword = function(token) {
        return Meteor.absoluteUrl('reset-password/' + token);
    };

    Accounts.urls.enrollAccount = function(token) {
        return Meteor.absoluteUrl('enroll-account/' + token);
    };

    // Configure e-mail template used to reset password
    Accounts.emailTemplates.resetPassword.subject = (user) => {
        return 'Catenis Password Reset';
    };
    Accounts.emailTemplates.resetPassword.text = (user, url) => {
        return 'Welcome again to Catenis\n\n Click this link to reset your password: ' + url + '\n\n';
    };

    // Configure e-mail template used to enroll account
    Accounts.emailTemplates.enrollAccount.subject = (user) => {
        return 'Catenis Enroll Account';
    };
    Accounts.emailTemplates.enrollAccount.text = (user, url) => {
        return 'Welcome to Catenis\n\n Click this link to set your password: ' + url + '\n\n';
    };
};


// LoginFlow function class (public) properties
//

/*LoginFlow.prop = {};*/


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(LoginFlow);
