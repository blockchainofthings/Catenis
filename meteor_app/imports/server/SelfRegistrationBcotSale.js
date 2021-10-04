/**
 * Created by claudio on 2021-09-29
 */

//console.log('[SelfRegistrationBcotSale.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import config from 'config';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { CriticalSection } from './CriticalSection';
import { BcotSaleAllocation } from './BcotSaleAllocation';
import { BcotProduct } from './BcotProduct';

// Config entries
const selfRegBcotSaleConfig = config.get('selfRegistrationBcotSale');

// Configuration settings
const cfgSettings = {
    bcotProduct: selfRegBcotSaleConfig.get('bcotProduct'),
    minAvailableQuantity: selfRegBcotSaleConfig.get('minAvailableQuantity')
};

// Critical section object to avoid concurrent access to database
const dbCS = new CriticalSection();


// Definition of classes
//

/**
 * SelfRegistrationBcotSale class
 */
export class SelfRegistrationBcotSale {
    // Class (public) properties
    //

    /**
     * Possible statuses for a self-registration BCOT sale item
     * @type {Readonly<{reserved: Readonly<{name: string, description: string}>, available: Readonly<{name: string, description: string}>, used: Readonly<{name: string, description: string}>}>}
     */
    static itemStatus = Object.freeze({
        available: Object.freeze({
            name: 'available',
            description: 'BCOT token sale item is available to be assigned to self-registered client accounts'
        }),
        reserved: Object.freeze({
            name: 'reserved',
            description: 'BCOT token sale item has been reserved to be assigned to a specific self-registered client account'
        }),
        used: Object.freeze({
            name: 'used',
            description: 'BCOT token sale item has already been assigned to a self-registered client account'
        })
    });

    /**
     * SKU of BCOT product configured to be used for self-registration BCOT sale items
     * @return {string}
     */
    static get bcotProductSku() {
        return cfgSettings.bcotProduct;
    }

    static get minimumAvailableQuantity() {
        return cfgSettings.minAvailableQuantity;
    }


    /**
     * Class constructor
     * @param docSelfRegBcotSale SelfRegistrationBcotSale database collection doc/rec
     */
    constructor(docSelfRegBcotSale) {
        this.doc_id = docSelfRegBcotSale._id;
        this.purchaseCode = docSelfRegBcotSale.purchaseCode;
        this._lastStatus = this._status = docSelfRegBcotSale.status;
        this.createdDate = docSelfRegBcotSale.createdDate;
        this.lastStatusChangedDate = docSelfRegBcotSale.lastStatusChangedDate;
    }


    // Public object properties (getters/setters)
    //

    /**
     * Retrieve the current status of the self-registration BCOT sale item
     * @return {string}
     */
    get status() {
        return this._status;
    }

    /**
     * Reset the status of the self-registration BCOT sale item
     * @param {string} newStatus
     */
    set status(newStatus) {
        if (this._status !== newStatus) {
            this._lastStatus = this._status;
            this._status = newStatus;
            this.lastStatusChangedDate = new Date();

            this._saveToDb();
        }
    }


    // Public object methods
    //

    /**
     * Update status of self-registration BCOT token sale item setting it to 'used'
     */
    setAsUsed() {
        if (this._status !== SelfRegistrationBcotSale.itemStatus.reserved.name) {
            // Inconsistent status to set self-registration BCOT sale item as used.
            //  Log error and throw exception
            Catenis.logger.ERROR('Inconsistent status to set self-registration BCOT sale item as used.', {currentStatus: this._status});
            throw new Meteor.Error('ctn_self_reg_bcot_sale_inconsistent_status', 'Inconsistent status to set self-registration BCOT sale item as used');
        }

        this.status = SelfRegistrationBcotSale.itemStatus.used.name;
    }

    /**
     * Update status of self-registration BCOT token sale item returning it to 'available'
     */
    free() {
        if (this._status !== SelfRegistrationBcotSale.itemStatus.reserved.name) {
            // Inconsistent status to free self-registration BCOT sale item.
            //  Log error and throw exception
            Catenis.logger.ERROR('Inconsistent status to free self-registration BCOT sale item.', {currentStatus: this._status});
            throw new Meteor.Error('ctn_self_reg_bcot_sale_inconsistent_status', 'Inconsistent status to free self-registration BCOT sale item');
        }

        this.status = SelfRegistrationBcotSale.itemStatus.available.name;
    }


    // Private object methods
    //

    /**
     * Update update the corresponding self-registration BCOT toke sale database doc/rec
     * @private
     */
    _saveToDb() {
        if (this._status !== this._lastStatus) {
            try {
                Catenis.db.collection.SelfRegistrationBcotSale.update({
                    _id: this.doc_id
                }, {
                    $set: {
                        status: this._status,
                        lastStatusChangedDate: this.lastStatusChangedDate
                    }
                });
            }
            catch (err) {
                // Error trying to update SelfRegistrationBcotSale database doc/rec.
                //  Log error and throw exception
                Catenis.logger.ERROR('Error trying to update SelfRegistrationBcotSale database doc/rec.', err);
                throw new Meteor.Error('ctn_self_reg_bcot_sale_update_error', `Error trying to update SelfRegistrationBcotSale database doc/rec: ${err}`);
            }
        }
    }


