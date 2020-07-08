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
import bitcoinLib from 'bitcoinjs-lib';
// Meteor packages
import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { ECCipher } from './ECCipher';
import { ECDecipher } from './ECDecipher';
import { BitcoinInfo } from './BitcoinInfo';


// Definition of function classes
//

// CryptoKeys function class
//
// Constructor
//  keyPair [Object] - Object representing a ECDSA key pair. Should be either an ECPair or a BIP32 class instance
//                      gotten from bitcoinjs-lib's ECPair.fromXXX() or bip32.fromXXX() methods
//  btcAddressType [Object] - (optional) Object representing the type of bitcoin address that should be generated from the encapsulated
//                             crypto key pair. Valid values: any of the properties of BitcoinInfo.addressType
//  encryptionScheme [Object] - Specify the encryption scheme to use. Valid values: any property of CryptoKeys.encryptionScheme
export function CryptoKeys(keyPair, btcAddressType, encryptionScheme = CryptoKeys.encryptionScheme.pubKeyHashIV) {
    this.keyPair = keyPair;

    if (btcAddressType !== undefined && !BitcoinInfo.isValidAddressType(btcAddressType)) {
        Catenis.logger.ERROR('CryptoKeys constructor called with an invalid \'btcAddressType\' argument', {btcAddressType});
        throw new Error('CryptoKeys constructor called with an invalid \'btcAddressType\' argument');
    }

    this.btcAddressType = btcAddressType;
    this.encryptionScheme = encryptionScheme;

    // Make sure that `compressed` property is defined.
    //  Rationale: BIP32 instances only handle compressed keys even though they do not define a `compressed` property
    if (this.keyPair.compressed === undefined) {
        this.keyPair.compressed = true;
    }

    // Make sure that generated bitcoin signatures are 71-bytes long (including the trailing SIGHASH byte)
    //  or less. The probability for smaller signatures (< 71 bytes) is very small though, so we can
    //  assume that signatures will take up exactly 71 bytes when estimating transaction size.
    //  NOTE: there is a computational cost for doing it since, on average, the signature needs to be
    //      calculated twice. This however is expected to be a transitional solution until bitcoin starts
    //      using Schnorr signatures (BIP 340), which will have a fixed 64-byte length (65 bytes, when
    //      including the trailing SIGHASH byte).
    this.keyPair.lowR = true;
}


// Public CryptoKeys object methods
//

CryptoKeys.prototype.hasPrivateKey = function () {
    return !!this.keyPair.privateKey;
};

CryptoKeys.prototype.getPrivateKey = function () {
    if (!this.hasPrivateKey()) {
        throw new Meteor.Error('ctn_crypto_no_priv_key', 'Missing private key');
    }

    return this.keyPair.privateKey;
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
    const pubKey = this.keyPair.publicKey;

    return this.keyPair.compressed ? pubKey : secp256k1.publicKeyConvert(pubKey, true);
};

CryptoKeys.prototype.getUncompressedPublicKey = function () {
    const pubKey = this.keyPair.publicKey;

    return this.keyPair.compressed ? secp256k1.publicKeyConvert(pubKey, false) : pubKey;
};

CryptoKeys.prototype.getAddress = function () {
    // Make sure that bitcoin address type is specified
    if (!this.btcAddressType) {
        throw new Error('Cannot generate address from crypto key pair; bitcoin address type not specified');
    }

    return this.btcAddressType.btcPayment({
        pubkey: this.keyPair.publicKey,
        network: this.keyPair.network
    }).address;
};

CryptoKeys.prototype.getPubKeyHash = function () {
    return bitcoinLib.crypto.hash160(this.keyPair.publicKey);
};

CryptoKeys.prototype.getAddressAndPubKeyHash = function () {
    // Make sure that bitcoin address type is specified
    if (!this.btcAddressType) {
        throw new Error('Cannot generate address from crypto key pair; bitcoin address type not specified');
    }

    const p2pkh = this.btcAddressType.btcPayment({
        pubkey: this.keyPair.publicKey,
        network: this.keyPair.network
    });

    return {
        address: p2pkh.address,
        pubKeyHash: p2pkh.hash
    };
};


