/**
 * Created by claudio on 10/03/16.
 */

//console.log('[KeyStore.js]: This code just ran.');

//  NOTE: all crypto keys/addresses used by the application are synthesized by
//      means of an HD (hierarchical deterministic) wallet mechanism according
//      to the following rules:
//
//      m -> master HD extended key
//
//      m/0 -> System root HD extended key
//
//      m/0/k (k>=0) -> Catenis node root HD extended key
//                        where: k = 0 -> Catenis Hub node
//                               k >= 1 -> Catenis Gateway #k node
//
//      m/0/k/0 (k>=0) -> Catenis node device root HD extended key
//
//      m/0/k/1 (k>=0) -> Catenis node funding root HD extended key
//
//      m/0/k/2 (k>=0) -> Catenis node pay tx expense root HD extended key
//
//      m/0/k/0/0 (k>=0) -> Catenis node device main addresses root HD extended key
//      m/0/k/0/1 (k>=0) -> Catenis node device (reserved) addresses #2 root HD extended key
//      m/0/k/0/2 (k>=0) -> Catenis node device (reserved) addresses #3 root HD extended key
//      m/0/k/0/3 (k>=0) -> Catenis node device (reserved) addresses #4 root HD extended key
//      m/0/k/0/4 (k>=0) -> Catenis node device (reserved) addresses #5 root HD extended key
//      m/0/k/0/5 (k>=0) -> Catenis node device (reserved) addresses #6 root HD extended key
//      m/0/k/0/6 (k>=0) -> Catenis node device (reserved) addresses #7 root HD extended key
//      m/0/k/0/7 (k>=0) -> Catenis node device (reserved) addresses #8 root HD extended key
//      m/0/k/0/8 (k>=0) -> Catenis node device (reserved) addresses #9 root HD extended key
//      m/0/k/0/9 (k>=0) -> Catenis node device (reserved) addresses #10 root HD extended key
//
//      m/0/k/0/0/* (k>=0) -> Catenis node device main addresses HD extended key
//
//      m/0/k/1/0 (k>=0) -> Catenis node funding payment root HD extended key
//
//      m/0/k/1/1 (k>=0) -> Catenis node funding change root HD extended key
//
//      m/0/k/1/0/* (k>=0) -> Catenis node funding payment addresses HD extended keys (used to add funds to Catenis node)
//
//      m/0/k/1/1/* (k>=0) -> Catenis node funding change addresses HD extended keys (used to hold change from funds)
//
//      m/0/k/2/* (k>=0) -> Catenis node pay tx expense addresses HD extended keys (used to pay for transaction fees)
//
//      m/i (i>=1) -> client #i root HD extended key
//
//      m/i/0 (i>=1) -> client #i internal hierarchy root HD extended key
//
//      m/i/1 (i>=1) -> client #i public hierarchy root HD extended key
//
//      m/i/0/0 (i>=1) -> client #i internal root HD extended key
//
//      m/i/0/0/0 (i>=1) -> client #i service credit root HD extended key
//
//      m/i/0/0/0/0 (i>=1) -> client #i message credit addresses root HD extended key
//      m/i/0/0/0/1 (i>=1) -> client #i asset credit addresses root HD extended key
//      m/i/0/0/0/2 (i>=1) -> client #i service credit (reserved) address #3 root HD extended key
//      m/i/0/0/0/3 (i>=1) -> client #i service credit (reserved) address #4 root HD extended key
//      m/i/0/0/0/4 (i>=1) -> client #i service credit (reserved) address #5 root HD extended key
//      m/i/0/0/0/5 (i>=1) -> client #i service credit (reserved) address #6 root HD extended key
//      m/i/0/0/0/6 (i>=1) -> client #i service credit (reserved) address #7 root HD extended key
//      m/i/0/0/0/7 (i>=1) -> client #i service credit (reserved) address #8 root HD extended key
//      m/i/0/0/0/8 (i>=1) -> client #i service credit (reserved) address #9 root HD extended key
//      m/i/0/0/0/9 (i>=1) -> client #i service credit (reserved) address #10 root HD extended key
//
//      m/i/0/0/0/0/* (i>=1) -> client #i message credit addresses HD extended key
//      m/i/0/0/0/1/* (i>=1) -> client #i asset credit addresses HD extended key
//
//      m/i/0/j (i,j>=1) -> device #j of client #i internal root HD extended key
//
//      m/i/0/j/0 (i,j>=1) -> device #j of client #i read confirmation addresses root HD extended key
//      m/i/0/j/1 (i,j>=1) -> device #j of client #i internal (reserved) addresses #2 root HD extended key
//      m/i/0/j/2 (i,j>=1) -> device #j of client #i internal (reserved) addresses #3 root HD extended key
//      m/i/0/j/3 (i,j>=1) -> device #j of client #i internal (reserved) addresses #4 root HD extended key
//      m/i/0/j/4 (i,j>=1) -> device #j of client #i internal (reserved) addresses #5 root HD extended key
//      m/i/0/j/5 (i,j>=1) -> device #j of client #i internal (reserved) addresses #6 root HD extended key
//      m/i/0/j/6 (i,j>=1) -> device #j of client #i internal (reserved) addresses #7 root HD extended key
//      m/i/0/j/7 (i,j>=1) -> device #j of client #i internal (reserved) addresses #8 root HD extended key
//      m/i/0/j/8 (i,j>=1) -> device #j of client #i internal (reserved) addresses #9 root HD extended key
//      m/i/0/j/9 (i,j>=1) -> device #j of client #i internal (reserved) addresses #10 root HD extended key
//
//      m/i/0/j/0/* (i,j>=1) -> device #j of client #i read confirmation addresses HD extended key
//
//      m/i/1/j (i,j>=1) -> device #j of client #i public root HD extended key
//
//      m/i/1/j/0 (i,j>=1) -> device #j of client #i main addresses root HD extended key
//      m/i/1/j/1 (i,j>=1) -> device #j of client #i asset addresses root HD extended key
//      m/i/1/j/2 (i,j>=1) -> device #j of client #i asset issuance addresses root HD extended key (used only to issue unlocked type of Colored Coins assets)
//      m/i/1/j/3 (i,j>=1) -> device #j of client #i public (reserved) addresses #4 root HD extended key
//      m/i/1/j/4 (i,j>=1) -> device #j of client #i public (reserved) addresses #5 root HD extended key
//      m/i/1/j/5 (i,j>=1) -> device #j of client #i public (reserved) addresses #6 root HD extended key
//      m/i/1/j/6 (i,j>=1) -> device #j of client #i public (reserved) addresses #7 root HD extended key
//      m/i/1/j/7 (i,j>=1) -> device #j of client #i public (reserved) addresses #8 root HD extended key
//      m/i/1/j/8 (i,j>=1) -> device #j of client #i public (reserved) addresses #9 root HD extended key
//      m/i/1/j/9 (i,j>=1) -> device #j of client #i public (reserved) addresses #10 root HD extended key
//
//      m/i/1/j/0/* (i,j>=1) -> device #j of client #i main addresses HD extended key
//      m/i/1/j/1/* (i,j>=1) -> device #j of client #i asset addresses HD extended key
//      m/i/1/j/2/* (i,j>=1) -> device #j of client #i asset issuance addresses HD extended key
//
//  Please refer to BIP-32 (https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki) for more information.
//
//  IMPORTANT: there is a possibility (even though very remote) that an HD extended key cannot be derived for
//      a given index. In that case, the algorithm uses the next index instead.

// Module variables
//

// References to external modules
var util = Npm.require('util');
var loki = Npm.require('lokijs');
var bitcoinLib = Npm.require('bitcoinjs-lib');
var config = Npm.require('config');

// Config entries
var configKeyStore = config.get('keyStore');

// Configuration settings
var cfgSettings = {
    obsoleteExtKeyTimeToPurge: configKeyStore.get('obsoleteExtKeyTimeToPurge'),
    purgeUnusedExtKeyInterval: configKeyStore.get('purgeUnusedExtKeyInterval')
};

const numServiceCreditAddrRoots = 10,
      numDeviceAddrRoots = 10,
      numUsedCtnNodeDeviceAddrRoots = 1,
      numUsedServiceCreditAddrRoots = 2,
      numUsedDeviceIntAddrRoots = 1,
      numUsedDevicePubAddrRoots = 3;

var purgeUnusedExtKeyInternalHandle;

// Definition of function classes
//

// KeyStore function class
//
// Internal storage (loki DB collection) structure: {
//      type: [string],
//      path: [string],
//      parentPath: [string],
//      depth: [integer],
//      index: [integer],
//      strHDNode: [string],
//      address: [string],
//      isLeaf: [boolean],
//      isReserved: [boolean],
//      isObsolete: [boolean]
//  }
function KeyStore(ctnHubNodeIndex, seed, cryptoNetwork) {
    this.ctnHubNodeIndex = ctnHubNodeIndex;
    this.cryptoNetwork = cryptoNetwork;

    // Initialize in-memory database
    this.db = new loki();
    this.collExtKey = this.db.addCollection('ExtendedKey', {indices: ['type', 'path', 'parentPath', 'index', 'address']});

    this.collExtKey.ensureUniqueIndex('path');
    this.collExtKey.ensureUniqueIndex('address');

    // Create master HD extended key and store it
    this.masterHDNode = bitcoinLib.HDNode.fromSeedBuffer(seed, cryptoNetwork);
    storeHDNode.call(this, 'mstr', 'm', this.masterHDNode);

    // Create system root HD extended key and store it
    this.sysRootHDNode = this.masterHDNode.derive(0);

    if (this.sysRootHDNode.index !== 0) {
        Catenis.logger.ERROR('System root HD extended key (m/0) derived with an unexpected index', {expectedIndex: 0, returnedIndex: this.sysRootHDNode.index});
        throw new Error('System root HD extended key (m/0) could not be derived');
    }

    storeHDNode.call(this, 'sys_root', 'm/0', this.sysRootHDNode);

    //  Try to initialize Catenis Hub HD extended keys
    if (! this.initCatenisNodeHDNodes(ctnHubNodeIndex)) {
        Catenis.logger.ERROR(util.format('HD extended keys for Catenis Hub (node index %d) could not be initialized', ctnHubNodeIndex));
        throw new Error(util.format('HD extended keys for Catenis Hub (node index %d) could not be initialized', ctnHubNodeIndex));
    }
}


// Public KeyStore object methods
//

KeyStore.prototype.removeExtKeyByAddress = function (addr) {
    this.collExtKey.removeWhere({address: addr});
};

KeyStore.prototype.removeExtKeysByParentPath = function (parentPath) {
    this.collExtKey.removeWhere({parentPath: parentPath});
};

KeyStore.prototype.getCryptoKeysByPath = function (path) {
    var docExtKey = this.collExtKey.by('path', path);

    return docExtKey != undefined ? new Catenis.module.CryptoKeys(bitcoinLib.HDNode.fromBase58(docExtKey.strHDNode, this.cryptoNetwork).keyPair) : null;
};

KeyStore.prototype.getCryptoKeysByAddress = function (addr) {
    var docExtKey = this.collExtKey.by('address', addr);

    return docExtKey != undefined ? new Catenis.module.CryptoKeys(bitcoinLib.HDNode.fromBase58(docExtKey.strHDNode, this.cryptoNetwork).keyPair) : null;
};

KeyStore.prototype.getTypeAndPathByAddress = function (addr) {
    var docExtKey = this.collExtKey.by('address', addr);

    return docExtKey != undefined ? {type: docExtKey.type, path: docExtKey.path} : null;
};

KeyStore.prototype.getAddressInfo = function (addr, retrieveObsolete = false) {
    var addrInfo = null;
    
    do {
        var docExtKey = this.collExtKey.by('address', addr),
            tryAgain = false;

        if (docExtKey != undefined) {
            addrInfo = {
                cryptoKeys: new Catenis.module.CryptoKeys(bitcoinLib.HDNode.fromBase58(docExtKey.strHDNode, this.cryptoNetwork).keyPair),
                type: docExtKey.type,
                path: docExtKey.path,
                isObsolete: docExtKey.isObsolete
            };

            var pathParts = KeyStore.getPathParts(docExtKey);

            if (pathParts != null) {
                addrInfo.pathParts = pathParts;
            }
        }
        else if (retrieveObsolete && Catenis.module.BlockchainAddress.BlockchainAddress.retrieveObsoleteAddress(addr)) {
            tryAgain = true;
        }
    }
    while (tryAgain);

    return addrInfo;
};

KeyStore.prototype.listAddressesInfo = function (addrList, retrieveObsolete = false) {
    var self = this;
    
    return addrList.reduce(function (result, addr) {
        var hdNodeInfo = self.getAddressInfo(addr, retrieveObsolete);

        if (hdNodeInfo != null) {
            result[addr] = hdNodeInfo;
        }

        return result;
    }, {});
};

KeyStore.prototype.setAddressAsObsolete = function (addr) {
    var docExtKey = this.collExtKey.by('address', addr);

    if (docExtKey != undefined && (docExtKey.type === 'ctnd_fund_pay_addr' || docExtKey.type === 'ctnd_fund_chg_addr' || docExtKey.type == 'ctnd_pay_tx_exp_addr'
            || docExtKey.type === 'ctnd_dev_main_addr' || docExtKey.type === 'cln_msg_crd_addr' || docExtKey.type === 'cln_asst_crd_addr'
            || docExtKey.type === 'dev_read_conf_addr' || docExtKey.type === 'dev_main_addr' || docExtKey.type === 'dev_asst_addr' || docExtKey.type === 'dev_asst_issu_addr')
            && !docExtKey.isObsolete) {
        docExtKey.isObsolete = true;
        this.collExtKey.update(docExtKey);
    }
};

