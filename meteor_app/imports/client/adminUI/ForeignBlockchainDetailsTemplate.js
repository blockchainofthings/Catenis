/**
 * Created by claudio on 2021-07-19
 */

//console.log('[ForeignBlockchainDetailsTemplate.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//
// Third-party node modules
//
// Meteor packages
//import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';

// References code in other (Catenis) modules on the client
import { Catenis } from '../ClientCatenis';

// Import template UI
import './ForeignBlockchainDetailsTemplate.html';
import { ReactiveDict } from 'meteor/reactive-dict';

// Import dependent templates
import './AddressQRCodeTemplate.js';

// Module variables


// Definition of module (private) functions
//


// Module code
//

Template.foreignBlockchainDetails.onCreated(function () {
    this.state = new ReactiveDict();

    this.state.set('errMsg', undefined);
    this.state.set('updatingConsumptionProfile', false);

    // Subscribe to receive database docs/recs updates
    this.foreignBlockchainRecordSubs = this.subscribe('foreignBlockchainRecord', this.data.client_id, this.data.blockchainKey);
    this.foreignBcConsumptionProfilesSubs = this.subscribe('foreignBcConsumptionProfiles', this.data.client_id)
});

Template.foreignBlockchainDetails.onDestroyed(function () {
    if (this.foreignBlockchainRecordSubs) {
        this.foreignBlockchainRecordSubs.stop();
    }

    if (this.foreignBcConsumptionProfilesSubs) {
        this.foreignBcConsumptionProfilesSubs.stop();
    }
});

Template.foreignBlockchainDetails.events({
    'click #btnDismissError'(event, template) {
        // Clear error message
        template.state.set('errMsg', undefined);
    },
    'click #lnkUpdateConsumptionProfile'(event, template) {
        template.state.set('updatingConsumptionProfile', true);
        // Clear error message
        template.state.set('errMsg', undefined);
    },
    'click #lnkCancelUpdateConsumptionProfile'(event, template) {
        template.state.set('updatingConsumptionProfile', false);
    },
    'change #selConsumptionProfile'(event, template) {
        // Call remote method to update client's foreign blockchain consumption profile
        Meteor.call(
            'updateForeignBcConsumptionProfile',
            template.data.client_id,
            template.data.blockchainKey,
            event.target.value,
            (error) => {
                if (error) {
                    // Show error message
                    template.state.set('errMsg', error.toString());
                }

                template.state.set('updatingConsumptionProfile', false);
            }
        );
    },
    'hidden.bs.modal #divAddressQRCode'(event, template) {
        // Modal panel has been closed. Make sure that button used
        //  to activate modal panel is not selected
        $('#lnkShowQRCode').blur();
    }
});

Template.foreignBlockchainDetails.helpers({
    blockchain() {
        return Catenis.db.collection.ClientForeignBlockchain.findOne({_id: Template.instance().data.blockchainKey});
    },
    consumptionProfiles(currentProfileName) {
        return Catenis.db.collection.ForeignBcConsumptionProfile
            .find()
            .map(doc => ({
                key: doc._id,
                name: doc.name,
                selected: doc.name === currentProfileName ? 'selected' : ''
            }));
    },
    hasErrorMessage() {
        return !!Template.instance().state.get('errMsg');
    },
    errorMessage() {
        return Template.instance().state.get('errMsg');
    },
    updatingConsumptionProfile() {
        return Template.instance().state.get('updatingConsumptionProfile');
    }
});
