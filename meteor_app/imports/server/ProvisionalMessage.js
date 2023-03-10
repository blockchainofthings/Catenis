/**
 * Created by claudio on 2019-02-19.
 */

//console.log('[ProvisionalMessage.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import util from 'util';
// Third-party node modules
import config from 'config';
import moment from 'moment';
import Future from 'fibers/future';
// Meteor packages
import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { ProvisionalMessageReadable } from './ProvisionalMessageReadable';
import { MessageChunk } from './MessageChunk';

// Config entries
const provisionalMsgConfig = config.get('provisionalMessage');

// Configuration settings
const cfgSettings = {
    timeContinueMsg: provisionalMsgConfig.get('timeContinueMsg'),
    timeKeepIncompleteMsg: provisionalMsgConfig.get('timeKeepIncompleteMsg'),
    timeKeepProcessedMsg: provisionalMsgConfig.get('timeKeepProcessedMsg'),
    purgeOldMessagesInterval: provisionalMsgConfig.get('purgeOldMessagesInterval')
};

let purgeOldMessagesIntervalHandle;


// Definition of function classes
//

// ProvisionalMessage function class
//
//  Constructor arguments:
//    docProvisionalMessage [Object] - ProvisionalMessage database doc/rec
//    loadAllMessageChunks [Boolean] - Indicates whether all message chunks already recorded for this message
//                                      should be loaded. Otherwise, only the last chunk shall be loaded
//
// NOTE: make sure that objects of this function class are instantiated and used (their methods
//  called) from code executed from the MessageChunk.dbCS critical section object
export function ProvisionalMessage(docProvisionalMessage, loadAllMessageChunks = false) {
    this.doc_id = docProvisionalMessage._id;
    this.provisionalMessageId = docProvisionalMessage.provisionalMessageId;
    this.deviceId = docProvisionalMessage.deviceId;
    this.action = docProvisionalMessage.action;
    this.createdDate = docProvisionalMessage.createdDate;

    if (docProvisionalMessage.progress) {
        this.bytesProcessed = docProvisionalMessage.progress.bytesProcessed;
        this.progressDone = docProvisionalMessage.progress.done;

        if (this.progressDone) {
            this.progressSucceeded = docProvisionalMessage.progress.success;
            this.progressFinishDate = docProvisionalMessage.progress.finishDate;

            if (this.progressSucceeded) {
                this.messageId = docProvisionalMessage.messageId;
            }
            else {
                this.progressErrorCode = docProvisionalMessage.progress.error.code;
                this.progressErrorMessage = docProvisionalMessage.progress.error.message;
            }
        }
    }

    this.refMoment = moment();

    loadMessageChunks.call(this, !loadAllMessageChunks);
}


// Public ProvisionalMessage object methods
//

ProvisionalMessage.prototype.isMessageComplete = function () {
    return this.lastMessageChunk && this.lastMessageChunk.isFinal;
};

ProvisionalMessage.prototype.acceptNewMessageChunk = function (continuationToken) {
    return !this.lastMessageChunk || (!this.lastMessageChunk.isFinal && this.lastMessageChunk.messageChunkId === continuationToken && this.refMoment.diff(this.lastMessageChunk.createdDate, 'seconds', true) <= cfgSettings.timeContinueMsg);
};

ProvisionalMessage.prototype.nextMessageChunkOrder = function () {
    return !this.lastMessageChunk ? 1 : this.lastMessageChunk.order + 1;
};

ProvisionalMessage.prototype.getContinuationToken = function () {
    if (this.lastMessageChunk) {
        return this.lastMessageChunk.messageChunkId;
    }
};

ProvisionalMessage.prototype.getReadableStream = function () {
    if (this.isMessageComplete()) {
        return new ProvisionalMessageReadable(this);
    }
};

