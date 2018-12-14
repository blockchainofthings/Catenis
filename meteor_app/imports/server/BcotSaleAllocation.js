/**
 * Created by claudio on 2018-10-24.
 */

//console.log('[BcotSaleAllocation.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import util from 'util';
// Third-party node modules
import config from 'config';
import BigNumber from 'bignumber.js';
// Meteor packages
import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { BcotSaleAllocationShared } from '../both/BcotSaleAllocationShared';
import { CriticalSection } from './CriticalSection';

// Config entries
const bcotSaleAllocConfig = config.get('bcotSaleAllocation');
const bcotSaleAllocProdsRprtConfig = bcotSaleAllocConfig.get('allocatedProductsReport');

// Configuration settings
export const cfgSettings = {
    allocatedProductsReport: {
        baseFilename: bcotSaleAllocProdsRprtConfig.get('baseFilename'),
        fileExtension: bcotSaleAllocProdsRprtConfig.get('fileExtension'),
        headers: bcotSaleAllocProdsRprtConfig.get('headers')
    }
};


// Definition of function classes
//

// BcotSaleAllocation function class
export function BcotSaleAllocation(docBcotSaleAllocation, loadItems = true) {
    // Save BCOT token product data
    this.doc_id = docBcotSaleAllocation._id;
    this.summary = docBcotSaleAllocation.summary;
    this.status = docBcotSaleAllocation.status;
    this.allocationDate = docBcotSaleAllocation.allocationDate;

    if (loadItems) {
        this.loadItems();
    }
}


// Public BcotSaleAllocation object methods
//

BcotSaleAllocation.prototype.loadItems = function () {
    if (!this.items) {
        this.items = [];

        Catenis.db.collection.BcotSaleAllocationItem.find({
            bcotSaleAllocation_id: this.doc_id
        }, {
            sort: {
                sku: 1
            }
        }).fetch().forEach((doc) => {
            this.items.push({
                doc_id: doc._id,
                sku: doc.sku,
                purchaseCode: doc.purchaseCode,
                redemption: doc.redemption
            });
        });
    }
};

BcotSaleAllocation.prototype.setInUse = function () {
    try {
        // Make sure that status is up to date
        this.status = Catenis.db.collection.BcotSaleAllocation.findOne({_id: this.doc_id}).status;

        if (this.status === BcotSaleAllocation.status.new.name) {
            // Update status in database doc/rec
            Catenis.db.collection.BcotSaleAllocation.update({
                _id: this.doc_id
            }, {
                $set: {
                    status: BcotSaleAllocation.status.in_use.name,
                    lastStatusChangedDate: new Date()
                }
            });

            // Update status locally too
            this.status = BcotSaleAllocation.status.in_use.name;
        }
    }
    catch (err) {
        // Log error condition
        Catenis.logger.ERROR('Error updating status of BcotSaleAllocation (doc_id: %s).', this.doc_id, err);
    }
};

// Returns a CSV-formatted text document containing a list of BCOT token products allocated for sale
//
//  Arguments:
//   addHeaders: [Boolean] - Indicates whether generated report should include a line with column headers as its first line
BcotSaleAllocation.prototype.generateAllocatedProductsReport = function (addHeaders = true) {
    let reportLines;

    // Make sure that items are loaded
    if (!this.items) {
        this.loadItems();
    }

    // Now, generate report
    reportLines = this.items.filter(item => !item.redemption.redeemed).map(item => util.format('"%s","%s"\n', item.sku, item.purchaseCode));

    if (addHeaders && reportLines.length > 0) {
        reportLines.unshift(cfgSettings.allocatedProductsReport.headers.map(header => '"' + header + '"').join(',') + '\n');
    }

    return reportLines.join('');
};


// Module functions used to simulate private BcotSaleAllocation object methods
//  NOTE: these functions need to be bound to a BcotSaleAllocation object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// BcotSaleAllocation function class (public) methods
//

