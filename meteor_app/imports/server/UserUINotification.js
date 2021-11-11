/**
 * Created by claudio on 2021-10-25
 */

//console.log('[UserUINotification.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
//import config from 'config';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { UserUINotificationShared } from '../both/UserUINotificationShared';
import { UINotification } from './UINotification';
import { CatenisUser } from './CatenisUser';
import { Util } from './Util';

/**
 * @typedef {Object} UserUINotifyEmailDelivery
 * @property {string} status
 * @property {Date} [sentDate]
 * @property {string} [error]
 */


// Definition of classes
//

// UserUINotification class
export class UserUINotification {
    // Class (public) properties
    //

    static userNotificationStatus = UserUINotificationShared.userNotificationStatus;
    static emailDeliveryStatus = Object.freeze({
        void: Object.freeze({
            name: 'void',
            description: 'The notification shall not be delivered via e-mail'
        }),
        pending: Object.freeze({
            name: 'pending',
            description: 'The delivery of the notification e-mail message is still pending'
        }),
        sent: Object.freeze({
            name: 'sent',
            description: 'The notification e-mail message has already been sent'
        }),
        error: Object.freeze({
            name: 'error',
            description: 'An error took place when sending the notification e-mail message'
        }),
        canceled: Object.freeze({
            name: 'canceled',
            description: 'The delivery of the notification e-mail message has been canceled'
        })
    });


    /**
     * Class constructor
     * @param {Object} docUserUINotification UserUINotification database collection doc/rec
     */
    constructor(docUserUINotification) {
        this.doc_id = docUserUINotification._id;
        this.uiNotification = UINotification.getUINotificationByDocId(docUserUINotification.uiNotification_id);
        this.user = new CatenisUser(docUserUINotification.user_id);
        /**
         * @type UserUINotifyEmailDelivery
         */
        this.emailDelivery = docUserUINotification.emailDelivery;
        this._status = docUserUINotification.status;
        this.createdDate = docUserUINotification.createdDate;
        this.lastStatusChangedDate = docUserUINotification.lastStatusChangedDate;
    }


    // Public object properties (getters/setters)
    //

    /**
     * Retrieve the current status of this user UI notification
     * @return {string}
     */
    get status() {
        return this._status;
    }

    get isRead() {
        return this._status === UserUINotification.userNotificationStatus.read.name;
    }

    get isDeleted() {
        return this._status === UserUINotification.userNotificationStatus.deleted.name;
    }


    // Public object methods
    //

    /**
     * Mark this UI notification as had already been read by the user
     */
    read() {
        this._resetStatus(UserUINotification.userNotificationStatus.read.name);
    }

    /**
     * Mark this UI notification as had been deleted by the user
     */
    delete() {
        this._resetStatus(UserUINotification.userNotificationStatus.deleted.name);
    }

    /**
     * Indicate that notification e-mail message has been sent
     * @param {Date} [date] Date and time when notification e-mail message has been sent
     */
    emailSent(date) {
        this._resetEmailDeliveryStatus(UserUINotification.emailDeliveryStatus.sent.name);
        this.emailDelivery.sentDate = date || new Date();

        this._saveEmailDelivery();
    }

    /**
     * Register the error that took place when sending the notification e-mail message
     * @param {string} error Error message
     */
    emailSendError(error) {
        this._resetEmailDeliveryStatus(UserUINotification.emailDeliveryStatus.error.name);
        this.emailDelivery.error = error;

        this._saveEmailDelivery();
    }

    /**
     * Indicate that notification e-mail message delivery has been canceled
     */
    emailCanceled() {
        this._resetEmailDeliveryStatus(UserUINotification.emailDeliveryStatus.canceled.name);

        this._saveEmailDelivery();
    }


    // Private object methods
    //

    /**
     * Reset the status of this user UI notification
     * @param {string} newStatus The new status
     * @private
     */
    _resetStatus(newStatus) {
        if (this._status !== newStatus) {
            // Note: this will throw in case of an inconsistent status change
            this._validateStatusChange(newStatus);

            this._saveStatus(newStatus);
        }
    }

