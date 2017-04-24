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

// References to external code
//
// Internal node modules
//  NOTE: the reference of these modules are done sing 'require()' instead of 'import' to
//      to avoid annoying WebStorm warning message: 'default export is not defined in
//      imported module'
const util = require('util');
const events = require('events');
// Third-party node modules
import config from 'config';
import Future from 'fibers/future';
// Meteor packages
import { Meteor } from 'meteor/meteor';
import { _ } from 'meteor/underscore';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { BitcoinCore } from './BitcoinCore';
import { KeyStore } from './KeyStore';
import { Transaction } from './Transaction';

// Config entries
const txMonitorConfig = config.get('transactionMonitor');

// Configuration settings
const cfgSettings = {
    blockchainPollingInterval: txMonitorConfig.get('blockchainPollingInterval'),
    mempoolExpiryHours: txMonitorConfig.get('mempoolExpiryHours'),
    confirmSentTxTime: txMonitorConfig.get('confirmSentTxTime')
};

const externalEventHandlers = [];

// Definition of function classes
//

// TransactionMonitor class
export class TransactionMonitor extends events.EventEmitter {
    constructor (bcPollingInterval) {
        super();

        this.bcPollingInterval = bcPollingInterval;
        this.doingBlockchainPoll = false;
        this.newBlockchainPollTick = false;
        this.syncingBlocks = false;
        this.memPoolTxids = undefined;
        this.processedTxids = new Map();

        // Retrieve height of last processed blockchain block from the database
        const docApp = Catenis.db.collection.Application.find({}, {fields: {lastBlockHeight: 1}}).fetch()[0];

        this.docAppId = docApp._id;
        this.lastBlockHeight = docApp.lastBlockHeight;

        // Set up event handlers
        externalEventHandlers.forEach(eventHandler => {
            //noinspection JSCheckFunctionSignatures
            this.on(eventHandler.event, eventHandler.handler);
        });

        this.on(TransactionMonitor.internalEvent.new_blocks, handleNewBlocks.bind(this));
        this.on(TransactionMonitor.internalEvent.new_transactions, handleNewTransactions.bind(this));
    }

    startMonitoring() {
        if (this.idPollBcInterval === undefined) {
            Catenis.logger.TRACE('Setting recurring timer to poll blockchain');
            this.idPollBcInterval = Meteor.setInterval(pollBlockchain.bind(this), this.bcPollingInterval);
        }
    }

    stopMonitoring() {
        if (this.idPollBcInterval !== undefined) {
            Catenis.logger.TRACE('Stop polling blockchain');
            Meteor.clearInterval(this.idPollBcInterval);
            this.idPollBcInterval = undefined;
        }
    }

    forceBlockchainPoll() {
        Catenis.logger.TRACE('Method forceBlockchainPoll() called');
        if (!this.doingBlockchainPoll) {
            // Blockchain polling is not under way. So just call the method
            //  to handle it (note that this will block until the polling is done)
            Catenis.logger.TRACE('Forcing execution of method to poll blockchain (and process received blocks)');
            pollBlockchain.call(this);
        }
        else {
            // Blockchain polling is already under way. We need to wait for
            //  it to finish before returning
            Catenis.logger.TRACE('Method to poll blockchain already being executed. Wait for it to finish');

            // Make sure that the following code is executed in its own fiber
            Future.task(() => {
                const fut = new Future();

                // Waits for blockchain poll done event
                const pollEndCallback = () => {
                    fut.return();
                };

                this.on(TransactionMonitor.internalEvent.blockchain_poll_done, pollEndCallback);

                // And set a timeout as a precaution
                const idTmo = setTimeout(() => {
                    fut.return();
                }, this.bcPollingInterval);

                fut.wait();

                // Polling is done
                this.removeListener(TransactionMonitor.internalEvent.blockchain_poll_done, pollEndCallback);
                clearTimeout(idTmo);

                // Make sure that all received blocks have been processed
                const blockCount = Catenis.bitcoinCore.getBlockCount();

                if (blockCount > (this.lastBlockHeight !== undefined ? this.lastBlockHeight : 0)) {
                    // Go process received blocks
                    Catenis.logger.TRACE('There are still received blocks that have not been processed yet. Forcing execution of method to poll blockchain to process them');
                    pollBlockchain.call(this);
                }
            }).wait();
        }
    }

    static addEventHandler(event, handler) {
        // Save event handler to be set up when object instance is created
        externalEventHandlers.push({
            event: event,
            handler: handler
        });
    }

