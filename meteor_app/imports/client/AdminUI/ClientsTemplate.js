/**
 * Created by Claudio on 2017-05-17.
 */

//console.log('[ClientsTemplate.js]: This code just ran.');

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
import { ClientShared } from '../../both/ClientShared';

// Import template UI
import './ClientsTemplate.html';

// Import dependent templates
import './ClientDetailsTemplate.js';


// Module code
//

Template.clients.onCreated(function () {
    // Subscribe to retrieve client docs/recs updates
    this.catenisClientsSubs = this.subscribe('catenisClients', Catenis.ctnHubNodeIndex);
});

Template.clients.onDestroyed(function () {
    if (this.catenisClientsSubs){
        this.catenisClientsSubs.stop();
    }
});

Template.clients.events({
});

Template.clients.helpers({
    clients: function () {
        return Catenis.db.collection.Client.find({}, {
            sort:{'props.name': 1}}).fetch();
    },
    statusColor(status) {
        let color;

        switch (status) {
            case ClientShared.status.active.name:
                color = 'green';
                break;

            case ClientShared.status.new.name:
                color = 'blue';
                break;
        }

        return color;
    }
});
