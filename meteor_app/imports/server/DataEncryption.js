/**
 * Created by claudio on 2022-07-28
 */

//console.log('[DataEncryption.js]: This code just ran.');

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
import { Random } from 'meteor/random';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { CryptoKeys } from './CryptoKeys';
import { ECCipher } from './ECCipher';


// Definition of classes
//

/**
 * Data encryption class
 */
export class DataEncryption {
    /**
     * Class constructor
     *
     * NOTE: this class is meant to be used to encrypt data in chunks. When encrypting a single chunk of data, it is
     *        more efficient to use the CryptoKeys.encryptData() method directly.
     *
     * @param {CryptoKeys} srcKeys Crypto key pair of the source party (who is encrypting the data)
     * @param {CryptoKeys} [dstKeys] Crypto key pair of the destination party (to whom the data is being encrypted). If
     *                                omitted, the source crypto key pair will be used as the destination crypto key
     *                                pair
     */
    constructor(srcKeys, dstKeys) {
        //  Validate arguments
        const errArg = {};

        if (!(srcKeys instanceof CryptoKeys)) {
            errArg.srcKeys = srcKeys;
        }

        if (dstKeys && !(dstKeys instanceof CryptoKeys)) {
            errArg.dstKeys = dstKeys;
        }

        if (Object.keys(errArg).length > 0) {
            const errArgs = Object.keys(errArg);

            Catenis.logger.ERROR(`DataEncryption constructor called with invalid argument${errArgs.length > 1 ? 's' : ''}`, errArg);
            throw new TypeError(`Invalid ${errArgs.join(', ')} argument${errArgs.length > 1 ? 's' : ''}`);
        }
        
        if (!srcKeys.hasPrivateKey()) {
            throw new Error('Unable to encrypt data: missing private key');
        }

        dstKeys = dstKeys || srcKeys;
        
        // Set up data encryption
        try {
            // Determine the initialization vector to use according to the encryption
            //  scheme of the source crypto key pair
            const iv = srcKeys.encryptionScheme === CryptoKeys.encryptionScheme.randomIV
                ? Buffer.from(Random.hexString(32), 'hex')
                : (srcKeys.encryptionScheme === CryptoKeys.encryptionScheme.pubKeyHashIV
                    ? dstKeys.getPubKeyHash().slice( 0, 16) : undefined);

            this.ecCipher = new ECCipher(srcKeys.getPrivateKey(), dstKeys.getUncompressedPublicKey(), iv);

            this.headerChunk = srcKeys.encryptionScheme === CryptoKeys.encryptionScheme.randomIV ? iv : undefined;
            this.started = false;
            this.finalized = false;
        }
        catch (err) {
            throw new Error(`Failure setting up data encryption: ${err}`);
        }
    }

    /**
     * Indicates whether the data encryption is currently in progress
     * @returns {boolean}
     */
    get inProgress() {
        return this.started && !this.finalized;
    }

    /**
     * Encrypt a new chunk of data
     * @param {(string|Buffer)} [data] The chunk of data to be encrypted. When no data is provided, it signals the end
     *                                  of the data encryption
     * @param {boolean} [isFinal=false] Indicates whether this is the final chunk of data
     * @returns {Buffer} A chunk of encrypted data
     */
    encryptChunk(data, isFinal = false) {
        if (this.finalized) {
            throw new Error('Data encryption already finalized');
        }

        const cipheredChunks = [];
        let totalChunkLength = 0;

        if (this.headerChunk) {
            cipheredChunks.push(this.headerChunk);
            totalChunkLength += this.headerChunk.length;
            this.headerChunk = undefined;
        }

        try {
            if (data != null) {
               const cipheredData = this.ecCipher.update(data);
                cipheredChunks.push(cipheredData);
                totalChunkLength += cipheredData.length;
                this.started = true;
            }
            else {
                isFinal = true;
            }

            if (isFinal) {
                const finalCipheredData = this.ecCipher.final();
                cipheredChunks.push(finalCipheredData);
                totalChunkLength += finalCipheredData.length;
                this.finalized = true;
            }
        }
        catch (err) {
            throw new Error(`Failure encrypting data: ${err}`);
        }

        return Buffer.concat(cipheredChunks, totalChunkLength);
    }
}


// Definition of module (private) functions
//


// Module code
//

// Lock class
Object.freeze(DataEncryption);
