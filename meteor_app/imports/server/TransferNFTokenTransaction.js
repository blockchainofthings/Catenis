/**
 * Created by claudio on 2022-07-09
 */

//console.log('[TransferNFTokenTransaction.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import util from 'util';
// Third-party node modules
//import config from 'config';
// Meteor packages
import { Meteor } from 'meteor/meteor';
// noinspection ES6CheckImport
import { Promise } from 'meteor/promise';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { NFTokenTransfer } from './NFTokenTransfer';
import { Transaction } from './Transaction';
import { KeyStore } from './KeyStore';
import { CatenisNode } from './CatenisNode';
import { CCTransaction } from './CCTransaction';
import { NFTokenSource } from './NFTokenSource';
import { BaseBlockchainAddress } from './BaseBlockchainAddress';
import { BitcoinInfo } from './BitcoinInfo';
import { FundSource } from './FundSource';
import { Service } from './Service';
import {
    getAddrAndAddrInfo,
    areAddressesFromSameDevice
} from './SendMessageTransaction';
import { NonFungibleToken } from './NonFungibleToken';


// Definition of classes
//

/**
 * Transfer Non-Fungible Token transaction class
 */
export class TransferNFTokenTransaction {
    /**
     * Regular expression for matching this transaction type
     * @type {Readonly<{output: string, input: string}>}
     */
    static matchingPattern = Object.freeze({
        input: util.format('^(?:%s)(?:%s)*$',
            Transaction.ioToken.p2_dev_asst_addr.token,
            Transaction.ioToken.p2_sys_pay_tx_exp_addr.token),
        output: util.format('^(?:(?:%s)(?:%s)(?:%s){1,2}(?:%s))?(?:%s)(?:%s){1,2}(?:%s)?$',
            Transaction.ioToken.multisig_start.token,
            Transaction.ioToken.p2_sys_msig_sign_addr.token,
            Transaction.ioToken.p2_unknown_addr.token,
            Transaction.ioToken.multisig_end.token,
            Transaction.ioToken.null_data.token,
            Transaction.ioToken.p2_dev_asst_addr.token,
            Transaction.ioToken.p2_sys_pay_tx_exp_addr.token)
    });

    /**
     * Class constructor
     * @param {NFTokenTransfer} [nfTokenTransfer] Non-fungible token transfer object
     */
    constructor(nfTokenTransfer) {
        if (nfTokenTransfer) {
            //  Validate arguments
            const errArg = {};

            if (!(nfTokenTransfer instanceof NFTokenTransfer)) {
                errArg.nfTokenTransfer = nfTokenTransfer;
            }

            if (Object.keys(errArg).length > 0) {
                const errArgs = Object.keys(errArg);

                Catenis.logger.ERROR(`TransferNFTokenTransaction constructor called with invalid argument${errArgs.length > 1 ? 's' : ''}`, errArg);
                throw new TypeError(`Invalid ${errArgs.join(', ')} argument${errArgs.length > 1 ? 's' : ''}`);
            }

            // Retrieve the non-fungible token owner info
            const nftOwnerInfo = Catenis.c3NodeClient.getNFTokenOwner(nfTokenTransfer.ccTokenId);

            if (!nftOwnerInfo) {
                Catenis.logger.ERROR('No possession info found for the non-fungible token', {
                    tokenId: nfTokenTransfer.tokenId,
                    ccTokenId: nfTokenTransfer.ccTokenId
                });
                throw new Meteor.Error('ctn_transfer_nft_invalid_cc_id', 'No possession info found for the given non-fungible token ID');
            }

            if (!nftOwnerInfo.address) {
                Catenis.logger.ERROR('Non-fungible token is not currently held by any blockchain address', {
                    tokenId: nfTokenTransfer.tokenId,
                    ccTokenId: nfTokenTransfer.ccTokenId
                });
                throw new Meteor.Error('ctn_transfer_nft_burnt_token', 'Non-fungible token is not currently held by any blockchain address');
            }

            const holdingAddressInfo = Catenis.keyStore.getAddressInfo(nftOwnerInfo.address, true);

            if (!holdingAddressInfo || holdingAddressInfo.type !== KeyStore.extKeyType.dev_asst_addr.name) {
                Catenis.logger.ERROR('fungible token is currently held by an unknown or inconsistent blockchain address', {
                    tokenId: nfTokenTransfer.tokenId,
                    ccTokenId: nfTokenTransfer.ccTokenId,
                    holdingAddress: nftOwnerInfo.address
                });
                throw new Meteor.Error('ctn_transfer_nft_invalid_addr', 'Non-fungible token is currently held by an unknown or inconsistent blockchain address');
            }

            // Get holding device
            const holdingDevice = CatenisNode.getCatenisNodeByIndex(holdingAddressInfo.pathParts.ctnNodeIndex)
            .getClientByIndex(holdingAddressInfo.pathParts.clientIndex)
            .getDeviceByIndex(holdingAddressInfo.pathParts.deviceIndex);

            // Make sure that sending device is the current owner of the non-fungible token
            if (nfTokenTransfer.sendingDevice.deviceId !== holdingDevice.deviceId) {
                throw new Meteor.Error('ctn_transfer_nft_not_holder', 'Device is not the current holder of the non-fungible token');
            }

            // Initialize instance variables for now
            this.nfTokenTransfer = nfTokenTransfer;
            this.holdingAddress = nftOwnerInfo.address;
            this.holdingAddressInfo = holdingAddressInfo;
            this.returningCCTokenIds = [];
            this.ccTransact = new CCTransaction();
            this.txBuilt = false;
        }
    }