    /**
     * Check if the current status of this user UI notification can be changed to a new status
     * @param newStatus The new intended status
     * @private
     */
    _validateStatusChange(newStatus) {
        let error = false;

        switch (newStatus) {
            case UserUINotification.userNotificationStatus.new.name:
                error = true;
                break;

            case UserUINotification.userNotificationStatus.read.name:
                if (this._status !== UserUINotification.userNotificationStatus.new.name) {
                    error = true;
                }
                break;

            case UserUINotification.userNotificationStatus.deleted.name:
                if (this._status !== UserUINotification.userNotificationStatus.new.name
                        && this._status !== UserUINotification.userNotificationStatus.read.name) {
                    error = true;
                }
                break;

            default:
                throw new Error(`Inconsistent user UI notification status change; unknown new status: ${newStatus}`);
        }

        if (error) {
            throw new Error(`Inconsistent user UI notification status change; current status: ${this._status}, new status: ${newStatus}`);
        }
    }

    /**
     * Reset the e-mail delivery status of this user UI notification
     * @param {string} newStatus The new status
     * @private
     */
    _resetEmailDeliveryStatus(newStatus) {
        this._validateEmailDeliveryStatusChange(newStatus);
        this.emailDelivery.status = newStatus;
    }

    /**
     * Check if the current e-mail delivery status of this user UI notification can be changed to a new status
     * @param newStatus The new intended status
     * @private
     */
    _validateEmailDeliveryStatusChange(newStatus) {
        let error = false;

        switch (newStatus) {
            case UserUINotification.emailDeliveryStatus.void.name:
                error = true;
                break;

            case UserUINotification.emailDeliveryStatus.pending.name:
                error = true;
                break;

            case UserUINotification.emailDeliveryStatus.sent.name:
                if (this.emailDelivery.status !== UserUINotification.emailDeliveryStatus.pending.name) {
                    error = true;
                }
                break;

            case UserUINotification.emailDeliveryStatus.error.name:
                if (this.emailDelivery.status !== UserUINotification.emailDeliveryStatus.sent.name) {
                    error = true;
                }
                break;

            case UserUINotification.emailDeliveryStatus.canceled.name:
                if (this.emailDelivery.status !== UserUINotification.emailDeliveryStatus.pending.name) {
                    error = true;
                }
                break;

            default:
                throw new Error(`Inconsistent user UI notification e-mail delivery status change; unknown new status: ${newStatus}`);
        }

        if (error) {
            throw new Error(`Inconsistent user UI notification e-mail delivery status change; current status: ${this.emailDelivery.status}, new status: ${newStatus}`);
        }
    }

    /**
     * Update the status of this user UI notification both on the local database and on this object
     * @param {string} status The new status to be updated
     * @private
     */
    _saveStatus(status) {
        const lastStatusChangedDate = new Date();

        try {
            Catenis.db.collection.UserUINotification.update({
                _id: this.doc_id
            }, {
                $set: {
                    status,
                    lastStatusChangedDate
                }
            });
        }
        catch (err) {
            // Error trying to update UserUINotification database doc/rec.
            //  Log error and throw exception
            Catenis.logger.ERROR('Error trying to update UserUINotification database doc/rec (status).', err);
            throw new Meteor.Error('ctn_user_ui_ntfy_update_error', `Error trying to update UserUINotificationTemplate database doc/rec: ${err}`);
        }

        // Update status locally
        this._status = status;
        this.lastStatusChangedDate = lastStatusChangedDate;
    }

    /**
     * Update the e-mail delivery information of this user UI notification on the local database
     * @private
     */
    _saveEmailDelivery() {
        try {
            Catenis.db.collection.UserUINotification.update({
                _id: this.doc_id
            }, {
                $set: {
                    emailDelivery: this.emailDelivery
                }
            });
        }
        catch (err) {
            // Error trying to update UserUINotification database doc/rec.
            //  Log error and throw exception
            Catenis.logger.ERROR('Error trying to update UserUINotification database doc/rec (emailDelivery).', err);
            throw new Meteor.Error('ctn_user_ui_ntfy_update_error', `Error trying to update UserUINotificationTemplate database doc/rec: ${err}`);
        }
    }


    // Class (public) methods
    //

