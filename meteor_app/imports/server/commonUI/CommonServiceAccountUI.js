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
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from '../Catenis';
import { Util } from '../Util';
import { Transaction } from '../Transaction';
import { Billing } from '../Billing';
import {
    Client,
    cfgSettings as clientCfgSettings
} from '../Client';

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
CommonServiceAccountUI.clientServiceAccountBalance = function (client, clientUI = false) {
    const now = new Date();
    let lastServAccBalance = client.checkServiceAccountBalance(false);
    let updatedServAccBalanceRec;
    let tmHandle;

    // Reset timeout for checking if service account balance info needs to be updated
    function resetTimeout() {
        if (tmHandle) {
            Meteor.clearTimeout(tmHandle);
            tmHandle = undefined;
        }

        if (clientCfgSettings.creditsConsumption.servAccBalanceInfoUIRefreshTimeout > 0) {
            tmHandle = Meteor.setTimeout(() => {
                tmHandle = undefined;

                // Get updated service account balance
                if (updateServiceAccountBalance()) {
                    this.changed('ServiceAccountBalance', 1, updatedServAccBalanceRec);
                }

                resetTimeout();
            }, clientCfgSettings.creditsConsumption.servAccBalanceInfoUIRefreshTimeout);
        }
    }

    function updateServiceAccountBalance() {
        const currentServAccBalance = client.checkServiceAccountBalance(false);

        // Check if info has been updated
        updatedServAccBalanceRec = {};

        if (lastServAccBalance.currentBalance.comparedTo(currentServAccBalance.currentBalance) !== 0) {
            updatedServAccBalanceRec.balance = Util.formatCatenisServiceCredits(currentServAccBalance.currentBalance);
        }

        if (lastServAccBalance.minimumBalance.comparedTo(currentServAccBalance.minimumBalance) !== 0) {
            updatedServAccBalanceRec.minBalance = Util.formatCatenisServiceCredits(currentServAccBalance.minimumBalance);
        }

        if (lastServAccBalance.isLowBalance !== currentServAccBalance.isLowBalance) {
            updatedServAccBalanceRec.isLowBalance = currentServAccBalance.isLowBalance;
        }

        if (clientUI) {
            if (lastServAccBalance.canDisplayUINotify !== currentServAccBalance.canDisplayUINotify) {
                updatedServAccBalanceRec.canDisplayUINotify = currentServAccBalance.canDisplayUINotify;
            }
        }

        lastServAccBalance = currentServAccBalance;

        return Object.keys(updatedServAccBalanceRec).length > 0;
    }

    // Initialize service account balance record
    const initRec = {
        balance: Util.formatCatenisServiceCredits(lastServAccBalance.currentBalance),
        minBalance: Util.formatCatenisServiceCredits(lastServAccBalance.minimumBalance),
        isLowBalance: lastServAccBalance.isLowBalance
    };

    if (clientUI) {
        initRec.canDisplayUINotify = lastServAccBalance.canDisplayUINotify;
    }

    resetTimeout();
    this.added('ServiceAccountBalance', 1, initRec);

    // Observe changes to current balance
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
            if (updateServiceAccountBalance()) {
                resetTimeout();
                this.changed('ServiceAccountBalance', 1, updatedServAccBalanceRec);
            }
        }
    });

    // Observe changes to minimum balance
    const observeHandle2 = Catenis.db.collection.Billing.find({
        type: Billing.docType.original.name,
        clientId: this.clientId,
        billingMode: Client.billingMode.prePaid,
        createdDate: {
            $gte: now
        }
    }, {
        fields: {
            _id: 1
        }
    }).observe({
        added: (doc) => {
            // Get updated service account balance
            if (updateServiceAccountBalance()) {
                resetTimeout();
                this.changed('ServiceAccountBalance', 1, updatedServAccBalanceRec);
            }
        }
    });

    let observeHandle3;

    if (clientUI) {
        // Observe changes to canDisplayUINotify flag
        observeHandle3 = Catenis.db.collection.Client.find({
            _id: client.doc_id,
            'lowServAccBalanceNotify.uiDismissDate': {
                $exists: true
            }
        }, {
            fields: {
                'lowServAccBalanceNotify.uiDismissDate': 1
            }
        }).observe({
            added: (doc) => {
                client.refreshLowServAccBalanceNotify();

                // Get updated service account balance
                if (updateServiceAccountBalance()) {
                    resetTimeout();
                    this.changed('ServiceAccountBalance', 1, updatedServAccBalanceRec);
                }
            },
            changed: (newDoc, oldDoc) => {
                client.refreshLowServAccBalanceNotify();

                // Get updated service account balance
                if (updateServiceAccountBalance()) {
                    resetTimeout();
                    this.changed('ServiceAccountBalance', 1, updatedServAccBalanceRec);
                }
            }
        });
    }

    this.onStop(() => {
        observeHandle.stop();
        observeHandle2.stop();

        if (observeHandle3) {
            observeHandle3.stop();
        }

        if (tmHandle) {
            Meteor.clearTimeout(tmHandle);
        }
    });

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
