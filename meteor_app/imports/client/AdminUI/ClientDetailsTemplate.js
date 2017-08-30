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

function validateFormData(form, errMsgs) {
    const clientInfo = {};
    let hasError = false;

    clientInfo.name = form.clientName.value ? form.clientName.value.trim() : '';

    if (clientInfo.name.length === 0) {
        // Client name not supplied. Report error
        errMsgs.push('Please enter a client name');
        hasError = true;
    }

    clientInfo.username = form.username.value ? form.username.value.trim() : '';

    if (clientInfo.username.length === 0) {
        // Username not supplied. Report error
        errMsgs.push('Please enter a username');
        hasError = true;
    }

    clientInfo.email = form.email.value ? form.email.value.trim() : '';

    if (clientInfo.email.length === 0) {
        // Email not supplied. Report error
        errMsgs.push('Please enter an email address');
        hasError = true;
    }
    else {
        const confEmail = form.confirmEmail.value ? form.confirmEmail.value.trim() : '';

        if (clientInfo.email !== confEmail) {
            // Confirmation email does not match. Report error
            errMsgs.push('Confirmation email does not match');
            hasError = true;
        }
    }
    clientInfo.firstName = form.firstName.value? form.firstName.value.trim() : '';
    if (clientInfo.firstName.length === 0) {
        // firstName not supplied. Report error
        errMsgs.push("Please enter client's first name");
        hasError = true;
    }

    clientInfo.lastName = form.lastName.value? form.lastName.value.trim() : '';
    if (clientInfo.lastName.length === 0) {
        // firstName not supplied. Report error
        errMsgs.push("Please enter client's last name");
        hasError = true;
    }
    clientInfo.companyName= form.companyName.value? form.companyName.value.trim() : '';
    if (clientInfo.companyName.length === 0) {
        // firstName not supplied. Report error
        errMsgs.push("Please enter client's company name");
        hasError = true;
    }


    //check if the validation on the form has been completed. If this works, the above email check is redundant.

    if(form.emailValidation && form.emailValidation.value!=="Validated"){
        errMsgs.push('Email was not validated');
        hasError =true;
    }

    // password will be filled in by the users, except when we're updating it ourselves
    if(form.password){

        //this method is being called in the update form
        clientInfo.pwd = form.password.value ? form.password.value.trim() : '';

        if (clientInfo.pwd.length === 0) {
            // Password not supplied. We're not changing the password
        }
        else {
            const confPsw = form.confirmPassword.value ? form.confirmPassword.value.trim() : '';
            if (clientInfo.pwd !== confPsw) {
                // Confirmation password does not match. Report error
                errMsgs.push('Confirmation password does not match');
                hasError = true;
            }
        }
    }
    return !hasError ? clientInfo : undefined;
}


function licenseViolation(numDevices, user_id) {
    const licenseType= Meteor.users.findOne( {_id: user_id} ).profile.license.licenseType;

    if(licenseType==="Enterprise"){
        return false;
    }else{
        let numAllowed= Catenis.db.collection.License.findOne({licenseType: licenseType}).numAllowedDevices;
        //returns true if this situation results in a license violation.
        return numAllowed < numDevices;
    }
}

// Module code
//

Template.clientDetails.onCreated(function () {

    this.state = new ReactiveDict();
    this.state.set('addMsgCreditsStatus', 'idle');  // Valid statuses: 'idle', 'data-enter', 'processing', 'error', 'success'
    this.state.set('showDevices', !!this.data.showDevices);
    //added by peter to check whether enrollment email was sent.
    this.state.set('haveResentEnrollmentEmail', false);
    this.state.set('errMsgs', []);
    // Subscribe to receive fund balance updates
    this.clientRecordSubs = this.subscribe('clientRecord', this.data.user_id);
    // this.clientUserSubs = this.subscribe('clientUser', this.data.user_id);
    this.clientMessageCreditsSubs = this.subscribe('clientMessageCredits', this.data.user_id);
    this.userListSubs = this.subscribe('userList', Meteor.user());

    //added to allow device number count.
    this.clientDevicesSubs = this.subscribe('clientDevices', this.data.user_id);
    //added to find allowed devices number
    this.licenseSubs = this.subscribe('license');

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


    if (this.userListSubs){
        this.userListSubs.stop();
    }

    if(this.licenseSubs){
        this.licenseSubs.stop();
    }
});

