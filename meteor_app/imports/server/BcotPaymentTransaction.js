/**
 * Created by Claudio on 2017-11-26.
 */

//console.log('[BcotPaymentTransaction.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
//import config from 'config';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { KeyStore } from './KeyStore';
import { CatenisNode } from './CatenisNode';
import { BcotToken } from './BcotToken';
import { OmniTransaction } from './OmniTransaction';


// Definition of function classes
//

// BcotPaymentTransaction function class
//
//  Constructor arguments:
//   client: [Object(Client)] - Client to which payment is being made
//   omniTransact: [Object(OmniTransact)] - Deserialized omni transaction
export function BcotPaymentTransaction(client, omniTransact) {
    this.client = client;
    this.omniTransact = omniTransact;

    //  NOTE: arrow functions should NOT be used for the getter/setter of the defined properties.
    //      This is to avoid that, if `this` is referred from within the getter/setter body, it
    //      refers to the object from where the properties have been defined rather than to the
    //      object from where the property is being accessed. Normally, this does not represent
    //      an issue (since the object from where the property is accessed is the same object
    //      from where the property has been defined), but it is especially dangerous if the
    //      object can be cloned.
    Object.defineProperties(this, {
        bcotAmount: {
            get: function () {
                // noinspection JSPotentiallyInvalidUsageOfThis
                return omniTransact.strAmountToAmount(this.omniTransact.omniTxInfo.amount);
            },
            enumerable: true
        },
        payeeAddress: {
            get: function () {
                // noinspection JSPotentiallyInvalidUsageOfThis
                return this.omniTransact.referenceAddress;
            },
            enumerable: true
        },
        payingAddress: {
            get: function () {
                // noinspection JSPotentiallyInvalidUsageOfThis
                return this.omniTransact.sendingAddress;
            },
            enumerable: true
        },
        txid: {
            get: function () {
                // noinspection JSPotentiallyInvalidUsageOfThis
                return this.omniTransact.txid;
            }
        }
    });
}


// Public BcotPaymentTransaction object methods
//


// Module functions used to simulate private BcotPaymentTransaction object methods
//  NOTE: these functions need to be bound to a BcotPaymentTransaction object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//


// BcotPaymentTransaction function class (public) methods
//

// This method is to be used by Transaction Monitor to filter out transactions that are likely
//  to be a BCOT payment transaction
//
//  Arguments:
//   voutInfo: [Object(Map)] - Map object containing information about a transaction's outputs. This is obtained
//                              by calling the internal parseTxVouts method of the TransactionMonitor module
BcotPaymentTransaction.isValidTxVouts = function (voutInfo) {
    let result = false;

    for (let value of voutInfo.values()) {
        if (!value.isNullData && value.addrInfo.type === KeyStore.extKeyType.cln_bcot_pay_addr.name) {
            result = true;
            break;
        }
    }

    return result;
};

// Determines if transaction is a valid BCOT Payment transaction
//
//  Arguments:
//    omniTransact: [Object(OmniTransaction)] // Object of type OmniTransaction identifying the transaction to be checked
//
//  Return:
//    - If transaction is not valid: undefined
//    - If transaction is valid: Object of type BcotPaymentTransaction created from transaction
//
BcotPaymentTransaction.checkTransaction = function (omniTransact) {
    if ((omniTransact instanceof OmniTransaction) && omniTransact.omniTxType === OmniTransaction.omniTxType.simpleSend && omniTransact.propertyId === BcotToken.bcotOmniPropertyId) {
        // This is a simple send Omni transaction. Get reference (payee) address
        //  and make sure that it is a valid client BCOT token payment address
        const refAddrInfo = Catenis.keyStore.getAddressInfo(omniTransact.referenceAddress, true);

        if (refAddrInfo !== null && refAddrInfo.type === KeyStore.extKeyType.cln_bcot_pay_addr.name) {
            // This is a valid BCOT payment transaction.
            //  Returns new instance of the object
            return new BcotPaymentTransaction(
                CatenisNode.getCatenisNodeByIndex(refAddrInfo.pathParts.ctnNodeIndex).getClientByIndex(refAddrInfo.pathParts.clientIndex),
                omniTransact);
        }
    }
};


// BcotPaymentTransaction function class (public) properties
//


// Definition of module (private) functions
//


// Module code
//

// Lock function class
Object.freeze(BcotPaymentTransaction);
