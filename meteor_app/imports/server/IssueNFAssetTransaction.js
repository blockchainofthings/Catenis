/**
 * Created by claudio on 2022-04-25
 */

//console.log('[IssueNFAssetTransaction.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import util from 'util';
// Third-party node modules
import BigNumber from 'bignumber.js';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { NFAssetIssuance } from './NFAssetIssuance';
import { CCTransaction } from './CCTransaction';
import { Device } from './Device';
import {
    Asset,
    cfgSettings as assetCfgSetting
} from './Asset';
import { Transaction } from './Transaction';
import { FundSource } from './FundSource';
import { Service } from './Service';
import { CCMetadata } from './CCMetadata';
import { BaseBlockchainAddress } from './BaseBlockchainAddress';
import { BitcoinInfo } from './BitcoinInfo';
import { NonFungibleToken } from './NonFungibleToken';
import { areAddressesFromSameDevice, getAddrAndAddrInfo } from './SendMessageTransaction';
import { KeyStore } from './KeyStore';
import { CatenisNode } from './CatenisNode';


// Definition of classes
//

/**
 * Issue Non-Fungible Asset transaction class
 */
export class IssueNFAssetTransaction {
    /**
     * Regular expression for matching this transaction type
     * @type {Readonly<{output: string, input: string}>}
     */
    static matchingPattern = Object.freeze({
        input: util.format('^(?:%s)(?:%s)+$',
            Transaction.ioToken.p2_dev_asst_issu_addr.token,
            Transaction.ioToken.p2_sys_pay_tx_exp_addr.token),
        output: util.format('^(?:%s)*(?:(?:%s)(?:%s)(?:%s){1,2}(?:%s))?(?:%s)(?:%s)?(?:%s){1,4}(?:%s)?$',
            Transaction.ioToken.p2_dev_asst_addr.token,
            Transaction.ioToken.multisig_start.token,
            Transaction.ioToken.p2_sys_msig_sign_addr.token,
            Transaction.ioToken.p2_unknown_addr.token,
            Transaction.ioToken.multisig_end.token,
            Transaction.ioToken.null_data.token,
            Transaction.ioToken.p2_dev_asst_addr.token,
            Transaction.ioToken.p2_dev_asst_issu_addr.token,
            Transaction.ioToken.p2_sys_pay_tx_exp_addr.token)
    });

