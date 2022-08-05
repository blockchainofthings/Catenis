/**
 * Created by Claudio on 2017-10-30.
 */

//console.log('[CCTransaction.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import config from 'config';
import _und from 'underscore';
import ccAssetIdEncoder from 'catenis-colored-coins/cc-assetid-encoder';
import CCBuilder from 'catenis-colored-coins/cc-transaction';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import {
    Transaction,
    cfgSettings as txCfgSettings,
    fixClone as txFixClone
} from './Transaction';
import { CCMetadata } from './CCMetadata';
import { Util } from './Util';
import { BitcoinInfo } from './BitcoinInfo';

// Config entries
const ccTransactConfig = config.get('ccTransaction');

// Configuration settings
const cfgSettings = {
    ccProtocolPrefix: ccTransactConfig.get('ccProtocolPrefix'),
    c3ProtocolPrefix: ccTransactConfig.get('c3ProtocolPrefix'),
    ccVersionByte: ccTransactConfig.get('ccVersionByte'),
    torrentHashSize: ccTransactConfig.get('torrentHashSize'),
    sha2Size: ccTransactConfig.get('sha2Size')
};


// Definition of function classes
//

// CCTransaction function class
//
//  NOTE: the entries marked with an asterisk below are exclusive for Colored Coins assets related inputs/outputs.
//      The other entries are identical to regular transaction entries
//
//  input: {
//    txout: {  - Unspent output being spent
//      txid: [String],
//      vout: [Number],
//      amount: [number]  - Amount, in satoshis
// *    ccAssetId: [String],            - Colored Coins attributed ID of the asset
// *    assetAmount: [Number],          - Asset amount represented as an integer number of the asset's smallest division (according to the asset divisibility). For non-fungible assets this is the number of non-fungible tokens (length of ccTokenIds)
// *    assetDivisibility: [Number],    - Number of decimal places allowed for representing quantities of this asset
// *    isAggregatableAsset: [Boolean], - Indicates whether quantities of the asset from different UTXOs can be combined to allocate the necessary fund
// *    isNonFungible: [Boolean],       - (optional, only present for non-fungible assets) Indicates whether this is a non-fungible asset
// *    ccTokenIds: [Array(String)]     - (optional, only present for non-fungible assets) List of Colored Coins attributed IDs of the non-fungible tokens of that asset that are contained in this UTXO
//    },
//    address:  - (optional) Blockchain address associated with unspent output being spent
//    addrInfo: {  - Info about blockchain address associated with unspent output being spent (as returned by Catenis.keyStore.getAddressInfo())
//                    Should only exist for Catenis blockchain addresses
//      cryptoKeys: [Object(CryptoKeys)],  - Pair of crypto keys associated with this address
//      type: [String],  - Type of address from Catenis.KeyStore.extKeyType
//      path: [String],  - Path of the HD extended key associated with this address
//      parentPath: [String],  - Path of the root HD extended key associated with this address
//      isObsolete: [Boolean], - Indicates whether this address is not in used anymore
//      pathParts: [Object]    - Object with components that make up the HD extended key path associated with this address
//    }
//  }
//
//  output: {
//    type: [Object],  - Object representing the type of the tx output. Valid values: any of the properties of BitcoinInfo.outputType
//    payInfo: {       - Should exist for a paying output type (any type other than 'nulldata' or 'unknown')
//      address: [String|Array(String)], - Blockchain address to where payment should be sent.
//                                          NOTE: for 'multisig' outputs, this is actually a list of addresses
//      nSigs: [Number], - Number of signatures required to spend multi-signature output. Should only exist for 'multisig' output type
//      amount: [Number],  - Amount, in satoshis, to send
// *    ccAssetId: [String],           - Colored Coins attributed ID of the asset (null for newly issued locked asset)
// *    assetAmount: [Number],         - Asset amount represented as an integer number of the asset's smallest division (according to the asset divisibility)
// *    assetDivisibility: [Number],   - Number of decimal places allowed for representing quantities of this asset
// *    ccTokenIds: [Array(Number)],   - (optional, only present for non-fungible assets) List of Colored Coins attributed IDs of the non-fungible tokens of that asset
//      addrInfo: [Object|Array(Object|String)] {  - Info about blockchain address to where payment should be sent (as returned by Catenis.keyStore.getAddressInfo()).
//                                                    Should only exist for 'multisig' output type or for any other type when transaction is deserialized (generated from
//                                                    Transaction.fromHex()) and it is a Catenis blockchain address.
//                                                    NOTE: for 'multisig' outputs, this is actually a list of either addrInfo objects (for Catenis blockchain addresses)
//                                                          or hex-encoded public keys (for non-Catenis blockchain addresses)
//        cryptoKeys: [Object(CryptoKeys)], - Pair of crypto keys associated with this address
//        type: [String],  - Type of address from Catenis.KeyStore.extKeyType
//        path: [String],  - Path of the HD extended key associated with this address
//        parentPath: [String],  - Path of the root HD extended key associated with this address
//        isObsolete: [Boolean], - Indicates whether this address is not in used anymore
//        pathParts: [Object]    - Object with components that make up the HD extended key path associated with this address
//      }
//    },
//    data: [Object(Buffer)] - Should only exist for 'nullData' output type
//  }
export class CCTransaction extends Transaction {
    constructor (useOptInRBF = false) {
        super(useOptInRBF);

        /**
         * Colored Coins transaction asset issuing information
         * @typedef {Object} CCTxAssetIssuingInfo
         * @property {string} ccAssetId Colored Coins attributed ID of the asset
         * @property {number} assetAmount Amount of asset to issue. For non-fungible assets, it is the number of
         *                                 non-fungible tokens.
         * @property {string} type Issuing type of the asset. Either 'locked' or 'unlocked' (a property of
         *                          CCTransaction.issuingAssetType).
         * @property {number} divisibility Number of decimal places allowed for representing quantities of this asset.
         *                                  Should always be set to 0 (zero) for non-fungible assets.
         * @property {boolean} isAggregatable Indicates whether quantities of the asset from different UTXOs can be
         *                                     combined to allocate the necessary fund. Should always be set to false
         *                                     for non-fungible assets.
         * @property {boolean} isNonFungible Indicates whether this is a non-fungible asset.
         * @property {string[]} [ccTokenIds] List of Colored Coins attributed IDs of the non-fungible tokens to issue.
         */

        /**
         * Information for issuing new assets
         * @type {(CCTxAssetIssuingInfo|undefined)}
         */
        this.issuingInfo = undefined;

        /**
         * Colored Coins transaction transfer input sequence
         * @typedef {Object} CCTxTransferInputSequence
         * @property {number} startPos Position of the first input of the sequence.
         * @property {number} nInputs Number of inputs in the sequence.
         */

        /**
         * List of transfer input sequences.
         *
         * Note: the transfer input sequences are ordered in regard to its start position from lower to higher, and
         *        there should be no gap between one input sequence and the following one (one must start at the
         *        following input position after the last input of the previous sequence).
         *
         * @type {CCTxTransferInputSequence[]}
         */
        this.transferInputSeqs = [];

        /**
         * Colored Coins transaction transfer output
         * @typedef {Object} CCTxTransferOutput
         * @property {number} inputSeqStartPos Start position of transfer input sequence from where assets should come.
         * @property {(string|undefined)} address Blockchain address to where assets should be sent, or undefined if
         *                                         asset amount should instead be burnt.
         * @property {number} assetAmount Amount of assets that is to be sent to that output. For non-fungible assets,
         *                                 it is the number of non-fungible tokens.
         * @property {boolean} [reverseOutput] This controls how the transfer output will be mapped to a tx output. If
         *                                      not present or set to false, it follows the natural order of the
         *                                      transfer output within the transfer input sequence. When set to true, a
         *                                      reverse order (from last to first) should be used instead.
         */

        /**
         * List of transfer outputs.
         *
         * Note: the transfer outputs are ordered in regard to its input sequence start position from lower to higher.
         *
         * @type {CCTxTransferOutput[]}
         */
        this.transferOutputs = [];

        /**
         * @type {(CCMetadata|undefined)}
         */
        this.ccMetadata = undefined;

        this.isAssembled = false;
        this.includesMultiSigOutput = false;
        this.numCcTransferOutputs = 0;

        //  NOTE: arrow functions should NOT be used for the getter/setter of the defined properties.
        //      This is to avoid that, if `this` is referred from within the getter/setter body, it
        //      refers to the object from where the properties have been defined rather than to the
        //      object from where the property is being accessed. Normally, this does not represent
        //      an issue (since the object from where the property is accessed is the same object
        //      from where the property has been defined), but it is especially dangerous if the
        //      object can be cloned.
        Object.defineProperties(this, {
            numTotalCcInputs: {
                get: function () {
                    return this.countTransferInputs() + (this.issuingInfo ? 1 : 0);
                },
                enumerable: true
            },
            numTotalCcOutputs: {
                get: function () {
                    return this.numCcTransferOutputs + (this.includesMultiSigOutput ? 2 : 1);
                },
                enumerable: true
            }
        });
    }

    /**
     * Gets the number of payment tx outputs that exist before the null data output (and the
     *  and the multisig output if it exists). Those outputs (if they exist) are the target
     *  for a Colored Coins range payment.
     *
     *  Note: this will only report the correct number after the Colored Coins transaction
     *   has been assembled.
     *
     * @returns {number}
     */
    get numPayOutputsBeforeNullData() {
        let nullDataPos;

        return (nullDataPos = this.getNullDataOutputPosition()) !== undefined
            ? nullDataPos - (this.includesMultiSigOutput ? 1 : 0)
            : 0;
    }

    /**
     * Indicates whether this Colored Coins transaction is used to issue an asset (of any type).
     * @returns {boolean}
     */
    get hasIssuance() {
        return this.issuingInfo !== undefined;
    }

    /**
     * Indicates whether this Colored Coins transaction is used to issue a regular (fungible) asset.
     * @returns {boolean}
     */
    get isIssuingAsset() {
        return this.issuingInfo !== undefined && !this.issuingInfo.isNonFungible;
    }

    /**
     * Indicates whether this Colored Coins transaction is used to issue a non-fungible asset.
     * @returns {boolean}
     */
    get isIssuingNFAsset() {
        return this.issuingInfo !== undefined && this.issuingInfo.isNonFungible && this.issuingInfo.ccTokenIds
            && this.issuingInfo.ccTokenIds.length > 0;
    }

    /**
     * Indicates whether this Colored Coins transaction is used to transfer asset units.
     * @returns {boolean}
     */
    get hasTransfer() {
        return this.transferInputSeqs.length > 0;
    }

    /**
     * Indicates whether this Colored Coins transaction is used to transfer amounts of regular (fungible) assets.
     * @returns {boolean}
     */
    get isTransferringAsset() {
        return this.transferInputSeqs.length > 0
            && this.transferInputSeqs.some(inputSeq => !this.getInputAt(inputSeq.startPos).txout.isNonFungible);
    }

    /**
     * Indicates whether this Colored Coins transaction is used to transfer non-fungible tokens.
     * @returns {boolean}
     */
    get isTransferringNFToken() {
        return this.transferInputSeqs.length > 0
            && this.transferInputSeqs.some(inputSeq => this.getInputAt(inputSeq.startPos).txout.isNonFungible);
    }
}

// Public CCTransaction object methods
//

// Add input to be used for issuing a quantity of a given Colored Coins asset
//
// Arguments:
//  txout: {  - Unspent tx output to spent
//    txid: [String],
//    vout: [Number],
//    amount: [number]  - Amount, in satoshis
//  }
//  outputInfo: {
//    isWitness: [Boolean],    - Indicates whether unspent tx output is of a (segregated) witness type
//    scriptPubKey: [String],  - (not required for non-witness outputs) Hex-encoded public key script of unspent tx output
//    address: [String],       - Blockchain address associated with unspent tx output
//    addrInfo: [Object]       - Catenis address info including crypto key pair required to spend output
//  }
//  assetAmount: [Number] - Amount (quantity) of asset to be issued
//  opts: {
//    type: [String],  - (optional, default: 'locked') Issuing type of asset. Either 'locked' or 'unlocked' (a property of CCTransaction.issuingAssetType)
//    divisibility: [Number], - (optional, default: 0) Number of decimal places allowed for representing quantities of this asset
//    isAggregatable: [Boolean] - (optional, default: true) Indicates whether quantities of the asset from different UTXOs can be combined to allocate the necessary fund
//    isNonFungible: [Boolean] - (optional, default: false) Indicates whether this is a non-fungible asset. In that case, the asset amount represents the number of non-fungible tokens to issue
//  }
//
//  Return:
//   result: [Boolean|Object] - True if issuing input is successfully added, or false if it could not be added due to an error.
//                               If a previous issuing input is replaced, the previous issuing input object is returned instead of true
CCTransaction.prototype.addIssuingInput = function (txout, outputInfo, assetAmount, opts) {
    let result = true;

    if (!this.isBurnOutputSet()) {
        opts = opts === undefined ? {} : opts;

        const issuingOpts = {
            type: opts.type !== undefined ? opts.type : CCTransaction.issuingAssetType.locked,
            divisibility: opts.divisibility !== undefined ? opts.divisibility : 0,
            isAggregatable: opts.isAggregatable !== undefined ? opts.isAggregatable : true,
            isNonFungible: opts.isNonFungible !== undefined ? opts.isNonFungible : false
        };

        // Prepare info for new asset to be issued
        const newIssuingInfo = {
            ccAssetId: getAssetId(txout, outputInfo.address, issuingOpts),
            assetAmount: assetAmount,
            ...issuingOpts
        };

        if (issuingOpts.isNonFungible) {
            newIssuingInfo.ccTokenIds = getNFTokenIds(txout, outputInfo.address, issuingOpts, assetAmount);
        }

        if (this.issuingInfo !== undefined) {
            // Another issuing input had already been added.
            //  Log warning condition and make sure the previous input is removed
            Catenis.logger.WARN('An issuing input had already been added to Colored Coins transaction and shall be replace with this new one', {
                previousIssuingInfo: this.issuingInfo,
                newIssuingInfo: newIssuingInfo
            });
            this.removeInputAt(0);

            // Prepare to return previous issuing input
            result = this.issuingInfo;
        }

        // Reset transaction before performing task
        this.reset();

        this.issuingInfo = newIssuingInfo;

        // Make sure that this is the first input of the transaction
        this.addInput(txout, outputInfo, 0);

        if (result === true) {
            // Adjust start position of all input sequences only if not
            //  replacing a previous asset issuing request
            offsetTransferInputStartPos.call(this, 0, 1);
        }
    }
    else {
        // Trying to issue new asset when assets are designated to be burnt
        //  Log error condition, and return indicating error
        Catenis.logger.ERROR('Cannot issue new assets when designating assets to burn');
        result = false;
    }

    return result;
};

