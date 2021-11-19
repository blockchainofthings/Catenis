/**
 * Created by claudio on 2021-11-03
 */

//console.log('[NotificationsTemplate.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
//import config from 'config';
// Meteor packages
//import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';

// References code in other (Catenis) modules on the client
import { Catenis } from '../ClientCatenis';
import { UINotificationShared } from '../../both/UINotificationShared';
import { UINotificationTemplateShared } from '../../both/UINotificationTemplateShared';

// Import template UI
import './NotificationsTemplate.html';

// Import dependent templates
import './NewNotificationTemplate.js';
import './NotificationDetailsTemplate.js';


// Module code
//

Template.notifications.onCreated(function () {
    // Subscribe to receive database docs/recs updates
    this.subscribe('uiNotificationTemplateRecord', this.data.uiNotificationTemplate_id);
    this.subscribe('uiNotifications', this.data.uiNotificationTemplate_id);
});

Template.notifications.helpers({
    uiNotificationTemplate() {
        return Catenis.db.collection.UINotificationTemplate.findOne({
            _id: Template.instance().data.uiNotificationTemplate_id
        });
    },
    uiNotifications: function () {
        return Catenis.db.collection.UINotification.find({}, {
            sort:{
                name: 1
            }
        }).fetch();
    },
    statusColor(status) {
        let color;

        switch (status) {
            case UINotificationShared.notificationStatus.draft.name:
                color = 'blue';
                break;

            case UINotificationShared.notificationStatus.outdated.name:
                color = 'red';
                break;

            case UINotificationShared.notificationStatus.issued.name:
                color = 'gray';
                break;
        }

        return color;
    },
    isDisabled(uiNotificationTemplate) {
        return uiNotificationTemplate.status === UINotificationTemplateShared.notificationTemplateStatus.disabled.name;
    }
});
