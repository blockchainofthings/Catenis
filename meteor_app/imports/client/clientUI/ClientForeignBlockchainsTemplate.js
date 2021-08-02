/**
 * Created by claudio on 2021-07-22
 */

//console.log('[ClientForeignBlockchainsTemplate.js]: This code just ran.');

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
import './ClientForeignBlockchainsTemplate.html';

// Import dependent templates
import './ClientForeignBlockchainDetailsTemplate.js';

// Module variables


// Definition of module (private) functions
//


// Module code
//

Template.clientForeignBlockchains.onCreated(function () {
    // Subscribe to receive database docs/recs updates
    this.currClntForeignBlockchainsSubs = this.subscribe('currentClientForeignBlockchains');
});

Template.clientForeignBlockchains.onDestroyed(function () {
    if (this.currClntForeignBlockchainsSubs) {
        this.currClntForeignBlockchainsSubs.stop();
    }
});

Template.clientForeignBlockchains.helpers({
    foreignBlockchains() {
        return Catenis.db.collection.ClientForeignBlockchain.find();
    }
});
