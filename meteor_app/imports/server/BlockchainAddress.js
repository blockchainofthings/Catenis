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
    BaseDeviceMigratedAssetAddress,
    BaseDeviceMainAddress,
    BaseDeviceAssetAddress,
    BaseDeviceAssetIssuanceAddress, BaseSystemOCMsgsSetlmtPayTxExpenseAddress
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

        const parentPath = KeyStore.systemDeviceMainAddressRootPath(ctnNodeIndex);

        this._getBaseInstance = () => BaseSystemDeviceMainAddress.getInstance(ctnNodeIndex, parentPath);

        // Reference base blockchain address object so existing addresses are immediately
        //  loaded onto local key storage
        // noinspection BadExpressionStatementJS
        this._baseAddr;
    }
}

// SystemFundingPaymentAddress derived class
export class SystemFundingPaymentAddress extends BlockchainAddress {
    constructor (ctnNodeIndex) {
        super();

        const parentPath = KeyStore.systemFundingPaymentRootPath(ctnNodeIndex);

        this._getBaseInstance = () => BaseSystemFundingPaymentAddress.getInstance(ctnNodeIndex, parentPath);

        // Reference base blockchain address object so existing addresses are immediately
        //  loaded onto local key storage
        // noinspection BadExpressionStatementJS
        this._baseAddr;
    }
}

// SystemFundingChangeAddress derived class
export class SystemFundingChangeAddress extends BlockchainAddress {
    constructor (ctnNodeIndex) {
        super();

        const parentPath = KeyStore.systemFundingChangeRootPath(ctnNodeIndex);

        this._getBaseInstance = () => BaseSystemFundingChangeAddress.getInstance(ctnNodeIndex, parentPath);

        // Reference base blockchain address object so existing addresses are immediately
        //  loaded onto local key storage
        // noinspection BadExpressionStatementJS
        this._baseAddr;
    }
}

// SystemPayTxExpenseAddress derived class
export class SystemPayTxExpenseAddress extends BlockchainAddress {
    constructor (ctnNodeIndex) {
        super();

        const parentPath = KeyStore.systemPayTxExpenseRootPath(ctnNodeIndex);

        this._getBaseInstance = () => BaseSystemPayTxExpenseAddress.getInstance(ctnNodeIndex, parentPath);

        // Reference base blockchain address object so existing addresses are immediately
        //  loaded onto local key storage
        // noinspection BadExpressionStatementJS
        this._baseAddr;
    }
}

// SystemReadConfirmSpendNotifyAddress derived class
export class SystemReadConfirmSpendNotifyAddress extends BlockchainAddress {
    constructor (ctnNodeIndex) {
        super();

        const parentPath = KeyStore.systemReadConfirmSpendNotifyRootPath(ctnNodeIndex);

        this._getBaseInstance = () => BaseSystemReadConfirmSpendNotifyAddress.getInstance(ctnNodeIndex, parentPath);

        // Reference base blockchain address object so existing addresses are immediately
        //  loaded onto local key storage
        // noinspection BadExpressionStatementJS
        this._baseAddr;
    }
}

// SystemReadConfirmSpendOnlyAddress derived class
export class SystemReadConfirmSpendOnlyAddress extends BlockchainAddress {
    constructor (ctnNodeIndex) {
        super();

        const parentPath = KeyStore.systemReadConfirmSpendOnlyRootPath(ctnNodeIndex);

        this._getBaseInstance = () => BaseSystemReadConfirmSpendOnlyAddress.getInstance(ctnNodeIndex, parentPath);

        // Reference base blockchain address object so existing addresses are immediately
        //  loaded onto local key storage
        // noinspection BadExpressionStatementJS
        this._baseAddr;
    }
}

// SystemReadConfirmSpendNullAddress derived class
export class SystemReadConfirmSpendNullAddress extends BlockchainAddress {
    constructor (ctnNodeIndex) {
        super();

        const parentPath = KeyStore.systemReadConfirmSpendNullRootPath(ctnNodeIndex);

        this._getBaseInstance = () => BaseSystemReadConfirmSpendNullAddress.getInstance(ctnNodeIndex, parentPath);

        // Reference base blockchain address object so existing addresses are immediately
        //  loaded onto local key storage
        // noinspection BadExpressionStatementJS
        this._baseAddr;
    }
}

// SystemReadConfirmPayTxExpenseAddress derived class
export class SystemReadConfirmPayTxExpenseAddress extends BlockchainAddress {
    constructor (ctnNodeIndex) {
        super();

        const parentPath = KeyStore.systemReadConfirmPayTxExpenseRootPath(ctnNodeIndex);

        this._getBaseInstance = () => BaseSystemReadConfirmPayTxExpenseAddress.getInstance(ctnNodeIndex, parentPath);

        // Reference base blockchain address object so existing addresses are immediately
        //  loaded onto local key storage
        // noinspection BadExpressionStatementJS
        this._baseAddr;
    }
}

