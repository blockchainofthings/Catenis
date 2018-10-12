/**
 * Created by Claudio on 2017-05-12.
 */

//console.log('[Routes.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
//import config from 'config';
// Meteor packages
//import { Meteor } from 'meteor/meteor';
import { FlowRouter } from 'meteor/kadira:flow-router';
import { BlazeLayout } from 'meteor/kadira:blaze-layout';

// Import templates
import './adminUI/LoginLayout.js';
import './adminUI/AdminLayout.js';
import './clientUI/ClientLayout.js';

// Module code
//

BlazeLayout.setRoot('body');

// Note: special routes for accounts templates configured at ConfigAccount.js module (via AccountsTemplates.configureRoutes)
//      since that code needs to be rum on both client and server

// Client admin routes
//
FlowRouter.route('/', {
    action: function () {
        BlazeLayout.render('clientLayout', {
            page: 'clientHome'
        });
    }
});

FlowRouter.route('/clientaccount', {
    action: function () {
        BlazeLayout.render('clientLayout',{
            page: 'clientAccount'
        });
    }
});

FlowRouter.route('/licenses/', {
    action: function () {
        BlazeLayout.render('clientLayout',{
            page: 'clientClientLicenses'
        });
    }
});

FlowRouter.route('/licenses/:clientLicense_id', {
    action: function (params) {
        BlazeLayout.render('clientLayout',{
            page: 'clientClientLicenseDetails',
            dataContext: {
                clientLicense_id: params.clientLicense_id
            }
        });
    }
});

FlowRouter.route('/apiaccess', {
    action: function () {
        BlazeLayout.render('clientLayout',{
            page: 'clientApiAccess'
        });
    }
});

FlowRouter.route('/serviceaccount', {
    action: function () {
        BlazeLayout.render('clientLayout',{
            page: 'clientServiceAccount'
        });
    }
});

FlowRouter.route('/devices', {
    action: function () {
        BlazeLayout.render('clientLayout',{
            page: 'clientDevices'
        });
    }
});

// System administration routes
//
FlowRouter.route('/admin', {
    action: function () {
        BlazeLayout.render('adminLayout', {
            page: 'adminHome'
        });
    }
});

FlowRouter.route('/admin/useraccount', {
    action: function () {
        BlazeLayout.render('adminLayout',{
            page: 'userAccount'
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

FlowRouter.route('/admin/systemfunding', {
    action: function () {
        BlazeLayout.render('adminLayout', {
            page: 'systemFunding'
        });
    }
});

FlowRouter.route('/admin/bcotusagereport', {
    action: function () {
        BlazeLayout.render('adminLayout', {
            page: 'bcotUsageReport'
        });
    }
});

FlowRouter.route('/admin/licenses', {
    action: function () {
        BlazeLayout.render('adminLayout', {
            page: 'licenses'
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

FlowRouter.route('/admin/licenses/:license_id', {
    action: function (params) {
        BlazeLayout.render('adminLayout', {
            page: 'licenseDetails',
            dataContext: {
                license_id: params.license_id
            }
        });
    }
});

FlowRouter.route('/admin/clients/new', {
    action: function (params, queryParams) {
        BlazeLayout.render('adminLayout', {
            page: 'newClient'
        });
    }
});

FlowRouter.route('/admin/clients/:client_id', {
    action: function (params, queryParams) {
        BlazeLayout.render('adminLayout', {
            page: 'clientDetails',
            dataContext: {
                client_id: params.client_id
            }
        });
    }
});

FlowRouter.route('/admin/clients/:client_id/edit', {
    action: function (params, queryParams) {
        BlazeLayout.render('adminLayout', {
            page: 'editClient',
            dataContext: {
                client_id: params.client_id
            }
        });
    }
});

FlowRouter.route('/admin/clients/:client_id/licenses', {
    action: function (params, queryParams) {
        BlazeLayout.render('adminLayout', {
            page: 'clientLicenses',
            dataContext: {
                client_id: params.client_id
            }
        });
    }
});

FlowRouter.route('/admin/clients/:client_id/licenses/new', {
    action: function (params, queryParams) {
        BlazeLayout.render('adminLayout', {
            page: 'newClientLicense',
            dataContext: {
                client_id: params.client_id
            }
        });
    }
});

FlowRouter.route('/admin/clients/:client_id/licenses/:clientLicense_id', {
    action: function (params, queryParams) {
        BlazeLayout.render('adminLayout', {
            page: 'clientLicenseDetails',
            dataContext: {
                client_id: params.client_id,
                clientLicense_id: params.clientLicense_id
            }
        });
    }
});

FlowRouter.route('/admin/clients/:client_id/serviceaccount', {
    action: function (params, queryParams) {
        BlazeLayout.render('adminLayout', {
            page: 'serviceAccount',
            dataContext: {
                client_id: params.client_id
            }
        });
    }
});

FlowRouter.route('/admin/clients/:client_id/devices', {
    action: function (params, queryParams) {
        BlazeLayout.render('adminLayout', {
            page: 'devices',
            dataContext: {
                client_id: params.client_id
            }
        });
    }
});

FlowRouter.route('/admin/clients/:client_id/devices/new', {
    action: function (params, queryParams) {
        BlazeLayout.render('adminLayout', {
            page: 'newDevice',
            dataContext: {
                client_id: params.client_id
            }
        });
    }
});

FlowRouter.route('/admin/clients/:client_id/devices/:device_id', {
    action: function (params) {
        BlazeLayout.render('adminLayout', {
            page: 'deviceDetails',
            dataContext: {
                client_id: params.client_id,
                device_id: params.device_id
            }
        });
    }
});

FlowRouter.route('/admin/clients/:client_id/devices/:device_id/edit', {
    action: function (params) {
        BlazeLayout.render('adminLayout', {
            page: 'editDevice',
            dataContext: {
                client_id: params.client_id,
                device_id: params.device_id
            }
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
