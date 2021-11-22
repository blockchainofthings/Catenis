/**
 * Created by claudio on 2021-11-03
 */

//console.log('[NotificationsTemplate.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import querystring from 'querystring';
// Third-party node modules
//import config from 'config';
// Meteor packages
//import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';
import { ReactiveDict } from 'meteor/reactive-dict';

// References code in other (Catenis) modules on the client
import { Catenis } from '../ClientCatenis';
import { ClientUtil } from '../ClientUtil';
import { UINotificationShared } from '../../both/UINotificationShared';
import { UINotificationTemplateShared } from '../../both/UINotificationTemplateShared';

// Import template UI
import './NotificationsTemplate.html';

// Import dependent templates
import './NewNotificationTemplate.js';
import './NotificationDetailsTemplate.js';

// Module variables
const filterEqualityOp = {
    exact_text: 'exact_text',
    includes: 'includes',
    starts_with: 'starts_with',
    ends_with: 'ends_with'
};


// Definition of module (private) functions
//

function isValidEqualityOp(opName) {
    return Object.values(filterEqualityOp).some(op => op === opName);
}

function isFilterOn(template) {
    const filter = template.state.get('filter');

    return (filter.name.equalityOp && filter.name.value) || filter.status;
}

function displayName(name) {
    return ClientUtil.capitalize(name.replace('_', ' '));
}

/**
 * Parse filter properties from received query string parameters
 * @param template
 * @return {{name: {equalityOp: string, value: string}, status: string}}
 */
function parseFilterProps(template) {
    const filter = {
        name: {
            equalityOp: '',
            value: ''
        },
        status: ''
    };

    if (template.data.equalityOp && isValidEqualityOp(template.data.equalityOp) && template.data.name) {
        filter.name.equalityOp = template.data.equalityOp;
        filter.name.value = template.data.name;
    }

    if (template.data.status) {
        const values = template.data.status.split(',')
            .reduce((list, v) => {
                const value = v.trim();

                if (UINotificationShared.isValidStatus(value)) {
                    list.push(value);
                }

                return list;
            }, []);

        if (values.length > 0) {
            filter.status = values.join(',');
        }
    }

    return filter;
}

/**
 * Serialize filter properties into query string parameters
 * @param template
 * @param {boolean} [includeDisplayState=true]
 * @return {string}
 */
function serializeFilterProps(template, includeDisplayState = true) {
    const filter = template.state.get('filter');
    const queryParams = includeDisplayState
        ? {
            fltr: template.state.get('showingFilter')
        }
        : {};

    if (filter.name.equalityOp && filter.name.value) {
        queryParams.eq_op = filter.name.equalityOp;
        queryParams.name = filter.name.value;
    }

    if (filter.status) {
        queryParams.stat = filter.status;
    }

    return querystring.stringify(queryParams);
}

function initResetFilterForm(form, template) {
    const filter = template.state.get('filter');

    form.propNameEqOp.value = filter.name.equalityOp;
    template.state.set('selectedPropNameEqOp', filter.name.equalityOp);

    form.propNameValue.value = filter.name.value;

    setMultiSelectValue(form.propStatus, filter.status);
}

function resetFilter(form, template) {
    const filter = {
        name: {
            equalityOp: '',
            value: ''
        },
        status: ''
    };

    if (form.propNameEqOp.value && form.propNameValue.value) {
        filter.name.equalityOp = form.propNameEqOp.value;
        filter.name.value = form.propNameValue.value;
    }

    let value;

    if ((value = getMultiSelectValue(form.propStatus))) {
        filter.status = value;
    }

    template.state.set('filter', filter);
}

function getMultiSelectValue(sel) {
    return Array.from(sel.selectedOptions).map(op => op.value).join(',');
}

function setMultiSelectValue(sel, val) {
    const values = val.split(',').map(v => v.trim());

    Array.from(sel.options).forEach(op => {
        op.selected = values.includes(op.value);
    });
}


// Module code
//

Template.notifications.onCreated(function () {
    this.state = new ReactiveDict();

    this.state.set('showingFilter', this.data.showFilter);
    this.state.set('filter', parseFilterProps(this));
    this.state.set('selectedPropNameEqOp', '');

    // Subscribe to receive database docs/recs updates
    this.subscribe('uiNotificationTemplateRecord', this.data.uiNotificationTemplate_id);
    this.subscribe('uiNotifications', this.data.uiNotificationTemplate_id);
});

