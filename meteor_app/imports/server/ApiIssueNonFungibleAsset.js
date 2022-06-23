/**
 * Created by claudio on 2022-05-02
 */

//console.log('[ApiIssueNonFungibleAsset.js]: This code just ran.');

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
import { Util } from './Util';
import { Device } from './Device';


// Definition of module (private) functions
//

/**
 * @typedef {Object} NFAssetIssuanceResult
 * @property {string} [continuationToken] The continuation token to be used in the next continuation request
 * @property {string} [assetIssuanceId] The asset issuance ID to be used for querying the progress of the non-fungible
 *                                       asset issuance. Only returned when doing the processing asynchronously
 * @property {string} [assetId] The ID of the newly created non-fungible asset
 * @property {string[]} [nonFungibleTokenIds] A list of the IDs of the newly issued non-fungible tokens for the newly
 *                                             created non-fungible asset
 */

/**
 * @typedef {Object} IssueNonFungibleAssetAPIResponse
 * @property {number} statusCode
 * @property {Object} headers
 * @property {Object} body
 * @property {string} body.status
 * @property {string} [body.message]
 * @property {NFAssetIssuanceResult} [body.data]
 */

/**
 * @typedef {Object} HoldingDeviceIdInfo
 * @property {string} id
 * @property {boolean} [isProdUniqueId=false]
 */

/**
 * @typedef {Object} NonFungibleTokenContents
 * @property {string} data
 * @property {string} [encoding='base64']
 */

/**
 * @typedef {Object} NonFungibleTokenApiInfo
 * @property {NonFungibleTokenProps} [metadata]
 * @property {NonFungibleTokenContents} [contents]
 */

/**
 * Method used to process POST 'assets/non-fungible/issue' endpoint of REST API
 * @this {Object}
 * @property {Object} bodyParams
 * @property {string} [bodyParams.name] The name of the asset
 * @property {string} [bodyParams.description] A brief description of the asset
 * @property {boolean} [bodyParams.canReissue] Indicates whether more non-fungible tokens of that asset can be issued at a later time (an unlocked asset)
 * @property {boolean} [bodyParams.encryptNFTContents=true] Indicates whether the contents of the asset’s non-fungible tokens should be encrypted before being stored (on IPFS)
 * @property {HoldingDeviceIdInfo[]} [bodyParams.holdingDevices] List of Catenis virtual devices that will hold the issued non-fungible tokens
 * @property {boolean} [bodyParams.async=false] Indicates whether processing should be done asynchronously
 * @property {string} [bodyParams.continuationToken] The continuation token returned by the previous request indicating that this is a continuation request for the same issuance
 * @property {NonFungibleTokenApiInfo[]} [bodyParams.nonFungibleTokens] List of non-fungible tokens to be issued
 * @property {boolean} [bodyParams.isFinal=true] Indicates whether this is the final request for this issuance
 * @return {IssueNonFungibleAssetAPIResponse}
 */
