/**
 * Created by claudio on 2021-11-05
 */

//console.log('[NotificationDetailsTemplate.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import moment from 'moment-timezone';
// Meteor packages
import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';
import { ReactiveDict } from 'meteor/reactive-dict';

// References code in other (Catenis) modules on the client
import { Catenis } from '../ClientCatenis';
import { UINotificationTemplateShared } from '../../both/UINotificationTemplateShared';
import { UINotificationShared } from '../../both/UINotificationShared';
import { ClientUtil } from '../ClientUtil';

// Import template UI
import './NotificationDetailsTemplate.html';

// Import dependent templates
import './EditNotificationTemplate.js';
import './PreviewNotificationTemplate.js';

// Module variables
const confirmPhrase = 'yes, i do confirm it';


// Definition of module (private) functions
//


// Module code
//

Template.notificationDetails.onCreated(function () {
    this.state = new ReactiveDict();

    this.state.set('errMsgs', []);
    this.state.set('infoMsg', undefined);
    this.state.set('infoMsgType', 'info');

    this.state.set('displayIssueNotificationSubmitButton', 'none');

    // Subscribe to receive database docs/recs updates
    this.uiNotificationTemplateRecordSubs = this.subscribe('uiNotificationTemplateRecord', this.data.uiNotificationTemplate_id);
    this.uiNotificationRecordSubs = this.subscribe(
        'uiNotificationTemplateNotificationRecord',
        this.data.uiNotificationTemplate_id,
        this.data.uiNotification_id
    );

    this.state.set('referenceTimeZone', undefined);

    // Load UI notification reference time zone
    Meteor.call('getUINotificationReferenceTimeZone', (err, referenceTimeZone) => {
        if (err) {
            console.error('Error calling getUINotificationReferenceTimeZone() remote method:', err);
        }
        else {
            this.state.set('referenceTimeZone', referenceTimeZone);
        }
    });
});

Template.notificationDetails.onDestroyed(function () {
    if (this.uiNotificationTemplateRecordSubs) {
        this.uiNotificationTemplateRecordSubs.stop();
    }

    if (this.uiNotificationRecordSubs) {
        this.uiNotificationRecordSubs.stop();
    }
});

Template.notificationDetails.events({
    'click #btnDismissInfo'(event, template) {
        // Clear info message
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');
    },
    'click #btnDismissError'(event, template) {
        // Clear error message
        template.state.set('errMsgs', []);
    },
    'click #btnIssueNotification'(event, template) {
        event.preventDefault();

        // Reset alert messages
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');

        // Reset action confirmation
        $('#itxIssueNotificationConfirmation')[0].value = '';
        template.state.set('displayIssueNotificationSubmitButton', 'none');
    },
    'hidden.bs.modal #divIssueNotification'(event, template) {
        // Modal panel has been closed. Make sure that button used to
        //  activate modal panel is not selected
        $('#btnIssueNotification').blur();
    },
    'input #itxIssueNotificationConfirmation'(event, template) {
        // Suppress spaces from beginning of input
        let inputValue = event.target.value = event.target.value.replace(/^\s+/, '');

        if (inputValue.length > confirmPhrase.length) {
            // Limit length of input
            inputValue = event.target.value = inputValue.substring(0, confirmPhrase.length);
        }

        // Check if input matches confirmation phrase
        if (inputValue.toLowerCase() === confirmPhrase) {
            // Show button to confirm action
            template.state.set('displayIssueNotificationSubmitButton', 'inline');
        }
        else {
            // Hide button to confirm action
            template.state.set('displayIssueNotificationSubmitButton', 'none');
        }
    },
    'submit #frmIssueNotification'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        const confirmMsg = 'LAST CHANCE!\n\nIf you proceed, the notification will be issued, and immediately delivered to the intended targets.\n\nPLEASE NOTE THAT THIS CANNOT BE REVERTED.';

        if (confirm(confirmMsg)) {
            // Close modal panel
            $('#divIssueNotification').modal('hide');

            // Reset alert messages
            template.state.set('errMsgs', []);
            template.state.set('infoMsg', undefined);
            template.state.set('infoMsgType', 'info');

            Meteor.call('issueUINotification', template.data.uiNotification_id, (error) => {
                if (error) {
                    const errMsgs = template.state.get('errMsgs');
                    errMsgs.push('Error issuing notification: ' + error.toString());
                    template.state.set('errMsgs', errMsgs);
                }
                else {
                    template.state.set('infoMsg', 'Notification successfully issued');
                    template.state.set('infoMsgType', 'success');
                }
            });
        }
        else {
            // Close modal panel
            $('#divIssueNotification').modal('hide');
        }
    },
});

Template.notificationDetails.helpers({
    uiNotificationTemplate() {
        return Catenis.db.collection.UINotificationTemplate.findOne({
            _id: Template.instance().data.uiNotificationTemplate_id
        });
    },
    uiNotification() {
        return Catenis.db.collection.UINotification.findOne({
            _id: Template.instance().data.uiNotification_id
        });
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
    isTemplateActive(uiNotificationTemplate) {
        return uiNotificationTemplate.status === UINotificationTemplateShared.notificationTemplateStatus.active.name;
    },
    isDraft(uiNotification) {
        return uiNotification.status === UINotificationShared.notificationStatus.draft.name;
    },
    isOutdated(uiNotification) {
        return uiNotification.status === UINotificationShared.notificationStatus.outdated.name;
    },
    isIssued(uiNotification) {
        return uiNotification.status === UINotificationShared.notificationStatus.issued.name;
    },
    hasErrorMessage() {
        return Template.instance().state.get('errMsgs').length > 0;
    },
    errorMessage() {
        return Template.instance().state.get('errMsgs').reduce((compMsg, errMsg) => {
            if (compMsg.length > 0) {
                compMsg += '<br>';
            }
            return compMsg + errMsg;
        }, '');
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
    displayIssueNotificationSubmitButton() {
        return Template.instance().state.get('displayIssueNotificationSubmitButton');
    },
    referenceTimeZone() {
        return Template.instance().state.get('referenceTimeZone');
    },
    formatDateReferenceTimeZone(date) {
        if (date) {
            return moment(date).utcOffset(Template.instance().state.get('referenceTimeZone')).format('LL');
        }
    },
    nameValueList(obj) {
        return Object.keys(obj).map(key => ({
            name: key,
            value: obj[key]
        }));
    },
    logicalAnd(...ops) {
        if (ops.length > 0) {
            // Get rid of the last parameter (keyword arguments dictionary)
            ops.pop();

            return ops.every(v => !!v);
        }
        else {
            return false;
        }
    },
    capitalize(str) {
        return ClientUtil.capitalize(str);
    },
});
