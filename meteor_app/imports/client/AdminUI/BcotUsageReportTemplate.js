/**
 * Created by Claudio on 2018-01-19.
 */

//console.log('[BcotUsageReportTemplate.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import util from 'util';
// Third-party node modules
import moment from 'moment';
// Meteor packages
import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';
import { ReactiveDict } from 'meteor/reactive-dict';

// References code in other (Catenis) modules on the client
//import { Catenis } from '../ClientCatenis';

// Import template UI
import './BcotUsageReportTemplate.html';


// Definition of module (private) functions
//

function validateFormData(form, errMsgs, timeZones) {
    const period = {};
    let hasError = false;

    const timeZoneOffset = form.timeZone.value === 'local' ? undefined : (form.timeZone.value === 'UTC' ? 0 : timeZones.find(tz => tz.value === form.timeZone.value).name);
    const startDate = form.startDate.value ? form.startDate.value.trim() : '';

    if (startDate.length > 0) {
        const mt = moment(startDate);

        if (timeZoneOffset !== undefined) {
            mt.utcOffset(timeZoneOffset, true);
        }

        if (mt.isValid()) {
            period.startDate = mt.utc().format('YYYY-MM-DDTHH:mm:ss[Z]');
        }
        else {
            // Supplied date not valid
            errMsgs.push('Please enter a valid start date');
            hasError = true;
        }
    }

    const endDate = form.endDate.value ? form.endDate.value.trim() : '';

    if (endDate.length > 0) {
        const mt = moment(endDate);

        if (timeZoneOffset !== undefined) {
            mt.utcOffset(timeZoneOffset, true);
        }

        if (mt.isValid()) {
            period.endDate = mt.utc().format('YYYY-MM-DDTHH:mm:ss[Z]');
        }
        else {
            // Supplied date not valid
            errMsgs.push('Please enter a valid end date');
            hasError = true;
        }
    }

    return !hasError ? period : undefined;
}


// Module code
//

Template.bcotUsageReport.onCreated(function () {
    this.state = new ReactiveDict();
    this.state.set('errMsgs', []);
    this.state.set('doingDownload', false);
    this.state.set('reportData', undefined);
    this.state.set('reportFilename', undefined);

    Meteor.call('getBcotUsageReportConfig', (error, config) => {
        if (error) {
            console.log('Error calling \'getBcotUsageReportConfig\' remote method: ' + error);
        }
        else {
            this.state.set('cfgSettings', config);
        }
    });
});

Template.bcotUsageReport.onDestroyed(function () {
});

Template.bcotUsageReport.events({
    'change #selTimeZone'(event, template) {
        // Reset report generation
        template.state.set('errMsgs', []);
        template.state.set('doingDownload', false);
        template.state.set('reportData', undefined);
        template.state.set('reportFilename', undefined);
    },
    'change #txtStartDate'(event, template) {
        // Reset report generation
        template.state.set('errMsgs', []);
        template.state.set('doingDownload', false);
        template.state.set('reportData', undefined);
        template.state.set('reportFilename', undefined);
    },
    'change #txtEndDate'(event, template) {
        // Reset report generation
        template.state.set('errMsgs', []);
        template.state.set('doingDownload', false);
        template.state.set('reportData', undefined);
        template.state.set('reportFilename', undefined);
    },
    'submit #frmBcotUsageReport'(event, template) {
        event.preventDefault();

        const form = event.target;

        // Reset errors
        template.state.set('errMsgs', []);
        let errMsgs = [];

        let reportPeriod;
        const cfgSettings = template.state.get('cfgSettings');

        if ((reportPeriod = validateFormData(form, errMsgs, cfgSettings.timeZones))) {
            // Compose report filename
            template.state.set('reportFilename', reportPeriod.startDate || reportPeriod.endDate ?
                    util.format('%s_%s_%s.%s', cfgSettings.baseFilename, formatDate(reportPeriod.startDate), formatDate(reportPeriod.endDate), cfgSettings.fileExtension) :
                    util.format('%s.%s', cfgSettings.baseFilename, cfgSettings.fileExtension));

            template.state.set('doingDownload', true);

            // Call remote method to create client
            Meteor.call('downloadBcotUsageReport', reportPeriod.startDate, reportPeriod.endDate, (error, report) => {
                template.state.set('doingDownload', false);

                if (error) {
                    template.state.set('errMsgs', [
                        error.toString()
                    ]);
                }
                else {
                    // Report successfully generated
                    template.state.set('reportData', report);
                }
            });
        }
        else {
            template.state.set('errMsgs', errMsgs);
        }
    }
});

Template.bcotUsageReport.helpers({
    isUIReady: function () {
        return Template.instance().state.get('cfgSettings') !== undefined;
    },
    timeZones: function () {
        const cfgSettings = Template.instance().state.get('cfgSettings');

        return cfgSettings.timeZones.map((tz) => {
            return {
                value: tz.value,
                name: tz.name,
                selectedAttribute: tz.value === cfgSettings.defaultTimeZone ? 'selected' : ''
            }
        });
    },
    hasError: function () {
        return Template.instance().state.get('errMsgs').length > 0;
    },
    errorMessage: function () {
        return Template.instance().state.get('errMsgs').reduce((compMsg, errMsg) => {
            if (compMsg.length > 0) {
                compMsg += '<br>';
            }

            return compMsg + errMsg;
        }, '');
    },
    canGenerateReport: function () {
        return Template.instance().state.get('reportData') === undefined && !Template.instance().state.get('doingDownload');
    },
    generatingReport: function () {
        return Template.instance().state.get('doingDownload');
    },
    reportFilename: function () {
        return Template.instance().state.get('reportFilename');
    },
    reportData: function () {
        return Template.instance().state.get('reportData');
    },
    emptyReport: function () {
        const reportData = Template.instance().state.get('reportData');

        return reportData !== undefined && reportData.length === 0;
    }
});

function formatDate (dt) {
    return dt ? dt.split(/[\-:\.+]/).join('') : '';
}
