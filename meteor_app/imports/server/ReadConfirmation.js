/**
 * Created by Claudio on 2017-07-18.
 */

//console.log('[ReadConfirmation.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import util from 'util';
// Third-party node modules
import config from 'config';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { ReadConfirmTransaction } from './ReadConfirmTransaction';
import { FundSource } from './FundSource';
import { TransactionMonitor } from './TransactionMonitor';
import { CriticalSection } from './CriticalSection';
import { Transaction } from './Transaction';
import { KeyStore } from './KeyStore';
import { BaseBlockchainAddress } from './BaseBlockchainAddress';
import { BitcoinCore } from './BitcoinCore';
import { Message } from './Message';
import { Device } from './Device';
import { Billing } from './Billing';

// Config entries
const readConfirmConfig = config.get('readConfirmation');

// Configuration settings
const cfgSettings = {
    unconfirmedTxTimeout: readConfirmConfig.get('unconfirmedTxTimeout'),
    txSizeThresholdRatio: readConfirmConfig.get('txSizeThresholdRatio')
};

// Critical section object used to serialize read confirmation tasks
const readConfirmCS = new CriticalSection();


// Definition of function classes
//

// ReadConfirmation function class
export function ReadConfirmation() {
    // Look for unconfirmed read confirmation transactions
    this.readConfirmTransacts = new Set();
    this.activeReadConfirmTransact = undefined;
    let lastTxid,
        lastTxSentDate;

    Catenis.db.collection.SentTransaction.find({
        type: Transaction.type.read_confirmation.name,
        'confirmation.confirmed': false,
        replacedByTxid: {
            $exists: false
        }
    }, {
        sort: {
            sentDate: 1
        },
        fields: {
            txid: 1,
            sentDate: 1,
            'info.readConfirmation.serializedTx': 1
        }
    }).forEach((doc) => {
        // Instantiate ReadConfirmationTransaction object
        let serializedTx = doc.info.readConfirmation.serializedTx;
        serializedTx.useOptInRBF = true;
        serializedTx.txid = doc.txid;

        this.activeReadConfirmTransact = new ReadConfirmTransaction(Transaction.parse(JSON.stringify(serializedTx)));

        // Save read confirmation transaction
        this.readConfirmTransacts.add(this.activeReadConfirmTransact);

        lastTxid = doc.txid;
        lastTxSentDate = doc.sentDate;
    });

    if (lastTxid && lastTxSentDate) {
        // Set up timer to make sure that read confirmation transaction will not be unconfirmed for too long
        const dtNow = new Date();
        const dtLimit = new Date(lastTxSentDate);
        dtLimit.setMinutes(dtLimit.getMinutes() + cfgSettings.unconfirmedTxTimeout);
        let delay = dtLimit.getTime() - dtNow.getTime();

        if (delay < 0) {
            delay = 0;
        }

        this.unconfTxTimeoutHandle = Meteor.setTimeout(boostReadConfirmTx.bind(this, lastTxid), delay);
    }

    if (this.activeReadConfirmTransact === undefined) {
        // Add a new read confirmation transaction
        allocNewReadConfirmTransaction.call(this);
    }

    // Set up handler for event indicating that read confirmation transaction has been received
    TransactionMonitor.addEventHandler(TransactionMonitor.notifyEvent.read_confirmation_tx_rcvd.name, processReceivedReadConfirmation);

    // Set up handler to process event indicating that read confirmation tx has been confirmed
    TransactionMonitor.addEventHandler(TransactionMonitor.notifyEvent.read_confirmation_tx_conf.name, readConfirmTxConfirmed.bind(this));
}


// Public ReadConfirmation object methods
//

