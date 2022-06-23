/**
 * Created by claudio on 2019-02-26.
 */

//console.log('[MessageChunk.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import util from 'util';
// Third-party node modules
//import config from 'config';
// Meteor packages
import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { CriticalSection } from './CriticalSection';

// Config entries
/*const config_entryConfig = config.get('config_entry');

// Configuration settings
const cfgSettings = {
    property: config_entryConfig.get('property_name')
};*/


// Definition of function classes
//

// MessageChunk function class
//
//  Constructor arguments:
//    docMessageChunk [Object] - MessageChunk database doc/rec
//
// NOTE: make sure that objects of this function class are instantiated and from code executed
//  from the MessageChunk.dbCS critical section object
export function MessageChunk(docMessageChunk) {
    this.doc_id = docMessageChunk._id;
    this.messageChunkId = docMessageChunk.messageChunkId;
    this.type = docMessageChunk.type;
    this.ephemeralMessage_id = docMessageChunk.ephemeralMessage_id;
    this.order = docMessageChunk.order;
    this.isFinal = docMessageChunk.isFinal;
    this.createdDate = docMessageChunk.createdDate;

    if (docMessageChunk.data) {
        // Convert retrieved TypedArray (Uint8Array) data into a Buffer object.
        //  NOTE: do it this way so the new Buffer object shares the same memory wih the returned TypedArray
        this.data = Buffer.from(docMessageChunk.data.buffer);
    }
}


// Public MessageChunk object methods
//

// NOTE: this method DOES NOT need to be called from code executed from the MessageChunk.dbCS critical section object
MessageChunk.prototype.getData = function (storeId = false) {
    if (this.data) {
        return this.data;
    }

    let docMessageChunk;

    try {
        docMessageChunk = Catenis.db.collection.MessageChunk.findOne(this.doc_id, {
            fields: {
                data: 1
            }
        });
    }
    catch (err) {
        Catenis.logger.ERROR(util.format('Error retrieving message chunk (doc_id: %s) data.', this.doc_id), err);
        throw new Error(util.format('Error retrieving message chunk (doc_id: %s) data.', this.doc_id));
    }

    if (!docMessageChunk) {
        Catenis.logger.ERROR(util.format('No message chunk found with the given doc/rec ID (doc_id: %s)', this.doc_id));
        throw new Error(util.format('No message chunk found with the given doc/rec ID (doc_id: %s)', this.doc_id));
    }

    // Convert retrieved TypedArray (Uint8Array) data into a Buffer object.
    //  NOTE: do it this way so the new Buffer object shares the same memory wih the returned TypedArray
    const data = Buffer.from(docMessageChunk.data.buffer);

    if (storeId) {
        this.data = data;
    }

    return data;
};

MessageChunk.prototype.setFinal = function () {
    if (!this.isFinal) {
        try {
            Catenis.db.collection.MessageChunk.update(this.doc_id, {
                $set: {
                    isFinal: true
                }
            });

            this.isFinal = true;
        }
        catch (err) {
            // Error setting message chunk as final. Log error and throw exception
            Catenis.logger.ERROR('Error setting message chunk (doc_id: %s) as final.', this.doc_id, err);
            throw new Error(util.format('Error setting message chunk (doc_id: %s) as final', this.doc_id));
        }
    }
};


// Module functions used to simulate private MessageChunk object methods
//  NOTE: these functions need to be bound to a MessageChunk object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// MessageChunk function class (public) methods
//

