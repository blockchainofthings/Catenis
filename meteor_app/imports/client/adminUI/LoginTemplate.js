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

    Meteor.call('getSelfRegistrationSettings', (err, selfRegistration) => {
        if (err) {
            console.log('Error calling \'getSelfRegistrationSettings\' remote procedure: ' + err);
        }
        else {
            this.state.set('enableSelfRegistration', selfRegistration.enabled);
        }
    });

    // Clear indication that account registration enrollment e-mail has been sent
    AccountsTemplates.state.form.set("accRegEmailSent", false);
});

Template.login.events({
    'click #login-form-link'(event, template) {
        // Clear indication that account registration enrollment e-mail has been sent
        AccountsTemplates.state.form.set("accRegEmailSent", false);

        // Force form reset (re-rendering of all fields)
        AccountsTemplates.state.form.set('clearForm', !AccountsTemplates.state.form.get('clearForm'));
        setTimeout(
            () => AccountsTemplates.state.form.set('clearForm', !AccountsTemplates.state.form.get('clearForm')),
            1
        );

        AccountsTemplates.setState('signIn');
    },
    'click #register-form-link'(event, template) {
        event.preventDefault();

        // Clear indication that account registration enrollment e-mail has been sent
        AccountsTemplates.state.form.set("accRegEmailSent", false);

        // Force form reset (re-rendering of all fields)
        AccountsTemplates.state.form.set('clearForm', !AccountsTemplates.state.form.get('clearForm'));
        setTimeout(
            () => AccountsTemplates.state.form.set('clearForm', !AccountsTemplates.state.form.get('clearForm')),
            1
        );

        AccountsTemplates.setState('signUp');
    },
    'click #resend-acc_reg_email-form-link'(event, template) {
        event.preventDefault();

        const user_email = AccountsTemplates.state.form.get('new_user_email');

        AccountsTemplates.state.form.set("result", 'Resending email...');

        Meteor.call('finalizeAccountRegistration', user_email, (error) => {
            if (error) {
                console.error('Error calling \'finalizeAccountRegistration\' remote method:', error);
                AccountsTemplates.state.form.set("result", 'Failure resending email.');
            }
            else {
                AccountsTemplates.state.form.set("result", 'The email has been resent. Please check your inbox.');
            }
        });
    },
    'click #cancel-2fa-link'(event, template) {
        event.preventDefault();

        if (AccountsTemplates.getState() !== 'singIn') {
            // Force state change to reset form
            AccountsTemplates.setState('forgotPwd');
        }
        
        AccountsTemplates.setState('signIn');
    },
    'click #forgotPwd-form-link'(event, template){
        event.preventDefault();

        AccountsTemplates.setState('forgotPwd');
    }
});

Template.login.helpers({
    isAccountRegistration() {
        return AccountsTemplates.getState() === 'signUp';
    },
    atFormTitle() {
        const state = AccountsTemplates.getState();

        if (state === 'signIn') {
            return AccountsTemplates.state.form.get("2faVerify") ? "TWO-FACTOR VERIFICATION" : "SIGN IN";
        }
        else if (state === 'forgotPwd') {
            return "REQUEST PASSWORD RESET";
        }
        else if (state === 'signUp') {
            return "CREATE A FREE ACCOUNT";
        }
        else if (state === 'resendVerificationEmail') {
            return 'VERIFY EMAIL';
        }
        else if (state === 'verifyEmail') {
            return 'EMAIL VERIFICATION';
        }
        else if (state === 'enrollAccount') {
            return "ACCOUNT PASSWORD";
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
    },
    accRegistrationEmailSent() {
        return AccountsTemplates.state.form.get("accRegEmailSent");
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
