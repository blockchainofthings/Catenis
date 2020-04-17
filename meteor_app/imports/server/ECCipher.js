/**
 * Created by claudio on 2019-02-20.
 */

//console.log('[ECCipher.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import crypto from 'crypto';
// Third-party node modules
//import config from 'config';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
//import { Catenis } from './Catenis';

export const defaultIV = [128,54,254,30,235,181,211,89,160,214,109,196,40,175,106,102];


// Definition of function classes
//

// ECCipher function class
//
// Constructor arguments:
//  privateKeyFrom [Object(Buffer)] - Buffer containing (uncompressed) private key of origin party
//  publicKeyTo [Object(Buffer)] - Buffer containing (uncompressed) public key of destine party
//  iv [Object(Buffer)] - Initialization vector to be used by cipher
export function ECCipher(privateKeyFrom, publicKeyTo, iv) {
    this.privateKeyFrom = privateKeyFrom;
    this.publicKeyTo = publicKeyTo;
    this.iv = iv || Buffer.from(defaultIV);

    createCipher.call(this);
}


// Public ECCipher object methods
//

// Add data to be ciphered
//
// Arguments:
//  data [Object(Buffer)] - Buffer containing the data to be ciphered
//
// Returns:
//  cipheredData [Object(Data)] - Buffer containing the partially ciphered data
ECCipher.prototype.update = function (data) {
    return this.cipher.update(data);
};

// Retrieve the final part of the ciphered data
//
//  Returns:
//   cipheredDate [Object(Buffer)] - Buffer containing the last part of the ciphered data
ECCipher.prototype.final = function () {
    return this.cipher.final();
};


// Module functions used to simulate private ECCipher object methods
//  NOTE: these functions need to be bound to a ECCipher object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

function createCipher() {
    const ecdh = crypto.createECDH('secp256k1');
    ecdh.setPrivateKey(this.privateKeyFrom);

    const encryptionKey = sha512(ecdh.computeSecret(this.publicKeyTo)).slice(0, 32);

    this.cipher = crypto.createCipheriv('aes-256-cbc', encryptionKey, this.iv);
}


// ECCipher function class (public) methods
//

/*ECCipher.class_func = function () {
};*/


// ECCipher function class (public) properties
//

/*ECCipher.prop = {};*/


// Definition of module (private) functions
//

export function sha512(data) {
    return crypto.createHash('sha512').update(data).digest();
}


// Module code
//

// Lock function class
Object.freeze(ECCipher);
