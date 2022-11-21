/**
 * Created by claudio on 2022-11-18
 */

//console.log('[ApiGetNonFungibleTokenOwner.js]: This code just ran.');

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


// Definition of module (private) functions
//

/**
 * @typedef {Object} GetNonFungibleTokenOwnerAPIResponse
 * @property {number} statusCode
 * @property {Object} headers
 * @property {Object} body
 * @property {string} body.status
 * @property {string} [body.message]
 * @property {NFTokenOwnerInfo} [body.data]
 */

/**
 * Method used to process GET 'assets/non-fungible/tokens/:tokenId/owner' endpoint of REST API
 * @this {Object}
 * @property {Object} urlParams
 * @property {string} urlParams.tokenId The external ID of the non-fungible token the owner of which should be
 *                                       identified
 * @returns {GetNonFungibleTokenOwnerAPIResponse}
 */
export function getNonFungibleTokenOwner() {
    try {
        // Process request parameters
        let invalidParams = [];

        // From URL
        //
        // tokenId param
        if (!Util.isNonBlankString(this.urlParams.tokenId)) {
            Catenis.logger.DEBUG('Invalid \'tokenId\' parameter for GET \'assets/non-fungible/tokens/:tokenId/owner\' API request', this.urlParams);
            invalidParams.push('tokenId');
        }

        if (invalidParams.length > 0) {
            return errorResponse.call(this, 400, `Invalid parameters: ${invalidParams.join(', ')}`);
        }

        // Make sure that system is running and accepting API calls
        if (!Catenis.application.isRunning()) {
            Catenis.logger.DEBUG('System currently not available for fulfilling GET \'assets/non-fungible/tokens/:tokenId/owner\' API request', {applicationStatus: Catenis.application.status});
            return errorResponse.call(this, 503, 'System currently not available; please try again at a later time');
        }

        // Execute method to get non-fungible token owner
        let result;

        try {
            result = this.user.device.getNonFungibleTokenOwner(this.urlParams.tokenId);
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
                else if (err.error === 'ctn_nft_owner_no_access') {
                    error = errorResponse.call(this, 403, 'No permission to retrieve the identity of the non-fungible token owner');
                }
                else if (err.error === 'ctn_nft_owner_invalid_cc_id' ||  err.error === 'ctn_nft_owner_burnt'
                        || err.error === 'ctn_nft_owner_invalid_addr') {
                    error = errorResponse.call(this, 400, 'Unavailable or inconsistent non-fungible token');
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

        return successResponse.call(this, result);
    }
    catch (err) {
        Catenis.logger.ERROR('Error processing GET \'assets/non-fungible/tokens/:tokenId/owner\' API request.', err);
        return errorResponse.call(this, 500, 'Internal server error');
    }
}
