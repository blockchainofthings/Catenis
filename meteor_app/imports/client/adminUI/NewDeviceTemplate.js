/**
 * Created by Claudio on 2017-05-30.
 */

//console.log('[NewDeviceTemplate.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import util from 'util';
// Third-party node modules
//import config from 'config';
// Meteor packages
import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';
import { ReactiveDict } from 'meteor/reactive-dict';

// References code in other (Catenis) modules on the client
import { Catenis } from '../ClientCatenis';

// Import template UI
import './NewDeviceTemplate.html';

// Module variables
const confirmPhrase = 'yes, i do confirm it';


// Definition of module (private) functions

function validateFormData(form, errMsgs, template) {
    const deviceInfo = {};
    let hasError = false;

    deviceInfo.name = form.deviceName.value ? form.deviceName.value.trim() : '';

    if (deviceInfo.name.length === 0) {
        // Device name not supplied. Report error
        errMsgs.push('Please enter a device name');
        hasError = true;
    }

    deviceInfo.prodUniqueId = form.prodUniqueId.value ? form.prodUniqueId.value.trim() : '';
    deviceInfo.public = form.public.checked;
    deviceInfo.assignClientAPIAccessSecret = form.assignClientAPIAccessSecret.checked;

    return !hasError ? deviceInfo : undefined;
}


// Module code
//

Template.newDevice.onCreated(function () {
    this.state = new ReactiveDict();

    this.state.set('errMsgs', []);
    this.state.set('infoMsg', undefined);
    this.state.set('infoMsgType', 'info');

    this.state.set('displayConfirmNewDeviceSubmitButton', 'none');
    this.state.set('validatedDeviceInfo', undefined);
    this.state.set('deviceCreated', false);
});

Template.newDevice.onDestroyed(function () {
});

Template.newDevice.events({
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
        template.find('#lnkCancel').click();
    },
    'click #btnConfirmNewDevice'(event, template) {
        event.preventDefault();

        // Reset action confirmation
        $('#itxNewDeviceConfirmation')[0].value = '';
        template.state.set('displayConfirmNewDeviceSubmitButton', 'none');
    },
    'hidden.bs.modal #divConfirmNewDevice'(event, template) {
        // Modal panel has been closed. Make sure that button used to
        //  activate modal panel is not selected
        $('#btnCreate').blur();

        template.state.set('validatedDeviceInfo', undefined);
    },
    'input #itxNewDeviceConfirmation'(event, template) {
        // Suppress spaces from beginning of input
        let inputValue = event.target.value = event.target.value.replace(/^\s+/, '');

        if (inputValue.length > confirmPhrase.length) {
            // Limit length of input
            inputValue = event.target.value = inputValue.substring(0, confirmPhrase.length);
        }

        // Check if input matches confirmation phrase
        if (inputValue.toLowerCase() === confirmPhrase) {
            // Show button to confirm action
            template.state.set('displayConfirmNewDeviceSubmitButton', 'inline');
        }
        else {
            // Hide button to confirm action
            template.state.set('displayConfirmNewDeviceSubmitButton', 'none');
        }
    },
    'submit #frmConfirmNewDevice'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        // Close modal panel
        $('#divConfirmNewDevice').modal('hide');

        // Disable buttons
        const btnCancel = template.find('#btnCancel');
        const btnCreate = template.find('#btnCreate');
        btnCancel.disabled = true;
        btnCreate.disabled = true;

        // Display alert message indicating that request is being processed
        template.state.set('infoMsg', 'Your request is being processed. Please wait.');

        // Call remote method to create new device
        Meteor.call('createNewDevice', template.data.client_id, template.state.get('validatedDeviceInfo'), (error, deviceId) => {
            // Reenable buttons
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
                // Indicate that device has been successfully created
                template.state.set('deviceCreated', true);
                template.state.set('infoMsg', util.format('New device (device ID: %s) successfully created.', deviceId));
                template.state.set('infoMsgType', 'success');
            }
        });
    },
    'submit #frmNewDevice'(event, template) {
        event.preventDefault();

        const form = event.target;

        // Clear alert messages
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');
        let errMsgs = [];
        let deviceInfo;

        if ((deviceInfo = validateFormData(form, errMsgs, template))) {
            template.state.set('validatedDeviceInfo', deviceInfo);
        }
        else {
            template.state.set('errMsgs', errMsgs);
        }
    }
});

Template.newDevice.helpers({
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
    isDeviceCreated() {
        return Template.instance().state.get('deviceCreated');
    },
    showCreateButton() {
        return !Template.instance().state.get('deviceCreated');
    },
    displayConfirmNewDeviceSubmitButton() {
        return Template.instance().state.get('displayConfirmNewDeviceSubmitButton');
    },
    validatedDeviceInfo() {
        return Template.instance().state.get('validatedDeviceInfo');
    }
});
