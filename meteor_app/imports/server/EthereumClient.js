/**
 * Created by claudio on 2021-06-07
 */

//console.log('[EthereumClient.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import config from 'config';
import Web3 from 'web3';
import BigNumber from 'bignumber.js';
// Meteor packages
import { Promise } from 'meteor/promise';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';

// Config entries
const ethClientConfig = config.get('ethereumClient');

// Configuration settings
const cfgSettings = {
    nodeHost: ethClientConfig.get('nodeHost'),
    nodePath: ethClientConfig.get('nodePath'),
    nodePort: ethClientConfig.get('nodePort'),
    nodeProtocol: ethClientConfig.get('nodeProtocol'),
    connectionOptions: {
        timeout: ethClientConfig.get('connectionOptions.timeout'),
        http: {
            keepAlive: ethClientConfig.get('connectionOptions.http.keepAlive')
        },
        webSocket: {
            heartbeatInterval: ethClientConfig.get('connectionOptions.webSocket.heartbeatInterval'),
            reconnect: {
                auto: ethClientConfig.get('connectionOptions.webSocket.reconnect.auto'),
                delay: ethClientConfig.get('connectionOptions.webSocket.reconnect.delay'),
                maxAttempts: ethClientConfig.get('connectionOptions.webSocket.reconnect.maxAttempts'),
                onTimeout: ethClientConfig.get('connectionOptions.webSocket.reconnect.onTimeout')
            }
        }
    },
    apiUsername: ethClientConfig.get('apiUsername'),
    apiPassword: ethClientConfig.get('apiPassword')
};


// Definition of classes
//

// EthereumClient class
export class EthereumClient {
    /**
     * @typedef {Object} ClientConnectionOptions
     * @property {number} timeout
     * @property {Object} http
     * @property {boolean} http.keepAlive
     * @property {Object} webSocket
     * @property {(number|null)} webSocket.heartbeatInterval
     * @property {Object} webSocket.reconnect
     * @property {boolean} webSocket.reconnect.auto
     * @property {number} webSocket.reconnect.delay
     * @property {(number|null)} webSocket.reconnect.maxAttempts
     * @property {boolean} webSocket.reconnect.onTimeout
     */

    /**
     * Class constructor
     * @param {string} host
     * @param {string} path
     * @param {number} port
     * @param {string} protocol
     * @param {ClientConnectionOptions} connectionOptions
     * @param {string} username
     * @param {string} password
     */
    constructor(
        host,
        path,
        port,
        protocol,
        connectionOptions,
        username,
        password
    ) {
        this.apiUrl = assembleApiUrl(host, path, port, protocol, username, password);

        if (protocol.startsWith('http')) {
            // Use HTTP provider
            this.web3 = new Web3(new Web3.providers.HttpProvider(this.apiUrl, {
                timeout: connectionOptions.timeout,
                keepAlive: connectionOptions.http.keepAlive
            }));
        }
        else if (protocol.startsWith('ws')) {
            // Use WebSocket provider
            const wsOptions = {
                timeout: connectionOptions.timeout,
                reconnect: {
                    auto: connectionOptions.webSocket.reconnect.auto
                }
            };

            if (wsOptions.reconnect.auto) {
                wsOptions.reconnect.delay = connectionOptions.webSocket.reconnect.delay;
                wsOptions.reconnect.maxAttempts = connectionOptions.webSocket.reconnect.maxAttempts
                    ? connectionOptions.webSocket.reconnect.maxAttempts
                    : false;
                wsOptions.reconnect.onTimeout = connectionOptions.webSocket.reconnect.onTimeout;
            }

            if (connectionOptions.webSocket.heartbeatInterval) {
                wsOptions.clientConfig = {
                    keepalive: true,
                    keepaliveInterval: connectionOptions.webSocket.heartbeatInterval
                };
            }

            this.web3 = new Web3(new Web3.providers.WebsocketProvider(this.apiUrl, wsOptions));
        }
        else {
            // Unknown provider. Let the library handle it
            this.web3 = new Web3(this.apiUrl);
        }

        // Note: this field must be initialized only after the class itself is initialized
        this._blockchain = undefined;
    }


