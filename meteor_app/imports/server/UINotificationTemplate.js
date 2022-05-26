/**
 * Created by claudio on 2021-10-13
 */

//console.log('[UINotificationTemplate.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
//import config from 'config';
import Delta from 'quill-delta';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { UINotificationTemplateShared } from '../both/UINotificationTemplateShared';
import { QuillConverter } from './QuillConverter';
import { UINotification } from './UINotification';
import { Util } from './Util';

// Config entries
/*const config_entryConfig = config.get('config_entry');

// Configuration settings
const cfgSettings = {
    property: config_entryConfig.get('property_name')
};*/

/**
 * @typedef {Object} UINotifySerializedEmailContents
 * @property {Object} salutation
 * @property {string} [salutation.client]
 * @property {string} [salutation.nonClient]
 * @property {string} signature
 */
/**
 * @typedef {Object} UINotifySerializedContents
 * @property {string} body
 * @property {UINotifySerializedEmailContents} [email]
 */

/**
 * @typedef {Object} UINotifyDeserializedEmailContents
 * @property {Object} salutation
 * @property {Delta} [salutation.client]
 * @property {Delta} [salutation.nonClient]
 * @property {Delta} signature
 */
/**
 * @typedef {Object} UINotifyDeserializedContents
 * @property {Delta} body
 * @property {UINotifyDeserializedEmailContents} [email]
 */

/**
 * @typedef {Object} UINotifyContentsStaticFields
 * @property {string[]} [body]
 * @property {Object} [email]
 * @property {Object} [email.salutation]
 * @property {string[]} [email.salutation.client]
 * @property {string[]} [email.salutation.nonClient]
 * @property {string[]} [email.signature]
 */

/**
 * @typedef {Object.<string, string>} UINotifyStaticFieldsValue
 */

/**
 * @typedef {Object} UINotifyContentsStaticFieldsValue
 * @property {UINotifyStaticFieldsValue} [body]
 * @property {Object} [email]
 * @property {Object} [email.salutation]
 * @property {UINotifyStaticFieldsValue} [email.salutation.client]
 * @property {UINotifyStaticFieldsValue} [email.salutation.nonClient]
 * @property {UINotifyStaticFieldsValue} [email.signature]
 */

/**
 * @typedef {Object} UINotifyTarget
 * @property {boolean} activeClients
 * @property {boolean} newClients
 * @property {boolean} adminUsers
 */

/**
 * @typedef {Object} UINotifyRenderingOutput
 * @property {string} html
 * @property {string} text
 */

/**
 * @typedef {Object} UINotifyRenderedEmailContents
 * @property {Object} salutation
 * @property {UINotifyRenderingOutput} [salutation.client]
 * @property {UINotifyRenderingOutput} [salutation.nonClient]
 * @property {UINotifyRenderingOutput} signature
 */
/**
 * @typedef {Object} UINotifyRenderedContents
 * @property {UINotifyRenderingOutput} body
 * @property {UINotifyRenderedEmailContents} [email]
 */

/**
 * @typedef {Object} UINotifyTemplateDataInfo
 * @property {string} [name]
 * @property {string} [category]
 * @property {string} [urgency]
 * @property {boolean} [sentViaEmail]
 * @property {UINotifyTarget} [target]
 * @property {string} [title]
 * @property {UINotifySerializedContents} [contents]
 */


// Definition of classes
//

/**
 * UI notification template class
 */
export class UINotificationTemplate {
    // Class (public) properties
    //

    static notificationCategory = UINotificationTemplateShared.notificationCategory;
    static notificationUrgency = UINotificationTemplateShared.notificationUrgency;
    static notificationTemplateStatus = UINotificationTemplateShared.notificationTemplateStatus;
    static quillConverter = new QuillConverter();


    /**
     * Class constructor
     * @param {Object} docUINotificationTemplate UINotificationTemplate database collection doc/rec
     */
    constructor(docUINotificationTemplate) {
        this.doc_id = docUINotificationTemplate._id;
        this.name = docUINotificationTemplate.name;
        this.category = docUINotificationTemplate.category;
        this.urgency = docUINotificationTemplate.urgency;
        this.sendViaEmail = docUINotificationTemplate.sendViaEmail;
        /**
         * @type {UINotifyTarget}
         */
        this.target = docUINotificationTemplate.target;
        this.title = docUINotificationTemplate.title;
        /**
         * @type {UINotifyDeserializedContents}
         */
        this.contents = deserializeContents(docUINotificationTemplate.contents);
        this._status = docUINotificationTemplate.status;
        this.createdDate = docUINotificationTemplate.createdDate;
        this.lastStatusChangedDate = docUINotificationTemplate.lastStatusChangedDate;
    }


    // Public object properties (getters/setters)
    //

