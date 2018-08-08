/**
 * Created by Claudio on 2016-07-21.
 */

//console.log('[Util.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import util from 'util';
// Third-party node modules
// noinspection JSFileReferences
import BigNumber from 'bignumber.js';
import bitcoinLib from 'bitcoinjs-lib';
import _und from 'underscore';
import moment from 'moment-timezone';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { Transaction } from './Transaction';


// Definition of function classes
//

// Util function class
export function Util() {
}


// Util function class (public) methods
//

Util.formatCoins = function (amountInSatoshis, thousandsSeparator = true) {
    const coins = new BigNumber(amountInSatoshis).dividedBy(100000000);

    return thousandsSeparator ? coins.toFormat(8) : coins.toFixed(8);
};

// Arguments:
//  amount: [Number] - Catenis service credit asset amount represented as an integer number of the asset's smallest division (according to the asset divisibility)
Util.formatCatenisServiceCredits = function (amount) {
    const divisibility = Catenis.ctnHubNode.serviceCreditAssetInfo().issuingOpts.divisibility;

    return new BigNumber(amount).dividedBy(Math.pow(10, divisibility)).toFormat(divisibility);
};

// Spend UTXO
//
// Arguments:
//  txout: {
//    txid: [string],
//    vout: [number],
//    amount: [number]
//  }
//  origAddress: [string]
//  destAddress: [string]
//  fee: [number]
Util.spendUtxo = function (txout, origAddress, destAddress, fee) {
    fee = fee !== undefined && fee >= 1000 ? fee : 1000;

    if (txout.amount !== undefined && txout.amount >= fee + 600) {
        let tx = new Transaction();

        tx.addInput(txout, origAddress, Catenis.keyStore.getAddressInfo(origAddress, true));
        tx.addP2PKHOutput(destAddress, txout.amount - fee);

        return tx.sendTransaction();
    }
};

// Spend all UTXOs associated to a specified addresses
//
// Arguments:
//  origAddresses: [Array(string)] or [string]
//  destAddress: [string]
//  fee: [number]
Util.spendAddresses = function (origAddresses, destAddress, fee) {
    const utxos = Catenis.bitcoinCore.listUnspent(0, origAddresses);

    const inputs = [];
    let totalAmount = 0;

    utxos.forEach((utxo) => {
        const input = {
            txout: {
                txid: utxo.txid,
                vout: utxo.vout,
                amount: new BigNumber(utxo.amount).times(100000000).toNumber()
            },
            address: utxo.address
        };

        const addrInfo = Catenis.keyStore.getAddressInfo(utxo.address, true);

        if (addrInfo !== null) {
            input.addrInfo = addrInfo;
        }

        totalAmount += input.txout.amount;
        inputs.push(input);
    });

    fee = fee !== undefined && fee >= 1000 ? fee : 1000;

    if (totalAmount >= fee + 600) {
        const tx = new Transaction();

        tx.addInputs(inputs);
        tx.addP2PKHOutput(destAddress, totalAmount - fee);

        return tx.sendTransaction();
    }
};

// Take transaction output (txout) object and return its string representation
//
//  Arguments:
//   txout: [Object] - Object representing a transaction output. Should have two properties: txid, and vout
Util.txoutToString = function (txout) {
    return util.format('%s:%d', txout.txid, txout.vout);
};

Util.isValidBlockchainAddress = function (address) {
    try {
        bitcoinLib.address.fromBase58Check(address);
    }
    catch (err) {
        return false;
    }

    return true;
};

Util.weightedAverage = function (values, weights) {
    // Make sure that arguments are consistent
    if (!Array.isArray(values) || !Array.isArray(weights) || values.length !== weights.length || values.length === 0) {
        Catenis.logger.ERROR('Util.weightedAverage method call with in consistent arguments', {
            value: values,
            weights: weights
        });
        throw new Error('Util.weightedAverage method call with in consistent arguments');
    }

    let sum = 0;
    let sumWeights = 0;

    values.forEach((value, idx) => {
        sum += value * weights[idx];
        sumWeights += weights[idx];
    });

    return sum / sumWeights;
};

