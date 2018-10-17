/**
 * Created by claudio on 2018-10-11.
 */

//console.log('[ClientServiceAccountTemplate.js]: This code just ran.');

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
import './ClientServiceAccountTemplate.html';

// Import dependent templates
import './ClientBcotPaymentAddressTemplate.js';
import './ClientBillingReportTemplate.js';


// Definition of module (private) functions
//


// Module code
//

Template.clientServiceAccount.onCreated(function () {
    this.state = new ReactiveDict();

    this.state.set('errMsgs', []);

    this.state.set('bcotPayAddress', undefined);

    // Subscribe to receive database docs/recs updates
    this.currClntServiceAccountBalanceSubs = this.subscribe('currentClientServiceAccountBalance');
});

Template.clientServiceAccount.onDestroyed(function () {
    if (this.currClntServiceAccountBalanceSubs) {
        this.currClntServiceAccountBalanceSubs.stop();
    }
});

Template.clientServiceAccount.events({
    'click #btnDismissError'(events, template) {
        // Clear error message
        template.state.set('errMsgs', []);
    },
    'click #btnAddCredit'(events, template) {
        // Reset alert messages
        template.state.set('errMsgs', []);

        Meteor.call('newCurrentClientBcotPaymentAddress', (error, addr) => {
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
        // Modal panel about to close.
        //  Ask for confirmation only if no error has happened
        return template.state.get('errMsgs').length > 0 || confirm('WARNING: if you proceed, you will NOT be able to continue monitoring the incoming BCOT tokens.\n\nPLEASE NOTE THAT THIS ACTION CANNOT BE UNDONE.');
    },
    'hidden.bs.modal #divAddServiceCredit'(event, template) {
        // Modal panel has been closed. Clear BCOT payment address
        template.state.set('bcotPayAddress', undefined);

        // Make sure that button used to activate modal panel is not selected
        $('#btnAddCredit').blur();
    }
});

Template.clientServiceAccount.helpers({
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
    }
});
