/**
 * Created by Claudio on 2019-10-30.
 */

//console.log('[BaseOffChainAddress.js]: This code just ran.');

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
const configBaseOCAddress = config.get('baseOffChainAddress');

// Configuration settings
const cfgSettings = {
    inactiveObjectTime: configBaseOCAddress.get('inactiveObjectTime'),
    deleteInactiveObjectsInterval: configBaseOCAddress.get('deleteInactiveObjectsInterval')
};

// Critical section object to avoid concurrent access to database
const dbCS = new CriticalSection();

let delInactiveObjectsIntervalHandle;


// Definition of function classes
//

// BaseDeviceOffChainAddress derived class
export class BaseDeviceOffChainAddress extends BaseOffChainAddress {
    constructor (ctnNodeIndex, clientIndex, deviceIndex) {
        super();
        this.type = KeyStore.extKeyType.dev_off_chain_addr.name;
        this.parentPath = KeyStore.deviceOffChainAddressRootPath(ctnNodeIndex, clientIndex, deviceIndex);

        // Make sure that an object of this class has not been instantiated yet
        if (hasInstantiatedObject(this.parentPath)) {
            Catenis.logger.ERROR(util.format('BaseDeviceOffChainAddress object for the given Catenis node, client and device indices (%d, %d and %d, respectively) has already been instantiated', ctnNodeIndex, clientIndex, deviceIndex));
            throw new Error(util.format('BaseDeviceOffChainAddress object for the given Catenis node, client and device indices (%d, %d and %d, respectively) has already been instantiated', ctnNodeIndex, clientIndex, deviceIndex));
        }

        // Assign address manipulation functions
        this._getAddressKeys = Catenis.keyStore.getDeviceOffChainAddressKeys.bind(Catenis.keyStore, ctnNodeIndex, clientIndex, deviceIndex);

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
        parentPath = parentPath || KeyStore.deviceOffChainAddressRootPath(ctnNodeIndex, clientIndex, deviceIndex);

        return hasInstantiatedObject(parentPath) ? getInstantiatedObject(parentPath)
            : new BaseDeviceOffChainAddress(ctnNodeIndex, clientIndex, deviceIndex);
    }
}

// BaseOffChainAddress function class
export function BaseOffChainAddress() {
    this.type = undefined;
    this.parentPath = undefined;
    this.lastIssuedAddrIndex = undefined;

    Object.defineProperties(this, {
        _getAddressKeys: {
            enumerable: false,
            writable: true,
            value: undefined
        }
    });
}


// Public BaseOffChainAddress object methods
//

BaseOffChainAddress.prototype.newAddressKeys = function () {
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

        // Save issued address
        const issuedDate = new Date();

        if (nonexistIndices.length > 0) {
            nonexistIndices.forEach((nonexistIndex) => {
                Catenis.db.collection.IssuedOffChainAddress.insert({
                    type: this.type,
                    parentPath: this.parentPath,
                    path: util.format('%s/%d', this.parentPath, nonexistIndex),
                    addrIndex: nonexistIndex,
                    issuedDate: issuedDate,
                    isNonExistent: true
                });
            });
        }

        Catenis.db.collection.IssuedOffChainAddress.insert({
            type: this.type,
            parentPath: this.parentPath,
            path: util.format('%s/%d', this.parentPath, this.lastIssuedAddrIndex),
            addrIndex: this.lastIssuedAddrIndex,
            pubKeyHash: addrKeys.getPubKeyHash().toString('base64'),
            issuedDate: issuedDate,
            isNonExistent: false
        });
    });

    return addrKeys;
};


// Module functions used to simulate private BaseOffChainAddress object methods
//  NOTE: these functions need to be bound to a BaseOffChainAddress object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

function setBoundingIndices() {
    const docIssuedAddr = Catenis.db.collection.IssuedOffChainAddress.findOne({
        parentPath: this.parentPath
    }, {
        fields: {addrIndex: 1},
        sort: {addrIndex: -1}
    });

    this.lastIssuedAddrIndex = docIssuedAddr !== undefined ? docIssuedAddr.addrIndex : -1;
}

// Reset off-chain address that has previously been created/allocated (via newAddressKeys() method)
//  to make it as if it has not been created/allocated yet
//
//  pubKeyHash: [string|Object(Buffer)]  // Public key hash of address to revert
//  addrIndex: [number]  // Index of address (last component of address path) to revert
function revertAddress(pubKeyHash, addrIndex) {
    if (Buffer.isBuffer(pubKeyHash)) {
        pubKeyHash = pubKeyHash.toString('base64');
    }

    let result = false;

    // Make sure that this is the last issued address
    if (addrIndex >= 0 && addrIndex === this.lastIssuedAddrIndex) {
        // Execute code in critical section to avoid DB concurrency
        dbCS.execute(() => {
            // Exclude address from database
            const count = Catenis.db.collection.IssuedOffChainAddress.remove({
                parentPath: this.parentPath,
                addrIndex: addrIndex,
                pubKeyHash: pubKeyHash
            });

            if (count > 0) {
                // Adjust indices
                if (addrIndex > 0) {
                    // Retrieve any nonexistent address indices
                    const docNonExistAddrs = Catenis.db.collection.IssuedOffChainAddress.find({
                        parentPath: this.parentPath,
                        isNonExistent: true
                    }, {
                        fields: {addrIndex: 1},
                        sort: {addrIndex: -1}
                    }).fetch();

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

                    this.lastIssuedAddrIndex = adjustIndex >= 0 ? adjustIndex : -1;
                }
                else {
                    this.lastIssuedAddrIndex = -1;
                }

                result = true;
            }

            // Also remove address from local key storage
            Catenis.keyStore.removeExtKeyByOffChainAddress(pubKeyHash);
        });
    }

    return result;
}


