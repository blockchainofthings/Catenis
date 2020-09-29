/**
 * Created by Claudio on 2018-06-29.
 */

//console.log('[ConfigEmail.js]: This code just ran.');

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

// Config entries
const emailConfig = config.get('email');

// Configuration settings
export const cfgSettings = {
    smtpHost: emailConfig.get('smtpHost'),
    secureProto: emailConfig.has('secureProto') ? emailConfig.get('secureProto') : undefined,
    smtpPort: emailConfig.has('smtpPort') ? emailConfig.get('smtpPort') : undefined,
    username: emailConfig.has('username') ? emailConfig.get('username') : undefined,
    password: emailConfig.has('password') ? emailConfig.get('password') : undefined
};


// Module code
//

let credentials = undefined;

if (cfgSettings.username) {
    credentials = cfgSettings.username;

    if (cfgSettings.password) {
        credentials += ':' + Catenis.decipherData(cfgSettings.password);
    }
}

process.env.MAIL_URL = (cfgSettings.secureProto && (cfgSettings.secureProto === 'ssl' || cfgSettings.secureProto === 'tls') ? 'smtps://' : 'smtp://') +
    (credentials ? credentials + '@' : '') +
    cfgSettings.smtpHost +
    (cfgSettings.smtpPort ? ':' + cfgSettings.smtpPort : '');