    static initialize() {
        Catenis.logger.TRACE('TransactionMonitor initialization');
        Catenis.txMonitor = new TransactionMonitor(cfgSettings.blockchainPollingInterval);
    }
}


// Module functions used to simulate private TransactionMonitor object methods
//  NOTE: these functions need to be bound to a TransactionMonitor object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

function persistLastBlockHeight() {
    // Update height of last processed blockchain block on the database
    Catenis.db.collection.Application.update({_id: this.docAppId}, {$set: {lastBlockHeight: this.lastBlockHeight}});
}

function pollBlockchain() {
    Catenis.logger.TRACE('Executing process to poll blockchain');
    // Make sure it's not yet doing blockchain poll to do it once more
    if (!this.doingBlockchainPoll) {
        try {
            this.doingBlockchainPoll = true;

            let currBlockHeight = undefined,
                blockCount = undefined;

            do {
                this.newBlockchainPollTick = false;

                // Get list of ids of transactions currently in mempool
                const currMempoolTxids = Catenis.bitcoinCore.getRawMempool(false);

                // Identify those tx ids that are new (were not in the previously saved
                //  mempool tx ids)
                const newTxids = this.memPoolTxids === undefined ? currMempoolTxids : currMempoolTxids.filter((currTxid) => {
                    return !this.memPoolTxids.some((txid) => {
                        return txid === currTxid;
                    });
                });

                let newCtnTxids = {};

                if (newTxids.length > 0) {
                    // New transactions have arrived. Filter those that are associated with
                    //  Catenis addresses (addresses imported onto BitcoinCore)
                    newCtnTxids = newTxids.reduce((result, txid) => {
                        try {
                            // Make sure that error thrown by getTransaction() is not logged.
                            //  This is necessary because any transaction that are not associated
                            //  with a wallet address will make getTransaction() to throw an error
                            //  (with code = RPC_INVALID_ADDRESS_OR_KEY)
                            result[txid] = Catenis.bitcoinCore.getTransaction(txid, false);
                        }
                        catch (err) {
                            if (!((err instanceof Meteor.Error) && err.error === 'ctn_btcore_rpc_error' && err.details !== undefined && typeof err.details.code === 'number'
                                    && err.details.code === BitcoinCore.rpcErrorCode.RPC_INVALID_ADDRESS_OR_KEY)) {
                                // An error other than indication that it is a non-wallet tx id.
                                //  Just re-throws it
                                throw err;
                            }
                        }

                        return result;
                    }, newCtnTxids);

                    // Save new tx ids as processed
                    newTxids.forEach((txid) => {
                        this.processedTxids.set(txid, Date.now());
                    });

                    // Wait to see if new blocks have arrived before emitting event
                    //  indicating that new transactions have arrived
                }

                // Get current block count
                blockCount = Catenis.bitcoinCore.getBlockCount();

                const newBlocks = {};

                if (this.lastBlockHeight === undefined || blockCount > this.lastBlockHeight) {
                    // New blocks have arrived. Identify them and get their block info

                    // Process blocks not yet processed until next blockchain poll tick
                    currBlockHeight = this.lastBlockHeight !== undefined ? this.lastBlockHeight + 1 : blockCount;

                    if (blockCount > currBlockHeight) {
                        this.syncingBlocks = true;
                        Catenis.application.setSyncingBlocks(true);
                    }

                    do {
                        const blockInfo = Catenis.bitcoinCore.getBlock(Catenis.bitcoinCore.getBlockHash(currBlockHeight));
                        Catenis.logger.DEBUG(util.format('pollBlockchain(): processing block #%d of #%d', currBlockHeight, blockCount));

                        // Identify transactions within the block that have not yet been processed
                        const alreadyProcessedTxids = [];

                        // Process block only if it has more than one transaction, since a block
                        //  always has one coinbase transaction
                        if (blockInfo.tx.length > 1) {
                            // Iterate through block's transactions identifying Catenis transactions
                            //  in block, and the ones that are new
                            const ctnTxsInBlock = [];

                            newCtnTxids = blockInfo.tx.reduce((result, txid) => {
                                let txInfo = undefined;

                                // Retrieve info of transactions that are associated with
                                //  Catenis addresses (addresses imported onto BitcoinCore)
                                try {
                                    // Make sure that error thrown by getTransaction() is not logged.
                                    //  This is necessary because any transaction that are not associated
                                    //  with a wallet address will make getTransaction() to throw an error
                                    //  (with code = RPC_INVALID_ADDRESS_OR_KEY)
                                    txInfo = Catenis.bitcoinCore.getTransaction(txid, false);

                                    // Add transaction ID to list of Catenis transactions in block
                                    ctnTxsInBlock.push(txid);
                                }
                                catch (err) {
                                    if (!((err instanceof Meteor.Error) && err.error === 'ctn_btcore_rpc_error' && err.details !== undefined && typeof err.details.code === 'number'
                                            && err.details.code === BitcoinCore.rpcErrorCode.RPC_INVALID_ADDRESS_OR_KEY)) {
                                        // An error other than indication that it is a non-wallet tx id.
                                        //  Just re-throws it
                                        throw err;
                                    }
                                }

                                if (this.processedTxids.has(txid)) {
                                    alreadyProcessedTxids.push(txid);
                                }
                                else {
                                    // New transactions have arrived
                                    if (txInfo !== undefined) {
                                        // Transaction info is available, which means that it is
                                        //  a Catenis transaction. So save it
                                        result[txid] = txInfo;
                                    }
                                }

                                return result;
                            }, newCtnTxids);

                            if (ctnTxsInBlock.length > 0) {
                                // Block has Catenis transaction. Add list of Catenis transactions
                                //  to block info
                                blockInfo.ctnTx = ctnTxsInBlock;
                            }
                        }

                        newBlocks[currBlockHeight] = blockInfo;

                        // Remove tx ids already processed from list of processed tx ids
                        alreadyProcessedTxids.forEach((txid) => {
                            this.processedTxids.delete(txid);
                        });

                        currBlockHeight++;
                    }
                    while (!this.newBlockchainPollTick && currBlockHeight <= blockCount);

                    // Save and persist new block height
                    this.lastBlockHeight = currBlockHeight - 1;
                    persistLastBlockHeight.call(this);
                }

                // Save new mempool tx ids
                this.memPoolTxids = currMempoolTxids;

                let newCtnTxidKeys = undefined;

                if ((newCtnTxidKeys = Object.keys(newCtnTxids)).length > 0) {
                    // Make sure to filter out any transaction that have already been saved
                    //  as ReceivedTransactions in local database
                    let filtered = false;

                    Catenis.db.collection.ReceivedTransaction.find({txid: {$in: newCtnTxidKeys}}, {fields: {txid: 1}}).forEach(doc => {
                        Catenis.logger.TRACE('Transaction identified as new Catenis transaction had already been received', {txid: doc.txid});
                        newCtnTxids.delete(doc.txid);
                        filtered = true;
                    });

                    if (!filtered || Object.keys(newCtnTxids).length > 0) {
                        // Emit (internal) event notifying that new transactions have arrived
                        this.emit(TransactionMonitor.internalEvent.new_transactions, newCtnTxids);
                    }
                }

                if (Object.keys(newBlocks).length > 0) {
                    // Emit (internal) event notifying that new blocks have arrived
                    this.emit(TransactionMonitor.internalEvent.new_blocks, newBlocks);
                }

                // Purge old tx ids from list of processed tx ids
                if (this.processedTxids.size > 0) {
                    const dtNow = new Date(Date.now()),
                        limitTime = dtNow.setHours(dtNow.getHours - cfgSettings.mempoolExpiryHours);

                    for (let [txid, time] of this.processedTxids) {
                        if (time < limitTime) {
                            this.processedTxids.delete(txid);
                        }
                    }
                }

                // Refresh block count
                blockCount = Catenis.bitcoinCore.getBlockCount();
            }
            // Continue processing if a new blockchain pool tick has happened and
            //  there are still more blocks to be processed
            while (this.newBlockchainPollTick && currBlockHeight !== undefined && currBlockHeight <= blockCount);
        }
        catch (err) {
            // Error polling blockchain. Log error condition
            Catenis.logger.ERROR('Error while polling blockchain.', err);
        }
        finally {
            this.doingBlockchainPoll = false;
            this.syncingBlocks = false;
            Catenis.application.setSyncingBlocks(false);

            // Emit (internal) event notifying that polling is done
            this.emit(TransactionMonitor.internalEvent.blockchain_poll_done);
        }
    }
    else {
        // Indicate that a new blockchain poll tick has happened
        this.newBlockchainPollTick = true;
    }
}

