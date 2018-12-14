/**
 * Created by Claudio on 2018-12-13.
 */

//console.log('[BcotSaleStockTemplate.js]: This code just ran.');

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
import './BcotSaleStockTemplate.html';

// Import dependent templates
import './BcotSaleStockAddressTemplate.js';


// Module code
//

Template.bcotSaleStock.onCreated(function () {
    this.state = new ReactiveDict();

    this.state.set('bcotSaleStockAddress', undefined);

    // Subscribe to receive database docs/recs updates
    this.bcotSaleStockBalanceSubs = this.subscribe('bcotSaleStockBalance');
});

Template.bcotSaleStock.onDestroyed(function () {
    if (this.bcotSaleStockBalanceSubs) {
        this.bcotSaleStockBalanceSubs.stop();
    }
});

Template.bcotSaleStock.events({
    'click #btnReplenishStock'(event, template) {
        Meteor.call('getBcotSaleStockAddress', (error, addr) => {
            if (error) {
                console.log('Error calling \'getBcotSaleStockAddress\' remote method: ' + error);
            }
            else {
                template.state.set('bcotSaleStockAddress', addr);
            }
        });
    },
    'hide.bs.modal #divReplenishStock'(event, template) {
        // Modal panel about to close. Ask for confirmation
        return confirm('WARNING: if you proceed, you will STOP monitoring the incoming of BCOT tokens.');
    },
    'hidden.bs.modal #divReplenishStock'(event, template) {
        // Modal panel has been closed. Clear funding address
        template.state.set('bcotSaleStockAddress', undefined);

        // Make sure that button used to activate modal panel is not selected
        $('#btnReplenishStock').blur();
    }
});

Template.bcotSaleStock.helpers({
    balanceInfo() {
        return Catenis.db.collection.BcotSaleStockInfo.findOne(1);
    },
    saleStockAddress() {
        return Template.instance().state.get('bcotSaleStockAddress');
    },
    lowBalance(balanceInfo) {
        return balanceInfo && balanceInfo.currentBalance < balanceInfo.minimumBalance;
    }
});
