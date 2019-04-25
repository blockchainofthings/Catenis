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
import { Transaction } from './Transaction';
import { Catenis } from './Catenis';
import { Util } from './Util';

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
    // Arguments:
    //  opts [Object] {  - (optional)
    //    paymentResolution: [number] - (option, default: 10) Resolution of amount, in satoshis, that should be allocated to pay for tx expenses. In other words, the allocated amount should be a multiple of this amount
    //    initNumTxInputs: [number, integer] - (optional, default: 1) Initial number of transaction inputs
    //    initNumTxOutputs: [number, integer] - (optional, default: 2) Initial number of transaction outputs
    //    initNumPubKeysMultiSigTxOutputs: [Array(number)] - (optional, default: empty) List with number of public keys in each multi-signature output of the transaction
    //    initTxNullDataPayloadSize: [number, integer] - (optional, default: 0) Initial size of payload of null data output of transaction
    //    txFeeRateIncrement: [number, integer] - (optional, default: 1) Fee rate increment to use, in satoshis
    //    initTxFee: [number, integer] - (option, default: 0) Initial transaction fee, in satoshis. If it is specified, it is used in place of the initTxFeeRate
    //    initTxFeeRate: [number, integer] - (optional, default: 0) Initial transaction fee rate that should be used to calculate tx fee, in satoshis per byte
    //  }
    constructor (opts) {
        this.paymentResolution = 10;
        this.numTxInputs = 1;
        this.numTxOutputs = 2;
        this.numPubKeysMultiSigTxOutputs = [];
        this.txNullDataPayloadSize = 0;
        this.fee = 0;
        this.feeRate = 0;
        this.txFeeRateIncrement = 1;
        this.initTxFeeRate = this.txFeeRateIncrement;

        if (typeof opts === 'object' && opts !== null) {
            if (typeof opts.paymentResolution === 'number') {
                this.paymentResolution = parseInt(opts.paymentResolution);
            }

            if (typeof opts.initNumTxInputs === 'number') {
                this.numTxInputs = parseInt(opts.initNumTxInputs);
            }

            if (typeof opts.initNumTxOutputs === 'number') {
                this.numTxOutputs = parseInt(opts.initNumTxOutputs);
            }

            if (Array.isArray(opts.initNumPubKeysMultiSigTxOutputs)) {
                this.numPubKeysMultiSigTxOutputs = opts.initNumPubKeysMultiSigTxOutputs;
            }

            if (typeof opts.initTxNullDataPayloadSize === 'number') {
                this.txNullDataPayloadSize = parseInt(opts.initTxNullDataPayloadSize);
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
        this.txSize = new TxSize(this.txNullDataPayloadSize, this.numTxInputs, this.numTxOutputs, this.numPubKeysMultiSigTxOutputs);

        if (this.fee !== 0) {
            // Use fee that had been initially set and calculate fee rate from it
            this.feeRate = Math.floor(this.fee / this.txSize.max);
        }

        // Make sure to calculate new fee next time getNewTxFee is called
        this.recalculateFeeForced = false;
        this.feeRateChanged = true;
        this.txSizeChanged = false;

        this.newFee = this.fee;
        this.newFeeRate = this.feeRate;

        Object.defineProperty(this, 'needRecalculateFee', {
            get: function () {
                return this.recalculateFeeForced || this.txSizeChanged || this.feeRateChanged;
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

    setNumTxInputs(num) {
        this.incrementNumTxInputs(num - this.numTxInputs);
    }

    setNumTxOutputs(num) {
        this.incrementNumTxOutputs(num - this.numTxOutputs);
    }

    incrementNumTxInputs(inc) {
        inc = parseInt(inc);

        if (inc !== 0) {
            this.numTxInputs += inc;

            // Adjust transaction size
            this.txSize.addInputs(inc);
            this.txSizeChanged = true;
        }
    }

    incrementNumTxOutputs(inc) {
        inc = parseInt(inc);

        if (inc !== 0) {
            this.numTxOutputs += inc;

            // Adjust transaction size
            this.txSize.addOutputs(inc);
            this.txSizeChanged = true;
        }
    }

    addMultiSigOutput(numPubKeys) {
        if (numPubKeys !== 0) {
            let numOutputsChanged = false;

            if (numPubKeys > 0) {
                this.numPubKeysMultiSigTxOutputs.push(numPubKeys);
                numOutputsChanged = true;
            }
            else {
                // Remove first multi-signature output that has the number of public keys specified
                const absNumPubKeys = -numPubKeys;

                this.numPubKeysMultiSigTxOutputs.some((numPubKeysOutput, idx, list) => {
                    if (numPubKeysOutput === absNumPubKeys) {
                        list.splice(idx, 1);
                        numOutputsChanged = true;

                        return true;
                    }

                    return false;
                })
            }

            if (numOutputsChanged) {
                // Adjust transaction size
                this.txSize.addMultiSigOutput(numPubKeys);
                this.txSizeChanged = true;
            }
        }
    }

    setNullDataPayloadSize(newPayloadSize) {
        if (newPayloadSize !== this.txNullDataPayloadSize) {
            this.txNullDataPayloadSize = newPayloadSize;

            // Adjust transaction size
            this.txSize.setNullDataPayloadSize(newPayloadSize);
            this.txSizeChanged = true;
        }
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
            this.newFeeRate = Math.floor(this.newFee / this.txSize.max);

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

    // DEPRECATED
    setRealTxSize(size, countInputs = 0) {
        size = parseInt(size);

        const oldMaxTxSize = this.txSize.max;

        this.txSize.setRealSize(size, countInputs);

        if (this.txSize.max !== oldMaxTxSize) {
            // Reset transaction fee
            this.feeRate = Math.floor(this.fee / this.txSize.max);
        }
    }

    updateTxInfo(transact) {
        const txRealSize = transact.realSize();

        if (txRealSize !== undefined) {
            this.txSize.checkRealSize(txRealSize);

            this.numTxInputs = transact.countInputs();
            this.numTxOutputs = transact.countP2PKHOutputs();
            this.numPubKeysMultiSigTxOutputs = transact.getNumPubKeysMultiSigOutputs();
            this.txNullDataPayloadSize = transact.nullDataPayloadSize;
            this.fee = transact.feeAmount();
            this.feeRate = Math.floor(this.fee / txRealSize);
            this.txSize = new TxSize(this.txNullDataPayloadSize, this.numTxInputs, this.numTxOutputs, this.numPubKeysMultiSigTxOutputs);
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
}

// Auxiliary class used to compute estimated transaction size which can vary since
//  the exact size of an input (that spends a P2PKH output) is not determinist,
//  but can rather variate from -1 to +1 byte
class TxSize {
    constructor (nullDataPayloadSize, initNumInputs = 0, initNumOutputs = 0, numPubKeysMultiSigOutputs) {
        this.nullDataPayloadSize = nullDataPayloadSize;
        this.min = this.max = this.avrg = 0;

        if (initNumInputs !== 0) {
            this.addInputs(initNumInputs);
        }

        if (initNumOutputs !== 0) {
            this.addOutputs(initNumOutputs);
        }

        numPubKeysMultiSigOutputs.forEach((numPubKeys) => {
            this.addMultiSigOutput(numPubKeys);
        })
    }

    clone() {
        return Util.cloneObj(this);
    }

    addInputs(count) {
        if (this.avrg === 0) {
            this.min = this.max = this.avrg = Transaction.computeTransactionSize(0, 0, this.nullDataPayloadSize);
        }

        const sizeInc = Transaction.txInputSize * count;

        this.avrg += sizeInc;
        this.min += sizeInc;
        this.max += sizeInc;

        if (count > 0) {
            this.min -= count;
            this.max += count;
        }
        else if (count < 0) {
            this.min += count;
            this.max -= count;
        }
    }

    addOutputs(count) {
        if (this.avrg === 0) {
            this.min = this.max = this.avrg = Transaction.computeTransactionSize(0, 0, this.nullDataPayloadSize);
        }

        const sizeInc = Transaction.txOutputSize * count;

        this.avrg += sizeInc;
        this.min += sizeInc;
        this.max += sizeInc;
    }

    addMultiSigOutput(numPubKeys) {
        if (this.avrg === 0) {
            this.min = this.max = this.avrg = Transaction.computeTransactionSize(0, 0, this.nullDataPayloadSize);
        }

        const sizeInc = Math.sign(numPubKeys) * Transaction.multiSigOutputSize(Math.abs(numPubKeys));

        this.avrg += sizeInc;
        this.min += sizeInc;
        this.max += sizeInc;
    }

    setNullDataPayloadSize(newPayloadSize) {
        const sizeInc = Transaction.nullDataOutputSize(newPayloadSize) - Transaction.nullDataOutputSize(this.nullDataPayloadSize);

        this.nullDataPayloadSize = newPayloadSize;

        if (this.avrg === 0) {
            this.min = this.max = this.avrg = Transaction.computeTransactionSize(0, 0, this.nullDataPayloadSize);
        }

        this.avrg += sizeInc;
        this.min += sizeInc;
        this.max += sizeInc;
    }

    // DEPRECATED
    setRealSize(size, countInputs = 0) {
        // Note: allow a variation of +/- countInputs if real size had already been set previously (min = max = avrg)
        if ((size >= this.min && size <= this.max) || (this.min === this.max && this.max === this.avrg
                && countInputs > 0 && size >= this.min - countInputs && size <= this.max + countInputs)) {
            this.min = this.max = this.avrg = size;
        }
        else {
            // Trying to set transaction real size to a value that is not within expected range.
            //  Log warning condition
            Catenis.logger.WARN('Trying to set transaction real size to a value that is not within expected range', {
                txMinSize: this.min,
                txMaxSize: this.max,
                realSize: size
            });
        }
    }

    checkRealSize(size) {
        if (size < this.min || size > this.max) {
            // Transaction real size is not within expected range.
            //  Log warning condition
            Catenis.logger.WARN('RBF transaction info: transaction real size is not within expected range', {
                txMinSize: this.min,
                txMaxSize: this.max,
                realSize: size
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
    this.txSizeChanged = this.feeRateChanged = this.recalculateFeeForced = false;
}

function calculateFee() {
    // Calculate new fee
    this.newFeeRate = this.feeRate === 0 ? this.initTxFeeRate : this.feeRate + this.txFeeRateIncrement;
    this.newFee = Util.roundToResolution(this.newFeeRate * this.txSize.max, this.paymentResolution);

    // Make sure that new fee is larger than latest confirmed fee
    if (this.newFee <= this.fee) {
        this.newFee =  Util.roundToResolution(this.fee + this.paymentResolution, this.paymentResolution);
    }

    // Make sure that difference in fee is not below minimum acceptable fee difference
    const minDeltaFee = Math.ceil(this.txSize.max / cfgSettings.minDeltaFeeRate);

    if (this.newFee - this.fee < minDeltaFee) {
        this.newFee = Util.roundToResolution(this.fee + minDeltaFee, this.paymentResolution);
    }

    this.newFeeRate = Math.floor(this.newFee / this.txSize.max);
}
