/**
 * Created by Claudio on 2017-10-23.
 */

//console.log('[IpfsClient.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import util from 'util';
// Third-party node modules
import config from 'config';
import { create as ipfsHttpClient} from 'ipfs-http-client';
import toStream from 'it-to-stream';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { Util } from './Util';

// Config entries
const ipfsClientConfig = config.get('ipfsClient');

// Configuration settings
const cfgSettings = {
    apiHost: ipfsClientConfig.get('apiHost'),
    apiPort: ipfsClientConfig.get('apiPort'),
    apiProtocol: ipfsClientConfig.get('apiProtocol')
};


// Definition of function classes
//

// IpfsClient function class
export function IpfsClient(host, port, protocol) {
    this.ipfs = ipfsHttpClient({
        host: host,
        port: port,
        protocol: protocol
    });

    // noinspection JSUnresolvedVariable
    this.api = {
        add: Util.wrapAsyncPromise(this.ipfs.add, this.ipfs),
        cat: Util.wrapAsyncIterable(this.ipfs.cat, Util.asyncIterableToBuffer, this.ipfs),
        catReadableStream: Util.wrapAsyncIterable(this.ipfs.cat, toStream.readable, this.ipfs),
        id: Util.wrapAsyncPromise(this.ipfs.id, this.ipfs)
    };
}


// Public IpfsClient object methods
//

IpfsClient.prototype.add = function (data, options) {
    try {
        return this.api.add(data, options);
    }
    catch (err) {
        handleError('add', err);
    }
};

IpfsClient.prototype.cat = function (ipfsPath) {
    try {
        return this.api.cat(ipfsPath);
    }
    catch (err) {
        handleError('cat', err);
    }
};

IpfsClient.prototype.catReadableStream = function (ipfsPath) {
    try {
        return this.api.catReadableStream(ipfsPath);
    }
    catch (err) {
        handleError('catReadableStream', err);
    }
};

IpfsClient.prototype.id = function () {
    try {
        return this.api.id();
    }
    catch (err) {
        handleError('id', err);
    }
};


// Module functions used to simulate private IpfsClient object methods
//  NOTE: these functions need to be bound to a IpfsClient object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// IpfsClient function class (public) methods
//

IpfsClient.initialize = function () {
    Catenis.logger.TRACE('IpfsClient initialization');
    // Instantiate IpfsClient object
    Catenis.ipfsClient = new IpfsClient(cfgSettings.apiHost, cfgSettings.apiPort, cfgSettings.apiProtocol);
};


// IpfsClient function class (public) properties
//

/*IpfsClient.prop = {};*/


// Definition of module (private) functions
//

function handleError(methodName, err, callback) {
    let errMsg = util.format('Error calling IPFS API \'%s\' method.', methodName);

    // Log error and rethrow it
    Catenis.logger.DEBUG(errMsg, err);
    const error = new Meteor.Error('ctn_ipfs_api_error', errMsg, err);

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
Object.freeze(IpfsClient);
