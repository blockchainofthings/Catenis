/**
 * Created by claudio on 2021-09-22
 */

//console.log('[AccountRegistrationEmailNotify.js]: This code just ran.');

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
const accRegEmailNtfyConfig = config.get('accountRegistrationEmailNotify');

// Configuration settings
const cfgSettings = {
    emailName: accRegEmailNtfyConfig.get('emailName'),
    fromAddress: accRegEmailNtfyConfig.get('fromAddress'),
    replyAddress: accRegEmailNtfyConfig.get('replyAddress')
};


// Definition of function classes
//

/**
 * Class for sending e-mail notification message reporting that a new client account has been
 *  successfully created
 */
export class AccountRegistrationEmailNotify {
    /**
     * Class constructor.
     * @param {string} fromAddress The e-mail address to be used as the message's sender.
     * @param {string} replyAddress The e-mail address to be used as the message's reply-to address.
     */
    constructor(fromAddress, replyAddress) {
        this.emailNotify = new EmailNotify(cfgSettings.emailName, fromAddress, replyAddress);
    }

    /**
     * Send e-mail message.
     * @param {Client} client Client object.
     * @param {Function} [callback] Callback function.
     */
    sendAsync(client, callback) {
        // Get client user account e-mail address
        let clientEmailAddr;

        if ((clientEmailAddr = client.userAccountEmail)) {
            this.emailNotify.sendAsync(clientEmailAddr, null, {
                username: client.userAccountUsername,
                accountNumber: client.props.accountNumber ? client.props.accountNumber : undefined,
                licenseType: client.clientLicense && client.clientLicense.hasLicense() ? licenseName(client.clientLicense.license) : undefined,
            }, callback);
        }
        else {
            // No client e-mail address to send notification. Log warning condition
            Catenis.logger.WARN('No client e-mail address to send account registration e-mail notification', {
                client
            });
        }
    }

    static initialize() {
        Catenis.logger.TRACE('AccountRegistrationEmailNotify initialization');
        // Instantiate AccountRegistrationEmailNotify object
        Catenis.accRegistrationEmailNtfy = new AccountRegistrationEmailNotify(cfgSettings.fromAddress, cfgSettings.replyAddress);
    }
}


// Definition of module (private) functions
//

function licenseName(license) {
    let licName = Util.capitalize(license.level);

    if (license.type) {
        licName += ' (' + license.type + ')';
    }

    return licName;
}


// Module code
//

// Lock function class
Object.freeze(AccountRegistrationEmailNotify);
