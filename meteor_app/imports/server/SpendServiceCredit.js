/**
 * Created by Claudio on 2017-12-20.
 */

//console.log('[SpendServiceCredit.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import util from 'util';
// Third-party node modules
//import config from 'config';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { CriticalSection } from './CriticalSection';
import { Transaction } from './Transaction';
import { CCTransaction } from './CCTransaction';
import { SpendServiceCreditTransaction } from './SpendServiceCreditTransaction';
import { BitcoinCore } from './BitcoinCore';
import { FundSource } from './FundSource';
import { TransactionMonitor } from './TransactionMonitor';
import { Billing } from './Billing';
import { Client } from './Client';

// Config entries
/*const config_entryConfig = config.get('config_entry');

// Configuration settings
const cfgSettings = {
    property: config_entryConfig.get('property_name')
};*/

// Critical section object used to serialize processing tasks
const procCS = new CriticalSection();


// Definition of function classes
//

// SpendServiceCredit function class
export function SpendServiceCredit() {
    Object.defineProperties(this, {
        numUnconfirmedSpendServCredTxs: {
            get: function () {
                // noinspection JSPotentiallyInvalidUsageOfThis
                return this.unconfSpendServCredTxs.size;
            },
            enumerable: true
        },
        terminalSpendServCredTxsChangeTxouts: {
            get: function () {
                const changeTxouts = [];

                // noinspection JSPotentiallyInvalidUsageOfThis
                for (let spendServCredTransact of this.terminalSpendServCredTxs) {
                    const changeTxout = spendServCredTransact.lastSentTxChangeTxout;

                    if (changeTxout !== undefined) {
                        changeTxouts.push(changeTxout);
                    }
                }

                return changeTxouts.length > 0 ? changeTxouts : undefined;
            },
            enumerable: true
        }
    });

    this.unconfSpendServCredTxs = new Set();
    this.terminalSpendServCredTxs = new Set();
    this.clientIdSpendServCredTx = new Map();
    this.txUnconfirmedTooLongEventHandler = boostSpendServCredTx.bind(this);
    this.noMorePaymentsEventHandler = setTerminalSpendServCredTx.bind(this);

    this.pendingBoostTxids = [];
    this.transactMonitorOnEventHandler = undefined;

    // Set up handler to process event indicating that spend service credit tx has been confirmed
    TransactionMonitor.addEventHandler(TransactionMonitor.notifyEvent.spend_service_credit_tx_conf.name, spendServCredTxConfirmed.bind(this));

    // Retrieve unconfirmed spend service credit transactions
    let numRetDocs;

    Catenis.db.collection.SentTransaction.find({
        type: Transaction.type.spend_service_credit.name,
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
            'info.spendServiceCredit': 1
        }
    }).forEach((doc, docIdx, cursor) => {
        if (numRetDocs === undefined) {
            numRetDocs = cursor.count();
        }

        const transact = Transaction.fromTxid(doc.txid);
        transact.sentDate = doc.sentDate;

        const spendServCredTransact = newSpendServCredTransaction.call(this, CCTransaction.fromTransaction(transact), docIdx === numRetDocs - 1);

        this.unconfSpendServCredTxs.add(spendServCredTransact);

        spendServCredTransact.clientIds.forEach((clientId) => {
            this.clientIdSpendServCredTx.set(clientId, spendServCredTransact);
        });
    });
}


// Public SpendServiceCredit object methods
//

