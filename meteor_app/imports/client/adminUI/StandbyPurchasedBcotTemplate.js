/**
 * Created by claudio on 2020-08-20
 */

//console.log('[StandbyPurchasedBcotTemplate.js]: This code just ran.');

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
import { ClientShared } from '../../both/ClientShared';

// References code in other (Catenis) modules on the client
import { Catenis } from '../ClientCatenis';

// Import template UI
import './StandbyPurchasedBcotTemplate.html';

// Import dependent templates

// Module variables
const confirmPhrase = 'yes, i do confirm it';


// Definition of module (private) functions
//

function validateAddVouchersFormData(form, errMsgs) {
    const enteredPurchaseCodes = [];
    let hasError = false;
    let value;

    value = form.purchaseCodes.value ? form.purchaseCodes.value.trim() : '';

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
        hasError = true;

        form.purchaseCodes.focus();
    }

    return !hasError ? enteredPurchaseCodes : undefined;
}


// Module code
//

Template.standbyPurchasedBcot.onCreated(function () {
    this.state = new ReactiveDict();

    this.state.set('errMsgs', []);
    this.state.set('addVouchersErrMsgs', []);
    this.state.set('removeVouchersErrMsgs', []);
    this.state.set('infoMsg', undefined);
    this.state.set('infoMsgType', 'info');

    this.state.set('displayDoAddVouchersButton', 'none');
    this.state.set('displayAddVouchersConfirm', 'none');
    this.state.set('displayAddVouchersSubmitButton', 'none');

    this.state.set('displayRemoveVouchersSubmitButton', 'none');

    this.state.set('targetDocId', undefined);

    // Subscribe to receive database docs/recs updates
    this.clientRecordSubs = this.subscribe('clientRecord', this.data.client_id);
    this.standbyPurchasedBcotSubs = this.subscribe('standbyPurchasedBcot', this.data.client_id);
});

Template.standbyPurchasedBcot.onDestroyed(function () {
    if (this.clientRecordSubs) {
        this.clientRecordSubs.stop();
    }

    if (this.standbyPurchasedBcotSubs) {
        this.standbyPurchasedBcotSubs.stop();
    }
});

Template.standbyPurchasedBcot.events({
    'click #btnDismissInfo'(event, template) {
        // Clear info message
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');
    },
    'click #btnDismissError'(event, template) {
        // Clear error message
        template.state.set('errMsgs', []);
    },
    'show.bs.modal #divOutcomeDetails'(event, template) {
        // Modal panel is being displayed. Identify target Standby Purchased BCOT rec/doc
        template.state.set('targetDocId', $(event.relatedTarget).data('doc_id'));
    },
    'hidden.bs.modal #divOutcomeDetails'(event, template) {
        // Modal panel has been closed. Make sure that button used to
        //  activate modal panel is not selected
        $(`#lnkOutcomeDetails[data-doc_id="${template.state.get('targetDocId')}"]`).blur();
    },
    'click #lnkRemoveVouchers'(event, template) {
        event.preventDefault();

        // Reset alert messages
        template.state.set('removeVouchersErrMsgs', []);
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');

        // Reset action confirmation
        $('#itxRemoveConfirmation')[0].value = '';
        template.state.set('displayRemoveVouchersSubmitButton', 'none');
    },
    'show.bs.modal #divRemoveVouchers'(event, template) {
        // Modal panel is being displayed. Identify target Standby Purchased BCOT rec/doc
        template.state.set('targetDocId', $(event.relatedTarget).data('doc_id'));
    },
    'hidden.bs.modal #divRemoveVouchers'(event, template) {
        // Modal panel has been closed. Make sure that button used to
        //  activate modal panel is not selected
        $(`#lnkRemoveVouchers[data-doc_id="${template.state.get('targetDocId')}"]`).blur();
    },
    'input #itxRemoveConfirmation'(event, template) {
        // Suppress spaces from beginning of input
        let inputValue = event.target.value = event.target.value.replace(/^\s+/, '');

        if (inputValue.length > confirmPhrase.length) {
            // Limit length of input
            inputValue = event.target.value = inputValue.substring(0, confirmPhrase.length);
        }

        // Check if input matches confirmation phrase
        if (inputValue.toLowerCase() === confirmPhrase) {
            // Show button to confirm action
            template.state.set('displayRemoveVouchersSubmitButton', 'inline');
        }
        else {
            // Hide button to confirm action
            template.state.set('displayRemoveVouchersSubmitButton', 'none');
        }
    },
    'click #btnDismissRemoveVouchersError'(event, template) {
        // Clear error message
        template.state.set('removeVouchersErrMsgs', []);
    },
    'submit #frmRemoveVouchers'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        const form = event.target;

        // Reset alert messages
        template.state.set('removeVouchersErrMsgs', []);
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');

        Meteor.call('removeStandbyBcot', template.data.client_id, form.doc_id.value, (error) => {
            if (error) {
                // Reset action confirmation and...
                $('#itxRemoveConfirmation')[0].value = '';
                template.state.set('displayRemoveVouchersSubmitButton', 'none');

                // Display error message
                template.state.set('removeVouchersErrMsgs', [
                    error.toString()
                ]);
            }
            else {
                // Standby vouchers successfully removed
                template.state.set('infoMsg', 'Vouchers successfully removed');
                template.state.set('infoMsgType', 'success');

                // Close modal panel
                $('#divRemoveVouchers').modal('hide');
            }
        });
    },
    'click #btnAddVouchers'(event, template) {
        event.preventDefault();

        const form = $('#frmAddVouchers')[0];

        // Reset alert messages
        template.state.set('addVouchersErrMsgs', []);
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');

        // Do not show SKU field
        template.state.set('showSku', false);

        // Enable and reset form controls
        form.purchaseCodes.disabled = false;
        form.purchaseCodes.value = '';

        // Show do action button
        template.state.set('displayDoAddVouchersButton', 'inline');

        // Reset action confirmation
        $('#itxAddVouchersConfirmation')[0].value = '';
        template.state.set('displayAddVouchersConfirm', 'none');
        template.state.set('displayAddVouchersSubmitButton', 'none');
    },
    'hidden.bs.modal #divAddVouchers'(event, template) {
        // Modal panel has been closed. Make sure that button used to
        //  activate modal panel is not selected
        $('#btnAddVouchers').blur();
    },
    'input #itxAddVouchersConfirmation'(event, template) {
        // Suppress spaces from beginning of input
        let inputValue = event.target.value = event.target.value.replace(/^\s+/, '');

        if (inputValue.length > confirmPhrase.length) {
            // Limit length of input
            inputValue = event.target.value = inputValue.substring(0, confirmPhrase.length);
        }

        // Check if input matches confirmation phrase
        if (inputValue.toLowerCase() === confirmPhrase) {
            // Show button to confirm action
            template.state.set('displayAddVouchersSubmitButton', 'inline');
        }
        else {
            // Hide button to confirm action
            template.state.set('displayAddVouchersSubmitButton', 'none');
        }
    },
    'click #btnCancelAddVouchersConfirm'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        // Reset action confirmation
        $('#itxAddVouchersConfirmation')[0].value = '';
        template.state.set('displayAddVouchersConfirm', 'none');
        template.state.set('displayAddVouchersSubmitButton', 'none');

        // Enable form controls
        const form = $('#frmAddVouchers')[0];
        form.purchaseCodes.disabled = false;

        // Show do action button
        template.state.set('displayDoAddVouchersButton', 'inline');
    },
    'click #btnDismissAddVouchersError'(event, template) {
        // Clear error message
        template.state.set('addVouchersErrMsgs', []);
    },
    'click #btnDoAddVouchers'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        // Reset alert messages
        template.state.set('addVouchersErrMsgs', []);
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');

        const form = event.target.form;

        // Do validation of form controls here
        let errMsgs = [];
        let enteredPurchaseCodes;

        if ((enteredPurchaseCodes = validateAddVouchersFormData(form, errMsgs))) {
            // Form OK. Save validated product data
            form.enteredPurchaseCodes = enteredPurchaseCodes;

            // Disable form controls
            form.purchaseCodes.disabled = true;

            // Hide do action button
            template.state.set('displayDoAddVouchersButton', 'none');

            // Show action confirmation panel, and make sure that submit button is not shown
            template.state.set('displayAddVouchersConfirm', 'block');
            template.state.set('displayAddVouchersSubmitButton', 'none');
        }
        else {
            // Form data error
            template.state.set('addVouchersErrMsgs', errMsgs);
        }
    },
    'submit #frmAddVouchers'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        const form = event.target;

        // Reset alert messages
        template.state.set('addVouchersErrMsgs', []);
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');

        Meteor.call('addStandbyBcot', template.data.client_id, form.enteredPurchaseCodes, (error) => {
            if (error) {
                template.state.set('addVouchersErrMsgs', [
                    error.toString()
                ]);
            }
            else {
                template.state.set('infoMsg', 'Catenis vouchers successfully added');
                template.state.set('infoMsgType', 'success');

                // Close modal panel
                $('#divAddVouchers').modal('hide');
            }
        });
    }
});

