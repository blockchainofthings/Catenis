/**
 * Created by claudio on 2022-06-17
 */

//console.log('[NFTokenRetrieval.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import config from 'config';
import _und from 'underscore';
import moment from 'moment';
import Future from 'fibers/future';
// Meteor packages
import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';
// noinspection ES6CheckImport
import { Promise } from 'meteor/promise';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { NFTokenMetadataRepo } from './NFTokenMetadataRepo';
import { Util } from './Util';
import { CriticalSection } from './CriticalSection';
import { CatenisNode } from './CatenisNode';
import { KeyStore } from './KeyStore';
import { RetrievedNFTokenData } from './RetrievedNFTokenData';
import { CCSingleNFTokenMetadata } from './CCSingleNFTokenMetadata';
import { NFTokenMetadataWritable } from './NFTokenMetadataWritable';
import { NFTokenContentsWritable } from './NFTokenContentsWritable';
import { NFTokenStorage } from './NFTokenStorage';
import { NonFungibleToken } from './NonFungibleToken';

// Config entries
const nftRetrievalConfig = config.get('nfTokenRetrieval');

// Configuration settings
export const cfgSettings = {
    minSizeContentsDataChunk: nftRetrievalConfig.get('minSizeContentsDataChunk'),
    maxSizeContentsDataChunk: nftRetrievalConfig.get('maxSizeContentsDataChunk'),
    timeContinueDataDelivery: nftRetrievalConfig.get('timeContinueDataDelivery'),
    timeKeepIncompleteRetrieval: nftRetrievalConfig.get('timeKeepIncompleteRetrieval'),
    timeKeepUndeliveredData: nftRetrievalConfig.get('timeKeepUndeliveredData'),
    timeKeepDeliveredData: nftRetrievalConfig.get('timeKeepDeliveredData'),
    purgeOldRetrievalsInterval: nftRetrievalConfig.get('purgeOldRetrievalsInterval')
};


// Definition of classes
//

/**
 * Non-Fungible Token Retrieval object class
 */
export class NFTokenRetrieval extends NFTokenMetadataRepo {
    /**
     * Critical section object to avoid concurrent access to database collections related to non-fungible
     *  token retrieval (NonFungibleTokenRetrieval, and RetrievedNonFungibleTokenData)
     * @type {CriticalSection}
     */
    static dbCS = new CriticalSection();

    /**
     * @type {Object}
     * @property {(undefined|number)} purgeOldRetrievals
     */
    static intervalHandle = {
        purgeOldRetrievals: undefined
    };

    /**
     * @typedef {Object} NFTokenContentsInfo
     * @property {string} CID IPFS CID of the non-fungible token contents
     * @property {boolean} isEncrypted Indicates whether the non-fungible token contents are encrypted
     */

    /**
     * Non-fungible token contents retrieval options
     * @typedef {Object} NFTokenContentsRetrievalOptions
     * @property {boolean} contentsOnly Indicates whether only the non-fungible token contents should be retrieved
     * @property {string} encoding The encoding used to encode the retrieved non-fungible token contents data before
     *                              delivering it to the end user
     * @property {number} [dataChunkSize] The size, in bytes, of the largest contents data chunk that should be returned
     */

    /**
     * @typedef {Object} NonFungibleTokenRetrievalError
     * @property {number} code Code number of error that took place while retrieving the token data
     * @property {string} message Text describing the error that took place while retrieving the token data
     */

    /**
     * Non-fungible token retrieval stored progress
     * @typedef {Object} NonFungibleTokenRetrievalStoredProgress
     * @property {number} metadataBytesRetrieved Number of metadata bytes already retrieved
     * @property {number} contentsBytesRetrieved Number of non-fungible token contents bytes already retrieved
     * @property {boolean} done Indicates whether the data retrieval has been finalized, either successfully or with an
     *                           error
     * @property {boolean} [success] Indicates whether all the token data has been successfully retrieved
     * @property {NonFungibleTokenRetrievalError} [error] Error that took place while retrieving the token data
     * @property {Date} [finishedDate] Date and time when the data retrieval was finalized
     */

    /**
     * @typedef {Object} NonFungibleTokenRetrievalProgress
     * @property {number} bytesRetrieved Total number of bytes of non-fungible token data already retrieved
     * @property {boolean} done Indicates whether the data retrieval has been finalized, either successfully or with an
     *                           error
     * @property {boolean} [success] Indicates whether all the token data has been successfully retrieved
     * @property {NonFungibleTokenRetrievalError} [error] Error that took place while retrieving the token data
     * @property {Date} [finishedDate] Date and time when the data retrieval was finalized
     */

    /**
     * @typedef {Object} NonFungibleTokenRetrievalDelivery
     * @property {number} dataChunksSent Number of retrieved non-fungible token data chunks that have already been
     *                                    delivered to the end user
     * @property {boolean} done Indicates whether all non-fungible token data has already been delivered to the end user
     * @property {Date} [lastSentDate] Date and time when the last non-fungible token data chunk has been delivered to
     *                                  the end user
     */

    /**
     * NonFungibleTokenRetrieval database doc/rec
     * @typedef {Object} NonFungibleTokenRetrievalRec
     * @property {string} _id MongoDB internal document ID provided by Meteor
     * @property {string} tokenRetrievalId External ID used to uniquely identify this non-fungible token retrieval
     * @property {string} deviceId External ID of device to which this non-fungible token retrieval belongs
     * @property {string} tokenId External ID of the non-fungible token to be retrieved
     * @property {string} holdingAddressPath HD node path of the blockchain address that currently holds the
     *                                        non-fungible token
     * @property {boolean} retrieveContents Indicates whether the non-fungible token contents should be retrieved
     * @property {NFTokenContentsRetrievalOptions} [contentsOptions] Options for the retrieval of non-fungible token
     *                                                                contents
     * @property {NonFungibleTokenRetrievalStoredProgress} progress Progress of the non-fungible token retrieval
     * @property {NonFungibleTokenRetrievalDelivery} [delivery] Controls the delivery of the retrieved non-fungible
     *                                                           token data to the end user
     * @property {Date} createdDate Date and time when doc/rec has been created
     */

