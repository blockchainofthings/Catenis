/**
 * Created by claudio on 2018-07-09.
 */

//console.log('[BcotPriceTemplate.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util form 'util';
// Third-party node modules
//import config from 'config';
import BigNumber from 'bignumber.js';
// Meteor packages
import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';
import { ReactiveDict } from 'meteor/reactive-dict';

// References code in other (Catenis) modules on the client
import { Catenis } from '../ClientCatenis';

// Import template UI
import './BcotPriceTemplate.html';

// Import dependent templates


// Definition of module (private) functions
//

function formatCurrency(n) {
    return new BigNumber(n).toFormat(2);
}

function numberToStr(val) {
    return val === undefined || val === null ? '' : val.toString();
}

function strToNumber(str) {
    return str.length > 0 ? parseFloat(str) : undefined;
}

function validateFormData(form, errMsgs) {
    let hasError = false;
    let fieldValue;

    if ((fieldValue = form.newPrice.value.trim()).length === 0) {
        // Empty field. Set error message
        errMsgs.push('Please enter a value');
        form.newPrice.focus();
        hasError = true;
    }
    else {
        let numVal;

        if (Number.isNaN(numVal = parseFloat(fieldValue))) {
            // Invalid numeric value. Set error message
            errMsgs.push('Not a valid number');
            form.newPrice.focus();
            hasError = true;
        }
        else if (numVal <= 0) {
            // Number value out of range. Set error message
            errMsgs.push('Value must be greater than zero');
            form.newPrice.focus();
            hasError = true;
        }
    }

    return !hasError;
}


// Module code
//

Template.bcotPrice.onCreated(function () {
    this.state = new ReactiveDict();

    this.state.set('newPriceErrMsgs', []);
    this.state.set('errMsgs', []);
    this.state.set('infoMsg', undefined);
    this.state.set('infoMsgType', 'info');

    this.state.set('displayDoUpdatePriceButton', 'none');
    this.state.set('displayUpdatePriceConfirm', 'none');
    this.state.set('displayUpdatePriceSubmitButton', 'none');

    // Subscribe to receive BCOT token price updates
    this.bcotPriceSubs = this.subscribe('bcotPrice');
});

Template.bcotPrice.onDestroyed(function () {
    if (this.bcotPriceSubs) {
        this.bcotPriceSubs.stop();
    }
});

Template.bcotPrice.events({
    'click #btnDismissInfo'(events, template) {
        // Clear info message
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');
    },
    'click #btnDismissError'(events, template) {
        // Clear error message
        template.state.set('errMsgs', []);
    },
    'click #btnDismissNewPriceError'(events, template) {
        // Clear error message
        template.state.set('newPriceErrMsgs', []);
    },
    'change #itxNewPrice'(event, template) {
        // Retrieve current BCOT token price...
        const bcotTokenPrice = Catenis.db.collection.BcotTokenPrice.findOne(1);

        if (numberToStr(bcotTokenPrice.price) === event.target.value) {
            // Form values have not changed. Disable save button
            template.state.set('displayDoUpdatePriceButton', 'none');
        }
        else {
            // Form values have changed. Enable save button
            template.state.set('displayDoUpdatePriceButton', 'inline');
        }
    },
    'click #btnUpdatePrice'(event, template) {
        event.preventDefault();

        // Initialize form fields
        const form = $('#frmUpdatePrice')[0];
        const bcotTokenPrice = Catenis.db.collection.BcotTokenPrice.findOne(1);
        form.newPrice.value = formatCurrency(bcotTokenPrice.price);
        form.newPrice.disabled = false;

        // Reset alert messages
        template.state.set('newPriceErrMsgs', []);
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');

        // Hide save price button
        template.state.set('displayDoUpdatePriceButton', 'none');

        // Reset action confirmation
        $('#itxUpdatePriceConfirmation')[0].value = '';
        template.state.set('displayUpdatePriceConfirm', 'none');
        template.state.set('displayUpdatePriceSubmitButton', 'none');
    },
    'hidden.bs.modal #divUpdatePrice'(events, template) {
        // Modal panel has been closed. Make sure that button used to
        //  activate modal panel is not selected
        $('#btnUpdatePrice').blur();
    },
    'change #itxUpdatePriceConfirmation'(event, template) {
        if (event.target.value.trim().toLowerCase() === 'yes, i do confirm it') {
            // Show button to confirm action
            template.state.set('displayUpdatePriceSubmitButton', 'inline');
        }
    },
    'click #btnCancelUpdatePriceConfirm'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        // Reset action confirmation
        $('#itxUpdatePriceConfirmation')[0].value = '';
        template.state.set('displayUpdatePriceConfirm', 'none');
        template.state.set('displayUpdatePriceSubmitButton', 'none');

        // Enable form controls
        const form = $('#frmUpdatePrice')[0];
        form.newPrice.disabled = false;

        // Show save price button
        template.state.set('displayDoUpdatePriceButton', 'inline');
    },
    'click #btnDoUpdatePrice'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        // Reset alert messages
        template.state.set('newPriceErrMsgs', []);
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');

        const form = event.target.form;

        // Do validation of form data
        let errMsgs = [];

        if (validateFormData(form, errMsgs)) {
            // Disable form controls
            form.newPrice.disabled = true;

            // Hide save price button
            template.state.set('displayDoUpdatePriceButton', 'none');

            // Show action confirmation panel, and make sure that submit button is not shown
            template.state.set('displayUpdatePriceConfirm', 'block');
            template.state.set('displayUpdatePriceSubmitButton', 'none');
        }
        else {
            // Form data error
            template.state.set('newPriceErrMsgs', errMsgs);
        }
    },
    'submit #frmUpdatePrice'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        const form = event.target;

        // Clear alert messages
        template.state.set('newPriceErrMsgs', []);
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');

        Meteor.call('setBcotPrice', strToNumber(form.newPrice.value.trim()), (error) => {
            if (error) {
                template.state.set('newPriceErrMsgs', [
                    error.toString()
                ]);
            }
            else {
                // BCOT token price successfully updated
                template.state.set('infoMsg', 'BCOT token price successfully updated');
                template.state.set('infoMsgType', 'success');

                // Close modal panel
                $('#divUpdatePrice').modal('hide');
            }
        });
    }
});

Template.bcotPrice.helpers({
    bcotTokenPrice() {
        return Catenis.db.collection.BcotTokenPrice.findOne(1);
    },
    formatCurrency(n) {
        return formatCurrency(n) ;
    },
    hasNewPriceErrorMessage() {
        return Template.instance().state.get('newPriceErrMsgs').length > 0;
    },
    newPriceErrorMessage() {
        return Template.instance().state.get('newPriceErrMsgs').reduce((compMsg, errMsg) => {
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
    displayDoUpdatePriceButton() {
        return Template.instance().state.get('displayDoUpdatePriceButton');
    },
    displayUpdatePriceConfirm() {
        return Template.instance().state.get('displayUpdatePriceConfirm');
    },
    displayUpdatePriceSubmitButton() {
        return Template.instance().state.get('displayUpdatePriceSubmitButton');
    }
});
