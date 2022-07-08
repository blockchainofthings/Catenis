/**
 * Created by claudio on 2022-06-21
 */

//console.log('[RetrievedNFTokenData.js]: This code just ran.');

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
import { Random } from 'meteor/random';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { NFTokenRetrieval } from './NFTokenRetrieval';


// Definition of classes
//

/**
 * Retrieved Non-Fungible Token Data object class
 */
export class RetrievedNFTokenData {
    /**
     * @typedef {Object} NonFungibleTokenDataToSave
     * @property {Object} [metadata] The non-fungible token metadata
     * @property {Buffer} [contentsData] The non-fungible token contents data
     * @property {boolean} isFinal Indicates whether this is the final retrieved non-fungible token data 
     */

    /**
     * RetrievedNonFungibleTokenData database doc/rec
     * @typedef {Object} RetrievedNonFungibleTokenDataRec
     * @property {string} _id MongoDB internal document ID provided by Meteor
     * @property {string} retrievedNFTokenDataId External ID used to uniquely identify this retrieved non-fungible token
     *                                            data
     * @property {string} nonFungibleTokenRetrieval_id MongoDB internal ID of the non-fungible token retrieval doc/rec
     *                                                  to which this retrieved non-fungible token data belongs
     * @property {number} order The order (starting from 1) of the retrieved non-fungible token data of the non-fungible
     *                           token retrieval
     * @property {boolean} isFinal Indicates whether this is the last retrieved non-fungible token data of the
     *                              non-fungible token retrieval
     * @property {Object} [metadata] The retrieved non-fungible token metadata
     * @property {Uint8Array} [contentsData] The retrieved non-fungible token contents data
     * @property {Date} createdDate Date and time when doc/rec has been created
     */

    /**
     * Class constructor
     * @param {RetrievedNonFungibleTokenDataRec} [doc] RetrievedNonFungibleTokenData database doc/rec
     * @param {NFTokenRetrieval} [nfTokenRetrieval] The non-fungible token retrieval object to which this retrieved
     *                                             non-fungible token data belongs
     */
    constructor(doc, nfTokenRetrieval) {
        if (doc) {
            this.doc_id = doc._id;
            this.retrievedNFTokenDataId = doc.retrievedNFTokenDataId;
            this.nonFungibleTokenRetrieval_id = doc.nonFungibleTokenRetrieval_id;
            this.order = doc.order;
            this.isFinal = doc.isFinal;
            this.createdDate = doc.createdDate;

            /**
             * @type {(NFTokenRetrieval|undefined)}
             */
            this._nfTokenRetrieval = undefined

            // Lazily load retrieved data (metadata/contents)
            /**
             * @type {(Object|undefined)}
             * @private
             */
            this._metadata = undefined;
            /**
             * @type {(Buffer|undefined)}
             * @private
             */
            this._contentsData = undefined;

        }
        else {
            // Creating a new retrieved non-fungible token data object.
            //  Validate arguments
            const errArg = {};

            if (!(nfTokenRetrieval instanceof NFTokenRetrieval)) {
                errArg.nfTokenRetrieval = nfTokenRetrieval;
            }

            if (Object.keys(errArg).length > 0) {
                const errArgs = Object.keys(errArg);

                Catenis.logger.ERROR(`RetrievedNFTokenData constructor called with invalid argument${errArgs.length > 1 ? 's' : ''}`, errArg);
                throw new TypeError(`Invalid ${errArgs.join(', ')} argument${errArgs.length > 1 ? 's' : ''}`);
            }

            this.nonFungibleTokenRetrieval_id = nfTokenRetrieval.doc_id;
            this._nfTokenRetrieval = nfTokenRetrieval;
            /**
             * @type {(NonFungibleTokenDataToSave|undefined)}
             */
            this._dataToSave = undefined;
        }
    }

    /**
     * Indicates whether this retrieved non-fungible token data is already saved to the database
     * @return {boolean}
     * @private
     */
    get _isSavedToDB() {
        return !!this.doc_id;
    }

    /**
     * Get the non-fungible token retrieval object to which this retrieved non-fungible token data belongs
     * @returns {NFTokenRetrieval}
     */
    get nfTokenRetrieval() {
        if (!this._nfTokenRetrieval) {
            this._nfTokenRetrieval = NFTokenRetrieval.getNFTokenRetrievalByDocId(this.nonFungibleTokenRetrieval_id);
        }

        return this._nfTokenRetrieval;
    }

