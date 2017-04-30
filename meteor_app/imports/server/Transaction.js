/**
 * Created by claudio on 12/07/16.
 */

//console.log('[Transaction.js]: This code just ran.');

// Module variables
//

// References to external modules

// References to external code
//
// Internal node modules
//  NOTE: the reference of these modules are done sing 'require()' instead of 'import' to
//      to avoid annoying WebStorm warning message: 'default export is not defined in
//      imported module'
const util = require('util');
// Third-party node modules
import config from 'config';
import bitcoinLib from 'bitcoinjs-lib';
import BigNumber from 'bignumber.js';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { BitcoinCore } from './BitcoinCore';
import { BlockchainAddress } from './BlockchainAddress';
import { CriticalSection } from './CriticalSection';

// Config entries
const configTransact = config.get('transaction');

// Configuration settings
const cfgSettings = {
    txInputSize: configTransact.get('txInputSize'),
    txOutputSize: configTransact.get('txOutputSize')
};

// Critical section object to avoid concurrent access to database when
//  fixing transaction malleability
const dbMalleabilityCS = new CriticalSection();


// Definition of function classes
//

// Transaction function class
//
//  input: {
//    txout: {  // Unspent output being spent
//      txid: [string],
//      vout: [number],
//      amount: [number]   // (in satoshis)
//    },
//    address:  // (optional) Blockchain address associated with unspent output being spent
//    addrInfo: {   // Info about blockchain address associated with unspent output being spent (as returned by Catenis.keyStore.getAddressInfo())
//                  //  (should only exist for addresses that belong to this Catenis node)
//      cryptoKeys: [CryptoKeys object],  // Pair of crypto keys associated with this address
//      type: [string],  // Type of address from Catenis.KeyStore.extKeyType
//      path: [string],  // Path of the HD extended key associated with this address
//      isObsolete: [boolean],  // Indicates whether this address is not in used anymore
//      pathParts: [object]  // Object with components that make up the HD extended key path associated with this address
//    }
//  }
//
//  output: {
//    type: [string],   // Either 'P2PKH', 'P2SH' or 'nullData'
//    payInfo: {        // Should only exist for 'P2PKH' or 'P2SH' output types
//      address: [string],   // Blockchain address to where payment should be sent
//      amount: [number],    // Amount (in satoshis) to send
//      addrInfo: {   // Info about blockchain address to where pyment should be sent (as returned by Catenis.keyStore.getAddressInfo())
//                    //  (should only exist for deserialized transactions (generated from Transaction.fromHex() for addresses
//                    //   that belong to this Catenis node)
//        cryptoKeys: [CryptoKeys object],  // Pair of crypto keys associated with this address
//        type: [string],  // Type of address from Catenis.KeyStore.extKeyType
//        path: [string],  // Path of the HD extended key associated with this address
//        isObsolete: [boolean],  // Indicates whether this address is not in used anymore
//        pathParts: [object]  // Object with components that make up the HD extended key path associated with this address
//      }
//    },
//    data: [Buffer object] // Should only exist for 'nullData' output type
//  }

export function Transaction() {
    this.inputs = [];
    this.outputs = [];
    this.hasNullDataOutput = false;
    this.nullDataPayloadSize = 0;
    this.rawTransaction = undefined;
    this.txid = undefined;
    this.txSaved = false;

    // Input and output sequence of tokens. Each token corresponds to an input/output
    //  of the transaction, and basically identifies what type of blockchain address
    //  that input/output is associated with (or if it is not associated with any address
    //  at all, which is the case of a null data output). They are used to identify a given
    //  type of (Catenis issued) transaction, by matching these sequences with some
    //  predefined input/output patterns.
    //  They should only exist for deserialized transactions
    this.inTokenSequence = undefined;
    this.outTokenSequence = undefined;
}


// Public Transaction object methods
//

Transaction.prototype.addInputs = function (inputs, pos) {
    if (!Array.isArray(inputs)) {
        inputs = [inputs];
    }

    if (pos !== undefined && pos < 0) {
        pos = 0;
    }

    if (pos === undefined) {
        // If no specific position has been given, add new
        //  input to the end of list of inputs
        Array.prototype.push.apply(this.inputs, inputs);
    }
    else {
        // A specific position has been given
        inputs.forEach((input, idx) => {
            if (this.inputs[pos + idx] !== undefined) {
                // The postion is not yet taken. Just add new
                //  input to that positon
                this.inputs[pos + idx] = input;
            }
            else {
                // The position is already taken. Push aside input
                //  that is currently in that position, and add
                //  new input to that postion
                this.inputs.splice(pos + idx, 0, input);
            }
        });
    }

    invalidateTx.call(this);
};

