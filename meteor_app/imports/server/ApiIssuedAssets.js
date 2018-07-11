/**
 * Created by Claudio on 2018-03-28.
 */

//console.log('[ApiIssuedAssets.js]: This code just ran.');

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

// Method used to process GET 'assets/issued' endpoint of Rest API
//
//  Query string (optional) parameters:
//    limit: [Number] - (default: 'maxRetListEntries') Maximum number of list items that should be returned
//    skip: [Number] - (default: 0) Number of list items that should be skipped (from beginning of list) and not returned
//
//  Success data returned: {
//    "issuedAssets": [{ - A list of issued asset objects
//      "assetId": [String] - The ID of the asset
//      "totalExistentBalance": [Number] - The current total balance of that asset in existence (expressed as a fractional amount)
//    }],
//    "hasMore": [Boolean] - Indicates whether there are more entries that have not been included in the returned list
//  }
export function listIssuedAssets() {
    try {
        // Process request parameters

        // From query string
        //
        // limit param
        let limit;

        if (!(typeof this.queryParams.limit === 'undefined' || (!Number.isNaN(limit = Number.parseInt(this.queryParams.limit)) && isValidLimit(limit)))) {
            Catenis.logger.DEBUG('Invalid \'limit\' parameter for GET \'assets/issued\' API request', this.queryParams);
            return errorResponse.call(this, 400, 'Invalid parameters');
        }

        // skip param
        let skip;

        if (!(typeof this.queryParams.skip === 'undefined' || (!Number.isNaN(skip = Number.parseInt(this.queryParams.skip)) && isValidSkip(skip)))) {
            Catenis.logger.DEBUG('Invalid \'skip\' parameter for GET \'assets/issued\' API request', this.queryParams);
            return errorResponse.call(this, 400, 'Invalid parameters');
        }

        // Make sure that system is running and accepting API calls
        if (!Catenis.application.isRunning()) {
            Catenis.logger.DEBUG('System currently not available for fulfilling GET \'assets/issued\' API request', {applicationStatus: Catenis.application.status});
            return errorResponse.call(this, 503, 'System currently not available; please try again at a later time');
        }

        // Execute method to list issued assets
        let result;

        try {
            result = this.user.device.listIssuedAssets(limit, skip);
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
                else {
                    error = errorResponse.call(this, 500, 'Internal server error');
                }
            }
            else {
                error = errorResponse.call(this, 500, 'Internal server error');
            }

            if (error.statusCode === 500) {
                Catenis.logger.ERROR('Error processing GET \'assets/issued\' API request.', err);
            }

            return error;
        }

        // Return success
        return successResponse.call(this, result);
    }
    catch (err) {
        Catenis.logger.ERROR('Error processing GET \'assets/issued\' API request.', err);
        return errorResponse.call(this, 500, 'Internal server error');
    }
}

function isValidLimit(num) {
    return num > 0 && num <= assetCfgSetting.maxRetListEntries;
}

function isValidSkip(num) {
    return num >= 0;
}
