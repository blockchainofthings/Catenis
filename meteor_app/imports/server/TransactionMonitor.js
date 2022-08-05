/**
 * Created by Claudio on 2016-07-28.
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
import util from 'util';
import events from 'events';
// Third-party node modules
import config from 'config';
import Future from 'fibers/future';
// noinspection JSFileReferences
import BigNumber from 'bignumber.js';
import Loki from 'lokijs';
// Meteor packages
import { Meteor } from 'meteor/meteor';
// noinspection NpmUsedModulesInstalled
import { _ } from 'meteor/underscore';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { KeyStore } from './KeyStore';
import { Transaction } from './Transaction';
import { BcotPaymentTransaction } from './BcotPaymentTransaction';
import { BcotPayment } from './BcotPayment';
import { BcotReplenishmentTransaction } from './BcotReplenishmentTransaction';
import { OmniTransaction } from './OmniTransaction';
import { SettleOffChainMessagesTransaction } from './SettleOffChainMessagesTransaction';

// Config entries
const txMonitorConfig = config.get('transactionMonitor');

// Configuration settings
const cfgSettings = {
    blockchainPollingInterval: txMonitorConfig.get('blockchainPollingInterval'),
    mempoolExpiryHours: txMonitorConfig.get('mempoolExpiryHours'),
    purgeFoundNewCtnTxsInterval: txMonitorConfig.get('purgeFoundNewCtnTxsInterval'),
    limitTxConfirmTime: txMonitorConfig.get('limitTxConfirmTime'),
    checkOldUnconfTxsInterval: txMonitorConfig.get('checkOldUnconfTxsInterval'),
    checkOldUnconfTxsDelay: txMonitorConfig.get('checkOldUnconfTxsDelay'),
    blocksBehindToFixUnconfTxs: txMonitorConfig.get('blocksBehindToFixUnconfTxs'),
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
        this.blockchainPollPaused = false;
        this.syncingBlocks = true;  // Assume that will be syncing blocks in the beginning
        this.foundNewCtnTxids = new Map();
        this.processingNewBlocks = false;
        this.nextNewBlocksToProcess = [];
        this.processingNewTransactions = false;
        this.nextNewTransactionsToProcess = [];
        this.lastNewTxsBatchNumber = 0;
        this.newTxsBatchProcResult = new Map();  // Should be used to store processing result for new transactions batch that
                                                 //  have dependent blocks only

        // Retrieve height of last processed blockchain block from the database
        const docApp = Catenis.db.collection.Application.findOne({}, {fields: {lastBlockHeight: 1}});

        this.docAppId = docApp._id;
        this.lastBlock = {
            height: docApp.lastBlockHeight !== undefined ? docApp.lastBlockHeight : Catenis.bitcoinCore.getBlockCount() - 1
        };
        this.lastBlock.hash = getBlockHash(this.lastBlock.height);

        this.blockToReset = undefined;

        // Initialize in-memory database to hold Catenis transactions received/confirmed since
        //  last processed block (retrieved by calling getsinceblock Bitcoin Core RPC method)
        //
        //  Structure of collCntTx collection: {
        //    amount: [number],
        //    fee: [number],
        //    confirmations: [number],
        //    blockhash: [string],              // Only exists if confirmations > 0
        //    blockheight: [string],            // Only exists if confirmations > 0
        //    blockindex: [number],             // Only exists if confirmations > 0
        //    blocktime: [number],              // Only exists if confirmations > 0
        //    txid: [string],
        //    walletconflicts: [Array(string)], // If no conflicting txs, this is an empty array
        //    time: [number],
        //    timereceived: [number],
        //    bip125-replaceable: [string],     // Expected values: "yes|no|unknown"
        //    details: [{
        //      involvesWatchonly: [boolean],   // In our case, this should always be true
        //      account: [string],              // In our case, this should always be an empty string
        //      address: [string],
        //      category: [string],             // Expected values: "send|receive"
        //      amount: [number],
        //      label: [string],                // In our case, this should always be an empty string
        //      vout: [number],
        //      fee: [number],
        //      abandoned: [boolean]
        //    }]
        //  }
        this.db = new Loki();
        // noinspection JSCheckFunctionSignatures
        this.collCtnTx = this.db.addCollection('CtnTx', {
            unique: ['txid'],
            indices: [
                'confirmations',
                'blocktime',
                'time'
            ]
        });

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

            // Do not check for old unconfirmed transactions right now, but give it some time for the
            //  normal processing of blockchain blocks to catch up before doing the first check
            Meteor.setTimeout(checkOldUnconfirmedTxs.bind(this), cfgSettings.checkOldUnconfTxsDelay);
        }

        if (this.idPurgeFoundNewCtnTxsInterval === undefined) {
            // Set recurring timer to purge transactions from list of found new Catenis transactions
            Catenis.logger.TRACE('Setting recurring timer to purge transactions from list of found new Catenis transactions');
            this.idPurgeFoundNewCtnTxsInterval = Meteor.setInterval(purgeFoundNewCtnTxs.bind(this), cfgSettings.purgeFoundNewCtnTxsInterval);
        }

        this.monitoringOn = true;

        // Emit event signalling that transaction monitoring had just been turned on
        this.emit(TransactionMonitor.notifyEvent.tx_monitor_on.name);
    }

    stopMonitoring() {
        if (this.idPurgeFoundNewCtnTxsInterval !== undefined) {
            Catenis.logger.TRACE('Stop purging transactions from list of found new Catenis transactions');
            Meteor.clearInterval(this.idPurgeFoundNewCtnTxsInterval);
            this.idPurgeFoundNewCtnTxsInterval = undefined;
        }

        if (this.idCheckUnconfTxsInterval !== undefined) {
            Catenis.logger.TRACE('Stop checking for old unconfirmed transactions');
            Meteor.clearInterval(this.idCheckUnconfTxsInterval);
            this.idCheckUnconfTxsInterval = undefined;
        }

        if (this.idPollBcInterval !== undefined) {
            Catenis.logger.TRACE('Stop polling blockchain');
            Meteor.clearInterval(this.idPollBcInterval);
            this.idPollBcInterval = undefined;
        }

        this.monitoringOn = false;

        // Emit event signalling that transaction monitoring had just been turned on
        this.emit(TransactionMonitor.notifyEvent.tx_monitor_off.name);
    }

    pollNow() {
        if (this.monitoringOn) {
            Meteor.defer(pollBlockchain.bind(this));
        }
    }

    pausePoll() {
        if (this.monitoringOn) {
            this.blockchainPollPaused = true;
        }
    }

    unpausePoll() {
        if (this.blockchainPollPaused) {
            this.blockchainPollPaused = false;

            if (!this.doingBlockchainPoll && this.newBlockchainPollTick) {
                this.pollNow();
            }
        }
    }

    // Populate collCtnTx in-memory database collection with transactions received/confirmed
    //  since a given block (not including that block)
    //
    //  Arguments:
    //    blockHash: [string] - Hash of block after which to look for transactions
    //
    //  Return value:
    //    lastBlockHash: [string] - Hash of last block included in the search, or the same block hash passed if
    //                            -  that is the current last blockchain block
    loadCatenisTransactions(blockHash) {
        // Empty collection
        this.collCtnTx.clear();

        const sinceBlockResult = Catenis.bitcoinCore.listSinceBlock(blockHash);

        // Only include conflicting transactions (confirmations < 0) if new blocks have been
        //  included in search, that is the last block returned from the search is different
        //  than the passed block. The reason for that is because conflicting transactions are
        //  only used when processing confirmed transactions, and confirmed transactions are
        //  only returned when new blocks are included in the search
        const addConflictTxs = sinceBlockResult.lastblock !== blockHash;

        let lastTxid = undefined;

        const ctnTxs = sinceBlockResult.transactions.reduce((txList, tx) => {
            if (tx.confirmations >= 0 || addConflictTxs) {
                if (lastTxid === undefined || lastTxid !== tx.txid) {
                    // Begin of entries for a new transaction. So add a new transaction entry
                    lastTxid = tx.txid;

                    const txEntry = {
                        amount: tx.amount !== undefined ? tx.amount : 0,
                        fee: tx.fee !== undefined ? tx.fee : 0
                    };

                    _.extend(txEntry, _.pick(tx, [
                        'confirmations',
                        'blockhash',
                        'blockheight',
                        'blockindex',
                        'blocktime',
                        'txid',
                        'walletconflicts',
                        'time',
                        'timereceived',
                        'bip125-replaceable'
                    ]));

                    const detail = {};

                    _.extend(detail, _.pick(tx, [
                        'involvesWatchonly',
                        'address',
                        'category',
                        'amount',
                        'label',
                        'vout',
                        'fee',
                        'abandoned'
                    ]));

                    txEntry.details = [detail];

                    txList.push(txEntry);
                }
                else {
                    // This entry belongs to the last transaction entry. So just add a new
                    //  detail entry in the details array and update the amount and fee
                    const txEntry = txList[txList.length - 1];

                    if (tx.amount !== undefined) {
                        txEntry.amount = (new BigNumber(txEntry.amount)).plus(tx.amount).toNumber();
                    }

                    if (txEntry.fee === 0 && tx.fee !== undefined) {
                        txEntry.fee = tx.fee;
                    }

                    const detail = {};

                    _.extend(detail, _.pick(tx, [
                        'involvesWatchonly',
                        'address',
                        'category',
                        'amount',
                        'label',
                        'vout',
                        'fee',
                        'abandoned'
                    ]));

                    txEntry.details.push(detail);
                }
            }

            return txList;
        }, []);

        if (ctnTxs.length > 0) {
            // Add Catenis transactions to collection
            this.collCtnTx.insert(ctnTxs);
        }

        return sinceBlockResult.lastblock;
    }

    // Retrieve loaded Catenis transactions that have not been confirmed yet
    //
    //  Return value:
    //    newCtnTxs: {
    //      txid: [Object] - Catenis transaction entry, which is equivalent to result from gettransaction RPC
    //                     -  method except for the hex property which is not present
    //    }
    newCatenisTransactions() {
        // noinspection JSCheckFunctionSignatures
        return this.collCtnTx.chain()
            .find({confirmations: 0})
            .where(doc => !doc.details.some(detail => detail.abandoned !== undefined && detail.abandoned === true))
            .simplesort('time')
            .data({removeMeta: true})
            .reduce((result, doc) => {
                result[doc.txid] = doc;

                return result;
            }, {});
    }

    // Retrieve loaded Catenis transactions that have already been confirmed
    //  grouped by the blocks which contain them
    //
    //  Return value:
    //    ctnTxBlocks: {
    //      blockHash: {
    //        ctnTxs: {
    //          txid: [Object] - Catenis transaction entry, which is equivalent to result from gettransaction RPC
    //                         -  method except for the hex property which is not present
    //        }
    //      }
    //    }
    confirmedCatenisTransactions() {
        let lastBlockHash = undefined;

        // noinspection JSCheckFunctionSignatures
        return this.collCtnTx.chain()
            .find({confirmations: {$gt: 0}})
            .compoundsort(['blocktime', 'time'])
            .data({removeMeta: true})
            .reduce((result, doc) => {
                if (lastBlockHash === undefined || lastBlockHash !== doc.blockhash) {
                    // Document belongs to new block
                    lastBlockHash = doc.blockhash;

                    result[lastBlockHash] = {
                        blockheight: doc.blockheight,
                        blocktime: doc.blocktime,
                        ctnTxs: {}
                    };
                }

                result[lastBlockHash].ctnTxs[doc.txid] = doc;

                return result;
            }, {});
    }

    conflictCatenisTransaction(txid) {
        const doc = this.collCtnTx.by('txid', txid);

        return doc && doc.confirmations < 0 ? _.omit(doc, ['meta', '$loki']) : undefined;
    }

    static addEventHandler(event, handler) {
        if (!TransactionMonitor.hasInitialized()) {
            // Save event handler to be set up when object instance is created
            externalEventHandlers.push({
                event: event,
                handler: handler
            });
        }
        else {
            // Transaction monitor object already instantiated.
            //  Just set up event handler
            Catenis.txMonitor.on(event, handler);
        }
    }

    static initialize() {
        Catenis.logger.TRACE('TransactionMonitor initialization');
        Catenis.txMonitor = new TransactionMonitor(cfgSettings.blockchainPollingInterval);
    }

    static hasInitialized() {
        return Catenis.txMonitor !== undefined;
    }

    static isMonitoringOn() {
        return TransactionMonitor.hasInitialized() && Catenis.txMonitor.monitoringOn;
    }
}


// Module functions used to simulate private TransactionMonitor object methods
//  NOTE: these functions need to be bound to a TransactionMonitor object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

// Helper method to return block height given the block hash
function getBlockHeight(blockHash) {
    return Catenis.bitcoinCore.getBlockHeader(blockHash).height;
}

// Helper method to return block hash given the block height
function getBlockHash(blockHeight) {
    return Catenis.bitcoinCore.getBlockHash(blockHeight);
}

function purgeFoundNewCtnTxs() {
    // Purge old transactions from list of found new Catenis transactions
    if (this.foundNewCtnTxids.size > 0) {
        const dtNow = new Date(),
            limitTime = dtNow.setHours(dtNow.getHours - cfgSettings.mempoolExpiryHours);

        for (let [txid, time] of this.foundNewCtnTxids) {
            if (time < limitTime) {
                this.foundNewCtnTxids.delete(txid);
            }
        }
    }
}

function persistLastBlockHeight() {
    // Update height of last processed blockchain block on the database
    Catenis.db.collection.Application.update({_id: this.docAppId}, {$set: {lastBlockHeight: (this.blockToReset ? this.blockToReset.height : this.lastBlock.height)}});
}

function pollBlockchain() {
    Catenis.logger.TRACE('Executing process to poll blockchain');
    // Make sure it's not yet doing blockchain poll to do it once more
    if (!this.blockchainPollPaused && !this.doingBlockchainPoll) {
        try {
            this.doingBlockchainPoll = true;

            do {
                this.newBlockchainPollTick = false;

                if (this.blockToReset) {
                    Catenis.logger.WARN(util.format('Resetting blockchain block processing: last processed block height: %s, new block height to reset: %s)', this.lastBlock.height, this.blockToReset.height));
                    // Reset block height
                    this.lastBlock = this.blockToReset;
                    this.blockToReset = undefined;
                }

                // Retrieve Catenis transactions since last processed block
                const lastScannedBlock = {
                    hash: this.loadCatenisTransactions(this.lastBlock.hash)
                };
                lastScannedBlock.height = getBlockHeight(lastScannedBlock.hash);

                // Look for new Catenis transactions (not yet confirmed)
                let newCtnTxs = this.newCatenisTransactions();
                let newTxids = Object.keys(newCtnTxs);

                if (newTxids.length > 0) {
                    // Make sure that unconfirmed Catenis transaction had not been found yet (is actually new)
                    const now = Date.now();
                    let listChanged = false;

                    newTxids.forEach((txid) => {
                        if (!this.foundNewCtnTxids.has(txid)) {
                            // Save ID of new Catenis transactions that had been found
                            this.foundNewCtnTxids.set(txid, now)
                        }
                        else {
                            // Catenis transact had already been found; delete from list
                            //  of new Catenis transactions
                            delete newCtnTxs[txid];
                            listChanged = true;
                        }
                    });

                    if (listChanged) {
                        newTxids = Object.keys(newCtnTxs);
                    }

                    if (!listChanged || newTxids.length > 0) {
                        // Filter out Catenis transactions that had already been recorded as received transactions
                        Catenis.db.collection.ReceivedTransaction.find({
                            txid: {$in: newTxids}
                        }, {
                            fields: {txid: 1}
                        }).forEach(doc => delete newCtnTxs[doc.txid]);
                    }
                }

                // Wait to see if there are confirmed Catenis transactions before emitting
                //  event indicating that new Catenis transactions have arrived
                let hasDependentBlocks = false;

                // Make sure that last scanned block is different than last processed block
                if (lastScannedBlock.hash !== this.lastBlock.hash) {
                    // Look for confirmed Catenis transactions
                    const ctnTxBlocks = this.confirmedCatenisTransactions();
                    const ctnTxBlockHashes = Object.keys(ctnTxBlocks);
                    const numCtnTxBlockHashes = ctnTxBlockHashes.length;

                    if (numCtnTxBlockHashes > 0) {
                        let currCtnTxBlockHashIdx = 0;

                        if (numCtnTxBlockHashes > 1) {
                            if (!this.syncingBlocks) {
                                this.syncingBlocks = true;
                                Catenis.application.setSyncingBlocks(true);
                            }
                        }
                        else if (this.syncingBlocks) {
                            this.syncingBlocks = false;
                            Catenis.application.setSyncingBlocks(false);
                        }

                        // Step through blocks containing Catenis transactions
                        do {
                            const newCtnTxBlocks = {};
                            const currBlock = {};
                            hasDependentBlocks = false;

                            do {
                                currBlock.hash = ctnTxBlockHashes[currCtnTxBlockHashIdx];
                                const ctnTxBlock = ctnTxBlocks[currBlock.hash];
                                currBlock.height = ctnTxBlock.blockheight;
                                Catenis.logger.TRACE(util.format('Processing block #%d, which contains Catenis transactions', currBlock.height));

                                // Prepare new Catenis block info to send in new blocks event
                                const newCtnTxBlock = {
                                    height: currBlock.height,
                                    hash: currBlock.hash,
                                    time: ctnTxBlock.blocktime,
                                    ctnTxids: [],
                                    replacedTxids: {}
                                };

                                // Step through Catenis transactions in block
                                let newCtnTxsInBlock = {};

                                for (let ctnTxid in ctnTxBlock.ctnTxs) {
                                    //noinspection JSUnfilteredForInLoop
                                    let ctnTx = ctnTxBlock.ctnTxs[ctnTxid];

                                    // Checks if ID of Catenis transaction had been replaced (possibly) due to malleability
                                    if (ctnTx.walletconflicts.length > 0) {
                                        ctnTx.walletconflicts.some((conflictTxid) => {
                                            const conflictCtnTx = this.conflictCatenisTransaction(conflictTxid);

                                            if (conflictCtnTx === undefined) {
                                                // Could not find conflicting transaction in retrieved Catenis transactions.
                                                //  Log warning condition
                                                Catenis.logger.WARN('Could not find conflicting transaction in retrieved Catenis transactions', {
                                                    conflictTxid: conflictTxid,
                                                    ctnTx: ctnTx
                                                });
                                            }
                                            else if (Transaction.areTxsIdentical(conflictCtnTx, ctnTx)) {
                                                // Conflicting transaction is identical to confirmed transaction. Assume it is
                                                //  a transaction the ID of which had been replaced due to malleability

                                                // Replace confirmed transaction with conflicting (original) transaction
                                                newCtnTxBlock.replacedTxids[conflictTxid] = ctnTx.txid;
                                                ctnTx = conflictCtnTx;

                                                // Stop loop (walletconflicts.some)
                                                return true;
                                            }

                                            return false;
                                        });
                                    }

                                    // Add transaction ID to list of Catenis transactions in block
                                    newCtnTxBlock.ctnTxids.push(ctnTx.txid);

                                    if (!this.foundNewCtnTxids.has(ctnTx.txid)) {
                                        // Confirmed Catenis transaction had not been found before, so assume it is a new
                                        //  Catenis transaction and save it
                                        newCtnTxsInBlock[ctnTx.txid] = ctnTx;
                                    }
                                }
                                Catenis.logger.TRACE(util.format('Catenis transactions in block #%d', currBlock.height), newCtnTxBlock.ctnTxids);

                                // Check if any new Catenis transactions have been found in block
                                const newCtnTxidsInBlock = Object.keys(newCtnTxsInBlock);

                                if (newCtnTxidsInBlock.length > 0) {
                                    // Save ID of new Catenis transactions that had been found
                                    const now = Date.now();

                                    newCtnTxidsInBlock.forEach((txid) => {
                                        if (!this.foundNewCtnTxids.has(txid)) {
                                            this.foundNewCtnTxids.set(txid, now)
                                        }
                                    });

                                    // Filter out Catenis transactions that had already been recorded as received transactions
                                    Catenis.db.collection.ReceivedTransaction.find({
                                        txid: {$in: newCtnTxidsInBlock}
                                    }, {
                                        fields: {txid: 1}
                                    }).forEach(doc => delete newCtnTxsInBlock[doc.txid]);

                                    // Check if there are still new Catenis transactions found in block (not
                                    //  all of them had been filtered out)
                                    if (Object.keys(newCtnTxsInBlock).length > 0) {
                                        Catenis.logger.TRACE(util.format('New Catenis transactions found in block #%d', currBlock.height), Object.keys(newCtnTxsInBlock));
                                        // Add new Catenis transactions found in block to list of new Catenis transactions
                                        _.extend(newCtnTxs, newCtnTxsInBlock);

                                        // Indicates that this block is dependent on the processing of the
                                        //  next new transactions batch
                                        newCtnTxBlock.newTxsBatchDependency = this.lastNewTxsBatchNumber + 1;
                                        hasDependentBlocks = true;
                                    }
                                }

                                newCtnTxBlocks[currBlock.height] = newCtnTxBlock;
                            }
                                // Interrupt processing of blocks if monitoring had been turned off, a block reset is
                                //  underway or a new blockchain poll tick has happened
                            while (++currCtnTxBlockHashIdx < numCtnTxBlockHashes && this.monitoringOn && !this.blockToReset && !this.newBlockchainPollTick);

                            if (this.monitoringOn && !this.blockToReset) {
                                // Check if there are new Catenis transactions and emit event
                                if (Object.keys(newCtnTxs).length > 0) {
                                    // Emit (internal) event notifying that new Catenis transactions have arrived
                                    this.emit(TransactionMonitor.internalEvent.new_transactions, {
                                        batchNumber: ++this.lastNewTxsBatchNumber,
                                        hasDependentBlocks: hasDependentBlocks,
                                        ctnTxs: newCtnTxs
                                    });
                                }

                                // Reset list of new Catenis transactions
                                newCtnTxs = {};

                                // Check if there are blocks with confirmed Catenis transactions and emit event
                                if (Object.keys(newCtnTxBlocks).length > 0) {
                                    // Emit (internal) event notifying that new blocks have arrived
                                    this.emit(TransactionMonitor.internalEvent.new_blocks, newCtnTxBlocks);
                                }

                                // Update last processed block and persist it
                                this.lastBlock = currBlock;

                                persistLastBlockHeight.call(this);
                            }
                        }
                        // Continue processing if monitoring is on, no block reset is underway and there are still
                        //  more blocks to process, that is if processing of inner loop had been interrupted due to
                        //  a new blockchain poll tick
                        while (this.monitoringOn && !this.blockToReset && currCtnTxBlockHashIdx < numCtnTxBlockHashes);
                    }
                }

                // Check if there are new Catenis transactions and emit event
                if (Object.keys(newCtnTxs).length > 0) {
                    // Emit (internal) event notifying that new Catenis transactions have arrived
                    this.emit(TransactionMonitor.internalEvent.new_transactions, {
                        batchNumber: ++this.lastNewTxsBatchNumber,
                        hasDependentBlocks: hasDependentBlocks,
                        ctnTxs: newCtnTxs
                    });
                }

                // If no block reset is underway and last scanned block is different than last processed block,
                //  update last processed block and persist it
                if (!this.blockToReset && lastScannedBlock.hash !== this.lastBlock.hash) {
                    this.lastBlock = lastScannedBlock;

                    persistLastBlockHeight.call(this);
                    Catenis.logger.TRACE('Last processed block', this.lastBlock);
                }
            }
            // Continue processing if monitoring is on and a new blockchain pool tick has happened
            while (this.monitoringOn && this.newBlockchainPollTick);
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
//      height: [String],  // Block height
//      hash: [String],  // Block hash
//      time: [Number],  // Block time
//      ctnTxids: [
//        [String],  // ID of Catenis transaction contained in block
//        ...
//      ],
//      replacedTxids: {
//        <original txid>: [String]  // ID of confirmed transaction that had replaced the original one
//      },
//      newTxsBatchDependency: [Number]  // Number of new transactions batch that should be processed before this block is processed
//    }
//  }
//
//  NOTE: only blocks containing Catenis transactions should be handled
function handleNewBlocks(data) {
    Catenis.logger.TRACE('New blocks event handler called.', {data: data});
    // Make sure that a block height reset is not underway
    if (!this.blockToReset) {
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
                            //noinspection JSUnfilteredForInLoop
                            Catenis.logger.TRACE(util.format('Processing of block (height: %s) depends on processing of new transactions batch (number: %s)', blockHeight, blockInfo.newTxsBatchDependency));
                            validateNewTxsBatchDependency.call(this, blockInfo);
                            //noinspection JSUnfilteredForInLoop
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
                        }, {fields: {_id: 1, type: 1, txid: 1, info: 1}}).map((doc) => {
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
                        this.blockToReset = {
                            height: blockHeight - 1
                        };
                        this.blockToReset.hash = getBlockHash(this.blockToReset.height);

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
//    ctnTxs: {
//      <txid>: [Object],  // Result from gettransaction RPC method
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
                // Identify different transaction types, and emit events for each type separately
                const eventsToEmit = [];

                // Identify received transactions that had been sent by this Catenis node
                const sentTxids = new Set();
                const rcvdTxDocsToCreate = [];

                Catenis.db.collection.SentTransaction.find({
                    txid: {$in: Object.keys(data.ctnTxs)}
                }, {fields: {_id: 1, type: 1, txid: 1, info: 1}}).forEach(doc => {
                    sentTxids.add(doc.txid);

                    // Filter the type of transactions that should be processed as received transactions: 'credit_service_account', 'send_message',
                    //  'read_confirmation', 'issue_asset', 'issue_nf_asset', 'transfer_asset', and 'transfer_nf_token' for now
                    if (doc.type === Transaction.type.credit_service_account.name || doc.type === Transaction.type.send_message.name
                            || doc.type === Transaction.type.read_confirmation.name || doc.type === Transaction.type.issue_asset.name
                            || doc.type === Transaction.type.issue_nf_asset.name || doc.type === Transaction.type.transfer_asset.name
                            || doc.type === Transaction.type.transfer_nf_token.name || doc.type === Transaction.type.settle_off_chain_messages.name) {
                        Catenis.logger.TRACE('Processing sent transaction as received transaction', doc);

                        // Get needed data from read confirmation tx
                        const spentReadConfirmTxOuts = [];

                        if (doc.type === Transaction.type.read_confirmation.name) {
                            const txInfo = doc.info[Transaction.type.read_confirmation.dbInfoEntryName];

                            txInfo.serializedTx.inputs.forEach((input, idx) => {
                                if (idx < txInfo.spentReadConfirmTxOutCount) {
                                    spentReadConfirmTxOuts.push({
                                        txid: input.txid,
                                        vout: input.vout
                                    });
                                }
                            });
                        }

                        // Prepare to emit event notifying of new transaction received
                        // TODO: in the future, when other Catenis nodes are active, only send notification event and record received transaction if target device belongs to this node
                        const notifyEvent = getTxRcvdNotifyEventFromTxType(doc.type);

                        if (notifyEvent) {
                            const eventData = {
                                txid: doc.txid
                            };
                            const txInfo = getDocTxInfo(doc);

                            switch (doc.type) {
                                case Transaction.type.credit_service_account.name:
                                    eventData.clientId = txInfo.clientId;
                                    eventData.issuedAmount = txInfo.issuedAmount;
                                    
                                    break;
                                    
                                case Transaction.type.send_message.name:
                                    eventData.originDeviceId = txInfo.originDeviceId;
                                    eventData.targetDeviceId = txInfo.targetDeviceId;

                                    break;
                                    
                                case Transaction.type.read_confirmation.name:
                                    eventData.spentReadConfirmTxOuts = spentReadConfirmTxOuts;
                                    
                                    break;
                                    
                                case Transaction.type.issue_asset.name:
                                    eventData.assetId = txInfo.assetId;
                                    eventData.issuingDeviceId = txInfo.issuingDeviceId;
                                    eventData.holdingDeviceId = txInfo.holdingDeviceId;
                                    eventData.amount = txInfo.amount;
                                    
                                    break;

                                case Transaction.type.issue_nf_asset.name:
                                    eventData.assetId = txInfo.assetId;
                                    eventData.issuingDeviceId = txInfo.issuingDeviceId;
                                    eventData.holdingDeviceIds = txInfo.holdingDeviceIds;
                                    eventData.nfTokenIds = txInfo.nfTokenIds;

                                    break;

                                case Transaction.type.transfer_asset.name:
                                    eventData.assetId = txInfo.assetId;
                                    eventData.sendingDeviceId = txInfo.sendingDeviceId;
                                    eventData.receivingDeviceId = txInfo.receivingDeviceId;
                                    eventData.amount = txInfo.amount;
                                    eventData.changeAmount = txInfo.changeAmount;

                                    break;

                                case Transaction.type.transfer_nf_token.name:
                                    eventData.tokenId = txInfo.tokenId;
                                    eventData.sendingDeviceId = txInfo.sendingDeviceId;
                                    eventData.receivingDeviceId = txInfo.receivingDeviceId;

                                    break;

                                case Transaction.type.settle_off_chain_messages.name:
                                    eventData.offChainMsgDataCids = txInfo.offChainMsgDataCids;
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
                            if (doc.info[Transaction.type.send_message.dbInfoEntryName].readConfirmation !== undefined) {
                                // Add field that indicates whether read confirmation output has been spent
                                //  (in other words, if the message has been read)
                                docInfo[Transaction.type.send_message.dbInfoEntryName].readConfirmation.spent = false;
                            }
                        }
                        else if (doc.type === Transaction.type.read_confirmation.name) {
                            docInfo[Transaction.type.read_confirmation.dbInfoEntryName] = {
                                spentReadConfirmTxOuts: spentReadConfirmTxOuts
                            };
                        }

                        //  Prepare to save received tx to the local database
                        rcvdTxDocsToCreate.push({
                            type: doc.type,
                            txid: doc.txid,
                            receivedDate: new Date(data.ctnTxs[doc.txid].timereceived * 1000),
                            sentTransaction_id: doc._id,
                            info: docInfo
                        });
                    }
                });

                // For all other transactions (not the ones sent by this Catenis node)...
                for (let txid in data.ctnTxs) {
                    //noinspection JSUnfilteredForInLoop
                    if (!sentTxids.has(txid)) {
                        //noinspection JSUnfilteredForInLoop
                        Catenis.logger.TRACE('Processing non-sent transaction as received transaction', {txid: txid});
                        // Parse transaction's outputs and try to identify the type
                        //  of transaction
                        //noinspection JSUnfilteredForInLoop
                        const voutInfo = parseTxVouts(data.ctnTxs[txid].details);
                        let payments;
                        let transact = undefined;
                        let omniTransact = undefined;
                        let bcotPayTransact;
                        let bcotReplenishTransact;
                        let settleOCMsgsTransact;

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
                            const rcvdTxDoc  = {
                                type: Transaction.type.sys_funding.name,
                                txid: txid,
                                receivedDate: new Date(data.ctnTxs[txid].timereceived * 1000),
                                confirmation: {
                                    confirmed: false
                                },
                                info: {}
                            };
                            rcvdTxDoc.info[Transaction.type.sys_funding.dbInfoEntryName] = {
                                fundAddresses: payments.map((payment) => {
                                    return {
                                        path: payment.path,
                                        amount: payment.amount
                                    };
                                })
                            };

                            rcvdTxDocsToCreate.push(rcvdTxDoc);
                        }
                        else if (BcotPaymentTransaction.isValidTxVouts(voutInfo) && (bcotPayTransact = BcotPaymentTransaction.checkTransaction(omniTransact || (omniTransact = OmniTransaction.fromTransaction(transact || (transact = Transaction.fromTxid(txid)))))) !== undefined) {
                            // BCOT payment transaction

                            // Prepare to emit event notifying of new transaction received
                            //noinspection JSUnfilteredForInLoop
                            eventsToEmit.push({
                                name: TransactionMonitor.notifyEvent.bcot_payment_tx_rcvd.name,
                                data: {
                                    txid: txid,
                                    clientId: bcotPayTransact.client.clientId,
                                    paidAmount: bcotPayTransact.bcotAmount
                                }
                            });

                            // Prepared to save received tx to the local database
                            //noinspection JSUnfilteredForInLoop
                            const rcvdTxDoc = {
                                type: Transaction.type.bcot_payment.name,
                                txid: txid,
                                receivedDate: new Date(data.ctnTxs[txid].timereceived * 1000),
                                confirmation: {
                                    confirmed: false
                                },
                                info: {}
                            };
                            const bcotPayAddrInfo = Catenis.keyStore.getAddressInfo(bcotPayTransact.payeeAddress);
                            rcvdTxDoc.info[Transaction.type.bcot_payment.dbInfoEntryName] = {
                                clientId: bcotPayTransact.client.clientId,
                                encSentFromAddress: BcotPayment.encryptSentFromAddress(bcotPayTransact.payingAddress, bcotPayAddrInfo),
                                bcotPayAddressPath: bcotPayAddrInfo.path,
                                paidAmount: bcotPayTransact.bcotAmount
                            };

                            rcvdTxDocsToCreate.push(rcvdTxDoc);
                        }
                        else if (BcotReplenishmentTransaction.isValidTxVouts(voutInfo) && (bcotReplenishTransact = BcotReplenishmentTransaction.checkTransaction(omniTransact || (omniTransact = OmniTransaction.fromTransaction(transact || (transact = Transaction.fromTxid(txid)))))) !== undefined) {
                            // BCOT replenishment transaction

                            // Prepare to emit event notifying of new transaction received
                            //noinspection JSUnfilteredForInLoop
                            eventsToEmit.push({
                                name: TransactionMonitor.notifyEvent.bcot_replenishment_tx_rcvd.name,
                                data: {
                                    txid: txid,
                                    replenishedAmount: bcotReplenishTransact.replenishedAmount
                                }
                            });

                            // Prepared to save received tx to the local database
                            //noinspection JSUnfilteredForInLoop
                            const rcvdTxDoc = {
                                type: Transaction.type.bcot_replenishment.name,
                                txid: txid,
                                receivedDate: new Date(data.ctnTxs[txid].timereceived * 1000),
                                confirmation: {
                                    confirmed: false
                                },
                                info: {}
                            };
                            const bcotSaleStockAddrInfo = Catenis.keyStore.getAddressInfo(bcotReplenishTransact.payeeAddress);
                            rcvdTxDoc.info[Transaction.type.bcot_replenishment.dbInfoEntryName] = {
                                encSentFromAddress: BcotPayment.encryptSentFromAddress(bcotReplenishTransact.payingAddress, bcotSaleStockAddrInfo),
                                replenishedAmount: bcotReplenishTransact.replenishedAmount
                            };

                            rcvdTxDocsToCreate.push(rcvdTxDoc);
                        }
                        else if (SettleOffChainMessagesTransaction.isValidTxVouts(voutInfo)
                                && (settleOCMsgsTransact = SettleOffChainMessagesTransaction.checkTransaction(transact || (transact = Transaction.fromTxid(txid))))
                                && settleOCMsgsTransact.containMsgDataFromLocalSender()) {
                            // Settle off-chain messages transaction (saved by another Catenis node and containing at least
                            //  one off-chain message receipt for an off-chain message envelope saved by this Catenis node)

                            // Prepare to emit event notifying of new transaction received
                            //noinspection JSUnfilteredForInLoop
                            eventsToEmit.push({
                                name: TransactionMonitor.notifyEvent.settle_off_chain_messages_tx_rcvd.name,
                                data: {
                                    txid: txid,
                                    transact: settleOCMsgsTransact,
                                    offChainMsgDataCids: settleOCMsgsTransact.batchDocument.msgDataCids
                                }
                            });

                            // Prepared to save received tx to the local database
                            //noinspection JSUnfilteredForInLoop
                            const rcvdTxDoc  = {
                                type: Transaction.type.settle_off_chain_messages.name,
                                txid: txid,
                                receivedDate: new Date(data.ctnTxs[txid].timereceived * 1000),
                                confirmation: {
                                    confirmed: false
                                },
                                info: {}
                            };
                            rcvdTxDoc.info[Transaction.type.settle_off_chain_messages.dbInfoEntryName] = {
                                offChainMsgDataCids: settleOCMsgsTransact.batchDocument.msgDataCids
                            };

                            rcvdTxDocsToCreate.push(rcvdTxDoc);
                        }
                        // TODO: parse transaction (using Transaction.fromHex()) and try to identify Catenis transactions (using tx.matches())
                        else {
                            // TODO: IMPORTANT - identify unrecognized transactions that send bitcoins to internal Catenis addresses (any address other than sys_fund_addr) and spend the amount transferred  to a "garbage" address that should be defined so the bitcoins are gotten out of the way
                            // An unrecognized transaction had been received.
                            //  Log warning condition
                            // noinspection JSUnfilteredForInLoop
                            Catenis.logger.WARN('An unrecognized transaction involving Catenis addresses has been received', {
                                txid: txid
                            });
                        }
                    }
                }

                // Save received transactions
                rcvdTxDocsToCreate.forEach((docRcvdTx) => {
                    docRcvdTx._id = Catenis.db.collection.ReceivedTransaction.insert(docRcvdTx);
                });

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
                for (let txid in data.ctnTxs) {
                    //noinspection JSUnfilteredForInLoop
                    if (this.foundNewCtnTxids.has(txid)) {
                        //noinspection JSUnfilteredForInLoop
                        this.foundNewCtnTxids.delete(txid);
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

            this.removeListener(TransactionMonitor.internalEvent.new_txs_batch_processing_done, newTxsBatchProcDoneCallback);
            clearTimeout(idTmo);
        }).wait();

        if (timeout) {
            Catenis.logger.ERROR(util.format('Timeout while waiting on new transactions batch (batchNumber: %s) to finish processing before proceeding with processing of dependent block (height: %s)', blockInfo.newTxsBatchDependency, blockInfo.height));
            throw new Error(util.format('Timeout while waiting on new transactions batch (batchNumber: %s) to finish processing before proceeding with processing of dependent block (height: %s)', blockInfo.newTxsBatchDependency, blockInfo.height));
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
        Catenis.logger.TRACE('Check if old unconfirmed transactions should be fixed');
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
            const txInfo = Catenis.bitcoinCore.getTransaction(docTx.txid);
            let isConfirmed = false;
            let blockInfo;

            if (txInfo.confirmations > 0) {
                // Indicate that transaction is confirmed and save info about block that
                //  includes this tx
                isConfirmed = true;

                blockInfo = {
                    hash: txInfo.blockhash,
                    height: txInfo.blockheight,
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
                            height: cnfltTxid.blockheight,
                            time: cnfltTxInfo.blocktime
                        };

                        // Stop loop (walletconflicts.some)
                        return true;
                    }

                    return false;
                });
            }

            if (isConfirmed && blockInfo.height <= this.lastBlock.height - cfgSettings.blocksBehindToFixUnconfTxs) {
                // Process confirmed transaction
                Catenis.logger.TRACE('Old unconfirmed transaction (txid: %s) already confirmed; process it now', docTx.txid);
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
    // Events used to signal current status of transaction monitoring
    tx_monitor_on: Object.freeze({
        name: 'tx_monitor_on',
        description: 'Transaction monitoring had just been turned on'
    }),
    tx_monitor_off: Object.freeze({
        name: 'tx_monitor_off',
        description: 'Transaction monitoring had just been turned off'
    }),
    // Events used to notify when a transaction of a given type is confirmed
    sys_funding_tx_conf: Object.freeze({
        name: 'sys_funding_tx_conf',
        description: 'Transaction used to fund the system has been confirmed'
    }),
    funding_provision_system_device_tx_conf: Object.freeze({
        name: 'funding_provision_system_device_tx_conf',
        description: 'Funding transaction sent for provisioning system device has been confirmed'
    }),
    funding_provision_service_credit_issuance_tx_conf: Object.freeze({
        name: 'funding_provision_service_credit_issuance_tx_conf',
        description: 'Funding transaction sent for provisioning system service credit issuance has been confirmed'
    }),
    funding_provision_bcot_sale_stock_tx_conf: Object.freeze({
        name: 'funding_provision_bcot_sale_stock_tx_conf',
        description: 'Funding transaction sent for provisioning system BCOT token sale stock usage has been confirmed'
    }),
    funding_provision_client_device_tx_conf: Object.freeze({
        name: 'funding_provision_client_device_tx_conf',
        description: 'Funding transaction sent for provisioning a device for a client has been confirmed'
    }),
    funding_add_extra_service_payment_tx_pay_funds_tx_conf: Object.freeze({
        name: 'funding_add_extra_service_payment_tx_pay_funds_tx_conf',
        description: 'Funding transaction sent for adding funds to pay for service payment transaction expenses has been confirmed'
    }),
    funding_add_extra_tx_pay_funds_tx_conf: Object.freeze({
        name: 'funding_add_extra_tx_pay_funds_tx_conf',
        description: 'Funding transaction sent for adding funds to pay for transaction expenses has been confirmed'
    }),
    funding_add_extra_read_confirm_tx_pay_funds_tx_conf: Object.freeze({
        name: 'funding_add_extra_read_confirm_tx_pay_funds_tx_conf',
        description: 'Funding transaction sent for adding funds to pay for read confirmation transaction expenses has been confirmed'
    }),
    funding_add_extra_settle_oc_msgs_tx_pay_funds_tx_conf: Object.freeze({
        name: 'funding_add_extra_settle_oc_msgs_tx_pay_funds_tx_conf',
        description: 'Funding transaction sent for adding funds to pay for settle off-chain messages transaction expenses has been confirmed'
    }),
    bcot_payment_tx_conf: Object.freeze({
        name: 'bcot_payment_tx_conf',
        description: 'Transaction used to send BCOT tokens as payment for services for a client has been confirmed'
    }),
    store_bcot_tx_conf: Object.freeze({
        name: 'store_bcot_tx_conf',
        description: 'Transaction used to store away BCOT tokens received as payment for services for a client has been confirmed'
    }),
    bcot_replenishment_tx_conf: Object.freeze({
        name: 'bcot_replenishment_tx_conf',
        description: 'Transaction used to replenish stock of BCOT tokens for sale has been confirmed'
    }),
    redeem_bcot_tx_conf: Object.freeze({
        name: 'redeem_bcot_tx_conf',
        description: 'Transaction used to redeem purchased BCOT tokens for services has been confirmed'
    }),
    credit_service_account_tx_conf: Object.freeze({
        name: 'credit_service_account_tx_conf',
        description: 'Transaction sent for crediting the service account of a client has been confirmed'
    }),
    spend_service_credit_tx_conf: Object.freeze({
        name: 'spend_service_credit_tx_conf',
        description: 'Transaction used to spend an amount of Catenis service credits from a client\'s service account to pay for a service has been confirmed'
    }),
    send_message_tx_conf: Object.freeze({
        name: 'send_message_tx_conf',
        description: 'Transaction used to send data message between devices has been confirmed'
    }),
    log_message_tx_conf: Object.freeze({
        name: 'log_message_tx_conf',
        description: 'Transaction used to log data message has been confirmed'
    }),
    read_confirmation_tx_conf: Object.freeze({
        name: 'read_confirmation_tx_conf',
        description: 'Transaction sent for marking and notifying that send message transactions have already been read has been confirmed'
    }),
    issue_asset_tx_conf: Object.freeze({
        name: 'issue_asset_tx_conf',
        description: 'Transaction sent for issuing an amount of a Catenis asset has been confirmed'
    }),
    issue_nf_asset_tx_conf: Object.freeze({
        name: 'issue_nf_asset_tx_conf',
        description: 'Transaction sent for issuing new non-fungible tokens of a Catenis non-fungible asset has been confirmed'
    }),
    transfer_asset_tx_conf: Object.freeze({
        name: 'transfer_asset_tx_conf',
        description: 'Transaction used to transfer an amount of a Catenis asset between devices has been confirmed'
    }),
    transfer_nf_token_tx_conf: Object.freeze({
        name: 'transfer_nf_token_tx_conf',
        description: 'Transaction used to transfer a non-fungible token between devices has been confirmed'
    }),
    settle_off_chain_messages_tx_conf: Object.freeze({
        name: 'settle_off_chain_messages_tx_conf',
        description: 'Transaction used to settle Catenis off-chain messages to the blockchain has been confirmed'
    }),
    out_migrate_asset_tx_conf: Object.freeze({
        name: 'out_migrate_asset_tx_conf',
        description: 'Transaction used to out-migrate an amount of an exported Catenis asset to a foreign blockchain has been confirmed'
    }),
    in_migrate_asset_tx_conf: Object.freeze({
        name: 'in_migrate_asset_tx_conf',
        description: 'Transaction used to in-migrate an amount of an exported Catenis asset from a foreign blockchain back to Catenis has been confirmed'
    }),
    // Events used to notify when a transaction of a given type is received
    sys_funding_tx_rcvd: Object.freeze({
        name: 'sys_funding_tx_rcvd',
        description: 'Transaction used to fund the system has been received'
    }),
    bcot_payment_tx_rcvd: Object.freeze({
        name: 'bcot_payment_tx_rcvd',
        description: 'Transaction used to send BCOT tokens as payment for services for a client has been received'
    }),
    bcot_replenishment_tx_rcvd: Object.freeze({
        name: 'bcot_replenishment_tx_rcvd',
        description: 'Transaction used used to replenish stock of BCOT tokens for sale has been received'
    }),
    credit_service_account_tx_rcvd: Object.freeze({
        name: 'credit_service_account_tx_rcvd',
        description: 'Transaction sent for crediting the service account of a client has been received'
    }),
    send_message_tx_rcvd: Object.freeze({
        name: 'send_message_tx_rcvd',
        description: 'Transaction used to send data message between devices has been received'
    }),
    read_confirmation_tx_rcvd: Object.freeze({
        name: 'read_confirmation_tx_rcvd',
        description: 'Transaction used to confirm that messages have been read by receiving devices has been received'
    }),
    issue_asset_tx_rcvd: Object.freeze({
        name: 'issue_asset_tx_rcvd',
        description: 'Transaction sent for issuing an amount of a Catenis asset has been received'
    }),
    issue_nf_asset_tx_rcvd: Object.freeze({
        name: 'issue_nf_asset_tx_rcvd',
        description: 'Transaction sent for issuing new non-fungible tokens of a Catenis non-fungible asset has been received'
    }),
    transfer_asset_tx_rcvd: Object.freeze({
        name: 'transfer_asset_tx_rcvd',
        description: 'Transaction used to transfer an amount of a Catenis asset between devices has been received'
    }),
    transfer_nf_token_tx_rcvd: Object.freeze({
        name: 'transfer_nf_token_tx_rcvd',
        description: 'Transaction used to transfer a non-fungible token between devices has been received'
    }),
    settle_off_chain_messages_tx_rcvd: Object.freeze({
        name: 'settle_off_chain_messages_tx_rcvd',
        description: 'Transaction used to settle Catenis off-chain messages to the blockchain has been received'
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
                    entityId: doc.info[Transaction.type.funding.dbInfoEntryName].event.entityId
                }
            });
        }
        else {
            // Could not get notification event from funding event.
            //  Log error condition
            Catenis.logger.ERROR('Could not get notification event from funding transaction event', {fundingEvent: doc.info.funding.event.name});
        }
    }
    else {
        // Prepare to emit event notifying of transaction confirmed
        const notifyEvent = getTxConfNotifyEventFromTxType(doc.type);

        if (notifyEvent) {
            const eventData = {
                txid: doc.txid
            };
            const txInfo = getDocTxInfo(doc);

            switch (doc.type) {
                case Transaction.type.store_bcot.name:
                    eventData.storedAmount = txInfo.storedAmount;
                    
                    break;

                case Transaction.type.redeem_bcot.name:
                    eventData.redeemedAmount = txInfo.redeemedAmount;

                    break;

                case Transaction.type.credit_service_account.name:
                    eventData.clientId = txInfo.clientId;
                    eventData.issuedAmount = txInfo.issuedAmount;
                    
                    break;

                case Transaction.type.spend_service_credit.name:
                    eventData.serviceTxids = txInfo.serviceTxids;
                    eventData.ocMsgServiceCids = txInfo.ocMsgServiceCids;

                    break;

                case Transaction.type.read_confirmation.name:

                    break;

                case Transaction.type.issue_asset.name:
                    eventData.assetId = txInfo.assetId;
                    eventData.issuingDeviceId = txInfo.issuingDeviceId;
                    eventData.holdingDeviceId = txInfo.holdingDeviceId;
                    eventData.amount = txInfo.amount;

                    break;

                case Transaction.type.issue_nf_asset.name:
                    eventData.assetId = txInfo.assetId;
                    eventData.issuingDeviceId = txInfo.issuingDeviceId;
                    eventData.holdingDeviceIds = txInfo.holdingDeviceIds;
                    eventData.nfTokenIds = txInfo.nfTokenIds;

                    break;

                case Transaction.type.transfer_asset.name:
                    eventData.assetId = txInfo.assetId;
                    eventData.sendingDeviceId = txInfo.sendingDeviceId;
                    eventData.receivingDeviceId = txInfo.receivingDeviceId;
                    eventData.amount = txInfo.amount;
                    eventData.changeAmount = txInfo.changeAmount;

                    break;

                case Transaction.type.transfer_nf_token.name:
                    eventData.tokenId = txInfo.tokenId;
                    eventData.sendingDeviceId = txInfo.sendingDeviceId;
                    eventData.receivingDeviceId = txInfo.receivingDeviceId;

                    break;

                case Transaction.type.settle_off_chain_messages.name:
                    eventData.offChainMsgDataCids = txInfo.offChainMsgDataCids;

                    break;

                case Transaction.type.out_migrate_asset.name:
                    eventData.assetId = txInfo.assetId;
                    eventData.owningDeviceId = txInfo.owningDeviceId;
                    eventData.amount = txInfo.amount;
                    eventData.changeAmount = txInfo.changeAmount;

                    break;

                case Transaction.type.in_migrate_asset.name:
                    eventData.assetId = txInfo.assetId;
                    eventData.owningDeviceId = txInfo.owningDeviceId;
                    eventData.amount = txInfo.amount;
                    eventData.changeAmount = txInfo.changeAmount;

                    break;
            }

            eventsToEmit.push({
                name: notifyEvent.name,
                data: eventData
            });
        }
        else {
            // Could not get notification event from transaction type.
            //  Log error condition
            Catenis.logger.ERROR('Could not get notification event from transaction type', {txType: doc.type});
        }
    }
}

function processConfirmedReceivedTransactions(doc, eventsToEmit) {
    // Prepare to emit event notifying of transaction confirmed
    const notifyEvent = getTxConfNotifyEventFromTxType(doc.type);

    if (notifyEvent) {
        const eventData = {
            txid: doc.txid
        };
        const txInfo = getDocTxInfo(doc);

        switch (doc.type) {
            case Transaction.type.sys_funding.name:

                break;

            case Transaction.type.bcot_payment.name:
                eventData.clientId = txInfo.clientId;
                eventData.paidAmount = txInfo.paidAmount;

                break;

            case Transaction.type.bcot_replenishment.name:
                eventData.replenishedAmount = txInfo.replenishedAmount;

                break;
        }

        eventsToEmit.push({
            name: notifyEvent.name,
            data: eventData
        });
    }
    else {
        // Could not get notification event from transaction type.
        //  Log error condition
        Catenis.logger.ERROR('Could not get notification event from transaction type', {txType: doc.type});
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

function getDocTxInfo(doc) {
    return doc.info[Transaction.type[doc.type].dbInfoEntryName];
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
