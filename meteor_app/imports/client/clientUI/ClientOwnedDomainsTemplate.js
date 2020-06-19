/**
 * Created by claudio on 2020-06-19
 */

//console.log('[ClientOwnedDomainsTemplate.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import ClipboardJS from 'clipboard';
// Meteor packages
import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';
import { ReactiveDict } from 'meteor/reactive-dict';

// References code in other (Catenis) modules on the client
import { Catenis } from '../ClientCatenis';

// Import template UI
import './ClientOwnedDomainsTemplate.html';

// Module variables
const confirmPhrase = 'yes, i do confirm it';


// Definition of module (private) functions
//

function validateAddDomainFormData(form, errMsgs) {
    let hasError = false;

    const domainInfo = {
        name: form.domainName.value.trim()
    };

    if (domainInfo.name.length === 0) {
        // No domain name. Report error
        errMsgs.push('Please enter a domain name.');
        hasError = true;
    }
    else if (!isValidDomain(domainInfo.name)) {
        // Invalid domain name. Report error
        errMsgs.push('Please enter a valid domain name.');
        hasError = true;
    }

    return !hasError ? domainInfo : undefined;
}

function isValidDomain(domainName) {
    return /^[A-Za-z]([A-Za-z0-9\-]*[A-Za-z0-9])*(\.[A-Za-z]([A-Za-z0-9\-]*[A-Za-z0-9])*)*$/.test(domainName);
}


// Module code
//

Template.clientOwnedDomains.onCreated(function () {
    this.state = new ReactiveDict();

    this.state.set('errMsgs', []);
    this.state.set('infoMsg', undefined);
    this.state.set('infoMsgType', 'info');
    this.state.set('addDomainErrMsgs', []);
    this.state.set('deleteDomainErrMsgs', []);
    this.state.set('verifyDomainErrMsgs', []);
    this.state.set('targetDomainId', undefined);

    this.state.set('displayDeleteDomainSubmitButton', 'none');

    // Subscribe to receive database docs/recs updates
    this.currClntOwnedDomainsSubs = this.subscribe('currentClientOwnedDomains');
});

Template.clientOwnedDomains.onDestroyed(function () {
    if (this.currClntOwnedDomainsSubs) {
        this.currClntOwnedDomainsSubs.stop();
    }

    if (this.clipboard1) {
        this.clipboard1.destroy();
    }

    if (this.clipboard2) {
        this.clipboard2.destroy();
    }
});

