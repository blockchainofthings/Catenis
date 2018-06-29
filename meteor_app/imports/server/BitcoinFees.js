/**
 * Created by claudio on 29/06/16.
 */

//console.log('[BitcoinFees.js]: This code just ran.');

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
import { _ } from 'meteor/underscore';
import {HTTP} from 'meteor/http';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';

// Config entries
const btcFeesConfig = config.get('bitcoinFees');

// Configuration settings
const cfgSettings = {
    apiVer1Url: btcFeesConfig.get('apiVer1Url'),
    recommendedFeesEndPoint: btcFeesConfig.get('recommendedFeesEndPoint'),
    listFeesEndPoint: btcFeesConfig.get('listFeesEndPoint'),
    retrieveFeesInterval: btcFeesConfig.get('retrieveFeesInterval'),
    numDbRecsToMaintain: btcFeesConfig.get('numDbRecsToMaintain'),
    dbPurgeHours: btcFeesConfig.get('dbPurgeHours'),
    dbPurgeMinutes: btcFeesConfig.get('dbPurgeMinutes'),
    dbPurgeSeconds: btcFeesConfig.get('dbPurgeSeconds'),
    dbPurgeInterval: btcFeesConfig.get('dbPurgeInterval')
};

let retrieveFeesIntervalHandle,
    dbPurgeIntervalHandle;


// Definition of function classes
//

// BitcoinFees function class
export class BitcoinFees extends events.EventEmitter {
    constructor(apiUrl) {
        super();

        this.apiUrl = apiUrl;
    }
}


// Public BitcoinFees object methods
//

BitcoinFees.prototype.getFeeRateByTime = function (confirmTime) {
    let firstEntryLowestTime = undefined;

    const foundEntry = this.list.fees.find((entry) => {
        if (firstEntryLowestTime === undefined || (entry.maxFee !== 0 && entry.maxMinutes < firstEntryLowestTime.maxMinutes)) {
            firstEntryLowestTime = entry;
        }

        return entry.maxFee !== 0 && entry.maxMinutes <= confirmTime;
    });

    return foundEntry !== undefined ? foundEntry.maxFee : firstEntryLowestTime.maxFee;
};

BitcoinFees.prototype.getOptimumFeeRate = function () {
    return this.recommended.fastestFee;
};


// Module functions used to simulate private BitcoinFees object methods
//  NOTE: these functions need to be bound to a BitcoinFees object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

function recommendedFees() {
    const endpointUrl = this.apiUrl + cfgSettings.recommendedFeesEndPoint;

    return HTTP.get(endpointUrl, {json: true});
}

function listFees() {
    const endpointUrl = this.apiUrl + cfgSettings.listFeesEndPoint;

    return HTTP.get(endpointUrl, {json: true});
}

function retrieveFees() {
    Catenis.logger.TRACE('Executing process to retrieve current bitcoin fees');
    try {
        this.recommended = recommendedFees.call(this).data;
        this.list = fixListFees(listFees.call(this).data);

        // Get latest recorded fees
        const docBtcFees = Catenis.db.collection.BitcoinFees.findOne({}, {sort: {createdDate: -1}});

        if (docBtcFees === undefined || !_.isEqual(this.recommended, docBtcFees.recommended) || !_.isEqual(this.list, docBtcFees.list)) {
            // Record newly retrieved fees
            Catenis.db.collection.BitcoinFees.insert({
                recommended: this.recommended,
                list: this.list,
                createdDate: new Date(Date.now())
            });

            // Emit event notifying that bitcoin fee rates have changed
            this.emit(BitcoinFees.notifyEvent.bitcoin_fees_changed.name, {
                recommended: this.recommended,
                list: this.list
            });
        }
    }
    catch (err) {
        // Error trying to retrieve bitcoin fees
        Catenis.logger.ERROR('Error trying to retrieve bitcoin fees', err);
    }
}


// BitcoinFees function class (public) methods
//

