/**
 * Created by claudio on 2022-02-12
 */

//console.log('[NFAssetIssuance.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import config from 'config';
import moment from 'moment';
import Future from 'fibers/future';
// Meteor packages
import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { CriticalSection } from './CriticalSection';
import { NFTokenIssuingBatch } from './NFTokenIssuingBatch';
import { NFTokenContentsUrl } from './NFTokenContentsUrl';
import { CCMetadata } from './CCMetadata';
import {
    Asset,
    newAssetId
} from './Asset';
import { CCSingleNFTokenMetadata } from './CCSingleNFTokenMetadata';
import { CryptoKeys } from './CryptoKeys';
import { Util } from './Util';

// Config entries
const nfAssetIssuanceConfig = config.get('nfAssetIssuance');

// Configuration settings
const cfgSettings = {
    timeContinueIssuance: nfAssetIssuanceConfig.get('timeContinueIssuance'),
    timeKeepIncompleteIssuance: nfAssetIssuanceConfig.get('timeKeepIncompleteIssuance'),
    timeKeepProcessedIssuance: nfAssetIssuanceConfig.get('timeKeepProcessedIssuance'),
    purgeOldIssuancesInterval: nfAssetIssuanceConfig.get('purgeOldIssuancesInterval'),
    percentSaveNFTokensMetadata: nfAssetIssuanceConfig.get('percentSaveNFTokensMetadata')
};


// Definition of classes
//

/**
 * Non-Fungible Asset Issuance object class
 */
export class NFAssetIssuance {
    /**
     * Critical section object to avoid concurrent access to database collections related to non-fungible
     *  asset issuance (NonFungibleAssetIssuance, and NonFungibleTokenIssuingBatch)
     * @type {CriticalSection}
     */
    static dbCS = new CriticalSection();

    /**
     * @type {Object}
     * @property {(undefined|number)} purgeOldIssuances
     */
    static intervalHandle = {
        purgeOldIssuances: undefined
    };

    /**
     * @typedef {Object} NonFungibleTokenProps
     * @property {string} name The non-fungible token name
     * @property {string} [description] A brief description about the non-fungible token
     * @property {Object.<string, any>} [custom] A dictionary of custom defined non-fungible token's properties
     */

    /**
     * @typedef {Object} NonFungibleTokenInfo
     * @property {NonFungibleTokenProps} [metadata] The non-fungible token's properties
     * @property {Buffer} [contents] Another part of the non-fungible token contents
     */

    /**
     * @typedef {(NonFungibleTokenInfo|null)} NonFungibleTokenInfoEntry
     */

    /**
     * @typedef {Object} NonFungibleAssetProps
     * @property {string} name The name of the non-fungible asset
     * @property {string} [description] A brief description about the non-fungible asset
     * @property {boolean} canReissue Indicates whether more non-fungible tokens of this asset can be issued at
     *                                 another time (an unlocked asset)
     */

    /**
     * @typedef {Object} NonFungibleAssetIssuanceError
     * @property {number} code Code number of error that took place while processing the asset issuance
     * @property {string} message Text describing the error that took place while processing the asset issuance
     */

    /**
     * @typedef {Object} NonFungibleAssetIssuanceStoredProgress
     * @property {number} totalContentsBytes Total non-fungible tokens' contents length in bytes (to be stored)
     * @property {number} contentsBytesStored Number of non-fungible tokens' contents bytes already stored
     * @property {number} totalMetadataBytes Total length of metadata for issuing asset metadata in bytes (to be stored)
     * @property {number} metadataBytesStored Number of metadata bytes already stored
     * @property {boolean} done Indicates whether processing has been finalized either successfully (asset issued)
     *                           or with an error
     * @property {boolean} [success] Indicates whether the asset issuance has been successfully completed
     * @property {NonFungibleAssetIssuanceError} [error] Error that took place while processing the asset issuance
     * @property {Date} [finishDate] Date and time when processing was finalized
     */

    /**
     * @typedef {Object} NonFungibleAssetIssuanceResult
     * @property {string} [assetId] Catenis asset ID of the newly issued non-fungible asset. Not included in case of
     *                               reissuance
     * @property {string[]} nfTokenIds List of IDs of the newly issued Catenis non-fungible tokens
     */

    /**
     * @typedef {Object} NonFungibleAssetIssuanceProgress
     * @property {number} percentProcessed The percentage of the total asset issuance process that have already been
     *                                      completed
     * @property {boolean} done Indicates whether processing has been finalized either successfully (asset issued)
     *                           or with an error
     * @property {boolean} [success] Indicates whether the asset issuance has been successfully completed
     * @property {NonFungibleAssetIssuanceError} [error] Error that took place while processing the asset issuance
     * @property {Date} [finishDate] Date and time when processing was finalized
     */

    /**
     * NonFungibleAssetIssuance database doc/rec
     * @typedef {Object} NonFungibleAssetIssuanceRec
     * @property {string} _id MongoDB internal document ID provided by Meteor
     * @property {string} assetIssuanceId External ID used to uniquely identify this non-fungible asset issuance
     * @property {string} deviceId Device ID of device to which this asset issuance belongs
     * @property {NonFungibleAssetProps} [asset] Properties of the new non-fungible asset to issue. Only used when
     *                                            issuing a non-fungible asset for the first time
     * @property {boolean} isReissuance Indicates whether this is actually used to issue more non-fungible tokens of a
     *                                   previously issued non-fungible asset
     * @property {string[]} holdingDeviceIds List of device IDs identifying the devices that will hold the non-fungible
     *                                        tokens issued with this asset
     * @property {boolean} asyncProc Indicates whether processing should be done asynchronously
     * @property {Object} nonFungibleToken
     * @property {number} nonFungibleToken.quantity Number of non-fungible tokens to be issued with this asset
     * @property {boolean} nonFungibleToken.encryptContents Indicates whether the non-fungible tokens' contents should
     *                                                       be encrypted before being stored (on IPFS)
     * @property {NonFungibleAssetIssuanceStoredProgress} [progress] Asset issuance progress
     * @property {string} [assetId] Catenis asset ID of the newly/previously issued non-fungible asset
     * @property {string[]} [tokenIds] List of Catenis token ID of the newly issued non-fungible tokens
     * @property {Date} createdDate Date and time when database doc/rec has been created
     */

