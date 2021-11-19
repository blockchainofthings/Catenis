/**
 * Created by claudio on 2021-11-04
 */

//console.log('[NewNotificationTemplate.js]: This code just ran.');

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
import { ClientUtil } from '../ClientUtil';

// Import template UI
import './NewNotificationTemplate.html';
import { Catenis } from '../ClientCatenis';

// Module variables


// Definition of module (private) functions

function initFormFields(template) {
    template.state.set('initialized', true);

    // Activate date/time picker control
    const dtPicker = $('#dtpkrExpirationDate');
    dtPicker.datetimepicker({
        useCurrent: false,
        minDate: moment().startOf('day'),
        format: 'YYYY-MM-DD',
        useStrict: true
    });

    // Hook up handler to monitor date change
    dtPicker.on("dp.change", function (e) {
        template.state.set('hasExpirationDate', !!e.date);
    });
}

function validateFormData(form, template, callback) {
    const notificationInfo = {};
    const errMsgs = [];
    let focusSet = false;

    notificationInfo.name = form.name.value ? form.name.value.trim() : '';

    if (notificationInfo.name.length === 0) {
        // Notification name not supplied. Report error
        errMsgs.push('Please enter a notification name');
        form.name.focus();
        focusSet = true;
    }

    const expirationDate = $(form.expirationDate).data('DateTimePicker').date();

    if (expirationDate) {
        notificationInfo.expirationDate = expirationDate.format('YYYY-MM-DD');
    }

    // Validate contents static fields
    notificationInfo.contentsStaticFieldsValue = {};
    const contentsStaticFields = template.state.get('contentsStaticFields');

    if (contentsStaticFields.email) {
        notificationInfo.contentsStaticFieldsValue.email = {};
        
        if (contentsStaticFields.email.salutation) {
            notificationInfo.contentsStaticFieldsValue.email.salutation = {};

            if (contentsStaticFields.email.salutation.client) {
                notificationInfo.contentsStaticFieldsValue.email.salutation.client = {};

                contentsStaticFields.email.salutation.client.forEach((field, idx) => {
                    // Make sure that a value for the static field has been entered
                    const fieldCtrl = form[`emailSaluteClientsStaticField${idx}`];

                    if (fieldCtrl.value.length === 0) {
                        errMsgs.push(`Please enter a value for the email salutation for clients\' static field "${ClientUtil.capitalize(field)}"`);

                        if (!focusSet) {
                            fieldCtrl.focus();
                            focusSet = true;
                        }
                    }
                    else {
                        notificationInfo.contentsStaticFieldsValue.email.salutation.client[field] = fieldCtrl.value;
                    }
                });
            }

            if (contentsStaticFields.email.salutation.nonClient) {
                notificationInfo.contentsStaticFieldsValue.email.salutation.nonClient = {};

                contentsStaticFields.email.salutation.nonClient.forEach((field, idx) => {
                    // Make sure that a value for the static field has been entered
                    const fieldCtrl = form[`emailSaluteNonClientsStaticField${idx}`];

                    if (fieldCtrl.value.length === 0) {
                        errMsgs.push(`Please enter a value for the email salutation for admin users\' static field "${ClientUtil.capitalize(field)}"`);

                        if (!focusSet) {
                            fieldCtrl.focus();
                            focusSet = true;
                        }
                    }
                    else {
                        notificationInfo.contentsStaticFieldsValue.email.salutation.nonClient[field] = fieldCtrl.value;
                    }
                });
            }
        }
    }

    if (contentsStaticFields.body) {
        notificationInfo.contentsStaticFieldsValue.body = {};

        contentsStaticFields.body.forEach((field, idx) => {
            // Make sure that a value for the static field has been entered
            const fieldCtrl = form[`bodyStaticField${idx}`];

            if (fieldCtrl.value.length === 0) {
                errMsgs.push(`Please enter a value for the message body\'s static field "${ClientUtil.capitalize(field)}"`);

                if (!focusSet) {
                    fieldCtrl.focus();
                    focusSet = true;
                }
            }
            else {
                notificationInfo.contentsStaticFieldsValue.body[field] = fieldCtrl.value;
            }
        });
    }

    if (contentsStaticFields.email && contentsStaticFields.email.signature) {
        notificationInfo.contentsStaticFieldsValue.email.signature = {};

        contentsStaticFields.email.signature.forEach((field, idx) => {
            // Make sure that a value for the static field has been entered
            const fieldCtrl = form[`emailSignatureStaticField${idx}`];

            if (fieldCtrl.value.length === 0) {
                errMsgs.push(`Please enter a value for the email signature\'s static field "${ClientUtil.capitalize(field)}"`);

                if (!focusSet) {
                    fieldCtrl.focus();
                    focusSet = true;
                }
            }
            else {
                notificationInfo.contentsStaticFieldsValue.email.signature[field] = fieldCtrl.value;
            }
        });
    }

    // Return validation result
    if (errMsgs.length > 0) {
        callback(errMsgs);
    }
    else {
        callback(null, notificationInfo);
    }
}


// Module code
//

Template.newNotification.onCreated(function () {
    this.state = new ReactiveDict();

    this.state.set('errMsgs', []);
    this.state.set('infoMsg', undefined);
    this.state.set('infoMsgType', 'info');

    this.state.set('initialized', false);
    this.state.set('hasExpirationDate', false);
    this.state.set('notificationCreated', false);

    // Subscribe to receive database docs/recs updates
    this.subscribe('uiNotificationTemplateRecord', this.data.uiNotificationTemplate_id);

    this.state.set('contentsStaticFields', undefined);

    // Load UI notification template's contents static fields
    Meteor.call('getUINotificationTemplateContentsStaticFields', this.data.uiNotificationTemplate_id, (err, contentsStaticFields) => {
        if (err) {
            console.error('Error calling getUINotificationTemplateContentsStaticFields() remote method:', err);
        }
        else {
            this.state.set('contentsStaticFields', contentsStaticFields);
        }
    });
});

Template.newNotification.events({
    'click #frmNewNotification'(event, template) {
        if (!template.state.get('initialized')) {
            initFormFields(template);
        }
    },
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
    'submit #frmNewNotification'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        const form = event.target;

        // Clear alert messages
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');

        validateFormData(form, template, (errMsgs, notificationInfo) => {
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

                // Call remote method to create new UI notification
                Meteor.call('createNewUINotification', template.data.uiNotificationTemplate_id, notificationInfo, (error) => {
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
                        // Indicate that notification has been successfully created
                        template.state.set('notificationCreated', true);
                        template.state.set('infoMsg', 'Notification successfully created.');
                        template.state.set('infoMsgType', 'success');
                    }

                    // Force page to scroll to top so user can see result message
                    $(window).scrollTop(0);
                });
            }
        });
    }
});

Template.newNotification.helpers({
    uiNotificationTemplate() {
        return Catenis.db.collection.UINotificationTemplate.findOne({
            _id: Template.instance().data.uiNotificationTemplate_id
        });
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
    isNotificationCreated() {
        return Template.instance().state.get('notificationCreated');
    },
    showCreateButton() {
        return !Template.instance().state.get('notificationCreated');
    },
    contentsStaticFields() {
        return Template.instance().state.get('contentsStaticFields');
    },
    hasExpirationDate() {
        return Template.instance().state.get('hasExpirationDate');
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
