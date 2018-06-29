/**
 * Created by claudio on 26/12/16.
 */

//console.log('[IpfsMessageStorage.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import util from 'util';
import crypto from 'crypto';
// Third-party node modules
//import config from 'config';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { MessageStorage } from './MessageStorage';

// Definition of classes
//

// IpfsMessageStorage class
export class IpfsMessageStorage extends MessageStorage {
    constructor () {
        super();
    }

    // Method used to store the message contents onto the external storage
    //
    //  Arguments:
    //    message: [Object] // Object of type Buffer containing the message to be stored
    //
    //  Return: [Object] // Object of type Buffer containing the reference (a unique ID) to the stored message
    store(message) {
        try {
            // Compute hash of message
            let msgHash = hashRipemd160(hashSha256(message));

            // Save message onto IPFS
            let addResult = Catenis.ipfsClient.api.filesAdd(message)[0];

            // Prepare to return combined message reference
            let msgRef = Buffer.allocUnsafe(addResult.hash.length + msgHash.length + 2);

            // Write size of IPFS hash onto message reference
            let bytesWritten = msgRef.writeUInt8(addResult.hash.length, 0);

            // Write IPFS hash itself onto message reference
            bytesWritten += msgRef.write(addResult.hash, bytesWritten);

            // Now, write the size of the message hash onto message reference
            bytesWritten = msgRef.writeUInt8(msgHash.length, bytesWritten);

            // And finally write the message hah itself onto message reference
            msgHash.copy(msgRef, bytesWritten);

            return msgRef;
        }
        catch (err) {
            // Error storing message onto external message storage.
            //  Log error condition and throw exception
            Catenis.logger.ERROR('Error storing message onto IPFS message storage.', err);
            throw new Meteor.Error('ctn_ipfs_msg_store_error', util.format('Error storing message onto IPFS message storage: %s', err.message), err.stack);
        }
    }

    // Method used to retrieve the message contents stored on the external storage
    //
    //  Arguments:
    //    msgRef: [Object] // Object of type Buffer containing the reference (a unique ID) to the stored message
    //                     //  (as returned by the 'store' method)
    //
    //  Return: [Object] // Object of type Buffer containing the retrieved message
    retrieve(msgRef) {
        try {
            // Parse message reference

            // Read size of IPFS hash
            let ipfsHashLength = msgRef.readUInt8(0);
            let bytesRead = 1;

            // Read IPFS hash itself
            // noinspection JSCheckFunctionSignatures
            let ipfsHash = msgRef.toString('utf8', bytesRead, bytesRead + ipfsHashLength);

            if (ipfsHash.length !== ipfsHashLength) {
                //noinspection ExceptionCaughtLocallyJS
                throw new Error('Inconsistent IPFS hash size');
            }

            bytesRead += ipfsHashLength;

            // Read size of message hash
            let msgHashLength = msgRef.readUInt8(bytesRead);

            bytesRead++;

            // Read message hash itself
            let msgHash = Buffer.allocUnsafe(msgHashLength);
            let bytesCopied = msgRef.copy(msgHash, 0, bytesRead, bytesRead + msgHashLength);

            if (bytesCopied !== msgHashLength) {
                //noinspection ExceptionCaughtLocallyJS
                throw new Error('Inconsistent message hash size');
            }

            // Now, get message from IPFS
            const message = Catenis.ipfsClient.api.filesCat(ipfsHash);

            // Now validate message contents
            let readMsgHash = hashRipemd160(hashSha256(message));

            if (!readMsgHash.equals(msgHash)) {
                //noinspection ExceptionCaughtLocallyJS
                throw new Error('Inconsistent message contents');
            }

            return message;
        }
        catch (err) {
            // Error retrieving message from external message storage.
            //  Log error condition and throw exception
            Catenis.logger.ERROR('Error retrieving message from IPFS message storage.', err);
            throw new Meteor.Error('ctn_ipfs_msg_retrieve_error', util.format('Error retrieving message from IPFS message storage: %s', err.message), err.stack);
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
        // Parse message reference

        // Read size of IPFS hash
        let ipfsHashLength = msgRef.readUInt8(0);
        let bytesRead = 1;

        // Read IPFS hash itself
        // noinspection JSCheckFunctionSignatures
        let ipfsHash = msgRef.toString('utf8', bytesRead, bytesRead + ipfsHashLength);

        if (ipfsHash.length !== ipfsHashLength) {
            //noinspection ExceptionCaughtLocallyJS
            throw new Error('Inconsistent IPFS hash size');
        }

        return ipfsHash;
    }
}


// Module functions used to simulate private IpfsMessageStorage object methods
//  NOTE: these functions need to be bound to a IpfsMessageStorage object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// IpfsMessageStorage function class (public) methods
//

/*IpfsMessageStorage.class_func = function () {
};*/


// IpfsMessageStorage function class (public) properties
//

/*IpfsMessageStorage.prop = {};*/


// Definition of module (private) functions
//

function hashSha256(data) {
    return crypto.createHash('sha256').update(data).digest();
}

function hashRipemd160(data) {
    return crypto.createHash('rmd160').update(data).digest();
}


// Module code
//

// Lock function class
Object.freeze(IpfsMessageStorage);
