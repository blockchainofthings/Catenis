/**
 * Created by claudio on 2017-07-24.
 */

//console.log('[DevicesDisableEmailNotify.js]: This code just ran.');

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
const devsDisabEmailNtfyConfig = config.get('devicesDisabledEmailNotify');

// Configuration settings
const cfgSettings = {
    emailName: devsDisabEmailNtfyConfig.get('emailName'),
    fromAddress: devsDisabEmailNtfyConfig.get('fromAddress'),
    replyAddress: devsDisabEmailNtfyConfig.get('replyAddress')
};


// Definition of function classes
//

// DevicesDisableEmailNotify function class
export function DevicesDisableEmailNotify(fromAddress, replyAddress) {
    this.emailNotify = new EmailNotify(cfgSettings.emailName, fromAddress, replyAddress);
}


// Public DevicesDisableEmailNotify object methods
//

// Arguments:
//  data [Object] { - Object containing required data
//    client: [Object(Client)], - Client object
//    devices: [Array(Object(Device))] - List of Device objects for the devices that had been disabled
//  }
DevicesDisableEmailNotify.prototype.send = function (data) {
    // Get client user account e-mail address
    let clientEmailAddr;

    if (data.client && (clientEmailAddr = data.client.userAccountEmail)) {
        if (data.client.clientLicense && data.client.clientLicense.hasLicense()) {
            if (Array.isArray(data.devices) && data.devices.length > 0) {
                this.emailNotify.send(clientEmailAddr, null, {
                    userEmail: clientEmailAddr,
                    clientId: data.client.clientId,
                    licenseLevel: Util.capitalize(data.client.clientLicense.license.level),
                    maximumAllowedDevices: data.client.maximumAllowedDevices,
                    devices: data.devices.map((device, idx) => {
                        return {
                            order: idx + 1,
                            deviceId: device.deviceId
                        }
                    })
                });
            }
            else {
                // No devices to send notification. Log warning condition
                Catenis.logger.WARN('No devices to send devices disabled e-mail notification', {
                    data: data
                });
            }
        }
        else {
            // No client license to send notification. Log warning condition
            Catenis.logger.WARN('No client license to send devices disabled e-mail notification', {
                data: data
            });
        }
    }
    else {
        // No client or no client e-mail address to send notification. Log warning condition
        Catenis.logger.WARN('No client or no client e-mail address to send devices disabled e-mail notification', {
            data: data
        });
    }
};


// Module functions used to simulate private DevicesDisableEmailNotify object methods
//  NOTE: these functions need to be bound to a DevicesDisableEmailNotify object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// DevicesDisableEmailNotify function class (public) methods
//

DevicesDisableEmailNotify.initialize = function () {
    Catenis.logger.TRACE('DevicesDisableEmailNotify initialization');
    // Instantiate DevicesDisableEmailNotify object
    Catenis.devsDisabEmailNtfy = new DevicesDisableEmailNotify(cfgSettings.fromAddress, cfgSettings.replyAddress);
};


// DevicesDisableEmailNotify function class (public) properties
//

/*DevicesDisableEmailNotify.prop = {};*/


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(DevicesDisableEmailNotify);
