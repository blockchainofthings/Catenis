/**
 * Created by Claudio on 2018-09-26.
 */

//console.log('[LicensesTemplate.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import querystring from "querystring";
// Third-party node modules
import BigNumber from 'bignumber.js';
// Meteor packages
import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';
import { ReactiveDict } from 'meteor/reactive-dict';

// References code in other (Catenis) modules on the client
import { Catenis } from '../ClientCatenis';
import { ClientUtil } from '../ClientUtil';
import { LicenseShared } from '../../both/LicenseShared';

// Import template UI
import './LicensesTemplate.html';

// Import dependent templates
import './LicenseDetailsTemplate.js';

// Module variables
const confirmPhrase = 'yes, i do confirm it';


// Definition of module (private) functions
//

function validateCreateLicenseFormData(form, errMsgs) {
    const licenseInfo = {};
    let hasError = false;
    let focusSet = false;
    let value;

    value = form.order.value ? form.order.value.trim() : '';

    if (value.length === 0) {
        // Order not supplied. Report error
        errMsgs.push('Please enter the license order');
        hasError = true;
        
        if (!focusSet) {
            form.order.focus();
            focusSet = true;
        }
    }
    else {
        value = strToInteger(value);

        if (Number.isNaN(value)) {
            // Invalid integer value. Set error message
            errMsgs.push('Invalid order: not a valid integer number');
            hasError = true;

            if (!focusSet) {
                form.order.focus();
                focusSet = true;
            }
        }
        else if (value <= 0) {
            // Number value out of range. Set error message
            errMsgs.push('Invalid order: value must be greater than zero');
            hasError = true;

            if (!focusSet) {
                form.order.focus();
                focusSet = true;
            }
        }
        else {
            licenseInfo.order = value;
        }
    }

    value = form.level.value ? form.level.value.trim() : '';

    if (value.length === 0) {
        // Level not supplied. Report error
        errMsgs.push('Please enter the license level');
        hasError = true;

        if (!focusSet) {
            form.level.focus();
            focusSet = true;
        }
    }
    else {
        licenseInfo.level = value;
    }
    
    value = form.type.value ? form.type.value.trim() : '';
    
    if (value.length > 0) {
        licenseInfo.type = value;
    }

    value = form.maximumDevices.value ? form.maximumDevices.value.trim() : '';

    if (value.length > 0) {
        value = strToInteger(value);

        if (Number.isNaN(value)) {
            // Invalid integer value. Set error message
            errMsgs.push('Invalid maximum devices in use: not a valid integer number');
            hasError = true;

            if (!focusSet) {
                form.maximumDevices.focus();
                focusSet = true;
            }
        }
        else if (value <= 0) {
            // Number value out of range. Set error message
            errMsgs.push('Invalid maximum devices in use: value must be greater than zero');
            hasError = true;

            if (!focusSet) {
                form.maximumDevices.focus();
                focusSet = true;
            }
        }
        else {
            licenseInfo.maximumDevices = value;
        }
    }

    value = form.validityMonths.value ? form.validityMonths.value.trim() : '';

    if (value.length > 0) {
        value = strToInteger(value);

        if (Number.isNaN(value)) {
            // Invalid integer value. Set error message
            errMsgs.push('Invalid months of validity: not a valid integer number');
            hasError = true;

            if (!focusSet) {
                form.validityMonths.focus();
                focusSet = true;
            }
        }
        else if (value <= 0) {
            // Number value out of range. Set error message
            errMsgs.push('Invalid months of validity: value must be greater than zero');
            hasError = true;

            if (!focusSet) {
                form.validityMonths.focus();
                focusSet = true;
            }
        }
        else {
            licenseInfo.validityMonths = value;
        }
    }

    if (form.supportProvisionalRenewal.checked) {
        value = form.provisionalRenewalDays.value ? form.provisionalRenewalDays.value.trim() : '';

        if (value.length === 0) {
            // Order not supplied. Report error
            errMsgs.push('Please enter the days of provisional renewal');
            hasError = true;

            if (!focusSet) {
                form.provisionalRenewalDays.focus();
                focusSet = true;
            }
        }
        else {
            value = strToInteger(value);

            if (Number.isNaN(value)) {
                // Invalid integer value. Set error message
                errMsgs.push('Invalid days of provisional renewal: not a valid integer number');
                hasError = true;

                if (!focusSet) {
                    form.provisionalRenewalDays.focus();
                    focusSet = true;
                }
            }
            else if (value <= 0) {
                // Number value out of range. Set error message
                errMsgs.push('Invalid days of provisional renewal: value must be greater than zero');
                hasError = true;

                if (!focusSet) {
                    form.provisionalRenewalDays.focus();
                    focusSet = true;
                }
            }
            else {
                licenseInfo.provisionalRenewalDays = value;
            }
        }
    }
    
    return !hasError ? licenseInfo : undefined;
}

