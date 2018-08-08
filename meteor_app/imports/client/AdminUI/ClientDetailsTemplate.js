/**
 * Created by Claudio on 2017-05-24.
 */

//console.log('[ClientDetailsTemplate.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//  NOTE: the reference of these modules are done sing 'require()' instead of 'import' to
//      to avoid annoying WebStorm warning message: 'default export is not defined in
//      imported module'
//const util = require('util');
// Third-party node modules
import ClipboardJS from 'clipboard';
// Meteor packages
import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';
import { ReactiveDict } from 'meteor/reactive-dict';

// References code in other (Catenis) modules on the client
import { Catenis } from '../ClientCatenis';
import { ClientUtil } from '../ClientUtil';
import { ClientLicenseShared } from '../../both/ClientLicenseShared';

// Import template UI
import './ClientDetailsTemplate.html';

// Import dependent templates
import './ClientLicensesTemplate.js';


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

Template.clientDetails.onCreated(function () {
    this.state = new ReactiveDict();

    this.state.set('addMsgCreditsStatus', 'idle');  // Valid statuses: 'idle', 'data-enter', 'processing', 'error', 'success'
    this.state.set('haveResentEnrollmentEmail', false);
    this.state.set('errMsgs', []);
    this.state.set('infoMsg', undefined);
    this.state.set('infoMsgType', 'info');
    this.state.set('apiAccessSecret', undefined);
    this.state.set('displayResetApiAccessSecretForm', 'none');
    this.state.set('displayResetApiAccessSecretButton', 'none');

    // Subscribe to receive database docs/recs updates
    this.clientRecordSubs = this.subscribe('clientRecord', this.data.client_id);
    this.clientUserSubs = this.subscribe('clientUser', this.data.client_id);
    this.currentClientLicenseSubs = this.subscribe('currentClientLicense', this.data.client_id);
    this.currentLicenseSubs = this.subscribe('currentLicense', this.data.client_id);
});

Template.clientDetails.onDestroyed(function () {
    if (this.clientRecordSubs) {
        this.clientRecordSubs.stop();
    }

    if (this.clientUserSubs) {
        this.clientUserSubs.stop();
    }

    if (this.currentClientLicenseSubs) {
        this.currentClientLicenseSubs.stop();
    }

    if (this.currentLicenseSubs) {
        this.currentLicenseSubs.stop();
    }
});

