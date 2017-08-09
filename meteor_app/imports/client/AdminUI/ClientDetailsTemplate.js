/**
 * Created by claudio on 24/05/17.
 */

//console.log('[ClientDetailsTemplate.js]: This code just ran.');

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
import './ClientDetailsTemplate.html';

// Import dependent templates
import './DevicesTemplate.js';



function licenseViolation(numDevices, user_id) {

    const licenseType= Meteor.users.findOne( {_id: user_id} ).profile.license.licenseType;

    let numAllowed;
    // needs to be changed if the numAllowed value for license gets changed.
    // NOTE: could be used to indicate how many devices the user is overusing.
    switch(licenseType){
        case "Starter":
            numAllowed= 2;
            break;
        case "Basic":
            numAllowed= 20 ;
            break;
        case "Professional":
            numAllowed= 200;
            break;
        case "Enterprise":
            return true;
    }

    //returns true if this situation results in a license violation.
    return numAllowed < numDevices;

}

// Module code
//

Template.clientDetails.onCreated(function () {
    this.state = new ReactiveDict();
    this.state.set('addMsgCreditsStatus', 'idle');  // Valid statuses: 'idle', 'data-enter', 'processing', 'error', 'success'
    this.state.set('showDevices', !!this.data.showDevices);
    //added by peter to check whether enrollment email was sent.
    this.state.set('haveResentEnrollmentEmail', false);

    // Subscribe to receive fund balance updates
    this.clientRecordSubs = this.subscribe('clientRecord', this.data.client_id);
    this.clientUserSubs = this.subscribe('clientUser', this.data.client_id);
    this.clientMessageCreditsSubs = this.subscribe('clientMessageCredits', this.data.client_id);

    //added to allow device number count.
    this.clientDevicesSubs = this.subscribe('clientDevices', this.data.client_id);

});

Template.clientDetails.onDestroyed(function () {
    if (this.clientRecordSubs) {
        this.clientRecordSubs.stop();
    }

    if (this.clientUserSubs) {
        this.clientUserSubs.stop();
    }

    if (this.clientMessageCreditsSubs) {
        this.clientMessageCreditsSubs.stop();
    }

    //added to allow device number count.
    if (this.clientDevicesSubs) {
        this.clientDevicesSubs.stop();
    }
});

Template.clientDetails.events({
    'click #lnkAddMsgCredits'(event, template) {
        template.state.set('addMsgCreditsStatus', 'data-enter');
        return false;
    },
    'click #butAddMsgCredits'(event, template) {
        const client = Catenis.db.collection.Client.findOne({_id: Template.instance().data.client_id});
        const fieldCreditsCount = template.$('#txiMsgCreditAmount')[0];
        const creditsCount = parseInt(fieldCreditsCount.value);

        if (!isNaN(creditsCount)) {
            // Call remote method to add message credits
            Meteor.call('addMessageCredits', client.clientId, creditsCount, (error) => {
                //this is currently not working right now.
                if (error) {
                    template.state.set('addMsgCreditsError', error.toString());
                    template.state.set('addMsgCreditsStatus', 'error');
                }
                else {
                    template.state.set('addMsgCreditsStatus', 'success');
                }
            });

            template.state.set('addMsgCreditsStatus', 'processing');
        }
        else {
            fieldCreditsCount.value = null;
        }
    },
    'click #lnkCancelAddMsgCredits'(event, template) {
        template.state.set('addMsgCreditsStatus', 'idle');

        return false;
    },
    'click #lnkShowDevices'(events, template) {
        template.state.set('showDevices', true);

        return false;
    },
    'click #lnkHideDevices'(events, template) {
        template.state.set('showDevices', false);
        return false;
    },

    //added by peter to allow resending enrollment Email
    'click #resendEnrollmentEmail'(events, template) {
        const client = Catenis.db.collection.Client.findOne({_id: Template.instance().data.client_id});
        template.state.set('haveResentEnrollmentEmail', true);

        Meteor.call('resendEnrollmentEmail', client.user_id, (error) => {
            if (error) {
                template.state.set('resendEnrollmentEmailSuccess', false);
            }
            else {
                template.state.set('resendEnrollmentEmailSuccess', true);
            }
            template.state.set('')
        });

    },



    //in future, these two functions below should be coalesced to become a single changeUserStatus function, that takes in
    //the parameter of current status and flips it other way. Be mindful that there are three statuses, activated, deactivated, and pending.

    //NOTE: this is not linked to the deactivation of the Catenis Clients, so they have to be implemented as well.
    'click #activateUser'(events, template) {
        const client = Catenis.db.collection.Client.findOne({_id: Template.instance().data.client_id});

        if( confirm("you're about to activate this user. Are you sure?")===true){
            Meteor.call('changeUserStatus', client.user_id, 'Activated', (error) => {
                if (error) {
                    console.log("there was an error activating user", error);
                }
            });
        }

    },
    'click #deactivateUser'(events, template) {
        const client = Catenis.db.collection.Client.findOne({_id: Template.instance().data.client_id});

        if(confirm("you're about to deactivate this user and all linked devices. Are you sure?")===true){
            Meteor.call('changeUserStatus', client.user_id, 'Deactivated', (error) => {
                if (error) {
                    console.log("there was an error deactivating user", error);
                }
            });
        }

    },

    'submit #updateLicenseAdminForm'(event, template){
        const client = Catenis.db.collection.Client.findOne({_id: Template.instance().data.client_id});
        const form = event.target;
        const newLicenseState = form.licenseStateRadio.value ? form.licenseStateRadio.value.trim() : '';

        if(confirm("you're about to change this user's license to "+ newLicenseState+". Are you sure?")===true){
            Meteor.call('updateLicenseAdmin', client.user_id, newLicenseState, (error)=>{
                if(error) {
                    console.log("there was an error updating license", error);
                }else{
                    //successfully changed user license state

                    //    alert the Admin if the user currently has more devices than can be held under the new service scheme.
                    const numUserDevices= Catenis.db.collection.Device.find( {"client_id": {$eq: client._id } } ).count();

                    if( licenseViolation(numUserDevices, client.user_id) ){
                        alert("after changing the license, the user now has more devices than allowed!");
                    }
                }
            });
        }
    }

});


