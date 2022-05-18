/**
 * Created by claudio on 2019-02-19.
 */

//console.log('[BufferMessageReadable.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import config from 'config';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { MessageReadable } from './MessageReadable';

// Config entries
const bufMsgReadableConfig = config.get('bufferMessageReadable');

// Configuration settings
const cfgSettings = {
    highWaterMark: bufMsgReadableConfig.get('highWaterMark'),
    defaultReadChunkSize: bufMsgReadableConfig.get('defaultReadChunkSize')
};


// Definition of classes
//

// BufferMessageReadable class
export class BufferMessageReadable extends MessageReadable {
    // Constructor arguments:
    //  message [Object(Buffer)] - Buffer object which contains the message data
    //  options [Object] - Readable stream options object
    constructor (message, options) {
        options = options || {};

        if (!options.highWaterMark) {
            options.highWaterMark = cfgSettings.highWaterMark;
        }

        super(options);

        this.message = message;

        this.bytesRead = 0;

        this._processRead = Meteor.bindEnvironment(processRead, 'Internal read method of BufferMessageReadable stream', this);
    }

    _read(size) {
        this._processRead(size);
    }
}


// Module functions used to simulate private BufferMessageReadable object methods
//  NOTE: these functions need to be bound to a BufferMessageReadable object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

function processRead(size) {
    try {
        let msgLength = this.message.length;

        if (this.bytesRead >= msgLength) {
            // No more message bytes. Finalize read
            let lastEncryptBlock;

            if ((lastEncryptBlock = this.checkFinalEncryptData())) {
                // Read last block of encrypted data
                this.push(lastEncryptBlock);
            }

            // Signal EOF
            this.push(null);

            return;
        }

        let continuePushing = true;
        let maxBytesToRead = size || cfgSettings.defaultReadChunkSize;

        for (let bytesToRead = Math.min(maxBytesToRead, msgLength - this.bytesRead); bytesToRead > 0 && continuePushing; this.bytesRead += bytesToRead, bytesToRead = Math.min(maxBytesToRead, msgLength - this.bytesRead)) {
            let msgData = this.message.slice(this.bytesRead, this.bytesRead + bytesToRead);

            continuePushing = this.push(this.checkEncryptData(msgData));
        }

        if (this.bytesRead >= msgLength) {
            // No more message bytes. Finalize read
            if (this.hasFinalEncryptData()) {
                if (continuePushing) {
                    // Read last block of encrypted data
                    this.push(this.checkFinalEncryptData());

                    // Signal EOF
                    this.push(null);
                }
            }
            else {
                // Signal EOF
                this.push(null);
            }
        }
    }
    catch (err) {
        Catenis.logger.ERROR('Error reading buffer message readable stream.', err);
        this.destroy(new Error('Error reading buffer message readable stream: ' + err.toString()));
    }
}


// BufferMessageReadable function class (public) methods
//

/*BufferMessageReadable.class_func = function () {
};*/


// BufferMessageReadable function class (public) properties
//

/*BufferMessageReadable.prop = {};*/


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(BufferMessageReadable);