ReadConfirmation.prototype.confirmMessageRead = function (sendMsgTransact, confirmType) {
    // Execute code in critical section to make sure task is serialized
    readConfirmCS.execute(() => {
        // Find read confirmation output of send message transaction
        const readConfirmOutputPos = sendMsgTransact.transact.outputs.findIndex((output) => {
            if (output.type === Transaction.outputType.P2PKH) {
                let addrInfo;

                if (output.payInfo.addrInfo === undefined && (addrInfo = Catenis.keyStore.getAddressInfo(output.payInfo.address, true)) !== null) {
                    output.payInfo.addrInfo = addrInfo;
                }

                return output.payInfo.addrInfo !== undefined && output.payInfo.addrInfo.type === KeyStore.extKeyType.dev_read_conf_addr.name;
            }

            return false;
        });

        if (readConfirmOutputPos >= 0) {
            if (this.activeReadConfirmTransact.lastTxid !== undefined) {
                // Check if we can add this send message tx read confirmation output to the current
                //  read confirmation transaction
                const txoutInfo = Catenis.bitcoinCore.getTxOut(sendMsgTransact.transact.txid, readConfirmOutputPos);

                if (txoutInfo.confirmations === 0) {
                    // Original send message transaction has not been confirmed yet.
                    //  We cannot add this output to the currently active read confirmation transaction (and replace it)

                    // Terminate currently active read confirmation tx
                    this.activeReadConfirmTransact.setTerminalFeeRate();

                    sendReadConfirmTransaction.call(this, true);

                    // Allocated a new read confirmation tx and continue processing
                    allocNewReadConfirmTransaction.call(this);
                }
            }

            // Add new send message tx read confirmation output to read confirmation tx
            this.activeReadConfirmTransact.addSendMsgTxToConfirm(sendMsgTransact, readConfirmOutputPos, confirmType);

            if (this.activeReadConfirmTransact.needsToFund() || this.activeReadConfirmTransact.needsToSend()) {
                if (this.activeReadConfirmTransact.transact.estimateSize() > Transaction.maxTxSize * cfgSettings.txSizeThresholdRatio) {
                    // Current transaction size is above threshold

                    // Terminate currently active read confirmation transaction resetting its fee rate
                    //  so it is confirmed as soon as possible
                    this.activeReadConfirmTransact.setOptimumFeeRate();

                    sendReadConfirmTransaction.call(this, true);

                    // And allocated a new read confirmation tx
                    allocNewReadConfirmTransaction.call(this);
                }
                else {
                    // Just send (replace) currently active read confirmation transaction
                    sendReadConfirmTransaction.call(this);
                }
            }
        }
        else {
            // No read configuration output found in send message transaction to confirm.
            //  Log waring condition
            Catenis.logger.WARN('No read confirmation output found in send message transaction to confirm', sendMsgTransact);
        }
    });
};


// Module functions used to simulate private ReadConfirmation object methods
//  NOTE: these functions need to be bound to a ReadConfirmation object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

function allocNewReadConfirmTransaction(newReadConfirmTransact) {
    // Clear out unconfirmed tx timeout
    if (this.unconfTxTimeoutHandle !== undefined) {
        Meteor.clearTimeout(this.unconfTxTimeoutHandle);
        this.unconfTxTimeoutHandle = undefined;
    }

    // And allocate new read confirmation tx or used the one that was passed
    this.activeReadConfirmTransact = newReadConfirmTransact !== undefined ? newReadConfirmTransact : new ReadConfirmTransaction();

    this.readConfirmTransacts.add(this.activeReadConfirmTransact);
}

function getReadConfirmTransactByTxid(txid) {
    let foundReadConfirmTransact;

    for (let readConfirmTransact of this.readConfirmTransacts) {
        if (readConfirmTransact.hasTxidBeenUsed(txid)) {
            foundReadConfirmTransact = readConfirmTransact;
            break;
        }
    }

    return foundReadConfirmTransact;
}

function disposeReadConfirmTransact(readConfirmTransact) {
    // Remove transaction from list of read confirmation transactions being processed
    this.readConfirmTransacts.delete(readConfirmTransact);

    readConfirmTransact.dispose();

    if (this.activeReadConfirmTransact === readConfirmTransact) {
        this.activeReadConfirmTransact = undefined;
    }
}

