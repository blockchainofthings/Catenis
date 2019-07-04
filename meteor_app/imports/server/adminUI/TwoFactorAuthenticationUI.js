/**
 * Created by Claudio on 2019-06-28.
 */

//console.log('[TwoFactorAuthenticationUI.js]: This code just ran.');

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

// TwoFactorAuthenticationUI function class
export function TwoFactorAuthenticationUI() {
}


// Public TwoFactorAuthenticationUI object methods
//

/*TwoFactorAuthenticationUI.prototype.pub_func = function () {
};*/


// Module functions used to simulate private TwoFactorAuthenticationUI object methods
//  NOTE: these functions need to be bound to a TwoFactorAuthenticationUI object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// TwoFactorAuthenticationUI function class (public) methods
//

TwoFactorAuthenticationUI.initialize = function () {
    Catenis.logger.TRACE('TwoFactorAuthenticationUI initialization');
    // Declaration of RPC methods to be called from client
    Meteor.methods({
        enable2FA: function () {
            if (Roles.userIsInRole(this.userId, 'sys-admin')) {
                try {
                    return CommonTwoFactorAuthenticationUI.enable2FA.call(this);
                }
                catch (err) {
                    // Error trying to enable two-factor authentication. Log error and throw exception
                    Catenis.logger.ERROR('Failure trying to enable two-factor authentication.', err);
                    throw new Meteor.Error('2fa.enable.failure', 'Failure trying to enable two-factor authentication: ' + err.toString());
                }
            }
            else {
                // User not logged in or not a system administrator.
                //  Throw exception
                throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
            }
        },
        disable2FA: function () {
            if (Roles.userIsInRole(this.userId, 'sys-admin')) {
                try {
                    CommonTwoFactorAuthenticationUI.disable2FA.call(this);
                }
                catch (err) {
                    // Error trying to disable two-factor authentication. Log error and throw exception
                    Catenis.logger.ERROR('Failure trying to disable two-factor authentication.', err);
                    throw new Meteor.Error('2fa.disable.failure', 'Failure trying to disable two-factor authentication: ' + err.toString());
                }
            }
            else {
                // User not logged in or not a system administrator.
                //  Throw exception
                throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
            }
        },
        validate2FAToken: function (token) {
            if (Roles.userIsInRole(this.userId, 'sys-admin')) {
                try {
                    return CommonTwoFactorAuthenticationUI.validate2FAToken.call(this, token);
                }
                catch (err) {
                    // Error trying to validate two-factor authentication code. Log error and throw exception
                    Catenis.logger.ERROR('Failure trying to validate two-factor authentication code.', err);
                    throw new Meteor.Error('2fa.disable.failure', 'Failure trying to validate two-factor authentication code: ' + err.toString());
                }
            }
            else {
                // User not logged in or not a system administrator.
                //  Throw exception
                throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
            }
        }
    });

    // Declaration of publications
    Meteor.publish('twoFactorAuthentication', function () {
        if (Roles.userIsInRole(this.userId, 'sys-admin')) {
            CommonTwoFactorAuthenticationUI.twoFactorAuthentication.call(this);
        }
        else {
            // User not logged in or not a system administrator.
            //  Make sure that publication is not started and throw exception
            this.stop();
            throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
        }
    });
};


// TwoFactorAuthenticationUI function class (public) properties
//

/*TwoFactorAuthenticationUI.prop = {};*/


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(TwoFactorAuthenticationUI);
