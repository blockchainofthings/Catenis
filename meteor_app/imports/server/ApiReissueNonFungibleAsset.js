/**
 * Created by claudio on 2022-05-03
 */

//console.log('[ApiReissueNonFungibleAsset.js]: This code just ran.');

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
import {
    successResponse,
    errorResponse
} from './RestApi';
import {
    getDeviceId,
    isValidHoldingDeviceIdInfoList,
    isValidHoldingDeviceIdInfo,
    isValidNonFungibleTokenList,
    conformNonFungibleTokenList,
} from './ApiIssueNonFungibleAsset';
import { Util } from './Util';


// Definition of module (private) functions
//

/**
 * @typedef {Object} NFAssetReissuanceResult
 * @property {string} [continuationToken] The continuation token to be used in the next continuation request
 * @property {string} [assetIssuanceId] The asset issuance ID to be used for querying the progress of the non-fungible
 *                                       asset issuance. Only returned when doing the processing asynchronously
 * @property {string[]} [nfTokenIds] A list of the IDs of the newly issued non-fungible tokens for that non-fungible
 *                                    asset
 */

/**
 * @typedef {Object} ReissueNonFungibleAssetAPIResponse
 * @property {number} statusCode
 * @property {Object} headers
 * @property {Object} body
 * @property {string} body.status
 * @property {string} [body.message]
 * @property {NFAssetReissuanceResult} [body.data]
 */

/**
 * Method used to process POST 'assets/non-fungible/:assetId/issue' endpoint of REST API
 * @this {Object}
 * @property {Object} urlParams
 * @property {string} urlParams.assetId The external ID of the non-fungible asset to reissue
 * @property {Object} bodyParams
 * @property {boolean} [bodyParams.encryptNFTContents=true] Indicates whether the contents of the asset’s non-fungible
 *                                                           tokens should be encrypted before being stored (on IPFS)
 * @property {HoldingDeviceIdInfo[]} [bodyParams.holdingDevices] List of Catenis virtual devices that will hold the
 *                                                                issued non-fungible tokens
 * @property {boolean} [bodyParams.async=false] Indicates whether processing should be done asynchronously
 * @property {string} [bodyParams.continuationToken] The continuation token returned by the previous request indicating
 *                                                    that this is a continuation request for the same issuance
 * @property {NonFungibleTokenApiInfoEntry[]} [bodyParams.nonFungibleTokens] List of non-fungible tokens to be issued
 * @property {boolean} [bodyParams.isFinal=true] Indicates whether this is the final request for this issuance
 * @return {ReissueNonFungibleAssetAPIResponse}
 */
