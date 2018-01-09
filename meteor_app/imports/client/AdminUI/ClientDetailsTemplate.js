/**
 * Created by claudio on 24/05/17.
 */

//console.log('[ClientDetailsTemplate.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//  NOTE: the reference of these modules are done sing 'require()' instead of 'import' to
//      to avoid annoying WebStorm warning message: 'default export is not defined in
//      imported module'
//const util = require('util');
// Third-party node modules
//import config from 'config';
// Meteor packages
import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';
import { RectiveDict } from 'meteor/reactive-dict';

// References code in other (Catenis) modules on the client
import { Catenis } from '../ClientCatenis';

// Import template UI
import './ClientDetailsTemplate.html';

// Import dependent templates
import './DevicesTemplate.js';
import './BcotPaymentAddressTemplate.js';


// Module code
//

Template.clientDetails.onCreated(function () {
    this.state = new ReactiveDict();
    this.state.set('showDevices', !!this.data.showDevices);

    // Subscribe to receive fund balance updates
    this.clientRecordSubs = this.subscribe('clientRecord', this.data.client_id);
    this.clientUserSubs = this.subscribe('clientUser', this.data.client_id);
    this.serviceAccountBalanceSubs = this.subscribe('serviceAccountBalance', this.data.client_id);
});

Template.clientDetails.onDestroyed(function () {
    if (this.clientRecordSubs) {
        this.clientRecordSubs.stop();
    }

    if (this.clientUserSubs) {
        this.clientUserSubs.stop();
    }

    if (this.serviceAccountBalanceSubs) {
        this.serviceAccountBalanceSubs.stop();
    }
});

Template.clientDetails.events({
    'click #lnkNewBcotPayAddress'(event, template) {
        Meteor.call('newBcotPaymentAddress', template.data.client_id, (error, addr) => {
            if (error) {
                console.log('Error calling \'newBcotPaymentAddress\' remote method: ' + error);
            }
            else {
                template.state.set('bcotPayAddress', addr);
            }
        });

        return false;
    },
    'click #lnkDiscardAddr'(event, template) {
        if (confirm('Are you sure you want to discard this address?')) {
            template.state.set('bcotPayAddress', undefined);
        }

        return false;
    },
    'click #lnkShowDevices'(event, template) {
        template.state.set('showDevices', true);

        return false;
    },
    'click #lnkHideDevices'(event, template) {
        template.state.set('showDevices', false);

        return false;
    }
});

Template.clientDetails.helpers({
    client: function () {
        return Catenis.db.collection.Client.findOne({_id: Template.instance().data.client_id});
    },
    clientUsername: function (user_id) {
        const user = Meteor.users.findOne({_id: user_id});

        return user ? user.username : undefined;
    },
    showDevices: function () {
        return Template.instance().state.get('showDevices');
    },
    serviceAccountBalance() {
        return Catenis.db.collection.ServiceAccountBalance.findOne(1);
    },
    bcotPayAddress() {
        return Template.instance().state.get('bcotPayAddress');
    }
});
