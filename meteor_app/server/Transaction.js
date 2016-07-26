/**
 * Created by claudio on 12/07/16.
 */

//console.log('[Transaction.js]: This code just ran.');

// Module variables
//

// References to external modules
var config = Npm.require('config');
var bitcoinLib = Npm.require('bitcoinjs-lib');

// Config entries
var configTransact = config.get('transaction');

// Configuration settings
var cfgSettings = {
    txInputSize: configTransact.get('txInputSize'),
    txOutputSize: configTransact.get('txOutputSize')
};


// Definition of function classes
//

// Transaction function class
//
//  input: {
//    txout: {
//      txid: [string],
//      vout: [number],
//      amount: [number]   // In satoshis
//    },
//    addrKeys: [CryptoKeys object]
//  }
//
//  output: {
//    type: [string],   // Either p2PKH' or 'nullData'
//    p2PKH: {      // Should only exist if type = 'p2PKH'
//      address: [string],
//      amount: [number],   // In satoshis
//    },
//    nullData: {   // Should only exist if type = 'nullData'
//      data: [Buffer object]
//  }

function Transaction() {
    this.inputs = [];
    this.outputs = [];
    this.hasNullDataOutput = false;
    this.nullDataPayloadSize = 0;
    this.rawTransaction = undefined;
    this.txid = undefined;
    this.txSaved = false;
}


// Public Transaction object methods
//

