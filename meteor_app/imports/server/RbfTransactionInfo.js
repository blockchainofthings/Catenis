/**
 * Created by Claudio on 2017-07-13.
 */

//console.log('[RbfTransactionInfo.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import config from 'config';
import _und from 'underscore';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { Util } from './Util';
import { TransactionSize } from './TransactionSize';

// Config entries
const rbfTransactInfoConfig = config.get('rbfTransactionInfo');

// Configuration settings
const cfgSettings = {
    minDeltaFeeRate: rbfTransactInfoConfig.get('minDeltaFeeRate')
};


// Definition of classes
//

// RbfTransactionInfo class
export class RbfTransactionInfo {
    //  Arguments:
    //   iniTxOrTxSzStSnapshot [Object] {  Either an instance of the Transaction class (or any of its derived classes) or a snapshot object with the current tx size state (as defined below).
    //                                      Optionally, an instance of the TransactionSizeState class can be passed in place of a state snapshot. In that case, its current tx size state is used.
    //                                      If not set, the state is cleared
    //     numWitnessInputs: [Number],                  (optional, default: 0)
    //     numNonWitnessInputs: [Number],               (optional, default: 0)
    //     numWitnessOutputs: [Number],                 (optional, default: 0)
    //     numNonWitnessOutputs: [Number],              (optional, default: 0)
    //     numPubKeysMultiSigOutputs: [Array(Number)],  (optional, default: empty Array)
    //     nullDataPayloadSize: [Number]                (optional, default: 0)
    //   }
    //   opts [Object] {  - (optional)
    //     paymentResolution: [number] - (option, default: 10) Resolution of amount, in satoshis, that should be allocated to pay for tx expenses. In other words, the allocated amount should be a multiple of this amount
    //     txFeeRateIncrement: [number, integer] - (optional, default: 1) Fee rate increment to use, in satoshis
    //     initTxFee: [number, integer] - (option, default: 0) Initial transaction fee, in satoshis. If it is specified, it is used in place of the initTxFeeRate
    //     initTxFeeRate: [number, integer] - (optional, default: 0) Initial transaction fee rate that should be used to calculate tx fee, in satoshis per byte
    //   }
    constructor (iniTxOrTxSzStSnapshot, opts) {
        this.paymentResolution = 10;
        this.fee = 0;
        this.feeRate = 0;
        this.txFeeRateIncrement = 1;
        this.initTxFeeRate = this.txFeeRateIncrement;

        if (typeof opts === 'object' && opts !== null) {
            if (typeof opts.paymentResolution === 'number') {
                this.paymentResolution = parseInt(opts.paymentResolution);
            }

            if (typeof opts.initTxFee === 'number') {
                this.fee = opts.initTxFee;
            }
            else {
                if (typeof opts.initTxFeeRate === 'number') {
                    this.initTxFeeRate = parseInt(opts.initTxFeeRate);
                }
            }

            if (typeof opts.txFeeRateIncrement === 'number') {
                this.txFeeRateIncrement = parseInt(opts.txFeeRateIncrement);
            }
        }

        // Compute initial transaction size
        this.txSize = new TransactionSize(iniTxOrTxSzStSnapshot, false);

        if (this.fee !== 0) {
            // Use fee that had been initially set and calculate fee rate from it
            this.feeRate = Math.floor(this.fee / this.txSize.getSizeInfo().vsize);
        }

        // Make sure to calculate new fee next time getNewTxFee is called
        this.recalculateFeeForced = false;
        this.feeRateChanged = true;

        this.newFee = this.fee;
        this.newFeeRate = this.feeRate;

        //  NOTE: arrow functions should NOT be used for the getter/setter of the defined properties.
        //      This is to avoid that, if `this` is referred from within the getter/setter body, it
        //      refers to the object from where the properties have been defined rather than to the
        //      object from where the property is being accessed. Normally, this does not represent
        //      an issue (since the object from where the property is accessed is the same object
        //      from where the property has been defined), but it is especially dangerous if the
        //      object can be cloned.
        Object.defineProperty(this, 'needRecalculateFee', {
            get: function () {
                return this.recalculateFeeForced || this.txSize.hasVirtualSizeChanged() || this.feeRateChanged;
            },
            enumerable: false
        });
    }

    clone() {
        const clone = Util.cloneObj(this);

        clone.numPubKeysMultiSigTxOutputs = _und.clone(clone.numPubKeysMultiSigTxOutputs);
        clone.txSize = clone.txSize.clone();

        return clone;
    }

    // Add or remove one or more tx inputs
    //
    //  Arguments:
    //   isWitness [Boolean]  Indicates whether inputs to add/remove are of a segregated witness type (spend a P2WPKH
    //                         output) or not (spend a P2PKH outputs)
    //   count [Number]  The number of inputs to add/remove. If count is a positive number, inputs as added. Otherwise,
    //                    if count is a negative number, inputs are removed
    addInputs(isWitness, count) {
        this.txSize.addInputs(isWitness, count);
    }

    // Add or remove one or more tx outputs paying to a single (public key hash) address
    //
    //  Arguments:
    //   isWitness [Boolean]  Indicates whether outputs to add/remove are of a segregated witness type (spend a P2WPKH
    //                         output) or not (spend a P2PKH outputs)
    //   count [Number]  The number of outputs to add/remove. If count is a positive number, outputs as added. Otherwise,
    //                    if count is a negative number, outputs are removed
    addOutputs(isWitness, count) {
        this.txSize.addOutputs(isWitness, count);
    }

