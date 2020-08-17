/**
 * Created by Claudio on 2017-05-17.
 */

//console.log('[LoginTemplate.js]: This code just ran.');

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
import { FlowRouter } from 'meteor/kadira:flow-router';
import { Roles } from 'meteor/alanning:roles';

// Import template UI
import './LoginTemplate.html';

// Import dependent templates
import './LoginForm.js';
import './LoginBtn.js';


// Definition of module (private) functions
//

function redirectHome(user_id) {
    if (Roles.userIsInRole(user_id, 'sys-admin')) {
        FlowRouter.go('/admin');
    }
    else if (Roles.userIsInRole(user_id, 'ctn-client')) {
        FlowRouter.go('/');
    }
}


// Module code
//

Template.login.events({
    'click #login-form-link'(event, template) {
        AccountsTemplates.setState('signIn');
    },
    'click #cancel-2fa-link'(event, template) {
        if (AccountsTemplates.getState() !== 'singIn') {
            // Force state change to reset form
            AccountsTemplates.setState('forgotPwd');
        }
        
        AccountsTemplates.setState('signIn');
    },
    'click #forgotPwd-form-link'(event, template){
        AccountsTemplates.setState('forgotPwd');
    }
});

Template.login.helpers({
    atFormTitle() {
        const state = AccountsTemplates.getState();

        if (state === 'signIn') {
            return AccountsTemplates.state.form.get("2faVerify") ? "TWO-FACTOR VERIFICATION" : "SIGN IN";
        }
        else if (state === 'forgotPwd') {
            return "REQUEST PASSWORD RESET";
        }
        else if (state === 'enrollAccount') {
            return "ACTIVATE NEW ACCOUNT";
        }
        else if (state === 'resetPwd') {
            return AccountsTemplates.state.form.get("2faVerify") ? "TWO-FACTOR VERIFICATION" : "RESET PASSWORD";
        }
        else {
            return "Something went wrong";
        }
    },
    atFormInstruction() {
        let instruction;

        switch (AccountsTemplates.getState()) {
            case 'enrollAccount':
                instruction = 'Set the password to active your account';
                break;

            case 'forgotPwd':
                instruction = 'Enter your email address to receive instructions on how to reset your password';
                break;
        }

        return instruction;
    },
    equals(v1, v2) {
        return v1 === v2;
    }
});
