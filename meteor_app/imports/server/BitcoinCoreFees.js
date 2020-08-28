/**
 * Created by claudio on 2020-08-27
 */

//console.log('[BitcoinCoreFees.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import EventEmitter from 'events';
// Third-party node modules
import config from 'config';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { Meteor } from "meteor/meteor";

// Config entries
const btcCoreFeesConfig = config.get('bitcoinCoreFees');

// Configuration settings
const cfgSettings = {
    getFeeRatesInterval: btcCoreFeesConfig.get('getFeeRatesInterval'),
    initMonitorBlocksToConfirm: btcCoreFeesConfig.get('initMonitorBlocksToConfirm')
};

const averageTimeBetweenBlocks = 10;    // Average time, in minutes, between confirmed blocks


// Definition of classes
//

// BitcoinCoreFees class
export class BitcoinCoreFees extends EventEmitter {
    // Class (public) properties
    //

    static notifyEvent = Object.freeze({
        bitcoin_fees_changed: Object.freeze({
            name: 'bitcoin_fees_changed',
            description: 'Estimate bitcoin fee rates for transactions have changed'
        })
    });


    // Constructor
    //

    constructor() {
        super();

        this.feeRateByBlocksToConfirm = new Map(cfgSettings.initMonitorBlocksToConfirm.map(blocksToConfirm => [blocksToConfirm, undefined]));

        this._getCurrentFeeRates();

        // Set recurring timer to retrieve current bitcoin fees
        Catenis.logger.TRACE('Setting recurring timer to get current bitcoin fee rates');
        this.getFeeRatesIntervalHandle = Meteor.setInterval(this._getCurrentFeeRates.bind(this), cfgSettings.getFeeRatesInterval);
    }


    // Private object methods
    //

    _getCurrentFeeRates() {
        let feeRateChanged = false;

        Array.from(this.feeRateByBlocksToConfirm.keys()).forEach(blocksToConfirm => {
            let estimateResult;

            try {
                estimateResult = Catenis.bitcoinCore.estimateSmartFee(blocksToConfirm);
            }
            catch (err) {
                Catenis.logger.ERROR('Unable to get fee estimate for tx to confirm in %d blocks', blocksToConfirm);
            }

            if (estimateResult) {
                feeRateChanged = this._checkFeeRateChanged(estimateResult.blocks, convertFeeRate(estimateResult.feerate));
            }
        });

        if (feeRateChanged) {
            // Emit event notifying that bitcoin fee rates have changed
            this.emit(BitcoinCoreFees.notifyEvent.bitcoin_fees_changed.name, this.feeRateByBlocksToConfirm);
        }
    }
    
    _checkFeeRateChanged(blocksToConfirm, feeRate) {
        let changed = false;
        
        if (!this.feeRateByBlocksToConfirm.has(blocksToConfirm) || this.feeRateByBlocksToConfirm.get(blocksToConfirm) !== feeRate) {
            // Fee rate changed. Save it
            this.feeRateByBlocksToConfirm.set(blocksToConfirm, feeRate);
            changed = true;
        }
        
        return changed;
    }

    // Public object methods
    //

    getFeeRateByTime(minutesToConfirm) {
        return this.getFeeRateForBlocksToConfirm(Math.ceil(minutesToConfirm / averageTimeBetweenBlocks));
    }

    getFeeRateForBlocksToConfirm(blocksToConfirm) {
        let estimateResult;

        try {
            estimateResult = Catenis.bitcoinCore.estimateSmartFee(blocksToConfirm);
        }
        catch (err) {
            Catenis.logger.ERROR('Unable to get fee estimate for tx to confirm in %d blocks.', blocksToConfirm, err);
        }

        if (estimateResult) {
            const feeRate = convertFeeRate(estimateResult.feerate);

            if (this._checkFeeRateChanged(estimateResult.blocks, feeRate)) {
                // Emit event notifying that bitcoin fee rates have changed
                this.emit(BitcoinCoreFees.notifyEvent.bitcoin_fees_changed.name, this.feeRateByBlocksToConfirm);
            }

            return feeRate;
        }
        else {
            // Could not get current fee rate. Return the most suited from the saved ones
            const targetBlocks = blocksToConfirm <= 1 ? 2 : blocksToConfirm;
            const key = Array.from(this.feeRateByBlocksToConfirm.keys())
            .sort((k1, k2) => k2 - k1)
            .find(k => k <= targetBlocks);

            return this.feeRateByBlocksToConfirm.get(key);
        }
    }

    getOptimumFeeRate() {
        return this.getFeeRateForBlocksToConfirm(2);
    }


    // Class (public) methods
    //

    static initialize() {
        Catenis.logger.TRACE('BitcoinCoreFees initialization');
        Catenis.bitcoinFees = new BitcoinCoreFees();
    }
}


// Definition of module (private) functions
//

// TODO: consider replacing the fee rate unit used throughout Catenis from satoshi/byte to satoshi/kB
//  (1,000 bytes) so that the tx fee can be more precisely calculated
// Convert fee rate from BTC/KB to satoshi/byte
function convertFeeRate(feeRate) {
    return Math.ceil(feeRate * 100000);
}


// Module code
//

// Lock class
Object.freeze(BitcoinCoreFees);
