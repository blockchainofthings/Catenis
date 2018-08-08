/**
 * Created by claudio on 2018-08-06.
 */

//console.log('[ClientLicenseDetailsTemplate.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
//import moment from 'moment-timezone';
// Meteor packages
import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';
import { ReactiveDict } from 'meteor/reactive-dict';

// References code in other (Catenis) modules on the client
import { Catenis } from '../ClientCatenis';
import { ClientUtil } from '../ClientUtil';
import { ClientLicenseShared } from '../../both/ClientLicenseShared';
import { LicenseShared } from '../../both/LicenseShared';

// Import template UI
import './ClientLicenseDetailsTemplate.html';

// Import dependent templates


// Definition of module (private) functions
//

function validateRenewLicenseFormData(form, errMsgs) {
    const formData = {};
    let hasError = false;

    formData.license_id = form.license.value;

    if (formData.license_id.length === 0) {
        // No license selected. Report error
        errMsgs.push('Please select a license.');
        hasError = true;
    }

    return !hasError ? formData : undefined;
}

function validateUpgradeLicenseFormData(form, errMsgs) {
    const formData = {};
    let hasError = false;

    formData.license_id = form.license.value;

    if (formData.license_id.length === 0) {
        // No license selected. Report error
        errMsgs.push('Please select a license.');
        hasError = true;
    }

    return !hasError ? formData : undefined;
}


// Module code
//

Template.clientLicenseDetails.onCreated(function () {
    this.state = new ReactiveDict();

    this.state.set('newLicenseErrMsgs', []);
    this.state.set('errMsgs', []);
    this.state.set('infoMsg', undefined);
    this.state.set('infoMsgType', 'info');
    this.state.set('numLicensesToUpgrade', undefined);
    this.state.set('renewMoreRestrictiveLicense', false);

    this.state.set('displayDoRenewLicenseButton', 'none');
    this.state.set('displayRenewLicenseConfirm', 'none');
    this.state.set('displayRenewLicenseSubmitButton', 'none');
    
    this.state.set('displayDoUpgradeLicenseButton', 'none');
    this.state.set('displayUpgradeLicenseConfirm', 'none');
    this.state.set('displayUpgradeLicenseSubmitButton', 'none');

    this.state.set('displayDoExpireLicenseButton', 'none');
    this.state.set('displayExpireLicenseConfirm', 'none');
    this.state.set('displayExpireLicenseSubmitButton', 'none');

    // Subscribe to receive database docs/recs updates
    this.clientRecordSubs = this.subscribe('clientRecord', this.data.client_id);
    this.singleClientLicenseSubs = this.subscribe('singleClientLicense', this.data.client_id, this.data.clientLicense_id);
    this.singleClientLicenseLicensesSubs = this.subscribe('singleClientLicenseLicenses', this.data.client_id, this.data.clientLicense_id);
});

Template.clientLicenseDetails.onDestroyed(function () {
    if (this.clientRecordSubs) {
        this.clientRecordSubs.stop();
    }

    if (this.singleClientLicenseSubs) {
        this.singleClientLicenseSubs.stop();
    }

    if (this.singleClientLicenseLicensesSubs) {
        this.singleClientLicenseLicensesSubs.stop();
    }
});

