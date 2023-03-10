/**
 * Created by Claudio on 2018-09-27.
 */

//console.log('[LicenseDetailsTemplate.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
//import config from 'config'
// Meteor packages
import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';
import { ReactiveDict } from 'meteor/reactive-dict';
import { FlowRouter } from 'meteor/kadira:flow-router';

// References code in other (Catenis) modules on the client
import { Catenis } from '../ClientCatenis';
import { LicenseShared } from '../../both/LicenseShared';

// Import template UI
import './LicenseDetailsTemplate.html';

// Import dependent templates

// Module variables
const confirmPhrase = 'yes, i do confirm it';


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

Template.licenseDetails.onCreated(function () {
    this.state = new ReactiveDict();

    this.state.set('errMsgs', []);
    this.state.set('infoMsg', undefined);
    this.state.set('infoMsgType', 'info');

    this.state.set('displayActivateLicenseSubmitButton', 'none');
    this.state.set('displayDeactivateLicenseSubmitButton', 'none');

    // Subscribe to receive database docs/recs updates
    this.licenseSubs = this.subscribe('licenseAndAssociatedActiveLicense', this.data.license_id);
});

Template.licenseDetails.onDestroyed(function () {
    if (this.licenseSubs) {
        this.licenseSubs.stop();
    }
});

Template.licenseDetails.events({
    'click #btnDismissInfo'(event, template) {
        // Clear info message
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');
    },
    'click #btnDismissError'(event, template) {
        // Clear error message
        template.state.set('errMsgs', []);
    },
    'click #btnActivateLicense'(event, template) {
        event.preventDefault();

        // Reset alert messages
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');

        // Reset action confirmation
        $('#itxActivateLicenseConfirmation')[0].value = '';
        template.state.set('displayActivateLicenseSubmitButton', 'none');
    },
    'hidden.bs.modal #divActivateLicense'(event, template) {
        // Modal panel has been closed. Make sure that button used to
        //  activate modal panel is not selected
        $('#btnActivateLicense').blur();
    },
    'input #itxActivateLicenseConfirmation'(event, template) {
        // Suppress spaces from beginning of input
        let inputValue = event.target.value = event.target.value.replace(/^\s+/, '');

        if (inputValue.length > confirmPhrase.length) {
            // Limit length of input
            inputValue = event.target.value = inputValue.substring(0, confirmPhrase.length);
        }

        // Check if input matches confirmation phrase
        if (inputValue.toLowerCase() === confirmPhrase) {
            // Show button to confirm action
            template.state.set('displayActivateLicenseSubmitButton', 'inline');
        }
        else {
            // Hide button to confirm action
            template.state.set('displayActivateLicenseSubmitButton', 'none');
        }
    },
    'submit #frmActivateLicense'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        const form = event.target;
        const confirmMsg = 'LAST CHANCE!\n\nIf you proceed, the currently ACTIVE license will be DEACTIVATED.\n\nPLEASE NOTE THAT THIS ACTION CANNOT BE UNDONE.';

        if (!form.hasActiveLicense || confirm(confirmMsg)) {
            // Close modal panel
            $('#divActivateLicense').modal('hide');

            // Reset alert messages
            template.state.set('errMsgs', []);
            template.state.set('infoMsg', undefined);
            template.state.set('infoMsgType', 'info');

            Meteor.call('activateLicense', template.data.license_id, (error) => {
                if (error) {
                    const errMsgs = template.state.get('errMsgs');
                    errMsgs.push('Error activating license: ' + error.toString());
                    template.state.set('errMsgs', errMsgs);
                }
                else {
                    template.state.set('infoMsg', 'License successfully activated');
                    template.state.set('infoMsgType', 'success');
                }
            });
        }
        else {
            // Close modal panel
            $('#divActivateLicense').modal('hide');
        }
    },
    'click #btnDeactivateLicense'(event, template) {
        event.preventDefault();

        // Reset alert messages
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');

        // Reset action confirmation
        $('#itxDeactivateLicenseConfirmation')[0].value = '';
        template.state.set('displayDeactivateLicenseSubmitButton', 'none');
    },
    'hidden.bs.modal #divDeactivateLicense'(event, template) {
        // Modal panel has been closed. Make sure that button used to
        //  activate modal panel is not selected
        $('#btnDeactivateLicense').blur();
    },
    'input #itxDeactivateLicenseConfirmation'(event, template) {
        // Suppress spaces from beginning of input
        let inputValue = event.target.value = event.target.value.replace(/^\s+/, '');

        if (inputValue.length > confirmPhrase.length) {
            // Limit length of input
            inputValue = event.target.value = inputValue.substring(0, confirmPhrase.length);
        }

        // Check if input matches confirmation phrase
        if (inputValue.toLowerCase() === confirmPhrase) {
            // Show button to confirm action
            template.state.set('displayDeactivateLicenseSubmitButton', 'inline');
        }
        else {
            // Hide button to confirm action
            template.state.set('displayDeactivateLicenseSubmitButton', 'none');
        }
    },
    'submit #frmDeactivateLicense'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        const confirmMsg = 'LAST CHANCE!\n\nIf you proceed, the license will be DEACTIVATED.\n\nPLEASE NOTE THAT THIS ACTION CANNOT BE UNDONE.';

        if (confirm(confirmMsg)) {
            // Close modal panel
            $('#divDeactivateLicense').modal('hide');

            // Reset alert messages
            template.state.set('errMsgs', []);
            template.state.set('infoMsg', undefined);
            template.state.set('infoMsgType', 'info');

            Meteor.call('deactivateLicense', template.data.license_id, (error) => {
                if (error) {
                    const errMsgs = template.state.get('errMsgs');
                    errMsgs.push('Error deactivating license: ' + error.toString());
                    template.state.set('errMsgs', errMsgs);
                }
                else {
                    template.state.set('infoMsg', 'License successfully deactivated');
                    template.state.set('infoMsgType', 'success');
                }
            });
        }
        else {
            // Close modal panel
            $('#divDeactivateLicense').modal('hide');
        }
    },
    'click #btnDeleteLicense'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        const confirmMsg = 'If you proceed, the license will be DELETED.\n\nPLEASE NOTE THAT THIS ACTION CANNOT BE UNDONE.';

        if (confirm(confirmMsg)) {
            // Reset alert messages
            template.state.set('errMsgs', []);
            template.state.set('infoMsg', undefined);
            template.state.set('infoMsgType', 'info');

            Meteor.call('deleteLicense', template.data.license_id, (error) => {
                if (error) {
                    const errMsgs = template.state.get('errMsgs');
                    errMsgs.push('Error deleting license: ' + error.toString());
                    template.state.set('errMsgs', errMsgs);
                }
                else {
                    FlowRouter.go('/admin/licenses');
                }
            });
        }
    }
});

