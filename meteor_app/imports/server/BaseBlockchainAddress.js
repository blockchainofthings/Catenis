/**
 * Created by Claudio on 2018-10-08.
 */

//console.log('[BaseBlockchainAddress.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import util from 'util';
import crypto from 'crypto';
// Third-party node modules
import config from 'config';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { CriticalSection } from './CriticalSection';
import { KeyStore } from './KeyStore';
import { Util } from './Util';
import { BitcoinInfo } from './BitcoinInfo';

// Config entries
const configBaseBcAddress = config.get('baseBlockchainAddress'),
    configBaseBcAddrValidity = configBaseBcAddress.get('addressValidity');

// Configuration settings
const cfgSettings = {
    addressValidity: {
        systemDeviceMain: configBaseBcAddrValidity.get('systemDeviceMain'),
        systemFundingPayment: configBaseBcAddrValidity.get('systemFundingPayment'),
        systemFundingChange: configBaseBcAddrValidity.get('systemFundingChange'),
        systemPayTxExpense: configBaseBcAddrValidity.get('systemPayTxExpense'),
        systemReadConfSpendNotify: configBaseBcAddrValidity.get('systemReadConfSpendNotify'),
        systemReadConfSpendOnly: configBaseBcAddrValidity.get('systemReadConfSpendOnly'),
        systemReadConfSpendNull: configBaseBcAddrValidity.get('systemReadConfSpendNull'),
        systemReadConfPayTxExpense: configBaseBcAddrValidity.get('systemReadConfPayTxExpense'),
        systemServCredIssuing: configBaseBcAddrValidity.get('systemServCredIssuing'),
        systemServPymtPayTxExpense: configBaseBcAddrValidity.get('systemServPymtPayTxExpense'),
        systemMultiSigSignee: configBaseBcAddrValidity.get('systemMultiSigSignee'),
        systemBcotSaleStock: configBaseBcAddrValidity.get('systemBcotSaleStock'),
        systemOCMsgsSetlmtPayTxExpense: configBaseBcAddrValidity.get('systemOCMsgsSetlmtPayTxExpense'),
        deviceReadConfirm: configBaseBcAddrValidity.get('deviceReadConfirm'),
        deviceMigratedAsset: configBaseBcAddrValidity.get('deviceMigratedAsset'),
        clientServAccCreditLine: configBaseBcAddrValidity.get('clientServAccCreditLine'),
        clientServAccDebitLine: configBaseBcAddrValidity.get('clientServAccDebitLine'),
        clientBcotPayment: configBaseBcAddrValidity.get('clientBcotPayment'),
        deviceMain: configBaseBcAddrValidity.get('deviceMain'),
        deviceAsset: configBaseBcAddrValidity.get('deviceAsset'),
        deviceAssetIssuance: configBaseBcAddrValidity.get('deviceAssetIssuance')
    },
    updateIssuedAddressesInterval: configBaseBcAddress.get('updateIssuedAddressesInterval'),
    inactiveObjectTime: configBaseBcAddress.get('inactiveObjectTime'),
    deleteInactiveObjectsInterval: configBaseBcAddress.get('deleteInactiveObjectsInterval')
};

// Critical section object to avoid concurrent access to database
const dbCS = new CriticalSection();

let updtIssuedAddrsIntervalHandle,
    delInactiveObjectsIntervalHandle;


// Definition of function classes
//

// BaseSystemDeviceMainAddress derived class
export class BaseSystemDeviceMainAddress extends BaseBlockchainAddress {
    constructor (ctnNodeIndex) {
        super();
        this.type = KeyStore.extKeyType.sys_dev_main_addr.name;
        this.parentPath = KeyStore.systemDeviceMainAddressRootPath(ctnNodeIndex);
        // NOTE: `btcAddressType` defined as a getter property (see below)

        // Make sure that an object of this class has not been instantiated yet
        if (hasInstantiatedObject(this.parentPath)) {
            Catenis.logger.ERROR(util.format('BaseSystemDeviceMainAddress object for the given Catenis node index (%d) has already been instantiated', ctnNodeIndex));
            throw new Error(util.format('BaseSystemDeviceMainAddress object for the given Catenis node index (%d) has already been instantiated', ctnNodeIndex));
        }

        this.addressValidity = cfgSettings.addressValidity.systemDeviceMain;

        // Assign address manipulation functions
        this._getAddressKeys = Catenis.keyStore.getSystemDeviceMainAddressKeys.bind(Catenis.keyStore, ctnNodeIndex);
        this._listAddressesInUse = Catenis.keyStore.listSystemDeviceMainAddressesInUse.bind(Catenis.keyStore, ctnNodeIndex);

        // Initialize bounding indices
        setBoundingIndices.call(this);

        // Save this instance
        setInstantiatedObject(this.parentPath, this);
    }

    get btcAddressType() {
        return Catenis.application.legacyDustFunding ? BitcoinInfo.addressType.pubkeyhash : BitcoinInfo.addressType.witness_v0_keyhash;
    }

    // Get instance of this class
    //
    //  ctnNodeIndex: [integer]
    //                or
    //                {  // Options object
    //      ctnNodeIndex: [integer]
    //  }
    //
    static getInstance(ctnNodeIndex, parentPath) {
        if (typeof ctnNodeIndex === 'object') {
            // Options object passed instead of plain arguments
            ctnNodeIndex = ctnNodeIndex.ctnNodeIndex;
        }

        // Check if an instance of this class has already been instantiated
        parentPath = parentPath || KeyStore.systemDeviceMainAddressRootPath(ctnNodeIndex);

        return hasInstantiatedObject(parentPath) ? getInstantiatedObject(parentPath)
            : new BaseSystemDeviceMainAddress(ctnNodeIndex);
    }
}

// BaseSystemFundingPaymentAddress derived class
export class BaseSystemFundingPaymentAddress extends BaseBlockchainAddress {
    constructor (ctnNodeIndex) {
        super();
        this.type = KeyStore.extKeyType.sys_fund_pay_addr.name;
        this.parentPath = KeyStore.systemFundingPaymentRootPath(ctnNodeIndex);
        this.btcAddressType = BitcoinInfo.addressType.witness_v0_keyhash;

        // Make sure that an object of this class has not been instantiated yet
        if (hasInstantiatedObject(this.parentPath)) {
            Catenis.logger.ERROR(util.format('BaseSystemFundingPaymentAddress object for the given Catenis node index (%d) has already been instantiated', ctnNodeIndex));
            throw new Error(util.format('BaseSystemFundingPaymentAddress object for the given Catenis node index (%d) has already been instantiated', ctnNodeIndex));
        }

        this.addressValidity = cfgSettings.addressValidity.systemFundingPayment;

        // Assign address manipulation functions
        this._getAddressKeys = Catenis.keyStore.getSystemFundingPaymentAddressKeys.bind(Catenis.keyStore, ctnNodeIndex);
        this._listAddressesInUse = Catenis.keyStore.listSystemFundingPaymentAddressesInUse.bind(Catenis.keyStore, ctnNodeIndex);

        // Initialize bounding indices
        setBoundingIndices.call(this);

        // Save this instance
        setInstantiatedObject(this.parentPath, this);
    }

    // Get instance of this class
    //
    //  ctnNodeIndex: [integer]
    //                or
    //                {  // Options object
    //      ctnNodeIndex: [integer]
    //  }
    //
    static getInstance(ctnNodeIndex, parentPath) {
        if (typeof ctnNodeIndex === 'object') {
            // Options object passed instead of plain arguments
            ctnNodeIndex = ctnNodeIndex.ctnNodeIndex;
        }

        // Check if an instance of this class has already been instantiated
        parentPath = parentPath || KeyStore.systemFundingPaymentRootPath(ctnNodeIndex);

        return hasInstantiatedObject(parentPath) ? getInstantiatedObject(parentPath)
            : new BaseSystemFundingPaymentAddress(ctnNodeIndex);
    }
}

// BaseSystemFundingChangeAddress derived class
export class BaseSystemFundingChangeAddress extends BaseBlockchainAddress {
    constructor (ctnNodeIndex) {
        super();
        this.type = KeyStore.extKeyType.sys_fund_chg_addr.name;
        this.parentPath = KeyStore.systemFundingChangeRootPath(ctnNodeIndex);
        this.btcAddressType = BitcoinInfo.addressType.witness_v0_keyhash;

        // Make sure that an object of this class has not been instantiated yet
        if (hasInstantiatedObject(this.parentPath)) {
            Catenis.logger.ERROR(util.format('BaseSystemFundingChangeAddress object for the given Catenis node index (%d) has already been instantiated', ctnNodeIndex));
            throw new Error(util.format('BaseSystemFundingChangeAddress object for the given Catenis node index (%d) has already been instantiated', ctnNodeIndex));
        }

        this.addressValidity = cfgSettings.addressValidity.systemFundingChange;

        // Assign address manipulation functions
        this._getAddressKeys = Catenis.keyStore.getSystemFundingChangeAddressKeys.bind(Catenis.keyStore, ctnNodeIndex);
        this._listAddressesInUse = Catenis.keyStore.listSystemFundingChangeAddressesInUse.bind(Catenis.keyStore, ctnNodeIndex);

        // Initialize bounding indices
        setBoundingIndices.call(this);

        // Save this instance
        setInstantiatedObject(this.parentPath, this);
    }

    // Get instance of this class
    //
    //  ctnNodeIndex: [integer]
    //                or
    //                {  // Options object
    //      ctnNodeIndex: [integer]
    //  }
    //
    static getInstance(ctnNodeIndex, parentPath) {
        if (typeof ctnNodeIndex === 'object') {
            // Options object passed instead of plain arguments
            ctnNodeIndex = ctnNodeIndex.ctnNodeIndex;
        }

        // Check if an instance of this class has already been instantiated
        parentPath = parentPath || KeyStore.systemFundingChangeRootPath(ctnNodeIndex);

        return hasInstantiatedObject(parentPath) ? getInstantiatedObject(parentPath)
            : new BaseSystemFundingChangeAddress(ctnNodeIndex);
    }
}

// BaseSystemPayTxExpenseAddress derived class
export class BaseSystemPayTxExpenseAddress extends BaseBlockchainAddress {
    constructor (ctnNodeIndex) {
        super();
        this.type = KeyStore.extKeyType.sys_pay_tx_exp_addr.name;
        this.parentPath = KeyStore.systemPayTxExpenseRootPath(ctnNodeIndex);
        this.btcAddressType = BitcoinInfo.addressType.witness_v0_keyhash;

        // Make sure that an object of this class has not been instantiated yet
        if (hasInstantiatedObject(this.parentPath)) {
            Catenis.logger.ERROR(util.format('BaseSystemPayTxExpenseAddress object for the given Catenis node index (%d) has already been instantiated', ctnNodeIndex));
            throw new Error(util.format('BaseSystemPayTxExpenseAddress object for the given Catenis node index (%d) has already been instantiated', ctnNodeIndex));
        }

        this.addressValidity = cfgSettings.addressValidity.systemPayTxExpense;

        // Assign address manipulation functions
        this._getAddressKeys = Catenis.keyStore.getSystemPayTxExpenseAddressKeys.bind(Catenis.keyStore, ctnNodeIndex);
        this._listAddressesInUse = Catenis.keyStore.listSystemPayTxExpenseAddressesInUse.bind(Catenis.keyStore, ctnNodeIndex);

        // Initialize bounding indices
        setBoundingIndices.call(this);

        // Save this instance
        setInstantiatedObject(this.parentPath, this);
    }

    // Get instance of this class
    //
    //  ctnNodeIndex: [integer]
    //                or
    //                {  // Options object
    //      ctnNodeIndex: [integer]
    //  }
    //
    static getInstance(ctnNodeIndex, parentPath) {
        if (typeof ctnNodeIndex === 'object') {
            // Options object passed instead of plain arguments
            ctnNodeIndex = ctnNodeIndex.ctnNodeIndex;
        }

        // Check if an instance of this class has already been instantiated
        parentPath = parentPath || KeyStore.systemPayTxExpenseRootPath(ctnNodeIndex);

        return hasInstantiatedObject(parentPath) ? getInstantiatedObject(parentPath)
            : new BaseSystemPayTxExpenseAddress(ctnNodeIndex);
    }
}

