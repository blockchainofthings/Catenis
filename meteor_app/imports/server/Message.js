/**
 * Created by Claudio on 2017-04-05.
 */

//console.log('[Message.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import util from 'util';
// Third-party node modules
import config from 'config';
// Meteor packages
import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { LogMessageTransaction } from './LogMessageTransaction';
import { SendMessageTransaction } from './SendMessageTransaction';
import { CatenisMessage } from './CatenisMessage';
import { OffChainMsgEnvelope } from './OffChainMsgEnvelope';
import { Transaction } from './Transaction';
import { LogOffChainMessage } from './LogOffChainMessage';
import { SendOffChainMessage } from './SendOffChainMessage';

// Config entries
const messageConfig = config.get('message');

// Configuration settings
export const cfgSettings = {
    maxQueryCount: messageConfig.get('maxQueryCount'),
    minSizeReadDataChunk: messageConfig.get('minSizeReadDataChunk'),
    maxSizeReadDataChunk: messageConfig.get('maxSizeReadDataChunk')
};


// Definition of function classes
//

// Message function class
//
//  Constructor arguments:
//    docMessage: [Object] - Message database doc/rec
export function Message(docMessage) {
    this.doc_id = docMessage._id;
    this.messageId = docMessage.messageId;
    this.action = docMessage.action;
    this.source = docMessage.source;
    this.originDeviceId = docMessage.originDeviceId;
    this.targetDeviceId = docMessage.targetDeviceId;
    this.readConfirmationEnabled = docMessage.readConfirmationEnabled;
    this.isEncrypted = docMessage.isEncrypted;

    if (docMessage.offChain) {
        this.ocMsgEnvCid = docMessage.offChain.msgEnvCid;
    }

    if (docMessage.blockchain) {
        this.txid = docMessage.blockchain.txid;
        this.isTxConfirmed = docMessage.blockchain.confirmed;
    }

    if (docMessage.externalStorage) {
        this.storageProviderName = docMessage.externalStorage.provider;
        this.externalStorageRef = docMessage.externalStorage.reference;
    }

    this.createdDate = docMessage.createdDate;
    this.sentDate = docMessage.sentDate;
    this.receivedDate = docMessage.receivedDate;
    this.blocked = docMessage.blocked !== undefined;
    this.firstReadDate = docMessage.firstReadDate;
    this.lastReadDate = docMessage.lastReadDate;
    this.readConfirmed = docMessage.readConfirmed;

    Object.defineProperties(this, {
        isOffChain: {
            get: function () {
                // noinspection JSPotentiallyInvalidUsageOfThis
                return !!this.ocMsgEnvCid;
            },
            enumerable: true
        },
        isRecordedToBlockchain: {
            get: function () {
                // noinspection JSPotentiallyInvalidUsageOfThis
                return !!this.txid;
            },
            enumerable: true
        }
    });
}


// Public Message object methods
//

// Update last read date
//
//  Return:
//   isFirstRead: [Boolean]  // Indication if this was the first time that message was read
Message.prototype.readNow = function () {
    this.lastReadDate = new Date();

    const isFirstRead = this.firstReadDate === undefined;
    const modifier = isFirstRead ? {$set: {firstReadDate: this.lastReadDate}} : {$set: {}};

    modifier.$set.lastReadDate = this.lastReadDate;

    try {
        Catenis.db.collection.Message.update({_id: this.doc_id}, modifier);
    }
    catch (err) {
        Catenis.logger.ERROR(util.format('Error trying to update last read date of message (doc_id: %s).', this.doc_id), err);
        throw new Meteor.Error('ctn_msg_update_error', util.format('Error trying to update last read date of message (doc_id: %s)', this.doc_id), err.stack);
    }

    return isFirstRead;
};

