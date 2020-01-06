/**
 * Created by claudio on 2019-12-18
 */

//console.log('[OffChainMessagesSettlement.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import config from 'config';
import moment from 'moment';
import async from 'async';
import Future from 'fibers/future';
import ctnOffChainLib from 'catenis-off-chain-lib';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { Util } from './Util';
import { SettleOffChainMessagesTransaction } from './SettleOffChainMessagesTransaction';
import { Service } from './Service';
import { TransactionMonitor } from './TransactionMonitor';
import { Transaction } from './Transaction';
import { Billing } from './Billing';

// Config entries
const ocMsgsSetlmtConfig = config.get('offChainMessagesSettlement');

// Configuration settings
const cfgSettings = {
    refTimeZone: ocMsgsSetlmtConfig.get('refTimeZone'),
    startTime: ocMsgsSetlmtConfig.get('startTime'),
    cyclesPerDay: ocMsgsSetlmtConfig.get('cyclesPerDay'),
    maxCyclesToPostpone: ocMsgsSetlmtConfig.get('maxCyclesToPostpone')
};


// Definition of classes
//

// OffChainMessagesSettlement class
export class OffChainMessagesSettlement {
    constructor(cyclesPerDay, refTimeZone, startTime) {
        this.cyclesPerDay = cyclesPerDay;
        this.refTimeZone = refTimeZone;
        this.startTime = startTime;
        this.periodInMilliseconds = cyclesPerDay >= 1 ? Math.round(24 * 3600000 / cyclesPerDay) : Math.round(24 / cyclesPerDay) * 3600000;
        this.mtCurrentCycleTime = undefined;
        this.mtNextCycleTime = undefined;
        this.mtNext24HrBoundary = undefined;
        this.settlementCycleTimeout = undefined;
        this.postponedCycles = 0;

        // Set up handler for event indicating that read confirmation transaction has been received
        TransactionMonitor.addEventHandler(TransactionMonitor.notifyEvent.settle_off_chain_messages_tx_rcvd.name, processReceivedSettlementTransaction);

        this.programNextCycle();
    }

    nextCycleTime(mtNow, returnMoment = true) {
        mtNow = mtNow || moment();
        let msecToIncrement;

        if (!this.mtCurrentCycleTime) {
            const mtStartTime = Util.timeReferenceTimeZone(this.startTime, undefined, this.refTimeZone, true);

            if (mtStartTime.isAfter(mtNow)) {
                // Adjust start time
                mtStartTime.subtract(1, 'days');
            }

            this.mtCurrentCycleTime = mtStartTime.clone();

            let diffMilliseconds = mtNow.diff(mtStartTime);

            if (diffMilliseconds > this.periodInMilliseconds) {
                this.mtCurrentCycleTime.add(Math.floor(diffMilliseconds / this.periodInMilliseconds) * this.periodInMilliseconds, 'milliseconds');
            }

            msecToIncrement = this.periodInMilliseconds;

            if (this.cyclesPerDay > 1) {
                this.mtNext24HrBoundary = mtStartTime.add(1, 'days');
            }
        }
        else {
            if (this.cyclesPerDay > 1) {
                // Check if 24 hour boundary will be crossed or just reached and adjust it
                const msecTo24HrBoundary = this.mtNext24HrBoundary.diff(this.mtCurrentCycleTime);

                if (msecTo24HrBoundary < this.periodInMilliseconds) {
                    // Boundary crossed
                    msecToIncrement = msecTo24HrBoundary;

                    this.mtNext24HrBoundary.add(1, 'days');
                }
                else {
                    let diffMilliseconds = msecTo24HrBoundary - this.periodInMilliseconds;

                    if (diffMilliseconds < this.periodInMilliseconds / 2) {
                        // Boundary just reached
                        msecToIncrement = this.periodInMilliseconds + diffMilliseconds;

                        this.mtNext24HrBoundary.add(1, 'days');
                    }
                    else {
                        msecToIncrement = this.periodInMilliseconds;
                    }
                }
            }
            else {
                msecToIncrement = this.periodInMilliseconds;
            }
        }

        this.mtNextCycleTime = this.mtCurrentCycleTime.clone().add(msecToIncrement, 'milliseconds');

        return returnMoment ? this.mtNextCycleTime : this.mtNextCycleTime.toDate();
    }

    programNextCycle() {
        const mtNow = moment();

        const mtNextCycleTime = this.nextCycleTime(mtNow);
        Catenis.logger.DEBUG('Next off-chain messages settlement set to be processed at %s', mtNextCycleTime.toISOString());

        this.settlementCycleTimeout = Meteor.setTimeout(handleSettlementCycle.bind(this), mtNextCycleTime.diff(mtNow));
    }