// BaseSystemReadConfirmSpendNotifyAddress derived class
export class BaseSystemReadConfirmSpendNotifyAddress extends BaseBlockchainAddress {
    constructor (ctnNodeIndex) {
        super();
        this.type = KeyStore.extKeyType.sys_read_conf_spnd_ntfy_addr.name;
        this.parentPath = KeyStore.systemReadConfirmSpendNotifyRootPath(ctnNodeIndex);
        this.btcAddressType = BitcoinInfo.addressType.witness_v0_keyhash;

        // Make sure that an object of this class has not been instantiated yet
        if (hasInstantiatedObject(this.parentPath)) {
            Catenis.logger.ERROR(util.format('BaseSystemReadConfirmSpendNotifyAddress object for the given Catenis node index (%d) has already been instantiated', ctnNodeIndex));
            throw new Error(util.format('BaseSystemReadConfirmSpendNotifyAddress object for the given Catenis node index (%d) has already been instantiated', ctnNodeIndex));
        }

        this.addressValidity = cfgSettings.addressValidity.systemReadConfSpendNotify;

        // Assign address manipulation functions
        this._getAddressKeys = Catenis.keyStore.getSystemReadConfirmSpendNotifyAddressKeys.bind(Catenis.keyStore, ctnNodeIndex);
        this._listAddressesInUse = Catenis.keyStore.listSystemReadConfirmSpendNotifyAddressesInUse.bind(Catenis.keyStore, ctnNodeIndex);

        // Initialize bounding indices
        setBoundingIndices.call(this);

        // Save this instance
        setInstantiatedObject(this.parentPath, this);
    }

    // Get instance of this class
    //
    //  ctnNodeIndex: [integer]
    //                or
    //                {  // Options object
    //      ctnNodeIndex: [integer]
    //  }
    //
    static getInstance(ctnNodeIndex, parentPath) {
        if (typeof ctnNodeIndex === 'object') {
            // Options object passed instead of plain arguments
            ctnNodeIndex = ctnNodeIndex.ctnNodeIndex;
        }

        // Check if an instance of this class has already been instantiated
        parentPath = parentPath || KeyStore.systemReadConfirmSpendNotifyRootPath(ctnNodeIndex);

        return hasInstantiatedObject(parentPath) ? getInstantiatedObject(parentPath)
            : new BaseSystemReadConfirmSpendNotifyAddress(ctnNodeIndex);
    }
}

// BaseSystemReadConfirmSpendOnlyAddress derived class
export class BaseSystemReadConfirmSpendOnlyAddress extends BaseBlockchainAddress {
    constructor (ctnNodeIndex) {
        super();
        this.type = KeyStore.extKeyType.sys_read_conf_spnd_only_addr.name;
        this.parentPath = KeyStore.systemReadConfirmSpendOnlyRootPath(ctnNodeIndex);
        this.btcAddressType = BitcoinInfo.addressType.witness_v0_keyhash;

        // Make sure that an object of this class has not been instantiated yet
        if (hasInstantiatedObject(this.parentPath)) {
            Catenis.logger.ERROR(util.format('BaseSystemReadConfirmSpendOnlyAddress object for the given Catenis node index (%d) has already been instantiated', ctnNodeIndex));
            throw new Error(util.format('BaseSystemReadConfirmSpendOnlyAddress object for the given Catenis node index (%d) has already been instantiated', ctnNodeIndex));
        }

        this.addressValidity = cfgSettings.addressValidity.systemReadConfSpendOnly;

        // Assign address manipulation functions
        this._getAddressKeys = Catenis.keyStore.getSystemReadConfirmSpendOnlyAddressKeys.bind(Catenis.keyStore, ctnNodeIndex);
        this._listAddressesInUse = Catenis.keyStore.listSystemReadConfirmSpendOnlyAddressesInUse.bind(Catenis.keyStore, ctnNodeIndex);

        // Initialize bounding indices
        setBoundingIndices.call(this);

        // Save this instance
        setInstantiatedObject(this.parentPath, this);
    }

    // Get instance of this class
    //
    //  ctnNodeIndex: [integer]
    //                or
    //                {  // Options object
    //      ctnNodeIndex: [integer]
    //  }
    //
    static getInstance(ctnNodeIndex, parentPath) {
        if (typeof ctnNodeIndex === 'object') {
            // Options object passed instead of plain arguments
            ctnNodeIndex = ctnNodeIndex.ctnNodeIndex;
        }

        // Check if an instance of this class has already been instantiated
        parentPath = parentPath || KeyStore.systemReadConfirmSpendOnlyRootPath(ctnNodeIndex);

        return hasInstantiatedObject(parentPath) ? getInstantiatedObject(parentPath)
            : new BaseSystemReadConfirmSpendOnlyAddress(ctnNodeIndex);
    }
}

// BaseSystemReadConfirmSpendNullAddress derived class
export class BaseSystemReadConfirmSpendNullAddress extends BaseBlockchainAddress {
    constructor (ctnNodeIndex) {
        super();
        this.type = KeyStore.extKeyType.sys_read_conf_spnd_null_addr.name;
        this.parentPath = KeyStore.systemReadConfirmSpendNullRootPath(ctnNodeIndex);
        this.btcAddressType = BitcoinInfo.addressType.witness_v0_keyhash;

        // Make sure that an object of this class has not been instantiated yet
        if (hasInstantiatedObject(this.parentPath)) {
            Catenis.logger.ERROR(util.format('BaseSystemReadConfirmSpendNullAddress object for the given Catenis node index (%d) has already been instantiated', ctnNodeIndex));
            throw new Error(util.format('BaseSystemReadConfirmSpendNullAddress object for the given Catenis node index (%d) has already been instantiated', ctnNodeIndex));
        }

        this.addressValidity = cfgSettings.addressValidity.systemReadConfSpendNull;

        // Assign address manipulation functions
        this._getAddressKeys = Catenis.keyStore.getSystemReadConfirmSpendNullAddressKeys.bind(Catenis.keyStore, ctnNodeIndex);
        this._listAddressesInUse = Catenis.keyStore.listSystemReadConfirmSpendNullAddressesInUse.bind(Catenis.keyStore, ctnNodeIndex);

        // Initialize bounding indices
        setBoundingIndices.call(this);

        // Save this instance
        setInstantiatedObject(this.parentPath, this);
    }

    // Get instance of this class
    //
    //  ctnNodeIndex: [integer]
    //                or
    //                {  // Options object
    //      ctnNodeIndex: [integer]
    //  }
    //
    static getInstance(ctnNodeIndex, parentPath) {
        if (typeof ctnNodeIndex === 'object') {
            // Options object passed instead of plain arguments
            ctnNodeIndex = ctnNodeIndex.ctnNodeIndex;
        }

        // Check if an instance of this class has already been instantiated
        parentPath = parentPath || KeyStore.systemReadConfirmSpendNullRootPath(ctnNodeIndex);

        return hasInstantiatedObject(parentPath) ? getInstantiatedObject(parentPath)
            : new BaseSystemReadConfirmSpendNullAddress(ctnNodeIndex);
    }
}

// BaseSystemReadConfirmPayTxExpenseAddress derived class
export class BaseSystemReadConfirmPayTxExpenseAddress extends BaseBlockchainAddress {
    constructor (ctnNodeIndex) {
        super();
        this.type = KeyStore.extKeyType.sys_read_conf_pay_tx_exp_addr.name;
        this.parentPath = KeyStore.systemReadConfirmPayTxExpenseRootPath(ctnNodeIndex);
        this.btcAddressType = BitcoinInfo.addressType.witness_v0_keyhash;

        // Make sure that an object of this class has not been instantiated yet
        if (hasInstantiatedObject(this.parentPath)) {
            Catenis.logger.ERROR(util.format('BaseSystemReadConfirmPayTxExpenseAddress object for the given Catenis node index (%d) has already been instantiated', ctnNodeIndex));
            throw new Error(util.format('BaseSystemReadConfirmPayTxExpenseAddress object for the given Catenis node index (%d) has already been instantiated', ctnNodeIndex));
        }

        this.addressValidity = cfgSettings.addressValidity.systemReadConfPayTxExpense;

        // Assign address manipulation functions
        this._getAddressKeys = Catenis.keyStore.getSystemReadConfirmPayTxExpenseAddressKeys.bind(Catenis.keyStore, ctnNodeIndex);
        this._listAddressesInUse = Catenis.keyStore.listSystemReadConfirmPayTxExpenseAddressesInUse.bind(Catenis.keyStore, ctnNodeIndex);

        // Initialize bounding indices
        setBoundingIndices.call(this);

        // Save this instance
        setInstantiatedObject(this.parentPath, this);
    }

    // Get instance of this class
    //
    //  ctnNodeIndex: [integer]
    //                or
    //                {  // Options object
    //      ctnNodeIndex: [integer]
    //  }
    //
    static getInstance(ctnNodeIndex, parentPath) {
        if (typeof ctnNodeIndex === 'object') {
            // Options object passed instead of plain arguments
            ctnNodeIndex = ctnNodeIndex.ctnNodeIndex;
        }

        // Check if an instance of this class has already been instantiated
        parentPath = parentPath || KeyStore.systemReadConfirmPayTxExpenseRootPath(ctnNodeIndex);

        return hasInstantiatedObject(parentPath) ? getInstantiatedObject(parentPath)
            : new BaseSystemReadConfirmPayTxExpenseAddress(ctnNodeIndex);
    }
}

// BaseSystemServiceCreditIssuingAddress derived class
export class BaseSystemServiceCreditIssuingAddress extends BaseBlockchainAddress {
    constructor (ctnNodeIndex) {
        super();
        this.type = KeyStore.extKeyType.sys_serv_cred_issu_addr.name;
        this.parentPath = KeyStore.systemServiceCreditIssuingRootPath(ctnNodeIndex);
        this.btcAddressType = BitcoinInfo.addressType.witness_v0_keyhash;

        // Make sure that an object of this class has not been instantiated yet
        if (hasInstantiatedObject(this.parentPath)) {
            Catenis.logger.ERROR(util.format('BaseSystemServiceCreditIssuingAddress object for the given Catenis node index (%d) has already been instantiated', ctnNodeIndex));
            throw new Error(util.format('BaseSystemServiceCreditIssuingAddress object for the given Catenis node index (%d) has already been instantiated', ctnNodeIndex));
        }

        this.addressValidity = cfgSettings.addressValidity.systemServCredIssuing;

        // Assign address manipulation functions
        this._getAddressKeys = Catenis.keyStore.getSystemServiceCreditIssuingAddressKeys.bind(Catenis.keyStore, ctnNodeIndex);
        this._listAddressesInUse = Catenis.keyStore.listSystemServiceCreditIssuingAddressesInUse.bind(Catenis.keyStore, ctnNodeIndex);

        // Initialize bounding indices
        setBoundingIndices.call(this);

        // Save this instance
        setInstantiatedObject(this.parentPath, this);
    }

    // Get instance of this class
    //
    //  ctnNodeIndex: [integer]
    //                or
    //                {  // Options object
    //      ctnNodeIndex: [integer]
    //  }
    //
    static getInstance(ctnNodeIndex, parentPath) {
        if (typeof ctnNodeIndex === 'object') {
            // Options object passed instead of plain arguments
            ctnNodeIndex = ctnNodeIndex.ctnNodeIndex;
        }

        // Check if an instance of this class has already been instantiated
        parentPath = parentPath || KeyStore.systemServiceCreditIssuingRootPath(ctnNodeIndex);

        return hasInstantiatedObject(parentPath) ? getInstantiatedObject(parentPath)
            : new BaseSystemServiceCreditIssuingAddress(ctnNodeIndex);
    }
}

