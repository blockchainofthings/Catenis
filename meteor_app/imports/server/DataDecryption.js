/**
 * Created by claudio on 2022-07-28
 */

//console.log('[DataDecryption.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
//import config from 'config';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { CryptoKeys } from './CryptoKeys';
import { ECDecipher } from './ECDecipher';


// Definition of classes
//

/**
 * Data encryption class
 */
export class DataDecryption {
    /**
     * Class constructor
     *
     * NOTE: this class is meant to be used to decrypt data in chunks. When decrypting a single chunk of data, it is
     *        more efficient to use the CryptoKeys.decryptData() method directly.
     *
     * @param {CryptoKeys} dstKeys Crypto key pair of the destination party (to whom the data was encrypted)
     * @param {CryptoKeys} [srcKeys] Crypto key pair of the source party (who encrypted the data). If omitted, the
     *                                destination crypto key pair will be used as the source crypto key pair
     */
    constructor(dstKeys, srcKeys) {
        //  Validate arguments
        const errArg = {};

        if (!(dstKeys instanceof CryptoKeys)) {
            errArg.dstKeys = dstKeys;
        }

        if (srcKeys && !(srcKeys instanceof CryptoKeys)) {
            errArg.srcKeys = srcKeys;
        }

        if (Object.keys(errArg).length > 0) {
            const errArgs = Object.keys(errArg);

            Catenis.logger.ERROR(`DataDecryption constructor called with invalid argument${errArgs.length > 1 ? 's' : ''}`, errArg);
            throw new TypeError(`Invalid ${errArgs.join(', ')} argument${errArgs.length > 1 ? 's' : ''}`);
        }

        if (!dstKeys.hasPrivateKey()) {
            throw new Error('Unable to decrypt data: missing private key');
        }

        srcKeys = srcKeys || dstKeys;

        // Set up data decryption
        try {
            if (srcKeys.encryptionScheme !== CryptoKeys.encryptionScheme.randomIV) {
                const iv = srcKeys.encryptionScheme === CryptoKeys.encryptionScheme.pubKeyHashIV
                    ? dstKeys.getPubKeyHash().slice(0, 16) : undefined;

                this.ecDecipher = new ECDecipher(dstKeys.getPrivateKey(), srcKeys.getUncompressedPublicKey(), iv);
            }
            else {
                // Using a random initialization vector (IV). We need to get it from the data to be decrypted. So just
                //  save the required data to finalize the setup later for now.
                this.dstKeys = dstKeys;
                this.srcKeys = srcKeys;
                this.iv = Buffer.from('');
                this.ecDecipher = undefined;
            }

            this.started = false;
            this.finalized = false;
        }
        catch (err) {
            throw new Error(`Failure setting up data decryption: ${err}`);
        }
    }

    /**
     * Indicates whether the data decryption is currently in progress
     * @returns {boolean}
     */
    get inProgress() {
        return this.started && !this.finalized;
    }

    /**
     * Finalize the setup of the data encryption
     * @param {Buffer} data The first chunk of data to be decrypted
     * @returns {Buffer} The modified chunk of data to be decrypted (stripped of the IV)
     * @private
     */
    _finalizeSetup(data) {
        // Make sure that setup is not yet finalized
        if (!this.ecDecipher) {
            const remainingIVLength = 16 - this.iv.length;
            this.iv = Buffer.concat([this.iv, data.slice(0, remainingIVLength)]);
            data = data.slice(remainingIVLength);

            if (this.iv.length === 16) {
                this.ecDecipher = new ECDecipher(this.dstKeys.getPrivateKey(), this.srcKeys.getUncompressedPublicKey(), this.iv);
            }
        }

        return data;
    }

    /**
     * Decrypt a new chunk of data
     * @param {Buffer} [data] The chunk of data to be decrypted. When no data is provided, it signals the end of the
     *                         data decryption
     * @param {boolean} [isFinal=false] Indicates whether this is the final chunk of data
     * @returns {Buffer} A chunk of decrypted data
     */
    decryptChunk(data, isFinal = false) {
        if (this.finalized) {
            throw new Error('Data decryption already finalized');
        }

        const plainChunks = [];
        let totalChunkLength = 0;

        try {
            if (data != null) {
                if (!this.ecDecipher) {
                    data = this._finalizeSetup(data);
                }

                if (this.ecDecipher && data.length > 0) {
                    const plainData = this.ecDecipher.update(data);
                    plainChunks.push(plainData);
                    totalChunkLength += plainData.length;
                    this.started = true;
                }
            }
            else {
                isFinal = true;
            }

            if (isFinal) {
                if (this.ecDecipher) {
                    const finalPlainData = this.ecDecipher.final();
                    plainChunks.push(finalPlainData);
                    totalChunkLength += finalPlainData.length;
                }
                else {
                    // noinspection ExceptionCaughtLocallyJS
                    throw new Error('Missing or inconsistent IV');
                }

                this.finalized = true;
            }
        }
        catch (err) {
            throw new Error(`Failure decrypting data: ${err}`);
        }

        return Buffer.concat(plainChunks, totalChunkLength);
    }
}


// Definition of module (private) functions
//


// Module code
//

// Lock class
Object.freeze(DataDecryption);