// NOTE: this method should be called from code executed from the MessageChunk.dbCS critical section object
MessageChunk.createProvisionalMessageChunk = function (provisionalMessage_id, data, isFinal = false, order, loadData = false) {
    try {
        if (!order) {
            // Determine the next chunk order for the specified provisional message
            let docLatestMessageChunk;

            try {
                Catenis.db.collection.MessageChunk.findOne({
                    ephemeralMessage_id: provisionalMessage_id
                }, {
                    sort: {
                        order: -1
                    },
                    fields: {
                        order: 1
                    }
                });
            }
            catch (err) {
                // noinspection ExceptionCaughtLocallyJS
                throw new Error('Error retrieving latest message chunk of provisional message to determine next order: ' + err.toString());
            }

            order = docLatestMessageChunk ? docLatestMessageChunk.order + 1 : 1;
        }

        const doc_id = Catenis.db.collection.MessageChunk.insert({
            messageChunkId: newMessageChunkId(),
            type: MessageChunk.type.provisional.name,
            ephemeralMessage_id: provisionalMessage_id,
            order: order,
            isFinal: isFinal,
            data: new Uint8Array(data), // NOTE: convert Buffer object into a TypedArray so the data is stored as a binary stream
            createdDate: new Date()
        });

        // Retrieve newly created doc/rec
        const findOpts = {};

        if (!loadData) {
            findOpts.fields = {
                data: 0
            }
        }

        return new MessageChunk(Catenis.db.collection.MessageChunk.findOne(doc_id, findOpts));
    }
    catch (err) {
        // Error creating new message chunk. Log error and throw exception
        Catenis.logger.ERROR(util.format('Error trying to create new message chunk for provisional message (doc_id: %s).', provisionalMessage_id), err);
        throw new Meteor.Error('ctn__msg_chunk_insert_error', util.format('Error trying to create new message chunk for provisional message (doc_id: %s).', provisionalMessage_id), err.stack);
    }
};

// NOTE: this method should be called from code executed from the MessageChunk.dbCS critical section object
MessageChunk.createCachedMessageChunk = function (cachedMessage_id, data, isFinal = false, order, loadData = false) {
    try {
        if (!order) {
            // Determine the next chunk order for the specified cached message
            let docLatestMessageChunk;

            try {
                Catenis.db.collection.MessageChunk.findOne({
                    ephemeralMessage_id: cachedMessage_id
                }, {
                    sort: {
                        order: -1
                    },
                    fields: {
                        order: 1
                    }
                });
            }
            catch (err) {
                // noinspection ExceptionCaughtLocallyJS
                throw new Error('Error retrieving latest message chunk of cached message to determine next order: ' + err.toString());
            }

            order = docLatestMessageChunk ? docLatestMessageChunk.order + 1 : 1;
        }

        const doc_id = Catenis.db.collection.MessageChunk.insert({
            messageChunkId: newMessageChunkId(),
            type: MessageChunk.type.cached.name,
            ephemeralMessage_id: cachedMessage_id,
            order: order,
            isFinal: isFinal,
            data: new Uint8Array(data), // NOTE: convert Buffer object into a TypedArray so the data is stored as a binary stream
            createdDate: new Date()
        });

        // Retrieve newly created doc/rec
        const findOpts = {};

        if (!loadData) {
            findOpts.fields = {
                data: 0
            }
        }

        return new MessageChunk(Catenis.db.collection.MessageChunk.findOne(doc_id, findOpts));
    }
    catch (err) {
        // Error creating new message chunk. Log error and throw exception
        Catenis.logger.ERROR(util.format('Error trying to create new message chunk for cached message (doc_id: %s).', cachedMessage_id), err);
        throw new Meteor.Error('ctn__msg_chunk_insert_error', util.format('Error trying to create new message chunk for cached message (doc_id: %s).', cachedMessage_id), err.stack);
    }
};

// NOTE: this method should be called from code executed from the MessageChunk.dbCS critical section object
MessageChunk.getMessageChunksForProvisionalMessage = function (provisionalMessage_id, lastOnly = false, loadData = false) {
    const messageChunks = [];

    const findOpts = lastOnly ? {
        sort: {
            order: -1
        },
        limit: 1
    } : {
        sort: {
            order: 1
        }
    };

    if (!loadData) {
        findOpts.fields = {
            data: 0
        };
    }

    try {
        Catenis.db.collection.MessageChunk.find({
            type: MessageChunk.type.provisional.name,
            ephemeralMessage_id: provisionalMessage_id
        }, findOpts)
        .fetch()
        .forEach((doc) => {
            messageChunks.push(new MessageChunk(doc));
        });
    }
    catch (err) {
        // Error retrieving message chunks of provisional message. Log error and throw exception
        Catenis.logger.ERROR(util.format('Error retrieving message chunks of provisional message (doc_id: %s).', provisionalMessage_id), err);
        throw new Meteor.Error('ctn_msg_chunk_load_error', util.format('Error retrieving message chunks of provisional message (doc_id: %s).', provisionalMessage_id));
    }

    return messageChunks;
};

