/**
 * Created by claudio on 2022-05-04
 */

//console.log('[ApiNFAssetIssuanceProgress.js]: This code just ran.');

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
 * @typedef {NonFungibleAssetIssuanceProgressInfo} RetrieveNFAssetIssuanceProgressResult
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
 * Method used to process GET 'assets/non-fungible/issuance/:issuanceId' endpoint of REST API
 * @this {Object}
 * @property {Object} urlParams
 * @property {string} urlParam.issuanceId ID of the non-fungible asset issuance
 * @return {IssueNonFungibleAssetAPIResponse}
 */
export function retrieveNFAssetIssuanceProgress() {
    try {
        // Process request parameters
        let invalidParams = [];

        // From URL
        //
        // issuanceId param
        if (!Util.isNonBlankString(this.urlParams.issuanceId)) {
            Catenis.logger.DEBUG('Invalid \'issuanceId\' parameter for GET \'assets/non-fungible/issuance/:issuanceId\' API request', this.urlParams);
            invalidParams.push('issuanceId');
        }

        if (invalidParams.length > 0) {
            return errorResponse.call(this, 400, `Invalid parameters: ${invalidParams.join(', ')}`);
        }

        // Make sure that system is running and accepting API calls
        if (!Catenis.application.isRunning()) {
            Catenis.logger.DEBUG(
                'System currently not available for fulfilling GET \'assets/non-fungible/issuance/:issuanceId\' API request',
                {
                    applicationStatus: Catenis.application.status
                }
            );
            return errorResponse.call(this, 503, 'System currently not available; please try again at a later time');
        }

        // Execute method to retrieve non-fungible asset issuance progress
        let result;

        try {
            result = this.user.device.getNFAssetIssuanceProgress(this.urlParams.issuanceId);
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
                else if (err.error === 'nf_asset_issue_invalid_id') {
                    error = errorResponse.call(this, 400, 'Invalid non-fungible asset issuance ID');
                }
                else if (err.error === 'nf_asset_issue_wrong_device') {
                    error = errorResponse.call(this, 403, 'No permission to retrieve non-fungible asset issuance progress');
                }
                else if (err.error === 'nf_asset_issue_not_complete') {
                    error = errorResponse.call(this, 400, 'Non-fungible asset issuance data is not yet complete');
                }
            }
            else {
                error = errorResponse.call(this, 500, 'Internal server error');
            }

            if (error.statusCode === 500) {
                Catenis.logger.ERROR('Error processing GET \'assets/non-fungible/issuance/:issuanceId\' API request.', err);
            }

            return error;
        }

        // Return success
        return successResponse.call(this, result);
    }
    catch (err) {
        Catenis.logger.ERROR('Error processing GET \'assets/non-fungible/issuance/:issuanceId\' API request.', err);
        return errorResponse.call(this, 500, 'Internal server error');
    }
}
