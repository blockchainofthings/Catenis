/**
 * Created by claudio on 05/10/17.
 */

//console.log('[CCFundSource.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import Loki from 'lokijs';
// noinspection JSFileReferences
import BigNumber from 'bignumber.js';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { CriticalSection } from './CriticalSection';
import { Util } from './Util';
import { BitcoinCore } from './BitcoinCore';
import { cfgSettings } from './FundSource';
import { CCTransaction } from './CCTransaction';


// Definition of function classes
//

// CCFundSource function class
//
//  Argument description:
//    ccAssetId [String] - Colored Coins attributed ID of asset that should be used for the funding
//    addresses [String|Array(String)] - Addresses to be used as the fund source
//    options { - (optional)
//      unconfUtxoInfo: {  - (optional) To be used in case unconfirmed UTXOs should be used as the fund source
//        ancestorsCountDiff: [Number], - (optional) Amount to be deducted from maximum count of (unconfirmed) ancestor txs for tx to be accepted into mempool (to be relayed).
//                                         The resulting amount shall be used as an upper limit to filter UTXOs that should be used as fund source
//                                         - if not defined, a default diff of 1 (one) is used, so the upper limit is set to (maxCount-1)
//                                         - if a non-negative value is passed, the upper limit is set to (maxCount-value)
//                                         - if a negative value is passed, no upper limit is set (all UTXOs are used)
//        ancestorsSizeDiff: [Number], - (optional) Amount to be deducted from maximum size (in bytes) of (unconfirmed) ancestor txs for tx to be accepted into mempool (to be relayed).
//                                        The resulting amount shall be used as an upper limit to filter UTXOs that should be used as fund source
//                                        - if not defined, a default diff of 1000 (1K) is used, so the upper limit is set to (maxSize-1000)
//                                        - if a non-negative value is passed, the upper limit is set to (maxSize-value)
//                                        - if a negative value is passed, no upper limit is set (all UTXOs are used)
//        descendantsCountDiff: [Number], - (optional) Amount to be deducted from maximum count of (unconfirmed) descendant txs for tx to be accepted into mempool (to be relayed).
//                                           The resulting amount shall be used as an upper limit to filter UTXOs that should be used as fund source
//                                           - if not defined, a default diff of 1 (one) is used, so the upper limit is set to (maxCount-1)
//                                           - if a non-negative value is passed, the upper limit is set to (maxCount-value)
//                                           - if a negative value is passed, no upper limit is set (all UTXOs are used)
//        descendantsSizeDiff: [Number] - (optional) Amount to be deducted from maximum size (in bytes) of (unconfirmed) descendant txs for tx to be accepted into mempool (to be relayed).
//                                         The resulting amount shall be used as an upper limit to filter UTXOs that should be used as fund source
//                                         - if not defined, a default diff of 1000 (1K) is used, so the upper limit is set to (maxSize-1000)
//                                         - if a non-negative value is passed, the upper limit is set to (maxSize-value)
//                                         - if a negative value is passed, no upper limit is set (all UTXOs are used)
//      },
//      smallestChange: [boolean], - (optional, default: false) Indicates that the allocated UTXOs will favor the smallest change amount, if the exact amount is not met
//                                    Note: this option only takes effect if the 'higherAmountUtxos' is not set
//      higherAmountUtxos: [boolean], - (optional, default: false) Indicates whether UTXOs containing higher amounts should be preferably allocated (or, in other words, do not look for exact amount)
//      excludeUtxos: [string|Array(string)], - (optional) List of UTXOs (formatted as "txid:n") that should not be taken into account when allocating new UTXOs
//                                               (because those UTXOs are associated with txs that use opt-in RBF (Replace By Fee) as such can be replaced by
//                                               other txs and have their own outputs invalidated)
//      selectUnconfUtxos: [string|Array(string)], - (optional) List of unconfirmed UTXOs (formatted as "txid:n") that should be taken into consideration even though unconfirmed
//                                                   UTXOs has not been set to be used as the fund source
//      addUtxoTxInputs: [Object|Array(Object)] - (optional) List of transaction input objects (the same as used by the inputs property of the Transaction object)
//                                                  the UTXOs spent by them should be added to the list of available UTXOs. These inputs should belong transactions
//                                                  that use opt-in RBF that are being replaced
//    }
//
// NOTE: make sure that objects of this function class are instantiated and used (their methods
//  called) from code executed from the CCFundSource.utxoCS critical section object
export function CCFundSource(ccAssetId, addresses, options) {
    // Initialize in-memory database to hold UTXOs
    //  Structure of collUtxo collection: {
    //      address: [string],
    //      txid: [string],
    //      vout: [number],
    //      scriptPubKey: [string],
    //      amount: [number],      - Bitcoin amount in satoshis
    //      ccAssetId: [string],  - Colored Coins attributed ID of asset
    //      assetAmount: [number], - Asset amount represented as an integer number of the asset's smallest division (according to the asset divisibility)
    //      assetDivisibility: [number], - Number of decimal places allowed for representing quantities of this asset
    //      isAggregatableAsset: [boolean], - Indicates whether quantities of the asset from different UTXOs can be combined to allocate the necessary fund
    //      confirmations: [number],
    //      allocated: [boolean],   // Local control
    //      ancestorsCount: [number],   // Should only exist for confirmations = 0
    //      ancestorsSize: [number],   // Should only exist for confirmations = 0
    //      descendantsCount: [number],   // Should only exist for confirmations = 0
    //      descendantsSize: [number]   // Should only exist for confirmations = 0
    //  }
    this.db = new Loki();
    // noinspection JSCheckFunctionSignatures
    this.collUtxo = this.db.addCollection('UTXO', {
        unique: [
            'txout'
        ],
        indices: [
            'address',
            'assetAmount',
            'confirmations',
            'allocated',
            'ancestorsCount',
            'ancestorsSize',
            'descendantsCount',
            'descendantsSize'
        ]
    });

    this.ccAssetId = ccAssetId;
    this.addresses = Array.isArray(addresses) ? addresses : [addresses];

    this.useUnconfirmedUtxo = false;
    this.smallestChange = false;
    this.higherAmountUtxos = false;

    if (options !== undefined) {
        if (options.unconfUtxoInfo !== undefined) {
            this.useUnconfirmedUtxo = true;

            this.ancestorsCountUpperLimit = options.unconfUtxoInfo.ancestorsCountDiff === undefined ? cfgSettings.maxAncestorsCount - 1 : (options.unconfUtxoInfo.ancestorsCountDiff >= 0 ? cfgSettings.maxAncestorsCount - options.unconfUtxoInfo.ancestorsCountDiff : undefined);
            this.ancestorsSizeUpperLimit = options.unconfUtxoInfo.ancestorsSizeDiff === undefined ? cfgSettings.maxAncestorsSize - 1000 : (options.unconfUtxoInfo.ancestorsSizeDiff >= 0 ? cfgSettings.maxAncestorsSize - options.unconfUtxoInfo.ancestorsSizeDiff : undefined);
            this.descendantsCountUpperLimit = options.unconfUtxoInfo.descendantsCountDiff === undefined ? cfgSettings.maxDescendantsCount - 1 : (options.unconfUtxoInfo.descendantsCountDiff >= 0 ? cfgSettings.maxDescendantsCount - options.unconfUtxoInfo.descendantsCountDiff : undefined);
            this.descendantsSizeUpperLimit = options.unconfUtxoInfo.descendantsSizeDiff === undefined ? cfgSettings.maxDescendantsSize - 1000 : (options.unconfUtxoInfo.descendantsSizeDiff >= 0 ? cfgSettings.maxDescendantsSize - options.unconfUtxoInfo.descendantsSizeDiff : undefined);
        }

        if (options.smallestChange !== undefined) {
            this.smallestChange = !!options.smallestChange;
        }

        if (options.higherAmountUtxos !== undefined) {
            this.higherAmountUtxos = !!options.higherAmountUtxos;
        }

        if (options.excludeUtxos !== undefined) {
            this.excludedUtxos = new Set(options.excludeUtxos);
        }

        if (options.selectUnconfUtxos !== undefined) {
            this.selectUnconfUtxos = new Set(options.selectUnconfUtxos);
        }

        // Note: it is important that this be the last options processed so it is done as close to
        //  the loading of UTXOs as possible
        if (options.addUtxoTxInputs !== undefined) {
            // Compute list of additional UTXOs to consider
            this.additionalUtxos = computeAdditionalUtxos(options.addUtxoTxInputs);
        }
    }

    if (addresses.length > 0) {
        // Load UTXOs into local DB
        this.loadedUnconfirmedUtxos = false;

        loadUtxos.call(this);
    }
}


