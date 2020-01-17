/**
 * Created by Claudio on 2015-12-29.
 */

//console.log('[Database.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import config from 'config';
// Meteor packages
import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { ctnHubNodeIndex } from './Application';
import { CatenisNode } from './CatenisNode';
import { conformStrIdField } from './License';

// Config entries
const dbConfig = config.get('database');

// Configuration settings
const cfgSettings = {
    defaultBcotPrice: dbConfig.get('defaultBcotPrice'),
    defaultLicenses: dbConfig.get('defaultLicenses'),
    defaultBcotProducts: dbConfig.get('defaultBcotProducts')
};


// Definition of function classes
//

// Database function class
export function Database(collections) {
    this.collection = {};
    this.mongoCollection = {};
    this.mongoDb = undefined;

    const initFuncs = [];

    for (let collName in collections) {
        //noinspection JSUnfilteredForInLoop
        const collection = collections[collName];

        // Create the collection
        //noinspection JSUnfilteredForInLoop
        this.collection[collName] = new Mongo.Collection(collName);
        //noinspection JSUnfilteredForInLoop
        const thisMongoCollection = this.mongoCollection[collName] = this.collection[collName].rawCollection();

        if (!this.mongoDb) {
            // noinspection JSUnfilteredForInLoop
            this.mongoDb = this.collection[collName].rawDatabase();
        }

        let createIndex;
        let dropIndex;

        // Make sure that (old) indices containing the 'safe' property are removed so they
        //  can be re-created without that property
        dropSafeIndices(thisMongoCollection);

        // Create indices for the collection
        if ('indices' in collection) {
            collection.indices.forEach((index) => {
                let args = [index.fields];

                if ('opts' in index) {
                    args.push(index.opts);
                }

                let tryAgain;

                if (!createIndex) {
                    createIndex = Meteor.wrapAsync(thisMongoCollection.createIndex, thisMongoCollection);
                }

                do {
                    tryAgain = false;

                    try {
                        createIndex.apply(thisMongoCollection, args);
                    }
                    catch (err) {
                        let matchResult;

                        if (err.name === 'MongoError' && (matchResult = err.message.match(/^Index with name: ([^\s].+) already exists with different options$/))) {
                            // Index already exists with a different configuration.
                            //  So delete it and re-create it
                            const indexName = matchResult[1];
                            // noinspection JSUnfilteredForInLoop
                            Catenis.logger.INFO('Fixing index \'%s\' of %s collection', indexName, collName);

                            if (!dropIndex) {
                                dropIndex = Meteor.wrapAsync(thisMongoCollection.dropIndex, thisMongoCollection);
                            }

                            dropIndex(indexName);
                            tryAgain = true;
                        }
                    }
                }
                while (tryAgain);
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
                    w: 1
                }
            }]
        },
        BitcoinPrice: {
            indices: [{
                fields: {
                    referenceDate: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    createdDate: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }]
        },
        BcotPrice: {
            initFunc: initBcotPrice,
            indices: [{
                fields: {
                    createdDate: 1
                },
                opts: {
                    background: true,
                    w: 1
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
                    w: 1
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
                    w: 1
                }
            },
            {
                fields: {
                    parentPath: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            },
            {
                fields: {
                    path: 1
                },
                opts: {
                    unique: true,
                    background: true,
                    w: 1
                }
            },
            {
                fields: {
                    addrIndex: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            },
            {
                fields: {
                    addrHash: 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    w: 1
                }
            },
            {
                fields: {
                    issuedDate: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            },
            {
                fields: {
                    expirationDate: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            },
            {
                fields: {
                    status: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            },
            {
                fields: {
                    lastStatusChangedDate: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }]
        },
        IssuedOffChainAddress: {
            indices: [{
                fields: {
                    type: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    parentPath: 1,
                    addrIndex: 1
                },
                opts: {
                    unique: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    parentPath: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    path: 1
                },
                opts: {
                    unique: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    addrIndex: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    pubKeyHash: 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    issuedDate: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    isNonExistent: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }]
        },
        License: {
            initFunc: initLicense,
            indices: [{
                fields: {
                    level: 1,
                    type: 1,
                    revision: 1
                },
                opts: {
                    unique: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    level: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    order: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    type: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    revision: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    maximumDevices: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    createdDate: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    activatedDate: 1
                },
                opts: {
                    sparse: 1,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    deactivatedDate: 1
                },
                opts: {
                    sparse: 1,
                    background: true,
                    w: 1
                }
            }],
            validator: {
                level: {
                    $type: 'string'
                },
                order: {
                    $type: 'int'
                },
                $or: [{
                    type: {
                        $exists: false
                    }
                }, {
                    type: {
                        $type: 'string'
                    }
                }],
                revision: {
                    $type: 'int'
                }
            }
        },
        ClientLicense: {
            indices: [{
                fields: {
                    client_id: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    license_id: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    'validity.startDate': 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    'validity.endDate': 1
                },
                opts: {
                    sparse: 1,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    status: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    expireRemindNotifySent: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    provisionedDate: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    activatedDate: 1
                },
                opts: {
                    sparse: 1,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    expiredDate: 1
                },
                opts: {
                    sparse: 1,
                    background: true,
                    w: 1
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
                    w: 1
                }
            },
            {
                fields: {
                    status: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            },
            {
                fields: {
                    createdDate: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            },
            {
                fields: {
                    lastStatusChangedDate: 1
                },
                opts: {
                    background: true,
                    w: 1
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
                    w: 1
                }
            }, {
                fields: {
                    catenisNode_id: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    clientId: 1
                },
                opts: {
                    unique: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    'index.ctnNodeIndex': 1,
                    'index.clientIndex': 1
                },
                opts: {
                    unique: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    'props.accountNumber': 1
                },
                opts: {
                    unique: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    'props.lastModifiedDate': 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    billingMode: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    status: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    createdDate: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    lastStatusChangedDate: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    lastApiAccessGenKeyModifiedDate: 1
                },
                opts: {
                    background: true,
                    w: 1
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
                    w: 1
                }
            },
            {
                fields: {
                    deviceId: 1
                },
                opts: {
                    unique: true,
                    background: true,
                    w: 1
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
                    w: 1
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
                    w: 1
                }
            },
            {
                fields: {
                    'props.lastModifiedDate': 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            },
            {
                fields: {
                    status: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            },
            {
                fields: {
                    createdDate: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            },
            {
                fields: {
                    lastStatusChangedDate: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            },
            {
                fields: {
                    lastApiAccessGenKeyModifiedDate: 1
                },
                opts: {
                    background: true,
                    w: 1
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
                    w: 1
                }
            },
            {
                fields: {
                    action: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            },
            {
                fields: {
                    source: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            },
            {
                fields: {
                    originDeviceId: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            },
            {
                fields: {
                    targetDeviceId: 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    w: 1
                }
            },
            {
                fields: {
                    'offChain.msgEnvCid': 1
                },
                opts: {
                    unique: true,
                    sparse: true,
                    background: true,
                    w: 1
                }
            },
            {
                fields: {
                    'blockchain.txid': 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    w: 1
                }
            },
            {
                fields: {
                    'offChain.msgEnvCid': 1,
                    'blockchain.txid': 1
                },
                opts: {
                    unique: true,
                    background: true,
                    w: 1
                }
            },
            {
                fields: {
                    'blockchain.confirmed': 1
                },
                opts: {
                    background: true,
                    w: 1
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
                    w: 1
                }
            },
            {
                fields: {
                    createdDate: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            },
            {
                fields: {
                    sentDate: 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    w: 1
                }
            },
            {
                fields: {
                    receivedDate: 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    w: 1
                }
            },
            {
                fields: {
                    firstReadDate: 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    w: 1
                }
            },
            {
                fields: {
                    lastReadDate: 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    w: 1
                }
            },
            {
                fields: {
                    readConfirmed: 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    w: 1
                }
            }]
        },
        ProvisionalMessage: {
            indices: [{
                fields: {
                    provisionalMessageId: 1
                },
                opts: {
                    unique: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    deviceId: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    'progress.done': 1
                },
                opts: {
                    background: true,
                    sparse: true,
                    w: 1
                }
            }, {
                fields: {
                    'progress.success': 1
                },
                opts: {
                    background: true,
                    sparse: true,
                    w: 1
                }
            }, {
                fields: {
                    'progress.error.code': 1
                },
                opts: {
                    background: true,
                    sparse: true,
                    w: 1
                }
            }, {
                fields: {
                    'progress.error.message': 1
                },
                opts: {
                    background: true,
                    sparse: true,
                    w: 1
                }
            }, {
                fields: {
                    'progress.finishDate': 1
                },
                opts: {
                    background: true,
                    sparse: true,
                    w: 1
                }
            }, {
                fields: {
                    'messageId': 1
                },
                opts: {
                    background: true,
                    sparse: true,
                    w: 1
                }
            }, {
                fields: {
                    createdDate: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }]
        },
        CachedMessage: {
            indices: [{
                fields: {
                    cachedMessageId: 1
                },
                opts: {
                    unique: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    deviceId: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    messageId: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    'progress.done': 1
                },
                opts: {
                    background: true,
                    sparse: true,
                    w: 1
                }
            }, {
                fields: {
                    'progress.success': 1
                },
                opts: {
                    background: true,
                    sparse: true,
                    w: 1
                }
            }, {
                fields: {
                    'progress.error.code': 1
                },
                opts: {
                    background: true,
                    sparse: true,
                    w: 1
                }
            }, {
                fields: {
                    'progress.error.message': 1
                },
                opts: {
                    background: true,
                    sparse: true,
                    w: 1
                }
            }, {
                fields: {
                    'progress.finishDate': 1
                },
                opts: {
                    background: true,
                    sparse: true,
                    w: 1
                }
            }, {
                fields: {
                    'readFinalized': 1
                },
                opts: {
                    background: true,
                    sparse: true,
                    w: 1
                }
            }, {
                fields: {
                    'lastReadDate': 1
                },
                opts: {
                    background: true,
                    sparse: true,
                    w: 1
                }
            }, {
                fields: {
                    createdDate: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }]
        },
        MessageChunk: {
            indices: [{
                fields: {
                    messageChunkId: 1
                },
                opts: {
                    unique: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    type: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    ephemeralMessage_id: 1,
                    order: 1
                },
                opts: {
                    unique: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    ephemeralMessage_id: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    order: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    isFinal: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    createdDate: 1
                },
                opts: {
                    background: true,
                    w: 1
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
                    w: 1
                }
            }, {
                fields: {
                    txid: 1
                },
                opts: {
                    unique: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    sentDate: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    'confirmation.confirmed': 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    'confirmation.confirmationDate': 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    replacedByTxid: 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    'info.creditServiceAccount.clientId': 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    'info.spendServiceCredit.clientIds': 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    'info.readConfirmation.serializedTx.inputs.txid': 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    'info.sendMessage.originDeviceId': 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    'info.sendMessage.targetDeviceId': 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    'info.logMessage.deviceId': 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    'info.issueAsset.assetId': 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    'info.issueAsset.issuingDeviceId': 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    'info.issueAsset.holdingDeviceId': 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    'info.transferAsset.assetId': 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    'info.transferAsset.sendingDeviceId': 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    'info.transferAsset.receivingDeviceId': 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    'info.settleOffChainMessages.offChainMsgDataCids': 1
                },
                opts: {
                    unique: true,
                    sparse: true,
                    background: true,
                    w: 1
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
                    w: 1
                }
            }, {
                fields: {
                    txid: 1
                },
                opts: {
                    unique: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    receivedDate: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    sentTransaction_id: 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    'confirmation.confirmed': 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    'confirmation.confirmationDate': 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    'info.sysFunding.fundAddresses.path': 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    'info.bcotPayment.clientId': 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    'info.bcotPayment.bcotPayAddressPath': 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    'info.creditServiceAccount.clientId': 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    'info.sendMessage.readConfirmation.spent': 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    'info.readConfirmation.spentReadConfirmTxOuts.txid': 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    'info.sendMessage.originDeviceId': 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    'info.sendMessage.targetDeviceId': 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    'info.issueAsset.assetId': 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    'info.issueAsset.issuingDeviceId': 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    'info.issueAsset.holdingDeviceId': 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    'info.transferAsset.assetId': 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    'info.transferAsset.sendingDeviceId': 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    'info.transferAsset.receivingDeviceId': 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    'info.settleOffChainMessages.offChainMsgDataCids': 1
                },
                opts: {
                    unique: true,
                    sparse: true,
                    background: true,
                    w: 1
                }
            }]
        },
        SavedOffChainMsgData: {
            indices: [{
                fields: {
                    dataType: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    msgType: 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    cid: 1
                },
                opts: {
                    unique: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    savedDate: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    'settlement.settled': 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    'settlement.settleOffChainMsgsTxid': 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    'info.msgEnvelope.logMessage.deviceId': 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    'info.msgEnvelope.sendMessage.originDeviceId': 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    'info.msgEnvelope.sendMessage.targetDeviceId': 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    'info.msgReceipt.sendMsgEnvelopeCid': 1
                },
                opts: {
                    unique: true,
                    sparse: true,
                    background: true,
                    w: 1
                }
            }]
        },
        RetrievedOffChainMsgData: {
            indices: [{
                fields: {
                    dataType: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    msgType: 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    cid: 1
                },
                opts: {
                    unique: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    savedDate: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    retrievedDate: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    savedOffChainMsgData_id: 1
                },
                opts: {
                    unique: true,
                    sparse: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    'info.msgEnvelope.logMessage.deviceId': 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    'info.msgEnvelope.sendMessage.originDeviceId': 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    'info.msgEnvelope.sendMessage.targetDeviceId': 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    'info.msgReceipt.sendMsgEnvelopeCid': 1
                },
                opts: {
                    unique: true,
                    sparse: true,
                    background: true,
                    w: 1
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
                    w: 1
                }
            },
            {
                fields: {
                    originalTxid: 1
                },
                opts: {
                    unique: true,
                    background: true,
                    w: 1
                }
            },
            {
                fields: {
                    modifiedTxid: 1
                },
                opts: {
                    unique: true,
                    background: true,
                    w: 1
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
                    w: 1
                }
            }, {
                fields: {
                    event: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    subjectEntityType: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    subjectEntityId: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    level: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    objectEntityId: 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    w: 1
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
                    w: 1
                }
            }, {
                fields: {
                    ccAssetId: 1
                },
                opts: {
                    unique: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    type: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    name: 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    issuingType: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    'issuance.entityId': 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    'issuance.addrPath': 1
                },
                opts: {
                    unique: true,
                    sparse: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    createdDate: 1
                },
                opts: {
                    background: true,
                    w: 1
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
                    w: 1
                }
            }, {
                fields: {
                    clientId: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    deviceId: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    billingMode: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    service: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    serviceDate: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    'serviceTx.txid': 1
                },
                opts: {
                    unique: true,
                    sparse: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    'serviceTx.complementaryTx.txid': 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    'offChainMsgServiceData.msgEnvelope.cid': 1
                },
                opts: {
                    unique: true,
                    sparse: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    'offChainMsgServiceData.msgEnvelope.settlementTx.txid': 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    'offChainMsgServiceData.msgReceipt.cid': 1
                },
                opts: {
                    unique: true,
                    sparse: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    'offChainMsgServiceData.msgReceipt.settlementTx.txid': 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    'servicePaymentTx.txid': 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    'servicePaymentTx.confirmed': 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    createdDate: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }]
        },
        CCMetadataConversion: {
            indices: [{
                fields: {
                    torrentHash: 1
                },
                opts: {
                    unique: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    cid: 1
                },
                opts: {
                    unique: true,
                    background: true,
                    w: 1
                }
            }]
        },
        BcotProduct: {
            initFunc: initBcotProduct,
            indices: [{
                fields: {
                    sku: 1
                },
                opts: {
                    unique: true,
                    sparse: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    active: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    createdDate: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    deactivatedDate: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }]
        },
        BcotSaleAllocation: {
            indices: [{
                fields: {
                    'summary.sku': 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    status: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    allocationDate: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    lastStatusChangedDate: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }]
        },
        BcotSaleAllocationItem: {
            indices: [{
                fields: {
                    bcotSaleAllocation_id: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    sku: 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    purchaseCode: 1
                },
                opts: {
                    unique: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    'redemption.redeemed': 1
                },
                opts: {
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    'redemption.client_id': 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    'redemption.redeemedDate': 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    'redemption.redeemedDate': 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    w: 1
                }
            }, {
                fields: {
                    'redemption.bcotRedeemTxid': 1
                },
                opts: {
                    sparse: true,
                    background: true,
                    w: 1
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
import { OmniTransaction } from './OmniTransaction';

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
        const bcotPayTransact = BcotPaymentTransaction.checkTransaction(OmniTransaction.fromTransaction(Transaction.fromTxid(doc.txid)));

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

//** Temporary method used to remove indices on (non-existent) fields 'entityId' and 'addrPath' of Asset collection
Database.removeInconsistentAssetIndices = function () {
    Catenis.db.mongoCollection.Asset.indexes(function (error, indices) {
        if (!error) {
            const indicesToRemove = indices.filter((index) => {
                const keyFields = Object.keys(index.key);

                return keyFields.length === 1 && (keyFields[0] === 'entityId' || keyFields[0] === 'addrPath');
            });

            indicesToRemove.forEach((index) => {
                Catenis.db.mongoCollection.Asset.dropIndex(index.name, function (error) {
                    if (error) {
                        // Error trying to remove index. Log error and throw exception
                        Catenis.logger.ERROR('Error trying to remove inconsistent index (\'%s\') of Asset DB collection.', index.name,  error);
                        throw new Error('Error trying to remove inconsistent index of Asset DB collection');
                    }

                    Catenis.logger.INFO('****** Inconsistent index (\'%s\') of Asset DB collection successfully removed.', index.name);
                });
            });
        }
        else {
            // Error retrieving indices. Log error
            Catenis.logger.ERROR('Error retrieving indices from Asset DB collection.', error);
            throw new Error('Error retrieving indices from Asset DB collection');
        }
    });
};

//** Temporary method used to remove unused BcotExchangeRate collection
Database.removeBcotExchangeRateColl = function () {
    Catenis.db.mongoDb.collection('BcotExchangeRate', (error, collection) => {
        if (!error) {
            collection.drop((error) => {
                if (!error) {
                    Catenis.logger.INFO('****** Collection BcotExchangeRate successfully removed');
                }
                else {
                    if (error.name !== 'MongoError' || error.message !== 'ns not found') {
                        Catenis.logger.ERROR('Error while removing BcotExchangeRate collection.', error);
                    }
                }
            })
        }
        else {
            Catenis.logger.ERROR('Error while retrieving BcotExchangeRate collection.', error);
        }
    })
};

//** Temporary method used to fix exchange rate value in Billing docs/recs
import BigNumber from 'bignumber.js';

Database.fixBillingExchangeRate = function () {
    let countFixedDocs = 0;

    Catenis.db.collection.Billing.find({
        bitcoinPrice: {
            $exists: false
        },
        bcotPrice: {
            $exists: false
        },
        $and: [{
            exchangeRate: {
                $gt: 0
            }
        }, {
            exchangeRate: {
                $lt: 1
            }
        }]
    }, {
        fields: {
            exchangeRate: 1
        }
    }).fetch().forEach((doc) => {
        // Replace exchange rate wth its inverse value
        Catenis.db.collection.Billing.update({_id: doc._id}, {
            $set: {
                exchangeRate: new BigNumber(1).dividedBy(doc.exchangeRate).decimalPlaces(8, BigNumber.ROUND_HALF_EVEN).toNumber()
            }
        });

        countFixedDocs++;
    });

    if (countFixedDocs > 0) {
        Catenis.logger.INFO('****** Exchange rate value has been fixed for %d Billing docs/recs', countFixedDocs);
    }
};

//** Temporary method used to add time zone field to Client docs/recs
import moment from 'moment-timezone';

Database.addMissingClientTimeZone = function () {
    let countUpdatedDocs = 0;

    // Get ID of Client docs/recs missing time zone field
    const client_ids = Catenis.db.collection.Client.find({
        timeZone: {
            $exists: false
        }
    }, {
        fields: {
            _id: 1
        }
    }).map(doc => doc._id);

    if (client_ids.length > 0) {
        // Add missing time zone field with server's time zone
        const serverTZ = moment.tz.guess();

        countUpdatedDocs += Catenis.db.collection.Client.update({
            _id: {
                $in: client_ids
            }
        }, {
            $set: {
                timeZone: serverTZ
            }
        }, {
            multi: true
        });
    }

    if (countUpdatedDocs > 0) {
        Catenis.logger.INFO('****** Time zone field (with server\'s time zone) has been added to %d Client docs/recs', countUpdatedDocs);
    }
};

//** Temporary method used to add missing btcServicePrice field of Billing collection docs/recs
//import BigNumber from 'bignumber.js';

Database.addMissingBtcServicePriceField = function () {
    let countUpdatedDocs = 0;

    Catenis.db.collection.Billing.find({
        btcServicePrice: {
            $exists: false
        }
    }, {
        fields: {
            _id: 1,
            estimatedServiceCost:1,
            priceMarkup: 1
        }
    }).fetch().forEach((doc) => {
        const btcServicePrice = new BigNumber(doc.estimatedServiceCost).multipliedBy(doc.priceMarkup + 1).decimalPlaces(0, BigNumber.ROUND_HALF_EVEN).toNumber();

        Catenis.db.collection.Billing.update({
            _id: doc._id
        }, {
            $set: {
                btcServicePrice: btcServicePrice
            }
        });

        countUpdatedDocs++;
    });

    if (countUpdatedDocs > 0) {
        Catenis.logger.INFO('****** BTC Service Price field (btcServicePrice) has been added to %d Billing docs/recs', countUpdatedDocs);
    }
};

//** Temporary method used to add missing info omniTxValidity field to some specific doc/recs (depending on the
//    type of transaction) of the SentTransaction and ReceivedTransaction collections
import { Transaction } from './Transaction';

Database.addMissingOmniTxValidityField = function () {
    let countUpdatedDocs = 0;
    
    let orOperands = [];
    
    [Transaction.type.store_bcot, Transaction.type.redeem_bcot].forEach((txType) => {
        const orOperand = {
            type: txType.name
        };
        orOperand[`info.${txType.dbInfoEntryName}.omniTxValidity`] = {
            $exists: false
        };

        orOperands.push(orOperand);
    });

    Catenis.db.collection.SentTransaction.find({
        'confirmation.confirmed': true,
        $or: orOperands
    }, {
        fields: {
            _id: 1,
            type: 1,
            txid: 1
        }
    }).fetch().forEach((doc) => {
        // Retrieve Omni transaction info
        let omniTxInfo;

        try {
            omniTxInfo = Catenis.omniCore.omniGetTransaction(doc.txid);
        }
        catch (err) {
            if ((err instanceof Meteor.Error) && err.error === 'ctn_omcore_rpc_error' && err.details !== undefined && typeof err.details.code === 'number'
                    && err.details.code === OmniCore.rpcErrorCode.RPC_INVALID_ADDRESS_OR_KEY) {
                // Transaction not recognized as an Omni Transaction. Log error condition
                Catenis.logger.ERROR('addMissingOmniTxValidityField(): transaction associated with SentTransaction database doc/rec not recognized as an Omni transaction', {
                    docSentTransaction: doc
                });
            }
            else {
                throw err;
            }
        }

        if (omniTxInfo && 'valid' in omniTxInfo) {
            const omniTxValidity = {
                isValid: omniTxInfo.valid
            };
            
            if (!omniTxInfo.valid) {
                omniTxValidity.invalidReason = omniTxInfo.invalidreason;
            }
            
            const setExpression = {};
            setExpression[`info.${Transaction.type[doc.type].dbInfoEntryName}.omniTxValidity`] = omniTxValidity;
            
            Catenis.db.collection.SentTransaction.update({
                _id: doc._id
            }, {
                $set: setExpression
            });

            countUpdatedDocs++;
        }
    });

    if (countUpdatedDocs > 0) {
        Catenis.logger.INFO('****** Omni Transaction Validity field (omniTxValidity) has been added to %d SentTransaction docs/recs', countUpdatedDocs);
    }
    
    // Do the same thing for ReceivedTransaction collection now
    countUpdatedDocs = 0;

    orOperands = [];

    [Transaction.type.bcot_payment, Transaction.type.bcot_replenishment].forEach((txType) => {
        const orOperand = {
            type: txType.name
        };
        orOperand[`info.${txType.dbInfoEntryName}.omniTxValidity`] = {
            $exists: false
        };

        orOperands.push(orOperand);
    });

    Catenis.db.collection.ReceivedTransaction.find({
        'confirmation.confirmed': true,
        $or: orOperands
    }, {
        fields: {
            _id: 1,
            type: 1,
            txid: 1
        }
    }).fetch().forEach((doc) => {
        // Retrieve Omni transaction info
        let omniTxInfo;

        try {
            omniTxInfo = Catenis.omniCore.omniGetTransaction(doc.txid);
        }
        catch (err) {
            if ((err instanceof Meteor.Error) && err.error === 'ctn_omcore_rpc_error' && err.details !== undefined && typeof err.details.code === 'number'
                && err.details.code === OmniCore.rpcErrorCode.RPC_INVALID_ADDRESS_OR_KEY) {
                // Transaction not recognized as an Omni Transaction. Log error condition
                Catenis.logger.ERROR('addMissingOmniTxValidityField(): transaction associated with ReceivedTransaction database doc/rec not recognized as an Omni transaction', {
                    docSentTransaction: doc
                });
            }
            else {
                throw err;
            }
        }

        if (omniTxInfo && 'valid' in omniTxInfo) {
            const omniTxValidity = {
                isValid: omniTxInfo.valid
            };

            if (!omniTxInfo.valid) {
                omniTxValidity.invalidReason = omniTxInfo.invalidreason;
            }

            const setExpression = {};
            setExpression[`info.${Transaction.type[doc.type].dbInfoEntryName}.omniTxValidity`] = omniTxValidity;

            Catenis.db.collection.ReceivedTransaction.update({
                _id: doc._id
            }, {
                $set: setExpression
            });

            countUpdatedDocs++;
        }
    });

    if (countUpdatedDocs > 0) {
        Catenis.logger.INFO('****** Omni Transaction Validity field (omniTxValidity) has been added to %d ReceivedTransaction docs/recs', countUpdatedDocs);
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

function initLicense() {
    const docLicense = this.collection.License.findOne({}, {
        fields: {
            _id: 1
        }
    });

    if (!docLicense) {
        // No license rec/docs exist yet. Add default license entries
        const now = new Date();

        cfgSettings.defaultLicenses.forEach((license) => {
            license.level = conformStrIdField(license.level);

            if (license.type) {
                license.type = conformStrIdField(license.type);
            }

            license.status = 'active';
            license.createdDate = now;
            license.activatedDate = now;

            this.collection.License.insert(license);
        });
    }
}

function initBcotPrice() {
    // Check if there is already at least one BCOT token price recorded
    const docBcotPrice = this.collection.BcotPrice.findOne({}, {
        fields: {
            _id: 1
        },
        sort: {
            createdDate: -1
        }
    });

    if (!docBcotPrice) {
        // Record default BCOT token price
        this.collection.BcotPrice.insert({
            price: cfgSettings.defaultBcotPrice,
            createdDate: new Date()
        });
    }
}

function initBcotProduct() {
    const docProduct = this.collection.BcotProduct.findOne({}, {
        fields: {
            _id: 1
        }
    });

    if (!docProduct) {
        // No BCOT token product rec/docs exist yet. Add default products
        const now = new Date();

        cfgSettings.defaultBcotProducts.forEach((bcotProduct) => {
            bcotProduct.active = true;
            bcotProduct.createdDate = now;

            this.collection.BcotProduct.insert(bcotProduct);
        });
    }
}


// Definition of module (private) functions
//

//** Temporary method used to drop any index of a given collection if the 'safe' property is present
import Future from 'fibers/future';
import { OmniCore } from './OmniCore';

function dropSafeIndices (collection) {
    const fut1 = new Future();

    collection.indexes(function (error, indices) {
        Future.task(() => {
            if (!error) {
                const safeIndicesToDrop = indices.filter((index) => {
                    return index.safe !== undefined;
                });

                if (safeIndicesToDrop.length > 0) {
                    for (let idx = 0, limit = safeIndicesToDrop.length; idx < limit; idx++) {
                        const index = safeIndicesToDrop[idx];
                        const fut2 = new Future();

                        collection.dropIndex(index.name, function (error) {
                            if (!error) {
                                // Safe index successfully removed.
                                Catenis.logger.DEBUG('Index \'%s\', which had the \'safe\' property, had been removed from %s DB collection', index.name, collection.s.name);
                                fut2.return();
                            }
                            else {
                                // Error trying to remove index. Log error and throw exception
                                Catenis.logger.ERROR('Error trying to remove index \'%s\' of %s DB collection.', index.name, collection.s.name, error);
                                throw new Error('Error trying to remove index from DB collection');
                            }
                        });

                        fut2.wait();
                    }
                }

                fut1.return();
            }
            else {
                if (!(error.name === 'MongoError' && error.message.match(/^ns does not exist:/)) ) {
                    // Error retrieving indices. Log error
                    Catenis.logger.ERROR('Error retrieving indices from %s DB collection.', collection.s.name, error);
                    throw new Error('Error retrieving indices from DB collection');
                }
                else {
                    // Error was due to the fact that collection does not exist yet.
                    //  So, just proceed with processing
                    fut1.return();
                }
            }
        }).detach();
    });

    fut1.wait();
}


// Module code
//

// Lock function class
Object.freeze(Database);
