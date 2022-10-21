/**
 * Created by claudio on 2021-10-22
 */

//console.log('[CatenisUser.js]: This code just ran.');

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
import { Roles } from 'meteor/alanning:roles';
import { Email } from 'meteor/email';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { Client } from './Client';

// Config entries
const appAdminRole = config.get('application.adminRole');


// Definition of classes
//

// CatenisUser class
export class CatenisUser {
    /**
     * Class constructor
     * @param {string} user_id
     */
    constructor(user_id) {
        // Assume that supplied user ID belongs to a Catenis client
        try {
            /**
             * @type {(Client|undefined)}
             */
            this.client = Client.getClientByUserId(user_id, true, false);
        }
        catch (err) {}

        if (!this.client) {
            // Not a valid Catenis user. Check if it is an admin user
            this.docUser = Meteor.users.findOne({
                _id: user_id
            }, {
                fields: {
                    emails: 1,
                    profile: 1
                }
            });

            if (!this.docUser) {
                throw new TypeError(`Invalid Catenis user; no user found with the given user ID: ${user_id}`);
            }
            else if (!Roles.userIsInRole(this.docUser, appAdminRole)) {
                throw new TypeError(`Invalid Catenis user; user (ID: ${user_id}) is neither a client nor a system admin`);
            }
        }

        this._email = null;
    }


    // Public object properties (getters/setters)
    //

    get isClient() {
        return !!this.client;
    }

    get isAdminUser() {
        return !this.client;
    }

    get isDeletedClient() {
        return this.client && this.client.isDeleted;
    }

    get user_id() {
        return this.isAdminUser ? this.docUser._id : this.client.user_id;
    }

    get email() {
        if (this._email === null) {
            this._getEmail();
        }

        return this._email;
    }

    get toEmailAddress() {
        if (this.email) {
            let accountName;

            if (this.isClient) {
                let contactName = this.client.contactFullName;

                if (contactName) {
                    accountName = contactName;
                }
                else if (this.client.props.company) {
                    accountName = this.client.props.company;
                }
                else if (this.client.props.name) {
                    accountName = this.client.props.name;
                }
            }
            else if (this.docUser.profile && this.docUser.profile.name) {
                accountName = this.docUser.profile.name;
            }

            return accountName ? `${accountName} <${this.email}>` : this.email;
        }
    }


    // Public object methods
    //

    /**
     * Return the value for the corresponding embedded field
     * @param {string} field The embedded field
     * @return {string} The value for replacing the embedded field
     */
    lookUp(field) {
        let value = '';
        
        switch (field) {
            case 'client.name': {
                if (this.isClient && this.client.props.name) {
                    value = this.client.props.name;
                }
                break;
            }
            case 'client.firstName': {
                if (this.isClient && this.client.props.firstName) {
                    value = this.client.props.firstName;
                }
                break;
            }
            case 'client.lastName': {
                if (this.isClient && this.client.props.lastName) {
                    value = this.client.props.lastName;
                }
                break;
            }
            case 'client.company': {
                if (this.isClient && this.client.props.company) {
                    value = this.client.props.company;
                }
                break;
            }
            case 'client.accountNumber': {
                if (this.isClient && this.client.props.accountNumber) {
                    value = this.client.props.accountNumber;
                }
                break;
            }
            case 'user.accName': {
                if (this.isClient) {
                    value = this.client.userAccountName;
                }
                else {
                    value = this.docUser.profile && this.docUser.profile.name ? this.docUser.profile.name : '';
                }
                break;
            }
            case 'user.email': {
                if (this.email) {
                    value = this.email;
                }
                break;
            }
        }
        
        return value;
    }

    /**
     * Send e-mail message to Catenis user
     * @param {string} subject
     * @param {{html?: string, text?: string}} body
     * @param {string} fromAddress
     * @param {string} [replyAddress]
     */
    sendEmail(subject, body, fromAddress, replyAddress) {
        // Make sure that user has an e-mail address
        if (this.email) {
            // Make sure that message has a body
            if (body.html || body.text) {
                const emailOpts = {
                    from: fromAddress,
                    to: this.toEmailAddress
                };

                if (replyAddress) {
                    emailOpts.replyTo = replyAddress;
                }

                emailOpts.subject = subject;

                emailOpts.html = body.html;
                emailOpts.text = body.text;

                Catenis.logger.DEBUG('Contents of e-mail message to send to Catenis user (ID: %s).', this.user_id, emailOpts);
                Email.send(emailOpts);
            }
            else {
                Catenis.logger.WARN('Trying to send an e-mail message that does not have a body to a Catenis user.', {
                    subject,
                    body,
                    catenisUser: this
                });
            }
        }
        else {
            Catenis.logger.WARN('Trying to send a e-mail message to a Catenis user that does not have an e-mail address.', {catenisUser: this});
        }
    }

    /**
     * Send e-mail message to Catenis user asynchronously
     * @param {string} subject
     * @param {{html?: string, text?: string}} body
     * @param {string} fromAddress
     * @param {(string|Function)} [replyAddress]
     * @param {(Function|undefined)} callback
     */
    sendEmailAsync(subject, body, fromAddress, replyAddress, callback) {
        if (typeof replyAddress === 'function') {
            callback = replyAddress;
            replyAddress = undefined;
        }

        (async () => {
            this.sendEmail(subject, body, fromAddress, replyAddress);
        })()
        .then(
            () => callback(),
            (err) => callback(err)
        );
    }


    // Private object methods
    //

    _getEmail() {
        if (this.isClient) {
            this._email = this.client.userAccountEmail;
        }
        else {
            if (this.docUser.emails && this.docUser.emails.length > 0) {
                this._email = this.docUser.emails[0].address;
            }
            else {
                this._email = undefined;
            }
        }
    }


    // Class (public) methods
    //

    /**
     * List the user IDs of all Catenis' system admin users
     * @return {string[]}
     */
    static listSysAdminUserIds() {
        return Roles.getUsersInRole(appAdminRole, {}, {
            fields: {
                _id: 1
            }
        })
        .map(doc => doc._id);
    }
}


// Module code
//

// Lock class
Object.freeze(CatenisUser);
