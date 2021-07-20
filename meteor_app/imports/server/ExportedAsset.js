/**
 * Created by claudio on 2021-06-22
 */

//console.log('[ExportedAsset.js]: This code just ran.');

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

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { Device } from './Device';
import { Asset } from './Asset';
import { CatenisErc20Token } from './CatenisErc20Token';

// Config entries
const expAssetConfig = config.get('exportedAsset');

// Configuration settings
export const cfgSettings = {
    checkPendingExportRetryInterval: expAssetConfig.get('checkPendingExportRetryInterval'),
    reprocessFailedTxReceipts: {
        tickInterval: expAssetConfig.get('reprocessFailedTxReceipts.tickInterval'),
        ticksToReprocessFactor: expAssetConfig.get('reprocessFailedTxReceipts.ticksToReprocessFactor'),
        maxTicksToReprocess: expAssetConfig.get('reprocessFailedTxReceipts.maxTicksToReprocess'),
        maxReprocessCounter: expAssetConfig.get('reprocessFailedTxReceipts.maxReprocessCounter')
    },
    maxQueryCount: expAssetConfig.get('maxQueryCount')
};

const requiredFields = [
    'foreignTransaction.txid',
    'foreignTransaction.isPending',
    'token.name',
    'token.symbol'
];


// Definition of classes
//

// ExportedAsset class
export class ExportedAsset {
    // Class (public) properties
    //

    static exportStatus = Object.freeze({
        void: 'void',           // Initial state: migration not tried yet
        pending: 'pending',     // Waiting for foreign tx outcome
        success: 'success',     // Export has been successfully finalized
        error: 'error'          // Export has failed
    });

    static pendingExportedAssets = {
        /**
         * @type {(undefined|Map<string,ExportedAsset>)}
         */
        map: undefined,
        checking: false
    };

    static failedTxReceipts = {
        /**
         * @type {Set<{exportedAsset: ExportedAsset, ticksToReprocess: number, reprocessCounter: number}>}
         */
        set: new Set(),
        reprocessingInterval: undefined,
        reprocessing: false
    };


    /**
     * Class constructor
     * @param {Object} docExpAsset ExportedAsset database doc/rec
     * @param {Asset} [asset] Catenis asset exported to the foreign blockchain
     * @param {string} [blockchainKey] Foreign blockchain key. It should match one of the keys defined in the
     *                                  ForeignBlockchain module
     * @param {Device} [owningDevice] Catenis device that owns the exported asset
     */
    constructor(docExpAsset, asset, blockchainKey, owningDevice) {
        if (docExpAsset) {
            this.doc_id = docExpAsset._id;
            this.asset = Asset.getAssetByAssetId(docExpAsset.assetId);
            this.blockchainKey = docExpAsset.foreignBlockchain;
            this.owningDevice = Device.getDeviceByDeviceId(docExpAsset.owningDeviceId);
            /**
             * @type {{[txid]: string, [isPending]: boolean, [success]: boolean, [error]: {original: string, endUser: string}, [txReceipt]: Object, [previousTxids]: [string]}}
             */
            this.foreignTransaction = docExpAsset.foreignTransaction;
            /**
             * @type {{[name]: string, [symbol]: string, [id]: string}}
             */
            this.token = docExpAsset.token;
            this._prevStatus = this.status = docExpAsset.status;
            this.date = docExpAsset.lastStatusChangedDate ? docExpAsset.lastStatusChangedDate : docExpAsset.createdDate;
        }
        else {
            this.asset = asset;
            this.blockchainKey = blockchainKey;
            this.owningDevice = owningDevice;
            this.foreignTransaction = {};
            this.token = {};
            this._prevStatus = this.status = ExportedAsset.exportStatus.void;
            this.date = new Date();
        }

        this.ctnErc20Token = new CatenisErc20Token(
            this.blockchainKey,
            this.owningDevice.client.assetExportAdminForeignBcAccount(this.blockchainKey),
            {
                contractAddress: this.token.id,
                consumptionProfile: this.owningDevice.client.foreignBcConsumptionProfile.get(this.blockchainKey)
            }
        );
    }


    // Public object properties (getters/setters)
    //

