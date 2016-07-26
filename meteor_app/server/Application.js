/**
 * Created by claudio on 27/11/15.
 */

//console.log('[Application.js]: This code just ran.');

// Module variables
//

// References to external modules
var config = Npm.require('config');
var path = Npm.require('path');
var fs = Npm.require('fs');
var crypto = Npm.require('crypto');
var bitcoinLib = Npm.require('bitcoinjs-lib');

// Config entries
var appConfig = config.get('application');

// Configuration settings
var cfgSettings = {
    appName: appConfig.get('appName'),
    seedFilename: appConfig.get('seedFilename'),
    walletPswLength: appConfig.get('walletPswLength'),
    cryptoNetwork: appConfig.get('cryptoNetwork')
};

// Catenis Hub node index
export const ctnHubNodeIndex = 0;

// Definition of function classes
//

// Application function class
function Application() {
    // Save Catenis node index used by application
    Object.defineProperty(this, 'ctnHubNodeIndex', {
        get: function () {
            return ctnHubNodeIndex;
        }
    });
    
    // Get application seed
    var appSeedPath = path.join(process.env.PWD, cfgSettings.seedFilename),
        encData = fs.readFileSync(appSeedPath, {encoding: 'utf8'});

    Object.defineProperty(this, 'seed', {
        get: function () {
            return decryptSeed(new Buffer(encData, 'base64'));
        }
    });

    Object.defineProperty(this, 'walletPsw', {
        get: function () {
            //noinspection JSPotentiallyInvalidUsageOfThis
            var seed = this.seed,
                seedLength = seed.length,
                pswLength = seedLength < cfgSettings.walletPswLength ? seedLength : cfgSettings.walletPswLength,
                psw = new Buffer(pswLength);

            for (let idx = 0; idx < pswLength; idx++) {
                psw[idx] = seed[idx % 2 == 0 ? idx / 2 : seedLength - Math.floor(idx / 2) - 1]
            }

            return psw;
        }
    });

    if (! isSeedValid(this.seed)) {
        throw new Error('Application seed does not match seed currently recorded onto the database');
    }

    // Get crypto network
    this.cryptoNetworkName = cfgSettings.cryptoNetwork;
    this.cryptoNetwork = bitcoinLib.networks[this.cryptoNetworkName];

    if (this.cryptoNetwork == undefined) {
        throw new Error('Invalid/unknown crypto network: ' + this.cryptoNetworkName);
    }

    this.waitingBitcoinCoreRescan = false;
}


// Public Application object methods
//

Application.prototype.setWaitingBitcoinCoreRescan = function (waiting) {
    if (waiting == undefined) {
        waiting = true;
    }
    
    this.waitingBitcoinCoreRescan = waiting;
};

Application.prototype.getWaitingBitcoinCoreRescan = function () {
    return this.waitingBitcoinCoreRescan;
};

Application.prototype.isBitcoinCoreReady = function () {
    return !this.waitingBitcoinCoreRescan;
};

// Application function class (public) methods
//

Application.initialize = function () {
    // Instantiate App object
    Catenis.application = new Application();
};


// Application function class (public) properties
//

Application.exitCode = Object.freeze({
});


// Application function class (public) properties
//


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
    // Calculate seed HMAC
    var seedHmac = crypto.createHmac('sha256', seed).update('This is it: Catenis App seed', 'utf8').digest('base64');

    // Compare with seedHash on the database
    var docApp = Catenis.db.collection.Application.find({}, {fields: {seedHmac: 1}}).fetch()[0],
        isValid = false;

    if (docApp.seedHmac !== null) {
        // Check if seed HMAC matches the seed HMAC on the database
        if (docApp.seedHmac === seedHmac) {
            isValid = true;
        }
    }
    else {
        // Application seed not yet defined. Save seed HMAC onto database
        //  and indicate that it is valid
        Catenis.db.collection.Application.update({_id: docApp._id}, {$set: {seedHmac: seedHmac}});
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

Catenis.module.Application = Object.freeze(Application);