ProvisionalMessage.prototype.recordNewMessageChunk = function (continuationToken, data, isFinal) {
    if (!this.acceptNewMessageChunk(continuationToken)) {
        // Provisional message does not accept a new message chunk. Identify reason
        //  then log and throw exception
        let errMsg = 'Cannot record message chunk to provisional message';
        let errCode;

        if (this.lastMessageChunk.isFinal) {
            errMsg += '; message already complete';
            errCode = 'ctn_prov_msg_already_complete';
        }
        else if (this.lastMessageChunk.messageChunkId !== continuationToken) {
            errMsg += '; unexpected continuation token';
            errCode = 'ctn_prov_msg_invalid_cont_token';
        }
        else {
            errMsg += '; message expired';
            errCode = 'ctn_prov_msg_expired';
        }

        Catenis.logger.ERROR(errMsg, {
            provisionalMessage: this,
            continuationToken: continuationToken
        });
        throw new Meteor.Error(errCode, errMsg);
    }

    // Record new message chunk and add it to local list
    this.messageChunks.push(MessageChunk.createProvisionalMessageChunk(this.doc_id, data, isFinal, this.nextMessageChunkOrder()));
    resetLastMessageChunk.call(this);
};

ProvisionalMessage.prototype.finalizeMessage = function (continuationToken) {
    if (!this.lastMessageChunk || !this.acceptNewMessageChunk(continuationToken)) {
        // Provisional message cannot be finalized. Identify reason
        //  then log and throw exception
        let errMsg = 'Provisional message cannot be finalized';
        let errCode;

        if (!this.lastMessageChunk) {
            errMsg += '; message has no contents';
            errCode = 'ctn_prov_msg_no_contents';
        }
        if (this.lastMessageChunk.isFinal) {
            errMsg += '; message already complete';
            errCode = 'ctn_prov_msg_already_complete';
        }
        else if (this.lastMessageChunk.messageChunkId !== continuationToken) {
            errMsg += '; unexpected continuation token';
            errCode = 'ctn_prov_msg_invalid_cont_token';
        }
        else {
            errMsg += '; message expired';
            errCode = 'ctn_prov_msg_expired';
        }

        Catenis.logger.ERROR(errMsg, {
            provisionalMessage: this,
            continuationToken: continuationToken
        });
        throw new Meteor.Error(errCode, errMsg);
    }

    this.lastMessageChunk.setFinal();
};

ProvisionalMessage.prototype.getMessageProgress = function () {
    if (this.bytesProcessed !== undefined) {
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

        const msgProgress = {
            action: this.action,
            progress: progress
        };

        if (this.progressDone && this.progressSucceeded) {
            msgProgress.result = {
                messageId: this.messageId
            }
        }

        return msgProgress;
    }
    else {
        // Progress not available. Throw exception
        Catenis.logger.DEBUG('Cannot retrieve processing progress of provisional message (doc_id: %s); progress not available', this.doc_id);
        throw new Meteor.Error('ctn_prov_msg_progress_not_available', 'Cannot retrieve processing progress of provisional message; progress not available');
    }
};


// Module functions used to simulate private ProvisionalMessage object methods
//  NOTE: these functions need to be bound to a ProvisionalMessage object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

function loadMessageChunks(lastOnly = true) {
    this.messageChunks = MessageChunk.getMessageChunksForProvisionalMessage(this.doc_id, lastOnly);
    resetLastMessageChunk.call(this);
}

function resetLastMessageChunk() {
    let numChunks;

    this.lastMessageChunk = (numChunks = this.messageChunks.length) > 0 ? this.messageChunks[numChunks - 1] : undefined;
}


// ProvisionalMessage function class (public) methods
//

ProvisionalMessage.initialize = function () {
    Catenis.logger.TRACE('ProvisionalMessage initialization');

    // Execute process to purge old provisional messages
    purgeOldProvisionalMessages();
    Catenis.logger.TRACE('Setting recurring timer to purge old provisional messages');
    purgeOldMessagesIntervalHandle = Meteor.setInterval(purgeOldProvisionalMessages, cfgSettings.purgeOldMessagesInterval);
};

