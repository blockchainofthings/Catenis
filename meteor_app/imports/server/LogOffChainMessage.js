/**
 * Created by claudio on 2019-12-13
 */

//console.log('[LogOffChainMessage.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import util from 'util';
// Third-party node modules
import ctnOffChainLib from 'catenis-off-chain-lib';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { Device } from './Device';
import { MessageReadable } from './MessageReadable';
import { CatenisMessage } from './CatenisMessage';
import { OffChainMsgEnvelope } from './OffChainMsgEnvelope';
import { OffChainMsgContent } from './OffChainMsgContent';
import { BaseOffChainAddress } from './BaseOffChainAddress';
import { CatenisNode } from './CatenisNode';
import { MessageDuplex } from './MessageDuplex';
import { BufferMessageDuplex } from './BufferMessageDuplex';

// Definition of classes
//

// LogOffChainMessage class
export class LogOffChainMessage {
    // Arguments:
    //   device: [Object] Object of type Device identifying the device that is logging the message
    //   messageReadable: [Object(MessageReadable)] Stream used to read contents of message to be logged
    //   options: [Object] {
    //     encrypted: [Boolean],  Indicates whether message should be encrypted before storing it
    //     storageProvider: [Object]  (optional, default: defaultStorageProvider) A field of the CatenisMessage.storageProvider property
    //                                 identifying the type of external storage to be used to store the off-chain message's contents
    //   }
    //
    constructor(device, messageReadable, options) {
        if (device !== undefined) {
            // Validate arguments
            const errArg = {};

            if (!(device instanceof Device)) {
                errArg.device = device;
            }

            if (!(messageReadable instanceof MessageReadable)) {
                errArg.messageReadable = messageReadable;
            }

            if (typeof options !== 'object' || options === null || !('encrypted' in options) || (('storageProvider' in options) &&
                    options.storageProvider !== undefined && !CatenisMessage.isValidStorageProvider(options.storageProvider))) {
                errArg.options = options;
            }

            if (Object.keys(errArg).length > 0) {
                const errArgs = Object.keys(errArg);

                Catenis.logger.ERROR(util.format('LogOffChainMessage constructor called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
                throw new Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
            }

            // Just initialize instance variables for now
            this.device = device;
            this.messageReadable = messageReadable;
            this.options = options;
            this.devOffChainAddrKeys = undefined;
            this.ocMsgEnvelope = new OffChainMsgEnvelope();
        }
    }

    get isAssembled () {
        return this.ocMsgEnvelope.isAssembled;
    }

    get isSaved() {
        return this.ocMsgEnvelope.isSaved;
    }

    get cid() {
        return this.ocMsgEnvelope && this.ocMsgEnvelope.cid;
    }

    assemble() {
        if (!this.isAssembled) {
            // Allocate new off-chain address for device
            this.devOffChainAddrKeys = this.device.offChainAddr.newAddressKeys();

            if (this.options.encrypted) {
                // Set up message stream to encrypt message's contents as it is read
                this.messageReadable.setEncryption(this.devOffChainAddrKeys);
            }

            // Store message's contents
            const ocMsgContent = new OffChainMsgContent(this.messageReadable, this.options.storageProvider);

            this.ocMsgEnvelope.assemble(ocMsgContent, ctnOffChainLib.MessageEnvelope.msgType.logMessage, this.options, this.devOffChainAddrKeys);
        }
    }

    save(immediateRetrieval = false, assemble = true) {
        if (!this.isSaved && (this.isAssembled || assemble)) {
            if (!this.isAssembled) {
                this.assemble();
            }

            this.ocMsgEnvelope.save(immediateRetrieval);

            this.ocMsgEnvelope.saveToDatabase({
                deviceId: this.device.deviceId
            });

            return this.ocMsgEnvelope.cid;
        }
    }

    revertOffChainAddresses() {
        if (!this.isSaved && this.devOffChainAddrKeys) {
            BaseOffChainAddress.revertAddress(this.devOffChainAddrKeys.getPubKeyHash());
        }
    }

    // Arguments:
    //  cid: [String] IPFS CID of Catenis off-chain message envelope data structure
    //  messageDuplex: [Object(MessageDuplex)] - (optional) Stream used to write retrieved message's contents. Set it
    //                                              to NULL to avoid that the message's contents be retrieved
    static fromMsgEnvelopeCid(cid, messageDuplex) {
        const msgDataInfo = Catenis.ctnOCClient.getSingleOffChainMsgData(cid, true);

        return this.fromMsgDataInfo(msgDataInfo, messageDuplex);
    }

    // Arguments:
    //  msgDataInfo: [Object] { Catenis off-chain message data info as returned by Get (Single) Off-Chain Message Data method of Catenis Off-Chain Server API
    //    cid: [String], IPFS CID of the off-chain message data
    //    data: [String], Off-Chain message data as a base64-encoded binary stream
    //    dataType: [String], Type of off-chain message data; either 'msg-envelope' or 'msg-receipt'
    //    savedDate: [String], ISO-8601 formatted date and time when off-chain message data has originally been saved
    //    retrievedDate: [String], ISO-8601 formatted date and time when off-chain message data has been retrieved
    //  }
    //  messageDuplex: [Object(MessageDuplex)] - (optional) Stream used to write retrieved message's contents. Set it
    //                                              to NULL to avoid that the message's contents be retrieved
    static fromMsgDataInfo(msgDataInfo, messageDuplex) {
        const ocMsgEnvelope = new OffChainMsgEnvelope();
        ocMsgEnvelope.load(msgDataInfo);

        return this.fromOffChainMsgEnvelope(ocMsgEnvelope, messageDuplex);
    }

    // Arguments:
    //  ocMsgEnvelope [Object(OffChainMsgEnvelope)] Off-chain message envelope object
    //  messageDuplex [Object(MessageDuplex)] (optional) Stream used to write retrieved message's contents. Set it
    //                                          to NULL to avoid that the message's contents be retrieved
    static fromOffChainMsgEnvelope(ocMsgEnvelope, messageDuplex) {
        const msgEnv = ocMsgEnvelope.msgData;

        if (msgEnv instanceof ctnOffChainLib.MessageEnvelope && msgEnv.msgType === ctnOffChainLib.MessageEnvelope.msgType.logMessage) {
            const devOffChainAddrInfo = Catenis.keyStore.getOffChainAddressInfo(msgEnv.senderPubKeyHash);

            let ocMsgContent;

            if (messageDuplex === undefined || messageDuplex instanceof MessageDuplex) {
                // If no message stream passed, create a new one to write the retrieved message's contents to a buffer
                messageDuplex = messageDuplex ? messageDuplex : new BufferMessageDuplex();

                // Note: if for some reason the message is actually encrypted but no private keys are available,
                //      possibly because the (origin) device belongs to a different Catenis node, the message
                //      shall be retrieved in its encrypted form
                if (devOffChainAddrInfo.cryptoKeys.hasPrivateKey()) {
                    // Assume that message needs to be decrypted. Note: it shall be unset when the message
                    //  data is parsed and the message is actually not encrypted
                    messageDuplex.setDecryption(devOffChainAddrInfo.cryptoKeys);
                }

                ocMsgContent = new OffChainMsgContent();
                ocMsgContent.load(msgEnv, messageDuplex);
            }
            
            const logOffChainMsg = new LogOffChainMessage();
            
            logOffChainMsg.device = CatenisNode.getCatenisNodeByIndex(devOffChainAddrInfo.pathParts.ctnNodeIndex).getClientByIndex(devOffChainAddrInfo.pathParts.clientIndex).getDeviceByIndex(devOffChainAddrInfo.pathParts.deviceIndex);
            logOffChainMsg.messageReadable = ocMsgContent ? ocMsgContent.messageReadable : undefined;
            logOffChainMsg.options = {
                encrypted: msgEnv.isMessageEncrypted,
                storageProvider: msgEnv.stoProvider
            };
            logOffChainMsg.devOffChainAddrKeys = devOffChainAddrInfo.cryptoKeys;
            logOffChainMsg.ocMsgEnvelope = ocMsgEnvelope;

            return logOffChainMsg;
        }
    }
}


// Module functions used to simulate private LogOffChainMessage object methods
//  NOTE: these functions need to be bound to a LogOffChainMessage object reference (this) before
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
Object.freeze(LogOffChainMessage);
