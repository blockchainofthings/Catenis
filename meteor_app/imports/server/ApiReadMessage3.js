/**
 * Created by Claudio on 2019-02-26.
 */

//console.log('[ApiReadMessage3.js]: This code just ran.');

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
import { isValidMsgEncoding } from './ApiLogMessage';
import {
    cfgSettings as messageCfgSettings
} from './Message';

// Config entries
/*const config_entryConfig = config.get('config_entry');

 // Configuration settings
 const cfgSettings = {
 property: config_entryConfig.get('property_name')
 };*/


// Definition of module (private) functions
//

// Method used to process 'messages/:messageId' endpoint of Rest API
//
//  URL parameters:
//    messageId [String]   - ID of message to read
//
//  Query string (optional) parameters:
//    encoding [String]   - (default: utf8) One of the following values identifying the encoding that should be used for the returned message: utf8|base64|hex
//    continuationToken [String]  - Indicates that this is a continuation call and that the following message data chunk should be returned. This
//                                   should be filled with the value returned in the 'continuationToken' field of the response from the previous call,
//                                   or the response from the Retrieve Message Progress API method
//    dataChunkSize [Number]  - Size, in bytes, of the largest message data chunk that should be returned. This is effectively used to signal
//                              that the message should be retrieved/read in chunks. NOTE that this option is only taken into consideration (and
//                              thus only needs to be passed) for the initial call to this API method with a given message ID (no continuation
//                              token), and it shall be applied to the message's contents as a whole
//    async [Boolean]  - (default: false) Indicates whether processing (retrieval of message from the blockchain) should be done asynchronously.
//                        If set to true, a cached message ID is returned, which should be used to retrieve the processing outcome by calling the
//                        Retrieve Message Progress API method. NOTE that this option is only taken into consideration (and thus only needs to be
//                        passed) for the initial call to this API method with a given message ID (no continuation token), and it shall be
//                        applied to the message's contents as a whole
//
//  Success data returned: {
//    "msgInfo": {  - (optional) Returned along with the 'msgData' field for the first (or the only) part of the message's contents returned for a
//                         given message ID
//      "action": [String],    - Action originally performed on the message; either 'log' or 'send'
//      "from": {         - Note: only returned if origin device different than device that issued the request, unless
//                          it is the (rare) case where the device that issued the request sent a message to itself
//        "deviceId": [String],     - Catenis ID of the origin device (device that had sent/logged the message)
//        "name": [String],         - (only returned if defined and device that issued the request has permission to access this device's main props) Assigned name of the device
//        "prodUniqueId": [String]  - (only returned if defined and device that issued the request has permission to access this device's main props) Product unique ID of the device
//      },
//      "to": {          - Note: only returned if target device different than device that issued the request
//        "deviceId": [String]      - Catenis ID of target device (device to which the message had been sent)
//        "name": [String],         - (only returned if defined and device that issued the request has permission to access this device's main props) Assigned name of the device
//        "prodUniqueId": [String]  - (only returned if defined and device that issued the request has permission to access this device's main props) Product unique ID of the device
//      },
//    },
//    "msgData": [String]   - (optional) The message's contents formatted using the specified encoding. Returned as a response to the initial call to this API method
//                             with a given message ID (no continuation token) if not doing asynchronous processing, or as a response for a continuation
//                             call (continuation token was passed)
//    "continuationToken": [String]  - (optional) Token to be used when requesting the following message data chunk. This is returned along with the 'msgData' field
//                                      if the whole message's contents has not yet been returned
//    "cachedMessageId": [String]  - (optional) Cached message ID. Returned as a response to the initial call to this API method with a given message ID
//                                    (no continuation token) if doing asynchronous processing
//  }
export function readMessage3() {
    try {
        // Process request parameters

        // From URL
        //
        // messageId param
        if (!(typeof this.urlParams.messageId === 'string' && this.urlParams.messageId.length > 0)) {
            Catenis.logger.DEBUG('Invalid \'messageId\' parameter for GET \'messages/:messageId\' API request', this.urlParams);
            return errorResponse.call(this, 400, 'Invalid parameters');
        }

        // From query string
        //
        // continuationToken param
        // encoding param
        let encoding = 'utf8';

        if (!(typeof this.queryParams.encoding === 'undefined' || (typeof this.queryParams.encoding === 'string' && isValidMsgEncoding(this.queryParams.encoding)))) {
            Catenis.logger.DEBUG('Invalid \'encoding\' parameter for GET \'messages/:messageId\' API request', this.queryParams);
            return errorResponse.call(this, 400, 'Invalid parameters');
        }

        if (typeof this.queryParams.encoding !== 'undefined') {
            encoding = this.queryParams.encoding;
        }

        let continuationToken;

        if (!(typeof this.queryParams.continuationToken === 'undefined' || (typeof this.queryParams.continuationToken === 'string' && this.queryParams.continuationToken.length > 0))) {
            Catenis.logger.DEBUG('Invalid \'continuationToken\' parameter for GET \'messages/:messageId\' API request', this.queryParams);
            return errorResponse.call(this, 400, 'Invalid parameters');
        }

        if (typeof this.queryParams.continuationToken !== 'undefined') {
            continuationToken = this.queryParams.continuationToken;
        }

        // dataChunkSize param
        let dataChunkSize;

        if (!(typeof this.queryParams.dataChunkSize === 'undefined' || (!Number.isNaN(dataChunkSize = Number.parseInt(this.queryParams.dataChunkSize)) && isValidDataChunkSize(dataChunkSize)))) {
            Catenis.logger.DEBUG('Invalid \'dataChunkSize\' parameter for GET \'messages/:messageId\' API request', this.queryParams);
            return errorResponse.call(this, 400, 'Invalid parameters');
        }

        // async param
        // noinspection JSUnusedAssignment
        let async = false;
        
        if (!(typeof this.queryParams.async === 'undefined' || ((async = parseBoolean(this.queryParams.async)) !== null))) {
            Catenis.logger.DEBUG('Invalid \'async\' parameter for GET \'messages/:messageId\' API request', this.queryParams);
            return errorResponse.call(this, 400, 'Invalid parameters');
        }

        // Make sure that system is running and accepting API calls
        if (!Catenis.application.isRunning()) {
            Catenis.logger.DEBUG('System currently not available for fulfilling \'messages/:messageId\' API request', {applicationStatus: Catenis.application.status});
            return errorResponse.call(this, 503, 'System currently not available; please try again at a later time');
        }

        // Execute method to read message
        let readResult;

        try {
            readResult = this.user.device.readMessage3(this.urlParams.messageId, encoding, continuationToken, dataChunkSize, async);
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
                    error = errorResponse.call(this, 403, 'No permission to read message');
                }
                else if (err.error === 'ctn_cach_msg_not_available') {
                    // This should never happen
                    error = errorResponse.call(this, 400, 'Message not available');
                }
                else if (err.error === 'ctn_cach_msg_already_read') {
                    error = errorResponse.call(this, 400, 'Message already read');
                }
                else if (err.error === 'ctn_cach_msg_not_found' || err.error === 'ctn_cach_msg_wrong_device' || err.error === 'ctn_cach_msg_wrong_message' || err.error === 'ctn_cach_msg_invalid_cont_token') {
                    error = errorResponse.call(this, 400, 'Invalid or unexpected continuation token');
                }
                else if (err.error === 'ctn_cach_msg_expired') {
                    error = errorResponse.call(this, 400, 'Message expired');
                }
                else if (err.error === 'ctn_buf_msg_capacity_exceeded' || err.error === 'ctn_cach_msg_not_fit_one_chunk') {
                    error = errorResponse.call(this, 400, 'Message too large for reading at once');
                }
                else {
                    error = errorResponse.call(this, 500, 'Internal server error');
                }
            }
            else {
                error = errorResponse.call(this, 500, 'Internal server error');
            }

            if (error.statusCode === 500) {
                Catenis.logger.ERROR('Error processing \'messages/:messageId\' API request.', err);
            }

            return error;
        }

        // Return success
        return successResponse.call(this, readResult);
    }
    catch (err) {
        Catenis.logger.ERROR('Error processing \'messages/:messageId\' API request.', err);
        return errorResponse.call(this, 500, 'Internal server error');
    }
}

function isValidDataChunkSize(num) {
    return num >= messageCfgSettings.minSizeReadDataChunk && num <= messageCfgSettings.maxSizeReadDataChunk;
}

function parseBoolean(val) {
    return typeof val !== 'string' ? null : (val === '1' || val.toLowerCase() === 'true' ? true : (val === '0' || val.toLowerCase() === 'false' ? false : null));
}
