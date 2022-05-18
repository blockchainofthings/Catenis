/**
 * Created by claudio on 2019-03-05.
 */

//console.log('[BufferMessageDuplex.js]: This code just ran.');

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
import { MessageDuplex } from './MessageDuplex';
import {
    cfgSettings as messageCfgSettings
} from './Message';

// Config entries
const bufMsgDuplexConfig = config.get('bufferMessageDuplex');

// Configuration settings
const cfgSettings = {
    highWaterMark: bufMsgDuplexConfig.get('highWaterMark'),
    defaultReadChunkSize: bufMsgDuplexConfig.get('defaultReadChunkSize')
};


// Definition of classes
//

// BufferMessageDuplex class
export class BufferMessageDuplex extends MessageDuplex {
    // Constructor arguments:
    //  capacity [Number] - Maximum number of bytes that can be written to buffer stream
    //  options [Object] - Duplex stream options object
    constructor (capacity, options) {
        options = options || {};

        if (!options.highWaterMark) {
            options.highWaterMark = cfgSettings.highWaterMark;
        }

        super(options);

        this.message = Buffer.from('');

        if (typeof capacity === 'number') {
            this.capacity = Math.floor(capacity);

            // Make sure that capacity is within allowed boundaries
            if (this.capacity < messageCfgSettings.minSizeReadDataChunk) {
                this.capacity = messageCfgSettings.minSizeReadDataChunk;
            }
            else if (this.capacity > messageCfgSettings.maxSizeReadDataChunk) {
                this.capacity = messageCfgSettings.maxSizeReadDataChunk;
            }
        }
        else {
            // Set capacity to the maximum allowed
            this.capacity = messageCfgSettings.maxSizeReadDataChunk;
        }

        this.bytesWritten = 0;
        this.bytesRead = 0;

        this._processWrite = Meteor.bindEnvironment(processWrite, 'Internal write method of BufferMessageDuplex stream', this);
        this._processFinal = Meteor.bindEnvironment(processFinal, 'Internal final method of BufferMessageDuplex stream', this);
        this._processRead = Meteor.bindEnvironment(processRead, 'Internal read method of BufferMessageDuplex stream', this);
    }

    _write(chunk, encoding, callback) {
        this._processWrite(chunk, encoding, callback);
    }

    _final(callback) {
        this._processFinal(callback);
    }

    _read(size) {
        this._processRead(size);
    }
}


// Module functions used to simulate private BufferMessageDuplex object methods
//  NOTE: these functions need to be bound to a BufferMessageDuplex object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

function processWrite(chunk, encoding, callback) {
    let error = null;

    if (chunk.length > 0) {
        try {
            if (typeof chunk === 'string') {
                chunk = Buffer.from(chunk, encoding);
            }

            const dataToWrite = this.checkDecryptData(chunk);

            if (dataToWrite.length > this.capacity - this.bytesWritten) {
                // Message data exceeds capacity of buffer message duplex stream. Return error
                Catenis.logger.DEBUG('Message data exceeds buffer message duplex stream\'s capacity');
                callback(new Meteor.Error('ctn_buf_msg_capacity_exceeded', 'Message data exceeds buffer message duplex stream\'s capacity'));
                return;
            }

            this.message = Buffer.concat([this.message, dataToWrite]);

            this.bytesWritten += dataToWrite.length;
        }
        catch (err) {
            Catenis.logger.ERROR('Error writing buffer message duplex stream.', err);
            error = new Error('Error writing buffer message duplex stream: ' + err.toString());
        }
    }

    callback(error);
}

function processFinal(callback) {
    let error = null;

    try {
        if (this.hasFinalDecryptData()) {
            const dataToWrite = this.checkFinalDecryptData();

            if (dataToWrite.length > this.capacity - this.bytesWritten) {
                // Message data exceeds capacity of buffer message duplex stream. Return error
                Catenis.logger.DEBUG('Message data exceeds buffer message duplex stream\'s capacity');
                callback(new Meteor.Error('ctn_buf_msg_capacity_exceeded', 'Message data exceeds buffer message duplex stream\'s capacity'));
                return;
            }

            this.message = Buffer.concat([this.message, dataToWrite]);
        }
    }
    catch (err) {
        Catenis.logger.ERROR('Error finalizing buffer message duplex stream.', err);
        error = new Error('Error finalizing buffer message duplex stream: ' + err.toString());
    }

    callback(error);
}

function processRead(size) {
    try {
        let msgLength = this.message.length;

        if (this.bytesRead >= msgLength) {
            // No more message bytes. Signal EOF
            this.push(null);

            return;
        }

        let continuePushing = true;
        let maxBytesToRead = size || cfgSettings.defaultReadChunkSize;

        for (let bytesToRead = Math.min(maxBytesToRead, msgLength - this.bytesRead); bytesToRead > 0 && continuePushing; this.bytesRead += bytesToRead, bytesToRead = Math.min(maxBytesToRead, msgLength - this.bytesRead)) {
            let msgData = this.message.slice(this.bytesRead, this.bytesRead + bytesToRead);

            continuePushing = this.push(msgData);
        }

        if (this.bytesRead >= msgLength) {
            // No more message bytes. Signal EOF
            this.push(null);
        }
    }
    catch (err) {
        Catenis.logger.ERROR('Error reading buffer message readable stream.', err);
        this.destroy(new Error('Error reading buffer message readable stream: ' + err.toString()));
    }
}


// BufferMessageDuplex function class (public) methods
//

/*BufferMessageDuplex.class_func = function () {
};*/


// BufferMessageDuplex function class (public) properties
//

/*BufferMessageDuplex.prop = {};*/


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(BufferMessageDuplex);
