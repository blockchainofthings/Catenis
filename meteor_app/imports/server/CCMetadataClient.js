/**
 * Created by claudio on 26/09/17.
 */

//console.log('[CCMetadataClient.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import util from 'util';
import http from 'http';
// Third-party node modules
import config from 'config';
import jwt from 'jwt-simple';
import moment from 'moment';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';

// Config entries
const ccMetadataClientConfig = config.get('ccMetadataClient');
const methodPathConfig = ccMetadataClientConfig.get('methodPath');

// Configuration settings
const cfgSettings = {
    serverHost: ccMetadataClientConfig.get('serverHost'),
    tcpPort: ccMetadataClientConfig.get('tcpPort'),
    inetAddress: ccMetadataClientConfig.get('inetAddress'),
    user: ccMetadataClientConfig.get('user'),
    jwtSecret: ccMetadataClientConfig.get('jwtSecret'),
    tokenValidityDuration: ccMetadataClientConfig.get('tokenValidityDuration'),
    connectionTimeout: ccMetadataClientConfig.get('connectionTimeout'),
    methodPath: {
        addMetadata: methodPathConfig.get('addMetadata'),
        getMetadata: methodPathConfig.get('getMetadata'),
        shareMetadata: methodPathConfig.get('shareMetadata'),
        removeMetadata: methodPathConfig.get('removeMetadata')
    }
};


// Definition of function classes
//

// CCMetadataClient function class
export function CCMetadataClient(host, port, inetAddr, user, secret, timeout) {
    this.host = host;
    this.port = port;
    this.timeout = timeout;

    if (inetAddr.length > 0) {
        this.inetAddr = inetAddr;
    }

    if (user.length > 0 && secret.length > 0) {
        this.sendAuthorization = true;

        Object.defineProperty(this, 'jwtToken', {
            get: function () {
                const now = new Date();

                return jwt.encode({
                    iss: user,
                    exp: moment(now.setSeconds(now.getSeconds() + cfgSettings.tokenValidityDuration)).utc().format('YYYY-MM-DDTHH:mm:ss')
                }, secret);
            }
        });
    }

    this.syncSendRequest = Meteor.wrapAsync(sendRequest, this);
}


// Public CCMetadataClient object methods
//

// Call Colored Coins Metadata server addMetadata method
//
//  Arguments:
//   metadata [Object] - Object containing the metadata to store
//
//  Result: {
//   torrentHash: [String] - The hash of the torrent file containing the added metadata
//   sha2: [String] - The SHA256 hash of the metadata (JSON.stringify())
//  }
CCMetadataClient.prototype.addMetadata = function (metadata) {
    try {
        return postRequest.call(this, cfgSettings.methodPath.addMetadata, metadata);
    }
    catch (err) {
        handleError('addMetadata', err);
    }
};

// Call Colored Coins Metadata server getMetadata method
//
//  Arguments:
//   torrentHash: [String] - The hex encoded hash that identifies the torrent file that contains the metadata to be retrieved
//   sha2 [String]  - (optional) The hex encoded SHA256 hash of the metadata to be retrieved
//
//  Result: the metadata object
CCMetadataClient.prototype.getMetadata = function (torrentHash, sha2) {
    let path = cfgSettings.methodPath.getMetadata + '?torrentHash=' + torrentHash;

    if (sha2 !== undefined) {
        path += '&sha2=' + sha2;
    }

    try {
        return getRequest.call(this, path, true);
    }
    catch (err) {
        handleError('getMetadata', err);
    }
};

// Call Colored Coins Metadata server shareMetadata method
//
//  Arguments:
//   torrentHash: [String] - The hex encoded hash that identifies the torrent file that contains the metadata to be shared
CCMetadataClient.prototype.shareMetadata = function (torrentHash) {
    const path = cfgSettings.methodPath.shareMetadata + '?torrentHash=' + torrentHash;

    try {
        getRequest.call(this, path);
    }
    catch (err) {
        handleError('shareMetadata', err);
    }
};

// Call Colored Coins Metadata server removeMetadata method
//
//  Arguments:
//   torrentHash: [String] - The hex encoded hash that identifies the torrent file that contains the metadata to be removed
CCMetadataClient.prototype.removeMetadata = function (torrentHash) {
    const path = cfgSettings.methodPath.removeMetadata + '?torrentHash=' + torrentHash;

    try {
        getRequest.call(this, path);
    }
    catch (err) {
        handleError('removeMetadata', err);
    }
};


// Module functions used to simulate private CCMetadataClient object methods
//  NOTE: these functions need to be bound to a CCMetadataClient object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

function getRequest(path, isPublic = false) {
    return this.syncSendRequest('GET', path, null, isPublic);
}

function postRequest(path, data, isPublic = false) {
    return this.syncSendRequest('POST', path, JSON.stringify(data), isPublic);
}

