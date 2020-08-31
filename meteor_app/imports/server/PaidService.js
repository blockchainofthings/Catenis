/**
 * Created by claudio on 2020-08-08
 */

//console.log('[PaidService.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import EventEmitter from 'events';
// Third-party node modules
import config from 'config';
import _und from 'underscore';
import BigNumber from 'bignumber.js';
import moment from 'moment';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { BcotPrice } from './BcotPrice';
import { BitcoinPrice } from './BitcoinPrice';
import { BitcoinFees } from './BitcoinFees'
import {
    getServicePrice,
    Service
} from './Service';
import { Meteor } from "meteor/meteor";

// Config entries
const paidServiceConfig = config.get('paidService');

// Configuration settings
const cfgSettings = {
    refTimeZone: paidServiceConfig.get('refTimeZone'),
    daysToKeepHistory: paidServiceConfig.get('daysToKeepHistory'),
    historyPurgeHours: paidServiceConfig.get('historyPurgeHours'),
    historyPurgeMinutes: paidServiceConfig.get('historyPurgeMinutes'),
    historyPurgeSeconds: paidServiceConfig.get('historyPurgeSeconds'),
    historyPurgeInterval: paidServiceConfig.get('historyPurgeInterval')
};


// Definition of classes
//

// PaidService class
export class PaidService extends EventEmitter {
    // Class (public) properties
    //

    static notifyEvent = Object.freeze({
        services_cost_changed: Object.freeze({
            name: 'services_cost_changed',
            description: 'Cost for Catenis paid services has changed'
        })
    });
    static servicesInfo = getServicesInfo();
    static historyPurgeIntervalHandle;


    // Constructor
    //

    constructor() {
        super();

        this.lastServicesCost = retrieveLastRecordedServicesCost();

        if (this._checkUpdateServicesCost()) {
            this._recordServicesCost();
        }

        // Set up listeners to monitor changes in values that are used to calculate service price
        const handler = this._checkServiceCost.bind(this);

        Catenis.bcotPrice.on(BcotPrice.notifyEvent.new_bcot_price.name, handler);
        Catenis.btcPrice.on(BitcoinPrice.notifyEvent.new_bitcoin_price.name, handler);
        Catenis.bitcoinFees.on(BitcoinFees.notifyEvent.bitcoin_fees_changed.name, handler);
    }


    // Public object properties (getters/setters)
    //

    get prop() {

    }

    set prop(val) {

    }

    // Private object methods
    //

    _checkServiceCost() {
        if (this._checkUpdateServicesCost()) {
            this._recordServicesCost();
            this.emit(PaidService.notifyEvent.services_cost_changed.name);
        }
    }

    _checkUpdateServicesCost() {
        let newServicesCost;

        if (this.lastServicesCost) {
            // Services cost already recorded. Use current services cost only if different
            let costChanged = false;

            const currentServicesCost = Object.keys(PaidService.servicesInfo).reduce((obj, serviceName) => {
                const serviceCost = PaidService.getServiceCostByName(serviceName);
                costChanged = !_und.isEqual(this.lastServicesCost[serviceName], serviceCost);

                obj[serviceName] = serviceCost;

                return obj;
            }, {});

            if (costChanged) {
                newServicesCost = currentServicesCost;
            }
        }
        else {
            // No services cost recorded yet. Just retrieve current services cost
            newServicesCost = Object.keys(PaidService.servicesInfo).reduce((obj, serviceName) => {
                obj[serviceName] = PaidService.getServiceCostByName(serviceName);

                return obj;
            }, {});
        }

        if (newServicesCost) {
            this.lastServicesCost = newServicesCost;
            return true;
        }

        return false;
    }

