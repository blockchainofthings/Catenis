/**
 * Created by claudio on 2022-02-23
 */

//console.log('[CCMetadata.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import { CID } from 'ipfs-http-client';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { CCAssetMetadata } from './CCAssetMetadata';
import { CCNFTokenMetadata } from './CCNFTokenMetadata';
import { BufferProgressReadable } from './BufferProgressReadable';
import { Util } from './Util';


// Definition of classes
//

/**
 * Colored Coins Metadata class
 */
export class CCMetadata {
    /**
     * @typedef {Object} ColoredCoinsMetadata
     * @property {CCMetaAsset} [metadata]
     * @property {CCMetaNonFungibleToken} [nfTokenMetadata]
     */

    /**
     * Class constructor
     * @param {ColoredCoinsMetadata} [metadata] The Colored Coins metadata used to initialize object
     * @param {CryptoKeys} [assetDecCryptoKeys] The crypto key-pair associated with a blockchain address that should be
     *                                           used to decrypt encrypted asset free user data
     * @param {(CryptoKeys|CryptoKeys[])} [nfTokenDecCryptoKeys] A list of crypto key-pairs associated with a blockchain
     *                                      address that should be used for decrypting encrypted non-fungible token
     *                                      metadata data. Key-pairs for new non-fungible token metadata are indexed by
     *                                      their numeric position (starting from zero) on the list (natural array
     *                                      indexing), and the special index -1 is used as a wildcard. On the other
     *                                      hand, key-pairs for updated non-fungible token metadata are indexed by the
     *                                      respective non-fungible token ID, and the special index "*" is used as a
     *                                      wildcard. Optionally, a single crypto key-pair may be passed. In that case,
     *                                      the single key-pair is used as the new non-fungible token metadata wildcard
     *                                      (equivalent to a key-pair from the list at index -1)
     */
    constructor(metadata, assetDecCryptoKeys, nfTokenDecCryptoKeys) {
        if (Util.isNonNullObject(metadata)) {
            this.assetMetadata = new CCAssetMetadata(metadata.metadata, assetDecCryptoKeys);
            this.nfTokenMetadata = new CCNFTokenMetadata(metadata.nfTokenMetadata, nfTokenDecCryptoKeys);
            this.metadata = metadata;
        }
        else {
            this.assetMetadata = new CCAssetMetadata();
            this.nfTokenMetadata = new CCNFTokenMetadata();
            this.metadata = undefined;
        }

        this.storeResult = undefined;
    }

    /**
     * Indicates whether the Colored Coins metadata has already been rendered
     * @return {boolean}
     */
    get isAssembled() {
        return this.metadata !== undefined;
    }

    /**
     * Indicates whether the rendered Colored Coins metadata has already been stored onto IPFS
     * @return {boolean}
     */
    get isStored() {
        return this.storeResult !== undefined;
    }

    /**
     * Get the estimated size of the Colored Coins metadata in bytes
     * @returns {number}
     */
    get estimatedSize() {
        return this.isAssembled ? Buffer.from(JSON.stringify(this.metadata)).length : 0;
    }

    /**
     * Clone this object
     * @return {CCMetadata}
     */
    clone() {
        const clone = Util.cloneObj(this);

        if (clone.assetMetadata) {
            clone.assetMetadata = clone.assetMetadata.clone();
        }

        if (clone.nfTokenMetadata) {
            clone.nfTokenMetadata = clone.nfTokenMetadata.clone();
        }

        if (clone.metadata) {
            clone.metadata = Util.cloneObjDict(clone.metadata);
        }

        if (clone.storeResult) {
            clone.storeResult = Util.cloneObj(clone.storeResult);
        }

        return clone;
    }

    /**
     * Reset Colored Coins metadata object clearing the rendered metadata and store result
     */
    reset() {
        this.metadata = this.storeResult = undefined;
    }

    /**
     * Render the Colored Coins metadata
     * @param {CryptoKeys} [assetEncCryptoKeys] The crypto key-pair associated with a blockchain address that should be
     *                                           used for encrypting selected free user data
     * @param {(CryptoKeys|CryptoKeys[])} [nfTokenEncCryptoKeys] A list of crypto key-pairs associated with a blockchain
     *                                      address that should be used for encrypting selected non-fungible token
     *                                      metadata data. Key-pairs for new non-fungible token metadata are indexed by
     *                                      their numeric position (starting from zero) on the list (natural array
     *                                      indexing), and the special index -1 is used as a wildcard. On the other
     *                                      hand, key-pairs for updated non-fungible token metadata are indexed by the
     *                                      respective non-fungible token ID, and the special index "*" is used as a
     *                                      wildcard. Optionally, a single crypto key-pair may be passed. In that case,
     *                                      the single key-pair is used as the new non-fungible token metadata wildcard
     *                                      (equivalent to a key-pair from the list at index -1)
     */
    assemble(assetEncCryptoKeys, nfTokenEncCryptoKeys) {
        if (!this.isAssembled) {
            const assembledMetadata = {};

            const assembledAssetMetadata = this.assetMetadata.assemble(assetEncCryptoKeys);
            const assembledNFTokenMetadata = this.nfTokenMetadata.assemble(nfTokenEncCryptoKeys);

            if (assembledAssetMetadata) {
                assembledMetadata.metadata = assembledAssetMetadata;
            }

            if (assembledNFTokenMetadata) {
                assembledMetadata.nfTokenMetadata = assembledNFTokenMetadata;
            }

            if (Object.keys(assembledMetadata).length > 0) {
                this.metadata = assembledMetadata;
            }
        }
        else {
            Catenis.logger.WARN('Trying to assemble Colored Coins metadata that is already assembled', this);
        }
    }

