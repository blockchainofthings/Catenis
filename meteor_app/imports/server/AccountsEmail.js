/**
 * Created by claudio on 2017-07-16.
 */

//console.log('[AccountsEmail.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import config from 'config';
// Meteor packages
import { Accounts } from 'meteor/accounts-base';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { EmailContents } from './EmailContents';
import { Client } from './Client';
import { Util } from './Util';

// Config entries
const accountsEmailConfig = config.get('accountsEmail');

// Configuration settings
const cfgSettings = {
    fromAddress: accountsEmailConfig.get('fromAddress'),
    resetPasswordContents: accountsEmailConfig.get('resetPasswordContents'),
    enrollAccountContents: accountsEmailConfig.get('enrollAccountContents')
};


// Definition of function classes
//

// AccountsEmail function class
export function AccountsEmail() {
}


// Public AccountsEmail object methods
//

/*AccountsEmail.prototype.pub_func = function () {
};*/


// Module functions used to simulate private AccountsEmail object methods
//  NOTE: these functions need to be bound to a AccountsEmail object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// AccountsEmail function class (public) methods
//

AccountsEmail.initialize = function () {
    Catenis.logger.TRACE('AccountsEmail initialization');
    // Configure accounts related e-mail messages
    Accounts.emailTemplates.from = cfgSettings.fromAddress;

    const enrollAccEmailContents = new EmailContents(cfgSettings.enrollAccountContents);
    const resetPwdEmailContents = new EmailContents(cfgSettings.resetPasswordContents);

    Accounts.emailTemplates.enrollAccount.subject = (user) => {
        return enrollAccEmailContents.subject();
    };

    Accounts.emailTemplates.enrollAccount.text = (user, url) => {
        const client = Client.getClientByUserId(user._id);

        return enrollAccEmailContents.textBody({
            username: user.username,
            accountNumber: client && client.props.accountNumber ? client.props.accountNumber : undefined,
            licenseType: client && client.clientLicense && client.clientLicense.hasLicense() ? licenseName(client.clientLicense.license) : undefined,
            url: url
        });
    };

    Accounts.emailTemplates.enrollAccount.html = (user, url) => {
        const client = Client.getClientByUserId(user._id);

        return enrollAccEmailContents.htmlBody({
            username: user.username,
            accountNumber: client && client.props.accountNumber ? client.props.accountNumber : undefined,
            licenseType: client && client.clientLicense && client.clientLicense.hasLicense() ? licenseName(client.clientLicense.license) : undefined,
            url: url
        });
    };

    Accounts.emailTemplates.resetPassword.subject = (user) => {
        return resetPwdEmailContents.subject();
    };

    Accounts.emailTemplates.resetPassword.text = (user, url) => {
        return resetPwdEmailContents.textBody({
            username: user.username,
            url: url
        });
    };

    Accounts.emailTemplates.resetPassword.html = (user, url) => {
        return resetPwdEmailContents.htmlBody({
            username: user.username,
            url: url
        });
    };
};


// AccountsEmail function class (public) properties
//

/*AccountsEmail.prop = {};*/


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
Object.freeze(AccountsEmail);
