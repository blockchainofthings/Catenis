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

    const observeHandle = Catenis.db.collection.ReceivedTransaction.find({
        'info.bcotPayment.bcotPayAddressPath': addrTypeAndPath.path
    }, {
        fields: {
            'confirmation.confirmed': 1,
            info: 1
        }
    }).observe({
        added: (doc) => {
            // Get paid amount paid to address
            if (doc.confirmation.confirmed) {
                receivedAmount.confirmed += doc.info.bcotPayment.paidAmount;
            }
            else {
                receivedAmount.unconfirmed += doc.info.bcotPayment.paidAmount;
            }

            if (!initializing) {
                this.changed('ReceivedBcotAmount', 1, {
                    unconfirmed: Util.formatCoins(receivedAmount.unconfirmed),
                    confirmed: Util.formatCoins(receivedAmount.confirmed)
                });
            }
        },

        changed: (newDoc, oldDoc) => {
            // Make sure that transaction is being confirmed
            if (newDoc.confirmation.confirmed && !oldDoc.confirmation.confirmed) {
                // Get total amount paid to address
                receivedAmount.confirmed += newDoc.info.bcotPayment.paidAmount;
                receivedAmount.unconfirmed -= newDoc.info.bcotPayment.paidAmount;

                if (receivedAmount.unconfirmed < 0) {
                    receivedAmount.unconfirmed = 0;
                }

                this.changed('ReceivedBcotAmount', 1, {
                    unconfirmed: Util.formatCoins(receivedAmount.unconfirmed),
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
