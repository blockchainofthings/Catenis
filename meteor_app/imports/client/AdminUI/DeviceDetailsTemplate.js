/**
 * Created by claudio on 26/05/17.
 */

//console.log('[DeviceDetailsTemplate.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//  NOTE: the reference of these modules are done sing 'require()' instead of 'import' to
//      to avoid annoying WebStorm warning message: 'default export is not defined in
//      imported module'
//const util = require('util');
// Third-party node modules
//import config from 'config';
// Meteor packages
import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';

// References code in other (Catenis) modules on the client
import { Catenis } from '../ClientCatenis';

// Import template UI
import './DeviceDetailsTemplate.html';


// Module code
//

Template.deviceDetails.onCreated(function () {
    // Subscribe to receive client and device updates
    this.clientRecordSubs = this.subscribe('clientRecord', this.data.user_id);
    this.deviceRecordSubs = this.subscribe('deviceRecord', this.data.device_id);
});

Template.deviceDetails.onDestroyed(function () {
    if (this.clientRecordSubs) {
        this.clientRecordSubs.stop();
    }

    if (this.deviceRecordSubs) {
        this.deviceRecordSubs.stop();
    }
});

Template.deviceDetails.events({
    'click #lnkShowAPIAccessSecret'(event, template) {
        Meteor.call('getAPIAccessSecret', template.data.device_id, (error, key) => {
            if (error) {
                console.log('Error calling \'getAPIAccessSecret\' remote method: ' + error);
            }
            else {
                alert('Device API access secret: ' + key);
            }
        });
    },


    'click #resetDeviceAPISecret'(event, template) {
        Meteor.call('resetDeviceAPISecret', template.data.device_id, (error, key) => {
            if (error) {
                console.log('Error calling \'resetDeviceAPISecret\' remote method: ' + error);
            }
            else {
                alert('New device API access secret: ' + key);
            }
        });
    }
});

Template.deviceDetails.helpers({
    client: function () {
        return Catenis.db.collection.Client.findOne({user_id: Template.instance().data.user_id});
    },
    device: function () {
        return Catenis.db.collection.Device.findOne({_id: Template.instance().data.device_id});
    },
    hasName: function (device) {
        return device && device.props && device.props.name;
    },
    hasProdUniqueId: function (device) {
        return device && device.props && device.props.prodUniqueId;
    },
    hasPublic: function (device) {
        return device && device.props && device.props.public !== undefined;
    },
    publicStatus: function (device) {
        return device && device.props && device.props.public !== undefined ? (device.props.public ? 'true' : 'false') : undefined;
    },
    user_id: function(){
        return Template.instance().data.user_id;
    }

});
