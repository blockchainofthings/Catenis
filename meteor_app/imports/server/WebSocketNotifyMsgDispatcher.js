/**
 * Created by Claudio on 2017-08-17.
 */

//console.log('[WebSocketNotifyMsgDispatcher.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import util from 'util';
import url from 'url';
// Third-party node modules
import config from 'config';
import WebSocket from 'ws';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import {
    Notification,
    initNotifyServiceVer
} from './Notification';
import { NotifyMsgDispatcher } from './NotifyMsgDispatcher';
import {
    Authentication,
    authHeader
} from './Authentication';
import { Device } from './Device';
import {
    ApiVersion,
    ApiVersionRange
} from './ApiVersion';
import { Util } from './Util';
import { restApiRootPath } from './RestApi';

// Config entries
const wsNotifyMsgDispatcherConfig = config.get('webSocketNotifyMsgDispatcher');

// Configuration settings
const cfgSettings = {
    wsNotifyRootPath: wsNotifyMsgDispatcherConfig.get('wsNotifyRootPath'),
    notifyWsSubprotocol: wsNotifyMsgDispatcherConfig.get('notifyWsSubprotocol'),
    initVersion: wsNotifyMsgDispatcherConfig.get('initVersion'),
    availableVersions: wsNotifyMsgDispatcherConfig.get('availableVersions'),
    heartbeatInterval: wsNotifyMsgDispatcherConfig.get('heartbeatInterval'),
    authMsgTimeout: wsNotifyMsgDispatcherConfig.get('authMsgTimeout'),
    notifyChannelOpenMsg: wsNotifyMsgDispatcherConfig.get('notifyChannelOpenMsg'),
    ntfyChnOpnMsgMinVer: wsNotifyMsgDispatcherConfig.get('ntfyChnOpnMsgMinVer')
};


// Definition of classes
//

// WebSocketNotifyMsgDispatcher class
export class WebSocketNotifyMsgDispatcher extends NotifyMsgDispatcher {
    constructor (notifyServiceVer, dispatcherVer) {
        super();

        this.notifyServiceVer = ApiVersion.checkVersion(notifyServiceVer);
        this.dispatcherVer = ApiVersion.checkVersion(dispatcherVer);

        // Assemble regular expression used to identify endpoint URI path handled by WebSocket notification
        //  message dispatcher:
        //   - new URI pattern: <restApiRootPath>/<apiVer>/<notifyRootPath>[/wsNotifyRootPath]/<notifyEventName>
        //   - legacy URI pattern: <qualifiedNotifyRooPath>[/<notifyServiceVer>][/wsNotifyRootPath][/<dispatcherVer>]/<notifyEventName>
        this.endpointUriPathRegExp = new RegExp(util.format('^(?:(?:/%s/(\\d+\\.\\d+)/%s%s%s/([^/]+))|(%s(?:/%s)%s%s%s(?:/%s)%s/([^/]+)))$',
            // New pattern params
            restApiRootPath,
            Notification.notifyRootPath,
            cfgSettings.wsNotifyRootPath.length > 0 ? '/' : '',
            cfgSettings.wsNotifyRootPath,
            // Legacy pattern params
            Notification.qualifiedNotifyRooPath,
            Util.escapeRegExp(this.notifyServiceVer.toString()),
            this.notifyServiceVer.eq(initNotifyServiceVer) ? '?' : '',
            cfgSettings.wsNotifyRootPath.length > 0 ? '/' : '',
            cfgSettings.wsNotifyRootPath,
            Util.escapeRegExp(this.dispatcherVer.toString()),
            this.dispatcherVer.eq(cfgSettings.initVersion) ? '?' : ''
        ));

        this.serverOn = false;
        this.heartbeatInterval = undefined;
        this.deviceEventClients = new Map();
        this.pendingAuthClientConnInfo = new Map();

        this.startServer();
    }

