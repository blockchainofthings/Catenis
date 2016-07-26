/**
 * Created by claudio on 23/06/16.
 */

//console.log('[Device.js]: This code just ran.');

// Module variables
//

// References to external modules
/*var config = Npm.require('config');

// Config entries
var config_entryConfig = config.get('config_entry');

// Configuration settings
var cfgSettings = {
    property: config_entryConfig.get('property_name')
};*/


// Definition of function classes
//

// Device function class
function Device(docDevice, client) {
    // Save associated client instance
    this.client = client != undefined && client.doc_id === docDevice.client_id ? client
            : Catenis.module.Client.getClientByClientIndex(docDevice.index.clientIndex);
    
    // Save relevant info from Device doc/rec
    this.doc_id = docDevice._id;
    this.deviceId = docDevice.deviceId;
    this.deviceIndex = docDevice.index.deviceIndex;
    this.apiAccessGenKey = docDevice.apiAccessGenKey;
    this.prodUniqueId = docDevice.props != undefined ? docDevice.props.prodUniqueId : undefined;
    this.status = docDevice.status;

    Object.defineProperty(this, 'apiAccessSecret', {
        get: function () {
            // Use API access secret from client is an API access generator key is not defined
            //  for the device
            return docDevice.apiAccessGenKey != null ? crypto.createHmac('sha512', docDevice.apiAccessGenKey).update('And here it is: the Catenis API key for device' + this.clientId).digest('hex')
                    : this.client.apiAccessSecret;
        }
    });

    // Instantiate objects to manage blockchain addresses for device
    this.mainAddr = Catenis.module.BlockchainAddress.DeviceMainAddress.getInstance(this.client.clientIndex, this.deviceIndex);
    this.readConfirmAddr = Catenis.module.BlockchainAddress.DeviceReadConfirmAddress.getInstance(this.client.clientIndex, this.deviceIndex);
    this.assetAddr = Catenis.module.BlockchainAddress.DeviceAssetAddress.getInstance(this.client.clientIndex, this.deviceIndex);
    this.assetIssuanceAddr = Catenis.module.BlockchainAddress.DeviceAssetIssuanceAddress.getInstance(this.client.clientIndex, this.deviceIndex);
}


// Public Device object methods
//

Device.prototype.delete = function () {
    if (this.status !== 'deleted') {
        // Retrieve current state of fields that shall be changed
        var docDevice = Catenis.db.collection.Device.findOne({_id: this.doc_id}, {fields: {'props.prodUniqueId': 1, status: 1}}),
            delField = {};

        if (docDevice.props != undefined && docDevice.props.prodUniqueId != undefined) {
            delField.prodUniqueId = docDevice.props.prodUniqueId;
        }

        delField.status = docDevice.status;
        delField.deletedDate = new Date(Date.now());

        // Update Device doc/rec
        Catenis.db.collection.Device.update({_id: this.doc_id}, {$set: {status: 'deleted', _deleted: delField}, $unset: {'props.prodUniqueId': ''}});

        // Update local variables
        this.prodUniqueId = undefined;
        this.status = 'deleted';
    }
    else {
        // Device already deleted
        Catenis.logger.WARN('Trying to delete device that is already deleted');
    }
};

// TODO: add methods to: send message, log (send to itself) message, read message, issue asset (both locked and unlocked), register/import asset issued elsewhere, transfer asset, etc.


// Module functions used to simulate private Device object methods
//  NOTE: these functions need to be bound to a Device object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// Device function class (public) methods
//

/*Device.class_func = function () {
};*/


// Device function class (public) properties
//

/*Device.prop = {};*/


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Save module function class reference
if (typeof Catenis === 'undefined')
    Catenis = {};

if (typeof Catenis.module === 'undefined')
    Catenis.module = {};

Catenis.module.Device = Object.freeze(Device);
