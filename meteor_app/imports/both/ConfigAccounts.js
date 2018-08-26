/**
 * Created by claudio on 2017-05-12.
 */

//console.log('[ConfigAccounts.js]: This code just ran.');

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
import { AccountsTemplates } from 'meteor/useraccounts:core';
import { FlowRouter } from 'meteor/kadira:flow-router';
import { Roles } from 'meteor/alanning:roles';

// Module code
//

// Do not allow users to freely update their own profile
Meteor.users.deny({
    update: function() {
        return true;
    }
});

// Set accounts security policies
Accounts.config({
    loginExpirationInDays: 1,
    passwordResetTokenExpirationInDays: 3,
    passwordEnrollTokenExpirationInDays: 7,
    ambiguousErrorMessages: true
});

// Change accounts templates settings
const pwd = AccountsTemplates.removeField('password');

AccountsTemplates.addFields([{
    _id: 'username',
    type: 'text',
    displayName: 'Username',
    required: true,
    minLength: 5,
}, pwd]);

AccountsTemplates.configure({
    defaultLayout: 'loginLayout',
    defaultLayoutRegions: {},
    defaultContentRegion: 'page',

    enablePasswordChange: true,
    focusFirstInput: true,
    forbidClientAccountCreation: true,
    overrideLoginErrors: true,

    hideSignInLink: true,
    hideSignUpLink: true,
    showLabels: false,
    showForgotPasswordLink: true,
    showPlaceholders: true,

    onSubmitHook: onSubmitFunc,
    onLogoutHook: onLogout,

    texts: {
        title: {
            // Get rid of their titles
            signIn: '',
            signUp: '',
            forgotPwd: '',
            enrollAccount: '',
            resetPwd: ''
        },
        button: {
            changePwd: 'Change Password',
            enrollAccount: 'Enroll Account',
            forgotPwd: 'Send Email Link',
            resetPwd: 'Reset Password',
            signIn: 'Sign In',
            signUp: 'Register'
        }
    },
});

// Configure special routes for accounts templates
AccountsTemplates.configureRoute('signIn', {
    path: '/login',
    template: 'login',
    redirect: function () {
        redirectHome();
    }
});
AccountsTemplates.configureRoute('resetPwd', {
    template: 'login',
    redirect: function () {
        redirectHome();
    }
});
AccountsTemplates.configureRoute('enrollAccount', {
    template: 'login',
    redirect: function () {
        redirectHome();
    }
});

// Method called after accounts template form is submitted
//
//  Arguments:
//   error: [Object] - Error object containing information about the error that took place, if any
//   state: [String] - Current internal state of accounts template. Valid values: 'changePwd', 'enrollAccount',
//                      'forgotPwd', 'resetPwd', 'signIn', 'signUp', 'verifyEmail', 'resendVerificationEmail'
function onSubmitFunc(error, state) {
    //runs on successful at-pwd-form submit. Use this to allow for client activation and banning disabled users
    if (!error) {
        if (state === 'enrollAccount') {
            // Client account successfully enrolled. Activate client
            Meteor.call('activateClient', Meteor.userId(), (error) => {
                if (error) {
                    console.log('Error calling \'activateClient\' remote method: ' + error);
                    AccountsTemplates.logout();
                }
            });
        }
    }
}

function redirectHome() {
    const user = Meteor.user();
    const user_id = user ? user._id : Meteor.userId();

    if (Roles.userIsInRole(user_id, 'sys-admin')) {
        FlowRouter.go('/admin');
    }
    else if (Roles.userIsInRole(user_id, 'ctn-client')) {
        FlowRouter.go('/');
    }
}

function onLogout() {
    AccountsTemplates.setState('signIn');
    FlowRouter.go('/login');
}
