/**
 * Created by claudio on 17/05/17.
 */

//console.log('[ClientsTemplate.js]: This code just ran.');

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
//import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';

// References code in other (Catenis) modules on the client
import { Catenis } from '../ClientCatenis';

// Import template UI
import './ClientsTemplate.html';

// Import dependent templates
import './ClientDetailsTemplate.js';
import './NewClientTemplate.js';

// Module code
//

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


Template.clients.onCreated(function () {
    // Subscribe to receive fund balance updates
    this.catenisClientsSubs = this.subscribe('catenisClients', Catenis.ctnHubNodeIndex);
    this.userListSubs = this.subscribe('userList', Meteor.user());

    //show state
    this.state = new ReactiveDict();
    this.state.set('errMsgs', []);

});

Template.clients.onDestroyed(function () {
    if (this.catenisClientsSubs) {
        this.catenisClientsSubs.stop();
    }

    if (this.userListSubs){
        this.userListSubs.stop();
    }

});

Template.clients.events({

    'click #editForm': function(event, template){

        let userId= event.target.value;
        let user=Meteor.users.findOne({_id: userId});

        // Populate the form fields with the data from the current form.
        $('#updateForm')
            .find('[name="clientName"]').val(user.profile.name).end()
            .find('[name="username"]').val(user.username).end()
            .find('[name="email"]').val(user.emails[0].address).end()
            .find('[name="confirmEmail"]').val(user.emails[0].address).end()
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
                }
            });
        }
        else {
            template.state.set('errMsgs', errMsgs);
        }

        //close modal form backdrop
        $('#updateFormModal').modal('hide');
        $('body').removeClass('modal-open');
        $('.modal-backdrop').remove();
    }
});

Template.clients.helpers({
    listClients: function () {
        return Catenis.db.collection.Client.find({}, {sort:{'props.name': 1}}).fetch();
    },
    successfulUpdate: function(){
        return Template.instance().state.get('successfulUpdate');
    },
    errorMessage: function () {
        return Template.instance().state.get('errMsgs').reduce((compMsg, errMsg) => {
            if (compMsg.length > 0) {
                compMsg += '<br>';
            }
            return compMsg + errMsg;
        }, '');
    },

    isClientActive: function (client) {
        return client.status === 'active';
    }
});
