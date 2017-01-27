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
//      m/k -> Catenis node root HD extended key
//                      where: k = 0 -> Catenis Hub node
//                             k >= 1 -> Catenis Gateway #k node
//
//      m/k/0 -> System root HD extended key
//
//      m/k/0/0 -> System device root HD extended key
//
//      m/k/0/1 -> System funding root HD extended key
//
//      m/k/0/2 -> System pay tx expense root HD extended key
//
//      m/k/0/0/0 -> System device main addresses root HD extended key
//      m/k/0/0/1 -> System device (reserved) addresses #2 root HD extended key
//      m/k/0/0/2 -> System device (reserved) addresses #3 root HD extended key
//      m/k/0/0/3 -> System device (reserved) addresses #4 root HD extended key
//      m/k/0/0/4 -> System device (reserved) addresses #5 root HD extended key
//      m/k/0/0/5 -> System device (reserved) addresses #6 root HD extended key
//      m/k/0/0/6 -> System device (reserved) addresses #7 root HD extended key
//      m/k/0/0/7 -> System device (reserved) addresses #8 root HD extended key
//      m/k/0/0/8 -> System device (reserved) addresses #9 root HD extended key
//      m/k/0/0/9 -> System device (reserved) addresses #10 root HD extended key
//
//      m/k/0/0/0/* -> System device main addresses HD extended key
//
//      m/k/0/1/0 -> System funding payment root HD extended key
//
//      m/k/0/1/1 -> System funding change root HD extended key
//
//      m/k/0/1/0/* -> System funding payment addresses HD extended keys (used to add funds to Catenis node)
//
//      m/k/0/1/1/* -> System funding change addresses HD extended keys (used to hold change from funds)
//
//      m/k/0/2/* -> System pay tx expense addresses HD extended keys (used to pay for transaction fees)
//
//      m/k/i (i>=1) -> client #i root HD extended key
//
//      m/k/i/0 (i>=1) -> client #i internal hierarchy root HD extended key
//
//      m/k/i/1 (i>=1) -> client #i public hierarchy root HD extended key
//
//      m/k/i/0/0 (i>=1) -> client #i internal root HD extended key
//
//      m/k/i/0/0/0 (i>=1) -> client #i service credit root HD extended key
//
//      m/k/i/0/0/0/0 (i>=1) -> client #i message credit addresses root HD extended key
//      m/k/i/0/0/0/1 (i>=1) -> client #i asset credit addresses root HD extended key
//      m/k/i/0/0/0/2 (i>=1) -> client #i service credit (reserved) address #3 root HD extended key
//      m/k/i/0/0/0/3 (i>=1) -> client #i service credit (reserved) address #4 root HD extended key
//      m/k/i/0/0/0/4 (i>=1) -> client #i service credit (reserved) address #5 root HD extended key
//      m/k/i/0/0/0/5 (i>=1) -> client #i service credit (reserved) address #6 root HD extended key
//      m/k/i/0/0/0/6 (i>=1) -> client #i service credit (reserved) address #7 root HD extended key
//      m/k/i/0/0/0/7 (i>=1) -> client #i service credit (reserved) address #8 root HD extended key
//      m/k/i/0/0/0/8 (i>=1) -> client #i service credit (reserved) address #9 root HD extended key
//      m/k/i/0/0/0/9 (i>=1) -> client #i service credit (reserved) address #10 root HD extended key
//
//      m/k/i/0/0/0/0/* (i>=1) -> client #i message credit addresses HD extended key
//      m/k/i/0/0/0/1/* (i>=1) -> client #i asset credit addresses HD extended key
//
//      m/k/i/0/j (i,j>=1) -> device #j of client #i internal root HD extended key
//
//      m/k/i/0/j/0 (i,j>=1) -> device #j of client #i read confirmation addresses root HD extended key
//      m/k/i/0/j/1 (i,j>=1) -> device #j of client #i internal (reserved) addresses #2 root HD extended key
//      m/k/i/0/j/2 (i,j>=1) -> device #j of client #i internal (reserved) addresses #3 root HD extended key
//      m/k/i/0/j/3 (i,j>=1) -> device #j of client #i internal (reserved) addresses #4 root HD extended key
//      m/k/i/0/j/4 (i,j>=1) -> device #j of client #i internal (reserved) addresses #5 root HD extended key
//      m/k/i/0/j/5 (i,j>=1) -> device #j of client #i internal (reserved) addresses #6 root HD extended key
//      m/k/i/0/j/6 (i,j>=1) -> device #j of client #i internal (reserved) addresses #7 root HD extended key
//      m/k/i/0/j/7 (i,j>=1) -> device #j of client #i internal (reserved) addresses #8 root HD extended key
//      m/k/i/0/j/8 (i,j>=1) -> device #j of client #i internal (reserved) addresses #9 root HD extended key
//      m/k/i/0/j/9 (i,j>=1) -> device #j of client #i internal (reserved) addresses #10 root HD extended key
//
//      m/k/i/0/j/0/* (i,j>=1) -> device #j of client #i read confirmation addresses HD extended key
//
//      m/k/i/1/j (i,j>=1) -> device #j of client #i public root HD extended key
//
//      m/k/i/1/j/0 (i,j>=1) -> device #j of client #i main addresses root HD extended key
//      m/k/i/1/j/1 (i,j>=1) -> device #j of client #i asset addresses root HD extended key
//      m/k/i/1/j/2 (i,j>=1) -> device #j of client #i asset issuance addresses root HD extended key (used only to issue unlocked type of Colored Coins assets)
//      m/k/i/1/j/3 (i,j>=1) -> device #j of client #i public (reserved) addresses #4 root HD extended key
//      m/k/i/1/j/4 (i,j>=1) -> device #j of client #i public (reserved) addresses #5 root HD extended key
//      m/k/i/1/j/5 (i,j>=1) -> device #j of client #i public (reserved) addresses #6 root HD extended key
//      m/k/i/1/j/6 (i,j>=1) -> device #j of client #i public (reserved) addresses #7 root HD extended key
//      m/k/i/1/j/7 (i,j>=1) -> device #j of client #i public (reserved) addresses #8 root HD extended key
//      m/k/i/1/j/8 (i,j>=1) -> device #j of client #i public (reserved) addresses #9 root HD extended key
//      m/k/i/1/j/9 (i,j>=1) -> device #j of client #i public (reserved) addresses #10 root HD extended key
//
//      m/k/i/1/j/0/* (i,j>=1) -> device #j of client #i main addresses HD extended key
//      m/k/i/1/j/1/* (i,j>=1) -> device #j of client #i asset addresses HD extended key
//      m/k/i/1/j/2/* (i,j>=1) -> device #j of client #i asset issuance addresses HD extended key
//
//  Please refer to BIP-32 (https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki) for more information.
//
//  IMPORTANT: there is a possibility (even though very remote) that an HD extended key cannot be derived for
//      a given index. In that case, the algorithm uses the next index instead.

// Module variables
//

// References to external code
//
// Internal node modules
//  NOTE: the reference of these modules are done sing 'require()' instead of 'import' to
//      to avoid annoying WebStorm warning message: 'default export is not defined in
//      imported module'
const util = require('util');
// Third-party node modules
import config from 'config';
import Loki from 'lokijs';
import bitcoinLib from 'bitcoinjs-lib';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';

// Config entries
const configKeyStore = config.get('keyStore');

// Configuration settings
const cfgSettings = {
    obsoleteExtKeyTimeToPurge: configKeyStore.get('obsoleteExtKeyTimeToPurge'),
    purgeUnusedExtKeyInterval: configKeyStore.get('purgeUnusedExtKeyInterval')
};

const numServiceCreditAddrRoots = 10,
    numDeviceAddrRoots = 10,
    numUsedSysDeviceAddrRoots = 1,
    numUsedServiceCreditAddrRoots = 2,
    numUsedDeviceIntAddrRoots = 1,
    numUsedDevicePubAddrRoots = 3;

let purgeUnusedExtKeyInternalHandle;

// Definition of function classes
//

// KeyStore function class
//
// Internal storage (Loki DB collection) structure: {
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
    this.db = new Loki();
    this.collExtKey = this.db.addCollection('ExtendedKey', {indices: ['type', 'path', 'parentPath', 'index', 'address']});

    this.collExtKey.ensureUniqueIndex('path');
    this.collExtKey.ensureUniqueIndex('address');

    // Create master HD extended key and store it
    this.masterHDNode = bitcoinLib.HDNode.fromSeedBuffer(seed, cryptoNetwork);
    storeHDNode.call(this, 'mstr', 'm', this.masterHDNode);

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
    const docExtKey = this.collExtKey.by('path', path);

    return docExtKey != undefined ? new Catenis.module.CryptoKeys(bitcoinLib.HDNode.fromBase58(docExtKey.strHDNode, this.cryptoNetwork).keyPair) : null;
};

KeyStore.prototype.getCryptoKeysByAddress = function (addr) {
    const docExtKey = this.collExtKey.by('address', addr);

    return docExtKey != undefined ? new Catenis.module.CryptoKeys(bitcoinLib.HDNode.fromBase58(docExtKey.strHDNode, this.cryptoNetwork).keyPair) : null;
};

KeyStore.prototype.getTypeAndPathByAddress = function (addr) {
    const docExtKey = this.collExtKey.by('address', addr);

    return docExtKey != undefined ? {type: docExtKey.type, path: docExtKey.path} : null;
};

