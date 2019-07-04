/**
 * Created by Claudio on 2019-06-28.
 */

//console.log('[TwoFactorAuthEventEmitter.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import events from 'events';
// Third-party node modules
//import config from 'config';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';


// Definition of function classes
//

// TwoFactorAuthEventEmitter function class
export class TwoFactorAuthEventEmitter extends events.EventEmitter {
    constructor() {
        super();
    }

    notifyEnableStateChanged(user_id, isEnabled) {
        this.emit(TwoFactorAuthEventEmitter.notifyEvent.enable_state_changed.name, {
            user_id: user_id,
            isEnabled: isEnabled
        });
    }
}


// Module functions used to simulate private TwoFactorAuthEventEmitter object methods
//  NOTE: these functions need to be bound to a TwoFactorAuthEventEmitter object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// TwoFactorAuthEventEmitter function class (public) methods
//

TwoFactorAuthEventEmitter.initialize = function () {
    Catenis.logger.TRACE('TwoFactorAuthEventEmitter initialization');
    Catenis.twoFactorAuthEventEmitter = new TwoFactorAuthEventEmitter();
};


// TwoFactorAuthEventEmitter function class (public) properties
//

TwoFactorAuthEventEmitter.notifyEvent = Object.freeze({
    enable_state_changed: Object.freeze({
        name: 'enable_state_changed',
        description: 'Two-factor authentication enable state has changed for a user'
    })
});


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(TwoFactorAuthEventEmitter);
