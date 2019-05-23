/**
 * Created by claudio on 2019-05-10.
 */

//console.log('[AncestorTransactions.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
//import config from 'config';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { cfgSettings as fundSrcCfgSettings } from './FundSource';
import { BitcoinCore } from './BitcoinCore';
import { Util } from './Util';

// Config entries
/*const config_entryConfig = config.get('config_entry');

// Configuration settings
const cfgSettings = {
    property: config_entryConfig.get('property_name')
};*/


// Definition of classes
//

// AncestorTransactions class
export class AncestorTransactions {
    // Class constructor
    //
    //  Arguments:
    //   options: {
    //     ancestorsCountLimit: [Number], - (optional) Total number of ancestor transactions that can be included.
    //                                       Note: can be set to `null` to indicate that no limit should be applied
    //     ancestorsSizeLimit: [Number], - (optional) Total size, in bytes, of included ancestor transactions
    //                                       Note: can be set to `null` to indicate that no limit should be applied
    //     mempoolTxInfoCache: [Object(Map)], - (optional) A map object used to store retrieved memory pool entry info
    //     initTxInputs: [Array(Object)|Object] [{ - (optional) Transaction inputs (or a single input) to be used to
    //                                                initialize included ancestor transactions
    //       txout: {
    //         txid: [String],
    //         ...
    //       }
    //       ...
    //     }]
    //   }
    constructor (options) {
        this.ancestorRefCounter = new Map();
        this.ancestorsSize = 0;
        this.ancestorsCountLimit = fundSrcCfgSettings.maxAncestorsCount - 1;
        this.ancestorsSizeLimit = fundSrcCfgSettings.maxAncestorsSize - 1000;
        this.mempoolTxInfoCache = undefined;

        if (options) {
            if (options.ancestorsCountLimit !== undefined) {
                this.ancestorsCountLimit = options.ancestorsCountLimit;
            }

            if (options.ancestorsSizeLimit !== undefined) {
                this.ancestorsSizeLimit = options.ancestorsSizeLimit;
            }

            if (options.mempoolTxInfoCache instanceof Map) {
                this.mempoolTxInfoCache = options.mempoolTxInfoCache;
            }

            if (options.initTxInputs) {
                const initTxInputs = Array.isArray(options.initTxInputs) ? options.initTxInputs : [options.initTxInputs];

                if (initTxInputs.length > 0) {
                    initAncestors.call(this, initTxInputs);
                }
            }
        }
    }

    // Instance properties

    get ancestorsCount() {
        return this.ancestorRefCounter.size;
    }

    // Instance (public) methods

    clone() {
        const clone = Util.cloneObj(this);

        clone.ancestorRefCounter = new Map(clone.ancestorRefCounter);

        // Note: since this.mempoolTxInfoCache is only used during the initialization phase,
        //  there is no need to deep clone it

        return clone;
    }

    // Check if UTXO could be accepted as an additional tx fund source (input). In other words,
    //  make sure that the ancestors limits are not surpassed if UTXO is accepted
    //
    //  Arguments:
    //   utxo: [Object] {
    //     txid: [string],
    //     size: [number],
    //     ancestors: [array(object)] [{
    //       txid: [string],
    //       size: [number]
    //     }]
    //   }
    //
    //  Return: [Boolean]
    canAcceptUtxo(utxo) {
        if (utxo.confirmations) {
            // UTXO transaction has already been confirmed. So simply return
            //  indicating that it can be accepted
            return true;
        }

        const uniqueAncestors = getUniqueAncestors.call(this, utxo);

        if (uniqueAncestors.length > 0) {
            if (this.ancestorsCountLimit === null || this.ancestorsCountLimit - this.ancestorsCount >= uniqueAncestors.length) {
                const uniqueAncestorsSize = uniqueAncestors.reduce((size, ancestor) => size + ancestor.size, 0);

                if (this.ancestorsSizeLimit === null || this.ancestorsSizeLimit - this.ancestorsSize >= uniqueAncestorsSize) {
                    return true;
                }
            }
        }
        else {
            return true;
        }

        return false;
    }

