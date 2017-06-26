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
import BigNumber from 'bignumber.js';
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
    limitTxConfirmTime: txMonitorConfig.get('limitTxConfirmTime'),
    checkOldUnconfTxsInterval: txMonitorConfig.get('checkOldUnconfTxsInterval'),
    newTxsBatchProcDoneTimeout: txMonitorConfig.get('newTxsBatchProcDoneTimeout')
};

const externalEventHandlers = [];

// Definition of function classes
//

// TransactionMonitor class
export class TransactionMonitor extends events.EventEmitter {
    constructor (bcPollingInterval) {
        super();

        this.bcPollingInterval = bcPollingInterval;
        this.monitoringOn = false;
        this.doingBlockchainPoll = false;
        this.newBlockchainPollTick = false;
        this.syncingBlocks = false;
        this.memPoolTxids = new Set();
        this.processedTxids = new Map();
        this.processingNewBlocks = false;
        this.nextNewBlocksToProcess = [];
        this.processingNewTransactions = false;
        this.nextNewTransactionsToProcess = [];
        this.lastNewTxsBatchNumber = 0;
        this.newTxsBatchProcResult = new Map();  // Should be used to store processing result for new transactions batch that
                                                 //  have dependent blocks only

        // Retrieve height of last processed blockchain block from the database
        const docApp = Catenis.db.collection.Application.find({}, {fields: {lastBlockHeight: 1}}).fetch()[0];

        this.docAppId = docApp._id;
        this.lastBlockHeight = docApp.lastBlockHeight;
        this.blockHeightToReset = undefined;

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

            // Start polling the blockchain
            Meteor.defer(pollBlockchain.bind(this));
        }

        if (this.idCheckUnconfTxsInterval === undefined) {
            Catenis.logger.TRACE('Setting recurring timer to check for old unconfirmed transactions');
            this.idCheckUnconfTxsInterval = Meteor.setInterval(checkOldUnconfirmedTxs.bind(this), cfgSettings.checkOldUnconfTxsInterval);

            // Check for old unconfirmed transactions
            Meteor.defer(checkOldUnconfirmedTxs.bind(this));
        }

