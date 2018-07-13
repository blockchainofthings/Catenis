/**
 * Created by Claudio on 2017-05-30.
 */

//console.log('[NewClientTemplate.js]: This code just ran.');

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
import './NewClientTemplate.html';

// Definition of module (private) functions

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


// Module code
//

Template.newClient.onCreated(function () {
    this.state = new ReactiveDict();
    this.state.set('errMsgs', []);
    this.state.set('emailValidated', false);
});

Template.newClient.onDestroyed(function () {
});

Template.newClient.events({
    'change #txtClientName'(event, template) {
        const clientName = event.target.value;
        const usernameCtrl = template.$('#txtUsername')[0];

        if (!usernameCtrl.value || usernameCtrl.value.length === 0) {
            usernameCtrl.value = clientName.replace(/(\s|[^\w])+/g,'_');
        }
    },
    //null the email Validation if the email value is changed after validation.
    'change #txtEmail'(event, template){
        template.$('#emailValidation')[0].value="notValidated";
        template.state.set('emailValidated',false);
    },
    'change #txtConfirmEmail'(event, template){
        template.$('#emailValidation')[0].value="notValidated";
        template.state.set('emailValidated',false);
    },

    //check if the email is 'valid' in that the two emails match. Potentially, could be made to check if the email exists in the db already.
    'click #checkEmailValidity'(event, template){
        if(template.$('#txtEmail')[0].value.length===0){
            template.$('#resultEmailConfirmation')[0].innerHTML="Are you sure the original form has an email? Please enter client's email again";
        }else if( template.$('#txtEmail')[0].value===template.$('#txtConfirmEmail')[0].value){
            template.$('#emailValidation')[0].value="Validated";
            template.$('#resultEmailConfirmation')[0].innerHTML="please validate client's email";
            template.state.set('emailValidated',true);
            //close modal form backdrop
            $('#confirmEmail').modal('hide');
            // $('body').removeClass('modal-open');
            // $('.modal-backdrop').remove();
        }else{
            template.$('#resultEmailConfirmation')[0].innerHTML="The two emails provided doesn't match. Please enter client's email again";
        }
    },


    'submit #frmNewClient'(event, template) {
        event.preventDefault();

        const form = event.target;

        // Reset errors
        template.state.set('errMsgs', []);
        let errMsgs = [];
        let clientInfo;

        if ((clientInfo = validateFormData(form, errMsgs))) {
            // Call remote method to create client
            Meteor.call('createUserToEnroll', Catenis.ctnHubNodeIndex, clientInfo, (error, userId) => {
                if (error) {
                    template.state.set('errMsgs', [
                        error.toString()
                    ]);
                }
                else {
                    // Catenis client successfully created
                    template.state.set('newUserId', userId);
                    template.state.set('clientInfo', clientInfo);
                }
            });
        }
        else {
            template.state.set('errMsgs', errMsgs);
        }
    },

    //to clear inputs, we just reload the page. in the future, consider removing the element contents separately.
    'click #reset':function(){
        document.location.reload(true);
    },
});

Template.newClient.helpers({
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

    newUserId: function () {
        return Template.instance().state.get('newUserId');
    },
    clientInfo: function() {
        return Template.instance().state.get('clientInfo');
    },
    successfulUpdate: function(){
        return Template.instance().state.get('successfulUpdate');
    },
    emailValidated: function(){
        return Template.instance().state.get('emailValidated');
    },
    ValidateEmailMessage: function(){
        if(Template.instance().state.get('emailValidated')){
            return "Email Successfully Validated";
        }else{
            return "Validate Email";
        }
    }

});
