/**
 * Created by claudio on 2021-06-18
 */

//console.log('[InMigrateAssetTransaction.js]: This code just ran.');

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
import { Catenis } from './Catenis';
import { Device } from './Device';
import { Asset } from './Asset';
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
import { TransferAssetTransaction } from './TransferAssetTransaction';


// Definition of classes
//

// InMigrateAssetTransaction class
export class InMigrateAssetTransaction {
    // Class (public) properties
    //

    static matchingPattern = Object.freeze({
        input: util.format('^(?:%s)+(?:%s)*$',
            Transaction.ioToken.p2_dev_migr_asst_addr.token,
            Transaction.ioToken.p2_sys_pay_tx_exp_addr.token),
        output: util.format('^(?:(?:%s)(?:%s)(?:%s){1,2}(?:%s))?(?:%s)(?:%s)(?:%s)?(?:%s)?$',
            Transaction.ioToken.multisig_start.token,
            Transaction.ioToken.p2_sys_msig_sign_addr.token,
            Transaction.ioToken.p2_unknown_addr.token,
            Transaction.ioToken.multisig_end.token,
            Transaction.ioToken.null_data.token,
            Transaction.ioToken.p2_dev_asst_addr.token,
            Transaction.ioToken.p2_dev_migr_asst_addr.token,
            Transaction.ioToken.p2_sys_pay_tx_exp_addr.token)
    });