    /**
     * Returns the blockchain transaction ID
     * @returns {string}
     */
    get txid() {
        return this.ccTransact.txid;
    }

    /**
     * Gets the internal Colored Coins transaction object
     * @returns {CCTransaction}
     */
    get innerTransact() {
        return this.ccTransact;
    }

    /**
     * Gets the Colored Coins attributed ID of the non-fungible token being transferred
     * @returns {string}
     */
    get ccTokenId() {
        return this.nfTokenTransfer ? this.nfTokenTransfer.ccTokenId : this._ccTokenId;
    }

    /**
     * Sets the Colored Coins attributed ID of the non-fungible token being transferred.
     *
     * NOTE: this should be used exclusively by the checkTransaction() method when the non-fungible token is not yet
     *        recorded in the local database.
     *
     * @param {string} value
     */
    set ccTokenId(value) {
        this._ccTokenId = value;
    }

    /**
     * Gets the device ID of the device that is sending the non-fungible token
     * @returns {string}
     */
    get sendingDeviceId() {
        return this.nfTokenTransfer ? this.nfTokenTransfer.sendingDevice.deviceId : this._sendingDeviceId;
    }

    /**
     * Sets the device ID of the device that is sending the non-fungible token
     *
     * NOTE: this should be used exclusively by the checkTransaction() method when the non-fungible token is not yet
     *        recorded in the local database.
     *
     * @param {string} value
     */
    set sendingDeviceId(value) {
        this._sendingDeviceId = value;
    }

    /**
     * Gets the device ID of the device that will receive the non-fungible token
     * @returns {string}
     */
    get receivingDeviceId() {
        return this.nfTokenTransfer ? this.nfTokenTransfer.receivingDevice.deviceId : this._receivingDeviceId;
    }

    /**
     * Sets the device ID of the device that will receive the non-fungible token
     *
     * NOTE: this should be used exclusively by the checkTransaction() method when the non-fungible token is not yet
     *        recorded in the local database.
     *
     * @param {string} value
     */
    set receivingDeviceId(value) {
        this._receivingDeviceId = value;
    }