Transaction.prototype.addInput = function (txout, address, addrInfo, pos) {
    const input = {
        txout: txout,
        address: address
    };

    if (addrInfo) {
        input.addrInfo = addrInfo;
    }

    this.addInputs(input, pos);
};

Transaction.prototype.lastInputPosition = function () {
    return this.inputs.length > 0 ? this.inputs.length - 1 : undefined;
};

Transaction.prototype.getInputAt = function (pos) {
    return this.inputs[pos];
};

Transaction.prototype.removeInputAt = function (pos) {
    let input = undefined;

    if (this.inputs[pos] !== undefined) {
        input = this.inputs.splice(pos, 1)[0];
    }

    if (input !== undefined) {
        invalidateTx.call(this);
    }

    return input;
};

Transaction.prototype.addP2PKHOutputs = function (payInfos, pos) {
    if (!Array.isArray(payInfos)) {
        payInfos = [payInfos];
    }

    if (pos !== undefined && pos < 0) {
        pos = 0;
    }

    const outputs = payInfos.map((payInfo) => {
        return {
            type: Transaction.outputType.P2PKH,
            payInfo: payInfo
        }
    });

    addOutputs.call(this, outputs, pos);
};

Transaction.prototype.addP2PKHOutput = function (address, amount, pos) {
    this.addP2PKHOutputs({
        address: address,
        amount: amount
    }, pos);
};

Transaction.prototype.addNullDataOutput = function (data, pos) {
    if (!Buffer.isBuffer(data)) {
        data = new Buffer(data);
    }

    let result = false;

    if (!this.hasNullDataOutput) {
        addOutputs.call(this, {
            type: Transaction.outputType.nullData,
            data: data
        }, pos);
        this.hasNullDataOutput = true;
        this.nullDataPayloadSize = data.length;
        result = true;
    }

    return result;
};

Transaction.prototype.lastOutputPosition = function () {
    return this.outputs.length > 0 ? this.outputs.length - 1 : undefined;
};

Transaction.prototype.getOutputAt = function (pos) {
    return this.outputs[pos];
};

Transaction.prototype.removeOutputAt = function (pos) {
    let output = undefined;

    if (this.outputs[pos] !== undefined) {
        output = this.outputs.splice(pos, 1)[0];

        if (output.type === Transaction.outputType.nullData) {
            this.hasNullDataOutput = false;
            this.nullDataPayloadSize = 0;
        }
    }

    if (output !== undefined) {
        invalidateTx.call(this);
    }

    return output;
};

Transaction.prototype.getNullDataOutputPosition = function () {
    let pos = defined;

    if (this.hasNullDataOutput) {
        pos = this.outputs.findIndex((output) => {
            return output.type === Transaction.outputType.nullData;
        });

        if (pos < 0) {
            // Could not find null data output. Fix control variables
            this.hasNullDataOutput = false;
            this.nullDataPayloadSize = 0;
            pos = undefined;
        }
    }

    return pos;
};

Transaction.prototype.getNullDataOutput = function () {
    let output = undefined;

    if (this.hasNullDataOutput) {
        output = this.outputs.find((output) => {
            return output.type === Transaction.outputType.nullData;
        });

        if (output === undefined) {
            // Could not find null data output. Fix control variables
            this.hasNullDataOutput = false;
            this.nullDataPayloadSize = 0;
        }
    }

    return output;
};

Transaction.prototype.listOutputAddresses = function () {
    const addrList = [];

    this.outputs.forEach((output) => {
        if (output.type === Transaction.outputType.P2PKH) {
            addrList.push(output.payInfo.address);
        }
    });

    return addrList;
};

Transaction.prototype.totalInputsAmount = function () {
    return this.inputs.reduce((sum, input) => {
        return sum + input.txout.amount;
    }, 0);
};

Transaction.prototype.totalOutputsAmount = function () {
    return this.outputs.reduce((sum, output) => {
        return sum + (output.type === Transaction.outputType.P2PKH ? output.payInfo.amount : 0);
    }, 0);
};

Transaction.prototype.countInputs = function () {
    return this.inputs.reduce((count) => {
        return count + 1;
    }, 0);
};

Transaction.prototype.countOutputs = function () {
    return this.outputs.reduce((count) => {
        return count + 1;
    }, 0);
};

Transaction.prototype.countP2PKHOutputs = function () {
    return this.outputs.reduce((count, output) => {
        return output.type === Transaction.outputType.P2PKH ? count + 1 : count;
    }, 0);
};

Transaction.prototype.estimateSize = function () {
    return Transaction.computeTransactionSize(this.countInputs(), this.countP2PKHOutputs(), this.nullDataPayloadSize);
};

