/**
 * Created by claudio on 2022-02-12
 */

//console.log('[NFTokenIssuingBatch.js]: This code just ran.');

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
import { NFAssetIssuance } from './NFAssetIssuance';
import { NFTokenIssuingPart } from './NFTokenIssuingPart';
import { Util } from './Util';


// Definition of classes
//

/**
 * Non-Fungible Token Issuing Batch object class
 */
export class NFTokenIssuingBatch {
    /**
     * NonFungibleTokenIssuingBatch database doc/rec
     * @typedef {Object} NonFungibleTokenIssuingBatchRec
     * @property {string} _id MongoDB internal document ID provided by Meteor
     * @property {string} nfTokenIssuingBatchId External ID used to uniquely identify this non-fungible token issuing
     *                                           batch. Note: this should be used as a  continuation token when passing
     *                                           a following non-fungible token issuing batch
     * @property {string} nonFungibleAssetIssuance_id MongoDB internal ID of the non-fungible asset issuance doc/rec to
     *                                                 which this non-fungible token issuing batch belongs
     * @property {number} order The order (starting from 1) in which this non-fungible token issuing batch has been
     *                           passed
     * @property {boolean} isFinal Indicates whether this is the last non-fungible token issuing batch of the asset
     *                              issuance
     * @property {Date} createdDate Date and time when database doc/rec has been created
     */

    /**
     * Class constructor
     *
     *  NOTE: objects of this class should be instantiated and used from code executed from the NFAssetIssuance.dbCS
     *         critical section object, while the associated asset issuance is being composed.
     *
     * @param {NonFungibleTokenIssuingBatchRec} [doc] NonFungibleTokenIssuingBatch database doc/rec
     * @param {boolean} [preloadNFTContents=false] Indicates whether non-fungible tokens' contents should be preloaded
     * @param {NFAssetIssuance} [nfAssetIssuance] Non-fungible asset issuance object with which this non-fungible token
     *                                             issuing batch is associated
     * @param {NonFungibleTokenInfoEntry[]} [nfTokenInfos] List of information about the non-fungible tokens being issued
     * @param {boolean} [isFinal=false] Indicates whether this is the last batch of the asset issuance
     */
    constructor(doc, preloadNFTContents = false, nfAssetIssuance, nfTokenInfos, isFinal = false) {
        if (doc) {
            this.doc_id = doc._id;
            this.nfTokenIssuingBatchId = doc.nfTokenIssuingBatchId;
            this.nonFungibleAssetIssuance_id = doc.nonFungibleAssetIssuance_id;
            this.order = doc.order;
            this.isFinal = doc.isFinal;
            this.createdDate = doc.createdDate;

            this._loadNFTokenIssuingParts(preloadNFTContents);
        }
        else {
            // Creating a new non-fungible token issuing batch object.
            //  Validate arguments
            const errArg = {};

            if (!(nfAssetIssuance instanceof NFAssetIssuance)) {
                errArg.nfAssetIssuance = nfAssetIssuance;
            }

            if (!Array.isArray(nfTokenInfos) || nfTokenInfos.length === 0 || nfTokenInfos.some(info => typeof info !== 'object')) {
                errArg.nfTokenInfos = nfTokenInfos;
            }

            if (Object.keys(errArg).length > 0) {
                const errArgs = Object.keys(errArg);

                Catenis.logger.ERROR(`NFTokenIssuingBatch constructor called with invalid argument${errArgs.length > 1 ? 's' : ''}`, errArg);
                throw new TypeError(`Invalid ${errArgs.join(', ')} argument${errArgs.length > 1 ? 's' : ''}`);
            }

            // Validate consistency of data
            if (nfAssetIssuance.isComplete) {
                throw new Meteor.Error('nft_issue_batch_issuance_already_complete', 'Unable to create new non-fungible token issuing batch: non-fungible asset issuance is already complete');
            }

            this.order = nfAssetIssuance.nextBatchOrder;

            if (nfTokenInfos && ((this.isFirstBatch && (nfTokenInfos.length !== nfAssetIssuance.numberOfNFTokens
                    || Util.nonNullArrayLength(nfTokenInfos) !== nfTokenInfos.length))
                    || (!this.isFirstBatch && nfTokenInfos.length > nfAssetIssuance.numberOfNFTokens))) {
                Catenis.logger.ERROR('Unable to create new non-fungible token issuing batch: inconsistent number of tokens');
                throw new Meteor.Error('nft_issue_batch_wrong_num_tokens', 'Unable to create new non-fungible token issuing batch: inconsistent number of tokens');
            }

            this._nfAssetIssuance = nfAssetIssuance;
            this.isFinal = !!isFinal;

            this._initNFTokenIssuingParts(nfTokenInfos);
        }
    }

    /**
     * Indicates whether this is the first non-fungible token issuing batch of the asset issuance
     * @return {boolean}
     */
    get isFirstBatch() {
        return this.order === 1;
    }

    /**
     * Retrieve the database doc/rec ID of the previous non-fungible token issuing batch of the asset issuance
     * @return {(string|undefined)}
     */
    get previousBatchDocId() {
        if (this.order > 1) {
            const doc = Catenis.db.collection.NonFungibleTokenIssuingBatch.findOne({
                nonFungibleAssetIssuance_id: this.nonFungibleAssetIssuance_id || this._nfAssetIssuance.doc_id,
                order: this.order - 1
            }, {
                fields: {
                    _id: 1
                }
            });

            if (doc) {
                return doc._id;
            }
        }
    }

    /**
     * Indicates whether this non-fungible token issuing batch is already saved to the database
     * @return {boolean}
     */
    get isSavedToDB() {
        return !!this.doc_id;
    }

