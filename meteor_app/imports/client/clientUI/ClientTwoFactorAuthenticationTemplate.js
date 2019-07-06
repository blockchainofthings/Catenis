/**
 * Created by Claudio on 2019-06-28.
 */

//console.log('[ClientTwoFactorAuthentication.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import ClipboardJS from 'clipboard';
import moment from 'moment';
// Meteor packages
import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';
import { ReactiveDict } from 'meteor/reactive-dict';

// References code in other (Catenis) modules on the client
import { Catenis } from '../ClientCatenis';

// Import template UI
import './ClientTwoFactorAuthenticationTemplate.html';

// Import dependent templates
import '../adminUI/TwoFactorAuthenticationSecretTemplate.js';


// Module variables
const confirmPhrase = 'yes, i do confirm it';


// Definition of module (private) functions
//

function validateFormData(form, errMsgs) {
    let token;
    let hasError = false;

    token = form.verifyToken.value ? form.verifyToken.value.trim() : '';

    if (token.length === 0) {
        // Token not supplied. Report error
        errMsgs.push('Please enter a numeric code');
        form.verifyToken.focus();
        hasError = true;
    }

    return !hasError ? token : undefined;
}

function checkRecoveryCodesAvailable() {
    const recoveryCodes = Catenis.db.collection.TwoFactorAuthInfo.findOne(1).recoveryCodes;

    return recoveryCodes !== undefined && recoveryCodes.length > 0;
}

function generateRecoveryCodesDoc(recoveryCodes) {
    const header = 'Catenis Two-factor Authentication Recovery Codes\n(Generated on ' + moment().format('lll') + ')\n\n';

    return recoveryCodes.reduce((text, code) => {
        return text + '[  ] ' + code + '\n';
    }, header);
}


// Module code
//

Template.clientTwoFactorAuthentication.onCreated(function () {
    this.state = new ReactiveDict();

    this.state.set('errMsgs', []);
    this.state.set('validateErrMsgs', []);
    this.state.set('secretProcessed', false);
    this.state.set('secret', undefined);
    this.state.set('authUri', undefined);

    this.state.set('displayDisable2FASubmitButton', 'none');
    this.state.set('displayGenerateRecoveryCodesSubmitButton', 'none');

    // Subscribe to receive database docs/recs updates
    this.clientTwoFactorAuthenticationSubs = this.subscribe('clientTwoFactorAuthentication');
});

Template.clientTwoFactorAuthentication.onDestroyed(function () {
    if (this.clientTwoFactorAuthenticationSubs) {
        this.clientTwoFactorAuthenticationSubs.stop();
    }

    if (this.clipboard) {
        this.clipboard.destroy();
    }
});

