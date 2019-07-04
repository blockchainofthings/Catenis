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
}, pwd, {
    _id: 'verify_code',
    type: 'text',
    displayName: 'Verification code',
    placeholder: 'Verification code',
    required: false,
    minLength: 6,
    maxLength: 6,
    re: /\d{0,6}/,
    continuousValidation: true,
    visible: ['signIn']
}]);

AccountsTemplates.configure({
    loginFunc: twoFactorAuthLogin,

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

function twoFactorAuthLogin(user, password, formData, state) {
    return Meteor.loginWithPassword(user, password, function (error) {
        if (error && (error instanceof Meteor.Error) && error.error === 'verify-code-required') {
            // Error indicating that a verification code should be provided for
            //  two-factor authentication
            if (!formData.verify_code) {
                // Hide username and password input fields, and show verification code input field
                $('#at-field-username_and_email')[0].style.display = 'none';
                $('#at-field-password')[0].style.display = 'none';

                // Change title and button label
                $('h2 ~ div.at-form').prev('h2').text('TWO-FACTOR VERIFICATION');
                $('button#login-submit').text('VERIFY');

                const verifyCodeField = $('#at-field-verify_code')[0];

                verifyCodeField.style.display = 'inline';
                verifyCodeField.focus();
            }
            else {
                // Verification code has been provided. Call custom two-factor authentication
                //  login method
                if (typeof user === 'string') {
                    user = !user.includes('@') ? {username: user} : {email: user};
                }

                Accounts.callLoginMethod({
                    methodArguments: [{
                        user: user,
                        twoFactorAuthPassword: Accounts._hashPassword(password),
                        verifyCode: formData.verify_code
                    }],
                    userCallback: (error) => {
                        if (error && (error instanceof Meteor.Error) && error.error === 403
                                && typeof error.reason === 'string' && /^Invalid code\. .*/.test(error.reason)) {
                            // Clear verification code input field
                            const verifyCodeField = $('#at-field-verify_code')[0];

                            verifyCodeField.value = '';
                            verifyCodeField.focus();
                        }

                        AccountsTemplates.submitCallback(error, state);
                    }
                });
            }

            return;
        }

        AccountsTemplates.submitCallback(error, state);
    });
}

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
    else {
        // Unrecognized account. Just log out
        AccountsTemplates.logout();
    }
}

function onLogout() {
    AccountsTemplates.setState('signIn');
    FlowRouter.go('/login');
}
