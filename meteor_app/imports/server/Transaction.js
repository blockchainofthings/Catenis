/**
 * Created by Claudio on 2016-07-12.
 */

//console.log('[Transaction.js]: This code just ran.');

// Module variables
//

// References to external modules

// References to external code
//
// Internal node modules
import util from 'util';
// Third-party node modules
import config from 'config';
import bitcoinLib from 'bitcoinjs-lib';
// noinspection JSFileReferences
import BigNumber from 'bignumber.js';
// Meteor packages
import { Meteor } from 'meteor/meteor';
import { _ } from 'meteor/underscore';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { BitcoinCore } from './BitcoinCore';
import { BlockchainAddress } from './BlockchainAddress';
import { CriticalSection } from './CriticalSection';
import { Util } from './Util';
import { KeyStore } from './KeyStore';

// Config entries
const configTransact = config.get('transaction');

// Configuration settings
export const cfgSettings = {
    txOutputDustAmount: configTransact.get('txOutputDustAmount'),
    txInputSize: configTransact.get('txInputSize'),
    txOutputSize: configTransact.get('txOutputSize'),
    maxTxSize: configTransact.get('maxTxSize'),
    pubKeySize: configTransact.get('pubKeySize'),
    oneOf2MultiSigTxOutputDustAmount: configTransact.get('oneOf2MultiSigTxOutputDustAmount'),
    oneOf3multiSigTxOutputDustAmount: configTransact.get('oneOf3multiSigTxOutputDustAmount')
};

// Critical section object to avoid concurrent access to database when
//  fixing transaction malleability
const dbMalleabilityCS = new CriticalSection();


// Definition of function classes
//

// Transaction function class
//
//  input: {
//    txout: {  - Unspent output being spent
//      txid: [String],
//      vout: [Number],
//      amount: [number]  - Amount, in satoshis
//    },
//    address:  - (optional) Blockchain address associated with unspent output being spent
//    addrInfo: {  - Info about blockchain address associated with unspent output being spent (as returned by Catenis.keyStore.getAddressInfo())
//                    Should only exist for Catenis blockchain addresses
//      cryptoKeys: [Object(CryptoKeys)],  - Pair of crypto keys associated with this address
//      type: [String],  - Type of address from Catenis.KeyStore.extKeyType
//      path: [String],  - Path of the HD extended key associated with this address
//      parentPath: [String],  - Path of the root HD extended key associated with this address
//      isObsolete: [Boolean], - Indicates whether this address is not in used anymore
//      pathParts: [Object]    - Object with components that make up the HD extended key path associated with this address
//    }
//  }
//
//  output: {
//    type: [String],  - Either 'P2PKH', 'P2SH', 'nullData' or 'multisig'
//    payInfo: {       - Should not exist for 'P2PKH', 'P2SH', or 'multisig' output types
//      address: [String|Array(String)], - Blockchain address to where payment should be sent.
//                                          NOTE: for 'multisig' outputs, this is actually a list of addresses
//      nSigs: [Number], - Number of signatures required to spend multi-signature output. Should only exist for 'multisig' output type
//      amount: [Number],  - Amount, in satoshis, to send
//      addrInfo: [Object|Array(Object|String)] {  - Info about blockchain address to where payment should be sent (as returned by Catenis.keyStore.getAddressInfo()).
//                                                    Should only exist for 'multisig' output type or for any other type when transaction is deserialized (generated from
//                                                    Transaction.fromHex()) and it is a Catenis blockchain address.
//                                                    NOTE: for 'multisig' outputs, this is actually a list of either addrInfo objects (for Catenis blockchain addresses)
//                                                          or hex-encoded public keys (for non-Catenis blockchain addresses)
//        cryptoKeys: [Object(CryptoKeys)], - Pair of crypto keys associated with this address
//        type: [String],  - Type of address from Catenis.KeyStore.extKeyType
//        path: [String],  - Path of the HD extended key associated with this address
//        parentPath: [String],  - Path of the root HD extended key associated with this address
//        isObsolete: [Boolean], - Indicates whether this address is not in used anymore
//        pathParts: [Object]    - Object with components that make up the HD extended key path associated with this address
//      }
//    },
//    data: [Object(Buffer)] - Should only exist for 'nullData' output type
//  }

export function Transaction(useOptInRBF = false) {
    this.inputs = [];
    this.outputs = [];
    this.hasNullDataOutput = false;
    this.nullDataPayloadSize = 0;
    this.rawTransaction = undefined;
    this.txid = undefined;
    this.sentDate = undefined;
    this.txSaved = false;
    this.useOptInRBF = useOptInRBF;     // Indicates whether opt-in Replace By Fee feature should be used when building transaction

    this.savedSizeProfile = undefined;

    // Input and output sequence of tokens. Each token corresponds to an input/output
    //  of the transaction, and basically identifies what type of blockchain address
    //  that input/output is associated with (or if it is not associated with any address
    //  at all, which is the case of a null data output). They are used to identify a given
    //  type of (Catenis issued) transaction, by matching these sequences with some
    //  predefined input/output patterns.
    //  They should only exist for deserialized transactions
    this.inTokenSequence = undefined;
    this.outTokenSequence = undefined;

    // Fields used for comparison of transactions. When initialized, these fields contain
    //  a map of inputs and outputs using a key that uniquely identifies them
    this.compInputs = undefined;
    this.compOutputs = undefined;
}


// Public Transaction object methods
//

Transaction.prototype.addInputs = function (inputs, pos) {
    if (!Array.isArray(inputs)) {
        inputs = [inputs];
    }

    if (inputs.length > 0) {
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
                if (this.inputs[pos + idx] === undefined) {
                    // The position is not yet taken. Just add new
                    //  input to that position
                    this.inputs[pos + idx] = input;
                }
                else {
                    // The position is already taken. Push aside input
                    //  that is currently in that position, and add
                    //  new input to that position
                    this.inputs.splice(pos + idx, 0, input);
                }
            });
        }

        invalidateTx.call(this);
    }
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

Transaction.prototype.removeInputs = function (startPos, numInputs) {
    const removedInputs = this.inputs.splice(startPos, numInputs).filter((input) => input !== undefined);

    if (removedInputs.length > 0) {
        invalidateTx.call(this);
    }

    return removedInputs;
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

Transaction.prototype.addOutputs = function (outputs, pos) {
    if (!Array.isArray(outputs)) {
        outputs = [outputs];
    }

    if (outputs.length > 0) {
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
                if (this.outputs[pos + idx] === undefined) {
                    // The position is not yet taken. Just add new
                    //  output to that position
                    this.outputs[pos + idx] = output;
                }
                else {
                    // The position is already taken. Push aside output
                    //  that is currently in that position, and add
                    //  new output to that position
                    this.outputs.splice(pos + idx, 0, output);
                }
            });
        }

        invalidateTx.call(this);
    }
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

    this.addOutputs(outputs, pos);
};

