/**
 * Created by claudio on 21/12/16.
 */

//console.log('[CatenisMessage.js]: This code just ran.');

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
import config from 'config';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { IpfsMessageStorage } from './IpfsMessageStorage';

// Config entries
const ctnMessageConfig = config.get('catenisMessage');
const ctnMsgStorageConfig = ctnMessageConfig.get('msgStorage');
const ctnMsgStoIpfsConfig = ctnMsgStorageConfig.get('ipfs');

// Configuration settings
const cfgSettings = {
    nullDataMaxSize: ctnMessageConfig.get('nullDataMaxSize'),
    defaultStorageProvider: ctnMessageConfig.get('defaultStorageProvider'),
    msgStorage: {
        ipfs: {
            apiHost: ctnMsgStoIpfsConfig.get('apiHost'),
            apiPort: ctnMsgStoIpfsConfig.get('apiPort'),
            apiProtocol: ctnMsgStoIpfsConfig.get('apiProtocol')
        }
    }
};

const msgPrefix = 'CTN';
const versionBits = 3;
const versionMask =  ~(0xff >> versionBits);
const versionNumber = 0;    // Current version in use. This number is limited to 2^3-1 (7)


// Definition of function classes
//

// CatenisMessage function class
//
//  Constructor arguments:
//    message: [Object] // Object of type Buffer containing the message to be sent
//    funcByte: [Number] // A field of the CatenisMessage.functionByte property identifying the type of function expressed by this message
//    options: {
//      encrypted: [Boolean], // Indicates whether message is encrypted or not
//                            //  NOTE: if this option is true, it is expected that the message passed (arg #1) be already encrypted
//      storageScheme: [String], // A field of the CatenisMessage.storageScheme property identifying how the message should be stored
//      storageProvider: [Object] // (optional, default: defaultStorageProvider) A field of the CatenisMessage.storageProvider property identifying the type of external storage to be used to store the message that should not be embedded
//    }
//
export function CatenisMessage(message, funcByte, options) {
    if (message !== undefined) {
        this.message = message;
        this.verNum = versionNumber;
        this.funcByte = funcByte;
        this.options = {};

        this.data = new Buffer(cfgSettings.nullDataMaxSize);

        // Write message prefix
        let bytesWritten = this.data.write(msgPrefix);

        // Write message version/function byte
        bytesWritten = this.data.writeUInt8(addVersionNumber(this.verNum, funcByte), bytesWritten);

        // Prepare to write options byte
        let optsByte = 0;

        if (options.encrypted) {
            optsByte += CatenisMessage.optionBit.encryption;
        }

        this.options.encrypted = options.encrypted;

        if (options.storageScheme === CatenisMessage.storageScheme.embedded || (options.storageScheme === CatenisMessage.storageScheme.auto && message.length <= cfgSettings.nullDataMaxSize - bytesWritten - 1)) {
            // Messagae should be embedded
            optsByte += CatenisMessage.optionBit.embedding;
            this.options.embedded = true;
        }
        else {
            this.options.embedded = false;
        }

        // Write message options byte
        bytesWritten = this.data.writeUInt8(optsByte, bytesWritten);

        this.msgPayload = undefined;

        if (this.options.embedded) {
            this.msgPayload = message;
        }
        else {
            this.options.storageProvider = options.storageProvider != undefined ? options.storageProvider : CatenisMessage.defaultStorageProvider;
            const msgStorage = CatenisMessage.getMessageStorageInstance(this.options.storageProvider);
            const msgRef = msgStorage.store(message);

            this.msgPayload = new Buffer(msgRef.length + 1);

            this.msgPayload.writeUInt8(this.options.storageProvider.byteCode);
            msgRef.copy(this.msgPayload, 1);
        }

        // Just write the data making sure that it will fit
        if (this.msgPayload.length <= cfgSettings.nullDataMaxSize - bytesWritten) {
            this.msgPayload.copy(this.data, bytesWritten);
            bytesWritten += this.msgPayload.length;

            if (bytesWritten < this.data.length) {
                // Trim data buffer
                this.msgPayload = this.data;
                this.data = new Buffer(bytesWritten);
                this.msgPayload.copy(this.data, 0, 0, bytesWritten);
            }
        }
        else {
            // Data too long to fit into null data output. Log error condition and throw exception
            Catenis.logger.ERROR('Message data too long to fit into null data output.', {
                msgDataLength: this.msgPayload.length,
                limit: cfgSettings.nullDataMaxSize - bytesWritten
            });
            throw new Meteor.Error('ctn_msg_data_too_long', util.format('Message data too long to fit into null data output. Message data length: %d, limit: %d', this.msgPayload.length, cfgSettings.nullDataMaxSize - bytesWritten));
        }
    }
}


