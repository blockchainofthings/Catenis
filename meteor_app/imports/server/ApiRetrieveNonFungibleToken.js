/**
 * Created by claudio on 2022-06-29
 */

//console.log('[ApiRetrieveNonFungibleToken.js]: This code just ran.');

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
import {
    cfgSettings as nftRetrievalCfgSettings
} from './NFTokenRetrieval'


// Definition of module (private) functions
//

/**
 * @typedef {Object} RetrievedNonFungibleMetadata
 * @property {string} name The non-fungible token name
 * @property {string} [description] A short description about the non-fungible token
 * @property {boolean} contentsEncrypted Indicates whether the stored contents is encrypted
 * @property {string} contentsURL URL to the non-fungible token's contents stored on IPFS
 * @property {Object} [custom] An optional dictionary object containing name/value pairs to be used as custom
 *                              metadata for the non-fungible token
 */

/**
 * @typedef {Object} RetrievedNonFungibleTokenInfo
 * @property {string} [assetId] The external ID of the non-fungible asset to which the token belongs
 * @property {RetrievedNonFungibleMetadata} [metadata] The non-fungible token metadata
 * @property {NFTokenEncodedContentsData} [contents] The retrieved non-fungible token contents data
 */

/**
 * @typedef {Object} NFTokenRetrievalResult
 * @property {string} [continuationToken] The continuation token to be used in the next continuation request
 * @property {string} [tokenRetrievalId] The asset issuance ID to be used for querying the progress of the non-fungible
 *                                        asset issuance. Only returned when doing the processing asynchronously
 * @property {RetrievedNonFungibleTokenInfo} [nonFungibleToken] The retrieved non-fungible token
 */

/**
 * @typedef {Object} IssueNonFungibleAssetAPIResponse
 * @property {number} statusCode
 * @property {Object} headers
 * @property {Object} body
 * @property {string} body.status
 * @property {string} [body.message]
 * @property {NFTokenRetrievalResult} [body.data]
 */

/**
 * Method used to process POST 'assets/non-fungible/tokens/:tokenId' endpoint of REST API
 * @this {Object}
 * @property {Object} urlParams
 * @property {string} urlParams.tokenId The external ID of the non-fungible token to retrieve
 * @property {Object} queryParams
 * @property {string} [queryParams.retrieveContents='true'] Boolean value that indicates whether the non-fungible token
 *                                                      contents should be retrieved
 * @property {string} [queryParams.contentsOnly='false'] Boolean value that indicates whether only the non-fungible
 *                                                      token contents should be retrieved
 * @property {string} [queryParams.contentsEncoding='base64'] The encoding used to encode the retrieved non-fungible
 *                                                      token contents data before delivering it to the end user
 * @property {string} [queryParams.dataChunkSize] Numeric value representing the size, in bytes, of the largest contents
 *                                                 data chunk that should be returned
 * @property {string} [queryParams.async='false'] Boolean value that indicates whether the non-fungible token retrieval
 *                                                 should be processed asynchronously
 * @property {string} [queryParams.continuationToken] ID that identifies the ongoing non-fungible token retrieval
 *                                                     operation
 * @returns {IssueNonFungibleAssetAPIResponse}
 */
