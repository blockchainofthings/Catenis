/**
 * Created by claudio on 2022-07-13
 */

//console.log('[NFTokenTransfer.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import config from 'config';
import _und from 'underscore';
// Meteor packages
import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';
// noinspection ES6CheckImport
import { Promise } from 'meteor/promise';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { NFTokenContentsProgress } from './NFTokenContentsProgress';
import { CriticalSection } from './CriticalSection';
import { NonFungibleToken } from './NonFungibleToken';
import { Device } from './Device';
import { NFTokenStorage } from './NFTokenStorage';
import { NFTokenContentsTransform } from './NFTokenContentsTransform';
import { NFTokenMetadataWritable } from './NFTokenMetadataWritable';
import { NFTokenMetadataRepo } from './NFTokenMetadataRepo';
import { CCSingleNFTokenMetadata } from './CCSingleNFTokenMetadata';
import { CCMetadata } from './CCMetadata';
import moment from 'moment';

// Config entries
const nftTransferConfig = config.get('nfTokenTransfer');

// Configuration settings
export const cfgSettings = {
    timeKeepIncompleteTransfer: nftTransferConfig.get('timeKeepIncompleteTransfer'),
    timeKeepProcessedTransfer: nftTransferConfig.get('timeKeepProcessedTransfer'),
    purgeOldTransfersInterval: nftTransferConfig.get('purgeOldTransfersInterval')
};


// Definition of classes
//

/**
 * Non-Fungible Token Transfer object class
 */
export class NFTokenTransfer extends NFTokenContentsProgress {
    /**
     * Critical section object to avoid concurrent access to database collections related to non-fungible
     *  token transfer (NonFungibleTokenTransfer)
     * @type {CriticalSection}
     */
    static dbCS = new CriticalSection();

    /**
     * @type {Object}
     * @property {(undefined|number)} purgeOldTransfers
     */
    static intervalHandle = {
        purgeOldTransfers: undefined
    };

    /**
     * @typedef {Object} NonFungibleTokenTransferError
     * @property {number} code Code number of error that took place while transferring the non-fungible token
     * @property {string} message Text describing the error that took place while transferring the non-fungible token
     */

    /**
     * @typedef {Object} NFTokenTransferContentsStoredProgress
     * @property {number} bytesRead Number of non-fungible token contents bytes that have been read
     * @property {number} bytesWritten Number of non-fungible token contents bytes that have been written
     */

    /**
     * @typedef {Object} NFTokenTransferMetadataStoredProgress
     * @property {number} bytesRead Number of non-fungible token metadata bytes that have been read
     * @property {number} [bytesWritten] Number of non-fungible token metadata bytes that have been written
     * @property {NFTokenTransferContentsStoredProgress} [contents] Progress reading/writing non-fungible token contents
     */

    /**
     * Non-fungible token transfer stored progress
     * @typedef {Object} NonFungibleTokenTransferStoredProgress
     * @property {NFTokenTransferMetadataStoredProgress} metadata Progress reading/writing non-fungible token
     *                                                             metadata/contents
     * @property {boolean} done Indicates whether the non-fungible token transfer has been finalized, either
     *                           successfully or with an error
     * @property {boolean} [success] Indicates whether the non-fungible token has been successfully transferred
     * @property {NonFungibleTokenTransferError} [error] Error that took place while transferring the non-fungible token
     * @property {Date} [finishedDate] Date and time when the non-fungible token transfer was finalized
     */

    /**
     * @typedef {Object} NFTokenTransferDataManipulationProgress
     * @property {number} bytesRead Number of bytes of non-fungible token data that have been read
     * @property {number} [bytesWritten] Number of bytes of non-fungible token data that have been written
     */

    /**
     * @typedef {Object} NonFungibleTokenTransferProgress
     * @property {NFTokenTransferDataManipulationProgress} dataManipulation Progress of non-fungible token data
     *                                                      manipulation: reading and rewriting it after re-encryption
     *                                                      if required
     * @property {boolean} done Indicates whether the non-fungible token transfer has been finalized, either
     *                           successfully or with an error
     * @property {boolean} [success] Indicates whether the non-fungible token has been successfully transferred
     * @property {NonFungibleTokenTransferError} [error] Error that took place while transferring the non-fungible token
     * @property {Date} [finishedDate] Date and time when the non-fungible token transfer was finalized
     */