// Set message as received
//
//  Arguments:
//    receivedDate: [Date] - (optional) date and time when send message transaction had been received. If not defined,
//                            assume that message should be blocked
Message.prototype.setReceived = function (receivedDate) {
    // Make sure that message is not yet set as received
    if (this.receivedDate === undefined && !this.blocked) {
        // Validate argument
        if (receivedDate !== undefined && !receivedDate instanceof Date) {
            // Invalid argument
            Catenis.logger.ERROR('Message.setReceived method called with invalid argument', {receivedDate: receivedDate});
            throw Error('Invalid receivedDate argument');
        }

        const fieldsToUpdate = {};

        if (receivedDate) {
            fieldsToUpdate.receivedDate = this.receivedDate = receivedDate;
        }
        else {
            fieldsToUpdate.blocked = this.blocked = true;
        }

        try {
            Catenis.db.collection.Message.update({_id: this.doc_id}, {$set: fieldsToUpdate});
        }
        catch (err) {
            Catenis.logger.ERROR(util.format('Error trying to update message (doc_id: %s) to set it as received.', this.doc_id), err);
            throw new Meteor.Error('ctn_msg_update_error', util.format('Error trying to update message (doc_id: %s) to set it as received', this.doc_id), err.stack);
        }
    }
};

// Module functions used to simulate private Message object methods
//  NOTE: these functions need to be bound to a Message object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// Message function class (public) methods
//

// Create a new Message issued by this Catenis node and returns its messageId
//
//  Arguments:
//    msgTransact: [Object] - instance of either LogMessageTransaction or SendMessageTransaction
Message.createLocalMessage = function (msgTransact) {
    let action;

    if (msgTransact instanceof LogMessageTransaction) {
        action = Message.action.log;
    }
    else if (msgTransact instanceof SendMessageTransaction) {
        action = Message.action.send;
    }
    else {
        // Invalid argument
        Catenis.logger.ERROR('Message.createLocalMessage method called with invalid argument', {msgTransact: msgTransact});
        throw Error('Invalid msgTransact argument');
    }

    // Make sure that transaction had already been sent and saved
    if (!msgTransact.transact.txSaved) {
        Catenis.logger.ERROR('Cannot create message for a transaction that had not yet been saved', msgTransact.transact);
        throw new Meteor.Error('ctn_msg_tx_unsaved', 'Cannot create message for a transaction that had not yet been saved', msgTransact.transact);
    }

    const docMessage = {
        messageId: newMessageId(msgTransact.transact),
        action: action,
        source: Message.source.local
    };

    if (action === Message.action.log) {
        docMessage.originDeviceId = msgTransact.device.deviceId;
    }
    else {  // action == Message.action.send
        docMessage.originDeviceId = msgTransact.originDevice.deviceId;
        docMessage.targetDeviceId = msgTransact.targetDevice.deviceId;
        docMessage.readConfirmationEnabled = msgTransact.options.readConfirmation;
    }

    docMessage.isEncrypted = msgTransact.options.encrypted;
    docMessage.blockchain = {
        txid: msgTransact.transact.txid,
        confirmed: false
    };

    if (msgTransact.extMsgRef) {
        const storageProvider = msgTransact.options.storageProvider !== undefined ? msgTransact.options.storageProvider : CatenisMessage.defaultStorageProvider;

        docMessage.externalStorage = {
            provider: storageProvider.name,
            reference: CatenisMessage.getMessageStorageClass(storageProvider).getNativeMsgRef(msgTransact.extMsgRef)
        };
    }

    docMessage.createdDate = new Date();
    docMessage.sentDate = msgTransact.transact.sentDate;

    try {
        docMessage._id = Catenis.db.collection.Message.insert(docMessage);
    }
    catch (err) {
        Catenis.logger.ERROR(util.format('Error trying to create new local message: %s ', util.inspect(docMessage)), err);
        throw new Meteor.Error('ctn_msg_insert_error', util.format('Error trying to create new local message: %s', util.inspect(docMessage)), err.stack);
    }

    return docMessage.messageId;
};

