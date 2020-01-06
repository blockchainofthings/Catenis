/**
 * Created by claudio on 2018-10-16.
 */

//console.log('[BillingEntryTemplate.js]: This code just ran.');

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

// References code in other (Catenis) modules on the client
import { Catenis } from '../ClientCatenis';
import { ClientUtil } from '../ClientUtil';

// Import template UI
import './BillingEntryTemplate.html';

// Import dependent templates


// Definition of module (private) functions
//


// Module code
//

Template.billingEntry.onCreated(function () {
    // Subscribe to receive database docs/recs updates
    this.clientRecordSubs = this.subscribe('clientRecord', this.data.client_id);
    this.billingRecordSubs = this.subscribe('billingRecord', this.data.billing_id);
    this.billingDeviceSubs = this.subscribe('billingDevice', this.data.billing_id);
    this.billingPaidServiceNameSubs = this.subscribe('billingPaidServiceName', this.data.billing_id);
});

Template.billingEntry.onDestroyed(function () {
    if (this.clientRecordSubs) {
        this.clientRecordSubs.stop();
    }

    if (this.billingRecordSubs) {
        this.billingRecordSubs.stop();
    }

    if (this.billingDeviceSubs) {
        this.billingDeviceSubs.stop();
    }

    if (this.billingPaidServiceNameSubs) {
        this.billingPaidServiceNameSubs.stop();
    }
});

Template.billingEntry.events({
});

Template.billingEntry.helpers({
    backQueryString() {
        const retParams = Template.instance().data.retParams;

        return retParams ? '?' + retParams : undefined;
    },
    client() {
        return Catenis.db.collection.Client.findOne({_id: Template.instance().data.client_id});
    },
    clientTitle(client) {
        return client.props.name || client.clientId;
    },
    billing() {
        return Catenis.db.collection.Billing.findOne({_id: Template.instance().data.billing_id});
    },
    isOffChainMsgServiceBilling(billing) {
        return !!billing.offChainMsgServiceData;
    },
    actualServiceCost(billing) {
        let fee;

        if (billing.serviceTx) {
            fee = billing.serviceTx.fee;

            if (billing.serviceTx.complementaryTx) {
                fee += billing.serviceTx.complementaryTx.feeShare;
            }
        }
        else if (billing.offChainMsgServiceData) {
            if (billing.offChainMsgServiceData.msgEnvelope && billing.offChainMsgServiceData.msgEnvelope.settlementTx) {
                if (fee === undefined) {
                    fee = 0;
                }

                fee += billing.offChainMsgServiceData.msgEnvelope.settlementTx.feeShare;
            }

            if (billing.offChainMsgServiceData.msgReceipt && billing.offChainMsgServiceData.msgReceipt.settlementTx) {
                if (fee === undefined) {
                    fee = 0;
                }

                fee += billing.offChainMsgServiceData.msgReceipt.settlementTx.feeShare;
            }
        }

        if (billing.servicePaymentTx && billing.servicePaymentTx.confirmed) {
            if (fee === undefined) {
                fee = 0;
            }

            fee += billing.servicePaymentTx.feeShare;
        }

        return fee;
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