// Public CatenisMessage object methods
//

CatenisMessage.prototype.getData = function () {
    return this.data;
};

CatenisMessage.prototype.getMessage = function () {
    return this.message;
};

CatenisMessage.prototype.isEncrypted = function () {
    return this.options.encrypted;
};

CatenisMessage.prototype.isEmbedded = function () {
    return this.options.embedded;
};

CatenisMessage.prototype.isSystemMessage = function () {
    return this.funcByte === CatenisMessage.functionByte.systemMessage;
};

CatenisMessage.prototype.isSendMessage = function () {
    return this.funcByte === CatenisMessage.functionByte.sendMessage;
};

CatenisMessage.prototype.isLogMessage = function () {
    return this.funcByte === CatenisMessage.functionByte.logMessage;
};


// Module functions used to simulate private CatenisMessage object methods
//  NOTE: these functions need to be bound to a CatenisMessage object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// CatenisMessage function class (public) methods
//

// Retrieve instance of a given message storage class
//
//  Arguments:
//    storageProvided: [Object] // (optional, default: defaultStorageProvider) A field of the CatenisMessage.storageProvider property identifying the type of external storage to be used to store the message that should not be embedded
CatenisMessage.getMessageStorageInstance = function(storageProvider) {
    let instance;

    if (CatenisMessage.msgStoInstances.has(storageProvider.byteCode)) {
        // If an instance of the given message storage provider is already instantiated, just return it
        instance = CatenisMessage.msgStoInstances.get(storageProvider.byteCode);
    }
    else {
        // Otherwise, instantiate it now
        switch(storageProvider.byteCode) {
            case CatenisMessage.storageProvider.ipfs.byteCode:
                instance = new IpfsMessageStorage(cfgSettings.msgStorage.ipfs.apiHost, cfgSettings.msgStorage.ipfs.apiPort, cfgSettings.msgStorage.ipfs.apiProtocol);

                CatenisMessage.msgStoInstances.set(storageProvider.byteCode, instance);

                break;
        }
    }

    return instance;
};

CatenisMessage.getStorageProviderByName = function (spName) {
    let sp = undefined;

    Object.keys(CatenisMessage.storageProvider).some((spKey) => {
        if (CatenisMessage.storageProvider[spKey].name === spName) {
            sp = CatenisMessage.storageProvider[spKey];
            return true;
        }

        return false;
    });

    return sp;
};

CatenisMessage.getStorageProviderByByteCode = function (byteCode) {
    let sp = undefined;

    Object.keys(CatenisMessage.storageProvider).some((key) => {
        if (CatenisMessage.storageProvider[key].byteCode === byteCode) {
            sp = CatenisMessage.storageProvider[key];
            return true;
        }

        return false;
    });

    return sp;
};

CatenisMessage.isValidStorageScheme = function (strScheme) {
    return Object.keys(CatenisMessage.storageScheme).some((key) => {
        return CatenisMessage.storageScheme[key] === strScheme;
    });
};

CatenisMessage.isValidStorageProvider = function (sp) {
    let result = false;

    if (typeof sp === 'object' && sp !== null && ('byteCode' in sp) && ('name' in sp)) {
        result = Object.keys(CatenisMessage.storageProvider).some((key) => {
            return CatenisMessage.storageProvider[key].byteCode === sp.byteCode &&
                CatenisMessage.storageProvider[key].name === sp.name;
        });
    }

    return result;
};


