/**
 * Created by claudio on 12/05/17.
 */

//console.log('[ConfigLoginForm.js]: This code just ran.');

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
import { RectiveDict } from 'meteor/reactive-dict';
import { AccountsTemplates } from 'meteor/useraccounts:core';

// Module code
//


//don't allow client side users to update code from console. Must call methods to update accounts.
Meteor.users.deny({
    update: function() {
        return true;
    }
});


//function that runs on submit of at-pwd-form. "state" is the AccountTemplates internal state
var onSubmitFunc = function(error, state){

    //runs on successful at-pwd-form submit. Use this to allow for client activation and banning disabled users
    if (!error) {
        // Successfully enrolled client, change client status to "ACTIVE"
        if (state === "enrollAccount") {

            //check if user is actually a first time user.
            if(Meteor.user().profile.status==="Pending"){
                //activate user
                Meteor.call('activateCurrentUser', (error) => {
                });

                //initiate building of corresponding Catenis Client for this user.
                //Claudio, you should call the Client initialization from here.
                //it'd be helpful if the action from line 46 to the client creation was atomic.

            }

            //Successful Activation, now going to log this person out and redirect them to a new page with a link to login.
            Meteor.logout();
            FlowRouter.go('/');

        }
        if(state==="signIn"){
            //ensure that the meteor account of the client is activated. Otherwise logout
            var userAccountStatus=Meteor.user();
            if(userAccountStatus.profile.status !=="Activated"){
                Meteor.logout();
            }
        }

        if(state==="resetPwd"){
        //    ensure that this user is activated. otherwise refuse login
            Meteor.logout();
            FlowRouter.go('/');
        }
    }



};



Accounts.config({passwordResetTokenExpirationInDays: 3 });
Accounts.config({passwordEnrollTokenExpirationInDays: 7 });

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
