/**
 * Created by claudio on 10/03/16.
 */

//console.log('[KeyStore.js]: This code just ran.');

// Fix default config file folder.
//  Note: this is necessary because process.cwd()
//  (which is used by the config module to define the
//  default config folder) does not point to the
//  Meteor application folder. Instead, the application
//  folder is gotten from process.env.PWD and set
//  to the environment variable NODE_CONFIG_DIR,
//  which is used by the config module to set the
//  default config folder if it is defined.
if (process.env.NODE_CONFIG_DIR === undefined) {
    process.env.NODE_CONFIG_DIR = Npm.require('path').join(process.env.PWD, 'config');
}

// References to external modules
var util = Npm.require('util');
var loki = Npm.require('lokijs');
var bitcoin = Npm.require('bitcoinjs-lib');

//  NOTE: all crypto keys/addresses used by the application are synthesized by
//      means of an HD (hierarchical deterministic) wallet mechanism according
//      to the following rules:
//
//      m -> master HD extended key
//
//      m/0 -> Catenis (system) root HD extended key
//
//      m/0/0 -> Catenis (system) device root HD extended key
//
//      m/0/1 -> Catenis (system) general external addresses root HD extended key
//
//      m/0/2 -> Catenis (system) general internal addresses root HD extended key
//
//      m/0/0/0 -> Catenis (system) device main address HD extended key
//      m/0/0/1 -> Catenis (system) device reserved addressed #1 HD extended key
//      m/0/0/2 -> Catenis (system) device reserved addressed #2 HD extended key
//      m/0/0/3 -> Catenis (system) device reserved addressed #3 HD extended key
//      m/0/0/4 -> Catenis (system) device reserved addressed #4 HD extended key
//      m/0/0/5 -> Catenis (system) device reserved addressed #5 HD extended key
//      m/0/0/6 -> Catenis (system) device reserved addressed #6 HD extended key
//      m/0/0/7 -> Catenis (system) device reserved addressed #7 HD extended key
//      m/0/0/8 -> Catenis (system) device reserved addressed #8 HD extended key
//      m/0/0/9 -> Catenis (system) device reserved addressed #9 HD extended key
//
//      m/0/1/* -> Catenis (system) funding (external) addresses HD extended keys (used to add funds to system to then
// be distributed to other addresses (system internal/client service credit/device) as needed)
//
//      m/0/2/* -> Catenis (system) pay fee (internal) addresses HD extended keys (used to pay for transaction fees)
//
//      m/i (i>=1) -> client #i root HD extended key
//
//      m/i/0 (i>=1) -> client #i service credit address HD extended key (used to pay for services: dust amount = 1 credit)
//
//      m/i/j (i,j>=1) -> device #j of client #i root HD extended key
//
//      m/i/j/0 (i,j>=1) -> device #j of client #i main address HD extended key
//      m/i/j/1 (i,j>=1) -> device #j of client #i read (confirmation) address HD extended key
//      m/i/j/2 (i,j>=1) -> device #j of client #i reserved address #1 HD extended key
//      m/i/j/3 (i,j>=1) -> device #j of client #i reserved address #2 HD extended key
//      m/i/j/4 (i,j>=1) -> device #j of client #i reserved address #3 HD extended key
//      m/i/j/5 (i,j>=1) -> device #j of client #i reserved address #4 HD extended key
//      m/i/j/6 (i,j>=1) -> device #j of client #i reserved address #5 HD extended key
//      m/i/j/7 (i,j>=1) -> device #j of client #i reserved address #6 HD extended key
//      m/i/j/8 (i,j>=1) -> device #j of client #i reserved address #7 HD extended key
//      m/i/j/9 (i,j>=1) -> device #j of client #i reserved address #8 HD extended key
//
//  Please refer to BIP-32 (https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki) for more information.
//
//  IMPORTANT: there is a possibility (even though very remote) that an HD extended key cannot be derived for
//      a given index. In that case, the algorithm uses the next index instead.

// Module variables
var numDeviceAddresses = 10;

// Definition of function classes
//

