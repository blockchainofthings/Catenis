/**
 * Created by claudio on 23/05/16.
 */

//console.log('[CatenisHubAddress.js]: This code just ran.');

// Module variables
//

// References to external modules
var config = Npm.require('config');
var util = Npm.require('util');
var Future = Npm.require('fibers/future');

// Config entries
var catenisHubAddrConfig = config.get('catenisHubAddress');

// Configuration settings
var cfgSettings = {
    addressValidity: {
        ctnd_fund_pay_addr: catenisHubAddrConfig.get('fundingPaymentAddressValidity'),
        ctnd_fund_chg_addr: catenisHubAddrConfig.get('fundingChangeAddressValidity'),
        ctnd_pay_tx_exp_addr: catenisHubAddrConfig.get('payTxExpenseAddressValidity')
    },
    updateIssuedAddressesInterval: catenisHubAddrConfig.get('updateIssuedAddressesInterval')
};

var addressTypeInfo = {
    ctnd_fund_pay_addr: {
        funcQualifier: 'FundingPayment'
    },
    ctnd_fund_chg_addr: {
        funcQualifier: 'FundingChange'
    },
    ctnd_pay_tx_exp_addr: {
        funcQualifier: 'PayTxExpense'
    }
};

// Control to avoid concurrence access to database
var taskControl = {
    ctnd_fund_pay_addr: {
        processing: false,
        waitingTasks: []
    },
    ctnd_fund_chg_addr: {
        processing: false,
        waitingTasks: []
    },
    ctnd_pay_tx_exp_addr: {
        processing: false,
        waitingTasks: []
    }
};

var updtIssuedAddrsIntervalHandle;

// Definition of function classes
//

// CatenisHubAddress function class
function CatenisHubAddress(extKeyType) {
    this.extKeyType = extKeyType;

    var funcQualifier = addressTypeInfo[extKeyType.name].funcQualifier;

    // Map KeyStore functions
    this.getAddressKeys = Catenis.keyStore[util.format('getCatenisHub%sAddressKeys', funcQualifier)].bind(Catenis.keyStore);
    this.listAddressesInUse = Catenis.keyStore[util.format('listCatenisHub%sAddressesInUse', funcQualifier)].bind(Catenis.keyStore);

    // Set bounding indices
    var docIssuedAddr = Catenis.db.collection.IssuedCatenisHubAddress.findOne({type: extKeyType.name}, {fields: {addrIndex: 1}, sort: {addrIndex: -1}});

    if (docIssuedAddr != null) {
        this.lastIssuedAddrIndex = docIssuedAddr.addrIndex;

        docIssuedAddr = Catenis.db.collection.IssuedCatenisHubAddress.findOne({type: extKeyType.name, status: {$in: ['valid', 'expired']}}, {fields: {addrIndex: 1}, sort: {addrIndex: -1}});

        if (docIssuedAddr != null) {
            this.lastInUseAddrIndex = docIssuedAddr.addrIndex;

            this.firstInUseAddrIndex = Catenis.db.collection.IssuedCatenisHubAddress.findOne({type: extKeyType.name, status: {$in: ['valid', 'expired']}}, {fields: {addrIndex: 1}, sort: {addrIndex: 1}}).addrIndex;

            // Add in-use addresses to KeyStore
            Catenis.db.collection.IssuedCatenisHubAddress.find({type: extKeyType.name, $and: [{addrIndex: {$gte: this.firstInUseAddrIndex}}, {addrIndex: {$lte: this.lastInUseAddrIndex}}], status: {$ne: 'nonexistent'}},
                    {fields: {addrIndex: 1, status: 1}, sort: {adrrIndex: 1}}).forEach(function (doc) {
                if (doc.status !== 'obsolete') {
                    this.getAddressKeys(doc.addrIndex);
                }
            }, this);

            this.updateIssuedAddresses();
        }
        else {
            this.lastInUseAddrIndex = this.firstInUseAddrIndex = -1;
        }
    }
    else {
        this.lastIssuedAddrIndex = this.lastInUseAddrIndex = this.firstInUseAddrIndex = -1;
    }
}


