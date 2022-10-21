/**
 * Created by claudio on 2017-07-19.
 */

//console.log('[LicenseExpireEmailNotify.js]: This code just ran.');

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
const licExpEmailNtfyConfig = config.get('licenseExpireEmailNotify');

// Configuration settings
const cfgSettings = {
    emailName: licExpEmailNtfyConfig.get('emailName'),
    fromAddress: licExpEmailNtfyConfig.get('fromAddress'),
    replyAddress: licExpEmailNtfyConfig.get('replyAddress')
};


// Definition of function classes
//

// LicenseExpireEmailNotify function class
export function LicenseExpireEmailNotify(fromAddress, replyAddress) {
    this.emailNotify = new EmailNotify(cfgSettings.emailName, fromAddress, replyAddress);
}


// Public LicenseExpireEmailNotify object methods
//

// Arguments:
//  clientLicense [Object(ClientLicense)] - Object containing client license subject of notification
LicenseExpireEmailNotify.prototype.send = function (clientLicense) {
    // Get client user account e-mail address
    if (clientLicense.hasLicense()) {
        const client = clientLicense.getClient();
        let clientEmailAddr;

        if (client && (clientEmailAddr = client.userAccountEmail)) {
            this.emailNotify.send(clientEmailAddr, null, {
                userEmail: clientEmailAddr,
                clientId: client.clientId
            });
        }
        else {
            // No client or no client e-mail address to send notification. Log warning condition
            Catenis.logger.WARN('No client or no client e-mail address to send license expired e-mail notification', {
                clientLicense: clientLicense
            });
        }
    }
    else {
        // No license to send notification. Log warning condition
        Catenis.logger.WARN('No client license to send license expired e-mail notification', {
            clientLicense: clientLicense
        });
    }
};


// Module functions used to simulate private LicenseExpireEmailNotify object methods
//  NOTE: these functions need to be bound to a LicenseExpireEmailNotify object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// LicenseExpireEmailNotify function class (public) methods
//

LicenseExpireEmailNotify.initialize = function () {
    Catenis.logger.TRACE('LicenseExpireEmailNotify initialization');
    // Instantiate LicenseExpireEmailNotify object
    Catenis.licExpEmailNtfy = new LicenseExpireEmailNotify(cfgSettings.fromAddress, cfgSettings.replyAddress);
};


// LicenseExpireEmailNotify function class (public) properties
//

/*LicenseExpireEmailNotify.prop = {};*/


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(LicenseExpireEmailNotify);