// Adds one or more inputs to Colored Coins transaction designating assets that should be transferred
//
//  Arguments:
//   inputs: [Array(Object)|Object] - List of UTXOs containing Colored Coins asset info to be used as inputs for Colored Coins transaction
//   inputSeqStartPos: [Number] - (optional) Position of first input of transfer input sequence into which inputs should be added
//   insertBefore: [Boolean] - (optional, default = false) Indicates that inputs should actually be added to a new transfer input sequence that
//                              should be inserted before the one referenced by the inputSeqStartPos argument
//
//  Return:
//   inputSeqStartPos: [Number] - Input position of first input (startPos field) of transfer input sequence into which inputs have been added.
//   undefined - if no inputs are added (due to an error)
CCTransaction.prototype.addTransferInputs = function (inputs, inputSeqStartPos, insertBefore = false) {
    if (!Array.isArray(inputs)) {
        inputs = [inputs];
    }

    // Validate inputs making sure that they have Colored Coins info for the same asset
    let lastCcAssetId;

    inputs.forEach((input) => {
        if (input.txout.ccAssetId !== undefined) {
            if (lastCcAssetId === undefined) {
                lastCcAssetId = input.txout.ccAssetId;
            }
            else if (lastCcAssetId !== input.txout.ccAssetId) {
                // Input is for a different asset.
                //  Log error condition, and return indicating error
                Catenis.logger.ERROR('Trying to add one or more transfer inputs to Colored Coins transaction that contain info for different assets; no inputs added', {
                    inputs: inputs
                });
                return undefined;
            }
        }
        else {
            // Input does not contain Colored Coins asset info.
            //  Log error condition, and return indicating error
            Catenis.logger.ERROR('Trying to add one or more transfer inputs to Colored Coins transaction that does not have Colored Coins info; no inputs added', {
                inputs: inputs
            });
            return undefined;
        }
    });

    if (inputSeqStartPos !== undefined) {
        // Try to retrieve transfer input sequence
        const inputSeq = getTransferInputSeq.call(this, inputSeqStartPos);

        if (inputSeq !== undefined) {
            if (insertBefore) {
                // Add inputs to a new transfer input sequence with specified start position
                const newInputSeq = addNewTransferInputSeq.call(this, inputs.length, inputSeqStartPos);
                this.addInputs(inputs, newInputSeq.startPos);

                return newInputSeq.startPos;
            }
            else {
                // Make sure that inputs being added are for the same asset as the input sequence
                //  and that the asset can be aggregated
                const firstInputOfSeq = this.getInputAt(inputSeq.startPos);

                if (firstInputOfSeq.txout.ccAssetId === inputs[0].txout.ccAssetId
                        && (firstInputOfSeq.txout.isAggregatableAsset || firstInputOfSeq.txout.isNonFungible)) {
                    // Add new inputs to existing transfer input sequence
                    this.addInputs(inputs, inputSeq.startPos + inputSeq.nInputs);
                    incrementInputsOfTransferInputSeq.call(this, inputSeq, inputs.length);

                    return inputSeqStartPos;
                }
                else {
                    // Inputs being added is for a different asset or asset cannot be aggregated.
                    //  Log waring condition
                    Catenis.logger.WARN('Transfer inputs to be added to existing transfer input sequence are for a different Colored Coins asset or asset cannot be aggregated; adding transfer inputs to a new transfer input sequence', {
                        inputSeqStartPos: inputSeqStartPos,
                        firstInputOfSeq: firstInputOfSeq,
                        inputs: inputs
                    });
                    // Let processing to continue so inputs are added to a new transfer input sequence
                }
            }
        }
        else {
            // There is no transfer input sequence with specified start position
            if (!insertBefore || this.transferInputSeqs.length > 0) {
                // Log warning condition except if insert before is requested and there
                //  are no transfer input sequences
                Catenis.logger.WARN('Specified transfer input sequence to add new transfer inputs does not exist; adding transfer inputs to a new transfer input sequence', {
                    transferInputSeqs: this.transferInputSeqs,
                    inputSeqStartPos: inputSeqStartPos
                });
            }

            // Let processing to continue so inputs are added to a new transfer input sequence at the end of the list
        }
    }

    // Add inputs to a new transfer input sequence
    const newInputSeq = addNewTransferInputSeq.call(this, inputs.length);
    this.addInputs(inputs, newInputSeq.startPos);

    return newInputSeq.startPos;
};

// Adds a single input to Colored Coins transaction designating assets that should be transferred
//
//  Arguments:
//   txout: [Object] - UTXO containing Colored Coins asset to be used as inputs for Colored Coins transaction
//   outputInfo [Object] {
//     isWitness: [Boolean],    Indicates whether unspent tx output is of a (segregated) witness type
//     scriptPubKey: [String],  (not required for non-witness outputs) Hex-encoded public key script of unspent tx output
//     address: [String],       Blockchain address associated with unspent tx output
//     addrInfo: [Object]       Catenis address info including crypto key pair required to spend output
//   }
//   inputSeqStartPos: [Number] - (optional) Position of first input of transfer input sequence into which inputs should be added
//   insertBefore: [Boolean] - (optional, default = false) Indicates that inputs should actually be added to a new transfer input sequence that
//                              should be inserted before the one reference by the inputSeqStartPos argument
//
//  Return:
//   inputSeqStartPos: [Number] - Input position of first input (startPos field) of transfer input sequence into which inputs have been added
//   undefined - If input is not added (due to an error)
CCTransaction.prototype.addTransferInput = function (txout, outputInfo, inputSeqStartPos, insertBefore = false) {
    return this.addTransferInputs({
        txout: txout,
        ...outputInfo
    }, inputSeqStartPos, insertBefore);
};

// Remove transfer inputs sequence and all its related transfer outputs
//
//  Arguments:
//   startPos: [Number] - Start position of transfer input sequence to remove
//
//  Return:
//   success: [Boolean] - True if input sequence is successfully removed, or false if input sequence has not
//                         been removed (possibly due to an error)
CCTransaction.prototype.removeTransferInputSequence = function (startPos) {
    // Try to retrieve transfer input sequence
    const inputSeq = getTransferInputSeq.call(this, startPos);

    if (inputSeq !== undefined) {
        // Remove associated transfer outputs
        this.removeTransferOutputs(inputSeq.startPos);

        // Remove inputs from transaction
        this.removeInputs(inputSeq.startPos, inputSeq.nInputs);

        // Now remove transfer input sequence entry...
        this.transferInputSeqs.splice(getTransferInputSeqIndex.call(this, inputSeq.startPos), 1);

        // and adjust start position of all subsequent input sequences
        offsetTransferInputStartPos.call(this, inputSeq.startPos + inputSeq.nInputs, -inputSeq.nInputs);

        return true;
    }

    return false;
};

// Get information about asset amount associated with a given transfer input sequence
//
//  Arguments:
//   startPos: [Number] - Position of first input of transfer input sequence
//
//  Return: the following object or undefined if transfer input sequence does not exist
//   result: {
//     asset: {
//       ccAssetId: [String],
//       divisibility: [Number],
//       isAggregatable: [Boolean]
//     },
//     assetAmount: {
//       totalInput: [Number], - Total asset amount at inputs of transfer input sequence
//       totalTransfer: [Number] - Total asset amount designated to be transferred
//       totalBurn: [Number] - Total asset amount designated to be burnt
//       remainingInput: getter([Number]) - Total asset amount still remaining at input (neither designated
//                                           to be transferred nor burnt)
//     }
//   }
CCTransaction.prototype.getTransferInputSeqAssetAmountInfo = function (startPos) {
    let result;

    const inputSeq = getTransferInputSeq.call(this, startPos);

    if (inputSeq !== undefined || (startPos === 0 && this.issuingInfo !== undefined)) {
        result = {
            asset: undefined,
            assetAmount: {
                totalInput: 0,
                totalTransfer: 0,
                totalBurn: 0
            }
        };

        Object.defineProperty(result.assetAmount, 'remainingInput', {
            get: function () {
                return this.totalInput - (this.totalTransfer + this.totalBurn);
            },
            enumerable: true
        });

        if (inputSeq !== undefined) {
            // Get Colored Coins asset info
            const firstInputOfSeq = this.getInputAt(inputSeq.startPos);

            result.asset = {
                ccAssetId: firstInputOfSeq.txout.ccAssetId,
                divisibility: firstInputOfSeq.txout.assetDivisibility,
                isAggregatable: firstInputOfSeq.txout.isAggregatableAsset,
                isNonFungible: firstInputOfSeq.txout.isNonFungible,
                ccTokenIds: firstInputOfSeq.txout.ccTokenIds
            };

            // Compute total asset amount at inputs
            for (let pos = inputSeq.startPos, limit = inputSeq.startPos + inputSeq.nInputs; pos < limit; pos++) {
                result.assetAmount.totalInput += this.getInputAt(pos).txout.assetAmount;
            }
        }
        else {
            // Special case for new assets being issued
            result.asset = {
                ccAssetId: this.issuingInfo.ccAssetId,
                divisibility: this.issuingInfo.divisibility,
                isAggregatable: this.issuingInfo.isAggregatable,
                isNonFungible: this.issuingInfo.isNonFungible,
                ccTokenIds: this.issuingInfo.ccTokenIds
            };
            result.assetAmount.totalInput = this.issuingInfo.assetAmount;
        }

        // Compute total asset amount to transfer and to burn
        for (let idx = 0, limit = this.transferOutputs.length; idx < limit; idx++) {
            const transferOutput = this.transferOutputs[idx];

            if (transferOutput.inputSeqStartPos === startPos) {
                if (transferOutput.address !== undefined) {
                    result.assetAmount.totalTransfer += transferOutput.assetAmount;
                }
                else {
                    result.assetAmount.totalBurn += transferOutput.assetAmount;
                }
            }
        }
    }

    return result;
};

CCTransaction.prototype.countTransferInputs = function () {
    return this.transferInputSeqs.reduce((sum, inputSeq) => {
        return sum + inputSeq.nInputs;
    }, 0);
};

/**
 * @typedef {Object} CCTxOutputInfoForTransfer
 * @property {string} address Blockchain address to where assets should be sent.
 * @property {number} assetAmount Amount of asset to transfer. For non-fungible assets, it is the number of
 *                                 non-fungible tokens. Note: it can be a negative value.
 * @property {boolean} [reverseOutput] Indicates whether the output order should be reversed.
 */

/**
 * Sets one or more transfer output entries designating where Colored Coins assets should be transferred to.
 * @param {(CCTxOutputInfoForTransfer[]|CCTxOutputInfoForTransfer)} outputs List of output objects
 * @param {number} inputSeqStartPos Start position of transfer input sequence from where assets should come.
 * @param {boolean} [aggregateOutputs=true] Indicates whether the passed in outputs should be aggregated onto the same
 *                                           blockchain address among themselves and the other existing outputs.
 * @return {boolean}
 */