    /**
     * @typedef {Object} CCMetaStoreResult
     * @property {string} cid Hex-encoded (from binary) IPFS CID of the stored Colored Coins metadata
     */

    /**
     * @callback StoreProgressCallback
     * @param {number} bytesStored Number of (additional) bytes that have just been stored
     */

    /**
     * Stored the rendered Colored Coins metadata onto IFPS
     * @param {StoreProgressCallback} [progressCallback] Callback to report progress while storing the metadata
     * @return {(CCMetaStoreResult|undefined)}
     */
    store(progressCallback) {
        if (!this.isStored) {
            if (this.isAssembled) {
                try {
                    // Save metadata onto IPFS
                    const metadata = Buffer.from(JSON.stringify(this.metadata));
                    const dataSource = typeof progressCallback === 'function'
                        ? new BufferProgressReadable(metadata, progressCallback)
                        : metadata;

                    const cidObj = Catenis.ipfsClient.add(dataSource).cid;

                    this.storeResult = {
                        cid: Buffer.from(cidObj.bytes).toString('hex')
                    };
                }
                catch (err) {
                    Catenis.logger.ERROR('Error while storing Colored Coins metadata onto IPFS.', err);
                }
            }
            else {
                Catenis.logger.WARN('No Colored Coins metadata to store');
            }
        }
        else {
            Catenis.logger.WARN('Trying to store Colored Coins metadata that is already stored', this);
        }

        return this.storeResult;
    }

    // Class (public) methods
    //

    /**
     * Get Colored Coins metadata from IPFS
     * @param {Buffer} cid The CID of the metadata on IPFS in binary representation
     * @param {CryptoKeys} [assetDecCryptoKeys] The crypto key-pair associated with a blockchain address that should be
     *                                           used to decrypt encrypted asset free user data
     * @param {(CryptoKeys|CryptoKeys[])} [nfTokenDecCryptoKeys] A list of crypto key-pairs associated with a blockchain
     *                                      address that should be used for decrypting encrypted non-fungible token
     *                                      metadata data. Key-pairs for new non-fungible token metadata are indexed by
     *                                      their numeric position (starting from zero) on the list (natural array
     *                                      indexing), and the special index -1 is used as a wildcard. On the other
     *                                      hand, key-pairs for updated non-fungible token metadata are indexed by the
     *                                      respective non-fungible token ID, and the special index "*" is used as a
     *                                      wildcard. Optionally, a single crypto key-pair may be passed. In that case,
     *                                      the single key-pair is used as the new non-fungible token metadata wildcard
     *                                      (equivalent to a key-pair from the list at index -1)
     * @return {CCMetadata}
     */
    static fromCID(cid, assetDecCryptoKeys, nfTokenDecCryptoKeys) {
        let metadata;

        try {
            const cidObj = CID.decode(cid);

            metadata = Catenis.ipfsClient.cat(cidObj);
        }
        catch (err) {
            Catenis.logger.ERROR('Error trying to retrieve Colored Coins metadata from IPFS.', err);
        }

        if (metadata) {
            try {
                const ccMetadata = new CCMetadata(JSON.parse(metadata), assetDecCryptoKeys, nfTokenDecCryptoKeys);

                ccMetadata.storeResult = {
                    cid: cid.toString('hex')
                };

                return ccMetadata;
            }
            catch (err) {
                Catenis.logger.ERROR('Error parsing Colored Coins metadata.', err);
            }
        }
    }

    /**
     * Checks whether Colored Coins metadata (previously) stored on BitTorrent had already
     *  been stored onto IPFS, and returns its CID if it did
     * @param {string} torrentHash The Torrent hash of the Colored Coins metadata on BitTorrent
     * @return {(Buffer|undefined)} CID (in binary format) of Colored Coins metadata on IPFS, or
     *                               undefined if metadata is not yet stored on IPFS
     */
    static checkCIDConverted(torrentHash) {
        const ccMetaConvert = Catenis.db.collection.CCMetadataConversion.findOne({
            torrentHash: torrentHash
        }, {
            fields: {
                cid: true
            }
        });

        return ccMetaConvert ? Buffer.from(ccMetaConvert.cid, 'hex') : undefined;
    }
}


// Definition of module (private) functions
//


// Module code
//

// Lock class
Object.freeze(CCMetadata);