    // Add or remove one multi-signature tx output
    //
    //  Arguments:
    //   numPubKeys [Number]  Number of public keys that can (potentially) spend this output. If numPubKeys is a
    //                         positive number, a new output is added. Otherwise, if numPubKeys is a negative
    //                         number, the first multi-signature output with that many public keys (if any) is removed
    addMultiSigOutput(numPubKeys) {
        this.txSize.addMultiSigOutput(numPubKeys);
    }

    // Set the size of the data embedded in the nulldata output
    //
    //  Arguments:
    //   payloadSize [Number]  The size, in bytes, of the data embedded in the nulldata output. If payloadSize is
    //                          zero, no nulldata output is present
    setNullDataPayloadSize(payloadSize) {
        this.txSize.setNullDataPayloadSize(payloadSize);
    }

    forceRecalculateFee() {
        this.recalculateFeeForced = true;
    }

    resetFeeRate(rate) {
        rate = parseInt(rate);

        // Make sure to discount fee rate increment because it is
        //  added next time a new tx fee is retrieved
        if (rate - this.txFeeRateIncrement > this.feeRate) {
            this.feeRate = rate - this.txFeeRateIncrement;
            this.feeRateChanged = true;
        }
    }

    checkResetFeeRate(rate) {
        rate = parseInt(rate);

        // Adjust fee rate to reset if it is not large enough
        if (rate - this.txFeeRateIncrement <= this.feeRate) {
            rate = this.feeRate + (2 * this.txFeeRateIncrement);
        }

        this.resetFeeRate(rate);
    }

    adjustNewTxFee(fee) {
        if (fee >= this.newFee) {
            this.newFee = fee;
            this.newFeeRate = Math.floor(this.newFee / this.txSize.getSizeInfo().vsize);

            clearRecalculateFeeFlag.call(this);
        }
    }

    confirmTxFee() {
        // Reset latest confirmed fee and fee rate
        this.fee = this.newFee;
        this.feeRate = this.newFeeRate;
    }

    getNewTxFee() {
        if (this.needRecalculateFee) {
            calculateFee.call(this);
            clearRecalculateFeeFlag.call(this);
        }

        return {
            fee: this.newFee,
            feeRate: this.newFeeRate
        };
    }

    getConfirmedTxFee() {
        return {
            fee: this.fee,
            feeRate: this.feeRate
        }
    }

    updateTxInfo(transact) {
        const realTxSizeInfo = transact.realSize();

        if (realTxSizeInfo !== undefined) {
            this.checkRealTxSizeInfo(realTxSizeInfo);

            this.fee = transact.feeAmount();
            this.feeRate = Math.floor(this.fee / realTxSizeInfo.vsize);

            this.txSize = new TransactionSize(transact, false);
            this.txSize.setRealSize(realTxSizeInfo);

            this.newFee = this.fee;
            this.newFeeRate = this.feeRate;
            clearRecalculateFeeFlag.call(this);
        }
        else {
            // Transaction real size not available.
            //  Log error condition and throw exception
            Catenis.logger.ERROR('Cannot update RBF transaction info: transaction real size not available', {
                rbfTxInfo: this,
                transact: transact
            });
            throw new Error('Cannot update RBF transaction info: transaction real size not available');
        }
    }

    checkRealTxSizeInfo(realTxSizeInfo) {
        let currentTxSizeInfo = this.txSize.getSizeInfo();

        if (realTxSizeInfo.size !== currentTxSizeInfo.size || realTxSizeInfo.weight !== currentTxSizeInfo.weight) {
            // Real transaction size is different than estimated size.
            //  Log warning condition
            Catenis.logger.WARN('RBF transaction info: real transaction size is different than estimated size', {
                realTxSizeInfo,
                currentTxSizeInfo
            });
        }
    }
}


// Module functions used to simulate private Class_name object methods
//  NOTE: these functions need to be bound to a Class_name object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

function clearRecalculateFeeFlag() {
    this.feeRateChanged = this.recalculateFeeForced = false;

    // Reset saved tx size info
    this.txSize.getSizeInfo(true);
}

function calculateFee() {
    // Calculate new fee
    this.newFeeRate = this.feeRate === 0 ? this.initTxFeeRate : this.feeRate + this.txFeeRateIncrement;
    const txVsize = this.txSize.getSizeInfo().vsize;
    this.newFee = Util.roundToResolution(this.newFeeRate * txVsize, this.paymentResolution);

    // Make sure that new fee is larger than latest confirmed fee
    if (this.newFee <= this.fee) {
        this.newFee =  Util.roundToResolution(this.fee + this.paymentResolution, this.paymentResolution);
    }

    // Make sure that difference in fee is not below minimum acceptable fee difference
    const minDeltaFee = Math.ceil(txVsize / cfgSettings.minDeltaFeeRate);

    if (this.newFee - this.fee < minDeltaFee) {
        this.newFee = Util.roundToResolution(this.fee + minDeltaFee, this.paymentResolution);
    }

    this.newFeeRate = Math.floor(this.newFee / txVsize);
}
