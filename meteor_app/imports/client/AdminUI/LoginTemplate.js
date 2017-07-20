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
// Module code
//
//
// Template.login.events({
//     'click #login-form-link'(event, template) {
//         AccountsTemplates.setState('signIn');
//     },
//     'click #register-form-link'(event, template){
//         AccountsTemplates.setState('signUp');
//     },
//     'click #forgotPwd-form-link'(event, template){
//         AccountsTemplates.setState('forgotPwd');
//     },
//     'click #clear-form-link'(event, template){
//         //figure out how to do this properly.
//
//     },
// });
//
// Template.login.helpers({
//     atFormTitle: function () {
//         if( AccountsTemplates.getState() === 'signIn' ){
//             return "LOGIN";
//         }else if(AccountsTemplates.getState() === 'signUp'){
//             return "REGISTER";
//
//         }else if(AccountsTemplates.getState() === 'forgotPwd'){
//             return "RESET PASSWORD";
//         }else{
//             return "";
//         }
//     },
//     equals: function(v1, v2){
//         return (v1===v2);
//     }
// });