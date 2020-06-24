/**
 * Created by claudio on 2020-06-24
 */

//console.log('[ApiMessageProgress.js]: This code just ran.');

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

// Config entries
/*const config_entryConfig = config.get('config_entry');

// Configuration settings
const cfgSettings = {
    property: config_entryConfig.get('property_name')
};*/


// Definition of module (private) functions
//

// Method used to process GET 'messages/proof' endpoint of Rest API
//
//  URL parameters:
//    messageId [String] - ID of ephemeral message (either a provisional or a cached message) for which to return processing progress
//  Query string parameters:
//    txid [String]     - ID of the blockchain transaction where the Catenis message the origin of which needs to be proven is recorded
//
//  Success data returned: {
//    "action": [String]            - The action that was to be performed on the message. One of: 'send', 'log' or 'read'
//    "progress": {
//      "bytesProcessed": [Number], - Total number of bytes of message that had already been processed
//      "done": [Boolean],          - Indicates whether processing had been finalized, either successfully or with error
//      "success": [Boolean],       - (optional) Indicates whether message had been successfully processed. Only returned after processing
//                                     is finished (done = true)
//      "error": {      - (optional) Only returned after processing is finished with error (done = true & success = false)
//        "code": [Number],      - Code number of error that took place while processing the message
//        "message": [String]    - Text describing the error that took place while processing the message
//      },
//      finishDate: [Date]         - (optional) Date and time when processing was finalized. Only returned after processing is finished (done = true)
//    },
//    "result": {  - (optional) Only returned after processing is finished successfully
//      "messageId": [String]         - ID of the Catenis message. When sending or logging (action = send or log), it is the ID of the
//                                       resulting message. When reading (action = read), it references the message being read
//      "continuationToken": [String] - The token that should be used to complete the read of the message. Only return if action = read
//    }
//  }
export function retrieveMessageProgress() {
    try {
        // Process request parameters

        // From URL
        //
        // assetId param
        if (!(typeof this.urlParams.messageId === 'string' && this.urlParams.messageId.length > 0)) {
            Catenis.logger.DEBUG('Invalid \'messageId\' parameter for GET \'messages/:messageId/progress\' API request', this.urlParams);
            return errorResponse.call(this, 400, 'Invalid parameters');
        }

        // Make sure that system is running and accepting API calls
        if (!Catenis.application.isRunning()) {
            Catenis.logger.DEBUG('System currently not available for fulfilling GET \'messages/:messageId/progress\' API request', {applicationStatus: Catenis.application.status});
            return errorResponse.call(this, 503, 'System currently not available; please try again at a later time');
        }

        // Execute method to retrieve message processing progress
        let result;

        try {
            result = this.user.device.getMessageProgress(this.urlParams.messageId);
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
                else if (err.error === 'ctn_ephem_msg_not_found' || err.error === 'ctn_prov_msg_wrong_device' || err.error === 'ctn_cach_msg_wrong_device' || err.error === 'ctn_cach_msg_read_already_started') {
                    error = errorResponse.call(this, 400, 'Invalid or expired ephemeral message');
                }
                else if (err.error === 'ctn_prov_msg_progress_not_available') {
                    error = errorResponse.call(this, 400, 'Progress not available');
                }
                else {
                    error = errorResponse.call(this, 500, 'Internal server error');
                }
            }
            else {
                error = errorResponse.call(this, 500, 'Internal server error');
            }

            if (error.statusCode === 500) {
                Catenis.logger.ERROR('Error processing GET \'messages/:messageId/progress\' API request.', err);
            }

            return error;
        }

        // Return success
        return successResponse.call(this, result);
    }
    catch (err) {
        Catenis.logger.ERROR('Error processing GET \'messages/:messageId/progress\' API request.', err);
        return errorResponse.call(this, 500, 'Internal server error');
    }
}
