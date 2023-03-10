/**
 * Created by claudio on 2018/05/31.
 */

//console.log('[Ipfs2MessageStorage.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import util from 'util';
// Third-party node modules
import CID from 'cids';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { MessageStorage } from './MessageStorage';

// Definition of classes
//

// Ipfs2MessageStorage class
//
// Note: this implements an enhanced version of the IPFS external storage where the reference (ID) to the
//      stored contents (data) is interpreted as being a CID, which is the new format (based on IPLD) for
//      contents ID used by IPFS. Also, this version does not care to save the hash of the data itself to
//      validate it later (when the data is retrieved) because the CID is itself a (robust) hash of the data,
//      so saving the hash is just overkill and a waste of space/money (BTC).
//      This implementation should then replace the (old) IPFS external storage
export class Ipfs2MessageStorage extends MessageStorage {
    constructor () {
        super();
    }

    // Method used to store the message contents onto the external storage
    //
    //  Arguments:
    //    message: [Object(Readable)] // A readable stream from where the contents of the message to be stored should be read
    //
    //  Return: [Object] // Object of type Buffer containing the reference (a unique ID) to the stored message
    store(message) {
        try {
            // Save message onto IPFS and return its CID
            // noinspection JSUnresolvedVariable
            return Buffer.from(Catenis.ipfsClient.add(message).cid.bytes);
        }
        catch (err) {
            // Error storing message onto external message storage.
            //  Log error condition and throw exception
            Catenis.logger.ERROR('Error storing message onto Enhanced IPFS message storage.', err);
            throw new Meteor.Error('ctn_ipfs2_msg_store_error', util.format('Error storing message onto Enhanced IPFS message storage: %s', err.message), err.stack);
        }
    }

    // Method used to retrieve the message contents stored on the external storage
    //
    //  Arguments:
    //    msgRef: [Object] // Object of type Buffer containing the reference (a unique ID) to the stored message
    //                     //  (as returned by the 'store' method)
    //
    //  Return: [Object] // Object of type Buffer containing the retrieved message
    //
    //  NOTE: this method should be implemented in the derived class
    // noinspection JSUnusedLocalSymbols
    retrieve(msgRef) {
        try {
            // Retrieve and return (message) contents with the given CID from IPFS
            return Catenis.ipfsClient.cat(new CID(msgRef));
        }
        catch (err) {
            // Error retrieving message from external message storage.
            //  Log error condition and throw exception
            Catenis.logger.ERROR('Error retrieving message from Enhanced IPFS message storage.', err);
            throw new Meteor.Error('ctn_ipfs2_msg_retrieve_error', util.format('Error retrieving message from Enhanced IPFS message storage: %s', err.message), err.stack);
        }
    }

    // Method used to get readable stream to retrieve the message contents stored on the external storage
    //
    //  Arguments:
    //    msgRef: [Object] // Object of type Buffer containing the reference (a unique ID) to the stored message
    //                     //  (as returned by the 'store' method)
    //
    //  Return: [Object(Readable)] // A readable stream from where the contents of the retrieved message should be read
    retrieveReadableStream(msgRef) {
        try {
            // Return readable stream to retrieve (message) contents with the given CID from IPFS
            return Catenis.ipfsClient.catReadableStream(new CID(msgRef));
        }
        catch (err) {
            // Error getting readable stream to retrieve message from external message storage.
            //  Log error condition and throw exception
            Catenis.logger.ERROR('Error getting readable stream to retrieve message from Enhanced IPFS message storage.', err);
            throw new Meteor.Error('ctn_ipfs2_msg_retrieve_read_str_error', util.format('Error getting readable stream to retrieve message from Enhanced IPFS message storage: %s', err.message), err.stack);
        }
    }

    // Method used to get the native reference of the external storage to where the message
    //  is actually stored from the message reference (returned from the 'store' method)
    //
    //  Arguments:
    //    msgRef: [Object] // Object of type Buffer containing the reference (a unique ID) to the stored message
    //                     //  (as returned by the 'store' method)
    //
    //  Return: [String]  // Serialized version of native storage reference
    static getNativeMsgRef(msgRef) {
        // noinspection JSUnresolvedFunction
        return new CID(msgRef).toBaseEncodedString();
    }
}


// Module functions used to simulate private Ipfs2MessageStorage object methods
//  NOTE: these functions need to be bound to a Ipfs2MessageStorage object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// Ipfs2MessageStorage function class (public) methods
//

/*Ipfs2MessageStorage.class_func = function () {
};*/


// Ipfs2MessageStorage function class (public) properties
//

/*Ipfs2MessageStorage.prop = {};*/


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(Ipfs2MessageStorage);
