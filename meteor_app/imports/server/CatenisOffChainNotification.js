/**
 * Created by claudio on 2019-12-07
 */

//console.log('[CatenisOffChainNotification.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import EventEmitter from 'events';
// Third-party node modules
import config from 'config';
import WebSocket from 'ws';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { httpSignRequest } from './CatenisOffChainClient';

// Config entries
const ctnOCNotifyConfig = config.get('catenisOffChainNotification');

// Configuration settings
const cfgSettings = {
    connectTimeout: ctnOCNotifyConfig.get('connectTimeout'),
    handshakeTimeout: ctnOCNotifyConfig.get('handshakeTimeout'),
    heartbeatPercentLag: ctnOCNotifyConfig.get('heartbeatPercentLag'),
    heartbeatProbingCount: ctnOCNotifyConfig.get('heartbeatProbingCount'),
    defaultHeartbeatTimeout: ctnOCNotifyConfig.get('defaultHeartbeatTimeout'),
    minReconnectTimeout: ctnOCNotifyConfig.get('minReconnectTimeout'),
    maxReconnectTimeout: ctnOCNotifyConfig.get('maxReconnectTimeout'),
    message: {
        newOffChainMsgData: ctnOCNotifyConfig.get('message.newOffChainMsgData')
    }
};


// Definition of classes
//

// CatenisOffChainNotification class
export class CatenisOffChainNotification extends EventEmitter {
    static notifyEvent = Object.freeze({
        connected: Object.freeze({
            name: 'connected',
            description: 'WebSocket notification connection has been established'
        }),
        disconnected: Object.freeze({
            name: 'disconnected',
            description: 'WebSocket notification connection has been broken'
        }),
        newDataReady: Object.freeze({
            name: 'new-data-ready',
            description: 'New Catenis off-chain data has been retrieved by Catenis off-chain server'
        })
    });

    constructor(hostname, port) {
        super();

        this.host = hostname + ':' + port;
        this.path = '/notify';
        this.connectUrl = 'ws://' + this.host + this.path;
        this.heartbeatCheckTimeout = undefined;
        this.disconnectedByUser = false;

        this._reset();
    }

    connect(retry = false) {
        function reconnect() {
            // noinspection JSPotentiallyInvalidUsageOfClassThis
            setTimeout(() => {
                Catenis.logger.TRACE('Trying to reestablish Catenis off-chain server notification WebSocket connection');
                doConnect.call(this);
            }, this._getReconnectTimeout());
        }

        function doConnect() {
            // noinspection JSPotentiallyInvalidUsageOfClassThis
            if (!this._tryConnect()) {
                reconnect.call(this);
            }
        }

        if (retry) {
            reconnect.call(this);
        }
        else {
            Catenis.logger.TRACE('Establish Catenis off-chain server notification WebSocket connection');
            doConnect.call(this);
        }
    }

    disconnect() {
        if (this.ws) {
            this.disconnectedByUser = true;
            this.ws.close();
        }
    }

    _reset(resetReconnectTimeout = true) {
        this.ws = undefined;
        this.disconnectedByUser = false;

        if (resetReconnectTimeout) {
            this.reconnectTimeout = 0;
        }

        if (!this.heartbeatCheckTimeout) {
            this.heartbeatCount = 0;
            this.firstHeartbeatTimestamp = undefined;
        }
    }

    _getReconnectTimeout() {
        if (this.reconnectTimeout === 0) {
            this.reconnectTimeout = cfgSettings.minReconnectTimeout;
        }
        else if (this.reconnectTimeout < cfgSettings.maxReconnectTimeout) {
            this.reconnectTimeout += this.reconnectTimeout;

            if (this.reconnectTimeout > cfgSettings.maxReconnectTimeout) {
                this.reconnectTimeout = cfgSettings.maxReconnectTimeout;
            }
        }

        Catenis.logger.DEBUG('Catenis off-chain server notification WebSocket connection reconnect timeout:', this.reconnectTimeout);
        return this.reconnectTimeout;
    }

