/**
 * Created by claudio on 29/12/15.
 */

//console.log('[Database.js]: This code just ran.');

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


// Definition of function classes
//

// DB function class
function DB() {
}


// DB function class (public) properties
//

// Database collection references
DB.Application = new Mongo.Collection('Application');


// DB function class (public) methods
//

DB.inititalize = function() {
    setApplicationDocument();

    // Make sure that Application collection has ONE document
    function setApplicationDocument() {
        var app = DB.Application.find({}, {fields: {_id: 1}}).fetch();

        if (app.length == 0) {
            // No document defined yet. Create new document with default
            //  settings
            DB.Application.insert({
                seedHash: null,   // Hash of application seed - not yet defined
            });
        }
        else if (app.length > 1) {
            // More than one document found. Delete all documents except the first one
            DB.Application.remove({_id: {$ne: app[0]._id}});
        }
    };
};


// Module code
//

// Save module function class reference
if (typeof Catenis === 'undefined')
    Catenis = {};

if (typeof Catenis.module === 'undefined')
    Catenis.module = {};

Catenis.module.DB = DB;
