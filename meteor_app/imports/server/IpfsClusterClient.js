/**
 * Created by claudio on 2019-04-27.
 */

//console.log('[IpfsClusterClient.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import config from 'config';
import got from 'got';
// Meteor packages
import { Meteor } from 'meteor/meteor';
import { Promise } from 'meteor/promise';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import util from "util";

// Config entries
const ipfsClusterClientConfig = config.get('ipfsClusterClient');

// Configuration settings
const cfgSettings = {
    apiUrl: ipfsClusterClientConfig.get('apiUrl'),
    localAddress: ipfsClusterClientConfig.get('localAddress'),
    timeout: ipfsClusterClientConfig.get('timeout')
};


// Definition of function classes
//

// IpfsClusterClient function class
export function IpfsClusterClient(apiUrl, localAddress, timeout) {
    this.apiUrl = apiUrl;
    this.httpOptions = {
        retry: 0
    };

    if (localAddress) {
        this.httpOptions.localAddress = localAddress;
    }

    if (timeout) {
        this.httpOptions.timeout = {
            socket: timeout,
            response: timeout
        };
    }
}


// Public IpfsClusterClient object methods
//

IpfsClusterClient.prototype.getPeers = function () {
    const methodPath = 'peers';

    try {
        return Promise.await(
            got(this.apiUrl + methodPath, this.httpOptions)
            .json()
        );
    }
    catch (err) {
        handleError('getPeers', err);
    }
};


// Module functions used to simulate private IpfsClusterClient object methods
//  NOTE: these functions need to be bound to a IpfsClusterClient object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// IpfsClusterClient function class (public) methods
//

IpfsClusterClient.initialize = function () {
    Catenis.logger.TRACE('IpfsClusterClient initialization');
    // Instantiate IpfsClusterClient object
    Catenis.ipfsClusterClient = new IpfsClusterClient(cfgSettings.apiUrl, cfgSettings.localAddress, cfgSettings.timeout);
};


// IpfsClusterClient function class (public) properties
//

//IpfsClusterClient.prop = {};


// Definition of module (private) functions
//


function handleError(methodName, err) {
    let errMsg = util.format('Error calling IPFS Cluster REST API \'%s\' method.', methodName);

    // Log error and rethrow it
    Catenis.logger.DEBUG(errMsg, err);

    throw new Meteor.Error('ctn_ipfs_cluster_api_error', errMsg, err);
}


// Module code
//

// Lock function class
Object.freeze(IpfsClusterClient);
