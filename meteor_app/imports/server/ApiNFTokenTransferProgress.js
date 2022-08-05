/**
 * Created by claudio on 2022-07-20
 */

//console.log('[ApiNFTokenTransferProgress.js]: This code just ran.');

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
 * @typedef {NonFungibleTokenTransferProgressInfo} RetrieveNFTokenTransferProgressResult
 */

/**
 * @typedef {Object} RetrieveNFTokenTransferProgressAPIResponse
 * @property {number} statusCode
 * @property {Object} headers
 * @property {Object} body
 * @property {string} body.status
 * @property {string} [body.message]
 * @property {RetrieveNFTokenTransferProgressResult} [body.data]
 */

/**
 * Method used to process GET 'assets/non-fungible/tokens/:tokenId/transfer/:transferId' endpoint of REST API
 * @this {Object}
 * @property {Object} urlParams
 * @property {string} urlParam.tokenId ID of the non-fungible token
 * @property {string} urlParam.transferId ID of the non-fungible token transfer
 * @return {RetrieveNFTokenTransferProgressAPIResponse}
 */
export function retrieveNFTokenTransferProgress() {
    try {
        // Process request parameters
        let invalidParams = [];

        // From URL
        //
        // tokenId param
        if (!Util.isNonBlankString(this.urlParams.tokenId)) {
            Catenis.logger.DEBUG('Invalid \'tokenId\' parameter for GET \'assets/non-fungible/tokens/:tokenId/transfer/:transferId\' API request', this.urlParams);
            invalidParams.push('tokenId');
        }

        // transferId param
        if (!Util.isNonBlankString(this.urlParams.transferId)) {
            Catenis.logger.DEBUG('Invalid \'transferId\' parameter for GET \'assets/non-fungible/tokens/:tokenId/transfer/:transferId\' API request', this.urlParams);
            invalidParams.push('transferId');
        }

        if (invalidParams.length > 0) {
            return errorResponse.call(this, 400, `Invalid parameters: ${invalidParams.join(', ')}`);
        }

        // Make sure that system is running and accepting API calls
        if (!Catenis.application.isRunning()) {
            Catenis.logger.DEBUG(
                'System currently not available for fulfilling GET \'assets/non-fungible/tokens/:tokenId/transfer/:transferId\' API request',
                {
                    applicationStatus: Catenis.application.status
                }
            );
            return errorResponse.call(this, 503, 'System currently not available; please try again at a later time');
        }

        // Execute method to retrieve non-fungible token retrieval progress
        let result;

        try {
            result = this.user.device.getNFTokenTransferProgress(this.urlParams.tokenId, this.urlParams.transferId);
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
                else if (err.error === 'nft_transfer_invalid_id' || err.error === 'nft_transfer_wrong_token') {
                    error = errorResponse.call(this, 400, 'Invalid non-fungible token transfer ID');
                }
                else if (err.error === 'nft_transfer_wrong_device') {
                    error = errorResponse.call(this, 403, 'No permission to retrieve non-fungible token transfer progress');
                }
            }
            else {
                error = errorResponse.call(this, 500, 'Internal server error');
            }

            if (error.statusCode === 500) {
                Catenis.logger.ERROR('Error processing GET \'assets/non-fungible/tokens/:tokenId/transfer/:transferId\' API request.', err);
            }

            return error;
        }

        // Return success
        return successResponse.call(this, result);
    }
    catch (err) {
        Catenis.logger.ERROR('Error processing GET \'assets/non-fungible/tokens/:tokenId/transfer/:transferId\' API request.', err);
        return errorResponse.call(this, 500, 'Internal server error');
    }
}
