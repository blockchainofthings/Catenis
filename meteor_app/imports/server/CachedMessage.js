/**
 * Created by claudio on 2019-03-05.
 */

//console.log('[CachedMessage.js]: This code just ran.');

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

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { MessageChunk } from './MessageChunk';
import { Random } from 'meteor/random';
import moment from 'moment';
import Future from 'fibers/future';

// Config entries
const cachedMsgConfig = config.get('cachedMessage');

// Configuration settings
const cfgSettings = {
    timeContinueMsg: cachedMsgConfig.get('timeContinueMsg'),
    timeKeepIncompleteMsg: cachedMsgConfig.get('timeKeepIncompleteMsg'),
    timeKeepUnreadMsg: cachedMsgConfig.get('timeKeepUnreadMsg'),
    timeKeepReadMsg: cachedMsgConfig.get('timeKeepReadMsg'),
    purgeOldMessagesInterval: cachedMsgConfig.get('purgeOldMessagesInterval')
};

let purgeOldMessagesIntervalHandle;


// Definition of function classes
//

// CachedMessage function class
//
//  Constructor arguments:
//    docCachedMessage [Object] - CachedMessage database doc/rec
//
// NOTE: make sure that objects of this function class are instantiated and used (their methods
//  called) from code executed from the MessageChunk.dbCS critical section object
export function CachedMessage(docCachedMessage) {
    this.doc_id = docCachedMessage._id;
    this.cachedMessageId = docCachedMessage.cachedMessageId;
    this.deviceId = docCachedMessage.deviceId;
    this.action = docCachedMessage.action;
    this.messageId = docCachedMessage.messageId;
    this.dataChunkSize = docCachedMessage.dataChunkSize;
    this.createdDate = docCachedMessage.createdDate;

    this.bytesProcessed = docCachedMessage.progress.bytesProcessed;
    this.progressDone = docCachedMessage.progress.done;

    if (this.progressDone) {
        this.progressSucceeded = docCachedMessage.progress.success;
        this.progressFinishDate = docCachedMessage.progress.finishDate;

        if (this.progressSucceeded) {
            this.msgInfo = docCachedMessage.msgInfo;
            this.chunksRead = docCachedMessage.chunksRead;
            this.readFinalized = docCachedMessage.readFinalized;
            this.lastReadDate = docCachedMessage.lastReadDate;
        }
        else {
            this.progressErrorCode = docCachedMessage.progress.error.code;
            this.progressErrorMessage = docCachedMessage.progress.error.message;
        }
    }

    getNextMessageChunk.call(this);

    this.refMoment = moment();
}


// Public CachedMessage object methods
//

CachedMessage.prototype.getDataChunk = function (continuationToken) {
    // Make sure that message data chunk can be read
    let errMsg = 'Cannot read message chunk of cached message';
    let errCode;

    if (!this.progressDone || !this.progressSucceeded) {
        errMsg += '; message not available';
        errCode = 'ctn_cach_msg_not_available';
    }
    else if (this.readFinalized) {
        errMsg += '; message already read';
        errCode = 'ctn_cach_msg_already_read';
    }
    else if (!this.nextMessageChunk || this.nextMessageChunk.messageChunkId !== continuationToken) {
        errMsg += '; unexpected continuation token';
        errCode = 'ctn_cach_msg_invalid_cont_token';
    }
    else if (this.refMoment.diff(this.lastReadDate, 'seconds', true) > cfgSettings.timeContinueMsg) {
        errMsg += '; message expired';
        errCode = 'ctn_cach_msg_expired';
    }

    if (errCode) {
        Catenis.logger.ERROR(errMsg, {
            cachedMessage: this,
            continuationToken: continuationToken
        });
        throw new Meteor.Error(errCode, errMsg);
    }

    // Try to retrieve message data chunk
    try {
        const dataChunk = this.nextMessageChunk.getData();

        // Update read control info
        this.chunksRead++;
        this.readFinalized = this.nextMessageChunk.isFinal;
        this.lastReadDate = new Date();

        Catenis.db.collection.CachedMessage.update(this.doc_id, {
            $set: {
                chunksRead: this.chunksRead,
                readFinalized: this.readFinalized,
                lastReadDate: this.lastReadDate
            }
        });

        // Retrieve next message chunk
        getNextMessageChunk.call(this);

        return dataChunk;
    }
    catch (err) {
        Catenis.logger.ERROR('Failed to read cached message (cachedMessageId: %s) data chunk (continuationToken: %s).', this.cachedMessageId, continuationToken, err);
        throw new Error('Failed to read cached message data chunk');
    }
};