// BaseSystemServicePaymentPayTxExpenseAddress derived class
export class BaseSystemServicePaymentPayTxExpenseAddress extends BaseBlockchainAddress {
    constructor (ctnNodeIndex) {
        super();
        this.type = KeyStore.extKeyType.sys_serv_pymt_pay_tx_exp_addr.name;
        this.parentPath = KeyStore.systemServicePaymentPayTxExpenseRootPath(ctnNodeIndex);
        this.btcAddressType = BitcoinInfo.addressType.witness_v0_keyhash;

        // Make sure that an object of this class has not been instantiated yet
        if (hasInstantiatedObject(this.parentPath)) {
            Catenis.logger.ERROR(util.format('BaseSystemServicePaymentPayTxExpenseAddress object for the given Catenis node index (%d) has already been instantiated', ctnNodeIndex));
            throw new Error(util.format('BaseSystemServicePaymentPayTxExpenseAddress object for the given Catenis node index (%d) has already been instantiated', ctnNodeIndex));
        }

        this.addressValidity = cfgSettings.addressValidity.systemServPymtPayTxExpense;

        // Assign address manipulation functions
        this._getAddressKeys = Catenis.keyStore.getSystemServicePaymentPayTxExpenseAddressKeys.bind(Catenis.keyStore, ctnNodeIndex);
        this._listAddressesInUse = Catenis.keyStore.listSystemServicePaymentPayTxExpenseAddressesInUse.bind(Catenis.keyStore, ctnNodeIndex);

        // Initialize bounding indices
        setBoundingIndices.call(this);

        // Save this instance
        setInstantiatedObject(this.parentPath, this);
    }

    // Get instance of this class
    //
    //  ctnNodeIndex: [integer]
    //                or
    //                {  // Options object
    //      ctnNodeIndex: [integer]
    //  }
    //
    static getInstance(ctnNodeIndex, parentPath) {
        if (typeof ctnNodeIndex === 'object') {
            // Options object passed instead of plain arguments
            ctnNodeIndex = ctnNodeIndex.ctnNodeIndex;
        }

        // Check if an instance of this class has already been instantiated
        parentPath = parentPath || KeyStore.systemServicePaymentPayTxExpenseRootPath(ctnNodeIndex);

        return hasInstantiatedObject(parentPath) ? getInstantiatedObject(parentPath)
            : new BaseSystemServicePaymentPayTxExpenseAddress(ctnNodeIndex);
    }
}

// BaseSystemMultiSigSigneeAddress derived class
export class BaseSystemMultiSigSigneeAddress extends BaseBlockchainAddress {
    constructor (ctnNodeIndex) {
        super();
        this.type = KeyStore.extKeyType.sys_msig_sign_addr.name;
        this.parentPath = KeyStore.systemMultiSigSigneeRootPath(ctnNodeIndex);
        this.btcAddressType = BitcoinInfo.addressType.pubkeyhash;

        // Make sure that an object of this class has not been instantiated yet
        if (hasInstantiatedObject(this.parentPath)) {
            Catenis.logger.ERROR(util.format('BaseSystemMultiSigSigneeAddress object for the given Catenis node index (%d) has already been instantiated', ctnNodeIndex));
            throw new Error(util.format('BaseSystemMultiSigSigneeAddress object for the given Catenis node index (%d) has already been instantiated', ctnNodeIndex));
        }

        this.addressValidity = cfgSettings.addressValidity.systemMultiSigSignee;

        // Assign address manipulation functions
        this._getAddressKeys = Catenis.keyStore.getSystemMultiSigSigneeAddressKeys.bind(Catenis.keyStore, ctnNodeIndex);
        this._listAddressesInUse = Catenis.keyStore.listSystemMultiSigSigneeAddressesInUse.bind(Catenis.keyStore, ctnNodeIndex);

        // Initialize bounding indices
        setBoundingIndices.call(this);

        // Save this instance
        setInstantiatedObject(this.parentPath, this);
    }

    // Get instance of this class
    //
    //  ctnNodeIndex: [integer]
    //                or
    //                {  // Options object
    //      ctnNodeIndex: [integer]
    //  }
    //
    static getInstance(ctnNodeIndex, parentPath) {
        if (typeof ctnNodeIndex === 'object') {
            // Options object passed instead of plain arguments
            ctnNodeIndex = ctnNodeIndex.ctnNodeIndex;
        }

        // Check if an instance of this class has already been instantiated
        parentPath = parentPath || KeyStore.systemMultiSigSigneeRootPath(ctnNodeIndex);

        return hasInstantiatedObject(parentPath) ? getInstantiatedObject(parentPath)
            : new BaseSystemMultiSigSigneeAddress(ctnNodeIndex);
    }
}

// BaseSystemBcotSaleStockAddress derived class
export class BaseSystemBcotSaleStockAddress extends BaseBlockchainAddress {
    constructor (ctnNodeIndex) {
        super();
        this.type = KeyStore.extKeyType.sys_bcot_sale_stck_addr.name;
        this.parentPath = KeyStore.systemBcotSaleStockRootPath(ctnNodeIndex);
        this.btcAddressType = BitcoinInfo.addressType.pubkeyhash;

        // Make sure that an object of this class has not been instantiated yet
        if (hasInstantiatedObject(this.parentPath)) {
            Catenis.logger.ERROR(util.format('BaseSystemBcotSaleStockAddress object for the given Catenis node index (%d) has already been instantiated', ctnNodeIndex));
            throw new Error(util.format('BaseSystemBcotSaleStockAddress object for the given Catenis node index (%d) has already been instantiated', ctnNodeIndex));
        }

        this.addressValidity = cfgSettings.addressValidity.systemBcotSaleStock;

        // Assign address manipulation functions
        this._getAddressKeys = Catenis.keyStore.getSystemBcotSaleStockAddressKeys.bind(Catenis.keyStore, ctnNodeIndex);
        this._listAddressesInUse = Catenis.keyStore.listSystemBcotSaleStockAddressesInUse.bind(Catenis.keyStore, ctnNodeIndex);

        // Initialize bounding indices
        setBoundingIndices.call(this);

        // Save this instance
        setInstantiatedObject(this.parentPath, this);
    }

    newAddressKeys() {
        const addrKeys = Object.getPrototypeOf(BaseSystemBcotSaleStockAddress.prototype).newAddressKeys.call(this);

        if (addrKeys !== null) {
            // Import address public key onto Omni Core
            Catenis.omniCore.importPublicKey(addrKeys.exportPublicKey());
        }

        return addrKeys;
    }

    // Get instance of this class
    //
    //  ctnNodeIndex: [integer]
    //                or
    //                {  // Options object
    //      ctnNodeIndex: [integer]
    //  }
    //
    static getInstance(ctnNodeIndex, parentPath) {
        if (typeof ctnNodeIndex === 'object') {
            // Options object passed instead of plain arguments
            ctnNodeIndex = ctnNodeIndex.ctnNodeIndex;
        }

        // Check if an instance of this class has already been instantiated
        parentPath = parentPath || KeyStore.systemBcotSaleStockRootPath(ctnNodeIndex);

        return hasInstantiatedObject(parentPath) ? getInstantiatedObject(parentPath)
            : new BaseSystemBcotSaleStockAddress(ctnNodeIndex);
    }
}

// BaseSystemOCMsgsSetlmtPayTxExpenseAddress derived class
export class BaseSystemOCMsgsSetlmtPayTxExpenseAddress extends BaseBlockchainAddress {
    constructor (ctnNodeIndex) {
        super();
        this.type = KeyStore.extKeyType.sys_oc_msgs_setlmt_pay_tx_exp_addr.name;
        this.parentPath = KeyStore.systemOCMsgsSetlmtPayTxExpenseRootPath(ctnNodeIndex);
        this.btcAddressType = BitcoinInfo.addressType.witness_v0_keyhash;

        // Make sure that an object of this class has not been instantiated yet
        if (hasInstantiatedObject(this.parentPath)) {
            Catenis.logger.ERROR(util.format('BaseSystemOCMsgsSetlmtPayTxExpenseAddress object for the given Catenis node index (%d) has already been instantiated', ctnNodeIndex));
            throw new Error(util.format('BaseSystemOCMsgsSetlmtPayTxExpenseAddress object for the given Catenis node index (%d) has already been instantiated', ctnNodeIndex));
        }

        this.addressValidity = cfgSettings.addressValidity.systemOCMsgsSetlmtPayTxExpense;

        // Assign address manipulation functions
        this._getAddressKeys = Catenis.keyStore.getSystemOCMsgsSettlementPayTxExpenseAddressKeys.bind(Catenis.keyStore, ctnNodeIndex);
        this._listAddressesInUse = Catenis.keyStore.listSystemOCMsgsSettlementPayTxExpenseAddressesInUse.bind(Catenis.keyStore, ctnNodeIndex);

        // Initialize bounding indices
        setBoundingIndices.call(this);

        // Save this instance
        setInstantiatedObject(this.parentPath, this);
    }

    // Get instance of this class
    //
    //  ctnNodeIndex: [integer]
    //                or
    //                {  // Options object
    //      ctnNodeIndex: [integer]
    //  }
    //
    static getInstance(ctnNodeIndex, parentPath) {
        if (typeof ctnNodeIndex === 'object') {
            // Options object passed instead of plain arguments
            ctnNodeIndex = ctnNodeIndex.ctnNodeIndex;
        }

        // Check if an instance of this class has already been instantiated
        parentPath = parentPath || KeyStore.systemOCMsgsSetlmtPayTxExpenseRootPath(ctnNodeIndex);

        return hasInstantiatedObject(parentPath) ? getInstantiatedObject(parentPath)
            : new BaseSystemOCMsgsSetlmtPayTxExpenseAddress(ctnNodeIndex);
    }
}

// BaseClientServiceAccountCreditLineAddress derived class
export class BaseClientServiceAccountCreditLineAddress extends BaseBlockchainAddress {
    constructor (ctnNodeIndex, clientIndex) {
        super();
        this.type = KeyStore.extKeyType.cln_srv_acc_cred_ln_addr.name;
        this.parentPath = KeyStore.clientServiceAccountCreditLineAddressRootPath(ctnNodeIndex, clientIndex);
        this.btcAddressType = BitcoinInfo.addressType.witness_v0_keyhash;

        // Make sure that an object of this class has not been instantiated yet
        if (hasInstantiatedObject(this.parentPath)) {
            Catenis.logger.ERROR(util.format('BaseClientServiceAccountCreditLineAddress object for the given Catenis node and client indices (%d and %d, respectively) has already been instantiated', ctnNodeIndex, clientIndex));
            throw new Error(util.format('BaseClientServiceAccountCreditLineAddress object for the given Catenis node and client indices (%d and %d, respectively) has already been instantiated', ctnNodeIndex, clientIndex));
        }

        this.addressValidity = cfgSettings.addressValidity.clientServAccCreditLine;

        // Assign address manipulation functions
        this._getAddressKeys = Catenis.keyStore.getClientServiceAccountCreditLineAddressKeys.bind(Catenis.keyStore, ctnNodeIndex, clientIndex);
        this._listAddressesInUse = Catenis.keyStore.listClientServiceAccountCreditLineAddressesInUse.bind(Catenis.keyStore, ctnNodeIndex, clientIndex);

        // Initialize bounding indices
        setBoundingIndices.call(this);

        // Save this instance
        setInstantiatedObject(this.parentPath, this);
    }

    // Get instance of this class
    //
    //  ctnNodeIndex: [integer]
    //                or
    //                {  // Options object
    //      ctnNodeIndex: [integer],
    //      clientIndex: [integer]
    //  },
    //  clientIndex: [integer]
    //
    static getInstance(ctnNodeIndex, clientIndex, parentPath) {
        if (typeof ctnNodeIndex === 'object') {
            // Options object passed instead of plain arguments
            clientIndex = ctnNodeIndex.clientIndex;
            ctnNodeIndex = ctnNodeIndex.ctnNodeIndex;
        }

        // Check if an instance of this class has already been instantiated
        parentPath = parentPath || KeyStore.clientServiceAccountCreditLineAddressRootPath(ctnNodeIndex, clientIndex);

        return hasInstantiatedObject(parentPath) ? getInstantiatedObject(parentPath)
            : new BaseClientServiceAccountCreditLineAddress(ctnNodeIndex, clientIndex);
    }
}