    // Class (public) methods
    //

    static initialize() {
        Catenis.logger.TRACE('SelfRegistrationBcotSale initialization');
        // Check consistency of BCOT product and if available quantity is bellow minimum
        const availablePurchaseCodes = getAvailablePurchaseCodes();

        this.checkBcotProductConsistency(availablePurchaseCodes);
        this.checkMinimumAvailableQuantity(availablePurchaseCodes);
    }

    /**
     * Check if BCOT product associated with self-registration BCOT sale items is
     *  correct (according to the current configuration), and fix it if not
     * @param {string[]} [availablePurchaseCodes] List of purchase codes associated with currently available self-registration BCOT sale items
     */
    static checkBcotProductConsistency(availablePurchaseCodes) {
        try {
            // Make sure that BCOT product to be used is available
            BcotProduct.getBcotProductBySku(cfgSettings.bcotProduct);

            // Check if there are any BCOT sale allocation items used for self-registration
            //  that have the wrong BCOT product
            availablePurchaseCodes = availablePurchaseCodes || getAvailablePurchaseCodes();

            const docInconsistentItems = Catenis.db.collection.BcotSaleAllocationItem.find({
                purchaseCode: {
                    $in: availablePurchaseCodes
                },
                sku: {
                    $ne: cfgSettings.bcotProduct
                }
            }, {
                fields: {
                    _id: 1,
                    bcotSaleAllocation_id: 1,
                    sku: 1
                }
            })
            .fetch();

            if (docInconsistentItems.length > 0) {
                Catenis.logger.WARN(
                    'Found self-registration BCOT sale items with the wrong BCOT product:',
                    docInconsistentItems.map(doc => `_id: ${doc._id}, sku: ${doc.sku}`),
                    `\n\nFixing them by changing the BCOT product to ${cfgSettings.bcotProduct}.`
                );
                // Identify BCOT sale allocations that will need to be fixed
                const docIdsBcotSaleAllocationToFix = new Set();

                docInconsistentItems.forEach(doc => docIdsBcotSaleAllocationToFix.add(doc.bcotSaleAllocation_id));

                // Update inconsistent BCOT sale allocation items
                Catenis.db.collection.BcotSaleAllocationItem.update({
                    _id: {
                        $in: docInconsistentItems.map(doc => doc._id)
                    }
                }, {
                    $set: {
                        sku: cfgSettings.bcotProduct
                    }
                }, {
                    multi: true
                });

                // Fix items summary of corresponding BCOT sale allocations
                for (const doc_id of docIdsBcotSaleAllocationToFix) {
                    BcotSaleAllocation.getBcotSaleAllocationByDocId(doc_id).fixSummary();
                }
            }
        }
        catch (err) {
            if ((err instanceof Meteor.Error) && err.error === 'ctn_bcot_prod_not_found') {
                // BCOT product not found. Log specific error end throw exception
                Catenis.logger.ERROR('BCOT product (SKU: %s) configured to be used for self-registration BCOT sale items does not exist or is not active', cfgSettings.bcotProduct);
                throw new Error(`BCOT product (SKU: ${cfgSettings.bcotProduct}) configured to be used for self-registration BCOT sale items does not exist or is not active`);
            }
            else {
                // Any other error. Log generic error and throw exception
                Catenis.logger.ERROR('Error checking consistency of BCOT product for self-registration BCOT sale items.', err);
                throw new Error('Error checking consistency of BCOT product for self-registration BCOT sale items');
            }
        }
    }

    /**
     * Check if available quantity is bellow minimum
     * @param {string[]} [availablePurchaseCodes] List of purchase codes associated with currently available self-registration BCOT sale items
     */
    static checkMinimumAvailableQuantity(availablePurchaseCodes) {
        availablePurchaseCodes = availablePurchaseCodes || getAvailablePurchaseCodes();

        if (availablePurchaseCodes.length < cfgSettings.minAvailableQuantity) {
            // Available self-registration BCOT sale items below minimum.
            //  Send notification to allocate more BCOT products for self-registration
            Catenis.logger.ACTION(
                'Self-registration Catenis credit products below minimum.',
                `\n\nThe available quantity of Catenis credit products allocated for self-registration is currently below the defined minimum.`
                + `\n\nAvailable quantity: ${availablePurchaseCodes.length}; defined minimum: ${cfgSettings.minAvailableQuantity}`
                + `\n\nACTION REQUIRED: please allocate more products for self-registration now.`
            );
        }
    }

