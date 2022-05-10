/**
 * Created by Claudio on 2018-10-13.
 */

//console.log('[ClientPaidServiceDetailsTemplate.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
//import config from 'config'
// Meteor packages
//import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';

// References code in other (Catenis) modules on the client
import { Catenis } from '../ClientCatenis';
import { ClientUtil } from '../ClientUtil';

// Import template UI
import './ClientPaidServiceDetailsTemplate.html';

// Import dependent templates


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

Template.clientPaidServiceDetails.onCreated(function () {
    // Subscribe to receive database docs/recs updates
    this.clntSinglePaidServiceSubs = this.subscribe('clientSinglePaidService', this.data.service_id);
});

Template.clientPaidServiceDetails.onDestroyed(function () {
    if (this.clntSinglePaidServiceSubs) {
        this.clntSinglePaidServiceSubs.stop();
    }
});

Template.clientPaidServiceDetails.events({
});

Template.clientPaidServiceDetails.helpers({
    paidService() {
        return Catenis.db.collection.PaidService.findOne();
    },
    formatCurrency(amount) {
        return ClientUtil.formatCurrency(amount);
    },
    formatCoins(amount) {
        return ClientUtil.formatCoins(amount);
    },
    formatServiceCredits(amount) {
        return ClientUtil.formatCatenisServiceCredits(amount);
    },
    hasVariablePrice(paidService) {
        return paidService.variable !== undefined && paidService.variable !== null;
    }
});
