/**
 * Created by claudio on 2021-09-24
 */

//console.log('[NotFoundLayout.js]: This code just ran.');

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
import './NotFoundLayout.html';


// Definition of module (private) functions
//

function redirectHome() {
    let redirected = false;
    const user = Meteor.user();
    const user_id = user ? user._id : Meteor.userId();
    console.debug('redirectHome():', user, user_id);

    if (user_id) {
        if (Roles.userIsInRole(user_id, 'sys-admin')) {
            FlowRouter.go('/admin');
            redirected = true;
        }
        else if (Roles.userIsInRole(user_id, 'ctn-client')) {
            FlowRouter.go('/');
            redirected = true;
        }
    }

    if (!redirected) {
        FlowRouter.go('/login');
    }
}


// Module code
//

Template.notFoundLayout.onCreated(function () {
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

Template.notFoundLayout.events({
    'click #lnkCtnTitle'(event, template) {
        redirectHome();
        return false;
    }
});

Template.notFoundLayout.helpers({
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