// Public CCFundSource object methods
//

CCFundSource.prototype.getBalance = function (includeUnconfirmed = true, includeAllocated = false) {
    const conditions = [];

    if (includeUnconfirmed && this.loadedUnconfirmedUtxos) {
        if (this.ancestorsCountUpperLimit !== undefined) {
            conditions.push({ancestorsCount: {$lte: this.ancestorsCountUpperLimit}});
        }

        if (this.ancestorsSizeUpperLimit !== undefined) {
            conditions.push({ancestorsSize: {$lte: this.ancestorsSizeUpperLimit}});
        }

        if (this.descendantsCountUpperLimit !== undefined) {
            conditions.push({descendantsCount: {$lte: this.descendantsCountUpperLimit}});
        }

        if (this.descendantsSizeUpperLimit !== undefined) {
            conditions.push({descendantsSize: {$lte: this.descendantsSizeUpperLimit}});
        }
    }
    else {
        conditions.push({confirmations: {$gt: 0}});
    }

    if (!includeAllocated) {
        conditions.push({allocated: false});
    }

    const query = conditions.length > 1 ? {$and: conditions} : conditions[0];

    return this.collUtxo.find(query).reduce((sum, docUtxo) => {
        if (this.isAggregatableAsset) {
            // Return the accumulated asset amount in all UTXOs
            sum += docUtxo.assetAmount;
        }
        else {
            // Asset cannot be aggregated; return the highest asset amount from all UTXOs
            if (docUtxo.assetAmount > sum) {
                sum = docUtxo.assetAmount;
            }
        }

        return sum;
    }, 0);
};

