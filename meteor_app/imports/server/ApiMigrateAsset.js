/**
 * Created by claudio on 2021-07-14
 */

//console.log('[ApiMigrateAsset.js]: This code just ran.');

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
import { AssetMigration } from './AssetMigration';
import { Util } from './Util';


// Definition of module (private) functions
//

/**
 * @typedef {Object} migrateAssetAPIResponse
 * @property {number} statusCode
 * @property {Object} headers
 * @property {Object} body
 * @property {string} body.status
 * @property {string} [body.message]
 * @property {Object} [body.data]
 * @property {AssetMigrationOutcome} [body.data.assetMigration]
 * @property {string} [body.data.estimatedPrice]
 */

/**
 * Method used to process POST 'assets/:assetId/migrate/:foreignBlockchain' endpoint of REST API
 * @this {Object}
 * @property {Object} urlParams
 * @property {string} urlParam.assetId ID of asset to migrate
 * @property {string} urlParam.foreignBlockchain Name of the foreign blockchain
 * @property {Object} bodyParams
 * @property {(Object|string)} bodyParams.migration
 * @property {string} bodyParams.migration.direction The migration direction
 * @property {number} bodyParams.migration.amount The amount (expressed as a decimal number) of the asset to be migrated
 * @property {string} [bodyParams.migration.destAddress] The address of the account on the foreign blockchain that
 *                                          should received the migrated amount (of the corresponding foreign token)
 * @property {Object} [bodyParams.options]
 * @property {string} [bodyParams.options.consumptionProfile] Name of foreign blockchain native coin consumption profile
 *                                                             to use
 * @property {boolean} [bodyParams.options.estimateOnly] Indicates that no asset migration should be done. Instead, only
 *                                          the estimated price (in the foreign blockchain's native coin) to fulfill the
 *                                          operation should be returned
 * @return {migrateAssetAPIResponse}
 */