// BaseOffChainAddress function class (public) methods
//

BaseOffChainAddress.initialize = function () {
    Catenis.logger.TRACE('BaseOffChainAddress initialization');
    // Set recurring timer to delete inactive instantiated objects
    Catenis.logger.TRACE('Setting recurring timer to delete inactive instantiated objects');
    delInactiveObjectsIntervalHandle = Meteor.setInterval(deleteInactiveObjects, cfgSettings.deleteInactiveObjectsInterval);
};

// opts: {
//   type: [string],
//   pathParts: {
//   }
// }
BaseOffChainAddress.getInstance = function (opts) {
    // Call getInstance method of corresponding derived class
    let drvClass,
        classInstance = null;

    if ((drvClass = classByType[opts.type]) !== undefined) {
        classInstance = drvClass.getInstance(opts.pathParts);
    }

    return classInstance;
};

// Place off-chain address back onto local key storage
BaseOffChainAddress.reloadAddress = function (pubKeyHash) {
    if (Buffer.isBuffer(pubKeyHash)) {
        pubKeyHash = pubKeyHash.toString('base64');
    }

    // Try to retrieve off-chain address from database
    const docIssuedAddr = Catenis.db.collection.IssuedOffChainAddress.findOne({
        pubKeyHash: pubKeyHash
    }, {
        fields: {type: 1, path: 1, addrIndex: 1}
    });
    let result = false;

    if (docIssuedAddr) {
        const addrKeys = Catenis.keyStore.getCryptoKeysByPath(docIssuedAddr.path);

        // Make sure that address is not yet in local key storage
        if (addrKeys === null) {
            let classInstance = BaseOffChainAddress.getInstance({type: docIssuedAddr.type, pathParts: KeyStore.getPathParts(docIssuedAddr)});

            if (classInstance !== null) {
                // Store address in local key storage
                result = classInstance._getAddressKeys(docIssuedAddr.addrIndex) !== null;
            }
        }
    }

    return result;
};

BaseOffChainAddress.revertAddress = function (pubKeyHash) {
    if (Buffer.isBuffer(pubKeyHash)) {
        pubKeyHash = pubKeyHash.toString('base64');
    }

    const addrTypeAndPath = Catenis.keyStore.getTypeAndPathByOffChainAddress(pubKeyHash);
    let result = false;

    if (addrTypeAndPath !== null) {
        let addrPathParts = KeyStore.getPathParts(addrTypeAndPath),
            classInstance = BaseOffChainAddress.getInstance({type: addrTypeAndPath.type, pathParts: addrPathParts});

        if (classInstance !== null) {
            // Revert address
            result = revertAddress.call(classInstance, pubKeyHash, addrPathParts.addrIndex);
        }
    }

    return result;
};


// BaseOffChainAddress function class (public) properties
//

BaseOffChainAddress.instantiatedObjects = new Map();


// Definition of module (private) functions
//

function deleteInactiveObjects() {
    Catenis.logger.TRACE('Executing process to delete inactive objects');
    // Calculate earliest date/time for instantiated object to have been accessed for it not to
    //  be considered inactive
    const activeObjEarliestTime = new Date();
    activeObjEarliestTime.setSeconds(activeObjEarliestTime.getSeconds() - cfgSettings.inactiveObjectTime);

    const activeObjEarliestTimestamp = activeObjEarliestTime.getTime();

    // Identify inactive objects and delete them
    for (let [parentPath, objEntry] of BaseOffChainAddress.instantiatedObjects.entries()) {
        if (objEntry.lastAccessTimestamp < activeObjEarliestTimestamp) {
            deleteInstantiatedObject(parentPath);
        }
    }
}

function hasInstantiatedObject(parentPath) {
    return BaseOffChainAddress.instantiatedObjects.has(parentPath);
}

function setInstantiatedObject(parentPath, obj) {
    BaseOffChainAddress.instantiatedObjects.set(parentPath, {obj: obj, lastAccessTimestamp: Date.now()});
}

function getInstantiatedObject(parentPath) {
    const objEntry = BaseOffChainAddress.instantiatedObjects.get(parentPath);
    let obj = null;

    if (objEntry !== undefined) {
        obj = objEntry.obj;
        objEntry.lastAccessTimestamp = Date.now();
    }

    return obj;
}

function deleteInstantiatedObject(parentPath) {
    if (BaseOffChainAddress.instantiatedObjects.delete(parentPath)) {
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
    dev_off_chain_addr: BaseDeviceOffChainAddress
};

// Definition of properties
Object.defineProperties(BaseOffChainAddress, {
    delInactiveObjectsIntervalHandle: {
        get: function () {
            return delInactiveObjectsIntervalHandle;
        },
        enumerable: true
    }
});

// Lock function classes
Object.freeze(BaseOffChainAddress);
Object.freeze(BaseDeviceOffChainAddress);
