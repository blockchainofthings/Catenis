/**
 * Created by claudio on 12/06/17.
 */

//console.log('[ApiListMessages.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//  NOTE: the reference of these modules are done sing 'require()' instead of 'import' to
//      to avoid annoying WebStorm warning message: 'default export is not defined in
//      imported module'
//const util = require('util');
// Third-party node modules
import moment from 'moment';
import _und from 'underscore';      // NOTE: we do not use the underscore library provided by Meteor because we need
                                    //        a feature (_und.omit(obj,predicate)) that is not available in that version
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { successResponse, errorResponse } from './RestApi';
import { Message } from './Message';

// Config entries
/*const config_entryConfig = config.get('config_entry');

 // Configuration settings
 const cfgSettings = {
 property: config_entryConfig.get('property_name')
 };*/


// Definition of module (private) functions
//

// Method used to process 'messages' endpoint of Rest API
//
//  Query string (optional) parameters:
//    action [String]     // (default: any) - One of the following values specifying the action originally performed on
//                        //  the messages intended to be retrieved: log|send|any
//    direction [String]  // (default: any) - One of the following values specifying the direction of the sent messages
//                        //  intended to be retrieve: inbound|outbound|any. Note that this option only applies to
//                        //  sent messages (action = 'send'). 'inbound' indicates messages sent to the device that issued
//                        //   the request, while 'outbound' indicates messages sent from the device that issued the request
//    fromDeviceIds [String]  // Comma separated list containing the Catenis device ID of the devices from which
//                            //  the messages intended to be retrieved had been sent. Note that this option only
//                            //  applies to messages sent to the device that issued the request (action = 'send' and direction = 'inbound')
//    toDeviceIds [String]    // Comma separated list containing the Catenis device ID of the devices to which
//                            //  the messages intended to be retrieved had been sent. Note that this option only
//                            //  applies to messages sent from the device that issued the request (action = 'send' and direction = 'outbound')
//    fromDeviceProdUniqueIds [String]  // Comma separated list containing the unique product ID of the devices from which
//                                      //  the messages intended to be retrieved had been sent. Note that this option only
//                                      //  applies to messages sent to the device that issued the request (action = 'send' and direction = 'inbound')
//    toDeviceProdUniqueIds [String]  // Comma separated list containing the product unique ID of the devices to which
//                                    //  the messages intended to be retrieved had been sent. Note that this option only
//                                    //  applies to messages sent from the device that issued the request (action = 'send' and direction = 'outbound')
//    readState [String]   // (default: any) - One of the following values indicating the current read state of the
//                         //  the messages intended to be retrieved: read|unread|any.
//    startDate [String]   // ISO 8601 formatted date and time specifying the lower boundary of the time frame within
//                         //  which the messages intended to be retrieved has been: logged, in case of messages logged
//                         //  by the device that issued the request (action = 'log'); sent, in case of messages sent from the current
//                         //  device (action = 'send' direction = 'outbound'); or received, in case of messages sent to
//                         //  the device that issued the request (action = 'send' and direction = 'inbound')
//    endDate [String]     // ISO 8601 formatted date and time specifying the upper boundary of the time frame within
//                         //  which the messages intended to be retrieved has been: logged, in case of messages logged
//                         //  by the device that issued the request (action = 'log'); sent, in case of messages sent from the current
//                         //  device (action = 'send' direction = 'outbound'); or received, in case of messages sent to
//                         //  he device that issued the request (action = 'send' and direction = 'inbound')
//
//  Success data returned: {
//    "messages": [{
//      "messageId": [String],  // ID of message
//      "action": [String],     // Action originally performed on the message; either 'log' or 'send'
//      "direction": [String],  // (only returned for action = 'send') Direction of the sent message; either 'inbound' or 'outbound'
//      "from": {    // Note: only returned for messages sent to the device that issued the request (action = 'send' and direction = 'inbound')
//        "deviceId": [String],   // Catenis device ID of the device that had sent the message
//        "name": [String]        // (only returned if device is public and has this data) - Assigned name of the device
//        "prodUniqueId: [String] // (only returned if device is public and has this data) - Product unique ID of the device
//      },
//      "to": {      // Note: only returned for messages sent from the device that issued the request (action = 'send' and direction = 'outbound')
//        "deviceId": [String]      // Catenis device ID of device to which the message had been sent
//        "name": [String]        // (only returned if device is public and has this data) Assigned name of the device
//        "prodUniqueId: [String] // (only returned if device is public and has this data) Product unique ID of the device
//      },
//      "read": [Boolean],  // Indicates whether the message had already been read
//      "date": [String],  // ISO 8601 formatted date and time when the message had been: logged, in case of messages logged
//                         //  by the device that issued the request (action = 'log'); sent, in case of messages sent from the current
//                         //  device (action = 'send' direction = 'outbound'); or received, in case of messages sent to
//                         //  the device that issued the request (action = 'send' and direction = 'inbound')
//    }],
//    "countExceeded": [Boolean]  // Indicates whether the number of messages that satisfied the query criteria was greater than the maximum
//                                //  number of messages that can be returned, and for that reason the returned list had been truncated
//  }
export function listMessages() {
    try {
        // Process request parameters

        let filter = {};

        // action param
        if (!(this.queryParams.action === undefined || isValidMsgAction(this.queryParams.action))) {
            Catenis.logger.DEBUG('Invalid \'action\' parameter for \'messages\' API request', this.queryParams);
            return errorResponse.call(this, 400, 'Invalid parameters');
        }

        if (this.queryParams.action !== undefined && this.queryParams.action !== 'any') {
            filter.action = this.queryParams.action;
        }

        // direction param
        if (!(this.queryParams.direction === undefined || isValidMsgDirection(this.queryParams.direction))) {
            Catenis.logger.DEBUG('Invalid \'direction\' parameter for \'messages\' API request', this.queryParams);
            return errorResponse.call(this, 400, 'Invalid parameters');
        }

        if (this.queryParams.direction !== undefined && this.queryParams.direction !== 'any') {
            filter.direction = this.queryParams.direction;
        }

        const fromDeviceIds = new Set();

        // fromDeviceIds param
        if (this.queryParams.fromDeviceIds !== undefined) {
            // Parse list of IDs
            this.queryParams.fromDeviceIds.split(',').forEach((id) => {
                if (id.length > 0) {
                    fromDeviceIds.add(id);
                }
            });
        }

        const toDeviceIds = new Set();

        // toDeviceIds param
        if (this.queryParams.toDeviceIds !== undefined) {
            // Parse list of IDS
            this.queryParams.toDeviceIds.split(',').forEach((id) => {
                if (id.length > 0) {
                    toDeviceIds.add(id);
                }
            });
        }

        const fromDeviceProdUniqueIds = new Set();

        // fromDeviceProdUniqueIds param
        if (this.queryParams.fromDeviceProdUniqueIds !== undefined) {
            // Parse list of IDs
            this.queryParams.fromDeviceProdUniqueIds.split(',').forEach((id) => {
                if (id.length > 0) {
                    fromDeviceProdUniqueIds.add(id);
                }
            });

            if (fromDeviceProdUniqueIds.size > 0) {
                // Get corresponding Catenis device IDs from device product unique IDs
                Catenis.db.collection.Device.find({
                    'props.prodUniqueId': {$in: Array.from(fromDeviceProdUniqueIds)}
                }, {
                    fields: {
                        deviceId: 1
                    }
                }).forEach((doc) => {
                    fromDeviceIds.add(doc.deviceId);
                });
            }
        }

        const toDeviceProdUniqueIds = new Set();

        // toDeviceProdUniqueIds param
        if (this.queryParams.toDeviceProdUniqueIds !== undefined) {
            // Parse list of IDs
            this.queryParams.toDeviceProdUniqueIds.split(',').forEach((id) => {
                if (id.length > 0) {
                    toDeviceProdUniqueIds.add(id);
                }
            });

            if (toDeviceProdUniqueIds.size > 0) {
                // Get corresponding Catenis device IDs from device product unique IDs
                Catenis.db.collection.Device.find({
                    'props.prodUniqueId': {$in: Array.from(toDeviceProdUniqueIds)}
                }, {
                    fields: {
                        deviceId: 1
                    }
                }).forEach((doc) => {
                    toDeviceIds.add(doc.deviceId);
                });
            }
        }

        if (fromDeviceIds.size > 0) {
            filter.fromDeviceId = Array.from(fromDeviceIds);
        }

        if (toDeviceIds.size > 0) {
            filter.toDeviceId = Array.from(toDeviceIds);
        }

        // readState param
        if (!(this.queryParams.readState === undefined || isValidMsgReadState(this.queryParams.readState))) {
            Catenis.logger.DEBUG('Invalid \'readState\' parameter for \'messages\' API request', this.queryParams);
            return errorResponse.call(this, 400, 'Invalid parameters');
        }

        if (this.queryParams.readState !== undefined && this.queryParams.readState !== 'any') {
            filter.readState = this.queryParams.readState;
        }

        // startDate param
        if (this.queryParams.startDate !== undefined) {
            const mt = moment(this.queryParams.startDate, moment.ISO_8601);
            
            if (mt.isValid()) {
                filter.startDate = mt.toDate();
            }
        }

        // endDate param
        if (this.queryParams.endDate !== undefined) {
            const mt = moment(this.queryParams.endDate, moment.ISO_8601);

            if (mt.isValid()) {
                filter.endDate = mt.toDate();
            }
        }

        // Execute method to read message
        let listResult;

        try {
            listResult = this.user.device.listMessages(filter);
        }
        catch (err) {
            let error;

            if (err instanceof Meteor.Error) {
                if (err.error === 'ctn_device_deleted') {
                    // This should never happen
                    error = errorResponse.call(this, 400, 'Device is deleted');
                }
                else if (err.error === 'ctn_device_not_active') {
                    error = errorResponse.call(this, 400, 'Device is not active');
                }
                else {
                    error = errorResponse.call(this, 500, 'Internal server error');
                }
            }
            else {
                error = errorResponse.call(this, 500, 'Internal server error');
            }

            if (error.statusCode === 500) {
                Catenis.logger.ERROR('Error processing \'messages\' API request.', err);
            }

            return error;
        }

        // Prepare result
        const result = {
            messages: [],
            countExceeded: listResult.countExceeded
        };

        listResult.msgEntries.forEach((msgEntry) => {
            const msg = {
                messageId: msgEntry.messageId,
                action: msgEntry.action
            };

            if (msgEntry.direction !== undefined) {
                msg.direction = msgEntry.direction;
            }

            if (msgEntry.fromDevice !== undefined) {
                msg.from = {
                    deviceId: msgEntry.fromDevice.deviceId
                };

                // Add device public properties
                _und.extend(msg.from, msgEntry.fromDevice.getPublicProps());
            }

            if (msgEntry.toDevice !== undefined) {
                msg.to = {
                    deviceId: msgEntry.toDevice.deviceId
                };

                // Add device public properties
                _und.extend(msg.to, msgEntry.toDevice.getPublicProps());
            }

            msg.read = msgEntry.read;
            msg.date = msgEntry.date;

            result.messages.push(msg);
        });

        // Return success
        return successResponse.call(this, result);
    }
    catch (err) {
        Catenis.logger.ERROR('Error processing \'messages\' API request.', err);
        return errorResponse.call(this, 500, 'Internal server error');
    }
}

function isValidMsgAction(val) {
    return val === 'log' || val === 'send' || val === 'any';
}

function isValidMsgDirection(val) {
    return val === 'inbound' || val === 'outbound' || val === 'any';
}

function isValidMsgReadState(val) {
    return val === 'read' || val === 'unread' || val === 'any';
}


// Module code
//