// Returns signed raw transaction in hex format
Transaction.prototype.getTransaction = function () {
    if (this.rawTransaction === undefined) {
        // Build transaction adding all inputs and outputs in sequence
        const txBuilder = new bitcoinLib.TransactionBuilder(Catenis.application.cryptoNetwork),
            vins = [];

        this.inputs.forEach((input) => {
            vins.push(txBuilder.addInput(input.txout.txid, input.txout.vout));
        });

        this.outputs.forEach((output) => {
            if (output.type === Transaction.outputType.P2PKH) {
                txBuilder.addOutput(output.payInfo.address, output.payInfo.amount);
            }
            else if (output.type === Transaction.outputType.nullData) {
                txBuilder.addOutput(bitcoinLib.script.nullDataOutput(output.data), 1000);
            }
        });

        // Now, signs each input
        let vinIdx = 0;

        this.inputs.forEach((input) => {
            if (input.addrInfo) {
                txBuilder.sign(vins[vinIdx++], input.addrInfo.cryptoKeys.keyPair);
            }
        });

        this.rawTransaction = txBuilder.build().toHex();
    }

    return this.rawTransaction;
};

// Sends transaction to blockchain network and returns its id
Transaction.prototype.sendTransaction = function (resend = false) {
    if (this.txid === undefined || resend) {
        this.txid = Catenis.bitcoinCore.sendRawTransaction(this.getTransaction());
    }

    return this.txid;
};

//  type: [Object] // Object of type Transaction.type identifying the type of transaction. All transaction types are accepted
//                     except 'sys_funding'
//  info: [Object]  // One of the following, according to the specified type (previous argument)
//    funding: {
//      event: {
//          name: [string],  // Identifies the event that triggered the funding action (from FundTransaction.fundingEvent).
//                               Valid values: 'provision_system_device', 'provision_client_srv_credit', 'provision_client_device',
//                               'add_extra_tx_pay_funds'
//          entityId: [string]  // Id of the entity associated with the event. Should only exist for 'provision_client_srv_credit'
//                                  and 'provision_client_device' events. For 'provision_client_srv_credit' events, it refers to the
//                                  clientId; for 'provision_client_device' events, it refers to the deviceId
//      },
//      payees: [Array(string)] // Identifies the type of blockchain addresses that receive the funds. Valid values (from
//                                  KeyStore.extKeyType): 'sys_dev_main_addr', 'sys_node_fund_pay_addr',
//                                  'sys_pay_tx_exp_addr', 'cln_msg_crd_addr', 'cln_asst_crd_addr', 'dev_read_conf_addr',
//                                  'dev_main_addr', 'dev_asst_issu_addr'
//    }
//    send_message: {
//      originDeviceId: [string], // External ID of the device that sent the message
//      targetDeviceId: [string], // External ID of the device that receives the message
//      readConfirmation: {
//        vout: [integer] // The index of the output within this transaction that is used for read confirmation
//      }
//    }
//    log_message: {
//      deviceId: [string], // External ID of the device that logged the message
//    }
//    read_confirmation: {
//      txouts: [{ // Identifies the read confirmation tx outputs that are spent by this transaction
//        txid: [string], // Blockchain attributed ID of the transaction containing the read confirmation output that is spent
//        vout: [integer] // The index of the output within the transaction that is spent
//      }],
//      feeAmount: [integer], // Amount, in satoshis, paid as fee for this transaction
//      txSize: [integer] // Transaction size, in bytes. Used to calculate fee rate
//    }
//    issue_locked_asset: {
//      assetId: [string], // ID that uniquely identifies the Colored Coins asset that is issued
//      deviceId: [string] // External ID of the device that is issuing the asset
//    }
//    issue_unlocked_asset: {
//      assetId: [string], // ID that uniquely identifies the coloredCoin asset that is issued
//      deviceId: [string] // External ID of the device that is issuing the asset
//    }
//    transfer_asset: {
//      assetId: [string], // ID that uniquely identifies the Colored Coins asset that is transferred
//      originDeviceId: [string], // External ID of the device that sent the assets
//      targetDeviceId: [string] // External ID of the device that receives the assets
//    }
//
Transaction.prototype.saveSentTransaction = function (type, info) {
    // Validate type argument
    if (!isValidSentTransactionType(type)) {
        Catenis.logger.ERROR('Transaction.saveSentTransaction method called with invalid argument', {type: type});
        throw Error('Invalid type argument');
    }

    let docId = undefined;

    if (this.txid !== undefined && !this.txSaved) {
        // Prepare to save transaction information
        const txInfo = {};
        txInfo[type.dbInfoEntryName] = info;

        docId = Catenis.db.collection.SentTransaction.insert({
            type: type.name,
            txid: this.txid,
            sentDate: new Date(Date.now()),
            confirmation: {
                confirmed: false
            },
            info: txInfo
        });

        // Indicate that transaction has been saved
        this.txSaved = true;
    }

    return docId;
};

