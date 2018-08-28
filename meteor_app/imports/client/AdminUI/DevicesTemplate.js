/**
 * Created by Claudio on 2017-05-26.
 */

//console.log('[DevicesTemplate.js]: This code just ran.');

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

// Import template UI
import './DevicesTemplate.html';

// Import dependent templates


// Module code
//

Template.devices.onCreated(function () {
    // Subscribe to receive device updates
    this.clientDevicesSubs = this.subscribe('clientDevices', this.data.user_id);
});

Template.devices.onDestroyed(function () {
    if (this.clientDevicesSubs) {
        this.clientDevicesSubs.stop();
    }
});

Template.devices.events({
});

Template.devices.helpers({
    listDevices: function () {
        return Catenis.db.collection.Device.find({}, {sort:{'index.deviceIndex': 1}}).fetch();
    },
    isDeviceActive: function (device) {
        return device.status === 'active';
    },
    // docClientId: function () {
    //     return Template.instance().data.client_id;
    // },
    docUserId: function(){
        return Template.instance().data.user_id;
    }
});
