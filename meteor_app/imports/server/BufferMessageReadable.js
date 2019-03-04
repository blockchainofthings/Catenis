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
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { MessageReadable } from './MessageReadable';

// Config entries
const bufMsgReadbleConfig = config.get('bufferMessageReadable');

// Configuration settings
const cfgSettings = {
    highWaterMark: bufMsgReadbleConfig.get('highWaterMark')
};


// Definition of classes
//

// BufferMessageReadable class
export class BufferMessageReadable extends MessageReadable {
    // Constructor arguments:
    //  message [Object(Buffer)] - Buffer object which contains the message data
    constructor (message) {
        super(cfgSettings.highWaterMark);

        this.message = message;

        this.bytesRead = 0;
    }

    _read(size) {
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
            let maxBytesToRead = size || cfgSettings.highWaterMark;

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
            process.nextTick(() => this.emit('error', new Error('Error reading buffer message readable stream: ' + err.toString())));
        }
    }
}


// Module functions used to simulate private BufferMessageReadable object methods
//  NOTE: these functions need to be bound to a BufferMessageReadable object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


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
