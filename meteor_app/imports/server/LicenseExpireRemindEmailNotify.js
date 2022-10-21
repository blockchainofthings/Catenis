/**
 * Created by claudio on 2017-07-19.
 */

//console.log('[LicenseExpireRemindEmailNotify.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import config from 'config';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { EmailNotify } from './EmailNotify';
import { Util } from './Util';

// Config entries
const licExpRmndEmailNtfyConfig = config.get('licenseExpireRemindEmailNotify');

// Configuration settings
const cfgSettings = {
    emailName: licExpRmndEmailNtfyConfig.get('emailName'),
    fromAddress: licExpRmndEmailNtfyConfig.get('fromAddress'),
    replyAddress: licExpRmndEmailNtfyConfig.get('replyAddress')
};


// Definition of function classes
//

// LicenseExpireRemindEmailNotify function class
export function LicenseExpireRemindEmailNotify(fromAddress, replyAddress) {
    this.emailNotify = new EmailNotify(cfgSettings.emailName, fromAddress, replyAddress);
}


// Public LicenseExpireRemindEmailNotify object methods
//

// Arguments:
//  clientLicense [Object(ClientLicense)] - Object containing client license subject of notification
LicenseExpireRemindEmailNotify.prototype.send = function (clientLicense) {
    // Get client user account e-mail address
    if (clientLicense.hasLicense()) {
        const client = clientLicense.getClient();
        let clientEmailAddr;

        if (client && (clientEmailAddr = client.userAccountEmail)) {
            if (clientLicense.validity.endDate) {
                this.emailNotify.send(clientEmailAddr, null, {
                    userEmail: clientEmailAddr,
                    clientId: client.clientId,
                    validationEndDate: Util.startOfDayTimeZone(clientLicense.validity.endDate, client.timeZone, true).format('LLLL')
                });
            }
            else {
                // License has no expiration date. Log warning condition
                Catenis.logger.WARN('No license expiration date to send license expiration reminder e-mail notification', {
                    clientLicense: clientLicense
                });
            }
        }
        else {
            // No client or no client e-mail address to send notification. Log warning condition
            Catenis.logger.WARN('No client or no client e-mail address to send license expiration reminder e-mail notification', {
                clientLicense: clientLicense
            });
        }
    }
    else {
        // No license to send notification. Log warning condition
        Catenis.logger.WARN('No client license to send license expiration reminder e-mail notification', {
            clientLicense: clientLicense
        });
    }
};


// Module functions used to simulate private LicenseExpireRemindEmailNotify object methods
//  NOTE: these functions need to be bound to a LicenseExpireRemindEmailNotify object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// LicenseExpireRemindEmailNotify function class (public) methods
//

LicenseExpireRemindEmailNotify.initialize = function () {
    Catenis.logger.TRACE('LicenseExpireRemindEmailNotify initialization');
    // Instantiate LicenseExpireRemindEmailNotify object
    Catenis.licExpRmndEmailNtfy = new LicenseExpireRemindEmailNotify(cfgSettings.fromAddress, cfgSettings.replyAddress);
};


// LicenseExpireRemindEmailNotify function class (public) properties
//

/*LicenseExpireRemindEmailNotify.prop = {};*/


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(LicenseExpireRemindEmailNotify);
