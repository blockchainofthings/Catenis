/**
 * Created by Claudio on 2018-03-29.
 */

//console.log('[ApiAssetIssuance.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
//import config from 'config';
import moment from 'moment';
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

// Method used to process GET 'assets/:assetId/issuance' endpoint of Rest API
//
//  URL parameters:
//    assetId [String] - ID of asset to retrieve issuance history
//
//  Query string (optional) parameters:
//   startDate: [String] - ISO 8601 formatted date and time specifying the lower boundary of the time frame
//                          within which the issuance events intended to be retrieved have occurred. The returned
//                          issuance events must have occurred not before that date/time
//   endDate: [String] - ISO 8601 formatted date and time specifying the upper boundary of the time frame
//                        within which the issuance events intended to be retrieved have occurred. The returned
//                        issuance events must have occurred not after that date/time
//
//  Success data returned: {
//    "issuanceEvents": [{ - A list of issuance event objects
//      "amount": [Number],  - The amount of the asset issued (expressed as a decimal number)
//      "holdingDevice": {
//        "deviceId": [String],    - The ID of the device to which the issued asset amount was assigned
//        "name": [String],        - (only returned if defined and device that issued the request has permission to access this device's main props) The name of the device
//        "prodUniqueId": [String] - (only returned if defined and device that issued the request has permission to access this device's main props) The product unique ID of the device
//      },
//      "date": [String] - ISO 8601 formatted date end time when asset issuance took place
//    }],
//    "countExceeded": [Boolean] - Indicates whether the number of asset issuance events that should have been returned
//                                  is greater than the maximum number of asset issuance events that can be returned, and
//                                  for that reason the returned list had been truncated
//  }
export function retrieveAssetIssuanceHistory() {
    try {
        // Process request parameters

        // From URL
        //
        // assetId param
        if (!(typeof this.urlParams.assetId === 'string' && this.urlParams.assetId.length > 0)) {
            Catenis.logger.DEBUG('Invalid \'assetId\' parameter for GET \'assets/:assetId/issuance\' API request', this.urlParams);
            return errorResponse.call(this, 400, 'Invalid parameters');
        }

        // From query string
        //
        // startDate param
        let startDate;
        
        if (this.queryParams.startDate !== undefined) {
            const mt = moment(this.queryParams.startDate, moment.ISO_8601);

            if (mt.isValid()) {
                startDate = mt.toDate();
            }
            else {
                Catenis.logger.DEBUG('Invalid \'startDate\' parameter for GET \'assets/:assetId/issuance\' API request', this.urlParams);
                return errorResponse.call(this, 400, 'Invalid parameters');
            }
        }

        // startDate param
        let endDate;

        if (this.queryParams.endDate !== undefined) {
            const mt = moment(this.queryParams.endDate, moment.ISO_8601);

            if (mt.isValid()) {
                endDate = mt.toDate();
            }
            else {
                Catenis.logger.DEBUG('Invalid \'endDate\' parameter for GET \'assets/:assetId/issuance\' API request', this.urlParams);
                return errorResponse.call(this, 400, 'Invalid parameters');
            }
        }

        // Make sure that system is running and accepting API calls
        if (!Catenis.application.isRunning()) {
            Catenis.logger.DEBUG('System currently not available for fulfilling GET \'assets/:assetId/issuance\' API request', {applicationStatus: Catenis.application.status});
            return errorResponse.call(this, 503, 'System currently not available; please try again at a later time');
        }

        // Execute method to retrieve asset issuance history
        let result;

        try {
            result = this.user.device.retrieveAssetIssuanceHistory(this.urlParams.assetId, startDate, endDate);
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
                    error = errorResponse.call(this, 403, 'No permission to retrieve asset issuance history');
                }
                else {
                    error = errorResponse.call(this, 500, 'Internal server error');
                }
            }
            else {
                error = errorResponse.call(this, 500, 'Internal server error');
            }

            if (error.statusCode === 500) {
                Catenis.logger.ERROR('Error processing GET \'assets/:assetId/issuance\' API request.', err);
            }

            return error;
        }

        // Return success
        return successResponse.call(this, result);
    }
    catch (err) {
        Catenis.logger.ERROR('Error processing GET \'assets/:assetId/issuance\' API request.', err);
        return errorResponse.call(this, 500, 'Internal server error');
    }
}
