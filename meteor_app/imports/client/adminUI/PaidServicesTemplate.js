/**
 * Created by Claudio on 2018-10-13.
 */

//console.log('[PaidServicesTemplate.js]: This code just ran.');

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
import { Catenis } from '../ClientCatenis';
import { ClientUtil } from '../ClientUtil';

// Import template UI
import './PaidServicesTemplate.html';

// Import dependent templates
import './PaidServiceDetailsTemplate.js';


// Definition of module (private) functions
//


// Module code
//

Template.paidServices.onCreated(function () {
    // Subscribe to receive database docs/recs updates
    this.paidServicesSubs = this.subscribe('paidServices');
});

Template.paidServices.onDestroyed(function () {
    if (this.paidServicesSubs) {
        this.paidServicesSubs.stop();
    }
});

Template.paidServices.events({
});

Template.paidServices.helpers({
    paidServices() {
        return Catenis.db.collection.PaidService.find({});
    },
    formatServiceCredits(amount) {
        return ClientUtil.formatCatenisServiceCredits(amount);
    }
});