Template.clientDetails.helpers({
    client: function () {
        return Catenis.db.collection.Client.findOne({_id: Template.instance().data.client_id});
    },
    clientUsername: function (user_id) {
        const user = Meteor.users.findOne({_id: user_id});
        return user ? user.username : undefined;
    },
    messageCredits: function () {
        return Catenis.db.collection.MessageCredits.findOne(1);
    },
    hasUnconfirmedMessageCredits: function (messageCredits) {
        return messageCredits && messageCredits.unconfirmed > 0;
    },
    // compareOper: valid values: 'equal'/'any-of', 'not-equal'/'none-of'

    checkAddMsgCreditsStatus: function (status, compareOper) {
        compareOper = compareOper && (Array.isArray(status) ? 'all-of' : 'equal');
        const currentStatus = Template.instance().state.get('addMsgCreditsStatus');
        let result = false;

        if (compareOper === 'equal' || compareOper === 'any-of') {
            if (Array.isArray(status)) {
                result = status.some((stat) => stat === currentStatus);
            }
            else {
                result = status === currentStatus;
            }
        }
        else if (compareOper === 'not-equal' || compareOper === 'none-of') {
            if (Array.isArray(status)) {
                result = !status.some((stat) => stat === currentStatus);
            }
            else {
                result = status !== currentStatus;
            }
        }
        return result;
    },
    addMsgCreditsError: function () {
        return Template.instance().state.get('addMsgCreditsError');
    },
    showDevices: function () {
        return Template.instance().state.get('showDevices');
    },
    haveResentEnrollmentEmail: function(){
        return Template.instance().state.get('haveResentEnrollmentEmail');
    },
    userActive: function(user_id){
        const user= Meteor.users.findOne({_id: user_id});
        if(user){
            if(user.profile.status==="Activated"){
                return true;
            }else{
                return false;
            }
        }else{
            return undefined;
        }
    },
    userStatus:function(user_id){
        const user= Meteor.users.findOne({_id: user_id});
        if(user){
           return user.profile.status;
        }else{
            return "undefined(error)";
        }
    },
    resendEnrollmentEmailSuccess: function(){
        return Template.instance().state.get('resendEnrollmentEmailSuccess');
    },
    licenseType: function(user_id){
        const user= Meteor.users.findOne( {_id: user_id} );
        let licenseType;
        if( user && user.profile && user.profile.license ){
            licenseType= Meteor.users.findOne( {_id: user_id} ).profile.license.licenseType;
           return licenseType;
        }else{
            return "user has no license";
        }
    },

});
