/**
 * Created by Claudio on 2017-11-10.
 */

//console.log('[Asset.js]: This code just ran.');

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
import { CatenisNode } from './CatenisNode';
import { Device } from './Device';
import { CCTransaction } from './CCTransaction';

// Config entries
const assetConfig = config.get('asset');

// Configuration settings
export const cfgSettings = {
    largestAssetAmount: assetConfig.get('largestAssetAmount'),
    maxQueryIssuanceCount: assetConfig.get('maxQueryIssuanceCount'),
    maxRetListEntries: assetConfig.get('maxRetListEntries')
};


// Definition of function classes
//

// Asset function class
//
//  Constructor arguments:
//    docAsset: [Object] - Asset database doc/rec
export function Asset(docAsset) {
    this.doc_id = docAsset._id;
    this.assetId = docAsset.assetId;
    this.ccAssetId = docAsset.ccAssetId;
    this.type = docAsset.type;
    this.name = docAsset.name;
    this.description = docAsset.description;
    this.issuingType = docAsset.issuingType;

    if (this.type === Asset.type.system) {
        this.issuingCtnNode = CatenisNode.getCatenisNodeByIndex(docAsset.issuance.entityId);
    }
    else if (this.type === Asset.type.device) {
        this.issuingDevice = Device.getDeviceByDeviceId(docAsset.issuance.entityId);
    }

    if (this.issuingType === CCTransaction.issuingAssetType.unlocked) {
        this.issuanceAddress = Catenis.keyStore.getCryptoKeysByPath(docAsset.issuance.addrPath).getAddress();
    }

    this.divisibility = docAsset.divisibility;
    this.isAggregatable = docAsset.isAggregatable;
    this.isNonFungible = docAsset.isNonFungible;
    this.createdDate = docAsset.createdDate;
}


// Public Asset object methods
//

// Converts asset amount expressed as a decimal number into an integer number of the asset's smallest division
//  (according to the asset divisibility)
//
//  Arguments:
//    amount: [Object(BigNumber)|Number] - Fractional asset amount
//    returnBigNumber: [Boolean] - Indicates whether a big number (instead of a regular number) should be returned
//
//  Return:
//    convAmount: [Number|Object(BigNumber)]
Asset.prototype.amountToSmallestDivisionAmount = function (amount, returnBigNumber = false) {
    return Asset.amountToSmallestDivisionAmount(amount, this.divisibility, returnBigNumber);
};

// Converts asset amount expressed an integer number of the asset's smallest division (according to
//  the asset divisibility) into a decimal number
//
//  Arguments:
//    amount: [Object(BigNumber)|Number] - Asset amount represented as an integer number of the asset's smallest division (according to the asset divisibility)
//    returnBigNumber: [Boolean] - Indicates whether a big number (instead of a regular number) should be returned
//
//  Return:
//    convAmount: [Number|Object(BigNumber)]
Asset.prototype.smallestDivisionAmountToAmount = function (amount, returnBigNumber = false) {
    return Asset.smallestDivisionAmountToAmount(amount, this.divisibility, returnBigNumber);
};

// Format asset amount to be displayed
//
//  Arguments:
//    amount: [Object(BigNumber)|Number] - Asset amount represented as an integer number of the asset's smallest division (according to the asset divisibility)
//
//  Return:
//    strAmount: [String]
Asset.prototype.formatAmount = function (amount) {
    return this.smallestDivisionAmountToAmount(amount, true).toFormat(this.divisibility);
};


// Module functions used to simulate private Asset object methods
//  NOTE: these functions need to be bound to a Asset object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// Asset function class (public) methods
//

