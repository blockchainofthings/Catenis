/**
 * Created by claudio on 2021-10-21
 */

//console.log('[UINotification.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import config from 'config';
import moment from 'moment-timezone';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { UINotificationShared } from '../both/UINotificationShared';
import { UINotificationTemplate } from './UINotificationTemplate';
import { CatenisUser } from './CatenisUser';
import { UserUINotification } from './UserUINotification';
import { Client } from './Client';
import { Util } from './Util';

// Config entries
const uiNotifyConfig = config.get('uiNotification');

// Configuration settings
export const cfgSettings = {
    refTimeZone: uiNotifyConfig.get('refTimeZone'),
    fromAddress: uiNotifyConfig.get('fromAddress'),
    replyAddress: uiNotifyConfig.get('replyAddress'),
    emailHtmlTemplate: uiNotifyConfig.get('emailHtmlTemplate'),
    emailTextTemplate: uiNotifyConfig.get('emailTextTemplate')
};

/**
 * @typedef {Object} UINotifyDataInfo
 * @property {string} [name]
 * @property {UINotifyContentsStaticFieldsValue} [contentsStaticFieldsValue]
 * @property {Date} [expirationDate]
 */


// Definition of classes
//

/**
 * UI notification class
 */
export class UINotification {
    // Class (public) properties
    //

    static notificationStatus = UINotificationShared.notificationStatus;


    /**
     * Class constructor
     * @param {Object} docUINotification UINotification database collection doc/rec
     */
    constructor(docUINotification) {
        this.doc_id = docUINotification._id;
        this.uiNotificationTemplate = UINotificationTemplate.getUINotificationTemplateByDocId(
            docUINotification.uiNotificationTemplate_id,
            true
        );
        this.name = docUINotification.name;
        /**
         * @type UINotifyContentsStaticFieldsValue
         */
        this.contentsStaticFieldsValue = docUINotification.contentsStaticFieldsValue;
        this._contents = undefined;
        this.expirationDate = docUINotification.expirationDate;
        this._status = docUINotification.status;
        this.createdDate = docUINotification.createdDate;
        this.lastStatusChangedDate = docUINotification.lastStatusChangedDate;

        try {
            this.uiNotificationTemplate.checkContentsStaticFieldsValue(this.contentsStaticFieldsValue);
        }
        catch (err) {
            if ((err instanceof TypeError) && err.message === 'Inconsistent UI notification template contents static fields value') {
                // Contents static fields value are not consistent.
                //  Reset status indicating that UI notification is outdated
                this._resetStatus(UINotification.notificationStatus.outdated.name);
            }
            else {
                throw err;
            }
        }
    }


    // Public object properties (getters/setters)
    //

    /**
     * Retrieve the current status of this UI notification
     * @return {string}
     */
    get status() {
        return this._status;
    }

    /**
     * Indicate whether this UI notification is a draft
     * @return {boolean}
     */
    get isDraft() {
        return this._status === UINotification.notificationStatus.draft.name;
    }

    /**
     * Indicate whether this UI notification is currently outdated
     * @return {boolean}
     */
    get isOutdated() {
        return this._status === UINotification.notificationStatus.outdated.name;
    }

    /**
     * Indicate whether this UI notification has already been issued
     * @return {boolean}
     */
    get hasBeenIssued() {
        return this._status === UINotification.notificationStatus.issued.name;
    }

    /**
     * Retrieve the notification category
     * @return {string}
     */
    get category() {
        return this.uiNotificationTemplate.category;
    }

    /**
     * Retrieve the notification urgency
     * @return {string}
     */
    get urgency() {
        return this.uiNotificationTemplate.urgency;
    }

    /**
     * Retrieve the indication whether the notification should also be sent via e-mail
     * @return {boolean}
     */
    get sendViaEmail() {
        return this.uiNotificationTemplate.sendViaEmail;
    }

    /**
     * Retrieve the title of the notification
     * @return {string}
     */
    get title() {
        return this.uiNotificationTemplate.title;
    }

    /**
     * Retrieve the notification target
     * @return {UINotifyTarget}
     */
    get target() {
        return this.uiNotificationTemplate.target;
    }

