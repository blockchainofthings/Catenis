/**
 * Created by claudio on 2021-10-13
 */

//console.log('[UINotificationTemplateShared.js]: This code just ran.');

// Definition of classes
//

// UINotificationTemplateShared class
export class UINotificationTemplateShared {
    // Class (public) properties
    //

    static notificationCategory = Object.freeze({
        maintenance: Object.freeze({
            name: 'maintenance',
            description: 'Notification warning of an upcoming Catenis maintenance period (when the system will be down)'
        }),
        new_release: Object.freeze({
            name: 'new_release',
            description: 'Notification informing about a newly released Catenis version'
        }),
        promotion: Object.freeze({
            name: 'promotion',
            description: 'Notification offering a deal to the end user'
        }),
        marketing: Object.freeze({
            name: 'marketing',
            description: 'Notification containing a general marketing communication with the end user'
        }),
        other: Object.freeze({
            name: 'other',
            description: 'Notification containing information that can not be classified as any of the defined categories'
        })
    });

    static notificationUrgency = Object.freeze({
        critical: Object.freeze({
            name: 'critical',
            description: 'A notification about something that will directly affect the target user in regard to the use of the system'
        }),
        urgent: Object.freeze({
            name: 'urgent',
            description: 'A notification that is important for the target user to know about'
        }),
        normal: Object.freeze({
            name: 'normal',
            description: 'A notification that would be nice for the target user to know about'
        }),
        low: Object.freeze({
            name: 'low',
            description: 'A notification that would not affect the target user in any way if he/she would never know about it'
        })
    });

    static notificationTemplateStatus = Object.freeze({
        draft: Object.freeze({
            name: 'draft',
            description: 'This is a new UI notification template that has not yet been finalized'
        }),
        active: Object.freeze({
            name: 'active',
            description: 'This UI notification template has been finalized and is available for use'
        }),
        disabled: Object.freeze({
            name: 'disabled',
            description: 'This UI notification is not available for use anymore'
        })
    });

    static isValidCategory(catName) {
        return Object.values(this.notificationCategory).some(cat => cat.name === catName);
    }

    static isValidUrgency(urgName) {
        return Object.values(this.notificationUrgency).some(urg => urg.name === urgName);
    }
}


// Module code
//

// Lock class
Object.freeze(UINotificationTemplateShared);
