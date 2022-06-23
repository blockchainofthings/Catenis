/**
 * Created by claudio on 2022-01-31
 */

//console.log('[NFTokenSource.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import BigNumber from 'bignumber.js';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { cfgSettings } from './FundSource';
import { BitcoinCore } from './BitcoinCore';
import { BitcoinInfo } from './BitcoinInfo';


// Definition of classes
//

/**
 * NFTokenSource class
 */
export class NFTokenSource {
    /**
     * NFTokenSource class constructor
     * @param {string} ccTokenId Colored Coins attributed ID of non-fungible token the UTXO currently holding it should
     *                            be retrieved
     * @param {(string[]|string)} addresses List of possible blockchain addresses with which the non-fungible token UTXO
     *                                       should be associated
     * @param {Object} [options]
     * @param {boolean} [options.useUnconfirmedUtxo=false] Indicates whether it is acceptable for the non-fungible token
     *                                                      UTXO to not yet be confirmed
     * @param {Object} [options.unconfUtxoInfo]
     * @param {number} [options.unconfUtxoInfo.ancestorsCountDiff=1] Amount to be deducted from maximum count of
     *                                      (unconfirmed) ancestor txs for tx to be accepted into mempool (to be
     *                                      relayed). The resulting amount shall be used as an upper limit for the
     *                                      non-fungible token UTXO to be accepted, as follows:
     *                                       - if a non-negative value is passed, the upper limit is set to
     *                                         (maxCount-value)
     *                                       - if a negative value is passed, no upper limit shall be enforced
     * @param {number} [options.unconfUtxoInfo.ancestorsSizeDiff=1000] Amount to be deducted from maximum virtual size
     *                                      (in vbytes) of (unconfirmed) ancestor txs for tx to be accepted into mempool
     *                                      (to be relayed). The resulting amount shall be used as an upper limit for
     *                                      the non-fungible token UTXO to be accepted, as follows:
     *                                       - if a non-negative value is passed, the upper limit is set to
     *                                         (maxSize-value)
     *                                       - if a negative value is passed, no upper limit shall be enforced
     * @param {number} [options.unconfUtxoInfo.descendantsCountDiff=1] Amount to be deducted from maximum count of
     *                                      (unconfirmed) descendant txs for tx to be accepted into mempool (to be
     *                                      relayed). The resulting amount shall be used as an upper limit for the
     *                                      non-fungible token UTXO to be accepted, as follows:
     *                                       - if a non-negative value is passed, the upper limit is set to
     *                                         (maxCount-value)
     *                                       - if a negative value is passed, no upper limit shall be enforced
     * @param {number} [options.unconfUtxoInfo.descendantsSizeDiff=1000] Amount to be deducted from maximum virtual size
     *                                      (in vbytes) of (unconfirmed) descendant txs for tx to be accepted into
     *                                      mempool (to be relayed). The resulting amount shall be used as an upper
     *                                      limit for the non-fungible token UTXO to be accepted, as follows:
     *                                       - if a non-negative value is passed, the upper limit is set to
     *                                         (maxSize-value)
     *                                       - if a negative value is passed, no upper limit shall be enforced
     */
    constructor(ccTokenId, addresses, options) {
        this.ccTokenId = ccTokenId;
        this.addresses = Array.isArray(addresses) ? addresses : [addresses];
        this.useUnconfirmedUtxo = false;

        if (options !== undefined) {
            if (options.useUnconfirmedUtxo !== undefined) {
                this.useUnconfirmedUtxo = !!options.useUnconfirmedUtxo;
            }

            if (this.useUnconfirmedUtxo) {
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
                }

                this.ancestorsCountUpperLimit = ancestorsCountDiff !== undefined ? cfgSettings.maxAncestorsCount - ancestorsCountDiff : undefined;
                this.ancestorsSizeUpperLimit = ancestorsSizeDiff !== undefined ? cfgSettings.maxAncestorsSize - ancestorsSizeDiff : undefined;
                this.descendantsCountUpperLimit = descendantsCountDiff !== undefined ? cfgSettings.maxDescendantsCount - descendantsCountDiff : undefined;
                this.descendantsSizeUpperLimit = descendantsSizeDiff !== undefined ? cfgSettings.maxDescendantsSize - descendantsSizeDiff : undefined;
            }
        }

