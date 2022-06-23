/**
 * Created by claudio on 2022-02-11
 */

//console.log('[NFTokenIssuingPart.js]: This code just ran.');

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

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { NFTokenIssuingBatch } from './NFTokenIssuingBatch';
import { Util } from './Util';


// Definition of classes
//

/**
 * Non-Fungible Token Issuing Part object class
 */
export class NFTokenIssuingPart {
    /**
     * NonFungibleTokenIssuingPart database doc/rec
     * @typedef {Object} NonFungibleTokenIssuingPartRec
     * @property {string} _id MongoDB internal document ID provided by Meteor
     * @property {string} nonFungibleTokenIssuingBatch_id MongoDB internal ID of the non-fungible token issuing batch
     *                                                     doc/rec to which this non-fungible token issuing part belongs
     * @property {number} index Zero-based index of the non-fungible token in the batch to which this issuing part
     *                           refers
     * @property {Object} [metadata] The non-fungible token metadata. Should only be present in the first issuing batch
     * @property {string} metadata.name The non-fungible token name
     * @property {string} [metadata.description] A short description about the non-fungible token
     * @property {Object} [metadata.custom] An optional dictionary object containing name/value pairs to be used as custom
     *                              metadata for the non-fungible token
     * @property {Uint8Array} [contents] Another part of the data that comprises the non-fungible token contents
     * @property {Date} createdDate Date and time when database doc/rec has been created
     */

    /**
     * Class constructor
     *
     * NOTE: objects of this class should be instantiated and used from code executed from the NFAssetIssuance.dbCS
     *        critical section object, while the associated asset issuance is being composed.
     *
     * @param {NonFungibleTokenIssuingPartRec} [doc] NonFungibleTokenIssuingPart database doc/rec
     * @param {NFTokenIssuingBatch} [nfTokenIssuingBatch] Non-fungible token issuing batch object with which this
     *                                                     non-fungible token issuing part is associated
     * @param {NonFungibleTokenInfo} [nfTokenInfo] The non-fungible token info
     * @param {number} [index] Index position of non-fungible token in the batch
     */
    constructor(doc, nfTokenIssuingBatch, nfTokenInfo, index) {
        if (doc) {
            this.doc_id = doc._id;
            this.nonFungibleTokenIssuingBatch_id = doc.nonFungibleTokenIssuingBatch_id;
            this.index = doc.index;
            this.metadata = doc.metadata;

            // Convert retrieved TypedArray (Uint8Array) data into a Buffer object.
            //  NOTE: do it this way so the new Buffer object shares the same memory wih the returned TypedArray
            this._contents = doc.contents ? Buffer.from(doc.contents.buffer) : doc.contents;

            this.createdDate = doc.createdDate;
        }
        else {
            // Creating a new non-fungible token issuing part object.
            //  Validate arguments
            const errArg = {};

            if (!(nfTokenIssuingBatch instanceof NFTokenIssuingBatch)) {
                errArg.nfTokenIssuingBatch = nfTokenIssuingBatch;
            }

            if (!Util.isNonNullObject(nfTokenInfo)) {
                errArg.nfTokenInfo = nfTokenInfo;
            }

            if (!isValidIndex(index)) {
                errArg.index = index;
            }

            if (Object.keys(errArg).length > 0) {
                const errArgs = Object.keys(errArg);

                Catenis.logger.ERROR(`NFTokenIssuingPart constructor called with invalid argument${errArgs.length > 1 ? 's' : ''}`, errArg);
                throw new TypeError(`Invalid ${errArgs.join(', ')} argument${errArgs.length > 1 ? 's' : ''}`);
            }

            // Validate consistency of data
            this.index = index;

            if (nfTokenIssuingBatch.isFirstBatch) {
                // First non-fungible token issuing batch.
                //  Make sure that metadata is provided
                if (!nfTokenInfo.metadata) {
                    throw new Meteor.Error('nft_issue_part_missing_metadata', 'Unable to create new non-fungible token issuing part: missing non-fungible token metadata');
                }

                // If first token of the batch, make sure that contents is provided
                if (this.isForFirstToken && !nfTokenInfo.contents) {
                    throw new Meteor.Error('nft_issue_part_missing_contents', 'Unable to create new non-fungible token issuing part: missing non-fungible token contents');
                }
            }
            else {
                // For any continuation batch, make sure that contents is provided
                if (!nfTokenInfo.contents) {
                    throw new Meteor.Error('nft_issue_part_missing_contents', 'Unable to create new non-fungible token issuing part: missing non-fungible token contents');
                }

                // Make sure that non-fungible token's contents has not yet been finalized
                if (!hasContentsInPreviousBatch(nfTokenIssuingBatch, index)) {
                    throw new Meteor.Error('nft_issue_part_contents_already_finalized', 'Unable to create new non-fungible token issuing part: non-fungible token contents has already been finalized');
                }
            }

            this._nfTokenIssuingBatch = nfTokenIssuingBatch;
            this.metadata = nfTokenInfo.metadata;
            this._contents = nfTokenInfo.contents || null;
        }
    }

    /**
     * Indicates whether this is an issuing part for the first non-fungible token of the batch
     * @return {boolean}
     */
    get isForFirstToken() {
        return this.index === 0;
    }

    /**
     * Indicates whether this non-fungible token issuing part is already saved to the database
     * @return {boolean}
     */
    get isSavedToDB() {
        return !!this.doc_id;
    }

