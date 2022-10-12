/**
 * Created by Claudio on 2018-12-12.
 */

//console.log('[BcotSaleAllocationsTemplate.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import querystring from "querystring";
// Third-party node modules
import BigNumber from 'bignumber.js';
import moment from 'moment';
// Meteor packages
import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';
import { ReactiveDict } from 'meteor/reactive-dict';

// References code in other (Catenis) modules on the client
import { Catenis } from '../ClientCatenis';
import { BcotSaleAllocationShared } from '../../both/BcotSaleAllocationShared';

// Import template UI
import './BcotSaleAllocationsTemplate.html';

// Import dependent templates
import './BcotSaleAllocationDetailsTemplate.js';

// Module variables
const defaultProductRows = [1, 2, 3, 4, 5];
const confirmPhrase = 'yes, i do confirm it';


// Definition of module (private) functions
//

function validateCreateAllocationFormData(form, errMsgs) {
    const productsToAllocate = {};
    let hasError = false;
    let focusSet = false;
    let value;

    form.fields.product.forEach((productField, idx) => {
        if (productField.value !== '') {
            const sku = productField.value;
            const quantityField = form.fields.quantity[idx];
            value = quantityField.value ? quantityField.value.trim() : '';

            if (value.length === 0) {
                // Quantity not supplied. Report error
                errMsgs.push('Please enter a quantity');
                hasError = true;

                if (!focusSet) {
                    quantityField.focus();
                    focusSet = true;
                }
            }
            else {
                value = strToInteger(value);

                if (Number.isNaN(value)) {
                    // Invalid integer value. Set error message
                    errMsgs.push('Invalid quantity: not a valid integer number');
                    hasError = true;

                    if (!focusSet) {
                        quantityField.focus();
                        focusSet = true;
                    }
                }
                else if (value <= 0) {
                    // Number value out of range. Set error message
                    errMsgs.push('Invalid quantity: value must be greater than zero');
                    hasError = true;

                    if (!focusSet) {
                        quantityField.focus();
                        focusSet = true;
                    }
                }
                else {
                    if (sku in productsToAllocate) {
                        productsToAllocate[sku] += value;
                    }
                    else {
                        productsToAllocate[sku] = value;
                    }
                }
            }
        }
    });

    if (!hasError && Object.keys(productsToAllocate).length === 0) {
        if (Template.instance().state.get('currentView') === 'register') {
            // No product entered
            errMsgs.push('Please enter information for at least one product');
            hasError = true;

            if (!focusSet) {
                form.fields.product[0].focus();
            }
        }
        else {
            // No quantity entered
            errMsgs.push('Please enter a quantity');
            hasError = true;

            if (!focusSet) {
                form.fields.quantity[0].focus();
            }
        }
    }

    return !hasError ? productsToAllocate : undefined;
}

function strToInteger(str) {
    const bn = BigNumber(str);

    return bn.isInteger() ? bn.toNumber() : NaN;
}


// Module code
//

Template.bcotSaleAllocations.onCreated(function () {
    this.state = new ReactiveDict();

    this.state.set('createAllocationErrMsgs', []);
    this.state.set('errMsgs', []);
    this.state.set('infoMsg', undefined);
    this.state.set('infoMsgType', 'info');

    this.state.set('showAllocationsInUse', this.data.showInUse);
    this.state.set('actionSuccessAllocation', undefined);
    this.state.set('productRows', defaultProductRows);

    this.state.set('displayDoCreateAllocationButton', 'none');
    this.state.set('displayCreateAllocationConfirm', 'none');
    this.state.set('displayCreateAllocationSubmitButton', 'none');

    this.state.set('currentView', 'regular');

    this.state.set('selfRegistrationEnabled', undefined);
    this.state.set('selfRegBcotSaleSku', undefined);
    this.state.set('initFinalized', false);

    Meteor.call('getSelfRegistrationSettings', (err, selfRegistration) => {
        if (err) {
            console.log('Error calling \'getSelfRegistrationSettings\' remote procedure: ' + err);
        }
        else {
            this.state.set('selfRegistrationEnabled', selfRegistration.enabled);

            if (selfRegistration.enabled) {
                this.availableSelfRegBcotSaleSubs = this.subscribe('availableSelfRegBcotSale');

                Meteor.call('getSelfRegistrationBcotSaleProduct', (err, sku) => {
                    if (err) {
                        console.log('Error calling \'getSelfRegistrationBcotSaleProduct\' remote procedure: ' + err);
                    }
                    else {
                        this.state.set('selfRegBcotSaleSku', sku);
                        this.state.set('initFinalized', true);
                    }
                });
            }
            else {
                this.state.set('initFinalized', true);
            }
        }
    });

    // Subscribe to receive database docs/recs updates
    this.bcotSaleAllocatioinsSubs = this.subscribe('bcotSaleAllocations');
    this.activeBcotProductsSubs = this.subscribe('activeBcotProducts');
});

