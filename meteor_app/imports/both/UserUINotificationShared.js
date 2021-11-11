/**
 * Created by claudio on 2021-10-25
 */

//console.log('[UserUINotificationShared.js]: This code just ran.');

// Definition of classes
//

// UserUINotificationShared class
export class UserUINotificationShared {
    // Class (public) properties
    //

    static userNotificationStatus = Object.freeze({
        new: Object.freeze({
            name: 'new',
            description: 'This UI notification has been recently delivered to the user'
        }),
        read: Object.freeze({
            name: 'read',
            description: 'The user has signaled that this UI notification has already been read'
        }),
        deleted: Object.freeze({
            name: 'deleted',
            description: 'The user has signaled that this UI notification should not be displayed anymore'
        })
    });
}


// Module code
//

// Lock class
Object.freeze(UserUINotificationShared);
