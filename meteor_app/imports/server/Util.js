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
import CID from 'cids';
import Future from 'fibers/future';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { Transaction } from './Transaction';
import { UtilShared } from '../both/UtilShared';
import { BitcoinInfo } from './BitcoinInfo';


// Definition of function classes
//

// Util function class
export function Util() {
}


// Util function class (public) methods
//

Util.formatCoins = function (amountInSatoshis, thousandsSeparator = true) {
    const bnAmount = BigNumber.isBigNumber(amountInSatoshis) ? amountInSatoshis : new BigNumber(amountInSatoshis);
    const coins = bnAmount.dividedBy(100000000);

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
//  destAddress: [string]
//  fee: [number]
Util.spendUtxo = function (txout, destAddress, fee) {
    const txoutInfo = Catenis.bitcoinCore.getTxOut(txout.txid, txout.vout);

    if (txoutInfo) {
        const outputType = BitcoinInfo.getOutputTypeByName(txoutInfo.scriptPubKey.type);

        if (txout.amount === undefined) {
            txout.amount = new BigNumber(txoutInfo.value).times(100000000).toNumber()
        }

        fee = fee !== undefined ? fee : 1000;

        if (txout.amount >= fee + 600) {
            const tx = new Transaction();
            const address = txoutInfo.scriptPubKey.addresses[0];

            tx.addInput(txout, {
                isWitness: outputType.isWitness,
                scriptPubKey: txoutInfo.scriptPubKey.hex,
                address: address,
                addrInfo: Catenis.keyStore.getAddressInfo(address, true)
            });
            tx.addPubKeyHashOutput(destAddress, txout.amount - fee);

            return tx.sendTransaction();
        }
    }
    else {
        throw new Error('Invalid unspent transaction output');
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
            isWitness: utxo.isWitness,
            scriptPubKey: utxo.scriptPubKey,
            address: utxo.address
        };

        const addrInfo = Catenis.keyStore.getAddressInfo(utxo.address, true);

        if (addrInfo !== null) {
            input.addrInfo = addrInfo;
        }

        totalAmount += input.txout.amount;
        inputs.push(input);
    });

    fee = fee !== undefined ? fee : 1000;

    if (totalAmount >= fee + 600) {
        const tx = new Transaction();

        tx.addInputs(inputs);
        tx.addPubKeyHashOutput(destAddress, totalAmount - fee);

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
    // noinspection CommaExpressionJS
    return  Object.create(obj, Object.getOwnPropertyNames(obj).reduce((o, n) => (o[n] = Object.getOwnPropertyDescriptor(obj, n), o), {}));
};

// Clone an object or an array. If the array contains objects, the objects are also cloned. If those objects
//  are arrays, the process repeats itself
Util.cloneObjArray = function (arr) {
    if (typeof arr === 'object') {
        if (Array.isArray(arr)) {
            return _und.map(arr, Util.cloneObjArray);
        }

        return Util.cloneObj(arr);
    }

    return arr;
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

// Returns the date that corresponds to the given time in reference to a reference time zone
//
//  Arguments:
//   time [String] - Time, formatted as HH[:mm[:ss[.SSS]]], in reference to the reference time zone
//   date [Date|Object(moment)] - (optional) The date, in reference to the local time zone, that should be used
//                                  as the date component of the returned date/time. If not set, the present
//                                  (local) date is used
//   timeZone [String] - Reference time zone expressed as a time difference from UTC (in the UTC+/-HH:mm format)
//   retMoment [Boolean] - Indicates whether a moment Object should be returned instead of a Date object
Util.timeReferenceTimeZone = function (time, date, timeZone, returnMoment = false) {
    const mt = moment(moment(date).format('YYYY-MM-DD') + 'T' + time).utcOffset(timeZone, true);

    return returnMoment ? mt : mt.toDate();
};

// Returns the given date in reference to a reference time zone
//
//  Arguments:
//   date [Date|Object(moment)] - The date, in reference to the local time zone, to convert
//   timeZone [String] - Reference time zone expressed as a time difference from UTC (in the UTC+/-HH:mm format)
//   retMoment [Boolean] - Indicates whether a moment Object should be returned instead of a Date object
Util.dateReferenceTimeZone = function (time, date, timeZone, returnMoment = false) {
    const mt = moment(date).utcOffset(timeZone, true);

    return returnMoment ? mt : mt.toDate();
};

Util.capitalize = function (str) {
    return str.substr(0, 1).toUpperCase() + str.substr(1);
};

Util.isUndefinedOrNull = function (val) {
    return val === undefined || val === null;
};

Util.processItemsAsync = function (itemsToProcess, procFunc, ...procArgs /* this, arg1, arg2, ..., callbackFunc */) {
    let callbackFunc;

    if (procArgs.length > 0 && typeof procArgs[procArgs.length - 1] === 'function') {
        callbackFunc = procArgs.pop();
    }

    let cbThis = undefined;

    if (procArgs.length > 0) {
        cbThis = procArgs.shift();
    }

    function processControl() {
        const itemToProcess = itemsToProcess[0];

        // Do processing
        const callArgs = [itemToProcess].concat(procArgs);

        try {
            procFunc.apply(cbThis, callArgs);

            // Remove processed item from list
            itemsToProcess.shift();
        }
        catch (err) {
            Catenis.logger.DEBUG('Exception while processing items asynchronously; processing interrupted:', err.toString(), {
                currentItem: itemToProcess,
                itemsLeft: itemsToProcess.length
            });
            // Interrupt processing and pass error via callback if one was provided
            if (callbackFunc) {
                Meteor.defer(callbackFunc.bind(undefined, err));
            }

            return;
        }

        if (itemsToProcess.length > 0) {
            Meteor.defer(processControl);
        }
        else if (callbackFunc) {
            Meteor.defer(callbackFunc);
        }
    }

    if (itemsToProcess.length > 0) {
        processControl();
    }
    else if (callbackFunc) {
        Meteor.defer(callbackFunc);
    }
};

Util.kebabToCamelCase = function (name) {
    return name.split('-').reduce((convName, part, idx) => {
        if (idx > 0) {
            part = Util.capitalize(part);
        }

        convName += part;

        return convName;
    }, '');
};

Util.isValidCid = function (cid) {
    let isValid = true;

    try {
        new CID(cid);
    }
    catch (err) {
        isValid = false;
    }

    return isValid;
};

Util.isNonNullObject = function (obj) {
    return typeof obj === 'object' && obj !== null;
};

Util.wrapAsyncPromise = function (fn, context) {
    return function (/* arguments */) {
        return Future.fromPromise(fn.apply(context || this, Array.from(arguments))).wait();
    };
};

Util.wrapAsyncIterable = function (fn, sink, context) {
    return function (/* arguments */) {
        return sink(fn.apply(context || this, Array.from(arguments)));
    };
};

// Note: this should be used as a `sink` to Util.wrapAsyncIterable()
Util.asyncIterableToArray = function (it) {
    const arr = [];
    const fut = new Future();

    (async function () {
        for await (let el of it) {
            arr.push(el);
        }

        fut.return(arr);
    })()
    .catch((err) => {
        if (!fut.isResolved()) {
            fut.throw(err);
        }
    });

    fut.wait();

    return arr;
};

// Note: this should be used as a `sink` to Util.wrapAsyncIterable()
Util.asyncIterableToBuffer = function (it) {
    return Buffer.concat(Util.asyncIterableToArray(it));
};


// Util function class (public) properties
//


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Add shared properties
_und.extend(Util, UtilShared);

// Lock function class
Object.freeze(Util);
