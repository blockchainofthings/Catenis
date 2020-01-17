/**
 * Created by claudio on 2019-12-24
 */

//console.log('[OffChainMsgReceipt.js]: This code just ran.');

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

// OffChainMsgReceipt class
export class OffChainMsgReceipt extends OffChainMsgData {
    constructor() {
        super();
    }

    // Arguments:
    //  ocMsgEnvCid [string] IPFS CID of Catenis off-chain message envelope for which an off-chain message receipt
    //                        is to be generated
    //
    assemble(ocMsgEnvCid) {
        try {
            const ocMsgEnvelope = ctnOffChainLib.MessageEnvelope.fromBase64(Catenis.ctnOCClient.getSingleOffChainMsgData(ocMsgEnvCid, true).data);
            const receiverOffChainAddrInfo = Catenis.keyStore.getOffChainAddressInfo(ocMsgEnvelope.receiverPubKeyHash);

            if (!receiverOffChainAddrInfo) {
                Catenis.logger.ERROR('Could not get off-chain address info from receiver\'s public key hash of Catenis off-chain message envelope', {
                    ocMsgEnvelope
                });
                // noinspection ExceptionCaughtLocallyJS
                throw new Error('Could not get off-chain address info from receiver\'s public key hash of Catenis off-chain message envelope');
            }

            if (!receiverOffChainAddrInfo.cryptoKeys.hasPrivateKey()) {
                Catenis.logger.ERROR('Private key of Catenis off-chain message envelope receiver\'s crypto key pair not available', {
                    ocMsgEnvelope
                });
                // noinspection ExceptionCaughtLocallyJS
                throw new Error('Private key of Catenis off-chain message envelope receiver\'s crypto key pair not available');
            }

            const msgData = new ctnOffChainLib.MessageReceipt({
                msgInfo: ocMsgEnvelope,
                timestamp: Date.now(),
                msgEnvCid: ocMsgEnvCid
            });
            msgData.sign(receiverOffChainAddrInfo.cryptoKeys.keyPair);

            this.msgData = msgData;
        }
        catch (err) {
            Catenis.logger.ERROR('Error assembling Catenis off-chain message receipt.', err);
            throw new Error('Error assembling Catenis off-chain message receipt');
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
        if (msgDataInfo.dataType !== ctnOffChainLib.OffChainData.msgDataType.msgReceipt.name) {
            if (logError) {
                Catenis.logger.ERROR('Unexpected off-chain message data type trying to load off-chain message receipt.', {
                    expected: ctnOffChainLib.OffChainData.msgDataType.msgReceipt.name,
                    actual: msgDataInfo.dataType
                });
            }

            throw new Error('Unexpected off-chain message data type trying to load off-chain message receipt');
        }

        super.load(msgDataInfo);
    }
}