//  Arguments:
//   amount [Number] - Asset amount to be allocated represented as an integer number of the asset's smallest division (according to the asset divisibility)
//
//  result: {
//    utxos: [{
//      address: [String],
//      txout: {
//        txid: [String],
//        vout: [Number],
//        amount: [Number],      - Bitcoin amount in satoshis
//        assetAmount: [Number], - Asset amount represented as an integer number of the asset's smallest division (according to the asset divisibility)
//        assetDivisibility: [Number], - Number of decimal places allowed for representing quantities of this asset
//        isAggregatableAsset: [Boolean] - Indicates whether quantities of the asset from different UTXOs can be combined to allocate the necessary fund
//      },
//      scriptPubKey: [String]
//    }],
//    changeAssetAmount: [Number]  - Only returned if there is change from the allocated asset amount, also represented as an
//                                    integer number of the asset's smallest division (according to the asset divisibility)
//  }
//
CCFundSource.prototype.allocateFund = function (amount) {
    let result = null;

    if (amount > 0) {
        const utxoResultSets = [];
        let maxUtxoResultSetLength = 0;

        // Retrieve only confirmed UTXOs sorting them by higher value, and higher confirmations
        const confUtxoResultSet = this.collUtxo.chain().find({
            $and: [{
                allocated: false
            }, {
                confirmations: {
                    $gt: 0
                }
            }]
        }).compoundsort([
            ['assetAmount', true],
            ['confirmations', true]
        ]).data();

        if (confUtxoResultSet.length > 0) {
            utxoResultSets.push(confUtxoResultSet);
            maxUtxoResultSetLength = confUtxoResultSet.length;
        }

        if (this.loadedUnconfirmedUtxos) {
            // Retrieve both confirmed and unconfirmed UTXOs sorting them by higher value, higher confirmations,
            //  lower ancestors count (for unconfirmed UTXOs), lower ancestors size (for unconfirmed UTXOs),
            //  lower descendants count (for unconfirmed UTXOs), lower descendants size (for unconfirmed UTXOs)
            const conditions = [{allocated: false}];

            if (this.ancestorsCountUpperLimit !== undefined) {
                conditions.push({ancestorsCount: {$lte: this.ancestorsCountUpperLimit}});
            }

            if (this.ancestorsSizeUpperLimit !== undefined) {
                conditions.push({ancestorsSize: {$lte: this.ancestorsSizeUpperLimit}});
            }

            if (this.descendantsCountUpperLimit !== undefined) {
                conditions.push({descendantsCount: {$lte: this.descendantsCountUpperLimit}});
            }

            if (this.descendantsSizeUpperLimit !== undefined) {
                conditions.push({descendantsSize: {$lte: this.descendantsSizeUpperLimit}});
            }

            const query = conditions.length > 1 ? {$and: conditions} : conditions[0],
                unconfUtxoResultSet = this.collUtxo.chain().find(query).compoundsort([
                    ['assetAmount', true],
                    ['confirmations', true],
                    'ancestorsCount',
                    'ancestorsSize',
                    'descendantsCount',
                    'descendantsSize'
                ]).data();

            if (unconfUtxoResultSet.length > 0) {
                utxoResultSets.push(unconfUtxoResultSet);
                maxUtxoResultSetLength = unconfUtxoResultSet.length > maxUtxoResultSetLength ? unconfUtxoResultSet.length : maxUtxoResultSetLength;
            }
        }

        if (maxUtxoResultSetLength > 0) {
            let allocatedUtxos = undefined;

            // Try to allocate as little UTXOs as possible to fulfill requested amount, starting
            //  with one UTXO, and going up to the number of UTXOs returned in result sets.
            //  NOTE: for assets that cannot be aggregated, restrict that number of allocated UTXOs
            //      to only ONE
            for (let numWorkUtxos = 1, limitNumWorkUtxos = this.isAggregatableAsset ? maxUtxoResultSetLength : 1;
                    numWorkUtxos <= limitNumWorkUtxos; numWorkUtxos++) {
                if ((allocatedUtxos = allocateUtxos.call(this, amount, utxoResultSets, numWorkUtxos)) !== undefined) {
                    // UTXOs successfully allocated. Stop trying
                    break;
                }
            }

            if (allocatedUtxos !== undefined) {
                // UTXOs have been allocated. Prepare to return result
                let allocatedAmount = 0;
                result = {utxos: []};

                allocatedUtxos.docUtxos.forEach((docUtxo) => {
                    result.utxos.push({
                        address: docUtxo.address,
                        txout: {
                            txid: docUtxo.txid,
                            vout: docUtxo.vout,
                            amount: docUtxo.amount,
                            ccAssetId: docUtxo.ccAssetId,
                            assetAmount: docUtxo.assetAmount,
                            assetDivisibility: docUtxo.assetDivisibility,
                            isAggregatableAsset: docUtxo.isAggregatableAsset
                        },
                        scriptPubKey: docUtxo.scriptPubKey
                    });
                    allocatedAmount += docUtxo.assetAmount;
                    docUtxo.allocated = true;
                });

                // Change asset amount (represented as an integer number of the asset's smallest division)
                result.changeAssetAmount = allocatedAmount - amount;

                // Update local DB setting UTXOs as allocated
                // noinspection JSIgnoredPromiseFromCall
                this.collUtxo.update(allocatedUtxos.docUtxos);

                // NOTE: force the rebuild of the binary index on the 'allocated' property to work around
                //  an issue found with Lokijs (https://github.com/techfort/LokiJS/issues/639)
                this.collUtxo.ensureIndex('allocated', true);
            }
        }
    }
    else {
        // Indicate that there is no need to allocated additional UTXOs
        result = {utxos: []};
    }

    return result;
};

