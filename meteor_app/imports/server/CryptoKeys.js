/**
 * Created by Claudio on 2016-03-14.
 */

//console.log('[CryptoKeys.js]: This code just ran.');

// Module variables
//

// References to external modules

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import secp256k1 from 'secp256k1';
import bitcoinMessage from 'bitcoinjs-message';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { ECCipher } from './ECCipher';
import { ECDecipher } from './ECDecipher';


// Definition of function classes
//

// CryptoKeys function class
export function CryptoKeys(keyPair) {
    this.keyPair = keyPair;
}


// Public CryptoKeys object methods
//

CryptoKeys.prototype.hasPrivateKey = function () {
    return this.keyPair.d ? true : false;
};

CryptoKeys.prototype.getPrivateKey = function () {
    if (!this.hasPrivateKey()) {
        throw new Meteor.Error('ctn_crypto_no_priv_key', 'Missing private key');
    }

    return this.keyPair.d.toBuffer(32);
};

CryptoKeys.prototype.exportPrivateKey = function () {
    if (!this.hasPrivateKey()) {
        throw new Meteor.Error('ctn_crypto_no_priv_key', 'Missing private key');
    }

    return this.keyPair.toWIF();
};

CryptoKeys.prototype.exportPublicKey = function () {
    return this.getCompressedPublicKey().toString('hex');
};

CryptoKeys.prototype.getCompressedPublicKey = function () {
    const pubKey = this.keyPair.getPublicKeyBuffer();

    return this.keyPair.compressed ? pubKey : secp256k1.publicKeyConvert(pubKey, true);
};

CryptoKeys.prototype.getUncompressedPublicKey = function () {
    const pubKey = this.keyPair.getPublicKeyBuffer();

    return this.keyPair.compressed ? secp256k1.publicKeyConvert(pubKey, false) : pubKey;
};

CryptoKeys.prototype.getAddress = function () {
    return this.keyPair.getAddress();
};

// NOTE: the length of the encrypted data will have a length that is a multiple of 16.
//  One can use the following formula to calculate the size of the encrypted data
//  from the size of the original data:
//
//  (Math.floor(data.length / 16) + 1) * 16
//
CryptoKeys.prototype.encryptData = function (data, destKeys) {
    if (!this.hasPrivateKey()) {
        throw new Meteor.Error('ctn_crypto_no_priv_key', 'Cannot encrypt data; missing private key');
    }

    destKeys = destKeys || this;

    try {
        const ecCipher = new ECCipher(this.getPrivateKey(), destKeys.getUncompressedPublicKey());

        return Buffer.concat([ecCipher.update(data), ecCipher.final()]);
    }
    catch (err) {
        throw new Error('Failure while encrypting data: ' + err.toString());
    }
};

// Start encrypting data
//
//  Arguments:
//   data [Object(Buffer)] - Buffer containing the first block of data to be encrypted
//   destKeys [Object(CryptoKeys)] - The crypto keys of the destine party
//
//  Returns:
//   cipheredData [Object(Buffer)] - Buffer containing the first part of the resulting ciphered data
CryptoKeys.prototype.startEncryptData = function (data, destKeys) {
    if (!this.hasPrivateKey()) {
        throw new Meteor.Error('ctn_crypto_no_priv_key', 'Cannot start encrypting data; missing private key');
    }

    destKeys = destKeys || this;

    try {
        this.ecCipher = new ECCipher(this.getPrivateKey(), destKeys.getUncompressedPublicKey());

        return this.ecCipher.update(data);
    }
    catch (err) {
        throw new Error('Failure while starting to encrypt data: ' + err.toString());
    }
};

// Check if data encryption is underway
//
//  Returns:
//   encryptingData [Boolean]
CryptoKeys.prototype.encryptingData = function () {
    return this.ecCipher !== undefined;
};

// Continue encrypting data
//
//  Arguments:
//   data [Object(Buffer)] - (optional) Buffer containing the next block of data to be encrypted. When no data is passed
//                            (undefined or null), it signals the end of the encryption and the last part of the ciphered
//                            data is retrieved
//   isFinal [Boolean] - (optional, default: false) Indicates whether this is the last block of data to be encrypted.
//                        Note that this parameter is only taken into account when some data is passed
//
//  Returns:
//   cipheredData [Object(Buffer)] - Buffer containing the next/last part of the resulting ciphered data
CryptoKeys.prototype.continueEncryptData = function (data, isFinal = false) {
    if (!this.ecCipher) {
        throw new Meteor.Error('ctn_crypto_encrypt_not_started', 'Cannot continue encrypting data; encryption has not been started');
    }

    let cipheredData;

    try {
        if (data) {
            cipheredData = this.ecCipher.update(data);
        }
        else {
            isFinal = true;
        }

        if (isFinal) {
            const finalCipheredData = this.ecCipher.final();
            cipheredData = cipheredData ? Buffer.concat([cipheredData, finalCipheredData], cipheredData.length + finalCipheredData.length)
                : finalCipheredData;
            this.ecCipher = undefined;
        }
    }
    catch (err) {
        throw new Error('Failure while continuing to encrypt data: ' + err.toString());
    }

    return cipheredData;
};

