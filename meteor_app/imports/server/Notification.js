/**
 * Created by Claudio on 2017-08-17.
 */

//console.log('[Notification.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import util from 'util';
// Third-party node modules
import config from 'config';
// Meteor packages
//import { Meteor } from 'meteor/meteor';
// noinspection NpmUsedModulesInstalled
import { WebApp } from 'meteor/webapp';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { restApiRootPath } from './RestApi';
import {
    ApiVersion,
    ApiVersionRange
} from './ApiVersion';

// Config entries
const notificationConfig = config.get('notification');

// Configuration settings
const cfgSettings = {
    notifyRootPath: notificationConfig.get('notifyRootPath'),
    initVersion: notificationConfig.get('initVersion'),
    availableVersions: notificationConfig.get('availableVersions')
};

export const initNotifyServiceVer = cfgSettings.initVersion;


// Definition of function classes
//

// Notification function class
export function Notification(notifyMsgDispatcherInfos) {
    // Try to instantiate all dispatchers for all currently available version of notification service
    this.notifyMsgDispatchers = [];

    cfgSettings.availableVersions.forEach((notifyServiceVerInfo) => {
        notifyMsgDispatcherInfos.forEach((info) => {
            const dispatcherInstance = info.factory(notifyServiceVerInfo.ver);

            // Make sure that dispatcher supports this version of the notification service
            if (dispatcherInstance) {
                this.notifyMsgDispatchers.push({
                    name: info.name,
                    dispatcherVer: info.version,
                    notifyServiceVer: notifyServiceVerInfo.ver,
                    instance: dispatcherInstance
                });
            }
        });
    });

    // Set up handler to process HTTP upgrade requests (used to establish connection for the proper protocol
    //  over HTTP used by the notification message dispatchers)
    WebApp.httpServer.on('upgrade', handleUpgradeRequest.bind(this));
}


// Public Notification object methods
//

