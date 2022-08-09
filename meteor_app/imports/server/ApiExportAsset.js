/**
 * Created by claudio on 2021-07-13
 */

//console.log('[ApiExportAsset.js]: This code just ran.');

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
import { Util } from './Util';


// Definition of module (private) functions
//

/**
 * @typedef {Object} ExportAssetPriceEstimate
 * @property {string} estimatedPrice
 */

/**
 * @typedef {Object} ExportAssetAPIResponse
 * @property {number} statusCode
 * @property {Object} headers
 * @property {Object} body
 * @property {string} body.status
 * @property {string} [body.message]
 * @property {(ExportedAssetOutcome|ExportAssetPriceEstimate)} [body.data]
 */

/**
 * Method used to process POST 'assets/:assetId/export/:foreignBlockchain' endpoint of REST API
 * @this {Object}
 * @property {Object} urlParams
 * @property {string} urlParam.assetId ID of asset to export
 * @property {string} urlParam.foreignBlockchain Name of the foreign blockchain
 * @property {Object} bodyParams
 * @property {Object} bodyParams.token
 * @property {string} bodyParams.token.name The name of the token to be created on the foreign blockchain
 * @property {string} bodyParams.token.symbol The symbol of the token to be created on the foreign blockchain
 * @property {Object} [bodyParams.options]
 * @property {string} [bodyParams.options.consumptionProfile] Name of foreign blockchain native coin consumption profile
 *                                                             to use
 * @property {boolean} [bodyParams.options.estimateOnly] When set, indicates that no asset export should be executed but
 *                                          only the estimated price (in the foreign blockchain's native coin) to
 *                                          fulfill the operation should be returned
 * @return {ExportAssetAPIResponse}
 */
export function exportAsset() {
    try {
        // Process request parameters
        let invalidParams = [];

        // From URL
        //
        // assetId param
        if (!(typeof this.urlParams.assetId === 'string' && this.urlParams.assetId.length > 0)) {
            Catenis.logger.DEBUG('Invalid \'assetId\' parameter for POST \'assets/:assetId/export/:foreignBlockchain\' API request', this.urlParams);
            invalidParams.push('assetId');
        }

        // foreignBlockchain param
        if (!(typeof this.urlParams.foreignBlockchain === 'string' && this.urlParams.foreignBlockchain.length > 0
                && ForeignBlockchain.isValidKey(this.urlParams.foreignBlockchain))) {
            Catenis.logger.DEBUG('Invalid \'foreignBlockchain\' parameter for POST \'assets/:assetId/export/:foreignBlockchain\' API request', this.urlParams);
            invalidParams.push('foreignBlockchain');
        }

        // From payload
        //
        // token param
        if (Util.isNonNullObject(this.bodyParams.token)) {
            // token.name param
            if (!(typeof this.bodyParams.token.name === 'string' && this.bodyParams.token.name.length > 0)) {
                Catenis.logger.DEBUG('Invalid \'token.name\' parameter POST for \'assets/:assetId/export/:foreignBlockchain\' API request', this.bodyParams);
                invalidParams.push('token.name');
            }

            // token.name param
            if (!(typeof this.bodyParams.token.symbol === 'string' && this.bodyParams.token.symbol.length > 0)) {
                Catenis.logger.DEBUG('Invalid \'token.symbol\' parameter POST for \'assets/:assetId/export/:foreignBlockchain\' API request', this.bodyParams);
                invalidParams.push('token.symbol');
            }
        }
        else {
            Catenis.logger.DEBUG('Invalid \'token\' parameter POST for \'assets/:assetId/export/:foreignBlockchain\' API request', this.bodyParams);
            invalidParams.push('token');
        }

        // options param
        if (Util.isNonNullObject(this.bodyParams.options)) {
            // options.consumptionProfile param
            if (!(this.bodyParams.options.consumptionProfile === undefined ||
                    (typeof this.bodyParams.options.consumptionProfile === 'string'
                    && this.bodyParams.options.consumptionProfile.length > 0
                    && ForeignBlockchain.isValidConsumptionProfileName(this.bodyParams.options.consumptionProfile)))) {
                Catenis.logger.DEBUG('Invalid \'options.consumptionProfile\' parameter POST for \'assets/:assetId/export/:foreignBlockchain\' API request', this.bodyParams);
                invalidParams.push('options.consumptionProfile');
            }

            // options.estimateOnly param
            if (!(this.bodyParams.options.estimateOnly === undefined
                    || typeof this.bodyParams.options.estimateOnly === 'boolean')) {
                Catenis.logger.DEBUG('Invalid \'options.estimateOnly\' parameter POST for \'assets/:assetId/export/:foreignBlockchain\' API request', this.bodyParams);
                invalidParams.push('options.estimateOnly');
            }
        }
        else if (this.bodyParams.options !== undefined) {
            Catenis.logger.DEBUG('Invalid \'options\' parameter POST for \'assets/:assetId/export/:foreignBlockchain\' API request', this.bodyParams);
            invalidParams.push('options');
        }

        if (invalidParams.length > 0) {
            return errorResponse.call(this, 400, `Invalid parameters: ${invalidParams.join(', ')}`);
        }

        // Make sure that system is running and accepting API calls
        if (!Catenis.application.isRunning()) {
            Catenis.logger.DEBUG('System currently not available for fulfilling POST \'assets/:assetId/export/:foreignBlockchain\' API request', {applicationStatus: Catenis.application.status});
            return errorResponse.call(this, 503, 'System currently not available; please try again at a later time');
        }

        // Execute method to export asset
        let exportResult;

        try {
            exportResult = this.user.device.exportAsset(
                this.urlParams.assetId,
                this.urlParams.foreignBlockchain,
                this.bodyParams.token,
                this.bodyParams.options
            );
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
                else if (err.error === 'ctn_export_asset_non_fungible') {
                    error = errorResponse.call(this, 400, 'Not a regular (fungible) asset');
                }
                else if (err.error === 'ctn_device_not_asset_issuer') {
                    error = errorResponse.call(this, 403, 'No permission to export asset');
                }
                else if (err.error === 'ctn_exp_asset_already_exported') {
                    error = errorResponse.call(this, 400, 'Asset already exported');
                }
                else if (err.error === 'ctn_exp_asset_low_foreign_bc_funds') {
                    // Foreign blockchain funds not enough to cover transaction execution price (<value>)
                    error = errorResponse.call(this, 400, err.reason);
                }
                else if (err.error === 'ctn_exp_asset_discarded_token_call') {
                    error = errorResponse.call(this, 400, 'Discarded concurrent foreign token smart contract call');
                }
                else if (err.error === 'ctn_exp_asset_token_call_error') {
                    error = errorResponse.call(this, 400, 'Unexpected error calling foreign token smart contract');
                }
                else {
                    error = errorResponse.call(this, 500, 'Internal server error');
                }
            }
            else {
                error = errorResponse.call(this, 500, 'Internal server error');
            }

            if (error.statusCode === 500) {
                Catenis.logger.ERROR('Error processing POST \'assets/:assetId/export/:foreignBlockchain\' API request.', err);
            }

            return error;
        }

        // Return success
        const data = this.bodyParams.options && this.bodyParams.options.estimateOnly
            ? {estimatedPrice: exportResult}
            : exportResult;

        return successResponse.call(this, data);
    }
    catch (err) {
        Catenis.logger.ERROR('Error processing POST \'assets/:assetId/export/:foreignBlockchain\' API request.', err);
        return errorResponse.call(this, 500, 'Internal server error');
    }
}