    // Method used to conditionally handle an HTTP upgrade request and establish a connection for the
    //  communication protocol (over HTTP) used by the notification message dispatcher
    //
    //  Arguments:
    //   request [Object] - The request object of the original request
    //   socket [Object] - The socket object of the original request
    //   head [Object] - The head object of the original request
    //
    //  Return:
    //   result [Boolean] - Indicates whether dispatcher shall handle the request
    //
    // noinspection JSMethodCanBeStatic, JSUnusedLocalSymbols
    handleProtocolConnection(request, socket, head) {
        if (isValidEndpointUriPath.call(this, url.parse(request.url).pathname)) {
            // Valid endpoint. Try to establish WebSocket protocol connection
            this.wss.handleUpgrade(request, socket, head, (ws) => {
                this.wss.emit('connection', ws, request);
            });

            return true;
        }

        return false;
    }

    // Method used to dispatch message notifying of a given event to device
    //
    //  Arguments:
    //   deviceId [String] - Catenis ID of device to which the notification message is to be dispatched
    //   eventName [String] - Name of notification event associated with the notification message
    //   data [String] - The contents of the notification message
    //
    //  Return:
    //   success [Boolean] - Indicates whether notification message has been successfully dispatched or not
    //
    // noinspection JSMethodCanBeStatic, JSUnusedLocalSymbols
    dispatchNotifyMessage(deviceId, eventName, data) {
        let result = false;

        // Look for device entry
        if (this.deviceEventClients.has(deviceId)) {
            const eventClients = this.deviceEventClients.get(deviceId);

            if (eventName in eventClients) {
                for (let ws of eventClients[eventName]) {
                    // Make sure the client connection is open
                    if (ws.readyState === WebSocket.OPEN) {
                        // Send message to client
                        ws.send(data, {
                            compress: false,
                            binary: false,
                            fin: true
                        }, () => {
                            Catenis.logger.TRACE('WebSocket notification message dispatcher - Message has been sent to client', {
                                deviceId: deviceId,
                                eventName: eventName,
                                data: data
                            });
                            result = true;
                        });
                    }
                    else {
                        // Client connection not yet open; notification message cannot be sent
                        Catenis.logger.DEBUG('WebSocket notification message dispatcher - Client connection not yet open; notification message cannot be sent', {
                            deviceId: deviceId,
                            eventName: eventName,
                            data: data
                        });
                    }
                }
            }
        }

        return result;
    }

    startServer() {
        Catenis.logger.TRACE('WebSocket notification message dispatcher - Starting server');
        this.wss = new WebSocket.Server({
            noServer: true,
            verifyClient: validateConnection.bind(this),
            handleProtocols: validateProtocol,
            clientTracking: true
        });

        // Hook up event handlers
        this.wss.on('error', errorHandler.bind(this));
        this.wss.on('connection', Meteor.bindEnvironment(connectionHandler, 'WebSocket notification message dispatcher - client connection handler',this));
        this.wss.on('headers', headersHandler.bind(this));

        // Indicate that server is on and start heartbeat check
        this.serverOn = true;
        startHeartbeatCheck.call(this);
    }

    shutdownServer() {
        Catenis.logger.TRACE('WebSocket notification message dispatcher - Shutting server down');
        stopHeartbeatCheck.call(this);
        clearAllPendingAuthTimeouts.call(this);

        this.wss.close(() => {
            Catenis.logger.TRACE('WebSocket notification message dispatcher - Server is down');

            this.wss = undefined;
            this.serverOn = false;
        });
    }

    static initialize() {
        Catenis.logger.TRACE('WebSocketNotifyMsgDispatcher initialization');
        // Register all available versions of the dispatcher
        cfgSettings.availableVersions.forEach(dispatcherVerInfo => autoRegistration(dispatcherVerInfo.ver));
    }

