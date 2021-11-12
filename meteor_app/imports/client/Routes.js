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
import BigNumber from 'bignumber.js';
// Meteor packages
//import { Meteor } from 'meteor/meteor';
import { FlowRouter } from 'meteor/kadira:flow-router';
import { BlazeLayout } from 'meteor/kadira:blaze-layout';

// Import templates
import './adminUI/NotFoundLayout.js';
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
    let url;

    try {
        // Note: the second argument of the URL constructor (the 'base') is not relevant here,
        //        but it is required to successfully parse a relative URL
        url = new URL(FlowRouter.current().path, 'http://catenis.io');
    }
    catch (e) {}

    return url && url.search.length > 0
        ? Array.from(url.searchParams).reduce((obj, entry) => {
            const name = entry[0];

            obj[name] = name in obj ? [obj[name], entry[1]] : entry[1];

            return obj;
        }, {})
        : {};
}

function parseBoolean(strVal) {
    return !(!strVal || strVal === '0' || strVal.toLowerCase() === 'false');
}


// Module code
//

BlazeLayout.setRoot('body');

// Default page for invalid URLs
FlowRouter.notFound = {
    action: function () {
        BlazeLayout.render('notFoundLayout');
    }
};

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

FlowRouter.route('/profile', {
    action: function () {
        BlazeLayout.render('clientLayout', {
            page: 'clientProfile'
        });
    }
});

FlowRouter.route('/profile/edit', {
    action: function () {
        BlazeLayout.render('clientLayout',{
            page: 'editClientProfile'
        });
    }
});

FlowRouter.route('/profile/2fa', {
    action: function () {
        BlazeLayout.render('clientLayout',{
            page: 'clientTwoFactorAuthentication'
        });
    }
});

FlowRouter.route('/licenses/', {
    action: function (params, queryParams) {
        BlazeLayout.render('clientLayout', {
            page: 'clientClientLicenses',
            dataContext: {
                showExpired: parseBoolean(queryParams.showexpired)
            }
        });
    }
});

