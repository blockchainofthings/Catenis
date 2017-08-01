/**
 * Created by claudio on 05/04/17.
 */

//console.log('[Message.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//  NOTE: the reference of these modules are done sing 'require()' instead of 'import' to
//      to avoid annoying WebStorm warning message: 'default export is not defined in
//      imported module'
const util = require('util');
// Third-party node modules
import config from 'config';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { LogMessageTransaction } from './LogMessageTransaction';
import { SendMessageTransaction } from './SendMessageTransaction';
import { CatenisMessage } from './CatenisMessage';

// Config entries
const messageConfig = config.get('message');

// Configuration settings
const cfgSettings = {
    maxQueryCount: messageConfig.get('maxQueryCount')
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
    this.isEncrypted = docMessage.isEncrypted;
    this.txid = docMessage.blockchain.txid;
    this.isTxConfirmed = docMessage.blockchain.confirmed;

    if (docMessage.externalStorage) {
        this.storageProviderName = docMessage.externalStorage.provider;
        this.externalStorageRef = docMessage.externalStorage.reference;
    }

    this.createdDate = docMessage.createdDate;
    this.sentDate = docMessage.sentDate;
    this.receivedDate = docMessage.receivedDate;
    this.blocked = docMessage.blocked !== undefined;
    this.lastReadDate = docMessage.lastReadDate;
}


// Public Message object methods
//

// Update last read date
//
//  Return:
//   firstRead: [Boolean]  // Indication if this was the first time that message was read
Message.prototype.readNow = function () {
    const prevLastReadDate = this.lastReadDate;
    this.lastReadDate = new Date();

    try {
        Catenis.db.collection.Message.update({_id: this.doc_id}, {$set: {lastReadDate: this.lastReadDate}});
    }
    catch (err) {
        Catenis.logger.ERROR(util.format('Error trying to update last read date of message (doc_id: %s).', this.doc_id), err);
        throw new Meteor.Error('ctn_msg_update_error', util.format('Error trying to update last read date of message (doc_id: %s)', this.doc_id), err.stack);
    }

    return !prevLastReadDate;
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
        throw Meteor.Error('ctn_msg_tx_unsaved', 'Cannot create message for a transaction that had not yet been saved', msgTransact.transact);
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

Message.getMessageByTxid = function (txid) {
    // Retrieve Message doc/rec
    const docMessage = Catenis.db.collection.Message.findOne({txid: txid});

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
//    issuerDeviceId: [String]  // Catenis device ID of device that is issuing the query request
//    filter: {
//      action: [String],   // The action originally performed on the message. One of the properties of the Message.action object
//      direction: [String],  // Direction of the sent message in reference to the issuer device. One of the properties of the Message.direction object
//      fromDeviceId: [String|Array(String)], // Single Catenis device ID or list of Catenis device IDs specifying the device(s) that have sent the messages to the issuer device
//      toDeviceId: [Arraty(String)],  // Single Catenis device ID or list of Catenis device IDs specifying the device(s) to which the messages sent from the issuer device have been sent
//      readState: [String],  // The read state (either read or unread) of the message. One of the properties of the Message.readState object
//      startDate: [Date],  // Date and time specifying the lower bound of the time frame within which the message had been sent/received
//      endDate: [Date]  // Date and time specifying the upper bound of the time frame within which the message had been sent/received
//    }
//
//  Result: {
//    messages: [Array(Object)],  // List of Message objects that satisfied the query criteria
//    countExceeded: [Boolean]    // Indicates whether the number of messages that satisfied the query criteria was greater than the maximum
//                                //  number of messages that can be returned, and for that reason the returned list had been truncated
//  }
Message.query = function (issuerDeviceId, filter) {
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
            logSelector.lastReadDate = {$exists: true};
        }
        else if (filter.readState === Message.readState.unread) {
            logSelector.lastReadDate = {$exists: false};
        }
    }

    if (hasFilter && (filter.action === Message.action.send || filter.action === undefined)) {
        // Send message action
        sendSelector = {
            action: Message.action.send
        };

        let directionSelector = undefined,
            inboundSelector = undefined,
            outboundSelector = undefined;

        if (filter.direction === undefined || filter.direction === Message.direction.inbound) {
            // Inbound message direction.
            //  Make sure that only received messages are included
            inboundSelector = {
                targetDeviceId: issuerDeviceId,
                receivedDate: {
                    $exists: true
                }
            };

            // From devide ID filter
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
        }

        if (filter.direction === undefined || filter.direction === Message.direction.outbound) {
            // Outbound message direction
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
        }

        // Message direction filter
        if (inboundSelector !== undefined) {
            directionSelector = inboundSelector;
        }

        if (outboundSelector !== undefined) {
            if (directionSelector !== undefined) {
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

        // Read state filter
        let readStateSelector = undefined;

        if (filter.readState === Message.readState.read) {
            readStateSelector = {lastReadDate: {$exists: true}}
        }
        else if (filter.readState === Message.readState.unread) {
            readStateSelector = {lastReadDate: {$exists: false}}
        }

        if (directionSelector !== undefined || readStateSelector !== undefined) {
            sendSelector = {
                $and: [
                    sendSelector
                ]
            };

            if (directionSelector !== undefined) {
                sendSelector.$and.push(directionSelector);
            }

            if (readStateSelector !== undefined) {
                sendSelector.$and.push(readStateSelector);
            }
        }
    }

    // Message action filter
    if (logSelector !== undefined) {
        selector = logSelector;
    }

    if (sendSelector !== undefined) {
        if (selector !== undefined) {
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
        if (filter.startDate instanceof Date) {
            sentSelector.sentDate = {
                $gte: filter.startDate
            };
            receivedSelector.receivedDate = {
                $gte: filter.startDate
            };
        }

        if (filter.endDate instanceof Date) {
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

        selector = {
            $or: [
                sentSelector,
                receivedSelector
            ]
        };

        // Read state filter
        if (filter.readState === Message.readState.read) {
            selector.lastReadDate = {$exists: true};
        }
        else if (filter.readState === Message.readState.unread) {
            selector.lastReadDate = {$exists: false};
        }
    }

    Catenis.logger.DEBUG('Query selector computed for Message.query() method:', selector);

    let countExceeded = false;

    const messages = Catenis.db.collection.Message.find(selector, {
        sort: {createdDate: 1},
        limit: cfgSettings.maxQueryCount + 1
    }).fetch().filter((doc, idx) => {
        let returnDoc = true;

        if (idx >= cfgSettings.maxQueryCount) {
            countExceeded = true;
            returnDoc = false;
        }

        return returnDoc;
    }).map((doc) => {
        return new Message(doc);
    });

    return {
        messages: messages,
        countExceeded: countExceeded
    }
};


// Message function class (public) properties
//

Message.action = Object.freeze({
    log: 'log',
    send: 'send'
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
function newMessageId(tx) {
    // We compose a unique seed from the blockchain addresses of the transaction's inputs
    //  We can guarantee that it will be unique because Catenis blockchain  addresses
    //  are only used once
    const seed = Catenis.application.seed.toString() + ':' + tx.inputs.reduce((acc, input, index) => {
        if (acc.length > 0) {
            acc += ',';
        }
        return acc + 'address#:' + (index + 1) + input.address;
    }, '');

    return 'm' + Random.createWithSeeds(seed).id(19);
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
