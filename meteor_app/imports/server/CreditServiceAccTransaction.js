/**
 * Created by claudio on 24/11/17.
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
import { BcotPayment } from './BcotPayment';
import { BcotPaymentTransaction } from './BcotPaymentTransaction';
import { CCTransaction } from './CCTransaction';
import {
    getAddrAndAddrInfo,
    areAddressesFromSameClient
} from './SendMessageTransaction';
import { Service } from './Service';
import { Asset } from './Asset';
import { CCMetadata } from './CCMetadata';
import { BlockchainAddress } from './BlockchainAddress';
import { KeyStore } from './KeyStore';
import { Util } from './Util';

// Config entries
const credServAccTxConfig = config.get('creditServiceAccTransaction');
const credSrvAccTxCcMetaConfig = credServAccTxConfig.get('ccMetadata');

// Configuration settings
const cfgSettings = {
    maxNumCcTransferOutputs: credServAccTxConfig.get('maxNumCcTransferOutputs'),
    safeNumCcTransferOutputs: credServAccTxConfig.get('safeNumCcTransferOutputs'),
    ccMetadata: {
        bcotPayTxidKey: credSrvAccTxCcMetaConfig.get('bcotPayTxidKey')
    }
};


// Definition of function classes
//

// CreditServiceAccTransaction function class
//
//  Constructor arguments:
//    bcotPayTransact: [Object] - Object of type BcotPaymentTransaction identifying the received (and already confirmed) transaction
//                                 used to send BCOT tokens to the system as payments for services for a given client
//    amountToCredit: [Number] - (optional) Amount, in Catenis service credit's lowest unit, to actually credit the client's service account
//    limitTransferOutputs: [Boolean] - (optional) Indicates whether number of transaction outputs used to receive issued asset amount should be limited
//                                       in order to guarantee that encoded Colored Coins data will fit into transaction
//
// NOTE: make sure that objects of this function class are instantiated and used (their methods
//  called) from code executed from the FundSource.utxoCS critical section object
export function CreditServiceAccTransaction(bcotPayTransact, amountToCredit, limitTransferOutputs) {
    if (bcotPayTransact !== undefined) {
        // Validate arguments
        const errArg = {};

        if (!(bcotPayTransact instanceof BcotPaymentTransaction)) {
            errArg.bcotPayTransact = bcotPayTransact;
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
        this.client = bcotPayTransact.client;

        const convertedPaidAmount = BcotPayment.bcotToServiceCredit(bcotPayTransact.paidAmount);

        this.amount = amountToCredit === undefined || amountToCredit > convertedPaidAmount ? convertedPaidAmount : amountToCredit;
        this.bcotPayTxid = bcotPayTransact.txid;
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
            const servCredIssueAddrFundSource = new FundSource(servCredIssueAddr, {unconfUtxoInfo: {}});
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
            this.ccTransact.addIssuingInput(servCredIssueAddrAllocUtxo.txout, servCredIssueAddr, servCredIssueAddrInfo, this.issuingAmount, servCredAssetInfo.issuingOpts);

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

                this.servCredCcMetadata.setAssetMetadata({
                    ctnAssetId: Asset.getAssetIdFromCcTransaction(this.ccTransact),
                    name: servCredAssetInfo.name,
                    description: servCredAssetInfo.description
                });

                // Add BCOT payment transaction ID to Colored Coins metadata
                this.servCredCcMetadata.setFreeUserData(cfgSettings.ccMetadata.bcotPayTxidKey, Buffer.from(this.bcotPayTxid), true);
            }

            // Add Colored Coins asset metadata
            this.ccTransact.setCcMetadata(this.servCredCcMetadata);

            // Pre-allocate multi-signature signee address
            const multiSigSigneeAddr = this.client.ctnNode.multiSigSigneeAddr.newAddressKeys().getAddress();

            // Assemble Colored Coins transaction
            this.ccTransact.assemble(multiSigSigneeAddr);

            if (!this.ccTransact.includesMultiSigOutput) {
                // Revert pre-allocated multi-signature signee address
                BlockchainAddress.revertAddress(multiSigSigneeAddr);
            }

            // Finalize transaction
            //

            // Add additional required outputs

            // Add system service credit issuance address refund output
            this.ccTransact.addP2PKHOutput(servCredIssueAddr, Service.serviceCreditIssuanceAddrAmount);

            // NOTE: we do not care to check if change is not below dust amount because it is guaranteed
            //      that the change amount be a multiple of the basic amount that is allocated to device
            //      main addresses which in turn is guaranteed to not be below dust
            if (servCredIssueAddrAllocResult.changeAmount > 0) {
                // Add system service credit issuance address change output
                this.ccTransact.addP2PKHOutput(servCredIssueAddr, servCredIssueAddrAllocResult.changeAmount);
            }

            // Now, allocate UTXOs to pay for tx expense
            const payTxFundSource = new FundSource(this.client.ctnNode.listFundingAddressesInUse(), {
                unconfUtxoInfo: {},
                smallestChange: true
            });
            const payTxAllocResult = payTxFundSource.allocateFundForTxExpense({
                txSize: this.ccTransact.estimateSize(),
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
                    address: utxo.address,
                    addrInfo: Catenis.keyStore.getAddressInfo(utxo.address)
                }
            });

            this.ccTransact.addInputs(inputs);

            if (payTxAllocResult.changeAmount >= Transaction.txOutputDustAmount) {
                // Add new output to receive change
                this.ccTransact.addP2PKHOutput(this.client.ctnNode.fundingChangeAddr.newAddressKeys().getAddress(), payTxAllocResult.changeAmount);
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

            // Check if system funding balance is still within safe limits
            Catenis.ctnHubNode.checkFundingBalance();
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
    if (ccTransact.matches(CreditServiceAccTransaction)) {
        // Make sure that this is a Colored Coins asset issuing transaction
        if (ccTransact.issuingInfo !== undefined && ccTransact.ccMetadata !== undefined && ccTransact.ccMetadata.userData !== undefined && (cfgSettings.ccMetadata.bcotPayTxidKey in ccTransact.ccMetadata.userData)) {
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
                    credServAccTransact.bcotPayTxid = ccTransact.ccMetadata.userData[cfgSettings.ccMetadata.bcotPayTxidKey];
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
