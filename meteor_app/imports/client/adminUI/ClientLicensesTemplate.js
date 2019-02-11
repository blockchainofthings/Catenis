/**
 * Created by Claudio on 2018-07-31.
 */

//console.log('[ClientLicensesTemplate.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import moment from 'moment-timezone';
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
import './ClientLicensesTemplate.html';

// Import dependent templates
import './ClientLicenseDetailsTemplate.js';
import querystring from "querystring";

// Module variables
const minValidityDays = 7;
const confirmPhrase = 'yes, i do confirm it';


// Definition of module (private) functions
//

function validateAddLicenseFormData(form, errMsgs) {
    const clientLicenseInfo = {};
    let hasError = false;

    clientLicenseInfo.license_id = form.license.value;

    if (clientLicenseInfo.license_id.length === 0) {
        // No license selected. Report error
        errMsgs.push('Please select a license.');
        hasError = true;
    }

    const startDate = $(form.licenseStartDate).data('DateTimePicker').date();

    if (startDate) {
        clientLicenseInfo.startDate = startDate.format('YYYY-MM-DD');
    }

    if (form.overrideValidity.checked) {
        const endDate = $(form.licenseEndDate).data('DateTimePicker').date();

        if (!endDate) {
            // No license end date to override validity. Report error
            errMsgs.push('Please enter an end date.');
            hasError = true;
        }
        else {
            clientLicenseInfo.endDate = endDate.format('YYYY-MM-DD');
        }
    }

    return !hasError ? clientLicenseInfo : undefined;
}


// Module code
//

Template.clientLicenses.onCreated(function () {
    this.state = new ReactiveDict();

    this.state.set('showExpiredLicenses', this.data.showExpired);
    this.state.set('showAddLicenseEndDate', false);
    this.state.set('addLicenseErrMsgs', []);
    this.state.set('errMsgs', []);
    this.state.set('infoMsg', undefined);
    this.state.set('infoMsgType', 'info');
    this.state.set('actionSuccessClientLicense', undefined);
    this.state.set('replaceActiveClientLicense', false);
    this.state.set('addMoreRestrictiveLicense', false);

    this.state.set('displayDoAddLicenseButton', 'none');
    this.state.set('displayAddLicenseConfirm', 'none');
    this.state.set('displayAddLicenseSubmitButton', 'none');

    // Subscribe to receive database docs/recs updates
    this.clientRecordSubs = this.subscribe('clientRecord', this.data.client_id);
    this.allClientLicensesSubs = this.subscribe('allClientLicenses', this.data.client_id);
    this.allClientLicenseLicensesSubs = this.subscribe('allClientLicenseLicenses', this.data.client_id);
});

Template.clientLicenses.onDestroyed(function () {
    if (this.clientRecordSubs) {
        this.clientRecordSubs.stop();
    }

    if (this.allClientLicensesSubs) {
        this.allClientLicensesSubs.stop();
    }

    if (this.allClientLicenseLicensesSubs) {
        this.allClientLicenseLicensesSubs.stop();
    }
});