    /**
     * Class constructor
     *
     * NOTE: objects of this class should be instantiated and used from code executed from the NFAssetIssuance.dbCS
     *        critical section object, while the asset issuance is being composed.
     *
     * @param {NonFungibleAssetIssuanceRec} [doc] NonFungibleAssetIssuance database doc/rec
     * @param {boolean} [preloadNFTContents=false] Indicates whether non-fungible tokens' contents should be preloaded
     * @param {string} [deviceId] ID of the device that is issuing the non-fungible asset
     * @param {(NonFungibleAssetProps|string)} [assetPropsOrId] Properties of the new non-fungible asset to issue, or
     *                                                           external ID of a previously issued non-fungible asset
     *                                                           (for reissuance)
     * @param {boolean} [encryptNFTContents] Indicates whether the non-fungible tokens' contents should be encrypted
     *                                        before being stored (on IPFS)
     * @param {(string|string[])} [holdingDeviceIds] A single ID or a list of ID of the devices that will hold the
     *                                                non-fungible tokens being issued
     * @param {NonFungibleTokenInfoEntry[]} [nfTokenInfos] List of information about the non-fungible tokens to issue
     * @param {boolean} [isFinal=true] Indicates whether the information about the non-fungible tokens to issue is
     *                                  complete
     * @param {boolean} [asyncProc=false] Indicates whether processing should be done asynchronously
     */
    constructor(
        doc,
        preloadNFTContents = false,
        deviceId,
        assetPropsOrId,
        encryptNFTContents,
        holdingDeviceIds,
        nfTokenInfos,
        isFinal = true,
        asyncProc = false
    ) {
        if (doc) {
            this.doc_id = doc._id;
            this.assetIssuanceId = doc.assetIssuanceId;
            this.deviceId = doc.deviceId;
            this.asset = doc.asset;
            this.isReissuance = doc.isReissuance;
            this.holdingDeviceIds = doc.holdingDeviceIds;
            this.asyncProc = doc.asyncProc;
            this.nonFungibleToken = doc.nonFungibleToken;
            this.progress = doc.progress;
            this.assetId = doc.assetId;
            this.tokenIds = doc.tokenIds;
            this.createdDate = doc.createdDate;

            this._loadNFTokenIssuingBatches(preloadNFTContents);
        }
        else {
            // Creating a new non-fungible asset issuance object.
            //  Validate arguments
            const errArg = {};

            if (typeof deviceId !== 'string') {
                errArg.deviceId = deviceId;
            }

            if (!Util.isNonNullObject(assetPropsOrId) && typeof assetPropsOrId !== 'string') {
                errArg.assetPropsOrId = assetPropsOrId;
            }

            if (typeof holdingDeviceIds !== 'string' && (!Array.isArray(holdingDeviceIds)
                    || holdingDeviceIds.length === 0 || holdingDeviceIds.some(id => typeof id !== 'string'))) {
                errArg.holdingDeviceIds = holdingDeviceIds;
            }

            if (!Array.isArray(nfTokenInfos) || nfTokenInfos.length === 0 || nfTokenInfos.some(info => typeof info !== 'object')) {
                errArg.nfTokenInfos = nfTokenInfos;
            }

            if (Object.keys(errArg).length > 0) {
                const errArgs = Object.keys(errArg);

                Catenis.logger.ERROR(`NFAssetIssuance constructor called with invalid argument${errArgs.length > 1 ? 's' : ''}`, errArg);
                throw new TypeError(`Invalid ${errArgs.join(', ')} argument${errArgs.length > 1 ? 's' : ''}`);
            }

            if (Array.isArray(holdingDeviceIds)) {
                // Make sure that number of holding devices is consistent with number of tokens to issue
                if (holdingDeviceIds.length !== nfTokenInfos.length) {
                    throw new Meteor.Error('nf_asset_issue_wrong_num_hold_devices', 'Number of holding devices is not consistent with the number of non-fungible tokens to be issued');
                }
            }
            else {
                holdingDeviceIds = [holdingDeviceIds];
            }

            this.deviceId = deviceId;

            if (typeof assetPropsOrId === 'object') {
                this.asset = assetPropsOrId;
                this.isReissuance = false;
            }
            else {
                this.assetId = assetPropsOrId;
                this.isReissuance = true;
            }

            this.holdingDeviceIds = holdingDeviceIds;
            this.asyncProc = !!asyncProc;
            this.nonFungibleToken = {
                quantity: nfTokenInfos.length,
                encryptContents: !!encryptNFTContents
            };

            // Initialize non-fungible token issuing batches for this asset issuance...
            this.nfTokenIssuingBatches = [];
            this.nfTokenIssuingBatches.push(new NFTokenIssuingBatch(undefined, undefined, this, nfTokenInfos, isFinal));

            // and save to the database
            this._saveToDB();
        }
    }

    /**
     * Get the total bytes of the non-fungible tokens' contents for this asset issuance
     * @return {number}
     * @private
     */
    get _totalNFTokensContentsBytes() {
        if (this._totalContentsBytes === undefined) {
            const getTotalNFTokensContentsLength = async () => {
                if (!this.isComplete) {
                    throw new Error('Non-fungible asset issuance data not yet complete');
                }

                // noinspection JSUnresolvedFunction
                const docs = await Catenis.db.mongoCollection.NonFungibleTokenIssuingBatch.aggregate([
                    {
                        $match: {
                            nonFungibleAssetIssuance_id: this.doc_id
                        }
                    },
                    {
                        $sort: {
                            order: 1
                        }
                    },
                    {
                        $lookup: {
                            from: 'NonFungibleTokenIssuingPart',
                            let: {
                                batch_id: '$_id'
                            },
                            pipeline: [
                                {
                                    $match: {
                                        contents: {
                                            $ne: null
                                        },
                                        $expr: {
                                            $eq: ['$nonFungibleTokenIssuingBatch_id', '$$batch_id']
                                        }
                                    }
                                },
                                {
                                    $project: {
                                        contentsLength: {
                                            $binarySize: '$contents'
                                        }
                                    }
                                }
                            ],
                            as: 'nfTokenIssuingParts'
                        }
                    },
                    {
                        $unwind: '$nfTokenIssuingParts'
                    },
                    {
                        $group: {
                            _id: '$nonFungibleAssetIssuance_id',
                            totalContentsLength: {
                                $sum: '$nfTokenIssuingParts.contentsLength'
                            }
                        }
                    }
                ])
                .toArray();

                return docs && docs.length > 0 ? docs[0].totalContentsLength : 0;
            }

            try {
                this._totalContentsBytes = Future.fromPromise(getTotalNFTokensContentsLength()).wait();
            }
            catch (err) {
                Catenis.logger.ERROR('Error computing total non-fungible tokens\' contents length for non-fungible asset issuance (doc_id: %s).', this.doc_id, err);
                throw new Error(`Error computing total non-fungible tokens\' contents length for non-fungible asset issuance: ${err}`);
            }
        }

        return this._totalContentsBytes;
    }