CCTransaction.prototype.setTransferOutputs = function (outputs, inputSeqStartPos, aggregateOutputs = true) {
    // Try to retrieve transfer input sequence
    const inputSeq = getTransferInputSeq.call(this, inputSeqStartPos);

    if (inputSeq !== undefined || (inputSeqStartPos === 0 && this.issuingInfo !== undefined)) {
        if (!Array.isArray(outputs)) {
            // noinspection JSValidateTypes
            outputs = [outputs];
        }

        // Compute total asset amount to transfer/burn, and already group outputs by blockchain address
        //  if aggregating outputs
        let totalTransferAssetAmount = 0;
        const outputsByAddress = new Map();

        outputs.forEach((output) => {
            totalTransferAssetAmount += output.assetAmount;

            if (aggregateOutputs) {
                if (outputsByAddress.has(output.address)) {
                    outputsByAddress.get(output.address).assetAmount += output.assetAmount;
                }
                else {
                    outputsByAddress.set(output.address, output);
                }
            }
        });

        // Make sure that specified transfer input sequence has enough asset amount to fulfill the transfer
        const assetAmountInfo = this.getTransferInputSeqAssetAmountInfo(inputSeqStartPos);
        const finalInputRemainingAssetAmount = assetAmountInfo.assetAmount.remainingInput - totalTransferAssetAmount;

        if (finalInputRemainingAssetAmount >= 0) {
            let negativeAssetAmountToDiscard = 0;

            // Find right position to insert transfer output
            let idx = 0;
            const transferOutputsToAdjust = []; // Entry = [idx, newAmount]
            const transferOutputsToRemove = []; // Entry = [idx, count]

            for (let limit = this.transferOutputs.length; idx < limit; idx++) {
                const transferOutput = this.transferOutputs[idx];

                if (transferOutput.inputSeqStartPos === inputSeqStartPos) {
                    if (aggregateOutputs && outputsByAddress.has(transferOutput.address)) {
                        // Prepare to merge new output with transfer output that already exists
                        //  and sends asset to same address
                        let adjustedAssetAmount = transferOutput.assetAmount + outputsByAddress.get(transferOutput.address).assetAmount;

                        // Make sure that resulting asset amount is positive
                        if (adjustedAssetAmount > 0) {
                            transferOutputsToAdjust.push([idx, adjustedAssetAmount]);
                        }
                        else {
                            // Set transfer output to be removed
                            let firstEntry;

                            if (transferOutputsToRemove.length > 0 && (firstEntry = transferOutputsToRemove[0]) && firstEntry[0] + firstEntry[1] === idx) {
                                firstEntry[1]++;
                            }
                            else {
                                // Add to beginning of list so removal is done from the higher to the lower index
                                transferOutputsToRemove.unshift([idx, 1]);
                            }

                            if (adjustedAssetAmount < 0) {
                                // Accumulate negative value to be discarded
                                negativeAssetAmountToDiscard -= adjustedAssetAmount;
                            }
                        }

                        outputsByAddress.delete(transferOutput.address);
                    }
                }
                else if (transferOutput.inputSeqStartPos > inputSeqStartPos) {
                    // Transfer output is associated with a subsequent transfer input sequence.
                    //  Stop search
                    break;
                }
            }

            // Identify new transfer outputs to be added and if there are more negative
            //  values to be discarded
            /**
             * @type {CCTxTransferOutput[]}
             */
            let transferOutputsToAdd = [];
            /**
             * @type {CCTxOutputInfoForTransfer[]}
             */
            const outputsSource = aggregateOutputs
                ? (outputsByAddress.size > 0 ? Array.from(outputsByAddress.values()) : [])
                : outputs;

            if (outputsSource.length > 0) {
                transferOutputsToAdd = outputsSource.reduce((list, output) => {
                    if (output.assetAmount > 0) {
                        list.push({
                            inputSeqStartPos: inputSeqStartPos,
                            address: output.address,
                            assetAmount: output.assetAmount,
                            reverseOutput: output.reverseOutput
                        });
                    }
                    else if (output.assetAmount < 0) {
                        negativeAssetAmountToDiscard -= output.assetAmount;
                    }

                    return list;
                }, transferOutputsToAdd);
            }

            // Make sure that specified transfer input sequence still has enough asset amount to fulfill the transfer
            if (finalInputRemainingAssetAmount >= negativeAssetAmountToDiscard && (transferOutputsToAdjust.length > 0
                        || transferOutputsToRemove.length > 0 || transferOutputsToAdd.length > 0)) {
                // Reset transaction before making changes
                this.reset();

                if (transferOutputsToAdjust.length > 0) {
                    transferOutputsToAdjust.forEach((entry) => {
                        this.transferOutputs[entry[0]].assetAmount = entry[1];
                    })
                }

                if (transferOutputsToRemove.length > 0) {
                    transferOutputsToRemove.forEach((entry) => {
                        // Remove existing transfer outputs...
                        Array.prototype.splice.apply(this.transferOutputs, entry);

                        // and adjust insertion index
                        idx -= entry[1];
                    });
                }

                if (transferOutputsToAdd.length > 0) {
                    // noinspection JSCheckFunctionSignatures
                    Array.prototype.splice.apply(this.transferOutputs, [idx, 0].concat(transferOutputsToAdd));
                }
            }
            else {
                // Not enough asset amount at transfer input sequence to be transferred.
                //  Log error condition, and return indicating error
                Catenis.logger.ERROR('Transfer input sequence does not have enough remaining asset amount for setting transfer outputs for Colored Coins transaction; no outputs set', {
                    inputSeqStartPos: inputSeqStartPos,
                    outputs: outputs,
                    transferInputSeqAssetAmountInfo: assetAmountInfo,
                    totalTransferAssetAmount: totalTransferAssetAmount,
                    negativeAssetAmountToDiscard: negativeAssetAmountToDiscard
                });
                return false;
            }
        }
        else {
            // Not enough asset amount at transfer input sequence to be transferred.
            //  Log error condition, and return indicating error
            Catenis.logger.ERROR('Transfer input sequence does not have enough remaining asset amount for setting transfer outputs for Colored Coins transaction; no outputs set', {
                inputSeqStartPos: inputSeqStartPos,
                outputs: outputs,
                transferInputSeqAssetAmountInfo: assetAmountInfo,
                totalTransferAssetAmount: totalTransferAssetAmount
            });
            return false;
        }
    }
    else {
        // There is no transfer input sequence with specified start position.
        //  Log error condition, and return indicating error
        Catenis.logger.ERROR('Transfer input sequence specified as source for setting transfer outputs for Colored Coins transaction does not exist; no outputs set', {
            transferInputSeqs: this.transferInputSeqs,
            inputSeqStartPos: inputSeqStartPos,
            outputs: outputs
        });
        return false;
    }

    return true;
};

/**
 * Sets a single transfer output entry designating where Colored Coins assets should be transferred to.
 * @param {string} address Blockchain address to where assets should be sent.
 * @param {number} assetAmount Amount of asset to transfer. For non-fungible assets, it is the number of non-fungible
 *                              tokens.
 * @param {number} inputSeqStartPos Start position of transfer input sequence from where assets should come.
 * @param {boolean} [reverseOutput=false] Indicates whether the output order should be reversed.
 * @param {boolean} [aggregateOutput=true] Indicates whether the passed in output should be aggregated onto the same
 *                                          blockchain address among the other existing outputs.
 * @return {boolean} True if output is correctly set, or false if output is not set (due to an error).
 */
CCTransaction.prototype.setTransferOutput = function (address, assetAmount, inputSeqStartPos, reverseOutput = false, aggregateOutput = true) {
    return this.setTransferOutputs({
        address,
        assetAmount,
        reverseOutput
    }, inputSeqStartPos, aggregateOutput);
};

// Sets a transfer output entry designating assets to be burnt (instead of being transferred)
//
//  Arguments:
//   assetAmount: [Number] - Amount of asset to burn
//   inputSeqStartPos: [Number] - Start position of transfer input sequence from where assets should come
//
//  Return:
//   success: [Boolean] - True if output is correctly set, or false if output is not set (due to an error)
//
//  NOTE: assets cannot be burnt in a transaction used to issue new assets
CCTransaction.prototype.setBurnOutput = function (assetAmount, inputSeqStartPos) {
    if (this.issuingInfo === undefined) {
        return this.setTransferOutputs({
            address: undefined,
            assetAmount: assetAmount
        }, inputSeqStartPos);
    }
    else {
        // Trying to designate assets to burn when issuing new assets.
        //  Log error condition, and return indicating error
        Catenis.logger.ERROR('Cannot designate assets to burn when issuing new assets');
        return false;
    }
};

CCTransaction.prototype.isBurnOutputSet = function () {
    return this.transferOutputs.some((transferOutput) => transferOutput.address === undefined);
};

// Sets a special transfer outputs entry designating that Colored Coins assets still remaining
//  at a transfer input sequence should be transferred to
//
//  Arguments:
//   address: [String] - Blockchain address to where assets should be sent
//   inputSeqStartPos: [Number] - Start position of transfer input sequence from where assets should come
//
//  Return:
//   assetAmount: [Number] - If a positive number, indicates that change output was set and the value returned is the change amount designated
//                            to be transferred. If zero or a negative number, no change output added because there was no remaining amount at
//                            input sequence. Otherwise, if change output is not set due to an error, undefined is returned.
CCTransaction.prototype.setChangeTransferOutput = function (address, inputSeqStartPos) {
    const assetAmountInfo = this.getTransferInputSeqAssetAmountInfo(inputSeqStartPos);

    if (assetAmountInfo !== undefined) {
        const changeAssetAmount = assetAmountInfo.assetAmount.remainingInput;

        if (changeAssetAmount <= 0 || this.setTransferOutput(address, changeAssetAmount, inputSeqStartPos)) {
            return changeAssetAmount;
        }
    }
    else {
        // There is no transfer input sequence with specified start position.
        //  Log error condition
        Catenis.logger.ERROR('Transfer input sequence specified as source for setting change transfer output for Colored Coins transaction does not exist; no outputs set', {
            transferInputSeqs: this.transferInputSeqs,
            inputSeqStartPos: inputSeqStartPos
        });
    }
};

// Sets a special transfer outputs entry designating that Colored Coins assets still remaining
//  at a transfer input sequence should be burnt
//
//  Arguments:
//   inputSeqStartPos: [Number] - Start position of transfer input sequence from where assets should come
//
//  Return:
//   assetAmount: [Number] - If a positive number, indicates that change output was set and the value returned is the change amount designated
//                            to be burnt. If zero or a negative number, no change output added because there was no remaining amount at
//                            input sequence. Otherwise, if change output is not set due to an error, undefined is returned.
CCTransaction.prototype.setChangeBurnOutput = function (inputSeqStartPos) {
    const assetAmountInfo = this.getTransferInputSeqAssetAmountInfo(inputSeqStartPos);

    if (assetAmountInfo !== undefined) {
        const changeAssetAmount = assetAmountInfo.assetAmount.remainingInput;

        if (changeAssetAmount <= 0 || this.setBurnOutput(changeAssetAmount, inputSeqStartPos)) {
            return changeAssetAmount;
        }
    }
    else {
        // There is no transfer input sequence with specified start position.
        //  Log error condition
        Catenis.logger.ERROR('Transfer input sequence specified as source for setting change burn output for Colored Coins transaction does not exist; no outputs set', {
            transferInputSeqs: this.transferInputSeqs,
            inputSeqStartPos: inputSeqStartPos
        });
    }
};

// Remove all transfer outputs for a given transfer input sequence
//
//  Arguments:
//   inputSeqStartPos: [Number] - Start position of transfer input sequence for which outputs should be removed
//
//  Return:
//   success: [Boolean] - True if outputs are successfully removed, or false if no outputs have been
//                         removed (possibly due to an error)
CCTransaction.prototype.removeTransferOutputs = function (inputSeqStartPos) {
    // Try to retrieve transfer input sequence
    const inputSeq = getTransferInputSeq.call(this, inputSeqStartPos);

    if (inputSeq !== undefined || (inputSeqStartPos === 0 && this.issuingInfo !== undefined)) {
        const transferOutputsToRemove = []; // Entry = [idx, count]

        for (let idx = 0, limit = this.transferOutputs.length; idx < limit; idx++) {
            const transferOutput = this.transferOutputs[idx];

            if (transferOutput.inputSeqStartPos === inputSeqStartPos && transferOutput.address !== undefined) {
                // Set transfer output to be removed
                let firstEntry;

                if (transferOutputsToRemove.length > 0 && (firstEntry = transferOutputsToRemove[0]) && firstEntry[0] + firstEntry[1] === idx) {
                    firstEntry[1]++;
                }
                else {
                    // Add to beginning of list so removal is done from the higher to the lower index
                    transferOutputsToRemove.unshift([idx, 1]);
                }
            }
        }

        if (transferOutputsToRemove.length > 0) {
            // Reset transaction before making changes
            this.reset();

            transferOutputsToRemove.forEach((entry) => {
                // Remove existing transfer outputs...
                Array.prototype.splice.apply(this.transferOutputs, entry);
            });

            return true;
        }
    }

    return false;
};

// Return list of blockchain addresses used to transfer assets from a given input sequence
//
//  Arguments:
//   inputSeqStartPos: [Number] - Position of first input of transfer input sequence
//
//  Return:
//   outputAddresses: [Array(String)] - List of blockchain addresses associated with outputs used to transfer
//                                       assets from input sequence, or undefined if transfer input sequence does not exist
CCTransaction.prototype.getTransferOutputAddresses = function (inputSeqStartPos) {
    const inputSeq = getTransferInputSeq.call(this, inputSeqStartPos);

    if (inputSeq !== undefined || (inputSeqStartPos === 0 && this.issuingInfo !== undefined)) {
        const outputAddresses = [];

        for (let idx = 0, limit = this.transferOutputs.length; idx < limit; idx++) {
            const transferOutput = this.transferOutputs[idx];

            if (transferOutput.inputSeqStartPos === inputSeqStartPos) {
                if (transferOutput.address !== undefined) {
                    outputAddresses.push(transferOutput.address);
                }
            }
            else if (transferOutput.inputSeqStartPos > inputSeqStartPos) {
                break;
            }
        }

        return outputAddresses;
    }
};

// Get list of inputs for a given transfer input sequence
//
//  Arguments:
//   inputSeqStartPos: [Number] - Position of first input of transfer input sequence
//
//  Return:
//   transferInputs: [Array(Object)] - List of transaction input objects (the same as used by the inputs property of
//                                      the CCTransaction object), or undefined if transfer input sequence does not exist
CCTransaction.prototype.getTransferInputs = function (inputSeqStartPos) {
    const inputSeq = getTransferInputSeq.call(this, inputSeqStartPos);

    if (inputSeq !== undefined) {
        const transferInputs = [];

        for (let pos = inputSeq.startPos, limit = inputSeq.startPos + inputSeq.nInputs; pos < limit; pos++) {
            transferInputs.push(this.getInputAt(pos));
        }

        return transferInputs;
    }
};

/**
 * Get a list of non-fungible token IDs associated with a given transfer input sequence
 * @param {number} inputSeqStartPos Input sequence start position
 * @return {(string[]|undefined)} List of non-fungible token IDs, or undefined if transfer input sequence does not exist
 */
CCTransaction.prototype.getTransferCCTokenIds = function (inputSeqStartPos) {
    const inputSeq = getTransferInputSeq.call(this, inputSeqStartPos);
    let ccTokenIds = [];

    if (inputSeq !== undefined) {
        for (let pos = inputSeq.startPos, limit = inputSeq.startPos + inputSeq.nInputs; pos < limit; pos++) {
            const input = this.getInputAt(pos);

            if (input.txout.ccTokenIds) {
                ccTokenIds = ccTokenIds.concat(input.txout.ccTokenIds);
            }
        }
    }
    else if (inputSeqStartPos === 0 && this.issuingInfo !== undefined && this.issuingInfo.ccTokenIds) {
        // Asset issuance
        ccTokenIds = this.issuingInfo.ccTokenIds;
    }
    else {
        // Transfer input sequence not found
        return undefined;
    }

    return ccTokenIds;
}

