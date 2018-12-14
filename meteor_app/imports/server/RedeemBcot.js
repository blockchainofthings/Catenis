/**
 * Created by claudio on 2018-10-30.
 */

//console.log('[RedeemBcot.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import util from 'util';
// Third-party node modules
//import config from 'config';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { TransactionMonitor } from './TransactionMonitor';
import { OmniTransaction } from './OmniTransaction';
import { Transaction } from './Transaction';
import { RedeemBcotTransaction } from './RedeemBcotTransaction';
import { FundSource } from './FundSource';

// Config entries
/*const config_entryConfig = config.get('config_entry');

// Configuration settings
const cfgSettings = {
    property: config_entryConfig.get('property_name')
};*/


// Definition of function classes
//

// RedeemBcot function class
export function RedeemBcot() {
}


// Public RedeemBcot object methods
//

/*RedeemBcot.prototype.pub_func = function () {
};*/


// Module functions used to simulate private RedeemBcot object methods
//  NOTE: these functions need to be bound to a RedeemBcot object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// RedeemBcot function class (public) methods
//

RedeemBcot.initialize = function () {
    Catenis.logger.TRACE('RedeemBcot initialization');
    // Set up handler to process event indicating that redeem BCOT tx has been confirmed
    TransactionMonitor.addEventHandler(TransactionMonitor.notifyEvent.redeem_bcot_tx_conf.name, redeemBcotConfirmed);
};


// RedeemBcot function class (public) properties
//

/*RedeemBcot.prop = {};*/


// Definition of module (private) functions
//

function redeemBcotConfirmed(data) {
    Catenis.logger.TRACE('Received notification of confirmation of redeem BCOT transaction', data);
    try {
        // Get redeem BCOT transaction
        const redeemBcotTransact = RedeemBcotTransaction.checkTransaction(OmniTransaction.fromTransaction(Transaction.fromTxid(data.txid)));

        // Check validity of Omni transaction
        if (redeemBcotTransact.omniTransact.validated) {
            const omniTxValidity = {
                isValid: redeemBcotTransact.omniTransact.isValid
            };

            if (!omniTxValidity.isValid) {
                omniTxValidity.invalidReason = redeemBcotTransact.omniTransact.invalidReason;
            }

            // Update Omni tx validity info onto corresponding SentTransaction database doc/rec
            const setExpression = {};
            setExpression[`info.${Transaction.type.redeem_bcot.dbInfoEntryName}.omniTxValidity`] = omniTxValidity;

            try {
                Catenis.db.collection.SentTransaction.update({
                    txid: data.txid
                }, {
                    $set: setExpression
                });
            }
            catch (err) {
                // Log error
                Catenis.logger.ERROR('Error updating redeem BCOT transaction (txid: %s) SentTransaction database doc/rec to set Omni tx validity info', data.txid, err);
            }

            // Now, only do any processing if Omni transaction is valid
            if (omniTxValidity.isValid) {
                // Execute code in critical section to avoid UTXOs concurrency
                FundSource.utxoCS.execute(() => {
                    // Make sure that BCOT token sale stock info is updated
                    Catenis.bcotSaleStock.checkBcotSaleStock();
                });
            }
            else {
                // Omni tx not valid. Log error condition
                Catenis.logger.ERROR('Failure to redeem BCOT tokens.', util.format('Confirmed redeem BCOT transaction (txid: %s) is not a valid Omni transaction', data.txid), {
                    invalidReason: omniTxValidity.invalidReason
                });
            }
        }
        else {
            // Omni transaction not validated. Log error and abort processing
            Catenis.logger.ERROR('Confirmed redeem BCOT transaction (txid: %s) has no indication whether it is a valid Omni transaction or not; aborting tx confirmation processing', data.txid);
        }
    }
    catch (err) {
        // Error while processing notification of confirmed redeem BCOT transaction.
        //  Just log error condition
        Catenis.logger.ERROR('Error while processing notification of confirmed redeem BCOT transaction.', err);
    }
}


// Module code
//

// Lock function class
Object.freeze(RedeemBcot);