// Indicates whether transaction's inputs and outputs matches the
//  sequences defined by the corresponding regular expression
//
//  Arguments:
//    transactFuncClass: [Function]  // Any of transaction function classes that exposes the property matchingPattern of
//                                   //  type object (having the keys input and/or output)
//
Transaction.prototype.matches = function (transactFuncClass) {
    // Validate argument
    if (!isTransactFuncClassToMatch(transactFuncClass)) {
        Catenis.logger.ERROR('Transaction.matches method called with invalid argument', {transactFuncClass: transactFuncClass});
        throw Error('Invalid transactFuncClass argument');
    }

    if (this.inTokenSequence === undefined) {
        initInputTokenSequence.call(this);
    }

    if (this.outTokenSequence === undefined) {
        initOutputTokenSequence.call(this);
    }

    return (transactFuncClass.matchingPattern.input !== undefined ? (new RegExp(transactFuncClass.matchingPattern.input)).test(this.inTokenSequence) : true) && (transactFuncClass.matchingPattern.output !== undefined ? (new RegExp(transactFuncClass.matchingPattern.output)).test(this.outTokenSequence) : true);
};

Transaction.prototype.revertOutputAddresses = function () {
    if (this.outputs.length > 0) {
        BlockchainAddress.revertAddressList(this.listOutputAddresses());
    }
};


// Module functions used to simulate private Transaction object methods
//  NOTE: these functions need to be bound to a Transaction object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

function invalidateTx() {
    this.rawTransaction = this.txid = undefined;
    this.txSaved = false;
}

function addOutputs(outputs, pos) {
    if (!Array.isArray(outputs)) {
        outputs = [outputs];
    }

    if (pos !== undefined && pos < 0) {
        pos = 0;
    }

    if (pos === undefined) {
        // If no specific position has been given, add new
        //  output to the end of list of outputs
        Array.prototype.push.apply(this.outputs, outputs);
    }
    else {
        // A specific position has been given
        outputs.forEach((output, idx) => {
            if (this.outputs[pos + idx] !== undefined) {
                // The postion is not yet taken. Just add new
                //  output to that positon
                this.outputs[pos + idx] = output;
            }
            else {
                // The position is already taken. Push aside output
                //  that is currently in that position, and add
                //  new output to that postion
                this.outputs.splice(pos + idx, 0, output);
            }
        });
    }

    invalidateTx.call(this);
}

function initInputTokenSequence() {
    this.inTokenSequence = this.inputs.reduce((seq, input) => {
        const addrType = ('addrInfo' in input) ? input.addrInfo.type : null;
        const ioToken = getIOTokenFromAddrType(addrType);

        if (ioToken !== undefined) {
            seq += ioToken;
        }
        else {
            // Could not get IO token from address type.
            //  Log error condition
            Catenis.logger.ERROR('Could not get input/output token from blockchain address type', {addrType: input.addrInfo.type});
        }

        return seq;
    }, '');
}

function initOutputTokenSequence() {
    this.outTokenSequence = this.outputs.reduce((seq, output) => {
        let addrType = null;

        if (output.type === Transaction.outputType.nullData) {
            addrType = undefined;
        }
        else if (output.type === Transaction.outputType.P2PKH || output.type === Transaction.outputType.P2SH) {
            addrType = ('addrInfo' in output.payInfo) ? output.payInfo.addrInfo.type : null;
        }

        const ioToken = getIOTokenFromAddrType(addrType);

        if (ioToken !== undefined) {
            seq += ioToken;
        }
        else {
            // Could not get IO token from address type.
            //  Log error condition
            Catenis.logger.ERROR('Could not get input/output token from blockchain address type', {addrType: input.addrInfo.type});
        }

        return seq;
    }, '');
}


// Transaction function class (public) methods
//

//  Returns estimated transaction size, in bytes
//
//  nInputs: [number]   // Number of inputs spending P2PKH unspent outputs
//  nOutputs: [number]  // Number of P2PKH outputs
//  nullDataPayloadSize: [number]   // Size, in bytes, of data in null data output (0 if no null data output exists)
//
Transaction.computeTransactionSize = function (nInputs, nOutputs, nullDataPayloadSize = 0) {
    return nInputs * cfgSettings.txInputSize + nOutputs * cfgSettings.txOutputSize + (nullDataPayloadSize > 0 ? (nullDataPayloadSize <= 75 ? 11 :13) + nullDataPayloadSize : 0) + 10;
};

