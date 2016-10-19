/**
 * Created by claudio on 28/07/16.
 */

//console.log('[TransactionMonitor.js]: This code just ran.');

/* NOTE: the purpose of this module is to have a (local) notification mechanism that shall
    be used to let other modules know when events related to blockchain transactions have
    happened, like when a sent transaction has been confirmed, or when (outside) transactions
    are received (e.g., system funding transactions, and message transactions).

        At the moment, this is being implemented by POLLING the blockchain state (via BitcoinCore's
    RPC API), but the intention, in the (near) future, is to use BitcoinCore's new feature
    (introduced in version 0.12.0) NOTIFICATIONS THROUGH ZMQ (see the following links for more
    information: https://bitcoin.org/en/release/v0.12.0 and https://github.com/bitcoin/bitcoin/blob/v0.12.0/doc/zmq.md),
    which provides for clients to be notified in real time of when new transactions and blocks arrive.
 */

// Module variables
//

// References to external modules
var events = Npm.require('events');
var config = Npm.require('config');

// Config entries
var txMonitorConfig = config.get('transactionMonitor');

// Configuration settings
var cfgSettings = {
    blockchainPollingInterval: txMonitorConfig.get('blockchainPollingInterval'),
    mempoolExpiryHours: txMonitorConfig.get('mempoolExpiryHours'),
    confirmSentTxTime: txMonitorConfig.get('confirmSentTxTime')
};


// Definition of function classes
//

// TxMonitor class
class TransactionMonitor extends events.EventEmitter {
    constructor (pollingInterval) {
        super();

        this.doingBlockchainPoll = false;
        this.lastBlockHeight = undefined;
        this.memPoolTxids = undefined;
        this.processedTxids = new Map();

        // Set up event handlers
        this.on('new_blocks', newBlocks.bind(this));
        this.on('new_transactions', newTransactions.bind(this));

        Catenis.logger.TRACE('Setting recurring timer to poll blockchain');
        Meteor.setInterval(pollBlockchain.bind(this), pollingInterval);
    }

    static initialize() {
        Catenis.txMonitor = new TransactionMonitor(cfgSettings.blockchainPollingInterval);
    }
}


// Module functions used to simulate private TransactionMonitor object methods
//  NOTE: these functions need to be bound to a TransactionMonitor object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