    /**
     * Retrieve the current status of this UI notification template
     * @return {string}
     */
    get status() {
        return this._status;
    }

    /**
     * Indicate whether this UI notification template is a draft
     * @return {boolean}
     */
    get isDraft() {
        return this._status === UINotificationTemplate.notificationTemplateStatus.draft.name;
    }

    /**
     * Indicate whether this UI notification template is active
     * @return {boolean}
     */
    get isActive() {
        return this._status === UINotificationTemplate.notificationTemplateStatus.active.name;
    }

    /**
     * Indicate whether this UI notification template is disabled
     * @return {boolean}
     */
    get isDisabled() {
        return this._status === UINotificationTemplate.notificationTemplateStatus.disabled.name;
    }

    /**
     * Retrieve the name of all static fields defined in this UI notification template contents
     * @return {UINotifyContentsStaticFields}
     */
    get contentsStaticFields() {
        const contentsStaticFields = {};

        let staticFields = listStaticFields(this.contents.body);

        if (staticFields.length > 0) {
            contentsStaticFields.body = staticFields;
        }

        if (this.contents.email) {
            if (this.contents.email.salutation) {
                if (this.contents.email.salutation.client) {
                    staticFields = listStaticFields(this.contents.email.salutation.client);

                    if (staticFields.length > 0) {
                        contentsStaticFields.email = {
                            salutation: {
                                client: staticFields
                            }
                        };
                    }
                }

                if (this.contents.email.salutation.nonClient) {
                    staticFields = listStaticFields(this.contents.email.salutation.nonClient);

                    if (staticFields.length > 0) {
                        if (!contentsStaticFields.email) {
                            contentsStaticFields.email = {
                                salutation: {
                                    nonClient: staticFields
                                }
                            };
                        }
                        else {
                            contentsStaticFields.email.salutation.nonClient = staticFields;
                        }
                    }
                }
            }

            staticFields = listStaticFields(this.contents.email.signature);

            if (staticFields.length > 0) {
                if (!contentsStaticFields.email) {
                    contentsStaticFields.email = {
                        signature: staticFields
                    }
                }
                else {
                    contentsStaticFields.email.signature = staticFields;
                }
            }
        }

        return contentsStaticFields;
    }


    // Public object methods
    //

    /**
     * Activate this UI notification template
     */
    activate() {
        if (!this.isActive) {
            this._resetStatus(UINotificationTemplate.notificationTemplateStatus.active.name);
        }
    }

    /**
     * Disable this UI notification template
     */
    disable() {
        if (!this.isDisabled) {
            this._resetStatus(UINotificationTemplate.notificationTemplateStatus.disabled.name);
        }
    }

    /**
     * Delete this UI notification template
     */
    delete() {
        if (!this.isDraft) {
            throw new Meteor.Error('ctn_ui_ntfy_tmpl_cannot_delete', 'UI notification template cannot be deleted; template is not in draft');
        }

        try {
            // Remove UI notification template from local database
            Catenis.db.collection.UINotificationTemplate.remove({_id: this.doc_id});
        }
        catch (err) {
            // Error trying to remove UINotificationTemplate database doc/rec.
            //  Log error and throw exception
            Catenis.logger.ERROR('Error trying to remove UINotificationTemplate database doc/rec (status).', err);
            throw new Meteor.Error('ctn_ui_ntfy_tmpl_remove_error', `Error trying to remove UINotificationTemplate database doc/rec: ${err}`);
        }

        // Now, delete all notifications derived from this UI notification template
        Catenis.db.collection.UINotification.find({
            uiNotificationTemplate_id: this.doc_id
        }, {
            fields: {
                _id: 1
            }
        })
        .fetch()
        .forEach(doc => {
            try {
                // Remove UI notification from local database
                Catenis.db.collection.UINotification.remove({_id: doc._id});
            }
            catch (err) {
                // Error trying to remove UINotification database doc/rec.
                //  Log error and throw exception
                Catenis.logger.ERROR('Error trying to remove UINotification database doc/rec after deleting its parent template.', err);
            }
        });
    }

    /**
     * Update the data info of this UI notification template
     * @param {*} info The updated UI notification template data info
     */
    updateInfo(info) {
        // Make sure that data info can be update
        if (!this.isDraft) {
            throw new Error('Unable to update UI notification template data info; template is not in draft');
        }

        // Note: this will throw in case of an inconsistent UI notification template data info
        checkUINotificationTemplateInfo(info, true);

        // Check if there was any changes in the UI notification template's data info
        const diffInfo = this._diffInfo(info);

        if (diffInfo) {
            let oldContentsStaticFields;

            if (diffInfo.contents) {
                // Contents of UI notification template is about to be updated.
                //  Save current contents static fields
                oldContentsStaticFields = this.contentsStaticFields;
            }

            // Save the changes
            this._saveInfo(diffInfo);

            if (oldContentsStaticFields && areContentsStaticFieldsDifferent(oldContentsStaticFields, this.contentsStaticFields)) {
                // Static fields of UI notification template have been updated. Instantiate any derived
                //  UI notification that is currently in draft so its status is reset to outdated
                Catenis.db.collection.UINotification.find({
                    status: UINotification.notificationStatus.draft.name
                })
                .fetch()
                .forEach(doc => {
                    new UINotification(doc);
                });
            }
        }
    }

