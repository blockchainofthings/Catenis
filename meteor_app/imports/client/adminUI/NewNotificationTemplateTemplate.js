/**
 * Created by claudio on 2021-10-27
 */

//console.log('[NewNotificationTemplateTemplate.js]: This code just ran.');

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
import { QuillEditor } from '../QuillEditor';

// Import template UI
import './NewNotificationTemplateTemplate.html';
import { UINotificationTemplateShared } from '../../both/UINotificationTemplateShared';
import { ClientUtil } from '../ClientUtil';

// Module variables


// Definition of module (private) functions

function saveQuillEditorsContents(form, template) {
    function getEditorContents(editor) {
        // NOTE: the Quill editor returns a linefeed character ('\n') when it is empty,
        //  so we need to compensate for that
        const delta = editor.getContents();

        return delta.length() === 1 && delta.ops[0].insert === '\n' ? '' : JSON.stringify(delta);
    }

    form.emailSaluteClientsContents.value = getEditorContents(template.staticState.get('emailSaluteClientsEditor'));
    form.emailSaluteNonClientsContents.value = getEditorContents(template.staticState.get('emailSaluteNonClientsEditor'));
    form.bodyContents.value = getEditorContents(template.staticState.get('bodyEditor'));
    form.emailSignatureContents.value = getEditorContents(template.staticState.get('emailSignatureEditor'));
}

function validateFormData(form, template, callback) {
    const templateInfo = {};
    const errMsgs = [];
    let focusSet = false;

    templateInfo.name = form.name.value ? form.name.value.trim() : '';

    if (templateInfo.name.length === 0) {
        // Notification template name not supplied. Report error
        errMsgs.push('Please enter a template name');
        form.name.focus();
        focusSet = true;
    }
    
    templateInfo.category = form.category.value;
    
    if (templateInfo.category.length === 0) {
        // Notification category not selected. Report error
        errMsgs.push('Please select a category for the notification');
        
        if (!focusSet) {
            form.category.focus();
            focusSet = true;
        }
    }

    templateInfo.urgency = form.urgency.value;

    if (templateInfo.urgency.length === 0) {
        // Notification urgency not selected. Report error
        errMsgs.push('Please select an urgency for the notification');

        if (!focusSet) {
            form.urgency.focus();
            focusSet = true;
        }
    }

    templateInfo.sendViaEmail = form.sendViaEmail.checked;

    templateInfo.target = {
        activeClients: form.targetActiveClients.checked,
        newClients: form.targetNewClients.checked,
        adminUsers: form.targetAdminUsers.checked
    }

    if (!Object.values(templateInfo.target).some(v => v)) {
        // No notification target selected. Report error
        errMsgs.push('Please select at least one target for the notification');

        if (!focusSet) {
            form.targetActiveClients.focus();
            focusSet = true;
        }
    }

    templateInfo.title = form.title.value ? form.title.value.trim() : '';

    if (templateInfo.title.length === 0) {
        // Notification title not supplied. Report error
        errMsgs.push('Please enter a title for the notification message');

        if (!focusSet) {
            form.title.focus();
            focusSet = true;
        }
    }

    templateInfo.contents = {
        body: form.bodyContents.value
    };

    if (templateInfo.sendViaEmail) {
        templateInfo.contents.email = {
            salutation: {},
            signature: form.emailSaluteClientsContents.value
        };

        if (templateInfo.target.activeClients || templateInfo.target.newClients) {
            templateInfo.contents.email.salutation.client = form.emailSaluteClientsContents.value;

            if (templateInfo.contents.email.salutation.client.length === 0) {
                // Notification e-mail salutation for clients not supplied. Report error
                errMsgs.push('Please enter the email salutation for client users');

                if (!focusSet) {
                    template.staticState.get('emailSaluteClientsEditor').focus();
                    focusSet = true;
                }
            }
        }

        if (templateInfo.target.adminUsers) {
            templateInfo.contents.email.salutation.nonClient = form.emailSaluteNonClientsContents.value;

            if (templateInfo.contents.email.salutation.nonClient.length === 0) {
                // Notification e-mail salutation for non-clients (admin users) not supplied. Report error
                errMsgs.push('Please enter the email salutation for admin users');

                if (!focusSet) {
                    template.staticState.get('emailSaluteNonClientsEditor').focus();
                    focusSet = true;
                }
            }
        }

        templateInfo.contents.email.signature = form.emailSignatureContents.value;
    }

    if (templateInfo.contents.body.length === 0) {
        // Notification message body not supplied. Report error
        errMsgs.push('Please enter the notification message body');

        if (!focusSet) {
            template.staticState.get('bodyEditor').focus();
            focusSet = true;
        }
    }

    if (templateInfo.sendViaEmail && templateInfo.contents.email.signature.length === 0) {
        // Notification e-mail signature not supplied. Report error
        errMsgs.push('Please enter the email signature');

        if (!focusSet) {
            template.staticState.get('emailSignatureEditor').focus();
            // noinspection JSUnusedAssignment
            focusSet = true;
        }
    }

    // Return validation result
    if (errMsgs.length > 0) {
        callback(errMsgs);
    }
    else {
        callback(null, templateInfo);
    }
}


// Module code
//