CachedMessage.prototype.getContinuationToken = function () {
    if (this.nextMessageChunk) {
        return this.nextMessageChunk.messageChunkId;
    }
};

CachedMessage.prototype.hasFirstMessageChunk = function () {
    return this.nextMessageChunk && this.nextMessageChunk.order === 1;
};

CachedMessage.prototype.getMessageProgress = function () {
    // Get cached message progress
    const msgProgress = {
        action: this.action,
        progress: undefined
    };

    if (this.progressDone && this.progressSucceeded) {
        // Make sure that reading of message has not yet started
        if (!this.hasFirstMessageChunk()) {
            Catenis.logger.DEBUG('Progress of cached message (doc_id: %s) cannot be returned; read already started', this.doc_id);
            throw new Meteor.Error('ctn_cach_msg_read_already_started', util.format('Progress of cached message (doc_id: %s) cannot be returned; read already started', this.doc_id));
        }

        msgProgress.result = {
            messageId: this.messageId,
            continuationToken: this.getContinuationToken()
        }
    }

    const progress = {
        bytesProcessed: this.bytesProcessed,
        done: this.progressDone
    };

    if (this.progressDone) {
        if (this.progressSucceeded) {
            progress.success = true;
        }
        else {
            progress.success = false;
            progress.error = {
                code: this.progressErrorCode,
                message: this.progressErrorMessage
            }
        }

        progress.finishDate = this.progressFinishDate;
    }

    msgProgress.progress = progress;

    return msgProgress;
};


// Module functions used to simulate private CachedMessage object methods
//  NOTE: these functions need to be bound to a CachedMessage object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

// Retrieve fist message chunk of cached message that had not yet been read
function getNextMessageChunk() {
    this.nextMessageChunk = this.chunksRead !== undefined && !this.readFinalized
        ? MessageChunk.getMessageChunkForCachedMessage(this.doc_id, this.chunksRead + 1)
        : undefined;
}


// CachedMessage function class (public) methods
//

CachedMessage.initialize = function () {
    Catenis.logger.TRACE('CachedMessage initialization');

    // Execute process to purge old cached messages
    purgeOldCachedMessages();
    Catenis.logger.TRACE('Setting recurring timer to purge old cached messages');
    purgeOldMessagesIntervalHandle = Meteor.setInterval(purgeOldCachedMessages, cfgSettings.purgeOldMessagesInterval);
};

// NOTE: this method should be called from code executed from the MessageChunk.dbCS critical section object
CachedMessage.createCachedMessage = function (deviceId, action, messageId, dataChunkSize) {
    let cachedMessage_id;

    try {
        cachedMessage_id = Catenis.db.collection.CachedMessage.insert({
            cachedMessageId: newCachedMessageId(),
            deviceId: deviceId,
            action: action,
            messageId: messageId,
            dataChunkSize: dataChunkSize,
            progress: {
                bytesProcessed: 0,
                done: false
            },
            createdDate: new Date()
        });
    }
    catch (err) {
        // Error creating new cached message. Log error and throw exception
        Catenis.logger.ERROR('Error trying to create new cached message for device (deviceId: %s) and message (messageId: %s).', deviceId, messageId, err);
        throw new Meteor.Error('ctn_cach_msg_insert_error', util.format('Error trying to create new cached message for device (deviceId: %s) and message (messageId: %s).', deviceId, messageId), err.stack);
    }

    return new CachedMessage(Catenis.db.collection.CachedMessage.findOne(cachedMessage_id));
};

