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

    clientInfo.firstName = form.firstName.value ? form.firstName.value.trim() : undefined;
    clientInfo.lastName = form.lastName.value ? form.lastName.value.trim() : undefined;
    clientInfo.companyName= form.companyName.value ? form.companyName.value.trim() : undefined;

    if ((!clientInfo.firstName || clientInfo.firstName.length === 0) && (!clientInfo.lastName
        || clientInfo.lastName.length === 0) && (!clientInfo.companyName || clientInfo.companyName.length === 0)) {
        // Neither first name, last name nor company name supplied. Report error
        errMsgs.push('Please enter at least one of: first name, last name, or company');
        hasError = true;
    }

    clientInfo.email = form.email.value ? form.email.value.trim() : '';

    if (clientInfo.email.length === 0) {
        // Email not supplied. Report error
        errMsgs.push('Please enter an email address');
        hasError = true;
    }
    else {
        if (form.emailConfirmation && form.emailConfirmation.value !== 'confirmed') {
            errMsgs.push('Email has not been confirmed');
            hasError =true;
        }
    }

    return !hasError ? clientInfo : undefined;
}


// Module code
//

Template.newClient.onCreated(function () {
    this.state = new ReactiveDict();
    this.state.set('errMsgs', []);
    this.state.set('email', undefined);
    this.state.set('emailConfimed', false);
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
    'change #txtEmail'(event, template) {
        let email = event.target.value;
        email = email ? email.trim() : '';

        template.state.set('email', email.length > 0 ? email : undefined);
        event.target.form.confirmEmail.value = '';
        template.$('#emailConfirmation')[0].value = 'notConfirmed';
        template.state.set('emailConfimed', false);
    },
    'change #txtConfirmEmail'(event, template){
        template.$('#emailConfirmation')[0].value = 'notConfirmed';
        template.state.set('emailConfimed', false);
    },
    'click #btnEmailConfirmClose'(event, template) {
        const form = event.target.form;

        if (!template.state.get('emailConfimed')) {
            form.confirmEmail.value = '';
            template.$('#resultEmailConfirmation')[0].innerHTML = 'Please reenter email to confirm it';
        }
    },
    'click #checkEmailValidity'(event, template) {
        const form = event.target.form;

        const email = form.email.value ? form.email.value.trim() : '';
        const confirmEmail = form.confirmEmail.value ? form.confirmEmail.value.trim() : '';

        if (confirmEmail.length === 0) {
            template.$('#resultEmailConfirmation')[0].innerHTML = 'Please reenter email to confirm it';
        }
        else if (email === confirmEmail) {
            template.$('#emailConfirmation')[0].value = 'confirmed';
            template.$('#resultEmailConfirmation')[0].innerHTML = 'Please reenter email to confirm it';
            template.state.set('emailConfimed', true);

            // Close modal form backdrop
            $('#confirmEmail').modal('hide');
        }
        else{
            template.$('#resultEmailConfirmation')[0].innerHTML = '<span style="color:red">Emails do not match. Please check entered email</span>';
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
            // Call remote method to create new client
            Meteor.call('createNewClient', Catenis.ctnHubNodeIndex, clientInfo, (error, clientId) => {
                if (error) {
                    template.state.set('errMsgs', [
                        error.toString()
                    ]);
                }
                else {
                    // Catenis client successfully created
                    template.state.set('newClientId', clientId);
                }
            });
        }
        else {
            template.state.set('errMsgs', errMsgs);
        }
    }
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
    newClientId: function () {
        return Template.instance().state.get('newClientId');
    },
    clientInfo: function() {
        return Template.instance().state.get('clientInfo');
    },
    successfulUpdate: function(){
        return Template.instance().state.get('successfulUpdate');
    },
    needsConfirmEmail: function () {
        const template = Template.instance();

        return template.state.get('email') && !template.state.get('emailConfimed');
    }
});
