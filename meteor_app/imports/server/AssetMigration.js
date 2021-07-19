/**
 * Created by claudio on 2021-06-26
 */

//console.log('[AssetMigration.js]: This code just ran.');

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

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { Asset } from './Asset';
import { Device } from './Device';
import { ExportedAsset } from './ExportedAsset';
import { CCFundSource } from './CCFundSource';
import { FundSource } from './FundSource';
import { procCS as spendServCredProcCS } from './SpendServiceCredit';
import { Service } from './Service';
import { Client } from './Client';
import { OutMigrateAssetTransaction } from './OutMigrateAssetTransaction';
import { InMigrateAssetTransaction } from './InMigrateAssetTransaction';
import { Billing } from './Billing';

// Config entries
const assetMigrationConfig = config.get('assetMigration');

// Configuration settings
export const cfgSettings = {
    checkPendingMigrationRetryInterval: assetMigrationConfig.get('checkPendingMigrationRetryInterval'),
    reprocessFailedTxReceipts: {
        tickInterval: assetMigrationConfig.get('reprocessFailedTxReceipts.tickInterval'),
        ticksToReprocessFactor: assetMigrationConfig.get('reprocessFailedTxReceipts.ticksToReprocessFactor'),
        maxTicksToReprocess: assetMigrationConfig.get('reprocessFailedTxReceipts.maxTicksToReprocess'),
        maxReprocessCounter: assetMigrationConfig.get('reprocessFailedTxReceipts.maxReprocessCounter')
    },
    maxQueryCount: assetMigrationConfig.get('maxQueryCount')
};

const requiredOutMigrationFields = [
    'catenisService.status',
    'catenisService.txid'
];
const requiredInMigrationFields = [
    'foreignTransaction.txid',
    'foreignTransaction.isPending'
];


// Definition of classes
//

// AssetMigration class
export class AssetMigration {
    // Class (public) properties
    //

    static migrationDirection = Object.freeze({
        outward: 'outward',
        inward: 'inward'
    });

    static serviceStatus = Object.freeze({
        awaiting: 'awaiting',
        failure: 'failure',
        fulfilled: 'fulfilled'
    });

    static migrationStatus = Object.freeze({
        void: 'void',                   // Initial state: migration not tried yet
        pending: 'pending',             // Waiting for foreign tx outcome
        interrupted: 'interrupted',     // Migration started (first step completed successfully) but failed during second step.
                                        //  It represents an inconsistent state, and migration should be retried
        success: 'success',             // Migration has been successfully finalized
        error: 'error'                  // Migration has failed (during first step)
    });

    static pendingAssetMigrations = {
        /**
         * @type {(undefined|Map<string,AssetMigration>)}
         */
        map: undefined,
        checking: false
    };

    static failedTxReceipts = {
        /**
         * @type {Set<{assetMigration: AssetMigration, ticksToReprocess: number, reprocessCounter: number}>}
         */
        set: new Set(),
        reprocessingInterval: undefined,
        reprocessing: false
    };


    // Constructor
    //

    /**
     * Class constructor
     * @param {Object} docAssetMgr AssetMigration database doc/rec
     * @param {string} [direction] The migration direction
     * @param {ExportedAsset} [exportedAsset] Exported asset the amount of which is migrated to/from the foreign blockchain
     * @param {Device} [owningDevice] Catenis device that owns the migrating asset amount
     * @param {number} [amount] Amount of Catenis asset to migrate to/from the foreign blockchain
     * @param {string} [destAddress] Foreign blockchain address that should receive migrated asset amount (as the same
     *                                amount of the associated foreign blockchain token)
     */
    constructor(docAssetMgr, direction, exportedAsset, owningDevice, amount, destAddress) {
        if (docAssetMgr) {
            this.doc_id = docAssetMgr._id;
            this.migrationId = docAssetMgr.migrationId;
            this.direction = docAssetMgr.direction;
            this.expAsset = ExportedAsset.getExportedAsset(Asset.getAssetByAssetId(docAssetMgr.assetId), docAssetMgr.foreignBlockchain)
            this.owningDevice = Device.getDeviceByDeviceId(docAssetMgr.owningDeviceId);
            this.amount = docAssetMgr.amount;
            this.smDivAmount = this.expAsset.asset.amountToSmallestDivisionAmount(this.amount, true);
            this.destAddress = docAssetMgr.destAddress;
            /**
             * @type {{status: string, [error]: string, [txid]: string}}
             */
            this.catenisService = docAssetMgr.catenisService;
            /**
             * @type {{[txid]: string, [isPending]: boolean, [success]: boolean, [error]: {original: string, endUser: string}, [txReceipt]: Object, [previousTxids]: [string]}}
             */
            this.foreignTransaction = docAssetMgr.foreignTransaction;
            this._prevStatus = this.status = docAssetMgr.status;
            this.date = docAssetMgr.lastStatusChangedDate ? docAssetMgr.lastStatusChangedDate : docAssetMgr.createdDate;
        }
        else {
            this.migrationId = newAssetMigrationId()
            this.direction = direction;
            this.expAsset = exportedAsset;
            this.owningDevice = owningDevice;
            this.amount = amount;
            this.smDivAmount = this.expAsset.asset.amountToSmallestDivisionAmount(this.amount, true);
            this.destAddress = destAddress;
            this.catenisService = {
                status: AssetMigration.serviceStatus.awaiting
            };
            this.foreignTransaction = {};
            this._prevStatus = this.status = AssetMigration.migrationStatus.void;
            this.date = new Date();
        }

        // Validate data consistency
        if (!this.expAsset.exported) {
            // Asset is not yet exported
            throw new Meteor.Error('ctn_asset_mgr_not_exported', 'Asset is not yet exported');
        }

        if (Number.isNaN(this.smDivAmount)) {
            // Amount to be migrated is larger than maximum allowed total asset amount
            throw new Meteor.Error('ctn_asset_mgr_amount_too_large', 'Amount to be migrated is larger than maximum allowed total asset amount');
        }

        if (this.owningDevice.client.clientId !== this.expAsset.owningDevice.client.clientId) {
            Catenis.logger.ERROR(`Inconsistent asset migration: owning device (deviceId: ${this.owningDevice.deviceId}) does not belong to the same Catenis client as exported asset owning device (deviceId: ${this.expAsset.owningDevice.deviceId})`);
            throw new Error('Inconsistent asset migration: owning device does not belong to the same Catenis client as exported asset owning device');
        }
    }


    // Public object properties (getters/setters)
    //

    /**
     * Indicates whether asset migration has not yet been attempted
     * @return {boolean}
     */
    get notMigrated() {
        return this.status === AssetMigration.migrationStatus.void;
    }

    /**
     * Indicates whether asset amount is currently being migrated
     * @return {boolean}
     */
    get migrating() {
        return this.status === AssetMigration.migrationStatus.pending;
    }