// NOTE: this method should be called from code executed from the MessageChunk.dbCS critical section object
CachedMessage.getCachedMessageByMessageId = function (cachedMessageId, deviceId, logError = true) {
    const docCachedMessage = Catenis.db.collection.CachedMessage.findOne({cachedMessageId: cachedMessageId});

    if (!docCachedMessage) {
        // No cached message found containing the given message ID.
        //  Log error and throw exception
        if (logError) {
            Catenis.logger.ERROR('Could not find cached message with given message ID (cachedMessageId: %s)', cachedMessageId);
        }

        throw new Meteor.Error('ctn_cach_msg_not_found', util.format('Could not find cached message with given message ID (cachedMessageId: %s)', cachedMessageId));
    }

    // Make sure that cached message belongs to same device if necessary
    if (deviceId && docCachedMessage.deviceId !== deviceId) {
        // Cached message belongs to a different device. Log error and throw exception
        if (logError) {
            Catenis.logger.ERROR('Trying to read message chunk from a cached message that belongs to a different device', {
                cachedMessageDeviceId: docCachedMessage.deviceId,
                messageChunkDeviceId: deviceId
            });
        }

        throw new Meteor.Error('ctn_cach_msg_wrong_device', 'Trying to read message chunk from a cached message that belongs to a different device');
    }

    return new CachedMessage(docCachedMessage);
};

// NOTE: this method should be called from code executed from the MessageChunk.dbCS critical section object
CachedMessage.getCachedMessageByMessageChunkId = function (messageChunkId, deviceId, messageId) {
    let cachedMessage_id;

    try {
        cachedMessage_id = MessageChunk.getEphemeralMsgRefFOfCachedMessageChunk(messageChunkId);
    }
    catch (err) {
        // No cached message found containing a message chunk with the given ID.
        //  Log error and throw exception
        Catenis.logger.ERROR('Error retrieving cached message associated with given message chunk (messageChunkId: %s).', messageChunkId, err);
        throw new Meteor.Error('ctn_cach_msg_not_found', util.format('Could not retrieve cached message associated with given message chunk (messageChunkId: %s).', messageChunkId));
    }

    const cachedMessage = new CachedMessage(Catenis.db.collection.CachedMessage.findOne(cachedMessage_id));

    // Make sure that cached message belongs to same device and message if necessary
    if (deviceId && cachedMessage.deviceId !== deviceId) {
        // Cached message belongs to a different device. Log error and throw exception
        Catenis.logger.ERROR('Trying to read message chunk from a cached message that belongs to a different device', {
            cachedMessageDeviceId: cachedMessage.deviceId,
            messageChunkDeviceId: deviceId
        });
        throw new Meteor.Error('ctn_cach_msg_wrong_device', 'Trying to read message chunk from a cached message that belongs to a different device');
    }
    else if (messageId && cachedMessage.messageId !== messageId) {
        // Cached message associated with a different message. Log error and throw exception
        Catenis.logger.ERROR('Trying to read message chunk from a cached message for a different message', {
            cachedMessageMessageId: cachedMessage.messageId,
            messageChunkMessageId: messageId
        });
        throw new Meteor.Error('ctn_cach_msg_wrong_message', 'Trying to read message chunk from a cached message for a different message');
    }

    return cachedMessage;
};

