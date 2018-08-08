/**
 * Created by claudio on 2018-07-28.
 */

//console.log('[ClientUtil.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import moment from 'moment-timezone';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
//import { Catenis } from './ClientCatenis';


// Definition of function classes
//

// ClientUtil function class
export function ClientUtil() {
}


// ClientUtil function class (public) methods
//

ClientUtil.capitalize = function (str) {
    return str.substr(0, 1).toUpperCase() + str.substr(1);
};

ClientUtil.getUserEmail = function (user) {
    if (user && user.emails && user.emails.length > 0) {
        let emailIdx = 0;

        if (user.emails.length > 1) {
            // Has more than one e-mail address associated with it.
            //  Try to get first one that has already been verified
            emailIdx = user.emails.findIndex((email) => {
                return email.verified;
            });

            if (emailIdx < 0) {
                emailIdx = 0;
            }
        }

        return user.emails[emailIdx].address;
    }
};

// Arguments:
//  date [Object(Date)|Object(moment)] - Date object
//  timeZone [String] - Name of time zone (e.g. 'America/New_York')
//  returnMoment [Boolean] - Indicates whether resulting date/time should be returned as a moment or a Date object
ClientUtil.startOfDayTimeZone = function (date, timeZone, returnMoment = false) {
    const mt = (moment.isMoment(date) ? date : moment(date)).tz(timeZone).startOf('d');

    return returnMoment ? mt : mt.toDate();
};


// ClientUtil function class (public) properties
//

/*ClientUtil.prop = {};*/


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(ClientUtil);
