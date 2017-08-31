/**
 * Created by claudio on 17/08/17.
 */


//console.log('[WebSocketNotifyMsgDispatcher.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//  NOTE: the reference of these modules are done using 'require()' instead of 'import' to
//      to avoid annoying WebStorm warning message: 'default export is not defined in
//      imported module'
const util = require('util');
const url = require('url');
// Third-party node modules
import config from 'config';
import WebSocket from 'ws';
// Meteor packages
import { WebApp } from 'meteor/webapp';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { Notification } from './Notification';
import { NotifyMsgDispatcher } from './NotifyMsgDispatcher';
import { Authentication } from './Authentication';
import { Device } from './Device';

// Config entries
const wsNotifyMsgDispatcherConfig = config.get('webSocketNotifyMsgDispatcher');

// Configuration settings
const cfgSettings = {
    wsNotifyRootPath: wsNotifyMsgDispatcherConfig.get('wsNotifyRootPath'),
    notifyWsSubprotocol: wsNotifyMsgDispatcherConfig.get('notifyWsSubprotocol'),
    heartbeatInterval: wsNotifyMsgDispatcherConfig.get('heartbeatInterval')
};

const wsNtfyBaseUriPath = util.format('%s%s%s', Notification.qualifiedNotifyRooPath, cfgSettings.wsNotifyRootPath.length > 0 ? '/' : '', cfgSettings.wsNotifyRootPath);
const wsNtfyEndpointUriPathRegexPattern = util.format('^%s/([^/]+)$', wsNtfyBaseUriPath);


// Definition of classes
//

