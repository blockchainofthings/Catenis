/**
 * Created by claudio on 2017-07-20.
 */

//console.log('[License.js]: This code just ran.');

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

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { LicenseShared } from '../both/LicenseShared';

// Config entries
/*const config_entryConfig = config.get('config_entry');

// Configuration settings
const cfgSettings = {
    property: config_entryConfig.get('property_name')
};*/


// Definition of function classes
//

// License function class
//
//  Constructor arguments:
//   docLicense [Object] - License database doc/rec
export function License(docLicense) {
    // Save license data
    this.doc_id = docLicense._id;
    this.level = docLicense.level;
    this.order = docLicense.order;
    this.type = docLicense.type;
    this.revision = docLicense.revision;
    this.maximumDevices = docLicense.maximumDevices;
    this.validityMonths = docLicense.validityMonths;
    this.provisionalRenewalDays = docLicense.provisionalRenewalDays;
    this.status = docLicense.status;
    this.createdDate = docLicense.createdDate;
    this.activatedDate = docLicense.activatedDate;
    this.deactivatedDate = docLicense.deactivatedDate;
}


// Public License object methods
//

License.prototype.isActive = function () {
    return this.status === License.status.active.name;
};

License.prototype.activate = function () {
    try {
        // Make sure that license can be activated
        let canActivate = false;

        if (this.status === License.status.new.name) {
            // Make sure that no later revision is already activated
            const docLicenseAlreadyActive = Catenis.db.collection.License.findOne({
                level: this.level,
                type: conformTypeToFind(this.type),
                revision: {
                    $gt: this.revision
                },
                status: License.status.active.name
            }, {
                fields: {
                    _id: 1
                }
            });

            if (!docLicenseAlreadyActive) {
                canActivate = true;
            }
        }

        if (canActivate) {
            // Activate license
            const now = new Date();

            Catenis.db.collection.License.update({
                _id: this.doc_id
            }, {
                $set: {
                    status: License.status.active.name,
                    activatedDate: now
                }
            });

            // Update saved data
            this.status = License.status.active.name;
            this.activatedDate = now;

            // Fix active revision
            fixActiveRevision.call(this);
        }
        else {
            // Log warning condition
            Catenis.logger.WARN('License cannot be activated', this);
        }
    }
    catch (err) {
        // Log error and throw exception
        Catenis.logger.ERROR('Error while activating license.', err);
        throw new Meteor.Error('ctn_license_activate_error', 'Error while activating license: ' + err.toString());
    }
};

License.prototype.deactivate = function () {
    try {
        // Make sure that license can be deactivated
        if (this.status === License.status.new.name || this.status === License.status.active.name) {
            // Deactivate license
            const now = new Date();

            Catenis.db.collection.License.update({
                _id: this.doc_id
            }, {
                $set: {
                    status: License.status.inactive.name,
                    deactivatedDate: now
                }
            });

            // Update saved data
            this.status = License.status.inactive.name;
            this.deactivatedDate = now;
        }
        else {
            // Log warning condition
            Catenis.logger.WARN('License cannot be deactivated', this);
        }
    }
    catch (err) {
        // Log error and throw exception
        Catenis.logger.ERROR('Error while deactivating license.', err);
        throw new Meteor.Error('ctn_license_deactivate_error', 'Error while deactivating license: ' + err.toString());
    }
};


// Module functions used to simulate private License object methods
//  NOTE: these functions need to be bound to a License object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

function fixActiveRevision() {
    try {
        // Retrieve all currently active revisions
        const docIdLicensesToDeactivate = [];

        Catenis.db.collection.License.find({
            level: this.level,
            type: conformTypeToFind(this.type),
            status: License.status.active.name
        }, {
            fields: {
                _id: 1
            },
            sort: {
                revision: -1
            }
        }).forEach((doc, idx) => {
            if (idx > 0) {
                docIdLicensesToDeactivate.push(doc._id);
            }
        });

        if (docIdLicensesToDeactivate) {
            // Deactivate licenses
            Catenis.db.collection.License.update({
                _id: {
                    $in: docIdLicensesToDeactivate
                }
            }, {
                $set: {
                    status: License.status.inactive.name,
                    deactivatedDate: new Date()
                }
            }, {
                multi: true
            });
        }
    }
    catch (err) {
        // Log error and throw exception
        Catenis.logger.ERROR('Error while fixing active license revision.', err);
        throw new Meteor.Error('ctn_license_fix_actv_error', 'Error while fixing active license revision: ' + err.toString());
    }
}


// License function class (public) methods
//

License.getLicenseByDocId = function (license_id, onlyActive = false) {
    const selector = {
        _id: license_id
    };
    
    if (onlyActive) {
        selector.status = License.status.active.name
    }
    
    const docLicense = Catenis.db.collection.License.findOne(selector);
    
    if (!docLicense) {
        // No license entry found. Log error and throw exception
        Catenis.logger.ERROR('No license entry found with the specified database doc/rec ID', {
            license_id: license_id,
            onlyActive: onlyActive
        });
        throw new Meteor.Error('ctn_license_not_found', util.format('No license entry found with the specified database doc/rec ID (%s)', license_id));
    }
    
    return new License(docLicense);
};

