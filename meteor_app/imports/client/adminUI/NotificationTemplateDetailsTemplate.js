/**
 * Created by claudio on 2021-11-02
 */

//console.log('[NotificationTemplateDetailsTemplate.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import querystring from 'querystring';
// Third-party node modules
//import config from 'config';
// Meteor packages
import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';
import { ReactiveDict } from 'meteor/reactive-dict';

// References code in other (Catenis) modules on the client
import { Catenis } from '../ClientCatenis';
import { UINotificationTemplateShared } from '../../both/UINotificationTemplateShared';
import { ClientUtil } from '../ClientUtil';
import { QuillEditor } from '../QuillEditor';

// Import template UI
import './NotificationTemplateDetailsTemplate.html';

// Import dependent templates
import './EditNotificationTemplateTemplate.js';
import './NotificationsTemplate.js';

// Module variables
const confirmPhrase = 'yes, i do confirm it';


// Definition of module (private) functions
//

function uiNotificationTemplateRecord(template) {
    return Catenis.db.collection.UINotificationTemplate.findOne({
        _id: template.data.uiNotificationTemplate_id
    });
}

function initContentsEditors(template) {
    template.state.set('initialized', true);

    const docUINotificationTemplate = uiNotificationTemplateRecord(template);

    QuillEditor.new('#divBodyContents', {
        readOnly: true
    })
    .setContents(JSON.parse(docUINotificationTemplate.contents.body));

    if (docUINotificationTemplate.contents.email) {
        if (docUINotificationTemplate.contents.email.salutation) {
            if (docUINotificationTemplate.contents.email.salutation.client) {
                QuillEditor.new('#divEmailSaluteClientsContents', {
                    readOnly: true
                })
                .setContents(JSON.parse(docUINotificationTemplate.contents.email.salutation.client));
            }

            if (docUINotificationTemplate.contents.email.salutation.nonClient) {
                QuillEditor.new('#divEmailSaluteNonClientsContents', {
                    readOnly: true
                })
                .setContents(JSON.parse(docUINotificationTemplate.contents.email.salutation.nonClient));
            }
        }

        QuillEditor.new('#divEmailSignatureContents', {
            readOnly: true
        })
        .setContents(JSON.parse(docUINotificationTemplate.contents.email.signature));
    }
}


// Module code
//

Template.notifyTemplateDetails.onCreated(function () {
    this.state = new ReactiveDict();

    this.state.set('errMsgs', []);
    this.state.set('infoMsg', undefined);
    this.state.set('infoMsgType', 'info');

    this.state.set('displayDeleteTemplateSubmitButton', 'none');
    this.state.set('displayActivateTemplateSubmitButton', 'none');
    this.state.set('displayDisableTemplateSubmitButton', 'none');

    this.state.set('templateDeleted', false);
    this.state.set('initialized', false);

    // Subscribe to receive database docs/recs updates
    this.subscribe('uiNotificationTemplateRecord', this.data.uiNotificationTemplate_id);
});

