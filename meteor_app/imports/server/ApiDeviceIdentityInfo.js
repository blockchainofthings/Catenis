/**
 * Created by claudio on 06/09/17.
 */

//console.log('[ApiDeviceIdentityInfo.js]: This code just ran.');

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
import { Device } from './Device';
import { Permission } from './Permission';
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

// Method used to process GET 'devices/:deviceId' endpoint of Rest API
//
//  URL parameters:
//    deviceId [String]  - ID of the device the identification information of which is to be retrieved. Can optionally be replaced with value "self" to refer to the ID of the device that issued the request
//
//  Query string (optional) parameters:
//    isProdUniqueId: [Boolean] - (default: false) Indicates whether the deviceId parameter should be interpreted as a product unique ID (otherwise, it is interpreted as a Catenis device Id)
//
//  Success data returned: {
//    "catenisNode": {
//      "ctnNodeIndex": [Number] - The index of the Catenis node to where the client that owns the device belongs
//      "name": [String]         - (only returned if not empty) Assigned name of Catentis node
//      "description": [String]  - (only returned if not empty) A short description about the Catenis node
//    },
//    "client": {
//      "clientId": [String] - The Catenis ID of the client that owns the device
//      "name": [String]     - (only returned if not empty) Assigned name of the client
//    },
//    "device": {
//      "deviceId": [String]      - The Catenis ID of the device
//      "name": [String],         - (only returned if not empty) - Assigned name of the device
//      "prodUniqueId": [String]  - (only returned if not empty) - Product unique ID of the device
//    }
//  }
export function retrieveDeviceIdentifyInfo() {
    try {
        // Process request parameters

        // deviceId param
        if (!(typeof this.urlParams.deviceId === 'string' && this.urlParams.deviceId.length > 0)) {
            Catenis.logger.DEBUG('Invalid \'deviceId\' parameter for GET \'devices/:deviceId\' API request', this.urlParams);
            return errorResponse.call(this, 400, 'Invalid parameters');
        }

        // isProdUniqueId param
        if (!(typeof this.queryParams.isProdUniqueId === 'undefined' || (typeof this.queryParams.isProdUniqueId === 'string' && isValidBooleanStr(this.queryParams.isProdUniqueId)))) {
            Catenis.logger.DEBUG('Invalid \'isProdUniqueId\' parameter for GET \'devices/:deviceId\' API request', this.queryParams);
            return errorResponse.call(this, 400, 'Invalid parameters');
        }

        // Make sure that system is running and accepting API calls
        if (!Catenis.application.isRunning()) {
            Catenis.logger.DEBUG('System currently not available for fulfilling GET \'permission/events/:eventName/rights\' API request', {applicationStatus: Catenis.application.status});
            return errorResponse.call(this, 503, 'System currently not available; please try again at a later time');
        }

        // Prepare object device
        let otherDevice;

        try {
            otherDevice = typeof this.queryParams.isProdUniqueId !== 'undefined' && booleanValue(this.queryParams.isProdUniqueId)
                ? Device.getDeviceByProductUniqueId(this.urlParams.deviceId, false)
                : (this.urlParams.deviceId === Permission.entityToken.ownHierarchy ? this.user.device : Device.getDeviceByDeviceId(this.urlParams.deviceId, false));
        }
        catch (err) {
            let error;

            if ((err instanceof Meteor.Error) && err.error === 'ctn_device_not_found') {
                error = errorResponse.call(this, 400, 'Invalid device');
            }
            else {
                error = errorResponse.call(this, 500, 'Internal server error');
                Catenis.logger.ERROR('Error processing GET \'devices/:deviceId\' API request.', err);
            }

            return error;
        }

        // Execute method to retrieve other device's identification info
        let idInfo;

        try {
            idInfo = this.user.device.retrieveDeviceIdentityInfo(otherDevice);
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
                else if (err.error === 'ctn_device_no_permission') {
                    error = errorResponse.call(this, 403, 'No permission to retrieve info');
                }
                else {
                    error = errorResponse.call(this, 500, 'Internal server error');
                }
            }
            else {
                error = errorResponse.call(this, 500, 'Internal server error');
            }

            if (error.statusCode === 500) {
                Catenis.logger.ERROR('Error processing GET \'devices/:deviceId\' API request.', err);
            }

            return error;
        }

        // Return success
        return successResponse.call(this, idInfo);
    }
    catch (err) {
        Catenis.logger.ERROR('Error processing GET \'devices/:deviceId\' API request.', err);
        return errorResponse.call(this, 500, 'Internal server error');
    }
}

function isValidBooleanStr(val) {
    return val === 'true' || val === 'false' || val === '1' || val === '0';
}

function booleanValue(strVal) {
    return strVal === 'true' || strVal === '1';
}