CCFundSource.prototype.clearAllocatedUtxos = function () {
    const docAllocatedUtxos = this.collUtxo.find({allocated: true});

    if (docAllocatedUtxos.length > 0) {
        // noinspection JSCheckFunctionSignatures
        docAllocatedUtxos.forEach((docUtxo) => {
            docUtxo.allocated = false;
        });

        // noinspection JSIgnoredPromiseFromCall
        this.collUtxo.update(docAllocatedUtxos);
    }
};


// Module functions used to simulate private CCFundSource object methods
//  NOTE: these functions need to be bound to a CCFundSource object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

function isExcludedUtxo(utxo) {
    const txout = Util.txoutToString(utxo);

    return (this.excludedUtxos !== undefined && this.excludedUtxos.has(txout))
        || (utxo.confirmations === 0 && !this.useUnconfirmedUtxo && !this.selectUnconfUtxos.has(txout));
}

function insertUtxo(utxo, assetUtxoInfo, unconfTxids) {
    // Store relevant asset info
    let inconsistentAssetUtxoInfo = false;

    if (this.assetDivisibility === undefined) {
        this.assetDivisibility = assetUtxoInfo.divisibility;
    }
    else if (this.assetDivisibility !== assetUtxoInfo.divisibility) {
        // Asset divisibility info inconsistent amongst UTXOs.
        //   Log warning condition and indicate that UTXO is inconsistent
        Catenis.logger.WARN('Asset divisibility info inconsistent amongst UTXOs. Current UTXO being discarded', {
            addresses: this.addresses,
            expectedAssetDivisibility: this.assetDivisibility,
            currentUtxo: utxo
        });
        inconsistentAssetUtxoInfo = true;
    }

    const isAggregatableAsset = assetUtxoInfo.aggregationPolicy === CCTransaction.aggregationPolicy.aggregatable;

    if (this.isAggregatableAsset === undefined) {
        this.isAggregatableAsset = isAggregatableAsset;
    }
    else if (this.isAggregatableAsset !== isAggregatableAsset) {
        // Asset aggregation info inconsistent amongst UTXOs.
        //   Log warning condition and indicate that UTXO is inconsistent
        Catenis.logger.WARN('Asset aggregation info inconsistent amongst UTXOs. Current UTXO being discarded', {
            addresses: this.addresses,
            expectedIsAggregatableAsset:this.isAggregatableAsset,
            currentUtxo: utxo
        });
        inconsistentAssetUtxoInfo = true;
    }

    if (!inconsistentAssetUtxoInfo) {
        this.collUtxo.insert({
            txout: Util.txoutToString(utxo),
            address: utxo.address,
            txid: utxo.txid,
            vout: utxo.vout,
            scriptPubKey: utxo.scriptPubKey,
            amount: new BigNumber(utxo.amount).times(100000000).toNumber(),
            ccAssetId: this.ccAssetId,
            assetAmount: assetUtxoInfo.amount,
            assetDivisibility: assetUtxoInfo.divisibility,
            isAggregatableAsset: isAggregatableAsset,
            confirmations: utxo.confirmations,
            allocated: false
        });

        if (utxo.confirmations === 0) {
            // Store unconfirmed transaction ID
            unconfTxids.add(utxo.txid);
        }
    }
}

