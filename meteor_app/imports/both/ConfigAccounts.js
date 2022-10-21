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
import moment from 'moment-timezone';
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
    ambiguousErrorMessages: false
});

// Change accounts templates settings
const emailField = AccountsTemplates.removeField('email');
const pwdField = AccountsTemplates.removeField('password');

// Reset placeholder for e-mail field of signup form
if (typeof emailField.placeholder !== 'object') {
    emailField.placeholder = typeof emailField.placeholder === 'string' ? {
        default: emailField.placeholder
    } : {};
}
emailField.placeholder.signUp = 'Email *';

if (Meteor.isClient) {
    Meteor.startup(function () {
        // Hide password fields in signup form, and reset their placeholder text in enroll account form
        //  NOTE: we need to do it here (at meteor startup) because the password_again field
        //      is only added during the initialization of the accounts templates which takes
        //      place at meteor startup (on the client)
        const pwdField = AccountsTemplates.getField('password');
        const pwdAgainField = AccountsTemplates.getField('password_again');

        pwdField.visible = pwdField.visible.filter(v => v !== 'signUp');
        pwdAgainField.visible = pwdAgainField.visible.filter(v => v !== 'signUp');

        if (typeof pwdField.placeholder !== 'object') {
            pwdField.placeholder = typeof pwdField.placeholder === 'string' ? {
                default: pwdField.placeholder
            } : {};
        }
        pwdField.placeholder.enrollAccount = pwdField.placeholder.resetPwd;

        if (typeof pwdAgainField.placeholder !== 'object') {
            pwdAgainField.placeholder = typeof pwdAgainField.placeholder === 'string' ? {
                default: pwdAgainField.placeholder
            } : {};
        }
        pwdAgainField.placeholder.enrollAccount = pwdAgainField.placeholder.resetPwd;
    });
}

AccountsTemplates.addFields([
    {
        _id: 'first_name',
        type: 'text',
        displayName: 'First name',
        placeholder: 'First name',
        required: false,
    },
    {
        _id: 'last_name',
        type: 'text',
        displayName: 'Last name',
        placeholder: {
            signUp: 'Last name *'
        },
        required: true,
    },
    {
        _id: 'company',
        type: 'text',
        displayName: 'Company',
        required: false,
    },
    emailField,
    {
        _id: 'phone',
        type: 'text',
        displayName: 'Phone',
        placeholder: 'Phone',
        required: false,
        minLength: 3,
        maxLength: 24
    },
    pwdField,
    {
        _id: 'verify_code',
        type: 'text',
        displayName: 'Verification code',
        placeholder: 'Verification code',
        required: false,
        visible: ['signIn', 'resetPwd']
    },
    {
        _id: 'user_id',
        type: 'hidden',
        visible: ['signIn', 'resetPwd']
    },
    {
        _id: 'pwd_hash_json',
        type: 'hidden',
        visible: ['resetPwd']
    }
]);