    /**
     * Retrieve the contents of the notification
     * @return {UINotifyRenderedContents}
     */
    get contents() {
        if (!this.isOutdated) {
            if (!this._contents) {
                this._contents = this.uiNotificationTemplate.renderContents(this.contentsStaticFieldsValue);
            }

            return this._contents;
        }
    }


    // Public object methods
    //

    /**
     * Issue this UI notification
     */
    issue() {
        // Change status and...
        this._resetStatus(UINotification.notificationStatus.issued.name);

        // Create user UI notification for each target Catenis user
        let userUINotificationCreated = false;

        this._listTargetUserIds().forEach(user_id => {
            try {
                UserUINotification.createNew(this, user_id, false);
                userUINotificationCreated = true;
            }
            catch (err) {
                Catenis.logger.ERROR('Error issuing UI notification for Catenis user (user ID: %s).', user_id, err);
            }
        });

        if (userUINotificationCreated && this.sendViaEmail) {
            // Go process notification e-mail messages
            UserUINotification.processPendingEmails();
        }
    }

    /**
     * Update the data info of this UI notification
     * @param {*} info The updated UI notification data info
     */
    updateInfo(info) {
        // Make sure that data info can be update
        if (!this.isDraft && !this.isOutdated) {
            throw new Error('Unable to update UI notification data info; notification is neither in draft nor outdated');
        }

        // Note: this will throw in case of an inconsistent UI notification data info
        checkUINotificationInfo(info, this.uiNotificationTemplate, true);

        // Check if there was any changes in the UI notification template's data info
        const diffInfo = this._diffInfo(info);

        if (diffInfo) {
            // Save the changes
            this._saveInfo(diffInfo);

            if (diffInfo.contentsStaticFieldsValue) {
                // Contents static fields value of UI notification have been updated.
                //  Make sure that 'contents' property is reset
                this._contents = undefined;

                if (this.isOutdated) {
                    // Also, reset status back to draft if it was outdated
                    this._resetStatus(UINotification.notificationStatus.draft.name);
                }
            }
        }
    }

    /**
     * Compose the notification message for a given Catenis user
     * @param {(CatenisUser|string)} user
     * @param {Object} [opts]
     * @param {boolean} [opts.uiMessage=true]
     * @param {boolean} [opts.emailMessage=false]
     * @return {{title: string, body: {ui?: string, email?: {html: string, text: string}}}}
     */
    composeMessageForUser(user, opts) {
        if (!(user instanceof CatenisUser)) {
            // Assume that a user ID was passed instead. So try to instantiate
            //  the Catenis user
            user = new CatenisUser(user);
        }

        opts = opts || {
            uiMessage: true,
            emailMessage: false
        };

        if (!opts.uiMessage && !opts.emailMessage) {
            Catenis.logger.ERROR('Unable to compose UI notification message for Catenis user; no message type selected.', {
                user,
                uiNotification: this,
            });
            throw new Error('Unable to compose UI notification message for Catenis user; no message type selected');
        }
        
        const message = {
            title: this.title,
            body: {}
        };
        const htmlBody = mergeUserFields(this.contents.body.html, user);

        if (opts.uiMessage) {
            message.body.ui = htmlBody;
        }

        if (opts.emailMessage) {
            if (!this.contents.email) {
                Catenis.logger.ERROR('Unable to compose UI notification e-mail message for Catenis user; no contents for e-mail is defined.', {
                    user,
                    uiNotification: this,
                });
                throw new Error('Unable to compose UI notification e-mail message for Catenis user; no contents for e-mail is defined');
            }
            
            message.body.email = {};
            let htmlEmailSalutation;
            let textEmailSalutation;

            if (user.isClient) {
                if (!this.contents.email.salutation.client) {
                    Catenis.logger.ERROR('Unable to compose UI notification e-mail message for Catenis client user; no salutation is defined for client user.', {
                        user,
                        uiNotification: this,
                    });
                    throw new Error('Unable to compose UI notification e-mail message for Catenis client user; no salutation is defined for client user');
                }

                htmlEmailSalutation = mergeUserFields(this.contents.email.salutation.client.html, user);
                textEmailSalutation = mergeUserFields(this.contents.email.salutation.client.text, user);
            }
            else {
                if (!this.contents.email.salutation.nonClient) {
                    Catenis.logger.ERROR('Unable to compose UI notification e-mail message for Catenis non-client user; no salutation is defined for non-client user.', {
                        user,
                        uiNotification: this,
                    });
                    throw new Error('Unable to compose UI notification e-mail message for Catenis non-client user; no salutation is defined for non-client user');
                }

                htmlEmailSalutation = mergeUserFields(this.contents.email.salutation.nonClient.html, user);
                textEmailSalutation = mergeUserFields(this.contents.email.salutation.nonClient.text, user);
            }

            message.body.email.html = mergeEmailFields(
                cfgSettings.emailHtmlTemplate,
                htmlEmailSalutation,
                htmlBody,
                mergeUserFields(this.contents.email.signature.html, user)
            );
            message.body.email.text = mergeEmailFields(
                cfgSettings.emailTextTemplate,
                textEmailSalutation,
                mergeUserFields(this.contents.body.text, user),
                mergeUserFields(this.contents.email.signature.text, user)
            );
        }
        
        return message;
    }

