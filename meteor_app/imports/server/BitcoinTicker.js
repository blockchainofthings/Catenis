/**
 * Created by claudio on 2020-01-27
 */

//console.log('[BitcoinTicker.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import config from 'config';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { BitcoinAverageBitcoinTicker } from './BitcoinAverageBitcoinTicker';
import { GeminiBitcoinTicker } from './GeminiBitcoinTicker';

// Config entries
const btcTickerConfig = config.get('bitcoinTicker');

// Configuration settings
const cfgSettings = {
    mainImplementation: btcTickerConfig.get('mainImplementation'),
    minCheckRevertMainInstanceTimeout: btcTickerConfig.get('minCheckRevertMainInstanceTimeout'),
    maxCheckRevertMainInstanceTimeout: btcTickerConfig.get('maxCheckRevertMainInstanceTimeout')
};


// Definition of classes
//

// BitcoinTicker class
export class BitcoinTicker {
    static implementations = Object.freeze({
        bitcoinAverage: Object.freeze({
            name: 'bitcoinAverage',
            description: 'Bitcoin ticker implementation using BitcoinAverage web services',
            class: BitcoinAverageBitcoinTicker
        }),
        gemini: Object.freeze({
            name: 'gemini',
            description: 'Bitcoin ticker implementation using Gemini web services',
            class: GeminiBitcoinTicker
        })
    });

    constructor() {
        // Instantiate all available implementations
        this.instances = [];

        Object.keys(BitcoinTicker.implementations).forEach(key => {
            const implementInfo = BitcoinTicker.implementations[key];

            this.instances.push({
                info: implementInfo,
                object: implementInfo.class.instantiate()
            });

            if (implementInfo.name === cfgSettings.mainImplementation) {
                this.mainInstanceIdx = this.instances.length - 1;
            }
        });

        if (!this.mainInstanceIdx) {
            this.mainInstanceIdx = 0;
        }

        this.numInstances = this.instances.length;

        this.currentInstanceIdx = this.mainInstanceIdx;
        this.startInstanceIdx = undefined;
        this.backupInstanceIdxInUse = undefined;

        this.boundCheckRevertMainInstance = checkRevertMainInstance.bind(this);

        this.timeToCheckRevertMainInstance = 0;
        this.checkRevertMainInstanceTimeout = undefined;

        this.getTickerCounter = 0;
        this.pendingCheckRevertMainInstance = false;
    }

    getTicker() {
        this.getTickerCounter++;
        let result;

        try {
            this.startInstanceIdx = this.currentInstanceIdx;

            let instance = this.instances[this.currentInstanceIdx].object;
            let instanceChanged = false;

            do {
                try {
                    result = instance.getTicker(!(this.backupInstanceIdxInUse && this.currentInstanceIdx === this.mainInstanceIdx));
                }
                catch (err) {
                    instance = this._getNextInstance();
                    instanceChanged = true;
                }
            }
            while (!result && instance);

            if (!result) {
                Catenis.logger.ERROR('Failed to retrieve bitcoin ticker');
                // Reset state and throw exception
                this.currentInstanceIdx = this.mainInstanceIdx;
                this.startInstanceIdx = undefined;
                this.backupInstanceIdxInUse = undefined;

                this._stopCheckRevertMainInstance();
                this.timeToCheckRevertMainInstance = 0;

                throw new Error('Failed to retrieve bitcoin ticker');
            }


            if (this.currentInstanceIdx === this.mainInstanceIdx && this.backupInstanceIdxInUse) {
                // Call to main instance succeeded. So indicate that no backup instance is in use anymore
                Catenis.logger.WARN('Reverted back to main bitcoin ticker implementation', this.instances[this.currentInstanceIdx].info);

                // Stop timer to revert back to main bitcoin ticker instance
                this._stopCheckRevertMainInstance();
            }
            else  if (instanceChanged && (!this.backupInstanceIdxInUse || this.backupInstanceIdxInUse !== this.currentInstanceIdx)) {
                Catenis.logger.WARN('A new bitcoin ticker implementation is currently in use', this.instances[this.currentInstanceIdx].info);
                if (this.currentInstanceIdx !== this.mainInstanceIdx && !this.checkRevertMainInstanceTimeout) {
                    // Start timer to revert back to main bitcoin ticker instance
                    this._startCheckRevertMainInstance();
                }
            }

            // Reset indication that we are trying to revert back to main bitcoin ticker instance
            this.backupInstanceIdxInUse = undefined;
        }
        finally {
            this.getTickerCounter--;
        }

        if (this.getTickerCounter === 0 && this.pendingCheckRevertMainInstance) {
            this.pendingCheckRevertMainInstance = false;
            this._doCheckRevertMainInstance();
        }

        return result;
    }

