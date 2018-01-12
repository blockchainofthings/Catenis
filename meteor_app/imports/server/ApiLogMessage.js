/**
 * Created by claudio on 22/02/17.
 */

//console.log('[ApiLogMessage.js]: This code just ran.');

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

// Method used to process 'messages/log' endpoint of Rest API
//
//  JSON payload: {
//    "message": [String],      // The message to record
//    "options": {
//      "encoding": [String],   // (optional, default: "utf8") - One of the following values identifying the encoding of the message: "utf8"|"base64"|"hex"
//      "encrypt":  [Boolean],  // (optional, default: true) - Indicates whether message should be encrypted before storing
//      "storage": [String]     // (optional, default: "auto") - One of the following values identifying where the message should be stored: "auto"|"embedded"|"external"
//  }
//
//  Success data returned: {
//    "messageId": [String]       // ID of logged message
//  }
export function logMessage() {
    try {
        // Process request parameters

        // message param
        if (!(typeof this.bodyParams.message === 'string' && this.bodyParams.message.length > 0)) {
            Catenis.logger.DEBUG('Invalid \'message\' parameter for \'messages/log\' API request', this.bodyParams);
            return errorResponse.call(this, 400, 'Invalid parameters');
        }

        let optEncoding = 'utf8',
            optEncrypt = true,
            optStorage = 'auto';

        // options param
        if (!(typeof this.bodyParams.options === 'undefined' || (typeof this.bodyParams.options === 'object' && this.bodyParams.options !== null))) {
            Catenis.logger.DEBUG('Invalid \'options\' parameter for \'messages/log\' API request', this.bodyParams);
            return errorResponse.call(this, 400, 'Invalid parameters');
        }

        if (typeof this.bodyParams.options !== 'undefined') {
            // options.encoding
            if (!(typeof this.bodyParams.options.encoding === 'undefined' || (typeof this.bodyParams.options.encoding === 'string' && isValidMsgEncoding(this.bodyParams.options.encoding)))) {
                Catenis.logger.DEBUG('Invalid \'options.encoding\' parameter for \'messages/log\' API request', this.bodyParams);
                return errorResponse.call(this, 400, 'Invalid parameters');
            }

            if (typeof this.bodyParams.options.encoding !== 'undefined') {
                optEncoding = this.bodyParams.options.encoding;
            }

            // options.encrypt
            if (!(typeof this.bodyParams.options.encrypt === 'undefined' || typeof this.bodyParams.options.encrypt === 'boolean')) {
                Catenis.logger.DEBUG('Invalid \'options.encrypt\' parameter for \'messages/log\' API request', this.bodyParams);
                return errorResponse.call(this, 400, 'Invalid parameters');
            }

            if (typeof this.bodyParams.options.encrypt !== 'undefined') {
                optEncrypt = this.bodyParams.options.encrypt;
            }

            // options.storage
            if (!(typeof this.bodyParams.options.storage === 'undefined' || (typeof this.bodyParams.options.storage === 'string' && isValidMsgStorage(this.bodyParams.options.storage)))) {
                Catenis.logger.DEBUG('Invalid \'options.storage\' parameter for \'messages/log\' API request', this.bodyParams);
                return errorResponse.call(this, 400, 'Invalid parameters');
            }

            if (typeof this.bodyParams.options.storage !== 'undefined') {
                optStorage = this.bodyParams.options.storage;
            }
        }

        // Make sure that system is running and accepting API calls
        if (!Catenis.application.isRunning()) {
            Catenis.logger.DEBUG('System currently not available for fulfilling \'messages/log\' API request', {applicationStatus: Catenis.application.status});
            return errorResponse.call(this, 503, 'System currently not available; please try again at a later time');
        }

        // Prepare message
        let msg;

        try {
            msg = Buffer.from(this.bodyParams.message, optEncoding);
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
        if (msg.toString(optEncoding) !== this.bodyParams.message) {
            Catenis.logger.DEBUG('Incompatible encoding for \'message\' parameter of \'messages/log\' API request', this.bodyParams);
            return errorResponse.call(this, 400, 'Invalid parameters');
        }

        // Execute method to log message
        let messageId;

        try {
            messageId = this.user.device.logMessage(msg, optEncrypt, optStorage);
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
                else if (err.error === 'ctn_device_no_credits') {
                    error = errorResponse.call(this, 400, 'No credit to log message');
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
        return successResponse.call(this, {
            messageId: messageId
        });
    }
    catch (err) {
        Catenis.logger.ERROR('Error processing \'messages/log\' API request.', err);
        return errorResponse.call(this, 500, 'Internal server error');
    }
}

export function isValidMsgEncoding(val) {
    return val === 'utf8' || val === 'base64' || val === 'hex';
}

export function isValidMsgStorage(val) {
    return val === 'embedded' || val === 'external' || val === 'auto';
}


// Module code
//

