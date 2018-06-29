/**
 * Created by claudio on 10/08/17.
 */

//console.log('[ApiListPermissionEvents.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
//import config from 'config';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
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

// Method used to process GET 'permission/events' endpoint of Rest API
//
//  Success data returned: {    // An object the properties of which are the names of the permission events, and the value
//                              //  of those properties the corresponding description of the event
//    "<event_name>": [String] - A short description of the event
//  }
export function listPermissionEvents() {
    try {
        // Make sure that system is running and accepting API calls
        if (!Catenis.application.isRunning()) {
            Catenis.logger.DEBUG('System currently not available for fulfilling GET \'permission/events\' API request', {applicationStatus: Catenis.application.status});
            return errorResponse.call(this, 503, 'System currently not available; please try again at a later time');
        }

        // Get API version from endpoint URL
        const apiVer = new ApiVersion(getUrlApiVersion(this.request.url));

        // Execute method to list permission events
        let listResult;

        try {
            listResult = Permission.listEvents(apiVer);
        }
        catch (err) {
            Catenis.logger.ERROR('Error processing GET \'permission/events\' API request.', err);
            return errorResponse.call(this, 500, 'Internal server error');
        }

        // Return success
        return successResponse.call(this, listResult);
    }
    catch (err) {
        Catenis.logger.ERROR('Error processing GET \'permission/events\' API request.', err);
        return errorResponse.call(this, 500, 'Internal server error');
    }
}


// Module code
//
