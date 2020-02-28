/**
 * Created by claudio on 2018-10-28.
 */

//console.log('[OmniTransaction.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import util from 'util';
// Third-party node modules
import BigNumber from 'bignumber.js';
import _und from 'underscore';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { Transaction } from './Transaction';
import { BcotToken } from './BcotToken';
import { OmniCore } from './OmniCore';

// Config entries
/*const config_entryConfig = config.get('config_entry');

// Configuration settings
const cfgSettings = {
    property: config_entryConfig.get('property_name')
};*/

const omniDataPrefix = 'omni';


// Definition of function classes
//

// OmniTransaction function class
export class OmniTransaction extends Transaction {
    // Constructor arguments:
    //   omniTxType [Object] - An object corresponding to one of the properties of OmniTransaction.omniTxType different than OmniTransaction.omniTxType.unknown
    //   useOptInRBF [Boolean] - (optional, default=false) Indicates whether Replace By Fee should be used with this transaction
    constructor(omniTxType, propertyId = BcotToken.bcotOmniPropertyId, useOptInRBF = false) {
        super(useOptInRBF);

        // Validate arguments
        const errArg = {};

        if (!isValidOmniTxType(omniTxType)) {
            errArg.omniTxType = omniTxType;
        }

        // NOTE: if property ID is valid, the tokenDivisibility property is automatically set
        if (!isValidPropertyId.call(this, propertyId)) {
            errArg.propertyId = propertyId;
        }

        if (Object.keys(errArg).length > 0) {
            const errArgs = Object.keys(errArg);

            Catenis.logger.ERROR(util.format('OmniTransaction constructor called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
            throw new Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
        }

        // Properties definition
        //  NOTE: arrow functions should NOT be used for the getter/setter of the defined properties.
        //      This is to avoid that, if `this` is referred from within the getter/setter body, it
        //      refers to the object from where the properties have been defined rather than to the
        //      object from where the property is being accessed. Normally, this does not represent
        //      an issue (since the object from where the property is accessed is the same object
        //      from where the property has been defined), but it is especially dangerous if the
        //      object can be cloned.
        Object.defineProperties(this, {
            hasSendingAddressInput: {
                get: function () {
                    return this.sendingAddress !== undefined;
                },
                enumerable: true
            },
            hasReferenceAddressOutput: {
                get: function () {
                    return this.referenceAddress !== undefined;
                },
                enumerable: true
            },
            hasOmniDataOutput: {
                get: function () {
                    return this.hasNullDataOutput;
                },
                enumerable: true
            }
        });

        this.omniTxType = omniTxType;
        this.propertyId = propertyId;

        this.validated = false;
        this.sendingAddress = undefined;
        this.referenceAddress = undefined;
    }

    addInputs(inputs, pos) {
        return super.addInputs(inputs, fixInputPosition.call(this, pos));
    }

    addOutputs(outputs, pos) {
        return super.addOutputs(outputs, fixOutputPosition.call(this, pos));
    }

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
    addSendingAddressInput(txout, outputInfo) {
        if (!this.hasSendingAddressInput) {
            const result = this.addInput(txout, outputInfo, 0);

            this.sendingAddress = outputInfo.address;

            return result;
        }
        else {
            Catenis.logger.ERROR('Omni transaction already has a Sending Address input');
        }
    }

    addReferenceAddressOutput(address, amount) {
        if (!this.hasReferenceAddressOutput) {
            const result = this.addPubKeyHashOutput(address, amount);

            this.referenceAddress = address;

            return result;
        }
        else {
            Catenis.logger.ERROR('Omni transaction already as a Reference Address output');
        }
    }

    // NOTE: arguments depend on Omni transaction type
    //  omniTxType.simpleSend:
    //    amount [Number|String] - Amount of property tokens to send expressed in the token's lowest unit
    addOmniPayloadOutput() {
        if (!this.hasOmniPayloadOutput) {
            let omniData;

            switch (this.omniTxType.name) {
                case OmniTransaction.omniTxType.simpleSend.name:
                    // arguments[0] == amount
                    omniData = Catenis.omniCore.omniCreatePayloadSimpleSend(this.propertyId, this.amountToStrAmount(arguments[0]));

                    break;
            }

            if (omniData) {
                // Add null data output
                const result = this.addNullDataOutput(Buffer.concat([Buffer.from(omniDataPrefix), Buffer.from(omniData, 'hex')]));

                this.hasOmniPayloadOutput = true;

                return result;
            }
        }
        else {
            Catenis.logger.ERROR('Omni transaction already as an Omni Payload output');
        }
    }

    // Converts number representing a token amount expressed in token's lowest unit to a string representing the same amount as a decimal number
    //
    // Arguments:
    //  amount [Number] -
    amountToStrAmount(amount) {
        return new BigNumber(amount).dividedBy(Math.pow(10, this.tokenDivisibility)).toString()
    }

    // Converts a string representing a token amount as a decimal number to a number representing the same amount expressed in token's lowest unit
    strAmountToAmount(strAmount, returnBigNumber = false) {
        const bnAmount = new BigNumber(strAmount).times(Math.pow(10, this.tokenDivisibility));

        return returnBigNumber ? bnAmount : bnAmount.toNumber();
    }
}

// Public OmniTransaction object methods
//

/*OmniTransaction.prototype.pub_func = function () {
};*/

// Module functions used to simulate private OmniTransaction object methods
//  NOTE: these functions need to be bound to a OmniTransaction object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

function isValidPropertyId(id) {
    let result = false;

    if (id === BcotToken.bcotOmniPropertyId) {
        this.tokenDivisibility = BcotToken.tokenDivisibility;
        result = true;
    }
    else {
        try {
            const propertyInfo = Catenis.omniCore.omniGetProperty(id);

            this.tokenDivisibility = propertyInfo.divisible ? 100000000 : 0;
            result = true;
        }
        catch (err) {}
    }

    return result;
}

function fixInputPosition(pos) {
    if (this.hasSendingAddressInput && pos === 0) {
        Catenis.logger.DEBUG('Position of Omni transaction input shifted to avoid overriding Sending Address input');
        pos = 1;
    }

    return pos;
}

function fixOutputPosition(pos) {
    if (this.hasOmniPayloadOutput && pos === 0) {
        Catenis.logger.DEBUG('Position of Omni transaction output shifted to avoid overriding Omni Payload output');
        pos = 1;
    }
    else if (this.hasReferenceAddressOutput && (pos === undefined || pos >= this.outputs.length)) {
        Catenis.logger.DEBUG('Position of Omni transaction output shifted to avoid overriding Reference Address output');
        pos = this.outputs.length - 1;
    }

    return pos;
}


// OmniTransaction function class (public) methods
//

// Converts a (deserialized) transaction into an Omni transaction
//
//  Arguments:
//   transact: [Object(Transaction)] - Transaction object containing deserialized transaction to be converted
//
//  Return:
//   omniTransact: [Object(OmniTransaction)] - OmniTransaction object containing resulting Omni transaction, or undefined
//                                             if deserialized transaction is not a valid Omni transaction
OmniTransaction.fromTransaction = function (transact) {
    // Try to get Omni transaction info
    let omniTxInfo;

    try {
        omniTxInfo = Catenis.omniCore.omniGetTransaction(transact.txid, false);
    }
    catch (err) {
        if ((err instanceof Meteor.Error) && err.error === 'ctn_omcore_rpc_error' && err.details !== undefined && typeof err.details.code === 'number') {
            if (err.details.code !== OmniCore.rpcErrorCode.RPC_INVALID_ADDRESS_OR_KEY) {
                Catenis.logger.DEBUG(err.reason, err.details);
                throw err;
            }
        }
        else {
            throw err;
        }
    }

    if (omniTxInfo !== undefined) {
        let omniTxType;

        switch (omniTxInfo.type_int) {
            case 0:
                omniTxType = OmniTransaction.omniTxType.simpleSend;

                break;

            default:
                omniTxType = OmniTransaction.omniTxType.unknown;

                break;
        }

        const omniTransact = new OmniTransaction(omniTxType, omniTxInfo.propertyid);

        _und.extendOwn(omniTransact, transact);

        // Make sure that block time is saved if transaction is confirmed
        if (omniTxInfo.blocktime && !omniTransact.blockDate) {
            omniTransact.blockDate = new Date(omniTxInfo.blocktime * 1000);
        }

        omniTransact.sendingAddress = omniTxInfo.sendingaddress;
        omniTransact.referenceAddress = omniTxInfo.referenceaddress;
        omniTransact.hasOmniPayloadOutput = omniTransact.hasNullDataOutput;

        if (omniTxInfo.valid !== undefined) {
            omniTransact.validated = true;
            omniTransact.isValid = omniTxInfo.valid;
            omniTransact.invalidReason = omniTxInfo.invalidreason;
        }

        omniTransact.omniTxInfo = omniTxInfo;

        return omniTransact;
    }
};


// OmniTransaction function class (public) properties
//

OmniTransaction.omniTxType = Object.freeze({
    simpleSend: Object.freeze({
        name: 'simpleSend',
        description: 'Omni transaction used to transfer a given amount of property tokens from one address (the sending address) to another (the reference address)'
    }),
    unknown: Object.freeze({
        name: 'unknown',
        description: 'An unrecognized Omni transaction'
    })
});


// Definition of module (private) functions
//

function isValidOmniTxType(type) {
    return Object.values(OmniTransaction.omniTxType).some(omniTxType => omniTxType === type);
}


// Module code
//

// Lock function class
Object.freeze(OmniTransaction);
