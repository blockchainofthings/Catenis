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


// Module code
//

function checkLoadReCaptchaApi() {
    if (typeof grecaptcha === 'undefined') {
        $.getScript('https://www.google.com/recaptcha/api.js');
    }
}

Template.atPwdForm.onCreated(function () {
    this.state = new ReactiveDict();

    this.state.set('rendered', false);
    this.state.set('useReCaptcha', false);

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
    }
});

// Override atForm from useraccounts module to custom style it with bootstrap
Template.loginForm.replaces("atPwdForm");

Template.atForm.helpers(AccountsTemplates.atFormHelpers);
