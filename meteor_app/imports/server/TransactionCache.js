/**
 * Created by claudio on 2020-02-21
 */

//console.log('[TransactionCache.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import config from 'config';
import Loki from 'lokijs';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';

// Config entries
const txCacheConfig = config.get('transactionCache');

// Configuration settings
const cfgSettings = {
    transactTTL: txCacheConfig.get('transactTTL'),
    ttlEvaluationInterval: txCacheConfig.get('ttlEvaluationInterval')
};


// Definition of classes
//

// TransactionCache class
export class TransactionCache {
    // Constructor
    constructor() {
        // Initialize in-memory database to hold cached transactions
        //  Structure of CachedTx collection: {
        //    txid: [String],      - Transaction ID
        //    rawTx: [Buffer],     - Buffer object containing the raw transaction
        //    readTimestamp: [Number]  - Read timestamp, in number of milliseconds (used to update doc/rec when it is read to reset TTL)
        //  }
        this.db = new Loki();

        this.collCachedTx = this.db.addCollection('CachedTx', {
            unique: [
                'txid'
            ],
            ttl: cfgSettings.transactTTL,
            ttlInterval: cfgSettings.ttlEvaluationInterval
        });
    }

    // Public object methods
    store(txid, hexTx, replace = false) {
        const docTx = this.collCachedTx.by('txid', txid);

        if (!docTx) {
            this.collCachedTx.insert({
                txid,
                rawTx: Buffer.from(hexTx, 'hex')
            });
        }
        else if (replace) {
            docTx.rawTx = Buffer.from(hexTx, 'hex');

            this.collCachedTx.update(docTx);
        }
    }

    retrieve(txid, inHex = false) {
        let docTx = this.collCachedTx.by('txid', txid);
        let hexTx;

        if (!docTx) {
            docTx = {
                txid,
                rawTx: Buffer.from(hexTx = Catenis.bitcoinCore.getRawTransactionCheck(txid), 'hex')
            };

            this.collCachedTx.insert(docTx);
        }
        else {
            docTx.readTimestamp = Date.now();

            this.collCachedTx.update(docTx);
        }

        return inHex ? hexTx || docTx.rawTx.toString('hex') : docTx.rawTx;
    }

    // Class (public) methods
    static initialize() {
        Catenis.logger.TRACE('TransactionCache initialization');
        // Instantiate TransactionCache object
        Catenis.txCache = new TransactionCache();
    }
}


// Module code
//

// Lock class
Object.freeze(TransactionCache);
