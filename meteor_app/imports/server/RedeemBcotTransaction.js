/**
 * Created by claudio on 2018-10-25.
 */

//console.log('[RedeemBcotTransaction.js]: This code just ran.');

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
import { Transaction } from './Transaction';
import { Client } from './Client';
import { FundSource } from './FundSource';
import { BcotToken } from './BcotToken';
import { StoreBcotTransaction } from './StoreBcotTransaction';
import { Service } from './Service';
import { OmniTransaction } from './OmniTransaction';

// Config entries
const redeemBcotTxConfig = config.get('redeemBcotTransaction');

// Configuration settings
const cfgSettings = {
    timeToConfirm: redeemBcotTxConfig.get('timeToConfirm')
};


// Definition of function classes
//

// RedeemBcotTransaction function class
//
//  Constructor arguments:
//    client [Object(Client)] - Object of client who is redeeming the purchased BCOT tokens
//    redeemedAmount [Number] - Amount, in BCOT token "satoshis", of BCOT tokens being redeemed
//
// NOTE: make sure that objects of this function class are instantiated and used (their methods
//  called) from code executed from the FundSource.utxoCS critical section object
export function RedeemBcotTransaction(client, redeemedAmount) {
    if (client) {
        // Validate arguments
        const errArg = {};

        if (!(client instanceof Client)) {
            errArg.client = client;
        }

        if (!isValidAmount(redeemedAmount)) {
            errArg.redeemedAmount = redeemedAmount;
        }

        if (Object.keys(errArg).length > 0) {
            const errArgs = Object.keys(errArg);

            Catenis.logger.ERROR(util.format('RedeemBcotTransaction constructor called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
            throw new Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
        }

        // Properties definition
        Object.defineProperties(this, {
            txid: {
                get: () => {
                    return this.omniTransact.txid;
                }
            }
        });

        // Just initialize instance variables for now
        this.omniTransact = new OmniTransaction(OmniTransaction.omniTxType.simpleSend);
        this.txBuilt = false;
        this.client = client;
        this.bcotAmount = redeemedAmount;
    }
}


// Public RedeemBcotTransaction object methods
//

RedeemBcotTransaction.prototype.buildTransaction = function () {
    if (!this.txBuilt) {
        // Add transaction inputs

        // Prepare to add system BCOT token sale stock address input
        const bcotSaleStockAddr = Catenis.ctnHubNode.getBcotSaleStockAddress();
        const bcotSaleStockAddrFundSource = new FundSource(bcotSaleStockAddr, {unconfUtxoInfo: {}});
        const bcotSaleStockAddrAllocResult = bcotSaleStockAddrFundSource.allocateFund(Service.bcotSaleStockAddrAmount);

        // Make sure that UTXOs have been correctly allocated
        if (bcotSaleStockAddrAllocResult === null) {
            // Unable to allocate UTXOs. Log error condition and throw exception
            Catenis.logger.ERROR('Unable to allocate UTXOs for system BCOT token sale stock address');
            throw new Meteor.Error('ctn_bcot_sale_stock_utxo_alloc_error', 'Unable to allocate UTXOs for system BCOT token sale stock address');
        }

        if (bcotSaleStockAddrAllocResult.utxos.length !== 1) {
            // An unexpected number of UTXOs have been allocated.
            //  Log error condition and throw exception
            Catenis.logger.ERROR('An unexpected number of UTXOs have been allocated for system BCOT token sale stock address', {
                expected: 1,
                allocated: bcotSaleStockAddrAllocResult.utxos.length
            });
            throw new Meteor.Error('ctn_redeem_bcot_utxo_alloc_error', util.format('An unexpected number of UTXOs have been allocated for system BCOT token sale stock address: expected: 1, allocated: %d', bcotSaleStockAddrAllocResult.utxos.length));
        }

        // Add system BCOT token sale stock (sending) address input
        this.omniTransact.addSendingAddressInput(bcotSaleStockAddrAllocResult.utxos[0].txout, bcotSaleStockAddr, Catenis.keyStore.getAddressInfo(bcotSaleStockAddr));

        // Add transaction outputs

        // Add Omni payload (null data) output
        this.omniTransact.addOmniPayloadOutput(this.bcotAmount);

        // Add system BCOT token sale stock address refund output
        this.omniTransact.addP2PKHOutput(bcotSaleStockAddr, Service.bcotSaleStockAddrAmount);

        // NOTE: we do not care to check if change is not below dust amount because it is guaranteed
        //      that the change amount be a multiple of the basic amount that is allocated to BCOT
        //      token sale stock address which in turn is guaranteed to not be below dust
        if (bcotSaleStockAddrAllocResult.changeAmount > 0) {
            // Add system service credit issuance address change output
            this.omniTransact.addP2PKHOutput(bcotSaleStockAddr, bcotSaleStockAddrAllocResult.changeAmount);
        }

        // Add BCOT store (reference) address output
        this.omniTransact.addReferenceAddressOutput(BcotToken.storeBcotAddress, StoreBcotTransaction.bcotStoreAddrAmount);

        // Now, allocate UTXOs to pay for tx expense
        const payTxFundSource = new FundSource(Catenis.ctnHubNode.listFundingAddressesInUse(), {
            unconfUtxoInfo: {},
            smallestChange: true
        });
        const payTxAllocResult = payTxFundSource.allocateFundForTxExpense({
            txSize: this.omniTransact.estimateSize(),
            inputAmount: this.omniTransact.totalInputsAmount(),
            outputAmount: this.omniTransact.totalOutputsAmount()
        }, false, Catenis.bitcoinFees.getFeeRateByTime(cfgSettings.timeToConfirm));

        if (payTxAllocResult === null) {
            // Unable to allocate UTXOs. Log error condition and throw exception
            Catenis.logger.ERROR('No UTXO available to be allocated to pay for transaction expense');
            throw new Meteor.Error('ctn_redeem_bcot_no_utxo_pay_tx_expense', 'No UTXO available to be allocated to pay for transaction expense');
        }

        // Add inputs spending the allocated UTXOs to the transaction
        const inputs = payTxAllocResult.utxos.map((utxo) => {
            return {
                txout: utxo.txout,
                address: utxo.address,
                addrInfo: Catenis.keyStore.getAddressInfo(utxo.address)
            }
        });

        this.omniTransact.addInputs(inputs);

        if (payTxAllocResult.changeAmount >= Transaction.txOutputDustAmount) {
            // Add new output to receive change
            //  Note: it should be automatically inserted just before the reference address output, so the reference
            //      address output is the last output of the transaction
            this.omniTransact.addP2PKHOutput(Catenis.ctnHubNode.fundingChangeAddr.newAddressKeys().getAddress(), payTxAllocResult.changeAmount);
        }

        // Indicate that transaction is already built
        this.txBuilt = true;
    }
};

// Return value:
//   txid: [String] - Blockchain ID of sent transaction
RedeemBcotTransaction.prototype.sendTransaction = function () {
    // Make sure that transaction is already built
    if (this.txBuilt) {
        // Check if transaction has not yet been created and sent
        if (this.omniTransact.txid === undefined) {
            this.omniTransact.sendTransaction();

            // Save sent transaction onto local database
            this.omniTransact.saveSentTransaction(Transaction.type.redeem_bcot, {
                clientId: this.client.clientId,
                redeemedAmount: this.bcotAmount
            });

            // Make sure that BCOT token sale stock info is updated
            Catenis.bcotSaleStock.checkBcotSaleStock();

            // Make sure that system BCOT token sale stock is properly provisioned
            if (!Catenis.ctnHubNode.checkBcotSaleStockProvision()) {
                // Check if system funding balance is still within safe limits
                //  Note: we only care to do it when system BCOT token sale stock needs to be provisioned
                //      (has low balance) because the system funding balance is automatically checked when
                //      that provision takes place
                Catenis.ctnHubNode.checkFundingBalance();
            }
        }

        return this.omniTransact.txid;
    }
};

RedeemBcotTransaction.prototype.revertOutputAddresses = function () {
    if (this.txBuilt) {
        this.omniTransact.revertOutputAddresses();
    }
};


// Module functions used to simulate private RedeemBcotTransaction object methods
//  NOTE: these functions need to be bound to a RedeemBcotTransaction object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// RedeemBcotTransaction function class (public) methods
//

// Determines if transaction is a valid Redeem BCOT transaction
//
//  Arguments:
//    omniTransact: [Object(OmniTransaction)] // Object of type OmniTransaction identifying the transaction to be checked
//
//  Return:
//    - If transaction is not valid: undefined
//    - If transaction is valid: Object of type RedeemBcotTransaction created from transaction
//
RedeemBcotTransaction.checkTransaction = function (omniTransact) {
    if ((omniTransact instanceof OmniTransaction) && omniTransact.omniTxType === OmniTransaction.omniTxType.simpleSend && omniTransact.propertyId === BcotToken.bcotOmniPropertyId
            && omniTransact.referenceAddress === BcotToken.storeBcotAddress && omniTransact.matches(RedeemBcotTransaction)) {
        const redeemBcotTransact = new RedeemBcotTransaction();

        redeemBcotTransact.omniTransact = omniTransact;
        redeemBcotTransact.bcotAmount = omniTransact.strAmountToAmount(omniTransact.omniTxInfo.amount);

        return redeemBcotTransact;
    }
};


// RedeemBcotTransaction function class (public) properties
//

RedeemBcotTransaction.matchingPattern = Object.freeze({
    input: util.format('^(?:%s)(?:(?:%s)|(?:%s))+$',
        Transaction.ioToken.p2_sys_bcot_sale_stck_addr.token,
        Transaction.ioToken.p2_sys_fund_pay_addr.token,
        Transaction.ioToken.p2_sys_fund_chg_addr.token),
    output: util.format('^(?:%s)(?:%s){1,2}(?:%s)?(?:%s)$',
        Transaction.ioToken.null_data.token,
        Transaction.ioToken.p2_sys_bcot_sale_stck_addr.token,
        Transaction.ioToken.p2_sys_fund_chg_addr.token,
        Transaction.ioToken.p2_unknown_addr.token)
});


// Definition of module (private) functions
//

function isValidAmount(amount) {
    return Number.isInteger(amount) && amount > 0;
}


// Module code
//

// Lock function class
Object.freeze(RedeemBcotTransaction);
