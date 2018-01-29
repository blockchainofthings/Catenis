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
const util = require('util');
// Third-party node modules
import config from 'config';
// Meteor packages
import { Meteor } from 'meteor/meteor';
// noinspection NpmUsedModulesInstalled
import { Restivus } from 'meteor/nimble:restivus';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { Device } from './Device';
import { ApiVersion } from './ApiVersion';
import { Authentication } from './Authentication';
import { logMessage } from './ApiLogMessage';
import { sendMessage } from './ApiSendMessage';
import { sendMessage2 } from './ApiSendMessage2';
import { readMessage } from './ApiReadMessage';
import { readMessage2 } from './ApiReadMessage2';
import { retrieveMessageContainer } from './ApiMessageContainer';
import { listMessages } from './ApiListMessages';
import { listMessages2 } from './ApiListMessages2';
import { listPermissionEvents } from './ApiListPermissionEvents';
import { retrievePermissionRights } from './ApiGetPermissionRights';
import { setPermissionRights } from './ApiPostPermissionRights';
import { listNotificationEvents } from './ApiListNotificationEvents';
import { checkEffectivePermissionRight } from './ApiEffectivePermissionRight';
import { retrieveDeviceIdentifyInfo } from './ApiDeviceIdentityInfo';

// Config entries
const restApiConfig = config.get('restApi');

// Configuration settings
const cfgSettings = {
    rootPath: restApiConfig.get('rootPath')
};

export const restApiRootPath = cfgSettings.rootPath;


// Definition of function classes
//

// RestApi function class
export function RestApi(apiVersion) {
    this.apiVer = new ApiVersion(apiVersion);

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
        version: this.apiVer.toString()
    });

    if (this.apiVer.gte('0.2')) {
        this.api.addRoute('messages/log', {authRequired: true}, {
            // Record a message to blockchain
            //
            //  Refer to the source file where the action function is defined for a detailed description of the endpoint
            post: {
                action: logMessage
            }
        });

        this.api.addRoute('messages/send', {authRequired: true}, {
            // Record a message to blockchain directing it to another device
            //
            //  Refer to the source file where the action function is defined for a detailed description of the endpoint
            post: {
                action: this.apiVer.gt('0.4') ? sendMessage2 : sendMessage
            }
        });

        this.api.addRoute('messages/:messageId', {authRequired: true}, {
            // Retrieve a given message from blockchain
            //
            //  Refer to the source file where the action function is defined for a detailed description of the endpoint
            get: {
                // Different implementations depending on the version of the API
                action: this.apiVer.gt('0.2') ? readMessage2 : readMessage
            }
        });

        this.api.addRoute('messages/:messageId/container', {authRequired: true}, {
            // Retrieve information about where a given message is recorded
            //
            //  Refer to the source file where the action function is defined for a detailed description of the endpoint
            get: {
                action: retrieveMessageContainer
            }
        });
    }

    if (this.apiVer.gte('0.3')) {
        this.api.addRoute('messages', {authRequired: true}, {
            // Retrieve a list of message entries filtered by a given criteria
            //
            //  Refer to the source file where the action function is defined for a detailed description of the endpoint
            get: {
                action: this.apiVer.gt('0.4') ? listMessages2 : listMessages
            }
        });
    }

    if (this.apiVer.gte('0.4')) {
        this.api.addRoute('permission/events', {authRequired: true}, {
            // Retrieve a list of system defined permission events
            //
            //  Refer to the source file where the action function is defined for a detailed description of the endpoint
            get: {
                action: listPermissionEvents
            }
        });

        this.api.addRoute('permission/events/:eventName/rights', {authRequired: true}, {
            // Retrieve permission rights currently set for the specified event
            //
            //  Refer to the source file where the action function is defined for a detailed description of the endpoint
            get: {
                action: retrievePermissionRights
            },
            // Set permission rights for the specified event
            //
            //  Refer to the source file where the action function is defined for a detailed description of the endpoint
            post: {
                action: setPermissionRights
            }
        });

        this.api.addRoute('permission/events/:eventName/rights/:deviceId', {authRequired: true}, {
            // Check effective permission right applied to a given device for the specified event
            //
            //  Refer to the source file where the action function is defined for a detailed description of the endpoint
            get: {
                action: checkEffectivePermissionRight
            }
        });

        this.api.addRoute('notification/events', {authRequired: true}, {
            // Retrieve a list of system defined notification events
            //
            //  Refer to the source file where the action function is defined for a detailed description of the endpoint
            get: {
                action: listNotificationEvents
            }
        });

        this.api.addRoute('devices/:deviceId', {authRequired: true}, {
            // Retrieve basic identification information of a given device
            //
            //  Refer to the source file where the action function is defined for a detailed description of the endpoint
            get: {
                action: retrieveDeviceIdentifyInfo
            }
        });
    }
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
    Catenis.restApi = {
        'ver0.2': new RestApi('0.2'),
        'ver0.3': new RestApi('0.3'),
        'ver0.4': new RestApi('0.4'),
        'ver0.5': new RestApi('0.5')
    };
};


