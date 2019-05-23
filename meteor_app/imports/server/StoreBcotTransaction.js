/**
 * Created by Claudio on 2017-11-27.
 */

//console.log('[StoreBcotTransaction.js]: This code just ran.');

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
import { BcotToken } from './BcotToken';
import { Transaction } from './Transaction';
import { OmniTransaction } from './OmniTransaction';
import { BcotPaymentTransaction } from './BcotPaymentTransaction';
import { FundSource } from './FundSource';
import { CatenisNode } from './CatenisNode';

// Config entries
const storeBcotTxConfig = config.get('storeBcotTransaction');

// Configuration settings
const cfgSettings = {
    bcotStoreAddrAmount: storeBcotTxConfig.get('bcotStoreAddrAmount'),
    timeToConfirm: storeBcotTxConfig.get('timeToConfirm')
};


// Definition of function classes
//

// StoreBcotTransaction function class
//
//  Constructor arguments:
//    bcotPayTransact: [Object] - Object of type BcotPaymentTransaction identifying the received (and already confirmed) transaction
//                                 used to send BCOT tokens to the system as payments for services for a given client
//
// NOTE: make sure that objects of this function class are instantiated and used (their methods
//  called) from code executed from the FundSource.utxoCS critical section object
export function StoreBcotTransaction(bcotPayTransact) {
    if (bcotPayTransact !== undefined) {
        // Validate arguments
        const errArg = {};

        if (!(bcotPayTransact instanceof BcotPaymentTransaction)) {
            errArg.bcotPayTransact = bcotPayTransact;
        }

        if (Object.keys(errArg).length > 0) {
            const errArgs = Object.keys(errArg);

            Catenis.logger.ERROR(util.format('StoreBcotTransaction constructor called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
            throw new Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
        }

        // Just initialize instance variables for now
        this.omniTransact = new OmniTransaction(OmniTransaction.omniTxType.simpleSend);
        this.txBuilt = false;
        this.client = bcotPayTransact.client;
        this.amount = bcotPayTransact.bcotAmount;
        this.sendingAddress = bcotPayTransact.payeeAddress;
        this.bcotPayTxid = bcotPayTransact.txid;
    }
}


// Public StoreBcotTransaction object methods
//

StoreBcotTransaction.prototype.buildTransaction = function () {
    if (!this.txBuilt) {
        // Add transaction inputs

        // Prepare to add client BCOT payment address input
        const clientBcotPayAddFundSource = new FundSource(this.sendingAddress, {
            unconfUtxoInfo: {
                initTxInputs: this.omniTransact.inputs
            }
        });

        // Make sure we get the exact same UTXO that was used to send BCOT tokens in BCOT payment transaction
        const clientBcotPayAddrUtxos = clientBcotPayAddFundSource.getUtxosOfTx(this.bcotPayTxid);

        if (clientBcotPayAddrUtxos.length === 0) {
            // No UTXO of BCOT payment transaction paying to client BCOT payment address is available
            //  Log error and throw exception
            Catenis.logger.ERROR('No UTXO of BCOT payment transaction paying to client BCOT payment address is available', {
                bcotPayTxid: this.bcotPayTxid
            });
            throw new Meteor.Error('ctn_store_bcot_no_utxo_client_bcot_pay', 'No UTXO of BCOT payment transaction paying to client BCOT payment address is available');
        }
        else if (clientBcotPayAddrUtxos.length > 1) {
            // More than one output in BCOT payment transaction paying to the same client BCOT payment address
            //  Log warning condition
            Catenis.logger.WARN('More than one output in BCOT payment transaction paying to the same client BCOT payment address', {
                clientBcotPayAddrUtxos: clientBcotPayAddrUtxos
            });
        }

        // Add client BCOT payment (sending) address input
        this.omniTransact.addSendingAddressInput(clientBcotPayAddrUtxos[0].txout, this.sendingAddress, Catenis.keyStore.getAddressInfo(this.sendingAddress));

        // Add transaction outputs

        // Add Omni payload (null data) output
        this.omniTransact.addOmniPayloadOutput(this.amount);

        // Add BCOT store (reference) address output
        this.omniTransact.addReferenceAddressOutput(BcotToken.storeBcotAddress, cfgSettings.bcotStoreAddrAmount);

        // Now, allocate UTXOs to pay for tx expense
        const payTxFundSource = new FundSource(this.client.ctnNode.listFundingAddressesInUse(), {
            unconfUtxoInfo: {
                initTxInputs: this.omniTransact.inputs
            },
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
            throw new Meteor.Error('ctn_store_bcot_no_utxo_pay_tx_expense', 'No UTXO available to be allocated to pay for transaction expense');
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
            this.omniTransact.addP2PKHOutput(this.client.ctnNode.fundingChangeAddr.newAddressKeys().getAddress(), payTxAllocResult.changeAmount);
        }

        // Indicate that transaction is already built
        this.txBuilt = true;
    }
};

// Return value:
//   txid: [String] - Blockchain ID of sent transaction
StoreBcotTransaction.prototype.sendTransaction = function () {
    // Make sure that transaction is already built
    if (this.txBuilt) {
        // Check if transaction has not yet been created and sent
        if (this.omniTransact.txid === undefined) {
            this.omniTransact.sendTransaction();

            // Save sent transaction onto local database
            this.omniTransact.saveSentTransaction(Transaction.type.store_bcot, {
                storedAmount: this.amount
            });

            // Check if system funding balance is still within safe limits
            Catenis.ctnHubNode.checkFundingBalance();
        }

        return this.omniTransact.txid;
    }
};

StoreBcotTransaction.prototype.revertOutputAddresses = function () {
    if (this.txBuilt) {
        this.omniTransact.revertOutputAddresses();
    }
};


// Module functions used to simulate private StoreBcotTransaction object methods
//  NOTE: these functions need to be bound to a StoreBcotTransaction object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// StoreBcotTransaction function class (public) methods
//

// Determines if transaction is a valid Store BCOT transaction
//
//  Arguments:
//    omniTransact: [Object(OmniTransaction)] // Object of type OmniTransaction identifying the transaction to be checked
//
//  Return:
//    - If transaction is not valid: undefined
//    - If transaction is valid: Object of type StoreBcotTransaction created from transaction
//
StoreBcotTransaction.checkTransaction = function (omniTransact) {
    if ((omniTransact instanceof OmniTransaction) && omniTransact.omniTxType === OmniTransaction.omniTxType.simpleSend && omniTransact.propertyId === BcotToken.bcotOmniPropertyId
            && omniTransact.referenceAddress === BcotToken.storeBcotAddress && omniTransact.matches(StoreBcotTransaction)) {
        const clnBcotPayAddrInput = omniTransact.getInputAt(0);

        const storeBcotTransact = new StoreBcotTransaction();

        storeBcotTransact.omniTransact = omniTransact;
        storeBcotTransact.client = CatenisNode.getCatenisNodeByIndex(clnBcotPayAddrInput.addrInfo.pathParts.ctnNodeIndex).getClientByIndex(clnBcotPayAddrInput.addrInfo.pathParts.clientIndex);
        storeBcotTransact.amount = omniTransact.strAmountToAmount(omniTransact.omniTxInfo.amount);
        storeBcotTransact.sendingAddress = omniTransact.sendingAddress;
        storeBcotTransact.bcotPayTxid = clnBcotPayAddrInput.txout.txid;

        return storeBcotTransact;
    }
};


// StoreBcotTransaction function class (public) properties
//

StoreBcotTransaction.matchingPattern = Object.freeze({
    input: util.format('^(?:%s)(?:(?:%s)|(?:%s))+$',
        Transaction.ioToken.p2_cln_bcot_pay_addr.token,
        Transaction.ioToken.p2_sys_fund_pay_addr.token,
        Transaction.ioToken.p2_sys_fund_chg_addr.token),
    output: util.format('^(?:%s)(?:%s)?(?:%s)$',
        Transaction.ioToken.null_data.token,
        Transaction.ioToken.p2_sys_fund_chg_addr.token,
        Transaction.ioToken.p2_unknown_addr.token)
});


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Definition of properties
Object.defineProperties(StoreBcotTransaction, {
    bcotStoreAddrAmount: {
        get: () => {
            return cfgSettings.bcotStoreAddrAmount;
        },
        enumerable: true
    }
});

// Lock function class
Object.freeze(StoreBcotTransaction);
