/**
 * Created by claudio on 2018-10-25.
 */

//console.log('[BcotReplenishmentTransaction.js]: This code just ran.');

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
import { BcotToken } from './BcotToken';
import { OmniTransaction } from './OmniTransaction';

// Config entries
/*const config_entryConfig = config.get('config_entry');

// Configuration settings
const cfgSettings = {
    property: config_entryConfig.get('property_name')
};*/


// Definition of function classes
//

// BcotReplenishmentTransaction function class
//
//  Constructor arguments:
//   omniTransact: [Object(OmniTransact)] - Deserialized omni transaction
export function BcotReplenishmentTransaction(omniTransact) {
    this.omniTransact = omniTransact;

    //  NOTE: arrow functions should NOT be used for the getter/setter of the defined properties.
    //      This is to avoid that, if `this` is referred from within the getter/setter body, it
    //      refers to the object from where the properties have been defined rather than to the
    //      object from where the property is being accessed. Normally, this does not represent
    //      an issue (since the object from where the property is accessed is the same object
    //      from where the property has been defined), but it is especially dangerous if the
    //      object can be cloned.
    Object.defineProperties(this, {
        replenishedAmount: {
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
    })
}


// Public BcotReplenishmentTransaction object methods
//

/*BcotReplenishmentTransaction.prototype.pub_func = function () {
};*/


// Module functions used to simulate private BcotReplenishmentTransaction object methods
//  NOTE: these functions need to be bound to a BcotReplenishmentTransaction object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// BcotReplenishmentTransaction function class (public) methods
//

// This method is to be used by Transaction Monitor to filter out transactions that are likely
//  to be a BCOT replenishment transaction
//
//  Arguments:
//   voutInfo: [Object(Map)] - Map object containing information about a transaction's outputs. This is obtained
//                              by calling the internal parseTxVouts method of the TransactionMonitor module
BcotReplenishmentTransaction.isValidTxVouts = function (voutInfo) {
    let result = false;

    for (let value of voutInfo.values()) {
        if (!value.isNullData && value.addrInfo.type === KeyStore.extKeyType.sys_bcot_sale_stck_addr.name) {
            result = true;
            break;
        }
    }

    return result;
};

// Determines if transaction is a valid BCOT replenishment transaction
//
//  Arguments:
//    omniTransact: [Object(OmniTransaction)] // Object of type OmniTransaction identifying the transaction to be checked
//
//  Return:
//    - If transaction is not valid: undefined
//    - If transaction is valid: Object of type BcotReplenishmentTransaction created from transaction
//
BcotReplenishmentTransaction.checkTransaction = function (omniTransact) {
    if ((omniTransact instanceof OmniTransaction) && omniTransact.omniTxType === OmniTransaction.omniTxType.simpleSend && omniTransact.propertyId === BcotToken.bcotOmniPropertyId) {
        // This is a simple send Omni transaction. Get reference (payee) address
        //  and make sure that it is a valid system BCOT token sale stock address
        const refAddrInfo = Catenis.keyStore.getAddressInfo(omniTransact.referenceAddress, true);

        if (refAddrInfo !== null && refAddrInfo.type === KeyStore.extKeyType.sys_bcot_sale_stck_addr.name) {
            // This is a valid BCOT replenishment transaction.
            //  Returns new instance of the object
            return new BcotReplenishmentTransaction(omniTransact);
        }
    }
};


// BcotReplenishmentTransaction function class (public) properties
//

/*BcotReplenishmentTransaction.prop = {};*/


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(BcotReplenishmentTransaction);