Template.notifications.events({
    'click #lnkShowFilter, click #lnkHideFilter'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        // Toggle display of filter
        template.state.set('showingFilter', !template.state.get('showingFilter'));
    },
    'change #selPropNameEqOp'(event, template) {
        template.state.set('selectedPropNameEqOp', event.target.value);
    },
    'show.bs.modal #divResetFilter'(event, template) {
        // Modal panel used to reset filter is about to be displayed.
        //  Initialize form
        initResetFilterForm($('#frmResetFilter')[0], template);
    },
    'shown.bs.modal #divResetFilter'(event, template) {
        // Set focus to first form control
        $('#frmResetFilter')[0].propNameEqOp.focus();
    },
    'hidden.bs.modal #divResetFilter'(event, template) {
        // Modal panel has been closed. Make sure that link used to
        //  activate modal panel is not selected
        $('#lnkResetFilter').blur();
    },
    'reset #frmResetFilter'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        // Clear all filter props
        template.state.set('filter', {
            name: {
                equalityOp: '',
                value: ''
            },
            status: ''
        });

        // Close modal panel
        $('#divResetFilter').modal('hide');
    },
    'submit #frmResetFilter'(event, template) {
        event.preventDefault();
        event.stopPropagation();

        resetFilter(event.currentTarget, template);

        // Close modal panel
        $('#divResetFilter').modal('hide');
    },
});

Template.notifications.helpers({
    backQueryString() {
        const retParams = Template.instance().data.retParams;

        return retParams ? '?' + retParams : undefined;
    },
    uiNotificationTemplate() {
        return Catenis.db.collection.UINotificationTemplate.findOne({
            _id: Template.instance().data.uiNotificationTemplate_id
        });
    },
    uiNotifications: function () {
        const template = Template.instance();
        const querySelector = {};

        if (isFilterOn(template)) {
            const filter = template.state.get('filter');

            if (filter.name.equalityOp && filter.name.value) {
                const prefix = filter.name.equalityOp === filterEqualityOp.exact_text
                    || filter.name.equalityOp === filterEqualityOp.starts_with
                    ? '^' : '';
                const suffix = filter.name.equalityOp === filterEqualityOp.exact_text
                    || filter.name.equalityOp === filterEqualityOp.ends_with
                    ? '$' : '';

                querySelector.name = new RegExp(`${prefix}${filter.name.value}${suffix}`, 'i');
            }

            if (filter.status) {
                querySelector.status = {
                    $in: filter.status.split(',').map(v => v.trim())
                };
            }
        }

        return Catenis.db.collection.UINotification.find(querySelector, {
            sort:{
                name: 1
            }
        }).fetch();
    },
    statusColor(status) {
        let color;

        switch (status) {
            case UINotificationShared.notificationStatus.draft.name:
                color = 'blue';
                break;

            case UINotificationShared.notificationStatus.outdated.name:
                color = 'red';
                break;

            case UINotificationShared.notificationStatus.issued.name:
                color = 'gray';
                break;
        }

        return color;
    },
    isDisabled(uiNotificationTemplate) {
        return uiNotificationTemplate.status === UINotificationTemplateShared.notificationTemplateStatus.disabled.name;
    },
    showingFilter() {
        return Template.instance().state.get('showingFilter');
    },
    isFilterOn() {
        return isFilterOn(Template.instance());
    },
    filterState() {
        return isFilterOn(Template.instance()) ? 'on' : 'off';
    },
    filterPropName() {
        const filter = Template.instance().state.get('filter');

        if (filter.name.equalityOp && filter.name.value) {
            return `<span style="font-style:italic">${filter.name.equalityOp.replace('_', ' ')}</span>&nbsp;&nbsp;&nbsp;${filter.name.value}`;
        }
    },
    filterPropStatus() {
        const filter = Template.instance().state.get('filter');

        if (filter.status) {
            return filter.status.split(',')
                .map(v => v.trim())
                .join(', ');
        }
    },
    filterEqualityOps() {
        const template = Template.instance();
        const filter = template.state.get('filter');

        return Object.values(filterEqualityOp)
            .map(op => {
                let selected = false;

                if (filter.name.equalityOp === op) {
                    template.state.set('selectedPropNameEqOp', op);
                    selected = true;
                }

                return {
                    name: displayName(op),
                    value: op,
                    selected
                }
            });
    },
    filterStatuses() {
        const filter = Template.instance().state.get('filter');

        return Object.values(UINotificationShared.notificationStatus)
            .map(status => ({
                name: status.name,
                value: status.name,
                selected: filter.status && filter.status.includes(status.name)
            }));
    },
    statusesCount() {
        return Object.values(UINotificationShared.notificationStatus).length;
    },
    selectedPropNameEqOp() {
        return Template.instance().state.get('selectedPropNameEqOp');
    },
    returnQueryString() {
        const template = Template.instance();
        let retParams = template.data.retParams;

        if (retParams) {
            retParams = {
                retparams: retParams
            };
        }

        const serializedFilterProps = serializeFilterProps(template);

        if (serializedFilterProps) {
            retParams = {
                ...querystring.parse(serializedFilterProps),
                ...retParams
            };
        }

        if (retParams) {
            return '?' + querystring.stringify({
                retparams: querystring.stringify(retParams)
            });
        }
    }
});
