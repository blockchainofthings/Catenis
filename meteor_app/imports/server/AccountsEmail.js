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
    enrollAccountContents: accountsEmailConfig.get('enrollAccountContents'),
    enrollRegisteredAccountContents: accountsEmailConfig.get('enrollRegisteredAccountContents'),
    verifyEmailContents: accountsEmailConfig.get('verifyEmailContents')
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

    // Account enrollment
    const enrollAccEmailContents = new EmailContents(cfgSettings.enrollAccountContents);
    const enrollRegAccEmailContents = new EmailContents(cfgSettings.enrollRegisteredAccountContents);

    Accounts.emailTemplates.enrollAccount.subject = (user) => {
        return user.profile && ('last_name' in user.profile) ? enrollRegAccEmailContents.subject() : enrollAccEmailContents.subject();
    };

    function userContactName(user) {
        return user.profile.first_name ? user.profile.first_name : user.profile.last_name;
    }

    Accounts.emailTemplates.enrollAccount.text = (user, url) => {
        if (user.profile && ('last_name' in user.profile)) {
            // Self-registered account (not yet associated with a Catenis client)
            return enrollRegAccEmailContents.textBody({
                contactName: userContactName(user),
                url: url
            });
        }
        else {
            // User account already associated with a Catenis client
            const client = Client.getClientByUserId(user._id);

            return enrollAccEmailContents.textBody({
                accountNumber: client && client.props.accountNumber ? client.props.accountNumber : undefined,
                licenseType: client && client.clientLicense && client.clientLicense.hasLicense() ? licenseName(client.clientLicense.license) : undefined,
                url: url
            });
        }
    };

    Accounts.emailTemplates.enrollAccount.html = (user, url) => {
        if (user.profile && ('last_name' in user.profile)) {
            // Self-registered account (not yet associated with a Catenis client)
            return enrollRegAccEmailContents.htmlBody({
                contactName: userContactName(user),
                url: url
            });
        }
        else {
            // User account already associated with a Catenis client
            const client = Client.getClientByUserId(user._id);

            return enrollAccEmailContents.htmlBody({
                accountNumber: client && client.props.accountNumber ? client.props.accountNumber : undefined,
                licenseType: client && client.clientLicense && client.clientLicense.hasLicense() ? licenseName(client.clientLicense.license) : undefined,
                url: url
            });
        }
    };

    // Password reset
    const resetPwdEmailContents = new EmailContents(cfgSettings.resetPasswordContents);

    Accounts.emailTemplates.resetPassword.subject = (user) => {
        return resetPwdEmailContents.subject();
    };

    Accounts.emailTemplates.resetPassword.text = (user, url) => {
        return resetPwdEmailContents.textBody({
            url: url
        });
    };

    Accounts.emailTemplates.resetPassword.html = (user, url) => {
        return resetPwdEmailContents.htmlBody({
            url: url
        });
    };

    // E-mail verification
    const verifyEmailContents = new EmailContents(cfgSettings.verifyEmailContents);

    Accounts.emailTemplates.verifyEmail.subject = (user) => {
        return verifyEmailContents.subject();
    };

    Accounts.emailTemplates.verifyEmail.text = (user, url) => {
        return verifyEmailContents.textBody({
            url: url
        });
    };

    Accounts.emailTemplates.verifyEmail.html = (user, url) => {
        return verifyEmailContents.htmlBody({
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