    /**
     * Get the estimated size (in bytes) of the metadata for issuing the non-fungible asset
     * @returns {number}
     * @private
     */
    get _estimatedAssetMetadataSize() {
        if (this._estimatedMetadataSize === undefined) {
            try {
                // Estimate the size of the metadata of the non-fungible asset being issued
                const ccMetadata = new CCMetadata();

                const asset = this.asset ? this.asset : Asset.getAssetByAssetId(this.assetId);

                ccMetadata.assetMetadata.setAssetProperties({
                    ctnAssetId: this.assetId ? this.assetId : newAssetId(),
                    name: asset.name,
                    description: asset.description
                });

                ccMetadata.nfTokenMetadata.addNewNFTokensMetadata(
                    this._getNFTokensMetadataForSizeEstimate().map(nfTokenProps => {
                        const metadata = new CCSingleNFTokenMetadata();
                        metadata.setNFTokenProperties(nfTokenProps)

                        return metadata;
                    })
                );
                
                const nfTokenEncCryptoKeys = [];
                
                for (let idx = 0, limit = this.numberOfNFTokens; idx < limit; idx++) {
                    nfTokenEncCryptoKeys.push(CryptoKeys.random());
                }
                
                ccMetadata.assemble(CryptoKeys.random(), nfTokenEncCryptoKeys);
                
                this._estimatedMetadataSize = ccMetadata.estimatedSize;
            }
            catch (err) {
                Catenis.logger.ERROR('Error while estimating the size of the metadata for issuing the non-fungible asset', err);
                throw new Error(`Error while estimating the size of the metadata for issuing the non-fungible asset: ${err}`);
            }
        }

        return this._estimatedMetadataSize;
    }

    /**
     * Check if all data for non-fungible asset issuance has already been passed
     */
    get isComplete() {
        return this.lastNFTokenIssuingBatch && this.lastNFTokenIssuingBatch.isFinal;
    }

    /**
     * Get the last non-fungible token issuing batch currently associated with this asset issuance
     * @return {(NFTokenIssuingBatch|undefined)}
     */
    get lastNFTokenIssuingBatch() {
        return this.nfTokenIssuingBatches.length > 0 ? this.nfTokenIssuingBatches[this.nfTokenIssuingBatches.length - 1] : undefined;
    }

    /**
     * Get the number of devices that will receive the issued non-fungible tokens
     * @returns {number}
     */
    get numberOfHoldingDevices() {
        return this.holdingDeviceIds.length;
    }

    /**
     * Get the number of non-fungible tokens to issue for the asset
     * @return {number}
     */
    get numberOfNFTokens() {
        return this.nonFungibleToken.quantity;
    }

    /**
     * Indicates whether the non-fungible token contents should be encrypted
     * @return {boolean}
     */
    get encryptNFTokenContents() {
        return this.nonFungibleToken.encryptContents;
    }

    /**
     * Retrieve the order for the next batch
     *
     * NOTE: this method should be called from code executed from the NFAssetIssuance.dbCS critical section object.
     */
    get nextBatchOrder() {
        return this.lastNFTokenIssuingBatch ? this.lastNFTokenIssuingBatch.order + 1 : 1;
    }

    /**
     * Indicates whether this non-fungible asset issuance is already saved to the database
     * @return {boolean}
     */
    get isSavedToDB() {
        return !!this.doc_id;
    }

    /**
     * Retrieve the continuation token for this non-fungible asset issuance
     * @return {(string|undefined)}
     */
    get continuationToken() {
        return this.lastNFTokenIssuingBatch ? this.lastNFTokenIssuingBatch.nfTokenIssuingBatchId : undefined;
    }

    /**
     * Get a list of non-fungible token indices for those non-fungible tokens that have contents defined
     * @return {number[]} List of non-fungible token indices
     */
    get nfTokensWithContents() {
        if (!this.isComplete) {
            throw new Error('Unable to get list of non-fungible tokens with contents: non-fungible asset issuance data not yet complete');
        }

        const nfTokenIndices = [];

        for (let idx = 0; idx < this.nonFungibleToken.quantity; idx++) {
            if (this.nfTokenHasContents(idx)) {
                nfTokenIndices.push(idx);
            }
        }

        return nfTokenIndices;
    }

    /**
     * Load the non-fungible issuing batches associated with this non-fungible asset issuance
     * @param {boolean} [preloadContents=false] Indicates whether the contents of the associated non-fungible tokens
     *                                           should be preloaded
     * @private
     */
    _loadNFTokenIssuingBatches(preloadContents = false) {
        this.nfTokenIssuingBatches = [];

        Catenis.db.collection.NonFungibleTokenIssuingBatch.find({
            nonFungibleAssetIssuance_id: this.doc_id
        }, {
            sort: {
                order: 1
            }
        })
        .fetch()
        .forEach(doc => {
            this.nfTokenIssuingBatches[doc.order - 1] = new NFTokenIssuingBatch(doc, preloadContents);
        });
    }

    /**
     * Save non-fungible asset issuance object to the database
     * @private
     */
    _saveToDB() {
        // Make sure that it has not yet been saved to the database
        if (!this.isSavedToDB) {
            const doc = {
                assetIssuanceId: this.assetIssuanceId = newNFAssetIssuanceId(),
                deviceId: this.deviceId,
            };

            if (!this.isReissuance) {
                doc.asset = this.asset;
            }
            else {
                doc.assetId = this.assetId;
            }

            doc.isReissuance = this.isReissuance;
            doc.holdingDeviceIds = this.holdingDeviceIds;
            doc.asyncProc = this.asyncProc;
            doc.nonFungibleToken = this.nonFungibleToken;
            doc.createdDate = this.createdDate = new Date();

            try {
                this.doc_id = Catenis.db.collection.NonFungibleAssetIssuance.insert(doc);
            }
            catch (err) {
                Catenis.logger.ERROR('Failure while inserting new NonFungibleAssetIssuance database doc/rec.', err);
                throw new Error(`Failure while inserting new NonFungibleAssetIssuance database doc/rec: ${err}`);
            }

            // Now, save to database the first (and only) non-fungible token issuing batch associated
            //  with this non-fungible asset issuance
            this.nfTokenIssuingBatches[0].saveToDB();
        }
    }