    /**
     * NonFungibleTokenTransfer database doc/rec
     * @typedef {Object} NonFungibleTokenTransferRec
     * @property {string} _id MongoDB internal document ID provided by Meteor
     * @property {string} tokenTransferId External ID used to uniquely identify this non-fungible token transfer
     * @property {string} tokenId External ID of the non-fungible token being transferred
     * @property {string} sendingDeviceId External ID of device that is transferring the non-fungible token
     * @property {string} receivingDeviceId External ID of device that will receive the transferred non-fungible token
     * @property {NonFungibleTokenTransferStoredProgress} progress Progress of the non-fungible token transfer
     * @property {Date} createdDate Date and time when doc/rec has been created
     */

    /**
     * Class constructor
     * @param {NonFungibleTokenTransferRec} [doc] NonFungibleTokenTransfer database doc/rec
     * @param {NonFungibleToken} [nfToken] Non-fungible token object to be transferred
     * @param {Device} [sendingDevice] Device object of the device that is transferring the non-fungible
     * @param {Device} [receivingDevice] Device object of the device that will receive the transferred non-fungible
     * @param {boolean} [doNotSaveToDB=false] When set, avoid that the non-fungible token transfer be saved to the
     *                                   local database. This is meant to be used only when reconstructing a
     *                                   non-fungible token transfer transaction
     */
    constructor(doc, nfToken, sendingDevice, receivingDevice, doNotSaveToDB = false) {
        super();

        if (doc) {
            this.doc_id = doc._id;
            this.tokenTransferId = doc.tokenTransferId;
            this.tokenId = doc.tokenId;
            this.sendingDeviceId = doc.sendingDeviceId;
            this.receivingDeviceId = doc.receivingDeviceId;
            this.progress = doc.progress;
            this.createdDate = doc.createdDate;

            /**
             * @type {(NonFungibleToken|undefined)}
             */
            this._nfToken = undefined;
            /**
             * @type {(Device|undefined)}
             */
            this._sendingDevice = undefined;
            /**
             * @type {(Device|undefined)}
             */
            this._receivingDevice = undefined;
        }
        else {
            // Creating a new non-fungible token transfer object.
            //  Validate arguments
            const errArg = {};

            if (!(nfToken instanceof NonFungibleToken)) {
                errArg.nfToken = nfToken;
            }

            if (!(sendingDevice instanceof Device)) {
                errArg.sendingDevice = sendingDevice;
            }

            if (!(receivingDevice instanceof Device)) {
                errArg.receivingDevice = receivingDevice;
            }

            if (Object.keys(errArg).length > 0) {
                const errArgs = Object.keys(errArg);

                Catenis.logger.ERROR(`NFTokenTransfer constructor called with invalid argument${errArgs.length > 1 ? 's' : ''}`, errArg);
                throw new TypeError(`Invalid ${errArgs.join(', ')} argument${errArgs.length > 1 ? 's' : ''}`);
            }

            this._nfToken = nfToken;
            this.tokenId = nfToken.tokenId;
            this._sendingDevice = sendingDevice;
            this.sendingDeviceId = sendingDevice.deviceId;
            this._receivingDevice = receivingDevice;
            this.receivingDeviceId = receivingDevice.deviceId;

            /**
             * @type {NonFungibleTokenTransferStoredProgress}
             */
            this.progress = {
                metadata: {
                    bytesRead: 0
                },
                done: false
            };

            if (!doNotSaveToDB) {
                // Save the new non-fungible token transfer to the database
                this._saveToDB();
            }
        }
    }

    /**
     * Indicates whether this non-fungible token transfer is already saved to the database
     * @return {boolean}
     * @private
     */
    get _isSavedToDB() {
        return !!this.doc_id;
    }

    /**
     * The non-fungible token object being transferred
     * @returns {NonFungibleToken}
     */
    get nfToken() {
        if (!this._nfToken) {
            this._nfToken = NonFungibleToken.getNFTokenByTokenId(this.tokenId);
        }

        return this._nfToken;
    }

    /**
     * The device object of the device that is transferring the non-fungible token
     * @returns {Device}
     */
    get sendingDevice() {
        if (!this._sendingDevice) {
            this._sendingDevice = Device.getDeviceByDeviceId(this.sendingDeviceId);
        }

        return this._sendingDevice;
    }