// NOTE: make sure that this method is called from code executed from the CCFundSource.utxoCS critical section object
SpendServiceCredit.prototype.payForService = function (client, serviceTxid, price, sendNow = true) {
    let spendServCredTransact = undefined;

    // Execute code in critical section to make sure task is serialized
    procCS.execute(() => {
        let tryAgain = false;
        let createNewTx = false;

        do {
            spendServCredTransact = getSpendServCredTxByClient.call(this, client.clientId, createNewTx);
            Catenis.logger.DEBUG('>>>>>> Spend service credit transaction allocated for client (clientId: %s): %s', client.clientId, util.inspect(spendServCredTransact, {depth: 2}));

            try {
                spendServCredTransact.payForService(client, serviceTxid, price);
                tryAgain = false;
            }
            catch (err) {
                if ((err instanceof Meteor.Error)) {
                    // Note: we do not care checking if have already tried again because, once we try again
                    //  for this purpose, it is guaranteed that the client will be assigned to another
                    //  spend service credit transaction that can still process more payments, which in turn
                    //  shall never re-trigger this same error
                    if (err.error === 'ctn_spend_serv_cred_no_more_payments') {
                        tryAgain = true;
                    }
                    // Note: we do not care checking if have already tried again because, once we try again
                    //  for this purpose, it is guaranteed that the client will be assigned to another
                    //  spend service credit transaction that can still fit one more client, which in turn
                    //  shall never re-trigger this same error
                    else if (err.error === 'ctn_spend_serv_cred_no_more_client') {
                        // Cancel current client assignment before trying again to for client to be
                        //  assigned to another spend service credit transaction
                        this.clientIdSpendServCredTx.delete(client.clientId);
                        tryAgain = true;
                    }
                    else if (err.error === 'ctn_spend_serv_cred_utxo_alloc_error') {
                        Catenis.logger.DEBUG('>>>>>> Error returned from SpendServiceCreditTransaction.payForService(): unable to allocate UTXOs for client service account credit line address outputs');
                        // Note: we do not care checking if have already tried again because, once we try again
                        //  for this purpose, a new spend service credit transaction is used, which in turn
                        //  is guaranteed that spendServCredTransact.lastSentCcTransact be undefined
                        if (spendServCredTransact.lastSentCcTransact !== undefined) {
                            Catenis.logger.DEBUG('>>>>>> Force client to be allocated to new spend service credit transaction and try again');
                            // Try again assigning client to a new spend service credit transaction
                            createNewTx = true;
                            tryAgain = true;
                        }
                        else {
                            Catenis.logger.DEBUG('>>>>>> Just throw error');
                            if (tryAgain && createNewTx) {
                                // Same error even after trying to assign client to a new spend service credit transaction.
                                //  So, cancel this assignment before throwing error
                                this.clientIdSpendServCredTx.delete(client.clientId);
                            }

                            throw err;
                        }
                    }
                    else {
                        throw err;
                    }
                }
                else {
                    throw err;
                }
            }
        }
        while (tryAgain);

        if (sendNow && (spendServCredTransact.needsToFund() || spendServCredTransact.needsToSend())) {
            // Send spend service credit transaction
            sendSpendServCredTransaction(spendServCredTransact);
        }
    });

    return spendServCredTransact;
};


// Module functions used to simulate private SpendServiceCredit object methods
//  NOTE: these functions need to be bound to a SpendServiceCredit object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

function newSpendServCredTransaction(ccTransact, addNoBillingServTxs) {
    const spendServCredTransact = new SpendServiceCreditTransaction(this, ccTransact, true, addNoBillingServTxs);

    // Set up event handler to receive notification of tx unconfirmed for too long
    spendServCredTransact.on(SpendServiceCreditTransaction.notifyEvent.tx_unconfirmed_too_long.name, this.txUnconfirmedTooLongEventHandler);

    // Set up event handler to receive notification of no more payments accepted
    spendServCredTransact.on(SpendServiceCreditTransaction.notifyEvent.no_more_payments.name, this.noMorePaymentsEventHandler);

    return spendServCredTransact;
}

function disposeSpendServCredTransaction(spendServCredTransact) {
    // Remove tx unconfirmed for too long event handler
    spendServCredTransact.removeListener(SpendServiceCreditTransaction.notifyEvent.tx_unconfirmed_too_long.name, this.txUnconfirmedTooLongEventHandler);

    // Remove no more payments accepted event handler
    spendServCredTransact.removeListener(SpendServiceCreditTransaction.notifyEvent.no_more_payments.name, this.noMorePaymentsEventHandler);

    spendServCredTransact.dispose();

    this.unconfSpendServCredTxs.delete(spendServCredTransact);
    this.terminalSpendServCredTxs.delete(spendServCredTransact);

    for (let [clientId, transact] of this.clientIdSpendServCredTx) {
        if (transact === spendServCredTransact) {
            this.clientIdSpendServCredTx.delete(clientId);
        }
    }
}