        this.monitoringOn = true;
    }

    stopMonitoring() {
        if (this.idPollBcInterval !== undefined) {
            Catenis.logger.TRACE('Stop polling blockchain');
            Meteor.clearInterval(this.idPollBcInterval);
            this.idPollBcInterval = undefined;
        }

        if (this.idCheckUnconfTxsInterval !== undefined) {
            Meteor.clearInterval(this.idCheckUnconfTxsInterval);
            this.idCheckUnconfTxsInterval = undefined;
        }

        this.monitoringOn = false;
    }

    forceBlockchainPoll() {
        Catenis.logger.TRACE('Method forceBlockchainPoll() called');
        if (!this.doingBlockchainPoll) {
            // Blockchain polling is not underway. So just call the method
            //  to handle it (note that this will block until the polling is done)
            Catenis.logger.TRACE('Forcing execution of method to poll blockchain (and process received blocks)');
            pollBlockchain.call(this);
        }
        else {
            // Blockchain polling is underway. We need to wait for
            //  it to finish before returning
            Catenis.logger.TRACE('Method to poll blockchain already being executed. Wait for it to finish');

            // Make sure that the following code is executed in its own fiber
            Future.task(() => {
                const fut = new Future();

                // Waits for blockchain poll done event
                const pollEndCallback = () => {
                    Catenis.logger.TRACE('Block polling done event received');
                    fut.return();
                };

                this.on(TransactionMonitor.internalEvent.blockchain_polling_done, pollEndCallback);

                // And set a timeout as a precaution
                const idTmo = setTimeout(() => {
                    Catenis.logger.TRACE('Timeout while waiting for block polling done event');
                    fut.return();
                }, this.bcPollingInterval);

                fut.wait();

                // Polling is done
                this.removeListener(TransactionMonitor.internalEvent.blockchain_polling_done, pollEndCallback);
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
    Catenis.db.collection.Application.update({_id: this.docAppId}, {$set: {lastBlockHeight: (this.blockHeightToReset ? this.blockHeightToReset - 1 : this.lastBlockHeight)}});
}

// TODO: try to write a new version of the pollBlockchain() method using BitcoinCore's litstransactions RPC call to avoid having to call the gettransaction RPC call repeatedly for each new tx in the mempool and each tx in a block
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
                const newTxids = this.memPoolTxids.size === 0 ? currMempoolTxids : currMempoolTxids.filter((currTxid) => {
                    return !this.memPoolTxids.has(currTxid);
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
                let hasDependentBlocks = false;

                if (this.blockHeightToReset) {
                    Catenis.logger.WARN(util.format('Reseting blockchain block processing: last block height: %s, new block height to reset: %s)', this.lastBlockHeight, this.blockHeightToReset));
                    // Reset block height
                    this.lastBlockHeight = this.blockHeightToReset - 1;
                    this.blockHeightToReset = undefined;
                }

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
                            let newTxsBatchDependency = undefined;
                            const ctnTxsInBlock = [];
                            const replacedTxids = {};

                            newCtnTxids = blockInfo.tx.reduce((result, txid) => {
                                let txInfo;

                                // Retrieve info of transactions that are associated with
                                //  Catenis addresses (addresses imported onto BitcoinCore)
                                try {
                                    // Make sure that error thrown by getTransaction() is not logged.
                                    //  This is necessary because any transaction that are not associated
                                    //  with a wallet address will make getTransaction() to throw an error
                                    //  (with code = RPC_INVALID_ADDRESS_OR_KEY)
                                    txInfo = Catenis.bitcoinCore.getTransaction(txid, false);
                                }
                                catch (err) {
                                    if (!((err instanceof Meteor.Error) && err.error === 'ctn_btcore_rpc_error' && err.details !== undefined && typeof err.details.code === 'number'
                                            && err.details.code === BitcoinCore.rpcErrorCode.RPC_INVALID_ADDRESS_OR_KEY)) {
                                        // An error other than indication that it is a non-wallet tx id.
                                        //  Just re-throws it
                                        throw err;
                                    }
                                }

                                if (txInfo) {
                                    // Checks if ID of Catenis tx had been replaced (possibly) due to malleability
                                    if (txInfo.walletconflicts.length > 0) {
                                        txInfo.walletconflicts.some((cnfltTxid) => {
                                            const cnfltTxInfo = Catenis.bitcoinCore.getTransaction(cnfltTxid);

                                            if (cnfltTxInfo.confirmations < 0 && Transaction.areTxsIdentical(cnfltTxInfo, txInfo)) {
                                                // Conflicting tx is identical to confirmed tx. Assume it is a tx the ID of which
                                                //  had been replaced due to malleability

                                                // Replace ID of confirmed tx with ID of conflicting (original) tx
                                                replacedTxids[cnfltTxid] = txid;
                                                txid = cnfltTxid;

                                                // Stop loop (walletconflicts.some)
                                                return true;
                                            }

                                            return false;
                                        });
                                    }

                                    // Add tx ID to list of Catenis transactions in block
                                    ctnTxsInBlock.push(txid);
                                }

                                if (this.processedTxids.has(txid)) {
                                    alreadyProcessedTxids.push(txid);
                                }
                                else {
                                    // New transactions have arrived
                                    if (txInfo !== undefined) {
                                        // Transaction info is available, which means that it is
                                        //  a Catenis transaction. So add it to list of new transactions
                                        result[txid] = txInfo;

                                        // Indicates that this block is dependent on the processing of the
                                        //  next new transactions batch
                                        newTxsBatchDependency = this.lastNewTxsBatchNumber + 1;
                                        hasDependentBlocks = true;
                                    }
                                }

                                return result;
                            }, newCtnTxids);

                            if (ctnTxsInBlock.length > 0) {
                                // Block has Catenis transactions. Add it to list of new blocks
                                const ctnBlockInfo = {
                                    height: currBlockHeight,
                                    hash: blockInfo.hash,
                                    time: blockInfo.time,
                                    ctnTxids: ctnTxsInBlock,
                                    replacedTxids: replacedTxids
                                };

                                if (newTxsBatchDependency) {
                                    ctnBlockInfo.newTxsBatchDependency = newTxsBatchDependency;
                                }

                                newBlocks[currBlockHeight] = ctnBlockInfo;
                            }
                        }

                        // Remove tx ids already processed from list of processed tx ids
                        alreadyProcessedTxids.forEach((txid) => {
                            this.processedTxids.delete(txid);
                        });

                        currBlockHeight++;
                    }
                    while (this.monitoringOn && !this.newBlockchainPollTick && currBlockHeight <= blockCount);

                    // Update last block height
                    this.lastBlockHeight = currBlockHeight - 1;

                    // Make sure not to persist updated last block height if a block height reset is underway
                    if (!this.blockHeightToReset) {
                        // Persist new last block height
                        persistLastBlockHeight.call(this);
                    }
                }

                // Save new mempool tx ids
                this.memPoolTxids = new Set(currMempoolTxids);

                let newCtnTxidKeys = undefined;

                if ((newCtnTxidKeys = Object.keys(newCtnTxids)).length > 0) {
                    // Make sure to filter out any transaction that have already been saved
                    //  as ReceivedTransactions in local database
                    let filtered = false;

                    Catenis.db.collection.ReceivedTransaction.find({txid: {$in: newCtnTxidKeys}}, {fields: {txid: 1}}).forEach(doc => {
                        Catenis.logger.TRACE('Transaction identified as new Catenis transaction had already been received', {txid: doc.txid});
                        delete newCtnTxids[doc.txid];
                        filtered = true;
                    });

                    if (!filtered || Object.keys(newCtnTxids).length > 0) {
                        // Emit (internal) event notifying that new transactions have arrived
                        this.emit(TransactionMonitor.internalEvent.new_transactions, {
                            batchNumber: ++this.lastNewTxsBatchNumber,
                            hasDependentBlocks: hasDependentBlocks,
                            ctnTxids: newCtnTxids
                        });
                    }
                }

                if (Object.keys(newBlocks).length > 0) {
                    // Emit (internal) event notifying that new blocks have arrived
                    this.emit(TransactionMonitor.internalEvent.new_blocks, newBlocks);
                }

                // Purge old tx ids from list of processed tx ids
                if (this.processedTxids.size > 0) {
                    const dtNow = new Date(),
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
            // Continue processing if monitoring is on, a new blockchain pool tick has happened
            //  and there are still more blocks to be processed
            while (this.monitoringOn && this.newBlockchainPollTick && currBlockHeight !== undefined && currBlockHeight <= blockCount);
        }
        catch (err) {
            // Error polling blockchain. Log error condition
            Catenis.logger.ERROR('Error while polling blockchain.', err);
        }
        finally {
            Catenis.logger.TRACE('Blockchain polling is done for now');
            this.doingBlockchainPoll = false;
            this.syncingBlocks = false;
            Catenis.application.setSyncingBlocks(false);

            // Emit (internal) event notifying that polling is done
            this.emit(TransactionMonitor.internalEvent.blockchain_polling_done);
        }
    }
    else {
        // Indicate that a new blockchain poll tick has happened
        this.newBlockchainPollTick = true;
    }
}

