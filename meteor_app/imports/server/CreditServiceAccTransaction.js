/**
 * Created by Claudio on 2017-11-24.
 */

//console.log('[CreditServiceAccTransaction.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import util from 'util';
// Third-party node modules
import config from 'config';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { CatenisNode } from './CatenisNode';
import { Client } from './Client';
import { FundSource } from './FundSource';
import { Transaction } from './Transaction';
import { BcotToken } from './BcotToken';
import { BcotPaymentTransaction } from './BcotPaymentTransaction';
import { CCTransaction } from './CCTransaction';
import {
    getAddrAndAddrInfo,
    areAddressesFromSameClient
} from './SendMessageTransaction';
import { Service } from './Service';
import { Asset } from './Asset';
import { CCMetadata } from './CCMetadata';
import { BaseBlockchainAddress } from './BaseBlockchainAddress';
import { KeyStore } from './KeyStore';
import { Util } from './Util';
import { RedeemBcotTransaction } from './RedeemBcotTransaction';
import { BitcoinInfo } from './BitcoinInfo';

// Config entries
const credServAccTxConfig = config.get('creditServiceAccTransaction');
const credSrvAccTxCcAssetMetaConfig = credServAccTxConfig.get('ccAssetMetadata');

// Configuration settings
const cfgSettings = {
    maxNumCcTransferOutputs: credServAccTxConfig.get('maxNumCcTransferOutputs'),
    safeNumCcTransferOutputs: credServAccTxConfig.get('safeNumCcTransferOutputs'),
    ccAssetMetadata: {
        bcotPayTxidKey: credSrvAccTxCcAssetMetaConfig.get('bcotPayTxidKey'),
        redeemBcotTxidKey: credSrvAccTxCcAssetMetaConfig.get('redeemBcotTxidKey')
    }
};


// Definition of function classes
//

