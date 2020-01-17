/**
 * Created by Claudio on 2019-10-31.
 */

//console.log('[OffChainAddress.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
//import config from 'config';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
//import { Catenis } from './Catenis';
import {
    BaseDeviceOffChainAddress
} from './BaseOffChainAddress';
import { KeyStore } from './KeyStore';

// Config entries
/*const config_entryConfig = config.get('config_entry');

// Configuration settings
const cfgSettings = {
    property: config_entryConfig.get('property_name')
};*/


// Definition of function classes
//

// DeviceOffChainAddress derived class
export class DeviceOffChainAddress extends OffChainAddress {
    constructor (ctnNodeIndex, clientIndex, deviceIndex) {
        super();

        // noinspection JSUnusedGlobalSymbols
        this._baseAddr = BaseDeviceOffChainAddress.getInstance(ctnNodeIndex, clientIndex, deviceIndex, KeyStore.deviceOffChainAddressRootPath(ctnNodeIndex, clientIndex, deviceIndex));
    }
}

// OffChainAddress function class
function OffChainAddress() {
    this._baseAddr = undefined;

    //  NOTE: arrow functions should NOT be used for the getter/setter of the defined properties.
    //      This is to avoid that, if `this` is referred from within the getter/setter body, it
    //      refers to the object from where the properties have been defined rather than to the
    //      object from where the property is being accessed. Normally, this does not represent
    //      an issue (since the object from where the property is accessed is the same object
    //      from where the property has been defined), but it is especially dangerous if the
    //      object can be cloned.
    Object.defineProperties(this, {
        type: {
            get: function () {
                // noinspection JSPotentiallyInvalidUsageOfThis
                return this._baseAddr.type;
            },
            enumerable: true
        },
        parentPath: {
            get: function () {
                // noinspection JSPotentiallyInvalidUsageOfThis
                return this._baseAddr.parentPath;
            },
            enumerable: true
        },
        lastIssuedAddrIndex: {
            get: function () {
                // noinspection JSPotentiallyInvalidUsageOfThis
                return this._baseAddr.lastIssuedAddrIndex;
            },
            enumerable: true
        }
    });
}


// Public OffChainAddress object methods
//

OffChainAddress.prototype.newAddressKeys = function () {
    return this._baseAddr.newAddressKeys();
};


// Module functions used to simulate private OffChainAddress object methods
//  NOTE: these functions need to be bound to a OffChainAddress object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// OffChainAddress function class (public) methods
//

/*OffChainAddress.class_func = function () {
};*/


// OffChainAddress function class (public) properties
//

/*OffChainAddress.prop = {};*/


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function classes
Object.freeze(OffChainAddress);
Object.freeze(DeviceOffChainAddress);
