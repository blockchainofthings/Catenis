/**
 * Created by claudio on 15/05/17.
 */

//console.log('[AdminLayout.js]: This code just ran.');

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

// Import template UI
import './AdminLayout.html';

// Import dependent templates
import './LoginTemplate.js';
import './SystemFundingTemplate.js';
import './ClientsTemplate.js';


// Module code
//

Template.adminLayout.onCreated(function () {
    this.state = new ReactiveDict();
});

Template.adminLayout.events({
    'click #lnkLogout'(event, template) {
        Meteor.logout();
    },
    'click #lnkSysFunding'(event, template) {
        template.state.set('page', 'systemFunding');
    },
    'click #lnkClients'(event, template) {
        template.state.set('page', 'clients');
    }
});

Template.adminLayout.helpers({
    page() {
        return Template.instance().state.get('page');
    },

});