    /**
     * Indicates whether asset amount is already (successfully) migrated
     * @return {boolean}
     */
    get migrated() {
        return this.status === AssetMigration.migrationStatus.success;
    }

    /**
     * Indicates whether asset migration has failed
     * @return {boolean}
     */
    get migrationFailure() {
        return this.status === AssetMigration.migrationStatus.interrupted || this.status === AssetMigration.migrationStatus.error;
    }

    /**
     * Indicates whether the execution of the Catenis service to migrate an asset amount
     *  has failed
     * @return {boolean}
     */
    get catenisServiceFailure() {
        return this.catenisService.status === AssetMigration.serviceStatus.failure;
    }

    /**
     * Indicates whether the execution of the foreign transaction to migrate an asset
     *  amount has failed
     * @return {boolean}
     */
    get foreignTransactionFailure() {
        return this.foreignTransaction.success !== undefined && !this.foreignTransaction.success;
    }


    // Public object methods
    //

    /**
     * Calculate estimated price to execute foreign blockchain transaction to migrate an asset amount
     *  (mint/burn a token amount)
     * @param {NativeCoinConsumptionProfile} [consumptionProfile] Foreign blockchain native coin consumption profile to
     *                                          be used for calculating the estimate
     * @return {BigNumber} Amount of foreign blockchain native coin, in its smallest denomination (wei, 10 e-18)
     */
    estimateMigrationPrice(consumptionProfile) {
        if (this.migrated) {
            throw new Meteor.Error('ctn_asset_mgr_already_migrated', 'Asset amount already migrated');
        }

        return this.direction === AssetMigration.migrationDirection.outward
            ? this._estimateOutMigrationPrice(consumptionProfile)
            : this._estimateInMigrationPrice(consumptionProfile);
    }

    /**
     * Migrate an asset amount
     * @param {NativeCoinConsumptionProfile} [consumptionProfile] Foreign blockchain native coin consumption profile to
     *                                          be used for calling the contract method
     * @return {AssetMigrationOutcome}
     */
    migrate(consumptionProfile) {
        if (this.migrated) {
            throw new Meteor.Error('ctn_asset_mgr_already_migrated', 'Asset amount already migrated');
        }

        if (this.direction === AssetMigration.migrationDirection.outward) {
            return this._outMigrate(consumptionProfile);
        }
        else {
            return this._inMigrate(consumptionProfile);
        }
    }

    /**
     * @typedef {Object} AssetMigrationOutcome
     * @property {string} [migrationId]
     * @property {string} [direction]
     * @property {string} [assetId]
     * @property {string} [foreignBlockchain]
     * @property {number} [amount]
     * @property {Object} catenisService
     * @property {string} catenisService.status
     * @property {string} [catenisService.error]
     * @property {string} [catenisService.txid]
     * @property {Object} foreignTransaction
     * @property {string} [foreignTransaction.txid]
     * @property {boolean} [foreignTransaction.isPending]
     * @property {boolean} [foreignTransaction.success]
     * @property {string} [foreignTransaction.error]
     * @property {string} status
     * @property {Date} date
     */

    /**
     * Retrieve current state of asset migration outcome
     * @param {boolean} [includeMigrationId] Indicates whether the migration ID should be returned
     * @param {boolean} [includeMigrationInfo] Indicates whether migration info should also be returned
     * @return {AssetMigrationOutcome}
     */
    getOutcome(includeMigrationId = false, includeMigrationInfo = true) {
        const migrationId = includeMigrationId
            ? {
                migrationId: this.migrationId
            } : undefined;
        const migrationInfo = includeMigrationInfo
            ? {
                direction: this.direction,
                assetId: this.expAsset.asset.assetId,
                foreignBlockchain: this.expAsset.blockchainKey,
                amount: this.amount
            } : undefined;

        return {
            ...migrationId,
            ...migrationInfo,
            catenisService: this.catenisService,
            foreignTransaction: _und.chain(this.foreignTransaction)
                .omit('txReceipt', 'previousTxids')
                .mapObject((val, key) => key === 'error' ? val.endUser : val)
                .value(),
            status: this.status,
            date: this.date
        };
    }

