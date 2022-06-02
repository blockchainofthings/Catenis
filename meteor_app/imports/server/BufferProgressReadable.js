/**
 * Created by claudio on 2022-05-18
 */

//console.log('[BufferProgressReadable.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import { Readable } from 'stream';
// Third-party node modules
import config from 'config';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';

// Config entries
const bufProgReadableConfig = config.get('bufferProgressReadable');

// Configuration settings
const cfgSettings = {
    highWaterMark: bufProgReadableConfig.get('highWaterMark'),
    defaultReadChunkSize: bufProgReadableConfig.get('defaultReadChunkSize')
};


// Definition of classes
//

/**
 * Readable stream that reports progress when reading data from a buffer.
 */
export class BufferProgressReadable extends Readable {
    /**
     * @callback ReadProgressCallback
     * @param {number} bytesRead Number of (additional) bytes that have just been read
     */

    /**
     * Class constructor.
     * @param {Buffer} buffer The buffer from where to read the data
     * @param {ReadProgressCallback} [progressCallback] Callback to report progress while reading data from the buffer
     * @param {Object} [options] Standard readable stream options
     */
    constructor(buffer, progressCallback, options) {
        options = options || {};

        if (!options.highWaterMark) {
            options.highWaterMark = cfgSettings.highWaterMark;
        }

        super(options);

        this.buffer = buffer;
        this.progressCallback = progressCallback;

        this.bytesRead = 0;

        this.boundProcessRead = Meteor.bindEnvironment(this._processRead, 'Internal read method of BufferProgressReadable stream', this);
    }

    /**
     * Implementation of readable stream's standard method
     * @param {(Error|null)} err Error object reporting a possible error
     * @param {Function} callback Callback function to be called after finishing the processing
     * @private
     */
    _destroy(err, callback) {
        if (err) {
            Catenis.logger.DEBUG('Buffer progress readable is being destroyed because of an error:', err);
        }

        callback(null);
    }

    /**
     * Implementation of readable stream's standard method
     * @param {number} size The size of the chunk to read
     * @private
     */
    _read(size) {
        this.boundProcessRead(size);
    }

    /**
     * Internal method to process standard _read() method
     * @param {number} [size] Number of bytes to read
     * @private
     */
    _processRead(size) {
        try {
            size = size || cfgSettings.defaultReadChunkSize;

            const totalBytes = this.buffer.length;
            let bytesToRead = Math.min(size, totalBytes - this.bytesRead);
            let eof = false;

            if (bytesToRead > 0) {
                let continuePushing = true;

                for (; bytesToRead > 0 && continuePushing; bytesToRead = Math.min(size, totalBytes - this.bytesRead)) {
                    const dataRead = this.buffer.slice(this.bytesRead, this.bytesRead + bytesToRead);

                    if (this.progressCallback) {
                        // Report read progress passing delta bytes read
                        this.progressCallback(bytesToRead);
                    }

                    // Send the data
                    continuePushing = this.push(dataRead);

                    this.bytesRead += bytesToRead;
                }

                if (bytesToRead === 0) {
                    // No more data to read
                    eof = true;
                }
            }
            else {
                // No more data to read
                eof = true;
            }

            if (eof) {
                // Indicate that all data has been read
                this.push(null);
            }
        }
        catch (err) {
            Catenis.logger.ERROR('Error reading buffer progress readable stream.', err);
            this.destroy(new Error('Error reading buffer progress readable stream: ' + err.toString()));
        }
    }
}


// Definition of module (private) functions
//


// Module code
//

// Lock class
Object.freeze(BufferProgressReadable);
