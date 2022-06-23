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

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { BitcoinCore } from './BitcoinCore';
import { BaseBlockchainAddress } from './BaseBlockchainAddress';
import { CriticalSection } from './CriticalSection';
import { Util } from './Util';
import { KeyStore } from './KeyStore';
import { BitcoinInfo } from './BitcoinInfo';
import { TransactionSize } from './TransactionSize';

// Config entries
const configTransact = config.get('transaction');

// Configuration settings
export const cfgSettings = {
    witnessOutputDustAmount: configTransact.get('witnessOutputDustAmount'),
    nonWitnessOutputDustAmount: configTransact.get('nonWitnessOutputDustAmount'),
    legacyDustAmount: configTransact.get('legacyDustAmount'),
    maxTxVsize: configTransact.get('maxTxVsize'),
    pubKeySize: configTransact.get('pubKeySize'),
    oneOf2MultiSigTxOutputDustAmount: configTransact.get('oneOf2MultiSigTxOutputDustAmount'),
    oneOf3multiSigTxOutputDustAmount: configTransact.get('oneOf3multiSigTxOutputDustAmount')
};

// Critical section object to avoid concurrent access to database when
//  fixing transaction malleability
const dbMalleabilityCS = new CriticalSection();

const minimumTxBaseSize = 82;
const dummyChainCode = Buffer.alloc(32, 0);


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
//    isWitness: [Boolean],  - Indicates whether unspent output being spent is of a segregated witness type
//    scriptPubKey: [String],  - (optional for non-witness tx out) Hex-encoded public key script of unspent output being spent
//    address: [String]  - (optional) Blockchain address associated with unspent output being spent
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
//    type: [Object],  - Object representing the type of the tx output. Valid values: any of the properties of BitcoinInfo.outputType
//    payInfo: {       - Should exist for a paying output type (any type other than 'nulldata' or 'unknown')
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
//    data: [Object(Buffer)], - Should only exist for 'nulldata' output type
//    scriptPubKey: [String]  - Hex-encoded public key script of the tx output. Should only exist when transaction is deserialized
//                               (generated from Transaction.fromHex())
//  }

export function Transaction(useOptInRBF = false) {
    this.inputs = [];
    this.outputs = [];
    this.hasNullDataOutput = false;
    this.nullDataPayloadSize = 0;
    // rawTxInfo: {
    //   hex: [String],  Hex-encoded serialized transaction
    //   sizeInfo: {
    //     size: [Number],  Total transaction size, in bytes
    //     vsize: [Number],  Virtual transaction size, in vbytes
    //     weight: [Number]  Transaction weight
    //   }
    // }
    this.rawTxInfo = undefined;
    this.txid = undefined;
    this.sentDate = undefined;
    this.txSaved = false;
    this.useOptInRBF = useOptInRBF;     // Indicates whether opt-in Replace By Fee feature should be used when building transaction

    this.txSize = new TransactionSize(this);

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

// Add one or more inputs to the transaction (spending a given unspent tx output each)
//
//  Arguments:
//   inputs [Array(Object)|Object] [{
//     txout {  Unspent tx output to spend
//       txid: [String],   Transaction ID
//       vout: [Number],   Output number in tx
//       amount: [Number]  Amount help by output in satoshis
//     },
//     isWitness: [Boolean],    Indicates whether unspent tx output is of a (segregated) witness type
//     scriptPubKey: [String],  (not required for non-witness outputs) Hex-encoded public key script of unspent tx output
//     address: [String],       Blockchain address associated with unspent tx output
//     addrInfo: [Object]       Catenis address info including crypto key pair required to spend output
//   }]
//   pos [Number]  Position (starting from zero) at which inputs should be added to transaction in sequence. If the
//                  specified position is already taken, the current inputs are pushed aside (shifted) before inserting
//                  the new ones. If no position is specified, inputs are added after the last occupied position
//
//  Return:
//   posAdded [Number]  Starting position where inputs have been effectively added, or
//                       `undefined` if no inputs have been added
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
            pos = this.inputs.length;
            Array.prototype.push.apply(this.inputs, inputs);
        }
        else {
            // A specific position has been given
            inputs.some((input, idx) => {
                if (this.inputs[pos + idx] === undefined) {
                    // The position is not yet taken. Just add new
                    //  input to that position
                    this.inputs[pos + idx] = input;
                }
                else {
                    // The position is already taken. Push aside input
                    //  that is currently in that position, and add
                    //  the remaining inputs into that position
                    Array.prototype.splice.apply(this.inputs, [pos + idx, 0, ...inputs.slice(idx)]);

                    // Stop iterating
                    return true;
                }

                // Continue iterating
                return false;
            });
        }

        invalidateTx.call(this);

        return pos;
    }
};

