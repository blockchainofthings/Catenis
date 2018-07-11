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
// noinspection JSFileReferences
import BigNumber from 'bignumber.js';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { KeyStore } from './KeyStore';
import { OmniCore } from './OmniCore';
import { CatenisNode } from './CatenisNode';
import { BcotPayment } from './BcotPayment';


// Definition of function classes
//

// BcotPaymentTransaction function class
//
//  Constructor arguments:
//   client: [Object(Client)] - Client to which payment is being made
//   omniTxInfo: [Object] - Transaction info returned by omni_gettransaction Omni Core's RPC API method
export function BcotPaymentTransaction(client, omniTxInfo) {
    this.client = client;
    this.omniTxInfo = omniTxInfo;

    Object.defineProperties(this, {
        paidAmount: {
            get: function () {
                // noinspection JSPotentiallyInvalidUsageOfThis
                return new BigNumber(this.omniTxInfo.amount).times(100000000).toNumber();
            },
            enumerable: true
        },
        payeeAddress: {
            get: function () {
                // noinspection JSPotentiallyInvalidUsageOfThis
                return this.omniTxInfo.referenceaddress;
            },
            enumerable: true
        },
        payingAddress: {
            get: function () {
                // noinspection JSPotentiallyInvalidUsageOfThis
                return this.omniTxInfo.sendingaddress;
            },
            enumerable: true
        },
        txid: {
            get: function () {
                // noinspection JSPotentiallyInvalidUsageOfThis
                return this.omniTxInfo.txid;
            }
        }
    })
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
//    transact: [Object] // Object of type Transaction identifying the transaction to be checked
//
//  Return:
//    - If transaction is not valid: undefined
//    - If transaction is valid: Object of type BcotPaymentTransaction created from transaction
//
BcotPaymentTransaction.checkTransaction = function (txid) {
    // Try to get Omni transaction info
    let omniTxInfo;

    try {
        omniTxInfo = Catenis.omniCore.omniGetTransaction(txid, false);
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

    if (omniTxInfo !== undefined && omniTxInfo.type_int === 0 && omniTxInfo.propertyid === BcotPayment.bcotOmniPropertyId) {
        // This is a simple send Omni transaction. Get reference (payee) address
        //  and mke sure that it is a valid client BCOT token payment address
        const refAddrInfo = Catenis.keyStore.getAddressInfo(omniTxInfo.referenceaddress, true);

        if (refAddrInfo !== null && refAddrInfo.type === KeyStore.extKeyType.cln_bcot_pay_addr.name) {
            // This is a valid BCOT payment transaction.
            //  Returns of new instance of the object
            return new BcotPaymentTransaction(
                CatenisNode.getCatenisNodeByIndex(refAddrInfo.pathParts.ctnNodeIndex).getClientByIndex(refAddrInfo.pathParts.clientIndex),
                omniTxInfo);
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
