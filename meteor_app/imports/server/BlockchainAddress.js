/**
 * Created by Claudio on 2016-06-08.
 */

//console.log('[BlockchainAddress.js]: This code just ran.');
    
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

// Config entries
const configBcAddress = config.get('blockchainAddress'),
    configBcAddrValidity = configBcAddress.get('addressValidity');

// Configuration settings
const cfgSettings = {
    addressValidity: {
        systemDeviceMain: configBcAddrValidity.get('systemDeviceMain'),
        systemFundingPayment: configBcAddrValidity.get('systemFundingPayment'),
        systemFundingChange: configBcAddrValidity.get('systemFundingChange'),
        systemPayTxExpense: configBcAddrValidity.get('systemPayTxExpense'),
        systemReadConfSpendNotify: configBcAddrValidity.get('systemReadConfSpendNotify'),
        systemReadConfSpendOnly: configBcAddrValidity.get('systemReadConfSpendOnly'),
        systemReadConfSpendNull: configBcAddrValidity.get('systemReadConfSpendNull'),
        systemReadConfPayTxExpense: configBcAddrValidity.get('systemReadConfPayTxExpense'),
        systemServCredIssuing: configBcAddrValidity.get('systemServCredIssuing'),
        systemServPymtPayTxExpense: configBcAddrValidity.get('systemServPymtPayTxExpense'),
        systemMultiSigSignee: configBcAddrValidity.get('systemMultiSigSignee'),
        deviceReadConfirm: configBcAddrValidity.get('deviceReadConfirm'),
        clientServAccCreditLine: configBcAddrValidity.get('clientServAccCreditLine'),
        clientServAccDebitLine: configBcAddrValidity.get('clientServAccDebitLine'),
        clientBcotPayment: configBcAddrValidity.get('clientBcotPayment'),
        deviceMain: configBcAddrValidity.get('deviceMain'),
        deviceAsset: configBcAddrValidity.get('deviceAsset'),
        deviceAssetIssuance: configBcAddrValidity.get('deviceAssetIssuance')
    },
    updateIssuedAddressesInterval: configBcAddress.get('updateIssuedAddressesInterval'),
    inactiveObjectTime: configBcAddress.get('inactiveObjectTime'),
    deleteInactiveObjectsInterval: configBcAddress.get('deleteInactiveObjectsInterval')
};

// Critical section object to avoid concurrent access to database
const dbCS = new CriticalSection();

let updtIssuedAddrsIntervalHandle,
    delInactiveObjectsIntervalHandle;


// Definition of function classes
//