    /**
     * Send UI notification message via e-mail to a given Catenis user
     * @param {(CatenisUser|string)} user
     * @param {{title: string, body: {ui?: string, email?: {html: string, text: string}}}} [composedMessage]
     */
    sendEmailMessageToUser(user, composedMessage) {
        if (!(user instanceof CatenisUser)) {
            // Assume that a user ID was passed instead. So try to instantiate
            //  the Catenis user
            user = new CatenisUser(user);
        }

        // Make sure that we are not trying to send and e-mail to a deleted client
        if (user.isDeletedClient) {
            Catenis.logger.ERROR('Unable to send UI notification e-mail message to Catenis user; user is a deleted client.', {
                user,
                composedMessage
            });
            throw new Error('Unable to send UI notification e-mail message to Catenis user; user is a deleted client');
        }

        if (composedMessage) {
            checkComposedMessage(composedMessage);

            if (!composedMessage.body.email) {
                Catenis.logger.ERROR('Unable to send UI notification e-mail message to Catenis user; message is not defined to be sent via e-mail.', {
                    user,
                    composedMessage
                });
                throw new Error('Unable to send UI notification e-mail message to Catenis user; message is not defined to be sent via e-mail');
            }
        }
        else {
            composedMessage = this.composeMessageForUser(user, {emailMessage: true});
        }

        user.sendEmail(
            composedMessage.title,
            composedMessage.body.email,
            cfgSettings.fromAddress,
            cfgSettings.replyAddress
        );
    }

    /**
     * Send UI notification message via e-mail to a given Catenis user asynchronously
     * @param {(CatenisUser|string)} user
     * @param {({title: string, body: {ui?: string, email?: {html: string, text: string}}}|Function)} [composedMessage]
     * @param {(Function|undefined)} callback
     */
    sendEmailMessageToUserAsync(user, composedMessage, callback) {
        try {
            if (typeof composedMessage === 'function') {
                callback = composedMessage;
                composedMessage = undefined;
            }

            if (!(user instanceof CatenisUser)) {
                // Assume that a user ID was passed instead. So try to instantiate
                //  the Catenis user
                user = new CatenisUser(user);
            }

            // Make sure that we are not trying to send and e-mail to a deleted client
            if (user.isDeletedClient) {
                Catenis.logger.ERROR('Unable to send UI notification e-mail message to Catenis user; user is a deleted client.', {
                    user,
                    composedMessage
                });
                return Meteor.defer(() => {
                    callback(new Error('Unable to send UI notification e-mail message to Catenis user; user is a deleted client'));
                });
            }

            if (composedMessage) {
                checkComposedMessage(composedMessage);

                if (!composedMessage.body.email) {
                    Catenis.logger.ERROR('Unable to send UI notification e-mail message to Catenis user; message is not defined to be sent via e-mail.', {
                        user,
                        composedMessage
                    });
                    return Meteor.defer(() => {
                        callback(new Error('Unable to send UI notification e-mail message to Catenis user; message is not defined to be sent via e-mail'));
                    });
                }
            }
            else {
                composedMessage = this.composeMessageForUser(user, {emailMessage: true});
            }

            user.sendEmailAsync(
                composedMessage.title,
                composedMessage.body.email,
                cfgSettings.fromAddress,
                cfgSettings.replyAddress,
                callback
            );
        }
        catch (err) {
            return Meteor.defer(() => {
                callback(err);
            });
        }
    }


