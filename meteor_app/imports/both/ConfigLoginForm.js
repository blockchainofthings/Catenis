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
import { AccountsTemplates } from 'meteor/useraccounts:core';
// Module code
//


Meteor.users.deny({
    update: function() {
        return true;
    }
});



var onSubmitFunc = function(error, state){
    //runs on successful at-pwd-form submit. Use this to allow for client activation and banning disabled users
    if (!error) {
        // Successfully enrolled client, change client status to "ACTIVE"
        if (state === "enrollAccount") {

            //check if user is actually a first time user.

            if(Meteor.user().profile.status==="Pending"){
                //activate user
                Meteor.call('activateCurrentUser', (error) => {
                    if (error) {
                        template.state.set('errMsgs', [
                            error.toString()
                        ]);
                    }
                });

                //initiate building of corresponding Catenis Client for this user.
                //Claudio, you should call the Client initialization from here.


            }

        }
        if(state==="signIn"){
            //ensure that the meteor account of the client is activated. Otherwise logout
            var userAccountStatus=Meteor.user();

            if( userAccountStatus.profile.status !=="Activated"){
                Meteor.logout();
            }
        }
    }
};



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
    onSubmitHook: onSubmitFunc
});


AccountsTemplates.configureRoute('resetPwd', {template: 'resetPwd'});
AccountsTemplates.configureRoute('enrollAccount', {template: 'enrollAccount'});
