/**
 * Created by Claudio on 2018-12-11.
 */

//console.log('[BcotProductsTemplate.js]: This code just ran.');

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

// Import template UI
import './BcotProductsTemplate.html';

// Import dependent templates
import './BcotProductDetailsTemplate.js';


// Definition of module (private) functions
//

function validateCreateProductFormData(form, errMsgs) {
    const productInfo = {};
    let hasError = false;
    let focusSet = false;
    let value;

    value = form.amount.value ? form.amount.value.trim() : '';

    if (value.length === 0) {
        // Amount not supplied. Report error
        errMsgs.push('Please enter a credit amount');
        hasError = true;

        if (!focusSet) {
            form.amount.focus();
            focusSet = true;
        }
    }
    else {
        value = strToInteger(value);

        if (Number.isNaN(value)) {
            // Invalid integer value. Set error message
            errMsgs.push('Invalid amount: not a valid integer number');
            hasError = true;

            if (!focusSet) {
                form.amount.focus();
                focusSet = true;
            }
        }
        else if (value <= 0) {
            // Number value out of range. Set error message
            errMsgs.push('Invalid amount: value must be greater than zero');
            hasError = true;

            if (!focusSet) {
                form.amount.focus();
                focusSet = true;
            }
        }
        else {
            productInfo.amount = value;
        }
    }

    if (form.customSku.checked) {
        value = form.sku.value ? form.sku.value.trim() : '';

        if (value.length === 0) {
            // SKU not supplied. Report error
            errMsgs.push('Please enter a SKU');
            hasError = true;

            if (!focusSet) {
                form.sku.focus();
                focusSet = true;
            }
        }
    }

    return !hasError ? productInfo : undefined;
}

function strToInteger(str) {
    const bn = BigNumber(str);

    return bn.isInteger() ? bn.toNumber() : NaN;
}


// Module code
//

Template.bcotProducts.onCreated(function () {
    this.state = new ReactiveDict();

    this.state.set('createProductErrMsgs', []);
    this.state.set('errMsgs', []);
    this.state.set('infoMsg', undefined);
    this.state.set('infoMsgType', 'info');

    this.state.set('showInactiveProducts', this.data.showInactive);
    this.state.set('showSku', false);
    this.state.set('actionSuccessProduct', undefined);

    this.state.set('displayDoCreateProductButton', 'none');
    this.state.set('displayCreateProductConfirm', 'none');
    this.state.set('displayCreateProductSubmitButton', 'none');

    // Subscribe to receive database docs/recs updates
    this.bcotProductsSubs = this.subscribe('bcotProducts');
});

Template.bcotProducts.onDestroyed(function () {
    if (this.bcotProductsSubs) {
        this.bcotProductsSubs.stop();
    }
});