    static dispatcherVersionByApiVersion(apiVer) {
        apiVer = ApiVersion.checkVersion(apiVer, false);

        if (apiVer) {
            let dispatcherVer;

            for (let idx = 0, limit = cfgSettings.availableVersions.length; idx < limit; idx++) {
                const dispatcherVerInfo = cfgSettings.availableVersions[idx];

                if (apiVer.gte(dispatcherVerInfo.apiVer)) {
                    dispatcherVer = dispatcherVerInfo.ver;
                }
            }

            return dispatcherVer;
        }
    }

    static apiVersionRangeByDispatcherVersion(dispatcherVer) {
        dispatcherVer = ApiVersion.checkVersion(dispatcherVer, false);

        if (dispatcherVer) {
            let lowBoundary;
            let highBoundary;

            for (let idx = 0, limit = cfgSettings.availableVersions.length; idx < limit; idx++) {
                const dispatcherVerInfo = cfgSettings.availableVersions[idx];

                if (!lowBoundary) {
                    if (dispatcherVer.eq(dispatcherVerInfo.ver)) {
                        lowBoundary = dispatcherVerInfo.apiVer;
                    }
                }
                else {
                    highBoundary = new ApiVersion(dispatcherVerInfo.apiVer).previous();
                    break;
                }
            }

            return lowBoundary ? new ApiVersionRange(lowBoundary, highBoundary) : undefined;
        }
    }
}


// Module functions used to simulate private WebSocketNotifyMsgDispatcher object methods
//  NOTE: these functions need to be bound to a WebSocketNotifyMsgDispatcher object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

function isValidEndpointUriPath(path) {
    const matchResult = path.match(this.endpointUriPathRegExp);

    if (matchResult) {
        if (matchResult[3]) {
            // Legacy pattern
            return true;
        }

        // New pattern. Get REST API version
        const apiVer = ApiVersion.checkVersion(matchResult[1], false);

        if (apiVer) {
            const notifyServiceVer = Notification.notifyServiceVersionByApiVersion(apiVer);

            if (notifyServiceVer && this.notifyServiceVer.eq(notifyServiceVer)) {
                const dispatcherVer = WebSocketNotifyMsgDispatcher.dispatcherVersionByApiVersion(apiVer);

                return dispatcherVer && this.dispatcherVer.eq(dispatcherVer);
            }
        }
    }

    return false;
}

// Parse endpoint URI path to retrieve and validated notification event from it
//
//  Arguments:
//   path [String] - Full path of endpoint URI
//
//  Result:
//   eventName [String] - Name of notification event name embedded in path
function parseEndpointUriPath(path) {
    const matchResult = path.match(this.endpointUriPathRegExp);

    if (matchResult) {
        const eventName = matchResult[3] ? matchResult[4] : matchResult[2];

        if (Notification.isValidEventName(eventName, this.notifyServiceVer)) {
            return eventName;
        }
    }
}

function connectionHandler(ws, req) {
    Catenis.logger.TRACE('WebSocket notification message dispatcher - Client connection has been established');
    // Attach WebSocketNotifyMsgDispatcher object and connection specific notify data
    //  to client object
    ws.ctnDispatcher = this;
    ws.ctnNotify = req.ctnNotify;
    ws.isAlive = true;  // Heartbeat control

    // Save connection and wait for authentication message
    this.pendingAuthClientConnInfo.set(ws, {
        req: req,
        timeout: setTimeout(authenticationTimeout.bind(this), cfgSettings.authMsgTimeout, ws)
    });

    // Hook up client connection event handlers
    ws.onclose = clientCloseHandler;
    ws.onerror = clientErrorHandler;
    ws.onopen = clientOpenHandler;
    ws.onmessage = Meteor.bindEnvironment(clientMessageHandler, 'WebSocket notification message dispatcher - new client message handler', ws);
    ws.on('pong', clientPongHandler);
}

