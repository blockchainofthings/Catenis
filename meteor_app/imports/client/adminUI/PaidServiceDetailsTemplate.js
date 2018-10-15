/**
 * Created by Claudio on 2018-10-13.
 */

//console.log('[PaidServiceDetailsTemplate.js]: This code just ran.');

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
import './PaidServiceDetailsTemplate.html';

// Import dependent templates


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

Template.paidServiceDetails.onCreated(function () {
    // Subscribe to receive database docs/recs updates
    this.singlePaidServiceSubs = this.subscribe('singlePaidService', this.data.service_id);
});

Template.paidServiceDetails.onDestroyed(function () {
    if (this.singlePaidServiceSubs) {
        this.singlePaidServiceSubs.stop();
    }
});

Template.paidServiceDetails.events({
});

Template.paidServiceDetails.helpers({
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
    }
});
