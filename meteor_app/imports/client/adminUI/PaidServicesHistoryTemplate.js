/**
 * Created by claudio on 2020-08-11
 */

//console.log('[PaidServicesHistoryTemplate.js]: This code just ran.');

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
import './PaidServicesHistoryTemplate.html';

// Import dependent templates
import './PaidServiceHistoryDetailsTemplate.js';


const periods = {
    last_15_days: {
        label: 'Last 15 days',
        getBoundingDates: () => ({
            start: moment().startOf('day').add(-14, 'd').toDate(),
            end: undefined
        })
    },
    last_30_days: {
        label: 'Last 30 days',
        getBoundingDates: () => ({
            start: moment().startOf('day').add(-29, 'd').toDate(),
            end: undefined
        })
    },
    this_month: {
        label: 'This month',
        getBoundingDates: () => ({
            start: moment().startOf('month').toDate(),
            end: undefined
        })
    },
    last_month: {
        label: 'Last month',
        getBoundingDates: () => {
            const mt = moment();

            return {
                start: mt.add(-1, 'M').startOf('month').toDate(),
                end: mt.add(-1, 'M').endOf('month')
            };
        }
    },
    last_2_months: {
        label: 'Last 2 months',
        getBoundingDates: () => ({
            start: moment().startOf('day').add(-1, 'M').toDate(),
            end: undefined
        })
    },
    last_3_months: {
        label: 'Last 3 months',
        getBoundingDates: () => ({
            start: moment().startOf('day').add(-2, 'M').toDate(),
            end: undefined
        })
    },
    last_6_months: {
        label: 'Last 6 months',
        getBoundingDates: () => ({
            start: moment().startOf('day').add(-5, 'M').toDate(),
            end: undefined
        })
    },
    last_12_months: {
        label: 'Last 12 months',
        getBoundingDates: () => ({
            start: moment().startOf('day').add(-11, 'M').toDate(),
            end: undefined
        })
    },
    this_year: {
        label: 'This year',
        getBoundingDates: () => ({
            start: moment().startOf('year').toDate(),
            end: undefined
        })
    },
    last_year: {
        label: 'Last year',
        getBoundingDates: () => {
            const mt = moment();

            return {
                start: mt.add(-1, 'y').startOf('year').toDate(),
                end: mt.add(-1, 'y').endOf('year').toDate()
            };
        }
    },
    custom: {
        label: 'Custom'
    }
};
const defaultPeriodId = 'last_15_days';
const maxServiceColumns = 4;


// Definition of module (private) functions
//

function loadHistory(template) {
    template.state.set('historyLoaded', false);

    if (template.servicesCostHistorySubs) {
        template.servicesCostHistorySubs.stop();
    }

    template.servicesCostHistorySubs = template.subscribe(
        'paidServicesHistory',
        template.state.get('historyStartDate'),
        template.state.get('historyEndDate'),
        () => {
            template.state.set('historyLoaded', true);
        }
    );
}

function initFilter(template) {
    // Set initial show history records state
    template.state.set('showHistoryRecs', typeof template.data.showrecs === 'undefined' || template.data.showrecs === '1');

    // Set initial services filter
    template.state.set('filterServices', []);
    const querySelector = {};

    if (template.data.services) {
        querySelector.abbreviation = {
            $in: template.data.services.split(',')
        };
    }

    const serviceIds = Catenis.db.collection.PaidService.find(querySelector, {
        fields: {
            _id: 1
        }
    }).map(doc => doc._id);

    if (serviceIds) {
        template.state.set('filterServices', serviceIds);
    }

    // Set initial service column set index
    if (typeof template.data.svcColSetIdx !== 'undefined') {
        const svcColSetIdx = parseInt(template.data.svcColSetIdx);
        const numServiceColumnSets = Math.ceil(template.state.get('filterServices').length / maxServiceColumns);

        if (svcColSetIdx > 0 && svcColSetIdx <= numServiceColumnSets) {
            template.state.set('serviceColumnSetIdx', svcColSetIdx);
        }
    }

    // Set initial period filter
    const periodId = template.data.periodId && template.data.periodId in periods ? template.data.periodId : defaultPeriodId;
    template.state.set('filterPeriodId', periodId);

    if (periodId !== 'custom') {
        const period = periods[periodId];
        const boundingDates = period.getBoundingDates();

        template.state.set('historyStartDate', boundingDates.start);
        template.state.set('historyEndDate', boundingDates.end);
    }
    else {
        // Custom period. Set start date and end date from respective fields
        const startDate = template.data.startDate ? moment(template.data.startDate) : undefined;
        const endDate = template.data.endDate ? moment(template.data.endDate) : undefined;

        template.state.set('historyStartDate', startDate && startDate.isValid() ? startDate.toDate() : undefined);
        template.state.set('historyEndDate', endDate && endDate.isValid() ? endDate.toDate() : undefined);
    }
}

