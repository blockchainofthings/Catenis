/**
 * Created by Claudio on 2016-06-08.
 */

//console.log('[BlockchainAddress.js]: This code just ran.');
    
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
//import { Catenis } from './Catenis';
import {
    BaseSystemDeviceMainAddress,
    BaseSystemFundingPaymentAddress,
    BaseSystemFundingChangeAddress,
    BaseSystemPayTxExpenseAddress,
    BaseSystemReadConfirmSpendNotifyAddress,
    BaseSystemReadConfirmSpendOnlyAddress,
    BaseSystemReadConfirmSpendNullAddress,
    BaseSystemReadConfirmPayTxExpenseAddress,
    BaseSystemServiceCreditIssuingAddress,
    BaseSystemServicePaymentPayTxExpenseAddress,
    BaseSystemMultiSigSigneeAddress,
    BaseSystemBcotSaleStockAddress,
    BaseClientServiceAccountCreditLineAddress,
    BaseClientServiceAccountDebitLineAddress,
    BaseClientBcotPaymentAddress,
    BaseDeviceReadConfirmAddress,
    BaseDeviceMainAddress,
    BaseDeviceAssetAddress,
    BaseDeviceAssetIssuanceAddress
} from './BaseBlockchainAddress';
import { KeyStore } from './KeyStore';

// Config entries
/*const config_entryConfig = config.get('config_entry');

// Configuration settings
const cfgSettings = {
    property: config_entryConfig.get('property_name')
};*/


// Definition of function classes
//

// SystemDeviceMainAddress derived class
export class SystemDeviceMainAddress extends BlockchainAddress {
    constructor (ctnNodeIndex) {
        super();

        // noinspection JSUnusedGlobalSymbols
        this._baseAddr = BaseSystemDeviceMainAddress.getInstance(ctnNodeIndex, KeyStore.systemDeviceMainAddressRootPath(ctnNodeIndex));
    }
}

// SystemFundingPaymentAddress derived class
export class SystemFundingPaymentAddress extends BlockchainAddress {
    constructor (ctnNodeIndex) {
        super();

        // noinspection JSUnusedGlobalSymbols
        this._baseAddr = BaseSystemFundingPaymentAddress.getInstance(ctnNodeIndex, KeyStore.systemFundingPaymentRootPath(ctnNodeIndex));
    }
}

// SystemFundingChangeAddress derived class
export class SystemFundingChangeAddress extends BlockchainAddress {
    constructor (ctnNodeIndex) {
        super();

        // noinspection JSUnusedGlobalSymbols
        this._baseAddr = BaseSystemFundingChangeAddress.getInstance(ctnNodeIndex, KeyStore.systemFundingChangeRootPath(ctnNodeIndex));
    }
}

// SystemPayTxExpenseAddress derived class
export class SystemPayTxExpenseAddress extends BlockchainAddress {
    constructor (ctnNodeIndex) {
        super();

        // noinspection JSUnusedGlobalSymbols
        this._baseAddr = BaseSystemPayTxExpenseAddress.getInstance(ctnNodeIndex, KeyStore.systemPayTxExpenseRootPath(ctnNodeIndex));
    }
}

// SystemReadConfirmSpendNotifyAddress derived class
export class SystemReadConfirmSpendNotifyAddress extends BlockchainAddress {
    constructor (ctnNodeIndex) {
        super();

        // noinspection JSUnusedGlobalSymbols
        this._baseAddr = BaseSystemReadConfirmSpendNotifyAddress.getInstance(ctnNodeIndex, KeyStore.systemReadConfirmSpendNotifyRootPath(ctnNodeIndex));
    }
}

// SystemReadConfirmSpendOnlyAddress derived class
export class SystemReadConfirmSpendOnlyAddress extends BlockchainAddress {
    constructor (ctnNodeIndex) {
        super();

        // noinspection JSUnusedGlobalSymbols
        this._baseAddr = BaseSystemReadConfirmSpendOnlyAddress.getInstance(ctnNodeIndex, KeyStore.systemReadConfirmSpendOnlyRootPath(ctnNodeIndex));
    }
}

// SystemReadConfirmSpendNullAddress derived class
export class SystemReadConfirmSpendNullAddress extends BlockchainAddress {
    constructor (ctnNodeIndex) {
        super();

        // noinspection JSUnusedGlobalSymbols
        this._baseAddr = BaseSystemReadConfirmSpendNullAddress.getInstance(ctnNodeIndex, KeyStore.systemReadConfirmSpendNullRootPath(ctnNodeIndex));
    }
}

