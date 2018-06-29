/**
 * Created by claudio on 28/03/18.
 */

//console.log('[ApiTransferAsset.js]: This code just ran.');

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
import { Device } from './Device';
import {
    successResponse,
    errorResponse
} from './RestApi';

// Config entries
/*const config_entryConfig = config.get('config_entry');

 // Configuration settings
 const cfgSettings = {
 property: config_entryConfig.get('property_name')
 };*/


// Definition of module (private) functions
//

// Method used to process POST 'assets/:assetId/transfer' endpoint of Rest API
//
//  URL parameters:
//    assetId [String] - ID of asset to transfer an amount of it
//
//  JSON payload: {
//    amount: [Number],      - Amount of asset to be transferred (expressed as a fractional amount)
//    receivingDevice: { - Device to which the asset is to be transferred
//      id: [String],               - ID of receiving device. Should be a Catenis device ID unless isProdUniqueId is true
//      isProdUniqueId: [Boolean]   - (optional, default: false) Indicate whether supplied ID is a product unique ID (otherwise,
//                                     it should be a Catenis device Id)
//    }
//  }
//
//  Success data returned: {
//    "remainingBalance": [Number] - The total balance of the asset held by the device that issues the request after the transfer (expressed as a decimal number)
//  }
export function transferAsset() {
    try {
        // Process request parameters

        // From URL
        //
        // assetId param
        if (!(typeof this.urlParams.assetId === 'string' && this.urlParams.assetId.length > 0)) {
            Catenis.logger.DEBUG('Invalid \'assetId\' parameter for POST \'assets/:assetId/transfer\' API request', this.urlParams);
            return errorResponse.call(this, 400, 'Invalid parameters');
        }

        // From payload
        //
        // receivingDevice param
        if (!(typeof this.bodyParams.receivingDevice === 'object' && this.bodyParams.receivingDevice !== null)) {
            Catenis.logger.DEBUG('Invalid \'receivingDevice\' parameter POST for \'assets/:assetId/transfer\' API request', this.bodyParams);
            return errorResponse.call(this, 400, 'Invalid parameters');
        }

        // receivingDevice.id param
        if (!(typeof this.bodyParams.receivingDevice.id === 'string' && this.bodyParams.receivingDevice.id.length > 0)) {
            Catenis.logger.DEBUG('Invalid \'receivingDevice.id\' parameter POST for \'assets/:assetId/transfer\' API request', this.bodyParams);
            return errorResponse.call(this, 400, 'Invalid parameters');
        }

        // receivingDevice.isProdUniqueId param
        if (!(typeof this.bodyParams.receivingDevice.isProdUniqueId === 'undefined' || typeof this.bodyParams.receivingDevice.isProdUniqueId === 'boolean')) {
            Catenis.logger.DEBUG('Invalid \'receivingDevice.isProdUniqueId\' parameter POST for \'assets/:assetId/transfer\' API request', this.bodyParams);
            return errorResponse.call(this, 400, 'Invalid parameters');
        }

        // Prepare receiving device ID
        let receivingDeviceId = this.bodyParams.receivingDevice.id;

        if (typeof this.bodyParams.receivingDevice.isProdUniqueId !== 'undefined' && this.bodyParams.receivingDevice.isProdUniqueId) {
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
                    Catenis.logger.ERROR('Error processing POST \'assets/:assetId/transfer\' API request.', err);
                }

                return error;
            }

            receivingDeviceId = receivingDevice.deviceId;
        }

        // amount param
        if (!(typeof this.bodyParams.amount === 'number' && isValidTransferAmount(this.bodyParams.amount))) {
            Catenis.logger.DEBUG('Invalid \'amount\' parameter for POST \'assets/:assetId/transfer\' API request', this.bodyParams);
            return errorResponse.call(this, 400, 'Invalid parameters');
        }

        // Make sure that system is running and accepting API calls
        if (!Catenis.application.isRunning()) {
            Catenis.logger.DEBUG('System currently not available for fulfilling POST \'assets/:assetId/transfer\' API request', {applicationStatus: Catenis.application.status});
            return errorResponse.call(this, 503, 'System currently not available; please try again at a later time');
        }

        // Execute method to transfer an amount of an asset
        let remainingBalance;

        try {
            remainingBalance = this.user.device.transferAsset(receivingDeviceId, this.bodyParams.amount, this.urlParams.assetId);
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
                else if (err.error === 'ctn_device_recv_dev_deleted' || err.error === 'ctn_device_recv_dev_not_active'
                    || err.error === 'ctn_device_recv_dev_not_found') {
                    error = errorResponse.call(this, 400, 'Invalid receiving device');
                }
                else if (err.error === 'ctn_device_no_permission') {
                    error = errorResponse.call(this, 403, 'No permission to transfer asset to receiving device');
                }
                else if (err.error === 'ctn_device_low_service_acc_balance') {
                    error = errorResponse.call(this, 400, 'Not enough credits to pay for transfer asset service');
                }
                else if (err.error === 'ctn_asset_not_found') {
                    error = errorResponse.call(this, 400, 'Invalid asset ID');
                }
                else if (err.error === 'ctn_transf_asset_amount_too_large') {
                    error = errorResponse.call(this, 400, 'Amount to transfer is too large');
                }
                else if (err.error === 'ctn_transf_asset_low_balance') {
                    error = errorResponse.call(this, 400, 'Insufficient balance to transfer asset');
                }
                else {
                    error = errorResponse.call(this, 500, 'Internal server error');
                }
            }
            else {
                error = errorResponse.call(this, 500, 'Internal server error');
            }

            if (error.statusCode === 500) {
                Catenis.logger.ERROR('Error processing POST \'assets/:assetId/transfer\' API request.', err);
            }

            return error;
        }

        // Return success
        return successResponse.call(this, {
            remainingBalance: remainingBalance
        });
    }
    catch (err) {
        Catenis.logger.ERROR('Error processing POST \'assets/:assetId/transfer\' API request.', err);
        return errorResponse.call(this, 500, 'Internal server error');
    }
}

function isValidTransferAmount(val) {
    return val > 0;
}
