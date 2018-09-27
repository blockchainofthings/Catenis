/**
 * Created by claudio on 2018-07-19.
 */

//console.log('[EmailNotify.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
//import config from 'config';
// Meteor packages
//import { Meteor } from 'meteor/meteor';
import { Email } from 'meteor/email';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { EmailContents } from './EmailContents';

// Config entries
/*const config_entryConfig = config.get('config_entry');

// Configuration settings
const cfgSettings = {
    property: config_entryConfig.get('property_name')
};*/


// Definition of function classes
//

// EmailNotify function class
//
// Constructor arguments:
//  emailContents [Object(EmailContents)|String] - An EmailContents object containing the contents to be used as the
//                           notification message. If a string is passed instead, it is assumed to be the reference
//                           name for an e-mail contents to be instantiated
//  fromAddress [String] - E-mail address of sender of notification e-mail message
//  replyAddress [String] - (optional) E-mail address to be used as the address to be used when replying to notification e-mail message
export function EmailNotify(emailContents, fromAddress, replyAddress) {
    this.emailContents = emailContents instanceof EmailContents ? emailContents : new EmailContents(emailContents);
    this.fromAddress = fromAddress;
    this.replyAddress = replyAddress;
}


// Public EmailNotify object methods
//

// Arguments:
//  toAddress [String] - E-mail address of recipient of e-mail notification message
//  subjectVars [Object] - (optional) Object with key-pair dictionary containing variables to be merged with e-mail subject template
//  bodyVars [Object] - (optional) Object with key-pair dictionary containing variables to be merged with e-mail body template
EmailNotify.prototype.send = function (toAddress, subjectVars, bodyVars) {
    const emailOpts = {
        from: this.fromAddress,
        to: toAddress
    };

    if (this.replyAddress) {
        emailOpts.replyTo = this.replyAddress;
    }

    emailOpts.subject = this.emailContents.subject(subjectVars);
    emailOpts.html = this.emailContents.htmlBody(bodyVars);
    emailOpts.text = this.emailContents.textBody(bodyVars);

    Catenis.logger.DEBUG('Contents of e-mail message to send', emailOpts);
    Email.send(emailOpts);
};


// Module functions used to simulate private EmailNotify object methods
//  NOTE: these functions need to be bound to a EmailNotify object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// EmailNotify function class (public) methods
//

/*EmailNotify.class_func = function () {
};*/


// EmailNotify function class (public) properties
//

/*EmailNotify.prop = {};*/


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(EmailNotify);
