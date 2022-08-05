/**
 * Created by claudio on 2022-02-21
 */

//console.log('[CCNFTokenMetadata.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
//import config from 'config';
// Meteor packages
//import { Meteor } from 'meteor/meteor';
// noinspection ES6CheckImport
import { Promise } from 'meteor/promise';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { CCSingleNFTokenMetadata } from './CCSingleNFTokenMetadata';
import { NFAssetIssuance } from './NFAssetIssuance';
import { NFTokenContentsReadable } from './NFTokenContentsReadable';
import { NFTokenStorage } from './NFTokenStorage';
import { CryptoKeys } from './CryptoKeys';
import { Util } from './Util';


// Definition of classes
//

/**
 * Colored Coins Non-Fungible Token Metadata class. It represents the 'nfTokenMetadata' property of
 *  the Colored Coins metadata
 */
export class CCNFTokenMetadata {
    /**
     * @typedef {CCMetaUserData[]} CCMetaNonFungibleTokenNewTokens
     */

    /**
     * @typedef {Object.<string, CCMetaUserData>} CCMetaNonFungibleTokenUpdate
     */

    /**
     * @typedef {Object} CCMetaNonFungibleToken
     * @property {CCMetaNonFungibleTokenNewTokens} [newTokens]
     * @property {CCMetaNonFungibleTokenUpdate} [update]
     */

    /**
     * Class constructor
     * @param {CCMetaNonFungibleToken} [nfTokenMetadata] Non-fungible token metadata used to initialize object
     * @param {(CryptoKeys|CryptoKeys[])} [decCryptoKeys] A list of crypto key-pairs associated with a blockchain
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
    constructor(nfTokenMetadata, decCryptoKeys) {
        /**
         * @type {CCSingleNFTokenMetadata[]}
         */
        this.newTokens = [];
        /**
         * @type {(Object.<string, CCSingleNFTokenMetadata>|undefined)}
         */
        this.update = undefined;

