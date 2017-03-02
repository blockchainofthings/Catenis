/**
 * Created by claudio on 19/01/17.
 */

//console.log('[RestApi.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//  NOTE: the reference of these modules are done sing 'require()' instead of 'import' to
//      to avoid annoying WebStorm warning message: 'default export is not defined in
//      imported module'
const crypto = require('crypto');
// Third-party node modules
import config from 'config';
import moment from 'moment';
// Meteor packages
import { Meteor } from 'meteor/meteor';
import { Restivus } from 'meteor/nimble:restivus';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { Device } from './Device';
import { logMessage } from './ApiLogMessage';
import { sendMessage } from './ApiSendMessage';
import { readMessage } from './ApiReadMessage';

// Config entries
const restApiConfig = config.get('restApi');
const apiReqSignConfig = restApiConfig.get('requestSignature');

// Configuration settings
const cfgSettings = {
    rootPath: restApiConfig.get('rootPath'),
    version: restApiConfig.get('version'),
    requestSignature: {
        signVersionId: apiReqSignConfig.get('signVersionId'),
        signMethodId: apiReqSignConfig.get('signMethodId'),
        scopeRequest: apiReqSignConfig.get('scopeRequest'),
        timestampHdr: apiReqSignConfig.get('timestampHdr'),
        allowedTimestampOffset: apiReqSignConfig.get('allowedTimestampOffset'),
        authRegexPattern: apiReqSignConfig.get('authRegexPattern'),
        signValidDays: apiReqSignConfig.get('signValidDays')
    }
};

const authRegex = new RegExp(cfgSettings.requestSignature.authRegexPattern.replace('<signMethodId>', cfgSettings.requestSignature.signMethodId)
        .replace('<scopeRequest>', cfgSettings.requestSignature.scopeRequest));

export const restApiRootPath = cfgSettings.rootPath;

// Definition of function classes
//

// RestApi function class
export function RestApi() {
    this.api = new Restivus({
        apiPath: cfgSettings.rootPath,
        auth: {
            user: authenticateDevice
        },
        useDefaultAuth: false,
        prettyJson: true,
        defaultHeaders: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Credentials': 'true'  // Required for CORS (Cross-Origin Resource Sharing)
        },
        enableCors: true,
        // Required to correctly respond to CORS (Cross-Origin Resource Sharing) preflight (OPTIONS) request
        defaultOptionsEndpoint: {
            authRequired: false,
            action: function () {
                this.response.writeHead(204, optionsResponseHeaders.call(this));
                this.done();
                return '';
            }
        },
        version: cfgSettings.version
    });

    this.api.addRoute('message/log', {authRequired: true}, {
        // Record message to blockchain
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
        //    "txid": [String],       // ID of blockchain transaction where message was recorded
        //    "extStorage": {         // (only returned if message stored in external storage)
        //      "<storage_provider_name>": [String]  // Key: storage provider name. Value: reference to message in external storage
        //    }
        //  }
        post: {
            action: logMessage
        }
    });

    this.api.addRoute('message/send', {authRequired: true}, {
        // Record message to blockchain directing it to another device
        //
        //  JSON payload: {
        //    targetDevice: {
        //      id: [String],               // ID of target device. Should be Catenis device ID unless isProdUniqueId is true
        //      isProdUniqueId: [Boolean]   // (optional, default: false) Indicate whether supply ID is a product unique ID (otherwise, if should be a Catenis device Id)
        //    },
        //    message: [String],            // The message to send
        //    "options": {
        //      "encoding": [String],       // (optional, default: "utf8") - One of the following values identifying the encoding of the message: "utf8"|"base64"|"hex"
        //      "encrypt":  [Boolean],      // (optional, default: true) - Indicates whether message should be encrypted before storing
        //      "storage": [String]         // (optional, default: "auto") - One of the following values identifying where the message should be stored: "auto"|"embedded"|"external"
        //  }
        //
        //  Success data returned: {
        //    "txid": [String],       // ID of blockchain transaction where message was recorded
        //    "extStorage": {         // (only returned if message stored in external storage)
        //      "<storage_provider_name>": [String]  // Key: storage provider name. Value: reference to message in external storage
        //    }
        //  }
        post: {
            action: sendMessage
        }
    });

    this.api.addRoute('message/read/:txid', {authRequired: true}, {
        // Retrieve message from blockchain
        //
        //  URL parameters:
        //    txid [String]             // ID of blockchain transaction where message is written
        //
        //  Query string (optional) parameters:
        //    encoding [String]         // (default: utf8) - One of the following values identifying the encoding that should be used for the returned message: utf8|base64|hex
        //
        //  Success data returned: {
        //    "message": [String]       // ID of blockchain transaction where message is recorded
        //  }
        get: {
            action: readMessage
        }
    });
}