function getSpendServCredTxByClient(clientId, createNewTx = false) {
    let spendServCredTransact;

    if (this.clientIdSpendServCredTx.has(clientId)) {
        spendServCredTransact = this.clientIdSpendServCredTx.get(clientId);

        // Make sure that spend service credit transaction associated with client
        //  is still unconfirmed and can accept more payments
        if (!this.unconfSpendServCredTxs.has(spendServCredTransact) || spendServCredTransact.noMorePaymentsAccepted) {
            // Time to allocate a new spend service credit transaction
            spendServCredTransact = allocateServCredTxForClient.call(this, clientId);
        }
    }
    else {
        // No spend service credit transaction associated with this client yet.
        //  Time to allocate a new spend service credit transaction
        spendServCredTransact = allocateServCredTxForClient.call(this, clientId, createNewTx);
    }

    return spendServCredTransact;
}

function allocateServCredTxForClient(clientId, createNewTx = false) {
    if (!createNewTx && this.unconfSpendServCredTxs.size > 0) {
        // Look for first unconfirmed spend service credit transaction that can still fit a new client
        //  and process more payments
        for (let spendServCredTransct of this.unconfSpendServCredTxs) {
            if (!this.terminalSpendServCredTxs.has(spendServCredTransct) && !spendServCredTransct.maxNumClientsReached && !spendServCredTransct.noMorePaymentsAccepted) {
                // Assign client to this unconfirmed spend service credit transaction
                this.clientIdSpendServCredTx.set(clientId, spendServCredTransct);
                return spendServCredTransct;
            }
        }
    }

    // Create a new spend service credit transaction and allocated it to client
    const spendServCredTransact = newSpendServCredTransaction.call(this);

    this.unconfSpendServCredTxs.add(spendServCredTransact);
    this.clientIdSpendServCredTx.set(clientId, spendServCredTransact);

    return spendServCredTransact;
}

function getSpendServCredTxByTxid(txid) {
    for (let spendServCredTransact of this.unconfSpendServCredTxs) {
        if (spendServCredTransact.lastSentCcTransact !== undefined && spendServCredTransact.lastSentCcTransact.txid === txid) {
            return spendServCredTransact;
        }
    }
}

function getConfirmedSpendServCredTx(confirmTxid) {
    for (let spendServCredTransact of this.unconfSpendServCredTxs) {
        if ((spendServCredTransact.lastSentCcTransact !== undefined && spendServCredTransact.lastSentCcTransact.txid === confirmTxid)
                || spendServCredTransact.hasTxidBeenUsed(confirmTxid)) {
            return spendServCredTransact;
        }
    }
}