    /**
     * The device object of the device that will receive the transferred non-fungible token
     * @returns {Device}
     */
    get receivingDevice() {
        if (!this._receivingDevice) {
            this._receivingDevice = Device.getDeviceByDeviceId(this.receivingDeviceId);
        }

        return this._receivingDevice;
    }

    /**
     * Get the Colored Coins attributed ID of the non-fungible token being transferred
     * @returns {string}
     */
    get ccTokenId() {
        return this.nfToken.ccTokenId;
    }

    /**
     * Save non-fungible token transfer object to the database
     * @private
     */
    _saveToDB() {
        // Make sure that it has not yet been saved to the database
        if (!this._isSavedToDB) {
            const doc = {
                tokenTransferId: newNFTokenTransferId(),
                tokenId: this.tokenId,
                sendingDeviceId: this.sendingDeviceId,
                receivingDeviceId: this.receivingDeviceId,
                progress: this.progress,
                createdDate: new Date()
            };

            try {
                this.doc_id = Catenis.db.collection.NonFungibleTokenTransfer.insert(doc);
            }
            catch (err) {
                Catenis.logger.ERROR('Failure while inserting new NonFungibleTokenTransfer database doc/rec.', err);
                throw new Error(`Failure while inserting new NonFungibleTokenTransfer database doc/rec: ${err}`);
            }

            // Update object properties
            this.tokenTransferId = doc.tokenTransferId;
            this.createdDate = doc.createdDate;
        }
    }

    /**
     * Save the current non-fungible token transfer progress to the database
     * @private
     */
    _saveProgressToDB() {
        if (!this._isSavedToDB) {
            Catenis.logger.ERROR('Unable to save non-fungible token transfer progress to database: non-fungible token transfer not yet saved to database', {
                nfTokenTransfer: this
            });
            throw new Error('Unable to save non-fungible token transfer progress to database: non-fungible token transfer not yet saved to database');
        }

        try {
            Catenis.db.collection.NonFungibleTokenTransfer.update({
                _id: this.doc_id
            }, {
                $set: {
                    progress: this.progress
                }
            });
        }
        catch (err) {
            Catenis.logger.ERROR('Error updating non-fungible token transfer database doc/rec (doc_id: %s) to record transfer progress.', this.doc_id, err);
            throw new Error(`Error updating non-fungible token transfer database doc/rec (doc_id: ${this.doc_id}) to record transfer progress: ${err}`);
        }
    }

    /**
     * Conform an error that might happen during the transfer of the non-fungible token to
     *  be presented to the end user
     * @param {Error} err The error to be conformed
     * @return {{code: number, message: string}} The resulting conformed error
     * @private
     */
    _conformTransferError(err) {
        let error = {};

        if (err instanceof Meteor.Error) {
            if (err.error === 'ctn_device_low_service_acc_balance') {
                error.code = 400;
                error.message = 'Not enough credits to pay for transfer non-fungible token service';
            }
            else if (err.error === 'ctn_transfer_nft_invalid_cc_id' ||  err.error === 'ctn_transfer_nft_burnt_token'
                    || err.error === 'ctn_transfer_nft_invalid_addr') {
                error.code = 400;
                error.message = 'Unavailable or inconsistent non-fungible token';
            }
            else if (err.error === 'ctn_transfer_nft_not_holder' || err.error === 'ctn_transfer_nft_utxo_not_found') {
                error.code = 400;
                error.message = 'No possession to transfer non-fungible token';
            }
            else {
                error.code = 500;
                error.message = 'Internal server error';
            }
        }
        else {
            error.code = 500;
            error.message = 'Internal server error';
        }

        if (error.code === 500) {
            // Log error
            Catenis.logger.ERROR('Error transferring non-fungible token (tokenTransferId: %s).', this.tokenTransferId, err);
        }

        return error;
    }