// Arguments:
//   data: [Object] // Object of type Buffer containing the data stored in the tx's null data output
CatenisMessage.fromData = function (data, logError = true) {
    try {
        // Parse message data

        // Read message prefix
        const readMsgPrefix = data.toString(undefined, 0, msgPrefix.length);

        if (readMsgPrefix.length != msgPrefix.length) {
            //noinspection ExceptionCaughtLocallyJS
            throw new Error('Inconsistent message prefix size');
        }

        if (readMsgPrefix !== msgPrefix) {
            //noinspection ExceptionCaughtLocallyJS
            throw new Error('Invalid message prefix');
        }

        let bytesRead = msgPrefix.length;

        // Read version/function byte
        const verFuncByte = data.readUInt8(bytesRead);
        const verNum = extractVersionNumber(verFuncByte);

        if (verNum > versionNumber) {
            //noinspection ExceptionCaughtLocallyJS
            throw new Error('Invalid version number');
        }

        // TODO: if version number changes in the future (>0), fork code depending on version number
        const funcByte = extractFunctionByte(verFuncByte);

        if (!isValidFunctionByte(funcByte)) {
            //noinspection ExceptionCaughtLocallyJS
            throw new Error('Invalid function byte');
        }

        bytesRead++;

        // Read options byte
        const optsByte = data.readUInt8(bytesRead);

        if (!isValidOptionsByte(optsByte)) {
            //noinspection ExceptionCaughtLocallyJS
            throw new Error('Invalid options byte');
        }

        const options = optionsFromOptionsByte(optsByte);

        bytesRead++;

        // Read message payload
        const msgPayload = new Buffer(data.length - bytesRead);

        data.copy(msgPayload, 0, bytesRead);

        // Extract message from payload
        let message;

        if (options.embedded) {
            message = msgPayload;
        }
        else {
            // Read message storage provider byte code
            const spByteCode = msgPayload.readUInt8(0);
            const storageProvider = CatenisMessage.getStorageProviderByByteCode(spByteCode);

            if (storageProvider == undefined) {
                //noinspection ExceptionCaughtLocallyJS
                throw new Error('Invalid message storage provided byte code');
            }

            // Read message reference
            const msgRef = new Buffer(msgPayload.length - 1);

            msgPayload.copy(msgRef, 0, 1);

            const msgStorage = CatenisMessage.getMessageStorageInstance(storageProvider);

            message = msgStorage.retrieve(msgRef);
        }

        const ctnMessage = new CatenisMessage();

        ctnMessage.data = data;
        ctnMessage.verNum = verNum;
        ctnMessage.funcByte = funcByte;
        ctnMessage.options = options;
        ctnMessage.msgPayload = msgPayload;
        ctnMessage.message = message;

        return ctnMessage;
    }
    catch (err) {
        // Error parsing Catenis message data.
        //  Log error condition and throw exception
        if (logError)
            Catenis.logger.ERROR('Error parsing Catenis message data.', err);

        throw new Meteor.Error('ctn_msg_data_parse_error', util.format('Error parsing Catenis message data: %s', err.message), err.stack);
    }
};


// CatenisMessage function class (public) properties
//

CatenisMessage.functionByte = Object.freeze({
    systemMessage: 0x00,
    sendMessage: 0x01,
    logMessage: 0x02
});

CatenisMessage.optionBit = Object.freeze({
    embedding: 0x01,
    encryption: 0x02
});

CatenisMessage.storageProvider = Object.freeze({
    ipfs: Object.freeze({
        byteCode: 0x01,
        name: "ipfs",
        description: "IPFS - Interplanetary Filesystem"
    })
});

CatenisMessage.storageScheme = Object.freeze({
    embedded: 'embedded',     // Message should be stored in the tx's null data output
    externalStorage: 'externalStorage',     // Message should be stored in the designated external message storage
    auto: 'auto'    // Depending on the size of the message it will be stored either in the tx's null data output (if it fits) or
                    //  in the designated external message storage
});

CatenisMessage.msgStoInstances = new Map();


// Definition of module (private) functions
//

function extractVersionNumber(byte) {
    return (byte & versionMask) >> (8 - versionBits);
}

function addVersionNumber(verNumber, byte) {
    return ((byte & (~versionMask)) | (verNumber << (8 - versionBits))) & 0xff;
}

function extractFunctionByte(byte) {
    return byte & (~versionMask);
}

function isValidFunctionByte(funcByte) {
    return Object.keys(CatenisMessage.functionByte).some((key) => {
        return CatenisMessage.functionByte[key] === funcByte;
    });
}

function isValidOptionsByte(optsByte) {
    // Compute sum of all option bits
    const optBitsSum = Object.keys(CatenisMessage.optionBit).reduce((sum, key) => {
        return sum + CatenisMessage.optionBit[key];
    }, 0);

    return (optsByte | optBitsSum) == optBitsSum;
}

function optionsFromOptionsByte(optsByte) {
    return {
        encrypted: (optsByte & CatenisMessage.optionBit.encryption) ? true : false,
        embedded: (optsByte & CatenisMessage.optionBit.embedding) ? true : false
    }
}


// Module code
//

Object.defineProperty(CatenisMessage, 'defaultStorageProvider', {
    get: function () {
        return CatenisMessage.getStorageProviderByName(cfgSettings.defaultStorageProvider);
    },
    enumerable: true
});

// Lock function class
Object.freeze(CatenisMessage);
