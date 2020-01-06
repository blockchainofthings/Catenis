/**
 * Created by claudio on 2019-12-10
 */

//console.log('[OffChainMsgData.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import ctnOffChainLib from 'catenis-off-chain-lib';
import _und from 'underscore';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { Util } from './Util';
import { KeyStore } from './KeyStore';


// Definition of function classes
//

// OffChainMsgData class
export class OffChainMsgData {
    constructor() {
        this.msgData = undefined;
        this.cid = undefined;
        this.savedDate = undefined;
        this.retrievedDate = undefined;
        this.savedToDatabase = false;
    }

    get isAssembled() {
        return this.msgData && this.retrievedDate === undefined;
    }

    get isSaved() {
        return this.isAssembled && this.cid;
    }

    get isLoaded() {
        return this.msgData && this.retrievedDate !== undefined;
    }

    get msgRef() {
        if (this.msgData) {
            return this.msgData.msgRef;
        }
    }

    get dataType () {
        if (this.msgData) {
            return this.msgData instanceof ctnOffChainLib.MessageEnvelope ? ctnOffChainLib.OffChainData.msgDataType.msgEnvelope.name :
                (this.msgData instanceof ctnOffChainLib.MessageReceipt ? ctnOffChainLib.OffChainData.msgDataType.msgReceipt.name : undefined);
        }
    }

    save(immediateRetrieval = false) {
        if (this.isAssembled && !this.isSaved) {
            try {
                let saveResult;

                switch (this.dataType) {
                    case ctnOffChainLib.OffChainData.msgDataType.msgEnvelope.name:
                        saveResult = Catenis.ctnOCClient.saveOffChainMsgEnvelope(this.msgData.buffer, immediateRetrieval);
                        break;

                    case ctnOffChainLib.OffChainData.msgDataType.msgReceipt.name:
                        saveResult = Catenis.ctnOCClient.saveOffChainMsgReceipt(this.msgData.buffer, immediateRetrieval);
                        break;
                }

                this.cid = saveResult.cid;
                this.savedDate = new Date(saveResult.savedDate);
            }
            catch (err) {
                Catenis.logger.ERROR('Error saving Catenis off-chain message data to Catenis node\'s IPFS repository.', err);
                throw new Error('Error saving Catenis off-chain message data to Catenis node\'s IPFS repository');
            }
        }
    }

    // Returns:
    //  accepted [Boolean] Indicates whether retrieved Catenis off-chain message data should be accepted by this Catenis node
    checkAcceptRetrieved() {
        let accept = false;

        if (this.isLoaded) {
            const dataType = this.dataType;

            if (dataType === ctnOffChainLib.OffChainData.msgDataType.msgEnvelope.name) {
                if (this.msgData.msgType === ctnOffChainLib.MessageEnvelope.msgType.sendMessage) {
                    // Catenis off-chain message envelope for send message. Accept only if sender (target device) belongs
                    //  to this Catenis node
                    const senderOffChainAddrInfo = Catenis.keyStore.getOffChainAddressInfo(this.msgData.senderPubKeyHash);

                    if (senderOffChainAddrInfo && senderOffChainAddrInfo.type === KeyStore.extKeyType.dev_off_chain_addr.name
                            && senderOffChainAddrInfo.pathParts.ctnNodeIndex === Catenis.application.ctnNode.index) {
                        accept = true;
                    }
                }
            }
            else if (dataType === ctnOffChainLib.OffChainData.msgDataType.msgReceipt.name) {
                // Catenis off-chain message receipt. Accept only if sender (target device) of original message
                //  belongs to this Catenis node
                const senderOffChainAddrInfo = Catenis.keyStore.getOffChainAddressInfo(this.msgData.senderPubKeyHash);

                if (senderOffChainAddrInfo && senderOffChainAddrInfo.type === KeyStore.extKeyType.dev_off_chain_addr.name
                        && senderOffChainAddrInfo.pathParts.ctnNodeIndex === Catenis.application.ctnNode.index) {
                    accept = true;
                }
            }
        }

        return accept;
    }