function boostSpendServCredTx(txid) {
    Catenis.logger.TRACE('Received event notifying that spend service credit transaction has not been confirmed for too long', {txid: txid});
    try {
        // Execute code in critical section to make sure task is serialized
        procCS.execute(() => {
            // Retrieve spend service credit transaction for which notification has been issued
            const spendServCredTransact = getSpendServCredTxByTxid.call(this, txid);

            if (spendServCredTransact !== undefined) {
                // Prepare to boost transaction so it is confirmed as soon as possible
                if (TransactionMonitor.isMonitoringOn()) {
                    // Terminate spend service credit transaction resetting its fee rate
                    //  so it is confirmed as soon as possible
                    spendServCredTransact.setOptimumFeeRate();

                    try {
                        sendSpendServCredTransaction(spendServCredTransact, true);
                    }
                    catch (err) {
                        if ((err instanceof Meteor.Error) && err.error === 'ctn_spend_serv_cred_tx_rejected') {
                            // Transaction rejected when trying to send it. Either it is already confirmed or it has
                            //  been replaced by another transaction. So, just proceed with normal processing
                            Catenis.logger.DEBUG('Spend service credit transaction has been rejected when trying to send it after boosting it. Either it has already been confirmed or it has been replaced by another transaction. So proceed with normal processing');
                        }
                        else {
                            throw err;
                        }
                    }
                }
                else {
                    // Transaction monitoring is not currently on.
                    //  Save transaction to boost it later and wait for event signalling that monitoring is on
                    this.pendingBoostTxids.push(txid);
                    this.transactMonitorOnEventHandler = this.transactMonitorOnEventHandler !== undefined ? this.transactMonitorOnEventHandler : boostPendingSpendServCredTx.bind(this);

                    TransactionMonitor.addEventHandler(TransactionMonitor.notifyEvent.tx_monitor_on.name, this.transactMonitorOnEventHandler);
                }
            }
            else {
                // Spend service credit transaction for which notification of unconfirmed for too long has been issued either has already been confirmed or has been replaced.
                //  Log warning condition
                Catenis.logger.WARN('Spend service credit transaction for which notification of unconfirmed for too long has been issued either has already been confirmed or has been replaced', {
                    notificationTxid: txid
                });
            }
        });
    }
    catch (err) {
        // Error while processing notification of spend service credit transaction unconfirmed for too long.
        //  Log error condition
        Catenis.logger.ERROR('Error while processing notification of spend service credit transaction unconfirmed for too long (txid: %s).', txid, err);
    }
}

function boostPendingSpendServCredTx() {
    Catenis.logger.TRACE('Transaction monitoring is on; boost spend service credit transactions that are pending');
    try {
        // Execute code in critical section to make sure task is serialized
        procCS.execute(() => {
            // Remove event handler
            Catenis.txMonitor.removeListener(TransactionMonitor.notifyEvent.tx_monitor_on.name, this.transactMonitorOnEventHandler);

            // Process all spend service credit transactions pending to be boosted
            this.pendingBoostTxids.forEach((txid) => {
                // Retrieve spend service credit transaction for which notification has been issued
                const spendServCredTransact = getSpendServCredTxByTxid.call(this, txid);

                if (spendServCredTransact !== undefined) {
                    // Terminate spend service credit transaction resetting its fee rate
                    //  so it is confirmed as soon as possible
                    spendServCredTransact.setOptimumFeeRate();

                    try {
                        sendSpendServCredTransaction(spendServCredTransact, true);
                    }
                    catch (err) {
                        if ((err instanceof Meteor.Error) && err.error === 'ctn_spend_serv_cred_tx_rejected') {
                            // Transaction rejected when trying to send it. Either it is already confirmed or it has
                            //  been replaced by another transaction. So, just proceed with normal processing
                            Catenis.logger.DEBUG('Spend service credit transaction has been rejected when trying to send it after boosting it. Either it has already been confirmed or it has been replaced by another transaction. So proceed with normal processing');
                        }
                        else {
                            throw err;
                        }
                    }
                }
                else {
                    // Spend service credit transaction pending to be boosted either has already been confirmed or has been replaced.
                    //  Log warning condition
                    Catenis.logger.WARN('Spend service credit transaction pending to be boosted either has already been confirmed or has been replaced', {
                        pendingTxid: txid
                    });
                }
            });

            // Reset list of spend service credit transactions pending to be boosted
            this.pendingBoostTxids = [];
        });
    }
    catch (err) {
        // Error while boosting spend service credit transactions that were pending.
        //  Log error condition
        Catenis.logger.ERROR('Error while boosting spend service credit transactions that were pending (txids: %s) that was pending.', this.pendingBoostTxids.join(', '), err);
    }
}

function setTerminalSpendServCredTx(txid) {
    Catenis.logger.TRACE('Received event notifying that spend service credit transaction does not accept any more payments', {txid: txid});
    const spendServCredTransact = getSpendServCredTxByTxid.call(this, txid);

    if (spendServCredTransact !== undefined) {
        this.terminalSpendServCredTxs.add(spendServCredTransact);
    }
    else {
        // Could not find spend service credit transaction to set as terminal.
        //  Log error condition
        Catenis.logger.ERROR('Could not find spend service credit transaction to set as terminal');
    }
}

