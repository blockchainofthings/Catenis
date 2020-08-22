/**
 * Created by claudio on 2020-08-19
 */

//console.log('[StandbyPurchasedBcot.js]: This code just ran.');

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
import { BcotSaleAllocation } from './BcotSaleAllocation';


// Definition of classes
//

// StandbyPurchasedBcot class
export class StandbyPurchasedBcot {
    // Class (public) properties
    //

    static status = Object.freeze({
        new: Object.freeze({
            name: 'new',
            description: 'Purchased BCOT tokens awaiting to be processed for redemption'
        }),
        processed: Object.freeze({
            name: 'processed',
            description: 'Purchased BCOT tokens already processed for redemption'
        })
    });


    // Constructor
    //

    //  Arguments:
    //    client: [Object] Instance of Client function class with which device is associated
    constructor(client) {
        this.client = client;
        this.batchesToProcess = [];

        this._loadBatchesToProcess();
    }


    // Public object properties (getters/setters)
    //

    get hasBatchesToProcess() {
        return this.batchesToProcess.length > 0;
    }


    // Privates object methods
    //

    _loadBatchesToProcess() {
        Array.prototype.push.apply(this.batchesToProcess, Catenis.db.collection.StandbyPurchasedBcot.find({
            _id: {
                $nin: this.batchesToProcess.map(doc => doc._id)
            },
            client_id: this.client.doc_id,
            status: StandbyPurchasedBcot.status.new.name
        }, {
            fields: {
                purchaseCodes: 1
            }
        }).fetch());
    }

    // Public object methods
    //

    // Add newly purchased BCOT tokens to be redeemed later
    //
    //  Arguments:
    //   purchaseCodes [Array(string)]
    addPurchasedCodes(purchaseCodes) {
        // Validate purchase codes
        const redeemBcotInfo = BcotSaleAllocation.getRedeemBcotInfo(purchaseCodes);

        if (!redeemBcotInfo) {
            // Invalid redeem code. Log error and throw exception
            Catenis.logger.ERROR('Unable to add purchased BCOT tokens to standby: one or more of the purchase codes are invalid or have already been redeemed', {
                purchaseCodes: purchaseCodes
            });
            throw new Meteor.Error('standby_bcot_invalid_codes', 'One or more of the voucher IDs are invalid or have already been redeemed');
        }

        try {
            // Add purchased BCOT tokens to standby
            Catenis.db.collection.StandbyPurchasedBcot.insert({
                client_id: this.client.doc_id,
                purchaseCodes: Array.isArray(purchaseCodes) ? purchaseCodes : [purchaseCodes],
                status: StandbyPurchasedBcot.status.new.name,
                addedDate: new Date()
            });
        }
        catch (err) {
            Catenis.logger.ERROR('Error inserting new Standby Purchased BCOT database doc/rec.', err);
            throw new Error('Error inserting new Standby Purchased BCOT database doc/rec');
        }

        // Update batches to process
        this._loadBatchesToProcess();
    }

    // Remove set of purchased BCOT tokens that are on standby
    //
    //  Arguments:
    //   doc_id [String]
    removeBatch(doc_id) {
        try {
            // Add purchased BCOT tokens to standby
            Catenis.db.collection.StandbyPurchasedBcot.remove({
                _id: doc_id,
                client_id: this.client.doc_id,
                status: StandbyPurchasedBcot.status.new.name
            });
        }
        catch (err) {
            Catenis.logger.ERROR('Error removing Standby Purchased BCOT database doc/rec (doc_id: %s).', doc_id, err);
            throw new Error('Error removing Standby Purchased BCOT database doc/rec');
        }
    }

    // Redeem all purchased BCOT tokens on standby
    processBatches() {
        // Try to redeem all purchased BCOT tokens not yet processed
        this.batchesToProcess.forEach(doc => {
            let result = {
                success: true
            };

            try {
                this.client.redeemBcot(doc.purchaseCodes);
            }
            catch (err) {
                result.success = false;
                result.error = err.toString();
            }

            // Update local database recs/docs with processing result
            try {
                Catenis.db.collection.StandbyPurchasedBcot.update({
                    _id: doc._id
                }, {
                    $set: {
                        status: StandbyPurchasedBcot.status.processed.name,
                        processingResult: result,
                        processedDate: new Date()
                    }
                });
            }
            catch (err) {
                Catenis.logger.ERROR('Error updating Standby Purchased BCOT database doc/rec (doc_id: %s) to set processing result.', doc._id, err);
                throw new Error('Error updating Standby Purchased BCOT database doc/rec to set processing result');
            }
        });

        // Reload batches to process
        this.batchesToProcess = [];
        this._loadBatchesToProcess();
    }
}


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock class
Object.freeze(StandbyPurchasedBcot);