function getFilterParams(template) {
    const params = {};

    // Show history records state
    params.showrecs = template.state.get('showHistoryRecs') ? '1' : '0';

    // Service column set index
    params.svccolsetidx = template.state.get('serviceColumnSetIdx');

    // Services filter
    const services = Template.instance().state.get('filterServices');

    params.services = Catenis.db.collection.PaidService.find({
        _id: {
            $in: services
        }
    }, {
        fields: {
            _id: 1,
            abbreviation: 1
        }
    }).map(doc => doc.abbreviation).join(',');

    // Period filter
    const periodId = template.state.get('filterPeriodId');

    if (periodId !== defaultPeriodId) {
        params.periodid = periodId;

        if (periodId === 'custom') {
            const startDate = template.state.get('historyStartDate');
            const endDate = template.state.get('historyEndDate');

            if (startDate) {
                params.startdate = startDate.toISOString();
            }

            if (endDate) {
                params.enddate = endDate.toISOString();
            }
        }
    }

    return Object.keys(params).length > 0 ? params : undefined;
}


// Module code
//

Template.paidServicesHistory.onCreated(function () {
    this.state = new ReactiveDict();

    this.state.set('reloadHistory', false);
    this.state.set('historyLoaded', false);
    this.state.set('showHistoryRecs', true);
    this.state.set('serviceColumnSetIdx', 0);

    // Subscribe to receive database docs/recs updates
    this.paidServicesInfoSubs = this.subscribe('paidServicesInfo', () => {
        initFilter(this);
        loadHistory(this);
    });
});

Template.paidServicesHistory.onRendered(function () {
    $('[data-toggle="tooltip"]').tooltip();
});

Template.paidServicesHistory.onDestroyed(function () {
    if (this.paidServicesInfoSubs) {
        this.paidServicesInfoSubs.stop();
    }

    if (this.servicesCostHistorySubs) {
        this.servicesCostHistorySubs.stop();
    }
});

