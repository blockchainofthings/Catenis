/**
 * Created by claudio on 2021-07-17
 */

//console.log('[ForeignBlockchainsTemplate.js]: This code just ran.');

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
import './ForeignBlockchainsTemplate.html';

// Import dependent templates
import './ForeignBlockchainDetailsTemplate.js';

// Module variables


// Definition of module (private) functions
//


// Module code
//

Template.foreignBlockchains.onCreated(function () {
    // Subscribe to receive database docs/recs updates
    this.clientRecordSubs = this.subscribe('clientRecord', this.data.client_id);
    this.foreignBlockchainsSubs = this.subscribe('foreignBlockchains', this.data.client_id);
});

Template.foreignBlockchains.onDestroyed(function () {
    if (this.clientRecordSubs) {
        this.clientRecordSubs.stop();
    }

    if (this.foreignBlockchainsSubs) {
        this.foreignBlockchainsSubs.stop();
    }
});

Template.foreignBlockchains.helpers({
    client() {
        return Catenis.db.collection.Client.findOne({_id: Template.instance().data.client_id});
    },
    clientTitle(client) {
        return client.props.name || client.clientId;
    },
    foreignBlockchains() {
        return Catenis.db.collection.ClientForeignBlockchain.find();
    }
});
