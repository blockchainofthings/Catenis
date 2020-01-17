/**
 * Created by claudio on 2019-12-14
 */

//console.log('[SendOffChainMessage.js]: This code just ran.');

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

// SendOffChainMessage class
export class SendOffChainMessage {
    // Arguments:
    //   originDevice: [Object(Device)] - Object of type Device identifying the device that is sending the message
    //   targetDevice: [Object(Device)] - Object of type Device identifying the device to which the message is sent
    //   messageReadable: [Object(MessageReadable)] Stream used to read contents of message to be logged
    //   options: [Object] {
    //     readConfirmation: [Boolean],  Indicates whether transaction should include support for read confirmation in it
    //     encrypted: [Boolean],  Indicates whether message should be encrypted before storing it
    //     storageProvider: [Object]  (optional, default: defaultStorageProvider) A field of the CatenisMessage.storageProvider property
    //                                 identifying the type of external storage to be used to store the off-chain message's contents
    //   }
    //
    constructor(originDevice, targetDevice, messageReadable, options) {
        if (originDevice !== undefined) {
            // Validate arguments
            const errArg = {};

            if (!(originDevice instanceof Device)) {
                errArg.originDevice = originDevice;
            }

            if (!(targetDevice instanceof Device)) {
                errArg.targetDevice = targetDevice;
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

                Catenis.logger.ERROR(util.format('SendOffChainMessage constructor called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
                throw new Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
            }

            // Just initialize instance variables for now
            this.originDevice = originDevice;
            this.targetDevice = targetDevice;
            this.messageReadable = messageReadable;
            this.options = options;
            this.origDevOffChainAddrKeys = undefined;
            this.trgtDevOffChainAddrKeys = undefined;
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
            // Allocate new off-chain address for devices
            this.origDevOffChainAddrKeys = this.originDevice.offChainAddr.newAddressKeys();
            this.trgtDevOffChainAddrKeys = this.targetDevice.offChainAddr.newAddressKeys();

            if (this.options.encrypted) {
                // Set up message stream to encrypt message's contents as it is read
                this.messageReadable.setEncryption(this.origDevOffChainAddrKeys, this.trgtDevOffChainAddrKeys);
            }

            // Store message's contents
            const ocMsgContent = new OffChainMsgContent(this.messageReadable, this.options.storageProvider);

            this.ocMsgEnvelope.assemble(ocMsgContent, ctnOffChainLib.MessageEnvelope.msgType.sendMessage, this.options, this.origDevOffChainAddrKeys, this.trgtDevOffChainAddrKeys);
        }
    }

    save(immediateRetrieval = false, assemble = true) {
        if (!this.isSaved && (this.isAssembled || assemble)) {
            if (!this.isAssembled) {
                this.assemble();
            }

            this.ocMsgEnvelope.save(immediateRetrieval);

            this.ocMsgEnvelope.saveToDatabase({
                originDeviceId: this.originDevice.deviceId,
                targetDeviceId: this.targetDevice.deviceId
            });

            return this.ocMsgEnvelope.cid;
        }
    }

    revertOffChainAddresses() {
        if (!this.isSaved) {
            if (this.origDevOffChainAddrKeys) {
                BaseOffChainAddress.revertAddress(this.origDevOffChainAddrKeys.getPubKeyHash());
            }
            
            if (this.trgtDevOffChainAddrKeys) {
                BaseOffChainAddress.revertAddress(this.origDevOffChainAddrKeys.getPubKeyHash());
            }
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

        if (msgEnv instanceof ctnOffChainLib.MessageEnvelope && msgEnv.msgType === ctnOffChainLib.MessageEnvelope.msgType.sendMessage) {
            const origDevOffChainAddrInfo = Catenis.keyStore.getOffChainAddressInfo(msgEnv.senderPubKeyHash);
            const trgtDevOffChainAddrInfo = Catenis.keyStore.getOffChainAddressInfo(msgEnv.receiverPubKeyHash);

            let ocMsgContent;

            if (messageDuplex === undefined || messageDuplex instanceof MessageDuplex) {
                // If no message stream passed, create a new one to write the retrieved message's contents to a buffer
                messageDuplex = messageDuplex ? messageDuplex : new BufferMessageDuplex();

                // Note: if for some reason the message is actually encrypted but no private keys are available,
                //      possibly because the (origin) device belongs to a different Catenis node, the message
                //      shall be retrieved in its encrypted form
                if (trgtDevOffChainAddrInfo.cryptoKeys.hasPrivateKey()) {
                    // Assume that message needs to be decrypted. Note: it shall be unset when the message
                    //  data is parsed and the message is actually not encrypted
                    messageDuplex.setDecryption(trgtDevOffChainAddrInfo.cryptoKeys, origDevOffChainAddrInfo.cryptoKeys);
                }

                ocMsgContent = new OffChainMsgContent();
                ocMsgContent.load(msgEnv, messageDuplex);
            }

            const sendOffChainMsg = new SendOffChainMessage();

            sendOffChainMsg.originDevice = CatenisNode.getCatenisNodeByIndex(origDevOffChainAddrInfo.pathParts.ctnNodeIndex).getClientByIndex(origDevOffChainAddrInfo.pathParts.clientIndex).getDeviceByIndex(origDevOffChainAddrInfo.pathParts.deviceIndex);
            sendOffChainMsg.targetDevice = CatenisNode.getCatenisNodeByIndex(trgtDevOffChainAddrInfo.pathParts.ctnNodeIndex).getClientByIndex(trgtDevOffChainAddrInfo.pathParts.clientIndex).getDeviceByIndex(trgtDevOffChainAddrInfo.pathParts.deviceIndex);
            sendOffChainMsg.messageReadable = ocMsgContent ? ocMsgContent.messageReadable : undefined;
            sendOffChainMsg.options = {
                readConfirmation: msgEnv.isMessageWithReadConfirmation,
                encrypted: msgEnv.isMessageEncrypted,
                storageProvider: msgEnv.stoProvider
            };
            sendOffChainMsg.origDevOffChainAddrKeys = origDevOffChainAddrInfo.cryptoKeys;
            sendOffChainMsg.trgtDevOffChainAddrKeys = trgtDevOffChainAddrInfo.cryptoKeys;
            sendOffChainMsg.ocMsgEnvelope = ocMsgEnvelope;

            return sendOffChainMsg;
        }
    }
}


// Module functions used to simulate private SendOffChainMessage object methods
//  NOTE: these functions need to be bound to a SendOffChainMessage object reference (this) before
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
Object.freeze(SendOffChainMessage);