Template.clientDetails.events({
    'click #btnDismissInfo'(events, template) {
        // Clear info message
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');
    },
    'click #btnDismissError'(events, template) {
        // Clear error message
        template.state.set('errMsgs', []);
    },
    'click #btnResendEnrollment'(events, template) {
        // Reset messages
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', 'Sending client account enrollment e-mail message to customer...');
        template.state.set('infoMsgType', 'info');

        Meteor.call('sendEnrollmentEmail', template.data.client_id, (error) => {
            if (error) {
                template.state.set('infoMsg', undefined);
                template.state.set('infoMsgType', 'info');

                const errMsgs = template.state.get('errMsgs');
                errMsgs.push('Error sending client account enrollment e-mail message: ' + error.toString());
                template.state.set('errMsgs', errMsgs);
            }
            else {
                template.state.set('infoMsg', 'Client account enrollment e-mail message successfully sent');
                template.state.set('infoMsgType', 'success');
            }
            template.state.set('')
        });
    },
    'click #btnResetPassword'(events, template) {
        // Reset alert messages
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', 'Sending client account\'s password reset e-mail message to customer...');
        template.state.set('infoMsgType', 'info');

        Meteor.call('sendResetPasswordEmail',template.data.client_id, (error) => {
            if (error) {
                template.state.set('infoMsg', undefined);
                template.state.set('infoMsgType', 'info');

                const errMsgs = template.state.get('errMsgs');
                errMsgs.push('Error sending client account\'s password reset e-mail message: ' + error.toString());
                template.state.set('errMsgs', errMsgs);
            }
            else {
                template.state.set('infoMsg', 'Client account\'s password reset e-mail message successfully sent');
                template.state.set('infoMsgType', 'success');
            }
        });
    },
    'click #btnApiAccessSecret'(events, template) {
        new ClipboardJS('#btnCopyClipboard', {
            container: document.getElementById('divClientAPIAccessSecret')
        });

        // Reset alert messages
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');

        // Clear local copy of API access secret
        template.state.set('apiAccessSecret', undefined);
        // Make sure that form to reset API access secret is not displayed
        template.state.set('displayResetApiAccessSecretForm', 'none');

        // About to show client's default API key modal window
        Meteor.call('getClientApiAccessSecret', template.data.client_id, (error, apiAccessSecret) => {
            if (error) {
                console.log('Error retrieving client API access secret:', error);
            }
            else {
                template.state.set('apiAccessSecret', apiAccessSecret);
            }
        });
    },
    'click #btnCloseClientAPIAccessSecret1'(events, template) {
        // Delete local copy of API access secret
        template.state.set('apiAccessSecret', undefined);

        return false;
    },
    'click #btnCloseClientAPIAccessSecret2'(events, template) {
        // Delete local copy of API access secret
        template.state.set('apiAccessSecret', undefined);

        return false;
    },
    'click #divClientAPIAccessSecret'(events, template) {
        if (events.target.id === 'divClientAPIAccessSecret') {
            // Delete local copy of API access secret
            template.state.set('apiAccessSecret', undefined);
        }
    },
    'click #btnResetApiAccessSecret'(events, template) {
        // Reset reset all devices too option
        $('#cbxResetAllDevices')[0].checked = false;

        // Reset confirmation
        $('#itxActionConfirmation')[0].value = '';
        template.state.set('displayResetApiAccessSecretButton', 'none');

        // Display form to reset client's default API access secret
        template.state.set('displayResetApiAccessSecretForm', 'block');

        return false;
    },
    'click #btnCancelResetApiAccessSecret'(events, template) {
        // Hide form to reset API access secret
        template.state.set('displayResetApiAccessSecretForm', 'none');

        return false;
    },
    'change #itxActionConfirmation'(event, template) {
        if (event.target.value.trim().toLowerCase() === 'yes, i do confirm it') {
            // Show button to reset API access secret
            template.state.set('displayResetApiAccessSecretButton', 'inline');
        }
    },
    'submit #formClientApiAccessSecret'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        const form = event.target;
        let confirmMsg = 'LAST CHANCE!\n\nIf you proceed, the client\'s default API access secret will be reset';

        if (form.resetAllDevices.checked) {
            confirmMsg += ', ALONG WITH the API access secret FOR ALL DEVICES of this client'
        }

        confirmMsg += '.\n\nPLEASE NOTE THAT THIS ACTION CANNOT BE UNDONE.';

        if (confirm(confirmMsg)) {
            // Reset alert messages
            template.state.set('errMsgs', []);
            template.state.set('infoMsg', undefined);
            template.state.set('infoMsgType', 'info');

            Meteor.call('resetClientApiAccessSecret', Template.instance().data.client_id , form.resetAllDevices.checked, (error, key) => {
                if (error) {
                    const errMsgs = template.state.get('errMsgs');
                    errMsgs.push('Error resetting client\'s default API access secret: ' + error.toString());
                    template.state.set('errMsgs', errMsgs);
                }
                else {
                    template.state.set('infoMsg', 'Successfully reset client\'s default API access secret');
                    template.state.set('infoMsgType', 'success');
                }
            });

            // Close modal panel
            $('#btnCloseClientAPIAccessSecret2').click();
        }
        else {
            $('#btnCancelResetApiAccessSecret').click();
        }
    },

    //in future, these two functions below should be coalesced to become a single changeUserStatus function, that takes in
    //the parameter of current status and flips it other way. Be mindful that there are three statuses, activated, deactivated, and pending.

    //NOTE: this is not linked to the deactivation of the Catenis Clients, so they have to be implemented as well.
    'click #activateUser'(events, template) {
        const client = Catenis.db.collection.Client.findOne({user_id: Template.instance().data.user_id});

        if( confirm("you're about to activate this user. Are you sure?")===true){
            Meteor.call('changeUserStatus', client.user_id, 'Activated', (error) => {
                if (error) {
                    console.log("there was an error activating user", error);
                }
            });
        }

    },
    'click #deactivateUser'(events, template) {
        const client = Catenis.db.collection.Client.findOne({user_id: Template.instance().data.user_id});

        if(confirm("you're about to deactivate this user and all linked devices. Are you sure?")===true){
            Meteor.call('changeUserStatus', client.user_id, 'Deactivated', (error) => {
                if (error) {
                    console.log("there was an error deactivating user", error);
                }
            });
        }

    },


    'click #editForm': function(event, template){

        let userId= event.target.value;
        let user=Meteor.users.findOne({_id: userId});

        // Populate the form fields with the data from the current form.
        $('#updateForm')
            .find('[name="clientName"]').val(user.profile.name).end()
            .find('[name="username"]').val(user.username).end()
            .find('[name="email"]').val(user.emails? user.emails[0].address: "" ).end()
            .find('[name="confirmEmail"]').val(user.emails? user.emails[0].address: "").end()
            .find('[name="firstName"]').val(user.profile.firstname).end()
            .find('[name="lastName"]').val(user.profile.lastname).end()
            .find('[name="companyName"]').val(user.profile.company).end();
    },

    'submit #updateForm'(event, template){
        event.preventDefault();
        const form = event.target;
        // Reset errors
        template.state.set('errMsgs', []);
        template.state.set('successfulUpdate', false);
        let errMsgs = [];
        let clientInfo;

        if ((clientInfo = validateFormData(form, errMsgs))) {
            // Call remote method to update client
            Meteor.call('updateUser', clientInfo, (error) => {
                if (error) {
                    template.state.set('errMsgs', [
                        error.toString()
                    ]);
                }

                else {
                    // Catenis client successfully updated
                    template.state.set('successfulUpdate', true);

                    //close modal form
                    $('#updateFormModal').modal('hide');
                    $('body').removeClass('modal-open');
                    $('.modal-backdrop').remove();
                }
            });
        } else {
            template.state.set('errMsgs', errMsgs);
        }

    }
});

