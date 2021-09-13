/**
 * Created by Claudio on 2018-09-27.
 */

//console.log('[ClientHomeTemplate.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
//import config from 'config';
// Meteor packages
//import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';

// References code in other (Catenis) modules on the client
//import { Catenis } from '../ClientCatenis';

// Import template UI
import './ClientHomeTemplate.html';
import { Catenis } from '../ClientCatenis';
import { Meteor } from 'meteor/meteor';

// Import dependent templates


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

Template.clientHome.onCreated(function () {
    // Subscribe to receive database docs/recs updates
    this.currClntServiceAccountBalanceSubs = this.subscribe('currentClientServiceAccountBalance');
});

Template.clientHome.onDestroyed(function () {
    if (this.currClntServiceAccountBalanceSubs) {
        this.currClntServiceAccountBalanceSubs.stop();
    }
});

Template.clientHome.events({
    'click #btnDismissLowBalanceWarning'(event, template) {
        Meteor.call('currentClientDismissLowServAccBalanceUINotify', (error) => {
            if (error) {
                console.error('Error calling \'currentClientDismissLowServAccBalanceUINotify\' remote method:', error);
            }
        });
    }
});

Template.clientHome.helpers({
    balanceInfo() {
        return Catenis.db.collection.ServiceAccountBalance.findOne(1);
    }
});
