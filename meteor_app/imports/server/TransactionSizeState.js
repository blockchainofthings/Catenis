/**
 * Created by claudio on 2020-02-26
 */

//console.log('[TransactionSizeState.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import _und from 'underscore';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
//import { Catenis } from './Catenis';
import { Transaction } from './Transaction';
import { Util } from './Util';


// Definition of classes
//

// TransactionSizeState class
export class TransactionSizeState {
    // Constructor
    //
    //  Arguments:
    //   txOrStateSnapshot [Object] {  (optional) Either an instance of the Transaction class (or any of its derived
    //                                  classes) or a snapshot object with the current tx size state (as defined below).
    //                                  Optionally, an instance of the TransactionSizeState class can be passed in place
    //                                  of a state snapshot. In that case, its current tx size state is used.
    //                                  If not set, the state is cleared
    //     numWitnessInputs: [Number],                  (optional, default: 0)
    //     numNonWitnessInputs: [Number],               (optional, default: 0)
    //     numWitnessOutputs: [Number],                 (optional, default: 0)
    //     numNonWitnessOutputs: [Number],              (optional, default: 0)
    //     numPubKeysMultiSigOutputs: [Array(Number)],  (optional, default: empty Array)
    //     nullDataPayloadSize: [Number]                (optional, default: 0)
    //   }
    //   dynamic [Boolean]  (optional, default = true) Indicates whether tx size state should be dynamically maintained
    //                       through the supplied Transaction instance. Only applies when txOrStateSnapshot is a
    //                       Transaction instance
    constructor(txOrStateSnapshot, dynamic) {
        this.resetState(txOrStateSnapshot, dynamic);
    }


    // Public object properties (getters/setters)
    //

    get numWitnessInputs() {
        return !this.isDynamic ? this._numWitnessInputs : this.transact.countWitnessInputs();
    }

    get numNonWitnessInputs() {
        return !this.isDynamic ? this._numNonWitnessInputs : this.transact.countNonWitnessInputs();
    }

    get numWitnessOutputs() {
        return !this.isDynamic ? this._numWitnessOutputs : this.transact.countP2WPKHOutputs();
    }

    get numNonWitnessOutputs() {
        return !this.isDynamic ? this._numNonWitnessOutputs : this.transact.countP2PKHOutputs();
    }

    get numPubKeysMultiSigOutputs() {
        return !this.isDynamic ? this._numPubKeysMultiSigOutputs : this.transact.getNumPubKeysMultiSigOutputs();
    }

    get nullDataPayloadSize() {
        return !this.isDynamic ? this._nullDataPayloadSize : this.transact.nullDataPayloadSize;
    }


    // Public object methods
    //

    // Reset the tx size state
    //
    //  Arguments:
    //   txOrStateSnapshot [Object] {  (optional) Either an instance of the Transaction class (or any of its derived
    //                                  classes) or a snapshot object with the current tx size state (as defined below).
    //                                  Optionally, an instance of the TransactionSizeState class can be passed in place
    //                                  of a state snapshot. In that case, its current tx size state is used.
    //                                  If not set, the state is cleared
    //     numWitnessInputs: [Number],
    //     numNonWitnessInputs: [Number],
    //     numWitnessOutputs: [Number],
    //     numNonWitnessOutputs: [Number],
    //     numPubKeysMultiSigOutputs: [Array(Number)],
    //     nullDataPayloadSize: [Number]
    //   }
    //   dynamic [Boolean]  (optional, default = true) Indicates whether tx size state should be dynamically maintained
    //                       through the supplied Transaction instance. Only applies when txOrStateSnapshot is a
    //                       a Transaction instance
    resetState(txOrStateSnapshot, dynamic) {
        // Validate arguments
        if (txOrStateSnapshot !== undefined && (typeof txOrStateSnapshot !== 'object' || txOrStateSnapshot === null)) {
            throw new TypeError('TransactionSizeState: invalid \'txOrStateSnapshot\' argument');
        }

        // Static tx size state variables
        this._numWitnessInputs = 0;             // Inputs spending a P2WPKH output
        this._numNonWitnessInputs = 0;          // Inputs spending a P2PKH output
        this._numWitnessOutputs = 0;            // P2WPKH outputs
        this._numNonWitnessOutputs = 0;         // P2PKH outputs
        this._numPubKeysMultiSigOutputs = [];   // List of total number of public keys that can spend a multi-signature output
        this._nullDataPayloadSize = 0;          // Number of bytes embedded in a 'nulldata' output

        this.isDynamic = false;

        if (txOrStateSnapshot instanceof Transaction) {
            this.transact = txOrStateSnapshot;
            this.isDynamic = dynamic === undefined ? true : !!dynamic;

            if (!this.isDynamic) {
                this._initStateFromTransaction();
            }
        }
        else if (txOrStateSnapshot !== undefined) {
            if (txOrStateSnapshot instanceof TransactionSizeState) {
                txOrStateSnapshot = txOrStateSnapshot._takeStateSnapshot(false);
            }
            else {
                fixStateSnapshot(txOrStateSnapshot);
            }

            this._initState(txOrStateSnapshot);
        }
        
        this.takeStateSnapshot();
    }

