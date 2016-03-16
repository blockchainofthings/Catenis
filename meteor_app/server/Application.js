/**
 * Created by claudio on 27/11/15.
 */

//console.log('[Application.js]: This code just ran.');

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
var config = Npm.require('config');
var path = Npm.require('path');
var fs = Npm.require('fs');
var crypto = Npm.require('crypto');
var bitcoin = Npm.require('bitcoinjs-lib');

// Config variables
var appConfig = config.get('application'),
    appSeedFilenameConfig = appConfig.get('seedFilename'),
    appCryptoNetwork = appConfig.get('cryptoNetwork');


// Definition of function classes
//

// Application function class
function Application() {
    // Get application seed
    var appSeedPath = path.join(process.env.PWD, appSeedFilenameConfig),
        encData = fs.readFileSync(appSeedPath, {encoding: 'utf8'});

    this.seed = decryptSeed(new Buffer(encData, 'base64'));

    if (! isSeedValid(this.seed)) {
        throw new Error('Application seed does not match seed currently recorded onto the database');
    }

    // Get crypto network
    this.cryptoNetwork = bitcoin.networks[appCryptoNetwork];

    if (this.cryptoNetwork == undefined) {
        throw new Error('Invalid/unknown crypto network: ' + appCryptoNetwork);
    }
}


// Application function class (public) methods
//

Application.initialize = function () {
    // Instantiate App object
    Catenis.application = new Application();
};


// Definition of module (private) functions
//

// Receives a buffer with the ciphered seed data,
//  and returns a buffer with the deciphered data
function decryptSeed(encData) {
    var x = [ 83, 84, 78, 106, 77, 72, 82, 76, 100, 68, 78, 117, 77, 84, 85, 106, 78, 122, 99, 61],
        dec = crypto.createDecipher('des-ede3-cbc', (new Buffer((new Buffer(x)).toString(), 'base64')).toString());

    var decBuf1 = dec.update(encData),
        decBuf2 = dec.final();

    return Buffer.concat([decBuf1, decBuf2]);
}

function isSeedValid(seed) {
    // Calculate seed hash
    var sha1Hash = crypto.createHash('sha1');

    sha1Hash.update('This is it: Catenis App seed' + seed.toString(), 'utf8');
    var seedHash = sha1Hash.digest('base64');

    // Compare with seedHash on the database
    var app = Catenis.module.DB.Application.find({}, {fields: {seedHash: 1}}).fetch()[0],
        isValid = false;

    if (app.seedHash !== null) {
        // Check if seed hash matches the seed hash on the database
        if (app.seedHash === seedHash) {
            isValid = true;
        }
    }
    else {
        // Application seed not yet defined. Save seed hash onto database
        //  and indicate that it is valid
        Catenis.module.DB.Application.update({_id: app._id}, {$set: {seedHash: seedHash}});
        isValid = true;
    }

    return isValid;
}


// Module code
//

// Save module function class reference
if (typeof Catenis === 'undefined')
    Catenis = {};

if (typeof Catenis.module === 'undefined')
    Catenis.module = {};

Catenis.module.Application = Application;