// CreditServiceAccTransaction function class
//
//  Constructor arguments:
//    bcotTransact: [Object] - Object identifying the transaction used to add BCOT tokens to the system (in exchange for Catenis service credits).
//                              Should be one of these two types of transaction: BcotPaymentTransaction or RedeemBcotTransaction
//    amountToCredit: [Number] - (optional) Amount, in Catenis service credit's lowest unit, to actually credit the client's service account
//    limitTransferOutputs: [Boolean] - (optional) Indicates whether number of transaction outputs used to receive issued asset amount should be limited
//                                       in order to guarantee that encoded Colored Coins data will fit into transaction
//
// NOTE: make sure that objects of this function class are instantiated and used (their methods
//  called) from code executed from the FundSource.utxoCS critical section object
export function CreditServiceAccTransaction(bcotTransact, amountToCredit, limitTransferOutputs) {
    if (bcotTransact !== undefined) {
        // Validate arguments
        const errArg = {};

        if (bcotTransact instanceof BcotPaymentTransaction) {
            this.bcotTxType = Transaction.type.bcot_payment;
        }
        else if (bcotTransact instanceof RedeemBcotTransaction) {
            this.bcotTxType = Transaction.type.redeem_bcot;
        }
        else {
            errArg.bcotTransact = bcotTransact;
        }

        if (amountToCredit !== undefined && (typeof amountToCredit !== 'number' || amountToCredit <= 0)) {
            errArg.amountToCredit = amountToCredit;
        }

        if (limitTransferOutputs !== undefined && typeof limitTransferOutputs !== 'boolean') {
            errArg.limitTransferOutputs = limitTransferOutputs;
        }

        if (Object.keys(errArg).length > 0) {
            const errArgs = Object.keys(errArg);

            Catenis.logger.ERROR(util.format('CreditServiceAccTransaction constructor called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
            throw new Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
        }

        // Just initialize instance variables for now
        this.ccTransact = new CCTransaction();
        this.txBuilt = false;
        this.client = bcotTransact.client;

        const convertedBcotAmount = BcotToken.bcotToServiceCredit(bcotTransact.bcotAmount);

        this.amount = amountToCredit === undefined || amountToCredit > convertedBcotAmount ? convertedBcotAmount : amountToCredit;
        this.bcotTxid = bcotTransact.txid;
        this.limitTransferOutputs = limitTransferOutputs;
    }
}

CreditServiceAccTransaction.prototype.setCcMetadata = function (ccMetadata) {
    if (ccMetadata instanceof CCMetadata) {
        this.servCredCcMetadata = ccMetadata;
    }
};

CreditServiceAccTransaction.prototype.getCcMetadata = function () {
    return this.servCredCcMetadata;
};

// Public CreditServiceAccTransaction object methods
//

CreditServiceAccTransaction.prototype.buildTransaction = function () {
    if (!this.txBuilt) {
        // Calculate the amount of Catenis service credit (Colored Coins) assets to issue

        //  NOTE: if client has post-paid billing mode, the whole issued asset amount
        //         should be transferred to a single address/UTXO
        const servCredDistribFund = this.client.billingMode === Client.billingMode.prePaid ?
            Service.distributeServiceAccountFund(this.amount, this.limitTransferOutputs ? cfgSettings.safeNumCcTransferOutputs : cfgSettings.maxNumCcTransferOutputs)
            : {
                totalAmount: Util.roundDownToResolution(this.amount, Service.servicePriceResolution),
                amountPerAddress: [Util.roundDownToResolution(this.amount, Service.servicePriceResolution)]
            };

        this.issuingAmount = servCredDistribFund.totalAmount;

        if (this.issuingAmount > 0) {
            // Get Catenis service credit issuance address
            const servCredIssueAddr = this.client.ctnNode.servCredIssueAddr.lastAddressKeys().getAddress();
            const servCredIssueAddrInfo = Catenis.keyStore.getAddressInfo(servCredIssueAddr);

            // Try to retrieve Catenis service credit asset information
            let servCredAsset;

            try {
                servCredAsset = Asset.getAssetByIssuanceAddressPath(servCredIssueAddrInfo.path);
            }
            catch (err) {
                if (!((err instanceof Meteor.Error) && err.error === 'ctn_asset_not_found')) {
                    throw err;
                }
            }

            const servCredAssetInfo = servCredAsset !== undefined ? {
                    name: servCredAsset.name,
                    description: servCredAsset.description,
                    issuingOpts: {
                        type: servCredAsset.issuingType,
                        divisibility: servCredAsset.divisibility,
                        isAggregatable: servCredAsset.isAggregatable
                    }
                } : this.client.ctnNode.serviceCreditAssetInfo();


            // Add Colored Coins related transaction inputs and outputs
            //

            // Prepare to add Colored Coins asset issuing input
            const servCredIssueAddrFundSource = new FundSource(servCredIssueAddr, {
                useUnconfirmedUtxo: true,
                unconfUtxoInfo: {
                    initTxInputs: this.ccTransact.inputs
                }
            });
            const servCredIssueAddrAllocResult = servCredIssueAddrFundSource.allocateFund(Service.serviceCreditIssuanceAddrAmount);

            // Make sure that UTXOs have been correctly allocated
            if (servCredIssueAddrAllocResult === null) {
                // Unable to allocate UTXOs. Log error condition and throw exception
                Catenis.logger.ERROR('Unable to allocate UTXOs for Catenis node (ctnNodeIndex: %d) service credit issuance addresses', this.client.ctnNode.ctnNodeIndex);
                throw new Meteor.Error('ctn_cred_serv_acc_utxo_alloc_error', util.format('Unable to allocate UTXOs for Catenis node (ctnNodeIndex: %d) service credit issuance addresses', this.client.ctnNode.ctnNodeIndex));
            }

            if (servCredIssueAddrAllocResult.utxos.length !== 1) {
                // An unexpected number of UTXOs have been allocated.
                // Log error condition and throw exception
                Catenis.logger.ERROR('An unexpected number of UTXOs have been allocated for Catenis node (ctnNodeIndex: %d) service credit issuance address', this.client.ctnNode.ctnNodeIndex, {
                    expected: 1,
                    allocated: servCredIssueAddrAllocResult.utxos.length
                });
                throw new Meteor.Error('ctn_cred_serv_acc_utxo_alloc_error', util.format('An unexpected number of UTXOs have been allocated for Catenis node (ctnNodeIndex: %d) service credit issuance address: expected: 1, allocated: %d', this.client.ctnNode.ctnNodeIndex, servCredIssueAddrAllocResult.utxos.length));
            }

            const servCredIssueAddrAllocUtxo = servCredIssueAddrAllocResult.utxos[0];

            // Add Colored Coins asset issuing input
            this.ccTransact.addIssuingInput(servCredIssueAddrAllocUtxo.txout, {
                isWitness: servCredIssueAddrAllocUtxo.isWitness,
                scriptPubKey: servCredIssueAddrAllocUtxo.scriptPubKey,
                address: servCredIssueAddr,
                addrInfo: servCredIssueAddrInfo
            }, this.issuingAmount, servCredAssetInfo.issuingOpts);

            // Add Colored Coins asset transfer outputs
            this.ccTransact.setTransferOutputs(servCredDistribFund.amountPerAddress.map((amount) => {
                return {
                    address: this.client.servAccCreditLineAddr.newAddressKeys().getAddress(),
                    assetAmount: amount
                }
            }), 0);

            // Prepare to add Colored Coins asset metadata
            if (!this.servCredCcMetadata) {
                // No Colored Coins asset metadata set yet. Create it now
                this.servCredCcMetadata = new CCMetadata();

                this.servCredCcMetadata.assetMetadata.setAssetProperties({
                    ctnAssetId: Asset.getAssetIdFromCcTransaction(this.ccTransact),
                    name: servCredAssetInfo.name,
                    description: servCredAssetInfo.description
                });

                if (this.bcotTxType === Transaction.type.bcot_payment) {
                    // Add BCOT payment transaction ID to Colored Coins metadata
                    this.servCredCcMetadata.assetMetadata.addFreeUserData(cfgSettings.ccAssetMetadata.bcotPayTxidKey, Buffer.from(this.bcotTxid), true);
                }
                else if (this.bcotTxType === Transaction.type.redeem_bcot) {
                    // Add redeem BCOT transaction ID to Colored Coins metadata
                    this.servCredCcMetadata.assetMetadata.addFreeUserData(cfgSettings.ccAssetMetadata.redeemBcotTxidKey, Buffer.from(this.bcotTxid), true);
                }
            }

            // Add Colored Coins asset metadata
            this.ccTransact.setCcMetadata(this.servCredCcMetadata);

            // Pre-allocate multi-signature signee address
            const multiSigSigneeAddr = this.client.ctnNode.multiSigSigneeAddr.newAddressKeys().getAddress();

            // Assemble Colored Coins transaction
            // TODO: avoid preallocating and passing multisig address to assemble() method and reverting it if not used.
            //  Solution: pass an "address allocation" function instead, which would be used by the assemble() method
            //  only in case it is really needed.
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

            // Add system service credit issuance address refund output
            this.ccTransact.addPubKeyHashOutput(servCredIssueAddr, Service.serviceCreditIssuanceAddrAmount);

            // NOTE: we do not care to check if change is not below dust amount because it is guaranteed
            //      that the change amount be a multiple of the basic amount that is allocated to device
            //      main addresses which in turn is guaranteed to not be below dust
            if (servCredIssueAddrAllocResult.changeAmount > 0) {
                // Add system service credit issuance address change output
                this.ccTransact.addPubKeyHashOutput(servCredIssueAddr, servCredIssueAddrAllocResult.changeAmount);
            }

            // Now, allocate UTXOs to pay for tx expense
            const txChangeOutputType = BitcoinInfo.getOutputTypeByAddressType(this.client.ctnNode.fundingChangeAddr.btcAddressType);
            const payTxFundSource = new FundSource(this.client.ctnNode.listFundingAddressesInUse(), {
                useUnconfirmedUtxo: true,
                unconfUtxoInfo: {
                    initTxInputs: this.ccTransact.inputs
                },
                smallestChange: true,
                useAllNonWitnessUtxosFirst: true,   // Default setting; could have been omitted
                useWitnessOutputForChange: txChangeOutputType.isWitness
            });
            const payTxAllocResult = payTxFundSource.allocateFundForTxExpense({
                txSzStSnapshot: this.ccTransact.txSize,
                inputAmount: this.ccTransact.totalInputsAmount(),
                outputAmount: this.ccTransact.totalOutputsAmount()
            }, false, Catenis.bitcoinFees.getOptimumFeeRate());

            if (payTxAllocResult === null) {
                // Unable to allocate UTXOs. Log error condition and throw exception
                Catenis.logger.ERROR('No UTXO available to be allocated to pay for transaction expense');
                throw new Meteor.Error('ctn_cred_serv_acc_no_utxo_pay_tx_expense', 'No UTXO available to be allocated to pay for transaction expense');
            }

            // Add inputs spending the allocated UTXOs to the transaction
            const inputs = payTxAllocResult.utxos.map((utxo) => {
                return {
                    txout: utxo.txout,
                    isWitness: utxo.isWitness,
                    scriptPubKey: utxo.scriptPubKey,
                    address: utxo.address,
                    addrInfo: Catenis.keyStore.getAddressInfo(utxo.address)
                }
            });

            this.ccTransact.addInputs(inputs);

            if (payTxAllocResult.changeAmount >= Transaction.dustAmountByOutputType(txChangeOutputType)) {
                // Add new output to receive change
                this.ccTransact.addPubKeyHashOutput(this.client.ctnNode.fundingChangeAddr.newAddressKeys().getAddress(), payTxAllocResult.changeAmount);
            }

            // Create new Asset database doc/rec if necessary
            if (servCredAsset === undefined) {
                Asset.createAsset(this.ccTransact, servCredAssetInfo.name, servCredAssetInfo.description);
            }

            // Indicate that transaction is already built
            this.txBuilt = true;
        }
    }
};

// Return value:
//   txid: [String] - Blockchain ID of sent transaction
CreditServiceAccTransaction.prototype.sendTransaction = function () {
    // Make sure that transaction is already built
    if (this.txBuilt) {
        // Check if transaction has not yet been created and sent
        if (this.ccTransact.txid === undefined) {
            this.ccTransact.sendTransaction();

            // Save sent transaction onto local database
            this.ccTransact.saveSentTransaction(Transaction.type.credit_service_account, {
                clientId: this.client.clientId,
                issuedAmount: this.issuingAmount
            });

            // Force update of Colored Coins data associated with UTXOs
            Catenis.c3NodeClient.parseNow();

            // Make sure that system service credit issuance is properly provisioned
            if (!Catenis.ctnHubNode.checkServiceCreditIssuanceProvision()) {
                // Check if system funding balance is still within safe limits
                //  Note: we only care to do it when system service credit issuance needs to be provisioned
                //      (has low balance) because the system funding balance is automatically checked when
                //      that provision takes place
                Catenis.ctnHubNode.checkFundingBalance();
            }
        }

        return this.ccTransact.txid;
    }
};

CreditServiceAccTransaction.prototype.revertOutputAddresses = function () {
    if (this.txBuilt) {
        this.ccTransact.revertOutputAddresses();
    }
};


// Module functions used to simulate private CreditServiceAccTransaction object methods
//  NOTE: these functions need to be bound to a CreditServiceAccTransaction object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// CreditServiceAccTransaction function class (public) methods
//

// Determines if transaction is a valid Catenis Credit Service Account transaction
//
//  Arguments:
//    ccTransact: [Object] // Object of type CCTransaction identifying the transaction to be checked
//
//  Return:
//    - If transaction is not valid: undefined
//    - If transaction is valid: Object of type CreditServiceAccTransaction created from transaction
//
CreditServiceAccTransaction.checkTransaction = function (ccTransact) {
    let credServAccTransact = undefined;

    // First, check if pattern of transaction's inputs and outputs is consistent
    if ((ccTransact instanceof CCTransaction) && ccTransact.matches(CreditServiceAccTransaction)) {
        // Make sure that this is a Colored Coins asset issuing transaction
        if (ccTransact.issuingInfo !== undefined && ccTransact.ccMetadata !== undefined
                && (ccTransact.ccMetadata.assetMetadata.userData.hasFreeDataKey(cfgSettings.ccAssetMetadata.bcotPayTxidKey)
                || ccTransact.ccMetadata.assetMetadata.userData.hasFreeDataKey(cfgSettings.ccAssetMetadata.redeemBcotTxidKey))) {
            // Validate and identify input and output addresses
            //  NOTE: no need to check if the variables below are non-null because the transact.matches()
            //      result above already guarantees it
            const servCredIssueAddr = getAddrAndAddrInfo(ccTransact.getInputAt(0));

            const servAccCredLineAddrs = [];
            let nextOutPos = ccTransact.includesMultiSigOutput ? 1 : 0;
            let done = false,
                error = false;

            do {
                const output = ccTransact.getOutputAt(++nextOutPos);

                if (output !== undefined) {
                    const outputAddr = getAddrAndAddrInfo(output.payInfo);

                    if (outputAddr.addrInfo.type === KeyStore.extKeyType.cln_srv_acc_cred_ln_addr.name) {
                        // Make sure that it is consistent with previous addresses
                        if (servAccCredLineAddrs.length === 0 || areAddressesFromSameClient(servAccCredLineAddrs[0].addrInfo, outputAddr.addrInfo)) {
                            servAccCredLineAddrs.push(outputAddr);
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
                    error = true;
                }
            }
            while (!done && !error);

            if (!error && servAccCredLineAddrs.length > 0) {
                let servCredIssueRefundAddr = getAddrAndAddrInfo(ccTransact.getOutputAt(nextOutPos++).payInfo);
                let servCredIssueChangeAddr = undefined;

                const nextOutput = ccTransact.getOutputAt(nextOutPos);

                if (nextOutput !== undefined) {
                    const outputAddr = getAddrAndAddrInfo(nextOutput.payInfo);

                    if (outputAddr.addrInfo.type === KeyStore.extKeyType.sys_serv_cred_issu_addr.name) {
                        servCredIssueChangeAddr = outputAddr;
                    }
                }

                if (servCredIssueRefundAddr.address === servCredIssueAddr.address && (servCredIssueChangeAddr === undefined || servCredIssueChangeAddr.address === servCredIssueAddr.address)) {
                    // Instantiate credit service account transaction
                    credServAccTransact = new CreditServiceAccTransaction();

                    credServAccTransact.ccTransact = ccTransact;
                    credServAccTransact.client = CatenisNode.getCatenisNodeByIndex(servAccCredLineAddrs[0].addrInfo.pathParts.ctnNodeIndex).getClientByIndex(servAccCredLineAddrs[0].addrInfo.pathParts.clientIndex);
                    credServAccTransact.amount = credServAccTransact.issuingAmount = ccTransact.issuingInfo.assetAmount;

                    if (ccTransact.ccMetadata.assetMetadata.userData.hasFreeDataKey(cfgSettings.ccAssetMetadata.bcotPayTxidKey)) {
                        // Credit derived from BCOT payment. Retrieve BCOT payment tx info
                        credServAccTransact.bcotTxType = Transaction.type.bcot_payment;
                        credServAccTransact.bcotTxid = ccTransact.ccMetadata.assetMetadata.userData.freeData[cfgSettings.ccAssetMetadata.bcotPayTxidKey];
                    }
                    else if (ccTransact.ccMetadata.assetMetadata.userData.hasFreeDataKey(cfgSettings.ccAssetMetadata.redeemBcotTxidKey)) {
                        // Credit derived from BCOT redemption. Retrieve redeem BCOT tx info
                        credServAccTransact.bcotTxType = Transaction.type.redeem_bcot;
                        credServAccTransact.bcotTxid = ccTransact.ccMetadata.assetMetadata.userData.freeData[cfgSettings.ccAssetMetadata.redeemBcotTxidKey];
                    }
                }
            }
        }
    }

    return credServAccTransact;
};

// Get list of service account credit line address UTXOs for a given client from all unconfirmed
//  credit service account transactions
//
//  Result:
//   unconfUtxos [Array(String)] - List of unconfirmed UTXOs formatted as "txid:n", or undefined if no unconfirmed UTXOs have been found
CreditServiceAccTransaction.clientServAccCredLineAddrsUnconfUtxos = function (clientId) {
    // Retrieve unconfirmed credit service account transactions for the given client
    const unconfUtxos = [];

    Catenis.db.collection.SentTransaction.find({
        type: Transaction.type.credit_service_account.name,
        'confirmation.confirmed': false,
        'info.creditServiceAccount.clientId': clientId
    }, {
        txid: 1,
        info: 1
    }).forEach((doc) => {
        const ccTransact = CCTransaction.fromTransaction(Transaction.fromTxid(doc.txid));
        const servAccCredLineAddrs = [];
        let nextOutPos = ccTransact.includesMultiSigOutput ? 1 : 0;
        let done = false,
            error = false;

        do {
            const output = ccTransact.getOutputAt(++nextOutPos);

            if (output !== undefined) {
                const outputAddr = getAddrAndAddrInfo(output.payInfo);

                if (outputAddr.addrInfo.type === KeyStore.extKeyType.cln_srv_acc_cred_ln_addr.name) {
                    // Make sure that it is consistent with previous addresses
                    if (servAccCredLineAddrs.length === 0 || areAddressesFromSameClient(servAccCredLineAddrs[0].addrInfo, outputAddr.addrInfo)) {
                        servAccCredLineAddrs.push(outputAddr);
                        unconfUtxos.push(Util.txoutToString({txid: doc.txid, vout: nextOutPos}));
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
                error = true;
            }
        }
        while (!done && !error);

        if (error) {
            // Sent unconfirmed credit service account transaction is not consistent.
            //  Log error condition
            Catenis.logger.ERROR('Sent unconfirmed credit service account transaction is not consistent', {
                ccTransact: ccTransact
            });
        }
    });

    return unconfUtxos.length > 0 ? unconfUtxos : undefined;
};


// CreditServiceAccTransaction function class (public) properties
//

CreditServiceAccTransaction.matchingPattern = Object.freeze({
    input: util.format('^(?:%s)(?:(?:%s)|(?:%s))+$',
        Transaction.ioToken.p2_sys_serv_cred_issu_addr.token,
        Transaction.ioToken.p2_sys_fund_pay_addr.token,
        Transaction.ioToken.p2_sys_fund_chg_addr.token),
    output: util.format('^(?:(?:%s)(?:%s)(?:%s){1,2}(?:%s))?(?:%s)(?:%s)+(?:%s){0,2}(?:%s)?$',
        Transaction.ioToken.multisig_start.token,
        Transaction.ioToken.p2_sys_msig_sign_addr.token,
        Transaction.ioToken.p2_unknown_addr.token,
        Transaction.ioToken.multisig_end.token,
        Transaction.ioToken.null_data.token,
        Transaction.ioToken.p2_cln_srv_acc_cred_ln_addr.token,
        Transaction.ioToken.p2_sys_serv_cred_issu_addr.token,
        Transaction.ioToken.p2_sys_fund_chg_addr.token)
});


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(CreditServiceAccTransaction);