Transaction.prototype.addP2PKHOutput = function (address, amount, pos) {
    this.addP2PKHOutputs({
        address: address,
        amount: amount
    }, pos);
};

Transaction.prototype.addMultiSigOutputs = function (payInfos, pos) {
    if (!Array.isArray(payInfos)) {
        payInfos = [payInfos];
    }

    if (pos !== undefined && pos < 0) {
        pos = 0;
    }

    const outputs = payInfos.map((payInfo) => {
        return {
            type: Transaction.outputType.multisig,
            payInfo: payInfo
        }
    });

    this.addOutputs(outputs, pos);
};

// Arguments:
//  addresses: [Array(String)] - List of Catenis blockchain addresses or non-Catenis hex-encoded public keys
//  nSigs: [Number] - Number of signatures required for spending multi-signature output
//  amount: [Number] - Amount, in satoshis, to send
//  pos: [Number] - Position (zero-based index) for output in transaction
Transaction.prototype.addMultiSigOutput = function (addresses, nSigs, amount, pos) {
    this.addMultiSigOutputs(addresses.reduce((payInfo, address) => {
        if (Util.isValidBlockchainAddress(address)) {
            // Address is a valid blockchain address
            const addrInfo = Catenis.keyStore.getAddressInfo(address, true);

            if (addrInfo !== null) {
                payInfo.address.push(address);
                payInfo.addrInfo.push(addrInfo);
            }
            else {
                // Invalid Catenis blockchain address.
                //  Log error condition and throw exception
                Catenis.logger.ERROR('Invalid Catenis blockchain address for adding multi-signature transaction output', {
                    address: address
                });
                throw new Error('Invalid Catenis blockchain address for adding multi-signature transaction output');
            }
        }
        else {
            // Assume address to be actually a key pair public key
            try {
                payInfo.address.push(addressFromPublicKey(address));
                payInfo.addrInfo.push(address);
            }
            catch (err) {
                // Error converting public key to blockchain address.
                //  Log error condition and throw exception
                Catenis.logger.ERROR('Error converting public key (%s) to blockchain address for adding multi-signature transaction output', address, err);
                throw new Error(util.format('Error converting public key (%s) to blockchain address for adding multi-signature transaction output', address));
            }
        }

        return payInfo;
    }, {
        address: [],
        nSigs: nSigs,
        amount: amount,
        addrInfo: []
    }), pos);
};

Transaction.prototype.incrementOutputAmount = function (pos, amount) {
    const output = this.outputs[pos];

    if (output !== undefined && (output.type === Transaction.outputType.P2PKH || output.type === Transaction.outputType.P2SH || output.type === Transaction.outputType.multisig)
            && amount !== 0) {
        output.payInfo.amount += amount;
        invalidateTx.call(this);
    }
};

Transaction.prototype.resetOutputAmount = function (pos, amount) {
    const output = this.outputs[pos];

    if (output !== undefined && (output.type === Transaction.outputType.P2PKH || output.type === Transaction.outputType.P2SH || output.type === Transaction.outputType.multisig)
            && amount !== output.payInfo.amount) {
        output.payInfo.amount = amount;
        invalidateTx.call(this);
    }
};

Transaction.prototype.addNullDataOutput = function (data, pos) {
    let result = false;

    if (!this.hasNullDataOutput) {
        if (!Buffer.isBuffer(data)) {
            data = Buffer.from(data);
        }

        this.addOutputs({
            type: Transaction.outputType.nullData,
            data: data
        }, pos);
        this.hasNullDataOutput = true;
        this.nullDataPayloadSize = data.length;
        result = true;
    }

    return result;
};

