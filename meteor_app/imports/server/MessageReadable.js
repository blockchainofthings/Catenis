/**
 * Created by claudio on 2019-02-27.
 */

//console.log('[MessageReadable.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import { Readable } from 'stream';
// Third-party node modules
//import config from 'config';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
//import { Catenis } from './Catenis';

// Config entries
/*const config_entryConfig = config.get('config_entry');

// Configuration settings
const cfgSettings = {
    property: config_entryConfig.get('property_name')
};*/


// Definition of classes
//

// MessageReadable class
export class MessageReadable extends Readable {
    // Constructor arguments:
    //  provisionalMessage_id [String] - ProvisionalMessage database collection doc/rec ID
    constructor (highWaterMark) {
        super({
            highWaterMark: highWaterMark
        });
    }

    setEncryption(sourceKeys, destKeys) {
        this.encryption = {
            sourceKeys: sourceKeys,
            destKeys: destKeys
        };
    }

    checkEncryptData(data) {
        if (this.encryption) {
            return !this.encryption.sourceKeys.encryptingData() ? this.encryption.sourceKeys.startEncryptData(data, this.encryption.destKeys)
                    : this.encryption.sourceKeys.continueEncryptData(data);
        }
        else {
            return data;
        }
    }

    hasFinalEncryptData() {
        return this.encryption && this.encryption.sourceKeys.encryptingData();
    }

    checkFinalEncryptData() {
        if (this.encryption && this.encryption.sourceKeys.encryptingData()) {
            return this.encryption.sourceKeys.continueEncryptData();
        }
    }
}


// Module functions used to simulate private MessageReadable object methods
//  NOTE: these functions need to be bound to a MessageReadable object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// MessageReadable function class (public) methods
//

/*MessageReadable.class_func = function () {
};*/


// MessageReadable function class (public) properties
//

/*MessageReadable.prop = {};*/


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(MessageReadable);
