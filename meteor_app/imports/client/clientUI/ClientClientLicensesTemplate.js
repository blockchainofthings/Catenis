/**
 * Created by Claudio on 2018-10-04.
 */

//console.log('[ClientClientLicensesTemplate.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
// Meteor packages
//import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';
import { ReactiveDict } from 'meteor/reactive-dict';

// References code in other (Catenis) modules on the client
import { Catenis } from '../ClientCatenis';
import { ClientUtil } from '../ClientUtil';
import { ClientLicenseShared } from '../../both/ClientLicenseShared';

// Import template UI
import './ClientClientLicensesTemplate.html';

// Import dependent templates
import './ClientClientLicenseDetailsTemplate.js';


// Definition of module (private) functions
//


// Module code
//

Template.clientClientLicenses.onCreated(function () {
    this.state = new ReactiveDict();

    this.state.set('showExpiredLicenses', false);

    // Subscribe to receive database docs/recs updates
    this.currentClient = this.subscribe('currentClient');
    this.currClntAllClientLicensesSubs = this.subscribe('currentClientAllClientLicenses');
    this.currClntAllClientLicenseLicensesSubs = this.subscribe('currentClientAllClientLicenseLicenses');
});

Template.clientClientLicenses.onDestroyed(function () {
    if (this.currentClient) {
        this.currentClient.stop();
    }

    if (this.currClntAllClientLicensesSubs) {
        this.currClntAllClientLicensesSubs.stop();
    }

    if (this.currClntAllClientLicenseLicensesSubs) {
        this.currClntAllClientLicenseLicensesSubs.stop();
    }
});

Template.clientClientLicenses.events({
    'click #lnkShowHideExpiredLicenses'(event, template) {
        template.state.set('showExpiredLicenses', !template.state.get('showExpiredLicenses'));

        return false;
    }
});

Template.clientClientLicenses.helpers({
    client() {
        return Catenis.db.collection.Client.findOne();
    },
    clientLicenses(client) {
        const template = Template.instance();

        const selector = {
            client_id: client._id
        };

        if (!template.state.get('showExpiredLicenses')) {
            selector.status = {
                $nin: [
                    ClientLicenseShared.status.expired.name
                ]
            }
        }

        return Catenis.db.collection.ClientLicense.find(selector, {
            sort: {
                'validity.startDate': 1,
                'activatedDate': 1,
                'provisionedDate': 1,
                'expiredDate': 1
            }
        });
    },
    clientLicenseLicense(license_id) {
        return Catenis.db.collection.License.findOne({_id: license_id});
    },
    licenseName(license) {
        let licName = ClientUtil.capitalize(license.level);

        if (license.type) {
            licName += ' (' + license.type + ')';
        }

        return licName;
    },
    isAboutToExpire(clientLicense) {
        return clientLicense.expireRemindNotifySent;
    },
    formatShortDate(date, client) {
        return date ? ClientUtil.startOfDayTimeZone(date, client.timeZone, true).format('LL') : undefined;
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
    showHideExpiredLicensesAction() {
        return Template.instance().state.get('showExpiredLicenses') ? 'Hide' : 'Show';
    }
});