//  data: {
//    <block height>: {
//      height: [Number],  // Block height
//      hash: [String],  // Block hash
//      time: [Number],  // Block time
//      ctnTxids: [
//        [String],  // ID of Catenis transaction contained in block
//        ...
//      ],
//      replacedTxids: [{
//          <original txid>: [String]  // ID of confirmed transaction that had replaced the original one
//        },
//        ...
//      ],
//      newTxsBatchDependency: [Number]  // Number of new transactions batch that should be processed before this block is processed
//    }
//  }
//
//  NOTE: only blocks containing Catenis transactions should be handled
function handleNewBlocks(data) {
    Catenis.logger.TRACE('New blocks event handler called.', {data: data});
    // Make sure that a block height reset is not underway
    if (!this.blockHeightToReset) {
        // Make sure that new blocks are not currently being processed
        if (!this.processingNewBlocks) {
            this.processingNewBlocks = true;

            do {
                // Confirm transactions found in received blocks
                for (let blockHeight in data) {
                    try {
                        const eventsToEmit = [];

                        //noinspection JSUnfilteredForInLoop
                        const blockInfo = data[blockHeight];

                        // Checks if this block depends on the processing of a new transactions batch
                        if (blockInfo.newTxsBatchDependency) {
                            Catenis.logger.TRACE(util.format('Processing of block (height: %s) depends on processing of new transactions batch (number: %s)', blockHeight, blockInfo.newTxsBatchDependency));
                            validateNewTxsBatchDependency.call(this, blockInfo);
                            Catenis.logger.TRACE(util.format('Continuing processing of block (height: %s)', blockHeight));
                        }

                        // Find Message database docs/recs associated with (Catenis) transactions in
                        //  the current block that have not had their tx id confirmed yet and update
                        //  their confirmed status
                        //
                        // NOTE: this must be done before sent/received transactions are processed to
                        //      avoid that the tx id be replaced in the Message doc/rec before we
                        //      confirm it
                        Catenis.db.collection.Message.update({
                            'blockchain.txid': {$in: blockInfo.ctnTxids},
                            'blockchain.confirmed': false
                        }, {
                            $set: {
                                'blockchain.confirmed': true
                            }
                        }, {multi: true});

                        //  Retrieve sent transactions found in block that are not yet confirmed
                        const idSentTxDocsToUpdate = Catenis.db.collection.SentTransaction.find({
                            txid: {$in: blockInfo.ctnTxids},
                            'confirmation.confirmed': false
                        }, {fields: {_id: 1, type: 1, txid: 1, replacedByTxid: 1, info: 1}}).map((doc) => {
                            const confTxid = blockInfo.replacedTxids[doc.txid];

                            if (confTxid) {
                                // Sent transaction had been replaced with another (confirmed) transaction
                                //  due to malleability

                                // Fix malleability in local database and replace tx id in current database doc
                                Transaction.fixMalleability(Transaction.source.sent_tx, doc.txid, confTxid);
                                doc.txid = confTxid;
                            }

                            processConfirmedSentTransactions(doc, eventsToEmit);

                            return doc._id;
                        });

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

                        // Retrieve received transactions found in block that are not yet confirmed
                        //  Note: only transactions received that have not been sent by this Catenis node
                        //      should have been considered
                        const idRcvdTxDocsToUpdate = Catenis.db.collection.ReceivedTransaction.find({
                            txid: {$in: blockInfo.ctnTxids},
                            sentTransaction_id: {$exists: false},
                            'confirmation.confirmed': false
                        }, {fields: {_id: 1, type: 1, txid: 1}}).map((doc) => {
                            const confTxid = blockInfo.replacedTxids[doc.txid];

                            if (confTxid) {
                                // Received transaction had been replaced with another (confirmed) transaction
                                //  due to malleability

                                // Fix malleability in local database and replace tx id in current database doc
                                Transaction.fixMalleability(Transaction.source.received_tx, doc.txid, confTxid);
                                doc.txid = confTxid;
                            }

                            processConfirmedReceivedTransactions(doc, eventsToEmit);

                            return doc._id;
                        });

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

                        // Emit notification events
                        eventsToEmit.forEach(event => {
                            this.emit(event.name, event.data);
                        });
                    }
                    catch (err) {
                        // Error while processing new block. Log error condition
                        //noinspection JSUnfilteredForInLoop
                        Catenis.logger.ERROR(util.format('Error while processing new block (height: %s)', blockHeight), err);

                        // Reset block height so faulty block and any subsequent blocks are reprocessed
                        this.blockHeightToReset = blockHeight;
                        persistLastBlockHeight.call(this);

                        // Make sure that next blocks are not processed
                        this.nextNewBlocksToProcess = [];
                        break;
                    }
                }

                data = this.nextNewBlocksToProcess.shift();
            }
            while (data);

            this.processingNewBlocks = false;
        }
        else {
            // Save new blocks data to be processed later
            this.nextNewBlocksToProcess.push(data);
        }
    }
}

