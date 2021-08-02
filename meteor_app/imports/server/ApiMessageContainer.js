/**
 * Created by Claudio on 2017-04-07.
 */

//console.log('[ApiMessageContainer.js]: This code just ran.');

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
import { successResponse, errorResponse } from './RestApi';

// Config entries
/*const config_entryConfig = config.get('config_entry');

// Configuration settings
const cfgSettings = {
    property: config_entryConfig.get('property_name')
};*/


// Definition of module (private) functions
//

// Method used to process 'messages/:messageId/container' endpoint of Rest API
//
//  URL parameters:
//    messageId [String]        // ID of message to get container info
//
//  Success data returned: {
//    "blockchain" : {
//      "txid": [String],         // ID of blockchain transaction where message is recorded
//                                //  NOTE: due to malleability, the ID of the transaction might change
//                                //    until the it is finally confirmed
//      "isConfirmed": [Boolean]  // Indicates whether the returned txid is confirmed
//    },
//    "externalStorage" : {     // Note: only returned if message is stored in an external storage
//      "<storage_provider_name>": [String]  // Key: storage provider name. Value: reference to message in external storage
//    }
//  }
export function retrieveMessageContainer() {
    try {
        // Process request parameters

        // messageId param
        if (!(typeof this.urlParams.messageId === 'string' && this.urlParams.messageId.length > 0)) {
            Catenis.logger.DEBUG('Invalid \'messageId\' parameter for \'messages/:messageId/container\' API request', this.urlParams);
            return errorResponse.call(this, 400, 'Invalid parameters');
        }

        // Make sure that system is running and accepting API calls
        if (!Catenis.application.isRunning()) {
            Catenis.logger.DEBUG('System currently not available for fulfilling \'messages/:messageId/container\' API request', {applicationStatus: Catenis.application.status});
            return errorResponse.call(this, 503, 'System currently not available; please try again at a later time');
        }

        // Execute method to read message
        let containerInfo;

        try {
            containerInfo = this.user.device.retrieveMessageContainer(this.urlParams.messageId);
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
                else if (err.error === 'ctn_msg_not_found') {
                    error = errorResponse.call(this, 400, 'Invalid message ID');
                }
                else if (err.error === 'ctn_device_msg_no_access') {
                    error = errorResponse.call(this, 403, 'No permission to retrieve message container');
                }
                else {
                    error = errorResponse.call(this, 500, 'Internal server error');
                }
            }
            else {
                error = errorResponse.call(this, 500, 'Internal server error');
            }

            if (error.statusCode === 500) {
                Catenis.logger.ERROR('Error processing \'messages/:messageId/container\' API request.', err);
            }

            return error;
        }

        // Return success
        return successResponse.call(this, containerInfo);
    }
    catch (err) {
        Catenis.logger.ERROR('Error processing \'messages/:messageId/container\' API request.', err);
        return errorResponse.call(this, 500, 'Internal server error');
    }
}


// Module code
//
