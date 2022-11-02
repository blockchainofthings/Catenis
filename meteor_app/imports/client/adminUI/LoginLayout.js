/**
 * Created by Claudio on 2018-07-12.
 */

//console.log('[LoginLayout.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
//import config from 'config';
// Meteor packages
import { Template } from "meteor/templating";
import { Meteor } from "meteor/meteor";
import { ReactiveDict } from 'meteor/reactive-dict';

// Import template UI
import './LoginLayout.html';

// References code in other (Catenis) modules on the client
import { activateGTag } from './GoogleAnalytics';


// Definition of module (private) functions
//

function redirectHome() {
    let redirected = false;
    const user = Meteor.user();
    const user_id = user ? user._id : Meteor.userId();

    if (Roles.userIsInRole(user_id, 'sys-admin')) {
        FlowRouter.go('/admin');
        redirected = true;
    }
    else if (Roles.userIsInRole(user_id, 'ctn-client')) {
        FlowRouter.go('/');
        redirected = true;
    }

    return redirected;
}

const remoteProps = [
    'appEnv',
    'selfRegistration'
];

/**
 * Checks whether all remote properties have already been loaded
 * @param {Object} template
 * @returns {boolean}
 */
function allRemotePropsLoaded(template) {
    return remoteProps.every(prop => template.state.get(prop) !== undefined);
}

/**
 * Checks whether Catenis is running on a public environment
 * @param {Object} template
 * @returns {boolean}
 */
function isPublicEnvironment(template) {
    let env = template.state.get('appEnv');
    env = env && env.toLowerCase();

    return env === 'sandbox' || env === 'production';
}

/**
 * Conditionally activate and trigger Google Analytics
 * @param {Object} template
 */
function checkActivateAndTriggerGA(template) {
    if (allRemotePropsLoaded(template)) {
        const selfRegistration = template.state.get('selfRegistration');

        if (selfRegistration && selfRegistration.enabled && isPublicEnvironment(template)) {
            activateGTag();
            triggerGA();
        }
    }
}

/**
 * Triggers Google Analytics tracking for Account Registration form if enabled
 */
function triggerGA () {
    if (typeof gtag === 'function') {
        gtag('event', 'conversion', {
            'send_to': 'AW-804580870/7lHwCPT_-4AYEIbc0_8C'
        });
    }
}

/**
 * Indicates whether this is the Account Registration URL used by Google Ads
 * @returns {boolean}
 */
function isAccountRegistrationUrl() {
    return /\/register\/?\?gtag$/i.test(document.location.href);
}


// Module code
//

Template.loginLayout.onCreated(function () {
    this.state = new ReactiveDict();

    this.state.set('appEnv', undefined);

    Meteor.call('getAppEnvironment', (err, env) => {
        if (err) {
            console.log('Error calling \'getAppEnvironment\' remote procedure.', err);
        }
        else {
            this.state.set('appEnv', env);

            if (isAccountRegistrationUrl()) {
                checkActivateAndTriggerGA(this);
            }
        }
    });

    this.state.set('selfRegistration', undefined);

    Meteor.call('getSelfRegistrationSettings', (err, selfRegistration) => {
        if (err) {
            console.log('Error calling \'getSelfRegistrationSettings\' remote procedure: ' + err);
        }
        else {
            this.state.set('selfRegistration', selfRegistration);

            if (isAccountRegistrationUrl()) {
                checkActivateAndTriggerGA(this);
            }
        }
    });

    this.currentUserSubs = this.subscribe('currentUser');
});

Template.loginLayout.onDestroyed(function () {
    if (this.currentUserSubs) {
        this.currentUserSubs.stop();
    }
});

Template.loginLayout.events({
    'click #lnkCtnTitle'(event, template) {
        redirectHome();
        return false;
    }
});

Template.loginLayout.helpers({
    tryRedirect() {
        return AccountsTemplates.getState() === 'signIn' && redirectHome();
    },
    appEnvironment() {
        return Template.instance().state.get('appEnv');
    },
    selfRegistration() {
        return Template.instance().state.get('selfRegistration');
    },
    isNonProdEnvironment(env) {
        return env && env.toLowerCase() !== 'production';
    },
    capitalize(str) {
        if (str) {
            return str.substr(0, 1).toUpperCase() + str.substr(1);
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
    }
});