// RestApi function class (public) properties
//

/*RestApi.prop = {};*/


// Definition of module (private) functions
//

function authenticateDevice() {
    try {
        // Parse HTTP request to retrieve relevant authentication data
        const authData = Authentication.parseHttpRequest(this.request);

        // Make sure that device ID is valid
        let device = undefined;

        try {
            device = Device.getDeviceByDeviceId(authData.deviceId, false);
        }
        catch (err) {
            if (!(err instanceof Meteor.Error) || err.error !== 'ctn_device_not_found') {
                Catenis.logger.ERROR('Error authenticating API request.', err);
                return {
                    error: errorResponse.call(this, 500, 'Internal server error')
                };
            }
        }

        if (device !== undefined) {
            // Make sure not to authenticate a device that is disabled
            if (!device.isDisabled) {
                // Sign request and validate signature
                const reqSignature = Authentication.signHttpRequest(this.request, {
                    timestamp: authData.timestamp,
                    signDate: authData.signDate,
                    apiAccessSecret: device.apiAccessSecret
                });

                if (reqSignature === authData.signature) {
                    // Signature is valid. Return device as authenticated user
                    return {
                        user: {
                            device: device
                        }
                    }
                }
                else {
                    Catenis.logger.DEBUG(util.format('Error authenticating API request: invalid signature (expected signature: %s)', reqSignature), this.request);
                }
            }
            else {
                Catenis.logger.DEBUG('Error authenticating API request: device is disabled', this.request);
            }
        }
        else {
            Catenis.logger.DEBUG('Error authenticating API request: invalid device', this.request);
        }

        // Device ID or signature not valid. Return generic error
        return {
            error: errorResponse.call(this, 401, 'Authorization failed; invalid device or signature')
        };
    }
    catch (err) {
        let error;

        if (err instanceof Meteor.Error) {
            if (err.error === 'ctn_auth_parse_err_missing_headers') {
                error = errorResponse.call(this, 401, 'Authorization failed; missing required HTTP headers');
            }
            else if (err.error === 'ctn_auth_parse_err_malformed_timestamp') {
                error = errorResponse.call(this, 401, 'Authorization failed; timestamp not well formed');
            }
            else if (err.error === 'ctn_auth_parse_err_timestamp_out_of_bounds') {
                error = errorResponse.call(this, 401, 'Authorization failed; timestamp not within acceptable time variation');
            }
            else if (err.error === 'ctn_auth_parse_err_malformed_auth_header') {
                error = errorResponse.call(this, 401, 'Authorization failed; authorization value not well formed');
            }
            else if (err.error === 'ctn_auth_parse_err_malformed_sign_date') {
                error = errorResponse.call(this, 401, 'Authorization failed; signature date not well formed');
            }
            else if (err.error === 'ctn_auth_parse_err_sign_date_out_of_bounds') {
                error = errorResponse.call(this, 401, 'Authorization failed; signature date out of bounds');
            }
            else {
                error = errorResponse.call(this, 500, 'Internal server error');
            }
        }
        else {
            error = errorResponse.call(this, 500, 'Internal server error');
        }

        Catenis.logger.ERROR('Error authenticating API request.', err);
        return error;
    }
}

function optionsResponseHeaders() {
    const reqHdrOrigin = 'origin' in this.request.headers ? this.request.headers['origin'] : undefined;

    return {
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Origin': reqHdrOrigin !== undefined ? reqHdrOrigin : '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'DNT, X-CustomHeader, Keep-Alive, User-Agent, X-Requested-With, If-Modified-Since, Cache-Control, Accept, Origin, Content-Type, X-Bcot-Timestamp, Authorization'
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

    if (reqHdrOrigin !== undefined) {
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