// NOTE: the length of the encrypted data will have a length that is a multiple of 16.
//  One can use the following formula to calculate the size of the encrypted data
//  from the size of the original data:
//
//  (Math.floor(data.length / 16) + 1) * 16
//
// NOTE 2: when the `randomIV` encryption scheme is used, an extra 16 bytes block (containing
//      the randomly generated initialization vector) is prepended to the encrypted data. So
//      the formula above needs to be adjusted by adding 16 to the result.
//
CryptoKeys.prototype.encryptData = function (data, destKeys) {
    if (!this.hasPrivateKey()) {
        throw new Meteor.Error('ctn_crypto_no_priv_key', 'Cannot encrypt data; missing private key');
    }

    destKeys = destKeys || this;

    try {
        // Determine the initialization vector to use according to the encryption
        //  scheme of the source
        const iv = this.encryptionScheme === CryptoKeys.encryptionScheme.randomIV
            ? Buffer.from(Random.hexString(32), 'hex')
            : (this.encryptionScheme === CryptoKeys.encryptionScheme.pubKeyHashIV
                ? destKeys.getPubKeyHash().slice(0, 16) : undefined);
        const ecCipher = new ECCipher(this.getPrivateKey(), destKeys.getUncompressedPublicKey(), iv);

        const resultParts = [ecCipher.update(data), ecCipher.final()];

        if (this.encryptionScheme === CryptoKeys.encryptionScheme.randomIV) {
            resultParts.unshift(iv);
        }

        return Buffer.concat(resultParts);
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
        // Determine the initialization vector to use according to the encryption
        //  scheme of the source
        const iv = this.encryptionScheme === CryptoKeys.encryptionScheme.randomIV
            ? Buffer.from(Random.hexString(32), 'hex')
            : (this.encryptionScheme === CryptoKeys.encryptionScheme.pubKeyHashIV
                ? destKeys.getPubKeyHash().slice(0, 16) : undefined);
        this.ecCipher = new ECCipher(this.getPrivateKey(), destKeys.getUncompressedPublicKey(), iv);

        const result = this.ecCipher.update(data);

        return this.encryptionScheme === CryptoKeys.encryptionScheme.randomIV ? Buffer.concat([iv, result]) : result;
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
        // Determine the initialization vector to use according to the encryption
        //  scheme of the source
        let iv;

        if (sourceKeys.encryptionScheme === CryptoKeys.encryptionScheme.randomIV) {
            iv = data.slice(0, 16);
            data = data.slice(16);
        }
        else if (sourceKeys.encryptionScheme === CryptoKeys.encryptionScheme.pubKeyHashIV) {
            iv = this.getPubKeyHash().slice(0, 16);
        }

        const ecDecipher = new ECDecipher(this.getPrivateKey(), sourceKeys.getUncompressedPublicKey(), iv);

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
        // Determine the initialization vector to use according to the encryption
        //  scheme of the source
        let iv;

        if (sourceKeys.encryptionScheme === CryptoKeys.encryptionScheme.randomIV) {
            iv = data.slice(0, 16);
            data = data.slice(16);
        }
        else if (sourceKeys.encryptionScheme === CryptoKeys.encryptionScheme.pubKeyHashIV) {
            iv = this.getPubKeyHash().slice(0, 16);
        }

        this.ecDecipher = new ECDecipher(this.getPrivateKey(), sourceKeys.getUncompressedPublicKey(), iv);

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

    let signOpts;

    if (this.btcAddressType === BitcoinInfo.addressType.witness_v0_keyhash) {
        signOpts = {
            segwitType: 'p2wpkh'
        };
    }
    else if (this.btcAddressType === BitcoinInfo.addressType.witness_v0_scripthash) {
        signOpts = {
            segwitType: 'p2sh(p2wpkh)'
        };
    }

    return bitcoinMessage.sign(textToSign, this.getPrivateKey(), this.keyPair.compressed, signOpts);
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


// CryptoKeys function class (public) properties
//

CryptoKeys.encryptionScheme = Object.freeze({
    fixedIV: Object.freeze({
        name: 'fixedIV',
        description: 'Make use of a fixed, predefined initialization vector'
    }),
    randomIV: Object.freeze({
        name: 'randomIV',
        description: 'A unique, randomly generated initialization vector is used each time (and that vector is returned along with the encrypted data)'
    }),
    pubKeyHashIV: Object.freeze({
        name: 'pubKeyHashIV',
        description: 'Use the hash of the public key to derive the initialization vector to use'
    })
});


// Definitions of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(CryptoKeys);
