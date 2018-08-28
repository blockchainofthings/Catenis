/**
 * Created by Claudio on 2017-05-26.
 */

//console.log('[DeviceDetailsTemplate.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
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

    'submit #resetDeviceAPIKey'(event, template){
        event.preventDefault();
        event.stopPropagation();
        const form = event.target;
        const sentence="I would like to reset this Device's API access Key";
        var userInput= form.resetSentence.value;

        if(userInput!=sentence){

            alert("you typed in the wrong value");

        }else{

            Meteor.call('resetDeviceAPISecret', template.data.device_id, (error, key) => {
                if (error) {
                    console.log('Error calling \'resetDeviceAPISecret\' remote method: ' + error);
                }
                else {
                    alert('New device API access secret: ' + key);
                    $('#resetAPIKey').modal('hide');
                    $('body').removeClass('modal-open');
                    $('.modal-backdrop').remove();
                }
            });

        }

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