    /**
     * Save the current non-fungible asset issuance progress to the database
     * @param {boolean} [includeResultingIds=false] Indicates whether the resulting (asset/token) IDs should also be saved
     * @private
     */
    _saveProgressToDB(includeResultingIds = false) {
        if (!this.isSavedToDB) {
            Catenis.logger.ERROR('Unable to save non-fungible asset issuance progress to database: non-fungible asset issuance not yet saved to database', {
                nfAssetIssuance: this
            });
            throw new Error('Unable to save non-fungible asset issuance progress to database: non-fungible asset issuance not yet saved to database');
        }

        const fieldsToSet = {
            progress: this.progress
        };

        if (includeResultingIds) {
            fieldsToSet.assetId = this.assetId;
            fieldsToSet.tokenIds = this.tokenIds;
        }

        try {
            Catenis.db.collection.NonFungibleAssetIssuance.update({
                _id: this.doc_id
            }, {
                $set: fieldsToSet
            });
        }
        catch (err) {
            Catenis.logger.ERROR('Error updating non-fungible asset issuance database doc/rec (doc_id: %s) to record issuance progress.', this.doc_id, err);
            throw new Error(`Error updating non-fungible asset issuance database doc/rec (doc_id: ${this.doc_id}) to record issuance progress: ${err}`);
        }
    }

    /**
     * Conform an error that might happen during the processing of non-fungible asset issuance to
     *  be presented to the end user
     * @param {Error} err The error to be conformed
     * @return {{code: number, message: string}} The resulting conformed error
     * @private
     */
    _conformProcessingError(err) {
        let error = {};

        if (err instanceof Meteor.Error) {
            if (err.error === 'ctn_device_low_service_acc_balance') {
                error.code = 400;
                error.message = 'Not enough credits to pay for issue non-fungible asset service';
            }
            else if (err.error === 'ctn_issue_nf_asset_amount_too_large') {
                error.code = 400;
                error.message = 'Number of non-fungible tokens to issue is too large';
            }
            else if (err.error === 'nf_asset_issue_no_token_info') {
                error.code = 400;
                error.message = 'Non-fungible asset issuance cannot be finalized with no tokens';
            }
            else if (err.error === 'nf_asset_issue_already_complete' || err.error === 'nft_issue_batch_issuance_already_complete') {
                error.code = 400;
                error.message = 'Non-fungible asset issuance is already complete';
            }
            else if (err.error === 'nf_asset_issue_invalid_cont_token' || err.error === 'nf_asset_issue_wrong_device') {
                error.code = 400;
                error.message = 'Invalid or unexpected asset issuance continuation token';
            }
            else if (err.error === 'nft_issue_batch_wrong_num_tokens') {
                error.code = 400;
                error.message = 'Inconsistent number of non-fungible tokens';
            }
            else if (err.error === 'nft_issue_batch_no_token_info') {
                error.code = 400;
                error.message = 'Missing non-fungible token data';
            }
            else if (err.error === 'nft_issue_part_missing_metadata') {
                error.code = 400;
                error.message = 'Missing non-fungible token metadata';
            }
            else if (err.error === 'nft_issue_part_missing_contents') {
                error.code = 400;
                error.message = 'Missing non-fungible token contents';
            }
            else if (err.error === 'nft_issue_part_contents_already_finalized') {
                error.code = 400;
                error.message = 'Non-fungible token contents is already finalized';
            }
            else {
                error.code = 500;
                error.message = 'Internal server error';
            }
        }
        else {
            error.code = 500;
            error.message = 'Internal server error';
        }

        if (error.code === 500) {
            // Log error
            Catenis.logger.ERROR('Error processing non-fungible asset issuance (assetIssuanceId: %s).', this.assetIssuanceId, err);
        }

        return error;
    }

    /**
     * Get the metadata for all the non-fungible tokens of this asset issuance for size estimate only.
     *  Note: the metadata structure returned by this method makes use of dummy contents CIDs as well
     *      as dummy encryption keys
     * @returns {NFTokenMetadataStoredContents[]}
     * @private
     */
    _getNFTokensMetadataForSizeEstimate() {
        if (!this.isComplete) {
            throw new Error('Unable to get non-fungible tokens\' metadata for size estimate: non-fungible asset issuance data not yet complete');
        }

        const nfTokensMetadata = [];
        const firstNFTokenIssuingBatch = this.nfTokenIssuingBatches[0];

        for (let nfTokenIdx = 0, length = this.nonFungibleToken.quantity; nfTokenIdx < length; nfTokenIdx++) {
            const metadata = firstNFTokenIssuingBatch.getNFTokenIssuingPart(nfTokenIdx).metadata;

            if (!metadata) {
                Catenis.logger.ERROR('No metadata defined for non-fungible token (idx: %d) of non-fungible asset issuance (assetIssuanceId: %s)', nfTokenIdx, this.assetIssuanceId);
                throw new Error(`No metadata defined for non-fungible token (idx: ${nfTokenIdx}) of non-fungible asset issuance (assetIssuanceId: ${this.assetIssuanceId})`);
            }

            nfTokensMetadata.push({
                ...metadata,
                contents: NFTokenContentsUrl.dummyUrl,
                contentsEncrypted: this.nonFungibleToken.encryptContents
            });
        }

        return nfTokensMetadata;
    }