    _recordServicesCost() {
        try {
            Catenis.db.collection.PaidServicesHistory.insert({
                date: new Date(),
                servicesCost: Object.keys(this.lastServicesCost).map(serviceName => ({
                    serviceName,
                    ...this.lastServicesCost[serviceName]
                }))
            });
        }
        catch (err) {
            Catenis.logger.ERROR('Error inserting new record to PaidServicesHistory database collection.', err);
        }
    }

    // Public object methods
    //

    serviceCost(serviceName) {
        return this.lastServicesCost[serviceName];
    }

    servicesCost() {
        return this.lastServicesCost;
    }

    // Get service costs history for a given period of time
    //
    //  Return: {
    //    servicesCostHistory: [{
    //      date: [Date],
    //      servicesCost: {
    //        <serviceName>: {
    //          estimatedServiceCost: [Number], - Estimated cost, in satoshis, of the service
    //          priceMarkup: [Number], - Markup used to calculate the price of the service
    //          btcServicePrice: [Number], - Price of the service expressed in (bitcoin) satoshis
    //          bitcoinPrice: [Number] - Bitcoin price, in USD, used to calculate exchange rate
    //          bcotPrice: [Number] - BCOT token price, in USD, used to calculate exchange rate
    //          exchangeRate: [Number], - Bitcoin to BCOT token (1 BTC = x BCOT) exchange rate used to calculate final price
    //          finalServicePrice: [Number] - Price charged for the service expressed in Catenis service credit's lowest units
    //        }
    //      }
    //    }],
    //    servicesAverageCost: {
    //      <serviceName>: [Number] - Average price charged for the service expressed in Catenis service credit's lowest units
    //    }
    //  }
    servicesCostHistoryForPeriod(startDate, endDate, returnAverage = true) {
        const now = new Date();

        // Adjust period bounding dates
        if (!endDate) {
            endDate = now;
        }

        if (startDate > endDate) {
            // Swap dates
            const firstDate = startDate;
            startDate = endDate;
            endDate = firstDate;
        }

        if (startDate > now) {
            startDate = endDate = now;
        }
        else if (endDate > now) {
            endDate = now;
        }

        // Retrieve paid services history record withing specified period
        const historyEntries = Catenis.db.collection.PaidServicesHistory.find({
            $and: [{
                date: {
                    $gte: startDate
                }
            }, {
                date: {
                    $lte: endDate
                }
            }]
        })
        .fetch()
        .map(doc => paidServiceHistoryDocToObj(doc));

        if (historyEntries.length === 0 || historyEntries[0].date > startDate) {
            // Check if there is a history entry before the first one returned and
            //  use it as the costs for the start date
            const docPaidServHist = Catenis.db.collection.PaidServicesHistory.findOne({
                date: {
                    $lt: startDate
                }
            }, {
                sort: {
                    date: -1
                }
            });

            if (docPaidServHist) {
                // Adjust date of history entry to start date
                docPaidServHist.date = startDate;

                historyEntries.unshift(paidServiceHistoryDocToObj(docPaidServHist));
            }
        }

        const result = {
            servicesCostHistory: historyEntries
        };
        const numEntries = historyEntries.length;

        if (returnAverage && numEntries > 0) {
            // Calculate average cost per service

            const msDurations = [];
            let lastEntryDate = historyEntries[0].date;

            for (let idx = 1; idx < numEntries; idx++) {
                const historyEntry = historyEntries[idx];

                msDurations.push(historyEntry.date.getTime() - lastEntryDate.getTime());
                lastEntryDate = historyEntry.date;
            }

            msDurations.push(endDate.getTime() - lastEntryDate.getTime() + 1);

            const serviceCostRollup = new Map();

            historyEntries.forEach((historyEntry, idx) => {
                const msDuration = msDurations[idx];

                Object.keys(historyEntry.servicesCost).forEach(serviceName => {
                    if (serviceCostRollup.has(serviceName)) {
                        const costRollup = serviceCostRollup.get(serviceName);

                        costRollup.weighedCost = costRollup.weighedCost.plus(new BigNumber(historyEntry.servicesCost[serviceName].finalServicePrice).multipliedBy(msDuration));
                        costRollup.totalDuration += msDuration;
                    }
                    else {
                        serviceCostRollup.set(serviceName, {
                            weighedCost: new BigNumber(historyEntry.servicesCost[serviceName].finalServicePrice).multipliedBy(msDuration),
                            totalDuration: msDuration
                        });
                    }
                });
            });

            const servicesAverageCost = {};

            for (let [serviceName, costRollup] of serviceCostRollup) {
                servicesAverageCost[serviceName] = costRollup.weighedCost.dividedBy(costRollup.totalDuration).decimalPlaces(0, BigNumber.ROUND_HALF_EVEN).toNumber();
            }

            result.servicesAverageCost = servicesAverageCost;
        }

        return result;
    }


