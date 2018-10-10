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

        this.baseClass = BaseSystemDeviceMainAddress;
        this.instanceArgs = [
            ctnNodeIndex,
            KeyStore.systemDeviceMainAddressRootPath(ctnNodeIndex)
        ];
    }
}

// SystemFundingPaymentAddress derived class
export class SystemFundingPaymentAddress extends BlockchainAddress {
    constructor (ctnNodeIndex) {
        super();

        this.baseClass = BaseSystemFundingPaymentAddress;
        this.instanceArgs = [
            ctnNodeIndex,
            KeyStore.systemFundingPaymentRootPath(ctnNodeIndex)
        ];
    }
}

// SystemFundingChangeAddress derived class
export class SystemFundingChangeAddress extends BlockchainAddress {
    constructor (ctnNodeIndex) {
        super();

        this.baseClass = BaseSystemFundingChangeAddress;
        this.instanceArgs = [
            ctnNodeIndex,
            KeyStore.systemFundingChangeRootPath(ctnNodeIndex)
        ];
    }
}

// SystemPayTxExpenseAddress derived class
export class SystemPayTxExpenseAddress extends BlockchainAddress {
    constructor (ctnNodeIndex) {
        super();

        this.baseClass = BaseSystemPayTxExpenseAddress;
        this.instanceArgs = [
            ctnNodeIndex,
            KeyStore.systemPayTxExpenseRootPath(ctnNodeIndex)
        ];
    }
}

// SystemReadConfirmSpendNotifyAddress derived class
export class SystemReadConfirmSpendNotifyAddress extends BlockchainAddress {
    constructor (ctnNodeIndex) {
        super();

        this.baseClass = BaseSystemReadConfirmSpendNotifyAddress;
        this.instanceArgs = [
            ctnNodeIndex,
            KeyStore.systemReadConfirmSpendNotifyRootPath(ctnNodeIndex)
        ];
    }
}

// SystemReadConfirmSpendOnlyAddress derived class
export class SystemReadConfirmSpendOnlyAddress extends BlockchainAddress {
    constructor (ctnNodeIndex) {
        super();

        this.baseClass = BaseSystemReadConfirmSpendOnlyAddress;
        this.instanceArgs = [
            ctnNodeIndex,
            KeyStore.systemReadConfirmSpendOnlyRootPath(ctnNodeIndex)
        ];
    }
}

// SystemReadConfirmSpendNullAddress derived class
export class SystemReadConfirmSpendNullAddress extends BlockchainAddress {
    constructor (ctnNodeIndex) {
        super();

        this.baseClass = BaseSystemReadConfirmSpendNullAddress;
        this.instanceArgs = [
            ctnNodeIndex,
            KeyStore.systemReadConfirmSpendNullRootPath(ctnNodeIndex)
        ];
    }
}

// SystemReadConfirmPayTxExpenseAddress derived class
export class SystemReadConfirmPayTxExpenseAddress extends BlockchainAddress {
    constructor (ctnNodeIndex) {
        super();

        this.baseClass = BaseSystemReadConfirmPayTxExpenseAddress;
        this.instanceArgs = [
            ctnNodeIndex,
            KeyStore.systemReadConfirmPayTxExpenseRootPath(ctnNodeIndex)
        ];
    }
}

// SystemServiceCreditIssuingAddress derived class
export class SystemServiceCreditIssuingAddress extends BlockchainAddress {
    constructor (ctnNodeIndex) {
        super();

        this.baseClass = BaseSystemServiceCreditIssuingAddress;
        this.instanceArgs = [
            ctnNodeIndex,
            KeyStore.systemServiceCreditIssuingRootPath(ctnNodeIndex)
        ];
    }
}

// SystemServicePaymentPayTxExpenseAddress derived class
export class SystemServicePaymentPayTxExpenseAddress extends BlockchainAddress {
    constructor (ctnNodeIndex) {
        super();

        this.baseClass = BaseSystemServicePaymentPayTxExpenseAddress;
        this.instanceArgs = [
            ctnNodeIndex,
            KeyStore.systemServicePaymentPayTxExpenseRootPath(ctnNodeIndex)
        ];
    }
}

// SystemMultiSigSigneeAddress derived class
export class SystemMultiSigSigneeAddress extends BlockchainAddress {
    constructor (ctnNodeIndex) {
        super();

        this.baseClass = BaseSystemMultiSigSigneeAddress;
        this.instanceArgs = [
            ctnNodeIndex,
            KeyStore.systemMultiSigSigneeRootPath(ctnNodeIndex)
        ];
    }
}