//  data: {
//    <block height>: [Object],  // Result from getBlock() RPC method
//    ...
//  }
function handleNewBlocks(data) {
    Catenis.logger.TRACE('New blocks event handler called.', {data: data});
    try {
        const eventsToEmit = [];

        // Confirm transactions found in received blocks
        for (let blockHeight in data) {
            //noinspection JSUnfilteredForInLoop
            const blockInfo = data[blockHeight];

            if (blockInfo.ctnTx !== undefined) {
                // Block has Catenis transactions.
                const idCtnTxsToConfirm = new Set();

                //  Retrieve sent transactions found in block that are not yet confirmed
                const idSentTxDocsToUpdate = Catenis.db.collection.SentTransaction.find({
                    txid: {$in: blockInfo.ctnTx},
                    'confirmation.confirmed': false
                }, {fields: {_id: 1, type: 1, txid: 1, replacedByTxid: 1, info: 1}}).map((doc) => {
                    processConfirmedSentTransactions(doc, eventsToEmit);

                    // Save ID of transaction that is set to be confirmed
                    idCtnTxsToConfirm.add(doc.txid);

                    return doc._id;
                });

                // Retrieve received transactions found in block that are not yet confirmed
                //  Note: only transactions received that have not been sent by this Catenis node
                //      should have been considered
                const idRcvdTxDocsToUpdate = Catenis.db.collection.ReceivedTransaction.find({
                    txid: {$in: blockInfo.ctnTx},
                    sentTransaction_id: {$exists: false},
                    'confirmation.confirmed': false
                }, {fields: {_id: 1, type: 1, txid: 1}}).map((doc) => {
                    processConfirmedReceivedTransactions(doc, eventsToEmit);

                    // Save ID of transaction that is set to be confirmed
                    idCtnTxsToConfirm.add(doc.txid);

                    return doc._id;
                });

                if (blockInfo.ctnTx.length > idCtnTxsToConfirm.size) {
                    // Some Catenis transactions did not match any transaction in the local database
                    //  (SentTransaction and ReceivedTransaction collections) that are awaiting confirmation
                    blockInfo.ctnTx.forEach((ctnTxid) => {
                        if (!idCtnTxsToConfirm.has(ctnTxid)) {
                            // Checks if it is a transaction the tx id of which was modified due to
                            //  malleability
                            let txInfo;

                            try {
                                // Get transaction info
                                txInfo = Catenis.bitcoinCore.getRawTransaction(ctnTxid, true);
                            }
                            catch (err) {
                                Catenis.logger.ERROR(util.format('Error retrieving information about transaction (txid: %s) to check for malleability', ctnTxid), err);
                            }

                            if (txInfo) {
                                const strInputTxids = txInfo.vin.map((input) => {
                                    return input.txid + ':' + input.vout;
                                });

                                // Check if there is a match in the sent transactions
                                const matchFound = Catenis.db.collection.SentTransaction.find({
                                    'inputs.str': {$in: strInputTxids},
                                    'confirmation.confirmed': false
                                }, {
                                    fields: {
                                        _id: 1,
                                        type: 1,
                                        txid: 1,
                                        inputs: 1,
                                        replacedByTxid: 1,
                                        info: 1
                                    }
                                }).fetch().some((doc) => {
                                    // Checks if all inputs of both transactions are the same
                                    if (doc.inputs.length === strInputTxids.length) {
                                        const sameInputs = !doc.inputs.some((input, idx) => {
                                            return input.str !== strInputTxids[idx];
                                        });

                                        if (sameInputs) {
                                            // The two transactions have the same inputs. Assume that transactions
                                            //  are the same and that its tx id had been modified (due to malleability)

                                            // Fix malleability and process confirmed tx
                                            Transaction.fixMalleability(Transaction.malleabilitySource.sent_tx, doc.txid, ctnTxid);

                                            // Replace tx id (with actual confirmed tx id) in SentTransaction doc/rec
                                            //  reference before continuing with the processing
                                            doc.txid = ctnTxid;

                                            processConfirmedSentTransactions(doc, eventsToEmit);

                                            idSentTxDocsToUpdate.push(doc._id);

                                            return true;
                                        }

                                        return false;
                                    }
                                });

                                if (!matchFound) {
                                    // Check if there is a match in the received transactions
                                    Catenis.db.collection.ReceivedTransaction.find({
                                        'inputs.str': {$in: strInputTxids},
                                        sentTransaction_id: {$exists: false},
                                        'confirmation.confirmed': false
                                    }, {
                                        fields: {
                                            _id: 1,
                                            type: 1,
                                            txid: 1,
                                            inputs: 1
                                        }
                                    }).fetch().some((doc) => {
                                        // Checks if all inputs of both transactions are the same
                                        if (doc.inputs.length === strInputTxids.length) {
                                            const sameInputs = !doc.inputs.some((input, idx) => {
                                                return input.str !== strInputTxids[idx];
                                            });

                                            if (sameInputs) {
                                                // The two transactions have the same inputs. Assume that transactions
                                                //  are the same and that its tx id had been modified (due to malleability)

                                                // Fix malleability and process confirmed tx
                                                Transaction.fixMalleability(Transaction.malleabilitySource.received_tx, doc.txid, ctnTxid);

                                                // Replace tx id (with actual confirmed tx id) in ReceivedTransaction doc/rec
                                                //  reference before continuing with the processing
                                                doc.txid = ctnTxid;

                                                processConfirmedReceivedTransactions(doc, eventsToEmit);

                                                idRcvdTxDocsToUpdate.push(doc._id);

                                                return true;
                                            }

                                            return false;
                                        }
                                    });
                                }
                            }
                        }
                    })
                }

                if (idSentTxDocsToUpdate.length > 0) {
                    // Update sent transaction doc/rec to confirm them
                    Catenis.db.collection.SentTransaction.update({_id: {$in: idSentTxDocsToUpdate}}, {
                        $set: {
                            'confirmation.confirmed': true,
                            'confirmation.blockHash': blockInfo.hash,
                            'confirmation.confirmationDate': new Date(blockInfo.time * 1000)
                        }
                    }, {multi: true});
                }

                if (idRcvdTxDocsToUpdate.length > 0) {
                    // Update received transaction doc/rec to confirm them
                    Catenis.db.collection.ReceivedTransaction.update({_id: {$in: idRcvdTxDocsToUpdate}}, {
                        $set: {
                            'confirmation.confirmed': true,
                            'confirmation.blockHash': blockInfo.hash,
                            'confirmation.confirmationDate': new Date(blockInfo.time * 1000)
                        }
                    }, {multi: true});
                }

                // Find Message database docs/recs associated with (Catenis) transactions in
                //  the current block that have not had their tx id confirmed yet and update
                //  its confirmed status
                Catenis.db.collection.Message.update({
                    'blockchain.txid': {$in: blockInfo.ctnTx},
                    'blockchain.confirmed': false
                }, {
                    $set: {
                        'blockchain.confirmed': true
                    }
                }, {multi: true});
            }
        }

        // Look for old sent transactions that have not been confirmed yet, and
        //  check if they have already been confirmed
        const idSentTxsToConfirmByBlock = new Map(),
            limitDate = new Date(Date.now());
        limitDate.setMinutes(limitDate.getMinutes() - cfgSettings.confirmSentTxTime);

        Catenis.db.collection.SentTransaction.find({
            'confirmation.confirmed': false,
            sentDate: {$lt: limitDate},
            replacedByTxid: {$exists: false}
        }, {fields: {_id: 1, type:1, txid: 1, info: 1}}).forEach(doc => {
            // Retrieve transaction information
            const txInfo = Catenis.bitcoinCore.getTransaction(doc.txid);

            if (txInfo.confirmations > 0) {
                if (doc.type === Transaction.type.funding.name) {
                    // Prepare to emit event notifying of confirmation of funding transaction
                    const notifyEvent = getTxConfNotifyEventFromFundingEvent(doc.info.funding.event.name);

                    if (notifyEvent !== undefined) {
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
                        Catenis.logger.ERROR('Could not get tx confirmation notification event from funding transaction event', {fundingEvent: doc.info.funding.event.name});
                    }
                }
                else if (doc.type === Transaction.type.issue_locked_asset.name || doc.type === Transaction.type.issue_unlocked_asset.name) {
                    // Prepare to emit event notifying of confirmation of asset issuance transaction
                    const notifyEvent = getTxConfNotifyEventFromTxType(doc.type);

                    if (notifyEvent !== undefined) {
                        const txInfo = doc.info[Transaction.type[doc.type].dbInfoEntryName];

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
                        Catenis.logger.ERROR('Could not get tx confirmation notification event from transaction type', {txType: doc.type});
                    }
                }

                const block = {
                    hash: txInfo.blockhash,
                    time: txInfo.blocktime
                };

                if (!idSentTxsToConfirmByBlock.has(block)) {
                    idSentTxsToConfirmByBlock.set(block, [doc.txid]);
                }
                else {
                    idSentTxsToConfirmByBlock.get(block).push(doc.txid);
                }
            }
        });

        for (let [block, txids] of idSentTxsToConfirmByBlock) {
            // Update sent transaction doc/rec to confirm them
            Catenis.db.collection.SentTransaction.update({txid: {$in: txids}}, {
                $set: {
                    'confirmation.confirmed': true,
                    'confirmation.blockHash': block.hash,
                    'confirmation.confirmationDate': new Date(block.time * 1000)
                }
            }, {multi: true});
        }

        // Look for old received transactions that have not been confirmed yet, and
        //  check if they have already been confirmed
        //  Note: only transactions received that have not been sent by this Catenis node
        //      should have been considered
        const idRcvdTxsToConfirmByBlock = new Map();

        Catenis.db.collection.ReceivedTransaction.find({
            sentTransaction_id: {$exists: false},
            'confirmation.confirmed': false,
            receivedDate: {$lt: limitDate}
        }, {fields: {_id: 1, type:1, txid: 1}}).forEach(doc => {
            // Retrieve transaction information
            const txInfo = Catenis.bitcoinCore.getTransaction(doc.txid);

            if (txInfo.confirmations > 0) {
                if (doc.type === Transaction.type.sys_funding.name) {
                    // Prepare to emit event notifying of confirmation of system funding transaction
                    eventsToEmit.push({
                        name: TransactionMonitor.notifyEvent.sys_funding_tx_conf.name,
                        data: {
                            txid: doc.txid
                        }
                    });
                }

                const block = {
                    hash: txInfo.blockhash,
                    time: txInfo.blocktime
                };

                if (!idRcvdTxsToConfirmByBlock.has(block)) {
                    idRcvdTxsToConfirmByBlock.set(block, [doc.txid]);
                }
                else {
                    idRcvdTxsToConfirmByBlock.get(block).push(doc.txid);
                }
            }
        });

        for (let [block, txids] of idRcvdTxsToConfirmByBlock) {
            // Update received transaction doc/rec to confirm them
            Catenis.db.collection.ReceivedTransaction.update({txid: {$in: txids}}, {
                $set: {
                    'confirmation.confirmed': true,
                    'confirmation.blockHash': block.hash,
                    'confirmation.confirmationDate': new Date(block.time * 1000)
                }
            }, {multi: true});
        }

        // Emit notification events
        eventsToEmit.forEach(event => {
            this.emit(event.name, event.data);
        });
    }
    catch (err) {
        // Error while handling new blocks event. Log error condition
        Catenis.logger.ERROR('Error while handling new blocks event.', err);
    }
}