function sendReadConfirmTransaction(isTerminal = false) {
    // Execute code in critical section to avoid UTXOs concurrency
    FundSource.utxoCS.execute(() => {
        if (this.activeReadConfirmTransact.needsToFund()) {
            try {
                // Fund read confirmation tx
                this.activeReadConfirmTransact.fundTransaction();
            }
            catch (err) {
                // Error funding read confirmation transaction.
                //  Log error condition and rethrows exception
                Catenis.logger.ERROR('Error funding read confirmation transaction.', err);

                throw err;
            }
        }

        if (this.activeReadConfirmTransact.needsToSend()) {
            const lastTxid = this.activeReadConfirmTransact.lastTxid;
            let txid;

            try {
                // Send read confirmation tx
                txid = this.activeReadConfirmTransact.sendTransaction();
            }
            catch (err) {
                // Error sending read confirmation transaction
                let errorAddressed = false;

                if ((err instanceof Meteor.Error) && err.error === 'ctn_btcore_rpc_error' && err.details !== undefined && typeof err.details.code === 'number'
                        && (err.details.code === BitcoinCore.rpcErrorCode.RPC_VERIFY_ERROR || err.details.code === BitcoinCore.rpcErrorCode.RPC_VERIFY_REJECTED)) {
                    // Transaction has been rejected
                    if (lastTxid) {
                        let txInfo;

                        try {
                            // Check if it is due to the fact that previous tx that would have been replaced was confirmed
                            txInfo = Catenis.bitcoinCore.getTransaction(lastTxid, false);
                        }
                        catch (err2) {
                            Catenis.logger.ERROR('Error trying to get confirmation status of previously sent transaction (txid: %s) of read confirmation transaction that failed to be sent', lastTxid, err);
                        }

                        if (txInfo !== undefined && txInfo.confirmations !== 0) {
                            // Last sent read confirmation tx has either been confirmed or replaced.
                            //  Only log warning condition and expect that things will be fixed spontaneously
                            Catenis.logger.WARN('Read confirmation transaction has been rejected when trying to send it', {
                                transact: this.activeReadConfirmTransact.transact
                            });

                            errorAddressed = true;
                        }
                    }
                }

                if (!errorAddressed) {
                    // Log error condition and rethrows it
                    Catenis.logger.ERROR('Error sending read confirmation transaction.', err);

                    throw err;
                }
            }

            if (txid !== undefined) {
                // Force polling of blockchain so newly sent transaction is received and processed right away
                Catenis.txMonitor.pollNow();

                if (!isTerminal) {
                    // Set up timer to make sure that read confirmation transaction will not be unconfirmed for too long
                    if (this.unconfTxTimeoutHandle !== undefined) {
                        // Turn off previous timer
                        Meteor.clearTimeout(this.unconfTxTimeoutHandle);
                    }

                    this.unconfTxTimeoutHandle = Meteor.setTimeout(boostReadConfirmTx.bind(this, this.activeReadConfirmTransact.lastTxid), cfgSettings.unconfirmedTxTimeout * 60 * 1000);
                }
            }
        }
    });
}

function boostReadConfirmTx(txid) {
    Catenis.logger.TRACE('Timeout to boost read confirmation transaction', {txid: txid});
    try {
        // Execute code in critical section to make sure task is serialized
        readConfirmCS.execute(() => {
            // Read confirmation transaction has not been confirmed for a long time
            this.unconfTxTimeoutHandle = undefined;

            // Make sure that transaction for which timeout was set is still the last sent tx
            if (this.activeReadConfirmTransact.lastTxid === txid) {
                if (TransactionMonitor.isMonitoringOn()) {
                    // Terminate currently active read confirmation transaction resetting its fee rate
                    //  so it is confirmed as soon as possible
                    this.activeReadConfirmTransact.setOptimumFeeRate();

                    sendReadConfirmTransaction.call(this, true);

                    // And allocated a new read confirmation tx
                    allocNewReadConfirmTransaction.call(this);
                }
                else {
                    // Transaction monitoring is not currently on.
                    //  Save transaction to boost it later and wait for event signalling that monitoring is on
                    this.pendingBoostTxid = txid;
                    this.boostPendingReadConfirmTxEventHandler = this.boostPendingReadConfirmTxEventHandler !== undefined ? this.boostPendingReadConfirmTxEventHandler : boostPendingReadConfirmTx.bind(this);

                    TransactionMonitor.addEventHandler(TransactionMonitor.notifyEvent.tx_monitor_on.name, this.boostPendingReadConfirmTxEventHandler);
                }
            }
            else {
                // Read confirmation tx for which timeout to boost it was set is not the last sent transaction.
                //  Log warning condition
                Catenis.logger.WARN('Read confirmation transaction for which timeout to boost it was set is not the last sent transaction', {
                    lastTxid: this.activeReadConfirmTransact.lastTxid,
                    timeoutTxid: txid
                });
            }
        });
    }
    catch (err) {
        // Error while processing timeout to boost read confirmation transaction.
        //  Log error condition
        Catenis.logger.ERROR(util.format('Error while processing timeout to boost read confirmation transaction (txid: %s).', txid), err);
    }
}

