/**
 * Created by claudio on 2020-02-26
 */

//console.log('[TransactionSize.js]: This code just ran.');

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
import { Catenis } from './Catenis';
import {
    TransactionSizeState,
    fixClone as baseFixClone
} from './TransactionSizeState';
import { Util } from './Util';

const signatureLength = 71;
const publicKeyLength = 33;
const publicKeyHashLength = 20;
const witnessInputSignScriptLength = 0;
const witnessInputLength =
    inputLength(witnessInputSignScriptLength);
const nonWitnessInputSignScriptLength =
    pushDataOpCodeLength(signatureLength)           // Push data op-code
    + signatureLength                               // Signature including SIGHASH byte
    + pushDataOpCodeLength(publicKeyLength)         // Push data op-code
    + publicKeyLength;                              // Public key
const nonWitnessInputLength =
    inputLength(nonWitnessInputSignScriptLength);
const witnessOutputPubKeyScriptLength = 1           // Version byte
    + pushDataOpCodeLength(publicKeyHashLength)     // Push data op-code
    + publicKeyHashLength;                          // Public key hash (witness program)
const witnessOutputLength =
    outputLength(witnessOutputPubKeyScriptLength);
const nonWitnessOutputPubKeyScriptLength = 2        // OP_DUP and OP_HASH160 op-codes
    + pushDataOpCodeLength(publicKeyHashLength)     // Push data op-code
    + publicKeyHashLength                           // Public key hash
    + 2;                                            // OP_EQUALVERIFY and OP_CHECKSIG op-codes
const nonWitnessOutputLength =
    outputLength(nonWitnessOutputPubKeyScriptLength);
const witnessInputWitnessFieldLength = 1            // Witness stack items count
    + compactSizeUIntLength(signatureLength)        // Stack item bytes count
    + signatureLength                               // Stack item #1: signature
    + compactSizeUIntLength(publicKeyLength)        // Stack item bytes count
    + publicKeyLength;                              // Stack item #2: public key
const nonWitnessInputWitnessFieldLength = 1;        // Witness stack items count
const smallestWitnessInputBaseSizeIncrement = witnessInputLength;
const smallestWitnessInputWitnessDataSizeIncrement = witnessInputWitnessFieldLength;
const smallestWitnessInputTotalSizeIncrement =
    smallestWitnessInputBaseSizeIncrement
    + smallestWitnessInputWitnessDataSizeIncrement;
const smallestWitnessInputWeightIncrement =
    3 * smallestWitnessInputBaseSizeIncrement
    + smallestWitnessInputTotalSizeIncrement;
export const smallestWitnessInputVirtualSizeIncrement =
    Math.floor(smallestWitnessInputWeightIncrement / 4);
const smallestNonWitnessInputBaseSizeIncrement = nonWitnessInputLength;
const smallestNonWitnessInputWitnessDataSizeIncrement = 0;
const smallestNonWitnessInputTotalSizeIncrement =
    smallestNonWitnessInputBaseSizeIncrement
    + smallestNonWitnessInputWitnessDataSizeIncrement;
const smallestNonWitnessInputWeightIncrement =
    3 * smallestNonWitnessInputBaseSizeIncrement
    + smallestNonWitnessInputTotalSizeIncrement;
export const smallestNonWitnessInputVirtualSizeIncrement =
    Math.floor(smallestNonWitnessInputWeightIncrement / 4);


// Definition of classes
//

// TransactionSize class
export class TransactionSize extends TransactionSizeState {
    // Constructor
    //
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
        super(txOrStateSnapshot, dynamic);

        this.deltaBaseSize = this.deltaWitnessDataSize = 0;

