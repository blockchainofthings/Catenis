/**
 * Created by claudio on 2019-06-27.
 */

//console.log('[TwoFactorAuthentication.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import crypto from 'crypto';
// Third-party node modules
import config from 'config';
import otplib from 'otplib';
import moment from 'moment';
// Meteor packages
import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';


// Config entries
const twoFactAuthConfig = config.get('twoFactorAuthentication');
const twoFactAuthTokValWinConfig = twoFactAuthConfig.get('tokenValidationWindow');

// Configuration settings
const cfgSettings = {
    validationWindow: {
        previous: twoFactAuthTokValWinConfig.get('previous'),
        future: twoFactAuthTokValWinConfig.get('future')
    },
    userVerificationInterval: twoFactAuthConfig.get('userVerificationInterval')
};

const secretLength = 20;
const serviceName = 'Catenis';


// Definition of classes
//

// TwoFactorAuthentication class
export class TwoFactorAuthentication {
    constructor(user_id) {
        // Make sure that it is a valid user ID
        const docUser = Meteor.users.findOne({
            _id: user_id
        }, {
            fields: {
                _id: 1,
                username: 1,
                'services.twoFactorAuthentication': 1
            }
        });

        if (!docUser) {
            Catenis.logger.ERROR('TwoFactorAuthentication constructor called with an invalid user ID', {user_id: user_id});
            throw new Meteor.Error('2fa_invalid_user', 'TwoFactorAuthentication constructor called with an invalid user ID');
        }

        // Save user info
        this.user_id = user_id;
        this.username = docUser.username;

        if (docUser.services && docUser.services.twoFactorAuthentication) {
            this.secretGenKey = docUser.services.twoFactorAuthentication.secretGenKey;
            this.userVerified = docUser.services.twoFactorAuthentication.userVerified;
            this.issuedDate = docUser.services.twoFactorAuthentication.issuedDate;
        }
    }

    get secret() {
        const secretGenKey = getSecretGenKey.call(this);

        // noinspection JSCheckFunctionSignatures
        return secretGenKey ? this.authenticator.encode(
            crypto.createHmac('sha512', secretGenKey)
            .update('And here it is: the two-factor authentication secret for user' + this.username)
            .digest()
            .slice(0, secretLength)
        ) : undefined;
    }

    get authenticator() {
        if (this._authenticator) {
            return this._authenticator;
        }
        else {
            this._authenticator = new otplib.authenticator.Authenticator();
            this._authenticator.options = {
                crypto: crypto,
                window: [
                    cfgSettings.validationWindow.previous,
                    cfgSettings.validationWindow.future
                ]
            };

            return this._authenticator;
        }
    }

    isEnabled() {
        return !!this.userVerified;
    };

    enable() {
        // Make sure that two-factor authentication is not yet enabled
        if (!this.isEnabled()) {
            setSecretGenKey.call(this);

            const secret = this.secret;

            return {
                secret: secret,
                authUri: this.authenticator.keyuri(this.username, serviceName, secret)
            };
        }
        else {
            // Error: two-factor authentication already enabled
            Catenis.logger.ERROR('Cannot enable two-factor authentication for user (user_id: %s); already enabled', this.user_id);
            throw new Meteor.Error('2fa_already_enabled', 'Cannot enable two-factor authentication for user; already enabled');
        }
    };

    disable() {
        // Make sure that two-factor authentication is already enabled
        if (this.isEnabled()) {
            unsetSecretGenKey.call(this);
        }
        else {
            // Error: two-factor authentication not yet enabled
            Catenis.logger.ERROR('Cannot disable two-factor authentication for user (user_id: %s); not yet enabled', this.user_id);
            throw new Meteor.Error('2fa_not_enabled', 'Cannot disable two-factor authentication for user; not yet enabled');
        }
    };

