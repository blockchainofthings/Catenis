/**
 * Created by claudio on 2018-10-03.
 */

//console.log('[ClientUI.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
//import config from 'config';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from '../Catenis';


// Definition of function classes
//

// ClientUI function class
export function ClientUI() {
}


// Public ClientUI object methods
//

/*ClientUI.prototype.pub_func = function () {
};*/


// Module functions used to simulate private ClientUI object methods
//  NOTE: these functions need to be bound to a ClientUI object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// ClientUI function class (public) methods
//

ClientUI.initialize = function () {
    Catenis.logger.TRACE('AdminUI initialization');

    // Declaration of publications
    Meteor.publish('loggedInClient', function () {
        if (Roles.userIsInRole(this.userId, 'ctn-client')) {
            return Catenis.db.collection.Client.find({
                user_id: this.userId
            });
        }
        else {
            // User not logged in or not a Catenis client
            //  Make sure that publication is not started and throw exception
            this.stop();
            throw new Meteor.Error('ctn_client_no_permission', 'No permission; must be logged in as a Catenis client to perform this task');
        }
    });
};


// ClientUI function class (public) properties
//

/*ClientUI.prop = {};*/


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(ClientUI);