CryptoKeys.prototype.decryptData = function (data, sourceKeys) {
    if (!this.hasPrivateKey()) {
        throw new Meteor.Error('ctn_crypto_no_priv_key', 'Cannot decrypt data; missing private key');
    }

    sourceKeys = sourceKeys || this;

    try {
        const ecDecipher = new ECDecipher(this.getPrivateKey(), sourceKeys.getUncompressedPublicKey());

        return Buffer.concat([ecDecipher.update(data), ecDecipher.final()]);
    }
    catch (err) {
        throw new Error('Failure while decrypting data: ' + err.toString());
    }
};

// Start decrypting ciphered data
//
//  Arguments:
//   data [Object(Buffer)] - Buffer containing the first block of ciphered data to be decrypted
//   sourceKeys [Object(CryptoKeys)] - The crypto keys of the origin party
//
//  Returns:
//   plainData [Object(Buffer)] - Buffer containing the first part of the resulting deciphered data
CryptoKeys.prototype.startDecryptData = function (data, sourceKeys) {
    if (!this.hasPrivateKey()) {
        throw new Meteor.Error('ctn_crypto_no_priv_key', 'Cannot start decrypting data; missing private key');
    }

    sourceKeys = sourceKeys || this;

    try {
        this.ecDecipher = new ECDecipher(this.getPrivateKey(), sourceKeys.getUncompressedPublicKey());

        return this.ecDecipher.update(data);
    }
    catch (err) {
        throw new Error('Failure while starting to decrypt data: ' + err.toString());
    }
};

// Check if data decryption is underway
//
//  Returns:
//   decryptingData [Boolean]
CryptoKeys.prototype.decryptingData = function () {
    return this.ecDecipher !== undefined;
};

// Continue decrypting data
//
//  Arguments:
//   data [Object(Buffer)] - (optional) Buffer containing the next block of ciphered data to be decrypted. When no data is
//                            passed (undefined or null), it signals the end of the decryption and the last part of the
//                            deciphered data is retrieved
//   isFinal [Boolean] - (optional, default: false) Indicates whether this is the last block of ciphered data to be decrypted.
//                        Note that this parameter is only taken into account when some data is passed
//
//  Returns:
//   plainData [Object(Buffer)] - Buffer containing the next/last part of the resulting deciphered data
CryptoKeys.prototype.continueDecryptData = function (data, isFinal = false) {
    if (!this.ecDecipher) {
        throw new Meteor.Error('ctn_crypto_encrypt_not_started', 'Cannot continue decrypting data; decryption has not been started');
    }

    let plainData;

    try {
        if (data) {
            plainData = this.ecDecipher.update(data);
        }
        else {
            isFinal = true;
        }

        if (isFinal) {
            const finalPlainData = this.ecDecipher.final();
            plainData = plainData ? Buffer.concat([plainData, finalPlainData], plainData.length + finalPlainData.length)
                : finalPlainData;
            this.ecDecipher = undefined;
        }
    }
    catch (err) {
        throw new Error('Failure while continuing to decrypt data: ' + err.toString());
    }

    return plainData;
};

CryptoKeys.prototype.signText = function (textToSign) {
    if (!this.hasPrivateKey()) {
        throw new Meteor.Error('ctn_crypto_no_priv_key', 'Cannot sign message; missing private key');
    }

    return bitcoinMessage.sign(textToSign, Catenis.application.cryptoNetwork.messagePrefix, this.getPrivateKey(), this.keyPair.compressed);
};


// CryptoKeys function class (public) methods
//

// Converts a list of crypto keys into a list of addresses
CryptoKeys.toAddressList = function (listKeys) {
    const listAddress = [];

    listKeys.forEach((keys) => {
        listAddress.push(keys.getAddress());
    });

    return listAddress;
};

// Converts a list of crypto keys into a list of private keys in export format (WIF)
CryptoKeys.toExportPrivateKeyList = function (listKeys) {
    const listPrivateKey = [];

    listKeys.forEach((keys) => {
        if (keys.hasPrivateKey()) {
            listPrivateKey.push(keys.exportPrivateKey());
        }
    });

    return listPrivateKey;
};


// Definitions of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(CryptoKeys);
