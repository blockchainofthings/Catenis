/**
 * Created by claudio on 17/05/17.
 */

//console.log('[ClientsTemplate.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//  NOTE: the reference of these modules are done sing 'require()' instead of 'import' to
//      to avoid annoying WebStorm warning message: 'default export is not defined in
//      imported module'
const util = require('util');
// Third-party node modules
//import config from 'config';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules on the client
import { Catenis } from '../ClientCatenis';

// Import template UI
import './ClientsTemplate.html';

// Import dependent templates
import './ClientDetailsTemplate.js';


// Module code
//

Template.clients.onCreated(function () {
    // Subscribe to receive fund balance updates
    this.catenisClientsSubs = this.subscribe('catenisClients', Catenis.ctnHubNodeIndex);
});

Template.clients.onDestroyed(function () {
    if (this.catenisClientsSubs) {
        this.catenisClientsSubs.stop();
    }
});

Template.clients.events({
});

Template.clients.helpers({
    listClients: function () {
        return Catenis.db.collection.Client.find({}).fetch();
    },
    isClientActive: function (client) {
        return client.status === 'active';
    }
});