Transaction.fromTxid = function (txid) {
    return Transaction.fromHex(Catenis.bitcoinCore.getRawTransaction(txid, false, false));
};

Transaction.fromHex = function (hexTx) {
    // Try to decode transaction
    try {
        const decodedTx = Catenis.bitcoinCore.decodeRawTransaction(hexTx, false);

        if (decodedTx !== undefined) {
            const tx = new Transaction();

            // Save basic transaction info
            tx.rawTransaction = hexTx;
            tx.txid = decodedTx.txid;

            // Get inputs
            const txidTxouts = new Map();

            decodedTx.vin.forEach((input, idx) => {
                tx.inputs.push({
                    txout: {
                        txid: input.txid,
                        vout: input.vout
                    }
                });

                // Save tx out to retrieve further info
                if (txidTxouts.has(input.txid)) {
                    txidTxouts.get(input.txid).push({
                        vout: input.vout,
                        vin: idx
                    });
                }
                else {
                    txidTxouts.set(input.txid, [{
                        vout: input.vout,
                        vin: idx
                    }]);
                }
            });

            // Get the amount and address associated with each input of the transaction
            //  by retrieving information about each spent output
            for (let txoutid of txidTxouts.keys()) {
                try {
                    // Retrieve information about transaction containing outputs
                    //  spent by this transaction's inputs
                    const decodedTxout = Catenis.bitcoinCore.getRawTransaction(txoutid, true, false);

                    txidTxouts.get(txoutid).forEach((txout) => {
                        const input = tx.inputs[txout.vin];
                        const output = decodedTxout.vout[txout.vout];

                        // Save amount of output spent by input
                        input.txout.amount = new BigNumber(output.value).times(100000000).toNumber();

                        if (output.scriptPubKey.type === 'pubkeyhash' || output.scriptPubKey.type === 'scripthash') {
                            // Save address associated with output spent by input
                            input.address = output.scriptPubKey.addresses[0];

                            // Since all Catenis node's blockchain addresses are of the P2PKH type,
                            //  we filter that specific type before trying to get its information
                            if (output.scriptPubKey.type === 'pubkeyhash') {
                                // Try to get information about address associated with
                                //  spent output
                                const addrInfo = Catenis.keyStore.getAddressInfo(output.scriptPubKey.addresses[0], true);

                                if (addrInfo !== null) {
                                    input.addrInfo = addrInfo;
                                }
                            }
                        }
                    })
                }
                catch (err) {
                    // Error retrieving info about tx output. Just log error
                    Catenis.logger.ERROR(util.format('Error retrieving information about tx output (txid: %s).', txoutid), err);
                }
            }

            // Get outputs
            decodedTx.vout.forEach((output) => {
                // Identity type of output
                const txOutput = {};

                if (output.scriptPubKey.type === 'pubkeyhash') {
                    txOutput.type = Transaction.outputType.P2PKH;
                    txOutput.payInfo = {
                        address: output.scriptPubKey.addresses[0],
                        amount: new BigNumber(output.value).times(100000000).toNumber()
                    };

                    // Try to get information about address associated with output
                    const addrInfo = Catenis.keyStore.getAddressInfo(txOutput.payInfo.address, true);

                    if (addrInfo !== null) {
                        txOutput.payInfo.addrInfo = addrInfo;
                    }
                }
                else if (output.scriptPubKey.type === 'scripthash') {
                    txOutput.type = Transaction.outputType.P2SH;
                    txOutput.payInfo = {
                        address: output.scriptPubKey.addresses[0],
                        amount: new BigNumber(output.value).times(100000000).toNumber()
                    };

                    // Try to get information about address associated with output
                    const addrInfo = Catenis.keyStore.getAddressInfo(txOutput.payInfo.address, true);

                    if (addrInfo !== null) {
                        txOutput.payInfo.addrInfo = addrInfo;
                    }
                }
                else if (output.scriptPubKey.type === 'nulldata') {
                    txOutput.type = Transaction.outputType.nullData;
                    txOutput.data = bitcoinLib.script.decompile(new Buffer(output.scriptPubKey.hex,'hex'))[1];

                    // Add information about null data
                    tx.hasNullDataOutput = true;
                    tx.nullDataPayloadSize = txOutput.data.length;
                }
                else {
                    // An unexpected scriptPubKey type. Log error and save type as it is
                    Catenis.logger.WARN('Transaction output with an unexpected scriptPubKey type', {output: output});

                    txOutput.type = output.scriptPubKey.type;
                }

                tx.outputs.push(txOutput);
            });

            // Initialize both input and output toke sequences
            initInputTokenSequence.call(tx);
            initOutputTokenSequence.call(tx);

            // Return deserialized transaction
            return tx;
        }
    }
    catch (err) {
        if (!((err instanceof Meteor.Error) && err.error === 'ctn_btcore_rpc_error' && err.details !== undefined && typeof err.details.code === 'number'
                && err.details.code === BitcoinCore.rpcErrorCode.RPC_DESERIALIZATION_ERROR)) {
            // An error other than failure to deserialize transaction.
            //  Just re-throws it
            throw err;
        }
    }
};

