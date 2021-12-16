/**
 * Created by claudio on 2019-03-05.
 */

//console.log('[CachedMessageDuplex.js]: This code just ran.');

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
import { MessageDuplex } from './MessageDuplex';
import { CachedMessage } from './CachedMessage';
import {
    cfgSettings as messageCfgSettings
} from './Message';

// Config entries
const cachMsgDuplexConfig = config.get('cachedMessageDuplex');

// Configuration settings
const cfgSettings = {
    highWaterMark: cachMsgDuplexConfig.get('highWaterMark')
};


// Definition of classes
//

// CachedMessageDuplex class
export class CachedMessageDuplex extends MessageDuplex {
    // Constructor arguments:
    //  cachedMessage [Object(CachedMessage)] - Cached message object
    //  options [Object] - Duplex stream options object
    constructor (cachedMessage, options) {
        options = options || {};

        if (!options.highWaterMark) {
            options.highWaterMark = cfgSettings.highWaterMark;
        }

        super(options);

        // Save cached message info
        this.cachedMessage_id = cachedMessage.doc_id;
        this.cachedMessageId = cachedMessage.cachedMessageId;
        this.dataChunkSize = cachedMessage.dataChunkSize;

        if (this.dataChunkSize === messageCfgSettings.maxSizeReadDataChunk + 1) {
            // Special case where doing asynchronous processing and message should be read
            //  at once (not in chunks). Adjust data chunk size and indicate that the
            //  whole message should be fit in only one chunk
            this.dataChunkSize--;
            this.fitInOneChunk = true;
        }
        else {
            this.fitInOneChunk = false;
        }

        this.messageChunks = [];
        this.dataToWrite = Buffer.from('');
        this.readMsgChunkIndex = 0;

        this._processWrite = Meteor.bindEnvironment(processWrite, 'Internal write method of CachedMessageDuplex stream', this);
        this._processFinal = Meteor.bindEnvironment(processFinal, 'Internal final method of CachedMessageDuplex stream', this);
        this._processRead = Meteor.bindEnvironment(processRead, 'Internal read method of CachedMessageDuplex stream', this);
    }

    _write(chunk, encoding, callback) {
        // Only do any processing if stream is still open
        if (this.open) {
            this._processWrite(chunk, encoding, callback);
        }
        else {
            callback(null);
        }
    }

    _final(callback) {
        // Only do any processing if stream is still open
        if (this.open) {
            this._processFinal(callback);
        }
        else {
            callback(null);
        }
    }

    _read(size) {
        // Only do any processing if stream is still open
        if (this.open) {
            this._processRead(size);
        }
    }
}


// Module functions used to simulate private CachedMessageDuplex object methods
//  NOTE: these functions need to be bound to a CachedMessageDuplex object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

function processWrite(chunk, encoding, callback) {
    let error = null;

    try {
        this.dataToWrite = Buffer.concat([this.dataToWrite, this.checkDecryptData(chunk)]);

        // Check whether it is time to write data
        let bytesWritten = 0;

        while (this.dataToWrite.length >= this.dataChunkSize) {
            if (this.fitInOneChunk && this.messageChunks.length > 0) {
                // Message wont fit in only one chunk. Return error
                Catenis.logger.DEBUG('Message too large to fit in just one chunk');
                callback(new Meteor.Error('ctn_cach_msg_not_fit_one_chunk', 'Message too large to fit in just one chunk'));
                return;
            }

            const dataChunk = this.dataToWrite.slice(0, this.dataChunkSize);

            this.messageChunks.push(MessageChunk.createCachedMessageChunk(this.cachedMessage_id, dataChunk, false, this.messageChunks.length + 1));

            bytesWritten += dataChunk.length;
            this.dataToWrite = this.dataToWrite.slice(dataChunk.length);
        }

        if (bytesWritten > 0) {
            // Update processing progress
            CachedMessage.updateProcessingProgress(this.cachedMessageId, bytesWritten);
        }
    }
    catch (err) {
        Catenis.logger.ERROR('Error writing cached message duplex stream.', err);
        error = new Error('Error writing cached message duplex stream: ' + err.toString());
    }

    callback(error);
}