Template.paidServicesHistory.events({
    'mouseenter .show-tooltip'(event, template) {
        const $target = $(event.currentTarget);

        $target.addClass('tooltipped tooltipped-s');
    },
    'mouseleave .show-tooltip'(event, template) {
        const $target = $(event.currentTarget);

        $target.removeClass('tooltipped tooltipped-s');
    },
    'click #lnkHistoryRecs'(event, template) {
        event.preventDefault();

        template.state.set('showHistoryRecs', !template.state.get('showHistoryRecs'));
    },
    'click #lnkPrevCols'(event, template) {
        event.preventDefault();

        template.state.set('serviceColumnSetIdx', template.state.get('serviceColumnSetIdx') - 1);
    },
    'click #lnkNextCols'(event, template) {
        event.preventDefault();

        template.state.set('serviceColumnSetIdx', template.state.get('serviceColumnSetIdx') +1);
    },
    'click #lnkResetFilter'(event, template) {
        event.preventDefault();

        // Activate date/time picker control
        const dtPicker = $('#dtpkrStartDate');
        dtPicker.datetimepicker({
            useCurrent: false,
            format: 'YYYY-MM-DD HH:mm',
            maxDate: moment().endOf('day')
        });
        const dtPicker2 = $('#dtpkrEndDate');
        dtPicker2.datetimepicker({
            format: 'YYYY-MM-DD HH:mm',
            maxDate: moment().endOf('day')
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
        const startDate = template.state.get('historyStartDate');

        if (startDate) {
            dataDtPicker.date(startDate);
        }
        else {
            dataDtPicker.clear();
        }

        const dataDtPicker2 = dtPicker2.data('DateTimePicker');
        const endDate = template.state.get('historyEndDate');

        if (endDate) {
            dataDtPicker2.date(endDate);
        }
        else {
            dataDtPicker2.clear();
        }

        // Reset indication that history should be reloaded
        template.state.set('reloadHistory', false);
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
        const selectedValues = [];

        if (form.services.selectedOptions.length > 0) {

            for (let idx = 0, limit = form.services.selectedOptions.length; idx < limit; idx++) {
                selectedValues.push(form.services.selectedOptions[idx].value);
            }
        }

        template.state.set('filterServices', selectedValues);

        // Update filtered period
        const periodId = form.period.value;
        template.state.set('filterPeriodId', periodId);

        if (periodId !== 'custom') {
            const period = periods[periodId];
            const boundingDates = period.getBoundingDates();

            template.state.set('historyStartDate', boundingDates.start);
            template.state.set('historyEndDate', boundingDates.end);
        }
        else {
            // Custom period. Set start date and end date from respective fields
            const startDate = $(form.startDate).data('DateTimePicker').date();
            const endDate = $(form.endDate).data('DateTimePicker').date();

            template.state.set('historyStartDate', startDate && startDate.isValid() ? startDate.toDate() : undefined);
            template.state.set('historyEndDate', endDate && endDate.isValid() ? endDate.toDate() : undefined);
        }

        // Indicate that history should be reloaded (once modal panel closes)
        template.state.set('reloadHistory', true);

        // Close modal panel
        $('#divResetFilter').modal('hide');
    },
    'hidden.bs.modal #divResetFilter'(event, template) {
        // Modal panel has been closed. Reload history if required
        if (template.state.get('reloadHistory')) {
            loadHistory(template);
        }
    }
});

Template.paidServicesHistory.helpers({
    historyEntries() {
        return Catenis.db.collection.ServicesCostHistory.find({_id: {$ne: -1}});
    },
    averageCost() {
        return Catenis.db.collection.ServicesCostHistory.findOne({_id: -1}).servicesAverageCost;
    },
    service(serviceName) {
        return Catenis.db.collection.PaidService.findOne({_id: serviceName});
    },
    objProperty(obj, propName) {
        return obj[propName];
    },
    formatDate(date) {
        return moment(date).format('lll');
    },
    formatServiceCredits(amount) {
        return ClientUtil.formatCatenisServiceCredits(amount);
    },
    historyLoaded() {
        return Template.instance().state.get('historyLoaded');
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
    servicesOptions() {
        const servicesOpts = [];
        const services = new Set(Template.instance().state.get('filterServices'));

        Catenis.db.collection.PaidService.find().fetch().forEach((doc) => {
            servicesOpts.push({
                value: doc._id,
                label: doc.abbreviation + ' - ' + doc.label,
                selected: services.has(doc._id) ? 'selected' : undefined
            });
        });

        return servicesOpts;
    },
    filterPeriod() {
        const template = Template.instance();
        const periodId = template.state.get('filterPeriodId');
        let label;

        if (periodId === 'custom') {
            const startDate = template.state.get('historyStartDate');
            const endDate = template.state.get('historyEndDate');
            label = '';

            if (startDate) {
                label += 'From ' + moment(startDate).format('lll');
            }

            if (endDate) {
                if (label.length > 0) {
                    label += ' '
                }

                label += 'To ' + moment(endDate).format('lll');
            }
        }
        else {
            label = periods[periodId].label;
        }

        return label ? label : '<i>not specified</i>';
    },
    filterServices() {
        const services = Template.instance().state.get('filterServices');

        return Catenis.db.collection.PaidService.find({
            _id: {
                $in: services
            }
        }, {
            fields: {
                _id: 1,
                abbreviation: 1
            }
        }).map(doc => doc.abbreviation).join(', ');
    },
    selectedServices() {
        const template = Template.instance();
        const services = template.state.get('filterServices');
        const startIdx = template.state.get('serviceColumnSetIdx') * maxServiceColumns
        const servicesToDisplay = [];

        for (let idx = startIdx, limit = Math.min(startIdx + maxServiceColumns, services.length); idx < limit; idx++) {
            servicesToDisplay.push(services[idx]);
        }

        return servicesToDisplay;
    },
    displayFilterStartDate() {
        return Template.instance().state.get('filterPeriodId') === 'custom' ? 'block' : 'none';
    },
    displayFilterEndDate() {
        return Template.instance().state.get('filterPeriodId') === 'custom' ? 'block' : 'none';
    },
    showHistoryRecords() {
        return Template.instance().state.get('showHistoryRecs');
    },
    linkHistoryRecsLabel() {
        return Template.instance().state.get('showHistoryRecs') ? 'Hide history records' : 'Show history records';
    },
    hasMoreServiceColumnSets() {
        const template = Template.instance();
        const numServiceColumnSets = Math.ceil(template.state.get('filterServices').length / maxServiceColumns);

        return template.state.get('serviceColumnSetIdx') < numServiceColumnSets - 1;
    },
    hasLessServiceColumnSets() {
        return Template.instance().state.get('serviceColumnSetIdx') > 0;
    },
    logicalOr(/*operators*/) {
        // Note: last argument is disregarded since it has some type of Spacebar context
        if (arguments.length > 1) {
            let result = false;

            for (let idx = 0, limit = arguments.length - 1; idx < limit; idx++) {
                result = result || !!arguments[idx];
            }

            return result;
        }
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