    _tryConnect() {
        if (!this.ws) {
            try {
                this.ws = new WebSocket(this.connectUrl, {
                    handshakeTimeout: cfgSettings.handshakeTimeout,
                    timeout: cfgSettings.connectTimeout,
                    headers: this._getConnectHttpHeaders()
                });
            }
            catch (err) {
                Catenis.logger.ERROR('Error establishing Catenis off-chain server notification WebSocket connection.', err);
                return false;
            }

            this.ws.on('error', wsErrorHandler);
            this.ws.on('close', wsCloseHandler.bind(this));
            this.ws.on('open', wsOpenHandler.bind(this));
            this.ws.on('ping', wsPingHandler.bind(this));
            this.ws.on('message', wsMessageHandler.bind(this));
        }

        return true;
    }

    _getConnectHttpHeaders() {
        const dummyReq = new DummyRequest(this.host, this.path);

        httpSignRequest(dummyReq);

        return dummyReq.headers;
    }
}

class DummyRequest {
    constructor(host, path, method = 'GET', addDateHeader = true) {
        this.path = path;
        this.method = method;

        this._headers = {};

        this.setHeader('Host', host);

        if (addDateHeader) {
            this.setHeader('Date', new Date().toUTCString());
        }
    }

    get headers() {
        const headers = {};

        Object.keys(this._headers).forEach(key => headers[this._headers[key].name] = this._headers[key].value);

        return headers;
    }

    setHeader(name, value) {
        this._headers[name.toLowerCase()] = {
            name: name,
            value: value
        };
    }

    getHeader(name) {
        const entry = this._headers[name.toLowerCase()];

        if (entry) {
            return entry.value;
        }
    }
}


// Module functions used to simulate private CatenisOffChainNotification object methods
//  NOTE: these functions need to be bound to a CatenisOffChainNotification object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

function wsErrorHandler(error) {
    Catenis.logger.TRACE('Catenis off-chain server notification WebSocket connection error.', error);
}

function wsCloseHandler(code, reason) {
    Catenis.logger.TRACE('Catenis off-chain server notification WebSocket connection closed.', {code, reason});
    this.emit(CatenisOffChainNotification.notifyEvent.disconnected.name);

    if (this.ws.pingTimeout) {
        clearTimeout(this.ws.pingTimeout);
        this.ws.pingTimeout = undefined;
    }

    if (!this.disconnectedByUser) {
        if (!this.ws.successfullyOpen) {
            this._reset(false);
            this.connect(true);
        }
        else {
            this._reset();
            this.connect();
        }
    }
    else {
        this._reset();
    }
}

function wsOpenHandler() {
    Catenis.logger.TRACE('Catenis off-chain server notification WebSocket connection opened.');
    this.emit(CatenisOffChainNotification.notifyEvent.connected.name);

    this.ws.successfullyOpen = true;

    checkHeartbeat.call(this);
}

function wsPingHandler() {
    Catenis.logger.TRACE('Catenis off-chain server notification WebSocket connection heartbeat.');
    if (!this.heartbeatCheckTimeout) {
        if (this.heartbeatCount === 0) {
            this.firstHeartbeatTimestamp = Date.now();
            this.heartbeatCount++;
        }
        else {
            if (this.heartbeatCount === cfgSettings.heartbeatProbingCount) {
                // Calculate heartbeat check timeout
                this.heartbeatCheckTimeout = Math.floor(((Date.now() - this.firstHeartbeatTimestamp) / this.heartbeatCount) * (1 + cfgSettings.heartbeatPercentLag));
            }
            else {
                this.heartbeatCount++;
            }
        }
    }

    checkHeartbeat.call(this);
}

function wsMessageHandler(data) {
    Catenis.logger.TRACE('Catenis off-chain server notification message received.', {data});
    if (data === cfgSettings.message.newOffChainMsgData) {
        this.emit(CatenisOffChainNotification.notifyEvent.newDataReady.name);
    }
}


// Definition of module (private) functions
//

function checkHeartbeat() {
    if (this.ws.pingTimeout) {
        clearTimeout(this.ws.pingTimeout);
    }

    this.ws.pingTimeout = setTimeout(() => {
        Catenis.logger.DEBUG('No heartbeat check received from server for a while. Assume that server is down and terminate connection');
        this.ws.terminate();
    }, this.heartbeatCheckTimeout ? this.heartbeatCheckTimeout : cfgSettings.defaultHeartbeatTimeout);
}


// Module code
//

// Lock function class
Object.freeze(CatenisOffChainNotification);
