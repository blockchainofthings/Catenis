/**
 * Created by claudio on 2021-10-21
 */

//console.log('[UINotificationShared.js]: This code just ran.');

// Definition of classes
//

// UINotificationShared class
export class UINotificationShared {
    // Class (public) properties
    //

    static notificationStatus = Object.freeze({
        draft: Object.freeze({
            name: 'draft',
            description: 'This is a new UI notification that has not yet been finalized'
        }),
        outdated: Object.freeze({
            name: 'outdated',
            description: 'The contents static fields value of this UI notification is currently not consistent with the associated UI notification template and should be revised'
        }),
        issued: Object.freeze({
            name: 'issued',
            description: 'This UI notification has been finalized and is ready to be delivered'
        })
    });
}


// Module code
//

// Lock class
Object.freeze(UINotificationShared);
