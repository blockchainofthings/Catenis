/**
 * Created by claudio on 2021-06-04
 */

//console.log('[ForeignSmartContract.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import config from 'config';
import BigNumber from 'bignumber.js';
// Meteor packages
import { Promise } from 'meteor/promise';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { ForeignBlockchain } from './ForeignBlockchain';

// Config entries
const foreignSCConfig = config.get('foreignSmartContract');

// Configuration settings
const cfgSettings = {
    updateNonceMaxRetries: foreignSCConfig.get('updateNonceMaxRetries')
};

const defaultConsumptionProfile = ForeignBlockchain.consumptionProfile.average;


// Definition of classes
//

// ForeignSmartContract class
export class ForeignSmartContract {
    /**
     * @external AddAccount
     * @typedef {AddAccount} ForeignBcAccount
     */

    /**
     * Class constructor
     * @param {string} blockchainKey Foreign blockchain key. It should match one of the keys defined in the
     *                                ForeignBlockchain module
     * @param {ForeignBcAccount} ownerAccount Foreign blockchain account that will function as the contract owner
     * @param {string} compiledOutput JSON representing the output of the compilation of the contract
     * @param {Object} [options]
     * @param {string} [options.contractAddress] Deployed smart contract address. Should only be supplied for contracts
     *                                            that have already been deployed
     * @param {NativeCoinConsumptionProfile} [options.consumptionProfile] Foreign blockchain native coin consumption
     *                                            profile to be used by default for issuing foreign blockchain
     *                                            transactions
     */
    constructor(blockchainKey, ownerAccount, compiledOutput, options) {
        this.options = options || {};
        
        if (!this.options.consumptionProfile || !ForeignBlockchain.isValidConsumptionProfile(this.options.consumptionProfile)) {
            this.options.consumptionProfile = defaultConsumptionProfile;
        }
        
        this._blockchain = Catenis.foreignBlockchains.get(blockchainKey);

        // Add owner account to wallet
        this.ownerAccount = this._blockchain.client.wallet.add(ownerAccount);

        this.compiledOutput = JSON.parse(compiledOutput);

        /**
         * @typedef {Object} MethodCallTx
         * @property {*[]} arguments
         * @property {function} call
         * @property {function} send
         * @property {function} estimateGas
         * @property {function} encodeABI
         */
        /**
         * @typedef {Object} ContractMethodCall
         * @property {MethodCallTx} tx
         * @property {number} [gasEstimate]
         */
        /**
         * Cached data for calling a contract method with a given set of arguments.
         *  It is indexed by the <method_name>+<arguments>
         * @type {Map<string, ContractMethodCall>}
         * @private
         */
        this._methodCalls = new Map();

        // Instantiate contract object
        this.contract = this._blockchain.client.newContract(this.compiledOutput.abi, this.options.contractAddress);
    }


    // Public object properties (getters/setters)
    //

    get abi() {
        return this.compiledOutput.abi;
    }

    get bytecode() {
        return this.compiledOutput.bytecode;
    }

    /**
     * Indicates whether smart contract has already been deployed
     * @return {boolean}
     */
    get isDeployed() {
        return !!this.contract.options.address;
    }

    /**
     * The smart contract address
     * @return {(string|undefined)}
     */
    get address() {
        return this.contract.options.address;
    }

    /**
     * Current native coin balance for the contract owner account
     * @return {BigNumber} Balance
     */
    get ownerNativeCoinBalance() {
        return this._blockchain.client.getBalance(this.ownerAccount.address);
    }

    // Public object methods
    //

    /**
     * Estimate required foreign blockchain native coin amount to deploy smart contract
     * @param contractArgs Arguments for deploying a new instance of the contract.
     *                      Note: the foreign blockchain native coin consumption profile to used for calculating the
     *                             estimate can be passed as the last argument
     * @return {BigNumber} Required foreign blockchain native coin amount, in its smallest denomination (wei, 10 e-18)
     */
    deployEstimate(...contractArgs) {
        if (this.isDeployed) {
            throw new Error('Smart contract is already deployed');
        }

        // Determine consumption profile to be used
        const consumptionProfile =
            contractArgs.length > 0 && ForeignBlockchain.isValidConsumptionProfile(contractArgs[contractArgs.length - 1])
            ? contractArgs.pop()
            : this.options.consumptionProfile;

        const deployCall = this.hasMethodCall('deploy', ...contractArgs)
            ? this.getMethodCall('deploy', ...contractArgs)
            : this.setMethodCall('deploy', ...contractArgs, this.contract.deploy({
                data: this.bytecode,
                arguments: contractArgs
            }));

        let tryAgain;
        let wsDisconnectRetried = false;

        do {
            tryAgain = false;

            try {
                deployCall.gasEstimate = Promise.await(
                    deployCall.tx.estimateGas({
                        from: this.ownerAccount.address
                    })
                );
            }
            catch (err) {
                if (!wsDisconnectRetried && this._blockchain.client.checkRetryWSDisconnectError(err)) {
                    // WebSocket connection has been reopened. Try calling remote method again
                    wsDisconnectRetried = tryAgain = true;
                }
                else {
                    // Just rethrow error
                    throw err;
                }
            }
        }
        while (tryAgain);

        return this._blockchain.gasPrices.getPriceEstimate(consumptionProfile.confidenceLevel).times(deployCall.gasEstimate);
    }

