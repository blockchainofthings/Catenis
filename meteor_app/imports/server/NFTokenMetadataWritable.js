/**
 * Created by claudio on 2022-06-25
 */

//console.log('[NFTokenMetadataWritable.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import { Writable } from 'stream';
// Third-party node modules
import config from 'config';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';

// Config entries
const nftMetaWritableConfig = config.get('nfTokenMetadataWritable');

// Configuration settings
const cfgSettings = {
    highWaterMark: nftMetaWritableConfig.get('highWaterMark')
};


// Definition of classes
//

/**
 * Non-Fungible Token Metadata Writable class
 */
export class NFTokenMetadataWritable extends Writable {
    /**
     * Class constructor
     * @param {NFTokenMetadataRepo} nfTokenMetaRepo Non-fungible token metadata repo object
     * @param {Object} [options] Writable stream options object
     */
    constructor(nfTokenMetaRepo, options) {
        options = options || {};

        if (!options.highWaterMark) {
            options.highWaterMark = cfgSettings.highWaterMark;
        }

        super(options);

        this.nfTokenMetaRepo = nfTokenMetaRepo;
        this.writtenData = Buffer.from('');

        this.boundProcessWrite = Meteor.bindEnvironment(this._processWrite, 'Internal write method of NFTokenMetadataWritable stream', this);
        this.boundProcessFinal = Meteor.bindEnvironment(this._processFinal, 'Internal final method of NFTokenMetadataWritable stream', this);
    }

    /**
     * Implementation of writable stream's standard method
     * @param {(Error|null)} err Error object reporting a possible error
     * @param {Function} callback Callback function to be called after finishing the processing
     * @private
     */
    _destroy(err, callback) {
        if (err) {
            Catenis.logger.DEBUG('Non-fungible token metadata writable stream is being destroyed because of an error:', err);
        }

        // Pass back error so error handler of stream is called
        callback(err);
    }

    /**
     * Implementation of writable stream's standard method
     * @param {(string|Buffer|Uint8Array)} chunk The data chunk to be written
     * @param {(string|null)} encoding The encoding if the data chunk is a string
     * @param {Function} callback Callback function to be called after finishing the processing
     * @private
     */
    _write(chunk, encoding, callback) {
        return this.boundProcessWrite(chunk, encoding, callback);
    }

    /**
     * Implementation of writable stream's standard method
     * @param {Function} callback Callback function to be called after finishing the processing
     * @private
     */
    _final(callback) {
        return this.boundProcessFinal(callback);
    }

    /**
     * Internal method to process standard _write() method
     * @param {(string|Buffer|Uint8Array)} chunk The data chunk to be written
     * @param {(string|null)} encoding The encoding if the data chunk is a string
     * @param {Function} callback Callback function to be called after finishing the processing
     * @private
     */
    _processWrite(chunk, encoding, callback) {
        let error = null;

        if (chunk.length > 0) {
            try {
                if (typeof chunk === 'string') {
                    chunk = Buffer.from(chunk, encoding);
                }

                this.nfTokenMetaRepo.reportProgress(chunk.length);

                this.writtenData = Buffer.concat([this.writtenData, chunk], this.writtenData.length + chunk.length);
            }
            catch (err) {
                Catenis.logger.ERROR('Error writing non-fungible token metadata writable stream.', err);
                error = new Error('Error writing non-fungible token metadata writable stream: ' + err.toString());
            }
        }

        callback(error);
    }

    /**
     * Internal method to process standard _final() method
     * @param {Function} callback Callback function to be called after finishing the processing
     * @private
     */
    _processFinal(callback) {
        let error = null;

        try {
            // Parse the written data (as a non-fungible token metadata) and save it
            const metadata = JSON.parse(this.writtenData.toString());

            this.nfTokenMetaRepo.saveToRepo(metadata);
        }
        catch (err) {
            Catenis.logger.ERROR('Error finalizing non-fungible token metadata writable stream.', err);
            error = new Error('Error finalizing non-fungible token metadata writable stream: ' + err.toString());
        }

        callback(error);
    }
}


// Definition of module (private) functions
//


// Module code
//

// Lock class
Object.freeze(NFTokenMetadataWritable);