// Method used to process notification of confirmed spend service credit transaction
function spendServCredTxConfirmed(data) {
    Catenis.logger.TRACE('Received notification of confirmation of spend service credit transaction', data);
    try {
        // Force update of Colored Coins data associated with UTXOs
        Catenis.c3NodeClient.parseNow();

        // Execute code in critical section to make sure task is serialized
        procCS.execute(() => {
            // Get spend service credit transaction that had been confirmed
            const spendServCredTransact = getConfirmedSpendServCredTx.call(this, data.txid);

            if (spendServCredTransact !== undefined) {
                // Indicate that transaction has been confirmed
                spendServCredTransact.txConfirmed();

                // Get the actual (Colored Coins) transaction that have been confirmed
                const confirmedCcTransact = CCTransaction.fromTransaction(Transaction.fromTxid(data.txid));

                // Make sure that any transaction that had been issued to replace this
                //  one is properly reset
                let lastTxid;
                let nextTxid = confirmedCcTransact.txid;

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
                            const modifier = lastTxid === confirmedCcTransact.txid ? {$unset: {replacedByTxid: true}} :
                                    {$set: {replacedByTxid: null}};

                            Catenis.db.collection.SentTransaction.update({txid: lastTxid}, modifier);
                            Catenis.logger.DEBUG('>>>>>> SentTransaction doc/rec for spend service credit transaction has been updated', {
                                txid: lastTxid,
                                modifier: modifier
                            });
                        }
                        else if (docSentTx.replacedByTxid === undefined) {
                            if (lastTxid !== confirmedCcTransact.txid) {
                                // A transaction that had replaced the one that is being confirmed (either directly or by means
                                //  of its ancestors) but has not been replaced yet. Update its database entry to indicate that
                                //  it is invalid (and thus shall never be confirmed)
                                Catenis.db.collection.SentTransaction.update({txid: lastTxid}, {$set: {replacedByTxid: null}});
                                Catenis.logger.DEBUG('>>>>>> SentTransaction doc/rec for spend service credit transaction has been updated to set replacedByTxid = null', {
                                    txid: lastTxid
                                });
                            }
                        }
                        else { // docSentTx.replacedByTxid === null
                            // Confirmed spend service credit transaction or any of the transactions that had been issued to
                            //  replace it had its database entry already marked as not having a replacement tx.
                            //  Log error condition and throw exception
                            Catenis.logger.ERROR('Confirmed spend service credit transaction or any of the transactions that had been issued to replace it had its database entry already marked as not having a replacement tx', {
                                docSentTx: docSentTx
                            });
                            //noinspection ExceptionCaughtLocallyJS
                            throw new Error(util.format('Confirmed spend service credit transaction or any of the transactions that had been issued to replace it had its database entry (doc_id: %s) already marked as not having a replacement tx', docSentTx._id));
                        }
                    }
                    else {
                        // Could not find database entry for spend service credit transaction
                        //  Log warning condition
                        Catenis.logger.WARN('Could not find database entry (on SentTransaction collection) for spend service credit transaction', {txid: lastTxid});
                    }
                }
                while (nextTxid);

                if (lastTxid !== spendServCredTransact.lastSentCcTransact.txid) {
                    // Last found spend service credit tx does not match last sent spend service credit tx.
                    //  Log error condition and throw exception
                    Catenis.logger.ERROR('Last found spend service credit transaction does not match last sent spend service credit transaction', {
                        lastFoundTxid: lastTxid,
                        lastSentTxid: spendServCredTransact.lastSentCcTransact.txid
                    });
                    //noinspection ExceptionCaughtLocallyJS
                    throw new Error(util.format('Last found spend service credit transaction (txid: %s) does not match last sent spend service credit transaction (txid: %s)', lastTxid, spendServCredTransact.lastSentCcTransact.txid));
                }

                let confirmedSpendServiceCreditTransact;
                let missingServTxids = [];

                if (confirmedCcTransact.txid !== spendServCredTransact.lastSentCcTransact.txid || spendServCredTransact.txChanged) {
                    // The confirmed transaction is not the last sent spend service credit transaction, or
                    //  (it is the last one sent but) it has changed (more services paid) since it was sent
                    Catenis.logger.DEBUG('>>>>>> Looking for missing service transactions not included in confirmed spend service credit transaction', {
                        confirmedCcTxid: confirmedCcTransact.txid,
                        lastSentCcTxid: spendServCredTransact.lastSentCcTransact.txid,
                        spendServCredTxChanged: spendServCredTransact.txChanged
                    });

                    // Retrieve service transaction IDs that are missing from confirmed spend service credit transaction
                    confirmedSpendServiceCreditTransact = new SpendServiceCreditTransaction(undefined, confirmedCcTransact, false);

                    missingServTxids = spendServCredTransact.missingServiceTxids(confirmedSpendServiceCreditTransact);
                }

                if (confirmedCcTransact.txid !== spendServCredTransact.lastSentCcTransact.txid) {
                    // The confirmed transaction is not the last sent spend service credit transaction

                    // Check if last sent spend service credit tx had a change output
                    const changeTxout = spendServCredTransact.lastSentTxChangeTxout;

                    if (changeTxout !== undefined) {
                        // Check if any other (unconfirmed) spend service credit transactions spends the change output
                        //  of that transaction (and thus needs to be invalidated)
                        for (let workSpendServCredTransact of this.unconfSpendServCredTxs) {
                            if (workSpendServCredTransact !== spendServCredTransact && workSpendServCredTransact.isTxOutputUsedToPayLastSentTxExpense(changeTxout)) {
                                // Spend service credit transaction is invalid because it spends an output of
                                //  a transaction that has been invalidated (due to a previous tx that it
                                //  replaced had been confirmed)
                                Catenis.logger.DEBUG('Found spend service credit tx that spends an output of another spend service credit tx that has been invalided due to a previous tx that it replaced had been confirmed', {
                                    txid: workSpendServCredTransact.lastSentCcTransact.txid,
                                    previousTxid: spendServCredTransact.lastSentCcTransact.txid
                                });

                                // Make sure that UTXOs spent by this transaction is freed
                                Catenis.bitcoinCore.abandonTransaction(workSpendServCredTransact.lastSentCcTransact.txid);

                                // Add IDs of service transactions that had been paid by invalided transaction so they
                                //  can be reprocessed
                                missingServTxids = missingServTxids.concat(workSpendServCredTransact.serviceTxids);
                            }
                        }
                    }
                }

                // Dispose of spend service credit transaction that had been confirmed
                disposeSpendServCredTransaction.call(this, spendServCredTransact);

                // Record service payment transaction for billing purpose
                Billing.recordServicePaymentTransaction(confirmedSpendServiceCreditTransact !== undefined ? confirmedSpendServiceCreditTransact : spendServCredTransact);

                if (missingServTxids.length > 0) {
                    // Reprocess missing service transactions
                    Meteor.defer(reprocessServiceTransactions.bind(this, missingServTxids));
                }
            }
            else {
                // Unable to find spend service credit transaction that had been confirmed.
                //  Log error condition and throw exception
                Catenis.logger.ERROR('Unable to find spend service credit transaction that had been confirmed', {
                    confirmedTxid: data.txid,
                    unconfSpendServCredTxs: this.unconfSpendServCredTxs
                });
                //noinspection ExceptionCaughtLocallyJS
                throw new Error('Unable to find spend service credit transaction that had been confirmed');
            }
        });
    }
    catch (err) {
        // Error while processing notification of confirmed spend service credit transaction.
        //  Just log error condition
        Catenis.logger.ERROR('Error while processing notification of confirmed spend service credit transaction.', err);
    }
}