function authenticationTimeout(ws) {
    Catenis.logger.TRACE('WebSocket notification message dispatcher - Timeout while waiting on authentication message');
    // Timeout while waiting for authentication message.
    //  Make sure that authentication is still pending
    if (this.pendingAuthClientConnInfo.has(ws)) {
        // Clear pending indication and close connection
        this.pendingAuthClientConnInfo.delete(ws);
        ws.close(1002, 'Failed to receive authentication message');
    }
}

function errorHandler(error) {
    // WebSocket server error. Log error
    Catenis.logger.ERROR('WebSocket notification message dispatcher - Server error; server will be shut down.', error);

    this.shutdownServer(this);
}

function headersHandler(headers, req) {
    Catenis.logger.TRACE('WebSocket notification message dispatcher - Headers to be sent back to client:', headers);
}

function startHeartbeatCheck() {
    this.heartbeatInterval = setInterval(heartbeatPing.bind(this), cfgSettings.heartbeatInterval);
}

function stopHeartbeatCheck() {
    if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
    }
}

function clearAllPendingAuthTimeouts() {
    // For all client connection pending authentication, stop timeout and
    //  clear pending indication
    for (let [ws, connInfo] of this.pendingAuthClientConnInfo) {
        clearTimeout(connInfo.timeout);
        this.pendingAuthClientConnInfo.delete(ws);
    }
}

function heartbeatPing() {
    this.wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
            // Have not received heartbeat pong package from client.
            //  Assume it is down and terminate its connection
            Catenis.logger.TRACE('WebSocket notification message dispatcher - Heartbeat pong not received from WebSocket client; terminating client connection');
            return ws.terminate();
        }

        ws.isAlive = false;
        ws.ping();
    });
}

function processIncomingMessage(ws, message) {
    // We only care for authentication message. So make sure that
    //  authentication is pending fo this client connection
    if (this.pendingAuthClientConnInfo.has(ws)) {
        // Get connection info, stop timeout and clear authentication pending indication
        const connInfo = this.pendingAuthClientConnInfo.get(ws);
        clearTimeout(connInfo.timeout);
        this.pendingAuthClientConnInfo.delete(ws);

        let error;

        // Make sure that this is an authentication message
        if (typeof message.data === 'string') {
            let parsedData;

            try {
                parsedData = JSON.parse(message.data);
            }
            catch (err) {
                Catenis.logger.DEBUG('WebSocket notification message dispatcher - Error parsing client message', err);
                // Error parsing message. Message is not a valid JSON
            }

            if (typeof parsedData === 'object' && parsedData !== null && (Authentication.timestampHeader in parsedData) &&
                    (authHeader in parsedData)) {
                // Add authentication info to request and try to authenticate client/device
                connInfo.req.headers[Authentication.timestampHeader] = parsedData[Authentication.timestampHeader];
                connInfo.req.headers[authHeader] = parsedData[authHeader];
                // Make sure that required rawBody property exists
                connInfo.req.rawBody = connInfo.req.rawBody || Buffer.from('');

                const authResult = authenticateDevice(connInfo.req);

                if (authResult.device) {
                    // Add authenticated device Id to client connection object and save it
                    ws.ctnNotify.deviceId = authResult.device.deviceId;
                    Catenis.logger.TRACE('WebSocket notification message dispatcher - Client successfully authenticated', ws.ctnNotify);
                    saveAuthenticatedClientConnection.call(this, ws);

                    if (this.dispatcherVer.gte(cfgSettings.ntfyChnOpnMsgMinVer)) {
                        sendNotificationChannelOpenMessage(ws);
                    }

                    return;
                }
                else {
                    // Error authenticating device. Save error
                    error = authResult.error;
                }
            }
        }

        // If this point is reached, the client authentication has failed
        if (error === undefined) {
            // If no error set, it was not a valid authentication message
            error = {
                code: 1002,
                reason: 'Invalid authentication message'
            }
        }

        // Close the client connection
        ws.close(error.code, error.reason);
    }
}