function pollBlockchain() {
    Catenis.logger.TRACE('Executing process to poll blockchain');
    // Make sure it's not yet doing blockchain poll to do it once more
    if (!this.doingBlockchainPoll) {
        try {
            this.doingBlockchainPoll = true;

            // Get list ids of currently in transactions in mempool
            var currMempoolTxids = Catenis.bitcoinCore.getRawMempool(false);

            // Identify those tx ids that are new (were not in the previously saved
            //  mempool tx ids)
            var newTxids = this.memPoolTxids == undefined ? currMempoolTxids : currMempoolTxids.filter((currTxid) => {
                return !this.memPoolTxids.some((txid) => {
                    return txid == currTxid;
                });
            });

            if (newTxids.length > 0) {
                // New transactions have arrived. Filter those that are associated with
                //  Catenis addresses (addresses imported onto BitcoinCore)
                var newCtnTxids = newTxids.reduce((result, txid) => {
                    try {
                        // Make sure that error thrown by getTransaction() is not logged.
                        //  This is necessary because any transaction that are not associated
                        //  with a wallet address will make getTransaction() to throw an error
                        //  (with code = RPC_INVALID_ADDRESS_OR_KEY)
                        result[txid] = Catenis.bitcoinCore.getTransaction(txid, false);
                    }
                    catch (err) {
                        if (!(err instanceof Meteor.Error) || err.details == undefined || typeof err.details.code !== 'number'
                            || err.details.code != Catenis.module.BitcoinCore.rpcErrorCode.RPC_INVALID_ADDRESS_OR_KEY) {
                            // An error other than indication that it is a non-wallet tx id.
                            //  Just re-throws it
                            throw err;
                        }
                    }

                    return result;
                }, {});

                // Save new tx ids as processed
                newTxids.forEach((txid) => {
                    this.processedTxids.set(txid, Date.now());
                });

                // Wait to see if new blocks have arrived before emitting event
                //  indicating that new transactions have arrived
            }

            // Get current block count
            var blockCount = Catenis.bitcoinCore.getBlockCount(),
                newBlocks = false;

            if (this.lastBlockHeight == undefined || blockCount > this.lastBlockHeight) {
                // New blocks have arrived. Identify them and get their block info
                newBlocks = true;

                var blocks = {};

                for (let height = this.lastBlockHeight != undefined ? this.lastBlockHeight + 1 : blockCount; height <= blockCount; height++) {
                    let blockInfo = Catenis.bitcoinCore.getBlock(Catenis.bitcoinCore.getBlockHash(height));

                    // Save block info
                    blocks[height] = blockInfo;

                    // Identify transactions within the block that have not yet been processed
                    let unprocessedTxids = [],
                        alreadyProcessedTxids = [];

                    blockInfo.tx.forEach((txid) => {
                        if (this.processedTxids.has(txid)) {
                            alreadyProcessedTxids.push(txid);
                        }
                        else {
                            unprocessedTxids.push(txid);
                        }
                    });

                    if (unprocessedTxids.length > 0) {
                        // New transactions have arrived. Filter those that are associated with
                        //  Catenis addresses (addresses imported onto BitcoinCore)
                        newCtnTxids = unprocessedTxids.reduce((result, txid) => {
                            try {
                                // Make sure that error thrown by getTransaction() is not logged.
                                //  This is necessary because any transaction that are not associated
                                //  with a wallet address will make getTransaction() to throw an error
                                //  (with code = RPC_INVALID_ADDRESS_OR_KEY)
                                result[txid] = Catenis.bitcoinCore.getTransaction(txid, false);
                            }
                            catch (err) {
                                if (!(err instanceof Meteor.Error) || err.details == undefined || typeof err.details.code !== 'number'
                                    || err.details.code != Catenis.module.BitcoinCore.rpcErrorCode.RPC_INVALID_ADDRESS_OR_KEY) {
                                    // An error other than indication that it is a non-wallet tx id.
                                    //  Just re-throws it
                                    throw err;
                                }
                            }

                            return result;
                        }, {});
                    }

                    if (alreadyProcessedTxids.length > 0) {
                        // Remove tx ids already processed from list of processed tx ids
                        alreadyProcessedTxids.forEach((txid) => {
                            this.processedTxids.delete(txid);
                        });
                    }
                }
            }

            // Save new mempool tx ids
            this.memPoolTxids = currMempoolTxids;

            if (newCtnTxids != undefined && Object.keys(newCtnTxids).length > 0) {
                // Emit event indicating that new transactions have arrived
                this.emit('new_transactions', newCtnTxids);
            }

            if (newBlocks) {
                // Save new block height
                this.lastBlockHeight = blockCount;

                // Emit event indicating that new blocks have arrived
                this.emit('new_blocks', blocks);
            }

            // Purge old tx ids from list of processed tx ids
            if (this.processedTxids.size > 0) {
                let dtNow = new Date(Date.now()),
                    limitTime = dtNow.setHours(dtNow.getHours - cfgSettings.mempoolExpiryHours);

                for (let [txid, time] of this.processedTxids) {
                    if (time < limitTime) {
                        this.processedTxids.delete(txid);
                    }
                }
            }
        }
        catch (err) {
            // Error polling blockchain. Log error condition
            Catenis.logger.ERROR('Error while polling blockchain.', err);
        }
        finally {
            this.doingBlockchainPoll = false;
        }
    }
}

