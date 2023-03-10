/**
 * Created by claudio on 2021-07-14
 */

//console.log('[ApiListExportedAssets.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import moment from 'moment';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import {
    successResponse,
    errorResponse
} from './RestApi';
import { ForeignBlockchain } from './ForeignBlockchain';
import {
    ExportedAsset,
    cfgSettings as expAssetCfgSettings
} from './ExportedAsset';


// Definition of module (private) functions
//

/**
 * @typedef {Object} ListExportedAssetsAPIResponse
 * @property {number} statusCode
 * @property {Object} headers
 * @property {Object} body
 * @property {string} body.status
 * @property {string} [body.message]
 * @property {Object} [body.data]
 * @property {ExportedAssetOutcome[]} [body.data.exportedAssets]
 * @property {boolean} [body.data.hasMore]
 */

/**
 * Method used to process GET 'assets/exported' endpoint of REST API
 * @this {Object}
 * @property {Object} queryParams
 * @property {string} [queryParams.assetId] ID of exported Asset
 * @property {string} [queryParams.foreignBlockchain] Name of the foreign blockchain
 * @property {string} [queryParams.tokenSymbol] Symbol of exported asset's associated foreign token
 * @property {string} [queryParams.status] A single status or a comma separated list of statuses to include
 * @property {string} [queryParams.negateStatus='false'] Boolean value that indicates whether the specified statuses
 *                                              should be excluded instead
 * @property {string} [queryParams.startDate] ISO 8601 formatted date and time specifying the lower bound of the time
 *                                             frame within which the asset has been exported
 * @property {string} [queryParams.endDate] ISO 8601 formatted date and time specifying the upper bound of the time
 *                                             frame within which the asset has been exported
 * @property {string} [queryParams.limit='500'] Maximum number of exported assets that should be returned
 * @property {string} [queryParams.skip='0'] Number of exported assets that should be skipped (from beginning of list of
 *                                            matching exported assets) and not returned
 * @return {ListExportedAssetsAPIResponse}
 */
