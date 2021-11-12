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

function formatDate (dt) {
    return dt ? dt.split(/[\-:\.+]/).join('') : '';
}


// Module code
//

Template.bcotUsageReport.onCreated(function () {
    this.state = new ReactiveDict();

    this.state.set('errMsgs', []);
    this.state.set('infoMsg', undefined);
    this.state.set('infoMsgType', 'info');

    this.state.set('isInitializing', true);
    this.state.set('hasStartDate', false);
    this.state.set('hasEndDate', false);
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
    'click #frmBcotUsageReport'(event, template) {
        if (template.state.get('isInitializing')) {
            // Activate date/time picker controls
            const dtPicker = $('#dtpkrStartDate');
            dtPicker.datetimepicker({
                format: 'YYYY-MM-DD'
            });
            const dtPicker2 = $('#dtpkrEndDate');
            dtPicker2.datetimepicker({
                useCurrent: false,
                format: 'YYYY-MM-DD'
            });

            // Set handler to monitor start date change and adjust minimum end date
            //  based on currently selected start date
            dtPicker.on("dp.change", function (e) {
                template.state.set('hasStartDate', !!e.date);

                // Get start date (moment obj)
                let startDate = e.date;

                if (!startDate) {
                    startDate = moment().startOf('day');
                }

                // Adjust limit for end date
                const minDate = startDate.clone();

                const dataDtPicker2 = dtPicker2.data("DateTimePicker");

                if (dataDtPicker2.date() && dataDtPicker2.date().valueOf() < minDate.valueOf()) {
                    dataDtPicker2.clear();
                }

                dataDtPicker2.minDate(minDate);
            });

            // Set handler to monitor end date change
            dtPicker2.on("dp.change", function (e) {
                template.state.set('hasEndDate', !!e.date);
            });
        }
    },
    'click #btnDismissError'(event, template) {
        // Clear error message
        template.state.set('errMsgs', []);
    },
    'click #btnDismissInfo'(event, template) {
        // Clear info message
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');
    },
    'change #selTimeZone'(event, template) {
        // Reset report generation
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');

        template.state.set('doingDownload', false);
        template.state.set('reportData', undefined);
        template.state.set('reportFilename', undefined);
    },
    'change #txtStartDate'(event, template) {
        // Reset report generation
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');

        template.state.set('doingDownload', false);
        template.state.set('reportData', undefined);
        template.state.set('reportFilename', undefined);
    },
    'change #txtEndDate'(event, template) {
        // Reset report generation
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');

        template.state.set('doingDownload', false);
        template.state.set('reportData', undefined);
        template.state.set('reportFilename', undefined);
    },
    'submit #frmBcotUsageReport'(event, template) {
        event.preventDefault();

        const form = event.target;

        // Clear alerts
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');
        let errMsgs = [];

        let reportPeriod;
        const cfgSettings = template.state.get('cfgSettings');

        if ((reportPeriod = validateFormData(form, errMsgs, cfgSettings.timeZones))) {
            // Compose report filename
            template.state.set('reportFilename', reportPeriod.startDate || reportPeriod.endDate ?
                    util.format('%s_%s_%s.%s', cfgSettings.baseFilename, formatDate(reportPeriod.startDate), formatDate(reportPeriod.endDate), cfgSettings.fileExtension) :
                    util.format('%s.%s', cfgSettings.baseFilename, cfgSettings.fileExtension));

            template.state.set('doingDownload', true);
            template.state.set('infoMsg', 'Generating report...');
            template.state.set('infoMsgType', 'info');

            // Call remote method to generate report
            Meteor.call('downloadBcotUsageReport', reportPeriod.startDate, reportPeriod.endDate, (error, report) => {
                template.state.set('doingDownload', false);

                if (error) {
                    template.state.set('infoMsg', undefined);
                    template.state.set('errMsgs', [
                        error.toString()
                    ]);
                }
                else {
                    // Report successfully generated
                    template.state.set('reportData', report);

                    if (report.length > 0) {
                        template.state.set('infoMsg', 'Report ready to be downloaded');
                        template.state.set('infoMsgType', 'success');
                    }
                    else {
                        template.state.set('infoMsg', 'Nothing to download; report is empty');
                        template.state.set('infoMsgType', 'warning');
                    }
                }
            });
        }
        else {
            template.state.set('errMsgs', errMsgs);
        }
    }
});

Template.bcotUsageReport.helpers({
    isConfigReady: function () {
        return Template.instance().state.get('cfgSettings') !== undefined;
    },
    timeZones: function () {
        const cfgSettings = Template.instance().state.get('cfgSettings');

        return cfgSettings.timeZones.map((tz) => {
            return {
                value: tz.value,
                name: tz.name,
                selected: tz.value === cfgSettings.defaultTimeZone ? 'selected' : ''
            }
        });
    },
    hasErrorMessage: function () {
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
    hasInfoMessage() {
        return !!Template.instance().state.get('infoMsg');
    },
    infoMessage() {
        return Template.instance().state.get('infoMsg');
    },
    infoMessageType() {
        return Template.instance().state.get('infoMsgType');
    },
    hasStartDate() {
        return Template.instance().state.get('hasStartDate');
    },
    hasEndDate() {
        return Template.instance().state.get('hasEndDate');
    },
    canGenerateReport: function () {
        return Template.instance().state.get('reportData') === undefined && !Template.instance().state.get('doingDownload');
    },
    reportFilename: function () {
        return Template.instance().state.get('reportFilename');
    },
    reportData: function () {
        return Template.instance().state.get('reportData');
    }
});
