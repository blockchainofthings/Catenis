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
    defaultLayout: 'blankLayout',
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
            signIn: 'Log In',
            signUp: 'Register'
        }
    },
});

// Configure special routes for accounts templates
AccountsTemplates.configureRoute('resetPwd', {template: 'resetPwd'});
AccountsTemplates.configureRoute('enrollAccount', {template: 'enrollAccount'});

// Method called after accounts template form is submitted
//
//  Arguments:
//   error: [Object] - Error object containing information about the error that took place, if any
//   state: [String] - Current internal state of accounts template. Valid values: 'changePwd', 'enrollAccount',
//                      'forgotPwd', 'resetPwd', 'signIn', 'signUp', 'verifyEmail', 'resendVerificationEmail'
function onSubmitFunc(error, state) {
    //runs on successful at-pwd-form submit. Use this to allow for client activation and banning disabled users
    if (!error) {
        // Successfully enrolled client, change client status to "ACTIVE"
        if (state === 'enrollAccount') {
            //check if user is actually a first time user.
            if (Meteor.user().profile.status === 'Pending') {
                //activate user
                Meteor.call('activateCurrentUser', (error) => {
                });

                //createClient
                Meteor.call('createClient', Meteor.user()._id, (error))
            }

            //Successful Activation, now going to log this person out and redirect them to a new page with a link to login.
            Meteor.logout();
            FlowRouter.go('/');
        }
        else if (state === 'signIn') {
            const user = Meteor.user();
            if (!Roles.userIsInRole(user._id, 'sys-admin')) {
                // Ensure that the meteor account of the client is activated. Otherwise logout
                if (user.profile.status !== 'Activated') {
                    Meteor.logout();
                }
            }
        }
        else if (state === 'resetPwd') {
            // Ensure that this user is activated. Otherwise refuse login
            Meteor.logout();
            FlowRouter.go('/');
        }
    }
}