FlowRouter.route('/licenses/:clientLicense_id', {
    action: function (params, queryParams) {
        queryParams = getQueryParams();

        BlazeLayout.render('clientLayout', {
            page: 'clientClientLicenseDetails',
            dataContext: {
                clientLicense_id: params.clientLicense_id,
                retParams: queryParams.retparams
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

FlowRouter.route('/domains', {
    action: function (params) {
        BlazeLayout.render('clientLayout', {
            page: 'clientOwnedDomains'
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

FlowRouter.route('/resources', {
    action: function () {
        BlazeLayout.render('clientLayout',{
            page: 'clientResources'
        });
    }
});

FlowRouter.route('/foreignblockchains', {
    action: function () {
        BlazeLayout.render('clientLayout', {
            page: 'clientForeignBlockchains'
        });
    }
});

FlowRouter.route('/foreignblockchains/:blockchainKey', {
    action: function (params) {
        BlazeLayout.render('clientLayout', {
            page: 'clientForeignBlockchainDetails',
            dataContext: {
                blockchainKey: params.blockchainKey
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

FlowRouter.route('/admin/useraccount/2fa', {
    action: function () {
        BlazeLayout.render('adminLayout',{
            page: 'twoFactorAuthentication'
        });
    }
});

FlowRouter.route('/admin/adminaccount/new', {
    action: function () {
        BlazeLayout.render('adminLayout',{
            page: 'newAdminAccount'
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

FlowRouter.route('/admin/bcotsale', {
    action: function () {
        BlazeLayout.render('adminLayout', {
            page: 'bcotSale'
        });
    }
});

FlowRouter.route('/admin/bcotsale/products', {
    action: function (params, queryParams) {
        BlazeLayout.render('adminLayout', {
            page: 'bcotProducts',
            dataContext: {
                showInactive: parseBoolean(queryParams.showinactive)
            }
        });
    }
});

FlowRouter.route('/admin/bcotsale/products/:bcotProduct_id', {
    action: function (params, queryParams) {
        queryParams = getQueryParams();

        BlazeLayout.render('adminLayout', {
            page: 'bcotProductDetails',
            dataContext: {
                bcotProduct_id: params.bcotProduct_id,
                retParams: queryParams.retparams
            }
        });
    }
});

FlowRouter.route('/admin/bcotsale/allocations', {
    action: function (params, queryParams) {
        BlazeLayout.render('adminLayout', {
            page: 'bcotSaleAllocations',
            dataContext: {
                showInUse: parseBoolean(queryParams.showinuse)
            }
        });
    }
});

FlowRouter.route('/admin/bcotsale/allocations/:bcotSaleAllocation_id', {
    action: function (params, queryParams) {
        queryParams = getQueryParams();

        BlazeLayout.render('adminLayout', {
            page: 'bcotSaleAllocationDetails',
            dataContext: {
                bcotSaleAllocation_id: params.bcotSaleAllocation_id,
                retParams: queryParams.retparams
            }
        });
    }
});

FlowRouter.route('/admin/bcotsale/stock', {
    action: function () {
        BlazeLayout.render('adminLayout', {
            page: 'bcotSaleStock'
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
    action: function (params, queryParams) {
        BlazeLayout.render('adminLayout', {
            page: 'licenses',
            dataContext: {
                showInactive: parseBoolean(queryParams.showinactive)
            }
        });
    }
});

FlowRouter.route('/admin/licenses/:license_id', {
    action: function (params, queryParams) {
        queryParams = getQueryParams();

        BlazeLayout.render('adminLayout', {
            page: 'licenseDetails',
            dataContext: {
                license_id: params.license_id,
                retParams: queryParams.retparams
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

FlowRouter.route('/admin/paidservices/history', {
    action: function (params, queryParams) {
        BlazeLayout.render('adminLayout', {
            page: 'paidServicesHistory',
            dataContext: {
                showRecs: queryParams.showrecs,
                svcColSetIdx: queryParams.svccolsetidx,
                services: queryParams.services,
                periodId: queryParams.periodid,
                startDate: queryParams.startdate,
                endDate: queryParams.enddate
            }
        });
    }
});

FlowRouter.route('/admin/paidservices/:service_id/history/:timestamp', {
    action: function (params, queryParams) {
        queryParams = getQueryParams();

        BlazeLayout.render('adminLayout', {
            page: 'paidServiceHistoryDetails',
            dataContext: {
                service_id: params.service_id,
                timestamp: params.timestamp,
                retParams: queryParams.retparams
            }
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

FlowRouter.route('/admin/notifytemplates', {
    action: function () {
        BlazeLayout.render('adminLayout', {
            page: 'notifyTemplates'
        });
    }
});

FlowRouter.route('/admin/notifytemplates/new', {
    action: function () {
        BlazeLayout.render('adminLayout', {
            page: 'newNotifyTemplate'
        });
    }
});

FlowRouter.route('/admin/notifytemplates/:uiNotificationTemplate_id', {
    action: function (params) {
        BlazeLayout.render('adminLayout', {
            page: 'notifyTemplateDetails',
            dataContext: {
                uiNotificationTemplate_id: params.uiNotificationTemplate_id
            }
        });
    }
});

FlowRouter.route('/admin/notifytemplates/:uiNotificationTemplate_id/edit', {
    action: function (params) {
        BlazeLayout.render('adminLayout', {
            page: 'editNotifyTemplate',
            dataContext: {
                uiNotificationTemplate_id: params.uiNotificationTemplate_id
            }
        });
    }
});

FlowRouter.route('/admin/notifytemplates/:uiNotificationTemplate_id/notifications', {
    action: function (params) {
        BlazeLayout.render('adminLayout', {
            page: 'notifications',
            dataContext: {
                uiNotificationTemplate_id: params.uiNotificationTemplate_id
            }
        });
    }
});

FlowRouter.route('/admin/notifytemplates/:uiNotificationTemplate_id/notifications/new', {
    action: function (params) {
        BlazeLayout.render('adminLayout', {
            page: 'newNotification',
            dataContext: {
                uiNotificationTemplate_id: params.uiNotificationTemplate_id
            }
        });
    }
});

FlowRouter.route('/admin/notifytemplates/:uiNotificationTemplate_id/notifications/:uiNotification_id', {
    action: function (params) {
        BlazeLayout.render('adminLayout', {
            page: 'notificationDetails',
            dataContext: {
                uiNotificationTemplate_id: params.uiNotificationTemplate_id,
                uiNotification_id: params.uiNotification_id
            }
        });
    }
});

FlowRouter.route('/admin/notifytemplates/:uiNotificationTemplate_id/notifications/:uiNotification_id/preview', {
    action: function (params) {
        BlazeLayout.render('adminLayout', {
            page: 'previewNotification',
            dataContext: {
                uiNotificationTemplate_id: params.uiNotificationTemplate_id,
                uiNotification_id: params.uiNotification_id
            }
        });
    }
});

FlowRouter.route('/admin/notifytemplates/:uiNotificationTemplate_id/notifications/:uiNotification_id/edit', {
    action: function (params) {
        BlazeLayout.render('adminLayout', {
            page: 'editNotification',
            dataContext: {
                uiNotificationTemplate_id: params.uiNotificationTemplate_id,
                uiNotification_id: params.uiNotification_id
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
    action: function (params, queryParams) {
        BlazeLayout.render('adminLayout', {
            page: 'clientLicenses',
            dataContext: {
                client_id: params.client_id,
                showExpired: parseBoolean(queryParams.showexpired)
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
    action: function (params, queryParams) {
        queryParams = getQueryParams();

        BlazeLayout.render('adminLayout', {
            page: 'clientLicenseDetails',
            dataContext: {
                client_id: params.client_id,
                clientLicense_id: params.clientLicense_id,
                retParams: queryParams.retparams
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

FlowRouter.route('/admin/clients/:client_id/domains', {
    action: function (params) {
        BlazeLayout.render('adminLayout', {
            page: 'ownedDomains',
            dataContext: {
                client_id: params.client_id
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

FlowRouter.route('/admin/resources', {
    action: function () {
        BlazeLayout.render('adminLayout',{
            page: 'resources'
        });
    }
});

FlowRouter.route('/admin/clients/:client_id/standbyvouchers', {
    action: function (params) {
        BlazeLayout.render('adminLayout', {
            page: 'standbyPurchasedBcot',
            dataContext: {
                client_id: params.client_id
            }
        });
    }
});

FlowRouter.route('/admin/clients/:client_id/foreignblockchains', {
    action: function (params) {
        BlazeLayout.render('adminLayout', {
            page: 'foreignBlockchains',
            dataContext: {
                client_id: params.client_id
            }
        });
    }
});

FlowRouter.route('/admin/clients/:client_id/foreignblockchains/:blockchainKey', {
    action: function (params) {
        BlazeLayout.render('adminLayout', {
            page: 'foreignBlockchainDetails',
            dataContext: {
                client_id: params.client_id,
                blockchainKey: params.blockchainKey
            }
        });
    }
});