// Checks whether two different transactions are essentially the same (spend the same
//  tx outputs, and pays the same amount to exactly the same addresses), possibly
//  due to transaction malleability
//
//  Arguments:
//    tx1: [String|Object]  // Either the tx id, the raw tx in hex, or the tx info (result from Bitcoin Core's JSON-RPC
//                          //  gettransaction method) of the first transaction
//    tx2: [String|Object]  // Either the tx id, the raw tx in hex, or the tx info (result from Bitcoin Core's JSON-RPC
//                          //  gettransaction method) of the second transaction
//
//  Result:
//    [Boolean|undefined]  // true: transactions are different but identical
//                         // false: transactions are different and not identical
//                         // undefined: the two transactions are the same (identical txid)
Transaction.areTxsIdentical = function(tx1, tx2) {
    const hexTx1 = typeof tx1 === 'string' ? (tx1.length > 64 ? tx1 : Catenis.bitcoinCore.getTransaction(tx1).hex ) : (typeof tx1 === 'object' ? tx1.hex : undefined);
    const hexTx2 = typeof tx2 === 'string' ? (tx2.length > 64 ? tx2 : Catenis.bitcoinCore.getTransaction(tx2).hex ) : (typeof tx2 === 'object' ? tx2.hex : undefined);

    if (hexTx1 !== hexTx2) {
        const decTx1 = Catenis.bitcoinCore.decodeRawTransaction(hexTx1);
        const decTx2 = Catenis.bitcoinCore.decodeRawTransaction(hexTx2);

        if (decTx1.vin.length === decTx2.vin.length && decTx1.vout.length === decTx2.vout.length) {
            let result = !decTx1.vin.some((input1, idx) => {
                return input1.txid !== decTx2.vin[idx].txid || input1.vout !== decTx2.vin[idx].vout;
            });

            if (result) {
                return !decTx1.vout.some((output1, idx) => {
                    return output1.value !== decTx2.vout[idx].value || output1.scriptPubKey.hex !== decTx2.vout[idx].scriptPubKey.hex;
                });
            }
        }

        return false;
    }

    return undefined;
};