    /**
     * Add a new non-fungible token issuing batch to this asset issuance
     * @param {NonFungibleTokenInfoEntry[]} [nfTokenInfos] List of information about the non-fungible tokens to issue
     * @param {boolean} [isFinal=true] Indicates whether the information about the non-fungible tokens to issue is
     */
    newNFTokenIssuingBatch(nfTokenInfos, isFinal = true) {
        if (!nfTokenInfos) {
            // No non-fungible token info. Should be signaling finalization of asset issuance
            if (!isFinal) {
                Catenis.logger.ERROR('Unable to add new non-fungible token issuing batch: missing non-fungible token info');
                throw new Error('Unable to add new non-fungible token issuing batch: missing non-fungible token info');
            }

            // Trying to finalize non-fungible asset issuance
            if (!this.lastNFTokenIssuingBatch) {
                // Note: this should never happen (unless database is corrupted)
                throw new Meteor.Error('nf_asset_issue_no_token_info', 'Unable to finalize non-fungible asset issuance: issuance with no token');
            }

            if (this.isComplete) {
                throw new Meteor.Error('nf_asset_issue_already_complete', 'Unable to finalize non-fungible asset issuance: issuance data already complete');
            }

            // Finalize asset issuance
            this.lastNFTokenIssuingBatch.setFinal();
        }
        else {
            this.nfTokenIssuingBatches.push(new NFTokenIssuingBatch(undefined, undefined, this, nfTokenInfos, isFinal));

            this.lastNFTokenIssuingBatch.saveToDB();
        }
    }

    /**
     * For a given non-fungible token of this asset issuance checks if there are contents defined for it
     * @param {number} nfTokenIdx The index of the non-fungible token of this asset issuance
     * @return {boolean}
     */
    nfTokenHasContents(nfTokenIdx) {
        // Validate argument
        if (!Number.isInteger(nfTokenIdx) || nfTokenIdx < 0 || nfTokenIdx > this.nonFungibleToken.quantity - 1) {
            Catenis.logger.ERROR('NFAssetIssuance.nfTokenHasContents() method called with invalid argument:', {
                nfTokenIdx
            });
            throw new TypeError('Invalid nfTokenIdx argument');
        }

        let result = false;

        if (this.nfTokenIssuingBatches.length > 0) {
            const nfTokenIssuingPart = this.nfTokenIssuingBatches[0].getNFTokenIssuingPart(nfTokenIdx);

            if (nfTokenIssuingPart) {
                result = nfTokenIssuingPart.hasContents;
            }
        }

        return result;
    }

    /**
     * For a given non-fungible token of this asset issuance get a list of non-fungible token issuing
     *  parts containing the non-fungible token's contents
     * @param {number} nfTokenIdx The index of the non-fungible token of this asset issuance
     * @return {NFTokenIssuingPart[]} The returned list of non-fungible token issuing parts. Note that
     *                                 it will be an empty list if there are no contents defined for
     *                                 that non-fungible token
     */
    getNFTokenContentsParts(nfTokenIdx) {
        // Validate argument
        if (!Number.isInteger(nfTokenIdx) || nfTokenIdx < 0 || nfTokenIdx > this.nonFungibleToken.quantity - 1) {
            Catenis.logger.ERROR('NFAssetIssuance.getNFTokenContentsParts() method called with invalid argument:', {
                nfTokenIdx
            });
            throw new TypeError('Invalid nfTokenIdx argument');
        }

        if (!this.isComplete) {
            throw new Error('Unable to get non-fungible token\'s issuing parts: non-fungible asset issuance data not yet complete');
        }

        const nfTokenIssuingParts = [];

        for (const nfTokenIssuingBatch of this.nfTokenIssuingBatches) {
            const nfTokenIssuingPart = nfTokenIssuingBatch.getNFTokenIssuingPart(nfTokenIdx);

            if (!nfTokenIssuingPart || !nfTokenIssuingPart.hasContents) {
                break;
            }

            nfTokenIssuingParts.push(nfTokenIssuingPart);
        }

        return nfTokenIssuingParts;
    }

    /**
     * A dictionary with the IPFS CIDs of the stored contents of the non-fungible tokens
     *  of this asset issuance indexed by the non-fungible token index
     * @typedef {Object.<string, string>} NFTokenContentsCIDs
     */

    /**
     * @typedef {Object} NFTokenMetadataStoredContents
     * @property {string} name The non-fungible token name
     * @property {string} [description] A short description about the non-fungible token
     * @property {Object} [custom] An optional dictionary object containing name/value pairs to be used as custom
     *                              metadata for the non-fungible token
     * @property {NFTokenContentsUrl} contents URL to the non-fungible token's contents stored on IPFS
     * @property {boolean} contentsEncrypted Indicates whether the stored contents is encrypted
     */

    /**
     * Get the metadata for all the non-fungible tokens of this asset issuance
     * @param {NFTokenContentsCIDs} contentsCIDs Dictionary of non-fungible tokens' contents IPFS CIDs. NOTE: the keys
     *                                            of this dictionary must be a superset of the indices of non-fungible
     *                                            tokens with contents defined for this asset issuance when contents
     *                                            are encrypted (since even when contents are shared, after encryption,
     *                                            the data that gets stored might be different)
     * @return {NFTokenMetadataStoredContents[]}
     */
    getNFTokensMetadata(contentsCIDs) {
        // Validate argument
        if (!Util.isNonNullObject(contentsCIDs)) {
            Catenis.logger.ERROR('NFAssetIssuance.getNFTokensMetadata() method called with invalid argument:', {
                contentsCIDs
            });
            throw new TypeError('Invalid contentsCIDs argument');
        }

        if (!this.isComplete) {
            throw new Error('Unable to get non-fungible tokens\' metadata: non-fungible asset issuance data not yet complete');
        }

        // Make sure that passed contents' CIDs are consistent
        const contentsNFTokenIndices = this.nfTokensWithContents;
        const nfTokenIndices = Object.keys(contentsCIDs).map(key => parseInt(key));

        if (nfTokenIndices.some(idx => !Number.isInteger(idx) || idx < 0 || idx > this.nonFungibleToken.quantity - 1)
                || contentsNFTokenIndices.some(idx => !nfTokenIndices.includes(idx))
                || (!this.nonFungibleToken.encryptContents && nfTokenIndices.length > contentsNFTokenIndices.length)) {
            Catenis.logger.ERROR('Stored non-fungible tokens\' contents CIDs are inconsistent', {
                contentsCIDs
            });
            throw new Error('Stored non-fungible tokens\' contents CIDs are inconsistent');
        }

        const nfTokensMetadata = [];
        const firstNFTokenIssuingBatch = this.nfTokenIssuingBatches[0];
        let firstNFTokenContents;

        for (let nfTokenIdx = 0, length = this.nonFungibleToken.quantity; nfTokenIdx < length; nfTokenIdx++) {
            const metadata = firstNFTokenIssuingBatch.getNFTokenIssuingPart(nfTokenIdx).metadata;

            if (!metadata) {
                Catenis.logger.ERROR('No metadata defined for non-fungible token (idx: %d) of non-fungible asset issuance (assetIssuanceId: %s)', nfTokenIdx, this.assetIssuanceId);
                throw new Error(`No metadata defined for non-fungible token (idx: ${nfTokenIdx}) of non-fungible asset issuance (assetIssuanceId: ${this.assetIssuanceId})`);
            }

            let contentsCID = contentsCIDs[nfTokenIdx];
            let contents;

            if (nfTokenIdx === 0) {
                // First non-fungible token. Make sure that its contents is defined
                if (!contentsCID) {
                    Catenis.logger.ERROR('No contents defined for first non-fungible token of non-fungible asset issuance (assetIssuanceId: %s)'. this.assetIssuanceId);
                    throw new Error(`No contents defined for first non-fungible token of non-fungible asset issuance (assetIssuanceId: ${this.assetIssuanceId})`);
                }

                firstNFTokenContents = contents = new NFTokenContentsUrl(contentsCID);
            }
            else {
                // if no contents defined for this non-fungible token, so assume that it shares
                //  the contents with the first non-fungible token
                // noinspection JSUnusedAssignment
                contents = !contentsCID
                    ? firstNFTokenContents
                    : new NFTokenContentsUrl(contentsCID);
            }

            nfTokensMetadata.push({
                ...metadata,
                contents,
                contentsEncrypted: this.nonFungibleToken.encryptContents
            });
        }

        return nfTokensMetadata;
    }

