/**
 * Created by claudio on 15/05/17.
 */

//console.log('[SystemFundingTemplate.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//  NOTE: the reference of these modules are done sing 'require()' instead of 'import' to
//      to avoid annoying WebStorm warning message: 'default export is not defined in
//      imported module'
//const util = require('util');
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

    // Subscribe to receive fund balance updates
    this.fundingBalanceSubs = this.subscribe('fundingBalance');
});

Template.systemFunding.onDestroyed(function () {
    if (this.fundingBalanceSubs) {
        this.fundingBalanceSubs.stop();
    }
});

Template.systemFunding.events({
    'click #lnkNewAddressToFund'(event, template) {
        Meteor.call('newSysFundingAddress', (error, addr) => {
            if (error) {
                console.log('Error calling \'newSysFundingAddress\' remote method: ' + error);
            }
            else {
                template.state.set('fundAddress', addr);
            }
        });

        return false;
    },
    'click #lnkDiscardAddr'(event, template) {
        if (confirm('Are you sure you want to discard this address?')) {
            template.state.set('fundAddress', undefined);
        }

        return false;
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