// Create new Asset local database entry
//
//  Arguments:
//   ccTransaction: [Object(CCTransaction)] - A Colored Coin transaction object used to issue asset
//   name: [String] - (optional) The asset name. If not defined, the asset name is gotten from the Colored Coins
//                     metadata (if any) in the Colored Coins transaction
//   description: [String] - (optional) The asset description. If not defined, the asset name is gotten from the Colored Coins
//                            metadata (if any) in the Colored Coins transaction
Asset.createAsset = function (ccTransact, name, description) {
    // Make sure that Colored Coins transaction is used to issue new assets
    if (ccTransact.issuingInfo === undefined) {
        //  Log error and throw exception
        Catenis.logger.ERROR('Cannot create asset from Colored Coins transaction that does not issue new assets', {
            ccTransact: ccTransact
        });
        throw new Meteor.Error('ctn_asset_cannot_create', 'Cannot create asset from Colored Coins transaction that does not issue new assets');
    }

    if ((name === undefined || description === undefined) && ccTransact.ccMetadata !== undefined) {
        // Get asset name and/or description from Colored Coins metadata
        if (name === undefined) {
            name = ccTransact.ccMetadata.assetMetadata.assetName;
        }

        if (description === undefined) {
            description = ccTransact.ccMetadata.assetMetadata.assetDescription;
        }
    }

    const addrPathParts = ccTransact.inputs[0].addrInfo.pathParts;

    const docAsset = {
        assetId: newAssetId(ccTransact.issuingInfo.ccAssetId),
        ccAssetId: ccTransact.issuingInfo.ccAssetId,
        type: ('deviceIndex' in addrPathParts) ? Asset.type.device : Asset.type.system,
        name: name,
        description: description,
        issuingType: ccTransact.issuingInfo.type,
        issuance: {},
        divisibility: ccTransact.issuingInfo.divisibility,
        isAggregatable: ccTransact.issuingInfo.isAggregatable,
        isNonFungible: ccTransact.issuingInfo.isNonFungible,
        createdDate: new Date()
    };

    docAsset.issuance.entityId = docAsset.type === Asset.type.system ? addrPathParts.ctnNodeIndex
        : CatenisNode.getCatenisNodeByIndex(addrPathParts.ctnNodeIndex).getClientByIndex(addrPathParts.clientIndex).getDeviceByIndex(addrPathParts.deviceIndex).deviceId;

    if (docAsset.issuingType === CCTransaction.issuingAssetType.unlocked) {
        docAsset.issuance.addrPath = ccTransact.inputs[0].addrInfo.path;
    }

    try {
        docAsset._id = Catenis.db.collection.Asset.insert(docAsset);
    }
    catch (err) {
        // Error inserting new Asset database doc/rec.
        //  Log error and throw exception
        Catenis.logger.ERROR('Error trying to create new asset database doc:', docAsset, err);
        throw new Meteor.Error('ctn_asset_insert_error', 'Error trying to create new asset database doc', err.stack);
    }

    return docAsset.assetId;
};

Asset.getAssetIdFromCcTransaction = function (ccTransact) {
    const ccAssetId = Asset.getCcAssetIdFromCcTransaction(ccTransact);

    if (ccAssetId !== undefined) {
        return newAssetId(ccAssetId);
    }
};

Asset.getCcAssetIdFromCcTransaction = function (ccTransact) {
    // Get Colored Coins asset ID either from issuing asset or from asset associated with
    //  first asset transfer input sequence
    return ccTransact.issuingInfo ? ccTransact.issuingInfo.ccAssetId
        : (ccTransact.transferInputSeqs.length > 0 ? ccTransact.getTransferInputs(ccTransact.transferInputSeqs[0].startPos)[0].txout.ccAssetId : undefined);
};

/**
 * Retrieve the asset object with the given database doc/rec ID
 * @param {string} doc_id The asset database doc/rec ID
 * @returns {Asset} The asset object
 */
Asset.getAssetByDocId = function (doc_id) {
    const docAsset = Catenis.db.collection.Asset.findOne({_id: doc_id});

    if (!docAsset) {
        throw new Error(`Cannot find asset with the given database doc/rec ID: ${doc_id}`);
    }

    return new Asset(docAsset);
}

