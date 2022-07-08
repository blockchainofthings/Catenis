/**
 * Created by claudio on 2022-04-26
 */

//console.log('[NonFungibleToken.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
//import config from 'config';
// Meteor packages
import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { Asset } from './Asset';
import { CCTransaction } from './CCTransaction';


// Definition of classes
//

/**
 * Class used to represent a Non-Fungible Token (NonFungibleToken) database doc/rec
 */
export class NonFungibleToken {
    /**
     * NonFungibleToken database doc/rec
     * @typedef {Object} NonFungibleTokenRec
     * @property {string} _id MongoDB internal document ID provided by Meteor
     * @property {string} asset_id MongoDB internal ID of Asset doc/rec to which this non-fungible token pertains
     * @property {string} tokenId (Catenis attributed) External ID used to uniquely identify this non-fungible asset
     * @property {string} ccTokenId Colored Coins attributed ID of the non-fungible token
     * @property {string} name The non-fungible token name
     * @property {string} description A short description about this non-fungible token
     * @property {Date} createdDate Date and time when doc/rec has been created
     */

    /**
     * Class constructor
     * @param {NonFungibleTokenRec} docNFToken NonFungibleToken database doc/rec
     */
    constructor(docNFToken) {
        this.doc_id = docNFToken._id;
        this.asset_id = docNFToken.asset_id;
        this.tokenId = docNFToken.tokenId;
        this.ccTokenId = docNFToken.ccTokenId;
        this.name = docNFToken.name;
        this.description = docNFToken.description;
        this.createdDate = docNFToken.createdDate;

        /**
         * @type {Asset}
         * @private
         */
        this._asset = undefined
    }

    /**
     * Get the asset object to which this non-fungible token pertains
     * @returns {Asset}
     */
    get asset() {
        if (!this._asset) {
            this._asset = Asset.getAssetByDocId(this.asset_id);
        }

        return this._asset;
    }

    /**
     * Get the device ID of the device that issued this non-fungible token
     * @returns {string|undefined}
     */
    get issuingDeviceId() {
        return this.asset.issuingDevice ? this.asset.issuingDevice.deviceId : undefined;
    }

    /**
     * Retrieve the non-fungible token object with the given ID
     * @param {string} tokenId The external ID of the non-fungible token
     * @returns {NonFungibleToken}
     */
    static getNFTokenByTokenId(tokenId) {
        const docNFToken = Catenis.db.collection.NonFungibleToken.findOne({tokenId: tokenId});

        if (!docNFToken) {
            // Invalid non-fungible token ID
            throw new Meteor.Error('nf_token_invalid_id', 'Unable to find non-fungible token with the given token ID');
        }

        return new NonFungibleToken(docNFToken);
    }