        this.getSizeInfo(true);
    }


    // Public object properties (getters/setters)
    //

    get numInputs() {
        return this.numWitnessInputs + this.numNonWitnessInputs;
    }

    get numOutputs() {
        return this.numWitnessOutputs + this.numNonWitnessOutputs;
    }

    get hasWitness() {
        return this.numWitnessInputs > 0;
    }

    get baseSize() {
        return this.deltaBaseSize
            + 4                                                     // Version
            + compactSizeUIntLength(this.numInputs)                 // Inputs count
            + witnessInputLength * this.numWitnessInputs            // Witness (spend P2WPKH output) inputs
            + nonWitnessInputLength * this.numNonWitnessInputs      // Non-witness (spend P2PKH output) inputs
            + compactSizeUIntLength(this.numOutputs)                // Outputs count
            + witnessOutputLength * this.numWitnessOutputs          // Witness (P2WPKH) outputs
            + nonWitnessOutputLength * this.numNonWitnessOutputs    // Non-witness (P2PKH) outputs
            + this.numPubKeysMultiSigOutputs                        // Multi-signature outputs
                .reduce((sum, numPubKeys) => sum + multiSigOutputLength(numPubKeys), 0)
            + nullDataOutputLength(this.nullDataPayloadSize)        // Nulldata output
            + 4;                                                    // Lock time
    }

    get witnessDataSize() {
        return this.deltaWitnessDataSize
            + 2                                                             // Marker & Flag bytes
            + witnessInputWitnessFieldLength * this.numWitnessInputs        // Witness field of witness (spend P2WPKH output) inputs
            + nonWitnessInputWitnessFieldLength * this.numNonWitnessInputs; // Witness field of non-witness (spend P2PKH output) inputs
    }


    // Public object methods
    //

    // Get current estimated transaction size info, including size, virtual size and weight
    //
    //  Arguments:
    //   save [Boolean]  Indicates whether current tx size info should be saved
    //
    //  Return:
    //   sizeInfo: {
    //     size: [Number],  Transaction size, in bytes, including witness data if present
    //     vsize: [Number],  Transaction virtual size, in vbytes, of transaction
    //     weight: [Number]  Transaction weight
    //   }
    getSizeInfo(save = false) {
        const baseSize = this.baseSize;
        const totalSize = this._totalSizeFromBaseSize(baseSize);
        const weight = computeTxWeight(baseSize, totalSize);

        const sizeInfo = {
            size: totalSize,
            vsize: computeTxVirtualSize(weight),
            weight
        };

        if (save) {
            this.savedSizeInfo = sizeInfo;
        }

        return sizeInfo;
    }

    // Register the real size of the transaction. This information is used to calculate a correction
    //  value that is then taken into account when returning the estimated tx size info
    //
    //  Arguments:
    //   realSizeInfo: {
    //     size: [Number],  Transaction size, in bytes, including witness data if present
    //     vsize: [Number],  Transaction virtual size, in vbytes, of transaction
    //     weight: [Number]  Transaction weight
    //   }
    setRealSize(realSizeInfo) {
        const realTotalSize = realSizeInfo.size;
        const realBaseSize = computeTxBaseSize(realTotalSize, realSizeInfo.weight);
        const realWitnessDataSize = realTotalSize - realBaseSize;

        // Make sure that realSizeInfo is consistent
        if (realWitnessDataSize < 0 || computeTxWeight(realBaseSize, realTotalSize) !== realSizeInfo.weight || (realWitnessDataSize > 0) !== this.hasWitness) {
            Catenis.logger.DEBUG('TransactionSize: inconsistent \'realSizeInfo\' argument', {
                realSizeInfo,
                hasWitness: this.hasWitness
            });
            throw new TypeError('TransactionSize: inconsistent \'realSizeInfo\' argument');
        }

        const currentUnfixedBaseSize = this.baseSize - this.deltaBaseSize;
        const currentUnfixedTotalSize = this._totalSizeFromBaseSize(currentUnfixedBaseSize, true);
        const currentUnfixedWitnessDataSize = currentUnfixedTotalSize > currentUnfixedBaseSize ? currentUnfixedTotalSize - currentUnfixedBaseSize : 0;

        let deltaBaseSize = realBaseSize - currentUnfixedBaseSize;
        let deltaWitnessDataSize = realWitnessDataSize - currentUnfixedWitnessDataSize;

        // Make sure that correction values are not inconsistent
        if (deltaBaseSize <= -currentUnfixedBaseSize || deltaWitnessDataSize < -currentUnfixedWitnessDataSize) {
            Catenis.logger.ERROR('TransactionSize: inconsistent correction values for transaction size; clearing correction values', {
                deltaBaseSize,
                deltaWitnessDataSize,
                currentUnfixedBaseSize,
                currentUnfixedWitnessDataSize
            });
            deltaWitnessDataSize = deltaBaseSize = 0;
        }

        this.deltaBaseSize = deltaBaseSize;
        this.deltaWitnessDataSize = deltaWitnessDataSize;
    }

    // Get info about estimated transaction size change when compared to last saved tx size info
    //
    //  Arguments:
    //   saveNow [Boolean]  Indicates that current tx size info should be saved
    //
    //  Return:
    //   sizeChange: {
    //     deltaSize: [Number],  Difference, in bytes, between current and last saved tx size
    //     deltaVsize: [Number],  Difference, in vbytes, between current and last saved tx virtual size
    //     deltaWeight: [Number]  Difference between current and last saved tx weight
    //   }
    getSizeChange(saveNow = false) {
        const lastSavedSizeInfo = this.savedSizeInfo;
        const currentSizeInfo = this.getSizeInfo(saveNow);

        return {
            deltaSize: currentSizeInfo.size - lastSavedSizeInfo.size,
            deltaVsize: currentSizeInfo.vsize - lastSavedSizeInfo.vsize,
            deltaWeight: currentSizeInfo.weight - lastSavedSizeInfo.weight
        };
    }

    hasSizeChanged(saveNow = false) {
        const lastSavedSizeInfo = this.savedSizeInfo;
        const currentSizeInfo = this.getSizeInfo(saveNow);

        return currentSizeInfo.size !== lastSavedSizeInfo.size;
    }

    hasVirtualSizeChanged(saveNow = false) {
        const lastSavedSizeInfo = this.savedSizeInfo;
        const currentSizeInfo = this.getSizeInfo(saveNow);

        return currentSizeInfo.vsize !== lastSavedSizeInfo.vsize;
    }

    hasWeightChanged(saveNow = false) {
        const lastSavedSizeInfo = this.savedSizeInfo;
        const currentSizeInfo = this.getSizeInfo(saveNow);

        return currentSizeInfo.weight !== lastSavedSizeInfo.weight;
    }

    clone() {
        const clone = baseFixClone(Util.cloneObj(this));

        clone.savedSizeInfo = _und.clone(clone.savedSizeInfo);

        return clone;
    }


    // Internal object methods
    //

    _totalSizeFromBaseSize(baseSize, unfixed = false) {
        return this.hasWitness ? baseSize + (unfixed ? this.witnessDataSize - this.deltaWitnessDataSize : this.witnessDataSize) : baseSize;
    }
}


