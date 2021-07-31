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
//import { Catenis } from './Catenis';
import { EthereumClient } from './EthereumClient';

// Config entries
const bscClientConfig = config.get('binanceSCClient');

// Configuration settings
const cfgSettings = {
    nodeHost: bscClientConfig.get('nodeHost'),
    nodePath: bscClientConfig.get('nodePath'),
    nodePort: bscClientConfig.get('nodePort'),
    nodeProtocol: bscClientConfig.get('nodeProtocol'),
    connectionOptions: {
        timeout: bscClientConfig.get('connectionOptions.timeout'),
        http: {
            keepAlive: bscClientConfig.get('connectionOptions.http.keepAlive')
        },
        webSocket: {
            heartbeatInterval: bscClientConfig.get('connectionOptions.webSocket.heartbeatInterval'),
            reconnect: {
                auto: bscClientConfig.get('connectionOptions.webSocket.reconnect.auto'),
                delay: bscClientConfig.get('connectionOptions.webSocket.reconnect.delay'),
                maxAttempts: bscClientConfig.get('connectionOptions.webSocket.reconnect.maxAttempts'),
                onTimeout: bscClientConfig.get('connectionOptions.webSocket.reconnect.onTimeout')
            }
        }
    },
    apiUsername: bscClientConfig.get('apiUsername'),
    apiPassword: bscClientConfig.get('apiPassword'),
    web3Settings: {
        txBlockTimeout: bscClientConfig.get('web3Settings.txBlockTimeout')
    }
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
     * Create a new instance of the BinanceSCClient class
     * @param {ForeignBlockchain} blockchain Foreign blockchain instance
     * @return {BinanceSCClient}
     */
    static instantiate(blockchain) {
        // Instantiate BinanceSCClient object
        return new BinanceSCClient(
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
Object.freeze(BinanceSCClient);
