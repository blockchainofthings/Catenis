/**
 * Created by claudio on 21/07/16.
 */

//console.log('[Util.js]: This code just ran.');

// Module variables
//

// References to external modules
var BigNumber = Npm.require('bignumber.js');


// Definition of function classes
//

// Util function class
function Util() {
}


// Util function class (public) methods
//

Util.formatCoins = function (amountInSatoshis) {
    return (new BigNumber(amountInSatoshis)).dividedBy(100000000).toFixed(8);
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
    fee = fee != undefined && fee >= 1000 ? fee : 1000;

    if (txout.amount != undefined && txout.amount >= fee + 600) {
        let tx = new Catenis.module.Transaction();

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
    address = Array.isArray(origAddresses) ? origAddresses : [origAddresses];

    var utxos = Catenis.bitcoinCore.listUnspent(0, origAddresses);

    var inputs = [],
        totalAmount = 0;

    utxos.forEach(function (utxo) {
        let input = {
            txout: {
                txid: utxo.txid,
                vout: utxo.vout,
                amount: new BigNumber(utxo.amount).times(100000000).toNumber()
            },
            address: utxo.address
        };

        let addrInfo = Catenis.keyStore.getAddressInfo(utxo.address, true);

        if (addrInfo != null) {
            input.addrInfo = addrInfo;
        }

        totalAmount += input.txout.amount;
        inputs.push(input);
    });

    fee = fee != undefined && fee >= 1000 ? fee : 1000;

    if (totalAmount >= fee + 600) {
        let tx = new Catenis.module.Transaction();

        tx.addInputs(inputs);
        tx.addP2PKHOutput(destAddress, totalAmount - fee);

        return tx.sendTransaction();
    }
};


// Util function class (public) properties
//


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Save module function class reference
if (typeof Catenis === 'undefined')
    Catenis = {};

if (typeof Catenis.module === 'undefined')
    Catenis.module = {};

Catenis.module.Util = Object.freeze(Util);