    // Public object properties (getters/setters)
    //

    get wallet() {
        return this.web3.eth.accounts.wallet;
    }

    get isWebSocket() {
        return this.web3.currentProvider instanceof Web3.providers.WebsocketProvider;
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
        return 'ethereum';
    }

    /**
     * @return {NativeCoin}
     * @private
     */
    get _nativeCoin() {
        if (!this._blockchain) {
            this._blockchain = Catenis.foreignBlockchains.get(this._blockchainKey);
        }

        return this._blockchain.nativeCoin;
    }


    // Public object methods
    //

    /**
     * Check if error was due to a not open WebSocket connection, and try to reopen the connection
     * @param {*} err An error returned from a web3 method
     * @return {boolean} Indicates whether a new call to the failing method should be retried (since the WebSocket
     *                    connection was successfully opened)
     */
    checkRetryWSDisconnectError(err) {
        let retry = false;

        if (this.isWebSocket && (err instanceof Error) && err.message === 'connection not open on send()') {
            // Error due to WebSocket connection not open
            const ws = this.web3.currentProvider;

            // Make sure that WebSocket connection is not open
            if (!ws.connected) {
                // Try to open WebSocket connection
                retry = Promise.await(
                    (async function() {
                        let promiseResolve;

                        const promise = new Promise(resolve => {
                            promiseResolve = resolve;
                        });

                        const timeout = setTimeout(() => {
                            // Timeout trying to open WebSocket connect.
                            //  Remove event listener and return failure (retry=false)
                            ws.removeListener(ws.CONNECT, onConnect);
                            promiseResolve(false);
                        }, cfgSettings.connectionOptions.timeout);

                        function onConnect() {
                            // WebSocket connection successfully open.
                            //  Clear timeout and return success (retry=true)
                            clearTimeout(timeout);
                            promiseResolve(true);
                        }

                        // Setup listener to receive event indication that connection was open
                        ws.once(ws.CONNECT, onConnect);

                        if (!ws.connection || ws.connection.readyState !== ws.connection.CONNECTING) {
                            if (ws.connection) {
                                // A connection already exists.
                                //  Remove event listeners before opening a new connection
                                ws._removeSocketListeners();
                            }

                            // Open WebSocket connection
                            ws.connect();
                        }

                        // Wait for async methods (connect()/setTimeout()) to finish
                        return promise.await();
                    })()
                );
            }
            else {
                // WebSocket connection already open. Jut retry
                retry = true;
            }
        }

        return retry;
    }

    /**
     * Returns a blockchain account for a given private key
     * @param {string} privateKey
     * @return {Account}
     */
    privateKeyToAccount(privateKey) {
        return this.web3.eth.accounts.privateKeyToAccount(privateKey);
    }

    /**
     * Checks if a given address is a valid foreign blockchain account address
     * @param {string} address Account address to be validated
     * @return {boolean}
     */
    isValidAccountAddress(address) {
        return this.web3.utils.isAddress(address);
    }

    /**
     * Get current ETH balance for a given account
     * @param {string} address Account address for getting balance
     * @param {boolean} [usePendingState] Indicates whether balance should take into consideration not yet confirmed
     *                                     transactions
     * @return {BigNumber} Balance
     */
    getBalance(address, usePendingState = false) {
        let balance;
        let tryAgain;
        let wsDisconnectRetried = false;

        do {
            tryAgain = false;

            try {
                balance = Promise.await(
                    this.web3.eth.getBalance(address, usePendingState ? 'pending' : 'latest')
                );
            }
            catch (err) {
                if (!wsDisconnectRetried && this.checkRetryWSDisconnectError(err)) {
                    // WebSocket connection has been reopened. Try calling remote method again
                    wsDisconnectRetried = tryAgain = true;
                }
                else {
                    // Error getting balance
                    Catenis.logger.ERROR(`Error trying to retrieve ${this._nativeCoin.description} balance.`, err);
                    throw new Error(`Error trying to retrieve ${this._nativeCoin.description} balance: ${err}`);
                }
            }
        }
        while (tryAgain);

        return new BigNumber(balance);
    }