Asset.getAssetByAssetId = function (assetId, restrictToDeviceAsset = false) {
    const selector = {
        assetId: assetId
    };

    if (restrictToDeviceAsset) {
        selector.type = Asset.type.device
    }

    const docAsset = Catenis.db.collection.Asset.findOne(selector);

    if (docAsset === undefined) {
        // No asset available with the given asset ID. Log error and throw exception
        Catenis.logger.ERROR('Could not find asset with given asset ID', {assetId: assetId});
        throw new Meteor.Error('ctn_asset_not_found', util.format('Could not find asset with given asset ID (%s)', assetId));
    }

    return new Asset(docAsset);
};

Asset.getAssetByCcAssetId = function (ccAssetId, restrictToDeviceAsset = false) {
    const selector = {
        ccAssetId: ccAssetId
    };

    if (restrictToDeviceAsset) {
        selector.type = Asset.type.device
    }

    const docAsset = Catenis.db.collection.Asset.findOne(selector);

    if (docAsset === undefined) {
        // No asset available with the given Colored Coins asset ID. Log error and throw exception
        Catenis.logger.ERROR('Could not find asset with given Colored Coins asset ID', {ccAssetId: ccAssetId});
        throw new Meteor.Error('ctn_asset_not_found', util.format('Could not find asset with given Colored Coins asset ID (%s)', ccAssetId));
    }

    return new Asset(docAsset);
};

Asset.getAssetByIssuanceAddressPath = function (addrPath) {
    const docAsset = Catenis.db.collection.Asset.findOne({'issuance.addrPath': addrPath});

    if (docAsset === undefined) {
        // No asset available with the given issuing address path. Log error and throw exception
        Catenis.logger.DEBUG('Could not find asset with given issuing address path', {issuingAddrPath: addrPath});
        throw new Meteor.Error('ctn_asset_not_found', util.format('Could not find asset with given issuing address path (%s)', addrPath));
    }

    return new Asset(docAsset);
};

// Converts asset amount expressed as a decimal number into an integer amount expressed in the asset's
//  smallest division (according to the asset divisibility
//
//  Arguments:
//    amount: [Object(BigNumber)|Number] - Fractional asset amount
//    precision: [Number] - The number of decimal places that are used to specify a fractional amount of this asset
//    returnBigNumber: [Boolean] - Indicates whether a big number (instead of a regular number) should be returned
//
//  Return:
//    convAmount: [Number|Object(BigNumber)]
Asset.amountToSmallestDivisionAmount = function (amount, precision, returnBigNumber = false) {
    const bnAmount =  (BigNumber.isBigNumber(amount) ? amount : new BigNumber(amount)).times(Math.pow(10, precision)).decimalPlaces(0, BigNumber.ROUND_FLOOR);

    return bnAmount.isGreaterThan(cfgSettings.largestAssetAmount) ? NaN : (returnBigNumber ? bnAmount : bnAmount.toNumber());
};

// Converts asset amount expressed an integer number of the asset's smallest division (according to
//  the asset divisibility) into a decimal number
//
//  Arguments:
//    amount: [Object(BigNumber)|Number] - Asset amount represented as an integer number of the asset's smallest division (according to the asset divisibility)
//    returnBigNumber: [Boolean] - Indicates whether a big number (instead of a regular number) should be returned
//
//  Return:
//    convAmount: [Number|Object(BigNumber)]
Asset.smallestDivisionAmountToAmount = function (amount, precision, returnBigNumber = false) {
    const bnAmount = (BigNumber.isBigNumber(amount) ? amount : new BigNumber(amount)).dividedBy(Math.pow(10, precision));

    return returnBigNumber ? bnAmount : bnAmount.toNumber();
};


// Asset function class (public) properties
//

Asset.type = Object.freeze({
    system: 'system',
    device: 'device'
});


// Definition of module (private) functions
//

// Synthesize new asset ID from the Colored Coins ID
export function newAssetId(ccAssetId) {
    const seed = Catenis.application.commonSeed.toString() + ',Colored Coins asset ID:' + ccAssetId;

    return 'a' + Random.createWithSeeds(seed).id(19);
}


// Module code
//

// Lock function class
Object.freeze(Asset);
