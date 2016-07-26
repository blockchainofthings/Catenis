/**
 * Created by claudio on 08/06/16.
 */

//console.log('[BlockchainAddress.js]: This code just ran.');
    
// Module variables
//

// References to external modules
var config = Npm.require('config');
var util = Npm.require('util');
var crypto = Npm.require('crypto');

import {CriticalSection} from './CriticalSection.js';

// Config entries
var configBcAddress = config.get('blockchainAddress'),
    configBcAddrValidity = configBcAddress.get('addressValidity');

// Configuration settings
var cfgSettings = {
    addressValidity: {
        catenisNodeDeviceMain: configBcAddrValidity.get('catenisNodeDeviceMain'),
        catenisNodeFundingPayment: configBcAddrValidity.get('catenisNodeFundingPayment'),
        catenisNodeFundingChange: configBcAddrValidity.get('catenisNodeFundingChange'),
        catenisNodePayTxExpense: configBcAddrValidity.get('catenisNodePayTxExpense'),
        clientMessageCredit: configBcAddrValidity.get('clientMessageCredit'),
        clientAssetCredit: configBcAddrValidity.get('clientAssetCredit'),
        deviceReadConfirm: configBcAddrValidity.get('deviceReadConfirm'),
        deviceMain: configBcAddrValidity.get('deviceMain'),
        deviceAsset: configBcAddrValidity.get('deviceAsset'),
        deviceAssetIssuance: configBcAddrValidity.get('deviceAssetIssuance')
    },
    updateIssuedAddressesInterval: configBcAddress.get('updateIssuedAddressesInterval'),
    inactivedObjectTime: configBcAddress.get('inactivedObjectTime'),
    deleteInactiveObjectsInterval: configBcAddress.get('deleteInactiveObjectsInterval')
};

// Critical section object to avoid concurrent access to database
var dbCS = new CriticalSection();

var updtIssuedAddrsIntervalHandle,
    delInactiveObjectsIntervalHandle;


// Definition of function classes
//

// CatenisNodeDeviceMainAddress derived class
class CatenisNodeDeviceMainAddress extends BlockchainAddress {
    constructor (ctnNodeIndex) {
        super();
        this.type = Catenis.module.KeyStore.extKeyType.ctnd_dev_main_addr.name;
        this.parentPath = Catenis.module.KeyStore.catenisNodeDeviceMainAddressRootPath(ctnNodeIndex);

        // Make sure that an object of this class has not been instantiated yet
        if (hasInstantiatedObject(this.parentPath)) {
            Catenis.logger.ERROR(util.format('CatenisNodeDeviceMainAddress object for the given Catenis node index (%d) has already been instantiated', ctnNodeIndex));
            throw new Error(util.format('CatenisNodeDeviceMainAddress object for the given Catenis node index (%d) has already been instantiated', ctnNodeIndex));
        }

        this.addressValidity = cfgSettings.addressValidity.catenisNodeDeviceMain;

        // Assign address manipulation functions
        this._getAddressKeys = Catenis.keyStore.getCatenisNodeDeviceMainAddressKeys.bind(Catenis.keyStore, ctnNodeIndex);
        this._listAddressesInUse = Catenis.keyStore.listCatenisNodeDeviceMainAddressesInUse.bind(Catenis.keyStore, ctnNodeIndex);

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
        var parentPath = Catenis.module.KeyStore.catenisNodeDeviceMainAddressRootPath(ctnNodeIndex);

        return hasInstantiatedObject(parentPath) ? getInstantiatedObject(parentPath)
            : new CatenisNodeDeviceMainAddress(ctnNodeIndex);
    }
}

// CatenisNodeFundingPaymentAddress derived class
class CatenisNodeFundingPaymentAddress extends BlockchainAddress {
    constructor (ctnNodeIndex) {
        super();
        this.type = Catenis.module.KeyStore.extKeyType.ctnd_fund_pay_addr.name;
        this.parentPath = Catenis.module.KeyStore.catenisNodeFundingPaymentRootPath(ctnNodeIndex);

        // Make sure that an object of this class has not been instantiated yet
        if (hasInstantiatedObject(this.parentPath)) {
            Catenis.logger.ERROR(util.format('CatenisNodeFundingPaymentAddress object for the given Catenis node index (%d) has already been instantiated', ctnNodeIndex));
            throw new Error(util.format('CatenisNodeFundingPaymentAddress object for the given Catenis node index (%d) has already been instantiated', ctnNodeIndex));
        }

        this.addressValidity = cfgSettings.addressValidity.catenisNodeFundingPayment;

        // Assign address manipulation functions
        this._getAddressKeys = Catenis.keyStore.getCatenisNodeFundingPaymentAddressKeys.bind(Catenis.keyStore, ctnNodeIndex);
        this._listAddressesInUse = Catenis.keyStore.listCatenisNodeFundingPaymentAddressesInUse.bind(Catenis.keyStore, ctnNodeIndex);

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
        var parentPath = Catenis.module.KeyStore.catenisNodeFundingPaymentRootPath(ctnNodeIndex);

        return hasInstantiatedObject(parentPath) ? getInstantiatedObject(parentPath)
                : new CatenisNodeFundingPaymentAddress(ctnNodeIndex);
    }
}