    /**
     * Get current transaction count for a given account
     * @param {string} address Account address for getting transaction count
     * @param {boolean} [usePendingState] Indicates whether transaction count should take into consideration not yet
     *                                     confirmed transactions
     * @return {number} Count
     */
    getTransactionCount(address, usePendingState = false) {
        let count;
        let tryAgain;
        let wsDisconnectRetried = false;

        do {
            tryAgain = false;

            try {
                count = Promise.await(
                    this.web3.eth.getTransactionCount(address, usePendingState ? 'pending' : 'latest')
                );
            }
            catch (err) {
                if (!wsDisconnectRetried && this.checkRetryWSDisconnectError(err)) {
                    // WebSocket connection has been reopened. Try calling remote method again
                    wsDisconnectRetried = tryAgain = true;
                }
                else {
                    // Error getting transaction count
                    Catenis.logger.ERROR(`Error trying to retrieve transaction count for ${address}.`, err);
                    throw new Error(`Error trying to retrieve transaction count for ${address}: ${err}`);
                }
            }
        }
        while (tryAgain);

        return count;
    }

    /**
     * Create a new instance of the contract object, used for manipulating a given smart contract
     * @param {any[]} abi Compiled smart contract ABI
     * @param {string} [address] Deployed smart contract address. Should only be supplied for contracts that have
     *                            already been deployed
     * @return {Object}
     */
    newContract(abi, address) {
        return new this.web3.eth.Contract(abi, address);
    }

    /**
     * Retrieve a single transaction
     * @param {string} txHash The transaction hash
     * @return {Object} The retrieved transaction object, or null if no transaction
     *                   with the given hash was found
     */
    getTransaction(txHash) {
        let tx;
        let tryAgain;
        let wsDisconnectRetried = false;

        do {
            tryAgain = false;

            try {
                tx = Promise.await(
                    this.web3.eth.getTransaction(txHash)
                );
            }
            catch (err) {
                if (!wsDisconnectRetried && this.checkRetryWSDisconnectError(err)) {
                    // WebSocket connection has been reopened. Try calling remote method again
                    wsDisconnectRetried = tryAgain = true;
                }
                else {
                    // Error retrieving transaction
                    Catenis.logger.ERROR(`Error trying to retrieve transaction (txHash: ${txHash}).`, err);
                    throw new Error(`Error trying to retrieve transaction (txHash: ${txHash}): ${err}`);
                }
            }
        }
        while (tryAgain);

        return tx;
    }

    /**
     * Retrieve multiple transactions
     * @param {[string]} txHashes A list of transaction hashes
     * @return {[Object]} List with the retrieved transaction objects or null if the given
     *                     transaction was not found
     */
    getTransactions(txHashes) {
        let txs;
        let tryAgain;
        let wsDisconnectRetried = false;

        do {
            tryAgain = false;

            const promises = [];

            for (const txHash of txHashes) {
                promises.push(
                    this.web3.eth.getTransaction(txHash)
                );
            }

            txs = [];
            const errIndices = [];

            Promise.await(
                Promise.allSettled(promises)
            )
            .forEach((result, idx) => {
                if (result.status === 'fulfilled') {
                    txs[idx] = result.value;
                }
                else { // status === 'rejected'
                    txs[idx] = result.reason;
                    errIndices.push(idx);
                }
            })

            if (errIndices.length > 0) {
                // Check first error
                if (!wsDisconnectRetried && this.checkRetryWSDisconnectError(txs[errIndices[0]])) {
                    // WebSocket connection has been reopened. Try calling remote method again
                    wsDisconnectRetried = tryAgain = true;
                }

                if (!tryAgain) {
                    // At least one of the calls returned an error. Throw an error passing the
                    //  returned transactions indicating those that are actually an error
                    const error = new Error('Error trying to retrieve transaction');
                    error.txs = txs;
                    error.errIndices = errIndices;

                    throw error;
                }
            }
        }
        while (tryAgain);

        return txs;
    }

