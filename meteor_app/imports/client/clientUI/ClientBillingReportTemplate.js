/**
 * Created by Claudio on 2018-10-16.
 */

//console.log('[ClientBillingReportTemplate.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import querystring from 'querystring';
// Third-party node modules
import moment from 'moment-timezone';
// Meteor packages
//import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';
import { ReactiveDict } from 'meteor/reactive-dict';

// References code in other (Catenis) modules on the client
import { Catenis } from '../ClientCatenis';
import { ClientUtil } from '../ClientUtil';

// Import template UI
import './ClientBillingReportTemplate.html';

// Import dependent templates
import './ClientBillingEntryTemplate.js';

const periods = {
    last_15_days: {
        label: 'Last 15 days',
        getStartDate: () => moment().startOf('day').add(-14, 'd').toISOString(),
        getEndDate: () => undefined
    },
    last_30_days: {
        label: 'Last 30 days',
        getStartDate: () => moment().startOf('day').add(-29, 'd').toISOString(),
        getEndDate: () => undefined
    },
    this_month: {
        label: 'This month',
        getStartDate: () => moment().startOf('month').toISOString(),
        getEndDate: () => undefined
    },
    last_month: {
        label: 'Last month',
        getStartDate: () => moment().add(-1, 'M').startOf('month').toISOString(),
        getEndDate: () => moment().add(-1, 'M').endOf('month').toISOString()
    },
    last_2_months: {
        label: 'Last 2 months',
        getStartDate: () => moment().startOf('day').add(-1, 'M').toISOString(),
        getEndDate: () => undefined
    },
    last_3_months: {
        label: 'Last 3 months',
        getStartDate: () => moment().startOf('day').add(-2, 'M').toISOString(),
        getEndDate: () => undefined
    },
    last_6_months: {
        label: 'Last 6 months',
        getStartDate: () => moment().startOf('day').add(-5, 'M').toISOString(),
        getEndDate: () => undefined
    },
    last_12_months: {
        label: 'Last 12 months',
        getStartDate: () => moment().startOf('day').add(-11, 'M').toISOString(),
        getEndDate: () => undefined
    },
    this_year: {
        label: 'This year',
        getStartDate: () => moment().startOf('year').toISOString(),
        getEndDate: () => undefined
    },
    last_year: {
        label: 'Last year',
        getStartDate: () => moment().add(-1, 'y').startOf('year').toISOString(),
        getEndDate: () => moment().add(-1, 'y').endOf('year').toISOString()
    },
    custom: {
        label: 'Custom'
    }
};
const defaultPeriodId = 'last_15_days';


// Definition of module (private) functions
//

function loadReport(template) {
    template.state.set('reportLoaded', false);

    if (template.currClntBillingReporSubs) {
        template.currClntBillingReporSubs.stop();
    }

    template.currClntBillingReporSubs = template.subscribe(
        'currentClientBillingReport',
        template.state.get('reportDeviceId'),
        template.state.get('reportStartDate'),
        template.state.get('reportEndDate'),
        () => {
            template.state.set('reportLoaded', true);
    });
}

function initFilter(template) {
    // Set initial device filter
    template.state.set('filterDevice_id', undefined);
    template.state.set('reportDeviceId', undefined);

    if (template.data.device_id) {
        const docDevice = Catenis.db.collection.Device.findOne({
            _id: template.data.device_id
        }, {
            fields: {
                _id: 1,
                deviceId: 1
            }
        });

        if (docDevice) {
            template.state.set('filterDevice_id', docDevice._id);
            template.state.set('reportDeviceId', docDevice.deviceId);
        }
    }

    // Set initial period filter
    const periodId = template.data.periodId && template.data.periodId in periods ? template.data.periodId : defaultPeriodId;
    template.state.set('filterPeriodId', periodId);

    if (periodId !== 'custom') {
        const period = periods[periodId];

        template.state.set('reportStartDate', period.getStartDate());
        template.state.set('reportEndDate', period.getEndDate());
    }
    else {
        // Custom period. Set start date and end date from respective fields
        const startDate = template.data.startDate ? moment(template.data.startDate) : undefined;
        const endDate = template.data.endDate ? moment(template.data.endDate) : undefined;

        template.state.set('reportStartDate', startDate && startDate.isValid() ? startDate.toISOString() : undefined);
        template.state.set('reportEndDate', endDate && endDate.isValid() ? endDate.toISOString() : undefined);
    }
}