// KeyStore function class
function KeyStore() {
    // Initialize in-memory database
    this.db = new loki();
    this.collExtKey = this.db.addCollection('ExtendedKey', {indices: ['path', 'parentPath', 'depth', 'index']});

    // Create master HD extended key and store it
    this.masterHDNode = bitcoin.HDNode.fromSeedBuffer(Catenis.application.seed, Catenis.application.cryptoNetwork);
    storeHDNode.call(this, 'm', this.masterHDNode);

    // Create Catenis (system) root HD extended key and store it
    this.catenisRootHDNode = this.masterHDNode.derive(0);

    if (this.catenisRootHDNode.index !== 0) {
        Catenis.logger.ERROR('Catenis (system) root HD extended key (m/0) derived with an unexpected index', {expectedIndex: 0, returnedIndex: this.catenisRootHDNode.index});
        throw new Error('Catenis (system) root HD extended key (m/0) could not be derived for index 0');
    }

    storeHDNode.call(this, 'm/0', this.catenisRootHDNode);

    // Create Catenis (system) device root HD extended key and store it
    this.catenisDeviceRootHDNode = this.catenisRootHDNode.derive(0);

    if (this.catenisDeviceRootHDNode.index !== 0) {
        Catenis.logger.ERROR('Catenis (system) device root HD extended key (m/0/0) derived with an unexpected index', {expectedIndex: 0, returnedIndex: this.catenisDeviceRootHDNode.index});
        throw new Error('Catenis (system) device root HD extended key (m/0/0) could not be derived for index 0');
    }

    storeHDNode.call(this, 'm/0/0', this.catenisDeviceRootHDNode);

    // Create Catenis (system) general external root HD extended key and store it
    this.catenisGenExternRootHDNode = this.catenisRootHDNode.derive(1);

    if (this.catenisGenExternRootHDNode.index !== 1) {
        Catenis.logger.ERROR('Catenis (system) general external addresses root HD extended key (m/0/1) derived with an unexpected index', {expectedIndex: 1, returnedIndex: this.catenisGenExternRootHDNode.index});
        throw new Error('Catenis (system) general external addresses root HD extended key (m/0/1) could not be derived for index 0');
    }

    storeHDNode.call(this, 'm/0/1', this.catenisGenExternRootHDNode);

    // Create Catenis (system) general internal root HD extended key and store it
    this.catenisGenInternRootHDNode = this.catenisRootHDNode.derive(2);

    if (this.catenisGenInternRootHDNode.index !== 2) {
        Catenis.logger.ERROR('Catenis (system) general internal addresses root HD extended key (m/0/2) derived with an unexpected index', {expectedIndex: 2, returnedIndex: this.catenisGenInternRootHDNode.index});
        throw new Error('Catenis (system) general internal addresses root HD extended key (m/0/2) could not be derived for index 0');
    }

    storeHDNode.call(this, 'm/0/2', this.catenisGenInternRootHDNode);

    // Create Catenis (system) device addresses HD extended keys
    this.catenisDeviceAddrHDNodes = [];

    for (let idx = 0; idx < numDeviceAddresses; idx++) {
        var path = util.format('m/0/0/%d', idx),
            catenisDeviceAddrHDNode = this.catenisDeviceRootHDNode.derive(idx);

        this.catenisDeviceAddrHDNodes.push(catenisDeviceAddrHDNode);

        if (catenisDeviceAddrHDNode.index !== idx) {
            Catenis.logger.ERROR(util.format('Catenis (system) device address #%d HD extended key (%s) derived with an unexpected index', idx + 1, path), {expectedIndex: idx, returnedIndex: catenisDeviceAddrHDNode.index});
            throw new Error(util.format('Catenis (system) device address #%d HD extended key (%s) could not be derived for index %d', idx + 1, path, idx));
        }

        storeHDNode.call(this, path, catenisDeviceAddrHDNode);
    }

    this.catenisDeviceMainAddrHDNode = this.catenisDeviceAddrHDNodes[0];
}


// Public KeyStore object methods
//

