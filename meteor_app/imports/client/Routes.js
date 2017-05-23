/**
 * Created by claudio on 12/05/17.
 */

//console.log('[Module_name.js]: This code just ran.');

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
import { FlowRouter } from 'meteor/kadira:flow-router';
import { BlazeLayout } from 'meteor/kadira:blaze-layout';

// Import templates
import './AdminUI/AdminLayout.js';


// Module code
//

BlazeLayout.setRoot('body');

FlowRouter.route('/admin', {
    action: function() {
        BlazeLayout.render("adminLayout");
    }
});