// Public RestApi object methods
//

/*RestApi.prototype.pub_func = function () {
};*/


// Module functions used to simulate private RestApi object methods
//  NOTE: these functions need to be bound to a RestApi object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// RestApi function class (public) methods
//

RestApi.initialize = function () {
    Catenis.logger.TRACE('RestApi initialization');
    // Instantiate RestApi object
    Catenis.restApi = new RestApi();
};


// RestApi function class (public) properties
//

/*RestApi.prop = {};*/


// Definition of module (private) functions
//

function authenticateDevice() {
    try {
        const dtNow = new Date(Date.now());

        // Make sure that required headers are present
        if (!(cfgSettings.requestSignature.timestampHdr in this.request.headers) || !('authorization' in this.request.headers)) {
            // Missing required HTTP headers. Return error
            return {
                error: errorResponse.call(this, 401, 'Authorization failed; missing required HTTP header')
            };
        }

        // Make sure that timestamp is valid
        const strTmstmp = this.request.headers[cfgSettings.requestSignature.timestampHdr],
            tmstmp = moment(strTmstmp, 'YYYYMMDDTHHmmssZ', true),
            now = moment(dtNow).milliseconds(0);

        if (!tmstmp.isValid()) {
            // Timestamp not well formed. Return error
            return {
                error: errorResponse.call(this, 401, 'Authorization failed; timestamp not well formed')
            };
        }

        if (!tmstmp.isBetween(now.clone().subtract(cfgSettings.requestSignature.allowedTimestampOffset, 'seconds'), now.clone().add(cfgSettings.requestSignature.allowedTimestampOffset, 'seconds'), null, '[]')) {
            // Timestamp not within acceptable time variation. Return error
            return {
                error: errorResponse.call(this, 401, 'Authorization failed; timestamp not within acceptable time variation')
            };
        }

        // Try to parse Authorization header
        let matchResult;

        if (!(matchResult = this.request.headers.authorization.match(authRegex))) {
            // Authorization HTTP header value not well formed. Return error
            return {
                error: errorResponse.call(this, 401, 'Authorization failed; authorization value not well formed')
            };
        }

        const deviceId = matchResult[1],
            strSignDate = matchResult[2],
            signature = matchResult[3];

        // Make sure that date of signature is valid
        const signDate = moment(strSignDate, 'YYYYMMDD', true);

        if (!signDate.isValid()) {
            // Signature date not well formed. Return error
            return {
                error: errorResponse.call(this, 401, 'Authorization failed; signature date not well formed')
            };
        }

        if (!moment(now).isBetween(signDate, signDate.clone().add(cfgSettings.requestSignature.signValidDays, 'days'), 'day', '[)')) {
            // Signature date out of bounds. Return error
            return {
                error: errorResponse.call(this, 401, 'Authorization failed; signature date out of bounds')
            };
        }

        // Make sure that device ID is valid
        let device = undefined;

        try {
            device = Device.getDeviceByDeviceId(deviceId, false);
        }
        catch (err) {
            if (!(err instanceof Meteor.Error) || err.error !== 'ctn_device_not_found') {
                Catenis.logger.ERROR('Error authenticating API request.', err);
                return {
                    error: errorResponse.call(this, 500, 'Internal server error')
                };
            }
        }

        if (device != undefined) {
            // Sign request and validate signature
            const reqSignature = signRequest.call(this, {
                timestamp: strTmstmp,
                signDate: strSignDate,
                apiAccessSecret: device.apiAccessSecret
            });

            if (reqSignature === signature) {
                // Signature is valid. Return device as authenticated user
                return {
                    user: {
                        device: device
                    }
                }
            }
        }

        // Device ID or signature not valid. Return generic error
        return {
            error: errorResponse.call(this, 401, 'Authorization failed; invalid device or signature')
        };
    }
    catch (err) {
        Catenis.logger.ERROR('Error authenticating API request.', err);
        return {
            error: errorResponse.call(this, 500, 'Internal server error')
        };
    }
}