    /**
     * Class constructor
     *
     * NOTE: objects of this class should be instantiated and used from code executed from the NFTokenRetrieval.dbCS
     *        critical section object, while the retrieved non-fungible token data is being delivered to the end user.
     *
     * @param {NonFungibleTokenRetrievalRec} [doc] NonFungibleTokenRetrieval database doc/rec
     * @param {string} [deviceId] ID of the device that is retrieving the non-fungible token
     * @param {NonFungibleToken} [nfToken] The non-fungible token object to be retrieved
     * @param {Object} [holdingAddressInfo] Address info of the blockchain address that currently holds the non-fungible
     *                                       token
     * @param {boolean} [retrieveContents] Indicates whether the non-fungible token contents should be retrieved
     * @param {NFTokenContentsRetrievalOptions} [contentsOptions] Options for the retrieval of non-fungible token
     *                                                             contents
     */
    constructor(doc, deviceId, nfToken, holdingAddressInfo, retrieveContents, contentsOptions) {
        super();

        if (doc) {
            this.doc_id = doc._id;
            this.tokenRetrievalId = doc.tokenRetrievalId;
            this.deviceId = doc.deviceId;
            this.tokenId = doc.tokenId;
            this._setHoldingProps(doc.holdingAddressPath);
            this.retrieveContents = doc.retrieveContents;
            this.contentsOptions = doc.contentsOptions;
            this.progress = doc.progress;
            this.delivery = doc.delivery;
            this.createdDate = doc.createdDate;

            /**
             * @type {(NonFungibleToken|undefined)}
             */
            this._nfToken = undefined;

            this._updateNextRetrievedNFTokenData();

            this.refMoment = moment();
        }
        else {
            // Creating a new non-fungible token retrieval object.
            //  Validate arguments
            const errArg = {};

            if (typeof deviceId !== 'string') {
                errArg.deviceId = deviceId;
            }

            if (!(nfToken instanceof NonFungibleToken)) {
                errArg.nfToken = nfToken;
            }

            if (!Util.isNonNullObject(holdingAddressInfo)) {
                errArg.holdingAddressInfo = holdingAddressInfo;
            }

            if (contentsOptions !== undefined && !Util.isNonNullObject(contentsOptions)) {
                errArg.contentsOptions = contentsOptions;
            }

            if (Object.keys(errArg).length > 0) {
                const errArgs = Object.keys(errArg);

                Catenis.logger.ERROR(`NFTokenRetrieval constructor called with invalid argument${errArgs.length > 1 ? 's' : ''}`, errArg);
                throw new TypeError(`Invalid ${errArgs.join(', ')} argument${errArgs.length > 1 ? 's' : ''}`);
            }

            // Validate holding address
            if (holdingAddressInfo.type !== KeyStore.extKeyType.dev_asst_addr.name) {
                Catenis.logger.ERROR('Unable to create new non-fungible token retrieval: inconsistent type for non-fungible token holding address', {
                    holdingAddressInfo
                });
                throw new Error('Unable to create new non-fungible token retrieval: inconsistent type for non-fungible token holding address');
            }

            this.deviceId = deviceId;
            this.tokenId = nfToken.tokenId;
            this._nfToken = nfToken;
            this._setHoldingProps(holdingAddressInfo);
            this.retrieveContents = !!retrieveContents;

            if (this.retrieveContents && !contentsOptions) {
                Catenis.logger.ERROR('NFTokenRetrieval constructor: missing contentsOptions argument');
                throw new Error('Missing contentsOptions argument');
            }

            this.contentsOptions = contentsOptions;
            /**
             * @type {NonFungibleTokenRetrievalStoredProgress}
             */
            this.progress = {
                metadataBytesRetrieved: 0,
                contentsBytesRetrieved: 0,
                done: false
            };

            /**
             * @type {(NFTokenContentsInfo|undefined)}
             */
            this.contentsInfo = undefined;

            // Save the new non-fungible token retrieval to the database
            this._saveToDB();
        }
    }

    /**
     * Indicates whether this non-fungible token retrieval is already saved to the database
     * @return {boolean}
     * @private
     */
    get _isSavedToDB() {
        return !!this.doc_id;
    }

    /**
     * Indicates whether the final non-fungible token data has already been retrieved
     * @returns {boolean}
     * @private
     */
    get _isFinalDataRetrieved() {
        return !!Catenis.db.collection.RetrievedNonFungibleTokenData.findOne({
            nonFungibleTokenRetrieval_id: this.doc_id,
            isFinal: true
        }, {
            fields: {
                _id: 1
            }
        });
    }

    /**
     * Get the last retrieved non-fungible token contents data object
     *
     * NOTE: this method should be called from code executed from the NFTokenRetrieval.dbCS
     *        critical section object.
     *
     * @returns {RetrievedNFTokenData}
     * @private
     */
    get _lastRetrievedContentsData() {
        const docRetrievedNFTData = Catenis.db.collection.RetrievedNonFungibleTokenData.findOne({
            nonFungibleTokenRetrieval_id: this.doc_id,
            contentsData: {
                $exists: true
            }
        }, {
            fields: {
                metadata: 0,
                contentsData: 0
            },
            sort: {
                order: -1
            }
        });

        if (!docRetrievedNFTData) {
            // Unable to find last retrieved non-fungible token contents data
            Catenis.logger.ERROR('Unable to find last retrieved non-fungible token contents data', {
                nfTokenRetrieval: this
            });
            throw new Error('Unable to find last retrieved non-fungible token contents data');
        }

        return new RetrievedNFTokenData(docRetrievedNFTData);
    }