function loadUtxos() {
    // Retrieve UTXOs associated with given addresses, including unconfirmed ones if requested
    const utxos = Catenis.c3NodeClient.getAddressesUtxos(this.addresses, this.useUnconfirmedUtxo || this.selectUnconfUtxos !== undefined ? 0 : 1);

    // Store retrieved UTXOs onto local DB making sure that only UTXOs associated with
    //  the specified asset are included, and that any excluded UTXOs are not included,
    //  and converting bitcoin amount from bitcoins to satoshis and the asset amount to its
    //  smallest division
    const unconfTxids = new Set();

    utxos.forEach((utxo) => {
        // Make sure that UTXO is not excluded, and has asset info that pertains
        //  to the specified asset
        let assetUtxoInfo;

        if (!isExcludedUtxo.call(this, utxo) && (assetUtxoInfo = getAssetUtxoInfo.call(this, utxo)) !== undefined) {
            insertUtxo.call(this, utxo, assetUtxoInfo, unconfTxids);
        }
    });

    // Check if there are additional UTXOs to be inserted
    if (this.additionalUtxos !== undefined) {
        this.additionalUtxos.forEach((utxo) => {
            // Make sure that additional UTXO has asset info that pertains to the specified
            //  asset and that it is not duplicated
            let assetUtxoInfo;

            if ((assetUtxoInfo = getAssetUtxoInfo.call(this, utxo)) !== undefined && this.collUtxo.by('txout', Util.txoutToString(utxo)) === undefined) {
                insertUtxo.call(this, utxo, assetUtxoInfo, unconfTxids);
            }
        });
    }

    if (unconfTxids.size > 0) {
        // Update descendants and ancestors info for all unconfirmed UTXO
        //  onto local DB
        const txidTxInfo = new Map();
        const txidsToDelete = new Set();

        for (let txid of unconfTxids) {
            this.collUtxo.find({txid: txid}).forEach((doc) => {
                // Retrieve memory pool entry for given unconfirmed transaction
                try {
                    const mempoolTx = Catenis.bitcoinCore.getMempoolEntry(txid, false);

                    doc.descendantsCount = mempoolTx.descendantcount;
                    doc.descendantsSize = mempoolTx.descendantsize;
                    doc.ancestorsCount = mempoolTx.ancestorcount;
                    doc.ancestorsSize = mempoolTx.ancestorsize;

                    // Indicate that unconfirmed UTXOs have been loaded
                    this.loadedUnconfirmedUtxos = true;
                }
                catch (err) {
                    if ((err instanceof Meteor.Error) && err.error === 'ctn_btcore_rpc_error' && err.details !== undefined && typeof err.details.code === 'number') {
                        // Error returned from calling Bitcoin Core API method
                        if (err.details.code === BitcoinCore.rpcErrorCode.RPC_INVALID_ADDRESS_OR_KEY) {
                            // Transaction of UTXO not in mempool; it must have been already confirmed
                            //  (in the meantime between the calls to 'CCFullNodeClient.getAddressesUtxos()'
                            //  and 'bitcoinCore.getMempoolEntry()'). So retrieve transaction information to
                            //  get confirmation status
                            Catenis.logger.DEBUG('Transaction of UTXO not in mempool', {txid: txid, vout: doc.vout});
                            let txInfo = txidTxInfo.get(txid);

                            if (txInfo === undefined) {
                                try {
                                    txInfo = Catenis.bitcoinCore.getTransaction(txid, false);
                                    txidTxInfo.set(txid, txInfo);
                                }
                                catch (err2) {
                                    Catenis.logger.ERROR('Error trying to get confirmation status of transaction (txid: %s) associated with UTXO that is not in the mempool', txid, err);
                                }
                            }

                            if (txInfo !== undefined && txInfo.confirmations > 0) {
                                // Transaction has indeed been confirmed. So prepare to update its confirmation status
                                doc.confirmations = txInfo.confirmations;
                            }
                            else {
                                // Either confirmation status could not be retrieved or it indicates that
                                //  transaction has been replaced by another one (confirmations < 0).
                                //  In either case, prepare to delete all UTXOs associated with that transaction
                                Catenis.logger.DEBUG('Set to delete all UTXOs associated with transaction', {
                                    txid: txid,
                                    confirmations: txInfo !== undefined ? txInfo.confirmations : undefined
                                });
                                txidsToDelete.add(txid);
                            }
                        }
                        else {
                            // Log error from calling Bitcoin Core API method, and throws exception
                            Catenis.logger.DEBUG(err.reason, err.details);
                            throw err;
                        }
                    }
                    else {
                        // Any other error; just rethrows it
                        throw err;
                    }
                }

                this.collUtxo.update(doc);
            });
        }

        if (txidsToDelete.size > 0) {
            // Delete UTXOs associated with transactions that are not valid
            this.collUtxo.findAndRemove({txid: {$in: Array.from(txidsToDelete.values())}});
        }
    }
}

