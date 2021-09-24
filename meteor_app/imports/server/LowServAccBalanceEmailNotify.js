/**
 * Created by claudio on 2021-09-09
 */

//console.log('[LowServAccBalanceEmailNotify.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import config from 'config';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { EmailNotify } from './EmailNotify';
import { Util } from './Util';

// Config entries
const lowServAccBalanceEmailNtfyConfig = config.get('lowServAccBalanceEmailNotify');

// Configuration settings
const cfgSettings = {
    emailName: lowServAccBalanceEmailNtfyConfig.get('emailName'),
    fromAddress: lowServAccBalanceEmailNtfyConfig.get('fromAddress'),
    replyAddress: lowServAccBalanceEmailNtfyConfig.get('replyAddress')
};


// Definition of function classes
//

/**
 * Class for sending e-mail notification message reporting that client service account balance
 *  is too low.
 */
export class LowServAccBalanceEmailNotify {
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

        if (client && (clientEmailAddr = client.userAccountEmail)) {
            this.emailNotify.sendAsync(clientEmailAddr, null, {
                servAccBalance: Util.formatCatenisServiceCredits(client.serviceAccountBalance()),
                url: Meteor.absoluteUrl('login')
            }, callback);
        }
        else {
            // No client or no client e-mail address to send notification. Log warning condition
            Catenis.logger.WARN('No client or no client e-mail address to send low service account balance e-mail notification', {
                client
            });
        }
    }

    static initialize() {
        Catenis.logger.TRACE('LowServAccBalanceEmailNotify initialization');
        // Instantiate LowServAccBalanceEmailNotify object
        Catenis.lowServAccBalanceEmailNtfy = new LowServAccBalanceEmailNotify(cfgSettings.fromAddress, cfgSettings.replyAddress);
    }
}


// Module code
//

// Lock function class
Object.freeze(LowServAccBalanceEmailNotify);
