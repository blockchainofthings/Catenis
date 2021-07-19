/**
 * Created by claudio on 2021-07-14
 */

//console.log('[ApiAssetExportOutcome.js]: This code just ran.');

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
import { ForeignBlockchain } from './ForeignBlockchain';


// Definition of module (private) functions
//

/**
 * @typedef {Object} assetExportOutcomeAPIResponse
 * @property {number} statusCode
 * @property {Object} headers
 * @property {Object} body
 * @property {string} body.status
 * @property {string} [body.message]
 * @property {Object} [body.data]
 * @property {ExportedAssetOutcome} [body.data.exportedAsset]
 */

/**
 * Method used to process GET 'assets/:assetId/export/:foreignBlockchain' endpoint of REST API
 * @this {Object}
 * @property {Object} urlParams
 * @property {string} urlParam.assetId ID of the exported asset
 * @property {string} urlParam.foreignBlockchain Name of the foreign blockchain
 * @return {assetExportOutcomeAPIResponse}
 */
export function assetExportOutcome() {
    try {
        // Process request parameters
        let invalidParams = [];

        // From URL
        //
        // assetId param
        if (!(typeof this.urlParams.assetId === 'string' && this.urlParams.assetId.length > 0)) {
            Catenis.logger.DEBUG('Invalid \'assetId\' parameter for GET \'assets/:assetId/export/:foreignBlockchain\' API request', this.urlParams);
            invalidParams.push('assetId');
        }

        // foreignBlockchain param
        if (!(typeof this.urlParams.foreignBlockchain === 'string' && this.urlParams.foreignBlockchain.length > 0
                && ForeignBlockchain.isValidKey(this.urlParams.foreignBlockchain))) {
            Catenis.logger.DEBUG('Invalid \'foreignBlockchain\' parameter for GET \'assets/:assetId/export/:foreignBlockchain\' API request', this.urlParams);
            invalidParams.push('foreignBlockchain');
        }

        if (invalidParams.length > 0) {
            return errorResponse.call(this, 400, `Invalid parameters: ${invalidParams.join(', ')}`);
        }

        // Make sure that system is running and accepting API calls
        if (!Catenis.application.isRunning()) {
            Catenis.logger.DEBUG('System currently not available for fulfilling GET \'assets/:assetId/export/:foreignBlockchain\' API request', {applicationStatus: Catenis.application.status});
            return errorResponse.call(this, 503, 'System currently not available; please try again at a later time');
        }

        // Execute method to get asset export outcome
        let exportedAsset;

        try {
            exportedAsset = this.user.device.getAssetExportOutcome(
                this.urlParams.assetId,
                this.urlParams.foreignBlockchain
            );
        }
        catch (err) {
            let error;

            if (err instanceof Meteor.Error) {
                if (err.error === 'ctn_device_deleted') {
                    // This should never happen
                    error = errorResponse.call(this, 400, 'Device is deleted');
                }
                else if (err.error === 'ctn_device_not_active') {
                    error = errorResponse.call(this, 400, 'Device is not active');
                }
                else if (err.error === 'ctn_asset_not_found') {
                    error = errorResponse.call(this, 400, 'Invalid asset ID');
                }
                else if (err.error === 'ctn_device_not_exp_asset_owner') {
                    error = errorResponse.call(this, 403, 'No permission to retrieve asset export outcome');
                }
                else if (err.error === 'ctn_exp_asset_not_found') {
                    error = errorResponse.call(this, 400, 'Asset not yet exported');
                }
                else {
                    error = errorResponse.call(this, 500, 'Internal server error');
                }
            }
            else {
                error = errorResponse.call(this, 500, 'Internal server error');
            }

            if (error.statusCode === 500) {
                Catenis.logger.ERROR('Error processing GET \'assets/:assetId/export/:foreignBlockchain\' API request.', err);
            }

            return error;
        }

        return successResponse.call(this, {
            exportedAsset
        });
    }
    catch (err) {
        Catenis.logger.ERROR('Error processing GET \'assets/:assetId/export/:foreignBlockchain\' API request.', err);
        return errorResponse.call(this, 500, 'Internal server error');
    }
}
