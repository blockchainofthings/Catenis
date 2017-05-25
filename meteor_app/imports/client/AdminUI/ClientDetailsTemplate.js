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


// Module code
//

Template.clientDetails.onCreated(function () {
    this.state = new ReactiveDict();
    this.state.set('addMsgCreditsStatus', 'idle');  // Valid statuses: 'idle', 'data-enter', 'processing', 'error', 'success'

    // Subscribe to receive fund balance updates
    this.catenisClientsSubs = this.subscribe('catenisClients', Catenis.ctnHubNodeIndex);
    this.clientUserSubs = this.subscribe('clientUser', this.data.client_id);
    this.clientMessageCreditsSubs = this.subscribe('clientMessageCredits', this.data.client_id);
});

Template.clientDetails.onDestroyed(function () {
    if (this.catenisClientsSubs) {
        this.catenisClientsSubs.stop();
    }

    if (this.clientUserSubs) {
        this.clientUserSubs.stop();
    }

    if (this.clientMessageCreditsSubs) {
        this.clientMessageCreditsSubs.stop();
    }
});

Template.clientDetails.events({
    'click #lnkAddMsgCredits'(event, template) {
        template.state.set('addMsgCreditsStatus', 'data-enter');

        return false;
    },
    'click #butAddMsgCredits'(event, template) {
        const client = Catenis.db.collection.Client.findOne({_id: Template.instance().data.client_id});

        const fieldCreditsCount = template.$('#txiMsgCreditAmount')[0];
        const creditsCount = parseInt(fieldCreditsCount.value);

        if (!isNaN(creditsCount)) {
            // Call remote method to add message credits
            Meteor.call('addMessageCredits', client.clientId, creditsCount, (error) => {
                if (error) {
                    template.state.set('addMsgCreditsError', error.toString());
                    template.state.set('addMsgCreditsStatus', 'error');
                }
                else {
                    template.state.set('addMsgCreditsStatus', 'success');
                }
            });

            template.state.set('addMsgCreditsStatus', 'processing');
        }
        else {
            fieldCreditsCount.value = null;
        }
    },
    'click #lnkCancelAddMsgCredits'(event, template) {
        template.state.set('addMsgCreditsStatus', 'idle');

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
    messageCredits: function () {
        return Catenis.db.collection.MessageCredits.findOne(1);
    },
    hasUnconfirmedMessageCredits: function (messageCredits) {
        return messageCredits && messageCredits.unconfirmed > 0;
    },
    // compareOper: valid values: 'equal'/'any-of', 'not-equal'/'none-of'
    checkAddMsgCreditsStatus: function (status, compareOper) {
        compareOper = compareOper && (Array.isArray(status) ? 'all-of' : 'equal');
        const currentStatus = Template.instance().state.get('addMsgCreditsStatus');
        let result = false;

        if (compareOper === 'equal' || compareOper === 'any-of') {
            if (Array.isArray(status)) {
                result = status.some((stat) => stat === currentStatus);
            }
            else {
                result = status === currentStatus;
            }
        }
        else if (compareOper === 'not-equal' || compareOper === 'none-of') {
            if (Array.isArray(status)) {
                result = !status.some((stat) => stat === currentStatus);
            }
            else {
                result = status !== currentStatus;
            }
        }

        return result;
    },
    addMsgCreditsError: function () {
        return Template.instance().state.get('addMsgCreditsError');
    }
});
