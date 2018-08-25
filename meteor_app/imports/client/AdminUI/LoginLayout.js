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

// Import dependent templates
//import './enrollAccount.js';
//import './resetPwd.js';


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
    isNonProdEnvironment(env) {
        return env && env.toLowerCase() !== 'production';
    },
    capitalize(str) {
        if (str) {
            return str.substr(0, 1).toUpperCase() + str.substr(1);
        }
    }
});