    /**
     * Deploy smart contract
     * @param contractArgs Arguments for deploying a new instance of the contract.
     *                      Note: the foreign blockchain native coin consumption profile to used for contract deployment
     *                             can be passed as the last as the last argument
     * @return {SentTxInfo} Object containing the resulting transaction hash and a web3.js promise/event emitter
     *                       that resolves to the new contract instance
     */
    deploy(...contractArgs) {
        if (this.isDeployed) {
            throw new Error('Smart contract is already deployed');
        }

        // Determine consumption profile to be used
        const consumptionProfile =
            contractArgs.length > 0 && ForeignBlockchain.isValidConsumptionProfile(contractArgs[contractArgs.length - 1])
                ? contractArgs.pop()
                : this.options.consumptionProfile;

        const deployCall = this.hasMethodCall('deploy', ...contractArgs)
            ? this.getMethodCall('deploy', ...contractArgs)
            : this.setMethodCall('deploy', ...contractArgs, this.contract.deploy({
                data: this.bytecode,
                arguments: contractArgs
            }));

        if (!deployCall.gasEstimate) {
            let tryAgain;
            let wsDisconnectRetried = false;

            do {
                tryAgain = false;

                try {
                    deployCall.gasEstimate = Promise.await(
                        deployCall.tx.estimateGas({
                            from: this.ownerAccount.address
                        })
                    );
                }
                catch (err) {
                    if (!wsDisconnectRetried && this._blockchain.client.checkRetryWSDisconnectError(err)) {
                        // WebSocket connection has been reopened. Try calling remote method again
                        wsDisconnectRetried = tryAgain = true;
                    }
                    else {
                        // Just rethrow error
                        throw err;
                    }
                }
            }
            while (tryAgain);
        }

        const gas = deployCall.gasEstimate;
        const gasPrice = this._blockchain.gasPrices.getPriceEstimate(consumptionProfile.confidenceLevel);
        const txExecPrice = gasPrice.times(gas);

        // Make sure that owner's native coin balance can cover the transaction execution price
        //  before trying to send the transaction
        if (this.ownerNativeCoinBalance.lt(txExecPrice)) {
            const err = new Error('Operation not allowed: insufficient funds for gas * price + value');
            err.txExecPrice = this.toNativeCoin(txExecPrice);

            throw err;
        }

        let nonce;
        let numRetries = 0;
        let tryAgain;
        let wsDisconnectRetried = false;

        do {
            tryAgain = false;

            try {
                return Promise.await(
                    processSendResult(
                        deployCall.tx.send({
                            from: this.ownerAccount.address,
                            gas,
                            gasPrice,
                            nonce
                        })
                    )
                );
            }
            catch (err) {
                if ((err instanceof Error) && (err.message === 'Returned error: insufficient funds for gas * price + value'
                        || err.message.startsWith('Returned error: sender doesn\'t have enough funds to send tx'))) {
                    // Low native coin balance. Add tx execution price to error object
                    err.txExecPrice = this.toNativeCoin(txExecPrice);
                }
                else if ((err instanceof Error) && (err.message === 'Returned error: replacement transaction underpriced'
                        || err.message === 'Returned error: already known')) {
                    // Transaction nonce already used
                    if (numRetries < cfgSettings.updateNonceMaxRetries) {
                        // Get updated nonce (considering pending transactions) and try again
                        try {
                            nonce = this._blockchain.client.getTransactionCount(this.ownerAccount.address, true);
                            numRetries++;
                            tryAgain = true;
                        }
                        catch (err) {
                            Catenis.logger.ERROR('Unable to get updated nonce for resending foreign blockchain transaction');
                        }
                    }

                    if (!tryAgain) {
                        // Not trying again. Throw error
                        throw new Error('Failed to send foreign blockchain transaction: nonce already used');
                    }
                }
                else if (!wsDisconnectRetried && this._blockchain.client.checkRetryWSDisconnectError(err)) {
                    // WebSocket connection has been reopened. Try calling remote method again
                    wsDisconnectRetried = tryAgain = true;
                }

                if (!tryAgain) {
                    // Just rethrow error
                    throw err;
                }
            }
        }
        while (tryAgain);
    }