// Arguments:
//  amount [Number] - Asset amount to be allocated represented as an integer number of the asset's smallest division (according to the asset divisibility)
//  utxoResultSets [Array(Array(doc))] - Result sets containing UTXO entries from local DB. The first result set includes only confirmed UTXOs.
//                                        The second result set contains both confirmed and unconfirmed UTXOs
//  numWorkUtxos [Number] - Number of UTXOs that should be used for allocating the requested asset amount
//  work [Object] - Object used to return the largest delta amount tried when allocation does not succeed
function allocateUtxos(amount, utxoResultSets, numWorkUtxos, work) {
    let docAllocatedUtxos = undefined,
        exactAmountAllocated = false;

    // Do processing for each of the available UTXO result sets
    for (let utxoResultSetIdx = 0; utxoResultSetIdx < utxoResultSets.length; utxoResultSetIdx++) {
        // Set current UTXO result set for processing
        const docUtxos = utxoResultSets[utxoResultSetIdx],
            numUtxos = docUtxos.length;

        // Make sure that length of current UTXO result set is large enough
        //  to accommodate current number of working UTXOs
        if (numUtxos < numWorkUtxos) {
            continue;
        }

        // Initialize reference to working UTXOs. Start working with
        //  first UTXOs from result set
        const workUtxos = [];
        let totalWorkAmount = 0;

        for (let utxoIdx = 0; utxoIdx < numWorkUtxos; utxoIdx++) {
            workUtxos.push({
                utxoIdx: utxoIdx,
                assetAmount: docUtxos[utxoIdx].assetAmount
            });
            totalWorkAmount += docUtxos[utxoIdx].assetAmount;
        }

        const lastWorkIdx = numWorkUtxos - 1;

        if (this.higherAmountUtxos) {
            if (totalWorkAmount >= amount) {
                // Total amount of working entries is enough to fulfill requested amount.
                //  Allocate corresponding UTXOs and leave
                docAllocatedUtxos = workUtxos.map((workUtxo) => {
                    return docUtxos[workUtxo.utxoIdx];
                });
                exactAmountAllocated = totalWorkAmount === amount;
            }
        }
        else {
            // Try matching exact amount (if not yet matched)
            let prevEntriesAdjusted;

            exactAmountAllocated = false;

            do {
                prevEntriesAdjusted = false;

                if (totalWorkAmount === amount) {
                    // Total amount of working entries matches the requested amount exactly.
                    //  Allocate corresponding UTXOs and leave
                    docAllocatedUtxos = workUtxos.map((workUtxo) => {
                        return docUtxos[workUtxo.utxoIdx];
                    });
                    exactAmountAllocated = true;
                }
                else if (totalWorkAmount > amount) {
                    // Total amount of working entries is enough to fulfill requested amount, but
                    //  does not match it exactly. Pre-allocate corresponding UTXOs if not yet
                    //  pre-allocated or if we seek to return the smallest change possible, but...
                    if (this.smallestChange || docAllocatedUtxos === undefined) {
                        docAllocatedUtxos = workUtxos.map((workUtxo) => {
                            return docUtxos[workUtxo.utxoIdx];
                        });
                    }

                    // ...proceed to try if exact amount can be allocated
                    const prevEntriesAmount = totalWorkAmount - workUtxos[lastWorkIdx].assetAmount;

                    // Search for a UTXO with a lower amount for the last working entry, so the
                    //  total amount of working entries matches the requested amount
                    for (let utxoIdx = workUtxos[lastWorkIdx].utxoIdx + 1; utxoIdx < numUtxos; utxoIdx++) {
                        let currentWorkAmount = prevEntriesAmount + docUtxos[utxoIdx].assetAmount;

                        if (currentWorkAmount === amount) {
                            // We managed to allocate the exact requested amount.
                            //  Save allocated UTXOs and finish processing
                            workUtxos[lastWorkIdx] = {
                                utxoIdx: utxoIdx,
                                assetAmount: docUtxos[utxoIdx].assetAmount
                            };
                            docAllocatedUtxos = workUtxos.map((workUtxo) => {
                                return docUtxos[workUtxo.utxoIdx];
                            });
                            exactAmountAllocated = true;
                            break;
                        }
                        else if (currentWorkAmount < amount) {
                            // Amount too low. Stop search
                            break;
                        }
                        else if (this.smallestChange) {
                            // Save newly allocated amount that is smaller than previously
                            //  allocated one but not yet small enough
                            workUtxos[lastWorkIdx] = {
                                utxoIdx: utxoIdx,
                                amount: docUtxos[utxoIdx].amount
                            };
                            docAllocatedUtxos = workUtxos.map((workUtxo) => {
                                return docUtxos[workUtxo.utxoIdx];
                            });
                        }
                    }

                    if (!exactAmountAllocated) {
                        // Could not allocate exact requested amount by replacing UTXO associated with
                        //  last work entry. So try to adjust previous entries so their amount is less
                        //  than their current amount to continue processing

                        // Work through all previous entries, starting with the one before
                        //  the last one, and going up to the first one (eventually)
                        for (let workIdx = lastWorkIdx - 1; workIdx >= 0; workIdx--) {
                            let currentEntryAmount = workUtxos[workIdx].assetAmount;

                            // Search for a UTXO with an amount lower than the amount of the current entry
                            for (let utxoIdx = workUtxos[workIdx].utxoIdx + 1; utxoIdx < numUtxos - (numWorkUtxos - (workIdx + 1)); utxoIdx++) {
                                if (docUtxos[utxoIdx].assetAmount < currentEntryAmount) {
                                    // UTXO found. Adjust working UTXO entries
                                    totalWorkAmount = 0;

                                    for (let workIdx2 = 0; workIdx2 < numWorkUtxos; workIdx2++) {
                                        if (workIdx2 >= workIdx) {
                                            // Starting from the working entry for which a UTXO with a lower amount
                                            //  has been, each following entry should be associated with a successive
                                            //  UTXO from the result set
                                            let entryUtxoIdx = utxoIdx + (workIdx2 - workIdx);

                                            workUtxos[workIdx2] = {
                                                utxoIdx: entryUtxoIdx,
                                                assetAmount: docUtxos[entryUtxoIdx].assetAmount
                                            }
                                        }

                                        totalWorkAmount += workUtxos[workIdx2].assetAmount;
                                    }

                                    // Indicate that previous entries have been adjusted
                                    prevEntriesAdjusted = true;
                                    break;
                                }
                            }

                            if (prevEntriesAdjusted) {
                                break;
                            }
                        }
                    }
                }
            }
            while (!exactAmountAllocated && prevEntriesAdjusted);
        }

        if (docAllocatedUtxos !== undefined) {
            // UTXOs have been allocated. Stop processing
            if (work !== undefined) {
                // Make sure that work info only returned in case of failure
                delete work.largestTriedDeltaAmount;
            }

            break;
        }
        else if (work !== undefined) {
            // Save largest delta amount tried to match (or surpass) the requested amount to be allocated
            work.largestTriedDeltaAmount = work.largestTriedDeltaAmount === undefined || work.largestTriedDeltaAmount < workUtxos[lastWorkIdx].assetAmount ? workUtxos[lastWorkIdx].assetAmount : work.largestTriedDeltaAmount;
        }
    }

    return docAllocatedUtxos !== undefined ? {docUtxos: docAllocatedUtxos, exactAmountAllocated: exactAmountAllocated} : undefined;
}

