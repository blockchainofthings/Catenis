/**
 * Created by claudio on 2020-03-10
 */

//console.log('[UtxoConsolidation.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
//import config from 'config';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { Transaction } from './Transaction';
import { TransactionSize } from './TransactionSize';

const feeRate = 1;  // Fee rate, in satoshis/byte, to be used (set to the BitcoinCore's default minimum relay fee)


// Definition of classes
//

// UtxoConsolidation class
export class UtxoConsolidation {
    // Constructor
    //

    constructor(ctnNode) {
        this.ctnNode = ctnNode;
        this.maxInputsPerTx = calculateMaxInputsPerTx();
        this.utxosToConsolidate = [];
    }


    // Public object methods
    //

    // Arguments:
    //  utxos: [{
    //    address: [String],
    //    txout: {
    //      txid: [String],
    //      vout: [Number],
    //      amount: [Number]      // Amount in satoshis
    //    },
    //    isWitness: [Boolean],
    //    scriptPubKey: [String]
    //  }]
    addUtxos(utxos) {
        this.utxosToConsolidate = this.utxosToConsolidate.concat(utxos);
    }

    hasUtxosToConsolidate() {
        return this.utxosToConsolidate.length > 0;
    }

    // Return:
    //  consolidationTxids: [String]  List of ID of transactions that have been issued to
    //                                 consolidate the UTXOs
    consolidate() {
        // Break up UTXOs to spend in batches
        const utxosBatches = [];
        const utxosCount = this.utxosToConsolidate.length;
        let startPos = 0;

        while (startPos < utxosCount) {
            const batch = this.utxosToConsolidate.slice(startPos, startPos + this.maxInputsPerTx);

            utxosBatches.push(batch);

            startPos += batch.length;
        }

        const consolidationTxids = [];

        utxosBatches.forEach(utxos => {
            const txid = this._sendConsolidationTx(utxos);

            if (txid) {
                consolidationTxids.push(txid);
            }
        });

        return consolidationTxids;
    }

    _sendConsolidationTx(utxos) {
        const transact = new Transaction();

        // Add inputs spending UTXOs to be consolidated
        transact.addInputs(utxos.map((utxo) => {
            return {
                txout: utxo.txout,
                isWitness: utxo.isWitness,
                scriptPubKey: utxo.scriptPubKey,
                address: utxo.address,
                addrInfo: Catenis.keyStore.getAddressInfo(utxo.address, true)
            }
        }));

        // Add consolidated output (with a dust amount for now)
        const posConsolidatedOutput = transact.addPubKeyHashOutput(this.ctnNode.fundingChangeAddr.newAddressKeys().getAddress(), Transaction.witnessOutputDustAmount);

        // Calculate required fee and consolidated amount
        const fee = Math.ceil(transact.txSize.getSizeInfo().vsize * feeRate);
        const consolidatedAmount = transact.totalInputsAmount() - fee;

        if (consolidatedAmount < Transaction.witnessOutputDustAmount) {
            // Unable to consolidate UTXOs
            Catenis.logger.ERROR('Unable to consolidate UTXOs; total amount not enough to pay for required tx fee', {
                feeRate,
                fee,
                totalAmount: transact.totalInputsAmount()
            });
        }
        else {
            if (consolidatedAmount > Transaction.witnessOutputDustAmount) {
                // Reset amount of consolidated output
                transact.resetOutputAmount(posConsolidatedOutput, consolidatedAmount);
            }

            // Send transaction
            return transact.sendTransaction();
        }
    }
}


// Definition of module (private) functions
//

function calculateMaxInputsPerTx() {
    const txSize = new TransactionSize({
        numWitnessOutputs: 1  // Consolidated output
    });
    let increment = 100;
    
    do {
        // We assume the worst case where all inputs are of a non-segregated witness
        //  type (spent P2PKH output)
        txSize.addNonWitnessInputs(increment);
        
        if (txSize.getSizeInfo().vsize > Transaction.maxTxVsize) {
            // The additional inputs would make the transaction too large.
            //  Discount the added inputs and adjust increment
            txSize.addNonWitnessInputs(-increment);
            increment = increment / 10;
        }
    }
    while (increment >= 1);
    
    return txSize.numInputs;
}


// Module code
//

// Lock class
Object.freeze(UtxoConsolidation);