    doProcessing() {
        try {
            // Retrieve saved Catenis off-chain message data that have not yet been settled
            const ocMsgDataCids = [];
            let msgEnvCount = 0;
            let msgRcptCount = 0;

            Catenis.db.collection.SavedOffChainMsgData.find({
                'settlement.settled': false
            }, {
                fields: {
                    dataType: 1,
                    cid: 1
                }
            }).forEach(doc => {
                ocMsgDataCids.push(doc.cid);

                if (doc.dataType === ctnOffChainLib.OffChainData.msgDataType.msgEnvelope.name) {
                    msgEnvCount++;
                }
                else if (doc.dataType === ctnOffChainLib.OffChainData.msgDataType.msgReceipt.name) {
                    msgRcptCount++;
                }
            });

            if (ocMsgDataCids.length > 0) {
                // Make sure that minimum expected off-chain messages are available to be settled
                let ocMsgsCountForCost;

                if ((ocMsgsCountForCost = computeOCMsgsCountForCost(msgEnvCount, msgRcptCount)) >= Service.numOffChainMsgsToPayCost || this.postponedCycles === cfgSettings.maxCyclesToPostpone) {
                    if (ocMsgsCountForCost < Service.numOffChainMsgsToPayCost) {
                        Catenis.logger.WARN('Settling off-chain messages now even though there are not enough off-chain messages to cover settlement cost', {
                            msgEnvCount,
                            msgRcptCount,
                            ocMsgsCountForCost,
                            numOffChainMsgsToPayCost: Service.numOffChainMsgsToPayCost
                        });
                    }

                    const ocMsgs = [];

                    // Get Catenis off-chain message data structures to settle
                    async.each(ocMsgDataCids, (cid, cb) => {
                        Catenis.ctnOCClient.getSingleOffChainMsgData(cid, true, (err, data) => {
                            if (err) {
                                cb(err);
                            }
                            else {
                                ocMsgs.push({
                                    msgInfo: data.dataType === ctnOffChainLib.OffChainData.msgDataType.msgEnvelope.name
                                        ? ctnOffChainLib.MessageEnvelope.fromBase64(data.data)
                                        : ctnOffChainLib.MessageReceipt.fromBase64(data.data),
                                    msgDataCid: cid
                                });

                                cb();
                            }
                        })
                    }, (err) => {
                        if (err) {
                            Catenis.logger.ERROR('Error processing settlement of off-chain messages (get off-chain message data stage).', err);
                        }
                        else {
                            let settleOCMsgsTransact;

                            Future.task(() => {
                                // Assemble Catenis off-chain messages batch document
                                const batchDocument = new ctnOffChainLib.BatchDocument(ocMsgs);
                                batchDocument.build();

                                // Prepare transaction to settle off-chain messages
                                settleOCMsgsTransact = new SettleOffChainMessagesTransaction(batchDocument);

                                // Build and send transaction
                                settleOCMsgsTransact.buildTransaction();
                                settleOCMsgsTransact.sendTransaction();
                                Catenis.logger.TRACE('Settle off-chain messages transaction successfully sent', {txid: settleOCMsgsTransact.txid});

                                // Force polling of blockchain so newly sent transaction is received and processed right away
                                Catenis.txMonitor.pollNow();

                                // Reset number of postponed cycles
                                this.postponedCycles = 0;

                                // Update saved off-chain message data entries in local database indicating that it has already been settled
                                Catenis.db.collection.SavedOffChainMsgData.update({
                                    'cid': {
                                        $in: ocMsgDataCids
                                    }
                                }, {
                                    $set: {
                                        settlement: {
                                            settled: true,
                                            settleOffChainMsgsTxid: settleOCMsgsTransact.txid
                                        }
                                    }
                                }, {multi: true});
                            }).resolve((err) => {
                                if (err) {
                                    Catenis.logger.ERROR('Error processing settlement of off-chain messages (send settle off-chain messages tx stage).', err);

                                    if (settleOCMsgsTransact && !settleOCMsgsTransact.txid) {
                                        // Revert output addresses added to transaction
                                        settleOCMsgsTransact.revertOutputAddresses();
                                    }
                                }
                            });
                        }
                    });
                }
                else {
                    // Not enough off-chain messages available to be settled to cover the cost to settle off-chain messages
                    Catenis.logger.INFO('Not enough off-chain messages awaiting to be settled to cover the settlement cost; postponing settlement');

                    // Increment number of postponed cycles
                    this.postponedCycles++;
                }
            }
            else {
                Catenis.logger.TRACE('No off-chain messages to be settled');
            }
        }
        catch (err) {
            Catenis.logger.ERROR('Error processing settlement of off-chain messages.', err);
        }
    }

    static initialize() {
        Catenis.logger.TRACE('OffChainMessagesSettlement initialization');
        // Instantiate OffChainMessagesSettlement object
        Catenis.ocMsgsSettlement = new OffChainMessagesSettlement(cfgSettings.cyclesPerDay, cfgSettings.refTimeZone, cfgSettings.startTime);
    }
}


// Module functions used to simulate private OffChainMessagesSettlement object methods
//  NOTE: these functions need to be bound to a OffChainMessagesSettlement object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

function handleSettlementCycle() {
    Catenis.logger.TRACE('Time to handle settlement of off-chain messages');
    this.settlementCycleTimeout = undefined;

    this.mtCurrentCycleTime = this.mtNextCycleTime;
    this.mtNextCycleTime = undefined;

    this.programNextCycle();
    this.doProcessing();
}

function computeOCMsgsCountForCost(msgEnvCount, msgRcptCount) {
    return Math.floor(msgEnvCount + msgRcptCount * Service.offChainMsgReceiptPercentageCost);
}

function processReceivedSettlementTransaction(data) {
    Catenis.logger.TRACE('Received notification of newly received settle off-chain messages transaction', data);
    try {
        // Update off-chain message entries in local database with info about settlement tx
        Catenis.db.collection.Message.update({
            'offChain.msgEnvCid': {
                $in: data.offChainMsgDataCids
            }
        }, {
            $set: {
                blockchain: {
                    txid: data.txid,
                    confirmed: false
                }
            }
        }, {multi: true});

        const settleOCMsgsTransact = data.transact || SettleOffChainMessagesTransaction.checkTransaction(Transaction.fromTxid(data.txid));

        // Record settle off-chain messages transaction for billing
        Billing.recordSettleOffChainMsgsTransaction(settleOCMsgsTransact);
    }
    catch (err) {
        // Error while processing received settle off-chain messages transaction. Log error condition
        Catenis.logger.ERROR('Error while processing received settle off-chain messages transaction (txid: %s).', data.txid, err);
    }
}

// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(OffChainMessagesSettlement);
