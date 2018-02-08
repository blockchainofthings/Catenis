/**
 * Created by claudio on 17/05/17.
 */

//console.log('[LoginTemplate.js]: This code just ran.');

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

// Import template UI
import './LoginTemplate.html';

Template.login.events({
    'click #reset':function(){
        document.location.reload(true);
    }
});