function processFinal(callback) {
    let error = null;

    try {
        let bytesWritten = 0;

        if (this.hasFinalDecryptData()) {
            this.dataToWrite = Buffer.concat([this.dataToWrite, this.checkFinalDecryptData()]);

            // Check whether it is time to write data
            while (this.dataToWrite.length >= this.dataChunkSize) {
                if (this.fitInOneChunk && this.messageChunks.length > 0) {
                    // Message wont fit in only one chunk. Return error
                    Catenis.logger.DEBUG('Message too large to fit in just one chunk');
                    callback(new Meteor.Error('ctn_cach_msg_not_fit_one_chunk', 'Message too large to fit in just one chunk'));
                    return;
                }

                const dataChunk = this.dataToWrite.slice(0, this.dataChunkSize);

                this.messageChunks.push(MessageChunk.createCachedMessageChunk(this.cachedMessage_id, dataChunk, false, this.messageChunks.length + 1));

                bytesWritten += dataChunk.length;
                this.dataToWrite = this.dataToWrite.slice(dataChunk.length);
            }
        }

        // Check if there is still data to be written
        if (this.dataToWrite.length > 0) {
            if (this.fitInOneChunk && this.messageChunks.length > 0) {
                // Message wont fit in only one chunk. Return error
                Catenis.logger.DEBUG('Message too large to fit in just one chunk');
                callback(new Meteor.Error('ctn_cach_msg_not_fit_one_chunk', 'Message too large to fit in just one chunk'));
                return;
            }

            // Write last data chunk
            this.messageChunks.push(MessageChunk.createCachedMessageChunk(this.cachedMessage_id, this.dataToWrite, true, this.messageChunks.length + 1));

            bytesWritten += this.dataToWrite.length;
        }
        else if (this.messageChunks.length > 0) {
            // Set latest written message chunk as final
            this.messageChunks[this.messageChunks.length - 1].setFinal();
        }

        if (bytesWritten > 0) {
            // Update processing progress
            CachedMessage.updateProcessingProgress(this.cachedMessageId, bytesWritten);
        }
    }
    catch (err) {
        Catenis.logger.ERROR('Error finalizing cached message duplex stream.', err);
        error = new Error('Error finalizing cached message duplex stream: ' + err.toString());
    }

    callback(error);
}

function processRead(size) {
    try {
        const numMessageChunks = this.messageChunks.length;

        if (this.readMsgChunkIndex >= numMessageChunks) {
            // No more message chunks. Signal EOF
            this.push(null);
        }
        else {
            const bytesToRead = size || cfgSettings.highWaterMark;
            let bytesRead = 0;
            let dataToSend = Buffer.from('');

            for (; this.readMsgChunkIndex < numMessageChunks && bytesRead < bytesToRead; this.readMsgChunkIndex++) {
                // Retrieve next message chunk's contents
                const msgChunkData = this.messageChunks[this.readMsgChunkIndex].getData();

                bytesRead += msgChunkData.length;

                // Accumulate read data
                dataToSend = Buffer.concat([dataToSend, msgChunkData]);
            }

            // Send data
            this.push(dataToSend);

            if (this.readMsgChunkIndex >= numMessageChunks) {
                // No more message chunks. Signal EOF
                this.push(null);
            }
        }
    }
    catch (err) {
        Catenis.logger.ERROR('Error reading provisional message readable stream.', err);
        process.nextTick(() => this.emit('error', new Error('Error reading provisional message readable stream: ' + err.toString())));
    }
}


// CachedMessageDuplex function class (public) methods
//

/*CachedMessageDuplex.class_func = function () {
};*/


// CachedMessageDuplex function class (public) properties
//

/*CachedMessageDuplex.prop = {};*/


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(CachedMessageDuplex);
