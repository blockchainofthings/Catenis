/**
 * Created by Claudio on 2017-10-23.
 */

//console.log('[Module_name.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import util from 'util';
// Third-party node modules
import config from 'config';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';

// Config entries
const ipfsSrvMonitorConfig = config.get('ipfsServerMonitor');
const ipfsSrvMonIpfsClusterConfig = ipfsSrvMonitorConfig.get('ipfsCluster');

// Configuration settings
const cfgSettings = {
    enabled: ipfsSrvMonitorConfig.get('enabled'),
    ipfsCluster: {
        inUse: ipfsSrvMonIpfsClusterConfig.get('inUse'),
        numberOfPeers: ipfsSrvMonIpfsClusterConfig.get('numberOfPeers')
    },
    checkInterval: ipfsSrvMonitorConfig.get('checkInterval')
};


// Definition of function classes
//

// IpfsServerMonitor function class
//
//  Arguments:
//   checkInternal [Number] - Time, in seconds, defining the period within which IPFS server shall be checked to make sure it is still alive
export function IpfsServerMonitor(checkInterval) {
    this.checkInterval = checkInterval;
    this.monitoringOn = false;
    this.checkIntervalHandle = undefined;

    Object.defineProperty(this, 'monitoringOn', {
        get: function () {
            return this.checkIntervalHandle !== undefined;
        },
        enumerable: true
    });
}


// Public IpfsServerMonitor object methods
//

IpfsServerMonitor.prototype.start = function () {
    if (!this.monitoringOn) {
        checkServer();
        this.checkIntervalHandle = Meteor.setInterval(checkServer, this.checkInterval * 1000);
    }
};

IpfsServerMonitor.prototype.stop = function () {
    if (this.monitoringOn) {
        Meteor.clearInterval(this.checkIntervalHandle);
        this.checkIntervalHandle = undefined;
    }
};


// Module functions used to simulate private IpfsServerMonitor object methods
//  NOTE: these functions need to be bound to a IpfsServerMonitor object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// IpfsServerMonitor function class (public) methods
//

IpfsServerMonitor.initialize = function () {
    Catenis.logger.TRACE('IpfsServerMonitor initialization');
    // Instantiate IpfsServerMonitor object
    Catenis.ipfsServerMonitor = new IpfsServerMonitor(cfgSettings.checkInterval);

    if (cfgSettings.enabled) {
        Catenis.ipfsServerMonitor.start();
    }
};


// IpfsServerMonitor function class (public) properties
//

/*IpfsServerMonitor.prop = {};*/


// Definition of module (private) functions
//

function checkServer() {
    if (cfgSettings.ipfsCluster.inUse) {
        checkIpfsCluster();
    }
    else {
        checkIpfsNode();
    }
}

function checkIpfsNode() {
    Catenis.logger.TRACE('Checking if IPFS node is alive');
    try {
        // Try to retrieve info about IPFS node
        Catenis.ipfsClient.id();
    }
    catch (err) {
        // Log error
        Catenis.logger.ERROR('Failure while checking if IPFS node is alive.', err);
    }
}

function checkIpfsCluster() {
    Catenis.logger.TRACE('Checking if IPFS Cluster is healthy');
    try {
        // Retrieve information about cluster peers
        const peers = Catenis.ipfsClusterClient.getPeers();

        // Make sure that number of returned cluster peers is consistent
        if (peers.length !== cfgSettings.ipfsCluster.numberOfPeers) {
            Catenis.logger.ERROR('Inconsistent number of IPFS Cluster peers', util.format('\nExpected number of peers: %d; returned: %d', cfgSettings.ipfsCluster.numberOfPeers, peers.length), peers);
        }

        peers.forEach((peer, idx) => {
            if (peer.error) {
                Catenis.logger.ERROR('Error in IPFS Cluster peer #%d', idx + 1, util.format('\nCluster peer error: %s', peer.error), peers);
            }

            if (peer.ipfs && peer.ipfs.error) {
                Catenis.logger.ERROR('Error in IPFS node of IPFS Cluster peer #%d', idx + 1, util.format('\nIPFS error: %s', peer.ipfs.error), peers);
            }
        });
    }
    catch (err) {
        // Log error
        Catenis.logger.ERROR('Failure while checking if IPFS Cluster is healthy.', err);
    }
}


// Module code
//

// Lock function class
Object.freeze(IpfsServerMonitor);
