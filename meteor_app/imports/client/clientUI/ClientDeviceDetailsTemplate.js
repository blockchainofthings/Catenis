/**
 * Created by Claudio on 2017-10-12.
 */

//console.log('[ClientDeviceDetailsTemplate.js]: This code just ran.');

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
import { Catenis } from '../ClientCatenis';
import { DeviceShared } from '../../both/DeviceShared';

// Import template UI
import './ClientDeviceDetailsTemplate.html';

// Import dependent templates
import './ClientEditDeviceTemplate.js';

// Module variables
const confirmPhrase = 'yes, i do confirm it';


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

Template.clientDeviceDetails.onCreated(function () {
    this.state = new ReactiveDict();

    this.state.set('errMsgs', []);
    this.state.set('infoMsg', undefined);
    this.state.set('infoMsgType', 'info');

    this.state.set('displayActivateDeviceSubmitButton', 'none');
    this.state.set('displayDeactivateDeviceSubmitButton', 'none');
    this.state.set('displayDeleteDeviceSubmitButton', 'none');

    this.state.set('apiAccessSecret', undefined);
    this.state.set('displayResetApiAccessSecretForm', 'none');
    this.state.set('displayResetApiAccessSecretButton', 'none');

    // Subscribe to receive database docs/recs updates
    this.currClntDeviceRecordSubs = this.subscribe('currentClientDeviceRecord', this.data.deviceIndex);
    this.currClntDevicesInfoSubs = this.subscribe('currentClientDevicesInfo');
});

Template.clientDeviceDetails.onDestroyed(function () {
    if (this.currClntDeviceRecordSubs) {
        this.currClntDeviceRecordSubs.stop();
    }

    if (this.currClntDevicesInfoSubs) {
        this.currClntDevicesInfoSubs.stop();
    }
});