    // Include the ancestor transactions associated with the specified UTXO
    //
    //  Arguments:
    //   utxo: [Object] {
    //     txid: [string],
    //     size: [number],
    //     ancestors: [array(object)] [{
    //       txid: [string],
    //       size: [number]
    //     }]
    //   }
    //   logError: [Boolean] - (optional) Indicates whether an error message should be logged if UTXO cannot be accepted
    addUtxo(utxo, logError = true) {
        if (utxo.confirmations) {
            // UTXO transaction has already been confirmed. Nothing to do
            return;
        }

        // Make sure that UTXO can be accepted
        if (!this.canAcceptUtxo(utxo)) {
            // Trying to add an UTXO that cannot be accepted
            if (logError) {
                //  Log error and throw exception
                Catenis.logger.ERROR('Trying to add UTXO that cannot be accepted due to ancestors limitations', {
                    fundSourceAncestors: this,
                    utxo: utxo
                });
            }
            throw new Meteor.Error('fund_src_ancestors_not_accepted', 'Trying to add UTXO that cannot be accepted due to ancestors limitations');
        }

        const addAncestor = (ancestor) => {
            if (this.ancestorRefCounter.has(ancestor.txid)) {
                // Ancestor transaction already included. Only increment reference counter
                this.ancestorRefCounter.set(ancestor.txid, this.ancestorRefCounter.get(ancestor.txid) + 1);
            }
            else {
                // Include ancestor transaction
                this.ancestorRefCounter.set(ancestor.txid, 1);
                this.ancestorsSize += ancestor.size;
            }
        };

        // First add the UTXO transaction itself
        addAncestor(utxo);

        // Then its ancestor transactions
        utxo.ancestors.forEach(addAncestor);
    }

    // Check if ancestor transactions associated with the specified UTXO can be accepted
    //  and include them if so
    //
    //  Arguments:
    //   utxo: [Object] {
    //     txid: [string],
    //     size: [number],
    //     ancestors: [array(object)] [{
    //       txid: [string],
    //       size: [number]
    //     }]
    //   }
    //
    //  Return: [Boolean] - true if ancestor transactions were included, false otherwise indicating that
    //                       UTXO cannot be accepted
    checkAddUtxo(utxo) {
        try {
            this.addUtxo(utxo, false);
        }
        catch (err) {
            if ((err instanceof Meteor.Error) && err.error === 'fund_src_ancestors_not_accepted') {
                return false;
            }

            throw err;
        }

        return true;
    }

    // Remove the ancestor transactions associated with the specified UTXO
    //
    //  Arguments:
    //   utxo: [Object] {
    //     txid: [string],
    //     size: [number],
    //     ancestors: [array(object)] [{
    //       txid: [string],
    //       size: [number]
    //     }]
    //   }
    //   strictRemove: [Boolean] - Indicates that UTXO to remove is expected to be currently included
    removeUtxo(utxo, strictRemove = true) {
        if (utxo.confirmations) {
            // UTXO transaction has already been confirmed. Nothing to do
            return;
        }

        const removeAncestor = (ancestor) => {
            // Get ancestor reference counter
            let refCount = this.ancestorRefCounter.get(ancestor.txid);

            if (refCount !== undefined) {
                if (refCount > 0) {
                    // Decrement reference counter
                    if (--refCount > 0) {
                        // Update reference counter
                        this.ancestorRefCounter.set(ancestor.txid, refCount);
                    }
                    else {
                        // No more reference count; exclude ancestor transaction
                        this.ancestorsSize -= ancestor.size;
                        this.ancestorRefCounter.delete(ancestor.txid);
                    }

                    return true;
                }
                else {
                    // Inconsistent reference counter. Log error condition
                    Catenis.logger.ERROR('Inconsistent ancestor transaction reference counter', {
                        fundSourceAncestors: this,
                        ancestor: ancestor
                    });
                }
            }
            else if (strictRemove) {
                // No reference counter found for ancestor transaction. Log warning condition
                Catenis.logger.WARN('Trying to remove ancestor transaction with no reference counter', {
                    fundSourceAncestors: this,
                    ancestor: ancestor
                });
            }

            return false;
        };

        // First remove the UTXO transaction itself
        if (removeAncestor(utxo)) {
            // Then (if succeeds) its ancestor transactions
            utxo.ancestors.forEach(removeAncestor);
        }
    }

