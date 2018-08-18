/**
 * Created by claudio on 15/05/17.
 */

//console.log('[AdminLayout.js]: This code just ran.');

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
//import config from 'config';
// Meteor packages
import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';
import { ReactiveDict } from 'meteor/reactive-dict';

// Import template UI
import './AdminLayout.html';

// Import dependent templates
import './LoginTemplate.js';
import './BcotPriceTemplate';
import './SystemFundingTemplate.js';
import './BcotUsageReportTemplate.js';
import './ClientsTemplate.js';
import './DeviceDetailsTemplate.js';
import './NewClientTemplate.js';
import './NewDeviceTemplate.js';


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

Template.adminLayout.events({
    'click #lnkLogout'(event, template) {
        Meteor.logout();

        return false;
    }
});

Template.adminLayout.helpers({
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