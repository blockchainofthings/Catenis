/**
 * Created by claudio on 30/05/17.
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

    clientInfo.psw = form.password.value ? form.password.value.trim() : '';

    if (clientInfo.psw.length === 0) {
        // Password not supplied. Report error
        errMsgs.push('Please enter a password');
        hasError = true;
    }
    else {
        const confPsw = form.confirmPassword.value ? form.confirmPassword.value.trim() : '';

        if (clientInfo.psw !== confPsw) {
            // Confirmation password does not match. Report error
            errMsgs.push('Confirmation password does not match');
            hasError = true;
        }
    }

    return !hasError ? clientInfo : undefined;
}


// Module code
//

Template.newClient.onCreated(function () {
    this.state = new ReactiveDict();
    this.state.set('errMsgs', []);

//    below added to make the table on this page possible.
    // Subscribe to receive fund balance updates
    this.catenisClientsSubs = this.subscribe('catenisClients', Catenis.ctnHubNodeIndex);
});

Template.newClient.onDestroyed(function () {
//    below added to make the table possible
    if (this.catenisClientsSubs) {
        this.catenisClientsSubs.stop();
    }
});

Template.newClient.events({
    'change #txtClientName'(event, template) {
        const clientName = event.target.value;
        const usernameCtrl = template.$('#txtUsername')[0];

        if (!usernameCtrl.value || usernameCtrl.value.length === 0) {
            usernameCtrl.value = clientName.replace(/(\s|[^\w])+/g,'_');
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
            Meteor.call('createClient', Catenis.ctnHubNodeIndex, clientInfo, (error, clientId) => {
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
    },
    //to allow for Adding more, we refresh the page. this is inefficient but works
    'click #reset':function(){
        document.location.reload(true);
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

//    below added to make table display possible
    listClients: function () {
        return Catenis.db.collection.Client.find({}, {sort:{'props.name': 1}}).fetch();
    },
    isClientActive: function (client) {
        return client.status === 'active';
    }
});
