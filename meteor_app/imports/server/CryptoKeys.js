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

    return bitcoinMessage.sign(textToSign, this.getPrivateKey(), this.keyPair.compressed, Catenis.application.cryptoNetwork.messagePrefix, signOpts);
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

/**
 * Generates a random crypto key pair
 * @returns {CryptoKeys}
 */
CryptoKeys.random = function () {
    return new CryptoKeys(Catenis.bip32.fromSeed(Buffer.from(Random.secret())));
}


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
