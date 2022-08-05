/**
 * Created by claudio on 2022-07-13
 */

//console.log('[NFTokenContentsTransform.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import { Transform } from 'stream';
// Third-party node modules
import config from 'config';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { NFTokenContentsProgress } from './NFTokenContentsProgress';
import { DataEncryption } from './DataEncryption';
import { DataDecryption } from './DataDecryption';

// Config entries
const nftContsTransformConfig = config.get('nfTokenContentsTransform');

// Configuration settings
const cfgSettings = {
    highWaterMark: nftContsTransformConfig.get('highWaterMark')
};


// Definition of classes
//

/**
 * Non-Fungible Token Contents Transform class
 */
export class NFTokenContentsTransform extends Transform {
    /**
     * Class constructor
     * @param {NFTokenContentsProgress} nftContentsProgress Non-fungible token contents progress object
     * @param {Object} [options] Writable stream options object
     */
    constructor(nftContentsProgress, options) {
        options = options || {};

        if (!options.highWaterMark) {
            options.highWaterMark = cfgSettings.highWaterMark;
        }

        super(options);

        this.nftContentsProgress = nftContentsProgress;

        this.boundProcessTransform = Meteor.bindEnvironment(this._processTransform, 'Internal transform method of NFTokenContentsTransform stream', this);
        this.boundProcessFlush = Meteor.bindEnvironment(this._processFlush, 'Internal flush method of NFTokenContentsTransform stream', this);
    }

    /**
     * Implementation of transform stream's standard method
     * @param {(Error|null)} err Error object reporting a possible error
     * @param {Function} callback Callback function to be called after finishing the processing
     * @private
     */
    _destroy(err, callback) {
        if (err) {
            Catenis.logger.DEBUG('Non-fungible token contents transform stream is being destroyed because of an error:', err);
        }

        // Pass back error so error handler of stream is called
        callback(err);
    }

    /**
     * Implementation of transform stream's standard method
     * @param {(Buffer|string)} chunk The data chunk to be transformed
     * @param {(string|null)} encoding The encoding if the data chunk if a string
     * @param {Function} callback Callback function to be called after finishing the processing
     * @private
     */
    _transform(chunk, encoding, callback) {
        return this.boundProcessTransform(chunk, encoding, callback);
    }

    /**
     * Implementation of transform stream's standard method
     * @param {Function} callback Callback function to be called after finishing the processing
     * @private
     */
    _flush(callback) {
        return this.boundProcessFlush(callback);
    }

    /**
     * Internal method to process standard _transform() method
     * @param {(string|Buffer)} chunk The data chunk to be transformed
     * @param {(string|null)} encoding The encoding if the data chunk if a string
     * @param {Function} callback Callback function to be called after finishing the processing
     * @private
     */
    _processTransform(chunk, encoding, callback) {
        let error = null;

        if (chunk.length > 0) {
            try {
                if (typeof chunk === 'string') {
                    chunk = Buffer.from(chunk, encoding);
                }

                const dataToTransform = this.checkDecryptData(chunk);

                // Report progress: additional data retrieved (read) from external resource
                //  (after decrypting it if set to decrypt the data)
                this.nftContentsProgress.reportReadProgress(dataToTransform.length);

                this.push(this.checkEncryptData(dataToTransform));

                // Report progress: additional data sent (written) to external resource
                //  (before encrypting it if set to encrypt the data)
                this.nftContentsProgress.reportWriteProgress(dataToTransform.length);
            }
            catch (err) {
                Catenis.logger.ERROR('Error transforming data on Non-fungible token contents transform stream.', err);
                error = new Error('Error transforming data on Non-fungible token contents transform stream: ' + err.toString());
            }
        }

        callback(error);
    }

    /**
     * Internal method to process standard _flush() method
     * @param {Function} callback Callback function to be called after finishing the processing
     * @private
     */
    _processFlush(callback) {
        let error = null;

        try {
            if (this.hasFinalDecryptData) {
                const dataToTransform = this.checkFinalDecryptData();

                // Report progress: additional data retrieved (read) from external resource
                //  (after decrypting it if set to decrypt the data)
                this.nftContentsProgress.reportReadProgress(dataToTransform.length);

                this.push(this.checkEncryptData(dataToTransform));

                // Report progress: additional data sent (written) to external resource
                //  (before encrypting it if set to encrypt the data)
                this.nftContentsProgress.reportWriteProgress(dataToTransform.length);
            }

            if (this.hasFinalEncryptData) {
                this.push(this.checkFinalEncryptData());
            }
        }
        catch (err) {
            Catenis.logger.ERROR('Error flushing Non-fungible token contents transform stream.', err);
            error = new Error('Error flushing Non-fungible token contents transform stream: ' + err.toString());
        }

        callback(error);
    }

    /**
     * Checks whether data is currently being decrypted
     * @return {boolean}
     */
    get hasFinalDecryptData() {
        return this.dataDecryption && this.dataDecryption.inProgress;
    }

    /**
     * Checks whether data is currently being encrypted
     * @return {boolean}
     */
    get hasFinalEncryptData() {
        return this.dataEncryption && this.dataEncryption.inProgress;
    }

    /**
     * Set up stream to decrypt contents
     * @param {CryptoKeys} decryptKeys Crypto key pairs used to decrypt the non-fungible token's contents
     */
    setDecryption(decryptKeys) {
        this.dataDecryption = new DataDecryption(decryptKeys);
    }

    /**
     * Conditionally decrypt the provided data
     * @param {Buffer} data The data to decrypt
     * @return {Buffer} The resulting decrypted data
     */
    checkDecryptData(data) {
        if (this.dataDecryption) {
            return this.dataDecryption.decryptChunk(data);
        }
        else {
            return data;
        }
    }

    /**
     * Conditionally terminates the current data decryption
     * @return {(Buffer|undefined)} The final part of the decrypted data
     */
    checkFinalDecryptData() {
        if (this.dataDecryption) {
            return this.dataDecryption.decryptChunk();
        }
    }

    /**
     * Set up stream to encrypt contents
     * @param {CryptoKeys} encryptKeys Crypto key pairs used to encrypt the non-fungible token's contents
     */
    setEncryption(encryptKeys) {
        this.dataEncryption = new DataEncryption(encryptKeys);
    }

    /**
     * Conditionally encrypt the provided data
     * @param {Buffer} data The data to encrypt
     * @return {Buffer} The resulting encrypted data
     */
    checkEncryptData(data) {
        if (this.dataEncryption) {
            return this.dataEncryption.encryptChunk(data);
        }
        else {
            // Encryption not set up. So just return the plain data
            return data;
        }
    }

    /**
     * Conditionally terminates the current data encryption
     * @return {(Buffer|undefined)} The final part of the encrypted data
     */
    checkFinalEncryptData() {
        if (this.dataEncryption) {
            return this.dataEncryption.encryptChunk();
        }
    }
}

// Definition of module (private) functions
//


// Module code
//

// Lock class
Object.freeze(NFTokenContentsTransform);