// CatenisNodeFundingChangeAddress derived class
class CatenisNodeFundingChangeAddress extends BlockchainAddress {
    constructor (ctnNodeIndex) {
        super();
        this.type = Catenis.module.KeyStore.extKeyType.ctnd_fund_chg_addr.name;
        this.parentPath = Catenis.module.KeyStore.catenisNodeFundingChangeRootPath(ctnNodeIndex);

        // Make sure that an object of this class has not been instantiated yet
        if (hasInstantiatedObject(this.parentPath)) {
            Catenis.logger.ERROR(util.format('CatenisNodeFundingChangeAddress object for the given Catenis node index (%d) has already been instantiated', ctnNodeIndex));
            throw new Error(util.format('CatenisNodeFundingChangeAddress object for the given Catenis node index (%d) has already been instantiated', ctnNodeIndex));
        }

        this.addressValidity = cfgSettings.addressValidity.catenisNodeFundingChange;

        // Assign address manipulation functions
        this._getAddressKeys = Catenis.keyStore.getCatenisNodeFundingChangeAddressKeys.bind(Catenis.keyStore, ctnNodeIndex);
        this._listAddressesInUse = Catenis.keyStore.listCatenisNodeFundingChangeAddressesInUse.bind(Catenis.keyStore, ctnNodeIndex);

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
        var parentPath = Catenis.module.KeyStore.catenisNodeFundingChangeRootPath(ctnNodeIndex);

        return hasInstantiatedObject(parentPath) ? getInstantiatedObject(parentPath)
            : new CatenisNodeFundingChangeAddress(ctnNodeIndex);
    }
}

// CatenisNodePayTxExpenseAddress derived class
class CatenisNodePayTxExpenseAddress extends BlockchainAddress {
    constructor (ctnNodeIndex) {
        super();
        this.type = Catenis.module.KeyStore.extKeyType.ctnd_pay_tx_exp_addr.name;
        this.parentPath = Catenis.module.KeyStore.catenisNodePayTxExpenseRootPath(ctnNodeIndex);

        // Make sure that an object of this class has not been instantiated yet
        if (hasInstantiatedObject(this.parentPath)) {
            Catenis.logger.ERROR(util.format('CatenisNodePayTxExpenseAddress object for the given Catenis node index (%d) has already been instantiated', ctnNodeIndex));
            throw new Error(util.format('CatenisNodePayTxExpenseAddress object for the given Catenis node index (%d) has already been instantiated', ctnNodeIndex));
        }

        this.addressValidity = cfgSettings.addressValidity.catenisNodePayTxExpense;

        // Assign address manipulation functions
        this._getAddressKeys = Catenis.keyStore.getCatenisNodePayTxExpenseAddressKeys.bind(Catenis.keyStore, ctnNodeIndex);
        this._listAddressesInUse = Catenis.keyStore.listCatenisNodePayTxExpenseAddressesInUse.bind(Catenis.keyStore, ctnNodeIndex);

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
        var parentPath = Catenis.module.KeyStore.catenisNodePayTxExpenseRootPath(ctnNodeIndex);

        return hasInstantiatedObject(parentPath) ? getInstantiatedObject(parentPath)
            : new CatenisNodePayTxExpenseAddress(ctnNodeIndex);
    }
}

// ClientMessageCreditAddress derived class
class ClientMessageCreditAddress extends BlockchainAddress {
    constructor (clientIndex) {
        super();
        this.type = Catenis.module.KeyStore.extKeyType.cln_msg_crd_addr.name;
        this.parentPath = Catenis.module.KeyStore.clientMessageCreditAddressRootPath(clientIndex);

        // Make sure that an object of this class has not been instantiated yet
        if (hasInstantiatedObject(this.parentPath)) {
            Catenis.logger.ERROR(util.format('ClientMessageCreditAddress object for the given client index (%d) has already been instantiated', clientIndex));
            throw new Error(util.format('ClientMessageCreditAddress object for the given client index (%d) has already been instantiated', clientIndex));
        }

        this.addressValidity = cfgSettings.addressValidity.clientMessageCredit;

        // Assign address manipulation functions
        this._getAddressKeys = Catenis.keyStore.getClientMessageCreditAddressKeys.bind(Catenis.keyStore, clientIndex);
        this._listAddressesInUse = Catenis.keyStore.listClientMessageCreditAddressesInUse.bind(Catenis.keyStore, clientIndex);

        // Initialize bounding indices
        setBoundingIndices.call(this);

        // Save this instance
        setInstantiatedObject(this.parentPath, this);
    }

