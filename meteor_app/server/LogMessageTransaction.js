/**
 * Created by claudio on 29/12/16.
 */

//console.log('[LogMessageTransaction.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//  NOTE: the reference of these modules are done sing 'require()' instead of 'import' to
//      to avoid annoying WebStorm warning message: 'default export is not defined in
//      imported module'
const util = require('util');
// Third-party node modules
//import config from 'config';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { cfgSettings as deviceCfgSettings } from './Device';
import { Transaction } from './Transaction';


// Definition of function classes
//

// LogMessageTransaction function class
//
//  Constructor arguments:
//    device: [Object] // Object of type Catenis.module.Device identifying the device that is logging the message
//    message: [Object] // Object of type Buffer containing the message to be logged
//    options: {
//      encrypted: [Boolean], // Indicates whether message should be encrypted before storing it
//      storageScheme: [String], // A field of the Catenis.module.CatenisMessage.storageScheme property identifying how the message should be stored
//      storageProvider: [Object] // (optional, default: defaultStorageProvider) A field of the Catenis.module.CatenisMessage.storageProvider property
//                                //    identifying the type of external storage to be used to store the message that should not be embedded
//    }
//
// NOTE: make sure that objects of this function class are instantiated and used (their methods
//  called) from code executed from the FundSource.utxoCS critical section object
function LogMessageTransaction(device, message, options) {
    if (device != undefined) {
        // Validate arguments
        const errArg = {};

        if (!(device instanceof Catenis.module.Device)) {
            errArg.device = device;
        }

        if (!Buffer.isBuffer(message)) {
            errArg.message = message;
        }

        if (typeof options !== 'object' || options == null || !('encrypted' in options) || !('storageScheme' in options) || !Catenis.module.CatenisMessage.isValidStorageScheme(options.storageScheme)
            || (('storageProvider' in options) && options.storageProvider != undefined && !Catenis.module.CatenisMessage.isValidStorageProvider(options.storageProvider))) {
            errArg.options = options;
        }

        if (Object.keys(errArg).length > 0) {
            const errArgs = Object.keys(errArg);

            Catenis.logger.ERROR(util.format('LogMessageTransaction constructor called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
            throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
        }

        // Just initialize instance variables for now
        this.transact = new Catenis.module.Transaction();
        this.txBuilt = false;
        this.device = device;
        this.message = message;
        this.options = options;
    }
}


// Public LogMessageTransaction object methods
//

LogMessageTransaction.prototype.buildTransaction = function () {
    if (!this.txBuilt) {
        // Add transaction inputs

        // Prepare to add device main address input
        const devMainAddrFundSource = new Catenis.module.FundSource(this.device.mainAddr.listAddressesInUse(), {});
        const devMainAddrBalance = devMainAddrFundSource.getBalance();
        const devMainAddrAllocResult = devMainAddrFundSource.allocateFund(Catenis.module.Service.devMainAddrAmount);

        // Make sure that UTXOs have been correctly allocated
        if (devMainAddrAllocResult == null) {
            // Unable to allocate UTXOs. Log error condition and throw exception
            Catenis.logger.ERROR(util.format('Unable to allocate UTXOs for device (Id: %s) main addresses', this.device.deviceId));
            throw new Meteor.Error('ctn_log_msg_utxo_alloc_error', util.format('Unable to allocate UTXOs for device (Id: %s) main addresses', this.device.deviceId));
        }

        if (devMainAddrAllocResult.utxos.length != 1) {
            // An unexpected number of UTXOs have been allocated.
            // Log error condition and throw exception
            Catenis.logger.ERROR(util.format('An unexpected number of UTXOs have been allocated for device (Id: %s) main addresses', this.device.deviceId), {
                expected: 1,
                allocated: devMainAddrAllocResult.utxos.length
            });
            throw new Meteor.Error('ctn_log_msg_utxo_alloc_error', util.format('An unexpected number of UTXOs have been allocated for device (Id: %s) main addresses: expected: 1, allocated: %d', this.device.deviceId, devMainAddrAllocResult.utxos.length));
        }

        const devMainAddrAllocUtxo = devMainAddrAllocResult.utxos[0];
        const devMainAddrInfo = Catenis.keyStore.getAddressInfo(devMainAddrAllocUtxo.address);

        // Save device main address crypto keys
        this.deviceMainAddrKeys = devMainAddrInfo.cryptoKeys;

        // Add device main address input
        this.transact.addInput(devMainAddrAllocUtxo.txout, devMainAddrAllocUtxo.address, devMainAddrInfo);

        // Prepare to add client message credit input
        const clntMsgCreditAddrFundSource = new Catenis.module.FundSource(this.device.client.messageCreditAddr.listAddressesInUse(), {});
        const clntMsgCreditAddrAllocResult = clntMsgCreditAddrFundSource.allocateFund(Catenis.module.Service.clientServiceCreditAmount);

        // Make sure that UTXOs have been correctly allocated
        if (clntMsgCreditAddrAllocResult == null) {
            // No UTXO available to be allocated. Log error condition and throw exception
            Catenis.logger.ERROR(util.format('No UTXO available to be allocated for client (Id: %s) message credit addresses', this.device.client.clientId));
            throw new Meteor.Error('ctn_log_msg_no_utxo_msg_credit', util.format('No UTXO available to be allocated for client (Id: %s) message credit addresses', this.device.client.clientId));
        }

        if (clntMsgCreditAddrAllocResult.utxos.length != 1) {
            // An unexpected number of UTXOs have been allocated.
            // Log error condition and throw exception
            Catenis.logger.ERROR(util.format('An unexpected number of UTXOs have been allocated for client (Id: %s) message credit addresses', this.device.client.clientId), {
                expected: 1,
                allocated: clntMsgCreditAddrAllocResult.utxos.length
            });
            throw new Meteor.Error('ctn_log_msg_utxo_alloc_error', util.format('An unexpected number of UTXOs have been allocated for client (Id: %s) message credit addresses: expected: 1, allocated: %d', this.device.client.clientId, clntMsgCreditAddrAllocResult.utxos.length));
        }

        const clntMsgCreditAddrAllocUtxo = clntMsgCreditAddrAllocResult.utxos[0];
        const clntMsgCreditAddrInfo = Catenis.keyStore.getAddressInfo(clntMsgCreditAddrAllocUtxo.address);

        // Add client message credit address input
        this.transact.addInput(clntMsgCreditAddrAllocUtxo.txout, clntMsgCreditAddrAllocUtxo.address, clntMsgCreditAddrInfo);

        // Add transaction outputs

        // Prepare to add null data output containing message data
        let msgToLog = undefined;

        if (this.options.encrypted) {
            // Encrypt message
            msgToLog = this.encryptedMessage = this.deviceMainAddrKeys.encryptData(this.deviceMainAddrKeys, this.message);
        }
        else {
            msgToLog = this.message;
        }

        // Prepare message to log
        const ctnMessage = new Catenis.module.CatenisMessage(msgToLog, Catenis.module.CatenisMessage.functionByte.logMessage, this.options);

        // Add null data output
        this.transact.addNullDataOutput(ctnMessage.getData());

        // Prepare to add device main address refund output if necessary
        if (devMainAddrBalance <= Catenis.module.Service.devMainAddrMinBalance) {
            const devMainAddrRefundKeys = this.device.mainAddr.newAddressKeys();

            // Add device main address refund output
            this.transact.addP2PKHOutput(devMainAddrRefundKeys.getAddress(), Catenis.module.Service.devMainAddrAmount);
        }

        if (devMainAddrAllocResult.changeAmount > 0) {
            // Add device main address change output
            this.transact.addP2PKHOutput(this.device.mainAddr.newAddressKeys().getAddress(), devMainAddrAllocResult.changeAmount);
        }

        if (clntMsgCreditAddrAllocResult.changeAmount > 0) {
            // Add client message credit address change output
            this.transact.addP2PKHOutput(this.device.client.messageCreditAddr.newAddressKeys().getAddress(), clntMsgCreditAddrAllocResult.changeAmount);
        }

        // Now, allocate UTXOs to pay for tx expense
        const payTxFundSource = new Catenis.module.FundSource(Catenis.ctnHubNode.payTxExpenseAddr.listAddressesInUse(), {});
        const payTxAllocResult = payTxFundSource.allocateFundForTxExpense({
            txSize: this.transact.estimateSize(),
            inputAmount: this.transact.totalInputsAmount(),
            outputAmount: this.transact.totalOutputsAmount()
        }, false);

        if (payTxAllocResult == null) {
            // Unable to allocate UTXOs. Log error condition and throw exception
            Catenis.logger.ERROR('No UTXO available to be allocated to pay for transaction expense');
            throw new Meteor.Error('ctn_log_msg_no_utxo_pay_tx_expense', 'No UTXO available to be allocated to pay for transaction expense');
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

        if (payTxAllocResult.changeAmount > 0) {
            // Add new output to receive change
            this.transact.addP2PKHOutput(Catenis.ctnHubNode.payTxExpenseAddr.newAddressKeys().getAddress(), payTxAllocResult.changeAmount);
        }

        // Indicate that transaction is already built
        this.txBuilt = true;
    }
};

LogMessageTransaction.prototype.sendTransaction = function () {
    // Check if transaction has not yet been created and sent
    if (this.transact.txid == undefined) {
        this.transact.sendTransaction();

        // Save sent transaction onto local database
        this.transact.saveSentTransaction(Catenis.module.Transaction.type.log_message, {
            deviceId: this.device.deviceId
        });

        // Spend client message credit
        this.device.client.spendMessageCredit(deviceCfgSettings.creditsToLogMessage);

        // Check if system pay tx expense addresses need to be refunded
        Catenis.ctnHubNode.checkPayTxExpenseFundingBalance();
    }

    // Return transaction id
    return this.transact.txid;
};

LogMessageTransaction.prototype.revertOutputAddresses = function () {
    if (this.txBuilt) {
        this.transact.revertOutputAddresses();
    }
};


// Module functions used to simulate private LogMessageTransaction object methods
//  NOTE: these functions need to be bound to a LogMessageTransaction object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
 }*/


// LogMessageTransaction function class (public) methods
//

// Determines if transaction is a valid Catenis Log Message transaction
//
//  Arguments:
//    transact: [Object] // Object of type Catenis.module.Transaction identifying the transaction to be checked
//
//  Return:
//    - If transaction is not valid: undefined
//    - If transaction is valid: Object of type LogMessageTransaction created from transaction
//
LogMessageTransaction.checkTransaction = function (transact) {
    let logMsgTransact = undefined;

    // First, check if pattern of transaction's inputs and outputs is consistent
    if (transact.matches(LogMessageTransaction)) {
        // Validate and identify input and output addresses
        const devMainAddr = getAddrAndAddrInfo(transact.getInputAt(0));
        const clntMsgCreditAddr = getAddrAndAddrInfo(transact.getInputAt(1));

        let devMainRefundChangeAddr1 = undefined;
        let devMainRefundChangeAddr2 = undefined;
        let clntMsgCreditChangeAddr = undefined;

        for (let pos = 2; pos <= 4; pos++) {
            const output = transact.getOutputAt(1);
            if (output != undefined) {
                const outputAddr = getAddrAndAddrInfo(output.payInfo);
                if (outputAddr.addrInfo.type === Catenis.module.KeyStore.extKeyType.dev_main_addr.name) {
                    if (devMainRefundChangeAddr1 == undefined) {
                        devMainRefundChangeAddr1 = outputAddr;
                    }
                    else {
                        devMainRefundChangeAddr2 = outputAddr;
                    }
                }
                else if (outputAddr.addrInfo.type === Catenis.module.KeyStore.extKeyType.cln_msg_crd_addr.name) {
                    clntMsgCreditChangeAddr = outputAddr;
                }
            }
        }

        if ((devMainRefundChangeAddr1 != undefined && devMainRefundChangeAddr1.address != devMainAddr.address) ||
                (devMainRefundChangeAddr2 != undefined && devMainRefundChangeAddr2.address != devMainAddr.address) ||
                (clntMsgCreditChangeAddr != undefined && clntMsgCreditChangeAddr.address != clntMsgCreditAddr.address)) {
            // Now, check if data in null data output is correctly formatted
            let ctnMessage = undefined;

            try {
                ctnMessage = Catenis.module.CatenisMessage.fromData(transact.getNullDataOutput().data, false);
            }
            catch(err) {
                if (!(err instanceof Meteor.Error) || err.error !== 'ctn_msg_data_parse_error') {
                    // An exception other than an indication that null data is not correctedly formatted.
                    //  Just re-throws it
                    throw err;
                }
            }

            if (ctnMessage !== undefined && ctnMessage.funcByte == Catenis.module.CatenisMessage.functionByte.logMessage) {
                let message = undefined;

                if (ctnMessage.options.encrypted) {
                    // Try to decrypt message
                    try {
                        message = devMainAddr.addrInfo.cryptoKeys.decryptData(devMainAddr.addrInfo.cryptoKeys, ctnMessage.message);
                    }
                    catch (err) {}
                }
                else {
                    message = ctnMessage.message;
                }

                if (message != undefined) {
                    // Instantiate send message transaction
                    logMsgTransact = new LogMessageTransaction();

                    logMsgTransact.transact = transact;
                    logMsgTransact.device = Catenis.module.CatenisNode.getCatenisNodeByIndex(devMainAddr.addrInfo.pathParts.ctnNodeIndex).getClientByIndex(devMainAddr.addrInfo.pathParts.clientIndex).getDeviceByIndex(devMainAddr.addrInfo.pathParts.deviceIndex);
                    logMsgTransact.deviceMainAddrKeys = devMainAddr.addrInfo.cryptoKeys;
                    logMsgTransact.message = message;
                    logMsgTransact.options = {
                        encrypted: ctnMessage.options.encrypted,
                        storageScheme: ctnMessage.options.embedded ? Catenis.module.CatenisMessage.storageScheme.embedded : Catenis.module.CatenisMessage.storageScheme.externalStorage
                    };

                    if (ctnMessage.options.storageProvider != undefined) {
                        logMsgTransact.options.storageProvider = ctnMessage.options.storageProvider;
                    }
                }
            }
        }
    }

    return logMsgTransact;
};


// LogMessageTransaction function class (public) properties
//

LogMessageTransaction.matchingPattern = Object.freeze({
    input: util.format('^(?:%s)(?:%s)(?:%s)+$',
        Transaction.ioToken.p2_dev_main_addr.token,
        Transaction.ioToken.p2_cln_msg_crd_addr.token,
        Transaction.ioToken.p2_sys_pay_tx_exp_addr.token),
    output: util.format('^(?:%s)(?:%s){0,2}(?:%s)?(?:%s)?$',
        Transaction.ioToken.null_data.token,
        Transaction.ioToken.p2_dev_main_addr.token,
        Transaction.ioToken.p2_cln_msg_crd_addr.token,
        Transaction.ioToken.p2_sys_pay_tx_exp_addr.token)
});


// Definition of module (private) functions
//

function getAddrAndAddrInfo(obj) {
    return obj != undefined ? {
            address: obj.address,
            addrInfo: obj.addrInfo
        } : undefined;
}


// Module code
//

// Save module function class reference
Catenis.module.LogMessageTransaction = Object.freeze(LogMessageTransaction);