Template.newNotifyTemplate.onCreated(function () {
    this.state = new ReactiveDict();

    this.state.set('errMsgs', []);
    this.state.set('infoMsg', undefined);
    this.state.set('infoMsgType', 'info');

    this.state.set('templateCreated', false);
    this.state.set('sendViaEmail', false);
    this.state.set('targetActiveClients', false);
    this.state.set('targetNewClients', false);
    this.state.set('targetAdminUsers', false);

    this.staticState = new Map();
});

Template.newNotifyTemplate.onRendered(function () {
    // Create Quill editor instances
    const emailSaluteClientsEditor = QuillEditor.new('#divEmailSaluteClientsContents', {
        placeholder: 'Enter the email salutation for client users'
    });
    const emailSaluteNonClientsEditor = QuillEditor.new('#divEmailSaluteNonClientsContents', {
        placeholder: 'Enter the email salutation for admin users'
    });
    const bodyEditor = QuillEditor.new('#divBodyContents', {
        placeholder: 'Enter the message body'
    });
    const emailSignatureEditor = QuillEditor.new('#divEmailSignatureContents', {
        placeholder: 'Enter the email signature'
    });

    this.staticState.set('emailSaluteClientsEditor', emailSaluteClientsEditor);
    this.staticState.set('emailSaluteNonClientsEditor', emailSaluteNonClientsEditor);
    this.staticState.set('bodyEditor', bodyEditor);
    this.staticState.set('emailSignatureEditor', emailSignatureEditor);
});

Template.newNotifyTemplate.onDestroyed(function () {
});

Template.newNotifyTemplate.events({
    'click #btnDismissError'(event, template) {
        // Clear error message
        template.state.set('errMsgs', []);
    },
    'click #btnDismissInfo'(event, template) {
        // Clear info message
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');
    },
    'click #btnCancel'(event, template) {
        // Note: we resource to this unconventional solution so we can disable the Cancel button and,
        //      at the same time, make it behave the same way as when a link is clicked (which we
        //      cannot achieve with either window.location.href = '<url>' or document.location = '<url>';
        //      both solutions cause a page reload, whilst clicking on the link does not)
        event.stopPropagation();
        template.find('#lnkCancel').click();
    },
    'click #cbxSendViaEmail'(event, template) {
        template.state.set('sendViaEmail', event.target.checked);
    },
    'click #cbxTargetActiveClients'(event, template) {
        template.state.set('targetActiveClients', event.target.checked);
    },
    'click #cbxTargetNewClients'(event, template) {
        template.state.set('targetNewClients', event.target.checked);
    },
    'click #cbxTargetAdminUsers'(event, template) {
        template.state.set('targetAdminUsers', event.target.checked);
    },
    'submit #frmNewNotifyTemplate'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        const form = event.target;

        // Clear alert messages
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');

        saveQuillEditorsContents(form, template);

        validateFormData(form, template, (errMsgs, templateInfo) => {
            if (errMsgs) {
                template.state.set('errMsgs', errMsgs);
                // Force page to scroll to top so user can see error message
                $(window).scrollTop(0);
            }
            else {
                // Disable buttons
                const btnCancel = template.find('#btnCancel');
                const btnCreate = template.find('#btnCreate');
                btnCancel.disabled = true;
                btnCreate.disabled = true;

                // Display alert message indicating that request is being processed
                template.state.set('infoMsg', 'Your request is being processed. Please wait.');

                // Call remote method to create new UI notification template
                Meteor.call('createNewUINotificationTemplate', templateInfo, (error) => {
                    // Re-enable buttons
                    btnCancel.disabled = false;
                    btnCreate.disabled = false;

                    if (error) {
                        // Clear info alert message, and display error message
                        template.state.set('infoMsg', undefined);

                        template.state.set('errMsgs', [
                            error.toString()
                        ]);
                    }
                    else {
                        // Indicate that notification template has been successfully created
                        template.state.set('templateCreated', true);
                        template.state.set('infoMsg', 'Notification template successfully created.');
                        template.state.set('infoMsgType', 'success');
                    }

                    // Force page to scroll to top so user can see result message
                    $(window).scrollTop(0);
                });
            }
        });
    }
});

Template.newNotifyTemplate.helpers({
    backQueryString() {
        const retParams = Template.instance().data.retParams;

        return retParams ? '?' + retParams : undefined;
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
    isTemplateCreated() {
        return Template.instance().state.get('templateCreated');
    },
    notificationCategories() {
        return Object.values(UINotificationTemplateShared.notificationCategory)
            .map(category => ({
                name: ClientUtil.capitalize(category.name.replace('_', ' ')),
                value: category.name
            }));
    },
    notificationUrgencies() {
        return Object.values(UINotificationTemplateShared.notificationUrgency)
        .map(urgency => ({
            name: ClientUtil.capitalize(urgency.name.replace('_', ' ')),
            value: urgency.name
        }));
    },
    showEmailSaluteClientsContentsEditor() {
        const template = Template.instance();

        return template.state.get('sendViaEmail') && template.state.get('targetActiveClients') || template.state.get('targetNewClients');
    },
    showEmailSaluteNonClientsContentsEditor() {
        const template = Template.instance();

        return template.state.get('sendViaEmail') && template.state.get('targetAdminUsers');
    },
    showEmailSignatureContentsEditor() {
        return Template.instance().state.get('sendViaEmail');
    },
    showCreateButton() {
        return !Template.instance().state.get('templateCreated');
    }
});
