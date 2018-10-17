/**
 * Created by claudio on 2016-05-30.
 */

//console.log('[CommonServiceBillingUI.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import moment from 'moment-timezone';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from '../Catenis';
import { Billing } from '../Billing';


// Definition of function classes
//

// CommonServiceBillingUI function class
export function CommonServiceBillingUI() {
}


// Public CommonServiceBillingUI object methods
//

/*CommonServiceBillingUI.prototype.pub_func = function () {
};*/


// Module functions used to simulate private CommonServiceBillingUI object methods
//  NOTE: these functions need to be bound to a CommonServiceBillingUI object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// CommonServiceBillingUI function class (public) methods
//

// Publication auxiliary method for retrieving billing records for a given client
//
//  NOTE: this method should be called via the predefined function method .call() passing the context (this)
//      of the caller publication function (i.e. method.call(this, ...))
CommonServiceBillingUI.clientBillingReport = function (docClient, deviceId, startDate, endDate) {
    const selector = {
        type: Billing.docType.original.name,
        clientId: docClient.clientId
    };

    if (deviceId) {
        selector.deviceId = deviceId;
    }

    const serviceDateConds = [];

    if (startDate) {
        const mtStartDate = moment(startDate, moment.ISO_8601, true);

        if (mtStartDate.isValid()) {
            serviceDateConds.push({
                $gte: mtStartDate.startOf('day').toDate()
            });
        }
    }

    if (endDate) {
        const mtEndDate = moment(endDate, moment.ISO_8601, true);

        if (mtEndDate.isValid()) {
            serviceDateConds.push({
                $lte: mtEndDate.endOf('day').toDate()
            });
        }
    }

    if (serviceDateConds.length === 1) {
        selector.serviceDate = serviceDateConds[0];
    }
    else if (serviceDateConds.length > 1) {
        selector.$and = [{
            serviceDate: serviceDateConds[0]
        }, {
            serviceDate: serviceDateConds[1]
        }];
    }

    return Catenis.db.collection.Billing.find(selector, {
        fields: {
            _id: 1,
            clientId: 1,
            deviceId: 1,
            billingMode: 1,
            service: 1,
            serviceDate: 1,
            finalServicePrice: 1
        },
        sort: {
            serviceDate: 1
        }
    });
};


// CommonServiceBillingUI function class (public) properties
//

/*CommonServiceBillingUI.prop = {};*/


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(CommonServiceBillingUI);
