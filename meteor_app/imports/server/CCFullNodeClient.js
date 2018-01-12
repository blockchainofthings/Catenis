/**
 * Created by claudio on 21/09/17.
 */

//console.log('[CCFullNodeClient.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import util from 'util';
import http from 'http';
// Third-party node modules
import config from 'config';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';

// Config entries
const ccFullNodeClientConfig = config.get('ccFullNodeClient');
const methodPathConfig = ccFullNodeClientConfig.get('methodPath');

// Configuration settings
const cfgSettings = {
    serverHost: ccFullNodeClientConfig.get('serverHost'),
    mainTcpPort: ccFullNodeClientConfig.get('mainTcpPort'),
    testnetTcpPort: ccFullNodeClientConfig.get('testnetTcpPort'),
    inetAddress: ccFullNodeClientConfig.get('inetAddress'),
    user: ccFullNodeClientConfig.get('user'),
    password: ccFullNodeClientConfig.get('password'),
    connectionTimeout: ccFullNodeClientConfig.get('connectionTimeout'),
    methodPath: {
        parseNow: methodPathConfig.get('parseNow'),
        getAddressesUtxos: methodPathConfig.get('getAddressesUtxos'),
        getUtxos: methodPathConfig.get('getUtxos'),
        getTxouts: methodPathConfig.get('getTxouts'),
        getAddressesTransactions: methodPathConfig.get('getAddressesTransactions'),
        transmit: methodPathConfig.get('transmit'),
        getInfo: methodPathConfig.get('getInfo'),
        importAddresses: methodPathConfig.get('importAddresses')
    }
};


// Definition of function classes
//

// CCFullNodeClient function class
export function CCFullNodeClient(network, host, inetAddr, username, password, timeout) {
    this.host = host;
    this.port = network === 'testnet' ? cfgSettings.testnetTcpPort : cfgSettings.mainTcpPort;
    this.timeout = timeout;

    if (inetAddr.length > 0) {
        this.inetAddr = inetAddr;
    }

    if (username.length > 0) {
        this.auth = username + ':' + password;
    }

    this.syncSendRequest = Meteor.wrapAsync(sendRequest, this);
}


// Public CCFullNodeClient object methods
//


// Call Colored Coins Full Node parseNow method
//
CCFullNodeClient.prototype.parseNow = function () {
    try {
        return getRequest.call(this, cfgSettings.methodPath.parseNow);
    }
    catch (err) {
        handleError('parseNow', err);
    }
};

// Call Colored Coins Full Node getAddressesUtxos method
//
//  Arguments:
//   addresses [String|Array(String)] - Blockchain addresses for which to retrieve UTXOs
//   numOfConfirmations [Number]      - Minimum number of confirmations for UTXO to be returned
CCFullNodeClient.prototype.getAddressesUtxos = function (addresses, numOfConfirmations, waitForParsing = true) {
    const postData = {
        addresses: Array.isArray(addresses) ? addresses : [addresses]
    };

    if (numOfConfirmations !== undefined) {
        postData.numOfConfirmations = numOfConfirmations;
    }

    if (waitForParsing) {
        postData.waitForParsing = true;
    }

    try {
        return postRequest.call(this, cfgSettings.methodPath.getAddressesUtxos, postData);
    }
    catch (err) {
        handleError('getAddressesUtxos', err);
    }
};

// Call Colored Coins Full Node getUtxos method
//
//  Arguments:
//   utxos: [{ [Object|Array(Object)] - Transaction outputs for which to retrieve UTXOs
//     txid: [String],  - Transaction ID
//     index: [Number]  - Output index (vout)
//   }]
//   numOfConfirmations [Number]  - Minimum number of confirmations for UTXO to be returned
CCFullNodeClient.prototype.getUtxos = function (utxos, numOfConfirmations, waitForParsing = true) {
    const postData = {
        utxos: Array.isArray(utxos) ? utxos : [utxos]
    };

    if (numOfConfirmations !== undefined) {
        postData.numOfConfirmations = numOfConfirmations;
    }

    if (waitForParsing) {
        postData.waitForParsing = true;
    }

    try {
        return postRequest.call(this, cfgSettings.methodPath.getUtxos, postData);
    }
    catch (err) {
        handleError('getUtxos', err);
    }
};