    /**
     * Render the contents of this UI notification template as both HTML and plain text. The static
     *  and lookup fields of the contents are merged in the process
     * @param {UINotifyContentsStaticFieldsValue} contentsStaticFieldsValue
     * @return {UINotifyRenderedContents}
     */
    renderContents(contentsStaticFieldsValue) {
        // Note: this will throw in case of an inconsistency
        this.checkContentsStaticFieldsValue(contentsStaticFieldsValue);

        let delta = mergeLookupFields(
            contentsStaticFieldsValue.body
            ? mergeStaticFieldsValue(this.contents.body, contentsStaticFieldsValue.body)
            : this.contents.body
        );

        const renderedContents = {
            body: {
                html: UINotificationTemplate.quillConverter.toHtml(delta),
                text: UINotificationTemplate.quillConverter.toText(delta)
            }
        };

        if (this.contents.email) {
            if (this.contents.email.salutation) {
                if (this.contents.email.salutation.client) {
                    delta = mergeLookupFields(
                        contentsStaticFieldsValue.email && contentsStaticFieldsValue.email.salutation
                            && contentsStaticFieldsValue.email.salutation.client
                            ? mergeStaticFieldsValue(
                                this.contents.email.salutation.client,
                                contentsStaticFieldsValue.email.salutation.client
                            )
                            : this.contents.email.salutation.client
                    );

                    renderedContents.email = {
                        salutation: {
                            client: {
                                html: UINotificationTemplate.quillConverter.toHtml(delta),
                                text: UINotificationTemplate.quillConverter.toText(delta)
                            }
                        }
                    }
                }

                if (this.contents.email.salutation.nonClient) {
                    delta = mergeLookupFields(
                        contentsStaticFieldsValue.email && contentsStaticFieldsValue.email.salutation
                            && contentsStaticFieldsValue.email.salutation.nonClient
                            ? mergeStaticFieldsValue(
                                this.contents.email.salutation.nonClient,
                                contentsStaticFieldsValue.email.salutation.nonClient
                            )
                            : this.contents.email.salutation.nonClient
                    );

                    if (!renderedContents.email) {
                        renderedContents.email = {
                            salutation: {}
                        };
                    }

                    renderedContents.email.salutation.nonClient = {
                        html: UINotificationTemplate.quillConverter.toHtml(delta),
                        text: UINotificationTemplate.quillConverter.toText(delta)
                    };
                }
            }

            delta = mergeLookupFields(
                contentsStaticFieldsValue.email && contentsStaticFieldsValue.email.signature
                ? mergeStaticFieldsValue(
                    this.contents.email.signature,
                    contentsStaticFieldsValue.email.signature
                )
                : this.contents.email.signature
            );

            if (!renderedContents.email) {
                renderedContents.email = {};
            }

            renderedContents.email.signature = {
                html: UINotificationTemplate.quillConverter.toHtml(delta),
                text: UINotificationTemplate.quillConverter.toText(delta)
            };
        }

        UINotificationTemplate.quillConverter.htmlCleanUp();

        return renderedContents;
    }