    /**
     * Indicates whether asset export has not yet been attempted
     * @return {boolean}
     */
    get notExported() {
        return this.status === ExportedAsset.exportStatus.void;
    }

    /**
     * Indicates whether asset is currently being exported
     * @return {boolean}
     */
    get exporting() {
        return this.status === ExportedAsset.exportStatus.pending;
    }

    /**
     * Indicates whether asset is already (successfully) exported
     * @return {boolean}
     */
    get exported() {
        return this.status === ExportedAsset.exportStatus.success;
    }

    /**
     * Indicates whether asset export has failed
     * @return {boolean}
     */
    get exportFailure() {
        return this.status === ExportedAsset.exportStatus.error;
    }


    // Public object methods
    //

    /**
     * Calculate estimated price to execute foreign blockchain transaction to export asset
     *  (deploy new token)
     * @param {string} name Token name
     * @param {string} symbol Token symbol
     * @param {NativeCoinConsumptionProfile} [consumptionProfile] Foreign blockchain native coin consumption profile to
     *                                          be used for calculating the estimate
     * @return {BigNumber} Amount of foreign blockchain native coin, in its smallest denomination (wei, 10 e-18)
     */
    estimateExportPrice(name, symbol, consumptionProfile) {
        if (this.exported) {
            throw new Meteor.Error('ctn_exp_asset_already_exported', 'Asset already exported');
        }

        const params = [name, symbol, this.asset.divisibility];

        if (consumptionProfile) {
            params.push(consumptionProfile);
        }

        try {
            return this.ctnErc20Token.deployEstimate(...params);
        }
        catch (err) {
            throw translateForeignTxError(err, 'deploy (estimate)')
        }
    }

    /**
     * Export asset
     * @param {string} name Token name
     * @param {NativeCoinConsumptionProfile} [consumptionProfile] Foreign blockchain native coin consumption profile to
     *                                          be used for calling the contract method
     * @param {string} symbol Token symbol
     * @return {ExportedAssetOutcome} Exported asset current outcome state
     */
    export(name, symbol, consumptionProfile) {
        if (this.exported) {
            throw new Meteor.Error('ctn_exp_asset_already_exported', 'Asset already exported');
        }

        if (!this.exporting) {
            if (this.exportFailure) {
                this._resetToRetryExport();
            }

            const params = [name, symbol, this.asset.divisibility];

            if (consumptionProfile) {
                params.push(consumptionProfile);
            }

            let result;

            try {
                result = this.ctnErc20Token.deploy(...params);
            }
            catch (err) {
                throw translateForeignTxError(err, 'deploy');
            }

            // Save processing result
            this.foreignTransaction.txid = result.txHash;
            this.foreignTransaction.isPending = true;
            this.token.name = name;
            this.token.symbol = symbol;
            this.status = ExportedAsset.exportStatus.pending;

            this._saveToDb();

            // Prepare to track transaction execution
            result.txOutcome
            .once('receipt', Meteor.bindEnvironment(receipt => {
                try {
                    this._processForeignTxOutcome(null, receipt);
                }
                catch (err) {
                    Catenis.logger.ERROR(`Error processing successful foreign tx (txid: ${this.foreignTransaction.txid}) outcome while exporting asset.`, err);
                }
            }))
            .once('error', Meteor.bindEnvironment((error, receipt) => {
                try {
                    if ((error instanceof Error) && error.message.startsWith('Failed to check for transaction receipt:')) {
                        // Failure retrieving receipt of foreign transaction.
                        //  Set it up for its reprocessing
                        Catenis.logger.WARN('Failure retrieving exported asset foreign transaction receipt. Retrying...', {
                            exportedAsset: this,
                            error
                        });
                        this._setFailedTxReceipt();
                    }
                    else if ((error instanceof Error) && error.message.search(/^Transaction was not mined within \d+ (?:seconds|blocks), please make sure your transaction was properly sent\./) === 0) {
                        // Timeout waiting for transaction to be confirmed. Make sure that tx is still valid
                        //  (has not been inadvertently replaced by another tx with the same nonce)
                        let tx;

                        try {
                            tx = this.ctnErc20Token.getTransaction(result.txHash);
                        }
                        catch (err) {
                            // Failure retrieving transaction. Just continue processing (tx === undefined),
                            //  assuming that it is still valid
                            Catenis.logger.WARN('Unable to retrieve exported asset foreign transaction; assuming that it is still valid', {
                                txHash: result.txHash
                            });
                        }

                        if (tx !== null) {
                            // Transaction still valid, so monitor its outcome
                            this._monitorTxOutcome();
                        }
                        else {
                            // Transaction not valid any more. Report error
                            this._processForeignTxOutcome(new Error('No transaction found with the given transaction hash'));
                        }
                    }
                    else {
                        this._processForeignTxOutcome(error, receipt);
                    }
                }
                catch (err) {
                    Catenis.logger.ERROR(`Error processing failing foreign tx (txid: ${this.foreignTransaction.txid}) outcome while exporting asset.`, err);
                }
            }));
        }

        return this.getOutcome();
    }

