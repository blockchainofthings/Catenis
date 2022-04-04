/**
 * Created by claudio on 2018-09-26.
 */

//console.log('[LicensesUI.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import util from 'util';
// Third-party node modules
//import config from 'config';
// Meteor packages
import { Meteor } from 'meteor/meteor';
import { Roles } from 'meteor/alanning:roles';

// References code in other (Catenis) modules
import { Catenis } from '../Catenis';
import {
    License,
    conformStrIdField,
    conformTypeToFind
} from '../License';


// Definition of function classes
//

// LicensesUI function class
export function LicensesUI() {
}


// Public LicensesUI object methods
//

/*LicensesUI.prototype.pub_func = function () {
};*/


// Module functions used to simulate private LicensesUI object methods
//  NOTE: these functions need to be bound to a LicensesUI object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// LicensesUI function class (public) methods
//

LicensesUI.initialize = function () {
    Catenis.logger.TRACE('LicensesUI initialization');
    // Declaration of RPC methods to be called from client
    Meteor.methods({
        createLicense: function (licenseInfo) {
            if (Roles.userIsInRole(this.userId, 'sys-admin')) {
                try {
                    const licenseOpts = {};
                    
                    if (licenseInfo.maximumDevices) {
                        licenseOpts.maximumDevices = licenseInfo.maximumDevices;
                    }

                    if (licenseInfo.validityMonths) {
                        licenseOpts.validityMonths = licenseInfo.validityMonths;
                    }

                    if (licenseInfo.provisionalRenewalDays) {
                        licenseOpts.provisionalRenewalDays = licenseInfo.provisionalRenewalDays;
                    }
                    
                    // Compute license revision
                    const latestRevLicense = Catenis.db.collection.License.findOne({
                        level: conformStrIdField(licenseInfo.level),
                        type: conformTypeToFind(conformStrIdField(licenseInfo.type))
                    }, {
                        fields: {
                            revision: 1
                        },
                        sort: {
                            revision: -1
                        }
                    });
                    
                    const revision = latestRevLicense ? latestRevLicense.revision + 1 : 0;

                    return License.createLicense(licenseInfo.level, licenseInfo.order, licenseInfo.type, revision, licenseOpts);
                }
                catch (err) {
                    // Error trying to create new license. Log error and throw exception
                    Catenis.logger.ERROR('Failure trying to create new license.', util.inspect({licenseInfo: licenseInfo}), err);
                    throw new Meteor.Error('license.create.failure', 'Failure trying to create new license: ' + err.toString());
                }
            }
            else {
                // User not logged in or not a system administrator.
                //  Throw exception
                throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
            }
        },
        activateLicense: function (license_id) {
            if (Roles.userIsInRole(this.userId, 'sys-admin')) {
                try {
                    License.getLicenseByDocId(license_id).activate();
                }
                catch (err) {
                    // Error trying to activate license. Log error and throw exception
                    Catenis.logger.ERROR('Failure trying to activate license (doc_id: %s).', license_id, err);
                    throw new Meteor.Error('license.activate.failure', 'Failure trying to activate license: ' + err.toString());
                }
            }
            else {
                // User not logged in or not a system administrator.
                //  Throw exception
                throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
            }
        },
        deactivateLicense: function (license_id) {
            if (Roles.userIsInRole(this.userId, 'sys-admin')) {
                try {
                    License.getLicenseByDocId(license_id).deactivate();
                }
                catch (err) {
                    // Error trying to deactivate license. Log error and throw exception
                    Catenis.logger.ERROR('Failure trying to deactivate license (doc_id: %s).', license_id, err);
                    throw new Meteor.Error('license.deactivate.failure', 'Failure trying to deactivate license: ' + err.toString());
                }
            }
            else {
                // User not logged in or not a system administrator.
                //  Throw exception
                throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
            }
        },
        deleteLicense: function (license_id) {
            if (Roles.userIsInRole(this.userId, 'sys-admin')) {
                try {
                    License.getLicenseByDocId(license_id).delete();
                }
                catch (err) {
                    // Error trying to delete license. Log error and throw exception
                    Catenis.logger.ERROR('Failure trying to delete license (doc_id: %s).', license_id, err);
                    throw new Meteor.Error('license.delete.failure', 'Failure trying to delete license: ' + err.toString());
                }
            }
            else {
                // User not logged in or not a system administrator.
                //  Throw exception
                throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
            }
        }
    });

    // Declaration of publications
    Meteor.publish('licenses', function () {
        if (Roles.userIsInRole(this.userId, 'sys-admin')) {
            return Catenis.db.collection.License.find({}, {
                fields: {
                    _id: 1,
                    level: 1,
                    order: 1,
                    type: 1,
                    revision: 1,
                    status: 1
                }
            });
        }
        else {
            // User not logged in or not a system administrator
            //  Make sure that publication is not started and throw exception
            this.stop();
            throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
        }
    });

    Meteor.publish('licenseAndAssociatedActiveLicense', function (license_id) {
        if (Roles.userIsInRole(this.userId, 'sys-admin')) {
            const docLicense = Catenis.db.collection.License.findOne({
                _id: license_id
            }, {
                fields: {
                    level: 1,
                    type: 1
                }
            });

            if (docLicense) {
                return Catenis.db.collection.License.find({
                    $or: [{
                        _id: license_id
                    }, {
                        level: conformStrIdField(docLicense.level),
                        type: conformTypeToFind(conformStrIdField(docLicense.type)),
                        status: License.status.active.name
                    }]
                });
            }
            else {
                this.ready();
            }
        }
        else {
            // User not logged in or not a system administrator
            //  Make sure that publication is not started and throw exception
            this.stop();
            throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
        }
    });
};


// LicensesUI function class (public) properties
//

/*LicensesUI.prop = {};*/


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(LicensesUI);