    /**
     * Get the Colored Coins attributed ID of the non-fungible token to be retrieved
     * @returns {string}
     */
    get ccTokenId() {
        if (!this._nfToken) {
            this._nfToken = NonFungibleToken.getNFTokenByTokenId(this.tokenId);
        }

        return this._nfToken.ccTokenId;
    }

    /**
     * Get the ID that identifies the following retrieved non-fungible token data to be delivered to the end user
     * @returns {(string|undefined)}
     */
    get nextContinuationToken() {
        return this._nextRetrievedNFTokenData ? this._nextRetrievedNFTokenData.continuationToken : undefined;
    }

    /**
     * Retrieves the order of the next data chunk to be retrieved
     *
     * NOTE: this (getter) property should be called from code executed from the NFTokenRetrieval.dbCS
     *        critical section object.
     */
    get nextDataOrder() {
        const docRetrievedNFTData = Catenis.db.collection.RetrievedNonFungibleTokenData.findOne({
            nonFungibleTokenRetrieval_id: this.doc_id
        }, {
            fields: {
                order: 1
            },
            sort: {
                order: -1
            }
        });

        return docRetrievedNFTData ? docRetrievedNFTData.order + 1 : 1;
    }

    /**
     * Get the data chunk size for retrieving/delivering the non-fungible token contents data
     * @returns {(number|undefined)}
     */
    get contentsDataChunkSize() {
        return this.retrieveContents
            ? (this.contentsOptions.dataChunkSize < cfgSettings.minSizeContentsDataChunk
                ? cfgSettings.minSizeContentsDataChunk
                : (this.contentsOptions.dataChunkSize > cfgSettings.maxSizeContentsDataChunk)
                    ? cfgSettings.maxSizeContentsDataChunk
                    : this.contentsOptions.dataChunkSize)
            : undefined;
    }

    /**
     * Set the values of the properties related to the non-fungible token holding address
     * @param {(string|Object)} holdingAddressPathOrInfo Reference of the blockchain address that currently holds the
     *                                          non-fungible token; either the HD node path, or the address info
     * @private
     */
    _setHoldingProps(holdingAddressPathOrInfo) {
        const addrInfo = typeof holdingAddressPathOrInfo === 'string'
            ? Catenis.keyStore.getAddressInfoByPath(holdingAddressPathOrInfo, true)
            : holdingAddressPathOrInfo;

        if (!addrInfo) {
            // Unable to get address info for non-fungible token holding address
            Catenis.logger.ERROR('Unable to get address info for non-fungible token holding address', {
                holdingAddressPath: holdingAddressPathOrInfo
            });
            throw new Error(`Unable to get address info for non-fungible token holding address (path: ${holdingAddressPathOrInfo})`);
        }

        this.holdingAddressInfo = addrInfo;
        this.holdingDeviceId = CatenisNode.getCatenisNodeByIndex(addrInfo.pathParts.ctnNodeIndex)
            .getClientByIndex(addrInfo.pathParts.clientIndex)
            .getDeviceByIndex(addrInfo.pathParts.deviceIndex)
            .deviceId;
    }

    /**
     * Save non-fungible token retrieval object to the database
     * @private
     */
    _saveToDB() {
        // Make sure that it has not yet been saved to the database
        if (!this._isSavedToDB) {
            const doc = {
                tokenRetrievalId: newNFTokenRetrievalId(),
                deviceId: this.deviceId,
                tokenId: this.tokenId,
                holdingAddressPath: this.holdingAddressInfo.path,
                retrieveContents: this.retrieveContents
            };

            if (this.retrieveContents) {
                doc.contentsOptions = this.contentsOptions;
            }

            doc.progress = this.progress;
            doc.createdDate = new Date();

            try {
                this.doc_id = Catenis.db.collection.NonFungibleTokenRetrieval.insert(doc);
            }
            catch (err) {
                Catenis.logger.ERROR('Failure while inserting new NonFungibleTokenRetrieval database doc/rec.', err);
                throw new Error(`Failure while inserting new NonFungibleTokenRetrieval database doc/rec: ${err}`);
            }

            // Update object properties
            this.tokenRetrievalId = doc.tokenRetrievalId;
            this.createdDate = doc.createdDate;
        }
    }

    /**
     * Save the current non-fungible token retrieval progress to the database
     * @param {boolean} [saveDelivery=false] Indicates whether the current data delivery state should also be saved
     * @private
     */
    _saveProgressToDB(saveDelivery = false) {
        const fieldsToSet = {
            progress: this.progress
        };

        if (saveDelivery) {
            fieldsToSet.delivery = this.delivery;
        }

        try {
            Catenis.db.collection.NonFungibleTokenRetrieval.update({
                _id: this.doc_id
            }, {
                $set: fieldsToSet
            });
        }
        catch (err) {
            Catenis.logger.ERROR('Error updating non-fungible token retrieval database doc/rec (doc_id: %s) to record retrieval progress.', this.doc_id, err);
            throw new Error(`Error updating non-fungible token retrieval database doc/rec (doc_id: ${this.doc_id}) to record retrieval progress: ${err}`);
        }
    }