KeyStore.prototype.getClientServiceCreditAddressKeys = function (clientIndex) {
    // Validate client index
    if (!isValidClientIndex(clientIndex)) {
        Catenis.logger.ERROR('KeyStore.getClientServiceCreditKeys method called with invalid argument', {clientIndex: clientIndex});
        throw Error('Invalid client index argument');
    }

    // Get root HD extended key for client with given index
    var clientRootHDNode = getClientRootHDNode.call(this, clientIndex),
        clientServCreditAddrKeys = null;

    if (clientRootHDNode != null) {
        // Try to retrieve service credit address HD extended key for client with given index
        var path = util.format('m/%d/0', clientIndex),
            clientServCreditAddrHDNode = retrieveHDNode.call(this, path);

        if (clientServCreditAddrHDNode == null) {
            // Client service credit address HD extended key does not exist yet. Create it
            clientServCreditAddrHDNode = clientRootHDNode.derive(0);

            if (clientServCreditAddrHDNode.index !== 0) {
                Catenis.logger.WARN(util.format('Client service credit address HD extended key (%s) derived with an unexpected index', path), {expectedIndex: 0, returnedIndex: clientServCreditAddrHDNode.index});
                clientServCreditAddrHDNode = null;
            }
            else {
                // Store created HD extended key
                storeHDNode.call(this, path, clientServCreditAddrHDNode);
            }
        }
    }

    if (clientServCreditAddrHDNode != null) {
        clientServCreditAddrKeys = new Catenis.module.CryptoKeys(clientServCreditAddrHDNode.keyPair);
    }

    return clientServCreditAddrKeys;
}

