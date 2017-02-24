/**
 * Created by claudio on 19/11/16.
 */

//console.log('[SendMessageTransaction.js]: This code just ran.');

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
import { CatenisMessage } from './CatenisMessage';
import { CatenisNode } from './CatenisNode';
import { Device } from './Device';
import { FundSource } from './FundSource';
import { KeyStore } from './KeyStore';
import { Service } from './Service';
import { Transaction } from './Transaction';


// Definition of function classes
//

// SendMessageTransaction function class
//
//  Constructor arguments:
//    originDevice: [Object] // Object of type Device identifying the device that is sending the message
//    targetDevice: [Object] // Object of type Device identifying the device to which the message is sent
//    message: [Object] // Object of type Buffer containing the message to be sent
//    options: {
//      encrypted: [Boolean], // Indicates whether message should be encrypted before storing it
//      storageScheme: [String], // A field of the CatenisMessage.storageScheme property identifying how the message should be stored
//      storageProvider: [Object] // (optional, default: defaultStorageProvider) A field of the CatenisMessage.storageProvider property
//                                //    identifying the type of external storage to be used to store the message that should not be embedded
//    }
//
// NOTE: make sure that objects of this function class are instantiated and used (their methods
//  called) from code executed from the FundSource.utxoCS critical section object
export function SendMessageTransaction(originDevice, targetDevice, message, options) {
    if (originDevice != undefined) {
        // Validate arguments
        const errArg = {};

        if (!(originDevice instanceof Device)) {
            errArg.originDevice = originDevice;
        }

        if (!(targetDevice instanceof Device)) {
            errArg.targetDevice = targetDevice;
        }

        if (!Buffer.isBuffer(message)) {
            errArg.message = message;
        }

        if (typeof options !== 'object' || options == null || !('encrypted' in options) || !('storageScheme' in options) || !CatenisMessage.isValidStorageScheme(options.storageScheme)
            || (('storageProvider' in options) && options.storageProvider != undefined && !CatenisMessage.isValidStorageProvider(options.storageProvider))) {
            errArg.options = options;
        }

        if (Object.keys(errArg).length > 0) {
            const errArgs = Object.keys(errArg);

            Catenis.logger.ERROR(util.format('SendMessageTransaction constructor called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
            throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
        }

        // Just initialize instance variables for now
        this.transact = new Transaction();
        this.txBuilt = false;
        this.originDevice = originDevice;
        this.targetDevice = targetDevice;
        this.message = message;
        this.options = options;
    }
}


// Public SendMessageTransaction object methods
//

SendMessageTransaction.prototype.buildTransaction = function () {
    if (!this.txBuilt) {
        // Add transaction inputs

        // Prepare to add origin device main address input
        const origDevMainAddrFundSource = new FundSource(this.originDevice.mainAddr.listAddressesInUse(), {});
        const origDevMainAddrBalance = origDevMainAddrFundSource.getBalance();
        const origDevMainAddrAllocResult = origDevMainAddrFundSource.allocateFund(Service.devMainAddrAmount);

        // Make sure that UTXOs have been correctly allocated
        if (origDevMainAddrAllocResult == null) {
            // Unable to allocate UTXOs. Log error condition and throw exception
            Catenis.logger.ERROR(util.format('Unable to allocate UTXOs for device (Id: %s) main addresses', this.originDevice.deviceId));
            throw new Meteor.Error('ctn_send_msg_utxo_alloc_error', util.format('Unable to allocate UTXOs for device (Id: %s) main addresses', this.originDevice.deviceId));
        }

        if (origDevMainAddrAllocResult.utxos.length != 1) {
            // An unexpected number of UTXOs have been allocated.
            // Log error condition and throw exception
            Catenis.logger.ERROR(util.format('An unexpected number of UTXOs have been allocated for device (Id: %s) main addresses', this.originDevice.deviceId), {
                expected: 1,
                allocated: origDevMainAddrAllocResult.utxos.length
            });
            throw new Meteor.Error('ctn_send_msg_utxo_alloc_error', util.format('An unexpected number of UTXOs have been allocated for device (Id: %s) main addresses: expected: 1, allocated: %d', this.originDevice.deviceId, origDevMainAddrAllocResult.utxos.length));
        }

        const origDevMainAddrAllocUtxo = origDevMainAddrAllocResult.utxos[0];
        const origDevMainAddrInfo = Catenis.keyStore.getAddressInfo(origDevMainAddrAllocUtxo.address);

        // Save origin device main address crypto keys
        this.originDeviceMainAddrKeys = origDevMainAddrInfo.cryptoKeys;

        // Add origin device main address input
        this.transact.addInput(origDevMainAddrAllocUtxo.txout, origDevMainAddrAllocUtxo.address, origDevMainAddrInfo);

        // Prepare to add client message credit input
        const clntMsgCreditAddrFundSource = new FundSource(this.originDevice.client.messageCreditAddr.listAddressesInUse(), {});
        const clntMsgCreditAddrAllocResult = clntMsgCreditAddrFundSource.allocateFund(Service.clientServiceCreditAmount);

        // Make sure that UTXOs have been correctly allocated
        if (clntMsgCreditAddrAllocResult == null) {
            // No UTXO available to be allocated. Log error condition and throw exception
            Catenis.logger.ERROR(util.format('No UTXO available to be allocated for client (Id: %s) message credit addresses', this.originDevice.client.clientId));
            throw new Meteor.Error('ctn_send_msg_no_utxo_msg_credit', util.format('No UTXO available to be allocated for client (Id: %s) message credit addresses', this.originDevice.client.clientId));
        }

        if (clntMsgCreditAddrAllocResult.utxos.length != 1) {
            // An unexpected number of UTXOs have been allocated.
            // Log error condition and throw exception
            Catenis.logger.ERROR(util.format('An unexpected number of UTXOs have been allocated for client (Id: %s) message credit addresses', this.originDevice.client.clientId), {
                expected: 1,
                allocated: clntMsgCreditAddrAllocResult.utxos.length
            });
            throw new Meteor.Error('ctn_send_msg_utxo_alloc_error', util.format('An unexpected number of UTXOs have been allocated for client (Id: %s) message credit addresses: expected: 1, allocated: %d', this.originDevice.client.clientId, clntMsgCreditAddrAllocResult.utxos.length));
        }

        const clntMsgCreditAddrAllocUtxo = clntMsgCreditAddrAllocResult.utxos[0];
        const clntMsgCreditAddrInfo = Catenis.keyStore.getAddressInfo(clntMsgCreditAddrAllocUtxo.address);

        // Add client message credit address input
        this.transact.addInput(clntMsgCreditAddrAllocUtxo.txout, clntMsgCreditAddrAllocUtxo.address, clntMsgCreditAddrInfo);

        // Add transaction outputs

        // Prepare to add target device main address output
        this.targetDeviceMainAddrKeys = this.targetDevice.mainAddr.newAddressKeys();

        // Add target device main address output
        this.transact.addP2PKHOutput(this.targetDeviceMainAddrKeys.getAddress(), Service.devMainAddrAmount);

        // Prepare to add target device read confirmation output
        const trgtDevReadConfirmAddrKeys = this.targetDevice.readConfirmAddr.newAddressKeys();

        // Add target device read confirmation output
        this.transact.addP2PKHOutput(trgtDevReadConfirmAddrKeys.getAddress(), Service.devReadConfirmAddrAmount);

        // Prepare to add null data output containing message data
        let msgToSend = undefined;

        if (this.options.encrypted) {
            // Encrypt message
            msgToSend = this.encryptedMessage = this.originDeviceMainAddrKeys.encryptData(this.targetDeviceMainAddrKeys, this.message);
        }
        else {
            msgToSend = this.message;
        }

        // Prepare message to send
        const ctnMessage = new CatenisMessage(msgToSend, CatenisMessage.functionByte.sendMessage, this.options);

        // Add null data output
        this.transact.addNullDataOutput(ctnMessage.getData());

        // Prepare to add origin device main address refund output if necessary
        if (origDevMainAddrBalance <= Service.devMainAddrMinBalance) {
            const origDevMainAddrRefundKeys = this.originDevice.mainAddr.newAddressKeys();

            // Add origin device main address refund output
            this.transact.addP2PKHOutput(origDevMainAddrRefundKeys.getAddress(), Service.devMainAddrAmount);
        }

        if (origDevMainAddrAllocResult.changeAmount > 0) {
            // Add origin device main address change output
            this.transact.addP2PKHOutput(this.originDevice.mainAddr.newAddressKeys().getAddress(), origDevMainAddrAllocResult.changeAmount);
        }

        if (clntMsgCreditAddrAllocResult.changeAmount > 0) {
            // Add client message credit address change output
            this.transact.addP2PKHOutput(this.originDevice.client.messageCreditAddr.newAddressKeys().getAddress(), clntMsgCreditAddrAllocResult.changeAmount);
        }

        // Now, allocate UTXOs to pay for tx expense
        const payTxFundSource = new FundSource(Catenis.ctnHubNode.payTxExpenseAddr.listAddressesInUse(), {});
        const payTxAllocResult = payTxFundSource.allocateFundForTxExpense({
            txSize: this.transact.estimateSize(),
            inputAmount: this.transact.totalInputsAmount(),
            outputAmount: this.transact.totalOutputsAmount()
        }, false);

        if (payTxAllocResult == null) {
            // Unable to allocate UTXOs. Log error condition and throw exception
            Catenis.logger.ERROR('No UTXO available to be allocated to pay for transaction expense');
            throw new Meteor.Error('ctn_send_msg_no_utxo_pay_tx_expense', 'No UTXO available to be allocated to pay for transaction expense');
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

SendMessageTransaction.prototype.sendTransaction = function () {
    // Check if transaction has not yet been created and sent
    if (this.transact.txid == undefined) {
        this.transact.sendTransaction();

        // Save sent transaction onto local database
        this.transact.saveSentTransaction(Transaction.type.send_message, {
            originDeviceId: this.originDevice.deviceId,
            targetDeviceId: this.targetDevice.deviceId,
            readConfirmation: {
                vout: 1
            }
        });

        // Spend client message credit
        this.originDevice.client.spendMessageCredit(deviceCfgSettings.creditsToSendMessage);

        // Check if system pay tx expense addresses need to be refunded
        Catenis.ctnHubNode.checkPayTxExpenseFundingBalance();
    }

    // Return transaction id
    return this.transact.txid;
};

SendMessageTransaction.prototype.revertOutputAddresses = function () {
    if (this.txBuilt) {
        this.transact.revertOutputAddresses();
    }
};


// Module functions used to simulate private SendMessageTransaction object methods
//  NOTE: these functions need to be bound to a SendMessageTransaction object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// SendMessageTransaction function class (public) methods
//

// Determines if transaction is a valid Catenis Send Message transaction
//
//  Arguments:
//    transact: [Object] // Object of type Transaction identifying the transaction to be checked
//
//  Return:
//    - If transaction is not valid: undefined
//    - If transaction is valid: Object of type SendMessageTransaction created from transaction
//
SendMessageTransaction.checkTransaction = function (transact) {
    let sendMsgTransact = undefined;

    // First, check if pattern of transaction's inputs and outputs is consistent
    if (transact.matches(SendMessageTransaction)) {
        // Validate and identify input and output addresses
        const origDevMainAddr = getAddrAndAddrInfo(transact.getInputAt(0));
        const clntMsgCreditAddr = getAddrAndAddrInfo(transact.getInputAt(1));
        const trgtDevMainAddr = getAddrAndAddrInfo(transact.getOutputAt(0).payInfo);
        const trgtDevReadConfirmAddr = getAddrAndAddrInfo(transact.getOutputAt(1).payInfo);

        let origDevMainRefundChangeAddr1 = undefined;
        let origDevMainRefundChangeAddr2 = undefined;
        let clntMsgCreditChangeAddr = undefined;

        for (let pos = 2; pos <= 4; pos++) {
            const output = transact.getOutputAt(1);
            if (output != undefined) {
                const outputAddr = getAddrAndAddrInfo(output.payInfo);
                if (outputAddr.addrInfo.type === KeyStore.extKeyType.dev_main_addr.name) {
                    if (origDevMainRefundChangeAddr1 == undefined) {
                        origDevMainRefundChangeAddr1 = outputAddr;
                    }
                    else {
                        origDevMainRefundChangeAddr2 = outputAddr;
                    }
                }
                else if (outputAddr.addrInfo.type === KeyStore.extKeyType.cln_msg_crd_addr.name) {
                    clntMsgCreditChangeAddr = outputAddr;
                }
            }
        }

        if (trgtDevReadConfirmAddr.address != trgtDevMainAddr.address ||
                (origDevMainRefundChangeAddr1 != undefined && origDevMainRefundChangeAddr1.address != origDevMainAddr.address) ||
                (origDevMainRefundChangeAddr2 != undefined && origDevMainRefundChangeAddr2.address != origDevMainAddr.address) ||
                (clntMsgCreditChangeAddr != undefined && clntMsgCreditChangeAddr.address != clntMsgCreditAddr.address)) {
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

            if (ctnMessage !== undefined && ctnMessage.funcByte == CatenisMessage.functionByte.sendMessage) {
                let message = undefined;

                if (ctnMessage.options.encrypted) {
                    // Try to decrypt message
                    try {
                        message = trgtDevMainAddr.addrInfo.cryptoKeys.decryptData(origDevMainAddr.addrInfo.cryptoKeys, ctnMessage.message);
                    }
                    catch (err) {
                        if (!(err instanceof Meteor.Error) || err.error !== 'ctn_crypto_no_priv_key') {
                            // An exception other than indication that message was not decrypted because
                            //  target device has no private key. Just re-throws it
                            throw err;
                        }
                    }
                }
                else {
                    message = ctnMessage.message;
                }

                // Instantiate send message transaction
                sendMsgTransact = new SendMessageTransaction();

                sendMsgTransact.transact = transact;
                sendMsgTransact.originDevice = CatenisNode.getCatenisNodeByIndex(origDevMainAddr.addrInfo.pathParts.ctnNodeIndex).getClientByIndex(origDevMainAddr.addrInfo.pathParts.clientIndex).getDeviceByIndex(origDevMainAddr.addrInfo.pathParts.deviceIndex);
                sendMsgTransact.targetDevice = CatenisNode.getCatenisNodeByIndex(trgtDevMainAddr.addrInfo.pathParts.ctnNodeIndex).getClientByIndex(trgtDevMainAddr.addrInfo.pathParts.clientIndex).getDeviceByIndex(trgtDevMainAddr.addrInfo.pathParts.deviceIndex);
                sendMsgTransact.originDeviceMainAddrKeys = origDevMainAddr.addrInfo.cryptoKeys;
                sendMsgTransact.targetDeviceMainAddrKeys = trgtDevMainAddr.addrInfo.cryptoKeys;
                sendMsgTransact.message = message;      // Original contents of message as provided by origin device (always unencrypted)
                                                        //  NOTE: could be undefined if message could not be decrypted due to missing private key
                                                        //      for target device
                sendMsgTransact.rawMessage = ctnMessage.message;    // Contents of message as it was recorded (encrypted, if encryption was used)
                sendMsgTransact.options = {
                    encrypted: ctnMessage.options.encrypted,
                    storageScheme: ctnMessage.options.embedded ? CatenisMessage.storageScheme.embedded : CatenisMessage.storageScheme.external
                };

                if (ctnMessage.options.storageProvider != undefined) {
                    sendMsgTransact.options.storageProvider = ctnMessage.options.storageProvider;
                }
            }
        }
    }

    return sendMsgTransact;
};


// SendMessageTransaction function class (public) properties
//

SendMessageTransaction.matchingPattern = Object.freeze({
    input: util.format('^(?:%s)(?:%s)(?:%s)+$',
            Transaction.ioToken.p2_dev_main_addr.token,
            Transaction.ioToken.p2_cln_msg_crd_addr.token,
            Transaction.ioToken.p2_sys_pay_tx_exp_addr.token),
    output: util.format('^(?:%s)(?:%s)(?:%s)(?:%s){0,2}(?:%s)?(?:%s)?$',
            Transaction.ioToken.p2_dev_main_addr.token,
            Transaction.ioToken.p2_dev_read_conf_addr.token,
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

// Lock function class
Object.freeze(SendMessageTransaction);
