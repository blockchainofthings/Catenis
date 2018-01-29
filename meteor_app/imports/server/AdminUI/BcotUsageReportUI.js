/**
 * Created by claudio on 19/01/18.
 */

//console.log('[BcotUsageReportUI.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import config from 'config';
// Meteor packages
import { Meteor } from 'meteor/meteor';
import { Roles } from 'meteor/alanning:roles';

// References code in other (Catenis) modules
import { Catenis } from '../Catenis';
import { BcotPayment } from '../BcotPayment';

// Config entries
const bcotUsageReportUIConfig = config.get('bcotUsageReportUI');

// Configuration settings
const cfgSettings = {
    baseFilename: bcotUsageReportUIConfig.get('baseFilename'),
    fileExtension: bcotUsageReportUIConfig.get('fileExtension'),
    timeZones: bcotUsageReportUIConfig.get('timeZones'),
    defaultTimeZone: bcotUsageReportUIConfig.get('defaultTimeZone'),
    includeHeaders: bcotUsageReportUIConfig.get('includeHeaders')
};



// Definition of function classes
//

// BcotUsageReportUI function class
export function BcotUsageReportUI() {
}


// Public BcotUsageReportUI object methods
//

/*BcotUsageReportUI.prototype.pub_func = function () {
};*/


// Module functions used to simulate private BcotUsageReportUI object methods
//  NOTE: these functions need to be bound to a BcotUsageReportUI object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// BcotUsageReportUI function class (public) methods
//

BcotUsageReportUI.initialize = function () {
    Catenis.logger.TRACE('BcotUsageReportUI initialization');
    // Declaration of RPC methods to be called from client
    Meteor.methods({
        getBcotUsageReportConfig: function () {
            if (Roles.userIsInRole(this.userId, 'sys-admin')) {
                return cfgSettings;
            }
            else {
                // User not logged in or not a system administrator.
                //  Throw exception
                throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
            }
        },
        downloadBcotUsageReport: function (startDate, endDate) {
            if (Roles.userIsInRole(this.userId, 'sys-admin')) {
                const args = [];

                if (startDate) {
                    args.push(new Date(startDate));
                }

                if (endDate) {
                    if (args.length === 0) {
                        args.push(undefined);
                    }

                    args.push(new Date(endDate));
                }

                if (cfgSettings.includeHeaders) {
                    for (let idx = args.length; idx < 2; idx++) {
                        args.push(undefined);
                    }

                    args.push(true);
                }

                return Buffer.from(BcotPayment.generateBcotPaymentReport.apply(this, args)).toString('base64');
            }
            else {
                // User not logged in or not a system administrator.
                //  Throw exception
                throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
            }
        }
    });
};


// BcotUsageReportUI function class (public) properties
//

//BcotUsageReportUI.prop = {};


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

/*function module_func() {
}*/

// Lock function class
Object.freeze(BcotUsageReportUI);
