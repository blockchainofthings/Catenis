/**
 * Created by claudio on 2016-07-09.
 */

//console.log('[BitcoinPrice.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import events from 'events';
// Third-party node modules
import config from 'config';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { Util } from './Util';
import { BcotPrice } from './BcotPrice';

// Config entries
const btcPriceConfig = config.get('bitcoinPrice');

// Configuration settings
const cfgSettings = {
    priceChangeTimeInterval: btcPriceConfig.get('priceChangeTimeInterval'),
    updatePriceTimeInterval: btcPriceConfig.get('updatePriceTimeInterval'),
    purgeTimeInterval: btcPriceConfig.get('purgeTimeInterval'),
    priceMaximumLifeTime: btcPriceConfig.get('priceMaximumLifeTime')
};


// Definition of function classes
//

// BitcoinPrice function class
export class BitcoinPrice extends events.EventEmitter {
    constructor () {
        super();

        this.checkingPriceChanged = false;
        this.boundCheckPriceChange = checkPriceChange.bind(this);

        try {
            // Retrieve current bitcoin price
            this.lastTicker = Catenis.btcTicker.getTicker();
        }
        catch (err) {
            // Log error condition
            Catenis.logger.ERROR('Error getting initial bitcoin ticker.', err);
        }

        const lastRecordedBitcoinPrice = getLastRecordedBitcoinPrice.call(this);

        if (this.lastTicker) {
            if (lastRecordedBitcoinPrice === undefined || !Util.areDatesEqual(this.lastTicker.referenceDate, lastRecordedBitcoinPrice.referenceDate)) {
                saveBitcoinPrice.call(this, lastRecordedBitcoinPrice);
            }
        }
        else if (lastRecordedBitcoinPrice !== undefined) {
            Catenis.logger.DEBUG('Using last recorded bitcoin price as initial bitcoin ticker');
            // Use last recorded bitcoin price as last ticker
            this.lastTicker = lastRecordedBitcoinPrice;
        }

        // Start process to retrieve updated bitcoin price
        Meteor.setTimeout(updatePrice.bind(this, true), this.lastTicker.referenceDate.getTime() + cfgSettings.updatePriceTimeInterval - Date.now());

        // Start recurring process to purge older bitcoin prices
        this.purgeInterval = Meteor.setInterval(purgePrices.bind(this), cfgSettings.purgeTimeInterval);
    }
}


// Public BitcoinPrice object methods
//

BitcoinPrice.prototype.getCurrentBitcoinPrice = function () {
    return Catenis.db.collection.BitcoinPrice.findOne({}, {
        fields: {
            price: 1
        },
        sort: {
            referenceDate: -1
        }
    }).price;
};


// Module functions used to simulate private BitcoinPrice object methods
//  NOTE: these functions need to be bound to a BitcoinPrice object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

function checkPriceChange() {
    Catenis.logger.TRACE('Time to check for new bitcoin price');
    if (!this.checkingPriceChanged) {
        this.checkingPriceChanged = true;

        try {
            // Retrieve current bitcoin price and check if it has changed
            const ticker = Catenis.btcTicker.getTicker();

            if (!Util.areDatesEqual(ticker.referenceDate, this.lastTicker.referenceDate)) {
                Catenis.logger.TRACE('Bitcoin price has changed', ticker);
                // Bitcoin price has changed. Record it and stop recurring process to check when it changes
                this.lastTicker = ticker;
                saveBitcoinPrice.call(this);
                clearInterval(this.priceChangeInterval);
                this.priceChangeInterval = undefined;
            }
        }
        catch (err) {
            // Error processing timer to check for bitcoin price change
            Catenis.logger.ERROR('Error processing timer to check for bitcoin price change.', err);

            // Stop recurring process to check when price changes
            clearInterval(this.priceChangeInterval);
            this.priceChangeInterval = undefined;
        }
        finally {
            this.checkingPriceChanged = false;
        }
    }
    else {
        Catenis.logger.DEBUG('>>>>>> checkPriceChange(); nothing to do because already processing');
    }
}

