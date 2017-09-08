/**
 * Created by claudio on 11/08/17.
 */

//console.log('[ApiPostPermissionRights.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//  NOTE: the reference of these modules are done sing 'require()' instead of 'import' to
//      to avoid annoying WebStorm warning message: 'default export is not defined in
//      imported module'
const util = require('util');
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

// Method used to process POST 'permission/events/:eventName/rights' endpoint of Rest API
//
//  JSON payload: {
//    "system": [String] - (optional) Permission right to be attributed at system level for the specified event. Must be one of the following values: "allow", "deny"
//    "catenisNode": {   - (optional) Permission rights to be attributed at the Catenis node level for the specified event
//      "allow": [Array(String)|String],  - (optional) List of indices (or a single index) of Catenis nodes to give allow right
//                                        -  Can optionally include the value "self" to refer to the index of the Catenis node to which the device belongs
//      "deny": [Array(String)|String],   - (optional) List of indices (or a single index) of Catenis nodes to give deny right
//                                        -  Can optionally include the value "self" to refer to the index of the Catenis node to which the device belongs
//      "none": [Array(String)|String]    - (optional) List of indices (or a single index) of Catenis nodes the rights of which should be removed.
//                                        -  Can optionally include the value "self" to refer to the index of the Catenis node to which the device belongs.
//                                        -  The wildcard character ("*") can also be used to indicate that the rights for all Catenis nodes should be remove
//    },
//    "client": {   - (optional) Permission rights to be attributed at the client level for the specified event
//      "allow": [Array(String)|String],  - (optional) List of IDs (or a single ID) of clients to give allow right
//                                        -  Can optionally include the value "self" to refer to the ID of the client to which the device belongs
//      "deny": [Array(String)|String]    - (optional) List of IDs (or a single ID) of clients to give deny right
//                                        -  Can optionally include the value "self" to refer to the ID of the client to which the device belongs
//      "none": [Array(String)|String]    - (optional) List of IDs (or a single ID) of clients the rights of which should be removed.
//                                        -  Can optionally include the value "self" to refer to the ID of the client to which the device belongs
//                                        -  The wildcard character ("*") can also be used to indicate that the rights for all clients should be remove
//    },
//    "device": {   - (optional) Permission rights to be attributed at the device level for the specified event
//      "allow": [{          - (optional) List of IDs (or a single ID) of devices to give allow right
//        "id": [String],             - ID of the device. Can optionally be replaced with value "self" to refer to the ID of the device itself
//        "isProdUniqueId" [Boolean]  - (optional, default: false) Indicate whether supplied ID is a product unique ID (otherwise, if should be a Catenis device Id)
//      }],
//      "deny": [{           - (optional) List of IDs (or a single ID) of devices to give deny right
//        "id": [String],             - ID of the device. Can optionally be replaced with value "self" to refer to the ID of the device itself
//        "isProdUniqueId" [Boolean]  - (optional, default: false) Indicate whether supplied ID is a product unique ID (otherwise, if should be a Catenis device Id)
//      }],
//      "none": [{           - (optional) List of IDs (or a single ID) of devices the rights of which should be removed.
//        "id": [String],             - ID of the device. Can optionally be replaced with value "self" to refer to the ID of the device itself
//                                    -  The wildcard character ("*") can also be used to indicate that the rights for all devices should be remove
//        "isProdUniqueId" [Boolean]  - (optional, default: false) Indicate whether supplied ID is a product unique ID (otherwise, if should be a Catenis device Id)
//      }]
//    }
//  }
//
//  Success data returned: {
//    "success": true
//  }
export function setPermissionRights() {
    try {
        // Process request parameters

        // From URL
        //
        // eventName param
        if (!(typeof this.urlParams.eventName === 'string' && Permission.isValidEventName(this.urlParams.eventName))) {
            Catenis.logger.DEBUG('Invalid \'eventName\' parameter for POST \'permission/events/:eventName/rights\' API request', this.urlParams);
            return errorResponse.call(this, 400, 'Invalid parameters');
        }
        
        // From payload
        //
        // Make sure that there are no unknown parameters
        if (!isValidRightSettings(this.bodyParams)) {
            Catenis.logger.DEBUG('Not specified or unknown parameters for POST \'permission/events/:eventName/rights\' API request', this.bodyParams);
            return errorResponse.call(this, 400, 'Invalid parameters');
        }

        // system param
        if (this.bodyParams.system !== undefined && !(typeof this.bodyParams.system === 'string' && Permission.isValidRight(this.bodyParams.system))) {
            Catenis.logger.DEBUG('Invalid \'system\' parameter for POST \'permission/events/:eventName/rights\' API request', this.bodyParams);
            return errorResponse.call(this, 400, 'Invalid parameters');
        }

        // catenisNode param
        if (this.bodyParams.catenisNode !== undefined && !isValidRightSettingEntry(this.bodyParams.catenisNode)) {
            Catenis.logger.DEBUG('Invalid \'catenisNode\' parameter for POST \'permission/events/:eventName/rights\' API request', this.bodyParams);
            return errorResponse.call(this, 400, 'Invalid parameters');
        }

        // client param
        if (this.bodyParams.client !== undefined && !isValidRightSettingEntry(this.bodyParams.client)) {
            Catenis.logger.DEBUG('Invalid \'client\' parameter for POST \'permission/events/:eventName/rights\' API request', this.bodyParams);
            return errorResponse.call(this, 400, 'Invalid parameters');
        }

        // device param
        if (this.bodyParams.device !== undefined && !isValidRightSettingEntry(this.bodyParams.device, true)) {
            Catenis.logger.DEBUG('Invalid \'device\' parameter for POST \'permission/events/:eventName/rights\' API request', this.bodyParams);
            return errorResponse.call(this, 400, 'Invalid parameters');
        }

        // Make sure that system is running and accepting API calls
        if (!Catenis.application.isRunning()) {
            Catenis.logger.DEBUG('System currently not available for fulfilling POST \'permission/events/:eventName/rights\' API request', {applicationStatus: Catenis.application.status});
            return errorResponse.call(this, 503, 'System currently not available; please try again at a later time');
        }

        // Execute method to set permission rights for the specified event
        const deviceIdProdUniqueId = new Map();
        
        try {
            const fixedRights = fixRightsReplaceDeviceIdObj(this.bodyParams, deviceIdProdUniqueId);
            
            this.user.device.setRights(this.urlParams.eventName, fixedRights);
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
                else if (err.error === 'ctn_permission_nonexistent_entities') {
                    error = errorResponse.call(this, 400, parseNonexistentEntitiesError(err.details, deviceIdProdUniqueId));
                }
                else {
                    error = errorResponse.call(this, 500, 'Internal server error');
                }
            }
            else {
                error = errorResponse.call(this, 500, 'Internal server error');
            }

            if (error.statusCode === 500) {
                Catenis.logger.ERROR('Error processing POST \'permission/events/:eventName/rights\' API request.', err);
            }

            return error;
        }

        // Return success
        return successResponse.call(this, {
            success: true
        });
    }
    catch (err) {
        Catenis.logger.ERROR('Error processing POST \'permission/events/:eventName/rights\' API request.', err);
        return errorResponse.call(this, 500, 'Internal server error');
    }
}