export function reissueNonFungibleAsset() {
    try {
        // Process request parameters
        let invalidParams = [];

        // From URL
        //
        // assetId param
        if (!Util.isNonBlankString(this.urlParams.assetId)) {
            Catenis.logger.DEBUG('Invalid \'assetId\' parameter for POST \'assets/non-fungible/:assetId/issue\' API request', this.urlParams);
            invalidParams.push('assetId');
        }

        // From payload
        //
        // continuationToken param
        let isContinuationReq = false;

        if (Util.isNonBlankString(this.bodyParams.continuationToken)) {
            isContinuationReq = true;
        }
        else if (this.bodyParams.continuationToken !== undefined) {
            Catenis.logger.DEBUG('Invalid \'continuationToken\' parameter for POST \'assets/non-fungible/:assetId/issue\' API request', this.bodyParams);
            invalidParams.push('continuationToken');
        }

        let encryptNFTContents = true;
        let holdingDeviceIds;
        let asyncProc = false;
        let isFinal = true;
        /**
         * @type {IssueNFAssetInitialData}
         */
        let initialData;
        /**
         * @type {IssueNFAssetContinuationData}
         */
        let continuationData;
        let errorInfo;

        if (!isContinuationReq) {
            // Initial issuance request

            // encryptNFTContents param
            if (typeof this.bodyParams.encryptNFTContents === 'boolean') {
                encryptNFTContents = this.bodyParams.encryptNFTContents;
            }
            else if (this.bodyParams.encryptNFTContents !== undefined) {
                Catenis.logger.DEBUG('Invalid \'encryptNFTContents\' parameter for POST \'assets/non-fungible/:assetId/issue\' API request', this.bodyParams);
                invalidParams.push('encryptNFTContents');
            }

            // holdingDevices param
            try {
                if (isValidHoldingDeviceIdInfo(this.bodyParams.holdingDevices)) {
                    holdingDeviceIds = getDeviceId(this.bodyParams.holdingDevices);
                }
                else if (isValidHoldingDeviceIdInfoList(this.bodyParams.holdingDevices)) {
                    // Get list of device IDs
                    const deviceIds = [];

                    this.bodyParams.holdingDevices.forEach(deviceIdInfo => {
                        deviceIds.push(getDeviceId(deviceIdInfo));
                    });

                    holdingDeviceIds = deviceIds;
                }
                else if (this.bodyParams.holdingDevices !== undefined) {
                    Catenis.logger.DEBUG('Invalid \'holdingDevices\' parameter for POST \'assets/non-fungible/:assetId/issue\' API request', this.bodyParams);
                    invalidParams.push('holdingDevices');
                }
            }
            catch (err) {
                errorInfo = {
                    thrownError: err
                };

                if ((err instanceof Meteor.Error) && err.error === 'ctn_device_not_found') {
                    errorInfo.errorToReturn = errorResponse.call(this, 400, 'Invalid holding device');
                }
                else {
                    errorInfo.errorToReturn = errorResponse.call(this, 500, 'Internal server error');
                }
            }

            // async param
            if (typeof this.bodyParams.async === 'boolean') {
                asyncProc = this.bodyParams.async;
            }
            else if (this.bodyParams.async !== undefined) {
                Catenis.logger.DEBUG('Invalid \'async\' parameter for POST \'assets/non-fungible/:assetId/issue\' API request', this.bodyParams);
                invalidParams.push('async');
            }

            // nonFungibleTokens param
            if (!isValidNonFungibleTokenList(this.bodyParams.nonFungibleTokens)) {
                Catenis.logger.DEBUG('Invalid \'nonFungibleTokens\' parameter for POST \'assets/non-fungible/:assetId/issue\' API request', this.bodyParams);
                invalidParams.push('nonFungibleTokens');
            }

            // isFinal param
            if (typeof this.bodyParams.isFinal === 'boolean') {
                isFinal = this.bodyParams.isFinal;
            }
            else if (this.bodyParams.isFinal !== undefined) {
                Catenis.logger.DEBUG('Invalid \'isFinal\' parameter for POST \'assets/non-fungible/:assetId/issue\' API request', this.bodyParams);
                invalidParams.push('isFinal');
            }

            if (invalidParams.length === 0 && !errorInfo) {
                try {
                    initialData = {
                        assetPropsOrId: this.urlParams.assetId,
                        encryptNFTContents,
                        holdingDeviceIds,
                        asyncProc,
                        nfTokenInfos: conformNonFungibleTokenList(this.bodyParams.nonFungibleTokens),
                        isFinal
                    };
                }
                catch (err) {
                    errorInfo = {
                        thrownError: err
                    };

                    if ((err instanceof Meteor.Error) && err.error === 'ctn_nft_contents_encode_error') {
                        errorInfo.errorToReturn = errorResponse.call(this, 400, 'Invalid non-fungible token contents');
                    }
                    else {
                        errorInfo.errorToReturn = errorResponse.call(this, 500, 'Internal server error');
                    }
                }
            }
        }
        else {
            // Continuation issuance request

            // encryptNFTContents param
            if (this.bodyParams.encryptNFTContents !== undefined) {
                Catenis.logger.DEBUG('Invalid \'encryptNFTContents\' parameter for POST \'assets/non-fungible/:assetId/issue\' API request', this.bodyParams);
                invalidParams.push('encryptNFTContents');
            }

            // holdingDevices param
            if (this.bodyParams.holdingDevices !== undefined) {
                Catenis.logger.DEBUG('Invalid \'holdingDevices\' parameter for POST \'assets/non-fungible/:assetId/issue\' API request', this.bodyParams);
                invalidParams.push('holdingDevices');
            }

            // async param
            if (this.bodyParams.async !== undefined) {
                Catenis.logger.DEBUG('Invalid \'async\' parameter for POST \'assets/non-fungible/:assetId/issue\' API request', this.bodyParams);
                invalidParams.push('async');
            }

            // isFinal param
            if (typeof this.bodyParams.isFinal === 'boolean') {
                isFinal = this.bodyParams.isFinal;
            }
            else if (this.bodyParams.isFinal !== undefined) {
                Catenis.logger.DEBUG('Invalid \'isFinal\' parameter for POST \'assets/non-fungible/:assetId/issue\' API request', this.bodyParams);
                invalidParams.push('isFinal');
            }

            // nonFungibleTokens param
            if ((this.bodyParams.nonFungibleTokens !== undefined || !isFinal)
                    && !isValidNonFungibleTokenList(this.bodyParams.nonFungibleTokens, true)) {
                Catenis.logger.DEBUG('Invalid \'nonFungibleTokens\' parameter for POST \'assets/non-fungible/:assetId/issue\' API request', this.bodyParams);
                invalidParams.push('nonFungibleTokens');
            }

            if (invalidParams.length === 0) {
                try {
                    continuationData = {
                        assetId: this.urlParams.assetId,
                        continuationToken: this.bodyParams.continuationToken,
                        nfTokenInfos: this.bodyParams.nonFungibleTokens !== undefined
                            ? conformNonFungibleTokenList(this.bodyParams.nonFungibleTokens) : undefined,
                        isFinal
                    };
                }
                catch (err) {
                    errorInfo = {
                        thrownError: err
                    };

                    if ((err instanceof Meteor.Error) && err.error === 'ctn_nft_contents_encode_error') {
                        errorInfo.errorToReturn = errorResponse.call(this, 400, 'Invalid non-fungible token contents');
                    }
                    else {
                        errorInfo.errorToReturn = errorResponse.call(this, 500, 'Internal server error');
                    }
                }
            }
        }

        if (invalidParams.length > 0) {
            return errorResponse.call(this, 400, `Invalid parameters: ${invalidParams.join(', ')}`);
        }

        // Make sure that system is running and accepting API calls
        if (!Catenis.application.isRunning()) {
            Catenis.logger.DEBUG(
                'System currently not available for fulfilling POST \'assets/non-fungible/:assetId/issue\' API request',
                {
                    applicationStatus: Catenis.application.status
                }
            );
            return errorResponse.call(this, 503, 'System currently not available; please try again at a later time');
        }

        if (errorInfo) {
            // Error already detected. Process it now
            if (errorInfo.errorToReturn.statusCode === 500) {
                Catenis.logger.ERROR('Error processing POST \'assets/non-fungible/:assetId/issue\' API request.', errorInfo.thrownError);
            }

            return errorInfo.errorToReturn;
        }

        // Execute method to issue non-fungible asset
        let result;

        try {
            result = initialData
                ? this.user.device.issueNonFungibleAsset(initialData)
                : this.user.device.issueNonFungibleAsset(undefined, continuationData);
        }
        catch (err) {
            let error;

            if (err instanceof Meteor.Error) {
                if (err.error === 'ctn_device_deleted') {
                    // This should never happen (deleted devices are not authenticated)
                    error = errorResponse.call(this, 400, 'Device is deleted');
                }
                else if (err.error === 'ctn_device_not_active') {
                    // This should never happen (inactive devices are not authenticated)
                    error = errorResponse.call(this, 400, 'Device is not active');
                }
                else if (err.error === 'ctn_asset_not_found') {
                    error = errorResponse.call(this, 400, 'Invalid asset ID');
                }
                else if (err.error === 'ctn_issue_nf_asset_fungible') {
                    error = errorResponse.call(this, 400, 'Not a non-fungible asset');
                }
                else if (err.error === 'ctn_issue_nf_asset_hold_dev_deleted' || err.error === 'ctn_issue_nf_asset_hold_dev_not_active'
                    || err.error === 'ctn_issue_nf_asset_hold_dev_not_found') {
                    error = errorResponse.call(this, 400, 'Invalid holding device');
                }
                else if (err.error === 'ctn_device_no_permission') {
                    error = errorResponse.call(this, 403, 'No permission to assign issued non-fungible tokens to holding device');
                }
                else if (err.error === 'ctn_device_low_service_acc_balance') {
                    error = errorResponse.call(this, 400, 'Not enough credits to pay for issue non-fungible asset service');
                }
                else if (err.error === 'ctn_issue_nf_asset_amount_too_large') {
                    error = errorResponse.call(this, 400, 'Number of non-fungible tokens to issue is too large');
                }
                else if (err.error === 'ctn_issue_nf_asset_reissue_locked') {
                    error = errorResponse.call(this, 400, 'Asset cannot be reissued');
                }
                else if (err.error === 'ctn_issue_nf_asset_invalid_issuer') {
                    error = errorResponse.call(this, 403, 'No permission to reissue asset');
                }
                else if (err.error === 'nf_asset_issue_no_token_info') {
                    // This should only happen if database is corrupted
                    error = errorResponse.call(this, 400, 'Non-fungible asset issuance cannot be finalized with no tokens');
                }
                else if (err.error === 'nf_asset_issue_already_complete' || err.error === 'nft_issue_batch_issuance_already_complete') {
                    error = errorResponse.call(this, 400, 'Non-fungible asset issuance is already complete');
                }
                else if (err.error === 'nf_asset_issue_invalid_cont_token' || err.error === 'nf_asset_issue_wrong_operation'
                        || err.error === 'nf_asset_issue_wrong_asset' || err.error === 'nf_asset_issue_wrong_device') {
                    error = errorResponse.call(this, 400, 'Invalid or unexpected asset issuance continuation token');
                }
                else if (err.error === 'nf_asset_issue_timeout') {
                    error = errorResponse.call(this, 400, 'Asset issuance timed out');
                }
                else if (err.error === 'nft_issue_batch_wrong_num_tokens') {
                    error = errorResponse.call(this, 400, 'Inconsistent number of non-fungible tokens');
                }
                else if (err.error === 'nft_issue_batch_no_token_info') {
                    error = errorResponse.call(this, 400, 'Missing non-fungible token data');
                }
                else if (err.error === 'nft_issue_part_missing_metadata') {
                    error = errorResponse.call(this, 400, 'Missing non-fungible token metadata');
                }
                else if (err.error === 'nft_issue_part_missing_contents') {
                    error = errorResponse.call(this, 400, 'Missing non-fungible token contents');
                }
                else if (err.error === 'nft_issue_part_contents_already_finalized') {
                    error = errorResponse.call(this, 400, 'Non-fungible token contents is already finalized');
                }
                else {
                    error = errorResponse.call(this, 500, 'Internal server error');
                }
            }
            else {
                error = errorResponse.call(this, 500, 'Internal server error');
            }

            if (error.statusCode === 500) {
                Catenis.logger.ERROR('Error processing POST \'assets/non-fungible/:assetId/issue\' API request.', err);
            }

            return error;
        }

        // Return success
        return successResponse.call(this, result);
    }
    catch (err) {
        Catenis.logger.ERROR('Error processing POST \'assets/non-fungible/:assetId/issue\' API request.', err);
        return errorResponse.call(this, 500, 'Internal server error');
    }
}