    /**
     * Check whether the supplied value is a valid structure with values to replace the static fields
     *  of a UI notification template contents that matches this specific UI notification template
     * @param {*} contentsStaticFieldsValue
     */
    checkContentsStaticFieldsValue(contentsStaticFieldsValue) {
        const contentsStaticFields = this.contentsStaticFields;

        let isValid = true;

        if (!Util.isNonNullObject(contentsStaticFieldsValue)) {
            isValid = false;
        }

        if (isValid && (
                (('body' in contentsStaticFields) && !('body' in contentsStaticFieldsValue))
                || (!('body' in contentsStaticFields) && ('body' in contentsStaticFieldsValue))
                || (('body' in contentsStaticFields)
                && !isConsistentStaticFieldsValue(contentsStaticFieldsValue.body, contentsStaticFields.body)))) {
            isValid = false;
        }

        if (isValid && (
                (('email' in contentsStaticFields) && !('email' in contentsStaticFieldsValue))
                || (!('email' in contentsStaticFields) && ('email' in contentsStaticFieldsValue)))) {
            isValid = false;
        }

        if (isValid && ('email' in contentsStaticFields)) {
            if (!Util.isNonNullObject(contentsStaticFieldsValue.email)) {
                isValid = false;
            }

            if (isValid && (
                    (('salutation' in contentsStaticFields.email) && !('salutation' in contentsStaticFieldsValue.email))
                    || (!('salutation' in contentsStaticFields.email) && ('salutation' in contentsStaticFieldsValue.email)))) {
                isValid = false;
            }

            if (isValid && ('salutation' in contentsStaticFields.email)) {
                if (!Util.isNonNullObject(contentsStaticFieldsValue.email.salutation)) {
                    isValid = false;
                }

                if (isValid && (
                        (('client' in contentsStaticFields.email.salutation) && !('client' in contentsStaticFieldsValue.email.salutation))
                        || (!('client' in contentsStaticFields.email.salutation) && ('client' in contentsStaticFieldsValue.email.salutation))
                        || (('client' in contentsStaticFields.email.salutation)
                        && !isConsistentStaticFieldsValue(contentsStaticFieldsValue.email.salutation.client, contentsStaticFields.email.salutation.client)))) {
                    isValid = false;
                }

                if (isValid && (
                        (('nonClient' in contentsStaticFields.email.salutation) && !('nonClient' in contentsStaticFieldsValue.email.salutation))
                        || (!('nonClient' in contentsStaticFields.email.salutation) && ('nonClient' in contentsStaticFieldsValue.email.salutation))
                        || (('nonClient' in contentsStaticFields.email.salutation)
                        && !isConsistentStaticFieldsValue(contentsStaticFieldsValue.email.salutation.nonClient, contentsStaticFields.email.salutation.nonClient)))) {
                    isValid = false;
                }
            }

            if (isValid && (
                    (('signature' in contentsStaticFields.email) && !('signature' in contentsStaticFieldsValue.email))
                    || (!('signature' in contentsStaticFields.email) && ('signature' in contentsStaticFieldsValue.email))
                    || (('signature' in contentsStaticFields.email)
                    && !isConsistentStaticFieldsValue(contentsStaticFieldsValue.email.signature, contentsStaticFields.email.signature)))) {
                isValid = false;
            }
        }

        if (!isValid) {
            throw new TypeError('Inconsistent UI notification template contents static fields value');
        }
    }

