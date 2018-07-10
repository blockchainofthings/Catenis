/**
 * Created by Claudio on 2017-12-09.
 */

//console.log('[Billing.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import util from 'util';
// Third-party node modules
//import config from 'config';
import BigNumber from 'bignumber.js';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { Service } from './Service';
import { LogMessageTransaction } from './LogMessageTransaction';
import { SendMessageTransaction } from './SendMessageTransaction';
import { Device } from './Device';
import { SpendServiceCreditTransaction } from './SpendServiceCreditTransaction';
import { IssueAssetTransaction } from './IssueAssetTransaction';
import { TransferAssetTransaction } from './TransferAssetTransaction';

// Config entries
/*const config_entryConfig = config.get('config_entry');

// Configuration settings
const cfgSettings = {
    property: config_entryConfig.get('property_name')
};*/


// Definition of function classes
//

// Billing function class
//
// Constructor arguments:
//    docBilling: [Object] - Billing database doc/rec
//
export function Billing(docBilling) {
    this.doc_id = docBilling._id;

    this.type = docBilling.type;
    this.clientId = docBilling.clientId;
    this.deviceId = docBilling.deviceId;
    this.billingMode = docBilling.billingMode;
    this.service = docBilling.service;
    this.serviceDate = docBilling.serviceDate;

    // serviceTx: {
    //   txid: [string],
    //   fee: [number]
    //   complementaryTx: {
    //     txid: [string],
    //     fee: [number],
    //     feeShare: [number]
    //   }
    // }
    this.serviceTx = docBilling.serviceTx;

    this.estimatedServiceCost = docBilling.estimatedServiceCost;
    this.priceMarkup = docBilling.priceMarkup;
    this.exchangeRate = docBilling.exchangeRate;
    this.finalServicePrice = docBilling.finalServicePrice;

    // servicePaymentTx: {
    //   txid: [string],
    //   confirmed: [boolean],
    //   fee: [number],
    //   feeShare: [number]
    // }
    this.servicePaymentTx = docBilling.servicePaymentTx;

    this.createdDate = docBilling.createdDate;
}


// Public Billing object methods
//

Billing.prototype.isOriginal = function () {
    return this.type === Billing.docType.original.name;
};

Billing.prototype.isComplementary = function () {
    return this.type === Billing.docType.complementary.name;
};

// NOTE: assume that service payment transaction is not yet confirmed
Billing.prototype.setServicePaymentTransaction = function (servicePayTransaction) {
    // Make sure that it is a valid service transaction
    if (!(servicePayTransaction instanceof SpendServiceCreditTransaction) || servicePayTransaction.lastSentCcTransact === undefined) {
        // Log error condition and throw exception
        Catenis.logger.ERROR('Billing.recordServicePaymentTransaction method called with invalid service transaction', {
            serviceTransaction: servicePayTransaction
        });
        throw new Error('Billing.recordServicePaymentTransaction method called with invalid service transaction');
    }

    if (this.servicePaymentTx === undefined) {
        this.servicePaymentTx = {
            txid: servicePayTransaction.lastSentCcTransact.txid,
            confirmed: false
        };

        try {
            // Update billing doc/rec
            Catenis.db.collection.Billing.update({
                _id: this.doc_id
            }, {
                $set: {
                    servicePaymentTx: this.servicePaymentTx
                }
            });
        }
        catch (err) {
            // Error updating billing doc/rec to set service payment transaction.
            //  Log error condition and throw exception
            Catenis.logger.ERROR('Error trying to update billing doc/rec (doc_id: %s) to set service payment transaction', this.doc_id);
            throw new Meteor.Error(util.format('ctn_billing_update_error', 'Error trying to update billing doc/rec (doc_id: %s) to set service payment transaction', this.doc_id));
        }
    }
    else {
        // Service payment transaction is already set for billing entry.
        //  Log warning condition
        Catenis.logger.WARN('Service payment transaction is already set for billing entry', {
            billing: this
        });
    }
};

// Module functions used to simulate private Billing object methods
//  NOTE: these functions need to be bound to a Billing object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// Billing function class (public) methods
//

