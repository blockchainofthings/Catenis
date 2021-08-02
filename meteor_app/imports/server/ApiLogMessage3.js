/**
 * Created by claudio on 2019-12-27
 */

//console.log('[ApiLogMessage3.js]: This code just ran.');

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
import { isValidMsgEncoding, isValidMsgStorage } from './ApiLogMessage';


// Definition of module (private) functions
//

// Method used to process 'messages/log' endpoint of Rest API
//
//  JSON payload: {
//    "message": [String|Object] {  - The message to record. If a string is passed, it is assumed to be the whole message's contents. Otherwise, it is
//                                     expected that the message be passed in chunks using the following object to control it
//      "data": [String],               - (optional) The current message data chunk. The actual message's contents should be comprised of one or more data chunks.
//                                         NOTE that, when sending a final message data chunk (isFinal = true and continuationToken specified), this parameter
//                                         may either be omitted or have an empty string value
//      "isFinal": [Boolean],           - (optional, default: "true") Indicates whether this is the final (or the single) message data chunk
//      "continuationToken": [String]   - (optional) - Indicates that this is a continuation message data chunk. This should be filled with the value
//                                         returned in the 'continuationToken' field of the response from the previously sent message data chunk
//    },
//    "options": {
//      "encoding": [String],   - (optional, default: "utf8") One of the following values identifying the encoding of the message: "utf8"|"base64"|"hex"
//      "encrypt":  [Boolean],  - (optional, default: true) Indicates whether message should be encrypted before storing. NOTE that, when message is passed
//                                 in chunks, this option is only taken into consideration (and thus only needs to be passed) for the final message data chunk,
//                                 and it shall be applied to the message's contents as a whole
//      "offChain": [Boolean],  - (optional, default: true) Indicates whether message should be processed as a Catenis off-chain message. Catenis off-chain messages
//                                 are stored on the external storage repository and only later its reference is settled to the blockchain along with references of
//                                 other off-chain messages. NOTE that, when message is passed in chunks, this option is only taken into consideration (and thus
//                                 only needs to be passed) for the final message data chunk, and it shall be applied to the message's contents as a whole
//      "storage": [String],    - (optional, default: "auto") - One of the following values identifying where the message should be stored: "auto"|"embedded"|"external".
//                                 NOTE that, when message is passed in chunks, this option is only taken into consideration (and thus only needs to be passed)
//                                 for the final message data chunk, and it shall be applied to the message's contents as a whole. ALSO note that, when the offChain
//                                 option is set to true, this option's value is disregarded and the processing is done as if the value "external" was passed
//      "async": [Boolean]      - (optional, default: "false") - Indicates whether processing (storage of message) should be done asynchronously.
//                                 If set to true, a provisional message ID is returned, which should be used to retrieve the processing outcome by calling
//                                 the MessageProgress API method. NOTE that, when message is passed in chunks, this option is only taken into consideration
//                                 (and thus only needs to be passed) for the final message data chunk, and it shall be applied to the message's contents as a whole
//    }
//  }
//
//  Success data returned: {
//    "continuationToken": [String]    - (optional) Token to be used when sending the following message data chunk. Returned if message passed in chunks
//                                        and last message data chunk was not final
//    "messageId": [String]            - (optional) ID of logged message. Returned after the whole message's contents is received and stored to the blockchain
//                                        if not doing asynchronous processing
//    "provisionalMessageId": [String] - (optional) Provisional message ID. Returned right after the whole message's contents is received if doing asynchronous processing
//  }
export function logMessage3() {
    try {
        // Process request parameters

        // message param
        if (!((typeof this.bodyParams.message === 'string' && this.bodyParams.message.length > 0) || (typeof this.bodyParams.message === 'object' && this.bodyParams.message !== null))) {
            Catenis.logger.DEBUG('Invalid \'message\' parameter for POST \'messages/log\' API request', this.bodyParams);
            return errorResponse.call(this, 400, 'Invalid parameters');
        }

        let messageData;
        let isMsgComplete = true;

        if (typeof this.bodyParams.message === 'object') {
            // message.data param
            if (!(typeof this.bodyParams.message.data === 'undefined' || typeof this.bodyParams.message.data === 'string')) {
                Catenis.logger.DEBUG('Invalid \'message.data\' parameter for POST \'messages/log\' API request', this.bodyParams);
                return errorResponse.call(this, 400, 'Invalid parameters');
            }

            // message.isFinal param
            if (!(typeof this.bodyParams.message.isFinal === 'undefined' || typeof this.bodyParams.message.isFinal === 'boolean')) {
                Catenis.logger.DEBUG('Invalid \'message.isFinal\' parameter for POST \'messages/log\' API request', this.bodyParams);
                return errorResponse.call(this, 400, 'Invalid parameters');
            }

            isMsgComplete = this.bodyParams.message.isFinal !== undefined ? this.bodyParams.message.isFinal : true;

            // message.continuationToken param
            if (!(typeof this.bodyParams.message.continuationToken === 'undefined' || (typeof this.bodyParams.message.continuationToken === 'string' && this.bodyParams.message.continuationToken.length > 0))) {
                Catenis.logger.DEBUG('Invalid \'message.continuationToken\' parameter for POST \'messages/log\' API request', this.bodyParams);
                return errorResponse.call(this, 400, 'Invalid parameters');
            }

            // Make sure that message is specified if not sending a final message data chunk
            if (typeof this.bodyParams.message.data !== 'undefined' && this.bodyParams.message.data.length > 0) {
                messageData = this.bodyParams.message.data;
            }
            else if (!(isMsgComplete && typeof this.bodyParams.message.continuationToken !== 'undefined')) {
                Catenis.logger.DEBUG('Invalid \'message.data\' parameter for POST \'messages/log\' API request', this.bodyParams);
                return errorResponse.call(this, 400, 'Invalid parameters');
            }
        }
        else {
            messageData = this.bodyParams.message;
        }

        let optEncoding = 'utf8',
            optEncrypt = true,
            optOffChain = true,
            optStorage = 'auto',
            optAsync = false;

        // options param
        if (!(typeof this.bodyParams.options === 'undefined' || (typeof this.bodyParams.options === 'object' && this.bodyParams.options !== null))) {
            Catenis.logger.DEBUG('Invalid \'options\' parameter for POST \'messages/log\' API request', this.bodyParams);
            return errorResponse.call(this, 400, 'Invalid parameters');
        }

        if (typeof this.bodyParams.options !== 'undefined') {
            // options.encoding
            if (!(typeof this.bodyParams.options.encoding === 'undefined' || (typeof this.bodyParams.options.encoding === 'string' && isValidMsgEncoding(this.bodyParams.options.encoding)))) {
                Catenis.logger.DEBUG('Invalid \'options.encoding\' parameter for POST \'messages/log\' API request', this.bodyParams);
                return errorResponse.call(this, 400, 'Invalid parameters');
            }

            if (typeof this.bodyParams.options.encoding !== 'undefined') {
                optEncoding = this.bodyParams.options.encoding;
            }

            // Only take the following options into consideration if message is complete (not passed in chunks or this
            //  is the final chunk of the message)
            if (isMsgComplete) {
                // options.encrypt
                if (!(typeof this.bodyParams.options.encrypt === 'undefined' || typeof this.bodyParams.options.encrypt === 'boolean')) {
                    Catenis.logger.DEBUG('Invalid \'options.encrypt\' parameter for POST \'messages/log\' API request', this.bodyParams);
                    return errorResponse.call(this, 400, 'Invalid parameters');
                }

                if (typeof this.bodyParams.options.encrypt !== 'undefined') {
                    optEncrypt = this.bodyParams.options.encrypt;
                }

                // options.offChain
                if (!(typeof this.bodyParams.options.offChain === 'undefined' || typeof this.bodyParams.options.offChain === 'boolean')) {
                    Catenis.logger.DEBUG('Invalid \'options.offChain\' parameter for POST \'messages/log\' API request', this.bodyParams);
                    return errorResponse.call(this, 400, 'Invalid parameters');
                }

                if (typeof this.bodyParams.options.offChain !== 'undefined') {
                    optOffChain = this.bodyParams.options.offChain;
                }

                // options.storage
                if (!(typeof this.bodyParams.options.storage === 'undefined' || (typeof this.bodyParams.options.storage === 'string' && isValidMsgStorage(this.bodyParams.options.storage)))) {
                    Catenis.logger.DEBUG('Invalid \'options.storage\' parameter for POST \'messages/log\' API request', this.bodyParams);
                    return errorResponse.call(this, 400, 'Invalid parameters');
                }

                if (typeof this.bodyParams.options.storage !== 'undefined') {
                    optStorage = this.bodyParams.options.storage;
                }

                // options.async
                if (!(typeof this.bodyParams.options.async === 'undefined' || typeof this.bodyParams.options.async === 'boolean')) {
                    Catenis.logger.DEBUG('Invalid \'options.async\' parameter for POST \'messages/log\' API request', this.bodyParams);
                    return errorResponse.call(this, 400, 'Invalid parameters');
                }

                if (typeof this.bodyParams.options.async !== 'undefined') {
                    optAsync = this.bodyParams.options.async;
                }
            }
        }

        // Make sure that system is running and accepting API calls
        if (!Catenis.application.isRunning()) {
            Catenis.logger.DEBUG('System currently not available for fulfilling \'messages/log\' API request', {applicationStatus: Catenis.application.status});
            return errorResponse.call(this, 503, 'System currently not available; please try again at a later time');
        }

        // Prepare message
        let bufMsg;

        if (messageData) {
            try {
                bufMsg = Buffer.from(messageData, optEncoding);
            }
            catch (err) {
                let error;

                if (err.name === 'TypeError') {
                    error = errorResponse.call(this, 400, 'Invalid parameters');
                    Catenis.logger.DEBUG('Incompatible encoding for \'message\' parameter of \'messages/log\' API request', this.bodyParams);
                }
                else {
                    error = errorResponse.call(this, 500, 'Internal server error');
                    Catenis.logger.ERROR('Error processing \'messages/log\' API request.', err);
                }

                return error;
            }

            // Make sure that buffer's contents match the original message
            if (bufMsg.toString(optEncoding) !== (optEncoding === 'hex' ? messageData.toLowerCase() : messageData)) {
                Catenis.logger.DEBUG('Incompatible encoding for \'message\' parameter of \'messages/log\' API request', this.bodyParams);
                return errorResponse.call(this, 400, 'Invalid parameters');
            }
        }

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

        // Execute method to log message
        let logResult;

        try {
            logResult = this.user.device.logMessage3(msg, optEncrypt, optOffChain, optStorage, undefined, optAsync);
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
                else if (err.error === 'ctn_device_low_service_acc_balance') {
                    error = errorResponse.call(this, 400, 'Not enough credits to pay for log message service');
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
                Catenis.logger.ERROR('Error processing \'messages/log\' API request.', err);
            }

            return error;
        }

        // Return success
        return successResponse.call(this, logResult);
    }
    catch (err) {
        Catenis.logger.ERROR('Error processing \'messages/log\' API request.', err);
        return errorResponse.call(this, 500, 'Internal server error');
    }
}