// SystemReadConfirmPayTxExpenseAddress derived class
export class SystemReadConfirmPayTxExpenseAddress extends BlockchainAddress {
    constructor (ctnNodeIndex) {
        super();

        // noinspection JSUnusedGlobalSymbols
        this._baseAddr = BaseSystemReadConfirmPayTxExpenseAddress.getInstance(ctnNodeIndex, KeyStore.systemReadConfirmPayTxExpenseRootPath(ctnNodeIndex));
    }
}

// SystemServiceCreditIssuingAddress derived class
export class SystemServiceCreditIssuingAddress extends BlockchainAddress {
    constructor (ctnNodeIndex) {
        super();

        // noinspection JSUnusedGlobalSymbols
        this._baseAddr = BaseSystemServiceCreditIssuingAddress.getInstance(ctnNodeIndex, KeyStore.systemServiceCreditIssuingRootPath(ctnNodeIndex));
    }
}

// SystemServicePaymentPayTxExpenseAddress derived class
export class SystemServicePaymentPayTxExpenseAddress extends BlockchainAddress {
    constructor (ctnNodeIndex) {
        super();

        // noinspection JSUnusedGlobalSymbols
        this._baseAddr = BaseSystemServicePaymentPayTxExpenseAddress.getInstance(ctnNodeIndex, KeyStore.systemServicePaymentPayTxExpenseRootPath(ctnNodeIndex));
    }
}

// SystemMultiSigSigneeAddress derived class
export class SystemMultiSigSigneeAddress extends BlockchainAddress {
    constructor (ctnNodeIndex) {
        super();

        // noinspection JSUnusedGlobalSymbols
        this._baseAddr = BaseSystemMultiSigSigneeAddress.getInstance(ctnNodeIndex, KeyStore.systemMultiSigSigneeRootPath(ctnNodeIndex));
    }
}

// SystemBcotSaleStockAddress derived class
export class SystemBcotSaleStockAddress extends BlockchainAddress {
    constructor (ctnNodeIndex) {
        super();

        // noinspection JSUnusedGlobalSymbols
        this._baseAddr = BaseSystemBcotSaleStockAddress.getInstance(ctnNodeIndex, KeyStore.systemBcotSaleStockRootPath(ctnNodeIndex));
    }
}

// ClientServiceAccountCreditLineAddress derived class
export class ClientServiceAccountCreditLineAddress extends BlockchainAddress {
    constructor (ctnNodeIndex, clientIndex) {
        super();

        // noinspection JSUnusedGlobalSymbols
        this._baseAddr = BaseClientServiceAccountCreditLineAddress.getInstance(ctnNodeIndex, clientIndex, KeyStore.clientServiceAccountCreditLineAddressRootPath(ctnNodeIndex, clientIndex));
    }
}

// ClientServiceAccountDebitLineAddress derived class
export class ClientServiceAccountDebitLineAddress extends BlockchainAddress {
    constructor (ctnNodeIndex, clientIndex) {
        super();

        // noinspection JSUnusedGlobalSymbols
        this._baseAddr = BaseClientServiceAccountDebitLineAddress.getInstance(ctnNodeIndex, clientIndex, KeyStore.clientServiceAccountDebitLineAddressRootPath(ctnNodeIndex, clientIndex));
    }
}

// ClientBcotPaymentAddress derived class
export class ClientBcotPaymentAddress extends BlockchainAddress {
    constructor (ctnNodeIndex, clientIndex) {
        super();

        // noinspection JSUnusedGlobalSymbols
        this._baseAddr = BaseClientBcotPaymentAddress.getInstance(ctnNodeIndex, clientIndex, KeyStore.clientBcotPaymentAddressRootPath(ctnNodeIndex, clientIndex));
    }
}

// DeviceReadConfirmAddress derived class
export class DeviceReadConfirmAddress extends BlockchainAddress {
    constructor (ctnNodeIndex, clientIndex, deviceIndex) {
        super();

        // noinspection JSUnusedGlobalSymbols
        this._baseAddr = BaseDeviceReadConfirmAddress.getInstance(ctnNodeIndex, clientIndex, deviceIndex, KeyStore.deviceReadConfirmAddressRootPath(ctnNodeIndex, clientIndex, deviceIndex));
    }
}

// DeviceMainAddress derived class
export class DeviceMainAddress extends BlockchainAddress {
    constructor (ctnNodeIndex, clientIndex, deviceIndex) {
        super();

        // noinspection JSUnusedGlobalSymbols
        this._baseAddr = BaseDeviceMainAddress.getInstance(ctnNodeIndex, clientIndex, deviceIndex, KeyStore.deviceMainAddressRootPath(ctnNodeIndex, clientIndex, deviceIndex));
    }
}