        if (Util.isNonNullObject(nfTokenMetadata)) {
            const decCryptoKeysSet = new CryptoKeysSet(decCryptoKeys);

            if (Array.isArray(nfTokenMetadata.newTokens)) {
                for (const tokenData of nfTokenMetadata.newTokens) {
                    const nfTokenData = new CCSingleNFTokenMetadata(tokenData, decCryptoKeysSet.next());

                    if (!nfTokenData.isEmpty) {
                        this.newTokens.push(nfTokenData);
                    }
                }
            }

            if (Util.isNonNullObject(nfTokenMetadata.update)) {
                const update = {};

                Object.keys(nfTokenMetadata.update).forEach(tokenId => {
                    const nfTokenData = new CCSingleNFTokenMetadata(nfTokenMetadata.update[tokenId], decCryptoKeysSet.get(tokenId));

                    if (!nfTokenData.isEmpty) {
                        update[tokenId] = nfTokenData;
                    }
                });

                if (Object.keys(update).length > 0) {
                    this.update = update;
                }
            }
        }
    }

    /**
     * Checks whether no token info has been specified yet
     * @returns {boolean}
     */
    get isEmpty() {
        return this.newTokens.length === 0 && this.update === undefined;
    }

    /**
     * Set new non-fungible token metadata data from (previously set) non-fungible asset issuance
     * @private
     */
    _setNewTokensFromAssetIssuance() {
        const nfAssetIssuance = this._fromAssetIssuance.nfAssetIssuance;

        try {
            // Store non-fungible tokens' contents onto IPFS
            const contentsNFTokenIndices = nfAssetIssuance.nfTokensWithContents;
            const encryptNFTokenContents = nfAssetIssuance.encryptNFTokenContents;
            const storeContentsNFTokenIndices = [];
            const promises = [];

            for (let nfTokenIdx = 0, length = nfAssetIssuance.numberOfNFTokens; nfTokenIdx < length; nfTokenIdx++) {
                let tokenWithContents;

                if ((tokenWithContents = contentsNFTokenIndices.includes(nfTokenIdx)) || encryptNFTokenContents) {
                    const nfTokenContentsStream = new NFTokenContentsReadable(
                        nfAssetIssuance,
                        tokenWithContents ? nfTokenIdx : 0
                    );

                    if (encryptNFTokenContents) {
                        nfTokenContentsStream.setEncryption(this._fromAssetIssuance.encCryptoKeysSet.next());
                    }

                    promises.push(new NFTokenStorage().store(nfTokenContentsStream));
                    storeContentsNFTokenIndices.push(nfTokenIdx);
                }
            }

            const contentsCIDs = Promise.await(Promise.all(promises));

            // Compose dictionary of contents CIDs indexed by non-fungible token indices
            const nfTokenIdxContentsCIDs = storeContentsNFTokenIndices.reduce((obj, tokenIdx, idx) => {
                obj[tokenIdx] = contentsCIDs[idx];
                return obj;
            }, {});

            // Get non-fungible tokens properties to be added to the metadata
            const nfTokensProps = nfAssetIssuance.getNFTokensMetadata(nfTokenIdxContentsCIDs);

            if (nfTokensProps.length > 0) {
                this.newTokens = nfTokensProps.map(nfTokenProps => {
                    const tokenData = new CCSingleNFTokenMetadata();
                    tokenData.setNFTokenProperties(nfTokenProps);

                    return tokenData;
                })
            }
        }
        catch (err) {
            Catenis.logger.ERROR('Error while getting non-fungible token metadata from non-fungible asset issuance.', {
                nfAssetIssuance
            }, err);
            throw new Error(`Error while getting non-fungible token metadata from non-fungible asset issuance: ${err}`);
        }
    }

    /**
     * Render the 'newTokens' property of the non-fungible toke metadata to make it ready
     *  to be added to the Colored Coins metadata
     * @param {CryptoKeysSet} encCryptoKeysSet The crypto key-pair set from where to get the crypto key-pairs
     *                                      associated with a blockchain address that should be used for encrypting
     *                                      selected non-fungible token data
     * @return {(CCMetaNonFungibleTokenNewTokens|undefined)}
     * @private
     */
    _assembleNewTokens(encCryptoKeysSet) {
        if (this.newTokens.length === 0 && this._fromAssetIssuance) {
            this._setNewTokensFromAssetIssuance();
            encCryptoKeysSet = this._fromAssetIssuance.encCryptoKeysSet;
            encCryptoKeysSet.rewind();
        }

        const assembledNewTokens = [];

        if (this.newTokens.length > 0) {
            for (const tokenData of this.newTokens) {
                const assembledTokenData = tokenData.assemble(encCryptoKeysSet.next());

                if (assembledTokenData) {
                    assembledNewTokens.push(assembledTokenData);
                }
            }
        }

        return assembledNewTokens.length > 0 ? assembledNewTokens : undefined;
    }

    /**
     * Render the 'update' property of the non-fungible toke metadata to make it ready
     *  to be added to the Colored Coins metadata
     * @param {CryptoKeysSet} encCryptoKeysSet The crypto key-pair set from where to get the crypto key-pairs associated
     *                                      with a blockchain address that should be used for encrypting selected
     *                                      non-fungible token data
     * @return {(CCMetaNonFungibleTokenUpdate|undefined)}
     * @private
     */
    _assembleUpdate(encCryptoKeysSet) {
        const assembledUpdate = {};

        if (this.update) {
            for (const [tokenId, tokenData] of Object.entries(this.update)) {
                const assembledTokenData = tokenData.assemble(encCryptoKeysSet.get(tokenId));

                if (assembledTokenData) {
                    assembledUpdate[tokenId] = assembledTokenData;
                }
            }
        }

        return Object.keys(assembledUpdate).length > 0 ? assembledUpdate : undefined;
    }

    /**
     * Clone this object
     * @return {CCNFTokenMetadata}
     */
    clone() {
        const clone = Util.cloneObj(this);

        if (clone.newTokens) {
            clone.newTokens = Util.cloneObjArray(clone.newTokens, true);
        }

        if (clone.update) {
            clone.update = Util.cloneObjDict(clone.update, true);
        }

        return clone;
    }

    /**
     * Set non-fungible asset issuance from where non-fungible token metadata is to be gotten
     * @param {NFAssetIssuance} nfAssetIssuance The non-fungible asset issuance
     * @param {(CryptoKeys|CryptoKeys[])} [encCryptoKeys] A list of crypto key-pairs associated with a blockchain
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
    fromAssetIssuance(nfAssetIssuance, encCryptoKeys) {
        // Validate arguments
        const errArg = {};

        if (!(nfAssetIssuance instanceof NFAssetIssuance)) {
            errArg.nfAssetIssuance = nfAssetIssuance;
        }

        if (encCryptoKeys !== undefined && !(encCryptoKeys instanceof CryptoKeys) && !Array.isArray(encCryptoKeys)) {
            errArg.encCryptoKeys = encCryptoKeys;
        }

        if (Object.keys(errArg).length > 0) {
            const errArgs = Object.keys(errArg);

            Catenis.logger.ERROR(`CCNFTokenMetadata.fromNFAssetIssuance() method called with invalid argument${errArgs.length > 1 ? 's' : ''}`, errArg);
            throw new TypeError(`Invalid ${errArgs.join(', ')} argument${errArgs.length > 1 ? 's' : ''}`);
        }

        // Save parameters to precess later
        this._fromAssetIssuance = {
            nfAssetIssuance,
            encCryptoKeysSet: new CryptoKeysSet(encCryptoKeys)
        };
    }

    /**
     * Add metadata for newly issued non-fungible tokens
     * @param {(CCSingleNFTokenMetadata[]|CCSingleNFTokenMetadata)} metadata A list of or a single non-fungible token
     *                                                      metadata to add
     */
    addNewNFTokensMetadata(metadata) {
        // Validate arguments
        const errArg = {};

        if (!(metadata instanceof CCSingleNFTokenMetadata)
                && (!Array.isArray(metadata) || metadata.length === 0
                || metadata.some(data => !(data instanceof CCSingleNFTokenMetadata)))) {
            errArg.metadata = metadata;
        }

        if (Object.keys(errArg).length > 0) {
            const errArgs = Object.keys(errArg);

            Catenis.logger.ERROR(`CCNFTokenMetadata.addNewNFTokenMetadata() method called with invalid argument${errArgs.length > 1 ? 's' : ''}`, errArg);
            throw new TypeError(`Invalid ${errArgs.join(', ')} argument${errArgs.length > 1 ? 's' : ''}`);
        }

        if (!Array.isArray(metadata)) {
            metadata = [metadata];
        }

        // Add new token metadata to the list
        this.newTokens = this.newTokens.concat(metadata);
    }

    /**
     * Add a single non-fungible token metadata to be updated
     * @param {string} tokenId The ID of the non-fungible token to be updated
     * @param {CCSingleNFTokenMetadata} metadata The updated single non-fungible token metadata
     * @return {CCNFTokenMetadata} Return this object to allow method chaining
     */
    addNFTokenMetadataToUpdate(tokenId, metadata) {
        // Validate arguments
        const errArg = {};

        if (typeof tokenId !== 'string') {
            errArg.tokenId = tokenId;
        }

        if (!(metadata instanceof CCSingleNFTokenMetadata)) {
            errArg.metadata = metadata;
        }

        if (Object.keys(errArg).length > 0) {
            const errArgs = Object.keys(errArg);

            Catenis.logger.ERROR(`CCNFTokenMetadata.addNFTokenMetadataToUpdate() method called with invalid argument${errArgs.length > 1 ? 's' : ''}`, errArg);
            throw new TypeError(`Invalid ${errArgs.join(', ')} argument${errArgs.length > 1 ? 's' : ''}`);
        }

        //  Add token metadata to update
        if (!this.update) {
            this.update = {};
        }

        this.update[tokenId] = metadata;

        return this;
    }

    /**
     * Render the non-fungible token metadata to make it ready to be added to the Colored Coins metadata
     * @param {(CryptoKeys|CryptoKeys[])} [encCryptoKeys] A list of crypto key-pairs associated with a blockchain
     *                                      address that should be used for encrypting selected non-fungible token
     *                                      metadata data. Key-pairs for new non-fungible token metadata are indexed by
     *                                      their numeric position (starting from zero) on the list (natural array
     *                                      indexing), and the special index -1 is used as a wildcard. On the other
     *                                      hand, key-pairs for updated non-fungible token metadata are indexed by the
     *                                      respective non-fungible token ID, and the special index "*" is used as a
     *                                      wildcard. Optionally, a single crypto key-pair may be passed. In that case,
     *                                      the single key-pair is used as the new non-fungible token metadata wildcard
     *                                      (equivalent to a key-pair from the list at index -1)
     * @return {(CCMetaNonFungibleToken|undefined)}
     */
    assemble(encCryptoKeys) {
        const assembledNFTokenMetadata = {};

        const encCryptoKeysSet = new CryptoKeysSet(encCryptoKeys);

        const assembledNewTokens = this._assembleNewTokens(encCryptoKeysSet);
        const assembledUpdate = this._assembleUpdate(encCryptoKeysSet);

        if (assembledNewTokens) {
            assembledNFTokenMetadata.newTokens = assembledNewTokens
        }

        if (assembledUpdate) {
            assembledNFTokenMetadata.update = assembledUpdate;
        }

        return Object.keys(assembledNFTokenMetadata).length > 0 ? assembledNFTokenMetadata : undefined;
    }
}

