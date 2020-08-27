/**
 * Created by claudio on 2020-08-24
 */

//console.log('[AdminEmailNotify.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import moment from 'moment';
// Third-party node modules
import config from 'config';
import Future from 'fibers/future';
import _und from 'underscore';
// Meteor packages
import { Meteor } from 'meteor/meteor';
import { Roles } from 'meteor/alanning:roles';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { EmailNotify } from './EmailNotify';
import { Client } from './Client';

// Config entries
const appAdminRole = config.get('application.adminRole');
const adminEmailNotifyConfig = config.get('adminEmailNotify');

// Configuration settings
const cfgSettings = {
    fromAddress: adminEmailNotifyConfig.get('fromAddress'),
    replyAddress: adminEmailNotifyConfig.get('replyAddress')
};


// Definition of classes
//

// AdminEmailNotify class
export class AdminEmailNotify extends EmailNotify {
    // Class (public) properties
    //

    static adminEmails = getSysAdminEmails();
    static notifyMessage = Object.freeze({
        clientAccountActivated: Object.freeze({
            messageName: 'clientAccountActivated',
            emailContents: 'AdminAccountActivated',
            // Should be a function with a variable number of arguments returning a literal object, or undefined if no variables are expected to be merged to the email message's subject (a static subject)
            subjectVars: undefined,
            // Should be a function with a variable number of arguments returning a literal object, or undefined if no variables are expected to be merged to the email message's body (a static body)
            bodyVars: function (client) {
                function clientContactName(client) {
                    let contactName = client.props.firstName;

                    if (client.props.lastName) {
                        if (contactName) {
                            contactName += ' ';
                        }
                        else if (contactName === undefined) {
                            contactName = '';
                        }

                        contactName += client.props.lastName;
                    }

                    return contactName;
                }

                function activationDate(client) {
                    const docClient = Catenis.db.collection.Client.findOne({
                        _id: client.doc_id,
                        status: Client.status.active.name
                    }, {
                        fields: {
                            status: 1,
                            lastStatusChangedDate: 1
                        }
                    });

                    return docClient ? moment(docClient.lastStatusChangedDate).format('YYYY-MM-DD HH:mm:ss Z') : undefined;
                }

                return _und.mapObject({
                    name: client.props.name,
                    clientId: client.clientId,
                    accountNumber: client.props.accountNumber,
                    username: client.userAccountUsername,
                    contactName: clientContactName(client),
                    company: client.props.company,
                    email: client.userAccountEmail,
                    activationDate: activationDate(client)
                }, checkUndefined);
            }
        })
    });
    static notifyInstances = new Map();


    // Constructor
    //

    // Constructor arguments:
    //  notifyMessageInfo [Object] The admin notification message to be sent (one of the AdminEmailNotify.notifyMessage properties)
    constructor(notifyMessageInfo) {
        super(notifyMessageInfo.emailContents, cfgSettings.fromAddress, cfgSettings.replyAddress);

        // noinspection JSUnresolvedVariable
        this.notifyMessageInfo = notifyMessageInfo;
    }


    // Public object methods
    //

    // Send notification message to admin users
    //
    // Arguments:
    //  bodyNSubjectVarsParams [any] List of parameters to be passed to body vars function and subject vars function in that order.
    //                                If not sufficient parameters are passed, the same parameters passed for the body vars function
    //                                should be used for the subject vars function
    send(...bodyNSubjectVarsParams) {
        let bodyVars;
        let bodyVarsParamsLength = 0;
        let bodyVarsParams;

        if (this.notifyMessageInfo.bodyVars) {
            bodyVarsParamsLength = this.notifyMessageInfo.bodyVars.length;
            bodyVarsParams = bodyNSubjectVarsParams.slice(0, bodyVarsParamsLength);

            bodyVars = this.notifyMessageInfo.bodyVars.apply(undefined, bodyVarsParams);
        }

        let subjectVars;

        if (this.notifyMessageInfo.subjectVars) {
            let subjectVarsParams;

            if (bodyNSubjectVarsParams.length > bodyVarsParamsLength) {
                subjectVarsParams = bodyNSubjectVarsParams.slice(bodyVarsParamsLength);
            }
            else {
                // No extra params passed for subject vars function. Use same params used for
                //  body vars function then
                subjectVarsParams = bodyVarsParams;
            }

            subjectVars = this.notifyMessageInfo.subjectVars.apply(undefined, subjectVarsParams);
        }

        super.send(AdminEmailNotify.adminEmails, subjectVars, bodyVars);
    }

