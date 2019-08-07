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
import { Tracker } from 'meteor/tracker';

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
    visible: ['signIn', 'resetPwd']
}, {
    _id: 'user_json',
    type: 'hidden',
    visible: ['signIn', 'resetPwd']
}, {
    _id: 'pwd_hash_json',
    type: 'hidden',
    visible: ['resetPwd']
}]);

AccountsTemplates.configure({
    loginFunc: twoFactorAuthLogin,
    resetPasswordFunc: twoFactorAuthResetPassword,

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

let monitoringState = false;

function monitorState() {
    if (Meteor.isClient && !monitoringState) {
        Tracker.autorun(() => {
            const state = AccountsTemplates.state.form.get('state');

            // Clear two-factor verification indication whenever state changes
            AccountsTemplates.state.form.set("2faVerify", false);

            if (state === 'signIn') {
                // Reset form
                const $usernameField = $('#at-field-username_and_email');
                const $passwordField = $('#at-field-password');

                //$usernameField.val('');
                $usernameField.css('display', 'inline');
                //$passwordField.val('');
                $passwordField.css('display', 'inline');

                const $verifyCodeField = $('#at-field-verify_code');
                $verifyCodeField.val('');
                $verifyCodeField.css('display', 'none');

                $('#at-field-user_json').val('');
            }
        });

        monitoringState = true;
    }
}

function twoFactorAuthLogin(user, password, formData) {
    monitorState();

    if (!formData.user_json) {
        return Meteor.loginWithPassword(user, password, function (error) {
            if (error && (error instanceof Meteor.Error) && error.error === 'verify-code-required') {
                // Error indicating that a verification code should be provided for
                //  two-factor authentication

                // Morph form to enter two-factor authentication verification code

                // Hide username and password input fields, and show verification code input field
                $('#at-field-username_and_email').css('display', 'none');
                $('#at-field-password').css('display', 'none');

                // Change title and button label
                AccountsTemplates.state.form.set("2faVerify", true);

                // Display verification code field
                const $verifyCodeField = $('#at-field-verify_code');
                $verifyCodeField.css('display', 'inline');
                $verifyCodeField.focus();

                // Save user info
                $('#at-field-user_json').val(error.details);

                return;
            }

            // Process return from regular sign-in (with no two-factory authentication)
            AccountsTemplates.submitCallback(error, 'singIn');
        });
    }
    else if (formData.verify_code) {
        // Verification code has been provided. Call custom two-factor authentication
        //  login method

        // Note: we get the user from the error message so we do not need to check whether
        //      the passed in user parameter is an object (with either a username or email)
        //      or a string (being either a username or email too), and do the proper
        //      conversion if the latter case
        Accounts.callLoginMethod({
            methodArguments: [{
                user: JSON.parse(formData.user_json),
                twoFactorAuthPassword: Accounts._hashPassword(password),
                verifyCode: formData.verify_code
            }],
            userCallback: (error) => {
                if (error) {
                    if ((error instanceof Meteor.Error) && error.error === 403
                        && typeof error.reason === 'string' && /^Invalid code\. .*/.test(error.reason)) {
                        // Clear verification code input field
                        const $verifyCodeField = $('#at-field-verify_code');
                        $verifyCodeField.val('');
                        $verifyCodeField.focus();
                    }
                }
                else {
                    // Code successfully verified. Clear verification code and saved fields
                    $('#at-field-verify_code').val('');
                    $('#at-field-user_json').val('');

                    // Clear two-factor verification indication
                    AccountsTemplates.state.form.set("2faVerify", false);
                }

                // Process return from login (with two-factor authentication)
                AccountsTemplates.submitCallback(error, 'singIn');
            }
        });
    }
}

function twoFactorAuthResetPassword(token, newPassword, formData) {
    monitorState();

    if (!formData.user_json) {
        // First (original) call. Process password reset
        return Accounts.resetPassword(token, newPassword, function (error) {
            if (error && (error instanceof Meteor.Error) && error.error === 'verify-code-required') {
                // Error indicating that a verification code should be provided for
                //  two-factor authentication

                // Indicate that password had been successfully reset
                AccountsTemplates.state.form.set("result", AccountsTemplates.texts.info.pwdReset);

                const $passwordField = $('#at-field-password');
                const $passwordAgainField = $('#at-field-password_again');

                $passwordField.val('');
                $passwordField.prop('disabled', true);

                $passwordAgainField.val('');
                $passwordAgainField.prop('disabled', true);


                setTimeout(() => {
                    // Morph form to enter two-factor authentication verification code

                    // Clear result (password reset) message
                    AccountsTemplates.state.form.set("result", null);

                    $passwordField.prop('disabled', false);
                    $passwordAgainField.prop('disabled', false);

                    // Hide password and password again input fields, and show verification code input field
                    $passwordField.css('display', 'none');
                    $passwordAgainField.css('display', 'none');

                    // Change title and button label
                    AccountsTemplates.state.form.set("2faVerify", true);

                    // Display verification code field
                    const $verifyCodeField = $('#at-field-verify_code');
                    $verifyCodeField.css('display', 'inline');
                    $verifyCodeField.focus();

                    // Save user info and password hash
                    $('#at-field-user_json').val(error.details);
                    $('#at-field-pwd_hash_json').val(JSON.stringify(Accounts._hashPassword(newPassword)));
                }, AccountsTemplates.options.redirectTimeout);

                return;
            }

            // Process return from regular password reset (with no two-factory authentication)
            AccountsTemplates.submitCallback(error, 'resetPwd', function(){
                AccountsTemplates.state.form.set("result", AccountsTemplates.texts.info.pwdReset);

                $("#at-field-password").val('');
                $("#at-field-password_again").val('');
            });
        });
    }
    else if (formData.verify_code) {
        // Verification code has been provided. Call custom two-factor authentication
        //  login method
        Accounts.callLoginMethod({
            methodArguments: [{
                user: JSON.parse(formData.user_json),
                twoFactorAuthPassword: JSON.parse(formData.pwd_hash_json),
                verifyCode: formData.verify_code
            }],
            userCallback: (error) => {
                if (error) {
                    if ((error instanceof Meteor.Error) && error.error === 403
                            && typeof error.reason === 'string' && /^Invalid code\. .*/.test(error.reason)) {
                        // Clear verification code input field
                        const $verifyCodeField = $('#at-field-verify_code');
                        $verifyCodeField.val('');
                        $verifyCodeField.focus();
                    }
                }
                else {
                    // Code successfully verified. Clear verification code and saved fields
                    $('#at-field-verify_code').val('');
                    $('#at-field-user_json').val('');
                    $('#at-field-pwd_hash_json').val('');

                    // Clear two-factor verification indication
                    AccountsTemplates.state.form.set("2faVerify", false);
                }

                // Process return from login (with two-factor authentication) after password reset
                AccountsTemplates.submitCallback(error, 'resetPwd', () => {
                    // Change state to sign-in so no timeout is used before effectively login the user in
                    AccountsTemplates.setState('signIn');
                });
            }
        });
    }
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