// NOTE: this method should be called from code executed from the MessageChunk.dbCS critical section object
ProvisionalMessage.createProvisionalMessage = function (deviceId, action) {
    let provisionalMessage_id;

    try {
        provisionalMessage_id = Catenis.db.collection.ProvisionalMessage.insert({
            provisionalMessageId: newProvisionalMessageId(),
            deviceId: deviceId,
            action: action,
            createdDate: new Date()
        });
    }
    catch (err) {
        // Error creating new provisional message. Log error and throw exception
        Catenis.logger.ERROR('Error trying to create new provisional message for device (deviceId: %s).', deviceId, err);
        throw new Meteor.Error('ctn_prov_msg_insert_error', util.format('Error trying to create new provisional message for device (deviceId: %s).', deviceId), err.stack);
    }

    return new ProvisionalMessage(Catenis.db.collection.ProvisionalMessage.findOne(provisionalMessage_id));
};

// NOTE: this method should be called from code executed from the MessageChunk.dbCS critical section object
ProvisionalMessage.getProvisionalMessageByMessageId = function (provisionalMessageId, deviceId, logError = true) {
    const docProvisionalMessage = Catenis.db.collection.ProvisionalMessage.findOne({provisionalMessageId: provisionalMessageId});

    if (!docProvisionalMessage) {
        // No provisional message found containing the given message ID.
        //  Log error and throw exception
        if (logError) {
            Catenis.logger.ERROR('Could not find provisional message with given message ID (provisionalMessageId: %s)', provisionalMessageId);
        }

        throw new Meteor.Error('ctn_prov_msg_not_found', util.format('Could not find provisional message with given message ID (provisionalMessageId: %s)', provisionalMessageId));
    }

    // Make sure that provisional message belongs to same device if necessary
    if (deviceId && docProvisionalMessage.deviceId !== deviceId) {
        // Provisional message belongs to a different device. Log error and throw exception
        if (logError) {
            Catenis.logger.ERROR('Trying to record message chunk to a provisional message that belongs to a different device', {
                provisionalMessageDeviceId: docProvisionalMessage.deviceId,
                messageChunkDeviceId: deviceId
            });
        }

        throw new Meteor.Error('ctn_prov_msg_wrong_device', 'Trying to record message chunk to a provisional message that belongs to a different device');
    }

    return new ProvisionalMessage(docProvisionalMessage);
};

// NOTE: this method should be called from code executed from the MessageChunk.dbCS critical section object
ProvisionalMessage.getProvisionalMessageByMessageChunkId = function (messageChunkId, loadAllMessageChunks = false) {
    let provisionalMessage_id;

    try {
        provisionalMessage_id = MessageChunk.getEphemeralMsgRefFOfProvisionalMessageChunk(messageChunkId);
    }
    catch (err) {
        // No provisional message found containing a message chunk with the given ID.
        //  Log error and throw exception
        Catenis.logger.ERROR('Error retrieving provisional message associated with given message chunk (messageChunkId: %s).', messageChunkId, err);
        throw new Meteor.Error('ctn_prov_msg_not_found', util.format('Could not retrieve provisional message associated with given message chunk (messageChunkId: %s).', messageChunkId));
    }

    return new ProvisionalMessage(Catenis.db.collection.ProvisionalMessage.findOne(provisionalMessage_id), loadAllMessageChunks);
};

// NOTE: this method should be called from code executed from the MessageChunk.dbCS critical section object
ProvisionalMessage.recordNewMessageChunk = function (deviceId, action, continuationToken, data, isFinal) {
    let provisionalMessage;

    if (!continuationToken) {
        // Assign message chunk to a new provisional message
        provisionalMessage = ProvisionalMessage.createProvisionalMessage(deviceId, action);
    }
    else {
        provisionalMessage = ProvisionalMessage.getProvisionalMessageByMessageChunkId(continuationToken);

        // Make sure that provisional message belongs to same device
        if (provisionalMessage.deviceId !== deviceId) {
            // Provisional message belongs to a different device. Log error and throw exception
            Catenis.logger.ERROR('Trying to record message chunk to a provisional message that belongs to a different device', {
                provisionalMessageDeviceId: provisionalMessage.deviceId,
                messageChunkDeviceId: deviceId
            });
            throw new Meteor.Error('ctn_prov_msg_wrong_device', 'Trying to record message chunk to a provisional message that belongs to a different device');
        }
    }

    provisionalMessage.recordNewMessageChunk(continuationToken, data, isFinal);

    return provisionalMessage;
};

