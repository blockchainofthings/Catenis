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
    apiUsername: ethClientConfig.get('apiUsername'),
    apiPassword: ethClientConfig.get('apiPassword')
};


// Definition of classes
//

// EthereumClient class
export class EthereumClient {
    /**
     * Class constructor
     * @param {string} host
     * @param {string} path
     * @param {number} port
     * @param {string} protocol
     * @param {string} username
     * @param {string} password
     */
    constructor(
        host,
        path,
        port,
        protocol,
        username,
        password
    ) {
        this.apiUrl = assembleApiUrl(host, path, port, protocol, username, password);
        this.web3 = new Web3(this.apiUrl);
        // Note: this field must be initialized only after the class itself is initialized
        this._blockchain = undefined;
    }


    // Public object properties (getters/setters)
    //

    get wallet() {
        return this.web3.eth.accounts.wallet;
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
     * Returns a blockchain account for a given private key
     * @param {string} privateKey
     * @return {Account}
     */
    privateKeyToAccount(privateKey) {
        return this.web3.eth.accounts.privateKeyToAccount(privateKey);
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

        try {
            balance = Promise.await(
                this.web3.eth.getBalance(address, usePendingState ? 'pending' : 'latest')
            );
        }
        catch (err) {
            // Error getting balance
            Catenis.logger.ERROR(`Error trying to retrieve ${this._nativeCoin.description} balance.`, err);
            throw new Error(`Error trying to retrieve ${this._nativeCoin.description} balance: ${err}`);
        }

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

        try {
            count = Promise.await(
                this.web3.eth.getTransactionCount(address, usePendingState ? 'pending' : 'latest')
            );
        }
        catch (err) {
            // Error getting transaction count
            Catenis.logger.ERROR(`Error trying to retrieve transaction count for ${address}.`, err);
            throw new Error(`Error trying to retrieve transaction count for ${address}: ${err}`);
        }

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

        try {
            tx = Promise.await(
                this.web3.eth.getTransaction(txHash)
            );
        }
        catch (err) {
            // Error retrieving transaction
            Catenis.logger.ERROR(`Error trying to retrieve transaction (txHash: ${txHash}).`, err);
            throw new Error(`Error trying to retrieve transaction (txHash: ${txHash}): ${err}`);
        }

        return tx;
    }

    /**
     * Retrieve multiple transactions
     * @param {[string]} txHashes A list of transaction hashes
     * @return {[Object]} List with the retrieved transaction objects or null if the given
     *                     transaction was not found
     */
    getTransactions(txHashes) {
        const promises = [];

        for (const txHash of txHashes) {
            promises.push(
                this.web3.eth.getTransaction(txHash)
            );
        }

        const txs = [];
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
            // At least one of the calls returned an error. Throw an error passing the
            //  returned transactions indicating those that are actually an error
            const error = new Error('Error trying to retrieve transaction');
            error.txs = txs;
            error.errIndices = errIndices;

            throw error;
        }

        return txs;
    }

    /**
     * Retrieve the receipts of multiple transactions
     * @param {[string]} txHashes A list of transaction hashes
     * @return {[Object]} List with the retrieved tx receipts
     */
    getTransactionReceipts(txHashes) {
        const promises = [];

        for (const txHash of txHashes) {
            promises.push(
                this.web3.eth.getTransactionReceipt(txHash)
            );
        }

        const receipts = [];
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
            // At least one of the calls returned an error. Throw an error passing the
            //  returned tx receipts indicating those that are actually an error
            const error = new Error('Error trying to retrieve transaction receipts');
            error.receipts = receipts;
            error.errIndices = errIndices;

            throw error;
        }

        return receipts;
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