Template.clientLicenseDetails.events({
    'click #btnDismissInfo'(events, template) {
        // Clear info message
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');
    },
    'click #btnDismissError'(events, template) {
        // Clear error message
        template.state.set('errMsgs', []);
    },
    'click #btnDismissNewLicenseError'(events, template) {
        // Clear error message
        template.state.set('newLicenseErrMsgs', []);
    },
    'click #btnRenewLicense'(events, template) {
        event.preventDefault();

        // Reset alert messages
        template.state.set('newLicenseErrMsgs', []);
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');

        // Enable and reset form controls
        const form = $('#frmRenewClientLicense')[0];
        form.license.disabled = false;

        form.license.value = form.currentLicense_id.value;

        // Show do action button
        template.state.set('displayDoRenewLicenseButton', 'inline');

        // Reset indication of more restrictive license
        template.state.set('renewMoreRestrictiveLicense', false);

        // Reset action confirmation
        $('#itxRenewConfirmation')[0].value = '';
        template.state.set('displayRenewLicenseConfirm', 'none');
        template.state.set('displayRenewLicenseSubmitButton', 'none');
    },
    'click #btnUpgradeLicense'(events, template) {
        event.preventDefault();

        // Reset alert messages
        template.state.set('newLicenseErrMsgs', []);
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');

        // Check if there are licenses available for upgrade
        if (template.state.get('numLicensesToUpgrade')) {
            // Enable and reset form controls
            const form = $('#frmUpgradeClientLicense')[0];
            form.license.disabled = false;

            form.license.value = '';

            // Show do action button
            template.state.set('displayDoUpgradeLicenseButton', 'inline');

            // Reset action confirmation
            $('#itxUpgradeConfirmation')[0].value = '';
            template.state.set('displayUpgradeLicenseConfirm', 'none');
            template.state.set('displayUpgradeLicenseSubmitButton', 'none');
        }
        else {
            // No licenses available. Indicate error
            template.state.set('newLicenseErrMsgs', ['No licenses available for doing upgrade']);
        }
    },
    'click #btnExpireLicense'(events, template) {
        event.preventDefault();

        // Reset alert messages
        template.state.set('newLicenseErrMsgs', []);
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');

        // Show do action button
        template.state.set('displayDoExpireLicenseButton', 'inline');

        // Reset action confirmation
        $('#itxExpireConfirmation')[0].value = '';
        template.state.set('displayExpireLicenseConfirm', 'none');
        template.state.set('displayExpireLicenseSubmitButton', 'none');
    },
    'change #itxRenewConfirmation'(event, template) {
        if (event.target.value.trim().toLowerCase() === 'yes, i do confirm it') {
            // Show button to confirm action
            template.state.set('displayRenewLicenseSubmitButton', 'inline');
        }
    },
    'change #itxUpgradeConfirmation'(event, template) {
        if (event.target.value.trim().toLowerCase() === 'yes, i do confirm it') {
            // Show button to confirm action
            template.state.set('displayUpgradeLicenseSubmitButton', 'inline');
        }
    },
    'change #itxExpireConfirmation'(event, template) {
        if (event.target.value.trim().toLowerCase() === 'yes, i do confirm it') {
            // Show button to confirm action
            template.state.set('displayExpireLicenseSubmitButton', 'inline');
        }
    },
    'click #btnCancelRenewLicenseConfirm'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        // Reset action confirmation
        $('#itxRenewConfirmation')[0].value = '';
        template.state.set('displayRenewLicenseConfirm', 'none');
        template.state.set('displayRenewLicenseSubmitButton', 'none');

        // Enable form controls
        const form = $('#frmRenewClientLicense')[0];
        form.license.disabled = false;

        // Show do action button
        template.state.set('displayDoRenewLicenseButton', 'inline');
    },
    'click #btnCancelUpgradeLicenseConfirm'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        // Reset action confirmation
        $('#itxUpgradeConfirmation')[0].value = '';
        template.state.set('displayUpgradeLicenseConfirm', 'none');
        template.state.set('displayUpgradeLicenseSubmitButton', 'none');

        // Enable form controls
        const form = $('#frmUpgradeClientLicense')[0];
        form.license.disabled = false;

        // Show do action button
        template.state.set('displayDoUpgradeLicenseButton', 'inline');
    },
    'click #btnCancelExpireLicenseConfirm'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        // Reset action confirmation
        $('#itxExpireConfirmation')[0].value = '';
        template.state.set('displayExpireLicenseConfirm', 'none');
        template.state.set('displayExpireLicenseSubmitButton', 'none');

        // Show do action button
        template.state.set('displayDoExpireLicenseButton', 'inline');
    },
    'change #selLicense'(event, template) {
        // Check if a more restrictive license is selected
        const newLicense_id = event.target.value;
        let moreRestrictiveLicense = false;

        if (newLicense_id) {
            const docNewLicense = Catenis.db.collection.License.findOne({
                _id: newLicense_id
            }, {
                fields: {
                    order: 1
                }
            });

            moreRestrictiveLicense = docNewLicense.order > event.target.form.currentLicenseOrder.value;
        }

        template.state.set('renewMoreRestrictiveLicense', moreRestrictiveLicense);
    },
    'click #btnDoRenewLicense'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        // Reset alert messages
        template.state.set('newLicenseErrMsgs', []);
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');

        const form = event.target.form;

        // Do validation of form controls here
        let errMsgs = [];
        let formData;

        if ((formData = validateRenewLicenseFormData(form, errMsgs))) {
            // Form OK. Save its (conformed) data
            form.formData = formData;

            // Disable form controls
            form.license.disabled = true;

            // Hide do action button
            template.state.set('displayDoRenewLicenseButton', 'none');

            // Show action confirmation panel, and make sure that submit button is not shown
            template.state.set('displayRenewLicenseConfirm', 'block');
            template.state.set('displayRenewLicenseSubmitButton', 'none');
        }
        else {
            // Form data error
            template.state.set('newLicenseErrMsgs', errMsgs);
        }
    },
    'click #btnDoUpgradeLicense'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        // Reset alert messages
        template.state.set('newLicenseErrMsgs', []);
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');

        const form = event.target.form;

        // Do validation of form controls here
        let errMsgs = [];
        let formData;

        if ((formData = validateUpgradeLicenseFormData(form, errMsgs))) {
            // Form OK. Save its (conformed) data
            form.formData = formData;

            // Disable form controls
            form.license.disabled = true;

            // Hide do action button
            template.state.set('displayDoUpgradeLicenseButton', 'none');

            // Show action confirmation panel, and make sure that submit button is not shown
            template.state.set('displayUpgradeLicenseConfirm', 'block');
            template.state.set('displayUpgradeLicenseSubmitButton', 'none');
        }
        else {
            // Form data error
            template.state.set('newLicenseErrMsgs', errMsgs);
        }
    },
    'click #btnDoExpireLicense'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        // Reset alert messages
        template.state.set('newLicenseErrMsgs', []);
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');

        // Do validation of form controls here (not needed in this case)

        // Form OK

        // Hide do action button
        template.state.set('displayDoExpireLicenseButton', 'none');

        // Show action confirmation panel, and make sure that submit button is not shown
        template.state.set('displayExpireLicenseConfirm', 'block');
        template.state.set('displayExpireLicenseSubmitButton', 'none');
    },
    'submit #frmRenewClientLicense'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        const form = event.target;
        let confirmMsg = 'LAST CHANCE!\n\nIf you proceed, the client license will be renewed';

        if (form.isMoreRestrictiveLicense) {
            confirmMsg += ', and may FORCE the DEACTIVATION of some of the client\'s virtual devices when it is activated'
        }

        confirmMsg += '.\n\nPLEASE NOTE THAT THIS ACTION CANNOT BE UNDONE.';

        if (confirm(confirmMsg)) {
            // Reset alert messages
            template.state.set('newLicenseErrMsgs', []);
            template.state.set('errMsgs', []);
            template.state.set('infoMsg', undefined);
            template.state.set('infoMsgType', 'info');

            Meteor.call('renewClientLicense', template.data.client_id, form.formData.license_id, (error) => {
                if (error) {
                    template.state.set('newLicenseErrMsgs', [error.toString()]);
                }
                else {
                    template.state.set('infoMsg', 'Client license successfully renewed');
                    template.state.set('infoMsgType', 'success');

                    // Close modal panel
                    $('#btnCloseRenewClientLicense2').click();
                }
            });
        }
        else {
            // Close modal panel
            $('#btnCloseRenewClientLicense2').click();
        }
    },
    'submit #frmUpgradeClientLicense'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        const form = event.target;
        const confirmMsg = 'LAST CHANCE!\n\nIf you proceed, the client license will be upgraded.\n\nPLEASE NOTE THAT THIS ACTION CANNOT BE UNDONE.';

        if (confirm(confirmMsg)) {
            // Reset alert messages
            template.state.set('newLicenseErrMsgs', []);
            template.state.set('errMsgs', []);
            template.state.set('infoMsg', undefined);
            template.state.set('infoMsgType', 'info');

            Meteor.call('upgradeClientLicense', template.data.client_id, form.formData.license_id, (error) => {
                if (error) {
                    template.state.set('newLicenseErrMsgs', [error.toString()]);
                }
                else {
                    template.state.set('infoMsg', 'Client license successfully upgraded');
                    template.state.set('infoMsgType', 'success');

                    // Close modal panel
                    $('#btnCloseUpgradeClientLicense2').click();
                }
            });
        }
        else {
            // Close modal panel
            $('#btnCloseUpgradeClientLicense2').click();
        }
    },
    'submit #frmExpireClientLicense'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        const form = event.target;
        const confirmMsg = 'LAST CHANCE!\n\nIf you proceed, the '
                + (form.isActiveLicense ? 'currently ACTIVE ' : '') + 'client license will be expired.\n\nPLEASE NOTE THAT THIS ACTION CANNOT BE UNDONE.';

        if (confirm(confirmMsg)) {
            // Reset alert messages
            template.state.set('newLicenseErrMsgs', []);
            template.state.set('errMsgs', []);
            template.state.set('infoMsg', undefined);
            template.state.set('infoMsgType', 'info');

            Meteor.call('expireClientLicense', template.data.clientLicense_id, (error) => {
                if (error) {
                    template.state.set('newLicenseErrMsgs', [error.toString()]);
                }
                else {
                    template.state.set('infoMsg', 'Client license successfully expired');
                    template.state.set('infoMsgType', 'success');

                    // Close modal panel
                    $('#btnCloseExpireClientLicense2').click();
                }
            });
        }
        else {
            // Close modal panel
            $('#btnCloseExpireClientLicense2').click();
        }
    }
});

