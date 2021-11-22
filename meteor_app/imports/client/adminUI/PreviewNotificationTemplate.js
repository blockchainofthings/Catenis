/**
 * Created by claudio on 2021-11-09
 */

//console.log('[PreviewNotificationTemplate.js]: This code just ran.');

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
import { Template } from 'meteor/templating';
import { ReactiveDict } from 'meteor/reactive-dict';

// References code in other (Catenis) modules on the client
import { Catenis } from '../ClientCatenis';

// Import template UI
import './PreviewNotificationTemplate.html';

// Import dependent templates

// Module variables
const defaultUserType = {
    admin: 'Admin user',
    client: 'Client',
};


// Definition of module (private) functions
//

function uiNotificationTemplateRecord(template) {
    return Catenis.db.collection.UINotificationTemplate.findOne({
        _id: template.data.uiNotificationTemplate_id
    });
}


// Module code
//

Template.previewNotification.onCreated(function () {
    this.state = new ReactiveDict();

    this.state.set('errMsgs', []);
    this.state.set('selectedUserType', undefined);
    this.state.set('composedMessage', undefined);

    // Define available user types (at first, all types are accepted)
    const userType = {...defaultUserType};

    this.staticState = new Map();

    this.staticState.set('userType', userType);

    // Subscribe to receive database docs/recs updates
    this.subscribe(
        'uiNotificationTemplateRecord',
        this.data.uiNotificationTemplate_id,
        () => {
            // Check if notification targets admin users
            if (!uiNotificationTemplateRecord(this).target.adminUsers) {
                // If not, remove admin user type
                delete userType.admin;
            }

            // Set the user type selected by default
            this.state.set('selectedUserType', Object.keys(userType)[0]);
        }
    );
    this.subscribe('catenisUsers');
});

Template.previewNotification.events({
    'click #btnDismissError'(event, template) {
        // Clear error message
        template.state.set('errMsgs', []);
    },
    'change #selUserType'(event, template) {
        template.state.set('selectedUserType', event.target.value);

        // Clear composed message
        template.state.set('composedMessage', undefined);
    },
    'change .previewNotificationUserSelect'(event, template) {
        const selectedUserId = event.target.value;

        // Reset error messages
        template.state.set('errMsgs', []);

        // Clear composed message
        template.state.set('composedMessage', undefined);

        // Call remote method to compose notification message for the selected user
        Meteor.call('composeNotificationMessage', template.data.uiNotification_id, selectedUserId, (error, composedMessage) => {
            if (error) {
                const errMsgs = template.state.get('errMsgs');
                errMsgs.push('Error composing notification message: ' + error.toString());
                template.state.set('errMsgs', errMsgs);
            }
            else {
                // Save composed notification message
                template.state.set('composedMessage', composedMessage);
            }
        });
    }
});

Template.previewNotification.helpers({
    backQueryString() {
        const retParams = Template.instance().data.retParams;

        return retParams ? '?' + retParams : undefined;
    },
    uiNotificationTemplate() {
        return Catenis.db.collection.UINotificationTemplate.findOne({
            _id: Template.instance().data.uiNotificationTemplate_id
        });
    },
    hasErrorMessage() {
        return Template.instance().state.get('errMsgs').length > 0;
    },
    errorMessage() {
        return Template.instance().state.get('errMsgs').reduce((compMsg, errMsg) => {
            if (compMsg.length > 0) {
                compMsg += '<br>';
            }
            return compMsg + errMsg;
        }, '');
    },
    userTypes() {
        const template = Template.instance();
        const selectedUserType = template.state.get('selectedUserType');
        const userType = template.staticState.get('userType');

        return Object.keys(userType).reduce((list, type) => {
            list.push({
                name: userType[type],
                value: type,
                selected: type === selectedUserType
            });

            return list;
        }, []);
    },
    selectedUserType() {
        return Template.instance().state.get('selectedUserType');
    },
    selectAdminUser() {
        return Template.instance().state.get('selectedUserType') === 'admin';
    },
    selectClient() {
        return Template.instance().state.get('selectedUserType') === 'client';
    },
    adminUsers() {
        return Catenis.db.collection.CatenisUser.find({
            type: 'admin'
        }, {
            sort: {
                name: 1
            }
        })
        .map(doc => ({
            _id: doc._id,
            name: doc.name
        }));
    },
    clientUsers() {
        return Catenis.db.collection.CatenisUser.find({
            type: 'client'
        }, {
            sort: {
                name: 1
            }
        })
        .map(doc => {
            let name = doc.name;

            let endUser = doc.company;

            if (doc.contact) {
                if (endUser) {
                    endUser += ' (' + doc.contact + ')';
                }
                else {
                    endUser = doc.contact;
                }
            }

            if (endUser) {
                name += ' - ' + endUser;
            }

            return {
                _id: doc._id,
                name
            }
        });
    },
    composedMessage() {
        return Template.instance().state.get('composedMessage');
    },
    hasEmailMessage() {
        const composedMessage = Template.instance().state.get('composedMessage');

        return composedMessage && composedMessage.body.email;
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
