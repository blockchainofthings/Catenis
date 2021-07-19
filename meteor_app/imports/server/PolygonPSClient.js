/**
 * Created by claudio on 2021-06-12
 */

//console.log('[PolygonPSClient.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import config from 'config';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { EthereumClient } from './EthereumClient';

// Config entries
const ppsClientConfig = config.get('polygonPSClient');

// Configuration settings
const cfgSettings = {
    nodeHost: ppsClientConfig.get('nodeHost'),
    nodePath: ppsClientConfig.get('nodePath'),
    nodePort: ppsClientConfig.get('nodePort'),
    nodeProtocol: ppsClientConfig.get('nodeProtocol'),
    apiUsername: ppsClientConfig.get('apiUsername'),
    apiPassword: ppsClientConfig.get('apiPassword')
};


// Definition of classes
//

// PolygonPSClient (Polygon PoS Chain client) class
export class PolygonPSClient extends EthereumClient {
    /**
     * Class constructor
     * @param {string} host
     * @param {string} path
     * @param {number} port
     * @param {string} protocol
     * @param {string} username
     * @param {string} password
     */
    constructor(host, path, port, protocol, username, password) {
        super(host, path, port, protocol, username, password);
    }


    // Private object properties (getters/setters)
    //

    /**
     * Foreign blockchain key
     * Note: this property should be overridden on derived classes, and its value should match one of the keys defined
     *        in the ForeignBlockchain module
     * @return {string}
     * @private
     */
    get _blockchainKey() {
        return 'polygon';
    }


    // Class (public) methods
    //

    static initialize() {
        Catenis.logger.TRACE('PolygonPSClient initialization');
        // Instantiate PolygonPSClient object
        Catenis.ppsClient = new PolygonPSClient(
            cfgSettings.nodeHost,
            cfgSettings.nodePath,
            cfgSettings.nodePort,
            cfgSettings.nodeProtocol,
            cfgSettings.apiUsername,
            cfgSettings.apiPassword
        );
    }
}


// Module code
//

// Lock class
Object.freeze(PolygonPSClient);
