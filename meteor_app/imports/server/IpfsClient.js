/**
 * Created by claudio on 23/10/17.
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
import ipfsApi from 'ipfs-api';
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
    this.ipfs = ipfsApi({
        host: host,
        port: port,
        protocol: protocol
    });

    this.api = {
        filesAdd: Meteor.wrapAsync(this.ipfs.files.add, this.ipfs.files),
        filesCat: Meteor.wrapAsync(this.ipfs.files.cat, this.ipfs.files),
        id: Meteor.wrapAsync(this.ipfs.id, this.ipfs)
    };
}


// Public IpfsClient object methods
//

IpfsClient.prototype.filesAdd = function (data, options) {
    try {
        return this.api.filesAdd(data, options);
    }
    catch (err) {
        handleError('files.add', err);
    }
};

IpfsClient.prototype.filesCat = function (ipfsPath) {
    try {
        return this.api.filesCat(ipfsPath);
    }
    catch (err) {
        handleError('files.cat', err);
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

function handleError(methodName, err) {
    let errMsg = util.format('Error calling IPFS API \'%s\' method.', methodName);

    // Log error and rethrow it
    Catenis.logger.DEBUG(errMsg, err);
    throw new Meteor.Error('ctn_ipfs_api_error', errMsg, err);
}


// Module code
//

// Lock function class
Object.freeze(IpfsClient);
