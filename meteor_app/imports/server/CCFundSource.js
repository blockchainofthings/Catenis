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


// Definition of function classes
//

// CCFundSource function class
//
//  Argument description:
//    ccAssetId [String] - Colored Coins attributed ID of asset that should be used for the funding
//    addresses [String|Array(String)]  - Addresses to be used as the fund source
//    unconfUtxoInfo {  - (optional) To be used in case unconfirmed UTXOs should be used as the fund source
//      ancestorsCountDiff: [Number],  - (optional) Amount to be deducted from maximum count of (unconfirmed) ancestor txs for tx to be accepted into mempool (to be relayed).
//                                        The resulting amount shall be used as an upper limit to filter UTXOs that should be used as fund source
//                                        - if not defined, a default diff of 1 (one) is used, so the upper limit is set to (maxCount-1)
//                                        - if a non-negative value is passed, the upper limit is set to (maxCount-value)
//                                        - if a negative value is passed, no upper limit is set (all UTXOs are used)
//      ancestorsSizeDiff: [Number],  - (optional) Amount to be deducted from maximum size (in bytes) of (unconfirmed) ancestor txs for tx to be accepted into mempool (to be relayed).
//                                       The resulting amount shall be used as an upper limit to filter UTXOs that should be used as fund source
//                                       - if not defined, a default diff of 1000 (1K) is used, so the upper limit is set to (maxSize-1000)
//                                       - if a non-negative value is passed, the upper limit is set to (maxSize-value)
//                                       - if a negative value is passed, no upper limit is set (all UTXOs are used)
//      descendantsCountDiff: [Number],  - (optional) Amount to be deducted from maximum count of (unconfirmed) descendant txs for tx to be accepted into mempool (to be relayed).
//                                          The resulting amount shall be used as an upper limit to filter UTXOs that should be used as fund source
//                                          - if not defined, a default diff of 1 (one) is used, so the upper limit is set to (maxCount-1)
//                                          - if a non-negative value is passed, the upper limit is set to (maxCount-value)
//                                          - if a negative value is passed, no upper limit is set (all UTXOs are used)
//      descendantsSizeDiff: [Number]  - (optional) Amount to be deducted from maximum size (in bytes) of (unconfirmed) descendant txs for tx to be accepted into mempool (to be relayed).
//                                        The resulting amount shall be used as an upper limit to filter UTXOs that should be used as fund source
//                                        - if not defined, a default diff of 1000 (1K) is used, so the upper limit is set to (maxSize-1000)
//                                        - if a non-negative value is passed, the upper limit is set to (maxSize-value)
//                                        - if a negative value is passed, no upper limit is set (all UTXOs are used)
//    }
//    excludeUtxos [String|Array(String)]  - List of UTXOs that should not be taken into account when allocating new UTXOs
//                                            (because those UTXOs are associated with txs that use opt-in RBF (Replace By Fee)
//                                            and as such can be replaced by other txs and have their own outputs invalidated)
//
// NOTE: make sure that objects of this function class are instantiated and used (their methods
//  called) from code executed from the CCFundSource.utxoCS critical section object
export function CCFundSource(ccAssetId, addresses, unconfUtxoInfo, excludeUtxos) {
    this.ccAssetId = ccAssetId;
    this.addresses = Array.isArray(addresses) ? addresses : [addresses];

    this.useUnconfirmedUtxo = unconfUtxoInfo !== undefined;

    if (this.useUnconfirmedUtxo) {
        this.ancestorsCountUpperLimit = unconfUtxoInfo.ancestorsCountDiff === undefined ? cfgSettings.maxAncestorsCount - 1 : (unconfUtxoInfo.ancestorsCountDiff >= 0 ? cfgSettings.maxAncestorsCount - unconfUtxoInfo.ancestorsCountDiff : undefined);
        this.ancestorsSizeUpperLimit = unconfUtxoInfo.ancestorsSizeDiff === undefined ? cfgSettings.maxAncestorsSize - 1000 : (unconfUtxoInfo.ancestorsSizeDiff >= 0 ? cfgSettings.maxAncestorsSize - unconfUtxoInfo.ancestorsSizeDiff : undefined);
        this.descendantsCountUpperLimit = unconfUtxoInfo.descendantsCountDiff === undefined ? cfgSettings.maxDescendantsCount - 1 : (unconfUtxoInfo.descendantsCountDiff >= 0 ? cfgSettings.maxDescendantsCount - unconfUtxoInfo.descendantsCountDiff : undefined);
        this.descendantsSizeUpperLimit = unconfUtxoInfo.descendantsSizeDiff === undefined ? cfgSettings.maxDescendantsSize - 1000 : (unconfUtxoInfo.descendantsSizeDiff >= 0 ? cfgSettings.maxDescendantsSize - unconfUtxoInfo.descendantsSizeDiff : undefined);
    }

    if (excludeUtxos !== undefined) {
        this.excludedUtxos = new Set(excludeUtxos);
    }

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
    this.collUtxo = this.db.addCollection('UTXO', {
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

    if (addresses.length > 0) {
        // Load UTXOs into local DB
        loadUtxos.call(this);
    }
}


// Public CCFundSource object methods
//

CCFundSource.prototype.getBalance = function (includeUnconfirmed = true, includeAllocated = false) {
    const conditions = [];

    if (includeUnconfirmed && this.useUnconfirmedUtxo) {
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

        if (this.useUnconfirmedUtxo) {
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
                if ((allocatedUtxos = allocateUtxos(amount, utxoResultSets, numWorkUtxos)) !== undefined) {
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
    return this.excludedUtxos !== undefined && this.excludedUtxos.has(Util.txoutToString(utxo));
}


function loadUtxos() {
    // Retrieve UTXOs associated with given addresses, including unconfirmed ones if requested
    const utxos = Catenis.ccFNClient.getAddressesUtxos(this.addresses, this.useUnconfirmedUtxo ? 0 : 1);

    // Store retrieved UTXOs onto local DB making sure that only UTXOs associated with
    //  the specified asset are included, and that any excluded UTXOs are not included,
    //  and converting bitcoin amount from bitcoins to satoshis and the asset amount to its
    //  smallest division
    const unconfTxids = new Set();

    utxos.forEach((utxo) => {
        let assetUtxoInfo;

        // Make sure that UTXO is not excluded, and has asset info that pertains
        //  to the specified asset
        if (!isExcludedUtxo.call(this, utxo) && (assetUtxoInfo = getAssetUtxoInfo.call(this, utxo))) {
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
                    utxos: utxos,
                    currentUtxo: utxo
                });
                inconsistentAssetUtxoInfo = true;
            }

            const isAggregatableAsset = assetUtxoInfo.aggregationPolicy === 'aggregatable';

            if (this.isAggregatableAsset === undefined) {
                this.isAggregatableAsset = isAggregatableAsset;
            }
            else if (this.isAggregatableAsset !== isAggregatableAsset) {
                // Asset aggregation info inconsistent amongst UTXOs.
                //   Log warning condition and indicate that UTXO is inconsistent
                Catenis.logger.WARN('Asset aggregation info inconsistent amongst UTXOs. Current UTXO being discarded', {
                    addresses: this.addresses,
                    utxos: utxos,
                    currentUtxo: utxo
                });
                inconsistentAssetUtxoInfo = true;
            }

            if (!inconsistentAssetUtxoInfo) {
                this.collUtxo.insert({
                    address: utxo.address,
                    txid: utxo.txid,
                    vout: utxo.vout,
                    scriptPubKey: utxo.scriptPubKey,
                    amount: new BigNumber(utxo.amount).times(100000000).toNumber(),
                    ccAssetId: this.ccAssetId,
                    assetAmount: assetUtxoInfo.divisibility === 0 ? assetUtxoInfo.amount : new BigNumber(assetUtxoInfo.amount).times(Math.pow(10, assetUtxoInfo.divisibility)).toNumber(),
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
    });

    if (this.useUnconfirmedUtxo && unconfTxids.size > 0) {
        // Update descendants and ancestors info for all unconfirmed UTXO
        //  onto local DB
        for (let txid of unconfTxids) {
            this.collUtxo.find({txid: txid}).forEach((doc) => {
                // Retrieve memory pool entry for given unconfirmed transaction
                try {
                    const mempoolTx = Catenis.bitcoinCore.getMempoolEntry(txid);

                    doc.descendantsCount = mempoolTx.descendantcount;
                    doc.descendantsSize = mempoolTx.descendantsize;
                    doc.ancestorsCount = mempoolTx.ancestorcount;
                    doc.ancestorsSize = mempoolTx.ancestorsize;
                }
                catch (err) {
                    if ((err instanceof Meteor.Error) && err.error === 'ctn_btcore_rpc_error' && err.details !== undefined && typeof err.details.code === 'number'
                        && err.details.code === BitcoinCore.rpcErrorCode.RPC_INVALID_ADDRESS_OR_KEY) {
                        // Transaction of UTXO not in mempool; it must have been already confirmed
                        //  (in the meantime between the calls to 'bitcoinCore.listUnspent()'
                        //  and 'bitcoinCore.getMempoolEntry()'). So update UTXO's confirmations to 1
                        Catenis.logger.WARN('Transaction of UTXO not in mempool', {txid: txid, vout: doc.vout});
                        doc.confirmations = 1;
                    }
                    else {
                        // Any other error; just rethrows it
                        throw err;
                    }
                }

                this.collUtxo.update(doc);
            });
        }
    }
}

// Return asset info from within UTXO for the specified asset if it exists
function getAssetUtxoInfo(utxo) {
    if (utxo.assets !== undefined) {
        if (utxo.assets.length === 1) {
            return utxo.assets[0].assetId === this.ccAssetId ? utxo.assets[0] : undefined;
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
        // Make sure that length of current UTXO result set is large enough
        //  to accommodate current number of working UTXOs
        if (utxoResultSets[utxoResultSetIdx].length < numWorkUtxos) {
            continue;
        }

        // Set current UTXO result set for processing
        const docUtxos = utxoResultSets[utxoResultSetIdx],
            numUtxos = docUtxos.length;

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
                //  pre-allocated, but...
                if (docAllocatedUtxos === undefined) {
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

// Module code
//

// Lock function class
Object.freeze(CCFundSource);