    // Class (public) methods
    //

    static initialize() {
        Catenis.logger.TRACE('PaidService initialization');
        // Instantiate PaidService object
        Catenis.paidService = new PaidService();

        // Set timer to start process to periodically purge services cost history database docs/recs
        Meteor.setTimeout(startHistoryPurge, timeToStartHistoryPurge());
    }

    static serviceInfo(serviceName) {
        return PaidService.servicesInfo[serviceName];
    }

    static getServiceCostByName(serviceName) {
        const paidService = Service.clientPaidService[serviceName];

        if (paidService) {
            return getServicePrice(paidService);
        }
    }
}


// Definition of module (private) functions
//

function getServicesInfo() {
    return Object.freeze(Object.keys(Service.clientPaidService).reduce((obj, serviceName) => {
        obj[serviceName] = Object.freeze(_und.omit(Service.clientPaidService[serviceName], 'name', 'costFunction'));

        return obj;
    }, {}));
}

function retrieveLastRecordedServicesCost() {
    const docPaidServHist = Catenis.db.collection.PaidServicesHistory.findOne({}, {
        sort: {
            date: -1
        }
    });

    if (docPaidServHist) {
        return paidServiceHistoryDocToObj(docPaidServHist);
    }
}

function paidServiceHistoryDocToObj(doc) {
    return {
        date: doc.date,
        servicesCost: doc.servicesCost.reduce((obj, serviceCost) => {
            obj[serviceCost.serviceName] = _und.omit(serviceCost, 'serviceName');

            return obj;
        }, {})
    };
}

function timeToStartHistoryPurge() {
    const now = Date.now(),
        nowDate = new Date(now);
    let startDateTime = (new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate(), cfgSettings.historyPurgeHours, cfgSettings.historyPurgeMinutes, cfgSettings.historyPurgeSeconds)).getTime();

    if (startDateTime < now) {
        // Adjust date (add one day)
        startDateTime += 86400000;
    }

    return startDateTime - now;
}

function startHistoryPurge() {
    // Start process to purge services cost history database docs/recs now
    purgeHistory();

    // And set recurring timer to purge history periodically
    Catenis.logger.TRACE('Setting recurring timer to purge old services cost history database docs/recs');
    PaidService.historyPurgeIntervalHandle = Meteor.setInterval(purgeHistory, cfgSettings.historyPurgeInterval);
}

function purgeHistory() {
    Catenis.logger.TRACE('Executing process to purge old services cost history database docs/recs');

    const dateEarliestHistory = moment().utcOffset(cfgSettings.refTimeZone).subtract(cfgSettings.daysToKeepHistory, 'd').startOf('day').toDate();

    try {
        // Delete old services cost history database docs/recs
        Catenis.db.collection.PaidServicesHistory.remove({
            date: {
                $lt: dateEarliestHistory
            }
        });
    }
    catch (err) {
        // Error trying to delete old services cost history database docs/recs
        Catenis.logger.ERROR('Error trying to delete old services cost history database docs/recs.', err);
    }
}


// Module code
//

// Lock class
Object.freeze(PaidService);