    /**
     * Set the smart contract address from (deploy contract) transaction receipt
     * @param {Object} txReceipt The transaction receipt
     */
    setContractAddressFromTxReceipt(txReceipt) {
        if (this.isDeployed) {
            throw new Error('Smart contract is already deployed');
        }

        this.contract.options.address = txReceipt.contractAddress;
    }

    /**
     * Retrieve a single transaction
     * @param {string} txHash The transaction hash
     * @return {Object} The retrieved transaction object, or null if no transaction
     *                   with the given hash was found
     */
    getTransaction(txHash) {
        return this._blockchain.client.getTransaction(txHash);
    }

    /**
     * Retrieve multiple transactions
     * @param {[string]} txHashes A list of transaction hashes
     * @return {[Object]} List with the retrieved transaction objects or null if the given
     *                     transaction was not found
     */
    getTransactions(txHashes) {
        return this._blockchain.client.getTransactions(txHashes);
    }

    /**
     * Retrieve the receipts of multiple transactions
     * @param {[string]} txHashes A list of transaction hashes
     * @return {[Object]} List with the retrieved tx receipts
     */
    getTransactionReceipts(txHashes) {
        return this._blockchain.client.getTransactionReceipts(txHashes);
    }

    /**
     * Caches a contract method call data
     * @param {string} methodName The name of the contract method
     * @param {*} args The arguments for calling the method. It is expected that the last item
     *                  be the contract method call transaction to be cached
     * @return {ContractMethodCall} The cached contract method call data
     */
    setMethodCall(methodName, ...args) {
        let methodCallTx;

        if (args.length > 0) {
            methodCallTx = args.pop();
        }

        const methodCall = {
            tx: methodCallTx
        };

        this._methodCalls.set(`${methodName}_${JSON.stringify(args)}`, methodCall);

        return methodCall;
    }

    /**
     * Retrieves a previously cached contract method call data
     * @param {string} methodName The name of the contract method
     * @param {*} args The arguments for calling the method. It is expected that the last item
     *                  be the contract method call data to be cached
     * @return {ContractMethodCall} The retrieved contract method call data
     */
    getMethodCall(methodName, ...args) {
        return this._methodCalls.get(`${methodName}_${JSON.stringify(args)}`);
    }

    /**
     * Checks if a contact method call data is already cached
     * @param {string} methodName The name of the contract method
     * @param {*} args The arguments for calling the method. It is expected that the last item
     *                  be the contract method call data to be cached
     * @return {boolean}
     */
    hasMethodCall(methodName, ...args) {
        return this._methodCalls.has(`${methodName}_${JSON.stringify(args)}`);
    }

    /**
     * Converts an amount of foreign blockchain native coin expressed in its lowest denomination
     *  into its natural/unit denomination
     * @param {(BigNumber|string)} amount Native coin amount expressed in its lowest denomination
     * @return {BigNumber} The native coin amount expressed in its natural/unit denomination
     */
    toNativeCoin(amount) {
        return new BigNumber(this._blockchain.nativeCoin.fromLowestDenomination(amount));
    }
}


// Definition of module (private) functions
//

/**
 * @typedef {Object} SentTxInfo
 * @property {string} txHash The transaction hash
 * @property {?} txOutcome Web3.js promise/event emitter object that can be used to check transaction outcome
 */

/**
 * Process result from web3.js send() methods
 * @param {?} sendResult
 * @return {Promise<SentTxInfo>}
 */
export function processSendResult(sendResult) {
    let resolvePromise;
    let rejectPromise;
    let promiseResolved = false;

    const promise = new Promise((resolve, reject) => {
        resolvePromise = resolve;
        rejectPromise = reject;
    });

    sendResult
    .once('transactionHash', txHash => {
        promiseResolved = true;
        resolvePromise({
            txHash,
            txOutcome: sendResult
        });
    })
    .once('error', err => {
        if (!promiseResolved) {
            rejectPromise(err)
        }
    });

    return promise;
}