    // Get instance of this class
    //
    //  clientIndex: [integer]
    //                or
    //                {  // Options object
    //      clientIndex: [integer]
    //  }
    //
    static getInstance(clientIndex) {
        if (typeof clientIndex === 'object') {
            // Options object passed instead of plain arguments
            clientIndex = clientIndex.clientIndex;
        }

        // Check if an instance of this class has already been instantiated
        var parentPath = Catenis.module.KeyStore.clientMessageCreditAddressRootPath(clientIndex);

        return hasInstantiatedObject(parentPath) ? getInstantiatedObject(parentPath)
            : new ClientMessageCreditAddress(clientIndex);
    }
}

// ClientAssetCreditAddress derived class
class ClientAssetCreditAddress extends BlockchainAddress {
    constructor (clientIndex) {
        super();
        this.type = Catenis.module.KeyStore.extKeyType.cln_asst_crd_addr.name;
        this.parentPath = Catenis.module.KeyStore.clientAssetCreditAddressRootPath(clientIndex);

        // Make sure that an object of this class has not been instantiated yet
        if (hasInstantiatedObject(this.parentPath)) {
            Catenis.logger.ERROR(util.format('ClientAssetCreditAddress object for the given client index (%d) has already been instantiated', clientIndex));
            throw new Error(util.format('ClientAssetCreditAddress object for the given client index (%d) has already been instantiated', clientIndex));
        }

        this.addressValidity = cfgSettings.addressValidity.clientAssetCredit;

        // Assign address manipulation functions
        this._getAddressKeys = Catenis.keyStore.getClientAssetCreditAddressKeys.bind(Catenis.keyStore, clientIndex);
        this._listAddressesInUse = Catenis.keyStore.listClientAssetCreditAddressesInUse.bind(Catenis.keyStore, clientIndex);

        // Initialize bounding indices
        setBoundingIndices.call(this);

        // Save this instance
        setInstantiatedObject(this.parentPath, this);
    }

    // Get instance of this class
    //
    //  clientIndex: [integer]
    //                or
    //                {  // Options object
    //      clientIndex: [integer]
    //  }
    //
    static getInstance(clientIndex) {
        if (typeof clientIndex === 'object') {
            // Options object passed instead of plain arguments
            clientIndex = clientIndex.clientIndex;
        }

        // Check if an instance of this class has already been instantiated
        var parentPath = Catenis.module.KeyStore.clientAssetCreditAddressRootPath(clientIndex);

        return hasInstantiatedObject(parentPath) ? getInstantiatedObject(parentPath)
            : new ClientAssetCreditAddress(clientIndex);
    }
}

// DeviceReadConfirmAddress derived class
class DeviceReadConfirmAddress extends BlockchainAddress {
    constructor (clientIndex, deviceIndex) {
        super();
        this.type = Catenis.module.KeyStore.extKeyType.dev_read_conf_addr.name;
        this.parentPath = Catenis.module.KeyStore.deviceReadConfirmAddressRootPath(clientIndex, deviceIndex);

        // Make sure that an object of this class has not been instantiated yet
        if (hasInstantiatedObject(this.parentPath)) {
            Catenis.logger.ERROR(util.format('DeviceReadConfirmAddress object for the given client and device indices (%d and %d, respectively) has already been instantiated', clientIndex, deviceIndex));
            throw new Error(util.format('DeviceReadConfirmAddress object for the given client and device indices (%d and %d, respectively) has already been instantiated', clientIndex, deviceIndex));
        }

        this.addressValidity = cfgSettings.addressValidity.deviceReadConfirm;

        // Assign address manipulation functions
        this._getAddressKeys = Catenis.keyStore.getDeviceReadConfirmAddressKeys.bind(Catenis.keyStore, clientIndex, deviceIndex);
        this._listAddressesInUse = Catenis.keyStore.listDeviceReadConfirmAddressesInUse.bind(Catenis.keyStore, clientIndex, deviceIndex);

        // Initialize bounding indices
        setBoundingIndices.call(this);

        // Save this instance
        setInstantiatedObject(this.parentPath, this);
    }

    // Get instance of this class
    //
    //  clientIndex: [integer]
    //               or
    //               {  // Options object
    //      clientIndex: [integer],
    //      deviceIndex: [integer]
    //  },
    //  deviceIndex: [integer]
    //
    static getInstance(clientIndex, deviceIndex) {
        if (typeof clientIndex === 'object') {
            // Options object passed instead of plain arguments
            deviceIndex = clientIndex.deviceIndex;
            clientIndex = clientIndex.clientIndex;
        }

        // Check if an instance of this class has already been instantiated
        var parentPath = Catenis.module.KeyStore.deviceReadConfirmAddressRootPath(clientIndex, deviceIndex);

        return hasInstantiatedObject(parentPath) ? getInstantiatedObject(parentPath)
            : new DeviceReadConfirmAddress(clientIndex, deviceIndex);
    }
}