// Create a new (send) Message issued by another Catenis node (and received by this one) and returns its messageId
//
//  Arguments:
//    sendMsgTransact: [Object] - instance of SendMessageTransaction
//    receivedDate: [Date] - (optional) date and time when send message transaction had been received. If not defined,
//                            assume that message should be blocked
Message.createRemoteMessage = function (sendMsgTransact, receivedDate) {
    // Validate arguments
    const errArg = {};

    if (!sendMsgTransact instanceof SendMessageTransaction) {
        errArg.sendMsgTransact = sendMsgTransact;
    }

    if (receivedDate !== undefined && !receivedDate instanceof Date) {
        errArg.receivedDate = receivedDate;
    }

    if (Object.keys(errArg).length > 0) {
        const errArgs = Object.keys(errArg);

        Catenis.logger.ERROR(util.format('Message.createRemoteMessage method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    const docMessage = {
        messageId: newMessageId(sendMsgTransact.transact),
        action: Message.action.send,
        source: Message.source.remote,
        originDeviceId: sendMsgTransact.originDevice.deviceId,
        targetDeviceId: sendMsgTransact.targetDevice.deviceId,
        readConfirmationEnabled: sendMsgTransact.options.readConfirmation,
        isEncrypted: sendMsgTransact.options.encrypted,
        blockchain: {
            txid: sendMsgTransact.transact.txid,
            confirmed: false
        }
    };

    if (sendMsgTransact.extMsgRef) {
        const storageProvider = sendMsgTransact.options.storageProvider !== undefined ? sendMsgTransact.options.storageProvider : CatenisMessage.defaultStorageProvider;

        docMessage.externalStorage = {
            provider: storageProvider.name,
            reference: CatenisMessage.getMessageStorageClass(storageProvider).getNativeMsgRef(sendMsgTransact.extMsgRef)
        };
    }

    if (receivedDate) {
        docMessage.receivedDate = receivedDate;
    }
    else {
        docMessage.blocked = true;
    }

    try {
        docMessage._id = Catenis.db.collection.Message.insert(docMessage);
    }
    catch (err) {
        Catenis.logger.ERROR(util.format('Error trying to create new remote message: %s ', util.inspect(docMessage)), err);
        throw new Meteor.Error('ctn_msg_insert_error', util.format('Error trying to create new remote message: %s', util.inspect(docMessage)), err.stack);
    }

    return docMessage.messageId;
};

// Create a new off-chain Message issued by this Catenis node and returns its messageId
//
//  Arguments:
//    offChainMessage: [Object] Instance of either LogOffChainMessage or SendOffChainMessage
Message.createLocalOffChainMessage = function (offChainMessage) {
    let action;

    if (offChainMessage instanceof LogOffChainMessage) {
        action = Message.action.log;
    }
    else if (offChainMessage instanceof SendOffChainMessage) {
        action = Message.action.send;
    }
    else {
        // Invalid argument
        Catenis.logger.ERROR('Message.createLocalOffChainMessage method called with invalid argument', {offChainMessage});
        throw Error('Invalid offChainMessage argument');
    }

    // Make sure that off-chain message has already been saved to to both Catenis node's
    //  IPFS repository and local database
    if (!offChainMessage.ocMsgEnvelope.savedToDatabase) {
        Catenis.logger.ERROR('Cannot create message for an off-chain message that has not yet been saved', offChainMessage.ocMsgEnvelope);
        throw new Meteor.Error('ctn_msg_oc_msg_unsaved', 'Cannot create message for an off-chain message that has not yet been saved', offChainMessage.ocMsgEnvelope);
    }

    const docMessage = {
        messageId: newMessageId(offChainMessage.ocMsgEnvelope),
        action: action,
        source: Message.source.local
    };

    if (action === Message.action.log) {
        docMessage.originDeviceId = offChainMessage.device.deviceId;
    }
    else {  // action == Message.action.send
        docMessage.originDeviceId = offChainMessage.originDevice.deviceId;
        docMessage.targetDeviceId = offChainMessage.targetDevice.deviceId;
        docMessage.readConfirmationEnabled = offChainMessage.options.readConfirmation;
    }

    docMessage.isEncrypted = offChainMessage.options.encrypted;
    docMessage.offChain = {
        msgEnvCid: offChainMessage.ocMsgEnvelope.cid
    };

    const storageProvider = offChainMessage.options.storageProvider !== undefined ? offChainMessage.options.storageProvider : CatenisMessage.defaultStorageProvider;

    docMessage.externalStorage = {
        provider: storageProvider.name,
        reference: CatenisMessage.getMessageStorageClass(storageProvider).getNativeMsgRef(offChainMessage.ocMsgEnvelope.msgRef)
    };

    docMessage.createdDate = new Date();
    docMessage.sentDate = offChainMessage.ocMsgEnvelope.savedDate;

    try {
        docMessage._id = Catenis.db.collection.Message.insert(docMessage);
    }
    catch (err) {
        Catenis.logger.ERROR(util.format('Error trying to create new local off-chain message: %s ', util.inspect(docMessage)), err);
        throw new Meteor.Error('ctn_msg_insert_error', util.format('Error trying to create new local off-chain message: %s', util.inspect(docMessage)), err.stack);
    }

    return docMessage.messageId;
};

// Create a new off-chain Message issued by this Catenis node and returns its messageId
//
//  Arguments:
//    sendOCMessage: [Object(SendOffChainMessage)] Instance of SendOffChainMessage
//    blocked: [Boolean] Indicates whether message should be blocked
Message.createRemoteOffChainMessage = function (sendOCMessage, blocked) {
    // Validate arguments
    const errArg = {};

    if (!sendOCMessage instanceof SendOffChainMessage) {
        errArg.sendOffChainMessage = sendOCMessage;
    }

    if (Object.keys(errArg).length > 0) {
        const errArgs = Object.keys(errArg);

        Catenis.logger.ERROR(util.format('Message.createRemoteOffChainMessage method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    const docMessage = {
        messageId: newMessageId(sendOCMessage.ocMsgEnvelope),
        action: Message.action.send,
        source: Message.source.remote,
        originDeviceId: sendOCMessage.originDevice.deviceId,
        targetDeviceId: sendOCMessage.targetDevice.deviceId,
        readConfirmationEnabled: sendOCMessage.options.readConfirmation,
        isEncrypted: sendOCMessage.options.encrypted,
        offChain: {
            msgEnvCid: SendOffChainMessage.ocMsgEnvelope.cid
        }
    };

    const storageProvider = sendOCMessage.options.storageProvider !== undefined ? sendOCMessage.options.storageProvider : CatenisMessage.defaultStorageProvider;

    docMessage.externalStorage = {
        provider: storageProvider.name,
        reference: CatenisMessage.getMessageStorageClass(storageProvider).getNativeMsgRef(sendOCMessage.ocMsgEnvelope.msgRef)
    };

    if (!blocked) {
        docMessage.receivedDate = sendOCMessage.ocMsgEnvelope.retrievedDate;
    }
    else {
        docMessage.blocked = true;
    }

    try {
        docMessage._id = Catenis.db.collection.Message.insert(docMessage);
    }
    catch (err) {
        Catenis.logger.ERROR(util.format('Error trying to create new remote off-chain message: %s ', util.inspect(docMessage)), err);
        throw new Meteor.Error('ctn_msg_insert_error', util.format('Error trying to create new remote off-chain message: %s', util.inspect(docMessage)), err.stack);
    }

    return docMessage.messageId;
};

Message.getMessageByMessageId = function (messageId, requestingDeviceId) {
    // Retrieve Message doc/rec
    const selector = {
        messageId: messageId
    };

    if (requestingDeviceId) {
        // If retrieving message for a specific device, make sure not to return 'send' messages
        //  for any device other than the device that sent the message (origin device) if the
        //  message has not been received yet
        selector.$or = [{
            action: Message.action.log
        }, {
            action: Message.action.send,
            $or: [{
                originDeviceId: requestingDeviceId
            }, {
                originDeviceId: {
                    $ne: requestingDeviceId
                },
                receivedDate: {
                    $exists: true
                }
            }]
        }];
    }

    const docMessage = Catenis.db.collection.Message.findOne(selector);

    if (!docMessage) {
        // No message available with the given client ID. Log error and throw exception
        Catenis.logger.ERROR('Could not find message with given message ID', {messageId: messageId});
        throw new Meteor.Error('ctn_msg_not_found', util.format('Could not find message with given message ID (%s)', messageId));
    }

    return new Message(docMessage);
};

Message.getMessageByOffChainCid = function (cid) {
    // Retrieve Message doc/rec
    const docMessage = Catenis.db.collection.Message.findOne({'offChain.msgEnvCid': cid});

    if (!docMessage) {
        // No message available with the given Catenis off-chain message IPFS CID. Log error and throw exception
        Catenis.logger.ERROR('Could not find message with given Catenis off-chain message IPFS CID', {cid});
        throw new Meteor.Error('ctn_msg_not_found', util.format('Could not find message with given Catenis off-chain message IPFS CID (%s)', cid));
    }

    return new Message(docMessage);
};

Message.getMessageByTxid = function (txid) {
    // Retrieve Message doc/rec
    const docMessage = Catenis.db.collection.Message.findOne({'blockchain.txid': txid});

    if (!docMessage) {
        // No message available with the given transaction ID. Log error and throw exception
        Catenis.logger.ERROR('Could not find message with given transaction ID', {txid: txid});
        throw new Meteor.Error('ctn_msg_not_found', util.format('Could not find message with given transaction ID (%s)', txid));
    }

    return new Message(docMessage);
};

// Query for messages for a given device adhering to the specified filtering criteria
//
//  Arguments:
//    issuerDeviceId: [String] - Catenis device ID of device that is issuing the query request
//    filter: {
//      action: [String],   - The action originally performed on the message. One of the properties of the Message.action object
//      direction: [String],  - Direction of the sent message in reference to the issuer device. One of the properties of the Message.direction object
//      fromDeviceId: [String|Array(String)], - Single Catenis device ID or list of Catenis device IDs specifying the device(s) that have sent the messages to the issuer device
//      toDeviceId: [Array(String)],  - Single Catenis device ID or list of Catenis device IDs specifying the device(s) to which the messages sent from the issuer device have been sent
//      readState: [String],  - The read state (either read or unread) of the message. One of the properties of the Message.readState object
//      startDate: [Date],  - Date and time specifying the lower bound of the time frame within which the message had been sent/received
//      endDate: [Date]  - Date and time specifying the upper bound of the time frame within which the message had been sent/received
//    }
//    limit: [Number] - (default: 'maxQueryCount') Maximum number of messages that should be returned
//    skip: [Number] - (default: 0) Number of messages that should be skipped (from beginning of list of matching messages) and not returned
//
//  Result: {
//    messages: [Array(Object)], - List of Message objects that satisfied the query criteria
//    hasMore: [Boolean] - Indicates whether there are more messages that satisfy the query criteria yet to be returned
//  }
Message.query = function (issuerDeviceId, filter, limit, skip) {
    const hasFilter = typeof filter === 'object' && filter !== null && Object.keys(filter).length > 0;
    let selector = undefined,
        logSelector = undefined,
        sendSelector = undefined;

    if (hasFilter && filter.direction !== undefined && !isValidMsgDirection(filter.direction)) {
        // Fix direction
        filter.direction = undefined;
    }

    if (hasFilter && (filter.action === Message.action.log || filter.action === undefined)) {
        // Log message action
        // noinspection JSValidateTypes
        logSelector = {
            action: Message.action.log
        };

        logSelector.originDeviceId = issuerDeviceId;

        // Date filter
        if (filter.startDate instanceof Date) {
            logSelector.sentDate = {$gte: filter.startDate}
        }

        if (filter.endDate instanceof Date) {
            if (logSelector.sentDate !== undefined) {
                logSelector.$and = [
                    {sentDate: logSelector.sentDate},
                    {sentDate: {$lte: filter.endDate}}
                ];

                delete logSelector.sentDate;
            }
            else {
                logSelector.sentDate = {$lte: filter.endDate};
            }
        }

        // Read state filter
        if (filter.readState === Message.readState.read) {
            logSelector.firstReadDate = {$exists: true};
        }
        else if (filter.readState === Message.readState.unread) {
            logSelector.firstReadDate = {$exists: false};
        }
    }

    if (hasFilter && (filter.action === Message.action.send || filter.action === undefined)) {
        // Send message action
        // noinspection JSValidateTypes
        sendSelector = {
            action: Message.action.send
        };

        let directionSelector = undefined,
            inboundSelector = undefined,
            outboundSelector = undefined;

        if (filter.direction === undefined || filter.direction === Message.direction.inbound) {
            // Inbound message direction.
            //  Make sure that only received messages are included
            // noinspection JSValidateTypes
            inboundSelector = {
                targetDeviceId: issuerDeviceId,
                receivedDate: {
                    $exists: true
                }
            };

            // From device ID filter
            if (filter.fromDeviceId !== undefined) {
                filter.fromDeviceId = !Array.isArray(filter.fromDeviceId) ? [filter.fromDeviceId] : filter.fromDeviceId;

                inboundSelector.originDeviceId = {$in: filter.fromDeviceId};
            }

            // Date filter
            if (filter.startDate instanceof Date) {
                inboundSelector.receivedDate = {$gte: filter.startDate}
            }

            if (filter.endDate instanceof Date) {
                if (inboundSelector.receivedDate !== undefined) {
                    inboundSelector.$and = [
                        {receivedDate: inboundSelector.receivedDate},
                        {receivedDate: {$lte: filter.endDate}}
                    ];

                    delete inboundSelector.receivedDate;
                }
                else {
                    inboundSelector.receivedDate = {$lte: filter.endDate};
                }
            }

             if (filter.readState === Message.readState.read) {
                 inboundSelector.firstReadDate = {$exists: true};
             }
             else if (filter.readState === Message.readState.unread) {
                 inboundSelector.firstReadDate = {$exists: false};
             }
        }

        if (filter.direction === undefined || filter.direction === Message.direction.outbound) {
            // Outbound message direction
            // noinspection JSValidateTypes
            outboundSelector = {
                originDeviceId: issuerDeviceId
            };

            // To device ID filter
            if (filter.toDeviceId !== undefined) {
                filter.toDeviceId = !Array.isArray(filter.toDeviceId) ? [filter.toDeviceId] : filter.toDeviceId;

                outboundSelector.targetDeviceId = {$in: filter.toDeviceId};
            }

            // Date filter
            if (filter.startDate instanceof Date) {
                outboundSelector.sentDate = {$gte: filter.startDate}
            }

            if (filter.endDate instanceof Date) {
                if (outboundSelector.sentDate !== undefined) {
                    outboundSelector.$and = [
                        {sentDate: outboundSelector.sentDate},
                        {sentDate: {$lte: filter.endDate}}
                    ];

                    delete outboundSelector.sentDate;
                }
                else {
                    outboundSelector.sentDate = {$lte: filter.endDate};
                }
            }

            if (filter.readState === Message.readState.read || filter.readState === Message.readState.unread) {
                // Make that only messages that had been sent with read confirmation enabled are included,
                //  and consider message read only if read confirmation has already been received
                outboundSelector.readConfirmationEnabled = true;
                outboundSelector.readConfirmed = {
                    $exists: filter.readState === Message.readState.read
                };
            }
        }

        // Message direction filter
        if (inboundSelector !== undefined) {
            directionSelector = inboundSelector;
        }

        if (outboundSelector !== undefined) {
            if (directionSelector !== undefined) {
                // noinspection JSValidateTypes
                directionSelector = {
                    $or: [
                        directionSelector,
                        outboundSelector
                    ]
                };
            }
            else {
                directionSelector = outboundSelector;
            }
        }

        if (directionSelector !== undefined) {
            // noinspection JSValidateTypes
            sendSelector = {
                $and: [
                    sendSelector,
                    directionSelector
                ]
            };
        }
    }

    // Message action filter
    if (logSelector !== undefined) {
        selector = logSelector;
    }

    if (sendSelector !== undefined) {
        if (selector !== undefined) {
            // noinspection JSValidateTypes
            selector = {
                $or: [
                    selector,
                    sendSelector
                ]
            };
        }
        else {
            selector = sendSelector;
        }
    }

    if (selector === undefined) {
        // Any message action

        const sentSelector = {
            originDeviceId: issuerDeviceId
        };
        // Make sure that only received messages are included
        const receivedSelector = {
            targetDeviceId: issuerDeviceId,
            receivedDate: {
                $exists: true
            }
        };

        // Date filter
        if (hasFilter && (filter.startDate instanceof Date)) {
            sentSelector.sentDate = {
                $gte: filter.startDate
            };
            receivedSelector.receivedDate = {
                $gte: filter.startDate
            };
        }

        if (hasFilter && (filter.endDate instanceof Date)) {
            if (sentSelector.sentDate !== undefined) {
                sentSelector.$and = [
                    {sentDate: sentSelector.sentDate},
                    {sentDate: {$lte: filter.endDate}}
                ];
                receivedSelector.$and = [
                    {receivedDate: receivedSelector.receivedDate},
                    {receivedDate: {$lte: filter.endDate}}
                ];

                delete sentSelector.sentDate;
                delete receivedSelector.receivedDate
            }
            else {
                sentSelector.sentDate = {
                    $lte: filter.endDate
                };
                receivedSelector.receivedDate = {
                    $lte: filter.endDate
                };
            }
        }

        // Read state filter
        if (hasFilter && (filter.readState === Message.readState.read || filter.readState === Message.readState.unread)) {
            sentSelector.$and = [{
                $or: [{
                    action: Message.action.log
                }, {
                    $and: [{
                        action: Message.action.send
                    }, {
                        // Make that only messages that had been sent with read confirmation enabled are included
                        readConfirmationEnabled: true
                    }]
                }]
            }, {
                firstReadDate: {
                    $exists: filter.readState === Message.readState.read
                }
            }];
            receivedSelector.firstReadDate = {
                $exists: filter.readState === Message.readState.read
            };
        }

        // noinspection JSValidateTypes
        selector = {
            $or: [
                sentSelector,
                receivedSelector
            ]
        };
    }

    if (!Number.isInteger(limit) || limit <= 0 || limit > cfgSettings.maxQueryCount) {
        limit = cfgSettings.maxQueryCount;
    }

    if (!Number.isInteger(skip) || skip < 0) {
        skip = 0;
    }

    Catenis.logger.DEBUG('Query selector computed for Message.query() method:', selector);

    let hasMore = false;

    const messages = Catenis.db.collection.Message.find(selector, {
        sort: {createdDate: 1},
        skip: skip,
        limit: limit + 1
    }).fetch().filter((doc, idx) => {
        if (idx >= limit) {
            hasMore = true;
            return false;
        }

        return true;
    }).map((doc) => {
        return new Message(doc);
    });

    return {
        messages: messages,
        hasMore: hasMore
    }
};


// Message function class (public) properties
//

Message.action = Object.freeze({
    log: 'log',
    send: 'send',
    read: 'read'    // Special action used exclusively when reading messages in chunks
});

Message.source = Object.freeze({
    local: 'local',
    remote: 'remote'
});

Message.direction = Object.freeze({
    inbound: 'inbound',
    outbound: 'outbound'
});

Message.readState = Object.freeze({
    read: 'read',
    unread: 'unread'
});


// Definition of module (private) functions
//

// Synthesize new message ID using the blockchain addresses associated with
//  a transaction's inputs
function newMessageId(msgTransport) {
    let seed;
    let prefix;

    if (msgTransport instanceof Transaction) {
        // We compose a unique seed from the blockchain addresses of the transaction's inputs
        //  We can guarantee that it will be unique because Catenis blockchain addresses
        //  are only used once
        seed = Catenis.application.commonSeed.toString() + ':' + msgTransport.inputs.reduce((acc, input, index) => {
            if (acc.length > 0) {
                acc += ',';
            }
            return acc + 'address#:' + (index + 1) + input.address;
        }, '');
        prefix = 'm';
    }
    else if (msgTransport instanceof OffChainMsgEnvelope) {
        seed = Catenis.application.commonSeed.toString() + ':offChainCID:' + msgTransport.cid;
        prefix = 'o';
    }

    return prefix + Random.createWithSeeds(seed).id(19);
}

function isValidMsgDirection(value) {
    return Object.keys(Message.direction).some((key) => {
        return Message.direction[key] === value;
    });
}


// Module code
//

// Lock function class
Object.freeze(Message);