// BaseClientServiceAccountDebitLineAddress derived class
export class BaseClientServiceAccountDebitLineAddress extends BaseBlockchainAddress {
    constructor (ctnNodeIndex, clientIndex) {
        super();
        this.type = KeyStore.extKeyType.cln_srv_acc_debt_ln_addr.name;
        this.parentPath = KeyStore.clientServiceAccountDebitLineAddressRootPath(ctnNodeIndex, clientIndex);
        this.btcAddressType = BitcoinInfo.addressType.witness_v0_keyhash;

        // Make sure that an object of this class has not been instantiated yet
        if (hasInstantiatedObject(this.parentPath)) {
            Catenis.logger.ERROR(util.format('BaseClientServiceAccountDebitLineAddress object for the given Catenis node and client indices (%d and %d, respectively) has already been instantiated', ctnNodeIndex, clientIndex));
            throw new Error(util.format('BaseClientServiceAccountDebitLineAddress object for the given Catenis node and client indices (%d and %d, respectively) has already been instantiated', ctnNodeIndex, clientIndex));
        }

        this.addressValidity = cfgSettings.addressValidity.clientServAccDebitLine;

        // Assign address manipulation functions
        this._getAddressKeys = Catenis.keyStore.getClientServiceAccountDebitLineAddressKeys.bind(Catenis.keyStore, ctnNodeIndex, clientIndex);
        this._listAddressesInUse = Catenis.keyStore.listClientServiceAccountDebitLineAddressesInUse.bind(Catenis.keyStore, ctnNodeIndex, clientIndex);

        // Initialize bounding indices
        setBoundingIndices.call(this);

        // Save this instance
        setInstantiatedObject(this.parentPath, this);
    }

    // Get instance of this class
    //
    //  ctnNodeIndex: [integer]
    //                or
    //                {  // Options object
    //      ctnNodeIndex: [integer],
    //      clientIndex: [integer]
    //  },
    //  clientIndex: [integer]
    //
    static getInstance(ctnNodeIndex, clientIndex, parentPath) {
        if (typeof ctnNodeIndex === 'object') {
            // Options object passed instead of plain arguments
            clientIndex = ctnNodeIndex.clientIndex;
            ctnNodeIndex = ctnNodeIndex.ctnNodeIndex;
        }

        // Check if an instance of this class has already been instantiated
        parentPath = parentPath || KeyStore.clientServiceAccountDebitLineAddressRootPath(ctnNodeIndex, clientIndex);

        return hasInstantiatedObject(parentPath) ? getInstantiatedObject(parentPath)
            : new BaseClientServiceAccountDebitLineAddress(ctnNodeIndex, clientIndex);
    }
}

// BaseClientBcotPaymentAddress derived class
export class BaseClientBcotPaymentAddress extends BaseBlockchainAddress {
    constructor (ctnNodeIndex, clientIndex) {
        super();
        this.type = KeyStore.extKeyType.cln_bcot_pay_addr.name;
        this.parentPath = KeyStore.clientBcotPaymentAddressRootPath(ctnNodeIndex, clientIndex);
        this.btcAddressType = BitcoinInfo.addressType.pubkeyhash;

        // Make sure that an object of this class has not been instantiated yet
        if (hasInstantiatedObject(this.parentPath)) {
            Catenis.logger.ERROR(util.format('BaseClientBcotPaymentAddress object for the given Catenis node and client indices (%d and %d, respectively) has already been instantiated', ctnNodeIndex, clientIndex));
            throw new Error(util.format('BaseClientBcotPaymentAddress object for the given Catenis node and client indices (%d and %d, respectively) has already been instantiated', ctnNodeIndex, clientIndex));
        }

        this.addressValidity = cfgSettings.addressValidity.clientBcotPayment;

        // Assign address manipulation functions
        this._getAddressKeys = Catenis.keyStore.getClientBcotPaymentAddressKeys.bind(Catenis.keyStore, ctnNodeIndex, clientIndex);
        this._listAddressesInUse = Catenis.keyStore.listClientBcotPaymentAddressesInUse.bind(Catenis.keyStore, ctnNodeIndex, clientIndex);

        // Initialize bounding indices
        setBoundingIndices.call(this);

        // Save this instance
        setInstantiatedObject(this.parentPath, this);
    }

    newAddressKeys() {
        const addrKeys = Object.getPrototypeOf(BaseClientBcotPaymentAddress.prototype).newAddressKeys.call(this);

        if (addrKeys !== null) {
            // Import address public key onto Omni Core
            Catenis.omniCore.importPublicKey(addrKeys.exportPublicKey());
        }

        return addrKeys;
    }

    // Get instance of this class
    //
    //  ctnNodeIndex: [integer]
    //                or
    //                {  // Options object
    //      ctnNodeIndex: [integer],
    //      clientIndex: [integer]
    //  },
    //  clientIndex: [integer]
    //
    static getInstance(ctnNodeIndex, clientIndex, parentPath) {
        if (typeof ctnNodeIndex === 'object') {
            // Options object passed instead of plain arguments
            clientIndex = ctnNodeIndex.clientIndex;
            ctnNodeIndex = ctnNodeIndex.ctnNodeIndex;
        }

        // Check if an instance of this class has already been instantiated
        parentPath = parentPath || KeyStore.clientBcotPaymentAddressRootPath(ctnNodeIndex, clientIndex);

        return hasInstantiatedObject(parentPath) ? getInstantiatedObject(parentPath)
            : new BaseClientBcotPaymentAddress(ctnNodeIndex, clientIndex);
    }
}

// BaseDeviceReadConfirmAddress derived class
export class BaseDeviceReadConfirmAddress extends BaseBlockchainAddress {
    constructor (ctnNodeIndex, clientIndex, deviceIndex) {
        super();
        this.type = KeyStore.extKeyType.dev_read_conf_addr.name;
        this.parentPath = KeyStore.deviceReadConfirmAddressRootPath(ctnNodeIndex, clientIndex, deviceIndex);
        this.btcAddressType = BitcoinInfo.addressType.witness_v0_keyhash;

        // Make sure that an object of this class has not been instantiated yet
        if (hasInstantiatedObject(this.parentPath)) {
            Catenis.logger.ERROR(util.format('BaseDeviceReadConfirmAddress object for the given Catenis node, client and device indices (%d, %d and %d, respectively) has already been instantiated', ctnNodeIndex, clientIndex, deviceIndex));
            throw new Error(util.format('BaseDeviceReadConfirmAddress object for the given Catenis node, client and device indices (%d, %d and %d, respectively) has already been instantiated', ctnNodeIndex, clientIndex, deviceIndex));
        }

        this.addressValidity = cfgSettings.addressValidity.deviceReadConfirm;

        // Assign address manipulation functions
        this._getAddressKeys = Catenis.keyStore.getDeviceReadConfirmAddressKeys.bind(Catenis.keyStore, ctnNodeIndex, clientIndex, deviceIndex);
        this._listAddressesInUse = Catenis.keyStore.listDeviceReadConfirmAddressesInUse.bind(Catenis.keyStore, ctnNodeIndex, clientIndex, deviceIndex);

        // Initialize bounding indices
        setBoundingIndices.call(this);

        // Save this instance
        setInstantiatedObject(this.parentPath, this);
    }

    // Get instance of this class
    //
    //  ctnNodeIndex: [integer]
    //                or
    //                {  // Options object
    //      ctnNodeIndex: [integer],
    //      clientIndex: [integer],
    //      deviceIndex: [integer]
    //  },
    //  clientIndex: [integer],
    //  deviceIndex: [integer]
    //
    static getInstance(ctnNodeIndex, clientIndex, deviceIndex, parentPath) {
        if (typeof ctnNodeIndex === 'object') {
            // Options object passed instead of plain arguments
            deviceIndex = ctnNodeIndex.deviceIndex;
            clientIndex = ctnNodeIndex.clientIndex;
            ctnNodeIndex = ctnNodeIndex.ctnNodeIndex;
        }

        // Check if an instance of this class has already been instantiated
        parentPath = parentPath || KeyStore.deviceReadConfirmAddressRootPath(ctnNodeIndex, clientIndex, deviceIndex);

        return hasInstantiatedObject(parentPath) ? getInstantiatedObject(parentPath)
            : new BaseDeviceReadConfirmAddress(ctnNodeIndex, clientIndex, deviceIndex);
    }
}

// BaseDeviceMigratedAssetAddress derived class
export class BaseDeviceMigratedAssetAddress extends BaseBlockchainAddress {
    constructor (ctnNodeIndex, clientIndex, deviceIndex) {
        super();
        this.type = KeyStore.extKeyType.dev_migr_asst_addr.name;
        this.parentPath = KeyStore.deviceMigratedAssetAddressRootPath(ctnNodeIndex, clientIndex, deviceIndex);
        this.btcAddressType = BitcoinInfo.addressType.witness_v0_keyhash;

        // Make sure that an object of this class has not been instantiated yet
        if (hasInstantiatedObject(this.parentPath)) {
            Catenis.logger.ERROR(util.format('BaseDeviceMigratedAssetAddress object for the given Catenis node, client and device indices (%d, %d and %d, respectively) has already been instantiated', ctnNodeIndex, clientIndex, deviceIndex));
            throw new Error(util.format('BaseDeviceMigratedAssetAddress object for the given Catenis node, client and device indices (%d, %d and %d, respectively) has already been instantiated', ctnNodeIndex, clientIndex, deviceIndex));
        }

        this.addressValidity = cfgSettings.addressValidity.deviceMigratedAsset;

        // Assign address manipulation functions
        this._getAddressKeys = Catenis.keyStore.getDeviceMigratedAssetAddressKeys.bind(Catenis.keyStore, ctnNodeIndex, clientIndex, deviceIndex);
        this._listAddressesInUse = Catenis.keyStore.listDeviceMigratedAssetAddressesInUse.bind(Catenis.keyStore, ctnNodeIndex, clientIndex, deviceIndex);

        // Initialize bounding indices
        setBoundingIndices.call(this);

        // Save this instance
        setInstantiatedObject(this.parentPath, this);
    }

    // Get instance of this class
    //
    //  ctnNodeIndex: [integer]
    //                or
    //                {  // Options object
    //      ctnNodeIndex: [integer],
    //      clientIndex: [integer],
    //      deviceIndex: [integer]
    //  },
    //  clientIndex: [integer],
    //  deviceIndex: [integer]
    //
    static getInstance(ctnNodeIndex, clientIndex, deviceIndex, parentPath) {
        if (typeof ctnNodeIndex === 'object') {
            // Options object passed instead of plain arguments
            deviceIndex = ctnNodeIndex.deviceIndex;
            clientIndex = ctnNodeIndex.clientIndex;
            ctnNodeIndex = ctnNodeIndex.ctnNodeIndex;
        }

        // Check if an instance of this class has already been instantiated
        parentPath = parentPath || KeyStore.deviceMigratedAssetAddressRootPath(ctnNodeIndex, clientIndex, deviceIndex);

        return hasInstantiatedObject(parentPath) ? getInstantiatedObject(parentPath)
            : new BaseDeviceMigratedAssetAddress(ctnNodeIndex, clientIndex, deviceIndex);
    }
}

// BaseDeviceMainAddress derived class
export class BaseDeviceMainAddress extends BaseBlockchainAddress {
    constructor (ctnNodeIndex, clientIndex, deviceIndex) {
        super();
        this.type = KeyStore.extKeyType.dev_main_addr.name;
        this.parentPath = KeyStore.deviceMainAddressRootPath(ctnNodeIndex, clientIndex, deviceIndex);
        // NOTE: `btcAddressType` defined as a getter property (see below)

        // Make sure that an object of this class has not been instantiated yet
        if (hasInstantiatedObject(this.parentPath)) {
            Catenis.logger.ERROR(util.format('BaseDeviceMainAddress object for the given Catenis node, client and device indices (%d, %d and %d, respectively) has already been instantiated', ctnNodeIndex, clientIndex, deviceIndex));
            throw new Error(util.format('BaseDeviceMainAddress object for the given Catenis node, client and device indices (%d, %d and %d, respectively) has already been instantiated', ctnNodeIndex, clientIndex, deviceIndex));
        }

        this.addressValidity = cfgSettings.addressValidity.deviceMain;

        // Assign address manipulation functions
        this._getAddressKeys = Catenis.keyStore.getDeviceMainAddressKeys.bind(Catenis.keyStore, ctnNodeIndex, clientIndex, deviceIndex);
        this._listAddressesInUse = Catenis.keyStore.listDeviceMainAddressesInUse.bind(Catenis.keyStore, ctnNodeIndex, clientIndex, deviceIndex);

        // Initialize bounding indices
        setBoundingIndices.call(this);

        // Save this instance
        setInstantiatedObject(this.parentPath, this);
    }