// NOTE: this method should be called from code executed from the MessageChunk.dbCS critical section object
MessageChunk.getMessageChunkForCachedMessage = function (cachedMessage_id, order, loadData = false) {
    const findOpts = loadData ? {fields: {data: 0}} : undefined;

    try {
        const docMessageChunk = Catenis.db.collection.MessageChunk.findOne({
            type: MessageChunk.type.cached.name,
            ephemeralMessage_id: cachedMessage_id,
            order: order
        }, findOpts);

        if (docMessageChunk) {
            return new MessageChunk(docMessageChunk);
        }
    }
    catch (err) {
        // Error retrieving message chunk of cached message. Log error and throw exception
        Catenis.logger.ERROR(util.format('Error retrieving message chunk (order: %d) of cached message (doc_id: %s).', order, cachedMessage_id), err);
        throw new Meteor.Error('ctn_msg_chunk_load_error', util.format('Error retrieving message chunk (order: %d) of cached message (doc_id: %s).', order, cachedMessage_id));
    }
};

// NOTE: this method should be called from code executed from the MessageChunk.dbCS critical section object
MessageChunk.getEphemeralMsgRefFOfProvisionalMessageChunk = function (messageChunkId) {
    const docMessageChunk = Catenis.db.collection.MessageChunk.findOne({
        messageChunkId: messageChunkId,
        type: MessageChunk.type.provisional.name
    } , {
        fields: {
            ephemeralMessage_id: 1
        }
    });

    if (!docMessageChunk) {
        // No provisional message chunk found. Log error and throw exception
        Catenis.logger.ERROR('No provisional message chunk found with the given message chunk ID (%s)', messageChunkId);
        throw new Error(util.format('No provisional message chunk found with the given message chunk ID (%s)', messageChunkId));
    }

    return docMessageChunk.ephemeralMessage_id;
};

// NOTE: this method should be called from code executed from the MessageChunk.dbCS critical section object
MessageChunk.getEphemeralMsgRefFOfCachedMessageChunk = function (messageChunkId) {
    const docMessageChunk = Catenis.db.collection.MessageChunk.findOne({
        messageChunkId: messageChunkId,
        type: MessageChunk.type.cached.name
    } , {
        fields: {
            ephemeralMessage_id: 1
        }
    });

    if (!docMessageChunk) {
        // No cached message chunk found. Log error and throw exception
        Catenis.logger.ERROR('No cached message chunk found with the given message chunk ID (%s)', messageChunkId);
        throw new Error(util.format('No cached message chunk found with the given message chunk ID (%s)', messageChunkId));
    }

    return docMessageChunk.ephemeralMessage_id;
};


// MessageChunk function class (public) properties
//

// Critical section object to avoid concurrent access to database collections related to message chunk processing (ProvisionalMessage,
//  CachedMessage and MessageChunk)
MessageChunk.dbCS = new CriticalSection();

MessageChunk.type = Object.freeze({
    'provisional': Object.freeze({
        name: 'provisional',
        description: 'Message chunk associated with a provisional message used for recording (large) messages to the blockchain in chunks'
    }),
    'cached': Object.freeze({
        name: 'cached',
        description: 'Message chunk associated with a cached message used for reading (large) messages from the blockchain in chunks'
    })
});


// Definition of module (private) functions
//

function newMessageChunkId(checkExistence = true) {
    let id = 'k' + Random.id(19);

    if (checkExistence) {
        while (Catenis.db.collection.MessageChunk.findOne({messageChunkId: id}, {fields: {_id: 1}})) {
            Catenis.logger.DEBUG('Newly generated Message Chunk ID (%s) already exists. Trying again.', id);

            id = 'k' + Random.id(19);
        }
    }

    return id;
}


// Module code
//

// Lock function class
Object.freeze(MessageChunk);