    /**
     * Asynchronously retrieve the metadata for a given non-fungible token
     * @param {string} ccTokenId Colored Coins attributed ID of the non-fungible token
     * @returns {Promise<Object>} A promise that resolves returning the retrieved non-fungible token metadata
     * @private
     */
    _retrieveMetadata(ccTokenId) {
        let promiseOutcome;
        const promise = new Promise((resolve, reject) => {
            promiseOutcome = {
                resolve,
                reject
            };
        });

        class NFTokenTransferMetadataRepo extends NFTokenMetadataRepo {
            /**
             * @param {NFTokenTransfer} nfTokenTransfer The non-fungible token transfer object
             * @param {Function} metadataCallback Callback function to pass the retrieved metadata
             */
            constructor(nfTokenTransfer, metadataCallback) {
                super();

                this.nfTokenTransfer = nfTokenTransfer;
                this.metadataCallback = metadataCallback;
            }

            reportProgress(bytesRetrieved) {
                // Execute code in critical section to avoid database concurrency
                NFTokenTransfer.dbCS.execute(() => {
                    this.nfTokenTransfer.updateTransferProgress(bytesRetrieved, 0);
                });
            }

            saveToRepo(metadata) {
                this.metadataCallback(null, metadata);
            }
        }

        // Prepare stream to save the retrieved non-fungible token metadata
        const metaWritable = new NFTokenMetadataWritable(new NFTokenTransferMetadataRepo(this, endRetrieval));

        metaWritable.once('error', (err) => {
            Catenis.logger.ERROR('Error writing retrieved non-fungible token (ccTokenId: %s) metadata for non-fungible token transfer.', ccTokenId, err);
            endRetrieval(new Error(`Error writing retrieved non-fungible token (ccTokenId: ${ccTokenId}) metadata for non-fungible token transfer: ${err}`));
        });

        // Prepare to retrieve non-fungible token metadata
        const metaReadable = Catenis.c3NodeClient.getNFTokenMetadataReadableStream(ccTokenId);

        metaReadable.once('error', err => {
            Catenis.logger.ERROR('Error reading non-fungible token (ccTokenId: %s) metadata for non-fungible token transfer.', ccTokenId, err);
            metaWritable.destroy(new Error(`Error reading non-fungible token (ccTokenId: ${ccTokenId}) metadata for non-fungible token transfer: ${err}`));
        });

        metaReadable.pipe(metaWritable);

        function endRetrieval(error, metadata) {
            // Fee up event handlers
            metaReadable.removeAllListeners();
            metaWritable.removeAllListeners();

            if (error) {
                promiseOutcome.reject(error);
            }
            else {
                promiseOutcome.resolve(metadata);
            }
        }

        return promise;
    }

    /**
     * Asynchronously rewrite the non-fungible token contents
     * @param {string} cid The current IPFS CID of the non-fungible token contents
     * @param {CryptoKeys} sourceKeys The crypto keys to be used for decrypting the non-fungible token contents
     * @param {CryptoKeys} destKeys The crypto keys to be used for encrypting the non-fungible token contents
     * @returns {Promise<string>} A promise that resolves when the non-fungible token contents are rewritten, returning
     *                             its new IPFS CID
     * @private
     */
    _rewriteContents(cid, sourceKeys, destKeys) {
        let promiseOutcome;
        const promise = new Promise((resolve, reject) => {
            promiseOutcome = {
                resolve,
                reject
            };
        });

        // Prepare stream to decrypt and re-encrypt the non-fungible token contents
        const contentsTransform = new NFTokenContentsTransform(this);

        contentsTransform.once('error', (err) => {
            Catenis.logger.ERROR('Error decrypting and re-encrypting non-fungible token contents for non-fungible token transfer.', err);
            endRewriting(new Error(`Error decrypting and re-encrypting non-fungible token contents for non-fungible token transfer: ${err}`));
        });

        contentsTransform.setDecryption(sourceKeys);
        contentsTransform.setEncryption(destKeys);

        // Prepare to retrieve non-fungible token contents
        const nfTokenStorage = new NFTokenStorage();
        const contentsReadable = nfTokenStorage.retrieve(cid);

        contentsReadable.once('error', err => {
            Catenis.logger.ERROR('Error reading non-fungible token contents for non-fungible token transfer.', err);
            contentsTransform.destroy(new Error(`Error reading non-fungible token contents for non-fungible token transfer: ${err}`));
        });

        // Store the (re-encrypted) non-fungible token contents back onto IPFS
        nfTokenStorage.store(contentsReadable.pipe(contentsTransform))
        .then(cid => {
            // Return the new IPFS CID of the non-fungible token contents
            endRewriting(null, cid);
        }, err => {
            Catenis.logger.ERROR('Error storing non-fungible token contents for non-fungible token transfer.', err);
            endRewriting(new Error(`Error storing non-fungible token contents for non-fungible token transfer: ${err}`));
        });

        function endRewriting(error, cid) {
            // Free up event handlers
            if (contentsReadable) {
                contentsReadable.removeAllListeners();
            }

            if (contentsTransform) {
                contentsTransform.removeAllListeners();
            }

            if (error) {
                promiseOutcome.reject(error);
            }
            else {
                promiseOutcome.resolve(cid);
            }
        }

        return promise;
    }

