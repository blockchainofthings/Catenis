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


// Definition of module (private) functions
//


// Module code
//

Template.serviceAccount.onCreated(function () {
    this.state = new ReactiveDict();

    this.state.set('bcotPayAddress', undefined);

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
    'click #btnAddCredit'(events, template) {
        Meteor.call('newBcotPaymentAddress', template.data.client_id, (error, addr) => {
            if (error) {
                console.log('Error calling \'newBcotPaymentAddress\' remote method: ' + error.toString());
            }
            else {
                template.state.set('bcotPayAddress', addr);
            }
        });
    },
    'hide.bs.modal #divAddServiceCredit'(event, template) {
        // Modal panel about to close. Ask for confirmation
        return confirm('WARNING: if you proceed, you will NOT be able to continue monitoring the incoming BCOT tokens.\n\nPLEASE NOTE THAT THIS ACTION CANNOT BE UNDONE.');
    },
    'hidden.bs.modal #divAddServiceCredit'(event, template) {
        // Modal panel has been closed. Clear BCOT payment address
        template.state.set('bcotPayAddress', undefined);
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
    }
});