// SystemServiceCreditIssuingAddress derived class
export class SystemServiceCreditIssuingAddress extends BlockchainAddress {
    constructor (ctnNodeIndex) {
        super();

        const parentPath = KeyStore.systemServiceCreditIssuingRootPath(ctnNodeIndex);

        this._getBaseInstance = () => BaseSystemServiceCreditIssuingAddress.getInstance(ctnNodeIndex, parentPath);

        // Reference base blockchain address object so existing addresses are immediately
        //  loaded onto local key storage
        // noinspection BadExpressionStatementJS
        this._baseAddr;
    }
}

// SystemServicePaymentPayTxExpenseAddress derived class
export class SystemServicePaymentPayTxExpenseAddress extends BlockchainAddress {
    constructor (ctnNodeIndex) {
        super();

        const parentPath = KeyStore.systemServicePaymentPayTxExpenseRootPath(ctnNodeIndex);

        this._getBaseInstance = () => BaseSystemServicePaymentPayTxExpenseAddress.getInstance(ctnNodeIndex, parentPath);

        // Reference base blockchain address object so existing addresses are immediately
        //  loaded onto local key storage
        // noinspection BadExpressionStatementJS
        this._baseAddr;
    }
}

// SystemMultiSigSigneeAddress derived class
export class SystemMultiSigSigneeAddress extends BlockchainAddress {
    constructor (ctnNodeIndex) {
        super();

        const parentPath = KeyStore.systemMultiSigSigneeRootPath(ctnNodeIndex);

        this._getBaseInstance = () => BaseSystemMultiSigSigneeAddress.getInstance(ctnNodeIndex, parentPath);

        // Reference base blockchain address object so existing addresses are immediately
        //  loaded onto local key storage
        // noinspection BadExpressionStatementJS
        this._baseAddr;
    }
}

// SystemBcotSaleStockAddress derived class
export class SystemBcotSaleStockAddress extends BlockchainAddress {
    constructor (ctnNodeIndex) {
        super();

        const parentPath = KeyStore.systemBcotSaleStockRootPath(ctnNodeIndex);

        this._getBaseInstance = () => BaseSystemBcotSaleStockAddress.getInstance(ctnNodeIndex, parentPath);

        // Reference base blockchain address object so existing addresses are immediately
        //  loaded onto local key storage
        // noinspection BadExpressionStatementJS
        this._baseAddr;
    }
}

// SystemOCMsgsSetlmtPayTxExpenseAddress derived class
export class SystemOCMsgsSetlmtPayTxExpenseAddress extends BlockchainAddress {
    constructor (ctnNodeIndex) {
        super();

        const parentPath = KeyStore.systemOCMsgsSetlmtPayTxExpenseRootPath(ctnNodeIndex);

        this._getBaseInstance = () => BaseSystemOCMsgsSetlmtPayTxExpenseAddress.getInstance(ctnNodeIndex, parentPath);

        // Reference base blockchain address object so existing addresses are immediately
        //  loaded onto local key storage
        // noinspection BadExpressionStatementJS
        this._baseAddr;
    }
}

// ClientServiceAccountCreditLineAddress derived class
export class ClientServiceAccountCreditLineAddress extends BlockchainAddress {
    constructor (ctnNodeIndex, clientIndex) {
        super();

        const parentPath = KeyStore.clientServiceAccountCreditLineAddressRootPath(ctnNodeIndex, clientIndex);

        this._getBaseInstance = () => BaseClientServiceAccountCreditLineAddress.getInstance(ctnNodeIndex, clientIndex, parentPath);

        // Reference base blockchain address object so existing addresses are immediately
        //  loaded onto local key storage
        // noinspection BadExpressionStatementJS
        this._baseAddr;
    }
}

// ClientServiceAccountDebitLineAddress derived class
export class ClientServiceAccountDebitLineAddress extends BlockchainAddress {
    constructor (ctnNodeIndex, clientIndex) {
        super();

        const parentPath = KeyStore.clientServiceAccountDebitLineAddressRootPath(ctnNodeIndex, clientIndex);

        this._getBaseInstance = () => BaseClientServiceAccountDebitLineAddress.getInstance(ctnNodeIndex, clientIndex, parentPath);

        // Reference base blockchain address object so existing addresses are immediately
        //  loaded onto local key storage
        // noinspection BadExpressionStatementJS
        this._baseAddr;
    }
}

