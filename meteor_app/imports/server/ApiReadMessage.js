/**
 * Created by claudio on 22/02/17.
 */

//console.log('[ApiReadMessage.js]: This code just ran.');

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
import { successResponse, errorResponse } from './RestApi';
import { isValidMsgEncoding } from './ApiLogMessage';
import { Message } from './Message';

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
//    messageId [String]        // ID of message to read
//
//  Query string (optional) parameters:
//    encoding [String]         // (default: utf8) - One of the following values identifying the encoding that should be used for the returned message: utf8|base64|hex
//
//  Success data returned: {
//    "from" : {            // Note: only returned if origin device different than device that issued the request
//      deviceId: [String]      // Catenis ID of the origin device (device that had sent/logged the message)
//    },
//    "to" : {              // Note: only returned if target device different than device that issued the request.
//                          //  Never returned for version 0.1 that does not have permission control.
//      deviceId: [String]      // Catenis ID of target device (device to which the message had been sent)
//    },
//    "message": [String]       // The read message formatted using the specified encoding
//  }
export function readMessage() {
    try {
        // Process request parameters

        // messageId param
        if (!(typeof this.urlParams.messageId === 'string' && this.urlParams.messageId.length > 0)) {
            Catenis.logger.DEBUG('Invalid \'messageId\' parameter for \'messages/:messageId\' API request', this.urlParams);
            return errorResponse.call(this, 400, 'Invalid parameters');
        }

        let optEncoding = 'utf8';

        // encoding param
        if (!(typeof this.queryParams.encoding === 'undefined' || (typeof this.queryParams.encoding === 'string' && isValidMsgEncoding(this.queryParams.encoding)))) {
            Catenis.logger.DEBUG('Invalid \'encoding\' parameter for \'messages/:messageId\' API request', this.queryParams);
            return errorResponse.call(this, 400, 'Invalid parameters');
        }

        if (typeof this.queryParams.encoding !== 'undefined') {
            optEncoding = this.queryParams.encoding;
        }

        // Execute method to read message
        let msgInfo;
        let retry,
            alreadyRetried = false;

        do {
            try {
                retry = false;
                msgInfo = this.user.device.readMessage(this.urlParams.messageId);
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
                    else if (err.error === 'ctn_msg_not_found') {
                        error = errorResponse.call(this, 400, 'Invalid message ID');
                    }
                    else if (err.error === 'ctn_device_msg_no_access') {
                        error = errorResponse.call(this, 403, 'No permission to read message');
                    }
                    else if (err.error === 'ctn_msg_invalid_txid') {
                        // Transaction ID associated with message is not valid
                        if (!alreadyRetried) {
                            // It might be that the original ID of the transaction has been modified
                            //  due to malleability and we have not fixed it yet because last blochchain
                            //  block received has not yet been processed. So force blockchain poll
                            //  to process it now, and try to read message again
                            Catenis.txMonitor.forceBlockchainPoll();
                            retry = true;
                            alreadyRetried = true;
                        }
                        else {
                            // Have already retried but error persists. Just return error
                            error = errorResponse.call(this, 500, 'Internal server error');
                        }
                    }
                    else {
                        error = errorResponse.call(this, 500, 'Internal server error');
                    }
                }
                else {
                    error = errorResponse.call(this, 500, 'Internal server error');
                }

                if (error) {
                    if (error.statusCode === 500) {
                        Catenis.logger.ERROR('Error processing \'messages/:messageId\' API request.', err);
                    }

                    return error;
                }
            }
        }
        while (retry);

        // Prepare result
        const result = {};

        if (msgInfo.originDevice.deviceId !== this.user.device.deviceId) {
            result.from = {
                deviceId: msgInfo.originDevice.deviceId
            };

            // Add origin device public properties
            _und.extend(result.from, msgInfo.originDevice.getPublicProps());
        }

        if (msgInfo.action === Message.action.send && msgInfo.targetDevice.deviceId !== this.user.device.deviceId) {
            result.to = {
                deviceId: msgInfo.targetDevice.deviceId
            };

            // Add target device public properties
            _und.extend(result.to, msgInfo.targetDevice.getPublicProps());
        }

        result.message = msgInfo.message.toString(optEncoding);

        // Return success
        return successResponse.call(this, result);
    }
    catch (err) {
        Catenis.logger.ERROR('Error processing \'messages/:messageId\' API request.', err);
        return errorResponse.call(this, 500, 'Internal server error');
    }
}


// Module code
//