//  data: {
//    <txid>: [Object],  // Result from getTransaction() RPC method
//    ...
//  }
function handleNewTransactions(data) {
    Catenis.logger.TRACE('New transactions event handler called.', {data: data});
    try {
        // TODO: identify different transaction types, and emit events for each type separately
        const eventsToEmit = [];

        // Identify received transactions that had been sent by this Catenis node
        //  Note: only transactions of the type 'send_message', 'read_confirmation', and 'transfer_asset'
        //      are taken into consideration as received transactions
        const txidRcvdTxDocToCreate = new Map();

        Catenis.db.collection.SentTransaction.find({
            txid: {$in: Object.keys(data)},
            type: {$in: [Transaction.type.send_message.name, Transaction.type.read_confirmation.name, Transaction.type.transfer_asset.name]}
        }, {fields: {_id: 1, type: 1, txid: 1, info:1}}).forEach(doc => {
            // Prepare to emit event notifying of new transaction received
            const notifyEvent = getTxRcvdNotifyEventFromTxType(doc.type);

            if (notifyEvent !== undefined) {
                const eventData = {
                    txid: doc.txid
                };

                if (doc.type === Transaction.type.send_message.name) {
                    eventData.originDeviceId = doc.info.sendMessage.originDeviceId;
                    eventData.targetDeviceId = doc.info.sendMessage.targetDeviceId;
                }
                else if (doc.type === Transaction.type.read_confirmation.name) {
                    eventData.txouts = doc.info.readConfirmation.txouts;
                }
                else if (doc.type === Transaction.type.transfer_asset.name) {
                    eventData.assetId = doc.info.transferAsset.assetId;
                    eventData.originDeviceId = doc.info.transferAsset.originDeviceId;
                    eventData.targetDeviceId = doc.info.transferAsset.targetDeviceId;
                }

                eventsToEmit.push({
                    name: notifyEvent.name,
                    data: eventData
                });
            }
            else {
                // Could not get notification event from transaction type.
                //  Log error condition
                Catenis.logger.ERROR('Could not get tx received notification event from transaction type', {txType: doc.type});
            }

            // Fix tx info to be saved to local database
            const docInfo = doc.info;

            if (doc.type === Transaction.type.send_message.name) {
                // Add field that indicates whether read confirmation output has been spent
                //  (in other words, if the message has been read)
                docInfo.sendMessage.readConfirmation.spent = false;
            }
            else if (doc.type === Transaction.type.read_confirmation.name) {
                // Get rid of fields that are not important for received tx
                docInfo.readConfirmation = _.omit(docInfo.readConfirmation, ['feeAmount', 'txSize']);
            }

            //  Prepared to save received tx to the local database
            txidRcvdTxDocToCreate.set(doc.txid, {
                type: doc.type,
                txid: doc.txid,
                receivedDate: new Date(data[doc.txid].timereceived * 1000),
                sentTransaction_id: doc._id,
                info: docInfo
            });
        });

        // For all other transactions (not the ones sent by this Catenis node)...
        for (let txid in data) {
            //noinspection JSUnfilteredForInLoop
            if (!txidRcvdTxDocToCreate.has(txid)) {
                // Parse transaction's outputs and try to identify the type
                //  of transaction
                //noinspection JSUnfilteredForInLoop
                const voutInfo = parseTxVouts(data[txid].details);

                if (isSysFundingTxVouts(voutInfo)) {
                    // Transaction used to fund the system has been received

                    // Prepare to emit event notifying of new transaction received
                    //noinspection JSUnfilteredForInLoop
                    eventsToEmit.push({
                        name: TransactionMonitor.notifyEvent.sys_funding_tx_rcvd.name,
                        data: {
                            txid: txid
                        }
                    });

                    // Prepared to save received tx to the local database
                    //noinspection JSUnfilteredForInLoop
                    txidRcvdTxDocToCreate.set(txid, {
                        type: Transaction.type.sys_funding.name,
                        txid: txid,
                        receivedDate: new Date(data[txid].timereceived * 1000),
                        confirmation: {
                            confirmed: false
                        }
                    });
                }
                // TODO: parse transaction (using Transaction.fromHex()) and try to identify Catenis transactions (using tx.matches())
                // TODO: when adding a new received send message Catenis transaction, a new Message doc/rec needs to be created so the message (from another Catenis node) can be referenced by its message id
            }
        }

        // Save received transactions
        for (let docRcvdTx of txidRcvdTxDocToCreate.values()) {
            docRcvdTx._id = Catenis.db.collection.ReceivedTransaction.insert(docRcvdTx);
        }

        // Emit notification events
        eventsToEmit.forEach(event => {
            this.emit(event.name, event.data);
        });
    }
    catch (err) {
        // Error while handling new blocks event. Log error condition
        Catenis.logger.ERROR('Error while handling new transaction event.', err);
    }
}