    /**
     * Builds the blockchain transaction
     */
    buildTransaction() {
        if (!this.txBuilt) {
            // Add Colored Coins related transaction inputs and outputs
            //

            // Add Colored Coins asset transfer inputs

            // Try to allocate (Colored Coins) asset amount to transfer
            const nfTokenSource = new NFTokenSource(this.nfTokenTransfer.ccTokenId, this.holdingAddress, {
                useUnconfirmedUtxo: true
            });

            if (!nfTokenSource.holdingUtxoFound) {
                // Unable to find UTXO that currently holds the Colored Coins token. Log error condition and throw exception
                Catenis.logger.ERROR(
                    'Unable to find UTXO with address (%s) that currently holds the Colored Coins non-fungible token (ccTokenId: %s)',
                    this.holdingAddress,
                    this.nfTokenTransfer.ccTokenId
                );
                throw new Meteor.Error('ctn_transfer_nft_utxo_not_found', `Unable to find UTXO with address (${this.holdingAddress}) that currently holds the Colored Coins non-fungible token (ccTokenId: %${this.nfTokenTransfer.ccTokenId})`);
            }

            // Add sending device asset address inputs
            this.ccTransact.addTransferInputs({
                txout: nfTokenSource.holdingUtxo.txout,
                isWitness: nfTokenSource.holdingUtxo.isWitness,
                scriptPubKey: nfTokenSource.holdingUtxo.scriptPubKey,
                address: nfTokenSource.holdingUtxo.address,
                addrInfo: Catenis.keyStore.getAddressInfo(nfTokenSource.holdingUtxo.address),
                tokenIndex: nfTokenSource.holdingUtxo.tokenIndex
            });

            // Add Colored Coins asset transfer outputs

            let returningKeys;

            if (nfTokenSource.holdingUtxo.tokenIndex > 0) {
                // Add Colored Coins asset transfer output to send first non-fungible tokens in UTXO
                //  back to sending device
                returningKeys = this.nfTokenTransfer.sendingDevice.assetAddr.newAddressKeys();

                this.ccTransact.setTransferOutput(
                    returningKeys.getAddress(),
                    nfTokenSource.holdingUtxo.tokenIndex,
                    0,
                    true,
                    false
                );

                this.returningCCTokenIds = nfTokenSource.holdingUtxo.txout.ccTokenIds.slice(0, nfTokenSource.holdingUtxo.tokenIndex);
            }

            // Receiving device asset address output
            const receivingKeys = this.nfTokenTransfer.receivingDevice.assetAddr.newAddressKeys();

            this.ccTransact.setTransferOutput(
                receivingKeys.getAddress(),
                1,
                0,
                false,
                false
            );

            const numTokensInUtxo = nfTokenSource.holdingUtxo.txout.ccTokenIds.length;

            if (nfTokenSource.holdingUtxo.tokenIndex < numTokensInUtxo - 1) {
                // Add Colored Coins asset transfer output to send remaining non-fungible tokens in UTXO
                //  back to sending device
                if (!returningKeys) {
                    returningKeys = this.nfTokenTransfer.sendingDevice.assetAddr.newAddressKeys();
                }

                this.ccTransact.setTransferOutput(
                    returningKeys.getAddress(),
                    numTokensInUtxo - nfTokenSource.holdingUtxo.tokenIndex - 1,
                    0,
                    false,
                    false
                );

                this.returningCCTokenIds = this.returningCCTokenIds.concat(
                    nfTokenSource.holdingUtxo.txout.ccTokenIds.slice(nfTokenSource.holdingUtxo.tokenIndex + 1)
                );
            }

            // Get metadata to be sent along with non-fungible transfer transaction (if any)
            const ccMetadata = Promise.await(this.nfTokenTransfer.getTransferMetadata(
                nfTokenSource.holdingUtxo.txout.ccTokenIds,
                this.holdingAddressInfo.cryptoKeys,
                receivingKeys,
                returningKeys
            ));

            if (ccMetadata) {
                // Handle metadata to be sent along with non-fungible token transfer transaction
                this.ccTransact.setCcMetadata(ccMetadata);
            }

            // Pre-allocate multi-signature signee address
            const multiSigSigneeAddr = this.nfTokenTransfer.sendingDevice.client.ctnNode.multiSigSigneeAddr.newAddressKeys().getAddress();

            // Assemble Colored Coins transaction
            this.ccTransact.assemble(multiSigSigneeAddr, this.nfTokenTransfer.updateTransferProgress.bind(this.nfTokenTransfer, 0));

            if (!this.ccTransact.includesMultiSigOutput) {
                // Revert pre-allocated multi-signature signee address
                BaseBlockchainAddress.revertAddress(multiSigSigneeAddr);
            }

            // Finalize transaction
            //

            // Add additional required outputs

            // Allocate UTXOs to pay for tx expense
            let retryPayTxExpense;
            let payTxExpAddrsRefunded = false;
            const txChangeOutputType = BitcoinInfo.getOutputTypeByAddressType(this.nfTokenTransfer.sendingDevice.client.ctnNode.payTxExpenseAddr.btcAddressType);
            let payTxAllocResult;

            do {
                retryPayTxExpense = false;

                const payTxFundSource = new FundSource(this.nfTokenTransfer.sendingDevice.client.ctnNode.payTxExpenseAddr.listAddressesInUse(), {
                    useUnconfirmedUtxo: true,
                    unconfUtxoInfo: {
                        initTxInputs: this.ccTransact.inputs
                    },
                    smallestChange: true,
                    useAllNonWitnessUtxosFirst: true,   // Default setting; could have been omitted
                    useWitnessOutputForChange: txChangeOutputType.isWitness
                });

                payTxAllocResult = payTxFundSource.allocateFundForTxExpense({
                    txSzStSnapshot: this.ccTransact.txSize,
                    inputAmount: this.ccTransact.totalInputsAmount(),
                    outputAmount: this.ccTransact.totalOutputsAmount()
                }, false, Catenis.bitcoinFees.getFeeRateByTime(Service.minutesToConfirmAssetTransfer));

                if (payTxAllocResult === null) {
                    // Unable to allocate UTXOs
                    if (!payTxExpAddrsRefunded && this.nfTokenTransfer.sendingDevice.client.ctnNode.checkPayTxExpenseFundingBalance()) {
                        // Try to refund addresses used to pay to transaction expense
                        Catenis.logger.WARN('Not enough UTXOs available to pay for transfer non-fungible token tx expense. Refunding pay tx expense addresses to try again');
                        payTxExpAddrsRefunded = true;
                        retryPayTxExpense = true;
                    }
                    else {
                        // Log error condition and throw exception
                        Catenis.logger.ERROR('No UTXO available to be allocated to pay for transfer non-fungible token tx expense');
                        throw new Meteor.Error('ctn_transfer_nft_no_utxo_pay_tx_expense', 'No UTXO available to be allocated to pay for transfer non-fungible token tx expense');
                    }
                }
            }
            while (retryPayTxExpense);

            // Add inputs spending the allocated UTXOs to the transaction
            this.ccTransact.addInputs(payTxAllocResult.utxos.map((utxo) => {
                return {
                    txout: utxo.txout,
                    isWitness: utxo.isWitness,
                    scriptPubKey: utxo.scriptPubKey,
                    address: utxo.address,
                    addrInfo: Catenis.keyStore.getAddressInfo(utxo.address)
                }
            }));

            if (payTxAllocResult.changeAmount >= Transaction.dustAmountByOutputType(txChangeOutputType)) {
                // Add new output to receive change
                this.ccTransact.addPubKeyHashOutput(this.nfTokenTransfer.sendingDevice.client.ctnNode.payTxExpenseAddr.newAddressKeys().getAddress(), payTxAllocResult.changeAmount);
            }

            // Indicate that transaction is already built
            this.txBuilt = true;
        }
    }