KeyStore.prototype.getAddressInfo = function (addr, retrieveObsolete = false) {
    let addrInfo = null,
        tryAgain;

    do {
        tryAgain = false;

        const docExtKey = this.collExtKey.by('address', addr);

        if (docExtKey != undefined) {
            if (retrieveObsolete && docExtKey.isObsolete) {
                // Check if address marked as obsolete is in use and reset its status if so
                if (Catenis.module.BlockchainAddress.BlockchainAddress.checkObsoleteAddress(addr)) {
                    // Address status has been reset (address is not obsolete anymore)
                    docExtKey.isObsolete = false;
                }
            }

            addrInfo = {
                cryptoKeys: new Catenis.module.CryptoKeys(bitcoinLib.HDNode.fromBase58(docExtKey.strHDNode, this.cryptoNetwork).keyPair),
                type: docExtKey.type,
                path: docExtKey.path,
                isObsolete: docExtKey.isObsolete
            };

            const pathParts = KeyStore.getPathParts(docExtKey);

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
    return addrList.reduce((result, addr) => {
        const hdNodeInfo = this.getAddressInfo(addr, retrieveObsolete);

        if (hdNodeInfo != null) {
            result[addr] = hdNodeInfo;
        }

        return result;
    }, {});
};

KeyStore.prototype.setAddressAsObsolete = function (addr) {
    const docExtKey = this.collExtKey.by('address', addr);

    if (docExtKey != undefined && (docExtKey.type === 'sys_fund_pay_addr' || docExtKey.type === 'sys_fund_chg_addr' || docExtKey.type == 'sys_pay_tx_exp_addr'
        || docExtKey.type === 'sys_dev_main_addr' || docExtKey.type === 'cln_msg_crd_addr' || docExtKey.type === 'cln_asst_crd_addr'
        || docExtKey.type === 'dev_read_conf_addr' || docExtKey.type === 'dev_main_addr' || docExtKey.type === 'dev_asst_addr' || docExtKey.type === 'dev_asst_issu_addr')
        && !docExtKey.isObsolete) {
        docExtKey.isObsolete = true;
        this.collExtKey.update(docExtKey);
    }
};

KeyStore.prototype.resetObsoleteAddress = function (addr) {
    const docExtKey = this.collExtKey.by('address', addr);

    if (docExtKey != undefined && docExtKey.isObsolete) {
        docExtKey.isObsolete = false;
        this.collExtKey.update(docExtKey);
    }
};

KeyStore.prototype.setAddressListAsObsolete = function (addrList) {
    this.collExtKey.chain().find({$and: [{address: {$in: addrList}}, {type: {$in: ['sys_fund_pay_addr', 'sys_fund_chg_addr', 'sys_pay_tx_exp_addr', 'sys_dev_main_addr', 'cln_msg_crd_addr', 'cln_asst_crd_addr', 'dev_read_conf_addr', 'dev_main_addr', 'dev_asst_addr', 'dev_asst_issu_addr']}}, {isObsolete: false}]})
        .update((docExtKey) => {
            docExtKey.isObsolete = true;
        });
};

KeyStore.prototype.isObsoleteAddress = function (addr) {
    const docExtKey = this.collExtKey.by('address', addr);

    return docExtKey != undefined && docExtKey.isObsolete;
};

KeyStore.prototype.listAddressesInUse = function () {
    return this.collExtKey.find({$and: [{isLeaf: true}, {isReserved: false}, {isObsolete: false}]}).map((docExtKey) => {
        return docExtKey.address;
    });
};

KeyStore.prototype.initCatenisNodeHDNodes = function (ctnNodeIndex) {
    // Validate Catenis node index
    if (!isValidCatenisNodeIndex(ctnNodeIndex)) {
        Catenis.logger.ERROR('KeyStore.initCatenisNodeHDNodes method called with invalid argument', {ctnNodeIndex: ctnNodeIndex});
        throw Error('Invalid ctnNodeIndex argument');
    }

    let success = false;
    const hdNodesToStore = [];

    // Try to retrieve root HD extended key for Catenis node with given index
    const ctnNodeRootPath = util.format('m/%d', ctnNodeIndex);
    let ctnNodeRootHDNode = retrieveHDNode.call(this, ctnNodeRootPath);

    if (ctnNodeRootHDNode == null) {
        // Catenis node root HD extended key does not exist yet. Create it
        ctnNodeRootHDNode = this.masterHDNode.derive(ctnNodeIndex);

        if (ctnNodeRootHDNode.index !== ctnNodeIndex) {
            Catenis.logger.WARN(util.format('Catenis node root HD extended key (%s) derived with an unexpected index', ctnNodeRootPath), {expectedIndex: ctnNodeIndex, returnedIndex: ctnNodeRootHDNode.index});
        }
        else {
            // Save newly created HD extended key to store it later
            hdNodesToStore.push({type: 'ctnd_root', path: ctnNodeRootPath, hdNode: ctnNodeRootHDNode, isLeaf: false, isReserved: false});

            // Create system root HD extended key
            const sysRootPath = ctnNodeRootPath + '/0',
                sysRootHDNode = ctnNodeRootHDNode.derive(0);

            if (sysRootHDNode.index !== 0) {
                Catenis.logger.WARN(util.format('System root HD extended key (%s) derived with an unexpected index', sysRootPath), {expectedIndex: 0, returnedIndex: sysRootHDNode.index});
            }
            else {
                // Save newly created HD extended key to store it later
                hdNodesToStore.push({type: 'sys_root', path: sysRootPath, hdNode: sysRootHDNode, isLeaf: false, isReserved: false});

                // Create system device root HD extended key
                let path = sysRootPath + '/0',
                    sysDeviceRootHDNode = sysRootHDNode.derive(0);

                if (sysDeviceRootHDNode.index !== 0) {
                    Catenis.logger.WARN(util.format('System device root HD extended key (%s) derived with an unexpected index', path), {expectedIndex: 0, returnedIndex: sysDeviceRootHDNode.index});
                }
                else {
                    // Save newly created HD extended key to store it later
                    hdNodesToStore.push({type: 'sys_dev_root', path: path, hdNode: sysDeviceRootHDNode, isLeaf: false, isReserved: false});

                    // Create system funding root HD extended key
                    path = sysRootPath + '/1';
                    const sysFundingRootHDNode = sysRootHDNode.derive(1);

                    if (sysFundingRootHDNode.index !== 1) {
                        Catenis.logger.WARN(util.format('System funding root HD extended key (%s) derived with an unexpected index', path), {expectedIndex: 1, returnedIndex: sysFundingRootHDNode.index});
                    }
                    else {
                        // Save newly created HD extended key to store it later
                        hdNodesToStore.push({type: 'sys_fund_root', path: path, hdNode: sysFundingRootHDNode, isLeaf: false, isReserved: false});

                        // Create system pay tx expense root HD extended key
                        path = sysRootPath + '/2';
                        const sysPayTxExpenseRootHDNode = sysRootHDNode.derive(2);

                        if (sysPayTxExpenseRootHDNode.index !== 2) {
                            Catenis.logger.WARN(util.format('System pay tx expense root HD extended key (%s) derived with an unexpected index', path), {expectedIndex: 2, returnedIndex: sysPayTxExpenseRootHDNode.index});
                        }
                        else {
                            // Save newly created HD extended key to store it later
                            hdNodesToStore.push({type: 'sys_pay_tx_exp_root', path: path, hdNode: sysPayTxExpenseRootHDNode, isLeaf: false, isReserved: false});

                            // Create all predefined and reserved system device addresses root HD extended keys
                            for (let idx = 0; idx < numDeviceAddrRoots; idx++) {
                                path = util.format('%s/0/%d', sysRootPath, idx);
                                const sysDeviceAddrRootHDNode = sysDeviceRootHDNode.derive(idx);

                                if (sysDeviceAddrRootHDNode.index !== idx) {
                                    Catenis.logger.WARN(util.format('System device addresses #%d root HD extended key (%s) derived with an unexpected index', idx + 1, path), {expectedIndex: idx, returnedIndex: sysDeviceAddrRootHDNode.index});
                                    sysDeviceRootHDNode = null;
                                    break;
                                }
                                else {
                                    // Save newly created HD extended key to store it later
                                    hdNodesToStore.push({type: idx == 0 ? 'sys_dev_main_addr_root' : 'sys_dev_rsrv_addr_root', path: path, hdNode: sysDeviceAddrRootHDNode, isLeaf: false, isReserved: idx >= numUsedSysDeviceAddrRoots});
                                }
                            }

                            if (sysDeviceRootHDNode != null) {
                                // Create system funding payment root HD extended key
                                path = sysRootPath + '/1/0';
                                const sysFundingPaymentRootHDNode = sysFundingRootHDNode.derive(0);

                                if (sysFundingPaymentRootHDNode.index !== 0) {
                                    Catenis.logger.WARN(util.format('System funding payment root HD extended key (%s) derived with an unexpected index', path), {expectedIndex: 0, returnedIndex: sysFundingPaymentRootHDNode.index});
                                }
                                else {
                                    // Save newly created HD extended key to store it later
                                    hdNodesToStore.push({type: 'sys_fund_pay_root', path: path, hdNode: sysFundingPaymentRootHDNode, isLeaf: false, isReserved: false});

                                    // Create system funding change root HD extended key
                                    path = sysRootPath + '/1/1';
                                    const sysFundingChangeRootHDNode = sysFundingRootHDNode.derive(1);

                                    if (sysFundingChangeRootHDNode.index !== 1) {
                                        Catenis.logger.WARN(util.format('System funding change root HD extended key (%s) derived with an unexpected index', path), {expectedIndex: 1, returnedIndex: sysFundingChangeRootHDNode.index});
                                    }
                                    else {
                                        // Save newly created HD extended key to store it later
                                        hdNodesToStore.push({type: 'sys_fund_chg_root', path: path, hdNode: sysFundingChangeRootHDNode, isLeaf: false, isReserved: false});

                                        // Store all newly created HD extended keys, and indicate success
                                        hdNodesToStore.forEach((hdNodeToStore) => {
                                            storeHDNode.call(this, hdNodeToStore.type, hdNodeToStore.path, hdNodeToStore.hdNode, hdNodeToStore.isLeaf, hdNodeToStore.isReserved);
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
    }
    else {
        // Catenis node HD nodes already initialized. Nothing to do,
        //  just indicate success
        success = true;
    }

    return success;
};

KeyStore.prototype.getSystemFundingPaymentAddressKeys = function (ctnNodeIndex, addrIndex, isObsolete = false) {
    // Validate arguments
    const errArg = {};

    if (!isValidCatenisNodeIndex(ctnNodeIndex)) {
        errArg.ctnNodeIndex = ctnNodeIndex;
    }

    if (!isValidAddressIndex(addrIndex)) {
        errArg.addrIndex = addrIndex;
    }

    if (Object.keys(errArg).length > 0) {
        const errArgs = Object.keys(errArg);

        Catenis.logger.ERROR(util.format('KeyStore.getSystemFundingPaymentAddressKeys method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    // Try to retrieve system funding payment address HD extended key for given Catenis node with the given index
    const sysFundingPaymentAddrPath = util.format('m/%d/0/1/0/%d', ctnNodeIndex, addrIndex);
    let sysFundingPaymentAddrHDNode = retrieveHDNode.call(this, sysFundingPaymentAddrPath),
        sysFundingPaymentAddrKeys = null;

    if (sysFundingPaymentAddrHDNode == null) {
        // System funding payment address HD extended key does not exist yet.
        //  Retrieve parent root HD extended key to create it
        const path = parentPath(sysFundingPaymentAddrPath);
        let sysFundingPaymentRootHDNode = retrieveHDNode.call(this, path);

        if (sysFundingPaymentRootHDNode == null) {
            // System funding payment root HD extended key does not exist yet.
            //  Try to initialize Catenis node HD extended keys
            if (! this.initCatenisNodeHDNodes(ctnNodeIndex)) {
                Catenis.logger.ERROR(util.format('HD extended keys for Catenis node with index %d could not be initialized', ctnNodeIndex));
            }
            else {
                // Catenis node HD extended keys successfully initialized.
                //  Try to retrieve system funding payment root HD extend key again
                sysFundingPaymentRootHDNode = retrieveHDNode.call(this, path);
            }
        }

        if (sysFundingPaymentRootHDNode == null) {
            Catenis.logger.ERROR(util.format('System funding payment root HD extended key (%s) for Catenis node with index %d not found', path, ctnNodeIndex));
        }
        else {
            // Try to create system funding payment address HD extended key now
            sysFundingPaymentAddrHDNode = sysFundingPaymentRootHDNode.derive(addrIndex);

            if (sysFundingPaymentAddrHDNode.index !== addrIndex) {
                Catenis.logger.WARN(util.format('System funding payment address HD extended key (%s) derived with an unexpected index', sysFundingPaymentAddrPath), {expectedIndex: addrIndex, returnedIndex: sysFundingPaymentAddrHDNode.index});
                sysFundingPaymentAddrHDNode = null;
            }
            else {
                // Store created HD extended key
                storeHDNode.call(this, 'sys_fund_pay_addr', sysFundingPaymentAddrPath, sysFundingPaymentAddrHDNode, true, false, isObsolete);
            }
        }
    }

    if (sysFundingPaymentAddrHDNode != null) {
        sysFundingPaymentAddrKeys = new Catenis.module.CryptoKeys(sysFundingPaymentAddrHDNode.keyPair);
    }

    return sysFundingPaymentAddrKeys;
};

KeyStore.prototype.listSystemFundingPaymentAddresses = function (ctnNodeIndex, fromAddrIndex, toAddrIndex, onlyInUse) {
    // Validate arguments
    const errArg = {},
        queryTerms = [{parentPath: util.format('m/%d/0/1/0', ctnNodeIndex)}];

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
        const errArgs = Object.keys(errArg);

        Catenis.logger.ERROR(util.format('KeyStore.listSystemFundingPaymentAddresses method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    if (onlyInUse) {
        queryTerms.push({isObsolete: false});
    }

    // Return existing system funding payment addresses within the specified range
    let query;

    if (queryTerms.length > 1) {
        query = {$and: queryTerms};
    }
    else {
        query = queryTerms[0];
    }

    return this.collExtKey.chain().find(query).simplesort('index').data().map((docExtKey) => {
        return docExtKey.address;
    });
};

KeyStore.prototype.listSystemFundingPaymentAddressesInUse = function (ctnNodeIndex, fromAddrIndex, toAddrIndex) {
    return this.listSystemFundingPaymentAddresses(ctnNodeIndex, fromAddrIndex, toAddrIndex, true);
};

KeyStore.prototype.getSystemFundingChangeAddressKeys = function (ctnNodeIndex, addrIndex, isObsolete = false) {
    // Validate arguments
    const errArg = {};

    if (!isValidCatenisNodeIndex(ctnNodeIndex)) {
        errArg.ctnNodeIndex = ctnNodeIndex;
    }

    if (!isValidAddressIndex(addrIndex)) {
        errArg.addrIndex = addrIndex;
    }

    if (Object.keys(errArg).length > 0) {
        const errArgs = Object.keys(errArg);

        Catenis.logger.ERROR(util.format('KeyStore.getSystemFundingChangeAddressKeys method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    // Try to retrieve system funding change address HD extended key for given Catenis node with the given index
    const sysFundingChangeAddrPath = util.format('m/%d/0/1/1/%d', ctnNodeIndex, addrIndex);
    let sysFundingChangeAddrHDNode = retrieveHDNode.call(this, sysFundingChangeAddrPath),
        sysFundingChangeAddrKeys = null;

    if (sysFundingChangeAddrHDNode == null) {
        // System funding change address HD extended key does not exist yet.
        //  Retrieve parent root HD extended key to create it
        const path = parentPath(sysFundingChangeAddrPath);
        let sysFundingChangeRootHDNode = retrieveHDNode.call(this, path);

        if (sysFundingChangeRootHDNode == null) {
            // System funding change root HD extended key does not exist yet.
            //  Try to initialize Catenis node HD extended keys
            if (! this.initCatenisNodeHDNodes(ctnNodeIndex)) {
                Catenis.logger.ERROR(util.format('HD extended keys for Catenis node with index %d could not be initialized', ctnNodeIndex));
            }
            else {
                // Catenis node HD extended keys successfully initialized.
                //  Try to retrieve system funding change root HD extend key again
                sysFundingChangeRootHDNode = retrieveHDNode.call(this, path);
            }
        }

        if (sysFundingChangeRootHDNode == null) {
            Catenis.logger.ERROR(util.format('System funding change root HD extended key (%s) for Catenis node with index %d not found', path, ctnNodeIndex));
        }
        else {
            // Try to create system funding change address HD extended key now
            sysFundingChangeAddrHDNode = sysFundingChangeRootHDNode.derive(addrIndex);

            if (sysFundingChangeAddrHDNode.index !== addrIndex) {
                Catenis.logger.WARN(util.format('System funding change address HD extended key (%s) derived with an unexpected index', sysFundingChangeAddrPath), {expectedIndex: addrIndex, returnedIndex: sysFundingChangeAddrHDNode.index});
                sysFundingChangeAddrHDNode = null;
            }
            else {
                // Store created HD extended key
                storeHDNode.call(this, 'sys_fund_chg_addr', sysFundingChangeAddrPath, sysFundingChangeAddrHDNode, true, false, isObsolete);
            }
        }
    }

    if (sysFundingChangeAddrHDNode != null) {
        sysFundingChangeAddrKeys = new Catenis.module.CryptoKeys(sysFundingChangeAddrHDNode.keyPair);
    }

    return sysFundingChangeAddrKeys;
};

KeyStore.prototype.listSystemFundingChangeAddresses = function (ctnNodeIndex, fromAddrIndex, toAddrIndex, onlyInUse) {
    // Validate arguments
    const errArg = {},
        queryTerms = [{parentPath: util.format('m/%d/0/1/1', ctnNodeIndex)}];

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
        const errArgs = Object.keys(errArg);

        Catenis.logger.ERROR(util.format('KeyStore.listSystemFundingChangeAddresses method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    if (onlyInUse) {
        queryTerms.push({isObsolete: false});
    }

    // Return existing system funding change addresses within the specified range
    let query;

    if (queryTerms.length > 1) {
        query = {$and: queryTerms};
    }
    else {
        query = queryTerms[0];
    }

    return this.collExtKey.chain().find(query).simplesort('index').data().map((docExtKey) => {
        return docExtKey.address;
    });
};

KeyStore.prototype.listSystemFundingChangeAddressesInUse = function (ctnNodeIndex, fromAddrIndex, toAddrIndex) {
    return this.listSystemFundingChangeAddresses(ctnNodeIndex, fromAddrIndex, toAddrIndex, true);
};

KeyStore.prototype.getSystemPayTxExpenseAddressKeys = function (ctnNodeIndex, addrIndex, isObsolete = false) {
    // Validate arguments
    const errArg = {};

    if (!isValidCatenisNodeIndex(ctnNodeIndex)) {
        errArg.ctnNodeIndex = ctnNodeIndex;
    }

    if (!isValidAddressIndex(addrIndex)) {
        errArg.addrIndex = addrIndex;
    }

    if (Object.keys(errArg).length > 0) {
        const errArgs = Object.keys(errArg);

        Catenis.logger.ERROR(util.format('KeyStore.getSystemPayTxExpenseAddressKeys method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    // Try to retrieve system pay tx expense address HD extended key for given Catenis node with the given index
    const sysPayTxExpenseAddrPath = util.format('m/%d/0/2/%d', ctnNodeIndex, addrIndex);
    let sysPayTxExpenseAddrHDNode = retrieveHDNode.call(this, sysPayTxExpenseAddrPath),
        sysPayTxExpenseAddrKeys = null;

    if (sysPayTxExpenseAddrHDNode == null) {
        // System pay tx expense address HD extended key does not exist yet.
        //  Retrieve parent root HD extended key to create it
        const path = parentPath(sysPayTxExpenseAddrPath);
        let sysPayTxExpenseRootHDNode = retrieveHDNode.call(this, path);

        if (sysPayTxExpenseRootHDNode == null) {
            // System pay tx expense root HD extended key does not exist yet.
            //  Try to initialize Catenis node HD extended keys
            if (! this.initCatenisNodeHDNodes(ctnNodeIndex)) {
                Catenis.logger.ERROR(util.format('HD extended keys for Catenis node with index %d could not be initialized', ctnNodeIndex));
            }
            else {
                // Catenis node HD extended keys successfully initialized.
                //  Try to retrieve system pay tx expense root HD extend key again
                sysPayTxExpenseRootHDNode = retrieveHDNode.call(this, path);
            }
        }

        if (sysPayTxExpenseRootHDNode == null) {
            Catenis.logger.ERROR(util.format('System pay tx expense root HD extended key (%s) for Catenis node with index %d not found', path, ctnNodeIndex));
        }
        else {
            // Try to create system pay tx expense address HD extended key now
            sysPayTxExpenseAddrHDNode = sysPayTxExpenseRootHDNode.derive(addrIndex);

            if (sysPayTxExpenseAddrHDNode.index !== addrIndex) {
                Catenis.logger.WARN(util.format('System pay tx expense address HD extended key (%s) derived with an unexpected index', sysPayTxExpenseAddrPath), {expectedIndex: addrIndex, returnedIndex: sysPayTxExpenseAddrHDNode.index});
                sysPayTxExpenseAddrHDNode = null;
            }
            else {
                // Store created HD extended key
                storeHDNode.call(this, 'sys_pay_tx_exp_addr', sysPayTxExpenseAddrPath, sysPayTxExpenseAddrHDNode, true, false, isObsolete);
            }
        }
    }

    if (sysPayTxExpenseAddrHDNode != null) {
        sysPayTxExpenseAddrKeys = new Catenis.module.CryptoKeys(sysPayTxExpenseAddrHDNode.keyPair);
    }

    return sysPayTxExpenseAddrKeys;
};

KeyStore.prototype.listSystemPayTxExpenseAddresses = function (ctnNodeIndex, fromAddrIndex, toAddrIndex, onlyInUse) {
    // Validate arguments
    const errArg = {},
        queryTerms = [{parentPath: util.format('m/%d/0/2', ctnNodeIndex)}];

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
        const errArgs = Object.keys(errArg);

        Catenis.logger.ERROR(util.format('KeyStore.listSystemPayTxExpenseAddresses method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    if (onlyInUse) {
        queryTerms.push({isObsolete: false});
    }

    // Return existing system pay tx expense addresses within the specified range
    let query;

    if (queryTerms.length > 1) {
        query = {$and: queryTerms};
    }
    else {
        query = queryTerms[0];
    }

    return this.collExtKey.chain().find(query).simplesort('index').data().map((docExtKey) => {
        return docExtKey.address;
    });
};

KeyStore.prototype.listSystemPayTxExpenseAddressesInUse = function (ctnNodeIndex, fromAddrIndex, toAddrIndex) {
    return this.listSystemPayTxExpenseAddresses(ctnNodeIndex, fromAddrIndex, toAddrIndex);
};

KeyStore.prototype.getSystemDeviceAddressKeys = function (ctnNodeIndex, addrRootIndex, addrIndex, isObsolete = false) {
    // Validate arguments
    const errArg = {};

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
        const errArgs = Object.keys(errArg);

        Catenis.logger.ERROR(util.format('KeyStore.getSystemDeviceAddressKeys method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    // Try to retrieve system device address HD extended key for given Catenis node, address Root, and with the given index
    const sysDeviceAddrPath = util.format('m/%d/0/0/%d/%d', ctnNodeIndex, addrRootIndex, addrIndex);
    let sysDeviceAddrHDNode = retrieveHDNode.call(this, sysDeviceAddrPath),
        sysDeviceAddrKeys = null;

    if (sysDeviceAddrHDNode == null) {
        // System device address HD extended key does not exist yet.
        //  Retrieve parent root HD extended key to create it
        const path = parentPath(sysDeviceAddrPath);
        let sysDeviceAddrRootHDNode = retrieveHDNode.call(this, path);

        if (sysDeviceAddrRootHDNode == null) {
            // System device addresses root HD extended key does not exist yet.
            //  Try to initialize Catenis node HD extended keys
            if (! this.initCatenisNodeHDNodes(ctnNodeIndex)) {
                Catenis.logger.ERROR(util.format('HD extended keys for Catenis node with index %d could not be initialized', ctnNodeIndex));
            }
            else {
                // Catenis node HD extended keys successfully initialized.
                //  Try to retrieve system device addresses root HD extend key again
                sysDeviceAddrRootHDNode = retrieveHDNode.call(this, path);
            }
        }

        if (sysDeviceAddrRootHDNode == null) {
            Catenis.logger.ERROR(util.format('System device address #%d root HD extended key (%s) for Catenis node with index %d not found', addrRootIndex + 1, path, ctnNodeIndex));
        }
        else {
            // Try to create system device address HD extended key now
            sysDeviceAddrHDNode = sysDeviceAddrRootHDNode.derive(addrIndex);

            if (sysDeviceAddrHDNode.index !== addrIndex) {
                Catenis.logger.WARN(util.format('System device address #%d HD extended key (%s) derived with an unexpected index', addrRootIndex + 1, sysDeviceAddrPath), {expectedIndex: addrIndex, returnedIndex: sysDeviceAddrHDNode.index});
                sysDeviceAddrHDNode = null;
            }
            else {
                // Store created HD extended key
                storeHDNode.call(this, addrRootIndex == 0 ? 'sys_dev_main_addr' : 'sys_dev_rsrv_addr', sysDeviceAddrPath, sysDeviceAddrHDNode, true, addrRootIndex >= numUsedSysDeviceAddrRoots, isObsolete);
            }
        }
    }

    if (sysDeviceAddrHDNode != null) {
        sysDeviceAddrKeys = new Catenis.module.CryptoKeys(sysDeviceAddrHDNode.keyPair);
    }

    return sysDeviceAddrKeys;
};

KeyStore.prototype.listSystemDeviceAddresses = function (ctnNodeIndex, addrRootIndex, fromAddrIndex, toAddrIndex, onlyInUse) {
    // Validate arguments
    const errArg = {},
        queryTerms = [{parentPath: util.format('m/%d/0/0/%d', ctnNodeIndex, addrRootIndex)}];

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
        const errArgs = Object.keys(errArg);

        Catenis.logger.ERROR(util.format('KeyStore.listSystemDeviceAddresses method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    if (onlyInUse) {
        queryTerms.push({isObsolete: false});
    }

    // Return existing system device addresses within the specified range
    let query;

    if (queryTerms.length > 1) {
        query = {$and: queryTerms};
    }
    else {
        query = queryTerms[0];
    }

    return this.collExtKey.chain().find(query).simplesort('index').data().map((docExtKey) => {
        return docExtKey.address;
    });
};

KeyStore.prototype.listSystemDeviceAddressesInUse = function (ctnNodeIndex, addrRootIndex, fromAddrIndex, toAddrIndex) {
    return this.listSystemDeviceAddresses(ctnNodeIndex, addrRootIndex, fromAddrIndex, toAddrIndex, true);
};

KeyStore.prototype.getSystemDeviceMainAddressKeys = function (ctnNodeIndex, addrIndex, isObsolete = false) {
    return this.getSystemDeviceAddressKeys(ctnNodeIndex, 0, addrIndex, isObsolete);
};

KeyStore.prototype.listSystemDeviceMainAddresses = function (ctnNodeIndex, fromAddrIndex, toAddrIndex, onlyInUse) {
    return this.listSystemDeviceAddresses(ctnNodeIndex, 0, fromAddrIndex, toAddrIndex, onlyInUse);
};

KeyStore.prototype.listSystemDeviceMainAddressesInUse = function (ctnNodeIndex, fromAddrIndex, toAddrIndex) {
    return this.listSystemDeviceAddresses(ctnNodeIndex, 0, fromAddrIndex, toAddrIndex, true);
};

KeyStore.prototype.initClientHDNodes = function (ctnNodeIndex, clientIndex) {
    // Validate arguments
    const errArg = {};

    if (!isValidCatenisNodeIndex(ctnNodeIndex)) {
        errArg.ctnNodeIndex = ctnNodeIndex;
    }

    if (!isValidClientIndex(clientIndex)) {
        errArg.clientIndex = clientIndex;
    }

    if (Object.keys(errArg).length > 0) {
        const errArgs = Object.keys(errArg);

        Catenis.logger.ERROR(util.format('KeyStore.initClientHDNodes method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    let success = false;
    const hdNodesToStore = [];

    // Try to retrieve root HD extended key for client of given Catenis node with the given index
    const clientRootPath = util.format('m/%d/%d', ctnNodeIndex, clientIndex);
    let clientRootHDNode = retrieveHDNode.call(this, clientRootPath);

    if (clientRootHDNode == null) {
        // Client root HD extended key does not exist yet.
        //  Retrieve parent root HD extended key to create it
        let path = parentPath(clientRootPath),
            ctnNodeRootHDNode = retrieveHDNode.call(this, path);

        if (ctnNodeRootHDNode == null) {
            // Catenis node root HD extended key does not exist yet.
            //  Try to initialize Catenis node HD extended keys
            if (! this.initCatenisNodeHDNodes(ctnNodeIndex)) {
                Catenis.logger.ERROR(util.format('HD extended keys for Catenis node with index %d could not be initialized', ctnNodeIndex));
            }
            else {
                // Catenis node HD extended keys successfully initialized.
                //  Try to retrieve Catenis node root HD extend key again
                ctnNodeRootHDNode = retrieveHDNode.call(this, path);
            }
        }

        if (ctnNodeRootHDNode == null) {
            Catenis.logger.ERROR(util.format('Catenis node root HD extended key (%s) not found', path));
        }
        else {
            // Try to create client root HD extended key now
            clientRootHDNode = ctnNodeRootHDNode.derive(clientIndex);

            if (clientRootHDNode.index !== clientIndex) {
                Catenis.logger.WARN(util.format('Client root HD extended key (%s) derived with an unexpected index', clientRootPath), {expectedIndex: clientIndex, returnedIndex: clientRootHDNode.index});
            }
            else {
                // Save newly created HD extended key to store it later
                hdNodesToStore.push({type: 'cln_root', path: clientRootPath, hdNode: clientRootHDNode, isLeaf: false, isReserved: false});

                // Create client internal hierarchy root HD extended key
                path = clientRootPath + '/0';
                const clientIntHierarchyRootHDNode = clientRootHDNode.derive(0);

                if (clientIntHierarchyRootHDNode.index !== 0) {
                    Catenis.logger.WARN(util.format('Client internal hierarchy root HD extended key (%s) derived with an unexpected index', path), {expectedIndex: 0, returnedIndex: clientIntHierarchyRootHDNode.index});
                }
                else {
                    // Save newly created HD extended key to store it later
                    hdNodesToStore.push({type: 'cln_int_addr_hrch_root', path: path, hdNode: clientIntHierarchyRootHDNode, isLeaf: false, isReserved: false});

                    // Create client public hierarchy root HD extended key
                    path = clientRootPath + '/1';
                    const clientPubHierarchyRootHDNode = clientRootHDNode.derive(1);

                    if (clientPubHierarchyRootHDNode.index !== 1) {
                        Catenis.logger.WARN(util.format('Client public hierarchy root HD extended key (%s) derived with an unexpected index', path), {expectedIndex: 1, returnedIndex: clientPubHierarchyRootHDNode.index});
                    }
                    else {
                        // Save newly created HD extended key to store it later
                        hdNodesToStore.push({type: 'cln_pub_addr_hrch_root', path: path, hdNode: clientPubHierarchyRootHDNode, isLeaf: false, isReserved: false});

                        // Create client internal root HD extended key
                        path = clientRootPath + '/0/0';
                        const clientIntRootHDNode = clientIntHierarchyRootHDNode.derive(0);

                        if (clientIntRootHDNode.index !== 0) {
                            Catenis.logger.WARN(util.format('Client internal root HD extended key (%s) derived with an unexpected index', path), {expectedIndex: 0, returnedIndex: clientIntRootHDNode.index});
                        }
                        else {
                            // Save newly created HD extended key to store it later
                            hdNodesToStore.push({type: 'cln_int_root', path: path, hdNode: clientIntRootHDNode, isLeaf: false, isReserved: false});

                            // Create client service credit root HD extended key
                            const clientSrvCreditRootPath = clientRootPath + '/0/0/0';
                            let clientSrvCreditRootHDNode = clientIntRootHDNode.derive(0);

                            if (clientSrvCreditRootHDNode.index !== 0) {
                                Catenis.logger.WARN(util.format('Client service credit root HD extended key (%s) derived with an unexpected index', clientSrvCreditRootPath), {expectedIndex: 0, returnedIndex: clientSrvCreditRootHDNode.index});
                            }
                            else {
                                // Save newly created HD extended key to store it later
                                hdNodesToStore.push({type: 'cln_srv_crd_root', path: clientSrvCreditRootPath, hdNode: clientSrvCreditRootHDNode, isLeaf: false, isReserved: false});

                                // Create all predefined and reserved client service credit addresses root HD extended keys
                                for (let idx = 0; idx < numServiceCreditAddrRoots; idx++) {
                                    const clientSrvCreditAddrRootPath = util.format('%s/%d', clientSrvCreditRootPath, idx),
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
                                    hdNodesToStore.forEach((hdNodeToStore) => {
                                        storeHDNode.call(this, hdNodeToStore.type, hdNodeToStore.path, hdNodeToStore.hdNode, hdNodeToStore.isLeaf, hdNodeToStore.isReserved);
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
        // Client HD nodes already initialized. Nothing to do,
        //  just indicate success
        success = true;
    }

    return success;
};

KeyStore.prototype.getClientServiceCreditAddressKeys = function (ctnNodeIndex, clientIndex, servCreditIndex, addrIndex, isObsolete = false) {
    // Validate arguments
    const errArg = {};

    if (!isValidCatenisNodeIndex(ctnNodeIndex)) {
        errArg.ctnNodeIndex = ctnNodeIndex;
    }

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
        const errArgs = Object.keys(errArg);

        Catenis.logger.ERROR(util.format('KeyStore.getClientServiceCreditAddressKeys method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    // Try to retrieve address HD extended key for given Catenis node, client, and service credit, with given index
    const clientSrvCreditAddrPath = util.format('m/%d/%d/0/0/0/%d/%d', ctnNodeIndex, clientIndex, servCreditIndex, addrIndex);
    let clientSrvCreditAddrHDNode = retrieveHDNode.call(this, clientSrvCreditAddrPath),
        clientSrvCreditAddrKeys = null;

    if (clientSrvCreditAddrHDNode == null) {
        // Client service credit address HD extended key does not exist yet.
        //  Retrieve parent root HD extended key to create it
        const path = parentPath(clientSrvCreditAddrPath);
        let clientSrvCreditRootHDNode = retrieveHDNode.call(this, path);

        if (clientSrvCreditRootHDNode == null) {
            // Client service credit root HD extended key does not exist yet.
            //  Try to initialize client HD extended keys
            if (! this.initClientHDNodes(ctnNodeIndex, clientIndex)) {
                Catenis.logger.ERROR(util.format('HD extended keys for client with index %d of Catenis node with index %d could not be initialized', clientIndex, ctnNodeIndex));
            }
            else {
                // Client HD extended keys successfully initialized.
                //  Try to retrieve client service credit root HD extend key again
                clientSrvCreditRootHDNode = retrieveHDNode.call(this, path);
            }
        }

        if (clientSrvCreditRootHDNode == null) {
            Catenis.logger.ERROR(util.format('Service credit #%d root HD extended key (%s) for client with index %d of Catenis node with index %d not found', servCreditIndex + 1, path, clientIndex, ctnNodeIndex));
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

KeyStore.prototype.listClientServiceCreditAddresses = function (ctnNodeIndex, clientIndex, servCreditIndex, fromAddrIndex, toAddrIndex, onlyInUse) {
    // Validate arguments
    const errArg = {},
        queryTerms = [{parentPath: util.format('m/%d/%d/0/0/0/%d', ctnNodeIndex, clientIndex, servCreditIndex)}];

    if (!isValidCatenisNodeIndex(ctnNodeIndex)) {
        errArg.ctnNodeIndex = ctnNodeIndex;
    }

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
        const errArgs = Object.keys(errArg);

        Catenis.logger.ERROR(util.format('KeyStore.listClientServiceCreditAddresses method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    if (onlyInUse) {
        queryTerms.push({isObsolete: false});
    }

    // Return existing client credit service addresses within the specified range
    let query;

    if (queryTerms.length > 1) {
        query = {$and: queryTerms};
    }
    else {
        query = queryTerms[0];
    }

    return this.collExtKey.chain().find(query).simplesort('index').data().map((docExtKey) => {
        return docExtKey.address;
    });
};

KeyStore.prototype.listClientServiceCreditAddressesInUse = function (ctnNodeIndex, clientIndex, servCreditIndex, fromAddrIndex, toAddrIndex) {
    return this.listClientServiceCreditAddresses(ctnNodeIndex, clientIndex, servCreditIndex, fromAddrIndex, toAddrIndex, true);
};

KeyStore.prototype.getClientMessageCreditAddressKeys = function (ctnNodeIndex, clientIndex, addrIndex, isObsolete = false) {
    return this.getClientServiceCreditAddressKeys(ctnNodeIndex, clientIndex, 0, addrIndex, isObsolete);
};

KeyStore.prototype.listClientMessageCreditAddresses = function (ctnNodeIndex, clientIndex, fromAddrIndex, toAddrIndex, onlyInUse) {
    return this.listClientServiceCreditAddresses(ctnNodeIndex, clientIndex, 0, fromAddrIndex, toAddrIndex, onlyInUse);
};

KeyStore.prototype.listClientMessageCreditAddressesInUse = function (ctnNodeIndex, clientIndex, fromAddrIndex, toAddrIndex) {
    return this.listClientServiceCreditAddresses(ctnNodeIndex, clientIndex, 0, fromAddrIndex, toAddrIndex, true);
};

KeyStore.prototype.getClientAssetCreditAddressKeys = function (ctnNodeIndex, clientIndex, addrIndex, isObsolete = false) {
    return this.getClientServiceCreditAddressKeys(ctnNodeIndex, clientIndex, 1, addrIndex, isObsolete);
};

KeyStore.prototype.listClientAssetCreditAddresses = function (ctnNodeIndex, clientIndex, fromAddrIndex, toAddrIndex, onlyInUse) {
    return this.listClientServiceCreditAddresses(ctnNodeIndex, clientIndex, 1, fromAddrIndex, toAddrIndex, onlyInUse);
};

KeyStore.prototype.listClientAssetCreditAddressesInUse = function (ctnNodeIndex, clientIndex, fromAddrIndex, toAddrIndex) {
    return this.listClientServiceCreditAddresses(ctnNodeIndex, clientIndex, 1, fromAddrIndex, toAddrIndex, true);
};

KeyStore.prototype.initDeviceHDNodes = function (ctnNodeIndex, clientIndex, deviceIndex) {
    // Validate arguments
    const errArg = {};

    if (!isValidCatenisNodeIndex(ctnNodeIndex)) {
        errArg.ctnNodeIndex = ctnNodeIndex;
    }

    if (!isValidClientIndex(clientIndex)) {
        errArg.clientIndex = clientIndex;
    }

    if (!isValidDeviceIndex(deviceIndex)) {
        errArg.deviceIndex = deviceIndex;
    }

    if (Object.keys(errArg).length > 0) {
        const errArgs = Object.keys(errArg);

        Catenis.logger.ERROR(util.format('KeyStore.initDeviceHDNodes method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    let success = false;
    const hdNodesToStore = [];

    // Try to retrieve internal hierarchy root HD extended key for client of given Catenis node with the given index
    const clientIntHierarchyRootPath = util.format('m/%d/%d/0', ctnNodeIndex, clientIndex);
    let clientIntHierarchyRootHDNode = retrieveHDNode.call(this, clientIntHierarchyRootPath);

    if (clientIntHierarchyRootHDNode == null) {
        // Client internal hierarchy root HD extended key does not exist yet.
        //  Try to initialize client HD extended keys
        if (! this.initClientHDNodes(ctnNodeIndex, clientIndex)) {
            Catenis.logger.ERROR(util.format('HD extended keys for client with index %d of Catenis node with index %d could not be initialized', clientIndex, ctnNodeIndex));
        }
        else {
            // Client HD extended keys successfully initialized.
            //  Try to retrieve client internal hierarchy root HD extend key again
            clientIntHierarchyRootHDNode = retrieveHDNode.call(this, clientIntHierarchyRootPath);
        }
    }

    if (clientIntHierarchyRootHDNode == null) {
        Catenis.logger.ERROR(util.format('Internal hierarchy root HD extended key (%s) for client with index %d of Catenis node with index %d not found', clientIntHierarchyRootPath, clientIndex, ctnNodeIndex));
    }
    else {
        // Try to retrieve public hierarchy root HD extended key for client of given Catenis node with given index
        const clientPubHierarchyRootPath = util.format('m/%d/%d/1', ctnNodeIndex, clientIndex),
            clientPubHierarchyRootHDNode = retrieveHDNode.call(this, clientPubHierarchyRootPath);

        if (clientPubHierarchyRootHDNode == null) {
            Catenis.logger.ERROR(util.format('Public hierarchy root HD extended key (%s) for client with index %d of Catenis node with index %d not found', clientPubHierarchyRootPath, clientIndex, ctnNodeIndex));
        }
        else {
            // Create client internal root HD extended key for device with given index
            const deviceIntRootPath = util.format('%s/%d', clientIntHierarchyRootPath, deviceIndex);
            let deviceIntRootHDNode = clientIntHierarchyRootHDNode.derive(deviceIndex);

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
                    const deviceIntAddrRootPath = util.format('%s/%d', deviceIntRootPath, idx),
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
                    const devicePubRootPath = util.format('%s/%d', clientPubHierarchyRootPath, deviceIndex);
                    let devicePubRootHDNode = clientPubHierarchyRootHDNode.derive(deviceIndex);

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
                            hdNodesToStore.forEach((hdNodeToStore) => {
                                storeHDNode.call(this, hdNodeToStore.type, hdNodeToStore.path, hdNodeToStore.hdNode, hdNodeToStore.isLeaf, hdNodeToStore.isReserved);
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

KeyStore.prototype.getDeviceInternalAddressKeys = function (ctnNodeIndex, clientIndex, deviceIndex, addrRootIndex, addrIndex, isObsolete = false) {
    // Validate arguments
    const errArg = {};

    if (!isValidCatenisNodeIndex(ctnNodeIndex)) {
        errArg.ctnNodeIndex = ctnNodeIndex;
    }

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
        const errArgs = Object.keys(errArg);

        Catenis.logger.ERROR(util.format('KeyStore.getDeviceInternalAddressKeys method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    // Try to retrieve specified internal address HD extended key for device of given Catenis node and client, with given index
    const deviceIntAddrPath = util.format('m/%d/%d/0/%d/%d/%d', ctnNodeIndex, clientIndex, deviceIndex, addrRootIndex, addrIndex);
    let deviceIntAddrHDNode = retrieveHDNode.call(this, deviceIntAddrPath),
        deviceIntAddrKeys = null;

    if (deviceIntAddrHDNode == null) {
        // Device internal address HD extended key does not exist yet.
        //  Retrieve parent root HD extended key to create it
        const path = parentPath(deviceIntAddrPath);
        let deviceIntAddrRootHDNode = retrieveHDNode.call(this, path);

        if (deviceIntAddrRootHDNode == null) {
            // Device internal addresses root HD extended key does not exist yet.
            //  Try to initialize device HD extended keys
            if (!this.initDeviceHDNodes(ctnNodeIndex, clientIndex, deviceIndex)) {
                Catenis.logger.ERROR(util.format('HD extended keys for device with index %d of client with index %d of Catenis node with index %d could not be initialized', deviceIndex, clientIndex, ctnNodeIndex));
            }
            else {
                // Device HD extended keys successfully initialized.
                //  Try to retrieve device internal addresses root HD extend key again
                deviceIntAddrRootHDNode = retrieveHDNode.call(this, path);
            }
        }

        if (deviceIntAddrRootHDNode == null) {
            Catenis.logger.ERROR(util.format('Internal addresses root HD extended key (%s) for device #%d of client with index %d of Catenis node with index %d not found', path, deviceIndex + 1, clientIndex, ctnNodeIndex));
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

KeyStore.prototype.listDeviceInternalAddresses = function (ctnNodeIndex, clientIndex, deviceIndex, addrRootIndex, fromAddrIndex, toAddrIndex, onlyInUse) {
    // Validate arguments
    const errArg = {},
        queryTerms = [{parentPath: util.format('m/%d/%d/0/%d/%d', ctnNodeIndex, clientIndex, deviceIndex, addrRootIndex)}];

    if (!isValidCatenisNodeIndex(ctnNodeIndex)) {
        errArg.ctnNodeIndex = ctnNodeIndex;
    }

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
        const errArgs = Object.keys(errArg);

        Catenis.logger.ERROR(util.format('KeyStore.listDeviceInternalAddresses method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    if (onlyInUse) {
        queryTerms.push({isObsolete: false});
    }

    // Return existing device internal addresses within the specified range
    let query;

    if (queryTerms.length > 1) {
        query = {$and: queryTerms};
    }
    else {
        query = queryTerms[0];
    }

    return this.collExtKey.chain().find(query).simplesort('index').data().map((docExtKey) => {
        return docExtKey.address;
    });
};

KeyStore.prototype.listDeviceInternalAddressesInUse = function (ctnNodeIndex, clientIndex, deviceIndex, addrRootIndex, fromAddrIndex, toAddrIndex) {
    return this.listDeviceInternalAddresses(ctnNodeIndex, clientIndex, deviceIndex, addrRootIndex, fromAddrIndex, toAddrIndex, true);
};

KeyStore.prototype.getDevicePublicAddressKeys = function (ctnNodeIndex, clientIndex, deviceIndex, addrRootIndex, addrIndex, isObsolete = false) {
    // Validate arguments
    const errArg = {};

    if (!isValidCatenisNodeIndex(ctnNodeIndex)) {
        errArg.ctnNodeIndex = ctnNodeIndex;
    }

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
        const errArgs = Object.keys(errArg);

        Catenis.logger.ERROR(util.format('KeyStore.getDevicePublicAddressKeys method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    // Try to retrieve specified public address HD extended key for device of given Catenis node and client, with given index
    const devicePubAddrPath = util.format('m/%d/%d/1/%d/%d/%d', ctnNodeIndex, clientIndex, deviceIndex, addrRootIndex, addrIndex);
    let devicePubAddrHDNode = retrieveHDNode.call(this, devicePubAddrPath),
        devicePubAddrKeys = null;

    if (devicePubAddrHDNode == null) {
        // Device public address HD extended key does not exist yet.
        //  Retrieve parent root HD extended key to create it
        const path = parentPath(devicePubAddrPath);
        let devicePubAddrRootHDNode = retrieveHDNode.call(this, path);

        if (devicePubAddrRootHDNode == null) {
            // Device public addresses root HD extended key does not exist yet.
            //  Try to initialize device HD extended keys
            if (!this.initDeviceHDNodes(ctnNodeIndex, clientIndex, deviceIndex)) {
                Catenis.logger.ERROR(util.format('HD extended keys for device with index %d of client with index %d of Catenis node with index %d could not be initialized', deviceIndex, clientIndex, ctnNodeIndex));
            }
            else {
                // Device HD extended keys successfully initialized.
                //  Try to retrieve device public addresses root HD extend key again
                devicePubAddrRootHDNode = retrieveHDNode.call(this, path);
            }
        }

        if (devicePubAddrRootHDNode == null) {
            Catenis.logger.ERROR(util.format('Public addresses root HD extended key (%d) for device #%d of client with index %d of Catenis node with index %d not found', path, deviceIndex + 1, clientIndex, ctnNodeIndex));
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

KeyStore.prototype.listDevicePublicAddresses = function (ctnNodeIndex, clientIndex, deviceIndex, addrRootIndex, fromAddrIndex, toAddrIndex, onlyInUse) {
    // Validate arguments
    const errArg = {},
        queryTerms = [{parentPath: util.format('m/%d/%d/1/%d/%d', ctnNodeIndex, clientIndex, deviceIndex, addrRootIndex)}];

    if (!isValidCatenisNodeIndex(ctnNodeIndex)) {
        errArg.ctnNodeIndex = ctnNodeIndex;
    }

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
        const errArgs = Object.keys(errArg);

        Catenis.logger.ERROR(util.format('KeyStore.listDevicePublicAddresses method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    if (onlyInUse) {
        queryTerms.push({isObsolete: false});
    }

    // Return existing device public addresses within the specified range
    let query;

    if (queryTerms.length > 1) {
        query = {$and: queryTerms};
    }
    else {
        query = queryTerms[0];
    }

    return this.collExtKey.chain().find(query).simplesort('index').data().map((docExtKey) => {
        return docExtKey.address;
    });
};

KeyStore.prototype.listDevicePublicAddressesInUse = function (ctnNodeIndex, clientIndex, deviceIndex, addrRootIndex, fromAddrIndex, toAddrIndex) {
    return this.listDevicePublicAddresses(ctnNodeIndex, clientIndex, deviceIndex, addrRootIndex, fromAddrIndex, toAddrIndex, true);
};

// Note: this method has only been defined for device public addresses because
//      we foresee that only device asset issuance addresses (a type of device
//      public addresses) are going to need to use it.
KeyStore.prototype.latestDevicePublicAddress = function (ctnNodeIndex, clientIndex, deviceIndex, addrRootIndex, onlyInUse) {
    // Validate arguments
    const errArg = {},
        queryTerms = [{parentPath: util.format('m/%d/%d/1/%d/%d', ctnNodeIndex, clientIndex, deviceIndex, addrRootIndex)}];

    if (!isValidCatenisNodeIndex(ctnNodeIndex)) {
        errArg.ctnNodeIndex = ctnNodeIndex;
    }

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
        const errArgs = Object.keys(errArg);

        Catenis.logger.ERROR(util.format('KeyStore.listDevicePublicAddresses method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    if (onlyInUse) {
        queryTerms.push({isObsolete: false});
    }

    // Return existing device public addresses within the specified range
    let query;

    if (queryTerms.length > 1) {
        query = {$and: queryTerms};
    }
    else {
        query = queryTerms[0];
    }

    return this.collExtKey.chain().find(query).simplesort('index', true).limit(1).data().reduce((docExtKey) => {
        return docExtKey.address;
    }, null);
};

KeyStore.prototype.latestDevicePublicAddressInUse = function (ctnNodeIndex, clientIndex, deviceIndex, addrRootIndex) {
    return this.latestDevicePublicAddress(ctnNodeIndex, clientIndex, deviceIndex, addrRootIndex, true);
};

KeyStore.prototype.getDeviceReadConfirmAddressKeys = function (ctnNodeIndex, clientIndex, deviceIndex, addrIndex, isObsolete = false) {
    return this.getDeviceInternalAddressKeys(ctnNodeIndex, clientIndex, deviceIndex, 0, addrIndex, isObsolete);
};

KeyStore.prototype.listDeviceReadConfirmAddresses = function (ctnNodeIndex, clientIndex, deviceIndex, fromAddrIndex, toAddrIndex, onlyInUse) {
    return this.listDeviceInternalAddresses(ctnNodeIndex, clientIndex, deviceIndex, 0, fromAddrIndex, toAddrIndex, onlyInUse);
};

KeyStore.prototype.listDeviceReadConfirmAddressesInUse = function (ctnNodeIndex, clientIndex, deviceIndex, fromAddrIndex, toAddrIndex) {
    return this.listDeviceInternalAddresses(ctnNodeIndex, clientIndex, deviceIndex, 0, fromAddrIndex, toAddrIndex, true);
};

KeyStore.prototype.getDeviceMainAddressKeys = function (ctnNodeIndex, clientIndex, deviceIndex, addrIndex, isObsolete = false) {
    return this.getDevicePublicAddressKeys(ctnNodeIndex, clientIndex, deviceIndex, 0, addrIndex, isObsolete);
};

KeyStore.prototype.listDeviceMainAddresses = function (ctnNodeIndex, clientIndex, deviceIndex, fromAddrIndex, toAddrIndex, onlyInUse) {
    return this.listDevicePublicAddresses(ctnNodeIndex, clientIndex, deviceIndex, 0, fromAddrIndex, toAddrIndex, onlyInUse);
};

KeyStore.prototype.listDeviceMainAddressesInUse = function (ctnNodeIndex, clientIndex, deviceIndex, fromAddrIndex, toAddrIndex) {
    return this.listDevicePublicAddresses(ctnNodeIndex, clientIndex, deviceIndex, 0, fromAddrIndex, toAddrIndex, true);
};

KeyStore.prototype.getDeviceAssetAddressKeys = function (ctnNodeIndex, clientIndex, deviceIndex, addrIndex, isObsolete = false) {
    return this.getDevicePublicAddressKeys(ctnNodeIndex, clientIndex, deviceIndex, 1, addrIndex, isObsolete);
};

KeyStore.prototype.listDeviceAssetAddresses = function (ctnNodeIndex, clientIndex,  deviceIndex, fromAddrIndex, toAddrIndex, onlyInUse) {
    return this.listDevicePublicAddresses(ctnNodeIndex, clientIndex,  deviceIndex, 1, fromAddrIndex, toAddrIndex, onlyInUse);
};

KeyStore.prototype.listDeviceAssetAddressesInUse = function (ctnNodeIndex, clientIndex,  deviceIndex, fromAddrIndex, toAddrIndex) {
    return this.listDevicePublicAddresses(ctnNodeIndex, clientIndex,  deviceIndex, 1, fromAddrIndex, toAddrIndex, true);
};

KeyStore.prototype.getDeviceAssetIssuanceAddressKeys = function (ctnNodeIndex, clientIndex,  deviceIndex, addrIndex, isObsolete = false) {
    return this.getDevicePublicAddressKeys(ctnNodeIndex, clientIndex,  deviceIndex, 2, addrIndex, isObsolete);
};

KeyStore.prototype.listDeviceAssetIssuanceAddresses = function (ctnNodeIndex, clientIndex,  deviceIndex, fromAddrIndex, toAddrIndex, onlyInUse) {
    return this.listDevicePublicAddresses(ctnNodeIndex, clientIndex,  deviceIndex, 2, fromAddrIndex, toAddrIndex, onlyInUse);
};

KeyStore.prototype.listDeviceAssetIssuanceAddressesInUse = function (ctnNodeIndex, clientIndex,  deviceIndex, fromAddrIndex, toAddrIndex) {
    return this.listDevicePublicAddresses(ctnNodeIndex, clientIndex,  deviceIndex, 2, fromAddrIndex, toAddrIndex, true);
};

KeyStore.prototype.latestDeviceAssetIssuanceAddress = function (ctnNodeIndex, clientIndex,  deviceIndex, onlyInUse) {
    return this.latestDevicePublicAddress(ctnNodeIndex, clientIndex,  deviceIndex, 2, onlyInUse);
};

KeyStore.prototype.latestDeviceAssetIssuanceAddressInUse = function (ctnNodeIndex, clientIndex,  deviceIndex) {
    return this.latestDevicePublicAddress(ctnNodeIndex, clientIndex,  deviceIndex, 2, true);
};


// Module functions used to simulate private KeyStore object methods
//  NOTE: these functions need to be bound to a KeyStore object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

function purgeUnusedExtendedKeys() {
    Catenis.logger.TRACE('Executing process to purge unused HD extended keys from local key storage');
    // Calculate earliest date/time for obsolete HD extended key to have been created/update for it not to be purged
    const obsoleteEarliestTime = new Date(Date.now());
    obsoleteEarliestTime.setSeconds(obsoleteEarliestTime.getSeconds() - cfgSettings.obsoleteExtKeyTimeToPurge);

    const obsoleteEarliestTimestamp = obsoleteEarliestTime.getTime();

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

    const docExtKey = {type: type, path: path, parentPath: parentPath(path), depth: hdNode.depth, index: hdNode.index, strHDNode: hdNode.toBase58(), address: (new Catenis.module.CryptoKeys(hdNode.keyPair)).getAddress(), isLeaf: isLeaf, isReserved: isReserved, isObsolete: isObsolete};

    this.collExtKey.insert(docExtKey);
}

function retrieveHDNode(path) {
    const docExtKey = this.collExtKey.by('path', path);

    return docExtKey != undefined ? bitcoinLib.HDNode.fromBase58(docExtKey.strHDNode, this.cryptoNetwork) : null;
}


// KeyStore function class (public) methods
//

KeyStore.initialize = function () {
    Catenis.logger.TRACE('KeyStore initialization');
    // Instantiate KeyStore object
    Catenis.keyStore = new KeyStore(Catenis.application.ctnHubNodeIndex, Catenis.application.seed, Catenis.application.cryptoNetwork);

    // Execute process to purge unused HD extended keys from local key storage now,
    //  and set recurring timer to execute it periodically
    purgeUnusedExtendedKeys.call(Catenis.keyStore);
    Catenis.logger.TRACE('Setting recurring timer to purge unused HD extended keys from local key storage');
    purgeUnusedExtKeyInternalHandle = Meteor.setInterval(purgeUnusedExtendedKeys.bind(Catenis.keyStore), cfgSettings.purgeUnusedExtKeyInterval);
};

KeyStore.systemFundingPaymentRootPath = function (ctnNodeIndex) {
    // Validate Catenis node index
    if (!isValidCatenisNodeIndex(ctnNodeIndex)) {
        Catenis.logger.ERROR('KeyStore.systemFundingPaymentRootPath method called with invalid argument', {ctnNodeIndex: ctnNodeIndex});
        throw Error('Invalid ctnNodeIndex argument');
    }

    return util.format('m/%d/0/1/0', ctnNodeIndex);
};

KeyStore.systemFundingChangeRootPath = function (ctnNodeIndex) {
    // Validate Catenis node index
    if (!isValidCatenisNodeIndex(ctnNodeIndex)) {
        Catenis.logger.ERROR('KeyStore.systemFundingChangeRootPath method called with invalid argument', {ctnNodeIndex: ctnNodeIndex});
        throw Error('Invalid ctnNodeIndex argument');
    }

    return util.format('m/%d/0/1/1', ctnNodeIndex);
};

KeyStore.systemPayTxExpenseRootPath = function (ctnNodeIndex) {
    // Validate Catenis node index
    if (!isValidCatenisNodeIndex(ctnNodeIndex)) {
        Catenis.logger.ERROR('KeyStore.systemPayTxExpenseRootPath method called with invalid argument', {ctnNodeIndex: ctnNodeIndex});
        throw Error('Invalid ctnNodeIndex argument');
    }

    return util.format('m/%d/0/2', ctnNodeIndex);
};

KeyStore.systemDeviceMainAddressRootPath = function (ctnNodeIndex) {
    // Validate Catenis node index
    if (!isValidCatenisNodeIndex(ctnNodeIndex)) {
        Catenis.logger.ERROR('KeyStore.systemDeviceMainAddressRootPath method called with invalid argument', {ctnNodeIndex: ctnNodeIndex});
        throw Error('Invalid ctnNodeIndex argument');
    }

    return util.format('m/%d/0/0/0', ctnNodeIndex);
};

KeyStore.clientMessageCreditAddressRootPath = function (ctnNodeIndex, clientIndex) {
    // Validate arguments
    const errArg = {};

    if (!isValidCatenisNodeIndex(ctnNodeIndex)) {
        errArg.ctnNodeIndex = ctnNodeIndex;
    }

    if (!isValidClientIndex(clientIndex)) {
        errArg.clientIndex = clientIndex;
    }

    if (Object.keys(errArg).length > 0) {
        const errArgs = Object.keys(errArg);

        Catenis.logger.ERROR(util.format('KeyStore.clientMessageCreditAddressesRootPath method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    return util.format('m/%d/%d/0/0/0/0', ctnNodeIndex, clientIndex);
};

KeyStore.clientAssetCreditAddressRootPath = function (ctnNodeIndex, clientIndex) {
    // Validate arguments
    const errArg = {};

    if (!isValidCatenisNodeIndex(ctnNodeIndex)) {
        errArg.ctnNodeIndex = ctnNodeIndex;
    }

    if (!isValidClientIndex(clientIndex)) {
        errArg.clientIndex = clientIndex;
    }

    if (Object.keys(errArg).length > 0) {
        const errArgs = Object.keys(errArg);

        Catenis.logger.ERROR(util.format('KeyStore.clientAssetCreditAddressesRootPath method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    return util.format('m/%d/%d/0/0/0/1', ctnNodeIndex, clientIndex);
};

KeyStore.deviceReadConfirmAddressRootPath = function (ctnNodeIndex, clientIndex, deviceIndex) {
    // Validate arguments
    const errArg = {};

    if (!isValidCatenisNodeIndex(ctnNodeIndex)) {
        errArg.ctnNodeIndex = ctnNodeIndex;
    }

    if (!isValidClientIndex(clientIndex)) {
        errArg.clientIndex = clientIndex;
    }

    if (!isValidDeviceIndex(deviceIndex)) {
        errArg.deviceIndex = deviceIndex;
    }

    if (Object.keys(errArg).length > 0) {
        const errArgs = Object.keys(errArg);

        Catenis.logger.ERROR(util.format('KeyStore.deviceReadConfirmAddressRootPath method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    return util.format('m/%d/%d/0/%d/0', ctnNodeIndex, clientIndex, deviceIndex);
};

KeyStore.deviceMainAddressRootPath = function (ctnNodeIndex, clientIndex, deviceIndex) {
    // Validate arguments
    const errArg = {};

    if (!isValidCatenisNodeIndex(ctnNodeIndex)) {
        errArg.ctnNodeIndex = ctnNodeIndex;
    }

    if (!isValidClientIndex(clientIndex)) {
        errArg.clientIndex = clientIndex;
    }

    if (!isValidDeviceIndex(deviceIndex)) {
        errArg.deviceIndex = deviceIndex;
    }

    if (Object.keys(errArg).length > 0) {
        const errArgs = Object.keys(errArg);

        Catenis.logger.ERROR(util.format('KeyStore.deviceMainAddressRootPath method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    return util.format('m/%d/%d/1/%d/0', ctnNodeIndex, clientIndex, deviceIndex);
};

KeyStore.deviceAssetAddressRootPath = function (ctnNodeIndex, clientIndex, deviceIndex) {
    // Validate arguments
    const errArg = {};

    if (!isValidCatenisNodeIndex(ctnNodeIndex)) {
        errArg.ctnNodeIndex = ctnNodeIndex;
    }

    if (!isValidClientIndex(clientIndex)) {
        errArg.clientIndex = clientIndex;
    }

    if (!isValidDeviceIndex(deviceIndex)) {
        errArg.deviceIndex = deviceIndex;
    }

    if (Object.keys(errArg).length > 0) {
        const errArgs = Object.keys(errArg);

        Catenis.logger.ERROR(util.format('KeyStore.deviceAssetAddressRootPath method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    return util.format('m/%d/%d/1/%d/1', ctnNodeIndex, clientIndex, deviceIndex);
};

KeyStore.deviceAssetIssuanceAddressRootPath = function (ctnNodeIndex, clientIndex, deviceIndex) {
    // Validate arguments
    const errArg = {};

    if (!isValidCatenisNodeIndex(ctnNodeIndex)) {
        errArg.ctnNodeIndex = ctnNodeIndex;
    }

    if (!isValidClientIndex(clientIndex)) {
        errArg.clientIndex = clientIndex;
    }

    if (!isValidDeviceIndex(deviceIndex)) {
        errArg.deviceIndex = deviceIndex;
    }

    if (Object.keys(errArg).length > 0) {
        const errArgs = Object.keys(errArg);

        Catenis.logger.ERROR(util.format('KeyStore.deviceAssetIssuanceAddressRootPath method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    return util.format('m/%d/%d/1/%d/2', ctnNodeIndex, clientIndex, deviceIndex);
};

KeyStore.getPathParts = function (docExtKey) {
    const pathParts = {};
    let hasParts = false,
        extKeyType,
        searchResult;

    if (docExtKey.type in KeyStore.extKeyType && 'pathParts' in (extKeyType = KeyStore.extKeyType[docExtKey.type])
        && (searchResult = docExtKey.path.match(extKeyType.pathRegEx))) {
        for (let partNum in extKeyType.pathParts) {
            if (partNum < searchResult.length) {
                //noinspection JSUnfilteredForInLoop
                pathParts[extKeyType.pathParts[partNum]] = parseInt(searchResult[partNum]);
                hasParts = true;
            }
        }
    }

    return hasParts ? pathParts : null;
};


// KeyStore function class (public) properties
//

KeyStore.extKeyType = Object.freeze({
    mstr: Object.freeze({
        name: 'mstr',
        description: 'master root',
        pathRegEx: /^m$/
    }),
    ctnd_root: Object.freeze({
        name: 'ctnd_root',
        description: 'Catenis node root',
        pathRegEx: /^m\/(\d+)$/,
        pathParts: {
            1: 'ctnNodeIndex'
        }
    }),
    sys_root: Object.freeze({
        name: 'sys_root',
        description: 'system root',
        pathRegEx: /^m\/(\d+)\/0$/,
        pathParts: {
            1: 'ctnNodeIndex'
        }
    }),
    sys_dev_root: Object.freeze({
        name: 'sys_dev_root',
        description: 'system device root',
        pathRegEx: /^m\/(\d+)\/0\/0$/,
        pathParts: {
            1: 'ctnNodeIndex'
        }
    }),
    sys_fund_root: Object.freeze({
        name: 'sys_fund_root',
        description: 'system funding root',
        pathRegEx: /^m\/(\d+)\/0\/1$/,
        pathParts: {
            1: 'ctnNodeIndex'
        }
    }),
    sys_pay_tx_exp_root: Object.freeze({
        name: 'sys_pay_tx_exp_root',
        description: 'system pay tx expense root',
        pathRegEx: /^m\/(\d+)\/0\/2$/,
        pathParts: {
            1: 'ctnNodeIndex'
        }
    }),
    sys_dev_main_addr_root: Object.freeze({
        name: 'sys_dev_main_addr_root',
        description: 'System device main addresses root',
        pathRegEx: /^m\/(\d+)\/0\/0\/0$/,
        pathParts: {
            1: 'ctnNodeIndex'
        }
    }),
    sys_dev_rsrv_addr_root: Object.freeze({
        name: 'sys_dev_rsrv_addr_root',
        description: 'system device reserved addresses root',
        pathRegEx: /^m\/(\d+)\/0\/0\/(\d+)$/,
        pathParts: {
            1: 'ctnNodeIndex',
            2: 'addrRootIndex'
        }
    }),
    sys_dev_main_addr: Object.freeze({
        name: 'sys_dev_main_addr',
        description: 'system device main address',
        pathRegEx: /^m\/(\d+)\/0\/0\/0\/(\d+)$/,
        pathParts: {
            1: 'ctnNodeIndex',
            2: 'addrIndex'
        }
    }),
    sys_dev_rsrv_addr: Object.freeze({
        name: 'sys_dev_rsrv_addr',
        description: 'system node device reserved address',
        pathRegEx: /^m\/(\d+)\/0\/0\/(\d+)\/(\d+)$/,
        pathParts: {
            1: 'ctnNodeIndex',
            2: 'addrRootIndex',
            3: 'addrIndex'
        }
    }),
    sys_fund_pay_root: Object.freeze({
        name: 'sys_fund_pay_root',
        description: 'system funding payment root',
        pathRegEx: /^m\/(\d+)\/0\/1\/0$/,
        pathParts: {
            1: 'ctnNodeIndex'
        }
    }),
    sys_fund_chg_root: Object.freeze({
        name: 'sys_fund_chg_root',
        description: 'system funding change root',
        pathRegEx: /^m\/(\d+)\/0\/1\/1$/,
        pathParts: {
            1: 'ctnNodeIndex'
        }
    }),
    sys_fund_pay_addr: Object.freeze({
        name: 'sys_fund_pay_addr',
        description: 'system funding payment address',
        pathRegEx: /^m\/(\d+)\/0\/1\/0\/(\d+)$/,
        pathParts: {
            1: 'ctnNodeIndex',
            2: 'addrIndex'
        }
    }),
    sys_fund_chg_addr: Object.freeze({
        name: 'sys_fund_chg_addr',
        description: 'system funding change address',
        pathRegEx: /^m\/(\d+)\/0\/1\/1\/(\d+)$/,
        pathParts: {
            1: 'ctnNodeIndex',
            2: 'addrIndex'
        }
    }),
    sys_pay_tx_exp_addr: Object.freeze({
        name: 'sys_pay_tx_exp_addr',
        description: 'system pay tx expense address',
        pathRegEx: /^m\/(\d+)\/0\/2\/(\d+)$/,
        pathParts: {
            1: 'ctnNodeIndex',
            2: 'addrIndex'
        }
    }),
    cln_root: Object.freeze({
        name: 'cln_root',
        description: 'client root',
        pathRegEx: /^m\/(\d+)\/(\d+)$/,
        pathParts: {
            1: 'ctnNodeIndex',
            2: 'clientIndex'
        }
    }),
    cln_int_hrch_root: Object.freeze({
        name: 'cln_int_hrch_root',
        description: 'client internal hierarchy root',
        pathRegEx: /^m\/(\d+)\/(\d+)\/0$/,
        pathParts: {
            1: 'ctnNodeIndex',
            2: 'clientIndex'
        }
    }),
    cln_pub_hrch_root: Object.freeze({
        name: 'cln_pub_hrch_root',
        description: 'client public hierarchy root',
        pathRegEx: /^m\/(\d+)\/(\d+)\/1$/,
        pathParts: {
            1: 'ctnNodeIndex',
            2: 'clientIndex'
        }
    }),
    cln_int_root: Object.freeze({
        name: 'cln_int_root',
        description: 'client internal root',
        pathRegEx: /^m\/(\d+)\/(\d+)\/0\/0$/,
        pathParts: {
            1: 'ctnNodeIndex',
            2: 'clientIndex'
        }
    }),
    cln_srv_crd_root: Object.freeze({
        name: 'cln_srv_crd_root',
        description: 'client service credit root',
        pathRegEx: /^m\/(\d+)\/(\d+)\/0\/0\/0$/,
        pathParts: {
            1: 'ctnNodeIndex',
            2: 'clientIndex'
        }
    }),
    cln_msg_crd_addr_root: Object.freeze({
        name: 'cln_msg_crd_addr_root',
        description: 'client message credit addresses root',
        pathRegEx: /^m\/(\d+)\/(\d+)\/0\/0\/0\/0$/,
        pathParts: {
            1: 'ctnNodeIndex',
            2: 'clientIndex'
        }
    }),
    cln_asst_crd_addr_root: Object.freeze({
        name: 'cln_asst_crd_addr_root',
        description: 'client asset credit addresses root',
        pathRegEx: /^m\/(\d+)\/(\d+)\/0\/0\/0\/1$/,
        pathParts: {
            1: 'ctnNodeIndex',
            2: 'clientIndex'
        }
    }),
    cln_srv_crd_rsrv_addr_root: Object.freeze({
        name: 'cln_srv_crd_rsrv_addr_root',
        description: 'client service credit reserved addresses root',
        pathRegEx: /^m\/(\d+)\/(\d+)\/0\/0\/0\/(\d+)$/,
        pathParts: {
            1: 'ctnNodeIndex',
            2: 'clientIndex',
            3: 'servCreditIndex'
        }
    }),
    cln_msg_crd_addr: Object.freeze({
        name: 'cln_msg_crd_addr',
        description: 'client message credit address',
        pathRegEx: /^m\/(\d+)\/(\d+)\/0\/0\/0\/0\/(\d+)$/,
        pathParts: {
            1: 'ctnNodeIndex',
            2: 'clientIndex',
            3: 'addrIndex'
        }
    }),
    cln_asst_crd_addr: Object.freeze({
        name: 'cln_asst_crd_addr',
        description: 'client asset credit address',
        pathRegEx: /^m\/(\d+)\/(\d+)\/0\/0\/0\/1\/(\d+)$/,
        pathParts: {
            1: 'ctnNodeIndex',
            2: 'clientIndex',
            3: 'addrIndex'
        }
    }),
    cln_srv_crd_rsrv_addr: Object.freeze({
        name: 'cln_srv_crd_rsrv_addr',
        description: 'client service credit reserved address',
        pathRegEx: /^m\/(\d+)\/(\d+)\/0\/0\/0\/(\d+)\/(\d+)$/,
        pathParts: {
            1: 'ctnNodeIndex',
            2: 'clientIndex',
            3: 'servCreditIndex',
            4: 'addrIndex'
        }
    }),
    dev_int_root: Object.freeze({
        name: 'dev_int_root',
        description: 'device internal root',
        pathRegEx: /^m\/(\d+)\/(\d+)\/0\/(\d+)$/,
        pathParts: {
            1: 'ctnNodeIndex',
            2: 'clientIndex',
            3: 'deviceIndex'
        }
    }),
    dev_read_conf_addr_root: Object.freeze({
        name: 'dev_read_conf_addr_root',
        description: 'device read confirmation addresses root',
        pathRegEx: /^m\/(\d+)\/(\d+)\/0\/(\d+)\/0$/,
        pathParts: {
            1: 'ctnNodeIndex',
            2: 'clientIndex',
            3: 'deviceIndex'
        }
    }),
    dev_int_rsrv_addr_root: Object.freeze({
        name: 'dev_int_rsrv_addr_root',
        description: 'device internal reserved addresses root',
        pathRegEx: /^m\/(\d+)\/(\d+)\/0\/(\d+)\/(\d+)$/,
        pathParts: {
            1: 'ctnNodeIndex',
            2: 'clientIndex',
            3: 'deviceIndex',
            4: 'addrRootIndex'
        }
    }),
    dev_read_conf_addr: Object.freeze({
        name: 'dev_read_conf_addr',
        description: 'device read confirmation address',
        pathRegEx: /^m\/(\d+)\/(\d+)\/0\/(\d+)\/0\/(\d+)$/,
        pathParts: {
            1: 'ctnNodeIndex',
            2: 'clientIndex',
            3: 'deviceIndex',
            4: 'addrIndex'
        }
    }),
    dev_int_rsrv_addr: Object.freeze({
        name: 'dev_int_rsrv_addr',
        description: 'device internal reserved address',
        pathRegEx: /^m\/(\d+)\/(\d+)\/0\/(\d+)\/(\d+)\/(\d+)$/,
        pathParts: {
            1: 'ctnNodeIndex',
            2: 'clientIndex',
            3: 'deviceIndex',
            4: 'addrRootIndex',
            5: 'addrIndex'
        }
    }),
    dev_pub_root: Object.freeze({
        name: 'dev_pub_root',
        description: 'device public root',
        pathRegEx: /^m\/(\d+)\/(\d+)\/1\/(\d+)$/,
        pathParts: {
            1: 'ctnNodeIndex',
            2: 'clientIndex',
            3: 'deviceIndex'
        }
    }),
    dev_main_addr_root: Object.freeze({
        name: 'dev_main_addr_root',
        description: 'device main addresses root',
        pathRegEx: /^m\/(\d+)\/(\d+)\/1\/(\d+)\/0$/,
        pathParts: {
            1: 'ctnNodeIndex',
            2: 'clientIndex',
            3: 'deviceIndex'
        }
    }),
    dev_asst_addr_root: Object.freeze({
        name: 'dev_asst_addr_root',
        description: 'device asset addresses root',
        pathRegEx: /^m\/(\d+)\/(\d+)\/1\/(\d+)\/1$/,
        pathParts: {
            1: 'ctnNodeIndex',
            2: 'clientIndex',
            3: 'deviceIndex'
        }
    }),
    dev_asst_issu_addr_root: Object.freeze({
        name: 'dev_asst_issu_addr_root',
        description: 'device asset issuance addresses root',
        pathRegEx: /^m\/(\d+)\/(\d+)\/1\/(\d+)\/2$/,
        pathParts: {
            1: 'ctnNodeIndex',
            2: 'clientIndex',
            3: 'deviceIndex'
        }
    }),
    dev_pub_rsrv_addr_root: Object.freeze({
        name: 'dev_pub_rsrv_addr_root',
        description: 'device public reserved addresses root',
        pathRegEx: /^m\/(\d+)\/(\d+)\/1\/(\d+)\/(\d+)$/,
        pathParts: {
            1: 'ctnNodeIndex',
            2: 'clientIndex',
            3: 'deviceIndex',
            4: 'addrRootIndex'
        }
    }),
    dev_main_addr: Object.freeze({
        name: 'dev_main_addr',
        description: 'device main address',
        pathRegEx: /^m\/(\d+)\/(\d+)\/1\/(\d+)\/0\/(\d+)$/,
        pathParts: {
            1: 'ctnNodeIndex',
            2: 'clientIndex',
            3: 'deviceIndex',
            4: 'addrIndex'
        }
    }),
    dev_asst_addr: Object.freeze({
        name: 'dev_asst_addr',
        description: 'device asset address',
        pathRegEx: /^m\/(\d+)\/(\d+)\/1\/(\d+)\/1\/(\d+)$/,
        pathParts: {
            1: 'ctnNodeIndex',
            2: 'clientIndex',
            3: 'deviceIndex',
            4: 'addrIndex'
        }
    }),
    dev_asst_issu_addr: Object.freeze({
        name: 'dev_asst_issu_addr',
        description: 'device asset issuance address',
        pathRegEx: /^m\/(\d+)\/(\d+)\/1\/(\d+)\/2\/(\d+)$/,
        pathParts: {
            1: 'ctnNodeIndex',
            2: 'clientIndex',
            3: 'deviceIndex',
            4: 'addrIndex'
        }
    }),
    dev_pub_rsrv_addr: Object.freeze({
        name: 'dev_pub_rsrv_addr',
        description: 'device public reserved address',
        pathRegEx: /^m\/(\d+)\/(\d+)\/1\/(\d+)\/(\d+)\/(\d+)$/,
        pathParts: {
            1: 'ctnNodeIndex',
            2: 'clientIndex',
            3: 'deviceIndex',
            4: 'addrRootIndex',
            5: 'addrIndex'
        }
    })
});


// Definition of module (private) functions
//

function parentPath(path) {
    let parentPath = undefined;
    const pos = path.lastIndexOf('/');

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
Catenis.module.KeyStore = Object.freeze(KeyStore);
