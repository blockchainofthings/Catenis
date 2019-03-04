/**
 * Created by claudio on 2019-02-20.
 */

//console.log('[ECDecipher.js]: This code just ran.');

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

// Config entries
/*const config_entryConfig = config.get('config_entry');

// Configuration settings
const cfgSettings = {
    property: config_entryConfig.get('property_name')
};*/

const defaultIV = [128,54,254,30,235,181,211,89,160,214,109,196,40,175,106,102];


// Definition of function classes
//

// ECDecipher function class
//
// Constructor arguments:
//  privateKeyTo [Object(Buffer)] - Buffer containing (uncompressed) private key of destine party
//  publicKeyTo [Object(Buffer)] - Buffer containing (uncompressed) public key of origin party
//  iv [Object(Buffer)] - Initialization vector to be used by cipher
export function ECDecipher(privateKeyTo, publicKeyFrom, iv) {
    this.privateKeyTo = privateKeyTo;
    this.publicKeyFrom = publicKeyFrom;
    this.iv = iv || Buffer.from(defaultIV);

    createDecipher.call(this);
}


// Public ECDecipher object methods
//

// Add data to be ciphered
//
// Arguments:
//  data [Object(Buffer)] - Buffer containing the data to be ciphered
//
// Returns:
//  cipheredData [Object(Data)] - Buffer containing the partially ciphered data
ECDecipher.prototype.update = function (data) {
    return this.decipher.update(data);
};

// Retrieve the final part of the ciphered data
//
//  Returns:
//   cipheredDate [Object(Buffer)] - Buffer containing the last part of the ciphered data
ECDecipher.prototype.final = function () {
    return this.decipher.final();
};


// Module functions used to simulate private ECDecipher object methods
//  NOTE: these functions need to be bound to a ECDecipher object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

function createDecipher() {
    const ecdh = crypto.createECDH('secp256k1');
    ecdh.setPrivateKey(this.privateKeyTo);

    //const encryptionKey = sha512(ecdh.computeSecret(this.publicKeyFrom)).slice(0, 32);
    const encryptionKey = ecdh.computeSecret(this.publicKeyFrom);

    this.decipher = crypto.createDecipheriv('aes-256-cbc', encryptionKey, this.iv);
}


// ECDecipher function class (public) methods
//

/*ECDecipher.class_func = function () {
};*/


// ECDecipher function class (public) properties
//

/*ECDecipher.prop = {};*/


// Definition of module (private) functions
//

function sha512(data) {
    return crypto.createHash('sha512').update(data).digest();
}


// Module code
//

// Lock function class
Object.freeze(ECDecipher);