    /**
     * Query for asset amounts migrated by a given device, and adhering to the specified filtering criteria
     * @param {string} owningDeviceId ID of device that migrated the asset amount
     * @param {Object} [filter]
     * @param {string} [filter.assetId] Asset ID
     * @param {string} [filter.foreignBlockchain] Name of foreign blockchain
     * @param {string} [filter.direction] The migration direction
     * @param {(string|string[])} [filter.status] A single status or a list of statuses to include
     * @param {boolean} [filter.negateStatus=false] Indicates whether the specified statuses should be excluded instead
     * @param {Date} [filter.startDate] Date and time specifying the lower bound of the time frame within which the
     *                                   asset amount has been migrated
     * @param {Date} [filter.endDate] Date and time specifying the upper bound of the time frame within which the asset
     *                                 amount has been migrated
     * @param {number} [limit=500] Maximum number of asset migrations that should be returned. Note: the default value
     *                              is actually defined via the config setting 'maxQueryCount'
     * @param {number} [skip=0] Number of asset migrations that should be skipped (from beginning of list of matching
     *                           asset migrations) and not returned
     * @return {{assetMigrations: AssetMigrationOutcome[], hasMore: boolean}}
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

            if (filter.direction) {
                selector.direction = filter.direction;
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

        const assetMigrations = Catenis.db.collection.AssetMigration.find(
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
            return new AssetMigration(doc).getOutcome(true, true);
        });

        // Sort list of asset migrations by date (ascending)
        assetMigrations.sort((assetMgr1, assetMgr2) => assetMgr1.date > assetMgr2.date ? -1 : 0);

        return {
            assetMigrations,
            hasMore
        };
    }


    // Private object methods
    //

    /**
     * Check if required database fields are present
     * @private
     */
    _checkRequiredFields() {
        const requiredFields = this.direction === AssetMigration.migrationDirection.outward
            ? requiredOutMigrationFields : requiredInMigrationFields;
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
     * Save asset migration to local database
     * @param {Object} [inMigrationUpdate] Used to identify fields that need to be updated when doing in-migration
     * @param {boolean} [inMigrationUpdate.catenisService] Indicates that the 'catenisService' field should be updated
     * @param {boolean} [inMigrationUpdate.foreignTransaction] Indicates that the 'foreignTransaction' field should be
     *                                                        updated
     * @private
     */
    _saveToDb(inMigrationUpdate) {
        if (!this.doc_id) {
            // Database doc/rec does not exist yet. Prepare to create new

            // Make sure that all required fields are present
            this._checkRequiredFields();

            const doc = {
                migrationId: this.migrationId,
                direction: this.direction,
                assetId: this.expAsset.asset.assetId,
                foreignBlockchain: this.expAsset.blockchainKey,
                owningDeviceId: this.owningDevice.deviceId,
                amount: this.amount
            };

            if (this.direction === AssetMigration.migrationDirection.outward) {
                doc.destAddress = this.destAddress;
            }

            doc.catenisService = this.catenisService;
            doc.foreignTransaction = this.foreignTransaction;
            doc.status = this.status;
            doc.createdDate = this.date = new Date ();

            try {
                this.doc_id = Catenis.db.collection.AssetMigration.insert(doc);
            }
            catch (err) {
                Catenis.logger.ERROR(`Error trying to insert AssetMigration database doc/rec.`, doc, err);
                throw new Meteor.Error('ctn_asset_mgr_db_insert_err', 'Error trying to insert AssetMigration database doc/rec.', err.stack)
            }
        }
        else {
            // Database doc/rec already exists. Prepare to update it
            try {
                let fieldsToUpdate;

                if (this.direction === AssetMigration.migrationDirection.outward) {
                    fieldsToUpdate = {
                        foreignTransaction: this.foreignTransaction
                    };
                }
                else {
                    inMigrationUpdate = inMigrationUpdate || {};
                    fieldsToUpdate = {};

                    if (inMigrationUpdate.catenisService) {
                        fieldsToUpdate.catenisService = this.catenisService;
                    }

                    if (inMigrationUpdate.foreignTransaction) {
                        fieldsToUpdate.foreignTransaction = this.foreignTransaction;
                    }
                }

                if (this.status !== this._prevStatus) {
                    fieldsToUpdate.status = this.status;
                    fieldsToUpdate.lastStatusChangedDate = this.date = new Date();
                }

                Catenis.db.collection.AssetMigration.update({
                    _id: this.doc_id
                }, {
                    $set: fieldsToUpdate
                });
            }
            catch (err) {
                Catenis.logger.ERROR(`Error trying to update AssetMigration database doc/rec (doc_id: ${this.doc_id}).`, err);
                throw new Meteor.Error('ctn_asset_mgr_db_update_err', `Error trying to update AssetMigration database doc/rec (doc_id: ${this.doc_id}).`, err.stack)
            }

            this._prevStatus = this.status;
        }
    }

    /**
     * Calculate estimated price to execute foreign blockchain transaction to out-migrate an asset amount
     *  (mint a token amount)
     * @param {NativeCoinConsumptionProfile} [consumptionProfile] Foreign blockchain native coin consumption profile to
     *                                          be used for calculating the estimate
     * @return {BigNumber} Amount of foreign blockchain native coin, in its smallest denomination (wei, 10 e-18)
     */
    _estimateOutMigrationPrice(consumptionProfile) {
        try {
            return this.expAsset.ctnErc20Token.mintEstimate(this.destAddress, this.smDivAmount, consumptionProfile);
        }
        catch (err) {
            throw translateForeignTxError(err, 'mint (estimate)');
        }
    }

    /**
     * Calculate estimated price to execute foreign blockchain transaction to in-migrate an asset amount
     *  (burn a token amount)
     * @param {NativeCoinConsumptionProfile} [consumptionProfile] Foreign blockchain native coin consumption profile to
     *                                          be used for calculating the estimate
     * @return {BigNumber} Amount of foreign blockchain native coin, in its smallest denomination (wei, 10 e-18)
     */
    _estimateInMigrationPrice(consumptionProfile) {
        try {
            return this.expAsset.ctnErc20Token.burnEstimate(this.smDivAmount, consumptionProfile);
        }
        catch (err) {
            throw translateForeignTxError(err, 'burn (estimate)');
        }
    }

    /**
     * Out-migrate an asset amount
     * @param {NativeCoinConsumptionProfile} [consumptionProfile] Foreign blockchain native coin consumption profile to
     *                                          be used for calling the contract method
     * @return {AssetMigrationOutcome} Asset migration current outcome state
     * @private
     */
    _outMigrate(consumptionProfile) {
        if (!this.migrating) {
            if (this.notMigrated) {
                // Make sure that foreign transaction will not fail (this will throw is so)
                this._checkForeignTransactionExecution(consumptionProfile);

                // Now, execute Catenis service
                this.catenisService.txid = this._executeOutMigrationService();
                this.catenisService.status = AssetMigration.serviceStatus.fulfilled;
            }
            else {
                // Migration was previously attempted but failed (foreign transaction failure).
                //  So reset it before retrying
                this._resetForeignTransaction();
            }

            // Initiate process to send foreign transaction (to mint foreign token)
            let result;

            try {
                result = this.expAsset.ctnErc20Token.mint(this.destAddress, this.smDivAmount, consumptionProfile);
            }
            catch (err) {
                this.foreignTransaction.error = {
                    original: `${err}`,
                    endUser: translateForeignTxError(err, 'mint').reason
                };
            }

            // Save processing outcome
            if (result) {
                this.foreignTransaction.txid = result.txHash;
                this.foreignTransaction.isPending = true;
                this.status = AssetMigration.migrationStatus.pending;
            }
            else {
                // Failure sending transaction. Note: 'error' field already filled
                this.foreignTransaction.success = false;
                this.status = AssetMigration.migrationStatus.interrupted;
            }

            this._saveToDb();

            if (result) {
                // Prepare to track transaction execution
                result.txOutcome
                .once('receipt', Meteor.bindEnvironment(receipt => {
                    try {
                        this._processOutMigrateForeignTxOutcome(null, receipt);
                    }
                    catch (err) {
                        Catenis.logger.ERROR(`Error processing successful foreign tx (txid: ${this.foreignTransaction.txid}) outcome while out-migrating asset.`, err);
                    }
                }))
                .once('error', Meteor.bindEnvironment((error, receipt) => {
                    try {
                        if ((error instanceof Error) && error.message.startsWith('Failed to check for transaction receipt:')) {
                            // Failure retrieving receipt of foreign transaction.
                            //  Set it up for its reprocessing
                            Catenis.logger.WARN(`Failure retrieving (outward) asset migration foreign transaction receipt. Retrying...`, {
                                assetMigration: this,
                                error
                            });
                            this._setFailedTxReceipt();
                        }
                        else if ((error instanceof Error) && error.message.search(/^Transaction was not mined within \d+ (?:seconds|blocks), please make sure your transaction was properly sent\./) === 0) {
                            // Timeout waiting for transaction to be confirmed. Make sure that tx is still valid
                            //  (has not been inadvertently replaced by another tx with the same nonce)
                            let tx;

                            try {
                                tx = this.expAsset.ctnErc20Token.getTransaction(result.txHash);
                            }
                            catch (err) {
                                // Failure retrieving transaction. Just continue processing (tx === undefined),
                                //  assuming that it is still valid
                                Catenis.logger.WARN('Unable to retrieve (outward) asset migration foreign transaction; assuming that it is still valid', {
                                    txHash: result.txHash
                                });
                            }

                            if (tx !== null) {
                                // Transaction still valid, so monitor its outcome
                                this._monitorTxOutcome();
                            }
                            else {
                                // Transaction not valid any more. Report error
                                this._processOutMigrateForeignTxOutcome(new Error('No transaction found with the given transaction hash'));
                            }
                        }
                        else {
                            this._processOutMigrateForeignTxOutcome(error, receipt);
                        }
                    }
                    catch (err) {
                        Catenis.logger.ERROR(`Error processing failing foreign tx (txid: ${this.foreignTransaction.txid}) outcome while out-migrating asset.`, err);
                    }
                }));
            }
        }

        return this.getOutcome(true, false);
    }

    /**
     * In-migrate an asset amount
     * @param {NativeCoinConsumptionProfile} [consumptionProfile] Foreign blockchain native coin consumption profile to
     *                                          be used for calling the contract method
     * @return {AssetMigrationOutcome} Asset migration current outcome state
     * @private
     */
    _inMigrate(consumptionProfile) {
        if (!this.migrating) {
            let inMigrationUpdate;

            if (this.notMigrated) {
                // Make sure that Catenis service will not fail (this will throw is so)
                this._checkServiceFulfillment();
            }
            else {
                // Migration was previously attempted but failed
                if (this.foreignTransactionFailure) {
                    // Foreign transaction failure. Reset it before retrying
                    this._resetForeignTransaction();
                    inMigrationUpdate = {
                        foreignTransaction: true
                    };
                }
                else if (this.catenisServiceFailure) {
                    // Catenis service failure. Reset it before retrying
                    this._resetCatenisService();
                    inMigrationUpdate = {
                        catenisService: true
                    };
                }
            }

            if (!inMigrationUpdate || inMigrationUpdate.foreignTransaction) {
                // Initiate process to send foreign transaction (to burn foreign token)
                let result;

                try {
                    result = this.expAsset.ctnErc20Token.burn(this.smDivAmount, consumptionProfile);
                }
                catch (err) {
                    throw translateForeignTxError(err, 'burn');
                }

                // Save processing result
                this.foreignTransaction.txid = result.txHash;
                this.foreignTransaction.isPending = true;
                this.status = AssetMigration.migrationStatus.pending;

                this._saveToDb(inMigrationUpdate);

                // Prepare to track transaction execution
                result.txOutcome
                .once('receipt', Meteor.bindEnvironment(receipt => {
                    try {
                        this._processInMigrateForeignTxOutcome(null, receipt);
                    }
                    catch (err) {
                        Catenis.logger.ERROR(`Error processing successful foreign tx (txid: ${this.foreignTransaction.txid}) outcome while in-migrating asset.`, err);
                    }
                }))
                .once('error', Meteor.bindEnvironment((error, receipt) => {
                    try {
                        if ((error instanceof Error) && error.message.startsWith('Failed to check for transaction receipt:')) {
                            // Failure retrieving receipt of foreign transaction.
                            //  Set it up for its reprocessing
                            Catenis.logger.WARN(`Failure retrieving (inward) asset migration foreign transaction receipt. Retrying...`, {
                                assetMigration: this,
                                error
                            });
                            this._setFailedTxReceipt();
                        }
                        else if ((error instanceof Error) && error.message.search(/^Transaction was not mined within \d+ (?:seconds|blocks), please make sure your transaction was properly sent\./) === 0) {
                            // Timeout waiting for transaction to be confirmed. Make sure that tx is still valid
                            //  (has not been inadvertently replaced by another tx with the same nonce)
                            let tx;

                            try {
                                tx = this.expAsset.ctnErc20Token.getTransaction(result.txHash);
                            }
                            catch (err) {
                                // Failure retrieving transaction. Just continue processing (tx === undefined),
                                //  assuming that it is still valid
                                Catenis.logger.WARN('Unable to retrieve (inward) asset migration foreign transaction; assuming that it is still valid', {
                                    txHash: result.txHash
                                });
                            }

                            if (tx !== null) {
                                // Transaction still valid, so monitor its outcome
                                this._monitorTxOutcome();
                            }
                            else {
                                // Transaction not valid any more. Report error
                                this._processInMigrateForeignTxOutcome(new Error('No transaction found with the given transaction hash'));
                            }
                        }
                        else {
                            this._processInMigrateForeignTxOutcome(error, receipt);
                        }
                    }
                    catch (err) {
                        Catenis.logger.ERROR(`Error processing failing foreign tx (txid: ${this.foreignTransaction.txid}) outcome while in-migrating asset.`, err);
                    }
                }));
            }
            else {
                try {
                    // Retry executing Catenis service
                    this.catenisService.txid = this._executeInMigrationService();
                    this.catenisService.status = AssetMigration.serviceStatus.fulfilled;
                    this.status = AssetMigration.migrationStatus.success;
                }
                catch (err) {
                    this.catenisService.error = decodeCatenisServiceError(err);
                    this.catenisService.status = AssetMigration.serviceStatus.failure;
                    this.status = AssetMigration.migrationStatus.interrupted;
                }

                this._saveToDb(inMigrationUpdate);
            }
        }

        return this.getOutcome(true, false);
    }

    /**
     * Reset Catenis service outcome info
     * @private
     */
    _resetCatenisService() {
        if (!this.catenisServiceFailure) {
            throw new Error('Trying to reset Catenis service that has not failed.');
        }

        this.catenisService = {
            status: AssetMigration.serviceStatus.awaiting
        };
    }

    /**
     * Reset foreign transaction outcome info
     * @private
     */
    _resetForeignTransaction() {
        if (!this.foreignTransactionFailure) {
            throw new Error('Trying to reset foreign transaction that has not failed.');
        }

        if (this.foreignTransaction.txid) {
            const previousTxids = this.foreignTransaction.previousTxids || [];
            previousTxids.push(this.foreignTransaction.txid);

            this.foreignTransaction = {
                previousTxids
            };
        }
        else {
            this.foreignTransaction = {};
        }
    }

    /**
     * Check if migrate asset service could be fulfilled
     * @private
     */
    _checkServiceFulfillment() {
        if (this.owningDevice.client.serviceAccountBalance() < Service.migrateAssetServicePrice().finalServicePrice) {
            // Service account balance too low
            throw new Meteor.Error('ctn_asset_mgr_low_service_acc_balance', 'Client does not have enough credits to pay for migrate asset service');
        }

        if (this.direction === AssetMigration.migrationDirection.outward) {
            // Out-migration
            const devAssetBalance = this.owningDevice.assetBalance(this.expAsset.asset);

            if (devAssetBalance === undefined || devAssetBalance.total < this.smDivAmount.toNumber()) {
                // Asset balance too low to out-migrate the specified amount
                throw new Meteor.Error('ctn_asset_mgr_low_asset_balance', 'Asset balance too low to out-migrate the specified amount');
            }
        }
        else {
            // In-migration
            const devMigratedAssetBalance = this.owningDevice.migratedAssetBalance(this.expAsset.asset);

            if (devMigratedAssetBalance === undefined || devMigratedAssetBalance.total < this.smDivAmount.toNumber()) {
                // Migrated asset balance too low to in-migrate the specified amount
                throw new Meteor.Error('ctn_asset_mgr_low_mgr_asset_balance', 'Migrated asset balance too low to in-migrate the specified amount');
            }
        }
    }

    /**
     * Check if foreign transaction to migrate an asset amount could be executed
     * @param {NativeCoinConsumptionProfile} [consumptionProfile] Foreign blockchain native coin consumption profile to
     *                                          be used for calculating the estimate
     * @private
     */
    _checkForeignTransactionExecution(consumptionProfile) {
        let txExecPrice;

        if (this.expAsset.ctnErc20Token.ownerNativeCoinBalance.lt(txExecPrice = this.estimateMigrationPrice(consumptionProfile))) {
            // Foreign blockchain account balance too low
            throw new Meteor.Error(
                'ctn_asset_mgr_low_foreign_bc_funds',
                `Foreign blockchain funds not enough to cover transaction execution price (${txExecPrice})`
            );
        }

        if (this.direction === AssetMigration.migrationDirection.inward) {
            // In-migration

            if (this.expAsset.ctnErc20Token.ownerBalance.lt(this.smDivAmount)) {
                // Foreign token balance too low to in-migrate the specified amount
                throw new Meteor.Error('ctn_asset_mgr_low_token_balance', 'Foreign token balance too low to in-migrate the specified amount');
            }
        }
    }

    /**
     * Execute Catenis service to out-migrate an asset amount
     * @return {string} ID of sent out-migrate transaction
     * @private
     */
    _executeOutMigrationService() {
        let outMigrateAssetTransact;

        // Execute code in critical section to avoid Colored Coins UTXOs concurrency
        CCFundSource.utxoCS.execute(() => {
            // Execute code in critical section to avoid UTXOs concurrency
            FundSource.utxoCS.execute(() => {
                // Execute code in critical section to avoid concurrent spend service credit tasks
                spendServCredProcCS.execute(() => {
                    const servicePriceInfo = Service.migrateAssetServicePrice();
                    let paymentProvisionInfo;

                    if (this.owningDevice.client.billingMode === Client.billingMode.prePaid) {
                        try {
                            paymentProvisionInfo = Catenis.spendServCredit.provisionPaymentForService(this.owningDevice.client, servicePriceInfo.finalServicePrice);
                        }
                        catch (err) {
                            if ((err instanceof Meteor.Error) && err.error === 'ctn_spend_serv_cred_utxo_alloc_error') {
                                // Unable to allocate service credits from client service account to pay for service.
                                //  Log error and throw exception
                                Catenis.logger.ERROR('Client does not have enough credits to pay for migrate asset service', {
                                    serviceAccountBalance: this.owningDevice.client.serviceAccountBalance(),
                                    servicePrice: servicePriceInfo.finalServicePrice
                                });
                                throw new Meteor.Error('ctn_asset_mgr_low_service_acc_balance', 'Client does not have enough credits to pay for migrate asset service');
                            }
                            else {
                                // Error provisioning spend service credit transaction to pay for service.
                                //  Log error and throw exception
                                Catenis.logger.ERROR('Error provisioning spend service credit transaction to pay for migrate asset service.', err);
                                throw new Error('Error provisioning spend service credit transaction to pay for migrate asset service');
                            }
                        }
                    }
                    else if (this.owningDevice.client.billingMode === Client.billingMode.postPaid) {
                        // Not yet implemented
                        Catenis.logger.ERROR('Processing for postpaid billing mode not yet implemented');
                        throw new Error('Processing for postpaid billing mode not yet implemented');
                    }

                    try {
                        // Prepare transaction to out-migrate asset
                        outMigrateAssetTransact = new OutMigrateAssetTransaction(this.owningDevice, this.expAsset.asset, this.smDivAmount.toNumber());

                        // Build and send transaction
                        outMigrateAssetTransact.buildTransaction();

                        outMigrateAssetTransact.sendTransaction();

                        // Force polling of blockchain so newly sent transaction is received and processed right away
                        Catenis.txMonitor.pollNow();
                    }
                    catch (err) {
                        // Error out-migrating asset. Log error condition
                        Catenis.logger.ERROR('Error out-migrating asset.', err);

                        if (outMigrateAssetTransact && !outMigrateAssetTransact.txid) {
                            // Revert output addresses added to transaction
                            outMigrateAssetTransact.revertOutputAddresses();
                        }

                        // Rethrows exception
                        throw err;
                    }

                    try {
                        // Record billing info for service
                        const billing = Billing.createNew(this.owningDevice, outMigrateAssetTransact, servicePriceInfo);

                        let servicePayTransact;

                        if (this.owningDevice.client.billingMode === Client.billingMode.prePaid) {
                            servicePayTransact = Catenis.spendServCredit.confirmPaymentForService(paymentProvisionInfo, outMigrateAssetTransact.txid);
                        }
                        else if (this.owningDevice.client.billingMode === Client.billingMode.postPaid) {
                            // Not yet implemented
                            Catenis.logger.ERROR('Processing for postpaid billing mode not yet implemented');
                            // noinspection ExceptionCaughtLocallyJS
                            throw new Error('Processing for postpaid billing mode not yet implemented');
                        }

                        billing.setServicePaymentTransaction(servicePayTransact);
                    }
                    catch (err) {
                        if ((err instanceof Meteor.Error) && err.error === 'ctn_spend_serv_cred_tx_rejected') {
                            // Spend service credit transaction has been rejected.
                            //  Log warning condition
                            Catenis.logger.WARN('Billing for migrate asset service (serviceTxid: %s) recorded with no service payment transaction', outMigrateAssetTransact.txid);
                        }
                        else {
                            // Error recording billing info for migrate asset service.
                            //  Just log error condition
                            Catenis.logger.ERROR('Error recording billing info for migrate asset service (serviceTxid: %s),', outMigrateAssetTransact.txid, err);
                        }
                    }
                });
            });
        });

        return outMigrateAssetTransact.txid;
    }

    /**
     * Execute Catenis service to in-migrate an asset amount
     * @return {string} ID of sent in-migrate transaction
     * @private
     */
    _executeInMigrationService() {
        let inMigrateAssetTransact;

        // Execute code in critical section to avoid Colored Coins UTXOs concurrency
        CCFundSource.utxoCS.execute(() => {
            // Execute code in critical section to avoid UTXOs concurrency
            FundSource.utxoCS.execute(() => {
                // Execute code in critical section to avoid concurrent spend service credit tasks
                spendServCredProcCS.execute(() => {
                    const servicePriceInfo = Service.migrateAssetServicePrice();
                    let paymentProvisionInfo;

                    if (this.owningDevice.client.billingMode === Client.billingMode.prePaid) {
                        try {
                            paymentProvisionInfo = Catenis.spendServCredit.provisionPaymentForService(this.owningDevice.client, servicePriceInfo.finalServicePrice);
                        }
                        catch (err) {
                            if ((err instanceof Meteor.Error) && err.error === 'ctn_spend_serv_cred_utxo_alloc_error') {
                                // Unable to allocate service credits from client service account to pay for service.
                                //  Log error and throw exception
                                Catenis.logger.ERROR('Client does not have enough credits to pay for migrate asset service', {
                                    serviceAccountBalance: this.owningDevice.client.serviceAccountBalance(),
                                    servicePrice: servicePriceInfo.finalServicePrice
                                });
                                throw new Meteor.Error('ctn_asset_mgr_low_service_acc_balance', 'Client does not have enough credits to pay for migrate asset service');
                            }
                            else {
                                // Error provisioning spend service credit transaction to pay for service.
                                //  Log error and throw exception
                                Catenis.logger.ERROR('Error provisioning spend service credit transaction to pay for migrate asset service.', err);
                                throw new Error('Error provisioning spend service credit transaction to pay for migrate asset service');
                            }
                        }
                    }
                    else if (this.owningDevice.client.billingMode === Client.billingMode.postPaid) {
                        // Not yet implemented
                        Catenis.logger.ERROR('Processing for postpaid billing mode not yet implemented');
                        throw new Error('Processing for postpaid billing mode not yet implemented');
                    }

                    try {
                        // Prepare transaction to in-migrate asset
                        inMigrateAssetTransact = new InMigrateAssetTransaction(this.owningDevice, this.expAsset.asset, this.smDivAmount.toNumber());

                        // Build and send transaction
                        inMigrateAssetTransact.buildTransaction();

                        inMigrateAssetTransact.sendTransaction();

                        // Force polling of blockchain so newly sent transaction is received and processed right away
                        Catenis.txMonitor.pollNow();
                    }
                    catch (err) {
                        // Error in-migrating asset. Log error condition
                        Catenis.logger.ERROR('Error in-migrating asset.', err);

                        if (inMigrateAssetTransact && !inMigrateAssetTransact.txid) {
                            // Revert output addresses added to transaction
                            inMigrateAssetTransact.revertOutputAddresses();
                        }

                        // Rethrows exception
                        throw err;
                    }

                    try {
                        // Record billing info for service
                        const billing = Billing.createNew(this.owningDevice, inMigrateAssetTransact, servicePriceInfo);

                        let servicePayTransact;

                        if (this.owningDevice.client.billingMode === Client.billingMode.prePaid) {
                            servicePayTransact = Catenis.spendServCredit.confirmPaymentForService(paymentProvisionInfo, inMigrateAssetTransact.txid);
                        }
                        else if (this.owningDevice.client.billingMode === Client.billingMode.postPaid) {
                            // Not yet implemented
                            Catenis.logger.ERROR('Processing for postpaid billing mode not yet implemented');
                            // noinspection ExceptionCaughtLocallyJS
                            throw new Error('Processing for postpaid billing mode not yet implemented');
                        }

                        billing.setServicePaymentTransaction(servicePayTransact);
                    }
                    catch (err) {
                        if ((err instanceof Meteor.Error) && err.error === 'ctn_spend_serv_cred_tx_rejected') {
                            // Spend service credit transaction has been rejected.
                            //  Log warning condition
                            Catenis.logger.WARN('Billing for migrate asset service (serviceTxid: %s) recorded with no service payment transaction', inMigrateAssetTransact.txid);
                        }
                        else {
                            // Error recording billing info for migrate asset service.
                            //  Just log error condition
                            Catenis.logger.ERROR('Error recording billing info for migrate asset service (serviceTxid: %s),', inMigrateAssetTransact.txid, err);
                        }
                    }
                });
            });
        });

        return inMigrateAssetTransact.txid;
    }

    /**
     * Process the outcome of the foreign blockchain transaction used to migrate an asset amount
     * @param {*} error Indicates an error during the processing of the foreign blockchain transaction
     * @param {Object} [receipt] The transaction receipt
     * @private
     */
    _processForeignTxOutcome(error, receipt) {
        if (this.direction === AssetMigration.migrationDirection.outward) {
            this._processOutMigrateForeignTxOutcome(error, receipt);
        }
        else {
            this._processInMigrateForeignTxOutcome(error, receipt);
        }
    }

    /**
     * Process the outcome of the foreign blockchain transaction used to out-migrate an asset amount
     * @param {*} error Indicates an error during the processing of the foreign blockchain transaction
     * @param {Object} [receipt] The transaction receipt
     * @private
     */
    _processOutMigrateForeignTxOutcome(error, receipt) {
        if (!this.migrating) {
            Catenis.logger.ERROR('Unexpected asset migration state for processing (out-migrate) foreign transaction outcome', {
                foreignTransaction: this.foreignTransaction,
                status: this.status
            });
            throw new Error('Unexpected asset migration state for processing (out-migrate) foreign transaction outcome');
        }

        if (error) {
            // Error
            this.foreignTransaction.success = false;
            this.foreignTransaction.error = {
                original: `${error}`,
                endUser: translateForeignTxError(error, 'mint').reason
            };

            if (receipt) {
                this.foreignTransaction.txReceipt = receipt;
            }

            this.status = AssetMigration.migrationStatus.interrupted;
        }
        else {
            // Success
            this.foreignTransaction.success = true;
            this.status = AssetMigration.migrationStatus.success;
        }

        this.foreignTransaction.isPending = false;

        this._saveToDb();

        // Send notification advising that asset migration has been finalized
        this.owningDevice.notifyAssetMigrationOutcome(this.getOutcome(true, true));
    }

    /**
     * Process the outcome of the foreign blockchain transaction used to in-migrate an asset amount
     * @param {*} error Indicates an error during the processing of the foreign blockchain transaction
     * @param {Object} [receipt] The transaction receipt
     * @private
     */
    _processInMigrateForeignTxOutcome(error, receipt) {
        if (!this.migrating) {
            Catenis.logger.ERROR('Unexpected asset migration state for processing (in-migrate) foreign transaction outcome', {
                foreignTransaction: this.foreignTransaction,
                status: this.status
            });
            throw new Error('Unexpected asset migration state for processing (in-migrate) foreign transaction outcome');
        }

        const inMigrationUpdate = {};

        if (error) {
            // Error
            this.foreignTransaction.success = false;
            this.foreignTransaction.error = {
                original: `${error}`,
                endUser: translateForeignTxError(error, 'burn').reason
            };

            if (receipt) {
                this.foreignTransaction.txReceipt = receipt;
            }

            this.status = AssetMigration.migrationStatus.error;
        }
        else {
            // Success
            this.foreignTransaction.success = true;
        }

        this.foreignTransaction.isPending = false;
        inMigrationUpdate.foreignTransaction = true;

        if (!this.migrationFailure) {
            try {
                // Execute Catenis service
                this.catenisService.txid = this._executeInMigrationService();
                this.catenisService.status = AssetMigration.serviceStatus.fulfilled;
                this.status = AssetMigration.migrationStatus.success;
            }
            catch (err) {
                this.catenisService.error = decodeCatenisServiceError(err);
                this.catenisService.status = AssetMigration.serviceStatus.failure;
                this.status = AssetMigration.migrationStatus.interrupted;
            }

            inMigrationUpdate.catenisService = true;
        }

        this._saveToDb(inMigrationUpdate);

        // Send notification advising that asset migration has been finalized
        this.owningDevice.notifyAssetMigrationOutcome(this.getOutcome(true, true));
    }

    /**
     * Start monitoring outcome of pending asset migration foreign transaction
     * @private
     */
    _monitorTxOutcome() {
        AssetMigration.pendingAssetMigrations.map.set(this.foreignTransaction.txid, this);

        if (!AssetMigration.pendingAssetMigrations.checking) {
            AssetMigration._checkPendingAssetMigrations();
        }
    }

    /**
     * Set up for the reprocessing of retrieval of asset migration foreign transaction receipt
     * @private
     */
    _setFailedTxReceipt() {
        AssetMigration.failedTxReceipts.set.add({
            assetMigration: this,
            ticksToReprocess: 0,
            reprocessCounter: 0
        });

        AssetMigration._startReprocessingFailedTxReceipts();
    }


    // Class (public) methods
    //

    static initialize() {
        Catenis.logger.TRACE('AssetMigration initialization');
        this._checkPendingAssetMigrations();
    }

    /**
     * Check if a value is a valid asset migration status
     * @param {*} value
     * @return {boolean}
     */
    static isValidStatus(value) {
        return value !== 'void' && Object.values(AssetMigration.migrationStatus).some(status => value === status);
    }

    /**
     * Check if a value is a valid asset migration direction
     * @param {*} value
     * @return {boolean}
     */
    static isValidDirection(value) {
        return Object.values(AssetMigration.migrationDirection).some(direction => value === direction);
    }

    /**
     * Create new asset migration instance
     * @param {string} direction The migration direction
     * @param {Asset} asset Catenis asset the amount of which is migrated to/from the foreign blockchain
     * @param {string} blockchainKey Foreign blockchain key. It should match one of the keys defined in the
     *                                  ForeignBlockchain module
     * @param {Device} owningDevice Catenis device that owns the migrated asset amount
     * @param {number} amount Amount of Catenis asset migrated to/from the foreign blockchain
     * @param {string} [destAddress] Foreign blockchain address that should receive migrated asset amount (as the same
     *                                amount of the associated foreign blockchain token)
     * @return {AssetMigration}
     */
    static newAssetMigration(direction, asset, blockchainKey, owningDevice, amount, destAddress) {
        return new AssetMigration(
            null,
            direction,
            ExportedAsset.getExportedAsset(asset, blockchainKey),
            owningDevice,
            amount,
            destAddress
        );
    }

    /**
     * Get asset migration instance by asset migration ID
     * @param {string} migrationId Asset migration ID
     * @return {AssetMigration}
     */
    static getAssetMigrationByMigrationId(migrationId) {
        // Try to find AssetMigration database rec/doc
        const docAssetMgr = Catenis.db.collection.AssetMigration.findOne({
            migrationId: migrationId
        });

        if (!docAssetMgr) {
            // Asset migration not found. Throw error
            throw new Meteor.Error('ctn_asset_mgr_not_found', `No asset migration found with the given migration ID (${migrationId})`);
        }

        return new AssetMigration(docAssetMgr);
    }

    /**
     * Check pending asset migrations and process their transaction outcome
     * @private
     */
    static _checkPendingAssetMigrations() {
        this.pendingAssetMigrations.checking = true;
        Catenis.logger.TRACE('Checking for pending asset migrations');
        
        try {
            if (!this.pendingAssetMigrations.map) {
                // Retrieve pending asset migrations
                this.pendingAssetMigrations.map = new Map();

                Catenis.db.collection.AssetMigration.find({
                    'foreignTransaction.isPending': true
                })
                .forEach(doc => this.pendingAssetMigrations.map.set(
                    doc.foreignTransaction.txid,
                    new AssetMigration(doc)
                ));
            }

            if (this.pendingAssetMigrations.map.size > 0) {
                let txHashes = Array.from(this.pendingAssetMigrations.map.keys());
                const ctnErc20Token = this.pendingAssetMigrations.map.get(txHashes[0]).expAsset.ctnErc20Token;

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
                        Catenis.logger.WARN('Unable to retrieve asset migration foreign transaction; assuming that it is still valid', {
                            txHash
                        });
                    }
                    else if (!txs[idx]) {
                        // Transaction not valid any more.
                        //  Exclude asset migration from pending list, and report error
                        const assetMigration = this.pendingAssetMigrations.map.get(txHash);
                        this.pendingAssetMigrations.map.delete(txHash);

                        assetMigration._processForeignTxOutcome(new Error('No transaction found with the given transaction hash'));
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

                            // Exclude asset migration from pending list, and set it up for its reprocessing
                            const assetMigration = this.pendingAssetMigrations.map.get(txHash);
                            this.pendingAssetMigrations.map.delete(txHash);

                            Catenis.logger.WARN('Failure retrieving asset migration foreign transaction receipt. Retrying...', {
                                assetMigration,
                                error
                            });
                            assetMigration._setFailedTxReceipt();
                        }
                        else {
                            // Transaction receipt successfully retrieved (or not yet available)
                            if (txReceipt) {
                                // Transaction receipt available. Check if it had failed
                                let error;

                                if (!txReceipt.status) {
                                    error = new Error('Unknown error while processing foreign blockchain transaction');
                                }

                                // Exclude asset migration from pending list, and process transaction outcome
                                const assetMigration = this.pendingAssetMigrations.map.get(txHash);
                                this.pendingAssetMigrations.map.delete(txHash);

                                assetMigration._processForeignTxOutcome(error, txReceipt);
                            }
                        }
                    });

                    if (this.pendingAssetMigrations.map.size > 0) {
                        // Not all pending asset migrations have been process.
                        //  Try again later
                        Meteor.setTimeout(AssetMigration._checkPendingAssetMigrations, cfgSettings.checkPendingMigrationRetryInterval);
                    }
                    else {
                        // Stop checking
                        this.pendingAssetMigrations.checking = false;
                    }
                }
                else {
                    // Stop checking
                    this.pendingAssetMigrations.checking = false;
                }
            }
            else {
                // Stop checking
                this.pendingAssetMigrations.checking = false;
            }
        }
        catch (err) {
            Catenis.logger.ERROR('Error while checking pending asset migrations.', err);
            // Stop checking
            this.pendingAssetMigrations.checking = false;
        }
    }

    /**
     * Start process to reprocess retrieval of asset migration foreign transaction receipts
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
     * Stop process to reprocess retrieval of asset migration foreign transaction receipts
     * @private
     */
    static _stopReprocessingFailedTxReceipts() {
        if (this.failedTxReceipts.reprocessingInterval) {
            Meteor.clearInterval(this.failedTxReceipts.reprocessingInterval);
            this.failedTxReceipts.reprocessingInterval = undefined;
        }
    }

    /**
     * Reprocess retrieval of asset migration foreign transaction receipt
     * @private
     */
    static _reprocessFailedTxReceipts() {
        if (!this.failedTxReceipts.reprocessing) {
            this.failedTxReceipts.reprocessing = true;
            Catenis.logger.TRACE('Reprocessing retrieval of asset migration foreign tx receipt');

            try {
                // Identify entries that need to be reprocessed now
                const entriesToReprocess = new Map();

                for (const entry of this.failedTxReceipts.set) {
                    if (entry.ticksToReprocess === 0) {
                        entriesToReprocess.set(entry.assetMigration.foreignTransaction.txid, entry);
                    }
                    else {
                        entry.ticksToReprocess--;
                    }
                }

                if (entriesToReprocess.size > 0) {
                    let txHashes = Array.from(entriesToReprocess.keys());
                    const ctnErc20Token = entriesToReprocess.get(txHashes[0]).assetMigration.expAsset.ctnErc20Token;

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
                            Catenis.logger.WARN('Unable to retrieve asset migration foreign transaction; assuming that it is still valid', {
                                txHash
                            });
                        }
                        else if (!txs[idx]) {
                            // Transaction not valid any more.
                            //  Abort reprocessing and report error
                            const entry = entriesToReprocess.get(txHash);
                            this.failedTxReceipts.set.delete(entry);

                            entry.assetMigration._processForeignTxOutcome(new Error('No transaction found with the given transaction hash'));
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
                                // Error retrieving asset migration foreign transaction receipt
                                const error = txReceipt;
                                const entry = entriesToReprocess.get(txHash);

                                entry.reprocessCounter++;

                                if (entry.reprocessCounter < cfgSettings.reprocessFailedTxReceipts.maxReprocessCounter) {
                                    // Prepare to reprocess retrieval of tx receipt
                                    entry.ticksToReprocess = Math.pow(cfgSettings.reprocessFailedTxReceipts.ticksToReprocessFactor, entry.reprocessCounter - 1);
                                    Catenis.logger.WARN(`Failure retrieving asset migration foreign transaction receipt. Retrying in ${entry.ticksToReprocess} ticks.`, {
                                        assetMigration: entry.assetMigration,
                                        error
                                    });
                                }
                                else {
                                    // Maximum reprocessing tries reached. Abort reprocessing and report error
                                    Catenis.logger.ERROR(`Error retrieving asset migration foreign transaction receipt. ABORTING reprocessing after ${entry.reprocessCounter} retries.`, {
                                        assetMigration: entry.assetMigration,
                                        error
                                    });
                                    this.failedTxReceipts.set.delete(entry);
                                    entry.assetMigration._processForeignTxOutcome(new Error(`Failure retrieving asset migration foreign transaction receipt: ${error}`));
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

                                    entry.assetMigration._processForeignTxOutcome(error, txReceipt);
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
                Catenis.logger.ERROR('Error while reprocessing retrieval of asset migration foreign tx receipt.', err);
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
 * Generate a new (unique) asset migration ID
 * @param {boolean} [checkExistence]
 * @return {string}
 */
function newAssetMigrationId(checkExistence = true) {
    let id = 'g' + Random.id(19);

    if (checkExistence) {
        while (Catenis.db.collection.AssetMigration.findOne({migrationId: id}, {fields: {_id: 1}})) {
            Catenis.logger.DEBUG(`Newly generated Asset Migration ID (${id}) already exists. Trying again.`);

            id = 'g' + Random.id(19);
        }
    }

    return id;
}

/**
 * Decode errors that could be thrown while executing Catenis service to migrate asset and
 *  return the appropriate error message
 * @param {Error} err Thrown error
 * @return {string} Error message
 */
function decodeCatenisServiceError(err) {
    let error;

    if (err instanceof Meteor.Error) {
        if (err.error === 'ctn_asset_mgr_low_service_acc_balance') {
            error = 'Not enough credits to pay for migrate asset service';
        }
        else if (err.error === 'ctn_asset_mgr_low_asset_balance') {
            error = 'Insufficient asset balance to out-migrate';
        }
        else if (err.error === 'ctn_asset_mgr_low_mgr_asset_balance' || err.error === 'ctn_in_mgr_low_mgr_asset_balance') {
            error = 'Insufficient migrated asset amount to in-migrate asset';
        }
        else {
            error = 'Internal server error';
        }
    }
    else {
        error = 'Internal server error';
    }

    return error;
}

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
            'ctn_asset_mgr_low_foreign_bc_funds',
            `Foreign blockchain funds not enough to cover transaction execution price (${error.txExecPrice})`
        );
    }
    else if ((error instanceof Error) && error.message.includes('burn amount exceeds balance')) {
        // Low foreign token balance error
        throw new Meteor.Error(
            'ctn_asset_mgr_low_token_balance',
            'Foreign token balance too low to in-migrate the asset amount'
        );
    }
    else if ((error instanceof Error) && (error.message.startsWith('No transaction found with the given transaction hash')
            || error.message === 'Failed to send foreign blockchain transaction: nonce already used')) {
        // Previously sent foreign blockchain transaction is not valid anymore
        translatedError = new Meteor.Error(
            'ctn_asset_mgr_discarded_token_call',
            'Discarded concurrent foreign token smart contract call'
        );
    }
    else {
        // Any other error
        Catenis.logger.ERROR(`Unexpected error calling foreign token smart contract method '${method}'.`, error);
        translatedError = new Meteor.Error(
            'ctn_asset_mgr_token_call_error',
            'Unexpected error calling foreign token smart contract'
        );
    }

    return translatedError;
}


// Module code
//

// Lock class
Object.freeze(AssetMigration);
