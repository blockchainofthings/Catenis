/**
 * Created by claudio on 23/12/16.
 */

//console.log('[MessageStorage.js]: This code just ran.');

// References to external modules
const config = Npm.require('config');

// Config entries
const configMsgStorage = config.get('messageStorage');
const configIpfsMsgStorage = configMsgStorage.get('ipfs');

// Configuration settings
const cfgSettings = {
    ipfs: {
        apiHost: configIpfsMsgStorage.get('apiHost'),
        apiPort: configIpfsMsgStorage.get('apiPort'),
        apiProtocol: configIpfsMsgStorage.get('apiProtocol')
    }
};

// Definition of class
//

// Generic class to be used as the base for the implementation of specialized external message storage classes
export class MessageStorage {
    constructor () {
    }

    // Retrieve instance of a given message storage class
    //
    //  Arguments:
    //    storageProvided: [Object] // (optional, default: defaultStorageProvider) A field of the CatenisMessage.storageProvider property identifying the type of external storage to be used to store the message that should not be embedded
    static getInstance(storageProvider) {
        let instance;

        if (MessageStorage.instances.has(storageProvider.byteCode)) {
            // If an instance of the given message storage provider is already instantiated, just return it
            instance = MessageStorage.instances.get(storageProvider.byteCode);
        }
        else {
            // Otherwise, instantiate it now
            switch(storageProvider.byteCode) {
                case Catenis.module.CatenisMessage.storageProvider.ipfs.byteCode:
                    instance = new Catenis.module.IpfsMessageStorage(cfgSettings.ipfs.apiHost, cfgSettings.ipfs.apiPort, cfgSettings.ipfs.apiProtocol);

                    MessageStorage.instances.set(storageProvider.byteCode, instance);

                    break;
            }
        }

        return instance;
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
    //  Return: [Object] // Object of type Buffer containing the retrieved message
    //
    //  NOTE: this method should be implemented in the derived class
    retrieve(msgRef) {
        Catenis.logger.WARN('Method not implemented');
    }
}

// MessageStorage class (public) properties
//

MessageStorage.instances = new Map();


// Module code
//

// Save module function class reference
if (typeof Catenis === 'undefined')
    Catenis = {};

if (typeof Catenis.module === 'undefined')
    Catenis.module = {};

Catenis.module.MessageStorage = Object.freeze(MessageStorage);