Billing.createNew = function (device, serviceTransact, servicePriceInfo, servicePaymentTransact) {
    const docBilling = {
        type: Billing.docType.original.name,
        clientId: device.client.clientId,
        deviceId: device.deviceId,
        billingMode: device.client.billingMode,
    };

    // Determine service type
    if (serviceTransact instanceof LogMessageTransaction) {
        docBilling.service = Service.clientPaidService.log_message.name;
    }
    else if (serviceTransact instanceof SendMessageTransaction) {
        docBilling.service = serviceTransact.options.readConfirmation ? Service.clientPaidService.send_msg_read_confirm.name
                : Service.clientPaidService.send_message.name;
    }
    else if (serviceTransact instanceof IssueAssetTransaction) {
        docBilling.service = Service.clientPaidService.issue_asset.name;
    }
    else if (serviceTransact instanceof TransferAssetTransaction) {
        docBilling.service = Service.clientPaidService.transfer_asset.name;
    }
    else {
        // Not specified or unknown service for billing.
        //  Log error and throw exception
        Catenis.logger.ERROR('Not specified or unknown service for billing', {
            serviceTransact: serviceTransact
        });
        throw new Meteor.Error('ctn_billing_no_service', 'Not specified or unknown service for billing');
    }

    // Make sure that service transaction has already been sent
    if (serviceTransact.txid === undefined) {
        // Log error condition and throw exception
        Catenis.logger.ERROR('Service transaction for billing has not been sent yet');
        throw new Meteor.Error('ctn_billing_tx_not_sent', 'Service transaction for billing has not been sent yet');
    }

    docBilling.serviceDate = serviceTransact.innerTransact.sentDate;

    docBilling.serviceTx = {
        txid: serviceTransact.txid,
        fee: serviceTransact.innerTransact.feeAmount()
    };

    // Make sure service price info has been given
    if (typeof servicePriceInfo !== 'object' || serviceTransact === null) {
        // Log error condition and throw exception
        Catenis.logger.ERROR('No service price info for billing');
        throw new Meteor.Error('ctn_billing_no_price', 'No service price info for billing');
    }

    docBilling.estimatedServiceCost = servicePriceInfo.estimatedServiceCost;
    docBilling.priceMarkup = servicePriceInfo.priceMarkup;
    docBilling.bitcoinPrice = servicePriceInfo.bitcoinPrice;
    docBilling.bcotPrice = servicePriceInfo.bcotPrice;
    docBilling.exchangeRate = servicePriceInfo.exchangeRate;
    docBilling.finalServicePrice = servicePriceInfo.finalServicePrice;

    if (servicePaymentTransact !== undefined) {
        docBilling.servicePaymentTx = {
            txid: servicePaymentTransact.ccTransact.txid,
            confirmed: false
        }
    }

    docBilling.createdDate = new Date();

    try {
        docBilling._id = Catenis.db.collection.Billing.insert(docBilling);
    }
    catch (err) {
        // Error trying to insert Billing doc/rec.
        //  Log error and throw exception
        Catenis.logger.ERROR('Error trying to insert new Billing doc/rec (%s).', util.inspect(docBilling, {depth: null}), err);
        throw new Meteor.Error('ctn_billing_insert_error', util.format('Error trying to insert new billing doc/rec (%s)', util.inspect(docBilling, {depth: null})), err.stack);
    }

    return new Billing(docBilling);
};

Billing.getBillingByServiceTxid = function (serviceTxid) {
    const docBilling = Catenis.db.collection.Billing.findOne({'serviceTx.txid': serviceTxid});

    if (!docBilling) {
        // No billing record available for the given service transaction.
        //  Log error and throw exception
        Catenis.logger.ERROR('Could not find billing record for the given service transaction', {serviceTxid: serviceTxid});
        throw new Meteor.Error('ctn_billing_not_found', util.format('Could not find billing record for the given service transaction (txid: %s)', serviceTxid));
    }

    return new Billing(docBilling);
};

