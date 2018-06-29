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
// noinspection JSFileReferences
import BigNumber from 'bignumber.js';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { BcotPayment } from './BcotPayment';
import { Transaction } from './Transaction';
import { BcotPaymentTransaction } from './BcotPaymentTransaction';
import { FundSource } from './FundSource';

// Config entries
const storeBcotTxConfig = config.get('storeBcotTransaction');

// Configuration settings
const cfgSettings = {
    bcotStoreAddrAmount: storeBcotTxConfig.get('bcotStoreAddrAmount'),
    timeToConfirm: storeBcotTxConfig.get('timeToConfirm'),
    omniDataPrefix: storeBcotTxConfig.get('omniDataPrefix')
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
        this.transact = new Transaction();
        this.txBuilt = false;
        this.client = bcotPayTransact.client;
        this.amount = bcotPayTransact.paidAmount;
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
        const clientBcotPayAddFundSource = new FundSource(this.sendingAddress, {unconfUtxoInfo: {}});

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

        // Add client BCOT payment address input
        this.transact.addInput(clientBcotPayAddrUtxos[0].txout, this.sendingAddress, Catenis.keyStore.getAddressInfo(this.sendingAddress));

        // Add transaction outputs

        // Prepare to add null data output containing encoded Omni data
        const omniData = Catenis.omniCore.omniCreatePayloadSimpleSend(BcotPayment.bcotOmniPropertyId, new BigNumber(this.amount).dividedBy(100000000).toString());

        // Add null data output
        this.transact.addNullDataOutput(Buffer.concat([Buffer.from(cfgSettings.omniDataPrefix), Buffer.from(omniData, 'hex')]));

        // Add BCOT store address output
        this.transact.addP2PKHOutput(BcotPayment.storeBcotAddress, cfgSettings.bcotStoreAddrAmount);

        // Now, allocate UTXOs to pay for tx expense
        const payTxFundSource = new FundSource(this.client.ctnNode.listFundingAddressesInUse(), {
            unconfUtxoInfo: {},
            smallestChange: true
        });
        const payTxAllocResult = payTxFundSource.allocateFundForTxExpense({
            txSize: this.transact.estimateSize(),
            inputAmount: this.transact.totalInputsAmount(),
            outputAmount: this.transact.totalOutputsAmount()
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

        this.transact.addInputs(inputs);

        if (payTxAllocResult.changeAmount >= Transaction.txOutputDustAmount) {
            // Add new output to receive change making sure that it is the second output of the tx
            this.transact.addP2PKHOutput(this.client.ctnNode.fundingChangeAddr.newAddressKeys().getAddress(), payTxAllocResult.changeAmount, 1);
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
        if (this.transact.txid === undefined) {
            this.transact.sendTransaction();

            // Save sent transaction onto local database
            this.transact.saveSentTransaction(Transaction.type.store_bcot, {
                storedAmount: this.amount
            });

            // Check if system funding balance is still within safe limits
            Catenis.ctnHubNode.checkFundingBalance();
        }

        return this.transact.txid;
    }
};

StoreBcotTransaction.prototype.revertOutputAddresses = function () {
    if (this.txBuilt) {
        this.transact.revertOutputAddresses();
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

/*StoreBcotTransaction.class_func = function () {
};*/


// StoreBcotTransaction function class (public) properties
//

/*StoreBcotTransaction.prop = {};*/


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(StoreBcotTransaction);
