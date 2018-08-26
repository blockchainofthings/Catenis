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
import './UserAccountTemplate.js';
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
});

Template.adminLayout.onDestroyed(function () {
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
