/**
 * Created by claudio on 12/05/17.
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
import './AdminUI/AdminLayout.js';


// Module code
//

BlazeLayout.setRoot('body');

FlowRouter.route('/admin', {
    action: function () {
        BlazeLayout.render('adminLayout');
    }
});

FlowRouter.route('/admin/sysfunding', {
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

FlowRouter.route('/admin/clients', {
    action: function () {
        BlazeLayout.render('adminLayout', {
            page: 'clients'
        });
    }
});

FlowRouter.route('/admin/clients/:client_id', {
    action: function (params, queryParams) {
        const dataContext = {
            client_id: params.client_id
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

FlowRouter.route('/admin/newclient', {
    action: function (params, queryParams) {
        BlazeLayout.render('adminLayout', {
            page: 'newClient'
        });
    }
});

FlowRouter.route('/admin/clients/:client_id/newdevice', {
    action: function (params, queryParams) {
        BlazeLayout.render('adminLayout', {
            page: 'newDevice',
            dataContext: {
                client_id: params.client_id
            }
        });
    }
});