    /**
     * Update the asset issuance progress
     * @param {number} bytesStored Number of additional bytes of data that have been stored
     * @param {boolean} [isContentsData=false] Identifies the type of data that has been stored. If true, it refers
     *                                          to the contents of the non-fungible tokens being issued. Otherwise, it
     *                                          refers to the metadata for issuing the asset
     */
    updateIssuanceProgress(bytesStored, isContentsData = false) {
        // Validate argument
        if (!Number.isInteger(bytesStored) || bytesStored < 0) {
            Catenis.logger.ERROR('NFAssetIssuance.updateIssuanceProgress() method called with invalid argument:', {
                bytesStored
            });
            throw new TypeError('Invalid bytesStored argument');
        }

        if (!this.isComplete) {
            throw new Error('Unable to update issuance progress: non-fungible asset issuance data not yet complete');
        }

        if (!this.progress) {
            this.progress = {
                totalContentsBytes: this._totalNFTokensContentsBytes,
                contentsBytesStored: isContentsData ? bytesStored : 0,
                totalMetadataBytes: this._estimatedAssetMetadataSize,
                metadataBytesStored: !isContentsData ? bytesStored : 0,
                done: false
            };
        }
        else {
            // Make sure that issuance progress has not yet finalized
            if (this.progress.done) {
                Catenis.logger.ERROR('Trying to update non-fungible asset issuance progress that has already been finalized', {
                    nfAssetIssuance: this
                });
                throw new Error('Trying to update non-fungible asset issuance progress that has already been finalized');
            }

            if (isContentsData) {
                this.progress.contentsBytesStored += bytesStored;
            }
            else {
                this.progress.metadataBytesStored += bytesStored;
            }
        }

        // Now, save updated progress to the database
        this._saveProgressToDB();
    }

    /**
     * Finalize the asset issuance
     * @param {Error} [error] Error that took place during processing
     * @param {string[]} [tokenIds] The resulting IDs of the issued non-fungible tokens
     * @param {string} [assetId] The resulting ID of the issued non-fungible asset
     */
    finalizeIssuanceProgress(error, tokenIds, assetId) {
        // Validate arguments
        const errArg = {};

        if (tokenIds !== undefined && !Array.isArray(tokenIds)) {
            errArg.tokenIds = tokenIds;
        }

        if (assetId !== undefined && typeof assetId !== 'string') {
            errArg.assetId = assetId;
        }

        if (Object.keys(errArg).length > 0) {
            const errArgs = Object.keys(errArg);

            Catenis.logger.ERROR(`NFAssetIssuance.finalizeIssuanceProgress() method called with invalid argument${errArgs.length > 1 ? 's' : ''}`, errArg);
            throw new TypeError(`Invalid ${errArgs.join(', ')} argument${errArgs.length > 1 ? 's' : ''}`);
        }

        if (!this.isComplete) {
            throw new Error('Unable to finalize issuance progress: non-fungible asset issuance data not yet complete');
        }

        // Validate data consistency
        if (!error) {
            let errMsg = '';

            if (!tokenIds || tokenIds.length !== this.nonFungibleToken.quantity) {
                errMsg = 'missing or inconsistent number of non-fungible token IDs';
            }

            if (!this.assetId && !assetId) {
                if (errMsg.length > 0) {
                    errMsg += '; ';
                }

                errMsg += 'missing non-fungible asset Id';
            }

            if (errMsg.length > 0) {
                throw new Error(`Unable to finalize issuance progress: ${errMsg}`);
            }
        }

        if (!this.progress) {
            this.progress = {
                totalContentsBytes: this._totalNFTokensContentsBytes,
                contentsBytesStored: 0,
                totalMetadataBytes: this._estimatedAssetMetadataSize,
                metadataBytesStored: 0,
                done: true
            };
        }
        else {
            if (this.progress.done) {
                // Asset issuance already finalized. Nothing to do
                Catenis.logger.WARN('Trying to finalize non-fungible asset issuance progress that is already finalized', {
                    nfAssetIssuance: this,
                    finalization: {
                        error,
                        tokenIds,
                        assetId
                    }
                });
                return;
            }

            this.progress.done = true;
        }

        if (error) {
            this.progress.success = false;
            this.progress.error = this._conformProcessingError(error);
        }
        else {
            this.progress.success = true;

            if (assetId) {
                this.assetId = assetId;
            }

            this.tokenIds = tokenIds;
        }

        this.progress.finishDate = new Date();

        // Now, save updated progress to the database
        this._saveProgressToDB(!error);
    }

