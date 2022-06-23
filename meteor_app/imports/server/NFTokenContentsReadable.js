/**
 * Created by claudio on 2022-02-17
 */

//console.log('[NFTokenContentsReadable.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import { Readable } from 'stream';
// Third-party node modules
import config from 'config';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { Meteor } from 'meteor/meteor';

// Config entries
const nftContReadableConfig = config.get('nfTokenContentsReadable');

// Configuration settings
const cfgSettings = {
    highWaterMark: nftContReadableConfig.get('highWaterMark')
};


// Definition of classes
//

/**
 * Non-Fungible Token Contents Readable class
 */
export class NFTokenContentsReadable extends Readable {
    /**
     * Class constructor
     * @param {NFAssetIssuance} nfAssetIssuance Non-fungible asset issuance object
     * @param {number} nfTokenIdx The index of the non-fungible token of the asset issuance the contents of which
     *                             should be read
     * @param {Object} [options] Readable stream options object
     */
    constructor (nfAssetIssuance, nfTokenIdx, options) {
        options = options || {};

        if (!options.highWaterMark) {
            options.highWaterMark = cfgSettings.highWaterMark;
        }

        super(options);

        this.nfAssetIssuance = nfAssetIssuance;
        this.nfTokenIdx = nfTokenIdx;

        this.open = true;

        this.contentsParts = nfAssetIssuance.getNFTokenContentsParts(nfTokenIdx);
        this.contentsPartIdx = 0;
        
        this.boundProcessRead = Meteor.bindEnvironment(this._processRead, 'Internal read method of NFTokenContentsReadable stream', this);
    }

    /**
     * Implementation of readable stream's standard method
     */
    _destroy(err, callback) {
        if (err) {
            Catenis.logger.DEBUG('Non-fungible token contents readable stream is being destroyed because of an error:', err);
        }

        // Close stream
        this.open = false;

        process.nextTick(() => this.emit('close'));

        callback();
    }

    /**
     * Implementation of readable stream's standard method
     */
    _read(size) {
        // Only do any processing if stream is still open
        if (this.open) {
            this.boundProcessRead(size);
        }
    }
    
    /**
     * Internal method to process standard _read() method
     * @param {number} size Number of bytes to read
     * @private
     */
    _processRead(size) {
        try {
            const numContentsParts = this.contentsParts.length;

            if (this.contentsPartIdx >= numContentsParts) {
                // No more contents parts. Finalize read
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

                for (; this.contentsPartIdx < numContentsParts && bytesRead < bytesToRead; this.contentsPartIdx++) {
                    // Retrieve next contents part
                    const contentsData = this.contentsParts[this.contentsPartIdx].getContents();

                    bytesRead += contentsData.length;

                    // Accumulate read data encrypting it as required
                    dataToSend = Buffer.concat([dataToSend, this.checkEncryptData(contentsData)]);
                }

                let eof = false;

                if (this.contentsPartIdx >= numContentsParts) {
                    // No more contents parts. Finalize read
                    let lastEncryptBlock;

                    if ((lastEncryptBlock = this.checkFinalEncryptData())) {
                        // Accumulate last block of encrypted data
                        dataToSend = Buffer.concat([dataToSend, lastEncryptBlock]);
                    }

                    // Indicate that we have reached EOF
                    eof = true;
                }

                // Update asset issuance progress
                this.nfAssetIssuance.updateIssuanceProgress(bytesRead);

                // Send data
                this.push(dataToSend);

                if (eof) {
                    // Signal EOF
                    this.push(null);
                }
            }
        }
        catch (err) {
            Catenis.logger.ERROR('Error reading non-fungible token contents readable stream.', err);
            process.nextTick(() => this.emit('error', new Error('Error reading non-fungible token contents readable stream: ' + err.toString())));
        }
    }

    /**
     * Set up stream to encrypt contents
     * @param {CryptoKeys} encryptKeys Crypto key pairs used to encrypt the non-fungible token's contents
     */
    setEncryption(encryptKeys) {
        this.encryptKeys = encryptKeys;
    }

    /**
     * Conditionally encrypt the provided data
     * @param {Buffer} data The data to encrypt
     * @return {Buffer} The resulting encrypted data
     */
    checkEncryptData(data) {
        if (this.encryptKeys) {
            return !this.encryptKeys.encryptingData()
                ? this.encryptKeys.startEncryptData(data)
                : this.encryptKeys.continueEncryptData(data);
        }
        else {
            // Encryption not set up. So just return the unencrypted data
            return data;
        }
    }

    /**
     * Checks whether data is currently being encrypted
     * @return {boolean}
     */
    hasFinalEncryptData() {
        return this.encryptKeys && this.encryptKeys.encryptingData();
    }

    /**
     * Conditionally terminates the current data encryption
     * @return {(Buffer|undefined)} The final part of the encrypted data
     */
    checkFinalEncryptData() {
        if (this.encryptKeys && this.encryptKeys.encryptingData()) {
            return this.encryptKeys.continueEncryptData();
        }
    }
}


// Definition of module (private) functions
//


// Module code
//

// Lock function class
Object.freeze(NFTokenContentsReadable);