AccountsTemplates.configure({
    loginFunc: twoFactorAuthLogin,
    resetPasswordFunc: twoFactorAuthResetPassword,

    defaultLayout: 'loginLayout',
    defaultLayoutRegions: {},
    defaultContentRegion: 'page',

    enablePasswordChange: true,
    focusFirstInput: true,
    forbidClientAccountCreation: false,
    overrideLoginErrors: true,
    enforceEmailVerification: true,
    sendVerificationEmail: false,
    confirmPassword: true,

    hideSignInLink: true,
    hideSignUpLink: true,
    showLabels: false,
    showForgotPasswordLink: true,
    showPlaceholders: true,

    onSubmitHook: onSubmitFunc,
    onLogoutHook: onLogout,
    preSignUpHook: onSignUp,
    postSignUpHook: onPostSignUp,

    texts: {
        title: {
            // Get rid of their titles
            signIn: '',
            forgotPwd: '',
            signUp: '',
            resendVerificationEmail: '',
            enrollAccount: '',
            resetPwd: ''
        },
        button: {
            changePwd: 'Change Password',
            enrollAccount: 'Set Password',
            forgotPwd: 'Send Email',
            resetPwd: 'Reset Password',
            signIn: 'Sign In',
            signUp: 'Create Account',
            resendVerificationEmail: 'Resend Verification Email'
        },
        info: {
            signUpVerifyEmail: 'Pending email verification. To complete the registration, please check your email and follow the instructions.',
            pwdSet: 'Password set'
        },
        errors: {
            loginForbidden: 'Something went wrong. Please check your credentials.'
        }
    }
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
AccountsTemplates.configureRoute('verifyEmail', {
    template: 'login',
    redirect: function () {
        redirectHome();
    }
});

// Set up 'signUp' route only if required
if (Meteor.settings.public.catenis && Meteor.settings.public.catenis.enableSelfRegistration) {
    // Set up a route for Sign-Up
    AccountsTemplates.configureRoute('signUp', {
        path: '/register',
        template: 'login',
        redirect: function () {
            redirectHome();
        }
    });

    // And also set up a route for Resend E-mail Verification
    AccountsTemplates.configureRoute('resendVerificationEmail', {
        path: '/verifyemail',
        template: 'login',
        redirect: function () {
            redirectHome();
        }
    });
}

let monitoringState = false;

function monitorState() {
    if (Meteor.isClient && !monitoringState) {
        Tracker.autorun(() => {
            const state = AccountsTemplates.getState();

            // Clear two-factor verification indication whenever state changes
            AccountsTemplates.state.form.set("2faVerify", false);

            if (state === 'signIn') {
                // Reset form
                const $emailField = $('#at-field-email');
                const $passwordField = $('#at-field-password');

                //$emailField.val('');
                $emailField.css('display', 'inline');
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

            $('#at-field-email').prop('disabled', disabled);
            $('#at-field-password').prop('disabled', disabled);

            monitoringDisabled = true;
        });
    }
}

function setUpTwoFactorAuthentication(userId) {
    // Morph form to enter two-factor authentication verification code

    // Hide email and password input fields, and show verification code input field
    $('#at-field-email').css('display', 'none');
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

class ProcReCaptchaCallback {
    constructor() {
        this.callbackByState = new Map();
    }

    get callback() {
        return this.callbackByState.get(AccountsTemplates.getState());
    }

    set callback(func) {
        this.callbackByState.set(AccountsTemplates.getState(), func);
    }
}

const procReCaptchaCb = new ProcReCaptchaCallback();

function processReCaptcha(callback) {
    // Save callback.
    //  NOTE: this should be used whenever retrieving the callback from a closure (inner
    //      callback), so the correct callback, according to the current AccountsTemplate
    //      sate, is executed
    procReCaptchaCb.callback = callback;

    function processReCaptchaResponse(token) {
        const atState = AccountsTemplates.getState();

        switch (atState) {
            case 'signIn': {
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
                            }
                            else {
                                // Unexpected login challenge type. Return error
                                (procReCaptchaCb.callback)(new Error('Unexpected login challenge type processing reCAPTCHA response: ' + challengeInfo.challengeType));
                            }

                            return;
                        }

                        // Pass back return from regular sign-in (with no two-factory authentication)
                        (procReCaptchaCb.callback)(null, error);
                    }
                });

                // Clear login credentials
                loginCredentials = undefined;

                break;
            }

            case 'signUp': {
                // Verify reCAPTCHA
                Meteor.call('verifyReCaptcha', token, (error, result) => {
                    if (error) {
                        // Return error
                        (procReCaptchaCb.callback)(new Error('Error calling \'verifyReCaptcha\' remote method: ' + error.toString()));
                    }
                    else {
                        // Pass back verification result
                        (procReCaptchaCb.callback)(null, result);
                    }
                });

                break;
            }

            default:
                // Return error
                callback(new Error('Unexpected AccountsTemplate state while processing reCAPTCHA response: ' + atState));
        }
    }

    function activateReCaptcha() {
        grecaptcha.execute().catch((err) => {
            // Return error
            (procReCaptchaCb.callback)(new Error('Error trying to execute reCAPTCHA: ' + err.toString()));
        });
    }

    function loadReCaptcha(siteKey) {
        // Render reCAPTCHA
        grecaptcha.render('ctn-login-recaptcha', {
            sitekey: siteKey,
            size: 'invisible',
            callback: processReCaptchaResponse
        });

        activateReCaptcha();
    }

    let reloadReCaptcha = false;

    try {
        grecaptcha.reset();
    }
    catch (err) {
        if ((err instanceof Error) && err.message === 'No reCAPTCHA clients exist.') {
            reloadReCaptcha = true;
        }
        else {
            // Return error
            callback(new Error('Error resetting reCAPTCHA: ' + err.toString()));
            return;
        }
    }

    if (reloadReCaptcha) {
        if (!AccountsTemplates.state.form.get('reCaptchaSiteKey')) {
            // Retrieve reCAPTCHA site key
            Meteor.call('getReCaptchaSiteKey', (error, siteKey) => {
                if (error) {
                    // Return error
                    (procReCaptchaCb.callback)(new Error('Error calling \'getReCaptchaSiteKey\' remote method: ' + error.toString()));
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

function twoFactorAuthLogin(user, password, formData) {
    monitorState();
    monitorDisabled();

    if (!formData.user_id) {
        // User logging in. Disable form
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

                    processReCaptcha((error, result) => {
                        if (error) {
                            console.error(error);
                            AccountsTemplates.submitCallback(new Meteor.Error(403, 'End user not successfully verified. Form submission blocked.'), 'signIn');
                        }
                        else {
                            AccountsTemplates.submitCallback(result, 'signIn');
                        }
                    });
                }
                else if (challengeInfo.challengeType === LoginChallenge.type.twoFAuth) {
                    // Challenge user with two-factor authentication
                    setUpTwoFactorAuthentication(challengeInfo.userId);
                }

                return;
            }

            // Process return from regular sign-in (with no user challenge)
            AccountsTemplates.submitCallback(error, 'signIn');
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
                AccountsTemplates.submitCallback(error, 'signIn');
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
//                      'resetPwd', 'signIn', 'signUp', 'verifyEmail', 'resendVerificationEmail'
function onSubmitFunc(error, state) {
    //runs on successful at-pwd-form submit. Use this to allow for client activation and banning disabled users
    if (!error) {
        if (state === 'signUp') {
            // New user account has just been created. Finalize account registration
            let user_email = $('#at-field-email').val();

            if (AccountsTemplates.options.lowercaseUsername) {
                user_email = toLowercaseUsername(user_email);
            }

            // Save e-mail of newly created user account
            AccountsTemplates.state.form.set('new_user_email', user_email);

            Meteor.call('finalizeAccountRegistration', user_email, (error) => {
                if (error) {
                    console.error('Error calling \'finalizeAccountRegistration\' remote method:', error);
                }
            });

            AccountsTemplates.state.form.set("result", 'An email with instructions to complete the account registration has just been sent. Please check your inbox.');

            // Indicate that account registration enrollment e-mail has been sent
            AccountsTemplates.state.form.set("accRegEmailSent", true);

            // Make sure that registration form is disabled
            AccountsTemplates.setDisabled(true);

            // Enable form fields
            checkDisableFields(false);

            // Redirect to an external landing page if defined
            getSelfRegistrationSettings((err, selfRegistration) => {
                if (err) {
                    console.error('Error retrieving self-registration settings:', err);
                }
                else if (selfRegistration.landingPage) {
                    document.location = selfRegistration.landingPage;
                }
            });
        }
        else if (state === 'enrollAccount') {
            // User account successfully enrolled
            const user = Meteor.user({fields: {_id: 1, 'profile.last_name': 1}});

            if (user.profile && ('last_name' in user.profile)) {
                // Newly registered account. Create Catenis client account
                Meteor.call('createNewClientForUser', user._id, (error) => {
                    if (error) {
                        console.error('Error calling \'createNewClientForUser\' remote method:', error);
                    }
                });
            }
            else {
                // Catenis client account already exists. Just activate it
                Meteor.call('activateClient', user._id, (error) => {
                    if (error) {
                        console.error('Error calling \'activateClient\' remote method:', error);
                        AccountsTemplates.logout();
                    }
                });
            }
        }
    }
    else {
        // Error
        state = state || AccountsTemplates.getState();

        if (state === 'signIn') {
            // Make sure that login form is enabled
            AccountsTemplates.setDisabled(false);
        }
        else if (state === 'signUp') {
            // Enable form fields
            checkDisableFields(false);
        }
    }
}

export function redirectHome() {
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

function checkDisableFields(disable) {
    const state = AccountsTemplates.getState();

    for (const field of AccountsTemplates.getFields()) {
        if (field.visible.includes(state)) {
            $('#at-field-' + field._id).prop('disabled', disable);
        }
    }
}

function getSelfRegistrationSettings(callback) {
    let savedSelfRegistration = AccountsTemplates.state.form.get('selfRegistration');

    if (!savedSelfRegistration) {
        // Retrieve self-registration settings
        Meteor.call('getSelfRegistrationSettings', (error, selfRegistration) => {
            if (error) {
                callback(new Error('Error calling \'getSelfRegistrationSettings\' remote method: ' + error));
            }
            else {
                // Save self-registration settings
                AccountsTemplates.state.form.set('selfRegistration', selfRegistration);
                callback(null, selfRegistration);
            }
        });
    }
    else {
        callback(null, savedSelfRegistration);
    }
}

function onSignUp(password, options, callback) {
    // Add local time zone to options.
    //  NOTE: we do it right now to avoid doing it in a closure (inner callback) and
    //      incorrectly adding it to the wrong options object
    options.time_zone = moment.tz.guess();

    // Make sure that account registration is enabled
    getSelfRegistrationSettings((err, selfRegistration) => {
        if (err) {
            console.error('Error retrieving self-registration settings:', err);

            // Pass error back
            callback(new Meteor.Error(403, 'Something went wrong. Account registration cannot be enabled.'));
        }
        else if (selfRegistration.enabled) {
            // Account registration enabled. Proceed with regular processing...

            // Disable form fields
            checkDisableFields(true);

            // Check if using reCAPTCHA
            Meteor.call('useReCaptchaForLogin', (error, useReCaptcha) => {
                if (error) {
                    console.log('Error calling \'useReCaptchaForLogin\' remote method: ' + error);

                    // Pass error back
                    callback(new Meteor.Error(403, 'Something went wrong. Form submission blocked.'));
                }
                else if (useReCaptcha) {
                    // reCAPTCHA is in use
                    processReCaptcha((error, result) => {
                        if (error || !result.success) {
                            // Error while processing reCAPTCHA or user not successfully verified
                            if (error) {
                                console.error(error);
                            }

                            // Pass error back
                            callback(new Meteor.Error(403, 'End user not successfully verified. Form submission blocked.'));
                        }
                        else {
                            // User successfully verified. Pass back success condition
                            callback(null);
                        }
                    });
                }
                else {
                    // reCAPTCHA not in use. Just pass back success condition
                    callback(null);
                }
            });
        }
        else {
            // Pass error back
            callback(new Meteor.Error(403, 'Account registration is not enabled.'));
        }
    });
}

function toLowercaseUsername(value){
    return value.toLowerCase().replace(/\s+/gm, '');
}

/**
 * Note: this function runs on the SERVER
 * @param userId
 * @param info
 */
function onPostSignUp(userId, info) {
    if (Meteor.isServer) {
        import('../server/AccountRegistration.js')
        .then(({AccountRegistration}) => AccountRegistration.setSelfRegisteredUser(userId));
    }
}