Template.clientDeviceDetails.events({
    'click #btnDismissInfo'(event, template) {
        // Clear info message
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');
    },
    'click #btnDismissError'(event, template) {
        // Clear error message
        template.state.set('errMsgs', []);
    },
    'click #btnApiAccessSecret'(event, template) {
        new ClipboardJS('#btnCopyClipboard', {
            container: document.getElementById('divDeviceAPIAccessSecret')
        });

        // Reset alert messages
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');

        // Clear local copy of API access secret
        template.state.set('apiAccessSecret', undefined);
        // Make sure that form to reset API access secret is not displayed
        template.state.set('displayResetApiAccessSecretForm', 'none');

        // About to show device's API key modal window
        Meteor.call('getCurrentClientDeviceApiAccessSecret', template.data.deviceIndex, (error, apiAccessSecret) => {
            if (error) {
                console.log('Error retrieving device API access secret:', error);
            }
            else {
                template.state.set('apiAccessSecret', apiAccessSecret);
            }
        });
    },
    'hidden.bs.modal #divDeviceAPIAccessSecret'(event, template) {
        // Modal panel has been closed. Delete local copy of API access secret
        template.state.set('apiAccessSecret', undefined);

        // Make sure that button used to activate modal panel is not selected
        $('#btnApiAccessSecret').blur();
    },
    'click #btnResetApiAccessSecret'(event, template) {
        // Reset to client shared API access secret option
        $('#cbxResetToClientDefault')[0].checked = false;

        // Reset confirmation
        $('#itxResetApitAccessSecretConfirmation')[0].value = '';
        template.state.set('displayResetApiAccessSecretButton', 'none');

        // Display form to reset device's API access secret
        template.state.set('displayResetApiAccessSecretForm', 'block');

        return false;
    },
    'click #btnCancelResetApiAccessSecret'(event, template) {
        // Hide form to reset API access secret
        template.state.set('displayResetApiAccessSecretForm', 'none');

        return false;
    },
    'input #itxResetApitAccessSecretConfirmation'(event, template) {
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
    'submit #frmDeviceApiAccessSecret'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        const form = event.target;
        const confirmMsg = 'LAST CHANCE!\n\nIf you proceed, the device\'s API access secret will be reset.\n\nPLEASE NOTE THAT THIS ACTION CANNOT BE UNDONE.';

        if (confirm(confirmMsg)) {
            // Reset alert messages
            template.state.set('errMsgs', []);
            template.state.set('infoMsg', undefined);
            template.state.set('infoMsgType', 'info');

            Meteor.call('resetCurrentClientDeviceApiAccessSecret', Template.instance().data.deviceIndex , form.resetToClientDefault.checked, (error, key) => {
                if (error) {
                    const errMsgs = template.state.get('errMsgs');
                    errMsgs.push('Error resetting device\'s API access secret: ' + error.toString());
                    template.state.set('errMsgs', errMsgs);
                }
                else {
                    template.state.set('infoMsg', 'Successfully reset device\'s API access secret');
                    template.state.set('infoMsgType', 'success');
                }
            });

            // Close modal panel
            $('#divDeviceAPIAccessSecret').modal('hide');
        }
        else {
            $('#btnCancelResetApiAccessSecret').click();
        }
    },
    'click #btnDeactivateDevice'(event, template) {
        event.preventDefault();

        // Reset alert messages
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');

        // Reset action confirmation
        $('#itxDeactivateDeviceConfirmation')[0].value = '';
        template.state.set('displayDeactivateDeviceSubmitButton', 'none');
    },
    'hidden.bs.modal #divDeactivateDevice'(event, template) {
        // Modal panel has been closed. Make sure that button used to
        //  activate modal panel is not selected
        $('#btnDeactivateDevice').blur();
    },
    'input #itxDeactivateDeviceConfirmation'(event, template) {
        // Suppress spaces from beginning of input
        let inputValue = event.target.value = event.target.value.replace(/^\s+/, '');

        if (inputValue.length > confirmPhrase.length) {
            // Limit length of input
            inputValue = event.target.value = inputValue.substring(0, confirmPhrase.length);
        }

        // Check if input matches confirmation phrase
        if (inputValue.toLowerCase() === confirmPhrase) {
            // Show button to confirm action
            template.state.set('displayDeactivateDeviceSubmitButton', 'inline');
        }
        else {
            // Hide button to confirm action
            template.state.set('displayDeactivateDeviceSubmitButton', 'none');
        }
    },
    'submit #frmDeactivateDevice'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        // Close modal panel
        $('#divDeactivateDevice').modal('hide');

        // Reset alert messages
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');

        Meteor.call('deactivateCurrentClientDevice', template.data.deviceIndex, (error) => {
            if (error) {
                const errMsgs = template.state.get('errMsgs');
                errMsgs.push('Error deactivating device: ' + error.toString());
                template.state.set('errMsgs', errMsgs);
            }
            else {
                template.state.set('infoMsg', 'Device successfully deactivated');
                template.state.set('infoMsgType', 'success');
            }
        });
    },
    'click #btnActivateDevice'(event, template) {
        event.preventDefault();

        // Reset alert messages
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');

        // Reset action confirmation
        $('#itxActivateDeviceConfirmation')[0].value = '';
        template.state.set('displayActivateDeviceSubmitButton', 'none');
    },
    'hidden.bs.modal #divActivateDevice'(event, template) {
        // Modal panel has been closed. Make sure that button used to
        //  activate modal panel is not selected
        $('#btnActivateDevice').blur();
    },
    'input #itxActivateDeviceConfirmation'(event, template) {
        // Suppress spaces from beginning of input
        let inputValue = event.target.value = event.target.value.replace(/^\s+/, '');

        if (inputValue.length > confirmPhrase.length) {
            // Limit length of input
            inputValue = event.target.value = inputValue.substring(0, confirmPhrase.length);
        }

        // Check if input matches confirmation phrase
        if (inputValue.toLowerCase() === confirmPhrase) {
            // Show button to confirm action
            template.state.set('displayActivateDeviceSubmitButton', 'inline');
        }
        else {
            // Hide button to confirm action
            template.state.set('displayActivateDeviceSubmitButton', 'none');
        }
    },
    'submit #frmActivateDevice'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        // Close modal panel
        $('#divActivateDevice').modal('hide');

        // Reset alert messages
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');

        Meteor.call('activateCurrentClientDevice', template.data.deviceIndex, (error) => {
            if (error) {
                const errMsgs = template.state.get('errMsgs');
                errMsgs.push('Error activating device: ' + error.toString());
                template.state.set('errMsgs', errMsgs);
            }
            else {
                template.state.set('infoMsg', 'Device successfully activated');
                template.state.set('infoMsgType', 'success');
            }
        });
    },
    'click #btnDeleteDevice'(event, template) {
        event.preventDefault();

        // Reset alert messages
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');

        // Reset action confirmation
        $('#itxDeleteDeviceConfirmation')[0].value = '';
        template.state.set('displayDeleteDeviceSubmitButton', 'none');
    },
    'hidden.bs.modal #divDeleteDevice'(event, template) {
        // Modal panel has been closed. Make sure that button used to
        //  activate modal panel is not selected
        $('#btnDeleteDevice').blur();
    },
    'input #itxDeleteDeviceConfirmation'(event, template) {
        // Suppress spaces from beginning of input
        let inputValue = event.target.value = event.target.value.replace(/^\s+/, '');

        if (inputValue.length > confirmPhrase.length) {
            // Limit length of input
            inputValue = event.target.value = inputValue.substring(0, confirmPhrase.length);
        }

        // Check if input matches confirmation phrase
        if (inputValue.toLowerCase() === confirmPhrase) {
            // Show button to confirm action
            template.state.set('displayDeleteDeviceSubmitButton', 'inline');
        }
        else {
            // Hide button to confirm action
            template.state.set('displayDeleteDeviceSubmitButton', 'none');
        }
    },
    'submit #frmDeleteDevice'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        const confirmMsg = 'LAST CHANCE!\n\nIf you proceed, the virtual device will be DELETED.\n\nPLEASE NOTE THAT THIS ACTION CANNOT BE UNDONE.';

        if (confirm(confirmMsg)) {
            // Close modal panel
            $('#divDeleteDevice').modal('hide');

            // Reset alert messages
            template.state.set('errMsgs', []);
            template.state.set('infoMsg', undefined);
            template.state.set('infoMsgType', 'info');

            Meteor.call('deleteCurrentClientDevice', template.data.deviceIndex, (error) => {
                if (error) {
                    const errMsgs = template.state.get('errMsgs');
                    errMsgs.push('Error deleting device: ' + error.toString());
                    template.state.set('errMsgs', errMsgs);
                }
                else {
                    template.state.set('infoMsg', 'Device successfully deleted');
                    template.state.set('infoMsgType', 'success');
                }
            });
        }
        else {
            // Close modal panel
            $('#divDeleteDevice').modal('hide');
        }
    }
});