function boostPendingReadConfirmTx() {
    Catenis.logger.TRACE('Transaction monitoring is on; boost read confirmation transaction that is pending');
    try {
        // Execute code in critical section to make sure task is serialized
        readConfirmCS.execute(() => {
            // Remove event handler
            Catenis.txMonitor.removeListener(TransactionMonitor.notifyEvent.tx_monitor_on.name, this.boostPendingReadConfirmTxEventHandler);

            // Make sure that pending read confirmation transaction is the latest one
            if (this.pendingBoostTxid === this.activeReadConfirmTransact.lastTxid) {
                // Terminate currently active read confirmation transaction resetting its fee rate
                //  so it is confirmed as soon as possible
                this.activeReadConfirmTransact.setOptimumFeeRate();

                sendReadConfirmTransaction.call(this, true);

                // And allocated a new read confirmation tx
                allocNewReadConfirmTransaction.call(this);
            }
            else {
                // Read confirmation tx pending to be boosted is not the last sent transaction.
                //  Log warning condition
                Catenis.logger.WARN('Read confirmation transaction pending to be boosted is not the last sent transaction', {
                    lastTxid: this.activeReadConfirmTransact.lastTxid,
                    pendingBoostTxid: this.pendingBoostTxid
                });
            }

            this.pendingBoostTxid = undefined;
        });
    }
    catch (err) {
        // Error while boosting read confirmation transaction that was pending.
        //  Log error condition
        Catenis.logger.ERROR(util.format('Error while boosting read confirmation transaction (txid: %s) that was pending.', this.pendingBoostTxid), err);
    }
}

