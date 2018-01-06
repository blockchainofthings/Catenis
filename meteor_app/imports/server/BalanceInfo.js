/**
 * Created by claudio on 13/07/17.
 */

//console.log('[BalanceInfo.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//  NOTE: the reference of these modules are done using 'require()' instead of 'import' to
//      to avoid annoying WebStorm warning message: 'default export is not defined in
//      imported module'
//const util = require('util');
// Third-party node modules
import config from 'config';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { FundSource } from './FundSource';

// Config entries
const balanceInfoConfig = config.get('balanceInfo');

// Configuration settings
const cfgSettings = {
    defaultSafetyFactor: balanceInfoConfig.get('defaultSafetyFactor')
};


// Definition of classes
//

// BalanceInfo class
//
// NOTE: make sure that objects of this class are instantiated from code executed from
//  the FundSource.utxoCS critical section object
export class BalanceInfo {
    // Arguments:
    //  expectedMinimumBalance [number] - minimum balance amount that is expected to exist at present time
    //  addressList [Array(string)|string] - list of blockchain addresses used to check for current balance
    //  opts [Object] { - (optional)
    //    includeUnconfirmedUtxos [boolean] - (optional, default: true) indicates whether unconfirmed UTXOs should be taken into consideration when checking current balance from blockchain address list
    //    useSafetyFactor [boolean] - (optional, default: true) indicates whether a safety factor should be used when checking for low balance condition
    //    safetyFactor [number] - (optional) a specific safety factor to be used in place of the system default
    //  }
    constructor (expectedMinimumBalance, addressList, opts) {
        let includeUnconfirmedUtxos = true;
        let useSafetyFactor = true;
        let safetyFactor = cfgSettings.defaultSafetyFactor;

        if (typeof opts === 'object' && opts !== null) {
            if (typeof opts.includeUnconfirmedUtxos === 'boolean') {
                includeUnconfirmedUtxos = opts.includeUnconfirmedUtxos;
            }

            if (typeof opts.useSafetyFactor === 'boolean') {
                useSafetyFactor = opts.useSafetyFactor;
            }

            if (useSafetyFactor && typeof opts.safetyFactor === 'number') {
                safetyFactor = opts.safetyFactor;
            }
        }

        this.minimumBalance = useSafetyFactor ? expectedMinimumBalance * (1 + safetyFactor) : expectedMinimumBalance;
        this.currentBalance = new FundSource(addressList, includeUnconfirmedUtxos ? {unconfUtxoInfo: {}} : undefined).getBalance();
    }

    hasLowBalance() {
        return this.currentBalance < this.minimumBalance;
    }

    getBalanceDifference() {
        return this.minimumBalance - this.currentBalance;
    }
}
