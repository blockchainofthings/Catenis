/**
 * Created by claudio on 2022-08-06
 */

//console.log('[ApiAssetInfo3.js]: This code just ran.');

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


// Definition of module (private) functions
//

/**
 * @typedef {Object} RetrieveAssetInfoAPIResponse
 * @property {number} statusCode
 * @property {Object} headers
 * @property {Object} body
 * @property {string} body.status
 * @property {string} [body.message]
 * @property {RegularNonFungibleAssetInfo} [body.data]
 */

/**
 * Method used to process GET 'assets/:assetId' endpoint of Rest API
 * @this {Object}
 * @property {Object} urlParams
 * @property {string} urlParams.assetId ID of the asset to retrieve information
 * @returns {RetrieveAssetInfoAPIResponse}
 */
export function retrieveAssetInfo3() {
    try {
        // Process request parameters
        let invalidParams = [];

        // From URL
        //
        // assetId param
        if (!(typeof this.urlParams.assetId === 'string' && this.urlParams.assetId.length > 0)) {
            Catenis.logger.DEBUG('Invalid \'assetId\' parameter for GET \'assets/:assetId\' API request', this.urlParams);
            invalidParams.push('assetId');
        }

        if (invalidParams.length > 0) {
            return errorResponse.call(this, 400, `Invalid parameters: ${invalidParams.join(', ')}`);
        }

        // Make sure that system is running and accepting API calls
        if (!Catenis.application.isRunning()) {
            Catenis.logger.DEBUG('System currently not available for fulfilling GET \'assets/:assetId\' API request', {applicationStatus: Catenis.application.status});
            return errorResponse.call(this, 503, 'System currently not available; please try again at a later time');
        }

        // Execute method to retrieve asset info
        let result;

        try {
            result = this.user.device.retrieveAssetInfo2(this.urlParams.assetId);
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
                else if (err.error === 'ctn_device_asset_no_access') {
                    error = errorResponse.call(this, 403, 'No permission to retrieve asset info');
                }
                else {
                    error = errorResponse.call(this, 500, 'Internal server error');
                }
            }
            else {
                error = errorResponse.call(this, 500, 'Internal server error');
            }

            if (error.statusCode === 500) {
                Catenis.logger.ERROR('Error processing GET \'assets/:assetId\' API request.', err);
            }

            return error;
        }

        // Return success
        return successResponse.call(this, result);
    }
    catch (err) {
        Catenis.logger.ERROR('Error processing GET \'assets/:assetId\' API request.', err);
        return errorResponse.call(this, 500, 'Internal server error');
    }
}
