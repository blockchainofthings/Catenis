/**
 * Created by claudio on 2018-10-30.
 */

//console.log('[StoreBcot.js]: This code just ran.');

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
import { StoreBcotTransaction } from './StoreBcotTransaction';

// Config entries
/*const config_entryConfig = config.get('config_entry');

// Configuration settings
const cfgSettings = {
    property: config_entryConfig.get('property_name')
};*/


// Definition of function classes
//

// StoreBcot function class
export function StoreBcot() {
}


// Public StoreBcot object methods
//

/*StoreBcot.prototype.pub_func = function () {
};*/


// Module functions used to simulate private StoreBcot object methods
//  NOTE: these functions need to be bound to a StoreBcot object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// StoreBcot function class (public) methods
//

StoreBcot.initialize = function () {
    Catenis.logger.TRACE('StoreBcot initialization');
    // Set up handler to process event indicating that store BCOT tx has been confirmed
    TransactionMonitor.addEventHandler(TransactionMonitor.notifyEvent.store_bcot_tx_conf.name, storeBcotConfirmed);
};


// StoreBcot function class (public) properties
//

/*StoreBcot.prop = {};*/


// Definition of module (private) functions
//

function storeBcotConfirmed(data) {
    Catenis.logger.TRACE('Received notification of confirmation of store BCOT transaction', data);
    try {
        // Get store BCOT transaction
        const storeBcotTransact = StoreBcotTransaction.checkTransaction(OmniTransaction.fromTransaction(Transaction.fromTxid(data.txid)));

        // Check validity of Omni transaction
        if (storeBcotTransact.omniTransact.validated) {
            const omniTxValidity = {
                isValid: storeBcotTransact.omniTransact.isValid
            };

            if (!omniTxValidity.isValid) {
                omniTxValidity.invalidReason = storeBcotTransact.omniTransact.invalidReason;
            }

            // Update Omni tx validity info onto corresponding SentTransaction database doc/rec
            const setExpression = {};
            setExpression[`info.${Transaction.type.store_bcot.dbInfoEntryName}.omniTxValidity`] = omniTxValidity;

            try {
                Catenis.db.collection.SentTransaction.update({
                    txid: data.txid
                }, {
                    $set: setExpression
                });
            }
            catch (err) {
                // Log error
                Catenis.logger.ERROR('Error updating store BCOT transaction (txid: %s) SentTransaction database doc/rec to set Omni tx validity info', data.txid, err);
            }

            if (!omniTxValidity.isValid) {
                // Omni tx not valid. Log error condition
                Catenis.logger.ERROR('Failure to store BCOT tokens.', util.format('Confirmed store BCOT transaction (txid: %s) is not a valid Omni transaction', data.txid), {
                    invalidReason: omniTxValidity.invalidReason
                });
            }
        }
        else {
            // Omni transaction not validated. Log error and abort processing
            Catenis.logger.ERROR('Confirmed store BCOT transaction (txid: %s) has no indication whether it is a valid Omni transaction or not; aborting tx confirmation processing', data.txid);
        }
    }
    catch (err) {
        // Error while processing notification of confirmed store BCOT transaction.
        //  Just log error condition
        Catenis.logger.ERROR('Error while processing notification of confirmed store BCOT transaction.', err);
    }
}


// Module code
//

// Lock function class
Object.freeze(StoreBcot);
