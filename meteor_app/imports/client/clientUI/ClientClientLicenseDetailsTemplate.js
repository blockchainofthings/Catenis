/**
 * Created by claudio on 2018-10-10.
 */

//console.log('[ClientClientLicenseDetailsTemplate.js]: This code just ran.');

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
import { ReactiveDict } from 'meteor/reactive-dict';

// References code in other (Catenis) modules on the client
import { Catenis } from '../ClientCatenis';
import { ClientUtil } from '../ClientUtil';
import { ClientLicenseShared } from '../../both/ClientLicenseShared';

// Import template UI
import './ClientClientLicenseDetailsTemplate.html';

// Import dependent templates


// Definition of module (private) functions
//


// Module code
//

Template.clientClientLicenseDetails.onCreated(function () {
    this.state = new ReactiveDict();

    this.state.set('infoMsg', undefined);
    this.state.set('infoMsgType', 'info');

    this.state.set('aboutToExpire', false);

    // Subscribe to receive database docs/recs updates
    this.currentClient = this.subscribe('currentClient');

    this.currClntSingleClientLicenseSubs = this.subscribe('currentClientSingleClientLicense', this.data.clientLicense_id, () => {
        const docClientLicense = Catenis.db.collection.ClientLicense.findOne({
            _id: this.data.clientLicense_id
        }, {
            fields: {
                expireRemindNotifySent: 1
            }
        });

        if (docClientLicense && docClientLicense.expireRemindNotifySent) {
            // Client license about to expire. Show warning message
            this.state.set('infoMsg', '<b>Warning!</b> This license will <b>expire</b> soon.');
            this.state.set('infoMsgType', 'warning');

            this.state.set('aboutToExpire', true);
        }
    });

    this.currClntSingleClientLicenseLicenseSubs = this.subscribe('currentClientSingleClientLicenseLicense', this.data.clientLicense_id);
});

Template.clientClientLicenseDetails.onDestroyed(function () {
    if (this.currentClient) {
        this.currentClient.stop();
    }

    if (this.currClntSingleClientLicenseSubs) {
        this.currClntSingleClientLicenseSubs.stop();
    }

    if (this.currClntSingleClientLicenseLicenseSubs) {
        this.currClntSingleClientLicenseLicenseSubs.stop();
    }
});

Template.clientClientLicenseDetails.events({
    'click #btnDismissInfo'(events, template) {
        // Clear info message
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');
    }
});

Template.clientClientLicenseDetails.helpers({
    backQueryString() {
        const retParams = Template.instance().data.retParams;

        return retParams ? '?' + retParams : undefined;
    },
    client() {
        return Catenis.db.collection.Client.findOne();
    },
    clientLicense() {
        return Catenis.db.collection.ClientLicense.findOne({_id: Template.instance().data.clientLicense_id});
    },
    clientLicenseLicense(license_id) {
        return Catenis.db.collection.License.findOne({_id: license_id});
    },
    formatLongDate(date, client) {
        return date ? ClientUtil.startOfDayTimeZone(date, client.timeZone, true).format('LLLL') : undefined;
    },
    capitalize(str) {
        return ClientUtil.capitalize(str);
    },
    statusColor(status) {
        let color;

        switch (status) {
            case ClientLicenseShared.status.active.name:
                color = 'green';
                break;

            case ClientLicenseShared.status.provisioned.name:
                color = 'blue';
                break;

            case ClientLicenseShared.status.expired.name:
                color = 'red';
                break;
        }

        return color;
    },
    hasInfoMessage() {
        return !!Template.instance().state.get('infoMsg');
    },
    infoMessage() {
        return Template.instance().state.get('infoMsg');
    },
    infoMessageType() {
        return Template.instance().state.get('infoMsgType');
    },
    isAboutToExpire() {
        return Template.instance().state.get('aboutToExpire');
    }
});