    validateToken(token) {
        const secret = this.secret;

        if (secret) {
            try {
                const isTokenValid = this.authenticator.check(token, secret);

                if (isTokenValid && !this.userVerified) {
                    setSecretVerified.call(this);
                }

                return isTokenValid;
            }
            catch (error) {
                Catenis.logger.ERROR('Error validating two-factor authentication token for user (user_id: %s).', this.user_id, error);
                throw new Meteor.Error('2fa_validate_error', 'Error validating two-factor authentication token for user');
            }
        }
        else {
            // Error: no two-factor authentication secret to validate token
            Catenis.logger.ERROR('Cannot validate two-factor authentication token; secret not yet defined for user (user_id: %s)', this.user_id);
            throw new Meteor.Error('2fa_no_secret', 'Cannot validate two-factor authentication token; secret not yet defined for user');
        }
    };
}


// Module functions used to simulate private TwoFactorAuthentication object methods
//  NOTE: these functions need to be bound to a TwoFactorAuthentication object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

function getSecretGenKey() {
    // If secret not yet verified by user, check if its generation key is
    //  still within the acceptable bounds
    return this.secretGenKey && (this.userVerified || moment().diff(this.issuedDate, 'seconds')
        <= cfgSettings.userVerificationInterval) ? this.secretGenKey : undefined;
}

function setSecretGenKey() {
    if (this.userVerified) {
        // Error: two-factor authentication secret cannot be reset
        throw new Error('Two-factor authentication secret cannot be reset');
    }

    const twoFactorAuthentication = {
        secretGenKey: newSecretGenKey(),
        userVerified: false,
        issuedDate: new Date()
    };

    try {
        Meteor.users.update({
            _id: this.user_id
        }, {
            $set: {
                'services.twoFactorAuthentication': twoFactorAuthentication
            }
        });
    }
    catch (err) {
        Catenis.logger.ERROR('Error setting two-factor authentication secret for user (user_id: %s).', this.user_id, err);
        throw new Error('Error setting two-factor authentication secret for user');
    }

    // Update info locally
    this.secretGenKey = twoFactorAuthentication.secretGenKey;
    this.userVerified = twoFactorAuthentication.userVerified;
    this.issuedDate = twoFactorAuthentication.issuedDate;
}

function unsetSecretGenKey() {
    if (!this.userVerified) {
        // Error: no two-factor authentication secret to unset
        throw new Error('No two-factor authentication secret to be unset');
    }

    try {
        Meteor.users.update({
            _id: this.user_id
        }, {
            $unset: {
                'services.twoFactorAuthentication': true
            }
        });
    }
    catch (err) {
        Catenis.logger.ERROR('Error unsetting two-factor authentication secret for user (user_id: %s).', this.user_id, err);
        throw new Error('Error unsetting two-factor authentication secret for user');
    }

    // Update info locally
    this.secretGenKey = undefined;
    this.userVerified = undefined;
    this.issuedDate = undefined;

    // Emit event notifying that enable state has changed
    Catenis.twoFactorAuthEventEmitter.notifyEnableStateChanged(this.user_id, this.isEnabled());
}

function setSecretVerified() {
    if (!this.secretGenKey || this.userVerified) {
        // Error: no secret to be verified or already verified
        throw new Error('No two-factor authentication secret to be verified or already verified');
    }

    try {
        Meteor.users.update({
            _id: this.user_id
        }, {
            $set: {
                'services.twoFactorAuthentication.userVerified': true
            }
        });
    }
    catch (err) {
        Catenis.logger.ERROR('Error setting two-factor authentication secret as verified by user (user_id: %s).', this.user_id, err);
        throw new Error('Error setting two-factor authentication secret as verified by user');
    }

    // Update info locally
    this.userVerified = true;

    // Emit event notifying that enable state has changed
    Catenis.twoFactorAuthEventEmitter.notifyEnableStateChanged(this.user_id, this.isEnabled());
}


// TwoFactorAuthentication class (public) methods
//

/*TwoFactorAuthentication.class_func = function () {
};*/


// TwoFactorAuthentication class (public) properties
//

//TwoFactorAuthentication.prop = {};


// Definition of module (private) functions
//

function newSecretGenKey() {
    return Random.secret();
}


// Module code
//

// Lock function class
Object.freeze(TwoFactorAuthentication);
