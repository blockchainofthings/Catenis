/**
 * Created by Claudio on 2017-09-21.
 */

//console.log('[C3NodeClient.js]: This code just ran.');

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
const c3NodeClientConfig = config.get('c3NodeClient');
const methodPathConfig = c3NodeClientConfig.get('methodPath');

// Configuration settings
const cfgSettings = {
    serverHost: c3NodeClientConfig.get('serverHost'),
    mainTcpPort: c3NodeClientConfig.get('mainTcpPort'),
    testnetTcpPort: c3NodeClientConfig.get('testnetTcpPort'),
    inetAddress: c3NodeClientConfig.get('inetAddress'),
    user: c3NodeClientConfig.get('user'),
    password: c3NodeClientConfig.get('password'),
    connectionTimeout: c3NodeClientConfig.get('connectionTimeout'),
    methodPath: {
        parseNow: methodPathConfig.get('parseNow'),
        getAddressesUtxos: methodPathConfig.get('getAddressesUtxos'),
        getUtxos: methodPathConfig.get('getUtxos'),
        getTxouts: methodPathConfig.get('getTxouts'),
        getAddressesTransactions: methodPathConfig.get('getAddressesTransactions'),
        transmit: methodPathConfig.get('transmit'),
        getInfo: methodPathConfig.get('getInfo'),
        importAddresses: methodPathConfig.get('importAddresses'),
        getAssetHolders: methodPathConfig.get('getAssetHolders'),
        getAssetBalance: methodPathConfig.get('getAssetBalance'),
        getMultiAssetBalance: methodPathConfig.get('getMultiAssetBalance'),
        getAssetIssuance: methodPathConfig.get('getAssetIssuance'),
        getAssetIssuingAddress: methodPathConfig.get('getAssetIssuingAddress'),
        getOwningAssets: methodPathConfig.get('getOwningAssets')
    }
};


// Definition of function classes
//

// C3NodeClient function class
export function C3NodeClient(network, host, inetAddr, username, password, timeout) {
    this.host = host;
    this.port = network === 'testnet' || network === 'regtest' ? cfgSettings.testnetTcpPort : cfgSettings.mainTcpPort;
    this.timeout = timeout;

    if (inetAddr.length > 0) {
        this.inetAddr = inetAddr;
    }

    if (username.length > 0) {
        this.auth = username + ':' + password;
    }

    this.syncSendRequest = Meteor.wrapAsync(sendRequest, this);
}


// Public C3NodeClient object methods
//


// Call Catenis Colored Coins node server parseNow method
//
C3NodeClient.prototype.parseNow = function () {
    try {
        return getRequest.call(this, cfgSettings.methodPath.parseNow);
    }
    catch (err) {
        handleError('parseNow', err);
    }
};