// Sends an HTTP request and processes its response
//
//  Arguments:
//   method [String] - The method/verb of the request; either 'GET' or 'POST'
//   path [String]   - The url path of the request
//   body [Object|String] - (optional) Contents of the body of the request to send
//   isPublic [Boolean] - Indicates whether this this is a public request (does not require authorization) or not
//   callback [Function(err, res)] - The callback function to receive the request outcome
function sendRequest(method, path, body, isPublic, callback) {
    const reqOpts = {
        hostname: this.host,
        port: this.port,
        method: method,
        path: path,
        headers: {
            'Content-Type': 'application/json'
        }
    };

    if (this.inetAddr) {
        reqOpts.localAddress = this.inetAddr;
    }

    if (!isPublic && this.sendAuthorization) {
        if (method === 'GET') {
            reqOpts.path += (reqOpts.path.indexOf('?') === -1 ? '?' : '&') + 'token=' + this.jwtToken;
        }
        else if (method === 'POST') {
            let objBody;

            if (body) {
                if (typeof body === 'string') {
                    try {
                        const jsonBody = JSON.parse(body);

                        if (typeof jsonBody === 'object' && jsonBody !== null) {
                            objBody = jsonBody;
                        }
                    }
                    catch (err) {}
                }
                else if (typeof body === 'object') {
                    objBody = body;
                }
            }
            else {
                objBody = {};
            }

            if (objBody) {
                objBody.token = this.jwtToken;
                body = objBody;
            }
        }
    }

    if (typeof body === 'object' && body !== null) {
        body = JSON.stringify(body);
    }

    if (body) {
        reqOpts.headers['Content-Length'] = Buffer.byteLength(body);
    }

    let reqEnded = false;

    // Prepare request
    const req = http.request(reqOpts);

    // Set request time out
    const reqTimeout = setTimeout(() => {
        if (!reqEnded) {
            reqEnded = true;

            // Abort request and return error
            req.abort();

            callback(new Error('ETIMEDOUT'));
        }
    }, cfgSettings.connectionTimeout);

    // Set additional timeout on socket in case of remote freeze after sending headers
    req.setTimeout(cfgSettings.connectionTimeout, () => {
        if (!reqEnded) {
            reqEnded = true;

            // Abort request and return error
            req.abort();

            callback(new Error('ESOCKETTIMEDOUT'));
        }
    });

    req.on('error', (err) => {
        if (!reqEnded) {
            reqEnded = true;

            // Stop timeout and return error
            clearTimeout(reqTimeout);

            callback(err);
        }
    });

    req.on('response', (res) => {
        // Stop timeout
        clearTimeout(reqTimeout);

        let receivedData = '';

        res.on('data', (chunk) => {
            receivedData += chunk;
        });

        res.on('end', () => {
            if (!reqEnded) {
                reqEnded = true;

                if (res.statusCode !== 200) {
                    // Response error. Return error
                    const err = new Error(util.format('Response error: [%d] - %s', res.statusCode, res.statusMessage));
                    err.code = res.statusCode;
                    err.body = receivedData;

                    callback(err);
                }
                else {
                    if (receivedData.length > 0) {
                        // Try to parse received data
                        let jsonData;

                        try {
                            jsonData = JSON.parse(receivedData);
                        }
                        catch (err) {
                            // Error trying to parse returned data. Return error
                            Catenis.logger.ERROR('CCMetadataClient - Error parsing data returned from request', {
                                receivedData: receivedData
                            });
                            callback(new Error(util.format('Error parsing returned data: [%s] - %s', err.name, err.message)));
                            return;
                        }

                        // Return parsed data
                        callback(undefined, jsonData);
                    }
                    else {
                        // Just indicate that request has returned
                        callback();
                    }
                }
            }
        });
    });

    // Send request
    req.end(body ? body : undefined);
}


// CCMetadataClient function class (public) methods
//

CCMetadataClient.initialize = function () {
    Catenis.logger.TRACE('CCMetadataClient initialization');
    // Instantiate CCMetadataClient object
    Catenis.ccMdClient = new CCMetadataClient(cfgSettings.serverHost, cfgSettings.tcpPort, cfgSettings.inetAddress, cfgSettings.user, cfgSettings.jwtSecret, cfgSettings.connectionTimeout);
};


// CCMetadataClient function class (public) properties
//

/*CCMetadataClient.prop = {};*/


// Definition of module (private) functions
//

function handleError(methodName, err) {
    let errMsg = util.format('Error calling Colored Coins Metadata server \'%s\' method.', methodName);

    // Log error and rethrow it
    Catenis.logger.DEBUG(errMsg, err);

    errMsg += ' ' + err.toString();

    throw new Meteor.Error('ctn_cc_metadata_server_error', errMsg, err);
}



// Module code
//

// Lock function class
Object.freeze(CCMetadataClient);