License.getLicense = function (level, type, revision, onlyActive = false) {
    level = conformStrIdField(level);
    type = conformStrIdField(type);

    const selector = {
        level: level,
        type: conformTypeToFind(type),
        revision: revision
    };

    if (onlyActive) {
        selector.status = License.status.active.name
    }

    const docLicense = Catenis.db.collection.License.findOne(selector);

    if (!docLicense) {
        // No license entry found. Log error and throw exception
        Catenis.logger.ERROR('No license entry found', {
            level: level,
            type: type,
            revision: revision,
            onlyActive: onlyActive
        });
        throw new Meteor.Error('ctn_license_not_found', 'No license entry found');
    }

    return new License(docLicense);
};

// Return currently active (latest revision) license of a given level an type
License.getLicenseByLevelAndType = function (level, type) {
    level = conformStrIdField(level);
    type = conformStrIdField(type);

    const docLicense = Catenis.db.collection.License.findOne({
        level: level,
        type: conformTypeToFind(type),
        status: License.status.active.name
    }, {
        sort: {
            revision: -1
        }
    });

    if (!docLicense) {
        // No license entry found. Log error and throw exception
        Catenis.logger.ERROR('No active license entry found with the specified level and type', {
            level: level,
            type: type
        });
        throw new Meteor.Error('ctn_license_not_found', util.format('No active license entry found with the specified level (%s) and type (%s)', level, type));
    }

    return new License(docLicense);
};

License.getLicenseLatestRevision = function (level, type) {
    level = conformStrIdField(level);
    type = conformStrIdField(type);

    const docLicense = Catenis.db.collection.License.findOne({
        level: level,
        type: conformTypeToFind(type),
    }, {
        sort: {
            revision: -1
        }
    });

    if (!docLicense) {
        // No license entry found. Log error and throw exception
        Catenis.logger.ERROR('No latest license entry found', {
            level: level,
            type: type
        });
        throw new Meteor.Error('ctn_license_not_found', 'No latest license entry found');
    }

    return new License(docLicense);
};

// Create a new license entry
//
//  Arguments:
//   level [String] - The value for the level field of the license entry
//   order [Integer] - The value for the order field o the license entry
//   type [String] - (optional) The value for the type field of the license entry
//   revision [Integer] - The value for the revision field of the license entry
//   options [Object] { - Value for optional fields of the license entry
//     maximumDevices: [Integer],
//     validityMonths: [Integer],
//     provisionalRenewalDays: [Integer]
//   }
//
//  Return: license_id - ID of newly created License database doc/rec
License.createLicense = function (level, order, type, revision, options) {
    // Validate arguments
    const errArg = {};

    if (!License.isValidLevel(level)) {
        errArg.level = level;
    }

    if (!Number.isInteger(order)) {
        errArg.order = order;
    }

    if (!License.isValidType(type)) {
        errArg.type = type;
    }

    if (!isNonNegativeInteger(revision)) {
        errArg.revision = revision;
    }

    options = options || {};

    if (typeof options !== 'object') {
        errArg.options = options;
    }
    else {
        if (options.maximumDevices && !isPositiveInteger(options.maximumDevices)) {
            errArg['options.maximumDevices'] = options.maximumDevices;
        }

        if (options.validityMonths && !isPositiveInteger(options.validityMonths)) {
            errArg['options.validityMonths'] = options.validityMonths;
        }

        if (options.provisionalRenewalDays && !isPositiveInteger(options.provisionalRenewalDays)) {
            errArg['options.provisionalRenewalDays'] = options.provisionalRenewalDays;
        }
    }

    if (Object.keys(errArg).length > 0) {
        const errArgs = Object.keys(errArg);

        Catenis.logger.ERROR(util.format('License.createLicense method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw new Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    level = conformStrIdField(level);
    type = conformStrIdField(type);

    let docLicense;

    try {
        // Create new license entry
        docLicense = {
            level: level,
            order: order
        };
        
        if (type) {
            docLicense.type = type;
        }
        
        docLicense.revision = revision;
        
        if (options.maximumDevices) {
            docLicense.maximumDevices = options.maximumDevices;
        }

        if (options.validityMonths) {
            docLicense.validityMonths = options.validityMonths;
        }

        if (options.provisionalRenewalDays) {
            docLicense.provisionalRenewalDays = options.provisionalRenewalDays;
        }

        docLicense.status = License.status.new.name;
        docLicense.createdDate = new Date();
        
        return Catenis.db.collection.License.insert(docLicense);
    }
    catch (err) {
        // Error creating license. Log error condition and throw exception
        Catenis.logger.ERROR('Error creating new license entry: %s.', util.inspect(docLicense), err);
        throw new Meteor.Error('ctn_license_create_error', 'Error creating new license entry: ' + err.toString());
    }
};

License.isValidLevel = function (level) {
    return isNomEmptyString(level);
};

License.isValidType = function (type) {
    return !type || isNomEmptyString(type);
};


// License function class (public) properties
//

License.status = LicenseShared.status;


// Definition of module (private) functions
//

function isNomEmptyString(str) {
    return typeof str === 'string' && str.length > 0;
}

function isNonNegativeInteger(val) {
    return Number.isInteger(val) && val >= 0;
}

function isPositiveInteger(val) {
    return Number.isInteger(val) && val > 0;
}

export function conformStrIdField(val) {
    return val ? val.toLowerCase() : val;
}

export function conformTypeToFind(type) {
    return type ? type : null;
}


// Module code
//

// Lock function class
Object.freeze(License);
