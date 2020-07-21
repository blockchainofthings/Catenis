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

// References code in other (Catenis) modules on the client
import { LoginChallenge } from './LoginChallenge';


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
    _id: 'user_id',
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
            forgotPwd: '',
            enrollAccount: '',
            resetPwd: ''
        },
        button: {
            changePwd: 'Change Password',
            enrollAccount: 'Enroll Account',
            forgotPwd: 'Send Email Link',
            resetPwd: 'Reset Password',
            signIn: 'Sign In'
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

                $('#at-field-user_id').val('');

                // Make sure that form is enabled
                AccountsTemplates.setDisabled(false);
            }
        });

        monitoringState = true;
    }
}

let monitoringDisabled = false;

function monitorDisabled() {
    if (Meteor.isClient && !monitoringDisabled) {
        Tracker.autorun(() => {
            // Enable/disable form fields as the disabled state changes
            const disabled = !!AccountsTemplates.disabled();

            $('#at-field-username_and_email')[0].disabled = disabled;
            $('#at-field-password')[0].disabled = disabled;
        });

        monitoringDisabled = true;
    }
}

function returnLoginError(error) {
    if (!error) {
        error = new Meteor.Error(403, 'Something went wrong. Please check your credentials.');
    }

    AccountsTemplates.submitCallback(error, 'singIn');
}

function setUpTwoFactorAuthentication(userId) {
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
    $('#at-field-user_id').val(userId);
}

let loginCredentials;