//  data: {
//    <block height>: [Object],  // Result from getBlock() RPC method
//    ...
//  }
function newBlocks(data) {
    Catenis.logger.TRACE('New blocks event handler called.', {data: data});
    try {
        var eventsToEmit = [];

        // Confirm transactions found in received blocks
        for (let blockHeight in data) {
            let blockInfo = data[blockHeight];

            // Retrieve sent transactions found in block that are not yet confirmed
            let idDocsToUpdate = Catenis.db.collection.SentTransaction.find({
                txid: {$in: blockInfo.tx},
                'confirmation.confirmed': false
            }, {fields: {_id: 1, type: 1, txid: 1, replacedByTxid: 1, info: 1}}).map(function (doc) {
                if (doc.type === Catenis.module.Transaction.type.funding.name) {
                    // Prepare to emit event notifying of confirmation of funding transaction
                    let notifyEvent = getNotifyEventFromFundingEvent(doc.info.funding.event.name);

                    if (notifyEvent != undefined) {
                        eventsToEmit.push({
                            name: notifyEvent.name,
                            data: {
                                txid: doc.txid,
                                entityId: doc.info.funding.event.entityId
                            }
                        });
                    }
                    else {
                        // Could not get notification event from funding event.
                        //  Log error condition
                        Catenis.logger.ERROR('Could not get notification event from funding transaction event', {fundingEvent: doc.info.funding.event.name});
                    }
                }
                else if (doc.type === Transaction.type.issue_locked_asset.name || doc.type === Transaction.type.issue_unlocked_asset.name) {
                    // Prepare to emit event notifying of confirmation of asset issuance transaction
                    let notifyEvent = getNotifyEventFromTxType(doc.type);

                    if (notifyEvent != undefined) {
                        let txInfo = doc.info[Transaction.type[doc.type].dbInfoEntryName];

                        eventsToEmit.push({
                            name: notifyEvent.name,
                            data: {
                                txid: doc.txid,
                                assetId: txInfo.assetId,
                                deviceId: txInfo.deviceId
                            }
                        });
                    }
                    else {
                        // Could not get notification event from transaction type.
                        //  Log error condition
                        Catenis.logger.ERROR('Could not get notification event from transaction type', {txType: doc.type});
                    }
                }

                if (doc.replacedByTxid != undefined) {
                    // A transaction that had been replaced by another transaction is being confirmed.
                    //  Just log warning condition only for now
                    // TODO: in the future, emit event so this condition can be treated by module responsible for sending read confirmation transactions
                    Catenis.logger.WARN('Transaction that had been replaced by another transaction is being confirmed.', {txid: doc.txid, replacedByTxid: doc.replacedByTxid});
                }

                return doc._id;
            });

            if (idDocsToUpdate.length > 0) {
                // Update sent transaction doc/rec to confirm them
                Catenis.db.collection.SentTransaction.update({_id: {$in: idDocsToUpdate}}, {
                    $set: {
                        'confirmation.confirmed': true,
                        'confirmation.blockHash': blockInfo.hash,
                        'confirmation.confirmationDate': new Date(blockInfo.time * 1000)
                    }
                }, {multi: true});
            }
        }

        // Look for old transactions that have not been confirmed yet, and
        //  check if they have already been confirmed
        var dtNow = new Date(Date.now()),
            limitDate = dtNow.setMinutes(dtNow.getMinutes() - cfgSettings.confirmSentTxTime),
            idTxsToConfirmByBlock = new Map();

        Catenis.db.collection.SentTransaction.find({
            'confirmation.confirmed': false,
            createdDate: {$lt: limitDate},
            replacedByTxid: {$exists: false}
        }, {fields: {_id: 1, type:1, txid: 1, info: 1}}).forEach(function (doc) {
            // Retrieve transaction information
            let txInfo = Catenis.bitcoinCore.getTransaction(doc.txid);

            if (txInfo.confirmations > 0) {
                if (doc.type === Catenis.module.Transaction.type.funding.name) {
                    // Prepare to emit event notifying of confirmation of funding transaction
                    eventsToEmit.push({
                        name: doc.info.funding.event.name,
                        data: {
                            txid: doc.txid,
                            entityId: doc.info.funding.event.entityId
                        }
                    });
                }

                let block = {
                    hash: txInfo.blockhash,
                    time: txInfo.blocktime
                };

                if (!idTxsToConfirmByBlock.has(block)) {
                    idTxsToConfirmByBlock.set(block, [doc.txid]);
                }
                else {
                    idTxsToConfirmByBlock.get(block).push(doc.txid);
                }
            }
        });

        for (let [block, txids] of idTxsToConfirmByBlock) {
            // Update sent transaction doc/rec to confirm them
            Catenis.db.collection.SentTransaction.update({txid: {$in: txids}}, {
                $set: {
                    'confirmation.confirmed': true,
                    'confirmation.blockHash': block.hash,
                    'confirmation.confirmationDate': new Date(block.time * 1000)
                }
            }, {multi: true});
        }

        if (eventsToEmit.length > 0) {
            // Emit notification events
            eventsToEmit.forEach(function (event) {
                this.emit(event.name, event.data);
            });
        }
    }
    catch (err) {
        // Error while handling new blocks event. Log error condition
        Catenis.logger.Error('Error while handling new blocks event.', err);
    }
}