Template.bcotSaleAllocations.onDestroyed(function () {
    if (this.bcotSaleAllocatioinsSubs) {
        this.bcotSaleAllocatioinsSubs.stop();
    }

    if (this.activeBcotProductsSubs) {
        this.activeBcotProductsSubs.stop();
    }

    if (this.availableSelfRegBcotSaleSubs) {
        this.availableSelfRegBcotSaleSubs.stop();
    }
});

Template.bcotSaleAllocations.events({
    'change #selView'(event, template) {
        // Update current view
        template.state.set('currentView', event.target.value);
    },
    'click #lnkAddProductRow'(event, template) {
        // Add one more row of product to allocate
        const productRows = template.state.get('productRows');
        productRows.push(productRows.length + 1);
        template.state.set('productRows', productRows);
    },
    'click #lnkShowHideAllocationsInUse'(event, template) {
        template.state.set('showAllocationsInUse', !template.state.get('showAllocationsInUse'));

        return false;
    },
    'click #btnCreateAllocation'(event, template) {
        event.preventDefault();

        const form = $('#frmCreateAllocation')[0];

        // Reset alert messages
        template.state.set('createAllocationErrMsgs', []);
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');

        // Clear action success allocation row
        template.state.set('actionSuccessAllocation', undefined);

        // Reset number of product rows
        template.state.set('productRows', defaultProductRows);

        // Fix form fields (since in case of self-registration, product and quantity are single fields)
        if (!form.fields) {
            form.fields = {};

            form.fields.product = form.product.length ? form.product : [form.product];
            form.fields.quantity = form.quantity.length ? form.quantity : [form.quantity];
        }

        // Enable and reset form controls
        if (template.state.get('currentView') === 'register') {
            form.fields.product.forEach((field) => {
                field.disabled = false;
                field.value = '';
            });
        }

        form.fields.quantity.forEach((field) => {
            field.disabled = false;
            field.value = '';
        });

        // Show do action button
        template.state.set('displayDoCreateAllocationButton', 'inline');

        // Reset action confirmation
        $('#itxCreateAllocationConfirmation')[0].value = '';
        template.state.set('displayCreateAllocationConfirm', 'none');
        template.state.set('displayCreateAllocationSubmitButton', 'none');
    },
    'hidden.bs.modal #divCreateAllocation'(event, template) {
        // Modal panel has been closed. Make sure that button used to
        //  activate modal panel is not selected
        $('#btnCreateAllocation').blur();
    },
    'input #itxCreateAllocationConfirmation'(event, template) {
        // Suppress spaces from beginning of input
        let inputValue = event.target.value = event.target.value.replace(/^\s+/, '');

        if (inputValue.length > confirmPhrase.length) {
            // Limit length of input
            inputValue = event.target.value = inputValue.substring(0, confirmPhrase.length);
        }

        // Check if input matches confirmation phrase
        if (inputValue.toLowerCase() === confirmPhrase) {
            // Show button to confirm action
            template.state.set('displayCreateAllocationSubmitButton', 'inline');
        }
        else {
            // Hide button to confirm action
            template.state.set('displayCreateAllocationSubmitButton', 'none');
        }
    },
    'click #btnCancelCreateAllocationConfirm'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        // Reset action confirmation
        $('#itxCreateAllocationConfirmation')[0].value = '';
        template.state.set('displayCreateAllocationConfirm', 'none');
        template.state.set('displayCreateAllocationSubmitButton', 'none');

        // Enable form controls
        const form = $('#frmCreateAllocation')[0];

        if (template.state.get('currentView') === 'register') {
            form.fields.product.forEach((field) => {
                field.disabled = false;
            });
        }

        form.fields.quantity.forEach((field) => {
            field.disabled = false;
        });

        // Show do action button
        template.state.set('displayDoCreateAllocationButton', 'inline');
    },
    'click #btnDismissInfo'(event, template) {
        // Clear info message
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');

        // Clear action success allocation row
        template.state.set('actionSuccessAllocation', undefined);
    },
    'click #btnDismissError'(event, template) {
        // Clear error message
        template.state.set('errMsgs', []);
    },
    'click #btnDismissCreateAllocationError'(event, template) {
        // Clear error message
        template.state.set('createAllocationErrMsgs', []);
    },
    'click #btnDoCreateAllocation'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        // Reset alert messages
        template.state.set('createAllocationErrMsgs', []);
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');

        const form = event.target.form;

        // Do validation of form controls here
        let errMsgs = [];
        let productsToAllocate;

        if ((productsToAllocate = validateCreateAllocationFormData(form, errMsgs))) {
            // Form OK. Save validated allocation data
            form.productsToAllocate = productsToAllocate;

            // Disable form controls
            if (template.state.get('currentView') === 'register') {
                form.fields.product.forEach((field) => {
                    field.disabled = true;
                });
            }

            form.fields.quantity.forEach((field) => {
                field.disabled = true;
            });

            // Hide do action button
            template.state.set('displayDoCreateAllocationButton', 'none');

            // Show action confirmation panel, and make sure that submit button is not shown
            template.state.set('displayCreateAllocationConfirm', 'block');
            template.state.set('displayCreateAllocationSubmitButton', 'none');
        }
        else {
            // Form data error
            template.state.set('createAllocationErrMsgs', errMsgs);
        }
    },
    'submit #frmCreateAllocation'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        const form = event.target;

        // Reset alert messages
        template.state.set('createAllocationErrMsgs', []);
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');

        const forSelfRegistration = template.state.get('currentView') === 'self-registration';

        Meteor.call('createBcotSaleAllocation', form.productsToAllocate, forSelfRegistration, (error, bcotSaleAllocation_id) => {
            if (error) {
                template.state.set('createAllocationErrMsgs', [
                    error.toString()
                ]);
            }
            else {
                // New sale allocation successfully added
                if (!forSelfRegistration) {
                    template.state.set('actionSuccessAllocation', bcotSaleAllocation_id);
                }

                template.state.set('infoMsg', 'New Catenis credit product allocation successfully added');
                template.state.set('infoMsgType', 'success');

                // Close modal panel
                $('#divCreateAllocation').modal('hide');
            }
        });
    }
});