// Return asset info from within UTXO for the specified asset if it exists
function getAssetUtxoInfo(utxo) {
    if (utxo.assets !== undefined) {
        if (utxo.assets.length === 1) {
            return utxo.assets[0].assetId === this.ccAssetId ? utxo.assets[0] : undefined;
        }
        else if (utxo.assets.length === 0) {
            // No asset entry in UTXO. Discard it
            Catenis.logger.WARN('UTXO has no Colored Coins asset entry. UTXO is being discarded', {utxo: utxo});
        }
        else {
            // More than one asset entry in UTXO. This is not supported
            Catenis.logger.WARN('UTXO has more than one Colored Coins asset entry. UTXO is being discarded', {utxo: utxo});
        }
    }
}


// CCFundSource function class (public) methods
//


// CCFundSource function class (public) properties
//

// Critical section object to avoid concurrent access to UTXOs
CCFundSource.utxoCS = new CriticalSection();


// Definition of module (private) functions
//

function computeAdditionalUtxos(addUtxoTxInputs) {
    const txidUtxos = new Map();
    const txidNoScriptPubKeyUtxos = new Map();

    if (!Array.isArray(addUtxoTxInputs)) {
        addUtxoTxInputs = [addUtxoTxInputs];
    }

    addUtxoTxInputs.forEach((txInput) => {
        const utxo = {
            txid: txInput.txout.txid,
            vout: txInput.txout.vout,
            address: txInput.address,
            amount: new BigNumber(txInput.txout.amount).dividedBy(100000000).toNumber(),
            assets: [{
                assetId: txInput.txout.ccAssetId,
                amount: txInput.txout.assetAmount,
                divisibility: txInput.txout.assetDivisibility,
                aggregationPolicy: txInput.txout.isAggregatableAsset ? CCTransaction.aggregationPolicy.aggregatable : CCTransaction.aggregationPolicy.dispersed,
            }]
        };

        if (txInput.scriptPubKey !== undefined) {
            utxo.scriptPubKey = txInput.scriptPubKey;
        }
        else {
            if (txidNoScriptPubKeyUtxos.has(txInput.txout.txid)) {
                txidNoScriptPubKeyUtxos.get(txInput.txout.txid).push(utxo);
            }
            else {
                txidNoScriptPubKeyUtxos.set(txInput.txout.txid, [utxo]);
            }
        }

        if (txidUtxos.has(txInput.txout.txid)) {
            txidUtxos.get(txInput.txout.txid).push(utxo);
        }
        else {
            txidUtxos.set(txInput.txout.txid, [utxo]);
        }
    });

    const txidRawTransaction = new Map();

    for (let [txid, utxos] of txidUtxos) {
        // Retrieve transaction info to get number of confirmations for its related UTXOs
        const txInfo = Catenis.bitcoinCore.getTransaction(txid);

        utxos.forEach((utxo) => {
            utxo.confirmations = txInfo.confirmations;
        });

        if (txidNoScriptPubKeyUtxos.has(txid)) {
            txidRawTransaction.set(txid, txInfo.hex);
        }
    }

    if (txidRawTransaction.size > 0) {
        for (let [txid, hexTx] of txidRawTransaction) {
            // Decode raw transaction to get script pub key for its related UTXOs
            const tx = Catenis.bitcoinCore.decodeRawTransaction(hexTx);

            txidNoScriptPubKeyUtxos.get(txid).forEach((utxo) => {
                utxo.scriptPubKey = tx.vout[utxo.vout].scriptPubKey.hex;
            });
        }
    }

    return Array.from(txidUtxos.values()).reduce((list, utxos) => {
        return list.concat(utxos);
    }, []);
}


// Module code
//

// Lock function class
Object.freeze(CCFundSource);
