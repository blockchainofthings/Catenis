/**
 * Created by claudio on 2022-06-27
 */

//console.log('[NFTokenContentsWritable.js]: This code just ran.');

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
import { NFTokenRetrieval } from './NFTokenRetrieval';

// Config entries
const nftContsWritableConfig = config.get('nfTokenMetadataWritable');

// Configuration settings
const cfgSettings = {
    highWaterMark: nftContsWritableConfig.get('highWaterMark')
};


// Definition of classes
//

// NFTokenContentsWritable class
export class NFTokenContentsWritable extends Writable {
    /**
     * Class constructor
     * @param {NFTokenRetrieval} nfTokenRetrieval Non-fungible token retrieval object
     * @param {Object} [options] Writable stream options object
     */
    constructor(nfTokenRetrieval, options) {
        options = options || {};

        if (!options.highWaterMark) {
            options.highWaterMark = cfgSettings.highWaterMark;
        }

        super(options);

        this.nfTokenRetrieval = nfTokenRetrieval;

        if (this.nfTokenRetrieval.contentsInfo && this.nfTokenRetrieval.contentsInfo.isEncrypted) {
            this.setDecryption(this.nfTokenRetrieval.holdingAddressInfo.cryptoKeys);
        }

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
            Catenis.logger.DEBUG('Non-fungible token contents writable stream is being destroyed because of an error:', err);
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

                // noinspection JSCheckFunctionSignatures
                const dataToConcat = this.checkDecryptData(chunk);
                this.writtenData = Buffer.concat([this.writtenData, dataToConcat], this.writtenData.length + dataToConcat.length);

                // Check whether is there are enough data to save
                while (this.writtenData.length >= this.nfTokenRetrieval.contentsDataChunkSize) {
                    const dataToSave = this.writtenData.slice(0, this.nfTokenRetrieval.contentsDataChunkSize);

                    // Update non-fungible token retrieval progress, and save the data
                    this.nfTokenRetrieval.updateRetrievalProgress(dataToSave.length);

                    // Execute code in critical section to avoid database concurrency
                    NFTokenRetrieval.dbCS.execute(() => {
                        this.nfTokenRetrieval.saveRetrievedContentsData(dataToSave);
                    });

                    this.writtenData = this.writtenData.slice(dataToSave.length);
                }
            }
            catch (err) {
                Catenis.logger.ERROR('Error writing Non-fungible token contents writable stream.', err);
                error = new Error('Error writing Non-fungible token contents writable stream: ' + err.toString());
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
            if (this.hasFinalDecryptData()) {
                const dataToConcat = this.checkFinalDecryptData();
                this.writtenData = Buffer.concat([this.writtenData, dataToConcat], this.writtenData.length + dataToConcat.length);

                // Check whether is there are enough data to save
                while (this.writtenData.length >= this.nfTokenRetrieval.contentsDataChunkSize) {
                    const dataToSave = this.writtenData.slice(0, this.nfTokenRetrieval.contentsDataChunkSize);

                    // Update non-fungible token retrieval progress, and save the data
                    this.nfTokenRetrieval.updateRetrievalProgress(dataToSave.length);

                    // Execute code in critical section to avoid database concurrency
                    NFTokenRetrieval.dbCS.execute(() => {
                        this.nfTokenRetrieval.saveRetrievedContentsData(dataToSave);
                    });

                    this.writtenData = this.writtenData.slice(dataToSave.length);
                }
            }

            // Check whether there are still data to save
            if (this.writtenData.length > 0) {
                // Update non-fungible token retrieval progress, and save the data
                this.nfTokenRetrieval.updateRetrievalProgress(this.writtenData.length);

                // Execute code in critical section to avoid database concurrency
                NFTokenRetrieval.dbCS.execute(() => {
                    this.nfTokenRetrieval.saveRetrievedContentsData(this.writtenData, true);
                });
            }
            else {
                // No more data to save. Just set last saved contents data as final

                // Execute code in critical section to avoid database concurrency
                NFTokenRetrieval.dbCS.execute(() => {
                    this.nfTokenRetrieval.finalizeRetrievedContentsData();
                });
            }
        }
        catch (err) {
            Catenis.logger.ERROR('Error finalizing Non-fungible token contents writable stream.', err);
            error = new Error('Error finalizing Non-fungible token contents writable stream: ' + err.toString());
        }

        callback(error);
    }

    /**
     * Set up stream to decrypt contents
     * @param {CryptoKeys} decryptKeys Crypto key pairs used to decrypt the non-fungible token's contents
     */
    setDecryption(decryptKeys) {
        this.decryptKeys = decryptKeys;
    }

    /**
     * Conditionally decrypt the provided data
     * @param {Buffer} data The data to decrypt
     * @return {Buffer} The resulting decrypted data
     */
    checkDecryptData(data) {
        if (this.decryptKeys) {
            return !this.decryptKeys.decryptingData() ? this.decryptKeys.startDecryptData(data)
                : this.decryptKeys.continueDecryptData(data);
        }
        else {
            return data;
        }
    }

    /**
     * Checks whether data is currently being decrypted
     * @return {boolean}
     */
    hasFinalDecryptData() {
        return this.decryptKeys && this.decryptKeys.decryptingData();
    }

    /**
     * Conditionally terminates the current data decryption
     * @return {(Buffer|undefined)} The final part of the decrypted data
     */
    checkFinalDecryptData() {
        if (this.decryptKeys && this.decryptKeys.decryptingData()) {
            return this.decryptKeys.continueDecryptData();
        }
    }
}

// Definition of module (private) functions
//


// Module code
//

// Lock class
Object.freeze(NFTokenContentsWritable);