ProvisionalMessage.updateProcessingProgress = function (provisionalMessageId, bytesRead) {
    try {
        const docProvisionalMessage = Catenis.db.collection.ProvisionalMessage.findOne({
            provisionalMessageId: provisionalMessageId
        }, {
            fields: {
                _id: 1,
                progress: 1
            }
        });

        if (docProvisionalMessage) {
            let modifier;

            if (!docProvisionalMessage.progress) {
                modifier = {
                    $set: {
                        progress: {
                            bytesProcessed: bytesRead,
                            done: false
                        }
                    }
                }
            }
            else {
                if (!docProvisionalMessage.progress.done) {
                    modifier = {
                        $set: {
                            'progress.bytesProcessed': docProvisionalMessage.progress.bytesProcessed + bytesRead
                        }
                    }
                }
                else {
                    // Cannot update processing progress of provisional message; processing already finalized.
                    //  Throw exception
                    // noinspection ExceptionCaughtLocallyJS
                    throw new Error(util.format('Cannot update processing progress of provisional message (provisionalMessageId: %s); processing already finalized', provisionalMessageId));
                }
            }

            if (modifier) {
                Catenis.db.collection.ProvisionalMessage.update(docProvisionalMessage._id, modifier);
            }
        }
        else {
            // Provisional message not found. Throw exception
            // noinspection ExceptionCaughtLocallyJS
            throw new Error(util.format('No provisional message found with the given ID (provisionalMessageId: %s)', provisionalMessageId));
        }
    }
    catch (err) {
        // Error updating provisional message processing progress. Log error
        Catenis.logger.ERROR('Error updating provisional message (provisionalMessageId: %s) processing progress.', provisionalMessageId, err);
    }
};

ProvisionalMessage.finalizeProcessing = function (provisionalMessageId, msgAction, error, messageId) {
    try {
        const docProvisionalMessage = Catenis.db.collection.ProvisionalMessage.findOne({
            provisionalMessageId: provisionalMessageId
        }, {
            fields: {
                _id: 1,
                progress: 1
            }
        });

        if (docProvisionalMessage) {
            if (!docProvisionalMessage.progress.done) {
                const set = {
                    'progress.done': true
                };

                if (error) {
                    set['progress.success'] = false;
                    set['progress.error'] = conformProcessingError(provisionalMessageId, msgAction, error);
                }
                else {
                    set['progress.success'] = true;

                    if (messageId) {
                        set.messageId = messageId;
                    }
                }

                set['progress.finishDate'] = new Date();

                Catenis.db.collection.ProvisionalMessage.update(docProvisionalMessage._id, {
                    $set: set
                });
            }
            else {
                // Cannot update processing progress of provisional message; processing already finalized.
                //  Throw exception
                // noinspection ExceptionCaughtLocallyJS
                throw new Error(util.format('Cannot update processing progress of provisional message (provisionalMessageId: %s); processing already finalized', provisionalMessageId));
            }
        }
        else {
            // Provisional message not found. Throw exception
            // noinspection ExceptionCaughtLocallyJS
            throw new Error(util.format('No provisional message found with the given ID (provisionalMessageId: %s)', provisionalMessageId));
        }
    }
    catch (err) {
        // Error finalizing provisional message processing. Log error
        Catenis.logger.ERROR('Error finalizing provisional message (provisionalMessageId: %s) processing.', provisionalMessageId, err);
    }
};