    /**
     * @typedef {Object} ExportedAssetOutcome
     * @property {string} [assetId]
     * @property {string} [foreignBlockchain]
     * @property {Object} foreignTransaction
     * @property {string} [foreignTransaction.txid]
     * @property {boolean} [foreignTransaction.isPending]
     * @property {boolean} [foreignTransaction.success]
     * @property {string} [foreignTransaction.error]
     * @property {Object} token
     * @property {string} token.name
     * @property {string} token.symbol
     * @property {string} [token.id]
     * @property {string} status
     * @property {Date} date
     */

    /**
     * Retrieve current state of asset export outcome
     * @param {boolean} [includeAssetInfo] Indicates whether asset info should also be returned
     * @return {ExportedAssetOutcome}
     */
    getOutcome(includeAssetInfo = false) {
        const outcome = {
            foreignTransaction: _und.chain(this.foreignTransaction)
                .omit('txReceipt', 'previousTxids')
                .mapObject((val, key) => key === 'error' ? val.endUser : val)
                .value(),
            token: this.token,
            status: this.status,
            date: this.date
        };

        return includeAssetInfo
            ? {
                assetId: this.asset.assetId,
                foreignBlockchain: this.blockchainKey,
                ...outcome
            } : outcome;
    }


    // Private object methods
    //

    /**
     * Check if required database fields are present
     * @private
     */
    _checkRequiredFields() {
        const missingFields = [];

        for (const fieldPath of requiredFields) {
            let field = this;

            for (const fieldPart of fieldPath.split('.')) {
                field = field[fieldPart];
            }

            if (field === undefined) {
                missingFields.push(fieldPath);
            }
        }

        if (missingFields.length > 0) {
            throw new Error(`Missing required database field(s): ${missingFields.join(', ')}`);
        }
    }

    /**
     * Save exported asset to local database
     * @private
     */
    _saveToDb() {
        if (!this.doc_id) {
            // Database doc/rec does not exist yet. Prepare to create new

            // Make sure that all required fields are present
            this._checkRequiredFields();

            const doc = {
                assetId: this.asset.assetId,
                foreignBlockchain: this.blockchainKey,
                owningDeviceId: this.owningDevice.deviceId,
                foreignTransaction: this.foreignTransaction,
                token: this.token,
                status: this.status,
                createdDate: this.date = new Date()
            };

            try {
                this.doc_id = Catenis.db.collection.ExportedAsset.insert(doc);
            }
            catch (err) {
                Catenis.logger.ERROR(`Error trying to insert ExportedAsset database doc/rec (assetId: ${this.asset.assetId}, foreignBlockchain: ${this.blockchainKey}).`, err);
                throw new Meteor.Error('ctn_exp_asset_db_insert_err', `Error trying to insert ExportedAsset database doc/rec (assetId: ${this.asset.assetId}, foreignBlockchain: ${this.blockchainKey}).`, err.stack)
            }
        }
        else {
            // Database doc/rec already exists. Prepare to update it
            try {
                const fieldsToUpdate = {
                    foreignTransaction: this.foreignTransaction,
                    token: this.token
                };

                if (this.status !== this._prevStatus) {
                    fieldsToUpdate.status = this.status;
                    fieldsToUpdate.lastStatusChangedDate = this.date = new Date();
                }

                Catenis.db.collection.ExportedAsset.update({
                    _id: this.doc_id
                }, {
                    $set: fieldsToUpdate
                });
            }
            catch (err) {
                Catenis.logger.ERROR(`Error trying to update ExportedAsset database doc/rec (doc_id: ${this.doc_id}).`, err);
                throw new Meteor.Error('ctn_exp_asset_db_update_err', `Error trying to update ExportedAsset database doc/rec (doc_id: ${this.doc_id}).`, err.stack)
            }

            this._prevStatus = this.status;
        }
    }