Template.standbyPurchasedBcot.helpers({
    client() {
        return Catenis.db.collection.Client.findOne({_id: Template.instance().data.client_id});
    },
    clientTitle(client) {
        return client.props.name || client.clientId;
    },
    isNewClient(client) {
        return client.status === ClientShared.status.new.name;
    },
    standbyPurchasedBcotDocs() {
        return Catenis.db.collection.StandbyPurchasedBcot.find();
    },
    targetDoc() {
        return Catenis.db.collection.StandbyPurchasedBcot.findOne({_id: Template.instance().state.get('targetDocId')});
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
    hasAddVouchersErrorMessage() {
        return Template.instance().state.get('addVouchersErrMsgs').length > 0;
    },
    addVouchersErrorMessage() {
        return Template.instance().state.get('addVouchersErrMsgs').reduce((compMsg, errMsg) => {
            if (compMsg.length > 0) {
                compMsg += '<br>';
            }
            return compMsg + errMsg;
        }, '');
    },
    displayDoAddVouchersButton() {
        return Template.instance().state.get('displayDoAddVouchersButton');
    },
    displayAddVouchersConfirm() {
        return Template.instance().state.get('displayAddVouchersConfirm');
    },
    displayAddVouchersSubmitButton() {
        return Template.instance().state.get('displayAddVouchersSubmitButton');
    },
    hasRemoveVouchersErrorMessage() {
        return Template.instance().state.get('removeVouchersErrMsgs').length > 0;
    },
    removeVouchersErrorMessage() {
        return Template.instance().state.get('removeVouchersErrMsgs').reduce((compMsg, errMsg) => {
            if (compMsg.length > 0) {
                compMsg += '<br>';
            }
            return compMsg + errMsg;
        }, '');
    },
    displayRemoveVouchersSubmitButton() {
        return Template.instance().state.get('displayRemoveVouchersSubmitButton');
    },
    formatDate(date) {
        return moment(date).format('lll');
    },
    listArray(arr, newLine) {
        return arr.join(newLine? '<br>' : ', ');
    },
    hasOutcome(doc) {
        return !!doc.processingResult;
    },
    outcome(doc) {
        return doc.processingResult ? (doc.processingResult.success ? '<span style="color:green">success</span>' : '<span style="color:red">error</span>') : undefined;
    }
});