// ProvisionalMessage function class (public) properties
//

/*ProvisionalMessage.prop = {};*/


// Definition of module (private) functions
//

function purgeOldProvisionalMessages() {
    Catenis.logger.TRACE('Executing process to purge old Provisional Message database docs/recs');
    async function getOldProvisionalMessagesToRemove(refMoment) {
        const idDocsToRemove = new Set();

        // Identify incomplete provisional messages that should be removed
        const earliestDateIncompleteMessages = moment(refMoment).subtract(cfgSettings.timeKeepIncompleteMsg, 'seconds').toDate();

        // noinspection JSUnresolvedFunction
        await Catenis.db.mongoCollection.MessageChunk.aggregate([{
            $match: {
                type: MessageChunk.type.provisional.name
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

        // Include provisional messages with no message chunks
        // noinspection JSUnresolvedFunction
        await Catenis.db.mongoCollection.ProvisionalMessage.aggregate([{
            $match: {
                createdDate: {
                    $lt: earliestDateIncompleteMessages
                }
            }
        }, {
            $lookup: {
                from: 'MessageChunk',
                let: {
                    provisionalMessage_id: "$_id"
                },
                pipeline: [{
                    $match: {
                        $expr: {
                            $eq: ['$ephemeralMessage_id', '$$provisionalMessage_id']
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

        // Identify processed provisional messages that should be removed
        const earliestDateProcessedMessages = moment(refMoment).subtract(cfgSettings.timeKeepProcessedMsg, 'seconds').toDate();

        Catenis.db.collection.ProvisionalMessage.find({
            'progress.done': true,
            'progress.finishDate': {
                $lt: earliestDateProcessedMessages
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
            const idProvisionalMessagesToRemove = Future.fromPromise(getOldProvisionalMessagesToRemove(refMoment)).wait();

            if (idProvisionalMessagesToRemove.length > 0) {
                // Remove all message chunks associated with provisional messages to be removed
                const numMessageChunksRemoved = Catenis.db.collection.MessageChunk.remove({
                    ephemeralMessage_id: {
                        $in: idProvisionalMessagesToRemove
                    }
                });
                Catenis.logger.DEBUG('Number of MessageChunk docs/recs associated with old provisional messages that have been removed: %d', numMessageChunksRemoved);

                // Now remove the provisional messages themselves
                const numProvisionalMessagesRemoved = Catenis.db.collection.ProvisionalMessage.remove({
                    _id: {
                        $in: idProvisionalMessagesToRemove
                    }
                });
                Catenis.logger.DEBUG('Number of old ProvisionalMessage doc/recs that have been removed: %d', numProvisionalMessagesRemoved);
            }
        });
    }
    catch (err) {
        Catenis.logger.ERROR('Error while executing process to purge old Provisional Message database docs/recs.', err);
    }
}

function newProvisionalMessageId(checkExistence = true) {
    let id = 'p' + Random.id(19);

    if (checkExistence) {
        while (Catenis.db.collection.ProvisionalMessage.findOne({provisionalMessageId: id}, {fields: {_id: 1}})) {
            Catenis.logger.DEBUG('Newly generated Provisional Message ID (%s) already exists. Trying again.', id);

            id = 'p' + Random.id(19);
        }
    }

    return id;
}

function conformProcessingError(provisionalMessageId, msgAction, err) {
    let error = {};

    if (err instanceof Meteor.Error) {
        if (err.error === 'ctn_device_low_service_acc_balance') {
            error.code = 400;
            error.message = util.format('Not enough credits to pay for %s message service', msgAction);
        }
        else if (err.error === 'ctn_msg_data_too_long') {
            error.code = 400;
            error.message = 'Message too long to be embedded';
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
        Catenis.logger.ERROR('Error processing provisional message (provisionalMessageId: %s).', provisionalMessageId, err);
    }

    return error;
}


// Module code
//

// Lock function class
Object.freeze(ProvisionalMessage);