Template.licenseDetails.helpers({
    backQueryString() {
        const retParams = Template.instance().data.retParams;

        return retParams ? '?' + retParams : undefined;
    },
    license() {
        return Catenis.db.collection.License.findOne({_id: Template.instance().data.license_id});
    },
    activeLicense() {
        const license = Catenis.db.collection.License.findOne({_id: Template.instance().data.license_id});

        if (license) {
            return Catenis.db.collection.License.findOne({
                level: license.level,
                type: license.type,
                status: LicenseShared.status.active.name
            });
        }
    },
    statusColor(status) {
        let color;

        switch (status) {
            case LicenseShared.status.new.name:
                color = 'blue';
                break;

            case LicenseShared.status.active.name:
                color = 'green';
                break;

            case LicenseShared.status.inactive.name:
                color = 'lightgray';
                break;
        }

        return color;
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
    canDeactivateLicense(license) {
        return license && license.status === LicenseShared.status.active.name;
    },
    canActivateLicense(license, activeLicense) {
        return license && license.status === LicenseShared.status.new.name && (!activeLicense || activeLicense.revision < license.revision);
    },
    canDeleteLicense(license) {
        return license && license.status === LicenseShared.status.new.name;
    },
    displayDeactivateLicenseSubmitButton() {
        return Template.instance().state.get('displayDeactivateLicenseSubmitButton');
    },
    displayActivateLicenseSubmitButton() {
        return Template.instance().state.get('displayActivateLicenseSubmitButton');
    },
    capitalize(str) {
        if (str) {
            return str.substr(0, 1).toUpperCase() + str.substr(1);
        }
    }
});