// DeviceMainAddress derived class
class DeviceMainAddress extends BlockchainAddress {
    constructor (clientIndex, deviceIndex) {
        super();
        this.type = Catenis.module.KeyStore.extKeyType.dev_main_addr.name;
        this.parentPath = Catenis.module.KeyStore.deviceMainAddressRootPath(clientIndex, deviceIndex);

        // Make sure that an object of this class has not been instantiated yet
        if (hasInstantiatedObject(this.parentPath)) {
            Catenis.logger.ERROR(util.format('DeviceMainAddress object for the given client and device indices (%d and %d, respectively) has already been instantiated', clientIndex, deviceIndex));
            throw new Error(util.format('DeviceMainAddress object for the given client and device indices (%d and %d, respectively) has already been instantiated', clientIndex, deviceIndex));
        }

        this.addressValidity = cfgSettings.addressValidity.deviceMain;

        // Assign address manipulation functions
        this._getAddressKeys = Catenis.keyStore.getDeviceMainAddressKeys.bind(Catenis.keyStore, clientIndex, deviceIndex);
        this._listAddressesInUse = Catenis.keyStore.listDeviceMainAddressesInUse.bind(Catenis.keyStore, clientIndex, deviceIndex);

        // Initialize bounding indices
        setBoundingIndices.call(this);

        // Save this instance
        setInstantiatedObject(this.parentPath, this);
    }

    // Get instance of this class
    //
    //  clientIndex: [integer]
    //               or
    //               {  // Options object
    //      clientIndex: [integer],
    //      deviceIndex: [integer]
    //  },
    //  deviceIndex: [integer]
    //
    static getInstance(clientIndex, deviceIndex) {
        if (typeof clientIndex === 'object') {
            // Options object passed instead of plain arguments
            deviceIndex = clientIndex.deviceIndex;
            clientIndex = clientIndex.clientIndex;
        }

        // Check if an instance of this class has already been instantiated
        var parentPath = Catenis.module.KeyStore.deviceMainAddressRootPath(clientIndex, deviceIndex);

        return hasInstantiatedObject(parentPath) ? getInstantiatedObject(parentPath)
            : new DeviceMainAddress(clientIndex, deviceIndex);
    }
}

// DeviceAssetAddress derived class
class DeviceAssetAddress extends BlockchainAddress {
    constructor (clientIndex, deviceIndex) {
        super();
        this.type = Catenis.module.KeyStore.extKeyType.dev_asst_addr.name;
        this.parentPath = Catenis.module.KeyStore.deviceAssetAddressRootPath(clientIndex, deviceIndex);

        // Make sure that an object of this class has not been instantiated yet
        if (hasInstantiatedObject(this.parentPath)) {
            Catenis.logger.ERROR(util.format('DeviceAssetAddress object for the given client and device indices (%d and %d, respectively) has already been instantiated', clientIndex, deviceIndex));
            throw new Error(util.format('DeviceAssetAddress object for the given client and device indices (%d and %d, respectively) has already been instantiated', clientIndex, deviceIndex));
        }

        this.addressValidity = cfgSettings.addressValidity.deviceAsset;

        // Assign address manipulation functions
        this._getAddressKeys = Catenis.keyStore.getDeviceAssetAddressKeys.bind(Catenis.keyStore, clientIndex, deviceIndex);
        this._listAddressesInUse = Catenis.keyStore.listDeviceAssetAddressesInUse.bind(Catenis.keyStore, clientIndex, deviceIndex);

        // Initialize bounding indices
        setBoundingIndices.call(this);

        // Save this instance
        setInstantiatedObject(this.parentPath, this);
    }

    // Get instance of this class
    //
    //  clientIndex: [integer]
    //               or
    //               {  // Options object
    //      clientIndex: [integer],
    //      deviceIndex: [integer]
    //  },
    //  deviceIndex: [integer]
    //
    static getInstance(clientIndex, deviceIndex) {
        if (typeof clientIndex === 'object') {
            // Options object passed instead of plain arguments
            deviceIndex = clientIndex.deviceIndex;
            clientIndex = clientIndex.clientIndex;
        }

        // Check if an instance of this class has already been instantiated
        var parentPath = Catenis.module.KeyStore.deviceAssetAddressRootPath(clientIndex, deviceIndex);

        return hasInstantiatedObject(parentPath) ? getInstantiatedObject(parentPath)
            : new DeviceAssetAddress(clientIndex, deviceIndex);
    }
}