    /**
     * Create a new user UI notification
     * @param {(UINotification|string)} uiNotification
     * @param {(CatenisUser|string)} user
     * @param {boolean} [instantiateIt=true]
     * @return {Object} Newly created user UI notification
     */
    static createNew(uiNotification, user, instantiateIt = true) {
        // Validate arguments
        const errArg = {};

        if (!(uiNotification instanceof UINotification) && !Util.isNonBlankString(uiNotification)) {
            errArg.uiNotification = uiNotification;
        }

        if (!(user instanceof CatenisUser) && !Util.isNonBlankString(user)) {
            errArg.user = user;
        }

        if (Object.keys(errArg).length > 0) {
            const errArgs = Object.keys(errArg);

            Catenis.logger.ERROR(`UserUINotification.createNew() method called with invalid argument${errArgs.length > 1 ? 's' : ''}`, errArg);
            throw new TypeError(`Invalid ${errArgs.join(', ')} argument${errArgs.length > 1 ? 's' : ''}`);
        }

        if (typeof uiNotification === 'string') {
            // Assume that a UI notification ID was passed instead. So try
            //  to instantiate the UI notification
            uiNotification = UINotification.getUINotificationByDocId(uiNotification);
        }

        if (typeof user === 'string') {
            // Assume that a user ID was passed instead. So try to instantiate the Catenis user
            user = new CatenisUser(user);
        }

        const docUserUINotification = {
            uiNotification_id: uiNotification.doc_id,
            user_id: user.user_id,
            emailDelivery: {
                status: uiNotification.sendViaEmail
                    ? UserUINotification.emailDeliveryStatus.pending.name
                    : UserUINotification.emailDeliveryStatus.void.name
            },
            status: UserUINotification.userNotificationStatus.new.name,
            createdDate: new Date()
        };

        try {
            docUserUINotification._id = Catenis.db.collection.UserUINotification.insert(docUserUINotification);
        }
        catch (err) {
            // Error inserting doc/rec
            Catenis.logger.ERROR('Error trying to create new user UI notification.', err);
            throw new Meteor.Error('ctn_user_ui_ntfy_insert_error', 'Error trying to create new user UI notification', err.stack);
        }

        return instantiateIt ? new UserUINotification(docUserUINotification) : docUserUINotification;
    }

    /**
     * Get user UI notification by database doc/rec ID
     * @param {string} doc_id
     * @return {UserUINotification}
     */
    static getUserUINotificationByDocId(doc_id) {
        // Retrieve UINotification doc/rec
        const docUserUINotification = Catenis.db.collection.UserUINotification.findOne({
            _id: doc_id
        });

        if (docUserUINotification === undefined) {
            // No user UI notification available with the given database doc/rec ID. Throw exception
            throw new Meteor.Error('ctn_user_ui_ntfy_not_found', 'Could not find user UI notification with the given database doc/rec ID');
        }

        return new UserUINotification(docUserUINotification);
    }

    /**
     * Process notification e-mail messages the delivery of which is pending
     */
    static processPendingEmails() {
        // Retrieve user UI notifications with pending e-mail delivery
        Catenis.db.collection.UserUINotification.find({
            'emailDelivery.status': UserUINotification.emailDeliveryStatus.pending.name
        })
        .fetch()
        .forEach(doc => {
            try {
                // Instantiate user UI notification
                const userUINotification = new UserUINotification(doc);

                if (userUINotification.user.isDeletedClient) {
                    // User is a deleted client. Cancel e-mail delivery
                    userUINotification.emailCanceled();
                }
                else {
                    // Send notification e-mail message
                    userUINotification.uiNotification.sendEmailMessageToUserAsync(userUINotification.user, (err) => {
                        if (err) {
                            // Error sending notification e-mail message
                            if ((err instanceof Error) && err.message.endsWith('user is a deleted client')) {
                                // Failed because user is a deleted client. So just cancel e-mail delivery
                                userUINotification.emailCanceled();
                            }
                            else {
                                // Any other error, just record it
                                userUINotification.emailSendError(err.toString());
                            }
                        }
                    });

                    // Indicate that e-mail has been sent
                    userUINotification.emailSent(new Date());
                }
            }
            catch (err) {
                Catenis.logger.ERROR('Error processing user UI notification (doc_id: %s) with pending e-mail delivery.', doc._id, err);
            }
        });
    }

    static initialize() {
        Catenis.logger.TRACE('UserUINotification initialization');
        // Process any pending notification e-mail messages
        this.processPendingEmails();
    }
}


// Module code
//

// Lock class
Object.freeze(UserUINotification);
