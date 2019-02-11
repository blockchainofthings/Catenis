/**
 * Created by claudio on 2018-08-29.
 */

//console.log('[ServiceAccountTemplate.js]: This code just ran.');

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

// Import template UI
import './ServiceAccountTemplate.html';

// Import dependent templates
import './BcotPaymentAddressTemplate.js';
import './BillingReportTemplate.js';

// Module variables
const confirmPhrase = 'yes, i do confirm it';


// Definition of module (private) functions
//

function validateRedeemBcotFormData(form, errMsgs) {
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
        errMsgs.push('Please enter at least one purchase code');
        hasError = true;

        form.purchaseCodes.focus();
    }

    return !hasError ? enteredPurchaseCodes : undefined;
}


// Module code
//

Template.serviceAccount.onCreated(function () {
    this.state = new ReactiveDict();

    this.state.set('errMsgs', []);
    this.state.set('redeemBcotErrMsgs', []);
    this.state.set('infoMsg', undefined);
    this.state.set('infoMsgType', 'info');

    this.state.set('bcotPayAddress', undefined);
    this.state.set('displayDoRedeemBcotButton', 'none');
    this.state.set('displayRedeemBcotConfirm', 'none');
    this.state.set('displayRedeemBcotSubmitButton', 'none');

    // Subscribe to receive database docs/recs updates
    this.clientRecordSubs = this.subscribe('clientRecord', this.data.client_id);
    this.serviceAccountBalanceSubs = this.subscribe('serviceAccountBalance', this.data.client_id);
});

Template.serviceAccount.onDestroyed(function () {
    if (this.clientRecordSubs) {
        this.clientRecordSubs.stop();
    }

    if (this.serviceAccountBalanceSubs) {
        this.serviceAccountBalanceSubs.stop();
    }
});