// Method used to process notification of confirmed read confirmation transaction
function readConfirmTxConfirmed(data) {
    Catenis.logger.TRACE('Received notification of confirmation of read confirmation transaction', data);
    try {
        // Execute code in critical section to make sure task is serialized
        readConfirmCS.execute(() => {
            if (this.unconfTxTimeoutHandle !== undefined) {
                // Turn off unconfirmed tx timeout
                Meteor.clearTimeout(this.unconfTxTimeoutHandle);
                this.unconfTxTimeoutHandle = undefined;
            }

            // Get read confirmation transaction that was confirmed
            const confirmedTransact = Transaction.fromTxid(data.txid);

            // Make sure that any transaction that had been issued to replace this
            //  one is properly reset
            let lastTxid;
            let nextTxid = confirmedTransact.txid;

            do {
                lastTxid = nextTxid;
                nextTxid = undefined;

                const docSentTx = Catenis.db.collection.SentTransaction.findOne({
                    txid: lastTxid
                }, {
                    fields: {
                        replacedByTxid: 1
                    }
                });

                if (docSentTx !== undefined) {
                    if (docSentTx.replacedByTxid) {
                        // Another transaction had been issued to replace current one.
                        //  Save its ID and update its database entry to indicate otherwise
                        nextTxid = docSentTx.replacedByTxid;
                        const modifier = lastTxid === confirmedTransact.txid ? {$unset: {replacedByTxid: true}} :
                                {$set: {replacedByTxid: null}};

                        Catenis.db.collection.SentTransaction.update({txid: lastTxid}, modifier);
                    }
                    else if (docSentTx.replacedByTxid === undefined) {
                        if (lastTxid !== confirmedTransact.txid) {
                            // A transaction that had replaced the one that is being confirmed (either directly or by means
                            //  of its ancestors) but has not been replaced yet. Update its database entry to indicate that
                            //  it is invalid (and thus shall never be confirmed)
                            Catenis.db.collection.SentTransaction.update({txid: lastTxid}, {$set: {replacedByTxid: null}});
                        }
                    }
                    else { // docSentTx.replacedByTxid === null
                        // Confirmed read confirmation transaction or any of the transactions that had been issued to
                        //  replace it had its database entry already marked as not having a replacement tx.
                        //  Log error condition and throw exception
                        Catenis.logger.ERROR('Confirmed read confirmation transaction or any of the transactions that had been issued to replace it had its database entry already marked as not having a replacement tx', {
                            docSentTx: docSentTx
                        });
                        //noinspection ExceptionCaughtLocallyJS
                        throw new Error(util.format('Confirmed read confirmation transaction or any of the transactions that had been issued to replace it had its database entry (doc_id: %s) already marked as not having a replacement tx', docSentTx._id));
                    }
                }
                else {
                    // Could not find database entry for read confirmation transaction
                    //  Log warning condition
                    Catenis.logger.WARN('Could not find database entry (on SentTransaction collection) for read confirmation transaction', {txid: lastTxid});
                }
            }
            while (nextTxid);

            // Get corresponding read confirmation tx
            const readConfirmTransact = getReadConfirmTransactByTxid.call(this, confirmedTransact.txid);

            if (readConfirmTransact !== undefined) {
                if (lastTxid !== readConfirmTransact.lastTxid) {
                    // Last found read confirmation tx does not match last sent read confirmation tx.
                    //  Log error condition and throw exception
                    Catenis.logger.ERROR('Last found read confirmation transaction does not match last issued read confirmation transaction', {
                        lastFoundTxid: lastTxid,
                        lastSentTxid: readConfirmTransact.lastTxid
                    });
                    //noinspection ExceptionCaughtLocallyJS
                    throw new Error(util.format('Last found read confirmation transaction (txid: %s) does not match last sent read confirmation transaction (txid: %s)', lastTxid, readConfirmTransact.lastTxid));
                }

                let newReadConfirmTransact;

                if (confirmedTransact.txid !== readConfirmTransact.lastTxid || readConfirmTransact.txChanged) {
                    // The confirmed transaction is not the last sent read confirmation transaction, or
                    //  (it is the last one sent but) it has changed (more inputs added possibly) since it was sent

                    // Get new read confirmation transaction containing the differential inputs and outputs
                    newReadConfirmTransact = newReadConfirmTransactionFromDiff(confirmedTransact, readConfirmTransact.transact);
                }

                if (confirmedTransact.txid !== readConfirmTransact.lastTxid) {
                    // The confirmed transaction is not the last sent read confirmation transaction

                    // Check if last sent read confirmation tx had a change output
                    const changeTxout = readConfirmTransact.lastTxChangeTxout;

                    if (changeTxout !== undefined) {
                        // Check if any (unconfirmed) read confirmation transactions sent after the last
                        //  sent read confirmation transaction spends the change output of that transaction
                        //  (and thus needs to be invalidated)
                        let currentReadConfirmTransactFound = false;

                        for (let workReadConfirmTransact of this.readConfirmTransacts) {
                            if (currentReadConfirmTransactFound) {
                                if (workReadConfirmTransact.isTxOutputUsedToPayFee(changeTxout)) {
                                    // Read confirmation transaction is invalid because it spends an output of
                                    //  a transaction that has been invalidated (due to a previous tx that it
                                    // replaced had been confirmed)
                                    Catenis.logger.DEBUG('Found read confirmation tx that spends an output of another read confirmation tx that has been invalided due to a previous tx that it replaced had been confirmed', {
                                        txid: workReadConfirmTransact.lastTxid,
                                        previousTxid: readConfirmTransact.lastTxid
                                    });

                                    // Make sure that UTXOs spent by this transaction is freed
                                    Catenis.bitcoinCore.abandonTransaction(workReadConfirmTransact.lastTxid);

                                    // Merge invalided read confirmation transaction and dispose of it
                                    newReadConfirmTransact = newReadConfirmTransact !== undefined ? newReadConfirmTransact : new ReadConfirmTransaction();
                                    newReadConfirmTransact.mergeReadConfirmTransaction(workReadConfirmTransact);
                                    disposeReadConfirmTransact(workReadConfirmTransact);
                                }
                            }
                            else if (workReadConfirmTransact === readConfirmTransact) {
                                currentReadConfirmTransactFound = true;
                            }
                        }
                    }
                }

                // Dispose of read confirmation transaction associated with confirmed transaction
                disposeReadConfirmTransact.call(this, readConfirmTransact);

                if (newReadConfirmTransact !== undefined && this.activeReadConfirmTransact !== undefined) {
                    // See if we can merge new read confirmation tx with currently active read confirmation tx
                    if (this.activeReadConfirmTransact.lastTxid === undefined || newReadConfirmTransact.areReadConfirmAddrTxConfirmed()) {
                        this.activeReadConfirmTransact.mergeReadConfirmTransaction(newReadConfirmTransact);
                    }
                    else {
                        // Active read confirmation tx has already been sent but not all send message tx the read
                        //  confirmation address outputs of which are being confirmed by the new read confirmation
                        //  tx are confirmed yet.
                        //  Terminate the currently active read confirmation transaction
                        this.activeReadConfirmTransact.setTerminalFeeRate();

                        sendReadConfirmTransaction.call(this, true);

                        // And make the new read confirmation transaction the currently active one
                        allocNewReadConfirmTransaction.call(this, newReadConfirmTransact);
                    }
                }

                if (this.activeReadConfirmTransact === undefined) {
                    // Allocate new read confirmation transaction
                    allocNewReadConfirmTransaction.call(this, newReadConfirmTransact);
                }

                if (this.activeReadConfirmTransact.needsToFund()) {
                    // Send read confirmation transaction
                    sendReadConfirmTransaction.call(this);
                }

                // Record complementary read confirmation transaction for billing purpose
                Billing.recordComplementaryReadConfirmTx(confirmedTransact);
            }
            else {
                // Unable to find corresponding confirmed read confirmation transaction.
                //  Log error condition and throw exception
                Catenis.logger.ERROR('Unable to find corresponding confirmed read confirmation transaction', {
                    confirmedTxid: confirmedTransact.txid,
                    readConfirmTransacts: this.readConfirmTransacts
                });
                //noinspection ExceptionCaughtLocallyJS
                throw new Error('Unable to find corresponding confirmed read confirmation transaction');
            }
        });
    }
    catch (err) {
        // Error while processing notification of confirmed read confirmation transaction.
        //  Just log error condition
        Catenis.logger.ERROR('Error while processing notification of confirmed read confirmation transaction.', err);
    }
}


