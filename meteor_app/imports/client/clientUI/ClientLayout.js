/**
 * Created by Claudio on 2017-08-07.
 */
//console.log('[ClientLayout.js]: This code just ran.');

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
import { _ } from 'meteor/underscore';

// References code in other (Catenis) modules on the client
import { Catenis } from '../ClientCatenis';

// Import template UI
import './ClientLayout.html';

// Import dependent templates
import './ClientHomeTemplate.js';
import './ClientProfileTemplate.js';
import './ClientClientLicensesTemplate.js';
import './ClientApiAccessTemplate.js';
import './ClientPaidServicesTemplate.js';
import './ClientServiceAccountTemplate.js';
import './ClientDevicesTemplate.js';
import './ClientResourcesTemplate.js';
import './ClientOwnedDomainsTemplate.js';
import './ClientForeignBlockchainsTemplate.js';
import './ClientUserNotificationsTemplate.js';


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

function changeNavStructures(width) {
    const wrapper = $('#wrapper');

    if (width < 580 && wrapper.attr('class') !== 'toggled') {
        wrapper.addClass('toggled');
    }
}

function onWindowResize() {
    const width = $(window).width();
    changeNavStructures(width);
}

function getSidebarNavEntry(path) {
    // Note: the second argument of the URL constructor (the 'base') is not relevant here,
    //        but it is required to successfully parse a relative URL
    const currentUrlPath = addTrailingSlash(new URL(path, 'http://catenis.io').pathname.toLowerCase());
    const navEntries = $('.sideNavButtons').toArray();

    for (let idx = 0, limit = navEntries.length; idx < limit; idx++) {
        const navEntry = navEntries[idx];

        // Note: the second argument of the URL constructor (the 'base') is not relevant here,
        //        but it is required to successfully parse a relative URL
        if (currentUrlPath.startsWith(addTrailingSlash(new URL(navEntry.children[0].href, 'http://catenis.io').pathname.toLowerCase()))) {
            return navEntry;
        }
    }
}

function addTrailingSlash(path) {
    return path.endsWith('/') ? path : path + '/';
}

function selectSidebarNavEntry(navEntry, clearNavEntries) {
    if (clearNavEntries) {
        // Reset color of all sidebar nav entries
        $('.sideNavButtons').toArray().forEach((navEntry) => {
            navEntry.style.backgroundColor = '#e8e9ec';
            Array.from(navEntry.children).forEach(childElem => childElem.style.color = '');
        });
    }

    if (navEntry) {
        navEntry.style.backgroundColor = '#5555bb';
        Array.from(navEntry.children).forEach(childElem => childElem.style.color = 'white');
    }
}

// Hide modal windows' shaded background and re-enable scrolling
function disableModal() {
    const $modalBackdrop = $('.modal-backdrop');

    if ($modalBackdrop.length > 0) {
        $modalBackdrop.remove();
        $('body').removeClass('modal-open');
    }
}


// Module code
//

const throttledOnWindowResize = _.throttle(onWindowResize, 200, {
    leading: false
});

// Solution to disable any side effect caused by navigating backwards
//  (clicking the browser's back button) when a modal window is open.
//  The modal window itself is automatically hidden but the shaded
//  background still remains visible
window.onpopstate = disableModal;

Template.clientLayout.onCreated(function () {
    this.state = new ReactiveDict();

    this.state.set('appEnv', undefined);
    this.state.set('initializing', true);

    // Subscribe to receive database docs/recs updates
    this.subscribe('userNotificationInfo');

    Meteor.call('getAppEnvironment', (err, env) => {
        if (err) {
            console.log('Error calling \'getAppEnvironment\' remote procedure.', err);
        }
        else {
            this.state.set('appEnv', env);
        }
    });
});

Template.clientLayout.onDestroyed(function(){
    $(window).off('resize', throttledOnWindowResize);
});

Template.clientLayout.onRendered(function(){
    $(window).resize(throttledOnWindowResize);
});

Template.clientLayout.events({
    'click #sidebar-wrapper'(event, template) {
        if (template.state.get('initializing')) {
            // Sidebar control just loaded on page
            template.state.set('initializing', false);

            // Set mechanism to watch for path change and select sidebar nav entry appropriately
            Tracker.autorun(function() {
                FlowRouter.watchPathChange();

                const path = FlowRouter.current().path;

                if (path) {
                    selectSidebarNavEntry(getSidebarNavEntry(path), !template.state.get('initializing'));
                }
            });
        }
    },
    'click #lnkLogout'(event, template) {
        AccountsTemplates.logout();
        return false;
    },
    'click .menu-toggle'(event, template){
        $('#wrapper').toggleClass('toggled');
        return false;
    },
    'click .navbar-brand'(event, template) {
        redirectHome();
        return false;
    }
});

Template.clientLayout.helpers({
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
    },
    unreadNotifications() {
        const unreadCount = Catenis.db.collection.UserNotificationInfo.findOne({_id: 1}).unreadCount;

        return unreadCount ? unreadCount : '';
    }
});