    // Private object methods
    //

    /**
     * Reset the status of this UI notification template
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
     * Check if the current status of this UI notification can be changed to a new status
     * @param newStatus The new intended status
     * @private
     */
    _validateStatusChange(newStatus) {
        let error = false;

        switch (newStatus) {
            case UINotification.notificationStatus.draft.name:
                if (this._status !== UINotification.notificationStatus.outdated.name) {
                    error = true;
                }
                break;

            case UINotification.notificationStatus.outdated.name:
                if (this._status !== UINotification.notificationStatus.draft.name) {
                    error = true;
                }
                break;

            case UINotification.notificationStatus.issued.name:
                if (this._status !== UINotification.notificationStatus.draft.name) {
                    error = true;
                }
                else if (!this.uiNotificationTemplate.isActive) {
                    throw new Error('Inconsistent UI notification status change; template not yet active');
                }
                break;

            default:
                throw new Error(`Inconsistent UI notification status change; unknown new status: ${newStatus}`);
        }

        if (error) {
            throw new Error(`Inconsistent UI notification status change; current status: ${this._status}, new status: ${newStatus}`);
        }
    }

    /**
     * Compares the supplied UI notification data info with this UI notification template
     *  and returns an object with the difference between them
     * @param {UINotifyDataInfo} info UI notification data info
     * @return {(UINotifyDataInfo|undefined)}
     * @private
     */
    _diffInfo(info) {
        const diff = {};

        if (('name' in info) && info.name !== this.name) {
            diff.name = info.name;
        }

        if (('contentsStaticFieldsValue' in info) && areContentsStaticFieldsValueDifferent(info.contentsStaticFieldsValue, this.contentsStaticFieldsValue)) {
            diff.contentsStaticFieldsValue = info.contentsStaticFieldsValue;
        }

        if (('expirationDate' in info) && ((info.expirationDate == null && this.expirationDate != null)
                || (info.expirationDate != null && this.expirationDate == null)
                || info.expirationDate !== this.expirationDate)) {
            diff.expirationDate = info.expirationDate == null ? null : info.expirationDate;
        }

        return Object.keys(diff).length > 0 ? diff : undefined;
    }

    /**
     * Update the status of this UI notification both on the local database and on this object
     * @param {string} status The new status to be updated
     * @private
     */
    _saveStatus(status) {
        const lastStatusChangedDate = new Date();

        try {
            Catenis.db.collection.UINotification.update({
                _id: this.doc_id
            }, {
                $set: {
                    status,
                    lastStatusChangedDate
                }
            });
        }
        catch (err) {
            // Error trying to update UINotification database doc/rec.
            //  Log error and throw exception
            Catenis.logger.ERROR('Error trying to update UINotification database doc/rec (status).', err);
            throw new Meteor.Error('ctn_ui_ntfy_update_error', `Error trying to update UINotificationTemplate database doc/rec: ${err}`);
        }

        // Update status locally
        this._status = status;
        this.lastStatusChangedDate = lastStatusChangedDate;
    }