function twoFactorAuthLogin(user, password, formData) {
    monitorState();
    monitorDisabled();

    if (!formData.user_id) {
        // User logging in
        function processReCaptchaResponse(token) {
            // Call custom reCAPTCHA login method
            Accounts.callLoginMethod({
                methodArguments: [{
                    userId: loginCredentials.userId,
                    pswHash: Accounts._hashPassword(loginCredentials.password),
                    reCaptchaToken: token
                }],
                userCallback: (error) => {
                    if (error && (error instanceof Meteor.Error) && error.error === 'challenge-user') {
                        // Error indicating that user should be challenged
                        const challengeInfo = JSON.parse(error.details);

                        if (challengeInfo.challengeType === LoginChallenge.type.twoFAuth) {
                            // Challenge user with two-factor authentication
                            setUpTwoFactorAuthentication(challengeInfo.userId);

                            return;
                        }
                        else {
                            // Unexpected login challenge type
                            console.error('Unexpected login challenge type processing reCAPTCHA response');
                            error = new Meteor.Error(500, 'Internal server error');
                        }
                    }

                    // Process return from regular sign-in (with no two-factory authentication)
                    AccountsTemplates.submitCallback(error, 'singIn');
                }
            });

            // Clear login credentials
            loginCredentials = undefined;
        }

        function activateReCaptcha() {
            grecaptcha.execute().catch((err) => {
                console.error('Error trying to execute reCAPTCHA:', err);
                // Return error
                returnLoginError();
            });
        }

        function processReCaptcha() {
            // reCAPTCHA is enabled for login
            let reloadReCaptcha = false;

            try {
                grecaptcha.reset();
            }
            catch (err) {
                if ((err instanceof Error) && err.message === 'No reCAPTCHA clients exist.') {
                    reloadReCaptcha = true;
                }
                else {
                    console.error('Error resetting reCAPTCHA:', err);
                    // Return error
                    returnLoginError();
                }
            }

            if (reloadReCaptcha) {
                function loadReCaptcha(siteKey) {
                    // Render reCAPTCHA
                    grecaptcha.render('ctn-login-recaptcha', {
                        sitekey: siteKey,
                        size: 'invisible',
                        callback: processReCaptchaResponse
                    });

                    activateReCaptcha();
                }

                if (!AccountsTemplates.state.form.get('reCaptchaSiteKey')) {
                    // Retrieve reCAPTCHA site key
                    Meteor.call('getReCaptchaSiteKey', (error, siteKey) => {
                        if (error) {
                            console.error('Error calling \'getReCaptchaSiteKey\' remote method:', error);
                            // Return error
                            returnLoginError();
                        }
                        else {
                            // Save reCAPTCHA site key, and load reCAPTCHA
                            AccountsTemplates.state.form.set('reCaptchaSiteKey', siteKey);
                            loadReCaptcha(siteKey);
                        }
                    });
                }
                else {
                    // Load reCAPTCHA
                    loadReCaptcha(AccountsTemplates.state.form.get('reCaptchaSiteKey'));
                }
            }
            else {
                activateReCaptcha();
            }
        }

        // Disable form
        AccountsTemplates.setDisabled(true);

        Meteor.loginWithPassword(user, password, (error) => {
            if (error && (error instanceof Meteor.Error) && error.error === 'challenge-user') {
                // Error indicating that user should be challenged
                const challengeInfo = JSON.parse(error.details);

                if (challengeInfo.challengeType === LoginChallenge.type.reCaptcha) {
                    // Challenge user with reCAPTCHA

                    // Save login credentials
                    loginCredentials = {
                        userId: challengeInfo.userId,
                        password: password
                    };

                    processReCaptcha();
                }
                else if (challengeInfo.challengeType === LoginChallenge.type.twoFAuth) {
                    // Challenge user with two-factor authentication
                    setUpTwoFactorAuthentication(challengeInfo.userId);
                }

                return;
            }

            // Process return from regular sign-in (with no user challenge)
            AccountsTemplates.submitCallback(error, 'singIn');
        });
    }
    else if (formData.verify_code) {
        // Verification code has been provided. Call custom two-factor authentication
        //  login method
        Accounts.callLoginMethod({
            methodArguments: [{
                userId: formData.user_id,
                pswHash: Accounts._hashPassword(password),
                twoFAVerifyCode: formData.verify_code
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
                    $('#at-field-user_id').val('');

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

    if (!formData.user_id) {
        // First (original) call. Process password reset
        return Accounts.resetPassword(token, newPassword, function (error) {
            if (error && (error instanceof Meteor.Error) && error.error === 'challenge-user') {
                // Error indicating that user should be challenged
                const challengeInfo = JSON.parse(error.details);

                if (challengeInfo.challengeType === LoginChallenge.type.twoFAuth) {
                    // Challenge user with two-factor authentication

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
                        $('#at-field-user_id').val(challengeInfo.userId);
                        $('#at-field-pwd_hash_json').val(JSON.stringify(Accounts._hashPassword(newPassword)));
                    }, AccountsTemplates.options.redirectTimeout);

                    return;
                }
                else {
                    // Unexpected login challenge type
                    console.error('Unexpected login challenge type processing password reset');
                    error = new Meteor.Error(500, 'Internal server error');
                }
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
                userId: formData.user_id,
                pswHash: JSON.parse(formData.pwd_hash_json),
                twoFAVerifyCode: formData.verify_code
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
                    $('#at-field-user_id').val('');
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
//   state: [String] - Current internal state of accounts template. Valid values: 'changePwd', 'enrollAccount', 'forgotPwd'
//                      'resetPwd', 'signIn', 'signUp' (not currently in use), 'verifyEmail', 'resendVerificationEmail'
function onSubmitFunc(error, state) {
    //runs on successful at-pwd-form submit. Use this to allow for client activation and banning disabled users
    if (!error) {
        if (state === 'enrollAccount') {
            // Client account successfully enrolled. Activate client
            Meteor.call('activateClient', Meteor.userId(), (error) => {
                if (error) {
                    console.error('Error calling \'activateClient\' remote method:', error);
                    AccountsTemplates.logout();
                }
            });
        }
    }
    else {
        // Error
        if (state === 'signIn') {
            // Make sure that login form is enabled
            AccountsTemplates.setDisabled(false);
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