function saveAuthenticatedClientConnection(ws) {
    // Check if a connection for the given device and notification event already exists
    if (!this.deviceEventClients.has(ws.ctnNotify.deviceId)) {
        // Create new entry for device and save client connection for that notification event
        const eventClients = {};
        eventClients[ws.ctnNotify.eventName] = new Set([ws]);

        this.deviceEventClients.set(ws.ctnNotify.deviceId, eventClients);
    }
    else {
        // Entry for that device already exists
        const eventClients = this.deviceEventClients.get(ws.ctnNotify.deviceId);

        if (!(ws.ctnNotify.eventName in eventClients)) {
            // Save client connection for that notification event
            eventClients[ws.ctnNotify.eventName] =  new Set([ws]);
        }
        else {
            // There is already at least one client connection for that notification event.
            //  Add the new client connection
            eventClients[ws.ctnNotify.eventName].add(ws);
        }
    }
}

function sendNotificationChannelOpenMessage(ws) {
    // Make sure the client connection is open
    if (ws.readyState === WebSocket.OPEN) {
        // Send message to client
        ws.send(cfgSettings.notifyChannelOpenMsg, {
            compress: false,
            binary: false,
            fin: true
        }, () => {
            Catenis.logger.TRACE('WebSocket notification message dispatcher - Notification channel open message has been sent to client', {
                deviceId: ws.ctnNotify.deviceId,
                eventName: ws.ctnNotify.eventName
            });
        });
    }
    else {
        // Client connection not yet open; notification channel open message cannot be sent
        Catenis.logger.DEBUG('WebSocket notification message dispatcher - Client connection not yet open; notification channel open message cannot be sent', {
            deviceId: ws.ctnNotify.deviceId,
            eventName: ws.ctnNotify.eventName
        });
    }
}

function clearClientConnection(ws) {
    // Make sure that client has already been authenticated
    if (ws.ctnNotify.deviceId !== undefined) {
        // Retrieve device entry and make sure that it exists
        const eventClients = this.deviceEventClients.get(ws.ctnNotify.deviceId);

        if (eventClients !== undefined) {
            // Make sure that client connection is associated with the corresponding notification event
            const wsSet = eventClients[ws.ctnNotify.eventName];

            if (wsSet && wsSet.has(ws)) {
                // Make sure that client connection is closed before clearing it up
                if (ws.readyState === WebSocket.CLOSED) {
                    wsSet.delete(ws);

                    if (wsSet.size === 0) {
                        delete eventClients[ws.ctnNotify.eventName];

                        if (Object.keys(eventClients).length === 0) {
                            this.deviceEventClients.delete(ws.ctnNotify.deviceId);
                        }
                    }
                }
                else if (ws.readyState !== WebSocket.CLOSING) {
                    // Client connection still active. So just close it
                    ws.close(1011, 'WebSocket client connection is being cleared by server');
                }
            }
            else {
                // Client connection being cleared not associated with any notification event
                Catenis.logger.DEBUG('WebSocket notification message dispatcher - client connection being cleared not associated with any notification event', ws.ctnNotify);
            }
        }
        else {
            // Client connection being cleared not associated with any device
            Catenis.logger.DEBUG('WebSocket notification message dispatcher - client connection being cleared not associated with any device', ws.ctnNotify);
        }
    }
    else if (this.pendingAuthClientConnInfo.has(ws)) {
        // Stop timeout and clear authentication pending indication
        const connInfo = this.pendingAuthClientConnInfo.get(ws);
        clearTimeout(connInfo.timeout);
        this.pendingAuthClientConnInfo.delete(ws);
    }
}


// WebSocketNotifyMsgDispatcher function class (public) properties
//

/*WebSocketNotifyMsgDispatcher.prop = {};*/


// Definition of module (private) functions
//

// NOTE: method's 'this' is a WebSocket client connection object
function clientCloseHandler(close, reason) {
    Catenis.logger.TRACE('WebSocket notification message dispatcher - Client connection closed', {code: close.code, reason: close.reason});
    // Client connection is being closed. Clear it from saved device/notification event entry
    clearClientConnection.call(this.ctnDispatcher, this);
}