Template.clientLicenses.events({
    'click #lnkShowHideExpiredLicenses'(event, template) {
        template.state.set('showExpiredLicenses', !template.state.get('showExpiredLicenses'));

        return false;
    },
    'click #btnAddClientLicense'(event, template) {
        event.preventDefault();

        const form = $('#frmAddClientLicense')[0];

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

            // Now check if it will replace active client license
            let replaceActiveLicense = false;

            if (form.activeClientLicenseStartDate.value) {
                replaceActiveLicense = startDate.diff(form.activeClientLicenseStartDate.value, 'd', true) === 0;
            }
            
            template.state.set('replaceActiveClientLicense', replaceActiveLicense);
        });

        // Reset alert messages
        template.state.set('addLicenseErrMsgs', []);
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');

        // Do not show end date field
        template.state.set('showAddLicenseEndDate', false);

        // Clear action success client license row
        template.state.set('actionSuccessClientLicense', undefined);

        // Enable and reset form controls
        const dataDtPicker = dtPicker.data('DateTimePicker');
        const dataDtPicker2 = dtPicker2.data('DateTimePicker');
        form.license.disabled = false;
        form.overrideValidity.disabled = false;
        dataDtPicker.enable();
        dataDtPicker2.enable();

        form.license.value = '';
        form.overrideValidity.checked = false;
        dataDtPicker.clear();
        dataDtPicker2.clear();

        // Show do action button
        template.state.set('displayDoAddLicenseButton', 'inline');

        // Reset indication of replacing currently active client license
        template.state.set('replaceActiveClientLicense', !!form.activeClientLicenseStartDate.value);

        // Reset indication of more restrictive license
        template.state.set('addMoreRestrictiveLicense', false);

        // Reset action confirmation
        $('#itxAddConfirmation')[0].value = '';
        template.state.set('displayAddLicenseConfirm', 'none');
        template.state.set('displayAddLicenseSubmitButton', 'none');
    },
    'hidden.bs.modal #divAddClientLicense'(events, template) {
        // Modal panel has been closed. Make sure that button used to
        //  activate modal panel is not selected
        $('#btnAddClientLicense').blur();
    },
    'input #itxAddConfirmation'(event, template) {
        // Suppress spaces from beginning of input
        let inputValue = event.target.value = event.target.value.replace(/^\s+/, '');

        if (inputValue.length > confirmPhrase.length) {
            // Limit length of input
            inputValue = event.target.value = inputValue.substring(0, confirmPhrase.length);
        }

        // Check if input matches confirmation phrase
        if (inputValue.toLowerCase() === confirmPhrase) {
            // Show button to confirm action
            template.state.set('displayAddLicenseSubmitButton', 'inline');
        }
        else {
            // Hide button to confirm action
            template.state.set('displayAddLicenseSubmitButton', 'none');
        }
    },
    'click #btnCancelAddLicenseConfirm'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        // Reset action confirmation
        $('#itxAddConfirmation')[0].value = '';
        template.state.set('displayAddLicenseConfirm', 'none');
        template.state.set('displayAddLicenseSubmitButton', 'none');

        // Enable form controls
        const form = $('#frmAddClientLicense')[0];
        form.license.disabled = false;
        form.overrideValidity.disabled = false;
        $('#dtpkrLicenseStartDate').data('DateTimePicker').enable();
        $('#dtpkrLicenseEndDate').data('DateTimePicker').enable();

        // Show do action button
        template.state.set('displayDoAddLicenseButton', 'inline');
    },
    'change #selLicense'(event, template) {
        // Check if a more restrictive license is selected
        const newLicense_id = event.target.value;
        const form = event.target.form;
        let moreRestrictiveLicense = false;

        if (newLicense_id && form.activeClientLicenseOrder.value) {
            const docNewLicense = Catenis.db.collection.License.findOne({
                _id: newLicense_id
            }, {
                fields: {
                    order: 1
                }
            });

            moreRestrictiveLicense = docNewLicense.order > form.activeClientLicenseOrder.value;
        }

        template.state.set('addMoreRestrictiveLicense', moreRestrictiveLicense);
    },
    'change #cbxOverrideValidity'(events, template) {
        events.stopPropagation();

        if (events.target.checked) {
            // Show end date field
            template.state.set('showAddLicenseEndDate', true);
        }
        else {
            // Hide end date field
            template.state.set('showAddLicenseEndDate', false);
        }
    },
    'click #btnDismissInfo'(events, template) {
        // Clear info message
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');

        // Clear action success client license row
        template.state.set('actionSuccessClientLicense', undefined);
    },
    'click #btnDismissError'(events, template) {
        // Clear error message
        template.state.set('errMsgs', []);
    },
    'click #btnDismissAddLicenseError'(events, template) {
        // Clear error message
        template.state.set('addLicenseErrMsgs', []);
    },
    'click #btnDoAddLicense'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        // Reset alert messages
        template.state.set('addLicenseErrMsgs', []);
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');

        const form = event.target.form;

        // Do validation of form controls here
        let errMsgs = [];
        let clientLicenseInfo;

        if ((clientLicenseInfo = validateAddLicenseFormData(form, errMsgs))) {
            // Form OK. Save validated client license dat
            form.clientLicenseInfo = clientLicenseInfo;

            // Disable form controls
            form.license.disabled = true;
            form.overrideValidity.disabled = true;
            $('#dtpkrLicenseStartDate').data('DateTimePicker').disable();
            $('#dtpkrLicenseEndDate').data('DateTimePicker').disable();

            // Hide do action button
            template.state.set('displayDoAddLicenseButton', 'none');

            // Show action confirmation panel, and make sure that submit button is not shown
            template.state.set('displayAddLicenseConfirm', 'block');
            template.state.set('displayAddLicenseSubmitButton', 'none');
        }
        else {
            // Form data error
            template.state.set('addLicenseErrMsgs', errMsgs);
        }
    },
    'submit #frmAddClientLicense'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        const form = event.target;
        let confirmMsg = 'LAST CHANCE!\n\nIf you proceed, the client license will be added';

        if (form.replaceActiveClientLicense) {
            confirmMsg += ', and will REPLACE the currently ACTIVE client\'s license';
        }

        if (form.isMoreRestrictiveLicense) {
            confirmMsg += ', and may FORCE the DEACTIVATION of some of the client\'s virtual devices';

            if (!form.replaceActiveClientLicense) {
                confirmMsg += ' when it is activated';
            }
        }

        confirmMsg += '.\n\nPLEASE NOTE THAT THIS ACTION CANNOT BE UNDONE.';

        if (confirm(confirmMsg)) {
            // Reset alert messages
            template.state.set('addLicenseErrMsgs', []);
            template.state.set('errMsgs', []);
            template.state.set('infoMsg', undefined);
            template.state.set('infoMsgType', 'info');

            Meteor.call('addClientLicense', template.data.client_id, form.clientLicenseInfo, (error, clientLicense_id) => {
                if (error) {
                    template.state.set('addLicenseErrMsgs', [
                        error.toString()
                    ]);
                }
                else {
                    // New client license successfully added
                    template.state.set('actionSuccessClientLicense', clientLicense_id);

                    template.state.set('infoMsg', 'New client license successfully added');
                    template.state.set('infoMsgType', 'success');

                    // Close modal panel
                    $('#divAddClientLicense').modal('hide');
                }
            });
        }
        else {
            // Close modal panel
            $('#divAddClientLicense').modal('hide');
        }
    }
});