    // Returns: {
    //   collection: [String],
    //   doc_id: [String]
    // }
    saveToDatabase(msgInfo, logDuplicateDbRecError = true) {
        if ((this.isSaved || this.isLoaded) && !this.savedToDatabase) {
            try {
                const result = {};

                if (this.isSaved) {
                    // Save as saved off-chain message data
                    const dataType = this.dataType;
                    const dataTypeProp = Util.kebabToCamelCase(dataType);
                    const info = {};
                    info[dataTypeProp] = {};
                    const doc = {
                        dataType: dataType
                    };

                    if (dataType === ctnOffChainLib.OffChainData.msgDataType.msgEnvelope.name) {
                        if (typeof msgInfo !== 'object' || msgInfo === null) {
                            // noinspection ExceptionCaughtLocallyJS
                            throw new Error('Invalid or missing \'msgInfo\' parameter');
                        }

                        const msgTypeProp = Util.kebabToCamelCase(this.msgData.msgType.name);
                        info[dataTypeProp][msgTypeProp] = msgInfo;

                        doc.msgType = this.msgData.msgType.name;
                    }
                    else if (dataType === ctnOffChainLib.OffChainData.msgDataType.msgReceipt.name) {
                        info[dataTypeProp] = {
                            sendMsgEnvelopeCid: this.msgData.msgEnvCid.toString()
                        };
                    }

                    doc.cid = this.cid;
                    doc.savedDate = this.savedDate;
                    doc.settlement = {
                        settled: false
                    };
                    doc.info = info;

                    result.collection = 'SavedOffChainMsgData';
                    result.doc_id = Catenis.db.collection.SavedOffChainMsgData.insert(doc);
                }
                else /* isLoaded */ {
                    // Save as retrieved off-chain message data

                    // Check if retrieved off-chain message data has been saved by this Catenis node
                    const docSavedOCMsgData = Catenis.db.collection.SavedOffChainMsgData.findOne({
                        cid: this.cid
                    }, {
                        fields: {
                            _id: 1,
                            info: 1
                        }
                    });

                    const dataType = this.dataType;
                    const dataTypeProp = Util.kebabToCamelCase(dataType);
                    const info = {};
                    info[dataTypeProp] = {};
                    const doc = {
                        dataType: dataType
                    };

                    if (dataType === ctnOffChainLib.OffChainData.msgDataType.msgEnvelope.name) {
                        const msgTypeProp = Util.kebabToCamelCase(this.msgData.msgType.name);

                        if (typeof msgInfo !== 'object' || msgInfo === null || (docSavedOCMsgData && !_und.isEqual(docSavedOCMsgData.info[dataTypeProp][msgTypeProp], msgInfo))) {
                            // noinspection ExceptionCaughtLocallyJS
                            throw new Error('Invalid or missing \'msgInfo\' parameter');
                        }

                        info[dataTypeProp][msgTypeProp] = msgInfo;

                        doc.msgType = this.msgData.msgType.name;
                    }
                    else if (dataType === ctnOffChainLib.OffChainData.msgDataType.msgReceipt.name) {
                        info[dataTypeProp] = {
                            sendMsgEnvelopeCid: this.msgData.msgEnvCid.toString()
                        };
                    }

                    doc.cid = this.cid;
                    doc.savedDate = this.savedDate;
                    doc.retrievedDate = this.retrievedDate;

                    if (docSavedOCMsgData) {
                        doc.savedOffChainMsgData_id = docSavedOCMsgData._id;
                    }

                    doc.info = info;

                    result.collection = 'RetrievedOffChainMsgData';
                    result.doc_id = Catenis.db.collection.RetrievedOffChainMsgData.insert(doc);
                }

                this.savedToDatabase = true;

                return result;
            }
            catch (err) {
                const errorToThrow = new Error('Error saving Catenis off-chain message data to local database');

                if ((err.name === 'MongoError' || err.name === 'BulkWriteError') && err.code === 11000 && err.errmsg.search(/index:\s+cid/) >= 0) {
                    // Duplicate database record error. Indicate it on error itself
                    errorToThrow.duplicateDbRec = true;
                }

                if (!errorToThrow.duplicateDbRec || logDuplicateDbRecError) {
                    Catenis.logger.ERROR('Error saving Catenis off-chain message data to local database.', err);
                }

                throw errorToThrow;
            }
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
    load(msgDataInfo) {
        if (!this.msgData) {
            try {
                switch (msgDataInfo.dataType) {
                    case ctnOffChainLib.OffChainData.msgDataType.msgEnvelope.name:
                        this.msgData = ctnOffChainLib.MessageEnvelope.fromBase64(msgDataInfo.data);
                        break;

                    case ctnOffChainLib.OffChainData.msgDataType.msgReceipt.name:
                        this.msgData = ctnOffChainLib.MessageReceipt.fromBase64(msgDataInfo.data);
                        break;
                }

                this.cid = msgDataInfo.cid;
                this.savedDate = new Date(msgDataInfo.savedDate);
                this.retrievedDate = msgDataInfo.retrievedDate ? new Date(msgDataInfo.retrievedDate) : null;
            }
            catch (err) {
                Catenis.logger.ERROR('Error loading Catenis off-chain message data.', err);
                throw new Error('Error loading Catenis off-chain message data');
            }
        }
    }
}


// Module functions used to simulate private OffChainMsgData object methods
//  NOTE: these functions need to be bound to a OffChainMsgData object reference (this) before
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
Object.freeze(OffChainMsgData);