BcotSaleAllocation.getBcotSaleAllocationByDocId = function (bcotSaleAllocation_id, loadItems = true) {
    const docBcotSaleAllocation = Catenis.db.collection.BcotSaleAllocation.findOne({
        _id: bcotSaleAllocation_id
    });

    if (!docBcotSaleAllocation) {
        // No BCOT token sale allocation found. Log error and throw exception
        Catenis.logger.ERROR('No BCOT token sale allocation found with the specified database doc/rec ID', {
            bcotSaleAllocation_id: bcotSaleAllocation_id
        });
        throw new Meteor.Error('ctn_bcot_sale_alloc_not_found', util.format('No BCOT token sale allocation found with the specified database doc/rec ID (%s)', bcotSaleAllocation_id));
    }

    return new BcotSaleAllocation(docBcotSaleAllocation, loadItems);
};

// Return:
//   totalAmount [Object(BigNumber)] - total amount, in BCOT token "satoshis", of unredeemed BCOT token
BcotSaleAllocation.getUnredeemedAllocatedBcotAmount = function () {
    // Compute quantity of unredeemed BCOT token products per SKU
    const skuQuantity = new Map();

    Catenis.db.collection.BcotSaleAllocationItem.find({
        'redemption.redeemed': false
    }, {
        fields: {
            sku: 1
        }
    }).fetch().forEach((doc) => {
        if (skuQuantity.has(doc.sku)) {
            skuQuantity.set(doc.sku, skuQuantity.get(doc.sku) +1);
        }
        else {
            skuQuantity.set(doc.sku, 1);
        }
    });

    let totalAmount = new BigNumber(0);

    if (skuQuantity.size > 0) {
        // Retrieve BCOT token products
        const skuAmount = new Map();

        Catenis.db.collection.BcotProduct.find({
            sku: {
                $in: Array.from(skuQuantity.keys())
            }
        }, {
            fields: {
                sku: 1,
                amount: 1
            }
        }).forEach((doc) => {
            skuAmount.set(doc.sku, doc.amount);
        });

        for (let [sku, quantity] of skuQuantity) {
            totalAmount = new BigNumber(skuAmount.get(sku)).multipliedBy(quantity).plus(totalAmount);
        }
    }

    return totalAmount;
};

// Create a new BCOT token sale allocation
//
//  Arguments:
//   productsToAllocate [Object] { - A dictionary specifying the quantity of each BCOT token product (identified by its SKU) that should be allocated
//     <sku_1>: [Number], - Number of BCOT token products with that SKU to allocate
//     <sku_2>: [Number], - Number of BCOT token products with that SKU to allocate
//     ...
//   }
BcotSaleAllocation.createBcotSaleAllocation = function (productsToAllocate) {
    productsToAllocate = conformProductsToAllocate(productsToAllocate);

    let docBcotSaleAllocation;

    try {
        docBcotSaleAllocation = {
            summary: productsToAllocate,
            status: BcotSaleAllocation.status.new.name,
            allocationDate: new Date()
        };

        const doc_id = Catenis.db.collection.BcotSaleAllocation.insert(docBcotSaleAllocation);

        // Create allocation items database doc/recs
        productsToAllocate.forEach((prodToAllocate) => {
            const purchaseCodes = newPurchaseCodeList(prodToAllocate.quantity);

            for (let idx = 0; idx < prodToAllocate.quantity; idx++) {
                const docBcotSaleAllocationItem = {
                    bcotSaleAllocation_id: doc_id,
                    sku: prodToAllocate.sku,
                    purchaseCode: purchaseCodes[idx],
                    redemption: {
                        redeemed: false
                    }
                };

                try {
                    Catenis.db.collection.BcotSaleAllocationItem.insert(docBcotSaleAllocationItem);
                }
                catch (err) {
                    // Error creating BCOT token sale allocation item. Log error and throw exception
                    Catenis.logger.ERROR('Error creating new BCOT token sale allocation item: %s.', util.inspect(docBcotSaleAllocationItem), err);
                    throw new Error('Error creating new BCOT token sale allocation item: ' + err.toString());
                }
            }
        });

        // Make sure that stock of BCOT tokens for sale is high enough to cover newly allocated products
        Catenis.bcotSaleStock.checkBcotSaleStock();

        return doc_id;
    }
    catch (err) {
        // Error creating license. Log error condition and throw exception
        Catenis.logger.ERROR('Error creating new BCOT token sale allocation: %s.', util.inspect(docBcotSaleAllocation), err);
        throw new Meteor.Error('ctn_bcot_sale_alloc_create_error', 'Error creating new BCOT token sale allocation: ' + err.toString());
    }
};