Template.notifyTemplateDetails.events({
    'click #tblNotifyTemplateProps'(event, template) {
        if (!template.state.get('initialized')) {
            initContentsEditors(template);
        }
    },
    'click #btnDismissInfo'(event, template) {
        // Clear info message
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');
    },
    'click #btnDismissError'(event, template) {
        // Clear error message
        template.state.set('errMsgs', []);
    },
    'click #btnActivateTemplate'(event, template) {
        event.preventDefault();

        // Reset alert messages
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');

        // Reset action confirmation
        $('#itxActivateTemplateConfirmation')[0].value = '';
        template.state.set('displayActivateTemplateSubmitButton', 'none');
    },
    'hidden.bs.modal #divActivateTemplate'(event, template) {
        // Modal panel has been closed. Make sure that button used to
        //  activate modal panel is not selected
        $('#btnActivateTemplate').blur();
    },
    'input #itxActivateTemplateConfirmation'(event, template) {
        // Suppress spaces from beginning of input
        let inputValue = event.target.value = event.target.value.replace(/^\s+/, '');

        if (inputValue.length > confirmPhrase.length) {
            // Limit length of input
            inputValue = event.target.value = inputValue.substring(0, confirmPhrase.length);
        }

        // Check if input matches confirmation phrase
        if (inputValue.toLowerCase() === confirmPhrase) {
            // Show button to confirm action
            template.state.set('displayActivateTemplateSubmitButton', 'inline');
        }
        else {
            // Hide button to confirm action
            template.state.set('displayActivateTemplateSubmitButton', 'none');
        }
    },
    'submit #frmActivateTemplate'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        const confirmMsg = 'LAST CHANCE!\n\nIf you proceed, the notification template will be activated, and it will NOT be EDITABLE anymore.\n\nPLEASE NOTE THAT THIS ACTION CANNOT BE UNDONE.';

        if (confirm(confirmMsg)) {
            // Close modal panel
            $('#divActivateTemplate').modal('hide');

            // Reset alert messages
            template.state.set('errMsgs', []);
            template.state.set('infoMsg', undefined);
            template.state.set('infoMsgType', 'info');

            Meteor.call('activateUINotificationTemplate', template.data.uiNotificationTemplate_id, (error) => {
                if (error) {
                    const errMsgs = template.state.get('errMsgs');
                    errMsgs.push('Error activating notification template: ' + error.toString());
                    template.state.set('errMsgs', errMsgs);
                }
                else {
                    template.state.set('infoMsg', 'Notification template successfully activated');
                    template.state.set('infoMsgType', 'success');
                }
            });
        }
        else {
            // Close modal panel
            $('#divActivateTemplate').modal('hide');
        }
    },
    'click #btnDeleteTemplate'(event, template) {
        event.preventDefault();

        // Reset alert messages
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');

        // Reset action confirmation
        $('#itxDeleteTemplateConfirmation')[0].value = '';
        template.state.set('displayDeleteTemplateSubmitButton', 'none');
    },
    'hidden.bs.modal #divDeleteTemplate'(event, template) {
        // Modal panel has been closed. Make sure that button used to
        //  activate modal panel is not selected
        $('#btnDeleteTemplate').blur();
    },
    'input #itxDeleteTemplateConfirmation'(event, template) {
        // Suppress spaces from beginning of input
        let inputValue = event.target.value = event.target.value.replace(/^\s+/, '');

        if (inputValue.length > confirmPhrase.length) {
            // Limit length of input
            inputValue = event.target.value = inputValue.substring(0, confirmPhrase.length);
        }

        // Check if input matches confirmation phrase
        if (inputValue.toLowerCase() === confirmPhrase) {
            // Show button to confirm action
            template.state.set('displayDeleteTemplateSubmitButton', 'inline');
        }
        else {
            // Hide button to confirm action
            template.state.set('displayDeleteTemplateSubmitButton', 'none');
        }
    },
    'submit #frmDeleteTemplate'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        const confirmMsg = 'LAST CHANCE!\n\nIf you proceed, the notification template and ALL its derived notifications will be DELETED.\n\nPLEASE NOTE THAT THIS ACTION CANNOT BE UNDONE.';

        if (confirm(confirmMsg)) {
            // Close modal panel
            $('#divDeleteTemplate').modal('hide');

            // Reset alert messages
            template.state.set('errMsgs', []);
            template.state.set('infoMsg', undefined);
            template.state.set('infoMsgType', 'info');

            Meteor.call('deleteUINotificationTemplate', template.data.uiNotificationTemplate_id, (error) => {
                if (error) {
                    const errMsgs = template.state.get('errMsgs');
                    errMsgs.push('Error deleting notification template: ' + error.toString());
                    template.state.set('errMsgs', errMsgs);
                }
                else {
                    template.state.set('templateDeleted', true);
                    template.state.set('infoMsg', 'Notification template successfully deleted');
                    template.state.set('infoMsgType', 'success');
                }
            });
        }
        else {
            // Close modal panel
            $('#divDeleteTemplate').modal('hide');
        }
    },
    'click #btnDisableTemplate'(event, template) {
        event.preventDefault();

        // Reset alert messages
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');

        // Reset action confirmation
        $('#itxDisableTemplateConfirmation')[0].value = '';
        template.state.set('displayDisableTemplateSubmitButton', 'none');
    },
    'hidden.bs.modal #divDisableTemplate'(event, template) {
        // Modal panel has been closed. Make sure that button used to
        //  activate modal panel is not selected
        $('#btnDisableTemplate').blur();
    },
    'input #itxDisableTemplateConfirmation'(event, template) {
        // Suppress spaces from beginning of input
        let inputValue = event.target.value = event.target.value.replace(/^\s+/, '');

        if (inputValue.length > confirmPhrase.length) {
            // Limit length of input
            inputValue = event.target.value = inputValue.substring(0, confirmPhrase.length);
        }

        // Check if input matches confirmation phrase
        if (inputValue.toLowerCase() === confirmPhrase) {
            // Show button to confirm action
            template.state.set('displayDisableTemplateSubmitButton', 'inline');
        }
        else {
            // Hide button to confirm action
            template.state.set('displayDisableTemplateSubmitButton', 'none');
        }
    },
    'submit #frmDisableTemplate'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        const confirmMsg = 'LAST CHANCE!\n\nIf you proceed, the notification template will be disabled, and NO MORE notifications will ever be DERIVED from it.\n\nPLEASE NOTE THAT THIS ACTION CANNOT BE UNDONE.';

        if (confirm(confirmMsg)) {
            // Close modal panel
            $('#divDisableTemplate').modal('hide');

            // Reset alert messages
            template.state.set('errMsgs', []);
            template.state.set('infoMsg', undefined);
            template.state.set('infoMsgType', 'info');

            Meteor.call('disableUINotificationTemplate', template.data.uiNotificationTemplate_id, (error) => {
                if (error) {
                    const errMsgs = template.state.get('errMsgs');
                    errMsgs.push('Error disabling notification template: ' + error.toString());
                    template.state.set('errMsgs', errMsgs);
                }
                else {
                    template.state.set('infoMsg', 'Notification template successfully disabled');
                    template.state.set('infoMsgType', 'success');
                }
            });
        }
        else {
            // Close modal panel
            $('#divDisableTemplate').modal('hide');
        }
    },
});