KeyStore.prototype.setAddressListAsObsolete = function (addrList) {
    this.collExtKey.chain().find({$and: [{address: {$in: addrList}}, {type: {$in: ['ctnd_fund_pay_addr', 'ctnd_fund_chg_addr', 'ctnd_pay_tx_exp_addr', 'ctnd_dev_main_addr', 'cln_msg_crd_addr', 'cln_asst_crd_addr', 'dev_read_conf_addr', 'dev_main_addr', 'dev_asst_addr', 'dev_asst_issu_addr']}}, {isObsolete: false}]})
        .update(function (docExtKey) {
        docExtKey.isObsolete = true;
    });
};

KeyStore.prototype.isObsoleteAddress = function (addr) {
    var docExtKey = this.collExtKey.by('address', addr);

    return docExtKey != undefined && docExtKey.isObsolete;
};

KeyStore.prototype.listAddressesInUse = function () {
    return this.collExtKey.find({$and: [{isLeaf: true}, {isReserved: false}, {isObsolete: false}]}).map(function (docExtKey) {
        return docExtKey.address;
    });
};

KeyStore.prototype.initCatenisNodeHDNodes = function (ctnNodeIndex) {
    // Validate Catenis node index
    if (!isValidCatenisNodeIndex(ctnNodeIndex)) {
        Catenis.logger.ERROR('KeyStore.initCatenisNodeHDNodes method called with invalid argument', {ctnNodeIndex: ctnNodeIndex});
        throw Error('Invalid ctnNodeIndex argument');
    }

    var success = false,
        hdNodesToStore = [];

    // Try to retrieve root HD extended key for Catenis node with given index
    var ctnNodeRootPath = util.format('m/0/%d', ctnNodeIndex),
        ctnNodeRootHDNode = retrieveHDNode.call(this, ctnNodeRootPath);

    if (ctnNodeRootHDNode == null) {
        // Catenis node root HD extended key does not exist yet. Create it
        ctnNodeRootHDNode = this.sysRootHDNode.derive(ctnNodeIndex);

        if (ctnNodeRootHDNode.index !== ctnNodeIndex) {
            Catenis.logger.WARN(util.format('Catenis node root HD extended key (%s) derived with an unexpected index', ctnNodeRootPath), {expectedIndex: ctnNodeIndex, returnedIndex: ctnNodeRootHDNode.index});
        }
        else {
            // Save newly created HD extended key to store it later
            hdNodesToStore.push({type: 'ctnd_root', path: ctnNodeRootPath, hdNode: ctnNodeRootHDNode, isLeaf: false, isReserved: false});

            // Create Catenis node device root HD extended key
            var path = ctnNodeRootPath + '/0',
                ctnNodeDeviceRootHDNode = ctnNodeRootHDNode.derive(0);

            if (ctnNodeDeviceRootHDNode.index !== 0) {
                Catenis.logger.WARN(util.format('Catenis node device root HD extended key (%s) derived with an unexpected index', path), {expectedIndex: 0, returnedIndex: ctnNodeDeviceRootHDNode.index});
            }
            else {
                // Save newly created HD extended key to store it later
                hdNodesToStore.push({type: 'ctnd_dev_root', path: path, hdNode: ctnNodeDeviceRootHDNode, isLeaf: false, isReserved: false});

                // Create Catenis node funding root HD extended key
                path = ctnNodeRootPath + '/1';
                var ctnNodeFundingRootHDNode = ctnNodeRootHDNode.derive(1);

                if (ctnNodeFundingRootHDNode.index !== 1) {
                    Catenis.logger.WARN(util.format('Catenis node funding root HD extended key (%s) derived with an unexpected index', path), {expectedIndex: 1, returnedIndex: ctnNodeFundingRootHDNode.index});
                }
                else {
                    // Save newly created HD extended key to store it later
                    hdNodesToStore.push({type: 'ctnd_fund_root', path: path, hdNode: ctnNodeFundingRootHDNode, isLeaf: false, isReserved: false});

                    // Create Catenis node pay tx expense root HD extended key
                    path = ctnNodeRootPath + '/2';
                    var ctnNodePayTxExpenseRootHDNode = ctnNodeRootHDNode.derive(2);

                    if (ctnNodePayTxExpenseRootHDNode.index !== 2) {
                        Catenis.logger.WARN(util.format('Catenis node pay tx expense root HD extended key (%s) derived with an unexpected index', path), {expectedIndex: 2, returnedIndex: ctnNodePayTxExpenseRootHDNode.index});
                    }
                    else {
                        // Save newly created HD extended key to store it later
                        hdNodesToStore.push({type: 'ctnd_pay_tx_exp_root', path: path, hdNode: ctnNodePayTxExpenseRootHDNode, isLeaf: false, isReserved: false});

                        // Create all predefined and reserved Catenis node device addresses root HD extended keys
                        for (let idx = 0; idx < numDeviceAddrRoots; idx++) {
                            path = util.format('%s/0/%d', ctnNodeRootPath, idx);
                            var ctnNodeDeviceAddrRootHDNode = ctnNodeDeviceRootHDNode.derive(idx);

                            if (ctnNodeDeviceAddrRootHDNode.index !== idx) {
                                Catenis.logger.WARN(util.format('Catenis node device addresses #%d root HD extended key (%s) derived with an unexpected index', idx + 1, path), {expectedIndex: idx, returnedIndex: ctnNodeDeviceAddrRootHDNode.index});
                                ctnNodeDeviceRootHDNode = null;
                                break;
                            }
                            else {
                                // Save newly created HD extended key to store it later
                                hdNodesToStore.push({type: idx == 0 ? 'ctnd_dev_main_addr_root' : 'ctnd_dev_rsrv_addr_root', path: path, hdNode: ctnNodeDeviceAddrRootHDNode, isLeaf: false, isReserved: idx >= numUsedCtnNodeDeviceAddrRoots});
                            }
                        }

                        if (ctnNodeDeviceRootHDNode != null) {
                            // Create Catenis node funding payment root HD extended key
                            path = ctnNodeRootPath + '/1/0';
                            var ctnNodeFundingPaymentRootHDNode = ctnNodeFundingRootHDNode.derive(0);

                            if (ctnNodeFundingPaymentRootHDNode.index !== 0) {
                                Catenis.logger.WARN(util.format('Catenis node funding payment root HD extended key (%s) derived with an unexpected index', path), {expectedIndex: 0, returnedIndex: ctnNodeFundingPaymentRootHDNode.index});
                            }
                            else {
                                // Save newly created HD extended key to store it later
                                hdNodesToStore.push({type: 'ctnd_fund_pay_root', path: path, hdNode: ctnNodeFundingPaymentRootHDNode, isLeaf: false, isReserved: false});

                                // Create Catenis node funding change root HD extended key
                                path = ctnNodeRootPath + '/1/1';
                                var ctnNodeFundingChangeRootHDNode = ctnNodeFundingRootHDNode.derive(1);

                                if (ctnNodeFundingChangeRootHDNode.index !== 1) {
                                    Catenis.logger.WARN(util.format('Catenis node funding change root HD extended key (%s) derived with an unexpected index', path), {expectedIndex: 1, returnedIndex: ctnNodeFundingChangeRootHDNode.index});
                                }
                                else {
                                    // Save newly created HD extended key to store it later
                                    hdNodesToStore.push({type: 'ctnd_fund_chg_root', path: path, hdNode: ctnNodeFundingChangeRootHDNode, isLeaf: false, isReserved: false});

                                    // Store all newly created HD extended keys, and indicate success
                                    var self = this;

                                    hdNodesToStore.forEach(function (hdNodeToStore) {
                                        storeHDNode.call(self, hdNodeToStore.type, hdNodeToStore.path, hdNodeToStore.hdNode, hdNodeToStore.isLeaf, hdNodeToStore.isReserved);
                                    });

                                    success = true;
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    else {
        // Catenis node HD nodes already initialized. Nothing to do,
        //  just indicate success
        success = true;
    }

    return success;
};

KeyStore.prototype.getCatenisNodeFundingPaymentAddressKeys = function (ctnNodeIndex, addrIndex, isObsolete = false) {
    // Validate arguments
    var errArg = {};

    if (!isValidCatenisNodeIndex(ctnNodeIndex)) {
        errArg.ctnNodeIndex = ctnNodeIndex;
    }

    if (!isValidAddressIndex(addrIndex)) {
        errArg.addrIndex = addrIndex;
    }

    if (Object.keys(errArg).length > 0) {
        var errArgs = Object.keys(errArg);

        Catenis.logger.ERROR(util.format('KeyStore.getCatenisNodeFundingPaymentAddressKeys method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }
    
    // Try to retrieve funding payment address HD extended key for given Catenis node with the given index
    var ctnNodeFundingPaymentAddrPath = util.format('m/0/%d/1/0/%d', ctnNodeIndex, addrIndex),
        ctnNodeFundingPaymentAddrHDNode = retrieveHDNode.call(this, ctnNodeFundingPaymentAddrPath),
        ctnNodeFundingPaymentAddrKeys = null;
    
    if (ctnNodeFundingPaymentAddrHDNode == null) {
        // Catenis node funding payment address HD extended key does not exist yet.
        //  Retrieve parent root HD extended key to create it
        var path = util.format('m/0/%d/1/0', ctnNodeIndex),
            ctnNodeFundingPaymentRootHDNode = retrieveHDNode.call(this, path);

        if (ctnNodeFundingPaymentRootHDNode == null) {
            // Catenis node funding payment root HD extended key does not exist yet.
            //  Try to initialize Catenis node HD extended keys
            if (! this.initCatenisNodeHDNodes(ctnNodeIndex)) {
                Catenis.logger.ERROR(util.format('HD extended keys for Catenis node with index %d could not be initialized', ctnNodeIndex));
            }
            else {
                // Catenis node HD extended keys successfully initialized.
                //  Retrieve specified Catenis node funding payment root HD extend key again
                ctnNodeFundingPaymentRootHDNode = retrieveHDNode.call(this, path);
            }
        }

        if (ctnNodeFundingPaymentRootHDNode == null) {
            Catenis.logger.ERROR(util.format('Funding payment root HD extended key for Catenis node with index %d not found', ctnNodeIndex));
        }
        else {
            // Try to create Catenis node funding payment address HD extended key now
            ctnNodeFundingPaymentAddrHDNode = ctnNodeFundingPaymentRootHDNode.derive(addrIndex);

            if (ctnNodeFundingPaymentAddrHDNode.index !== addrIndex) {
                Catenis.logger.WARN(util.format('Catenis node funding payment address HD extended key (%s) derived with an unexpected index', ctnNodeFundingPaymentAddrPath), {expectedIndex: addrIndex, returnedIndex: ctnNodeFundingPaymentAddrHDNode.index});
                ctnNodeFundingPaymentAddrHDNode = null;
            }
            else {
                // Store created HD extended key
                storeHDNode.call(this, 'ctnd_fund_pay_addr', ctnNodeFundingPaymentAddrPath, ctnNodeFundingPaymentAddrHDNode, true, false, isObsolete);
            }
        }
    }
    
    if (ctnNodeFundingPaymentAddrHDNode != null) {
        ctnNodeFundingPaymentAddrKeys = new Catenis.module.CryptoKeys(ctnNodeFundingPaymentAddrHDNode.keyPair);
    }

    return ctnNodeFundingPaymentAddrKeys;
};

KeyStore.prototype.listCatenisNodeFundingPaymentAddresses = function (ctnNodeIndex, fromAddrIndex, toAddrIndex, onlyInUse) {
    // Validate arguments
    var errArg = {},
        queryTerms = [{parentPath: util.format('m/0/%d/1/0', ctnNodeIndex)}];

    if (!isValidCatenisNodeIndex(ctnNodeIndex)) {
        errArg.ctnNodeIndex = ctnNodeIndex;
    }

    if (fromAddrIndex != undefined) {
        if (!isValidAddressIndex(fromAddrIndex)) {
            errArg.fromAddrIndex = fromAddrIndex;
        }
        else {
            queryTerms.push({index: {$gte: fromAddrIndex}});
        }
    }

    if (toAddrIndex != undefined) {
        if (!isValidAddressIndex(toAddrIndex) || (fromAddrIndex != undefined && toAddrIndex < fromAddrIndex)) {
            errArg.toAddrIndex = toAddrIndex;
        }
        else {
            queryTerms.push({index: {$lte: toAddrIndex}});
        }
    }

    if (Object.keys(errArg).length > 0) {
        var errArgs = Object.keys(errArg);

        Catenis.logger.ERROR(util.format('KeyStore.listCatenisNodeFundingPaymentAddresses method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    if (onlyInUse) {
        queryTerms.push({isObsolete: false});
    }

    // Return existing Catenis node funding payment addresses within the specified range
    if (queryTerms.length > 1) {
        var query = {$and: queryTerms};
    }
    else {
        query = queryTerms[0];
    }

    return this.collExtKey.chain().find(query).simplesort('index').data().map(function (docExtKey) {
        return docExtKey.address;
    });
};

KeyStore.prototype.listCatenisNodeFundingPaymentAddressesInUse = function (ctnNodeIndex, fromAddrIndex, toAddrIndex) {
    return this.listCatenisNodeFundingPaymentAddresses(ctnNodeIndex, fromAddrIndex, toAddrIndex, true);
};

KeyStore.prototype.getCatenisNodeFundingChangeAddressKeys = function (ctnNodeIndex, addrIndex, isObsolete = false) {
    // Validate arguments
    var errArg = {};

    if (!isValidCatenisNodeIndex(ctnNodeIndex)) {
        errArg.ctnNodeIndex = ctnNodeIndex;
    }

    if (!isValidAddressIndex(addrIndex)) {
        errArg.addrIndex = addrIndex;
    }

    if (Object.keys(errArg).length > 0) {
        var errArgs = Object.keys(errArg);

        Catenis.logger.ERROR(util.format('KeyStore.getCatenisNodeFundingChangeAddressKeys method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    // Try to retrieve funding change address HD extended key for given Catenis node with the given index
    var ctnNodeFundingChangeAddrPath = util.format('m/0/%d/1/1/%d', ctnNodeIndex, addrIndex),
        ctnNodeFundingChangeAddrHDNode = retrieveHDNode.call(this, ctnNodeFundingChangeAddrPath),
        ctnNodeFundingChangeAddrKeys = null;

    if (ctnNodeFundingChangeAddrHDNode == null) {
        // Catenis node funding change address HD extended key does not exist yet.
        //  Retrieve parent root HD extended key to create it
        var path = util.format('m/0/%d/1/1', ctnNodeIndex),
            ctnNodeFundingChangeRootHDNode = retrieveHDNode.call(this, path);

        if (ctnNodeFundingChangeRootHDNode == null) {
            // Catenis node funding change root HD extended key does not exist yet.
            //  Try to initialize Catenis node HD extended keys
            if (! this.initCatenisNodeHDNodes(ctnNodeIndex)) {
                Catenis.logger.ERROR(util.format('HD extended keys for Catenis node with index %d could not be initialized', ctnNodeIndex));
            }
            else {
                // Catenis node HD extended keys successfully initialized.
                //  Retrieve specified Catenis node funding change root HD extend key again
                ctnNodeFundingChangeRootHDNode = retrieveHDNode.call(this, path);
            }
        }

        if (ctnNodeFundingChangeRootHDNode == null) {
            Catenis.logger.ERROR(util.format('Funding change root HD extended key for Catenis node with index %d not found', ctnNodeIndex));
        }
        else {
            // Try to create Catenis node funding change address HD extended key now
            ctnNodeFundingChangeAddrHDNode = ctnNodeFundingChangeRootHDNode.derive(addrIndex);

            if (ctnNodeFundingChangeAddrHDNode.index !== addrIndex) {
                Catenis.logger.WARN(util.format('Catenis node funding change address HD extended key (%s) derived with an unexpected index', ctnNodeFundingChangeAddrPath), {expectedIndex: addrIndex, returnedIndex: ctnNodeFundingChangeAddrHDNode.index});
                ctnNodeFundingChangeAddrHDNode = null;
            }
            else {
                // Store created HD extended key
                storeHDNode.call(this, 'ctnd_fund_chg_addr', ctnNodeFundingChangeAddrPath, ctnNodeFundingChangeAddrHDNode, true, false, isObsolete);
            }
        }
    }

    if (ctnNodeFundingChangeAddrHDNode != null) {
        ctnNodeFundingChangeAddrKeys = new Catenis.module.CryptoKeys(ctnNodeFundingChangeAddrHDNode.keyPair);
    }

    return ctnNodeFundingChangeAddrKeys;
};

KeyStore.prototype.listCatenisNodeFundingChangeAddresses = function (ctnNodeIndex, fromAddrIndex, toAddrIndex, onlyInUse) {
    // Validate arguments
    var errArg = {},
        queryTerms = [{parentPath: util.format('m/0/%d/1/1', ctnNodeIndex)}];

    if (!isValidCatenisNodeIndex(ctnNodeIndex)) {
        errArg.ctnNodeIndex = ctnNodeIndex;
    }

    if (fromAddrIndex != undefined) {
        if (!isValidAddressIndex(fromAddrIndex)) {
            errArg.fromAddrIndex = fromAddrIndex;
        }
        else {
            queryTerms.push({index: {$gte: fromAddrIndex}});
        }
    }

    if (toAddrIndex != undefined) {
        if (!isValidAddressIndex(toAddrIndex) || (fromAddrIndex != undefined && toAddrIndex < fromAddrIndex)) {
            errArg.toAddrIndex = toAddrIndex;
        }
        else {
            queryTerms.push({index: {$lte: toAddrIndex}});
        }
    }

    if (Object.keys(errArg).length > 0) {
        var errArgs = Object.keys(errArg);

        Catenis.logger.ERROR(util.format('KeyStore.listCatenisNodeFundingChangeAddresses method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    if (onlyInUse) {
        queryTerms.push({isObsolete: false});
    }

    // Return existing Catenis node funding change addresses within the specified range
    if (queryTerms.length > 1) {
        var query = {$and: queryTerms};
    }
    else {
        query = queryTerms[0];
    }

    return this.collExtKey.chain().find(query).simplesort('index').data().map(function (docExtKey) {
        return docExtKey.address;
    });
};

KeyStore.prototype.listCatenisNodeFundingChangeAddressesInUse = function (ctnNodeIndex, fromAddrIndex, toAddrIndex) {
    return this.listCatenisNodeFundingChangeAddresses(ctnNodeIndex, fromAddrIndex, toAddrIndex, true);
};

KeyStore.prototype.getCatenisNodePayTxExpenseAddressKeys = function (ctnNodeIndex, addrIndex, isObsolete = false) {
    // Validate arguments
    var errArg = {};

    if (!isValidCatenisNodeIndex(ctnNodeIndex)) {
        errArg.ctnNodeIndex = ctnNodeIndex;
    }

    if (!isValidAddressIndex(addrIndex)) {
        errArg.addrIndex = addrIndex;
    }

    if (Object.keys(errArg).length > 0) {
        var errArgs = Object.keys(errArg);

        Catenis.logger.ERROR(util.format('KeyStore.getCatenisNodePayTxExpenseAddressKeys method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    // Try to retrieve pay tx expense address HD extended key for given Catenis node with the given index
    var ctnNodePayTxExpenseAddrPath = util.format('m/0/%d/2/%d', ctnNodeIndex, addrIndex),
        ctnNodePayTxExpenseAddrHDNode = retrieveHDNode.call(this, ctnNodePayTxExpenseAddrPath),
        ctnNodePayTxExpenseAddrKeys = null;

    if (ctnNodePayTxExpenseAddrHDNode == null) {
        // Catenis node pay tx expense address HD extended key does not exist yet.
        //  Retrieve parent root HD extended key to create it
        var path = util.format('m/0/%d/2', ctnNodeIndex),
            ctnNodePayTxExpenseRootHDNode = retrieveHDNode.call(this, path);

        if (ctnNodePayTxExpenseRootHDNode == null) {
            // Catenis node pay tx expense root HD extended key does not exist yet.
            //  Try to initialize Catenis node HD extended keys
            if (! this.initCatenisNodeHDNodes(ctnNodeIndex)) {
                Catenis.logger.ERROR(util.format('HD extended keys for Catenis node with index %d could not be initialized', ctnNodeIndex));
            }
            else {
                // Catenis node HD extended keys successfully initialized.
                //  Retrieve specified Catenis node pay tx expense root HD extend key again
                ctnNodePayTxExpenseRootHDNode = retrieveHDNode.call(this, path);
            }
        }

        if (ctnNodePayTxExpenseRootHDNode == null) {
            Catenis.logger.ERROR(util.format('Pay tx expense root HD extended key for Catenis node with index %d not found', ctnNodeIndex));
        }
        else {
            // Try to create Catenis node pay tx expense address HD extended key now
            ctnNodePayTxExpenseAddrHDNode = ctnNodePayTxExpenseRootHDNode.derive(addrIndex);

            if (ctnNodePayTxExpenseAddrHDNode.index !== addrIndex) {
                Catenis.logger.WARN(util.format('Catenis node pay tx expense address HD extended key (%s) derived with an unexpected index', ctnNodePayTxExpenseAddrPath), {expectedIndex: addrIndex, returnedIndex: ctnNodePayTxExpenseAddrHDNode.index});
                ctnNodePayTxExpenseAddrHDNode = null;
            }
            else {
                // Store created HD extended key
                storeHDNode.call(this, 'ctnd_pay_tx_exp_addr', ctnNodePayTxExpenseAddrPath, ctnNodePayTxExpenseAddrHDNode, true, false, isObsolete);
            }
        }
    }

    if (ctnNodePayTxExpenseAddrHDNode != null) {
        ctnNodePayTxExpenseAddrKeys = new Catenis.module.CryptoKeys(ctnNodePayTxExpenseAddrHDNode.keyPair);
    }

    return ctnNodePayTxExpenseAddrKeys;
};

KeyStore.prototype.listCatenisNodePayTxExpenseAddresses = function (ctnNodeIndex, fromAddrIndex, toAddrIndex, onlyInUse) {
    // Validate arguments
    var errArg = {},
        queryTerms = [{parentPath: util.format('m/0/%d/2', ctnNodeIndex)}];

    if (!isValidCatenisNodeIndex(ctnNodeIndex)) {
        errArg.ctnNodeIndex = ctnNodeIndex;
    }

    if (fromAddrIndex != undefined) {
        if (!isValidAddressIndex(fromAddrIndex)) {
            errArg.fromAddrIndex = fromAddrIndex;
        }
        else {
            queryTerms.push({index: {$gte: fromAddrIndex}});
        }
    }

    if (toAddrIndex != undefined) {
        if (!isValidAddressIndex(toAddrIndex) || (fromAddrIndex != undefined && toAddrIndex < fromAddrIndex)) {
            errArg.toAddrIndex = toAddrIndex;
        }
        else {
            queryTerms.push({index: {$lte: toAddrIndex}});
        }
    }

    if (Object.keys(errArg).length > 0) {
        var errArgs = Object.keys(errArg);

        Catenis.logger.ERROR(util.format('KeyStore.listCatenisNodePayTxExpenseAddresses method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    if (onlyInUse) {
        queryTerms.push({isObsolete: false});
    }

    // Return existing Catenis node pay tx expense addresses within the specified range
    if (queryTerms.length > 1) {
        var query = {$and: queryTerms};
    }
    else {
        query = queryTerms[0];
    }

    return this.collExtKey.chain().find(query).simplesort('index').data().map(function (docExtKey) {
        return docExtKey.address;
    });
};

KeyStore.prototype.listCatenisNodePayTxExpenseAddressesInUse = function (ctnNodeIndex, fromAddrIndex, toAddrIndex) {
    return this.listCatenisNodePayTxExpenseAddresses(ctnNodeIndex, fromAddrIndex, toAddrIndex);
};

KeyStore.prototype.getCatenisNodeDeviceAddressKeys = function (ctnNodeIndex, addrRootIndex, addrIndex, isObsolete = false) {
    // Validate arguments
    var errArg = {};

    if (!isValidCatenisNodeIndex(ctnNodeIndex)) {
        errArg.ctnNodeIndex = ctnNodeIndex;
    }

    if (!isValidAddressRootIndex(addrRootIndex)) {
        errArg.addrRootIndex = addrRootIndex;
    }

    if (!isValidAddressIndex(addrIndex)) {
        errArg.addrIndex = addrIndex;
    }

    if (Object.keys(errArg).length > 0) {
        var errArgs = Object.keys(errArg);

        Catenis.logger.ERROR(util.format('KeyStore.getCatenisNodeDeviceAddressKeys method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    // Try to retrieve device address HD extended key for given Catenis node, address Root, and with the given index
    var ctnNodeDeviceAddrPath = util.format('m/0/%d/0/%d/%d', ctnNodeIndex, addrRootIndex, addrIndex),
        ctnNodeDeviceAddrHDNode = retrieveHDNode.call(this, ctnNodeDeviceAddrPath),
        ctnNodeDeviceAddrKeys = null;

    if (ctnNodeDeviceAddrHDNode == null) {
        // Catenis node device address HD extended key does not exist yet.
        //  Retrieve parent root HD extended key to create it
        var path = util.format('m/0/%d/0/%d', ctnNodeIndex, addrRootIndex),
            ctnNodeDeviceAddrRootHDNode = retrieveHDNode.call(this, path);

        if (ctnNodeDeviceAddrRootHDNode == null) {
            // Catenis node device addresses root HD extended key does not exist yet.
            //  Try to initialize Catenis node HD extended keys
            if (! this.initCatenisNodeHDNodes(ctnNodeIndex)) {
                Catenis.logger.ERROR(util.format('HD extended keys for Catenis node with index %d could not be initialized', ctnNodeIndex));
            }
            else {
                // Catenis node HD extended keys successfully initialized.
                //  Retrieve specified Catenis node device addresses root HD extend key again
                ctnNodeDeviceAddrRootHDNode = retrieveHDNode.call(this, path);
            }
        }

        if (ctnNodeDeviceAddrRootHDNode == null) {
            Catenis.logger.ERROR(util.format('Device address #%d root HD extended key for Catenis node with index %d not found', addrRootIndex, ctnNodeIndex));
        }
        else {
            // Try to create Catenis node device address HD extended key now
            ctnNodeDeviceAddrHDNode = ctnNodeDeviceAddrRootHDNode.derive(addrIndex);

            if (ctnNodeDeviceAddrHDNode.index !== addrIndex) {
                Catenis.logger.WARN(util.format('Catenis node device address #%d HD extended key (%s) derived with an unexpected index', addrRootIndex + 1, ctnNodeDeviceAddrPath), {expectedIndex: addrIndex, returnedIndex: ctnNodeDeviceAddrHDNode.index});
                ctnNodeDeviceAddrHDNode = null;
            }
            else {
                // Store created HD extended key
                storeHDNode.call(this, addrRootIndex == 0 ? 'ctnd_dev_main_addr' : 'ctnd_dev_rsrv_addr', ctnNodeDeviceAddrPath, ctnNodeDeviceAddrHDNode, true, addrRootIndex >= numUsedCtnNodeDeviceAddrRoots, isObsolete);
            }
        }
    }

    if (ctnNodeDeviceAddrHDNode != null) {
        ctnNodeDeviceAddrKeys = new Catenis.module.CryptoKeys(ctnNodeDeviceAddrHDNode.keyPair);
    }

    return ctnNodeDeviceAddrKeys;
};

KeyStore.prototype.listCatenisNodeDeviceAddresses = function (ctnNodeIndex, addrRootIndex, fromAddrIndex, toAddrIndex, onlyInUse) {
    // Validate arguments
    var errArg = {},
        queryTerms = [{parentPath: util.format('m/0/%d/0/%d', ctnNodeIndex, addrRootIndex)}];

    if (!isValidCatenisNodeIndex(ctnNodeIndex)) {
        errArg.ctnNodeIndex = ctnNodeIndex;
    }

    if (!isValidAddressRootIndex(addrRootIndex)) {
        errArg.addrRootIndex = addrRootIndex;
    }

    if (fromAddrIndex != undefined) {
        if (!isValidAddressIndex(fromAddrIndex)) {
            errArg.fromAddrIndex = fromAddrIndex;
        }
        else {
            queryTerms.push({index: {$gte: fromAddrIndex}});
        }
    }

    if (toAddrIndex != undefined) {
        if (!isValidAddressIndex(toAddrIndex) || (fromAddrIndex != undefined && toAddrIndex < fromAddrIndex)) {
            errArg.toAddrIndex = toAddrIndex;
        }
        else {
            queryTerms.push({index: {$lte: toAddrIndex}});
        }
    }

    if (Object.keys(errArg).length > 0) {
        var errArgs = Object.keys(errArg);

        Catenis.logger.ERROR(util.format('KeyStore.listCatenisNodeDeviceAddresses method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    if (onlyInUse) {
        queryTerms.push({isObsolete: false});
    }

    // Return existing Catenis node device addresses within the specified range
    if (queryTerms.length > 1) {
        var query = {$and: queryTerms};
    }
    else {
        query = queryTerms[0];
    }

    return this.collExtKey.chain().find(query).simplesort('index').data().map(function (docExtKey) {
        return docExtKey.address;
    });
};

KeyStore.prototype.listCatenisNodeDeviceAddressesInUse = function (ctnNodeIndex, addrRootIndex, fromAddrIndex, toAddrIndex) {
    return this.listCatenisNodeDeviceAddresses(ctnNodeIndex, addrRootIndex, fromAddrIndex, toAddrIndex, true);
};

KeyStore.prototype.getCatenisNodeDeviceMainAddressKeys = function (ctnNodeIndex, addrIndex, isObsolete = false) {
    return this.getCatenisNodeDeviceAddressKeys(ctnNodeIndex, 0, addrIndex, isObsolete);
};

KeyStore.prototype.listCatenisNodeDeviceMainAddresses = function (ctnNodeIndex, fromAddrIndex, toAddrIndex, onlyInUse) {
    return this.listCatenisNodeDeviceAddresses(ctnNodeIndex, 0, fromAddrIndex, toAddrIndex, onlyInUse);
};

KeyStore.prototype.listCatenisNodeDeviceMainAddressesInUse = function (ctnNodeIndex, fromAddrIndex, toAddrIndex) {
    return this.listCatenisNodeDeviceAddresses(ctnNodeIndex, 0, fromAddrIndex, toAddrIndex, true);
};

KeyStore.prototype.getCatenisHubFundingPaymentAddressKeys = function (addrIndex, isObsolete = false) {
    return this.getCatenisNodeFundingPaymentAddressKeys(this.ctnHubNodeIndex, addrIndex, isObsolete);
};

KeyStore.prototype.listCatenisHubFundingPaymentAddresses = function (fromAddrIndex, toAddrIndex, onlyInUse) {
    return this.listCatenisNodeFundingPaymentAddresses(this.ctnHubNodeIndex, fromAddrIndex, toAddrIndex, onlyInUse);
};

KeyStore.prototype.listCatenisHubFundingPaymentAddressesInUse = function (fromAddrIndex, toAddrIndex) {
    return this.listCatenisNodeFundingPaymentAddresses(this.ctnHubNodeIndex, fromAddrIndex, toAddrIndex, true);
};

KeyStore.prototype.getCatenisHubFundingChangeAddressKeys = function (addrIndex, isObsolete = false) {
    return this.getCatenisNodeFundingChangeAddressKeys(this.ctnHubNodeIndex, addrIndex, isObsolete);
};

KeyStore.prototype.listCatenisHubFundingChangeAddresses = function (fromAddrIndex, toAddrIndex, onlyInUse) {
    return this.listCatenisNodeFundingChangeAddresses(this.ctnHubNodeIndex, fromAddrIndex, toAddrIndex, onlyInUse);
};

KeyStore.prototype.listCatenisHubFundingChangeAddressesInUse = function (fromAddrIndex, toAddrIndex) {
    return this.listCatenisNodeFundingChangeAddresses(this.ctnHubNodeIndex, fromAddrIndex, toAddrIndex, true);
};

KeyStore.prototype.getCatenisHubPayTxExpenseAddressKeys = function (addrIndex, isObsolete = false) {
    return this.getCatenisNodePayTxExpenseAddressKeys(this.ctnHubNodeIndex, addrIndex, isObsolete);
};

KeyStore.prototype.listCatenisHubPayTxExpenseAddresses = function (fromAddrIndex, toAddrIndex, onlyInUse) {
    return this.listCatenisNodePayTxExpenseAddresses(this.ctnHubNodeIndex, fromAddrIndex, toAddrIndex, onlyInUse);
};

KeyStore.prototype.listCatenisHubPayTxExpenseAddressesInUse = function (fromAddrIndex, toAddrIndex) {
    return this.listCatenisNodePayTxExpenseAddresses(this.ctnHubNodeIndex, fromAddrIndex, toAddrIndex, true);
};

KeyStore.prototype.getCatenisHubDeviceAddressKeys = function (addrRootIndex, addrIndex, isObsolete = false) {
    return this.getCatenisNodeDeviceAddressKeys(this.ctnHubNodeIndex, addrRootIndex, addrIndex, isObsolete);
};

KeyStore.prototype.listCatenisHubDeviceAddresses = function (addrRootIndex, fromAddrIndex, toAddrIndex, onlyInUse) {
    return this.listCatenisNodeDeviceAddresses(this.ctnHubNodeIndex, addrRootIndex, fromAddrIndex, toAddrIndex, onlyInUse);
};

KeyStore.prototype.listCatenisHubDeviceAddressesInUse = function (addrRootIndex, fromAddrIndex, toAddrIndex) {
    return this.listCatenisNodeDeviceAddresses(this.ctnHubNodeIndex, addrRootIndex, fromAddrIndex, toAddrIndex, true);
};

KeyStore.prototype.getCatenisHubDeviceMainAddressKeys = function (addrIndex, isObsolete = false) {
    return this.getCatenisNodeDeviceAddressKeys(this.ctnHubNodeIndex, 0, addrIndex, isObsolete);
};

KeyStore.prototype.listCatenisHubDeviceMainAddresses = function (fromAddrIndex, toAddrIndex, onlyInUse) {
    return this.listCatenisNodeDeviceAddresses(this.ctnHubNodeIndex, 0, fromAddrIndex, toAddrIndex, onlyInUse);
};

KeyStore.prototype.listCatenisHubDeviceMainAddressesInUse = function (fromAddrIndex, toAddrIndex) {
    return this.listCatenisNodeDeviceAddresses(this.ctnHubNodeIndex, 0, fromAddrIndex, toAddrIndex, true);
};

KeyStore.prototype.initClientHDNodes = function (clientIndex) {
    // Validate client index
    if (!isValidClientIndex(clientIndex)) {
        Catenis.logger.ERROR('KeyStore.initClientHDNodes method called with invalid argument', {clientIndex: clientIndex});
        throw Error('Invalid clientIndex argument');
    }

    var success = false,
        hdNodesToStore = [];

    // Try to retrieve root HD extended key for client with given index
    var clientRootPath = util.format('m/%d', clientIndex),
        clientRootHDNode = retrieveHDNode.call(this, clientRootPath);

    if (clientRootHDNode == null) {
        // Client root HD extended key does not exist yet. Create it
        clientRootHDNode = this.masterHDNode.derive(clientIndex);

        if (clientRootHDNode.index !== clientIndex) {
            Catenis.logger.WARN(util.format('Client root HD extended key (%s) derived with an unexpected index', clientRootPath), {expectedIndex: clientIndex, returnedIndex: clientRootHDNode.index});
        }
        else {
            // Save newly created HD extended key to store it later
            hdNodesToStore.push({type: 'cln_root', path: clientRootPath, hdNode: clientRootHDNode, isLeaf: false, isReserved: false});

            // Create client internal hierarchy root HD extended key
            var path = clientRootPath + '/0',
                clientIntHierarchyRootHDNode = clientRootHDNode.derive(0);

            if (clientIntHierarchyRootHDNode.index !== 0) {
                Catenis.logger.WARN(util.format('Client internal hierarchy root HD extended key (%s) derived with an unexpected index', path), {expectedIndex: 0, returnedIndex: clientIntHierarchyRootHDNode.index});
            }
            else {
                // Save newly created HD extended key to store it later
                hdNodesToStore.push({type: 'cln_int_addr_hrch_root', path: path, hdNode: clientIntHierarchyRootHDNode, isLeaf: false, isReserved: false});

                // Create client public hierarchy root HD extended key
                path = clientRootPath + '/1';
                var clientPubHierarchyRootHDNode = clientRootHDNode.derive(1);

                if (clientPubHierarchyRootHDNode.index !== 1) {
                    Catenis.logger.WARN(util.format('Client public hierarchy root HD extended key (%s) derived with an unexpected index', path), {expectedIndex: 1, returnedIndex: clientPubHierarchyRootHDNode.index});
                }
                else {
                    // Save newly created HD extended key to store it later
                    hdNodesToStore.push({type: 'cln_pub_addr_hrch_root', path: path, hdNode: clientPubHierarchyRootHDNode, isLeaf: false, isReserved: false});

                    // Create client internal root HD extended key
                    path = clientRootPath + '/0/0';
                    var clientIntRootHDNode = clientIntHierarchyRootHDNode.derive(0);

                    if (clientIntRootHDNode.index !== 0) {
                        Catenis.logger.WARN(util.format('Client internal root HD extended key (%s) derived with an unexpected index', path), {expectedIndex: 0, returnedIndex: clientIntRootHDNode.index});
                    }
                    else {
                        // Save newly created HD extended key to store it later
                        hdNodesToStore.push({type: 'cln_int_root', path: path, hdNode: clientIntRootHDNode, isLeaf: false, isReserved: false});

                        // Create client service credit root HD extended key
                        var clientSrvCreditRootPath = clientRootPath + '/0/0/0',
                            clientSrvCreditRootHDNode = clientIntRootHDNode.derive(0);

                        if (clientSrvCreditRootHDNode.index !== 0) {
                            Catenis.logger.WARN(util.format('Client service credit root HD extended key (%s) derived with an unexpected index', clientSrvCreditRootPath), {expectedIndex: 0, returnedIndex: clientSrvCreditRootHDNode.index});
                        }
                        else {
                            // Save newly created HD extended key to store it later
                            hdNodesToStore.push({type: 'cln_srv_crd_root', path: clientSrvCreditRootPath, hdNode: clientSrvCreditRootHDNode, isLeaf: false, isReserved: false});

                            // Create all predefined and reserved client service credit addresses root HD extended keys
                            for (let idx = 0; idx < numServiceCreditAddrRoots; idx++) {
                                let clientSrvCreditAddrRootPath = util.format('%s/%d', clientSrvCreditRootPath, idx),
                                    clientSrvCreditAddrRootHDNode = clientSrvCreditRootHDNode.derive(idx);

                                if (clientSrvCreditAddrRootHDNode.index !== idx) {
                                    Catenis.logger.WARN(util.format('Client service credit address #%d root HD extended key (%s) derived with an unexpected index', idx + 1, clientSrvCreditAddrRootPath), {expectedIndex: idx, returnedIndex: clientSrvCreditAddrRootHDNode.index});
                                    clientSrvCreditRootHDNode = null;
                                    break;
                                }
                                else {
                                    // Save newly created HD extended key to store it later
                                    hdNodesToStore.push({type: idx == 0 ? 'cln_msg_crd_addr_root' : (idx == 1 ? 'cln_asst_crd_addr_root' : 'cln_srv_crd_rsrv_addr_root'), path: clientSrvCreditAddrRootPath, hdNode: clientSrvCreditAddrRootHDNode, isLeaf: false, isReserved: idx >= numUsedServiceCreditAddrRoots});
                                }
                            }

                            if (clientSrvCreditRootHDNode != null) {
                                // Store all newly created HD extended keys, and indicate success
                                var self = this;
                                
                                hdNodesToStore.forEach(function (hdNodeToStore) {
                                    storeHDNode.call(self, hdNodeToStore.type, hdNodeToStore.path, hdNodeToStore.hdNode, hdNodeToStore.isLeaf, hdNodeToStore.isReserved);
                                });

                                success = true;
                            }
                        }
                    }
                }
            }
        }
    }
    else {
        // Client HD nodes already initialized. Nothing to do,
        //  just indicate success
        success = true;
    }

    return success;
};

KeyStore.prototype.getClientServiceCreditAddressKeys = function (clientIndex, servCreditIndex, addrIndex, isObsolete = false) {
    // Validate arguments
    var errArg = {};

    if (!isValidClientIndex(clientIndex)) {
        errArg.clientIndex = clientIndex;
    }

    if (!isValidServiceCreditIndex(servCreditIndex)) {
        errArg.srvCreditIndex = servCreditIndex;
    }

    if (!isValidAddressIndex(addrIndex)) {
        errArg.addrIndex = addrIndex;
    }

    if (Object.keys(errArg).length > 0) {
        var errArgs = Object.keys(errArg);

        Catenis.logger.ERROR(util.format('KeyStore.getClientServiceCreditAddressKeys method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    // Try to retrieve address HD extended key for given client and service credit, with given index
    var clientSrvCreditAddrPath = util.format('m/%d/0/0/0/%d/%d', clientIndex, servCreditIndex, addrIndex),
        clientSrvCreditAddrHDNode = retrieveHDNode.call(this, clientSrvCreditAddrPath),
        clientSrvCreditAddrKeys = null;

    if (clientSrvCreditAddrHDNode == null) {
        // Client service credit address HD extended key does not exist yet.
        //  Retrieve parent root HD extended key to create it
        var path = util.format('m/%d/0/0/0/%d', clientIndex, servCreditIndex),
            clientSrvCreditRootHDNode = retrieveHDNode.call(this, path);

        if (clientSrvCreditRootHDNode == null) {
            // Client service credit root HD extended key does not exist yet.
            //  Try to initialize client HD extended keys
            if (! this.initClientHDNodes(clientIndex)) {
                Catenis.logger.ERROR(util.format('HD extended keys for client with index %d could not be initialized', clientIndex));
            }
            else {
                // Client HD extended keys successfully initialized.
                //  Retrieve specified client service credit root HD extend key again
                clientSrvCreditRootHDNode = retrieveHDNode.call(this, path);
            }
        }

        if (clientSrvCreditRootHDNode == null) {
            Catenis.logger.ERROR(util.format('Service credit #%d root HD extended key for client with index %d not found', servCreditIndex + 1, clientIndex));
        }
        else {
            // Try to create client service credit address HD extended key now
            clientSrvCreditAddrHDNode = clientSrvCreditRootHDNode.derive(addrIndex);

            if (clientSrvCreditAddrHDNode.index !== addrIndex) {
                Catenis.logger.WARN(util.format('Client service credit #%d address HD extended key (%s) derived with an unexpected index', servCreditIndex + 1, clientSrvCreditAddrPath), {expectedIndex: addrIndex, returnedIndex: clientSrvCreditAddrHDNode.index});
                clientSrvCreditAddrHDNode = null;
            }
            else {
                // Store created HD extended key
                storeHDNode.call(this, servCreditIndex == 0 ? 'cln_msg_crd_addr' : (servCreditIndex == 1 ? 'cln_asst_crd_addr' : 'cln_srv_crd_rsrv_addr'), clientSrvCreditAddrPath, clientSrvCreditAddrHDNode, true, servCreditIndex >= numUsedServiceCreditAddrRoots, isObsolete);
            }
        }
    }

    if (clientSrvCreditAddrHDNode != null) {
        clientSrvCreditAddrKeys = new Catenis.module.CryptoKeys(clientSrvCreditAddrHDNode.keyPair);
    }

    return clientSrvCreditAddrKeys;
};

KeyStore.prototype.listClientServiceCreditAddresses = function (clientIndex, servCreditIndex, fromAddrIndex, toAddrIndex, onlyInUse) {
    // Validate arguments
    var errArg = {},
        queryTerms = [{parentPath: util.format('m/%d/0/0/0/%d', clientIndex, servCreditIndex)}];

    if (!isValidClientIndex(clientIndex)) {
        errArg.clientIndex = clientIndex;
    }

    if (!isValidServiceCreditIndex(servCreditIndex)) {
        errArg.srvCreditIndex = servCreditIndex;
    }

    if (fromAddrIndex != undefined) {
        if (!isValidAddressIndex(fromAddrIndex)) {
            errArg.fromAddrIndex = fromAddrIndex;
        }
        else {
            queryTerms.push({index: {$gte: fromAddrIndex}});
        }
    }

    if (toAddrIndex != undefined) {
        if (!isValidAddressIndex(toAddrIndex) || (fromAddrIndex != undefined && toAddrIndex < fromAddrIndex)) {
            errArg.toAddrIndex = toAddrIndex;
        }
        else {
            queryTerms.push({index: {$lte: toAddrIndex}});
        }
    }

    if (Object.keys(errArg).length > 0) {
        var errArgs = Object.keys(errArg);

        Catenis.logger.ERROR(util.format('KeyStore.listClientServiceCreditAddresses method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    if (onlyInUse) {
        queryTerms.push({isObsolete: false});
    }

    // Return existing client credit service addresses within the specified range
    if (queryTerms.length > 1) {
        var query = {$and: queryTerms};
    }
    else {
        query = queryTerms[0];
    }

    return this.collExtKey.chain().find(query).simplesort('index').data().map(function (docExtKey) {
        return docExtKey.address;
    });
};

KeyStore.prototype.listClientServiceCreditAddressesInUse = function (clientIndex, servCreditIndex, fromAddrIndex, toAddrIndex) {
    return this.listClientServiceCreditAddresses(clientIndex, servCreditIndex, fromAddrIndex, toAddrIndex, true);
};

KeyStore.prototype.getClientMessageCreditAddressKeys = function (clientIndex, addrIndex, isObsolete = false) {
    return this.getClientServiceCreditAddressKeys(clientIndex, 0, addrIndex, isObsolete);
};

KeyStore.prototype.listClientMessageCreditAddresses = function (clientIndex, fromAddrIndex, toAddrIndex, onlyInUse) {
    return this.listClientServiceCreditAddresses(clientIndex, 0, fromAddrIndex, toAddrIndex, onlyInUse);
};

KeyStore.prototype.listClientMessageCreditAddressesInUse = function (clientIndex, fromAddrIndex, toAddrIndex) {
    return this.listClientServiceCreditAddresses(clientIndex, 0, fromAddrIndex, toAddrIndex, true);
};

KeyStore.prototype.getClientAssetCreditAddressKeys = function (clientIndex, addrIndex, isObsolete = false) {
    return this.getClientServiceCreditAddressKeys(clientIndex, 1, addrIndex, isObsolete);
};

KeyStore.prototype.listClientAssetCreditAddresses = function (clientIndex, fromAddrIndex, toAddrIndex, onlyInUse) {
    return this.listClientServiceCreditAddresses(clientIndex, 1, fromAddrIndex, toAddrIndex, onlyInUse);
};

KeyStore.prototype.listClientAssetCreditAddressesInUse = function (clientIndex, fromAddrIndex, toAddrIndex) {
    return this.listClientServiceCreditAddresses(clientIndex, 1, fromAddrIndex, toAddrIndex, true);
};

KeyStore.prototype.initDeviceHDNodes = function (clientIndex, deviceIndex) {
    // Validate arguments
    var errArg = {};

    if (!isValidClientIndex(clientIndex)) {
        errArg.clientIndex = clientIndex;
    }

    if (!isValidDeviceIndex(deviceIndex)) {
        errArg.deviceIndex = deviceIndex;
    }

    if (Object.keys(errArg).length > 0) {
        var errArgs = Object.keys(errArg);

        Catenis.logger.ERROR(util.format('KeyStore.initDeviceHDNodes method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    var success = false,
        hdNodesToStore = [];

    // Try to retrieve internal hierarchy root HD extended key for client with given index
    var clientIntHierarchyRootPath = util.format('m/%d/0', clientIndex),
        clientIntHierarchyRootHDNode = retrieveHDNode.call(this, clientIntHierarchyRootPath);

    if (clientIntHierarchyRootHDNode == null) {
        // Client internal hierarchy root HD extended key does not exist yet.
        //  Try to initialize client HD extended keys
        if (! this.initClientHDNodes(clientIndex)) {
            Catenis.logger.ERROR(util.format('HD extended keys for client with index %d could not be initialized', clientIndex));
        }
        else {
            // Client HD extended keys successfully initialized.
            //  Retrieve client internal hierarchy root HD extend key again
            clientIntHierarchyRootHDNode = retrieveHDNode.call(this, clientIntHierarchyRootPath);
        }
    }

    if (clientIntHierarchyRootHDNode == null) {
        Catenis.logger.ERROR(util.format('internal hierarchy root HD extended key for client with index %d not found', clientIndex));
    }
    else {
        // Try to retrieve public hierarchy root HD extended key for client with given index
        var clientPubHierarchyRootPath = util.format('m/%d/1', clientIndex),
            clientPubHierarchyRootHDNode = retrieveHDNode.call(this, clientPubHierarchyRootPath);

        if (clientPubHierarchyRootHDNode == null) {
            Catenis.logger.ERROR(util.format('public hierarchy root HD extended key for client with index %d not found', clientIndex));
        }
        else {
            // Create client internal root HD extended key for device with given index
            var deviceIntRootPath = util.format('%s/%d', clientIntHierarchyRootPath, deviceIndex),
                deviceIntRootHDNode = clientIntHierarchyRootHDNode.derive(deviceIndex);

            if (deviceIntRootHDNode.index !== deviceIndex) {
                Catenis.logger.WARN(util.format('Device internal root HD extended key (%s) derived with an unexpected index', path), {
                    expectedIndex: deviceIndex,
                    returnedIndex: deviceIntRootHDNode.index
                });
            }
            else {
                // Save newly created HD extended key to store it later
                hdNodesToStore.push({type: 'dev_int_root', path: deviceIntRootPath, hdNode: deviceIntRootHDNode, isLeaf: false, isReserved: false});

                // Create all predefined and reserved device internal addresses root HD extended keys
                for (let idx = 0; idx < numDeviceAddrRoots; idx++) {
                    let deviceIntAddrRootPath = util.format('%s/%d', deviceIntRootPath, idx),
                        deviceIntAddrRootHDNode = deviceIntRootHDNode.derive(idx);

                    if (deviceIntAddrRootHDNode.index !== idx) {
                        Catenis.logger.WARN(util.format('Device internal addresses #%d root HD extended key (%s) derived with an unexpected index', idx + 1, deviceIntAddrRootPath), {
                            expectedIndex: idx,
                            returnedIndex: deviceIntAddrRootHDNode.index
                        });
                        deviceIntRootHDNode = null;
                    }
                    else {
                        // Save newly created HD extended key to store it later
                        hdNodesToStore.push({type: idx == 0 ? 'dev_read_conf_addr_root' : 'dev_int_rsrv_addr_root', path: deviceIntAddrRootPath, hdNode: deviceIntAddrRootHDNode, isLeaf: false, isReserved: idx >= numUsedDeviceIntAddrRoots});
                    }
                }

                if (deviceIntRootHDNode != null) {
                    // Create client public root HD extended key for device with given index
                    var devicePubRootPath = util.format('%s/%d', clientPubHierarchyRootPath, deviceIndex),
                        devicePubRootHDNode = clientPubHierarchyRootHDNode.derive(deviceIndex);

                    if (devicePubRootHDNode.index !== deviceIndex) {
                        Catenis.logger.WARN(util.format('Device public root HD extended key (%s) derived with an unexpected index', path), {
                            expectedIndex: deviceIndex,
                            returnedIndex: devicePubRootHDNode.index
                        });
                    }
                    else {
                        // Save newly created HD extended key to store it later
                        hdNodesToStore.push({type: 'dev_pub_root', path: devicePubRootPath, hdNode: devicePubRootHDNode, isLeaf: false, isReserved: false});

                        // Create all predefined and reserved device public addresses root HD extended keys
                        for (let idx = 0; idx < numDeviceAddrRoots; idx++) {
                            let devicePubAddrRootPath = util.format('%s/%d', devicePubRootPath, idx),
                                devicePubAddrRootHDNode = devicePubRootHDNode.derive(idx);

                            if (devicePubAddrRootHDNode.index !== idx) {
                                Catenis.logger.WARN(util.format('Device public address #%d root HD extended key (%s) derived with an unexpected index', idx + 1, devicePubAddrRootPath), {
                                    expectedIndex: idx,
                                    returnedIndex: devicePubAddrRootHDNode.index
                                });
                                devicePubRootHDNode = null;
                            }
                            else {
                                // Save newly created HD extended key to store it later
                                hdNodesToStore.push({type: idx == 0 ? 'dev_main_addr_root' : (idx == 1 ? 'dev_asst_addr_root' : (idx == 2 ? 'dev_asst_issu_addr_root' : 'dev_pub_rsrv_addr_root')), path: devicePubAddrRootPath, hdNode: devicePubAddrRootHDNode, isLeaf: false, isReserved: idx >= numUsedDevicePubAddrRoots});
                            }
                        }

                        if (devicePubRootHDNode != null) {
                            // Store all newly created HD extended keys, and indicate success
                            var self = this;
                            
                            hdNodesToStore.forEach(function (hdNodeToStore) {
                                storeHDNode.call(self, hdNodeToStore.type, hdNodeToStore.path, hdNodeToStore.hdNode, hdNodeToStore.isLeaf, hdNodeToStore.isReserved);
                            });

                            success = true;
                        }
                    }
                }
            }
        }
    }

    return success;
};

KeyStore.prototype.getDeviceInternalAddressKeys = function (clientIndex, deviceIndex, addrRootIndex, addrIndex, isObsolete = false) {
    // Validate arguments
    var errArg = {};

    if (!isValidClientIndex(clientIndex)) {
        errArg.clientIndex = clientIndex;
    }

    if (!isValidDeviceIndex(deviceIndex)) {
        errArg.deviceIndex = deviceIndex;
    }

    if (!isValidAddressRootIndex(addrRootIndex)) {
        errArg.addrRootIndex = addrRootIndex;
    }

    if (!isValidAddressIndex(addrIndex)) {
        errArg.addrIndex = addrIndex;
    }

    if (Object.keys(errArg).length > 0) {
        var errArgs = Object.keys(errArg);

        Catenis.logger.ERROR(util.format('KeyStore.getDeviceInternalAddressKeys method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    // Try to retrieve specified internal address HD extended key for device of given client with given index
    var deviceIntAddrPath = util.format('m/%d/0/%d/%d/%d', clientIndex, deviceIndex, addrRootIndex, addrIndex),
        deviceIntAddrHDNode = retrieveHDNode.call(this, deviceIntAddrPath),
        deviceIntAddrKeys = null;

    if (deviceIntAddrHDNode == null) {
        // Device internal address HD extended key does not exist yet.
        //  Retrieve parent root HD extended key to create it
        var path = util.format('m/%d/0/%d/%d', clientIndex, deviceIndex, addrRootIndex),
            deviceIntAddrRootHDNode = retrieveHDNode.call(this, path);

        if (deviceIntAddrRootHDNode == null) {
            // Device internal addresses root HD extended key does not exist yet.
            //  Try to initialize device HD extended keys
            if (!this.initDeviceHDNodes(clientIndex, deviceIndex)) {
                Catenis.logger.ERROR(util.format('HD extended keys for device with index %d of client with index %d could not be initialized', deviceIndex, clientIndex));
            }
            else {
                // Device HD extended keys successfully initialized.
                //  Retrieve specified device internal addresses root HD extend key again
                deviceIntAddrRootHDNode = retrieveHDNode.call(this, path);
            }
        }

        if (deviceIntAddrRootHDNode == null) {
            Catenis.logger.ERROR(util.format('Internal addresses root HD extended key for device #%d of client with index %d not found', deviceIndex + 1, clientIndex));
        }
        else {
            // Try to create device internal address HD extended key now
            deviceIntAddrHDNode = deviceIntAddrRootHDNode.derive(addrIndex);

            if (deviceIntAddrHDNode.index !== addrIndex) {
                Catenis.logger.WARN(util.format('Device internal address HD extended key (%s) derived with an unexpected index', deviceIntAddrPath), {expectedIndex: addrIndex, returnedIndex: deviceIntAddrHDNode.index});
                deviceIntAddrHDNode = null;
            }
            else {
                // Store created HD extended key
                storeHDNode.call(this, addrRootIndex == 0 ? 'dev_read_conf_addr' : 'dev_int_rsrv_addr', deviceIntAddrPath, deviceIntAddrHDNode, true, addrRootIndex >= numUsedDeviceIntAddrRoots, isObsolete);
            }
        }
    }

    if (deviceIntAddrHDNode != null) {
        deviceIntAddrKeys = new Catenis.module.CryptoKeys(deviceIntAddrHDNode.keyPair);
    }

    return deviceIntAddrKeys;
};

KeyStore.prototype.listDeviceInternalAddresses = function (clientIndex, deviceIndex, addrRootIndex, fromAddrIndex, toAddrIndex, onlyInUse) {
    // Validate arguments
    var errArg = {},
        queryTerms = [{parentPath: util.format('m/%d/0/%d/%d', clientIndex, deviceIndex, addrRootIndex)}];

    if (!isValidClientIndex(clientIndex)) {
        errArg.clientIndex = clientIndex;
    }

    if (!isValidDeviceIndex(deviceIndex)) {
        errArg.deviceIndex = deviceIndex;
    }

    if (!isValidAddressRootIndex(addrRootIndex)) {
        errArg.addrRootIndex = addrRootIndex;
    }

    if (fromAddrIndex != undefined) {
        if (!isValidAddressIndex(fromAddrIndex)) {
            errArg.fromAddrIndex = fromAddrIndex;
        }
        else {
            queryTerms.push({index: {$gte: fromAddrIndex}});
        }
    }

    if (toAddrIndex != undefined) {
        if (!isValidAddressIndex(toAddrIndex) || (fromAddrIndex != undefined && toAddrIndex < fromAddrIndex)) {
            errArg.toAddrIndex = toAddrIndex;
        }
        else {
            queryTerms.push({index: {$lte: toAddrIndex}});
        }
    }

    if (Object.keys(errArg).length > 0) {
        var errArgs = Object.keys(errArg);

        Catenis.logger.ERROR(util.format('KeyStore.listDeviceInternalAddresses method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    if (onlyInUse) {
        queryTerms.push({isObsolete: false});
    }

    // Return existing device internal addresses within the specified range
    if (queryTerms.length > 1) {
        var query = {$and: queryTerms};
    }
    else {
        query = queryTerms[0];
    }

    return this.collExtKey.chain().find(query).simplesort('index').data().map(function (docExtKey) {
        return docExtKey.address;
    });
};

KeyStore.prototype.listDeviceInternalAddressesInUse = function (clientIndex, deviceIndex, addrRootIndex, fromAddrIndex, toAddrIndex) {
    return this.listDeviceInternalAddresses(clientIndex, deviceIndex, addrRootIndex, fromAddrIndex, toAddrIndex, true);
};

KeyStore.prototype.getDevicePublicAddressKeys = function (clientIndex, deviceIndex, addrRootIndex, addrIndex, isObsolete = false) {
    // Validate arguments
    var errArg = {};

    if (!isValidClientIndex(clientIndex)) {
        errArg.clientIndex = clientIndex;
    }

    if (!isValidDeviceIndex(deviceIndex)) {
        errArg.deviceIndex = deviceIndex;
    }

    if (!isValidAddressRootIndex(addrRootIndex)) {
        errArg.addrRootIndex = addrRootIndex;
    }

    if (!isValidAddressIndex(addrIndex)) {
        errArg.addrIndex = addrIndex;
    }

    if (Object.keys(errArg).length > 0) {
        var errArgs = Object.keys(errArg);

        Catenis.logger.ERROR(util.format('KeyStore.getDevicePublicAddressKeys method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    // Try to retrieve specified public address HD extended key for device of given client with given index
    var devicePubAddrPath = util.format('m/%d/1/%d/%d/%d', clientIndex, deviceIndex, addrRootIndex, addrIndex),
        devicePubAddrHDNode = retrieveHDNode.call(this, devicePubAddrPath),
        devicePubAddrKeys = null;

    if (devicePubAddrHDNode == null) {
        // Device public address HD extended key does not exist yet.
        //  Retrieve parent root HD extended key to create it
        var path = util.format('m/%d/1/%d/%d', clientIndex, deviceIndex, addrRootIndex),
            devicePubAddrRootHDNode = retrieveHDNode.call(this, path);

        if (devicePubAddrRootHDNode == null) {
            // Device public addresses root HD extended key does not exist yet.
            //  Try to initialize device HD extended keys
            if (!this.initDeviceHDNodes(clientIndex, deviceIndex)) {
                Catenis.logger.ERROR(util.format('HD extended keys for device with index %d of client with index %d could not be initialized', deviceIndex, clientIndex));
            }
            else {
                // Device HD extended keys successfully initialized.
                //  Retrieve specified device public addresses root HD extend key again
                devicePubAddrRootHDNode = retrieveHDNode.call(this, path);
            }
        }

        if (devicePubAddrRootHDNode == null) {
            Catenis.logger.ERROR(util.format('Public addresses root HD extended key for device #%d of client with index %d not found', deviceIndex + 1, clientIndex));
        }
        else {
            // Try to create device public address HD extended key now
            devicePubAddrHDNode = devicePubAddrRootHDNode.derive(addrIndex);

            if (devicePubAddrHDNode.index !== addrIndex) {
                Catenis.logger.WARN(util.format('Device public address HD extended key (%s) derived with an unexpected index', devicePubAddrPath), {expectedIndex: addrIndex, returnedIndex: devicePubAddrHDNode.index});
                devicePubAddrHDNode = null;
            }
            else {
                // Store created HD extended key
                storeHDNode.call(this, addrRootIndex == 0 ? 'dev_main_addr' : (addrRootIndex == 1 ? 'dev_asst_addr' : (addrRootIndex == 2 ? 'dev_asst_issu_addr' : 'dev_pub_rsrv_addr')), devicePubAddrPath, devicePubAddrHDNode, true, addrRootIndex >= numUsedDevicePubAddrRoots, isObsolete);
            }
        }
    }

    if (devicePubAddrHDNode != null) {
        devicePubAddrKeys = new Catenis.module.CryptoKeys(devicePubAddrHDNode.keyPair);
    }

    return devicePubAddrKeys;
};

KeyStore.prototype.listDevicePublicAddresses = function (clientIndex, deviceIndex, addrRootIndex, fromAddrIndex, toAddrIndex, onlyInUse) {
    // Validate arguments
    var errArg = {},
        queryTerms = [{parentPath: util.format('m/%d/1/%d/%d', clientIndex, deviceIndex, addrRootIndex)}];

    if (!isValidClientIndex(clientIndex)) {
        errArg.clientIndex = clientIndex;
    }

    if (!isValidDeviceIndex(deviceIndex)) {
        errArg.deviceIndex = deviceIndex;
    }

    if (!isValidAddressRootIndex(addrRootIndex)) {
        errArg.addrRootIndex = addrRootIndex;
    }

    if (fromAddrIndex != undefined) {
        if (!isValidAddressIndex(fromAddrIndex)) {
            errArg.fromAddrIndex = fromAddrIndex;
        }
        else {
            queryTerms.push({index: {$gte: fromAddrIndex}});
        }
    }

    if (toAddrIndex != undefined) {
        if (!isValidAddressIndex(toAddrIndex) || (fromAddrIndex != undefined && toAddrIndex < fromAddrIndex)) {
            errArg.toAddrIndex = toAddrIndex;
        }
        else {
            queryTerms.push({index: {$lte: toAddrIndex}});
        }
    }

    if (Object.keys(errArg).length > 0) {
        var errArgs = Object.keys(errArg);

        Catenis.logger.ERROR(util.format('KeyStore.listDevicePublicAddresses method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    if (onlyInUse) {
        queryTerms.push({isObsolete: false});
    }

    // Return existing device internal addresses within the specified range
    if (queryTerms.length > 1) {
        var query = {$and: queryTerms};
    }
    else {
        query = queryTerms[0];
    }

    return this.collExtKey.chain().find(query).simplesort('index').data().map(function (docExtKey) {
        return docExtKey.address;
    });
};

KeyStore.prototype.listDevicePublicAddressesInUse = function (clientIndex, deviceIndex, addrRootIndex, fromAddrIndex, toAddrIndex) {
    return this.listDevicePublicAddresses(clientIndex, deviceIndex, addrRootIndex, fromAddrIndex, toAddrIndex, true);
};

// Note: this method has only been defined for device public addresses because
//      we foresee that only device asset issuance addresses (a type of device
//      public addresses) are going to need to use it.
KeyStore.prototype.latestDevicePublicAddress = function (clientIndex, deviceIndex, addrRootIndex, onlyInUse) {
    // Validate arguments
    var errArg = {},
        queryTerms = [{parentPath: util.format('m/%d/1/%d/%d', clientIndex, deviceIndex, addrRootIndex)}];

    if (!isValidClientIndex(clientIndex)) {
        errArg.clientIndex = clientIndex;
    }

    if (!isValidDeviceIndex(deviceIndex)) {
        errArg.deviceIndex = deviceIndex;
    }

    if (!isValidAddressRootIndex(addrRootIndex)) {
        errArg.addrRootIndex = addrRootIndex;
    }

    if (Object.keys(errArg).length > 0) {
        var errArgs = Object.keys(errArg);

        Catenis.logger.ERROR(util.format('KeyStore.listDevicePublicAddresses method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    if (onlyInUse) {
        queryTerms.push({isObsolete: false});
    }

    // Return existing device internal addresses within the specified range
    if (queryTerms.length > 1) {
        var query = {$and: queryTerms};
    }
    else {
        query = queryTerms[0];
    }

    return this.collExtKey.chain().find(query).simplesort('index', true).limit(1).data().reduce(function (docExtKey) {
        return docExtKey.address;
    }, null);
};

KeyStore.prototype.latestDevicePublicAddressInUse = function (clientIndex, deviceIndex, addrRootIndex) {
    return this.latestDevicePublicAddress(clientIndex, deviceIndex, addrRootIndex, true);
};

KeyStore.prototype.getDeviceReadConfirmAddressKeys = function (clientIndex, deviceIndex, addrIndex, isObsolete = false) {
    return this.getDeviceInternalAddressKeys(clientIndex, deviceIndex, 0, addrIndex, isObsolete);
};

KeyStore.prototype.listDeviceReadConfirmAddresses = function (clientIndex, deviceIndex, fromAddrIndex, toAddrIndex, onlyInUse) {
    return this.listDeviceInternalAddresses(clientIndex, deviceIndex, 0, fromAddrIndex, toAddrIndex, onlyInUse);
};

KeyStore.prototype.listDeviceReadConfirmAddressesInUse = function (clientIndex, deviceIndex, fromAddrIndex, toAddrIndex) {
    return this.listDeviceInternalAddresses(clientIndex, deviceIndex, 0, fromAddrIndex, toAddrIndex, true);
};

KeyStore.prototype.getDeviceMainAddressKeys = function (clientIndex, deviceIndex, addrIndex, isObsolete = false) {
    return this.getDevicePublicAddressKeys(clientIndex, deviceIndex, 0, addrIndex, isObsolete);
};

KeyStore.prototype.listDeviceMainAddresses = function (clientIndex, deviceIndex, fromAddrIndex, toAddrIndex, onlyInUse) {
    return this.listDevicePublicAddresses(clientIndex, deviceIndex, 0, fromAddrIndex, toAddrIndex, onlyInUse);
};

KeyStore.prototype.listDeviceMainAddressesInUse = function (clientIndex, deviceIndex, fromAddrIndex, toAddrIndex) {
    return this.listDevicePublicAddresses(clientIndex, deviceIndex, 0, fromAddrIndex, toAddrIndex, true);
};

KeyStore.prototype.getDeviceAssetAddressKeys = function (clientIndex, deviceIndex, addrIndex, isObsolete = false) {
    return this.getDevicePublicAddressKeys(clientIndex, deviceIndex, 1, addrIndex, isObsolete);
};

KeyStore.prototype.listDeviceAssetAddresses = function (clientIndex, deviceIndex, fromAddrIndex, toAddrIndex, onlyInUse) {
    return this.listDevicePublicAddresses(clientIndex, deviceIndex, 1, fromAddrIndex, toAddrIndex, onlyInUse);
};

KeyStore.prototype.listDeviceAssetAddressesInUse = function (clientIndex, deviceIndex, fromAddrIndex, toAddrIndex) {
    return this.listDevicePublicAddresses(clientIndex, deviceIndex, 1, fromAddrIndex, toAddrIndex, true);
};

KeyStore.prototype.getDeviceAssetIssuanceAddressKeys = function (clientIndex, deviceIndex, addrIndex, isObsolete = false) {
    return this.getDevicePublicAddressKeys(clientIndex, deviceIndex, 2, addrIndex, isObsolete);
};

KeyStore.prototype.listDeviceAssetIssuanceAddresses = function (clientIndex, deviceIndex, fromAddrIndex, toAddrIndex, onlyInUse) {
    return this.listDevicePublicAddresses(clientIndex, deviceIndex, 2, fromAddrIndex, toAddrIndex, onlyInUse);
};

KeyStore.prototype.listDeviceAssetIssuanceAddressesInUse = function (clientIndex, deviceIndex, fromAddrIndex, toAddrIndex) {
    return this.listDevicePublicAddresses(clientIndex, deviceIndex, 2, fromAddrIndex, toAddrIndex, true);
};

KeyStore.prototype.latestDeviceAssetIssuanceAddress = function (clientIndex, deviceIndex, onlyInUse) {
    return this.latestDevicePublicAddress(clientIndex, deviceIndex, 2, onlyInUse);
};

KeyStore.prototype.latestDeviceAssetIssuanceAddressInUse = function (clientIndex, deviceIndex) {
    return this.latestDevicePublicAddress(clientIndex, deviceIndex, 2, true);
};


// Module functions used to simulate private KeyStore object methods
//  NOTE: these functions need to be bound to a KeyStore object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

function purgeUnusedExtendedKeys() {
    Catenis.logger.TRACE('Executing process to purge unused HD extended keys from local key storage');
    // Calculate earliest date/time for obsolete HD extended key to have been created/update for it not to be purged
    var obsoleteEarliestTime = new Date(Date.now());
    obsoleteEarliestTime.setSeconds(obsoleteEarliestTime.getSeconds() - cfgSettings.obsoleteExtKeyTimeToPurge);

    var obsoleteEarliestTimestamp = obsoleteEarliestTime.getTime();

    // Remove reserved HD extended keys, and HD extended keys that have
    //  turned obsolete for a while
    this.collExtKey.removeWhere({$or: [{isReserved: true}, {$and: [{isObsolete: true}, {'meta.revision': 0}, {'meta.created': {$lt: obsoleteEarliestTimestamp}}]},
        {$and: [{isObsolete: true}, {'meta.revision': {$gt: 0}}, {'meta.updated': {$lt: obsoleteEarliestTimestamp}}]}]});
}

function storeHDNode(type, path, hdNode, isLeaf, isReserved, isObsolete) {
    if (isLeaf == undefined) {
        isLeaf = false;
    }

    if (isReserved == undefined) {
        isReserved = false;
    }

    if (!isLeaf || isObsolete == undefined) {
        isObsolete = false;
    }

    var docExtKey = {type: type, path: path, parentPath: parentPath(path), depth: hdNode.depth, index: hdNode.index, strHDNode: hdNode.toBase58(), address: (new Catenis.module.CryptoKeys(hdNode.keyPair)).getAddress(), isLeaf: isLeaf, isReserved: isReserved, isObsolete: isObsolete};

    this.collExtKey.insert(docExtKey);
}

function retrieveHDNode(path) {
    var docExtKey = this.collExtKey.by('path', path);

    return docExtKey != undefined ? bitcoinLib.HDNode.fromBase58(docExtKey.strHDNode, this.cryptoNetwork) : null;
}


// KeyStore function class (public) methods
//

KeyStore.initialize = function () {
    // Instantiate KeyStore object
    Catenis.keyStore = new KeyStore(Catenis.application.ctnHubNodeIndex, Catenis.application.seed, Catenis.application.cryptoNetwork);

    // Execute process to purge unused HD extended keys from local key storage now,
    //  and set recurring timer to execute it periodically
    purgeUnusedExtendedKeys.call(Catenis.keyStore);
    Catenis.logger.TRACE('Setting recurring timer to purge unused HD extended keys from local key storage');
    purgeUnusedExtKeyInternalHandle = Meteor.setInterval(purgeUnusedExtendedKeys.bind(Catenis.keyStore), cfgSettings.purgeUnusedExtKeyInterval);
};

KeyStore.catenisNodeFundingPaymentRootPath = function (ctnNodeIndex) {
    // Validate Catenis node index
    if (!isValidCatenisNodeIndex(ctnNodeIndex)) {
        Catenis.logger.ERROR('KeyStore.catenisNodeFundingPaymentRootPath method called with invalid argument', {ctnNodeIndex: ctnNodeIndex});
        throw Error('Invalid ctnNodeIndex argument');
    }
    
    return util.format('m/0/%d/1/0', ctnNodeIndex);
};

KeyStore.catenisNodeFundingChangeRootPath = function (ctnNodeIndex) {
    // Validate Catenis node index
    if (!isValidCatenisNodeIndex(ctnNodeIndex)) {
        Catenis.logger.ERROR('KeyStore.catenisNodeFundingChangeRootPath method called with invalid argument', {ctnNodeIndex: ctnNodeIndex});
        throw Error('Invalid ctnNodeIndex argument');
    }

    return util.format('m/0/%d/1/1', ctnNodeIndex);
};

KeyStore.catenisNodePayTxExpenseRootPath = function (ctnNodeIndex) {
    // Validate Catenis node index
    if (!isValidCatenisNodeIndex(ctnNodeIndex)) {
        Catenis.logger.ERROR('KeyStore.catenisNodePayTxExpenseRootPath method called with invalid argument', {ctnNodeIndex: ctnNodeIndex});
        throw Error('Invalid ctnNodeIndex argument');
    }

    return util.format('m/0/%d/2', ctnNodeIndex);
};

KeyStore.catenisNodeDeviceMainAddressRootPath = function (ctnNodeIndex) {
    // Validate Catenis node index
    if (!isValidCatenisNodeIndex(ctnNodeIndex)) {
        Catenis.logger.ERROR('KeyStore.catenisNodeDeviceMainAddressRootPath method called with invalid argument', {ctnNodeIndex: ctnNodeIndex});
        throw Error('Invalid ctnNodeIndex argument');
    }

    return util.format('m/0/%d/0/0', ctnNodeIndex);
};

KeyStore.clientMessageCreditAddressRootPath = function (clientIndex) {
    // Validate client index
    if (!isValidClientIndex(clientIndex)) {
        Catenis.logger.ERROR('KeyStore.clientMessageCreditAddressesRootPath method called with invalid argument', {clientIndex: clientIndex});
        throw Error('Invalid clientIndex argument');
    }

    return util.format('m/%d/0/0/0/0', clientIndex);
};

KeyStore.clientAssetCreditAddressRootPath = function (clientIndex) {
    // Validate client index
    if (!isValidClientIndex(clientIndex)) {
        Catenis.logger.ERROR('KeyStore.clientAssetCreditAddressesRootPath method called with invalid argument', {clientIndex: clientIndex});
        throw Error('Invalid clientIndex argument');
    }

    return util.format('m/%d/0/0/0/1', clientIndex);
};

KeyStore.deviceReadConfirmAddressRootPath = function (clientIndex, deviceIndex) {
    // Validate arguments
    var errArg = {};

    if (!isValidClientIndex(clientIndex)) {
        errArg.clientIndex = clientIndex;
    }

    if (!isValidDeviceIndex(deviceIndex)) {
        errArg.deviceIndex = deviceIndex;
    }

    if (Object.keys(errArg).length > 0) {
        var errArgs = Object.keys(errArg);

        Catenis.logger.ERROR(util.format('KeyStore.deviceReadConfirmAddressRootPath method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    return util.format('m/%d/0/%d/0', clientIndex, deviceIndex);
};

KeyStore.deviceMainAddressRootPath = function (clientIndex, deviceIndex) {
    // Validate arguments
    var errArg = {};

    if (!isValidClientIndex(clientIndex)) {
        errArg.clientIndex = clientIndex;
    }

    if (!isValidDeviceIndex(deviceIndex)) {
        errArg.deviceIndex = deviceIndex;
    }

    if (Object.keys(errArg).length > 0) {
        var errArgs = Object.keys(errArg);

        Catenis.logger.ERROR(util.format('KeyStore.deviceMainAddressRootPath method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    return util.format('m/%d/1/%d/0', clientIndex, deviceIndex);
};

KeyStore.deviceAssetAddressRootPath = function (clientIndex, deviceIndex) {
    // Validate arguments
    var errArg = {};

    if (!isValidClientIndex(clientIndex)) {
        errArg.clientIndex = clientIndex;
    }

    if (!isValidDeviceIndex(deviceIndex)) {
        errArg.deviceIndex = deviceIndex;
    }

    if (Object.keys(errArg).length > 0) {
        var errArgs = Object.keys(errArg);

        Catenis.logger.ERROR(util.format('KeyStore.deviceAssetAddressRootPath method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    return util.format('m/%d/1/%d/1', clientIndex, deviceIndex);
};

KeyStore.deviceAssetIssuanceAddressRootPath = function (clientIndex, deviceIndex) {
    // Validate arguments
    var errArg = {};

    if (!isValidClientIndex(clientIndex)) {
        errArg.clientIndex = clientIndex;
    }

    if (!isValidDeviceIndex(deviceIndex)) {
        errArg.deviceIndex = deviceIndex;
    }

    if (Object.keys(errArg).length > 0) {
        var errArgs = Object.keys(errArg);

        Catenis.logger.ERROR(util.format('KeyStore.deviceAssetIssuanceAddressRootPath method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    return util.format('m/%d/1/%d/2', clientIndex, deviceIndex);
};

KeyStore.getPathParts = function (docExtKey) {
    var pathParts = {},
        hasParts = false,
        extKeyType,
        searchResult;

    if (docExtKey.type in KeyStore.extKeyType && 'pathParts' in (extKeyType = KeyStore.extKeyType[docExtKey.type])
        && (searchResult = docExtKey.path.match(extKeyType.pathRegEx))) {
        for (let partNum in extKeyType.pathParts) {
            if (partNum < searchResult.length) {
                pathParts[extKeyType.pathParts[partNum]] = parseInt(searchResult[partNum]);
                hasParts = true;
            }
        }
    }

    return hasParts ? pathParts : null;
};


// KeyStore function class (public) properties
//

KeyStore.catenisHubFundingPaymentRootPath = 'm/0/0/1/0';

KeyStore.catenisHubFundingChangeRootPath = 'm/0/0/1/1';

KeyStore.catenisHubPayTxExpenseRootPath = 'm/0/0/2';

KeyStore.catenisHubDeviceMainAddressRootPath = 'm/0/0/0/0';

KeyStore.extKeyType = Object.freeze({
    mstr: Object.freeze({
        name: 'mstr',
        description: 'master root',
        pathRegEx: /^m$/
    }),
    sys_root: Object.freeze({
        name: 'sys_root',
        description: 'system root',
        pathRegEx: /^m\/0$/
    }),
    ctnd_root: Object.freeze({
        name: 'ctnd_root',
        description: 'Catenis node root',
        pathRegEx: /^m\/0\/(\d+)$/,
        pathParts: {
            1: 'ctnNodeIndex'
        }
    }),
    ctnd_dev_root: Object.freeze({
        name: 'ctnd_dev_root',
        description: 'Catenis node device root',
        pathRegEx: /^m\/0\/(\d+)\/0$/,
        pathParts: {
            1: 'ctnNodeIndex'
        }
    }),
    ctnd_fund_root: Object.freeze({
        name: 'ctnd_fund_root',
        description: 'Catenis node funding root',
        pathRegEx: /^m\/0\/(\d+)\/1$/,
        pathParts: {
            1: 'ctnNodeIndex'
        }
    }),
    ctnd_pay_tx_exp_root: Object.freeze({
        name: 'ctnd_pay_tx_exp_root',
        description: 'Catenis node pay tx expense root',
        pathRegEx: /^m\/0\/(\d+)\/2$/,
        pathParts: {
            1: 'ctnNodeIndex'
        }
    }),
    ctnd_dev_main_addr_root: Object.freeze({
        name: 'ctnd_dev_main_addr_root',
        description: 'Catenis node device main addresses root',
        pathRegEx: /^m\/0\/(\d+)\/0\/0$/,
        pathParts: {
            1: 'ctnNodeIndex'
        }
    }),
    ctnd_dev_rsrv_addr_root: Object.freeze({
        name: 'ctnd_dev_rsrv_addr_root',
        description: 'Catenis node device reserved addresses root',
        pathRegEx: /^m\/0\/(\d+)\/0\/(\d+)$/,
        pathParts: {
            1: 'ctnNodeIndex',
            2: 'addrRootIndex'
        }
    }),
    ctnd_dev_main_addr: Object.freeze({
        name: 'ctnd_dev_main_addr',
        description: 'Catenis node device main address',
        pathRegEx: /^m\/0\/(\d+)\/0\/0\/(\d+)$/,
        pathParts: {
            1: 'ctnNodeIndex',
            2: 'addrIndex'
        }
    }),
    ctnd_dev_rsrv_addr: Object.freeze({
        name: 'ctnd_dev_rsrv_addr',
        description: 'Catenis node device reserved address',
        pathRegEx: /^m\/0\/(\d+)\/0\/(\d+)\/(\d+)$/,
        pathParts: {
            1: 'ctnNodeIndex',
            2: 'addrRootIndex',
            3: 'addrIndex'
        }
    }),
    ctnd_fund_pay_root: Object.freeze({
        name: 'ctnd_fund_pay_root',
        description: 'Catenis node funding payment root',
        pathRegEx: /^m\/0\/(\d+)\/1\/0$/,
        pathParts: {
            1: 'ctnNodeIndex'
        }
    }),
    ctnd_fund_chg_root: Object.freeze({
        name: 'ctnd_fund_chg_root',
        description: 'Catenis node funding change root',
        pathRegEx: /^m\/0\/(\d+)\/1\/1$/,
        pathParts: {
            1: 'ctnNodeIndex'
        }
    }),
    ctnd_fund_pay_addr: Object.freeze({
        name: 'ctnd_fund_pay_addr',
        description: 'Catenis node funding payment address',
        pathRegEx: /^m\/0\/(\d+)\/1\/0\/(\d+)$/,
        pathParts: {
            1: 'ctnNodeIndex',
            2: 'addrIndex'
        }
    }),
    ctnd_fund_chg_addr: Object.freeze({
        name: 'ctnd_fund_chg_addr',
        description: 'Catenis node funding change address',
        pathRegEx: /^m\/0\/(\d+)\/1\/1\/(\d+)$/,
        pathParts: {
            1: 'ctnNodeIndex',
            2: 'addrIndex'
        }
    }),
    ctnd_pay_tx_exp_addr: Object.freeze({
        name: 'ctnd_pay_tx_exp_addr',
        description: 'Catenis node pay tx expense address',
        pathRegEx: /^m\/0\/(\d+)\/2\/(\d+)$/,
        pathParts: {
            1: 'ctnNodeIndex',
            2: 'addrIndex'
        }
    }),
    cln_root: Object.freeze({
        name: 'cln_root',
        description: 'client root',
        pathRegEx: /^m\/(\d+)$/,
        pathParts: {
            1: 'clientIndex'
        }
    }),
    cln_int_hrch_root: Object.freeze({
        name: 'cln_int_hrch_root',
        description: 'client internal hierarchy root',
        pathRegEx: /^m\/(\d+)\/0$/,
        pathParts: {
            1: 'clientIndex'
        }
    }),
    cln_pub_hrch_root: Object.freeze({
        name: 'cln_pub_hrch_root',
        description: 'client public hierarchy root',
        pathRegEx: /^m\/(\d+)\/1$/,
        pathParts: {
            1: 'clientIndex'
        }
    }),
    cln_int_root: Object.freeze({
        name: 'cln_int_root',
        description: 'client internal root',
        pathRegEx: /^m\/(\d+)\/0\/0$/,
        pathParts: {
            1: 'clientIndex'
        }
    }),
    cln_srv_crd_root: Object.freeze({
        name: 'cln_srv_crd_root',
        description: 'client service credit root',
        pathRegEx: /^m\/(\d+)\/0\/0\/0$/,
        pathParts: {
            1: 'clientIndex'
        }
    }),
    cln_msg_crd_addr_root: Object.freeze({
        name: 'cln_msg_crd_addr_root',
        description: 'client message credit addresses root',
        pathRegEx: /^m\/(\d+)\/0\/0\/0\/0$/,
        pathParts: {
            1: 'clientIndex'
        }
    }),
    cln_asst_crd_addr_root: Object.freeze({
        name: 'cln_asst_crd_addr_root',
        description: 'client asset credit addresses root',
        pathRegEx: /^m\/(\d+)\/0\/0\/0\/1$/,
        pathParts: {
            1: 'clientIndex'
        }
    }),
    cln_srv_crd_rsrv_addr_root: Object.freeze({
        name: 'cln_srv_crd_rsrv_addr_root',
        description: 'client service credit reserved addresses root',
        pathRegEx: /^m\/(\d+)\/0\/0\/0\/(\d+)$/,
        pathParts: {
            1: 'clientIndex',
            2: 'servCreditIndex'
        }
    }),
    cln_msg_crd_addr: Object.freeze({
        name: 'cln_msg_crd_addr',
        description: 'client message credit address',
        pathRegEx: /^m\/(\d+)\/0\/0\/0\/0\/(\d+)$/,
        pathParts: {
            1: 'clientIndex',
            2: 'addrIndex'
        }
    }),
    cln_asst_crd_addr: Object.freeze({
        name: 'cln_asst_crd_addr',
        description: 'client asset credit address',
        pathRegEx: /^m\/(\d+)\/0\/0\/0\/1\/(\d+)$/,
        pathParts: {
            1: 'clientIndex',
            2: 'addrIndex'
        }
    }),
    cln_srv_crd_rsrv_addr: Object.freeze({
        name: 'cln_srv_crd_rsrv_addr',
        description: 'client service credit reserved address',
        pathRegEx: /^m\/(\d+)\/0\/0\/0\/(\d+)\/(\d+)$/,
        pathParts: {
            1: 'clientIndex',
            2: 'servCreditIndex',
            3: 'addrIndex'
        }
    }),
    dev_int_root: Object.freeze({
        name: 'dev_int_root',
        description: 'device internal root',
        pathRegEx: /^m\/(\d+)\/0\/(\d+)$/,
        pathParts: {
            1: 'clientIndex',
            2: 'deviceIndex'
        }
    }),
    dev_read_conf_addr_root: Object.freeze({
        name: 'dev_read_conf_addr_root',
        description: 'device read confirmation addresses root',
        pathRegEx: /^m\/(\d+)\/0\/(\d+)\/0$/,
        pathParts: {
            1: 'clientIndex',
            2: 'deviceIndex'
        }
    }),
    dev_int_rsrv_addr_root: Object.freeze({
        name: 'dev_int_rsrv_addr_root',
        description: 'device internal reserved addresses root',
        pathRegEx: /^m\/(\d+)\/0\/(\d+)\/(\d+)$/,
        pathParts: {
            1: 'clientIndex',
            2: 'deviceIndex',
            3: 'addrRootIndex'
        }
    }),
    dev_read_conf_addr: Object.freeze({
        name: 'dev_read_conf_addr',
        description: 'device read confirmation address',
        pathRegEx: /^m\/(\d+)\/0\/(\d+)\/0\/(\d+)$/,
        pathParts: {
            1: 'clientIndex',
            2: 'deviceIndex',
            3: 'addrIndex'
        }
    }),
    dev_int_rsrv_addr: Object.freeze({
        name: 'dev_int_rsrv_addr',
        description: 'device internal reserved address',
        pathRegEx: /^m\/(\d+)\/0\/(\d+)\/(\d+)\/(\d+)$/,
        pathParts: {
            1: 'clientIndex',
            2: 'deviceIndex',
            3: 'addrRootIndex',
            4: 'addrIndex'
        }
    }),
    dev_pub_root: Object.freeze({
        name: 'dev_pub_root',
        description: 'device public root',
        pathRegEx: /^m\/(\d+)\/1\/(\d+)$/,
        pathParts: {
            1: 'clientIndex',
            2: 'deviceIndex'
        }
    }),
    dev_main_addr_root: Object.freeze({
        name: 'dev_main_addr_root',
        description: 'device main addresses root',
        pathRegEx: /^m\/(\d+)\/1\/(\d+)\/0$/,
        pathParts: {
            1: 'clientIndex',
            2: 'deviceIndex'
        }
    }),
    dev_asst_addr_root: Object.freeze({
        name: 'dev_asst_addr_root',
        description: 'device asset addresses root',
        pathRegEx: /^m\/(\d+)\/1\/(\d+)\/1$/,
        pathParts: {
            1: 'clientIndex',
            2: 'deviceIndex'
        }
    }),
    dev_asst_issu_addr_root: Object.freeze({
        name: 'dev_asst_issu_addr_root',
        description: 'device asset issuance addresses root',
        pathRegEx: /^m\/(\d+)\/1\/(\d+)\/2$/,
        pathParts: {
            1: 'clientIndex',
            2: 'deviceIndex'
        }
    }),
    dev_pub_rsrv_addr_root: Object.freeze({
        name: 'dev_pub_rsrv_addr_root',
        description: 'device public reserved addresses root',
        pathRegEx: /^m\/(\d+)\/1\/(\d+)\/(\d+)$/,
        pathParts: {
            1: 'clientIndex',
            2: 'deviceIndex',
            3: 'addrRootIndex'
        }
    }),
    dev_main_addr: Object.freeze({
        name: 'dev_main_addr',
        description: 'device main address',
        pathRegEx: /^m\/(\d+)\/1\/(\d+)\/0\/(\d+)$/,
        pathParts: {
            1: 'clientIndex',
            2: 'deviceIndex',
            3: 'addrIndex'
        }
    }),
    dev_asst_addr: Object.freeze({
        name: 'dev_asst_addr',
        description: 'device asset address',
        pathRegEx: /^m\/(\d+)\/1\/(\d+)\/1\/(\d+)$/,
        pathParts: {
            1: 'clientIndex',
            2: 'deviceIndex',
            3: 'addrIndex'
        }
    }),
    dev_asst_issu_addr: Object.freeze({
        name: 'dev_asst_issu_addr',
        description: 'device asset issuance address',
        pathRegEx: /^m\/(\d+)\/1\/(\d+)\/2\/(\d+)$/,
        pathParts: {
            1: 'clientIndex',
            2: 'deviceIndex',
            3: 'addrIndex'
        }
    }),
    dev_pub_rsrv_addr: Object.freeze({
        name: 'dev_pub_rsrv_addr',
        description: 'device public reserved address',
        pathRegEx: /^m\/(\d+)\/1\/(\d+)\/(\d+)\/(\d+)$/,
        pathParts: {
            1: 'clientIndex',
            2: 'deviceIndex',
            3: 'addrRootIndex',
            4: 'addrIndex'
        }
    })
});


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

function isValidCatenisNodeIndex(index) {
    return typeof index === 'number' && Number.isInteger(index) && index >= 0;
}

function isValidClientIndex(index) {
    return typeof index === 'number' && Number.isInteger(index) && index > 0;
}

function isValidDeviceIndex(index) {
    return typeof index === 'number' && Number.isInteger(index) && index > 0;
}

function isValidAddressRootIndex(index) {
    return typeof index === 'number' && Number.isInteger(index) && index >= 0 && index < numDeviceAddrRoots;
}

function isValidAddressIndex(index) {
    return typeof index === 'number' && Number.isInteger(index) && index >= 0;
}

function isValidServiceCreditIndex(index) {
    return typeof index === 'number' && Number.isInteger(index) && index >= 0 && index < numServiceCreditAddrRoots;
}


// Module code
//

// Definition of properties
Object.defineProperty(KeyStore, 'purgeUnusedExtKeyInternalHandle', {
    get: function () {
        return purgeUnusedExtKeyInternalHandle;
    },
    enumerable: true
});

// Save module function class reference
if (typeof Catenis === 'undefined')
    Catenis = {};

if (typeof Catenis.module === 'undefined')
    Catenis.module = {};

Catenis.module.KeyStore = Object.freeze(KeyStore);
