/**
 * Created by Claudio on 2017-11-23.
 */

//console.log('[BcotExchangeRate.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import config from 'config';
// noinspection JSFileReferences
import BigNumber from 'bignumber.js';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';

// Config entries
const bcotExchRateConfig = config.get('bcotExchangeRate');

// Configuration settings
const cfgSettings = {
    initialExchangeRate: bcotExchRateConfig.get('initialExchangeRate')
};


// Definition of function classes
//

// BcotExchangeRate function class
export function BcotExchangeRate() {
    this.latestRate = undefined;
    this.latestDate = undefined;
}


// Public BcotExchangeRate object methods
//

BcotExchangeRate.prototype.getLatestRate = function () {
    if (this.latestRate === undefined) {
        // Try to retrieve exchange rate from local database
        const docExchRate = Catenis.db.collection.BcotExchangeRate.findOne({}, {
            sort: {
                date: -1
            }
        });

        if (docExchRate !== undefined) {
            setLatestRate.call(this, docExchRate);
        }
        else {
            this.newRate(cfgSettings.initialExchangeRate);
        }
    }

    return {
        exchangeRate: this.latestRate,
        date: this.latestDate
    };
};

BcotExchangeRate.prototype.newRate = function (exchangeRate, date) {
    const now = new Date();
    const docExchRate = {
        // Make sure that exchange rate has no more than 8 decimal places
        exchangeRate: new BigNumber(exchangeRate).decimalPlaces(8, BigNumber.ROUND_DOWN).toNumber(),
        date: date !== undefined && (data instanceof Date) ? date : now,
        createdDate: now
    };

    try {
        Catenis.db.collection.BcotExchangeRate.insert(docExchRate);
    }
    catch (err) {
        // Error trying to insert new BcotExchangeRate doc/rec
        Catenis.logger.ERROR('Error trying to insert new BcotExchangeRate doc/rec.', err);
    }

    if (this.latestRate === undefined || docExchRate.date > this.latestDate) {
        // Save as latest exchange rate
        setLatestRate.call(this, docExchRate);
    }
};


// Module functions used to simulate private BcotExchangeRate object methods
//  NOTE: these functions need to be bound to a BcotExchangeRate object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

function setLatestRate(docExchRate) {
    this.latestRate = docExchRate.exchangeRate;
    this.latestDate = docExchRate.date;
}


// BcotExchangeRate function class (public) methods
//

BcotExchangeRate.initialize = function () {
    Catenis.logger.TRACE('BcotExchangeRate initialization');
    // Instantiate BcotExchangeRate object
    Catenis.bcotExchRate = new BcotExchangeRate();
};


// BcotExchangeRate function class (public) properties
//

/*BcotExchangeRate.prop = {};*/


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(BcotExchangeRate);
