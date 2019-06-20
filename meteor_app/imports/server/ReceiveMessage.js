/**
 * Created by Claudio on 2017-07-17.
 */

//console.log('[ReceiveMessage.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import util from 'util';
// Third-party node modules
//import config from 'config';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { TransactionMonitor } from './TransactionMonitor';
import { Device } from './Device';
import { Transaction } from './Transaction';
import { SendMessageTransaction } from './SendMessageTransaction';
import { ReadConfirmation } from './ReadConfirmation';
import { Message } from './Message';

// Config entries
/*const config_entryConfig = config.get('config_entry');

// Configuration settings
const cfgSettings = {
    property: config_entryConfig.get('property_name')
};*/


// Definition of function classes
//

// ReceiveMessage function class
export function ReceiveMessage() {
}


// Public ReceiveMessage object methods
//

/*ReceiveMessage.prototype.pub_func = function () {
};*/


// Module functions used to simulate private ReceiveMessage object methods
//  NOTE: these functions need to be bound to a ReceiveMessage object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// ReceiveMessage function class (public) methods
//

ReceiveMessage.initialize = function () {
    Catenis.logger.TRACE('ReceiveMessage initialization');
    // Set up handler for event indicating that new send message transaction has been received
    TransactionMonitor.addEventHandler(TransactionMonitor.notifyEvent.send_message_tx_rcvd.name, processReceivedMessage);
};


// ReceiveMessage function class (public) properties
//

/*ReceiveMessage.prop = {};*/


// Definition of module (private) functions
//

function processReceivedMessage(data) {
    Catenis.logger.TRACE('Received notification of newly received send message transaction', data);
    try {
        // Get target device and make sure that it is active
        const targetDevice = Device.getDeviceByDeviceId(data.targetDeviceId);
        let blockMessage = false;

        if (targetDevice.status !== Device.status.active.name) {
            // Indented receiving (target) device is not active.
            //  Log warning condition and mark message to be blocked
            Catenis.logger.WARN('Device to which received message had been sent is not active. Message will be blocked', data);
            blockMessage = true;
        }

        const originDevice = Device.getDeviceByDeviceId(data.originDeviceId);

        if (!targetDevice.shouldReceiveMsgFrom(originDevice)) {
            // Block message if permission settings do allow to receive message from origin device
            blockMessage = true;
        }

        // Get send message transaction and received message onto local database
        const sendMsgTransact = SendMessageTransaction.checkTransaction(Transaction.fromTxid(data.txid), null);
        const message = saveReceivedMessage(sendMsgTransact, blockMessage);

        if (blockMessage) {
            if (message.readConfirmationEnabled) {
                // Spend transaction's read confirmation output to mark it as been blocked
                Catenis.readConfirm.confirmMessageRead(sendMsgTransact, ReadConfirmation.confirmationType.spendNull);
            }
        }
        else {
            if (targetDevice.shouldBeNotifiedOfNewMessageFrom(originDevice)) {
                // Send notification to target device that new message has been received
                targetDevice.notifyNewMessageReceived(message, originDevice);
            }
        }
    }
    catch (err) {
        // Error while processing received message. Log error condition
        Catenis.logger.ERROR(util.format('Error while processing received message (txid: %s).', data.txid), err);
    }
}

// Method used to record received message
//
//  Arguments:
//    sendMsgTransact: [Object] - instance of SendMessageTransaction
//    blockMessage: [Boolean] - indicates whether message should be blocked
//
//  Return:
//    message: [Object] - instance of corresponding Message object
function saveReceivedMessage(sendMsgTransact, blockMessage) {
    // Get ReceivedTransaction collection doc associated with the received message
    //  and check if it is a local or remote message
    const docRcvdTx = Catenis.db.collection.ReceivedTransaction.findOne({
        txid: sendMsgTransact.transact.txid
    }, {
        fields: {
            receivedDate: 1,
            sentTransaction_id: 1
        }
    });

    let message;

    if (docRcvdTx.sentTransaction_id !== undefined) {
        // It's a local message. Just instantiate it and set it as received
        message = Message.getMessageByTxid(sendMsgTransact.transact.txid);
        message.setReceived(!blockMessage ? docRcvdTx.receivedDate : undefined);
    }
    else {
        // It' a remote message. Create new message
        message = Message.createRemoteMessage(sendMsgTransact, !blockMessage ? docRcvdTx.receivedDate : undefined);
    }

    return message;
}

// Module code
//

// Lock function class
Object.freeze(ReceiveMessage);
