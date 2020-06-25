/**
 * Created by Claudio on 2017-05-24.
 */

//console.log('[ClientDetailsTemplate.js]: This code just ran.');

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
import { ClientShared } from '../../both/ClientShared';
import { ClientUtil } from '../ClientUtil';
import { ClientLicenseShared } from '../../both/ClientLicenseShared';

// Import template UI
import './ClientDetailsTemplate.html';

// Import dependent templates
import './ClientLicensesTemplate.js';
import './EditClientTemplate.js';
import './ServiceAccountTemplate.js';
import './OwnedDomainsTemplate.js';
import './DevicesTemplate.js';

// Module variables
const confirmPhrase = 'yes, i do confirm it';


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

Template.clientDetails.onCreated(function () {
    this.state = new ReactiveDict();

    this.state.set('haveResentEnrollmentEmail', false);
    this.state.set('errMsgs', []);
    this.state.set('infoMsg', undefined);
    this.state.set('infoMsgType', 'info');

    this.state.set('displayResendEnrollmentSubmitButton', 'none');

    this.state.set('displayResetPasswordSubmitButton', 'none');

    this.state.set('displayDeleteClientSubmitButton', 'none');

    this.state.set('apiAccessSecret', undefined);
    this.state.set('displayResetApiAccessSecretForm', 'none');
    this.state.set('displayResetApiAccessSecretButton', 'none');

    // Subscribe to receive database docs/recs updates
    this.clientRecordSubs = this.subscribe('clientRecord', this.data.client_id);
    this.clientUserSubs = this.subscribe('clientUser', this.data.client_id);
    this.currentClientLicenseSubs = this.subscribe('currentClientLicense', this.data.client_id);
    this.currentLicenseSubs = this.subscribe('currentLicense', this.data.client_id);
});

Template.clientDetails.onDestroyed(function () {
    if (this.clientRecordSubs) {
        this.clientRecordSubs.stop();
    }

    if (this.clientUserSubs) {
        this.clientUserSubs.stop();
    }

    if (this.currentClientLicenseSubs) {
        this.currentClientLicenseSubs.stop();
    }

    if (this.currentLicenseSubs) {
        this.currentLicenseSubs.stop();
    }

    if (this.clipboard) {
        this.clipboard.destroy();
    }
});

