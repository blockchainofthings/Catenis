/**
 * Created by claudio on 2016-07-09.
 */

//console.log('[BcotPrice.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import events from 'events';
// Third-party node modules
import BigNumber from 'bignumber.js';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';

const priceBigNumber = BigNumber.clone({
    DECIMAL_PLACES: 8,
    ROUNDING_MODE: BigNumber.ROUND_HALF_EVEN
});


// Definition of function classes
//

// BcotPrice function class
export class BcotPrice extends events.EventEmitter {
    constructor () {
        super();
    }
}


// Public BcotPrice object methods
//

BcotPrice.prototype.getCurrentBcotPrice = function () {
    return Catenis.db.collection.BcotPrice.findOne({}, {
        fields: {
            price: 1
        },
        sort: {
            createdDate: -1
        }
    }).price;
};

BcotPrice.prototype.setNewBcotPrice = function (price) {
    try {
        if (typeof price !== 'number') {
            // Invalid price
            // noinspection ExceptionCaughtLocallyJS
            throw new TypeError('Invalid price');
        }

        Catenis.db.collection.BcotPrice.insert({
            price: price,
            createdDate: new Date()
        });

        // Issue event indicating that price has been updated
        this.emit(BcotPrice.notifyEvent.new_bcot_price.name, price);
    }
    catch (err) {
        Catenis.logger.ERROR('Error setting new BCOT token price.', err);
        throw new Meteor.Error('ctn_token_price_error', 'Error setting new BCOT token price');
    }
};

// Return Bitcoin to BCOT Token (1 BTC = x BCOT) exchange rate
BcotPrice.prototype.getLatestBitcoinExchangeRate = function () {
    const btcPrice = Catenis.btcPrice.getCurrentBitcoinPrice();
    const bcotPrice = this.getCurrentBcotPrice();

    return {
        btcPrice: btcPrice,
        bcotPrice: bcotPrice,
        exchangeRate: new priceBigNumber(btcPrice).dividedBy(this.getCurrentBcotPrice()).toNumber()
    };
};


// Module functions used to simulate private BcotPrice object methods
//  NOTE: these functions need to be bound to a BcotPrice object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// BcotPrice function class (public) methods
//

BcotPrice.initialize = function () {
    Catenis.logger.TRACE('BcotPrice initialization');
    // Instantiate BcotPrice object
    Catenis.bcotPrice = new BcotPrice();
};


// BcotPrice function class (public) properties
//

BcotPrice.notifyEvent = {
    new_bcot_price: Object.freeze({
        name: 'new_bcot_price',
        description: 'A new BCOT token price has been set'
    })
};


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(BcotPrice);
