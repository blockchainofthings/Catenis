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
import { DeviceShared } from '../../both/DeviceShared';

// Import dependent templates
import './NewDeviceTemplate.js';
import './DeviceDetailsTemplate.js';


// Module code
//

Template.devices.onCreated(function () {
    // Subscribe to receive database docs/recs updates
    this.clientRecordSubs = this.subscribe('clientRecord', this.data.client_id);
    this.clientDevicesSubs = this.subscribe('clientDevices', this.data.client_id);
    this.clientDevicesInfoSubs = this.subscribe('clientDevicesInfo', this.data.client_id);
});

Template.devices.onDestroyed(function () {
    if (this.clientRecordSubs) {
        this.clientRecordSubs.stop();
    }

    if (this.clientDevicesSubs) {
        this.clientDevicesSubs.stop();
    }

    if (this.clientDevicesInfoSubs) {
        this.clientDevicesInfoSubs.stop();
    }
});

Template.devices.events({
});

Template.devices.helpers({
    client() {
        return Catenis.db.collection.Client.findOne({_id: Template.instance().data.client_id});
    },
    clientTitle(client) {
        return client.props.name || client.clientId;
    },
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
