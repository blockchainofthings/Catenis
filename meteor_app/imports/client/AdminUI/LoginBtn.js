/**
 * Created by Claudio on 2017-07-26.
 */

//console.log('[LoginBtn.js]: This code just ran.');

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

// Import template UI
import './LoginBtn.html';


// Module code
//

Template.loginBtn.replaces("atPwdFormBtn");
