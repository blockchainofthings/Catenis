/**
 * Created by Claudio on 2017-09-06.
 */

//console.log('[ApiEffectivePermissionRight.js]: This code just ran.');

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
import { Permission } from './Permission';
import {
    successResponse,
    errorResponse,
    getUrlApiVersion
} from './RestApi';
import { ApiVersion } from './ApiVersion';

// Config entries
/*const config_entryConfig = config.get('config_entry');

 // Configuration settings
 const cfgSettings = {
 property: config_entryConfig.get('property_name')
 };*/


// Definition of module (private) functions
//

// Method used to process GET 'permission/events/:eventName/rights/:deviceId' endpoint of Rest API
//
//  URL parameters:
//    eventName [String] - Name of the permission event
//    deviceId [String]  - ID of the device to check the permission right applied to it. Can optionally be replaced with value "self" to refer to the ID of the device that issued the request
//
//  Query string (optional) parameters:
//    isProdUniqueId: [Boolean] - (default: false) Indicates whether the deviceId parameter should be interpreted as a product unique ID (otherwise, it is interpreted as a Catenis device Id)
//
//  Success data returned: { - An object the only property of which is the Catenis device Id and its value the applied permission right
//    "<deviceId>": [String] - The effective permission right that is applied to the device; either 'allow' or 'deny'.
//  }
export function checkEffectivePermissionRight() {
    try {
        // Get API version from endpoint URL
        const apiVer = new ApiVersion(getUrlApiVersion(this.request.url));

        // Process request parameters

        // eventName param
        if (!(typeof this.urlParams.eventName === 'string' && this.urlParams.eventName.length > 0 && Permission.isValidEventName(this.urlParams.eventName, apiVer))) {
            Catenis.logger.DEBUG('Invalid \'eventName\' parameter for GET \'permission/events/:eventName/rights/:deviceId\' API request', this.urlParams);
            return errorResponse.call(this, 400, 'Invalid parameters');
        }

        // deviceId param
        if (!(typeof this.urlParams.deviceId === 'string' && this.urlParams.deviceId.length > 0)) {
            Catenis.logger.DEBUG('Invalid \'deviceId\' parameter for GET \'permission/events/:eventName/rights/:deviceId\' API request', this.urlParams);
            return errorResponse.call(this, 400, 'Invalid parameters');
        }

        // isProdUniqueId param
        if (!(typeof this.queryParams.isProdUniqueId === 'undefined' || (typeof this.queryParams.isProdUniqueId === 'string' && isValidBooleanStr(this.queryParams.isProdUniqueId)))) {
            Catenis.logger.DEBUG('Invalid \'isProdUniqueId\' parameter for GET \'permission/events/:eventName/rights/:deviceId\' API request', this.queryParams);
            return errorResponse.call(this, 400, 'Invalid parameters');
        }

        // Make sure that system is running and accepting API calls
        if (!Catenis.application.isRunning()) {
            Catenis.logger.DEBUG('System currently not available for fulfilling GET \'permission/events/:eventName/rights\' API request', {applicationStatus: Catenis.application.status});
            return errorResponse.call(this, 503, 'System currently not available; please try again at a later time');
        }

        // Prepare object device
        let objectDevice;

        try {
            objectDevice = typeof this.queryParams.isProdUniqueId !== 'undefined' && booleanValue(this.queryParams.isProdUniqueId)
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
                Catenis.logger.ERROR('Error processing GET \'permission/events/:eventName/rights/:deviceId\' API request.', err);
            }

            return error;
        }

        // Execute method to check effective permission right applied to a given (object) device for the specified event
        let hasRight;

        try {
            hasRight = this.user.device.checkEffectiveRight(this.urlParams.eventName, objectDevice);
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
                Catenis.logger.ERROR('Error processing GET \'permission/events/:eventName/rights/:deviceId\' API request.', err);
            }

            return error;
        }

        // Prepare result
        const result = {};
        result[objectDevice.deviceId] = hasRight ? Permission.right.allow : Permission.right.deny;

        // Return success
        return successResponse.call(this, result);
    }
    catch (err) {
        Catenis.logger.ERROR('Error processing GET \'permission/events/:eventName/rights/:deviceId\' API request.', err);
        return errorResponse.call(this, 500, 'Internal server error');
    }
}

function isValidBooleanStr(val) {
    return val === 'true' || val === 'false' || val === '1' || val === '0';
}

function booleanValue(strVal) {
    return strVal === 'true' || strVal === '1';
}