export function issueNonFungibleAsset() {
    try {
        // Process request parameters
        let invalidParams = [];

        // From payload
        //
        // continuationToken param
        let isContinuationReq = false;

        if (this.bodyParams.continuationToken === undefined || !Util.isNonBlankString(this.bodyParams.continuationToken)) {
            Catenis.logger.DEBUG('Invalid \'continuationToken\' parameter for POST \'assets/non-fungible/issue\' API request', this.urlParams);
            invalidParams.push('continuationToken');
        }
        else {
            isContinuationReq = true;
        }

        let encryptNFTContents = true;
        let holdingDeviceIds;
        let asyncProc = false;
        let isFinal = true;
        let initialData;
        let continuationData;

        if (!isContinuationReq) {
            // Initial issuance request

            // name param
            if (!Util.isNonBlankString(this.bodyParams.name)) {
                Catenis.logger.DEBUG('Invalid \'name\' parameter for POST \'assets/non-fungible/issue\' API request', this.urlParams);
                invalidParams.push('name');
            }

            // description param
            if (this.bodyParams.description !== undefined && !Util.isNonBlankString(this.bodyParams.description)) {
                Catenis.logger.DEBUG('Invalid \'description\' parameter for POST \'assets/non-fungible/issue\' API request', this.urlParams);
                invalidParams.push('description');
            }

            // canReissue param
            if (typeof this.bodyParams.canReissue !== 'boolean') {
                Catenis.logger.DEBUG('Invalid \'canReissue\' parameter for POST \'assets/non-fungible/issue\' API request', this.urlParams);
                invalidParams.push('canReissue');
            }

            // encryptNFTContents param
            if (typeof this.bodyParams.encryptNFTContents === 'boolean') {
                encryptNFTContents = this.bodyParams.encryptNFTContents;
            }
            else if (this.bodyParams.encryptNFTContents !== undefined) {
                Catenis.logger.DEBUG('Invalid \'encryptNFTContents\' parameter for POST \'assets/non-fungible/issue\' API request', this.urlParams);
                invalidParams.push('encryptNFTContents');
            }

            // holdingDevices param
            if (isValidHoldingDeviceIdInfoList(this.bodyParams.holdingDevices)) {
                // Get list of device IDs
                const deviceIds = [];

                this.bodyParams.holdingDevices.forEach(deviceIdInfo => {
                    let deviceId = deviceIdInfo.deviceId;

                    if (deviceIdInfo.isProdUniqueId) {
                        try {
                            deviceId = Device.getDeviceByProductUniqueId(deviceId, false).deviceId;
                        }
                        catch (err) {
                            let error;

                            if ((err instanceof Meteor.Error) && err.error === 'ctn_device_not_found') {
                                error = errorResponse.call(this, 400, 'Invalid holding device');
                            }
                            else {
                                error = errorResponse.call(this, 500, 'Internal server error');
                                Catenis.logger.ERROR('Error processing POST \'assets/non-fungible/issue\' API request.', err);
                            }

                            return error;
                        }
                    }

                    deviceIds.push(deviceId);
                });

                if (deviceIds.length > 0) {
                    holdingDeviceIds = deviceIds;
                }
            }
            else if (this.bodyParams.holdingDevices !== undefined) {
                Catenis.logger.DEBUG('Invalid \'holdingDevices\' parameter for POST \'assets/non-fungible/issue\' API request', this.urlParams);
                invalidParams.push('holdingDevices');
            }

            // async param
            if (typeof this.bodyParams.async === 'boolean') {
                asyncProc = this.bodyParams.async;
            }
            else if (typeof this.bodyParams.async !== 'boolean') {
                Catenis.logger.DEBUG('Invalid \'async\' parameter for POST \'assets/non-fungible/issue\' API request', this.urlParams);
                invalidParams.push('async');
            }

            // nonFungibleTokens param
            if (!isValidNonFungibleTokenList(this.bodyParams.nonFungibleTokens)) {
                Catenis.logger.DEBUG('Invalid \'nonFungibleTokens\' parameter for POST \'assets/non-fungible/issue\' API request', this.urlParams);
                invalidParams.push('nonFungibleTokens');
            }

            // isFinal param
            if (typeof this.bodyParams.isFinal === 'boolean') {
                isFinal = this.bodyParams.isFinal;
            }
            else if (this.bodyParams.isFinal !== undefined) {
                Catenis.logger.DEBUG('Invalid \'isFinal\' parameter for POST \'assets/non-fungible/issue\' API request', this.urlParams);
                invalidParams.push('isFinal');
            }

            initialData = {
                assetPropsOrId: {
                    name: this.bodyParams.name,
                    description: this.bodyParams.description,
                    canReissue: this.bodyParams.canReissue,
                },
                encryptNFTContents,
                holdingDeviceIds,
                asyncProc,
                nfTokenInfos: this.bodyParams.nonFungibleTokens,
                isFinal
            };
        }
        else {
            // Continuation issuance request

            // name param
            if (this.urlParams.name !== undefined) {
                Catenis.logger.DEBUG('Invalid \'name\' parameter for POST \'assets/non-fungible/issue\' API request', this.urlParams);
                invalidParams.push('name');
            }

            // description param
            if (this.urlParams.description !== undefined) {
                Catenis.logger.DEBUG('Invalid \'description\' parameter for POST \'assets/non-fungible/issue\' API request', this.urlParams);
                invalidParams.push('description');
            }

            // canReissue param
            if (this.urlParams.canReissue !== undefined) {
                Catenis.logger.DEBUG('Invalid \'canReissue\' parameter for POST \'assets/non-fungible/issue\' API request', this.urlParams);
                invalidParams.push('canReissue');
            }

            // encryptNFTContents param
            if (this.urlParams.encryptNFTContents !== undefined) {
                Catenis.logger.DEBUG('Invalid \'encryptNFTContents\' parameter for POST \'assets/non-fungible/issue\' API request', this.urlParams);
                invalidParams.push('encryptNFTContents');
            }

            // holdingDevices param
            if (this.urlParams.holdingDevices !== undefined) {
                Catenis.logger.DEBUG('Invalid \'holdingDevices\' parameter for POST \'assets/non-fungible/issue\' API request', this.urlParams);
                invalidParams.push('holdingDevices');
            }

            // async param
            if (this.urlParams.async !== undefined) {
                Catenis.logger.DEBUG('Invalid \'async\' parameter for POST \'assets/non-fungible/issue\' API request', this.urlParams);
                invalidParams.push('async');
            }

            // isFinal param
            if (typeof this.bodyParams.isFinal === 'boolean') {
                isFinal = this.bodyParams.isFinal;
            }
            else if (this.bodyParams.isFinal !== undefined) {
                Catenis.logger.DEBUG('Invalid \'isFinal\' parameter for POST \'assets/non-fungible/issue\' API request', this.urlParams);
                invalidParams.push('isFinal');
            }

            // nonFungibleTokens param
            if ((this.bodyParams.nonFungibleTokens !== undefined || !isFinal) && !isValidNonFungibleTokenList(this.bodyParams.nonFungibleTokens)) {
                Catenis.logger.DEBUG('Invalid \'nonFungibleTokens\' parameter for POST \'assets/non-fungible/issue\' API request', this.urlParams);
                invalidParams.push('nonFungibleTokens');
            }

            continuationData = {
                continuationToken: this.bodyParams.continuationToken,
                nfTokenInfos: this.bodyParams.nonFungibleTokens,
                isFinal
            };
        }

        if (invalidParams.length > 0) {
            return errorResponse.call(this, 400, `Invalid parameters: ${invalidParams.join(', ')}`);
        }

        // Make sure that system is running and accepting API calls
        if (!Catenis.application.isRunning()) {
            Catenis.logger.DEBUG(
                'System currently not available for fulfilling POST \'assets/non-fungible/issue\' API request',
                {
                    applicationStatus: Catenis.application.status
                }
            );
            return errorResponse.call(this, 503, 'System currently not available; please try again at a later time');
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
                    error = errorResponse.call(this, 400, 'Numer of non-fungible tokens to issue is too large');
                }
                else if (err.error === 'nf_asset_issue_no_token_info') {
                    // This should only happen if database is corrupted
                    error = errorResponse.call(this, 400, 'Non-fungible asset issuance cannot be finalized with tokens');
                }
                else if (err.error === 'nf_asset_issue_already_complete' || err.error === 'nft_issue_batch_issuance_already_complete') {
                    error = errorResponse.call(this, 400, 'Non-fungible asset issuance is already complete');
                }
                else if (err.error === 'nf_asset_issue_invalid_cont_token' || err.error === 'nf_asset_issue_wrong_operation'
                        || err.error === 'nf_asset_issue_wrong_device') {
                    error = errorResponse.call(this, 400, 'Invalid or unexpected asset issuance continuation token');
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
                Catenis.logger.ERROR('Error processing POST \'assets/non-fungible/issue\' API request.', err);
            }

            return error;
        }

        // Return success
        return successResponse.call(this, result);
    }
    catch (err) {
        Catenis.logger.ERROR('Error processing POST \'assets/non-fungible/issue\' API request.', err);
        return errorResponse.call(this, 500, 'Internal server error');
    }
}

