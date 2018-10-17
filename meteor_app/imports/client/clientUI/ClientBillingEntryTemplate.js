/**
 * Created by claudio on 2018-10-16.
 */

//console.log('[ClientBillingEntryTemplate.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
//import moment from 'moment-timezone';
// Meteor packages
//import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';
import { FlowRouter } from 'meteor/kadira:flow-router';

// References code in other (Catenis) modules on the client
import { Catenis } from '../ClientCatenis';
import { ClientUtil } from '../ClientUtil';

// Import template UI
import './ClientBillingEntryTemplate.html';

// Import dependent templates


// Definition of module (private) functions
//


// Module code
//

Template.clientBillingEntry.onCreated(function () {
    // Subscribe to receive database docs/recs updates
    this.currClntBillingRecordSubs = this.subscribe('currentClientBillingRecord', this.data.billing_id);
    this.currClntBillingDeviceSubs = this.subscribe('currentClientBillingDevice', this.data.billing_id);
    this.clntBillingPaidServiceNameSubs = this.subscribe('clientBillingPaidServiceName', this.data.billing_id);
});

Template.clientBillingEntry.onDestroyed(function () {
    if (this.currClntBillingRecordSubs) {
        this.currClntBillingRecordSubs.stop();
    }

    if (this.currClntBillingDeviceSubs) {
        this.currClntBillingDeviceSubs.stop();
    }

    if (this.clntBillingPaidServiceNameSubs) {
        this.clntBillingPaidServiceNameSubs.stop();
    }
});

Template.clientBillingEntry.events({
});

Template.clientBillingEntry.helpers({
    returnQueryString() {
        const retParams = Template.instance().data.retParams;

        return retParams ? '?' + retParams : undefined;
    },
    billing() {
        return Catenis.db.collection.Billing.findOne({_id: Template.instance().data.billing_id});
    },
    deviceName(deviceId) {
        const docDevice = Catenis.db.collection.Device.findOne({deviceId: deviceId});

        if (docDevice) {
            return docDevice.props.name;
        }
    },
    serviceName(service_id) {
        return Catenis.db.collection.PaidService.findOne({_id: service_id}).service;
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
