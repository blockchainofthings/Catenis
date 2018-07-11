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


// Module code
//

Template.bcotPrice.onCreated(function () {
    this.state = new ReactiveDict();

    this.state.set('showUpdateForm', false);
    this.state.set('newPriceError', undefined);
    this.state.set('updateError', undefined);

    // Subscribe to receive BCOT token price updates
    this.bcotPriceSubs = this.subscribe('bcotPrice');
});

Template.bcotPrice.onDestroyed(function () {
    if (this.bcotPriceSubs) {
        this.bcotPriceSubs.stop();
    }
});

Template.bcotPrice.events({
    'click #lnkUpdatePrice'(event, template) {
        // Retrieve current BCOT token price...
        const bcotTokenPrice = Catenis.db.collection.BcotTokenPrice.findOne(1);
        const form = document.getElementById('frmUpdatePrice');

        // and use it to initialize input field value
        form.newPrice.value = formatCurrency(bcotTokenPrice.price);

        // Clear error messages
        template.state.set('newPriceError', undefined);
        template.state.set('updateError', undefined);

        // Disable save button and enable form
        enableSaveButton(null, true);
        enableForm();
        form.newPrice.focus();

        // Show form
        template.state.set('showUpdateForm', true);

        return false;
    },
    'submit #frmUpdatePrice'(event, template) {
        // Clear error messages
        template.state.set('newPriceError', undefined);
        template.state.set('updateError', undefined);

        const form = event.target;

        if (validateFormFields(form, template)) {
            // Disable form
            enableForm(form, true);

            Meteor.call('setBcotPrice', strToNumber(form.newPrice.value.trim()), (error) => {
                if (error) {
                    console.log('Error calling \'setBcotPrice\' remote method: ' + error);
                    template.state.set('updateError', error.stack);
                }
                else {
                    // Hide form
                    template.state.set('showUpdateForm', false);
                }
            });
        }

        return false;
    },
    'change #itxNewPrice'(event, template) {
        // Retrieve current BCOT token price...
        const bcotTokenPrice = Catenis.db.collection.BcotTokenPrice.findOne(1);

        if (numberToStr(bcotTokenPrice.price) === event.target.value) {
            // Form values have not changed. Disable save button
            enableSaveButton(null, true);
        }
        else {
            // Form values have changed. Enable save button
            enableSaveButton(null);
        }
    },
    'click #lnkCancelPriceUpdate'(event, template) {
        template.state.set('showUpdateForm', false);

        return false;
    }
});

Template.bcotPrice.helpers({
    bcotTokenPrice() {
        return Catenis.db.collection.BcotTokenPrice.findOne(1);
    },
    showUpdateForm() {
        return Template.instance().state.get('showUpdateForm');
    },
    formatCurrency(n) {
        return formatCurrency(n) ;
    },
    newPriceError() {
        return Template.instance().state.get('newPriceError');
    },
    updateError() {
        return Template.instance().state.get('updateError');
    }
});

function formatCurrency(n) {
    return new BigNumber(n).toFormat(2);
}

function numberToStr(val) {
    return val === undefined || val === null ? '' : val.toString();
}

function strToNumber(str) {
    return str.length > 0 ? parseFloat(str) : undefined;
}

function validateFormFields(form, template) {
    let fieldError = false;
    let fieldValue;

    if ((fieldValue = form.newPrice.value.trim()).length === 0) {
        // Empty field. Set error message
        template.state.set('newPriceError', 'Please enter a value');
        form.newPrice.focus();
        fieldError = true;
    }
    else {
        let numVal;

        if (Number.isNaN(numVal = parseFloat(fieldValue))) {
            // Invalid numeric value. Set error message
            template.state.set('newPriceError', 'Not a valid number');
            form.newPrice.focus();
            fieldError = true;
        }
        else if (numVal <= 0) {
            // Number value out of range. Set error message
            template.state.set('newPriceError', 'Value must be greater than zero');
            form.newPrice.focus();
            fieldError = true;
        }
    }

    return !fieldError;
}

function enableSaveButton(form, disable = false) {
    form = form || document.getElementById('frmUpdatePrice');

    form.saveButton.disabled = disable;
}

function enableForm(form, disable = false) {
    form = form || document.getElementById('frmUpdatePrice');

    form.newPrice.disabled = disable;
}