    /**
     * Save the current state of the delivery of the retrieved non-fungible token data to the end user
     *  to the database
     * @private
     */
    _saveDeliveryToDB() {
        try {
            Catenis.db.collection.NonFungibleTokenRetrieval.update({
                _id: this.doc_id
            }, {
                $set: {
                    delivery: this.delivery
                }
            });
        }
        catch (err) {
            Catenis.logger.ERROR('Error updating non-fungible token retrieval database doc/rec (doc_id: %s) to record delivery info.', this.doc_id, err);
            throw new Error(`Error updating non-fungible token retrieval database doc/rec (doc_id: ${this.doc_id}) to record delivery info: ${err}`);
        }
    }

    /**
     * Get the next available retrieved non-fungible token data object to be used for data retrieval
     *
     * NOTE: this method should be called from code executed from the NFTokenRetrieval.dbCS
     *        critical section object.
     *
     * @param {boolean} [forMetadata=false] Indicates whether the data to retrieve is the non-fungible token metadata
     * @returns {RetrievedNFTokenData}
     * @private
     */
    _nextDataToRetrieve(forMetadata = false) {
        if (forMetadata) {
            // Metadata should be in the first retrieved non-fungible token data.
            //  So validate consistency before creating it
            let nextDataOrder;

            if ((nextDataOrder = this.nextDataOrder) !== 1) {
                // Inconsistent retrieved non-fungible token data order for metadata
                Catenis.logger.ERROR('Inconsistent non-fungible token data order for metadata retrieval', {
                    nextDataOrder
                });
                throw new Error('Inconsistent non-fungible token data order for metadata retrieval');
            }
        }

        // Create a new retrieved non-fungible token data object
        return new RetrievedNFTokenData(undefined, this);
    }

    /**
     * Get the retrieved non-fungible token data object to deliver the next retrieved data
     *  to the end user
     *  @private
     */
    _updateNextRetrievedNFTokenData() {
        if (this.delivery && !this.delivery.done) {
            const docRetrievedNFTData = Catenis.db.collection.RetrievedNonFungibleTokenData.findOne({
                nonFungibleTokenRetrieval_id: this.doc_id,
                order: this.delivery.dataChunksSent + 1
            }, {
                fields: {
                    metadata: 0,
                    contentsData: 0
                }
            });

            if (!docRetrievedNFTData) {
                // Unable to find retrieved non-fungible token data with the specified order
                Catenis.logger.ERROR('Unable to find retrieved non-fungible token data with the specified order', {
                    nfTokenRetrieval: this,
                    order: this.delivery.dataChunksSent + 1
                });
                throw new Error('Unable to find retrieved non-fungible token data with the specified order');
            }

            /**
             * @type {(RetrievedNFTokenData|undefined)}
             * @private
             */
            this._nextRetrievedNFTokenData = new RetrievedNFTokenData(docRetrievedNFTData);
        }
        else {
            this._nextRetrievedNFTokenData = undefined;
        }
    }

    /**
     * Conform an error that might happen during the retrieval of the non-fungible token to
     *  be presented to the end user
     * @param {Error} err The error to be conformed
     * @return {{code: number, message: string}} The resulting conformed error
     * @private
     */
    _conformRetrievalError(err) {
        let error = {};

        if (err instanceof Meteor.Error) {
            // No specific error to be reported to the end user
            error.code = 500;
            error.message = 'Internal server error';
        }
        else {
            error.code = 500;
            error.message = 'Internal server error';
        }

        if (error.code === 500) {
            // Log error
            Catenis.logger.ERROR('Error retrieving non-fungible token (tokenRetrievalId: %s).', this.tokenRetrievalId, err);
        }

        return error;
    }

    /**
     * Asynchronously retrieve the non-fungible token metadata
     * @returns {Promise<void>} A promise that resolves when the metadata is retrieved and saved
     * @private
     */
    _retrieveMetadata() {
        let promiseOutcome;
        const promise = new Promise((resolve, reject) => {
            promiseOutcome = {
                resolve,
                reject
            };
        });

        // Prepare stream to save the retrieved non-fungible token metadata
        const metaWritable = new NFTokenMetadataWritable(this);

        metaWritable.once('error', (err) => {
            Catenis.logger.ERROR('Error writing retrieved non-fungible token metadata for non-fungible token retrieval.', err);
            endRetrieval(new Error(`Error writing retrieved non-fungible token metadata for non-fungible token retrieval: ${err}`));
        });

        metaWritable.once('finish', () => {
            endRetrieval();
        });

        // Prepare to retrieve non-fungible token metadata
        const metaReadable = Catenis.c3NodeClient.getNFTokenMetadataReadableStream(this.ccTokenId);

        metaReadable.once('error', err => {
            Catenis.logger.ERROR('Error reading non-fungible token metadata for non-fungible token retrieval.', err);
            metaWritable.destroy(new Error(`Error reading non-fungible token metadata for non-fungible token retrieval: ${err}`));
        });

        metaReadable.pipe(metaWritable);

        function endRetrieval(error) {
            // Fee up event handlers
            metaReadable.removeAllListeners();
            metaWritable.removeAllListeners();

            if (error) {
                promiseOutcome.reject(error);
            }
            else {
                promiseOutcome.resolve();
            }
        }

        return promise;
    }