Template.clientDetails.events({
    'click #lnkAddMsgCredits'(event, template) {
        template.state.set('addMsgCreditsStatus', 'data-enter');
        return false;
    },
    'click #butAddMsgCredits'(event, template) {

        const client = Catenis.db.collection.Client.findOne({user_id: Template.instance().data.user_id});
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
        const client = Catenis.db.collection.Client.findOne({user_id: Template.instance().data.user_id});
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
        const client = Catenis.db.collection.Client.findOne({user_id: Template.instance().data.user_id});

        if( confirm("you're about to activate this user. Are you sure?")===true){
            Meteor.call('changeUserStatus', client.user_id, 'Activated', (error) => {
                if (error) {
                    console.log("there was an error activating user", error);
                }
            });
        }

    },
    'click #deactivateUser'(events, template) {
        const client = Catenis.db.collection.Client.findOne({user_id: Template.instance().data.user_id});

        if(confirm("you're about to deactivate this user and all linked devices. Are you sure?")===true){
            Meteor.call('changeUserStatus', client.user_id, 'Deactivated', (error) => {
                if (error) {
                    console.log("there was an error deactivating user", error);
                }
            });
        }

    },

    'submit #updateLicenseAdminForm'(event, template){
        const client = Catenis.db.collection.Client.findOne({user_id: Template.instance().data.user_id});
        const form = event.target;
        const newLicenseState = form.licenseStateRadio.value ? form.licenseStateRadio.value.trim() : '';

        // see if the user currently has more devices than can be held under the new service scheme.
        const numUserDevices = Catenis.db.collection.Device.find( {"client_id": {$eq: client._id } } ).count();
        const newlyAllowedDevices = Catenis.db.collection.License.findOne({licenseType: newLicenseState}).numAllowedDevices;
        if(confirm("you're about to change this user's license to "+ newLicenseState+". Are you sure?")===true){

            //client side verification
            if(newlyAllowedDevices < numUserDevices ){

                alert("The user has too many devices to allow to be reverted to "+ newLicenseState +".");

            }else{

                Meteor.call('updateLicenseAdmin', client, newLicenseState, (error)=>{
                    if(error) {
                        console.log("there was an error updating license", error);
                    }else{

                        //successfully changed user license state
                        if( licenseViolation(numUserDevices, client.user_id) ){
                            alert("after changing the license, the user now has more devices than allowed!");
                        }
                    }
                });
            }
        }
    },


    'click #editForm': function(event, template){

        let userId= event.target.value;
        let user=Meteor.users.findOne({_id: userId});

        // Populate the form fields with the data from the current form.
        $('#updateForm')
            .find('[name="clientName"]').val(user.profile.name).end()
            .find('[name="username"]').val(user.username).end()
            .find('[name="email"]').val(user.emails? user.emails[0].address: "" ).end()
            .find('[name="confirmEmail"]').val(user.emails? user.emails[0].address: "").end()
            .find('[name="firstName"]').val(user.profile.firstname).end()
            .find('[name="lastName"]').val(user.profile.lastname).end()
            .find('[name="companyName"]').val(user.profile.company).end();
    },

    'submit #updateForm'(event, template){
        event.preventDefault();
        const form = event.target;
        // Reset errors
        template.state.set('errMsgs', []);
        template.state.set('successfulUpdate', false);
        let errMsgs = [];
        let clientInfo;

        if ((clientInfo = validateFormData(form, errMsgs))) {
            // Call remote method to update client
            Meteor.call('updateUser', clientInfo, (error) => {
                if (error) {
                    template.state.set('errMsgs', [
                        error.toString()
                    ]);
                }

                else {
                    // Catenis client successfully updated
                    template.state.set('successfulUpdate', true);

                    //close modal form
                    $('#updateFormModal').modal('hide');
                    $('body').removeClass('modal-open');
                    $('.modal-backdrop').remove();
                }
            });
        }else {
            template.state.set('errMsgs', errMsgs);
        }

    }

});


Template.clientDetails.helpers({
    client: function () {
        return Catenis.db.collection.Client.findOne({user_id: Template.instance().data.user_id});
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
    userActive: function(){
        const user= Meteor.users.findOne({_id:  Template.instance().data.user_id});
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
            licenseType= user.profile.license.licenseType;
           return licenseType;
        }else{
            return "user has no license";
        }
    },

    errorMessage: function () {
        return Template.instance().state.get('errMsgs').reduce((compMsg, errMsg) => {
            if (compMsg.length > 0) {
                compMsg += '<br>';
            }
            return compMsg + errMsg;
        }, '');
    },
    successfulUpdate: function(){
        return Template.instance().state.get('successfulUpdate');
    },

    numDevices: function(opt){
        const client = Catenis.db.collection.Client.findOne({user_id: Template.instance().data.user_id});
        const numUserDevices= Catenis.db.collection.Device.find( {"client_id": {$eq: client._id } } ).count();

        if(opt==="active"){
            return numUserDevices;

        }else if(opt==="available"){
            let licenseType;
            if(Meteor.users.findOne( {_id: client.user_id} ).profile.license){

                licenseType= Meteor.users.findOne( {_id: client.user_id} ).profile.license.licenseType;

                if(licenseType==="Enterprise"){

                    return 'unlimited';

                }else{

                    let numAllowed;
                    // needs to be changed if the numAllowed value for license gets changed.
                    // NOTE: could be used to indicate how many devices the user is overusing.
                    numAllowed= Catenis.db.collection.License.findOne({licenseType: licenseType}).numAllowedDevices;

                    return numAllowed- numUserDevices< 0 ? "user is overusing "+ (numUserDevices-numAllowed).toString()+" devices": numAllowed- numUserDevices;
                }

            }else{
                return "user has no license";
            }

        }else{
            return "something went wrong";
        }
    },
    user_id: function(){
        return Template.instance().data.user_id;
    },

    //takes in input of licenseType, returns the number of devices allowed
    devicesForLicense: function(licenseType){
        return Catenis.db.collection.License.findOne({licenseType: licenseType}).numAllowedDevices;
    },
    ensureUserExists: function(){
    //    check if the user actually exists, or this is some random address typed up that should not render anything
        return Meteor.users.findOne( {_id: Template.instance().data.user_id});
    }

});
