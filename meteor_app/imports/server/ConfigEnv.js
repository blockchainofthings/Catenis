/**
 * Created by Claudio on 2017-01-27.
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