Template.clientDetails.helpers({
    client() {
        return Catenis.db.collection.Client.findOne({_id: Template.instance().data.client_id});
    },
    clientTitle(client) {
        return client.props.name || client.clientId;
    },
    clientUsername(user_id) {
        const user = Meteor.users.findOne({_id: user_id});

        return user ? user.username : undefined;
    },
    clientCustomerName(client) {
        let custName = client.props.firstName;

        if (client.props.lastName) {
            if (custName) {
                custName += ' ';
            }

            custName += client.props.lastName;
        }

        return custName;
    },
    clientUserEmail(user_id) {
        const user = Meteor.users.findOne({_id: user_id});

        return ClientUtil.getUserEmail(user);
    },
    clientLicenseName(client_id) {
        const docClientLicense = Catenis.db.collection.ClientLicense.findOne({
            client_id: client_id,
            status: ClientLicenseShared.status.active.name
        }, {
            sort: {
                'validity.startDate': -1,
                activatedDate: -1
            }
        });

        if (docClientLicense) {
            const docLicense = Catenis.db.collection.License.findOne({_id: docClientLicense.license_id});

            if (docLicense) {
                let licName = ClientUtil.capitalize(docLicense.level);

                if (docLicense.type) {
                    licName += ' (' + docLicense.type + ')';
                }

                return licName;
            }
        }
    },
    clientLicenseExpiration(client) {
        const docClientLicenses = Catenis.db.collection.ClientLicense.find({
            client_id: client._id,
            status: {
                $in: [
                    ClientLicenseShared.status.active.name,
                    ClientLicenseShared.status.provisioned.name
                ]
            }
        }, {
            fields: {
                _id: 1,
                validity: 1,
                status: 1
            },
            sort: {
                status: 1,
                activatedDate: 1,
                provisionedDate: 1
            }
        }).fetch();

        let expirationDate;

        if (docClientLicenses.length > 0) {
            let docLastActvLicense;
            let docLastProvLicense;

            docClientLicenses.some((doc) => {
                if (doc.status === ClientLicenseShared.status.active.name) {
                    // Update active license (and last provisioned license)
                    docLastProvLicense = docLastActvLicense = doc;
                }
                else { // doc.status === ClientLicenseShared.status.provisioned.name
                    if (docLastActvLicense) {
                        if (!docLastProvLicense.validity.endDate || doc.validity.startDate <= docLastProvLicense.validity.endDate) {
                            // Provisioned license starts before previous provisioned license ends.
                            //  Update last provisioned license
                            docLastProvLicense = doc;
                        }
                        else {
                            // Provisioned license starts after previous provisioned license ends.
                            //  Stop iteration
                            return true;
                        }
                    }
                    else {
                        // No active license. Stop iteration
                        return true;
                    }
                }

                // Continue iteration
                return false;
            });

            if (docLastProvLicense && docLastProvLicense.validity.endDate) {
                expirationDate = docLastProvLicense.validity.endDate;
            }
        }

        return expirationDate ? ClientUtil.startOfDayTimeZone(expirationDate, client.timeZone, true).format('LLLL') : undefined;
    },
    isNewClient(client) {
        return client.status === 'new';
    },
    isActiveClient(client) {
        return client.status === 'active';
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
    clientApiAccessSecret() {
        return Template.instance().state.get('apiAccessSecret');
    },
    displayResetApiAccessSecretForm() {
        return Template.instance().state.get('displayResetApiAccessSecretForm');
    },
    reverseDisplay(display) {
        return display === 'none' ? 'block' : 'none';
    },
    displayResetApiAccessSecretButton() {
        return Template.instance().state.get('displayResetApiAccessSecretButton');
    },

    messageCredits: function () {
        return 0;//Catenis.db.collection.MessageCredits.findOne(1);
    },
    hasUnconfirmedMessageCredits: function (messageCredits) {
        return messageCredits && messageCredits.unconfirmed > 0;
    },
    // compareOper: valid values: 'equal'/'any-of', 'not-equal'/'none-of'
    checkAddMsgCreditsStatus: function (status, compareOper) {
        compareOper = compareOper && (Array.isArray(status) ? 'all-of' : 'equal');
        const currentStatus = Template.instance().state.get('addMsgCreditsStatus');
        let result = false;

        if (compareOper === 'equal' || compareOper === 'any-of') {
            if (Array.isArray(status)) {
                result = status.some((stat) => stat === currentStatus);
            }
            else {
                result = status === currentStatus;
            }
        }
        else if (compareOper === 'not-equal' || compareOper === 'none-of') {
            if (Array.isArray(status)) {
                result = !status.some((stat) => stat === currentStatus);
            }
            else {
                result = status !== currentStatus;
            }
        }
        return result;
    },
    addMsgCreditsError: function () {
        return Template.instance().state.get('addMsgCreditsError');
    },
    showDevices: function () {
        return Template.instance().state.get('showDevices');
    },
    haveResentEnrollmentEmail: function(){
        return Template.instance().state.get('haveResentEnrollmentEmail');
    },
    userActive: function(){
        const user= Meteor.users.findOne({_id:  Template.instance().data.user_id});
        if(user){
            if(user.profile.status==="Activated"){
                return true;
            }else{
                return false;
            }
        }else{
            return undefined;
        }
    },
    userStatus:function(user_id){
        const user= Meteor.users.findOne({_id: user_id});
        if(user){
           return user.profile.status;
        }else{
            return "undefined(error)";
        }
    },
    resendEnrollmentEmailSuccess: function(){
        return Template.instance().state.get('resendEnrollmentEmailSuccess');
    },
    licenseType: function(user_id){
        const user= Meteor.users.findOne( {_id: user_id} );
        let licenseType;
        if( user && user.profile && user.profile.license ){
            licenseType= user.profile.license.licenseType;
           return licenseType;
        }else{
            return "user has no license";
        }
    },
    successfulUpdate: function(){
        return Template.instance().state.get('successfulUpdate');
    },
    numDevices: function(opt){
        const client = Catenis.db.collection.Client.findOne({user_id: Template.instance().data.user_id});
        const numUserDevices= Catenis.db.collection.Device.find( {"client_id": {$eq: client._id } } ).count();

        if(opt==="active"){
            return numUserDevices;

        }else if(opt==="available"){
            let licenseType;
            if(Meteor.users.findOne( {_id: client.user_id} ).profile.license){

                licenseType= Meteor.users.findOne( {_id: client.user_id} ).profile.license.licenseType;

                if(licenseType==="Enterprise"){

                    return 'unlimited';

                }else{

                    let numAllowed;
                    // needs to be changed if the numAllowed value for license gets changed.
                    // NOTE: could be used to indicate how many devices the user is overusing.
                    numAllowed= Catenis.db.collection.License.findOne({licenseType: licenseType}).numAllowedDevices;

                    return numAllowed- numUserDevices< 0 ? "user is overusing "+ (numUserDevices-numAllowed).toString()+" devices": numAllowed- numUserDevices;
                }

            }else{
                return "user has no license";
            }

        }else{
            return "something went wrong";
        }
    },
    // Takes in input of licenseType, returns the number of devices allowed
    devicesForLicense: function(licenseType){
        return Catenis.db.collection.License.findOne({licenseType: licenseType}).numAllowedDevices;
    }
});