// Get list of transaction outputs used to transfer assets for a given input sequence
//
//  Arguments:
//   inputSeqStartPos: [Number] - Position of first input of transfer input sequence
//
//  Return:
//   transferTxouts: [Array(String)] - List of transaction outputs in "txid:n" format, or undefined if
//                                      transaction has not yet been sent or transfer input sequence does not exist
//
//  NOTE: this method should only be called after a Colored Coins transaction has been built and sent
CCTransaction.prototype.getTransferTxOutputs = function (inputSeqStartPos) {
    if (this.txid !== undefined) {
        const numPayOutputsBeforeNullData = this.numPayOutputsBeforeNullData;
        const nullDataOutputPos = this.getNullDataOutputPosition()
        let txOutputPos = numPayOutputsBeforeNullData > 0 ? 0 : nullDataOutputPos + 1;
        
        function incrementTxOutputPos(inc = 1) {
            if (txOutputPos < numPayOutputsBeforeNullData) {
                txOutputPos += inc;
                
                if (txOutputPos >= numPayOutputsBeforeNullData) {
                    txOutputPos = txOutputPos - numPayOutputsBeforeNullData + nullDataOutputPos + 1
                }
            }
            else {
                txOutputPos += inc;
            }
        }

        const inputSeqStartPosNumTxOutputs = this.txOutputsPerInputSeq();
        const transferTxOuts = [];
        let inputSeqFound = false;

        for (const inputSeq of this.transferInputSeqs) {
            if (inputSeq.startPos < inputSeqStartPos) {
                // A previous input sequence. Just increment number of tx outputs
                incrementTxOutputPos(inputSeqStartPosNumTxOutputs.get(inputSeq.startPos));
            }
            else if (inputSeq.startPos === inputSeqStartPos) {
                // The input sequence in question. Add the respective number of tx outputs
                for (let outPosOffset = 0, limit = inputSeqStartPosNumTxOutputs.get(inputSeqStartPos); outPosOffset < limit; outPosOffset++) {
                    transferTxOuts.push(Util.txoutToString({
                        txid: this.txid,
                        vout: outPosOffset + txOutputPos
                    }));
                }

                inputSeqFound = true;
                break;
            }
            else {
                break;
            }
        }

        return inputSeqFound ? transferTxOuts : undefined;
    }
};

/**
 * Retrieve a dictionary of number of tx outputs per input sequence
 * @return Map<number, number>
 */
CCTransaction.prototype.txOutputsPerInputSeq = function () {
    const inputSeqStartPosNumTxOutputs = new Map();
    let lastInputSeqStartPos = undefined;
    let numTxOutputs = 0;
    const trfOutputAddresses = new Set();

    for (const transferOutput of this.transferOutputs) {
        if (transferOutput.inputSeqStartPos !== lastInputSeqStartPos) {
            // Transfer output is for a new input sequence
            if (lastInputSeqStartPos !== undefined) {
                inputSeqStartPosNumTxOutputs.set(lastInputSeqStartPos, numTxOutputs);

                numTxOutputs = 0;
                trfOutputAddresses.clear();
            }

            lastInputSeqStartPos = transferOutput.inputSeqStartPos;
        }

        if (transferOutput.address) {
            if (!trfOutputAddresses.has(transferOutput.address)) {
                // Transfer output yields a new tx output
                numTxOutputs++;
                trfOutputAddresses.add(transferOutput.address);
            }
        }
    }

    if (lastInputSeqStartPos !== undefined) {
        inputSeqStartPosNumTxOutputs.set(lastInputSeqStartPos, numTxOutputs);
    }

    return inputSeqStartPosNumTxOutputs;
}

// Identify transfer input sequences that still do not have all their asset amount set to be transferred/burnt
//
//  Return:
//   inputStartPositions: [Array(Number)] - List of input start positions, identifying those transfer input sequences that
//                                           still do not have all their asset amount set to be transferred/burnt, or
//                                           undefined if there is none
CCTransaction.prototype.pendingTransferInputSeqs = function () {
    const inputStartPositions = [];

    if (this.issuingInfo !== undefined && this.getTransferInputSeqAssetAmountInfo(0).assetAmount.remainingInput > 0) {
        inputStartPositions.push(0);
    }

    this.transferInputSeqs.forEach((inputSeq) => {
        if (this.getTransferInputSeqAssetAmountInfo(inputSeq.startPos).assetAmount.remainingInput > 0) {
            inputStartPositions.push(inputSeq.startPos);
        }
    });

    return inputStartPositions.length > 0 ? inputStartPositions : undefined;
};

// Sets the Colored Coins metadata to be added to the Colored Coins transaction
//
//  Arguments:
//   ccMetadata: [Object(CCMetadata)] - The Colored Coins metadata
CCTransaction.prototype.setCcMetadata = function (ccMetadata) {
    // Reset transaction before performing task
    this.reset();

    this.ccMetadata = ccMetadata;
};

// Replace the Colored Coins metadata reassembling the Colored Coins transaction if already assembled
//
//  Arguments:
//   ccMetadata: [Object(CCMetadata)] - The Colored Coins metadata
CCTransaction.prototype.replaceCcMetadata = function (ccMetadata) {
    // Only does anything if metadata is already set
    if (this.ccMetadata) {
        let reassemble = false;
        let multiSigAddress;

        if (this.isAssembled) {
            if (this.includesMultiSigOutput) {
                multiSigAddress = this.getMultiSigOutputPositions()[0].payInfo.address[0];
            }

            reassemble = true;
        }

        this.setCcMetadata(ccMetadata);

        if (reassemble) {
            this.assemble(multiSigAddress);
        }
    }
};

/**
 * Assemble Colored Coins data and add Colored Coins related outputs to transaction
 * @param {string} [spendMultiSigOutputAddress] Blockchain address used to spend multi-signature output if one is
 *                                               required
 * @param {StoreProgressCallback} [metadataProgressCallback] Callback to report progress while storing the associated
 *                                                            Colored Coins metadata (if any)
 * @returns {boolean} True if Colored Coins transaction had been successfully assembled (or was already assembled),
 *                     or false otherwise (not all transfer input sequences have all their asset amount set to be
 *                     transferred/burnt)
 */
CCTransaction.prototype.assemble = function (spendMultiSigOutputAddress, metadataProgressCallback) {
    // Make sure that Colored Coins transaction is not yet assembled
    if (!this.isAssembled) {
        // Make sure that assets from all inputs have been set to be transferred/burnt
        const pendingInputStartPositions = this.pendingTransferInputSeqs();

        if (pendingInputStartPositions === undefined) {
            // Make sure that the Catenis Colored Coins protocol is used
            const ccBuilder = new CCBuilder({
                protocol: hexPrefixToProtocolId(cfgSettings.c3ProtocolPrefix)
            });

            // Set asset issuing info if required
            if (this.issuingInfo) {
                ccBuilder.setLockStatus(this.issuingInfo.type === CCTransaction.issuingAssetType.locked);
                ccBuilder.setAmount(this.issuingInfo.assetAmount, this.issuingInfo.divisibility);
                ccBuilder.setAggregationPolicy(
                    this.issuingInfo.isAggregatable
                        ? CCTransaction.aggregationPolicy.aggregatable
                        : (this.issuingInfo.isNonFungible ? CCTransaction.aggregationPolicy.nonFungible : CCTransaction.aggregationPolicy.dispersed)
                );
            }

            // Set information about asset transfer/burn

            let outputPos = 0;
            let firstOutputPos;
            let numReverseOutputs = 0;
            let lastInputSeqStartPos;
            let inputSeqCCTokenIds;
            let inputSeqUsedTokens = 0;
            const outputOrderTxOutput = new Map();
            const addressTxOutput = new Map();
            const txOutputPaymentOutput = new Map();
            let negativePaymentOutputs = [];
            const negativePaymentOutputFixedOutput = new Map();
            const ccCommands = [];

            this.transferOutputs.forEach((transferOutput) => {
                const inputSeqStartPos = transferOutput.inputSeqStartPos;

                if (inputSeqStartPos !== lastInputSeqStartPos) {
                    // Transfer output is for a new input sequence.
                    //  Check if there are tx outputs to add
                    if (outputOrderTxOutput.size > 0) {
                        // Add tx outputs for last input sequence
                        this.addPubKeyHashOutputs(
                            Util.sortMapValuesByKey(outputOrderTxOutput, (a, b) => a - b),
                            firstOutputPos
                        );

                        if (negativePaymentOutputs.length > 0) {
                            // Save fixed payment output for each negative payment output of
                            //  the last input sequence to be processed later
                            negativePaymentOutputs.forEach(paymentOutput => {
                                negativePaymentOutputFixedOutput.set(
                                    paymentOutput,
                                    2 * this.numCcTransferOutputs + outputOrderTxOutput.size + paymentOutput
                                );
                            });

                            negativePaymentOutputs = [];
                        }

                        this.numCcTransferOutputs += outputOrderTxOutput.size;

                        inputSeqUsedTokens = 0;
                        outputOrderTxOutput.clear();
                        addressTxOutput.clear();
                        txOutputPaymentOutput.clear();
                    }

                    inputSeqCCTokenIds = this.getTransferCCTokenIds(inputSeqStartPos);
                    lastInputSeqStartPos = inputSeqStartPos;
                    firstOutputPos = outputPos;
                    numReverseOutputs = 0;
                }

                if (transferOutput.address !== undefined) {
                    // Asset transfer
                    let paymentOutput;

                    if (!addressTxOutput.has(transferOutput.address)) {
                        // Add transfer to new tx output
                        let txOutput;

                        if (inputSeqStartPos === 0 && this.issuingInfo !== undefined) {
                            // Asset issuance
                            txOutput = {
                                address: transferOutput.address,
                                amount: Transaction.dustAmountByAddress(transferOutput.address),
                                ccAssetId: this.issuingInfo.ccAssetId,
                                assetAmount: transferOutput.assetAmount,
                                assetDivisibility: this.issuingInfo.divisibility
                            };

                            if (this.issuingInfo.ccTokenIds) {
                                txOutput.ccTokenIds = this.issuingInfo.ccTokenIds.slice(
                                    inputSeqUsedTokens,
                                    inputSeqUsedTokens + transferOutput.assetAmount
                                );
                                inputSeqUsedTokens += transferOutput.assetAmount;
                            }
                        }
                        else {
                            // Transfer of an existing asset
                            const firstInputOfSeq = this.getInputAt(inputSeqStartPos);

                            txOutput = {
                                address: transferOutput.address,
                                amount: Transaction.dustAmountByAddress(transferOutput.address),
                                ccAssetId: firstInputOfSeq.txout.ccAssetId,
                                assetAmount: transferOutput.assetAmount,
                                assetDivisibility: firstInputOfSeq.txout.assetDivisibility
                            };

                            if (inputSeqCCTokenIds.length > 0) {
                                txOutput.ccTokenIds = inputSeqCCTokenIds.slice(
                                    inputSeqUsedTokens,
                                    inputSeqUsedTokens + transferOutput.assetAmount
                                );
                                inputSeqUsedTokens += transferOutput.assetAmount;
                            }
                        }

                        let outputOrder;

                        if (transferOutput.reverseOutput) {
                            outputOrder = 9999 - outputPos;
                            paymentOutput = -(outputPos + 1);
                            negativePaymentOutputs.push(paymentOutput);
                            numReverseOutputs++;
                        }
                        else {
                            paymentOutput = outputOrder = outputPos - numReverseOutputs;
                        }

                        outputOrderTxOutput.set(outputOrder, txOutput);
                        addressTxOutput.set(transferOutput.address, txOutput);
                        txOutputPaymentOutput.set(txOutput, paymentOutput);

                        outputPos++;
                    }
                    else {
                        // Add transfer to an existing tx output
                        const txOutput = addressTxOutput.get(transferOutput.address);

                        txOutput.assetAmount += transferOutput.assetAmount;

                        if (inputSeqStartPos === 0 && this.issuingInfo !== undefined) {
                            // Asset issuance
                            if (this.issuingInfo.ccTokenIds) {
                                txOutput.ccTokenIds = txOutput.ccTokenIds.concat(
                                    this.issuingInfo.ccTokenIds.slice(
                                        inputSeqUsedTokens,
                                        inputSeqUsedTokens + transferOutput.assetAmount
                                    )
                                );
                                inputSeqUsedTokens += transferOutput.assetAmount;
                            }
                        }
                        else {
                            // Transfer of an existing asset
                            if (inputSeqCCTokenIds.length > 0) {
                                txOutput.ccTokenIds = txOutput.ccTokenIds.concat(
                                    inputSeqCCTokenIds.slice(
                                        inputSeqUsedTokens,
                                        inputSeqUsedTokens + transferOutput.assetAmount
                                    )
                                );
                                inputSeqUsedTokens += transferOutput.assetAmount;
                            }
                        }

                        paymentOutput = txOutputPaymentOutput.get(txOutput);
                    }

                    // Prepare to add payment and respective tx output
                    ccCommands.push({
                       method: ccBuilder.addPayment,
                       context: ccBuilder,
                       args: [
                           inputSeqStartPos/*input*/,
                           transferOutput.assetAmount/*amount*/,
                           paymentOutput/*output*/
                       ]
                    });
                }
                else {
                    // Asset burn
                    if (inputSeqCCTokenIds.length > 0) {
                        inputSeqUsedTokens += transferOutput.assetAmount;
                    }

                    // Prepare to add burn instruction
                    ccCommands.push({
                       method: ccBuilder.addBurn,
                       context: ccBuilder,
                       args: [
                           inputSeqStartPos/*input*/,
                           transferOutput.assetAmount/*amount*/
                       ]
                    });
                }
            });

            if (outputOrderTxOutput.size > 0) {
                // Add tx outputs for last input sequence
                this.addPubKeyHashOutputs(
                    Util.sortMapValuesByKey(outputOrderTxOutput, (a, b) => a - b),
                    firstOutputPos
                );

                if (negativePaymentOutputs.length > 0) {
                    // Save fixed payment output for each negative payment output of
                    //  the last input sequence to be processed later
                    negativePaymentOutputs.forEach(paymentOutput => {
                        negativePaymentOutputFixedOutput.set(
                            paymentOutput,
                            2 * this.numCcTransferOutputs + outputOrderTxOutput.size + paymentOutput
                        );
                    });
                }

                this.numCcTransferOutputs += outputOrderTxOutput.size;
            }

            let numPayOutputsBeforeNullData = 0;

            if (ccCommands.length > 0) {
                const firstCommand = ccCommands[0];

                if (firstCommand.method === ccBuilder.addPayment && firstCommand.args[2]/*output*/ === 0) {
                    // Check if payments begin with a sequence that can be combined into a single range payment
                    let rangeLength = 1;

                    for (let idx = 1, length = ccCommands.length; idx < length; idx++) {
                        const command = ccCommands[idx];

                        if (command.method === ccBuilder.addPayment
                                && command.args[0]/*input*/ === firstCommand.args[0]/*input*/
                                && command.args[1]/*amount*/ === firstCommand.args[1]/*amount*/
                                && command.args[2]/*output*/ === rangeLength
                        ) {
                            rangeLength++;
                        }
                        else {
                            break;
                        }
                    }

                    if (rangeLength > 1) {
                        // Combine sequence of payments into a single range payment
                        ccCommands.splice(
                            0,
                            rangeLength,
                            {
                                method: ccBuilder.addPayment,
                                context: ccBuilder,
                                args: [
                                    firstCommand.args[0]/*input*/,
                                    firstCommand.args[1]/*amount*/,
                                    rangeLength - 1/*output*/,
                                    true/*range*/
                                ]
                            }
                        );

                        // Note: the outputs of the range payment must be the first outputs of the tx,
                        //  before the null data output (and the multisig output if present). So set it
                        //  accordingly
                        numPayOutputsBeforeNullData = rangeLength;
                    }
                }

                ccCommands.forEach(command => {
                    if (command.method === ccBuilder.addPayment && !command.args[3]/*range*/) {
                        // Adjust output position. Note that all payment outputs are incremented by one
                        //  to account for the fact that, in the end, the transfer outputs shall be shifted
                        //  by the null data output that is added before them. The multisig output shall be
                        //  accounted for later if it is present
                        command.args[2]/*output*/ = 1
                           + (
                               command.args[2]/*output*/ < 0
                               ? negativePaymentOutputFixedOutput.get(command.args[2]/*output*/)
                               : command.args[2]/*output*/
                           );
                    }

                    // Execute command to add Colored Coins payment/burn instruction
                    command.method.apply(command.context, command.args);
                });
            }

            // Process Colored Coins metadata if required
            if (this.ccMetadata !== undefined) {
                // Make sure that Colored Coins metadata is already assembled and stored
                if (!this.ccMetadata.isStored) {
                    if (!this.ccMetadata.isAssembled) {
                        // Assemble metadata using crypto keys from first input to encrypt user data (if required)
                        const firstInput = this.getInputAt(0);

                        this.ccMetadata.assemble(
                            firstInput.addrInfo !== undefined ? firstInput.addrInfo.cryptoKeys : undefined,
                            this.getCCMetadataNFTokensCryptoKeys()
                        );
                    }

                    // Store metadata
                    this.ccMetadata.store(metadataProgressCallback);
                }

                if (this.ccMetadata.isStored) {
                    // Set Colored Coins metadata storing info
                    ccBuilder.setHash(this.ccMetadata.storeResult.cid);
                }
            }

            // Now, encode Colored Coins
            let ccResult;

            try {
                ccResult = ccBuilder.encode();
            }
            catch (err) {
                // Error encoding Colored Coins data.
                //  Log error
                Catenis.logger.ERROR('Error encoding Colored Coins data for transaction.', err);
                if (isCcDataTooLargeError(err)) {
                    // Colored Coins data will not fit into transaction's null data output (too many transfer outputs).
                    //  Throw exception
                    throw new Meteor.Error('ctn_cctx_ccdata_too_large', 'Colored Coins data will not fit into transaction\'s null data output');
                }
                else {
                    // Generic error. Throw exception
                    throw new Meteor.Error('ctn_cctx_ccdata_encode_error', 'Error encoding Colored Coins data for transaction');
                }
            }

            if (ccResult.leftover !== undefined && ccResult.leftover.length > 0) {
                // Needs to store Colored Coins metadata hash onto multi-signature output.
                //  Adjust output positions and encode again
                ccBuilder.shiftOutputs();
                ccResult = ccBuilder.encode();

                this.includesMultiSigOutput = true;
            }

            // Add null data output with Colored Coins encoded data
            this.addNullDataOutput(ccResult.codeBuffer, numPayOutputsBeforeNullData);

            if (this.includesMultiSigOutput) {
                // Add multi-signature output
                const pubKeys = [
                    spendMultiSigOutputAddress !== undefined ? spendMultiSigOutputAddress : Buffer.concat([Buffer.from('03', 'hex'), Buffer.alloc(txCfgSettings.pubKeySize - 1, 0xff)], txCfgSettings.pubKeySize).toString('hex')
                ];

                ccResult.leftover.forEach((buf, idx) => {
                    let lengthByte;

                    if (idx === 0) {
                        // Extract 'length' byte
                        lengthByte = buf.slice(0, 1);
                        buf = buf.slice(1);
                    }
                    else {
                        lengthByte = Buffer.from('');
                    }

                    pubKeys.push(Buffer.concat([Buffer.from('03', 'hex'), Buffer.alloc(txCfgSettings.pubKeySize - (buf.length + lengthByte.length + 1), 0), buf, lengthByte], txCfgSettings.pubKeySize).toString('hex'));
                });

                this.addMultiSigOutput(
                    pubKeys,
                    1,
                    pubKeys.length > 2 ? txCfgSettings.oneOf3multiSigTxOutputDustAmount : txCfgSettings.oneOf2MultiSigTxOutputDustAmount,
                    numPayOutputsBeforeNullData
                );
            }

            this.isAssembled = true;
        }
        else {
            // Not all transfer input sequences have all their asset amount set to be transferred/burnt.
            //  Log error condition, and return indicating error
            Catenis.logger.ERROR('Not all transfer input sequences have all their asset amount set to be transferred/burnt; Colored Coins transaction cannot be assembled', {
                transferInputSeqs: this.transferInputSeqs,
                pendingStatPositions: pendingInputStartPositions
            });
            return false;
        }
    }

    // Return indicating success
    return true;
};

