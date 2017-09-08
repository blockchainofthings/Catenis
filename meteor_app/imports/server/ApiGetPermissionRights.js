/**
 * Created by claudio on 10/08/17.
 */

//console.log('[ApiGetPermissionRights.js]: This code just ran.');

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
import _und from 'underscore';      // NOTE: we do not use the underscore library provided by Meteor because we need
                                    //        a feature (_und.omit(obj,predicate)) that is not available in that version
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

// Method used to process GET 'permission/events/:eventName/rights' endpoint of Rest API
//
//  URL parameters:
//    eventName [String] - Name of permission event
//
//  Success data returned: [{
//    "system": [String] - Permission right attributed at system level for the specified event; either "allow" or "deny"
//    "catenisNode": {   - (only returned if not empty) Permission rights attributed at the Catenis node level for the specified event
//      "allow": [Array(String)],  - (only returned if not empty) List of indices of Catenis nodes to which have been given allow right
//      "deny": [Array(String)]    - (only returned if not empty) List of indices of Catenis nodes to which have been given deny right
//    },
//    "client": {   - (only returned if not empty) Permission rights attributed at the client level for the specified event
//      "allow": [Array(String)],  - (only returned if not empty) List of IDs of clients to which have been given allow right
//      "deny": [Array(String)]    - (only returned if not empty) List of IDs of clients to which have been given deny right
//    },
//    "device": {   - (only returned if not empty) Permission rights attributed at the device level for the specified event
//      "allow": [{   - (only returned if not empty) List of devices to which have been given allow right
//        "deviceId": [String],     - Catenis ID of the device
//        "name": [String],         - (only returned if defined and device that issued the request has permission to access this device's main props) - Assigned name of the device
//        "prodUniqueId": [String]  - (only returned if defined and device that issued the request has permission to access this device's main props) - Product unique ID of the device
//      }],
//      "deny": [{    - (only returned if not empty) List of devices to which have been given deny right
//        "deviceId": [String],     - Catenis ID of the device
//        "name": [String],         - (only returned if defined and device that issued the request has permission to access this device's main props) - Assigned name of the device
//        "prodUniqueId": [String]  - (only returned if defined and device that issued the request has permission to access this device's main props) - Product unique ID of the device
//      }],
//    }
//  }]
export function retrievePermissionRights() {
    try {
        // Process request parameters

        // eventName param
        if (!(typeof this.urlParams.eventName === 'string' && this.urlParams.eventName.length > 0 && Permission.isValidEventName(this.urlParams.eventName))) {
            Catenis.logger.DEBUG('Invalid \'eventName\' parameter for GET \'permission/events/:eventName/rights\' API request', this.urlParams);
            return errorResponse.call(this, 400, 'Invalid parameters');
        }

        // Make sure that system is running and accepting API calls
        if (!Catenis.application.isRunning()) {
            Catenis.logger.DEBUG('System currently not available for fulfilling GET \'permission/events/:eventName/rights\' API request', {applicationStatus: Catenis.application.status});
            return errorResponse.call(this, 503, 'System currently not available; please try again at a later time');
        }

        // Execute method to retrieve permission rights currently set for the specified event
        let rights;

        try {
            rights = this.user.device.getRights(this.urlParams.eventName);
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
                Catenis.logger.ERROR('Error processing GET \'permission/events/:eventName/rights\' API request.', err);
            }

            return error;
        }

        // Return success
        return successResponse.call(this, fixRightsReplaceDeviceId(rights, this.user.device));
    }
    catch (err) {
        Catenis.logger.ERROR('Error processing GET \'permission/events/:eventName/rights\' API request.', err);
        return errorResponse.call(this, 500, 'Internal server error');
    }
}

// Fix rights replacing device Ids for a device object containing not only the device Id but device's main props too
//  (provided that the device that issued the request has access to them)
function fixRightsReplaceDeviceId(rights, reqDevice) {
    const fixedRights = {};

    Object.keys(rights).forEach((levelKey) => {
        if (levelKey === Permission.level.device.key) {
            // Device level rights. Replace the device Ids
            fixedRights[levelKey] = {};

            Object.keys(rights[levelKey]).forEach((right) => {
                fixedRights[levelKey][right] = rights[levelKey][right].map((deviceId) => {
                    const deviceObj = {
                        deviceId: deviceId
                    };

                    // Add device's main properties is they are accessible
                    _und.extend(deviceObj, Device.getDeviceByDeviceId(deviceId).discloseMainPropsTo(reqDevice));

                    return deviceObj;
                });
            });
        }
        else {
            // Nothing to do; just copy level value over
            fixedRights[levelKey] = rights[levelKey];
        }
    });

    return fixedRights;
}


// Module code
//