Template.clientLicenses.helpers({
    client() {
        return Catenis.db.collection.Client.findOne({_id: Template.instance().data.client_id});
    },
    clientTitle(client) {
        return client.props.name || client.clientId;
    },
    clientLicenses() {
        const template = Template.instance();

        const selector = {
            client_id: template.data.client_id
        };

        if (!template.state.get('showExpiredLicenses')) {
            selector.status = {
                $nin: [
                    ClientLicenseShared.status.expired.name
                ]
            }
        }

        return Catenis.db.collection.ClientLicense.find(selector, {
            sort: {
                'validity.startDate': 1,
                'activatedDate': 1,
                'provisionedDate': 1,
                'expiredDate': 1
            }
        });
    },
    clientLicenseLicense(license_id) {
        return Catenis.db.collection.License.findOne({_id: license_id});
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
    currentActiveClientLicense() {
        return Catenis.db.collection.ClientLicense.findOne({
            client_id: Template.instance().data.client_id,
            status: ClientLicenseShared.status.active.name
        }, {
            sort: {
                'validity.startDate': -1,
                activatedDate: -1
            }
        });
    },
    licenseName(license) {
        let licName = ClientUtil.capitalize(license.level);

        if (license.type) {
            licName += ' (' + license.type + ')';
        }

        return licName;
    },
    formatISODate(date) {
        return (date instanceof Date) && date.toISOString();
    },
    formatShortDate(date, client) {
        return date ? ClientUtil.startOfDayTimeZone(date, client.timeZone, true).format('LL') : undefined;
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
    showHideExpiredLicensesAction() {
        return Template.instance().state.get('showExpiredLicenses') ? 'Hide' : 'Show';
    },
    displayAddLicenseEndDate() {
        return Template.instance().state.get('showAddLicenseEndDate') ? 'block' : 'none';
    },
    hasAddLicenseErrorMessage() {
        return Template.instance().state.get('addLicenseErrMsgs').length > 0;
    },
    addLicenseErrorMessage() {
        return Template.instance().state.get('addLicenseErrMsgs').reduce((compMsg, errMsg) => {
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
    actionSuccessClientLicenseRowClass(clientLicense_id) {
        return clientLicense_id === Template.instance().state.get('actionSuccessClientLicense') ? 'success' : '';
    },
    displayDoAddLicenseButton() {
        return Template.instance().state.get('displayDoAddLicenseButton');
    },
    displayAddLicenseConfirm() {
        return Template.instance().state.get('displayAddLicenseConfirm');
    },
    displayAddLicenseSubmitButton() {
        return Template.instance().state.get('displayAddLicenseSubmitButton');
    },
    replaceActiveClientLicense() {
        return Template.instance().state.get('replaceActiveClientLicense');
    },
    addMoreRestrictiveLicense() {
        return Template.instance().state.get('addMoreRestrictiveLicense');
    },
    returnQueryString() {
        if (Template.instance().state.get('showExpiredLicenses')) {
            return '?' + querystring.stringify({
                retparams: querystring.stringify({
                    showexpired: 1
                })
            });
        }
    }
});
