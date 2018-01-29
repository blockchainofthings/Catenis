/**
 * Created by claudio on 27/1/17.
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
// noinspection JSFileReferences
import BigNumber from 'bignumber.js';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { CatenisNode } from './CatenisNode';
import { TransactionMonitor } from './TransactionMonitor';
import { FundSource } from './FundSource';
import { BcotPaymentTransaction } from './BcotPaymentTransaction';
import { CreditServiceAccTransaction } from './CreditServiceAccTransaction';
import { StoreBcotTransaction } from './StoreBcotTransaction';
import { Client } from './Client';

// Config entries
const bcotPayConfig = config.get('bcotPayment');

// Configuration settings
const cfgSettings = {
    bcotOmniPropertyId: bcotPayConfig.get('bcotOmniPropertyId'),
    storeBcotAddress: bcotPayConfig.get('storeBcotAddress'),
    usageReportHeaders: bcotPayConfig.get('usageReportHeaders')
};

const bcotTokenDivisibility = 8;


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

BcotPayment.bcotToServiceCredit = function (bcotAmount) {
    return new BigNumber(bcotAmount).dividedToIntegerBy(Math.pow(10, (bcotTokenDivisibility - CatenisNode.serviceCreditAssetDivisibility))).toNumber();
};

BcotPayment.encryptSentFromAddress = function (payingAddress, bcotPayAddrInfo) {
    return bcotPayAddrInfo.cryptoKeys.encryptData(bcotPayAddrInfo.cryptoKeys, Buffer.from(payingAddress)).toString('base64');
};

BcotPayment.decryptSentFromAddress = function (encSentFromAddress, bcotPayAddrInfo) {
    return bcotPayAddrInfo.cryptoKeys.decryptData(bcotPayAddrInfo.cryptoKeys, Buffer.from(encSentFromAddress, 'base64')).toString();
};

// Returns a CSV-formatted text document containing a list of BCOT payments within a given time frame
//
//  Arguments:
//   startDate: [Object(Date)] - Only BCOT payment transactions received on or after this date and time should be included
//   endDate: [Object(Date)] - Only BCOT payment transaction receive BEFORE this date should be included
//   addHeaders: [Boolean] - Indicates whether generated report should include a line with column headers as its first line
BcotPayment.generateBcotPaymentReport = function (startDate, endDate, addHeaders = false) {
    const filter = {
        type: 'bcot_payment'
    };

    const andOperands = [];

    if (startDate) {
        andOperands.push({
            receivedDate: {
                $gte: startDate
            }
        });
    }

    if (endDate) {
        andOperands.push({
            receivedDate: {
                $lt: endDate
            }
        });
    }

    if (andOperands.length > 0) {
        filter.$and = andOperands;
    }

    const reportLines = Catenis.db.collection.ReceivedTransaction.find(filter, {
        receivedDate: 1,
        info: 1
    }).map((doc) => {
        const bcotPayAddrInfo = Catenis.keyStore.getAddressInfoByPath(doc.info.bcotPayment.bcotPayAddressPath, true, false);

        return util.format('"%s","%s","%s"\n',
            BcotPayment.decryptSentFromAddress(doc.info.bcotPayment.encSentFromAddress, bcotPayAddrInfo),
            doc.info.bcotPayment.paidAmount,
            doc.receivedDate.toISOString());
    });

    if (addHeaders && reportLines.length > 0) {
        reportLines.unshift(cfgSettings.usageReportHeaders.map(header => '"' + header + '"').join(',') + '\n');
    }

    return reportLines.join('');
};


// BcotPayment function class (public) properties
//

BcotPayment.bcotOmniPropertyId = cfgSettings.bcotOmniPropertyId;

BcotPayment.storeBcotAddress = cfgSettings.storeBcotAddress;


// Definition of module (private) functions
//

function bcotPaymentConfirmed(data) {
    Catenis.logger.TRACE('Received notification of confirmation of BCOT payment transaction', data);
    try {
        // Get BCOT payment transaction
        const bcotPayTransact = BcotPaymentTransaction.checkTransaction(data.txid);

        // Execute code in critical section to avoid UTXOs concurrency
        FundSource.utxoCS.execute(() => {
            // Credit client's service account
            const convertedPaidAmount = BcotPayment.bcotToServiceCredit(bcotPayTransact.paidAmount);
            let amountToCredit = convertedPaidAmount;
            let limitTransferOutputs = false;
            let ccMetadata = undefined;

            do {
                let credServAccTransact;
                let credServAccTxid;

                try {
                    // Prepare transaction to credit client's service account
                    credServAccTransact = new CreditServiceAccTransaction(bcotPayTransact, amountToCredit, limitTransferOutputs);

                    // Try to reuse previously created Colored Coins metadata
                    credServAccTransact.setCcMetadata(ccMetadata);

                    // Build transaction
                    credServAccTransact.buildTransaction();

                    if (credServAccTransact.issuingAmount > 0) {
                        // Send transaction
                        credServAccTxid = credServAccTransact.sendTransaction();

                        // Force polling of blockchain so newly sent transaction is received and processed right away
                        Catenis.txMonitor.pollNow();

                        amountToCredit -= credServAccTransact.issuingAmount;
                        limitTransferOutputs = false;
                    }
                    else {
                        // Amount to credit too small to be exchanged for Catenis service credits
                        if (amountToCredit === convertedPaidAmount) {
                            // BCOT token amount received too small.
                            //  Log warning condition
                            Catenis.logger.WARN('BCOT token amount received too small to be exchanged for Catenis service credits', {
                                receivedAmount: bcotPayTransact.paidAmount
                            });
                        }

                        // Revert output addresses added to transaction, and reset amount to credit
                        credServAccTransact.revertOutputAddresses();
                        amountToCredit = 0;
                    }
                }
                catch (err) {
                    if (credServAccTransact && !credServAccTxid) {
                        // Revert output addresses added to transaction
                        credServAccTransact.revertOutputAddresses();
                    }

                    if ((err instanceof Meteor.Error) && err.error === 'ctn_cctx_ccdata_too_large' && !limitTransferOutputs) {
                        // Encoded Colored Coins data too large, possibly due too large an amount to issue/transfer.
                        //  So, try to limit transfer outputs
                        limitTransferOutputs = true;

                        // Save Colored Coins metadata to be reused
                        ccMetadata = credServAccTransact.getCcMetadata();
                    }
                    else {
                        // Error crediting client's service account.
                        //  Log error condition
                        Catenis.logger.ERROR('Error crediting client\'s (clientId: %s) credit account.', bcotPayTransact.client, err);

                        // Rethrows exception
                        throw err;
                    }
                }
            }
            while (amountToCredit > 0);
            
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