    /**
     * Reset object to retry asset export
     * @private
     */
    _resetToRetryExport() {
        if (!this.exportFailure) {
            throw new Error('Trying to reset exported asset that has not failed.');
        }

        const previousTxids = this.foreignTransaction.previousTxids || [];
        previousTxids.push(this.foreignTransaction.txid);

        this.foreignTransaction = {
            previousTxids
        };
        this.token = {};
        this.status = ExportedAsset.exportStatus.void;
    }

    /**
     * Process the outcome of the foreign blockchain transaction
     * @param {*} error Indicates an error during the processing of the foreign blockchain transaction
     * @param {Object} [receipt] The transaction receipt
     * @private
     */
    _processForeignTxOutcome(error, receipt) {
        if (!this.exporting) {
            Catenis.logger.ERROR('Unexpected exported asset state for processing foreign transaction outcome', {
                status: this.status
            });
            throw new Error('Unexpected exported asset state for processing foreign transaction outcome');
        }

        if (error) {
            // Error
            this.foreignTransaction.success = false;
            this.foreignTransaction.error = {
                original: `${error}`,
                endUser: translateForeignTxError(error, 'deploy').reason
            };

            if (receipt) {
                this.foreignTransaction.txReceipt = receipt;
            }

            this.status = ExportedAsset.exportStatus.error;
        }
        else {
            // Success
            this.foreignTransaction.success = true;

            // Get token Id
            this.ctnErc20Token.setContractAddressFromTxReceipt(receipt);
            this.token.id = this.ctnErc20Token.address;

            this.status = ExportedAsset.exportStatus.success;
        }

        this.foreignTransaction.isPending = false;

        this._saveToDb();

        // Send notification advising that asset export has been finalized
        this.owningDevice.notifyAssetExportOutcome(this.getOutcome(true));
    }

    /**
     * Start monitoring outcome of pending exported asset foreign transaction
     * @private
     */
    _monitorTxOutcome() {
        ExportedAsset.pendingExportedAssets.map.set(this.foreignTransaction.txid, this);

        if (!ExportedAsset.pendingExportedAssets.checking) {
            ExportedAsset._checkPendingExportedAssets();
        }
    }

    /**
     * Set up for the reprocessing of retrieval of exported asset foreign transaction receipt
     * @private
     */
    _setFailedTxReceipt() {
        ExportedAsset.failedTxReceipts.set.add({
            exportedAsset: this,
            ticksToReprocess: 0,
            reprocessCounter: 0
        });

        ExportedAsset._startReprocessingFailedTxReceipts();
    }


    // Class (public) methods
    //

    static initialize() {
        Catenis.logger.TRACE('ExportedAsset initialization');
        this._checkPendingExportedAssets();
    }

    /**
     * Check if a value is a valid asset export status
     * @param {*} value
     * @return {boolean}
     */
    static isValidStatus(value) {
        return value !== 'void' && Object.values(ExportedAsset.exportStatus).some(status => value === status);
    }

    /**
     * Get exported asset instance
     * @param {Asset} asset Catenis asset to export
     * @param {string} blockchainKey Foreign blockchain key
     * @param {Device} [owningDevice] Device that owns exported asset. It should only be provided if the intention is
     *                                 to create a new exported instance if one does not exist yet
     * @return {ExportedAsset}
     */
    static getExportedAsset(asset, blockchainKey, owningDevice) {
        // Try to find ExportedAsset database rec/doc
        const docExpAsset = Catenis.db.collection.ExportedAsset.findOne({
            assetId: asset.assetId,
            foreignBlockchain: blockchainKey
        });

        if (docExpAsset) {
            return new ExportedAsset(docExpAsset);
        }
        else {
            // Database rec/doc not found
            if (!owningDevice) {
                // Throw error
                throw new Meteor.Error('ctn_exp_asset_not_found', `No record found for exported asset (asset ID: ${asset.assetId}, blockchain: ${blockchainKey})`);
            }

            // Return a blank exported asset object
            return new ExportedAsset(null, asset, blockchainKey, owningDevice);
        }
    }