function getFilterParams(template) {
    const params = {};

    // Device filter
    const deviceId = template.state.get('filterDevice_id');

    if (deviceId) {
        params.deviceid = deviceId;
    }

    // Period filter
    const periodId = template.state.get('filterPeriodId');

    if (periodId !== defaultPeriodId) {
        params.periodid = periodId;

        if (periodId === 'custom') {
            const startDate = template.state.get('reportStartDate');
            const endDate = template.state.get('reportEndDate');

            if (startDate) {
                params.startdate = startDate;
            }

            if (endDate) {
                params.enddate = endDate;
            }
        }
    }

    return Object.keys(params).length > 0 ? params : undefined;
}


// Module code
//

Template.clientBillingReport.onCreated(function () {
    this.state = new ReactiveDict();

    this.state.set('reloadReport', false);
    this.state.set('reportLoaded', false);

    // Subscribe to receive database docs/recs updates
    this.currClntDevicesSubs = this.subscribe('currentClientDevices', true, () => {
        initFilter(this);
        loadReport(this);
    });
    this.clntPaidServiceNamesSubs = this.subscribe('clientPaidServiceNames');
});

Template.clientBillingReport.onDestroyed(function () {
    if (this.currClntBillingReporSubs) {
        this.currClntBillingReporSubs.stop();
    }

    if (this.currClntDevicesSubs) {
        this.currClntDevicesSubs.stop();
    }

    if (this.clntPaidServiceNamesSubs) {
        this.clntPaidServiceNamesSubs.stop();
    }
});

