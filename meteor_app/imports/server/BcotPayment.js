/**
 * Created by Claudio on 2017-01-27.
 */

//console.log('[BcotPayment.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import util from 'util';
// Third-party node modules
import config from 'config';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { TransactionMonitor } from './TransactionMonitor';
import { FundSource } from './FundSource';
import { BcotPaymentTransaction } from './BcotPaymentTransaction';
import { StoreBcotTransaction } from './StoreBcotTransaction';
import { Client } from './Client';
import { Util } from './Util';
import { Transaction } from './Transaction';
import { OmniTransaction } from './OmniTransaction';
import { ServiceAccount } from './ServiceAccount';

// Config entries
const bcotPayConfig = config.get('bcotPayment');

// Configuration settings
const cfgSettings = {
    usageReportHeaders: bcotPayConfig.get('usageReportHeaders')
};


// Definition of function classes
//

// BcotPayment function class
export function BcotPayment() {
}


// Public BcotPayment object methods
//


// Module functions used to simulate private BcotPayment object methods
//  NOTE: these functions need to be bound to a BcotPayment object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//


// BcotPayment function class (public) methods
//

BcotPayment.initialize = function () {
    Catenis.logger.TRACE('BcotPayment initialization');
    // Set up handler to process event indicating that BCOT payment tx has been confirmed
    TransactionMonitor.addEventHandler(TransactionMonitor.notifyEvent.bcot_payment_tx_conf.name, bcotPaymentConfirmed);
};

BcotPayment.encryptSentFromAddress = function (payingAddress, bcotPayAddrInfo) {
    return bcotPayAddrInfo.cryptoKeys.encryptData(Buffer.from(payingAddress)).toString('base64');
};

BcotPayment.decryptSentFromAddress = function (encSentFromAddress, bcotPayAddrInfo) {
    return bcotPayAddrInfo.cryptoKeys.decryptData(Buffer.from(encSentFromAddress, 'base64')).toString();
};

// Returns a CSV-formatted text document containing a list of BCOT payments confirmed within a given time frame
//
//  Arguments:
//   startDate: [Object(Date)] - Only BCOT payment transactions confirmed on or after this date and time should be included
//   endDate: [Object(Date)] - Only BCOT payment transaction confirmed BEFORE this date should be included
//   addHeaders: [Boolean] - Indicates whether generated report should include a line with column headers as its first line
BcotPayment.generateBcotPaymentReport = function (startDate, endDate, addHeaders = false) {
    const filter = {
        type: 'bcot_payment',
        'confirmation.confirmed': true
    };

    const andOperands = [];

    if (startDate) {
        andOperands.push({
            'confirmation.confirmationDate': {
                $gte: startDate
            }
        });
    }

    if (endDate) {
        andOperands.push({
            'confirmation.confirmationDate': {
                $lt: endDate
            }
        });
    }

    if (andOperands.length > 0) {
        filter.$and = andOperands;
    }

    const dbInfoEntryName = Transaction.type.bcot_payment.dbInfoEntryName;

    const reportLines = Catenis.db.collection.ReceivedTransaction.find(filter, {
        txid: 1,
        'confirmation.confirmationDate': 1,
        info: 1
    }).map((doc) => {
        const bcotPayAddrInfo = Catenis.keyStore.getAddressInfoByPath(doc.info[dbInfoEntryName].bcotPayAddressPath, true, false);

        return util.format('"%s","%s","%s","%s"\n',
            BcotPayment.decryptSentFromAddress(doc.info[dbInfoEntryName].encSentFromAddress, bcotPayAddrInfo),
            Util.formatCoins(doc.info[dbInfoEntryName].paidAmount, false),
            doc.txid,
            doc.confirmation.confirmationDate.toISOString());
    });

    if (addHeaders && reportLines.length > 0) {
        reportLines.unshift(cfgSettings.usageReportHeaders.map(header => '"' + header + '"').join(',') + '\n');
    }

    return reportLines.join('');
};


// BcotPayment function class (public) properties
//

/*BcotPayment.prop = {};*/


// Definition of module (private) functions
//

function bcotPaymentConfirmed(data) {
    Catenis.logger.TRACE('Received notification of confirmation of BCOT payment transaction', data);
    try {
        // Get BCOT payment transaction
        const bcotPayTransact = BcotPaymentTransaction.checkTransaction(OmniTransaction.fromTransaction(Transaction.fromTxid(data.txid)));

        // Check validity of Omni transaction
        if (bcotPayTransact.omniTransact.validated) {
            const omniTxValidity = {
                isValid: bcotPayTransact.omniTransact.isValid
            };

            if (!omniTxValidity.isValid) {
                omniTxValidity.invalidReason = bcotPayTransact.omniTransact.invalidReason;
            }

            // Update Omni tx validity info onto corresponding ReceivedTransaction database doc/rec
            const setExpression = {};
            setExpression[`info.${Transaction.type.bcot_payment.dbInfoEntryName}.omniTxValidity`] = omniTxValidity;

            try {
                Catenis.db.collection.ReceivedTransaction.update({
                    txid: data.txid
                }, {
                    $set: setExpression
                });
            }
            catch (err) {
                // Log error
                Catenis.logger.ERROR('Error updating BCOT payment transaction (txid: %s) ReceivedTransaction database doc/rec to set Omni tx validity info', data.txid, err);
            }

            // Now, only do any processing if Omni transaction is valid
            if (omniTxValidity.isValid) {
                // Execute code in critical section to avoid UTXOs concurrency
                FundSource.utxoCS.execute(() => {
                    // Credit client's service account
                    ServiceAccount.CreditServiceAccount(bcotPayTransact);

                    // Store away BCOT tokens received as payment
                    let storeBcotTransact;
                    let storeBcotTxid;

                    try {
                        // Prepare transaction to store BCOT tokens
                        storeBcotTransact = new StoreBcotTransaction(bcotPayTransact);

                        // Build and send transaction
                        storeBcotTransact.buildTransaction();

                        storeBcotTxid = storeBcotTransact.sendTransaction();
                    }
                    catch (err) {
                        // Error storing BCOT tokens
                        //  Log error condition
                        Catenis.logger.ERROR('Error storing BCOT tokens.', err);

                        if (storeBcotTransact && !storeBcotTxid) {
                            // Revert output addresses added to transaction
                            storeBcotTransact.revertOutputAddresses();
                        }

                        // Rethrows exception
                        throw err;
                    }

                    if (bcotPayTransact.client.billingMode === Client.billingMode.prePaid) {
                        // Make sure that system service payment pay tx expense addresses are properly funded
                        bcotPayTransact.client.ctnNode.checkServicePaymentPayTxExpenseFundingBalance();
                    }
                });
            }
            else {
                // Omni tx not valid. Log warning condition and abort processing
                Catenis.logger.WARN('Confirmed BCOT payment transaction (txid: %s) is not a valid Omni transaction; aborting tx confirmation processing', data.txid, {
                    invalidReason: omniTxValidity.invalidReason
                });
            }
        }
        else {
            // Omni transaction not validated. Log error and abort processing
            Catenis.logger.ERROR('Confirmed BCOT payment transaction (txid: %s) has no indication whether it is a valid Omni transaction or not; aborting tx confirmation processing', data.txid);
        }
    }
    catch (err) {
        // Error while processing notification of confirmed BCOT payment transaction.
        //  Just log error condition
        Catenis.logger.ERROR('Error while processing notification of confirmed BCOT payment transaction.', err);
    }
}


// Module code
//

// Lock function class
Object.freeze(BcotPayment);