    /**
     * Query for assets exported by a given device, and adhering to the specified filtering criteria
     * @param {string} owningDeviceId ID of device that exported the asset
     * @param {Object} [filter]
     * @param {string} [filter.assetId] Asset ID
     * @param {string} [filter.foreignBlockchain] Name of foreign blockchain
     * @param {(string|string[])} [filter.status] A single status or a list of statuses to include
     * @param {boolean} [filter.negateStatus=false] Indicates whether the specified statuses should be excluded instead
     * @param {Date} [filter.startDate] Date and time specifying the lower bound of the time frame within which the
     *                                   asset has been exported
     * @param {Date} [filter.endDate] Date and time specifying the upper bound of the time frame within which the asset
     *                                 has been exported
     * @param {number} [limit=500] Maximum number of exported assets that should be returned. Note: the default value
     *                              is actually defined via the config setting 'maxQueryCount'
     * @param {number} [skip=0] Number of exported assets that should be skipped (from beginning of list of matching
     *                           exported assets) and not returned
     * @return {{exportedAssets: ExportedAssetOutcome[], hasMore: boolean}}
     */
    static query(owningDeviceId, filter, limit, skip) {
        const selector = {
            owningDeviceId
        };

        if (filter) {
            if (filter.assetId) {
                selector.assetId = filter.assetId;
            }

            if (filter.foreignBlockchain) {
                selector.foreignBlockchain = filter.foreignBlockchain;
            }

            if (filter.status) {
                const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];

                selector.status = filter.negateStatus
                    ? {$nin: statuses}
                    : {$in: statuses};
            }

            // Date filter
            const createdDateSelector = {};
            const lastStatusChangedDateSelector = {};

            if (filter.startDate instanceof Date) {
                createdDateSelector.createdDate = {$gte: filter.startDate};
                lastStatusChangedDateSelector.lastStatusChangedDate = {$gte: filter.startDate};
            }

            if (filter.endDate instanceof Date) {
                if (createdDateSelector.createdDate !== undefined) {
                    createdDateSelector.$and = [
                        {createdDate: createdDateSelector.createdDate},
                        {createdDate: {$lte: filter.endDate}}
                    ];

                    delete createdDateSelector.createdDate;
                }
                else {
                    createdDateSelector.createdDate = {$lte: filter.endDate};
                }

                if (lastStatusChangedDateSelector.lastStatusChangedDate !== undefined) {
                    lastStatusChangedDateSelector.$and = [
                        {lastStatusChangedDate: lastStatusChangedDateSelector.lastStatusChangedDate},
                        {lastStatusChangedDate: {$lte: filter.endDate}}
                    ];

                    delete lastStatusChangedDateSelector.lastStatusChangedDate;
                }
                else {
                    lastStatusChangedDateSelector.lastStatusChangedDate = {$lte: filter.endDate};
                }
            }

            if (Object.keys(createdDateSelector).length > 0) {
                // Update selector to add date filtering
                selector.$or = [{
                    $and: [{
                        lastStatusChangedDate: {
                            $exists: false
                        }
                    }, createdDateSelector]
                }, {
                    $and: [{
                        lastStatusChangedDate: {
                            $exists: true
                        }
                    }, lastStatusChangedDateSelector]
                }];
            }
        }

        if (!Number.isInteger(limit) || limit <= 0 || limit > cfgSettings.maxQueryCount) {
            limit = cfgSettings.maxQueryCount;
        }

        if (!Number.isInteger(skip) || skip < 0) {
            skip = 0;
        }

        let hasMore = false;

        const exportedAssets = Catenis.db.collection.ExportedAsset.find(
            selector, {
            sort: {createdDate: 1},
            skip: skip,
            limit: limit + 1
        })
        .fetch().filter((doc, idx) => {
            if (idx >= limit) {
                hasMore = true;
                return false;
            }

            return true;
        })
        .map((doc) => {
            return new ExportedAsset(doc).getOutcome(true);
        });