CachedMessage.updateProcessingProgress = function (cachedMessageId, bytesWritten) {
    try {
        const docCachedMessage = Catenis.db.collection.CachedMessage.findOne({
            cachedMessageId: cachedMessageId
        }, {
            fields: {
                _id: 1,
                progress: 1
            }
        });

        if (docCachedMessage) {
            if (!docCachedMessage.progress.done) {
                Catenis.db.collection.CachedMessage.update(docCachedMessage._id, {
                    $set: {
                        'progress.bytesProcessed': docCachedMessage.progress.bytesProcessed + bytesWritten
                    }
                });
            }
            else {
                // Cannot update processing progress of cached message; processing already finalized.
                //  Throw exception
                // noinspection ExceptionCaughtLocallyJS
                throw new Error(util.format('Cannot update processing progress of cached message (cachedMessageId: %s); processing already finalized', cachedMessageId));
            }
        }
        else {
            // Cached message not found. Throw exception
            // noinspection ExceptionCaughtLocallyJS
            throw new Error(util.format('No cached message found with the given ID (cachedMessageId: %s)', cachedMessageId));
        }
    }
    catch (err) {
        // Error updating cached message processing progress. Log error
        Catenis.logger.ERROR('Error updating cached message (cachedMessageId: %s) processing progress.', cachedMessageId, err);
    }
};

CachedMessage.finalizeProcessing = function (cachedMessageId, error, msgInfo) {
    try {
        const docCachedMessage = Catenis.db.collection.CachedMessage.findOne({
            cachedMessageId: cachedMessageId
        }, {
            fields: {
                _id: 1,
                progress: 1
            }
        });

        if (docCachedMessage) {
            if (!docCachedMessage.progress.done) {
                const set = {
                    'progress.done': true
                };

                if (error) {
                    set['progress.success'] = false;
                    set['progress.error'] = conformProcessingError(cachedMessageId, error);
                }
                else {
                    set['progress.success'] = true;

                    if (msgInfo) {
                        set.msgInfo = msgInfo;
                    }

                    set.chunksRead = 0;
                    set.readFinalized = false;
                }

                set['progress.finishDate'] = new Date();

                Catenis.db.collection.CachedMessage.update(docCachedMessage._id, {
                    $set: set
                });
            }
            else {
                // Cannot update processing progress of cached message; processing already finalized.
                //  Throw exception
                // noinspection ExceptionCaughtLocallyJS
                throw new Error(util.format('Cannot update processing progress of cached message (cachedMessageId: %s); processing already finalized', cachedMessageId));
            }
        }
        else {
            // Cached message not found. Throw exception
            // noinspection ExceptionCaughtLocallyJS
            throw new Error(util.format('No cached message found with the given ID (cachedMessageId: %s)', cachedMessageId));
        }
    }
    catch (err) {
        // Error finalizing cached message processing. Log error
        Catenis.logger.ERROR('Error finalizing cached message (cachedMessageId: %s) processing.', cachedMessageId, err);
    }
};


// CachedMessage function class (public) properties
//

/*CachedMessage.prop = {};*/


// Definition of module (private) functions
//

