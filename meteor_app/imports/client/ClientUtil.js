/**
 * Created by claudio on 2018-07-28.
 */

//console.log('[ClientUtil.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import moment from 'moment-timezone';
import BigNumber from 'bignumber.js';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { UtilShared } from '../both/UtilShared';


// Definition of function classes
//

// ClientUtil function class
export function ClientUtil() {
}


// ClientUtil function class (public) methods
//

ClientUtil.capitalize = function (str) {
    return str.substr(0, 1).toUpperCase() + str.substr(1);
};

// Arguments:
//  date [Object(Date)|Object(moment)] - Date object
//  timeZone [String] - Name of time zone (e.g. 'America/New_York')
//  returnMoment [Boolean] - Indicates whether resulting date/time should be returned as a moment or a Date object
ClientUtil.startOfDayTimeZone = function (date, timeZone, returnMoment = false) {
    const mt = (moment.isMoment(date) ? date : moment(date)).tz(timeZone).startOf('d');

    return returnMoment ? mt : mt.toDate();
};

// Arguments:
//  amount [Number] - Currency (e.g. dollar) amount
ClientUtil.formatCurrency = function(amount) {
    return new BigNumber(amount).toFormat(2);
};

// Arguments:
//  amountInSatoshis [Number] - Crypto currency (e.g. bitcoin) amount in satoshis
ClientUtil.formatCoins = function (amountInSatoshis) {
    return new BigNumber(amountInSatoshis).dividedBy(100000000).toFormat(8);
};

// Arguments:
//  amountInSatoshis [Number] - Crypto currency (e.g. bitcoin/BCOT) amount in satoshis
ClientUtil.formatWholeCoins = function (amountInSatoshis) {
    return new BigNumber(amountInSatoshis).dividedBy(100000000).integerValue(BigNumber.ROUND_DOWN).toFormat();
};

// Arguments:
//  amount: [Number] - Catenis service credit asset amount represented as an integer number of the asset's smallest division (according to the asset divisibility)
ClientUtil.formatCatenisServiceCredits = function (amount) {
    // Note: it is assumed the asset divisibility for Catenis service credits to be 7 (decimal places)
    return new BigNumber(amount).dividedBy(10000000).toFormat(7);
};


// ClientUtil function class (public) properties
//

/*ClientUtil.prop = {};*/


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Add shared properties
_.extend(ClientUtil, UtilShared);

// Lock function class
Object.freeze(ClientUtil);