function isValidRightSettings(obj) {
    return typeof obj === 'object' && obj !== null && !Object.keys(obj).some((key) => !Permission.isValidLevelKey(key));
}

function isValidRightSettingEntry(entry, isDeviceLevel = false) {
    let result = true;

    if (!(typeof entry === 'object' && entry !== null)) {
        result = false;
    }
    else {
        result = !Object.keys(entry).some((key) => {
            return !((Permission.isValidRight(key) || key === Permission.deleteRightKey) &&
                ((!isDeviceLevel && (isArrayOfString(entry[key]) || typeof entry[key] === 'string')) ||
                (isDeviceLevel && (isArrayOfDeviceIdObj(entry[key]) || isDeviceIdObj(entry[key])))));
        });
    }
    
    return result;
}

function isArrayOfString(obj) {
    return Array.isArray(obj) && !obj.some((val) => typeof val !== 'string');
}

function isArrayOfDeviceIdObj(obj) {
    return Array.isArray(obj) && !obj.some((val) => !isDeviceIdObj(val));
}

function isDeviceIdObj(obj) {
    return typeof obj === 'object' && obj !== null && !Object.keys(obj).some((key) => key !== 'id' && key !== 'isProdUniqueId') &&
        typeof obj.id === 'string' && (obj.isProdUniqueId === undefined || typeof obj.isProdUniqueId === 'boolean');
}