    /**
     * Update the data info of this UI notification both on the local database and on this object
     * @param {UINotifyDataInfo} info The UI notification data info
     * @private
     */
    _saveInfo(info) {
        try {
            // Update the database doc/rec with the new data info
            Catenis.db.collection.UINotification.update({
                _id: this.doc_id
            }, {
                $set: info
            });
        }
        catch (err) {
            if ((err.name === 'MongoError' || err.name === 'BulkWriteError') && err.code === 11000 && err.errmsg.search(/index:\s+name/) >= 0) {
                // Duplicate name error.
                throw new Meteor.Error('ctn_ui_ntfy_duplicate_name', 'Cannot update UI notification; the assigned name is already in use', err.stack);
            }
            else {
                // Any other error updating UINotification database doc/rec.
                //  Log error and throw exception
                Catenis.logger.ERROR('Error trying to update UINotification database doc/rec (contents).', err);
                throw new Meteor.Error('ctn_ui_ntfy_update_error', `Error trying to update UINotification database doc/rec: ${err}`);
            }
        }

        // Update the data info locally
        for (const data in info) {
            this[data] = info[data];
        }
    }

    /**
     * List the user IDs of all the targets of this notification
     * @return {string[]}
     * @private
     */
    _listTargetUserIds() {
        let userIds = [];

        if (this.target.activeClients || this.target.newClients) {
            userIds = Client.listClientUserIds(this.target.activeClients, this.target.newClients);
        }

        if (this.target.adminUsers) {
            userIds = userIds.concat(CatenisUser.listSysAdminUserIds());
        }

        return userIds;
    }


    // Class (public) methods
    //

    /**
     * Create a new UI notification
     * @param {(UINotificationTemplate|string)} uiNotificationTemplate
     * @param {string} name
     * @param {UINotifyContentsStaticFieldsValue} contentsStaticFieldsValue
     * @param {Date} [expirationDate]
     * @return {UINotification}
     */
    static createNew(uiNotificationTemplate, name, contentsStaticFieldsValue, expirationDate) {
        // Validate arguments
        const errArg = {};

        if (!(uiNotificationTemplate instanceof UINotificationTemplate)
                && !Util.isNonBlankString(uiNotificationTemplate)) {
            errArg.uiNotificationTemplate = uiNotificationTemplate;
        }

        try {
            checkUINotificationInfo({
                name,
                contentsStaticFieldsValue,
                expirationDate
            }, uiNotificationTemplate);
        }
        catch (err) {
            for (const data in err.errData) {
                errArg[data] = err.errData[data];
            }
        }

        if (Object.keys(errArg).length > 0) {
            const errArgs = Object.keys(errArg);

            Catenis.logger.ERROR(`UINotification.createNew() method called with invalid argument${errArgs.length > 1 ? 's' : ''}`, errArg);
            throw new TypeError(`Invalid ${errArgs.join(', ')} argument${errArgs.length > 1 ? 's' : ''}`);
        }

        if (typeof uiNotificationTemplate === 'string') {
            // Assume that a UI notification template ID was passed instead. So try
            //  to instantiate the UI notification template
            uiNotificationTemplate = UINotificationTemplate.getUINotificationTemplateByDocId(uiNotificationTemplate);
        }

        const docUINotification = {
            uiNotificationTemplate_id: uiNotificationTemplate.doc_id,
            name,
            contentsStaticFieldsValue
        };

        if (expirationDate) {
            docUINotification.expirationDate = expirationDate;
        }

        docUINotification.status = this.notificationStatus.draft.name;
        docUINotification.createdDate = new Date();

        try {
            docUINotification._id = Catenis.db.collection.UINotification.insert(docUINotification);
        }
        catch (err) {
            if ((err.name === 'MongoError' || err.name === 'BulkWriteError') && err.code === 11000 && err.errmsg.search(/index:\s+name/) >= 0) {
                // Duplicate name error.
                throw new Meteor.Error('ctn_ui_ntfy_duplicate_name', 'Cannot create UI notification; the assigned name is already in use', err.stack);
            }
            else {
                // Any other error inserting doc/rec
                Catenis.logger.ERROR('Error trying to create new UI notification.', err);
                throw new Meteor.Error('ctn_ui_ntfy_insert_error', 'Error trying to create new UI notification', err.stack);
            }
        }

        return new UINotification(docUINotification);
    }

    /**
     * Get UI notification by name
     * @param {string} name
     * @return {UINotification}
     */
    static getUINotificationByName(name) {
        // Retrieve UINotification doc/rec
        const docUINotification = Catenis.db.collection.UINotification.findOne({
            name
        });

        if (docUINotification === undefined) {
            // No UI notification available with the given name. Throw exception
            throw new Meteor.Error('ctn_ui_ntfy_not_found', 'Could not find UI notification with the given name');
        }

        return new UINotification(docUINotification);
    }