export function listExportedAssets() {
    try {
        // Process request parameters
        let invalidParams = [];
        let filter = {
            negateStatus: false
        };

        // From query string
        //
        // assetId param
        if (typeof this.queryParams.assetId === 'string' && this.queryParams.assetId.length > 0) {
            filter.assetId = this.queryParams.assetId;
        }
        else if (this.queryParams.assetId !== undefined) {
            Catenis.logger.DEBUG('Invalid \'assetId\' parameter for GET \'assets/exported\' API request', this.queryParams);
            invalidParams.push('assetId');
        }

        // foreignBlockchain param
        if (typeof this.queryParams.foreignBlockchain === 'string' && this.queryParams.foreignBlockchain.length > 0
                && ForeignBlockchain.isValidKey(this.queryParams.foreignBlockchain)) {
            filter.foreignBlockchain = this.queryParams.foreignBlockchain;
        }
        else if (this.queryParams.foreignBlockchain !== undefined) {
            Catenis.logger.DEBUG('Invalid \'foreignBlockchain\' parameter for GET \'assets/exported\' API request', this.queryParams);
            invalidParams.push('foreignBlockchain');
        }

        // tokenSymbol param
        if (typeof this.queryParams.tokenSymbol === 'string' && this.queryParams.tokenSymbol.length > 0) {
            filter.tokenSymbol = this.queryParams.tokenSymbol;
        }
        else if (this.queryParams.tokenSymbol !== undefined) {
            Catenis.logger.DEBUG('Invalid \'tokenSymbol\' parameter for GET \'assets/exported\' API request', this.queryParams);
            invalidParams.push('tokenSymbol');
        }

        // status param
        if (!(this.queryParams.status === undefined || (typeof this.queryParams.status === 'string'
                && this.queryParams.status.length > 0
                && (filter.status = parseStatusList(this.queryParams.status)) !== null))) {
            Catenis.logger.DEBUG('Invalid \'status\' parameter for GET \'assets/exported\' API request', this.queryParams);
            invalidParams.push('status');
        }

        // negateStatus param
        if (!(this.queryParams.negateStatus === undefined || (typeof this.queryParams.negateStatus === 'string'
                && this.queryParams.negateStatus.length > 0
                && (filter.negateStatus = parseBoolean(this.queryParams.negateStatus)) !== null))) {
            Catenis.logger.DEBUG('Invalid \'negateStatus\' parameter for GET \'assets/exported\' API request', this.queryParams);
            invalidParams.push('negateStatus');
        }

        // startDate param
        if (!(this.queryParams.startDate === undefined || (typeof this.queryParams.startDate === 'string'
                && this.queryParams.startDate.length > 0
                && (filter.startDate = parseDate(this.queryParams.startDate)) !== null))) {
            Catenis.logger.DEBUG('Invalid \'startDate\' parameter for GET \'assets/exported\' API request', this.queryParams);
            invalidParams.push('startDate');
        }

        // endDate param
        if (!(this.queryParams.endDate === undefined || (typeof this.queryParams.endDate === 'string'
                && this.queryParams.endDate.length > 0
                && (filter.endDate = parseDate(this.queryParams.endDate)) !== null))) {
            Catenis.logger.DEBUG('Invalid \'endDate\' parameter for GET \'assets/exported\' API request', this.queryParams);
            invalidParams.push('endDate');
        }

        // limit param
        let limit;

        if (!(this.queryParams.limit === undefined
                || (!Number.isNaN(limit = Number.parseInt(this.queryParams.limit)) && isValidLimit(limit)))) {
            Catenis.logger.DEBUG('Invalid \'limit\' parameter for GET \'assets/exported\' API request', this.queryParams);
            invalidParams.push('limit');
        }
        
        // skip param
        let skip;

        if (!(this.queryParams.skip === undefined
                || (!Number.isNaN(skip = Number.parseInt(this.queryParams.skip)) && isValidSkip(skip)))) {
            Catenis.logger.DEBUG('Invalid \'skip\' parameter for GET \'assets/exported\' API request', this.queryParams);
            invalidParams.push('skip');
        }

        if (invalidParams.length > 0) {
            return errorResponse.call(this, 400, `Invalid parameters: ${invalidParams.join(', ')}`);
        }

        // Make sure that system is running and accepting API calls
        if (!Catenis.application.isRunning()) {
            Catenis.logger.DEBUG('System currently not available for fulfilling GET \'assets/exported\' API request', {applicationStatus: Catenis.application.status});
            return errorResponse.call(this, 503, 'System currently not available; please try again at a later time');
        }

        // Execute method to list exported assets
        let listResult;

        try {
            listResult = this.user.device.listExportedAssets(filter, limit, skip);
        }
        catch (err) {
            let error;

            if (err instanceof Meteor.Error) {
                if (err.error === 'ctn_device_deleted') {
                    // This should never happen (deleted devices are not authenticated)
                    error = errorResponse.call(this, 400, 'Device is deleted');
                }
                else if (err.error === 'ctn_device_not_active') {
                    // This should never happen (inactive devices are not authenticated)
                    error = errorResponse.call(this, 400, 'Device is not active');
                }
                else {
                    error = errorResponse.call(this, 500, 'Internal server error');
                }
            }
            else {
                error = errorResponse.call(this, 500, 'Internal server error');
            }

            if (error.statusCode === 500) {
                Catenis.logger.ERROR('Error processing GET \'assets/exported\' API request.', err);
            }

            return error;
        }

        return successResponse.call(this, listResult);
    }
    catch (err) {
        Catenis.logger.ERROR('Error processing GET \'assets/exported\' API request.', err);
        return errorResponse.call(this, 500, 'Internal server error');
    }
}

/**
 * Parse comma separated list of asset export statuses
 * @param {string} list
 * @return {(string[]|null)} The parsed list, or null if the passed list is not valid
 */
function parseStatusList(list) {
    let statuses = list.split(',').map(value => value.trim());

    if (statuses.some(status => !ExportedAsset.isValidStatus(status))) {
        return null;
    }

    return statuses;
}

/**
 * Parse boolean string value
 * @param {string} value
 * @return {(boolean|null)} The parsed boolean value, or null if the passed string value is not valid
 */
export function parseBoolean(value) {
    return typeof value !== 'string' ? null : (value === '1' || value.toLowerCase() === 'true' ? true : (value === '0' || value.toLowerCase() === 'false' ? false : null));
}

/**
 * Parse ISO 8601 formatted date and time
 * @param {string} value
 * @return {(Date|null)} The parsed date, or null if the passed string value is not a valid ISO 8601 date
 */
export function parseDate(value) {
    const mt = moment(value, moment.ISO_8601);

    return mt.isValid() ? mt.toDate() : null;
}

/**
 * Validate limit parameter
 * @param {number} num
 * @return {boolean}
 */
function isValidLimit(num) {
    return num > 0 && num <= expAssetCfgSettings.maxQueryCount;
}

/**
 * Validate skip parameter
 * @param {number} num
 * @return {boolean}
 */
function isValidSkip(num) {
    return num >= 0;
}