Template.bcotSaleAllocations.helpers({
    allocations() {
        const template = Template.instance();

        const selector = {};

        if (!template.state.get('showAllocationsInUse')) {
            selector.status = {
                $ne: BcotSaleAllocationShared.status.in_use.name
            };
        }

        return Catenis.db.collection.BcotSaleAllocation.find(selector, {
            fields: {
                summary: 1,
                status: 1,
                allocationDate: 1
            },
            sort: {
                allocationDate: -1
            }
        }).fetch();
    },
    products() {
        return Catenis.db.collection.BcotProduct.find({}, {
            fields: {
                sku: 1
            },
            sort: {
                amount: 1
            }
        });
    },
    totalizeProducts(summary) {
        return summary.reduce((sum, prodInfo) => {
            return sum + prodInfo.quantity;
        }, 0);
    },
    statusColor(status) {
        let color;

        switch (status) {
            case BcotSaleAllocationShared.status.new.name:
                color = 'blue';
                break;

            case BcotSaleAllocationShared.status.in_use.name:
                color = 'green';
                break;
        }

        return color;
    },
    statusName(status) {
        return status.replace(/_+/g, ' ').trim();
    },
    formatDateTime(date) {
        return moment(date).format('LLL');
    },
    productRows() {
        return Template.instance().state.get('productRows');
    },
    showHideAllocationsInUseAction() {
        return Template.instance().state.get('showAllocationsInUse') ? 'Hide' : 'Show';
    },
    hasCreateAllocationErrorMessage() {
        return Template.instance().state.get('createAllocationErrMsgs').length > 0;
    },
    createAllocationErrorMessage() {
        return Template.instance().state.get('createAllocationErrMsgs').reduce((compMsg, errMsg) => {
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
    actionSuccessAllocationRowClass(bcotSaleAllocation_id) {
        return bcotSaleAllocation_id === Template.instance().state.get('actionSuccessAllocation') ? 'success' : '';
    },
    displayDoCreateAllocationButton() {
        return Template.instance().state.get('displayDoCreateAllocationButton');
    },
    displayCreateAllocationConfirm() {
        return Template.instance().state.get('displayCreateAllocationConfirm');
    },
    displayCreateAllocationSubmitButton() {
        return Template.instance().state.get('displayCreateAllocationSubmitButton');
    },
    returnQueryString() {
        if (Template.instance().state.get('showAllocationsInUse')) {
            return '?' + querystring.stringify({
                retparams: querystring.stringify({
                    showinuse: 1
                })
            });
        }
    },
    availableSelfRegBcotSale() {
        return Catenis.db.collection.AvailableSelfRegBcotSale.findOne({});
    },
    isLowQuantity(docAvailableSelfRegBcotSale) {
        return docAvailableSelfRegBcotSale.currentQuantity < docAvailableSelfRegBcotSale.minimumQuantity;
    },
    logicalAnd(v1, v2) {
        return v1 && v2;
    },
    initFinalized() {
        return Template.instance().state.get('initFinalized');
    },
    selfRegistrationEnabled() {
        return Template.instance().state.get('selfRegistrationEnabled');
    },
    isRegularView() {
        return Template.instance().state.get('currentView') === 'regular';
    },
    selfRegBcotSaleSku() {
        return Template.instance().state.get('selfRegBcotSaleSku');
    }
});
