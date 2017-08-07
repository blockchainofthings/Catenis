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


Template.clients.onCreated(function () {
    // Subscribe to receive fund balance updates
    this.catenisClientsSubs = this.subscribe('catenisClients', Catenis.ctnHubNodeIndex);
});

Template.clients.onDestroyed(function () {
    if (this.catenisClientsSubs) {
        this.catenisClientsSubs.stop();
    }
});

Template.clients.events({

    'click #editForm': function(event, template){




        // Populate the form fields with the data from the current form.
        $('#updateForm')
            .find('[name="clientName"]').val(Template.instance().state.get('clientInfo').name).end()
            .find('[name="username"]').val(Template.instance().state.get('clientInfo').username).end()
            .find('[name="email"]').val(Template.instance().state.get('clientInfo').email).end()
            .find('[name="confirmEmail"]').val(Template.instance().state.get('clientInfo').email).end()
            .find('[name="firstName"]').val(Template.instance().state.get('clientInfo').firstName).end()
            .find('[name="lastName"]').val(Template.instance().state.get('clientInfo').lastName).end()
            .find('[name="companyName"]').val(Template.instance().state.get('clientInfo').companyName).end();
    },

    'submit #updateForm'(event, template){
        event.preventDefault();
        const form = event.target;
        const clientId = Template.instance().state.get('newClientId');
        // Reset errors
        template.state.set('errMsgs', []);
        template.state.set('successfulUpdate', false);

        let errMsgs = [];
        let clientInfo;
        if ((clientInfo = validateFormData(form, errMsgs))) {
            // Call remote method to update client
            Meteor.call('updateUser', Catenis.ctnHubNodeIndex, clientInfo, clientId, (error) => {
                if (error) {
                    template.state.set('errMsgs', [
                        error.toString()
                    ]);
                }
                else {
                    // Catenis client successfully updated
                    template.state.set('newClientId', clientId);
                    template.state.set('clientInfo', clientInfo);
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
    isClientActive: function (client) {
        return client.status === 'active';
    }
});
