/**
 * Created by Claudio on 2018-09-25.
 */

//console.log('[AdminHomeTemplate.js]: This code just ran.');

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
import './AdminHomeTemplate.html';

// Import dependent templates


// Definition of module (private) functions
//


// Module code
//

Template.adminHome.onCreated(function () {
    this.state = new ReactiveDict();

    this.state.set('now', new Date());

    // Update 'now' date/time every minute
    this.interval = Meteor.setInterval(() => {
        this.state.set('now', new Date());
    }, 60000);

    // Subscribe to receive database docs/recs updates
    this.subscribe('criticalUserNotifications');
});

Template.adminHome.onDestroyed(function () {
    if (this.interval) {
        Meteor.clearInterval(this.interval);
    }
});

Template.adminHome.events({
    'click .ctnNotifyEntry'(event, template) {
        event.stopPropagation();

        // Redirect to notifications section to display the notification message
        window.location = `/admin/usernotifications?selected_id=${event.currentTarget.getAttribute('data-notifyId')}`
    },
});

Template.adminHome.helpers({
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
    },
});