Template.clientDetails.events({
    'click #btnDismissInfo'(event, template) {
        // Clear info message
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');
    },
    'click #btnDismissError'(event, template) {
        // Clear error message
        template.state.set('errMsgs', []);
    },
    'click #btnResendEnrollment'(event, template) {
        event.preventDefault();

        // Reset alert messages
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');

        // Reset action confirmation
        $('#itxResendEnrollmentConfirmation')[0].value = '';
        template.state.set('displayResendEnrollmentSubmitButton', 'none');
    },
    'hidden.bs.modal #divResendEnrollment'(event, template) {
        // Modal panel has been closed. Make sure that button used to
        //  activate modal panel is not selected
        $('#btnResendEnrollment').blur();
    },
    'input #itxResendEnrollmentConfirmation'(event, template) {
        // Suppress spaces from beginning of input
        let inputValue = event.target.value = event.target.value.replace(/^\s+/, '');

        if (inputValue.length > confirmPhrase.length) {
            // Limit length of input
            inputValue = event.target.value = inputValue.substring(0, confirmPhrase.length);
        }

        // Check if input matches confirmation phrase
        if (inputValue.toLowerCase() === confirmPhrase) {
            // Show button to confirm action
            template.state.set('displayResendEnrollmentSubmitButton', 'inline');
        }
        else {
            // Hide button to confirm action
            template.state.set('displayResendEnrollmentSubmitButton', 'none');
        }
    },
    'submit #frmResendEnrollment'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        const confirmMsg = 'LAST CHANCE!\n\nIf you proceed, an e-mail message requesting for client account enrollment will be sent to the customer.\n\nPLEASE NOTE THAT THIS ACTION CANNOT BE UNDONE.';

        if (confirm(confirmMsg)) {
            // Close modal panel
            $('#divResendEnrollment').modal('hide');

            // Reset alert messages
            template.state.set('errMsgs', []);
            template.state.set('infoMsg', 'Sending client account enrollment e-mail message to customer...');
            template.state.set('infoMsgType', 'info');

            Meteor.call('sendEnrollmentEmail', template.data.client_id, (error) => {
                if (error) {
                    template.state.set('infoMsg', undefined);
                    template.state.set('infoMsgType', 'info');

                    const errMsgs = template.state.get('errMsgs');
                    errMsgs.push('Error sending client account enrollment e-mail message: ' + error.toString());
                    template.state.set('errMsgs', errMsgs);
                }
                else {
                    template.state.set('infoMsg', 'Client account enrollment e-mail message successfully sent');
                    template.state.set('infoMsgType', 'success');
                }
            });
        }
        else {
            // Close modal panel
            $('#divResendEnrollment').modal('hide');
        }
    },
    'click #btnResetPassword'(event, template) {
        event.preventDefault();

        // Reset alert messages
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');

        // Reset action confirmation
        $('#itxResetPasswordConfirmation')[0].value = '';
        template.state.set('displayResetPasswordSubmitButton', 'none');
    },
    'hidden.bs.modal #divResetPassword'(event, template) {
        // Modal panel has been closed. Make sure that button used to
        //  activate modal panel is not selected
        $('#btnResetPassword').blur();
    },
    'input #itxResetPasswordConfirmation'(event, template) {
        // Suppress spaces from beginning of input
        let inputValue = event.target.value = event.target.value.replace(/^\s+/, '');

        if (inputValue.length > confirmPhrase.length) {
            // Limit length of input
            inputValue = event.target.value = inputValue.substring(0, confirmPhrase.length);
        }

        // Check if input matches confirmation phrase
        if (inputValue.toLowerCase() === confirmPhrase) {
            // Show button to confirm action
            template.state.set('displayResetPasswordSubmitButton', 'inline');
        }
        else {
            // Hide button to confirm action
            template.state.set('displayResetPasswordSubmitButton', 'none');
        }
    },
    'submit #frmResetPassword'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        const confirmMsg = 'LAST CHANCE!\n\nIf you proceed, the client\'s account password will be reset.\n\nPLEASE NOTE THAT THIS ACTION CANNOT BE UNDONE.';

        if (confirm(confirmMsg)) {
            // Close modal panel
            $('#divResetPassword').modal('hide');

            // Reset alert messages
            template.state.set('errMsgs', []);
            template.state.set('infoMsg', 'Sending client account\'s password reset e-mail message to customer...');
            template.state.set('infoMsgType', 'info');

            Meteor.call('sendResetPasswordEmail', template.data.client_id, (error) => {
                if (error) {
                    template.state.set('infoMsg', undefined);
                    template.state.set('infoMsgType', 'info');

                    const errMsgs = template.state.get('errMsgs');
                    errMsgs.push('Error sending client account\'s password reset e-mail message: ' + error.toString());
                    template.state.set('errMsgs', errMsgs);
                }
                else {
                    template.state.set('infoMsg', 'Client account\'s password reset e-mail message successfully sent');
                    template.state.set('infoMsgType', 'success');
                }
            });
        }
        else {
            // Close modal panel
            $('#divResetPassword').modal('hide');
        }
    },
    'click #btnApiAccessSecret'(event, template) {
        template.clipboard = new ClipboardJS('#btnCopyClipboard', {
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
        Meteor.call('getClientApiAccessSecret', template.data.client_id, (error, apiAccessSecret) => {
            if (error) {
                const errMsgs = template.state.get('errMsgs');
                errMsgs.push('Error retrieving client\'s API access secret: ' + error.toString());
                template.state.set('errMsgs', errMsgs);

                // Close modal panel
                $('#divClientAPIAccessSecret').modal('hide');
            }
            else {
                template.state.set('apiAccessSecret', apiAccessSecret);
            }
        });
    },
    'click #btnCopyClipboard'(event, template) {
        const $button = $(event.currentTarget);

        $button.addClass('tooltipped tooltipped-s');
        $button.attr('aria-label', 'Copied!');
    },
    'mouseleave #btnCopyClipboard'(event, template) {
        const $button = $(event.currentTarget);

        $button.removeAttr('aria-label');
        $button.removeClass('tooltipped tooltipped-s');
    },
    'hidden.bs.modal #divClientAPIAccessSecret'(event, template) {
        // Modal panel has been closed. Delete local copy of API access secret
        template.state.set('apiAccessSecret', undefined);

        // Make sure that button used to activate modal panel is not selected
        $('#btnApiAccessSecret').blur();
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
            confirmMsg += ', ALONG WITH the API access secret FOR ALL DEVICES of this client'
        }

        confirmMsg += '.\n\nPLEASE NOTE THAT THIS ACTION CANNOT BE UNDONE.';

        if (confirm(confirmMsg)) {
            // Reset alert messages
            template.state.set('errMsgs', []);
            template.state.set('infoMsg', undefined);
            template.state.set('infoMsgType', 'info');

            Meteor.call('resetClientApiAccessSecret', Template.instance().data.client_id , form.resetAllDevices.checked, (error, key) => {
                if (error) {
                    const errMsgs = template.state.get('errMsgs');
                    errMsgs.push('Error resetting shared API access secret: ' + error.toString());
                    template.state.set('errMsgs', errMsgs);
                }
                else {
                    template.state.set('infoMsg', 'Successfully reset shared API access secret');
                    template.state.set('infoMsgType', 'success');
                }
            });

            // Close modal panel
            $('#divClientAPIAccessSecret').modal('hide');
        }
        else {
            $('#btnCancelResetApiAccessSecret').click();
        }
    },
    'click #btnDeleteClient'(event, template) {
        event.preventDefault();

        // Reset alert messages
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');

        // Reset action confirmation
        $('#itxDeleteClientConfirmation')[0].value = '';
        template.state.set('displayDeleteClientSubmitButton', 'none');
    },
    'hidden.bs.modal #divDeleteClient'(event, template) {
        // Modal panel has been closed. Make sure that button used to
        //  activate modal panel is not selected
        $('#btnDeleteClient').blur();
    },
    'input #itxDeleteClientConfirmation'(event, template) {
        // Suppress spaces from beginning of input
        let inputValue = event.target.value = event.target.value.replace(/^\s+/, '');

        if (inputValue.length > confirmPhrase.length) {
            // Limit length of input
            inputValue = event.target.value = inputValue.substring(0, confirmPhrase.length);
        }

        // Check if input matches confirmation phrase
        if (inputValue.toLowerCase() === confirmPhrase) {
            // Show button to confirm action
            template.state.set('displayDeleteClientSubmitButton', 'inline');
        }
        else {
            // Hide button to confirm action
            template.state.set('displayDeleteClientSubmitButton', 'none');
        }
    },
    'submit #frmDeleteClient'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        const confirmMsg = 'LAST CHANCE!\n\nIf you proceed, the client and ALL its virtual devices will be DELETED.\n\nPLEASE NOTE THAT THIS ACTION CANNOT BE UNDONE.';

        if (confirm(confirmMsg)) {
            // Close modal panel
            $('#divDeleteClient').modal('hide');

            // Reset alert messages
            template.state.set('errMsgs', []);
            template.state.set('infoMsg', undefined);
            template.state.set('infoMsgType', 'info');

            Meteor.call('deleteClient', template.data.client_id, (error) => {
                if (error) {
                    const errMsgs = template.state.get('errMsgs');
                    errMsgs.push('Error deleting client: ' + error.toString());
                    template.state.set('errMsgs', errMsgs);
                }
                else {
                    template.state.set('infoMsg', 'Client successfully deleted');
                    template.state.set('infoMsgType', 'success');
                }
            });
        }
        else {
            // Close modal panel
            $('#divDeleteClient').modal('hide');
        }
    },
});