    get btcAddressType() {
        return Catenis.application.legacyDustFunding ? BitcoinInfo.addressType.pubkeyhash : BitcoinInfo.addressType.witness_v0_keyhash;
    }

    // Get instance of this class
    //
    //  ctnNodeIndex: [integer]
    //                or
    //                {  // Options object
    //      ctnNodeIndex: [integer],
    //      clientIndex: [integer],
    //      deviceIndex: [integer]
    //  },
    //  clientIndex: [integer],
    //  deviceIndex: [integer]
    //
    static getInstance(ctnNodeIndex, clientIndex, deviceIndex, parentPath) {
        if (typeof ctnNodeIndex === 'object') {
            // Options object passed instead of plain arguments
            deviceIndex = ctnNodeIndex.deviceIndex;
            clientIndex = ctnNodeIndex.clientIndex;
            ctnNodeIndex = ctnNodeIndex.ctnNodeIndex;
        }

        // Check if an instance of this class has already been instantiated
        parentPath = parentPath || KeyStore.deviceMainAddressRootPath(ctnNodeIndex, clientIndex, deviceIndex);

        return hasInstantiatedObject(parentPath) ? getInstantiatedObject(parentPath)
            : new BaseDeviceMainAddress(ctnNodeIndex, clientIndex, deviceIndex);
    }
}

// BaseDeviceAssetAddress derived class
export class BaseDeviceAssetAddress extends BaseBlockchainAddress {
    constructor (ctnNodeIndex, clientIndex, deviceIndex) {
        super();
        this.type = KeyStore.extKeyType.dev_asst_addr.name;
        this.parentPath = KeyStore.deviceAssetAddressRootPath(ctnNodeIndex, clientIndex, deviceIndex);
        this.btcAddressType = BitcoinInfo.addressType.witness_v0_keyhash;

        // Make sure that an object of this class has not been instantiated yet
        if (hasInstantiatedObject(this.parentPath)) {
            Catenis.logger.ERROR(util.format('BaseDeviceAssetAddress object for the given Catenis node, client and device indices (%d, %d and %d, respectively) has already been instantiated', ctnNodeIndex, clientIndex, deviceIndex));
            throw new Error(util.format('BaseDeviceAssetAddress object for the given Catenis node, client and device indices (%d, %d and %d, respectively) has already been instantiated', ctnNodeIndex, clientIndex, deviceIndex));
        }

        this.addressValidity = cfgSettings.addressValidity.deviceAsset;

        // Assign address manipulation functions
        this._getAddressKeys = Catenis.keyStore.getDeviceAssetAddressKeys.bind(Catenis.keyStore, ctnNodeIndex, clientIndex, deviceIndex);
        this._listAddressesInUse = Catenis.keyStore.listDeviceAssetAddressesInUse.bind(Catenis.keyStore, ctnNodeIndex, clientIndex, deviceIndex);

        // Initialize bounding indices
        setBoundingIndices.call(this);

        // Save this instance
        setInstantiatedObject(this.parentPath, this);
    }

    // Get instance of this class
    //
    //  ctnNodeIndex: [integer]
    //                or
    //                {  // Options object
    //      ctnNodeIndex: [integer],
    //      clientIndex: [integer],
    //      deviceIndex: [integer]
    //  },
    //  clientIndex: [integer],
    //  deviceIndex: [integer]
    //
    static getInstance(ctnNodeIndex, clientIndex, deviceIndex, parentPath) {
        if (typeof ctnNodeIndex === 'object') {
            // Options object passed instead of plain arguments
            deviceIndex = ctnNodeIndex.deviceIndex;
            clientIndex = ctnNodeIndex.clientIndex;
            ctnNodeIndex = ctnNodeIndex.ctnNodeIndex;
        }

        // Check if an instance of this class has already been instantiated
        parentPath = parentPath || KeyStore.deviceAssetAddressRootPath(ctnNodeIndex, clientIndex, deviceIndex);

        return hasInstantiatedObject(parentPath) ? getInstantiatedObject(parentPath)
            : new BaseDeviceAssetAddress(ctnNodeIndex, clientIndex, deviceIndex);
    }
}

// BaseDeviceAssetIssuanceAddress derived class
export class BaseDeviceAssetIssuanceAddress extends BaseBlockchainAddress {
    constructor (ctnNodeIndex, clientIndex, deviceIndex) {
        super();
        this.type = KeyStore.extKeyType.dev_asst_issu_addr.name;
        this.parentPath = KeyStore.deviceAssetIssuanceAddressRootPath(ctnNodeIndex, clientIndex, deviceIndex);
        // NOTE: `btcAddressType` defined as a getter property (see below)

        // Make sure that an object of this class has not been instantiated yet
        if (hasInstantiatedObject(this.parentPath)) {
            Catenis.logger.ERROR(util.format('BaseDeviceAssetIssuanceAddress object for the given Catenis node, client and device indices (%d, %d and %d, respectively) has already been instantiated', ctnNodeIndex, clientIndex, deviceIndex));
            throw new Error(util.format('BaseDeviceAssetIssuanceAddress object for the given Catenis node, client and device indices (%d, %d and %d, respectively) has already been instantiated', ctnNodeIndex, clientIndex, deviceIndex));
        }

        this.addressValidity = cfgSettings.addressValidity.deviceAssetIssuance;

        // Assign address manipulation functions
        this._getAddressKeys = Catenis.keyStore.getDeviceAssetIssuanceAddressKeys.bind(Catenis.keyStore, ctnNodeIndex, clientIndex, deviceIndex);
        this._listAddressesInUse = Catenis.keyStore.listDeviceAssetIssuanceAddressesInUse.bind(Catenis.keyStore, ctnNodeIndex, clientIndex, deviceIndex);
        this._latestAddressInUse = Catenis.keyStore.latestDeviceAssetIssuanceAddressInUse.bind(Catenis.keyStore, ctnNodeIndex, clientIndex, deviceIndex);

        // Initialize bounding indices
        setBoundingIndices.call(this);

        // Save this instance
        setInstantiatedObject(this.parentPath, this);
    }

    get btcAddressType() {
        return Catenis.application.legacyDustFunding ? BitcoinInfo.addressType.pubkeyhash : BitcoinInfo.addressType.witness_v0_keyhash;
    }

    // Get instance of this class
    //
    //  ctnNodeIndex: [integer]
    //                or
    //                {  // Options object
    //      ctnNodeIndex: [integer],
    //      clientIndex: [integer],
    //      deviceIndex: [integer]
    //  },
    //  clientIndex: [integer],
    //  deviceIndex: [integer]
    //
    static getInstance(ctnNodeIndex, clientIndex, deviceIndex, parentPath) {
        if (typeof ctnNodeIndex === 'object') {
            // Options object passed instead of plain arguments
            deviceIndex = ctnNodeIndex.deviceIndex;
            clientIndex = ctnNodeIndex.clientIndex;
            ctnNodeIndex = ctnNodeIndex.ctnNodeIndex;
        }

        // Check if an instance of this class has already been instantiated
        parentPath = parentPath || KeyStore.deviceAssetIssuanceAddressRootPath(ctnNodeIndex, clientIndex, deviceIndex);

        return hasInstantiatedObject(parentPath) ? getInstantiatedObject(parentPath)
            : new BaseDeviceAssetIssuanceAddress(ctnNodeIndex, clientIndex, deviceIndex);
    }
}

// BaseBlockchainAddress function class
export function BaseBlockchainAddress() {
    this.type = undefined;
    this.parentPath = undefined;
    this.btcAddressType = undefined;
    this.addressValidity = undefined;
    this.lastIssuedAddrIndex = undefined;
    this.lastInUseAddrIndex = undefined;
    this.firstInUseAddrIndex = undefined;

    Object.defineProperties(this, {
        _getAddressKeys: {
            enumerable: false,
            writable: true,
            value: undefined
        },
        _listAddressesInUse: {
            enumerable: false,
            writable: true,
            value: undefined
        },
        _latestAddressInUse: {
            enumerable: false,
            writable: true,
            value: undefined
        }
    });
}


// Public BaseBlockchainAddress object methods
//

BaseBlockchainAddress.prototype.newAddressKeys = function () {
    let addrKeys = null;

    // Execute code in critical section to avoid DB concurrency
    dbCS.execute(() => {
        // Try to get next address
        const nonexistIndices = [];

        do {
            if ((addrKeys = this._getAddressKeys(++this.lastIssuedAddrIndex, this.btcAddressType)) === null) {
                nonexistIndices.push(this.lastIssuedAddrIndex);
            }
        }
        while (addrKeys === null);

        // Import address public key onto Bitcoin Core
        Catenis.bitcoinCore.importPublicKey(addrKeys.exportPublicKey());

        // Save issued address
        const issuedDate = new Date();

        if (nonexistIndices.length > 0) {
            nonexistIndices.forEach((nonexistIndex) => {
                Catenis.db.collection.IssuedBlockchainAddress.insert({
                    type: this.type,
                    parentPath: this.parentPath,
                    path: util.format('%s/%d', this.parentPath, nonexistIndex),
                    addrIndex: nonexistIndex,
                    issuedDate: issuedDate,
                    status: 'nonexistent'
                });
            });
        }

        let expirationDate;

        if (this.addressValidity) {
            expirationDate = new Date(issuedDate.getTime());
            expirationDate.setSeconds(expirationDate.getSeconds() + this.addressValidity);
        }
        else {
            expirationDate = null;
        }

        Catenis.db.collection.IssuedBlockchainAddress.insert({
            type: this.type,
            parentPath: this.parentPath,
            path: util.format('%s/%d', this.parentPath, this.lastIssuedAddrIndex),
            addrIndex: this.lastIssuedAddrIndex,
            btcAddressType: this.btcAddressType.name,
            addrHash: hashAddress(addrKeys.getAddress()),
            issuedDate: issuedDate,
            expirationDate: expirationDate,
            status: 'new'
        });

        // Update in-use address indices
        this.lastInUseAddrIndex = this.lastIssuedAddrIndex;

        if (this.firstInUseAddrIndex < 0) {
            this.firstInUseAddrIndex = this.lastIssuedAddrIndex;
        }
    });

    return addrKeys;
};

BaseBlockchainAddress.prototype.listAddressesInUse = function () {
    return this.firstInUseAddrIndex >= 0 && this.lastInUseAddrIndex >= 0 ? this._listAddressesInUse(this.firstInUseAddrIndex, this.lastInUseAddrIndex) : [];
};

BaseBlockchainAddress.prototype.lastAddressKeys = function () {
    return this.lastInUseAddrIndex >= 0 ? this._getAddressKeys(this.lastInUseAddrIndex, this.btcAddressType) : this.newAddressKeys();
};


// Module functions used to simulate private BaseBlockchainAddress object methods
//  NOTE: these functions need to be bound to a BaseBlockchainAddress object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