    /**
     * @typedef {Object} NonFungibleAssetIssuanceProgressInfo
     * @property {string} [assetId] The ID of the non-fungible asset for which more non-fungible tokens are being issued.
     *                               Only included in case of reissuance
     * @property {NonFungibleAssetIssuanceProgress} progress The progress of the asset issuance
     * @property {NonFungibleAssetIssuanceResult} [result] The result of the asset issuance
     */

    /**
     * Retrieve the current non-fungible asset issuance progress
     * @return {NonFungibleAssetIssuanceProgressInfo}
     */
    getIssuanceProgress() {
        if (!this.isComplete) {
            throw new Meteor.Error('nf_asset_issue_not_complete', 'Unable to retrieve issuance progress: non-fungible asset issuance data not yet complete');
        }

        if (!this.progress) {
            this.progress = {
                totalContentsBytes: this._totalNFTokensContentsBytes,
                contentsBytesStored: 0,
                totalMetadataBytes: this._estimatedAssetMetadataSize,
                metadataBytesStored: 0,
                done: false
            };
        }

        const progress = {
            percentProcessed: this.progress.done && this.progress.success ?
                100
                : Math.floor(((this.progress.contentsBytesStored + this.progress.metadataBytesStored)
                        / (this.progress.totalContentsBytes + this.progress.totalMetadataBytes))
                    * cfgSettings.percentSaveNFTokensMetadata),
            done: this.progress.done
        };
        let result;

        if (this.progress.done) {
            progress.success = this.progress.success;

            if (this.progress.success) {
                result = {};

                if (!this.isReissuance) {
                    result.assetId = this.assetId;
                }

                result.nfTokenIds = this.tokenIds;
            }
            else {
                progress.error = this.progress.error;
            }

            progress.finishDate = this.progress.finishDate;
        }

        const retVal = {};

        if (this.isReissuance) {
            retVal.assetId = this.assetId;
        }

        retVal.progress = progress;

        if (result) {
            retVal.result = result;
        }

        return retVal;
    }

    /**
     * Initialize module
     */
    static initialize() {
        Catenis.logger.TRACE('NFAssetIssuance initialization');
        // Execute process to purge old non-fungible asset issuances
        purgeOldNFAssetIssuances();
        Catenis.logger.TRACE('Setting recurring timer to purge old non-fungible asset issuances');
        this.intervalHandle.purgeOldIssuances = Meteor.setInterval(purgeOldNFAssetIssuances, cfgSettings.purgeOldIssuancesInterval);
    }

    /**
     * Retrieve the non-fungible asset issuance object with the given ID
     * @param {string} assetIssuanceId The external ID the non-fungible asset issuance
     * @param {string} [deviceId] Device ID of device trying to access the non-fungible asset issuance
     * @param {boolean} [preloadNFTContents=false] Indicates whether non-fungible tokens' contents should be preloaded
     * @return {NFAssetIssuance}
     */
    static getNFAssetIssuanceByAssetIssuanceId(assetIssuanceId, deviceId, preloadNFTContents = false) {
        const docNFAssetIssuance = Catenis.db.collection.NonFungibleAssetIssuance.findOne({
            assetIssuanceId
        });

        if (!docNFAssetIssuance) {
            // Invalid asset issuance ID
            throw new Meteor.Error('nf_asset_issue_invalid_id', 'Unable to find non-fungible asset issuance with the given asset issuance ID');
        }

        // Instantiate non-fungible asset issuance object
        const nfAssetIssuance = new NFAssetIssuance(docNFAssetIssuance, preloadNFTContents);

        if (deviceId) {
            // Make sure that the device requesting the non-fungible asset issuance is the one who owns it
            if (deviceId !== nfAssetIssuance.deviceId) {
                throw new Meteor.Error('nf_asset_issue_wrong_device', 'Non-fungible asset issuance belongs to a different device');
            }
        }

        return nfAssetIssuance;
    }

    /**
     * Retrieve the non-fungible asset issuance object for the given continuation token
     * @param {string} continuationToken The external ID of the last non-fungible token issuing batch of the asset
     *                                    issuance (presented to the end user as a continuation token)
     * @param {string} [deviceId] Device ID of device trying to access the non-fungible asset issuance
     * @param {string} [assetId] Asset ID of the non-fungible asset being reissued
     * @param {boolean} [preloadNFTContents=false] Indicates whether non-fungible tokens' contents should be preloaded
     * @return {NFAssetIssuance}
     */
    static getNFAssetIssuanceByContinuationToken(continuationToken, deviceId, assetId, preloadNFTContents = false) {
        // Get corresponding non-fungible token issuing batch doc/rec
        const docNFTokenIssuingBatch = Catenis.db.collection.NonFungibleTokenIssuingBatch.findOne({
            nfTokenIssuingBatchId: continuationToken
        }, {
            fields: {
                nonFungibleAssetIssuance_id: 1
            }
        });

        if (!docNFTokenIssuingBatch) {
            // Invalid continuation token
            throw new Meteor.Error('nf_asset_issue_invalid_cont_token', 'Unable to find non-fungible asset issuance for the given continuation token');
        }

        const docNFAssetIssuance = Catenis.db.collection.NonFungibleAssetIssuance.findOne({
            _id: docNFTokenIssuingBatch.nonFungibleAssetIssuance_id
        });

        // Instantiate non-fungible asset issuance object
        const nfAssetIssuance = new NFAssetIssuance(docNFAssetIssuance, preloadNFTContents);

        // Make sure that the non-fungible asset issuance's continuation token matches that one provided
        if (nfAssetIssuance.continuationToken !== continuationToken) {
            throw new Meteor.Error('nf_asset_issue_invalid_cont_token', 'Continuation token does not match the non-fungible asset issuance\'s continuation token');
        }

        // Make sure that the non-fungible asset issuance is for the expected operation (issuance or reissuance)
        if (nfAssetIssuance.isReissuance !== !!assetId) {
            throw new Meteor.Error('nf_asset_issue_wrong_operation', 'Non-fungible asset issuance is not for the expected operation');
        }

        // Make sure that the non-fungible asset reissuance is for the correct asset
        if (nfAssetIssuance.isReissuance && nfAssetIssuance.assetId !== assetId) {
            throw new Meteor.Error('nf_asset_issue_wrong_asset', 'Non-fungible asset reissuance is for a different asset');
        }

        if (deviceId) {
            // Make sure that the device requesting the non-fungible asset issuance is the one who owns it
            if (deviceId !== nfAssetIssuance.deviceId) {
                throw new Meteor.Error('nf_asset_issue_wrong_device', 'Non-fungible asset issuance belongs to a different device');
            }
        }

        return nfAssetIssuance;
    }
}


