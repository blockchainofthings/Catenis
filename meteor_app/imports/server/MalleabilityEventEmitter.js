/**
 * Created by claudio on 12/10/17.
 */

//console.log('[MalleabilityEventEmitter.js]: This code just ran.');

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

// MalleabilityEventEmitter function class
export class MalleabilityEventEmitter extends events.EventEmitter {
    constructor() {
        super();
    }
}


// Public MalleabilityEventEmitter object methods
//

MalleabilityEventEmitter.prototype.notifyTxidChanged = function (originalTxid, modifiedTxid) {
    this.emit(MalleabilityEventEmitter.notifyEvent.name, {
        originalTxid: originalTxid,
        modifiedTxid: modifiedTxid
    });
};


// Module functions used to simulate private MalleabilityEventEmitter object methods
//  NOTE: these functions need to be bound to a MalleabilityEventEmitter object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// MalleabilityEventEmitter function class (public) methods
//

MalleabilityEventEmitter.initialize = function () {
    Catenis.logger.TRACE('MalleabilityEventEmitter initialization');
    Catenis.malleabilityEventEmitter = new MalleabilityEventEmitter();
};


// MalleabilityEventEmitter function class (public) properties
//

MalleabilityEventEmitter.notifyEvent = Object.freeze({
    txid_changed: Object.freeze({
        name: 'txid_changed',
        description: 'Blockchain attributed ID of transaction has changed due to malleability'
    })
});


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(MalleabilityEventEmitter);