Util.roundToResolution = function (value, resolution) {
    return Math.ceil(value / resolution) * resolution;
};

Util.roundDownToResolution = function (value, resolution) {
    return Math.floor(value / resolution) * resolution;
};

// Return:
//  diffResult: { - (only returned if arrays do not have the same elements (not necessarily in the same order))
//    added: [Array], - (only exist if there are elements in array 2 that do not belong to array 1, or if the same element
//                      is found in both arrays but there is a greater quantity of it in array 2 than in array 1)
//    deleted: [Array], - (only exist if there are elements in array 1 that do not belong to array 2, or if the same element
//                         is found in both arrays but there is a greater quantity of it in array 1 than in array 2)
//  }
Util.diffArrays = function (ar1, ar2) {
    const cpAr1 = _und.clone(ar1);
    const cpAr2 = _und.clone(ar2);

    const addedElems = ar2.filter((elm2) => {
        const foundAt = cpAr1.findIndex((elm1) => elm1 === elm2);

        if (foundAt >= 0) {
            cpAr1.splice(foundAt, 1);
            return false;
        }

        return true;
    });
    const deletedElems = ar1.filter((elm1) => {
        const foundAt = cpAr2.findIndex((elm2) => elm2 === elm1);

        if (foundAt >= 0) {
            cpAr2.splice(foundAt, 1);
            return false;
        }

        return true;
    });

    const diffResult = {};

    if (addedElems.length > 0) {
        diffResult.added = addedElems;
    }

    if (deletedElems.length > 0) {
        diffResult.deleted = deletedElems;
    }

    return Object.keys(diffResult).length > 0 ? diffResult : undefined;
};

// Concatenate two arrays making sure that common values are not duplicated
Util.mergeArrays = function (ar1, ar2) {
    const resultAr = ar1.concat([]);

    ar2.forEach((element) => {
        if (resultAr.indexOf(element) === -1) {
            resultAr.push(element);
        }
    });

    return resultAr;
};

// This method is to be used in place of underscore.js's clone() method to overcome a limitation
//  of that method where accessor type properties (getter/setter) are copied as data properties
Util.cloneObj = function (obj) {
    const cloneObj = {};

    Object.getOwnPropertyNames(obj).forEach((propName) => {
        Object.defineProperty(cloneObj, propName, Object.getOwnPropertyDescriptor(obj, propName));
    });

    Object.setPrototypeOf(cloneObj, Object.getPrototypeOf(obj));

    return cloneObj;
};

// Method used to escape special characters in an string that is to be used as a regular expression pattern
Util.escapeRegExp = function (str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
};

Util.areDatesEqual = function (dt1, dt2) {
    return dt1.valueOf() === dt2.valueOf();
};

// Arguments:
//  date [Object(Date)|Object(moment)] - Date object
//  timeZone [String] - Name of time zone (e.g. 'America/New_York')
//  returnMoment [Boolean] - Indicates whether resulting date/time should be returned as a moment or a Date object
Util.startOfDayTimeZone = function (date, timeZone, returnMoment = false) {
    const mt = (moment.isMoment(date) ? date : moment(date)).tz(timeZone).startOf('d');

    return returnMoment ? mt : mt.toDate();
};

// Arguments:
//  day [String] - String representing a given calendar date in the format 'YYYY-MM-DD'
//  timeZone [String] - Name of time zone (e.g. 'America/New_York')
//  returnMoment [Boolean] - Indicates whether resulting date/time should be returned as a moment or a Date object
Util.dayTimeZoneToDate = function (day, timeZone, returnMoment = false) {
    const mt = moment.tz(day, 'YYYY-MM-DD', true, timeZone);

    return returnMoment ? mt : mt.toDate();
};

Util.capitalize = function (str) {
    return str.substr(0, 1).toUpperCase() + str.substr(1);
};

Util.isUndefinedOrNull = function (val) {
    return val === undefined || val === null;
};


// Util function class (public) properties
//


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(Util);