    /**
     * Create a new UI notification from this UI notification template
     * @param {string} name
     * @param {UINotifyContentsStaticFieldsValue} contentsStaticFieldsValue
     * @param {Date} [expirationDate]
     * @return {UINotification}
     */
    createUINotification(name, contentsStaticFieldsValue, expirationDate) {
        return UINotification.createNew(this, name, contentsStaticFieldsValue, expirationDate);
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
     * Check if the current status of this UI notification template can be changed to a new status
     * @param newStatus The new intended status
     * @private
     */
    _validateStatusChange(newStatus) {
        let error = false;

        switch (newStatus) {
            case UINotificationTemplate.notificationTemplateStatus.draft.name:
                error = true;
                break;

            case UINotificationTemplate.notificationTemplateStatus.active.name:
                if (this._status !== UINotificationTemplate.notificationTemplateStatus.draft.name) {
                    error = true;
                }
                break;

            case UINotificationTemplate.notificationTemplateStatus.disabled.name:
                if (this._status !== UINotificationTemplate.notificationTemplateStatus.active.name) {
                    error = true;
                }
                break;

            default:
                throw new Error(`Inconsistent UI notification template status change; unknown new status: ${newStatus}`);
        }

        if (error) {
            throw new Error(`Inconsistent UI notification template status change; current status: ${this._status}, new status: ${newStatus}`);
        }
    }

    /**
     * Compares the supplied UI notification template data info with this UI notification template
     *  and returns an object with the difference between them
     * @param {UINotifyTemplateDataInfo} info UI notification template data info
     * @return {(UINotifyTemplateDataInfo|undefined)}
     * @private
     */
    _diffInfo(info) {
        const diff = {};
        
        if (('name' in info) && info.name !== this.name) {
            diff.name = info.name;
        }
        
        if (('category' in info) && info.category !== this.category) {
            diff.category = info.category;
        }
        
        if (('urgency' in info) && info.urgency !== this.urgency) {
            diff.urgency = info.urgency;
        }
        
        if (('sendViaEmail' in info) && info.sendViaEmail !== this.sendViaEmail) {
            diff.sendViaEmail = info.sendViaEmail;
        }
        
        if (('target' in info) && (info.target.activeClients !== this.target.activeClients
                || info.target.newClients !== this.target.newClients
                || info.target.adminUsers !== this.target.adminUsers)) {
            diff.target = info.target;
        }

        if (('title' in info) && info.title !== this.title) {
            diff.title = info.title;
        }
        
        if (('contents' in info) && areContentsDifferent(deserializeContents(info.contents), this.contents)) {
            diff.contents = info.contents;
        }

        return Object.keys(diff).length > 0 ? diff : undefined;
    }

    /**
     * Update the status of this UI notification template both on the local database and on this object
     * @param {string} status The new status to be updated
     * @private
     */
    _saveStatus(status) {
        const lastStatusChangedDate = new Date();

        try {
            // Update the database doc/rec with the new status
            Catenis.db.collection.UINotificationTemplate.update({
                _id: this.doc_id
            }, {
                $set: {
                    status,
                    lastStatusChangedDate
                }
            });
        }
        catch (err) {
            // Error trying to update UINotificationTemplate database doc/rec.
            //  Log error and throw exception
            Catenis.logger.ERROR('Error trying to update UINotificationTemplate database doc/rec (status).', err);
            throw new Meteor.Error('ctn_ui_ntfy_tmpl_update_error', `Error trying to update UINotificationTemplate database doc/rec: ${err}`);
        }

        // Update status locally
        this._status = status;
        this.lastStatusChangedDate = lastStatusChangedDate;
    }

    /**
     * Update the data info of this UI notification template both on the local database and on this object
     * @param {UINotifyTemplateDataInfo} info The UI notification template data info
     * @private
     */
    _saveInfo(info) {
        try {
            // Update the database doc/rec with the new data info
            Catenis.db.collection.UINotificationTemplate.update({
                _id: this.doc_id
            }, {
                $set: info
            });
        }
        catch (err) {
            if ((err.name === 'MongoError' || err.name === 'BulkWriteError') && err.code === 11000 && err.errmsg.search(/index:\s+name/) >= 0) {
                // Duplicate name error.
                throw new Meteor.Error('ctn_ui_ntfy_tmpl_duplicate_name', 'Cannot update UI notification template; the assigned name is already in use', err.stack);
            }
            else {
                // Any other error updating UINotificationTemplate database doc/rec.
                //  Log error and throw exception
                Catenis.logger.ERROR('Error trying to update UINotificationTemplate database doc/rec (contents).', err);
                throw new Meteor.Error('ctn_ui_ntfy_tmpl_update_error', `Error trying to update UINotificationTemplate database doc/rec: ${err}`);
            }
        }

        // Update the data info locally
        for (const data in info) {
            this[data] = data === 'contents' ? deserializeContents(info[data]) : info[data];
        }
    }

    // Class (public) methods
    //

    /**
     * Create a new UI notification template
     * @param {string} name
     * @param {string} category
     * @param {string} urgency
     * @param {boolean} sendViaEmail
     * @param {UINotifyTarget} target
     * @param {string} title
     * @param {UINotifySerializedContents} contents
     * @return {UINotificationTemplate}
     */
    static createNew(name, category, urgency, sendViaEmail, target, title, contents) {
        let errArg;

        try {
            checkUINotificationTemplateInfo({
                name,
                category,
                urgency,
                sendViaEmail,
                target,
                title,
                contents
            });
        }
        catch (err) {
            errArg = err.errData;
        }

        if (errArg) {
            const errArgs = Object.keys(errArg);

            Catenis.logger.ERROR(`UINotificationTemplate.createNew() method called with invalid argument${errArgs.length > 1 ? 's' : ''}`, errArg);
            throw new TypeError(`Invalid ${errArgs.join(', ')} argument${errArgs.length > 1 ? 's' : ''}`);
        }

        const docUINotificationTemplate = {
            name,
            category,
            urgency,
            sendViaEmail,
            target,
            title,
            contents,
            status: this.notificationTemplateStatus.draft.name,
            createdDate: new Date()
        };

        try {
            docUINotificationTemplate._id = Catenis.db.collection.UINotificationTemplate.insert(docUINotificationTemplate);
        }
        catch (err) {
            if ((err.name === 'MongoError' || err.name === 'BulkWriteError') && err.code === 11000 && err.errmsg.search(/index:\s+name/) >= 0) {
                // Duplicate name error.
                throw new Meteor.Error('ctn_ui_ntfy_tmpl_duplicate_name', 'Cannot create UI notification template; the assigned name is already in use', err.stack);
            }
            else {
                // Any other error inserting doc/rec
                Catenis.logger.ERROR('Error trying to create new UI notification template.', err);
                throw new Meteor.Error('ctn_ui_ntfy_tmpl_insert_error', 'Error trying to create new UI notification template', err.stack);
            }
        }

        return new UINotificationTemplate(docUINotificationTemplate);
    }

    /**
     * Get UI notification template by name
     * @param {string} name
     * @param {boolean} [includeDisabled=false]
     * @return {UINotificationTemplate}
     */
    static getUINotificationTemplateByName(name, includeDisabled = true) {
        // Retrieve UINotificationTemplate doc/rec
        const query = {
            name
        };

        if (!includeDisabled) {
            query.status = {$ne: this.notificationTemplateStatus.disabled.name};
        }

        const docUINotificationTemplate = Catenis.db.collection.UINotificationTemplate.findOne(query);

        if (docUINotificationTemplate === undefined) {
            // No UI notification template available with the given name. Throw exception
            throw new Meteor.Error('ctn_ui_ntfy_tmpl_not_found', 'Could not find UI notification template with the given name');
        }

        return new UINotificationTemplate(docUINotificationTemplate);
    }

    /**
     * Get UI notification template by database doc/rec ID
     * @param {string} doc_id
     * @param {boolean} [includeDisabled=false]
     * @return {UINotificationTemplate}
     */
    static getUINotificationTemplateByDocId(doc_id, includeDisabled = true) {
        // Retrieve UINotificationTemplate doc/rec
        const query = {
            _id: doc_id
        };

        if (!includeDisabled) {
            query.status = {$ne: this.notificationTemplateStatus.disabled.name};
        }

        const docUINotificationTemplate = Catenis.db.collection.UINotificationTemplate.findOne(query);

        if (docUINotificationTemplate === undefined) {
            // No UI notification template available with the given database doc/rec ID. Throw exception
            throw new Meteor.Error('ctn_ui_ntfy_tmpl_not_found', 'Could not find UI notification template with the given database doc/rec ID');
        }

        return new UINotificationTemplate(docUINotificationTemplate);
    }
}


// Definition of module (private) functions
//

/**
 * Serialize the notification template contents
 * @param {UINotifyDeserializedContents} contents
 * @return {UINotifySerializedContents}
 */
function serializeContents(contents) {
    const serContents = {
        body: JSON.stringify(contents.body)
    };

    if (contents.email) {
        serContents.email = {
            salutation: {},
            signature: JSON.stringify(contents.email.signature)
        };

        if (contents.email.salutation) {
            if (contents.email.salutation.client) {
                serContents.email.salutation.client = JSON.stringify(contents.email.salutation.client);
            }

            if (contents.email.salutation.nonClient) {
                serContents.email.salutation.nonClient = JSON.stringify(contents.email.salutation.nonClient);
            }
        }
    }

    return serContents;
}

/**
 * Deserialize the notification template contents
 * @param {*} contents
 * @return {UINotifyDeserializedContents}
 */
function deserializeContents(contents) {
    const desContents = {};

    if (!Util.isNonNullObject(contents)) {
        throw new TypeError('Error deserializing UI notification template contents; inconsistent contents');
    }

    if (typeof contents.body !== 'string') {
        throw new TypeError('Error deserializing UI notification template contents; inconsistent body property');
    }

    let jsonBody;

    try {
        jsonBody = JSON.parse(contents.body);
    }
    catch (err) {
        throw new TypeError('Error deserializing UI notification template contents; invalid JSON body');
    }

    desContents.body = new Delta(jsonBody);

    if ('email' in contents) {
        if (!Util.isNonNullObject(contents.email) || !('salutation' in contents.email)
                || !('signature' in contents.email)) {
            throw new TypeError('Error deserializing UI notification template contents; inconsistent email property');
        }
        
        desContents.email = {};

        if (!Util.isNonNullObject(contents.email.salutation) || (!('client' in contents.email.salutation)
                && !('nonClient' in contents.email.salutation))) {
            throw new TypeError('Error deserializing UI notification template contents; inconsistent email.salutation property');
        }
        
        desContents.email.salutation = {};
        
        if ('client' in contents.email.salutation) {
            if (typeof contents.email.salutation.client !== 'string') {
                throw new TypeError('Error deserializing UI notification template contents; inconsistent email.salutation.client property');
            }
            
            let jsonClientSalutation;

            try {
                jsonClientSalutation = JSON.parse(contents.email.salutation.client);
            }
            catch (err) {
                throw new TypeError('Error deserializing UI notification template contents; invalid JSON email.salutation.client');
            }
            
            desContents.email.salutation.client = new Delta(jsonClientSalutation);
        }

        if ('nonClient' in contents.email.salutation) {
            if (typeof contents.email.salutation.nonClient !== 'string') {
                throw new TypeError('Error deserializing UI notification template contents; inconsistent email.salutation.nonClient property');
            }

            let jsonNonClientSalutation;

            try {
                jsonNonClientSalutation = JSON.parse(contents.email.salutation.nonClient);
            }
            catch (err) {
                throw new TypeError('Error deserializing UI notification template contents; invalid JSON email.salutation.nonClient');
            }

            desContents.email.salutation.nonClient = new Delta(jsonNonClientSalutation);
        }

        if (typeof contents.email.signature !== 'string') {
            throw new TypeError('Error deserializing UI notification template contents; inconsistent email.signature property');
        }

        let jsonSignature;

        try {
            jsonSignature = JSON.parse(contents.email.signature);
        }
        catch (err) {
            throw new TypeError('Error deserializing UI notification template contents; invalid JSON email.signature');
        }

        desContents.email.signature = new Delta(jsonSignature);
    }

    return desContents;
}

/**
 * Check whether two UI notification template contents are different
 * @param {UINotifyDeserializedContents} contents1
 * @param {UINotifyDeserializedContents} contents2
 * @return {boolean}
 */
function areContentsDifferent(contents1, contents2) {
    let changed = contents1.body.diff(contents2.body).length() > 0;

    if (!changed) {
        changed = (contents1.email && !contents2.email) || (!contents1.email && contents2.email);

        if (!changed && contents1.email) {
            changed = contents1.email.signature.diff(contents2.email.signature).length() > 0;
            
            if (!changed) {
                changed = (contents1.email.salutation && !contents2.email.salutation)
                    || (!contents1.email.salutation && contents2.email.salutation);
                
                if (!changed && contents1.email.salutation) {
                    changed = (contents1.email.salutation.client && !contents2.email.salutation.client)
                        || (!contents1.email.salutation.client && contents2.email.salutation.client)
                        || (contents1.email.salutation.client
                            && contents1.email.salutation.client.diff(contents2.email.salutation.client).length() > 0);

                    if (!changed) {
                        changed = (contents1.email.salutation.nonClient && !contents2.email.salutation.nonClient)
                            || (!contents1.email.salutation.nonClient && contents2.email.salutation.nonClient)
                            || (contents1.email.salutation.nonClient
                                && contents1.email.salutation.nonClient.diff(contents2.email.salutation.nonClient).length() > 0);
                    }
                }
            }
        }
    }

    return changed;
}

/**
 * Check whether two UI notification template contents static fields are different
 * @param {UINotifyContentsStaticFields} csf1 First contents static fields
 * @param {UINotifyContentsStaticFields} csf2 Second contents static fields
 */
function areContentsStaticFieldsDifferent(csf1, csf2) {
    function areStaticFieldsDifferent(sf1, sf2) {
        return Util.diffArrays(sf1,sf2) !== undefined;
    }
    
    let changed = (('body' in csf1) && !('body' in csf2)) || (!('body' in csf1) && ('body' in csf2))
        || (('body' in csf1) && areStaticFieldsDifferent(csf1.body, csf2.body));
    
    if (!changed) {
        changed = (('email' in csf1) && !('email' in csf2)) || (!('email' in csf1) && ('email' in csf2));
        
        if (!changed && ('email' in csf1)) {
            changed = (('salutation' in csf1.email) && !('salutation' in csf2.email))
                || (!('salutation' in csf1.email) && ('salutation' in csf2.email));
            
            if (!changed && ('salutation' in csf1.email)) {
                changed = (('client' in csf1.email.salutation) && !('client' in csf2.email.salutation))
                    || (!('client' in csf1.email.salutation) && ('client' in csf2.email.salutation))
                    || (('client' in csf1.email.salutation)
                    && areStaticFieldsDifferent(csf1.email.salutation.client, csf2.email.salutation.client));
                
                if (!changed) {
                    changed = (('nonClient' in csf1.email.salutation) && !('nonClient' in csf2.email.salutation))
                        || (!('nonClient' in csf1.email.salutation) && ('nonClient' in csf2.email.salutation))
                        || (('nonClient' in csf1.email.salutation)
                            && areStaticFieldsDifferent(csf1.email.salutation.nonClient, csf2.email.salutation.nonClient));
                }
            }
            
            if (!changed) {
                changed = (('signature' in csf1.email) && !('signature' in csf2.email))
                    || (!('signature' in csf1.email) && ('signature' in csf2.email))
                    || (('signature' in csf1.email) && areStaticFieldsDifferent(csf1.email.signature, csf2.email.signature));
            }
        }
    }

    return changed;
}

/**
 * Check if the supplied value is a valid UI notification template data info
 * @param {*} info
 * @param {boolean} isPartial Indicates whether the supplied value may be only a partial UI notification
 *                             template data info; in other words, have missing data fields
 */
function checkUINotificationTemplateInfo(info, isPartial = false) {
    if (!Util.isNonNullObject(info)) {
        throw new TypeError('Inconsistent UI notification template data info');
    }

    // Validate the supplied data
    const errData = {};

    if (!((isPartial && !('name' in info)) || (('name' in info) && Util.isNonBlankString(info.name)))) {
        errData.name = info.name;
    }

    if (!((isPartial && !('category' in info)) || (('category' in info) && UINotificationTemplateShared.isValidCategory(info.category)))) {
        errData.category = info.category;
    }

    if (!((isPartial && !('urgency' in info)) || (('urgency' in info) && UINotificationTemplateShared.isValidUrgency(info.urgency)))) {
        errData.urgency = info.urgency;
    }

    if (!((isPartial && !('sendViaEmail' in info)) || (('sendViaEmail' in info) && typeof info.sendViaEmail === 'boolean'))) {
        errData.sendViaEmail = info.sendViaEmail;
    }

    if (!((isPartial && !('target' in info)) || (('target' in info) && isValidUINotificationTarget(info.target)))) {
        errData.target = info.target;
    }

    if (!((isPartial && !('title' in info)) || (('title' in info) && Util.isNonBlankString(info.title)))) {
        errData.title = info.title;
    }

    function isValidContents(contents) {
        let error = false;

        try {
            deserializeContents(contents);
        }
        catch (err) {
            error = true;
        }

        return !error;
    }

    if (!((isPartial && !('contents' in info)) || (('contents' in info) && isValidContents(info.contents)))) {
        errData.contents = info.contents;
    }

    if (Object.keys(errData).length > 0) {
        const error = new TypeError(`Inconsistent UI notification template data info; invalid data fields: ${Object.keys(errData).join(', ')}`);
        error.errData = errData;

        throw error;
    }
}

/**
 * Check if the supplied value is a valid UI notification template target object
 * @param {any} target
 * @return {boolean}
 */
function isValidUINotificationTarget(target) {
    return Util.isNonNullObject(target) && typeof target.activeClients === 'boolean'
        && typeof target.newClients === 'boolean' && typeof target.adminUsers === 'boolean';
}

/**
 * Return a list of the name of all static fields in the supplied Quill text editor contents
 * @param {Delta} delta
 * @return {string[]}
 */
function listStaticFields(delta) {
    return delta.filter(op => typeof op.insert === 'string' && typeof op.attributes === 'object' && typeof op.attributes['static-field'] === 'string')
        .map(op => op.attributes['static-field']);
}

/**
 * Replace static fields in Quill text editor contents for the given values
 * @param {Delta} delta
 * @param {UINotifyStaticFieldsValue} fieldsValue A dictionary where the keys are the names of the static fields and the
 *                              values the corresponding values to be replaced
 * @return {Delta}
 */
function mergeStaticFieldsValue(delta, fieldsValue) {
    const mergedOps = [];

    delta.forEach(op => {
        if (typeof op.insert === 'string' && typeof op.attributes === 'object' && typeof op.attributes['static-field'] === 'string') {
            const value = fieldsValue[op.attributes['static-field']];

            if (value) {
                // Clone operation object and its attributes
                op = Util.cloneObj(op);
                op.attributes = Util.cloneObj(op.attributes);

                // Replace text with corresponding field value...
                op.insert = value;

                //  and remove static field formatting
                delete op.attributes['static-field'];

                if (Object.keys(op.attributes).length === 0) {
                    delete op.attributes;
                }
            }
        }

        mergedOps.push(op);
    });

    return new Delta(mergedOps);
}

/**
 * Replace lookup fields in Quill text editor contents for the respective embedded field formatting
 * @param {Delta} delta
 * @return {Delta}
 */
function mergeLookupFields(delta) {
    const mergedOps = [];

    delta.forEach(op => {
        if (typeof op.insert === 'string' && typeof op.attributes === 'object' && typeof op.attributes['lookup-field'] === 'object') {
            // Clone operation object and its attributes
            op = Util.cloneObj(op);
            op.attributes = Util.cloneObj(op.attributes);

            // Replace text with embedded field formatting ("{!source.name}")...
            op.insert = `{!${op.attributes['lookup-field'].source}.${op.attributes['lookup-field'].name}}`;

            //  and remove lookup field formatting
            delete op.attributes['lookup-field'];

            if (Object.keys(op.attributes).length === 0) {
                delete op.attributes;
            }
        }

        mergedOps.push(op);
    });

    return new Delta(mergedOps);
}

/**
 * Check whether the supplied value is a valid static fields dictionary (object with field names
 *  and their values) that is consistent with a given static fields set (list of static field names)
 * @param {*} staticFieldsValue The value to be validated
 * @param {string[]} staticFields A list of static field names
 * @return {boolean}
 */
function isConsistentStaticFieldsValue(staticFieldsValue, staticFields) {
    return Util.isNonNullObject(staticFieldsValue)
        && Object.keys(staticFieldsValue).length === staticFields.length
        && staticFields.every(field =>
            (field in staticFieldsValue) && typeof staticFieldsValue[field] === 'string');
}


// Module code
//

// Lock class
Object.freeze(UINotificationTemplate);