Transaction.prototype.addInputs = function (inputs, pos) {
    if (!Array.isArray(inputs)) {
        inputs = [inputs];
    }

    if (pos != undefined && pos < 0) {
        pos = 0;
    }

    if (pos == undefined) {
        // If no specific position has been given, add new
        //  input to the end of list of inputs
        Array.prototype.push.apply(this.inputs, inputs);
    }
    else {
        // A specific position has been given
        inputs.forEach(function (input, idx) {
            if (this.inputs[pos + idx] != undefined) {
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
        }, this);
    }

    invalidateTx.call(this);
};

Transaction.prototype.addInput = function (txout, addrKeys, pos) {
    this.addInputs({
        txout: txout,
        addrKeys: addrKeys
    }, pos);
};

Transaction.prototype.lastInputPosition = function () {
    return this.inputs.length > 0 ? this.inputs.length - 1 : undefined;
};

Transaction.prototype.getInputAt = function (pos) {
    return this.inputs[pos];
};

Transaction.prototype.removeInputAt = function (pos) {
    var input;

    if (this.inputs[pos] != undefined) {
        input = this.inputs.splice(pos, 1)[0];
    }

    if (input != undefined) {
        invalidateTx.call(this);
    }

    return input;
};

Transaction.prototype.addP2PKHOutputs = function (p2PKHs, pos) {
    if (!Array.isArray(p2PKHs)) {
        p2PKHs = [p2PKHs];
    }

    if (pos != undefined && pos < 0) {
        pos = 0;
    }

    var outputs = p2PKHs.map(function (p2PKH) {
        return {
            type: Transaction.outputType.p2PKH,
            p2PKH: p2PKH
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

    var result = false;

    if (!this.hasNullDataOutput) {
        addOutputs.call(this, {
            type: Transaction.outputType.nullData,
            nullData: {
                data: data
            }
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
    var output;

    if (this.outputs[pos] != undefined) {
        output = this.outputs.splice(pos, 1)[0];

        if (output.type == Transaction.outputType.nullData) {
            this.hasNullDataOutput = false;
            this.nullDataPayloadSize = 0;
        }
    }

    if (output != undefined) {
        invalidateTx.call(this);;
    }

    return output;
};

Transaction.prototype.hasNullDataOutput = function () {
    return this.hasNullDataOutput;
};

Transaction.prototype.getNullDataOutputPosition = function () {
    var pos;

    if (this.hasNullDataOutput) {
        pos = this.outputs.findIndex(function (output) {
            return output.type == Transaction.outputType.nullData;
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
    var output;

    if (this.hasNullDataOutput) {
        output = this.outputs.find(function (output) {
            return output.type == Transaction.outputType.nullData;
        });

        if (output == undefined) {
            // Could not find null data output. Fix control variables
            this.hasNullDataOutput = false;
            this.nullDataPayloadSize = 0;
        }
    }

    return output;
};

Transaction.prototype.listOutputAddresses = function () {
    var addrList = [];

    this.outputs.forEach(function (output) {
        if (output.type == Transaction.outputType.p2PKH) {
            addrList.push(output.p2PKH.address);
        }
    });

    return addrList;
};

Transaction.prototype.totalInputsAmount = function () {
    return this.inputs.reduce(function (sum, input) {
        return sum + input.txout.amount;
    }, 0);
};

Transaction.prototype.totalOutputsAmount = function () {
    return this.outputs.reduce(function (sum, output) {
        return sum + (output.type == Transaction.outputType.p2PKH ? output.p2PKH.amount : 0);
    }, 0);
};

Transaction.prototype.countInputs = function () {
    return this.inputs.reduce(function (count) {
        return count + 1;
    }, 0);
};

Transaction.prototype.countOutputs = function () {
    return this.outputs.reduce(function (count) {
        return count + 1;
    }, 0);
};

Transaction.prototype.countP2PKHOutputs = function () {
    return this.outputs.reduce(function (count, output) {
        return output.type == Transaction.outputType.p2PKH ? count + 1 : count;
    }, 0);
};

Transaction.prototype.estimateSize = function () {
    return Transaction.computeTransactionSize(this.countInputs(), this.countP2PKHOutputs(), this.nullDataPayloadSize);
};

// Returns signed raw transaction in hex format
Transaction.prototype.getTransaction = function () {
    if (this.rawTransaction == undefined) {
        // Build transaction adding all inputs and outputs in sequence
        var txBuilder = new bitcoinLib.TransactionBuilder(Catenis.application.cryptoNetwork),
            vins = [];

        this.inputs.forEach(function (input) {
            vins.push(txBuilder.addInput(input.txout.txid, input.txout.vout));
        });

        this.outputs.forEach(function (output) {
            if (output.type == Transaction.outputType.p2PKH) {
                txBuilder.addOutput(output.p2PKH.address, output.p2PKH.amount);
            }
            else if (output.type == Transaction.outputType.nullData) {
                txBuilder.addOutput(bitcoinLib.script.nullDataOutput(output.nullData.data));
            }
        });

        // Now, signs each input
        var vinIdx = 0;

        this.inputs.forEach(function (input) {
            txBuilder.sign(vins[vinIdx++], input.addrKeys.keyPair);
        });

        this.rawTransaction = txBuilder.build().toHex();
    }

    return this.rawTransaction;
};

// Sends transaction to blockchain network and returns its id
Transaction.prototype.sendTransaction = function (resend = false) {
    if (this.txid == undefined || resend) {
        this.txid = Catenis.bitcoinCore.sendRawTransaction(this.getTransaction());
    }

    return this.txid;
};

//  type: [string] // Valid values: 'funding', 'send_message', 'read_confirmation', 'issue_locked_asset', 'issue_unlocked_asset',
//                      'transfer_asset'
//  info: [Object]  // One of the following, according to the specified type (previous argument)
//    funding: {
//      payees: [Array(string)] // Identifies the type of blockchain addresses (from Catenis.module.KeyStore.extKeyType)
//                                  that receive the funds. Valid values: 'ctnd_dev_main_addr', 'ctnd_node_fund_pay_addr',
//                                  'ctnd_pay_tx_exp_addr', 'cln_msg_crd_addr', 'cln_asst_crd_addr', 'dev_read_conf_addr',
//                                  'dev_main_addr', 'dev_asst_issu_addr'
//    }
//    sendMessage: {
//      originDeviceId: [string], // External ID of the device that sent the message
//      targetDeviceId: [string], // External ID of the device that receives the message
//      readConfirmVout: [integer] // The index of the output within this transaction that is used for read confirmation
//    }
//    readConfirmation: {
//      txouts: [{ // Identifies the read confirmation tx outputs that are spent by this transaction
//        txid: [string], // Blockchain attributed ID of the transaction containing the read confirmation output that is spent
//        vout: [integer] // The index of the output within the transaction that is spent
//      }],
//      feeAmount: [integer], // Amount, in satoshis, paid as fee for this transaction
//      txSize: [integer] // Transaction size, in bytes. Used to calculate fee rate
//    }
//    issueLockedAsset: {
//      assetId: [string], // ID that uniquely identifies the Colored Coins asset that is issued
//      deviceId: [string] // External ID of the device that is issuing the asset
//    }
//    issueUnlockedAsset: {
//      assetId: [string], // ID that uniquely identifies the coloredCoin asset that is issued
//      deviceId: [string] // External ID of the device that is issuing the asset
//    }
//    transferAsset: {
//      assetId: [string], // ID that uniquely identifies the Colored Coins asset that is transferred
//      originDeviceId: [string], // External ID of the device that sent the assets
//      targetDeviceId: [string] // External ID of the device that receives the assets
//    }
//
Transaction.prototype.saveSentTransaction = function (type, info) {
    if (this.txid != undefined && !this.txSaved) {
        // Prepare to save transaction information
        let inputs = this.inputs.map(function (input) {
            return {
                txid: input.txout.txid,
                vout: input.txout.vout
            };
        });

        let typeInfo = {};
        typeInfo[type] = info;

        var docId = Catenis.db.collection.SentTransaction.insert({
            type: type,
            txid: this.txid,
            inputs: inputs,
            sentDate: new Date(Date.now()),
            confirmation: {
                confirmed: false
            },
            info: typeInfo
        });

        // Indicate that transaction has been saved
        this.txSaved = true;
    }

    return docId;
};

// TODO: implement mechanism (for now via polling) to update confirmation status of saved transactions. This mechanism should issue events according to the transaction type to advise when a transaction is confirmed

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

    if (pos != undefined && pos < 0) {
        pos = 0;
    }

    if (pos == undefined) {
        // If no specific position has been given, add new
        //  output to the end of list of outputs
        Array.prototype.push.apply(this.outputs, outputs);
    }
    else {
        // A specific position has been given
        outputs.forEach(function (output, idx) {
            if (this.outputs[pos + idx] != undefined) {
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
        }, this);
    }

    invalidateTx.call(this);
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


// Transaction function class (public) properties
//

Transaction.outputType = Object.freeze({
    p2PKH: 'p2PKH',
    nullData: 'nullData'
});


// Definition of module (private) functions
//

/*function module_func() {
}*/


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

// Save module function class reference
if (typeof Catenis === 'undefined')
    Catenis = {};

if (typeof Catenis.module === 'undefined')
    Catenis.module = {};

Catenis.module.Transaction = Object.freeze(Transaction);