// ReadConfirmation function class (public) methods
//

ReadConfirmation.initialize = function () {
    Catenis.logger.TRACE('ReadConfirmation initialization');
    // Instantiate ReadConfirmation object
    Catenis.readConfirm = new ReadConfirmation();
};


// ReadConfirmation function class (public) properties
//

ReadConfirmation.confirmationType = Object.freeze({
    spendNotify: Object.freeze({
        name: 'spendNotify',
        description: 'Confirm that message has been read by spending read confirmation output so a notification is sent to the origin device'
    }),
    spendOnly: Object.freeze({
        name: 'spendOnly',
        description: 'Confirm that message has been read by spending read confirmation output without caring to send notification to origin device'
    }),
    spendNull: Object.freeze({
        name: 'spendNull',
        description: 'Spend read confirmation output to mark message as void (a message that target device will never receive)'
    }),
});


// Definition of module (private) functions
//

// Method used to process notification of newly received read confirmation transaction
function processReceivedReadConfirmation(data) {
    Catenis.logger.TRACE('Received notification of newly received read confirmation transaction', data);
    try {
        // Get read confirmation transaction
        const readConfirmTransact = ReadConfirmTransaction.checkTransaction(Transaction.fromTxid(data.txid));

        if (readConfirmTransact.readConfirmAddrSpndNtfyInputCount > 0) {
            // Step through the read confirmation notify inputs identifying the ones that
            //  are associated with send message tx issued by this Catenis node
            const sendMsgTxids = [];

            for (let pos = readConfirmTransact.startReadConfirmAddrSpndNtfyInputPos, limitPos = pos + readConfirmTransact.readConfirmAddrSpndNtfyInputCount; pos < limitPos; pos++) {
                const input = readConfirmTransact.transact.getInputAt(pos);

                // Save ID of send message transaction that is being read confirmed
                sendMsgTxids.push(input.txout.txid);
            }

            // Filter out local messages that had not yet been read confirmed and group
            //  them by origin devices that should be notified
            const idDocMessagesToUpdate = [];
            const idDocMsgsNo1stReadDtToUpdate = [];
            const devIdReadMsgsToNotify = new Map();

            Catenis.db.collection.Message.find({
                action: Message.action.send,
                source: Message.source.local,
                'blockchain.txid': {
                    $in: sendMsgTxids
                },
                readConfirmed: {
                    $exists: false
                }
            }, {
                fields: {
                    _id: 1,
                    messageId: 1,
                    originDeviceId: 1,
                    targetDeviceId: 1,
                    blockchain: 1,
                    firstReadDate: 1
                }
            }).forEach((doc) => {
                if (doc.firstReadDate !== undefined) {
                    idDocMessagesToUpdate.push(doc._id);
                }
                else {
                    // 'Remote' messages the firstReadDate field of which is not filled yet
                    idDocMsgsNo1stReadDtToUpdate.push(doc._id);
                }

                const originDevice = Device.getDeviceByDeviceId(doc.originDeviceId);
                const targetDevice = Device.getDeviceByDeviceId(doc.targetDeviceId);

                if (originDevice.status === Device.status.active.name && originDevice.shouldBeNotifiedOfMessageReadBy(targetDevice)) {
                    // Prepare to notify origin device that previously sent message has been read
                    if (devIdReadMsgsToNotify.has(doc.originDeviceId)) {
                        devIdReadMsgsToNotify.get(doc.originDeviceId).readMsgIds.push({
                            messageId: doc.messageId,
                            targetDevice: targetDevice
                        });
                    }
                    else {
                        devIdReadMsgsToNotify.set(doc.originDeviceId, {
                            originDevice: originDevice,
                            readMsgIds: [{
                                messageId: doc.messageId,
                                targetDevice: targetDevice
                            }]
                        });
                    }
                }
            });

            if (idDocMessagesToUpdate.length > 0) {
                // Update Message collection docs to mark them as read confirmed
                Catenis.db.collection.Message.update({
                    _id: {
                        $in: idDocMessagesToUpdate
                    }
                }, {
                    $set: {
                        readConfirmed: true
                    }
                }, {
                    multi: true
                });
            }

            if (idDocMsgsNo1stReadDtToUpdate.length > 0) {
                // Retrieve date that transaction has been received
                const receivedDate = Catenis.db.collection.ReceivedTransaction.findOne({txid: data.txid}, {fields: {receivedDate: 1}}).receivedDate;

                // Update Message collection docs to mark them as read confirmed, and also
                //  fill date that message was first read
                Catenis.db.collection.Message.update({
                    _id: {
                        $in: idDocMsgsNo1stReadDtToUpdate
                    }
                }, {
                    $set: {
                        firstReadDate: receivedDate,
                        readConfirmed: true
                    }
                }, {
                    multi: true
                });
            }

            // Notify origin devices that messages had been read
            for (let devReadMsgs of devIdReadMsgsToNotify.values()) {
                // Send notification to origin device that previously sent messages have been read
                devReadMsgs.readMsgIds.forEach((msgInfo) => {
                    const message = Message.getMessageByMessageId(msgInfo.messageId);

                    devReadMsgs.originDevice.notifyMessageRead(message, msgInfo.targetDevice);
                })
            }
        }
    }
    catch (err) {
        // Error while processing received read confirmation transaction. Log error condition
        Catenis.logger.ERROR(util.format('Error while processing received read confirmation transaction (txid: %s).', data.txid), err);
    }
}

