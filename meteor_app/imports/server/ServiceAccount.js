/**
 * Created by claudio on 2016-05-30.
 */

//console.log('[ServiceAccount.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
//import config from 'config';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { BcotToken } from './BcotToken';
import { CreditServiceAccTransaction } from './CreditServiceAccTransaction';

// Config entries
/*const config_entryConfig = config.get('config_entry');

// Configuration settings
const cfgSettings = {
    property: config_entryConfig.get('property_name')
};*/


// Definition of function classes
//

// ServiceAccount function class
export function ServiceAccount() {
}


// Public ServiceAccount object methods
//

/*ServiceAccount.prototype.pub_func = function () {
};*/


// Module functions used to simulate private ServiceAccount object methods
//  NOTE: these functions need to be bound to a ServiceAccount object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// ServiceAccount function class (public) methods
//

// Credit client's service account with the equivalent amount in BCOT tokens
//
//  Arguments:
//    bcotTransact: [Object] - Object identifying the transaction used to add BCOT tokens to the system (in exchange for Catenis service credits).
//                              Should be one of these two types of transaction: BcotPaymentTransaction or RedeemBcotTransaction
//   
// NOTE: make sure that this method is called from code executed from the FundSource.utxoCS critical section object
ServiceAccount.CreditServiceAccount = function (bcotTransact) {
    const convertedPaidAmount = BcotToken.bcotToServiceCredit(bcotTransact.bcotAmount);
    let amountToCredit = convertedPaidAmount;
    let limitTransferOutputs = false;
    let ccMetadata = undefined;

    do {
        let credServAccTransact;
        let credServAccTxid;

        try {
            // Prepare transaction to credit client's service account
            credServAccTransact = new CreditServiceAccTransaction(bcotTransact, amountToCredit, limitTransferOutputs);

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
                        receivedAmount: bcotTransact.bcotAmount
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
                Catenis.logger.ERROR('Error crediting client\'s (clientId: %s) credit account.', bcotTransact.client, err);

                // Rethrows exception
                throw err;
            }
        }
    }
    while (amountToCredit > 0);

    // Clear low service account balance notification/dismiss date to allow for a new notification to be
    //  sent/displayed any time if needed
    bcotTransact.client.clearLowServAccBalanceNotifyEmailSentDate();
    bcotTransact.client.clearLowServAccBalanceNotifyUIDismissDate();
};


// ServiceAccount function class (public) properties
//

/*ServiceAccount.prop = {};*/


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(ServiceAccount);