    // Add or remove one or more tx inputs
    //
    //  Arguments:
    //   isWitness [Boolean]  Indicates whether inputs to add/remove are of a segregated witness type (spend a P2WPKH
    //                         output) or not (spend a P2PKH outputs)
    //   count [Number]  The number of inputs to add/remove. If count is a positive number, inputs as added. Otherwise,
    //                    if count is a negative number, inputs are removed
    addInputs(isWitness, count) {
        if (typeof count === 'number') {
            count = parseInt(count);

            if (count !== 0) {
                if (this.isDynamic) {
                    // If state is currently dynamic, init static state variables (and clear dynamic indication)
                    this._initStateFromTransaction();
                }

                if (isWitness) {
                    this._numWitnessInputs += count;

                    if (this._numWitnessInputs < 0) {
                        this._numWitnessInputs = 0;
                    }
                }
                else {
                    this._numNonWitnessInputs += count;

                    if (this._numNonWitnessInputs < 0) {
                        this._numNonWitnessInputs = 0;
                    }
                }
            }
        }
    }

    // Add or remove one or more segregated witness (spend a P2WPKH output) tx inputs
    //
    //  Arguments:
    //   count [Number]  The number of inputs to add/remove. If count is a positive number, inputs as added. Otherwise,
    //                    if count is a negative number, inputs are removed
    addWitnessInputs(count) {
        return this.addInputs(true, count);
    }

    // Add or remove one or more non-segregated witness (spend a P2PKH output) tx inputs
    //
    //  Arguments:
    //   count [Number]  The number of inputs to add/remove. If count is a positive number, inputs as added. Otherwise,
    //                    if count is a negative number, inputs are removed
    addNonWitnessInputs(count) {
        return this.addInputs(false, count);
    }

    // Add or remove one or more tx outputs paying to a single (public key hash) address
    //
    //  Arguments:
    //   isWitness [Boolean]  Indicates whether outputs to add/remove are of a segregated witness type (P2WPKH)
    //                         or not (P2PKH)
    //   count [Number]  The number of outputs to add/remove. If count is a positive number, outputs as added. Otherwise,
    //                    if count is a negative number, outputs are removed
    addOutputs(isWitness, count) {
        if (typeof count === 'number') {
            count = parseInt(count);

            if (count !== 0) {
                if (this.isDynamic) {
                    // If state is currently dynamic, init static state variables (and clear dynamic indication)
                    this._initStateFromTransaction();
                }

                if (isWitness) {
                    this._numWitnessOutputs += count;

                    if (this._numWitnessOutputs < 0) {
                        this._numWitnessOutputs = 0;
                    }
                }
                else {
                    this._numNonWitnessOutputs += count;

                    if (this._numNonWitnessOutputs < 0) {
                        this._numNonWitnessOutputs = 0;
                    }
                }
            }
        }
    }

    // Add or remove one or more segregated witness tx outputs paying to a single (public key hash) address (P2WPKH)
    //
    //  Arguments:
    //   count [Number]  The number of outputs to add/remove. If count is a positive number, outputs as added. Otherwise,
    //                    if count is a negative number, outputs are removed
    addWitnessOutputs(count) {
        return this.addOutputs(true, count);
    }

    // Add or remove one or more non-segregated witness tx outputs paying to a single (public key hash) address (P2PKH)
    //
    //  Arguments:
    //   count [Number]  The number of outputs to add/remove. If count is a positive number, outputs as added.
    //                    Otherwise, if count is a negative number, outputs are removed
    addNonWitnessOutputs(count) {
        return this.addOutputs(false, count);
    }

