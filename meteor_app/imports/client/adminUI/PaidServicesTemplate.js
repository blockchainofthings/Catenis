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
import { ReactiveDict } from 'meteor/reactive-dict';

// References code in other (Catenis) modules on the client
import { Catenis } from '../ClientCatenis';
import { ClientUtil } from '../ClientUtil';

// Import template UI
import './PaidServicesTemplate.html';

// Import dependent templates
import './PaidServiceDetailsTemplate.js';
import './PaidServicesHistoryTemplate.js';


// Definition of module (private) functions
//


// Module code
//

Template.paidServices.onCreated(function () {
    this.state = new ReactiveDict();

    this.footnotes = new Map();
    this.state.set('footnotesInitialized', false);

    // Subscribe to receive database docs/recs updates
    this.paidServicesSubs = this.subscribe('paidServices', () => {
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