Template.bcotProducts.events({
    'click #lnkShowHideInactiveProducts'(event, template) {
        template.state.set('showInactiveProducts', !template.state.get('showInactiveProducts'));

        return false;
    },
    'click #btnCreateProduct'(event, template) {
        event.preventDefault();

        const form = $('#frmCreateProduct')[0];

        // Reset alert messages
        template.state.set('createProductErrMsgs', []);
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');

        // Do not show SKU field
        template.state.set('showSku', false);

        // Clear action success product row
        template.state.set('actionSuccessProduct', undefined);

        // Enable and reset form controls
        form.amount.disabled = false;
        form.customSku.disabled = false;
        form.sku.disabled = false;

        form.amount.value = '';
        form.customSku.checked = false;
        form.sku.value = '';

        // Show do action button
        template.state.set('displayDoCreateProductButton', 'inline');

        // Reset action confirmation
        $('#itxCreateProductConfirmation')[0].value = '';
        template.state.set('displayCreateProductConfirm', 'none');
        template.state.set('displayCreateProductSubmitButton', 'none');
    },
    'hidden.bs.modal #divCreateProduct'(events, template) {
        // Modal panel has been closed. Make sure that button used to
        //  activate modal panel is not selected
        $('#btnCreateProduct').blur();
    },
    'change #itxCreateProductConfirmation'(event, template) {
        if (event.target.value.trim().toLowerCase() === 'yes, i do confirm it') {
            // Show button to confirm action
            template.state.set('displayCreateProductSubmitButton', 'inline');
        }
    },
    'click #btnCancelCreateProductConfirm'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        // Reset action confirmation
        $('#itxCreateProductConfirmation')[0].value = '';
        template.state.set('displayCreateProductConfirm', 'none');
        template.state.set('displayCreateProductSubmitButton', 'none');

        // Enable form controls
        const form = $('#frmCreateProduct')[0];
        form.amount.disabled = false;
        form.customSku.disabled = false;
        form.sku.disabled = false;

        // Show do action button
        template.state.set('displayDoCreateProductButton', 'inline');
    },
    'change #cbxCustomSku'(events, template) {
        events.stopPropagation();

        if (events.target.checked) {
            // Show SKU field
            template.state.set('showSku', true);
        }
        else {
            // Hide SKU field
            template.state.set('showSku', false);
        }
    },
    'click #btnDismissInfo'(events, template) {
        // Clear info message
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');

        // Clear action success product row
        template.state.set('actionSuccessProduct', undefined);
    },
    'click #btnDismissError'(events, template) {
        // Clear error message
        template.state.set('errMsgs', []);
    },
    'click #btnDismissCreateProductError'(events, template) {
        // Clear error message
        template.state.set('createProductErrMsgs', []);
    },
    'click #btnDoCreateProduct'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        // Reset alert messages
        template.state.set('createProductErrMsgs', []);
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');

        const form = event.target.form;

        // Do validation of form controls here
        let errMsgs = [];
        let productInfo;

        if ((productInfo = validateCreateProductFormData(form, errMsgs))) {
            // Form OK. Save validated product data
            form.productInfo = productInfo;

            // Disable form controls
            form.amount.disabled = true;
            form.customSku.disabled = true;
            form.sku.disabled = true;

            // Hide do action button
            template.state.set('displayDoCreateProductButton', 'none');

            // Show action confirmation panel, and make sure that submit button is not shown
            template.state.set('displayCreateProductConfirm', 'block');
            template.state.set('displayCreateProductSubmitButton', 'none');
        }
        else {
            // Form data error
            template.state.set('createProductErrMsgs', errMsgs);
        }
    },
    'submit #frmCreateProduct'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        const form = event.target;

        // Reset alert messages
        template.state.set('createProductErrMsgs', []);
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');

        Meteor.call('createBcotProduct', form.productInfo, (error, bcotProduct_id) => {
            if (error) {
                template.state.set('createProductErrMsgs', [
                    error.toString()
                ]);
            }
            else {
                // New product successfully added
                template.state.set('actionSuccessProduct', bcotProduct_id);

                template.state.set('infoMsg', 'New Catenis Credit product successfully added');
                template.state.set('infoMsgType', 'success');

                // Close modal panel
                $('#divCreateProduct').modal('hide');
            }
        });
    }
});

Template.bcotProducts.helpers({
    products() {
        const template = Template.instance();

        const selector = {};

        if (!template.state.get('showInactiveProducts')) {
            selector.active = true;
        }

        return Catenis.db.collection.BcotProduct.find(selector, {
            fields: {
                sku: 1,
                amount: 1,
                active: 1
            },
            sort: {
                sku: 1
            }
        }).fetch();
    },
    formatWholeCoins(amount) {
        return ClientUtil.formatWholeCoins(amount);
    },
    statusColor(isActive) {
        return isActive ? 'green' : 'lightgray';
    },
    statusName(isActive) {
        return isActive ? 'active' : 'inactive';
    },
    showHideInactiveProductsAction() {
        return Template.instance().state.get('showInactiveProducts') ? 'Hide' : 'Show';
    },
    displaySku() {
        return Template.instance().state.get('showSku') ? 'block' : 'none';
    },
    hasCreateProductErrorMessage() {
        return Template.instance().state.get('createProductErrMsgs').length > 0;
    },
    createProductErrorMessage() {
        return Template.instance().state.get('createProductErrMsgs').reduce((compMsg, errMsg) => {
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
    actionSuccessProductRowClass(bcotProduct_id) {
        return bcotProduct_id === Template.instance().state.get('actionSuccessProduct') ? 'success' : '';
    },
    displayDoCreateProductButton() {
        return Template.instance().state.get('displayDoCreateProductButton');
    },
    displayCreateProductConfirm() {
        return Template.instance().state.get('displayCreateProductConfirm');
    },
    displayCreateProductSubmitButton() {
        return Template.instance().state.get('displayCreateProductSubmitButton');
    },
    returnQueryString() {
        if (Template.instance().state.get('showInactiveProducts')) {
            return '?' + querystring.stringify({
                retparams: querystring.stringify({
                    showinactive: 1
                })
            });
        }
    }
});
