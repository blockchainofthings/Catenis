/**
 * Created by Claudio on 2019-03-04.
 */

//console.log('[ApiSendMessage3.js]: This code just ran.');

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
import { successResponse, errorResponse } from './RestApi';
import { isValidMsgEncoding, isValidMsgStorage } from './ApiLogMessage2';

// Config entries
/*const config_entryConfig = config.get('config_entry');

 // Configuration settings
 const cfgSettings = {
 property: config_entryConfig.get('property_name')
 };*/


// Definition of module (private) functions
//

// Method used to process 'messages/send' endpoint of Rest API
//
//  JSON payload: {
//    "message": [String|Object] {  - The message to send. If a string is passed, it is assumed to be the whole message's contents. Otherwise, it is
//                                     expected that the message be passed in chunks using the following object to control it
//      "data": [String],               - The current message data chunk. The actual message's contents should be comprised of one or more data chunks
//      "isFinal": [Boolean],           - (optional, default: "true") Indicates whether this is the final (or the single) message data chunk
//      "continuationToken": [String]   - (optional) - Indicates that this is a continuation message data chunk. This should be filled with the value
//                                         returned in the 'continuationToken' field of the response from the previously sent message data chunk
//    },
//    "targetDevice": {   - (optional) The target device. Note that, when message is passed in chunks, this parameter is only taken into consideration
//                                      for the final message data chunk; for all previous message data chunks, it can be omitted. In any other cases,
//                                      this is a required parameter
//      "id": [String],                 - ID of target device. Should be Catenis device ID unless isProdUniqueId is true
//      "isProdUniqueId": [Boolean]     - (optional, default: false) Indicate whether supply ID is a product unique ID (otherwise, if should be a Catenis device Id)
//    },
//    "options": {
//      "encoding": [String],          - (optional, default: "utf8") One of the following values identifying the encoding of the message: "utf8"|"base64"|"hex"
//      "encrypt":  [Boolean],         - (optional, default: true) Indicates whether message should be encrypted before storing. Note that, when message is passed
//                                        in chunks, this option is only taken into consideration for the final message data chunk, and it shall be applied to the
//                                        message's contents as a whole
//      "storage": [String],           - (optional, default: "auto") - One of the following values identifying where the message should be stored: "auto"|"embedded"|"external".
//                                        Note that, when message is passed in chunks, this option is only taken into consideration for the final message data chunk,
//                                        and it shall be applied to the message's contents as a whole
//      "readConfirmation": [Boolean], - (optional, default: false) Indicates whether message should be sent with read confirmation enabled.
//                                        Note that, when message is passed in chunks, this option is only taken into consideration for the final message data chunk,
//                                        and it shall be applied to the message's contents as a whole
//      "async": [Boolean]             - (optional, default: "false") - Indicates whether processing should be done asynchronously. If set to true, a provisional
//                                        message ID is returned, which should be used to retrieve the processing outcome by calling the MessageProgress API method.
//                                        Note that, when message is passed in chunks, this option is only taken into consideration for the final message data chunk,
//                                        and it shall be applied to the message's contents as a whole
//    }
//  }
//
//  Success data returned: {
//    "messageId": [String]       // ID of sent message
//  }
//  Success data returned: {
//    "continuationToken": [String] - (optional) Token to be used when sending the following message data chunk. Returned if message passed in chunks
//                                     and last message data chunk was not final
//    "messageId": [String]  - (optional) ID of sent message. Returned after the whole message's contents is sent if not doing asynchronous processing
//    "provisionalMessageId": [String]  - (optional) Provisional message ID. Returned after the whole message's contents is sent if doing asynchronous processing
//  }
export function sendMessage3() {
    try {
        // Process request parameters

        // message param
        if (!((typeof this.bodyParams.message === 'string' && this.bodyParams.message.length > 0) || (typeof this.bodyParams.message === 'object' && this.bodyParams.message !== null))) {
            Catenis.logger.DEBUG('Invalid \'message\' parameter POST for POST \'messages/send\' API request', this.bodyParams);
            return errorResponse.call(this, 400, 'Invalid parameters');
        }

        let messageData;
        let nonFinalDataChunk = false;

        if (typeof this.bodyParams.message === 'object') {
            // message.data param
            if (!(typeof this.bodyParams.message.data === 'string' && this.bodyParams.message.data.length > 0)) {
                Catenis.logger.DEBUG('Invalid \'message.data\' parameter for POST \'messages/send\' API request', this.bodyParams);
                return errorResponse.call(this, 400, 'Invalid parameters');
            }

            messageData = this.bodyParams.message.data;

            // message.isFinal param
            if (!(typeof this.bodyParams.message.isFinal === 'undefined' || typeof this.bodyParams.message.isFinal === 'boolean')) {
                Catenis.logger.DEBUG('Invalid \'message.isFinal\' parameter for POST \'messages/send\' API request', this.bodyParams);
                return errorResponse.call(this, 400, 'Invalid parameters');
            }

            nonFinalDataChunk = !this.bodyParams.message.isFinal;

            // message.continuationToken param
            if (!(typeof this.bodyParams.message.continuationToken === 'undefined' || (typeof this.bodyParams.message.continuationToken === 'string' && this.bodyParams.message.continuationToken.length > 0))) {
                Catenis.logger.DEBUG('Invalid \'message.continuationToken\' parameter for POST \'messages/send\' API request', this.bodyParams);
                return errorResponse.call(this, 400, 'Invalid parameters');
            }
        }
        else {
            messageData = this.bodyParams.message;
        }

        // Only take the following parameter into consideration if message not passed in chunks or this
        //  is the final chunk of the message
        let targetDeviceId;

        if (!nonFinalDataChunk) {
            // targetDevice param
            if (!(typeof this.bodyParams.targetDevice === 'object' && this.bodyParams.targetDevice !== null)) {
                Catenis.logger.DEBUG('Invalid \'targetDevice\' parameter POST for POST \'messages/send\' API request', this.bodyParams);
                return errorResponse.call(this, 400, 'Invalid parameters');
            }

            if (typeof this.bodyParams.targetDevice === 'object') {
                // targetDevice.id param
                if (!(typeof this.bodyParams.targetDevice.id === 'string' && this.bodyParams.targetDevice.id.length > 0)) {
                    Catenis.logger.DEBUG('Invalid \'targetDevice.id\' parameter POST for POST \'messages/send\' API request', this.bodyParams);
                    return errorResponse.call(this, 400, 'Invalid parameters');
                }

                // targetDevice.isProdUniqueId param
                if (!(typeof this.bodyParams.targetDevice.isProdUniqueId === 'undefined' || typeof this.bodyParams.targetDevice.isProdUniqueId === 'boolean')) {
                    Catenis.logger.DEBUG('Invalid \'targetDevice.isProdUniqueId\' parameter POST for POST \'messages/send\' API request', this.bodyParams);
                    return errorResponse.call(this, 400, 'Invalid parameters');
                }

                // Prepare target device ID
                targetDeviceId = this.bodyParams.targetDevice.id;

                if (typeof this.bodyParams.targetDevice.isProdUniqueId !== 'undefined' && this.bodyParams.targetDevice.isProdUniqueId) {
                    let targetDevice;

                    try {
                        targetDevice = Device.getDeviceByProductUniqueId(this.bodyParams.targetDevice.id, false);
                    }
                    catch (err) {
                        let error;

                        if ((err instanceof Meteor.Error) && err.error === 'ctn_device_not_found') {
                            error = errorResponse.call(this, 400, 'Invalid target device');
                        }
                        else {
                            error = errorResponse.call(this, 500, 'Internal server error');
                            Catenis.logger.ERROR('Error processing \'messages/send\' API request.', err);
                        }

                        return error;
                    }

                    targetDeviceId = targetDevice.deviceId;
                }
            }
        }

        let optEncoding = 'utf8',
            optEncrypt = true,
            optStorage = 'auto',
            optReadConfirmation = false,
            optAsync = false;

        // options param
        if (!(typeof this.bodyParams.options === 'undefined' || (typeof this.bodyParams.options === 'object' && this.bodyParams.options !== null))) {
            Catenis.logger.DEBUG('Invalid \'options\' parameter POST for POST \'messages/send\' API request', this.bodyParams);
            return errorResponse.call(this, 400, 'Invalid parameters');
        }

        if (typeof this.bodyParams.options !== 'undefined') {
            // options.encoding
            if (!(typeof this.bodyParams.options.encoding === 'undefined' || (typeof this.bodyParams.options.encoding === 'string' && isValidMsgEncoding(this.bodyParams.options.encoding)))) {
                Catenis.logger.DEBUG('Invalid \'options.encoding\' parameter POST for POST \'messages/send\' API request', this.bodyParams);
                return errorResponse.call(this, 400, 'Invalid parameters');
            }

            if (typeof this.bodyParams.options.encoding !== 'undefined') {
                optEncoding = this.bodyParams.options.encoding;
            }

            // Only take the following options into consideration if message not passed in chunks or this
            //  is the final chunk of the message
            if (!nonFinalDataChunk) {
                // options.encrypt
                if (!(typeof this.bodyParams.options.encrypt === 'undefined' || typeof this.bodyParams.options.encrypt === 'boolean')) {
                    Catenis.logger.DEBUG('Invalid \'options.encrypt\' parameter POST for POST \'messages/send\' API request', this.bodyParams);
                    return errorResponse.call(this, 400, 'Invalid parameters');
                }

                if (typeof this.bodyParams.options.encrypt !== 'undefined') {
                    optEncrypt = this.bodyParams.options.encrypt;
                }

                // options.storage
                if (!(typeof this.bodyParams.options.storage === 'undefined' || (typeof this.bodyParams.options.storage === 'string' && isValidMsgStorage(this.bodyParams.options.storage)))) {
                    Catenis.logger.DEBUG('Invalid \'options.storage\' parameter POST for POST \'messages/send\' API request', this.bodyParams);
                    return errorResponse.call(this, 400, 'Invalid parameters');
                }

                if (typeof this.bodyParams.options.storage !== 'undefined') {
                    optStorage = this.bodyParams.options.storage;
                }

                // options.readConfirmation
                if (!(typeof this.bodyParams.options.readConfirmation === 'undefined' || typeof this.bodyParams.options.readConfirmation === 'boolean')) {
                    Catenis.logger.DEBUG('Invalid \'options.readConfirmation\' parameter POST for POST \'messages/send\' API request', this.bodyParams);
                    return errorResponse.call(this, 400, 'Invalid parameters');
                }

                if (typeof this.bodyParams.options.readConfirmation !== 'undefined') {
                    optReadConfirmation = this.bodyParams.options.readConfirmation;
                }

                // options.async
                if (!(typeof this.bodyParams.options.async === 'undefined' || typeof this.bodyParams.options.async === 'boolean')) {
                    Catenis.logger.DEBUG('Invalid \'options.async\' parameter for POST \'messages/send\' API request', this.bodyParams);
                    return errorResponse.call(this, 400, 'Invalid parameters');
                }

                if (typeof this.bodyParams.options.async !== 'undefined') {
                    optAsync = this.bodyParams.options.async;
                }
            }
        }

        // Make sure that system is running and accepting API calls
        if (!Catenis.application.isRunning()) {
            Catenis.logger.DEBUG('System currently not available for fulfilling \'messages/send\' API request', {applicationStatus: Catenis.application.status});
            return errorResponse.call(this, 503, 'System currently not available; please try again at a later time');
        }

        // Prepare message
        let bufMsg;

        try {
            bufMsg = Buffer.from(messageData, optEncoding);
        }
        catch (err) {
            let error;

            if (err.name === 'TypeError') {
                error = errorResponse.call(this, 400, 'Invalid parameters');
                Catenis.logger.DEBUG('Incompatible encoding for \'message\' parameter of \'messages/send\' API request', this.bodyParams);
            }
            else {
                error = errorResponse.call(this, 500, 'Internal server error');
                Catenis.logger.ERROR('Error processing \'messages/send\' API request.', err);
            }

            return error;
        }

        // Make sure that buffer's contents match the original message
        if (bufMsg.toString(optEncoding) !== (optEncoding === 'hex' ? messageData.toLowerCase() : messageData)) {
            Catenis.logger.DEBUG('Incompatible encoding for \'message\' parameter of \'messages/send\' API request', this.bodyParams);
            return errorResponse.call(this, 400, 'Invalid parameters');
        }

        let msg;

        if (typeof this.bodyParams.message === 'object') {
            msg = {
                dataChunk: bufMsg,
                isFinal: this.bodyParams.message.isFinal !== undefined ? this.bodyParams.message.isFinal : true
            };

            if (this.bodyParams.message.continuationToken) {
                msg.continuationToken = this.bodyParams.message.continuationToken;
            }
        }
        else {
            msg = bufMsg;
        }

        // Execute method to send message
        let sendResult;

        try {
            sendResult = this.user.device.sendMessage2(msg, targetDeviceId, optEncrypt, optStorage, optReadConfirmation, undefined, optAsync);
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
                else if (err.error === 'ctn_prov_msg_already_complete') {
                    error = errorResponse.call(this, 400, 'Message already complete');
                }
                else if (err.error === 'ctn_prov_msg_not_found' || err.error === 'ctn_prov_msg_wrong_device' || err.error === 'ctn_prov_msg_invalid_cont_token') {
                    error = errorResponse.call(this, 400, 'Invalid or unexpected continuation token');
                }
                else if (err.error === 'ctn_prov_msg_expired') {
                    error = errorResponse.call(this, 400, 'Message has expired');
                }
                else if (err.error === 'ctn_device_target_deleted' || err.error === 'ctn_device_target_not_active'
                    || err.error === 'ctn_device_target_not_found') {
                    error = errorResponse.call(this, 400, 'Invalid target device');
                }
                else if (err.error === 'ctn_device_low_service_acc_balance') {
                    error = errorResponse.call(this, 400, 'Not enough credits to pay for send message service');
                }
                else if (err.error === 'ctn_msg_data_too_long') {
                    error = errorResponse.call(this, 400, 'Message too long to be embedded');
                }
                else {
                    error = errorResponse.call(this, 500, 'Internal server error');
                }
            }
            else {
                error = errorResponse.call(this, 500, 'Internal server error');
            }

            if (error.statusCode === 500) {
                Catenis.logger.ERROR('Error processing \'messages/send\' API request.', err);
            }

            return error;
        }

        // Return success
        return successResponse.call(this, sendResult);
    }
    catch (err) {
        Catenis.logger.ERROR('Error processing \'messages/send\' API request.', err);
        return errorResponse.call(this, 500, 'Internal server error');
    }
}


// Module code
//