    /**
     * Class constructor
     * @param {Device} [issuingDevice] Device that is issuing the asset
     * @param {NFAssetIssuance} [nfAssetIssuance] Non-fungible asset issuance object
     */
    constructor(issuingDevice, nfAssetIssuance) {
        if (issuingDevice) {
            //  Validate arguments
            const errArg = {};

            if (!(issuingDevice instanceof Device)) {
                errArg.issuingDevice = issuingDevice;
            }

            if (!(nfAssetIssuance instanceof NFAssetIssuance)) {
                errArg.nfAssetIssuance = nfAssetIssuance;
            }

            if (Object.keys(errArg).length > 0) {
                const errArgs = Object.keys(errArg);

                Catenis.logger.ERROR(`IssueNFAssetTransaction constructor called with invalid argument${errArgs.length > 1 ? 's' : ''}`, errArg);
                throw new TypeError(`Invalid ${errArgs.join(', ')} argument${errArgs.length > 1 ? 's' : ''}`);
            }

            // Make sure that issuing device is consistent with non-fungible asset issuance
            if (issuingDevice.deviceId !== nfAssetIssuance.deviceId) {
                Catenis.logger.ERROR('IssueNFAssetTransaction constructor: issuing device is not consistent with non-fungible asset issuance object', {
                    issuingDeviceId: issuingDevice.deviceId,
                    nfAssetIssuance
                });
                throw new Error('IssueNFAssetTransaction constructor: issuing device is not consistent with non-fungible asset issuance object');
            }

            this.nfAssetIssuance = nfAssetIssuance;
            this.issuingDevice = issuingDevice;
            this.nfTokenQuantity = nfAssetIssuance.nonFungibleToken.quantity;

            // Save devices that will hold the newly issued non-fungible tokens making
            //  sure that there are no more holding devices than the number of tokens
            this.holdingDevices = [];

            for (let idx = 0, limit = Math.min(nfAssetIssuance.holdingDeviceIds.length, this.nfTokenQuantity); idx < limit; idx++) {
                this.holdingDevices.push(Device.getDeviceByDeviceId(nfAssetIssuance.holdingDeviceIds[idx]));
            }

            this.assetId = undefined;
            this.asset = undefined;

            if (nfAssetIssuance.isReissuance) {
                // Reissuing an existing non-fungible asset
                this.assetId = nfAssetIssuance.assetId;
                this.asset = Asset.getAssetByAssetId(this.assetId, true);

                // Make sure that total asset amount (quantity of issued non-fungible tokens) does not surpass the
                //  largest allowed asset amount
                const assetBalance = Catenis.c3NodeClient.getAssetBalance(this.asset.ccAssetId);

                if (assetBalance !== undefined && new BigNumber(assetBalance.total).plus(this.nfTokenQuantity).isGreaterThan(assetCfgSetting.largestAssetAmount)) {
                    // Amount to be issued is too large. Log error and throw exception
                    Catenis.logger.ERROR('Amount requested to be issued would exceed maximum allowed total asset amount', {
                        assetId: this.assetId
                    });
                    throw new Meteor.Error('ctn_issue_nf_asset_amount_too_large', `Amount requested to be issued would exceed maximum allowed total asset (assetId: ${this.assetId}) amount`);
                }

                // Save asset issuance address and the asset info
                this.assetIssuanceAddr = this.asset.issuanceAddress;
                this.assetInfo = {
                    name: this.asset.name,
                    description: this.asset.description,
                    issuingOpts: {
                        type: this.asset.issuingType,
                        divisibility: 0,
                        isAggregatable: false,
                        isNonFungible: true
                    }
                };
            }
            else {
                if (new BigNumber(this.nfTokenQuantity).isGreaterThan(assetCfgSetting.largestAssetAmount)) {
                    // Amount to be issued is too large. Log error and throw exception
                    Catenis.logger.ERROR('Amount requested to be issued would exceed maximum allowed total asset amount', {
                        assetId: this.assetId
                    });
                    throw new Meteor.Error('ctn_issue_nf_asset_amount_too_large', `Amount requested to be issued would exceed maximum allowed total asset (assetId: ${this.assetId}) amount`);
                }

                // Issuing new non-fungible asset
                this.assetInfo = {
                    name: nfAssetIssuance.asset.name,
                    description: nfAssetIssuance.asset.description,
                    issuingOpts: {
                        type: nfAssetIssuance.asset.canReissue ? CCTransaction.issuingAssetType.unlocked : CCTransaction.issuingAssetType.locked,
                        divisibility: 0,
                        isAggregatable: false,
                        isNonFungible: true
                    }
                };
            }

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
     * Builds the blockchain transaction
     */
    buildTransaction() {
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
            const devAssetIssueAddrAllocResult = devAssetIssueAddrFundSource.allocateFund(
                Service.devAssetIssuanceAddrAmount(
                    typeof devAssetIssueAddr === 'string' ? devAssetIssueAddr : undefined
                )
            );

            // Make sure that UTXOs have been correctly allocated
            if (devAssetIssueAddrAllocResult === null) {
                // Unable to allocate UTXOs. Log error condition and throw exception
                Catenis.logger.ERROR('Unable to allocate UTXOs for device (deviceId: %s) asset issuance addresses', this.issuingDevice.deviceId);
                throw new Meteor.Error('ctn_issue_nf_asset_utxo_alloc_error', `Unable to allocate UTXOs for device (deviceId: ${this.issuingDevice.deviceId}) asset issuance addresses`);
            }

            if (devAssetIssueAddrAllocResult.utxos.length !== 1) {
                // An unexpected number of UTXOs have been allocated.
                //  Log error condition and throw exception
                Catenis.logger.ERROR('An unexpected number of UTXOs have been allocated for device (deviceId: %s) asset issuance address', this.issuingDevice.deviceId, {
                    expected: 1,
                    allocated: devAssetIssueAddrAllocResult.utxos.length
                });
                throw new Meteor.Error('ctn_issue_nf_asset_utxo_alloc_error', `An unexpected number of UTXOs have been allocated for device (deviceId: ${this.issuingDevice.deviceId}) asset issuance address: expected: 1, allocated: ${devAssetIssueAddrAllocResult.utxos.length}`);
            }

            const devAssetIssueAddrAllocUtxo = devAssetIssueAddrAllocResult.utxos[0];

            // Add Colored Coins asset issuing input
            this.ccTransact.addIssuingInput(devAssetIssueAddrAllocUtxo.txout, {
                isWitness: devAssetIssueAddrAllocUtxo.isWitness,
                scriptPubKey: devAssetIssueAddrAllocUtxo.scriptPubKey,
                address: devAssetIssueAddrAllocUtxo.address,
                addrInfo: Catenis.keyStore.getAddressInfo(devAssetIssueAddrAllocUtxo.address)
            }, this.nfTokenQuantity, this.assetInfo.issuingOpts);

            // Add Colored Coins asset transfer outputs
            let tokensLeft = this.nfTokenQuantity;
            const lastIndex = this.holdingDevices.length - 1;
            const holdingDeviceCryptoKeysNFTokenQuantity = [];

            this.holdingDevices.forEach((device, idx) => {
                const deviceCryptoKeys = device.assetAddr.newAddressKeys();
                const nfTokenQuantity = idx === lastIndex ? tokensLeft : 1;

                holdingDeviceCryptoKeysNFTokenQuantity.push([deviceCryptoKeys, nfTokenQuantity]);

                this.ccTransact.setTransferOutput(
                    deviceCryptoKeys.getAddress(),
                    nfTokenQuantity,
                    0
                );

                tokensLeft -= nfTokenQuantity;
            });

            // Prepare to add Colored Coins asset metadata
            const ccMetadata = new CCMetadata();

            ccMetadata.assetMetadata.setAssetProperties({
                ctnAssetId: this.assetId ? this.assetId : Asset.getAssetIdFromCcTransaction(this.ccTransact),
                name: this.assetInfo.name,
                description: this.assetInfo.description
            });

            // Optimization: identify possible wildcard crypto keys
            let wildcardCryptoKeys;
            let maxNFTokenQuantity = 1;

            for (const [cryptoKeys, nfTokenQuantity] of holdingDeviceCryptoKeysNFTokenQuantity) {
                if (nfTokenQuantity > maxNFTokenQuantity) {
                    wildcardCryptoKeys = cryptoKeys;
                    maxNFTokenQuantity = nfTokenQuantity;
                }
            }

            const encCryptoKeys = [];

            for (const [cryptoKeys, nfTokenQuantity] of holdingDeviceCryptoKeysNFTokenQuantity) {
                if (cryptoKeys === wildcardCryptoKeys) {
                    encCryptoKeys[-1] = cryptoKeys;
                } else {
                    for (let count = nfTokenQuantity; count > 0; count--) {
                        encCryptoKeys.push(cryptoKeys);
                    }
                }
            }

            ccMetadata.nfTokenMetadata.fromAssetIssuance(this.nfAssetIssuance, encCryptoKeys);

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
                this.assetInfo.description = ccMetadata.metadata.metadata.description;
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
    }

    /**
     * Sends the transaction to the blockchain network
     */
    sendTransaction() {
        if (this.txBuilt) {
            // Make sure that blockchain is not polled and processing of newly sent tx is
            //  not done until sent transaction is properly recorded into the local database.
            //
            //  NOTE: the main reason why we do this for this specific case (and not for most of
            //      the other transactions we send) is that it may required to do other database
            //      access tasks (to create new Asset doc/rec) before the transaction is saved
            //      onto the database.
            try {
                Catenis.txMonitor.pausePoll();

                // DEBUG - Begin
                //this.ccTransact.sendTransaction();
                Catenis.logger.DEBUG('>>>>>> Issue Non-Fungible Asset raw transaction: ' + this.ccTransact.getTransaction());
                throw new Error('DEBUG - Simulating send transaction error');
                // DEBUG - End

                // Create Asset database doc/rec if it does not yet exist (newly issued asset)
                if (!this.asset) {
                    this.assetId = Asset.createAsset(this.ccTransact, this.assetInfo.name, this.assetInfo.description);
                    this.asset = Asset.getAssetByAssetId(this.assetId);
                }

                this.nfTokenIds = NonFungibleToken.createNFTokens(this.asset, this.ccTransact);

                // Save sent transaction onto local database
                this.ccTransact.saveSentTransaction(Transaction.type.issue_nf_asset, {
                    assetId: this.assetId,
                    issuingDeviceId: this.issuingDevice.deviceId,
                    holdingDeviceIds: this.holdingDevices.map(device => device.deviceId),
                    nfTokenIds: this.nfTokenIds
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
     * Determines if Colored Coins transaction is a valid Catenis Issue Non-Fungible Asset transaction
     * @param {CCTransaction} ccTransact The Colored Coins transaction to be validated
     * @returns {(IssueNFAssetTransaction|undefined)} The Issue Non-Fungible Asset transaction if valid, undefined
     *                                                 otherwise
     */
    static checkTransaction(ccTransact) {
        let issueNFAssetTransact = undefined;

        // First, check if pattern of transaction's inputs and outputs is consistent
        if ((ccTransact instanceof CCTransaction) && ccTransact.matches(IssueNFAssetTransaction)) {
            // Make sure that this is a Colored Coins transaction that issues non-fungible asset, with no
            //  transfer input sequences, at least one transfer output, and with a valid metadata
            if (ccTransact.isIssuingNFAsset && !ccTransact.hasTransfer && ccTransact.transferOutputs.length >= 1
                    && ccTransact.ccMetadata && ccTransact.ccMetadata.assetMetadata.ctnAssetId
                    && ccTransact.ccMetadata.nfTokenMetadata.newTokens.length > 0) {
                // Validate and identify input and output addresses
                //  NOTE: no need to check if the variables below are non-null because the transact.matches()
                //      result above already guarantees it
                const devAssetIssueAddr = getAddrAndAddrInfo(ccTransact.getInputAt(0));

                // Get holding device asset addresses from payment outputs that might exist before
                //  the null data output
                const holdDevAssetAddrs = [];
                const numOutputsBeforeNullData = ccTransact.numPayOutputsBeforeNullData;

                if (numOutputsBeforeNullData > 0) {
                    for (let idx = 0; idx < numOutputsBeforeNullData; idx++) {
                        holdDevAssetAddrs.push(getAddrAndAddrInfo(ccTransact.getOutputAt(idx).payInfo));
                    }
                }

                // Now, sort out the addresses from the remaining outputs (after the null data output)
                const devAssetIssueRefundChangeAddrs = [];
                let nextOutPos = ccTransact.getNullDataOutputPosition();
                let done = false,
                    isValid = true;

                do {
                    const output = ccTransact.getOutputAt(++nextOutPos);

                    if (output !== undefined) {
                        const outputAddr = getAddrAndAddrInfo(output.payInfo);

                        if (outputAddr.addrInfo.type === KeyStore.extKeyType.dev_asst_addr.name) {
                            if (holdDevAssetAddrs.length === 0) {
                                // Save single holding device asset address
                                holdDevAssetAddrs.push(outputAddr);
                            } else {
                                isValid = false;
                            }
                        } else if (outputAddr.addrInfo.type === KeyStore.extKeyType.dev_asst_issu_addr.name) {
                            // Make sure that it is consistent with issuing address input
                            if (areAddressesFromSameDevice(devAssetIssueAddr.addrInfo, outputAddr.addrInfo)) {
                                devAssetIssueRefundChangeAddrs.push(outputAddr);
                            }
                            else {
                                isValid = false;
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
                while (!done && isValid);

                // Make sure that at least one holding device asset address is present
                if (isValid && holdDevAssetAddrs.length === 0) {
                    isValid = false;
                }

                if (isValid && devAssetIssueRefundChangeAddrs.length > 2) {
                    for (let idx = 0, limit = devAssetIssueRefundChangeAddrs.length - 2; idx < limit; idx++) {
                        if (devAssetIssueRefundChangeAddrs[idx].address !== devAssetIssueAddr.address) {
                            isValid = false;
                            break;
                        }
                    }
                }

                if (isValid) {
                    // Instantiate an issue non-fungible asset transaction
                    issueNFAssetTransact = new IssueNFAssetTransaction();


                    issueNFAssetTransact.ccTransact = ccTransact;
                    issueNFAssetTransact.issuingDevice = CatenisNode.getCatenisNodeByIndex(
                        devAssetIssueAddr.addrInfo.pathParts.ctnNodeIndex
                    )
                    .getClientByIndex(devAssetIssueAddr.addrInfo.pathParts.clientIndex)
                    .getDeviceByIndex(devAssetIssueAddr.addrInfo.pathParts.deviceIndex);
                    
                    issueNFAssetTransact.holdingDevices = holdDevAssetAddrs.map(addr =>
                        CatenisNode.getCatenisNodeByIndex(addr.addrInfo.pathParts.ctnNodeIndex)
                        .getClientByIndex(addr.addrInfo.pathParts.clientIndex)
                        .getDeviceByIndex(addr.addrInfo.pathParts.deviceIndex)
                    );

                    issueNFAssetTransact.nfTokenQuantity = ccTransact.issuingInfo.assetAmount;
                    issueNFAssetTransact.assetId = Asset.getAssetIdFromCcTransaction(ccTransact);

                    issueNFAssetTransact.asset = undefined;

                    try {
                        issueNFAssetTransact.asset = Asset.getAssetByAssetId(issueNFAssetTransact.assetId);
                    }
                    catch (err) {
                        if (!((err instanceof Meteor.Error) && err.error === 'ctn_asset_not_found')) {
                            throw err;
                        }
                    }

                    if (issueNFAssetTransact.asset) {
                        // Asset already defined in local database, so used to get asset info
                        issueNFAssetTransact.assetInfo = {
                            name: issueNFAssetTransact.asset.name,
                            description: issueNFAssetTransact.asset.description,
                            issuingOpts: {
                                type: issueNFAssetTransact.asset.issuingType,
                                divisibility: issueNFAssetTransact.asset.divisibility,
                                isAggregatable: issueNFAssetTransact.asset.isAggregatable,
                                isNonFungible: issueNFAssetTransact.asset.isNonFungible
                            }
                        };
                    }
                    else {
                        // Asset not yet defined in local database. Try to get asset name
                        //  and description from Colored Coins metadata
                        issueNFAssetTransact.assetInfo = {};

                        if (ccTransact.ccMetadata !== undefined) {
                            issueNFAssetTransact.assetInfo.name = ccTransact.ccMetadata.assetMetadata.assetName;
                            issueNFAssetTransact.assetInfo.description = ccTransact.ccMetadata.assetMetadata.assetDescription;
                        }
                        else {
                            // Issue asset transaction missing Colored Coins metadata.
                            //  Log warning condition
                            Catenis.logger.WARN('Issue asset transaction missing Colored Coins metadata', {
                                txid: ccTransact.txid
                            });
                        }

                        // Get the remainder from the Colored Coins transaction itself
                        issueNFAssetTransact.assetInfo.issuingOpts = {
                            type: ccTransact.issuingInfo.type,
                            divisibility: ccTransact.issuingInfo.divisibility,
                            isAggregatable: ccTransact.issuingInfo.isAggregatable,
                            isNonFungible: ccTransact.issuingInfo.isNonFungible
                        };
                    }

                    issueNFAssetTransact.tokenIds = NonFungibleToken.getTokenIdsFromCcTransact(ccTransact);
                }
            }
        }

        return issueNFAssetTransact;
    }
}


// Definition of module (private) functions
//


// Module code
//

// Lock class
Object.freeze(IssueNFAssetTransaction);