BitcoinFees.initialize = function () {
    Catenis.logger.TRACE('BitcoinFees initialization');
    Catenis.bitcoinFees = new BitcoinFees(cfgSettings.apiVer1Url);

    // Execute process to retrieve current bitcoin fees now
    retrieveFees.call(Catenis.bitcoinFees);

    if (Catenis.bitcoinFees.recommended === undefined || Catenis.bitcoinFees.list === undefined) {
        // Current fees could not be retrieved. Try getting the latest recorded ones
        const docBtcFees = Catenis.db.collection.BitcoinFees.findOne({}, {sort: {createdDate: -1}});

        if (docBtcFees !== undefined) {
            Catenis.bitcoinFees.recommended = docBtcFees.recommended;
            Catenis.bitcoinFees.list = docBtcFees.list;
        }
        else {
            // Bitcoin fees could not be determined. Throw error
            throw new Meteor.Error('ctn_btcfees_not_determined', 'Bitcoin fees could not be determined');
        }
    }

    // Set recurring timer to retrieve current bitcoin fees
    Catenis.logger.TRACE('Setting recurring timer to retrieve current bitcoin fees');
    retrieveFeesIntervalHandle = Meteor.setInterval(retrieveFees.bind(Catenis.bitcoinFees), cfgSettings.retrieveFeesInterval);

    // Prepare to start process to periodically purge database
    const timeToStart = timeToStartDbPurge();

    if (timeToStart > cfgSettings.retrieveFeesInterval) {
        // Time to start purge is too faraway. Do purge now
        purgeDatabase();
    }

    // Set timer to start process
    Meteor.setTimeout(startDbPurge, timeToStart);
};


// BitcoinFees function class (public) properties
//

BitcoinFees.notifyEvent = Object.freeze({
    bitcoin_fees_changed: Object.freeze({
        name: 'bitcoin_fees_changed',
        description: 'Predicting bitcoin fee rates for transactions have changed'
    })
});


// Definition of module (private) functions
//

function fixListFees(list) {
    const feeSpreadCount = new Map();

    list.fees = list.fees.map((entry) => {
        // Compute fee spread count
        const feeSpread = entry.maxFee - entry.minFee + 1;

        if (feeSpreadCount.has(feeSpread)) {
            feeSpreadCount.set(feeSpread, feeSpreadCount.get(feeSpread) + 1);
        }
        else {
            feeSpreadCount.set(feeSpread, 1);
        }

        // Remove unnecessary properties
        return _.omit(entry, ['dayCount', 'memCount']);
    });

    // Identify most frequent fee spread
    let maxCount = 0,
        freqFeeSpread;

    for (let [feeSpread, count] of feeSpreadCount) {
        if (count > maxCount) {
            maxCount = count;
            freqFeeSpread = feeSpread;
        }
    }

    // Now fix last entry fee spread
    const lastEntry = list.fees[list.fees.length - 1];

    if (lastEntry.maxFee - lastEntry.minFee + 1 > freqFeeSpread) {
        lastEntry.maxFee = lastEntry.minFee + freqFeeSpread - 1;
    }

    return list;
}

function timeToStartDbPurge() {
    const now = Date.now(),
        nowDate = new Date(now);
    let startDateTime = (new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate(), cfgSettings.dbPurgeHours, cfgSettings.dbPurgeMinutes, cfgSettings.dbPurgeSeconds)).getTime();

    if (startDateTime < now) {
        // Adjust date (add one day)
        startDateTime += 86400000;
    }

    return startDateTime - now;
}

function startDbPurge() {
    // Start process to purge database now
    purgeDatabase();

    // And set recurring timer to purge database periodically
    Catenis.logger.TRACE('Setting recurring timer to purge database by deleting oldest fees docs/recs');
    dbPurgeIntervalHandle = Meteor.setInterval(purgeDatabase, cfgSettings.dbPurgeInterval);
}

function purgeDatabase() {
    Catenis.logger.TRACE('Exececuting process to purge database by deleting oldest fees docs/recs');

    const firstOldestFees = Catenis.db.collection.BitcoinFees.findOne({}, {fields: {createdDate: 1}, sort: {createdDate: -1}, skip: cfgSettings.numDbRecsToMaintain});

    if (firstOldestFees !== undefined) {
        try {
            // Delete all oldest docs/recs from database
            Catenis.db.collection.BitcoinFees.remove({createdDate: {$lte: firstOldestFees.createdDate}});
        }
        catch (err) {
            // Error trying to delete oldest bitcoin fees docs/recs from database
            Catenis.logger.ERROR('Error trying to delete oldest bitcoin fees docs/recs from database', err);
        }
    }
}


// Module code
//

// Definition of properties
Object.defineProperties(BitcoinFees, {
    retrieveFeesIntervalHandle: {
        get: function () {
            return retrieveFeesIntervalHandle;
        },
        enumerable: true
    },
    dbPurgeIntervalHandle: {
        get: function () {
            return dbPurgeIntervalHandle;
        },
        enumerable: true
    }
});

// Lock function class
Object.freeze(BitcoinFees);
