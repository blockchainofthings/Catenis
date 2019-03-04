/**
 * Created by claudio on 2016-05-30.
 */

//console.log('[ClientLicense.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import util from 'util';
// Third-party node modules
import config from 'config';
import moment from 'moment-timezone';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { ClientLicenseShared } from '../both/ClientLicenseShared';
import { Client } from './Client';
import { Util } from './Util';
import { License } from './License';
import { CriticalSection } from './CriticalSection';

// Config entries
const clientLicenseConfig = config.get('clientLicense');
let monitorInterval;

// Configuration settings
const cfgSettings = {
    defLateStartCompTimeThreshold: clientLicenseConfig.get('defLateStartCompTimeThreshold'),
    daysToExpireForReminder: clientLicenseConfig.get('daysToExpireForReminder'),
    licenseMonitorInterval: clientLicenseConfig.get('licenseMonitorInterval'),
    offSetToMonitor: clientLicenseConfig.get('offSetToMonitor')
};

// Critical section object to avoid concurrent access to ClientLicense database collection
const clnLicDbCollCS = new CriticalSection();


// Definition of function classes
//

// ClientLicense function class
//
// Constructor arguments:
//  arg: [Object(Client)|String] - Client object the active license of which should be loaded,
//                               - or, ID of ClientLicense doc/rec that should be loaded
//  noDbConcurrency [Boolean] - (optional, default:false) If set, indicates that the mechanism used to avoid database
//                               concurrency should NOT be used for this object
export function ClientLicense(arg, noDbConcurrency = false) {
    this.noDbConcurrency = noDbConcurrency;

    if (arg instanceof Client) {
        this.client = arg;
    }
    else if (typeof arg === 'string' && arg.length > 0) {
        this.doc_id = arg;
    }
    else {
        // Constructor called with invalid argument. Log error and throw exception
        Catenis.logger.ERROR('ClientLicense constructor called with an invalid argument', {
            arg: arg
        });
        throw new Error('ClientLicense constructor called with an invalid argument');
    }

    loadLicense.call(this);
}


// Public ClientLicense object methods
//

ClientLicense.prototype.hasLicense = function () {
    return this.license !== undefined;
};

ClientLicense.prototype.getClient = function () {
    if (this.client) {
        return this.client;
    }
    else if (this.license) {
        return Client.getClientByDocId(this.client_id, true, true);
    }
};

// Expire currently loaded client license
ClientLicense.prototype.expire = function (bypassProvisionalRenewal = true) {
    if (this.license) {
        try {
            // Make sure that client license is not already expired
            const now = new Date();

            if (this.status !== ClientLicense.status.expired.name) {
                const modifier =  {
                    $set: {
                        status: ClientLicense.status.expired.name,
                        expiredDate: now
                    }
                };

                let observeProvisionalRenewalUpdated = false;

                if (bypassProvisionalRenewal && this.observeProvisionalRenewal) {
                    // Make sure that provisional renewal will not be observed when license is expired
                    modifier.$set.observeProvisionalRenewal = false;
                    observeProvisionalRenewalUpdated = true;
                }

                const doExpire = () => {
                    Catenis.db.collection.ClientLicense.update({
                        _id: this.doc_id
                    }, modifier);

                    const actvClientLicenseExpired = this.status === ClientLicense.status.active.name;

                    // Update saved data
                    this.status = ClientLicense.status.expired.name;
                    this.expiredDate = now;

                    if (observeProvisionalRenewalUpdated) {
                        this.observeProvisionalRenewal = false;
                    }

                    updateLicenses.call(this, actvClientLicenseExpired ? this.doc_id : undefined);
                };

                if (this.noDbConcurrency) {
                    doExpire();
                }
                else {
                    // Execute code in critical section to avoid DB concurrency
                    clnLicDbCollCS.execute(doExpire);
                }
            }
        }
        catch (err) {
            // Log error condition and throw exception
            Catenis.logger.ERROR('Error while expiring client license (doc_id: %s).', this.doc_id, err);
            throw new Meteor.Error('ctn_clnlic_expire_error', 'Error while expiring client license: ' + err.toString())
        }
    }
    else {
        // No client license to expired. Log warning condition
        Catenis.logger.WARN('No client license to expired', this);
    }
};

