/**
 * Created by claudio on 2022-06-30
 */

//console.log('[ApiNFTokenRetrievalProgress.js]: This code just ran.');

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
 * @typedef {NonFungibleTokenRetrievalProgressInfo} RetrieveNFTokenRetrievalProgressResult
 */

/**
 * @typedef {Object} RetrieveNFTokenRetrievalProgressAPIResponse
 * @property {number} statusCode
 * @property {Object} headers
 * @property {Object} body
 * @property {string} body.status
 * @property {string} [body.message]
 * @property {RetrieveNFTokenRetrievalProgressResult} [body.data]
 */

/**
 * Method used to process GET 'assets/non-fungible/tokens/:tokenId/retrieval/:retrievalId' endpoint of REST API
 * @this {Object}
 * @property {Object} urlParams
 * @property {string} urlParam.tokenId ID of the non-fungible token
 * @property {string} urlParam.retrievalId ID of the non-fungible token retrieval
 * @return {RetrieveNFTokenRetrievalProgressAPIResponse}
 */
export function retrieveNFTokenRetrievalProgress() {
    try {
        // Process request parameters
        let invalidParams = [];

        // From URL
        //
        // tokenId param
        if (!Util.isNonBlankString(this.urlParams.tokenId)) {
            Catenis.logger.DEBUG('Invalid \'tokenId\' parameter for GET \'assets/non-fungible/tokens/:tokenId/retrieval/:retrievalId\' API request', this.urlParams);
            invalidParams.push('tokenId');
        }

        // retrievalId param
        if (!Util.isNonBlankString(this.urlParams.retrievalId)) {
            Catenis.logger.DEBUG('Invalid \'retrievalId\' parameter for GET \'assets/non-fungible/tokens/:tokenId/retrieval/:retrievalId\' API request', this.urlParams);
            invalidParams.push('retrievalId');
        }

        if (invalidParams.length > 0) {
            return errorResponse.call(this, 400, `Invalid parameters: ${invalidParams.join(', ')}`);
        }

        // Make sure that system is running and accepting API calls
        if (!Catenis.application.isRunning()) {
            Catenis.logger.DEBUG(
                'System currently not available for fulfilling GET \'assets/non-fungible/tokens/:tokenId/retrieval/:retrievalId\' API request',
                {
                    applicationStatus: Catenis.application.status
                }
            );
            return errorResponse.call(this, 503, 'System currently not available; please try again at a later time');
        }

        // Execute method to retrieve non-fungible token retrieval progress
        let result;

        try {
            result = this.user.device.getNFTokenRetrievalProgress(this.urlParams.tokenId, this.urlParams.retrievalId);
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
                else if (err.error === 'nft_retrieval_invalid_id' || err.error === 'nft_retrieval_wrong_token') {
                    error = errorResponse.call(this, 400, 'Invalid non-fungible token retrieval ID');
                }
                else if (err.error === 'nft_retrieval_wrong_device') {
                    error = errorResponse.call(this, 403, 'No permission to retrieve non-fungible token retrieval progress');
                }
            }
            else {
                error = errorResponse.call(this, 500, 'Internal server error');
            }

            if (error.statusCode === 500) {
                Catenis.logger.ERROR('Error processing GET \'assets/non-fungible/tokens/:tokenId/retrieval/:retrievalId\' API request.', err);
            }

            return error;
        }

        // Return success
        return successResponse.call(this, result);
    }
    catch (err) {
        Catenis.logger.ERROR('Error processing GET \'assets/non-fungible/tokens/:tokenId/retrieval/:retrievalId\' API request.', err);
        return errorResponse.call(this, 500, 'Internal server error');
    }
}