    /**
     * Asynchronously get the Colored Coins metadata to be sent along with the non-fungible token transfer
     * @param {string[]} ccTokenIds The Colored Coins attributed IDs of the non-fungible tokens that will be affected
     *                               by the non-fungible token transfer (all non-fungible tokens held by the same UTXO
     *                               that holds the non-fungible token being transferred)
     * @param {CryptoKeys} sendingKeys The crypto keys of the bitcoin address that currently holds the non-fungible
     *                                  tokens. It will be used for decrypting the metadata props and contents of those
     *                                  non-fungible tokens
     * @param {CryptoKeys} receivingKeys The crypto keys of the bitcoin address that will hold the non-fungible token
     *                                    that is being transferred. It will be used for encrypting the metadata props
     *                                    and contents of that non-fungible token
     * @param {CryptoKeys} returningKeys The crypto keys of the bitcoin address that will hold oll the other
     *                                    non-fungible tokens. It will be used for encrypting the metadata props and
     *                                    contents of those non-fungible tokens
     * @returns {(CCMetadata|undefined)}
     */
    async getTransferMetadata(ccTokenIds, sendingKeys, receivingKeys, returningKeys) {
        let updatedMetadata = new CCMetadata();

        const checkUpdateNFTokenMetadata = async (ccTokenId) => {
            // Get the current non-fungible token metadata
            const tokenMetadata = await this._retrieveMetadata(ccTokenId);

            // Parse the retrieved metadata
            const ccNFTMetadata = new CCSingleNFTokenMetadata(tokenMetadata, sendingKeys);

            if (ccNFTMetadata.hasSensitiveProps || ccNFTMetadata.areContentsEncrypted) {
                // Prepare updated non-fungible token metadata
                const tokenProps = ccNFTMetadata.cloneTokenProps();

                if (ccNFTMetadata.areContentsEncrypted) {
                    // Re-encrypt contents
                    tokenProps.contents.cid = await this._rewriteContents(
                        ccNFTMetadata.contentsUrl.cid,
                        sendingKeys,
                        ccTokenId === this.ccTokenId ? receivingKeys : returningKeys
                    );
                }

                const updatedCCNFTMetadata = new CCSingleNFTokenMetadata();

                updatedCCNFTMetadata.setNFTokenProperties(tokenProps);

                // Set up metadata with updated non-fungible token metadata
                updatedMetadata.nfTokenMetadata.addNFTokenMetadataToUpdate(ccTokenId, updatedCCNFTMetadata);
            }
        }

        // Asynchronously process each of the affected non-fungible tokens
        const promises = [];

        for (const ccTokenId of ccTokenIds) {
            promises.push(checkUpdateNFTokenMetadata(ccTokenId));
        }

        // Wait for all the promises to be resolved
        await Promise.all(promises);

        return !updatedMetadata.nfTokenMetadata.isEmpty ? updatedMetadata : undefined;
    }

    /**
     * Implementation of NFTokenContentsProgress base class's method
     * @param {number} bytesRead Number of additional bytes of contents that have been read
     */
    reportReadProgress(bytesRead) {
        // Execute code in critical section to avoid database concurrency
        NFTokenTransfer.dbCS.execute(() => {
            this.updateTransferProgress(bytesRead, 0, true);
        });
    }

    /**
     * Implementation of NFTokenContentsProgress base class's method
     * @param {number} bytesWritten Number of additional bytes of contents that have been written
     */
    reportWriteProgress(bytesWritten) {
        // Execute code in critical section to avoid database concurrency
        NFTokenTransfer.dbCS.execute(() => {
            this.updateTransferProgress(0, bytesWritten, true);
        });
    }