function newReadConfirmTransactionFromDiff(confirmedTransact, lastSentTransact) {
    // Get differences in inputs and outputs from confirmed to last sent read confirmation transaction
    const diffResult = confirmedTransact.diffTransaction(lastSentTransact);

    // Prepare to add inputs
    const inputsToAdd = [];

    diffResult.inputs.forEach((diffInput) => {
        // Only take into consideration inputs of device read confirmation addresses
        if (diffInput.input.addrInfo.type === KeyStore.extKeyType.dev_read_conf_addr.name) {
            if (diffInput.diffType === Transaction.diffType.insert) {
                inputsToAdd.push(diffInput.input);
            }
            else if (diffInput.diffType === Transaction.diffType.delete) {
                // Input was present in confirmed read confirmation tx but is not present in current
                //  read confirmation tx. Log warning condition
                Catenis.logger.WARN('Input was present in confirmed read confirmation transaction but is not present in currently active read confirmation transaction', {
                    confReadConfirmTxid: confirmedTransact.txid,
                    input: diffInput.input
                });
            }
        }
    });

    // Prepare to add outputs
    const outputsToAdd = {
        outputs: [],
        hasReadConfirmSpendNullOutput: false,
        hasReadConfirmSpendOnlyOutput: false
    };

    diffResult.outputs.forEach((diffOutput) => {
        // Only take into consideration outputs of system spend read confirmation addresses
        if (diffOutput.output.type === Transaction.outputType.P2PKH && (diffOutput.output.payInfo.addrInfo.type === KeyStore.extKeyType.sys_read_conf_spnd_ntfy_addr.name
                || diffOutput.output.payInfo.addrInfo.type === KeyStore.extKeyType.sys_read_conf_spnd_only_addr.name
                || diffOutput.output.payInfo.addrInfo.type === KeyStore.extKeyType.sys_read_conf_spnd_null_addr.name)) {
            if (diffOutput.diffType === Transaction.diffType.insert) {
                // Add new output
                addDiffOutput(outputsToAdd, diffOutput.output);
            }
            else if (diffOutput.diffType === Transaction.diffType.update) {
                const outputToAdd = {
                    type: diffOutput.otherOutput.type,
                    payInfo: {
                        address: diffOutput.otherOutput.payInfo.address,
                        amount: diffOutput.deltaAmount,
                        addrInfo: diffOutput.otherOutput.payInfo.addrInfo
                    }
                };

                if (diffOutput.output.payInfo.address === diffOutput.otherOutput.payInfo.address) {
                    // Need to allocated new address
                    outputToAdd.payInfo.address = BaseBlockchainAddress.getInstance(diffOutput.output.payInfo.addrInfo).newAddressKeys().getAddress();
                    outputToAdd.payInfo.addrInfo = Catenis.keyStore.getAddressInfo(outputToAdd.payInfo.address);
                }

                // Add updated output
                addDiffOutput(outputsToAdd, outputToAdd);
            }
            else if (diffOutput.diffType === Transaction.diffType.delete) {
                // Output was present in confirmed read confirmation tx but is not present in current
                //  read confirmation tx. Log warning condition
                Catenis.logger.WARN('Output was present in confirmed read confirmation transaction but is not present in currently active read confirmation transaction', {
                    confReadConfirmTxid: confirmedTransact.txid,
                    output: diffOutput.output
                });
            }
        }
    });

    if (inputsToAdd.length > 0 || outputsToAdd.outputs.length > 0) {
        // Allocate new read confirmation transaction and initialize its inputs and outputs appropriately
        const newReadConfirmTransaction = new ReadConfirmTransaction();

        newReadConfirmTransaction.initInputsOutputs(inputsToAdd, outputsToAdd.outputs);

        return newReadConfirmTransaction;
    }
}

