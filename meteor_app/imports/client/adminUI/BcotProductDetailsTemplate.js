/**
 * Created by Claudio on 2018-12-11.
 */

//console.log('[BcotProductDetailsTemplate.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
//import config from 'config'
// Meteor packages
import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';
import { ReactiveDict } from 'meteor/reactive-dict';

// References code in other (Catenis) modules on the client
import { Catenis } from '../ClientCatenis';
import { ClientUtil } from '../ClientUtil';

// Import template UI
import './BcotProductDetailsTemplate.html';

// Import dependent templates

// Module variables
const confirmPhrase = 'yes, i do confirm it';


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

Template.bcotProductDetails.onCreated(function () {
    this.state = new ReactiveDict();

    this.state.set('errMsgs', []);
    this.state.set('infoMsg', undefined);
    this.state.set('infoMsgType', 'info');

    this.state.set('displayDeactivateProductSubmitButton', 'none');

    // Subscribe to receive database docs/recs updates
    this.bcotProductSubs = this.subscribe('bcotProductRecord', this.data.bcotProduct_id);
});

Template.bcotProductDetails.onDestroyed(function () {
    if (this.bcotProductSubs) {
        this.bcotProductSubs.stop();
    }
});

Template.bcotProductDetails.events({
    'click #btnDismissInfo'(events, template) {
        // Clear info message
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');
    },
    'click #btnDismissError'(events, template) {
        // Clear error message
        template.state.set('errMsgs', []);
    },
    'click #btnDeactivateProduct'(events, template) {
        event.preventDefault();

        // Reset alert messages
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');

        // Reset action confirmation
        $('#itxDeactivateProductConfirmation')[0].value = '';
        template.state.set('displayDeactivateProductSubmitButton', 'none');
    },
    'hidden.bs.modal #divDeactivateProduct'(events, template) {
        // Modal panel has been closed. Make sure that button used to
        //  activate modal panel is not selected
        $('#btnDeactivateProduct').blur();
    },
    'input #itxDeactivateProductConfirmation'(event, template) {
        // Suppress spaces from beginning of input
        let inputValue = event.target.value = event.target.value.replace(/^\s+/, '');

        if (inputValue.length > confirmPhrase.length) {
            // Limit length of input
            inputValue = event.target.value = inputValue.substring(0, confirmPhrase.length);
        }

        // Check if input matches confirmation phrase
        if (inputValue.toLowerCase() === confirmPhrase) {
            // Show button to confirm action
            template.state.set('displayDeactivateProductSubmitButton', 'inline');
        }
        else {
            // Hide button to confirm action
            template.state.set('displayDeactivateProductSubmitButton', 'none');
        }
    },
    'submit #frmDeactivateProduct'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        const confirmMsg = 'LAST CHANCE!\n\nIf you proceed, the BCOT product will be DEACTIVATED.\n\nPLEASE NOTE THAT THIS ACTION CANNOT BE UNDONE.';

        if (confirm(confirmMsg)) {
            // Close modal panel
            $('#divDeactivateProduct').modal('hide');

            // Reset alert messages
            template.state.set('errMsgs', []);
            template.state.set('infoMsg', undefined);
            template.state.set('infoMsgType', 'info');

            Meteor.call('deactivateBcotProduct', template.data.bcotProduct_id, (error) => {
                if (error) {
                    const errMsgs = template.state.get('errMsgs');
                    errMsgs.push('Error deactivating BCOT product: ' + error.toString());
                    template.state.set('errMsgs', errMsgs);
                }
                else {
                    template.state.set('infoMsg', 'BCOT product successfully deactivated');
                    template.state.set('infoMsgType', 'success');
                }
            });
        }
        else {
            // Close modal panel
            $('#divDeactivateProduct').modal('hide');
        }
    }
});

Template.bcotProductDetails.helpers({
    backQueryString() {
        const retParams = Template.instance().data.retParams;

        return retParams ? '?' + retParams : undefined;
    },
    product() {
        return Catenis.db.collection.BcotProduct.findOne({_id: Template.instance().data.bcotProduct_id});
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
    canDeactivateProduct(product) {
        return product.active;
    },
    displayDeactivateProductSubmitButton() {
        return Template.instance().state.get('displayDeactivateProductSubmitButton');
    }
});