function setBoundingIndices() {
    let docIssuedAddr = Catenis.db.collection.IssuedBlockchainAddress.findOne({parentPath: this.parentPath}, {fields: {addrIndex: 1}, sort: {addrIndex: -1}});

    if (docIssuedAddr !== undefined) {
        this.lastIssuedAddrIndex = docIssuedAddr.addrIndex;

        docIssuedAddr = Catenis.db.collection.IssuedBlockchainAddress.findOne({parentPath: this.parentPath, status: {$in: ['new', 'expired']}}, {fields: {addrIndex: 1}, sort: {addrIndex: -1}});

        if (docIssuedAddr !== undefined) {
            this.lastInUseAddrIndex = docIssuedAddr.addrIndex;

            this.firstInUseAddrIndex = Catenis.db.collection.IssuedBlockchainAddress.findOne({parentPath: this.parentPath, status: {$in: ['new', 'expired']}}, {fields: {addrIndex: 1}, sort: {addrIndex: 1}}).addrIndex;

            // Add in-use addresses to KeyStore
            Catenis.db.collection.IssuedBlockchainAddress.find({
                parentPath: this.parentPath,
                $and: [{
                    addrIndex: {
                        $gte: this.firstInUseAddrIndex
                    }
                }, {
                    addrIndex: {
                        $lte: this.lastInUseAddrIndex
                    }
                }],
                status: {
                    $ne: 'nonexistent'
                }
            }, {
                fields: {
                    addrIndex: 1,
                    btcAddressType: 1,
                    status: 1
                },
                sort: {
                    addrIndex: 1
                }
            }).fetch().forEach((doc) => {
                if (doc.status !== 'obsolete') {
                    // Get bitcoin address type making sure to set it to P2PKH for those issued blockchain address
                    //  docs/recs that do not have a specific address type set
                    const btcAddressType = doc.btcAddressType ? BitcoinInfo.getAddressTypeByName(doc.btcAddressType) : BitcoinInfo.addressType.pubkeyhash;

                    this._getAddressKeys(doc.addrIndex, btcAddressType);
                }
            });
        }
        else {
            this.lastInUseAddrIndex = this.firstInUseAddrIndex = -1;
        }
    }
    else {
        this.lastIssuedAddrIndex = this.lastInUseAddrIndex = this.firstInUseAddrIndex = -1;
    }
}

function updateInUseAddressIndices() {
    const docIssuedAddr = Catenis.db.collection.IssuedBlockchainAddress.findOne({parentPath: this.parentPath, status: {$in: ['new', 'expired']}}, {fields: {addrIndex: 1}, sort: {addrIndex: -1}});

    if (docIssuedAddr !== undefined) {
        this.lastInUseAddrIndex = docIssuedAddr.addrIndex;

        this.firstInUseAddrIndex = Catenis.db.collection.IssuedBlockchainAddress.findOne({parentPath: this.parentPath, status: {$in: ['new', 'expired']}}, {fields: {addrIndex: 1}, sort: {addrIndex: 1}}).addrIndex;
    }
    else {
        this.lastInUseAddrIndex = this.firstInUseAddrIndex = -1;
    }
}

// Reset blockchain address that has previously being created/allocated (via newAddressKeys() method)
//  to make it as if it has not been created/allocated yet
//
//  address: [string]  // Address to revert
//  addrIndex: [number]  // Index of address (last component of address path) to revert
//  balanceChecked: [boolean}  // If true, address balance has already been checked and it is guaranteed that
//      it has no balance. If false, no check has been performed yet
function revertAddress(address, addrIndex, balanceChecked = false) {
    let result = false;

    // Make sure that this is the last issued address, it
    //  is not obsolete and not currently in use
    if (addrIndex >= 0 && addrIndex === this.lastIssuedAddrIndex && addrIndex === this.lastInUseAddrIndex && (balanceChecked || !BaseBlockchainAddress.isAddressWithBalance(address))) {
        // Execute code in critical section to avoid DB concurrency
        dbCS.execute(() => {
            // Exclude address from database
            const count = Catenis.db.collection.IssuedBlockchainAddress.remove({
                parentPath: this.parentPath,
                addrIndex: addrIndex
            });

            if (count > 0) {
                // Adjust indices
                if (addrIndex > 0) {
                    // Retrieve any nonexistent address indices
                    const docNonExistAddrs = Catenis.db.collection.IssuedBlockchainAddress.find({
                        parentPath: this.parentPath,
                        status: 'nonexistent'
                    }, {fields: {addrIndex: 1}, sort: {addrIndex: -1}}).fetch();

                    // Determine adjusted index
                    let adjustIndex = addrIndex - 1;

                    if (docNonExistAddrs.length > 0) {
                        // Make sure that adjusted index is not nonexistent
                        docNonExistAddrs.some((docNonExistAddr) => {
                            if (docNonExistAddr.addrIndex === adjustIndex) {
                                adjustIndex--;

                                return adjustIndex < 0;
                            }
                            else {
                                return true;
                            }
                        });
                    }

                    if (adjustIndex >= 0) {
                        this.lastIssuedAddrIndex = adjustIndex;

                        if (adjustIndex >= this.firstInUseAddrIndex) {
                            this.lastInUseAddrIndex = adjustIndex;
                        }
                        else {
                            this.firstInUseAddrIndex = this.lastInUseAddrIndex = -1;
                        }
                    }
                    else {
                        this.lastIssuedAddrIndex = this.firstInUseAddrIndex = this.lastInUseAddrIndex = -1;
                    }
                }
                else {
                    this.lastIssuedAddrIndex = this.firstInUseAddrIndex = this.lastInUseAddrIndex = -1;
                }

                result = true;
            }

            // Also remove address from local key storage
            Catenis.keyStore.removeExtKeyByAddress(address);
        });
    }

    return result;
}

// Change address status from obsolete back to expired
function resetObsoleteAddress(addr, docIssuedAddr) {
    // Execute code in critical section to avoid DB concurrency
    dbCS.execute(() => {
        // Change address status on database
        Catenis.db.collection.IssuedBlockchainAddress.update({_id: docIssuedAddr._id}, {
            $set: {
                status: 'expired',
                lastStatusChangedDate: new Date(Date.now())
            }
        });

        // Change address status on local key storage
        Catenis.keyStore.resetObsoleteAddress(addr);

        // Adjust address indices
        if (this.firstInUseAddrIndex === -1) {
            this.firstInUseAddrIndex = this.lastInUseAddrIndex = docIssuedAddr.addrIndex;
        }
        else if (docIssuedAddr.addrIndex < this.firstInUseAddrIndex) {
            this.firstInUseAddrIndex = docIssuedAddr.addrIndex;
        }
        else if (docIssuedAddr.addrIndex > this.lastInUseAddrIndex) {
            this.lastInUseAddrIndex = docIssuedAddr.addrIndex;
        }

        if (this.lastIssuedAddrIndex === -1 || docIssuedAddr.addrIndex > this.lastIssuedAddrIndex) {
            // This should never happen; just do it for consistency
            this.lastIssuedAddrIndex = docIssuedAddr.addrIndex;
        }
    });
}


// BaseBlockchainAddress function class (public) methods
//

BaseBlockchainAddress.initialize = function (delayIssuedBlockchainAddressUpdate = false) {
    Catenis.logger.TRACE('BaseBlockchainAddress initialization');
    // Update issued blockchain addresses now, and set recurring timer
    //  to update issued blockchain addresses periodically later
    if (!delayIssuedBlockchainAddressUpdate) {
        Catenis.logger.TRACE('Delaying update of issued blockchain addresses');
        updateIssuedAddresses();
    }

    Catenis.logger.TRACE('Setting recurring timer to update issued blockchain addresses');
    updtIssuedAddrsIntervalHandle = Meteor.setInterval(updateIssuedAddresses, cfgSettings.updateIssuedAddressesInterval);

    // Set recurring timer to delete inactive instantiated objects
    Catenis.logger.TRACE('Setting recurring timer to delete inactive instantiated objects');
    delInactiveObjectsIntervalHandle = Meteor.setInterval(deleteInactiveObjects, cfgSettings.deleteInactiveObjectsInterval);
};

// opts: {
//   type: [string],
//   pathParts: {
//   }
// }
BaseBlockchainAddress.getInstance = function (opts) {
    // Call getInstance method of corresponding derived class
    let drvClass,
        classInstance = null;

    if ((drvClass = classByType[opts.type]) !== undefined) {
        classInstance = drvClass.getInstance(opts.pathParts);
    }

    return classInstance;
};

// Check whether address has balance (there is any UTXO associated with it)
BaseBlockchainAddress.isAddressWithBalance = function (addr) {
    // Check if any UTXOs associated with address is locked
    const hasLockedTxOuts = Catenis.bitcoinCore.listLockUnspent().some((lockTxOut) => {
        const txOutInfo = Catenis.bitcoinCore.getTxOut(lockTxOut.txid, lockTxOut.vout);

        return txOutInfo !== null && ((txOutInfo.scriptPubKey.address && txOutInfo.scriptPubKey.address === addr)
            || (txOutInfo.scriptPubKey.type === 'multisig'
            && Util.multiSigAddresses(txOutInfo.scriptPubKey).some(mSigAddr => mSigAddr === addr)));
    });

    if (hasLockedTxOuts) {
        return true;
    }

    // Now, check if there are any UTXOs associated with address
    const unspentTxOuts = Catenis.bitcoinCore.listUnspent(0, addr);

    return unspentTxOuts.length > 0;
};

//  Checks whether each one of the addresses of a given address list has balance
//   (there is any UTXO associated with it)
//
//  result: {
//    <address>: [boolean]  // True if address in use, false otherwise
//  }
//
BaseBlockchainAddress.checkAddressesWithBalance = function (addrList) {
    // Identify addresses that have locked UTXOs
    const lockedAddresses = new Set();

    Catenis.bitcoinCore.listLockUnspent().forEach((lockTxOut) => {
        let txOutInfo = Catenis.bitcoinCore.getTxOut(lockTxOut.txid, lockTxOut.vout);

        if (txOutInfo !== null) {
            if (txOutInfo.scriptPubKey.address) {
                lockedAddresses.add(txOutInfo.scriptPubKey.address);
            }
            else if (txOutInfo.scriptPubKey.type === 'multisig') {
                Util.multiSigAddresses(txOutInfo.scriptPubKey).forEach(mSigAddr => {
                    lockedAddresses.add(mSigAddr);
                });
            }
        }
    });

    const result = {},
        addrsToListUnspent = [];

    addrList.forEach((addr) => {
        if (lockedAddresses.has(addr)) {
            // If address has any locked UTXOs, indicate that it is in use
            result[addr] = true;
        }
        else {
            // Otherwise, include it to check for UTXOs associated with it
            addrsToListUnspent.push(addr);
        }
    });

    if (addrsToListUnspent.length > 0) {
        // Identify addresses that have UTXOs associated with them
        let addressesWithUtxo = new Set();

        Catenis.bitcoinCore.listUnspent(0, addrsToListUnspent).forEach((utxo) => {
            if (!addressesWithUtxo.has(utxo.address)) {
                addressesWithUtxo.add(utxo.address);
            }
        });

        addrsToListUnspent.forEach((addr) => {
            result[addr] = addressesWithUtxo.has(addr);
        });
    }

    return result;
};

// Obtain blockchain address associated with an IssuedBlockchainAddress doc/rec
//
// Argument:
//  docIssuedAddr: {  // IssuedBlockchainAddress doc/rec with at least the following fields
//    type: [string],
//    path: [string],
//    status: [string]
//  }
BaseBlockchainAddress.getAddressOfIssuedBlockchainAddress = function (docIssuedAddr) {
    // Try to retrieve address crypto keys from local key storage
    let addrKeys = Catenis.keyStore.getCryptoKeysByPath(docIssuedAddr.path);

    if (addrKeys === null) {
        // Crypto keys of issued address is not yet in local storage.
        //  Bring it up
        const classInstance = BaseBlockchainAddress.getInstance({type: docIssuedAddr.type, pathParts: KeyStore.getPathParts(docIssuedAddr)});

        if (classInstance !== null) {
            // Store address in local key storage setting it as obsolete accordingly,
            //  and get its corresponding crypto keys

            // Get bitcoin address type making sure to set it to P2PKH if issued blockchain address doc/rec
            //  does not have a specific address type set
            const btcAddressType = docIssuedAddr.btcAddressType ? BitcoinInfo.getAddressTypeByName(docIssuedAddr.btcAddressType) : BitcoinInfo.addressType.pubkeyhash;

            addrKeys = classInstance._getAddressKeys(docIssuedAddr.addrIndex, btcAddressType, docIssuedAddr.status === 'obsolete');
        }
    }

    return addrKeys !== null ? addrKeys.getAddress() : null;
};