Template.clientTwoFactorAuthentication.events({
    'click #btnDismissError'(event, template) {
        // Clear error message
        template.state.set('errMsgs', []);
    },
    'click #btnDismissValidateError'(event, template) {
        // Clear error message
        template.state.set('validateErrMsgs', []);
    },
    'click #btnEnable2FA'(event, template) {
        template.state.set('secretProcessed', false);

        // Clear error messages
        template.state.set('errMsgs', []);
        template.state.set('validateErrMsgs', []);

        Meteor.call('enable2FAClient', (error, result) => {
            if (error) {
                // Show error
                template.state.set('errMsgs', [error.toString()]);
            }
            else {
                template.state.set('secret', result.secret);
                template.state.set('authUri', result.authUri);

                // Open modal panel
                $('#divEnable2FA').modal('show');
            }
        });
    },
    'click #btnProceed'(event, template) {
        template.state.set('secretProcessed', true);
    },
    'hidden.bs.modal #divEnable2FA'(event, template) {
        // Modal panel has been closed. Make sure that button used to
        //  activate modal panel is not selected
        $('#btnEnable2FA').blur();
    },
    'submit #frmVerify2FA'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        // Clear error messages
        template.state.set('validateErrMsgs', []);

        const form = event.target;

        let errMsgs = [];
        let token;

        if ((token = validateFormData(form, errMsgs))) {
            Meteor.call('validate2FATokenClient', token, (error, isTokenValid) => {
                if (error) {
                    // Show error
                    template.state.set('validateErrMsgs', [error.toString()]);
                }
                else {
                    if (!isTokenValid) {
                        template.state.set('validateErrMsgs', ['Invalid two-factor authentication code. Please try again']);

                        // Reset form
                        form.verifyToken.value = '';
                        form.verifyToken.focus();
                    }
                    else {
                        // Close modal panel
                        $('#divEnable2FA').modal('hide');
                    }
                }
            });
        }
        else {
            template.state.set('validateErrMsgs', errMsgs);
        }
    },
    'click #btnDisable2FA'(event, template) {
        event.preventDefault();

        // Clear error messages
        template.state.set('errMsgs', []);

        // Reset action confirmation
        $('#itxDisable2FAConfirmation')[0].value = '';
        template.state.set('displayDisable2FASubmitButton', 'none');
    },
    'hidden.bs.modal #divDisable2FA'(event, template) {
        // Modal panel has been closed. Make sure that button used to
        //  activate modal panel is not selected
        $('#btnDisable2FA').blur();
    },
    'input #itxDisable2FAConfirmation'(event, template) {
        // Suppress spaces from beginning of input
        let inputValue = event.target.value = event.target.value.replace(/^\s+/, '');

        if (inputValue.length > confirmPhrase.length) {
            // Limit length of input
            inputValue = event.target.value = inputValue.substring(0, confirmPhrase.length);
        }

        // Check if input matches confirmation phrase
        if (inputValue.toLowerCase() === confirmPhrase) {
            // Show button to confirm action
            template.state.set('displayDisable2FASubmitButton', 'inline');
        }
        else {
            // Hide button to confirm action
            template.state.set('displayDisable2FASubmitButton', 'none');
        }
    },
    'submit #frmDisable2FA'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        // Close modal panel
        $('#divDisable2FA').modal('hide');

        // Reset error messages
        template.state.set('errMsgs', []);

        Meteor.call('disable2FAClient', (error) => {
            if (error) {
                template.state.set('errMsgs', [error.toString()]);
            }
        });
    },
    'click #btnGenerateRecoveryCodes'(event, template) {
        event.preventDefault();

        // Clear error messages
        template.state.set('errMsgs', []);

        // Reset action confirmation
        $('#itxGenerateRecoveryCodesConfirmation')[0].value = '';
        template.state.set('displayGenerateRecoveryCodesSubmitButton', 'none');
    },
    'click #lnkGenerateRecoveryCodes'(event, template) {
        event.preventDefault();

        // Clear error messages
        template.state.set('errMsgs', []);

        // Reset action confirmation
        $('#itxGenerateRecoveryCodesConfirmation')[0].value = '';
        template.state.set('displayGenerateRecoveryCodesSubmitButton', 'none');
    },
    'hidden.bs.modal #divGenerateRecoveryCodes'(event, template) {
        // Modal panel has been closed. Make sure that button used to
        //  activate modal panel is not selected
        $('#btnGenerateRecoveryCodes').blur();
    },
    'input #itxGenerateRecoveryCodesConfirmation'(event, template) {
        // Suppress spaces from beginning of input
        let inputValue = event.target.value = event.target.value.replace(/^\s+/, '');

        if (inputValue.length > confirmPhrase.length) {
            // Limit length of input
            inputValue = event.target.value = inputValue.substring(0, confirmPhrase.length);
        }

        // Check if input matches confirmation phrase
        if (inputValue.toLowerCase() === confirmPhrase) {
            // Show button to confirm action
            template.state.set('displayGenerateRecoveryCodesSubmitButton', 'inline');
        }
        else {
            // Hide button to confirm action
            template.state.set('displayGenerateRecoveryCodesSubmitButton', 'none');
        }
    },
    'submit #frmGenerateRecoveryCodes'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        const confirmed = checkRecoveryCodesAvailable()
            ? confirm('LAST CHANCE!\n\nIf you proceed, any previously generated recovery codes will be invalidated.\n\nPLEASE NOTE THAT THIS ACTION CANNOT BE UNDONE.')
            : true;

        if (confirmed) {
            // Close modal panel
            $('#divGenerateRecoveryCodes').modal('hide');

            // Reset error messages
            template.state.set('errMsgs', []);

            Meteor.call('generateRecoveryCodesClient', (error) => {
                if (error) {
                    template.state.set('errMsgs', [error.toString()]);
                }
            });
        }
    },
    'click #btnShowRecoveryCodes'(event, template) {
        template.clipboard = new ClipboardJS('#btnCopyClipboard', {
            container: document.getElementById('divShowRecoveryCodes')
        });
    },
    'click #btnCopyClipboard'(event, template) {
        const $button = $(event.currentTarget);

        $button.addClass('tooltipped tooltipped-s');
        $button.attr('aria-label', 'Copied!');
    },
    'mouseleave #btnCopyClipboard'(event, template) {
        const $button = $(event.currentTarget);

        $button.removeAttr('aria-label');
        $button.removeClass('tooltipped tooltipped-s');
    },
    'hidden.bs.modal #divShowRecoveryCodes'(event, template) {
        // Modal panel has been closed. Make sure that button used to
        //  activate modal panel is not selected
        $('#btnShowRecoveryCodes').blur();
    }
});

Template.clientTwoFactorAuthentication.helpers({
    _2fa() {
        return Catenis.db.collection.TwoFactorAuthInfo.findOne(1);
    },
    secretProcessed() {
        return Template.instance().state.get('secretProcessed');
    },
    secret() {
        return Template.instance().state.get('secret');
    },
    authUri() {
        return Template.instance().state.get('authUri');
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
    hasValidateErrorMessage() {
        return Template.instance().state.get('validateErrMsgs').length > 0;
    },
    validateErrorMessage() {
        return Template.instance().state.get('validateErrMsgs').reduce((compMsg, errMsg) => {
            if (compMsg.length > 0) {
                compMsg += '<br>';
            }
            return compMsg + errMsg;
        }, '');
    },
    displayDisable2FASubmitButton() {
        return Template.instance().state.get('displayDisable2FASubmitButton');
    },
    displayGenerateRecoveryCodesSubmitButton() {
        return Template.instance().state.get('displayGenerateRecoveryCodesSubmitButton');
    },
    areRecoveryCodesAvailable() {
        return checkRecoveryCodesAvailable();
    },
    copyRecoveryCodes() {
        const recoveryCodes = Catenis.db.collection.TwoFactorAuthInfo.findOne(1).recoveryCodes;

        return generateRecoveryCodesDoc(recoveryCodes);
    },
    downloadRecoveryCodes() {
        const recoveryCodes = Catenis.db.collection.TwoFactorAuthInfo.findOne(1).recoveryCodes;

        return encodeURIComponent(generateRecoveryCodesDoc(recoveryCodes));
    }
});