// Add an input to the transaction (spending a given unspent tx output)
//
//  Arguments:
//   txout [Object] {  Unspent tx output to spend
//     txid: [String],   Transaction ID
//     vout: [Number],   Output number in tx
//     amount: [Number]  Amount help by output in satoshis
//   }
//   outputInfo [Object] {
//     isWitness: [Boolean],    Indicates whether unspent tx output is of a (segregated) witness type
//     scriptPubKey: [String],  (not required for non-witness outputs) Hex-encoded public key script of unspent tx output
//     address: [String],       Blockchain address associated with unspent tx output
//     addrInfo: [Object]       Catenis address info including crypto key pair required to spend output
//   }
//   pos [Number]  Position (starting from zero) at which input should be added to transaction
//
//  Return:
//   posAdded [Number]  Position where input has been effectively added, or
//                       `undefined` if input has not been added
Transaction.prototype.addInput = function (txout, outputInfo, pos) {
    const input = {
        txout,
        ...outputInfo
    };

    return this.addInputs(input, pos);
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

// Add one or more outputs to the transaction
//
//  Arguments:
//   outputs [Array(Object)|Object] [{
//     type: [Object],   Object representing the type of the tx output. Valid values: any of the properties of BitcoinInfo.outputType
//     payInfo: {   Should only be specified for a paying output type (any type other than 'nulldata' or 'unknown')
//       address: [String|Array(String)],  Blockchain address to where payment should be sent.
//                                          NOTE: for 'multisig' outputs, this is actually a list of addresses
//       nSigs: [Number],     Number of signatures required to spend multi-signature output. Should only be specified for 'multisig' output type
//       amount: [Number],    Amount, in satoshis, to send
//       addrInfo: [Array(Object|String)]  List of Catenis address infos (including crypto key pair required to spend output) or hex-encoded
//                                          public keys (for non-Catenis blockchain addresses). Should only be specified for 'multisig' output type
//     },
//     data: [Object(Buffer)]   Data to embed for 'nulldata' output type
//   }]
//   pos [Number]  Position (starting from zero) at which outputs should be added to transaction in sequence. If the
//                  specified position is already taken, the current outputs are pushed aside (shifted) before inserting
//                  the new ones. If no position is specified, inputs are added after the last occupied position
//
//  Return:
//   posAdded [Number]  Starting position where outputs have been effectively added, or
//                       `undefined` if no outputs have been added
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
            pos = this.outputs.length;
            Array.prototype.push.apply(this.outputs, outputs);
        }
        else {
            // A specific position has been given
            outputs.some((output, idx) => {
                if (this.outputs[pos + idx] === undefined) {
                    // The position is not yet taken. Just add new
                    //  output to that position
                    this.outputs[pos + idx] = output;
                }
                else {
                    // The position is already taken. Push aside output
                    //  that is currently in that position, and add
                    //  the remaining outputs into that position
                    Array.prototype.splice.apply(this.outputs, [pos + idx, 0, ...outputs.slice(idx)]);

                    // Stop iterating
                    return true;
                }

                // Continue iterating
                return false;
            });
        }

        invalidateTx.call(this);

        return pos;
    }
};

// Add one or more outputs to the transaction that pay to a public key hash either using
//  segregated witness (P2WPKH) or not (P2PKH)
//
//  Arguments:
//   payInfos [Array(Object)|Object] [{
//     address: [String],  Blockchain address to where payment should be sent
//     amount: [Number]    Amount, in satoshis, to send
//   }]
//   pos [Number]  Position (starting from zero) at which outputs should be added to transaction
//
//  Return:
//   posAdded [Number]  Starting position where outputs have been effectively added, or
//                       `undefined` if no outputs have been added
Transaction.prototype.addPubKeyHashOutputs = function (payInfos, pos) {
    if (!Array.isArray(payInfos)) {
        payInfos = [payInfos];
    }

    if (pos !== undefined && pos < 0) {
        pos = 0;
    }

    const outputs = payInfos.map((payInfo) => {
        return {
            type: Catenis.bitcoinInfo.getOutputTypeForAddress(payInfo.address),
            payInfo: payInfo
        }
    });

    return this.addOutputs(outputs, pos);
};

// Add an output to the transaction that pays to a public key hash either using segregated
//  witness (P2WPKH) or not (P2PKH)
//
//  Arguments:
//   address [String]  Blockchain address to where payment should be sent
//   amount [Number]  Amount, in satoshis, to send
//   pos [Number]  Position (starting from zero) at which output should be added to transaction
//
//  Return:
//   posAdded [Number]  Position where output has been effectively added, or
//                       `undefined` if output has not been added
Transaction.prototype.addPubKeyHashOutput = function (address, amount, pos) {
    return this.addPubKeyHashOutputs({
        address: address,
        amount: amount
    }, pos);
};

