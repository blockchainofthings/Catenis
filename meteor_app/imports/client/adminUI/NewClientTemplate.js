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
import { LicenseShared } from '../../both/LicenseShared';
import { ClientUtil } from '../ClientUtil';
import { minValidityDays } from './ClientLicensesTemplate';

// Module variables
const confirmPhrase = 'yes, i do confirm it';
const addStandbyVouchersInitialState = true;


// Definition of module (private) functions

function validateFormData(form, template, callback) {
    const clientInfo = {};
    const errMsgs = [];

    clientInfo.name = form.clientName.value ? form.clientName.value.trim() : '';

    if (clientInfo.name.length === 0) {
        // Client name not supplied. Report error
        errMsgs.push('Please enter a client name');
    }

    clientInfo.username = form.username.value ? form.username.value.trim() : '';

    if (clientInfo.username.length === 0) {
        // Username not supplied. Report error
        errMsgs.push('Please enter a username');
    }

    clientInfo.firstName = form.firstName.value ? form.firstName.value.trim() : undefined;
    clientInfo.lastName = form.lastName.value ? form.lastName.value.trim() : undefined;
    clientInfo.company= form.companyName.value ? form.companyName.value.trim() : undefined;

    if ((!clientInfo.firstName || clientInfo.firstName.length === 0) && (!clientInfo.lastName
        || clientInfo.lastName.length === 0) && (!clientInfo.company || clientInfo.company.length === 0)) {
        // Neither first name, last name nor company name supplied. Report error
        errMsgs.push('Please enter at least one of: first name, last name, or company');
    }

    clientInfo.email = form.email.value ? form.email.value.trim() : '';

    if (clientInfo.email.length === 0) {
        // Email not supplied. Report error
        errMsgs.push('Please enter an email address');
    }
    else {
        if (template.state.get('needsConfirmEmail') && !template.state.get('emailConfirmed')) {
            errMsgs.push('Please confirm email address');
        }
    }

    clientInfo.timeZone = form.timeZone.value;

    clientInfo.licenseInfo = {
        license_id: form.license.value
    };

    if (clientInfo.licenseInfo.license_id.length === 0) {
        // No license selected. Report error
        errMsgs.push('Please select a license.');
    }

    const startDate = $(form.licenseStartDate).data('DateTimePicker').date();

    if (startDate) {
        clientInfo.licenseInfo.startDate = startDate.format('YYYY-MM-DD');
    }

    if (form.overrideValidity.checked) {
        const endDate = $(form.licenseEndDate).data('DateTimePicker').date();

        if (!endDate) {
            // No license end date to override validity. Report error
            errMsgs.push('Please enter a license end date.');
        }
        else {
            clientInfo.licenseInfo.endDate = endDate.format('YYYY-MM-DD');
        }
    }

    if (form.addStandbyVouchers.checked) {
        const enteredPurchaseCodes = [];
        const value = form.purchaseCodes.value ? form.purchaseCodes.value.trim() : '';

        if (value.length > 0) {
            value.split('\n').forEach((line) => {
                line.split(',').forEach((purchaseCode) => {
                    purchaseCode = purchaseCode.trim();

                    if (purchaseCode.length > 0) {
                        enteredPurchaseCodes.push(purchaseCode);
                    }
                })
            });
        }

        if (enteredPurchaseCodes.length === 0) {
            // Purchase codes not supplied. Report error
            errMsgs.push('Please enter at least one Catenis voucher ID');

            // Return error
            callback(errMsgs);
        }
        else {
            // Validate entered purchase codes (Catenis voucher IDs)
            Meteor.call('validatePurchasedBcot', enteredPurchaseCodes, (error, isValid) => {
                if (error) {
                    console.error('Error calling \'validatedPurchasedBcot\' remote method:', error);
                    isValid = false;
                }

                if (!isValid) {
                    // Supplied purchase codes are not valid. Report error
                    errMsgs.push('At least one of Catenis voucher IDs are not valid');
                }
                else {
                    clientInfo.standbyPurchasedCodes = enteredPurchaseCodes;
                }

                // Return validation result
                if (errMsgs.length > 0) {
                    callback(errMsgs);
                }
                else {
                    callback(null, clientInfo);
                }
            });
        }
    }
    else {
        // Return validation result
        if (errMsgs.length > 0) {
            callback(errMsgs);
        }
        else {
            callback(null, clientInfo);
        }
    }
}


// Module code
//

Template.newClient.onCreated(function () {
    this.state = new ReactiveDict();

    this.state.set('errMsgs', []);
    this.state.set('infoMsg', undefined);
    this.state.set('infoMsgType', 'info');

    this.state.set('displayConfirmNewClientSubmitButton', 'none');
    this.state.set('isInitializing', true);
    this.state.set('showAddLicenseEndDate', false);
    this.state.set('validatedClientInfo', undefined);
    this.state.set('clientCreated', false);

    this.state.set('needsConfirmEmail', false);
    this.state.set('emailConfirmed', false);
    this.state.set('emailMismatch', false);

    this.state.set('addStandbyVouchers', addStandbyVouchersInitialState);

    // Subscribe to receive database docs/recs updates
    this.allLicensesSubs = this.subscribe('allLicenses');
});

Template.newClient.onDestroyed(function () {
    if (this.allLicensesSubs) {
        this.allLicensesSubs.stop();
    }
});