// Revert actions of Colored Coins transaction assembly
//
CCTransaction.prototype.reset = function () {
    // Make sure that Colored Coins transaction is already assembled
    if (this.isAssembled) {
        // Remove Colored Coins outputs
        this.removeOutputs(0, this.numTotalCcOutputs);

        // Reset control variables
        this.isAssembled = false;
        this.includesMultiSigOutput = false;
        this.numCcTransferOutputs = 0;
    }
};

// Get total amount of assets (including newly assets being issued) associated with transaction inputs
//
//  Arguments:
//    startPos: [Number] - (optional, default: 0) Lower bound of input range to be considered when calculating the total amount
//    endPos: [Number] - (optional, default: <last_tx_input>) Higher bound of input range to be considered when calculating the total amount
//
//  Return:
//   result: {
//     <ccAssetId>: {
//       assetAmount: [Number],
//       divisibility: [Number]
//     }
//   }
CCTransaction.prototype.totalInputsAssetAmount = function (startPos = 0, endPos) {
    let result = {};

    for (let pos = startPos, lastPos = endPos === undefined ? this.inputs.length - 1 : endPos; pos <= lastPos; pos++) {
        if (this.issuingInfo !== undefined && pos === 0) {
            // Get amount of asset being issued
            result[this.issuingInfo.ccAssetId] = {
                assetAmount: this.issuingInfo.assetAmount,
                divisibility: this.issuingInfo.divisibility
            };
        }
        else {
            const input = this.inputs[pos];

            if (input !== undefined && input.txout.ccAssetId !== undefined) {
                if (input.txout.ccAssetId in result) {
                    result[input.txout.ccAssetId].assetAmount += input.txout.assetAmount;
                }
                else {
                    result[input.txout.ccAssetId] = {
                        assetAmount: input.txout.assetAmount,
                        divisibility: input.txout.assetDivisibility
                    }
                }
            }
        }
    }

    return Object.keys(result).length > 0 ? result : undefined;
};

// Get total amount of assets associated with transaction outputs
//
//  Arguments:
//    startPos: [Number] - (optional, default: 0) Lower bound of output range to be considered when calculating the total amount
//    endPos: [Number] - (optional, default: <last_tx_output>) Higher bound of output range to be considered when calculating the total amount
//
//  Return:
//   result: {
//     <ccAssetId>: {
//       assetAmount: [Number],
//       divisibility: [Number]
//     }
//   }
//
//  NOTE: this method should only be called after the Colored Coins transaction is assembled
CCTransaction.prototype.totalOutputsAssetAmount = function (startPos = 0, endPos) {
    let result = {};

    for (let pos = startPos, lastPos = endPos === undefined ? this.outputs.length - 1 : endPos; pos <= lastPos; pos++) {
        const output = this.outputs[pos];

        if (output !== undefined && Transaction.isPayingOutput(output.type) && output.payInfo.ccAssetId !== undefined) {
            if (output.payInfo.ccAssetId in result) {
                result[output.payInfo.ccAssetId].assetAmount += output.payInfo.assetAmount;
            }
            else {
                result[output.payInfo.ccAssetId] = {
                    assetAmount: output.payInfo.assetAmount,
                    divisibility: output.payInfo.assetDivisibility
                }
            }
        }
    }

    return Object.keys(result).length > 0 ? result : undefined;
};

// Get total amount of assets that are set to be burnt
//
//  Arguments:
//    startPos: [Number] - (optional, default: 0) Lower bound of input range to be considered when calculating the total amount
//    endPos: [Number] - (optional, default: <last_tx_input>) Higher bound of input range to be considered when calculating the total amount
//
//  Return:
//   result: {
//     <ccAssetId>: {
//       assetAmount: [Number],
//       divisibility: [Number]
//     }
//   }
CCTransaction.prototype.totalBurnAssetAmount = function (startInputPos = 0, endInputPos) {
    let result = {};

    if (endInputPos !== undefined) {
        endInputPos = this.inputs.length - 1;
    }

    this.transferOutputs.some((transferOutput) => {
        if (transferOutput.inputSeqStartPos > endInputPos) {
            return true;
        }
        else if (transferOutput.inputSeqStartPos >= startInputPos && transferOutput.address === undefined) {
            const firstInputOfSeq = this.getInputAt(transferOutput.inputSeqStartPos);

            if (firstInputOfSeq.txout.ccAssetId in result) {
                result[firstInputOfSeq.txout.ccAssetId].assetAmount += transferOutput.assetAmount;
            }
            else {
                result[firstInputOfSeq.txout.ccAssetId] = {
                    assetAmount: transferOutput.assetAmount,
                    divisibility: firstInputOfSeq.txout.assetDivisibility
                }
            }
        }
    });

    return Object.keys(result).length > 0 ? result : undefined;
};

CCTransaction.prototype.clone = function () {
    const clone = txFixClone(Util.cloneObj(this));

    clone.transferInputSeqs = Util.cloneObjArray(clone.transferInputSeqs);
    clone.transferOutputs = Util.cloneObjArray(clone.transferOutputs);

    if (clone.ccMetadata) {
        clone.ccMetadata = clone.ccMetadata.clone();
    }

    return clone;
};

/**
 * Get the crypto key-pair of the bitcoin addresses that should be used to encrypt/decrypt non-fungible
 *  token metadata data
 *
 *  Note: this method should be called only after the Colored Coins transaction has been assembled (or at
 *         least the tx outputs have been added)
 *
 * @return {(CryptoKeys|CryptoKeys[])}
 */
