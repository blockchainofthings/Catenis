/**
 * Created by claudio on 2018-11-02.
 */

//console.log('[BcotSaleStock.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import util from 'util';
import events from 'events';
// Third-party node modules
import BigNumber from 'bignumber.js';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { Util } from './Util';
import { BcotToken } from './BcotToken';
import { BcotSaleAllocation } from './BcotSaleAllocation';
import { Transaction } from './Transaction';

// Config entries
/*const config_entryConfig = config.get('config_entry');

// Configuration settings
const cfgSettings = {
    property: config_entryConfig.get('property_name')
};*/


// Definition of function classes
//

// BcotSaleStock class
export class BcotSaleStock extends events.EventEmitter {
    constructor() {
        super();

        this.bcotSaleStockInfo = {
            currentBalance: new BigNumber(0),
            minimumBalance: new BigNumber(0),
            hasLowBalance() {
                return this.currentBalance.isLessThan(this.minimumBalance);
            }
        }
    }
}


// Public BcotSaleStock object methods
//

BcotSaleStock.prototype.checkBcotSaleStock = function () {
    if (updateBcotSaleStockInfo.call(this)) {
        if (this.bcotSaleStockInfo.hasLowBalance()) {
            // Stock of BCOT tokens for sale too low. Send notification to replenish stock of BCOT tokens
            Catenis.logger.ACTION('Stock of BCOT tokens for sale too low.', util.format('\nCurrent balance: %s, expected minimum balance: %s\n\nACTION REQUIRED: please replenish stock of BCOT tokens immediately.',
                Util.formatCoins(this.bcotSaleStockInfo.currentBalance), Util.formatCoins(this.bcotSaleStockInfo.minimumBalance)));
        }

        // Emit event notifying that BCOT token sale stock info has changed
        this.emit(BcotSaleStock.notifyEvent.bcot_sale_stock_info_changed.name, {
            bcotSaleStockInfo: BcotSaleStock.bcotSaleStockInfo
        });
    }
};

BcotSaleStock.prototype.balance = function () {
    return confirmedBalance().minus(unconfirmedBalance());
};


// Module functions used to simulate private BcotSaleStock object methods
//  NOTE: these functions need to be bound to a BcotSaleStock object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

// NOTE: make sure that this method is called from code executed from the FundSource.utxoCS
//  critical section object
function updateBcotSaleStockInfo() {
    let hasChanged = false;

    // Get current BCOT token balance associated with system BCOT token sale stock address
    const currBcotSaleStockInfo = {
        currentBalance: this.balance(),
        minimumBalance: BcotSaleAllocation.getUnredeemedAllocatedBcotAmount()
    };

    if (!this.bcotSaleStockInfo.currentBalance.isEqualTo(currBcotSaleStockInfo.currentBalance)
            || this.bcotSaleStockInfo.minimumBalance.isEqualTo(currBcotSaleStockInfo.minimumBalance)) {
        this.bcotSaleStockInfo.currentBalance = currBcotSaleStockInfo.currentBalance;
        this.bcotSaleStockInfo.minimumBalance = currBcotSaleStockInfo.minimumBalance;
        hasChanged = true;
    }

    return hasChanged;
}


// BcotSaleStock function class (public) methods
//

BcotSaleStock.initialize = function () {
    Catenis.logger.TRACE('BcotSaleStock initialization');
    Catenis.bcotSaleStock = new BcotSaleStock();
};


// BcotSaleStock function class (public) properties
//

BcotSaleStock.notifyEvent = Object.freeze({
    bcot_sale_stock_info_changed: Object.freeze({
        name: 'bcot_sale_stock_info_changed',
        description: 'BCOT token sale stock info (either the current balance or the minimum balance) has changed'
    })
});


// Definition of module (private) functions
//

function confirmedBalance() {
    return new BigNumber(Catenis.omniCore.omniGetBalance(Catenis.ctnHubNode.getBcotSaleStockAddress(), BcotToken.bcotOmniPropertyId).balance).multipliedBy(Math.pow(10, BcotToken.tokenDivisibility));
}

function unconfirmedBalance() {
    let balance = new BigNumber(0);

    Catenis.db.collection.SentTransaction.find({
        type: Transaction.type.redeem_bcot.name,
        'confirmation.confirmed': false
    }, {
        fields: {
            info: 1
        }
    }).fetch().forEach((doc) => {
        balance = balance.plus(doc.info[Transaction.type.redeem_bcot.dbInfoEntryName].redeemedAmount);
    });

    return balance;
}


// Module code
//

// Lock function class
Object.freeze(BcotSaleStock);
