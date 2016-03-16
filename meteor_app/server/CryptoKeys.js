/**
 * Created by claudio on 14/03/16.
 */

//console.log('[CryptoKeys.js]: This code just ran.');

// Fix default config file folder.
//  Note: this is necessary because process.cwd()
//  (which is used by the config module to define the
//  default config folder) does not point to the
//  Meteor application folder. Instead, the application
//  folder is gotten from process.env.PWD and set
//  to the environment variable NODE_CONFIG_DIR,
//  which is used by the config module to set the
//  default config folder if it is defined.
if (process.env.NODE_CONFIG_DIR === undefined) {
    process.env.NODE_CONFIG_DIR = Npm.require('path').join(process.env.PWD, 'config');
}

// References to external modules
var bitcoin = Npm.require('bitcoinjs-lib');
var wif = Npm.require('wif');
var eccrypto = Npm.require('eccrypto');
var secp256k1 = Npm.require('secp256k1');
var crypto = Npm.require('crypto');
var Future = Npm.require('fibers/future');

// Module variables
var iv = [128,54,254,30,235,181,211,89,160,214,109,196,40,175,106,102]; // iv generated as: crypto.randomBytes(16).toJSON()

// Definition of function classes
//

// CrytoKeys function class
function CryptoKeys(keyPair) {
    this.keyPair = keyPair;
}


// Public CryptoKeys object methods
//

CryptoKeys.prototype.hasPrivateKey = function () {
    return this.keyPair.d ? true : false;
}

CryptoKeys.prototype.getPrivateKey = function () {
    if (!this.hasPrivateKey()) {
        throw new Error('Missing private key')
    }

    return this.keyPair.d.toBuffer(32);
}

CryptoKeys.prototype.getCompressedPublicKey = function () {
    var pubKey = this.keyPair.getPublicKeyBuffer();

    return this.keyPair.compressed ? pubKey : secp256k1.publicKeyConvert(pubKey, true);
}

CryptoKeys.prototype.getUncompressedPublicKey = function () {
    var pubKey = this.keyPair.getPublicKeyBuffer();

    return this.keyPair.compressed ? secp256k1.publicKeyConvert(pubKey, false) : pubKey;
}

CryptoKeys.prototype.getAddress = function () {
    return this.keyPair.getAddress();
}

// NOTE: the length of the encrypted data will have a length that is a multiple of 16.
//  One can use the following formula to calculate the size of the encrypted data
//  from the size of the original data:
//
//  (Math.floor(data.length / 16) + 1) * 16
//
CryptoKeys.prototype.encryptDataToSend = function (destKeys, data) {
    if (!this.hasPrivateKey()) {
        throw new Error('Cannot encrypt data; missing private key')
    }

    // Future required to synchronize call to eccrypto methods, which are asynchronous in nature (via promises)
    var fut = new Future(),
        encData,
        opts = {iv: Buffer(iv), ephemPrivateKey: this.getPrivateKey()};

    // NOTE: only works with UNCOMPRESSED public key
    eccrypto.encrypt(destKeys.getUncompressedPublicKey(), data, opts).then(function(encrypted) {
        encData = encrypted.ciphertext;
        fut.return();
    }, function(error) {
        fut.throw(new Error('Failure encrypting data to send: ' + error));
        fut.return();
    });

    fut.wait();

    return encData;
}

CryptoKeys.prototype.decryptReceivedData = function (sourceKeys, data) {
    if (!this.hasPrivateKey()) {
        throw new Error('Cannot decrypt data; missing private key')
    }

    // Future required to synchronize call to eccrypto methods, which are asynchronous in nature (via promises)
    var fut = new Future(),
        decData,
        // NOTE: only works with UNCOMPRESSED public key
        opts = {iv: Buffer(iv), ephemPublicKey: sourceKeys.getUncompressedPublicKey(), ciphertext: data},
        privKey = this.getPrivateKey();

    opts.mac = calcMacEncData(privKey, opts);

    eccrypto.decrypt(this.getPrivateKey(), opts).then(function(plaindata) {
        decData = plaindata;
        fut.return();
    }, function(error) {
        fut.throw(new Error ('Failure decrypting received data: ' + error));
        fut.return();
    });

    fut.wait();

    return decData;
}


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
    var mac,
        // Future required to synchronize call to eccrypto methods, which are asynchronous in nature (via promises)
        fut = new Future();

    eccrypto.derive(privKey, encResult.ephemPublicKey).then(function(Px) {
        var hash = sha512(Px);
        var macKey = hash.slice(32);
        var dataToMac = Buffer.concat([encResult.iv, encResult.ephemPublicKey, encResult.ciphertext]);
        mac = hmacSha256(macKey, dataToMac);
        fut.return();
    },function(error) {
        fut.throw(new Error ('Failure deriving shared secret for private & public keys: ' + error));
        fut.return();
    });

    fut.wait();

    return mac;
}


// Module code
//

// Save module function class reference
if (typeof Catenis === 'undefined')
    Catenis = {};

if (typeof Catenis.module === 'undefined')
    Catenis.module = {};

Catenis.module.CryptoKeys = CryptoKeys;