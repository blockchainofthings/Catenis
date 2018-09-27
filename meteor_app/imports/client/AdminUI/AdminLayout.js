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
import './AdminHomeTemplate.js';
import './UserAccountTemplate.js';
import './BcotPriceTemplate.js';
import './SystemFundingTemplate.js';
import './BcotUsageReportTemplate.js';
import './LicensesTemplate.js';
import './ClientsTemplate.js';
import './DeviceDetailsTemplate.js';
import './NewClientTemplate.js';
import './NewDeviceTemplate.js';


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

function getSidebarNavEntry(pageName) {
    const navEntries = $('.sideNavButtons').toArray();

    for (let idx = 0, limit = navEntries.length; idx < limit; idx++) {
        const navEntry = navEntries[idx];

        if (navEntry.children[0].href.endsWith('/' + pageName)) {
            return navEntry;
        }
    }
}

function selectSidebarNavEntry(navEntry) {
    if (navEntry) {
        navEntry.style.backgroundColor = '#5555bb';
        Array.from(navEntry.children).forEach(childElem => childElem.style.color = 'white');
    }
}


// Module code
//

Template.adminLayout.onCreated(function () {
    this.state = new ReactiveDict();

    this.state.set('appEnv', undefined);
    this.state.set('initializing', true);

    Meteor.call('getAppEnvironment', (err, env) => {
        if (err) {
            console.log('Error calling \'getAppEnvironment\' remote procedure.', err);
        }
        else {
            this.state.set('appEnv', env);
        }
    });
});

Template.adminLayout.onDestroyed(function () {
});

Template.adminLayout.events({
    'click #sidebar-wrapper'(event, template) {
        if (template.state.get('initializing')) {
            template.state.set('initializing', false);
            selectSidebarNavEntry(getSidebarNavEntry(template.data.page().toLowerCase()));
        }
    },
    'click #lnkLogout'(event, template) {
        AccountsTemplates.logout();
        return false;
    },
    'click .menu-toggle'(event, template) {
        $('#wrapper').toggleClass('toggled');
        return false;
    },
    'click .sideNavButtons'(event, template) {
        // Reset color of all sidebar nav entries
        $('.sideNavButtons').toArray().forEach((navEntry) => {
            navEntry.style.backgroundColor = '#e8e9ec';
            Array.from(navEntry.children).forEach(childElem => childElem.style.color = '');
        });

        // Set color of selected sidebar nav entry
        event.currentTarget.style.backgroundColor = '#5555bb';
        Array.from(event.currentTarget.children).forEach(childElem => childElem.style.color = 'white');
    },
    'click .navbar-brand'(event, template) {
        // Reset color of all sidebar nav entries
        $('.sideNavButtons').toArray().forEach((navEntry) => {
            navEntry.style.backgroundColor = '#e8e9ec';
            Array.from(navEntry.children).forEach(childElem => childElem.style.color = '');
        });

        redirectHome();
        return false;
    },
    'click .userMenuEntry'(event, template) {
        // Reset color of all sidebar nav entries
        $('.sideNavButtons').toArray().forEach((navEntry) => {
            navEntry.style.backgroundColor = '#e8e9ec';
            Array.from(navEntry.children).forEach(childElem => childElem.style.color = '');
        });
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
