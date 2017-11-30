/**
 * Created by claudio on 10/11/17.
 */

//console.log('[Asset.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import util from 'util';
// Third-party node modules
//import config from 'config';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { CatenisNode } from './CatenisNode';
import { Device } from './Device';
import { CCTransaction } from './CCTransaction';

// Config entries
/*const config_entryConfig = config.get('config_entry');

// Configuration settings
const cfgSettings = {
    property: config_entryConfig.get('property_name')
};*/


// Definition of function classes
//

// Asset function class
//
//  Constructor arguments:
//    docAsset: [Object] - Asset database doc/rec
export function Asset(docAsset) {
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
    this.createdDate = docAsset.createdDate;
}


// Public Asset object methods
//

/*Asset.prototype.pub_func = function () {
};*/


// Module functions used to simulate private Asset object methods
//  NOTE: these functions need to be bound to a Asset object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// Asset function class (public) methods
//

Asset.createAsset = function (ccTransact, name, description) {
    // Make sure that Colored Coins transaction is used to issued new assets
    if (ccTransact.issuingInfo === undefined) {
        //  Log error and throw exception
        Catenis.logger.ERROR('Cannot create asset from Colored Coins transaction that does not issue new assets', {
            ccTransact: ccTransact
        });
        new Meteor.Error('ctn_asset_cannot_create', 'Cannot create asset from Colored Coins transaction that does not issue new assets');
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
        Catenis.logger.ERROR('Error trying to create new asset database doc: %j.', docAsset, err);
        throw new Meteor.Error('ctn_asset_insert_error', 'Error trying to create new asset database doc', err.stack);
    }

    return docAsset.assetId;
};

Asset.getAssetIdFromCcTransaction = function (ccTransact) {
    if (ccTransact.issuingInfo) {
        return newAssetId(ccTransact.issuingInfo.ccAssetId);
    }
};

Asset.getAssetByAssetId = function (assetId) {
    const docAsset = Catenis.db.collection.Asset.findOne({assetId: assetId});

    if (docAsset === undefined) {
        // No asset available with the given asset ID. Log error and throw exception
        Catenis.logger.ERROR('Could not find asset with given asset ID', {assetId: assetId});
        throw new Meteor.Error('ctn_asset_not_found', util.format('Could not find asset with given asset ID (%s)', assetId));
    }

    return new Asset(docAsset);
};

Asset.getAssetByIssuanceAddressPath = function (addrPath) {
    const docAsset = Catenis.db.collection.Asset.findOne({'issuance.addrPath': addrPath});

    if (docAsset === undefined) {
        // No asset available with the given issuing address path. Log error and throw exception
        Catenis.logger.ERROR('Could not find asset with given issuing address path', {issuingAddrPath: addrPath});
        throw new Meteor.Error('ctn_asset_not_found', util.format('Could not find asset with given issuing address path (%s)', addrPath));
    }

    return new Asset(docAsset);
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
function newAssetId(ccAssetId) {
    const seed = Catenis.application.seed.toString() + ',Colored Coins asset ID:' + ccAssetId;

    return 'a' + Random.createWithSeeds(seed).id(19);
}


// Module code
//

// Lock function class
Object.freeze(Asset);
