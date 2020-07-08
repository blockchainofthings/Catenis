/**
 * Created by claudio on 2020-06-22
 */

//console.log('[ClientEditProfileTemplate.js]: This code just ran.');

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
import { ClientUtil } from '../ClientUtil';

// Import template UI
import './ClientEditProfileTemplate.html';
import moment from 'moment-timezone';

// Import dependent templates


// Definition of module (private) functions
//

function loadClientData(template) {
    const client = Catenis.db.collection.Client.findOne();

    template.state.set('clientName', client.props.name);
    template.state.set('clientFirstName', client.props.firstName);
    template.state.set('clientLastName', client.props.lastName);
    template.state.set('clientCompany', client.props.company);
    template.state.set('clientTimeZone', client.timeZone);

    const clientUser = Meteor.users.findOne({_id: client.user_id});

    template.state.set('clientEmail', ClientUtil.getUserEmail(clientUser));
}

function validateFormData(form, errMsgs, template) {
    const clientInfo = {};
    let hasError = false;

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

Template.editClientProfile.onCreated(function () {
    this.state = new ReactiveDict();

    this.state.set('errMsgs', []);
    this.state.set('infoMsg', undefined);
    this.state.set('infoMsgType', 'info');

    this.state.set('fieldsChanged', false);
    this.state.set('clientUpdated', false);

    this.state.set('needsConfirmEmail', false);
    this.state.set('emailConfirmed', false);
    this.state.set('emailMismatch', false);

    this.state.set('clientFirstName', undefined);
    this.state.set('clientLastName', undefined);
    this.state.set('clientCompany', undefined);
    this.state.set('clientEmail', undefined);
    this.state.set('clientTimeZone', undefined);

    // Subscribe to receive database docs/recs updates
    let clientRecLoaded = false;
    let clientUserRecLoaded = false;

    this.clientRecordSubs = this.subscribe('currentClient', () => {
        // Indicate that client record has been loaded
        clientRecLoaded = true;

        if (clientUserRecLoaded) {
            loadClientData(this);
        }
    });

    this.clientUserSubs = this.subscribe('currentClientUser', () => {
        // Indicate that client user record has been loaded
        clientUserRecLoaded = true;

        if (clientRecLoaded) {
            loadClientData(this);
        }
    });
});

Template.editClientProfile.onDestroyed(function () {
    if (this.clientRecordSubs) {
        this.clientRecordSubs.stop();
    }

    if (this.clientUserSubs) {
        this.clientUserSubs.stop();
    }
});

Template.editClientProfile.events({
    'click #btnDismissInfo'(event, template) {
        // Clear info message
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');
    },
    'click #btnDismissError'(event, template) {
        // Clear error message
        template.state.set('errMsgs', []);
    },
    'change #txtFirstName'(event, template) {
        // Indicate that form field has changed
        template.state.set('fieldsChanged', true);
    },
    'change #txtLastName'(event, template) {
        // Indicate that form field has changed
        template.state.set('fieldsChanged', true);
    },
    'change #selTimeZone'(event, template) {
        // Indicate that form field has changed
        template.state.set('fieldsChanged', true);
    },
    'change #txtEmail'(event, template) {
        // Indicate that form field has changed
        template.state.set('fieldsChanged', true);

        // Indicate that e-mail needs to be confirmed
        template.state.set('needsConfirmEmail', true);
        template.state.set('emailConfirmed', false);
    },
    'change #txtCompanyName'(event, template) {
        // Indicate that form field has changed
        template.state.set('fieldsChanged', true);
    },
    'click #btnDismissErrorConfirmEmail'(event, template) {
        template.state.set('emailMismatch', false);
    },
    'click #btnConfirmEmail'(event, template) {
        // Prepare for e-mail confirmation
        event.target.form.confirmEmail.value = '';

        template.state.set('emailMismatch', false);
    },
    'hidden.bs.modal #divConfirmEmail'(event, template) {
        // Modal panel has been closed. Clear confirm email form
        template.find('#frmEditClient').confirmEmail.value = '';

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

            // Close modal panel
            $('#divConfirmEmail').modal('hide');
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
    'submit #frmEditProfile'(event, template) {
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

            // Call remote method to update client
            Meteor.call('updateCurrentClient', clientInfo, (error) => {
                // Reenable buttons
                btnCancel.disabled = false;
                btnUpdate.disabled = false;

                if (error) {
                    template.state.set('errMsgs', [
                        error.toString()
                    ]);
                }
                else {
                    // Indicate that client has been successfully updated
                    template.state.set('clientUpdated', true);
                    template.state.set('infoMsg', 'Profile successfully update.');
                    template.state.set('infoMsgType', 'success');
                }
            });
        }
        else {
            template.state.set('errMsgs', errMsgs);
        }
    }
});

Template.editClientProfile.helpers({
    client() {
        return Catenis.db.collection.Client.findOne({_id: Template.instance().data.client_id});
    },
    clientData() {
        const template = Template.instance();

        return {
            name: template.state.get('clientName'),
            firstName: template.state.get('clientFirstName'),
            lastName: template.state.get('clientLastName'),
            company: template.state.get('clientCompany'),
            email: template.state.get('clientEmail'),
            timeZone: template.state.get('clientTimeZone')
        };
    },
    isClientUpdated() {
        return Template.instance().state.get('clientUpdated');
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
    timeZones(currTZName) {
        const now = Date.now();

        // Return time zones sorted by offset and name
        return moment.tz.names().map((tzName) => {
            const mt = moment.tz(now, tzName);

            return {
                name: tzName + mt.format(' (UTCZ)'),
                offset: mt.utcOffset(),
                value: tzName,
                selected: tzName === currTZName ? 'selected' : ''
            };
        }).sort((tz1, tz2) => tz1.offset === tz2.offset ? (tz1.name < tz2.name ? -1 : (tz1.name > tz2.name ? 1 : 0)) : tz1.offset - tz2.offset);
    },
    showUpdateButton() {
        const template = Template.instance();

        return template.state.get('fieldsChanged') && !template.state.get('clientUpdated');
    },
    showConfirmEmailButton() {
        const template = Template.instance();

        return template.state.get('needsConfirmEmail') && !template.state.get('emailConfirmed');
    },
    emailsDoNotMatch() {
        return Template.instance().state.get('emailMismatch');
    }
});