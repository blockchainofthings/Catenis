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
import ipfsHttpClient from 'ipfs-http-client';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';

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

    addMissingIpfsMethods.call(this);

    // noinspection JSUnresolvedVariable
    this.api = {
        add: Meteor.wrapAsync(this.ipfs.add, this.ipfs),
        cat: Meteor.wrapAsync(this.ipfs.cat, this.ipfs),
        catReadableStream: this.ipfs.catReadableStream,
        id: Meteor.wrapAsync(this.ipfs.id, this.ipfs),
        ls: Meteor.wrapAsync(this.ipfs.ls, this.ipfs),
        files: {
            ls: Meteor.wrapAsync(this.ipfs.files.ls, this.ipfs),
            mkdir: Meteor.wrapAsync(this.ipfs.files.mkdir, this.ipfs),
            stat: Meteor.wrapAsync(this.ipfs.files.stat, this.ipfs),
            write: Meteor.wrapAsync(this.ipfs.files.write, this.ipfs)
        },
        pin: {
            add: Meteor.wrapAsync(this.ipfs.pin.add, this.ipfs),
            update: Meteor.wrapAsync(this.ipfs.pin.update, this.ipfs),
            rm: Meteor.wrapAsync(this.ipfs.pin.rm, this.ipfs)
        }
    };
}


// Public IpfsClient object methods
//

IpfsClient.prototype.add = function (data, options) {
    try {
        return fixIpfsClusterAddResults(this.api.add(data, options));
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

IpfsClient.prototype.ls = function (ipfsPath) {
    try {
        return this.api.ls(ipfsPath);
    }
    catch (err) {
        handleError('ls', err);
    }
};

IpfsClient.prototype.filesLs = function (path, options) {
    try {
        return this.api.files.ls(path, options);
    }
    catch (err) {
        handleError('filesLs', err);
    }
};

IpfsClient.prototype.filesMkdir = function (path, options) {
    try {
        return this.api.files.mkdir(path, options);
    }
    catch (err) {
        handleError('filesMkdir', err);
    }
};

IpfsClient.prototype.filesStat = function (path, options) {
    try {
        return this.api.files.stat(path, options);
    }
    catch (err) {
        handleError('filesStat', err);
    }
};

IpfsClient.prototype.filesWrite = function (path, content, options) {
    try {
        return this.api.files.write(path, content, options);
    }
    catch (err) {
        handleError('filesWrite', err);
    }
};

IpfsClient.prototype.pinAdd = function (hash, options) {
    try {
        return this.api.pin.add(hash, options);
    }
    catch (err) {
        handleError('pinAdd', err);
    }
};

IpfsClient.prototype.pinUpdate = function (fromHash, toHash, options) {
    try {
        return this.api.pin.update(fromHash, toHash, options);
    }
    catch (err) {
        handleError('pinUpdate', err);
    }
};

IpfsClient.prototype.pinRm = function (hash, options) {
    try {
        return this.api.pin.rm(hash, options);
    }
    catch (err) {
        handleError('pinRm', err);
    }
};


// Module functions used to simulate private IpfsClient object methods
//  NOTE: these functions need to be bound to a IpfsClient object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

function addMissingIpfsMethods() {
    addMissingPinUpdateMethod.call(this);
}

function addMissingPinUpdateMethod() {
    this.ipfs.pin.update = ((send) => {
        return function (hash1, hash2, opts, callback) {
            if (typeof opts === 'function') {
                callback = opts;
                opts = null;
            }
            send({
                path: 'pin/update',
                args: [hash1, hash2],
                qs: opts
            }, (err, res) => {
                if (err) {
                    return callback(err)
                }
                callback(null, res.Pins.map((hash) => ({ hash: hash })))
            })
        };
    })(this.ipfs.send);
}


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

// This is a workaround for an issue with IPFS Cluster ver. 0.6.0. This issue
//  is expected to be resolved in the next release of IPFS Cluster though
function fixIpfsClusterAddResults(results) {
    return results.map((result) => {
        if (result.code === 0 && result.message === '') {
            // Extraneous properties added by IPFS Cluster. Fix result
            const fixedResult = {};

            if (result.Name) {
                fixedResult.path = result.Name;
            }

            // noinspection JSUnresolvedVariable
            if (result.Hash) {
                fixedResult.hash = result.Hash;
            }

            // noinspection JSUnresolvedVariable
            if (result.Size) {
                fixedResult.size = parseInt(result.Size);
            }

            return fixedResult;
        }

        return result;
    });
}


// Module code
//

// Lock function class
Object.freeze(IpfsClient);
