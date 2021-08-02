/**
 * Created by Claudio on 2017-01-19.
 */

//console.log('[RestApi.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import util from 'util';
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
import { logMessage2 } from './ApiLogMessage2';
import { logMessage3 } from './ApiLogMessage3';
import { sendMessage } from './ApiSendMessage';
import { sendMessage2 } from './ApiSendMessage2';
import { sendMessage3 } from './ApiSendMessage3';
import { sendMessage4 } from './ApiSendMessage4';
import { readMessage } from './ApiReadMessage';
import { readMessage2 } from './ApiReadMessage2';
import { readMessage3 } from './ApiReadMessage3';
import { readMessage4 } from './ApiReadMessage4';
import { retrieveMessageContainer } from './ApiMessageContainer';
import { retrieveMessageContainer2 } from './ApiMessageContainer2';
import { retrieveMessageContainer3 } from './ApiMessageContainer3';
import { listMessages } from './ApiListMessages';
import { listMessages2 } from './ApiListMessages2';
import { listMessages3 } from './ApiListMessages3';
import { listPermissionEvents } from './ApiListPermissionEvents';
import { retrievePermissionRights } from './ApiGetPermissionRights';
import { setPermissionRights } from './ApiPostPermissionRights';
import { listNotificationEvents } from './ApiListNotificationEvents';
import { checkEffectivePermissionRight } from './ApiEffectivePermissionRight';
import { retrieveDeviceIdentifyInfo } from './ApiDeviceIdentityInfo';
import { issueAsset } from './ApiIssueAsset';
import { reissueAsset } from './ApiReissueAsset';
import { transferAsset } from './ApiTransferAsset';
import { retrieveAssetInfo } from './ApiAssetInfo';
import { getAssetBalance } from './ApiAssetBalance';
import { listOwnedAssets } from './ApiOwnedAssets';
import { listIssuedAssets } from './ApiIssuedAssets';
import { retrieveAssetIssuanceHistory } from './ApiAssetIssuance';
import { retrieveAssetIssuanceHistory2 } from './ApiAssetIssuance2';
import { listAssetHolders } from './ApiAssetHolders';
import { retrieveMessageProgress } from './ApiMessageProgress';
import { retrieveMessageOrigin } from './ApiMessageOrigin';
import { exportAsset } from './ApiExportAsset';
import { assetExportOutcome } from './ApiAssetExportOutcome';
import { listExportedAssets } from './ApiListExportedAssets';
import { migrateAsset } from './ApiMigrateAsset';
import { assetMigrationOutcome } from './ApiAssetMigrationOutcome';
import { listAssetMigrations } from './ApiListAssetMigrations';

// Config entries
const restApiConfig = config.get('restApi');