// Place obsolete address back onto local key storage
BaseBlockchainAddress.retrieveObsoleteAddress = function (addr, checkAddressInUse = false) {
    // Try to retrieve obsolete address from database
    let docIssuedAddrs = Catenis.db.collection.IssuedBlockchainAddress.find({
        addrHash: hashAddress(addr),
        status: 'obsolete'
    }, {
        fields: {
            type: 1,
            path: 1,
            addrIndex: 1,
            btcAddressType: 1
        }
    }).fetch();
    let result = false;

    if (docIssuedAddrs.length > 0) {
        if (docIssuedAddrs.length === 1) {
            // Only one doc/rec returned
            const docIssuedAddr = docIssuedAddrs[0];
            let addrKeys = Catenis.keyStore.getCryptoKeysByPath(docIssuedAddr.path);

            // Make sure that address is not yet in local key storage
            if (addrKeys === null) {
                let classInstance = BaseBlockchainAddress.getInstance({type: docIssuedAddr.type, pathParts: KeyStore.getPathParts(docIssuedAddr)});

                if (classInstance !== null) {
                    // Store address in local key storage making sure that it is set as obsolete,
                    //  and get its corresponding crypto keys

                    // Get bitcoin address type making sure to set it to P2PKH if Issued Blockchain Address database
                    //  doc/rec does not have a specific address type set
                    const btcAddressType = docIssuedAddr.btcAddressType ? BitcoinInfo.getAddressTypeByName(docIssuedAddr.btcAddressType) : BitcoinInfo.addressType.pubkeyhash;

                    let addrKeys = classInstance._getAddressKeys(docIssuedAddr.addrIndex, btcAddressType, true);

                    if (addrKeys !== null) {
                        // Make sure that this is the correct address (though unlikely, not impossible
                        //  since there could be one or more addresses with the same hash)
                        if (addrKeys.getAddress() === addr) {
                            result = true;

                            // Check if address is in use
                            if (checkAddressInUse && BaseBlockchainAddress.isAddressWithBalance(addr)) {
                                // If so, reset address status back to expired
                                resetObsoleteAddress.call(classInstance, addr, docIssuedAddr);
                            }
                        }
                        else {
                            // Wrong address has been retrieved. Remove it from local key storage
                            Catenis.keyStore.removeExtKeyByAddress(addrKeys.getAddress());
                        }
                    }
                }
            }
            else {
                // Address is already in local key storage. Proceed as if address has been retrieved

                // Make sure that this is the correct address (though unlikely, not impossible
                //  since there could be one or more addresses with the same hash)
                if (addrKeys.getAddress() === addr) {
                    result = true;

                    // Check if address is in use
                    if (checkAddressInUse && BaseBlockchainAddress.isAddressWithBalance(addr)) {
                        // If so, reset address status back to expired
                        let classInstance = BaseBlockchainAddress.getInstance({type: docIssuedAddr.type, pathParts: KeyStore.getPathParts(docIssuedAddr)});

                        if (classInstance) {
                            resetObsoleteAddress.call(classInstance, addr, docIssuedAddr);
                        }
                    }
                }
            }
        }
        else {
            // More than one doc/rec returned (though unlikely, not impossible since there could
            //  be one or more addresses with the same hash).
            //  Find the one that has the correct address
            if (docIssuedAddrs.find((docIssuedAddr) => {
                let addrKeys = Catenis.keyStore.getCryptoKeysByPath(docIssuedAddr.path),
                    found = false;

                // Make sure that address is not yet in local key storage
                if (addrKeys === null) {
                    let classInstance = BaseBlockchainAddress.getInstance({type: docIssuedAddr.type, pathParts: KeyStore.getPathParts(docIssuedAddr)});

                    if (classInstance !== null) {
                        // Store address in local key storage making sure that it is set as obsolete,
                        //  and get its corresponding crypto keys

                        // Get bitcoin address type making sure to set it to P2PKH if issued blockchain address
                        //  doc/rec does not have a specific address type set
                        const btcAddressType = docIssuedAddr.btcAddressType ? BitcoinInfo.getAddressTypeByName(docIssuedAddr.btcAddressType) : BitcoinInfo.addressType.pubkeyhash;

                        let addrKeys = classInstance._getAddressKeys(docIssuedAddr.addrIndex, btcAddressType, true);

                        if (addrKeys !== null) {
                            // Make sure that this is the correct address (though unlikely, not impossible
                            //  since there could be one or more addresses with the same hash)
                            if (addrKeys.getAddress() === addr) {
                                found = true;

                                // Check if address is in use
                                if (checkAddressInUse && BaseBlockchainAddress.isAddressWithBalance(addr)) {
                                    // If so, reset address status back to expired
                                    resetObsoleteAddress.call(classInstance, addr, docIssuedAddr);
                                }
                            }
                            else {
                                // Wrong address has been retrieved. Remove it from local key storage
                                Catenis.keyStore.removeExtKeyByAddress(addrKeys.getAddress());
                            }
                        }
                    }
                }
                else {
                    // Address is already in local key storage. Proceed as if address has been retrieved

                    // Make sure that this is the correct address (though unlikely, not impossible
                    //  since there could be one or more addresses with the same hash)
                    if (addrKeys.getAddress() === addr) {
                        found = true;

                        // Check if address is in use
                        if (checkAddressInUse && BaseBlockchainAddress.isAddressWithBalance(addr)) {
                            // If so, reset address status back to expired
                            let classInstance = BaseBlockchainAddress.getInstance({type: docIssuedAddr.type, pathParts: KeyStore.getPathParts(docIssuedAddr)});

                            if (classInstance) {
                                resetObsoleteAddress.call(classInstance, addr, docIssuedAddr);
                            }
                        }
                    }
                }

                return found;
            }) !== undefined) {
                result = true;
            }
        }
    }
    else {
        // No obsolete address entry found for the given address. Check if address status has
        //  possibly been reset to 'expired' in the mean time
        docIssuedAddrs = Catenis.db.collection.IssuedBlockchainAddress.find({
            addrHash: hashAddress(addr),
            status: 'expired'
        }, {
            fields: {
                path: 1
            }
        }).fetch();

        if (docIssuedAddrs.length > 0) {
            if (docIssuedAddrs.length === 1) {
                // Only one doc/rec returned
                const docIssuedAddr = docIssuedAddrs[0];
                let addrKeys;

                if ((addrKeys = Catenis.keyStore.getCryptoKeysByPath(docIssuedAddr.path)) !== null
                        && addrKeys.getAddress() === addr) {
                    // Address is already in local key storage. Indicate as if address has been retrieved
                    result = true;
                }
            }
            else {
                // More than one doc/rec returned (though unlikely, not impossible since there could
                //  be one or more addresses with the same hash).
                //  Find the one that has the correct address
                if (docIssuedAddrs.find((docIssuedAddr) => {
                    // Check if address is already in local key storage, and return indicating
                    //  as if address has been retrieved if so
                    let addrKeys;

                    return (addrKeys = Catenis.keyStore.getCryptoKeysByPath(docIssuedAddr.path)) !== null
                        && addrKeys.getAddress() === addr;
                }) !== undefined) {
                    result = true;
                }
            }
        }
    }

    return result;
};

// Place obsolete address back onto local key storage
BaseBlockchainAddress.retrieveObsoleteAddressByPath = function (addrPath, checkAddressInUse = false) {
    let result = false;

    // Try to retrieve obsolete address from database
    let docIssuedAddr = Catenis.db.collection.IssuedBlockchainAddress.findOne({
        path: addrPath,
        status: 'obsolete'
    }, {
        fields: {
            type: 1,
            path: 1,
            addrIndex: 1,
            btcAddressType: 1
        }
    });

    if (docIssuedAddr) {
        const addrKeys = Catenis.keyStore.getCryptoKeysByPath(addrPath);

        // Make sure that address is not yet in local key storage
        if (addrKeys === null) {
            let classInstance = BaseBlockchainAddress.getInstance({type: docIssuedAddr.type, pathParts: KeyStore.getPathParts(docIssuedAddr)});

            if (classInstance !== null) {
                // Store address in local key storage making sure that it is set as obsolete,
                //  and get its corresponding crypto keys

                // Get bitcoin address type making sure to set it to P2PKH if Issued Blockchain Address database
                //  doc/rec does not have a specific address type set
                const btcAddressType = docIssuedAddr.btcAddressType ? BitcoinInfo.getAddressTypeByName(docIssuedAddr.btcAddressType) : BitcoinInfo.addressType.pubkeyhash;

                const addrKeys = classInstance._getAddressKeys(docIssuedAddr.addrIndex, btcAddressType, true);

                if (addrKeys !== null) {
                    result = true;

                    if (checkAddressInUse) {
                        const addr = addrKeys.getAddress();

                        // Check if address is in use
                        if (BaseBlockchainAddress.isAddressWithBalance(addr)) {
                            // If so, reset address status back to expired
                            resetObsoleteAddress.call(classInstance, addr, docIssuedAddr);
                        }
                    }
                }
            }
        }
        else {
            // Address is already in local key storage. Proceed as if address has been retrieved
            result = true;

            if (checkAddressInUse) {
                const addr = addrKeys.getAddress();

                // Check if address is in use
                if (BaseBlockchainAddress.isAddressWithBalance(addr)) {
                    // If so, reset address status back to expired
                    let classInstance = BaseBlockchainAddress.getInstance({type: docIssuedAddr.type, pathParts: KeyStore.getPathParts(docIssuedAddr)});

                    if (classInstance) {
                        resetObsoleteAddress.call(classInstance, addr, docIssuedAddr);
                    }
                }
            }
        }
    }
    else {
        // No obsolete address entry found for the given address. Check if address status has
        //  possibly been reset to 'expired' in the mean time
        docIssuedAddr = Catenis.db.collection.IssuedBlockchainAddress.findOne({
            path: addrPath,
            status: 'expired'
        });

        if (docIssuedAddr && Catenis.keyStore.getCryptoKeysByPath(addrPath) !== null) {
            // Address is already in local key storage. Indicate as if address has been retrieved
            result = true;
        }
    }

    return result;
};

BaseBlockchainAddress.revertAddress = function (addr) {
    const addrTypeAndPath = Catenis.keyStore.getTypeAndPathByAddress(addr);
    let result = false;

    if (addrTypeAndPath !== null) {
        let addrPathParts = KeyStore.getPathParts(addrTypeAndPath),
            classInstance = BaseBlockchainAddress.getInstance({type: addrTypeAndPath.type, pathParts: addrPathParts});

        if (classInstance !== null) {
            // Revert address
            result = revertAddress.call(classInstance, addr, addrPathParts.addrIndex);
        }
    }

    return result;
};

// Check if address marked as obsolete is in use and reset its status if so
BaseBlockchainAddress.checkObsoleteAddress = function (addr) {
    let addrTypeAndPath = Catenis.keyStore.getTypeAndPathByAddress(addr),
        result = false;

    if (addrTypeAndPath !== null) {
        let docIssuedAddr = Catenis.db.collection.IssuedBlockchainAddress.findOne({path: addrTypeAndPath.path});

        if (docIssuedAddr !== undefined && docIssuedAddr.status === 'obsolete' && BaseBlockchainAddress.isAddressWithBalance(addr)) {
            let addrPathParts = KeyStore.getPathParts(addrTypeAndPath),
                classInstance = BaseBlockchainAddress.getInstance({type: addrTypeAndPath.type, pathParts: addrPathParts});

            resetObsoleteAddress.call(classInstance, addr, docIssuedAddr);

            result = true;
        }
    }

    return result;
};

