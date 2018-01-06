/**
 * Created by claudio on 29/12/15.
 */

//console.log('[Database.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
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
                    billingMode: 1
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
                    source: 1
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
                    sentDate: 1
                },
                opts: {
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
                    sparse: true,
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            },
            {
                fields: {
                    firstReadDate: 1
                },
                opts: {
                    sparse: true,
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
            },
            {
                fields: {
                    readConfirmed: 1
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
                    replacedByTxid: 1
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
                    'info.creditServiceAccount.clientId': 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            },
            {
                fields: {
                    'info.readConfirmation.serializedTx.inputs.txid': 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            },
            {
                fields: {
                    'info.sendMessage.originDeviceId': 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            },
            {
                fields: {
                    'info.sendMessage.targetDeviceId': 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            },
            {
                fields: {
                    'info.logMessage.deviceId': 1
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
                    'info.sysFunding.fundAddresses.path': 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            },
            {
                fields: {
                    'info.bcotPayment.clientId': 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            },
            {
                fields: {
                    'info.creditServiceAccount.clientId': 1
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
                    'info.readConfirmation.spentReadConfirmTxOuts.txid': 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            },
            {
                fields: {
                    'info.sendMessage.originDeviceId': 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            },
            {
                fields: {
                    'info.sendMessage.targetDeviceId': 1
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
        },
        Permission: {
            indices: [{
                fields: {
                    event: 1,
                    subjectEntityType: 1,
                    subjectEntityId: 1,
                    level: 1,
                    objectEntityId: 1
                },
                opts: {
                    unique: true,
                    sparse: true,
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            }, {
                fields: {
                    event: 1
                },
                opts: {
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            }, {
                fields: {
                    subjectEntityType: 1
                },
                opts: {
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            }, {
                fields: {
                    subjectEntityId: 1
                },
                opts: {
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            }, {
                fields: {
                    level: 1
                },
                opts: {
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            }, {
                fields: {
                    objectEntityId: 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            }]
        },
        Asset: {
            indices: [{
                fields: {
                    assetId: 1
                },
                opts: {
                    unique: true,
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            }, {
                fields: {
                    ccAssetId: 1
                },
                opts: {
                    unique: true,
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            }, {
                fields: {
                    type: 1
                },
                opts: {
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            }, {
                fields: {
                    name: 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            }, {
                fields: {
                    issuingType: 1
                },
                opts: {
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            }, {
                fields: {
                    entityId: 1
                },
                opts: {
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            }, {
                fields: {
                    addrPath: 1
                },
                opts: {
                    unique: true,
                    sparse: true,
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            }, {
                fields: {
                    createdDate: 1
                },
                opts: {
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            }]
        },
        BcotExchangeRate: {
            indices: [{
                fields: {
                    exchangeRate: 1
                },
                opts: {
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            }, {
                fields: {
                    date: -1
                },
                opts: {
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            }, {
                fields: {
                    createdDate: 1
                },
                opts: {
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            }]
        },
        Billing: {
            indices: [{
                fields: {
                    type: 1
                },
                opts: {
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            }, {
                fields: {
                    clientId: 1
                },
                opts: {
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            }, {
                fields: {
                    deviceId: 1
                },
                opts: {
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            }, {
                fields: {
                    billingMode: 1
                },
                opts: {
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            }, {
                fields: {
                    service: 1
                },
                opts: {
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            }, {
                fields: {
                    serviceDate: 1
                },
                opts: {
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            }, {
                fields: {
                    'serviceTx.txid': 1
                },
                opts: {
                    unique: true,
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            }, {
                fields: {
                    'serviceTx.complementaryTx.txid': 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            }, {
                fields: {
                    'servicePaymentTx.txid': 1
                },
                opts: {
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            }, {
                fields: {
                    'servicePaymentTx.confirmed': 1
                },
                opts: {
                    background: true,
                    safe: true      // Should be replaced with 'w: 1' for newer mongodb drivers
                }
            }, {
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

//** Temporary method used to fix Message collection by adding new readConfirmationEnabled field
Database.fixMessageAddReadConfirmationEnabledField = function () {
    // Identify send message docs/recs in which readConfirmationEnabled field in missing
    const sentTxids = [];
    const rcvdTxids = [];

    Catenis.db.collection.Message.find({
        action: 'send',
        readConfirmationEnabled: {
            $exists: false
        }
    }, {
        fields: {
            _id: 1,
            source: 1,
            'blockchain.txid': 1
        }
    }).forEach((doc) => {
        if (doc.source === 'local') {
            sentTxids.push(doc.blockchain.txid);
        }
        else {
            rcvdTxids.push(doc.blockchain.txid);
        }
    });

    Catenis.logger.DEBUG('>>>>>> SentTransaction DB collection docs found', {
        sentTxids: sentTxids
    });
    Catenis.logger.DEBUG('>>>>>> ReceivedTransaction DB collection docs found', {
        sentTxids: rcvdTxids
    });

    const readConfirmTxids = [];
    const noReadConfirmTxids = [];

    if (sentTxids.length > 0) {
        Catenis.db.collection.SentTransaction.find({
            txid: {
                $in: sentTxids
            }
        }, {
            txid: 1,
            'info.sendMessage.readConfirmation': 1
        }).forEach((doc) => {
            if (doc.info.sendMessage.readConfirmation !== undefined) {
                readConfirmTxids.push(doc.txid);
            }
            else {
                noReadConfirmTxids.push(doc.txid);
            }
        });
    }

    if (rcvdTxids.length > 0) {
        Catenis.db.collection.ReceivedTransaction.find({
            txid: {
                $in: rcvdTxids
            }
        }, {
            txid: 1,
            'info.sendMessage.readConfirmation': 1
        }).forEach((doc) => {
            if (doc.info.sendMessage.readConfirmation !== undefined) {
                readConfirmTxids.push(doc.txid);
            }
            else {
                noReadConfirmTxids.push(doc.txid);
            }
        });
    }

    Catenis.logger.DEBUG('>>>>>> Message DB collection docs to update', {
        readConfirmTxids: readConfirmTxids,
        noReadConfirmTxids: noReadConfirmTxids
    });

    let numUpdatedDocs = 0;

    if (readConfirmTxids.length > 0) {
        numUpdatedDocs += Catenis.db.collection.Message.update({
            'blockchain.txid': {
                $in: readConfirmTxids
            }
        }, {
            $set: {
                readConfirmationEnabled: true
            }
        }, {
            multi: true
        });
    }

    if (noReadConfirmTxids.length > 0) {
        numUpdatedDocs += Catenis.db.collection.Message.update({
            'blockchain.txid': {
                $in: readConfirmTxids
            }
        }, {
            $set: {
                readConfirmationEnabled: false
            }
        }, {
            multi: true
        });
    }

    if (numUpdatedDocs > 0) {
        Catenis.logger.INFO('****** Number of Message DB collection docs updated to add readConfirmationEnabled field: %d', numUpdatedDocs);
    }
};

//** Temporary method used to fill new billingMode field of Client docs/recs
import { Client } from '/imports/server/Client';

Database.fillClientBillingModeField = function () {
    const numUpdatedDocs = Catenis.db.collection.Client.update({
        billingMode: {
            $exists: false
        }
    }, {
        $set: {
            billingMode: Client.billingMode.prePaid
        }
    }, {
        multi: true
    });

    if (numUpdatedDocs > 0) {
        Catenis.logger.INFO('****** Number of Client DB collection docs updated to fill new billingMode field: %d', numUpdatedDocs);
    }
};

//** Temporary method used to fix indices of SentTransaction collection
//   - index on replacedByTxid changed to be made NOT unique
import Future from 'fibers/future';

Database.fixSentTransactionReplacedByTxidIndex = function () {
    let indicesChanged = false;
    const fut1 = new Future();

    Catenis.db.mongoCollection.SentTransaction.indexes(function (error, indices) {
        if (!error) {
            const replacedByTxidIndex = indices.find((index) => {
                const keyFields = Object.keys(index.key);

                return keyFields.length === 1 && keyFields[0] === 'replacedByTxid';
            });

            if (replacedByTxidIndex) {
                if (replacedByTxidIndex.unique) {
                    // Index currently has the unique constraint.
                    //  So remove it and reinsert it
                    // noinspection JSIgnoredPromiseFromCall
                    Catenis.db.mongoCollection.SentTransaction.dropIndex(replacedByTxidIndex.name, function (error) {
                        if (!error) {
                            // Insert index
                            // noinspection JSUnusedLocalSymbols, JSIgnoredPromiseFromCall
                            Catenis.db.mongoCollection.SentTransaction.ensureIndex({
                                replacedByTxid: 1
                            }, {
                                sparse: true,
                                background: true,
                                safe: true
                            }, function (error, indexName) {
                                if (!error) {
                                    Catenis.logger.INFO('****** Index on replacedByTxid field of SentTransaction DB collection has been fixed');
                                    indicesChanged = true;
                                    fut1.return();
                                }
                                else {
                                    // Error trying to insert index. Log error and throw exception
                                    Catenis.logger.ERROR('Error trying to insert fixed index on replacedByTxid field of SentTransaction DB collection.', error);
                                    throw new Error('Error trying to insert fixed index on replacedByTxid field of SentTransaction DB collection');
                                }
                            })
                        }
                        else {
                            // Error trying to remove index. Log error and throw exception
                            Catenis.logger.ERROR('Error trying to remove index on replacedByTxid field of SentTransaction DB collection.', error);
                            throw new Error('Error trying to remove index on replacedByTxid field of SentTransaction DB collection');
                        }
                    })
                }
                else {
                    fut1.return();
                }
            }
            else {
                fut1.return();
            }
        }
        else {
            // Error retrieving indices. Log error
            Catenis.logger.ERROR('Error retrieving indices from SentTransaction DB collection.', error);
            throw new Error('Error retrieving indices from SentTransaction DB collection');
        }
    });

    fut1.wait();

    if (indicesChanged) {
        const fut2 = new Future();

        // Reindex collection
        // noinspection JSIgnoredPromiseFromCall, JSUnusedLocalSymbols
        Catenis.db.mongoCollection.SentTransaction.reIndex(function (error, result) {
            if (!error) {
                Catenis.logger.INFO('****** SentTransaction DB collection successfully reindexed.');
                fut2.return();
            }
            else {
                Catenis.logger.ERROR('Error trying to reindex SentTransaction collection.', error);
                throw new Error('Error trying to reindex SentTransaction collection');
            }
        });

        fut2.wait();
    }
};


// Module functions used to simulate private Database object methods
//  NOTE: these functions need to be bound to a Database object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

function initApplication() {
    // Make sure that Application collection has ONE and only one doc/rec
    const docApps = this.collection.Application.find({}, {fields: {_id: 1}}).fetch();

    if (docApps.length === 0) {
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

    if (docCtnNodes.length === 0) {
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
        else if (docCtnNodes[0].ctnNodeIndex !== ctnHubNodeIndex) {
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
