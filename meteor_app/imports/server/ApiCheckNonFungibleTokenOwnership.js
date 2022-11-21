/**
 * Created by claudio on 2022-11-18
 */

//console.log('[ApiCheckNonFungibleTokenOwnership.js]: This code just ran.');

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
import { Device } from './Device';


// Definition of module (private) functions
//

/**
 * @typedef {Object} NFTokenOwnershipCheckResult
 * @property {number} tokensOwned Number of non-fungible tokens, out of those that have been verified, that are owned by
 *                                 the specified Catenis virtual device
 */

/**
 * @typedef {Object} CheckNonFungibleTokenOwnershipAPIResponse
 * @property {number} statusCode
 * @property {Object} headers
 * @property {Object} body
 * @property {string} body.status
 * @property {string} [body.message]
 * @property {NFTokenOwnershipCheckResult} [body.data]
 */

/**
 * @typedef {Object} CheckDeviceIdInfo
 * @property {string} id The ID used to identify the Catenis virtual device
 * @property {boolean} [isProdUniqueId=false] Indicates whether the specified ID is a product unique ID. Otherwise, it
 *                                             should be interpreted as a device ID
 */

/**
 * @typedef {Object} CheckNonFungibleTokensIdInfo
 * @property {string} id Either the ID of the single non-fungible token to be verified, or the ID of the non-fungible
 *                        asset the non-fungible tokens of which should be verified
 * @property {boolean} [isAssetId=false] Indicates whether the specified ID is a non-fungible asset ID. Otherwise, it
 *                                        should be interpreted as a non-fungible token ID
 */

/**
 * Method used to process POST 'assets/non-fungible/tokens/ownership' endpoint of REST API
 * @this {Object}
 * @property {Object} bodyParams
 * @property {CheckDeviceIdInfo} bodyParams.device The Catenis virtual device to check if it has ownership
 * @property {CheckNonFungibleTokensIdInfo} bodyParams.nonFungibleTokens The non-fungible tokens to be verified
 * @return {CheckNonFungibleTokenOwnershipAPIResponse}
 */
