/**
 * Created by Claudio on 2018-03-20.
 */

//console.log('[TransferAssetTransaction.js]: This code just ran.');

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

// References code in other (Catenis) modules
import { Device } from './Device';
import { Asset } from './Asset';
import { Catenis } from './Catenis';
import { CCTransaction } from './CCTransaction';
import { Transaction } from './Transaction';
import { BaseBlockchainAddress } from './BaseBlockchainAddress';
import { CCFundSource } from './CCFundSource';
import { FundSource } from './FundSource';
import { KeyStore } from './KeyStore';
import { CatenisNode } from './CatenisNode';
import {
    getAddrAndAddrInfo,
    areAddressesFromSameDevice
} from './SendMessageTransaction';
import { Service } from './Service';
import { BitcoinInfo } from './BitcoinInfo';

// Config entries
/*const config_entryConfig = config.get('config_entry');

// Configuration settings
const cfgSettings = {
    property: config_entryConfig.get('property_name')
};*/


// Definition of function classes
//

// TransferAssetTransaction function class
//
//  Constructor arguments:
//    sendingDevice: [Object(Device)] - Object of type Device identifying the device that is sending the asset
//    receivingDevice: [Object(Device)] - Object of type Device identifying the device to which the assets are sent
//    amount: [Number]      - Amount of asset to be sent (expressed as a fractional amount)
//    assetId: [String]     - The ID of the asset to transfer
//
// NOTE: make sure that objects of this function class are instantiated and used (their methods
//  called) from code executed from both the FundSource.utxoCS and CCFundSource.utxoCS critical section objects
export function TransferAssetTransaction(sendingDevice, receivingDevice, amount, assetId) {
    // Properties definition
    //  NOTE: arrow functions should NOT be used for the getter/setter of the defined properties.
    //      This is to avoid that, if `this` is referred from within the getter/setter body, it
    //      refers to the object from where the properties have been defined rather than to the
    //      object from where the property is being accessed. Normally, this does not represent
    //      an issue (since the object from where the property is accessed is the same object
    //      from where the property has been defined), but it is especially dangerous if the
    //      object can be cloned.
    Object.defineProperties(this, {
        txid: {
            get: function () {
                // noinspection JSPotentiallyInvalidUsageOfThis
                return this.ccTransact.txid;
            },
            enumerable: true
        },
        innerTransact: {
            get: function () {
                // noinspection JSPotentiallyInvalidUsageOfThis
                return this.ccTransact;
            },
            enumerable: true
        }
    });

    if (sendingDevice !== undefined) {
        // Validate arguments
        const errArg = {};

        if (!(sendingDevice instanceof Device)) {
            errArg.sendingDevice = sendingDevice;
        }

        if (!(receivingDevice instanceof Device)) {
            errArg.receivingDevice = receivingDevice;
        }

        if (typeof assetId !== 'string') {
            errArg.assetId = assetId;
        }

        // Retrieve asset
        this.assetId = assetId;
        this.asset = Asset.getAssetByAssetId(assetId, true);

        // Asset exists (otherwise ctn_asset_not_found exception is thrown).
        //  Make sure that this is a regular (fungible) asset
        if (this.asset.isNonFungible) {
            Catenis.logger.ERROR('Inconsistent asset to be transferred; expected a regular (fungible) asset', {
                assetId
            });
            throw new Meteor.Error('ctn_transfer_asset_non_fungible', `Inconsistent asset to be transferred; expected a regular (fungible) asset (assetId: ${assetId})`);
        }

        if (typeof amount !== 'number' || amount <= 0) {
            errArg.amount = amount;
        }

        if (Object.keys(errArg).length > 0) {
            const errArgs = Object.keys(errArg);

            Catenis.logger.ERROR(util.format('TransferAssetTransaction constructor called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
            throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
        }

        // Just initialize instance variables for now
        this.ccTransact = new CCTransaction();
        this.txBuilt = false;
        this.sendingDevice = sendingDevice;
        this.receivingDevice = receivingDevice;
        this.amount = Asset.amountToSmallestDivisionAmount(amount, this.asset.divisibility);
        this.changeAmount = undefined;

        if (Number.isNaN(this.amount)) {
            // Amount to be transferred is too large. Log error and throw exception
            Catenis.logger.ERROR('Amount requested to be transferred is larger than maximum allowed total asset amount', {
                amount: amount
            });
            throw new Meteor.Error('ctn_transf_asset_amount_too_large', util.format('Amount requested to be transferred (%d) is larger than maximum allowed total asset amount', amount));
        }

        // Make sure that sending device has enough of the specified amount to send
        const devAssetBalance = this.sendingDevice.assetBalance(this.assetId);
        this.prevTotalBalance = 0;

        if (devAssetBalance === undefined || (this.prevTotalBalance = devAssetBalance.total) < this.amount) {
            // Insufficient balance to transfer asset
            Catenis.logger.ERROR('Insufficient balance to transfer asset', {
                sendingDeviceId: this.sendingDevice.deviceId,
                assetId: this.assetId,
                amountToTransfer: this.asset.formatAmount(this.amount),
                balance: devAssetBalance !== undefined ? this.asset.formatAmount(devAssetBalance.total) : undefined
            });
            throw new Meteor.Error('ctn_transf_asset_low_balance', 'Insufficient balance to transfer asset');
        }
    }
}


// Public TransferAssetTransaction object methods
//

TransferAssetTransaction.prototype.buildTransaction = function () {
    if (!this.txBuilt) {
        // Add Colored Coins related transaction inputs and outputs
        //

        // Add Colored Coins asset transfer inputs

        // Try to allocate (Colored Coins) asset amount to transfer
        const devAssetAddrFundSource = new CCFundSource(this.asset.ccAssetId, this.sendingDevice.assetAddr.listAddressesInUse(), {
            useUnconfirmedUtxo: true,
            unconfUtxoInfo: {
                initTxInputs: this.ccTransact.inputs
            },
            smallestChange: true
        });
        const devAssetAddrAllocResult = devAssetAddrFundSource.allocateFund(this.amount);

        // Make sure that Colored Coins UTXOs have been correctly allocated
        if (devAssetAddrAllocResult === null) {
            // Unable to allocate Colored Coins UTXOs. Log error condition and throw exception
            Catenis.logger.ERROR('Unable to allocate Colored Coins (ccAssetId: %s) UTXOs for device (deviceId: %s) asset addresses', this.asset.ccAssetId, this.sendingDevice.deviceId);
            throw new Meteor.Error('ctn_transf_asset_ccutxo_alloc_error', util.format('Unable to allocate Colored Coins (ccAssetId: %d) UTXOs for device (deviceId: %s) asset addresses', this.asset.ccAssetId, this.sendingDevice.deviceId));
        }

        // Save asset change amount
        this.changeAmount = devAssetAddrAllocResult.changeAssetAmount;

        // Add sending device asset address inputs
        this.ccTransact.addTransferInputs(devAssetAddrAllocResult.utxos.map((utxo) => {
            return {
                txout: utxo.txout,
                isWitness: utxo.isWitness,
                scriptPubKey: utxo.scriptPubKey,
                address: utxo.address,
                addrInfo: Catenis.keyStore.getAddressInfo(utxo.address)
            }
        }));

        // Add Colored Coins asset transfer outputs

        // Receiving device asset address output
        this.ccTransact.setTransferOutput(this.receivingDevice.assetAddr.newAddressKeys().getAddress(), this.amount, 0);

        if (this.changeAmount > 0) {
            // Sending device asset address change output
            this.ccTransact.setTransferOutput(this.sendingDevice.assetAddr.newAddressKeys().getAddress(), this.changeAmount, 0);
        }

        // Pre-allocate multi-signature signee address
        const multiSigSigneeAddr = this.sendingDevice.client.ctnNode.multiSigSigneeAddr.newAddressKeys().getAddress();

        // Assemble Colored Coins transaction
        // TODO: review the transaction spec to allow for the use of Colored Coins range payment (third parameter
        //  of the assemble() method of the CCTransaction class)
        this.ccTransact.assemble(multiSigSigneeAddr);

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
        const txChangeOutputType = BitcoinInfo.getOutputTypeByAddressType(this.sendingDevice.client.ctnNode.payTxExpenseAddr.btcAddressType);
        let payTxAllocResult;

        do {
            retryPayTxExpense = false;

            const payTxFundSource = new FundSource(this.sendingDevice.client.ctnNode.payTxExpenseAddr.listAddressesInUse(), {
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
                if (!payTxExpAddrsRefunded && this.sendingDevice.client.ctnNode.checkPayTxExpenseFundingBalance()) {
                    // Try to refund addresses used to pay to transaction expense
                    Catenis.logger.WARN('Not enough UTXOs available to pay for transfer asset tx expense. Refunding pay tx expense addresses to try again');
                    payTxExpAddrsRefunded = true;
                    retryPayTxExpense = true;
                }
                else {
                    // Log error condition and throw exception
                    Catenis.logger.ERROR('No UTXO available to be allocated to pay for transfer asset tx expense');
                    throw new Meteor.Error('ctn_transf_asset_no_utxo_pay_tx_expense', 'No UTXO available to be allocated to pay for transfer asset tx expense');
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
            this.ccTransact.addPubKeyHashOutput(this.sendingDevice.client.ctnNode.payTxExpenseAddr.newAddressKeys().getAddress(), payTxAllocResult.changeAmount);
        }

        // Indicate that transaction is already built
        this.txBuilt = true;
    }
};

// Return:
//   txid: [String] - Blockchain ID of sent transaction
TransferAssetTransaction.prototype.sendTransaction = function () {
    // Make sure that transaction is already built
    if (this.txBuilt) {
        // Check if transaction has not yet been created and sent
        if (this.ccTransact.txid === undefined) {
            this.ccTransact.sendTransaction();

            // Save sent transaction onto local database
            this.ccTransact.saveSentTransaction(Transaction.type.transfer_asset, {
                assetId: this.assetId,
                sendingDeviceId: this.sendingDevice.deviceId,
                receivingDeviceId: this.receivingDevice.deviceId,
                amount: this.amount,
                changeAmount: this.changeAmount
            });

            // Force update of Colored Coins data associated with UTXOs
            Catenis.c3NodeClient.parseNow();

            // Check if system pay tx expense addresses need to be refunded
            this.sendingDevice.client.ctnNode.checkPayTxExpenseFundingBalance();
        }

        return this.ccTransact.txid;
    }
};

TransferAssetTransaction.prototype.revertOutputAddresses = function () {
    if (this.txBuilt) {
        this.ccTransact.revertOutputAddresses();
    }
};


// Module functions used to simulate private TransferAssetTransaction object methods
//  NOTE: these functions need to be bound to a TransferAssetTransaction object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// TransferAssetTransaction function class (public) methods
//

// Determines if transaction is a valid Catenis Transfer Asset transaction
//
//  Arguments:
//    ccTransact: [Object] // Object of type CCTransaction identifying the transaction to be checked
//
//  Return:
//    - If transaction is not valid: undefined
//    - If transaction is valid: Object of type TransferAssetTransaction created from transaction
//
TransferAssetTransaction.checkTransaction = function (ccTransact) {
    let transferAssetTransact = undefined;

    // First, check if pattern of transaction's inputs and outputs is consistent
    if ((ccTransact instanceof CCTransaction) && ccTransact.matches(TransferAssetTransaction)) {
        // Make sure that this is a Colored Coins transaction that transfers regular (fungible) assets, does not issue
        //  any asset, and has exactly one transfer input sequence and one or two transfer outputs
        if (ccTransact.isTransferringAsset && !ccTransact.hasIssuance && ccTransact.transferInputSeqs.length === 1
                && (ccTransact.transferOutputs.length === 1 || ccTransact.transferOutputs.length === 2)) {
            // Validate and identify input and output addresses
            //  NOTE: no need to check if the variables below are non-null because the transact.matches()
            //      result above already guarantees it
            const sendDevAssetAddrs = [];
            let nextInputPos = 0;
            let done = false,
                error = false;

            do {
                const inputAddr = getAddrAndAddrInfo(ccTransact.getInputAt(nextInputPos++));

                if (inputAddr.addrInfo.type === KeyStore.extKeyType.dev_asst_addr.name) {
                    // Make sure that all asset address inputs are from the same device (the sending device)
                    if (sendDevAssetAddrs.length === 0 || areAddressesFromSameDevice(sendDevAssetAddrs[0].addrInfo, inputAddr.addrInfo)) {
                        sendDevAssetAddrs.push(inputAddr);
                    }
                    else {
                        error = true;
                    }
                }
                else {
                    done = true;
                }
            }
            while (!done && !error);

            if (!error) {
                let nextOutPos = ccTransact.includesMultiSigOutput ? 2 : 1;
                const receiveDevAssetAddr = getAddrAndAddrInfo(ccTransact.getOutputAt(nextOutPos++).payInfo);

                const changeOutput = ccTransact.getOutputAt(nextOutPos);
                let sendDevAssetAddrChange;

                if (changeOutput !== undefined) {
                    const outputAddr = getAddrAndAddrInfo(changeOutput.payInfo);

                    if (outputAddr.addrInfo.type === KeyStore.extKeyType.dev_asst_addr.name) {
                        sendDevAssetAddrChange = outputAddr;
                    }
                }

                if (sendDevAssetAddrChange === undefined || areAddressesFromSameDevice(sendDevAssetAddrs[0].addrInfo, sendDevAssetAddrChange.addrInfo)) {
                    // Instantiate transfer asset transaction
                    transferAssetTransact = new TransferAssetTransaction();

                    transferAssetTransact.ccTransact = ccTransact;
                    transferAssetTransact.sendingDevice = CatenisNode.getCatenisNodeByIndex(sendDevAssetAddrs[0].addrInfo.pathParts.ctnNodeIndex).getClientByIndex(sendDevAssetAddrs[0].addrInfo.pathParts.clientIndex).getDeviceByIndex(sendDevAssetAddrs[0].addrInfo.pathParts.deviceIndex);
                    transferAssetTransact.receivingDevice = CatenisNode.getCatenisNodeByIndex(receiveDevAssetAddr.addrInfo.pathParts.ctnNodeIndex).getClientByIndex(receiveDevAssetAddr.addrInfo.pathParts.clientIndex).getDeviceByIndex(receiveDevAssetAddr.addrInfo.pathParts.deviceIndex);
                    transferAssetTransact.amount = ccTransact.transferOutputs[0].assetAmount;
                    transferAssetTransact.changeAmount = changeOutput !== undefined ? changeOutput.payInfo.assetAmount : 0;
                    transferAssetTransact.assetId = Asset.getAssetIdFromCcTransaction(ccTransact);

                    transferAssetTransact.asset = undefined;

                    try {
                        transferAssetTransact.asset = Asset.getAssetByAssetId(transferAssetTransact.assetId);
                    }
                    catch (err) {
                        if (!((err instanceof Meteor.Error) && err.error === 'ctn_asset_not_found')) {
                            throw err;
                        }
                    }
                }
            }
        }
    }

    return transferAssetTransact;
};


// TransferAssetTransaction function class (public) properties
//

TransferAssetTransaction.matchingPattern = Object.freeze({
    input: util.format('^(?:%s)+(?:%s)*$',
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


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(TransferAssetTransaction);