// TransactionMonitor class (public) properties
//

TransactionMonitor.internalEvent = Object.freeze({
    new_blocks: 'new_blocks',
    new_transactions: 'new_transactions',
    blockchain_poll_done: 'blockchain_poll_done'
});

TransactionMonitor.notifyEvent = Object.freeze({
    // Events used to notify when a transaction of a given type is confirmed
    sys_funding_tx_conf: Object.freeze({
        name: 'sys_funding_tx_conf',
        description: 'Transaction used to fund the system has been confirmed'
    }),
    funding_provision_system_device_tx_conf: Object.freeze({
        name: 'funding_provision_system_device_tx_conf',
        description: 'Funding transaction sent for provisioning Catenis Hub device has been confirmed'
    }),
    funding_provision_client_srv_credit_tx_conf: Object.freeze({
        name: 'funding_provision_client_srv_credit_tx_conf',
        description: 'Funding transaction sent for provisioning service credit for a client has been confirmed'
    }),
    funding_provision_client_device_tx_conf: Object.freeze({
        name: 'funding_provision_client_device_tx_conf',
        description: 'Funding transaction sent for provisioning a device for a client has been confirmed'
    }),
    funding_add_extra_tx_pay_funds_tx_conf: Object.freeze({
        name: 'funding_add_extra_tx_pay_funds_tx_conf',
        description: 'Funding transaction sent for adding funds to pay for transaction expenses has been confirmed'
    }),
    issue_locked_asset_tx_conf: Object.freeze({
        name: 'issue_locked_asset_tx_conf',
        description: 'Transaction sent for issuing (Colored Coins) assets (of a given type) that cannot be reissued has been confirmed'
    }),
    issue_unlocked_asset_tx_conf: Object.freeze({
        name: 'issue_unlocked_asset_tx_conf',
        description: 'Transaction sent for issuing or reissuing (Colored Coins) assets (of a given type) has been confirmed'
    }),
    // Events used to notify when a transaction of a given type is received
    sys_funding_tx_rcvd: Object.freeze({
        name: 'sys_funding_tx_rcvd',
        description: 'Transaction used to fund the system has been received'
    }),
    send_message_tx_rcvd: Object.freeze({
        name: 'send_message_tx_rcvd',
        description: 'Transaction used to send data message between devices has been received'
    }),
    read_confirmation_tx_rcvd: Object.freeze({
        name: 'read_confirmation_tx_rcvd',
        description: 'Transaction used to confirm that messages have been read by receiving devices has been received'
    }),
    transfer_asset_tx_rcvd: Object.freeze({
        name: 'transfer_asset_tx_rcvd',
        description: 'Transaction used to transfer (Colored Coins) assets between devices has been received'
    })
});