    /**
     * Asynchronously retrieve the non-fungible token contents
     * @returns {Promise<void>} A promise that resolves when the contents are retrieved and saved
     * @private
     */
    _retrieveContents() {
        let promiseOutcome;
        const promise = new Promise((resolve, reject) => {
            promiseOutcome = {
                resolve,
                reject
            };
        });

        let contentsWritable;
        let contentsReadable;

        if (this.contentsInfo) {
            // Prepare stream to save the retrieved non-fungible token contents
            contentsWritable = new NFTokenContentsWritable(this);

            contentsWritable.once('error', (err) => {
                Catenis.logger.ERROR('Error writing retrieved non-fungible token contents for non-fungible token retrieval.', err);
                endRetrieval(new Error(`Error writing retrieved non-fungible token contents for non-fungible token retrieval: ${err}`));
            });

            contentsWritable.once('finish', () => {
                endRetrieval();
            });

            // Prepare to retrieve non-fungible token contents
            contentsReadable = new NFTokenStorage().retrieve(this.contentsInfo.CID);

            contentsReadable.once('error', err => {
                Catenis.logger.ERROR('Error reading non-fungible token contents for non-fungible token retrieval.', err);
                contentsWritable.destroy(new Error(`Error reading non-fungible token contents for non-fungible token retrieval: ${err}`));
            });

            contentsReadable.pipe(contentsWritable);
        }
        else {
            endRetrieval(new Error('Unable to retrieve non-fungible token contents: missing contents info'));
        }

        function endRetrieval(error) {
            // Free up event handlers
            if (contentsReadable) {
                contentsReadable.removeAllListeners();
            }

            if (contentsWritable) {
                contentsWritable.removeAllListeners();
            }

            if (error) {
                promiseOutcome.reject(error);
            }
            else {
                promiseOutcome.resolve();
            }
        }

        return promise;
    }

    /**
     * Asynchronously start the non-fungible token retrieval
     * @returns {Promise<void>}
     */
    async startRetrieval() {
        await this._retrieveMetadata();

        if (this.contentsInfo) {
            await this._retrieveContents();
        }
    }

    /**
     * Implementation of NFTokenMetadataRepo base class's method
     * @param {number} bytesRetrieved
     */
    reportProgress(bytesRetrieved) {
        // Update non-fungible token retrieval progress
        this.updateRetrievalProgress(bytesRetrieved, false);
    }

    /**
     * Implementation of NFTokenMetadataRepo base class's method
     * @param {Object} metadata The retrieved metadata
     */
    saveToRepo(metadata) {
        // Execute code in critical section to avoid database concurrency
        NFTokenRetrieval.dbCS.execute(() => {
            this.saveRetrievedMetadata(metadata);
        });
    }

    /**
     * Request to save the retrieved non-fungible token metadata
     *
     * NOTE: this method should be called from code executed from the NFTokenRetrieval.dbCS
     *        critical section object.
     *
     * @param {Object} metadata The retrieved non-fungible token metadata
     */
    saveRetrievedMetadata(metadata) {
        // Parse the retrieved metadata
        const ccNFTMetadata = new CCSingleNFTokenMetadata(metadata, this.holdingAddressInfo.cryptoKeys);

        let saveMetadata = true;

        if (this.retrieveContents) {
            // Save contents info
            this.contentsInfo = {
                CID: ccNFTMetadata.contentsUrl.cid,
                isEncrypted: ccNFTMetadata.areContentsEncrypted
            };

            if (this.contentsOptions.contentsOnly) {
                saveMetadata = false;
            }
        }

        if (saveMetadata) {
            // Conform the metadata before saving it
            const metadataToSave = _und.chain(ccNFTMetadata.tokenProps)
                .pairs()
                .map(pair => pair[0] === 'contents' ? ['contentsURL', pair[1].toString()] : pair)
                .object()
                .value();
            this._nextDataToRetrieve(true)
            .saveMetadata(metadataToSave, !this.retrieveContents);
        }
    }

    /**
     * Request to save the retrieved non-fungible token contents data
     *
     * NOTE: this method should be called from code executed from the NFTokenRetrieval.dbCS
     *        critical section object.
     *
     * @param {Buffer} contentsData The retrieved non-fungible token contents data
     * @param {boolean} [isFinal=false] Indicates whether this is the last data chunk of the contents
     */
    saveRetrievedContentsData(contentsData, isFinal = false) {
        if (this.retrieveContents) {
            if (!this._isFinalDataRetrieved) {
                // Save the retrieved contents data
                this._nextDataToRetrieve()
                .saveContentsData(contentsData, isFinal);
            }
            else {
                // Inconsistency: trying to save retrieved non-fungible token contents data when final data
                //  has already been retrieved
                Catenis.logger.ERROR('Trying to save retrieved non-fungible token contents data when final data has already been retrieved', {
                    nfTokenRetrieval: this,
                    retrievedContentsData: contentsData
                });
            }
        }
        else {
            // Inconsistency: trying to save retrieved non-fungible token contents data when contents should
            //  not be retrieved
            Catenis.logger.ERROR('Trying to save retrieved non-fungible token contents data when contents should not be retrieved', {
                nfTokenRetrieval: this,
                retrievedContentsData: contentsData
            });
        }
    }

    /**
     * Request to finalize the last retrieved non-fungible token contents data
     *
     * NOTE: this method should be called from code executed from the NFTokenRetrieval.dbCS
     *        critical section object.
     */
    finalizeRetrievedContentsData() {
        if (this.retrieveContents) {
            if (!this._isFinalDataRetrieved) {
                // Finalize the last retrieved contents data
                this._lastRetrievedContentsData.finalizeContentsData();
            }
            else {
                // Inconsistency: trying to finalize retrieved non-fungible token contents data when final data
                //  has already been retrieved
                Catenis.logger.ERROR('Trying to finalize retrieved non-fungible token contents data when final data has already been retrieved', {
                    nfTokenRetrieval: this
                });
            }
        }
        else {
            // Inconsistency: trying to finalize retrieved non-fungible token contents data when contents should
            //  not be retrieved
            Catenis.logger.ERROR('Trying to finalize retrieved non-fungible token contents data when contents should not be retrieved', {
                nfTokenRetrieval: this
            });
        }
    }

