/**
 * Created by claudio on 15/05/17.
 */

//console.log('[AdminLayout.js]: This code just ran.');

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
import { Template } from 'meteor/templating';

// Import template UI
import './AdminLayout.html';

// Import dependent templates
import './LoginTemplate.js';
import './SystemFundingTemplate.js';
import './ClientsTemplate.js';
import './DeviceDetailsTemplate.js';
import './NewClientTemplate.js';
import './NewDeviceTemplate.js';
//below was added by Peter to incorporate bootstrap styling of useraccounts
import './LoginForm.js';

Template.atForm.helpers(AccountsTemplates.atFormHelpers);


// Module code
//

Template.adminLayout.onCreated(function () {

});

Template.adminLayout.onRendered(function(){
    //added by peter to set default state for form.
    // console.log( AccountsTemplates.getState() );
});

Template.adminLayout.events({
    'click #lnkLogout'(event, template) {
        Meteor.logout();
        return false;
    },
    'click .menu-toggle'(event, template){
        $("#wrapper").toggleClass("toggled");
    },
});

Template.adminLayout.helpers({
});







//overriding the atForm from useraccounts module to custom style it with bootstrap.
Template.LoginForm.replaces("atPwdForm");

Template.login.events({
    'click #login-form-link'(event, template) {
        AccountsTemplates.setState('signIn');
    },
    'click #register-form-link'(event, template){
        AccountsTemplates.setState('signUp');
    },
    'click #forgotPwd-form-link'(event, template){
        AccountsTemplates.setState('forgotPwd');
    },
});


//shared helper
var determineState= {
    atFormTitle: function () {
        if( AccountsTemplates.getState() === 'signIn' ){
            return "LOGIN";
        }else if(AccountsTemplates.getState() === 'signUp'){
            return "REGISTER";

        }else if(AccountsTemplates.getState() === 'forgotPwd'){
            return "RESET PASSWORD";
        }else{
            return "";
        }
    },
    equals: function(v1, v2){
        return (v1===v2);
    }
};

Template.login.helpers(determineState);
Template.LoginForm.helpers(determineState);