Notification.prototype.dispatchNotifyMessage = function (deviceId, eventName, data) {
    try {
        // Try to dispatch message through one of the available dispatchers until one succeeds
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

function handleUpgradeRequest(request, socket, head) {
    try {
        // Pass protocol connection request to available dispatchers until one handles it (or not).
        //  NOTE: if no dispatcher handles the request, we do not take any action since it is
        //      likely that it is a request from the app's UI (DDP via WebSockets, which is the
        //      standard for meteor apps)
        this.notifyMsgDispatchers.some((dispatcher) => {
            return dispatcher.instance.handleProtocolConnection(request, socket, head);
        });
    }
    catch (err) {
        // Error handling HTTP upgrade request. Log error
        Catenis.logger.ERROR('Error handling HTTP upgrade request', err);
    }
}


// Notification function class (public) methods
//

Notification.initialize = function () {
    Catenis.logger.TRACE('Notification initialization');
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
Notification.listEvents = function (apiVer) {
    const events = {};
    let notifyServiceVer = Notification.notifyServiceVersionByApiVersion(apiVer);

    if (notifyServiceVer && (notifyServiceVer = ApiVersion.checkVersion(notifyServiceVer, false))) {
        Object.keys(Notification.event).forEach((key) => {
            if (notifyServiceVer.gte(Notification.event[key].minNotifyServiceVer)) {
                events[Notification.event[key].name] = Notification.event[key].description;
            }
        });
    }

    return events;
};

Notification.isValidEventName = function (eventName, notifyServiceVer) {
    notifyServiceVer = ApiVersion.checkVersion(notifyServiceVer, false);

    return Object.values(Notification.event).some((event) => (!notifyServiceVer || notifyServiceVer.gte(event.minNotifyServiceVer)) && event.name === eventName);
};

Notification.notifyServiceVersionByApiVersion = function (apiVer) {
    apiVer = ApiVersion.checkVersion(apiVer, false);

    if (apiVer) {
        let notifyServiceVer;

        for (let idx = 0, limit = cfgSettings.availableVersions.length; idx < limit; idx++) {
            const notifyServiceVerInfo = cfgSettings.availableVersions[idx];

            if (apiVer.gte(notifyServiceVerInfo.apiVer)) {
                notifyServiceVer = notifyServiceVerInfo.ver;
            }
        }

        return notifyServiceVer;
    }
};

Notification.apiVersionRangeByNotifyServiceVersion = function (notifyServiceVer) {
    notifyServiceVer = ApiVersion.checkVersion(notifyServiceVer, false);

    if (notifyServiceVer) {
        let lowBoundary;
        let highBoundary;

        for (let idx = 0, limit = cfgSettings.availableVersions.length; idx < limit; idx++) {
            const notifyServiceVerInfo = cfgSettings.availableVersions[idx];

            if (!lowBoundary) {
                if (notifyServiceVer.eq(notifyServiceVerInfo.ver)) {
                    lowBoundary = notifyServiceVerInfo.apiVer;
                }
            }
            else {
                highBoundary = new ApiVersion(notifyServiceVerInfo.apiVer).previous();
                break;
            }
        }

        return lowBoundary ? new ApiVersionRange(lowBoundary, highBoundary) : undefined;
    }
};


// Notification function class (public) properties
//

Notification.registeredNotifyMsgDispatcherInfos = [];

Notification.event = Object.freeze({
    new_msg_received: Object.freeze({
        name: 'new-msg-received',
        description: 'A new message has been received',
        minNotifyServiceVer: '0.1'
    }),
    sent_msg_read: Object.freeze({
        name: 'sent-msg-read',
        description: 'Previously sent message has been read by intended receiver (target device)',
        minNotifyServiceVer: '0.1'
    }),
    asset_received: Object.freeze({
        name: 'asset-received',
        description: 'An amount of an asset has been received',
        minNotifyServiceVer: '0.2'
    }),
    asset_confirmed: Object.freeze({
        name: 'asset-confirmed',
        description: 'An amount of an asset that was pending due to an asset transfer has been confirmed',
        minNotifyServiceVer: '0.2'
    }),
    final_msg_progress: Object.freeze({
        name: 'final-msg-progress',
        description: 'Progress of asynchronous message processing has come to an end',
        minNotifyServiceVer: '0.3'
    }),
    asset_export_outcome: Object.freeze({
        name: 'asset-export-outcome',
        description: 'Asset export has been finalized',
        minNotifyServiceVer: '0.4'
    }),
    asset_migration_outcome: Object.freeze({
        name: 'asset-migration-outcome',
        description: 'Asset migration has been finalized',
        minNotifyServiceVer: '0.4'
    }),
    nf_token_received: Object.freeze({
        name: 'nf-token-received',
        description: 'One or more non-fungible tokens have been received',
        minNotifyServiceVer: '0.5'
    }),
    nf_token_confirmed: Object.freeze({
        name: 'nf-token-confirmed',
        description: 'One or more non-fungible tokens that were pending due to a non-fungible token issuance/transfer has been confirmed',
        minNotifyServiceVer: '0.5'
    }),
    nf_asset_issuance_outcome: Object.freeze({
        name: 'nf-asset-issuance-outcome',
        description: 'Non-fungible asset issuance has been finalized',
        minNotifyServiceVer: '0.5'
    }),
    nf_token_retrieval_outcome: Object.freeze({
        name: 'nf-token-retrieval-outcome',
        description: 'Non-fungible token retrieval has been finalized',
        minNotifyServiceVer: '0.5'
    }),
    nf_token_transfer_outcome: Object.freeze({
        name: 'nf-token-transfer-outcome',
        description: 'Non-fungible token transfer has been finalized',
        minNotifyServiceVer: '0.5'
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
    notifyRootPath: {
        get: function () {
            return cfgSettings.notifyRootPath;
        },
        enumerable: true
    },
    // Qualified root path used by legacy notification endpoint URIs. For new notification endpoint URIs,
    //  the qualified root path also include the API version (<restApiRootPath>/<apiVer>/<notifyRootPath>)
    //  and thus cannot be expressed as a constant value
    qualifiedNotifyRooPath: {
        get: function () {
            return util.format('/%s/%s', restApiRootPath, cfgSettings.notifyRootPath);
        },
        enumerable: true
    }
});

// Lock function class
Object.freeze(Notification);