Template.clientLicenseDetails.helpers({
    client() {
        return Catenis.db.collection.Client.findOne({_id: Template.instance().data.client_id});
    },
    clientTitle(client) {
        return client.props.name || client.clientId;
    },
    clientLicense() {
        return Catenis.db.collection.ClientLicense.findOne({_id: Template.instance().data.clientLicense_id});
    },
    clientLicenseLicense(license_id) {
        return Catenis.db.collection.License.findOne({_id: license_id});
    },
    isActiveLicense(clientLicense) {
        return clientLicense.status === ClientLicenseShared.status.active.name;
    },
    canRenewLicense(clientLicense) {
        // Client license must be active, have a validity end date, and there must be no license
        //  already provisioned that shall renew it
        return clientLicense.status === ClientLicenseShared.status.active.name && clientLicense.validity.endDate
                && Catenis.db.collection.ClientLicense.find({
                    client_id: clientLicense.client_id,
                    status: ClientLicenseShared.status.provisioned.name,
                    'validity.startDate': {
                        $lte: clientLicense.validity.endDate
                    }
                }).count() === 0;
    },
    canUpgradeLicense(clientLicense, license) {
        // Client license must be active, and there must be licenses with a lower order than
        //  the current one
        return clientLicense.status === ClientLicenseShared.status.active.name
                && Catenis.db.collection.License.find({
                    status: LicenseShared.status.active.name,
                    order: {
                        $lt: license.order
                    }
                }).count() > 0;
    },
    canExpireLicense(clientLicense) {
        // Client license must not be expired yet
        return clientLicense.status !== ClientLicenseShared.status.expired.name;
    },
    activeLicenses() {
        return Catenis.db.collection.License.find({
            status: LicenseShared.status.active.name
        }, {
            sort: {
                order: 1,
                level: 1,
                type: 1
            }
        }).map((doc) => {
            let licName = ClientUtil.capitalize(doc.level);

            if (doc.type) {
                licName += ' (' + doc.type + ')';
            }

            return {
                _id: doc._id,
                name: licName
            };
        });
    },
    licensesToUpgrade(license) {
        const licenses = Catenis.db.collection.License.find({
            status: LicenseShared.status.active.name,
            order: {
                $lt: license.order
            }
        }, {
            sort: {
                order: 1,
                level: 1,
                type: 1
            }
        }).map((doc) => {
            let licName = ClientUtil.capitalize(doc.level);

            if (doc.type) {
                licName += ' (' + doc.type + ')';
            }

            return {
                _id: doc._id,
                name: licName
            };
        });

        // Save number of licenses available for upgrade
        Template.instance().state.set('numLicensesToUpgrade', licenses.length);

        return licenses;
    },
    formatLongDate(date, client) {
        return date ? ClientUtil.startOfDayTimeZone(date, client.timeZone, true).format('LLLL') : undefined;
    },
    capitalize(str) {
        return ClientUtil.capitalize(str);
    },
    statusColor(status) {
        let color;

        switch (status) {
            case ClientLicenseShared.status.active.name:
                color = 'green';
                break;

            case ClientLicenseShared.status.provisioned.name:
                color = 'blue';
                break;

            case ClientLicenseShared.status.expired.name:
                color = 'red';
                break;
        }

        return color;
    },
    hasNewLicenseErrorMessage() {
        return Template.instance().state.get('newLicenseErrMsgs').length > 0;
    },
    newLicenseErrorMessage() {
        return Template.instance().state.get('newLicenseErrMsgs').reduce((compMsg, errMsg) => {
            if (compMsg.length > 0) {
                compMsg += '<br>';
            }
            return compMsg + errMsg;
        }, '');
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
    displayDoRenewLicenseButton() {
        return Template.instance().state.get('displayDoRenewLicenseButton');
    },
    displayRenewLicenseConfirm() {
        return Template.instance().state.get('displayRenewLicenseConfirm');
    },
    displayRenewLicenseSubmitButton() {
        return Template.instance().state.get('displayRenewLicenseSubmitButton');
    },
    displayDoUpgradeLicenseButton() {
        return Template.instance().state.get('displayDoUpgradeLicenseButton');
    },
    displayUpgradeLicenseConfirm() {
        return Template.instance().state.get('displayUpgradeLicenseConfirm');
    },
    displayUpgradeLicenseSubmitButton() {
        return Template.instance().state.get('displayUpgradeLicenseSubmitButton');
    },
    displayDoExpireLicenseButton() {
        return Template.instance().state.get('displayDoExpireLicenseButton');
    },
    displayExpireLicenseConfirm() {
        return Template.instance().state.get('displayExpireLicenseConfirm');
    },
    displayExpireLicenseSubmitButton() {
        return Template.instance().state.get('displayExpireLicenseSubmitButton');
    },
    renewMoreRestrictiveLicense() {
        return Template.instance().state.get('renewMoreRestrictiveLicense');
    },
    nonEmptyArray(array) {
        return Array.isArray(array) && array.length > 0;
    },
    checkSelectedLicense(newLicense, license) {
        return newLicense._id === license._id ? 'selected' : undefined;
    }
});
