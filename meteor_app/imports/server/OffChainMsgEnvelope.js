/**
 * Created by claudio on 2019-12-12
 */

//console.log('[OffChainMsgEnvelope.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import ctnOffChainLib from 'catenis-off-chain-lib';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { OffChainMsgData } from './OffChainMsgData';


// Definition of function classes
//

// OffChainMsgEnvelope class
export class OffChainMsgEnvelope extends OffChainMsgData {
    constructor() {
        super();
    }

    // Arguments:
    //  ocMsgContent [Object(OffChainMsgContent)]
    //  msgType [Object] One of ctnOffChainLib.MessageEnvelope.msgType
    //  options [Object] {
    //    readConfirmation: [Boolean], (optional)
    //    encrypted: [Boolean]
    //  }
    //  originDeviceAddrKeys [Object(CryptoKeys)]
    //  targetDeviceAddrKeys [Object(CryptoKeys)]
    //
    assemble(ocMsgContent, msgType, options, originDeviceAddrKeys, targetDeviceAddrKeys) {
        try {
            let msgOpts = 0x00;

            if (options.encrypted) {
                msgOpts |= ctnOffChainLib.MessageEnvelope.msgOptions.encryption
            }

            if (options.readConfirmation) {
                msgOpts |= ctnOffChainLib.MessageEnvelope.msgOptions.readConfirmation
            }

            const msgInfo = {
                msgType: msgType,
                msgOpts: msgOpts,
                senderPubKeyHash: originDeviceAddrKeys.getPubKeyHash(),
                receiverPubKeyHash: targetDeviceAddrKeys ? targetDeviceAddrKeys.getPubKeyHash() : undefined,
                timestamp: Date.now(),
                stoProviderCode: ocMsgContent.storageProvider.byteCode,
                msgRef: ocMsgContent.extMsgRef
            };

            const msgData = new ctnOffChainLib.MessageEnvelope(msgInfo);
            msgData.sign(originDeviceAddrKeys.keyPair);

            this.msgData = msgData;
        }
        catch (err) {
            Catenis.logger.ERROR('Error assembling Catenis off-chain message envelope.', err);
            throw new Error('Error assembling Catenis off-chain message envelope');
        }
    }

    // Arguments:
    //  msgDataInfo: [Object] { Catenis off-chain message data info as returned by Get (Single) Off-Chain Message Data method of Catenis Off-Chain Server API
    //    cid: [String], IPFS CID of the off-chain message data
    //    data: [String], Off-Chain message data as a base64-encoded binary stream
    //    dataType: [String], Type of off-chain message data; either 'msg-envelope' or 'msg-receipt'
    //    savedDate: [String], ISO-8601 formatted date and time when off-chain message data has originally been saved
    //    retrievedDate: [String], ISO-8601 formatted date and time when off-chain message data has been retrieved
    //  }
    load(msgDataInfo, logError = true) {
        if (msgDataInfo.dataType !== ctnOffChainLib.OffChainData.msgDataType.msgEnvelope.name) {
            if (logError) {
                Catenis.logger.ERROR('Unexpected off-chain message data type trying to load off-chain message envelope.', {
                    expected: ctnOffChainLib.OffChainData.msgDataType.msgEnvelope.name,
                    actual: msgDataInfo.dataType
                });
            }

            throw new Error('Unexpected off-chain message data type trying to load off-chain message envelope');
        }

        super.load(msgDataInfo);
    }
}