// Retrieve information about BCOT tokens that are being redeemed
//
//  Arguments:
//   purchaseCodes [String|Array(String)] - Purchase codes received after purchase of BCOT tokens that are being redeemed
//
//  Return:
//   undefined - If one or more of the BCOT purchaseCodes are not valid (or had already been redeemed), or
//   redeemBcotInfo: {
//     docBcotSaleAllocItems: [Array] - List of BcotSaleAllocationItem database doc/recs associated with the purchase codes
//     redeemedAmount: [Object(BigNumber)] - Total amount of BCOT tokens being redeemed
//   }
//
// NOTE: make sure that this method is called from code executed from the BcotSaleAllocation.bcotAllocItemCS
//  critical section object
BcotSaleAllocation.getRedeemBcotInfo = function (purchaseCodes) {
    purchaseCodes = Array.isArray(purchaseCodes) ? purchaseCodes : [purchaseCodes];

    const docBcotSaleAllocItems = Catenis.db.collection.BcotSaleAllocationItem.find({
        purchaseCode: {
            $in: purchaseCodes
        },
        'redemption.redeemed': false
    }, {
        fields: {
            _id: 1,
            sku: 1,
            purchaseCode: 1
        }
    }).fetch();

    if (docBcotSaleAllocItems && docBcotSaleAllocItems.length === purchaseCodes.length) {
        const skuAmount = new Map();

        Catenis.db.collection.BcotProduct.find({
            sku: {
                $in: docBcotSaleAllocItems.map(doc => doc.sku)
            }
        }, {
            fields: {
                sku: 1,
                amount: 1
            }
        }).forEach((doc) => {
            skuAmount.set(doc.sku, doc.amount);
        });

        // Compute total amount of BCOT tokens to redeem
        let redeemedAmount = new BigNumber(0);

        docBcotSaleAllocItems.forEach((doc) => {
            redeemedAmount = redeemedAmount.plus(skuAmount.get(doc.sku));
        });

        return {
            docBcotSaleAllocItems: docBcotSaleAllocItems,
            redeemedAmount: redeemedAmount
        }
    }
};

// Mark previous allocated BCOT token products as redeemed
//
//  Arguments:
//   redeemBcotInfo [Object] { - Redeem BCOT info object as returned by the BcotSaleAllocation.getRedeemBcotInfo method
//     docBcotSaleAllocItems: [Array(Object)],
//     redeemedAmount: [Object(BigNumber)]
//   }
//   clientId [String] - ID of client that redeemed the BCOT tokens
//   redeemBcotTxid [String] - Blockchain ID of the redeem BCOT transaction
//   redeemDate [Date] - (optional) Date and time when BCOT tokens have been redeemed. If not specified, the current
//                        date and time is used
//
// NOTE: make sure that this method is called from code executed from the BcotSaleAllocation.bcotAllocItemCS
//  critical section object
BcotSaleAllocation.setBcotRedeemed = function (redeemBcotInfo, clientId, redeemBcotTxid, redeemedDate) {
    Catenis.db.collection.BcotSaleAllocationItem.update({
        _id: {
            $in: redeemBcotInfo.docBcotSaleAllocItems.map(doc => doc._id)
        }
    }, {
        $set: {
            redemption: {
                redeemed: true,
                clientId: clientId,
                redeemedDate: redeemedDate || new Date(),
                redeemBcotTxid: redeemBcotTxid
            }
        }
    }, {
        multi: true
    });
};


// BcotSaleAllocation function class (public) properties
//

// Critical section object to avoid concurrent access to BcotSaleAllocationItem database collection
BcotSaleAllocation.bcotAllocItemCS = new CriticalSection();

BcotSaleAllocation.status = BcotSaleAllocationShared.status;


// Definition of module (private) functions
//

