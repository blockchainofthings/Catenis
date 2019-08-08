/**
 * Created by Claudio on 2019-08-08.
 */

//console.log('[ApiListMessages3.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import moment from 'moment';
import _und from 'underscore';      // NOTE: we do not use the underscore library provided by Meteor because we need
                                    //        a feature (_und.omit(obj,predicate)) that is not available in that version
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { successResponse, errorResponse } from './RestApi';
import { cfgSettings as messageCfgSetting } from './Message';

// Config entries
/*const config_entryConfig = config.get('config_entry');

 // Configuration settings
 const cfgSettings = {
 property: config_entryConfig.get('property_name')
 };*/

const invalidDeviceId = '__invalid_deviceId__';


// Definition of module (private) functions
//

// Method used to process 'messages' endpoint of Rest API
//
//  Query string (optional) parameters:
//    action [String]     - (default: any) - One of the following values specifying the action originally performed on
//                        -  the messages intended to be retrieved: log|send|any
//    direction [String]  - (default: any) - One of the following values specifying the direction of the sent messages
//                           intended to be retrieve: inbound|outbound|any. Note that this option only applies to
//                           sent messages (action = 'send'). 'inbound' indicates messages sent to the device that issued
//                           the request, while 'outbound' indicates messages sent from the device that issued the request
//    fromDeviceIds [String]  - Comma separated list containing the Catenis device ID of the devices from which
//                               the messages intended to be retrieved had been sent. Note that this option only
//                               applies to messages sent to the device that issued the request (action = 'send' and direction = 'inbound')
//    toDeviceIds [String]    - Comma separated list containing the Catenis device ID of the devices to which
//                               the messages intended to be retrieved had been sent. Note that this option only
//                               applies to messages sent from the device that issued the request (action = 'send' and direction = 'outbound')
//    fromDeviceProdUniqueIds [String]  - Comma separated list containing the unique product ID of the devices from which
//                                         the messages intended to be retrieved had been sent. Note that this option only
//                                         applies to messages sent to the device that issued the request (action = 'send' and direction = 'inbound')
//    toDeviceProdUniqueIds [String]  - Comma separated list containing the product unique ID of the devices to which
//                                       the messages intended to be retrieved had been sent. Note that this option only
//                                       applies to messages sent from the device that issued the request (action = 'send' and direction = 'outbound')
//    readState [String]   - (default: any) - One of the following values indicating the current read state of the
//                            the messages intended to be retrieved: read|unread|any.
//    startDate [String]   - ISO 8601 formatted date and time specifying the lower boundary of the time frame within
//                            which the messages intended to be retrieved has been: logged, in case of messages logged
//                            by the device that issued the request (action = 'log'); sent, in case of messages sent from the current
//                            device (action = 'send' direction = 'outbound'); or received, in case of messages sent to
//                            the device that issued the request (action = 'send' and direction = 'inbound')
//    endDate [String]     - ISO 8601 formatted date and time specifying the upper boundary of the time frame within
//                            which the messages intended to be retrieved has been: logged, in case of messages logged
//                            by the device that issued the request (action = 'log'); sent, in case of messages sent from the current
//                            device (action = 'send' direction = 'outbound'); or received, in case of messages sent to
//                            he device that issued the request (action = 'send' and direction = 'inbound')
//    limit: [Number] - (default: 'maxQueryCount') Maximum number of messages that should be returned
//    skip: [Number] - (default: 0) Number of messages that should be skipped (from beginning of list of matching messages) and not returned
//
//  Success data returned: {
//    "messages": [{
//      "messageId": [String],  - ID of message
//      "action": [String],     - Action originally performed on the message; either 'log' or 'send'
//      "direction": [String],  - (only returned for action = 'send') Direction of the sent message; either 'inbound' or 'outbound'
//      "from": {    - Note: only returned for messages sent to the device that issued the request (action = 'send' and direction = 'inbound')
//        "deviceId": [String],   - Catenis device ID of the device that had sent the message
//        "name": [String]        - (only returned if defined and device that issued the request has permission to access this device's main props) - Assigned name of the device
//        "prodUniqueId: [String] - (only returned if defined and device that issued the request has permission to access this device's main props) - Product unique ID of the device
//      },
//      "to": {      - Note: only returned for messages sent from the device that issued the request (action = 'send' and direction = 'outbound')
//        "deviceId": [String]    - Catenis device ID of device to which the message had been sent
//        "name": [String]        - (only returned if defined and device that issued the request has permission to access this device's main props) Assigned name of the device
//        "prodUniqueId: [String] - (only returned if defined and device that issued the request has permission to access this device's main props) Product unique ID of the device
//      },
//      "readConfirmationEnabled": [Boolean], - (only returned if action = 'send' and direction = 'outbound') Indicates whether message had been send with read confirmation enabled
//      "read": [Boolean],  - (not returned if action = 'send', direction = 'outbound' and readConfirmationEnabled = false) Indicates whether the message had already been read
//      "date": [String],  - ISO 8601 formatted date and time when the message had been: logged, in case of messages logged
//                            by the device that issued the request (action = 'log'); sent, in case of messages sent from the current
//                            device (action = 'send' direction = 'outbound'); or received, in case of messages sent to
//                            the device that issued the request (action = 'send' and direction = 'inbound')
//    }],
//    "msgCount": [Number],  - Number of messages for which information is returned.
//                              Note that this number might be smaller than the actual number of message entries returned, since messages
//                              sent from a device to itself are returned as two separate entries: one with direction = 'outbound', and the
//                              other with direction = 'inbound' (provided that the query criteria allows for both outbound and inbound messages
//                              to be returned)
//    "hasMore": [Boolean] - Indicates whether there are more messages that satisfy the search criteria yet to be returned
//  }
export function listMessages3() {
    try {
        // Process request parameters

        let filter = {};

        // action param
        if (!(this.queryParams.action === undefined || isValidMsgAction(this.queryParams.action))) {
            Catenis.logger.DEBUG('Invalid \'action\' parameter for GET \'messages\' API request', this.queryParams);
            return errorResponse.call(this, 400, 'Invalid parameters');
        }

        if (this.queryParams.action !== undefined && this.queryParams.action !== 'any') {
            filter.action = this.queryParams.action;
        }

        // direction param
        if (!(this.queryParams.direction === undefined || isValidMsgDirection(this.queryParams.direction))) {
            Catenis.logger.DEBUG('Invalid \'direction\' parameter for GET \'messages\' API request', this.queryParams);
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
                id = id.trim();

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
                id = id.trim();

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
                id = id.trim();

                if (id.length > 0) {
                    fromDeviceProdUniqueIds.add(id);
                }
            });

            if (fromDeviceProdUniqueIds.size > 0) {
                // Get corresponding Catenis device IDs from device product unique IDs
                const prodUniqueIdDeviceId = new Map();

                Catenis.db.collection.Device.find({
                    'props.prodUniqueId': {$in: Array.from(fromDeviceProdUniqueIds)}
                }, {
                    fields: {
                        deviceId: 1,
                        'props.prodUniqueId': 1
                    }
                }).forEach((doc) => {
                    prodUniqueIdDeviceId.set(doc.props.prodUniqueId, doc.deviceId);
                });

                fromDeviceProdUniqueIds.forEach((prodUniqueId) => {
                    if (prodUniqueIdDeviceId.has(prodUniqueId)) {
                        fromDeviceIds.add(prodUniqueIdDeviceId.get(prodUniqueId));
                    }
                    else {
                        // No device found with given product unique ID.
                        //  Add an invalid device ID to the list
                        fromDeviceIds.add(invalidDeviceId);
                    }
                });
            }
        }

        const toDeviceProdUniqueIds = new Set();

        // toDeviceProdUniqueIds param
        if (this.queryParams.toDeviceProdUniqueIds !== undefined) {
            // Parse list of IDs
            this.queryParams.toDeviceProdUniqueIds.split(',').forEach((id) => {
                id = id.trim();

                if (id.length > 0) {
                    toDeviceProdUniqueIds.add(id);
                }
            });

            if (toDeviceProdUniqueIds.size > 0) {
                // Get corresponding Catenis device IDs from device product unique IDs
                const prodUniqueIdDeviceId = new Map();

                Catenis.db.collection.Device.find({
                    'props.prodUniqueId': {$in: Array.from(toDeviceProdUniqueIds)}
                }, {
                    fields: {
                        deviceId: 1,
                        'props.prodUniqueId': 1
                    }
                }).forEach((doc) => {
                    prodUniqueIdDeviceId.set(doc.props.prodUniqueId, doc.deviceId);
                });

                toDeviceProdUniqueIds.forEach((prodUniqueId) => {
                    if (prodUniqueIdDeviceId.has(prodUniqueId)) {
                        toDeviceIds.add(prodUniqueIdDeviceId.get(prodUniqueId));
                    }
                    else {
                        // No device found with given product unique ID.
                        //  Add an invalid device ID to the list
                        toDeviceIds.add(invalidDeviceId);
                    }
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
            Catenis.logger.DEBUG('Invalid \'readState\' parameter for GET \'messages\' API request', this.queryParams);
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
            else {
                Catenis.logger.DEBUG('Invalid \'startDate\' parameter for GET \'messages\' API request', this.queryParams);
                return errorResponse.call(this, 400, 'Invalid parameters');
            }
        }

        // endDate param
        if (this.queryParams.endDate !== undefined) {
            const mt = moment(this.queryParams.endDate, moment.ISO_8601);

            if (mt.isValid()) {
                filter.endDate = mt.toDate();
            }
            else {
                Catenis.logger.DEBUG('Invalid \'endDate\' parameter for GET \'messages\' API request', this.queryParams);
                return errorResponse.call(this, 400, 'Invalid parameters');
            }
        }

        // limit param
        let limit;

        if (!(typeof this.queryParams.limit === 'undefined' || (!Number.isNaN(limit = Number.parseInt(this.queryParams.limit)) && isValidLimit(limit)))) {
            Catenis.logger.DEBUG('Invalid \'limit\' parameter for GET \'messages\' API request', this.queryParams);
            return errorResponse.call(this, 400, 'Invalid parameters');
        }

        // skip param
        let skip;

        if (!(typeof this.queryParams.skip === 'undefined' || (!Number.isNaN(skip = Number.parseInt(this.queryParams.skip)) && isValidSkip(skip)))) {
            Catenis.logger.DEBUG('Invalid \'skip\' parameter for GET \'messages\' API request', this.queryParams);
            return errorResponse.call(this, 400, 'Invalid parameters');
        }

        // Make sure that system is running and accepting API calls
        if (!Catenis.application.isRunning()) {
            Catenis.logger.DEBUG('System currently not available for fulfilling GET \'messages\' API request', {applicationStatus: Catenis.application.status});
            return errorResponse.call(this, 503, 'System currently not available; please try again at a later time');
        }

        // Execute method to read message
        let listResult;

        try {
            listResult = this.user.device.listMessages(filter, limit, skip);
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
                Catenis.logger.ERROR('Error processing GET \'messages\' API request.', err);
            }

            return error;
        }

        // Prepare result
        const result = {
            messages: [],
            msgCount: listResult.msgCount,
            hasMore: listResult.hasMore
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
                _und.extend(msg.from, msgEntry.fromDevice.discloseMainPropsTo(this.user.device));
            }

            if (msgEntry.toDevice !== undefined) {
                msg.to = {
                    deviceId: msgEntry.toDevice.deviceId
                };

                // Add device public properties
                _und.extend(msg.to, msgEntry.toDevice.discloseMainPropsTo(this.user.device));
            }

            if (msgEntry.readConfirmationEnabled !== undefined) {
                msg.readConfirmationEnabled = msgEntry.readConfirmationEnabled;
            }

            if (msgEntry.read !== undefined) {
                msg.read = msgEntry.read;
            }

            msg.date = msgEntry.date;

            result.messages.push(msg);
        });

        // Return success
        return successResponse.call(this, result);
    }
    catch (err) {
        Catenis.logger.ERROR('Error processing GET \'messages\' API request.', err);
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

function isValidLimit(num) {
    return num > 0 && num <= messageCfgSetting.maxQueryCount;
}

function isValidSkip(num) {
    return num >= 0;
}


// Module code
//