    /**
     * Get UI notification by database doc/rec ID
     * @param {string} doc_id
     * @return {UINotification}
     */
    static getUINotificationByDocId(doc_id) {
        // Retrieve UINotification doc/rec
        const docUINotification = Catenis.db.collection.UINotification.findOne({
            _id: doc_id
        });

        if (docUINotification === undefined) {
            // No UI notification available with the given database doc/rec ID. Throw exception
            throw new Meteor.Error('ctn_ui_ntfy_not_found', 'Could not find UI notification with the given database doc/rec ID');
        }

        return new UINotification(docUINotification);
    }
}


// Definition of module (private) functions
//

/**
 * Check if the supplied value if a valid UI notification composed message
 * @param {*} message
 */
function checkComposedMessage(message) {
    let isValid = false;

    if (Util.isNonNullObject(message) && typeof message.title === 'string' && Util.isNonNullObject(message.body)) {
        if (('ui' in message.body) || ('email' in message.body)) {
            if (!('ui' in message.body) || typeof message.body.ui === 'string') {
                if (!('email' in message.body) || (Util.isNonNullObject(message.body.email)
                        && typeof message.body.email.html === 'string' && typeof message.body.email.text === 'string')) {
                    isValid = true;
                }
            }
        }
    }

    if (!isValid) {
        throw new TypeError('Inconsistent UI notification composed message');
    }
}

/**
 * Check whether two static fields value dictionaries (object with field names and their values) are different
 * @param {UINotifyStaticFieldsValue} sfv1 First static fields value dictionary
 * @param {UINotifyStaticFieldsValue} sfv2 Second static fields value dictionary
 * @return {boolean}
 */
function areStaticFieldsValueDifferent(sfv1, sfv2) {
    const keys1 = Object.keys(sfv1);
    const keys2 = Object.keys(sfv2);
    
    return keys1.length !== keys2.length || keys1.some(key => !(key in sfv2) || sfv1[key] !== sfv2[key]);
}

/**
 * Check whether two sets of UI notification contents static fields value are different 
 * @param {UINotifyContentsStaticFieldsValue} csfv1 First contents static fields value
 * @param {UINotifyContentsStaticFieldsValue} csfv2 Second contents static fields value
 * @return {boolean}
 */
function areContentsStaticFieldsValueDifferent(csfv1, csfv2) {
    let changed = (csfv1.body && !csfv2.body) || (!csfv1.body && csfv2.body)
        || (csfv1.body && areStaticFieldsValueDifferent(csfv1.body, csfv2.body));
    
    if (!changed) {
        changed = (csfv1.email && !csfv2.email) || (!csfv1.email && csfv2.email);

        if (!changed && csfv1.email) {
            changed = (csfv1.email.signature && !csfv2.email.signature)
                || (!csfv1.email.signature && csfv2.email.signature)
                || (csfv1.email.signature
                && areStaticFieldsValueDifferent(csfv1.email.signature, csfv2.email.signature));

            if (!changed) {
                changed = (csfv1.email.salutation && !csfv2.email.salutation)
                    || (!csfv1.email.salutation && csfv2.email.salutation);

                if (!changed && csfv1.email.salutation) {
                    changed = (csfv1.email.salutation.client && !csfv2.email.salutation.client)
                        || (!csfv1.email.salutation.client && csfv2.email.salutation.client)
                        || (csfv1.email.salutation.client
                        && areStaticFieldsValueDifferent(csfv1.email.salutation.client, csfv2.email.salutation.client));

                    if (!changed) {
                        changed = (csfv1.email.salutation.nonClient && !csfv2.email.salutation.nonClient)
                            || (!csfv1.email.salutation.nonClient && csfv2.email.salutation.nonClient)
                            || (csfv1.email.salutation.nonClient
                            && areStaticFieldsValueDifferent(csfv1.email.salutation.nonClient, csfv2.email.salutation.nonClient));
                    }
                }
            }
        }
    }
    
    return changed;
}

