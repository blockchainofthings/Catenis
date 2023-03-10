/**
 * Created by claudio on 2019-03-05.
 */

//console.log('[MessageDuplex.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import { Duplex } from 'stream';
// Third-party node modules
//import config from 'config';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { MessageReadable } from './MessageReadable';
import { DataDecryption } from './DataDecryption';

// Config entries
/*const config_entryConfig = config.get('config_entry');

// Configuration settings
const cfgSettings = {
    property: config_entryConfig.get('property_name')
};*/


// Definition of classes
//

// MessageDuplex class
export class MessageDuplex extends Duplex {
    // Constructor arguments:
    //  highWaterMark [Number] - Threshold, in number of bytes, of stream's internal buffer
    //  options [Object] - Duplex stream options object
    constructor (options) {
        super(options);
    }

    _destroy(err, callback) {
        if (err) {
            Catenis.logger.DEBUG('Message duplex stream is being destroyed because of an error:', err);
        }

        // Pass back error so error handler of stream is called
        callback(err);
    }

    get hasFinalDecryptData() {
        return this.dataDecryption && this.dataDecryption.inProgress;
    }

    setDecryption(destKeys, sourceKeys) {
        this.dataDecryption = new DataDecryption(destKeys, sourceKeys);
    }

    unsetDecryption() {
        this.dataDecryption = undefined;
    }

    checkDecryptData(data) {
        if (this.dataDecryption) {
            return this.dataDecryption.decryptChunk(data);
        }
        else {
            return data;
        }
    }

    checkFinalDecryptData() {
        if (this.dataDecryption) {
            return this.dataDecryption.decryptChunk();
        }
    }

    static [Symbol.hasInstance](instance) {
        return MessageDuplex.prototype.isPrototypeOf(instance) || MessageReadable.prototype.isPrototypeOf(instance);
    }
}


// Module functions used to simulate private MessageDuplex object methods
//  NOTE: these functions need to be bound to a MessageDuplex object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// MessageDuplex function class (public) methods
//

/*MessageDuplex.class_func = function () {
};*/


// MessageDuplex function class (public) properties
//

/*MessageDuplex.prop = {};*/


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(MessageDuplex);