// Definition of module (private) functions
//

/**
 * Generate a new non-fungible asset issuance ID
 * @param {boolean} checkExistence Indicates whether to check if newly generated ID already exists
 * @return {string} The newly generated ID
 */
function newNFAssetIssuanceId(checkExistence = true) {
    let id = 'i' + Random.id(19);

    if (checkExistence) {
        while (Catenis.db.collection.NonFungibleAssetIssuance.findOne({assetIssuanceId: id}, {fields: {_id: 1}})) {
            Catenis.logger.DEBUG('Newly generated Non-Fungible Asset Issuance ID (%s) already exists. Trying again.', id);

            id = 'i' + Random.id(19);
        }
    }

    return id;
}

/**
 * Purge old non-fungible asset issuance database docs/recs
 */
function purgeOldNFAssetIssuances() {
    Catenis.logger.TRACE('Executing process to purge old Non-Fungible Asset Issuance database docs/recs');
    /**
     * Identify non-fungible asset issuance database docs/recs that need to be removed
     * @param {moment.Moment} refMoment Reference data/time as a moment object
     * @return {Promise<any[]>}
     */
    async function getOldNFAssetIssuancesToRemove(refMoment) {
        const idDocsToRemove = new Set();

        // Identify incomplete non-fungible asset issuances that should be removed
        const earliestDateIncompleteIssuances = moment(refMoment).subtract(cfgSettings.timeKeepIncompleteIssuance, 'seconds').toDate();

        // noinspection JSUnresolvedFunction
        await Catenis.db.mongoCollection.NonFungibleTokenIssuingBatch.aggregate([{
            $sort: {
                nonFungibleAssetIssuance_id: 1,
                order: 1
            }
        }, {
            $group: {
                _id: '$nonFungibleAssetIssuance_id',
                latestIsFinal: {
                    $last: '$isFinal'
                },
                latestCreatedDate: {
                    $last: '$createdDate'
                }
            }
        }, {
            $match: {
                latestIsFinal: false,
                latestCreatedDate: {
                    $lt: earliestDateIncompleteIssuances
                }
            }
        }])
        .forEach(doc => idDocsToRemove.add(doc._id));

        // Include non-fungible asset issuances with no non-fungible token issuing batch
        // noinspection JSUnresolvedFunction
        await Catenis.db.mongoCollection.NonFungibleAssetIssuance.aggregate([{
            $match: {
                createdDate: {
                    $lt: earliestDateIncompleteIssuances
                }
            }
        }, {
            $lookup: {
                from: 'NonFungibleTokenIssuingBatch',
                let: {
                    nfAssetIssuance_id: '$_id'
                },
                pipeline: [{
                    $match: {
                        $expr: {
                            $eq: ['$nonFungibleAssetIssuance_id', '$$nfAssetIssuance_id']
                        }
                    }
                }, {
                    $project: {
                        _id: 1
                    }
                }],
                as: 'issuingBatches'
            }
        }, {
            $match: {
                issuingBatches: {
                    $size: 0
                }
            }
        }])
        .forEach(doc => idDocsToRemove.add(doc._id));

        // Identify processed non-fungible asset issuances that should be removed
        const earliestDateProcessedIssuances = moment(refMoment).subtract(cfgSettings.timeKeepProcessedIssuance, 'seconds').toDate();

        Catenis.db.collection.NonFungibleAssetIssuance.find({
            'progress.done': true,
            'progress.finishDate': {
                $lt: earliestDateProcessedIssuances
            }
        }, {
            fields: {
                _id: 1
            }
        })
        .forEach(doc => idDocsToRemove.add(doc._id));

        return Array.from(idDocsToRemove);
    }

    try {
        const refMoment = moment();

        // Execute code in critical section to avoid database concurrency
        NFAssetIssuance.dbCS.execute(() => {
            const idNFAssetIssuancesToRemove = Future.fromPromise(getOldNFAssetIssuancesToRemove(refMoment)).wait();

            if (idNFAssetIssuancesToRemove.length > 0) {
                // Identify non-fungible token issuing batches to remove
                const idNFTokenIssuingBatchesToRemove = Catenis.db.collection.NonFungibleTokenIssuingBatch.find({
                    nonFungibleAssetIssuance_id: {
                        $in: idNFAssetIssuancesToRemove
                    }
                }, {
                    fields: {
                        _id: 1
                    }
                })
                .map(doc => doc._id);

                // Remove all non-fungible token issuing parts associated with non-fungible token
                //  issuing batches to be removed
                const numNFTokenIssuingPartsRemoved = Catenis.db.collection.NonFungibleTokenIssuingPart.remove({
                    nonFungibleTokenIssuingBatch_id: {
                        $in: idNFTokenIssuingBatchesToRemove
                    }
                });
                Catenis.logger.DEBUG('Number of NonFungibleTokenIssuingPart docs/recs associated with old non-fungible asset issuances that have been removed: %d', numNFTokenIssuingPartsRemoved);

                // Remove all non-fungible token issuing batches associated with non-fungible asset issuances to be removed
                const numNFTokenIssuingBatchesRemoved = Catenis.db.collection.NonFungibleTokenIssuingBatch.remove({
                    _id: {
                        $in: idNFTokenIssuingBatchesToRemove
                    }
                });
                Catenis.logger.DEBUG('Number of NonFungibleTokenIssuingBatch docs/recs associated with old non-fungible asset issuances that have been removed: %d', numNFTokenIssuingBatchesRemoved);

                // Now remove the non-fungible asset issuances themselves
                const numNFAssetIssuancesRemoved = Catenis.db.collection.NonFungibleAssetIssuance.remove({
                    _id: {
                        $in: idNFAssetIssuancesToRemove
                    }
                });
                Catenis.logger.DEBUG('Number of old NonFungibleAssetIssuance doc/recs that have been removed: %d', numNFAssetIssuancesRemoved);
            }
        });
    }
    catch (err) {
        Catenis.logger.ERROR('Error while executing process to purge old Non-Fungible Asset Issuance database docs/recs.', err);
    }
}


// Module code
//

// Lock class
Object.freeze(NFAssetIssuance);