function strToInteger(str) {
    const bn = BigNumber(str);

    return bn.isInteger() ? bn.toNumber() : NaN;
}


// Module code
//

Template.licenses.onCreated(function () {
    this.state = new ReactiveDict();

    this.state.set('createLicenseErrMsgs', []);
    this.state.set('errMsgs', []);
    this.state.set('infoMsg', undefined);
    this.state.set('infoMsgType', 'info');

    this.state.set('showInactiveLicenses', this.data.showInactive);
    this.state.set('showProvisionalRenewalDays', false);
    this.state.set('actionSuccessLicense', undefined);

    this.state.set('displayDoCreateLicenseButton', 'none');
    this.state.set('displayCreateLicenseConfirm', 'none');
    this.state.set('displayCreateLicenseSubmitButton', 'none');

    // Subscribe to receive database docs/recs updates
    this.licensesSubs = this.subscribe('licenses');
});

Template.licenses.onDestroyed(function () {
    if (this.licensesSubs) {
        this.licensesSubs.stop();
    }
});

Template.licenses.events({
    'click #lnkShowHideInactiveLicenses'(event, template) {
        template.state.set('showInactiveLicenses', !template.state.get('showInactiveLicenses'));

        return false;
    },
    'click #btnCreateLicense'(event, template) {
        event.preventDefault();

        const form = $('#frmCreateLicense')[0];

        // Reset alert messages
        template.state.set('createLicenseErrMsgs', []);
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');

        // Do not show provisional renewal in days field
        template.state.set('showProvisionalRenewalDays', false);

        // Clear action success license row
        template.state.set('actionSuccessLicense', undefined);

        // Enable and reset form controls
        form.order.disabled = false;
        form.level.disabled = false;
        form.type.disabled = false;
        form.maximumDevices.disabled = false;
        form.validityMonths.disabled = false;
        form.supportProvisionalRenewal.disabled = false;
        form.provisionalRenewalDays.disabled = false;

        form.order.value = '';
        form.level.value = '';
        form.type.value = '';
        form.maximumDevices.value = '';
        form.validityMonths.value = '';
        form.supportProvisionalRenewal.checked = false;
        form.provisionalRenewalDays.value = '';

        // Show do action button
        template.state.set('displayDoCreateLicenseButton', 'inline');

        // Reset action confirmation
        $('#itxCreateLicenseConfirmation')[0].value = '';
        template.state.set('displayCreateLicenseConfirm', 'none');
        template.state.set('displayCreateLicenseSubmitButton', 'none');
    },
    'hidden.bs.modal #divCreateLicense'(event, template) {
        // Modal panel has been closed. Make sure that button used to
        //  activate modal panel is not selected
        $('#btnCreateLicense').blur();
    },
    'input #itxCreateLicenseConfirmation'(event, template) {
        // Suppress spaces from beginning of input
        let inputValue = event.target.value = event.target.value.replace(/^\s+/, '');

        if (inputValue.length > confirmPhrase.length) {
            // Limit length of input
            inputValue = event.target.value = inputValue.substring(0, confirmPhrase.length);
        }

        // Check if input matches confirmation phrase
        if (inputValue.toLowerCase() === confirmPhrase) {
            // Show button to confirm action
            template.state.set('displayCreateLicenseSubmitButton', 'inline');
        }
        else {
            // Hide button to confirm action
            template.state.set('displayCreateLicenseSubmitButton', 'none');
        }
    },
    'click #btnCancelCreateLicenseConfirm'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        // Reset action confirmation
        $('#itxCreateLicenseConfirmation')[0].value = '';
        template.state.set('displayCreateLicenseConfirm', 'none');
        template.state.set('displayCreateLicenseSubmitButton', 'none');

        // Enable form controls
        const form = $('#frmCreateLicense')[0];
        form.order.disabled = false;
        form.level.disabled = false;
        form.type.disabled = false;
        form.maximumDevices.disabled = false;
        form.validityMonths.disabled = false;
        form.supportProvisionalRenewal.disabled = false;
        form.provisionalRenewalDays.disabled = false;

        // Show do action button
        template.state.set('displayDoCreateLicenseButton', 'inline');
    },
    'change #cbxSupportProvisionalRenewal'(event, template) {
        event.stopPropagation();

        if (event.target.checked) {
            // Show provisional renewal in days field
            template.state.set('showProvisionalRenewalDays', true);
        }
        else {
            // Hide end date field
            template.state.set('showProvisionalRenewalDays', false);
        }
    },
    'click #btnDismissInfo'(event, template) {
        // Clear info message
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');

        // Clear action success license row
        template.state.set('actionSuccessLicense', undefined);
    },
    'click #btnDismissError'(event, template) {
        // Clear error message
        template.state.set('errMsgs', []);
    },
    'click #btnDismissCreateLicenseError'(event, template) {
        // Clear error message
        template.state.set('createLicenseErrMsgs', []);
    },
    'click #btnDoCreateLicense'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        // Reset alert messages
        template.state.set('createLicenseErrMsgs', []);
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');

        const form = event.target.form;

        // Do validation of form controls here
        let errMsgs = [];
        let licenseInfo;

        if ((licenseInfo = validateCreateLicenseFormData(form, errMsgs))) {
            // Form OK. Save validated license dat
            form.licenseInfo = licenseInfo;

            // Disable form controls
            form.order.disabled = true;
            form.level.disabled = true;
            form.type.disabled = true;
            form.maximumDevices.disabled = true;
            form.validityMonths.disabled = true;
            form.supportProvisionalRenewal.disabled = true;
            form.provisionalRenewalDays.disabled = true;

            // Hide do action button
            template.state.set('displayDoCreateLicenseButton', 'none');

            // Show action confirmation panel, and make sure that submit button is not shown
            template.state.set('displayCreateLicenseConfirm', 'block');
            template.state.set('displayCreateLicenseSubmitButton', 'none');
        }
        else {
            // Form data error
            template.state.set('createLicenseErrMsgs', errMsgs);
        }
    },
    'submit #frmCreateLicense'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        const form = event.target;

        // Reset alert messages
        template.state.set('createLicenseErrMsgs', []);
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');

        Meteor.call('createLicense', form.licenseInfo, (error, license_id) => {
            if (error) {
                template.state.set('createLicenseErrMsgs', [
                    error.toString()
                ]);
            }
            else {
                // New license successfully added
                template.state.set('actionSuccessLicense', license_id);

                template.state.set('infoMsg', 'New license successfully added');
                template.state.set('infoMsgType', 'success');

                // Close modal panel
                $('#divCreateLicense').modal('hide');
            }
        });
    }
});