// Provision a new client license
//
//  Arguments:
//   licenseLevel [String] - Level of license entry to use
//   licenseType [String] - (optional) Type of license entry to use
//   startDate [Object(Date)|String] - (optional) Designates the date when the license should start. Can be either a Date object
//                                      or a string representing a day in the the format 'YYYY-MM-DD'. If a Date object
//                                      is passed, it is converted to client's local time zone of. Otherwise, if a string
//                                      is passed, it is interpreted as a given date in the client's local time zone.
//                                      If not specified, the end date of the last active/provisioned license is used
//   options [Object] { - (optional)
//     validityDays: [Number], - (optional) Validity in days to be used in place of standard license validity in months
//     provisionalRenewal: [Boolean], - (optional, default:false) Indicates whether a provisional renewal period should be
//                                        provisioned instead of the regular license validity period
//     observeProvisionalRenewal: [Boolean], - (optional, default:true) Indicates whether a provisional renewal license should be
//                                              (automatically) created when this license expires, provided that the associated license supports it
//     compensateLateStart: [Boolean], - (optional, default:true) Indicates whether an extra day should be added to the license validity period to
//                                    compensate for a start date late in the day. Note that it only applies to when a
//                                    Date object is passed as the start date
//     timeThreshold: [String] - (optional, default:'12:00') Time of day, in the format 'HH:mm', from which the late start compensation should be applied
//   }
//
//  Return:
//   provisionedClientLicense_id [String] - Database doc/rec ID of newly created/provisioned client license
ClientLicense.prototype.provision = function (licenseLevel, licenseType, startDate, options) {
    // Make sure that a client is specified to provision the license
    if (this.client) {
        // Validate arguments
        const errArg = {};

        if (!License.isValidLevel(licenseLevel)) {
            errArg.licenseLevel = licenseLevel;
        }

        if (!License.isValidType(licenseType)) {
            errArg.licenseType = licenseType;
        }

        if (startDate && !isValidProvisionStartDate(startDate)) {
            errArg.startDate = startDate;
        }

        options = options || {};

        if (typeof options !== 'object') {
            errArg.options = options;
        }
        else {
            if (options.validityDays && !isValidProvisionValidityDays(options.validityDays)) {
                errArg['options.validityDays'] = options.validityDays;
            }

            if (options.timeThreshold && !isValidProvisionTimeThreshold(options.timeThreshold)) {
                errArg['options.timeThreshold'] = options.timeThreshold;
            }
        }

        if (Object.keys(errArg).length > 0) {
            const errArgs = Object.keys(errArg);

            Catenis.logger.ERROR(util.format('ClientLicense.provision method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
            throw new Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
        }

        options.provisionalRenewal = !Util.isUndefinedOrNull(options.provisionalRenewal) ? !!options.provisionalRenewal : false;
        options.observeProvisionalRenewal = !Util.isUndefinedOrNull(options.observeProvisionalRenewal) ? !!options.observeProvisionalRenewal : true;
        options.compensateLateStart = !Util.isUndefinedOrNull(options.compensateLateStart) ? !!options.compensateLateStart : true;

        // Retrieve license entry to use
        const license = License.getLicenseByLevelAndType(licenseLevel, licenseType);

        try {
            let provisionedClientLicense_id;

            const doProvision = () => {
                let licenseStartDate;

                if (!startDate) {
                    // Look for active/provisioned client license with the latest end date
                    const docLatestClientLicense = Catenis.db.collection.ClientLicense.findOne({
                        client_id: this.client.doc_id,
                        status: {
                            $ne: ClientLicense.status.expired.name
                        },
                        'validity.endDate': {
                            $exists: true
                        }
                    }, {
                        fields: {
                            validity: 1
                        },
                        sort: {
                            'validity.endDate': -1
                        }
                    });

                    if (docLatestClientLicense) {
                        licenseStartDate = docLatestClientLicense.validity.endDate;
                    }
                    else {
                        // Start date could not be determined. Use current date instead then
                        startDate = new Date();
                    }
                }

                if (!licenseStartDate) {
                    if (startDate instanceof Date) {
                        licenseStartDate = Util.startOfDayTimeZone(startDate, this.client.timeZone);
                    }
                    else {
                        licenseStartDate = Util.dayTimeZoneToDate(startDate, this.client.timeZone);
                    }
                }

                let licenseEndDate;

                // Check if an end date needs to be specified
                let validityPeriod = options.validityDays ? moment.duration(options.validityDays, 'd') : moment.duration(license.validityMonths, 'M');

                if (validityPeriod.valueOf() > 0 || options.provisionalRenewal) {
                    // Check if a provisional renewal period should be used instead
                    if (options.provisionalRenewal) {
                        if (!license.provisionalRenewalDays) {
                            // License does support provisional renewal.
                            //  Log error condition and throw an error
                            Catenis.logger.ERROR('Cannot provision provisional renewal license; provisional renewal not supported', this);
                            // noinspection ExceptionCaughtLocallyJS
                            throw new Meteor.Error('ctn_clnlic_no_prov_renewal', 'License does not support provisional renewal');
                        }

                        validityPeriod = moment.duration(license.provisionalRenewalDays, 'd');
                    }

                    // Check if late start should be compensated
                    if ((startDate instanceof Date) && options.compensateLateStart && moment(licenseStartDate)
                            .add(moment.duration(options.timeThreshold ? options.timeThreshold : cfgSettings.defLateStartCompTimeThreshold))
                            .diff(startDate) <= 0) {
                        // Add one extra day to compensate for late start
                        validityPeriod.add(1, 'd');
                    }

                    // Note: we adjust end date to client's time zone to account for possible change of client's time zone
                    //      especially for the case where the start date is gotten from the end date of a previous client license
                    licenseEndDate = Util.startOfDayTimeZone(moment(licenseStartDate).add(validityPeriod), this.client.timeZone);
                }

                // Prepare to save provisioned client license
                const validity = {
                    startDate: licenseStartDate
                };

                if (licenseEndDate) {
                    validity.endDate = licenseEndDate;
                }

                const docClientLicense = {
                    client_id: this.client.doc_id,
                    license_id: license.doc_id,
                    validity: validity,
                    provisionalRenewal: options.provisionalRenewal,
                };

                if (!docClientLicense.provisionalRenewal) {
                    docClientLicense.observeProvisionalRenewal = options.observeProvisionalRenewal;
                }

                docClientLicense.status = ClientLicense.status.provisioned.name;
                docClientLicense.expireRemindNotifySent = false;
                docClientLicense.provisionedDate = new Date();

                // Save provisioned client license
                provisionedClientLicense_id = Catenis.db.collection.ClientLicense.insert(docClientLicense);

                updateLicenses.call(this);
            };

            if (this.noDbConcurrency) {
                doProvision();
            }
            else {
                // Execute code in critical section to avoid DB concurrency
                clnLicDbCollCS.execute(doProvision);
            }

            // noinspection JSUnusedAssignment
            return provisionedClientLicense_id;
        }
        catch (err) {
            // Filter out no provisional renewal error
            if (!(err instanceof Meteor.Error) || err.error !== 'ctn_clnlic_no_prov_renewal') {
                // Error provisioning license. Log error condition and throw exception
                Catenis.logger.ERROR('Error provisioning license: %s.', util.inspect(this), err);
                throw new Meteor.Error('ctn_clnlic_provision_error', 'Error provisioning license: ' + err.toString());
            }
        }
    }
    else {
        // Log warning condition
        Catenis.logger.WARN('No client specified to provision license', this);
    }
};


// Module functions used to simulate private ClientLicense object methods
//  NOTE: these functions need to be bound to a ClientLicense object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

// Arguments:
//  noDbConcurrency [Boolean] - (optional, default:false) If set, indicates that the mechanism used to avoid database
//                               concurrency should NOT be used
//
// Note: If a given client license ID had been specified when object was instantiated,
//  load that given client license doc/rec. Otherwise, try to load the currently
//  active license for the specified client
function loadLicense(noDbConcurrency = false) {
    let selector;
    let options = {};

    if (this.client) {
        // Find most current active license
        selector = {
            client_id: this.client.doc_id,
            status: ClientLicense.status.active.name,
        };
        options.sort = {
            'validity.startDate': -1,
            activatedDate: -1
        }
    }
    else {
        selector = {
            _id: this.doc_id
        };
    }

    let docClientLicense;

    if (this.noDbConcurrency || noDbConcurrency) {
        docClientLicense = Catenis.db.collection.ClientLicense.findOne(selector, options);
    }
    else {
        // Execute code in critical section to avoid DB concurrency
        clnLicDbCollCS.execute(() => {
            docClientLicense = Catenis.db.collection.ClientLicense.findOne(selector, options);
        });
    }

    if (docClientLicense) {
        // Save client license data
        this.doc_id = docClientLicense._id;
        this.client_id = docClientLicense.client_id;
        this.license = License.getLicenseByDocId(docClientLicense.license_id);
        this.validity = docClientLicense.validity;
        this.provisionalRenewal = docClientLicense.provisionalRenewal;
        this.observeProvisionalRenewal = docClientLicense.observeProvisionalRenewal;
        this.status = docClientLicense.status;
        this.expireRemindNotifySent = docClientLicense.expireRemindNotifySent;
        this.provisionedDate = docClientLicense.provisionedDate;
        this.activatedDate = docClientLicense.activatedDate;
        this.expiredDate = docClientLicense.expiredDate;
    }
    else if (!this.client) {
        // No client license found. Log error e throw exception
        Catenis.logger.ERROR('No client license found with the specified database doc/rec ID', {
            doc_id: this.doc_id
        });
        throw new Meteor.Error('ctn_clnlic_not_found', util.format('No client license found with the specified database doc/rec ID (%s)', this.doc_id));
    }
    else {
        // Clear client license data to indicate that client has no currently active license
        this.doc_id = undefined;
        this.client_id = undefined;
        this.license = undefined;
        this.validity = undefined;
        this.provisionalRenewal = undefined;
        this.observeProvisionalRenewal = undefined;
        this.status = undefined;
        this.expireRemindNotifySent = undefined;
        this.provisionedDate = undefined;
        this.activatedDate = undefined;
        this.expiredDate = undefined;
    }
}

// For the specified client, activate license that should be activated and expired
//  licenses that should be expired
function updateLicenses(docIdActvClientLicenseExpired) {
    // Get client ID
    const client_id = this.client ? this.client.doc_id : (this.license ? this.client_id : undefined);

    if (client_id) {
        try {
            const dtNow = new Date();

            // Retrieve currently active client license
            let docActvClientLicense = Catenis.db.collection.ClientLicense.findOne({
                client_id: client_id,
                status: ClientLicense.status.active.name,
                'validity.startDate': {
                    $lte: dtNow
                },
                $or: [{
                    'validity.endDate': {
                        $exists: false
                    }
                }, {
                    'validity.endDate': {
                        $gt: dtNow
                    }
                }]
            }, {
                fields: {
                    _id: 1,
                    validity: 1,
                    provisionedDate: 1
                },
                sort: {
                    'validity.startDate': -1,
                    activatedDate: -1
                }
            });

            // Find client license that should be activated
            let selector = {
                client_id: client_id,
                status: ClientLicense.status.provisioned.name,
                $or: [{
                    'validity.endDate': {
                        $exists: false
                    }
                }, {
                    'validity.endDate': {
                        $gt: dtNow
                    }
                }]
            };

            if (docActvClientLicense) {
                selector.$and = [{
                    'validity.startDate': {
                        $lte: dtNow
                    }
                }, {
                    $or: [{
                        'validity.startDate': {
                            $gt: docActvClientLicense.validity.startDate
                        }
                    }, {
                        'validity.startDate': docActvClientLicense.validity.startDate,
                        provisionedDate: {
                            $gt: docActvClientLicense.provisionedDate
                        }
                    }]
                }];
            }
            else {
                selector['validity.startDate'] = {
                    $lte: dtNow
                };
            }

            const docClientLicenseToActivate = Catenis.db.collection.ClientLicense.findOne(selector, {
                fields: {
                    _id: 1,
                    validity: 1
                },
                sort: {
                    'validity.startDate': -1,
                    provisionedDate: -1
                }
            });

            let clientLicenseChanged = !!docIdActvClientLicenseExpired;

            if (docClientLicenseToActivate) {
                // Activate client license
                Catenis.db.collection.ClientLicense.update({
                    _id: docClientLicenseToActivate._id
                }, {
                    $set: {
                        status: ClientLicense.status.active.name,
                        activatedDate: dtNow
                    }
                });

                // Reset currently active client license
                docActvClientLicense = docClientLicenseToActivate;
                clientLicenseChanged = true;
            }

            // Expire obsolete provisioned client licenses
            Catenis.db.collection.ClientLicense.update({
                client_id: client_id,
                status: ClientLicense.status.provisioned.name,
                'validity.startDate': {
                    $lte: dtNow
                }
            }, {
                $set: {
                    status: ClientLicense.status.expired.name,
                    expiredDate: dtNow
                }
            }, {
                multi: true
            });

            // Look for obsolete active client licenses
            const docIdActvClientLicensesToExpire = [];
            let docIdPrevActvClientLicense = undefined;
            selector = {
                client_id: client_id,
                status: ClientLicense.status.active.name
            };

            if (docActvClientLicense) {
                selector._id = {
                    $ne: docActvClientLicense._id
                };
            }

            Catenis.db.collection.ClientLicense.find(selector, {
                fields: {
                    _id: 1,
                    validity: 1
                },
                sort: {
                    'validity.startDate': -1,
                    activatedDate: -1
                }
            }).forEach((doc, idx) => {
                if (idx === 0) {
                    docIdPrevActvClientLicense = doc._id;
                }

                docIdActvClientLicensesToExpire.push(doc._id);
            });

            if (docIdActvClientLicensesToExpire.length > 0) {
                // Expire obsolete active client licenses
                Catenis.db.collection.ClientLicense.update({
                    _id: {
                        $in: docIdActvClientLicensesToExpire
                    }
                }, {
                    $set: {
                        status: ClientLicense.status.expired.name,
                        expiredDate: dtNow
                    }
                }, {
                    multi: true
                });
            }

            if ((docIdPrevActvClientLicense || docIdActvClientLicenseExpired) && !docActvClientLicense) {
                // Client license has expired
                if (!docIdPrevActvClientLicense) {
                    docIdPrevActvClientLicense = docIdActvClientLicenseExpired;
                }
                else if (docIdActvClientLicenseExpired) {
                    // Identify which of the two expired licenses are more recent
                    docIdPrevActvClientLicense = Catenis.db.collection.ClientLicense.findOne({
                        _id: {
                            $in: [
                                docIdPrevActvClientLicense,
                                docIdActvClientLicenseExpired
                            ]
                        }
                    }, {
                        fields: {
                            _id: 1
                        },
                        sort: {
                            'validity.startDate': -1,
                            activatedDate: -1
                        }
                    })._id;
                }

                const args = [docIdPrevActvClientLicense];

                if (this.client) {
                    args.push(this.client);
                }

                licenseExpired.apply(undefined, args);
            }

            if (this.client) {
                // Re-load activate client license
                loadLicense.call(this, true);
            }

            if (clientLicenseChanged) {
                licenseChanged(this.client || client_id);
            }
        }
        catch (err) {
            // Log error condition
            Catenis.logger.ERROR('Error updating licenses for client (client_id: %s).', client_id, err);
        }
    }
    else {
        // No client specified. Log warning condition
        Catenis.logger.WARN('No client specified to update licenses', this);
    }
}

function sendExpirationReminderNotification() {
    if (this.hasLicense()) {
        Catenis.licExpRmndEmailNtfy.send(this);

        // Update client license database doc/rec indicating that e-mail notification has already been sent
        Catenis.db.collection.ClientLicense.update({
            _id: this.doc_id,
        }, {
            $set: {
                expireRemindNotifySent: true
            }
        });
    }
}


// ClientLicense function class (public) methods
//

ClientLicense.initialize = function () {
    Catenis.logger.TRACE('ClientLicense initialization');
    // Calculate time to start monitoring of client licenses
    const mtNow = moment.utc();
    const minToStart = cfgSettings.licenseMonitorInterval * Math.ceil(mtNow.minutes() / cfgSettings.licenseMonitorInterval);
    const mtToStart = mtNow.clone().minute(minToStart).second(0).millisecond(0).add(cfgSettings.offSetToMonitor, 'ms');

    // Set timer to start monitoring
    const msToStart = mtToStart.diff(mtNow, 'ms');
    Catenis.logger.DEBUG('Setting monitoring of client licenses to start %s', moment.duration(msToStart, 'ms').humanize(true));
    Meteor.setTimeout(startMonitoring, msToStart);
};


// ClientLicense function class (public) properties
//

ClientLicense.status = ClientLicenseShared.status;


// Definition of module (private) functions
//

function startMonitoring() {
    Catenis.logger.TRACE('About to start monitoring of client licenses');
    // Set recurring timer to do client license monitoring...
    monitorInterval = Meteor.setInterval(doMonitoring, cfgSettings.licenseMonitorInterval * 60000);

    // ... and do monitoring now
    doMonitoring();
}

function doMonitoring() {
    Catenis.logger.TRACE('Monitoring client licenses for updates and license expiration');
    try {
        // Execute code in critical section to avoid DB concurrency
        clnLicDbCollCS.execute(() => {
            updateAllLicenses();
        });

        checkAllLicensesAboutToExpired();
    }
    catch (err) {
        // Log error condition
        Catenis.logger.ERROR('Error while monitoring client licenses for updates and license expiration.', err);
    }
}

function updateAllLicenses() {
    try {
        const dtNow = new Date();

        // Retrieve currently active client licenses
        const docIdClnDocActvClientLicense = new Map();
        let lastDocIdClient;

        Catenis.db.collection.ClientLicense.find({
            status: ClientLicense.status.active.name,
            'validity.startDate': {
                $lte: dtNow
            },
            $or: [{
                'validity.endDate': {
                    $exists: false
                }
            }, {
                'validity.endDate': {
                    $gt: dtNow
                }
            }]
        }, {
            fields: {
                _id: 1,
                client_id: 1,
                validity: 1,
                provisionedDate: 1
            },
            sort: {
                client_id: 1,
                'validity.startDate': -1,
                activatedDate: -1
            }
        }).forEach((doc) => {
            if (!lastDocIdClient || lastDocIdClient !== doc.client_id) {
                lastDocIdClient = doc.client_id;
                docIdClnDocActvClientLicense.set(lastDocIdClient, doc);
            }
        });

        // Find client license that should be activated
        const docIdClnDocClientLicenseToActivate = new Map();
        lastDocIdClient = undefined;

        Catenis.db.collection.ClientLicense.find({
            status: ClientLicense.status.provisioned.name,
            'validity.startDate': {
                $lte: dtNow
            },
            $or: [{
                'validity.endDate': {
                    $exists: false
                }
            }, {
                'validity.endDate': {
                    $gt: dtNow
                }
            }]
        }, {
            fields: {
                _id: 1,
                client_id: 1,
                validity: 1,
                provisionedDate: 1
            },
            sort: {
                client_id: 1,
                'validity.startDate': -1,
                provisionedDate: -1
            }
        }).forEach((doc) => {
            // Filter out undesired docs/recs
            const docActvClientLicense = docIdClnDocActvClientLicense.get(doc.client_id);

            if (!docActvClientLicense || (doc.validity.startDate > docActvClientLicense.validity.startDate
                    || (Util.areDatesEqual(doc.validity.startDate, docActvClientLicense.validity.startDate)
                    && doc.provisionedDate > docActvClientLicense.provisionedDate))) {
                if (!lastDocIdClient || lastDocIdClient !== doc.client_id) {
                    lastDocIdClient = doc.client_id;
                    docIdClnDocClientLicenseToActivate.set(lastDocIdClient, doc);
                }
            }
        });
        Catenis.logger.DEBUG('>>>>>> Client licenses to activate: ', docIdClnDocClientLicenseToActivate);

        const docIdClnsClientLicenseChanged = [];

        if (docIdClnDocClientLicenseToActivate.size > 0) {
            // Activate client licenses
            const updateResult = Catenis.db.collection.ClientLicense.update({
                _id: {
                    $in: Array.from(docIdClnDocClientLicenseToActivate.values()).map(doc => doc._id)
                }
            }, {
                $set: {
                    status: ClientLicense.status.active.name,
                    activatedDate: dtNow
                }
            }, {
                multi: true
            });
            Catenis.logger.DEBUG('>>>>>> Result of collection update to activate client licenses: %s', updateResult);

            // Reset currently active client licenses
            for (let [docIdClient, docClientLicense] of docIdClnDocClientLicenseToActivate) {
                docIdClnDocActvClientLicense.set(docIdClient, docClientLicense);
                docIdClnsClientLicenseChanged.push(docIdClient);
            }
        }

        // Expire obsolete provisioned client licenses
        const updateResult = Catenis.db.collection.ClientLicense.update({
            status: ClientLicense.status.provisioned.name,
            'validity.startDate': {
                $lte: dtNow
            }
        }, {
            $set: {
                status: ClientLicense.status.expired.name,
                expiredDate: dtNow
            }
        }, {
            multi: true
        });
        Catenis.logger.DEBUG('>>>>>> Result of collection update to expire obsolete provisioned client licenses: %s', updateResult);

        // Look for obsolete active client licenses
        const docIdActvClientLicensesToExpire = [];
        const docIdClnDocIdPrevActvClientLicense = new Map();
        lastDocIdClient = undefined;

        Catenis.db.collection.ClientLicense.find({
            _id: {
                $nin: Array.from(docIdClnDocActvClientLicense.values()).map(doc => doc._id)
            },
            status: ClientLicense.status.active.name
        }, {
            fields: {
                _id: 1,
                client_id: 1,
                validity: 1
            },
            sort: {
                client_id: 1,
                'validity.startDate': -1,
                activatedDate: -1
            }
        }).forEach((doc) => {
            if (!lastDocIdClient || lastDocIdClient !== doc.client_id) {
                lastDocIdClient = doc.client_id;
                docIdClnDocIdPrevActvClientLicense.set(lastDocIdClient, doc._id);
            }

            docIdActvClientLicensesToExpire.push(doc._id);
        });
        Catenis.logger.DEBUG('>>>>>> Active client licenses to expire: ', docIdActvClientLicensesToExpire);

        if (docIdActvClientLicensesToExpire.length > 0) {
            // Expire obsolete active client licenses
            const updateResult = Catenis.db.collection.ClientLicense.update({
                _id: {
                    $in: docIdActvClientLicensesToExpire
                }
            }, {
                $set: {
                    status: ClientLicense.status.expired.name,
                    expiredDate: dtNow
                }
            }, {
                multi: true
            });
            Catenis.logger.DEBUG('>>>>>> Result of collection update to expire active client licenses: %s', updateResult);
        }

        for (let [docIdClient, docIdPrevActvClientLicense] of docIdClnDocIdPrevActvClientLicense) {
            if (!docIdClnDocActvClientLicense.has(docIdClient)) {
                // Client license has expired
                licenseExpired(docIdPrevActvClientLicense);
            }
        }

        docIdClnsClientLicenseChanged.forEach((client_id) => {
            licenseChanged(client_id);
        });
    }
    catch (err) {
        // Log error condition
        Catenis.logger.ERROR('Error updating licenses for all clients.', err);
    }
}

function checkAllLicensesAboutToExpired() {
    // Determine limit end date
    const limitEndDate = moment().add(cfgSettings.daysToExpireForReminder, 'd').toDate();

    Catenis.db.collection.ClientLicense.find({
        status: ClientLicense.status.active.name,
        expireRemindNotifySent: false,
        provisionalRenewal: false,
        'validity.endDate': {
            $lte: limitEndDate
        }
    }, {
        fields: {
            _id: 1
        }
    }).fetch().forEach((doc) => {
        licenseAboutToExpire(doc._id);
    });
}

// Take proper measures for when client license has expired (with no renewal already provisioned)
//
//  Arguments:
//   clientLicense_id [String] - ID of ClientLicense doc/rec that had been expired
//   client [Object(Client)] - (optional) Client object to which expired client belongs
function licenseExpired(clientLicense_id, client) {
    // Instantiate client license that had been expired
    const expiredClientLicense = new ClientLicense(clientLicense_id, true);

    // Make sure that client has no currently active license
    client = client || expiredClientLicense.getClient();
    const clientLicense = new ClientLicense(client, true);

    if (!clientLicense.hasLicense()) {
        // Check if a provisional renewal license should be provisioned
        let provisionalRenewalProvisioned = false;

        if (expiredClientLicense.observeProvisionalRenewal && expiredClientLicense.license.provisionalRenewalDays && expiredClientLicense.validity.endDate) {
            // Make sure that validity period of expired license has just ended (less than 24 hours ago)
            const mtNow = moment();
            const diffDays = mtNow.diff(expiredClientLicense.validity.endDate, 'd', true);

            if (diffDays >= 0 && diffDays < 1) {
                // Provision provisional renewal license
                clientLicense.provision(expiredClientLicense.license.level, expiredClientLicense.license.type, expiredClientLicense.validity.endDate, {
                    provisionalRenewal: true
                });
                provisionalRenewalProvisioned = true;
            }
            else {
                // Provisional renewal not provisioned because license expiration time is not within expected range.
                //  Log warning condition
                Catenis.logger.WARN('Provisional renewal not provisioned because license expiration time is not within expected range', {
                    expiredClientLicense: expiredClientLicense
                });
            }
        }

        // Notify client
        if (provisionalRenewalProvisioned) {
            // Warn that license is overdue
            Catenis.licOvrdEmailNtfy.send(clientLicense);
        }
        else {
            // Warn that license has expired
            Catenis.licExpEmailNtfy.send(expiredClientLicense);
        }
    }
}

// Take proper measures for when a client license is about to expire
//
//  Arguments:
//   clientLicense_id [String] - ID of ClientLicense doc/rec that is about to expire
function licenseAboutToExpire(clientLicense_id) {
    sendExpirationReminderNotification.call(new ClientLicense(clientLicense_id));
}

// Take proper measures for when license of client has changed
//
//  Arguments:
//   client [Object(Client)|String] - Either the a Client object or a client database doc/rec ID
function licenseChanged(client) {
    if (typeof client === 'string') {
        // Assume that it is actually a client database doc/rec ID that has been passed
        client = Client.getClientByDocId(client, true, true);
    }

    if (!client.clientLicense) {
        client.clientLicense = new ClientLicense(client, true);
    }

    client.conformNumberOfDevices();
}

function isValidProvisionStartDate(startDate) {
    return (startDate instanceof Date) || (typeof startDate === 'string' && moment(startDate, 'YYYY-MM-DD', true).isValid());
}

function isValidProvisionTimeThreshold(time) {
    return typeof time === 'string' && moment(time, 'HH:mm', true).isValid();
}

function isValidProvisionValidityDays(val) {
    return Number.isInteger(val) && val > 0;
}


// Module code
//

// Lock function class
Object.freeze(ClientLicense);