Template.clientDeviceDetails.helpers({
    device() {
        return Catenis.db.collection.Device.findOne();
    },
    clientDevicesInfo() {
        return Catenis.db.collection.ClientDevicesInfo.findOne(1);
    },
    deviceTitle(device) {
        return device.props.name || device.deviceId;
    },
    statusColor(status) {
        let color;

        switch (status) {
            case DeviceShared.status.new.name:
                color = 'blue';
                break;

            case DeviceShared.status.pending.name:
                color = 'gold';
                break;

            case DeviceShared.status.active.name:
                color = 'green';
                break;

            case DeviceShared.status.inactive.name:
                color = 'lightgray';
                break;

            case DeviceShared.status.deleted.name:
                color = 'red';
                break;
        }

        return color;
    },
    booleanValue(val) {
        return (!!val).toString();
    },
    isActiveDevice(device) {
        return device.status === DeviceShared.status.active.name;
    },
    isDeletedDevice(device) {
        return device.status === DeviceShared.status.deleted.name;
    },
    canActiveDevice(device, clientDevicesInfo) {
        return device.status === DeviceShared.status.inactive.name && clientDevicesInfo.numDevicesInUse <= clientDevicesInfo.maxAllowedDevices;
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
    deviceApiAccessSecret() {
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
    },
    displayDeactivateDeviceSubmitButton() {
        return Template.instance().state.get('displayDeactivateDeviceSubmitButton');
    },
    displayActivateDeviceSubmitButton() {
        return Template.instance().state.get('displayActivateDeviceSubmitButton');
    },
    displayDeleteDeviceSubmitButton() {
        return Template.instance().state.get('displayDeleteDeviceSubmitButton');
    }
});
