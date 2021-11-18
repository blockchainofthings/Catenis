/**
 * Created by claudio on 2021-11-13
 */

//console.log('[UserNotificationsTemplate.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
//import moment from 'moment';
// Meteor packages
import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';
import { ReactiveDict } from 'meteor/reactive-dict';

// References code in other (Catenis) modules on the client
import { Catenis } from '../ClientCatenis';
import { UINotificationTemplateShared } from '../../both/UINotificationTemplateShared';
import { UserUINotificationShared } from '../../both/UserUINotificationShared';

// Import template UI
import './UserNotificationsTemplate.html';

// Import dependent templates

// Module variables
const confirmPhrase = 'yes, i do confirm it';


// Definition of module (private) functions
//

function selectedUserNotificationRecord(template) {
    return Catenis.db.collection.UserNotification.findOne({
        _id: template.state.get('selectedNotificationId')
    });
}

function countLoadedUserNotificationRecords() {
    return Catenis.db.collection.UserNotification.find({}).count();
}


// Module code
//

Template.userNotifications.onCreated(function () {
    this.state = new ReactiveDict();

    this.state.set('selectedNotificationId', undefined);
    this.state.set('displayMarkAllNotificationsReadSubmitButton', 'none');
    this.state.set('displayDeleteAllReadNotificationsSubmitButton', 'none');
    this.state.set('initialized', false);

    // Subscribe to receive database docs/recs updates
    this.autorun(() => {
        this.subscribe('userNotifications', this.state.get('maxRecsToLoad'));
    });

    if (this.data.selected_id) {
        // The ID of a user notification to be displayed has been passed.
        //  Make sure it is loaded
        this.subscribe('userNotificationRecord', this.data.selected_id, () => {
            // Make sure record was loaded
            const doc = Catenis.db.collection.UserNotification.findOne({
                _id: this.data.selected_id
            });

            if (doc) {
                // Prepare to display selected notification
                this.state.set('selectedNotificationId', this.data.selected_id);
            }
        });
    }

    this.state.set('displayBatchSize', undefined);

    // Load user notification display batch size
    Meteor.call('getUserUINotificationDisplayBatchSize', (err, displayBatchSize) => {
        if (err) {
            console.error('Error calling getUserUINotificationDisplayBatchSize() remote method:', err);
        }
        else {
            this.state.set('displayBatchSize', displayBatchSize);
            this.state.set('maxRecsToLoad', displayBatchSize);
        }
    });
});

Template.userNotifications.onDestroyed(function () {
});

