/**
 * Created by claudio on 2018-10-25.
 */

//console.log('[BcotReplenishment.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
//import config from 'config';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { FundSource } from './FundSource';
import { TransactionMonitor } from './TransactionMonitor';
import { OmniTransaction } from './OmniTransaction';
import { Transaction } from './Transaction';
import { BcotReplenishmentTransaction } from './BcotReplenishmentTransaction';

// Config entries
/*const config_entryConfig = config.get('config_entry');

// Configuration settings
const cfgSettings = {
    property: config_entryConfig.get('property_name')
};*/


// Definition of function classes
//

// BcotReplenishment function class
export function BcotReplenishment() {
}


// Public BcotReplenishment object methods
//

/*BcotReplenishment.prototype.pub_func = function () {
};*/


// Module functions used to simulate private BcotReplenishment object methods
//  NOTE: these functions need to be bound to a BcotReplenishment object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// BcotReplenishment function class (public) methods
//

BcotReplenishment.initialize = function () {
    Catenis.logger.TRACE('BcotReplenishment initialization');
    // Set up handler to process event indicating that BCOT replenishment tx has been confirmed
    TransactionMonitor.addEventHandler(TransactionMonitor.notifyEvent.bcot_replenishment_tx_conf.name, bcotReplenishmentConfirmed);
};


// BcotReplenishment function class (public) properties
//

/*BcotReplenishment.prop = {};*/


// Definition of module (private) functions
//

function bcotReplenishmentConfirmed(data) {
    Catenis.logger.TRACE('Received notification of confirmation of BCOT replenishment transaction', data);
    try {
        // Get BCOT replenishment transaction
        const bcotReplenishTransact = BcotReplenishmentTransaction.checkTransaction(OmniTransaction.fromTransaction(Transaction.fromTxid(data.txid)));

        // Check validity of Omni transaction
        if (bcotReplenishTransact.omniTransact.validated) {
            const omniTxValidity = {
                isValid: bcotReplenishTransact.omniTransact.isValid
            };

            if (!omniTxValidity.isValid) {
                omniTxValidity.invalidReason = bcotReplenishTransact.omniTransact.invalidReason;
            }

            // Update Omni tx validity info onto corresponding ReceivedTransaction database doc/rec
            const setExpression = {};
            setExpression[`info.${Transaction.type.bcot_replenishment.dbInfoEntryName}.omniTxValidity`] = omniTxValidity;

            try {
                Catenis.db.collection.ReceivedTransaction.update({
                    txid: data.txid
                }, {
                    $set: setExpression
                });
            }
            catch (err) {
                // Log error
                Catenis.logger.ERROR('Error updating BCOT replenishment transaction (txid: %s) ReceivedTransaction database doc/rec to set Omni tx validity info', data.txid, err);
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
                // Omni tx not valid. Log warning condition and abort processing
                Catenis.logger.WARN('Confirmed BCOT replenishment transaction (txid: %s) is not a valid Omni transaction; aborting tx confirmation processing', data.txid, {
                    invalidReason: omniTxValidity.invalidReason
                });
            }
        }
        else {
            // Omni transaction not validated. Log error and abort processing
            Catenis.logger.ERROR('Confirmed BCOT replenishment transaction (txid: %s) has no indication whether it is a valid Omni transaction or not; aborting tx confirmation processing', data.txid);
        }
    }
    catch (err) {
        // Error while processing notification of confirmed BCOT replenishment transaction.
        //  Just log error condition
        Catenis.logger.ERROR('Error while processing notification of confirmed BCOT replenishment transaction.', err);
    }
}


// Module code
//

// Lock function class
Object.freeze(BcotReplenishment);
