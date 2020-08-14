/**
 * Created by claudio on 2018-10-16.
 */

//console.log('[CommonPaidServicesUI.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import _und from 'underscore';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from '../Catenis';
import { Billing } from '../Billing';
import { PaidService } from '../PaidService';

// Definition of function classes
//

// CommonPaidServicesUI function class
export function CommonPaidServicesUI() {
}


// Public CommonPaidServicesUI object methods
//

/*CommonPaidServicesUI.prototype.pub_func = function () {
};*/


// Module functions used to simulate private CommonPaidServicesUI object methods
//  NOTE: these functions need to be bound to a CommonPaidServicesUI object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// CommonPaidServicesUI function class (public) methods
//

// Publication auxiliary method for retrieving paid services info
//
//  NOTE: this method should be called via the predefined function method .call() passing the context (this)
//      of the caller publication function (i.e. method.call(this, ...))
CommonPaidServicesUI.paidServices = function () {
    let paidServices = retrieveAllPaidServices();

    // Set initial service price docs/recs
    paidServices.forEach((doc) => {
        this.added('PaidService', doc.id, doc.fields);
    });

    this.ready();

    const checkPaidServiceChanged = () => {
        const currPaidServices = retrieveAllPaidServices();

        for (let idx = 0, limit = currPaidServices.length; idx < limit; idx++) {
            const origDoc = paidServices[idx];

            const changedFields = paidServiceChangedFields(paidServices[idx], currPaidServices[idx]);

            if (changedFields) {
                this.changed('PaidService', origDoc.id, changedFields);
            }
        }

        paidServices = currPaidServices;
    };

    // Set up listener to monitor changes in paid services cost
    Catenis.paidService.on(PaidService.notifyEvent.services_cost_changed.name, checkPaidServiceChanged);

    this.onStop(() => {
        Catenis.paidService.removeListener(PaidService.notifyEvent.services_cost_changed.name, checkPaidServiceChanged);
    });
};

// Publication auxiliary method for retrieving the names of the paid services
//
//  NOTE: this method should be called via the predefined function method .call() passing the context (this)
//      of the caller publication function (i.e. method.call(this, ...))
CommonPaidServicesUI.paidServiceNames = function () {
    let paidServices = retrievePaidServiceNames();

    // Set initial service price docs/recs
    paidServices.forEach((doc) => {
        this.added('PaidService', doc.id, doc.fields);
    });

    this.ready();
};

// Publication auxiliary method for retrieving a single paid service record
//
//  NOTE: this method should be called via the predefined function method .call() passing the context (this)
//      of the caller publication function (i.e. method.call(this, ...))
CommonPaidServicesUI.singlePaidService = function (serviceName) {
    let paidServiceDoc = retrieveSinglePaidService(serviceName);

    if (paidServiceDoc) {
        // Set initial service price docs/recs
        this.added('PaidService', paidServiceDoc.id, paidServiceDoc.fields);

        this.ready();

        const checkPaidServiceChanged = () => {
            const currPaidServiceDoc = retrieveSinglePaidService(serviceName);

            const changedFields = paidServiceChangedFields(paidServiceDoc, currPaidServiceDoc);

            if (changedFields) {
                this.changed('PaidService', paidServiceDoc.id, changedFields);
            }

            paidServiceDoc = currPaidServiceDoc;
        };

        // Set up listener to monitor changes in paid services cost
        Catenis.paidService.on(PaidService.notifyEvent.services_cost_changed.name, checkPaidServiceChanged);

        this.onStop(() => {
            Catenis.paidService.removeListener(PaidService.notifyEvent.services_cost_changed.name, checkPaidServiceChanged);
        });
    }
    else {
        this.ready();
    }
};

// Publication auxiliary method for retrieving the name of the service associated with a specific billing record
//
//  NOTE: this method should be called via the predefined function method .call() passing the context (this)
//      of the caller publication function (i.e. method.call(this, ...))
CommonPaidServicesUI.billingPaidServiceName = function (billing_id) {
    const docBilling = Catenis.db.collection.Billing.findOne({
        _id: billing_id,
        type: Billing.docType.original.name,
    }, {
        fields: {
            service: 1
        }
    });

    if (docBilling) {
        const serviceInfo = PaidService.serviceInfo(docBilling.service);

        if (serviceInfo) {
            this.added('PaidService', docBilling.service, {
                service: serviceInfo.label
            });
        }
    }

    this.ready();
};


// CommonPaidServicesUI function class (public) properties
//

/*CommonPaidServicesUI.prop = {};*/


// Definition of module (private) functions
//

function paidServiceDoc(serviceName, serviceCost) {
    const serviceInfo = PaidService.serviceInfo(serviceName);

    return {
        id: serviceName,
        fields: {
            service: serviceInfo.label,
            description: serviceInfo.description,
            ...serviceCost
        }
    }
}

function retrieveAllPaidServices() {
    const servicesCost = Catenis.paidService.servicesCost();

    return Object.keys(servicesCost).reduce((docs, serviceName) => {
        docs.push(paidServiceDoc(serviceName, servicesCost[serviceName]));

        return docs;
    }, []);
}

function retrieveSinglePaidService(serviceName) {
    return paidServiceDoc(serviceName, Catenis.paidService.serviceCost(serviceName));
}

function retrievePaidServiceNames() {
    return Object.keys(PaidService.servicesInfo).reduce((docs, serviceName) => {
        docs.push({
            id: serviceName,
            fields: {
                service: PaidService.servicesInfo[serviceName].label
            }
        });

        return docs;
    }, []);
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
Object.freeze(CommonPaidServicesUI);