Template.licenses.helpers({
    licenses() {
        const template = Template.instance();

        const selector = {};

        if (!template.state.get('showInactiveLicenses')) {
            selector.status = {
                $nin: [
                    LicenseShared.status.inactive.name
                ]
            }
        }

        return Catenis.db.collection.License.find(selector, {
            sort: {
                order: 1,
                Level: 1,
                Type: 1,
                Revision: 1,
                Status: 1
            }
        }).fetch();
    },
    licenseName(license) {
        let licName = ClientUtil.capitalize(license.level);

        if (license.type) {
            licName += ' (' + license.type + ')';
        }

        return licName;
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
    showHideInactiveLicensesAction() {
        return Template.instance().state.get('showInactiveLicenses') ? 'Hide' : 'Show';
    },
    displayProvisionalRenewalDays() {
        return Template.instance().state.get('showProvisionalRenewalDays') ? 'block' : 'none';
    },
    hasCreateLicenseErrorMessage() {
        return Template.instance().state.get('createLicenseErrMsgs').length > 0;
    },
    createLicenseErrorMessage() {
        return Template.instance().state.get('createLicenseErrMsgs').reduce((compMsg, errMsg) => {
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
    actionSuccessLicenseRowClass(license_id) {
        return license_id === Template.instance().state.get('actionSuccessLicense') ? 'success' : '';
    },
    displayDoCreateLicenseButton() {
        return Template.instance().state.get('displayDoCreateLicenseButton');
    },
    displayCreateLicenseConfirm() {
        return Template.instance().state.get('displayCreateLicenseConfirm');
    },
    displayCreateLicenseSubmitButton() {
        return Template.instance().state.get('displayCreateLicenseSubmitButton');
    },
    returnQueryString() {
        if (Template.instance().state.get('showInactiveLicenses')) {
            return '?' + querystring.stringify({
                retparams: querystring.stringify({
                    showinactive: 1
                })
            });
        }
    }
});