    // Add or remove one multi-signature tx output
    //
    //  Arguments:
    //   numPubKeys [Number]  Number of public keys that can (potentially) spend this output. If numPubKeys is a
    //                         positive number, a new output is added. Otherwise, if numPubKeys is a negative
    //                         number, the first multi-signature output with that many public keys (if any) is removed
    addMultiSigOutput(numPubKeys) {
        if (typeof numPubKeys === 'number') {
            numPubKeys = parseInt(numPubKeys);

            if (numPubKeys !== 0) {
                if (this.isDynamic) {
                    // If state is currently dynamic, init static state variables (and clear dynamic indication)
                    this._initStateFromTransaction();
                }

                if (numPubKeys > 0) {
                    this._numPubKeysMultiSigOutputs.push(numPubKeys);
                }
                else {
                    // Remove first multi-signature output that has the number of public keys specified
                    const absNumPubKeys = -numPubKeys;

                    this._numPubKeysMultiSigOutputs.some((numPubKeysOutput, idx, list) => {
                        if (numPubKeysOutput === absNumPubKeys) {
                            list.splice(idx, 1);

                            return true;
                        }

                        return false;
                    })
                }
            }
        }
    }

    // Set the size of the data embedded in the nulldata output
    //
    //  Arguments:
    //   payloadSize [Number]  The size, in bytes, of the data embedded in the nulldata output. If payloadSize is
    //                          zero, no nulldata output is present
    setNullDataPayloadSize(payloadSize) {
        if (typeof payloadSize === 'number') {
            payloadSize = parseInt(payloadSize);

            if (payloadSize >= 0 && payloadSize !== this.nullDataPayloadSize) {
                if (this.isDynamic) {
                    // If state is currently dynamic, init static state variables (and clear dynamic indication)
                    this._initStateFromTransaction();
                }

                this._nullDataPayloadSize = payloadSize;
            }
        }
    }

    // Take a snapshot of the current tx size state variables
    //
    //  Return:
    //   stateSnapshot: {
    //     numWitnessInputs: [Number],
    //     numNonWitnessInputs: [Number],
    //     numWitnessOutputs: [Number],
    //     numNonWitnessOutputs: [Number],
    //     numPubKeysMultiSigOutputs: [Array(Number)],
    //     nullDataPayloadSize: [Number]
    //   }
    //
    takeStateSnapshot() {
        return this._takeStateSnapshot(true);
    }

    // Report the difference in tx size state between the current state and a state snapshot
    //
    //  Arguments:
    //   stateSnapshot [Object]  (optional) The tx size state snapshot to compare against. If a TransactionSizeState
    //                            instance is passed, its current tx size state is used. If not specified, a previously
    //                            saved state snapshot is used
    //
    //  Return: if no difference is found, undefined is returned. Otherwise, the following object is returned
    //   deltaStateSnapshot: {
    //     numWitnessInputs: {  (optional, only returned if difference is found)
    //       current: [Number]
    //       delta: [Number]
    //     },
    //     numNonWitnessInputs: {  (optional, only returned if difference is found)
    //       current: [Number]
    //       delta: [Number]
    //     },
    //     numWitnessOutputs: {  (optional, only returned if difference is found)
    //       current: [Number]
    //       delta: [Number]
    //     },
    //     numNonWitnessOutputs: {  (optional, only returned if difference is found)
    //       current: [Number]
    //       delta: [Number]
    //     },
    //     numPubKeysMultiSigOutputs: {  (optional, only returned if difference is found)
    //       current: [Array(Number)]
    //       delta: {
    //         added: [Array(Number)],
    //         deleted: [Array(Number)]
    //     },
    //     nullDataPayloadSize: {  (optional, only returned if difference is found)
    //       current: [Number]
    //       delta: [Number]
    //     }
    //   }
    diffState(stateSnapshot) {
        // Validate arguments
        if (stateSnapshot !== undefined && (typeof stateSnapshot !== 'object' || stateSnapshot === null)) {
            throw new TypeError('TransactionSizeState: invalid \'stateSnapshot\' argument');
        }

        if (stateSnapshot === undefined) {
            stateSnapshot = this.stateSnapshot;
        }
        else if (stateSnapshot instanceof TransactionSizeState) {
            stateSnapshot = stateSnapshot._takeStateSnapshot(false);
        }
        else {
            fixStateSnapshot(stateSnapshot);
        }

        const currStateSnapshot = this._takeStateSnapshot(false);
        
        const deltaStateSnapshot = {};
        let delta;

        if ((delta = currStateSnapshot.numWitnessInputs - stateSnapshot.numWitnessInputs) !== 0) {
            deltaStateSnapshot.numWitnessInputs = {
                current: currStateSnapshot.numWitnessInputs,
                delta
            };
        }

        if ((delta = currStateSnapshot.numNonWitnessInputs - stateSnapshot.numNonWitnessInputs) !== 0) {
            deltaStateSnapshot.numNonWitnessInputs = {
                current: currStateSnapshot.numNonWitnessInputs,
                delta
            };
        }

        if ((delta = currStateSnapshot.numWitnessOutputs - stateSnapshot.numWitnessOutputs) !== 0) {
            deltaStateSnapshot.numWitnessOutputs = {
                current: currStateSnapshot.numWitnessOutputs,
                delta
            };
        }

        if ((delta = currStateSnapshot.numNonWitnessOutputs - stateSnapshot.numNonWitnessOutputs) !== 0) {
            deltaStateSnapshot.numNonWitnessOutputs = {
                current: currStateSnapshot.numNonWitnessOutputs,
                delta
            };
        }
        
        if ((delta = Util.diffArrays(stateSnapshot.numPubKeysMultiSigOutputs, currStateSnapshot.numPubKeysMultiSigOutputs))) {
            deltaStateSnapshot.numPubKeysMultiSigOutputs = {
                current: currStateSnapshot.numPubKeysMultiSigOutputs,
                delta
            }
        }

        if ((delta = currStateSnapshot.nullDataPayloadSize - stateSnapshot.nullDataPayloadSize) !== 0) {
            deltaStateSnapshot.nullDataPayloadSize = {
                current: currStateSnapshot.nullDataPayloadSize,
                delta
            };
        }

        if (Object.keys(deltaStateSnapshot).length > 0) {
            return deltaStateSnapshot;
        }
    }

