/**
 * Created by claudio on 17/08/17.
 */

//console.log('[Notification.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//  NOTE: the reference of these modules are done using 'require()' instead of 'import' to
//      to avoid annoying WebStorm warning message: 'default export is not defined in
//      imported module'
const util = require('util');
// Third-party node modules
import config from 'config';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { restApiRootPath } from './RestApi';

// Config entries
const notificationConfig = config.get('notification');

// Configuration settings
const cfgSettings = {
    notifyRootPath: notificationConfig.get('notifyRootPath')
};


// Definition of function classes
//

// Notification function class
export function Notification(notifyMsgDispatcherInfos) {
    // Instantiate all dispatchers
    this.notifyMsgDispatchers = [];

    notifyMsgDispatcherInfos.forEach((info) => {
        this.notifyMsgDispatchers.push({
            name: info.name,
            instance: info.factory()
        });
    });
}


// Public Notification object methods
//

Notification.prototype.dispatchNotifyMessage = function (deviceId, eventName, data) {
    try {
        // Try to dispatch message throw one of the available dispatchers until one succeeds
        //  (or none succeeds)
        this.notifyMsgDispatchers.some((dispatcher) => {
            return dispatcher.instance.dispatchNotifyMessage(deviceId, eventName, data);
        });
    }
    catch (err) {
        // Error dispatching notification message. Log error
        Catenis.logger.ERROR(util.format('Error dispatching notification message (deviceId: %s, eventName: %s, data: %s.', deviceId, eventName, data), err);
    }
};


// Module functions used to simulate private Notification object methods
//  NOTE: these functions need to be bound to a Notification object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// Notification function class (public) methods
//

Notification.initialize = function () {
    Catenis.logger.TRACE('Notificaiton initialization');
    // Instantiate Notification object passing all currently registered notification message dispatchers
    Catenis.notification = new Notification(Notification.registeredNotifyMsgDispatcherInfos);
};

// Arguments:
//  info: {
//    name: [String], - The notification message dispatcher's name
//    description: [String], - A short description about this notification message dispatcher
//    factory: [Function] - A function used to create a new instance of this notification message dispatcher
//  }
Notification.registerNotifyMsgDispatcher = function (info) {
    Notification.registeredNotifyMsgDispatcherInfos.push(info);
};

// Return an object the properties of which are the event names and their values the corresponding
//  event description
Notification.listEvents = function () {
    const events = {};

    Object.keys(Notification.event).forEach((key) => {
        events[Notification.event[key].name] = Notification.event[key].description
    });

    return events;
};

Notification.isValidEventName = function (eventName) {
    return Object.values(Notification.event).some((event) => event.name === eventName);
};


// Notification function class (public) properties
//

Notification.registeredNotifyMsgDispatcherInfos = [];

Notification.event = Object.freeze({
    new_msg_received: Object.freeze({
        name: 'new-msg-received',
        description: 'A new message has been received'
    }),
    sent_msg_read: Object.freeze({
        name: 'sent-msg-read',
        description: 'Previously sent message has been read by intended receiver (target device)'
    })
});


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Definition of properties
Object.defineProperties(Notification, {
    qualifiedNotifyRooPath: {
        get: function () {
            return util.format('/%s/%s', restApiRootPath, cfgSettings.notifyRootPath);
        },
        enumerable: true
    }
});

// Lock function class
Object.freeze(Notification);
