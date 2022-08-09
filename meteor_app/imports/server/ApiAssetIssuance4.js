/**
 * Created by claudio on 2022-08-08
 */

//console.log('[ApiAssetIssuance4.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
//import config from 'config';
import moment from 'moment';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import {
    successResponse,
    errorResponse
} from './RestApi';
import { cfgSettings as assetCfgSetting } from './Asset';


// Definition of module (private) functions
//

/**
 * @typedef {Object} RetrieveAssetIssuanceHistoryAPIResponse
 * @property {number} statusCode
 * @property {Object} headers
 * @property {Object} body
 * @property {string} body.status
 * @property {string} [body.message]
 * @property {AssetIssuanceHistory} [body.data]
 */

/**
 * Method used to process GET 'assets/:assetId/issuance' endpoint of Rest API
 * @this {Object}
 * @property {Object} urlParams
 * @property {string} urlParams.assetId ID of the asset to retrieve issuance history
 * @property {Object} queryParams
 * @property {string} [queryParams.startDate] ISO 8601 formatted date and time specifying the lower boundary of the time
 *                                             frame within which the issuance events intended to be retrieved have
 *                                             occurred. The returned issuance events must have occurred not before that
 *                                             date/time
 * @property {string} [queryParams.endDate] ISO 8601 formatted date and time specifying the upper boundary of the time
 *                                           frame within which the issuance events intended to be retrieved have
 *                                           occurred. The returned issuance events must have occurred not after that
 *                                           date/time
 * @property {number} [queryParams.limit] Maximum number of asset issuance events that should be returned. Default
 *                                         value: maxQueryIssuanceCount
 * @property {number} [queryParams.skip=0] Number of asset issuance events that should be skipped (from beginning of
 *                                          list of matching events) and not returned.
 * @returns {RetrieveAssetIssuanceHistoryAPIResponse}
 */
export function retrieveAssetIssuanceHistory4() {
    try {
        // Process request parameters
        let invalidParams = [];

        // From URL
        //
        // assetId param
        if (!(typeof this.urlParams.assetId === 'string' && this.urlParams.assetId.length > 0)) {
            Catenis.logger.DEBUG('Invalid \'assetId\' parameter for GET \'assets/:assetId/issuance\' API request', this.urlParams);
            invalidParams.push('assetId');
        }

        // From query string
        //
        // startDate param
        let startDate;

        if (this.queryParams.startDate !== undefined) {
            const mt = moment(this.queryParams.startDate, moment.ISO_8601);

            if (mt.isValid()) {
                startDate = mt.toDate();
            }
            else {
                Catenis.logger.DEBUG('Invalid \'startDate\' parameter for GET \'assets/:assetId/issuance\' API request', this.urlParams);
                invalidParams.push('startDate');
            }
        }

        // startDate param
        let endDate;

        if (this.queryParams.endDate !== undefined) {
            const mt = moment(this.queryParams.endDate, moment.ISO_8601);

            if (mt.isValid()) {
                endDate = mt.toDate();
            }
            else {
                Catenis.logger.DEBUG('Invalid \'endDate\' parameter for GET \'assets/:assetId/issuance\' API request', this.urlParams);
                invalidParams.push('endDate');
            }
        }

        // limit param
        let limit;

        if (!(typeof this.queryParams.limit === 'undefined' || (!Number.isNaN(limit = Number.parseInt(this.queryParams.limit)) && isValidLimit(limit)))) {
            Catenis.logger.DEBUG('Invalid \'limit\' parameter for GET \'assets/:assetId/issuance\' API request', this.queryParams);
            invalidParams.push('limit');
        }

        // skip param
        let skip;

        if (!(typeof this.queryParams.skip === 'undefined' || (!Number.isNaN(skip = Number.parseInt(this.queryParams.skip)) && isValidSkip(skip)))) {
            Catenis.logger.DEBUG('Invalid \'skip\' parameter for GET \'assets/:assetId/issuance\' API request', this.queryParams);
            invalidParams.push('skip');
        }

        if (invalidParams.length > 0) {
            return errorResponse.call(this, 400, `Invalid parameters: ${invalidParams.join(', ')}`);
        }

        // Make sure that system is running and accepting API calls
        if (!Catenis.application.isRunning()) {
            Catenis.logger.DEBUG('System currently not available for fulfilling GET \'assets/:assetId/issuance\' API request', {applicationStatus: Catenis.application.status});
            return errorResponse.call(this, 503, 'System currently not available; please try again at a later time');
        }

        // Execute method to retrieve asset issuance history
        let result;

        try {
            result = this.user.device.retrieveAssetIssuanceHistory2(this.urlParams.assetId, startDate, endDate, limit, skip);
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
                else if (err.error === 'ctn_asset_not_found') {
                    error = errorResponse.call(this, 400, 'Invalid asset ID');
                }
                else if (err.error === 'ctn_device_asset_no_access') {
                    error = errorResponse.call(this, 403, 'No permission to retrieve asset issuance history');
                }
                else {
                    error = errorResponse.call(this, 500, 'Internal server error');
                }
            }
            else {
                error = errorResponse.call(this, 500, 'Internal server error');
            }

            if (error.statusCode === 500) {
                Catenis.logger.ERROR('Error processing GET \'assets/:assetId/issuance\' API request.', err);
            }

            return error;
        }

        // Return success
        return successResponse.call(this, result);
    }
    catch (err) {
        Catenis.logger.ERROR('Error processing GET \'assets/:assetId/issuance\' API request.', err);
        return errorResponse.call(this, 500, 'Internal server error');
    }
}

function isValidLimit(num) {
    return num > 0 && num <= assetCfgSetting.maxQueryIssuanceCount;
}

function isValidSkip(num) {
    return num >= 0;
}
