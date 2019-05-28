/**
 * Created by Claudio on 2016-11-19.
 */

//console.log('[SendMessageTransaction.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import util from 'util';
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
import { MessageReadable } from './MessageReadable';
import { BufferMessageDuplex } from './BufferMessageDuplex';


// Definition of function classes
//

// SendMessageTransaction function class
//
//  Constructor arguments:
//    originDevice: [Object(Device)] - Object of type Device identifying the device that is sending the message
//    targetDevice: [Object(Device)] - Object of type Device identifying the device to which the message is sent
//    messageReadable: [Object(MessageReadable)] // Stream used to read contents of message to be sent
//    options: {
//      readConfirmation: [Boolean], - Indicates whether transaction should include support for read confirmation in it
//      encrypted: [Boolean], - Indicates whether message should be encrypted before storing it
//      storageScheme: [String], - A field of the CatenisMessage.storageScheme property identifying how the message should be stored
//      storageProvider: [Object] - (optional, default: defaultStorageProvider) A field of the CatenisMessage.storageProvider property
//                                -    identifying the type of external storage to be used to store the message that should not be embedded
//    }
//
// NOTE: make sure that objects of this function class are instantiated and used (their methods
//  called) from code executed from the FundSource.utxoCS critical section object
export function SendMessageTransaction(originDevice, targetDevice, messageReadable, options) {
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

    if (originDevice !== undefined) {
        // Validate arguments
        const errArg = {};

        if (!(originDevice instanceof Device)) {
            errArg.originDevice = originDevice;
        }

        if (!(targetDevice instanceof Device)) {
            errArg.targetDevice = targetDevice;
        }

        if (!(messageReadable instanceof MessageReadable)) {
            errArg.messageReadable = messageReadable;
        }

        if (typeof options !== 'object' || options === null || !('readConfirmation' in options) || !('encrypted' in options) || !('storageScheme' in options) || !CatenisMessage.isValidStorageScheme(options.storageScheme)
            || (('storageProvider' in options) && options.storageProvider !== undefined && !CatenisMessage.isValidStorageProvider(options.storageProvider))) {
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
        this.messageReadable = messageReadable;
        this.options = options;
    }
}


// Public SendMessageTransaction object methods
//

SendMessageTransaction.prototype.buildTransaction = function () {
    if (!this.txBuilt) {
        // Add transaction inputs

        // Prepare to add origin device main address input
        const origDevMainAddrFundSource = new FundSource(this.originDevice.mainAddr.listAddressesInUse(), {
            useUnconfirmedUtxo: true,
            unconfUtxoInfo: {
                initTxInputs: this.transact.inputs
            }
        });
        const origDevMainAddrBalance = origDevMainAddrFundSource.getBalance();
        const origDevMainAddrAllocResult = origDevMainAddrFundSource.allocateFund(Service.devMainAddrAmount);

        // Make sure that UTXOs have been correctly allocated
        if (origDevMainAddrAllocResult === null) {
            // Unable to allocate UTXOs. Log error condition and throw exception
            Catenis.logger.ERROR(util.format('Unable to allocate UTXOs for device (Id: %s) main addresses', this.originDevice.deviceId));
            throw new Meteor.Error('ctn_send_msg_utxo_alloc_error', util.format('Unable to allocate UTXOs for device (Id: %s) main addresses', this.originDevice.deviceId));
        }

        if (origDevMainAddrAllocResult.utxos.length !== 1) {
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

        // Add transaction outputs

        // Prepare to add target device main address output
        this.targetDeviceMainAddrKeys = this.targetDevice.mainAddr.newAddressKeys();

        // Add target device main address output
        this.transact.addP2PKHOutput(this.targetDeviceMainAddrKeys.getAddress(), Service.devMainAddrAmount);

        if (this.options.readConfirmation) {
            // Prepare to add target device read confirmation output
            const trgtDevReadConfirmAddrKeys = this.targetDevice.readConfirmAddr.newAddressKeys();

            // Add target device read confirmation output
            this.transact.addP2PKHOutput(trgtDevReadConfirmAddrKeys.getAddress(), Service.devReadConfirmAddrAmount);
        }

        // Prepare to add null data output containing message data
        if (this.options.encrypted) {
            // Set up message stream to encrypt message's contents as it is read
            this.messageReadable.setEncryption(this.originDeviceMainAddrKeys, this.targetDeviceMainAddrKeys);
        }

        // Prepare message to send
        const ctnMessage = new CatenisMessage(this.messageReadable, CatenisMessage.functionByte.sendMessage, this.options);

        if (!ctnMessage.isEmbedded()) {
            this.extMsgRef = ctnMessage.getExternalMessageReference();
        }

        // Add null data output
        this.transact.addNullDataOutput(ctnMessage.getData());

        // Prepare to add origin device main address refund output if necessary
        if (origDevMainAddrBalance <= Service.devMainAddrMinBalance) {
            const origDevMainAddrRefundKeys = this.originDevice.mainAddr.newAddressKeys();

            // Add origin device main address refund output
            this.transact.addP2PKHOutput(origDevMainAddrRefundKeys.getAddress(), Service.devMainAddrAmount);
        }

        // NOTE: we do not care to check if change is not below dust amount because it is guaranteed
        //      that the change amount be a multiple of the basic amount that is allocated to device
        //      main addresses which in turn is guaranteed to not be below dust
        if (origDevMainAddrAllocResult.changeAmount > 0) {
            // Add origin device main address change output
            this.transact.addP2PKHOutput(this.originDevice.mainAddr.newAddressKeys().getAddress(), origDevMainAddrAllocResult.changeAmount);
        }

        // Now, allocate UTXOs to pay for tx expense
        const payTxFundSource = new FundSource(Catenis.ctnHubNode.payTxExpenseAddr.listAddressesInUse(), {
            useUnconfirmedUtxo: true,
            unconfUtxoInfo: {
                initTxInputs: this.transact.inputs
            },
            smallestChange: true
        });
        const payTxAllocResult = payTxFundSource.allocateFundForTxExpense({
            txSize: this.transact.estimateSize(),
            inputAmount: this.transact.totalInputsAmount(),
            outputAmount: this.transact.totalOutputsAmount()
        }, false, Catenis.bitcoinFees.getFeeRateByTime(Service.minutesToConfirmMessage));

        if (payTxAllocResult === null) {
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

        if (payTxAllocResult.changeAmount >= Transaction.txOutputDustAmount) {
            // Add new output to receive change
            this.transact.addP2PKHOutput(Catenis.ctnHubNode.payTxExpenseAddr.newAddressKeys().getAddress(), payTxAllocResult.changeAmount);
        }

        // Indicate that transaction is already built
        this.txBuilt = true;
    }
};

//  Return value:
//    txid: [String]       // ID of blockchain transaction where message was recorded
SendMessageTransaction.prototype.sendTransaction = function () {
    // Check if transaction has not yet been created and sent
    if (this.transact.txid === undefined) {
        this.transact.sendTransaction();

        // Save sent transaction onto local database
        const info = {
            originDeviceId: this.originDevice.deviceId,
            targetDeviceId: this.targetDevice.deviceId
        };

        if (this.options.readConfirmation) {
            info.readConfirmation = {
                vout: 1
            }
        }

        this.transact.saveSentTransaction(Transaction.type.send_message, info);

        // Check if system pay tx expense addresses need to be refunded
        Catenis.ctnHubNode.checkPayTxExpenseFundingBalance();
    }

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
//    transact: [Object] - Object of type Transaction identifying the transaction to be checked
//    messageDuplex: [Object(MessageDuplex)] - (optional) Stream used to write retrieve message's contents
//
//  Return:
//    - If transaction is not valid: undefined
//    - If transaction is valid: Object of type SendMessageTransaction created from transaction
//
SendMessageTransaction.checkTransaction = function (transact, messageDuplex) {
    let sendMsgTransact = undefined;

    // First, check if pattern of transaction's inputs and outputs is consistent
    if (transact.matches(SendMessageTransaction)) {
        // Validate and identify input and output addresses
        //  NOTE: no need to check if the variables below are non-null because the transact.matches()
        //      result above already guarantees it
        const origDevMainAddr = getAddrAndAddrInfo(transact.getInputAt(0));
        const trgtDevMainAddr = getAddrAndAddrInfo(transact.getOutputAt(0).payInfo);

        // Determine if device read confirmation address output is present
        const output2 = transact.getOutputAt(1);
        let trgtDevReadConfirmAddr;
        let nextOutputPos = 2;

        if (output2.type !== Transaction.outputType.nullData) {
            // Yes, it is present. Get it and adjust next output (after null data output) position
            trgtDevReadConfirmAddr = getAddrAndAddrInfo(output2.payInfo);
            nextOutputPos++;
        }

        let origDevMainRefundChangeAddr1 = undefined;
        let origDevMainRefundChangeAddr2 = undefined;

        for (let pos = nextOutputPos, limit = nextOutputPos + 1; pos <= limit; pos++) {
            const output = transact.getOutputAt(pos);
            if (output !== undefined) {
                const outputAddr = getAddrAndAddrInfo(output.payInfo);
                if (outputAddr.addrInfo.type === KeyStore.extKeyType.dev_main_addr.name) {
                    if (origDevMainRefundChangeAddr1 === undefined) {
                        origDevMainRefundChangeAddr1 = outputAddr;
                    }
                    else {
                        origDevMainRefundChangeAddr2 = outputAddr;
                    }
                }
            }
        }

        if (trgtDevMainAddr.address !== origDevMainAddr.address &&
                (origDevMainRefundChangeAddr1 === undefined || (origDevMainRefundChangeAddr1.address !== origDevMainAddr.address && areAddressesFromSameDevice(origDevMainRefundChangeAddr1.addrInfo, origDevMainAddr.addrInfo))) &&
                (origDevMainRefundChangeAddr2 === undefined || (origDevMainRefundChangeAddr2.address !== origDevMainAddr.address && areAddressesFromSameDevice(origDevMainRefundChangeAddr2.addrInfo, origDevMainAddr.addrInfo)))) {
            // Prepare to retrieve message's contents

            // If no message stream passed, create a new one to write the retrieved message's contents to a buffer
            messageDuplex = messageDuplex ? messageDuplex : new BufferMessageDuplex();

            // Note: if for some reason the message is actually encrypted but no private keys are available,
            //      possibly because the (origin) device belongs to a different Catenis node, the message
            //      shall be retrieved in its encrypted form
            if (trgtDevMainAddr.addrInfo.cryptoKeys.hasPrivateKey()) {
                // Assume that message needs to be decrypted. Note: it shall be unset when the message
                //  data is parsed and the message is actually not encrypted
                messageDuplex.setDecryption(trgtDevMainAddr.addrInfo.cryptoKeys, origDevMainAddr.addrInfo.cryptoKeys);
            }

            // Parse the message data from the null data output
            let ctnMessage = undefined;

            try {
                ctnMessage = CatenisMessage.fromData(transact.getNullDataOutput().data, messageDuplex, false);
            }
            catch(err) {
                if (!(err instanceof Meteor.Error) || err.error !== 'ctn_msg_data_parse_error') {
                    // An exception other than an indication that null data is not correctly formatted.
                    //  Just re-throws it
                    throw err;
                }
            }

            if (ctnMessage !== undefined && ctnMessage.isSendMessage()) {
                // Instantiate send message transaction
                // noinspection JSValidateTypes
                sendMsgTransact = new SendMessageTransaction();

                sendMsgTransact.transact = transact;
                sendMsgTransact.originDevice = CatenisNode.getCatenisNodeByIndex(origDevMainAddr.addrInfo.pathParts.ctnNodeIndex).getClientByIndex(origDevMainAddr.addrInfo.pathParts.clientIndex).getDeviceByIndex(origDevMainAddr.addrInfo.pathParts.deviceIndex);
                sendMsgTransact.targetDevice = CatenisNode.getCatenisNodeByIndex(trgtDevMainAddr.addrInfo.pathParts.ctnNodeIndex).getClientByIndex(trgtDevMainAddr.addrInfo.pathParts.clientIndex).getDeviceByIndex(trgtDevMainAddr.addrInfo.pathParts.deviceIndex);
                sendMsgTransact.originDeviceMainAddrKeys = origDevMainAddr.addrInfo.cryptoKeys;
                sendMsgTransact.targetDeviceMainAddrKeys = trgtDevMainAddr.addrInfo.cryptoKeys;
                sendMsgTransact.messageReadable = ctnMessage.getMessageReadable();
                sendMsgTransact.options = {
                    readConfirmation: trgtDevReadConfirmAddr !== undefined,
                    encrypted: ctnMessage.isEncrypted(),
                    storageScheme: ctnMessage.isEmbedded() ? CatenisMessage.storageScheme.embedded : CatenisMessage.storageScheme.external
                };

                if (!ctnMessage.isEmbedded()) {
                    sendMsgTransact.options.storageProvider = ctnMessage.getStorageProvider();
                    sendMsgTransact.extMsgRef = ctnMessage.getExternalMessageReference();
                }
            }
        }
    }

    return sendMsgTransact;
};


// SendMessageTransaction function class (public) properties
//

SendMessageTransaction.matchingPattern = Object.freeze({
    input: util.format('^(?:%s)(?:%s)+$',
            Transaction.ioToken.p2_dev_main_addr.token,
            Transaction.ioToken.p2_sys_pay_tx_exp_addr.token),
    output: util.format('^(?:%s)(?:%s)?(?:%s)(?:%s){0,2}(?:%s)?$',
            Transaction.ioToken.p2_dev_main_addr.token,
            Transaction.ioToken.p2_dev_read_conf_addr.token,
            Transaction.ioToken.null_data.token,
            Transaction.ioToken.p2_dev_main_addr.token,
            Transaction.ioToken.p2_sys_pay_tx_exp_addr.token)
});


// Definition of module (private) functions
//

export function getAddrAndAddrInfo(obj) {
    return obj !== undefined ? {
        address: obj.address,
        addrInfo: obj.addrInfo
    } : undefined;
}

export function areAddressesFromSameDevice(addrInfo1, addrInfo2) {
    return addrInfo1.pathParts.deviceIndex === addrInfo2.pathParts.deviceIndex
            && addrInfo1.pathParts.clientIndex === addrInfo2.pathParts.clientIndex
            && addrInfo1.pathParts.ctnNodeIndex === addrInfo2.pathParts.ctnNodeIndex;
}

export function areAddressesFromSameClient(addrInfo1, addrInfo2) {
    return addrInfo1.pathParts.clientIndex === addrInfo2.pathParts.clientIndex
        && addrInfo1.pathParts.ctnNodeIndex === addrInfo2.pathParts.ctnNodeIndex;
}


// Module code
//

// Lock function class
Object.freeze(SendMessageTransaction);
