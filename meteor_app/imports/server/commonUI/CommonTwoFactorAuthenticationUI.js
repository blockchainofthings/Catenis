/**
 * Created by claudio on 2019-06-28.
 */

//console.log('[CommonTwoFactorAuthenticationUI.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
//import config from 'config';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from '../Catenis';
import { TwoFactorAuthentication } from '../TwoFactorAuthentication';
import { TwoFactorAuthEventEmitter } from '../TwoFactorAuthEventEmitter';


// Definition of function classes
//

// CommonTwoFactorAuthenticationUI function class
export function CommonTwoFactorAuthenticationUI() {
}


// Public CommonTwoFactorAuthenticationUI object methods
//

/*CommonTwoFactorAuthenticationUI.prototype.pub_func = function () {
};*/


// Module functions used to simulate private CommonTwoFactorAuthenticationUI object methods
//  NOTE: these functions need to be bound to a CommonTwoFactorAuthenticationUI object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// CommonTwoFactorAuthenticationUI function class (public) methods
//

// Remote method auxiliary method
//
//  NOTE: this method should be called via the predefined function method .call() passing the context (this)
//      of the caller remote method function (i.e. method.call(this, ...))
CommonTwoFactorAuthenticationUI.enable2FA = function () {
    const _2fa = new TwoFactorAuthentication(this.userId);

    if (!_2fa.isEnabled()) {
        return _2fa.enable();
    }
};

// Remote method auxiliary method
//
//  NOTE: this method should be called via the predefined function method .call() passing the context (this)
//      of the caller remote method function (i.e. method.call(this, ...))
CommonTwoFactorAuthenticationUI.disable2FA = function () {
    const _2fa = new TwoFactorAuthentication(this.userId);

    if (_2fa.isEnabled()) {
        _2fa.disable();
    }
};

// Remote method auxiliary method
//
//  NOTE: this method should be called via the predefined function method .call() passing the context (this)
//      of the caller remote method function (i.e. method.call(this, ...))
CommonTwoFactorAuthenticationUI.validate2FAToken = function (token) {
    const _2fa = new TwoFactorAuthentication(this.userId);

    return _2fa.validateToken(token);
};

// Publication auxiliary method
//
//  NOTE: this method should be called via the predefined function method .call() passing the context (this)
//      of the caller publication function (i.e. method.call(this, ...))
CommonTwoFactorAuthenticationUI.twoFactorAuthentication = function () {
    const processEnableStateChanged = (data) => {
        // Make sure that it refers to the current user
        if (data.user_id === this.userId) {
            // Update two-factor authentication enable state
            this.changed('TwoFactorAuthInfo', 1, {
                isEnabled: data.isEnabled
            });
        }
    };

    // Prepare to receive notification of two-factor authentication enable state change
    Catenis.twoFactorAuthEventEmitter.on(TwoFactorAuthEventEmitter.notifyEvent.enable_state_changed.name, processEnableStateChanged);

    // Get and pass current two-factor authentication info
    const _2fa = new TwoFactorAuthentication(this.userId);

    this.added('TwoFactorAuthInfo', 1, {
        isEnabled: _2fa.isEnabled()
    });
    this.ready();

    this.onStop(() => Catenis.twoFactorAuthEventEmitter.removeListener(TwoFactorAuthEventEmitter.notifyEvent.enable_state_changed.name, processEnableStateChanged));
};


// CommonTwoFactorAuthenticationUI function class (public) properties
//

/*CommonTwoFactorAuthenticationUI.prop = {};*/


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(CommonTwoFactorAuthenticationUI);
