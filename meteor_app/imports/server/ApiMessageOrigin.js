/**
 * Created by claudio on 2020-06-25
 */

//console.log('[ApiMessageOrigin.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
//import config from 'config';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import {
    successResponse,
    errorResponse
} from './RestApi';
import { CatenisNode } from './CatenisNode';

// Config entries
/*const config_entryConfig = config.get('config_entry');

// Configuration settings
const cfgSettings = {
    property: config_entryConfig.get('property_name')
};*/


// Definition of module (private) functions
//

// Method used to process GET 'messages/:messageId/origin' endpoint of Rest API
//
//  URL parameters:
//    messageId [String] - ID of Catenis message the origin info of which should be retrieved
//
//  Query string (optional) parameters:
//    msgToSign: [string] - A message (any text) to be signed using the Catenis message's origin device's private key.
//                           The resulting signature can then later be independently verified to prove the Catenis
//                           message's origin
//
//  Success data returned: {
//    tx: { - (optional) Information about the blockchain transaction used to record the Catenis message to the
//                        blockchain (the Catenis message transaction)
//      txid: [string], - ID of Catenis message transaction
//      type: [string], - The type of Catenis message transaction. One of: 'Send Message', 'Log Message', 'Settle Off-Chain Message'
//      batchDoc: { - Information about the batch document used to settle off-chain messages on the blockchain.
//                     Note: only present for off-chain messages
//        cid: [string] - Content ID (CID) of batch document on IPFS
//      },
//      originDevice: {  - (optional) Information about the device that logged/sent the message (the origin device).
//                          Note: not present for off-chain messages
//        address: [string], - Origin device's blockchain address that was used to generate the Catenis message transaction
//        deviceId: [string] - ID of the origin device
//        name: [string] - (optional) The origin device's name
//        prodUniqueId: [string] - (optional) The origin device's product unique ID
//        ownedBy : {
//          company: [string] - (optional) The name of the company that owns the origin device
//          contact: [string] - (optional) Name of company's contact
//          name: [string] - (optional) The name of the person who owns the origin device
//          domain: [Array(string)] - (optional) List of internet domains owned by this company/person
//        }
//      }
//    },
//    offChainMsgEnvelope { - (optional) Information about the off-chain message envelope data structure used to record
//                             the Catenis message on IPFS.
//                             Note: only present for Catenis off-chain messages
//      cid: [string], - Content ID (CID) of the off-chain message envelope on IPFS
//      type: [string], - The type of Catenis off-chain message. One of: 'Send Message', 'Log Message'
//      originDevice: {  - Information about the device that logged/sent the message (the origin device)
//        pubKeyHash: [string], - Hex-encoded hash of origin device's public key that was used to generate the off-chain
//                                 message envelope
//        deviceId: [string] - ID of the origin device
//        name: [string] - (optional) The origin device's name
//        prodUniqueId: [string] - (optional) The origin device's product unique ID
//        ownedBy : {
//          company: [string] - (optional) The name of the company that owns the origin device
//          contact: [string] - (optional) Name of contact of the company responsible for the origin device
//          name: [string] - (optional) The name of the person who owns the origin device
//          domain: [Array(string)] - (optional) List of internet domains owned by this company/person
//        }
//      }
//    },
//    proof {
//      message: [string], - Message for which the signature was generated
//      signature: [string], - Hex-encoded message's signature generated using origin device's private key
//    }
//  }
export function retrieveMessageOrigin() {
    try {
        // Process request parameters

        // From URL
        //
        // messageId param
        if (!(typeof this.urlParams.messageId === 'string' && this.urlParams.messageId.length > 0)) {
            Catenis.logger.DEBUG('Invalid \'messageId\' parameter for GET \'messages/:messageId/origin\' API request', this.urlParams);
            return errorResponse.call(this, 400, 'Invalid parameters');
        }

        // From query string
        //
        // msgToSign param
        if (!(typeof this.queryParams.msgToSign === 'undefined' || typeof this.queryParams.msgToSign === 'string')) {
            Catenis.logger.DEBUG('Invalid \'msgToSign\' parameter for GET \'messages/:messageId/origin\' API request', this.queryParams);
            return errorResponse.call(this, 400, 'Invalid parameters');
        }

        // Make sure that system is running and accepting API calls
        if (!Catenis.application.isRunning()) {
            Catenis.logger.DEBUG('System currently not available for fulfilling GET \'messages/:messageId/progress\' API request', {applicationStatus: Catenis.application.status});
            return errorResponse.call(this, 503, 'System currently not available; please try again at a later time');
        }

        // Execute method to retrieve message processing progress
        let result;

        try {
            result = CatenisNode.getMessageOriginInfo(this.urlParams.messageId, this.queryParams.msgToSign);
        }
        catch (err) {
            let error;

            if (err instanceof Meteor.Error) {
                if (err.error === 'ctn_msg_not_found' || err.error === 'ctn_msg_origin_not_local') {
                    error = errorResponse.call(this, 400, 'Invalid message ID');
                }
                else if (err.error === 'ctn_msg_origin_not_public') {
                    error = errorResponse.call(this, 403, 'Message origin cannot be disclosed');
                }
                else {
                    error = errorResponse.call(this, 500, 'Internal server error');
                }
            }
            else {
                error = errorResponse.call(this, 500, 'Internal server error');
            }

            if (error.statusCode === 500) {
                Catenis.logger.ERROR('Error processing GET \'messages/:messageId/origin\' API request.', err);
            }

            return error;
        }

        // Return success
        return successResponse.call(this, result);
    }
    catch (err) {
        Catenis.logger.ERROR('Error processing GET \'messages/:messageId/origin\' API request.', err);
        return errorResponse.call(this, 500, 'Internal server error');
    }
}
