/**
 * Created by claudio on 2017-07-19.
 */

//console.log('[LicenseOverdueEmailNotify.js]: This code just ran.');

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

// Config entries
const licOvrdEmailNtfyConfig = config.get('licenseOverdueEmailNotify');

// Configuration settings
const cfgSettings = {
    emailName: licOvrdEmailNtfyConfig.get('emailName'),
    fromAddress: licOvrdEmailNtfyConfig.get('fromAddress'),
    replyAddress: licOvrdEmailNtfyConfig.get('replyAddress')
};


// Definition of function classes
//

// LicenseOverdueEmailNotify function class
export function LicenseOverdueEmailNotify(fromAddress, replyAddress) {
    this.emailNotify = new EmailNotify(cfgSettings.emailName, fromAddress, replyAddress);
}


// Public LicenseOverdueEmailNotify object methods
//

// Arguments:
//  clientLicense [Object(ClientLicense)] - Object containing client license subject of notification
LicenseOverdueEmailNotify.prototype.send = function (clientLicense) {
    // Get client user account e-mail address
    if (clientLicense.hasLicense()) {
        const client = clientLicense.getClient();
        let clientEmailAddr;

        if (client && (clientEmailAddr = client.userAccountEmail)) {
            this.emailNotify.send(clientEmailAddr, null, {
                username: client.userAccountUsername,
                clientId: client.clientId,
                provisionalRenewalDays: clientLicense.license.provisionalRenewalDays
            });
        }
        else {
            // No client or no client e-mail address to send notification. Log warning condition
            Catenis.logger.WARN('No client or no client e-mail address to send license overdue e-mail notification', {
                clientLicense: clientLicense
            });
        }
    }
    else {
        // No license to send notification. Log warning condition
        Catenis.logger.WARN('No client license to send license overdue e-mail notification', {
            clientLicense: clientLicense
        });
    }
};


// Module functions used to simulate private LicenseOverdueEmailNotify object methods
//  NOTE: these functions need to be bound to a LicenseOverdueEmailNotify object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// LicenseOverdueEmailNotify function class (public) methods
//

LicenseOverdueEmailNotify.initialize = function () {
    Catenis.logger.TRACE('LicenseOverdueEmailNotify initialization');
    // Instantiate LicenseOverdueEmailNotify object
    Catenis.licOvrdEmailNtfy = new LicenseOverdueEmailNotify(cfgSettings.fromAddress, cfgSettings.replyAddress);
};


// LicenseOverdueEmailNotify function class (public) properties
//

/*LicenseOverdueEmailNotify.prop = {};*/


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(LicenseOverdueEmailNotify);
