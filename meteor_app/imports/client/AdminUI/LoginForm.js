/**
 * Created by Claudio on 2017-07-11.
 */

//console.log('[LoginForm.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
//import config from 'config';
// Meteor packages
import { Template } from "meteor/templating";
import { AccountsTemplates } from 'meteor/useraccounts:core';

// Import template UI
import './LoginForm.html';


// Module code
//

// Override atForm from useraccounts module to custom style it with bootstrap
Template.loginForm.replaces("atPwdForm");

Template.atForm.helpers(AccountsTemplates.atFormHelpers);
