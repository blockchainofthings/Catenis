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
import { ReactiveDict } from 'meteor/reactive-dict';
import { Meteor } from 'meteor/meteor';

// Import template UI
import './LoginTemplate.html';

// Import dependent templates
import './LoginForm.js';
import './LoginBtn.js';


// Module code
//

Template.login.onCreated(function () {
    this.state = new ReactiveDict();

    this.state.set('enableSelfRegistration', undefined);

    Meteor.call('checkEnableSelfRegistration', (err, isSet) => {
        if (err) {
            console.log('Error calling \'checkEnableSelfRegistration\' remote procedure: ' + err);
        }
        else {
            this.state.set('enableSelfRegistration', isSet);
        }
    });

    // Clear indication that verification e-mail has been sent
    AccountsTemplates.state.form.set("verifyEmailSent", false);
});

Template.login.events({
    'click #login-form-link'(event, template) {
        // Clear indication that verification e-mail has been sent
        AccountsTemplates.state.form.set("verifyEmailSent", false);

        // Force form reset (re-rendering of all fields)
        AccountsTemplates.state.form.set('clearForm', !AccountsTemplates.state.form.get('clearForm'));
        setTimeout(
            () => AccountsTemplates.state.form.set('clearForm', !AccountsTemplates.state.form.get('clearForm')),
            1
        );

        AccountsTemplates.setState('signIn');
    },
    'click #register-form-link'(event, template) {
        // Clear indication that verification e-mail has been sent
        AccountsTemplates.state.form.set("verifyEmailSent", false);

        // Force form reset (re-rendering of all fields)
        AccountsTemplates.state.form.set('clearForm', !AccountsTemplates.state.form.get('clearForm'));
        setTimeout(
            () => AccountsTemplates.state.form.set('clearForm', !AccountsTemplates.state.form.get('clearForm')),
            1
        );

        AccountsTemplates.setState('signUp');
    },
    'click #resend-verify_email-form-link'(event, template) {
        // Clear indication that verification e-mail has been sent
        AccountsTemplates.state.form.set("verifyEmailSent", false);

        AccountsTemplates.setState('resendVerificationEmail');
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
        else if (state === 'signUp') {
            return "ACCOUNT REGISTRATION";
        }
        else if (state === 'resendVerificationEmail') {
            return 'VERIFICATION EMAIL';
        }
        else if (state === 'verifyEmail') {
            return 'EMAIL VERIFICATION';
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
            case 'signUp':
                instruction = 'Fill up the form to create a new account';
                break;

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
    },
    verificationEmailSent() {
        return AccountsTemplates.state.form.get("verifyEmailSent");
    },
    enableSelfRegistration() {
        return Template.instance().state.get('enableSelfRegistration');
    },
    isDefined(v) {
        return typeof v !== 'undefined';
    },
    clearForm() {
        return AccountsTemplates.state.form.get('clearForm');
    }
});
