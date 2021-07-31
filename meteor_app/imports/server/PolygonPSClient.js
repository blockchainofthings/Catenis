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
//import { Catenis } from './Catenis';
import { EthereumClient } from './EthereumClient';

// Config entries
const ppsClientConfig = config.get('polygonPSClient');

// Configuration settings
const cfgSettings = {
    nodeHost: ppsClientConfig.get('nodeHost'),
    nodePath: ppsClientConfig.get('nodePath'),
    nodePort: ppsClientConfig.get('nodePort'),
    nodeProtocol: ppsClientConfig.get('nodeProtocol'),
    connectionOptions: {
        timeout: ppsClientConfig.get('connectionOptions.timeout'),
        http: {
            keepAlive: ppsClientConfig.get('connectionOptions.http.keepAlive')
        },
        webSocket: {
            heartbeatInterval: ppsClientConfig.get('connectionOptions.webSocket.heartbeatInterval'),
            reconnect: {
                auto: ppsClientConfig.get('connectionOptions.webSocket.reconnect.auto'),
                delay: ppsClientConfig.get('connectionOptions.webSocket.reconnect.delay'),
                maxAttempts: ppsClientConfig.get('connectionOptions.webSocket.reconnect.maxAttempts'),
                onTimeout: ppsClientConfig.get('connectionOptions.webSocket.reconnect.onTimeout')
            }
        }
    },
    apiUsername: ppsClientConfig.get('apiUsername'),
    apiPassword: ppsClientConfig.get('apiPassword'),
    web3Settings: {
        txBlockTimeout: ppsClientConfig.get('web3Settings.txBlockTimeout')
    }
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
     * @param {ClientConnectionOptions} connectionOptions
     * @param {string} username
     * @param {string} password
     * @param {Object} web3Settings
     * @property {number} web3Settings.txBlockTimeout
     * @param {ForeignBlockchain} blockchain
     */
    constructor(
        host,
        path,
        port,
        protocol,
        connectionOptions,
        username,
        password,
        web3Settings,
        blockchain
    ) {
        super(host, path, port, protocol, connectionOptions, username, password, web3Settings, blockchain);
    }


    // Class (public) methods
    //

    /**
     * Create a new instance of the PolygonPSClient class
     * @param {ForeignBlockchain} blockchain Foreign blockchain instance
     * @return {PolygonPSClient}
     */
    static instantiate(blockchain) {
        // Instantiate PolygonPSClient object
        return new PolygonPSClient(
            cfgSettings.nodeHost,
            cfgSettings.nodePath,
            cfgSettings.nodePort,
            cfgSettings.nodeProtocol,
            cfgSettings.connectionOptions,
            cfgSettings.apiUsername,
            cfgSettings.apiPassword,
            cfgSettings.web3Settings,
            blockchain
        );
    }
}


// Module code
//

// Lock class
Object.freeze(PolygonPSClient);