// NOTE: method's 'this' is a WebSocket client connection object
function clientErrorHandler(error) {
    // WebSocket client connection error. Log error
    Catenis.logger.ERROR('WebSocket notification message dispatcher - Client connection error.', error);
}

// NOTE: method's 'this' is a WebSocket client connection object
function clientOpenHandler() {
    Catenis.logger.TRACE('WebSocket notification message dispatcher - Client connection is open');
    // Nothing to do here. We handle a new client connection on the 'connection' event of the WebSocket server
}

// NOTE: method's 'this' is a WebSocket client connection object
function clientMessageHandler(message) {
    Catenis.logger.TRACE('WebSocket notification message dispatcher - New message from client');
    // New message received from client. Try to process message
    processIncomingMessage.call(this.ctnDispatcher, this, message);
}

// NOTE: method's 'this' is a WebSocket client connection object
function clientPongHandler() {
    this.isAlive = true;
}

function autoRegistration(dispatcherVer) {
    Notification.registerNotifyMsgDispatcher({
        name: 'WebSocket',
        description: 'Dispatcher that uses the WebSocket protocol, with a proprietary \'notification.catenis.io\' subprotocol, to send notification messages',
        version: dispatcherVer,
        factory: function (notifyServiceVer) {
            const notifyApiVerRange = Notification.apiVersionRangeByNotifyServiceVersion(notifyServiceVer);

            if (notifyApiVerRange) {
                const dispatcherApiVerRange = WebSocketNotifyMsgDispatcher.apiVersionRangeByDispatcherVersion(dispatcherVer);

                if (dispatcherApiVerRange && notifyApiVerRange.intersection(dispatcherApiVerRange)) {
                    return new WebSocketNotifyMsgDispatcher(notifyServiceVer, dispatcherVer);
                }
            }
        }
    })
}

// Validate WebSocket connection handshake
//
//  Arguments:
//   info: {
//     origin: [String], - The value in the Origin header indicated by the client
//     req: [Object(http.IncomingMessage)], - The client HTTP GET request
//     secure: [Boolean] - True if req.connection.authorized or req.connection.encrypted is set
//   }
//   callBack [Function] - Callback function with the following arguments:
//                       -   result [Boolean] - Whether or not to accept the handshake
//                       -   code [Number] - When result is false this field determines the HTTP error status code to be sent to the client
//                       -   name [String] - When result is false this field determines the HTTP reason phrase
function validateConnection(info, callBack) {
    // Extract notification event name from endpoint URI and validate it
    const eventName = parseEndpointUriPath.call(this, url.parse(info.req.url).pathname);

    if (eventName !== undefined) {
        // Save notification event to request object
        info.req.ctnNotify = {
            eventName: eventName
        };

        // And indicate success
        callBack(true);
    }
    else {
        // Trying to connect to an invalid endpoint URI. Return error
        callBack(false, 400, 'Invalid endpoint URI');
    }
}

// Validate subprotocol to be used with WebSocket connection
//
//  Arguments:
//   protocols [Array(String)] - The list of WebSocket subprotocols indicated by the client in the Sec-WebSocket-Protocol header
//   request [Object(http.IncomingMessage)] - The client HTTP GET request
//
//  Return:
//    acceptedProtocol [String|Boolean] - The accepted WebSocket subprotocol, or false if no subprotocol is accepted
// noinspection JSUnusedLocalSymbols
function validateProtocol(protocols, request) {
    return protocols.some((protocol) => protocol === cfgSettings.notifyWsSubprotocol) ? cfgSettings.notifyWsSubprotocol : false;
}

