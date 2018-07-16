/**
 * Created by Claudio on 2017-05-12.
 */

//console.log('[Routes.js]: This code just ran.');

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
//import { Meteor } from 'meteor/meteor';
import { FlowRouter } from 'meteor/kadira:flow-router';
import { BlazeLayout } from 'meteor/kadira:blaze-layout';

// Import templates
import './AdminUI/LoginLayout.js';
import './AdminUI/AdminLayout.js';
import './clientUI/ClientLayout.js';

// Module code
//

BlazeLayout.setRoot('body');

// Note: special routes for accounts templates configured at ConfigAccount.js module (via AccountsTemplates.configureRoutes)
//      since that code needs to be rum on both client and server

// Regular routes
FlowRouter.route('/', {
    action: function () {
        BlazeLayout.render('clientLayout');
    }
});

FlowRouter.route('/updateProfile', {
    action: function () {
        BlazeLayout.render('clientLayout', {
            page: 'updateProfile'
        });
    }
});

FlowRouter.route('/devices', {
    action: function() {
        BlazeLayout.render('clientLayout', {
            page: 'userNewDevice',
        });
    }
});

FlowRouter.route('/devices/:device_id', {
    action: function (params) {
        BlazeLayout.render('clientLayout', {
            page: 'deviceDetails',
            dataContext: {
                device_id: params.device_id
            }
        });
    }
});

FlowRouter.route('/admin', {
    action: function () {
        BlazeLayout.render('adminLayout');
    }
});

FlowRouter.route('/admin/updateProfile', {
    action: function () {
        BlazeLayout.render('adminLayout',{
            page: 'updateProfile'
        });
    }
});

FlowRouter.route('/admin/bcotprice', {
    action: function () {
        BlazeLayout.render('adminLayout', {
            page: 'bcotPrice'
        });
    }
});

FlowRouter.route('/admin/sysfunding', {
    action: function () {
        BlazeLayout.render('adminLayout', {
            page: 'systemFunding'
        });
    }
});

FlowRouter.route('/admin/clients', {
    action: function () {
        BlazeLayout.render('adminLayout', {
            page: 'clients'
        });
    }
});

FlowRouter.route('/admin/clients/:user_id', {
    action: function (params, queryParams) {
        const dataContext = {
            user_id: params.user_id
        };

        if (queryParams.showDevices) {
            dataContext.showDevices = true;
        }

        BlazeLayout.render('adminLayout', {
            page: 'clientDetails',
            dataContext: dataContext
        });
    }
});

FlowRouter.route('/admin/clients/:user_id/devices/:device_id', {
    action: function (params) {
        BlazeLayout.render('adminLayout', {
            page: 'deviceDetails',
            dataContext: {
                user_id: params.user_id,
                device_id: params.device_id
            }
        });
    }
});

FlowRouter.route('/admin/newclient', {
    action: function (params, queryParams) {
        BlazeLayout.render('adminLayout', {
            page: 'newClient'
        });
    }
});

FlowRouter.route('/admin/clients/:user_id/newdevice', {
    action: function (params, queryParams) {
        BlazeLayout.render('adminLayout', {
            page: 'newDevice',
            dataContext: {
                user_id: params.user_id
            }
        });
    }
});

FlowRouter.route('/credits', {
    action: function (params, queryParams) {
        BlazeLayout.render('clientLayout', {
            page: 'creditPrices'
        });
    }
});