// Definition of module (private) functions
//

function processConfirmedSentTransactions(doc, eventsToEmit) {
    if (doc.type === Transaction.type.funding.name) {
        // Prepare to emit event notifying of confirmation of funding transaction
        const notifyEvent = getTxConfNotifyEventFromFundingEvent(doc.info.funding.event.name);

        if (notifyEvent) {
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
        const notifyEvent = getTxConfNotifyEventFromTxType(doc.type);

        if (notifyEvent) {
            const txInfo = doc.info[Transaction.type[doc.type].dbInfoEntryName];

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

    if (doc.replacedByTxid !== undefined) {
        // A transaction that had been replaced by another transaction is being confirmed.
        //  Just log warning condition only for now
        // TODO: in the future, emit event so this condition can be treated by module responsible for sending read confirmation transactions
        Catenis.logger.WARN('Transaction that had been replaced by another transaction is being confirmed.', {
            txid: doc.txid,
            replacedByTxid: doc.replacedByTxid
        });
    }
}

function processConfirmedReceivedTransactions(doc, eventsToEmit) {
    if (doc.type === Transaction.type.sys_funding.name) {
        // Prepare to emit event notifying of confirmation of system funding transaction
        eventsToEmit.push({
            name: TransactionMonitor.notifyEvent.sys_funding_tx_conf.name,
            data: {
                txid: doc.txid
            }
        });
    }
}

function getTxConfNotifyEventFromFundingEvent(fundingEventName) {
    const notifyEventName = 'funding_' + fundingEventName + '_tx_conf';

    return TransactionMonitor.notifyEvent[notifyEventName];
}

function getTxConfNotifyEventFromTxType(txTypeName) {
    const notifyEventName = txTypeName + '_tx_conf';

    return TransactionMonitor.notifyEvent[notifyEventName];
}

function getTxRcvdNotifyEventFromTxType(txTypeName) {
    const notifyEventName = txTypeName + '_tx_rcvd';

    return TransactionMonitor.notifyEvent[notifyEventName];
}

function parseTxVouts(txDetails) {
    const voutInfo = new Map();

    txDetails.forEach(detail => {
        if (!voutInfo.has(detail.vout)) {
            if ('address' in detail) {
                const addrInfo = Catenis.keyStore.getAddressInfo(detail.address, true);

                if (addrInfo !== null) {
                    voutInfo.set(detail.vout, {
                        isNullData: false,
                        addrInfo: addrInfo
                    });
                }
            }
            else if (detail.amount === 0) {
                // Assume its a null data output
                voutInfo.set(detail.vout, {isNullData: true});
            }
        }
    });

    return voutInfo;
}

function isSysFundingTxVouts(voutInfo) {
    let isTxVouts = false;

    for (let value of voutInfo.values()) {
        if (!value.isNullData && value.addrInfo.type === KeyStore.extKeyType.sys_fund_pay_addr.name) {
            isTxVouts = true;
            break;
        }
    }

    return isTxVouts;
}

function isSendMessageTxVouts(voutInfo) {
    let isTxVouts = false;

    if (voutInfo.has(0) && voutInfo.has(1) && voutInfo.has(2)) {
        const value0 = voutInfo.get(0),
            value1 = voutInfo.get(1),
            value2 = voutInfo.get(2);

        if (!value0.isNullData && value0.addrInfo.type === KeyStore.extKeyType.dev_main_addr.name &&
                !value1.isNullData && value1.addrInfo.type === KeyStore.extKeyType.dev_read_conf_addr.name &&
                value2.isNullData) {
            isTxVouts = true;
        }
    }

    return isTxVouts;
}


// Module code
//

// Lock function class
Object.freeze(TransactionMonitor);
