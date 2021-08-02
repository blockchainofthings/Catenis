/**
 * Created by claudio on 2021-07-15
 */

//console.log('[ApiAssetMigrationOutcome.js]: This code just ran.');

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
 * @typedef {Object} assetMigrationOutcomeAPIResponse
 * @property {number} statusCode
 * @property {Object} headers
 * @property {Object} body
 * @property {string} body.status
 * @property {string} [body.message]
 * @property {Object} [body.data]
 * @property {AssetMigrationOutcome} [body.data.assetMigration]
 */

/**
 * Method used to process GET 'assets/migrations/:migrationId' endpoint of REST API
 * @this {Object}
 * @property {Object} urlParams
 * @property {string} urlParam.migrationId ID of the asset migration
 * @return {assetMigrationOutcomeAPIResponse}
 */
export function assetMigrationOutcome() {
    try {
        // Process request parameters
        let invalidParams = [];

        // From URL
        //
        // migrationId param
        if (!(typeof this.urlParams.migrationId === 'string' && this.urlParams.migrationId.length > 0)) {
            Catenis.logger.DEBUG('Invalid \'migrationId\' parameter for GET \'assets/migrations/:migrationId\' API request', this.urlParams);
            invalidParams.push('migrationId');
        }

        if (invalidParams.length > 0) {
            return errorResponse.call(this, 400, `Invalid parameters: ${invalidParams.join(', ')}`);
        }

        // Make sure that system is running and accepting API calls
        if (!Catenis.application.isRunning()) {
            Catenis.logger.DEBUG('System currently not available for fulfilling GET \'assets/migrations/:migrationId\' API request', {applicationStatus: Catenis.application.status});
            return errorResponse.call(this, 503, 'System currently not available; please try again at a later time');
        }

        // Execute method to get asset migration outcome
        let assetMigration;

        try {
            assetMigration = this.user.device.getAssetMigrationOutcome(this.urlParams.migrationId);
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
                else if (err.error === 'ctn_asset_mgr_not_found') {
                    error = errorResponse.call(this, 400, 'Invalid asset migration ID');
                }
                else if (err.error === 'ctn_device_not_asset_mgr_owner') {
                    error = errorResponse.call(this, 403, 'No permission to retrieve asset migration outcome');
                }
                else {
                    error = errorResponse.call(this, 500, 'Internal server error');
                }
            }
            else {
                error = errorResponse.call(this, 500, 'Internal server error');
            }

            if (error.statusCode === 500) {
                Catenis.logger.ERROR('Error processing GET \'assets/migrations/:migrationId\' API request.', err);
            }

            return error;
        }

        return successResponse.call(this, {
            assetMigration
        });
    }
    catch (err) {
        Catenis.logger.ERROR('Error processing GET \'assets/migrations/:migrationId\' API request.', err);
        return errorResponse.call(this, 500, 'Internal server error');
    }
}
