/**
 * Created by Claudio on 2016-03-10.
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
//      m/k/0/3 -> System read confirmation root HD extended key
//
//      m/k/0/4 -> System asset root HD extended key
//
//      m/k/0/5 -> System BCOT token sale root HD extended key (NOTE: this entry should only exist for the Catenis Hub node (k = 0))
//
//      m/k/0/6 -> System off-chain messages settlement root HD extended Key
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
//      m/k/0/2/* -> System pay tx expense addresses HD extended keys (used to pay for fees of message and asset related transactions)
//
//      m/k/0/3/0 -> System read confirmation spend root HD extended key
//
//      m/k/0/3/1 -> System read confirmation pay tx expense root HD extended key
//
//      m/k/0/3/0/0 -> System read confirmation spend notify root HD extended key
//
//      m/k/0/3/0/1 -> System read confirmation spend only root HD extended key
//
//      m/k/0/3/0/2 -> System read confirmation spend null root HD extended key
//
//      m/k/0/3/0/0/* -> System read confirmation spend notify addresses HD extended keys (used to collect payment from spent read confirmation outputs from send message txs and notify origin device)
//
//      m/k/0/3/0/1/* -> System read confirmation spend only addresses HD extended keys (used to collect payment from spent read confirmation outputs from send message txs without notification)
//
//      m/k/0/3/0/2/* -> System read confirmation spend null addresses HD extended keys (used to collect payment from spent read confirmation outputs from send messages txs to mark message as invalid, in case of messages sent to devices that do not wish to receive messages from origin device)
//
//      m/k/0/3/1/* -> System read confirmation pay tx expense addresses HD extended keys (used to pay for read confirmation transaction fees)
//
//      m/k/0/4/0 -> System service credit root HD extended key
//
//      m/k/0/4/1 -> System multi-signature Colored Coins tx output signee root HD extended key
//
//      m/k/0/4/0/0 -> System service credit issuance root HD extended key (NOTE: each Catenis node shall have its own service credit asset)
//
//      m/k/0/4/0/1 -> System service payment pay tx expense root HD extended key
//
//      m/k/0/4/0/0/* -> System service credit issuance addresses HD extended key (NOTE: there should be only a single address generated)
//
//      m/k/0/4/0/1/* -> System service payment pay tx expense addresses HD extended keys (used to pay for fees of service credit related transactions)
//
//      m/k/0/4/1/* -> System multi-signature Colored Coins tx output signee addresses HD extended keys
//
//      m/k/0/5/0 -> System BCOT token sale stock root HD extended key
//
//      m/k/0/5/0/* -> System BCOT token sale stock addresses HD extended key (NOTE: there should be only a single address generated)
//
//      m/k/0/6/0 -> System off-chain messages settlement pay tx expense root HD extended key
//
//      m/k/0/6/0/* -> System off-chain messages settlement pay tx expense addresses HD extended key.
//                      NOTE: these addresses need to be shared with all other Catenis nodes so settle off-chain messages tx can be received by any Catenis node
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
//      m/k/i/0/0/0/0 (i>=1) -> client #i message credit addresses root HD extended key (DEPRECATED)
//      m/k/i/0/0/0/1 (i>=1) -> client #i asset credit addresses root HD extended key (DEPRECATED)
//      m/k/i/0/0/0/2 (i>=1) -> client #i service account credit line addresses root HD extended key
//      m/k/i/0/0/0/3 (i>=1) -> client #i service account debit line addresses root HD extended key
//      m/k/i/0/0/0/4 (i>=1) -> client #i BCOT token payment addresses root HD extended key
//      m/k/i/0/0/0/5 (i>=1) -> client #i service credit (reserved) address #6 root HD extended key
//      m/k/i/0/0/0/6 (i>=1) -> client #i service credit (reserved) address #7 root HD extended key
//      m/k/i/0/0/0/7 (i>=1) -> client #i service credit (reserved) address #8 root HD extended key
//      m/k/i/0/0/0/8 (i>=1) -> client #i service credit (reserved) address #9 root HD extended key
//      m/k/i/0/0/0/9 (i>=1) -> client #i service credit (reserved) address #10 root HD extended key
//
//      m/k/i/0/0/0/0/* (i>=1) -> client #i message credit addresses HD extended key (DEPRECATED)
//      m/k/i/0/0/0/1/* (i>=1) -> client #i asset credit addresses HD extended key (DEPRECATED)
//      m/k/i/0/0/0/2/* (i>=1) -> client #i service account credit line addresses HD extended key
//      m/k/i/0/0/0/3/* (i>=1) -> client #i service account debit line addresses HD extended key
//      m/k/i/0/0/0/4/* (i>=1) -> client #i BCOT token payment addresses HD extended key
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
//      m/k/i/1/j/2 (i,j>=1) -> device #j of client #i asset issuance addresses root HD extended key
//      m/k/i/1/j/3 (i,j>=1) -> device #j of client #i off-chain addresses root HD extended key
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
//      m/k/i/1/j/3/* (i,j>=1) -> device #j of client #i of-chain addresses HD extended key
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
import util from 'util';
// Third-party node modules
import config from 'config';
import Loki from 'lokijs';
import bitcoinLib from 'bitcoinjs-lib';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { BaseBlockchainAddress } from './BaseBlockchainAddress';
import { CryptoKeys } from './CryptoKeys';
import { BaseOffChainAddress } from './BaseOffChainAddress';
import { BitcoinInfo } from './BitcoinInfo';

// Config entries
const configKeyStore = config.get('keyStore');

// Configuration settings
const cfgSettings = {
    obsoleteExtKeyTimeToPurge: configKeyStore.get('obsoleteExtKeyTimeToPurge'),
    purgeUnusedExtKeyInterval: configKeyStore.get('purgeUnusedExtKeyInterval'),
    legacyEncryptScheme: configKeyStore.get('legacyEncryptScheme')
};

const clientServCredAddrRootTypes = [{
        root: 'cln_msg_crd_addr_root',      // DEPRECATED
        address: 'cln_msg_crd_addr'         // DEPRECATED
    }, {
        root: 'cln_asst_crd_addr_root',     // DEPRECATED
        address: 'cln_asst_crd_addr'        // DEPRECATED
    }, {
        root: 'cln_srv_acc_cred_ln_addr_root',
        address: 'cln_srv_acc_cred_ln_addr'
    }, {
        root: 'cln_srv_acc_debt_ln_addr_root',
        address: 'cln_srv_acc_debt_ln_addr'
    }, {
        root: 'cln_bcot_pay_addr_root',
        address: 'cln_bcot_pay_addr'
    }
];

const numClientServCredAddrRoots = 10,
    numDeviceAddrRoots = 10,
    numUsedSysDeviceAddrRoots = 1,
    numUsedClientServCredAddrRoots = clientServCredAddrRootTypes.length,
    numUsedDeviceIntAddrRoots = 1;

let purgeUnusedExtKeyIntervalHandle;

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
//      btcAddressType: [string],
//      pubKeyHash: [string],
//      isLeaf: [boolean],
//      isReserved: [boolean],
//      isObsolete: [boolean],
//      isOffChainAddr: [boolean]
//  }
export function KeyStore(ctnHubNodeIndex, seed, cryptoNetwork, masterOnly = false) {
    // Create master HD extended key
    this.masterHDNode = bitcoinLib.bip32.fromSeed(seed, cryptoNetwork);

    if (!masterOnly) {
        this.ctnHubNodeIndex = ctnHubNodeIndex;
        this.cryptoNetwork = cryptoNetwork;

        // Initialize in-memory database
        this.db = new Loki();
        // noinspection JSCheckFunctionSignatures
        this.collExtKey = this.db.addCollection('ExtendedKey', {indices: ['type', 'path', 'parentPath', 'index', 'address', 'pubKeyHash']});

        this.collExtKey.ensureUniqueIndex('path');
        this.collExtKey.ensureUniqueIndex('address');
        this.collExtKey.ensureUniqueIndex('pubKeyHash');

        // Store master HD extended key
        storeHDNode.call(this, 'mstr', 'm', this.masterHDNode);

        //  Try to initialize Catenis Hub HD extended keys
        if (! this.initCatenisNodeHDNodes(ctnHubNodeIndex)) {
            Catenis.logger.ERROR(util.format('HD extended keys for Catenis Hub (node index %d) could not be initialized', ctnHubNodeIndex));
            throw new Error(util.format('HD extended keys for Catenis Hub (node index %d) could not be initialized', ctnHubNodeIndex));
        }
    }
}


// Public KeyStore object methods
//

KeyStore.prototype.removeExtKeyByAddress = function (addr) {
    this.collExtKey.findAndRemove({address: addr});
};

KeyStore.prototype.removeExtKeyByOffChainAddress = function (pubKeyHash) {
    if (Buffer.isBuffer(pubKeyHash)) {
        pubKeyHash = pubKeyHash.toString('base64');
    }

    this.collExtKey.findAndRemove({pubKeyHash: pubKeyHash, isOffChainAddr: true});
};

KeyStore.prototype.removeExtKeysByParentPath = function (parentPath) {
    this.collExtKey.findAndRemove({parentPath: parentPath});
};

KeyStore.prototype.getCryptoKeysByPath = function (path) {
    const docExtKey = this.collExtKey.by('path', path);

    return docExtKey !== undefined ? new CryptoKeys(bitcoinLib.bip32.fromBase58(docExtKey.strHDNode, this.cryptoNetwork), BitcoinInfo.getAddressTypeByName(docExtKey.btcAddressType), addressEncryptionScheme(path)) : null;
};

KeyStore.prototype.getCryptoKeysByAddress = function (addr) {
    const docExtKey = this.collExtKey.by('address', addr);

    return docExtKey !== undefined ? new CryptoKeys(bitcoinLib.bip32.fromBase58(docExtKey.strHDNode, this.cryptoNetwork), BitcoinInfo.getAddressTypeByName(docExtKey.btcAddressType), addressEncryptionScheme(docExtKey.path)) : null;
};

KeyStore.prototype.getTypeAndPathByAddress = function (addr) {
    const docExtKey = this.collExtKey.by('address', addr);

    return docExtKey !== undefined ? {type: docExtKey.type, path: docExtKey.path} : null;
};

KeyStore.prototype.getTypeAndPathByOffChainAddress = function (pubKeyHash) {
    if (Buffer.isBuffer(pubKeyHash)) {
        pubKeyHash = pubKeyHash.toString('base64');
    }

    const docExtKey = this.collExtKey.by('pubKeyHash', pubKeyHash);

    return docExtKey !== undefined && docExtKey.isOffChainAddr ? {type: docExtKey.type, path: docExtKey.path} : null;
};

KeyStore.prototype.getAddressInfo = function (addr, retrieveObsolete = false, checkAddressInUse = true) {
    let addrInfo = null,
        obsoleteAddressRetrieved = false,
        tryAgain;

    do {
        tryAgain = false;

        const docExtKey = this.collExtKey.by('address', addr);

        if (docExtKey !== undefined) {
            if (retrieveObsolete && docExtKey.isObsolete && !obsoleteAddressRetrieved && checkAddressInUse) {
                // Check if address marked as obsolete is in use and reset its status if so
                if (BaseBlockchainAddress.checkObsoleteAddress(addr)) {
                    // Address status has been reset (address is not obsolete anymore)
                    docExtKey.isObsolete = false;
                }
            }

            addrInfo = {
                cryptoKeys: new CryptoKeys(bitcoinLib.bip32.fromBase58(docExtKey.strHDNode, this.cryptoNetwork), BitcoinInfo.getAddressTypeByName(docExtKey.btcAddressType), addressEncryptionScheme(docExtKey.path)),
                type: docExtKey.type,
                path: docExtKey.path,
                parentPath: docExtKey.parentPath,
                isObsolete: docExtKey.isObsolete
            };

            const pathParts = KeyStore.getPathParts(docExtKey);

            if (pathParts !== null) {
                addrInfo.pathParts = pathParts;
            }
        }
        else if (retrieveObsolete && BaseBlockchainAddress.retrieveObsoleteAddress(addr, checkAddressInUse)) {
            obsoleteAddressRetrieved = true;
            tryAgain = true;
        }
    }
    while (tryAgain);

    return addrInfo;
};

KeyStore.prototype.getAddressInfoByPath = function (path, retrieveObsolete = false, checkAddressInUse = true) {
    let addrInfo = null,
        obsoleteAddressRetrieved = false,
        tryAgain;

    do {
        tryAgain = false;

        const docExtKey = this.collExtKey.by('path', path);

        if (docExtKey !== undefined) {
            if (retrieveObsolete && docExtKey.isObsolete && !obsoleteAddressRetrieved && checkAddressInUse) {
                // Check if address marked as obsolete is in use and reset its status if so
                if (BaseBlockchainAddress.checkObsoleteAddress(docExtKey.address)) {
                    // Address status has been reset (address is not obsolete anymore)
                    docExtKey.isObsolete = false;
                }
            }

            addrInfo = {
                cryptoKeys: new CryptoKeys(bitcoinLib.bip32.fromBase58(docExtKey.strHDNode, this.cryptoNetwork), BitcoinInfo.getAddressTypeByName(docExtKey.btcAddressType), addressEncryptionScheme(path)),
                type: docExtKey.type,
                path: path,
                parentPath: docExtKey.parentPath,
                isObsolete: docExtKey.isObsolete
            };

            const pathParts = KeyStore.getPathParts(docExtKey);

            if (pathParts !== null) {
                addrInfo.pathParts = pathParts;
            }
        }
        else if (retrieveObsolete && BaseBlockchainAddress.retrieveObsoleteAddressByPath(path, checkAddressInUse)) {
            obsoleteAddressRetrieved = true;
            tryAgain = true;
        }
    }
    while (tryAgain);

    return addrInfo;
};

KeyStore.prototype.getOffChainAddressInfo = function (pubKeyHash) {
    if (Buffer.isBuffer(pubKeyHash)) {
        pubKeyHash = pubKeyHash.toString('base64');
    }

    let addrInfo = null,
        tryAgain;

    do {
        tryAgain = false;

        const docExtKey = this.collExtKey.by('pubKeyHash', pubKeyHash);

        if (docExtKey !== undefined) {
            // Make sure that this HD extended key is for an off-chain address
            if (docExtKey.isOffChainAddr) {
                addrInfo = {
                    cryptoKeys: new CryptoKeys(bitcoinLib.bip32.fromBase58(docExtKey.strHDNode, this.cryptoNetwork), undefined, addressEncryptionScheme(docExtKey.path)),
                    type: docExtKey.type,
                    path: docExtKey.path,
                    parentPath: docExtKey.parentPath
                };

                const pathParts = KeyStore.getPathParts(docExtKey);

                if (pathParts !== null) {
                    addrInfo.pathParts = pathParts;
                }
            }
            else {
                Catenis.logger.DEBUG('Trying to get off-chain address info for a non-off-chain address', {
                    pubKeyHash: pubKeyHash,
                    docExtKey: docExtKey
                })
            }
        }
        else if (BaseOffChainAddress.reloadAddress(pubKeyHash)) {
            tryAgain = true;
        }
    }
    while (tryAgain);

    return addrInfo;
};

KeyStore.prototype.listAddressesInfo = function (addrList, retrieveObsolete = false) {
    return addrList.reduce((result, addr) => {
        const hdNodeInfo = this.getAddressInfo(addr, retrieveObsolete);

        if (hdNodeInfo !== null) {
            result[addr] = hdNodeInfo;
        }

        return result;
    }, {});
};

KeyStore.prototype.setAddressAsObsolete = function (addr) {
    const docExtKey = this.collExtKey.by('address', addr);

    if (docExtKey !== undefined && docExtKey.isLeaf && !docExtKey.isObsolete) {
        docExtKey.isObsolete = true;
        //noinspection JSIgnoredPromiseFromCall
        this.collExtKey.update(docExtKey);
    }
};

KeyStore.prototype.resetObsoleteAddress = function (addr) {
    const docExtKey = this.collExtKey.by('address', addr);

    if (docExtKey !== undefined && docExtKey.isObsolete) {
        docExtKey.isObsolete = false;
        //noinspection JSIgnoredPromiseFromCall
        this.collExtKey.update(docExtKey);
    }
};

KeyStore.prototype.setAddressListAsObsolete = function (addrList) {
    this.collExtKey.chain().find({
        $and: [{
            address: {$in: addrList}
        }, {
            isLeaf: true
        }, {
            isObsolete: false
        }]
    }).update((docExtKey) => {
        docExtKey.isObsolete = true;
    });
};

KeyStore.prototype.isObsoleteAddress = function (addr) {
    const docExtKey = this.collExtKey.by('address', addr);

    return docExtKey !== undefined && docExtKey.isObsolete;
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

    const hdNodesToStore = [];

    // Try to retrieve root HD extended key for Catenis node with given index
    const ctnNodeRootPath = util.format('m/%d', ctnNodeIndex);
    let ctnNodeRootHDNode = retrieveHDNode.call(this, ctnNodeRootPath);

    if (ctnNodeRootHDNode === null) {
        // Catenis node root HD extended key does not exist yet. Create it
        ctnNodeRootHDNode = this.masterHDNode.derive(ctnNodeIndex);

        if (ctnNodeRootHDNode.index !== ctnNodeIndex) {
            Catenis.logger.WARN(util.format('Catenis node root HD extended key (%s) derived with an unexpected index', ctnNodeRootPath), {expectedIndex: ctnNodeIndex, returnedIndex: ctnNodeRootHDNode.index});
            return false;
        }

        // Save newly created HD extended key to store it later
        hdNodesToStore.push({type: 'ctnd_root', path: ctnNodeRootPath, hdNode: ctnNodeRootHDNode, isLeaf: false, isReserved: false});

        // Create system root HD extended key
        const sysRootPath = ctnNodeRootPath + '/0',
            sysRootHDNode = ctnNodeRootHDNode.derive(0);

        if (sysRootHDNode.index !== 0) {
            Catenis.logger.WARN(util.format('System root HD extended key (%s) derived with an unexpected index', sysRootPath), {expectedIndex: 0, returnedIndex: sysRootHDNode.index});
            return false;
        }

        // Save newly created HD extended key to store it later
        hdNodesToStore.push({type: 'sys_root', path: sysRootPath, hdNode: sysRootHDNode, isLeaf: false, isReserved: false});

        // Create system device root HD extended key
        let path = sysRootPath + '/0',
            sysDeviceRootHDNode = sysRootHDNode.derive(0);

        if (sysDeviceRootHDNode.index !== 0) {
            Catenis.logger.WARN(util.format('System device root HD extended key (%s) derived with an unexpected index', path), {expectedIndex: 0, returnedIndex: sysDeviceRootHDNode.index});
            return false;
        }

        // Save newly created HD extended key to store it later
        hdNodesToStore.push({type: 'sys_dev_root', path: path, hdNode: sysDeviceRootHDNode, isLeaf: false, isReserved: false});

        // Create system funding root HD extended key
        path = sysRootPath + '/1';
        const sysFundingRootHDNode = sysRootHDNode.derive(1);

        if (sysFundingRootHDNode.index !== 1) {
            Catenis.logger.WARN(util.format('System funding root HD extended key (%s) derived with an unexpected index', path), {expectedIndex: 1, returnedIndex: sysFundingRootHDNode.index});
            return false;
        }

        // Save newly created HD extended key to store it later
        hdNodesToStore.push({type: 'sys_fund_root', path: path, hdNode: sysFundingRootHDNode, isLeaf: false, isReserved: false});

        // Create system pay tx expense root HD extended key
        path = sysRootPath + '/2';
        const sysPayTxExpenseRootHDNode = sysRootHDNode.derive(2);

        if (sysPayTxExpenseRootHDNode.index !== 2) {
            Catenis.logger.WARN(util.format('System pay tx expense root HD extended key (%s) derived with an unexpected index', path), {expectedIndex: 2, returnedIndex: sysPayTxExpenseRootHDNode.index});
            return false;
        }

        // Save newly created HD extended key to store it later
        hdNodesToStore.push({type: 'sys_pay_tx_exp_root', path: path, hdNode: sysPayTxExpenseRootHDNode, isLeaf: false, isReserved: false});

        // Create system read confirmation root HD extended key
        path = sysRootPath + '/3';
        const sysReadConfRootHDNode = sysRootHDNode.derive(3);

        if (sysReadConfRootHDNode.index !== 3) {
            Catenis.logger.WARN(util.format('System read confirmation root HD extended key (%s) derived with an unexpected index', path), {expectedIndex: 3, returnedIndex: sysReadConfRootHDNode.index});
            return false;
        }

        // Save newly created HD extended key to store it later
        hdNodesToStore.push({type: 'sys_read_conf_root', path: path, hdNode: sysReadConfRootHDNode, isLeaf: false, isReserved: false});

        // Create system asset root HD extended key
        path = sysRootPath + '/4';
        const sysAssetRootHDNode = sysRootHDNode.derive(4);

        if (sysAssetRootHDNode.index !== 4) {
            Catenis.logger.WARN(util.format('System asset root HD extended key (%s) derived with an unexpected index', path), {expectedIndex: 4, returnedIndex: sysAssetRootHDNode.index});
            return false;
        }

        // Save newly created HD extended key to store it later
        hdNodesToStore.push({type: 'sys_asset_root', path: path, hdNode: sysAssetRootHDNode, isLeaf: false, isReserved: false});

        // Create system off-chain messages settlement root HD extended key
        path = sysRootPath + '/6';
        const sysOCMsgsSettleRootHDNode = sysRootHDNode.derive(6);

        if (sysOCMsgsSettleRootHDNode.index !== 6) {
            Catenis.logger.WARN(util.format('System off-chain messages settlement root HD extended key (%s) derived with an unexpected index', path), {expectedIndex: 6, returnedIndex: sysOCMsgsSettleRootHDNode.index});
            return false;
        }

        // Save newly created HD extended key to store it later
        hdNodesToStore.push({type: 'sys_oc_msg_setlmt_root', path: path, hdNode: sysOCMsgsSettleRootHDNode, isLeaf: false, isReserved: false});

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
                hdNodesToStore.push({type: idx === 0 ? 'sys_dev_main_addr_root' : 'sys_dev_rsrv_addr_root', path: path, hdNode: sysDeviceAddrRootHDNode, isLeaf: false, isReserved: idx >= numUsedSysDeviceAddrRoots});
            }
        }

        if (sysDeviceRootHDNode === null) {
            // Not all system device addresses root HD extended keys could be created
            return false;
        }

        // Create system funding payment root HD extended key
        path = sysRootPath + '/1/0';
        const sysFundingPaymentRootHDNode = sysFundingRootHDNode.derive(0);

        if (sysFundingPaymentRootHDNode.index !== 0) {
            Catenis.logger.WARN(util.format('System funding payment root HD extended key (%s) derived with an unexpected index', path), {expectedIndex: 0, returnedIndex: sysFundingPaymentRootHDNode.index});
            return false;
        }

        // Save newly created HD extended key to store it later
        hdNodesToStore.push({type: 'sys_fund_pay_root', path: path, hdNode: sysFundingPaymentRootHDNode, isLeaf: false, isReserved: false});

        // Create system funding change root HD extended key
        path = sysRootPath + '/1/1';
        const sysFundingChangeRootHDNode = sysFundingRootHDNode.derive(1);

        if (sysFundingChangeRootHDNode.index !== 1) {
            Catenis.logger.WARN(util.format('System funding change root HD extended key (%s) derived with an unexpected index', path), {expectedIndex: 1, returnedIndex: sysFundingChangeRootHDNode.index});
            return false;
        }

        // Save newly created HD extended key to store it later
        hdNodesToStore.push({type: 'sys_fund_chg_root', path: path, hdNode: sysFundingChangeRootHDNode, isLeaf: false, isReserved: false});

        // Create system read confirmation spend root HD extended key
        path = sysRootPath + '/3/0';
        const sysReadConfSpendRootHDNode = sysReadConfRootHDNode.derive(0);

        if (sysReadConfSpendRootHDNode.index !== 0) {
            Catenis.logger.WARN(util.format('System read confirmation spend root HD extended key (%s) derived with an unexpected index', path), {expectedIndex: 0, returnedIndex: sysReadConfSpendRootHDNode.index});
            return false;
        }

        // Save newly created HD extended key to store it later
        hdNodesToStore.push({type: 'sys_read_conf_spnd_root', path: path, hdNode: sysReadConfSpendRootHDNode, isLeaf: false, isReserved: false});

        // Create system read confirmation pay tx expense root HD extended key
        path = sysRootPath + '/3/1';
        const sysReadConfPayTxExpRootHDNode = sysReadConfRootHDNode.derive(1);

        if (sysReadConfPayTxExpRootHDNode.index !== 1) {
            Catenis.logger.WARN(util.format('System read confirmation pay tx expense root HD extended key (%s) derived with an unexpected index', path), {expectedIndex: 1, returnedIndex: sysReadConfPayTxExpRootHDNode.index});
            return false;
        }

        // Save newly created HD extended key to store it later
        hdNodesToStore.push({type: 'sys_read_conf_pay_tx_exp_root', path: path, hdNode: sysReadConfPayTxExpRootHDNode, isLeaf: false, isReserved: false});

        // Create system read confirmation spend notify root HD extended key
        path = sysRootPath + '/3/0/0';
        const sysReadConfSpendNotifyRootHDNode = sysReadConfSpendRootHDNode.derive(0);

        if (sysReadConfSpendNotifyRootHDNode.index !== 0) {
            Catenis.logger.WARN(util.format('System read confirmation spend notify root HD extended key (%s) derived with an unexpected index', path), {expectedIndex: 0, returnedIndex: sysReadConfSpendNotifyRootHDNode.index});
            return false;
        }

        // Save newly created HD extended key to store it later
        hdNodesToStore.push({type: 'sys_read_conf_spnd_ntfy_root', path: path, hdNode: sysReadConfSpendNotifyRootHDNode, isLeaf: false, isReserved: false});

        // Create system read confirmation spend only root HD extended key
        path = sysRootPath + '/3/0/1';
        const sysReadConfSpendOnlyRootHDNode = sysReadConfSpendRootHDNode.derive(1);

        if (sysReadConfSpendOnlyRootHDNode.index !== 1) {
            Catenis.logger.WARN(util.format('System read confirmation spend only root HD extended key (%s) derived with an unexpected index', path), {expectedIndex: 1, returnedIndex: sysReadConfSpendOnlyRootHDNode.index});
            return false;
        }

        // Save newly created HD extended key to store it later
        hdNodesToStore.push({type: 'sys_read_conf_spnd_only_root', path: path, hdNode: sysReadConfSpendOnlyRootHDNode, isLeaf: false, isReserved: false});

        // Create system read confirmation spend null root HD extended key
        path = sysRootPath + '/3/0/2';
        const sysReadConfSpendNullRootHDNode = sysReadConfSpendRootHDNode.derive(2);

        if (sysReadConfSpendNullRootHDNode.index !== 2) {
            Catenis.logger.WARN(util.format('System read confirmation spend null root HD extended key (%s) derived with an unexpected index', path), {expectedIndex: 2, returnedIndex: sysReadConfSpendNullRootHDNode.index});
            return false;
        }

        // Save newly created HD extended key to store it later
        hdNodesToStore.push({type: 'sys_read_conf_spnd_null_root', path: path, hdNode: sysReadConfSpendNullRootHDNode, isLeaf: false, isReserved: false});

        // Create system service credit root HD extended key
        path = sysRootPath + '/4/0';
        const sysServCreditRootHDNode = sysAssetRootHDNode.derive(0);

        if (sysServCreditRootHDNode.index !== 0) {
            Catenis.logger.WARN(util.format('System service credit root HD extended key (%s) derived with an unexpected index', path), {expectedIndex: 0, returnedIndex: sysServCreditRootHDNode.index});
            return false;
        }

        // Save newly created HD extended key to store it later
        hdNodesToStore.push({type: 'sys_serv_cred_root', path: path, hdNode: sysServCreditRootHDNode, isLeaf: false, isReserved: false});

        // Create system multi-signature Colored Coins tx output signee root HD extended key
        path = sysRootPath + '/4/1';
        const sysMultiSigSigneeRootHDNode = sysAssetRootHDNode.derive(1);

        if (sysMultiSigSigneeRootHDNode.index !== 1) {
            Catenis.logger.WARN(util.format('System multi-signature Colored Coins tx output signee root HD extended key (%s) derived with an unexpected index', path), {expectedIndex: 1, returnedIndex: sysMultiSigSigneeRootHDNode.index});
            return false;
        }

        // Save newly created HD extended key to store it later
        hdNodesToStore.push({type: 'sys_msig_sign_root', path: path, hdNode: sysMultiSigSigneeRootHDNode, isLeaf: false, isReserved: false});

        // Create system service credit issuance root HD extended key
        path = sysRootPath + '/4/0/0';
        const sysServCredIssueRootHDNode = sysServCreditRootHDNode.derive(0);

        if (sysServCredIssueRootHDNode.index !== 0) {
            Catenis.logger.WARN(util.format('System service credit issuance root HD extended key (%s) derived with an unexpected index', path), {expectedIndex: 0, returnedIndex: sysServCredIssueRootHDNode.index});
            return false;
        }

        // Save newly created HD extended key to store it later
        hdNodesToStore.push({type: 'sys_serv_cred_issu_root', path: path, hdNode: sysServCredIssueRootHDNode, isLeaf: false, isReserved: false});
        
        // Create system service payment pay tx expense root HD extended key
        path = sysRootPath + '/4/0/1';
        const sysServPymtPayTxExpRootHDNode = sysServCreditRootHDNode.derive(1);

        if (sysServPymtPayTxExpRootHDNode.index !== 1) {
            Catenis.logger.WARN(util.format('System service payment pay tx expense root HD extended key (%s) derived with an unexpected index', path), {expectedIndex: 1, returnedIndex: sysServPymtPayTxExpRootHDNode.index});
            return false;
        }

        // Save newly created HD extended key to store it later
        hdNodesToStore.push({type: 'sys_serv_pymt_pay_tx_exp_root', path: path, hdNode: sysServPymtPayTxExpRootHDNode, isLeaf: false, isReserved: false});

        // Create system off-chain messages settlement pay tx expense root HD extended key
        path = sysRootPath + '/6/0';
        const sysOCMsgsSetlmtPayTxExpRootHDNode = sysOCMsgsSettleRootHDNode.derive(0);

        if (sysOCMsgsSetlmtPayTxExpRootHDNode.index !== 0) {
            Catenis.logger.WARN(util.format('System off-chain messages settlement pay tx expense root HD extended key (%s) derived with an unexpected index', path), {expectedIndex: 0, returnedIndex: sysOCMsgsSetlmtPayTxExpRootHDNode.index});
            return false;
        }

        // Save newly created HD extended key to store it later
        hdNodesToStore.push({type: 'sys_oc_msg_setlmt_pay_tx_exp_root', path: path, hdNode: sysOCMsgsSetlmtPayTxExpRootHDNode, isLeaf: false, isReserved: false});

        // Make sure that the following entries are only created for Catenis Hub node
        if (ctnNodeIndex === 0) {
            // Create system BCOT token sale root HD extended key
            path = sysRootPath + '/5';
            const sysBcotSaleRootHDNode = sysRootHDNode.derive(5);

            if (sysBcotSaleRootHDNode.index !== 5) {
                Catenis.logger.WARN(util.format('System BCOT token sale root HD extended key (%s) derived with an unexpected index', path), {expectedIndex: 5, returnedIndex: sysBcotSaleRootHDNode.index});
                return false;
            }

            // Save newly created HD extended key to store it later
            hdNodesToStore.push({type: 'sys_bcot_sale_root', path: path, hdNode: sysBcotSaleRootHDNode, isLeaf: false, isReserved: false});

            // Create system BCOT token sale stock root HD extended key
            path = sysRootPath + '/5/0';
            const sysBcotSaleStockRootHDNode = sysBcotSaleRootHDNode.derive(0);

            if (sysBcotSaleStockRootHDNode.index !== 0) {
                Catenis.logger.WARN(util.format('System BCOT token sale stock root HD extended key (%s) derived with an unexpected index', path), {
                    expectedIndex: 0,
                    returnedIndex: sysBcotSaleStockRootHDNode.index
                });
                return false;
            }

            // Save newly created HD extended key to store it later
            hdNodesToStore.push({type: 'sys_bcot_sale_stck_root', path: path, hdNode: sysBcotSaleStockRootHDNode, isLeaf: false, isReserved: false});
        }

        // Store all newly created HD extended keys
        hdNodesToStore.forEach((hdNodeToStore) => {
            storeHDNode.call(this, hdNodeToStore.type, hdNodeToStore.path, hdNodeToStore.hdNode, {
                isLeaf: hdNodeToStore.isLeaf,
                isReserved: hdNodeToStore.isReserved
            });
        });
    }

    // Catenis node HD nodes successfully initialized
    return true;
};

KeyStore.prototype.getSystemFundingPaymentAddressKeys = function (ctnNodeIndex, addrIndex, btcAddressType, isObsolete = false) {
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
    let sysFundingPaymentAddrHDNode = retrieveHDNode.call(this, sysFundingPaymentAddrPath, true),
        sysFundingPaymentAddrKeys = null;

    if (sysFundingPaymentAddrHDNode === null) {
        // System funding payment address HD extended key does not exist yet.
        //  Retrieve parent root HD extended key to create it
        const path = parentPath(sysFundingPaymentAddrPath);
        let sysFundingPaymentRootHDNode = retrieveHDNode.call(this, path);

        if (sysFundingPaymentRootHDNode === null) {
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

        if (sysFundingPaymentRootHDNode === null) {
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
                storeHDNode.call(this, 'sys_fund_pay_addr', sysFundingPaymentAddrPath, sysFundingPaymentAddrHDNode, {
                    isLeaf: true,
                    isReserved: false,
                    isObsolete: isObsolete,
                    btcAddressType: btcAddressType
                });
            }
        }
    }
    else {
        btcAddressType = sysFundingPaymentAddrHDNode.btcAddressType;
        sysFundingPaymentAddrHDNode = sysFundingPaymentAddrHDNode.hdNode;
    }

    if (sysFundingPaymentAddrHDNode !== null) {
        sysFundingPaymentAddrKeys = new CryptoKeys(sysFundingPaymentAddrHDNode, btcAddressType);
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

    if (fromAddrIndex !== undefined) {
        if (!isValidAddressIndex(fromAddrIndex)) {
            errArg.fromAddrIndex = fromAddrIndex;
        }
        else {
            queryTerms.push({index: {$gte: fromAddrIndex}});
        }
    }

    if (toAddrIndex !== undefined) {
        if (!isValidAddressIndex(toAddrIndex) || (fromAddrIndex !== undefined && toAddrIndex < fromAddrIndex)) {
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

KeyStore.prototype.getSystemFundingChangeAddressKeys = function (ctnNodeIndex, addrIndex, btcAddressType, isObsolete = false) {
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
    let sysFundingChangeAddrHDNode = retrieveHDNode.call(this, sysFundingChangeAddrPath, true),
        sysFundingChangeAddrKeys = null;

    if (sysFundingChangeAddrHDNode === null) {
        // System funding change address HD extended key does not exist yet.
        //  Retrieve parent root HD extended key to create it
        const path = parentPath(sysFundingChangeAddrPath);
        let sysFundingChangeRootHDNode = retrieveHDNode.call(this, path);

        if (sysFundingChangeRootHDNode === null) {
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

        if (sysFundingChangeRootHDNode === null) {
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
                storeHDNode.call(this, 'sys_fund_chg_addr', sysFundingChangeAddrPath, sysFundingChangeAddrHDNode, {
                    isLeaf: true,
                    isReserved: false,
                    isObsolete: isObsolete,
                    btcAddressType: btcAddressType
                });
            }
        }
    }
    else {
        btcAddressType = sysFundingChangeAddrHDNode.btcAddressType;
        sysFundingChangeAddrHDNode = sysFundingChangeAddrHDNode.hdNode;
    }

    if (sysFundingChangeAddrHDNode !== null) {
        sysFundingChangeAddrKeys = new CryptoKeys(sysFundingChangeAddrHDNode, btcAddressType);
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

    if (fromAddrIndex !== undefined) {
        if (!isValidAddressIndex(fromAddrIndex)) {
            errArg.fromAddrIndex = fromAddrIndex;
        }
        else {
            queryTerms.push({index: {$gte: fromAddrIndex}});
        }
    }

    if (toAddrIndex !== undefined) {
        if (!isValidAddressIndex(toAddrIndex) || (fromAddrIndex !== undefined && toAddrIndex < fromAddrIndex)) {
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

KeyStore.prototype.getSystemPayTxExpenseAddressKeys = function (ctnNodeIndex, addrIndex, btcAddressType, isObsolete = false) {
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
    let sysPayTxExpenseAddrHDNode = retrieveHDNode.call(this, sysPayTxExpenseAddrPath, true),
        sysPayTxExpenseAddrKeys = null;

    if (sysPayTxExpenseAddrHDNode === null) {
        // System pay tx expense address HD extended key does not exist yet.
        //  Retrieve parent root HD extended key to create it
        const path = parentPath(sysPayTxExpenseAddrPath);
        let sysPayTxExpenseRootHDNode = retrieveHDNode.call(this, path);

        if (sysPayTxExpenseRootHDNode === null) {
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

        if (sysPayTxExpenseRootHDNode === null) {
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
                storeHDNode.call(this, 'sys_pay_tx_exp_addr', sysPayTxExpenseAddrPath, sysPayTxExpenseAddrHDNode, {
                    isLeaf: true,
                    isReserved: false,
                    isObsolete: isObsolete,
                    btcAddressType: btcAddressType
                });
            }
        }
    }
    else {
        btcAddressType = sysPayTxExpenseAddrHDNode.btcAddressType;
        sysPayTxExpenseAddrHDNode = sysPayTxExpenseAddrHDNode.hdNode;
    }

    if (sysPayTxExpenseAddrHDNode !== null) {
        sysPayTxExpenseAddrKeys = new CryptoKeys(sysPayTxExpenseAddrHDNode, btcAddressType);
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

    if (fromAddrIndex !== undefined) {
        if (!isValidAddressIndex(fromAddrIndex)) {
            errArg.fromAddrIndex = fromAddrIndex;
        }
        else {
            queryTerms.push({index: {$gte: fromAddrIndex}});
        }
    }

    if (toAddrIndex !== undefined) {
        if (!isValidAddressIndex(toAddrIndex) || (fromAddrIndex !== undefined && toAddrIndex < fromAddrIndex)) {
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

KeyStore.prototype.getSystemReadConfirmSpendNotifyAddressKeys = function (ctnNodeIndex, addrIndex, btcAddressType, isObsolete = false) {
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

        Catenis.logger.ERROR(util.format('KeyStore.getSystemReadConfirmSpendNotifyAddressKeys method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    // Try to retrieve system read confirmation spend notify address HD extended key for given Catenis node with the given index
    const sysReadConfSpendNotifyAddrPath = util.format('m/%d/0/3/0/0/%d', ctnNodeIndex, addrIndex);
    let sysReadConfSpendNotifyAddrHDNode = retrieveHDNode.call(this, sysReadConfSpendNotifyAddrPath, true),
        sysReadConfSpendNotifyAddrKeys = null;

    if (sysReadConfSpendNotifyAddrHDNode === null) {
        // System read confirmation spend notify address HD extended key does not exist yet.
        //  Retrieve parent root HD extended key to create it
        const path = parentPath(sysReadConfSpendNotifyAddrPath);
        let sysReadConfSpendNotifyRootHDNode = retrieveHDNode.call(this, path);

        if (sysReadConfSpendNotifyRootHDNode === null) {
            // System read confirmation spend notify root HD extended key does not exist yet.
            //  Try to initialize Catenis node HD extended keys
            if (! this.initCatenisNodeHDNodes(ctnNodeIndex)) {
                Catenis.logger.ERROR(util.format('HD extended keys for Catenis node with index %d could not be initialized', ctnNodeIndex));
            }
            else {
                // Catenis node HD extended keys successfully initialized.
                //  Try to retrieve system read confirmation spend notify root HD extended key again
                sysReadConfSpendNotifyRootHDNode = retrieveHDNode.call(this, path);
            }
        }

        if (sysReadConfSpendNotifyRootHDNode === null) {
            Catenis.logger.ERROR(util.format('System read confirmation spend notify root HD extended key (%s) for Catenis node with index %d not found', path, ctnNodeIndex));
        }
        else {
            // Try to create system read confirmation spend notify address HD extended key now
            sysReadConfSpendNotifyAddrHDNode = sysReadConfSpendNotifyRootHDNode.derive(addrIndex);

            if (sysReadConfSpendNotifyAddrHDNode.index !== addrIndex) {
                Catenis.logger.WARN(util.format('System read confirmation spend notify address HD extended key (%s) derived with an unexpected index', sysReadConfSpendNotifyAddrPath), {expectedIndex: addrIndex, returnedIndex: sysReadConfSpendNotifyAddrHDNode.index});
                sysReadConfSpendNotifyAddrHDNode = null;
            }
            else {
                // Store created HD extended key
                storeHDNode.call(this, 'sys_read_conf_spnd_ntfy_addr', sysReadConfSpendNotifyAddrPath, sysReadConfSpendNotifyAddrHDNode, {
                    isLeaf: true,
                    isReserved: false,
                    isObsolete: isObsolete,
                    btcAddressType: btcAddressType
                });
            }
        }
    }
    else {
        btcAddressType = sysReadConfSpendNotifyAddrHDNode.btcAddressType;
        sysReadConfSpendNotifyAddrHDNode = sysReadConfSpendNotifyAddrHDNode.hdNode;
    }

    if (sysReadConfSpendNotifyAddrHDNode !== null) {
        sysReadConfSpendNotifyAddrKeys = new CryptoKeys(sysReadConfSpendNotifyAddrHDNode, btcAddressType);
    }

    return sysReadConfSpendNotifyAddrKeys;
};

KeyStore.prototype.listSystemReadConfirmSpendNotifyAddresses = function (ctnNodeIndex, fromAddrIndex, toAddrIndex, onlyInUse) {
    // Validate arguments
    const errArg = {},
        queryTerms = [{parentPath: util.format('m/%d/0/3/0/0', ctnNodeIndex)}];

    if (!isValidCatenisNodeIndex(ctnNodeIndex)) {
        errArg.ctnNodeIndex = ctnNodeIndex;
    }

    if (fromAddrIndex !== undefined) {
        if (!isValidAddressIndex(fromAddrIndex)) {
            errArg.fromAddrIndex = fromAddrIndex;
        }
        else {
            queryTerms.push({index: {$gte: fromAddrIndex}});
        }
    }

    if (toAddrIndex !== undefined) {
        if (!isValidAddressIndex(toAddrIndex) || (fromAddrIndex !== undefined && toAddrIndex < fromAddrIndex)) {
            errArg.toAddrIndex = toAddrIndex;
        }
        else {
            queryTerms.push({index: {$lte: toAddrIndex}});
        }
    }

    if (Object.keys(errArg).length > 0) {
        const errArgs = Object.keys(errArg);

        Catenis.logger.ERROR(util.format('KeyStore.listSystemReadConfirmSpendNotifyAddresses method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    if (onlyInUse) {
        queryTerms.push({isObsolete: false});
    }

    // Return existing system read confirmation spend notify addresses within the specified range
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

KeyStore.prototype.listSystemReadConfirmSpendNotifyAddressesInUse = function (ctnNodeIndex, fromAddrIndex, toAddrIndex) {
    return this.listSystemReadConfirmSpendNotifyAddresses(ctnNodeIndex, fromAddrIndex, toAddrIndex);
};

KeyStore.prototype.getSystemReadConfirmSpendOnlyAddressKeys = function (ctnNodeIndex, addrIndex, btcAddressType, isObsolete = false) {
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

        Catenis.logger.ERROR(util.format('KeyStore.getSystemReadConfirmSpendOnlyAddressKeys method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    // Try to retrieve system read confirmation spend only address HD extended key for given Catenis node with the given index
    const sysReadConfSpendOnlyAddrPath = util.format('m/%d/0/3/0/1/%d', ctnNodeIndex, addrIndex);
    let sysReadConfSpendOnlyAddrHDNode = retrieveHDNode.call(this, sysReadConfSpendOnlyAddrPath, true),
        sysReadConfSpendOnlyAddrKeys = null;

    if (sysReadConfSpendOnlyAddrHDNode === null) {
        // System read confirmation spend only address HD extended key does not exist yet.
        //  Retrieve parent root HD extended key to create it
        const path = parentPath(sysReadConfSpendOnlyAddrPath);
        let sysReadConfSpendOnlyRootHDNode = retrieveHDNode.call(this, path);

        if (sysReadConfSpendOnlyRootHDNode === null) {
            // System read confirmation spend only root HD extended key does not exist yet.
            //  Try to initialize Catenis node HD extended keys
            if (! this.initCatenisNodeHDNodes(ctnNodeIndex)) {
                Catenis.logger.ERROR(util.format('HD extended keys for Catenis node with index %d could not be initialized', ctnNodeIndex));
            }
            else {
                // Catenis node HD extended keys successfully initialized.
                //  Try to retrieve system read confirmation spend only root HD extended key again
                sysReadConfSpendOnlyRootHDNode = retrieveHDNode.call(this, path);
            }
        }

        if (sysReadConfSpendOnlyRootHDNode === null) {
            Catenis.logger.ERROR(util.format('System read confirmation spend only root HD extended key (%s) for Catenis node with index %d not found', path, ctnNodeIndex));
        }
        else {
            // Try to create system read confirmation spend only address HD extended key now
            sysReadConfSpendOnlyAddrHDNode = sysReadConfSpendOnlyRootHDNode.derive(addrIndex);

            if (sysReadConfSpendOnlyAddrHDNode.index !== addrIndex) {
                Catenis.logger.WARN(util.format('System read confirmation spend only address HD extended key (%s) derived with an unexpected index', sysReadConfSpendOnlyAddrPath), {expectedIndex: addrIndex, returnedIndex: sysReadConfSpendOnlyAddrHDNode.index});
                sysReadConfSpendOnlyAddrHDNode = null;
            }
            else {
                // Store created HD extended key
                storeHDNode.call(this, 'sys_read_conf_spnd_only_addr', sysReadConfSpendOnlyAddrPath, sysReadConfSpendOnlyAddrHDNode, {
                    isLeaf: true,
                    isReserved: false,
                    isObsolete: isObsolete,
                    btcAddressType: btcAddressType
                });
            }
        }
    }
    else {
        btcAddressType = sysReadConfSpendOnlyAddrHDNode.btcAddressType;
        sysReadConfSpendOnlyAddrHDNode = sysReadConfSpendOnlyAddrHDNode.hdNode;
    }

    if (sysReadConfSpendOnlyAddrHDNode !== null) {
        sysReadConfSpendOnlyAddrKeys = new CryptoKeys(sysReadConfSpendOnlyAddrHDNode, btcAddressType);
    }

    return sysReadConfSpendOnlyAddrKeys;
};

KeyStore.prototype.listSystemReadConfirmSpendOnlyAddresses = function (ctnNodeIndex, fromAddrIndex, toAddrIndex, onlyInUse) {
    // Validate arguments
    const errArg = {},
        queryTerms = [{parentPath: util.format('m/%d/0/3/0/1', ctnNodeIndex)}];

    if (!isValidCatenisNodeIndex(ctnNodeIndex)) {
        errArg.ctnNodeIndex = ctnNodeIndex;
    }

    if (fromAddrIndex !== undefined) {
        if (!isValidAddressIndex(fromAddrIndex)) {
            errArg.fromAddrIndex = fromAddrIndex;
        }
        else {
            queryTerms.push({index: {$gte: fromAddrIndex}});
        }
    }

    if (toAddrIndex !== undefined) {
        if (!isValidAddressIndex(toAddrIndex) || (fromAddrIndex !== undefined && toAddrIndex < fromAddrIndex)) {
            errArg.toAddrIndex = toAddrIndex;
        }
        else {
            queryTerms.push({index: {$lte: toAddrIndex}});
        }
    }

    if (Object.keys(errArg).length > 0) {
        const errArgs = Object.keys(errArg);

        Catenis.logger.ERROR(util.format('KeyStore.listSystemReadConfirmSpendOnlyAddresses method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    if (onlyInUse) {
        queryTerms.push({isObsolete: false});
    }

    // Return existing system read confirmation spend only addresses within the specified range
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

KeyStore.prototype.listSystemReadConfirmSpendOnlyAddressesInUse = function (ctnNodeIndex, fromAddrIndex, toAddrIndex) {
    return this.listSystemReadConfirmSpendOnlyAddresses(ctnNodeIndex, fromAddrIndex, toAddrIndex);
};

KeyStore.prototype.getSystemReadConfirmSpendNullAddressKeys = function (ctnNodeIndex, addrIndex, btcAddressType, isObsolete = false) {
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

        Catenis.logger.ERROR(util.format('KeyStore.getSystemReadConfirmSpendNullAddressKeys method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    // Try to retrieve system read confirmation spend null address HD extended key for given Catenis node with the given index
    const sysReadConfSpendNullAddrPath = util.format('m/%d/0/3/0/2/%d', ctnNodeIndex, addrIndex);
    let sysReadConfSpendNullAddrHDNode = retrieveHDNode.call(this, sysReadConfSpendNullAddrPath, true),
        sysReadConfSpendNullAddrKeys = null;

    if (sysReadConfSpendNullAddrHDNode === null) {
        // System read confirmation spend null address HD extended key does not exist yet.
        //  Retrieve parent root HD extended key to create it
        const path = parentPath(sysReadConfSpendNullAddrPath);
        let sysReadConfSpendNullRootHDNode = retrieveHDNode.call(this, path);

        if (sysReadConfSpendNullRootHDNode === null) {
            // System read confirmation spend null root HD extended key does not exist yet.
            //  Try to initialize Catenis node HD extended keys
            if (! this.initCatenisNodeHDNodes(ctnNodeIndex)) {
                Catenis.logger.ERROR(util.format('HD extended keys for Catenis node with index %d could not be initialized', ctnNodeIndex));
            }
            else {
                // Catenis node HD extended keys successfully initialized.
                //  Try to retrieve system read confirmation spend null root HD extended key again
                sysReadConfSpendNullRootHDNode = retrieveHDNode.call(this, path);
            }
        }

        if (sysReadConfSpendNullRootHDNode === null) {
            Catenis.logger.ERROR(util.format('System read confirmation spend null root HD extended key (%s) for Catenis node with index %d not found', path, ctnNodeIndex));
        }
        else {
            // Try to create system read confirmation spend null address HD extended key now
            sysReadConfSpendNullAddrHDNode = sysReadConfSpendNullRootHDNode.derive(addrIndex);

            if (sysReadConfSpendNullAddrHDNode.index !== addrIndex) {
                Catenis.logger.WARN(util.format('System read confirmation spend null address HD extended key (%s) derived with an unexpected index', sysReadConfSpendNullAddrPath), {expectedIndex: addrIndex, returnedIndex: sysReadConfSpendNullAddrHDNode.index});
                sysReadConfSpendNullAddrHDNode = null;
            }
            else {
                // Store created HD extended key
                storeHDNode.call(this, 'sys_read_conf_spnd_null_addr', sysReadConfSpendNullAddrPath, sysReadConfSpendNullAddrHDNode, {
                    isLeaf: true,
                    isReserved: false,
                    isObsolete: isObsolete,
                    btcAddressType: btcAddressType
                });
            }
        }
    }
    else {
        btcAddressType = sysReadConfSpendNullAddrHDNode.btcAddressType;
        sysReadConfSpendNullAddrHDNode = sysReadConfSpendNullAddrHDNode.hdNode;
    }

    if (sysReadConfSpendNullAddrHDNode !== null) {
        sysReadConfSpendNullAddrKeys = new CryptoKeys(sysReadConfSpendNullAddrHDNode, btcAddressType);
    }

    return sysReadConfSpendNullAddrKeys;
};

KeyStore.prototype.listSystemReadConfirmSpendNullAddresses = function (ctnNodeIndex, fromAddrIndex, toAddrIndex, onlyInUse) {
    // Validate arguments
    const errArg = {},
        queryTerms = [{parentPath: util.format('m/%d/0/3/0/2', ctnNodeIndex)}];

    if (!isValidCatenisNodeIndex(ctnNodeIndex)) {
        errArg.ctnNodeIndex = ctnNodeIndex;
    }

    if (fromAddrIndex !== undefined) {
        if (!isValidAddressIndex(fromAddrIndex)) {
            errArg.fromAddrIndex = fromAddrIndex;
        }
        else {
            queryTerms.push({index: {$gte: fromAddrIndex}});
        }
    }

    if (toAddrIndex !== undefined) {
        if (!isValidAddressIndex(toAddrIndex) || (fromAddrIndex !== undefined && toAddrIndex < fromAddrIndex)) {
            errArg.toAddrIndex = toAddrIndex;
        }
        else {
            queryTerms.push({index: {$lte: toAddrIndex}});
        }
    }

    if (Object.keys(errArg).length > 0) {
        const errArgs = Object.keys(errArg);

        Catenis.logger.ERROR(util.format('KeyStore.listSystemReadConfirmSpendNullAddresses method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    if (onlyInUse) {
        queryTerms.push({isObsolete: false});
    }

    // Return existing system read confirmation spend null addresses within the specified range
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

KeyStore.prototype.listSystemReadConfirmSpendNullAddressesInUse = function (ctnNodeIndex, fromAddrIndex, toAddrIndex) {
    return this.listSystemReadConfirmSpendNullAddresses(ctnNodeIndex, fromAddrIndex, toAddrIndex);
};

KeyStore.prototype.getSystemReadConfirmPayTxExpenseAddressKeys = function (ctnNodeIndex, addrIndex, btcAddressType, isObsolete = false) {
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

        Catenis.logger.ERROR(util.format('KeyStore.getSystemReadConfirmPayTxExpenseAddressKeys method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    // Try to retrieve system read confirmation pay tx expense address HD extended key for given Catenis node with the given index
    const sysReadConfPayTxExpenseAddrPath = util.format('m/%d/0/3/1/%d', ctnNodeIndex, addrIndex);
    let sysReadConfPayTxExpenseAddrHDNode = retrieveHDNode.call(this, sysReadConfPayTxExpenseAddrPath, true),
        sysReadConfPayTxExpenseAddrKeys = null;

    if (sysReadConfPayTxExpenseAddrHDNode === null) {
        // System read confirmation pay tx expense address HD extended key does not exist yet.
        //  Retrieve parent root HD extended key to create it
        const path = parentPath(sysReadConfPayTxExpenseAddrPath);
        let sysReadConfPayTxExpenseRootHDNode = retrieveHDNode.call(this, path);

        if (sysReadConfPayTxExpenseRootHDNode === null) {
            // System read confirmation pay tx expense root HD extended key does not exist yet.
            //  Try to initialize Catenis node HD extended keys
            if (! this.initCatenisNodeHDNodes(ctnNodeIndex)) {
                Catenis.logger.ERROR(util.format('HD extended keys for Catenis node with index %d could not be initialized', ctnNodeIndex));
            }
            else {
                // Catenis node HD extended keys successfully initialized.
                //  Try to retrieve system read confirmation pay tx expense root HD extended key again
                sysReadConfPayTxExpenseRootHDNode = retrieveHDNode.call(this, path);
            }
        }

        if (sysReadConfPayTxExpenseRootHDNode === null) {
            Catenis.logger.ERROR(util.format('System read confirmation pay tx expense root HD extended key (%s) for Catenis node with index %d not found', path, ctnNodeIndex));
        }
        else {
            // Try to create system read confirmation pay tx expense address HD extended key now
            sysReadConfPayTxExpenseAddrHDNode = sysReadConfPayTxExpenseRootHDNode.derive(addrIndex);

            if (sysReadConfPayTxExpenseAddrHDNode.index !== addrIndex) {
                Catenis.logger.WARN(util.format('System read confirmation pay tx expense address HD extended key (%s) derived with an unexpected index', sysReadConfPayTxExpenseAddrPath), {expectedIndex: addrIndex, returnedIndex: sysReadConfPayTxExpenseAddrHDNode.index});
                sysReadConfPayTxExpenseAddrHDNode = null;
            }
            else {
                // Store created HD extended key
                storeHDNode.call(this, 'sys_read_conf_pay_tx_exp_addr', sysReadConfPayTxExpenseAddrPath, sysReadConfPayTxExpenseAddrHDNode, {
                    isLeaf: true,
                    isReserved: false,
                    isObsolete: isObsolete,
                    btcAddressType: btcAddressType
                });
            }
        }
    }
    else {
        btcAddressType = sysReadConfPayTxExpenseAddrHDNode.btcAddressType;
        sysReadConfPayTxExpenseAddrHDNode = sysReadConfPayTxExpenseAddrHDNode.hdNode;
    }

    if (sysReadConfPayTxExpenseAddrHDNode !== null) {
        sysReadConfPayTxExpenseAddrKeys = new CryptoKeys(sysReadConfPayTxExpenseAddrHDNode, btcAddressType);
    }

    return sysReadConfPayTxExpenseAddrKeys;
};

KeyStore.prototype.listSystemReadConfirmPayTxExpenseAddresses = function (ctnNodeIndex, fromAddrIndex, toAddrIndex, onlyInUse) {
    // Validate arguments
    const errArg = {},
        queryTerms = [{parentPath: util.format('m/%d/0/3/1', ctnNodeIndex)}];

    if (!isValidCatenisNodeIndex(ctnNodeIndex)) {
        errArg.ctnNodeIndex = ctnNodeIndex;
    }

    if (fromAddrIndex !== undefined) {
        if (!isValidAddressIndex(fromAddrIndex)) {
            errArg.fromAddrIndex = fromAddrIndex;
        }
        else {
            queryTerms.push({index: {$gte: fromAddrIndex}});
        }
    }

    if (toAddrIndex !== undefined) {
        if (!isValidAddressIndex(toAddrIndex) || (fromAddrIndex !== undefined && toAddrIndex < fromAddrIndex)) {
            errArg.toAddrIndex = toAddrIndex;
        }
        else {
            queryTerms.push({index: {$lte: toAddrIndex}});
        }
    }

    if (Object.keys(errArg).length > 0) {
        const errArgs = Object.keys(errArg);

        Catenis.logger.ERROR(util.format('KeyStore.listSystemReadConfirmPayTxExpenseAddresses method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    if (onlyInUse) {
        queryTerms.push({isObsolete: false});
    }

    // Return existing system read confirmation pay tx expense addresses within the specified range
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

KeyStore.prototype.listSystemReadConfirmPayTxExpenseAddressesInUse = function (ctnNodeIndex, fromAddrIndex, toAddrIndex) {
    return this.listSystemReadConfirmPayTxExpenseAddresses(ctnNodeIndex, fromAddrIndex, toAddrIndex);
};

KeyStore.prototype.getSystemServiceCreditIssuingAddressKeys = function (ctnNodeIndex, addrIndex, btcAddressType, isObsolete = false) {
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

        Catenis.logger.ERROR(util.format('KeyStore.getSystemServiceCreditIssuingAddressKeys method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    // Try to retrieve system service credit issuance address HD extended key for given Catenis node with the given index
    const sysServCredIssueAddrPath = util.format('m/%d/0/4/0/0/%d', ctnNodeIndex, addrIndex);
    let sysServCredIssueAddrHDNode = retrieveHDNode.call(this, sysServCredIssueAddrPath, true),
        sysServCredIssueAddrKeys = null;

    if (sysServCredIssueAddrHDNode === null) {
        // System service credit issuance address HD extended key does not exist yet.
        //  Retrieve parent root HD extended key to create it
        const path = parentPath(sysServCredIssueAddrPath);
        let sysServCredIssueRootHDNode = retrieveHDNode.call(this, path);

        if (sysServCredIssueRootHDNode === null) {
            // System service credit issuance root HD extended key does not exist yet.
            //  Try to initialize Catenis node HD extended keys
            if (! this.initCatenisNodeHDNodes(ctnNodeIndex)) {
                Catenis.logger.ERROR(util.format('HD extended keys for Catenis node with index %d could not be initialized', ctnNodeIndex));
            }
            else {
                // Catenis node HD extended keys successfully initialized.
                //  Try to retrieve system service credit issuance root HD extended key again
                sysServCredIssueRootHDNode = retrieveHDNode.call(this, path);
            }
        }

        if (sysServCredIssueRootHDNode === null) {
            Catenis.logger.ERROR(util.format('System service credit issuance root HD extended key (%s) for Catenis node with index %d not found', path, ctnNodeIndex));
        }
        else {
            // Try to create system service credit issuance address HD extended key now
            sysServCredIssueAddrHDNode = sysServCredIssueRootHDNode.derive(addrIndex);

            if (sysServCredIssueAddrHDNode.index !== addrIndex) {
                Catenis.logger.WARN(util.format('System service credit issuance address HD extended key (%s) derived with an unexpected index', sysServCredIssueAddrPath), {expectedIndex: addrIndex, returnedIndex: sysServCredIssueAddrHDNode.index});
                sysServCredIssueAddrHDNode = null;
            }
            else {
                // Store created HD extended key
                storeHDNode.call(this, 'sys_serv_cred_issu_addr', sysServCredIssueAddrPath, sysServCredIssueAddrHDNode, {
                    isLeaf: true,
                    isReserved: false,
                    isObsolete: isObsolete,
                    btcAddressType: btcAddressType
                });
            }
        }
    }
    else {
        btcAddressType = sysServCredIssueAddrHDNode.btcAddressType;
        sysServCredIssueAddrHDNode = sysServCredIssueAddrHDNode.hdNode;
    }

    if (sysServCredIssueAddrHDNode !== null) {
        sysServCredIssueAddrKeys = new CryptoKeys(sysServCredIssueAddrHDNode, btcAddressType, addressEncryptionScheme(sysServCredIssueAddrPath));
    }

    return sysServCredIssueAddrKeys;
};

KeyStore.prototype.listSystemServiceCreditIssuingAddresses = function (ctnNodeIndex, fromAddrIndex, toAddrIndex, onlyInUse) {
    // Validate arguments
    const errArg = {},
        queryTerms = [{parentPath: util.format('m/%d/0/4/0/0', ctnNodeIndex)}];

    if (!isValidCatenisNodeIndex(ctnNodeIndex)) {
        errArg.ctnNodeIndex = ctnNodeIndex;
    }

    if (fromAddrIndex !== undefined) {
        if (!isValidAddressIndex(fromAddrIndex)) {
            errArg.fromAddrIndex = fromAddrIndex;
        }
        else {
            queryTerms.push({index: {$gte: fromAddrIndex}});
        }
    }

    if (toAddrIndex !== undefined) {
        if (!isValidAddressIndex(toAddrIndex) || (fromAddrIndex !== undefined && toAddrIndex < fromAddrIndex)) {
            errArg.toAddrIndex = toAddrIndex;
        }
        else {
            queryTerms.push({index: {$lte: toAddrIndex}});
        }
    }

    if (Object.keys(errArg).length > 0) {
        const errArgs = Object.keys(errArg);

        Catenis.logger.ERROR(util.format('KeyStore.listSystemServiceCreditIssuingAddresses method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    if (onlyInUse) {
        queryTerms.push({isObsolete: false});
    }

    // Return existing system service credit issuance addresses within the specified range
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

KeyStore.prototype.listSystemServiceCreditIssuingAddressesInUse = function (ctnNodeIndex, fromAddrIndex, toAddrIndex) {
    return this.listSystemServiceCreditIssuingAddresses(ctnNodeIndex, fromAddrIndex, toAddrIndex);
};

KeyStore.prototype.getSystemServicePaymentPayTxExpenseAddressKeys = function (ctnNodeIndex, addrIndex, btcAddressType, isObsolete = false) {
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

        Catenis.logger.ERROR(util.format('KeyStore.getSystemServicePaymentPayTxExpenseAddressKeys method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    // Try to retrieve system service payment pay tx expense address HD extended key for given Catenis node with the given index
    const sysServPymtPayTxExpenseAddrPath = util.format('m/%d/0/4/0/1/%d', ctnNodeIndex, addrIndex);
    let sysServPymtPayTxExpenseAddrHDNode = retrieveHDNode.call(this, sysServPymtPayTxExpenseAddrPath, true),
        sysServPymtPayTxExpenseAddrKeys = null;

    if (sysServPymtPayTxExpenseAddrHDNode === null) {
        // System service payment pay tx expense address HD extended key does not exist yet.
        //  Retrieve parent root HD extended key to create it
        const path = parentPath(sysServPymtPayTxExpenseAddrPath);
        let sysServPymtPayTxExpenseRootHDNode = retrieveHDNode.call(this, path);

        if (sysServPymtPayTxExpenseRootHDNode === null) {
            // System service payment pay tx expense root HD extended key does not exist yet.
            //  Try to initialize Catenis node HD extended keys
            if (! this.initCatenisNodeHDNodes(ctnNodeIndex)) {
                Catenis.logger.ERROR(util.format('HD extended keys for Catenis node with index %d could not be initialized', ctnNodeIndex));
            }
            else {
                // Catenis node HD extended keys successfully initialized.
                //  Try to retrieve system service payment pay tx expense root HD extended key again
                sysServPymtPayTxExpenseRootHDNode = retrieveHDNode.call(this, path);
            }
        }

        if (sysServPymtPayTxExpenseRootHDNode === null) {
            Catenis.logger.ERROR(util.format('System service payment pay tx expense root HD extended key (%s) for Catenis node with index %d not found', path, ctnNodeIndex));
        }
        else {
            // Try to create system service payment pay tx expense address HD extended key now
            sysServPymtPayTxExpenseAddrHDNode = sysServPymtPayTxExpenseRootHDNode.derive(addrIndex);

            if (sysServPymtPayTxExpenseAddrHDNode.index !== addrIndex) {
                Catenis.logger.WARN(util.format('System service payment pay tx expense address HD extended key (%s) derived with an unexpected index', sysServPymtPayTxExpenseAddrPath), {expectedIndex: addrIndex, returnedIndex: sysServPymtPayTxExpenseAddrHDNode.index});
                sysServPymtPayTxExpenseAddrHDNode = null;
            }
            else {
                // Store created HD extended key
                storeHDNode.call(this, 'sys_serv_pymt_pay_tx_exp_addr', sysServPymtPayTxExpenseAddrPath, sysServPymtPayTxExpenseAddrHDNode, {
                    isLeaf: true,
                    isReserved: false,
                    isObsolete: isObsolete,
                    btcAddressType: btcAddressType
                });
            }
        }
    }
    else {
        btcAddressType = sysServPymtPayTxExpenseAddrHDNode.btcAddressType;
        sysServPymtPayTxExpenseAddrHDNode = sysServPymtPayTxExpenseAddrHDNode.hdNode;
    }

    if (sysServPymtPayTxExpenseAddrHDNode !== null) {
        sysServPymtPayTxExpenseAddrKeys = new CryptoKeys(sysServPymtPayTxExpenseAddrHDNode, btcAddressType);
    }

    return sysServPymtPayTxExpenseAddrKeys;
};

KeyStore.prototype.listSystemServicePaymentPayTxExpenseAddresses = function (ctnNodeIndex, fromAddrIndex, toAddrIndex, onlyInUse) {
    // Validate arguments
    const errArg = {},
        queryTerms = [{parentPath: util.format('m/%d/0/4/0/1', ctnNodeIndex)}];

    if (!isValidCatenisNodeIndex(ctnNodeIndex)) {
        errArg.ctnNodeIndex = ctnNodeIndex;
    }

    if (fromAddrIndex !== undefined) {
        if (!isValidAddressIndex(fromAddrIndex)) {
            errArg.fromAddrIndex = fromAddrIndex;
        }
        else {
            queryTerms.push({index: {$gte: fromAddrIndex}});
        }
    }

    if (toAddrIndex !== undefined) {
        if (!isValidAddressIndex(toAddrIndex) || (fromAddrIndex !== undefined && toAddrIndex < fromAddrIndex)) {
            errArg.toAddrIndex = toAddrIndex;
        }
        else {
            queryTerms.push({index: {$lte: toAddrIndex}});
        }
    }

    if (Object.keys(errArg).length > 0) {
        const errArgs = Object.keys(errArg);

        Catenis.logger.ERROR(util.format('KeyStore.listSystemServicePaymentPayTxExpenseAddresses method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    if (onlyInUse) {
        queryTerms.push({isObsolete: false});
    }

    // Return existing system service payment pay tx expense addresses within the specified range
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

KeyStore.prototype.listSystemServicePaymentPayTxExpenseAddressesInUse = function (ctnNodeIndex, fromAddrIndex, toAddrIndex) {
    return this.listSystemServicePaymentPayTxExpenseAddresses(ctnNodeIndex, fromAddrIndex, toAddrIndex);
};

KeyStore.prototype.getSystemMultiSigSigneeAddressKeys = function (ctnNodeIndex, addrIndex, btcAddressType, isObsolete = false) {
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

        Catenis.logger.ERROR(util.format('KeyStore.getSystemMultiSigSigneeAddressKeys method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    // Try to retrieve system multi-signature Colored Coins tx output signee address HD extended key for given Catenis node with the given index
    const sysMultiSigSigneeAddrPath = util.format('m/%d/0/4/1/%d', ctnNodeIndex, addrIndex);
    let sysMultiSigSigneeAddrHDNode = retrieveHDNode.call(this, sysMultiSigSigneeAddrPath, true),
        sysMultiSigSigneeAddrKeys = null;

    if (sysMultiSigSigneeAddrHDNode === null) {
        // System multi-signature Colored Coins tx output signee address HD extended key does not exist yet.
        //  Retrieve parent root HD extended key to create it
        const path = parentPath(sysMultiSigSigneeAddrPath);
        let sysMultiSigSigneeRootHDNode = retrieveHDNode.call(this, path);

        if (sysMultiSigSigneeRootHDNode === null) {
            // System multi-signature Colored Coins tx output signee root HD extended key does not exist yet.
            //  Try to initialize Catenis node HD extended keys
            if (! this.initCatenisNodeHDNodes(ctnNodeIndex)) {
                Catenis.logger.ERROR(util.format('HD extended keys for Catenis node with index %d could not be initialized', ctnNodeIndex));
            }
            else {
                // Catenis node HD extended keys successfully initialized.
                //  Try to retrieve system multi-signature Colored Coins tx output signee root HD extended key again
                sysMultiSigSigneeRootHDNode = retrieveHDNode.call(this, path);
            }
        }

        if (sysMultiSigSigneeRootHDNode === null) {
            Catenis.logger.ERROR(util.format('System multi-signature Colored Coins tx output signee root HD extended key (%s) for Catenis node with index %d not found', path, ctnNodeIndex));
        }
        else {
            // Try to create system multi-signature Colored Coins tx output signee address HD extended key now
            sysMultiSigSigneeAddrHDNode = sysMultiSigSigneeRootHDNode.derive(addrIndex);

            if (sysMultiSigSigneeAddrHDNode.index !== addrIndex) {
                Catenis.logger.WARN(util.format('System multi-signature Colored Coins tx output signee address HD extended key (%s) derived with an unexpected index', sysMultiSigSigneeAddrPath), {expectedIndex: addrIndex, returnedIndex: sysMultiSigSigneeAddrHDNode.index});
                sysMultiSigSigneeAddrHDNode = null;
            }
            else {
                // Store created HD extended key
                storeHDNode.call(this, 'sys_msig_sign_addr', sysMultiSigSigneeAddrPath, sysMultiSigSigneeAddrHDNode, {
                    isLeaf: true,
                    isReserved: false,
                    isObsolete: isObsolete,
                    btcAddressType: btcAddressType
                });
            }
        }
    }
    else {
        btcAddressType = sysMultiSigSigneeAddrHDNode.btcAddressType;
        sysMultiSigSigneeAddrHDNode = sysMultiSigSigneeAddrHDNode.hdNode;
    }

    if (sysMultiSigSigneeAddrHDNode !== null) {
        sysMultiSigSigneeAddrKeys = new CryptoKeys(sysMultiSigSigneeAddrHDNode, btcAddressType);
    }

    return sysMultiSigSigneeAddrKeys;
};

KeyStore.prototype.listSystemMultiSigSigneeAddresses = function (ctnNodeIndex, fromAddrIndex, toAddrIndex, onlyInUse) {
    // Validate arguments
    const errArg = {},
        queryTerms = [{parentPath: util.format('m/%d/0/4/1', ctnNodeIndex)}];

    if (!isValidCatenisNodeIndex(ctnNodeIndex)) {
        errArg.ctnNodeIndex = ctnNodeIndex;
    }

    if (fromAddrIndex !== undefined) {
        if (!isValidAddressIndex(fromAddrIndex)) {
            errArg.fromAddrIndex = fromAddrIndex;
        }
        else {
            queryTerms.push({index: {$gte: fromAddrIndex}});
        }
    }

    if (toAddrIndex !== undefined) {
        if (!isValidAddressIndex(toAddrIndex) || (fromAddrIndex !== undefined && toAddrIndex < fromAddrIndex)) {
            errArg.toAddrIndex = toAddrIndex;
        }
        else {
            queryTerms.push({index: {$lte: toAddrIndex}});
        }
    }

    if (Object.keys(errArg).length > 0) {
        const errArgs = Object.keys(errArg);

        Catenis.logger.ERROR(util.format('KeyStore.listSystemMultiSigSigneeAddresses method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    if (onlyInUse) {
        queryTerms.push({isObsolete: false});
    }

    // Return existing system multi-signature Colored Coins tx output signee addresses within the specified range
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

KeyStore.prototype.listSystemMultiSigSigneeAddressesInUse = function (ctnNodeIndex, fromAddrIndex, toAddrIndex) {
    return this.listSystemMultiSigSigneeAddresses(ctnNodeIndex, fromAddrIndex, toAddrIndex);
};

// NOTE: this method only applies to the Catenis Hub node
KeyStore.prototype.getSystemBcotSaleStockAddressKeys = function (ctnNodeIndex, addrIndex, btcAddressType, isObsolete = false) {
    // Validate arguments
    const errArg = {};

    if (ctnNodeIndex !== 0) {
        errArg.ctnNodeIndex = ctnNodeIndex;
    }

    if (!isValidAddressIndex(addrIndex)) {
        errArg.addrIndex = addrIndex;
    }

    if (Object.keys(errArg).length > 0) {
        const errArgs = Object.keys(errArg);

        Catenis.logger.ERROR(util.format('KeyStore.getSystemBcotSaleStockAddressKeys method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    // Try to retrieve system BCOT token sale stock address HD extended key for given Catenis node with the given index
    const sysBcotSaleStockAddrPath = util.format('m/%d/0/5/0/%d', ctnNodeIndex, addrIndex);
    let sysBcotSaleStockAddrHDNode = retrieveHDNode.call(this, sysBcotSaleStockAddrPath, true),
        sysBcotSaleStockAddrKeys = null;

    if (sysBcotSaleStockAddrHDNode === null) {
        // System BCOT token sale stock address HD extended key does not exist yet.
        //  Retrieve parent root HD extended key to create it
        const path = parentPath(sysBcotSaleStockAddrPath);
        let sysBcotSaleStockRootHDNode = retrieveHDNode.call(this, path);

        if (sysBcotSaleStockRootHDNode === null) {
            // System BCOT token sale stock root HD extended key does not exist yet.
            //  Try to initialize Catenis node HD extended keys
            if (! this.initCatenisNodeHDNodes(ctnNodeIndex)) {
                Catenis.logger.ERROR(util.format('HD extended keys for Catenis node with index %d could not be initialized', ctnNodeIndex));
            }
            else {
                // Catenis node HD extended keys successfully initialized.
                //  Try to retrieve system service credit issuance root HD extended key again
                sysBcotSaleStockRootHDNode = retrieveHDNode.call(this, path);
            }
        }

        if (sysBcotSaleStockRootHDNode === null) {
            Catenis.logger.ERROR(util.format('System BCOT toke sale stock root HD extended key (%s) for Catenis node with index %d not found', path, ctnNodeIndex));
        }
        else {
            // Try to create system BCOT token sale stock address HD extended key now
            sysBcotSaleStockAddrHDNode = sysBcotSaleStockRootHDNode.derive(addrIndex);

            if (sysBcotSaleStockAddrHDNode.index !== addrIndex) {
                Catenis.logger.WARN(util.format('System BCOT token sale stock address HD extended key (%s) derived with an unexpected index', sysBcotSaleStockAddrPath), {expectedIndex: addrIndex, returnedIndex: sysBcotSaleStockAddrHDNode.index});
                sysBcotSaleStockAddrHDNode = null;
            }
            else {
                // Store created HD extended key
                storeHDNode.call(this, 'sys_bcot_sale_stck_addr', sysBcotSaleStockAddrPath, sysBcotSaleStockAddrHDNode, {
                    isLeaf: true,
                    isReserved: false,
                    isObsolete: isObsolete,
                    btcAddressType: btcAddressType
                });
            }
        }
    }
    else {
        btcAddressType = sysBcotSaleStockAddrHDNode.btcAddressType;
        sysBcotSaleStockAddrHDNode = sysBcotSaleStockAddrHDNode.hdNode;
    }

    if (sysBcotSaleStockAddrHDNode !== null) {
        sysBcotSaleStockAddrKeys = new CryptoKeys(sysBcotSaleStockAddrHDNode, btcAddressType);
    }

    return sysBcotSaleStockAddrKeys;
};

// NOTE: this method only applies to the Catenis Hub node
KeyStore.prototype.listSystemBcotSaleStockAddresses = function (ctnNodeIndex, fromAddrIndex, toAddrIndex, onlyInUse) {
    // Validate arguments
    const errArg = {},
        queryTerms = [{parentPath: util.format('m/%d/0/5/0', ctnNodeIndex)}];

    if (ctnNodeIndex !== 0) {
        errArg.ctnNodeIndex = ctnNodeIndex;
    }

    if (fromAddrIndex !== undefined) {
        if (!isValidAddressIndex(fromAddrIndex)) {
            errArg.fromAddrIndex = fromAddrIndex;
        }
        else {
            queryTerms.push({index: {$gte: fromAddrIndex}});
        }
    }

    if (toAddrIndex !== undefined) {
        if (!isValidAddressIndex(toAddrIndex) || (fromAddrIndex !== undefined && toAddrIndex < fromAddrIndex)) {
            errArg.toAddrIndex = toAddrIndex;
        }
        else {
            queryTerms.push({index: {$lte: toAddrIndex}});
        }
    }

    if (Object.keys(errArg).length > 0) {
        const errArgs = Object.keys(errArg);

        Catenis.logger.ERROR(util.format('KeyStore.listSystemBcotSaleStockAddresses method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    if (onlyInUse) {
        queryTerms.push({isObsolete: false});
    }

    // Return existing BCOT token sale stock addresses within the specified range
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

// NOTE: this method only applies to the Catenis Hub node
KeyStore.prototype.listSystemBcotSaleStockAddressesInUse = function (ctnNodeIndex, fromAddrIndex, toAddrIndex) {
    return this.listSystemBcotSaleStockAddresses(ctnNodeIndex, fromAddrIndex, toAddrIndex);
};

KeyStore.prototype.getSystemOCMsgsSettlementPayTxExpenseAddressKeys = function (ctnNodeIndex, addrIndex, btcAddressType, isObsolete = false) {
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

        Catenis.logger.ERROR(util.format('KeyStore.getSystemOCMsgsSettlementPayTxExpenseAddressKeys method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    // Try to retrieve system off-chain messages settlement pay tx expense address HD extended key for given Catenis node with the given index
    const sysOCMsgsSetlmtPayTxExpenseAddrPath = util.format('m/%d/0/6/0/%d', ctnNodeIndex, addrIndex);
    let sysOCMsgsSetlmtPayTxExpenseAddrHDNode = retrieveHDNode.call(this, sysOCMsgsSetlmtPayTxExpenseAddrPath, true),
        sysOCMsgsSetlmtPayTxExpenseAddrKeys = null;

    if (sysOCMsgsSetlmtPayTxExpenseAddrHDNode === null) {
        // System off-chain messages settlement pay tx expense address HD extended key does not exist yet.
        //  Retrieve parent root HD extended key to create it
        const path = parentPath(sysOCMsgsSetlmtPayTxExpenseAddrPath);
        let sysOCMsgsSetlmtPayTxExpenseRootHDNode = retrieveHDNode.call(this, path);

        if (sysOCMsgsSetlmtPayTxExpenseRootHDNode === null) {
            // System off-chain messages settlement pay tx expense root HD extended key does not exist yet.
            //  Try to initialize Catenis node HD extended keys
            if (! this.initCatenisNodeHDNodes(ctnNodeIndex)) {
                Catenis.logger.ERROR(util.format('HD extended keys for Catenis node with index %d could not be initialized', ctnNodeIndex));
            }
            else {
                // Catenis node HD extended keys successfully initialized.
                //  Try to retrieve system off-chain messages settlement pay tx expense root HD extended key again
                sysOCMsgsSetlmtPayTxExpenseRootHDNode = retrieveHDNode.call(this, path);
            }
        }

        if (sysOCMsgsSetlmtPayTxExpenseRootHDNode === null) {
            Catenis.logger.ERROR(util.format('System off-chain messages settlement pay tx expense root HD extended key (%s) for Catenis node with index %d not found', path, ctnNodeIndex));
        }
        else {
            // Try to create system off-chain messages settlement pay tx expense address HD extended key now
            sysOCMsgsSetlmtPayTxExpenseAddrHDNode = sysOCMsgsSetlmtPayTxExpenseRootHDNode.derive(addrIndex);

            if (sysOCMsgsSetlmtPayTxExpenseAddrHDNode.index !== addrIndex) {
                Catenis.logger.WARN(util.format('System off-chain messages settlement pay tx expense address HD extended key (%s) derived with an unexpected index', sysOCMsgsSetlmtPayTxExpenseAddrPath), {expectedIndex: addrIndex, returnedIndex: sysOCMsgsSetlmtPayTxExpenseAddrHDNode.index});
                sysOCMsgsSetlmtPayTxExpenseAddrHDNode = null;
            }
            else {
                // Store created HD extended key
                storeHDNode.call(this, 'sys_oc_msgs_setlmt_pay_tx_exp_addr', sysOCMsgsSetlmtPayTxExpenseAddrPath, sysOCMsgsSetlmtPayTxExpenseAddrHDNode, {
                    isLeaf: true,
                    isReserved: false,
                    isObsolete: isObsolete,
                    btcAddressType: btcAddressType
                });
            }
        }
    }
    else {
        btcAddressType = sysOCMsgsSetlmtPayTxExpenseAddrHDNode.btcAddressType;
        sysOCMsgsSetlmtPayTxExpenseAddrHDNode = sysOCMsgsSetlmtPayTxExpenseAddrHDNode.hdNode;
    }

    if (sysOCMsgsSetlmtPayTxExpenseAddrHDNode !== null) {
        sysOCMsgsSetlmtPayTxExpenseAddrKeys = new CryptoKeys(sysOCMsgsSetlmtPayTxExpenseAddrHDNode, btcAddressType);
    }

    return sysOCMsgsSetlmtPayTxExpenseAddrKeys;
};

KeyStore.prototype.listSystemOCMsgsSettlementPayTxExpenseAddresses = function (ctnNodeIndex, fromAddrIndex, toAddrIndex, onlyInUse) {
    // Validate arguments
    const errArg = {},
        queryTerms = [{parentPath: util.format('m/%d/0/6/0', ctnNodeIndex)}];

    if (!isValidCatenisNodeIndex(ctnNodeIndex)) {
        errArg.ctnNodeIndex = ctnNodeIndex;
    }

    if (fromAddrIndex !== undefined) {
        if (!isValidAddressIndex(fromAddrIndex)) {
            errArg.fromAddrIndex = fromAddrIndex;
        }
        else {
            queryTerms.push({index: {$gte: fromAddrIndex}});
        }
    }

    if (toAddrIndex !== undefined) {
        if (!isValidAddressIndex(toAddrIndex) || (fromAddrIndex !== undefined && toAddrIndex < fromAddrIndex)) {
            errArg.toAddrIndex = toAddrIndex;
        }
        else {
            queryTerms.push({index: {$lte: toAddrIndex}});
        }
    }

    if (Object.keys(errArg).length > 0) {
        const errArgs = Object.keys(errArg);

        Catenis.logger.ERROR(util.format('KeyStore.listSystemOCMsgsSettlementPayTxExpenseAddresses method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    if (onlyInUse) {
        queryTerms.push({isObsolete: false});
    }

    // Return existing system off-chain messages settlement pay tx expense addresses within the specified range
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

KeyStore.prototype.listSystemOCMsgsSettlementPayTxExpenseAddressesInUse = function (ctnNodeIndex, fromAddrIndex, toAddrIndex) {
    return this.listSystemOCMsgsSettlementPayTxExpenseAddresses(ctnNodeIndex, fromAddrIndex, toAddrIndex);
};

KeyStore.prototype.getSystemDeviceAddressKeys = function (ctnNodeIndex, addrRootIndex, addrIndex, btcAddressType, isObsolete = false) {
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
    let sysDeviceAddrHDNode = retrieveHDNode.call(this, sysDeviceAddrPath, true),
        sysDeviceAddrKeys = null;

    if (sysDeviceAddrHDNode === null) {
        // System device address HD extended key does not exist yet.
        //  Retrieve parent root HD extended key to create it
        const path = parentPath(sysDeviceAddrPath);
        let sysDeviceAddrRootHDNode = retrieveHDNode.call(this, path);

        if (sysDeviceAddrRootHDNode === null) {
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

        if (sysDeviceAddrRootHDNode === null) {
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
                storeHDNode.call(this, addrRootIndex === 0 ? 'sys_dev_main_addr' : 'sys_dev_rsrv_addr', sysDeviceAddrPath, sysDeviceAddrHDNode, {
                    isLeaf: true,
                    isReserved: addrRootIndex >= numUsedSysDeviceAddrRoots,
                    isObsolete: isObsolete,
                    btcAddressType: btcAddressType
                });
            }
        }
    }
    else {
        btcAddressType = sysDeviceAddrHDNode.btcAddressType;
        sysDeviceAddrHDNode = sysDeviceAddrHDNode.hdNode;
    }

    if (sysDeviceAddrHDNode !== null) {
        sysDeviceAddrKeys = new CryptoKeys(sysDeviceAddrHDNode, btcAddressType);
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

    if (fromAddrIndex !== undefined) {
        if (!isValidAddressIndex(fromAddrIndex)) {
            errArg.fromAddrIndex = fromAddrIndex;
        }
        else {
            queryTerms.push({index: {$gte: fromAddrIndex}});
        }
    }

    if (toAddrIndex !== undefined) {
        if (!isValidAddressIndex(toAddrIndex) || (fromAddrIndex !== undefined && toAddrIndex < fromAddrIndex)) {
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

KeyStore.prototype.getSystemDeviceMainAddressKeys = function (ctnNodeIndex, addrIndex, btcAddressType, isObsolete = false) {
    return this.getSystemDeviceAddressKeys(ctnNodeIndex, 0, addrIndex, btcAddressType, isObsolete);
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

    if (clientRootHDNode === null) {
        // Client root HD extended key does not exist yet.
        //  Retrieve parent root HD extended key to create it
        let path = parentPath(clientRootPath),
            ctnNodeRootHDNode = retrieveHDNode.call(this, path);

        if (ctnNodeRootHDNode === null) {
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

        if (ctnNodeRootHDNode === null) {
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
                                for (let idx = 0; idx < numClientServCredAddrRoots; idx++) {
                                    const clientSrvCreditAddrRootPath = util.format('%s/%d', clientSrvCreditRootPath, idx),
                                        clientSrvCreditAddrRootHDNode = clientSrvCreditRootHDNode.derive(idx);

                                    if (clientSrvCreditAddrRootHDNode.index !== idx) {
                                        Catenis.logger.WARN(util.format('Client service credit address #%d root HD extended key (%s) derived with an unexpected index', idx + 1, clientSrvCreditAddrRootPath), {expectedIndex: idx, returnedIndex: clientSrvCreditAddrRootHDNode.index});
                                        clientSrvCreditRootHDNode = null;
                                        break;
                                    }
                                    else {
                                        // Save newly created HD extended key to store it later
                                        hdNodesToStore.push({type: idx < numUsedClientServCredAddrRoots ? clientServCredAddrRootTypes[idx].root : 'cln_srv_crd_rsrv_addr_root', path: clientSrvCreditAddrRootPath, hdNode: clientSrvCreditAddrRootHDNode, isLeaf: false, isReserved: idx >= numUsedClientServCredAddrRoots});
                                    }
                                }

                                if (clientSrvCreditRootHDNode !== null) {
                                    // Store all newly created HD extended keys, and indicate success
                                    hdNodesToStore.forEach((hdNodeToStore) => {
                                        storeHDNode.call(this, hdNodeToStore.type, hdNodeToStore.path, hdNodeToStore.hdNode, {
                                            isLeaf: hdNodeToStore.isLeaf,
                                            isReserved: hdNodeToStore.isReserved
                                        });
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

KeyStore.prototype.getClientServiceCreditAddressKeys = function (ctnNodeIndex, clientIndex, servCreditIndex, addrIndex, btcAddressType, isObsolete = false) {
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
    let clientSrvCreditAddrHDNode = retrieveHDNode.call(this, clientSrvCreditAddrPath, true),
        clientSrvCreditAddrKeys = null;

    if (clientSrvCreditAddrHDNode === null) {
        // Client service credit address HD extended key does not exist yet.
        //  Retrieve parent root HD extended key to create it
        const path = parentPath(clientSrvCreditAddrPath);
        let clientSrvCreditRootHDNode = retrieveHDNode.call(this, path);

        if (clientSrvCreditRootHDNode === null) {
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

        if (clientSrvCreditRootHDNode === null) {
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
                storeHDNode.call(this, servCreditIndex < numUsedClientServCredAddrRoots ? clientServCredAddrRootTypes[servCreditIndex].address : 'cln_srv_crd_rsrv_addr', clientSrvCreditAddrPath, clientSrvCreditAddrHDNode, {
                    isLeaf: true,
                    isReserved: servCreditIndex >= numUsedClientServCredAddrRoots,
                    isObsolete: isObsolete,
                    btcAddressType: btcAddressType
                });
            }
        }
    }
    else {
        btcAddressType = clientSrvCreditAddrHDNode.btcAddressType;
        clientSrvCreditAddrHDNode = clientSrvCreditAddrHDNode.hdNode;
    }

    if (clientSrvCreditAddrHDNode !== null) {
        clientSrvCreditAddrKeys = new CryptoKeys(clientSrvCreditAddrHDNode, btcAddressType, addressEncryptionScheme(clientSrvCreditAddrPath));
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

    if (fromAddrIndex !== undefined) {
        if (!isValidAddressIndex(fromAddrIndex)) {
            errArg.fromAddrIndex = fromAddrIndex;
        }
        else {
            queryTerms.push({index: {$gte: fromAddrIndex}});
        }
    }

    if (toAddrIndex !== undefined) {
        if (!isValidAddressIndex(toAddrIndex) || (fromAddrIndex !== undefined && toAddrIndex < fromAddrIndex)) {
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

KeyStore.prototype.getClientServiceAccountCreditLineAddressKeys = function (ctnNodeIndex, clientIndex, addrIndex, btcAddressType, isObsolete = false) {
    return this.getClientServiceCreditAddressKeys(ctnNodeIndex, clientIndex, 2, addrIndex, btcAddressType, isObsolete);
};

KeyStore.prototype.listClientServiceAccountCreditLineAddresses = function (ctnNodeIndex, clientIndex, fromAddrIndex, toAddrIndex, onlyInUse) {
    return this.listClientServiceCreditAddresses(ctnNodeIndex, clientIndex, 2, fromAddrIndex, toAddrIndex, onlyInUse);
};

KeyStore.prototype.listClientServiceAccountCreditLineAddressesInUse = function (ctnNodeIndex, clientIndex, fromAddrIndex, toAddrIndex) {
    return this.listClientServiceCreditAddressesInUse(ctnNodeIndex, clientIndex, 2, fromAddrIndex, toAddrIndex);
};

KeyStore.prototype.listAllClientServiceAccountCreditLineAddressesInUse = function (clientIndices) {
    const selector = {
        $and: [
            {isObsolete: false}
        ]
    };

    if (clientIndices !== undefined) {
        selector.$and.push({
            parentPath: {
                $in: clientIndices.map((index) => KeyStore.clientServiceAccountCreditLineAddressRootPath(index.ctnNodeIndex, index.clientIndex))
            }
        })
    }
    else {
        selector.$and.push({
            type: KeyStore.extKeyType.cln_srv_acc_cred_ln_addr.name
        })
    }

    return this.collExtKey.find(selector).map((docExtKey) => {
        return docExtKey.address;
    });
};

KeyStore.prototype.getClientServiceAccountDebitLineAddressKeys = function (ctnNodeIndex, clientIndex, addrIndex, btcAddressType, isObsolete = false) {
    return this.getClientServiceCreditAddressKeys(ctnNodeIndex, clientIndex, 3, addrIndex, btcAddressType, isObsolete);
};

KeyStore.prototype.listClientServiceAccountDebitLineAddresses = function (ctnNodeIndex, clientIndex, fromAddrIndex, toAddrIndex, onlyInUse) {
    return this.listClientServiceCreditAddresses(ctnNodeIndex, clientIndex, 3, fromAddrIndex, toAddrIndex, onlyInUse);
};

KeyStore.prototype.listClientServiceAccountDebitLineAddressesInUse = function (ctnNodeIndex, clientIndex, fromAddrIndex, toAddrIndex) {
    return this.listClientServiceCreditAddressesInUse(ctnNodeIndex, clientIndex, 3, fromAddrIndex, toAddrIndex);
};

KeyStore.prototype.getClientBcotPaymentAddressKeys = function (ctnNodeIndex, clientIndex, addrIndex, btcAddressType, isObsolete = false) {
    return this.getClientServiceCreditAddressKeys(ctnNodeIndex, clientIndex, 4, addrIndex, btcAddressType, isObsolete);
};

KeyStore.prototype.listClientBcotPaymentAddresses = function (ctnNodeIndex, clientIndex, fromAddrIndex, toAddrIndex, onlyInUse) {
    return this.listClientServiceCreditAddresses(ctnNodeIndex, clientIndex, 4, fromAddrIndex, toAddrIndex, onlyInUse);
};

KeyStore.prototype.listClientBcotPaymentAddressesInUse = function (ctnNodeIndex, clientIndex, fromAddrIndex, toAddrIndex) {
    return this.listClientServiceCreditAddressesInUse(ctnNodeIndex, clientIndex, 4, fromAddrIndex, toAddrIndex);
};

KeyStore.prototype.listAllClientBcotPaymentAddressesInUse = function () {
    return this.collExtKey.find({$and: [{type: KeyStore.extKeyType.cln_bcot_pay_addr.name}, {isObsolete: false}]}).map((docExtKey) => {
        return docExtKey.address;
    });
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

    if (clientIntHierarchyRootHDNode === null) {
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

    if (clientIntHierarchyRootHDNode === null) {
        Catenis.logger.ERROR(util.format('Internal hierarchy root HD extended key (%s) for client with index %d of Catenis node with index %d not found', clientIntHierarchyRootPath, clientIndex, ctnNodeIndex));
    }
    else {
        // Try to retrieve public hierarchy root HD extended key for client of given Catenis node with given index
        const clientPubHierarchyRootPath = util.format('m/%d/%d/1', ctnNodeIndex, clientIndex),
            clientPubHierarchyRootHDNode = retrieveHDNode.call(this, clientPubHierarchyRootPath);

        if (clientPubHierarchyRootHDNode === null) {
            Catenis.logger.ERROR(util.format('Public hierarchy root HD extended key (%s) for client with index %d of Catenis node with index %d not found', clientPubHierarchyRootPath, clientIndex, ctnNodeIndex));
        }
        else {
            // Make sure that HD nodes for specified device have not yet been initialized
            const deviceIntRootPath = util.format('%s/%d', clientIntHierarchyRootPath, deviceIndex);

            if (retrieveHDNode.call(this, deviceIntRootPath) === null) {
                // Create client internal root HD extended key for device with given index
                let deviceIntRootHDNode = clientIntHierarchyRootHDNode.derive(deviceIndex);

                if (deviceIntRootHDNode.index !== deviceIndex) {
                    Catenis.logger.WARN(util.format('Device internal root HD extended key (%s) derived with an unexpected index', deviceIntRootPath), {
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
                            hdNodesToStore.push({type: idx === 0 ? 'dev_read_conf_addr_root' : 'dev_int_rsrv_addr_root', path: deviceIntAddrRootPath, hdNode: deviceIntAddrRootHDNode, isLeaf: false, isReserved: idx >= numUsedDeviceIntAddrRoots});
                        }
                    }

                    if (deviceIntRootHDNode !== null) {
                        // Create client public root HD extended key for device with given index
                        const devicePubRootPath = util.format('%s/%d', clientPubHierarchyRootPath, deviceIndex);
                        let devicePubRootHDNode = clientPubHierarchyRootHDNode.derive(deviceIndex);

                        if (devicePubRootHDNode.index !== deviceIndex) {
                            Catenis.logger.WARN(util.format('Device public root HD extended key (%s) derived with an unexpected index', devicePubRootPath), {
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
                                    const hdNodeInfo = {
                                        path: devicePubAddrRootPath,
                                        hdNode: devicePubAddrRootHDNode,
                                        isLeaf: false,
                                        isReserved: false
                                    };

                                    switch (idx) {
                                        case 0:
                                            // Device main addresses root
                                            hdNodeInfo.type = 'dev_main_addr_root';
                                            break;

                                        case 1:
                                            // Device asset addresses root
                                            hdNodeInfo.type = 'dev_asst_addr_root';
                                            break;

                                        case 2:
                                            // Device asset issuance addresses root
                                            hdNodeInfo.type = 'dev_asst_issu_addr_root';
                                            break;

                                        case 3:
                                            // Device off-chain addresses root
                                            hdNodeInfo.type = 'dev_off_chain_addr_root';
                                            break;

                                        default:
                                            // Reserved
                                            hdNodeInfo.type = 'dev_pub_rsrv_addr_root';
                                            hdNodeInfo.isReserved = true;
                                            break;
                                    }

                                    hdNodesToStore.push(hdNodeInfo);
                                }
                            }

                            if (devicePubRootHDNode !== null) {
                                // Store all newly created HD extended keys, and indicate success
                                hdNodesToStore.forEach((hdNodeToStore) => {
                                    storeHDNode.call(this, hdNodeToStore.type, hdNodeToStore.path, hdNodeToStore.hdNode, {
                                        isLeaf: hdNodeToStore.isLeaf,
                                        isReserved: hdNodeToStore.isReserved
                                    });
                                });

                                success = true;
                            }
                        }
                    }
                }
            }
            else {
                // Device HD nodes already initialized. Nothing to do,
                //  just indicate success
                success = true;
            }
        }
    }

    return success;
};

KeyStore.prototype.getDeviceInternalAddressKeys = function (ctnNodeIndex, clientIndex, deviceIndex, addrRootIndex, addrIndex, btcAddressType, isObsolete = false) {
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
    let deviceIntAddrHDNode = retrieveHDNode.call(this, deviceIntAddrPath, true),
        deviceIntAddrKeys = null;

    if (deviceIntAddrHDNode === null) {
        // Device internal address HD extended key does not exist yet.
        //  Retrieve parent root HD extended key to create it
        const path = parentPath(deviceIntAddrPath);
        let deviceIntAddrRootHDNode = retrieveHDNode.call(this, path);

        if (deviceIntAddrRootHDNode === null) {
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

        if (deviceIntAddrRootHDNode === null) {
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
                storeHDNode.call(this, addrRootIndex === 0 ? 'dev_read_conf_addr' : 'dev_int_rsrv_addr', deviceIntAddrPath, deviceIntAddrHDNode, {
                    isLeaf: true,
                    isReserved: addrRootIndex >= numUsedDeviceIntAddrRoots,
                    isObsolete: isObsolete,
                    btcAddressType: btcAddressType
                });
            }
        }
    }
    else {
        btcAddressType = deviceIntAddrHDNode.btcAddressType;
        deviceIntAddrHDNode = deviceIntAddrHDNode.hdNode;
    }

    if (deviceIntAddrHDNode !== null) {
        deviceIntAddrKeys = new CryptoKeys(deviceIntAddrHDNode, btcAddressType);
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

    if (fromAddrIndex !== undefined) {
        if (!isValidAddressIndex(fromAddrIndex)) {
            errArg.fromAddrIndex = fromAddrIndex;
        }
        else {
            queryTerms.push({index: {$gte: fromAddrIndex}});
        }
    }

    if (toAddrIndex !== undefined) {
        if (!isValidAddressIndex(toAddrIndex) || (fromAddrIndex !== undefined && toAddrIndex < fromAddrIndex)) {
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

KeyStore.prototype.getDevicePublicAddressKeys = function (ctnNodeIndex, clientIndex, deviceIndex, addrRootIndex, addrIndex, btcAddressType, isObsolete = false) {
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
    let devicePubAddrHDNode = retrieveHDNode.call(this, devicePubAddrPath, true),
        devicePubAddrKeys = null;

    if (devicePubAddrHDNode === null) {
        // Device public address HD extended key does not exist yet.
        //  Retrieve parent root HD extended key to create it
        const path = parentPath(devicePubAddrPath);
        let devicePubAddrRootHDNode = retrieveHDNode.call(this, path);

        if (devicePubAddrRootHDNode === null) {
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

        if (devicePubAddrRootHDNode === null) {
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
                const hdNodeInfo = {
                    path: devicePubAddrPath,
                    hdNode: devicePubAddrHDNode,
                    isLeaf: true,
                    isReserved: false,
                    isObsolete: isObsolete,
                    isOffChainAddr: false
                };

                switch (addrRootIndex) {
                    case 0:
                        // Device main address
                        hdNodeInfo.type = 'dev_main_addr';
                        break;

                    case 1:
                        // Device asset address
                        hdNodeInfo.type = 'dev_asst_addr';
                        break;

                    case 2:
                        // Device asset issuance address
                        hdNodeInfo.type = 'dev_asst_issu_addr';
                        break;

                    case 3:
                        // Device off-chain address
                        hdNodeInfo.type = 'dev_off_chain_addr';
                        hdNodeInfo.isOffChainAddr = true;
                        break;

                    default:
                        // Reserved
                        hdNodeInfo.type = 'dev_pub_rsrv_addr';
                        hdNodeInfo.isReserved = true;
                        break;
                }

                storeHDNode.call(this, hdNodeInfo.type, hdNodeInfo.path, hdNodeInfo.hdNode, {
                    isLeaf: hdNodeInfo.isLeaf,
                    isReserved: hdNodeInfo.isReserved,
                    isObsolete: hdNodeInfo.isObsolete,
                    isOffChainAddr: hdNodeInfo.isOffChainAddr,
                    btcAddressType: btcAddressType
                });
            }
        }
    }
    else {
        btcAddressType = devicePubAddrHDNode.btcAddressType;
        devicePubAddrHDNode = devicePubAddrHDNode.hdNode;
    }

    if (devicePubAddrHDNode !== null) {
        devicePubAddrKeys = new CryptoKeys(devicePubAddrHDNode, btcAddressType, addressEncryptionScheme(devicePubAddrPath));
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

    if (fromAddrIndex !== undefined) {
        if (!isValidAddressIndex(fromAddrIndex)) {
            errArg.fromAddrIndex = fromAddrIndex;
        }
        else {
            queryTerms.push({index: {$gte: fromAddrIndex}});
        }
    }

    if (toAddrIndex !== undefined) {
        if (!isValidAddressIndex(toAddrIndex) || (fromAddrIndex !== undefined && toAddrIndex < fromAddrIndex)) {
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

    // noinspection JSCheckFunctionSignatures
    return this.collExtKey.chain().find(query).simplesort('index', true).limit(1).data().reduce((docExtKey) => {
        return docExtKey.address;
    }, null);
};

KeyStore.prototype.latestDevicePublicAddressInUse = function (ctnNodeIndex, clientIndex, deviceIndex, addrRootIndex) {
    return this.latestDevicePublicAddress(ctnNodeIndex, clientIndex, deviceIndex, addrRootIndex, true);
};

KeyStore.prototype.getDeviceReadConfirmAddressKeys = function (ctnNodeIndex, clientIndex, deviceIndex, addrIndex, btcAddressType, isObsolete = false) {
    return this.getDeviceInternalAddressKeys(ctnNodeIndex, clientIndex, deviceIndex, 0, addrIndex, btcAddressType, isObsolete);
};

KeyStore.prototype.listDeviceReadConfirmAddresses = function (ctnNodeIndex, clientIndex, deviceIndex, fromAddrIndex, toAddrIndex, onlyInUse) {
    return this.listDeviceInternalAddresses(ctnNodeIndex, clientIndex, deviceIndex, 0, fromAddrIndex, toAddrIndex, onlyInUse);
};

KeyStore.prototype.listDeviceReadConfirmAddressesInUse = function (ctnNodeIndex, clientIndex, deviceIndex, fromAddrIndex, toAddrIndex) {
    return this.listDeviceInternalAddresses(ctnNodeIndex, clientIndex, deviceIndex, 0, fromAddrIndex, toAddrIndex, true);
};

KeyStore.prototype.getDeviceMainAddressKeys = function (ctnNodeIndex, clientIndex, deviceIndex, addrIndex, btcAddressType, isObsolete = false) {
    return this.getDevicePublicAddressKeys(ctnNodeIndex, clientIndex, deviceIndex, 0, addrIndex, btcAddressType, isObsolete);
};

KeyStore.prototype.listDeviceMainAddresses = function (ctnNodeIndex, clientIndex, deviceIndex, fromAddrIndex, toAddrIndex, onlyInUse) {
    return this.listDevicePublicAddresses(ctnNodeIndex, clientIndex, deviceIndex, 0, fromAddrIndex, toAddrIndex, onlyInUse);
};

KeyStore.prototype.listDeviceMainAddressesInUse = function (ctnNodeIndex, clientIndex, deviceIndex, fromAddrIndex, toAddrIndex) {
    return this.listDevicePublicAddresses(ctnNodeIndex, clientIndex, deviceIndex, 0, fromAddrIndex, toAddrIndex, true);
};

KeyStore.prototype.getDeviceAssetAddressKeys = function (ctnNodeIndex, clientIndex, deviceIndex, addrIndex, btcAddressType, isObsolete = false) {
    return this.getDevicePublicAddressKeys(ctnNodeIndex, clientIndex, deviceIndex, 1, addrIndex, btcAddressType, isObsolete);
};

KeyStore.prototype.listDeviceAssetAddresses = function (ctnNodeIndex, clientIndex,  deviceIndex, fromAddrIndex, toAddrIndex, onlyInUse) {
    return this.listDevicePublicAddresses(ctnNodeIndex, clientIndex,  deviceIndex, 1, fromAddrIndex, toAddrIndex, onlyInUse);
};

KeyStore.prototype.listDeviceAssetAddressesInUse = function (ctnNodeIndex, clientIndex,  deviceIndex, fromAddrIndex, toAddrIndex) {
    return this.listDevicePublicAddresses(ctnNodeIndex, clientIndex,  deviceIndex, 1, fromAddrIndex, toAddrIndex, true);
};

KeyStore.prototype.getDeviceAssetIssuanceAddressKeys = function (ctnNodeIndex, clientIndex,  deviceIndex, addrIndex, btcAddressType, isObsolete = false) {
    return this.getDevicePublicAddressKeys(ctnNodeIndex, clientIndex,  deviceIndex, 2, addrIndex, btcAddressType, isObsolete);
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

KeyStore.prototype.getDeviceOffChainAddressKeys = function (ctnNodeIndex, clientIndex,  deviceIndex, addrIndex) {
    return this.getDevicePublicAddressKeys(ctnNodeIndex, clientIndex,  deviceIndex, 3, addrIndex, BitcoinInfo.addressType.pubkeyhash, true);
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
    this.collExtKey.findAndRemove({$or: [{isReserved: true}, {$and: [{isObsolete: true}, {'meta.revision': 0}, {'meta.created': {$lt: obsoleteEarliestTimestamp}}]},
            {$and: [{isObsolete: true}, {'meta.revision': {$gt: 0}}, {'meta.updated': {$lt: obsoleteEarliestTimestamp}}]}]});
}

// Arguments:
//  type [String] - HD extended key type (from KeyStore.extKeyType)
//  path [String] - The HD extended key node path
//  hdNode [Object] - The HD extended key node object
//  opts [Object] {
//    isLeaf [Boolean],
//    isReserved [Boolean],
//    isObsolete [Boolean]
//    isOffChainAddr [Boolean],
//    btcAddressType [Object]
//  }
function storeHDNode(type, path, hdNode, opts) {
    opts = opts || {};

    if (opts.isLeaf === undefined) {
        opts.isLeaf = false;
    }

    if (opts.isReserved === undefined) {
        opts.isReserved = false;
    }

    if (!opts.isLeaf || opts.isObsolete === undefined) {
        opts.isObsolete = false;
    }

    if (!opts.isLeaf || opts.isOffChainAddr === undefined) {
        opts.isOffChainAddr = false;
    }

    // Make sure that off-chain address is always set as obsolete (so it can be purged at any time)
    if (opts.isOffChainAddr && !opts.isObsolete) {
        opts.isObsolete = true;
    }

    if (!opts.btcAddressType) {
        opts.btcAddressType = BitcoinInfo.addressType.pubkeyhash;
    }

    const addrAndPubKeyHash = new CryptoKeys(hdNode, opts.btcAddressType).getAddressAndPubKeyHash();
    const docExtKey = {
        type: type,
        path: path,
        parentPath: parentPath(path),
        depth: hdNode.depth,
        index: hdNode.index,
        strHDNode: hdNode.toBase58(),
        address: addrAndPubKeyHash.address,
        btcAddressType: opts.btcAddressType.name,
        pubKeyHash: addrAndPubKeyHash.pubKeyHash.toString('base64'),
        isLeaf: opts.isLeaf,
        isReserved: opts.isReserved,
        isObsolete: opts.isObsolete,
        isOffChainAddr: opts.isOffChainAddr
    };

    this.collExtKey.insert(docExtKey);
}

function retrieveHDNode(path, returnObject = false) {
    const docExtKey = this.collExtKey.by('path', path);

    let hdNode = docExtKey !== undefined ? bitcoinLib.bip32.fromBase58(docExtKey.strHDNode, this.cryptoNetwork) : null;

    if (hdNode && returnObject) {
        hdNode = {
            hdNode,
            btcAddressType: BitcoinInfo.getAddressTypeByName(docExtKey.btcAddressType)
        };
    }

    return hdNode;
}


// KeyStore function class (public) methods
//

KeyStore.initialize = function (masterOnly = false) {
    Catenis.logger.TRACE('KeyStore initialization');
    // Instantiate KeyStore object
    Catenis.keyStore = new KeyStore(Catenis.application.ctnHubNodeIndex, Catenis.application.masterSeed, Catenis.application.cryptoNetwork, masterOnly);

    if (!masterOnly) {
        // Execute process to purge unused HD extended keys from local key storage now,
        //  and set recurring timer to execute it periodically
        purgeUnusedExtendedKeys.call(Catenis.keyStore);
        Catenis.logger.TRACE('Setting recurring timer to purge unused HD extended keys from local key storage');
        purgeUnusedExtKeyIntervalHandle = Meteor.setInterval(purgeUnusedExtendedKeys.bind(Catenis.keyStore), cfgSettings.purgeUnusedExtKeyInterval);
    }
};

KeyStore.isValidPath = function (path) {
    return /^m(?:\/(?:0|(?:[1-9]\d*)))*$/.test(path);
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

KeyStore.systemReadConfirmSpendNotifyRootPath = function (ctnNodeIndex) {
    // Validate Catenis node index
    if (!isValidCatenisNodeIndex(ctnNodeIndex)) {
        Catenis.logger.ERROR('KeyStore.systemReadConfirmSpendNotifyRootPath method called with invalid argument', {ctnNodeIndex: ctnNodeIndex});
        throw Error('Invalid ctnNodeIndex argument');
    }

    return util.format('m/%d/0/3/0/0', ctnNodeIndex);
};

KeyStore.systemReadConfirmSpendOnlyRootPath = function (ctnNodeIndex) {
    // Validate Catenis node index
    if (!isValidCatenisNodeIndex(ctnNodeIndex)) {
        Catenis.logger.ERROR('KeyStore.systemReadConfirmSpendOnlyRootPath method called with invalid argument', {ctnNodeIndex: ctnNodeIndex});
        throw Error('Invalid ctnNodeIndex argument');
    }

    return util.format('m/%d/0/3/0/1', ctnNodeIndex);
};

KeyStore.systemReadConfirmSpendNullRootPath = function (ctnNodeIndex) {
    // Validate Catenis node index
    if (!isValidCatenisNodeIndex(ctnNodeIndex)) {
        Catenis.logger.ERROR('KeyStore.systemReadConfirmSpendNullRootPath method called with invalid argument', {ctnNodeIndex: ctnNodeIndex});
        throw Error('Invalid ctnNodeIndex argument');
    }

    return util.format('m/%d/0/3/0/2', ctnNodeIndex);
};

KeyStore.systemReadConfirmPayTxExpenseRootPath = function (ctnNodeIndex) {
    // Validate Catenis node index
    if (!isValidCatenisNodeIndex(ctnNodeIndex)) {
        Catenis.logger.ERROR('KeyStore.systemReadConfirmPayTxExpenseRootPath method called with invalid argument', {ctnNodeIndex: ctnNodeIndex});
        throw Error('Invalid ctnNodeIndex argument');
    }

    return util.format('m/%d/0/3/1', ctnNodeIndex);
};

KeyStore.systemServiceCreditIssuingRootPath = function (ctnNodeIndex) {
    // Validate Catenis node index
    if (!isValidCatenisNodeIndex(ctnNodeIndex)) {
        Catenis.logger.ERROR('KeyStore.systemServiceCreditIssuingRootPath method called with invalid argument', {ctnNodeIndex: ctnNodeIndex});
        throw Error('Invalid ctnNodeIndex argument');
    }

    return util.format('m/%d/0/4/0/0', ctnNodeIndex);
};

KeyStore.systemServicePaymentPayTxExpenseRootPath = function (ctnNodeIndex) {
    // Validate Catenis node index
    if (!isValidCatenisNodeIndex(ctnNodeIndex)) {
        Catenis.logger.ERROR('KeyStore.systemServicePaymentPayTxExpenseRootPath method called with invalid argument', {ctnNodeIndex: ctnNodeIndex});
        throw Error('Invalid ctnNodeIndex argument');
    }

    return util.format('m/%d/0/4/0/1', ctnNodeIndex);
};

KeyStore.systemMultiSigSigneeRootPath = function (ctnNodeIndex) {
    // Validate Catenis node index
    if (!isValidCatenisNodeIndex(ctnNodeIndex)) {
        Catenis.logger.ERROR('KeyStore.systemMultiSigSigneeRootPath method called with invalid argument', {ctnNodeIndex: ctnNodeIndex});
        throw Error('Invalid ctnNodeIndex argument');
    }

    return util.format('m/%d/0/4/1', ctnNodeIndex);
};

KeyStore.systemBcotSaleStockRootPath = function (ctnNodeIndex) {
    // Validate Catenis node index
    if (!isValidCatenisNodeIndex(ctnNodeIndex)) {
        Catenis.logger.ERROR('KeyStore.systemBcotSaleStockRootPath method called with invalid argument', {ctnNodeIndex: ctnNodeIndex});
        throw Error('Invalid ctnNodeIndex argument');
    }

    return util.format('m/%d/0/5/0', ctnNodeIndex);
};

KeyStore.systemOCMsgsSetlmtPayTxExpenseRootPath = function (ctnNodeIndex) {
    // Validate Catenis node index
    if (!isValidCatenisNodeIndex(ctnNodeIndex)) {
        Catenis.logger.ERROR('KeyStore.systemOCMsgsSetlmtPayTxExpenseRootPath method called with invalid argument', {ctnNodeIndex: ctnNodeIndex});
        throw Error('Invalid ctnNodeIndex argument');
    }

    return util.format('m/%d/0/6/0', ctnNodeIndex);
};

KeyStore.systemDeviceMainAddressRootPath = function (ctnNodeIndex) {
    // Validate Catenis node index
    if (!isValidCatenisNodeIndex(ctnNodeIndex)) {
        Catenis.logger.ERROR('KeyStore.systemDeviceMainAddressRootPath method called with invalid argument', {ctnNodeIndex: ctnNodeIndex});
        throw Error('Invalid ctnNodeIndex argument');
    }

    return util.format('m/%d/0/0/0', ctnNodeIndex);
};

KeyStore.clientServiceAccountCreditLineAddressRootPath = function (ctnNodeIndex, clientIndex) {
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

        Catenis.logger.ERROR(util.format('KeyStore.clientServiceAccountCreditLineAddressesRootPath method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    return util.format('m/%d/%d/0/0/0/2', ctnNodeIndex, clientIndex);
};

KeyStore.clientServiceAccountDebitLineAddressRootPath = function (ctnNodeIndex, clientIndex) {
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

        Catenis.logger.ERROR(util.format('KeyStore.clientServiceAccountDebitLineAddressesRootPath method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    return util.format('m/%d/%d/0/0/0/3', ctnNodeIndex, clientIndex);
};

KeyStore.clientBcotPaymentAddressRootPath = function (ctnNodeIndex, clientIndex) {
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

        Catenis.logger.ERROR(util.format('KeyStore.clientBcotPaymentAddressRootPath method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    return util.format('m/%d/%d/0/0/0/4', ctnNodeIndex, clientIndex);
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

KeyStore.deviceOffChainAddressRootPath = function (ctnNodeIndex, clientIndex, deviceIndex) {
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

        Catenis.logger.ERROR(util.format('KeyStore.deviceOffChainAddressRootPath method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    return util.format('m/%d/%d/1/%d/3', ctnNodeIndex, clientIndex, deviceIndex);
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
    sys_read_conf_root: Object.freeze({
        name: 'sys_read_conf_root',
        description: 'system read confirmation root',
        pathRegEx: /^m\/(\d+)\/0\/3$/,
        pathParts: {
            1: 'ctnNodeIndex'
        }
    }),
    sys_asset_root: Object.freeze({
        name: 'sys_asset_root',
        description: 'system asset root',
        pathRegEx: /^m\/(\d+)\/0\/4$/,
        pathParts: {
            1: 'ctnNodeIndex'
        }
    }),
    sys_bcot_sale_root: Object.freeze({
        name: 'sys_bcot_sale_root',
        description: 'system BCOT token sale root',
        pathRegEx: /^m\/(\d+)\/0\/5$/,
        pathParts: {
            1: 'ctnNodeIndex'
        }
    }),
    sys_oc_msgs_setlmt_root: Object.freeze({
        name: 'sys_oc_msgs_setlmt_root',
        description: 'system off-chain messages settlement root',
        pathRegEx: /^m\/(\d+)\/0\/6$/,
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
    sys_read_conf_spnd_root: Object.freeze({
        name: 'sys_read_conf_spnd_root',
        description: 'system read confirmation spend root',
        pathRegEx: /^m\/(\d+)\/0\/3\/0$/,
        pathParts: {
            1: 'ctnNodeIndex'
        }
    }),
    sys_read_conf_pay_tx_exp_root: Object.freeze({
        name: 'sys_read_conf_pay_tx_exp_root',
        description: 'system read confirmation pay tx expense root',
        pathRegEx: /^m\/(\d+)\/0\/3\/1$/,
        pathParts: {
            1: 'ctnNodeIndex'
        }
    }),
    sys_read_conf_spnd_ntfy_root: Object.freeze({
        name: 'sys_read_conf_spnd_ntfy_root',
        description: 'system read confirmation spend notify root',
        pathRegEx: /^m\/(\d+)\/0\/3\/0\/0$/,
        pathParts: {
            1: 'ctnNodeIndex'
        }
    }),
    sys_read_conf_spnd_only_root: Object.freeze({
        name: 'sys_read_conf_spnd_only_root',
        description: 'system read confirmation spend only root',
        pathRegEx: /^m\/(\d+)\/0\/3\/0\/1$/,
        pathParts: {
            1: 'ctnNodeIndex'
        }
    }),
    sys_read_conf_spnd_null_root: Object.freeze({
        name: 'sys_read_conf_spnd_null_root',
        description: 'system read confirmation spend null root',
        pathRegEx: /^m\/(\d+)\/0\/3\/0\/2$/,
        pathParts: {
            1: 'ctnNodeIndex'
        }
    }),
    sys_read_conf_spnd_ntfy_addr: Object.freeze({
        name: 'sys_read_conf_spnd_ntfy_addr',
        description: 'system read confirmation spend notify address',
        pathRegEx: /^m\/(\d+)\/0\/3\/0\/0\/(\d+)$/,
        pathParts: {
            1: 'ctnNodeIndex',
            2: 'addrIndex'
        }
    }),
    sys_read_conf_spnd_only_addr: Object.freeze({
        name: 'sys_read_conf_spnd_only_addr',
        description: 'system read confirmation spend only address',
        pathRegEx: /^m\/(\d+)\/0\/3\/0\/1\/(\d+)$/,
        pathParts: {
            1: 'ctnNodeIndex',
            2: 'addrIndex'
        }
    }),
    sys_read_conf_spnd_null_addr: Object.freeze({
        name: 'sys_read_conf_spnd_null_addr',
        description: 'system read confirmation spend null address',
        pathRegEx: /^m\/(\d+)\/0\/3\/0\/2\/(\d+)$/,
        pathParts: {
            1: 'ctnNodeIndex',
            2: 'addrIndex'
        }
    }),
    sys_read_conf_pay_tx_exp_addr: Object.freeze({
        name: 'sys_read_conf_pay_tx_exp_addr',
        description: 'system read confirmation pay tx expense address',
        pathRegEx: /^m\/(\d+)\/0\/3\/1\/(\d+)$/,
        pathParts: {
            1: 'ctnNodeIndex',
            2: 'addrIndex'
        }
    }),
    sys_serv_cred_root: Object.freeze({
        name: 'sys_serv_cred_root',
        description: 'system service credit root',
        pathRegEx: /^m\/(\d+)\/0\/4\/0$/,
        pathParts: {
            1: 'ctnNodeIndex'
        }
    }),
    sys_msig_sign_root: Object.freeze({
        name: 'sys_msig_sign_root',
        description: 'system multi-signature Colored Coins tx out signee root',
        pathRegEx: /^m\/(\d+)\/0\/4\/1$/,
        pathParts: {
            1: 'ctnNodeIndex'
        }
    }),
    sys_serv_cred_issu_root: Object.freeze({
        name: 'sys_serv_cred_issu_root',
        description: 'system service credit issuance root',
        pathRegEx: /^m\/(\d+)\/0\/4\/0$/,
        pathParts: {
            1: 'ctnNodeIndex'
        }
    }),
    sys_serv_pymt_pay_tx_exp_root: Object.freeze({
        name: 'sys_serv_pymt_pay_tx_exp_root',
        description: 'system service payment pay tx expense root',
        pathRegEx: /^m\/(\d+)\/0\/4\/0\/1$/,
        pathParts: {
            1: 'ctnNodeIndex'
        }
    }),
    sys_serv_cred_issu_addr: Object.freeze({
        name: 'sys_serv_cred_issu_addr',
        description: 'system service credit issuance address',
        pathRegEx: /^m\/(\d+)\/0\/4\/0\/0\/(\d+)$/,
        pathParts: {
            1: 'ctnNodeIndex',
            2: 'addrIndex'
        }
    }),
    sys_serv_pymt_pay_tx_exp_addr: Object.freeze({
        name: 'sys_serv_pymt_pay_tx_exp_addr',
        description: 'system service payment pay tx expense address',
        pathRegEx: /^m\/(\d+)\/0\/4\/0\/1\/(\d+)$/,
        pathParts: {
            1: 'ctnNodeIndex',
            2: 'addrIndex'
        }
    }),
    sys_msig_sign_addr: Object.freeze({
        name: 'sys_msig_sign_addr',
        description: 'system multi-signature Colored Coins tx out signee address',
        pathRegEx: /^m\/(\d+)\/0\/4\/1\/(\d+)$/,
        pathParts: {
            1: 'ctnNodeIndex',
            2: 'addrIndex'
        }
    }),
    sys_bcot_sale_stck_root: Object.freeze({
        name: 'sys_bcot_sale_stck_root',
        description: 'system BCOT token sale stock root',
        pathRegEx: /^m\/(\d+)\/0\/5\/0$/,
        pathParts: {
            1: 'ctnNodeIndex'
        }
    }),
    sys_bcot_sale_stck_addr: Object.freeze({
        name: 'sys_bcot_sale_stck_addr',
        description: 'system BCOT token sale stock address',
        pathRegEx: /^m\/(\d+)\/0\/5\/0\/(\d+)$/,
        pathParts: {
            1: 'ctnNodeIndex',
            2: 'addrIndex'
        }
    }),
    sys_oc_msgs_setlmt_pay_tx_exp_root: Object.freeze({
        name: 'sys_oc_msgs_setlmt_pay_tx_exp_root',
        description: 'system off-chain messages settlement pay tx expense root',
        pathRegEx: /^m\/(\d+)\/0\/6\/0$/,
        pathParts: {
            1: 'ctnNodeIndex'
        }
    }),
    sys_oc_msgs_setlmt_pay_tx_exp_addr: Object.freeze({
        name: 'sys_oc_msgs_setlmt_pay_tx_exp_addr',
        description: 'system off-chain messages settlement pay tx expense address',
        pathRegEx: /^m\/(\d+)\/0\/6\/0\/(\d+)$/,
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
    cln_msg_crd_addr_root: Object.freeze({      // DEPRECATED
        name: 'cln_msg_crd_addr_root',
        description: 'client message credit addresses root',
        pathRegEx: /^m\/(\d+)\/(\d+)\/0\/0\/0\/0$/,
        pathParts: {
            1: 'ctnNodeIndex',
            2: 'clientIndex'
        }
    }),
    cln_asst_crd_addr_root: Object.freeze({     // DEPRECATED
        name: 'cln_asst_crd_addr_root',
        description: 'client asset credit addresses root',
        pathRegEx: /^m\/(\d+)\/(\d+)\/0\/0\/0\/1$/,
        pathParts: {
            1: 'ctnNodeIndex',
            2: 'clientIndex'
        }
    }),
    cln_srv_acc_cred_ln_addr_root: Object.freeze({
        name: 'cln_srv_acc_cred_ln_addr_root',
        description: 'client service account credit line addresses root',
        pathRegEx: /^m\/(\d+)\/(\d+)\/0\/0\/0\/2$/,
        pathParts: {
            1: 'ctnNodeIndex',
            2: 'clientIndex'
        }
    }),
    cln_srv_acc_debt_ln_addr_root: Object.freeze({
        name: 'cln_srv_acc_debt_ln_addr_root',
        description: 'client service account debit line addresses root',
        pathRegEx: /^m\/(\d+)\/(\d+)\/0\/0\/0\/3$/,
        pathParts: {
            1: 'ctnNodeIndex',
            2: 'clientIndex'
        }
    }),
    cln_bcot_pay_addr_root: Object.freeze({
        name: 'cln_bcot_pay_addr_root',
        description: 'client BCOT token payment addresses root',
        pathRegEx: /^m\/(\d+)\/(\d+)\/0\/0\/0\/4$/,
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
    cln_msg_crd_addr: Object.freeze({       // DEPRECATED
        name: 'cln_msg_crd_addr',
        description: 'client message credit address',
        pathRegEx: /^m\/(\d+)\/(\d+)\/0\/0\/0\/0\/(\d+)$/,
        pathParts: {
            1: 'ctnNodeIndex',
            2: 'clientIndex',
            3: 'addrIndex'
        }
    }),
    cln_asst_crd_addr: Object.freeze({      // DEPRECATED
        name: 'cln_asst_crd_addr',
        description: 'client asset credit address',
        pathRegEx: /^m\/(\d+)\/(\d+)\/0\/0\/0\/1\/(\d+)$/,
        pathParts: {
            1: 'ctnNodeIndex',
            2: 'clientIndex',
            3: 'addrIndex'
        }
    }),
    cln_srv_acc_cred_ln_addr: Object.freeze({
        name: 'cln_srv_acc_cred_ln_addr',
        description: 'client service account credit line addresses',
        pathRegEx: /^m\/(\d+)\/(\d+)\/0\/0\/0\/2\/(\d+)$/,
        pathParts: {
            1: 'ctnNodeIndex',
            2: 'clientIndex',
            3: 'addrIndex'
        }
    }),
    cln_srv_acc_debt_ln_addr: Object.freeze({
        name: 'cln_srv_acc_debt_ln_addr',
        description: 'client service account debit line address',
        pathRegEx: /^m\/(\d+)\/(\d+)\/0\/0\/0\/3\/(\d+)$/,
        pathParts: {
            1: 'ctnNodeIndex',
            2: 'clientIndex',
            3: 'addrIndex'
        }
    }),
    cln_bcot_pay_addr: Object.freeze({
        name: 'cln_bcot_pay_addr',
        description: 'client BCOT token payment address',
        pathRegEx: /^m\/(\d+)\/(\d+)\/0\/0\/0\/4\/(\d+)$/,
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
    dev_off_chain_addr_root: Object.freeze({
        name: 'dev_off_chain_addr_root',
        description: 'device off-chain addresses root',
        pathRegEx: /^m\/(\d+)\/(\d+)\/1\/(\d+)\/3$/,
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
    dev_off_chain_addr: Object.freeze({
        name: 'dev_off_chain_addr',
        description: 'device off-chain address',
        pathRegEx: /^m\/(\d+)\/(\d+)\/1\/(\d+)\/3\/(\d+)$/,
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

    if (pos !== -1) {
        parentPath = path.slice(0, pos);
    }

    return parentPath !== undefined ? parentPath : null;
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
    return typeof index === 'number' && Number.isInteger(index) && index >= 0 && index < numClientServCredAddrRoots;
}

function addressEncryptionScheme(path) {
    if (useLegacyEncryptionScheme(path)) {
        return CryptoKeys.encryptionScheme.fixedIV;
    }
}

function useLegacyEncryptionScheme(path) {
    return cfgSettings.legacyEncryptScheme.some(entry => {
        const matchResult = path.match(KeyStore.extKeyType[entry.addrType].pathRegEx);

        if (matchResult) {
            return entry.addrRanges.some(pathParts => pathParts.every((pathPart, idx) => parseInt(matchResult[idx + 1]) === pathPart));
        }
        else {
            return false;
        }
    });
}


// Module code
//

// Definition of properties
Object.defineProperty(KeyStore, 'purgeUnusedExtKeyIntervalHandle', {
    get: function () {
        return purgeUnusedExtKeyIntervalHandle;
    },
    enumerable: true
});

// Lock function class
Object.freeze(KeyStore);