Template.userNotifications.events({
    'click #divNotificationMessage'(event, template) {
        if (event.currentTarget.id === event.target.id) {
            if (!template.state.get('initialized')) {
                template.state.set('initialized', true);

                setTimeout(() => {
                    const selectedNotificationId = template.state.get('selectedNotificationId');

                    if (selectedNotificationId) {
                        // Display modal window (to display selected notification)
                        $('#divNotificationMessage').modal('show');
                    }
                }, 100);
            }
        }
    },
    'click .ctnNotifyEntry'(event, template) {
        event.stopPropagation();

        template.state.set('selectedNotificationId', event.currentTarget.getAttribute('data-notifyId'));

        // Display modal window
        $('#divNotificationMessage').modal('show');
    },
    'shown.bs.modal #divNotificationMessage'(event, template) {
        if (selectedUserNotificationRecord(template).status === UserUINotificationShared.userNotificationStatus.new.name) {
            // Mark notification as read
            Meteor.call('setUserNotificationAsRead', template.state.get('selectedNotificationId'), (error) => {
                if (error) {
                    console.error('Error calling setUserNotificationAsRead() remote method:', error);
                }
            });
        }
    },
    'click #btnDeleteNotificationMessage'(event, template) {
        event.stopPropagation();

        const confirmMsg = 'If you proceed, this notification message will be removed.\n\nPLEASE NOTE THAT THIS ACTION CANNOT BE UNDONE.';

        if (confirm(confirmMsg)) {
            // Close modal panel
            $('#divNotificationMessage').modal('hide');

            // Delete user notification
            Meteor.call('deleteUserNotification', template.state.get('selectedNotificationId'), (error) => {
                if (error) {
                    console.error('Error calling deleteUserNotification() remote method:', error);
                }
            });
        }
        else {
            event.currentTarget.blur();
        }
    },
    'click #lnkShowMoreRecs'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        template.state.set('maxRecsToLoad', template.state.get('maxRecsToLoad') + template.state.get('displayBatchSize'));
    },
    'click #btnMarkAllNotificationsRead'(event, template) {
        event.preventDefault();

        // Reset action confirmation
        $('#itxMarkAllNotificationsReadConfirmation')[0].value = '';
        template.state.set('displayMarkAllNotificationsReadSubmitButton', 'none');
    },
    'hidden.bs.modal #divMarkAllNotificationsRead'(event, template) {
        // Modal panel has been closed. Make sure that button used to
        //  activate modal panel is not selected
        $('#btnMarkAllNotificationsRead').blur();
    },
    'input #itxMarkAllNotificationsReadConfirmation'(event, template) {
        // Suppress spaces from beginning of input
        let inputValue = event.target.value = event.target.value.replace(/^\s+/, '');

        if (inputValue.length > confirmPhrase.length) {
            // Limit length of input
            inputValue = event.target.value = inputValue.substring(0, confirmPhrase.length);
        }

        // Check if input matches confirmation phrase
        if (inputValue.toLowerCase() === confirmPhrase) {
            // Show button to confirm action
            template.state.set('displayMarkAllNotificationsReadSubmitButton', 'inline');
        }
        else {
            // Hide button to confirm action
            template.state.set('displayMarkAllNotificationsReadSubmitButton', 'none');
        }
    },
    'submit #frmMarkAllNotificationsRead'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        const confirmMsg = 'LAST CHANCE!\n\nIf you proceed, ALL notification messages will be marked as if they have been already read.\n\nPLEASE NOTE THAT THIS ACTION CANNOT BE UNDONE.';

        if (confirm(confirmMsg)) {
            // Close modal panel
            $('#divMarkAllNotificationsRead').modal('hide');

            Meteor.call('setAllUserNotificationsAsRead', (error) => {
                if (error) {
                    console.error('Error calling setAllUserNotificationsAsRead() remote method:', error);
                }
            });
        }
        else {
            // Close modal panel
            $('#divMarkAllNotificationsRead').modal('hide');
        }
    },
    'click #btnDeleteAllReadNotifications'(event, template) {
        event.preventDefault();

        // Reset action confirmation
        $('#itxDeleteAllReadNotificationsConfirmation')[0].value = '';
        template.state.set('displayDeleteAllReadNotificationsSubmitButton', 'none');
    },
    'hidden.bs.modal #divDeleteAllReadNotifications'(event, template) {
        // Modal panel has been closed. Make sure that button used to
        //  activate modal panel is not selected
        $('#btnDeleteAllReadNotifications').blur();
    },
    'input #itxDeleteAllReadNotificationsConfirmation'(event, template) {
        // Suppress spaces from beginning of input
        let inputValue = event.target.value = event.target.value.replace(/^\s+/, '');

        if (inputValue.length > confirmPhrase.length) {
            // Limit length of input
            inputValue = event.target.value = inputValue.substring(0, confirmPhrase.length);
        }

        // Check if input matches confirmation phrase
        if (inputValue.toLowerCase() === confirmPhrase) {
            // Show button to confirm action
            template.state.set('displayDeleteAllReadNotificationsSubmitButton', 'inline');
        }
        else {
            // Hide button to confirm action
            template.state.set('displayDeleteAllReadNotificationsSubmitButton', 'none');
        }
    },
    'submit #frmDeleteAllReadNotifications'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        const confirmMsg = 'LAST CHANCE!\n\nIf you proceed, ALL notification messages currently marked as read will be removed.\n\nPLEASE NOTE THAT THIS ACTION CANNOT BE UNDONE.';

        if (confirm(confirmMsg)) {
            // Close modal panel
            $('#divDeleteAllReadNotifications').modal('hide');

            Meteor.call('deleteAllUserNotifications', (error) => {
                if (error) {
                    console.error('Error calling deleteAllUserNotifications() remote method:', error);
                }
            });
        }
        else {
            // Close modal panel
            $('#divDeleteAllReadNotifications').modal('hide');
        }
    },
});

Template.userNotifications.helpers({
    userNotifications() {
        return Catenis.db.collection.UserNotification.find({}, {
            sort:{
                issuedDate: -1
            },
            limit: Template.instance().state.get('maxRecsToLoad')
        }).fetch();
    },
    hasUserNotifications() {
        return Catenis.db.collection.UserNotification.find({}).count() > 0;
    },
    hasUnreadUserNotifications() {
        return Catenis.db.collection.UserNotification.find({
            status: UserUINotificationShared.userNotificationStatus.new.name
        })
        .count() > 0;
    },
    hasReadUserNotifications() {
        return Catenis.db.collection.UserNotification.find({
            status: UserUINotificationShared.userNotificationStatus.read.name
        })
        .count() > 0;
    },
    selectedUserNotification() {
        return Catenis.db.collection.UserNotification.findOne({
            _id: Template.instance().state.get('selectedNotificationId')
        });
    },
    formatDate(date) {
        return date.toLocaleDateString();
    },
    formatDateTime(date) {
        if (date instanceof Date) {
            return date.toLocaleString(undefined, {
                dateStyle: 'short',
                timeStyle:'short',
            });
        }
    },
    isNew(userNotification) {
        return userNotification.status === UserUINotificationShared.userNotificationStatus.new.name;
    },
    isCritical(userNotification) {
        return userNotification && userNotification.urgency === UINotificationTemplateShared.notificationUrgency.critical.name;
    },
    hasMoreRecsToLoad() {
        return countLoadedUserNotificationRecords() > Template.instance().state.get('maxRecsToLoad');
    },
    displayMarkAllNotificationsReadSubmitButton() {
        return Template.instance().state.get('displayMarkAllNotificationsReadSubmitButton');
    },
    displayDeleteAllReadNotificationsSubmitButton() {
        return Template.instance().state.get('displayDeleteAllReadNotificationsSubmitButton');
    },
    displayBatchSize() {
        return Template.instance().state.get('displayBatchSize');
    },
    logicalOr(...ops) {
        if (ops.length > 0) {
            // Get rid of the last parameter (keyword arguments dictionary)
            ops.pop();

            return ops.some(v => !!v);
        }
        else {
            return false;
        }
    },
    logicalAnd(...ops) {
        if (ops.length > 0) {
            // Get rid of the last parameter (keyword arguments dictionary)
            ops.pop();

            return ops.every(v => !!v);
        }
        else {
            return false;
        }
    },
});
