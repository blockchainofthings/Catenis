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


// Module functions used to simulate private Message object methods
//  NOTE: these functions need to be bound to a Message object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// Message function class (public) methods
//

// Create a new Message sent by this Catenis node and returns its messageId
//
//  Arguments:
//    msgTx: [Object] - instance of either LogMessageTransaction or SendMessageTransaction
Message.createSentMessage = function (msgTx) {
    let action;

    if (msgTx instanceof LogMessageTransaction) {
        action = Message.action.log;
    }
    else if (msgTx instanceof SendMessageTransaction) {
        action = Message.action.send;
    }
    else {
        // Invalid argument
        Catenis.logger.ERROR('Message.createMessage method called with invalid argument', {msgTx: msgTx});
        throw Error('Invalid msgTx argument');
    }

    // Make sure that transaction had already been sent and saved
    if (!msgTx.transact.txSaved) {
        Catenis.logger.ERROR('Cannot create message for a transaction that had not yet been saved', msgTx.transact);
        throw Meteor.Error('ctn_msg_tx_unsaved', 'Cannot create message for a transaction that had not yet been saved', msgTx.transact);
    }

    let docMessage = {
        messageId: newMessageId(msgTx.transact),
        action: action,
        source: Message.source.sent_msg
    };

    if (action === Message.action.log) {
        docMessage.originDeviceId = msgTx.device.deviceId;
    }
    else {  // action == Message.action.send
        docMessage.originDeviceId = msgTx.originDevice.deviceId;
        docMessage.targetDeviceId = msgTx.targetDevice.deviceId;
    }

    docMessage.isEncrypted = msgTx.options.encrypted;
    docMessage.blockchain = {
        txid: msgTx.transact.txid,
        confirmed: false
    };

    if (msgTx.extMsgRef) {
        const storageProvider = msgTx.options.storageProvider !== undefined ? msgTx.options.storageProvider : CatenisMessage.defaultStorageProvider;

        docMessage.externalStorage = {
            provider: storageProvider.name,
            reference: CatenisMessage.getMessageStorageClass(storageProvider).getNativeMsgRef(msgTx.extMsgRef)
        };
    }

    docMessage.createdDate = new Date();
    docMessage.sentDate = msgTx.transact.sentDate;

    try {
        docMessage._id = Catenis.db.collection.Message.insert(docMessage);
    }
    catch (err) {
        Catenis.logger.ERROR(util.format('Error trying to create new message: %s ', util.inspect(docMessage)), err);
        throw new Meteor.Error('ctn_msg_insert_error', util.format('Error trying to create new message: %s', util.inspect(docMessage)), err.stack);
    }

    return docMessage.messageId;
};

Message.getMessageByMessageId = function (messageId) {
    // Retrieve Message doc/rec
    const docMessage = Catenis.db.collection.Message.findOne({
        messageId: messageId
    });

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
//      startDate: [Date],  // Date and time specifying the lower bound of the time frame within which the message had been sent/reaceived
//      endDate: [Date]  // Date and time specifying the upper bound of the time frame within which the message had been sent/reaceived
//    }
//
//  Result: {
//    messages: [Array(Object)],  // List of Message objects that satisfied the query criteria
//    countExceeded: [Boolean]    // Indicates whether the number of messages that satisfied the query criteria was greater than the maximum
//                                //  number of messages that can be returned, and for that reason the returned list had been truncated
//  }
Message.query = function (issuerDeviceId, filter) {
    const hasFilter = typeof filter === 'object' && filter !== null;
    let selector = undefined,
        logSelector = undefined,
        sendSelector = undefined;

    if (hasFilter && filter.action === Message.action.log) {
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

    if (hasFilter && filter.action === Message.action.send) {
        // Send message action
        sendSelector = {
            action: Message.action.send
        };

        let directionSelector = undefined,
            inboundSelector = undefined,
            outboundSelector = undefined;

        if (filter.direction === undefined || filter.direction === Message.direction.inbound || !isValidMsgDirection(filter.direction)) {
            // Inbound message direction
            inboundSelector = {
                targetDeviceId: issuerDeviceId
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

        if (filter.direction === undefined || filter.direction === Message.direction.outbound || !isValidMsgDirection(filter.direction)) {
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
        }, receivedSelector = {
            targetDeviceId: issuerDeviceId
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
    sent_msg: 'sent_msg',
    received_msg: 'received_msg'
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
