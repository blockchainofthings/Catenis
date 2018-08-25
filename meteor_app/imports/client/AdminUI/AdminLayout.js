/**
 * Created by Claudio on 2017-05-15.
 */

//console.log('[AdminLayout.js]: This code just ran.');

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
import { FlowRouter } from 'meteor/kadira:flow-router';
import { AccountsTemplates } from 'meteor/useraccounts:core';

// References code in other (Catenis) modules on the client
import { Catenis } from '../ClientCatenis';

// Import template UI
import './AdminLayout.html';

// Import dependent templates
import './LoginTemplate.js';
import './BcotPriceTemplate.js';
import './SystemFundingTemplate.js';
import './ClientsTemplate.js';
import './DeviceDetailsTemplate.js';
import './NewClientTemplate.js';
import './NewDeviceTemplate.js';
import '../clientUI/updateProfile.js'


// Definition of module (private) functions
//

function redirectHome() {
    const user = Meteor.user();
    const user_id = user ? user._id : Meteor.userId();

    if (Roles.userIsInRole(user_id, 'sys-admin')) {
        FlowRouter.go('/admin');
    }
    else if (Roles.userIsInRole(user_id, 'ctn-client')) {
        FlowRouter.go('/');
    }
}


// Module code
//

Template.adminLayout.onCreated(function () {
    this.state = new ReactiveDict();

    this.state.set('appEnv', undefined);

    Meteor.call('getAppEnvironment', (err, env) => {
        if (err) {
            console.log('Error calling \'getAppEnvironment\' remote procedure.', err);
        }
        else {
            this.state.set('appEnv', env);
        }
    });

    this.licenseSubs = this.subscribe('license');
});

Template.adminLayout.onDestroyed(function () {
    if (this.licenseSubs) {
        this.licenseSubs.stop();
    }
});

Template.adminLayout.events({
    'click #lnkLogout'(event, template) {
        AccountsTemplates.logout();
        return false;
    },
    'click .menu-toggle'(event, template) {
        $('#wrapper').toggleClass('toggled');
        return false;
    },
    'click #changeLicenseConfigButton'(event, template) {
        // Populate the form fields with the data from the current data.
        $('#changeLicenseConfigForm')
        .find('[name="starter"]').val(Catenis.db.collection.License.findOne({licenseType: 'Starter'}).numAllowedDevices).end()
        .find('[name="basic"]').val(Catenis.db.collection.License.findOne({licenseType: 'Basic'}).numAllowedDevices).end()
        .find('[name="professional"]').val(Catenis.db.collection.License.findOne({licenseType: 'Professional'}).numAllowedDevices).end()
        .find('[name="enterprise"]').val(Catenis.db.collection.License.findOne({licenseType: 'Enterprise'}).numAllowedDevices).end();
    },
    'submit #changeLicenseConfigForm'(event, template) {
        const form = event.target;
        let licenseConfig = {};

        licenseConfig.starter = form.starter.value ? form.starter.value : Catenis.db.collection.License.findOne({licenseType: 'Starter'}).numAllowedDevices;
        licenseConfig.basic = form.basic.value ? form.basic.value : Catenis.db.collection.License.findOne({licenseType: 'Basic'}).numAllowedDevices;
        licenseConfig.professional = form.professional.value ? form.professional.value : Catenis.db.collection.License.findOne({licenseType: 'Professional'}).numAllowedDevices;
        licenseConfig.enterprise = form.enterprise.value ? form.enterprise.value : Catenis.db.collection.License.findOne({licenseType: 'Enterprise'}).numAllowedDevices;

        // Call remote method to update client
        Meteor.call('updateLicenseConfig', licenseConfig, (error) => {
            if (error) {
                console.log('error attempting to update license configuration', error);
            }
            else {
                // Catenis client successfully updated

                // Close modal form
                $('#updateFormModal').modal('hide');
                $('body').removeClass('modal-open');
                $('.modal-backdrop').remove();
            }
        });
    },
    'click .sideNavButtons'(event, template) {
        // Change all colors to original color
        const sideNav = document.getElementsByClassName('sideNavButtons');

        for (let i = 0; i < sideNav.length; i++) {
            sideNav[i].style.backgroundColor = '#e8e9ec';
            $(sideNav[i]).children()[0].style = '';
            $(sideNav[i]).children()[1].style = '';

            // sideNav[i].style.color = "#333399";
            sideNav[i].style = '';
        }

        (event.currentTarget).style.backgroundColor = '#5555bb';
        $(event.currentTarget).children()[0].style.color = 'white';
        $(event.currentTarget).children()[1].style.color = 'white';
    },
    'click .navbar-brand'(event, template) {
        redirectHome();
        return false;
    },
    'click #lnkCtnTitle'(event, template) {
        redirectHome();
        return false;
    }
});

Template.adminLayout.helpers({
    login() {
        if (!Meteor.user() && !Meteor.userId()) {
            FlowRouter.go('/login');
        }
    },
    appEnvironment() {
        return Template.instance().state.get('appEnv');
    },
    isNonProdEnvironment(env) {
        return env && env.toLowerCase() !== 'production';
    },
    capitalize(str) {
        if (str) {
            return str.substr(0, 1).toUpperCase() + str.substr(1);
        }
    }
});