function updatePrice(initializing) {
    Catenis.logger.TRACE('Time to retrieve bitcoin price.');
    try {
        if (initializing) {
            Catenis.logger.TRACE('Starting recurring process to retrieve updated bitcoin price');
            // Start recurring process to retrieve updated bitcoin price
            this.updateInterval = Meteor.setInterval(updatePrice.bind(this), cfgSettings.updatePriceTimeInterval);
        }

        // Retrieve current bitcoin price and check if it has changed
        const ticker = Catenis.btcTicker.getTicker();

        if (!this.lastTicker || !Util.areDatesEqual(ticker.referenceDate, this.lastTicker.referenceDate)) {
            Catenis.logger.TRACE('Updated bitcoin price', ticker);
            // This is an updated bitcoin price. Record it
            this.lastTicker = ticker;
            saveBitcoinPrice.call(this);
        }
        else {
            // Same bitcoin price as last one recorded. Start recurring process to check when it changes
            this.priceChangeInterval = Meteor.setInterval(this.boundCheckPriceChange, cfgSettings.priceChangeTimeInterval);
        }
    }
    catch (err) {
        // Error processing timer to retrieve updated bitcoin price
        Catenis.logger.ERROR('Error processing timer to retrieve updated bitcoin price.', err);
    }
}

function purgePrices() {
    try {
        // Calculate oldest reference date
        const oldestRefDate = new Date(Date.now() - cfgSettings.priceMaximumLifeTime);
        Catenis.logger.TRACE('Looking for older bitcoin prices to purge', {
            oldestRefDate: oldestRefDate
        });

        // Remove all bitcoin price docs/recs the reference date of which are older than the oldest allowed
        //  making sure that at least one bitcoin price entry is maintained in the database
        const lastPriceDoc = Catenis.db.collection.BitcoinPrice.findOne({}, {
            fields: {
                _id: 1
            },
            sort: {
                referenceDate: -1
            }
        });

        const removeSelector = {
            referenceDate: {
                $lt: oldestRefDate
            }
        };

        if (lastPriceDoc) {
            removeSelector._id = {
                $ne: lastPriceDoc._id
            }
        }

        const numRemovedDocs = Catenis.db.collection.BitcoinPrice.remove(removeSelector);
        Catenis.logger.DEBUG('Number of older bitcoin prices purged: %d', numRemovedDocs);
    }
    catch (err) {
        // Error processing timer to purge older bitcoin prices
        Catenis.logger.ERROR('Error processing timer to purge older bitcoin prices.', err);
    }
}

function getLastRecordedBitcoinPrice() {
    return Catenis.db.collection.BitcoinPrice.findOne({}, {
        fields: {
            price: 1,
            referenceDate: 1
        },
        sort: {
            referenceDate: -1
        }
    });
}

function saveBitcoinPrice(lastRecordedBitcoinPrice) {
    lastRecordedBitcoinPrice = lastRecordedBitcoinPrice || getLastRecordedBitcoinPrice();

    Catenis.db.collection.BitcoinPrice.insert({
        price: this.lastTicker.price,
        referenceDate: this.lastTicker.referenceDate,
        createdDate: new Date()
    });

    if (!lastRecordedBitcoinPrice || lastRecordedBitcoinPrice.price !== this.lastTicker.price) {
        // Issue event indicating that price has been updated
        this.emit(BitcoinPrice.notifyEvent.new_bitcoin_price.name, this.lastTicker.price);
    }
}


// BitcoinPrice function class (public) methods
//

BitcoinPrice.initialize = function () {
    Catenis.logger.TRACE('BitcoinPrice initialization');
    Catenis.btcPrice = new BitcoinPrice();
};


// BitcoinPrice function class (public) properties
//

BitcoinPrice.notifyEvent = {
    new_bitcoin_price: Object.freeze({
        name: 'new_bitcoin_price',
        description: 'A new bitcoin price has been recorded'
    })
};


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(BitcoinPrice);
