/**
 * Created by Claudio on 2018-10-13.
 */

//console.log('[ClientPaidServicesTemplate.js]: This code just ran.');

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
import { ReactiveDict } from 'meteor/reactive-dict';

// References code in other (Catenis) modules on the client
import { Catenis } from '../ClientCatenis';
import { ClientUtil } from '../ClientUtil';

// Import template UI
import './ClientPaidServicesTemplate.html';

// Import dependent templates
import './ClientPaidServiceDetailsTemplate.js';


// Definition of module (private) functions
//


// Module code
//

Template.clientPaidServices.onCreated(function () {
    this.state = new ReactiveDict();

    this.footnotes = new Map();
    this.state.set('footnotesInitialized', false);

    // Subscribe to receive database docs/recs updates
    this.clntPaidServicesSubs = this.subscribe('clientPaidServices', () => {
        // Initialize footnotes
        Catenis.db.collection.PaidService.find({}).forEach(paidService => {
            if (paidService.variableCostApplyCondition) {
                this.footnotes.set(paidService._id, {
                    number: this.footnotes.size + 1,
                    description: `Amount added ${paidService.variableCostApplyCondition}.`
                });
            }
        });

        this.state.set('footnotesInitialized', true);
    });
});

Template.clientPaidServices.onDestroyed(function () {
    if (this.clntPaidServicesSubs) {
        this.clntPaidServicesSubs.stop();
    }
});

Template.clientPaidServices.events({
});

Template.clientPaidServices.helpers({
    paidServices() {
        return Catenis.db.collection.PaidService.find({});
    },
    footnotesInitialized() {
        return Template.instance().state.get('footnotesInitialized');
    },
    checkAddFootNote(paidService) {
        const footnote = Template.instance().footnotes.get(paidService._id);

        if (footnote) {
            return footnote.number;
        }

        return 0;
    },
    hasFootnotes() {
        return Template.instance().footnotes.size > 0;
    },
    footnotes() {
        return Array.from(Template.instance().footnotes.values());
    },
    formatServiceCredits(amount) {
        if (amount !== undefined) {
            return ClientUtil.formatCatenisServiceCredits(amount);
        }
    },
    logicalAnd(...ops) {
        if (ops.length > 0) {
            // Get rid of the last parameter (keyword arguments dictionary)
            ops.pop();

            return ops.every(v => !!v);
        }
        else {
            return false;
        }
    },
});