//  data: {
//    <txid>: [Object],  // Result from getTransaction() RPC method
//    ...
//  }
function newTransactions(data) {
    Catenis.logger.TRACE('New transactions event handler called.', {data: data});

    // TODO: identify different transaction types, and emit events for each type separately
}


// TransactionMonitor class (public) properties
//

TransactionMonitor.notifyEvent = Object.freeze({
    funding_provision_ctn_hub_device_tx_conf: Object.freeze({
        name: 'provision_ctn_hub_device_tx_conf',
        description: 'Funding transaction sent for provisioning Catenis Hub devive has been confirmed'
    }),
    funding_provision_client_srv_credit_tx_conf: Object.freeze({
        name: 'provision_client_srv_credit_tx_conf',
        description: 'Funding transaction sent for provisioning service credit for a client has been confirmed'
    }),
    funding_provision_client_device_tx_conf: Object.freeze({
        name: 'provision_client_device_tx_conf',
        description: 'Funding transaction sent for provisioning a device for a client has been confirmed'
    }),
    funding_add_extra_tx_pay_funds_tx_conf: Object.freeze({
        name: 'add_extra_tx_pay_funds_tx_conf',
        description: 'Funding transaction sent for adding funds to pay for transaction expenses has been confirmed'
    }),
    issue_locked_asset_tx_conf: Object.freeze({
        name: 'issue_locked_asset_tx_conf',
        description: 'Transaction sent for issuing (Colored Coins) assets (of a given type) that cannot be reissued has been confirmed'
    }),
    issue_unlocked_asset_tx_conf: Object.freeze({
        name: 'issue_unlocked_asset_tx_conf',
        description: 'Transaction sent for issuing or reissuing (Colored Coins) assets (of a given type) has been confirmed'
    })
    // TODO: add events used to notify when a transaction of a given type is received
});


// Definition of module (private) functions
//

function getNotifyEventFromFundingEvent(fundingEventName) {
    var notifyEventName = 'funding_' + fundingEventName + '_tx_conf';

    return Transaction.notifyEvent[notifyEventName];
}

function getNotifyEventFromTxType(txTypeName) {
    var notifyEventName = txTypeName + '_tx_conf';

    return Transaction.notifyEvent[notifyEventName];
}


// Module code
//

// Save module class reference
if (typeof Catenis === 'undefined')
    Catenis = {};

if (typeof Catenis.module === 'undefined')
    Catenis.module = {};

Catenis.module.TransactionMonitor = Object.freeze(TransactionMonitor);
