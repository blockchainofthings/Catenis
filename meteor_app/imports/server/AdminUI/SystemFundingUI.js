/**
 * Created by Claudio on 2017-05-15.
 */

//console.log('[SystemFundingUI.js]: This code just ran.');

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
import { CatenisNode } from '../CatenisNode';
import { Util } from '../Util';


// Definition of function classes
//

// SystemFundingUI function class
export function SystemFundingUI() {
}


// Public SystemFundingUI object methods
//

/*SystemFundingUI.prototype.pub_func = function () {
};*/


// Module functions used to simulate private SystemFundingUI object methods
//  NOTE: these functions need to be bound to a SystemFundingUI object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// SystemFundingUI function class (public) methods
//

SystemFundingUI.initialize = function () {
    Catenis.logger.TRACE('SystemFundingUI initialization');
    // Declaration of RPC methods to be called from client
    Meteor.methods({
        newSysFundingAddress: newSysFundingAddress
    });

    // Declaration of publications
    Meteor.publish('fundingBalance', function () {
        const processFundingBalanceChange = (data) => {
            // Get and pass updated funding balance info
            this.changed('FundingBalanceInfo', 1, {
                currentBalance: Util.formatCoins(data.fundingBalanceInfo.currentBalance),
                minimumBalance: Util.formatCoins(data.fundingBalanceInfo.minimumBalance)
            });
        };

        // Prepare to receive notification of funding balance info change
        Catenis.ctnHubNode.on(CatenisNode.notifyEvent.funding_balanced_info_changed.name, processFundingBalanceChange);

        // Get and pass current funding balance info
        this.added('FundingBalanceInfo', 1, {
            currentBalance: Util.formatCoins(Catenis.ctnHubNode.fundingBalanceInfo.currentBalance),
            minimumBalance: Util.formatCoins(Catenis.ctnHubNode.fundingBalanceInfo.minimumBalance)
        });
        this.ready();

        this.onStop(() => Catenis.ctnHubNode.removeListener(CatenisNode.notifyEvent.funding_balanced_info_changed.name, processFundingBalanceChange));
    });

    Meteor.publish('addressPayment', function (fundAddress) {
        const typeAndPath = Catenis.keyStore.getTypeAndPathByAddress(fundAddress);

        if (typeAndPath === null) {
            // Subscription made with an invalid address. Log error and throw exception
            Catenis.logger.ERROR('Subscription to method \'addressPayment\' made with an invalid address', {fundAddress: fundAddress});
            throw new Meteor.Error('sys-funding.subscribe.address-payment.invalid-param', 'Subscription to method \'addressPayment\' made with an invalid address');
        }

        const receivedAmount = {
            unconfirmed: 0,
            confirmed: 0
        };
        let initializing = true;

        const observeHandle = Catenis.db.collection.ReceivedTransaction.find({
                'info.sysFunding.fundAddresses.path': typeAndPath.path
            },
            {
                fields: {
                    'confirmation.confirmed': 1,
                    'info.sysFunding.fundAddresses': 1
                }
            }).observe({
            added: (doc) => {
                // Compute total amount paid to address
                const paidAmount = doc.info.sysFunding.fundAddresses.reduce((sum, fundAddr) => {
                    return fundAddr.path === typeAndPath.path ? sum + fundAddr.amount : sum;
                }, 0);

                if (paidAmount > 0) {
                    if (doc.confirmation.confirmed) {
                        receivedAmount.confirmed += paidAmount;
                    }
                    else {
                        receivedAmount.unconfirmed += paidAmount;
                    }

                    if (!initializing) {
                        this.changed('ReceivedAmount', 1, {
                            unconfirmed: Util.formatCoins(receivedAmount.unconfirmed),
                            confirmed: Util.formatCoins(receivedAmount.confirmed)
                        });
                    }
                }
            },

            changed: (newDoc, oldDoc) => {
                // Make sure that transaction is being confirmed
                if (newDoc.confirmation.confirmed && !oldDoc.confirmation.confirmed) {
                    // Compute total amount paid to address
                    const paidAmount = newDoc.info.sysFunding.fundAddresses.reduce((sum, fundAddr) => {
                        return fundAddr.path === typeAndPath.path ? sum + fundAddr.amount : sum;
                    }, 0);

                    if (paidAmount > 0) {
                        receivedAmount.confirmed += paidAmount;
                        receivedAmount.unconfirmed -= paidAmount;

                        if (receivedAmount.unconfirmed < 0) {
                            receivedAmount.unconfirmed = 0;
                        }

                        this.changed('ReceivedAmount', 1, {
                            unconfirmed: Util.formatCoins(receivedAmount.unconfirmed),
                            confirmed: Util.formatCoins(receivedAmount.confirmed)
                        });
                    }
                }
            }
        });

        initializing = false;

        this.added('ReceivedAmount', 1, {
            unconfirmed: Util.formatCoins(receivedAmount.unconfirmed),
            confirmed: Util.formatCoins(receivedAmount.confirmed)
        });
        this.ready();

        this.onStop(() => observeHandle.stop());
    });
};


// SystemFundingUI function class (public) properties
//

/*SystemFundingUI.prop = {};*/


// Definition of module (private) functions
//

function newSysFundingAddress() {
    return Catenis.ctnHubNode.fundingPaymentAddr.newAddressKeys().getAddress();
}


// Module code
//

// Lock function class
Object.freeze(SystemFundingUI);