// WebSocketNotifyMsgDispatcher class
export class WebSocketNotifyMsgDispatcher extends NotifyMsgDispatcher {
    constructor () {
        super();

        this.serverOn = false;
        this.heartbeatInterval = undefined;
        this.deviceEventClient = new Map();

        this.startServer();
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
        if (this.deviceEventClient.has(deviceId)) {
            const eventClient = this.deviceEventClient.get(deviceId);

            if (eventName in eventClient) {
                const ws = eventClient[eventName];

                // Make sure the client connection is open
                if (ws.readState === WebSocket.OPEN) {
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

        return result;
    }

    startServer() {
        Catenis.logger.TRACE('WebSocket notification message dispatcher - Starting server');
        this.wss = new WebSocket.Server({
            server: WebApp.httpServer,
            verifyClient: validateConnection,
            handleProtocols: validateProtocol,
            clientTracking: true
        });

        // Hook up event handlers
        this.wss.on('error', errorHandler.bind(this));
        this.wss.on('listening', listeningHandler.bind(this));
        this.wss.on('connection', connectionHandler.bind(this));
        this.wss.on('headers', headersHandler.bind(this));
    }

    shutdownServer() {
        Catenis.logger.TRACE('WebSocket notification message dispatcher - Shutting server down');
        stopHeartbeatCheck();

        this.wss.close(() => {
            Catenis.logger.TRACE('WebSocket notification message dispatcher - Server is down');

            this.wss = undefined;
            this.serverOn = false;
        });
    }

    static initialize() {
        Catenis.logger.TRACE('WebSocketNotifyMsgDispatcher initialization');
        // Register dispatcher
        autoRegistration();
    }
}


// Module functions used to simulate private WebSocketNotifyMsgDispatcher object methods
//  NOTE: these functions need to be bound to a WebSocketNotifyMsgDispatcher object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

function connectionHandler(ws, req) {
    // Attach WebSocketNotifyMsgDispatcher object and connection specific notify data
    //  to client object
    ws.ctnDispatcher = this;
    ws.ctnNotify = req.ctnNotify;
    ws.isAlive = true;  // Heartbeat control

    // Hook up client connection event handlers
    ws.onclose = clientCloseHandler;
    ws.onerror = clientErrorHandler;
    ws.onopen = clientOpenHandler;
    ws.on('pong', clientPongHandler);
}

function listeningHandler() {
    Catenis.logger.TRACE('WebSocket notification message dispatcher - Server successfully started');
    this.serverOn = true;

    startHeartbeatCheck.call(this);
}

function errorHandler(error) {
    // WebSocket server error. Log error
    Catenis.logger.ERROR('WebSocket notification message dispatcher - Server error; server will be shut down.', error);

    this.shutdownServer(this);
}

function headersHandler(headers, req) {
    Catenis.logger.TRACE('WebSocket notification message dispatcher - Headers to be sent back to client:', headers);
}

function newClientConnection(ws) {
    // Check if a connection for the given device and notification event already exists
    if (!ws.ctnDispatcher.deviceEventClient.has(ws.ctnNotify.deviceId)) {
        // Create new entry for device and save client connection for that notification event
        const eventClient = {};
        eventClient[ws.ctnNotify.eventName] = ws;

        ws.ctnDispatcher.deviceEventClient.set(ws.ctnNotify.deviceId, eventClient);
    }
    else {
        // Entry for that device already exists
        const eventClient = ws.ctnDispatcher.deviceEventClient.get(ws.ctnNotify.deviceId);

        if (!(ws.ctnNotify.eventName in eventClient)) {
            // Save client connection for that notification event
            eventClient[ws.ctnNotify.eventName] =  ws;
        }
        else {
            // There is already a client connection for that notification event.
            //  Make sure that this is a different client connection
            const currWs = eventClient[ws.ctnNotify.eventName];

            if (currWs !== ws) {
                // Not the same client connection. Check its current state
                if (currWs.readyState === WebSocket.CONNECTING || currWs.readyState === WebSocket.OPEN) {
                    // Current client connection is active, so close new one
                    ws.close(1011, 'There is already an active WebSocket client connection for this device and notification event');
                }
                else {
                    // Current client connection not active. Just replace it with the new one
                    eventClient[ws.ctnNotify.eventName] = currWs;
                }
            }
            else {
                // Same client connection. Nothing to do
                Catenis.logger.TRACE('WebSocket notification message dispatcher - The same client connection already exists for this device and notification event', ws.ctnNotify);
            }
        }
    }
}

function clearClientConnection(ws) {
    // Retrieve device entry and make sure that it exists
    const eventClient = ws.ctnDispatcher.deviceEventClient.get(ws.ctnNotify.deviceId);

    if (eventClient !== undefined) {
        // Check if a client connection for that notification event already exists
        const currWs = eventClient[ws.ctnNotify.eventName];

        // Make sure that they are the same client connection
        if (currWs === ws) {
            // Check current state of client connection
            if (currWs.readyState !== WebSocket.CLOSING && currWs.readyState !== WebSocket.CLOSED) {
                // Client connect still active. So just close it
                currWs.close(1011, 'WebSocket client connection is being clear by server');
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

function startHeartbeatCheck() {
    this.heartbeatInterval = setInterval(heartbeatPing.call(this), cfgSettings.heartbeatInterval);
}

function stopHeartbeatCheck() {
    if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
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
        ws.ping('', false, true);
    });
}


// NOTE: method's 'this' is a WebSocket client connection object
function clientCloseHandler(code, reason) {
    Catenis.logger.TRACE('WebSocket notification message dispatcher - Client connection being closed', {code: code, reason: reason});
    // Client connection is being closed. Clear it from saved device/notification event entry
    clearClientConnection(this);
}

// NOTE: method's 'this' is a WebSocket client connection object
function clientErrorHandler(error) {
    // WebSocket client connection error. Log error
    Catenis.logger.ERROR('WebSocket notification message dispatcher - Client connection error.', error);
}

// NOTE: method's 'this' is a WebSocket client connection object
function clientOpenHandler() {
    Catenis.logger.TRACE('WebSocket notification message dispatcher - Client connection being open');
    // Client connection is being open. Save it to device/notification event entry
    newClientConnection(this);
}

// NOTE: method's 'this' is a WebSocket client connection object
function clientPongHandler() {
    this.isAlive = true;
}

// WebSocketNotifyMsgDispatcher function class (public) properties
//

/*WebSocketNotifyMsgDispatcher.prop = {};*/


// Definition of module (private) functions
//

function autoRegistration() {
    Notification.registerNotifyMsgDispatcher({
        name: 'WebSocket',
        description: 'Dispatcher that uses the WebSocket protocol, with a proprietary \'notification.catenis.io\' subprotocol, to send notification messages',
        factory: function () {
            return new WebSocketNotifyMsgDispatcher();
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
    // Validate the endpoint URI to where connection is being requested
    const eventName = parseEndpointUriPath(url.parse(info.req.url).pathname);

    if (eventName === undefined) {
        // Trying to connect to an invalid endpoint URI. Return error
        callBack(false, 400, 'Invalid endpoint URI');
    }

    // Try to authenticate device now
    const authResult = authenticateDevice(info.req);

    if (authResult.device) {
        // Save notification event and authenticated device to request object
        info.req.ctnNotify = {
            eventName: eventName,
            deviceId: authResult.device.deviceId
        };

        // And indicate success
        callBack(true);
    }
    else {
        // Error authenticating device. Return error
        callBack(false, authResult.error.code, authResult.error.reason);
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

// Parse endpoint URI path to validate it and retrieve notification event from it
//
//  Arguments:
//   path [String] - Full path of endpoint URI
//
//  Result:
//   eventName [String] - Name of notification event name embedded in path
function parseEndpointUriPath(path) {
    const matchResult = path.match(new RegExp(wsNtfyEndpointUriPathRegexPattern));

    return matchResult !== null && Notification.isValidEventName(matchResult[1]) ? matchResult[1] : undefined;
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
//       code: [Number] - The HTTP error status code to be sent back to the client
//       reason: [String] - The reason text to be returned along with the error status code
//     }
//   }
function authenticateDevice(req) {
    try {
        // Parse HTTP request to retrieve relevant authentication data
        const authData = Authentication.parseWsHttpRequest(req);

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
                        code: 500,
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
                code: 401,
                reason: 'Authorization failed; invalid device or signature'
            }
        };
    }
    catch (err) {
        const error = {};

        if (err instanceof Meteor.Error) {
            if (err.error === 'ctn_auth_parse_err_missing_headers') {
                error.code = 401;
                error.reason = 'Authorization failed; missing required HTTP headers';
            }
            else if (err.error === 'ctn_auth_parse_err_malformed_timestamp') {
                error.code = 401;
                error.reason = 'Authorization failed; timestamp not well formed';
            }
            else if (err.error === 'ctn_auth_parse_err_timestamp_out_of_bounds') {
                error.code = 401;
                error.reason = 'Authorization failed; timestamp not within acceptable time variation';
            }
            else if (err.error === 'ctn_auth_parse_err_malformed_auth_header') {
                error.code = 401;
                error.reason = 'Authorization failed; authorization value not well formed';
            }
            else if (err.error === 'ctn_auth_parse_err_malformed_auth_credentials') {
                error.code = 401;
                error.reason = 'Authorization failed; authorization credentials not well formed';
            }
            else if (err.error === 'ctn_auth_parse_err_malformed_sign_date') {
                error.code = 401;
                error.reason = 'Authorization failed; signature date not well formed';
            }
            else if (err.error === 'ctn_auth_parse_err_sign_date_out_of_bounds') {
                error.code = 401;
                error.reason = 'Authorization failed; signature date out of bounds';
            }
            else {
                error.code = 500;
                error.reason = 'Internal server error';
            }
        }
        else {
            error.code = 500;
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