KeyStore.prototype.getDeviceAddressKeys = function (clientIndex, deviceIndex, addressIndex) {
    // Validate arguments
    var errArg = {};

    if (!isValidClientIndex(clientIndex)) {
        errArg.clientIndex = clientIndex;
    }

    if (!isValidDeviceIndex(deviceIndex)) {
        errArg.deviceIndex = deviceIndex;
    }

    if (!isValidDeviceAddressIndex(addressIndex)) {
        errArg.addressIndex = addressIndex;
    }

    if (Object.keys(errArg).length > 0) {
        var errArgs = Object.keys(errArg);

        Catenis.logger.ERROR(util.format('KeyStore.getDeviceAddressKeys method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s index argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    // Get root HD extended key for device of given client with given index
    var deviceRootHDNode = getDeviceRootHDNode.call(this, clientIndex, deviceIndex),
        deviceAddrKeys = null;

    if (deviceRootHDNode != null) {
        // Try to retrieve device address HD extended key for device of given client with given index
        var path = util.format('m/%d/%d/%d', clientIndex, deviceIndex, addressIndex),
            deviceAddrHDNode = retrieveHDNode.call(this, path);

        if (deviceAddrHDNode == null) {
            // Device address HD extended key does not exist yet. Create it
            //  NOTE: this should never happen since device addresses are pre-created
            //      when the device root HD extended key is crated.
            Catenis.logger.WARN(util.format('Device address HD extended key (%s) not yet created even though device root HD extended key is already created', path));
            deviceAddrHDNode = deviceRootHDNode.derive(addressIndex);

            if (deviceAddrHDNode.index !== 0) {
                Catenis.logger.WARN(util.format('Device address HD extended key (%s) derived with an unexpected index', path), {expectedIndex: addressIndex, returnedIndex: deviceAddrHDNode.index});
                deviceAddrHDNode = null;
            }
            else {
                // Store created HD extended key
                storeHDNode.call(this, path, deviceAddrHDNode);
            }
        }
    }

    if (deviceAddrHDNode != null) {
        deviceAddrKeys = new Catenis.module.CryptoKeys(deviceAddrHDNode.keyPair);
    }

    return deviceAddrKeys;
}

KeyStore.prototype.getDeviceMainAddressKeys = function (clientIndex, deviceIndex) {
    return this.getDeviceAddressKeys(clientIndex, deviceIndex, 0);
}

KeyStore.prototype.getDeviceReadAddressKeys = function (clientIndex, deviceIndex) {
    return this.getDeviceAddressKeys(clientIndex, deviceIndex, 1);
}

KeyStore.prototype.getCatenisFundingAddressKeys = function (addressIndex) {
    // Validate address index
    if (!isValidAddressIndex(addressIndex)) {
        Catenis.logger.ERROR('KeyStore.getCatenisFundingAddressKeys method called with invalid argument', {addressIndex: addressIndex});
        throw Error('Invalid address index argument');
    }

    // Try to retrieve Catenis (system) funding address HD extended key with the given index
    var path = util.format('m/0/1/%d', addressIndex),
        catenisFundingAddrKeys = null,
        catenisFundingAddrHDNode = retrieveHDNode.call(this, path);

    if (catenisFundingAddrHDNode == null) {
        // Catenis (system) funding address HD extended key does not exist yet. Create it
        catenisFundingAddrHDNode = this.catenisGenExternRootHDNode.derive(addressIndex);

        if (catenisFundingAddrHDNode.index !== addressIndex) {
            Catenis.logger.WARN(util.format('Catenis (system) funding address HD extended key (%s) derived with an unexpected index', path), {expectedIndex: addressIndex, returnedIndex: catenisFundingAddrHDNode.index});
            catenisFundingAddrHDNode = null;
        }
        else {
            // Store created HD extended key
            storeHDNode.call(this, path, catenisFundingAddrHDNode);
        }
    }

    if (catenisFundingAddrHDNode != null) {
        catenisFundingAddrKeys = new Catenis.module.CryptoKeys(catenisFundingAddrHDNode.keyPair);
    }

    return catenisFundingAddrKeys;
}

KeyStore.prototype.getCatenisPayFeeAddressKeys = function (addressIndex) {
    // Validate address index
    if (!isValidAddressIndex(addressIndex)) {
        Catenis.logger.ERROR('KeyStore.getCatenisPayFeeAddressKeys method called with invalid argument', {addressIndex: addressIndex});
        throw Error('Invalid address index argument');
    }

    // Try to retrieve Catenis (system) pay fee address HD extended key with the given index
    var path = util.format('m/0/2/%d', addressIndex),
        catenisPayFeeAddrKeys = null,
        catenisPayFeeAddrHDNode = retrieveHDNode.call(this, path);

    if (catenisPayFeeAddrHDNode == null) {
        // Catenis (system) pay fee address HD extended key does not exist yet. Create it
        catenisPayFeeAddrHDNode = this.catenisGenInternRootHDNode.derive(addressIndex);

        if (catenisPayFeeAddrHDNode.index !== addressIndex) {
            Catenis.logger.WARN(util.format('Catenis (system) pay fee address HD extended key (%s) derived with an unexpected index', path), {expectedIndex: addressIndex, returnedIndex: catenisPayFeeAddrHDNode.index});
            catenisPayFeeAddrHDNode = null;
        }
        else {
            // Store created HD extended key
            storeHDNode.call(this, path, catenisPayFeeAddrHDNode);
        }
    }

    if (catenisPayFeeAddrHDNode != null) {
        catenisPayFeeAddrKeys = new Catenis.module.CryptoKeys(catenisPayFeeAddrHDNode.keyPair);
    }

    return catenisPayFeeAddrKeys;
}

KeyStore.prototype.getCatenisDeviceAddressKeys = function (addressIndex) {
    // Validate address index
    if (!isValidDeviceAddressIndex(addressIndex)) {
        Catenis.logger.ERROR('KeyStore.getCatenisDeviceAddressKeys method called with invalid argument', {addressIndex: addressIndex});
        throw Error('Invalid address index argument');
    }

    return new Catenis.module.CryptoKeys(this.catenisDeviceAddrHDNodes[addressIndex]);
}

KeyStore.prototype.getCatenisDeviceMainAddressKeys = function () {
    return new Catenis.module.CryptoKeys(this.catenisDeviceMainAddrHDNode);
}


// Module functions used to simulate private KeyStore object methods
//  NOTE: these functions need to be bound to a KeyStore object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

function storeHDNode(path, hdNode) {
    var doc = {path: path, parentPath: parentPath(path), depth: hdNode.depth, index: hdNode.index, strHDNode: hdNode.toBase58()};
    this.collExtKey.insert(doc);
}

function retrieveHDNode(path) {
    var doc = this.collExtKey.findOne({path: path});
    return doc != null ? bitcoin.HDNode.fromBase58(doc.strHDNode, Catenis.application.cryptoNetwork) : null;
}

function getClientRootHDNode(clientIndex) {
    // Try to retrieve root HD extended key for client with given index
    var path = util.format('m/%d', clientIndex),
        clientRootHDNode = retrieveHDNode.call(this, path);

    if (clientRootHDNode == null) {
        // Client root HD extended key does not exist yet. Create it
        clientRootHDNode = this.masterHDNode.derive(clientIndex);

        if (clientRootHDNode.index !== clientIndex) {
            Catenis.logger.WARN(util.format('Client root HD extended key (%s) derived with an unexpected index', path), {expectedIndex: clientIndex, returnedIndex: clientRootHDNode.index});
            clientRootHDNode = null;
        }
        else {
            // Store created HD extended key
            storeHDNode.call(this, path, clientRootHDNode);
        }
    }

    return clientRootHDNode;
}

function getDeviceRootHDNode(clientIndex, deviceIndex) {
    // Get root HD extended key for client with given index
    var clientRootHDNode = getClientRootHDNode.call(this, clientIndex),
        path = util.format('m/%d/%d', clientIndex, deviceIndex),
        deviceRootHDNode = null,
        hdNodesToStore = [];

    if (clientRootHDNode != null) {
        // Try to retrieve root HD extended key for client device with given index
        deviceRootHDNode = retrieveHDNode.call(this, path);

        if (deviceRootHDNode == null) {
            // Device root HD extended key does not exist yet. Create it
            deviceRootHDNode = clientRootHDNode.derive(deviceIndex);

            if (deviceRootHDNode.index !== deviceIndex) {
                Catenis.logger.WARN(util.format('Device root HD extended key (%s) derived with an unexpected index', path), {expectedIndex: deviceIndex, returnedIndex: deviceRootHDNode.index});
                deviceRootHDNode = null;
            }
            else {
                // Save newly created HD extended key to store it later
                hdNodesToStore.push({path: path, hdNode: deviceRootHDNode});
            }
        }
    }

    if (deviceRootHDNode != null && hdNodesToStore.length > 0) {
        // Make sure that all defined/reserved device addresses can be
        //  derived with their proper index before storing device root HD extended key
        for (var idx = 0; idx < numDeviceAddresses; idx++) {
            var hdNodeInfo = getDeviceAddressHDNodeInfo.call(this, deviceRootHDNode, path, idx);

            if (hdNodeInfo.hdNode == null) {
                // Device address could not be derived with its proper index.
                //  Invalidate device root HD extended key
                deviceRootHDNode = null;
                break;
            }
            else if (hdNodeInfo.storeHDNode) {
                hdNodesToStore.push({path: hdNodeInfo.path, hdNode: hdNodeInfo.hdNode});
            }
        }

        if (deviceRootHDNode != null) {
            // Store all newly created HD extended keys
            hdNodesToStore.forEach((function (hdNodeToStore) {
                storeHDNode.call(this, hdNodeToStore.path, hdNodeToStore.hdNode);
            }).bind(this));
        }
    }

    return deviceRootHDNode;
}

function getDeviceAddressHDNodeInfo(deviceRootHDNode, parentPath, addressIndex) {
    // Try to retrieve device address HD extended key for given parent and address index
    var path = util.format('%s/%d', parentPath, addressIndex),
        deviceAddrHDNode = retrieveHDNode.call(this, path),
        storeHDNode = false;

    if (deviceAddrHDNode == null) {
        // Device address HD extended key does not exist yet. Create it
        deviceAddrHDNode = deviceRootHDNode.derive(addressIndex);

        if (deviceAddrHDNode.index !== addressIndex) {
            Catenis.logger.WARN(util.format('Device address HD extended key (%s) derived with an unexpected index', path), {expectedIndex: addressIndex, returnedIndex: deviceAddrHDNode.index});
            deviceAddrHDNode = null;
        }
        else {
            // Indicate the newly created HD extended key should be stored
            storeHDNode = true;
        }
    }

    return {path: path, hdNode: deviceAddrHDNode, storeHDNode: storeHDNode};
}

// KeyStore function class (public) methods
//

KeyStore.initialize = function () {
    // Instantiate KeyStore object
    Catenis.keyStore = new KeyStore();
};


// Definition of module (private) functions
//

function parentPath(path) {
    var parentPath,
        pos = path.lastIndexOf('/');

    if (pos != -1) {
        parentPath = path.slice(0, pos);
    }

    return parentPath != undefined ? parentPath : null;
}

function isValidClientIndex(index) {
    return typeof index === 'number' && Number.isInteger(index) && index > 0;
}

function isValidDeviceIndex(index) {
    return typeof index === 'number' && Number.isInteger(index) && index > 0;
}

function isValidDeviceAddressIndex(index) {
    return typeof index === 'number' && Number.isInteger(index) && index >= 0 && index < numDeviceAddresses;
}

function isValidAddressIndex(index) {
    return typeof index === 'number' && Number.isInteger(index) && index >= 0;
}


// Module code
//

// Save module function class reference
if (typeof Catenis === 'undefined')
    Catenis = {};

if (typeof Catenis.module === 'undefined')
    Catenis.module = {};

Catenis.module.KeyStore = KeyStore;