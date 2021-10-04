/**
 * Created by claudio on 2018-10-23.
 */

//console.log('[BcotProduct.js]: This code just ran.');

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

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { BcotToken } from './BcotToken';

// Config entries
const bcotProdConfig = config.get('bcotProduct');

// Configuration settings
const cfgSettings = {
    stdSkuFormat: bcotProdConfig.get('stdSkuFormat')
};


// Definition of function classes
//

// BcotProduct function class
export function BcotProduct(docBcotProduct) {
    // Save BCOT token product data
    this.doc_id = docBcotProduct._id;
    this.sku = docBcotProduct.sku;
    this.amount = docBcotProduct.amount;
    this.active = docBcotProduct.active;
    this.createdDate = docBcotProduct.createdDate;
    this.deactivatedDate = docBcotProduct.deactivatedDate;
}


// Public BcotProduct object methods
//

BcotProduct.prototype.isActive = function () {
    return this.active;
};

BcotProduct.prototype.deactivate = function () {
    try {
        if (this.active) {
            Catenis.db.collection.BcotProduct.update({
                _id: this.doc_id
            }, {
                $set: {
                    active: false,
                    deactivatedDate: new Date()
                }
            })
        }
        else {
            // Log warning condition
            Catenis.logger.WARN('BCOT token product already inactive', this);
        }
    }
    catch (err) {
        // Log error and throw exception
        Catenis.logger.ERROR('Error while deactivating BCOT token product.', err);
        throw new Meteor.Error('ctn_bcot_prod_deactivate_error', 'Error while deactivating BCOT token product: ' + err.toString());
    }
};


// Module functions used to simulate private BcotProduct object methods
//  NOTE: these functions need to be bound to a BcotProduct object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// BcotProduct function class (public) methods
//

BcotProduct.getBcotProductByDocId = function (bcotProduct_id, onlyActive = true) {
    const selector = {
        _id: bcotProduct_id
    };

    if (onlyActive) {
        selector.active = true;
    }

    const docBcotProduct = Catenis.db.collection.BcotProduct.findOne(selector);

    if (!docBcotProduct) {
        // No BCOT token product found. Log error and throw exception
        Catenis.logger.ERROR('No BCOT token product found with the specified database doc/rec ID', {
            bcotProduct_id: bcotProduct_id,
            onlyActive: onlyActive
        });
        throw new Meteor.Error('ctn_bcot_prod_not_found', util.format('No BCOT token product found with the specified database doc/rec ID (%s)', bcotProduct_id));
    }

    return new BcotProduct(docBcotProduct);
};

BcotProduct.getBcotProductBySku = function (sku, onlyActive = true) {
    const selector = {
        sku: sku
    };

    if (onlyActive) {
        selector.active = true;
    }

    const docBcotProduct = Catenis.db.collection.BcotProduct.findOne(selector);

    if (!docBcotProduct) {
        // No BCOT token product found. Log error and throw exception
        Catenis.logger.ERROR('No BCOT token product found with the specified SKU', {
            sku: sku,
            onlyActive: onlyActive
        });
        throw new Meteor.Error('ctn_bcot_prod_not_found', util.format('No BCOT token product found with the specified SKU (%s)', sku));
    }

    return new BcotProduct(docBcotProduct);
};

// Create a new BCOT token product
//
//  Arguments:
//   amount [number] - BCOT token amount associated with this product as a whole number (no decimal places)
//   sku [string] - (optional) The SKU (Stock Keeping Unit) for this product. If not specified, a standard SKU is
//                   generated from the amount associated with the product
BcotProduct.createBcotProduct = function (amount, sku) {
    // Validate arguments
    const errArg = {};

    if (!isValidAmount(amount)) {
        errArg.amount = amount;
    }

    if (sku !== undefined && !isNomEmptyString(sku)) {
        errArg.sku = sku;
    }

    if (Object.keys(errArg).length > 0) {
        const errArgs = Object.keys(errArg);

        Catenis.logger.ERROR(util.format('BcotProduct.createBcotProduct method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw new Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    sku = sku || generateStdSku(amount);
    let docBcotProduct;

    try {
        docBcotProduct = {
            sku: sku,
            amount: new BigNumber(amount).multipliedBy(Math.pow(10, BcotToken.tokenDivisibility)).toNumber(),
            active: true,
            createdDate: new Date()
        };

        return Catenis.db.collection.BcotProduct.insert(docBcotProduct);
    }
    catch (err) {
        // Error creating license. Log error condition and throw exception
        if ((err.name === 'MongoError' || err.name === 'BulkWriteError') && err.code === 11000 && err.errmsg.search(/index:\s+sku/) >= 0) {
            // Duplicate SKU error.
            Catenis.logger.ERROR(util.format('Cannot create new BCOT token product; product SKU (%s) already in use', docBcotProduct.sku), err);
            throw new Meteor.Error('ctn_bcot_prod_duplicate_sku', util.format('Cannot create new BCOT token product; product SKU (%s) already in use', docBcotProduct.sku));
        }
        else {
            // Any other error
            Catenis.logger.ERROR('Error creating new BCOT token product: %s.', util.inspect(docBcotProduct), err);
            throw new Meteor.Error('ctn_bcot_prod_create_error', 'Error creating new BCOT token product: ' + err.toString());
        }
    }
};


// BcotProduct function class (public) properties
//

/*BcotProduct.prop = {};*/


// Definition of module (private) functions
//

function isValidAmount(amount) {
    return Number.isInteger(amount) && amount > 0;
}

function isNomEmptyString(str) {
    return typeof str === 'string' && str.length > 0;
}

// Arguments:
//  amount [number] - BCOT token amount as a whole number
function generateStdSku(amount) {
    amount = parseInt(amount);
    let nStr;

    if (amount < 10000) {
        nStr = amount.toString();
    }
    else if (amount < 1000000) {
        nStr = new BigNumber(amount).dividedToIntegerBy(1000).toString() + 'K';
    }
    else if (amount < 1000000000) {
        nStr = new BigNumber(amount).dividedToIntegerBy(1000000).toString() + 'M';
    }
    else if (amount < 1000000000000) {
        nStr = new BigNumber(amount).dividedToIntegerBy(1000000000).toString() + 'G';
    }
    else if (amount < 1000000000000000) {
        nStr = new BigNumber(amount).dividedToIntegerBy(1000000000000).toString() + 'T';
    }
    else {
        nStr = new BigNumber(amount).dividedToIntegerBy(1000000000000000).toString() + 'P';
    }

    return util.format(cfgSettings.stdSkuFormat, '0000'.substring(nStr.length) + nStr, skuSuffix());
}

// Generate suffix for standard SKU dependent on the Catenis environment
function skuSuffix() {
    let prefix;

    switch (Catenis.application.environment) {
        case 'production':
            prefix = 'BCOT';
            break;

        case 'sandbox':
            prefix = 'TBCT';
            break;

        default:
            prefix = 'XBCT';
            break;
    }

    return prefix;
}


// Module code
//

// Lock function class
Object.freeze(BcotProduct);
