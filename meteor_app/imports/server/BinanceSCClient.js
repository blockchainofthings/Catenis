/**
 * Created by claudio on 2021-06-12
 */

//console.log('[BinanceSCClient.js]: This code just ran.');

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
const bscClientConfig = config.get('binanceSCClient');

// Configuration settings
const cfgSettings = {
    nodeHost: bscClientConfig.get('nodeHost'),
    nodePath: bscClientConfig.get('nodePath'),
    nodePort: bscClientConfig.get('nodePort'),
    nodeProtocol: bscClientConfig.get('nodeProtocol'),
    apiUsername: bscClientConfig.get('apiUsername'),
    apiPassword: bscClientConfig.get('apiPassword')
};


// Definition of classes
//

// BinanceSCClient (Binance Smart Chain client) class
export class BinanceSCClient extends EthereumClient {
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
        return 'binance';
    }


    // Class (public) methods
    //

    static initialize() {
        Catenis.logger.TRACE('BinanceSCClient initialization');
        // Instantiate BinanceSCClient object
        Catenis.bscClient = new BinanceSCClient(
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
Object.freeze(BinanceSCClient);
