/**
 * Created by claudio on 2021-06-04
 */

//console.log('[CatenisErc20Token.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import path from 'path';
// Third-party node modules
import config from 'config';
import BigNumber from 'bignumber.js';
// Meteor packages
import { Promise } from 'meteor/promise';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import {
    ForeignSmartContract,
    processSendResult
} from './ForeignSmartContract';
import { ForeignBlockchain } from './ForeignBlockchain';

// Config entries
const ctnErc20TokenConfig = config.get('catenisErc20Token');

// Configuration settings
const cfgSettings = {
    resourcePath: ctnErc20TokenConfig.get('resourcePath'),
    compiledOutputFilename: ctnErc20TokenConfig.get('compiledOutputFilename'),
    updateNonceMaxRetries: ctnErc20TokenConfig.get('updateNonceMaxRetries')
};


// Definition of classes
//

// CatenisErc20Token class
export class CatenisErc20Token extends ForeignSmartContract {
    /**
     * Class constructor
     * @param {string} blockchainKey Foreign blockchain key. It should match one of the keys defined in the
     *                                ForeignBlockchain module
     * @param {ForeignBcAccount} ownerAccount Foreign blockchain account that will function as the contract owner
     * @param {Object} [options]
     * @param {string} [options.contractAddress] Deployed smart contract address. Should only be supplied for contracts
     *                                            that have already been deployed
     * @param {NativeCoinConsumptionProfile} [options.consumptionProfile] Foreign blockchain native coin consumption
     *                                            profile to be used by default for issuing foreign blockchain
     *                                            transactions
     */
    constructor(blockchainKey, ownerAccount, options) {
        super(
            blockchainKey,
            ownerAccount,
            Assets.getText(path.join(cfgSettings.resourcePath, cfgSettings.compiledOutputFilename)),
            options
        );
    }


    // Public object properties (getters/setters)
    //