    // Adjust the tx size state variables given a state difference report
    //
    //  Arguments:
    //   deltaStateSnapshot [Object] {  Object describing the difference in tx size state variables
    //     numWitnessInputs: {  (optional, only returned if difference is found)
    //       current: [Number]
    //       delta: [Number]
    //     },
    //     numNonWitnessInputs: {  (optional, only returned if difference is found)
    //       current: [Number]
    //       delta: [Number]
    //     },
    //     numWitnessOutputs: {  (optional, only returned if difference is found)
    //       current: [Number]
    //       delta: [Number]
    //     },
    //     numNonWitnessOutputs: {  (optional, only returned if difference is found)
    //       current: [Number]
    //       delta: [Number]
    //     },
    //     numPubKeysMultiSigOutputs: {  (optional, only returned if difference is found)
    //       current: [Array(Number)]
    //       delta: {
    //         added: [Array(Number)],
    //         deleted: [Array(Number)]
    //     },
    //     nullDataPayloadSize: {  (optional, only returned if difference is found)
    //       current: [Number]
    //       delta: [Number]
    //     }
    //   }
    adjustState(deltaStateSnapshot) {
        // Validate arguments
        if (deltaStateSnapshot !== undefined && (typeof deltaStateSnapshot !== 'object' || deltaStateSnapshot === null)) {
            throw new TypeError('TransactionSizeState: invalid \'deltaStateSnapshot\' argument');
        }

        if (deltaStateSnapshot) {
            if (Util.isNonNullObject(deltaStateSnapshot.numWitnessInputs)) {
                this.addInputs(true, deltaStateSnapshot.numWitnessInputs.delta);
            }

            if (Util.isNonNullObject(deltaStateSnapshot.numNonWitnessInputs)) {
                this.addInputs(false, deltaStateSnapshot.numNonWitnessInputs.delta);
            }

            if (Util.isNonNullObject(deltaStateSnapshot.numWitnessOutputs)) {
                this.addOutputs(true, deltaStateSnapshot.numWitnessOutputs.delta);
            }

            if (Util.isNonNullObject(deltaStateSnapshot.numNonWitnessOutputs)) {
                this.addOutputs(false, deltaStateSnapshot.numNonWitnessOutputs.delta);
            }

            if (Util.isNonNullObject(deltaStateSnapshot.numPubKeysMultiSigOutputs) && Util.isNonNullObject(deltaStateSnapshot.numPubKeysMultiSigOutputs.delta)) {
                if (Array.isArray(deltaStateSnapshot.numPubKeysMultiSigOutputs.delta.added)) {
                    deltaStateSnapshot.numPubKeysMultiSigOutputs.delta.added.forEach(numPubKeys => this.addMultiSigOutput(numPubKeys));
                }

                if (Array.isArray(deltaStateSnapshot.numPubKeysMultiSigOutputs.delta.deleted)) {
                    deltaStateSnapshot.numPubKeysMultiSigOutputs.delta.deleted.forEach(numPubKeys => this.addMultiSigOutput(-numPubKeys));
                }
            }

            if (Util.isNonNullObject(deltaStateSnapshot.nullDataPayloadSize)) {
                this.setNullDataPayloadSize(deltaStateSnapshot.nullDataPayloadSize.current);
            }
        }
    }