export function checkNonFungibleTokenOwnership() {
    try {
        // Process request parameters
        let invalidParams = [];

        // From payload
        //
        // device param
        let deviceId;

        if (Util.isNonNullObject(this.bodyParams.device)) {
            // device.id param
            let invalidDeviceId = false;

            if (!(typeof this.bodyParams.device.id === 'string' && this.bodyParams.device.id.length > 0)) {
                Catenis.logger.DEBUG('Invalid \'device.id\' parameter POST for \'assets/non-fungible/tokens/ownership\' API request', this.bodyParams);
                invalidParams.push('device.id');
                invalidDeviceId = true;
            }

            // device.isProdUniqueId param
            let isProdUniqueId = false;

            if (typeof this.bodyParams.device.isProdUniqueId === 'boolean') {
                isProdUniqueId = this.bodyParams.device.isProdUniqueId;
            }
            else if (this.bodyParams.device.isProdUniqueId !== undefined) {
                Catenis.logger.DEBUG('Invalid \'device.isProdUniqueId\' parameter POST for \'assets/non-fungible/tokens/ownership\' API request', this.bodyParams);
                invalidParams.push('device.isProdUniqueId');
            }

            if (!invalidDeviceId) {
                // Prepare receiving device ID
                deviceId = this.bodyParams.device.id;

                if (isProdUniqueId) {
                    let device;

                    try {
                        device = Device.getDeviceByProductUniqueId(this.bodyParams.device.id, false);
                    }
                    catch (err) {
                        let error;

                        if ((err instanceof Meteor.Error) && err.error === 'ctn_device_not_found') {
                            error = errorResponse.call(this, 400, 'Invalid device');
                        }
                        else {
                            error = errorResponse.call(this, 500, 'Internal server error');
                            Catenis.logger.ERROR('Error processing POST \'assets/non-fungible/tokens/ownership\' API request.', err);
                        }

                        return error;
                    }

                    deviceId = device.deviceId;
                }
            }
        }
        else {
            Catenis.logger.DEBUG('Invalid \'device\' parameter POST for \'assets/non-fungible/tokens/ownership\' API request', this.bodyParams);
            invalidParams.push('device');
        }

        // nonFungibleTokens param
        let isAssetId = false;

        if (Util.isNonNullObject(this.bodyParams.nonFungibleTokens)) {
            // nonFungibleTokens.id param
            if (!(typeof this.bodyParams.nonFungibleTokens.id === 'string' && this.bodyParams.nonFungibleTokens.id.length > 0)) {
                Catenis.logger.DEBUG('Invalid \'nonFungibleTokens.id\' parameter POST for \'assets/non-fungible/tokens/ownership\' API request', this.bodyParams);
                invalidParams.push('nonFungibleTokens.id');
            }

            // nonFungibleTokens.isAssetId param
            if (typeof this.bodyParams.nonFungibleTokens.isAssetId === 'boolean') {
                isAssetId = this.bodyParams.nonFungibleTokens.isAssetId;
            }
            else if (this.bodyParams.nonFungibleTokens.isAssetId !== undefined) {
                Catenis.logger.DEBUG('Invalid \'nonFungibleTokens.isAssetId\' parameter POST for \'assets/non-fungible/tokens/ownership\' API request', this.bodyParams);
                invalidParams.push('nonFungibleTokens.isAssetId');
            }
        }
        else {
            Catenis.logger.DEBUG('Invalid \'nonFungibleTokens\' parameter POST for \'assets/non-fungible/tokens/ownership\' API request', this.bodyParams);
            invalidParams.push('nonFungibleTokens');
        }

        if (invalidParams.length > 0) {
            return errorResponse.call(this, 400, `Invalid parameters: ${invalidParams.join(', ')}`);
        }

        // Make sure that system is running and accepting API calls
        if (!Catenis.application.isRunning()) {
            Catenis.logger.DEBUG('System currently not available for fulfilling POST \'assets/non-fungible/tokens/ownership\' API request', {applicationStatus: Catenis.application.status});
            return errorResponse.call(this, 503, 'System currently not available; please try again at a later time');
        }

        // Execute method to check non-fungible token ownership
        let nfTokensOwned;

        try {
            nfTokensOwned = this.user.device.checkNonFungibleTokenOwnership(deviceId, this.bodyParams.nonFungibleTokens.id, isAssetId);
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
                else if (err.error === 'ctn_chk_nft_owner_dev_not_found') {
                    error = errorResponse.call(this, 400, 'Invalid device');
                }
                else if (err.error === 'ctn_asset_not_found') {
                    error = errorResponse.call(this, 400, 'Invalid asset ID');
                }
                else if (err.error === 'ctn_chk_nft_owner_asset_fungible') {
                    error = errorResponse.call(this, 400, 'Not a non-fungible asset');
                }
                else if (err.error === 'ctn_chk_nft_owner_no_access') {
                    error = errorResponse.call(this, 403, 'No permission to check non-fungible token ownership');
                }
                else if (err.error === 'ctn_chk_nft_owner_invalid_cc_asset_id') {
                    error = errorResponse.call(this, 400, 'Unavailable or inconsistent non-fungible asset');
                }
                else if (err.error === 'nf_token_invalid_id') {
                    error = errorResponse.call(this, 400, 'Invalid non-fungible token ID');
                }
                else if (err.error === 'ctn_chk_nft_owner_invalid_cc_token_id') {
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
                Catenis.logger.ERROR('Error processing POST \'assets/non-fungible/tokens/ownership\' API request.', err);
            }

            return error;
        }

        // Return success
        return successResponse.call(this, {
            tokensOwned: nfTokensOwned
        });
    }
    catch (err) {
        Catenis.logger.ERROR('Error processing POST \'assets/non-fungible/tokens/ownership\' API request.', err);
        return errorResponse.call(this, 500, 'Internal server error');
    }
}