export function retrieveNonFungibleToken() {
    try {
        // Process request parameters
        let invalidParams = [];

        // From URL
        //
        // tokenId param
        if (!Util.isNonBlankString(this.urlParams.tokenId)) {
            Catenis.logger.DEBUG('Invalid \'tokenId\' parameter for GET \'assets/non-fungible/tokens/:tokenId\' API request', this.urlParams);
            invalidParams.push('tokenId');
        }

        // From query string
        //
        // continuationToken param
        let isContinuationReq = false;

        if (Util.isNonBlankString(this.queryParams.continuationToken)) {
            isContinuationReq = true;
        }
        else if (this.queryParams.continuationToken !== undefined) {
            Catenis.logger.DEBUG('Invalid \'continuationToken\' parameter for GET \'assets/non-fungible/tokens/:tokenId\' API request', this.queryParams);
            invalidParams.push('continuationToken');
        }

        /**
         * @type {RetrieveNFTokenOptions}
         */
        let retrieveOptions;

        if (!isContinuationReq) {
            // New retrieval of non-fungible token
            retrieveOptions = {
                retrieveContents: true,
                contentsOptions: {
                    contentsOnly: false,
                    encoding: 'base64'
                },
                asyncProc: false
            };

            // retrieveContents param
            if (this.queryParams.retrieveContents !== undefined && (retrieveOptions.retrieveContents = parseBoolean(this.queryParams.retrieveContents)) === null) {
                Catenis.logger.DEBUG('Invalid \'retrieveContents\' parameter for GET \'assets/non-fungible/tokens/:tokenId\' API request', this.queryParams);
                invalidParams.push('retrieveContents');
            }

            if (retrieveOptions.retrieveContents) {
                // contentsOnly param
                if (this.queryParams.contentsOnly !== undefined && (retrieveOptions.contentsOptions.contentsOnly = parseBoolean(this.queryParams.contentsOnly)) === null) {
                    Catenis.logger.DEBUG('Invalid \'contentsOnly\' parameter for GET \'assets/non-fungible/tokens/:tokenId\' API request', this.queryParams);
                    invalidParams.push('contentsOnly');
                }

                // contentsEncoding param
                if (isValidEncoding(this.queryParams.contentsEncoding)) {
                    retrieveOptions.contentsOptions.encoding = this.queryParams.contentsEncoding;
                }
                else if (this.queryParams.contentsEncoding !== undefined) {
                    Catenis.logger.DEBUG('Invalid \'contentsEncoding\' parameter for GET \'assets/non-fungible/tokens/:tokenId\' API request', this.queryParams);
                    invalidParams.push('contentsEncoding');
                }

                // dataChunkSize param
                let dataChunkSize;

                if (!Number.isNaN(dataChunkSize = Util.strictParseInt(this.queryParams.dataChunkSize)) && isValidDataChunkSize(dataChunkSize)) {
                    retrieveOptions.contentsOptions.dataChunkSize = dataChunkSize;
                }
                else if (this.queryParams.dataChunkSize !== undefined) {
                    Catenis.logger.DEBUG('Invalid \'dataChunkSize\' parameter for GET \'assets/non-fungible/tokens/:tokenId\' API request', this.queryParams);
                    invalidParams.push('dataChunkSize');
                }
            }
            else {
                // Make sure that contents retrieval options parameters are not set

                // contentsOnly param
                if (this.queryParams.contentsOnly !== undefined) {
                    Catenis.logger.DEBUG('Invalid \'contentsOnly\' parameter for GET \'assets/non-fungible/tokens/:tokenId\' API request', this.queryParams);
                    invalidParams.push('contentsOnly');
                }

                // contentsEncoding param
                if (this.queryParams.contentsEncoding !== undefined) {
                    Catenis.logger.DEBUG('Invalid \'contentsEncoding\' parameter for GET \'assets/non-fungible/tokens/:tokenId\' API request', this.queryParams);
                    invalidParams.push('contentsEncoding');
                }

                // dataChunkSize param
                if (this.queryParams.dataChunkSize !== undefined) {
                    Catenis.logger.DEBUG('Invalid \'dataChunkSize\' parameter for GET \'assets/non-fungible/tokens/:tokenId\' API request', this.queryParams);
                    invalidParams.push('dataChunkSize');
                }
            }

            // async param
            if (this.queryParams.async !== undefined && (retrieveOptions.asyncProc = parseBoolean(this.queryParams.async)) === null) {
                Catenis.logger.DEBUG('Invalid \'async\' parameter for GET \'assets/non-fungible/tokens/:tokenId\' API request', this.queryParams);
                invalidParams.push('async');
            }
        }
        else {
            // Continue delivery of retrieved non-fungible token.
            //  Make sure that all other parameters are not set

            // retrieveContents param
            if (this.queryParams.retrieveContents !== undefined) {
                Catenis.logger.DEBUG('Invalid \'retrieveContents\' parameter for GET \'assets/non-fungible/tokens/:tokenId\' API request', this.queryParams);
                invalidParams.push('retrieveContents');
            }

            // contentsOnly param
            if (this.queryParams.contentsOnly !== undefined) {
                Catenis.logger.DEBUG('Invalid \'contentsOnly\' parameter for GET \'assets/non-fungible/tokens/:tokenId\' API request', this.queryParams);
                invalidParams.push('contentsOnly');
            }

            // contentsEncoding param
            if (this.queryParams.contentsEncoding !== undefined) {
                Catenis.logger.DEBUG('Invalid \'contentsEncoding\' parameter for GET \'assets/non-fungible/tokens/:tokenId\' API request', this.queryParams);
                invalidParams.push('contentsEncoding');
            }

            // dataChunkSize param
            if (this.queryParams.dataChunkSize !== undefined) {
                Catenis.logger.DEBUG('Invalid \'dataChunkSize\' parameter for GET \'assets/non-fungible/tokens/:tokenId\' API request', this.queryParams);
                invalidParams.push('dataChunkSize');
            }

            // async param
            if (this.queryParams.async !== undefined) {
                Catenis.logger.DEBUG('Invalid \'async\' parameter for GET \'assets/non-fungible/tokens/:tokenId\' API request', this.queryParams);
                invalidParams.push('async');
            }
        }

        if (invalidParams.length > 0) {
            return errorResponse.call(this, 400, `Invalid parameters: ${invalidParams.join(', ')}`);
        }

        // Make sure that system is running and accepting API calls
        if (!Catenis.application.isRunning()) {
            Catenis.logger.DEBUG(
                'System currently not available for fulfilling GET \'assets/non-fungible/tokens/:tokenId\' API request',
                {
                    applicationStatus: Catenis.application.status
                }
            );
            return errorResponse.call(this, 503, 'System currently not available; please try again at a later time');
        }

        // Execute method to retrieve non-fungible token
        let result;

        try {
            result = this.user.device.retrieveNonFungibleToken(this.urlParams.tokenId, retrieveOptions, this.queryParams.continuationToken);
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
                else if (err.error === 'nf_token_invalid_id') {
                    error = errorResponse.call(this, 400, 'Invalid non-fungible token ID');
                }
                else if (err.error === 'ctn_retrieve_nft_invalid_cc_id' ||  err.error === 'ctn_retrieve_nft_burnt_token'
                        || err.error === 'ctn_retrieve_nft_invalid_addr') {
                    error = errorResponse.call(this, 400, 'Unavailable or inconsistent non-fungible token');
                }
                else if (err.error === 'ctn_retrieve_nft_no_access') {
                    error = errorResponse.call(this, 403, 'No permission to retrieve non-fungible token');
                }
                else if (err.error === 'nft_retrieval_not_available') {
                    error = errorResponse.call(this, 400, 'Non-fungible token data retrieval not yet done');
                }
                else if (err.error === 'nft_retrieval_already_delivered') {
                    error = errorResponse.call(this, 400, 'Retrieved non-fungible token data already delivered');
                }
                else if (err.error === 'nft_retrieval_invalid_cont_token' || err.error === 'nft_retrieval_wrong_token'
                        || err.error === 'nft_retrieval_wrong_device') {
                    error = errorResponse.call(this, 400, 'Invalid or unexpected non-fungible token retrieval continuation token');
                }
                else if (err.error === 'nft_retrieval_expired') {
                    error = errorResponse.call(this, 400, 'Retrieved non-fungible token data expired');
                }
                else {
                    error = errorResponse.call(this, 500, 'Internal server error');
                }
            }
            else {
                error = errorResponse.call(this, 500, 'Internal server error');
            }

            if (error.statusCode === 500) {
                Catenis.logger.ERROR('Error processing GET \'assets/non-fungible/tokens/:tokenId\' API request.', err);
            }

            return error;
        }

        // Return success
        return successResponse.call(this, result);
    }
    catch (err) {
        Catenis.logger.ERROR('Error processing GET \'assets/non-fungible/tokens/:tokenId\' API request.', err);
        return errorResponse.call(this, 500, 'Internal server error');
    }
}

/**
 * Parse boolean string value
 * @param {string} value
 * @return {(boolean|null)} The parsed boolean value, or null if the passed string value is not valid
 */
function parseBoolean(value) {
    return typeof value !== 'string' ? null : (value === '1' || value.toLowerCase() === 'true' ? true : (value === '0' || value.toLowerCase() === 'false' ? false : null));
}

/**
 * Validates data encoding
 * @param {*} val The value to be validated
 * @returns {boolean}
 */
function isValidEncoding(val) {
    return val === 'utf8' || val === 'base64' || val === 'hex';
}

/**
 * Validates contents data chunk size
 * @param {Number} size The size to be validated
 * @returns {boolean}
 */
function isValidDataChunkSize(size) {
    return size >= nftRetrievalCfgSettings.minSizeContentsDataChunk && size <= nftRetrievalCfgSettings.maxSizeContentsDataChunk;
}