/**
 * Check if the supplied value is a valid UI notification data info
 * @param {*} info
 * @param {UINotificationTemplate} uiNotificationTemplate The UI notification template against which the contents static fields value of the info should be validated
 * @param {boolean} isPartial Indicates whether the supplied value may be only a partial UI notification
 *                             data info; in other words, have missing data fields
 */
function checkUINotificationInfo(info, uiNotificationTemplate, isPartial = false) {
    if (!Util.isNonNullObject(info)) {
        throw new TypeError('Inconsistent UI notification data info');
    }

    // Validate the supplied data
    const errData = {};

    if (!((isPartial && !('name' in info)) || (('name' in info) && Util.isNonBlankString(info.name)))) {
        errData.name = info.name;
    }

    function isValidContentsStaticFieldsValue(contentsStaticFieldsValue) {
        let error = false;

        try {
            uiNotificationTemplate.checkContentsStaticFieldsValue(contentsStaticFieldsValue);
        }
        catch (err) {
            error = true;
        }

        return !error;
    }

    if (!((isPartial && !('contentsStaticFieldsValue' in info)) || (('contentsStaticFieldsValue' in info)
            && isValidContentsStaticFieldsValue(info.contentsStaticFieldsValue)))) {
        errData.contentsStaticFieldsValue = info.contentsStaticFieldsValue;
    }

    if (!((isPartial && !('expirationDate' in info)) || (('expirationDate' in info) && (info.expirationDate == null
            || (info.expirationDate instanceof Date))))) {
        errData.expirationDate = info.expirationDate;
    }

    if (Object.keys(errData).length > 0) {
        const error = new TypeError(`Inconsistent UI notification data info; invalid data fields: ${Object.keys(errData).join(', ')}`);
        error.errData = errData;

        throw error;
    }
}

/**
 * Assemble a notification e-mail message by replacing the fields in a supplied template
 * @param {string} template The template for the e-mail message
 * @param {string} salutation The contents to be replaced for the salutation field
 * @param {string} body The contents to be replaced for the the body field
 * @param {string} signature The contents to be replaced for the signature field
 * @return {string} The final e-mail message
 */
function mergeEmailFields(template, salutation, body, signature) {
    const fields = {
        salutation,
        body,
        signature
    };

    function lookUp(field) {
        return (field in fields) ? fields[field] : '';
    }

    let emailMessage = template;

    // Note: we need to iterate over the matches in reverse order to not throw off their indices
    //  after replacing the matched substring
    for (const match of Array.from(template.matchAll(/{!([A-Za-z_][A-Za-z_0-9]*)}/g)).reverse()) {
        emailMessage = emailMessage.substring(0, match.index) + lookUp(match[1]) + emailMessage.substring(match.index + match[0].length);
    }

    return emailMessage;
}

/**
 * Replace embedded fields contained in message with the corresponding Catenis user value
 * @param {string} message
 * @param {CatenisUser} user
 */
export function mergeUserFields(message, user) {
    let mergedMessage = message;

    // Note: we need to iterate over the matches in reverse order to not throw off their indices
    //  after replacing the matched substring
    for (const match of Array.from(message.matchAll(/{!([A-Za-z_][A-Za-z_0-9]*\.[A-Za-z_][A-Za-z_0-9]*)}/g)).reverse()) {
        mergedMessage = mergedMessage.substring(0, match.index) + user.lookUp(match[1]) + mergedMessage.substring(match.index + match[0].length);
    }

    return mergedMessage;
}

/**
 * Parse a date to be used as the notification expiration date taking into account the reference time zone
 * @param {string} date The date to be parse in the expect format: YYYY-MM-DD
 * @return {Date} The parsed date
 */
export function parseExpirationDate(date) {
    const mt = moment(date, 'YYYY-MM-DD', true);

    if (!mt.isValid()) {
        throw new TypeError('Invalid date');
    }

    return Util.dateReferenceTimeZone(mt, cfgSettings.refTimeZone);
}


// Module code
//

// Lock class
Object.freeze(UINotification);