    // Send notification message to admin users asynchronously
    //
    // Arguments:
    //  callback [Function] Callback function
    //  bodyNSubjectVarsParams [any] List of parameters to be passed to body vars function and subject vars function in that order.
    //                                If not sufficient parameters are passed, the same parameters passed for the body vars function
    //                                should be used for the subject vars function
    sendAsync = function (callback, ...bodyNSubjectVarsParams) {
        Future.task(() => {
            // noinspection JSPotentiallyInvalidUsageOfClassThis
            this.send(...bodyNSubjectVarsParams);
        }).resolve(callback);
    }

    // Class (public) methods
    //

    // Send a particular notification message to admin users
    //
    // Arguments:
    //  notifyMessageInfo [Object] The admin notification message to be sent (one of the AdminEmailNotify.notifyMessage properties)
    //  bodyNSubjectVarsParams [any] List of parameters to be passed to body vars function and subject vars function in that order.
    //                                If not sufficient parameters are passed, the same parameters passed for the body vars function
    //                                should be used for the subject vars function
    static send(notifyMessageInfo, ...bodyNSubjectVarsParams) {
        if (!isValidNotifyMessageInfo(notifyMessageInfo)) {
            // Invalid notification message info parameter. Log error
            Catenis.logger.ERROR('Invalid parameter (`notifyMessageInfo`) calling AdminEmailNotify.send() method. Method aborted', {
                notifyMessageInfo
            });
        }

        let notifyInstance;

        if (!AdminEmailNotify.notifyInstances.has(notifyMessageInfo.messageName)) {
            AdminEmailNotify.notifyInstances.set(notifyMessageInfo.messageName, notifyInstance = new AdminEmailNotify(notifyMessageInfo));
        }
        else {
            notifyInstance = AdminEmailNotify.notifyInstances.get(notifyMessageInfo.messageName);
        }

        notifyInstance.send(...bodyNSubjectVarsParams);
    }

    // Send a particular notification message to admin users asynchronously
    //
    // Arguments:
    //  notifyMessageInfo [Object] The admin notification message to be sent (one of the AdminEmailNotify.notifyMessage properties)
    //  callback [Function] Callback function
    //  bodyNSubjectVarsParams [any] List of parameters to be passed to body vars function and subject vars function in that order.
    //                                If not sufficient parameters are passed, the same parameters passed for the body vars function
    //                                should be used for the subject vars function
    static sendAsync(notifyMessageInfo, callback, ...bodyNSubjectVarsParams) {
        if (!isValidNotifyMessageInfo(notifyMessageInfo)) {
            // Invalid notification message info parameter. Log error
            Catenis.logger.ERROR('Invalid parameter (`notifyMessageInfo`) calling AdminEmailNotify.sendAsync() method. Method aborted', {
                notifyMessageInfo
            });
        }

        let notifyInstance;

        if (!AdminEmailNotify.notifyInstances.has(notifyMessageInfo.messageName)) {
            AdminEmailNotify.notifyInstances.set(notifyMessageInfo.messageName, notifyInstance = new AdminEmailNotify(notifyMessageInfo));
        }
        else {
            notifyInstance = AdminEmailNotify.notifyInstances.get(notifyMessageInfo.messageName);
        }

        notifyInstance.sendAsync(callback, ...bodyNSubjectVarsParams);
    }
}


// Definition of module (private) functions
//

function getSysAdminEmails() {
    const adminEmails = [];

    // noinspection JSCheckFunctionSignatures
    Roles.getUsersInRole(appAdminRole, {}, {
        queryOptions: {
            fields: {
                username: 1,
                emails: 1
            }
        }
    }).forEach(doc => {
        // Make sure that admin account has an email address
        if (doc.emails && doc.emails.length >= 0) {
            adminEmails.push(`${doc.username} [${doc.emails[0].address}]`)
        }
        else {
            // Log warning message notifying that admin account has not email address
            Catenis.logger.WARN('Catenis system administrator account (%s) has no email address defined', doc.username);
        }
    });

    return adminEmails;
}

function isValidNotifyMessageInfo(notifyMessage) {
    return Object.values(AdminEmailNotify.notifyMessage).findIndex(value => value === notifyMessage) >= 0;
}

function checkUndefined(val) {
    return val === undefined ? '' : val;
}


// Module code
//

// Lock class
Object.freeze(AdminEmailNotify);
