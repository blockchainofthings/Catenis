/**
 * Created by claudio on 2021-10-27
 */

//console.log('[NotificationTemplatesTemplate.js]: This code just ran.');

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
import { UINotificationTemplateShared } from '../../both/UINotificationTemplateShared';
import { ClientUtil } from '../ClientUtil';

// Import template UI
import './NotificationTemplatesTemplate.html';

// Import dependent templates
import './NewNotificationTemplateTemplate.js';

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

    return (filter.name.equalityOp && filter.name.value)
        || filter.category
        || filter.urgency
        || filter.status;
}

function displayName(name) {
    return ClientUtil.capitalize(name.replace('_', ' '));
}

/**
 * Parse filter properties from received query string parameters
 * @param template
 * @return {{urgency: string, name: {equalityOp: string, value: string}, category: string, status: string}}
 */
function parseFilterProps(template) {
    const filter = {
        name: {
            equalityOp: '',
            value: ''
        },
        category: '',
        urgency: '',
        status: ''
    };
    
    if (template.data.equalityOp && isValidEqualityOp(template.data.equalityOp) && template.data.name) {
        filter.name.equalityOp = template.data.equalityOp;
        filter.name.value = template.data.name;
    }
    
    if (template.data.category) {
        const values = template.data.category.split(',')
            .reduce((list, v) => {
                const value = v.trim();

                if (UINotificationTemplateShared.isValidCategory(value)) {
                    list.push(value);
                }

                return list;
            }, []);

        if (values.length > 0) {
            filter.category = values.join(',');
        }
    }

    if (template.data.urgency) {
        const values = template.data.urgency.split(',')
            .reduce((list, v) => {
                const value = v.trim();

                if (UINotificationTemplateShared.isValidUrgency(value)) {
                    list.push(value);
                }

                return list;
            }, []);

        if (values.length > 0) {
            filter.urgency = values.join(',');
        }
    }

    if (template.data.status) {
        const values = template.data.status.split(',')
            .reduce((list, v) => {
                const value = v.trim();

                if (UINotificationTemplateShared.isValidTemplateStatus(value)) {
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

    if (filter.category) {
        queryParams.cat = filter.category;
    }

    if (filter.urgency) {
        queryParams.urg = filter.urgency;
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

    setMultiSelectValue(form.propCategory, filter.category);
    setMultiSelectValue(form.propUrgency, filter.urgency);
    setMultiSelectValue(form.propStatus, filter.status);
}

function resetFilter(form, template) {
    const filter = {
        name: {
            equalityOp: '',
            value: ''
        },
        category: '',
        urgency: '',
        status: ''
    };

    if (form.propNameEqOp.value && form.propNameValue.value) {
        filter.name.equalityOp = form.propNameEqOp.value;
        filter.name.value = form.propNameValue.value;
    }

    let value;
    
    if ((value = getMultiSelectValue(form.propCategory))) {
        filter.category = value;
    }

    if ((value = getMultiSelectValue(form.propUrgency))) {
        filter.urgency = value;
    }

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

Template.notifyTemplates.onCreated(function () {
    this.state = new ReactiveDict();

    this.state.set('showingFilter', this.data.showFilter);
    this.state.set('filter', parseFilterProps(this));
    this.state.set('selectedPropNameEqOp', '');

    // Subscribe to receive database docs/recs updates
    this.subscribe('uiNotificationTemplates');
});

Template.notifyTemplates.events({
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
            category: '',
            urgency: '',
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

Template.notifyTemplates.helpers({
    uiNotificationTemplates: function () {
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

            if (filter.category) {
                querySelector.category = {
                    $in: filter.category.split(',').map(v => v.trim())
                };
            }

            if (filter.urgency) {
                querySelector.urgency = {
                    $in: filter.urgency.split(',').map(v => v.trim())
                };
            }

            if (filter.status) {
                querySelector.status = {
                    $in: filter.status.split(',').map(v => v.trim())
                };
            }
        }

        return Catenis.db.collection.UINotificationTemplate.find(querySelector, {
            sort:{
                name: 1
            }
        }).fetch();
    },
    statusColor(status) {
        let color;

        switch (status) {
            case UINotificationTemplateShared.notificationTemplateStatus.draft.name:
                color = 'blue';
                break;

            case UINotificationTemplateShared.notificationTemplateStatus.active.name:
                color = 'green';
                break;

            case UINotificationTemplateShared.notificationTemplateStatus.disabled.name:
                color = 'gray';
                break;
        }

        return color;
    },
    displayName(name) {
        return ClientUtil.capitalize(name.replace('_', ' '));
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
    filterPropCategory() {
        const filter = Template.instance().state.get('filter');

        if (filter.category) {
            return filter.category.split(',')
                .map(v => displayName(v.trim()))
                .join(', ');
        }
    },
    filterPropUrgency() {
        const filter = Template.instance().state.get('filter');

        if (filter.urgency) {
            return filter.urgency.split(',')
            .map(v => displayName(v.trim()))
            .join(', ');
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
    filterCategories() {
        const filter = Template.instance().state.get('filter');

        return Object.values(UINotificationTemplateShared.notificationCategory)
            .map(category => ({
                name: displayName(category.name),
                value: category.name,
                selected: filter.category && filter.category.includes(category.name)
            }));
    },
    categoriesCount() {
        return Object.values(UINotificationTemplateShared.notificationCategory).length;
    },
    filterUrgencies() {
        const filter = Template.instance().state.get('filter');

        return Object.values(UINotificationTemplateShared.notificationUrgency)
            .map(urgency => ({
                name: displayName(urgency.name),
                value: urgency.name,
                selected: filter.urgency && filter.urgency.includes(urgency.name)
            }));
    },
    urgenciesCount() {
        return Object.values(UINotificationTemplateShared.notificationUrgency).length;
    },
    filterStatuses() {
        const filter = Template.instance().state.get('filter');

        return Object.values(UINotificationTemplateShared.notificationTemplateStatus)
            .map(status => ({
                name: status.name,
                value: status.name,
                selected: filter.status && filter.status.includes(status.name)
            }));
    },
    statusesCount() {
        return Object.values(UINotificationTemplateShared.notificationTemplateStatus).length;
    },
    selectedPropNameEqOp() {
        return Template.instance().state.get('selectedPropNameEqOp');
    },
    returnQueryString() {
        const serializedFilterProps = serializeFilterProps(Template.instance());

        if (serializedFilterProps) {
            return '?' + querystring.stringify({
                retparams: serializedFilterProps
            });
        }
    }
});