// Sign request
//
// Arguments:
//  info: {
//    timestamp: [string],
//    signDate: [string],
//    apiAccessSecret: [string]
//  }
function signRequest(info) {
    // First step: compute conformed request
    let confReq = this.request.method + '\n';
    confReq += this.request.url + '\n';

    let essentialHeaders = 'host:' + this.request.headers.host + '\n';
    essentialHeaders += cfgSettings.requestSignature.timestampHdr + ':' + this.request.headers[cfgSettings.requestSignature.timestampHdr] + '\n';

    confReq += essentialHeaders + '\n';
    confReq += hashData(this.request.rawBody) + '\n';

    // Second step: assemble string to sign
    let strToSign = cfgSettings.requestSignature.signMethodId +'\n';
    strToSign += info.timestamp + '\n';

    const scope = info.signDate + '/' + cfgSettings.requestSignature.scopeRequest;

    strToSign += scope + '\n';
    strToSign += hashData(confReq) + '\n';

    // Third step: generate the signature
    const dateKey = signData(info.signDate, cfgSettings.requestSignature.signVersionId + info.apiAccessSecret),
        signKey = signData(cfgSettings.requestSignature.scopeRequest, dateKey);

    return signData(strToSign, signKey, true);
}

function hashData(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
}

function signData(data, secret, hexEncode = false) {
    return crypto.createHmac('sha256', secret).update(data).digest(hexEncode ? 'hex' : undefined);
}

function optionsResponseHeaders() {
    const reqHdrOrigin = 'origin' in this.request.headers ? this.request.headers['origin'] : undefined;

    return {
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Origin': reqHdrOrigin != undefined ? reqHdrOrigin : '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'DNT, X-CustomHeader, Keep-Alive, User-Agent, X-Requested-With, If-Modified-Since, Cache-Control, Accept, Origin, Content-Type, X-Auth-Token'
    };
}

function addCorsResponseHeaders(respHeaders) {
    const reqHdrOrigin = 'origin' in this.request.headers ? this.request.headers['origin'] : undefined;

    // NOTE: header Access-Control-Allow-Credentials is not set here
    //  because it is already included by default in every response
    //  (via field defaultHeaders of options parameter of Restivus'
    //  constructor). It normally only needed to be set if cookies
    //  are received or being sent. The reason we set it by default
    //  for all responses is to make error responses handled by
    //  Restivus directly to work properly with CORS (Cross-Origin
    //  Resource Sharing).

    if (reqHdrOrigin != undefined) {
        respHeaders['Access-Control-Allow-Origin'] = reqHdrOrigin;
        respHeaders['Vary'] = 'Origin';
    }
    else {
        respHeaders['Access-Control-Allow-Origin'] =  '*';
    }

    respHeaders['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
    respHeaders['Access-Control-Allow-Headers'] = 'DNT, X-CustomHeader, Keep-Alive, User-Agent, X-Requested-With, If-Modified-Since, Cache-Control, Accept, Origin, Content-Type, X-Bcot-Timestamp, Authorization';
}

export function successResponse(data) {
    const resp = {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json'
        },
        body: {
            status: 'success',
            data: data
        }
    };

    addCorsResponseHeaders.call(this, resp.headers);

    return resp;
}

export function errorResponse(statusCode, errMessage) {
    const resp = {
        statusCode: statusCode,
        headers: {
            'Content-Type': 'application/json'
        },
        body: {
            status: 'error',
            message: errMessage
        }
    };

    // Properly set response headers required for CORS
    addCorsResponseHeaders.call(this, resp.headers);

    return resp;
}


// Module code
//

// Lock function class
Object.freeze(RestApi);
