/**
 * Created by claudio on 30/05/17.
 */

//console.log('[NewDeviceTemplate.js]: This code just ran.');

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
import { RectiveDict } from 'meteor/reactive-dict';

// References code in other (Catenis) modules on the client
import { Catenis } from '../ClientCatenis';

// Import template UI
import './NewDeviceTemplate.html';


// Definition of module (private) functions
//

function validateFormData(form, errMsgs) {
    const deviceInfo = {};
    let hasError = false;

    deviceInfo.name = form.clientName.value ? form.clientName.value.trim() : '';

    deviceInfo.prodUniqueId = form.prodUniqueId.value ? form.prodUniqueId.value.trim() : '';

    deviceInfo.public = form.public.checked;

    deviceInfo.ownAPIAccessKey = form.ownAPIAccessKey.checked;

    return !hasError ? deviceInfo : undefined;
}


// Module code
//

Template.newDevice.onCreated(function () {
    this.state = new ReactiveDict();
    this.state.set('errMsgs', []);
    // Subscribe to receive client updates
    this.clientRecordSubs = this.subscribe('clientRecord', this.data.user_id);

    //this is here to allow for the table
    // Subscribe to receive device updates
    this.clientDevicesSubs = this.subscribe('clientDevices', this.data.user_id);
});

Template.newDevice.onRendered(function(){
    this.state = new ReactiveDict();
    this.state.set('errMsgs', []);
    // Subscribe to receive client updates
    this.clientRecordSubs = this.subscribe('clientRecord', this.data.user_id);

    //this is here to allow for the table
    // Subscribe to receive device updates
    this.clientDevicesSubs = this.subscribe('clientDevices', this.data.user_id);
});



Template.newDevice.onDestroyed(function () {
    if (this.clientRecordSubs) {
        this.clientRecordSubs.stop();
    }

//    this is here for the table
    if (this.clientDevicesSubs) {
        this.clientDevicesSubs.stop();
    }
});

Template.newDevice.events({
    'submit #frmNewDevice'(event, template) {
        event.preventDefault();

        const form = event.target;

        // Reset errors
        template.state.set('errMsgs', []);
        let errMsgs = [];
        let deviceInfo;

        if ((deviceInfo = validateFormData(form, errMsgs))) {
            var clientId= Catenis.db.collection.Client.findOne({user_id: Template.instance().data.user_id})._id;
            // Call remote method to create client device
            Meteor.call('createDevice', clientId, deviceInfo, (error, deviceId) => {
                if (error) {
                    template.state.set('errMsgs', [
                        error.toString()
                    ]);
                }
                else {
                    // Catenis device successfully created
                    template.state.set('newDeviceId', deviceId);
                }
            });
        }
        else {
            template.state.set('errMsgs', errMsgs);
        }
    },
    //to allow for Adding more, we refresh the page. this is inefficient but works
    'click #reset':function(){
        document.location.reload(true);
    }
});

Template.newDevice.helpers({
    hasError: function () {
        return Template.instance().state.get('errMsgs').length > 0;
    },
    errorMessage: function () {
        return Template.instance().state.get('errMsgs').reduce((compMsg, errMsg) => {
            if (compMsg.length > 0) {
                compMsg += '<br>';
            }
            return compMsg + errMsg;
        }, '');
    },
    client: function () {
        return Catenis.db.collection.Client.findOne({user_id: Template.instance().data.user_id});
    },
    docClientId: function () {
        return Catenis.db.collection.Client.findOne({user_id: Template.instance().data.user_id})._id;
    },
    docUserId: function(){
        return Template.instance().data.user_id;
    },
    newDeviceId: function () {
        return Template.instance().state.get('newDeviceId');
    },


//    below are here for the table
    listDevices: function () {
        return Catenis.db.collection.Device.find({}, {sort:{'index.deviceIndex': 1}}).fetch();
    },
    isDeviceActive: function (device) {
        return device.status === 'active';
    },

});