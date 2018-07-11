/**
 * Created by Claudio on 2018-03-29.
 */

//console.log('[ApiAssetHolders.js]: This code just ran.');

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
import {
    cfgSettings as assetCfgSetting
} from './Asset';

// Config entries
/*const config_entryConfig = config.get('config_entry');

 // Configuration settings
 const cfgSettings = {
 property: config_entryConfig.get('property_name')
 };*/


// Definition of module (private) functions
//

// Method used to process GET 'assets/:assetId/holders' endpoint of Rest API
//
//  URL parameters:
//    assetId [String] - ID of asset to retrieve issuance history
//
//  Query string (optional) parameters:
//    limit: [Number] - (default: 'maxRetListEntries') Maximum number of list items that should be returned
//    skip: [Number] - (default: 0) Number of list items that should be skipped (from beginning of list) and not returned
//
//  Success data returned: {
//    "assetHolders": [{ - A list of asset holder objects
//      "holder": {
//        "deviceId": [String]     - ID of device that holds an amount of the asset
//        "name": [String],        - (only returned if defined and device that issued the request has permission to access this device's main props) The name of the device
//        "prodUniqueId": [String] - (only returned if defined and device that issued the request has permission to access this device's main props) The product unique ID of the device
//      },
//      "balance": {
//        "total": [Number],      - The current balance of that asset held by this device (expressed as a decimal number)
//        "unconfirmed": [Number] - The amount from of the balance that is not yet confirmed
//      }
//    }],
//    "hasMore": [Boolean] - Indicates whether there are more entries that have not been included in the return list
//  }
export function listAssetHolders() {
    try {
        // Process request parameters

        // From URL
        //
        // assetId param
        if (!(typeof this.urlParams.assetId === 'string' && this.urlParams.assetId.length > 0)) {
            Catenis.logger.DEBUG('Invalid \'assetId\' parameter for GET \'assets/:assetId/holders\' API request', this.urlParams);
            return errorResponse.call(this, 400, 'Invalid parameters');
        }

        // From query string
        //
        // limit param
        let limit;

        if (!(typeof this.queryParams.limit === 'undefined' || (!Number.isNaN(limit = Number.parseInt(this.queryParams.limit)) && isValidLimit(limit)))) {
            Catenis.logger.DEBUG('Invalid \'limit\' parameter for GET \'assets/:assetId/holders\' API request', this.queryParams);
            return errorResponse.call(this, 400, 'Invalid parameters');
        }

        // skip param
        let skip;

        if (!(typeof this.queryParams.skip === 'undefined' || (!Number.isNaN(skip = Number.parseInt(this.queryParams.skip)) && isValidSkip(skip)))) {
            Catenis.logger.DEBUG('Invalid \'skip\' parameter for GET \'assets/:assetId/holders\' API request', this.queryParams);
            return errorResponse.call(this, 400, 'Invalid parameters');
        }

        // Make sure that system is running and accepting API calls
        if (!Catenis.application.isRunning()) {
            Catenis.logger.DEBUG('System currently not available for fulfilling GET \'assets/:assetId/holders\' API request', {applicationStatus: Catenis.application.status});
            return errorResponse.call(this, 503, 'System currently not available; please try again at a later time');
        }

        // Execute method to list asset holders
        let result;

        try {
            result = this.user.device.listAssetHolders(this.urlParams.assetId, limit, skip);
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
                    error = errorResponse.call(this, 403, 'No permission to list asset holders');
                }
                else {
                    error = errorResponse.call(this, 500, 'Internal server error');
                }
            }
            else {
                error = errorResponse.call(this, 500, 'Internal server error');
            }

            if (error.statusCode === 500) {
                Catenis.logger.ERROR('Error processing GET \'assets/:assetId/holders\' API request.', err);
            }

            return error;
        }

        // Return success
        return successResponse.call(this, result);
    }
    catch (err) {
        Catenis.logger.ERROR('Error processing GET \'assets/:assetId/holders\' API request.', err);
        return errorResponse.call(this, 500, 'Internal server error');
    }
}

function isValidLimit(num) {
    return num > 0 && num <= assetCfgSetting.maxRetListEntries;
}

function isValidSkip(num) {
    return num >= 0;
}
