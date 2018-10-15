/**
 * Created by claudio on 2018-10-13.
 */

//console.log('[PaidServicesUI.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import _und from 'underscore';
// Meteor packages
import { Meteor } from 'meteor/meteor';
import { Roles } from 'meteor/alanning:roles';

// References code in other (Catenis) modules
import { Catenis } from '../Catenis';
import {
    getServicePrice,
    Service
} from '../Service';
import { BcotPrice } from '../BcotPrice';
import { BitcoinPrice } from '../BitcoinPrice';
import { BitcoinFees } from '../BitcoinFees';


// Definition of function classes
//

// PaidServicesUI function class
export function PaidServicesUI() {
}


// Public PaidServicesUI object methods
//

/*PaidServicesUI.prototype.pub_func = function () {
};*/


// Module functions used to simulate private PaidServicesUI object methods
//  NOTE: these functions need to be bound to a PaidServicesUI object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// PaidServicesUI function class (public) methods
//

PaidServicesUI.initialize = function () {
    Catenis.logger.TRACE('PaidServicesUI initialization');

    // Declaration of publications
    Meteor.publish('paidServices', function () {
        if (Roles.userIsInRole(this.userId, 'sys-admin')) {
            let paidServices = retrieveCurrentPaidServices();

            // Set initial service price docs/recs
            paidServices.forEach((doc) => {
                this.added('PaidService', doc.id, doc.fields);
            });

            this.ready();

            const checkPaidServiceChanged = () => {
                const currPaidServices = retrieveCurrentPaidServices();

                for (let idx = 0, limit = currPaidServices.length; idx < limit; idx++) {
                    const origDoc = paidServices[idx];

                    const changedFields = paidServiceChangedFields(paidServices[idx], currPaidServices[idx]);

                    if (changedFields) {
                        this.changed('PaidService', origDoc.id, changedFields);
                    }
                }

                paidServices = currPaidServices;
            };

            // Set up listeners to monitor changes in values that are used to calculate service price
            Catenis.bcotPrice.on(BcotPrice.notifyEvent.new_bcot_price.name, checkPaidServiceChanged);
            Catenis.btcPrice.on(BitcoinPrice.notifyEvent.new_bitcoin_price.name, checkPaidServiceChanged);
            Catenis.bitcoinFees.on(BitcoinFees.notifyEvent.bitcoin_fees_changed.name, checkPaidServiceChanged);

            this.onStop(() => {
                Catenis.bcotPrice.removeListener(BcotPrice.notifyEvent.new_bcot_price.name, checkPaidServiceChanged);
                Catenis.btcPrice.removeListener(BitcoinPrice.notifyEvent.new_bitcoin_price.name, checkPaidServiceChanged);
                Catenis.bitcoinFees.removeListener(BitcoinFees.notifyEvent.bitcoin_fees_changed.name, checkPaidServiceChanged);
            });
        }
        else {
            // User not logged in or not a system administrator.
            //  Make sure that publication is not started and throw exception
            this.stop();
            throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
        }
    });

    Meteor.publish('singlePaidService', function (serviceId) {
        if (Roles.userIsInRole(this.userId, 'sys-admin')) {
            const clientPaidService = Service.clientPaidService[serviceId];

            if (clientPaidService) {
                let paidServiceDoc = getCurrentPaidServiceDoc(clientPaidService);

                // Set initial service price docs/recs
                this.added('PaidService', paidServiceDoc.id, paidServiceDoc.fields);

                this.ready();

                const checkPaidServiceChanged = () => {
                    const currPaidServiceDoc = getCurrentPaidServiceDoc(clientPaidService);

                    const changedFields = paidServiceChangedFields(paidServiceDoc, currPaidServiceDoc);

                    if (changedFields) {
                        this.changed('PaidService', paidServiceDoc.id, changedFields);
                    }

                    paidServiceDoc = currPaidServiceDoc;
                };

                // Set up listeners to monitor changes in values that are used to calculate service price
                Catenis.bcotPrice.on(BcotPrice.notifyEvent.new_bcot_price.name, checkPaidServiceChanged);
                Catenis.btcPrice.on(BitcoinPrice.notifyEvent.new_bitcoin_price.name, checkPaidServiceChanged);
                Catenis.bitcoinFees.on(BitcoinFees.notifyEvent.bitcoin_fees_changed.name, checkPaidServiceChanged)

                this.onStop(() => {
                    Catenis.bcotPrice.removeListener(BcotPrice.notifyEvent.new_bcot_price.name, checkPaidServiceChanged);
                    Catenis.btcPrice.removeListener(BitcoinPrice.notifyEvent.new_bitcoin_price.name, checkPaidServiceChanged);
                    Catenis.bitcoinFees.removeListener(BitcoinFees.notifyEvent.bitcoin_fees_changed.name, checkPaidServiceChanged)
                });
            }
            else {
                this.ready();
            }
        }
        else {
            // User not logged in or not a system administrator.
            //  Make sure that publication is not started and throw exception
            this.stop();
            throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
        }
    });
};


// PaidServicesUI function class (public) properties
//

/*PaidServicesUI.prop = {};*/


// Definition of module (private) functions
//

function getCurrentPaidServiceDoc(clientPaidService) {
    const doc = {
        id: clientPaidService.name,
        fields: {
            service: clientPaidService.label,
            description: clientPaidService.description
        }
    };

    _und.extend(doc.fields, getServicePrice(clientPaidService));

    return doc;
}

function retrieveCurrentPaidServices() {
    const docs = [];

    Object.values(Service.clientPaidService).forEach((clientPaidService) => {
        docs.push(getCurrentPaidServiceDoc(clientPaidService));
    });

    return docs;
}

function paidServiceChangedFields(origDoc, newDoc) {
    if (!_und.isEqual(origDoc.fields, newDoc.fields)) {
        const changedFields = {};

        Object.keys(origDoc.fields).forEach((key) => {
            const newField = newDoc.fields[key];

            if (!_und.isEqual(origDoc.fields[key], newField)) {
                changedFields[key] = newField;
            }
        });

        return changedFields;
    }
}


// Module code
//

// Lock function class
Object.freeze(PaidServicesUI);
