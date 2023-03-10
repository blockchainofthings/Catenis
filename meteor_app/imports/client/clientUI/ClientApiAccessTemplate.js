/**
 * Created by Claudio on 2018-10-10.
 */

//console.log('[ClientApiAccessTemplate.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import ClipboardJS from 'clipboard';
// Meteor packages
import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';
import { ReactiveDict } from 'meteor/reactive-dict';

// References code in other (Catenis) modules on the client
//import { Catenis } from '../ClientCatenis';

// Import template UI
import './ClientApiAccessTemplate.html';

// Import dependent templates

// Module variables
const confirmPhrase = 'yes, i do confirm it';


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

Template.clientApiAccess.onCreated(function () {
    this.state = new ReactiveDict();

    this.state.set('errMsgs', []);
    this.state.set('infoMsg', undefined);
    this.state.set('infoMsgType', 'info');

    this.state.set('apiAccessSecret', undefined);
    this.state.set('displayResetApiAccessSecretForm', 'none');
    this.state.set('displayResetApiAccessSecretButton', 'none');
});

Template.clientApiAccess.onDestroyed(function () {
});

Template.clientApiAccess.events({
    'click #btnDismissInfo'(event, template) {
        // Clear info message
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');
    },
    'click #btnDismissError'(event, template) {
        // Clear error message
        template.state.set('errMsgs', []);
    },
    'click #btnDefaultApiAccessSecret'(event, template) {
        new ClipboardJS('#btnCopyClipboard', {
            container: document.getElementById('divClientAPIAccessSecret')
        });

        // Reset alert messages
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');

        // Clear local copy of API access secret
        template.state.set('apiAccessSecret', undefined);
        // Make sure that form to reset API access secret is not displayed
        template.state.set('displayResetApiAccessSecretForm', 'none');

        // About to show client's shared API key modal window
        Meteor.call('getCurrentClientApiAccessSecret', (error, apiAccessSecret) => {
            if (error) {
                const errMsgs = template.state.get('errMsgs');
                errMsgs.push('Error retrieving client API access secret: ' + error.toString());
                template.state.set('errMsgs', errMsgs);

                // Close modal panel
                $('#divClientAPIAccessSecret').modal('hide');
            }
            else {
                template.state.set('apiAccessSecret', apiAccessSecret);
            }
        });
    },
    'hidden.bs.modal #divClientAPIAccessSecret'(event, template) {
        // Modal panel has been closed. Delete local copy of API access secret
        template.state.set('apiAccessSecret', undefined);

        // Make sure that button used to activate modal panel is not selected
        $('#btnDefaultApiAccessSecret').blur();
    },
    'click #btnResetApiAccessSecret'(event, template) {
        // Reset reset all devices too option
        $('#cbxResetAllDevices')[0].checked = false;

        // Reset confirmation
        $('#itxActionConfirmation')[0].value = '';
        template.state.set('displayResetApiAccessSecretButton', 'none');

        // Display form to reset client's shared API access secret
        template.state.set('displayResetApiAccessSecretForm', 'block');

        return false;
    },
    'click #btnCancelResetApiAccessSecret'(event, template) {
        // Hide form to reset API access secret
        template.state.set('displayResetApiAccessSecretForm', 'none');

        return false;
    },
    'input #itxActionConfirmation'(event, template) {
        // Suppress spaces from beginning of input
        let inputValue = event.target.value = event.target.value.replace(/^\s+/, '');

        if (inputValue.length > confirmPhrase.length) {
            // Limit length of input
            inputValue = event.target.value = inputValue.substring(0, confirmPhrase.length);
        }

        // Check if input matches confirmation phrase
        if (inputValue.toLowerCase() === confirmPhrase) {
            // Show button to confirm action
            template.state.set('displayResetApiAccessSecretButton', 'inline');
        }
        else {
            // Hide button to confirm action
            template.state.set('displayResetApiAccessSecretButton', 'none');
        }
    },
    'submit #formClientApiAccessSecret'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        const form = event.target;
        let confirmMsg = 'LAST CHANCE!\n\nIf you proceed, the shared API access secret will be reset';

        if (form.resetAllDevices.checked) {
            confirmMsg += ', ALONG WITH the API access secret FOR ALL DEVICES'
        }

        confirmMsg += '.\n\nPLEASE NOTE THAT THIS ACTION CANNOT BE UNDONE.';

        if (confirm(confirmMsg)) {
            // Reset alert messages
            template.state.set('errMsgs', []);
            template.state.set('infoMsg', undefined);
            template.state.set('infoMsgType', 'info');

            Meteor.call('resetCurrentClientApiAccessSecret', form.resetAllDevices.checked, (error, key) => {
                if (error) {
                    const errMsgs = template.state.get('errMsgs');
                    errMsgs.push('Error resetting shared API access secret: ' + error.toString());
                    template.state.set('errMsgs', errMsgs);
                }
                else {
                    template.state.set('infoMsg', 'Shared API access secret successfully reset.');
                    template.state.set('infoMsgType', 'success');
                }
            });

            // Close modal panel
            $('#divClientAPIAccessSecret').modal('hide');
        }
        else {
            $('#btnCancelResetApiAccessSecret').click();
        }
    }
});

Template.clientApiAccess.helpers({
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
    clientApiAccessSecret() {
        return Template.instance().state.get('apiAccessSecret');
    },
    displayResetApiAccessSecretForm() {
        return Template.instance().state.get('displayResetApiAccessSecretForm');
    },
    reverseDisplay(display) {
        return display === 'none' ? 'block' : 'none';
    },
    displayResetApiAccessSecretButton() {
        return Template.instance().state.get('displayResetApiAccessSecretButton');
    }
});
