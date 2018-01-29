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
                    'info.spendServiceCredit.clientIds': 1
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
                    'info.bcotPayment.bcotPayAddressPath': 1
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

//** Temporary method used to add missing 'encSentFromAddress' and 'bcotPayAddressPath' fields
//   from info property of ReceivedTransaction docs/recs of type 'bcot_payment'
import { BcotPaymentTransaction } from './BcotPaymentTransaction';
import { BcotPayment } from './BcotPayment';

Database.fixReceivedTransactionBcotPaymentInfo = function () {
    let numUpdatedDocs = 0;

    // Retrieve received bcot payment transaction doc/recs the 'encSentFromAddress' field of which
    //  is missing from its info property
    Catenis.db.collection.ReceivedTransaction.find({
        type: 'bcot_payment',
        $or: [{
            'info.bcotPayment.encSentFromAddress': {
                $exists: false
            }
        }, {
            'info.bcotPayment.bcotPayAddressPath': {
                $exists: false
            }
        }]
    }, {
        fields: {
            txid: 1,
            info: 1
        }
    }).forEach((doc) => {
        const bcotPayTransact = BcotPaymentTransaction.checkTransaction(doc.txid);

        if (bcotPayTransact !== undefined) {
            const bcotPayAddrInfo = Catenis.keyStore.getAddressInfo(bcotPayTransact.payeeAddress);

            // Update ReceivedTransaction doc/rec
            const modifier = {
                $set: {}
            };

            if (doc.info.bcotPayment.encSentFromAddress === undefined) {
                modifier.$set['info.bcotPayment.encSentFromAddress'] = BcotPayment.encryptSentFromAddress(bcotPayTransact.payingAddress, bcotPayAddrInfo);
            }

            if (doc.info.bcotPayment.bcotPayAddressPath === undefined) {
                modifier.$set['info.bcotPayment.bcotPayAddressPath'] = bcotPayAddrInfo.path;
            }

            numUpdatedDocs += Catenis.db.collection.ReceivedTransaction.update({
                _id: doc._id
            }, modifier);
        }
    });

    if (numUpdatedDocs > 0) {
        Catenis.logger.INFO('****** Number of ReceivedTransaction DB collection docs updated to add missing \'info.bcotPayment.encSentFromAddress\' and/or \'info.bcotPayment.bcotPayAddressPath\' field: %d', numUpdatedDocs);
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
