/**
 * Created by Claudio on 2018-10-10.
 */

//console.log('[ClientDevicesTemplate.js]: This code just ran.');

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
import { DeviceShared } from '../../both/DeviceShared';

// Import template UI
import './ClientDevicesTemplate.html';
import { Catenis } from '../ClientCatenis';

// Import dependent templates
import './ClientNewDeviceTemplate.js';
import './ClientDeviceDetailsTemplate.js';


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

Template.clientDevices.onCreated(function () {
    // Subscribe to receive database docs/recs updates
    this.currClntDevicesSubs = this.subscribe('currentClientDevices');
    this.currClntDevicesInfoSubs = this.subscribe('currentClientDevicesInfo');
});

Template.clientDevices.onDestroyed(function () {
    if (this.currClntDevicesSubs) {
        this.currClntDevicesSubs.stop();
    }

    if (this.currClntDevicesInfoSubs) {
        this.currClntDevicesInfoSubs.stop();
    }
});

Template.clientDevices.events({
});

Template.clientDevices.helpers({
    devices: function () {
        return Catenis.db.collection.Device.find({}, {sort:{'props.name': 1}}).fetch();
    },
    clientDevicesInfo() {
        return Catenis.db.collection.ClientDevicesInfo.findOne(1);
    },
    maximumDevicesReached(clientDevicesInfo) {
        return clientDevicesInfo.maxAllowedDevices <= clientDevicesInfo.numDevicesInUse;
    },
    statusColor(status) {
        let color;

        switch (status) {
            case DeviceShared.status.new.name:
                color = 'blue';
                break;

            case DeviceShared.status.pending.name:
                color = 'gold';
                break;

            case DeviceShared.status.active.name:
                color = 'green';
                break;

            case DeviceShared.status.inactive.name:
                color = 'lightgray';
                break;
        }

        return color;
    }
});