CCTransaction.prototype.getCCMetadataNFTokensCryptoKeys = function () {
    const numPayOutputsBeforeNullData = this.numPayOutputsBeforeNullData;
    const nullDataOutputPos = this.getNullDataOutputPosition()
    let txOutputPos = numPayOutputsBeforeNullData > 0 || nullDataOutputPos === undefined ? 0 : nullDataOutputPos + 1;

    function incrementTxOutputPos(inc = 1) {
        // Note that the condition below will always be false if null data output is not present,
        //  since in that case numPayOutputsBeforeNullData will be 0
        if (txOutputPos < numPayOutputsBeforeNullData) {
            txOutputPos += inc;

            if (txOutputPos >= numPayOutputsBeforeNullData) {
                txOutputPos = txOutputPos - numPayOutputsBeforeNullData + nullDataOutputPos + 1
            }
        }
        else {
            txOutputPos += inc;
        }
    }

    function postIncrementTxOutputPos() {
        const prevTxOutputPos = txOutputPos;

        incrementTxOutputPos();

        return prevTxOutputPos;
    }

    function getOutputCryptoKeys(payInfo) {
        if (payInfo.addrInfo) {
            return payInfo.addrInfo.cryptoKeys;
        }
        else {
            const addrInfo = Catenis.keyStore.getAddressInfo(payInfo.address, true);

            return addrInfo ? addrInfo.cryptoKeys : undefined;
        }
    }

    const inputSeqStartPosNumTxOutputs = this.txOutputsPerInputSeq();
    const listCryptoKeys = [];
    const cryptoKeysCCTokenIds = new Map();

    Array.from(inputSeqStartPosNumTxOutputs.keys()).forEach(inputSeqStartPos => {
        if (inputSeqStartPos === 0 && this.issuingInfo !== undefined) {
            // Asset issuance
            if (this.issuingInfo.ccTokenIds) {
                // Identify crypto keys associated with the token IDs
                const numCCTokenIdsCryptoKeys = [];

                for (let count = inputSeqStartPosNumTxOutputs.get(inputSeqStartPos); count > 0; count--) {
                    const txOutput = this.getOutputAt(postIncrementTxOutputPos());

                    if (txOutput) {
                        const payInfo = txOutput.payInfo;

                        if (payInfo.ccTokenIds) {
                            const cryptoKeys = getOutputCryptoKeys(payInfo);

                            if (cryptoKeys) {
                                numCCTokenIdsCryptoKeys.push([payInfo.ccTokenIds.length, cryptoKeys]);
                            }
                        }
                    }
                }

                if (numCCTokenIdsCryptoKeys.length === 1) {
                    // Special case: all issued non-fungible tokens go to the same output
                    listCryptoKeys[-1] = numCCTokenIdsCryptoKeys[0][1];
                }
                else {
                    for (const [numCCTokenIds, cryptoKeys] of numCCTokenIdsCryptoKeys) {
                        for (let count = numCCTokenIds; count > 0; count--) {
                            listCryptoKeys.push(cryptoKeys);
                        }
                    }
                }
            }
            else {
                // Not a non-fungible asset. Just increment tx output position
                incrementTxOutputPos(inputSeqStartPosNumTxOutputs.get(inputSeqStartPos));
            }
        }
        else {
            // Asset transfer.
            //  Get token IDs per crypto keys
            for (let count = inputSeqStartPosNumTxOutputs.get(inputSeqStartPos); count > 0; count--) {
                const txOutput = this.getOutputAt(postIncrementTxOutputPos());

                if (txOutput) {
                    const payInfo = txOutput.payInfo;

                    if (payInfo.ccTokenIds) {
                        const cryptoKeys = getOutputCryptoKeys(payInfo);

                        if (cryptoKeys) {
                            if (!cryptoKeysCCTokenIds.has(cryptoKeys)) {
                                cryptoKeysCCTokenIds.set(cryptoKeys, payInfo.ccTokenIds);
                            }
                            else {
                                cryptoKeysCCTokenIds.set(cryptoKeys, cryptoKeysCCTokenIds.get(cryptoKeys).concat(payInfo.ccTokenIds));
                            }
                        }
                    }
                }
            }
        }
    });

    if (cryptoKeysCCTokenIds.size > 0) {
        // Optimization: find wildcard crypto keys
        let maxNumCCTokens = 0;
        let wildcardCryptoKeys;

        for (const [cryptoKeys, ccTokenIds] of cryptoKeysCCTokenIds) {
            if (ccTokenIds.length > maxNumCCTokens) {
                maxNumCCTokens = ccTokenIds.length;
                wildcardCryptoKeys = cryptoKeys;
            }
        }

        for (const [cryptoKeys, ccTokenIds] of cryptoKeysCCTokenIds) {
            if (cryptoKeys === wildcardCryptoKeys) {
                listCryptoKeys['*'] = cryptoKeys;
            }
            else {
                for (const ccTokenId of ccTokenIds) {
                    listCryptoKeys[ccTokenId] = cryptoKeys;
                }
            }
        }
    }

    return Object.keys(listCryptoKeys).length > 0
        ? (Object.keys(listCryptoKeys).length === 1 && (-1 in listCryptoKeys) ? listCryptoKeys[-1] : listCryptoKeys)
        : undefined;
};


// Module functions used to simulate private CCTransaction object methods
//  NOTE: these functions need to be bound to a CCTransaction object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

function nextTransferInputSeqStartPos() {
    return this.transferInputSeqs.reduce((nextPos, inputSeq) => {
        return nextPos + inputSeq.nInputs;
    }, this.issuingInfo !== undefined ? 1 : 0);
}

function addNewTransferInputSeq(nInputs, startPos) {
    let inputSeqIdx;
    let replaceCurrentInputSeq = false;

    if (startPos !== undefined && (inputSeqIdx = getTransferInputSeqIndex.call(this, startPos)) !== undefined) {
        replaceCurrentInputSeq = true;
    }

    const newTransferInputSeq = {
        startPos: replaceCurrentInputSeq ? startPos : nextTransferInputSeqStartPos.call(this),
        nInputs: nInputs
    };

    if (replaceCurrentInputSeq) {
        // Adjust start position of current input sequence and all subsequent ones...
        offsetTransferInputStartPos.call(this, startPos, nInputs);

        // and add new entry at position occupied by current input sequence
        this.transferInputSeqs.splice(inputSeqIdx, 0, newTransferInputSeq);
    }
    else {
        // Add new entry at the end of the list
        this.transferInputSeqs.push(newTransferInputSeq);
    }

    return newTransferInputSeq;
}

function getTransferInputSeqIndex(startPos) {
    let inputSeqIdx = undefined;

    for (let idx = 0, limit = this.transferInputSeqs.length; idx < limit; idx++) {
        const inputSeq = this.transferInputSeqs[idx];

        if (inputSeq.startPos === startPos) {
            inputSeqIdx = idx;
            break;
        }
        else if (inputSeq.startPos > startPos) {
            // We can stop search because it is guaranteed that the start
            //  positions for each entry are ordered
            break;
        }
    }

    return inputSeqIdx;
}

function getTransferInputSeq(startPos) {
    const inputSeqIdx = getTransferInputSeqIndex.call(this, startPos);

    return inputSeqIdx !== undefined ? this.transferInputSeqs[inputSeqIdx] : undefined;
}

function incrementInputsOfTransferInputSeq(inputSeq, incInputs) {
    inputSeq.nInputs += incInputs;

    // Now adjust start position of all subsequent input sequences
    offsetTransferInputStartPos.call(this, inputSeq.startPos + 1, incInputs);
}

function offsetTransferInputStartPos(startPos, offset) {
    // Adjust start position of all transfer input sequences starting at designated position and beyond
    this.transferInputSeqs.forEach((inputSeq) => {
        if (inputSeq.startPos >= startPos) {
            inputSeq.startPos += offset;
        }
    });

    // Also, adjust transfer input start position of transfer outputs
    this.transferOutputs.forEach((transferOutput) => {
        if (transferOutput.inputSeqStartPos >= startPos) {
            transferOutput.inputSeqStartPos += offset;
        }
    })
}


// CCTransaction function class (public) methods
//