    /**
     * Class constructor
     * @param {Device} owningDevice Object of type Device identifying the device that owns the asset to in-migrate
     * @param {Asset} asset The Catenis asset the amount of which is to be in-migrated
     * @param {number} amount Amount of asset to be in-migrated expressed as an integer number of the asset's smallest
     *                         division (according to the asset divisibility)
     */
    constructor(owningDevice, asset, amount) {
        if (owningDevice !== undefined) {
            // Validate arguments
            const errArg = {};

            if (!(owningDevice instanceof Device)) {
                errArg.owningDevice = owningDevice;
            }

            if (!(asset instanceof Asset)) {
                errArg.assetId = assetId;
            }

            if (typeof amount !== 'number' || amount <= 0) {
                errArg.amount = amount;
            }

            if (Object.keys(errArg).length > 0) {
                const errArgs = Object.keys(errArg);

                Catenis.logger.ERROR(util.format('InMigrateAssetTransaction constructor called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
                throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
            }

            // Just initialize instance variables for now
            this.ccTransact = new CCTransaction();
            this.txBuilt = false;
            this.owningDevice = owningDevice;
            this.asset = asset;
            this.amount = amount;
            this.changeAmount = undefined;

            // Make sure that owning device has enough of the specified amount to in-migrate
            const devMigratedAssetBalance = this.owningDevice.migratedAssetBalance(this.asset);
            this.prevTotalMigratedBalance = 0;

            if (devMigratedAssetBalance === undefined || (this.prevTotalMigratedBalance = devMigratedAssetBalance.total) < this.amount) {
                // Insufficient migrated asset balance to in-migrate asset
                Catenis.logger.ERROR('Insufficient migrated asset balance to in-migrate asset', {
                    owningDeviceId: this.owningDevice.deviceId,
                    assetId: this.asset.assetId,
                    amountToInMigrate: this.asset.formatAmount(this.amount),
                    migratedBalance: devMigratedAssetBalance !== undefined ? this.asset.formatAmount(devMigratedAssetBalance.total) : undefined
                });
                throw new Meteor.Error('ctn_in_mgr_low_mgr_asset_balance', 'Insufficient migrated asset balance to in-migrate asset');
            }
        }
    }


    // Public object properties (getters/setters)
    //

    get txid() {
        return this.ccTransact.txid;
    }

    get innerTransact() {
        return this.ccTransact;
    }

    get assetId() {
        return this.asset.assetId;
    }


    // Public object methods
    //

    buildTransaction() {
        if (!this.txBuilt) {
            // Add Colored Coins related transaction inputs and outputs
            //

            // Add Colored Coins asset in-migration inputs

            // Try to allocate (Colored Coins) asset amount to transfer
            const devMigratedAssetAddrFundSource = new CCFundSource(this.asset.ccAssetId, this.owningDevice.migratedAssetAddr.listAddressesInUse(), {
                useUnconfirmedUtxo: true,
                unconfUtxoInfo: {
                    initTxInputs: this.ccTransact.inputs
                },
                smallestChange: true
            });
            const devMigratedAssetAddrAllocResult = devMigratedAssetAddrFundSource.allocateFund(this.amount);

            // Make sure that Colored Coins UTXOs have been correctly allocated
            if (devMigratedAssetAddrAllocResult === null) {
                // Unable to allocate Colored Coins UTXOs. Log error condition and throw exception
                Catenis.logger.ERROR('Unable to allocate Colored Coins (ccAssetId: %s) UTXOs for device (deviceId: %s) asset addresses', this.asset.ccAssetId, this.owningDevice.deviceId);
                throw new Meteor.Error('ctn_in_mgr_asset_ccutxo_alloc_error', util.format('Unable to allocate Colored Coins (ccAssetId: %d) UTXOs for device (deviceId: %s) asset addresses', this.asset.ccAssetId, this.owningDevice.deviceId));
            }

            // Save asset change amount
            this.changeAmount = devMigratedAssetAddrAllocResult.changeAssetAmount;

            // Add owning device migrated asset address inputs
            this.ccTransact.addTransferInputs(devMigratedAssetAddrAllocResult.utxos.map((utxo) => {
                return {
                    txout: utxo.txout,
                    isWitness: utxo.isWitness,
                    scriptPubKey: utxo.scriptPubKey,
                    address: utxo.address,
                    addrInfo: Catenis.keyStore.getAddressInfo(utxo.address)
                }
            }));

            // Add Colored Coins asset in-migration outputs

            // Owning device asset address output
            this.ccTransact.setTransferOutput(this.owningDevice.assetAddr.newAddressKeys().getAddress(), this.amount, 0);

            if (this.changeAmount > 0) {
                // Owning device migrated asset address change output
                this.ccTransact.setTransferOutput(this.owningDevice.migratedAssetAddr.newAddressKeys().getAddress(), this.changeAmount, 0);
            }

            // Pre-allocate multi-signature signee address
            const multiSigSigneeAddr = this.owningDevice.client.ctnNode.multiSigSigneeAddr.newAddressKeys().getAddress();

            // Assemble Colored Coins transaction
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
            const txChangeOutputType = BitcoinInfo.getOutputTypeByAddressType(this.owningDevice.client.ctnNode.payTxExpenseAddr.btcAddressType);
            let payTxAllocResult;

            do {
                retryPayTxExpense = false;

                const payTxFundSource = new FundSource(this.owningDevice.client.ctnNode.payTxExpenseAddr.listAddressesInUse(), {
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
                }, false, Catenis.bitcoinFees.getFeeRateByTime(Service.minutesToConfirmAssetOutMigration));

                if (payTxAllocResult === null) {
                    // Unable to allocate UTXOs
                    if (!payTxExpAddrsRefunded && this.owningDevice.client.ctnNode.checkPayTxExpenseFundingBalance()) {
                        // Try to refund addresses used to pay to transaction expense
                        Catenis.logger.WARN('Not enough UTXOs available to pay for in-migrate asset tx expense. Refunding pay tx expense addresses to try again');
                        payTxExpAddrsRefunded = true;
                        retryPayTxExpense = true;
                    }
                    else {
                        // Log error condition and throw exception
                        Catenis.logger.ERROR('No UTXO available to be allocated to pay for in-migrate asset tx expense');
                        throw new Meteor.Error('ctn_in_mgr_asset_no_utxo_pay_tx_expense', 'No UTXO available to be allocated to pay for in-migrate asset tx expense');
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
                this.ccTransact.addPubKeyHashOutput(this.owningDevice.client.ctnNode.payTxExpenseAddr.newAddressKeys().getAddress(), payTxAllocResult.changeAmount);
            }

            // Indicate that transaction is already built
            this.txBuilt = true;
        }
    }

    /**
     * @return {string} Blockchain ID of sent transaction
     */
    sendTransaction() {
        // Make sure that transaction is already built
        if (this.txBuilt) {
            // Check if transaction has not yet been created and sent
            if (this.ccTransact.txid === undefined) {
                this.ccTransact.sendTransaction();

                // Save sent transaction onto local database
                this.ccTransact.saveSentTransaction(Transaction.type.in_migrate_asset, {
                    assetId: this.asset.assetId,
                    owningDeviceId: this.owningDevice.deviceId,
                    amount: this.amount,
                    changeAmount: this.changeAmount
                });

                // Force update of Colored Coins data associated with UTXOs
                Catenis.c3NodeClient.parseNow();

                // Check if system pay tx expense addresses need to be refunded
                this.owningDevice.client.ctnNode.checkPayTxExpenseFundingBalance();
            }

            return this.ccTransact.txid;
        }
    }

    revertOutputAddresses() {
        if (this.txBuilt) {
            this.ccTransact.revertOutputAddresses();
        }
    }

    // Class (public) methods
    //

    /**
     * Determines if transaction is a valid Catenis In-Migrate Asset transaction
     * @param {CCTransaction} ccTransact Object of type CCTransaction identifying the transaction to be checked
     * @return {(InMigrateAssetTransaction|undefined)} The created In-Migrate Asset transaction instance, or
     *                                                   undefined if the transaction is not valid
     */
    static checkTransaction(ccTransact) {
        let inMigrateAssetTransact = undefined;

        // First, check if pattern of transaction's inputs and outputs is consistent
        if ((ccTransact instanceof CCTransaction) && ccTransact.matches(InMigrateAssetTransaction)) {
            // Make sure that this is a Colored Coins transaction that does not issue asset, with exactly one transfer
            //  input sequence and one or two transfer output
            if (ccTransact.issuingInfo === undefined && ccTransact.transferInputSeqs.length === 1
                && (ccTransact.transferOutputs.length === 1 || ccTransact.transferOutputs.length === 2)) {
                // Validate and identify input and output addresses
                //  NOTE: no need to check if the variables below are non-null because the transact.matches()
                //      result above already guarantees it
                const ownDevMigratedAssetAddrs = [];
                let nextInputPos = 0;
                let done = false,
                    error = false;

                do {
                    const inputAddr = getAddrAndAddrInfo(ccTransact.getInputAt(nextInputPos++));

                    if (inputAddr.addrInfo.type === KeyStore.extKeyType.dev_asst_addr.name) {
                        // Make sure that all migrated asset address inputs are from the same device
                        if (ownDevMigratedAssetAddrs.length === 0 || areAddressesFromSameDevice(ownDevMigratedAssetAddrs[0].addrInfo, inputAddr.addrInfo)) {
                            ownDevMigratedAssetAddrs.push(inputAddr);
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
                    const ownDevAssetAddr = getAddrAndAddrInfo(ccTransact.getOutputAt(nextOutPos++).payInfo);

                    const changeOutput = ccTransact.getOutputAt(nextOutPos);
                    let ownDevMigratedAssetAddrChange;

                    if (changeOutput !== undefined) {
                        const outputAddr = getAddrAndAddrInfo(changeOutput.payInfo);

                        if (outputAddr.addrInfo.type === KeyStore.extKeyType.dev_migr_asst_addr.name) {
                            ownDevMigratedAssetAddrChange = outputAddr;
                        }
                    }

                    if (ownDevMigratedAssetAddrChange === undefined || areAddressesFromSameDevice(ownDevMigratedAssetAddrs[0].addrInfo, ownDevMigratedAssetAddrChange.addrInfo)) {
                        // Instantiate in-migrate asset transaction
                        inMigrateAssetTransact = new InMigrateAssetTransaction();

                        inMigrateAssetTransact.ccTransact = ccTransact;
                        inMigrateAssetTransact.owningDevice = CatenisNode.getCatenisNodeByIndex(ownDevMigratedAssetAddrs[0].addrInfo.pathParts.ctnNodeIndex).getClientByIndex(ownDevMigratedAssetAddrs[0].addrInfo.pathParts.clientIndex).getDeviceByIndex(ownDevMigratedAssetAddrs[0].addrInfo.pathParts.deviceIndex);
                        inMigrateAssetTransact.asset = Asset.getAssetByAssetId(Asset.getAssetIdFromCcTransaction(ccTransact));
                        inMigrateAssetTransact.amount = ccTransact.transferOutputs[0].assetAmount;
                        inMigrateAssetTransact.changeAmount = changeOutput !== undefined ? changeOutput.payInfo.assetAmount : 0;
                    }
                }
            }
        }

        return inMigrateAssetTransact;
    }
}


// Module code
//

// Lock class
Object.freeze(InMigrateAssetTransaction);
