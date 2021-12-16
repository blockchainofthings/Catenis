/**
 * Created by claudio on 2019-02-19.
 */

//console.log('[ProvisionalMessageReadable.js]: This code just ran.');

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
import { MessageChunk } from './MessageChunk';
import { MessageReadable } from './MessageReadable';
import { ProvisionalMessage } from './ProvisionalMessage';

// Config entries
const provMsgReadableConfig = config.get('provisionalMessageReadable');

// Configuration settings
const cfgSettings = {
    highWaterMark: provMsgReadableConfig.get('highWaterMark')
};


// Definition of classes
//

// ProvisionalMessageReadable class
export class ProvisionalMessageReadable extends MessageReadable {
    // Constructor arguments:
    //  provisionalMessage [Object(ProvisionalMessage)] - Provisional message object
    //  options [Object] - Readable stream options object
    constructor (provisionalMessage, options) {
        options = options || {};

        if (!options.highWaterMark) {
            options.highWaterMark = cfgSettings.highWaterMark;
        }

        super(options);

        // Save provisional message ID
        this.provisionalMessageId = provisionalMessage.provisionalMessageId;

        // Load associated message chunks
        this.messageChunks = MessageChunk.getMessageChunksForProvisionalMessage(provisionalMessage.doc_id);
        this.msgChunkIndex = 0;

        this._processRead = Meteor.bindEnvironment(processRead, 'Internal read method of ProvisionalMessageReadable stream', this);
    }

    _read(size) {
        // Only do any processing if stream is still open
        if (this.open) {
            this._processRead(size);
        }
    }
}


// Module functions used to simulate private ProvisionalMessageReadable object methods
//  NOTE: these functions need to be bound to a ProvisionalMessageReadable object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

function processRead(size) {
    try {
        const numMessageChunks = this.messageChunks.length;

        if (this.msgChunkIndex >= numMessageChunks) {
            // No more message chunks. Finalize read
            let lastEncryptBlock;

            if ((lastEncryptBlock = this.checkFinalEncryptData())) {
                // Send last block of encrypted data
                this.push(lastEncryptBlock);
            }

            // Signal EOF
            this.push(null);
        }
        else {
            const bytesToRead = size || cfgSettings.highWaterMark;
            let bytesRead = 0;
            let dataToSend = Buffer.from('');

            for (; this.msgChunkIndex < numMessageChunks && bytesRead < bytesToRead; this.msgChunkIndex++) {
                // Retrieve next message chunk's contents
                const msgChunkData = this.messageChunks[this.msgChunkIndex].getData();

                bytesRead += msgChunkData.length;

                // Accumulate read data encrypting it as required
                dataToSend = Buffer.concat([dataToSend, this.checkEncryptData(msgChunkData)]);
            }

            let eof = false;

            if (this.msgChunkIndex >= numMessageChunks) {
                // No more message chunks. Finalize read
                let lastEncryptBlock;

                if ((lastEncryptBlock = this.checkFinalEncryptData())) {
                    // Accumulate last block of encrypted data
                    dataToSend = Buffer.concat([dataToSend, lastEncryptBlock]);
                }

                // Indicate that we have reached EOF
                eof = true;
            }

            // Update processing progress
            ProvisionalMessage.updateProcessingProgress(this.provisionalMessageId, bytesRead);

            // Send data
            this.push(dataToSend);

            if (eof) {
                // Signal EOF
                this.push(null);
            }
        }
    }
    catch (err) {
        Catenis.logger.ERROR('Error reading provisional message readable stream.', err);
        process.nextTick(() => this.emit('error', new Error('Error reading provisional message readable stream: ' + err.toString())));
    }
}


// ProvisionalMessageReadable function class (public) methods
//

/*ProvisionalMessageReadable.class_func = function () {
};*/


// ProvisionalMessageReadable function class (public) properties
//

/*ProvisionalMessageReadable.prop = {};*/


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(ProvisionalMessageReadable);