// ClientServiceAccountCreditLineAddress derived class
export class ClientServiceAccountCreditLineAddress extends BlockchainAddress {
    constructor (ctnNodeIndex, clientIndex) {
        super();

        this.baseClass = BaseClientServiceAccountCreditLineAddress;
        this.instanceArgs = [
            ctnNodeIndex,
            clientIndex,
            KeyStore.clientServiceAccountCreditLineAddressRootPath(ctnNodeIndex, clientIndex)
        ];
    }
}

// ClientServiceAccountDebitLineAddress derived class
export class ClientServiceAccountDebitLineAddress extends BlockchainAddress {
    constructor (ctnNodeIndex, clientIndex) {
        super();

        this.baseClass = BaseClientServiceAccountDebitLineAddress;
        this.instanceArgs = [
            ctnNodeIndex,
            clientIndex,
            KeyStore.clientServiceAccountDebitLineAddressRootPath(ctnNodeIndex, clientIndex)
        ];
    }
}

// ClientBcotPaymentAddress derived class
export class ClientBcotPaymentAddress extends BlockchainAddress {
    constructor (ctnNodeIndex, clientIndex) {
        super();

        this.baseClass = BaseClientBcotPaymentAddress;
        this.instanceArgs = [
            ctnNodeIndex,
            clientIndex,
            KeyStore.clientBcotPaymentAddressRootPath(ctnNodeIndex, clientIndex)
        ];
    }
}

// DeviceReadConfirmAddress derived class
export class DeviceReadConfirmAddress extends BlockchainAddress {
    constructor (ctnNodeIndex, clientIndex, deviceIndex) {
        super();

        this.baseClass = BaseDeviceReadConfirmAddress;
        this.instanceArgs = [
            ctnNodeIndex,
            clientIndex,
            deviceIndex,
            KeyStore.deviceReadConfirmAddressRootPath(ctnNodeIndex, clientIndex, deviceIndex)
        ];
    }
}

// DeviceMainAddress derived class
export class DeviceMainAddress extends BlockchainAddress {
    constructor (ctnNodeIndex, clientIndex, deviceIndex) {
        super();

        this.baseClass = BaseDeviceMainAddress;
        this.instanceArgs = [
            ctnNodeIndex,
            clientIndex,
            deviceIndex,
            KeyStore.deviceMainAddressRootPath(ctnNodeIndex, clientIndex, deviceIndex)
        ];
    }
}

// DeviceAssetAddress derived class
export class DeviceAssetAddress extends BlockchainAddress {
    constructor (ctnNodeIndex, clientIndex, deviceIndex) {
        super();

        this.baseClass = BaseDeviceAssetAddress;
        this.instanceArgs = [
            ctnNodeIndex,
            clientIndex,
            deviceIndex,
            KeyStore.deviceAssetAddressRootPath(ctnNodeIndex, clientIndex, deviceIndex)
        ];
    }
}

// DeviceAssetIssuanceAddress derived class
export class DeviceAssetIssuanceAddress extends BlockchainAddress {
    constructor (ctnNodeIndex, clientIndex, deviceIndex) {
        super();

        this.baseClass = BaseDeviceAssetIssuanceAddress;
        this.instanceArgs = [
            ctnNodeIndex,
            clientIndex,
            deviceIndex,
            KeyStore.deviceAssetIssuanceAddressRootPath(ctnNodeIndex, clientIndex, deviceIndex)
        ];
    }
}

// BlockchainAddress function class
function BlockchainAddress() {
    this.baseClass = undefined;
    this.instanceArgs = undefined;

    Object.defineProperties(this, {
        _baseAddr: {
            get: () => {
                return this.baseClass.getInstance.apply(undefined, this.instanceArgs);
            },
            enumerable: true
        },
        type: {
            get: () => {
                return this._baseAddr.type;
            },
            enumerable: true
        },
        parentPath: {
            get: () => {
                return this._baseAddr.parentPath;
            },
            enumerable: true
        },
        addressValidity: {
            get: () => {
                return this._baseAddr.addressValidity;
            },
            enumerable: true
        },
        lastIssuedAddrIndex: {
            get: () => {
                return this._baseAddr.lastIssuedAddrIndex;
            },
            enumerable: true
        },
        lastInUseAddrIndex: {
            get: () => {
                return this._baseAddr.lastInUseAddrIndex;
            },
            enumerable: true
        },
        firstInUseAddrIndex: {
            get: () => {
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