    /**
     * Load the non-fungible issuing parts associated with this non-fungible token issuing batch
     * @param {boolean} [preloadContents=false] Indicates whether the contents of the non-fungible token issuing parts
     *                                           should be preloaded
     * @private
     */
    _loadNFTokenIssuingParts(preloadContents = false) {
        this.nfTokenIssuingParts = [];

        const fields = !preloadContents ? {contents: 0} : {};

        Catenis.db.collection.NonFungibleTokenIssuingPart.find({
            nonFungibleTokenIssuingBatch_id: this.doc_id
        }, {
            fields,
            sort: {
                index: 1
            }
        })
        .fetch()
        .forEach(doc => {
           this.nfTokenIssuingParts[doc.index] = new NFTokenIssuingPart(doc);
        });
    }

    /**
     * Initialize non-fungible token issuing parts for this batch
     * @param {NonFungibleTokenInfoEntry[]} [nfTokenInfos] List of information about the non-fungible tokens being issued
     * @private
     */
    _initNFTokenIssuingParts(nfTokenInfos) {
        this.nfTokenIssuingParts = [];

        nfTokenInfos.forEach((nfTokenInfo, idx) => {
            if (nfTokenInfo) {
                this.nfTokenIssuingParts[idx] = new NFTokenIssuingPart(undefined, this, nfTokenInfo, idx);
            }
        });

        // Make sure that batch has at least one non-fungible token issuing part
        if (this.nfTokenIssuingParts.length === 0) {
            throw new Meteor.Error('nft_issue_batch_no_token_info', 'Unable to create new non-fungible token issuing batch: missing non-fungible token info');
        }
    }

    /**
     * Save non-fungible token issuing batch object to the database
     */
    saveToDB() {
        // Make sure that it has not yet been saved to the database
        if (!this.isSavedToDB) {
            // Make sure that associated non-fungible asset issuance is already saved to the database
            if (!this._nfAssetIssuance.isSavedToDB) {
                Catenis.logger.ERROR('Unable to save non-fungible token issuing batch to database: associated asset issuance not yet saved', {
                    nfTokenIssuingBatch: this
                });
                throw new Error('Unable to save non-fungible token issuing batch to database: associated asset issuance not yet saved');
            }

            const doc = {
                nfTokenIssuingBatchId: this.nfTokenIssuingBatchId = newNFTokenIssuingBatchId(),
                nonFungibleAssetIssuance_id: this.nonFungibleAssetIssuance_id = this._nfAssetIssuance.doc_id,
                order: this.order,
                isFinal: this.isFinal,
                createdDate: this.createdDate = new Date()
            };

            try {
                this.doc_id = Catenis.db.collection.NonFungibleTokenIssuingBatch.insert(doc);
            }
            catch (err) {
                Catenis.logger.ERROR('Failure while inserting new NonFungibleTokenIssuingBatch database doc/rec.', err);
                throw new Error(`Failure while inserting new NonFungibleTokenIssuingBatch database doc/rec: ${err}`);
            }

            // Now, save to database all non-fungible token issuing parts associated
            //  with this non-fungible token issuing batch
            this.nfTokenIssuingParts.forEach(nfTokenIssuingPart => {
                nfTokenIssuingPart.saveToDB();
            });
        }
    }

    /**
     * Mark this non-fungible token issuing batch as the final batch of the non-fungible asset issuance
     */
    setFinal() {
        if (!this.isFinal) {
            try {
                Catenis.db.collection.NonFungibleTokenIssuingBatch.update(this.doc_id, {
                    $set: {
                        isFinal: true
                    }
                });

                this.isFinal = true;
            }
            catch (err) {
                // Error setting non-fungible token issuing batch as final. Log error and throw exception
                Catenis.logger.ERROR('Error setting non-fungible token issuing batch (doc_id: %s) as final.', this.doc_id, err);
                throw new Error(`Error setting non-fungible token issuing batch (doc_id: ${this.doc_id}) as final: ${err}`);
            }
        }
    }

    /**
     * For a given non-fungible token get the token's issuing part for this issuing batch
     * @param {number} nfTokenIdx The index of the non-fungible token of the asset issuance with which this issuing
     *                             batch is associated
     * @return {(NFTokenIssuingPart|undefined)}
     */
    getNFTokenIssuingPart(nfTokenIdx) {
        // Validate argument
        if (!Number.isInteger(nfTokenIdx) || nfTokenIdx < 0) {
            Catenis.logger.ERROR('NFTokenIssuingBatch.getNFTokenIssuingPart function called with invalid argument:', {
                nfTokenIdx
            });
            throw new TypeError('Invalid nfTokenIdx argument');
        }

        return this.nfTokenIssuingParts[nfTokenIdx];
    }
}


// Definition of module (private) functions
//

/**
 * Generate a new non-fungible token issuing batch ID
 * @param {boolean} checkExistence Indicates whether to check if newly generated ID already exists
 * @return {string} The newly generated ID
 */
function newNFTokenIssuingBatchId(checkExistence = true) {
    let id = 'b' + Random.id(19);

    if (checkExistence) {
        while (Catenis.db.collection.NonFungibleTokenIssuingBatch.findOne({nfTokenIssuingBatchId: id}, {fields: {_id: 1}})) {
            Catenis.logger.DEBUG('Newly generated Non-Fungible Token Issuing Batch ID (%s) already exists. Trying again.', id);

            id = 'b' + Random.id(19);
        }
    }

    return id;
}


// Module code
//

// Lock class
Object.freeze(NFTokenIssuingBatch);