    /**
     * Indicates whether the non-fungible token issuing part has any contents
     * @return {boolean}
     */
    get hasContents() {
        if (this._contents !== undefined) {
            // Contents already retrieved from database, so check object's property
            return !!this._contents;
        }

        if (this.isSavedToDB) {
            // Otherwise, check database directly
            return !!Catenis.db.collection.NonFungibleTokenIssuingPart.findOne({
                _id: this.doc_id,
                contents: {
                    $ne: null
                }
            }, {
                fields: {
                    _id: 1
                }
            });
        }
        else {
            // Not saved to the database yet; contents is inconsistent. So fix it
            this._contents = null;

            return false;
        }
    }

    /**
     * Retrieve the contents of this non-fungible token issuing parts
     * @param {boolean} storeIt Indicates whether the retrieved contents should be assigned to the
     *                           respective object property
     * @return {(Buffer|null)} The retrieved contents or null if the non-fungible token issuing part has no contents
     */
    getContents(storeIt = false) {
        if (this._contents === null || (Buffer.isBuffer(this._contents) && this._contents.length > 0)) {
            return this._contents;
        }

        if (this.isSavedToDB) {
            // Get contents from the database
            const doc = Catenis.db.collection.NonFungibleTokenIssuingPart.findOne({
                _id: this.doc_id
            }, {
                fields: {
                    contents: 1
                }
            });

            if (!doc) {
                Catenis.logger.ERROR('No non-fungible token issuing part found with the given doc/rec ID (doc_id: %s)', this.doc_id);
                throw new Error(`No non-fungible token issuing part found with the given doc/rec ID (doc_id: ${this.doc_id})`);
            }

            let contents;

            if (doc.contents) {
                // Convert retrieved TypedArray (Uint8Array) data into a Buffer object.
                //  NOTE: do it this way so the new Buffer object shares the same memory wih the returned TypedArray
                contents = Buffer.from(doc.contents.buffer);

                // If contents should not be stored, at least indicate that it exists (by setting
                //  the object's property to an empty buffer)
                this._contents = storeIt ? contents : Buffer.from('');
            }
            else {
                // Non-fungible token issuing part has no contents. So set the object's property
                //  to null to indicate it
                contents = this._contents = null;
            }

            return contents;
        }
        else {
            // Not saved to the database yet; contents is not consistent. So fix it
            this._contents = this._contents || null;

            return this._contents;
        }
    }

    /**
     * Save non-fungible token issuing part object to the database
     */
    saveToDB() {
        // Make sure that it has not yet been saved to the database
        if (!this.isSavedToDB) {
            // Make sure that associated non-fungible token issuing batch is already saved to the database
            if (!this._nfTokenIssuingBatch.isSavedToDB) {
                Catenis.logger.ERROR('Unable to save non-fungible token issuing part to database: associated issuing batch not yet saved', {
                    nfTokenIssuingPart: this
                });
                throw new Error('Unable to save non-fungible token issuing part to database: associated issuing batch not yet saved');
            }

            const doc = {
                nonFungibleTokenIssuingBatch_id: this.nonFungibleTokenIssuingBatch_id = this._nfTokenIssuingBatch.doc_id,
                index: this.index
            };

            if (this.metadata) {
                doc.metadata = this.metadata;
            }

            // NOTE: convert Buffer object into a TypedArray so that the data is stored as a binary stream
            doc.contents = this._contents ? new Uint8Array(this._contents) : null;

            doc.createdDate = this.createdDate = new Date();

            try {
                this.doc_id = Catenis.db.collection.NonFungibleTokenIssuingPart.insert(doc);
            }
            catch (err) {
                Catenis.logger.ERROR('Failure while inserting new NonFungibleTokenIssuingPart database doc/rec.', err);
                throw new Error(`Failure while inserting new NonFungibleTokenIssuingPart database doc/rec: ${err}`);
            }
        }
    }
}


// Definition of module (private) functions
//

/**
 * Test if value is a valid non-fungible token index
 * @param {*} val Value to be tested
 * @return {boolean}
 */
function isValidIndex(val) {
    return Number.isInteger(val) && val >= 0;
}

/**
 * Identifies whether contents have been provided for the non-fungible token in the previous batch
 * @param {NFTokenIssuingBatch} [nfTokenIssuingBatch] Non-fungible token issuing batch object with which this
 *                                                     non-fungible token issuing part is associated
 * @param {number} [index] Index position of non-fungible token in the batch
 * @return {boolean}
 */
function hasContentsInPreviousBatch(nfTokenIssuingBatch, index) {
    // Get database doc/rec of previous batch
    const docPrevBatch = Catenis.db.collection.NonFungibleTokenIssuingBatch.findOne({
        nonFungibleAssetIssuance_id: nfTokenIssuingBatch.nonFungibleAssetIssuance_id,
        order: nfTokenIssuingBatch.order - 1
    }, {
        fields: {
            _id: 1
        }
    });

    if (!docPrevBatch) {
        Catenis.logger.ERROR('Previous non-fungible token issuing batch not found', {
            nfTokenIssuingBatch
        });
        throw new Error('Previous non-fungible token issuing batch not found');
    }

    return !!Catenis.db.collection.NonFungibleTokenIssuingPart.findOne({
        nonFungibleTokenIssuingBatch_id: docPrevBatch._id,
        index,
        contents: {
            $ne: null
        }
    }, {
        fields: {
            _id: 1
        }
    });
}


// Module code
//

// Lock class
Object.freeze(NFTokenIssuingPart);