    _getNextInstance() {
        let nextInstanceIdx = undefined;

        if (this.currentInstanceIdx === this.mainInstanceIdx && this.backupInstanceIdxInUse) {
            nextInstanceIdx = this.backupInstanceIdxInUse;
        }
        else {
            const nextIndex = this._getNextIndex(this.currentInstanceIdx);

            if (nextIndex !== this.startInstanceIdx) {
                nextInstanceIdx = nextIndex;
            }
        }

        return nextInstanceIdx !== undefined ? this.instances[this.currentInstanceIdx = nextInstanceIdx].object : null;
    }

    _getNextIndex(idx) {
        return (idx + 1) % this.numInstances;
    }

    _startCheckRevertMainInstance() {
        Catenis.logger.TRACE('Starting timer to revert back to main bitcoin ticker instance');
        // Make sure that timer is not on
        if (this.checkRevertMainInstanceTimeout) {
            Meteor.clearTimeout(this.checkRevertMainInstanceTimeout);
        }

        // Start timer to revert back main bitcoin ticker instance
        this.timeToCheckRevertMainInstance = cfgSettings.minCheckRevertMainInstanceTimeout;
        this.checkRevertMainInstanceTimeout = Meteor.setTimeout(this.boundCheckRevertMainInstance, this.timeToCheckRevertMainInstance);
    }

    _stopCheckRevertMainInstance() {
        Catenis.logger.TRACE('Stopping timer to revert back to main bitcoin ticker instance');
        // Make sure that timer is still on
        if (this.checkRevertMainInstanceTimeout) {
            Meteor.clearTimeout(this.checkRevertMainInstanceTimeout);
            this.checkRevertMainInstanceTimeout = undefined;
        }
    }

    _doCheckRevertMainInstance() {
        if (this.currentInstanceIdx !== this.mainInstanceIdx) {
            // Main bitcoin ticker instance is not currently in use.
            //  Try to revert back to it
            Catenis.logger.DEBUG('Try to revert back to main bitcoin ticker implementation');
            this.backupInstanceIdxInUse = this.currentInstanceIdx;
            this.currentInstanceIdx = this.mainInstanceIdx;

            // Restart timer to revert back to main bitcoin ticker instance
            if (this.timeToCheckRevertMainInstance < cfgSettings.maxCheckRevertMainInstanceTimeout) {
                if (this.timeToCheckRevertMainInstance === 0) {
                    this.timeToCheckRevertMainInstance = cfgSettings.minCheckRevertMainInstanceTimeout;
                }
                else {
                    this.timeToCheckRevertMainInstance += this.timeToCheckRevertMainInstance;

                    if (this.timeToCheckRevertMainInstance > cfgSettings.maxCheckRevertMainInstanceTimeout) {
                        this.timeToCheckRevertMainInstance = cfgSettings.maxCheckRevertMainInstanceTimeout;
                    }
                }
            }

            this.checkRevertMainInstanceTimeout = Meteor.setTimeout(this.boundCheckRevertMainInstance, this.timeToCheckRevertMainInstance);
        }
    }

    static initialize() {
        Catenis.logger.TRACE('BitcoinTicker initialization');
        Catenis.btcTicker = new BitcoinTicker();
    }
}


// Module functions used to simulate private BitcoinTicker object methods
//  NOTE: these functions need to be bound to a BitcoinTicker object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

function checkRevertMainInstance() {
    // Make sure that timer is still on
    if (this.checkRevertMainInstanceTimeout) {
        this.checkRevertMainInstanceTimeout = undefined;

        if (this.getTickerCounter === 0) {
            this._doCheckRevertMainInstance();
        }
        else {
            // noinspection JSUnusedGlobalSymbols
            this.pendingCheckRevertMainInstance = true;
        }
    }
}


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock class
Object.freeze(BitcoinTicker);