export function migrateAsset() {
    try {
        // Process request parameters
        let invalidParams = [];

        // From URL
        //
        // assetId param
        if (!(typeof this.urlParams.assetId === 'string' && this.urlParams.assetId.length > 0)) {
            Catenis.logger.DEBUG('Invalid \'assetId\' parameter for POST \'assets/:assetId/migrate/:foreignBlockchain\' API request', this.urlParams);
            invalidParams.push('assetId');
        }

        // foreignBlockchain param
        if (!(typeof this.urlParams.foreignBlockchain === 'string' && this.urlParams.foreignBlockchain.length > 0
                && ForeignBlockchain.isValidKey(this.urlParams.foreignBlockchain))) {
            Catenis.logger.DEBUG('Invalid \'foreignBlockchain\' parameter for POST \'assets/:assetId/migrate/:foreignBlockchain\' API request', this.urlParams);
            invalidParams.push('foreignBlockchain');
        }

        // From payload
        //
        // migration param
        if (Util.isNonNullObject(this.bodyParams.migration)) {
            // migration.direction param
            if (!(typeof this.bodyParams.migration.direction === 'string'
                    && this.bodyParams.migration.direction.length > 0
                    && AssetMigration.isValidDirection(this.bodyParams.migration.direction))) {
                Catenis.logger.DEBUG('Invalid \'migration.direction\' parameter POST for \'assets/:assetId/migrate/:foreignBlockchain\' API request', this.bodyParams);
                invalidParams.push('migration.direction');
            }

            // migration.amount param
            if (!(typeof this.bodyParams.migration.amount === 'number' && this.bodyParams.migration.amount > 0)) {
                Catenis.logger.DEBUG('Invalid \'migration.amount\' parameter POST for \'assets/:assetId/migrate/:foreignBlockchain\' API request', this.bodyParams);
                invalidParams.push('migration.amount');
            }
            
            // migration.destAddress param
            if (!((this.bodyParams.migration.direction !== AssetMigration.migrationDirection.outward
                    && this.bodyParams.migration.destAddress === undefined)
                    || (typeof this.bodyParams.migration.destAddress === 'string'
                    && this.bodyParams.migration.destAddress.length > 0))) {
                Catenis.logger.DEBUG('Invalid \'migration.destAddress\' parameter POST for \'assets/:assetId/migrate/:foreignBlockchain\' API request', this.bodyParams);
                invalidParams.push('migration.destAddress');
            }
        }
        else if (!(typeof this.bodyParams.migration === 'string' && this.bodyParams.migration.length > 0)) {
            Catenis.logger.DEBUG('Invalid \'migration\' parameter POST for \'assets/:assetId/migrate/:foreignBlockchain\' API request', this.bodyParams);
            invalidParams.push('migration');
        }

        // options param
        if (Util.isNonNullObject(this.bodyParams.options)) {
            // options.consumptionProfile param
            if (!(this.bodyParams.options.consumptionProfile === undefined ||
                    (typeof this.bodyParams.options.consumptionProfile === 'string'
                    && this.bodyParams.options.consumptionProfile.length > 0
                    && ForeignBlockchain.isValidConsumptionProfileName(this.bodyParams.options.consumptionProfile)))) {
                Catenis.logger.DEBUG('Invalid \'options.consumptionProfile\' parameter POST for \'assets/:assetId/migrate/:foreignBlockchain\' API request', this.bodyParams);
                invalidParams.push('options.consumptionProfile');
            }

            // options.estimateOnly param
            if (!(this.bodyParams.options.estimateOnly === undefined
                    || typeof this.bodyParams.options.estimateOnly === 'boolean')) {
                Catenis.logger.DEBUG('Invalid \'options.estimateOnly\' parameter POST for \'assets/:assetId/migrate/:foreignBlockchain\' API request', this.bodyParams);
                invalidParams.push('options.estimateOnly');
            }
        }
        else if (this.bodyParams.options !== undefined) {
            Catenis.logger.DEBUG('Invalid \'options\' parameter POST for \'assets/:assetId/migrate/:foreignBlockchain\' API request', this.bodyParams);
            invalidParams.push('options');
        }

        if (invalidParams.length > 0) {
            return errorResponse.call(this, 400, `Invalid parameters: ${invalidParams.join(', ')}`);
        }

        // Make sure that system is running and accepting API calls
        if (!Catenis.application.isRunning()) {
            Catenis.logger.DEBUG('System currently not available for fulfilling POST \'assets/:assetId/migrate/:foreignBlockchain\' API request', {applicationStatus: Catenis.application.status});
            return errorResponse.call(this, 503, 'System currently not available; please try again at a later time');
        }

        // Execute method to migrate asset
        let migrationResult;

        try {
            migrationResult = this.user.device.migrateAsset(
                this.urlParams.assetId,
                this.urlParams.foreignBlockchain,
                this.bodyParams.migration,
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
                else if (err.error === 'ctn_device_not_exp_asset_owner') {
                    error = errorResponse.call(this, 403, 'No permission to migrate asset');
                }
                else if (err.error === 'ctn_asset_mgr_not_found') {
                    error = errorResponse.call(this, 400, 'Invalid asset migration ID');
                }
                else if (err.error === 'ctn_asset_mgr_invalid_dest_address') {
                    error = errorResponse.call(this, 400, 'Invalid foreign blockchain destination address');
                }
                else if (err.error === 'ctn_exp_asset_not_found' || err.error === 'ctn_asset_mgr_not_exported') {
                    error = errorResponse.call(this, 400, 'Asset is not yet exported');
                }
                else if (err.error === 'ctn_asset_mgr_amount_too_large') {
                    error = errorResponse.call(this, 400, 'Amount to transfer is too large');
                }
                else if (err.error === 'ctn_device_mismatched_asset_migration') {
                    error = errorResponse.call(this, 400, 'Mismatched asset migration');
                }
                else if (err.error === 'ctn_asset_mgr_already_migrated') {
                    error = errorResponse.call(this, 400, 'Asset migration already successfully processed');
                }
                else if (err.error === 'ctn_asset_mgr_low_foreign_bc_funds') {
                    // Foreign blockchain funds not enough to cover transaction execution price (<value>)
                    error = errorResponse.call(this, 400, err.reason);
                }
                else if (err.error === 'ctn_asset_mgr_low_token_balance') {
                    error = errorResponse.call(this, 400, 'Foreign token balance too low to in-migrate the asset amount');
                }
                else if (err.error === 'ctn_asset_mgr_low_mgr_asset_balance') {
                    error = errorResponse.call(this, 400, 'Insufficient migrated asset amount to in-migrate asset');
                }
                else if (err.error === 'ctn_asset_mgr_discarded_token_call') {
                    error = errorResponse.call(this, 400, 'Discarded concurrent foreign token smart contract call');
                }
                else if (err.error === 'ctn_asset_mgr_token_call_error') {
                    error = errorResponse.call(this, 400, 'Unexpected error calling foreign token smart contract');
                }
                else if (err.error === 'ctn_asset_mgr_low_service_acc_balance') {
                    error = errorResponse.call(this, 400, 'Not enough credits to pay for migrate asset service');
                }
                else if (err.error === 'ctn_asset_mgr_low_asset_balance' || err.error === 'ctn_out_mgr_low_asset_balance') {
                    error = errorResponse.call(this, 400, 'Insufficient balance to out-migrate asset');
                }
                else {
                    error = errorResponse.call(this, 500, 'Internal server error');
                }
            }
            else {
                error = errorResponse.call(this, 500, 'Internal server error');
            }

            if (error.statusCode === 500) {
                Catenis.logger.ERROR('Error processing POST \'assets/:assetId/migrate/:foreignBlockchain\' API request.', err);
            }

            return error;
        }

        // Return success
        const data = this.bodyParams.options && this.bodyParams.options.estimateOnly
            ? {estimatedPrice: migrationResult}
            : {assetMigration: migrationResult};

        return successResponse.call(this, data);
    }
    catch (err) {
        Catenis.logger.ERROR('Error processing POST \'assets/:assetId/migrate/:foreignBlockchain\' API request.', err);
        return errorResponse.call(this, 500, 'Internal server error');
    }
}