    /**
     * Sends the transaction to the blockchain network
     */
    sendTransaction() {
        // Make sure that transaction is already built
        if (this.txBuilt) {
            // Check if transaction has not yet been created and sent
            if (!this.ccTransact.txid) {
                this.ccTransact.sendTransaction();

                // Save sent transaction onto local database
                this.ccTransact.saveSentTransaction(Transaction.type.transfer_nf_token, {
                    tokenId: this.nfTokenTransfer.tokenId,
                    sendingDeviceId: this.nfTokenTransfer.sendingDevice.deviceId,
                    receivingDeviceId: this.nfTokenTransfer.receivingDevice.deviceId
                });

                // Force update of Colored Coins data associated with UTXOs
                Catenis.c3NodeClient.parseNow();

                // Check if system pay tx expense addresses need to be refunded
                this.nfTokenTransfer.sendingDevice.client.ctnNode.checkPayTxExpenseFundingBalance();
            }

            return this.ccTransact.txid;
        }
    }

    /**
     * Revert the blockchain addresses that have been allocated for the transaction's outputs
     */
    revertOutputAddresses() {
        if (this.txBuilt) {
            this.ccTransact.revertOutputAddresses();
        }
    }

    /**
     * Determines if Colored Coins transaction is a valid Catenis Transfer Non-Fungible Token transaction
     * @param {CCTransaction} ccTransact The Colored Coins transaction to be validated
     * @returns {(TransferNFTokenTransaction|undefined)} The Transfer Non-Fungible Token transaction if valid, undefined
     *                                                    otherwise
     */
    static checkTransaction(ccTransact) {
        let transferNFTokenTransact = undefined;

        // First, check if pattern of transaction's inputs and outputs is consistent
        if ((ccTransact instanceof CCTransaction) && ccTransact.matches(TransferNFTokenTransaction)) {
            // Make sure that this is a Colored Coins transaction that transfers non-fungible tokens, does not issue
            //  any asset, and has exactly one transfer input sequence and one or two transfer outputs
            if (ccTransact.isTransferringNFToken && !ccTransact.hasIssuance && ccTransact.transferInputSeqs.length === 1
                    && (ccTransact.transferOutputs.length >= 1 && ccTransact.transferOutputs.length <= 3)) {
                // Validate and identify input and output addresses
                //  NOTE: no need to check if the variables below are non-null because the transact.matches()
                //      result above already guarantees it
                const sendDevAssetAddr = getAddrAndAddrInfo(ccTransact.getInputAt(0));

                let nextOutPos = ccTransact.includesMultiSigOutput ? 2 : 1;
                const receiveDevOutput = ccTransact.getOutputAt(nextOutPos++);
                const receiveDevAssetAddr = getAddrAndAddrInfo(receiveDevOutput.payInfo);

                const nextOutput = ccTransact.getOutputAt(nextOutPos);
                let returnSendDevOutput;
                let sendDevAssetAddrReturn;

                if (nextOutput) {
                    const outputAddr = getAddrAndAddrInfo(nextOutput.payInfo);

                    if (outputAddr.addrInfo.type === KeyStore.extKeyType.dev_asst_addr.name) {
                        returnSendDevOutput = nextOutput;
                        sendDevAssetAddrReturn = outputAddr;
                    }
                }

                if (!sendDevAssetAddrReturn || areAddressesFromSameDevice(sendDevAssetAddr.addrInfo, sendDevAssetAddrReturn.addrInfo)) {
                    // Instantiate Transfer Non-Fungible Token transaction object
                    transferNFTokenTransact = new TransferNFTokenTransaction();

                    transferNFTokenTransact.ccTransact = ccTransact;

                    transferNFTokenTransact.nfTokenTransfer = undefined;

                    try {
                        transferNFTokenTransact.nfTokenTransfer =  new NFTokenTransfer(
                            undefined,
                            NonFungibleToken.getNFTokenByCCTokenId(receiveDevOutput.payInfo.ccTokenIds[0]),
                            CatenisNode.getCatenisNodeByIndex(sendDevAssetAddr.addrInfo.pathParts.ctnNodeIndex)
                            .getClientByIndex(sendDevAssetAddr.addrInfo.pathParts.clientIndex)
                            .getDeviceByIndex(sendDevAssetAddr.addrInfo.pathParts.deviceIndex),
                            CatenisNode.getCatenisNodeByIndex(receiveDevAssetAddr.addrInfo.pathParts.ctnNodeIndex)
                            .getClientByIndex(receiveDevAssetAddr.addrInfo.pathParts.clientIndex)
                            .getDeviceByIndex(receiveDevAssetAddr.addrInfo.pathParts.deviceIndex),
                            true
                        );
                    }
                    catch (err) {
                        if (!((err instanceof Meteor.Error) && err.error === 'nf_token_invalid_id')) {
                            throw err;
                        }
                        else {
                            // Save non-fungible token transfer info directly into transaction object
                            transferNFTokenTransact.ccTokenId = receiveDevOutput.payInfo.ccTokenIds[0];
                            transferNFTokenTransact.sendingDevice = CatenisNode.getCatenisNodeByIndex(sendDevAssetAddr.addrInfo.pathParts.ctnNodeIndex)
                                .getClientByIndex(sendDevAssetAddr.addrInfo.pathParts.clientIndex)
                                .getDeviceByIndex(sendDevAssetAddr.addrInfo.pathParts.deviceIndex);
                            transferNFTokenTransact.receivingDevice = CatenisNode.getCatenisNodeByIndex(receiveDevAssetAddr.addrInfo.pathParts.ctnNodeIndex)
                                .getClientByIndex(receiveDevAssetAddr.addrInfo.pathParts.clientIndex)
                                .getDeviceByIndex(receiveDevAssetAddr.addrInfo.pathParts.deviceIndex);
                        }
                    }

                    transferNFTokenTransact.holdingAddress = sendDevAssetAddr.address;
                    transferNFTokenTransact.holdingAddressInfo = sendDevAssetAddr.addrInfo;
                    transferNFTokenTransact.returningCCTokenIds = returnSendDevOutput ? returnSendDevOutput.payInfo.ccTokenIds.concat() : [];
                }
            }
        }

        return transferNFTokenTransact;
    }
}


// Definition of module (private) functions
//


// Module code
//

// Lock class
Object.freeze(TransferNFTokenTransaction);