// Authenticate Catenis device that is trying to establish WebSocket connection
//
//  Arguments:
//   req [Object] - The HTTP GET request issued by the client (a Catenis device) to establish the WebSocket connection
//
//  Return:
//   result: {
//     device: [Object(Device)] - The instantiated Device object. It should only exist if device is successfully authenticated
//     error: { [Object] - Should only exist if failed to authenticate device
//       code: [Number] - The WebSocket close status code to be used when closing the client connection
//       reason: [String] - The reason text to be returned along with the close status code
//     }
//   }
function authenticateDevice(req) {
    try {
        // Parse HTTP request to retrieve relevant authentication data
        const authData = Authentication.parseHttpRequest(req);

        // Make sure that device ID is valid
        let device = undefined;

        try {
            device = Device.getDeviceByDeviceId(authData.deviceId, false);
        }
        catch (err) {
            if (!(err instanceof Meteor.Error) || err.error !== 'ctn_device_not_found') {
                Catenis.logger.ERROR('Error authenticating WebSocket connection for dispatching notification messages.', err);
                return {
                    error: {
                        code: 1011,
                        reason: 'Internal server error'
                    }
                };
            }
        }

        if (device !== undefined) {
            // Make sure not to authenticate a device that is disabled
            if (!device.isDisabled) {
                // Sign request and validate signature
                const reqSignature = Authentication.signHttpRequest(req, {
                    timestamp: authData.timestamp,
                    signDate: authData.signDate,
                    apiAccessSecret: device.apiAccessSecret
                });

                if (reqSignature === authData.signature) {
                    // Signature is valid. Return device as authenticated user
                    return {
                        device: device
                    }
                }
                else {
                    Catenis.logger.DEBUG(util.format('Error authenticating WebSocket connection for dispatching notification message: invalid signature (expected signature: %s)', reqSignature), req);
                }
            }
            else {
                Catenis.logger.DEBUG('Error authenticating WebSocket connection for dispatching notification message: device is disabled', req);
            }
        }
        else {
            Catenis.logger.DEBUG('Error authenticating WebSocket connection for dispatching notification message: invalid device', req);
        }

        // Device ID or signature not valid. Return generic error
        return {
            error: {
                code: 1002,
                reason: 'Authorization failed; invalid device or signature'
            }
        };
    }
    catch (err) {
        const error = {};

        if (err instanceof Meteor.Error) {
            if (err.error === 'ctn_auth_parse_err_missing_headers') {
                error.code = 1002;
                error.reason = 'Authorization failed; missing required HTTP headers';
            }
            else if (err.error === 'ctn_auth_parse_err_malformed_timestamp') {
                error.code = 1002;
                error.reason = 'Authorization failed; timestamp not well formed';
            }
            else if (err.error === 'ctn_auth_parse_err_timestamp_out_of_bounds') {
                error.code = 1002;
                error.reason = 'Authorization failed; timestamp not within acceptable time variation';
            }
            else if (err.error === 'ctn_auth_parse_err_malformed_auth_header') {
                error.code = 1002;
                error.reason = 'Authorization failed; authorization value not well formed';
            }
            else if (err.error === 'ctn_auth_parse_err_malformed_auth_credentials') {
                error.code = 1002;
                error.reason = 'Authorization failed; authorization credentials not well formed';
            }
            else if (err.error === 'ctn_auth_parse_err_malformed_sign_date') {
                error.code = 1002;
                error.reason = 'Authorization failed; signature date not well formed';
            }
            else if (err.error === 'ctn_auth_parse_err_sign_date_out_of_bounds') {
                error.code = 1002;
                error.reason = 'Authorization failed; signature date out of bounds';
            }
            else {
                error.code = 1011;
                error.reason = 'Internal server error';
            }
        }
        else {
            error.code = 1011;
            error.reason = 'Internal server error';
        }

        Catenis.logger.ERROR('Error authenticating WebSocket connection for dispatching notification messages.', err);
        return {
            error: error
        };
    }
}


// Module code
//

// Lock function class
Object.freeze(WebSocketNotifyMsgDispatcher);