// Method used to fix references to transaction ID that had been modified due to
//  transaction malleability in local database
//
//  Arguments:
//    source: [String]  // Identifies the source of the transaction the ID of which had been changed due malleability.
//                      //  Should be one of the properties of Transaction.source
//    originalTxid: [String]  // ID of original (conflicting) transaction
//    modifiedTxid: [String]  // ID of modified transaction due to malleability
//
Transaction.fixMalleability = function (source, originalTxid, modifiedTxid) {
    // Execute code in critical section to avoid DB concurrency
    dbMalleabilityCS.execute(() => {
        Catenis.logger.DEBUG('About to create new Malleability record', {source: source, originalTxid: originalTxid, modifiedTxid: modifiedTxid});
        let duplicateRecord = false;

        try {
            Catenis.db.collection.Malleability.insert({
                source: source,
                originalTxid: originalTxid,
                modifiedTxid: modifiedTxid,
                createdDate: new Date()
            });
        }
        catch (err) {
            if (err.name === 'MongoError' && err.code === 11000 && err.errmsg.search(/index:\s+originalTxid/) >= 0) {
                // Duplicate original tx ID error.
                Catenis.logger.WARN('Trying to create a new Malleability record with an original transaction ID for which there is already a Malleability record', {originalTxid: originalTxid});
                duplicateRecord = true;
            }
            else {
                // Any other error inserting doc/rec
                Catenis.logger.ERROR(util.format('Error creating new Malleability record: source: %s, originalTxid: %s, modifiedTxid: %s', source, originalTxid, modifiedTxid), err);
                throw new Meteor.Error('ctn_malleability_fix', util.format('Error creating new Malleability record: source: %s, originalTxid: %s, modifiedTxid: %s', source, originalTxid, modifiedTxid), err.stack);
            }
        }

        if (!duplicateRecord) {
            try {
                // Replace transaction id in all places withing the local database

                if (source === Transaction.source.sent_tx) {
                    Catenis.db.collection.ServiceCredit.update({'fundingTx.txid': originalTxid}, {
                        $set: {
                            'fundingTx.txid': modifiedTxid
                        }
                    }, {multi: true});

                    Catenis.db.collection.SentTransaction.update({txid: originalTxid}, {
                        $set: {
                            txid: modifiedTxid,
                            originalTxid: originalTxid
                        }
                    });

                    Catenis.db.collection.SentTransaction.update({replacedByTxid: originalTxid}, {
                        $set: {
                            replacedByTxid: modifiedTxid
                        }
                    });

                    // NOTE: we can update the 'info.readConfirmation.txouts.txid' field with a single update call
                    //  due to the fact that it is guaranteed that, for a given doc/rec, the txouts (array)
                    //  field will have only unique values for the txid field
                    Catenis.db.collection.SentTransaction.update({'info.readConfirmation.txouts.txid': originalTxid}, {
                        $set: {
                            'info.readConfirmation.txouts.$.txid': modifiedTxid
                        }
                    });
                }

                Catenis.db.collection.Message.update({'blockchain.txid': originalTxid}, {
                    $set: {
                        'blockchain.txid': modifiedTxid
                    }
                });

                Catenis.db.collection.ReceivedTransaction.update({txid: originalTxid}, {
                    $set: {
                        txid: modifiedTxid,
                        originalTxid: originalTxid
                    }
                });

                // NOTE: we can update the 'info.readConfirmation.txouts.txid' field with a single update call
                //  due to the fact that it is guaranteed that, for a given doc/rec, the txouts (array)
                //  field will have only unique values for the txid field
                Catenis.db.collection.ReceivedTransaction.update({'info.readConfirmation.txouts.txid': originalTxid}, {
                    $set: {
                        'info.readConfirmation.txouts.$.txid': modifiedTxid
                    }
                });
            }
            catch (err) {
                Catenis.logger.ERROR(util.format('Error updating collections to replace transaction ID modified due to malleability: originalTxid: %s, modifiedTxid: %s', originalTxid, modifiedTxid), err);
                throw new Meteor.Error('ctn_malleability_fix', util.format('Error updating collections to replace transaction ID modified due to malleability: originalTxid: %s, modifiedTxid: %s', originalTxid, modifiedTxid), err.stack);
            }
        }
    });
};


// Transaction function class (public) properties
//

Transaction.outputType = Object.freeze({
    P2PKH: 'P2PKH',         // Pay to public key hash
    P2SH: 'P2SH',           // Pay to script hash
    nullData: 'nullData'    // Null data (OP_RETURN) output
});

Transaction.type = Object.freeze({
    sys_funding: Object.freeze({
        name: 'sys_funding',
        description: 'Transaction issued from outside of the system used to send crypto currency funds to the system',
    }),
    funding: Object.freeze({
        name: 'funding',
        description: 'Transaction used to transfer crypto currency funds to internal blockchain addresses controlled by the system',
        dbInfoEntryName: 'funding'
    }),
    send_message: Object.freeze({
        name: 'send_message',
        description: 'Transaction used to send a message from origin device to target device',
        dbInfoEntryName: 'sendMessage'
    }),
    log_message: Object.freeze({
        name: 'log_message',
        description: 'Transaction used to log a message of a device',
        dbInfoEntryName: 'logMessage'
    }),
    read_confirmation: Object.freeze({
        name: 'read_confirmation',
        description: 'Transaction used to spend read confirmation output(s) from send message transactions thus indicating that message has been read by target device',
        dbInfoEntryName: 'readConfirmation'
    }),
    issue_locked_asset: Object.freeze({
        name: 'issue_locked_asset',
        description: 'Transaction used to issue (Colored Coins) assets (of a given type) that cannot be reissued for a device',
        dbInfoEntryName: 'issueLockedAsset'
    }),
    issue_unlocked_asset: Object.freeze({
        name: 'issue_unlocked_asset',
        description: 'Transaction used to issue or reissue (Colored Coins) assets (of a given type) for a device',
        dbInfoEntryName: 'issueUnlockedAsset'
    }),
    transfer_asset: Object.freeze({
        name: 'transfer_asset',
        description: 'Transaction used to transfer an amount of (Colored Coins) assets (of a given type) owned by a device to another device',
        dbInfoEntryName: 'transferAsset'
    })
});

