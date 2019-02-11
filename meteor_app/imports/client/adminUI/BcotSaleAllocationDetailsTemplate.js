/**
 * Created by Claudio on 2018-12-12.
 */

//console.log('[BcotSaleAllocationDetailsTemplate.js]: This code just ran.');

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
import { Catenis } from '../ClientCatenis';
import { BcotSaleAllocationShared } from '../../both/BcotSaleAllocationShared';

// Import template UI
import './BcotSaleAllocationDetailsTemplate.html';

// Import dependent templates

// Module variables
const confirmPhrase = 'yes, i do confirm it';


// Definition of module (private) functions
//

function getAllocation(template) {
    return Catenis.db.collection.BcotSaleAllocation.findOne({_id: template.data.bcotSaleAllocation_id});
}

function formatDate (dt) {
    return moment(dt).format('YYYYMMDD-HHmmss');
}


// Module code
//

Template.bcotSaleAllocationDetails.onCreated(function () {
    this.state = new ReactiveDict();

    this.state.set('errMsgs', []);
    this.state.set('infoMsg', undefined);
    this.state.set('infoMsgType', 'info');

    this.state.set('generatingReport', false);
    this.state.set('reportDownloaded', false);
    this.state.set('reportData', undefined);
    this.state.set('reportFilename', undefined);
    this.state.set('displaySetAllocationInUseSubmitButton', 'none');

    Meteor.call('getAllocProdsReportConfig', (error, config) => {
        if (error) {
            console.log('Error calling \'getAllocProdsReportConfig\' remote method: ' + error);
        }
        else {
            this.state.set('cfgSettings', config);
        }
    });

    // Subscribe to receive database docs/recs updates
    this.bcotSaleAllocationSubs = this.subscribe('bcotSaleAllocationRecord', this.data.bcotSaleAllocation_id);
});

Template.bcotSaleAllocationDetails.onDestroyed(function () {
    if (this.bcotSaleAllocationSubs) {
        this.bcotSaleAllocationSubs.stop();
    }
});

Template.bcotSaleAllocationDetails.events({
    'click #btnDismissInfo'(events, template) {
        // Clear info message
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');
    },
    'click #btnDismissError'(events, template) {
        // Clear error message
        template.state.set('errMsgs', []);
    },
    'click #btnGenReport'(events, template) {
        event.preventDefault();

        // Clear alerts
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');
        let errMsgs = [];

        const cfgSettings = template.state.get('cfgSettings');
        const allocation = getAllocation(template);

        // Compose report filename
        template.state.set('reportFilename', util.format('%s_%s.%s', cfgSettings.baseFilename, formatDate(allocation.allocationDate), cfgSettings.fileExtension));

        template.state.set('generatingReport', true);
        template.state.set('infoMsg', 'Generating report...');
        template.state.set('infoMsgType', 'info');

        // Call remote method to generate report
        Meteor.call('generateAllocProdsReport', allocation._id, (error, report) => {
            template.state.set('generatingReport', false);

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
    },
    'click #lnkDownload'(events, template) {
        // Show reminder to set BCOT allocation in use
        alert('REMINDER: please do not forget to set the BCOT sale allocation IN USE after the report is successfully downloaded.');

        // Reset alert messages
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');

        // Indicate that report has been downloaded
        template.state.set('reportDownloaded', true);
    },
    'click #btnSetAllocationInUse'(events, template) {
        event.preventDefault();

        // Reset alert messages
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');

        // Reset action confirmation
        $('#itxSetAllocationInUseConfirmation')[0].value = '';
        template.state.set('displaySetAllocationInUseSubmitButton', 'none');
    },
    'hidden.bs.modal #divSetAllocationInUse'(events, template) {
        // Modal panel has been closed. Make sure that button used to
        //  activate modal panel is not selected
        $('#btnSetAllocationInUse').blur();
    },
    'input #itxSetAllocationInUseConfirmation'(event, template) {
        // Suppress spaces from beginning of input
        let inputValue = event.target.value = event.target.value.replace(/^\s+/, '');

        if (inputValue.length > confirmPhrase.length) {
            // Limit length of input
            inputValue = event.target.value = inputValue.substring(0, confirmPhrase.length);
        }

        // Check if input matches confirmation phrase
        if (inputValue.toLowerCase() === confirmPhrase) {
            // Show button to confirm action
            template.state.set('displaySetAllocationInUseSubmitButton', 'inline');
        }
        else {
            // Hide button to confirm action
            template.state.set('displaySetAllocationInUseSubmitButton', 'none');
        }
    },
    'submit #frmSetAllocationInUse'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        const confirmMsg = 'LAST CHANCE!\n\nIf you proceed, the BCOT sale allocation will be set in use, and you will NOT be able to download the report with the allocated BCOT products anymore.\n\nPLEASE NOTE THAT THIS ACTION CANNOT BE UNDONE.';

        if (confirm(confirmMsg)) {
            // Close modal panel
            $('#divSetAllocationInUse').modal('hide');

            // Reset alert messages
            template.state.set('errMsgs', []);
            template.state.set('infoMsg', undefined);
            template.state.set('infoMsgType', 'info');

            Meteor.call('setBcotSaleAllocationInUse', template.data.bcotSaleAllocation_id, (error) => {
                if (error) {
                    const errMsgs = template.state.get('errMsgs');
                    errMsgs.push('Error setting BCOT sale allocation in use: ' + error.toString());
                    template.state.set('errMsgs', errMsgs);
                }
                else {
                    template.state.set('infoMsg', 'BCOT sale allocation successfully set in use');
                    template.state.set('infoMsgType', 'success');
                }
            });
        }
        else {
            // Close modal panel
            $('#divSetAllocationInUse').modal('hide');
        }
    }
});

Template.bcotSaleAllocationDetails.helpers({
    backQueryString() {
        const retParams = Template.instance().data.retParams;

        return retParams ? '?' + retParams : undefined;
    },
    isConfigReady () {
        return Template.instance().state.get('cfgSettings') !== undefined;
    },
    andClause (op1, op2) {
        return op1 && op2;
    },
    allocation() {
        return getAllocation(Template.instance());
    },
    statusColor(status) {
        let color;

        switch (status) {
            case BcotSaleAllocationShared.status.new.name:
                color = 'blue';
                break;

            case BcotSaleAllocationShared.status.in_use.name:
                color = 'green';
                break;
        }

        return color;
    },
    statusName(status) {
        return status.replace(/_+/g, ' ').trim();
    },
    isInUse(status) {
        return status === BcotSaleAllocationShared.status.in_use.name;
    },
    hasErrorMessage() {
        return Template.instance().state.get('errMsgs').length > 0;
    },
    errorMessage() {
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
    canGenerateReport(allocation) {
        return allocation.status === BcotSaleAllocationShared.status.new.name && Template.instance().state.get('reportData') === undefined
                && !Template.instance().state.get('generatingReport');
    },
    canDownloadReport(allocation) {
        return allocation.status === BcotSaleAllocationShared.status.new.name && Template.instance().state.get('reportData') !== undefined;
    },
    canSetAllocationInUse(allocation) {
        return allocation.status === BcotSaleAllocationShared.status.new.name && Template.instance().state.get('reportDownloaded');
    },
    displaySetAllocationInUseSubmitButton() {
        return Template.instance().state.get('displaySetAllocationInUseSubmitButton');
    },
    reportFilename: function () {
        return Template.instance().state.get('reportFilename');
    },
    reportData: function () {
        return Template.instance().state.get('reportData');
    }
});