function addDiffOutput(outputsToAdd, output) {
    // Prepare to insert output taking care to place it in the expected order
    if (output.payInfo.addrInfo.type === KeyStore.extKeyType.sys_read_conf_spnd_null_addr.name) {
        // Spend null output
        if (!outputsToAdd.hasReadConfirmSpendNullOutput) {
            // Add output to beginning of list
            outputsToAdd.unshift(output);
            outputsToAdd.hasReadConfirmSpendNullOutput = true;
        }
        else {
            // Spend null output type is already present. Discard it and
            //  log warning condition
            Catenis.logger.WARN('Duplicate spend null output found in read confirmation tx diff result; output discarded', {
                output: output
            });
        }
    }
    else if (output.payInfo.addrInfo.type === KeyStore.extKeyType.sys_read_conf_spnd_only_addr.name) {
        // Spend only output
        if (!outputsToAdd.hasReadConfirmSpendOnlyOutput) {
            // Add output to beginning of list but after spend null output if it exists
            const newOutputs = [output];

            if (outputsToAdd.hasReadConfirmSpendNullOutput) {
                newOutputs.unshift(outputsToAdd.outputs.shift());
            }

            Array.prototype.unshift.apply(outputsToAdd.outputs, newOutputs);
            outputsToAdd.hasReadConfirmSpendOnlyOutput = true;
        }
        else {
            // Spend only output type is already present. Discard it and
            //  logger warning condition
            Catenis.logger.WARN('Duplicate spend only output found in read confirmation tx diff result; output discarded', {
                output: output
            });
        }
    }
    else {  // output.payInfo.addrInfo.type === KeyStore.extKeyType.sys_read_conf_spnd_notify_addr.name
        // Spend notify output
        
        // Add output to end of list
        outputsToAdd.outputs.push(output);
    }
}


// Module code
//

// Lock function class
Object.freeze(ReadConfirmation);