Transaction.ioToken = Object.freeze({
    null_data: Object.freeze({
        name: 'null_data',
        token: '<null_data>',
        description: 'Null data output'
    }),
    p2_unknown_addr: Object.freeze({
        name: 'p2_unknown_addr',
        token: '<p2_unknown_addr>',
        description: 'Output (or input spending such output) paying to an unknown address'
    }),
    p2_sys_dev_main_addr: Object.freeze({
        name: 'p2_sys_dev_main_addr',
        token: '<p2_sys_dev_main_addr>',
        description: 'Output (or input spending such output) paying to a Catenis node devive main address'
    }),
    p2_sys_fund_pay_addr: Object.freeze({
        name: 'p2_sys_fund_pay_addr',
        token: '<p2_sys_fund_pay_addr>',
        description: 'Output (or input spending such output) paying to a Catenis node funding payment address'
    }),
    p2_sys_fund_chg_addr: Object.freeze({
        name: 'p2_sys_fund_chg_addr',
        token: '<p2_sys_fund_chg_addr>',
        description: 'Output (or input spending such output) paying to a Catenis node funding change address'
    }),
    p2_sys_pay_tx_exp_addr: Object.freeze({
        name: 'p2_sys_pay_tx_exp_addr',
        token: '<p2_sys_pay_tx_exp_addr>',
        description: 'Output (or input spending such output) paying to a Catenis node pay tx expense address'
    }),
    p2_cln_msg_crd_addr: Object.freeze({
        name: 'p2_cln_msg_crd_addr',
        token: '<p2_cln_msg_crd_addr>',
        description: 'Output (or input spending such output) paying to a client message credit address'
    }),
    p2_cln_asst_crd_addr: Object.freeze({
        name: 'p2_cln_asst_crd_addr',
        token: '<p2_cln_asst_crd_addr>',
        description: 'Output (or input spending such output) paying to a client asset credit address'
    }),
    p2_dev_read_conf_addr: Object.freeze({
        name: 'p2_dev_read_conf_addr',
        token: '<p2_dev_read_conf_addr>',
        description: 'Output (or input spending such output) paying to a device read confirmation address'
    }),
    p2_dev_main_addr: Object.freeze({
        name: 'p2_dev_main_addr',
        token: '<p2_dev_main_addr>',
        description: 'Output (or input spending such output) paying to a device main address'
    }),
    p2_dev_asst_addr: Object.freeze({
        name: 'p2_dev_asst_addr',
        token: '<p2_dev_asst_addr>',
        description: 'Output (or input spending such output) paying to a device asset address'
    }),
    p2_dev_asst_issu_addr: Object.freeze({
        name: 'p2_dev_asst_issu_addr',
        token: '<p2_dev_asst_issu_addr>',
        description: 'Output (or input spending such output) paying to a device asset issuance address'
    }),
    p2_dev_pub_rsrv_addr: Object.freeze({
        name: 'p2_dev_pub_rsrv_addr',
        token: '<p2_dev_pub_rsrv_addr>',
        description: 'Output (or input spending such output) paying to a device public reserved address'
    })
});

Transaction.source = Object.freeze({
    sent_tx: 'sent_tx',
    received_tx: 'received_tx'
});


// Definition of module (private) functions
//

function isValidSentTransactionType(type) {
    let isValid = false;

    if (typeof type === 'object' && type !== null && typeof type.name === 'string') {
        isValid = Object.keys(Transaction.type).some((key) => {
            return Transaction.type[key].name !== Transaction.type.sys_funding.name && Transaction.type[key].name === type.name;
        });
    }

    return isValid;
}

// addrType: [string]  //  undefined: null data output
//                     //  null: pay to unknown address
//                     //  address type from KeyStore.extKeyType.name: pay to that type of address
function getIOTokenFromAddrType(addrType) {
    const ioTokenName = addrType === undefined ? Transaction.ioToken.null_data.name :
            (addrType === null ? Transaction.ioToken.p2_unknown_addr.name : 'p2_' + addrType);
    const ioToken = Transaction.ioToken[ioTokenName];

    return ioToken ? ioToken.token : undefined;
}

function isTransactFuncClassToMatch(transactFuncClass) {
    let result = false;

    if (typeof transactFuncClass === 'function') {
        const hasProp = Object.getOwnPropertyNames(transactFuncClass).some((propName) => {
            return propName === 'matchingPattern';
        });

        result = hasProp && typeof transactFuncClass.matchingPattern === 'object';
    }

    return result;
}


// Module code
//

// Definition of properties
Object.defineProperties(Transaction, {
    txInputSize: {
        get: function () {
            return cfgSettings.txInputSize;
        },
        enumerable: true
    },
    txOutputSize: {
        get: function () {
            return cfgSettings.txOutputSize;
        },
        enumerable: true
    }
});

// Lock function class
Object.freeze(Transaction);
