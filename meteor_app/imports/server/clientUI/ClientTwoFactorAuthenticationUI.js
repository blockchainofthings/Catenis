/**
 * Created by Claudio on 2019-07-03.
 */

//console.log('[ClientTwoFactorAuthenticationUI.js]: This code just ran.');

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
import { Roles } from 'meteor/alanning:roles';

// References code in other (Catenis) modules
import { Catenis } from '../Catenis';
import { CommonTwoFactorAuthenticationUI } from '../commonUI/CommonTwoFactorAuthenticationUI';


// Definition of function classes
//

// ClientTwoFactorAuthenticationUI function class
export function ClientTwoFactorAuthenticationUI() {
}


// Public ClientTwoFactorAuthenticationUI object methods
//

/*ClientTwoFactorAuthenticationUI.prototype.pub_func = function () {
};*/


// Module functions used to simulate private ClientTwoFactorAuthenticationUI object methods
//  NOTE: these functions need to be bound to a ClientTwoFactorAuthenticationUI object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// ClientTwoFactorAuthenticationUI function class (public) methods
//

ClientTwoFactorAuthenticationUI.initialize = function () {
    Catenis.logger.TRACE('ClientTwoFactorAuthenticationUI initialization');
    // Declaration of RPC methods to be called from client
    Meteor.methods({
        enable2FAClient: function () {
            if (Roles.userIsInRole(this.userId, 'ctn-client')) {
                try {
                    return CommonTwoFactorAuthenticationUI.enable2FA.call(this);
                }
                catch (err) {
                    // Error trying to enable two-factor authentication. Log error and throw exception
                    Catenis.logger.ERROR('Failure trying to enable two-factor authentication.', err);
                    throw new Meteor.Error('2fa.enable.failure', 'Failure trying to enable two-factor authentication');
                }
            }
            else {
                // User not logged in or not a Catenis client.
                //  Throw exception
                throw new Meteor.Error('ctn_client_no_permission', 'No permission; must be logged in as a Catenis client to perform this task');
            }
        },
        disable2FAClient: function () {
            if (Roles.userIsInRole(this.userId, 'ctn-client')) {
                try {
                    CommonTwoFactorAuthenticationUI.disable2FA.call(this);
                }
                catch (err) {
                    // Error trying to disable two-factor authentication. Log error and throw exception
                    Catenis.logger.ERROR('Failure trying to disable two-factor authentication.', err);
                    throw new Meteor.Error('2fa.disable.failure', 'Failure trying to disable two-factor authentication');
                }
            }
            else {
                // User not logged in or not a Catenis client.
                //  Throw exception
                throw new Meteor.Error('ctn_client_no_permission', 'No permission; must be logged in as a Catenis client to perform this task');
            }
        },
        validate2FATokenClient: function (token) {
            if (Roles.userIsInRole(this.userId, 'ctn-client')) {
                try {
                    return CommonTwoFactorAuthenticationUI.validate2FAToken.call(this, token);
                }
                catch (err) {
                    // Error trying to validate two-factor authentication code. Log error and throw exception
                    Catenis.logger.ERROR('Failure trying to validate two-factor authentication code.', err);
                    throw new Meteor.Error('2fa.disable.failure', 'Failure trying to validate two-factor authentication code');
                }
            }
            else {
                // User not logged in or not a Catenis client.
                //  Throw exception
                throw new Meteor.Error('ctn_client_no_permission', 'No permission; must be logged in as a Catenis client to perform this task');
            }
        },
        generateRecoveryCodesClient: function () {
            if (Roles.userIsInRole(this.userId, 'ctn-client')) {
                try {
                    return CommonTwoFactorAuthenticationUI.generateRecoveryCodes.call(this);
                }
                catch (err) {
                    // Error trying to generate two-factor authentication recovery codes. Log error and throw exception
                    Catenis.logger.ERROR('Failure trying to generate two-factor authentication recovery codes.', err);
                    throw new Meteor.Error('2fa.gen.recov.codes.failure', 'Failure trying to generate two-factor authentication recovery codes');
                }
            }
            else {
                // User not logged in or not a Catenis client.
                //  Throw exception
                throw new Meteor.Error('ctn_client_no_permission', 'No permission; must be logged in as a Catenis client to perform this task');
            }
        }
    });

    // Declaration of publications
    Meteor.publish('clientTwoFactorAuthentication', function () {
        if (Roles.userIsInRole(this.userId, 'ctn-client')) {
            CommonTwoFactorAuthenticationUI.twoFactorAuthentication.call(this);
        }
        else {
            // User not logged in or not a Catenis client.
            //  Make sure that publication is not started and throw exception
            this.stop();
            throw new Meteor.Error('ctn_client_no_permission', 'No permission; must be logged in as a Catenis client to perform this task');
        }
    });
};


// ClientTwoFactorAuthenticationUI function class (public) properties
//

/*ClientTwoFactorAuthenticationUI.prop = {};*/


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(ClientTwoFactorAuthenticationUI);
