/**
 * Created by claudio on 2022-11-18
 */

//console.log('[ApiListOwnedNonFungibleTokens.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import config from 'config';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import {
    successResponse,
    errorResponse
} from './RestApi';
import { Util } from './Util';

// Config entries
const apiListOwnedNTFsConfig = config.get('apiListOwnedNonFungibleTokens');

// Configuration settings
export const cfgSettings = {
    maxRetListEntries: apiListOwnedNTFsConfig.get('maxRetListEntries')
};


// Definition of module (private) functions
//

/**
 * @typedef {Object} ListOwnedNonFungibleTokensAPIResponse
 * @property {number} statusCode
 * @property {Object} headers
 * @property {Object} body
 * @property {string} body.status
 * @property {string} [body.message]
 * @property {ListOwnedNFTokensResult} [body.data]
 */

/**
 * Method used to process GET 'assets/non-fungible/:assetId/tokens/owned' endpoint of REST API
 * @this {Object}
 * @property {Object} urlParams
 * @property {string} urlParams.assetId The external ID of the non-fungible asset the non-fungible tokens of which that
 *                                       are currently owned by the device should be retrieved
 * @property {Object} queryParams
 * @property {string} [queryParams.limit] Maximum number of owned non-fungible tokens that should be returned
 * @property {string} [queryParams.skip='0'] Number of owned non-fungible tokens that should be skipped (from the
 *                                            beginning of list) and not returned
 * @returns {ListOwnedNonFungibleTokensAPIResponse}
 */
export function listOwnedNonFungibleTokens() {
    try {
        // Process request parameters
        let invalidParams = [];

        // From URL
        //
        // assetId param
        if (!Util.isNonBlankString(this.urlParams.assetId)) {
            Catenis.logger.DEBUG('Invalid \'assetId\' parameter for GET \'assets/non-fungible/:assetId/tokens/owned\' API request', this.urlParams);
            invalidParams.push('assetId');
        }

        // From query string
        //
        // limit param
        let limit;

        if (!(this.queryParams.limit === undefined
            || (!Number.isNaN(limit = Number.parseInt(this.queryParams.limit)) && isValidLimit(limit)))) {
            Catenis.logger.DEBUG('Invalid \'limit\' parameter for GET \'assets/non-fungible/:assetId/tokens/owned\' API request', this.queryParams);
            invalidParams.push('limit');
        }

        // skip param
        let skip;

        if (!(this.queryParams.skip === undefined
            || (!Number.isNaN(skip = Number.parseInt(this.queryParams.skip)) && isValidSkip(skip)))) {
            Catenis.logger.DEBUG('Invalid \'skip\' parameter for GET \'assets/non-fungible/:assetId/tokens/owned\' API request', this.queryParams);
            invalidParams.push('skip');
        }

        if (invalidParams.length > 0) {
            return errorResponse.call(this, 400, `Invalid parameters: ${invalidParams.join(', ')}`);
        }

        // Make sure that system is running and accepting API calls
        if (!Catenis.application.isRunning()) {
            Catenis.logger.DEBUG('System currently not available for fulfilling GET \'assets/non-fungible/:assetId/tokens/owned\' API request', {applicationStatus: Catenis.application.status});
            return errorResponse.call(this, 503, 'System currently not available; please try again at a later time');
        }

        // Execute method to list owned non-fungible tokens
        let listResult;

        try {
            listResult = this.user.device.listOwnedNonFungibleTokens(this.urlParams.assetId, limit, skip);
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
                else if (err.error === 'ctn_owned_nfts_asset_fungible') {
                    error = errorResponse.call(this, 400, 'Not a non-fungible asset');
                }
                else {
                    error = errorResponse.call(this, 500, 'Internal server error');
                }
            }
            else {
                error = errorResponse.call(this, 500, 'Internal server error');
            }

            if (error.statusCode === 500) {
                Catenis.logger.ERROR('Error processing GET \'assets/non-fungible/tokens/:tokenId/owner\' API request.', err);
            }

            return error;
        }

        return successResponse.call(this, listResult);
    }
    catch (err) {
        Catenis.logger.ERROR('Error processing GET \'assets/non-fungible/:assetId/tokens/owned\' API request.', err);
        return errorResponse.call(this, 500, 'Internal server error');
    }
}

/**
 * Validate limit parameter
 * @param {number} num
 * @return {boolean}
 */
function isValidLimit(num) {
    return num > 0 && num <= cfgSettings.maxRetListEntries;
}

/**
 * Validate skip parameter
 * @param {number} num
 * @return {boolean}
 */
function isValidSkip(num) {
    return num >= 0;
}