    /**
     * Update the non-fungible token transfer progress
     *
     * NOTE: this method should be called from code executed from the NFTokenTransfer.dbCS
     *        critical section object.
     *
     * @param {number} bytesRead Number of additional bytes of data that have been read (retrieved)
     * @param {number} bytesWritten Number of additional bytes of data that have been written (sent)
     * @param {boolean} [isContentsData=false] Indicates that the data read/written is for a non-fungible token contents
     *                                          data. Otherwise, it is for the non-fungible token metadata
     */
    updateTransferProgress(bytesRead, bytesWritten, isContentsData = false) {
        // Validate arguments
        const errArg = {};

        if (!Number.isInteger(bytesRead) || bytesRead < 0) {
            errArg.bytesRead = bytesRead;
        }

        if (!Number.isInteger(bytesWritten) || bytesWritten < 0) {
            errArg.bytesWritten = bytesWritten;
        }

        if (Object.keys(errArg).length > 0) {
            const errArgs = Object.keys(errArg);

            Catenis.logger.ERROR(`NFTokenTransfer.updateTransferProgress() method called with invalid argument${errArgs.length > 1 ? 's' : ''}`, errArg);
            throw new TypeError(`Invalid ${errArgs.join(', ')} argument${errArgs.length > 1 ? 's' : ''}`);
        }

        // Make sure that transfer progress has not yet finalized
        if (this.progress.done) {
            Catenis.logger.ERROR('Trying to update non-fungible token transfer progress that has already been finalized', {
                nfTokenTransfer: this
            });
            throw new Error('Trying to update non-fungible token transfer progress that has already been finalized');
        }

        if (isContentsData) {
            if (!this.progress.metadata.contents) {
                this.progress.metadata.contents = {
                    bytesRead: 0,
                    bytesWritten: 0
                };
            }

            this.progress.metadata.contents.bytesRead += bytesRead;
            this.progress.metadata.contents.bytesWritten += bytesWritten;
        }
        else {
            this.progress.metadata.bytesRead += bytesRead;

            if (bytesWritten > 0) {
                if (!this.progress.metadata.bytesWritten) {
                    this.progress.metadata.bytesWritten = 0;
                }

                this.progress.metadata.bytesWritten += bytesWritten;
            }
        }

        // Now, save updated progress to the database
        this._saveProgressToDB();
    }

    /**
     * Finalize the non-fungible token transfer
     * @param {Error} [error] Error that took place during the non-fungible token transfer
     */
    finalizeTransferProgress(error) {
        if (this.progress.done) {
            // Non-fungible token transfer already finalized. Nothing to do
            Catenis.logger.WARN('Trying to finalize non-fungible token transfer progress that is already finalized', {
                nfTokenTransfer: this,
                finalization: {
                    error
                }
            });
            return;
        }

        this.progress.done = true;

        if (error) {
            this.progress.success = false;
            this.progress.error = this._conformTransferError(error);
        }
        else {
            this.progress.success = true;
        }

        this.progress.finishDate = new Date();

        // Now, save updated progress to the database
        this._saveProgressToDB(!error);
    }

    /**
     * @typedef {Object} NonFungibleTokenTransferProgressInfo
     * @property {NonFungibleTokenTransferProgress} progress
     */

    /**
     * Retrieve the current non-fungible token transfer progress
     * @returns {NonFungibleTokenTransferProgressInfo}
     */
    getTransferProgress() {
        const dataManipulation = {
            bytesRead: this.progress.metadata.bytesRead
        };

        if (this.progress.metadata.bytesWritten) {
            dataManipulation.bytesWritten = this.progress.metadata.bytesWritten;
        }

        if (this.progress.metadata.contents) {
            dataManipulation.bytesRead += this.progress.metadata.contents.bytesRead;

            if (!dataManipulation.bytesWritten) {
                dataManipulation.bytesWritten = 0;
            }

            dataManipulation.bytesWritten += this.progress.metadata.contents.bytesWritten;
        }

        // noinspection JSValidateTypes
        return {
            progress: {
                dataManipulation,
                ..._und.omit(this.progress, 'metadata')
            }
        };
    }

    /**
     * Initialize module
     */
    static initialize() {
        Catenis.logger.TRACE('NFTokenTransfer initialization');
        // Execute process to purge old non-fungible token transfers
        purgeOldNFTokenTransfers();
        Catenis.logger.TRACE('Setting recurring timer to purge old non-fungible token transfers');
        this.intervalHandle.purgeOldTransfers = Meteor.setInterval(purgeOldNFTokenTransfers, cfgSettings.purgeOldTransfersInterval);
    }