// Converts a (deserialized) transaction into a Colored Coins transaction
//
//  Arguments:
//   transact: [Object(Transaction)] - Transaction object containing deserialized transaction to be converted
//
//  Return:
//   ccTransaction: [Object(CCTransaction)] - CCTransaction object containing resulting Colored Coins transaction
//                                             or undefined if deserialized transaction is not a valid Catenis Colored
//                                             Coins transaction
CCTransaction.fromTransaction = function (transact) {
    // Make sure that transaction contains valid Colored Coins data
    let nullDataOutputPos;
    let ccData;

    // Check if transaction contains Colored Coins data and null data output is in the correct position
    if (transact.hasNullDataOutput && ((nullDataOutputPos = transact.getNullDataOutputPosition()) !== undefined)
            && (ccData = checkColoredCoinsData(transact.getNullDataOutput().data)) !== undefined) {
        try {
            // Make sure that multi-signature tx output (if exists) is consistent
            let prevOutput;
            const multiSigTxOutput = nullDataOutputPos > 0
                && (prevOutput = transact.getOutputAt(nullDataOutputPos - 1)).type === BitcoinInfo.outputType.multisig
                ? prevOutput
                : undefined;

            if ((ccData.multiSig.length === 0 && multiSigTxOutput !== undefined)
                    || (ccData.multiSig.length > 0 && (multiSigTxOutput === undefined
                    || multiSigTxOutput.payInfo.addrInfo.length !== ccData.multiSig.length + 1))
            ) {
                // Multi-signature transaction output is not consistent with Colored Coins data.
                //  Log error condition, and throw (local) exception
                Catenis.logger.ERROR('Invalid Colored Coins transaction: multi-signature transaction output is not consistent with Colored Coins data', {
                    transact,
                    ccMultiSig: ccData.multiSig,
                    multiSigTxOutput
                });
                // noinspection ExceptionCaughtLocallyJS
                throw new Meteor.Error('ctn_cc_tx_inconsistent_multisig', 'Invalid Colored Coins transaction: multi-signature transaction output is not consistent with Colored Coins data');
            }

            const numPayOutputsBeforeNullData = multiSigTxOutput !== undefined ? nullDataOutputPos - 1 : nullDataOutputPos;

            // Make sure that payment tx outputs before null data output are used for a range payment
            if ((!ccData.payments[0].range && numPayOutputsBeforeNullData > 0)
                    || (ccData.payments[0].range && ccData.payments[0].output !== numPayOutputsBeforeNullData - 1)
            ) {
                // Payment tx outputs before null data output are consistent with Colored Coins data.
                //  Log error condition, and throw (local) exception
                Catenis.logger.ERROR('Invalid Colored Coins transaction: inconsistent Colored Coins range payment', {
                    transact,
                    ccPayments: ccData.payments,
                    numPayOutputsBeforeNullData
                });
                // noinspection ExceptionCaughtLocallyJS
                throw new Meteor.Error('ctn_cc_tx_invalid_cc_payment', 'Invalid Colored Coins transaction: inconsistent Colored Coins range payment');
            }

            const ccTransact = new CCTransaction();

            _und.extendOwn(ccTransact, transact);

            // Retrieve Colored Coins data associated with transaction inputs
            const txouts = Catenis.c3NodeClient.getTxouts(ccTransact.inputs.map(input => input.txout));

            // ...and add them to the tx inputs
            txouts.forEach((txout, idx) => {
                if (txout.assets !== undefined && txout.assets.length > 0) {
                    const firstAsset = txout.assets[0];
                    const txInputTxout = ccTransact.inputs[idx].txout;

                    txInputTxout.ccAssetId = firstAsset.assetId;
                    txInputTxout.assetAmount = firstAsset.amount;
                    txInputTxout.assetDivisibility = firstAsset.divisibility;
                    txInputTxout.isAggregatableAsset = firstAsset.aggregationPolicy === CCTransaction.aggregationPolicy.aggregatable;

                    if (firstAsset.aggregationPolicy === CCTransaction.aggregationPolicy.nonFungible) {
                        // Non-fungible asset. Get list of non-fungible token IDs in UTXO
                        const ccTokenIds = [];

                        for (const asset of txout.assets) {
                            if (asset.assetId !== firstAsset.assetId) {
                                Catenis.logger.WARN('Invalid Colored Coins transaction: tx output being spent contains asset entries for different assets', {
                                    transact,
                                    vin: idx,
                                    txout: txout
                                });
                                throw new Meteor.Error('ctn_cc_tx_inconsistent_input', 'Invalid Colored Coins transaction: tx output being spent contains asset entries for different assets');
                            }

                            ccTokenIds.push(asset.tokenId);
                        }

                        // Also adjust the asset amount to reflect the number of non-fungible tokens in the UTXO
                        txInputTxout.assetAmount = ccTokenIds.length;
                        txInputTxout.isNonFungible = true;
                        txInputTxout.ccTokenIds = ccTokenIds;
                    }
                    else if (txout.assets.length > 1) {
                        Catenis.logger.WARN('Invalid Colored Coins transaction: tx output being spent contains more than one asset entry', {
                            transact,
                            vin: idx,
                            txout: txout
                        });
                        throw new Meteor.Error('ctn_cc_tx_inconsistent_input', 'Invalid Colored Coins transaction: tx output being spent contains more than one asset entry assets');
                    }
                }
            });

            // Initialize both transfer input sequence and transfer outputs
            if (ccData.type === 'issuance') {
                // Get info for issuing new assets
                const issuingOpts = {
                    type: ccData.lockStatus ? CCTransaction.issuingAssetType.locked : CCTransaction.issuingAssetType.unlocked,
                    divisibility: ccData.divisibility,
                    isAggregatable: ccData.aggregationPolicy === CCTransaction.aggregationPolicy.aggregatable,
                    isNonFungible: ccData.aggregationPolicy === CCTransaction.aggregationPolicy.nonFungible
                };

                ccTransact.issuingInfo = {
                    ccAssetId: getAssetId(ccTransact.inputs[0].txout, ccTransact.inputs[0].address, issuingOpts),
                    assetAmount: ccData.amount,
                    type: issuingOpts.type,
                    divisibility: issuingOpts.divisibility,
                    isAggregatable: issuingOpts.isAggregatable,
                    isNonFungible: issuingOpts.isNonFungible
                };

                if (issuingOpts.isNonFungible) {
                    ccTransact.issuingInfo.ccTokenIds = getNFTokenIds(ccTransact.inputs[0].txout, ccTransact.inputs[0].address, issuingOpts, ccData.amount);
                }
            }

            let lastPaymentInput;
            let curInputPos = 0;
            let curOutputPos = nullDataOutputPos + 1;
            let totalAmountTransferred = 0;
            const usedOutputs = new Set();
            let ccPayments = [];
            let firstOutputPos = curOutputPos;
            let numReverseOutputs = 0;
            let expectedLastOutputPos = undefined;
            let outputInReverseOrder = false;

            ccData.payments.forEach((payment, idx) => {
                // Validate Colored Coins payment entry
                if (payment.input > ccTransact.inputs.length || (!payment.range && !payment.burn && payment.output > ccTransact.outputs.length)) {
                    Catenis.logger.ERROR('Invalid Colored Coins transaction: Colored Coins asset payment input/output index out of range', {
                        transact,
                        ccPayments: ccData.payments,
                        paymentIdx: idx,
                    });
                    throw new Meteor.Error('ctn_cc_tx_invalid_cc_payment', 'Invalid Colored Coins transaction: Colored Coins asset payment input/output index out of range');
                }

                if (payment.input !== curInputPos) {
                    Catenis.logger.ERROR('Invalid Colored Coins transaction: Colored Coins payment input does not have the expected value', {
                        transact,
                        ccPayments: ccData.payments,
                        paymentIdx: idx,
                        expectedInputPos: curInputPos
                    });
                    throw new Meteor.Error('ctn_cc_tx_invalid_pay_input', 'Invalid Colored Coins transaction: Colored Coins payment input does not have the expected value');
                }

                if (payment.range) {
                    if (idx !== 0) {
                        Catenis.logger.ERROR('Invalid Colored Coins transaction: unexpected Colored Coins range payment', {
                            transact,
                            ccPayments: ccData.payments,
                            paymentIdx: idx,
                        });
                        throw new Meteor.Error('ctn_cc_tx_invalid_cc_payment', 'Invalid Colored Coins transaction: unexpected Colored Coins range payment');
                    }

                    // Process range payment
                    for (let outputPos = 0, lastPos = payment.output; outputPos <= lastPos; outputPos++) {
                        // Set new transfer output
                        let txOutputPayInfo = ccTransact.outputs[outputPos].payInfo;

                        ccTransact.transferOutputs.push({
                            inputSeqStartPos: curInputPos,
                            address: txOutputPayInfo.address,
                            assetAmount: payment.amount
                        });

                        // Add Colored Coins asset info to respective tx output
                        let assetInfo;

                        if (curInputPos === 0 && ccTransact.issuingInfo !== undefined) {
                            // Asset issuance
                            assetInfo = {
                                ccAssetId: ccTransact.issuingInfo.ccAssetId,
                                assetAmount: payment.amount,
                                assetDivisibility: ccTransact.issuingInfo.divisibility
                            };
                        }
                        else {
                            // Asset transfer
                            const txInputTxout = ccTransact.inputs[curInputPos].txout;

                            assetInfo = {
                                ccAssetId: txInputTxout.ccAssetId,
                                assetAmount: payment.amount,
                                assetDivisibility: txInputTxout.assetDivisibility
                            }
                        }

                        ccTransact.outputs[outputPos].payInfo = {
                            ...txOutputPayInfo,
                            ...assetInfo
                        };

                        usedOutputs.add(outputPos);
                        ccTransact.numCcTransferOutputs++;

                        ccPayments.push({
                            input: payment.input,
                            amount: payment.amount,
                            output: outputPos
                        });
                        totalAmountTransferred += payment.amount;
                    }

                    lastPaymentInput = payment.input;
                }
                else {
                    // Process input sequence transition
                    if (lastPaymentInput !== undefined) {
                        if (lastPaymentInput !== payment.input) {
                            // A new input sequence is starting. Finalize last input sequence

                            if (expectedLastOutputPos !== undefined && expectedLastOutputPos !== firstOutputPos + usedOutputs.size - 1) {
                                // Expected last output position for input sequence (used to identify reverse
                                //  outputs) does not match actual last output position of input sequence
                                Catenis.logger.ERROR('Invalid Colored Coins transaction: inconsistent number of Colored Coins payment outputs in input sequence', {
                                    transact,
                                    ccPayments: ccData.payments,
                                    input: curInputPos,
                                    expectedLastOutputPos
                                });
                                throw new Meteor.Error('ctn_cc_tx_inconsistent_transfer', 'Invalid Colored Coins transaction: inconsistent number of Colored Coins payment outputs in input sequence');
                            }

                            // Determine number of inputs in sequence and get list of non-fungible tokens
                            //  transferred (if any)
                            let numInputs = 0;
                            let ccTokenIds;

                            if (curInputPos === 0 && ccTransact.issuingInfo !== undefined) {
                                // Special case for transferring new issued assets
                                if (totalAmountTransferred !== ccTransact.issuingInfo.assetAmount) {
                                    Catenis.logger.ERROR('Invalid Colored Coins transaction: not all newly issued assets are being transferred', {
                                        transact,
                                        issuedAmount: ccTransact.issuingInfo.assetAmount,
                                        totalAmountTransferred
                                    });
                                    throw new Meteor.Error('ctn_cc_tx_inconsistent_transfer', 'Invalid Colored Coins transaction: not all newly issued assets are being transferred');
                                }

                                numInputs++;

                                if (ccTransact.issuingInfo.ccTokenIds) {
                                    ccTokenIds = ccTransact.issuingInfo.ccTokenIds;
                                }
                            }
                            else {
                                let txInput;
                                let inputAmountTransferred = totalAmountTransferred;

                                while (inputAmountTransferred > 0 && (txInput = ccTransact.inputs[curInputPos + numInputs]) !== undefined && txInput.txout.assetAmount !== undefined) {
                                    inputAmountTransferred -= txInput.txout.assetAmount;

                                    numInputs++;
                                }

                                // Make sure that the exact amount transferred is supplied by the tx inputs
                                if (inputAmountTransferred !== 0) {
                                    Catenis.logger.ERROR('Invalid Colored Coins transaction: asset amount supplied by tx inputs does not match the amount being transferred', {
                                        transact,
                                        inputStartPos: curInputPos,
                                        numInputs,
                                        totalAmountTransferred,
                                        amountDifference: inputAmountTransferred
                                    });
                                    throw new Meteor.Error('ctn_cc_tx_inconsistent_transfer', 'Invalid Colored Coins transaction: asset amount supplied by tx inputs does not match the amount being transferred');
                                }

                                ccTransact.transferInputSeqs.push({
                                    startPos: curInputPos,
                                    nInputs: numInputs
                                });

                                if (ccTransact.inputs[curInputPos].txout.ccTokenIds) {
                                    ccTokenIds = ccTransact.inputs[curInputPos].txout.ccTokenIds;

                                    for (let inputPos = curInputPos + 1, limit = curInputPos + numInputs; inputPos < limit; inputPos++) {
                                        const input = ccTransact.inputs[inputPos];

                                        if (!input.txout.ccTokenIds) {
                                            Catenis.logger.ERROR('Invalid Colored Coins transaction: missing non-fungible token IDs in input associated with the transfer of non-fungible asset', {
                                                transact,
                                                ccPayments: ccData.payments,
                                                paymentIdx: idx,
                                                input: inputPos
                                            });
                                            throw new Meteor.Error('ctn_cc_tx_inconsistent_transfer', 'Invalid Colored Coins transaction: missing non-fungible token IDs in input associated with the transfer of non-fungible asset');
                                        }

                                        ccTokenIds = ccTokenIds.concat(input.txout.ccTokenIds);
                                    }
                                }
                            }

                            if (ccTokenIds && ccTokenIds.length > 0) {
                                // Transferring non-fungible tokens
                                let transferredTokens = 0;

                                for (const payment of ccPayments) {
                                    if (!payment.burn) {
                                        // Asset transfer.
                                        //  Get list of non-fungible token IDs for the current output
                                        const outputCCTokenIds = ccTokenIds.slice(transferredTokens, transferredTokens + payment.amount);

                                        if (outputCCTokenIds.length !== payment.amount) {
                                            Catenis.logger.ERROR('Invalid Colored Coins transaction: not enough non-fungible token IDs to be added to tx output receiving non-fungible tokens', {
                                                transact,
                                                ccPayments: ccData.payments,
                                                paymentIdx: idx,
                                                expectedAmount: payment.amount,
                                                availableAmount: outputCCTokenIds.length
                                            });
                                            throw new Meteor.Error('ctn_cc_tx_inconsistent_transfer', 'Invalid Colored Coins transaction: not enough non-fungible token IDs to be added to tx output receiving non-fungible tokens');
                                        }

                                        const payInfo = ccTransact.outputs[payment.output].payInfo;

                                        if (!payInfo.ccAssetId) {
                                            Catenis.logger.ERROR('Invalid Colored Coins transaction: tx output receiving non-fungible tokens does not have asset info', {
                                                transact,
                                                ccPayments: ccData.payments,
                                                paymentIdx: idx,
                                                txOutput: ccTransact.outputs[payment.output]
                                            });
                                            throw new Meteor.Error('ctn_cc_tx_inconsistent_transfer', 'Invalid Colored Coins transaction: tx output receiving non-fungible tokens does not have asset info');
                                        }

                                        // Update output with list of transferred non-fungible token IDs
                                        payInfo.ccTokenIds = !payInfo.ccTokenIds
                                            ? outputCCTokenIds
                                            : payInfo.ccTokenIds.concat(outputCCTokenIds);
                                    }

                                    transferredTokens += payment.amount;
                                }
                            }

                            curInputPos += numInputs;
                            totalAmountTransferred = 0;
                            lastPaymentInput = payment.input;
                            usedOutputs.clear();
                            ccPayments = [];
                            firstOutputPos = curOutputPos;
                            numReverseOutputs = 0;
                            expectedLastOutputPos = undefined;
                        }
                    }
                    else {
                        lastPaymentInput = payment.input;
                    }

                    // Determine if payment output is in reverse order
                    outputInReverseOrder = false;

                    if (!payment.burn && !usedOutputs.has(payment.output) && payment.output !== curOutputPos - numReverseOutputs) {
                        // Payment output not in expected order. Check if output is in reverse order
                        let error = false;

                        if (payment.output > firstOutputPos) {
                            if (expectedLastOutputPos === undefined) {
                                // Expected last output position for input sequence not set yet.
                                //  So assume output is in reverse order, and calculate it
                                expectedLastOutputPos = curOutputPos - firstOutputPos + payment.output;
                                outputInReverseOrder = true;
                            }
                            else {
                                // Expected last output position for input sequence already set.
                                //  Validate reverse order position
                                if (payment.output === expectedLastOutputPos - (curOutputPos - firstOutputPos)) {
                                    outputInReverseOrder = true;
                                }
                                else {
                                    error = true;
                                }
                            }

                            numReverseOutputs++;
                        }
                        else {
                            error = true;
                        }

                        if (error) {
                            // Output not in a valid reverse order (nor normal order for that matter)
                            Catenis.logger.ERROR('Invalid Colored Coins transaction: Colored Coins payment output is not in the expect order', {
                                transact,
                                ccPayments: ccData.payments,
                                paymentIdx: idx,
                                expectedOutputPos: curOutputPos
                            });
                            throw new Meteor.Error('ctn_cc_tx_pay_out_of_order', 'Invalid Colored Coins transaction: Colored Coins payment output is not in the expect order');
                        }
                    }

                    // Process Colored Coins payment
                    if (!payment.burn) {
                        // Set new transfer output
                        let txOutputPayInfo = ccTransact.outputs[payment.output].payInfo;

                        ccTransact.transferOutputs.push({
                            inputSeqStartPos: curInputPos,
                            address: txOutputPayInfo.address,
                            assetAmount: payment.amount,
                            reverseOutput: outputInReverseOrder
                        });

                        if (!usedOutputs.has(payment.output)) {
                            if (txOutputPayInfo.ccAssetId) {
                                // Inconsistency: tx output not yet used in input sequence already has asset info
                                Catenis.logger.ERROR('Invalid Colored Coins transaction: Colored Coins payment output being referenced by more than one input sequence', {
                                    transact,
                                    ccPayments: ccData.payments,
                                    paymentIdx: idx,
                                });
                                throw new Meteor.Error('ctn_cc_tx_inconsistent_transfer', 'Invalid Colored Coins transaction: Colored Coins payment output being referenced by more than one input sequence');
                            }

                            // Add Colored Coins asset info to respective tx output
                            let assetInfo;

                            if (curInputPos === 0 && ccTransact.issuingInfo !== undefined) {
                                // Asset issuance
                                assetInfo = {
                                    ccAssetId: ccTransact.issuingInfo.ccAssetId,
                                    assetAmount: payment.amount,
                                    assetDivisibility: ccTransact.issuingInfo.divisibility
                                };
                            }
                            else {
                                // Asset transfer
                                const txInputTxout = ccTransact.inputs[curInputPos].txout;

                                assetInfo = {
                                    ccAssetId: txInputTxout.ccAssetId,
                                    assetAmount: payment.amount,
                                    assetDivisibility: txInputTxout.assetDivisibility
                                }
                            }

                            ccTransact.outputs[payment.output].payInfo = {
                                ...txOutputPayInfo,
                                ...assetInfo
                            };

                            usedOutputs.add(payment.output);
                            ccTransact.numCcTransferOutputs++;

                            curOutputPos++;
                        }
                        else {
                            // Output already used in this input sequence. Update asset amount
                            txOutputPayInfo.assetAmount += payment.amount;
                        }
                    }
                    else {
                        // Set new burn transfer output
                        ccTransact.transferOutputs.push({
                            inputSeqStartPos: curInputPos,
                            address: undefined,
                            assetAmount: payment.amount
                        });
                    }

                    ccPayments.push(payment);
                    totalAmountTransferred += payment.amount;
                }
            });

            // Finalize last input sequence

            if (expectedLastOutputPos !== undefined && expectedLastOutputPos !== firstOutputPos + usedOutputs.size - 1) {
                // Expected last output position for input sequence (used to identify reverse
                //  outputs) does not match actual last output position of input sequence
                Catenis.logger.ERROR('Invalid Colored Coins transaction: inconsistent number of Colored Coins payment outputs in input sequence', {
                    transact,
                    ccPayments: ccData.payments,
                    input: curInputPos,
                    expectedLastOutputPos
                });
                // noinspection ExceptionCaughtLocallyJS
                throw new Meteor.Error('ctn_cc_tx_inconsistent_transfer', 'Invalid Colored Coins transaction: inconsistent number of Colored Coins payment outputs in input sequence');
            }

            // Determine number of inputs in sequence and get list of non-fungible tokens
            //  transferred (if any)
            let ccTokenIds;

            if (ccTransact.issuingInfo !== undefined && curInputPos === 0) {
                // Special case for transferring new issued assets
                if (totalAmountTransferred !== ccTransact.issuingInfo.assetAmount) {
                    Catenis.logger.ERROR('Invalid Colored Coins transaction: not all newly issued assets are being transferred', {
                        transact,
                        issuedAmount: ccTransact.issuingInfo.assetAmount,
                        totalAmountTransferred
                    });
                    // noinspection ExceptionCaughtLocallyJS
                    throw new Meteor.Error('ctn_cc_tx_inconsistent_transfer', 'Invalid Colored Coins transaction: not all newly issued assets are being transferred');
                }

                if (ccTransact.issuingInfo.ccTokenIds) {
                    ccTokenIds = ccTransact.issuingInfo.ccTokenIds;
                }
            }
            else {
                let numInputs = 0;
                let txInput;
                let inputAmountTransferred = totalAmountTransferred;

                while (inputAmountTransferred > 0 && (txInput = ccTransact.inputs[curInputPos + numInputs]) !== undefined && txInput.txout.assetAmount !== undefined) {
                    inputAmountTransferred -= txInput.txout.assetAmount;

                    numInputs++;
                }

                // Make sure that the exact amount transferred is supplied by the tx inputs
                if (inputAmountTransferred !== 0) {
                    Catenis.logger.ERROR('Invalid Colored Coins transaction: asset amount supplied by tx inputs does not match the amount being transferred', {
                        transact,
                        inputStartPos: curInputPos,
                        numInputs,
                        totalAmountTransferred,
                        amountDifference: inputAmountTransferred
                    });
                    // noinspection ExceptionCaughtLocallyJS
                    throw new Meteor.Error('ctn_cc_tx_inconsistent_transfer', 'Invalid Colored Coins transaction: asset amount supplied by tx inputs does not match the amount being transferred');
                }

                ccTransact.transferInputSeqs.push({
                    startPos: curInputPos,
                    nInputs: numInputs
                });

                if (ccTransact.inputs[curInputPos].txout.ccTokenIds) {
                    ccTokenIds = ccTransact.inputs[curInputPos].txout.ccTokenIds;

                    for (let inputPos = curInputPos + 1, limit = curInputPos + numInputs; inputPos < limit; inputPos++) {
                        const input = ccTransact.inputs[inputPos];

                        if (!input.txout.ccTokenIds) {
                            Catenis.logger.ERROR('Invalid Colored Coins transaction: missing non-fungible token IDs in input associated with the transfer of non-fungible asset', {
                                transact,
                                ccPayments: ccData.payments,
                                input: inputPos
                            });
                            // noinspection ExceptionCaughtLocallyJS
                            throw new Meteor.Error('ctn_cc_tx_inconsistent_transfer', 'Invalid Colored Coins transaction: missing non-fungible token IDs in input associated with the transfer of non-fungible asset');
                        }

                        ccTokenIds = ccTokenIds.concat(input.txout.ccTokenIds);
                    }
                }
            }

            if (ccTokenIds && ccTokenIds.length > 0) {
                // Transferring non-fungible tokens
                let transferredTokens = 0;

                for (const payment of ccPayments) {
                    if (!payment.burn) {
                        // Asset transfer.
                        //  Get list of non-fungible token IDs for the current output
                        const outputCCTokenIds = ccTokenIds.slice(transferredTokens, transferredTokens + payment.amount);

                        if (outputCCTokenIds.length !== payment.amount) {
                            Catenis.logger.ERROR('Invalid Colored Coins transaction: not enough non-fungible token IDs to be added to tx output receiving non-fungible tokens', {
                                transact,
                                ccPayments: ccData.payments,
                                expectedAmount: payment.amount,
                                availableAmount: outputCCTokenIds.length
                            });
                            // noinspection ExceptionCaughtLocallyJS
                            throw new Meteor.Error('ctn_cc_tx_inconsistent_transfer', 'Invalid Colored Coins transaction: not enough non-fungible token IDs to be added to tx output receiving non-fungible tokens');
                        }

                        const payInfo = ccTransact.outputs[payment.output].payInfo;

                        if (!payInfo.ccAssetId) {
                            Catenis.logger.ERROR('Invalid Colored Coins transaction: tx output receiving non-fungible tokens does not have asset info', {
                                transact,
                                ccPayments: ccData.payments,
                                txOutput: ccTransact.outputs[payment.output]
                            });
                            // noinspection ExceptionCaughtLocallyJS
                            throw new Meteor.Error('ctn_cc_tx_inconsistent_transfer', 'Invalid Colored Coins transaction: tx output receiving non-fungible tokens does not have asset info');
                        }

                        // Update output with list of transferred non-fungible token IDs
                        payInfo.ccTokenIds = !payInfo.ccTokenIds
                            ? outputCCTokenIds
                            : payInfo.ccTokenIds.concat(outputCCTokenIds);
                    }

                    transferredTokens += payment.amount;
                }
            }

            // Retrieve Colored Coins metadata if any
            if (ccData.protocol === hexPrefixToProtocolId(cfgSettings.c3ProtocolPrefix)) {
                // Special case for Catenis Colored Coins protocol
                let cid;

                if (ccData.cid) {
                    // Get CID (or the initial part of it) that was recorded along with the Colored Coins data
                    cid = Buffer.from(ccData.cid);
                }

                if (ccData.multiSig.length > 0) {
                    // Get remainder of CID from multi-sig outputs
                    let cidLeftLength;

                    ccData.multiSig.forEach((multiSigInfo, idx) => {
                        let keyData = Buffer.from(multiSigTxOutput.payInfo.addrInfo[multiSigInfo.index], 'hex').slice(1);

                        if (idx === 0) {
                            // Get length of part of CID stored in multi-sig output
                            cidLeftLength = keyData[keyData.length - 1];
                            keyData = keyData.slice(0, keyData.length - 1);
                        }

                        const cidPart = keyData.slice(-cidLeftLength);
                        cidLeftLength -= cidPart.length;

                        cid = cid !== undefined ? Buffer.concat([cid, cidPart], cid.length + cidPart.length) : cidPart;
                    });

                    ccTransact.includesMultiSigOutput = true;
                }

                if (cid !== undefined) {
                    // Get metadata using crypto keys from first input to decrypt user data (if required)
                    const firstInput = ccTransact.getInputAt(0);

                    ccTransact.ccMetadata = CCMetadata.fromCID(
                        cid,
                        firstInput.addrInfo !== undefined ? firstInput.addrInfo.cryptoKeys : undefined,
                        ccTransact.getCCMetadataNFTokensCryptoKeys()
                    );
                }
            }
            else {
                let torrentHash;
                let sha2;

                if (ccData.torrentHash) {
                    torrentHash = ccData.torrentHash.toString('hex');

                    if (ccData.sha2) {
                        sha2 = ccData.sha2.toString('hex');
                    }
                    else if (ccData.multiSig.length === 1) {
                        // Get SHA2 of metadata from multi-signature output
                        // noinspection JSObjectNullOrUndefined
                        sha2 = multiSigTxOutput.payInfo.addrInfo[1].substr(2 * (txCfgSettings.pubKeySize - cfgSettings.sha2Size));

                        ccTransact.includesMultiSigOutput = true;
                    }
                    else {
                        // Inconsistent Colored Coins data; multiSig length different than expected
                        //  Log error condition and throw exception
                        Catenis.logger.ERROR('Invalid Colored Coins transaction: inconsistent Colored Coins data; multiSig length different than expected', {
                            ccData,
                            expectedMultiSigLength: 1
                        });
                        // noinspection ExceptionCaughtLocallyJS
                        throw new Meteor.Error('ctn_cc_tx_inconsistent_cc_data', 'Invalid Colored Coins transaction: inconsistent Colored Coins data; multiSig length different than expected');
                    }
                }
                else if (ccData.multiSig.length === 2) {
                    // Get both torrent hash and SHA2 of metadata from multi-signature output
                    ccData.multiSig.forEach((multiSig) => {
                        if (multiSig.hashType === 'sha2') {
                            sha2 = multiSigTxOutput.payInfo.addrInfo[multiSig.index].substr(2 * (txCfgSettings.pubKeySize - cfgSettings.sha2Size));
                        }
                        else if (multiSig.hashType === 'torrentHash') {
                            torrentHash = multiSigTxOutput.payInfo.addrInfo[multiSig.index].substr(2 * (txCfgSettings.pubKeySize - cfgSettings.torrentHashSize));
                        }
                    });

                    ccTransact.includesMultiSigOutput = true;
                }
                else if (ccData.multiSig.length > 0) {
                    // Inconsistent Colored Coins data; multiSig length different than expected
                    //  Log error condition and throw exception
                    Catenis.logger.ERROR('Invalid Colored Coins transaction: inconsistent Colored Coins data; multiSig length different than expected', {
                        ccData,
                        expectedMultiSigLength: 0
                    });
                    // noinspection ExceptionCaughtLocallyJS
                    throw new Meteor.Error('ctn_cc_tx_inconsistent_cc_data', 'Invalid Colored Coins transaction: inconsistent Colored Coins data; multiSig length different than expected');
                }

                if (torrentHash !== undefined) {
                    // Make sure that torrentHash has been converted into IPFS CID
                    let cid;

                    if ((cid = CCMetadata.checkCIDConverted(torrentHash))) {
                        // Get metadata using crypto keys from first input to decrypt user data (if required)
                        const firstInput = ccTransact.getInputAt(0);

                        ccTransact.ccMetadata = CCMetadata.fromCID(
                            cid,
                            firstInput.addrInfo !== undefined ? firstInput.addrInfo.cryptoKeys : undefined,
                            ccTransact.getCCMetadataNFTokensCryptoKeys()
                        );
                    }
                    else {
                        Catenis.logger.WARN('Cannot retrieve Colored Coins metadata that is stored in BitTorrent', {
                            txid: ccTransact.txid,
                            torrentHash: torrentHash
                        });
                    }
                }
            }

            ccTransact.isAssembled = true;

            // Return Colored Coins transaction
            return ccTransact;
        }
        catch (err) {
            if (!(err instanceof Meteor.Error)
                    || !['ctn_cc_tx_inconsistent_input',
                    'ctn_cc_tx_invalid_cc_payment',
                    'ctn_cc_tx_invalid_pay_input',
                    'ctn_cc_tx_pay_out_of_order',
                    'ctn_cc_tx_inconsistent_transfer',
                    'ctn_cc_tx_inconsistent_cc_data'].includes(err.error)) {
                // Throws exception if not any locally thrown exception
                throw err;
            }
        }
    }
    else {
        // No Colored Coins data or null data output in an unexpected position
        //  Log error condition
        Catenis.logger.ERROR('Invalid Colored Coins transaction: no Colored Coins data or null data output in an unexpected position', {
            transact
        });
    }
};


