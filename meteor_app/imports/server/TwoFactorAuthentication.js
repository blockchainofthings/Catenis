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
import util from 'util';
// Third-party node modules
import config from 'config';
import otplib from 'otplib';
import moment from 'moment';
// Meteor packages
import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';
import { Accounts } from 'meteor/accounts-base';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { EmailNotify } from './EmailNotify';
import { Util } from './Util';

// Config entries
const twoFactAuthConfig = config.get('twoFactorAuthentication');
const twoFactAuthTokValWinConfig = twoFactAuthConfig.get('tokenValidationWindow');
const twoFactAuthRecovCodeConfig = twoFactAuthConfig.get('recoveryCode');
const twoFactAuthRecovCodeFrmtConfig = twoFactAuthRecovCodeConfig.get('format');
const twoFactAuthRecovCodeEmailConfig = twoFactAuthRecovCodeConfig.get('usageNotifyEmail');

// Configuration settings
const cfgSettings = {
    validationWindow: {
        previous: twoFactAuthTokValWinConfig.get('previous'),
        future: twoFactAuthTokValWinConfig.get('future')
    },
    userVerificationInterval: twoFactAuthConfig.get('userVerificationInterval'),
    recoveryCode: {
        codesToGenerate: twoFactAuthRecovCodeConfig.get('codesToGenerate'),
        length: twoFactAuthRecovCodeConfig.get('length'),
        format: {
            regexPattern: twoFactAuthRecovCodeFrmtConfig.get('regexPattern'),
            replaceStr: twoFactAuthRecovCodeFrmtConfig.get('replaceStr')
        },
        usageNotifyEmail: {
            fromAddress: twoFactAuthRecovCodeEmailConfig.get('fromAddress'),
            emailName: twoFactAuthRecovCodeEmailConfig.get('emailName')
        }
    }
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
                emails: 1,
                'services.twoFactorAuthentication': 1
            }
        });

        if (!docUser) {
            Catenis.logger.ERROR('TwoFactorAuthentication constructor called with an invalid user ID', {user_id: user_id});
            throw new Meteor.Error('2fa_invalid_user', 'TwoFactorAuthentication constructor called with an invalid user ID');
        }

        // Save user info
        this.user_id = user_id;
        this.userEmail = Util.getUserEmail(docUser);

        if (docUser.services && docUser.services.twoFactorAuthentication) {
            this.secretGenKey = docUser.services.twoFactorAuthentication.secretGenKey;
            this.userVerified = docUser.services.twoFactorAuthentication.userVerified;
            this.issuedDate = docUser.services.twoFactorAuthentication.issuedDate;

            if (docUser.services.twoFactorAuthentication.recoveryCode) {
                this.recoveryCodeGenKey = docUser.services.twoFactorAuthentication.recoveryCode.genKey;
                this.recoveryCodesCount = docUser.services.twoFactorAuthentication.recoveryCode.count;
                this.usedRecoveryCodeIndices = docUser.services.twoFactorAuthentication.recoveryCode.usedIndices;
            }
        }
    }

    get secret() {
        const secretGenKey = getSecretGenKey.call(this);

        // noinspection JSCheckFunctionSignatures
        return secretGenKey ? this.authenticator.encode(
            crypto.createHmac('sha512', secretGenKey)
            .update('And here it is: the two-factor authentication secret for user' + this.user_id)
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

    get recoveryCodes() {
        if (this.recoveryCodesCount) {
            const usedIndices = new Set(this.usedRecoveryCodeIndices);
            const codes = new Map();

            for (let index = 0; index < this.recoveryCodesCount; index ++) {
                if (!usedIndices.has(index)) {
                    codes.set(getRecoveryCode.call(this, index), index);
                }
            }

            return codes;
        }
    }

    isEnabled() {
        return !!this.userVerified;
    };

    isEnabledOrPending() {
        return !!(this.userVerified || getSecretGenKey.call(this));
    };

    enable(generateRecoveryCodes = true, recoveryCodesCount) {
        // Make sure that two-factor authentication is not yet enabled
        if (!this.isEnabled()) {
            setSecretGenKey.call(this);

            if (generateRecoveryCodes) {
                this.generateRecoveryCodes(recoveryCodesCount);
            }

            const secret = this.secret;

            return {
                secret: secret,
                authUri: this.authenticator.keyuri(this.userEmail, getServiceName(), secret)
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

    validateToken(token, checkRecoveryCode = true) {
        const secret = this.secret;

        if (secret) {
            try {
                let isTokenValid = this.authenticator.check(token, secret);

                if (isTokenValid) {
                    if (!this.userVerified) {
                        setSecretVerified.call(this);
                    }
                }
                else if(checkRecoveryCode) {
                    isTokenValid = this.validateRecoveryCode(token);

                    if (isTokenValid) {
                        this.sendRecoveryCodeUsedNotifyEmail();
                    }
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

    areRecoveryCodesGenerated() {
        return !!this.recoveryCodeGenKey;
    }

    generateRecoveryCodes(count) {
        // Make sure that two-factor authentication is has been enabled
        if (this.isEnabledOrPending()) {
            setRecoveryCodes.call(this, count);
        }
        else {
            // Error: two-factor authentication has not been enabled
            Catenis.logger.ERROR('Cannot generate recovery codes for user (user_id: %s); two-factor authentication has not been enabled', this.user_id);
            throw new Meteor.Error('2fa_not_been_enabled', 'Cannot generate recovery codes for user; two-factor authentication has not been enabled');
        }
    }

    clearRecoveryCodes() {
        // Make sure that recovery codes are currently generated
        if (this.areRecoveryCodesGenerated()) {
            unsetRecoveryCodes.call(this);
        }
        else {
            // Error: two-factor authentication recovery codes not currently generated
            Catenis.logger.ERROR('Cannot clear two-factor authentication recovery codes for user (user_id: %s); not currently generated', this.user_id);
            throw new Meteor.Error('2fa_recov_code_not_generated', 'Cannot clear two-factor authentication recovery codes for user; not currently generated');
        }
    }

    getRecoveryCodes() {
        const recoveryCodes = this.recoveryCodes;
        let unusedCodes;

        if (recoveryCodes && recoveryCodes.size > 0) {
            unusedCodes = Array.from(recoveryCodes.keys());
        }

        return unusedCodes;
    }

    validateRecoveryCode(code) {
        try {
            const recoveryCodes = this.recoveryCodes;
            let result = false;

            if (recoveryCodes) {
                const index = recoveryCodes.get(code);

                if (index !== undefined) {
                    setUsedRecoveryCode.call(this, index);

                    result = true;
                }
            }

            return result;
        }
        catch (error) {
            Catenis.logger.ERROR('Error validating two-factor authentication recovery code (%s) for user (user_id: %s).', code, this.user_id, error);
            throw new Meteor.Error('2fa_recov_code_validate_error', 'Error validating two-factor authentication recovery code for user');
        }
    }

    sendRecoveryCodeUsedNotifyEmail() {
        try {
            const email = new EmailNotify(cfgSettings.recoveryCode.usageNotifyEmail.emailName, cfgSettings.recoveryCode.usageNotifyEmail.fromAddress);

            const {token} = Accounts.generateResetToken(this.user_id, this.userEmail, 'resetPassword');
            const url = Accounts.urls.resetPassword(token);

            email.sendAsync(this.userEmail, null, {url: url}, (err) => {
                if (err) {
                    // Error sending notification e-mail. Just log error condition
                    Catenis.logger.ERROR('Error sending two-factor recovery code used notification e-mail.', err);
                }
            });
        }
        catch (err) {
            // Error preparing notification e-mail. Just log error condition
            Catenis.logger.ERROR('Error preparing two-factor recovery code used notification e-mail.', err);
        }
    }
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

function getRecoveryCode(index) {
    return this.recoveryCodeGenKey ? crypto.createHmac('sha512', this.recoveryCodeGenKey)
        .update(util.format('And here it is: the recovery code #%d for user %s', index + 1, this.user_id))
        .digest()
        .slice(0, Math.ceil(cfgSettings.recoveryCode.length / 2))
        .toString('hex')
        .substr(0, cfgSettings.recoveryCode.length)
        .replace(new RegExp(cfgSettings.recoveryCode.format.regexPattern), cfgSettings.recoveryCode.format.replaceStr)
        : undefined;
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
    this.recoveryCodeGenKey = undefined;
    this.recoveryCodesCount = undefined;
    this.usedRecoveryCodeIndices = undefined;
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
    this.recoveryCodeGenKey = undefined;
    this.recoveryCodesCount = undefined;
    this.usedRecoveryCodeIndices = undefined;

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

function setRecoveryCodes(count) {
    if (!this.secretGenKey) {
        // Error: No two-factor authentication secret to set recovery codes');
        throw new Error('No two-factor authentication secret to set recovery codes');
    }

    const recoveryCode = {
        genKey: newRecoveryCodeGenKey(),
        count: count || cfgSettings.recoveryCode.codesToGenerate,
        usedIndices: []
    };

    try {
        Meteor.users.update({
            _id: this.user_id
        }, {
            $set: {
                'services.twoFactorAuthentication.recoveryCode': recoveryCode
            }
        });
    }
    catch (err) {
        Catenis.logger.ERROR('Error setting two-factor authentication recovery codes for user (user_id: %s).', this.user_id, err);
        throw new Error('Error setting two-factor authentication recovery codes for user');
    }

    // Update info locally
    this.recoveryCodeGenKey = recoveryCode.genKey;
    this.recoveryCodesCount = recoveryCode.count;
    this.usedRecoveryCodeIndices = recoveryCode.usedIndices;

    // Emit event notifying that recovery codes have changed
    Catenis.twoFactorAuthEventEmitter.notifyRecoveryCodesChanged(this.user_id, this.getRecoveryCodes());
}

function unsetRecoveryCodes() {
    if (!this.recoveryCodeGenKey) {
        // Error: No recovery codes to the unset');
        throw new Error('No recovery codes to be unset');
    }

    try {
        Meteor.users.update({
            _id: this.user_id
        }, {
            $unset: {
                'services.twoFactorAuthentication.recoveryCode': true
            }
        });
    }
    catch (err) {
        Catenis.logger.ERROR('Error unsetting two-factor authentication recovery codes for user (user_id: %s).', this.user_id, err);
        throw new Error('Error unsetting two-factor authentication recovery codes for user');
    }

    // Update info locally
    this.recoveryCodeGenKey = undefined;
    this.recoveryCodesCount = undefined;
    this.usedRecoveryCodeIndices = undefined;

    // Emit event notifying that recovery codes have changed
    Catenis.twoFactorAuthEventEmitter.notifyRecoveryCodesChanged(this.user_id, this.getRecoveryCodes());
}

function setUsedRecoveryCode(index) {
    if (!this.recoveryCodesCount) {
        // Error: no recovery code to be set as used
        throw new Error('No recovery code to be set as used');
    }

    const usedIndices = Array.from(this.usedRecoveryCodeIndices);
    usedIndices.push(index);

    try {
        Meteor.users.update({
            _id: this.user_id
        }, {
            $set: {
                'services.twoFactorAuthentication.recoveryCode.usedIndices': usedIndices
            }
        });
    }
    catch (err) {
        Catenis.logger.ERROR('Error setting two-factor authentication recovery code (index: %d) for user (user_id: %s) as used.', index, this.user_id, err);
        throw new Error('Error setting two-factor authentication recovery code for user as used');
    }

    // Update info locally
    this.usedRecoveryCodeIndices = usedIndices;

    // Emit event notifying that recovery codes have changed
    Catenis.twoFactorAuthEventEmitter.notifyRecoveryCodesChanged(this.user_id, this.getRecoveryCodes());
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

function newRecoveryCodeGenKey() {
    return Random.secret();
}

function getServiceName() {
    let suffix;

    switch (Catenis.application.environment) {
        case 'sandbox':
            suffix = '_sandbox';
            break;

        case 'development':
            suffix = '_dev';
            break;

        case 'production':
        default:
            suffix = '';
            break;
    }

    return serviceName + suffix;
}

// Module code
//

// Lock function class
Object.freeze(TwoFactorAuthentication);