function purgeOldCachedMessages() {
    Catenis.logger.TRACE('Executing process to purge old Cached Message database docs/recs');
    async function getOldCachedMessagesToRemove(refMoment) {
        const idDocsToRemove = new Set();

        // Identify incomplete cached messages that should be removed
        const earliestDateIncompleteMessages = moment(refMoment).subtract(cfgSettings.timeKeepIncompleteMsg, 'seconds').toDate();

        // noinspection JSUnresolvedFunction
        await Catenis.db.mongoCollection.MessageChunk.aggregate([{
            $match: {
                type: MessageChunk.type.cached.name
            }
        }, {
            $sort: {
                ephemeralMessage_id: 1,
                order: 1
            }
        }, {
            $group: {
                _id: '$ephemeralMessage_id',
                latestIsFinal: {
                    $last: '$isFinal'
                },
                latestCreatedDate: {
                    $last: '$createdDate'
                }
            }
        }, {
            $match: {
                latestIsFinal: false,
                latestCreatedDate: {
                    $lt: earliestDateIncompleteMessages
                }
            }
        }]).forEach(doc => idDocsToRemove.add(doc._id));

        // Include cached messages with no message chunks
        // noinspection JSUnresolvedFunction
        await Catenis.db.mongoCollection.CachedMessage.aggregate([{
            $match: {
                createdDate: {
                    $lt: earliestDateIncompleteMessages
                }
            }
        }, {
            $lookup: {
                from: 'MessageChunk',
                let: {
                    cachedMessage_id: "$_id"
                },
                pipeline: [{
                    $match: {
                        $expr: {
                            $eq: ['$ephemeralMessage_id', '$$cachedMessage_id']
                        }
                    }
                }, {
                    $project: {
                        _id: 1
                    }
                }],
                as: 'messageChunks'
            }
        }, {
            $match: {
                messageChunks: {
                    $size: 0
                }
            }
        }]).forEach(doc => idDocsToRemove.add(doc._id));

        // Identify unread cached messages that should be removed
        const earliestDateUnreadMessages = moment(refMoment).subtract(cfgSettings.timeKeepUnreadMsg, 'seconds').toDate();

        Catenis.db.collection.CachedMessage.find({
            'progress.done': true,
            readFinalized: false,
            'progress.finishDate': {
                $lt: earliestDateUnreadMessages
            }
        }, {
            fields: {
                _id: 1
            }
        }).forEach(doc => idDocsToRemove.add(doc._id));

        // Identify fully read cached messages that should be removed
        const earliestDateReadMessages = moment(refMoment).subtract(cfgSettings.timeKeepReadMsg, 'seconds').toDate();

        Catenis.db.collection.CachedMessage.find({
            readFinalized: true,
            lastReadDate: {
                $lt: earliestDateReadMessages
            }
        }, {
            fields: {
                _id: 1
            }
        }).forEach(doc => idDocsToRemove.add(doc._id));

        return Array.from(idDocsToRemove);
    }

    try {
        const refMoment = moment();

        // Execute code in critical section to avoid database concurrency
        MessageChunk.dbCS.execute(() => {
            const idCachedMessagesToRemove = Future.fromPromise(getOldCachedMessagesToRemove(refMoment)).wait();

            if (idCachedMessagesToRemove.length > 0) {
                // Remove all message chunks associated with cached messages to be removed
                const numMessageChunksRemoved = Catenis.db.collection.MessageChunk.remove({
                    ephemeralMessage_id: {
                        $in: idCachedMessagesToRemove
                    }
                });
                Catenis.logger.DEBUG('Number of MessageChunk docs/recs associated with old cached messages that have been removed: %d', numMessageChunksRemoved);

                // Now remove the cached messages themselves
                const numCachedMessagesRemoved = Catenis.db.collection.CachedMessage.remove({
                    _id: {
                        $in: idCachedMessagesToRemove
                    }
                });
                Catenis.logger.DEBUG('Number of old CachedMessage doc/recs that have been removed: %d', numCachedMessagesRemoved);
            }
        });
    }
    catch (err) {
        Catenis.logger.ERROR('Error while executing process to purge old Cached Message database docs/recs.', err);
    }
}

function newCachedMessageId(checkExistence = true) {
    let id = 'h' + Random.id(19);

    if (checkExistence) {
        while (Catenis.db.collection.CachedMessage.findOne({cachedMessageId: id}, {fields: {_id: 1}})) {
            Catenis.logger.DEBUG('Newly generated Cached Message ID (%s) already exists. Trying again.', id);

            id = 'h' + Random.id(19);
        }
    }

    return id;
}

function conformProcessingError(cachedMessageId, err) {
    let error = {};

    if (err instanceof Meteor.Error) {
        if (err.error === 'ctn_buf_msg_capacity_exceeded' || err.error === 'ctn_cach_msg_not_fit_one_chunk') {
            error.code = 400;
            error.message = 'Message too large for reading at once';
        }
        else {
            error.code = 500;
            error.message = 'Internal server error';
        }
    }
    else {
        error.code = 500;
        error.message = 'Internal server error';
    }

    if (error.code === 500) {
        // Log error
        Catenis.logger.ERROR('Error processing cached message (cachedMessageId: %s).', cachedMessageId, err);
    }

    return error;
}


// Module code
//

// Lock function class
Object.freeze(CachedMessage);
