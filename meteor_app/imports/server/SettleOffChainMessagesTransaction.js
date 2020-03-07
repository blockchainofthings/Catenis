/**
 * Created by claudio on 2019-12-17
 */

//console.log('[SettleOffChainMessagesTransaction.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import util from 'util';
// Third-party node modules
import ctnOffChainLib from 'catenis-off-chain-lib';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { CatenisMessage } from './CatenisMessage';
import { FundSource } from './FundSource';
import { Service } from './Service';
import { Transaction } from './Transaction';
import { BufferMessageDuplex } from './BufferMessageDuplex';
import { BufferMessageReadable } from './BufferMessageReadable';
import { KeyStore } from './KeyStore';

// Definition of function classes
//

// SettleOffChainMessagesTransaction function class
//
//  Constructor arguments:
//    batchDocument: [Object(ctnOffChainLib.BatchDocument)] Catenis off-chain messages batch document object
//
// NOTE: make sure that objects of this function class are instantiated and used (their methods
//  called) from code executed from the FundSource.utxoCS critical section object
export function SettleOffChainMessagesTransaction(batchDocument) {
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
                return this.transact.txid;
            },
            enumerable: true
        },
        innerTransact: {
            get: function () {
                // noinspection JSPotentiallyInvalidUsageOfThis
                return this.transact;
            },
            enumerable: true
        }
    });

    if (batchDocument !== undefined) {
        // Validate arguments
        const errArg = {};

        if (!(batchDocument instanceof ctnOffChainLib.BatchDocument)) {
            errArg.batchDocument = batchDocument;
        }

        if (Object.keys(errArg).length > 0) {
            const errArgs = Object.keys(errArg);

            Catenis.logger.ERROR(util.format('SettleOffChainMessagesTransaction constructor called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
            throw new Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
        }

        // Just initialize instance variables for now
        this.transact = new Transaction();
        this.txBuilt = false;
        this.batchDocument = batchDocument;
    }
}


// Public SettleOffChainMessagesTransaction object methods
//

SettleOffChainMessagesTransaction.prototype.containMsgDataFromLocalSender = function () {
    const senderPubKeyHashes = Array.from(this.batchDocument.mapSenderPubKeyHashes.keys());

    return !!Catenis.db.collection.IssuedOffChainAddress.findOne({pubKeyHash: {$in: senderPubKeyHashes}}, {fields: {_id: 1}});
};

SettleOffChainMessagesTransaction.prototype.buildTransaction = function () {
    if (!this.txBuilt) {
        // Add transaction outputs

        // Prepare to add null data output containing Catenis off-chain messages
        //  batch document reference

        const messageReadable = new BufferMessageReadable(this.batchDocument.buffer);

        // Prepare (special system) message with (IPFS) reference to Catenis off-chain
        //  messages batch document
        const ctnMessage = new CatenisMessage(messageReadable, CatenisMessage.functionByte.settleOffChaiMessages, {
            encrypted: false,
            storageScheme: CatenisMessage.storageScheme.external
        });

        // >>> Is it really necessary?
        this.extMsgRef = ctnMessage.getExternalMessageReference();

        // Add null data output
        this.transact.addNullDataOutput(ctnMessage.getData());

        // Now, allocate UTXOs to pay for tx expense
        const payTxFundSource = new FundSource(Catenis.ctnHubNode.ocMsgsSetlmtPayTxExpenseAddr.listAddressesInUse(), {
            useUnconfirmedUtxo: true,
            smallestChange: true
        });
        const payTxAllocResult = payTxFundSource.allocateFundForTxExpense({
            txSize: this.transact.estimateSize(),
            inputAmount: this.transact.totalInputsAmount(),
            outputAmount: this.transact.totalOutputsAmount()
        }, false, Service.feeRateForOffChainMsgsSettlement);

        if (payTxAllocResult === null) {
            // Unable to allocate UTXOs. Log error condition and throw exception
            Catenis.logger.ERROR('No UTXO available to be allocated to pay for settle off-chain messages transaction expense');
            throw new Meteor.Error('ctn_settle_oc_msgs_no_utxo_pay_tx_expense', 'No UTXO available to be allocated to pay for settle off-chain messages transaction expense');
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

        this.transact.addInputs(inputs);

        if (payTxAllocResult.changeAmount >= Transaction.txOutputDustAmount) {
            // Add new output to receive change
            this.transact.addPubKeyHashOutput(Catenis.ctnHubNode.ocMsgsSetlmtPayTxExpenseAddr.newAddressKeys().getAddress(), payTxAllocResult.changeAmount);
        }

        // Indicate that transaction is already built
        this.txBuilt = true;
    }
};

//  Return value:
//    txid: [String]     // ID of blockchain transaction where message was recorded
SettleOffChainMessagesTransaction.prototype.sendTransaction = function () {
    // Check if transaction has not yet been created and sent
    if (this.transact.txid === undefined) {
        this.transact.sendTransaction();

        // Save sent transaction onto local database
        this.transact.saveSentTransaction(Transaction.type.settle_off_chain_messages, {
            offChainMsgDataCids: this.batchDocument.msgDataCids
        });

        // Check if system off-chain messages settlement pay tx expense addresses need to be refunded
        Catenis.ctnHubNode.checkOCMessagesSettlementPayTxExpenseFundingBalance();
    }

    return this.transact.txid;
};

SettleOffChainMessagesTransaction.prototype.revertOutputAddresses = function () {
    if (this.txBuilt) {
        this.transact.revertOutputAddresses();
    }
};


// Module functions used to simulate private SettleOffChainMessagesTransaction object methods
//  NOTE: these functions need to be bound to a SettleOffChainMessagesTransaction object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
 }*/


// SettleOffChainMessagesTransaction function class (public) methods
//

// This method is to be used by Transaction Monitor to filter out transactions that are likely
//  to be a Catenis Settle Off-Chain Messages transaction
//
//  Arguments:
//   voutInfo: [Object(Map)] - Map object containing information about a transaction's outputs. This is obtained
//                              by calling the internal parseTxVouts method of the TransactionMonitor module
SettleOffChainMessagesTransaction.isValidTxVouts = function (voutInfo) {
    let result = false;

    if (voutInfo.has(0)) {
        for (let [vout, value] of voutInfo) {
            if (vout === 0) {
                if (value.isNullData) {
                    result = true;
                }
                else {
                    result = false;
                    break;
                }
            }
            else if (vout === 1) {
                if (!value.isNullData && value.addrInfo.type === KeyStore.extKeyType.sys_oc_msgs_setlmt_pay_tx_exp_addr.name) {
                    result = true;
                }
                else {
                    result = false;
                    break;
                }
            }
            else {
                result = false;
                break;
            }
        }
    }

    return result;
};

// Determines if transaction is a valid Catenis Settle Off-Chain Messages transaction
//
//  Arguments:
//    transact: [Object] - Object of type Transaction identifying the transaction to be checked
//
//  Return:
//    - If transaction is not valid: undefined
//    - If transaction is valid: Object of type SettleOffChainMessagesTransaction created from transaction
//
SettleOffChainMessagesTransaction.checkTransaction = function (transact) {
    let settleOCMsgsTransact = undefined;

    // First, check if pattern of transaction's inputs and outputs is consistent
    if (transact.matches(SettleOffChainMessagesTransaction)) {
        // Prepare to retrieve (special system) message
        const messageDuplex = new BufferMessageDuplex();

        // Parse the message data from the null data output
        let ctnMessage;

        try {
            ctnMessage = CatenisMessage.fromData(transact.getNullDataOutput().data, messageDuplex, false);
        }
        catch (err) {
            if (!(err instanceof Meteor.Error) || err.error !== 'ctn_msg_data_parse_error') {
                // An exception other than an indication that null data is not correctly formatted.
                //  Just re-throws it
                throw err;
            }
        }

        if (ctnMessage && ctnMessage.isSettleOffChainMessages()) {
            // Parse Catenis off-chain messages batch document
            let batchDocument;

            try {
                batchDocument = ctnOffChainLib.BatchDocument.fromBuffer(ctnMessage.getMessageReadable().read());
            }
            catch (err) {}

            if (batchDocument) {
                // Instantiate settle off-chain messages transaction
                // noinspection JSValidateTypes
                settleOCMsgsTransact = new SettleOffChainMessagesTransaction();

                settleOCMsgsTransact.transact = transact;
                settleOCMsgsTransact.batchDocument = batchDocument;
                settleOCMsgsTransact.extMsgRef = ctnMessage.getExternalMessageReference();
            }
        }
    }

    return settleOCMsgsTransact;
};


// SettleOffChainMessagesTransaction function class (public) properties
//

SettleOffChainMessagesTransaction.matchingPattern = Object.freeze({
    input: util.format('^(?:%s)+$',
        Transaction.ioToken.p2_sys_oc_msgs_setlmt_pay_tx_exp_addr.token),
    output: util.format('^(?:%s)(?:%s)?$',
        Transaction.ioToken.null_data.token,
        Transaction.ioToken.p2_sys_oc_msgs_setlmt_pay_tx_exp_addr.token)
});


// Definition of module (private) functions
//


// Module code
//

// Lock function class
Object.freeze(SettleOffChainMessagesTransaction);
