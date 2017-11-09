/**
 * Created by claudio on 13/07/17.
 */

//console.log('[RbfTransactionInfo.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//  NOTE: the reference of these modules are done using 'require()' instead of 'import' to
//      to avoid annoying WebStorm warning message: 'default export is not defined in
//      imported module'
//const util = require('util');
// Third-party node modules
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Service } from './Service';
import { Transaction } from './Transaction';
import { Catenis } from './Catenis';

// Definition of classes
//

// RbfTransactionInfo class
export class RbfTransactionInfo {
    // Arguments:
    //  opts [Object] {  - (optional)
    //    initNumTxInputs: [number, integer] - (optional, default: 1) Initial number of transaction inputs
    //    initNumTxOutputs: [number, integer] - (optional, default: 2) Initial number of transaction outputs
    //    txNullDataPayloadSize: [number, integer] - (optional, default: 0) Size of payload of null data output of transaction
    //    txFeeRateIncrement: [number, integer] - (optional, default: 1) Fee rate increment to use, in satoshis
    //    initTxFee: [number, integer] - (option, default: 0) Initial transaction fee, in satoshis. If it is specified, it is used in place of the initTxFeeRate
    //    initTxFeeRate: [number, integer] - (optional, default: 0) Initial transaction fee rate that should be used to calculate tx fee, in satoshis per byte
    //  }
    constructor (opts) {
        this.numTxInputs = 1;
        this.numTxOutputs = 2;
        this.txNullDataPayloadSize = 0;
        this.fee = 0;
        this.feeRate = 0;
        this.txFeeRateIncrement = 1;
        this.initTxFeeRate = this.txFeeRateIncrement;

        if (typeof opts === 'object' && opts !== null) {
            if (typeof opts.initNumTxInputs === 'number') {
                this.numTxInputs = parseInt(opts.initNumTxInputs);
            }

            if (typeof opts.initNumTxOutputs === 'number') {
                this.numTxOutputs = parseInt(opts.initNumTxOutputs);
            }

            if (typeof opts.txNullDataPayloadSize === 'number') {
                this.txNullDataPayloadSize = parseInt(opts.txNullDataPayloadSize);
            }

            if (typeof opts.initTxFee === 'number') {
                this.fee = Math.ceil(opts.initTxFee / Service.readConfirmPaymentResolution) * Service.readConfirmPaymentResolution;
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
        this.txSize = new TxSize(this.txNullDataPayloadSize, this.numTxInputs, this.numTxOutputs);

        if (this.fee !== 0) {
            // Use fee that had been initially set and calculate fee rate from it
            this.feeRate = Math.floor(this.fee / this.txSize.max);
        }

        // Make sure to calculate new fee next time getNewTxFee is called
        this.feeRateChanged = true;
        this.txSizeChanged = false;

        this.newFee = this.fee;
        this.newFeeRate = this.feeRate;

        Object.defineProperty(this, 'needRecalculateFee', {
            get: function () {
                return this.txSizeChanged || this.feeRateChanged;
            },
            enumerable: false
        });
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
        fee = Math.ceil(fee / Service.readConfirmPaymentResolution) * Service.readConfirmPaymentResolution;

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

    setRealTxSize(size, countInputs = 0) {
        size = parseInt(size);

        const oldMaxTxSize = this.txSize.max;

        this.txSize.setRealSize(size, countInputs);

        if (this.txSize.max > oldMaxTxSize) {
            // Reset transaction fee
            this.feeRate = Math.floor(this.fee / this.txSize.max);
        }
    }
}

// Auxiliary class used to compute estimated transaction size which can vary since
//  the exact size of an input (that spends a P2PKH output) is not determinist,
//  but can rather variate from -1 to +1 byte
class TxSize {
    constructor (nullDataPayloadSize, initNumInputs = 0, initNumOutputs = 0) {
        this.nullDataPayloadSize = nullDataPayloadSize;
        this.min = this.max = this.avrg = 0;

        if (initNumInputs !== 0) {
            this.addInputs(initNumInputs);
        }

        if (initNumOutputs !== 0) {
            this.addOutputs(initNumOutputs);
        }
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
}


// Module functions used to simulate private Class_name object methods
//  NOTE: these functions need to be bound to a Class_name object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

function clearRecalculateFeeFlag() {
    this.txSizeChanged = this.feeRateChanged = false;
}

function calculateFee() {
    // Calculate new fee
    this.newFeeRate = this.feeRate === 0 ? this.initTxFeeRate : this.feeRate + this.txFeeRateIncrement;
    this.newFee = Math.ceil((this.newFeeRate * this.txSize.max) / Service.readConfirmPaymentResolution) * Service.readConfirmPaymentResolution;

    // Make sure that new fee is larger than latest confirmed fee
    if (this.newFee <= this.fee) {
        this.newFee = this.fee + Service.readConfirmPaymentResolution;
    }

    this.newFeeRate = Math.floor(this.newFee / this.txSize.max);
}
