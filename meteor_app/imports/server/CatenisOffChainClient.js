/**
 * Created by claudio on 2019-12-06
 */

//console.log('[CatenisOffChainClient.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import util from 'util';
import querystring from 'querystring';
// Third-party node modules
import config from 'config';
import restifyClients from 'restify-clients';
import httpSignature from 'http-signature';
import Future from 'fibers/future';
// Meteor packages
import { Meteor } from 'meteor/meteor';
// References code in other (Catenis) modules
import {Catenis} from './Catenis';
import {CatenisOffChainNotification} from './CatenisOffChainNotification';

// Config entries
const ctnOClientConfig = config.get('catenisOffChainClient');

// Configuration settings
const cfgSettings = {
    hostname: ctnOClientConfig.get('hostname'),
    port: ctnOClientConfig.get('port'),
    connectTimeout: ctnOClientConfig.get('connectTimeout'),
    requestTimeout: ctnOClientConfig.get('requestTimeout'),
    headersToSign: ctnOClientConfig.get('headersToSign')
};


// Definition of function classes
//

// CatenisOffChainClient function class
export function CatenisOffChainClient(hostname, port) {
    this.hostname = hostname;
    this.port = port;

    // NOTE: we are using the `agent: false` option below to avoid ECONNRESET and socket hangup errors
    //  when calling the Catenis off-chain server API methods repeatedly with a short time interval
    this.client = new restifyClients.createJSONClient({
        connectTimeout: cfgSettings.connectTimeout,
        requestTimeout: cfgSettings.requestTimeout,
        retry: false,
        signRequest: httpSignRequest,
        url: 'http://' + hostname + ':' + port,
        agent: false
    });
    this.futGet = Future.wrap(this.client.get, true);
    this.futPost = Future.wrap(this.client.post, true);
    this.syncMethod = {
        get: (...args) => {
            return this.futGet.apply(this.client, args).wait();
        },
        post: (...args) => {
            return this.futPost.apply(this.client, args).wait();
        }
    };

    this._notifier = undefined;

    Object.defineProperty(this, 'notifier', {
        get: function () {
            if (!this._notifier) {
                this._notifier = new CatenisOffChainNotification(this.hostname, this.port);
            }

            return this._notifier;
        },
        enumerable: true
    });
}


// Public CatenisOffChainClient object methods
//

CatenisOffChainClient.prototype.getOffChainMsgData = function (retrievedAfter, limit, skip, callback) {
    if (typeof retrievedAfter === 'function') {
        callback = retrievedAfter;
        retrievedAfter = limit = skip = undefined;
    }
    else if (typeof limit === 'function') {
        callback = limit;
        limit = skip = undefined;
    }
    else if (typeof skip === 'function') {
        callback = skip;
        skip = undefined;
    }
    
    const params = {};
    
    if (retrievedAfter instanceof Date) {
        params.retrievedAfter = retrievedAfter.toISOString();
    }
    
    if (typeof limit === 'number') {
        params.limit = limit;
    }
    
    if (typeof skip === 'number') {
        params.skip = skip;
    }
    
    const queryStr = querystring.stringify(params);

    let endpointUrl = '/msg-data';
    
    if (queryStr.length > 0) {
        endpointUrl += '?' + queryStr;
    }

    if (typeof callback === 'function') {
        this.client.get(endpointUrl, (err, req, res, retData) => {
            if (err) {
                handleError('getOffChainMsgData', err, callback);
            }
            else {
                callback(null, retData.data);
            }
        });
    }
    else {
        try {
            return this.syncMethod.get(endpointUrl)[2].data;
        }
        catch (err) {
            handleError('getOffChainMsgData', err);
        }
    }
};