function reprocessServiceTransactions(serviceTxids) {
    Catenis.logger.TRACE('About to reprocess service transactions', {serviceTxids: serviceTxids});
    try {
        const spendServCredTxsToSend = new Set();

        serviceTxids.forEach((txid) => {
            // Try to retrieve associated billing entry for service transaction
            const billing = Billing.getBillingByServiceTxid(txid);

            if (billing !== undefined) {
                spendServCredTxsToSend.add(this.payForService(Client.getClientByClientId(billing.clientId, true), txid, billing.finalServicePrice, false));
            }
            else {
                // Billing entry for service transaction not found.
                //  Log error condition and throw exception
                Catenis.logger.ERROR('Billing entry for service transaction (txid: %s) not found', txid);
                throw new Error(util.format('Billing entry for service transaction (txid: %s) not found', txid));
            }
        });

        // Execute code in critical section to make sure task is serialized
        procCS.execute(() => {
            for (let spendServCredTransact of spendServCredTxsToSend) {
                if (spendServCredTransact.needsToFund() || spendServCredTransact.needsToSend()) {
                    // Send spend service credit transaction
                    sendSpendServCredTransaction(spendServCredTransact);
                }
            }
        });
    }
    catch (err) {
        // Error while reprocessing service transactions.
        //  Log error condition
        Catenis.logger.ERROR('Error while reprocessing service transactions (serviceTxids: %s).', serviceTxids.join(', '), err);
    }
}