function environmentPrefix() {
    let prefix;

    switch (Catenis.application.environment) {
        case 'production':
            prefix = 'P';
            break;

        case 'sandbox':
            prefix = 'S';
            break;

        case 'development':
            prefix = 'D';
            break;

        default:
            prefix = 'X';
            break;
    }

    return prefix;
}

function formatPurchaseCode(code) {
    return util.format('%s-%s-%s-%s', code.substring(0, 5), code.substring(5, 10), code.substring(10, 15), code.substring(15));
}

function newPurchaseCode(checkExistence = true) {
    let code = environmentPrefix() + Random.id(19);

    if (checkExistence) {
        while (Catenis.db.collection.BcotSaleAllocationItem.findOne({purchaseCode: code}, {fields: {_id: 1}})) {
            Catenis.logger.DEBUG('Newly generated BCOT token purchase code (%s) already exists. Trying again.', code);

            code = environmentPrefix() + Random.id(19);
        }
    }

    return formatPurchaseCode(code);
}

function newPurchaseCodeList(count, checkExistence = true) {
    let codes = new Set();

    if (count > 1) {
        for (let idx = 0; idx < count; idx++) {
            let code = newPurchaseCode(false);

            while (codes.has(code)) {
                Catenis.logger.DEBUG('Newly generated BCOT token purchase codes list item (%s) duplicates another code on the list. Trying again', code, {
                    list: codes
                });

                code = newPurchaseCode(false);
            }

            codes.add(code);
        }

        if (checkExistence && Catenis.db.collection.BcotSaleAllocationItem.findOne({purchaseCode: {$in: Array.from(codes)}}, {fields: {_id: 1}})) {
            Catenis.logger.DEBUG('Newly generated list of BCOT token purchase codes has one or more codes that already exist. Trying again, this time checking each code individually.', codes);
            codes.clear();

            for (let idx = 0; idx < count; idx++) {
                let code = newPurchaseCode();

                while (codes.has(code)) {
                    Catenis.logger.DEBUG('Newly generated BCOT token purchase codes list item (%s) duplicates another code on the list. Trying again', code, {
                        list: codes
                    });

                    code = newPurchaseCode();
                }

                codes.add(code);
            }
        }
    }
    else {
        codes.add(newPurchaseCode());
    }

    return Array.from(codes);
}

function conformProductsToAllocate(productsToAllocate) {
    if (typeof productsToAllocate !== 'object') {
        // Invalid argument type. Throw error
        throw new Error('Invalid productsToAllocate argument: incorrect type');
    }

    const conformedProductsToAllocate = [];
    const invalidSkus = [];
    const skusWithInvalidQuantity = [];

    Object.keys(productsToAllocate).forEach((sku) => {
        if (!isValidSku(sku)) {
            invalidSkus.push(sku);
        }
        else {
            const quantity = productsToAllocate[sku];

            if (!isValidQuantity(quantity)) {
                skusWithInvalidQuantity.push(sku);
            }

            conformedProductsToAllocate.push({
                sku: sku,
                quantity: quantity
            });
        }
    });

    if (invalidSkus.length > 0 || skusWithInvalidQuantity.length > 0) {
        let errMsg;

        if (invalidSkus.length > 0) {
            errMsg = util.format('invalid BCOT token product%s (%s)', invalidSkus.length > 0 ? 's' : '', invalidSkus.join(', '));
        }

        if (skusWithInvalidQuantity.length > 0) {
            if (errMsg) {
                errMsg += '; ';
            }

            errMsg += util.format('invalid quantity for BCOT token product%s (%s)', skusWithInvalidQuantity.length > 0 ? 's' : '', skusWithInvalidQuantity.join(', '));
        }

        // Throw error
        throw new Error(util.format('Invalid productsToAllocate argument: %s', errMsg));
    }

    return conformedProductsToAllocate;
}

function isValidSku(sku) {
    return !!Catenis.db.collection.BcotProduct.findOne({sku: sku, active: true}, {fields: {_id: 1}});
}

function isValidQuantity(quantity) {
    return Number.isInteger(quantity) && quantity > 0;
}


// Module code
//

// Lock function class
Object.freeze(BcotSaleAllocation);