// Definition of module (private) functions
//

// Note: compactSize (unsigned) integer is also referred to (in Bitcoin's
//      spec docs) as variable length integer (var_int)
function compactSizeUIntLength(val) {
    let byteLength = 0;

    if (val >= 0) {
        if (val <= 0xfc) {
            byteLength = 1;
        }
        else if (val <= 0xffff) {
            byteLength = 3;
        }
        else if (val <= 0xffffffff) {
            byteLength = 5;
        }
        else {
            byteLength = 9;
        }
    }

    return byteLength;
}

function pushDataOpCodeLength(dataLength) {
    let byteLength = 0;

    if (dataLength >= 0) {
        if (dataLength <= 75) {
            byteLength = 1;
        }
        else if (dataLength <= 0xff) {
            byteLength = 2;
        }
        else if (dataLength <= 0xffff) {
            byteLength = 3;
        }
        else {
            byteLength = 5;
        }
    }

    return byteLength;
}

function inputLength(signScriptLength) {
    return 36                                       // Previous outpoint (UTXO)
        + compactSizeUIntLength(signScriptLength)   // Sign script bytes count
        + signScriptLength                          // Sign script
        + 4;                                        // Sequence
}

function outputLength(pubKeyScriptLength) {
    return 8                                        // Value (amount)
        + compactSizeUIntLength(pubKeyScriptLength) // Sign script bytes count
        + pubKeyScriptLength;                       // Public key script
}

function multiSigOutputPubKeyScriptLength(numPubKeys) {
    return 1                                        // OP_<m> op-code
        + numPubKeys * (
            pushDataOpCodeLength(publicKeyLength)   // Push data op-code
            + publicKeyLength                       // Public key
        )
        + 2;                                        // OP_<n> and OP_CHECKMULTISIG op-codes
}

function multiSigOutputLength(numPubKeys) {
    return outputLength(multiSigOutputPubKeyScriptLength(numPubKeys));
}

function nullDataOutputPubScriptLength(dataLength) {
    return 1                                        // OP_RETURN op-code
        + pushDataOpCodeLength(dataLength)          // Push data op-code
        + dataLength;                               // The data to embed
}

function nullDataOutputLength(dataLength) {
    return dataLength > 0 ? outputLength(nullDataOutputPubScriptLength(dataLength)) : 0;
}

function computeTxWeight(baseSize, totalSize) {
    return baseSize * 3 + totalSize;
}

function computeTxVirtualSize(weight) {
    return Math.ceil(weight / 4);
}

function computeTxBaseSize(totalSize, weight) {
    return Math.round((weight - totalSize) / 3);
}


// Module code
//

// Lock class
Object.freeze(TransactionSize);
