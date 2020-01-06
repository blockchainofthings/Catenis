/**
 * Created by claudio on 2019-12-13
 */

//console.log('[OffChainMsgContent.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import Future from 'fibers/future';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { CatenisMessage } from './CatenisMessage';
import util from "util";


// Definition of classes
//

// OffChainMsgContent class
export class OffChainMsgContent {
    // Arguments:
    //   messageReadable [Object(MessageReadable)] Stream used to read message's contents
    //   storageProvider [Object] (optional, default: CatenisMessage.defaultStorageProvider) The type of external storage to be used to store the message content. One of CatenisMessage.storageProvider
    //
    constructor(messageReadable, storageProvider) {
        if (messageReadable) {
            this.messageReadable = messageReadable;
            this.storageProvider = storageProvider || CatenisMessage.defaultStorageProvider;

            // Prepare store message's contents to external storage

            // Monitor errors while reading message's contents
            const messageReadableErrorHandler = (err) => {
                // Error reading message's content. Abort processing and throw exception
                Catenis.logger.ERROR('Error reading off-chain message\'s contents while storing it to external storage.', err);

                messageReadable.destroy();
            };

            messageReadable.once('error', messageReadableErrorHandler);

            const msgStorage = CatenisMessage.getMessageStorageInstance(this.storageProvider);
            this.extMsgRef = msgStorage.store(messageReadable);

            // Stop monitoring errors
            messageReadable.removeListener('error', messageReadableErrorHandler);
        }
    }

    // Arguments
    //   msgEnv [Object(ctnOffChainLib.MessageEnvelope] Off-chain message envelope
    //   messageDuplex: [Object(MessageDuplex)] - Stream used to write retrieved off-chain message's contents
    //
    load(msgEnv, messageDuplex) {
        this.storageProvider = msgEnv.stoProvider;
        this.extMsgRef = msgEnv.msgRef;

        // Prepare to retrieve message's contents

        if (!msgEnv.isMessageEncrypted) {
            // Make sure that message's contents shall not be decrypted
            messageDuplex.unsetDecryption();
        }

        // Retrieve message's contents from external storage
        const fut = new Future();

        // Monitor errors while writing/piping off-chain message's contents
        const messageDuplexErrorHandler = (err) => {
            // Error writing message's contents. Abort processing and throw exception

            // Determine which error should actually be reported
            let error;

            if ((err instanceof Meteor.Error) && (err.error === 'ctn_buf_msg_capacity_exceeded' || err.error === 'ctn_cach_msg_not_fit_one_chunk')) {
                // Errors indicating that message is too large to be read at once.
                //  So report specific error
                error = err;
            }
            else {
                // Report generic write error
                Catenis.logger.ERROR('Error writing off-chain message\'s contents while retrieving it from external storage.', err);
                error = new Meteor.Error('ctn_oc_msg_cont_write_error', 'Error writing off-chain message\'s contents while retrieving it from external storage');
            }

            messageDuplex.destroy();
            messageDuplex.removeListener('finish', messageDuplexFinishHandler);

            if (!fut.isResolved()) {
                fut.throw(error);
            }
        };

        messageDuplex.once('error', messageDuplexErrorHandler);

        // Monitor end of writing of message's contents
        const messageDuplexFinishHandler = () => {
            if (!fut.isResolved()) {
                // Just continue processing
                fut.return();
            }
        };

        messageDuplex.on('finish', messageDuplexFinishHandler);

        // Read the message's contents from external storage
        const msgStorage = CatenisMessage.getMessageStorageInstance(this.storageProvider);

        // Get readable stream to retrieve message from external message storage...
        const msgStoreReadable = msgStorage.retrieveReadableStream(this.extMsgRef);

        msgStoreReadable.on('error', (err) => {
            // Error reading message contents from external message storage.
            //  Log error condition and throw exception
            Catenis.logger.ERROR('Error reading message contents from external message storage.', err);
            const error = new Meteor.Error('ctn_msg_storage_read_error', util.format('Error reading message contents from external message storage: %s', err.toString()));

            messageDuplex.destroy();
            messageDuplex.removeListener('finish', messageDuplexFinishHandler);

            if (!fut.isResolved()) {
                fut.throw(error);
            }
        });

        // ... and read contents of retrieved message into the message duplex stream
        this.messageReadable = msgStoreReadable.pipe(messageDuplex);

        // Wait until the whole message's contents is written before proceeding
        fut.wait();

        // Stop monitoring errors and end of writing
        messageDuplex.removeListener('finish', messageDuplexFinishHandler);
        messageDuplex.removeListener('error', messageDuplexErrorHandler);
    }
}


// Module functions used to simulate private OffChainMsgContent object methods
//  NOTE: these functions need to be bound to a OffChainMsgContent object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(OffChainMsgContent);
