/**
 * Created by claudio on 2018-10-04.
 */

//console.log('[CommonClientLicenseUI.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
//import config from 'config';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from '../Catenis';
import { License } from '../License';

// Config entries
/*const config_entryConfig = config.get('config_entry');

// Configuration settings
const cfgSettings = {
    property: config_entryConfig.get('property_name')
};*/


// Definition of function classes
//

// CommonClientLicenseUI function class
export function CommonClientLicenseUI() {
}


// Public CommonClientLicenseUI object methods
//

/*CommonClientLicenseUI.prototype.pub_func = function () {
};*/


// Module functions used to simulate private CommonClientLicenseUI object methods
//  NOTE: these functions need to be bound to a CommonClientLicenseUI object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// CommonClientLicenseUI function class (public) methods
//

// Publication auxiliary method for including License database doc/recs associated with all ClientLicense
//  database doc/recs for a given client
//
//  NOTE: this method should be called via the predefined function method .call() passing the context (this)
//      of the caller publication function (i.e. method.call(this, ...))
CommonClientLicenseUI.clientAllClientLicenseLicenses = function (publicationName, client_id, docIdCounter) {
    docIdCounter = docIdCounter || new Map();

    // Look for License database docs/recs associated with all ClientLicense database docs/recs for a given client
    const observeHandle = Catenis.db.collection.ClientLicense.find({
        client_id: client_id
    }, {
        fields: {
            _id: 1,
            license_id: 1
        }
    }).observe({
        added: (doc) => {
            // Check if doc/rec has not yet been sent to other party
            if (!docIdCounter.has(doc.license_id) || docIdCounter.get(doc.license_id) === 0) {
                const docLicense = Catenis.db.collection.License.findOne({
                    _id: doc.license_id
                }, {
                    fields: {
                        _id: 1,
                        level: 1,
                        order: 1,
                        type: 1,
                        revision: 1,
                        maximumDevices: 1,
                        status: 1
                    }
                });

                this.added('License', docLicense._id, {
                    level: docLicense.level,
                    order: docLicense.order,
                    type: docLicense.type,
                    revision: docLicense.revision,
                    maximumDevices: docLicense.maximumDevices,
                    status: docLicense.status
                });

                // Indicate that doc/rec has been sent
                docIdCounter.set(doc.license_id, 1);
            }
            else {
                // Doc/rec already sent. Just increment counter
                docIdCounter.set(doc.license_id, docIdCounter.get(doc.license_id) + 1);
            }
        },
        changed: (newDoc, oldDoc) => {
            // Only do anything if License database doc/rec has changed.
            //  Note: this should never happen, but we do it for robustness
            if (newDoc.license_id !== oldDoc.license_id) {
                // Process exclusion first
                let counter;

                if (docIdCounter.has(oldDoc.license_id) && (counter = docIdCounter.get(oldDoc.license_id)) > 0) {
                    // Decrement counter
                    docIdCounter.set(oldDoc.license_id, --counter);

                    if (counter === 0) {
                        // Exclude sent doc/rec
                        this.removed('License', oldDoc.license_id);
                    }
                }
                else {
                    // Inconsistent state. Log error
                    Catenis.logger.ERROR('Inconsistent License database doc/rec counter in \'%s\' publication, \'changed\' event of observe #2', publicationName, {
                        oldDoc: oldDoc,
                        newDoc: newDoc,
                        docIdCounter: docIdCounter
                    })
                }

                // Process addition now

                // Check if doc/rec has not yet been sent to other party
                if (!docIdCounter.has(newDoc.license_id) || docIdCounter.get(newDoc.license_id) === 0) {
                    const docLicense = Catenis.db.collection.License.findOne({
                        _id: newDoc.license_id
                    }, {
                        fields: {
                            _id: 1,
                            level: 1,
                            order: 1,
                            type: 1,
                            revision: 1,
                            maximumDevices: 1,
                            status: 1
                        }
                    });

                    this.added('License', docLicense._id, {
                        level: docLicense.level,
                        order: docLicense.order,
                        type: docLicense.type,
                        revision: docLicense.revision,
                        maximumDevices: docLicense.maximumDevices,
                        status: docLicense.status
                    });

                    // Indicate that doc/rec has been sent
                    docIdCounter.set(newDoc.license_id, 1);
                }
                else {
                    // Doc/rec already sent. Just increment counter
                    docIdCounter.set(newDoc.license_id, docIdCounter.get(newDoc.license_id) + 1);
                }
            }
        },
        removed: (doc) => {
            let counter;

            if (docIdCounter.has(doc.license_id) && (counter = docIdCounter.get(doc.license_id)) > 0) {
                // Decrement counter
                docIdCounter.set(doc.license_id, --counter);

                if (counter === 0) {
                    // Exclude sent doc/rec
                    this.removed('License', doc.license_id);
                }
            }
            else {
                // Inconsistent state. Log error
                Catenis.logger.ERROR('Inconsistent License database doc/rec counter in \'%s\' publication, \'removed\' event of observe #2', publicationName, {
                    oldDoc: doc,
                    docIdCounter: docIdCounter
                })
            }
        }
    });

    this.onStop(() => {
        observeHandle.stop();
    });
};


// CommonClientLicenseUI function class (public) properties
//

/*CommonClientLicenseUI.prop = {};*/


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(CommonClientLicenseUI);
