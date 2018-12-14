/**
 * Created by Claudio on 2018-12-13.
 */

//console.log('[BcotSaleStockUI.js]: This code just ran.');

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
import { Roles } from 'meteor/alanning:roles';

// References code in other (Catenis) modules
import { Catenis } from '../Catenis';
import { BcotSaleStock } from '../BcotSaleStock';
import { Transaction } from '../Transaction';
import { Util } from '../Util';


// Definition of function classes
//

// BcotSaleStockUI function class
export function BcotSaleStockUI() {
}


// Public BcotSaleStockUI object methods
//

/*BcotSaleStockUI.prototype.pub_func = function () {
 };*/


// Module functions used to simulate private BcotSaleStockUI object methods
//  NOTE: these functions need to be bound to a BcotSaleStockUI object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
 }*/


// BcotSaleStockUI function class (public) methods
//

BcotSaleStockUI.initialize = function () {
    Catenis.logger.TRACE('BcotSaleStockUI initialization');
    // Declaration of RPC methods to be called from client
    Meteor.methods({
        getBcotSaleStockAddress: function () {
            if (Roles.userIsInRole(this.userId, 'sys-admin')) {
                return Catenis.ctnHubNode.getBcotSaleStockAddress();
            }
            else {
                // User not logged in or not a system administrator.
                //  Throw exception
                throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
            }
        },
    });

    // Declaration of publications
    Meteor.publish('bcotSaleStockBalance', function () {
        if (Roles.userIsInRole(this.userId, 'sys-admin')) {
            const processBcotSaleStockInfoChange = (data) => {
                // Get and pass updated BCOT sale stock info
                this.changed('BcotSaleStockInfo', 1, {
                    currentBalance: Util.formatCoins(data.bcotSaleStockInfo.currentBalance),
                    minimumBalance: Util.formatCoins(data.bcotSaleStockInfo.minimumBalance)
                });
            };

            // Prepare to receive notification of funding balance info change
            Catenis.bcotSaleStock.on(BcotSaleStock.notifyEvent.bcot_sale_stock_info_changed.name, processBcotSaleStockInfoChange);

            // Get and pass current BCOT sale stock info
            this.added('BcotSaleStockInfo', 1, {
                currentBalance: Util.formatCoins(Catenis.bcotSaleStock.bcotSaleStockInfo.currentBalance),
                minimumBalance: Util.formatCoins(Catenis.bcotSaleStock.bcotSaleStockInfo.minimumBalance)
            });
            this.ready();

            this.onStop(() => Catenis.bcotSaleStock.removeListener(BcotSaleStock.notifyEvent.bcot_sale_stock_info_changed.name, processBcotSaleStockInfoChange));
        }
        else {
            // User not logged in or not a system administrator
            //  Make sure that publication is not started and throw exception
            this.stop();
            throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
        }
    });

    Meteor.publish('bcotSaleStockReplenishment', function () {
        if (Roles.userIsInRole(this.userId, 'sys-admin')) {
            const receivedAmount = {
                unconfirmed: 0,
                confirmed: 0
            };
            let initializing = true;

            const dbInfoEntryName = Transaction.type.bcot_replenishment.dbInfoEntryName;

            const observeHandle = Catenis.db.collection.ReceivedTransaction.find({
                type: Transaction.type.bcot_replenishment.name,
                receivedDate: {
                    $gte: new Date()
                }
            }, {
                fields: {
                    'confirmation.confirmed': 1,
                    info: 1
                }
            }).observe({
                added: (doc) => {
                    // Update received amount
                    const changed = {};

                    if (!doc.confirmation.confirmed) {
                        receivedAmount.unconfirmed += doc.info[dbInfoEntryName].replenishedAmount;
                        changed.unconfirmed = Util.formatCoins(receivedAmount.unconfirmed);
                    }
                    else if (doc.info[dbInfoEntryName].omniTxValidity && doc.info[dbInfoEntryName].omniTxValidity.isValid) {
                        receivedAmount.confirmed += doc.info[dbInfoEntryName].replenishedAmount;
                        changed.confirmed = Util.formatCoins(receivedAmount.confirmed);
                    }

                    if (!initializing && Object.values(changed).length > 0) {
                        this.changed('BcotSaleStockReplenishedAmount', 1, changed);
                    }
                },

                changed: (newDoc, oldDoc) => {
                    // Make sure that transaction is being confirmed
                    if (newDoc.confirmation.confirmed && !oldDoc.confirmation.confirmed) {
                        // Update unconfirmed received amount.
                        //  NOTE: only adjust unconfirmed amount for now. Confirmed amount shall be adjusted once
                        //      Omni tx validity is updated
                        receivedAmount.unconfirmed -= newDoc.info[dbInfoEntryName].replenishedAmount;

                        if (receivedAmount.unconfirmed < 0) {
                            receivedAmount.unconfirmed = 0;
                        }

                        this.changed('BcotSaleStockReplenishedAmount', 1, {
                            unconfirmed: Util.formatCoins(receivedAmount.unconfirmed)
                        });
                    }

                    // Check if Omni tx validity is being set
                    if (newDoc.info[dbInfoEntryName].omniTxValidity && !oldDoc.info[dbInfoEntryName].omniTxValidity
                        && newDoc.info[dbInfoEntryName].omniTxValidity.isValid) {
                        // Update confirmed received amount
                        receivedAmount.confirmed += newDoc.info[dbInfoEntryName].replenishedAmount;

                        this.changed('BcotSaleStockReplenishedAmount', 1, {
                            confirmed: Util.formatCoins(receivedAmount.confirmed)
                        });
                    }
                }
            });

            initializing = false;

            this.added('BcotSaleStockReplenishedAmount', 1, {
                unconfirmed: Util.formatCoins(receivedAmount.unconfirmed),
                confirmed: Util.formatCoins(receivedAmount.confirmed)
            });

            this.onStop(() => observeHandle.stop());

            this.ready();
        }
        else {
            // User not logged in or not a system administrator
            //  Make sure that publication is not started and throw exception
            this.stop();
            throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
        }
    });
};


// BcotSaleStockUI function class (public) properties
//

/*BcotSaleStockUI.prop = {};*/


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(BcotSaleStockUI);