// Public CatenisHubAddress object methods
//

CatenisHubAddress.prototype.updateIssuedAddresses = function () {
    // Make sure that there are no concurrence processing
    startProcessing.call(this);

    // Identify issued Catenis Hub address doc/rec that should be set as obsolete
    var idDocsToSetAsObsolete = [],
        addrsToSetAsObsolete = [];

    Catenis.db.collection.IssuedCatenisHubAddress.find({type: this.extKeyType.name, status: 'expired'},
            {fields: {_id: 1, path: 1}}).forEach(function (doc) {
        let addr = Catenis.keyStore.getCryptoKeysByPath(doc.path).getAddress();

        if (!CatenisHubAddress.isAddressInUse(addr)) {
            idDocsToSetAsObsolete.push(doc._id);
            addrsToSetAsObsolete.push(addr);
        }
    });

    // Identify issued Catenis Hub address doc/rec that have expired
    var idDocsToExpire = [];

    Catenis.db.collection.IssuedCatenisHubAddress.find({type: this.extKeyType.name, status: 'valid', expirationDate: {$lte: new Date()}},
            {fields: {_id: 1, path: 1}}).forEach(function (doc) {
        let addr = Catenis.keyStore.getCryptoKeysByPath(doc.path).getAddress();

        if (!CatenisHubAddress.isAddressInUse(addr)) {
            idDocsToSetAsObsolete.push(doc._id);
            addrsToSetAsObsolete.push(addr);
        }
        else {
            idDocsToExpire.push(doc._id);
        }
    });

    var lastStatusChangedDate = new Date();

    if (idDocsToExpire.length > 0) {
        Catenis.db.collection.IssuedCatenisHubAddress.update({_id: {$in: idDocsToExpire}}, {$set: {status: 'expired', lastStatusChangedDate: lastStatusChangedDate}});
    }

    if (idDocsToSetAsObsolete.length > 0) {
        Catenis.db.collection.IssuedCatenisHubAddress.update({_id: {$in: idDocsToSetAsObsolete}}, {$set: {status: 'obsolete', lastStatusChangedDate: lastStatusChangedDate}});

        Catenis.keyStore.setAddressListAsObsolete(addrsToSetAsObsolete);

        updateInUseAddressIndices.call(this);
    }

    // Release waiting concurrence processing
    endProcessing.call(this);
};

CatenisHubAddress.prototype.newAddressKeys = function () {
    // Make sure that there are no concurrence processing
    startProcessing.call(this);

    // Try to get next address
    var nonexistIndices = [],
        addrKeys = null;

    do {
        if ((addrKeys = this.getAddressKeys(++this.lastIssuedAddrIndex)) == null) {
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
            Catenis.db.collection.IssuedCatenisHubAddress.insert({
                type: this.extKeyType.name,
                addrIndex: nonexistIndex,
                issuedDate: issuedDate,
                status: 'nonexistent'
            });
        }, this);
    }

    var expirationDate = new Date(issuedDate.getTime());
    expirationDate.setSeconds(expirationDate.getSeconds() + cfgSettings.addressValidity[this.extKeyType.name]);

    Catenis.db.collection.IssuedCatenisHubAddress.insert({
        type: this.extKeyType.name,
        path: Catenis.keyStore.getTypeAndPathByAddress(addrKeys.getAddress()).path,
        addrIndex: this.lastIssuedAddrIndex,
        issuedDate: issuedDate,
        expirationDate: expirationDate,
        status: 'valid'
    });

    // Update in-use address indices
    this.lastInUseAddrIndex = this.lastIssuedAddrIndex;

    if (this.firstInUseAddrIndex < 0) {
        this.firstInUseAddrIndex = this.lastIssuedAddrIndex;
    }

    // Release waiting concurrence processing
    endProcessing.call(this);

    return addrKeys;
};

