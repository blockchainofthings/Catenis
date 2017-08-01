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

// Import template UI
import './AdminLayout.html';

// Import dependent templates
import './LoginTemplate.js';
import './SystemFundingTemplate.js';
import './ClientsTemplate.js';
import './DeviceDetailsTemplate.js';
import './NewClientTemplate.js';
import './NewDeviceTemplate.js';
//below was added by Peter to incorporate bootstrap styling of useraccounts
import './LoginForm.js';
import './LoginBtn.js';




// Module code
//

Template.adminLayout.onCreated(function () {

});

Template.adminLayout.onRendered(function(){
});

Template.adminLayout.events({
    'click #lnkLogout'(event, template) {
        Meteor.logout();
        return false;
    },
    'click .menu-toggle'(event, template){
        $("#wrapper").toggleClass("toggled");
    },
});


Template.adminLayout.helpers({

});

