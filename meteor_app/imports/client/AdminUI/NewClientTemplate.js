/**
 * Created by Claudio on 2017-05-30.
 */

//console.log('[NewClientTemplate.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import util from 'util';
// Third-party node modules
import moment from 'moment-timezone';
// Meteor packages
import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';
import { ReactiveDict } from 'meteor/reactive-dict';

// References code in other (Catenis) modules on the client
import { Catenis } from '../ClientCatenis';

// Import template UI
import './NewClientTemplate.html';

// Definition of module (private) functions

function validateFormData(form, errMsgs, template) {
    const clientInfo = {};
    let hasError = false;

    clientInfo.name = form.clientName.value ? form.clientName.value.trim() : '';

    if (clientInfo.name.length === 0) {
        // Client name not supplied. Report error
        errMsgs.push('Please enter a client name');
        hasError = true;
    }

    clientInfo.username = form.username.value ? form.username.value.trim() : '';

    if (clientInfo.username.length === 0) {
        // Username not supplied. Report error
        errMsgs.push('Please enter a username');
        hasError = true;
    }

    clientInfo.firstName = form.firstName.value ? form.firstName.value.trim() : undefined;
    clientInfo.lastName = form.lastName.value ? form.lastName.value.trim() : undefined;
    clientInfo.company= form.companyName.value ? form.companyName.value.trim() : undefined;

    if ((!clientInfo.firstName || clientInfo.firstName.length === 0) && (!clientInfo.lastName
        || clientInfo.lastName.length === 0) && (!clientInfo.company || clientInfo.company.length === 0)) {
        // Neither first name, last name nor company name supplied. Report error
        errMsgs.push('Please enter at least one of: first name, last name, or company');
        hasError = true;
    }

    clientInfo.email = form.email.value ? form.email.value.trim() : '';

    if (clientInfo.email.length === 0) {
        // Email not supplied. Report error
        errMsgs.push('Please enter an email address');
        hasError = true;
    }
    else {
        if (template.state.get('needsConfirmEmail') && !template.state.get('emailConfirmed')) {
            errMsgs.push('Please confirm email address');
            hasError =true;
        }
    }

    clientInfo.timeZone = form.timeZone.value;

    return !hasError ? clientInfo : undefined;
}


// Module code
//

Template.newClient.onCreated(function () {
    this.state = new ReactiveDict();

    this.state.set('errMsgs', []);
    this.state.set('infoMsg', undefined);
    this.state.set('infoMsgType', 'info');

    this.state.set('clientCreated', false);

    this.state.set('needsConfirmEmail', false);
    this.state.set('emailConfirmed', false);
    this.state.set('emailMismatch', false);
});

Template.newClient.onDestroyed(function () {
});

Template.newClient.events({
    'click #btnDismissError'(events, template) {
        // Clear error message
        template.state.set('errMsgs', []);
    },
    'click #btnDismissInfo'(events, template) {
        // Clear info message
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');
    },
    'change #txtClientName'(event, template) {
        const clientName = event.target.value;
        const usernameCtrl = template.$('#txtUsername')[0];

        if (!usernameCtrl.value || usernameCtrl.value.length === 0) {
            usernameCtrl.value = clientName.replace(/(\s|[^\w])+/g,'_');
        }
    },
    'change #txtEmail'(events, template) {
        // Indicate that form field has changed
        template.state.set('fieldsChanged', true);

        // Indicate that e-mail needs to be confirmed
        template.state.set('needsConfirmEmail', true);
        template.state.set('emailConfirmed', false);
    },
    'click #btnDismissErrorConfirmEmail'(events, template) {
        template.state.set('emailMismatch', false);
    },
    'click #btnConfirmEmail'(events, template) {
        // Prepare for e-mail confirmation
        events.target.form.confirmEmail.value = '';

        template.state.set('emailMismatch', false);
    },
    'click #btnEmailConfirmClose'(events, template) {
        // Clear confirm email form
        events.target.form.confirmEmail.value = '';

        template.state.set('emailMismatch', false);
    },
    'click #checkEmailValidity'(event, template) {
        const form = event.target.form;

        const email = form.email.value ? form.email.value.trim() : '';
        const confirmEmail = form.confirmEmail.value ? form.confirmEmail.value.trim() : '';

        if (confirmEmail.length === 0) {
            form.confirmEmail.focus();
        }
        else if (email === confirmEmail) {
            template.state.set('emailConfirmed', true);

            // Close modal form backdrop
            $('#confirmEmail').modal('hide');
        }
        else{
            template.state.set('emailMismatch', true);
            form.confirmEmail.focus();
        }
    },
    'click #btnCancel'(event, template) {
        // Note: we resource to this unconventional solution so we can disable the Cancel button and,
        //      at the same time, make it behave the same way as when a link is clicked (which we
        //      cannot achieve with either window.location.href = '<url>' or document.location = '<url>';
        //      both solutions cause a page reload, whilst clicking on th link does not)
        template.find('#lnkCancel').click();
    },
    'submit #frmNewClient'(event, template) {
        event.preventDefault();

        const form = event.target;

        // Clear alert messages
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');
        let errMsgs = [];
        let clientInfo;

        if ((clientInfo = validateFormData(form, errMsgs, template))) {
            // Disable buttons
            const btnCancel = template.find('#btnCancel');
            const btnUpdate = template.find('#btnUpdate');
            btnCancel.disabled = true;
            btnUpdate.disabled = true;

            // Display alert message indicating that request is being processed
            template.state.set('infoMsg', 'Your request is being processed. Please wait.');

            // Call remote method to create new client
            Meteor.call('createNewClient', Catenis.ctnHubNodeIndex, clientInfo, (error, clientId) => {
                // Reenable buttons
                btnCancel.disabled = false;
                btnUpdate.disabled = false;

                if (error) {
                    // Clear info alert message, and display error message
                    template.state.set('infoMsg', undefined);

                    template.state.set('errMsgs', [
                        error.toString()
                    ]);
                }
                else {
                    // Indicate that client has been successfully created
                    template.state.set('clientCreated', true);
                    template.state.set('infoMsg', util.format('New client (client ID: %s) successfully created.', clientId));
                    template.state.set('infoMsgType', 'success');
                }
            });
        }
        else {
            template.state.set('errMsgs', errMsgs);
        }
    }
});

Template.newClient.helpers({
    hasError: function () {
        return Template.instance().state.get('errMsgs').length > 0;
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
    isClientCreated() {
        return Template.instance().state.get('clientCreated');
    },
    timeZones() {
        const localTZ = moment.tz.guess();
        const now = Date.now();

        // Return time zones sorted by offset and name
        return moment.tz.names().map((tzName) => {
            const mt = moment.tz(now, tzName);

            return {
                name: tzName + mt.format(' (UTCZ)'),
                offset: mt.utcOffset(),
                value: tzName,
                selected: tzName === localTZ ? 'selected' : ''
            };
        }).sort((tz1, tz2) => tz1.offset === tz2.offset ? (tz1.name < tz2.name ? -1 : (tz1.name > tz2.name ? 1 : 0)) : tz1.offset - tz2.offset);
    },
    showCreateButton() {
        return !Template.instance().state.get('clientCreated');
    },
    showConfirmEmailButton() {
        const template = Template.instance();

        return template.state.get('needsConfirmEmail') && !template.state.get('emailConfirmed');
    },
    emailsDoNotMatch() {
        return Template.instance().state.get('emailMismatch');
    }
});
