/**
 * Created by claudio on 12/05/17.
 */

//console.log('[CustomizeLoginForm.js]: This code just ran.');

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
import { AccountsTemplates } from 'meteor/useraccounts:core';
import { FlowRouter } from 'meteor/kadira:flow-router';
import { Roles } from 'meteor/alanning:roles';


// Module code
//

const pwd = AccountsTemplates.removeField('password');

AccountsTemplates.addFields([{
    _id: "username",
    type: "text",
    displayName: "Username",
    required: true,
    minLength: 5,
}, pwd]);

AccountsTemplates.configure({
    forbidClientAccountCreation: true,
    //this below all was added by peter just to incorporate Andre's design.
    showLabels: false,
    hideSignInLink: true,
    hideSignUpLink: true,
    texts: {
        title: {
            //get rid of their titles
            signIn: "",
            signUp: "",
            forgotPwd:"",
            enrollAccount:"",
            resetPwd:"",
        },
        button: {
            changePwd: "Change Password",
            enrollAccount: "Enroll Account",
            forgotPwd: "Send Email Link",
            resetPwd: "Reset Password",
            signIn: "Log In",
            signUp: "Register",
        }
    },
    enablePasswordChange: true,
    onSubmitHook: onSubmitFunc,
});

AccountsTemplates.configureRoute('resetPwd', {template: 'resetPwd'});
AccountsTemplates.configureRoute('enrollAccount', {template: 'enrollAccount'});

// Function that runs on submit of at-pwd-form. "state" is the AccountTemplates internal state
function onSubmitFunc(error, state) {
    //runs on successful at-pwd-form submit. Use this to allow for client activation and banning disabled users
    if (!error) {
        // Successfully enrolled client, change client status to "ACTIVE"
        if (state === 'enrollAccount') {
            //check if user is actually a first time user.
            if (Meteor.user().profile.status === 'Pending') {
                //activate user
                Meteor.call('activateCurrentUser', (error) => {
                });

                //createClient
                Meteor.call('createClient', Meteor.user()._id, (error))
            }

            //Successful Activation, now going to log this person out and redirect them to a new page with a link to login.
            Meteor.logout();
            FlowRouter.go('/');
        }
        else if (state === 'signIn') {
            const user = Meteor.user();
            if (!Roles.userIsInRole(user._id, 'sys-admin')) {
                // Ensure that the meteor account of the client is activated. Otherwise logout
                if (user.profile.status !== 'Activated') {
                    Meteor.logout();
                }
            }
        }
        else if (state === 'resetPwd') {
            // Ensure that this user is activated. Otherwise refuse login
            Meteor.logout();
            FlowRouter.go('/');
        }
    }
}
