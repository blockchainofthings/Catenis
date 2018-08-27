/**
 * Created by Claudio on 2017-05-24.
 */

//console.log('[ClientDetailsTemplate.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//  NOTE: the reference of these modules are done sing 'require()' instead of 'import' to
//      to avoid annoying WebStorm warning message: 'default export is not defined in
//      imported module'
//const util = require('util');
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


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

Template.clientDetails.onCreated(function () {
    this.state = new ReactiveDict();

    this.state.set('addMsgCreditsStatus', 'idle');  // Valid statuses: 'idle', 'data-enter', 'processing', 'error', 'success'
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
});

Template.clientDetails.events({
    'click #btnDismissInfo'(events, template) {
        // Clear info message
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');
    },
    'click #btnDismissError'(events, template) {
        // Clear error message
        template.state.set('errMsgs', []);
    },
    'click #btnResendEnrollment'(events, template) {
        event.preventDefault();

        // Reset alert messages
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');

        // Reset action confirmation
        $('#itxResendEnrollmentConfirmation')[0].value = '';
        template.state.set('displayResendEnrollmentSubmitButton', 'none');
    },
    'change #itxResendEnrollmentConfirmation'(event, template) {
        if (event.target.value.trim().toLowerCase() === 'yes, i do confirm it') {
            // Show button to confirm action
            template.state.set('displayResendEnrollmentSubmitButton', 'inline');
        }
    },
    'submit #frmResendEnrollment'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        const confirmMsg = 'LAST CHANCE!\n\nIf you proceed, an e-mail message requesting for client account enrollment will be sent to the customer.\n\nPLEASE NOTE THAT THIS ACTION CANNOT BE UNDONE.';

        if (confirm(confirmMsg)) {
            // Close modal panel
            $('#btnCloseResendEnrollment2').click();

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
            $('#btnCloseResendEnrollment2').click();
        }
    },
    'click #btnResetPassword'(events, template) {
        event.preventDefault();

        // Reset alert messages
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');

        // Reset action confirmation
        $('#itxResetPasswordConfirmation')[0].value = '';
        template.state.set('displayResetPasswordSubmitButton', 'none');
    },
    'change #itxResetPasswordConfirmation'(event, template) {
        if (event.target.value.trim().toLowerCase() === 'yes, i do confirm it') {
            // Show button to confirm action
            template.state.set('displayResetPasswordSubmitButton', 'inline');
        }
    },
    'submit #frmResetPassword'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        const confirmMsg = 'LAST CHANCE!\n\nIf you proceed, the client\'s account password will be reset.\n\nPLEASE NOTE THAT THIS ACTION CANNOT BE UNDONE.';

        if (confirm(confirmMsg)) {
            // Close modal panel
            $('#btnCloseResetPassword2').click();

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
            $('#btnCloseResetPassword2').click();
        }
    },
    'click #btnApiAccessSecret'(events, template) {
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

        // About to show client's default API key modal window
        Meteor.call('getClientApiAccessSecret', template.data.client_id, (error, apiAccessSecret) => {
            if (error) {
                console.log('Error retrieving client API access secret:', error);
            }
            else {
                template.state.set('apiAccessSecret', apiAccessSecret);
            }
        });
    },
    'click #btnCloseClientAPIAccessSecret1'(events, template) {
        // Delete local copy of API access secret
        template.state.set('apiAccessSecret', undefined);

        return false;
    },
    'click #btnCloseClientAPIAccessSecret2'(events, template) {
        // Delete local copy of API access secret
        template.state.set('apiAccessSecret', undefined);

        return false;
    },
    'click #divClientAPIAccessSecret'(events, template) {
        if (events.target.id === 'divClientAPIAccessSecret') {
            // Delete local copy of API access secret
            template.state.set('apiAccessSecret', undefined);
        }
    },
    'click #btnResetApiAccessSecret'(events, template) {
        // Reset reset all devices too option
        $('#cbxResetAllDevices')[0].checked = false;

        // Reset confirmation
        $('#itxActionConfirmation')[0].value = '';
        template.state.set('displayResetApiAccessSecretButton', 'none');

        // Display form to reset client's default API access secret
        template.state.set('displayResetApiAccessSecretForm', 'block');

        return false;
    },
    'click #btnCancelResetApiAccessSecret'(events, template) {
        // Hide form to reset API access secret
        template.state.set('displayResetApiAccessSecretForm', 'none');

        return false;
    },
    'change #itxActionConfirmation'(event, template) {
        if (event.target.value.trim().toLowerCase() === 'yes, i do confirm it') {
            // Show button to reset API access secret
            template.state.set('displayResetApiAccessSecretButton', 'inline');
        }
    },
    'submit #formClientApiAccessSecret'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        const form = event.target;
        let confirmMsg = 'LAST CHANCE!\n\nIf you proceed, the client\'s default API access secret will be reset';

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
                    errMsgs.push('Error resetting client\'s default API access secret: ' + error.toString());
                    template.state.set('errMsgs', errMsgs);
                }
                else {
                    template.state.set('infoMsg', 'Successfully reset client\'s default API access secret');
                    template.state.set('infoMsgType', 'success');
                }
            });

            // Close modal panel
            $('#btnCloseClientAPIAccessSecret2').click();
        }
        else {
            $('#btnCancelResetApiAccessSecret').click();
        }
    },
    'click #btnDeleteClient'(events, template) {
        event.preventDefault();

        // Reset alert messages
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');

        // Reset action confirmation
        $('#itxDeleteClientConfirmation')[0].value = '';
        template.state.set('displayDeleteClientSubmitButton', 'none');
    },
    'change #itxDeleteClientConfirmation'(event, template) {
        if (event.target.value.trim().toLowerCase() === 'yes, i do confirm it') {
            // Show button to confirm action
            template.state.set('displayDeleteClientSubmitButton', 'inline');
        }
    },
    'submit #frmDeleteClient'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        const confirmMsg = 'LAST CHANCE!\n\nIf you proceed, the client and ALL its virtual devices will be DELETED.\n\nPLEASE NOTE THAT THIS ACTION CANNOT BE UNDONE.';

        if (confirm(confirmMsg)) {
            // Close modal panel
            $('#btnCloseDeleteClient2').click();

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
            $('#btnCloseDeleteClient2').click();
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
    clientCustomerName(client) {
        let custName = client.props.firstName;

        if (client.props.lastName) {
            if (custName) {
                custName += ' ';
            }

            custName += client.props.lastName;
        }

        return custName;
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
