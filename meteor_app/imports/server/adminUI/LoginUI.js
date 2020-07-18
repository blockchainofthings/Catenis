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

// References code in other (Catenis) modules
import { Catenis } from '../Catenis';


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
        checkReCaptcha: function (token) {
            let result;
            let error;

            try {
                result = Catenis.reCaptcha.verify(token, this.connection.clientAddress);
            }
            catch (err) {
                error = err;
            }

            if (error || !result.success) {
                // Throw generic error message indicating login failed
                throw new Meteor.Error(403, 'Something went wrong. Please check your credentials.');
            }
        },
        useReCaptchaForLogin: function () {
            return Catenis.reCaptcha.useForLogin;
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
                    username: 1,
                    profile: 1,
                    roles: 1
                }
            });
        }
        else {
            this.ready();
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
