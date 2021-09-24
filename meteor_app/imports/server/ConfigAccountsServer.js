/**
 * Created by claudio on 2019-07-03.
 */

//console.log('[ConfigAccountsServer.js]: This code just ran.');

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
import { DDP } from 'meteor/ddp-client'

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { TwoFactorAuthentication } from './TwoFactorAuthentication';
import { LoginChallenge } from '../both/LoginChallenge';


// Definition of module (private) functions
//

function throwLoginError(msg) {
    msg = msg || 'Something went wrong. Please check your credentials.';

    throw new Meteor.Error(403, msg);
}

function checkUserCredentials(userId, psw) {
    const user = Meteor.users.findOne(userId);

    if (!user) {
        throwLoginError();
    }

    if (!user.services || !user.services.password || !user.services.password.bcrypt) {
        throwLoginError();
    }

    if (Accounts._checkPassword(user, psw).error) {
        throwLoginError();
    }
}


// Module code
//

Accounts.validateLoginAttempt((attempt) => {
    if (attempt.type === 'password') {
        let challengeUser = false;
        let challengeType;
        let userId;

        // If processing login (not password reset), check if user should be
        //  challenged with reCAPTCHA
        if (attempt.methodName === 'login' && Catenis.reCaptcha.useForLogin) {
            challengeUser = true;
            challengeType = LoginChallenge.type.reCaptcha;
        }

        if (attempt.allowed) {
            // Save ID of user trying to log in
            userId = attempt.user._id;

            if (!challengeUser) {
                // Check if two-factor authentication is enabled for user
                const twoFA = new TwoFactorAuthentication(userId);

                if (twoFA.isEnabled()) {
                    // Two-factor authentication is enabled. Indicate that user should be challenged
                    //  with two-factor authentication
                    challengeUser = true;
                    challengeType = LoginChallenge.type.twoFAuth;
                }
            }
        }

        if (challengeUser) {
            throw new Meteor.Error('challenge-user', 'User should be challenged before login is granted',
                JSON.stringify({
                    challengeType,
                    userId
                })
            );
        }
    }
    else if (attempt.type === 're-captcha') {
        if (attempt.allowed) {
            // Save ID of user trying to log in
            let userId = attempt.user._id;

            // Check if two-factor authentication is enabled for user
            const twoFA = new TwoFactorAuthentication(userId);

            if (twoFA.isEnabled()) {
                // Two-factor authentication is enabled. Indicate that user should be challenged
                //  with two-factor authentication
                throw new Meteor.Error('challenge-user', 'User should be challenged before login is granted',
                    JSON.stringify({
                        challengeType: LoginChallenge.type.twoFAuth,
                        userId
                    })
                );
            }
        }
    }

    return true;
});

// Register custom login method to handle Google reCAPTCHA
Accounts.registerLoginHandler('re-captcha', (options) => {
    if (!options.reCaptchaToken) {
        return undefined;
    }

    // Try to retrieve client IP address
    const currentMethodInvocation = DDP._CurrentMethodInvocation.get();
    let clientIP;

    if (currentMethodInvocation) {
        clientIP = currentMethodInvocation.connection.clientAddress;
    }

    // Verify reCAPTCHA response
    let result;
    let error;

    try {
        result = Catenis.reCaptcha.verify(options.reCaptchaToken, clientIP);
    }
    catch (err) {
        error = err;
    }

    if (error || !result.success) {
        // Failed to verify reCAPTCHA response
        throwLoginError();
    }

    if (options.userId) {
        checkUserCredentials(options.userId, options.pswHash);

        return { userId: options.userId };
    }
    else {
        throwLoginError();
    }
});

// Register custom login method to handle two-factor authentication
Accounts.registerLoginHandler('two-factor-auth', (options) => {
    if (!options.twoFAVerifyCode) {
        return undefined;
    }

    checkUserCredentials(options.userId, options.pswHash);

    // Check if two-factor authentication is enabled for user
    const twoFA = new TwoFactorAuthentication(options.userId);

    if (twoFA.isEnabled() && !twoFA.validateToken(options.twoFAVerifyCode)) {
        // Invalid two-factor authentication code
        throwLoginError('Invalid code. Please try again.');
    }

    return { userId: options.userId };
});