    /**
     * Retrieve the non-fungible token transfer object with the given ID
     * @param {string} tokenTransferId The external ID of the non-fungible token transfer
     * @param {string} tokenId The external ID of the non-fungible token being transferred
     * @param {string} [deviceId] Device ID of device trying to access the non-fungible token transfer
     * @returns {NFTokenTransfer}
     */
    static getNFTokenTransferByTokenTransferId(tokenTransferId, tokenId, deviceId) {
        const docNFTokenTransfer = Catenis.db.collection.NonFungibleTokenTransfer.findOne({
            tokenTransferId
        });

        if (!docNFTokenTransfer) {
            // Invalid token transfer ID
            throw new Meteor.Error('nft_transfer_invalid_id', 'Unable to find non-fungible token transfer with the given token transfer ID');
        }

        const nfTokenTransfer = new NFTokenTransfer(docNFTokenTransfer)

        // Make sure that non-fungible token transfer is for the correct non-fungible token
        if (nfTokenTransfer.tokenId !== tokenId) {
            throw new Meteor.Error('nft_transfer_wrong_token', 'Non-fungible token transfer is for a different non-fungible token');
        }

        if (deviceId) {
            // Make sure that the device requesting the non-fungible token transfer
            //  is the one who is sending the token
            if (deviceId !== nfTokenTransfer.sendingDeviceId) {
                throw new Meteor.Error('nft_transfer_wrong_device', 'Non-fungible token transfer belongs to a different device');
            }
        }

        return nfTokenTransfer;
    }
}


// Definition of module (private) functions
//

/**
 * Generate a new non-fungible token transfer ID
 * @param {boolean} checkExistence Indicates whether to check if newly generated ID already exists
 * @return {string} The newly generated ID
 */
function newNFTokenTransferId(checkExistence = true) {
    let id = 'x' + Random.id(19);

    if (checkExistence) {
        while (Catenis.db.collection.NonFungibleTokenTransfer.findOne({tokenTransferId: id}, {fields: {_id: 1}})) {
            Catenis.logger.DEBUG('Newly generated Non-Fungible Token Transfer ID (%s) already exists. Trying again.', id);

            id = 'x' + Random.id(19);
        }
    }

    return id;
}

/**
 * Purge old non-fungible token transfer database docs/recs
 */
function purgeOldNFTokenTransfers() {
    Catenis.logger.TRACE('Executing process to purge old Non-Fungible Token Transfer database docs/recs');

    try {
        const refMoment = moment();
        const earliestDateIncompleteTransfers = moment(refMoment).subtract(cfgSettings.timeKeepIncompleteTransfer, 'seconds').toDate();
        const earliestDateProcessedTransfers = moment(refMoment).subtract(cfgSettings.timeKeepProcessedTransfer, 'seconds').toDate();

        // Now remove the non-fungible token transfers themselves
        const numNFTokenTransfersRemoved = Catenis.db.collection.NonFungibleTokenTransfer.remove({
            $or: [
                {
                    'progress.done': false,
                    createdDate: {
                        $lt: earliestDateIncompleteTransfers
                    }
                },
                {
                    'progress.done': true,
                    'progress.finishDate': {
                        $lt: earliestDateProcessedTransfers
                    }
                }
            ]
        });
        Catenis.logger.DEBUG('Number of old NonFungibleTokenTransfer doc/recs that have been removed: %d', numNFTokenTransfersRemoved);
    }
    catch (err) {
        Catenis.logger.ERROR('Error while executing process to purge old Non-Fungible Token Transfer database docs/recs.', err);
    }
}


// Module code
//

if (Meteor.isTest) {
    /**
     * Replace external classes for testing this module
     * @param {Object} deviceClass Class to replace Device class for testing this module
     * @param {Object} nonFungibleTokenClass Class to replace NonFungibleToken class for testing this module
     */
    export function resetClasses(deviceClass, nonFungibleTokenClass) {
        Device = deviceClass;
        NonFungibleToken = nonFungibleTokenClass;
    }
}


// Lock class
Object.freeze(NFTokenTransfer);