Template.clientOwnedDomains.events({
    'click #btnDismissInfo'(event, template) {
        // Clear info message
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');
    },
    'click #btnDismissError'(event, template) {
        // Clear error message
        template.state.set('errMsgs', []);
    },
    'click #btnAddDomain'(event, template) {
        event.preventDefault();

        const form = $('#frmAddDomain')[0];

        // Reset alert messages
        template.state.set('addDomainErrMsgs', []);
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');

        // Enable and reset form controls
        form.domainName.disabled = false;
        form.domainName.value = '';
    },
    'shown.bs.modal #divAddDomain'(event, template) {
        // Modal panel is displayed. Set focus to form's first input field
        $('#itxDomainName').focus();
    },
    'hidden.bs.modal #divAddDomain'(event, template) {
        // Modal panel has been closed. Make sure that button used to
        //  activate modal panel is not selected
        $('#btnAddDomain').blur();
    },
    'click #btnDismissAddDomainError'(event, template) {
        // Clear error message
        template.state.set('addDomainErrMsgs', []);
    },
    'submit #frmAddDomain'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        const form = event.target;

        // Reset alert messages
        template.state.set('addDomainErrMsgs', []);
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');

        // Do validation of form controls here
        let errMsgs = [];
        let domainInfo;

        if ((domainInfo = validateAddDomainFormData(form, errMsgs))) {
            // Disable form controls
            form.domainName.disabled = true;

            Meteor.call('addCurrentClientOwnedDomain', domainInfo.name, (error) => {
                if (error) {
                    // Enable form controls
                    form.domainName.disabled = false;

                    let errMessage;

                    if ((error instanceof Meteor.Error) && error.error === 'client.owned.domain.add.failure' && error.message.search(/\[cl_own_dom_already_exist]/) > 0) {
                        errMessage = 'Error: domain name already exists';
                    }
                    else {
                        errMessage = error.toString();
                    }

                    // Display error message
                    template.state.set('addDomainErrMsgs', [
                        errMessage
                    ]);
                }
                else {
                    // New client owned domain added
                    template.state.set('infoMsg', `Domain ${domainInfo.name} successfully added`);
                    template.state.set('infoMsgType', 'success');

                    // Close modal panel
                    $('#divAddDomain').modal('hide');
                }
            });
        }
        else {
            // Form data error
            template.state.set('addDomainErrMsgs', errMsgs);
        }
    },

    'click #lnkDeleteDomain'(event, template) {
        event.preventDefault();

        const form = $('#frmDeleteDomain')[0];

        // Reset alert messages
        template.state.set('deleteDomainErrMsgs', []);
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');

        // Reset action confirmation
        $('#itxDeleteConfirmation')[0].value = '';
        template.state.set('displayDeleteDomainSubmitButton', 'none');
    },
    'show.bs.modal #divDeleteDomain'(event, template) {
        // Modal panel is being displayed. Identify target domain
        template.state.set('targetDomainId', $(event.relatedTarget).data('domain_id'));
    },
    'hidden.bs.modal #divDeleteDomain'(event, template) {
        // Modal panel has been closed. Make sure that button used to
        //  activate modal panel is not selected
        $(`#lnkDeleteDomain[data-domain_id="${template.state.get('targetDomainId')}"]`).blur();
    },
    'input #itxDeleteConfirmation'(event, template) {
        // Suppress spaces from beginning of input
        let inputValue = event.target.value = event.target.value.replace(/^\s+/, '');

        if (inputValue.length > confirmPhrase.length) {
            // Limit length of input
            inputValue = event.target.value = inputValue.substring(0, confirmPhrase.length);
        }

        // Check if input matches confirmation phrase
        if (inputValue.toLowerCase() === confirmPhrase) {
            // Show button to confirm action
            template.state.set('displayDeleteDomainSubmitButton', 'inline');
        }
        else {
            // Hide button to confirm action
            template.state.set('displayDeleteDomainSubmitButton', 'none');
        }
    },
    'click #btnDismissDeleteDomainError'(event, template) {
        // Clear error message
        template.state.set('deleteDomainErrMsgs', []);
    },
    'submit #frmDeleteDomain'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        const form = event.target;

        // Reset alert messages
        template.state.set('deleteDomainErrMsgs', []);
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');

        Meteor.call('deleteCurrentClientOwnedDomain', form.domainName.value, (error) => {
            if (error) {
                // Reset action confirmation and...
                $('#itxDeleteConfirmation')[0].value = '';
                template.state.set('displayDeleteDomainSubmitButton', 'none');

                // Display error message
                template.state.set('deleteDomainErrMsgs', [
                    error.toString()
                ]);
            }
            else {
                // New client owned domain added
                template.state.set('infoMsg', `Domain ${form.domainName.value} successfully deleted`);
                template.state.set('infoMsgType', 'success');

                // Close modal panel
                $('#divDeleteDomain').modal('hide');
            }
        });
    },

    'click #lnkCopyRecName'(event, template) {
        const $button = $(event.currentTarget);

        $button.attr('aria-label', 'Copied!');
        $button.addClass('tooltipped tooltipped-s');
    },
    'mouseleave #lnkCopyRecName'(event, template) {
        const $button = $(event.currentTarget);

        $button.removeClass('tooltipped tooltipped-s');
        $button.attr('aria-label', 'Copy to clipboard');
    },
    'click #lnkCopyRecValue'(event, template) {
        const $button = $(event.currentTarget);

        $button.attr('aria-label', 'Copied!');
        $button.addClass('tooltipped tooltipped-s');
    },
    'mouseleave #lnkCopyRecValue'(event, template) {
        const $button = $(event.currentTarget);

        $button.removeClass('tooltipped tooltipped-s');
        $button.attr('aria-label', 'Copy to clipboard');
    },
    'click #lnkVerifyDomain'(event, template) {
        event.preventDefault();

        // Set up functionality to copy to clipboard
        template.clipboard1 = new ClipboardJS('#lnkCopyRecName', {
            container: document.getElementById('divVerifyDomain')
        });
        template.clipboard2 = new ClipboardJS('#lnkCopyRecValue', {
            container: document.getElementById('divVerifyDomain')
        });

        const form = $('#frmVerifyDomain')[0];

        // Reset alert messages
        template.state.set('verifyDomainErrMsgs', []);
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');
    },
    'show.bs.modal #divVerifyDomain'(event, template) {
        // Modal panel is being displayed. Identify target domain
        template.state.set('targetDomainId', $(event.relatedTarget).data('domain_id'));
    },
    'hidden.bs.modal #divVerifyDomain'(event, template) {
        // Modal panel has been closed. Make sure that button used to
        //  activate modal panel is not selected
        $(`#lnkVerifyDomain[data-domain_id="${template.state.get('targetDomainId')}"]`).blur();
    },
    'click #btnDismissVerifyDomainError'(event, template) {
        // Clear error message
        template.state.set('verifyDomainErrMsgs', []);
    },
    'submit #frmVerifyDomain'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        const form = event.target;

        // Reset alert messages
        template.state.set('verifyDomainErrMsgs', []);
        template.state.set('errMsgs', []);
        template.state.set('infoMsg', undefined);
        template.state.set('infoMsgType', 'info');

        Meteor.call('verifyCurrentClientOwnedDomain', form.domainName.value, (error, success) => {
            if (error) {
                // Display error message
                template.state.set('verifyDomainErrMsgs', [
                    error.toString()
                ]);
            }
            else {
                if (success) {
                    // New client owned domain added
                    template.state.set('infoMsg', `Domain ${form.domainName.value} successfully verified`);
                    template.state.set('infoMsgType', 'success');

                    // Close modal panel
                    $('#divVerifyDomain').modal('hide');
                }
                else {
                    // Failed to verify DNS record. Display error message
                    template.state.set('verifyDomainErrMsgs', [
                        'Error: DNS record not found or its value is not as expected'
                    ]);
                }
            }
        });
    }
});