    /**
     * Update the non-fungible token retrieval progress
     *
     * NOTE: this method should be called from code executed from the NFTokenRetrieval.dbCS
     *        critical section object.
     *
     * @param {number} bytesRetrieved Number of additional bytes of data that have been retrieved
     * @param {boolean} [isContentsData=true] Indicates that the retrieved data is for a non-fungible token contents
     *                                         data. Otherwise, it is for the non-fungible token metadata
     */
    updateRetrievalProgress(bytesRetrieved, isContentsData = true) {
        // Validate argument
        if (!Number.isInteger(bytesRetrieved) || bytesRetrieved < 0) {
            Catenis.logger.ERROR('NFTokenRetrieval.updateRetrievalProgress() method called with invalid argument:', {
                bytesRetrieved
            });
            throw new TypeError('Invalid bytesRetrieved argument');
        }

        // Make sure that retrieval progress has not yet finalized
        if (this.progress.done) {
            Catenis.logger.ERROR('Trying to update non-fungible token retrieval progress that has already been finalized', {
                nfTokenRetrieval: this
            });
            throw new Error('Trying to update non-fungible token retrieval progress that has already been finalized');
        }

        if (isContentsData) {
            this.progress.contentsBytesRetrieved += bytesRetrieved;
        }
        else {
            this.progress.metadataBytesRetrieved += bytesRetrieved;
        }

        // Now, save updated progress to the database
        this._saveProgressToDB();
    }

    /**
     * Finalize the non-fungible token retrieval
     * @param {Error} [error] Error that took place during the non-fungible token retrieval
     */
    finalizeRetrievalProgress(error) {
        if (!error) {
            // Make sure that all non-fungible token data has been retrieved
            if (!this._isFinalDataRetrieved) {
                throw new Error('Unable to finalize retrieval progress: not all non-fungible token data has been retrieved yet');
            }
        }

        if (this.progress.done) {
            // Non-fungible token retrieval already finalized. Nothing to do
            Catenis.logger.WARN('Trying to finalize non-fungible token retrieval progress that is already finalized', {
                nfTokenRetrieval: this,
                finalization: {
                    error
                }
            });
            return;
        }

        this.progress.done = true;

        if (error) {
            this.progress.success = false;
            this.progress.error = this._conformRetrievalError(error);
        }
        else {
            this.progress.success = true;

            // Initialize data delivery state
            this.delivery = {
                dataChunksSent: 0,
                done: false
            };

            this._updateNextRetrievedNFTokenData();
        }

        this.progress.finishDate = new Date();

        // Now, save updated progress to the database
        this._saveProgressToDB(!error);
    }

    /**
     * @typedef {Object} NonFungibleTokenRetrievalProgressInfo
     * @property {NonFungibleTokenRetrievalProgress} progress
     * @property {string} [continuationToken]
     */

    /**
     * Retrieve the current non-fungible token retrieval progress
     * @returns {NonFungibleTokenRetrievalProgressInfo}
     */
    getRetrievalProgress() {
        // noinspection JSValidateTypes
        /**
         * @type {NonFungibleTokenRetrievalProgressInfo}
         */
        const retVal = {
            progress: {
                bytesRetrieved: this.progress.metadataBytesRetrieved + this.progress.contentsBytesRetrieved,
                ..._und.omit(this.progress, ['metadataBytesRetrieved', 'contentsBytesRetrieved'])
            }
        };

        if (this.progress.done && this.progress.success) {
            retVal.continuationToken = this.nextContinuationToken;
        }

        return retVal;
    }

    /**
     * @typedef {Object} NFTokenEncodedContentsData
     * @property {string} data The text encoded (base64, hex, or utf8) non-fungible token contents data
     */

    /**
     * @typedef {Object} DeliveredRetrievedNonFungibleTokenData
     * @property {Object} [metadata] The retrieved non-fungible token metadata
     * @property {NFTokenEncodedContentsData} [contents] The retrieved non-fungible token contents data
     */

    /**
     * Get the following retrieved non-fungible token data to be delivered to the end user
     * @param {string} [continuationToken] ID that identifies the retrieved non-fungible token data to be delivered. If
     *                                      not specified, the next retrieved non-fungible token data is assumed
     * @returns {DeliveredRetrievedNonFungibleTokenData}
     */
    deliverRetrievedData(continuationToken) {
        // Make sure that retrieved non-fungible token data can be delivered
        let errMsg = 'Retrieved non-fungible token data cannot be delivered';
        let errCode;

        if (!this.progress.done || !this.progress.success) {
            errMsg += '; data not available';
            errCode = 'nft_retrieval_not_available';
        }
        else if (this.delivery.done) {
            errMsg += '; data already delivered';
            errCode = 'nft_retrieval_already_delivered';
        }
        else if (continuationToken && this.nextContinuationToken !== continuationToken) {
            errMsg += '; unexpected continuation token';
            errCode = 'nft_retrieval_invalid_cont_token';
        }
        else if (this.delivery.lastSentDate
                && this.refMoment.diff(this.delivery.lastSentDate, 'seconds', true)
                > cfgSettings.timeContinueDataDelivery) {
            errMsg += '; data expired';
            errCode = 'nft_retrieval_expired';
        }

        if (errCode) {
            throw new Meteor.Error(errCode, errMsg);
        }

        // Get the retrieved non-fungible token data to deliver
        /**
         * @type {DeliveredRetrievedNonFungibleTokenData}
         */
        const dataToDeliver = {};

        const metadata = this._nextRetrievedNFTokenData.metadata;

        if (metadata) {
            dataToDeliver.metadata = metadata;

            // Update delivery state
            this.delivery.dataChunksSent++;
            this.delivery.done = this._nextRetrievedNFTokenData.isFinal;
            this.delivery.lastSentDate = new Date();

            this._updateNextRetrievedNFTokenData();
        }

        // Add contents data if not yet done
        if (!this.delivery.done) {
            const contentsData = this._nextRetrievedNFTokenData.contentsData;

            if (contentsData) {
                dataToDeliver.contents = {
                    data: contentsData.toString(this.contentsOptions.encoding)
                };

                // Update delivery state
                this.delivery.dataChunksSent++;
                this.delivery.done = this._nextRetrievedNFTokenData.isFinal;
                this.delivery.lastSentDate = new Date();

                this._updateNextRetrievedNFTokenData();
            }
        }

        this._saveDeliveryToDB();

        return dataToDeliver;
    }

