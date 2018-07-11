/**
 * Created by Claudio on 2016-12-23.
 */

//console.log('[MessageStorage.js]: This code just ran.');

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
//import config from 'config';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';


// Definition of class
//

// Generic class to be used as the base for the implementation of specialized external message storage classes
export class MessageStorage {
    constructor () {
    }

    // Method used to store the message contents onto the external storage
    //
    //  Arguments:
    //    message: [Object] // Object of type Buffer containing the message to be stored
    //
    //  Return: [Object] // Object of type Buffer containing the reference (a unique ID) to the stored message
    //
    //  NOTE: this method should be implemented in the derived class
    store(message) {
        Catenis.logger.WARN('Method not implemented.');
    }

    // Method used to retrieve the message contents stored on the external storage
    //
    //  Arguments:
    //    msgRef: [Object] // Object of type Buffer containing tthe reference (a unique ID) to the stored message
    //                     //  (as returned by the 'store' method)
    //
    //  Return: [Object] // Object of type Buffer containing the retrieved message
    //
    //  NOTE: this method should be implemented in the derived class
    retrieve(msgRef) {
        Catenis.logger.WARN('Method not implemented');
    }

    // Method used to get the native reference of the external storage to where the message
    //  is actually stored from the message reference (returned from the 'store' method)
    //
    //  Arguments:
    //    msgRef: [Object] // Object of type Buffer containing tthe reference (a unique ID) to the stored message
    //                     //  (as returned by the 'store' method)
    //
    //  Return: [String]  // Serialized version of native storage reference
    //
    //  NOTE: this static method should be implemented in the derived class. It is commented out here because
    //      if it was defined in the base class, it would always be called instead of the corresponding
    //      method in the desired derived class (that because it is a static method instead of an instance method)
    /*static getNativeMsgRef(msgRef) {
        Catenis.logger.WARN('Method not implemented');
    }*/
}

// Module code
//

// Lock class reference
Object.freeze(MessageStorage);
