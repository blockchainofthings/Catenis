/**
 * Created by claudio on 29/12/15.
 */

//console.log('[Database.js]: This code just ran.');

// Module variables
//

import { ctnHubNodeIndex } from './Application.js';

// Definition of function classes
//

// Database function class
function Database(collections) {
    this.collection = {};
    this.mongoCollection = {};

    var initFuncs = [];

    for (let collName in collections) {
        let collection = collections[collName];

        // Create the collection
        this.collection[collName] = new Mongo.Collection(collName);
        let thisMongoCollection = this.mongoCollection[collName] = this.collection[collName].rawCollection();

        // Create indices for the collection
        if ('indices' in collection) {
            let createIndex = Meteor.wrapAsync(thisMongoCollection.ensureIndex, thisMongoCollection);

            collection.indices.forEach(function (index) {
                let args = [index.fields];

                if ('opts' in index) {
                    args.push(index.opts);
                }

                createIndex.apply(thisMongoCollection, args);
            });
        }

        // Save initialization function to be called later
        if ('initFunc' in collection) {
            initFuncs.push(collection.initFunc);
        }
    }

    // Initialize the collections as needed
    var self = this;
    
    initFuncs.forEach(function (initFunc) {
        initFunc.call(self);
    });
}


// Database function class (public) methods
//

Database.inititalize = function() {
    var collections = {
        Application: {
            initFunc: initApplication
        },
        IssuedCatenisHubAddress: {
            indices: [{
                fields: {
                    type: 1,
                    addrIndex: 1
                },
                opts: {
                    unique: true,
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            },
            {
                fields: {
                    addrIndex: 1
                },
                opts: {
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            },
            {
                fields: {
                    path: 1
                },
                opts: {
                    unique: true,
                    sparse: true,
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            },
            {
                fields: {
                    issuedDate: 1
                },
                opts: {
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            },
            {
                fields: {
                    expirationDate: 1
                },
                opts: {
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            },
            {
                fields: {
                    status: 1
                },
                opts: {
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            },
            {
                fields: {
                    lastStatusChangedDate: 1
                },
                opts: {
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            }]
        },
        CatenisNode: {
            indices: [{
                fields: {
                    ctnNodeIndex: 1
                },
                opts: {
                    unique: true,
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            },
            {
                fields: {
                    createdDate: 1
                },
                opts: {
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            }],
            initFunc: initCatenisNode
        },
        Client: {
            indices: [{
                fields: {
                    user_id: 1
                },
                opts: {
                    unique: true,
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            },
            {
                fields: {
                    catenisNode_id: 1
                },
                opts: {
                    unique: true,
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            },
            {
                fields: {
                    clientId: 1
                },
                opts: {
                    unique: true,
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            },
            {
                fields: {
                    clientIndex: 1
                },
                opts: {
                    unique: true,
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            },
            {
                fields: {
                    'props.lastModifiedDate': 1
                },
                opts: {
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            },
            {
                fields: {
                    createdDate: 1
                },
                opts: {
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            }]
        },
        Device: {
            indices: [{
                fields: {
                    client_id: 1
                },
                opts: {
                    unique: true,
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            },
            {
                fields: {
                    deviceId: 1
                },
                opts: {
                    unique: true,
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            },
            {
                fields: {
                    'index.clientIndex': 1,
                    'index.deviceIndex': 1
                },
                opts: {
                    unique: true,
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            },
            {
                fields: {
                    'props.productId': 1
                },
                opts: {
                    unique: true,
                    sparce: true,
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            },
            {
                fields: {
                    createdDate: 1
                },
                opts: {
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            }]
        }
    };

    Catenis.db = new Database(collections);
};


// Module functions used to simulate private Database object methods
//  NOTE: these functions need to be bound to a Database object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

function initApplication() {
    // Make sure that Application collection has ONE and only one doc/rec
    var docApps = this.collection.Application.find({}, {fields: {_id: 1}}).fetch();

    if (docApps.length == 0) {
        // No doc/rec defined yet. Create new doc/rec with default settings
        this.collection.Application.insert({
            seedHash: null,   // Hash of application seed - not yet defined
        });
    }
    else if (docApps.length > 1) {
        // More than one doc/rec found. Delete all docs/recs except the first one
        this.collection.Application.remove({_id: {$ne: docApps[0]._id}});
    }
}

function initCatenisNode() {
    // Make sure that Catenis Hub doc/rec is already created
    var docCtnNodes = this.collection.CatenisNode.find({type: 'hub'}, {fields: {_id: 1, ctnNodeIndex: 1}}).fetch();

    if (docCtnNodes.length == 0) {
        // No doc/rec defined yet. Create new doc/rec with default settings
        this.collection.CatenisNode.insert({
            type: 'hub',
            ctnNodeIndex: ctnHubNodeIndex,
            createdDate: new Date()
        })
    }
    else {
        // Check consistency of current doc/rec
        if (docCtnNodes.length > 1) {
            Catenis.logger.ERROR('More than one Catenis Hub node database doc/rec found');
            throw new Error('More than one Catenis Hub node database doc/rec found');
        }
        else if (docCtnNodes[0].ctnNodeIndex != ctnHubNodeIndex) {
            Catenis.logger.ERROR('Catenis Hub node database doc/rec with inconsistent index', {docIndex: docCtnNodes[0].ctnNodeIndex, definedIndex: ctnHubNodeIndex});
            throw new Error('Catenis Hub node database doc/rec with inconsistent index');
        }
    }
}


// Definition of module (private) functions
//


// Module code
//

// Save module function class reference
if (typeof Catenis === 'undefined')
    Catenis = {};

if (typeof Catenis.module === 'undefined')
    Catenis.module = {};

Catenis.module.DB = Object.freeze(Database);
