/**
 * Created by claudio on 21/07/16.
 */

//console.log('[Util.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//  NOTE: the reference of these modules are done sing 'require()' instead of 'import' to
//      to avoid annoying WebStorm warning message: 'default export is not defined in
//      imported module'
const util = require('util');
// Third-party node modules
// noinspection JSFileReferences
import BigNumber from 'bignumber.js';
import bitcoinLib from 'bitcoinjs-lib';
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

Util.formatCoins = function (amountInSatoshis) {
    return (new BigNumber(amountInSatoshis)).dividedBy(100000000).toFormat(8);
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