    /**
     * Get the continuation token for this retrieved non-fungible token data
     * @returns {(string|undefined)}
     */
    get continuationToken() {
        return this._isSavedToDB ? this.retrievedNFTokenDataId : undefined;
    }

    /**
     * Get the retrieved non-fungible token metadata
     * @returns {Object} The non-fungible token metadata, or null if no metadata was retrieved
     */
    get metadata() {
        if (this._metadata === undefined && this._isSavedToDB) {
            // Retrieve the retrieved metadata from database
            const docRetrievedNFTData = Catenis.db.collection.RetrievedNonFungibleTokenData.findOne({
                _id: this.doc_id
            }, {
                fields: {
                    metadata: 1
                }
            });

            if (!docRetrievedNFTData) {
                // Invalid database doc/rec ID
                Catenis.logger.ERROR('Cannot find retrieved non-fungible token data with the given database doc/rec ID', {
                    doc_id: this.doc_id
                });
                throw new Error(`Cannot find retrieved non-fungible token data with the given database doc/rec ID: ${this.doc_id}`);
            }

            this._metadata = docRetrievedNFTData.metadata ? docRetrievedNFTData.metadata : null;
        }

        return this._metadata;
    }

    /**
     * Get the retrieved non-fungible token contents data
     * @returns {Object} The non-fungible token contents data, or null if no token contents data was retrieved
     */
    get contentsData() {
        if (this._contentsData === undefined && this._isSavedToDB) {
            // Retrieve the retrieved contents data from database
            const docRetrievedNFTData = Catenis.db.collection.RetrievedNonFungibleTokenData.findOne({
                _id: this.doc_id
            }, {
                fields: {
                    contentsData: 1
                }
            });

            if (!docRetrievedNFTData) {
                // Invalid database doc/rec ID
                Catenis.logger.ERROR('Cannot find retrieved non-fungible token data with the given database doc/rec ID', {
                    doc_id: this.doc_id
                });
                throw new Error(`Cannot find retrieved non-fungible token data with the given database doc/rec ID: ${this.doc_id}`);
            }

            this._contentsData = docRetrievedNFTData.contentsData
                // Convert retrieved TypedArray (Uint8Array) data into a Buffer object.
                //  NOTE: do it this way so the new Buffer object shares the same memory wih the returned TypedArray
                ? Buffer.from(docRetrievedNFTData.contentsData.buffer)
                : null;
        }

        return this._contentsData;
    }

    /**
     * Indicates whether non-fungible token metadata has already been saved for this object
     * @returns {boolean}
     */
    get metadataSaved() {
        return !!this._metadata;
    }

    /**
     * Indicates whether non-fungible token contents data has already been saved for this object
     * @returns {boolean}
     */
    get contentsDataSaved() {
        return !!this._contentsData;
    }

    /**
     * Save retrieved non-fungible token data object to the database
     * @private
     */
    _saveToDB() {
        if (this._dataToSave) {
            if (!this._isSavedToDB) {
                // Object not yet saved to the database. Prepare to insert new doc/rec
                const doc = {
                    retrievedNFTokenDataId: newRetrievedNFTokenDataId(),
                    nonFungibleTokenRetrieval_id: this.nonFungibleTokenRetrieval_id,
                    order: this.nfTokenRetrieval.nextDataOrder,
                    isFinal: this._dataToSave.isFinal
                };

                if (this._dataToSave.metadata) {
                    doc.metadata = this._dataToSave.metadata;
                }

                if (this._dataToSave.contentsData) {
                    // noinspection JSCheckFunctionSignatures
                    doc.contentsData = new Uint8Array(this._dataToSave.contentsData);
                }

                doc.createdDate = new Date();

                try {
                    this.doc_id = Catenis.db.collection.RetrievedNonFungibleTokenData.insert(doc);
                }
                catch (err) {
                    Catenis.logger.ERROR('Failure while inserting new RetrievedNonFungibleTokenData database doc/rec.', err);
                    throw new Error(`Failure while inserting new RetrievedNonFungibleTokenData database doc/rec: ${err}`);
                }

                // Update object properties
                this.retrievedNFTokenDataId = doc.retrievedNFTokenDataId;
                this.order = doc.order;
                this.isFinal = doc.isFinal;
                this.createdDate = doc.createdDate;

                if (this._dataToSave.metadata) {
                    this._metadata = this._dataToSave.metadata;
                }

                if (this._dataToSave.contentsData) {
                    this._contentsData = this._dataToSave.contentsData;
                }

                this._dataToSave = undefined;
            }
            else {
                // Object already saved to the database. Prepare to update doc/rec
                const fieldsToSet = {};

                if (this.isFinal !== this._dataToSave.isFinal) {
                    fieldsToSet.isFinal = this._dataToSave.isFinal;
                }

                if (this._dataToSave.metadata) {
                    fieldsToSet.metadata = this._dataToSave.metadata;
                }

                if (this._dataToSave.contentsData) {
                    // noinspection JSCheckFunctionSignatures
                    fieldsToSet.contentsData = new Uint8Array(this._dataToSave.contentsData);
                }

                try {
                    Catenis.db.collection.RetrievedNonFungibleTokenData.update({
                        _id: this.doc_id
                    }, {
                        $set: fieldsToSet
                    });
                }
                catch (err) {
                    Catenis.logger.ERROR('Failure while updating RetrievedNonFungibleTokenData database doc/rec.', err);
                    throw new Error(`Failure while updating RetrievedNonFungibleTokenData database doc/rec: ${err}`);
                }

                // Update object properties
                this.isFinal = this._dataToSave.isFinal;

                if (this._dataToSave.metadata) {
                    this._metadata = this._dataToSave.metadata;
                }

                if (this._dataToSave.contentsData) {
                    this._contentsData = this._dataToSave.contentsData;
                }

                this._dataToSave = undefined;
            }
        }
    }