        // Sort list of exported assets by date (ascending)
        exportedAssets.sort((expAsset1, expAsset2) => expAsset1.date > expAsset2.date ? -1 : 0);

        return {
            exportedAssets,
            hasMore
        };
    }

    /**
     * Check pending exported assets and process their transaction outcome
     * @private
     */
    static _checkPendingExportedAssets() {
        this.pendingExportedAssets.checking = true;
        Catenis.logger.TRACE('Checking for pending exported assets');

        try {
            if (!this.pendingExportedAssets.map) {
                // Retrieve pending exported assets
                this.pendingExportedAssets.map = new Map();

                Catenis.db.collection.ExportedAsset.find({
                    'foreignTransaction.isPending': true
                })
                .forEach(doc => this.pendingExportedAssets.map.set(
                    doc.foreignTransaction.txid,
                    new ExportedAsset(doc)
                ));
            }

            if (this.pendingExportedAssets.map.size > 0) {
                let txHashes = Array.from(this.pendingExportedAssets.map.keys());
                const ctnErc20Token = this.pendingExportedAssets.map.get(txHashes[0]).ctnErc20Token;

                // Make sure that transactions are still valid (has not been inadvertently
                //  replaced by another tx with the same nonce)
                let txs;
                let errIndices;

                try {
                    txs = ctnErc20Token.getTransactions(txHashes);
                }
                catch (err) {
                    // Failure retrieving transactions. Get the returned transactions
                    //  and the indication of the ones that are actually an error
                    txs = err.txs;
                    errIndices = new Set(err.errIndices);
                }

                // Filter out invalid transactions
                txHashes = txHashes.filter((txHash, idx) => {
                    if (errIndices && errIndices.has(idx)) {
                        // Failure retrieving this transaction. Just continue processing (return true),
                        //  assuming that it is still valid
                        Catenis.logger.WARN('Unable to retrieve exported asset foreign transaction; assuming that it is still valid', {
                            txHash
                        });
                    }
                    else if (!txs[idx]) {
                        // Transaction not valid any more.
                        //  Exclude exported asset from pending list, and report error
                        const exportedAsset = this.pendingExportedAssets.map.get(txHash);
                        this.pendingExportedAssets.map.delete(txHash);

                        exportedAsset._processForeignTxOutcome(new Error('No transaction found with the given transaction hash'));
                        return false;
                    }

                    return true;
                });

                if (txHashes.length > 0) {
                    let txReceipts;
                    errIndices = undefined;

                    try {
                        txReceipts = ctnErc20Token.getTransactionReceipts(txHashes);
                    }
                    catch (err) {
                        // Failure retrieving transaction receipts. Get the returned receipts
                        //  and the indication of the ones that are actually an error
                        txReceipts = err.receipts;
                        errIndices = new Set(err.errIndices);
                    }

                    txHashes.forEach((txHash, idx) => {
                        const txReceipt = txReceipts[idx];

                        if (errIndices && errIndices.has(idx)) {
                            // Error retrieving receipt for this transaction
                            const error = txReceipt;

                            // Exclude exported asset from pending list, and set it up for its reprocessing
                            const exportedAsset = this.pendingExportedAssets.map.get(txHash);
                            this.pendingExportedAssets.map.delete(txHash);

                            Catenis.logger.WARN('Failure retrieving exported asset foreign transaction receipt. Retrying...', {
                                exportedAsset,
                                error
                            });
                            exportedAsset._setFailedTxReceipt();
                        }
                        else {
                            // Transaction receipt successfully retrieved (or not yet available)
                            if (txReceipt) {
                                // Transaction receipt available. Check if it had failed
                                let error;

                                if (!txReceipt.status) {
                                    error = new Error('Unknown error while processing foreign blockchain transaction');
                                }

                                // Exclude exported asset from pending list, and process transaction outcome
                                const exportedAsset = this.pendingExportedAssets.map.get(txHash);
                                this.pendingExportedAssets.map.delete(txHash);

                                exportedAsset._processForeignTxOutcome(error, txReceipt);
                            }
                        }
                    });

                    if (this.pendingExportedAssets.map.size > 0) {
                        // Not all pending exported assets have been process.
                        //  Try again later
                        Meteor.setTimeout(ExportedAsset._checkPendingExportedAssets, cfgSettings.checkPendingExportRetryInterval);
                    }
                    else {
                        // Stop checking
                        this.pendingExportedAssets.checking = false;
                    }
                }
                else {
                    // Stop checking
                    this.pendingExportedAssets.checking = false;
                }
            }
            else {
                // Stop checking
                this.pendingExportedAssets.checking = false;
            }
        }
        catch (err) {
            Catenis.logger.ERROR('Error while checking pending exported assets.', err);
            // Stop checking
            this.pendingExportedAssets.checking = false;
        }
    }

    /**
     * Start process to reprocess retrieval of exported asset foreign transaction receipts
     * @private
     */
    static _startReprocessingFailedTxReceipts() {
        if (!this.failedTxReceipts.reprocessingInterval) {
            // Set it up for the reprocessing function to be called at the specified interval...
            this.failedTxReceipts.reprocessingInterval = Meteor.setInterval(this._reprocessFailedTxReceipts, cfgSettings.reprocessFailedTxReceipts.tickInterval);
            //  but just make the first
            Meteor.defer(this._reprocessFailedTxReceipts);
        }
    }

    /**
     * Stop process to reprocess retrieval of exported asset foreign transaction receipts
     * @private
     */
    static _stopReprocessingFailedTxReceipts() {
        if (this.failedTxReceipts.reprocessingInterval) {
            Meteor.clearInterval(this.failedTxReceipts.reprocessingInterval);
            this.failedTxReceipts.reprocessingInterval = undefined;
        }
    }

    /**
     * Reprocess retrieval of exported asset foreign transaction receipts
     * @private
     */
    static _reprocessFailedTxReceipts() {
        if (!this.failedTxReceipts.reprocessing) {
            this.failedTxReceipts.reprocessing = true;
            Catenis.logger.TRACE('Reprocessing retrieval of exported asset foreign tx receipt');

            try {
                // Identify entries that need to be reprocessed now
                const entriesToReprocess = new Map();

                for (const entry of this.failedTxReceipts.set) {
                    if (entry.ticksToReprocess === 0) {
                        entriesToReprocess.set(entry.exportedAsset.foreignTransaction.txid, entry);
                    }
                    else {
                        entry.ticksToReprocess--;
                    }
                }

                if (entriesToReprocess.size > 0) {
                    let txHashes = Array.from(entriesToReprocess.keys());
                    const ctnErc20Token = entriesToReprocess.get(txHashes[0]).exportedAsset.ctnErc20Token;

                    // Make sure that transactions are still valid (has not been inadvertently
                    //  replaced by another tx with the same nonce)
                    let txs;
                    let errIndices;

                    try {
                        txs = ctnErc20Token.getTransactions(txHashes);
                    }
                    catch (err) {
                        // Failure retrieving transactions. Get the returned transactions
                        //  and the indication of the ones that are actually an error
                        txs = err.txs;
                        errIndices = new Set(err.errIndices);
                    }

                    // Filter out invalid transactions
                    txHashes = txHashes.filter((txHash, idx) => {
                        if (errIndices && errIndices.has(idx)) {
                            // Failure retrieving this transaction. Just continue processing (return true),
                            //  assuming that it is still valid
                            Catenis.logger.WARN('Unable to retrieve exported asset foreign transaction; assuming that it is still valid', {
                                txHash
                            });
                        }
                        else if (!txs[idx]) {
                            // Transaction not valid any more.
                            //  Abort reprocessing and report error
                            const entry = entriesToReprocess.get(txHash);
                            this.failedTxReceipts.set.delete(entry);

                            entry.exportedAsset._processForeignTxOutcome(new Error('No transaction found with the given transaction hash'));
                            return false;
                        }

                        return true;
                    });

                    if (txHashes.length > 0) {
                        let txReceipts;
                        errIndices = undefined;

                        try {
                            txReceipts = ctnErc20Token.getTransactionReceipts(txHashes);
                        }
                        catch (err) {
                            // Failure retrieving transaction receipts. Get the returned receipts
                            //  and the indication of the ones that are actually an error
                            txReceipts = err.receipts;
                            errIndices = new Set(err.errIndices);
                        }

                        txHashes.forEach((txHash, idx) => {
                            const txReceipt = txReceipts[idx];

                            if (errIndices && errIndices.has(idx)) {
                                // Error retrieving exported asset foreign transaction receipt
                                const error = txReceipt;
                                const entry = entriesToReprocess.get(txHash);

                                entry.reprocessCounter++;

                                if (entry.reprocessCounter < cfgSettings.reprocessFailedTxReceipts.maxReprocessCounter) {
                                    // Prepare to reprocess retrieval of tx receipt
                                    entry.ticksToReprocess = Math.pow(cfgSettings.reprocessFailedTxReceipts.ticksToReprocessFactor, entry.reprocessCounter - 1);
                                    Catenis.logger.WARN(`Failure retrieving exported asset foreign transaction receipt. Retrying in ${entry.ticksToReprocess} ticks.`, {
                                        exportedAsset: entry.exportedAsset,
                                        error
                                    });
                                }
                                else {
                                    // Maximum reprocessing tries reached. Abort reprocessing and report error
                                    Catenis.logger.ERROR(`Error retrieving exported asset foreign transaction receipt. ABORTING reprocessing after ${entry.reprocessCounter} retries.`, {
                                        exportedAsset: entry.exportedAsset,
                                        error
                                    });
                                    this.failedTxReceipts.set.delete(entry);
                                    entry.exportedAsset._processForeignTxOutcome(new Error(`Failure retrieving exported asset foreign transaction receipt: ${error}`));
                                }
                            }
                            else {
                                // Transaction receipt successfully retrieved (or not yet available)
                                if (txReceipt) {
                                    // Transaction receipt available. Check if it had failed
                                    let error;

                                    if (!txReceipt.status) {
                                        error = new Error('Unknown error while processing foreign blockchain transaction');
                                    }

                                    // Exclude entry from reprocessing set, and process transaction outcome
                                    const entry = entriesToReprocess.get(txHash);
                                    this.failedTxReceipts.set.delete(entry);

                                    entry.exportedAsset._processForeignTxOutcome(error, txReceipt);
                                }
                            }
                        });
                    }
                }

                if (this.failedTxReceipts.set.size === 0) {
                    // Stop reprocessing
                    this._stopReprocessingFailedTxReceipts();
                }
            }
            catch (err) {
                Catenis.logger.ERROR('Error while reprocessing retrieval of exported asset foreign tx receipt.', err);
                // Stop reprocessing
                this._stopReprocessingFailedTxReceipts();
            }
            finally {
                this.failedTxReceipts.reprocessing = false;
            }
        }
    }
}