Template.clientDetails.helpers({
    client() {
        return Catenis.db.collection.Client.findOne({_id: Template.instance().data.client_id});
    },
    clientTitle(client) {
        return client.props.name || client.clientId;
    },
    clientUsername(user_id) {
        const user = Meteor.users.findOne({_id: user_id});

        return user ? user.username : undefined;
    },
    clientContactName(client) {
        let contactName = client.props.firstName;

        if (client.props.lastName) {
            if (contactName) {
                contactName += ' ';
            }

            contactName += client.props.lastName;
        }

        return contactName;
    },
    clientUserEmail(user_id) {
        const user = Meteor.users.findOne({_id: user_id});

        return ClientUtil.getUserEmail(user);
    },
    statusColor(status) {
        let color;

        switch (status) {
            case ClientShared.status.active.name:
                color = 'green';
                break;

            case ClientShared.status.new.name:
                color = 'blue';
                break;
                
            case ClientShared.status.deleted.name:
                color = 'red';
                break;
        }

        return color;
    },
    clientLicenseName(client_id) {
        const docClientLicense = Catenis.db.collection.ClientLicense.findOne({
            client_id: client_id,
            status: ClientLicenseShared.status.active.name
        }, {
            sort: {
                'validity.startDate': -1,
                activatedDate: -1
            }
        });

        if (docClientLicense) {
            const docLicense = Catenis.db.collection.License.findOne({_id: docClientLicense.license_id});

            if (docLicense) {
                let licName = ClientUtil.capitalize(docLicense.level);

                if (docLicense.type) {
                    licName += ' (' + docLicense.type + ')';
                }

                return licName;
            }
        }
    },
    clientLicenseExpiration(client) {
        const docClientLicenses = Catenis.db.collection.ClientLicense.find({
            client_id: client._id,
            status: {
                $in: [
                    ClientLicenseShared.status.active.name,
                    ClientLicenseShared.status.provisioned.name
                ]
            }
        }, {
            fields: {
                _id: 1,
                validity: 1,
                status: 1
            },
            sort: {
                status: 1,
                activatedDate: 1,
                provisionedDate: 1
            }
        }).fetch();

        let expirationDate;

        if (docClientLicenses.length > 0) {
            let docLastActvLicense;
            let docLastProvLicense;

            docClientLicenses.some((doc) => {
                if (doc.status === ClientLicenseShared.status.active.name) {
                    // Update active license (and last provisioned license)
                    docLastProvLicense = docLastActvLicense = doc;
                }
                else { // doc.status === ClientLicenseShared.status.provisioned.name
                    if (docLastActvLicense) {
                        if (!docLastProvLicense.validity.endDate || doc.validity.startDate <= docLastProvLicense.validity.endDate) {
                            // Provisioned license starts before previous provisioned license ends.
                            //  Update last provisioned license
                            docLastProvLicense = doc;
                        }
                        else {
                            // Provisioned license starts after previous provisioned license ends.
                            //  Stop iteration
                            return true;
                        }
                    }
                    else {
                        // No active license. Stop iteration
                        return true;
                    }
                }

                // Continue iteration
                return false;
            });

            if (docLastProvLicense && docLastProvLicense.validity.endDate) {
                expirationDate = docLastProvLicense.validity.endDate;
            }
        }

        return expirationDate ? ClientUtil.startOfDayTimeZone(expirationDate, client.timeZone, true).format('LLLL') : undefined;
    },
    isNewClient(client) {
        return client.status === ClientShared.status.new.name;
    },
    isActiveClient(client) {
        return client.status === ClientShared.status.active.name;
    },
    isDeletedClient(client) {
        return client.status === ClientShared.status.deleted.name;
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
    displayResendEnrollmentSubmitButton() {
        return Template.instance().state.get('displayResendEnrollmentSubmitButton');
    },
    displayResetPasswordSubmitButton() {
        return Template.instance().state.get('displayResetPasswordSubmitButton');
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
    },
    displayDeleteClientSubmitButton() {
        return Template.instance().state.get('displayDeleteClientSubmitButton');
    }
});
