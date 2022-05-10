/**
 * Created by claudio on 2020-08-13
 */

//console.log('[PaidServiceHistoryDetailsTemplate.js]: This code just ran.');

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
import { Template } from 'meteor/templating';

// References code in other (Catenis) modules on the client
import { Catenis } from '../ClientCatenis';
import { ClientUtil } from '../ClientUtil';

// Import template UI
import './PaidServiceHistoryDetailsTemplate.html';

// Import dependent templates


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

Template.paidServiceHistoryDetails.onCreated(function () {
    // Subscribe to receive database docs/recs updates
    this.singlePaidServiceHistorySubs = this.subscribe('singlePaidServiceHistory', this.data.service_id, new Date(parseInt(this.data.timestamp)));
    this.singlePaidServiceInfoSubs = this.subscribe('singlePaidServiceInfo', this.data.service_id);
});

Template.paidServiceHistoryDetails.onDestroyed(function () {
    if (this.singlePaidServiceHistorySubs) {
        this.singlePaidServiceHistorySubs.stop();
    }

    if (this.singlePaidServiceInfoSubs) {
        this.singlePaidServiceInfoSubs.stop();
    }
});

Template.paidServiceHistoryDetails.events({
});

Template.paidServiceHistoryDetails.helpers({
    backQueryString() {
        const retParams = Template.instance().data.retParams;

        return retParams ? '?' + retParams : undefined;
    },
    historyEntry() {
        return Catenis.db.collection.ServicesCostHistory.findOne();
    },
    paidService() {
        return Catenis.db.collection.PaidService.findOne();
    },
    formatDate(date) {
        return moment(date).format('lll');
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
    objProperty(obj, propName) {
        return obj[propName];
    },
    hasVariablePrice(serviceCost) {
        return serviceCost.variable !== undefined && serviceCost.variable !== null;
    }
});