BaseBlockchainAddress.revertAddressList = function (addrList) {
    // Make sure that list has no repeated addresses
    addrList = Array.from(new Set(addrList));

    const addressWithBalance = BaseBlockchainAddress.checkAddressesWithBalance(addrList),
        addrsToRevertByClassInstance = new Map();

    addrList.forEach((addr) => {
        if (!addressWithBalance[addr]) {
            // Only consider addresses that do not have balance
            let addrTypeAndPath = Catenis.keyStore.getTypeAndPathByAddress(addr);

            if (addrTypeAndPath !== null) {
                let addrPathParts = KeyStore.getPathParts(addrTypeAndPath),
                    classInstance = BaseBlockchainAddress.getInstance({type: addrTypeAndPath.type, pathParts: addrPathParts});

                if (classInstance !== null) {
                    // Save address to revert
                    if (addrsToRevertByClassInstance.has(classInstance)) {
                        addrsToRevertByClassInstance.get(classInstance).push({address: addr, addrIndex: addrPathParts.addrIndex});
                    }
                    else {
                        addrsToRevertByClassInstance.set(classInstance, [{address: addr, addrIndex: addrPathParts.addrIndex}]);
                    }
                }
            }
        }
    });

    let countRevertedAddr = 0;

    if (addrsToRevertByClassInstance.size > 0) {
        for (let [classInstance, addrEntries] of addrsToRevertByClassInstance.entries()) {
            // Make sure that addresses with higher index are processed first
            addrEntries = addrEntries.sort((a, b) => {
                return a.addrIndex > b.addrIndex ? -1 : (a.addrIndex < b.addrIndex ? 1 : 0);
            });

            addrEntries.forEach((addrEntry) => {
                // Revert address
                if (revertAddress.call(classInstance, addrEntry.address, addrEntry.addrIndex, true)) {
                    countRevertedAddr++;
                }
            });
        }
    }

    return countRevertedAddr === addrList.length ? true : (countRevertedAddr === 0 ? false : undefined);
};


// BaseBlockchainAddress function class (public) properties
//

BaseBlockchainAddress.instantiatedObjects = new Map();

// Definition of module (private) functions
//

function hashAddress(addr) {
    return crypto.createHash('sha256').update('Blockchain address used by Catenis:' + addr, 'utf8').digest('base64');
}

function deleteInactiveObjects() {
    Catenis.logger.TRACE('Executing process to delete inactive objects');
    // Calculate earliest date/time for instantiated object to have been accessed for it not to
    //  be considered inactive
    const activeObjEarliestTime = new Date(Date.now());
    activeObjEarliestTime.setSeconds(activeObjEarliestTime.getSeconds() - cfgSettings.inactiveObjectTime);

    const activeObjEarliestTimestamp = activeObjEarliestTime.getTime();

    // Identify inactive objects and delete them
    for (let [parentPath, objEntry] of BaseBlockchainAddress.instantiatedObjects.entries()) {
        if (objEntry.lastAccessTimestamp < activeObjEarliestTimestamp) {
            deleteInstantiatedObject(parentPath);
        }
    }
}

// NOTE: this (new version of this) method is set to process one address at a time, giving the
//      opportunity for other parts of the code to be executed in between
function updateIssuedAddresses() {
    Catenis.logger.TRACE('Executing process to update issued blockchain addresses');

    // Identify issued blockchain addresses doc/rec that should be set as obsolete
    const idDocsToProcess = Catenis.db.collection.IssuedBlockchainAddress.find({
        status: 'expired'
    }, {
        fields: {
            _id: 1
        }
    }).fetch().map((doc) => doc._id);

    if (idDocsToProcess.length > 0) {
        Util.processItemsAsync(idDocsToProcess, (idDocToProcess) => {
            // Execute code in critical section to avoid DB concurrency
            dbCS.execute(() => {
                // Retrieve issued blockchain address doc/rec making sure that it is still expired
                const docIssuedAddr = Catenis.db.collection.IssuedBlockchainAddress.findOne({
                    _id: idDocToProcess,
                    status: 'expired'
                }, {
                    fields: {
                        _id: 1,
                        type: 1,
                        parentPath: 1,
                        path: 1,
                        addrIndex: 1,
                        btcAddressType: 1,
                        status: 1
                    }
                });

                if (docIssuedAddr) {
                    const issuedAddr = BaseBlockchainAddress.getAddressOfIssuedBlockchainAddress(docIssuedAddr);

                    if (issuedAddr && !BaseBlockchainAddress.isAddressWithBalance(issuedAddr)) {
                        // Issued blockchain address has no balance.
                        //  Set it as obsolete on local database
                        Catenis.db.collection.IssuedBlockchainAddress.update({
                            _id: docIssuedAddr._id
                        }, {
                            $set: {
                                status: 'obsolete',
                                lastStatusChangedDate: new Date()
                            }
                        });

                        // Also set address as obsolete on local key storage
                        Catenis.keyStore.setAddressAsObsolete(issuedAddr);

                        if (hasInstantiatedObject(docIssuedAddr.parentPath)) {
                            // Update address indices on corresponding blockchain address object if currently instantiated
                            updateInUseAddressIndices.call(getInstantiatedObject(docIssuedAddr.parentPath));
                        }
                    }
                }
            });
        }, updateIssuedAddressesPart2);
    }
    else {
        updateIssuedAddressesPart2();
    }
}

function updateIssuedAddressesPart2(error) {
    if (error) {
        Catenis.logger.ERROR('Error while executing process to update issued blockchain addresses.', error);
    }
    else {
        Catenis.logger.TRACE('Executing process to update issued blockchain addresses (part 2)');
        // Identify issued blockchain addresses doc/rec that should be expired
        const refDate = new Date();
        const idDocsToProcess = Catenis.db.collection.IssuedBlockchainAddress.find({
            status: 'new',
            expirationDate: {
                $lte: refDate
            }
        }, {
            fields: {
                _id: 1
            }
        }).fetch().map((doc) => doc._id);

        if (idDocsToProcess.length > 0) {
            Util.processItemsAsync(idDocsToProcess, (idDocToProcess, refDate) => {
                // Execute code in critical section to avoid DB concurrency
                dbCS.execute(() => {
                    // Retrieve issued blockchain address doc/rec making sure that it still should be expired
                    const docIssuedAddr = Catenis.db.collection.IssuedBlockchainAddress.findOne({
                        _id: idDocToProcess,
                        status: 'new',
                        expirationDate: {
                            $lte: refDate
                        }
                    }, {
                        fields: {
                            _id: 1,
                            type: 1,
                            parentPath: 1,
                            path: 1,
                            addrIndex: 1,
                            btcAddressType: 1,
                            status: 1
                        }
                    });

                    if (docIssuedAddr) {
                        const issuedAddr = BaseBlockchainAddress.getAddressOfIssuedBlockchainAddress(docIssuedAddr);

                        if (issuedAddr) {
                            if (!BaseBlockchainAddress.isAddressWithBalance(issuedAddr)) {
                                // Issued blockchain address has no balance.
                                //  Set it directly as obsolete on local database
                                Catenis.db.collection.IssuedBlockchainAddress.update({
                                    _id: docIssuedAddr._id
                                }, {
                                    $set: {
                                        status: 'obsolete',
                                        lastStatusChangedDate: new Date()
                                    }
                                });

                                // Also set address as obsolete on local key storage
                                Catenis.keyStore.setAddressAsObsolete(issuedAddr);

                                if (hasInstantiatedObject(docIssuedAddr.parentPath)) {
                                    // Update address indices on corresponding blockchain address object if currently instantiated
                                    updateInUseAddressIndices.call(getInstantiatedObject(docIssuedAddr.parentPath));
                                }
                            }
                            else {
                                // Set address as expired on local database
                                Catenis.db.collection.IssuedBlockchainAddress.update({
                                    _id: docIssuedAddr._id
                                }, {
                                    $set: {
                                        status: 'expired',
                                        lastStatusChangedDate: new Date()
                                    }
                                });
                            }
                        }
                    }
                });
            }, undefined, refDate, (error) => {
                if (error) {
                    Catenis.logger.ERROR('Error while executing process to update issued blockchain addresses (part 2).', error);
                }
            });
        }
    }
}

function hasInstantiatedObject(parentPath) {
    return BaseBlockchainAddress.instantiatedObjects.has(parentPath);
}

function setInstantiatedObject(parentPath, obj) {
    BaseBlockchainAddress.instantiatedObjects.set(parentPath, {obj: obj, lastAccessTimestamp: Date.now()});
}

function getInstantiatedObject(parentPath) {
    const objEntry = BaseBlockchainAddress.instantiatedObjects.get(parentPath);
    let obj = null;

    if (objEntry !== undefined) {
        obj = objEntry.obj;
        objEntry.lastAccessTimestamp = Date.now();
    }

    return obj;
}

function deleteInstantiatedObject(parentPath) {
    if (BaseBlockchainAddress.instantiatedObjects.delete(parentPath)) {
        // Also remove all child addresses from local key storage
        Catenis.keyStore.removeExtKeysByParentPath(parentPath);
    }
}


// Module code
//

// Build map of derives classes by address type
//
//  NOTE: this variable definition is here because it must
//      appear after the declaration of the derived classes
//
const classByType = {
    sys_dev_main_addr: BaseSystemDeviceMainAddress,
    sys_fund_pay_addr: BaseSystemFundingPaymentAddress,
    sys_fund_chg_addr: BaseSystemFundingChangeAddress,
    sys_pay_tx_exp_addr: BaseSystemPayTxExpenseAddress,
    sys_read_conf_spnd_ntfy_addr: BaseSystemReadConfirmSpendNotifyAddress,
    sys_read_conf_spnd_only_addr: BaseSystemReadConfirmSpendOnlyAddress,
    sys_read_conf_spnd_null_addr: BaseSystemReadConfirmSpendNullAddress,
    sys_read_conf_pay_tx_exp_addr: BaseSystemReadConfirmPayTxExpenseAddress,
    sys_serv_cred_issu_addr: BaseSystemServiceCreditIssuingAddress,
    sys_serv_pymt_pay_tx_exp_addr: BaseSystemServicePaymentPayTxExpenseAddress,
    sys_msig_sign_addr: BaseSystemMultiSigSigneeAddress,
    sys_oc_msgs_setlmt_pay_tx_exp_addr: BaseSystemOCMsgsSetlmtPayTxExpenseAddress,
    cln_srv_acc_cred_ln_addr: BaseClientServiceAccountCreditLineAddress,
    cln_srv_acc_debt_ln_addr: BaseClientServiceAccountDebitLineAddress,
    cln_bcot_pay_addr: BaseClientBcotPaymentAddress,
    dev_read_conf_addr: BaseDeviceReadConfirmAddress,
    dev_migr_asst_addr: BaseDeviceMigratedAssetAddress,
    dev_main_addr: BaseDeviceMainAddress,
    dev_asst_addr: BaseDeviceAssetAddress,
    dev_asst_issu_addr: BaseDeviceAssetIssuanceAddress
};

// Definition of properties
Object.defineProperties(BaseBlockchainAddress, {
    updtIssuedAddrsIntervalHandle: {
        get: function () {
            return updtIssuedAddrsIntervalHandle;
        },
        enumerable: true
    },
    delInactiveObjectsIntervalHandle: {
        get: function () {
            return delInactiveObjectsIntervalHandle;
        },
        enumerable: true
    }
});

// Lock function classes
Object.freeze(BaseBlockchainAddress);
Object.freeze(BaseSystemDeviceMainAddress);
Object.freeze(BaseSystemFundingPaymentAddress);
Object.freeze(BaseSystemFundingChangeAddress);
Object.freeze(BaseSystemPayTxExpenseAddress);
Object.freeze(BaseSystemReadConfirmSpendNotifyAddress);
Object.freeze(BaseSystemReadConfirmSpendOnlyAddress);
Object.freeze(BaseSystemReadConfirmSpendNullAddress);
Object.freeze(BaseSystemReadConfirmPayTxExpenseAddress);
Object.freeze(BaseSystemServiceCreditIssuingAddress);
Object.freeze(BaseSystemServicePaymentPayTxExpenseAddress);
Object.freeze(BaseSystemMultiSigSigneeAddress);
Object.freeze(BaseClientServiceAccountCreditLineAddress);
Object.freeze(BaseClientServiceAccountDebitLineAddress);
Object.freeze(BaseClientBcotPaymentAddress);
Object.freeze(BaseDeviceReadConfirmAddress);
Object.freeze(BaseDeviceMigratedAssetAddress);
Object.freeze(BaseDeviceMainAddress);
Object.freeze(BaseDeviceAssetAddress);
Object.freeze(BaseDeviceAssetIssuanceAddress);