Transaction.prototype.resetNullDataOutput = function (data) {
    let result = false;

    if (this.hasNullDataOutput) {
        if (!Buffer.isBuffer(data)) {
            data = Buffer.from(data);
        }

        this.getNullDataOutput().data = data;
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

Transaction.prototype.removeOutputs = function (startPos, numOutputs) {
    const nullDataOutputPos = this.getNullDataOutputPosition();

    const removedOutputs = this.outputs.splice(startPos, numOutputs).filter((output) => output !== undefined);

    if (removedOutputs.length > 0) {
        // Adjust null data output info if necessary
        if (nullDataOutputPos !== undefined && nullDataOutputPos >= startPos && nullDataOutputPos < startPos + numOutputs) {
            this.hasNullDataOutput = false;
            this.nullDataPayloadSize = 0;
        }

        invalidateTx.call(this);
    }

    return removedOutputs;
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
    let pos = undefined;

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

Transaction.prototype.listInputTxouts = function (startPos = 0, endPos) {
    const txoutList = [];

    for (let pos = startPos, lastPos = endPos === undefined ? this.inputs.length - 1 : endPos; pos <= lastPos; pos++) {
        const input = this.inputs[pos];

        if (input !== undefined) {
            txoutList.push(input.txout);
        }
    }

    return txoutList;
};

Transaction.prototype.listOutputAddresses = function (startPos = 0, endPos) {
    const addrList = [];

    for (let pos = startPos, lastPos = endPos === undefined ? this.outputs.length - 1 : endPos; pos <= lastPos; pos++) {
        const output = this.outputs[pos];

        if (output !== undefined && (output.type === Transaction.outputType.P2PKH || output.type === Transaction.outputType.P2SH || output.type === Transaction.outputType.multisig)) {
            if (output.type !== Transaction.outputType.multisig) {
                addrList.push(output.payInfo.address);
            }
            else {
                // Multi-signature output. Include only Catenis blockchain addresses
                output.payInfo.addrInfo.forEach((addrInfo, idx) => {
                    if (typeof addrInfo === 'object') {
                        addrList.push(output.payInfo.address[idx]);
                    }
                })
            }
        }
    }

    return addrList;
};

Transaction.prototype.totalInputsAmount = function (startPos = 0, endPos) {
    let sum = 0;
    
    for (let pos = startPos, lastPos = endPos === undefined ? this.inputs.length - 1 : endPos; pos <= lastPos; pos++) {
        const input = this.inputs[pos];
        
        if (input !== undefined) {
            sum += input.txout.amount;
        }
    }
    
    return sum;
};

Transaction.prototype.totalOutputsAmount = function (startPos = 0, endPos) {
    let sum = 0;
    
    for (let pos = startPos, lastPos = endPos === undefined ? this.outputs.length - 1 : endPos; pos <= lastPos; pos++) {
        const output = this.outputs[pos];

        if (output !== undefined && (output.type === Transaction.outputType.P2PKH || output.type === Transaction.outputType.P2SH || output.type === Transaction.outputType.multisig)) {
            sum += output.payInfo.amount;
        }
    }
    
    return sum;
};

Transaction.prototype.feeAmount = function () {
    return this.totalInputsAmount() - this.totalOutputsAmount();
};

Transaction.prototype.countInputs = function (startPos = 0, endPos) {
    let count = 0;

    for (let pos = startPos, lastPos = endPos === undefined ? this.inputs.length - 1 : endPos; pos <= lastPos; pos++) {
        if (this.inputs[pos] !== undefined) {
            count++;
        }
    }
    
    return count;
};

Transaction.prototype.countOutputs = function (startPos = 0, endPos) {
    let count = 0;

    for (let pos = startPos, lastPos = endPos === undefined ? this.outputs.length - 1 : endPos; pos <= lastPos; pos++) {
        if (this.outputs[pos] !== undefined) {
            count++;
        }
    }
    
    return count;
};

Transaction.prototype.countP2PKHOutputs = function (startPos = 0, endPos) {
    let count = 0;

    for (let pos = startPos, lastPos = endPos === undefined ? this.outputs.length - 1 : endPos; pos <= lastPos; pos++) {
        const output = this.outputs[pos];

        if (output !== undefined && output.type === Transaction.outputType.P2PKH) {
            count++;
        }
    }

    return count;
};

Transaction.prototype.getNumPubKeysMultiSigOutputs = function (startPos = 0, endPos) {
    let numPubKeysMultiSigOutputs = [];

    for (let pos = startPos, lastPos = endPos === undefined ? this.outputs.length - 1 : endPos; pos <= lastPos; pos++) {
        const output = this.outputs[pos];

        if (output !== undefined && output.type === Transaction.outputType.multisig) {
            numPubKeysMultiSigOutputs.push(output.payInfo.addrInfo.length);
        }
    }

    return numPubKeysMultiSigOutputs;
};

Transaction.prototype.estimateSize = function () {
    return Transaction.computeTransactionSize(this.countInputs(), this.countP2PKHOutputs(), this.nullDataPayloadSize, this.getNumPubKeysMultiSigOutputs());
};

// Used to save transaction parameters that are used to compute the (estimated) transaction size
Transaction.prototype.saveSizeProfile = function () {
    this.savedSizeProfile = {
        numInputs: this.countInputs(),
        numP2PKHOutputs: this.countP2PKHOutputs(),
        numPubKeysMultiSigOutputs: this.getNumPubKeysMultiSigOutputs(),
        nullDataPayloadSize: this.nullDataPayloadSize
    };
};

// Compare the current values of the parameters that are used to compute the (estimated) transaction
//  size with the values of previously saved parameters to account for differences in such parameters
//
// Return:
//  diffResult: { - (only returned if the size profile of the transaction has changed)
//    numInputs: {  - (only exists if there are differences in number of inputs)
//      current: [Number]
//      delta: [Number]
//    },
//    numP2PKHOutputs: {  - (only exists if there are differences in number of P2PK outputs)
//      current: [Number]
//      delta: [Number]
//    },
//    numPubKeysMultiSigOutputs: {  - (only exists if there are differences in number of multi-signature outputs)
//      current: [Number]
//      delta: {
//        added: [Array(Number)],
//        deleted: [Array(Number)]
//    },
//    nullDataPayloadSize: {  - (only exists if there are differences in size of payload of null data output)
//      current: [Number]
//      delta: [Number]
//    }
//  }
Transaction.prototype.compareSizeProfile = function () {
    const curSizeProfile = {
        numInputs: this.countInputs(),
        numP2PKHOutputs: this.countP2PKHOutputs(),
        numPubKeysMultiSigOutputs: this.getNumPubKeysMultiSigOutputs(),
        nullDataPayloadSize: this.nullDataPayloadSize
    };

    if (this.savedSizeProfile === undefined) {
        this.savedSizeProfile = {
            numInputs: 0,
            numP2PKHOutputs: 0,
            numPubKeysMultiSigOutputs: [],
            nullDataPayloadSize: 0
        };
    }
    const diffNumInputs = {
        current: curSizeProfile.numInputs,
        delta: curSizeProfile.numInputs - this.savedSizeProfile.numInputs
    };
    const diffNumP2PKHOutputs = {
        current: curSizeProfile.numP2PKHOutputs,
        delta: curSizeProfile.numP2PKHOutputs - this.savedSizeProfile.numP2PKHOutputs
    };
    const diffNumPubKeysMultiSigOutputs = {
        current: curSizeProfile.numPubKeysMultiSigOutputs,
        delta: Util.diffArrays(this.savedSizeProfile.numPubKeysMultiSigOutputs, curSizeProfile.numPubKeysMultiSigOutputs)
    };
    const diffNullDataPayloadSize = {
        current: curSizeProfile.nullDataPayloadSize,
        delta: curSizeProfile.nullDataPayloadSize - this.savedSizeProfile.nullDataPayloadSize
    };

    const diffResult = {};

    if (diffNumInputs.delta !== 0) {
        diffResult.numInputs = diffNumInputs;
    }

    if (diffNumP2PKHOutputs.delta !== 0) {
        diffResult.numP2PKHOutputs = diffNumP2PKHOutputs;
    }

    if (diffNumPubKeysMultiSigOutputs.delta !== undefined) {
        diffResult.numPubKeysMultiSigOutputs = diffNumPubKeysMultiSigOutputs;
    }

    if (diffNullDataPayloadSize.delta !== 0) {
        diffResult.nullDataPayloadSize = diffNullDataPayloadSize;
    }

    return Object.keys(diffResult).length > 0 ? diffResult : undefined;
};

Transaction.prototype.realSize = function () {
    return this.rawTransaction !== undefined ? this.rawTransaction.length / 2 : undefined;
};

// Returns signed raw transaction in hex format
Transaction.prototype.getTransaction = function () {
    if (this.rawTransaction === undefined) {
        // Build transaction adding all inputs and outputs in sequence
        const txBuilder = new bitcoinLib.TransactionBuilder(Catenis.application.cryptoNetwork),
            vins = [];

        this.inputs.forEach((input) => {
            vins.push(txBuilder.addInput(input.txout.txid, input.txout.vout, this.useOptInRBF ? 0xffffffff - 2 : undefined));
        });

        this.outputs.forEach((output) => {
            if (output.type === Transaction.outputType.P2PKH) {
                txBuilder.addOutput(output.payInfo.address, output.payInfo.amount);
            }
            else if (output.type === Transaction.outputType.nullData) {
                txBuilder.addOutput(bitcoinLib.script.nullData.output.encode(output.data), 0);
            }
            else if (output.type === Transaction.outputType.multisig) {
                const pubKeys = output.payInfo.addrInfo.map((addrInfo) => {
                    if (typeof addrInfo === 'object') {
                        // Address info. Get public key from key pair
                        return addrInfo.cryptoKeys.getCompressedPublicKey();
                    }
                    else {
                        // It is actually a public key. So, just return it
                        return Buffer.from(addrInfo, 'hex');
                    }
                });

                txBuilder.addOutput(bitcoinLib.script.multisig.output.encode(output.payInfo.nSigs, pubKeys), output.payInfo.amount);
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
        this.sentDate = new Date();
    }

    return this.txid;
};

// Serializes transaction object so it can be saved
//
//  Result: [String] - JSON representing the following object: {
//    inputs: [{  [Array(Object)] - List of inputs currently added to the transaction
//      txid: [String],           - Blockchain assigned ID of transaction containing output that is spent by this input
//      vout: [Number],           - Index which identifies the output that is spent by this input
//      amount: [Number],         - Amount, in satoshis, associated with the output that is spent by this input
//      addrPath: [String]        - HD node path of the blockchain address associated with the output that is spent by this input
//                                   Note: it shall have the actual blockchain address for non-Catenis blockchain addresses
//    }],
//    outputs: [{ [Array(Object)] - List of outputs currently added to the transaction
//      type: [String],           - Identifies the type of the output. Either: 'P2PKH', 'P2SH', 'nullData' or 'multisig'
//      addrPath: [String|Array(String)], - (only present for output of type 'P2PKH', 'P2SH' or 'multisig') HD node path of the
//                                           blockchain address to where payment should be sent, or the actual address for
//                                           non-Catenis blockchain addresses.
//                                            NOTE: for 'multisig' outputs, this is actually a list of either HD node path
//                                              (for Catenis blockchain addresses) or hex-encoded public keys (for non-Catenis
//                                              blockchain addresses)
//      nSigs: [Number],          - (only present for output of type 'multisig') Number of signatures required to spend output
//      amount: [Number],         - (only present for output of type 'P2PKH', 'P2SH' or 'multisig') Amount, in satoshis, to send
//      data: [String]            - (only present for output of type 'nullData') Base-64 encoded data to be embedded in transaction
//    }],
//    useOptInRBF: [Boolean],     - Indicates whether tx uses Replace By Fee feature
//    txid: [String]              - (only present if tx had already been sent) The blockchain assigned ID of the transaction
//  }
Transaction.prototype.serialize = function () {
    const txObj = {
        inputs: this.inputs.map((input) => {
            const addrInfo = Catenis.keyStore.getAddressInfo(input.address, true);

            return {
                txid: input.txout.txid,
                vout: input.txout.vout,
                amount: input.txout.amount,
                addrPath: addrInfo !== null ? addrInfo.path : input.address
            };
        }),
        outputs: this.outputs.map((output) => {
            const convOutput = {
                type: output.type
            };

            if (convOutput.type === Transaction.outputType.P2PKH || convOutput.type === Transaction.outputType.P2SH) {
                const addrInfo = Catenis.keyStore.getAddressInfo(output.payInfo.address, true);

                convOutput.addrPath = addrInfo !== null ? addrInfo.path : output.payInfo.address;
                convOutput.amount = output.payInfo.amount;
            }
            else if (convOutput.type === Transaction.outputType.nullData) {
                // noinspection JSCheckFunctionSignatures
                convOutput.data = output.data.toString('base64');
            }
            else if (convOutput.type === Transaction.outputType.multisig) {
                convOutput.addrPath = output.payInfo.addrInfo.map((addrInfo) => {
                    if (typeof addrInfo === 'object') {
                        // Address info. Return blockchain address path
                        return addrInfo.path;
                    }
                    else {
                        // It is actually a public key. So return public key instead
                        return addrInfo;
                    }
                });
                convOutput.nSigs = output.payInfo.nSigs;
                convOutput.amount = output.payInfo.amount;
            }

            return convOutput;
        }),
        useOptInRBF: this.useOptInRBF
    };

    if (this.txid !== undefined) {
        txObj.txid = this.txid;
    }

    return JSON.stringify(txObj);
};

//  type: [Object] // Object of type Transaction.type identifying the type of transaction. All transaction types are accepted
//                     except 'sys_funding'
//  info: [Object]  // One of the following, according to the specified type (previous argument)
//    funding: {
//      event: {
//          name: [string],  // Identifies the event that triggered the funding action (from FundTransaction.fundingEvent).
//                               Valid values: 'provision_system_device', 'provision_client_device', 'add_extra_tx_pay_funds',
//                               'add_extra_read_confirm_tx_pay_funds'
//          entityId: [string]  // Id of the entity associated with the event. Should only exist for 'provision_client_device'
//                                  events, and it refers to the deviceId
//      },
//      payees: [Array(string)] // Identifies the type of blockchain addresses that receive the funds. Valid values (from
//                                  KeyStore.extKeyType): 'sys_dev_main_addr', 'sys_node_fund_pay_addr',
//                                  'sys_pay_tx_exp_addr', 'cln_msg_crd_addr', 'cln_asst_crd_addr', 'dev_read_conf_addr',
//                                  'dev_main_addr', 'dev_asst_issu_addr'
//    }
//    creditServiceAccount: {
//      clientId: [string], // External ID of client whose service account is being credited
//      creditedAmount: [number]  // Amount, in Catenis service credit's lowest unit, to be credited to client's service account
//    },
//    storeBcot: { // Information for store BCOT transaction
//      storedAmount: [number]  // Amount, in BCOT token "satoshis", stored
//    },
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
//    issue_asset: {
//      assetId: [string], // ID that uniquely identifies the Catenis asset that is issued
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
            sentDate: this.sentDate,
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

Transaction.prototype.revertOutputAddresses = function (startPos = 0, endPos) {
    if (this.outputs.length > 0) {
        BlockchainAddress.revertAddressList(this.listOutputAddresses(startPos, endPos));
    }
};

Transaction.prototype.initComparison = function () {
    if (this.compInputs === undefined) {
        // Set up map used for comparison of inputs
        this.compInputs = new Map();

        this.inputs.forEach((input) => {
            // We use a serialization of the txout as the key for inputs
            this.compInputs.set(Util.txoutToString(input.txout), input);
        });
    }

    if (this.compOutputs === undefined) {
        // Set up map used for comparison of outputs
        this.compOutputs = new Map();

        this.outputs.forEach((output) => {
            // The key to use depends on the type of output
            if (output.type === Transaction.outputType.P2PKH) {
                // Use both type and address root (parent) path|address as key
                if (output.payInfo.addrInfo === undefined) {
                    // Address info not yet present, try to get it
                    output.payInfo.addrInfo = Catenis.keyStore.getAddressInfo(output.payInfo.address, true);
                }

                const key = {type: output.type};

                if (output.payInfo.addrInfo) {
                    key.rootPath = output.payInfo.addrInfo.parentPath
                }
                else {
                    // A non-Catenis blockchain address. Use address instead of parent path
                    key.address = output.payInfo.address;
                }

                this.compOutputs.set(JSON.stringify(key), output);
            }
            else if (output.type === Transaction.outputType.P2SH) {
                // Use both type and address as the key
                this.compOutputs.set(JSON.stringify({
                    type: output.type,
                    address: output.address
                }), output);
            }
            else if (output.type === Transaction.outputType.nullData) {
                // Use the type as the key
                this.compOutputs.set(output.type, output);
            }
            else if (output.type === Transaction.outputType.multisig) {
                // Use type, list of address root (parent) paths|addresses, and number of signatures as key
                const addresses = output.payInfo.addrInfo.map((addrInfo, idx) => {
                    if (typeof addrInfo === 'object') {
                        // Address info. Return parent path
                        return addrInfo.parentPath;
                    }
                    else {
                        // It is actually a public key. So return its corresponding address
                        return output.payInfo.address[idx];
                    }
                });

                this.compOutputs.set(JSON.stringify({
                    type: output.type,
                    address: addresses,
                    nSigs: output.payInfo.nSigs
                }), output);
            }
        });
    }
};

// Method used to compare this transaction with a second transaction and return differences between them
//
//  Arguments:
//   transact [Object] - An instance of the Transaction function class
//
//  Return: {
//   inputs: [{ - [Array(Object)]
//     diffType: [String], - A property of the Transaction.diffType object identifying the type of difference found
//     input: [Object]     - One input object that represents a difference between the two transactions
//   }],
//   outputs: [{ - [Array(Object)]
//     diffType: [String], - A property of the Transaction.diffType object identifying the type of difference found
//     output: [Object],   - One output object that represents a difference between the two transactions
//     otherOutput: [Object] - The output of the other transaction that is identical to the output in this transaction
//                           -  NOTE: only present for diffType.update
//     deltaAmount: [Number] - The amount difference between two identical outputs that exist in both txs but that do not have the same amount
//                           -  NOTE: only present for diffType.update and Transaction.outputType.P2PKH, Transaction.outputType.P2SH or
//                                  Transaction.outputType.multisig
//   }]
// }
Transaction.prototype.diffTransaction = function (transact) {
    // Initialize both transactions for comparison
    this.initComparison();
    transact.initComparison();

    const diffResult = {
        inputs: [],
        outputs: []
    };

    // Identifies differences in inputs
    for (let [key, input] of this.compInputs) {
        if (!transact.compInputs.has(key)) {
            // Input exists in this tx but not in the other tx
            diffResult.inputs.push({
                diffType: Transaction.diffType.delete,
                input: input
            });
        }
    }

    for (let [key, input] of transact.compInputs) {
        if (!this.compInputs.has(key)) {
            // Input exists in the other tx but not in this tx
            diffResult.inputs.push({
                diffType: Transaction.diffType.insert,
                input: input
            });
        }
    }

    // Identifies differences in outputs
    for (let [key, output] of this.compOutputs) {
        if (!transact.compOutputs.has(key)) {
            // Output exists in this tx but not in the other tx
            diffResult.outputs.push({
                diffType: Transaction.diffType.delete,
                output: output
            });
        }
        else {
            // Outputs are identical. Check if their data are different
            const otherOutput = transact.compOutputs.get(key);

            if (output.type === Transaction.outputType.P2PKH || output.type === Transaction.outputType.P2SH || output.type === Transaction.outputType.multisig) {
                if (output.payInfo.amount !== otherOutput.payInfo.amount) {
                    diffResult.outputs.push({
                        diffType: Transaction.diffType.update,
                        output: output,
                        otherOutput: otherOutput,
                        deltaAmount: otherOutput.payInfo.amount - output.payInfo.amount
                    })
                }
            }
            else if (output.type === Transaction.outputType.nullData) {
                if (output.data.compare(otherOutput.data) !== 0) {
                    diffResult.outputs.push({
                        diffType: Transaction.diffType.update,
                        output: output,
                        otherOutput: otherOutput
                    })
                }
            }
        }
    }

    for (let [key, output] of transact.compOutputs) {
        if (!this.compOutputs.has(key)) {
            // Output exists in the other tx but not in this tx
            diffResult.outputs.push({
                diffType: Transaction.diffType.insert,
                output: output
            });
        }
    }

    return diffResult;
};

Transaction.prototype.clone = function () {
    return fixClone(Util.cloneObj(this));
};


// Module functions used to simulate private Transaction object methods
//  NOTE: these functions need to be bound to a Transaction object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

function invalidateTx() {
    this.rawTransaction = this.txid = undefined;
    this.txSaved = false;
    this.compInputs = this.compOutputs = undefined;
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
            Catenis.logger.ERROR('Could not get input/output token from blockchain address type of a transaction input', {
                input: input,
                addrType: addrType
            });
        }

        return seq;
    }, '');
}

function initOutputTokenSequence() {
    this.outTokenSequence = this.outputs.reduce((seq, output) => {
        if (output.type !== Transaction.outputType.multisig) {
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
                Catenis.logger.ERROR('Could not get input/output token from blockchain address type of a transaction output', {
                    output: output,
                    addrType: addrType
                });
            }
        }
        else {
            // Special case for multi-signature output

            // Indicate that a sequence of addresses from a multi-signature output is starting
            seq += Transaction.ioToken.multisig_start.token;

            // Add the corresponding token for each of the addresses
            output.payInfo.addrInfo.forEach((addrInfo) => {
                let addrType = null;

                if (typeof addrInfo === 'object') {
                    // Address info. Get corresponding address type
                    addrType = addrInfo.type;
                }

                const ioToken = getIOTokenFromAddrType(addrType);

                if (ioToken !== undefined) {
                    seq += ioToken;
                }
                else {
                    // Could not get IO token from address type.
                    //  Log error condition
                    Catenis.logger.ERROR('Could not get input/output token from blockchain address type of a multi-signature transaction output', {
                        output: output,
                        addrType: addrType
                    });
                }
            });

            // Indicate that a sequence of addresses from a multi-signature output is ending
            seq += Transaction.ioToken.multisig_end.token;
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
//  numPubKeysMultiSigOutputs: [Number|Array(Number)] - List containing number of public kes in each multi-signature output
//
Transaction.computeTransactionSize = function (nInputs, nOutputs, nullDataPayloadSize = 0, numPubKeysMultiSigOutputs) {
    let sizeMultiSigOutputs = 0;

    if (numPubKeysMultiSigOutputs !== undefined) {
        numPubKeysMultiSigOutputs = !Array.isArray(numPubKeysMultiSigOutputs) ? [numPubKeysMultiSigOutputs] : numPubKeysMultiSigOutputs;

        numPubKeysMultiSigOutputs.forEach((numPubKeys) => {
            sizeMultiSigOutputs += Transaction.multiSigOutputSize(numPubKeys);
        });
    }

    return nInputs * cfgSettings.txInputSize + nOutputs * cfgSettings.txOutputSize + Transaction.nullDataOutputSize(nullDataPayloadSize) + sizeMultiSigOutputs + 10;
};

Transaction.multiSigOutputSize = function (numPubKeys) {
    // Note: the last expression in parenthesis accounts for the number of bytes
    //  required to express the size of the script itself
    return 12 + (numPubKeys * (cfgSettings.pubKeySize + 1)) + (numPubKeys > 7 ? 1 : 0);
};

Transaction.nullDataOutputSize = function (payloadSize) {
    return payloadSize > 0 ? (payloadSize <= 75 ? 11 : 12) + payloadSize : 0;
};

// Reconstruct transaction object from a serialized string
Transaction.parse = function (serializedTx) {
    const txObj = JSON.parse(serializedTx);

    const tx = new Transaction(txObj.useOptInRBF);

    txObj.inputs.forEach((input, idx) => {
        const convInput = {
            txout: {
                txid: input.txid,
                vout: input.vout,
                amount: input.amount
            }
        };

        if (KeyStore.isValidPath(input.addrPath)) {
            const addrInfo = Catenis.keyStore.getAddressInfoByPath(input.addrPath, true);

            if (addrInfo !== null) {
                convInput.address = addrInfo.cryptoKeys.getAddress();
                convInput.addrInfo = addrInfo;
            }
            else {
                // Could not get Catenis blockchain address from address path.
                //  Log error condition
                Catenis.logger.ERROR('Unable to retrieve blockchain address from address path of tx input when parsing transaction', {
                    serializedTx: serializedTx,
                    addrPath: input.addrPath
                });
            }
        }
        else {
            // Assume that addrPath property contains actually an external blockchain address
            convInput.address = input.addrPath;
        }

        tx.inputs[idx] = convInput;
    });

    txObj.outputs.forEach((output, idx) => {
        let convOutput;

        if (output.type === Transaction.outputType.P2PKH || output.type === Transaction.outputType.P2SH) {
            convOutput = {
                type: output.type
            };

            if (KeyStore.isValidPath(output.addrPath)) {
                const addrInfo = Catenis.keyStore.getAddressInfoByPath(output.addrPath, true);

                if (addrInfo !== null) {
                    convOutput.payInfo = {
                        address: addrInfo.cryptoKeys.getAddress(),
                        amount: output.amount,
                        addrInfo: addrInfo
                    };
                }
                else {
                    // Could not get Catenis blockchain address from address path.
                    //  Log error condition
                    Catenis.logger.ERROR('Unable to retrieve blockchain address from address path of tx output when parsing transaction', {
                        serializedTx: serializedTx,
                        addrPath: output.addrPath
                    });
                }
            }
            else {
                // Assume that addrPath property contains actually an external blockchain address
                convOutput.payInfo = {
                    address: output.addrPath,
                    amount: output.amount
                };
            }
        }
        else if (output.type === Transaction.outputType.nullData) {
            const dataBuf = Buffer.from(output.data, 'base64');

            convOutput = {
                type: output.type,
                data: dataBuf
            };

            tx.hasNullDataOutput = true;
            tx.nullDataPayloadSize = dataBuf.length;
        }
        else if (output.type === Transaction.outputType.multisig) {
            convOutput = {
                type: output.type,
                payInfo: {
                    address: [],
                    nSigs: output.nSigs,
                    amount: output.amount,
                    addrInfo: []
                }
            };

            output.addrPath.forEach((addrPath) => {
                if (KeyStore.isValidPath(addrPath)) {
                    const addrInfo = Catenis.keyStore.getAddressInfoByPath(addrPath, true);

                    if (addrInfo !== null) {
                        convOutput.payInfo.address.push(addrInfo.cryptoKeys.getAddress());
                        convOutput.payInfo.addrInfo.push(addrInfo);
                    }
                    else {
                        // Could not get Catenis blockchain address from address path.
                        //  Log error condition
                        Catenis.logger.ERROR('Unable to retrieve blockchain address from address path of multi-signature tx output when parsing transaction', {
                            serializedTx: serializedTx,
                            addrPath: addrPath
                        });
                    }
                }
                else {
                    // Assume that addrPath property contains actually a public key
                    convOutput.payInfo.address.push(addressFromPublicKey(addrPath));
                    convOutput.payInfo.addrInfo.push(addrPath);
                }
            });
        }

        if (convOutput !== undefined) {
            tx.outputs[idx] = convOutput;
        }
    });

    if (txObj.txid !== undefined) {
        tx.txid = txObj.txid;
    }

    // Return deserialized tx
    return tx;
};

Transaction.fromTxid = function (txid, getTxTime = false, getBlockTime = false) {
    if (getTxTime || getBlockTime) {
        const txInfo = Catenis.bitcoinCore.getTransaction(txid, false, false);

        const args = [txInfo.hex];

        if (getTxTime) {
            args.push(txInfo.time);
        }

        if (getBlockTime && txInfo.blocktime) {
            args.push(txInfo.blocktime);
        }

        return Transaction.fromHex.apply(undefined, args);
    }
    else {
        return Transaction.fromHex(Catenis.bitcoinCore.getRawTransactionCheck(txid, false));
    }
};

Transaction.fromHex = function (hexTx, txTime, blockTime) {
    // Try to decode transaction
    try {
        const decodedTx = Catenis.bitcoinCore.decodeRawTransaction(hexTx, false);

        if (decodedTx !== undefined) {
            const tx = new Transaction();

            // Save basic transaction info
            tx.rawTransaction = hexTx;
            tx.txid = decodedTx.txid;
            tx.useOptInRBF = true;

            if (txTime) {
                tx.date = new Date(txTime * 1000);
            }

            if (blockTime) {
                tx.blockDate = new Date(blockTime * 1000);
            }

            // Get inputs
            const txidTxouts = new Map();

            decodedTx.vin.forEach((input, idx) => {
                tx.inputs.push({
                    txout: {
                        txid: input.txid,
                        vout: input.vout
                    }
                });

                // Check if input does not call for opt-in RBF
                if (input.sequence > 0xffffffff - 2) {
                    tx.useOptInRBF = false;
                }

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
                    const decodedTxout = Catenis.bitcoinCore.getDecodedRawTransactionCheck(txoutid, false);

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
                    txOutput.data = bitcoinLib.script.decompile(Buffer.from(output.scriptPubKey.hex, 'hex'))[1];

                    // Add information about null data
                    tx.hasNullDataOutput = true;
                    tx.nullDataPayloadSize = txOutput.data.length;
                }
                else if (output.scriptPubKey.type === 'multisig') {
                    // Multi-signature output. Decode scriptPubKey to get public keys
                    const decodedScript = bitcoinLib.script.multisig.output.decode(Buffer.from(output.scriptPubKey.hex, 'hex'), false);

                    txOutput.type = Transaction.outputType.multisig;
                    txOutput.payInfo = {
                        address: output.scriptPubKey.addresses,
                        nSigs: output.scriptPubKey.reqSigs,
                        amount: new BigNumber(output.value).times(100000000).toNumber(),
                        addrInfo: output.scriptPubKey.addresses.map((address, idx) => {
                            // Try to get information about address in multi-sig output
                            const addrInfo = Catenis.keyStore.getAddressInfo(address, true);

                            return addrInfo !== null ? addrInfo : decodedScript.pubKeys[idx].toString('hex');
                        })
                    }
                }
                else {
                    // An unexpected scriptPubKey type. Log error and save type as it is
                    Catenis.logger.WARN('Transaction output with an unexpected scriptPubKey type', {output: output});

                    txOutput.type = output.scriptPubKey.type;
                }

                tx.outputs.push(txOutput);
            });

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
            if ((err.name === 'MongoError' || err.name === 'BulkWriteError') && err.code === 11000 && err.errmsg.search(/index:\s+originalTxid/) >= 0) {
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

                    // NOTE: we CANNOT update the 'info.readConfirmation.serializedTx.inputs.txid' field with a single
                    //  update call due to the fact that there is no guarantee that, for a given doc/rec, the inputs
                    //  (array) field will have only unique values for the txid field (due to the inputs used to pay
                    //  for the tx expense)
                    Catenis.db.collection.SentTransaction.find({
                        'info.readConfirmation.serializedTx.inputs.txid': originalTxid
                    }, {
                        fields: {
                            _id: 1,
                            'info.readConfirmation.serializedTx.inputs': 1
                        }
                    }).forEach((doc) => {
                        Catenis.db.collection.SentTransaction.update({
                            _id: doc._id
                        }, {
                            $set: {
                                'info.readConfirmation.serializedTx.inputs': doc.info.readConfirmation.serializedTx.inputs.map((input) => {
                                    if (input.txid === originalTxid) {
                                        input.txid = modifiedTxid;
                                    }

                                    return input;
                                })
                            }
                        })
                    });

                    Catenis.db.collection.Billing.update({'serviceTx.txid': originalTxid}, {
                        $set: {
                            'serviceTx.txid': modifiedTxid
                        }
                    });

                    Catenis.db.collection.Billing.update({'servicePaymentTx.txid': originalTxid}, {
                        $set: {
                            'servicePaymentTx.txid': modifiedTxid
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

                // NOTE: we can update the 'info.readConfirmation.spentReadConfirmTxOuts.txid' field with a single update call
                //  due to the fact that it is guaranteed that, for a given doc/rec, the spentReadConfirmTxOuts (array)
                //  field will have only unique values for the txid field
                Catenis.db.collection.ReceivedTransaction.update({'info.readConfirmation.spentReadConfirmTxOuts.txid': originalTxid}, {
                    $set: {
                        'info.readConfirmation.spentReadConfirmTxOuts.$.txid': modifiedTxid
                    }
                });

                // Emit event notifying that txid has changed
                Catenis.malleabilityEventEmitter.notifyTxidChanged(originalTxid, modifiedTxid);
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
    nullData: 'nullData',    // Null data (OP_RETURN) output
    multisig: 'multisig'    // Multi-signature output
});

Transaction.diffType = Object.freeze({
    delete: 'D',        // Identifies an input/output that exists in this tx but not in the other tx
    update: 'U',        // Identifies an input/output that exists in both txs but with different amount/data
    insert: 'I'         // Identifies an input/output that exists in the other tx but not in this tx
});

Transaction.type = Object.freeze({
    sys_funding: Object.freeze({
        name: 'sys_funding',
        description: 'Transaction issued from outside of the system used to send crypto currency funds to the system',
        dbInfoEntryName: 'sysFunding'
    }),
    funding: Object.freeze({
        name: 'funding',
        description: 'Transaction used to transfer crypto currency funds to internal blockchain addresses controlled by the system',
        dbInfoEntryName: 'funding'
    }),
    bcot_payment: Object.freeze({
        name: 'bcot_payment',
        description: 'Transaction used to store away BCOT tokens received as payment in exchange for Catenis service credits',
        dbInfoEntryName: 'bcotPayment'
    }),
    store_bcot: Object.freeze({
        name: 'store_bcot',
        description: 'Transaction issued from outside of the system used to send BCOT tokens as payment for services a given client',
        dbInfoEntryName: 'storeBcot'
    }),
    credit_service_account: Object.freeze({
        name: 'credit_service_account',
        description: 'Transaction used to issue an amount of Catenis service credit and transferred it to a client\'s service account',
        dbInfoEntryName: 'creditServiceAccount'
    }),
    spend_service_credit: Object.freeze({
        name: 'spend_service_credit',
        description: 'Transaction used to spend an amount of Catenis service credits from a client\'s service account to pay for a service',
        dbInfoEntryName: 'spendServiceCredit'
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
    issue_asset: Object.freeze({
        name: 'issue_asset',
        description: 'Transaction used to issue an amount of a Catenis assets for a device',
        dbInfoEntryName: 'issueAsset'
    }),
    transfer_asset: Object.freeze({
        name: 'transfer_asset',
        description: 'Transaction used to transfer an amount of Catenis asset owned by a device to another device',
        dbInfoEntryName: 'transferAsset'
    })
});

Transaction.ioToken = Object.freeze({
    null_data: Object.freeze({
        name: 'null_data',
        token: '<null_data>',
        description: 'Null data output'
    }),
    multisig_start: Object.freeze({
        name: 'multisig_start',
        token: '<multisig_start>',
        description: 'Signal start of a sequence of addresses from a multi-signature output'
    }),
    multisig_end: Object.freeze({
        name: 'multisig_end',
        token: '<multisig_end>',
        description: 'Signal end of a sequence of addresses from a multi-signature output'
    }),
    p2_unknown_addr: Object.freeze({
        name: 'p2_unknown_addr',
        token: '<p2_unknown_addr>',
        description: 'Output (or input spending such output) paying to an unknown address'
    }),
    p2_sys_dev_main_addr: Object.freeze({
        name: 'p2_sys_dev_main_addr',
        token: '<p2_sys_dev_main_addr>',
        description: 'Output (or input spending such output) paying to a system device main address'
    }),
    p2_sys_fund_pay_addr: Object.freeze({
        name: 'p2_sys_fund_pay_addr',
        token: '<p2_sys_fund_pay_addr>',
        description: 'Output (or input spending such output) paying to a system funding payment address'
    }),
    p2_sys_fund_chg_addr: Object.freeze({
        name: 'p2_sys_fund_chg_addr',
        token: '<p2_sys_fund_chg_addr>',
        description: 'Output (or input spending such output) paying to a system funding change address'
    }),
    p2_sys_pay_tx_exp_addr: Object.freeze({
        name: 'p2_sys_pay_tx_exp_addr',
        token: '<p2_sys_pay_tx_exp_addr>',
        description: 'Output (or input spending such output) paying to a system pay tx expense address'
    }),
    p2_sys_read_conf_spnd_ntfy_addr: Object.freeze({
        name: 'p2_sys_read_conf_spnd_ntfy_addr',
        token: '<p2_sys_read_conf_spnd_ntfy_addr>',
        description: 'Output paying to a system read confirmation spend notify address'
    }),
    p2_sys_read_conf_spnd_only_addr: Object.freeze({
        name: 'p2_sys_read_conf_spnd_only_addr',
        token: '<p2_sys_read_conf_spnd_only_addr>',
        description: 'Output paying to a system read confirmation spend only address'
    }),
    p2_sys_read_conf_spnd_null_addr: Object.freeze({
        name: 'p2_sys_read_conf_spnd_null_addr',
        token: '<p2_sys_read_conf_spnd_null_addr>',
        description: 'Output paying to a system read confirmation spend null address'
    }),
    p2_sys_read_conf_pay_tx_exp_addr: Object.freeze({
        name: 'p2_sys_read_conf_pay_tx_exp_addr',
        token: '<p2_sys_read_conf_pay_tx_exp_addr>',
        description: 'Output (or input spending such output) paying to a system read confirmation pay tx expense address'
    }),
    p2_sys_serv_pymt_pay_tx_exp_root: Object.freeze({
        name: 'p2_sys_serv_pymt_pay_tx_exp_root',
        token: '<p2_sys_serv_pymt_pay_tx_exp_root>',
        description: 'Output (or input spending such output) paying to a system service payment pay tx expense address'
    }),
    p2_sys_serv_cred_issu_addr: Object.freeze({
        name: 'p2_sys_serv_cred_issu_addr',
        token: '<p2_sys_serv_cred_issu_addr>',
        description: 'Output (or input spending such output) paying to a system service credit issuance address'
    }),
    p2_sys_serv_pymt_pay_tx_exp_addr: Object.freeze({
        name: 'p2_sys_serv_pymt_pay_tx_exp_addr',
        token: '<p2_sys_serv_pymt_pay_tx_exp_addr>',
        description: 'Output (or input spending such output) paying to a system service payment pay tx expense address'
    }),
    p2_sys_msig_sign_addr: Object.freeze({
        name: 'p2_sys_msig_sign_addr',
        token: '<p2_sys_msig_sign_addr>',
        description: 'Output (or input spending such output) paying to a system multi-signature Colored Coins tx out signee address'
    }),
    p2_cln_srv_acc_cred_ln_addr: Object.freeze({
        name: 'p2_cln_srv_acc_cred_ln_addr',
        token: '<p2_cln_srv_acc_cred_ln_addr>',
        description: 'Output (or input spending such output) paying to a client service account credit line address'
    }),
    p2_cln_srv_acc_debt_ln_addr: Object.freeze({
        name: 'p2_cln_srv_acc_debt_ln_addr',
        token: '<p2_cln_srv_acc_debt_ln_addr>',
        description: 'Output (or input spending such output) paying to a client service account debit line address'
    }),
    p2_cln_bcot_pay_addr: Object.freeze({
        name: 'p2_cln_bcot_pay_addr',
        token: '<p2_cln_bcot_pay_addr>',
        description: 'Output (or input spending such output) paying to a client BCOT token payment address'
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
//                     //  address type from KeyStore.extKeyType.<type>.name: pay to that type of address
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

// NOTE: this method DOES NOT validate whether the supplied hex-encoded string is a valid
//        public key, which is exactly what we want since it is primarily used to convert
//        fabricated public keys used to store Colored Coins data (basically metadata hash)
//        that might not fit into a tx null data output. We do NOT do it by simply calling
//        bitcoinLib.ECPair.fromPublicKeyBuffer().getAddress(), which might at first
//        seem to be more intuitive, because the ECPair.fromPublicKeyBuffer() method checks
//        and adjusts the pubic key before importing it, and we would end up producing a
//        blockchain address that did not match our fabricated public key.
function addressFromPublicKey(pubKey) {
    return bitcoinLib.address.toBase58Check(bitcoinLib.crypto.hash160(Buffer.from(pubKey, 'hex')), Catenis.application.cryptoNetwork.pubKeyHash);
}

export function fixClone(clone) {
    clone.inputs = _.clone(clone.inputs);
    clone.outputs = _.clone(clone.outputs);

    if (clone.savedSizeProfile !== undefined) {
        clone.savedSizeProfile = _.clone(clone.savedSizeProfile);
    }

    return clone;
}


// Module code
//

// Definition of properties
Object.defineProperties(Transaction, {
    txOutputDustAmount: {
        get: function () {
            return cfgSettings.txOutputDustAmount;
        },
        enumerable: true
    },
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
    },
    maxTxSize: {
        get: function () {
            return cfgSettings.maxTxSize;
        },
        enumerable: true
    }
});

// Lock function class
Object.freeze(Transaction);