// Call Catenis Colored Coins node server getAddressesUtxos method
//
//  Arguments:
//   addresses [String|Array(String)] - Blockchain addresses for which to retrieve UTXOs
//   numOfConfirmations [Number]      - Minimum number of confirmations for UTXO to be returned
//   waitForParsing [Boolean] - (optional) Indicates whether processing of request should wait until parsing of assets
//                               is complete
C3NodeClient.prototype.getAddressesUtxos = function (addresses, numOfConfirmations, waitForParsing = true) {
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

// Call Catenis Colored Coins node server getUtxos method
//
//  Arguments:
//   utxos: [{ [Object|Array(Object)] - Transaction outputs for which to retrieve UTXOs
//     txid: [String],  - Transaction ID
//     index: [Number]  - Output index (vout)
//   }]
//   numOfConfirmations [Number]  - Minimum number of confirmations for UTXO to be returned
//   waitForParsing [Boolean] - (optional) Indicates whether processing of request should wait until parsing of assets
//                               is complete
C3NodeClient.prototype.getUtxos = function (utxos, numOfConfirmations, waitForParsing = true) {
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

// Call Catenis Colored Coins node server getTxouts method
//
//  Arguments:
//   txouts: [{ [Object|Array(Object)] - Transaction outputs for which to retrieve Colored Coins data
//     txid: [String],  - Transaction ID
//     vout: [Number]  - Output index
//   }]
//   waitForParsing [Boolean] - (optional) Indicates whether processing of request should wait until parsing of assets
//                               is complete
C3NodeClient.prototype.getTxouts = function (txouts, waitForParsing = true) {
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

// Call Catenis Colored Coins node server getAddressesTransactions method
//
//  Arguments:
//   addresses [String|Array(String)] - Blockchain addresses for which to retrieve transactions
//   waitForParsing [Boolean] - (optional) Indicates whether processing of request should wait until parsing of assets
//                               is complete
C3NodeClient.prototype.getAddressesTransactions = function (addresses, waitForParsing = true) {
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

// Call Catenis Colored Coins node server transmit method
//
//  Arguments:
//   txHex [String] - Hex encoded serialization of transaction to send to the blockchain
C3NodeClient.prototype.transmit = function (txHex) {
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

// Call Catenis Colored Coins node server getInfo method
//
C3NodeClient.prototype.getInfo = function () {
    try {
        return getRequest.call(this, cfgSettings.methodPath.getInfo);
    }
    catch (err) {
        handleError('getInfo', err);
    }
};

// Call Catenis Colored Coins node server importAddresses method
//
//  Arguments:
//   addresses [String|Array(String)] - Blockchain addresses to import
//   reindex [Boolean]      - Indicates whether Bitcoin Core's database should be reindexed
C3NodeClient.prototype.importAddresses = function (addresses, reindex) {
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

// Call Catenis Colored Coins node server getAssetHolders method
//
//  Arguments:
//   ccAssetId [String] - Colored Coins asset ID
//   numOfConfirmations [Number] - (optional) Minimum number of confirmations to include UTXO amount in accumulated
//                                  asset amount balance per holding address
//   waitForParsing [Boolean] - (optional) Indicates whether processing of request should wait until parsing of assets
//                               is complete
C3NodeClient.prototype.getAssetHolders = function (ccAssetId, numOfConfirmations, waitForParsing = true) {
    const postData = {
        assetId: ccAssetId
    };

    if (numOfConfirmations !== undefined) {
        postData.numOfConfirmations = numOfConfirmations;
    }

    if (waitForParsing) {
        postData.waitForParsing = true;
    }

    try {
        return postRequest.call(this, cfgSettings.methodPath.getAssetHolders, postData);
    }
    catch (err) {
        handleError('getAssetHolders', err);
    }
};

// Call Catenis Colored Coins node server getAssetBalance method
//
//  Arguments:
//   ccAssetId [String] - Colored Coins asset ID
//   addresses [String|Array(String)] - (optional) List of addresses (or a single address) used to restrict the balance computation
//   numOfConfirmations [Number] - (optional) Minimum number of confirmations to include UTXO amount in accumulated asset amount balance
//   waitForParsing [Boolean] - (optional) Indicates whether processing of request should wait until parsing of assets
//                               is complete
C3NodeClient.prototype.getAssetBalance = function (ccAssetId, addresses, numOfConfirmations, waitForParsing = true) {
    const postData = {
        assetId: ccAssetId
    };

    if (addresses) {
        postData.addresses = Array.isArray(addresses) ? addresses : [addresses];
    }

    if (numOfConfirmations !== undefined) {
        postData.numOfConfirmations = numOfConfirmations;
    }

    if (waitForParsing) {
        postData.waitForParsing = true;
    }

    try {
        return postRequest.call(this, cfgSettings.methodPath.getAssetBalance, postData);
    }
    catch (err) {
        handleError('getAssetBalance', err);
    }
};

// Call Catenis Colored Coins node server getMultiAssetBalance method
//
//  Arguments:
//   ccAssetIds [String|Array(String)] - List of Colored Coins asset IDs (or a single ID)
//   addresses [String|Array(String)] - (optional) List of addresses (or a single address) used to restrict the balance computation
//   numOfConfirmations [Number] - (optional) Minimum number of confirmations to include UTXO amount in accumulated asset amount balance
//   waitForParsing [Boolean] - (optional) Indicates whether processing of request should wait until parsing of assets
//                               is complete
C3NodeClient.prototype.getMultiAssetBalance = function (ccAssetIds, addresses, numOfConfirmations, waitForParsing = true) {
    const postData = {
        assetIds: Array.isArray(ccAssetIds) ? ccAssetIds : [ccAssetIds]
    };

    if (addresses) {
        postData.addresses = Array.isArray(addresses) ? addresses : [addresses];
    }

    if (numOfConfirmations !== undefined) {
        postData.numOfConfirmations = numOfConfirmations;
    }

    if (waitForParsing) {
        postData.waitForParsing = true;
    }

    try {
        return postRequest.call(this, cfgSettings.methodPath.getMultiAssetBalance, postData);
    }
    catch (err) {
        handleError('getMultiAssetBalance', err);
    }
};

// Call Catenis Colored Coins node server getAssetIssuance method
//
//  Arguments:
//   ccAssetId [String] - Colored Coins asset ID
//   waitForParsing [Boolean] - (optional) Indicates whether processing of request should wait until parsing of assets
//                               is complete
C3NodeClient.prototype.getAssetIssuance = function (ccAssetId, waitForParsing = true) {
    const postData = {
        assetId: ccAssetId
    };

    if (waitForParsing) {
        postData.waitForParsing = true;
    }

    try {
        return postRequest.call(this, cfgSettings.methodPath.getAssetIssuance, postData);
    }
    catch (err) {
        handleError('getAssetIssuance', err);
    }
};

// Call Catenis Colored Coins node server getAssetIssuingAddress method
//
//  Arguments:
//   ccAssetId [String] - Colored Coins asset ID
//   waitForParsing [Boolean] - (optional) Indicates whether processing of request should wait until parsing of assets
//                               is complete
C3NodeClient.prototype.getAssetIssuingAddress = function (ccAssetId, waitForParsing = true) {
    const postData = {
        assetId: ccAssetId
    };

    if (waitForParsing) {
        postData.waitForParsing = true;
    }

    try {
        return postRequest.call(this, cfgSettings.methodPath.getAssetIssuingAddress, postData);
    }
    catch (err) {
        handleError('getAssetIssuingAddress', err);
    }
};

// Call Catenis Colored Coins node server getOwningAssets method
//
//  Arguments:
//   addresses [String|Array(String)] - List of addresses (or a single address) for which to retrieve the assets
//                                       owned by them
//   numOfConfirmations [Number] - (optional) Minimum number of confirmations to include UTXO amount in accumulated
//                                  asset amount balance
//   waitForParsing [Boolean] - (optional) Indicates whether processing of request should wait until parsing of assets
//                               is complete
C3NodeClient.prototype.getOwningAssets = function (addresses, numOfConfirmations, waitForParsing = true) {
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
        return postRequest.call(this, cfgSettings.methodPath.getOwningAssets, postData);
    }
    catch (err) {
        handleError('getOwningAssets', err);
    }
};


// Module functions used to simulate private C3NodeClient object methods
//  NOTE: these functions need to be bound to a C3NodeClient object reference (this) before
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


// C3NodeClient function class (public) methods
//

C3NodeClient.initialize = function () {
    Catenis.logger.TRACE('C3NodeClient initialization');
    // Instantiate C3NodeClient object
    Catenis.c3NodeClient = new C3NodeClient(Catenis.application.cryptoNetworkName, cfgSettings.serverHost, cfgSettings.inetAddress, cfgSettings.user, cfgSettings.password, cfgSettings.connectionTimeout);
};


// C3NodeClient function class (public) properties
//

/*C3NodeClient.prop = {};*/


// Definition of module (private) functions
//

function handleError(methodName, err) {
    let errMsg = util.format('Error calling Catenis Colored Coins node server \'%s\' method.', methodName);

    // Log error and rethrow it
    Catenis.logger.DEBUG(errMsg, err);

    errMsg += ' ' + err.toString();

    throw new Meteor.Error('ctn_c3_node_svr_error', errMsg, err);
}



// Module code
//

// Lock function class
Object.freeze(C3NodeClient);
