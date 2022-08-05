/**
 * Created by claudio on 2022-07-19
 */

//console.log('[ApiTransferNonFungibleToken.js]: This code just ran.');

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
 * @typedef {Object} NFTokenTransferResult
 * @property {string} [tokenTransferId] The token transfer ID to be used for querying the progress of the non-fungible
 *                                       token transfer. Only returned when doing the processing asynchronously
 * @property {boolean} [success] The value true indicating that the non-fungible token has been successfully transferred
 */

/**
 * @typedef {Object} TransferNonFungibleTokenAPIResponse
 * @property {number} statusCode
 * @property {Object} headers
 * @property {Object} body
 * @property {string} body.status
 * @property {string} [body.message]
 * @property {NFTokenTransferResult} [body.data]
 */

/**
 * @typedef {Object} ReceivingDeviceIdInfo
 * @property {string} id
 * @property {boolean} [isProdUniqueId=false]
 */

/**
 * Method used to process POST 'assets/non-fungible/tokens/:tokenId/transfer' endpoint of REST API
 * @this {Object}
 * @property {Object} urlParams
 * @property {string} urlParams.tokenId The external ID of the non-fungible token to transfer
 * @property {Object} bodyParams
 * @property {string} [bodyParams.receivingDevice] The Catenis virtual device that will receive the non-fungible token
 *                                                  being transferred
 * @property {boolean} [bodyParams.async=false] Indicates whether processing should be done asynchronously
 * @return {TransferNonFungibleTokenAPIResponse}
 */
export function transferNonFungibleToken() {
    try {
        // Process request parameters
        let invalidParams = [];

        // From URL
        //
        // tokenId param
        if (!Util.isNonBlankString(this.urlParams.tokenId)) {
            Catenis.logger.DEBUG('Invalid \'tokenId\' parameter for POST \'assets/non-fungible/tokens/:tokenId/transfer\' API request', this.urlParams);
            invalidParams.push('tokenId');
        }

        // From payload
        //
        // receivingDevice param
        let receivingDeviceId = this.user.device.deviceId;

        if (Util.isNonNullObject(this.bodyParams.receivingDevice)) {
            // receivingDevice.id param
            let invalidReceivingDeviceId = false;

            if (!(typeof this.bodyParams.receivingDevice.id === 'string' && this.bodyParams.receivingDevice.id.length > 0)) {
                Catenis.logger.DEBUG('Invalid \'receivingDevice.id\' parameter POST for \'assets/non-fungible/tokens/:tokenId/transfer\' API request', this.bodyParams);
                invalidParams.push('receivingDevice.id');
                invalidReceivingDeviceId = true;
            }

            // receivingDevice.isProdUniqueId param
            let isProdUniqueId = false;

            if (typeof this.bodyParams.receivingDevice.isProdUniqueId === 'boolean') {
                isProdUniqueId = this.bodyParams.receivingDevice.isProdUniqueId;
            }
            else if (this.bodyParams.receivingDevice.isProdUniqueId !== undefined) {
                Catenis.logger.DEBUG('Invalid \'receivingDevice.isProdUniqueId\' parameter POST for \'assets/non-fungible/tokens/:tokenId/transfer\' API request', this.bodyParams);
                invalidParams.push('receivingDevice.isProdUniqueId');
            }

            if (!invalidReceivingDeviceId) {
                // Prepare receiving device ID
                receivingDeviceId = this.bodyParams.receivingDevice.id;

                if (isProdUniqueId) {
                    let receivingDevice;

                    try {
                        receivingDevice = Device.getDeviceByProductUniqueId(this.bodyParams.receivingDevice.id, false);
                    }
                    catch (err) {
                        let error;

                        if ((err instanceof Meteor.Error) && err.error === 'ctn_device_not_found') {
                            error = errorResponse.call(this, 400, 'Invalid receiving device');
                        }
                        else {
                            error = errorResponse.call(this, 500, 'Internal server error');
                            Catenis.logger.ERROR('Error processing POST \'assets/non-fungible/tokens/:tokenId/transfer\' API request.', err);
                        }

                        return error;
                    }

                    receivingDeviceId = receivingDevice.deviceId;
                }
            }
        }
        else if (this.bodyParams.receivingDevice !== undefined) {
            Catenis.logger.DEBUG('Invalid \'receivingDevice\' parameter POST for \'assets/non-fungible/tokens/:tokenId/transfer\' API request', this.bodyParams);
            invalidParams.push('receivingDevice');
        }

        // async param
        let asyncProc = false;

        if (typeof this.bodyParams.async === 'boolean') {
            asyncProc = this.bodyParams.async;
        }
        else if (this.bodyParams.async !== undefined) {
            Catenis.logger.DEBUG('Invalid \'async\' parameter for POST \'assets/non-fungible/tokens/:tokenId/transfer\' API request', this.bodyParams);
            invalidParams.push('async');
        }

        if (invalidParams.length > 0) {
            return errorResponse.call(this, 400, `Invalid parameters: ${invalidParams.join(', ')}`);
        }

        // Make sure that system is running and accepting API calls
        if (!Catenis.application.isRunning()) {
            Catenis.logger.DEBUG(
                'System currently not available for fulfilling POST \'assets/non-fungible/tokens/:tokenId/transfer\' API request',
                {
                    applicationStatus: Catenis.application.status
                }
            );
            return errorResponse.call(this, 503, 'System currently not available; please try again at a later time');
        }

        // Execute method to transfer non-fungible token
        let result;

        try {
            result = this.user.device.transferNonFungibleToken(this.urlParams.tokenId, receivingDeviceId, asyncProc);
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
                else if (err.error === 'ctn_device_recv_dev_not_found' || err.error === 'ctn_device_recv_dev_deleted'
                        || err.error === 'ctn_device_recv_dev_not_active') {
                    error = errorResponse.call(this, 400, 'Invalid receiving device');
                }
                else if (err.error === 'ctn_device_no_permission') {
                    error = errorResponse.call(this, 403, 'No permission to transfer non-fungible token to receiving device');
                }
                if (err.error === 'ctn_device_low_service_acc_balance') {
                    error = errorResponse.call(this, 400, 'Not enough credits to pay for transfer non-fungible token service');
                }
                else if (err.error === 'ctn_transfer_nft_invalid_cc_id' ||  err.error === 'ctn_transfer_nft_burnt_token'
                        || err.error === 'ctn_transfer_nft_invalid_addr') {
                    error = errorResponse.call(this, 400, 'Unavailable or inconsistent non-fungible token');
                }
                else if (err.error === 'ctn_transfer_nft_not_holder' || err.error === 'ctn_transf_nft_utxo_not_found') {
                    error = errorResponse.call(this, 400, 'No possession to transfer non-fungible token');
                }
            }
            else {
                error = errorResponse.call(this, 500, 'Internal server error');
            }

            if (error.statusCode === 500) {
                Catenis.logger.ERROR('Error processing POST \'assets/non-fungible/tokens/:tokenId/transfer\' API request.', err);
            }

            return error;
        }

        // Return success
        return successResponse.call(this, result);
    }
    catch (err) {
        Catenis.logger.ERROR('Error processing POST \'assets/non-fungible/tokens/:tokenId/transfer\' API request.', err);
        return errorResponse.call(this, 500, 'Internal server error');
    }
}