// DeviceAssetIssuanceAddress derived class
class DeviceAssetIssuanceAddress extends BlockchainAddress {
    constructor (clientIndex, deviceIndex) {
        super();
        this.type = Catenis.module.KeyStore.extKeyType.dev_asst_issu_addr.name;
        this.parentPath = Catenis.module.KeyStore.deviceAssetIssuanceAddressRootPath(clientIndex, deviceIndex);

        // Make sure that an object of this class has not been instantiated yet
        if (hasInstantiatedObject(this.parentPath)) {
            Catenis.logger.ERROR(util.format('DeviceAssetIssuanceAddress object for the given client and device indices (%d and %d, respectively) has already been instantiated', clientIndex, deviceIndex));
            throw new Error(util.format('DeviceAssetIssuanceAddress object for the given client and device indices (%d and %d, respectively) has already been instantiated', clientIndex, deviceIndex));
        }

        this.addressValidity = cfgSettings.addressValidity.deviceAssetIssuance;

        // Assign address manipulation functions
        this._getAddressKeys = Catenis.keyStore.getDeviceAssetIssuanceAddressKeys.bind(Catenis.keyStore, clientIndex, deviceIndex);
        this._listAddressesInUse = Catenis.keyStore.listDeviceAssetIssuanceAddressesInUse.bind(Catenis.keyStore, clientIndex, deviceIndex);
        this._latestAddressInUse = Catenis.keyStore.latestDeviceAssetIssuanceAddressInUse.bind(Catenis.keyStore, clientIndex, deviceIndex);

        // Initialize bounding indices
        setBoundingIndices.call(this);

        // Save this instance
        setInstantiatedObject(this.parentPath, this);
    }

    // Get instance of this class
    //
    //  clientIndex: [integer]
    //               or
    //               {  // Options object
    //      clientIndex: [integer],
    //      deviceIndex: [integer]
    //  },
    //  deviceIndex: [integer]
    //
    static getInstance(clientIndex, deviceIndex) {
        if (typeof clientIndex === 'object') {
            // Options object passed instead of plain arguments
            deviceIndex = clientIndex.deviceIndex;
            clientIndex = clientIndex.clientIndex;
        }

        // Check if an instance of this class has already been instantiated
        var parentPath = Catenis.module.KeyStore.deviceAssetIssuanceAddressRootPath(clientIndex, deviceIndex);

        return hasInstantiatedObject(parentPath) ? getInstantiatedObject(parentPath)
            : new DeviceAssetIssuanceAddress(clientIndex, deviceIndex);
    }
}