    /**
     * Check if BCOT products to be allocated are consistent for self-registration
     * @param {Object} productsToAllocate A dictionary specifying the quantity of each BCOT token product (identified by its SKU) that should be allocated
     * @param {boolean} [throwOnFalse] Indicates if an exception should be thrown in case of a negative validation
     * @return {boolean}
     */
    static validateProductsToAllocate(productsToAllocate, throwOnFalse = true) {
        const skus = Object.keys(productsToAllocate);

        const productsOK = skus.length === 1 && skus[0] === cfgSettings.bcotProduct;

        if (!productsOK && throwOnFalse) {
            Catenis.logger.ERROR('Inconsistent BCOT products for self-registration.', productsToAllocate);
            throw new Error('Inconsistent BCOT products for self-registration');
        }

        return productsOK;
    }

    /**
     * Add BCOT sale allocation items to be used for self-registration
     * @param {string[]} purchaseCodes List of purchase codes to be used for self-registration
     */
    static addItems(purchaseCodes) {
        if (Array.isArray(purchaseCodes) && purchaseCodes.length > 0) {
            // Validate supplied purchase codes
            const docBcotSaleAllocationItems = Catenis.db.collection.BcotSaleAllocationItem.find({
                sku: cfgSettings.bcotProduct,
                purchaseCode: {
                    $in: purchaseCodes
                },
                'redemption.redeemed': false
            }, {
                fields: {
                    _id: 1,
                    bcotSaleAllocation_id: 1
                }
            })
            .fetch();

            if (docBcotSaleAllocationItems.length !== purchaseCodes.length) {
                // Log error and throw exception
                Catenis.logger.ERROR('Inconsistent BCOT sale allocation items for self-registration.', {
                    purchaseCodes,
                    docBcotSaleAllocationItems
                });
                throw new Meteor.Error('ctn_self_reg_bcot_sale_inconsistent_item', 'Inconsistent BCOT sale allocation items for self-registration');
            }

            // Identify BCOT sale allocations to validate
            const docIdsBcotSaleAllocationToValidate = new Set();

            docBcotSaleAllocationItems.forEach(doc => docIdsBcotSaleAllocationToValidate.add(doc.bcotSaleAllocation_id));

            for (const doc_id of docIdsBcotSaleAllocationToValidate) {
                const bcotSaleAllocation = BcotSaleAllocation.getBcotSaleAllocationByDocId(doc_id, false);

                if (!bcotSaleAllocation.isForSelfRegistration) {
                    // Log error and throw exception
                    Catenis.logger.ERROR('Inconsistent BCOT sale allocation items for self-registration.', {
                        purchaseCodes,
                        bcotSaleAllocation
                    });
                    throw new Meteor.Error('ctn_self_reg_bcot_sale_inconsistent_item', 'Inconsistent BCOT sale allocation items for self-registration');
                }
            }

            // Now, add items
            for (const purchaseCode of purchaseCodes) {
                try {
                    Catenis.db.collection.SelfRegistrationBcotSale.insert({
                        purchaseCode,
                        status: SelfRegistrationBcotSale.itemStatus.available.name,
                        createdDate: new Date()
                    });
                }
                catch (err) {
                    // Log error and throw exception
                    Catenis.logger.ERROR('Error creating new self-registration BCOT sale item (purchaseCode: %s).', purchaseCode, err);
                    throw new Meteor.Error('ctn_self_reg_bcot_sale_create_error', `Error creating new self-registration BCOT sale item: ${err}`);
                }
            }

            this.checkMinimumAvailableQuantity();
        }
    }

    /**
     * Get next available self-registration BCOT sale item
     * @return {SelfRegistrationBcotSale} Reserved self-registration BCOT sale item object
     */
    static getNextAvailableItem() {
        let selfRegBcotSale;

        // Execute code in critical section to avoid DB concurrency
        dbCS.execute(() => {
            const docSelfRegBcotSale = Catenis.db.collection.SelfRegistrationBcotSale.findOne({
                status: this.itemStatus.available.name
            }, {
                sort: {
                    createdDate: 1
                }
            });

            if (docSelfRegBcotSale) {
                // Instantiate new self-registration BCOT sale object and set it as reserved
                selfRegBcotSale = new SelfRegistrationBcotSale(docSelfRegBcotSale);

                selfRegBcotSale.status = this.itemStatus.reserved.name;
            }
        });

        if (!selfRegBcotSale) {
            // No self-registration BCOT sale item available.
            //  Log error and throw exception
            Catenis.logger.ERROR('No self-registration BCOT sale item available');
            throw new Meteor.Error('ctn_self_reg_bcot_sale_none_available', 'No self-registration BCOT sale item available');
        }

        // Check if available quantity is bellow minimum
        this.checkMinimumAvailableQuantity();

        return selfRegBcotSale;
    }
}


// Definition of module (private) functions
//

function getAvailablePurchaseCodes() {
    return Catenis.db.collection.SelfRegistrationBcotSale.find({
        status: SelfRegistrationBcotSale.itemStatus.available.name
    })
    .map(doc => doc.purchaseCode);
}


// Module code
//

// Lock class
Object.freeze(SelfRegistrationBcotSale);
