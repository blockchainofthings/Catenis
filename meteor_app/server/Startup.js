/**
 * Created by claudio on 25/11/15.
 */

//console.log('[Startup.js]: This code just ran.');

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

// Initialization code (on the server)
Meteor.startup(function () {
    console.log('Starting initializaton...');
    Catenis.module.DB.inititalize();
    Catenis.module.Application.initialize();
    Catenis.module.KeyStore.initialize();
    console.log('Initialization ended.');
});