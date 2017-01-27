/**
 * Created by claudio on 27/01/17.
 */

//console.log('[!ConfigEnv.js]: This code just ran.');

// Module code
//

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
    process.env.NODE_CONFIG_DIR = require('path').join(process.env.PWD, 'config');
}

// NOTE: the solution below MUST NOT be used because it changes the
//  native type objects (like Number) so argument validation for some
//  Meteor functions including arguments of those types (e.g. collection.find({},{limit:1})
//  will ALWAYS FAIL. As a workaround, selective pollyfills are manually
//  included (see following lines).
//
// Add ECMAScript-2015 (ES6) features to objects globally
//require('babel-polyfill');

// Pollyfills to add missing ECMAScript-2015 (ES6) features that are
//  being used throughout the code