Template.clientBillingReport.events({
    'click #lnkResetFilter'(event, template) {
        event.preventDefault();

        // Activate date/time picker control
        const dtPicker = $('#dtpkrStartDate');
        dtPicker.datetimepicker({
            useCurrent: false,
            format: 'YYYY-MM-DD'
        });
        const dtPicker2 = $('#dtpkrEndDate');
        dtPicker2.datetimepicker({
            format: 'YYYY-MM-DD'
        });

        // Set handler to adjust minimum end date based on currently
        //  selected start date
        dtPicker.on("dp.change", function (e) {
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

        // Initiate start and end date fields
        const dataDtPicker = dtPicker.data('DateTimePicker');
        const startDate = template.state.get('reportStartDate');

        if (startDate) {
            dataDtPicker.date(startDate);
        }
        else {
            dataDtPicker.clear();
        }

        const dataDtPicker2 = dtPicker2.data('DateTimePicker');
        const endDate = template.state.get('reportEndDate');

        if (endDate) {
            dataDtPicker2.date(endDate);
        }
        else {
            dataDtPicker2.clear();
        }

        // Reset indication that report should be reloaded
        template.state.set('reloadReport', false);
    },
    'change #selPeriod'(event, template) {
        const periodCtrl = event.target;

        template.state.set('filterPeriodId', periodCtrl.value);
    },
    'submit #frmResetFilter'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        const form = event.target;

        // Update filtered device
        template.state.set('filterDevice_id', undefined);
        template.state.set('reportDeviceId', undefined);

        if (form.device.value) {
            const docDevice = Catenis.db.collection.Device.findOne({
                _id: form.device.value
            }, {
                fields: {
                    _id: 1,
                    deviceId: 1
                }
            });

            if (docDevice) {
                template.state.set('filterDevice_id', docDevice._id);
                template.state.set('reportDeviceId', docDevice.deviceId);
            }
        }

        // Update filtered period
        const periodId = form.period.value;
        template.state.set('filterPeriodId', periodId);

        if (periodId !== 'custom') {
            const period = periods[periodId];

            template.state.set('reportStartDate', period.getStartDate());
            template.state.set('reportEndDate', period.getEndDate());
        }
        else {
            // Custom period. Set start date and end date from respective fields
            const startDate = $(form.startDate).data('DateTimePicker').date();
            const endDate = $(form.endDate).data('DateTimePicker').date();

            template.state.set('reportStartDate', startDate && startDate.isValid() ? startDate.toISOString() : undefined);
            template.state.set('reportEndDate', endDate && endDate.isValid() ? endDate.toISOString() : undefined);
        }

        // Indicate that report should be reloaded (once modal panel closes)
        template.state.set('reloadReport', true);

        // Close modal panel
        $('#divResetFilter').modal('hide');
    },
    'hidden.bs.modal #divResetFilter'(event, template) {
        // Modal panel has been closed. Make sure that link used to
        //  activate modal panel is not selected...
        $('#lnkResetFilter').blur();

        // and reload report if required
        if (template.state.get('reloadReport')) {
            loadReport(template);
        }
    }
});

Template.clientBillingReport.helpers({
    billingEntries() {
        return Catenis.db.collection.Billing.find();
    },
    deviceTitle(deviceId) {
        const docDevice = Catenis.db.collection.Device.findOne({deviceId: deviceId});

        if (docDevice) {
            return docDevice.props.name || docDevice.deviceId;
        }
    },
    serviceName(service_id) {
        return Catenis.db.collection.PaidService.findOne({_id: service_id}).service;
    },
    formatDate(date) {
        return moment(date).format('lll');
    },
    formatServiceCredits(amount) {
        return ClientUtil.formatCatenisServiceCredits(amount);
    },
    deviceOptions() {
        const deviceOpts = [{
            value: '',
            label: '-- any --',
            selected: undefined
        }];
        const reportDeviceId = Template.instance().state.get('reportDeviceId');
        let selected = false;

        Catenis.db.collection.Device.find().fetch().forEach((doc) => {
            deviceOpts.push({
                value: doc._id,
                label: doc.props.name || doc.deviceId,
                selected: (selected = doc.deviceId === reportDeviceId) ? 'selected' : undefined
            });
        });

        if (!selected) {
            deviceOpts[0].selected = 'selected';
        }

        return deviceOpts;
    },
    filterDevice() {
        const device_id = Template.instance().state.get('filterDevice_id');
        let label;

        if (device_id) {
            const docDevice = Catenis.db.collection.Device.findOne({
                _id: device_id
            }, {
                fields: {
                    deviceId: 1,
                    props: 1
                }
            });

            if (docDevice) {
                label = docDevice.props.name || docDevice.deviceId;
            }
        }

        return label ? label : '<i>any</i>';
    },
    reportLoaded() {
        return Template.instance().state.get('reportLoaded');
    },
    periodOptions() {
        const periodOpts = [];
        const periodId = Template.instance().state.get('filterPeriodId');

        Object.keys(periods).forEach((key) => {
            periodOpts.push({
                value: key,
                label: periods[key].label,
                selected: key === periodId ? 'selected' : undefined
            });
        });

        return periodOpts;
    },
    filterPeriod() {
        const template = Template.instance();
        const periodId = template.state.get('filterPeriodId');
        let label;

        if (periodId === 'custom') {
            const startDate = template.state.get('reportStartDate');
            const endDate = template.state.get('reportEndDate');
            label = '';

            if (startDate) {
                label += 'From ' + moment(startDate).format('ll');
            }

            if (endDate) {
                if (label.length > 0) {
                    label += ' '
                }

                label += 'To ' + moment(endDate).format('ll');
            }
        }
        else {
            label = periods[periodId].label;
        }

        return label ? label : '<i>not specified</i>';
    },
    displayFilterStartDate() {
        return Template.instance().state.get('filterPeriodId') === 'custom' ? 'block' : 'none';
    },
    displayFilterEndDate() {
        return Template.instance().state.get('filterPeriodId') === 'custom' ? 'block' : 'none';
    },
    returnQueryString() {
        const filterParams = getFilterParams(Template.instance());

        if (filterParams) {
            return '?' + querystring.stringify({
                retparams: querystring.stringify(filterParams)
            });
        }
    }
});
