/**
 * Created by claudio on 2021-08-03.
 */

//console.log('[ApiMessageContainer4.js]: This code just ran.');

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


// Definition of module (private) functions
//

// Method used to process 'messages/:messageId/container' endpoint of Rest API
//
//  URL parameters:
//    messageId [String]        - ID of message to get container info
//
//  Success data returned: {
//    "offChain": {             - (optional) Only returned for Catenis off-chain messages
//      "cid": [String]            - IPFS CID of Catenis off-chain message envelope data structure that holds the message's contents
//    },
//    "blockchain": {           - (optional) For Catenis off-chain messages, this property refers to the transaction used to settle off-chain
//                                 messages to the blockchain, and it is only returned at a later time after the settlement takes place
//      "txid": [String],          - ID of blockchain transaction where message is recorded
//                                    NOTE: due to malleability, the ID of the transaction might change until it is finally confirmed
//      "isConfirmed": [Boolean]   - Indicates whether the returned txid is confirmed
//    },
//    "externalStorage" : {     - (optional) Only returned if message is stored in an external storage
//      "<storage_provider_name>": [String]  - Key: storage provider name. Value: reference to message in external storage
//    }
//  }
export function retrieveMessageContainer4() {
    try {
        // Process request parameters
        let invalidParams = [];

        // messageId param
        if (!(typeof this.urlParams.messageId === 'string' && this.urlParams.messageId.length > 0)) {
            Catenis.logger.DEBUG('Invalid \'messageId\' parameter for \'messages/:messageId/container\' API request', this.urlParams);
            invalidParams.push('messageId');
        }

        if (invalidParams.length > 0) {
            return errorResponse.call(this, 400, `Invalid parameters: ${invalidParams.join(', ')}`);
        }

        // Make sure that system is running and accepting API calls
        if (!Catenis.application.isRunning()) {
            Catenis.logger.DEBUG('System currently not available for fulfilling \'messages/:messageId/container\' API request', {applicationStatus: Catenis.application.status});
            return errorResponse.call(this, 503, 'System currently not available; please try again at a later time');
        }

        // Execute method to read message
        let containerInfo;

        try {
            containerInfo = this.user.device.retrieveMessageContainer3(this.urlParams.messageId);
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