// DeviceAssetAddress derived class
export class DeviceAssetAddress extends BlockchainAddress {
    constructor (ctnNodeIndex, clientIndex, deviceIndex) {
        super();

        // noinspection JSUnusedGlobalSymbols
        this._baseAddr = BaseDeviceAssetAddress.getInstance(ctnNodeIndex, clientIndex, deviceIndex, KeyStore.deviceAssetAddressRootPath(ctnNodeIndex, clientIndex, deviceIndex));
    }
}

// DeviceAssetIssuanceAddress derived class
export class DeviceAssetIssuanceAddress extends BlockchainAddress {
    constructor (ctnNodeIndex, clientIndex, deviceIndex) {
        super();

        // noinspection JSUnusedGlobalSymbols
        this._baseAddr = BaseDeviceAssetIssuanceAddress.getInstance(ctnNodeIndex, clientIndex, deviceIndex, KeyStore.deviceAssetIssuanceAddressRootPath(ctnNodeIndex, clientIndex, deviceIndex));
    }
}

// BlockchainAddress function class
function BlockchainAddress() {
    this._baseAddr = undefined;

    //  NOTE: arrow functions should NOT be used for the getter/setter of the defined properties.
    //      This is to avoid that, if `this` is referred from within the getter/setter body, it
    //      refers to the object from where the properties have been defined rather than to the
    //      object from where the property is being accessed. Normally, this does not represent
    //      an issue (since the object from where the property is accessed is the same object
    //      from where the property has been defined), but it is especially dangerous if the
    //      object can be cloned.
    Object.defineProperties(this, {
        type: {
            get: function () {
                // noinspection JSPotentiallyInvalidUsageOfThis
                return this._baseAddr.type;
            },
            enumerable: true
        },
        parentPath: {
            get: function () {
                // noinspection JSPotentiallyInvalidUsageOfThis
                return this._baseAddr.parentPath;
            },
            enumerable: true
        },
        addressValidity: {
            get: function () {
                // noinspection JSPotentiallyInvalidUsageOfThis
                return this._baseAddr.addressValidity;
            },
            enumerable: true
        },
        lastIssuedAddrIndex: {
            get: function () {
                // noinspection JSPotentiallyInvalidUsageOfThis
                return this._baseAddr.lastIssuedAddrIndex;
            },
            enumerable: true
        },
        lastInUseAddrIndex: {
            get: function () {
                // noinspection JSPotentiallyInvalidUsageOfThis
                return this._baseAddr.lastInUseAddrIndex;
            },
            enumerable: true
        },
        firstInUseAddrIndex: {
            get: function () {
                // noinspection JSPotentiallyInvalidUsageOfThis
                return this._baseAddr.firstInUseAddrIndex;
            },
            enumerable: true
        }
    });
}


// Public BlockchainAddress object methods
//

BlockchainAddress.prototype.newAddressKeys = function () {
    return this._baseAddr.newAddressKeys();
};

BlockchainAddress.prototype.listAddressesInUse = function () {
    return this._baseAddr.listAddressesInUse();
};

BlockchainAddress.prototype.lastAddressKeys = function () {
    return this._baseAddr.lastAddressKeys();
};


// Module functions used to simulate private BlockchainAddress object methods
//  NOTE: these functions need to be bound to a BlockchainAddress object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// BlockchainAddress function class (public) methods
//

/*BlockchainAddress.class_func = function () {
};*/


// BlockchainAddress function class (public) properties
//

/*BlockchainAddress.prop = {};*/


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function classes
Object.freeze(BlockchainAddress);
Object.freeze(SystemDeviceMainAddress);
Object.freeze(SystemFundingPaymentAddress);
Object.freeze(SystemFundingChangeAddress);
Object.freeze(SystemPayTxExpenseAddress);
Object.freeze(SystemReadConfirmSpendNotifyAddress);
Object.freeze(SystemReadConfirmSpendOnlyAddress);
Object.freeze(SystemReadConfirmSpendNullAddress);
Object.freeze(SystemReadConfirmPayTxExpenseAddress);
Object.freeze(SystemServiceCreditIssuingAddress);
Object.freeze(SystemServicePaymentPayTxExpenseAddress);
Object.freeze(SystemMultiSigSigneeAddress);
Object.freeze(ClientServiceAccountCreditLineAddress);
Object.freeze(ClientServiceAccountDebitLineAddress);
Object.freeze(ClientBcotPaymentAddress);
Object.freeze(DeviceReadConfirmAddress);
Object.freeze(DeviceMainAddress);
Object.freeze(DeviceAssetAddress);
Object.freeze(DeviceAssetIssuanceAddress);
