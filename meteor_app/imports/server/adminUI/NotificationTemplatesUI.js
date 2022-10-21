/**
 * Created by claudio on 2021-10-27
 */

//console.log('[NotificationTemplatesUI.js]: This code just ran.');

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

// References code in other (Catenis) modules
import { Catenis } from '../Catenis';
import { UINotificationTemplate } from '../UINotificationTemplate';
import {
    UINotification,
    cfgSettings as uiNotificationCfgSettings,
    parseExpirationDate
} from '../UINotification';

const appAdminRole = config.get('application.adminRole');


// Definition of function classes
//

// NotificationTemplatesUI function class
export function NotificationTemplatesUI() {
}


// NotificationTemplatesUI function class (public) methods
//

NotificationTemplatesUI.initialize = function () {
    Catenis.logger.TRACE('NotificationTemplatesUI initialization');
    // Declaration of RPC methods to be called from client
    Meteor.methods({
        createNewUINotificationTemplate: function (templateInfo) {
            if (Roles.userIsInRole(this.userId, 'sys-admin')) {
                try {
                    // Create new UI notification template
                    UINotificationTemplate.createNew(
                        templateInfo.name,
                        templateInfo.category,
                        templateInfo.urgency,
                        templateInfo.sendViaEmail,
                        templateInfo.target,
                        templateInfo.title,
                        templateInfo.contents
                    );
                }
                catch (err) {
                    // Error trying to create UI notification template. Log error and throw exception
                    Catenis.logger.ERROR('Failure trying to create new UI notification template.', err);
                    throw new Meteor.Error('notificationTemplate.create.failure', 'Failure trying to create new UI notification template: ' + err.toString());
                }
            }
            else {
                // User not logged in or not a system administrator.
                //  Throw exception
                throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
            }
        },
        updateUINotificationTemplate: function (uiNotificationTemplate_id, templateInfo) {
            if (Roles.userIsInRole(this.userId, 'sys-admin')) {
                try {
                    // Update UI notification template
                    UINotificationTemplate.getUINotificationTemplateByDocId(uiNotificationTemplate_id).updateInfo(templateInfo);
                }
                catch (err) {
                    // Error trying to update UI notification template. Log error and throw exception
                    Catenis.logger.ERROR('Failure trying to update UI notification template.', err);
                    throw new Meteor.Error('notificationTemplate.update.failure', 'Failure trying to update UI notification template: ' + err.toString());
                }
            }
            else {
                // User not logged in or not a system administrator.
                //  Throw exception
                throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
            }
        },
        activateUINotificationTemplate: function (uiNotificationTemplate_id) {
            if (Roles.userIsInRole(this.userId, 'sys-admin')) {
                try {
                    // Activate UI notification template
                    UINotificationTemplate.getUINotificationTemplateByDocId(uiNotificationTemplate_id).activate();
                }
                catch (err) {
                    // Error trying to activate UI notification template. Log error and throw exception
                    Catenis.logger.ERROR('Failure trying to activate UI notification template.', err);
                    throw new Meteor.Error('notificationTemplate.activate.failure', 'Failure trying to activate UI notification template: ' + err.toString());
                }
            }
            else {
                // User not logged in or not a system administrator.
                //  Throw exception
                throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
            }
        },
        deleteUINotificationTemplate: function (uiNotificationTemplate_id) {
            if (Roles.userIsInRole(this.userId, 'sys-admin')) {
                try {
                    // Delete UI notification template
                    UINotificationTemplate.getUINotificationTemplateByDocId(uiNotificationTemplate_id).delete();
                }
                catch (err) {
                    // Error trying to delete UI notification template. Log error and throw exception
                    Catenis.logger.ERROR('Failure trying to delete UI notification template.', err);
                    throw new Meteor.Error('notificationTemplate.delete.failure', 'Failure trying to delete UI notification template: ' + err.toString());
                }
            }
            else {
                // User not logged in or not a system administrator.
                //  Throw exception
                throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
            }
        },
        disableUINotificationTemplate: function (uiNotificationTemplate_id) {
            if (Roles.userIsInRole(this.userId, 'sys-admin')) {
                try {
                    // Disable UI notification template
                    UINotificationTemplate.getUINotificationTemplateByDocId(uiNotificationTemplate_id).disable();
                }
                catch (err) {
                    // Error trying to disable UI notification template. Log error and throw exception
                    Catenis.logger.ERROR('Failure trying to disable UI notification template.', err);
                    throw new Meteor.Error('notificationTemplate.disable.failure', 'Failure trying to disable UI notification template: ' + err.toString());
                }
            }
            else {
                // User not logged in or not a system administrator.
                //  Throw exception
                throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
            }
        },
        getUINotificationTemplateContentsStaticFields: function (uiNotificationTemplate_id) {
            if (Roles.userIsInRole(this.userId, 'sys-admin')) {
                try {
                    // Get static fields defined for the UI notification template's contents
                    return UINotificationTemplate.getUINotificationTemplateByDocId(uiNotificationTemplate_id).contentsStaticFields;
                }
                catch (err) {
                    // Error trying to get UI notification template's contents static fields. Log error and throw exception
                    Catenis.logger.ERROR('Failure trying to get UI notification template\'s contents static fields.', err);
                    throw new Meteor.Error('notificationTemplate.getContentsStaticFields.failure', 'Failure trying to get UI notification template\'s contents static fields: ' + err.toString());
                }
            }
            else {
                // User not logged in or not a system administrator.
                //  Throw exception
                throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
            }
        },
        createNewUINotification: function (uiNotificationTemplate_id, notificationInfo) {
            if (Roles.userIsInRole(this.userId, 'sys-admin')) {
                try {
                    // Create new derived UI notification
                    UINotificationTemplate.getUINotificationTemplateByDocId(uiNotificationTemplate_id)
                    .createUINotification(
                        notificationInfo.name,
                        notificationInfo.contentsStaticFieldsValue,
                        notificationInfo.expirationDate ? parseExpirationDate(notificationInfo.expirationDate) : undefined
                    );
                }
                catch (err) {
                    // Error trying to create UI notification. Log error and throw exception
                    Catenis.logger.ERROR('Failure trying to create new UI notification.', err);
                    throw new Meteor.Error('notification.create.failure', 'Failure trying to create new UI notification: ' + err.toString());
                }
            }
            else {
                // User not logged in or not a system administrator.
                //  Throw exception
                throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
            }
        },
        updateUINotification: function (uiNotification_id, notificationInfo) {
            if (Roles.userIsInRole(this.userId, 'sys-admin')) {
                try {
                    if (notificationInfo.expirationDate) {
                        // noinspection JSCheckFunctionSignatures
                        notificationInfo.expirationDate = parseExpirationDate(notificationInfo.expirationDate);
                    }

                    // Update UI notification
                    UINotification.getUINotificationByDocId(uiNotification_id).updateInfo(notificationInfo);
                }
                catch (err) {
                    // Error trying to update UI notification. Log error and throw exception
                    Catenis.logger.ERROR('Failure trying to update UI notification.', err);
                    throw new Meteor.Error('notification.update.failure', 'Failure trying to update UI notification: ' + err.toString());
                }
            }
            else {
                // User not logged in or not a system administrator.
                //  Throw exception
                throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
            }
        },
        deleteUINotification: function (uiNotification_id) {
            if (Roles.userIsInRole(this.userId, 'sys-admin')) {
                try {
                    // Delete UI notification
                    UINotification.getUINotificationByDocId(uiNotification_id).delete();
                }
                catch (err) {
                    // Error trying to delete UI notification. Log error and throw exception
                    Catenis.logger.ERROR('Failure trying to delete UI notification.', err);
                    throw new Meteor.Error('notification.delete.failure', 'Failure trying to delete UI notification: ' + err.toString());
                }
            }
            else {
                // User not logged in or not a system administrator.
                //  Throw exception
                throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
            }
        },
        getUINotificationReferenceTimeZone: function () {
            if (Roles.userIsInRole(this.userId, 'sys-admin')) {
                return uiNotificationCfgSettings.refTimeZone;
            }
            else {
                // User not logged in or not a system administrator.
                //  Throw exception
                throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
            }
        },
        issueUINotification: function (uiNotification_id) {
            if (Roles.userIsInRole(this.userId, 'sys-admin')) {
                try {
                    // Issue UI notification
                    UINotification.getUINotificationByDocId(uiNotification_id).issue();
                }
                catch (err) {
                    // Error trying to issue UI notification. Log error and throw exception
                    Catenis.logger.ERROR('Failure trying to issue UI notification.', err);
                    throw new Meteor.Error('notification.issue.failure', 'Failure trying to issue UI notification: ' + err.toString());
                }
            }
            else {
                // User not logged in or not a system administrator.
                //  Throw exception
                throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
            }
        },
        composeNotificationMessage: function (uiNotification_id, user_id) {
            if (Roles.userIsInRole(this.userId, 'sys-admin')) {
                try {
                    // Compose UI notification message for the Catenis user
                    const uiNotification = UINotification.getUINotificationByDocId(uiNotification_id)

                    return uiNotification.composeMessageForUser(user_id, {
                        uiMessage: true,
                        emailMessage: uiNotification.sendViaEmail
                    });
                }
                catch (err) {
                    // Error trying to compose UI notification message. Log error and throw exception
                    Catenis.logger.ERROR('Failure trying to compose UI notification message.', err);
                    throw new Meteor.Error('notification.compose.message.failure', 'Failure trying to compose UI notification message: ' + err.toString());
                }
            }
            else {
                // User not logged in or not a system administrator.
                //  Throw exception
                throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
            }
        }
    });

    // Declaration of publications
    Meteor.publish('uiNotificationTemplates', function () {
        if (Roles.userIsInRole(this.userId, 'sys-admin')) {
            return Catenis.db.collection.UINotificationTemplate.find();
        }
        else {
            // User not logged in or not a system administrator
            //  Make sure that publication is not started and throw exception
            this.stop();
            throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
        }
    });

    Meteor.publish('uiNotificationTemplateRecord', function (uiNotificationTemplate_id) {
        if (Roles.userIsInRole(this.userId, 'sys-admin')) {
            return Catenis.db.collection.UINotificationTemplate.find({
                _id: uiNotificationTemplate_id
            });
        }
        else {
            // User not logged in or not a system administrator
            //  Make sure that publication is not started and throw exception
            this.stop();
            throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
        }
    });

    Meteor.publish('uiNotifications', function (uiNotificationTemplate_id) {
        if (Roles.userIsInRole(this.userId, 'sys-admin')) {
            return Catenis.db.collection.UINotification.find({
                uiNotificationTemplate_id
            });
        }
        else {
            // User not logged in or not a system administrator
            //  Make sure that publication is not started and throw exception
            this.stop();
            throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
        }
    });

    Meteor.publish('uiNotificationTemplateNotificationRecord', function (uiNotificationTemplate_id, uiNotification_id) {
        if (Roles.userIsInRole(this.userId, 'sys-admin')) {
            return Catenis.db.collection.UINotification.find({
                _id: uiNotification_id,
                uiNotificationTemplate_id
            });
        }
        else {
            // User not logged in or not a system administrator
            //  Make sure that publication is not started and throw exception
            this.stop();
            throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
        }
    });

    Meteor.publish('catenisUsers', function () {
        if (Roles.userIsInRole(this.userId, 'sys-admin')) {
            function contactName(doc) {
                let contactFullName = doc.props.firstName || '';

                if (doc.props.lastName) {
                    if (contactFullName) {
                        contactFullName += ' ';
                    }

                    contactFullName += doc.props.lastName;
                }

                return contactFullName;
            }

            function userAccountName(doc) {
                return doc.profile && doc.profile.name ? doc.profile.name : '';
            }

            function propChanged(prop, obj1, obj2) {
                return ((prop in obj1) && !(prop in obj2)) || (!(prop in obj1) && (prop in obj2))
                    || ((prop in obj1) && obj1[prop] !== obj2[prop]);
            }

            // Get client users
            const observeHandle = Catenis.db.collection.Client.find({
                status: {
                    $ne: 'deleted'
                }
            }, {
                fields: {
                    user_id: 1,
                    props: 1,
                    status: 1
                }
            })
            .observe({
                added: (doc) => {
                    this.added('CatenisUser', doc.user_id, {
                        type: 'client',
                        name: doc.props.name,
                        company: doc.props.company,
                        contact: contactName(doc),
                    });
                },
                changed: (newDoc, oldDoc) => {
                    const changedFields = {};

                    if (newDoc.props.name !== oldDoc.props.name) {
                        changedFields.name = newDoc.props.name;
                    }

                    if (propChanged('company', newDoc.props, oldDoc.props)) {
                        changedFields.company = newDoc.props.company;
                    }

                    if (propChanged('firstName', newDoc.props, oldDoc.props)
                            || propChanged('lastName', newDoc.props, oldDoc.props)) {
                        changedFields.contact = contactName(newDoc);
                    }

                    if (Object.keys(changedFields).length > 0) {
                        this.changed('CatenisUser', newDoc.user_id, changedFields);
                    }
                },
                removed: (doc) => {
                    this.removed('CatenisUser', doc.user_id);
                }
            });

            // Get admin users
            const observeHandle2 = Roles.getUsersInRole(appAdminRole, {}, {
                fields: {
                    _id: 1,
                    profile: 1
                }
            })
            .observe({
                added: (doc) => {
                    this.added('CatenisUser', doc._id, {
                        type: 'admin',
                        name: userAccountName(doc),
                    });
                },
                changed: (newDoc, oldDoc) => {
                    const newAccountName = userAccountName(newDoc);
                    const oldAccountName = userAccountName(oldDoc);

                    if (newAccountName !== oldAccountName) {
                        this.changed('CatenisUser', newDoc._id, {
                            name: newAccountName
                        });
                    }
                },
                removed: (doc) => {
                    this.removed('CatenisUser', doc._id);
                }
            });

            this.ready();

            this.onStop(() => {
                observeHandle.stop();
                observeHandle2.stop();
            });
        }
        else {
            // User not logged in or not a system administrator
            //  Make sure that publication is not started and throw exception
            this.stop();
            throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
        }
    });
};


// Module code
//

// Lock function class
Object.freeze(NotificationTemplatesUI);