/**
 * Controls the crypto key-pairs used to encrypt/decrypt non-fungible token metadata user data
 */
export class CryptoKeysSet {
    /**
     * Class constructor
     * @param {(CryptoKeys|CryptoKeys[])} [cryptoKeys]
     */
    constructor(cryptoKeys) {
        if (cryptoKeys) {
            if (Array.isArray(cryptoKeys)) {
                if (-1 in cryptoKeys) {
                    /**
                     * @type {CryptoKeys}
                     */
                    this.newTokensWildcard = cryptoKeys[-1];
                }

                if ('*' in cryptoKeys) {
                    /**
                     * @type {CryptoKeys}
                     */
                    this.updateWildcard = cryptoKeys['*'];
                }

                /**
                 * @type {CryptoKeys[]}
                 */
                this.listCryptoKeys = cryptoKeys;
            }
            else {
                this.newTokensWildcard = cryptoKeys;
            }
        }

        this.index = -1;
    }

    /**
     * Get the next crypto key-pair for new non-fungible token metadata from the set
     * @return {(CryptoKeys|undefined)}
     */
    next() {
        this.index++;

        return this.listCryptoKeys && (this.index in this.listCryptoKeys)
            ? this.listCryptoKeys[this.index]
            : (this.newTokensWildcard ? this.newTokensWildcard : undefined);
    }

    /**
     * Restart internal index so that the next crypto key-pair returned is for the first
     *  new non-fungible token metadata
     */
    rewind() {
        this.index = -1;
    }

    /**
     * Get crypto key-pair from the set by an index
     * @param {(number|string)} index The key-pair index. If numeric, get key-pair for new non-fungible token metadata.
     *                                 If a string, get key-pair for updated non-fungible token metadata
     * @return {(CryptoKeys|undefined)}
     */
    get(index) {
        if (typeof index === 'number') {
            // Getting crypto key-pair for new non-fungible token metadata
            return this.listCryptoKeys && (index in this.listCryptoKeys)
                ? this.listCryptoKeys[index]
                : (this.newTokensWildcard ? this.newTokensWildcard : undefined);
        }
        else if (typeof index === 'string') {
            // Getting crypto key-pair for update non-fungible token metadata
            return this.listCryptoKeys && (index in this.listCryptoKeys)
                ? this.listCryptoKeys[index]
                : (this.updateWildcard ? this.updateWildcard : undefined);
        }
    }
}


// Definition of module (private) functions
//


// Module code
//


// Lock class
Object.freeze(CCNFTokenMetadata);
