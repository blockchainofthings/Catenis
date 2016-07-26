/**
 * Created by claudio on 21/07/16.
 */

//console.log('[Util.js]: This code just ran.');

// Module variables
//

// References to external modules
var BigNumber = Npm.require('bignumber.js');


// Definition of function classes
//

// Util function class
function Util() {
}


// Util function class (public) methods
//

Util.formatCoins = function (amountInSatoshis) {
    return (new BigNumber(amountInSatoshis)).dividedBy(100000000).toFixed(8);
};


// Util function class (public) properties
//


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

Catenis.module.Util = Object.freeze(Util);