    /**
     * Save the retrieved non-fungible token metadata
     *
     * NOTE: this method should be called from code executed from the NFTokenRetrieval.dbCS
     *        critical section object.
     *
     * @param {Object} metadata The retrieved non-fungible token metadata
     * @param {boolean} [isFinal=false] Indicates whether this is the final retrieved non-fungible token data
     */
    saveMetadata(metadata, isFinal = false) {
        // Make sure that no non-fungible token data has yet been saved for this
        //  non-fungible token retrieval object
        if (this.metadataSaved || this.contentsDataSaved) {
            throw new Error('Unable to save non-fungible token metadata: non-fungible token data already saved');
        }

        this._dataToSave = {
            metadata,
            isFinal
        };

        this._saveToDB();
    }

    /**
     * Save the retrieved non-fungible token contents data
     *
     * NOTE: this method should be called from code executed from the NFTokenRetrieval.dbCS
     *        critical section object.
     *
     * @param {Buffer} contentsData The retrieved non-fungible token contents data
     * @param {boolean} [isFinal=false] Indicates whether this is the final retrieved non-fungible token data
     */
    saveContentsData(contentsData, isFinal = false) {
        // Make sure that no non-fungible token data has yet been saved for this
        //  non-fungible token retrieval object
        if (this.metadataSaved || this.contentsDataSaved) {
            throw new Error('Unable to save non-fungible token metadata: non-fungible token data already saved');
        }

        this._dataToSave = {
            contentsData,
            isFinal
        };

        this._saveToDB();
    }

    /**
     * Mark retrieved non-fungible token data as final
     *
     * NOTE: this method should be called from code executed from the NFTokenRetrieval.dbCS
     *        critical section object.
     */
    finalizeContentsData() {
        if (!this._isSavedToDB) {
            Catenis.logger.WARN('Trying to finalize non-fungible token contents data that is not yet saved to the database');
            return;
        }

        if (this.isFinal) {
            Catenis.logger.WARN('Trying to finalize non-fungible token contents data that is already finalized');
            return;
        }

        this._dataToSave = {
            isFinal: true
        };

        this._saveToDB();
    }
}


// Definition of module (private) functions
//

/**
 * Generate a new retrieved non-fungible token data ID
 * @param {boolean} checkExistence Indicates whether to check if newly generated ID already exists
 * @return {string} The newly generated ID
 */
function newRetrievedNFTokenDataId(checkExistence = true) {
    let id = 'e' + Random.id(19);

    if (checkExistence) {
        while (Catenis.db.collection.RetrievedNonFungibleTokenData.findOne({retrievedNFTokenDataId: id},
                {fields: {_id: 1}})) {
            Catenis.logger.DEBUG('Newly generated Retrieved Non-Fungible Token Data ID (%s) already exists. Trying again.', id);

            id = 'e' + Random.id(19);
        }
    }

    return id;
}


// Module code
//

// Lock class
Object.freeze(RetrievedNFTokenData);