// SpendServiceCredit function class (public) methods
//

SpendServiceCredit.initialize = function () {
    Catenis.logger.TRACE('SpendServiceCredit initialization');
    // Instantiate SpendServiceCredit object
    Catenis.spendServCredit = new SpendServiceCredit();
};


// SpendServiceCredit function class (public) properties
//


// Definition of module (private) functions
//

function sendSpendServCredTransaction(spendServCredTransact, isTerminal = false) {
    // Execute code in critical section to avoid UTXOs concurrency
    FundSource.utxoCS.execute(() => {
        if (spendServCredTransact.needsToFund()) {
            try {
                // Fund spend service credit tx
                spendServCredTransact.fundTransaction();
            }
            catch (err) {
                // Error funding spend service credit transaction.
                //  Log error condition and rethrows exception
                Catenis.logger.ERROR('Error funding spend service credit transaction.', err);

                throw err;
            }
        }

        if (spendServCredTransact.needsToSend()) {
            const lastSentTxid = spendServCredTransact.lastSentCcTransact !== undefined ? spendServCredTransact.lastSentCcTransact.txid : undefined;

            try {
                // Send spend service credit tx
                spendServCredTransact.sendTransaction(isTerminal);
            }
            catch (err) {
                // Error sending spend service credit transaction
                if ((err instanceof Meteor.Error) && err.error === 'ctn_btcore_rpc_error' && err.details !== undefined && typeof err.details.code === 'number'
                        && (err.details.code === BitcoinCore.rpcErrorCode.RPC_VERIFY_ERROR || err.details.code === BitcoinCore.rpcErrorCode.RPC_VERIFY_REJECTED)) {
                    // Transaction has been rejected
                    if (lastSentTxid) {
                        let txInfo;

                        try {
                            // Check if it is due to the fact that previous tx that would have been replaced was confirmed
                            txInfo = Catenis.bitcoinCore.getTransaction(lastSentTxid, false);
                        }
                        catch (err2) {
                            Catenis.logger.ERROR('Error trying to get confirmation status of previously sent transaction (txid: %s) of spend service credit transaction that failed to be sent', lastSentTxid, err);
                        }

                        if (txInfo !== undefined && txInfo.confirmations !== 0) {
                            // Last sent spend service credit tx has either been confirmed or replaced.
                            //  Log warning condition
                            Catenis.logger.WARN('Spend service credit transaction has been rejected when trying to send it', {
                                transact: spendServCredTransact.ccTransact
                            });
                            throw new Meteor.Error('ctn_spend_serv_cred_tx_rejected', 'Spend service credit transaction has been rejected when trying to send it');
                        }
                    }
                }

                // Log error condition and rethrows it
                Catenis.logger.ERROR('Error sending spend service credit transaction: %s', util.inspect(spendServCredTransact, {depth: 6}), err);

                throw err;
            }
        }
    });
}


// Module code
//

// Lock function class
Object.freeze(SpendServiceCredit);