// BlockchainAddress function class
function BlockchainAddress() {
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
    var addrKeys = null;

    // Execute code in critical section to avoid DB concurrency
    dbCS.execute(() => {
        // Try to get next address
        var nonexistIndices = [];

        do {
            if ((addrKeys = this._getAddressKeys(++this.lastIssuedAddrIndex)) == null) {
                nonexistIndices.push(this.lastIssuedAddrIndex);
            }
        }
        while (addrKeys == null);

        // Import address public key onto Bitcoin Core
        Catenis.bitcoinCore.importPublicKey(addrKeys.exportPublicKey());

        // Save issued address
        var issuedDate = new Date();

        if (nonexistIndices.length > 0) {
            nonexistIndices.forEach(function (nonexistIndex) {
                Catenis.db.collection.IssuedBlockchainAddress.insert({
                    type: this.type,
                    parentPath: this.parentPath,
                    path: util.format('%s/%d', this.parentPath, addrIndex),
                    addrIndex: nonexistIndex,
                    issuedDate: issuedDate,
                    status: 'nonexistent'
                });
            }, this);
        }

        var expirationDate = new Date(issuedDate.getTime());
        expirationDate.setSeconds(expirationDate.getSeconds() + this.addressValidity);

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


// Module functions used to simulate private BlockchainAddress object methods
//  NOTE: these functions need to be bound to a BlockchainAddress object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

function setBoundingIndices() {
    var docIssuedAddr = Catenis.db.collection.IssuedBlockchainAddress.findOne({parentPath: this.parentPath}, {fields: {addrIndex: 1}, sort: {addrIndex: -1}});

    if (docIssuedAddr != undefined) {
        this.lastIssuedAddrIndex = docIssuedAddr.addrIndex;

        docIssuedAddr = Catenis.db.collection.IssuedBlockchainAddress.findOne({parentPath: this.parentPath, status: {$in: ['new', 'expired']}}, {fields: {addrIndex: 1}, sort: {addrIndex: -1}});

        if (docIssuedAddr != undefined) {
            this.lastInUseAddrIndex = docIssuedAddr.addrIndex;

            this.firstInUseAddrIndex = Catenis.db.collection.IssuedBlockchainAddress.findOne({parentPath: this.parentPath, status: {$in: ['new', 'expired']}}, {fields: {addrIndex: 1}, sort: {addrIndex: 1}}).addrIndex;

            // Add in-use addresses to KeyStore
            Catenis.db.collection.IssuedBlockchainAddress.find({parentPath: this.parentPath, $and: [{addrIndex: {$gte: this.firstInUseAddrIndex}}, {addrIndex: {$lte: this.lastInUseAddrIndex}}], status: {$ne: 'nonexistent'}},
                    {fields: {addrIndex: 1, status: 1}, sort: {adrrIndex: 1}}).forEach(function (doc) {
                if (doc.status !== 'obsolete') {
                    this._getAddressKeys(doc.addrIndex);
                }
            }, this);
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
    var docIssuedAddr = Catenis.db.collection.IssuedBlockchainAddress.findOne({parentPath: this.parentPath, status: {$in: ['new', 'expired']}}, {fields: {addrIndex: 1}, sort: {addrIndex: -1}});

    if (docIssuedAddr != undefined) {
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
    var result = false;

    // Make sure that this is the last issued address, it
    //  is not obsolete and not currently in use
    if (addrIndex >= 0 && addrIndex == this.lastIssuedAddrIndex && addrIndex == this.lastInUseAddrIndex && (balanceChecked || !BlockchainAddress.isAddressWithBalance(address))) {
        // Execute code in critical section to avoid DB concurrency
        dbCS.execute(() => {
            // Exclude address from database
            var count = Catenis.db.collection.IssuedBlockchainAddress.remove({
                parentPath: this.parentPath,
                addrIndex: addrIndex
            });

            if (count > 0) {
                // Adjust indices
                if (addrIndex > 0) {
                    // Retrieve any nonexistent address indices
                    var docNonExistAddrs = Catenis.db.collection.IssuedBlockchainAddress.find({
                        parentPath: this.parentPath,
                        status: 'nonexistent'
                    }, {fields: {addrIndex: 1}, sort: {addrIndex: -1}}).fetch();

                    // Determine adjusted index
                    var adjustIndex = addrIndex - 1;

                    if (docNonExistAddrs.length > 0) {
                        // Make sure that adjusted index is not nonexistent
                        docNonExistAddrs.some(function (docNonExistAddr) {
                            if (docNonExistAddr.addrIndex == adjustIndex) {
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


// BlockchainAddress function class (public) methods
//

BlockchainAddress.initialize = function () {
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
    var drvClass,
        classInstance = null;

    if ((drvClass = classByType[opts.type]) != null) {
        classInstance = drvClass.getInstance(opts.pathParts);
    }

    return classInstance;
};

// Check whether address has balance (there is any UTXO associated with it)
BlockchainAddress.isAddressWithBalance = function (addr) {
    // Check if any UTXOs associated with address is locked
    var hasLockedTxOuts = Catenis.bitcoinCore.listLockUnspent().some(function (lockTxOut) {
        var txOutInfo = Catenis.bitcoinCore.getTxOut(lockTxOut.txid, lockTxOut.vout);

        return txOutInfo != null && 'scriptPubKey' in txOutInfo && 'addresses' in txOutInfo.scriptPubKey
            && txOutInfo.scriptPubKey.addresses.some(function (txOutAddr) {
                return txOutAddr === addr;
            });
    });

    if (hasLockedTxOuts) {
        return true;
    }

    // Now, check if there are any UTXOs associated with address
    var unspentTxOuts = Catenis.bitcoinCore.listUnspent(0, addr);

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
    var lockedAddresses = new Set();

    Catenis.bitcoinCore.listLockUnspent().forEach(function (lockTxOut) {
        let txOutInfo = Catenis.bitcoinCore.getTxOut(lockTxOut.txid, lockTxOut.vout);

        if (txOutInfo != null && 'scriptPubKey' in txOutInfo && 'addresses' in txOutInfo.scriptPubKey) {
            txOutInfo.scriptPubKey.addresses.forEach(function (txOutAddr) {
                lockedAddresses.add(txOutAddr);
            });
        }
    });

    var result = {},
        addrsToListUnspent = [];

    addrList.forEach(function (addr) {
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

        Catenis.bitcoinCore.listUnspent(0, addrsToListUnspent).forEach(function (utxo) {
            if (!addressesWithUtxo.has(utxo.address)) {
                addressesWithUtxo.add(utxo.address);
            }
        });

        addrsToListUnspent.forEach(function (addr) {
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
    var addrKeys = Catenis.keyStore.getCryptoKeysByPath(docIssuedAddr.path);

    if (addrKeys == null) {
        // Crypto keys of issued address is not yet in local storage.
        //  Bring it up
        var classInstance = BlockchainAddress.getInstance({type: docIssuedAddr.type, pathParts: Catenis.module.KeyStore.getPathParts(docIssuedAddr)});

        if (classInstance != null) {
            // Store address in local key storage setting it as obsolete accordingly,
            //  and get its corresponding crypto keys
            addrKeys = classInstance._getAddressKeys(docIssuedAddr.addrIndex, docIssuedAddr.status == 'obsolete');
        }
    }

    return addrKeys != null ? addrKeys.getAddress() : null;
};

// Place obsolete address back onto local key storage
BlockchainAddress.retrieveObsoleteAddress = function (addr) {
    // Try to retrieve obsolete address from database
    var docIssuedAddrs = Catenis.db.collection.IssuedBlockchainAddress.find({addrHash: hashAddress(addr), status: 'obsolete'}, {fields: {type: 1, path: 1, addrIndex: 1}}).fetch(),
        result = false;

    if (docIssuedAddrs.length > 0) {
        if (docIssuedAddrs.length == 1) {
            // Only one doc/rec returned
            let docIssuedAddr = docIssuedAddrs[0],
                addrKeys = Catenis.keyStore.getCryptoKeysByPath(docIssuedAddr.path);

            // Make sure that address is not yet in local key storage
            if (addrKeys == null) {
                let classInstance = BlockchainAddress.getInstance({type: docIssuedAddr.type, pathParts: Catenis.module.KeyStore.getPathParts(docIssuedAddr)});

                if (classInstance != null) {
                    // Store address in local key storage making sure that it is set as obsolete,
                    //  and get its corresponding crypto keys
                    let addrKeys = classInstance._getAddressKeys(docIssuedAddr.addrIndex, true);

                    if (addrKeys != null) {
                        // Make sure that this is the correct address (though unlikely, not impossible
                        //  since there could be one or more addresses with the same hash)
                        if (addrKeys.getAddress() === addr) {
                            result = true;
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
            if (docIssuedAddrs.find(function (docIssuedAddr) {
                    let addrKeys = Catenis.keyStore.getCryptoKeysByPath(docIssuedAddr.path);

                    // Make sure that address is not yet in local key storage
                    if (addrKeys == null) {
                        let classInstance = BlockchainAddress.getInstance({type: docIssuedAddr.type, pathParts: Catenis.module.KeyStore.getPathParts(docIssuedAddr)}),
                            found = false;

                        if (classInstance != null) {
                            // Store address in local key storage making sure that it is set as obsolete,
                            //  and get its corresponding crypto keys
                            let addrKeys = classInstance._getAddressKeys(docIssuedAddr.addrIndex, true);

                            if (addrKeys != null) {
                                // Make sure that this is the correct address (though unlikely, not impossible
                                //  since there could be one or more addresses with the same hash)
                                if (addrKeys.getAddress() === addr) {
                                    found = true;
                                }
                                else {
                                    // Wrong address has been retrieved. Remove it from local key storage
                                    Catenis.keyStore.removeExtKeyByAddress(addrKeys.getAddress());
                                }
                            }
                        }

                        return found;
                    }
                }) != undefined) {
                result = true;
            }
        }
    }

    return result;
};

BlockchainAddress.revertAddress = function (addr) {
    var result = false,
        addrTypeAndPath = Catenis.keyStore.getTypeAndPathByAddress(addr);

    if (addrTypeAndPath != null) {
        let addrPathParts = Catenis.module.KeyStore.getPathParts(addrTypeAndPath),
            classInstance = BlockchainAddress.getInstance({type: addrTypeAndPath.type, pathParts: addrPathParts});

        if (classInstance != null) {
            // Revert address
            result = revertAddress.call(classInstance, addr, addrPathParts.addrIndex);
        }
    }

    return result;
};

BlockchainAddress.revertAddressList = function (addrList) {
    var addressWithBalance = BlockchainAddress.checkAddressesWithBalance(addrList),
        addrsToRevertByClassInstance = new Map();

    addrList.forEach(function (addr) {
        if (!addressWithBalance[addr]) {
            // Only consider addresses that do not have balance
            let addrTypeAndPath = Catenis.keyStore.getTypeAndPathByAddress(addr);

            if (addrTypeAndPath != null) {
                let addrPathParts = Catenis.module.KeyStore.getPathParts(addrTypeAndPath),
                    classInstance = BlockchainAddress.getInstance({type: addrTypeAndPath.type, pathParts: addrPathParts});

                if (classInstance != null) {
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

    var countRevertedAddr = 0;

    if (addrsToRevertByClassInstance.size > 0) {
        for (let [classInstance, addrEntries] of addrsToRevertByClassInstance.entries()) {
            // Make sure that addresses with higher index are processed first
            addrEntries = addrEntries.sort(function (a, b) {
                return a.addrIndex > b.addrIndex ? -1 : (a.addrIndex < b.addrIndex ? 1 : 0);
            });

            addrEntries.forEach(function (addrEntry) {
                // Revert address
                if (revertAddress.call(classInstance, addrEntry.address, addrEntry.addrIndex, true)) {
                    countRevertedAddr++;
                }
            });
        }
    }

    return countRevertedAddr == addrList.length ? true : (countRevertedAddr == 0 ? false : undefined);
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
    var activeObjEarlietTime = new Date(Date.now());
    activeObjEarlietTime.setSeconds(activeObjEarlietTime.getSeconds() - cfgSettings.obsoleteExtKeyTimeToPurge);

    var activeObjEarliestTimestamp = activeObjEarlietTime.getTime();

    // Identify inactive objects and delete them
    for (let [parentPath, objEntry] of BlockchainAddress.instantiatedObjects.entries()) {
        if (objEntry.lastAccessTimestamp < activeObjEarliestTimestamp) {
            deleteInstatiatedObject(parentPath);
        }
    }
}

function updateIssuedAddresses() {
    Catenis.logger.TRACE('Executing process to update issued blockchain addresses');
    // Execute code in critical section to avoid DB concurrency
    dbCS.execute(() => {
        // Identify issued blockchain addresses doc/rec that should be set as obsolete
        var docIssuedAddrByExpiredAddr = new Map();

        Catenis.db.collection.IssuedBlockchainAddress.find({status: 'expired'},
            {fields: {_id: 1, type: 1, parentPath: 1, path: 1, addrIndex: 1, status: 1}}).forEach(function (doc) {
            let addr = BlockchainAddress.getAddressOfIssuedBlockchainAddress(doc);

            if (addr != null) {
                docIssuedAddrByExpiredAddr.set(addr, doc);
            }
        });

        var idDocsToSetAsObsolete = [],
            addrsToSetAsObsolete = [],
            parentPathsToSetAsObsolete = new Set();

        if (docIssuedAddrByExpiredAddr.size > 0) {
            // Check whether expired addresses have balance
            let expiredAddrs = Array.from(docIssuedAddrByExpiredAddr.keys()),
                addressWithBalance = BlockchainAddress.checkAddressesWithBalance(expiredAddrs);

            expiredAddrs.forEach(function (addr) {
                if (!addressWithBalance[addr]) {
                    // Mark address to be set as obsolete only if it does not have balance
                    idDocsToSetAsObsolete.push(docIssuedAddrByExpiredAddr.get(addr)._id);
                    addrsToSetAsObsolete.push(addr);
                    parentPathsToSetAsObsolete.add(docIssuedAddrByExpiredAddr.get(addr).parentPath);
                }
            });
        }

        // Identify issued blockchain addresses doc/rec that should be expired
        var docIssuedAddrByNewAddrToExpire = new Map();

        Catenis.db.collection.IssuedBlockchainAddress.find({status: 'new', expirationDate: {$lte: new Date()}},
            {fields: {_id: 1, type: 1, path: 1, addrIndex: 1, status: 1}}).forEach(function (doc) {
            let addr = BlockchainAddress.getAddressOfIssuedBlockchainAddress(doc);

            if (addr != null) {
                docIssuedAddrByNewAddrToExpire.set(addr, doc);
            }
        });

        var idDocsToExpire = [];

        if (docIssuedAddrByNewAddrToExpire.size > 0) {
            // Check whether new addresses to expire have balance
            let toExpireAddrs = Array.from(docIssuedAddrByNewAddrToExpire.keys()),
                addressWithBalance = BlockchainAddress.checkAddressesWithBalance(toExpireAddrs);

            toExpireAddrs.forEach(function (addr) {
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

        var lastStatusChangedDate = new Date();

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
    var objEntry = BlockchainAddress.instantiatedObjects.get(parentPath),
        obj = null;

    if (objEntry != null) {
        obj = objEntry.obj;
        objEntry.lastAccessTimestamp = Date.now();
    }

    return obj;
}

function deleteInstatiatedObject(parentPath) {
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
var classByType = {
    ctnd_dev_main_addr: CatenisNodeDeviceMainAddress,
    ctnd_fund_pay_addr: CatenisNodeFundingPaymentAddress,
    ctnd_fund_chg_addr: CatenisNodeFundingChangeAddress,
    ctnd_pay_tx_exp_addr: CatenisNodePayTxExpenseAddress,
    cln_msg_crd_addr: ClientMessageCreditAddress,
    cln_asst_crd_addr: ClientAssetCreditAddress,
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

// Save module function class reference
if (typeof Catenis === 'undefined')
    Catenis = {};

if (typeof Catenis.module === 'undefined')
    Catenis.module = {};

Catenis.module.BlockchainAddress = {
    BlockchainAddress: Object.freeze(BlockchainAddress),
    CatenisNodeDeviceMainAddress: Object.freeze(CatenisNodeDeviceMainAddress),
    CatenisNodeFundingPaymentAddress: Object.freeze(CatenisNodeFundingPaymentAddress),
    CatenisNodeFundingChangeAddress: Object.freeze(CatenisNodeFundingChangeAddress),
    CatenisNodePayTxExpenseAddress: Object.freeze(CatenisNodePayTxExpenseAddress),
    ClientMessageCreditAddress: Object.freeze(ClientMessageCreditAddress),
    ClientAssetCreditAddress: Object.freeze(ClientAssetCreditAddress),
    DeviceReadConfirmAddress: Object.freeze(DeviceReadConfirmAddress),
    DeviceMainAddress: Object.freeze(DeviceMainAddress),
    DeviceAssetAddress: Object.freeze(DeviceAssetAddress),
    DeviceAssetIssuanceAddress: Object.freeze(DeviceAssetIssuanceAddress)
};
