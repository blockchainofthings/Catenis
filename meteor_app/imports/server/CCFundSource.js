/**
 * Created by Claudio on 2017-10-05.
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
import { AncestorTransactions } from './AncestorTransactions';
import { BitcoinInfo } from './BitcoinInfo';


// Definition of function classes
//

// CCFundSource function class
//
//  Argument description:
//    ccAssetId [String] - Colored Coins attributed ID of asset that should be used for the funding
//    addresses [String|Array(String)] - Addresses to be used as the fund source
//    options { - (optional)
//      useUnconfirmedUtxo: [Boolean] - (optional, default: false) Indicate whether (any available) unconfirmed UTXOs should be used for allocating funds
//      selectUnconfUtxos: [string|Array(string)], - (optional) List of selected unconfirmed UTXOs (formatted as "txid:n") that should be taken into consideration
//                                                    even though unconfirmed UTXOs have not been set to be used (`useUnconfirmedUtxo` = false)
//      unconfUtxoInfo: {  - (optional) To be used in case unconfirmed UTXOs are effectively in use (either `useUnconfirmedUtxos` = true or `selectUnconfUtxos` set)
//                            NOTE: if not set and unconfirmed UTXOs are effectively in use, the parameters below are set to their corresponding default value
//        ancestorsCountDiff: [Number], - (optional) Amount to be deducted from maximum count of (unconfirmed) ancestor txs for tx to be accepted into mempool (to be relayed).
//                                         The resulting amount shall be used as an upper limit to filter UTXOs that should be used as fund source
//                                         - if not defined, a default diff of 1 (one) is used, so the upper limit is set to (maxCount-1)
//                                         - if a non-negative value is passed, the upper limit is set to (maxCount-value)
//                                         - if a negative value is passed, no upper limit shall be enforced
//        ancestorsSizeDiff: [Number], - (optional) Amount to be deducted from maximum virtual size (in vbytes) of (unconfirmed) ancestor txs for tx to be accepted into mempool (to be relayed).
//                                        The resulting amount shall be used as an upper limit to filter UTXOs that should be used as fund source
//                                        - if not defined, a default diff of 1000 (1K) is used, so the upper limit is set to (maxSize-1000)
//                                        - if a non-negative value is passed, the upper limit is set to (maxSize-value)
//                                        - if a negative value is passed, no upper limit shall be enforced
//        descendantsCountDiff: [Number], - (optional) Amount to be deducted from maximum count of (unconfirmed) descendant txs for tx to be accepted into mempool (to be relayed).
//                                           The resulting amount shall be used as an upper limit to filter UTXOs that should be used as fund source
//                                           - if not defined, a default diff of 1 (one) is used, so the upper limit is set to (maxCount-1)
//                                           - if a non-negative value is passed, the upper limit is set to (maxCount-value)
//                                           - if a negative value is passed, no upper limit shall be enforced
//        descendantsSizeDiff: [Number], - (optional) Amount to be deducted from maximum virtual size (in vbytes) of (unconfirmed) descendant txs for tx to be accepted into mempool (to be relayed).
//                                          The resulting amount shall be used as an upper limit to filter UTXOs that should be used as fund source
//                                          - if not defined, a default diff of 1000 (1K) is used, so the upper limit is set to (maxSize-1000)
//                                          - if a non-negative value is passed, the upper limit is set to (maxSize-value)
//                                          - if a negative value is passed, no upper limit shall be enforced
//        initTxInputs: [Array(Object)|Object] [{ - (optional) Transaction inputs (or a single input) to be used to initialize ancestor transactions
//          txout: {
//            txid: [String],
//            ...
//          }
//          ...
//        }]
//      },
//      smallestChange: [boolean], - (optional, default: false) Indicates that the allocated UTXOs will favor the smallest change amount, if the exact amount is not met
//                                    Note: this option only takes effect if the 'higherAmountUtxos' is not set
//      higherAmountUtxos: [boolean], - (optional, default: false) Indicates whether UTXOs containing higher amounts should be preferably allocated (or, in other words, do not look for exact amount)
//      excludeUtxos: [string|Array(string)], - (optional) List of UTXOs (formatted as "txid:n") that should not be taken into account when allocating new UTXOs
//                                               (because those UTXOs are associated with txs that use opt-in RBF (Replace By Fee) as such can be replaced by
//                                               other txs and have their own outputs invalidated)
//      addUtxoTxInputs: [Object|Array(Object)] - (optional) List of transaction input objects (the same as used by the inputs property of the Transaction object)
//                                                  the UTXOs spent by them should be added to the list of available UTXOs. These inputs should belong to transactions
//                                                  that use opt-in RBF that are being replaced
//    }
//
// NOTE: make sure that objects of this function class are instantiated and used (their methods
//  called) from code executed from the CCFundSource.utxoCS critical section object
export function CCFundSource(ccAssetId, addresses, options) {
    // Initialize in-memory database to hold UTXOs
    //  Structure of collUtxo collection: {
    //      txout: [string],                - String representation (format: `txid:vout`) of transaction output
    //      address: [string],              - Bitcoin address that holds the spent amount
    //      txid: [string],                 - ID/hash of the transaction that contains the UTXO (UTXO transaction)
    //      vout: [number],                 - Order/index of output of the UTXO transaction
    //      type: [string],                 - Tx output type. Valid values (from BitcoinInfo.outputType): 'pubkeyhash', 'witness_v0_keyhash' (see note below)
    //      isWitness: [boolean],           - Indicates whether tx output is of a segregated witness type
    //      scriptPubKey: [string],         - Public key script of the UTXO
    //      amount: [number],               - Bitcoin amount in satoshis
    //      ccAssetId: [string],            - Colored Coins attributed ID of asset
    //      assetAmount: [number],          - Asset amount represented as an integer number of the asset's smallest division (according to the asset divisibility)
    //      assetDivisibility: [number],    - Number of decimal places allowed for representing quantities of this asset
    //      isAggregatableAsset: [boolean], - Indicates whether quantities of the asset from different UTXOs can be combined to allocate the necessary fund
    //      confirmations: [number],        - Number of confirmations for the UTXO transaction
    //      allocated: [boolean],           - Indicates whether this entry has already been allocated
    //      ancestorsCount: [number],       - Number of ancestor transactions of the UTXO transaction, including itself. This should only exist for confirmations = 0
    //      ancestorsSize: [number],        - Total virtual size, in vbytes, of ancestor transactions of the UTXO transaction, including itself. This should only exist for confirmations = 0
    //      descendantsCount: [number],     - Number of descendant transactions of the UTXO transaction, including itself. This should only exist for confirmations = 0
    //      descendantsSize: [number],      - Total virtual size, in vbytes, of descendant transactions of the UTXO transaction, including itself. This should only exist for confirmations = 0
    //      vsize: [number],                - Virtual size, in vbytes, of the UTXO transaction. This should only exist for confirmations = 0
    //      ancestors: [array(object)] [{   - List with data about all the ancestor transactions of the UTXO transaction. This should only exist for confirmations = 0
    //        txid: [string],                   - ID/hash of the ancestor transaction
    //        vsize: [number]                   - Virtual size, in vbytes, of the ancestor transaction
    //      }]
    //  }
    //  NOTE: the list of UTXOs should not include outputs of a script type (i.e. 'scripthash' and 'witness_v0_scripthash')
    //      since Catenis does not handle such outputs. Also, 'multisig' outputs should not be listed due to a
    //      Bitcoin Core's limitation where 'multisig' outputs are not listed by the listunspent RPC method.
    this.db = new Loki();
    // noinspection JSCheckFunctionSignatures
    this.collUtxo = this.db.addCollection('UTXO', {
        unique: [
            'txout'
        ],
        indices: [
            'address',
            'txid',
            'isWitness',
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
        if (options.useUnconfirmedUtxo) {
            this.useUnconfirmedUtxo = !!options.useUnconfirmedUtxo;
        }

        if (options.selectUnconfUtxos) {
            this.selectUnconfUtxos = new Set(options.selectUnconfUtxos);
        }

        // NOTE: if additional UTXOs are passed (`addUtxoTxInputs`), assume that it might
        //      include unconfirmed UTXOs and thus do all required setup. Later, when
        //      the additional UTXOs are computed (see below), if not unconfirmed UTXOs
        //      are included, just unset things.
        if (this.useUnconfirmedUtxo || this.selectUnconfUtxos || options.addUtxoTxInputs) {
            // Prepare to instantiate ancestor transactions control object
            this.mempoolTxInfoCache = new Map();
            const ancTxsOptions = {
                mempoolTxInfoCache: this.mempoolTxInfoCache
            };

            // Initialize ancestor and descendant transactions limits to use
            let ancestorsCountDiff = 1;
            let ancestorsSizeDiff = 1000;
            let descendantsCountDiff = 1;
            let descendantsSizeDiff = 1000;

            if (options.unconfUtxoInfo !== undefined) {
                if (options.unconfUtxoInfo.ancestorsCountDiff !== undefined) {
                    ancestorsCountDiff = options.unconfUtxoInfo.ancestorsCountDiff >= 0 ? options.unconfUtxoInfo.ancestorsCountDiff : undefined;
                }

                if (options.unconfUtxoInfo.ancestorsSizeDiff !== undefined) {
                    ancestorsSizeDiff = options.unconfUtxoInfo.ancestorsSizeDiff >= 0 ? options.unconfUtxoInfo.ancestorsSizeDiff : undefined;
                }

                if (options.unconfUtxoInfo.descendantsCountDiff !== undefined) {
                    descendantsCountDiff = options.unconfUtxoInfo.descendantsCountDiff >= 0 ? options.unconfUtxoInfo.descendantsCountDiff : undefined;
                }

                if (options.unconfUtxoInfo.descendantsSizeDiff !== undefined) {
                    descendantsSizeDiff = options.unconfUtxoInfo.descendantsSizeDiff >= 0 ? options.unconfUtxoInfo.descendantsSizeDiff : undefined
                }

                if (options.unconfUtxoInfo.initTxInputs) {
                    ancTxsOptions.initTxInputs = options.unconfUtxoInfo.initTxInputs;
                }
            }

            this.ancestorsCountUpperLimit = ancestorsCountDiff !== undefined ? cfgSettings.maxAncestorsCount - ancestorsCountDiff : undefined;
            this.ancestorsSizeUpperLimit = ancestorsSizeDiff !== undefined ? cfgSettings.maxAncestorsSize - ancestorsSizeDiff : undefined;
            this.descendantsCountUpperLimit = descendantsCountDiff !== undefined ? cfgSettings.maxDescendantsCount - descendantsCountDiff : undefined;
            this.descendantsSizeUpperLimit = descendantsSizeDiff !== undefined ? cfgSettings.maxDescendantsSize - descendantsSizeDiff : undefined;

            ancTxsOptions.ancestorsCountLimit = this.ancestorsCountUpperLimit === undefined ? null : this.ancestorsCountUpperLimit;
            ancTxsOptions.ancestorsSizeLimit = this.ancestorsSizeUpperLimit === undefined ? null : this.ancestorsSizeUpperLimit;

            // Instantiate ancestor transactions control object
            this.ancestorTxs = new AncestorTransactions(ancTxsOptions);
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

        // Note: it is important that this be the last options processed so it is done as close to
        //  the loading of UTXOs as possible
        if (options.addUtxoTxInputs) {
            // Compute list of additional UTXOs to consider
            const result = computeAdditionalUtxos(options.addUtxoTxInputs);

            this.additionalUtxos = result.utxos;

            if (!this.useUnconfirmedUtxo && !this.selectUnconfUtxos && !result.hasUnconfirmedUtxo) {
                // No unconfirmed UTXOs in use, so unset ancestor transactions
                this.ancestorTxs = undefined;
            }
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
    let filterResult = false;

    if (includeUnconfirmed && this.loadedUnconfirmedUtxos) {
        if (this.ancestorsCountUpperLimit !== undefined) {
            conditions.push({ancestorsCount: {$lte: this.ancestorsCountUpperLimit}});

            filterResult = true;
        }

        if (this.ancestorsSizeUpperLimit !== undefined) {
            conditions.push({ancestorsSize: {$lte: this.ancestorsSizeUpperLimit}});

            filterResult = true;
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

    let docUtxos;

    if (filterResult) {
        const ancestorTxs = this.ancestorTxs.clone();

        docUtxos = this.collUtxo.chain().find(query).compoundsort([
            ['assetAmount', true],
            ['confirmations', true],
            'ancestorsCount',
            'ancestorsSize',
            'descendantsCount',
            'descendantsSize'
        ]).data().filter(docUtxo => ancestorTxs.checkAddUtxo(docUtxo));
    }
    else {
        docUtxos = this.collUtxo.find(query);
    }

    return docUtxos.reduce((sum, docUtxo) => {
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
//      isWitness: [Boolean],
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
                        isWitness: docUtxo.isWitness,
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

            if (this.ancestorTxs) {
                // Remove included ancestor transaction
                this.ancestorTxs.removeUtxo(docUtxo);
            }
        });

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
    const outputType = BitcoinInfo.getOutputTypeByDescriptor(utxo.desc);

    if (outputType && (outputType === BitcoinInfo.outputType.witness_v0_keyhash || outputType === BitcoinInfo.outputType.pubkeyhash)) {
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
                type: outputType.name,
                isWitness: outputType.isWitness,
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
    else {
        // UTXO of an unexpected type.
        Catenis.logger.WARN('Unexpected output type: UTXO NOT added to Colored Coins fund source list', utxo);
    }
}

function loadUtxos() {
    // Retrieve UTXOs associated with given addresses, including unconfirmed ones if requested
    const utxos = Catenis.c3NodeClient.getAddressesUtxos(this.addresses, this.useUnconfirmedUtxo || this.selectUnconfUtxos ? 0 : 1);

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
            this.collUtxo.find({txid: txid}).forEach((docUtxo) => {
                // Retrieve memory pool entry for given unconfirmed transaction
                let mempoolTxInfo;

                if (this.mempoolTxInfoCache.has(docUtxo.txid)) {
                    // Get memory pool entry from cache
                    mempoolTxInfo = this.mempoolTxInfoCache.get(docUtxo.txid);
                }
                else {
                    try {
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
                                throw err;
                            }
                        }
                        else {
                            // Any other error; just rethrows it
                            throw err;
                        }
                    }
                }

                if (mempoolTxInfo !== null) {
                    docUtxo.descendantsCount = mempoolTxInfo.descendantcount;
                    docUtxo.descendantsSize = mempoolTxInfo.descendantsize;
                    docUtxo.ancestorsCount = mempoolTxInfo.ancestorcount;
                    docUtxo.ancestorsSize = mempoolTxInfo.ancestorsize;
                    docUtxo.vsize = mempoolTxInfo.vsize;
                    docUtxo.ancestors = mempoolTxInfo.ancestors;

                    // Indicate that unconfirmed UTXOs have been loaded
                    this.loadedUnconfirmedUtxos = true;
                }
                else {
                    // Transaction of UTXO not in mempool; it must have been already confirmed
                    //  (in the meantime between the calls to 'c3NodeClient.getAddressesUtxos()'
                    //  and 'bitcoinCore.getMempoolEntryWithAncestors()'). So retrieve transaction
                    //  information to get confirmation status
                    Catenis.logger.DEBUG('Transaction of UTXO not in mempool', {txid: txid, vout: docUtxo.vout});
                    let txInfo = txidTxInfo.get(txid);

                    if (txInfo === undefined) {
                        try {
                            txInfo = Catenis.bitcoinCore.getTransaction(txid, false);
                            txidTxInfo.set(txid, txInfo);
                        }
                        catch (err2) {
                            Catenis.logger.ERROR('Error trying to get confirmation status of transaction (txid: %s) associated with UTXO that is not in the mempool', txid, err2);
                        }
                    }

                    if (txInfo !== undefined && txInfo.confirmations > 0) {
                        // Transaction has indeed been confirmed. So prepare to update its confirmation status
                        docUtxo.confirmations = txInfo.confirmations;
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

                this.collUtxo.update(docUtxo);
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

        let tempAncestorTxs;

        if (this.ancestorTxs) {
            // Save current ancestor transactions state
            tempAncestorTxs = this.ancestorTxs.clone();
        }

        // Initialize reference to working UTXOs. Start working with
        //  first UTXOs from result set
        let workUtxos = [];
        let totalWorkAmount = 0;

        for (let utxoIdx = 0; utxoIdx < numUtxos && workUtxos.length < numWorkUtxos; utxoIdx++) {
            const docUtxo = docUtxos[utxoIdx];

            // Make sure that UTXO does not exceed ancestor transactions limits
            if (!tempAncestorTxs || tempAncestorTxs.checkAddUtxo(docUtxo)) {
                workUtxos.push({
                    utxoIdx: utxoIdx,
                    assetAmount: docUtxo.assetAmount
                });
                totalWorkAmount += docUtxos[utxoIdx].assetAmount;
            }
        }

        if (workUtxos.length < numWorkUtxos) {
            // Unable to find enough acceptable UTXOs (ancestor txs limits not exceeded).
            //  Remove included ancestor txs...
            //  NOTE: if this condition is met, it is guaranteed that `tempAncestorTxs` !== undefined
            workUtxos.forEach((workUtxo) => {
                tempAncestorTxs.removeUtxo(docUtxos[workUtxo.utxoIdx]);
            });

            // ... and try with next UTXO result set
            continue;
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

            let tempAncestorTxs2;

            if (tempAncestorTxs) {
                // Save current ancestor transactions state
                tempAncestorTxs2 = tempAncestorTxs.clone();
            }

            do {
                prevEntriesAdjusted = false;

                if (totalWorkAmount === amount) {
                    // Total amount of working entries matches the requested amount exactly.
                    //  Allocate corresponding UTXOs and leave
                    docAllocatedUtxos = workUtxos.map((workUtxo) => {
                        return docUtxos[workUtxo.utxoIdx];
                    });

                    if (tempAncestorTxs2) {
                        // Update ancestor transactions state
                        tempAncestorTxs = tempAncestorTxs2;
                    }

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

                        if (tempAncestorTxs2) {
                            // Update ancestor transactions state
                            tempAncestorTxs = tempAncestorTxs2;
                            tempAncestorTxs2 = tempAncestorTxs.clone();
                        }
                    }

                    // ...proceed to try if exact amount can be allocated
                    const prevEntriesAmount = totalWorkAmount - workUtxos[lastWorkIdx].assetAmount;

                    // Search for a UTXO with a lower amount for the last working entry, so the
                    //  total amount of working entries matches the requested amount
                    for (let utxoIdx = workUtxos[lastWorkIdx].utxoIdx + 1; utxoIdx < numUtxos; utxoIdx++) {
                        const docUtxo = docUtxos[utxoIdx];

                        let tempAncestorTxs3;

                        if (tempAncestorTxs2) {
                            // Save current ancestor transactions state, and remove ancestor txs of
                            //  (last work entry) UTXO that will eventually be replaced
                            tempAncestorTxs3 = tempAncestorTxs2.clone();
                            tempAncestorTxs3.removeUtxo(docUtxos[workUtxos[lastWorkIdx].utxoIdx]);
                        }

                        // Make sure that UTXO does not exceed ancestor transactions limits
                        if (!tempAncestorTxs3 || tempAncestorTxs3.checkAddUtxo(docUtxo)) {
                            const currentWorkAmount = prevEntriesAmount + docUtxo.assetAmount;

                            if (currentWorkAmount === amount) {
                                // We managed to allocate the exact requested amount.
                                //  Save allocated UTXOs and finish processing
                                workUtxos[lastWorkIdx] = {
                                    utxoIdx: utxoIdx,
                                    assetAmount: docUtxo.assetAmount
                                };
                                docAllocatedUtxos = workUtxos.map((workUtxo) => {
                                    return docUtxos[workUtxo.utxoIdx];
                                });

                                if (tempAncestorTxs3) {
                                    // Update ancestor transactions state
                                    tempAncestorTxs = tempAncestorTxs3;
                                }

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
                                    assetAmount: docUtxo.assetAmount
                                };
                                docAllocatedUtxos = workUtxos.map((workUtxo) => {
                                    return docUtxos[workUtxo.utxoIdx];
                                });

                                if (tempAncestorTxs3) {
                                    // Update ancestor transactions state
                                    tempAncestorTxs = tempAncestorTxs3;
                                    tempAncestorTxs2 = tempAncestorTxs.clone();
                                }
                            }
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

                            let tempAncestorTxs3;

                            if (tempAncestorTxs2) {
                                // Save current ancestor transactions state, and remove ancestor txs of
                                //  first UTXO that will eventually be replaced
                                tempAncestorTxs3 = tempAncestorTxs2.clone();
                                tempAncestorTxs3.removeUtxo(docUtxos[workUtxos[workIdx].utxoIdx]);
                            }

                            // Search for a UTXO with an amount lower than the amount of the current entry
                            for (let utxoIdx = workUtxos[workIdx].utxoIdx + 1, limit = numUtxos - (numWorkUtxos - (workIdx + 1)); utxoIdx < limit; utxoIdx++) {
                                const docUtxo = docUtxos[utxoIdx];

                                let tempAncestorTxs4;

                                if (tempAncestorTxs3) {
                                    // Save current ancestor transactions state
                                    tempAncestorTxs4 = tempAncestorTxs3.clone();
                                }

                                // And make sure that UTXO does not exceed ancestor transactions limits
                                if (docUtxo.assetAmount < currentEntryAmount && (!tempAncestorTxs4 || tempAncestorTxs4.checkAddUtxo(docUtxo))) {
                                    // UTXO found. Try to adjust working UTXO entries
                                    const newWorkUtxos = Util.cloneObjArray(workUtxos);
                                    let newTotalWorkAmount = 0;
                                    let newWorkIdx = 0;

                                    // NOTE: `limit2` below is calculated to guarantee that index of replacing UTXO
                                    //      (`entryUtxoIdx`) does not exceed `numUtxos`
                                    for (let replaceIdx = 0, limit2 = numUtxos - (utxoIdx - workIdx); newWorkIdx < numWorkUtxos && replaceIdx < limit2; replaceIdx++) {
                                        if (newWorkIdx >= workIdx) {  // This also implies that replaceIdx >= workIdx
                                            // Starting from the working entry for which a UTXO with a lower amount
                                            //  has been found, each following entry should be associated with a successive
                                            //  UTXO that matches the ancestors limit criteria from the result set
                                            let entryUtxoIdx = utxoIdx + (replaceIdx - workIdx);
                                            const docUtxo2 = docUtxos[entryUtxoIdx];

                                            if (tempAncestorTxs4) {
                                                // NOTE: we only care to check if UTXO does not exceed ancestor transactions
                                                //      limits for indices > workIdx because the replacing entry for index
                                                //      workIdx has already been checked (`if` just before `for` loop)
                                                if (newWorkIdx !== workIdx) {  // newWorkIdx > workIdx
                                                    // A UTXO beyond the first one is to be replaced

                                                    // Save current ancestor transactions state, and remove ancestor txs of
                                                    //  UTXO that will eventually be replaced...
                                                    const tempAncestorTxs5 = tempAncestorTxs4.clone();
                                                    tempAncestorTxs5.removeUtxo(docUtxos[newWorkUtxos[newWorkIdx].utxoIdx]);

                                                    // ... and make sure that UTXO that should be used as replacement
                                                    //  does not exceed ancestor transactions limits
                                                    if (!tempAncestorTxs5.checkAddUtxo(docUtxo2)) {
                                                        // UTXO cannot be accepted. Look for another one
                                                        continue;
                                                    }
                                                    else {
                                                        // Update ancestor transactions state
                                                        tempAncestorTxs4 = tempAncestorTxs5;
                                                    }
                                                }
                                            }

                                            // Replace UTXO
                                            newWorkUtxos[newWorkIdx] = {
                                                utxoIdx: entryUtxoIdx,
                                                assetAmount: docUtxo2.assetAmount
                                            };

                                            newTotalWorkAmount += newWorkUtxos[newWorkIdx].assetAmount;
                                            newWorkIdx++;
                                        }
                                        else {
                                            // The first `workIdx` entries are kept the same (no replacement)
                                            newTotalWorkAmount += newWorkUtxos[newWorkIdx].assetAmount;
                                            newWorkIdx++;
                                        }
                                    }

                                    // Make sure that all required UTXOs have been replaced
                                    if (newWorkIdx === numWorkUtxos) {
                                        // Validate replaced UTXOs
                                        workUtxos = newWorkUtxos;
                                        totalWorkAmount = newTotalWorkAmount;

                                        if (tempAncestorTxs4) {
                                            // Update ancestor transactions state
                                            tempAncestorTxs3 = tempAncestorTxs4;
                                        }

                                        // Indicate that previous entries have been adjusted
                                        prevEntriesAdjusted = true;
                                        break;
                                    }
                                }
                            }

                            if (prevEntriesAdjusted) {
                                if (tempAncestorTxs3) {
                                    // Update ancestor transactions state
                                    tempAncestorTxs2 = tempAncestorTxs3;
                                }

                                break;
                            }
                        }
                    }
                }
            }
            while (!exactAmountAllocated && prevEntriesAdjusted);
        }

        if (docAllocatedUtxos !== undefined) {
            // UTXOs have been allocated

            if (tempAncestorTxs) {
                // Update ancestor transactions state
                this.ancestorTxs = tempAncestorTxs;
            }

            if (work !== undefined) {
                // Make sure that work info only returned in case of failure
                delete work.largestTriedDeltaAmount;
            }

            // Stop processing
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

    if (!Array.isArray(addUtxoTxInputs)) {
        addUtxoTxInputs = [addUtxoTxInputs];
    }

    addUtxoTxInputs.forEach((txInput) => {
        const utxo = {
            txid: txInput.txout.txid,
            vout: txInput.txout.vout,
            address: txInput.address,
            scriptPubKey: txInput.scriptPubKey
        };

        if (txInput.txout.amount !== undefined) {
            utxo.amount = new BigNumber(txInput.txout.amount).dividedBy(100000000).toNumber();
        }

        utxo.assets = [{
            assetId: txInput.txout.ccAssetId,
            amount: txInput.txout.assetAmount,
            divisibility: txInput.txout.assetDivisibility,
            aggregationPolicy: txInput.txout.isAggregatableAsset ? CCTransaction.aggregationPolicy.aggregatable : CCTransaction.aggregationPolicy.dispersed,
        }];

        if (txidUtxos.has(txInput.txout.txid)) {
            txidUtxos.get(txInput.txout.txid).push(utxo);
        }
        else {
            txidUtxos.set(txInput.txout.txid, [utxo]);
        }
    });

    let hasUnconfirmedUtxo = false;

    for (let [txid, utxos] of txidUtxos) {
        // Retrieve transaction info to get number of confirmations and descriptor
        //  for their corresponding tx outputs
        const txInfo = Catenis.bitcoinCore.getDecodedRawTransactionCheck(txid);

        utxos.forEach((utxo) => {
            const txout = txInfo.vout[utxo.vout];
            const scriptPubKey = txout.scriptPubKey;

            // Make sure that UTXO is complete
            if (!utxo.address) {
                utxo.address = scriptPubKey.addresses[0];
            }

            if (!utxo.scriptPubKey) {
                utxo.scriptPubKey = scriptPubKey.hex;
            }

            if (utxo.amount === undefined) {
                utxo.amount = txout.value;
            }

            utxo.confirmations = txInfo.confirmations;
            utxo.desc = BitcoinInfo.getOutputTypeByName(scriptPubKey.type).desc;
        });

        if (txInfo.confirmations === 0) {
            hasUnconfirmedUtxo = true;
        }
    }

    return {
        utxos: Array.from(txidUtxos.values()).reduce((list, utxos) => {
            return list.concat(utxos);
        }, []),
        hasUnconfirmedUtxo: hasUnconfirmedUtxo
    };
}


// Module code
//

// Lock function class
Object.freeze(CCFundSource);
