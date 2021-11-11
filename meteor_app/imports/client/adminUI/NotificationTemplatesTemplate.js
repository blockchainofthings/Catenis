/**
 * Created by claudio on 2021-10-27
 */

//console.log('[NotificationTemplatesTemplate.js]: This code just ran.');

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
import { UINotificationTemplateShared } from '../../both/UINotificationTemplateShared';
import { ClientUtil } from '../ClientUtil';

// Import template UI
import './NotificationTemplatesTemplate.html';

// Import dependent templates
import './NewNotificationTemplateTemplate.js';


// Module code
//

Template.notifyTemplates.onCreated(function () {
    // Subscribe to receive database docs/recs updates
    this.uiNotificationTemplatesSubs = this.subscribe('uiNotificationTemplates');
});

Template.notifyTemplates.onDestroyed(function () {
    if (this.uiNotificationTemplatesSubs){
        this.uiNotificationTemplatesSubs.stop();
    }
});

Template.notifyTemplates.events({
});

Template.notifyTemplates.helpers({
    uiNotificationTemplates: function () {
        return Catenis.db.collection.UINotificationTemplate.find({}, {
            sort:{
                name: 1
            }
        }).fetch();
    },
    statusColor(status) {
        let color;

        switch (status) {
            case UINotificationTemplateShared.notificationTemplateStatus.draft.name:
                color = 'blue';
                break;

            case UINotificationTemplateShared.notificationTemplateStatus.active.name:
                color = 'green';
                break;

            case UINotificationTemplateShared.notificationTemplateStatus.disabled.name:
                color = 'gray';
                break;
        }

        return color;
    },
    displayName(name) {
        return ClientUtil.capitalize(name.replace('_', ' '));
    }
});