// Configuration settings
const cfgSettings = {
    rootPath: restApiConfig.get('rootPath'),
    availableVersions: restApiConfig.get('availableVersions')
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
        // noinspection JSUnresolvedFunction
        this.api.addRoute('messages/log', {authRequired: true}, {
            // Record a message to blockchain
            //
            //  Refer to the source file where the action function is defined for a detailed description of the endpoint
            post: {
                action: this.apiVer.gt('0.6') ? (this.apiVer.gt('0.8') ? logMessage3 : logMessage2) : logMessage
            }
        });

        // noinspection JSUnresolvedFunction
        this.api.addRoute('messages/send', {authRequired: true}, {
            // Record a message to blockchain directing it to another device
            //
            //  Refer to the source file where the action function is defined for a detailed description of the endpoint
            post: {
                action: this.apiVer.gt('0.4') ? (this.apiVer.gt('0.6') ? (this.apiVer.gt('0.8') ? sendMessage4 : sendMessage3) : sendMessage2) : sendMessage
            }
        });

        // noinspection JSUnresolvedFunction
        this.api.addRoute('messages/:messageId', {authRequired: true}, {
            // Retrieve a given message from blockchain
            //
            //  Refer to the source file where the action function is defined for a detailed description of the endpoint
            get: {
                // Different implementations depending on the version of the API
                action: this.apiVer.gt('0.2') ? (this.apiVer.gt('0.6') ? (this.apiVer.gt('0.8') ? readMessage4 : readMessage3): readMessage2) : readMessage
            }
        });

        // noinspection JSUnresolvedFunction
        this.api.addRoute('messages/:messageId/container', {authRequired: true}, {
            // Retrieve information about where a given message is recorded
            //
            //  Refer to the source file where the action function is defined for a detailed description of the endpoint
            get: {
                action: this.apiVer.gt('0.7') ? (this.apiVer.gt('0.8') ? retrieveMessageContainer3 : retrieveMessageContainer2) : retrieveMessageContainer
            }
        });
    }

    if (this.apiVer.gte('0.3')) {
        // noinspection JSUnresolvedFunction
        this.api.addRoute('messages', {authRequired: true}, {
            // Retrieve a list of message entries filtered by a given criteria
            //
            //  Refer to the source file where the action function is defined for a detailed description of the endpoint
            get: {
                action: this.apiVer.gt('0.4') ? (this.apiVer.gt('0.7') ? listMessages3 : listMessages2) : listMessages
            }
        });
    }

    if (this.apiVer.gte('0.4')) {
        // noinspection JSUnresolvedFunction
        this.api.addRoute('permission/events', {authRequired: true}, {
            // Retrieve a list of system defined permission events
            //
            //  Refer to the source file where the action function is defined for a detailed description of the endpoint
            get: {
                action: listPermissionEvents
            }
        });

        // noinspection JSUnresolvedFunction
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

        // noinspection JSUnresolvedFunction
        this.api.addRoute('permission/events/:eventName/rights/:deviceId', {authRequired: true}, {
            // Check effective permission right applied to a given device for the specified event
            //
            //  Refer to the source file where the action function is defined for a detailed description of the endpoint
            get: {
                action: checkEffectivePermissionRight
            }
        });

        // noinspection JSUnresolvedFunction
        this.api.addRoute('notification/events', {authRequired: true}, {
            // Retrieve a list of system defined notification events
            //
            //  Refer to the source file where the action function is defined for a detailed description of the endpoint
            get: {
                action: listNotificationEvents
            }
        });

        // noinspection JSUnresolvedFunction
        this.api.addRoute('devices/:deviceId', {authRequired: true}, {
            // Retrieve basic identification information of a given device
            //
            //  Refer to the source file where the action function is defined for a detailed description of the endpoint
            get: {
                action: retrieveDeviceIdentifyInfo
            }
        });
    }

    if (this.apiVer.gte('0.6')) {
        // noinspection JSUnresolvedFunction
        this.api.addRoute('assets/issue', {authRequired: true}, {
            // Issue an amount of a new asset
            //
            //  Refer to the source file where the action function is defined for a detailed description of the endpoint
            post: {
                action: issueAsset
            }
        });

        // noinspection JSUnresolvedFunction
        this.api.addRoute('assets/:assetId/issue', {authRequired: true}, {
            // Issue an additional amount of an existing asset
            //
            //  Refer to the source file where the action function is defined for a detailed description of the endpoint
            post: {
                action: reissueAsset
            }
        });

        // noinspection JSUnresolvedFunction
        this.api.addRoute('assets/:assetId/transfer', {authRequired: true}, {
            // Transfer an amount of an asset to a device
            //
            //  Refer to the source file where the action function is defined for a detailed description of the endpoint
            post: {
                action: transferAsset
            }
        });

        // noinspection JSUnresolvedFunction
        this.api.addRoute('assets/:assetId', {authRequired: true}, {
            // Retrieve information about a given asset
            //
            //  Refer to the source file where the action function is defined for a detailed description of the endpoint
            get: {
                action: retrieveAssetInfo
            }
        });

        // noinspection JSUnresolvedFunction
        this.api.addRoute('assets/:assetId/balance', {authRequired: true}, {
            // Get the current balance of a given asset held by the device
            //
            //  Refer to the source file where the action function is defined for a detailed description of the endpoint
            get: {
                action: getAssetBalance
            }
        });

        // noinspection JSUnresolvedFunction
        this.api.addRoute('assets/owned', {authRequired: true}, {
            // List assets owned by the device
            //
            //  Refer to the source file where the action function is defined for a detailed description of the endpoint
            get: {
                action: listOwnedAssets
            }
        });

        // noinspection JSUnresolvedFunction
        this.api.addRoute('assets/issued', {authRequired: true}, {
            // List assets issued by the device
            //
            //  Refer to the source file where the action function is defined for a detailed description of the endpoint
            get: {
                action: listIssuedAssets
            }
        });

        // noinspection JSUnresolvedFunction
        this.api.addRoute('assets/:assetId/issuance', {authRequired: true}, {
            // Retrieve issuance history for a given asset
            //
            //  Refer to the source file where the action function is defined for a detailed description of the endpoint
            get: {
                action: this.apiVer.gt('0.7') ? retrieveAssetIssuanceHistory2 : retrieveAssetIssuanceHistory
            }
        });

        // noinspection JSUnresolvedFunction
        this.api.addRoute('assets/:assetId/holders', {authRequired: true}, {
            // List devices that currently hold any amount of a given asset
            //
            //  Refer to the source file where the action function is defined for a detailed description of the endpoint
            get: {
                action: listAssetHolders
            }
        });
    }

    if (this.apiVer.gte('0.7')) {
        // noinspection JSUnresolvedFunction
        this.api.addRoute('messages/:messageId/progress', {authRequired: true}, {
            // Retrieve asynchronous message processing progress
            //
            //  Refer to the source file where the action function is defined for a detailed description of the endpoint
            get: {
                action: retrieveMessageProgress
            }
        });
    }

    if (this.apiVer.gte('0.10')) {
        // noinspection JSUnresolvedFunction
        this.api.addRoute('messages/:messageId/origin', {authRequired: false}, {
            // Retrieve message origin (public method)
            //
            //  Refer to the source file where the action function is defined for a detailed description of the endpoint
            get: {
                action: retrieveMessageOrigin
            }
        });
    }

    if (this.apiVer.gte('0.11')) {
        // noinspection JSUnresolvedFunction
        this.api.addRoute('assets/:assetId/export/:foreignBlockchain', {authRequired: true}, {
            // Export an asset to a foreign blockchain (public method)
            //
            //  Refer to the source file where the action function is defined for a detailed description of the endpoint
            post: {
                action: exportAsset
            },
            // Retrieve the outcome of an asset export (public method)
            //
            //  Refer to the source file where the action function is defined for a detailed description of the endpoint
            get: {
                action: assetExportOutcome
            }
        });

        // noinspection JSUnresolvedFunction
        this.api.addRoute('assets/exported', {authRequired: true}, {
            // List exported assets (public method)
            //
            //  Refer to the source file where the action function is defined for a detailed description of the endpoint
            get: {
                action: listExportedAssets
            }
        });

        // noinspection JSUnresolvedFunction
        this.api.addRoute('assets/:assetId/migrate/:foreignBlockchain', {authRequired: true}, {
            // Migrate an amount of an exported asset to the foreign blockchain (public method)
            //
            //  Refer to the source file where the action function is defined for a detailed description of the endpoint
            post: {
                action: migrateAsset
            }
        });

        // noinspection JSUnresolvedFunction
        this.api.addRoute('assets/migrations/:migrationId', {authRequired: true}, {
            // Retrieve the outcome of an asset migration (public method)
            //
            //  Refer to the source file where the action function is defined for a detailed description of the endpoint
            get: {
                action: assetMigrationOutcome
            }
        });

        // noinspection JSUnresolvedFunction
        this.api.addRoute('assets/migrations', {authRequired: true}, {
            // List asset migrations (public method)
            //
            //  Refer to the source file where the action function is defined for a detailed description of the endpoint
            get: {
                action: listAssetMigrations
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
    // Instantiate RestApi objects for all available API versions
    Catenis.restApi = {};

    cfgSettings.availableVersions.forEach(ver => Catenis.restApi['ver' + ver] = new RestApi(ver));
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
            // noinspection JSValidateTypes
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
        'Access-Control-Allow-Headers': 'DNT, X-CustomHeader, Keep-Alive, User-Agent, X-Requested-With, If-Modified-Since, Cache-Control, Accept, Origin, Content-Type, Content-Encoding, Accept-Encoding, X-Bcot-Timestamp, Authorization'
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
    respHeaders['Access-Control-Allow-Headers'] = 'DNT, X-CustomHeader, Keep-Alive, User-Agent, X-Requested-With, If-Modified-Since, Cache-Control, Accept, Origin, Content-Type, Content-Encoding, Accept-Encoding, X-Bcot-Timestamp, Authorization';
}

export function successResponse(data) {
    // NOTE: we do the conversion of the body contents to JSON here, even though
    //  the Restivus package will automatically convert it afterwards (since the
    //  content type is set to application/json), so we can calculate the
    //  resulting content length
    const body = {
        status: 'success',
        data: data
    };
    const jsonBody = JSON.stringify(body, null, getRestApiInstance(this.request).api._config.prettyJson ? 2 : 0);

    const resp = {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(jsonBody)
        },
        body: body
    };

    addCorsResponseHeaders.call(this, resp.headers);

    return resp;
}

export function errorResponse(statusCode, errMessage) {
    // NOTE: we do the conversion of the body contents to JSON here, even though
    //  the Restivus package will automatically convert it afterwards (since the
    //  content type is set to application/json), so we can calculate the
    //  resulting content length
    const body = {
        status: 'error',
        message: errMessage
    };
    const jsonBody = JSON.stringify(body, null, getRestApiInstance(this.request).api._config.prettyJson ? 2 : 0);

    const resp = {
        statusCode: statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(jsonBody)
        },
        body: body
    };

    // Properly set response headers required for CORS
    addCorsResponseHeaders.call(this, resp.headers);

    return resp;
}

export function getUrlApiVersion(reqOrUrl) {
    const regExp = new RegExp(util.format("^/%s/([^/]+)/.*$", cfgSettings.rootPath));
    let match;

    const url = typeof reqOrUrl === 'string' ? reqOrUrl : (reqOrUrl.originalUrl || reqOrUrl.url);

    if ((match = url.match(regExp))) {
        return match[1];
    }
}

function getRestApiInstance(req) {
    return Catenis.restApi['ver' + getUrlApiVersion(req)];
}


// Module code
//

// Lock function class
Object.freeze(RestApi);