// ClientBcotPaymentAddress derived class
export class ClientBcotPaymentAddress extends BlockchainAddress {
    constructor (ctnNodeIndex, clientIndex) {
        super();

        const parentPath = KeyStore.clientBcotPaymentAddressRootPath(ctnNodeIndex, clientIndex);

        this._getBaseInstance = () => BaseClientBcotPaymentAddress.getInstance(ctnNodeIndex, clientIndex, parentPath);

        // Reference base blockchain address object so existing addresses are immediately
        //  loaded onto local key storage
        // noinspection BadExpressionStatementJS
        this._baseAddr;
    }
}

// DeviceReadConfirmAddress derived class
export class DeviceReadConfirmAddress extends BlockchainAddress {
    constructor (ctnNodeIndex, clientIndex, deviceIndex) {
        super();

        const parentPath = KeyStore.deviceReadConfirmAddressRootPath(ctnNodeIndex, clientIndex, deviceIndex);

        this._getBaseInstance = () => BaseDeviceReadConfirmAddress.getInstance(ctnNodeIndex, clientIndex, deviceIndex, parentPath);

        // Reference base blockchain address object so existing addresses are immediately
        //  loaded onto local key storage
        // noinspection BadExpressionStatementJS
        this._baseAddr;
    }
}

// DeviceMigratedAssetAddress derived class
export class DeviceMigratedAssetAddress extends BlockchainAddress {
    constructor (ctnNodeIndex, clientIndex, deviceIndex) {
        super();

        const parentPath = KeyStore.deviceMigratedAssetAddressRootPath(ctnNodeIndex, clientIndex, deviceIndex);

        this._getBaseInstance = () => BaseDeviceMigratedAssetAddress.getInstance(ctnNodeIndex, clientIndex, deviceIndex, parentPath);

        // Reference base blockchain address object so existing addresses are immediately
        //  loaded onto local key storage
        // noinspection BadExpressionStatementJS
        this._baseAddr;
    }
}

// DeviceMainAddress derived class
export class DeviceMainAddress extends BlockchainAddress {
    constructor (ctnNodeIndex, clientIndex, deviceIndex) {
        super();

        const parentPath = KeyStore.deviceMainAddressRootPath(ctnNodeIndex, clientIndex, deviceIndex);

        this._getBaseInstance = () => BaseDeviceMainAddress.getInstance(ctnNodeIndex, clientIndex, deviceIndex, parentPath);

        // Reference base blockchain address object so existing addresses are immediately
        //  loaded onto local key storage
        // noinspection BadExpressionStatementJS
        this._baseAddr;
    }
}

// DeviceAssetAddress derived class
export class DeviceAssetAddress extends BlockchainAddress {
    constructor (ctnNodeIndex, clientIndex, deviceIndex) {
        super();

        const parentPath = KeyStore.deviceAssetAddressRootPath(ctnNodeIndex, clientIndex, deviceIndex);

        this._getBaseInstance = () => BaseDeviceAssetAddress.getInstance(ctnNodeIndex, clientIndex, deviceIndex, parentPath);

        // Reference base blockchain address object so existing addresses are immediately
        //  loaded onto local key storage
        // noinspection BadExpressionStatementJS
        this._baseAddr;
    }
}

// DeviceAssetIssuanceAddress derived class
export class DeviceAssetIssuanceAddress extends BlockchainAddress {
    constructor (ctnNodeIndex, clientIndex, deviceIndex) {
        super();

        const parentPath = KeyStore.deviceAssetIssuanceAddressRootPath(ctnNodeIndex, clientIndex, deviceIndex);

        this._getBaseInstance = () => BaseDeviceAssetIssuanceAddress.getInstance(ctnNodeIndex, clientIndex, deviceIndex, parentPath);

        // Reference base blockchain address object so existing addresses are immediately
        //  loaded onto local key storage
        // noinspection BadExpressionStatementJS
        this._baseAddr;
    }
}

// BlockchainAddress function class
function BlockchainAddress() {
    this._getBaseInstance = undefined;

    //  NOTE: arrow functions should NOT be used for the getter/setter of the defined properties.
    //      This is to avoid that, if `this` is referred from within the getter/setter body, it
    //      refers to the object from where the properties have been defined rather than to the
    //      object from where the property is being accessed. Normally, this does not represent
    //      an issue (since the object from where the property is accessed is the same object
    //      from where the property has been defined), but it is especially dangerous if the
    //      object can be cloned.
    Object.defineProperties(this, {
        _baseAddr: {
            get: function () {
                // noinspection JSPotentiallyInvalidUsageOfThis
                return this._getBaseInstance();
            },
            enumerable: false
        },
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
        btcAddressType: {
            get: function () {
                // noinspection JSPotentiallyInvalidUsageOfThis
                return this._baseAddr.btcAddressType;
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
Object.freeze(DeviceMigratedAssetAddress);
Object.freeze(DeviceMainAddress);
Object.freeze(DeviceAssetAddress);
Object.freeze(DeviceAssetIssuanceAddress);
