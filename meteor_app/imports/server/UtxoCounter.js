/**
 * Created by claudio on 2020-03-05
 */

//console.log('[UtxoCounter.js]: This code just ran.');

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
//import { Catenis } from './Catenis';
import { FundSource } from './FundSource';
import { CCFundSource } from './CCFundSource';


// Definition of classes
//

// UtxoCounter class
export class UtxoCounter {
    // Constructor
    //

    //  Arguments:
    //   allocResult [Object]  Object containing information about allocated UTXOs (as returned by methods
    //                          allocFund() and allocFundForTxExpense() of FundSource/CCFundSource class).
    //                          Optionally, an instance of the UtxoCounter class can be passed. In that case
    //                          a counter object with that same state (count properties) is created
    //   fundSource [Object(FundSource|CCFundSource)]  An instance of class FundSource or CCFundSource
    constructor(allocResult, fundSource) {
        this.witnessCount = 0;
        this.nonWitnessCount = 0;

        if (allocResult !== undefined) {
            if (allocResult instanceof UtxoCounter) {
                this.witnessCount = allocResult.witnessCount;
                this.nonWitnessCount = allocResult.nonWitnessCount;
            }
            else {
                let countInitialized = false;

                // Avoid having to iterate through UTXOs to initialize count
                if (((fundSource instanceof FundSource) || (fundSource instanceof CCFundSource))
                    && !fundSource.hasMixedUtxos) {
                    if (fundSource.hasWitnessUtxos) {
                        this.witnessCount = allocResult.utxos.length;
                    }
                    else if (fundSource.hasNonWitnessUtxos) {
                        this.nonWitnessCount = allocResult.utxos.length;
                    }

                    countInitialized = true;
                }

                if (!countInitialized) {
                    allocResult.utxos.forEach(utxo => {
                        if (utxo.isWitness) {
                            this.witnessCount++;
                        }
                        else {
                            this.nonWitnessCount++;
                        }
                    });
                }
            }
        }
    }


    // Public object properties (getters/setters)
    //

    get totalCount() {
        return this.witnessCount + this.nonWitnessCount;
    }


    // Public object methods
    //

    incrementCount(isWitness) {
        return isWitness ? ++this.witnessCount : ++this.nonWitnessCount;
    }

    diff(otherCounter) {
        const deltaCounter = new UtxoCounter();

        deltaCounter.witnessCount = this.witnessCount - otherCounter.witnessCount;
        deltaCounter.nonWitnessCount = this.nonWitnessCount - otherCounter.nonWitnessCount;

        return deltaCounter;
    }
}


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock class
Object.freeze(UtxoCounter);