    // Static (class) methods
}


// Module functions used to simulate private AncestorTransactions object methods
//  NOTE: these functions need to be bound to a AncestorTransactions object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

// Return ancestor transactions associated with UTXO (including the UTXO transaction itself)
//  that are not yet included
//
//  Arguments:
//   utxo: [Object] {
//     txid: [string],
//     size: [number],
//     ancestors: [array(object)] [{
//       txid: [string],
//       size: [number]
//     }]
//   }
function getUniqueAncestors(utxo) {
    const uniqueAncestors = utxo.ancestors.filter(ancestor => !this.ancestorRefCounter.has(ancestor.txid));

    if (!this.ancestorRefCounter.has(utxo.txid)) {
        uniqueAncestors.push({
            txid: utxo.txid,
            size: utxo.size
        });
    }

    return uniqueAncestors;
}

function initAncestors(txInputs) {
    // Identify unique tx IDs
    const txIdCount = new Map();

    txInputs.forEach((txInput) => {
        if (txIdCount.has(txInput.txout.txid)) {
            txIdCount.set(txInput.txout.txid, txIdCount.get(txInput.txout.txid) + 1);
        }
        else {
            txIdCount.set(txInput.txout.txid, 1);
        }
    });

    for ([txid, count] of txIdCount) {
        let mempoolTxInfo;

        try {
            // Check if transaction is in memory pool and get its information
            mempoolTxInfo = Catenis.bitcoinCore.getMempoolEntryWithAncestors(txid, false);
        }
        catch (err) {
            if ((err instanceof Meteor.Error) && err.error === 'ctn_btcore_rpc_error' && err.details !== undefined && typeof err.details.code === 'number') {
                // Error returned from calling Bitcoin Core API method
                if (err.details.code === BitcoinCore.rpcErrorCode.RPC_INVALID_ADDRESS_OR_KEY) {
                    // Transaction of UTXO not in mempool. Indicate it by setting tx info to null
                    mempoolTxInfo = null;
                }
                else {
                    // Log error from calling Bitcoin Core API method, and throws exception
                    Catenis.logger.DEBUG(err.reason, err.details);
                }
            }

            if (mempoolTxInfo !== null) {
                // Log error condition
                Catenis.logger.ERROR('Error retrieving memory pool entry for initializing fund source ancestors.', err);
            }
        }

        if (mempoolTxInfo) {
            // Add UTXO associated with tx input(s) the corresponding number of times
            for (let idx = 0; idx < count; idx++) {
                const utxo = {
                    txid: txid,
                    size: mempoolTxInfo.size,
                    ancestors: mempoolTxInfo.ancestors
                };

                if (!this.checkAddUtxo(utxo)) {
                   // Inconsistent condition trying to add initial UTXOs. Log error condition
                   Catenis.logger.ERROR('Inconsistent condition: UTXO for initial tx input cannot be accepted', {
                       fundSourceAncestors: this,
                       utxo: utxo
                   });
                }
            }

            if (this.mempoolTxInfoCache) {
                // Save memory pool entry for transaction
                this.mempoolTxInfoCache.set(txid, mempoolTxInfo);
            }
        }
        else if (mempoolTxInfo === null && this.mempoolTxInfoCache) {
            // Save record indicating that tx is not in memory pool
            this.mempoolTxInfoCache.set(txid, null);
        }
    }
}

// AncestorTransactions class (public) properties
//

/*AncestorTransactions.prop = {};*/


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock class
Object.freeze(AncestorTransactions);