//  data: {
//    batchNumber: [Number],  // New txs batch number
//    hasDependentBlocks: [Boolean],  // Indicates whether there are any blocks that are dependent on this new txs batch
//    ctnTxids: {
//      <txid>: [Object],  // Result from getTransaction() RPC method
//      ...
//    }
//  }
function handleNewTransactions(data) {
    Catenis.logger.TRACE('New transactions event handler called.', {data: data});
    if (!this.processingNewTransactions) {
        this.processingNewTransactions = true;

        do {
            let procError = undefined;

            try {
                // TODO: identify different transaction types, and emit events for each type separately
                const eventsToEmit = [];

                // Identify received transactions that had been sent by this Catenis node
                const sentTxids = new Set();
                const rcvdTxDocsToCreate = [];
                const txTimeRcvdSentTxids = new Map();

                Catenis.db.collection.SentTransaction.find({
                    txid: {$in: Object.keys(data.ctnTxids)}
                }, {fields: {_id: 1, type: 1, txid: 1, info: 1}}).forEach(doc => {
                    sentTxids.add(doc.txid);

                    // Filter the type of transactions that should be processed as received transactions: 'send_message',
                    //  'read_confirmation', and 'transfer_asset' for now
                    if (doc.type === Transaction.type.send_message.name || doc.type === Transaction.type.read_confirmation.name || doc.type === Transaction.type.transfer_asset.name) {
                        Catenis.logger.TRACE('Processing sent transaction as received transaction', doc);
                        // Prepare to emit event notifying of new transaction received
                        // TODO: in the future, when other Catenis nodes are active, only send notification event if target device belongs to this node
                        const notifyEvent = getTxRcvdNotifyEventFromTxType(doc.type);

                        if (notifyEvent) {
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
                        const txTimeReceived = data.ctnTxids[doc.txid].timereceived;

                        rcvdTxDocsToCreate.push({
                            type: doc.type,
                            txid: doc.txid,
                            receivedDate: new Date(txTimeReceived * 1000),
                            sentTransaction_id: doc._id,
                            info: docInfo
                        });

                        // Save txid associated with its time received
                        if (txTimeRcvdSentTxids.has(txTimeReceived)) {
                            txTimeRcvdSentTxids.get(txTimeReceived).push(doc.txid);
                        }
                        else {
                            txTimeRcvdSentTxids.set(txTimeReceived, [doc.txid]);
                        }
                    }
                });

                // For all other transactions (not the ones sent by this Catenis node)...
                for (let txid in data.ctnTxids) {
                    //noinspection JSUnfilteredForInLoop
                    if (!sentTxids.has(txid)) {
                        //noinspection JSUnfilteredForInLoop
                        Catenis.logger.TRACE('Processing non-sent transaction as received transaction', {txid: txid});
                        // Parse transaction's outputs and try to identify the type
                        //  of transaction
                        //noinspection JSUnfilteredForInLoop
                        const voutInfo = parseTxVouts(data.ctnTxids[txid].details);
                        let payments;

                        if ((payments = sysFundingPayments(voutInfo)).length > 0) {
                            // Transaction used to fund the system has been received

                            // Prepare to emit event notifying of new transaction received
                            //noinspection JSUnfilteredForInLoop
                            eventsToEmit.push({
                                name: TransactionMonitor.notifyEvent.sys_funding_tx_rcvd.name,
                                data: {
                                    txid: txid,
                                    addresses: payments.map((payment) => payment.address)
                                }
                            });

                            // Prepared to save received tx to the local database
                            //noinspection JSUnfilteredForInLoop
                            rcvdTxDocsToCreate.push({
                                type: Transaction.type.sys_funding.name,
                                txid: txid,
                                receivedDate: new Date(data.ctnTxids[txid].timereceived * 1000),
                                confirmation: {
                                    confirmed: false
                                },
                                info: {
                                    sysFunding: {
                                        fundAddresses: payments.map((payment) => {
                                            return {
                                                path: payment.path,
                                                amount: payment.amount
                                            };
                                        })
                                    }
                                }
                            });
                        }
                        // TODO: parse transaction (using Transaction.fromHex()) and try to identify Catenis transactions (using tx.matches())
                        // TODO: when adding a new received send message Catenis transaction, a new Message doc/rec needs to be created so the message (from another Catenis node) can be referenced by its message id
                    }
                }

                // Save received transactions
                rcvdTxDocsToCreate.forEach((docRcvdTx) => {
                    docRcvdTx._id = Catenis.db.collection.ReceivedTransaction.insert(docRcvdTx);
                });

                // Update existing Message docs with time tx has been received
                for (let [txTimeReceived, txids] of txTimeRcvdSentTxids) {
                    Catenis.db.collection.Message.update({
                        'blockchain.txid': {$in: txids}
                    }, {
                        $set: {receivedDate: new Date(txTimeReceived * 100)}
                    }, {
                        multi: true
                    });
                }

                // Emit notification events
                eventsToEmit.forEach(event => {
                    this.emit(event.name, event.data);
                });
            }
            catch (err) {
                // Error while processing new transactions batch. Log error condition
                Catenis.logger.ERROR(util.format('Error while processing new transactions batch (number: %s).', data.batchNumber), err);
                procError = err;

                // Remove tx ids in this batch from list of processed tx ids to force them to be reprocessed
                for (let txid in data.ctnTxids) {
                    //noinspection JSUnfilteredForInLoop
                    if (this.processedTxids.has(txid)) {
                        //noinspection JSUnfilteredForInLoop
                        this.processedTxids.delete(txid);
                    }
                }
            }
            finally {
                if (data.hasDependentBlocks) {
                    // Save processing result
                    saveNewTxsProcResult.call(this, data.batchNumber, procError);

                    // Emit event notifying that processing of current new transactions batch had finished
                    this.emit(TransactionMonitor.internalEvent.new_txs_batch_processing_done, data.batchNumber, procError);
                }

                data = this.nextNewTransactionsToProcess.shift();
            }
        }
        while (data);

        this.processingNewTransactions = false;
    }
    else {
        // Save new transactions data to be processed later
        this.nextNewTransactionsToProcess.push(data);
    }
}

function validateNewTxsBatchDependency(blockInfo) {
    let newTxsBatchProcError = undefined;

    // Checks if new transactions batch on which block is dependent has already been processed
    if (!this.newTxsBatchProcResult.has(blockInfo.newTxsBatchDependency)) {
        Catenis.logger.TRACE(util.format('New transactions batch (number: %s) on which block (height: %s) depends has not yet finished processing. Wait until it finished', blockInfo.newTxsBatchDependency, blockInfo.height));
        // if not, waits until it finishes processing
        let timeout = false;

        // Make sure that the following code is executed in its own fiber
        Future.task(() => {
            const fut = new Future();

            // Waits for new transactions batch processing done event
            const newTxsBatchProcDoneCallback = (batchNumber, error) => {
                Catenis.logger.TRACE('New transactions batch processing done event received', {batchNumber: batchNumber, error: error});
                if (batchNumber === blockInfo.newTxsBatchDependency) {
                    Catenis.logger.TRACE('Finished batch matches batch we are waiting on');
                    newTxsBatchProcError = error;

                    fut.return();
                }
            };

            this.on(TransactionMonitor.internalEvent.new_txs_batch_processing_done, newTxsBatchProcDoneCallback);

            // And set a timeout as a precaution
            const idTmo = setTimeout(() => {
                Catenis.logger.TRACE('Timeout waiting for new transactions batch processing done event');
                timeout = true;
                fut.return();
            }, cfgSettings.newTxsBatchProcDoneTimeout);

            fut.wait();

            this.removeListener(TransactionMonitor.internalEvent.blockchain_polling_done, newTxsBatchProcDoneCallback);
            clearTimeout(idTmo);
        }).wait();

        if (timeout) {
            Catenis.logger.ERROR(util.format('Timeout while waiting on new transactions batch (batchNumer: %s) to finish processing before proceeding with processing of dependent block (height: %s)', blockInfo.newTxsBatchDependency, blockInfo.height));
            throw new Error(util.format('Timeout while waiting on new transactions batch (batchNumer: %s) to finish processing before proceeding with processing of dependent block (height: %s)', blockInfo.newTxsBatchDependency, blockInfo.height));
        }
    }
    else {
        Catenis.logger.TRACE(util.format('New transactions batch (number: %s) on which block (height: %s) depends has already finished processing', blockInfo.newTxsBatchDependency, blockInfo.height));
        // Otherwise, gets processing error if any
        newTxsBatchProcError = this.newTxsBatchProcResult.get(blockInfo.newTxsBatchDependency).error;
    }

    if (newTxsBatchProcError) {
        Catenis.logger.ERROR(util.format('Processing of new transactions batch (number: %s) on which block (height: %s) is dependent finished with an error', blockInfo.newTxsBatchDependency, blockInfo.height), newTxsBatchProcError);
        throw new Error(util.format('Processing of new transactions batch (number: %s) on which block (height: %s) is dependent finished with an error', blockInfo.newTxsBatchDependency, blockInfo.height));
    }
}

function saveNewTxsProcResult(newBatchNumber, error) {
    // Purge old entries first
    const dtNow = new Date();
    const limitTime = dtNow.setMilliseconds(dtNow.getMilliseconds() - (cfgSettings.newTxsBatchProcDoneTimeout * 2));

    this.newTxsBatchProcResult.forEach((result, batchNumber, map) => {
        if (result.time < limitTime) {
            map.delete(batchNumber);
        }
    });

    // Now add the new entry
    this.newTxsBatchProcResult.set(newBatchNumber, {
        time: Date.now(),
        success: !error,
        error: error
    });
}

function checkOldUnconfirmedTxs() {
    Catenis.logger.TRACE('Checking for old unconfirmed transactions');
    const limitDate = new Date();
    limitDate.setMinutes(limitDate.getMinutes() - cfgSettings.limitTxConfirmTime);

    // Look for old sent transactions that have not been confirmed yet, and
    //  check if they have already been confirmed
    const docOldUnconfSentTxs = [];

    Catenis.db.collection.SentTransaction.find({
        'confirmation.confirmed': false,
        sentDate: {$lt: limitDate},
        replacedByTxid: {$exists: false}
    }, {fields: {_id: 1, type:1, txid: 1, sentDate: 1, info: 1}}).forEach(doc => {
        docOldUnconfSentTxs.push(doc);
    });

    // Look for old received transactions that have not been confirmed yet, and
    //  check if they have already been confirmed
    //  Note: only transactions received that have not been sent by this Catenis node
    //      should have been considered
    const docOldUnconfRcvdTxs = [];

    Catenis.db.collection.ReceivedTransaction.find({
        sentTransaction_id: {$exists: false},
        'confirmation.confirmed': false,
        receivedDate: {$lt: limitDate}
    }, {fields: {_id: 1, type:1, txid: 1, receivedDate: 1, info: 1}}).forEach(doc => {
        docOldUnconfRcvdTxs.push(doc);
    });

    if (docOldUnconfSentTxs.length > 0 || docOldUnconfRcvdTxs.length > 0) {
        const oldUnconfTxs = {};

        if (docOldUnconfSentTxs.length > 0) {
            oldUnconfTxs['sentTransactions'] = docOldUnconfSentTxs;
        }

        if (docOldUnconfRcvdTxs.length > 0) {
            oldUnconfTxs['receivedTransactions'] = docOldUnconfRcvdTxs;
        }

        // Issue a warning alert about old unconfirmed transactions
        Catenis.logger.WARN('Found old unconfirmed transactions', oldUnconfTxs);

        // Fix old unconfirmed transactions
        Catenis.logger.TRACE('Fixing old unconfirmed transactions');
        if (docOldUnconfSentTxs.length > 0) {
            fixOldUnconfirmedTxs.call(this, docOldUnconfSentTxs, Transaction.source.sent_tx);
        }

        if (docOldUnconfRcvdTxs.length > 0) {
            fixOldUnconfirmedTxs.call(this, docOldUnconfRcvdTxs, Transaction.source.received_tx);
        }
    }
}

function fixOldUnconfirmedTxs(docTxs, source) {
    try {
        const eventsToEmit = [];
        const blocksWithTxsToConfirm = new Map();

        docTxs.forEach((docTx) => {
            // Retrieve info about transaction and check if tx is confirmed
            const txInfo = Catenis.bitcoinCore.getTransaction(docTx.txid, false);
            let isConfirmed = false;
            let blockInfo;

            if (txInfo.confirmations > 0) {
                // Indicate that transaction is confirmed and save info about block that
                //  includes this tx
                isConfirmed = true;

                blockInfo = {
                    hash: txInfo.blockhash,
                    time: txInfo.blocktime
                };
            }
            else if (txInfo.confirmations < 0 && txInfo.walletconflicts.length > 0) {
                // Transaction has confirmed conflicting transactions. Checks if this conflict
                //  is due to transaction malleability
                txInfo.walletconflicts.some((cnfltTxid) => {
                    const cnfltTxInfo = Catenis.bitcoinCore.getTransaction(cnfltTxid);

                    if (cnfltTxInfo.confirmations > 0 && Transaction.areTxsIdentical(cnfltTxInfo, txInfo)) {
                        // Conflicting (confirmed) tx is identical to original tx. Assume that original tx
                        //  had its ID replaced due to malleability

                        // Fix malleability in local database and replace tx id in current database doc
                        Transaction.fixMalleability(source, docTx.txid, cnfltTxid);
                        docTx.txid = cnfltTxid;

                        // Indicate that transaction is confirmed and save info about block that
                        //  includes this tx
                        isConfirmed = true;

                        blockInfo = {
                            hash: cnfltTxInfo.blockhash,
                            time: cnfltTxInfo.blocktime
                        };

                        // Stop loop (walletconflicts.some)
                        return true;
                    }

                    return false;
                });
            }

            if (isConfirmed) {
                // Process confirmed transactions
                (source === Transaction.source.sent_tx ? processConfirmedSentTransactions : processConfirmedReceivedTransactions)(docTx, eventsToEmit);

                // Save transactions to update confirmation state in local database by block
                if (!blocksWithTxsToConfirm.has(blockInfo.hash)) {
                    blocksWithTxsToConfirm.set(blockInfo.hash, {
                        info: blockInfo,
                        idTxDocs: [docTx._id]
                    });
                }
                else {
                    blocksWithTxsToConfirm.get(blockInfo.hash).idTxDocs.push(docTx._id);
                }
            }
        });

        for (let block of blocksWithTxsToConfirm.values()) {
            // Update sent transaction doc/rec to confirm them
            Catenis.db.collection[source === Transaction.source.sent_tx ? 'SentTransaction' : 'ReceivedTransaction'].update({
                _id: {$in: block.idTxDocs}
            }, {
                $set: {
                    'confirmation.confirmed': true,
                    'confirmation.blockHash': block.info.hash,
                    'confirmation.confirmationDate': new Date(block.info.time * 1000)
                }
            }, {multi: true});
        }

        // Emit notification events
        eventsToEmit.forEach(event => {
            this.emit(event.name, event.data);
        });
    }
    catch (err) {
        Catenis.logger.ERROR(util.format('Error trying to fix old unconfirmed %s transactions.', source === Transaction.source.sent_tx ? 'sent' : 'received'), err);
    }
}


// TransactionMonitor class (public) properties
//

TransactionMonitor.internalEvent = Object.freeze({
    new_blocks: 'new_blocks',
    new_transactions: 'new_transactions',
    blockchain_polling_done: 'blockchain_polling_done',
    new_txs_batch_processing_done: 'new_txs_batch_processing_done'
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
                        address: detail.address,
                        addrInfo: addrInfo,
                        amount: new BigNumber(detail.amount).times(100000000).toNumber()
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

function sysFundingPayments(voutInfo) {
    let sysFundPayments = [];

    for (let value of voutInfo.values()) {
        if (!value.isNullData && value.addrInfo.type === KeyStore.extKeyType.sys_fund_pay_addr.name) {
            sysFundPayments.push({
                address: value.address,
                path: value.addrInfo.path,
                amount: value.amount
            });
        }
    }

    return sysFundPayments;
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