Template.notifyTemplateDetails.helpers({
    backQueryString() {
        const retParams = Template.instance().data.retParams;

        return retParams ? '?' + retParams : undefined;
    },
    uiNotificationTemplate() {
        return Catenis.db.collection.UINotificationTemplate.findOne({
            _id: Template.instance().data.uiNotificationTemplate_id
        });
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
    },
    isDraft(uiNotificationTemplate) {
        return uiNotificationTemplate.status === UINotificationTemplateShared.notificationTemplateStatus.draft.name;
    },
    isActive(uiNotificationTemplate) {
        return uiNotificationTemplate.status === UINotificationTemplateShared.notificationTemplateStatus.active.name;
    },
    hasEmailSaluteClientsContents(uiNotificationTemplate) {
        return uiNotificationTemplate.contents.email && uiNotificationTemplate.contents.email.salutation
            && uiNotificationTemplate.contents.email.salutation.client;
    },
    hasEmailSaluteNonClientsContents(uiNotificationTemplate) {
        return uiNotificationTemplate.contents.email && uiNotificationTemplate.contents.email.salutation
            && uiNotificationTemplate.contents.email.salutation.nonClient;
    },
    hasEmailSignatureContents(uiNotificationTemplate) {
        return uiNotificationTemplate.contents.email && uiNotificationTemplate.contents.email.signature;
    },
    templateDeleted() {
        return Template.instance().state.get('templateDeleted');
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
    displayDeleteTemplateSubmitButton() {
        return Template.instance().state.get('displayDeleteTemplateSubmitButton');
    },
    displayActivateTemplateSubmitButton() {
        return Template.instance().state.get('displayActivateTemplateSubmitButton');
    },
    displayDisableTemplateSubmitButton() {
        return Template.instance().state.get('displayDisableTemplateSubmitButton');
    },
    booleanValue(val) {
        return (!!val).toString();
    },
    returnQueryString() {
        const retParams = Template.instance().data.retParams;

        if (retParams) {
            return '?' + querystring.stringify({
                retparams: querystring.stringify({
                    retparams: retParams
                })
            });
        }
    }
});
