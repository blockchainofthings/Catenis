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
import { CatenisMessage } from './CatenisMessage';
import { CatenisNode } from './CatenisNode';
import { Device } from './Device';
import { FundSource } from './FundSource';
import { KeyStore } from './KeyStore';
import { Service } from './Service';
import { Transaction } from './Transaction';
import {
    getAddrAndAddrInfo,
    areAddressesFromSameDevice
} from './SendMessageTransaction';

// Definition of function classes
//

// LogMessageTransaction function class
//
//  Constructor arguments:
//    device: [Object] // Object of type Device identifying the device that is logging the message
//    message: [Object] // Object of type Buffer containing the message to be logged
//    options: {
//      encrypted: [Boolean], // Indicates whether message should be encrypted before storing it
//      storageScheme: [String], // A field of the CatenisMessage.storageScheme property identifying how the message should be stored
//      storageProvider: [Object] // (optional, default: defaultStorageProvider) A field of the CatenisMessage.storageProvider property
//                                //    identifying the type of external storage to be used to store the message that should not be embedded
//    }
//
// NOTE: make sure that objects of this function class are instantiated and used (their methods
//  called) from code executed from the FundSource.utxoCS critical section object
export function LogMessageTransaction(device, message, options) {
    if (device !== undefined) {
        // Validate arguments
        const errArg = {};

        if (!(device instanceof Device)) {
            errArg.device = device;
        }

        if (!Buffer.isBuffer(message)) {
            errArg.message = message;
        }

        if (typeof options !== 'object' || options === null || !('encrypted' in options) || !('storageScheme' in options) || !CatenisMessage.isValidStorageScheme(options.storageScheme)
            || (('storageProvider' in options) && options.storageProvider !== undefined && !CatenisMessage.isValidStorageProvider(options.storageProvider))) {
            errArg.options = options;
        }

        if (Object.keys(errArg).length > 0) {
            const errArgs = Object.keys(errArg);

            Catenis.logger.ERROR(util.format('LogMessageTransaction constructor called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
            throw new Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
        }

        // Just initialize instance variables for now
        this.transact = new Transaction();
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
        const devMainAddrFundSource = new FundSource(this.device.mainAddr.listAddressesInUse(), {});
        const devMainAddrBalance = devMainAddrFundSource.getBalance();
        const devMainAddrAllocResult = devMainAddrFundSource.allocateFund(Service.devMainAddrAmount);

        // Make sure that UTXOs have been correctly allocated
        if (devMainAddrAllocResult === null) {
            // Unable to allocate UTXOs. Log error condition and throw exception
            Catenis.logger.ERROR(util.format('Unable to allocate UTXOs for device (Id: %s) main addresses', this.device.deviceId));
            throw new Meteor.Error('ctn_log_msg_utxo_alloc_error', util.format('Unable to allocate UTXOs for device (Id: %s) main addresses', this.device.deviceId));
        }

        if (devMainAddrAllocResult.utxos.length !== 1) {
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

        // Add transaction outputs

        // Prepare to add null data output containing message data
        let msgToLog = undefined;

        if (this.options.encrypted) {
            // Encrypt message
            // noinspection JSUnusedGlobalSymbols
            msgToLog = this.encryptedMessage = this.deviceMainAddrKeys.encryptData(this.deviceMainAddrKeys, this.message);
        }
        else {
            msgToLog = this.message;
        }

        // Prepare message to log
        const ctnMessage = new CatenisMessage(msgToLog, CatenisMessage.functionByte.logMessage, this.options);

        if (!ctnMessage.isEmbedded()) {
            this.extMsgRef = ctnMessage.getExternalMessageReference();
        }

        // Add null data output
        this.transact.addNullDataOutput(ctnMessage.getData());

        // Prepare to add device main address refund output if necessary
        if (devMainAddrBalance <= Service.devMainAddrMinBalance) {
            const devMainAddrRefundKeys = this.device.mainAddr.newAddressKeys();

            // Add device main address refund output
            this.transact.addP2PKHOutput(devMainAddrRefundKeys.getAddress(), Service.devMainAddrAmount);
        }

        // NOTE: we do not care to check if change is not below dust amount because it is guaranteed
        //      that the change amount be a multiple of the basic amount that is allocated to device
        //      main addresses which in turn is guaranteed to not be below dust
        if (devMainAddrAllocResult.changeAmount > 0) {
            // Add device main address change output
            this.transact.addP2PKHOutput(this.device.mainAddr.newAddressKeys().getAddress(), devMainAddrAllocResult.changeAmount);
        }

        // Now, allocate UTXOs to pay for tx expense
        const payTxFundSource = new FundSource(Catenis.ctnHubNode.payTxExpenseAddr.listAddressesInUse(), {});
        const payTxAllocResult = payTxFundSource.allocateFundForTxExpense({
            txSize: this.transact.estimateSize(),
            inputAmount: this.transact.totalInputsAmount(),
            outputAmount: this.transact.totalOutputsAmount()
        }, false, Catenis.bitcoinFees.getFeeRateByTime(Service.minutesToConfirmMessage));

        if (payTxAllocResult === null) {
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

        if (payTxAllocResult.changeAmount >= Transaction.txOutputDustAmount) {
            // Add new output to receive change
            this.transact.addP2PKHOutput(Catenis.ctnHubNode.payTxExpenseAddr.newAddressKeys().getAddress(), payTxAllocResult.changeAmount);
        }

        // Indicate that transaction is already built
        this.txBuilt = true;
    }
};

//  Return value:
//    txid: [String]     // ID of blockchain transaction where message was recorded
LogMessageTransaction.prototype.sendTransaction = function () {
    // Check if transaction has not yet been created and sent
    if (this.transact.txid === undefined) {
        this.transact.sendTransaction();

        // Save sent transaction onto local database
        this.transact.saveSentTransaction(Transaction.type.log_message, {
            deviceId: this.device.deviceId
        });

        // TODO: issue either Spend Service Credit or Debit Service Account transaction to account for the service payment

        // Check if system pay tx expense addresses need to be refunded
        Catenis.ctnHubNode.checkPayTxExpenseFundingBalance();
    }

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
//    transact: [Object] // Object of type Transaction identifying the transaction to be checked
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
        //  NOTE: no need to check if the variables below are non-null because the transact.matches()
        //      result above already guarantees it
        const devMainAddr = getAddrAndAddrInfo(transact.getInputAt(0));

        let devMainRefundChangeAddr1 = undefined;
        let devMainRefundChangeAddr2 = undefined;

        for (let pos = 1; pos <= 2; pos++) {
            const output = transact.getOutputAt(pos);
            if (output !== undefined) {
                const outputAddr = getAddrAndAddrInfo(output.payInfo);
                if (outputAddr.addrInfo.type === KeyStore.extKeyType.dev_main_addr.name) {
                    if (devMainRefundChangeAddr1 === undefined) {
                        devMainRefundChangeAddr1 = outputAddr;
                    }
                    else {
                        devMainRefundChangeAddr2 = outputAddr;
                    }
                }
            }
        }

        if ((devMainRefundChangeAddr1 === undefined || (devMainRefundChangeAddr1.address !== devMainAddr.address && areAddressesFromSameDevice(devMainRefundChangeAddr1.addrInfo, devMainAddr.addrInfo))) &&
                (devMainRefundChangeAddr2 === undefined || (devMainRefundChangeAddr2.address !== devMainAddr.address && areAddressesFromSameDevice(devMainRefundChangeAddr2.addrInfo, devMainAddr.addrInfo)))) {
            // Now, check if data in null data output is correctly formatted
            let ctnMessage = undefined;

            try {
                ctnMessage = CatenisMessage.fromData(transact.getNullDataOutput().data, false);
            }
            catch(err) {
                if (!(err instanceof Meteor.Error) || err.error !== 'ctn_msg_data_parse_error') {
                    // An exception other than an indication that null data is not correctly formatted.
                    //  Just re-throws it
                    throw err;
                }
            }

            if (ctnMessage !== undefined && ctnMessage.isLogMessage()) {
                let message = undefined;

                if (ctnMessage.isEncrypted()) {
                    // Try to decrypt message
                    try {
                        message = devMainAddr.addrInfo.cryptoKeys.decryptData(devMainAddr.addrInfo.cryptoKeys, ctnMessage.getMessage());
                    }
                    catch (err) {
                        if (!(err instanceof Meteor.Error) || err.error !== 'ctn_crypto_no_priv_key') {
                            // An exception other than indication that message was not decrypted because
                            //  device has no private key. Just re-throws it
                            throw err;
                        }
                    }
                }
                else {
                    message = ctnMessage.getMessage();
                }

                if (message !== undefined) {
                    // Instantiate send message transaction
                    logMsgTransact = new LogMessageTransaction();

                    logMsgTransact.transact = transact;
                    logMsgTransact.device = CatenisNode.getCatenisNodeByIndex(devMainAddr.addrInfo.pathParts.ctnNodeIndex).getClientByIndex(devMainAddr.addrInfo.pathParts.clientIndex).getDeviceByIndex(devMainAddr.addrInfo.pathParts.deviceIndex);
                    logMsgTransact.deviceMainAddrKeys = devMainAddr.addrInfo.cryptoKeys;
                    logMsgTransact.message = message;       // Original contents of message as provided by device (always unencrypted)
                                                            //  NOTE: could be undefined if message could not be decrypted due to missing private key
                                                            //      for device that recorded the message (possibly because it belongs to a different Node)
                    logMsgTransact.rawMessage = ctnMessage.getMessage();    // Contents of message as it was recorded (encrypted, if encryption was used)
                    logMsgTransact.options = {
                        encrypted: ctnMessage.isEncrypted(),
                        storageScheme: ctnMessage.isEmbedded() ? CatenisMessage.storageScheme.embedded : CatenisMessage.storageScheme.external
                    };

                    if (!ctnMessage.isEmbedded()) {
                        logMsgTransact.options.storageProvider = ctnMessage.getStorageProvider();
                        logMsgTransact.extMsgRef = ctnMessage.getExternalMessageReference();
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
    input: util.format('^(?:%s)(?:%s)+$',
        Transaction.ioToken.p2_dev_main_addr.token,
        Transaction.ioToken.p2_sys_pay_tx_exp_addr.token),
    output: util.format('^(?:%s)(?:%s){0,2}(?:%s)?$',
        Transaction.ioToken.null_data.token,
        Transaction.ioToken.p2_dev_main_addr.token,
        Transaction.ioToken.p2_sys_pay_tx_exp_addr.token)
});


// Definition of module (private) functions
//


// Module code
//

// Lock function class
Object.freeze(LogMessageTransaction);