// SystemDeviceMainAddress derived class
export class SystemDeviceMainAddress extends BlockchainAddress {
    constructor (ctnNodeIndex) {
        super();
        this.type = KeyStore.extKeyType.sys_dev_main_addr.name;
        this.parentPath = KeyStore.systemDeviceMainAddressRootPath(ctnNodeIndex);

        // Make sure that an object of this class has not been instantiated yet
        if (hasInstantiatedObject(this.parentPath)) {
            Catenis.logger.ERROR(util.format('SystemDeviceMainAddress object for the given Catenis node index (%d) has already been instantiated', ctnNodeIndex));
            throw new Error(util.format('SystemDeviceMainAddress object for the given Catenis node index (%d) has already been instantiated', ctnNodeIndex));
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

    // Get instance of this class
    //
    //  ctnNodeIndex: [integer]
    //                or
    //                {  // Options object
    //      ctnNodeIndex: [integer]
    //  }
    //
    static getInstance(ctnNodeIndex) {
        if (typeof ctnNodeIndex === 'object') {
            // Options object passed instead of plain arguments
            ctnNodeIndex = ctnNodeIndex.ctnNodeIndex;
        }

        // Check if an instance of this class has already been instantiated
        const parentPath = KeyStore.systemDeviceMainAddressRootPath(ctnNodeIndex);

        return hasInstantiatedObject(parentPath) ? getInstantiatedObject(parentPath)
            : new SystemDeviceMainAddress(ctnNodeIndex);
    }
}

// SystemFundingPaymentAddress derived class
export class SystemFundingPaymentAddress extends BlockchainAddress {
    constructor (ctnNodeIndex) {
        super();
        this.type = KeyStore.extKeyType.sys_fund_pay_addr.name;
        this.parentPath = KeyStore.systemFundingPaymentRootPath(ctnNodeIndex);

        // Make sure that an object of this class has not been instantiated yet
        if (hasInstantiatedObject(this.parentPath)) {
            Catenis.logger.ERROR(util.format('SystemFundingPaymentAddress object for the given Catenis node index (%d) has already been instantiated', ctnNodeIndex));
            throw new Error(util.format('SystemFundingPaymentAddress object for the given Catenis node index (%d) has already been instantiated', ctnNodeIndex));
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
    static getInstance(ctnNodeIndex) {
        if (typeof ctnNodeIndex === 'object') {
            // Options object passed instead of plain arguments
            ctnNodeIndex = ctnNodeIndex.ctnNodeIndex;
        }

        // Check if an instance of this class has already been instantiated
        const parentPath = KeyStore.systemFundingPaymentRootPath(ctnNodeIndex);

        return hasInstantiatedObject(parentPath) ? getInstantiatedObject(parentPath)
                : new SystemFundingPaymentAddress(ctnNodeIndex);
    }
}

// SystemFundingChangeAddress derived class
export class SystemFundingChangeAddress extends BlockchainAddress {
    constructor (ctnNodeIndex) {
        super();
        this.type = KeyStore.extKeyType.sys_fund_chg_addr.name;
        this.parentPath = KeyStore.systemFundingChangeRootPath(ctnNodeIndex);

        // Make sure that an object of this class has not been instantiated yet
        if (hasInstantiatedObject(this.parentPath)) {
            Catenis.logger.ERROR(util.format('SystemFundingChangeAddress object for the given Catenis node index (%d) has already been instantiated', ctnNodeIndex));
            throw new Error(util.format('SystemFundingChangeAddress object for the given Catenis node index (%d) has already been instantiated', ctnNodeIndex));
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
    static getInstance(ctnNodeIndex) {
        if (typeof ctnNodeIndex === 'object') {
            // Options object passed instead of plain arguments
            ctnNodeIndex = ctnNodeIndex.ctnNodeIndex;
        }

        // Check if an instance of this class has already been instantiated
        const parentPath = KeyStore.systemFundingChangeRootPath(ctnNodeIndex);

        return hasInstantiatedObject(parentPath) ? getInstantiatedObject(parentPath)
            : new SystemFundingChangeAddress(ctnNodeIndex);
    }
}

// SystemPayTxExpenseAddress derived class
export class SystemPayTxExpenseAddress extends BlockchainAddress {
    constructor (ctnNodeIndex) {
        super();
        this.type = KeyStore.extKeyType.sys_pay_tx_exp_addr.name;
        this.parentPath = KeyStore.systemPayTxExpenseRootPath(ctnNodeIndex);

        // Make sure that an object of this class has not been instantiated yet
        if (hasInstantiatedObject(this.parentPath)) {
            Catenis.logger.ERROR(util.format('SystemPayTxExpenseAddress object for the given Catenis node index (%d) has already been instantiated', ctnNodeIndex));
            throw new Error(util.format('SystemPayTxExpenseAddress object for the given Catenis node index (%d) has already been instantiated', ctnNodeIndex));
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
    static getInstance(ctnNodeIndex) {
        if (typeof ctnNodeIndex === 'object') {
            // Options object passed instead of plain arguments
            ctnNodeIndex = ctnNodeIndex.ctnNodeIndex;
        }

        // Check if an instance of this class has already been instantiated
        const parentPath = KeyStore.systemPayTxExpenseRootPath(ctnNodeIndex);

        return hasInstantiatedObject(parentPath) ? getInstantiatedObject(parentPath)
            : new SystemPayTxExpenseAddress(ctnNodeIndex);
    }
}

// SystemReadConfirmSpendNotifyAddress derived class
export class SystemReadConfirmSpendNotifyAddress extends BlockchainAddress {
    constructor (ctnNodeIndex) {
        super();
        this.type = KeyStore.extKeyType.sys_read_conf_spnd_ntfy_addr.name;
        this.parentPath = KeyStore.systemReadConfirmSpendNotifyRootPath(ctnNodeIndex);

        // Make sure that an object of this class has not been instantiated yet
        if (hasInstantiatedObject(this.parentPath)) {
            Catenis.logger.ERROR(util.format('SystemReadConfirmSpendNotifyAddress object for the given Catenis node index (%d) has already been instantiated', ctnNodeIndex));
            throw new Error(util.format('SystemReadConfirmSpendNotifyAddress object for the given Catenis node index (%d) has already been instantiated', ctnNodeIndex));
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
    static getInstance(ctnNodeIndex) {
        if (typeof ctnNodeIndex === 'object') {
            // Options object passed instead of plain arguments
            ctnNodeIndex = ctnNodeIndex.ctnNodeIndex;
        }

        // Check if an instance of this class has already been instantiated
        const parentPath = KeyStore.systemReadConfirmSpendNotifyRootPath(ctnNodeIndex);

        return hasInstantiatedObject(parentPath) ? getInstantiatedObject(parentPath)
            : new SystemReadConfirmSpendNotifyAddress(ctnNodeIndex);
    }
}

// SystemReadConfirmSpendOnlyAddress derived class
export class SystemReadConfirmSpendOnlyAddress extends BlockchainAddress {
    constructor (ctnNodeIndex) {
        super();
        this.type = KeyStore.extKeyType.sys_read_conf_spnd_only_addr.name;
        this.parentPath = KeyStore.systemReadConfirmSpendOnlyRootPath(ctnNodeIndex);

        // Make sure that an object of this class has not been instantiated yet
        if (hasInstantiatedObject(this.parentPath)) {
            Catenis.logger.ERROR(util.format('SystemReadConfirmSpendOnlyAddress object for the given Catenis node index (%d) has already been instantiated', ctnNodeIndex));
            throw new Error(util.format('SystemReadConfirmSpendOnlyAddress object for the given Catenis node index (%d) has already been instantiated', ctnNodeIndex));
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
    static getInstance(ctnNodeIndex) {
        if (typeof ctnNodeIndex === 'object') {
            // Options object passed instead of plain arguments
            ctnNodeIndex = ctnNodeIndex.ctnNodeIndex;
        }

        // Check if an instance of this class has already been instantiated
        const parentPath = KeyStore.systemReadConfirmSpendOnlyRootPath(ctnNodeIndex);

        return hasInstantiatedObject(parentPath) ? getInstantiatedObject(parentPath)
            : new SystemReadConfirmSpendOnlyAddress(ctnNodeIndex);
    }
}

// SystemReadConfirmSpendNullAddress derived class
export class SystemReadConfirmSpendNullAddress extends BlockchainAddress {
    constructor (ctnNodeIndex) {
        super();
        this.type = KeyStore.extKeyType.sys_read_conf_spnd_null_addr.name;
        this.parentPath = KeyStore.systemReadConfirmSpendNullRootPath(ctnNodeIndex);

        // Make sure that an object of this class has not been instantiated yet
        if (hasInstantiatedObject(this.parentPath)) {
            Catenis.logger.ERROR(util.format('SystemReadConfirmSpendNullAddress object for the given Catenis node index (%d) has already been instantiated', ctnNodeIndex));
            throw new Error(util.format('SystemReadConfirmSpendNullAddress object for the given Catenis node index (%d) has already been instantiated', ctnNodeIndex));
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
    static getInstance(ctnNodeIndex) {
        if (typeof ctnNodeIndex === 'object') {
            // Options object passed instead of plain arguments
            ctnNodeIndex = ctnNodeIndex.ctnNodeIndex;
        }

        // Check if an instance of this class has already been instantiated
        const parentPath = KeyStore.systemReadConfirmSpendNullRootPath(ctnNodeIndex);

        return hasInstantiatedObject(parentPath) ? getInstantiatedObject(parentPath)
            : new SystemReadConfirmSpendNullAddress(ctnNodeIndex);
    }
}

// SystemReadConfirmPayTxExpenseAddress derived class
export class SystemReadConfirmPayTxExpenseAddress extends BlockchainAddress {
    constructor (ctnNodeIndex) {
        super();
        this.type = KeyStore.extKeyType.sys_read_conf_pay_tx_exp_addr.name;
        this.parentPath = KeyStore.systemReadConfirmPayTxExpenseRootPath(ctnNodeIndex);

        // Make sure that an object of this class has not been instantiated yet
        if (hasInstantiatedObject(this.parentPath)) {
            Catenis.logger.ERROR(util.format('SystemReadConfirmPayTxExpenseAddress object for the given Catenis node index (%d) has already been instantiated', ctnNodeIndex));
            throw new Error(util.format('SystemReadConfirmPayTxExpenseAddress object for the given Catenis node index (%d) has already been instantiated', ctnNodeIndex));
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
    static getInstance(ctnNodeIndex) {
        if (typeof ctnNodeIndex === 'object') {
            // Options object passed instead of plain arguments
            ctnNodeIndex = ctnNodeIndex.ctnNodeIndex;
        }

        // Check if an instance of this class has already been instantiated
        const parentPath = KeyStore.systemReadConfirmPayTxExpenseRootPath(ctnNodeIndex);

        return hasInstantiatedObject(parentPath) ? getInstantiatedObject(parentPath)
            : new SystemReadConfirmPayTxExpenseAddress(ctnNodeIndex);
    }
}

// SystemServiceCreditIssuingAddress derived class
export class SystemServiceCreditIssuingAddress extends BlockchainAddress {
    constructor (ctnNodeIndex) {
        super();
        this.type = KeyStore.extKeyType.sys_serv_cred_issu_addr.name;
        this.parentPath = KeyStore.systemServiceCreditIssuingRootPath(ctnNodeIndex);

        // Make sure that an object of this class has not been instantiated yet
        if (hasInstantiatedObject(this.parentPath)) {
            Catenis.logger.ERROR(util.format('SystemServiceCreditIssuingAddress object for the given Catenis node index (%d) has already been instantiated', ctnNodeIndex));
            throw new Error(util.format('SystemServiceCreditIssuingAddress object for the given Catenis node index (%d) has already been instantiated', ctnNodeIndex));
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
    static getInstance(ctnNodeIndex) {
        if (typeof ctnNodeIndex === 'object') {
            // Options object passed instead of plain arguments
            ctnNodeIndex = ctnNodeIndex.ctnNodeIndex;
        }

        // Check if an instance of this class has already been instantiated
        const parentPath = KeyStore.systemServiceCreditIssuingRootPath(ctnNodeIndex);

        return hasInstantiatedObject(parentPath) ? getInstantiatedObject(parentPath)
            : new SystemServiceCreditIssuingAddress(ctnNodeIndex);
    }
}

// SystemServicePaymentPayTxExpenseAddress derived class
export class SystemServicePaymentPayTxExpenseAddress extends BlockchainAddress {
    constructor (ctnNodeIndex) {
        super();
        this.type = KeyStore.extKeyType.sys_serv_pymt_pay_tx_exp_addr.name;
        this.parentPath = KeyStore.systemServicePaymentPayTxExpenseRootPath(ctnNodeIndex);

        // Make sure that an object of this class has not been instantiated yet
        if (hasInstantiatedObject(this.parentPath)) {
            Catenis.logger.ERROR(util.format('SystemServicePaymentPayTxExpenseAddress object for the given Catenis node index (%d) has already been instantiated', ctnNodeIndex));
            throw new Error(util.format('SystemServicePaymentPayTxExpenseAddress object for the given Catenis node index (%d) has already been instantiated', ctnNodeIndex));
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
    static getInstance(ctnNodeIndex) {
        if (typeof ctnNodeIndex === 'object') {
            // Options object passed instead of plain arguments
            ctnNodeIndex = ctnNodeIndex.ctnNodeIndex;
        }

        // Check if an instance of this class has already been instantiated
        const parentPath = KeyStore.systemServicePaymentPayTxExpenseRootPath(ctnNodeIndex);

        return hasInstantiatedObject(parentPath) ? getInstantiatedObject(parentPath)
            : new SystemServicePaymentPayTxExpenseAddress(ctnNodeIndex);
    }
}

// SystemMultiSigSigneeAddress derived class
export class SystemMultiSigSigneeAddress extends BlockchainAddress {
    constructor (ctnNodeIndex) {
        super();
        this.type = KeyStore.extKeyType.sys_msig_sign_addr.name;
        this.parentPath = KeyStore.systemMultiSigSigneeRootPath(ctnNodeIndex);

        // Make sure that an object of this class has not been instantiated yet
        if (hasInstantiatedObject(this.parentPath)) {
            Catenis.logger.ERROR(util.format('SystemMultiSigSigneeAddress object for the given Catenis node index (%d) has already been instantiated', ctnNodeIndex));
            throw new Error(util.format('SystemMultiSigSigneeAddress object for the given Catenis node index (%d) has already been instantiated', ctnNodeIndex));
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
    static getInstance(ctnNodeIndex) {
        if (typeof ctnNodeIndex === 'object') {
            // Options object passed instead of plain arguments
            ctnNodeIndex = ctnNodeIndex.ctnNodeIndex;
        }

        // Check if an instance of this class has already been instantiated
        const parentPath = KeyStore.systemMultiSigSigneeRootPath(ctnNodeIndex);

        return hasInstantiatedObject(parentPath) ? getInstantiatedObject(parentPath)
            : new SystemMultiSigSigneeAddress(ctnNodeIndex);
    }
}

// ClientServiceAccountCreditLineAddress derived class
export class ClientServiceAccountCreditLineAddress extends BlockchainAddress {
    constructor (ctnNodeIndex, clientIndex) {
        super();
        this.type = KeyStore.extKeyType.cln_srv_acc_cred_ln_addr.name;
        this.parentPath = KeyStore.clientServiceAccountCreditLineAddressRootPath(ctnNodeIndex, clientIndex);

        // Make sure that an object of this class has not been instantiated yet
        if (hasInstantiatedObject(this.parentPath)) {
            Catenis.logger.ERROR(util.format('ClientServiceAccountCreditLineAddress object for the given Catenis node and client indices (%d and %d, respectively) has already been instantiated', ctnNodeIndex, clientIndex));
            throw new Error(util.format('ClientServiceAccountCreditLineAddress object for the given Catenis node and client indices (%d and %d, respectively) has already been instantiated', ctnNodeIndex, clientIndex));
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
    static getInstance(ctnNodeIndex, clientIndex) {
        if (typeof ctnNodeIndex === 'object') {
            // Options object passed instead of plain arguments
            clientIndex = ctnNodeIndex.clientIndex;
            ctnNodeIndex = ctnNodeIndex.ctnNodeIndex;
        }

        // Check if an instance of this class has already been instantiated
        const parentPath = KeyStore.clientServiceAccountCreditLineAddressRootPath(ctnNodeIndex, clientIndex);

        return hasInstantiatedObject(parentPath) ? getInstantiatedObject(parentPath)
            : new ClientServiceAccountCreditLineAddress(ctnNodeIndex, clientIndex);
    }
}

// ClientServiceAccountDebitLineAddress derived class
export class ClientServiceAccountDebitLineAddress extends BlockchainAddress {
    constructor (ctnNodeIndex, clientIndex) {
        super();
        this.type = KeyStore.extKeyType.cln_srv_acc_debt_ln_addr.name;
        this.parentPath = KeyStore.clientServiceAccountDebitLineAddressRootPath(ctnNodeIndex, clientIndex);

        // Make sure that an object of this class has not been instantiated yet
        if (hasInstantiatedObject(this.parentPath)) {
            Catenis.logger.ERROR(util.format('ClientServiceAccountDebitLineAddress object for the given Catenis node and client indices (%d and %d, respectively) has already been instantiated', ctnNodeIndex, clientIndex));
            throw new Error(util.format('ClientServiceAccountDebitLineAddress object for the given Catenis node and client indices (%d and %d, respectively) has already been instantiated', ctnNodeIndex, clientIndex));
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
    static getInstance(ctnNodeIndex, clientIndex) {
        if (typeof ctnNodeIndex === 'object') {
            // Options object passed instead of plain arguments
            clientIndex = ctnNodeIndex.clientIndex;
            ctnNodeIndex = ctnNodeIndex.ctnNodeIndex;
        }

        // Check if an instance of this class has already been instantiated
        const parentPath = KeyStore.clientServiceAccountDebitLineAddressRootPath(ctnNodeIndex, clientIndex);

        return hasInstantiatedObject(parentPath) ? getInstantiatedObject(parentPath)
            : new ClientServiceAccountDebitLineAddress(ctnNodeIndex, clientIndex);
    }
}

// ClientBcotPaymentAddress derived class
export class ClientBcotPaymentAddress extends BlockchainAddress {
    constructor (ctnNodeIndex, clientIndex) {
        super();
        this.type = KeyStore.extKeyType.cln_bcot_pay_addr.name;
        this.parentPath = KeyStore.clientBcotPaymentAddressRootPath(ctnNodeIndex, clientIndex);

        // Make sure that an object of this class has not been instantiated yet
        if (hasInstantiatedObject(this.parentPath)) {
            Catenis.logger.ERROR(util.format('ClientBcotPaymentAddress object for the given Catenis node and client indices (%d and %d, respectively) has already been instantiated', ctnNodeIndex, clientIndex));
            throw new Error(util.format('ClientBcotPaymentAddress object for the given Catenis node and client indices (%d and %d, respectively) has already been instantiated', ctnNodeIndex, clientIndex));
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
        const addrKeys = Object.getPrototypeOf(ClientBcotPaymentAddress.prototype).newAddressKeys.call(this);

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
    static getInstance(ctnNodeIndex, clientIndex) {
        if (typeof ctnNodeIndex === 'object') {
            // Options object passed instead of plain arguments
            clientIndex = ctnNodeIndex.clientIndex;
            ctnNodeIndex = ctnNodeIndex.ctnNodeIndex;
        }

        // Check if an instance of this class has already been instantiated
        const parentPath = KeyStore.clientBcotPaymentAddressRootPath(ctnNodeIndex, clientIndex);

        return hasInstantiatedObject(parentPath) ? getInstantiatedObject(parentPath)
            : new ClientBcotPaymentAddress(ctnNodeIndex, clientIndex);
    }
}

// DeviceReadConfirmAddress derived class
export class DeviceReadConfirmAddress extends BlockchainAddress {
    constructor (ctnNodeIndex, clientIndex, deviceIndex) {
        super();
        this.type = KeyStore.extKeyType.dev_read_conf_addr.name;
        this.parentPath = KeyStore.deviceReadConfirmAddressRootPath(ctnNodeIndex, clientIndex, deviceIndex);

        // Make sure that an object of this class has not been instantiated yet
        if (hasInstantiatedObject(this.parentPath)) {
            Catenis.logger.ERROR(util.format('DeviceReadConfirmAddress object for the given Catenis node, client and device indices (%d, %d and %d, respectively) has already been instantiated', ctnNodeIndex, clientIndex, deviceIndex));
            throw new Error(util.format('DeviceReadConfirmAddress object for the given Catenis node, client and device indices (%d, %d and %d, respectively) has already been instantiated', ctnNodeIndex, clientIndex, deviceIndex));
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
    static getInstance(ctnNodeIndex, clientIndex, deviceIndex) {
        if (typeof ctnNodeIndex === 'object') {
            // Options object passed instead of plain arguments
            deviceIndex = ctnNodeIndex.deviceIndex;
            clientIndex = ctnNodeIndex.clientIndex;
            ctnNodeIndex = ctnNodeIndex.ctnNodeIndex;
        }

        // Check if an instance of this class has already been instantiated
        const parentPath = KeyStore.deviceReadConfirmAddressRootPath(ctnNodeIndex, clientIndex, deviceIndex);

        return hasInstantiatedObject(parentPath) ? getInstantiatedObject(parentPath)
            : new DeviceReadConfirmAddress(ctnNodeIndex, clientIndex, deviceIndex);
    }
}

// DeviceMainAddress derived class
export class DeviceMainAddress extends BlockchainAddress {
    constructor (ctnNodeIndex, clientIndex, deviceIndex) {
        super();
        this.type = KeyStore.extKeyType.dev_main_addr.name;
        this.parentPath = KeyStore.deviceMainAddressRootPath(ctnNodeIndex, clientIndex, deviceIndex);

        // Make sure that an object of this class has not been instantiated yet
        if (hasInstantiatedObject(this.parentPath)) {
            Catenis.logger.ERROR(util.format('DeviceMainAddress object for the given Catenis node, client and device indices (%d, %d and %d, respectively) has already been instantiated', ctnNodeIndex, clientIndex, deviceIndex));
            throw new Error(util.format('DeviceMainAddress object for the given Catenis node, client and device indices (%d, %d and %d, respectively) has already been instantiated', ctnNodeIndex, clientIndex, deviceIndex));
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
    static getInstance(ctnNodeIndex, clientIndex, deviceIndex) {
        if (typeof ctnNodeIndex === 'object') {
            // Options object passed instead of plain arguments
            deviceIndex = ctnNodeIndex.deviceIndex;
            clientIndex = ctnNodeIndex.clientIndex;
            ctnNodeIndex = ctnNodeIndex.ctnNodeIndex;
        }

        // Check if an instance of this class has already been instantiated
        const parentPath = KeyStore.deviceMainAddressRootPath(ctnNodeIndex, clientIndex, deviceIndex);

        return hasInstantiatedObject(parentPath) ? getInstantiatedObject(parentPath)
            : new DeviceMainAddress(ctnNodeIndex, clientIndex, deviceIndex);
    }
}

// DeviceAssetAddress derived class
export class DeviceAssetAddress extends BlockchainAddress {
    constructor (ctnNodeIndex, clientIndex, deviceIndex) {
        super();
        this.type = KeyStore.extKeyType.dev_asst_addr.name;
        this.parentPath = KeyStore.deviceAssetAddressRootPath(ctnNodeIndex, clientIndex, deviceIndex);

        // Make sure that an object of this class has not been instantiated yet
        if (hasInstantiatedObject(this.parentPath)) {
            Catenis.logger.ERROR(util.format('DeviceAssetAddress object for the given Catenis node, client and device indices (%d, %d and %d, respectively) has already been instantiated', ctnNodeIndex, clientIndex, deviceIndex));
            throw new Error(util.format('DeviceAssetAddress object for the given Catenis node, client and device indices (%d, %d and %d, respectively) has already been instantiated', ctnNodeIndex, clientIndex, deviceIndex));
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
    static getInstance(ctnNodeIndex, clientIndex, deviceIndex) {
        if (typeof ctnNodeIndex === 'object') {
            // Options object passed instead of plain arguments
            deviceIndex = ctnNodeIndex.deviceIndex;
            clientIndex = ctnNodeIndex.clientIndex;
            ctnNodeIndex = ctnNodeIndex.ctnNodeIndex;
        }

        // Check if an instance of this class has already been instantiated
        const parentPath = KeyStore.deviceAssetAddressRootPath(ctnNodeIndex, clientIndex, deviceIndex);

        return hasInstantiatedObject(parentPath) ? getInstantiatedObject(parentPath)
            : new DeviceAssetAddress(ctnNodeIndex, clientIndex, deviceIndex);
    }
}

// DeviceAssetIssuanceAddress derived class
export class DeviceAssetIssuanceAddress extends BlockchainAddress {
    constructor (ctnNodeIndex, clientIndex, deviceIndex) {
        super();
        this.type = KeyStore.extKeyType.dev_asst_issu_addr.name;
        this.parentPath = KeyStore.deviceAssetIssuanceAddressRootPath(ctnNodeIndex, clientIndex, deviceIndex);

        // Make sure that an object of this class has not been instantiated yet
        if (hasInstantiatedObject(this.parentPath)) {
            Catenis.logger.ERROR(util.format('DeviceAssetIssuanceAddress object for the given Catenis node, client and device indices (%d, %d and %d, respectively) has already been instantiated', ctnNodeIndex, clientIndex, deviceIndex));
            throw new Error(util.format('DeviceAssetIssuanceAddress object for the given Catenis node, client and device indices (%d, %d and %d, respectively) has already been instantiated', ctnNodeIndex, clientIndex, deviceIndex));
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
    static getInstance(ctnNodeIndex, clientIndex, deviceIndex) {
        if (typeof ctnNodeIndex === 'object') {
            // Options object passed instead of plain arguments
            deviceIndex = ctnNodeIndex.deviceIndex;
            clientIndex = ctnNodeIndex.clientIndex;
            ctnNodeIndex = ctnNodeIndex.ctnNodeIndex;
        }

        // Check if an instance of this class has already been instantiated
        const parentPath = KeyStore.deviceAssetIssuanceAddressRootPath(ctnNodeIndex, clientIndex, deviceIndex);

        return hasInstantiatedObject(parentPath) ? getInstantiatedObject(parentPath)
            : new DeviceAssetIssuanceAddress(ctnNodeIndex, clientIndex, deviceIndex);
    }
}

// BlockchainAddress function class
export function BlockchainAddress() {
    this.type = undefined;
    this.parentPath = undefined;
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


// Public BlockchainAddress object methods
//

BlockchainAddress.prototype.newAddressKeys = function () {
    let addrKeys = null;

    // Execute code in critical section to avoid DB concurrency
    dbCS.execute(() => {
        // Try to get next address
        const nonexistIndices = [];

        do {
            if ((addrKeys = this._getAddressKeys(++this.lastIssuedAddrIndex)) === null) {
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

BlockchainAddress.prototype.listAddressesInUse = function () {
    return this.firstInUseAddrIndex >= 0 && this.lastInUseAddrIndex >= 0 ? this._listAddressesInUse(this.firstInUseAddrIndex, this.lastInUseAddrIndex) : [];
};

BlockchainAddress.prototype.lastAddressKeys = function () {
    return this.lastInUseAddrIndex >= 0 ? this._getAddressKeys(this.lastInUseAddrIndex) : this.newAddressKeys();
};


// Module functions used to simulate private BlockchainAddress object methods
//  NOTE: these functions need to be bound to a BlockchainAddress object reference (this) before
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
                    status: 1
                },
                sort: {
                    adrrIndex: 1
                }
            }).fetch().forEach((doc) => {
                if (doc.status !== 'obsolete') {
                    this._getAddressKeys(doc.addrIndex);
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
    if (addrIndex >= 0 && addrIndex === this.lastIssuedAddrIndex && addrIndex === this.lastInUseAddrIndex && (balanceChecked || !BlockchainAddress.isAddressWithBalance(address))) {
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


// BlockchainAddress function class (public) methods
//

BlockchainAddress.initialize = function () {
    Catenis.logger.TRACE('BlockchainAddress initialization');
    // Update issued blockchain addresses now, and set recurring timer
    //  to update issued blockchain addresses periodically later
    updateIssuedAddresses();
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
BlockchainAddress.getInstance = function (opts) {
    // Call getInstance method of corresponding derived class
    let drvClass,
        classInstance = null;

    if ((drvClass = classByType[opts.type]) !== undefined) {
        classInstance = drvClass.getInstance(opts.pathParts);
    }

    return classInstance;
};

// Check whether address has balance (there is any UTXO associated with it)
BlockchainAddress.isAddressWithBalance = function (addr) {
    // Check if any UTXOs associated with address is locked
    const hasLockedTxOuts = Catenis.bitcoinCore.listLockUnspent().some((lockTxOut) => {
        const txOutInfo = Catenis.bitcoinCore.getTxOut(lockTxOut.txid, lockTxOut.vout);

        return txOutInfo !== null && 'scriptPubKey' in txOutInfo && 'addresses' in txOutInfo.scriptPubKey
            && txOutInfo.scriptPubKey.addresses.some((txOutAddr) => {
                return txOutAddr === addr;
            });
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
BlockchainAddress.checkAddressesWithBalance = function (addrList) {
    // Identify addresses that have locked UTXOs
    const lockedAddresses = new Set();

    Catenis.bitcoinCore.listLockUnspent().forEach((lockTxOut) => {
        let txOutInfo = Catenis.bitcoinCore.getTxOut(lockTxOut.txid, lockTxOut.vout);

        if (txOutInfo !== null && 'scriptPubKey' in txOutInfo && 'addresses' in txOutInfo.scriptPubKey) {
            txOutInfo.scriptPubKey.addresses.forEach((txOutAddr) => {
                lockedAddresses.add(txOutAddr);
            });
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
BlockchainAddress.getAddressOfIssuedBlockchainAddress = function (docIssuedAddr) {
    // Try to retrieve address crypto keys from local key storage
    let addrKeys = Catenis.keyStore.getCryptoKeysByPath(docIssuedAddr.path);

    if (addrKeys === null) {
        // Crypto keys of issued address is not yet in local storage.
        //  Bring it up
        const classInstance = BlockchainAddress.getInstance({type: docIssuedAddr.type, pathParts: KeyStore.getPathParts(docIssuedAddr)});

        if (classInstance !== null) {
            // Store address in local key storage setting it as obsolete accordingly,
            //  and get its corresponding crypto keys
            addrKeys = classInstance._getAddressKeys(docIssuedAddr.addrIndex, docIssuedAddr.status === 'obsolete');
        }
    }

    return addrKeys !== null ? addrKeys.getAddress() : null;
};

// Place obsolete address back onto local key storage
BlockchainAddress.retrieveObsoleteAddress = function (addr, checkAddressInUse = false) {
    // Try to retrieve obsolete address from database
    const docIssuedAddrs = Catenis.db.collection.IssuedBlockchainAddress.find({addrHash: hashAddress(addr), status: 'obsolete'}, {fields: {type: 1, path: 1, addrIndex: 1}}).fetch();
    let result = false;

    if (docIssuedAddrs.length > 0) {
        if (docIssuedAddrs.length === 1) {
            // Only one doc/rec returned
            let docIssuedAddr = docIssuedAddrs[0],
                addrKeys = Catenis.keyStore.getCryptoKeysByPath(docIssuedAddr.path);

            // Make sure that address is not yet in local key storage
            if (addrKeys === null) {
                let classInstance = BlockchainAddress.getInstance({type: docIssuedAddr.type, pathParts: KeyStore.getPathParts(docIssuedAddr)});

                if (classInstance !== null) {
                    // Store address in local key storage making sure that it is set as obsolete,
                    //  and get its corresponding crypto keys
                    let addrKeys = classInstance._getAddressKeys(docIssuedAddr.addrIndex, true);

                    if (addrKeys !== null) {
                        // Make sure that this is the correct address (though unlikely, not impossible
                        //  since there could be one or more addresses with the same hash)
                        if (addrKeys.getAddress() === addr) {
                            result = true;

                            // Check if address is in use
                            if (checkAddressInUse && BlockchainAddress.isAddressWithBalance(addr)) {
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
        }
        else {
            // More than one doc/rec returned (though unlikely, not impossible since there could
            //  be one or more addresses with the same hash).
            //  Find the one that has the correct address
            if (docIssuedAddrs.find((docIssuedAddr) => {
                    let addrKeys = Catenis.keyStore.getCryptoKeysByPath(docIssuedAddr.path);

                    // Make sure that address is not yet in local key storage
                    if (addrKeys === null) {
                        let classInstance = BlockchainAddress.getInstance({type: docIssuedAddr.type, pathParts: KeyStore.getPathParts(docIssuedAddr)}),
                            found = false;

                        if (classInstance !== null) {
                            // Store address in local key storage making sure that it is set as obsolete,
                            //  and get its corresponding crypto keys
                            let addrKeys = classInstance._getAddressKeys(docIssuedAddr.addrIndex, true);

                            if (addrKeys !== null) {
                                // Make sure that this is the correct address (though unlikely, not impossible
                                //  since there could be one or more addresses with the same hash)
                                if (addrKeys.getAddress() === addr) {
                                    found = true;

                                    // Check if address is in use
                                    if (checkAddressInUse && BlockchainAddress.isAddressWithBalance(addr)) {
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

                        return found;
                    }
                }) !== undefined) {
                result = true;
            }
        }
    }

    return result;
};

// Place obsolete address back onto local key storage
BlockchainAddress.retrieveObsoleteAddressByPath = function (addrPath, checkAddressInUse = false) {
    let result = false;

    // Try to retrieve obsolete address from database
    const docIssuedAddr = Catenis.db.collection.IssuedBlockchainAddress.findOne({
        path: addrPath,
        status: 'obsolete'
    }, {
        fields: {
            type: 1,
            path: 1,
            addrIndex: 1
        }
    });

    if (docIssuedAddr) {
        // Only one doc/rec returned
        const addrKeys = Catenis.keyStore.getCryptoKeysByPath(addrPath);

        // Make sure that address is not yet in local key storage
        if (addrKeys === null) {
            let classInstance = BlockchainAddress.getInstance({type: docIssuedAddr.type, pathParts: KeyStore.getPathParts(docIssuedAddr)});

            if (classInstance !== null) {
                // Store address in local key storage making sure that it is set as obsolete,
                //  and get its corresponding crypto keys
                const addrKeys = classInstance._getAddressKeys(docIssuedAddr.addrIndex, true);

                if (addrKeys !== null) {
                    result = true;

                    if (checkAddressInUse) {
                        const addr = addrKeys.getAddress();

                        // Check if address is in use
                        if (BlockchainAddress.isAddressWithBalance(addr)) {
                            // If so, reset address status back to expired
                            resetObsoleteAddress.call(classInstance, addr, docIssuedAddr);
                        }
                    }
                }
            }
        }
    }

    return result;
};

BlockchainAddress.revertAddress = function (addr) {
    const addrTypeAndPath = Catenis.keyStore.getTypeAndPathByAddress(addr);
    let result = false;

    if (addrTypeAndPath !== null) {
        let addrPathParts = KeyStore.getPathParts(addrTypeAndPath),
            classInstance = BlockchainAddress.getInstance({type: addrTypeAndPath.type, pathParts: addrPathParts});

        if (classInstance !== null) {
            // Revert address
            result = revertAddress.call(classInstance, addr, addrPathParts.addrIndex);
        }
    }

    return result;
};

// Check if address marked as obsolete is in use and reset its status if so
BlockchainAddress.checkObsoleteAddress = function (addr) {
    let addrTypeAndPath = Catenis.keyStore.getTypeAndPathByAddress(addr),
        result = false;

    if (addrTypeAndPath !== null) {
        let docIssuedAddr = Catenis.db.collection.IssuedBlockchainAddress.findOne({path: addrTypeAndPath.path});

        if (docIssuedAddr !== undefined && docIssuedAddr.status === 'obsolete' && BlockchainAddress.isAddressWithBalance(addr)) {
            let addrPathParts = KeyStore.getPathParts(addrTypeAndPath),
                classInstance = BlockchainAddress.getInstance({type: addrTypeAndPath.type, pathParts: addrPathParts});

            resetObsoleteAddress.call(classInstance, addr, docIssuedAddr);

            result = true;
        }
    }

    return result;
};

BlockchainAddress.revertAddressList = function (addrList) {
    // Make sure that list has no repeated addresses
    addrList = Array.from(new Set(addrList));

    const addressWithBalance = BlockchainAddress.checkAddressesWithBalance(addrList),
        addrsToRevertByClassInstance = new Map();

    addrList.forEach((addr) => {
        if (!addressWithBalance[addr]) {
            // Only consider addresses that do not have balance
            let addrTypeAndPath = Catenis.keyStore.getTypeAndPathByAddress(addr);

            if (addrTypeAndPath !== null) {
                let addrPathParts = KeyStore.getPathParts(addrTypeAndPath),
                    classInstance = BlockchainAddress.getInstance({type: addrTypeAndPath.type, pathParts: addrPathParts});

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


// BlockchainAddress function class (public) properties
//

BlockchainAddress.instantiatedObjects = new Map();


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
    for (let [parentPath, objEntry] of BlockchainAddress.instantiatedObjects.entries()) {
        if (objEntry.lastAccessTimestamp < activeObjEarliestTimestamp) {
            deleteInstantiatedObject(parentPath);
        }
    }
}

function updateIssuedAddresses() {
    Catenis.logger.TRACE('Executing process to update issued blockchain addresses');
    // Execute code in critical section to avoid DB concurrency
    dbCS.execute(() => {
        // Identify issued blockchain addresses doc/rec that should be set as obsolete
        const docIssuedAddrByExpiredAddr = new Map();

        Catenis.db.collection.IssuedBlockchainAddress.find({status: 'expired'},
            {fields: {_id: 1, type: 1, parentPath: 1, path: 1, addrIndex: 1, status: 1}}).fetch().forEach((doc) => {
            let addr = BlockchainAddress.getAddressOfIssuedBlockchainAddress(doc);

            if (addr !== null) {
                docIssuedAddrByExpiredAddr.set(addr, doc);
            }
        });

        const idDocsToSetAsObsolete = [],
            addrsToSetAsObsolete = [],
            parentPathsToSetAsObsolete = new Set();

        if (docIssuedAddrByExpiredAddr.size > 0) {
            // Check whether expired addresses have balance
            let expiredAddrs = Array.from(docIssuedAddrByExpiredAddr.keys()),
                addressWithBalance = BlockchainAddress.checkAddressesWithBalance(expiredAddrs);

            expiredAddrs.forEach((addr) => {
                if (!addressWithBalance[addr]) {
                    // Mark address to be set as obsolete only if it does not have balance
                    idDocsToSetAsObsolete.push(docIssuedAddrByExpiredAddr.get(addr)._id);
                    addrsToSetAsObsolete.push(addr);
                    parentPathsToSetAsObsolete.add(docIssuedAddrByExpiredAddr.get(addr).parentPath);
                }
            });
        }

        // Identify issued blockchain addresses doc/rec that should be expired
        const docIssuedAddrByNewAddrToExpire = new Map();

        Catenis.db.collection.IssuedBlockchainAddress.find({status: 'new', expirationDate: {$lte: new Date()}},
            {fields: {_id: 1, type: 1, path: 1, addrIndex: 1, status: 1}}).fetch().forEach((doc) => {
            let addr = BlockchainAddress.getAddressOfIssuedBlockchainAddress(doc);

            if (addr !== null) {
                docIssuedAddrByNewAddrToExpire.set(addr, doc);
            }
        });

        const idDocsToExpire = [];

        if (docIssuedAddrByNewAddrToExpire.size > 0) {
            // Check whether new addresses to expire have balance
            let toExpireAddrs = Array.from(docIssuedAddrByNewAddrToExpire.keys()),
                addressWithBalance = BlockchainAddress.checkAddressesWithBalance(toExpireAddrs);

            toExpireAddrs.forEach((addr) => {
                if (!addressWithBalance[addr]) {
                    // If address does not have balance, mark it to be set directly as obsolete
                    idDocsToSetAsObsolete.push(docIssuedAddrByNewAddrToExpire.get(addr)._id);
                    addrsToSetAsObsolete.push(addr);
                }
                else {
                    // Otherwise, just mark it to be set as expired
                    idDocsToExpire.push(docIssuedAddrByNewAddrToExpire.get(addr)._id);
                }
            });
        }

        const lastStatusChangedDate = new Date();

        if (idDocsToExpire.length > 0) {
            // Set addresses as expired on local database
            Catenis.db.collection.IssuedBlockchainAddress.update({_id: {$in: idDocsToExpire}}, {
                $set: {
                    status: 'expired',
                    lastStatusChangedDate: lastStatusChangedDate
                }
            }, {multi: true});
        }

        if (idDocsToSetAsObsolete.length > 0) {
            // Set addresses as obsolete on local database
            Catenis.db.collection.IssuedBlockchainAddress.update({_id: {$in: idDocsToSetAsObsolete}}, {
                $set: {
                    status: 'obsolete',
                    lastStatusChangedDate: lastStatusChangedDate
                }
            }, {multi: true});

            // Also set addresses as obsolete on local key storage
            Catenis.keyStore.setAddressListAsObsolete(addrsToSetAsObsolete);

            for (let parentPath of parentPathsToSetAsObsolete) {
                if (hasInstantiatedObject(parentPath)) {
                    // Update address indices on corresponding blockchain address object if currently instantiated
                    updateInUseAddressIndices.call(getInstantiatedObject(parentPath));
                }
            }
        }
    });
}

function hasInstantiatedObject(parentPath) {
    return BlockchainAddress.instantiatedObjects.has(parentPath);
}

function setInstantiatedObject(parentPath, obj) {
    BlockchainAddress.instantiatedObjects.set(parentPath, {obj: obj, lastAccessTimestamp: Date.now()});
}

function getInstantiatedObject(parentPath) {
    const objEntry = BlockchainAddress.instantiatedObjects.get(parentPath);
    let obj = null;

    if (objEntry !== undefined) {
        obj = objEntry.obj;
        objEntry.lastAccessTimestamp = Date.now();
    }

    return obj;
}

function deleteInstantiatedObject(parentPath) {
    if (BlockchainAddress.instantiatedObjects.delete(parentPath)) {
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
    sys_dev_main_addr: SystemDeviceMainAddress,
    sys_fund_pay_addr: SystemFundingPaymentAddress,
    sys_fund_chg_addr: SystemFundingChangeAddress,
    sys_pay_tx_exp_addr: SystemPayTxExpenseAddress,
    sys_read_conf_spnd_ntfy_addr: SystemReadConfirmSpendNotifyAddress,
    sys_read_conf_spnd_only_addr: SystemReadConfirmSpendOnlyAddress,
    sys_read_conf_spnd_null_addr: SystemReadConfirmSpendNullAddress,
    sys_read_conf_pay_tx_exp_addr: SystemReadConfirmPayTxExpenseAddress,
    sys_serv_cred_issu_addr: SystemServiceCreditIssuingAddress,
    sys_serv_pymt_pay_tx_exp_addr: SystemServicePaymentPayTxExpenseAddress,
    sys_msig_sign_addr: SystemMultiSigSigneeAddress,
    cln_srv_acc_cred_ln_addr: ClientServiceAccountCreditLineAddress,
    cln_srv_acc_debt_ln_addr: ClientServiceAccountDebitLineAddress,
    cln_bcot_pay_addr: ClientBcotPaymentAddress,
    dev_read_conf_addr: DeviceReadConfirmAddress,
    dev_main_addr: DeviceMainAddress,
    dev_asst_addr: DeviceAssetAddress,
    dev_asst_issu_addr: DeviceAssetIssuanceAddress
};

// Definition of properties
Object.defineProperties(BlockchainAddress, {
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
