/**
 * Created by claudio on 2018-10-26.
 */

//console.log('[BcotToken.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import config from 'config';
import BigNumber from 'bignumber.js';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
//import { Catenis } from './Catenis';
import { CatenisNode } from './CatenisNode';

// Config entries
const bcotTokenConfig = config.get('bcotToken');

// Configuration settings
const cfgSettings = {
    bcotOmniPropertyId: bcotTokenConfig.get('bcotOmniPropertyId'),
    storeBcotAddress: bcotTokenConfig.get('storeBcotAddress')
};


// Definition of function classes
//

// BcotToken function class
export function BcotToken() {
}


// Public BcotToken object methods
//

/*BcotToken.prototype.pub_func = function () {
};*/


// Module functions used to simulate private BcotToken object methods
//  NOTE: these functions need to be bound to a BcotToken object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// BcotToken function class (public) methods
//

BcotToken.bcotToServiceCredit = function (bcotAmount) {
    return new BigNumber(bcotAmount).dividedToIntegerBy(Math.pow(10, (BcotToken.tokenDivisibility - CatenisNode.serviceCreditAssetDivisibility))).toNumber();
};


// BcotToken function class (public) properties
//

BcotToken.tokenDivisibility = 8;


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Definition of properties
Object.defineProperties(BcotToken, {
    bcotOmniPropertyId: {
        get: () => {
            return cfgSettings.bcotOmniPropertyId;
        },
        enumerable: true
    },
    storeBcotAddress: {
        get: () => {
            return cfgSettings.storeBcotAddress;
        },
        enumerable: true
    }
});

// Lock function class
Object.freeze(BcotToken);