// CCTransaction function class (public) properties
//

CCTransaction.issuingAssetType = Object.freeze({
    locked: 'locked',
    unlocked: 'unlocked'
});

CCTransaction.aggregationPolicy = Object.freeze({
    aggregatable: 'aggregatable',
    hybrid: 'hybrid',
    dispersed: 'dispersed',
    nonFungible: 'nonFungible'
});

CCTransaction.largestDivisibility = 7;

// Definition of module (private) functions
//

/**
 * Get Colored Coins ID that will be attributed to new asset being issued
 * @param {{txid:string, vout:number}} txout Blockchain transaction output
 * @param {string} address Blockchain address
 * @param {{type:string, divisibility:number, isAggregatable:boolean, isNonFungible:boolean}} issuingOpts Asset issuing options
 * @return {string}
 */
function getAssetId(txout, address, issuingOpts) {
    return ccAssetIdEncoder({
        ccdata: [{
            type: 'issuance',
            lockStatus: issuingOpts.type === CCTransaction.issuingAssetType.locked,
            divisibility: issuingOpts.divisibility,
            aggregationPolicy: issuingOpts.isAggregatable
                ? CCTransaction.aggregationPolicy.aggregatable
                : (issuingOpts.isNonFungible ? CCTransaction.aggregationPolicy.nonFungible : CCTransaction.aggregationPolicy.dispersed)
        }],
        vin: [{
            txid: txout.txid,
            vout: txout.vout,
            address: address
        }]
    }, Catenis.application.cryptoNetwork);
}

/**
 * Get list of Colored Coins IDs that will be attributed to new non-fungible tokens being issued
 * @param {{txid:string, vout:number}} txout Blockchain transaction output
 * @param {string} address Blockchain address
 * @param {{type:string, divisibility:number, isAggregatable:boolean, isNonFungible:boolean}} issuingOpts Asset issuing options
 * @param {number} numNFTokens of non-fungible tokens to issue
 * @return {string[]}
 */
function getNFTokenIds(txout, address, issuingOpts, numNFTokens) {
    return ccAssetIdEncoder({
        ccdata: [{
            protocol: hexPrefixToProtocolId(cfgSettings.c3ProtocolPrefix),
            type: 'issuance',
            amount: numNFTokens,
            lockStatus: issuingOpts.type === CCTransaction.issuingAssetType.locked,
            divisibility: issuingOpts.divisibility,
            aggregationPolicy: issuingOpts.isAggregatable
                ? CCTransaction.aggregationPolicy.aggregatable
                : (issuingOpts.isNonFungible ? CCTransaction.aggregationPolicy.nonFungible : CCTransaction.aggregationPolicy.dispersed)
        }],
        vin: [{
            txid: txout.txid,
            vout: txout.vout,
            address: address
        }]
    }, Catenis.application.cryptoNetwork, true);
}

// Checks and returns decoded Colored Coins data if it is valid
//
//  Arguments:
//   ccData: [Object(Buffer)] - Buffer object containing data (from transaction null data output) to be checked
//
//  Return:
//   result: [Object(CCBuilder)] - CCBuilder object containing  decoded Colored Coins data or undefined if supplied data is not valid
function checkColoredCoinsData(ccData) {
    const ccHeader = Buffer.from(cfgSettings.ccProtocolPrefix + cfgSettings.ccVersionByte, 'hex');  // For Catenis Colored Coins protocol
    const c3Header = Buffer.from(cfgSettings.c3ProtocolPrefix + cfgSettings.ccVersionByte, 'hex');

    if ((ccData.length > c3Header.length && ccData.slice(0, c3Header.length).equals(c3Header))
            || (ccData.length > ccHeader.length && ccData.slice(0, ccHeader.length).equals(ccHeader))) {
        try {
            return CCBuilder.fromHex(ccData);
        }
        catch (err) {}
    }
}

function isCcDataTooLargeError(err) {
    return /^data code.*bigger.*$/i.test(err.message);
}

function hexPrefixToProtocolId(hex) {
    const buf = Buffer.from(hex, 'hex');

    return (buf[0] << 8) + buf[1];
}

// Module code
//

// Lock function class
Object.freeze(CCTransaction);
