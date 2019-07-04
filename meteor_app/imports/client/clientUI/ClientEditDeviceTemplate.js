/**
 * Created by Claudio on 2018-10-11.
 */

//console.log('[ClientEditDeviceTemplate.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import util from 'util';
// Third-party node modules
//import config from 'config';
// Meteor packages
import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';
import { ReactiveDict } from 'meteor/reactive-dict';

// References code in other (Catenis) modules on the client
import { Catenis } from '../ClientCatenis';

// Import template UI
import './ClientEditDeviceTemplate.html';

// Import dependent templates


// Definition of module (private) functions
//

function loadDeviceData(template) {
    const device = Catenis.db.collection.Device.findOne();

    template.state.set('deviceName', device.props.name);
    template.state.set('prodUniqueId', device.props.prodUniqueId);
    template.state.set('public', device.props.public);
}

function validateFormData(form, errMsgs, template) {
    const deviceInfo = {};
    let hasError = false;

    deviceInfo.name = form.deviceName.value ? form.deviceName.value.trim() : '';

    if (deviceInfo.name.length === 0) {
        // Device name not supplied. Report error
        errMsgs.push('Please enter a device name');
        hasError = true;
    }

    if (form.prodUniqueId) {
        deviceInfo.prodUniqueId = form.prodUniqueId.value ? form.prodUniqueId.value.trim() : '';
    }

    deviceInfo.public = form.public.checked;

    return !hasError ? deviceInfo : undefined;
}


// Module code
//

Template.clientEditDevice.onCreated(function () {
    this.state = new ReactiveDict();

    this.state.set('errMsgs', []);
    this.state.set('infoMsg', undefined);
    this.state.set('infoMsgType', 'info');

    this.state.set('fieldsChanged', false);
    this.state.set('deviceUpdated', false);

    this.state.set('deviceName', undefined);
    this.state.set('public', undefined);

    // Subscribe to receive database docs/recs updates
    this.currClntDeviceRecordSubs = this.subscribe('currentClientDeviceRecord', this.data.deviceIndex, () => {
        loadDeviceData(this);
    });
});

Template.clientEditDevice.onDestroyed(function () {
    if (this.currClntDeviceRecordSubs) {
        this.currClntDeviceRecordSubs.stop();
    }
});

Template.clientEditDevice.events({
    'click #btnDismissInfo'(event, template) {
        // Clear info message
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');
    },
    'click #btnDismissError'(event, template) {
        // Clear error message
        template.state.set('errMsgs', []);
    },
    'change #txtDeviceName'(event, template) {
        // Indicate that form field has changed
        template.state.set('fieldsChanged', true);
    },
    'change #txtProdUniqueId'(event, template) {
        // Indicate that form field has changed
        template.state.set('fieldsChanged', true);
    },
    'change #cbxPublic'(event, template) {
        // Indicate that form field has changed
        template.state.set('fieldsChanged', true);
    },
    'click #btnCancel'(event, template) {
        // Note: we resource to this unconventional solution so we can disable the Cancel button and,
        //      at the same time, make it behave the same way as when a link is clicked (which we
        //      cannot achieve with either window.location.href = '<url>' or document.location = '<url>';
        //      both solutions cause a page reload, whilst clicking on th link does not)
        template.find('#lnkCancel').click();
    },
    'submit #frmEditDevice'(event, template) {
        event.preventDefault();

        const form = event.target;

        // Clear alert messages
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');
        let errMsgs = [];

        let deviceInfo;

        if ((deviceInfo = validateFormData(form, errMsgs, template))) {
            // Disable buttons
            const btnCancel = template.find('#btnCancel');
            const btnUpdate = template.find('#btnUpdate');
            btnCancel.disabled = true;
            btnUpdate.disabled = true;

            // Call remote method to update device
            Meteor.call('updateCurrentClientDevice', template.data.deviceIndex, deviceInfo, (error) => {
                // Reenable buttons
                btnCancel.disabled = false;
                btnUpdate.disabled = false;

                if (error) {
                    template.state.set('errMsgs', [
                        error.toString()
                    ]);
                }
                else {
                    // Indicate that device has been successfully updated
                    template.state.set('deviceUpdated', true);
                    template.state.set('infoMsg', 'Device data successfully update.');
                    template.state.set('infoMsgType', 'success');
                }
            });
        }
        else {
            template.state.set('errMsgs', errMsgs);
        }
    }
});

Template.clientEditDevice.helpers({
    device() {
        return Catenis.db.collection.Device.findOne();
    },
    deviceTitle(device) {
        return device.props.name || device.deviceId;
    },
    deviceData() {
        const template = Template.instance();

        return {
            name: template.state.get('deviceName'),
            prodUniqueId: template.state.get('prodUniqueId'),
            public: template.state.get('public')
        };
    },
    hasProdUniqueId(deviceData) {
        return !!deviceData.prodUniqueId;
    },
    publicChecked(deviceData) {
        return deviceData.public ? 'checked' : undefined;
    },
    isDeviceUpdated() {
        return Template.instance().state.get('deviceUpdated');
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
    hasInfoMessage() {
        return !!Template.instance().state.get('infoMsg');
    },
    infoMessage() {
        return Template.instance().state.get('infoMsg');
    },
    infoMessageType() {
        return Template.instance().state.get('infoMsgType');
    },
    showUpdateButton() {
        const template = Template.instance();

        return template.state.get('fieldsChanged') && !template.state.get('deviceUpdated');
    }
});