    /**
     * Initialize module
     */
    static initialize() {
        Catenis.logger.TRACE('NFTokenRetrieval initialization');
        // Execute process to purge old non-fungible token retrievals
        purgeOldNFTokenRetrievals();
        Catenis.logger.TRACE('Setting recurring timer to purge old non-fungible token retrievals');
        this.intervalHandle.purgeOldRetrievals = Meteor.setInterval(purgeOldNFTokenRetrievals, cfgSettings.purgeOldRetrievalsInterval);
    }

    /**
     * Retrieve the non-fungible token retrieval object with the given database doc/rec ID
     * @param {string} doc_id The non-fungible token retrieval database doc/rec ID
     * @return {NFTokenRetrieval} The non-fungible token retrieval database doc/rec
     */
    static getNFTokenRetrievalByDocId(doc_id) {
        const docNFTokenRetrieval = Catenis.db.collection.NonFungibleTokenRetrieval.findOne({
            _id: doc_id
        });

        if (!docNFTokenRetrieval) {
            // Invalid database doc/rec ID
            throw new Error(`Cannot find non-fungible token retrieval with the given database doc/rec ID: ${doc_id}`);
        }

        return new NFTokenRetrieval(docNFTokenRetrieval);
    }

    /**
     * Retrieve the non-fungible token retrieval object with the given ID
     * @param {string} tokenRetrievalId The external ID of the non-fungible token retrieval
     * @param {string} tokenId The external ID of the non-fungible token being retrieved
     * @param {string} [deviceId] Device ID of device trying to access the non-fungible token retrieval
     * @returns {NFTokenRetrieval}
     */
    static getNFTokenRetrievalByTokenRetrievalId(tokenRetrievalId, tokenId, deviceId) {
        const docNFTokenRetrieval = Catenis.db.collection.NonFungibleTokenRetrieval.findOne({
            tokenRetrievalId
        });

        if (!docNFTokenRetrieval) {
            // Invalid token retrieval ID
            throw new Meteor.Error('nft_retrieval_invalid_id', 'Unable to find non-fungible token retrieval with the given token retrieval ID');
        }

        const nfTokenRetrieval = new NFTokenRetrieval(docNFTokenRetrieval)

        // Make sure that non-fungible token retrieval is for the correct non-fungible token
        if (nfTokenRetrieval.tokenId !== tokenId) {
            throw new Meteor.Error('nft_retrieval_wrong_token', 'Non-fungible token retrieval is for a different non-fungible token');
        }

        if (deviceId) {
            // Make sure that the device requesting the non-fungible token retrieval is the one who owns it
            if (deviceId !== nfTokenRetrieval.deviceId) {
                throw new Meteor.Error('nft_retrieval_wrong_device', 'Non-fungible token retrieval belongs to a different device');
            }
        }

        return nfTokenRetrieval;
    }

    /**
     * Retrieve the non-fungible token retrieval object with the given continuation token
     * @param {string} continuationToken The external ID D that identifies the retrieved non-fungible token data to be
     *                                    delivered
     * @param {string} tokenId The external ID of the non-fungible token being retrieved
     * @param {string} [deviceId] Device ID of device trying to access the non-fungible token retrieval
     * @returns {NFTokenRetrieval}
     */
    static getNFTokenRetrievalByContinuationToken(continuationToken, tokenId, deviceId) {
        // Get the corresponding retrieved non-fungible token data database doc/rec
        const docRetrievedNFTokenData = Catenis.db.collection.RetrievedNonFungibleTokenData.findOne({
            retrievedNFTokenDataId: continuationToken
        }, {
            fields: {
                nonFungibleTokenRetrieval_id: 1
            }
        });

        if (!docRetrievedNFTokenData) {
            // Invalid continuation token
            throw new Meteor.Error('nft_retrieval_invalid_cont_token', 'Unable to find retrieved non-fungible token data for the given continuation token');
        }

        const docNFTokenRetrieval = Catenis.db.collection.NonFungibleTokenRetrieval.findOne({
            _id: docRetrievedNFTokenData.nonFungibleTokenRetrieval_id
        });

        if (!docNFTokenRetrieval) {
            // Invalid database doc/rec ID
            throw new Error(`Cannot find non-fungible token retrieval associated with the given retrieved non-fungible token data database doc/rec (doc_id: ${docRetrievedNFTokenData._id}).`);
        }

        const nfTokenRetrieval = new NFTokenRetrieval(docNFTokenRetrieval);

        // Make sure that non-fungible token retrieval is for the correct non-fungible token
        if (nfTokenRetrieval.tokenId !== tokenId) {
            throw new Meteor.Error('nft_retrieval_wrong_token', 'Non-fungible token retrieval is for a different non-fungible token');
        }

        if (deviceId) {
            // Make sure that the device requesting the non-fungible token retrieval is the one who owns it
            if (deviceId !== nfTokenRetrieval.deviceId) {
                throw new Meteor.Error('nft_retrieval_wrong_device', 'Non-fungible token retrieval belongs to a different device');
            }
        }

        return nfTokenRetrieval;
    }
}


