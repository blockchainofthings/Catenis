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
import { TwoFactorAuthentication } from '../server/TwoFactorAuthentication';

// Module code
//

Accounts.validateLoginAttempt((attempt) => {
    if (attempt.type === 'password' && attempt.allowed) {
        // Check if two-factor authentication is enabled for user
        const _2fa = new TwoFactorAuthentication(attempt.user._id);

        if (_2fa.isEnabled()) {
            // Two-factor authentication is enabled. Indicate that verification
            //  code is required
            throw new Meteor.Error('verify-code-required');
        }
    }

    return true;
});

const handleError = (msg) => {
    msg = msg || 'Something went wrong. Please check your credentials.';

    throw new Meteor.Error(403, msg);
};

// Register custom login method to handle two-factor authentication
Accounts.registerLoginHandler('two-factor-auth', (options) => {
    if (!options.twoFactorAuthPassword || !options.verifyCode) {
        return undefined;
    }

    let user;

    if (typeof options.user === 'object' && options.user !== null) {
        if (options.user.username) {
            user = Accounts.findUserByUsername(options.user.username);
        }
        else if (options.user.email) {
            user = Accounts.findUserByEmail(options.user.email);
        }
    }
    else {
        return undefined;
    }

    if (!user) {
        handleError();
    }

    if (!user.services || !user.services.password || !user.services.password.bcrypt) {
        return handleError();
    }

    if (Accounts._checkPassword(user, options.twoFactorAuthPassword).error) {
        return handleError();
    }

    // Check if two-factor authentication is enabled for user
    const _2fa = new TwoFactorAuthentication(user._id);

    if (_2fa.isEnabled() && !_2fa.validateToken(options.verifyCode)) {
        return handleError('Invalid code. Please try again.');
    }

    return { userId: user._id };
});