Template.clientOwnedDomains.helpers({
    domains() {
        return Catenis.db.collection.ClientOwnedDomain.find({}, {sort:{'name': 1}}).fetch();
    },
    targetDomain() {
        return Catenis.db.collection.ClientOwnedDomain.findOne({_id: Template.instance().state.get('targetDomainId')});
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
    hasAddDomainErrorMessage() {
        return Template.instance().state.get('addDomainErrMsgs').length > 0;
    },
    addDomainErrorMessage() {
        return Template.instance().state.get('addDomainErrMsgs').reduce((compMsg, errMsg) => {
            if (compMsg.length > 0) {
                compMsg += '<br>';
            }
            return compMsg + errMsg;
        }, '');
    },
    hasDeleteDomainErrorMessage() {
        return Template.instance().state.get('deleteDomainErrMsgs').length > 0;
    },
    deleteDomainErrorMessage() {
        return Template.instance().state.get('deleteDomainErrMsgs').reduce((compMsg, errMsg) => {
            if (compMsg.length > 0) {
                compMsg += '<br>';
            }
            return compMsg + errMsg;
        }, '');
    },
    displayDeleteDomainSubmitButton() {
        return Template.instance().state.get('displayDeleteDomainSubmitButton');
    },
    hasVerifyDomainErrorMessage() {
        return Template.instance().state.get('verifyDomainErrMsgs').length > 0;
    },
    verifyDomainErrorMessage() {
        return Template.instance().state.get('verifyDomainErrMsgs').reduce((compMsg, errMsg) => {
            if (compMsg.length > 0) {
                compMsg += '<br>';
            }
            return compMsg + errMsg;
        }, '');
    }
});