Template.serviceAccount.events({
    'click #btnDismissInfo'(events, template) {
        // Clear info message
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');
    },
    'click #btnDismissError'(events, template) {
        // Clear error message
        template.state.set('errMsgs', []);
    },
    'click #btnAddCredit'(events, template) {
        // Reset alert messages
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');

        Meteor.call('newBcotPaymentAddress', template.data.client_id, (error, addr) => {
            if (error) {
                const errMsgs = template.state.get('errMsgs');
                errMsgs.push('Error retrieving BCOT payment address: ' + error.toString());
                template.state.set('errMsgs', errMsgs);

                // Close modal panel
                $('#divAddServiceCredit').modal('hide');
            }
            else {
                template.state.set('bcotPayAddress', addr);
            }
        });
    },
    'hide.bs.modal #divAddServiceCredit'(event, template) {
        // Modal panel about to close. Ask for confirmation
        return template.state.get('errMsgs').length > 0 || confirm('WARNING: if you proceed, you will NOT be able to continue monitoring the incoming BCOT tokens.\n\nPLEASE NOTE THAT THIS ACTION CANNOT BE UNDONE.');
    },
    'hidden.bs.modal #divAddServiceCredit'(event, template) {
        // Modal panel has been closed. Clear BCOT payment address
        template.state.set('bcotPayAddress', undefined);

        // Make sure that button used to activate modal panel is not selected
        $('#btnAddCredit').blur();
    },
    'click #btnRedeemBcot'(event, template) {
        event.preventDefault();

        const form = $('#frmRedeemBcot')[0];

        // Reset alert messages
        template.state.set('redeemBcotErrMsgs', []);
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');

        // Do not show SKU field
        template.state.set('showSku', false);

        // Enable and reset form controls
        form.purchaseCodes.disabled = false;
        form.purchaseCodes.value = '';

        // Show do action button
        template.state.set('displayDoRedeemBcotButton', 'inline');

        // Reset action confirmation
        $('#itxRedeemBcotConfirmation')[0].value = '';
        template.state.set('displayRedeemBcotConfirm', 'none');
        template.state.set('displayRedeemBcotSubmitButton', 'none');
    },
    'hidden.bs.modal #divRedeemBcot'(events, template) {
        // Modal panel has been closed. Make sure that button used to
        //  activate modal panel is not selected
        $('#btnRedeemBcot').blur();
    },
    'input #itxRedeemBcotConfirmation'(event, template) {
        // Suppress spaces from beginning of input
        let inputValue = event.target.value = event.target.value.replace(/^\s+/, '');

        if (inputValue.length > confirmPhrase.length) {
            // Limit length of input
            inputValue = event.target.value = inputValue.substring(0, confirmPhrase.length);
        }

        // Check if input matches confirmation phrase
        if (inputValue.toLowerCase() === confirmPhrase) {
            // Show button to confirm action
            template.state.set('displayRedeemBcotSubmitButton', 'inline');
        }
        else {
            // Hide button to confirm action
            template.state.set('displayRedeemBcotSubmitButton', 'none');
        }
    },
    'click #btnCancelRedeemBcotConfirm'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        // Reset action confirmation
        $('#itxRedeemBcotConfirmation')[0].value = '';
        template.state.set('displayRedeemBcotConfirm', 'none');
        template.state.set('displayRedeemBcotSubmitButton', 'none');

        // Enable form controls
        const form = $('#frmRedeemBcot')[0];
        form.purchaseCodes.disabled = false;

        // Show do action button
        template.state.set('displayDoRedeemBcotButton', 'inline');
    },
    'click #btnDismissRedeemBcotError'(events, template) {
        // Clear error message
        template.state.set('redeemBcotErrMsgs', []);
    },
    'click #btnDoRedeemBcot'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        // Reset alert messages
        template.state.set('redeemBcotErrMsgs', []);
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');

        const form = event.target.form;

        // Do validation of form controls here
        let errMsgs = [];
        let enteredPurchaseCodes;

        if ((enteredPurchaseCodes = validateRedeemBcotFormData(form, errMsgs))) {
            // Form OK. Save validated product data
            form.enteredPurchaseCodes = enteredPurchaseCodes;

            // Disable form controls
            form.purchaseCodes.disabled = true;

            // Hide do action button
            template.state.set('displayDoRedeemBcotButton', 'none');

            // Show action confirmation panel, and make sure that submit button is not shown
            template.state.set('displayRedeemBcotConfirm', 'block');
            template.state.set('displayRedeemBcotSubmitButton', 'none');
        }
        else {
            // Form data error
            template.state.set('redeemBcotErrMsgs', errMsgs);
        }
    },
    'submit #frmRedeemBcot'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        const form = event.target;

        // Reset alert messages
        template.state.set('redeemBcotErrMsgs', []);
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');

        Meteor.call('redeemBcot', template.data.client_id, form.enteredPurchaseCodes, (error) => {
            if (error) {
                template.state.set('redeemBcotErrMsgs', [
                    error.toString()
                ]);
            }
            else {
                template.state.set('infoMsg', 'Purchased Catenis credits successfully redeemed');
                template.state.set('infoMsgType', 'success');

                // Close modal panel
                $('#divRedeemBcot').modal('hide');
            }
        });
    }
});

Template.serviceAccount.helpers({
    client() {
        return Catenis.db.collection.Client.findOne({_id: Template.instance().data.client_id});
    },
    clientTitle(client) {
        return client.props.name || client.clientId;
    },
    serviceAccountBalance() {
        return Catenis.db.collection.ServiceAccountBalance.findOne(1);
    },
    bcotPayAddress() {
        return Template.instance().state.get('bcotPayAddress');
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
    hasRedeemBcotErrorMessage() {
        return Template.instance().state.get('redeemBcotErrMsgs').length > 0;
    },
    redeemBcotErrorMessage() {
        return Template.instance().state.get('redeemBcotErrMsgs').reduce((compMsg, errMsg) => {
            if (compMsg.length > 0) {
                compMsg += '<br>';
            }
            return compMsg + errMsg;
        }, '');
    },
    displayDoRedeemBcotButton() {
        return Template.instance().state.get('displayDoRedeemBcotButton');
    },
    displayRedeemBcotConfirm() {
        return Template.instance().state.get('displayRedeemBcotConfirm');
    },
    displayRedeemBcotSubmitButton() {
        return Template.instance().state.get('displayRedeemBcotSubmitButton');
    }
});
