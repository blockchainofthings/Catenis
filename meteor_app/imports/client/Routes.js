/**
 * Created by Claudio on 2017-05-12.
 */

//console.log('[Routes.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import url from 'url';
// Third-party node modules
import BigNumber from 'bignumber.js';
// Meteor packages
//import { Meteor } from 'meteor/meteor';
import { FlowRouter } from 'meteor/kadira:flow-router';
import { BlazeLayout } from 'meteor/kadira:blaze-layout';

// Import templates
import './adminUI/LoginLayout.js';
import './adminUI/AdminLayout.js';
import './clientUI/ClientLayout.js';


// Definition of module (private) functions
//

// NOTE: this function is to be used as a workaround for an issue with FlowRouter when parsing a query string
//      that has one or more parameters the value of which is a properly escaped sequence of query string
//      parameters.
//
//      Example:
//        For the url: /example.com/bla?retparams=periodid%3Dcustom%26startdate%3D2018-10-02T03%253A00%253A00.000Z%26enddate%3D2018-10-16T03%253A00%253A00.000Z
//        The resulting queryParams is: {
//          retParams: periodid=custom,
//          startDate: 2018-10-02T03:00:00.000Z,
//          endDate: 2018-10-16T03:00:00.000Z
//        }
//        When the expected queryPrams would be: {
//          retParams: periodid=custom&startdate=2018-10-02T03%3A00%3A00.000Z&enddate=2018-10-16T03%3A00%3A00.000Z
//        }
function getQueryParams() {
    return url.parse(FlowRouter.current().path, true).query;
}


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
        BlazeLayout.render('clientLayout', {
            page: 'clientAccount'
        });
    }
});

FlowRouter.route('/licenses/', {
    action: function () {
        BlazeLayout.render('clientLayout', {
            page: 'clientClientLicenses'
        });
    }
});

FlowRouter.route('/licenses/:clientLicense_id', {
    action: function (params) {
        BlazeLayout.render('clientLayout', {
            page: 'clientClientLicenseDetails',
            dataContext: {
                clientLicense_id: params.clientLicense_id
            }
        });
    }
});

FlowRouter.route('/apiaccess', {
    action: function () {
        BlazeLayout.render('clientLayout', {
            page: 'clientApiAccess'
        });
    }
});

FlowRouter.route('/paidservices', {
    action: function () {
        BlazeLayout.render('clientLayout', {
            page: 'clientPaidServices'
        });
    }
});

FlowRouter.route('/paidservices/:service_id', {
    action: function (params) {
        BlazeLayout.render('clientLayout', {
            page: 'clientPaidServiceDetails',
            dataContext: {
                service_id: params.service_id
            }
        });
    }
});

FlowRouter.route('/serviceaccount', {
    action: function () {
        BlazeLayout.render('clientLayout', {
            page: 'clientServiceAccount'
        });
    }
});


FlowRouter.route('/serviceaccount/billing', {
    action: function (params, queryParams) {
        BlazeLayout.render('clientLayout', {
            page: 'clientBillingReport',
            dataContext: {
                client_id: params.client_id,
                device_id: queryParams.deviceid,
                periodId: queryParams.periodid,
                startDate: queryParams.startdate,
                endDate: queryParams.enddate
            }
        });
    }
});

FlowRouter.route('/serviceaccount/billing/:billing_id', {
    action: function (params, queryParams) {
        queryParams = getQueryParams();

        BlazeLayout.render('clientLayout', {
            page: 'clientBillingEntry',
            dataContext: {
                client_id: params.client_id,
                billing_id: params.billing_id,
                retParams: queryParams.retparams
            }
        });
    }
});

FlowRouter.route('/devices', {
    action: function () {
        BlazeLayout.render('clientLayout', {
            page: 'clientDevices'
        });
    }
});

FlowRouter.route('/devices/new', {
    action: function (params) {
        BlazeLayout.render('clientLayout', {
            page: 'clientNewDevice'
        });
    }
});

FlowRouter.route('/devices/:deviceIndex', {
    action: function (params) {
        BlazeLayout.render('clientLayout', {
            page: 'clientDeviceDetails',
            dataContext: {
                deviceIndex: new BigNumber(params.deviceIndex).toNumber()
            }
        });
    }
});

FlowRouter.route('/devices/:deviceIndex/edit', {
    action: function (params) {
        BlazeLayout.render('clientLayout', {
            page: 'clientEditDevice',
            dataContext: {
                deviceIndex: new BigNumber(params.deviceIndex).toNumber()
            }
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

FlowRouter.route('/admin/paidservices', {
    action: function () {
        BlazeLayout.render('adminLayout', {
            page: 'paidServices'
        });
    }
});

FlowRouter.route('/admin/paidservices/:service_id', {
    action: function (params) {
        BlazeLayout.render('adminLayout', {
            page: 'paidServiceDetails',
            dataContext: {
                service_id: params.service_id
            }
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

FlowRouter.route('/admin/clients/new', {
    action: function (params) {
        BlazeLayout.render('adminLayout', {
            page: 'newClient'
        });
    }
});

FlowRouter.route('/admin/clients/:client_id', {
    action: function (params) {
        BlazeLayout.render('adminLayout', {
            page: 'clientDetails',
            dataContext: {
                client_id: params.client_id
            }
        });
    }
});

FlowRouter.route('/admin/clients/:client_id/edit', {
    action: function (params) {
        BlazeLayout.render('adminLayout', {
            page: 'editClient',
            dataContext: {
                client_id: params.client_id
            }
        });
    }
});

FlowRouter.route('/admin/clients/:client_id/licenses', {
    action: function (params) {
        BlazeLayout.render('adminLayout', {
            page: 'clientLicenses',
            dataContext: {
                client_id: params.client_id
            }
        });
    }
});

FlowRouter.route('/admin/clients/:client_id/licenses/new', {
    action: function (params) {
        BlazeLayout.render('adminLayout', {
            page: 'newClientLicense',
            dataContext: {
                client_id: params.client_id
            }
        });
    }
});

FlowRouter.route('/admin/clients/:client_id/licenses/:clientLicense_id', {
    action: function (params) {
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
    action: function (params) {
        BlazeLayout.render('adminLayout', {
            page: 'serviceAccount',
            dataContext: {
                client_id: params.client_id
            }
        });
    }
});

FlowRouter.route('/admin/clients/:client_id/serviceaccount/billing', {
    action: function (params, queryParams) {
        BlazeLayout.render('adminLayout', {
            page: 'billingReport',
            dataContext: {
                client_id: params.client_id,
                device_id: queryParams.deviceid,
                periodId: queryParams.periodid,
                startDate: queryParams.startdate,
                endDate: queryParams.enddate
            }
        });
    }
});

FlowRouter.route('/admin/clients/:client_id/serviceaccount/billing/:billing_id', {
    action: function (params, queryParams) {
        queryParams = getQueryParams();

        BlazeLayout.render('adminLayout', {
            page: 'billingEntry',
            dataContext: {
                client_id: params.client_id,
                billing_id: params.billing_id,
                retParams: queryParams.retparams
            }
        });
    }
});

FlowRouter.route('/admin/clients/:client_id/devices', {
    action: function (params) {
        BlazeLayout.render('adminLayout', {
            page: 'devices',
            dataContext: {
                client_id: params.client_id
            }
        });
    }
});

FlowRouter.route('/admin/clients/:client_id/devices/new', {
    action: function (params) {
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
