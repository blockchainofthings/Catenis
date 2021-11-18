/**
 * Created by Claudio on 2018-09-27.
 */

//console.log('[ClientHomeTemplate.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
//import config from 'config';
// Meteor packages
import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';
import { ReactiveDict } from 'meteor/reactive-dict';

// References code in other (Catenis) modules on the client
import { Catenis } from '../ClientCatenis';
import { UINotificationTemplateShared } from '../../both/UINotificationTemplateShared';
import { UserUINotificationShared } from '../../both/UserUINotificationShared';

// Import template UI
import './ClientHomeTemplate.html';

// Import dependent templates


// Definition of module (private) functions
//


// Module code
//

Template.clientHome.onCreated(function () {
    this.state = new ReactiveDict();

    this.state.set('now', new Date());

    // Update 'now' date/time every minute
    this.interval = Meteor.setInterval(() => {
        this.state.set('now', new Date());
    }, 60000);

    this.state.set('notificationsLoaded', false);

    // Subscribe to receive database docs/recs updates
    this.subscribe('criticalUserNotifications', () => {
        this.state.set('notificationsLoaded', true);
    });
    this.subscribe('currentClientServiceAccountBalance');
});

Template.clientHome.onDestroyed(function () {
    if (this.interval) {
        Meteor.clearInterval(this.interval);
    }
});

Template.clientHome.events({
    'click #btnDismissLowBalanceWarning'(event, template) {
        Meteor.call('currentClientDismissLowServAccBalanceUINotify', (error) => {
            if (error) {
                console.error('Error calling \'currentClientDismissLowServAccBalanceUINotify\' remote method:', error);
            }
        });
    },
    'click .ctnNotifyEntry'(event, template) {
        event.stopPropagation();

        // Redirect to notifications section to display the notification message
        window.location = `/usernotifications?selected_id=${event.currentTarget.getAttribute('data-notifyId')}`
    }
});

Template.clientHome.helpers({
    balanceInfo() {
        return Catenis.db.collection.ServiceAccountBalance.findOne(1);
    },
    userNotifications() {
        return Catenis.db.collection.UserNotification.find({
            urgency: UINotificationTemplateShared.notificationUrgency.critical.name,
            expirationDate: {
                $gte: Template.instance().state.get('now')
            }
        }, {
            sort:{
                issuedDate: -1
            }
        }).fetch();
    },
    notificationsLoaded() {
        return Template.instance().state.get('notificationsLoaded');
    },
    hasUserNotifications() {
        return Catenis.db.collection.UserNotification.find({
            urgency: UINotificationTemplateShared.notificationUrgency.critical.name,
            expirationDate: {
                $gte: Template.instance().state.get('now')
            }
        }).count() > 0;
    },
    formatDate(date) {
        return date.toLocaleDateString();
    },
    isNew(userNotification) {
        return userNotification.status === UserUINotificationShared.userNotificationStatus.new.name;
    },
    isCritical(userNotification) {
        return userNotification.urgency === UINotificationTemplateShared.notificationUrgency.critical.name;
    }
});
