/**
 * Created by claudio on 2017-07-16.
 */

//console.log('[LoginUI.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
//import config from 'config';
// Meteor packages
import { Meteor } from "meteor/meteor";
import { DDP } from 'meteor/ddp-client'

// References code in other (Catenis) modules
import { Catenis } from '../Catenis';
import { Accounts } from 'meteor/accounts-base';


// Definition of function classes
//

// LoginUI function class
export function LoginUI() {
}


// Public LoginUI object methods
//

/*LoginUI.prototype.pub_func = function () {
};*/


// Module functions used to simulate private LoginUI object methods
//  NOTE: these functions need to be bound to a LoginUI object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// LoginUI function class (public) methods
//

LoginUI.initialize = function () {
    Catenis.logger.TRACE('LoginUI initialization');
    // Declaration of RPC methods to be called from client

    // NOTE: the access to these (remote) methods MUST not be restricted since
    //      they need to be accessed from the login form
    Meteor.methods({
        getReCaptchaSiteKey: function () {
            return Catenis.reCaptcha.siteKey;
        },
        useReCaptchaForLogin: function () {
            return Catenis.reCaptcha.useForLogin;
        },
        verifyReCaptcha: function (token) {
            try {
                // Try to retrieve client IP address
                const currentMethodInvocation = DDP._CurrentMethodInvocation.get();
                let clientIP;

                if (currentMethodInvocation) {
                    clientIP = currentMethodInvocation.connection.clientAddress;
                }

                // Verify reCAPTCHA response
                return Catenis.reCaptcha.verify(token, clientIP);
            }
            catch (err) {
                Catenis.logger.ERROR('Failure while verifying reCAPTCHA.', err);
                throw new Meteor.Error('login.verifyReCaptcha', 'Failure while verifying reCAPTCHA');
            }
        },
        getSelfRegistrationSettings: function () {
            return Catenis.application.selfRegistration;
        },
        finalizeAccountRegistration: function (user_email) {
            try {
                // Get recently created user by its registered e-mail address
                const user = Meteor.users.findOne({'emails.address': user_email}, {fields: {_id: 1}});

                if (user) {
                    // Send enrollment e-mail so end user can set the password for their
                    //  account and finalize the account registration
                    Accounts.sendEnrollmentEmail(user._id);
                }
                else {
                    // noinspection ExceptionCaughtLocallyJS
                    throw new Error(`Unable to find user with the given e-mail address: ${user_email}`);
                }
            }
            catch (err) {
                Catenis.logger.ERROR('Failure finalizing account registration.', err);
                throw new Meteor.Error('login.finalizeAccountRegistration', 'Failure finalizing account registration');
            }
        }
    });

    // Declaration of publications

    // NOTE: the access to this publication MUST not be restricted since it needs
    //      to be accessed from the login form
    Meteor.publish('currentUser', function () {
        const currentUser_id = Meteor.userId();

        if (currentUser_id) {
            return Meteor.users.find({
                _id: currentUser_id
            }, {
                fields: {
                    _id: 1,
                    profile: 1
                }
            });
        }
        else {
            this.ready();
        }
    });

    // Note: this will automatically publish the necessary role-assignment collection docs
    //  for the currently logged in user
    Meteor.publish(null, function () {
        if (this.userId) {
            return Meteor.roleAssignment.find({'user._id': this.userId});
        }
        else {
            this.ready()
        }
    });
};


// LoginUI function class (public) properties
//

/*LoginUI.prop = {};*/


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(LoginUI);