// Definition of module (private) functions
//

/**
 * Generate a new non-fungible token retrieval ID
 * @param {boolean} checkExistence Indicates whether to check if newly generated ID already exists
 * @return {string} The newly generated ID
 */
function newNFTokenRetrievalId(checkExistence = true) {
    let id = 'r' + Random.id(19);

    if (checkExistence) {
        while (Catenis.db.collection.NonFungibleTokenRetrieval.findOne({tokenRetrievalId: id}, {fields: {_id: 1}})) {
            Catenis.logger.DEBUG('Newly generated Non-Fungible Token Retrieval ID (%s) already exists. Trying again.', id);

            id = 'r' + Random.id(19);
        }
    }

    return id;
}

/**
 * Purge old non-fungible token retrieval database docs/recs
 */
function purgeOldNFTokenRetrievals() {
    Catenis.logger.TRACE('Executing process to purge old Non-Fungible Token Retrieval database docs/recs');
    async function getOldNFTokenRetrievalsToRemove(refMoment) {
        const idDocsToRemove = new Set();

        // Identify incomplete non-fungible token retrievals that should be removed
        const earliestDateIncompleteRetrievals = moment(refMoment).subtract(cfgSettings.timeKeepIncompleteRetrieval, 'seconds').toDate();

        // noinspection JSUnresolvedFunction
        await Catenis.db.mongoCollection.RetrievedNonFungibleTokenData.aggregate([{
            $sort: {
                nonFungibleTokenRetrieval_id: 1,
                order: 1
            }
        }, {
            $group: {
                _id: '$nonFungibleTokenRetrieval_id',
                latestIsFinal: {
                    $last: '$isFinal'
                },
                latestCreatedDate: {
                    $last: '$createdDate'
                }
            }
        }, {
            $match: {
                latestIsFinal: false,
                latestCreatedDate: {
                    $lt: earliestDateIncompleteRetrievals
                }
            }
        }]).forEach(doc => idDocsToRemove.add(doc._id));

        // Include non-fungible token retrievals with no retrieved non-fungible token data
        // noinspection JSUnresolvedFunction
        await Catenis.db.mongoCollection.NonFungibleTokenRetrieval.aggregate([{
            $match: {
                createdDate: {
                    $lt: earliestDateIncompleteRetrievals
                }
            }
        }, {
            $lookup: {
                from: 'RetrievedNonFungibleTokenData',
                let: {
                    nfTokenRetrieval_id: "$_id"
                },
                pipeline: [{
                    $match: {
                        $expr: {
                            $eq: ['$nonFungibleTokenRetrieval_id', '$$nfTokenRetrieval_id']
                        }
                    }
                }, {
                    $project: {
                        _id: 1
                    }
                }],
                as: 'tokenData'
            }
        }, {
            $match: {
                tokenData: {
                    $size: 0
                }
            }
        }]).forEach(doc => idDocsToRemove.add(doc._id));

        // Identify undelivered retrieved non-fungible token data that should be removed
        const earliestDateUndeliveredData = moment(refMoment).subtract(cfgSettings.timeKeepUndeliveredData, 'seconds').toDate();

        Catenis.db.collection.NonFungibleTokenRetrieval.find({
            'progress.done': true,
            'delivery.done': false,
            'progress.finishDate': {
                $lt: earliestDateUndeliveredData
            }
        }, {
            fields: {
                _id: 1
            }
        }).forEach(doc => idDocsToRemove.add(doc._id));

        // Identify fully delivered retrieved non-fungible token data that should be removed
        const earliestDateDeliveredData = moment(refMoment).subtract(cfgSettings.timeKeepDeliveredData, 'seconds').toDate();

        Catenis.db.collection.NonFungibleTokenRetrieval.find({
            'delivery.done': true,
            'delivery.lastSentDate': {
                $lt: earliestDateDeliveredData
            }
        }, {
            fields: {
                _id: 1
            }
        }).forEach(doc => idDocsToRemove.add(doc._id));

        return Array.from(idDocsToRemove);
    }

    try {
        const refMoment = moment();

        // Execute code in critical section to avoid database concurrency
        NFTokenRetrieval.dbCS.execute(() => {
            const idNFTokenRetrievalsToRemove = Future.fromPromise(getOldNFTokenRetrievalsToRemove(refMoment)).wait();

            if (idNFTokenRetrievalsToRemove.length > 0) {
                // Remove all retrieved non-fungible token data associated with non-fungible token
                //  retrievals to be removed
                const numRetrievedNFTDataRemoved = Catenis.db.collection.RetrievedNonFungibleTokenData.remove({
                    nonFungibleTokenRetrieval_id: {
                        $in: idNFTokenRetrievalsToRemove
                    }
                });
                Catenis.logger.DEBUG('Number of RetrievedNonFungibleTokenData docs/recs associated with old non-fungible token retrievals that have been removed: %d', numRetrievedNFTDataRemoved);

                // Now remove the non-fungible token retrievals themselves
                const numNFTokenRetrievalsRemoved = Catenis.db.collection.NonFungibleTokenRetrieval.remove({
                    _id: {
                        $in: idNFTokenRetrievalsToRemove
                    }
                });
                Catenis.logger.DEBUG('Number of old NonFungibleTokenRetrieval doc/recs that have been removed: %d', numNFTokenRetrievalsRemoved);
            }
        });
    }
    catch (err) {
        Catenis.logger.ERROR('Error while executing process to purge old Non-Fungible Token Retrieval database docs/recs.', err);
    }
}


// Module code
//

// Lock class
Object.freeze(NFTokenRetrieval);