// NOTE: this method should be called once a read confirmation transaction is confirmed
Billing.recordComplementaryReadConfirmTx = function (transact) {
    try {
        // Identifies send message (with read confirmation) transactions that had been read confirmed
        const sendMsgReadConfirmTxids = Catenis.db.collection.ReceivedTransaction.find({
            txid: transact.txid
        }, {
            info: 1
        }).fetch().reduce((list, doc) => {
            return list.concat(doc.info.readConfirmation.spentReadConfirmTxOuts.map((txOut) => txOut.txid));
        }, []);

        const complementaryTxFee = transact.feeAmount();
        const complementaryTxInfo = {
            txid: transact.txid,
            fee: complementaryTxFee,
            feeShare: new BigNumber(complementaryTxFee).dividedBy(sendMsgReadConfirmTxids.length).decimalPlaces(0, BigNumber.ROUND_HALF_EVEN).toNumber()
        };

        const txidServiceTxsToComplement = new Set();
        const docIdServiceTxsToComplement = [];

        Catenis.db.collection.Billing.find({
            'serviceTx.txid': {
                $in: sendMsgReadConfirmTxids
            }
        }, {
            fields: {
                _id: 1,
                'serviceTx.txid': 1
            }
        }).forEach((doc) => {
            txidServiceTxsToComplement.add(doc.serviceTx.txid);
            docIdServiceTxsToComplement.push(doc._id);
        });

        if (docIdServiceTxsToComplement.length > 0) {
            Catenis.db.collection.Billing.update({
                _id: {
                    $in: docIdServiceTxsToComplement
                }
            }, {
                $set: {
                    'serviceTx.complementaryTx': complementaryTxInfo
                }
            }, {
                multi: true
            });
        }

        if (sendMsgReadConfirmTxids.length > txidServiceTxsToComplement.size) {
            // There are send message transactions for which a billing doc/rec does yet exist.
            //  This means that this send message has not been sent by this Catenis node. So prepare to
            //  create complementary billing docs/recs to record the read confirmation cost of those messages
            const txidSendMsgTxsToCreateComplementaryBillingDoc = [];

            sendMsgReadConfirmTxids.forEach((sendMsgTxid) => {
                if (!txidServiceTxsToComplement.has(sendMsgTxid)) {
                    txidSendMsgTxsToCreateComplementaryBillingDoc.push(sendMsgTxid);
                }
            });

            Catenis.db.collection.ReceivedTransaction.find({
                txid: {
                    $in: txidSendMsgTxsToCreateComplementaryBillingDoc
                }
            }, {
                txid: 1,
                info: 1
            }).forEach((doc) => {
                createNewComplementaryBillingDoc(doc.info.sendMessage.originDeviceId, Service.clientPaidService.send_msg_read_confirm, doc.txid, complementaryTxInfo);
            })
        }
    }
    catch (err) {
        // Error recording complementary read confirmation transaction.
        //  Log error condition
        Catenis.logger.ERROR('Error recording complementary read confirmation transaction (txid: %s) in billing doc/rec.', transact.txid, err);
    }
};

// NOTE: this method should be called once a spend service credit (or debit service account) transaction is confirmed
Billing.recordServicePaymentTransaction = function (servicePayTransaction) {
    try {
        // Make sure that it is a valid service transaction
        if (!(servicePayTransaction instanceof SpendServiceCreditTransaction) || servicePayTransaction.lastSentCcTransact === undefined) {
            // Log error condition and throw exception
            Catenis.logger.ERROR('Billing.recordServicePaymentTransaction method called with invalid service transaction', {
                serviceTransaction: servicePayTransaction
            });
            // noinspection ExceptionCaughtLocallyJS
            throw new Error('Billing.recordServicePaymentTransaction method called with invalid service transaction');
        }

        const feeInfo = servicePayTransaction.getFeeInfo();
        const servicePayTxInfo = {
            txid: servicePayTransaction.lastSentCcTransact.txid,
            confirmed: true,
            fee: feeInfo.fee,
            feeShare: feeInfo.feeShare
        };

        // Update billing docs/recs associated with service transactions paid by this service payment transaction
        //  setting service payment transaction info
        const numBillingDocsUpdated = Catenis.db.collection.Billing.update({
            'serviceTx.txid': {
                $in: servicePayTransaction.serviceTxids
            }
        }, {
            $set: {
                servicePaymentTx: servicePayTxInfo
            }
        }, {
            multi: true
        });

        if (numBillingDocsUpdated === 0) {
            // No billing docs/recs found associated with service transactions paid by service payment transaction
            //  Log error condition and throw exception
            Catenis.logger.ERROR('No billing docs/recs found associated with service transactions paid by service payment transaction', {
                servicePaymentTransact: servicePayTransaction
            });
            // noinspection ExceptionCaughtLocallyJS
            throw new Error('No billing docs/recs found associated with service transactions paid by service payment transaction');
        }
    }
    catch (err) {
        // Error recording service payment transaction.
        //  Log error condition
        Catenis.logger.ERROR('Error recording service payment transaction (txid: %s) in billing doc/rec.', servicePayTransaction.lastSentCcTransact.txid, err);
    }
};


// Billing function class (public) properties
//

Billing.docType = Object.freeze({
    original: Object.freeze({
        name: 'original',
        description: 'Billing doc/rec created at the Catenis node that contains the device that consumed the service when service is consumed'
    }),
    complementary: Object.freeze({
        name: 'complementary',
        description: 'Billing doc/rec created at a different Catenis node than the one that contains the device that consumed the service exclusively to register the cost of the complementary (read confirmation) transaction when the complementary (read confirmation) transaction is confirmed'
    })
});


// Definition of module (private) functions
//

function createNewComplementaryBillingDoc(deviceId, service, serviceTxid, complementaryTxInfo) {
    const device = Device.getDeviceByDeviceId(deviceId, true);

    Catenis.db.collection.Billing.insert({
        type: Billing.docType.complementary.name,
        clientId: device.client.clientId,
        deviceId: device.deviceId,
        billingMode: device.client.billingMode,
        service: service,
        serviceTx: {
            txid: serviceTxid,
            complementaryTx: complementaryTxInfo
        }
    });
}


// Module code
//

// Lock function class
Object.freeze(Billing);
