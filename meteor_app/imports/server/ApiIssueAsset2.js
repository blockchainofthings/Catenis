/**
 * Created by Claudio on 2021-08-02.
 */

//console.log('[ApiIssueAsset2.js]: This code just ran.');

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
import { CCTransaction } from './CCTransaction';
import { Util } from './Util';

// Config entries
/*const config_entryConfig = config.get('config_entry');

 // Configuration settings
 const cfgSettings = {
 property: config_entryConfig.get('property_name')
 };*/


// Definition of module (private) functions
//

// Method used to process POST 'assets/issue' endpoint of Rest API
//
//  JSON payload: {
//    "assetInfo": { - Information for creating new asset
//      "name": [String],         - The name of the asset
//      "description": [String],  - (optional) The description of the asset
//      "canReissue": [Boolean],  - Indicates whether more units of this asset can be issued at another time (an unlocked asset)
//      "decimalPlaces": [Number] - The number of decimal places that can be used to specify a fractional amount of this asset
//    },
//    "amount": [Number],      - Amount of asset to be issued (expressed as a fractional amount)
//    "holdingDevice": { - (optional, default: device that issues the request) Device for which the asset is issued and that shall hold the total issued amount
//      "id": [String],               - ID of holding device. Should be a Catenis device ID unless isProdUniqueId is true
//      "isProdUniqueId": [Boolean]   - (optional, default: false) Indicate whether supplied ID is a product unique ID (otherwise,
//                                     it should be a Catenis device Id)
//    }
//  }
//
//  Success data returned: {
//    "assetId": [String]  - ID of newly issued asset
//  }
export function issueAsset2() {
    try {
        // Process request parameters
        let invalidParams = [];

        // From payload
        //
        let holdingDeviceId;

        // holdingDevice param
        if (Util.isNonNullObject(this.bodyParams.holdingDevice)) {
            // holdingDevice.id param
            let invalidHoldingDeviceId = false;

            if (!(typeof this.bodyParams.holdingDevice.id === 'string' && this.bodyParams.holdingDevice.id.length > 0)) {
                Catenis.logger.DEBUG('Invalid \'holdingDevice.id\' parameter POST for \'assets/issue\' API request', this.bodyParams);
                invalidParams.push('holdingDevice.id');
                invalidHoldingDeviceId = true;
            }

            // holdingDevice.isProdUniqueId param
            let isProdUniqueId = false;

            if (typeof this.bodyParams.holdingDevice.isProdUniqueId === 'boolean') {
                isProdUniqueId = this.bodyParams.holdingDevice.isProdUniqueId;
            }
            else if (this.bodyParams.holdingDevice.isProdUniqueId !== undefined) {
                Catenis.logger.DEBUG('Invalid \'holdingDevice.isProdUniqueId\' parameter POST for \'assets/issue\' API request', this.bodyParams);
                invalidParams.push('holdingDevice.isProdUniqueId');
            }

            if (!invalidHoldingDeviceId) {
                // Prepare holding device ID
                holdingDeviceId = this.bodyParams.holdingDevice.id;

                if (isProdUniqueId) {
                    let holdingDevice;

                    try {
                        holdingDevice = Device.getDeviceByProductUniqueId(this.bodyParams.holdingDevice.id, false);
                    }
                    catch (err) {
                        let error;

                        if ((err instanceof Meteor.Error) && err.error === 'ctn_device_not_found') {
                            error = errorResponse.call(this, 400, 'Invalid holding device');
                        }
                        else {
                            error = errorResponse.call(this, 500, 'Internal server error');
                            Catenis.logger.ERROR('Error processing POST \'assets/issue\' API request.', err);
                        }

                        return error;
                    }

                    holdingDeviceId = holdingDevice.deviceId;
                }
            }
        }
        else if (this.bodyParams.holdingDevice !== undefined) {
            Catenis.logger.DEBUG('Invalid \'holdingDevice\' parameter POST for \'assets/issue\' API request', this.bodyParams);
            invalidParams.push('holdingDevice');
        }

        // amount param
        if (!(typeof this.bodyParams.amount === 'number' && isValidIssueAmount(this.bodyParams.amount))) {
            Catenis.logger.DEBUG('Invalid \'amount\' parameter for POST \'assets/issue\' API request', this.bodyParams);
            invalidParams.push('amount');
        }

        // assetInfo param
        if (Util.isNonNullObject(this.bodyParams.assetInfo)) {
            // assetInfo.name param
            if (!(typeof this.bodyParams.assetInfo.name === 'string' && this.bodyParams.assetInfo.name.length > 0)) {
                Catenis.logger.DEBUG('Invalid \'assetInfo.name\' parameter POST for \'assets/issue\' API request', this.bodyParams);
                invalidParams.push('assetInfo.name');
            }

            // assetInfo.description param
            if (!(typeof this.bodyParams.assetInfo.description === 'undefined' || (typeof this.bodyParams.assetInfo.description === 'string'
                && this.bodyParams.assetInfo.description.length > 0))) {
                Catenis.logger.DEBUG('Invalid \'assetInfo.description\' parameter POST for \'assets/issue\' API request', this.bodyParams);
                invalidParams.push('assetInfo.description');
            }

            // assetInfo.canReissue param
            if (typeof this.bodyParams.assetInfo.canReissue !== 'boolean') {
                Catenis.logger.DEBUG('Invalid \'assetInfo.canReissue\' parameter POST for \'assets/issue\' API request', this.bodyParams);
                invalidParams.push('assetInfo.canReissue');
            }

            // assetInfo.decimalPlaces param
            if (!(typeof this.bodyParams.assetInfo.decimalPlaces === 'number' && isValidDecimalPlaces(this.bodyParams.assetInfo.decimalPlaces))) {
                Catenis.logger.DEBUG('Invalid \'assetInfo.decimalPlaces\' parameter POST for \'assets/issue\' API request', this.bodyParams);
                invalidParams.push('assetInfo.decimalPlaces');
            }
        }
        else {
            Catenis.logger.DEBUG('Invalid \'assetInfo\' parameter POST for \'assets/issue\' API request', this.bodyParams);
            invalidParams.push('assetInfo');
        }

        if (invalidParams.length > 0) {
            return errorResponse.call(this, 400, `Invalid parameters: ${invalidParams.join(', ')}`);
        }

        // Make sure that system is running and accepting API calls
        if (!Catenis.application.isRunning()) {
            Catenis.logger.DEBUG('System currently not available for fulfilling POST \'assets/issue\' API request', {applicationStatus: Catenis.application.status});
            return errorResponse.call(this, 503, 'System currently not available; please try again at a later time');
        }

        // Execute method to issue amount of a new asset
        let assetId;

        try {
            assetId = this.user.device.issueAsset(this.bodyParams.amount, this.bodyParams.assetInfo, holdingDeviceId);
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
                else if (err.error === 'ctn_device_hold_dev_deleted' || err.error === 'ctn_device_hold_dev_not_active'
                    || err.error === 'ctn_device_hold_dev_not_found') {
                    error = errorResponse.call(this, 400, 'Invalid holding device');
                }
                else if (err.error === 'ctn_device_no_permission') {
                    error = errorResponse.call(this, 403, 'No permission to assign issued asset to holding device');
                }
                else if (err.error === 'ctn_device_low_service_acc_balance') {
                    error = errorResponse.call(this, 400, 'Not enough credits to pay for issue asset service');
                }
                else if (err.error === 'ctn_issue_asset_amount_too_large') {
                    error = errorResponse.call(this, 400, 'Amount to issue is too large');
                }
                else {
                    error = errorResponse.call(this, 500, 'Internal server error');
                }
            }
            else {
                error = errorResponse.call(this, 500, 'Internal server error');
            }

            if (error.statusCode === 500) {
                Catenis.logger.ERROR('Error processing POST \'assets/issue\' API request.', err);
            }

            return error;
        }

        // Return success
        return successResponse.call(this, {
            assetId: assetId
        });
    }
    catch (err) {
        Catenis.logger.ERROR('Error processing POST \'assets/issue\' API request.', err);
        return errorResponse.call(this, 500, 'Internal server error');
    }
}

function isValidIssueAmount(val) {
    return val > 0;
}

function isValidDecimalPlaces(val) {
    return Number.isInteger(val) && val >= 0 && val <= CCTransaction.largestDivisibility;
}
