/**
 * Created by claudio on 2021-08-03.
 */

//console.log('[ApiSendMessage5.js]: This code just ran.');

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
import { isValidMsgEncoding, isValidMsgStorage } from './ApiLogMessage';
import { Util } from './Util';

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
//      "data": [String],               - (optional) The current message data chunk. The actual message's contents should be comprised of one or more data chunks.
//                                         NOTE that, when sending a final message data chunk (isFinal = true and continuationToken specified), this parameter
//                                         may either be omitted or have an empty string value
//      "isFinal": [Boolean],           - (optional, default: "true") Indicates whether this is the final (or the single) message data chunk
//      "continuationToken": [String]   - (optional) - Indicates that this is a continuation message data chunk. This should be filled with the value
//                                         returned in the 'continuationToken' field of the response from the previously sent message data chunk
//    },
//    "targetDevice": {   - (optional) The target device. Note that, when message is passed in chunks, this parameter is only taken into consideration
//                                      (and thus only needs to be passed) for the final message data chunk; for all previous message data chunks, it
//                                      can be omitted. Otherwise, this is a required parameter
//      "id": [String],                 - ID of target device. Should be Catenis device ID unless isProdUniqueId is true
//      "isProdUniqueId": [Boolean]     - (optional, default: false) Indicate whether supply ID is a product unique ID (otherwise, if should be a Catenis device Id)
//    },
//    "options": {
//      "encoding": [String],          - (optional, default: "utf8") One of the following values identifying the encoding of the message: "utf8"|"base64"|"hex"
//      "encrypt":  [Boolean],         - (optional, default: true) Indicates whether message should be encrypted before storing. NOTE that, when message is passed
//                                        in chunks, this option is only taken into consideration (and thus only needs to be passed) for the final message data chunk,
//                                        and it shall be applied to the message's contents as a whole
//      "offChain": [Boolean],         - (optional, default: true) Indicates whether message should be processed as a Catenis off-chain message. Catenis off-chain messages
//                                        are stored on the external storage repository and only later its reference is settled to the blockchain along with references of
//                                        other off-chain messages. NOTE that, when message is passed in chunks, this option is only taken into consideration (and thus
//                                        only needs to be passed) for the final message data chunk, and it shall be applied to the message's contents as a whole
//      "storage": [String],           - (optional, default: "auto") - One of the following values identifying where the message should be stored: "auto"|"embedded"|"external".
//                                        NOTE that, when message is passed in chunks, this option is only taken into consideration (and thus only needs to be passed)
//                                        for the final message data chunk, and it shall be applied to the message's contents as a whole. ALSO note that, when the offChain
//                                        option is set to true, this option's value is disregarded and the processing is done as if the value "external" was passed
//      "readConfirmation": [Boolean], - (optional, default: false) Indicates whether message should be sent with read confirmation enabled.
//                                        NOTE that, when message is passed in chunks, this option is only taken into consideration (and thus only needs to be passed)
//                                        for the final message data chunk, and it shall be applied to the message's contents as a whole
//      "async": [Boolean]             - (optional, default: "false") - Indicates whether processing (storage of message to the blockchain) should be done
//                                        asynchronously. If set to true, a provisional message ID is returned, which should be used to retrieve the processing
//                                        outcome by calling the MessageProgress API method. NOTE that, when message is passed in chunks, this option is
//                                        only taken into consideration (and thus only needs to be passed) for the final message data chunk, and it shall be
//                                        applied to the message's contents as a whole
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
export function sendMessage5() {
    try {
        // Process request parameters
        let invalidParams = [];

        // message param
        let invalidMessage = false;
        let messageParam;
        let messageData;
        let isMsgComplete = true;

        if (Util.isNonNullObject(this.bodyParams.message)) {
            // message.data param
            if (!(typeof this.bodyParams.message.data === 'undefined' || typeof this.bodyParams.message.data === 'string')) {
                Catenis.logger.DEBUG('Invalid \'message.data\' parameter for POST \'messages/send\' API request', this.bodyParams);
                invalidParams.push('message.data');
                invalidMessage = true;
            }

            // message.isFinal param
            if (typeof this.bodyParams.message.isFinal === 'boolean') {
                isMsgComplete = this.bodyParams.message.isFinal;
            }
            else if (this.bodyParams.message.isFinal !== undefined) {
                Catenis.logger.DEBUG('Invalid \'message.isFinal\' parameter for POST \'messages/send\' API request', this.bodyParams);
                invalidParams.push('message.isFinal');
            }

            // message.continuationToken param
            let hasContinuationToken = false;

            if (typeof this.bodyParams.message.continuationToken === 'string' && this.bodyParams.message.continuationToken.length > 0) {
                hasContinuationToken = true;
            }
            else if (this.bodyParams.message.continuationToken !== undefined) {
                Catenis.logger.DEBUG('Invalid \'message.continuationToken\' parameter for POST \'messages/send\' API request', this.bodyParams);
                invalidParams.push('message.continuationToken');
            }

            if (!invalidMessage) {
                if (this.bodyParams.message.data !== undefined && this.bodyParams.message.data.length > 0) {
                    messageData = this.bodyParams.message.data;
                    messageParam = 'message.data';
                }
                else {
                    // Message not specified. Make sure that this is a final message data chunk
                    if (!(isMsgComplete && hasContinuationToken)) {
                        Catenis.logger.DEBUG('Invalid \'message.data\' parameter for POST \'messages/send\' API request', this.bodyParams);
                        invalidParams.push('message.data');
                        invalidMessage = true;
                    }
                }
            }
        }
        else if (typeof this.bodyParams.message === 'string' && this.bodyParams.message.length > 0) {
            messageData = this.bodyParams.message;
            messageParam = 'message';
        }
        else {
            Catenis.logger.DEBUG('Invalid \'message\' parameter for POST \'messages/send\' API request', this.bodyParams);
            invalidParams.push('message');
            invalidMessage = true;
        }

        // Only take the following parameter into consideration if message is complete (not passed in chunks or this
        //  is the final chunk of the message)
        let targetDeviceId;

        if (isMsgComplete) {
            // targetDevice param
            if (Util.isNonNullObject(this.bodyParams.targetDevice)) {
                // targetDevice.id param
                let invalidTargetDeviceId = false;

                if (!(typeof this.bodyParams.targetDevice.id === 'string' && this.bodyParams.targetDevice.id.length > 0)) {
                    Catenis.logger.DEBUG('Invalid \'targetDevice.id\' parameter for POST \'messages/send\' API request', this.bodyParams);
                    invalidParams.push('targetDevice.id');
                    invalidTargetDeviceId = true;
                }

                // targetDevice.isProdUniqueId param
                let isProdUniqueId = false;

                if (typeof this.bodyParams.targetDevice.isProdUniqueId === 'boolean') {
                    isProdUniqueId = this.bodyParams.targetDevice.isProdUniqueId;
                }
                else if (this.bodyParams.targetDevice.isProdUniqueId !== undefined) {
                    Catenis.logger.DEBUG('Invalid \'targetDevice.isProdUniqueId\' parameter for POST \'messages/send\' API request', this.bodyParams);
                    invalidParams.push('targetDevice.isProdUniqueId');
                }

                if (!invalidTargetDeviceId) {
                    // Prepare target device ID
                    targetDeviceId = this.bodyParams.targetDevice.id;

                    if (isProdUniqueId) {
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
            else {
                Catenis.logger.DEBUG('Invalid \'targetDevice\' parameter for POST \'messages/send\' API request', this.bodyParams);
                invalidParams.push('targetDevice');
            }
        }

        // options param
        let optEncoding = 'utf8',
            optEncrypt = true,
            optOffChain = true,
            optStorage = 'auto',
            optReadConfirmation = false,
            optAsync = false;

        if (Util.isNonNullObject(this.bodyParams.options)) {
            // options.encoding
            if (typeof this.bodyParams.options.encoding === 'string' && isValidMsgEncoding(this.bodyParams.options.encoding)) {
                optEncoding = this.bodyParams.options.encoding;
            }
            else if (this.bodyParams.options.encoding !== undefined) {
                Catenis.logger.DEBUG('Invalid \'options.encoding\' parameter for POST \'messages/send\' API request', this.bodyParams);
                invalidParams.push('options.encoding');
            }

            // Only take the following options into consideration if message not passed in chunks or this
            //  is the final chunk of the message
            if (isMsgComplete) {
                // options.encrypt
                if (typeof this.bodyParams.options.encrypt === 'boolean') {
                    optEncrypt = this.bodyParams.options.encrypt;
                }
                else if (this.bodyParams.options.encrypt !== undefined) {
                    Catenis.logger.DEBUG('Invalid \'options.encrypt\' parameter for POST \'messages/send\' API request', this.bodyParams);
                    invalidParams.push('options.encrypt');
                }

                // options.offChain
                if (typeof this.bodyParams.options.offChain === 'boolean') {
                    optOffChain = this.bodyParams.options.offChain;
                }
                else if (this.bodyParams.options.offChain !== undefined) {
                    Catenis.logger.DEBUG('Invalid \'options.offChain\' parameter for POST \'messages/send\' API request', this.bodyParams);
                    invalidParams.push('options.offChain');
                }

                // options.storage
                if (typeof this.bodyParams.options.storage === 'string' && isValidMsgStorage(this.bodyParams.options.storage)) {
                    optStorage = this.bodyParams.options.storage;
                }
                else if (this.bodyParams.options.storage !== undefined) {
                    Catenis.logger.DEBUG('Invalid \'options.storage\' parameter for POST \'messages/send\' API request', this.bodyParams);
                    invalidParams.push('options.storage');
                }

                // options.readConfirmation
                if (typeof this.bodyParams.options.readConfirmation === 'boolean') {
                    optReadConfirmation = this.bodyParams.options.readConfirmation;
                }
                else if (this.bodyParams.options.readConfirmation !== undefined) {
                    Catenis.logger.DEBUG('Invalid \'options.readConfirmation\' parameter for POST \'messages/send\' API request', this.bodyParams);
                    invalidParams.push('options.readConfirmation');
                }

                // options.async
                if (typeof this.bodyParams.options.async === 'boolean') {
                    optAsync = this.bodyParams.options.async;
                }
                else if (this.bodyParams.options.async !== undefined) {
                    Catenis.logger.DEBUG('Invalid \'options.async\' parameter for POST \'messages/send\' API request', this.bodyParams);
                    invalidParams.push('options.async');
                }
            }
        }
        else if (this.bodyParams.options !== undefined) {
            Catenis.logger.DEBUG('Invalid \'options\' parameter for POST \'messages/send\' API request', this.bodyParams);
            invalidParams.push('options');
        }

        let bufMsg;

        if (!invalidMessage && messageData) {
            // Validate message encoding
            try {
                bufMsg = Buffer.from(messageData, optEncoding);
            }
            catch (err) {
                if (err.name === 'TypeError') {
                    Catenis.logger.DEBUG(`Incompatible encoding for \'${messageParam}\' parameter of \'messages/send\' API request`, this.bodyParams);
                    invalidParams.push(messageParam);
                    invalidMessage = true;
                }
                else {
                    Catenis.logger.ERROR('Error processing \'messages/send\' API request.', err);
                    return errorResponse.call(this, 500, 'Internal server error');
                }
            }

            if (!invalidMessage) {
                // Make sure that buffer's contents match the original message
                if (bufMsg.toString(optEncoding) !== (optEncoding === 'hex' ? messageData.toLowerCase() : messageData)) {
                    Catenis.logger.DEBUG(`Incompatible encoding for \'${messageParam}\' parameter of \'messages/send\' API request`, this.bodyParams);
                    invalidParams.push(messageParam);
                }
            }
        }

        if (invalidParams.length > 0) {
            return errorResponse.call(this, 400, `Invalid parameters: ${invalidParams.join(', ')}`);
        }

        // Make sure that system is running and accepting API calls
        if (!Catenis.application.isRunning()) {
            Catenis.logger.DEBUG('System currently not available for fulfilling \'messages/send\' API request', {applicationStatus: Catenis.application.status});
            return errorResponse.call(this, 503, 'System currently not available; please try again at a later time');
        }

        // Prepare message
        let msg;

        if (typeof this.bodyParams.message === 'object') {
            msg = {
                dataChunk: bufMsg,
                isFinal: isMsgComplete
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
            sendResult = this.user.device.sendMessage3(msg, targetDeviceId, optEncrypt, optOffChain, optStorage, optReadConfirmation, undefined, optAsync);
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
                else if (err.error === 'ctn_prov_msg_already_complete') {
                    error = errorResponse.call(this, 400, 'Message already complete');
                }
                else if (err.error === 'ctn_prov_msg_not_found' || err.error === 'ctn_prov_msg_wrong_device' || err.error === 'ctn_prov_msg_invalid_cont_token' || err.error === 'ctn_prov_msg_no_contents') {
                    error = errorResponse.call(this, 400, 'Invalid or unexpected continuation token');
                }
                else if (err.error === 'ctn_prov_msg_expired') {
                    error = errorResponse.call(this, 400, 'Message expired');
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