    /**
     * Token name
     * @return {string}
     */
    get name() {
        if (!this.isDeployed) {
            throw new Error('Smart contract is not yet deployed');
        }

        let tryAgain;
        let wsDisconnectRetried = false;

        do {
            tryAgain = false;

            try {
                return Promise.await(
                    this.contract.methods.name().call({
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

    /**
     * Token symbol
     * @return {string}
     */
    get symbol() {
        if (!this.isDeployed) {
            throw new Error('Smart contract is not yet deployed');
        }

        let tryAgain;
        let wsDisconnectRetried = false;

        do {
            tryAgain = false;

            try {
                return Promise.await(
                    this.contract.methods.symbol().call({
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

    /**
     * Maximum number of decimal places
     * @return {number}
     */
    get decimals() {
        if (!this.isDeployed) {
            throw new Error('Smart contract is not yet deployed');
        }

        let strValue;
        let tryAgain;
        let wsDisconnectRetried = false;

        do {
            tryAgain = false;

            try {
                strValue = Promise.await(
                    this.contract.methods.decimals().call({
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

        return Number.parseInt(strValue);
    }

    /**
     * Token total supply
     * @return {BigNumber}
     */
    get totalSupply() {
        if (!this.isDeployed) {
            throw new Error('Smart contract is not yet deployed');
        }

        let supply;
        let tryAgain;
        let wsDisconnectRetried = false;

        do {
            tryAgain = false;

            try {
                supply = Promise.await(
                    this.contract.methods.totalSupply().call({
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

        return new BigNumber(supply);
    }

    /**
     * Current token balance for the contract owner account
     * @return {BigNumber}
     */
    get ownerBalance() {
        return this.balanceOf(this.ownerAccount.address);
    }


    // Public object methods
    //

    /**
     * Get current token balance for a given account
     * @param {string} address Account address for getting balance
     * @return {BigNumber} Token balance
     */
    balanceOf(address) {
        if (!this.isDeployed) {
            throw new Error('Smart contract is not yet deployed');
        }

        let balance;
        let tryAgain;
        let wsDisconnectRetried = false;

        do {
            tryAgain = false;

            try {
                balance = Promise.await(
                    this.contract.methods.balanceOf(address).call({
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

        return new BigNumber(balance);
    }

    /**
     * Estimate required foreign blockchain native coin amount to mint (create) a given amount of the ERC20 token
     * @param {string} toAddress Address of blockchain account which will receive the token amount
     * @param {BigNumber} amount Amount of the ERC20 token to mint in the token's smallest denomination
     * @param {NativeCoinConsumptionProfile} [consumptionProfile] Foreign blockchain native coin consumption profile to
     *                                          be used for calculating the estimate
     * @return {BigNumber} Required foreign blockchain native coin amount, in its smallest denomination (wei, 10 e-18)
     */
    mintEstimate(toAddress, amount, consumptionProfile) {
        if (!this.isDeployed) {
            throw new Error('Smart contract is not yet deployed');
        }

        // Determine consumption profile to be used
        if (!consumptionProfile || !ForeignBlockchain.isValidConsumptionProfile(consumptionProfile)) {
            consumptionProfile = this.options.consumptionProfile;
        }

        const mintCall = this.hasMethodCall('mint', toAddress, amount)
            ? this.getMethodCall('mint', toAddress, amount)
            : this.setMethodCall('mint', toAddress, amount, this.contract.methods.mint(toAddress, amount));

        let tryAgain;
        let wsDisconnectRetried = false;

        do {
            tryAgain = false;

            try {
                mintCall.gasEstimate = Promise.await(
                    mintCall.tx.estimateGas({
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

        return this._blockchain.gasPrices.getPriceEstimate(consumptionProfile.confidenceLevel).times(mintCall.gasEstimate);
    }

    /**
     * Mint (create) a given amount of the ERC20 token
     * @param {string} toAddress Address of blockchain account which will receive the token amount
     * @param {BigNumber} amount Amount of the ERC20 token to mint in the token's smallest denomination
     * @param {NativeCoinConsumptionProfile} [consumptionProfile] Foreign blockchain native coin consumption profile to
     *                                          be used for calling the contract method
     * @return {SentTxInfo} Object containing the resulting transaction hash and a web3.js promise/event emitter
     *                       that resolves to the transaction receipt
     */
    mint(toAddress, amount, consumptionProfile) {
        if (!this.isDeployed) {
            throw new Error('Smart contract is not yet deployed');
        }

        // Determine consumption profile to be used
        if (!consumptionProfile || !ForeignBlockchain.isValidConsumptionProfile(consumptionProfile)) {
            consumptionProfile = this.options.consumptionProfile;
        }

        const mintCall = this.hasMethodCall('mint', toAddress, amount)
            ? this.getMethodCall('mint', toAddress, amount)
            : this.setMethodCall('mint', toAddress, amount, this.contract.methods.mint(toAddress, amount));
        
        if (!mintCall.gasEstimate) {
            let tryAgain;
            let wsDisconnectRetried = false;

            do {
                tryAgain = false;

                try {
                    mintCall.gasEstimate = Promise.await(
                        mintCall.tx.estimateGas({
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

        const gas = mintCall.gasEstimate;
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
                        mintCall.tx.send({
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
     * Estimate required foreign blockchain native coin amount to burn (purge) a given amount of the ERC20 token
     * @param {BigNumber} amount Amount of the ERC20 token to burn in the token's smallest denomination
     * @param {NativeCoinConsumptionProfile} [consumptionProfile] Foreign blockchain native coin consumption profile to
     *                                          be used for calculating the estimate
     * @return {BigNumber} Required foreign blockchain native coin amount, in its smallest denomination (wei, 10 e-18)
     */
    burnEstimate(amount, consumptionProfile) {
        if (!this.isDeployed) {
            throw new Error('Smart contract is not yet deployed');
        }

        if (amount.gt(this.ownerBalance)) {
            throw new Error('Operation not allowed: burn amount exceeds balance');
        }

        // Determine consumption profile to be used
        if (!consumptionProfile || !ForeignBlockchain.isValidConsumptionProfile(consumptionProfile)) {
            consumptionProfile = this.options.consumptionProfile;
        }

        const burnCall = this.hasMethodCall('burn', amount)
            ? this.getMethodCall('burn', amount)
            : this.setMethodCall('burn', amount, this.contract.methods.burn(amount));

        let tryAgain;
        let wsDisconnectRetried = false;

        do {
            tryAgain = false;

            try {
                burnCall.gasEstimate = Promise.await(
                    burnCall.tx.estimateGas({
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

        return this._blockchain.gasPrices.getPriceEstimate(consumptionProfile.confidenceLevel).times(burnCall.gasEstimate);
    }

    /**
     * Burn (purge) a given amount of the ERC20 token
     * @param {BigNumber} amount Amount of the ERC20 token to burn in the token's smallest denomination
     * @param {NativeCoinConsumptionProfile} [consumptionProfile] Foreign blockchain native coin consumption profile to
     *                                          be used for calling the contract method
     * @return {SentTxInfo} Object containing the resulting transaction hash and a web3.js promise/event emitter
     *                       that resolves to the transaction receipt
     */
    burn(amount, consumptionProfile) {
        if (!this.isDeployed) {
            throw new Error('Smart contract is not yet deployed');
        }

        if (amount.gt(this.ownerBalance)) {
            throw new Error('Operation not allowed: burn amount exceeds balance');
        }

        // Determine consumption profile to be used
        if (!consumptionProfile || !ForeignBlockchain.isValidConsumptionProfile(consumptionProfile)) {
            consumptionProfile = this.options.consumptionProfile;
        }

        const burnCall = this.hasMethodCall('burn', amount)
            ? this.getMethodCall('burn', amount)
            : this.setMethodCall('burn', amount, this.contract.methods.burn(amount));

        if (!burnCall.gasEstimate) {
            let tryAgain;
            let wsDisconnectRetried = false;

            do {
                tryAgain = false;

                try {
                    burnCall.gasEstimate = Promise.await(
                        burnCall.tx.estimateGas({
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

        const gas = burnCall.gasEstimate;
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
                        burnCall.tx.send({
                            from: this.ownerAccount.address,
                            gas,
                            gasPrice
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
        while(tryAgain);
    }
}


// Definition of module (private) functions
//


// Module code
//

// Lock class
Object.freeze(CatenisErc20Token);