    /**
     * Creates a new set of non-fungible token database docs/recs
     * @param {Asset} asset Asset object to which the non-fungible tokens pertain
     * @param {CCTransaction} ccTransact Colored Coins transaction used to issue new non-fungible tokens for the
     *                                    given non-fungible asset
     * @return {string[]} List of Catenis attributed ID of the newly issued non-fungible tokens
     */
    static createNFTokens(asset, ccTransact) {
        //  Validate arguments
        const errArg = {};

        if (!(asset instanceof Asset)) {
            errArg.asset = asset;
        }

        if (!(ccTransact instanceof CCTransaction)) {
            errArg.ccTransact = ccTransact;
        }

        if (Object.keys(errArg).length > 0) {
            const errArgs = Object.keys(errArg);

            Catenis.logger.ERROR(`NonFungibleToken.createNFTokens method called with invalid argument${errArgs.length > 1 ? 's' : ''}`, errArg);
            throw new TypeError(`Invalid ${errArgs.join(', ')} argument${errArgs.length > 1 ? 's' : ''}`);
        }

        // Make sure that the provided asset is a non-fungible asset
        if (!asset.isNonFungible) {
            Catenis.logger.ERROR('Non-fungible tokens cannot be created: asset is not a non-fungible asset', {
                asset
            });
            throw new Error('Non-fungible tokens cannot be created: asset is not a non-fungible asset');
        }

        // Make sure that the Colored Coins transaction is used to issue new non-fungible tokens for the given asset
        if (ccTransact.issuingInfo === undefined || asset.ccAssetId !== Asset.getCcAssetIdFromCcTransaction(ccTransact)
                || !ccTransact.issuingInfo.ccTokenIds || ccTransact.issuingInfo.ccTokenIds.length === 0) {
            //  Log error and throw exception
            Catenis.logger.ERROR('Non-fungible tokens cannot be created: Colored Coins transaction does not issue new non-fungible tokens for the given asset', {
                ccAssetId: asset.ccAssetId,
                ccTransact
            });
            throw new Error('Non-fungible tokens cannot be created: Colored Coins transaction does not issue new non-fungible tokens for the given asset');
        }

        // Retrieve the non-fungible tokens name and description from the Colored Coins metadata
        let nfTokenProps;

        if (ccTransact.ccMetadata && ccTransact.ccMetadata.nfTokenMetadata && ccTransact.ccMetadata.nfTokenMetadata.newTokens.length > 0) {
            nfTokenProps = ccTransact.ccMetadata.nfTokenMetadata.newTokens.map(tokenMetadata => {
                return tokenMetadata.tokenProps;
            });
        }

        if (!nfTokenProps) {
            // Unable to retrieve non-fungible tokens' name and description.
            //  Log error and throw exception
            Catenis.logger.ERROR('Non-fungible tokens cannot be created: unable to retrieve non-fungible tokens\' name and description from Colored Coins metadata', {
                ccTransact
            });
            throw new Error('Non-fungible tokens cannot be created: unable to retrieve non-fungible tokens\' name and description from Colored Coins metadata');
        }

        if (nfTokenProps.length !== ccTransact.issuingInfo.ccTokenIds.length) {
            // Number of non-fungible tokens in Colored Coins metadata does not match the number of non-fungible tokens being issued.
            //  Log error and throw exception
            Catenis.logger.ERROR('Non-fungible tokens cannot be created: number of non-fungible tokens in Colored Coins metadata does not match the number of non-fungible tokens being issued', {
                ccTransact
            });
            throw new Error('Non-fungible tokens cannot be created: number of non-fungible tokens in Colored Coins metadata does not match the number of non-fungible tokens being issued');
        }

        const tokenIds = [];
        const insertedDocIds = [];

        try {
            ccTransact.issuingInfo.ccTokenIds.forEach((ccTokenId, idx) => {
                const tokenProps = nfTokenProps[idx];
                const docNFToken = {
                    asset_id: asset.doc_id,
                    tokenId: newTokenId(ccTokenId),
                    ccTokenId: ccTokenId,
                    name: tokenProps.name,
                    description: tokenProps.description,
                    createdDate: new Date()
                };

                try {
                    insertedDocIds.push(Catenis.db.collection.NonFungibleToken.insert(docNFToken));
                }
                catch (err) {
                    // Error inserting new NonFungibleToken database doc/rec.
                    //  Log error and throw exception
                    Catenis.logger.ERROR('Error trying to create new non-fungible token database doc:', docNFToken, err);
                    throw new Meteor.Error('ctn_nf_token_insert_error', 'Error trying to create new non-fungible token database doc', err.stack);
                }

                tokenIds.push(docNFToken.tokenId);
            });
        }
        catch (err) {
            if ((err instanceof Meteor.Error) && err.error === 'ctn_nf_token_insert_error' && insertedDocIds.length > 0) {
                // Error inserting a new NonFungibleToken database doc/rec.
                //  Rollback all the inserted docs
                try {
                    Catenis.db.collection.NonFungibleToken.remove({_id: {$in: insertedDocIds}});
                }
                catch (err2) {
                    Catenis.logger.ERROR('Error trying to rollback all the inserted non-fungible token database docs.', {
                        insertedDocIds
                    }, err2);
                }
            }
        }

        return tokenIds;
    }

    /**
     * Retrieve Catenis attributed non-fungible token IDs from Colored Coins transaction
     * @param {CCTransaction} ccTransact The Colored Coins transaction
     * @returns {string[]} The list of retrieved non-fungible token IDs. Might be empty if the Colored Coins transaction
     *                      is not used to issued non-fungible tokens
     */
    static getTokenIdsFromCcTransact(ccTransact) {
        const tokenIds = [];

        if (ccTransact.issuingInfo && ccTransact.issuingInfo.ccTokenIds) {
            ccTransact.issuingInfo.ccTokenIds.forEach((ccTokenId) => {
                tokenIds.push(newTokenId(ccTokenId));
            });
        }

        return tokenIds;
    }
}


// Definition of module (private) functions
//

/**
 * Generates a new Catenis non-fungible token ID
 * @param {string} ccTokenId The Colored Coins attributed non-fungible token ID
 * @returns {string} The new Catenis non-fungible token ID
 */
function newTokenId(ccTokenId) {
    const seed = Catenis.application.commonSeed.toString() + ',Colored Coins non-fungible asset non-fungible token ID:' + ccTokenId;

    return 't' + Random.createWithSeeds(seed).id(19);
}


// Module code
//

// Lock class
Object.freeze(NonFungibleToken);
