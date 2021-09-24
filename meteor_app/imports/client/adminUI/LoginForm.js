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
import { ReactiveDict } from 'meteor/reactive-dict';
import { Meteor } from "meteor/meteor";


// Definition of module (private) functions
//

function checkLoadReCaptchaApi() {
    if (typeof grecaptcha === 'undefined') {
        $.getScript('https://www.google.com/recaptcha/api.js');
    }
}


// Module code
//

Template.atPwdForm.onCreated(function () {
    this.state = new ReactiveDict();

    this.state.set('rendered', false);
    this.state.set('useReCaptcha', true);

    // Retrieve setting for using reCAPTCHA on login form
    Meteor.call('useReCaptchaForLogin', (error, useReCaptcha) => {
        if (error) {
            console.log('Error calling \'useReCaptchaForLogin\' remote method: ' + error);
        }
        else {
            this.state.set('useReCaptcha', useReCaptcha);

            if (useReCaptcha && this.state.get('rendered')) {
                checkLoadReCaptchaApi();
            }
        }
    });
});

Template.atPwdForm.onRendered(function () {
    this.state.set('rendered', true);

    if (this.state.get('useReCaptcha')) {
        checkLoadReCaptchaApi();
    }
});

Template.atPwdForm.helpers({
    useReCaptcha() {
        return Template.instance().state.get('useReCaptcha');
    },
    verificationEmailSent() {
        return AccountsTemplates.state.form.get("verifyEmailSent");
    },
    formDisabled() {
        return AccountsTemplates.disabled();
    },
    showWaitNotice() {
        return AccountsTemplates.disabled() && AccountsTemplates.getState() === 'signUp';
    }
});

// Override atForm from useraccounts module to custom style it with bootstrap
Template.loginForm.replaces("atPwdForm");

Template.atForm.helpers(AccountsTemplates.atFormHelpers);