// Call Colored Coins Full Node (BCoT modified version) getTxouts method
//
//  Arguments:
//   txouts: [{ [Object|Array(Object)] - Transaction outputs for which to retrieve Colored Coins data
//     txid: [String],  - Transaction ID
//     vout: [Number]  - Output index
//   }]
CCFullNodeClient.prototype.getTxouts = function (txouts, waitForParsing = true) {
    const postData = {
        txouts: Array.isArray(txouts) ? txouts : [txouts]
    };

    if (waitForParsing) {
        postData.waitForParsing = true;
    }
    
    try {
        return postRequest.call(this, cfgSettings.methodPath.getTxouts, postData);
    }
    catch (err) {
        handleError('getTxouts', err);
    }
};

// Call Colored Coins Full Node getAddressesTransactions method
//
//  Arguments:
//   addresses [String|Array(String)] - Blockchain addresses for which to retrieve transactions
CCFullNodeClient.prototype.getAddressesTransactions = function (addresses, waitForParsing = true) {
    const postData = {
        addresses: Array.isArray(addresses) ? addresses : [addresses]
    };

    if (waitForParsing) {
        postData.waitForParsing = true;
    }

    try {
        return postRequest.call(this, cfgSettings.methodPath.getAddressesTransactions, postData);
    }
    catch (err) {
        handleError('getAddressesTransactions', err);
    }
};

// Call Colored Coins Full Node transmit method
//
//  Arguments:
//   txHex [String] - Hex encoded serialization of transaction to send to the blockchain
CCFullNodeClient.prototype.transmit = function (txHex) {
    const postData = {
        txHex: txHex
    };

    try {
        return postRequest.call(this, cfgSettings.methodPath.transmit, postData);
    }
    catch (err) {
        handleError('transmit', err);
    }
};

// Call Colored Coins Full Node getInfo method
//
CCFullNodeClient.prototype.getInfo = function () {
    try {
        return getRequest.call(this, cfgSettings.methodPath.getInfo);
    }
    catch (err) {
        handleError('getInfo', err);
    }
};

// Call Colored Coins Full Node importAddresses method
//
//  Arguments:
//   addresses [String|Array(String)] - Blockchain addresses to import
//   reindex [Boolean]      - Indicates whether Bitcoin Core's database should be reindexed
CCFullNodeClient.prototype.importAddresses = function (addresses, reindex) {
    const postData = {
        addresses: Array.isArray(addresses) ? addresses : [addresses]
    };

    if (reindex !== undefined) {
        postData.reindex = reindex;
    }

    try {
        return postRequest.call(this, cfgSettings.methodPath.importAddresses, postData);
    }
    catch (err) {
        handleError('importAddresses', err);
    }
};


// Module functions used to simulate private CCFullNodeClient object methods
//  NOTE: these functions need to be bound to a CCFullNodeClient object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

function getRequest(path) {
    return this.syncSendRequest('GET', path, null);
}

function postRequest(path, data) {
    return this.syncSendRequest('POST', path, JSON.stringify(data));
}

// Sends an HTTP request and processes its response
//
//  Arguments:
//   method [String] - The method/verb of the request; either 'GET' or 'POST'
//   path [String]   - The url path of the request
//   body [String] - (optional) Contents of the body of the request to send
//   callback [Function(err, res)] - The callback function to receive the request outcome
function sendRequest(method, path, body, callback) {
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

    if (this.auth) {
        reqOpts.auth = this.auth;
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


// CCFullNodeClient function class (public) methods
//

CCFullNodeClient.initialize = function () {
    Catenis.logger.TRACE('CCFullNodeClient initialization');
    // Instantiate CCFullNodeClient object
    Catenis.ccFNClient = new CCFullNodeClient(Catenis.application.cryptoNetworkName, cfgSettings.serverHost, cfgSettings.inetAddress, cfgSettings.user, cfgSettings.password, cfgSettings.connectionTimeout);
};


// CCFullNodeClient function class (public) properties
//

/*CCFullNodeClient.prop = {};*/


// Definition of module (private) functions
//

function handleError(methodName, err) {
    let errMsg = util.format('Error calling Colored Coins Full Node \'%s\' method.', methodName);

    // Log error and rethrow it
    Catenis.logger.DEBUG(errMsg, err);

    errMsg += ' ' + err.toString();

    throw new Meteor.Error('ctn_cc_full_node_error', errMsg, err);
}



// Module code
//

// Lock function class
Object.freeze(CCFullNodeClient);