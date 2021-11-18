/**
 * Created by claudio on 2021-10-27
 */

//console.log('[NotificationsUI.js]: This code just ran.');

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
import { UserUINotification } from '../UserUINotification';
import { UINotificationTemplateShared } from '../../both/UINotificationTemplateShared';

const userUINotificationDisplayBatchSize = config.get('userUINotification.displayBatchSize');


// Definition of function classes
//

// NotificationsUI function class
export function NotificationsUI() {
}


// NotificationsUI function class (public) methods
//

NotificationsUI.initialize = function () {
    Catenis.logger.TRACE('NotificationsUI initialization');
    // Declaration of RPC methods to be called from client
    Meteor.methods({
        setUserNotificationAsRead: function (userUINotification_id) {
            if (this.userId) {
                try {
                    const userUINotification = UserUINotification.getUserUINotificationByDocId(userUINotification_id);

                    // Make sure that notification belongs to the logged in user
                    if (userUINotification.user.user_id !== this.userId) {
                        // noinspection ExceptionCaughtLocallyJS
                        throw new Error('Notification does not belong to the logged in user');
                    }

                    // Set notification as read
                    userUINotification.read();
                }
                catch (err) {
                    // Error trying to set user UI notification as read. Log error and throw exception
                    Catenis.logger.ERROR('Failure trying to set user UI notification as read.', err);
                    throw new Meteor.Error('notification.user.read', 'Failure trying to set user UI notification as read: ' + err.toString());
                }
            }
            else {
                // User not logged in.
                //  Throw exception
                throw new Meteor.Error('ctn_user_no_permission', 'No permission; must be logged in to perform this task');
            }
        },
        deleteUserNotification: function (userUINotification_id) {
            if (this.userId) {
                try {
                    const userUINotification = UserUINotification.getUserUINotificationByDocId(userUINotification_id);

                    // Make sure that notification belongs to the logged in user
                    if (userUINotification.user.user_id !== this.userId) {
                        // noinspection ExceptionCaughtLocallyJS
                        throw new Error('Notification does not belong to the logged in user');
                    }

                    // Delete user notification
                    userUINotification.delete();
                }
                catch (err) {
                    // Error trying to delete user UI notification. Log error and throw exception
                    Catenis.logger.ERROR('Failure trying to delete user UI notification.', err);
                    throw new Meteor.Error('notification.user.delete', 'Failure trying to delete user UI notification: ' + err.toString());
                }
            }
            else {
                // User not logged in.
                //  Throw exception
                throw new Meteor.Error('ctn_user_no_permission', 'No permission; must be logged in to perform this task');
            }
        },
        setAllUserNotificationsAsRead: function () {
            if (this.userId) {
                try {
                    UserUINotification.readAllUserNotifications(this.userId);
                }
                catch (err) {
                    // Error trying to set all user UI notifications as read. Log error and throw exception
                    Catenis.logger.ERROR('Failure trying to set all user UI notifications as read.', err);
                    throw new Meteor.Error('notification.user.read_all', 'Failure trying to set all user UI notifications as read: ' + err.toString());
                }
            }
            else {
                // User not logged in.
                //  Throw exception
                throw new Meteor.Error('ctn_user_no_permission', 'No permission; must be logged in to perform this task');
            }
        },
        deleteAllUserNotifications: function () {
            if (this.userId) {
                try {
                    UserUINotification.deleteAllUserNotifications(this.userId);
                }
                catch (err) {
                    // Error trying to delete all user UI notifications. Log error and throw exception
                    Catenis.logger.ERROR('Failure trying to delete all user UI notifications.', err);
                    throw new Meteor.Error('notification.user.delete_all', 'Failure trying to delete all user UI notifications: ' + err.toString());
                }
            }
            else {
                // User not logged in.
                //  Throw exception
                throw new Meteor.Error('ctn_user_no_permission', 'No permission; must be logged in to perform this task');
            }
        },
        getUserUINotificationDisplayBatchSize: function () {
            if (this.userId) {
                return userUINotificationDisplayBatchSize;
            }
            else {
                // User not logged in.
                //  Throw exception
                throw new Meteor.Error('ctn_user_no_permission', 'No permission; must be logged in to perform this task');
            }
        }
    });

    // Declaration of publications
    Meteor.publish('userNotificationInfo', function () {
        if (this.userId) {
            let recCounter = 0;

            this.added('UserNotificationInfo', 1, {
                unreadCount: recCounter
            });

            // Retrieve unread user notifications
            const observeHandle = Catenis.db.collection.UserUINotification.find({
                user_id: this.userId,
                status: UserUINotification.userNotificationStatus.new.name
            }, {
                fields: {
                    _id: 1
                }
            })
            .observe({
                added: (doc) => {
                    recCounter++;

                    this.changed('UserNotificationInfo', 1, {
                        unreadCount: recCounter
                    });
                },
                removed: (doc) => {
                    recCounter--;

                    this.changed('UserNotificationInfo', 1, {
                        unreadCount: recCounter
                    });
                }
            });

            this.ready();

            this.onStop(() => observeHandle.stop());
        }
        else {
            // User not logged in.
            //  Make sure that publication is not started and throw exception
            this.stop();
            throw new Meteor.Error('ctn_user_no_permission', 'No permission; must be logged in to perform this task');
        }
    });

    Meteor.publish('userNotifications', function (limit) {
        if (this.userId) {
            // Retrieve non-deleted ui notifications for current user
            const observeHandle = Catenis.db.collection.UserUINotification.find({
                user_id: this.userId,
                status: {
                    $ne: UserUINotification.userNotificationStatus.deleted.name
                }
            }, {
                sort: {
                    createdDate: -1
                },
                // Note: we try to retrieve (and return) one extra record so it can be used by the client
                //        to detect whether there are more records to be loaded
                limit: typeof limit === 'number' && limit > 0 ? limit + 1 : undefined
            })
            .observe({
                added: (doc) => {
                    // Instantiate user UI notification
                    const userUINotification = UserUINotification.getUserUINotificationByDocId(doc._id);

                    const uiNotification = userUINotification.uiNotification;
                    const uiMessage = uiNotification.composeMessageForUser(userUINotification.user);

                    // Add new user notification record
                    this.added('UserNotification', doc._id, {
                        category: uiNotification.category,
                        urgency: uiNotification.urgency,
                        title: uiMessage.title,
                        message: {
                            full: uiMessage.body.ui.full,
                            excerpt: uiMessage.body.ui.excerpt,
                        },
                        expirationDate: uiNotification.expirationDate,
                        issuedDate: userUINotification.createdDate,
                        status: userUINotification.status,
                    });
                },
                changed: (newDoc, oldDoc) => {
                    if (newDoc.status !== oldDoc.status) {
                        // Status has changed. Update it upstream
                        this.changed('UserNotification', newDoc._id, {
                            status: newDoc.status
                        });
                    }
                },
                removed: (doc) => {
                    // Remove user notification record
                    this.removed('UserNotification', doc._id);
                }
            });

            this.ready();

            this.onStop(() => observeHandle.stop());
        }
        else {
            // User not logged in.
            //  Make sure that publication is not started and throw exception
            this.stop();
            throw new Meteor.Error('ctn_user_no_permission', 'No permission; must be logged in to perform this task');
        }
    });

    Meteor.publish('userNotificationRecord', function (userUINotification_id) {
        if (this.userId) {
            // Retrieve non-deleted ui notification
            const observeHandle = Catenis.db.collection.UserUINotification.find({
                _id: userUINotification_id,
                status: {
                    $ne: UserUINotification.userNotificationStatus.deleted.name
                }
            })
            .observe({
                added: (doc) => {
                    // Instantiate user UI notification
                    const userUINotification = UserUINotification.getUserUINotificationByDocId(doc._id);

                    const uiNotification = userUINotification.uiNotification;
                    const uiMessage = uiNotification.composeMessageForUser(userUINotification.user);

                    // Add new user notification record
                    this.added('UserNotification', doc._id, {
                        category: uiNotification.category,
                        urgency: uiNotification.urgency,
                        title: uiMessage.title,
                        message: {
                            full: uiMessage.body.ui.full,
                            excerpt: uiMessage.body.ui.excerpt,
                        },
                        expirationDate: uiNotification.expirationDate,
                        issuedDate: userUINotification.createdDate,
                        status: userUINotification.status,
                    });
                },
                changed: (newDoc, oldDoc) => {
                    if (newDoc.status !== oldDoc.status) {
                        // Status has changed. Update it upstream
                        this.changed('UserNotification', newDoc._id, {
                            status: newDoc.status
                        });
                    }
                },
                removed: (doc) => {
                    // Remove user notification record
                    this.removed('UserNotification', doc._id);
                }
            });

            this.ready();

            this.onStop(() => observeHandle.stop());
        }
        else {
            // User not logged in.
            //  Make sure that publication is not started and throw exception
            this.stop();
            throw new Meteor.Error('ctn_user_no_permission', 'No permission; must be logged in to perform this task');
        }
    });

    Meteor.publish('criticalUserNotifications', function () {
        if (this.userId) {
            const now = new Date();
            const docIds = new Set();

            // Retrieve unread ui notifications for current user
            const observeHandle = Catenis.db.collection.UserUINotification.find({
                user_id: this.userId,
                status: UserUINotification.userNotificationStatus.new.name
            }, {
                sort: {
                    createdDate: -1
                }
            })
            .observe({
                added: (doc) => {
                    // Instantiate user UI notification
                    const userUINotification = UserUINotification.getUserUINotificationByDocId(doc._id);

                    const uiNotification = userUINotification.uiNotification;

                    // Only take into account non-expired, critical notifications
                    if (uiNotification.urgency === UINotificationTemplateShared.notificationUrgency.critical.name
                            && uiNotification.expirationDate >= now) {
                        const uiMessage = uiNotification.composeMessageForUser(userUINotification.user);

                        // Add new user notification record
                        docIds.add(doc._id);
                        this.added('UserNotification', doc._id, {
                            category: uiNotification.category,
                            urgency: uiNotification.urgency,
                            title: uiMessage.title,
                            message: {
                                full: uiMessage.body.ui.full,
                                excerpt: uiMessage.body.ui.excerpt,
                            },
                            expirationDate: uiNotification.expirationDate,
                            issuedDate: userUINotification.createdDate,
                            status: userUINotification.status,
                        });
                    }
                },
                changed: (newDoc, oldDoc) => {
                    if (docIds.has(newDoc._id) && newDoc.status !== oldDoc.status) {
                        // Status has changed. Update it upstream
                        this.changed('UserNotification', newDoc._id, {
                            status: newDoc.status
                        });
                    }
                },
                removed: (doc) => {
                    if (docIds.has(doc._id)) {
                        // Remove user notification record
                        docIds.delete(doc._id);
                        this.removed('UserNotification', doc._id);
                    }
                }
            });

            this.ready();

            this.onStop(() => observeHandle.stop());
        }
        else {
            // User not logged in.
            //  Make sure that publication is not started and throw exception
            this.stop();
            throw new Meteor.Error('ctn_user_no_permission', 'No permission; must be logged in to perform this task');
        }
    });
};


// Module code
//

// Lock function class
Object.freeze(NotificationsUI);