CatenisHubAddress.prototype.listAddressesInUse = function () {
    return this.firstInUseAddrIndex >= 0 && this.lastInUseAddrIndex >= 0 ? this.listAddressesInUse(this.firstInUseAddrIndex, this.lastInUseAddrIndex) : null;
};


// Module functions used to simulate private KeyStore object methods
//  NOTE: these functions need to be bound to a KeyStore object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

function startProcessing() {
    // Check if already processing
    var myTaskControl = taskControl[this.extKeyType.name];

    if (myTaskControl.processing) {
        // Wait until current processing task finishes to start processing
        let fut = new Future();

        myTaskControl.waitingTasks.push(fut);

        fut.wait();
    }

    myTaskControl.processing = true;
}

function endProcessing() {
    //Check if there are any waiting tasks
    var myTaskControl = taskControl[this.extKeyType.name];

    myTaskControl.processing = false;

    if (myTaskControl.waitingTasks.length > 0) {
        // Release oldest waiting task
        let fut = myTaskControl.waitingTasks.shift();

        fut.return();
    }
}

function updateInUseAddressIndices() {
    var docIssuedAddr = Catenis.db.collection.IssuedCatenisHubAddress.findOne({type: this.extKeyType.name, status: {$in: ['valid', 'expired']}}, {fields: {addrIndex: 1}, sort: {addrIndex: -1}});

    if (docIssuedAddr != null) {
        this.lastInUseAddrIndex = docIssuedAddr.addrIndex;

        this.firstInUseAddrIndex = Catenis.db.collection.IssuedCatenisHubAddress.findOne({type: this.extKeyType.name, status: {$in: ['valid', 'expired']}}, {fields: {addrIndex: 1}, sort: {addrIndex: 1}}).addrIndex;
    }
    else {
        this.lastInUseAddrIndex = this.firstInUseAddrIndex = -1;
    }
}


// KeyStore function class (public) methods
//

CatenisHubAddress.initialize = function () {
    // Instantiate CatenisHubAddress objects
    Catenis.ctnHubAddress = {
        fundingPayment: new CatenisHubAddress(Catenis.module.KeyStore.extKeyType.ctnd_fund_pay_addr),
        fundingChange: new CatenisHubAddress(Catenis.module.KeyStore.extKeyType.ctnd_fund_chg_addr),
        payTxExpense: new CatenisHubAddress(Catenis.module.KeyStore.extKeyType.ctnd_pay_tx_exp_addr)
    };

    // Set processing to update issued addresses to be executed periodically
    Catenis.logger.TRACE('Setting process to update issued Catenis Hub addresses to run periodically');
    updtIssuedAddrsIntervalHandle = Meteor.setInterval(updateIssuedAddresses, cfgSettings.updateIssuedAddressesInterval);
};

CatenisHubAddress.isAddressInUse = function (addr) {
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


// KeyStore function class (public) properties
//


// Definition of module (private) functions
//

function updateIssuedAddresses() {
    Catenis.logger.TRACE('Starting process to update issued Catenis Hub addresses');
    Catenis.ctnHubAddress.fundingPayment.updateIssuedAddresses();
    Catenis.ctnHubAddress.fundingChange.updateIssuedAddresses();
    Catenis.ctnHubAddress.payTxExpense.updateIssuedAddresses();
}


// Module code
//

// Definition of properties
Object.defineProperty(CatenisHubAddress, 'updtIssuedAddrsIntervalHandle', {
    get: function () {
        return updtIssuedAddrsIntervalHandle;
    },
    enumerable: true
});

// Save module function class reference
if (typeof Catenis === 'undefined')
    Catenis = {};

if (typeof Catenis.module === 'undefined')
    Catenis.module = {};

Catenis.module.CatenisHubAddress = Object.freeze(CatenisHubAddress);