// Fix rights payload object replacing the objects used to pass the ID of devices with the corresponding device Id
function fixRightsReplaceDeviceIdObj(rights, deviceIdProdUniqueId) {
    const fixedRights = {};
    
    Object.keys(rights).forEach((levelKey) => {
        if (levelKey === Permission.level.device.key) {
            // Device level rights. Replace the device Id objects
            fixedRights[levelKey] = {};
            
            Object.keys(rights[levelKey]).forEach((right) => {
                if (Array.isArray(rights[levelKey][right])) {
                    fixedRights[levelKey][right] = rights[levelKey][right].map((idObj, idx) => {
                        return convertDeviceIdObj(idObj, right, idx, deviceIdProdUniqueId);
                    });
                }
                else {
                    fixedRights[levelKey][right] = convertDeviceIdObj(rights[levelKey][right], right, 0, deviceIdProdUniqueId);
                }
            });
        }
        else {
            // Nothing to do; just copy level value over
            fixedRights[levelKey] = rights[levelKey];
        }
    });
    
    return fixedRights;
}

function convertDeviceIdObj(idObj, right, index, deviceIdProdUniqueId) {
    if (idObj.isProdUniqueId === undefined || !idObj.isProdUniqueId) {
        // ID object contains a device Id. Just return it
        return idObj.id;
    }
    else {
        // ID object contains a product unique ID. Try to get its corresponding device Id
        let deviceId;

        try {
            deviceId = Device.getDeviceByProductUniqueId(idObj.id).deviceId;
        }
        catch (err) {
            if ((err instanceof Meteor.Error) && err.error === 'ctn_device_not_found') {
                // Invalid product unique ID. Make a fake one
                deviceId = makeFakeDeviceId(idObj.id, right, index);
            }
        }

        // Save device Id and its corresponding product unique ID
        deviceIdProdUniqueId.set(deviceId, idObj.id);

        return deviceId;
    }
}

function makeFakeDeviceId(invalidProdUniqueId, right, index) {
    return util.format('_%s_%s_prodUID_%s', right, index, invalidProdUniqueId);
}

function parseNonexistentEntitiesError(errDetails, deviceIdProdUniqueId) {
    const detailsObj = JSON.parse(errDetails);
    let errMsg = '';

    Object.keys(detailsObj).forEach((levelKey) => {
        const entity = Permission.entityFromLevelKey(levelKey);
        let numNonexistentEntityIds;
        let nonexistentEntityIdsList;

        if (levelKey !== Permission.level.device.key) {
            const nonexistentEntityIds = new Set(detailsObj[levelKey]);
            numNonexistentEntityIds = nonexistentEntityIds.size;

            nonexistentEntityIdsList = util.format('%s: %s',
                    nonexistentEntityIds.size > 1 ? entity.idType.plural : entity.idType.singular,
                    Array.from(nonexistentEntityIds).join(', '));
        }
        else {
            // Device level. Distinguish IDs that are device Ids and product unique IDs
            const nonexistentDeviceIds = new Set();
            const nonexistentProdUniqueIds = new Set();

            detailsObj[levelKey].forEach((id) => {
                if (deviceIdProdUniqueId.has(id)) {
                    nonexistentProdUniqueIds.add(deviceIdProdUniqueId.get(id));

                    // Make sure to delete fake device ID (one used to replace the actual product unique ID)
                    //  so a device ID passed in by the user is not mistaken by a product unique ID
                    deviceIdProdUniqueId.delete(id);
                }
                else {
                    nonexistentDeviceIds.add(id);
                }
            });

            numNonexistentEntityIds = 0;
            nonexistentEntityIdsList = '';

            if (nonexistentDeviceIds.size > 0) {
                nonexistentEntityIdsList = util.format('%s: %s',
                    nonexistentDeviceIds.size > 1 ? entity.idType.plural : entity.idType.singular,
                    Array.from(nonexistentDeviceIds).join(', '));

                numNonexistentEntityIds = nonexistentDeviceIds.size;
            }

            if (nonexistentProdUniqueIds.size > 0) {
                if (nonexistentEntityIdsList.length > 0) {
                    nonexistentEntityIdsList += '; ';
                }

                nonexistentEntityIdsList += util.format('%s: %s',
                    nonexistentProdUniqueIds.size > 1 ? 'prodUniqueIds' : 'prodUniqueId',
                    Array.from(nonexistentProdUniqueIds).join(', '));

                numNonexistentEntityIds += nonexistentProdUniqueIds.size;
            }
        }

        if (errMsg.length > 0) {
            errMsg += '; ';
        }

        errMsg += util.format('%s %s (%s)',
                errMsg.length > 0 ? 'invalid' : 'Invalid',
                numNonexistentEntityIds > 1 ? entity.name.plural : entity.name.singular,
                nonexistentEntityIdsList);
    });

    return errMsg;
}

// Module code
//
