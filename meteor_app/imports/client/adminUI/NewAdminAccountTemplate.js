/**
 * Created by Claudio on 2018-11-15.
 */

//console.log('[NewAdminAccountTemplate.js]: This code just ran.');

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
//import { Catenis } from '../ClientCatenis';

// Import template UI
import './NewAdminAccountTemplate.html';

// Definition of module (private) functions

function validateFormData(form, errMsgs) {
    const accountInfo = {};
    let hasError = false;

    accountInfo.username = form.username.value ? form.username.value.trim() : '';

    if (accountInfo.username.length === 0) {
        // Username not supplied. Report error
        errMsgs.push('Please enter a username');
        hasError = true;
    }

    accountInfo.password = form.password.value ? form.password.value.trim() : '';

    if (accountInfo.password.length === 0) {
        // Password not supplied. Report error
        errMsgs.push('Please enter a password');
        hasError = true;
    }

    accountInfo.description = form.description.value ? form.description.value.trim() : '';

    if (accountInfo.description.length === 0) {
        // Description not supplied. Report error
        errMsgs.push('Please enter a description');
        hasError = true;
    }

    return !hasError ? accountInfo : undefined;
}


// Module code
//

Template.newAdminAccount.onCreated(function () {
    this.state = new ReactiveDict();

    this.state.set('errMsgs', []);
    this.state.set('infoMsg', undefined);
    this.state.set('infoMsgType', 'info');

    this.state.set('accountCreated', false);
});

Template.newAdminAccount.onDestroyed(function () {
});

Template.newAdminAccount.events({
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
        //      both solutions cause a page reload, whilst clicking on th link does not)
        template.find('#lnkCancel').click();
    },
    'submit #frmNewAdminAccount'(event, template) {
        event.preventDefault();

        const form = event.target;

        // Clear alert messages
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');
        let errMsgs = [];
        let accountInfo;

        if ((accountInfo = validateFormData(form, errMsgs))) {
            // Disable buttons
            const btnCancel = template.find('#btnCancel');
            const btnCreate = template.find('#btnCreate');
            btnCancel.disabled = true;
            btnCreate.disabled = true;

            // Display alert message indicating that request is being processed
            template.state.set('infoMsg', 'Your request is being processed. Please wait.');

            // Call remote method to create new admin account
            Meteor.call('createAdminAccount', accountInfo.username, accountInfo.password, accountInfo.description, (error, adminUserId) => {
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
                    // Indicate that admin account has been successfully created
                    template.state.set('accountCreated', true);
                    template.state.set('infoMsg', util.format('New admin account (user ID: %s) successfully created.', adminUserId));
                    template.state.set('infoMsgType', 'success');
                }
            });
        }
        else {
            template.state.set('errMsgs', errMsgs);
        }
    }
});

Template.newAdminAccount.helpers({
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
    isAccountCreated() {
        return Template.instance().state.get('accountCreated');
    },
    showCreateButton() {
        return !Template.instance().state.get('accountCreated');
    }
});
