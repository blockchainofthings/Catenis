/**
 * Created by claudio on 28/03/18.
 */

//console.log('[ApiAssetInfo.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//  NOTE: the reference of these modules are done sing 'require()' instead of 'import' to
//      to avoid annoying WebStorm warning message: 'default export is not defined in
//      imported module'
//const util = require('util');
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

// Config entries
/*const config_entryConfig = config.get('config_entry');

 // Configuration settings
 const cfgSettings = {
 property: config_entryConfig.get('property_name')
 };*/


// Definition of module (private) functions
//

// Method used to process GET 'assets/:assetId' endpoint of Rest API
//
//  URL parameters:
//    assetId [String] - ID of asset to retrieve information
//
//  Success data returned: {
//    "assetId": [String],        - The ID of the asset
//    "name": [String],           - The name of the asset
//    "description": [String],    - The description of the asset
//    "canReissue": [Boolean],    - Indicates whether more units of this asset can be reissued
//    "decimalPlaces": [Number],  - The maximum number of decimal places that can be used to represent a fractional amount of this asset
//    "issuer": {
//      "deviceId": [String],  - The ID of the device that issued this asset
//      "name": [String],      - (only returned if defined and device that issued the request has permission to access this device's main props) The name of the device
//      "prodUniqueId": [String] - (only returned if defined and device that issued the request has permission to access this device's main props) The product unique ID of the device
//    },
//    "totalExistentBalance": [Number] - The current total balance of the asset in existence (expressed as a fractional amount)
//  }
export function retrieveAssetInfo() {
    try {
        // Process request parameters

        // From URL
        //
        // assetId param
        if (!(typeof this.urlParams.assetId === 'string' && this.urlParams.assetId.length > 0)) {
            Catenis.logger.DEBUG('Invalid \'assetId\' parameter for GET \'assets/:assetId\' API request', this.urlParams);
            return errorResponse.call(this, 400, 'Invalid parameters');
        }

        // Make sure that system is running and accepting API calls
        if (!Catenis.application.isRunning()) {
            Catenis.logger.DEBUG('System currently not available for fulfilling GET \'assets/:assetId\' API request', {applicationStatus: Catenis.application.status});
            return errorResponse.call(this, 503, 'System currently not available; please try again at a later time');
        }

        // Execute method to retrieve asset info
        let result;

        try {
            result = this.user.device.retrieveAssetInfo(this.urlParams.assetId);
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
