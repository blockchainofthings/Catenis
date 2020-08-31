/**
 * Created by Claudio on 2016-06-29.
 */

//console.log('[EarnBitcoinFees.js]: This code just ran.');

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
import { BitcoinFees } from './BitcoinFees';

// Config entries
const earnBtcFeesConfig = config.get('earnBitcoinFees');

// Configuration settings
const cfgSettings = {
    apiVer1Url: earnBtcFeesConfig.get('apiVer1Url'),
    recommendedFeesEndPoint: earnBtcFeesConfig.get('recommendedFeesEndPoint'),
    listFeesEndPoint: earnBtcFeesConfig.get('listFeesEndPoint'),
    retrieveFeesInterval: earnBtcFeesConfig.get('retrieveFeesInterval'),
    numDbRecsToMaintain: earnBtcFeesConfig.get('numDbRecsToMaintain'),
    dbPurgeHours: earnBtcFeesConfig.get('dbPurgeHours'),
    dbPurgeMinutes: earnBtcFeesConfig.get('dbPurgeMinutes'),
    dbPurgeSeconds: earnBtcFeesConfig.get('dbPurgeSeconds'),
    dbPurgeInterval: earnBtcFeesConfig.get('dbPurgeInterval')
};


// Definition of function classes
//

// EarnBitcoinFees function class
export class EarnBitcoinFees extends events.EventEmitter {
    constructor() {
        super();

        this.apiUrl = cfgSettings.apiVer1Url;

        // Execute process to retrieve current bitcoin fees now
        retrieveFees.call(this);

        if (this.recommended === undefined || this.list === undefined) {
            // Current fees could not be retrieved. Try getting the latest recorded ones
            const docEarnBtcFees = Catenis.db.collection.EarnBitcoinFees.findOne({}, {sort: {createdDate: -1}});

            if (docEarnBtcFees !== undefined) {
                this.recommended = docEarnBtcFees.recommended;
                this.list = docEarnBtcFees.list;
            }
            else {
                // Bitcoin fees could not be determined. Throw error
                throw new Meteor.Error('ctn_earnbtcfees_not_determined', 'Bitcoin fees could not be determined');
            }
        }

        // Set recurring timer to retrieve current bitcoin fees
        Catenis.logger.TRACE('Setting recurring timer to retrieve current bitcoin fees');
        this.retrieveFeesIntervalHandle = Meteor.setInterval(retrieveFees.bind(this), cfgSettings.retrieveFeesInterval);

        // Prepare to start process to periodically purge database
        const timeToStart = timeToStartDbPurge();

        if (timeToStart > cfgSettings.retrieveFeesInterval) {
            // Time to start purge is too faraway. Do purge now
            purgeDatabase();
        }

        // Set timer to start process
        Meteor.setTimeout(startDbPurge.bind(this), timeToStart);
    }
}


// Public EarnBitcoinFees object methods
//

EarnBitcoinFees.prototype.getFeeRateByTime = function (confirmTime, lowerBoundFee = false) {
    let firstEntryLowestTime = undefined;

    const foundEntry = this.list.fees.find((entry) => {
        if (firstEntryLowestTime === undefined || (entry.maxFee !== 0 && entry.maxMinutes < firstEntryLowestTime.maxMinutes)) {
            firstEntryLowestTime = entry;
        }

        return entry.maxFee !== 0 && entry.maxMinutes <= confirmTime;
    });

    const feeBound = lowerBoundFee ? 'minFee' : 'maxFee';

    return foundEntry !== undefined ? foundEntry[feeBound] : firstEntryLowestTime[feeBound];
};

EarnBitcoinFees.prototype.getTimeByFeeRate = function (feeRate, lowerBoundTime = false) {
    let entryHighestFee = undefined;

    const foundEntry = this.list.fees.find((entry) => {
        if (entryHighestFee === undefined || entry.maxFee > entryHighestFee.maxFee) {
            entryHighestFee = entry;
        }

        return feeRate <= entry.maxFee;
    });

    const timeBound = lowerBoundTime ? 'minMinutes' : 'maxMinutes';

    return foundEntry !== undefined ? foundEntry[timeBound] : entryHighestFee[timeBound];
};

EarnBitcoinFees.prototype.getOptimumFeeRate = function () {
    return this.recommended.fastestFee;
};


// Module functions used to simulate private EarnBitcoinFees object methods
//  NOTE: these functions need to be bound to a EarnBitcoinFees object reference (this) before
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
        const docEarnBtcFees = Catenis.db.collection.EarnBitcoinFees.findOne({}, {sort: {createdDate: -1}});

        if (docEarnBtcFees === undefined || !_.isEqual(this.recommended, docEarnBtcFees.recommended) || !_.isEqual(this.list, docEarnBtcFees.list)) {
            // Record newly retrieved fees
            Catenis.db.collection.EarnBitcoinFees.insert({
                recommended: this.recommended,
                list: this.list,
                createdDate: new Date(Date.now())
            });

            // Emit event notifying that bitcoin fee rates have changed
            this.emit(BitcoinFees.notifyEvent.bitcoin_fees_changed.name);
        }
    }
    catch (err) {
        // Error trying to retrieve bitcoin fees
        Catenis.logger.ERROR('Error trying to retrieve bitcoin fees', err);
    }
}


// EarnBitcoinFees function class (public) methods
//


// EarnBitcoinFees function class (public) properties
//


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
    this.dbPurgeIntervalHandle = Meteor.setInterval(purgeDatabase, cfgSettings.dbPurgeInterval);
}

function purgeDatabase() {
    Catenis.logger.TRACE('Executing process to purge database by deleting oldest fees docs/recs');

    const firstOldestFees = Catenis.db.collection.EarnBitcoinFees.findOne({}, {fields: {createdDate: 1}, sort: {createdDate: -1}, skip: cfgSettings.numDbRecsToMaintain});

    if (firstOldestFees !== undefined) {
        try {
            // Delete all oldest docs/recs from database
            Catenis.db.collection.EarnBitcoinFees.remove({createdDate: {$lte: firstOldestFees.createdDate}});
        }
        catch (err) {
            // Error trying to delete oldest bitcoin fees docs/recs from database
            Catenis.logger.ERROR('Error trying to delete oldest bitcoin fees docs/recs from database', err);
        }
    }
}


// Module code
//


// Lock function class
Object.freeze(EarnBitcoinFees);