CatenisOffChainClient.prototype.getSingleOffChainMsgData = function (cid, includeSavedOnly, callback) {
    if (typeof includeSavedOnly === 'function') {
        callback = includeSavedOnly;
        includeSavedOnly = undefined;
    }

    const params = {};

    if (includeSavedOnly !== undefined) {
        params.includeSavedOnly = !!includeSavedOnly;
    }

    const queryStr = querystring.stringify(params);

    let endpointUrl = util.format('/msg-data/%s', cid);

    if (queryStr.length > 0) {
        endpointUrl += '?' + queryStr;
    }

    if (typeof callback === 'function') {
        this.client.get(endpointUrl, (err, req, res, retData) => {
            if (err) {
                handleError('getSingleOffChainMsgData', err, callback);
            }
            else {
                callback(null, retData.data);
            }
        });
    }
    else {
        try {
            return this.syncMethod.get(endpointUrl)[2].data;
        }
        catch (err) {
            handleError('getSingleOffChainMsgData', err);
        }
    }
};

CatenisOffChainClient.prototype.saveOffChainMsgEnvelope = function (data, immediateRetrieval, callback) {
    const endpointUrl = '/msg-data/envelope';
    const bodyParams = {
        data: Buffer.isBuffer(data) ? data.toString('base64') : data
    };

    if (immediateRetrieval !== undefined) {
        bodyParams.immediateRetrieval = !!immediateRetrieval;
    }

    if (typeof callback === 'function') {
        this.client.post(endpointUrl, bodyParams, (err, req, res, retData) => {
            if (err) {
                handleError('saveOffChainMsgEnvelope', err, callback);
            }
            else {
                callback(null, retData.data);
            }
        });
    }
    else {
        try {
            return this.syncMethod.post(endpointUrl, bodyParams)[2].data;
        }
        catch (err) {
            handleError('saveOffChainMsgEnvelope', err);
        }
    }
};

CatenisOffChainClient.prototype.saveOffChainMsgReceipt = function (data, immediateRetrieval, callback) {
    const endpointUrl = '/msg-data/receipt';
    const bodyParams = {
        data: Buffer.isBuffer(data) ? data.toString('base64') : data
    };

    if (immediateRetrieval !== undefined) {
        bodyParams.immediateRetrieval = !!immediateRetrieval;
    }

    if (typeof callback === 'function') {
        this.client.post(endpointUrl, bodyParams, (err, req, res, retData) => {
            if (err) {
                handleError('saveOffChainMsgReceipt', err, callback);
            }
            else {
                callback(null, retData.data);
            }
        });
    }
    else {
        try {
            return this.syncMethod.post(endpointUrl, bodyParams)[2].data;
        }
        catch (err) {
            handleError('saveOffChainMsgReceipt', err);
        }
    }
};


// Module functions used to simulate private CatenisOffChainClient object methods
//  NOTE: these functions need to be bound to a CatenisOffChainClient object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// CatenisOffChainClient function class (public) methods
//

CatenisOffChainClient.initialize = function () {
    Catenis.logger.TRACE('CatenisOffChainClient initialization');
    // Instantiate App object
    Catenis.ctnOCClient = new CatenisOffChainClient(cfgSettings.hostname, cfgSettings.port);
};


// CatenisOffChainClient function class (public) properties
//

//CatenisOffChainClient.prop = {};


// Definition of module (private) functions
//

export function httpSignRequest(req) {
    httpSignature.sign(req, {
        keyId: Catenis.application.ctnNode.id,
        key: Catenis.application.ctnNode.privKey,
        headers: cfgSettings.headersToSign.concat()
    });
}

function handleError(methodName, err, callback) {
    let errMsg = util.format('Error calling Catenis Off-Chain Server API \'%s\' method.', methodName);

    // Log error and rethrow it
    Catenis.logger.DEBUG(errMsg, err);
    const error = new Meteor.Error('ctn_ctn_oc_svr_api_error', errMsg, err);

    if (callback) {
        callback(error);
    }
    else {
        throw error;
    }
}


// Module code
//

// Lock function class
Object.freeze(CatenisOffChainClient);
