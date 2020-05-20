/**
 * Created by Claudio on 2018-03-13.
 */

//console.log('[IssueAssetTransaction.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import util from 'util';
// Third-party node modules
//import config from 'config';
import BigNumber from 'bignumber.js';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Device } from './Device';
import { Catenis } from './Catenis';
import { CCTransaction } from './CCTransaction';
import {
    Asset,
    cfgSettings as assetCfgSetting
} from './Asset';
import { CCMetadata } from './CCMetadata';
import { BaseBlockchainAddress } from './BaseBlockchainAddress';
import { Service } from './Service';
import { FundSource } from './FundSource';
import { Transaction } from './Transaction';
import { KeyStore } from './KeyStore';
import {
    getAddrAndAddrInfo,
    areAddressesFromSameDevice
} from './SendMessageTransaction';
import { CatenisNode } from './CatenisNode';
import { BitcoinInfo } from './BitcoinInfo';

// Config entries
/*const config_entryConfig = config.get('config_entry');

// Configuration settings
const cfgSettings = {
    property: config_entryConfig.get('property_name')
};*/


// Definition of function classes
//

// IssueAssetTransaction function class
//
//  Constructor arguments:
//    issuingDevice: [Object(Device)] - Object of type Device identifying the device that is issuing the asset
//    holdingDevice: [Object(Device)] - Object of type Device identifying the device for which the asset is being issued
//                                       and that shall hold the total amount of asset issued
//    amount: [Number]      - Amount of asset to be issued (expressed as a fractional amount)
//    assetInfo: [Object|String] { - An object describing the new asset to be created, or the ID of an existing (unlocked) asset
//      name: [String], - The name of the asset
//      description: [String], - (optional) The description of the asset
//      canReissue: [Boolean], - Indicates whether more units of this asset can be issued at another time (an unlocked asset)
//      decimalPlaces: [Number] - The number of decimal places that are used to specify a fractional amount of this asset
//    }
//
// NOTE: make sure that objects of this function class are instantiated and used (their methods
//  called) from code executed from the FundSource.utxoCS critical section object
export function IssueAssetTransaction(issuingDevice, holdingDevice, amount, assetInfo) {
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

    if (issuingDevice !== undefined) {
        // Validate arguments
        const errArg = {};

        if (!(issuingDevice instanceof Device)) {
            errArg.issuingDevice = issuingDevice;
        }

        if (!(holdingDevice instanceof Device)) {
            errArg.holdingDevice = holdingDevice;
        }

        this.assetId = undefined;
        this.asset = undefined;

        if (typeof assetInfo === 'object') {
            if (assetInfo === null || (typeof assetInfo.description !== 'string' && assetInfo.description !== undefined)
                    || typeof assetInfo.canReissue !== 'boolean' || typeof assetInfo.decimalPlaces !== 'number'
                    || assetInfo.decimalPlaces < 0 || assetInfo.decimalPlaces > CCTransaction.largestDivisibility) {
                errArg.assetInfo = assetInfo;
            }
        }
        else if (typeof assetInfo === 'string') {
            // The assetInfo argument is actually an asset ID. Try to retrieve it
            this.assetId = assetInfo;

            this.asset = Asset.getAssetByAssetId(this.assetId, true);

            // Asset exists (otherwise ctn_asset_not_found exception is thrown)
        }
        else {
            errArg.assetInfo = assetInfo;
        }

        if (typeof amount !== 'number' || amount <= 0) {
            errArg.amount = amount;
        }

        if (Object.keys(errArg).length > 0) {
            const errArgs = Object.keys(errArg);

            Catenis.logger.ERROR(util.format('IssueAssetTransaction constructor called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
            throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
        }

        // Just initialize instance variables for now
        this.ccTransact = new CCTransaction();
        this.txBuilt = false;
        this.issuingDevice = issuingDevice;
        this.holdingDevice = holdingDevice;
        this.amount = Asset.amountToSmallestDivisionAmount(amount, this.asset ? this.asset.divisibility : assetInfo.decimalPlaces);

        if (Number.isNaN(this.amount)) {
            // Amount to be issued is too large. Log error and throw exception
            Catenis.logger.ERROR('Amount requested to be issued is larger than maximum allowed total asset amount', {
                amount: amount
            });
            throw new Meteor.Error('ctn_issue_asset_amount_too_large', util.format('Amount requested to be issued (%d) is larger than maximum allowed total asset amount', amount));
        }
        
        if (this.asset) {
            // Request to reissue an amount of an existing asset

            // Make sure that asset can be reissued and that the issuing device is the original issuing device
            if (this.asset.issuingType !== CCTransaction.issuingAssetType.unlocked) {
                Catenis.logger.ERROR('Trying to reissue a locked asset', {
                    assetId: this.assetId
                });
                throw new Meteor.Error('ctn_issue_asset_reissue_locked', util.format('Trying to reissue a locked asset (assetId: %s)', this.assetId));
            }

            if (this.asset.issuingDevice.deviceId !== this.issuingDevice.deviceId) {
                Catenis.logger.ERROR('Device trying to reissue asset is not the same as the original issuing device', {
                    assetId: this.assetId,
                    assetIssuingDeviceId: this.asset.issuingDevice.deviceId,
                    issuingDeviceId: this.issuingDevice.deviceId
                });
                throw new Meteor.Error('ctn_issue_asset_invalid_issuer', util.format('Device (deviceId %s) trying to reissue asset (assetId: %s) is not the same as the original issuing device (deviceId: %s)', this.issuingDevice.deviceId, this.assetId, this.asset.issuingDevice.deviceId));
            }

            // Make sure that total amount of asset issued does not surpass the largest allowed asset amount
            const assetBalance = Catenis.c3NodeClient.getAssetBalance(this.asset.ccAssetId);
            this.bnPrevTotalExistentBalance = new BigNumber(0);

            if (assetBalance !== undefined && (this.bnPrevTotalExistentBalance = this.asset.amountToSmallestDivisionAmount(assetBalance.total, true)).plus(this.amount).isGreaterThan(assetCfgSetting.largestAssetAmount)) {
                // Amount to be issued is too large. Log error and throw exception
                Catenis.logger.ERROR('Amount requested to be issued would exceed maximum allowed total asset amount', {
                    assetId: this.assetId
                });
                throw new Meteor.Error('ctn_issue_asset_amount_too_large', util.format('Amount requested to be issued would exceed maximum allowed total asset (assetId: %s) amount', this.assetId));
            }

            // OK to reissue asset. Save asset issuance address and the asset info
            this.assetIssuanceAddr = this.asset.issuanceAddress;
            this.assetInfo = {
                name: this.asset.name,
                description: this.asset.description,
                issuingOpts: {
                    type: this.asset.issuingType,
                    divisibility: this.asset.divisibility,
                    isAggregatable: this.asset.isAggregatable
                }
            };
        }
        else {
            // Request to issue an amount of a new asset. Save the asset info
            this.assetInfo = {
                name: assetInfo.name,
                description: assetInfo.description,
                issuingOpts: {
                    type: assetInfo.canReissue ? CCTransaction.issuingAssetType.unlocked : CCTransaction.issuingAssetType.locked,
                    divisibility: assetInfo.decimalPlaces,
                    isAggregatable: CCTransaction.aggregationPolicy.aggregatable
                }
            };
        }
    }
}


// Public IssueAssetTransaction object methods
//

IssueAssetTransaction.prototype.buildTransaction = function () {
    if (!this.txBuilt) {
        // Add Colored Coins related transaction inputs and outputs
        //

        // Get device asset issuance address
        const devAssetIssueAddr = this.assetIssuanceAddr ? this.assetIssuanceAddr : this.issuingDevice.getAssetIssuanceAddressesInUseExcludeUnlocked();

        // Prepare to add Colored Coins asset issuing input
        const devAssetIssueAddrFundSource = new FundSource(devAssetIssueAddr, {
            useUnconfirmedUtxo: true,
            unconfUtxoInfo: {
                initTxInputs: this.ccTransact.inputs
            }
        });
        const devAssetIssueAddrAllocResult = devAssetIssueAddrFundSource.allocateFund(Service.devAssetIssuanceAddrAmount(typeof devAssetIssueAddr === 'string' ? devAssetIssueAddr : undefined));

        // Make sure that UTXOs have been correctly allocated
        if (devAssetIssueAddrAllocResult === null) {
            // Unable to allocate UTXOs. Log error condition and throw exception
            Catenis.logger.ERROR('Unable to allocate UTXOs for device (deviceId: %s) asset issuance addresses', this.issuingDevice.deviceId);
            throw new Meteor.Error('ctn_issue_asset_utxo_alloc_error', util.format('Unable to allocate UTXOs for device (deviceId: %s) asset issuance addresses', this.issuingDevice.deviceId));
        }

        if (devAssetIssueAddrAllocResult.utxos.length !== 1) {
            // An unexpected number of UTXOs have been allocated.
            //  Log error condition and throw exception
            Catenis.logger.ERROR('An unexpected number of UTXOs have been allocated for device (deviceId: %s) asset issuance address', this.issuingDevice.deviceId, {
                expected: 1,
                allocated: devAssetIssueAddrAllocResult.utxos.length
            });
            throw new Meteor.Error('ctn_issue_asset_utxo_alloc_error', util.format('An unexpected number of UTXOs have been allocated for device (deviceId: %s) asset issuance address: expected: 1, allocated: %d', this.issuingDevice.deviceId, devAssetIssueAddrAllocResult.utxos.length));
        }

        const devAssetIssueAddrAllocUtxo = devAssetIssueAddrAllocResult.utxos[0];

        // Add Colored Coins asset issuing input
        this.ccTransact.addIssuingInput(devAssetIssueAddrAllocUtxo.txout, {
            isWitness: devAssetIssueAddrAllocUtxo.isWitness,
            scriptPubKey: devAssetIssueAddrAllocUtxo.scriptPubKey,
            address: devAssetIssueAddrAllocUtxo.address,
            addrInfo: Catenis.keyStore.getAddressInfo(devAssetIssueAddrAllocUtxo.address)
        }, this.amount, this.assetInfo.issuingOpts);

        // Add Colored Coins asset transfer output
        this.ccTransact.setTransferOutput(this.holdingDevice.assetAddr.newAddressKeys().getAddress(), this.amount, 0);

        // Prepare to add Colored Coins asset metadata
        const ccMetadata = new CCMetadata();

        ccMetadata.setAssetMetadata({
            ctnAssetId: this.assetId ? this.assetId : Asset.getAssetIdFromCcTransaction(this.ccTransact),
            name: this.assetInfo.name,
            description: this.assetInfo.description
        });

        // Add Colored Coins asset metadata
        this.ccTransact.setCcMetadata(ccMetadata);

        // Pre-allocate multi-signature signee address
        const multiSigSigneeAddr = this.issuingDevice.client.ctnNode.multiSigSigneeAddr.newAddressKeys().getAddress();

        // Assemble Colored Coins transaction
        this.ccTransact.assemble(multiSigSigneeAddr);

        if (!this.ccTransact.includesMultiSigOutput) {
            // Revert pre-allocated multi-signature signee address
            BaseBlockchainAddress.revertAddress(multiSigSigneeAddr);
        }

        if (this.assetInfo.description === undefined) {
            // Update asset description from (assembled) Colored Coins metadata
            this.assetInfo.description = ccMetadata.metadata.description;
        }

        // Finalize transaction
        //

        // Add additional required outputs

        if (this.asset || this.assetInfo.issuingOpts.type === CCTransaction.issuingAssetType.unlocked) {
            // Issuing an unlocked asset. Add issuing device asset issuance address #1 refund output
            const addrAmount = Service.devAssetIssuanceAddrAmount(devAssetIssueAddrAllocUtxo.address);
            this.ccTransact.addPubKeyHashOutput(devAssetIssueAddrAllocUtxo.address, addrAmount);

            const changeAmount = this.asset ? devAssetIssueAddrAllocResult.changeAmount : Service.deviceAssetProvisionCost(devAssetIssueAddrAllocUtxo.address) - addrAmount;

            // NOTE: we do not care to check if change is not below dust amount because it is guaranteed
            //      that the change amount be a multiple of the basic amount that is allocated to device
            //      asset issuance addresses which in turn is guaranteed to not be below dust
            if (changeAmount > 0) {
                // Add issuing device asset issuance address #1 change output
                this.ccTransact.addPubKeyHashOutput(devAssetIssueAddrAllocUtxo.address, changeAmount);
            }
        }

        if (!this.asset) {
            // Not reissuing an asset. Add issuing device asset issuance address #2 refund output
            this.ccTransact.addPubKeyHashOutput(this.issuingDevice.assetIssuanceAddr.newAddressKeys().getAddress(), Service.devAssetIssuanceAddrAmount());

            // NOTE: we do not care to check if change is not below dust amount because it is guaranteed
            //      that the change amount be a multiple of the basic amount that is allocated to device
            //      asset issuance addresses which in turn is guaranteed to not be below dust
            if (devAssetIssueAddrAllocResult.changeAmount > 0) {
                // Add issuing device asset issuance address #3 change output
                this.ccTransact.addPubKeyHashOutput(this.issuingDevice.assetIssuanceAddr.newAddressKeys().getAddress(), devAssetIssueAddrAllocResult.changeAmount);
            }
        }

        // Now, allocate UTXOs to pay for tx expense
        let retryPayTxExpense;
        let payTxExpAddrsRefunded = false;
        const txChangeOutputType = BitcoinInfo.getOutputTypeByAddressType(this.issuingDevice.client.ctnNode.payTxExpenseAddr.btcAddressType);
        let payTxAllocResult;

        do {
            retryPayTxExpense = false;

            const payTxFundSource = new FundSource(this.issuingDevice.client.ctnNode.payTxExpenseAddr.listAddressesInUse(), {
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
            }, false, Catenis.bitcoinFees.getFeeRateByTime(Service.minutesToConfirmAssetIssuance));

            if (payTxAllocResult === null) {
                // Unable to allocate UTXOs
                if (!payTxExpAddrsRefunded && this.issuingDevice.client.ctnNode.checkPayTxExpenseFundingBalance()) {
                    // Try to refund addresses used to pay to transaction expense
                    Catenis.logger.WARN('Not enough UTXOs available to pay for issue asset tx expense. Refunding pay tx expense addresses to try again');
                    payTxExpAddrsRefunded = true;
                    retryPayTxExpense = true;
                }
                else {
                    // Log error condition and throw exception
                    Catenis.logger.ERROR('No UTXO available to be allocated to pay for issue asset tx expense');
                    throw new Meteor.Error('ctn_issue_asset_no_utxo_pay_tx_expense', 'No UTXO available to be allocated to pay for issue asset tx expense');
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
            this.ccTransact.addPubKeyHashOutput(this.issuingDevice.client.ctnNode.payTxExpenseAddr.newAddressKeys().getAddress(), payTxAllocResult.changeAmount);
        }

        // Indicate that transaction is already built
        this.txBuilt = true;
    }
};

// Return:
//   txid: [String] - Blockchain ID of sent transaction
IssueAssetTransaction.prototype.sendTransaction = function () {
    // Make sure that transaction is already built
    if (this.txBuilt) {
        // Check if transaction has not yet been created and sent
        if (this.ccTransact.txid === undefined) {
            // Make sure that blockchain is not polled and processing of newly sent tx is
            //  not done until sent transaction is properly recorded into the local database.
            //
            //  NOTE: the main reason why we do this for this specific case (and not for most of
            //      the other transactions we send) is that it may required to do other database
            //      access tasks (to create new Asset doc/rec) before the transaction is saved
            //      onto the database.
            try {
                Catenis.txMonitor.pausePoll();

                this.ccTransact.sendTransaction();

                // Create Asset database doc/rec if it does not yet exist (newly issued asset)
                if (!this.asset) {
                    this.assetId = Asset.createAsset(this.ccTransact, this.assetInfo.name, this.assetInfo.description);
                    this.asset = Asset.getAssetByAssetId(this.assetId);
                }

                // Save sent transaction onto local database
                this.ccTransact.saveSentTransaction(Transaction.type.issue_asset, {
                    assetId: this.assetId,
                    issuingDeviceId: this.issuingDevice.deviceId,
                    holdingDeviceId: this.holdingDevice.deviceId,
                    amount: this.amount
                });
            }
            finally {
                Catenis.txMonitor.unpausePoll();
            }

            // Force update of Colored Coins data associated with UTXOs
            Catenis.c3NodeClient.parseNow();

            // Check if system pay tx expense addresses need to be refunded
            this.issuingDevice.client.ctnNode.checkPayTxExpenseFundingBalance();
        }

        return this.ccTransact.txid;
    }
};

IssueAssetTransaction.prototype.revertOutputAddresses = function () {
    if (this.txBuilt) {
        this.ccTransact.revertOutputAddresses();
    }
};


// Module functions used to simulate private IssueAssetTransaction object methods
//  NOTE: these functions need to be bound to a IssueAssetTransaction object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// IssueAssetTransaction function class (public) methods
//

// Determines if transaction is a valid Catenis Issue Asset transaction
//
//  Arguments:
//    ccTransact: [Object] // Object of type CCTransaction identifying the transaction to be checked
//
//  Return:
//    - If transaction is not valid: undefined
//    - If transaction is valid: Object of type IssueAssetTransaction created from transaction
//
IssueAssetTransaction.checkTransaction = function (ccTransact) {
    let issueAssetTransact = undefined;

    // First, check if pattern of transaction's inputs and outputs is consistent
    if ((ccTransact instanceof CCTransaction) && ccTransact.matches(IssueAssetTransaction)) {
        // Make sure that this is a Colored Coins transaction that issues asset, with no transfer input sequences
        //  and exactly one transfer output, and with a valid metadata if present
        if (ccTransact.issuingInfo !== undefined && ccTransact.transferInputSeqs.length === 0 && ccTransact.transferOutputs.length === 1
                && (ccTransact.ccMetadata === undefined || ccTransact.ccMetadata.ctnAssetId !== undefined)) {
            // Validate and identify input and output addresses
            //  NOTE: no need to check if the variables below are non-null because the transact.matches()
            //      result above already guarantees it
            const devAssetIssueAddr = getAddrAndAddrInfo(ccTransact.getInputAt(0));

            let nextOutPos = ccTransact.includesMultiSigOutput ? 2 : 1;
            const holdDevAssetAddr = getAddrAndAddrInfo(ccTransact.getOutputAt(nextOutPos++).payInfo);

            const devAssetIssueRefundChangeAddrs = [];
            let done = false,
                error = false;

            do {
                const output = ccTransact.getOutputAt(nextOutPos++);

                if (output !== undefined) {
                    const outputAddr = getAddrAndAddrInfo(output.payInfo);

                    if (outputAddr.addrInfo.type === KeyStore.extKeyType.dev_asst_issu_addr.name) {
                        // Make sure that it is consistent with issuing address input
                        if (areAddressesFromSameDevice(devAssetIssueAddr.addrInfo, outputAddr.addrInfo)) {
                            devAssetIssueRefundChangeAddrs.push(outputAddr);
                        }
                        else {
                            error = true;
                        }
                    }
                    else {
                        done = true;
                    }
                }
                else {
                    done = true;
                }
            }
            while (!done && !error);

            if (!error && devAssetIssueRefundChangeAddrs.length > 2) {
                for (let idx = 0, limit = devAssetIssueRefundChangeAddrs.length - 2; idx < limit; idx++) {
                    if (devAssetIssueRefundChangeAddrs[idx].address !== devAssetIssueAddr.address) {
                        error = true;
                        break;
                    }
                }
            }

            if (!error) {
                // Instantiate issue asset transaction
                issueAssetTransact = new IssueAssetTransaction();

                issueAssetTransact.ccTransact = ccTransact;
                issueAssetTransact.issuingDevice = CatenisNode.getCatenisNodeByIndex(devAssetIssueAddr.addrInfo.pathParts.ctnNodeIndex).getClientByIndex(devAssetIssueAddr.addrInfo.pathParts.clientIndex).getDeviceByIndex(devAssetIssueAddr.addrInfo.pathParts.deviceIndex);
                issueAssetTransact.holdingDevice = CatenisNode.getCatenisNodeByIndex(holdDevAssetAddr.addrInfo.pathParts.ctnNodeIndex).getClientByIndex(holdDevAssetAddr.addrInfo.pathParts.clientIndex).getDeviceByIndex(holdDevAssetAddr.addrInfo.pathParts.deviceIndex);
                issueAssetTransact.amount = ccTransact.issuingInfo.assetAmount;
                issueAssetTransact.assetId = Asset.getAssetIdFromCcTransaction(ccTransact);

                issueAssetTransact.asset = undefined;
                
                try {
                    issueAssetTransact.asset = Asset.getAssetByAssetId(issueAssetTransact.assetId);
                }
                catch (err) {
                    if (!((err instanceof Meteor.Error) && err.error === 'ctn_asset_not_found')) {
                        throw err;
                    }
                }
                
                if (issueAssetTransact.asset) {
                    // Asset already defined in local database, so used to get asset info
                    issueAssetTransact.assetInfo = {
                        name: issueAssetTransact.asset.name,
                        description: issueAssetTransact.asset.description,
                        issuingOpts: {
                            type: issueAssetTransact.asset.issuingType,
                            divisibility: issueAssetTransact.asset.divisibility,
                            isAggregatable: issueAssetTransact.asset.isAggregatable
                        }
                    };
                }
                else {
                    // Asset not yet defined in local database. Try to get asset name
                    //  and description from Colored Coins metadata
                    issueAssetTransact.assetInfo = {};

                    if (ccTransact.ccMetadata !== undefined) {
                        issueAssetTransact.assetInfo.name = ccTransact.ccMetadata.assetName;
                        issueAssetTransact.assetInfo.description = ccTransact.ccMetadata
                    }
                    else {
                        // Issue asset transaction missing Colored Coins metadata.
                        //  Log warning condition
                        Catenis.logger.WARN('Issue asset transaction missing Colored Coins metadata', {
                            txid: ccTransact.txid
                        });
                    }

                    // Get the remainder from the Colored Coins transaction itself
                    issueAssetTransact.assetInfo.issuingOpts = {
                        type: ccTransact.issuingInfo.type,
                        divisibility: ccTransact.issuingInfo.divisibility,
                        isAggregatable: ccTransact.issuingInfo.isAggregatable
                    };
                }
            }
        }
    }

    return issueAssetTransact;
};


// IssueAssetTransaction function class (public) properties
//

IssueAssetTransaction.matchingPattern = Object.freeze({
    input: util.format('^(?:%s)(?:%s)+$',
        Transaction.ioToken.p2_dev_asst_issu_addr.token,
        Transaction.ioToken.p2_sys_pay_tx_exp_addr.token),
    output: util.format('^(?:(?:%s)(?:%s)(?:%s){1,2}(?:%s))?(?:%s)(?:%s)(?:%s){1,4}(?:%s)?$',
        Transaction.ioToken.multisig_start.token,
        Transaction.ioToken.p2_sys_msig_sign_addr.token,
        Transaction.ioToken.p2_unknown_addr.token,
        Transaction.ioToken.multisig_end.token,
        Transaction.ioToken.null_data.token,
        Transaction.ioToken.p2_dev_asst_addr.token,
        Transaction.ioToken.p2_dev_asst_issu_addr.token,
        Transaction.ioToken.p2_sys_pay_tx_exp_addr.token)
});


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(IssueAssetTransaction);