Template.newClient.events({
    'click #frmNewClient'(event, template) {
        if (template.state.get('isInitializing')) {
            // Activate date/time picker control
            const dtPicker = $('#dtpkrLicenseStartDate');
            dtPicker.datetimepicker({
                minDate: moment().startOf('day'),
                format: 'YYYY-MM-DD'
            });
            const dtPicker2 = $('#dtpkrLicenseEndDate');
            dtPicker2.datetimepicker({
                useCurrent: false,
                minDate: moment().startOf('day').add(minValidityDays, 'd'),
                format: 'YYYY-MM-DD'
            });

            // Set handler to adjust minimum end date based on currently
            //  selected start date
            dtPicker.on("dp.change", function (e) {
                // Get start date (moment obj)
                let startDate = e.date;

                if (!startDate) {
                    startDate = moment().startOf('day');
                }

                // Adjust limit for end date
                const minDate = startDate.clone();
                minDate.add(minValidityDays, 'd');

                const dataDtPicker2 = dtPicker2.data("DateTimePicker");

                if (dataDtPicker2.date() && dataDtPicker2.date().valueOf() < minDate.valueOf()) {
                    dataDtPicker2.clear();
                }

                dataDtPicker2.minDate(minDate);
            });

            template.state.set('isInitializing', false);
        }
    },
    'click #btnDismissError'(event, template) {
        // Clear error message
        template.state.set('errMsgs', []);
    },
    'click #btnDismissInfo'(event, template) {
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
    'change #txtEmail'(event, template) {
        // Indicate that form field has changed
        template.state.set('fieldsChanged', true);

        // Indicate that e-mail needs to be confirmed
        template.state.set('needsConfirmEmail', true);
        template.state.set('emailConfirmed', false);
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
        template.find('#frmNewClient').confirmEmail.value = '';

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
    'change #cbxOverrideValidity'(event, template) {
        event.stopPropagation();

        if (event.target.checked) {
            // Show end date field
            template.state.set('showAddLicenseEndDate', true);
        }
        else {
            // Hide end date field
            template.state.set('showAddLicenseEndDate', false);
        }
    },
    'change #cbxAddStandbyVouchers'(event, template) {
        event.stopPropagation();

        template.state.set('addStandbyVouchers', event.target.checked);
    },
    'click #btnCancel'(event, template) {
        // Note: we resource to this unconventional solution so we can disable the Cancel button and,
        //      at the same time, make it behave the same way as when a link is clicked (which we
        //      cannot achieve with either window.location.href = '<url>' or document.location = '<url>';
        //      both solutions cause a page reload, whilst clicking on th link does not)
        template.find('#lnkCancel').click();
    },
    'click #btnConfirmNewClient'(event, template) {
        event.preventDefault();

        // Reset action confirmation
        $('#itxNewClientConfirmation')[0].value = '';
        template.state.set('displayConfirmNewClientSubmitButton', 'none');
    },
    'hidden.bs.modal #divConfirmNewClient'(event, template) {
        // Modal panel has been closed. Make sure that button used to
        //  activate modal panel is not selected
        $('#btnCreate').blur();

        template.state.set('validatedClientInfo', undefined);
    },
    'input #itxNewClientConfirmation'(event, template) {
        // Suppress spaces from beginning of input
        let inputValue = event.target.value = event.target.value.replace(/^\s+/, '');

        if (inputValue.length > confirmPhrase.length) {
            // Limit length of input
            inputValue = event.target.value = inputValue.substring(0, confirmPhrase.length);
        }

        // Check if input matches confirmation phrase
        if (inputValue.toLowerCase() === confirmPhrase) {
            // Show button to confirm action
            template.state.set('displayConfirmNewClientSubmitButton', 'inline');
        }
        else {
            // Hide button to confirm action
            template.state.set('displayConfirmNewClientSubmitButton', 'none');
        }
    },
    'submit #frmConfirmNewClient'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        // Close modal panel
        $('#divConfirmNewClient').modal('hide');

        // Disable buttons
        const btnCancel = template.find('#btnCancel');
        const btnCreate = template.find('#btnCreate');
        btnCancel.disabled = true;
        btnCreate.disabled = true;

        // Display alert message indicating that request is being processed
        template.state.set('infoMsg', 'Your request is being processed. Please wait.');

        // Call remote method to create new client
        Meteor.call('createNewClient', Catenis.ctnHubNodeIndex, template.state.get('validatedClientInfo'), (error, clientId) => {
            // Reenable buttons
            btnCancel.disabled = false;
            btnCreate.disabled = false;

            if (error && error.error !== 'client.create.postCreateFailure') {
                // Clear info alert message, and display error message
                template.state.set('infoMsg', undefined);

                template.state.set('errMsgs', [
                    error.toString()
                ]);
            }
            else {
                // Check if there was an error after the client had been successfully created, and
                //  display it if so
                if (error) {
                    template.state.set('errMsgs', error.details.errMsgs);

                    clientId = error.details.clientId;
                }

                // Indicate that client has been successfully created
                template.state.set('clientCreated', true);
                template.state.set('infoMsg', util.format('New client (client ID: %s) successfully created.', clientId));
                template.state.set('infoMsgType', 'success');
            }
        });
    },
    'submit #frmNewClient'(event, template) {
        event.preventDefault();

        const form = event.target;

        // Clear alert messages
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');

        validateFormData(form, template, (errMsgs, clientInfo) => {
            if (errMsgs) {
                template.state.set('errMsgs', errMsgs);
            }
            else {
                template.state.set('validatedClientInfo', clientInfo);
            }
        });
    }
});

Template.newClient.helpers({
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
    displayAddLicenseEndDate() {
        return Template.instance().state.get('showAddLicenseEndDate') ? 'block' : 'none';
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
    },
    displayConfirmNewClientSubmitButton() {
        return Template.instance().state.get('displayConfirmNewClientSubmitButton');
    },
    validatedClientInfo() {
        return Template.instance().state.get('validatedClientInfo');
    },
    addStandbyVouchersInitialState() {
        return addStandbyVouchersInitialState;
    },
    addStandbyVouchers() {
        return Template.instance().state.get('addStandbyVouchers');
    }
});