    /**
     * Retrieve the receipts of multiple transactions
     * @param {[string]} txHashes A list of transaction hashes
     * @return {[Object]} List with the retrieved tx receipts
     */
    getTransactionReceipts(txHashes) {
        let receipts;
        let tryAgain;
        let wsDisconnectRetried = false;

        do {
            tryAgain = false;

            const promises = [];

            for (const txHash of txHashes) {
                promises.push(
                    this.web3.eth.getTransactionReceipt(txHash)
                );
            }

            receipts = [];
            const errIndices = [];

            Promise.await(
                Promise.allSettled(promises)
            )
            .forEach((result, idx) => {
                if (result.status === 'fulfilled') {
                    receipts[idx] = result.value;
                }
                else { // status === 'rejected'
                    receipts[idx] = result.reason;
                    errIndices.push(idx);
                }
            })

            if (errIndices.length > 0) {
                // Check first error
                if (!wsDisconnectRetried && this.checkRetryWSDisconnectError(receipts[errIndices[0]])) {
                    // WebSocket connection has been reopened. Try calling remote method again
                    wsDisconnectRetried = tryAgain = true;
                }

                if (!tryAgain) {
                    // At least one of the calls returned an error. Throw an error passing the
                    //  returned tx receipts indicating those that are actually an error
                    const error = new Error('Error trying to retrieve transaction receipts');
                    error.receipts = receipts;
                    error.errIndices = errIndices;

                    throw error;
                }
            }
        }
        while (tryAgain);

        return receipts;
    }

    /**
     * Subscribe to receive events of a given type
     * @param {string} type The subscription type
     * @param {*} [options] Options to be used with the subscription
     * @return {Object} The resulting subscription instance
     */
    subscribe(type, options) {
        let subscription;
        let tryAgain;
        let wsDisconnectRetried = false;

        do {
            tryAgain = false;

            try {
                subscription = Promise.await(
                    (async () => {
                        let promiseResolve;
                        let promiseReject;

                        const promise = new Promise((resolve, reject) => {
                            promiseResolve = resolve;
                            promiseReject = reject;
                        });

                        function onConnected() {
                            _subscription.removeListener('error', onError);
                            promiseResolve(_subscription);
                        }

                        function onError(err) {
                            _subscription.removeListener('connected', onConnected);
                            err.subscription = _subscription;
                            promiseReject(err);
                        }

                        const params = [type];

                        if (options) {
                            params.push(options);
                        }

                        const _subscription = this.web3.eth.subscribe(...params)
                        .once('connected', onConnected)
                        .once('error', onError);

                        // Wait for async methods (connect()/setTimeout()) to finish
                        return promise.await();
                    })()
                );
            }
            catch (err) {
                if (err.subscription) {
                    if (!wsDisconnectRetried && this.checkRetryWSDisconnectError(err)) {
                        // WebSocket connection has been reopened. Try calling remote method again
                        wsDisconnectRetried = tryAgain = true;
                    }
                    else {
                        // Emit returned error
                        subscription = err.subscription;
                        delete err.subscription;
                        setImmediate(() => subscription.emit('error', err));
                    }
                }
                else {
                    // Non subscription error. Just rethrow it
                    throw err;
                }
            }
        }
        while (tryAgain);

        return subscription;
    }


    // Class (public) methods
    //

    static initialize() {
        Catenis.logger.TRACE('EthereumClient initialization');
        // Instantiate EthereumClient object
        Catenis.ethClient = new EthereumClient(
            cfgSettings.nodeHost,
            cfgSettings.nodePath,
            cfgSettings.nodePort,
            cfgSettings.nodeProtocol,
            cfgSettings.connectionOptions,
            cfgSettings.apiUsername,
            cfgSettings.apiPassword
        );
    }
}


// Definition of module (private) functions
//

function assembleApiUrl(host, path, port, protocol, username, password) {
    let endpoint = host;

    if (port) {
        endpoint += `:${port}`;
    }

    if (path) {
        if (!path.startsWith('/')) {
            endpoint += '/';
        }

        endpoint += path;
    }

    if (username) {
        let credentials = `${Catenis.decipherData(username)}`;

        if (password) {
            credentials += `:${Catenis.decipherData(password)}`
        }

        endpoint = `${credentials}@${endpoint}`;
    }

    return `${protocol}://${endpoint}`;
}


// Module code
//

// Lock class
Object.freeze(EthereumClient);
