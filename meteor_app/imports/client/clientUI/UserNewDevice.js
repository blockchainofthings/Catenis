/**
 * Created by Claudio on 2017-08-11.
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
import { ReactiveDict } from 'meteor/reactive-dict';

// References code in other (Catenis) modules on the client
import { Catenis } from '../ClientCatenis';

// Import template UI
import './UserNewDevice.html';


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

function userClient(){
    //returns the client for the user

    const client= Catenis.db.collection.Client.findOne({user_id: Meteor.user()._id});
    if(client){
        return client;
    }else{
        //this is only necessary because right now the catenisadmin has no client.
        return null;
    }
}



// Module code
//

Template.userNewDevice.onCreated(function () {
    //this Template is not meant for the admin user.


    this.state = new ReactiveDict();
    this.state.set('errMsgs', []);


    // Subscribe to receive client updates
    this.catenisClientsSubs = this.subscribe('catenisClients', Catenis.ctnHubNodeIndex);
    const client= userClient();

    if(client){
        this.clientRecordSubs = this.subscribe('clientRecord', client._id );
        //this is here to allow for the table
        // Subscribe to receive device updates
        this.clientDevicesSubs = this.subscribe('clientDevices', Meteor.userId());
    }


});


Template.userNewDevice.onRendered(function () {
    //this Template is not meant for the admin user.


    // Subscribe to receive client updates
    this.catenisClientsSubs = this.subscribe('catenisClients', Catenis.ctnHubNodeIndex);
    const client= userClient();
    console.log(client);
    if(client){
        this.clientRecordSubs = this.subscribe('clientRecord', client._id );
        //this is here to allow for the table
        // Subscribe to receive device updates
        this.clientDevicesSubs = this.subscribe('clientDevices', Meteor.userId());
    }


});






Template.userNewDevice.onDestroyed(function () {

    if(this.catenisClientsSubs){
        this.catenisClientsSubs.stop();
    }

    if (this.clientRecordSubs) {
        this.clientRecordSubs.stop();
    }

   // this is here for the table
    if (this.clientDevicesSubs) {
        this.clientDevicesSubs.stop();
    }


});

Template.userNewDevice.events({

    'submit #frmNewDevice'(event, template) {
        event.preventDefault();
        const form = event.target;

        // Reset errors
        template.state.set('errMsgs', []);
        let errMsgs = [];
        let deviceInfo;

        if ((deviceInfo = validateFormData(form, errMsgs))) {
            // Call remote method to create client device
            Meteor.call('createDevice', userClient()._id, deviceInfo, (error, deviceId) => {
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

Template.userNewDevice.helpers({
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