// Add one or more outputs to the transaction that pay to multiple public key hashes (multisig)
//
//  Arguments:
//   payInfos [Array(Object)|Object] [{
//     address: [Array(String)],  List of Catenis blockchain addresses or non-Catenis hex-encoded public keys
//     nSigs: [Number],     Number of signatures required to spend multi-signature output
//     amount: [Number],    Amount, in satoshis, to send
//     addrInfo: [Array(Object|String)]  List of Catenis address infos (including crypto key pair required to spend output) or hex-encoded
//                                          public keys (for non-Catenis blockchain addresses)
//   }]
//   pos [Number]  Position (starting from zero) at which outputs should be added to transaction
//
//  Return:
//   posAdded [Number]  Starting position where outputs have been effectively added, or
//                       `undefined` if no outputs have been added
Transaction.prototype.addMultiSigOutputs = function (payInfos, pos) {
    if (!Array.isArray(payInfos)) {
        payInfos = [payInfos];
    }

    if (pos !== undefined && pos < 0) {
        pos = 0;
    }

    const outputs = payInfos.map((payInfo) => {
        return {
            type: BitcoinInfo.outputType.multisig,
            payInfo: payInfo
        }
    });

    return this.addOutputs(outputs, pos);
};

// Add an output to the transaction that pays to multiple public key hashes (multisig)
//
//  Arguments:
//   addresses [Array(String)]  List of Catenis blockchain addresses or non-Catenis hex-encoded public keys
//   nSigs [Number]  Number of signatures required for spending multi-signature output
//   amount [Number]  Amount, in satoshis, to send
//   pos [Number]  Position (zero-based index) for output in transaction
//
//  Return:
//   posAdded [Number]  Position where output has been effectively added, or
//                       `undefined` if output has not been added
Transaction.prototype.addMultiSigOutput = function (addresses, nSigs, amount, pos) {
    return this.addMultiSigOutputs(addresses.reduce((payInfo, address) => {
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

    if (output !== undefined && Transaction.isPayingOutput(output.type) && amount !== 0) {
        output.payInfo.amount += amount;
        invalidateTx.call(this);
    }
};

Transaction.prototype.resetOutputAmount = function (pos, amount) {
    const output = this.outputs[pos];

    if (output !== undefined && Transaction.isPayingOutput(output.type) && amount !== output.payInfo.amount) {
        output.payInfo.amount = amount;
        invalidateTx.call(this);
    }
};

// Add an output to the transaction that is used to embed data (nulldata)
//
//  Arguments:
//   data [Object(Buffer)|String]  The data to be embedded
//
//  Return:
//   posAdded [Number]  Position where output has been effectively added, or
//                      `undefined` if output has not been added
Transaction.prototype.addNullDataOutput = function (data, pos) {
    if (!this.hasNullDataOutput) {
        if (!Buffer.isBuffer(data)) {
            data = Buffer.from(data);
        }

        const posAdded = this.addOutputs({
            type: BitcoinInfo.outputType.nulldata,
            data: data
        }, pos);
        this.hasNullDataOutput = true;
        this.nullDataPayloadSize = data.length;

        return posAdded;
    }
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

Transaction.prototype.getLastOutput = function () {
    if (this.outputs.length > 0) {
        return this.outputs[this.outputs.length - 1];
    }
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

        if (output.type === BitcoinInfo.outputType.nulldata) {
            this.hasNullDataOutput = false;
            this.nullDataPayloadSize = 0;
        }
    }

    if (output !== undefined) {
        invalidateTx.call(this);
    }

    return output;
};

Transaction.prototype.getMultiSigOutputPositions = function () {
    const poss = [];

    for (let pos = 0, lastPos = this.outputs.length - 1; pos <= lastPos; pos++) {
        if (this.outputs[pos].type === BitcoinInfo.outputType.multisig) {
            poss.push(pos);
        }
    }

    return poss.length > 0 ? poss : undefined;
};

Transaction.prototype.getNullDataOutputPosition = function () {
    let pos = undefined;

    if (this.hasNullDataOutput) {
        pos = this.outputs.findIndex((output) => {
            return output.type === BitcoinInfo.outputType.nulldata;
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
            return output.type === BitcoinInfo.outputType.nulldata;
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

        if (output !== undefined && Transaction.isPayingOutput(output.type)) {
            if (output.type !== BitcoinInfo.outputType.multisig) {
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

        if (output !== undefined && Transaction.isPayingOutput(output.type)) {
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

Transaction.prototype.countNonWitnessInputs = function (startPos = 0, endPos) {
    let count = 0;

    for (let pos = startPos, lastPos = endPos === undefined ? this.inputs.length - 1 : endPos; pos <= lastPos; pos++) {
        const input = this.inputs[pos];

        if (input !== undefined && !input.isWitness) {
            count++;
        }
    }

    return count;
};

Transaction.prototype.countWitnessInputs = function (startPos = 0, endPos) {
    let count = 0;

    for (let pos = startPos, lastPos = endPos === undefined ? this.inputs.length - 1 : endPos; pos <= lastPos; pos++) {
        const input = this.inputs[pos];

        if (input !== undefined && input.isWitness) {
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

        if (output !== undefined && output.type === BitcoinInfo.outputType.pubkeyhash) {
            count++;
        }
    }

    return count;
};

Transaction.prototype.countP2WPKHOutputs = function (startPos = 0, endPos) {
    let count = 0;

    for (let pos = startPos, lastPos = endPos === undefined ? this.outputs.length - 1 : endPos; pos <= lastPos; pos++) {
        const output = this.outputs[pos];

        if (output !== undefined && output.type === BitcoinInfo.outputType.witness_v0_keyhash) {
            count++;
        }
    }

    return count;
};

Transaction.prototype.getNumPubKeysMultiSigOutputs = function (startPos = 0, endPos) {
    let numPubKeysMultiSigOutputs = [];

    for (let pos = startPos, lastPos = endPos === undefined ? this.outputs.length - 1 : endPos; pos <= lastPos; pos++) {
        const output = this.outputs[pos];

        if (output !== undefined && output.type === BitcoinInfo.outputType.multisig) {
            numPubKeysMultiSigOutputs.push(output.payInfo.addrInfo.length);
        }
    }

    return numPubKeysMultiSigOutputs;
};

//  Return:
//   sizeInfo: {
//     size: [Number],  Total transaction size, in bytes
//     vsize: [Number],  Virtual transaction size, in vbytes
//     weight: [Number]  Transaction weight
//   }
Transaction.prototype.estimateSize = function () {
    return this.txSize.getSizeInfo();
};

//  Return:
//   sizeInfo: {
//     size: [Number],  Total transaction size, in bytes
//     vsize: [Number],  Virtual transaction size, in vbytes
//     weight: [Number]  Transaction weight
//   }
Transaction.prototype.realSize = function () {
    if (this.rawTxInfo) {
        return this.rawTxInfo.sizeInfo;
    }
};

// Returns signed raw transaction in hex format
Transaction.prototype.getTransaction = function () {
    if (!this.rawTxInfo) {
        // Build transaction adding all inputs and outputs in sequence
        //
        // NOTE: build transaction using the new Psbt class of bitcoinjs since the previous method,
        //      which used the TransactionBuilder class, has been deprecated. The Psbt class implements
        //      the Partially Signed Bitcoin Transaction (PSBT) format, which has been specified in
        //      BIP 174 and implemented in Bitcoin Core since ver. 0.17.
        const psbt = new bitcoinLib.Psbt({network: Catenis.application.cryptoNetwork});

        // Add inputs
        this.inputs.forEach(input => {
            const inputData = {
                hash: input.txout.txid,
                index: input.txout.vout
            };

            if (this.useOptInRBF) {
                inputData.sequence = 0xffffffff - 2;
            }

            if (input.isWitness) {
                // Spend a "pay-to-witness" tx output
                inputData.witnessUtxo = {
                    script: Buffer.from(input.scriptPubKey, 'hex'),
                    value: input.txout.amount
                }
            }
            else {
                // Spend a legacy (non-witness) tx output
                inputData.nonWitnessUtxo = Catenis.txCache.retrieve(inputData.hash);
            }

            psbt.addInput(inputData);
        });

        // Add outputs
        this.outputs.forEach(output => {
            let outputData;

            switch(output.type) {
                case BitcoinInfo.outputType.witness_v0_keyhash:
                case BitcoinInfo.outputType.pubkeyhash:
                    outputData = {
                        address: output.payInfo.address,
                        value: output.payInfo.amount
                    };

                    break;

                case BitcoinInfo.outputType.nulldata:
                    outputData = {
                        script: bitcoinLib.payments.embed({data: [output.data]}).output,
                        value: 0
                    };

                    break;

                case BitcoinInfo.outputType.multisig:
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

                    // NOTE: we are NOT using bitcoinLib.payments.p2ms(), which is the current recommended way to generate
                    //      multisignature outputs, because it validates the public keys passed in, and, in our case,
                    //      one or more of the provided public keys can be fabricated to hold additional data that will
                    //      not fit in a null data output (which is the case with Colored Coins metadata)
                    outputData = {
                        script: encodeMultiSigOutput(output.payInfo.nSigs, pubKeys),
                        value: output.payInfo.amount
                    };

                    break;
            }

            psbt.addOutput(outputData);
        });

        // Sign inputs
        this.inputs.forEach((input, idx) => {
            if (input.addrInfo) {
                psbt.signInput(idx, input.addrInfo.cryptoKeys.keyPair);
            }
        });

        psbt.validateSignaturesOfAllInputs(
            (pubKey, msgHash, signature) =>
                Catenis.bip32.fromPublicKey(pubKey, dummyChainCode).verify(msgHash, signature)
        );
        psbt.finalizeAllInputs();

        const btcTx = psbt.extractTransaction();

        this.rawTxInfo = {
            hex: btcTx.toHex(),
            sizeInfo: {
                size: btcTx.byteLength(),
                vsize: btcTx.virtualSize(),
                weight: btcTx.weight()
            }
        }
    }

    return this.rawTxInfo.hex;
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
//      isWitness: [Boolean],     - Indicates whether output that is spent is of a segregated witness type
//      addrPath: [String]        - HD node path of the blockchain address associated with the output that is spent by this input
//                                   Note: it shall have the actual blockchain address for non-Catenis blockchain addresses
//    }],
//    outputs: [{ [Array(Object)] - List of outputs currently added to the transaction
//      type: [String],           - Identifies the type of the output. Value of 'name' property of corresponding output type object
//      addrPath: [String|Array(String)], - (only present for a paying output type (any type other than 'nulldata' or 'unknown'))
//                                           HD node path of the blockchain address to where payment should be sent, or the actual
//                                           address for non-Catenis blockchain addresses.
//                                            NOTE: for 'multisig' outputs, this is actually a list of either HD node path
//                                              (for Catenis blockchain addresses) or hex-encoded public keys (for non-Catenis
//                                              blockchain addresses)
//      nSigs: [Number],          - (only present for output of type 'multisig') Number of signatures required to spend output
//      amount: [Number],         - (only present for a paying output type (any type other than 'nulldata' or 'unknown')) Amount, in satoshis, to send
//      data: [String],           - (only present for output of type 'nullData') Base-64 encoded data to be embedded in transaction
//      scriptPubKey: [String]    - (optional) Hex-encoded public key script of the tx output
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
                isWitness: input.isWitness,
                addrPath: addrInfo !== null ? addrInfo.path : input.address
            };
        }),
        outputs: this.outputs.map((output) => {
            const convOutput = {
                type: output.type.name
            };

            if (Transaction.isSingleAddressPayingOutput(output.type)) {
                const addrInfo = Catenis.keyStore.getAddressInfo(output.payInfo.address, true);

                convOutput.addrPath = addrInfo !== null ? addrInfo.path : output.payInfo.address;
                convOutput.amount = output.payInfo.amount;
            }
            else if (convOutput.type === BitcoinInfo.outputType.nulldata) {
                // noinspection JSCheckFunctionSignatures
                convOutput.data = output.data.toString('base64');
            }
            else if (convOutput.type === BitcoinInfo.outputType.multisig) {
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

            if (output.scriptPubKey) {
                convOutput.scriptPubKey = output.scriptPubKey;
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
        BaseBlockchainAddress.revertAddressList(this.listOutputAddresses(startPos, endPos));
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
            if (output.type === BitcoinInfo.outputType.witness_v0_keyhash || output.type === BitcoinInfo.outputType.pubkeyhash) {
                // Use both type (name) and address root (parent) path|address as key
                if (output.payInfo.addrInfo === undefined) {
                    // Address info not yet present, try to get it
                    output.payInfo.addrInfo = Catenis.keyStore.getAddressInfo(output.payInfo.address, true);
                }

                const key = {type: output.type.name};

                if (output.payInfo.addrInfo) {
                    key.rootPath = output.payInfo.addrInfo.parentPath
                }
                else {
                    // A non-Catenis blockchain address. Use address instead of parent path
                    key.address = output.payInfo.address;
                }

                this.compOutputs.set(JSON.stringify(key), output);
            }
            else if (output.type === BitcoinInfo.outputType.witness_v0_scripthash || output.type === BitcoinInfo.outputType.scripthash) {
                // Use both type (name) and address as the key
                this.compOutputs.set(JSON.stringify({
                    type: output.type.name,
                    address: output.address
                }), output);
            }
            else if (output.type === BitcoinInfo.outputType.nulldata) {
                // Use the type (name) as the key
                this.compOutputs.set(output.type.name, output);
            }
            else if (output.type === BitcoinInfo.outputType.multisig) {
                // Use type (name), list of address root (parent) paths|addresses, and number of signatures as key
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
                    type: output.type.name,
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
//                           -  NOTE: only present for diffType.update and a paying output type (any type other than 'nulldata' or 'unknown')
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

            if (Transaction.isPayingOutput(output.type)) {
                if (output.payInfo.amount !== otherOutput.payInfo.amount) {
                    diffResult.outputs.push({
                        diffType: Transaction.diffType.update,
                        output: output,
                        otherOutput: otherOutput,
                        deltaAmount: otherOutput.payInfo.amount - output.payInfo.amount
                    })
                }
            }
            else if (output.type === BitcoinInfo.outputType.nulldata) {
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
    this.rawTxInfo = this.txid = undefined;
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
        if (output.type !== BitcoinInfo.outputType.multisig) {
            let addrType = null;

            if (output.type === BitcoinInfo.outputType.nulldata) {
                addrType = undefined;
            }
            else if (Transaction.isSingleAddressPayingOutput(output.type)) {
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
            },
            isWitness: input.isWitness
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
        const outputType = BitcoinInfo.getOutputTypeByName(output.type);
        const convOutput = {
            type: outputType
        };

        if (Transaction.isSingleAddressPayingOutput(outputType)) {
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
        else if (output.type === BitcoinInfo.outputType.nulldata) {
            const dataBuf = Buffer.from(output.data, 'base64');

            convOutput.data = dataBuf;

            tx.hasNullDataOutput = true;
            tx.nullDataPayloadSize = dataBuf.length;
        }
        else if (output.type === BitcoinInfo.outputType.multisig) {
            convOutput.payInfo = {
                address: [],
                nSigs: output.nSigs,
                amount: output.amount,
                addrInfo: []
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

        if (output.scriptPubKey) {
            convOutput.scriptPubKey = output.scriptPubKey;
        }

        tx.outputs[idx] = convOutput;
    });

    if (txObj.txid !== undefined) {
        tx.txid = txObj.txid;
    }

    // Return deserialized tx
    return tx;
};

Transaction.fromTxid = function (txid, getTxTime = false, getBlockTime = false) {
    if (getTxTime || getBlockTime) {
        const txInfo = Catenis.bitcoinCore.getTransaction(txid, false, false, false);

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
            tx.rawTxInfo = {
                hex: hexTx,
                sizeInfo: {
                    size: decodedTx.size,
                    vsize: decodedTx.vsize,
                    weight: decodedTx.weight
                }
            };
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
                    },
                    isWitness: !!input.txinwitness
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

                        // Save public key script of spent output
                        input.scriptPubKey = output.scriptPubKey.hex;

                        const outputType = BitcoinInfo.getOutputTypeByName(output.scriptPubKey.type);

                        if (Transaction.isPayingOutput(outputType)) {
                            // Save address associated with output spent by input
                            input.address = output.scriptPubKey.address || (output.scriptPubKey.type === 'multisig'
                                ? Util.multiSigAddresses(output.scriptPubKey)[0]
                                : undefined);

                            // Since the type of all Catenis node's blockchain addresses is either P2PKH or P2WPKH,
                            //  we filter that specific type before trying to get its information
                            if (outputType === BitcoinInfo.outputType.witness_v0_keyhash || outputType === BitcoinInfo.outputType.pubkeyhash) {
                                // Try to get information about address associated with
                                //  spent output
                                const addrInfo = Catenis.keyStore.getAddressInfo(output.scriptPubKey.address, true);

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
                const outputType = BitcoinInfo.getOutputTypeByName(output.scriptPubKey.type);
                const txOutput = {
                    type: outputType
                };

                if (Transaction.isSingleAddressPayingOutput(outputType)) {
                    txOutput.payInfo = {
                        address: output.scriptPubKey.address,
                        amount: new BigNumber(output.value).times(100000000).toNumber()
                    };

                    // Try to get information about address associated with output
                    const addrInfo = Catenis.keyStore.getAddressInfo(txOutput.payInfo.address, true);

                    if (addrInfo !== null) {
                        txOutput.payInfo.addrInfo = addrInfo;
                    }
                }
                else if (outputType === BitcoinInfo.outputType.nulldata) {
                    txOutput.data = Buffer.concat(bitcoinLib.payments.embed({output: Buffer.from(output.scriptPubKey.hex, 'hex')}).data);

                    // Add information about null data
                    tx.hasNullDataOutput = true;
                    tx.nullDataPayloadSize = txOutput.data.length;
                }
                else if (outputType === BitcoinInfo.outputType.multisig) {
                    // Multi-signature output. Decode scriptPubKey to get public keys
                    const payment = bitcoinLib.payments.p2ms({output: Buffer.from(output.scriptPubKey.hex, 'hex')}, {validate: false});
                    const mSigAddresses = Util.multiSigAddresses(output.scriptPubKey);

                    txOutput.payInfo = {
                        address: mSigAddresses,
                        nSigs: payment.m,
                        amount: new BigNumber(output.value).times(100000000).toNumber(),
                        addrInfo: mSigAddresses.map((address, idx) => {
                            // Try to get information about address in multi-sig output
                            const addrInfo = Catenis.keyStore.getAddressInfo(address, true);

                            return addrInfo !== null ? addrInfo : payment.pubkeys[idx].toString('hex');
                        })
                    }
                }
                else {
                    // An unexpected scriptPubKey type. Log error and save type as it is
                    Catenis.logger.WARN('Transaction output with an unexpected scriptPubKey type', {output: output});
                }

                txOutput.scriptPubKey = output.scriptPubKey.hex;

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

                    Catenis.db.collection.SavedOffChainMsgData.update({'settlement.settleOffChainMsgsTxid': originalTxid}, {
                        $set: {
                            'settlement.settleOffChainMsgsTxid': modifiedTxid
                        }
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

                Catenis.db.collection.Billing.update({'serviceTx.complementaryTx.txid': originalTxid}, {
                    $set: {
                        'serviceTx.complementaryTx.txid': modifiedTxid
                    }
                });

                Catenis.db.collection.Billing.update({'offChainMsgServiceData.msgEnvelope.settlementTx.txid': originalTxid}, {
                    $set: {
                        'offChainMsgServiceData.msgEnvelope.settlementTx.txid': modifiedTxid
                    }
                });

                Catenis.db.collection.Billing.update({'offChainMsgServiceData.msgReceipt.settlementTx.txid': originalTxid}, {
                    $set: {
                        'offChainMsgServiceData.msgReceipt.settlementTx.txid': modifiedTxid
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

Transaction.isPayingOutput = function (outputType) {
    switch (outputType) {
        case BitcoinInfo.outputType.witness_v0_keyhash:
        case BitcoinInfo.outputType.pubkeyhash:
        case BitcoinInfo.outputType.witness_v0_scripthash:
        case BitcoinInfo.outputType.scripthash:
        case BitcoinInfo.outputType.multisig:
            return true;

        default:
            return false;
    }
};

Transaction.isSingleAddressPayingOutput = function (outputType) {
    switch (outputType) {
        case BitcoinInfo.outputType.witness_v0_keyhash:
        case BitcoinInfo.outputType.pubkeyhash:
        case BitcoinInfo.outputType.witness_v0_scripthash:
        case BitcoinInfo.outputType.scripthash:
            return true;

        default:
            return false;
    }
};

Transaction.dustAmountByOutputType = function (outputType) {
    return outputType.isWitness ? cfgSettings.witnessOutputDustAmount : cfgSettings.nonWitnessOutputDustAmount;
};

Transaction.dustAmountByAddressType = function (addrType) {
    return Transaction.dustAmountByOutputType(BitcoinInfo.getOutputTypeByAddressType(addrType));
};

Transaction.dustAmountByAddress = function (address) {
    return Transaction.dustAmountByOutputType(Catenis.bitcoinInfo.getOutputTypeForAddress(address));
};


// Transaction function class (public) properties
//

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
        description: 'Transaction issued from outside of the system used to send BCOT tokens as payment for services for a given client',
        dbInfoEntryName: 'bcotPayment'
    }),
    store_bcot: Object.freeze({
        name: 'store_bcot',
        description: 'Transaction used to store away BCOT tokens received as payment in exchange for Catenis service credits',
        dbInfoEntryName: 'storeBcot'
    }),
    bcot_replenishment: Object.freeze({
        name: 'bcot_replenishment',
        description: 'Transaction issued from outside of the system used to replenish stock of BCOT tokens for sale',
        dbInfoEntryName: 'bcotReplenishment'
    }),
    redeem_bcot: Object.freeze({
        name: 'redeem_bcot',
        description: 'Transaction used to redeem purchased BCOT tokens for Catenis service credits',
        dbInfoEntryName: 'redeemBcot'
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
        title: 'Send Message',
        description: 'Transaction used to send a message from origin device to target device',
        dbInfoEntryName: 'sendMessage'
    }),
    log_message: Object.freeze({
        name: 'log_message',
        title: 'Log Message',
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
        description: 'Transaction used to issue an amount of a Catenis asset for a device',
        dbInfoEntryName: 'issueAsset'
    }),
    issue_nf_asset: Object.freeze({
        name: 'issue_nf_asset',
        description: 'Transaction used to issue new non-fungible tokens of a Catenis non-fungible asset for one or more devices',
        dbInfoEntryName: 'issueNFAsset'
    }),
    transfer_asset: Object.freeze({
        name: 'transfer_asset',
        description: 'Transaction used to transfer an amount of a Catenis asset owned by a device to another device',
        dbInfoEntryName: 'transferAsset'
    }),
    settle_off_chain_messages: Object.freeze({
        name: 'settle_off_chain_messages',
        title: 'Settle Off-Chain Messages',
        description: 'Transaction used to settle Catenis off-chain messages to the blockchain',
        dbInfoEntryName: 'settleOffChainMessages'
    }),
    out_migrate_asset: Object.freeze({
        name: 'out_migrate_asset',
        description: 'Transaction used to out-migrate an amount of an exported Catenis asset to a foreign blockchain',
        dbInfoEntryName: 'outMigrateAsset'
    }),
    in_migrate_asset: Object.freeze({
        name: 'in_migrate_asset',
        description: 'Transaction used to in-migrate an amount of an exported Catenis asset from a foreign blockchain back to Catenis',
        dbInfoEntryName: 'inMigrateAsset'
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
    p2_sys_bcot_sale_stck_addr: Object.freeze({
        name: 'p2_sys_bcot_sale_stck_addr',
        token: '<p2_sys_bcot_sale_stck_addr>',
        description: 'Output (or input spending such output) paying to a system BCOT token sale stock address'
    }),
    p2_sys_oc_msgs_setlmt_pay_tx_exp_addr: Object.freeze({
        name: 'p2_sys_oc_msgs_setlmt_pay_tx_exp_addr',
        token: '<p2_sys_oc_msgs_setlmt_pay_tx_exp_addr>',
        description: 'Output (or input spending such output) paying to a system off-chain messages settlement pay tx expense address'
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
    p2_dev_migr_asst_addr: Object.freeze({
        name: 'p2_dev_migr_asst_addr',
        token: '<p2_dev_migr_asst_addr>',
        description: 'Output (or input spending such output) paying to a device migrated asset address'
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
        isValid = Object.values(Transaction.type).some((txType) => {
            return txType.name !== Transaction.type.sys_funding.name && txType.name !== Transaction.type.bcot_payment.name
                    && txType.name !== Transaction.type.bcot_replenishment.name && txType.name === type.name;
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
//        that might not fit into a tx null data output. We do NOT do it by simply issuing
//        the statement bitcoinLib.payments.p2pkh({pubkey, network}).address, which might
//        at first seem to be more intuitive, because bitcoinLib.payment.p2pkh() checks
//        whether the passed in public key is valid.
export function addressFromPublicKey(pubKey) {
    return bitcoinLib.address.toBase58Check(bitcoinLib.crypto.hash160(Buffer.from(pubKey, 'hex')), Catenis.application.cryptoNetwork.pubKeyHash);
}

export function fixClone(clone) {
    clone.inputs = Util.cloneObjArray(clone.inputs);
    clone.outputs = Util.cloneObjArray(clone.outputs);
    clone.txSize = clone.txSize.clone();
    // Attach transaction size object to cloned transaction object
    clone.txSize.resetState(clone);

    return clone;
}

function encodeMultiSigOutput (m, pubKeys) {
    if (typeof m !== 'number' || !Array.isArray(pubKeys)) {
        throw new Error(util.format('encodeMultiSigOutput(): method called with invalid parameters: %s', util.inspect({
            m: m,
            pubKeys: pubKeys
        })));
    }

    const n = pubKeys.length;

    if (n < m) {
        throw new TypeError('encodeMultiSigOutput(): not enough pubKeys provided');
    }

    return bitcoinLib.script.compile([].concat(
        bitcoinLib.script.OPS.OP_RESERVED + m,
        pubKeys,
        bitcoinLib.script.OPS.OP_RESERVED + n,
        bitcoinLib.script.OPS.OP_CHECKMULTISIG
    ));
}


// Module code
//

// Definition of properties
Object.defineProperties(Transaction, {
    witnessOutputDustAmount: {
        get: function () {
            return cfgSettings.witnessOutputDustAmount;
        },
        enumerable: true
    },
    nonWitnessOutputDustAmount: {
        get: function () {
            return cfgSettings.nonWitnessOutputDustAmount;
        },
        enumerable: true
    },
    legacyDustAmount: {
        get: function () {
            return cfgSettings.legacyDustAmount;
        },
        enumerable: true
    },
    maxTxVsize: {
        get: function () {
            return cfgSettings.maxTxVsize;
        },
        enumerable: true
    },
    minTxBaseSize: {
        get: function () {
            return minimumTxBaseSize;
        },
        enumerable: true
    }
});

// Lock function class
Object.freeze(Transaction);