export function isValidHoldingDeviceIdInfoList(data) {
    return Array.isArray(data) && data.length > 0 && data.every(isValidHoldingDeviceIdInfo);
}

function isValidHoldingDeviceIdInfo(data) {
    return Util.isNonNullObject(data) && Util.isNonBlankString(data.id) && (
        !('isProdUniqueId' in data) || typeof data.isProdUniqueId === 'boolean');
}

export function isValidNonFungibleTokenList(data) {
    return Array.isArray(data) && data.length > 0 && data.every(isValidNonFungibleTokensEntry);
}

function isValidNonFungibleTokensEntry(data) {
    return Util.isNonNullObject(data) && (('metadata' in data) || ('contents' in data))
        && (!('metadata' in data) || isValidNonFungibleTokenMetadata(data.metadata))
        && (!('contents' in data) || isValidNonFungibleTokenContents(data.contents));
}

function isValidNonFungibleTokenMetadata(data) {
    return Util.isNonNullObject(data) && Util.isNonBlankString(data.name) && (!('description' in data)
        || Util.isNonBlankString(data.description)) && (!('custom' in data) || Util.isNonNullObject(data.custom));
}

function isValidNonFungibleTokenContents(data) {
    return Util.isNonNullObject(data) && Util.isNonBlankString(data.data) && (!('encoding' in data)
        || isValidContentsEncoding(data.encoding));
}

function isValidContentsEncoding(val) {
    return val === 'utf8' || val === 'base64' || val === 'hex';
}