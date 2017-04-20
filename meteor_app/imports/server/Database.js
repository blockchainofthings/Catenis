/**
 * Created by claudio on 29/12/15.
 */

//console.log('[Database.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//  NOTE: the reference of these modules are done sing 'require()' instead of 'import' to
//      to avoid annoying WebStorm warning message: 'default export is not defined in
//      imported module'
//const util = require('util');
// Third-party node modules
//import config from 'config';
// Meteor packages
import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { ctnHubNodeIndex } from './Application';
import { CatenisNode } from './CatenisNode';


// Definition of function classes
//

// Database function class
export function Database(collections) {
    this.collection = {};
    this.mongoCollection = {};

    const initFuncs = [];

    for (let collName in collections) {
        //noinspection JSUnfilteredForInLoop
        const collection = collections[collName];

        // Create the collection
        //noinspection JSUnfilteredForInLoop
        this.collection[collName] = new Mongo.Collection(collName);
        //noinspection JSUnfilteredForInLoop
        let thisMongoCollection = this.mongoCollection[collName] = this.collection[collName].rawCollection();

        // Create indices for the collection
        if ('indices' in collection) {
            let createIndex = Meteor.wrapAsync(thisMongoCollection.ensureIndex, thisMongoCollection);

            collection.indices.forEach((index) => {
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
    initFuncs.forEach((initFunc) => {
        initFunc.call(this);
    });
}


// Database function class (public) methods
//

Database.initialize = function() {
    Catenis.logger.TRACE('DB initialization');
    const collections = {
        Application: {
            initFunc: initApplication
        },
        BitcoinFees: {
            indices: [{
                fields: {
                    createdDate: 1
                },
                opts: {
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            }]
        },
        IssuedBlockchainAddress: {
            indices: [{
                fields: {
                    type: 1
                },
                opts: {
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            },
            {
                fields: {
                    parentPath: 1,
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
                    parentPath: 1
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
                    addrHash: 1
                },
                opts: {
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
                    status: 1
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
            },
            {
                fields: {
                    lastStatusChangedDate: 1
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
                    sparse: true,
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            },
            {
                fields: {
                    catenisNode_id: 1
                },
                opts: {
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
                    'index.ctnNodeIndex': 1,
                    'index.clientIndex': 1
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
                    status: 1
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
            },
            {
                fields: {
                    lastStatusChangedDate: 1
                },
                opts: {
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            },
            {
                fields: {
                    lastApiAccessGenKeyModifiedDate: 1
                },
                opts: {
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            }]
        },
        ServiceCredit: {
            indices: [{
                fields: {
                    client_id: 1
                },
                opts: {
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            },
            {
                fields: {
                    srvCreditType: 1
                },
                opts: {
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            },
            {
                fields: {
                    'fundingTx.txid': 1
                },
                opts: {
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            },
            {
                fields: {
                    'fundingTx.confirmed': 1
                },
                opts: {
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            },
            {
                fields: {
                    remainCredits: 1
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
            },
            {
                fields: {
                    lastCreditUpdatedDate: 1
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
                    'index.ctnNodeIndex': 1,
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
                    'props.prodUniqueId': 1
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
                    'props.lastModifiedDate': 1
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
                    createdDate: 1
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
            },
            {
                fields: {
                    lastApiAccessGenKeyModifiedDate: 1
                },
                opts: {
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            }]
        },
        Message: {
            indices: [{
                fields: {
                    messageId: 1
                },
                opts: {
                    unique: true,
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for new mongodb drivers
                }
            },
            {
                fields: {
                    action: 1
                },
                opts: {
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            },
            {
                fields: {
                    originDeviceId: 1
                },
                opts: {
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            },
            {
                fields: {
                    targetDeviceId: 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            },
            {
                fields: {
                    'blockchain.txid': 1
                },
                opts: {
                    unique: true,
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            },
            {
                fields: {
                    'blockchain.confirmed': 1
                },
                opts: {
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            },
            {
                fields: {
                    'externalStorage.provider': 1,
                    'externalStorage.reference': 1
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
                    createdDate: 1
                },
                opts: {
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            },
            {
                fields: {
                    lastReadDate: 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            }]
        },
        SentTransaction: {
            indices: [{
                fields: {
                    type: 1
                },
                opts: {
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            },
            {
                fields: {
                    txid: 1
                },
                opts: {
                    unique: true,
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            },
            {
                fields: {
                    'inputs.txid': 1
                },
                opts: {
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            },
            {
                fields: {
                    'inputs.str': 1
                },
                opts: {
                    //unique: true,
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            },
            {
                fields: {
                    sentDate: 1
                },
                opts: {
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            },
            {
                fields: {
                    'confirmation.confirmed': 1
                },
                opts: {
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            },
            {
                fields: {
                    'confirmation.confirmationDate': 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            },
            {
                fields: {
                    'replacedByTxid': 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            },
            {
                fields: {
                    'info.readConfirmation.txouts.txid': 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            }]
        },
        ReceivedTransaction: {
            indices: [{
                fields: {
                    type: 1
                },
                opts: {
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            },
            {
                fields: {
                    txid: 1
                },
                opts: {
                    unique: true,
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            },
            {
                fields: {
                    'inputs.txid': 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            },
            {
                fields: {
                    'inputs.str': 1
                },
                opts: {
                    //unique: true,
                    sparse: true,
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            },
            {
                fields: {
                    receivedDate: 1
                },
                opts: {
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            },
            {
                fields: {
                    sentTransaction_id: 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            },
            {
                fields: {
                    'confirmation.confirmed': 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            },
            {
                fields: {
                    'confirmation.confirmationDate': 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            },
            {
                fields: {
                    'info.sendMessage.readConfirmation.spent': 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            },
            {
                fields: {
                    'info.readConfirmation.txouts.txid': 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            }]
        },
        Malleability: {
            indices: [{
                fields: {
                    source: 1
                },
                opts: {
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            },
            {
                fields: {
                    originalTxid: 1
                },
                opts: {
                    unique: true,
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            },
            {
                fields: {
                    modifiedTxid: 1
                },
                opts: {
                    unique: true,
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            }]
        }
    };

    Catenis.db = new Database(collections);
};

// TODO: To run the two methods below, do the following:
// TODO: a) After upgrading the Catenis application, restart it in ProcessBypass mode.
// TODO: b) Then, from meteor shell, import {Database} and execute the Database.initialize() method.
// TODO: c) Execute the two methods below in sequence.
// TODO: d) Read todo entries below for things to do after these methods are executed.

// This method is only needed to make changes to the database for the malleability fix.
//  It can (should) be removed after it is used
Database.fixSentTransactionInputs = function () {
    Catenis.db.collection.SentTransaction.find({'inputs.str': {$exists: false}}, {fields: {_id:1, inputs:1}}).forEach((doc) => {
        doc.inputs = doc.inputs.map((input) => {
            input.str = input.txid + ':' + input.vout;
            return input;
        });

        Catenis.db.collection.SentTransaction.update({_id: doc._id}, {$set: {inputs: doc.inputs}});
    })
};

// This method is only needed to make changes to the database for the malleability fix.
//  It can (should) be removed after it is used
Database.fixMessageConfirmedTxid = function () {
    Catenis.db.collection.Message.find({'blockchain.confirmed': {$exists: false}}, {field: {_id:1, blockchain: 1}}).forEach((doc) => {
        doc.blockchain = doc.blockchain.confirmedTxid ? {
            txid: doc.blockchain.confirmedTxid,
            confirmed: true
        } : {
            txid: doc.blockchain.txid,
            confirmed: false
        };

        Catenis.db.collection.Message.update({_id: doc._id}, {$set: {blockchain: doc.blockchain}});
    });
};

// TODO: Things to do after the above methods are successfully executed:
// TODO: a) Leave meteor shell and enter meteor's mongo shell (meteor mongo). Switch to meteor DB (user meteor) and execute commands to:
// TODO:  a.1) drop index 'blockchain.confirmedTxid_1' from Message collection;
// TODO:  a.2) drop index 'fundingTx.txid_1' from ServiceCredit collection (it shall be created later; see step e below);
// TODO:  a.3) drop index 'inputs.str_1' from both SentTransaction and ReceivedTransaction collections (it shall be created later; see step e below).
// TODO: b) Leave mongo shell and stop the Catenis application.
// TODO: c) Edit this file and uncomment the 'unique' entry for index 'inputs.str' of collections SentTransaction and ReceivedTransaction.
// TODO: d) Restart the Catenis application in ProcessBypass mode.
// TODO: e) Then, from meteor shell, import {Database} and execute the Database.initialize() method. This will recreate the indices that needed to be update (and that had been deleted in steps a.2 and a.3 above).
// TODO: E) Stop the Catenis application and restart it normally

// Module functions used to simulate private Database object methods
//  NOTE: these functions need to be bound to a Database object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

function initApplication() {
    // Make sure that Application collection has ONE and only one doc/rec
    const docApps = this.collection.Application.find({}, {fields: {_id: 1}}).fetch();

    if (docApps.length == 0) {
        // No doc/rec defined yet. Create new doc/rec with default settings
        this.collection.Application.insert({
            seedHmac: null   // HMAC used to validate the application seed - not yet defined
        });
    }
    else if (docApps.length > 1) {
        // More than one doc/rec found. Delete all docs/recs except the first one
        this.collection.Application.remove({_id: {$ne: docApps[0]._id}});
    }
}

function initCatenisNode() {
    // Make sure that Catenis Hub doc/rec is already created
    const docCtnNodes = this.collection.CatenisNode.find({type: CatenisNode.nodeType.hub.name}, {fields: {_id: 1, ctnNodeIndex: 1}}).fetch();

    if (docCtnNodes.length == 0) {
        // No doc/rec defined yet. Create new doc/rec with default settings
        this.collection.CatenisNode.insert({
            type: CatenisNode.nodeType.hub.name,
            ctnNodeIndex: ctnHubNodeIndex,
            props: {
                name: 'Catenis Hub',
                description: 'Central Catenis node used to house clients that access the system through the Internet'
            },
            status: CatenisNode.status.active.name,
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

// Lock function class
Object.freeze(Database);