        /**
         * @typedef {Object} NFAssetTxOutputInfo
         * @property {string} txid
         * @property {number} vout
         * @property {number} amount
         * @property {string} ccAssetId Colored Coins attributed ID of the non-fungible asset
         * @property {number} assetAmount The number of non-fungible tokens of that asset in this tx output
         * @property {number} assetDivisibility Number of decimal places allowed for representing quantities of this asset. Should always be set to 0
         * @property {boolean} isAggregatableAsset Indicates whether quantities of the asset from different UTXOs can be combined to allocate the necessary fund. Should always be set to false
         * @property {boolean} isNonFungible Indicates whether this is a non-fungible asset. Should always be set to true
         * @property {string[]} ccTokenIds List of Colored Coins attributed IDs of the non-fungible tokens of that asset that are contained in this tx output
         */

        /**
         * @typedef {Object} NFTokenHoldingUtxo
         * @property {string} address
         * @property {NFAssetTxOutputInfo} txout
         * @property {boolean} isWitness
         * @property {string} scriptPubKey
         * @property {number} tokenIndex
         */

        /**
         * UTXO that currently holds the non-fungible token
         * @type {(NFTokenHoldingUtxo|undefined)}
         */
        this.holdingUtxo = undefined;

        if (addresses.length > 0) {
            this._getHoldingUtxo();
        }
    }

    /**
     * Checks whether the UTXO that currently holds the non-fungible token has been found
     * @return {boolean}
     */
    get holdingUtxoFound() {
        return this.holdingUtxo !== undefined;
    }

    /**
     * Search for the UTXO that currently holds the non-fungible asset
     * @private
     */
    _getHoldingUtxo() {
        // Retrieve UTXOs associated with given addresses, including unconfirmed ones if requested
        const utxos = Catenis.c3NodeClient.getAddressesUtxos(this.addresses, this.useUnconfirmedUtxo ? 0 : 1);
        let foundUtxo;
        let assetIdx;

        for (const utxo of utxos) {
            if (utxo.assets) {
                for (let idx = 0, numAssets = utxo.assets.length; idx < numAssets; idx++) {
                    if (utxo.assets[idx].tokenId === this.ccTokenId) {
                        // Found UTXO that currently holds non-fungible token.
                        //  Check if it can be accepted
                        if (this.useUnconfirmedUtxo || utxo.confirmations > 0) {
                            foundUtxo = utxo;
                            assetIdx = idx;
                        }

                        break;
                    }
                }

                if (foundUtxo) {
                    break;
                }
            }
        }

        if (foundUtxo) {
            // Get list of non-fungible token IDs in UTXO
            const nfAssetInfo = foundUtxo.assets[assetIdx];
            const nfTokenIds = [];

            for (const asset of foundUtxo.assets) {
                if (asset.assetId !== nfAssetInfo.assetId) {
                    Catenis.logger.WARN('UTXO contains Colored Coins asset entries for different assets. Non-fungible token holding UTXO is being discarded', foundUtxo);
                    return;
                }

                nfTokenIds.push(asset.tokenId);
            }

            // Validate UTXO type
            const outputType = BitcoinInfo.getOutputTypeByDescriptor(foundUtxo.desc);

            if (outputType && (outputType === BitcoinInfo.outputType.witness_v0_keyhash || outputType === BitcoinInfo.outputType.pubkeyhash)) {
                foundUtxo = {
                    address: foundUtxo.address,
                    txid: foundUtxo.txid,
                    vout: foundUtxo.vout,
                    type: outputType.name,
                    isWitness: outputType.isWitness,
                    scriptPubKey: foundUtxo.scriptPubKey,
                    amount: new BigNumber(foundUtxo.amount).times(100000000).toNumber(),
                    ccAssetId: nfAssetInfo.assetId,
                    assetAmount: nfTokenIds.length,
                    assetDivisibility: nfAssetInfo.divisibility,
                    isAggregatableAsset: false,
                    isNonFungible: true,
                    ccTokenIds: nfTokenIds,
                    tokenIndex: assetIdx,
                    confirmations: foundUtxo.confirmations
                };

                if (foundUtxo.confirmations === 0) {
                    // Non-fungible token holding UTXO not yet confirmed.
                    //  Get descendants and ancestors info for UTXO, and check if it can be accepted
                    let mempoolTxInfo;

                    try {
                        mempoolTxInfo = Catenis.bitcoinCore.getMempoolEntryWithAncestors(foundUtxo.txid, false);
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

                    if (mempoolTxInfo !== null) {
                        if (
                            (this.ancestorsCountUpperLimit && mempoolTxInfo.ancestorcount > this.ancestorsCountUpperLimit)
                            || (this.ancestorsSizeUpperLimit && mempoolTxInfo.ancestorsize > this.ancestorsSizeUpperLimit)
                            || (this.descendantsCountUpperLimit && mempoolTxInfo.descendantcount > this.descendantsCountUpperLimit)
                            || (this.descendantsSizeUpperLimit && mempoolTxInfo.descendantsize > this.descendantsSizeUpperLimit)
                        ) {
                            // UTXO cannot be accepted. So abort processing, and discard non-fungible
                            //  holding UTXO
                            return;
                        }
                    }
                    else {
                        // Transaction of UTXO not in mempool; it must have been already confirmed
                        //  (in the meantime between the calls to 'c3NodeClient.getAddressesUtxos()'
                        //  and 'bitcoinCore.getMempoolEntryWithAncestors()'). So retrieve transaction
                        //  information to get confirmation status
                        Catenis.logger.DEBUG('Transaction of UTXO not in mempool', {
                            txid: foundUtxo.txid,
                            vout: foundUtxo.vout
                        });
                        let txInfo;

                        try {
                            txInfo = Catenis.bitcoinCore.getTransaction(foundUtxo.txid, false);
                        }
                        catch (err2) {
                            Catenis.logger.ERROR('Error trying to get confirmation status of transaction (txid: %s) associated with UTXO that is not in the mempool', foundUtxo.txid, err2);
                        }

                        if (txInfo && txInfo.confirmations > 0) {
                            // Transaction has indeed been confirmed. So prepare to update its confirmation status
                            foundUtxo.confirmations = txInfo.confirmations;
                        }
                        else {
                            // Either confirmation status could not be retrieved or it indicates that
                            //  transaction has been replaced by another one (confirmations < 0). So
                            //  abort processing, and discard the non-fungible token holding UTXO
                            return;
                        }
                    }
                }

                // Non-fungible token holding UTXO is accepted. Save its information
                this.holdingUtxo = {
                    address: foundUtxo.address,
                    txout: {
                        txid: foundUtxo.txid,
                        vout: foundUtxo.vout,
                        amount: foundUtxo.amount,
                        ccAssetId: foundUtxo.ccAssetId,
                        assetAmount: foundUtxo.assetAmount,
                        assetDivisibility: foundUtxo.assetDivisibility,
                        isAggregatableAsset: foundUtxo.isAggregatableAsset,
                        isNonFungible: foundUtxo.isNonFungible,
                        ccTokenIds: foundUtxo.ccTokenIds
                    },
                    isWitness: foundUtxo.isWitness,
                    scriptPubKey: foundUtxo.scriptPubKey,
                    tokenIndex: foundUtxo.tokenIndex
                };
            }
            else {
                // UTXO of an unexpected type
                Catenis.logger.WARN('Unexpected output type. Non-fungible token holding UTXO is being discarded', foundUtxo);
            }
        }
    }
}


// Definition of module (private) functions
//


// Module code
//

// Lock class
Object.freeze(NFTokenSource);
