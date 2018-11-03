/**
 * Created by claudio on 2018-10-11.
 */

//console.log('[CommonServiceAccountUI.js]: This code just ran.');

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
import { Catenis } from '../Catenis';
import { Util } from '../Util';
import { Transaction } from '../Transaction';

// Config entries
/*const config_entryConfig = config.get('config_entry');

// Configuration settings
const cfgSettings = {
    property: config_entryConfig.get('property_name')
};*/


// Definition of function classes
//

// CommonServiceAccountUI function class
export function CommonServiceAccountUI() {
}


// Public CommonServiceAccountUI object methods
//

/*CommonServiceAccountUI.prototype.pub_func = function () {
};*/


// Module functions used to simulate private CommonServiceAccountUI object methods
//  NOTE: these functions need to be bound to a CommonServiceAccountUI object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// CommonServiceAccountUI function class (public) methods
//

// Publication auxiliary method for retrieving service account balance for a given client
//
//  NOTE: this method should be called via the predefined function method .call() passing the context (this)
//      of the caller publication function (i.e. method.call(this, ...))
CommonServiceAccountUI.clientServiceAccountBalance = function (client) {
    const now = new Date();
    this.added('ServiceAccountBalance', 1, {
        balance: Util.formatCatenisServiceCredits(client.serviceAccountBalance())
    });

    const observeHandle = Catenis.db.collection.SentTransaction.find({
        sentDate: {
            $gte: now
        },
        $or: [{
            type: 'credit_service_account',
            'info.creditServiceAccount.clientId': client.clientId
        }, {
            type: 'spend_service_credit',
            'info.spendServiceCredit.clientIds': client.clientId
        }]
    }, {
        fields: {
            _id: 1
        }
    }).observe({
        added: (doc) => {
            // Get updated service account balance
            this.changed('ServiceAccountBalance', 1, {
                balance: Util.formatCatenisServiceCredits(client.serviceAccountBalance())
            });
        }
    });

    this.onStop(() => observeHandle.stop());

    this.ready();
};

// Publication auxiliary method for monitoring transfer of BCOT to a given address
//
//  NOTE: this method should be called via the predefined function method .call() passing the context (this)
//      of the caller publication function (i.e. method.call(this, ...))
CommonServiceAccountUI.bcotPayment = function (addrTypeAndPath) {
    const receivedAmount = {
        unconfirmed: 0,
        confirmed: 0
    };
    let initializing = true;

    const dbInfoEntryName = Transaction.type.bcot_payment.dbInfoEntryName;
    const selector = {};
    selector[`info.${dbInfoEntryName}.bcotPayAddressPath`] = addrTypeAndPath.path;

    const observeHandle = Catenis.db.collection.ReceivedTransaction.find(selector, {
        fields: {
            'confirmation.confirmed': 1,
            info: 1
        }
    }).observe({
        added: (doc) => {
            // Update received amount
            const changed = {};

            if (!doc.confirmation.confirmed) {
                receivedAmount.unconfirmed += doc.info[dbInfoEntryName].paidAmount;
                changed.unconfirmed = Util.formatCoins(receivedAmount.unconfirmed);
            }
            else if (doc.info[dbInfoEntryName].omniTxValidity && doc.info[dbInfoEntryName].omniTxValidity.isValid) {
                receivedAmount.confirmed += doc.info[dbInfoEntryName].paidAmount;
                changed.confirmed = Util.formatCoins(receivedAmount.confirmed);
            }

            if (!initializing && Object.values(changed).length > 0) {
                this.changed('ReceivedBcotAmount', 1, changed);
            }
        },

        changed: (newDoc, oldDoc) => {
            // Make sure that transaction is being confirmed
            if (newDoc.confirmation.confirmed && !oldDoc.confirmation.confirmed) {
                // Update unconfirmed received amount.
                //  NOTE: only adjust unconfirmed amount for now. Confirmed amount shall be adjusted once
                //      Omni tx validity is updated
                receivedAmount.unconfirmed -= newDoc.info[dbInfoEntryName].paidAmount;

                if (receivedAmount.unconfirmed < 0) {
                    receivedAmount.unconfirmed = 0;
                }

                this.changed('ReceivedBcotAmount', 1, {
                    unconfirmed: Util.formatCoins(receivedAmount.unconfirmed)
                });
            }

            // Check if Omni tx validity is being set
            if (newDoc.info[dbInfoEntryName].omniTxValidity && !oldDoc.info[dbInfoEntryName].omniTxValidity
                    && newDoc.info[dbInfoEntryName].omniTxValidity.isValid) {
                // Update confirmed received amount
                receivedAmount.confirmed += newDoc.info[dbInfoEntryName].paidAmount;

                this.changed('ReceivedBcotAmount', 1, {
                    confirmed: Util.formatCoins(receivedAmount.confirmed)
                });
            }
        }
    });

    initializing = false;

    this.added('ReceivedBcotAmount', 1, {
        unconfirmed: Util.formatCoins(receivedAmount.unconfirmed),
        confirmed: Util.formatCoins(receivedAmount.confirmed)
    });

    this.onStop(() => observeHandle.stop());

    this.ready();
};


// CommonServiceAccountUI function class (public) properties
//

/*CommonServiceAccountUI.prop = {};*/


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(CommonServiceAccountUI);
