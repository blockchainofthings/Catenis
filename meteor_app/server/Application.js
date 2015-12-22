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

var config = Npm.require('config');
var path = Npm.require('path');
var fs = Npm.require('fs');
var crypto = Npm.require('crypto');

var appConfig = config.get('application'),
    appSeedFilenameConfig = appConfig.get('seedFilename');

// Definition of Application function class
function Application() {
    // Get application seed
    var appSeedPath = path.join(process.env.PWD, appSeedFilenameConfig),
        encData = fs.readFileSync(appSeedPath, {encoding: 'utf8'});

    this.seed = decryptSeed(new Buffer(encData, 'base64')).toString();

    // Receives a buffer with the ciphered seed data,
    //  and returns a buffer with the deciphered data
    function decryptSeed (encData) {
        var x = [ 83, 84, 78, 106, 77, 72, 82, 76, 100, 68, 78, 117, 77, 84, 85, 106, 78, 122, 99, 61],
            dec = crypto.createDecipher('des-ede3-cbc', (new Buffer((new Buffer(x)).toString(), 'base64')).toString());

        var decBuf1 = dec.update(encData),
            decBuf2 = dec.final();

        return Buffer.concat([decBuf1, decBuf2]);
    }
}

Application.initialize = function () {
    // Instantiate App object
    Catenis.App = new Application();
};

// Save module function class reference
if (typeof Catenis === 'undefined')
    Catenis = {};

if (typeof Catenis.module === 'undefined')
    Catenis.module = {};

Catenis.module.Application = Application;
