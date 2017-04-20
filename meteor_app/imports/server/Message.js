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
//import config from 'config';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { LogMessageTransaction } from './LogMessageTransaction';
import { SendMessageTransaction } from './SendMessageTransaction';
import { CatenisMessage } from './CatenisMessage';

// Config entries
/*const config_entryConfig = config.get('config_entry');

// Configuration settingsconst cfgSettings = {
    property: config_entryConfig.get('property_name')
};*/


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

// Create a new Message and returns its messageId
//
//  Arguments:
//    msgTx: [Object] - instance of either LogMessageTransaction or SendMessageTransaction
Message.createMessage = function (msgTx) {
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
        action: action
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
        const storageProvider = msgTx.options.storageProvider != undefined ? msgTx.options.storageProvider : CatenisMessage.defaultStorageProvider;

        docMessage.externalStorage = {
            provider: storageProvider.name,
            reference: CatenisMessage.getMessageStorageClass(storageProvider).getNativeMsgRef(msgTx.extMsgRef)
        };
    }

    docMessage.createDate = new Date();

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

// Message function class (public) properties
//

Message.action = Object.freeze({
    log: 'log',
    send: 'send'
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


// Module code
//

// Lock function class
Object.freeze(Message);