// Definition of module (private) functions
//

/**
 * Translate error received while executing foreign transaction to call a smart contract method
 *  into an error that can be presented to the end user
 * @param {*} error Error received while executing foreign transaction to call smart contract method
 * @param {string} method Name of smart contract method
 * @return {Meteor.Error} Translated error
 */
function translateForeignTxError(error, method) {
    let translatedError;

    if ((error instanceof Error) && (error.message.includes(': insufficient funds for gas * price + value')
            || error.message.startsWith('Returned error: sender doesn\'t have enough funds to send tx'))) {
        // Low native coin balance error
        translatedError = new Meteor.Error(
            'ctn_exp_asset_low_foreign_bc_funds',
            `Foreign blockchain funds not enough to cover transaction execution price (${error.txExecPrice})`
        );
    }
    else if ((error instanceof Error) && (error.message.startsWith('No transaction found with the given transaction hash')
            || error.message === 'Failed to send foreign blockchain transaction: nonce already used')) {
        // Previously sent foreign blockchain transaction is not valid anymore
        translatedError = new Meteor.Error(
            'ctn_exp_asset_discarded_token_call',
            'Discarded concurrent foreign token smart contract call'
        );
    }
    else {
        // Any other error
        Catenis.logger.ERROR(`Unexpected error calling foreign token smart contract method '${method}'.`, error);
        translatedError = new Meteor.Error(
            'ctn_exp_asset_token_call_error',
            'Unexpected error calling foreign token smart contract'
        );
    }

    return translatedError;
}


// Module code
//

// Lock class
Object.freeze(ExportedAsset);
