/**
 * Created by Claudio on 2017-05-15.
 */

//console.log('[SystemFundingTemplate.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
//import config from 'config';
// Meteor packages
import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';
import { ReactiveDict } from 'meteor/reactive-dict';

// References code in other (Catenis) modules on the client
import { Catenis } from '../ClientCatenis';

// Import template UI
import './SystemFundingTemplate.html';

// Import dependent templates
import './FundingAddressTemplate.js';

// Module code
//

Template.systemFunding.onCreated(function () {
    this.state = new ReactiveDict();

    this.state.set('fundAddress', undefined);

    // Subscribe to receive database docs/recs updates
    this.fundingBalanceSubs = this.subscribe('fundingBalance');
});

Template.systemFunding.onDestroyed(function () {
    if (this.fundingBalanceSubs) {
        this.fundingBalanceSubs.stop();
    }
});

Template.systemFunding.events({
    'click #btnFundSystem'(event, template) {
        Meteor.call('newSysFundingAddress', (error, addr) => {
            if (error) {
                console.log('Error calling \'newSysFundingAddress\' remote method: ' + error);
            }
            else {
                template.state.set('fundAddress', addr);
            }
        });
    },
    'hide.bs.modal #divFundSystem'(event, template) {
        // Modal panel about to close. Ask for confirmation
        return confirm('WARNING: if you proceed, you will NOT be able to continue monitoring the incoming bitcoins.\n\nPLEASE NOTE THAT THIS ACTION CANNOT BE UNDONE.');
    },
    'hidden.bs.modal #divFundSystem'(event, template) {
        // Modal panel has been closed. Clear funding address
        template.state.set('fundAddress', undefined);

        // Make sure that button used to activate modal panel is not selected
        $('#btnFundSystem').blur();
    }
});

Template.systemFunding.helpers({
    balanceInfo() {
        return Catenis.db.collection.FundingBalanceInfo.findOne(1);
    },
    fundAddress() {
        return Template.instance().state.get('fundAddress');
    },
    lowBalance(balanceInfo) {
        return balanceInfo && balanceInfo.currentBalance < balanceInfo.minimumBalance;
    }
});
