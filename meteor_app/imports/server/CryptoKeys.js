/**
 * Created by claudio on 14/03/16.
 */

//console.log('[CryptoKeys.js]: This code just ran.');

// Module variables
//

// References to external modules

// References to external code
//
// Internal node modules
//  NOTE: the reference of these modules are done sing 'require()' instead of 'import' to
//      to avoid annoying WebStorm warning message: 'default export is not defined in
//      imported module'
const crypto = require('crypto');
// Third-party node modules
import eccrypto from 'eccrypto';
import secp256k1 from 'secp256k1';
import Future from 'fibers/future';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';

// Initialization vector - generated as: crypto.randomBytes(16).toJSON()
const iv = [128,54,254,30,235,181,211,89,160,214,109,196,40,175,106,102];


// Definition of function classes
//

// CrytoKeys function class
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
        throw new Error('Missing private key')
    }

    return this.keyPair.d.toBuffer(32);
};

CryptoKeys.prototype.exportPrivateKey = function () {
    if (!this.hasPrivateKey()) {
        throw new Error('Missing private key')
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
CryptoKeys.prototype.encryptData = function (destKeys, data) {
    if (!this.hasPrivateKey()) {
        throw new Error('Cannot encrypt data; missing private key')
    }

    // Future required to synchronize call to eccrypto methods, which are asynchronous in nature (via promises)
    const fut = new Future(),
        opts = {iv: Buffer(iv), ephemPrivateKey: this.getPrivateKey()};
    let encData = undefined;

    // NOTE: only works with UNCOMPRESSED public key
    eccrypto.encrypt(destKeys.getUncompressedPublicKey(), data, opts).then((encrypted) => {
        encData = encrypted.ciphertext;
        fut.return();
    }, (error) => {
        fut.throw(new Error('Failure encrypting data to send: ' + error));
        fut.return();
    });

    fut.wait();

    return encData;
};

CryptoKeys.prototype.decryptData = function (sourceKeys, data) {
    if (!this.hasPrivateKey()) {
        throw new Error('Cannot decrypt data; missing private key')
    }

    // Future required to synchronize call to eccrypto methods, which are asynchronous in nature (via promises)
    const fut = new Future(),
        // NOTE: only works with UNCOMPRESSED public key
        opts = {iv: Buffer(iv), ephemPublicKey: sourceKeys.getUncompressedPublicKey(), ciphertext: data},
        privKey = this.getPrivateKey();
    let decData = undefined;

    opts.mac = calcMacEncData(privKey, opts);

    //noinspection JSCheckFunctionSignatures
    eccrypto.decrypt(this.getPrivateKey(), opts).then((plaindata) => {
        decData = plaindata;
        fut.return();
    }, (error) => {
        fut.throw(new Error ('Failure decrypting received data: ' + error));
        fut.return();
    });

    fut.wait();

    return decData;
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

function sha512(msg) {
    return crypto.createHash("sha512").update(msg).digest();
}

function hmacSha256(key, msg) {
    return crypto.createHmac("sha256", key).update(msg).digest();
}

// Mac required to validated encrypted message
function calcMacEncData(privKey, encResult) {
    // Future required to synchronize call to eccrypto methods, which are asynchronous in nature (via promises)
    const fut = new Future();
    let mac = undefined;

    eccrypto.derive(privKey, encResult.ephemPublicKey).then((Px) => {
        const hash = sha512(Px);
        const macKey = hash.slice(32);
        const dataToMac = Buffer.concat([encResult.iv, encResult.ephemPublicKey, encResult.ciphertext]);
        mac = hmacSha256(macKey, dataToMac);
        fut.return();
    }, (error) => {
        fut.throw(new Error ('Failure deriving shared secret for private & public keys: ' + error));
        fut.return();
    });

    fut.wait();

    return mac;
}


// Module code
//

// Lock function class
Object.freeze(CryptoKeys);