    clone() {
        return fixClone(Util.cloneObj(this));
    }


    // Internal object methods
    //

    _initState(stateSnapshot) {
        this._numWitnessInputs = stateSnapshot.numWitnessInputs;
        this._numNonWitnessInputs = stateSnapshot.numNonWitnessInputs;
        this._numWitnessOutputs = stateSnapshot.numWitnessOutputs;
        this._numNonWitnessOutputs = stateSnapshot.numNonWitnessOutputs;
        this._numPubKeysMultiSigOutputs = stateSnapshot.numPubKeysMultiSigOutputs;
        this._nullDataPayloadSize = stateSnapshot.nullDataPayloadSize;
    }

    _initStateFromTransaction() {
        this._numWitnessInputs = this.transact.countWitnessInputs();
        this._numNonWitnessInputs = this.transact.countNonWitnessInputs();
        this._numWitnessOutputs = this.transact.countP2WPKHOutputs();
        this._numNonWitnessOutputs = this.transact.countP2PKHOutputs();
        this._numPubKeysMultiSigOutputs = this.transact.getNumPubKeysMultiSigOutputs();
        this._nullDataPayloadSize = this.transact.nullDataPayloadSize;

        this.isDynamic = false;
    }

    //  Arguments:
    //   save [Boolean]  Indicates whether newly taken state snapshot should be saved
    //
    //  Return:
    //   stateSnapshot: {
    //     numWitnessInputs: [Number],
    //     numNonWitnessInputs: [Number],
    //     numWitnessOutputs: [Number],
    //     numNonWitnessOutputs: [Number],
    //     numPubKeysMultiSigOutputs: [Array(Number)],
    //     nullDataPayloadSize: [Number]
    //   }
    //
    _takeStateSnapshot(save = false) {
        const stateSnapshot = {
            numWitnessInputs: this.numWitnessInputs,
            numNonWitnessInputs: this.numNonWitnessInputs,
            numWitnessOutputs: this.numWitnessOutputs,
            numNonWitnessOutputs: this.numNonWitnessOutputs,
            numPubKeysMultiSigOutputs: Util.cloneObjArray(this.numPubKeysMultiSigOutputs),
            nullDataPayloadSize: this.nullDataPayloadSize
        };

        if (save) {
            this.stateSnapshot = stateSnapshot;
        }

        return stateSnapshot;
    }
}


// Definition of module (private) functions
//

function checkPositiveIntegerArray(a) {
    const result = [];

    if (Array.isArray(a)) {
        a.forEach(val => {
            const n = checkNonNegativeInteger(val);

            if (n > 0) {
                result.push(n);
            }
        });
    }

    return result;
}

function checkNonNegativeInteger(val) {
    const n = parseInt(val);

    return Number.isNaN(n) || n < 0 ? 0 : n;
}

function fixStateSnapshot(stateSnapshot) {
    stateSnapshot.numWitnessInputs = checkNonNegativeInteger(stateSnapshot.numWitnessInputs);
    stateSnapshot.numNonWitnessInputs = checkNonNegativeInteger(stateSnapshot.numNonWitnessInputs);
    stateSnapshot.numWitnessOutputs = checkNonNegativeInteger(stateSnapshot.numWitnessOutputs);
    stateSnapshot.numNonWitnessOutputs = checkNonNegativeInteger(stateSnapshot.numNonWitnessOutputs);
    stateSnapshot.numPubKeysMultiSigOutputs = checkPositiveIntegerArray(stateSnapshot.numPubKeysMultiSigOutputs);
    stateSnapshot.nullDataPayloadSize = checkNonNegativeInteger(stateSnapshot.nullDataPayloadSize);
}

export function fixClone(clone) {
    clone._numPubKeysMultiSigOutputs = Util.cloneObjArray(clone._numPubKeysMultiSigOutputs);
    clone.stateSnapshot = _und.clone(clone.stateSnapshot);
    clone.stateSnapshot.numPubKeysMultiSigOutputs = Util.cloneObjArray(clone.stateSnapshot.numPubKeysMultiSigOutputs);

    return clone;
}


// Module code
//

// Lock class
Object.freeze(TransactionSizeState);
