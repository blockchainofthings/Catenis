/**
 * Created by claudio on 17/08/17.
 */

//console.log('[NotityMsgDispatcher.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//  NOTE: the reference of these modules are done using 'require()' instead of 'import' to
//      to avoid annoying WebStorm warning message: 'default export is not defined in
//      imported module'
//const util = require('util');
// Third-party node modules
//import config from 'config';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';

// Config entries
/*const config_entryConfig = config.get('config_entry');

// Configuration settings
const cfgSettings = {
    property: config_entryConfig.get('property_name')
};*/


// Definition of classes
//

// Generic class to be used as the base for the implementation of specialized notification message dispatchers
export class NotifyMsgDispatcher {
    constructor () {
    }

    // Method used to dispatch message notifying of a given event to device
    //
    //  Arguments:
    //   deviceId [String] - Catenis ID of device to which the notification message is to be dispatched
    //   eventName [String] - Name of notification event associated with the notification message
    //   data [String] - The contents of the notification message
    //
    //  Return:
    //   success [Boolean] - Indicates whether notification message has been successfully dispatched or not
    //
    //  NOTE: this method should be implemented in the derived class
    // noinspection JSMethodCanBeStatic, JSUnusedLocalSymbols
    dispatchNotifyMessage(deviceId, eventName, data) {
        Catenis.logger.WARN('NotifyMsgDispatcher.dispatchNotifyMessage - Method not implemented.');
    }
}


// Module code
//

// Lock function class
Object.freeze(NotifyMsgDispatcher);
