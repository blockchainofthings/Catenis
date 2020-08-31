/**
 * Created by claudio on 2020-08-31.
 */

//console.log('[BitcoinFees.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import config from 'config';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { EarnBitcoinFees } from './EarnBitcoinFees';
import { BitcoinCoreFees } from './BitcoinCoreFees';

// Config entries
const btcFeesConfig = config.get('bitcoinFees');

// Configuration settings
const cfgSettings = {
    implementationInUse: btcFeesConfig.get('implementationInUse')
};


// Definition of classes
//

// BitcoinFees class
export class BitcoinFees {
    // Class (public) properties
    //

    static availableImplementations = Object.freeze({
        earnBitcoinFees: Object.freeze({
            name: 'EarnBitcoinFees',
            description: 'Estimate bitcoin fees using bitcoinfees.earn.com web service',
            class: EarnBitcoinFees
        }),
        bitcoinCoreFees: Object.freeze({
            name: 'BitcoinCoreFees',
            description: 'Estimate bitcoin fees using Bitcoin Core\'s estimatesmartfee RPC method',
            class: BitcoinCoreFees
        })
    });

    static notifyEvent = Object.freeze({
        bitcoin_fees_changed: Object.freeze({
            name: 'bitcoin_fees_changed',
            description: 'Estimate bitcoin fee rates for transactions have changed'
        })
    });


    // Class (public) methods
    //

    static initialize() {
        Catenis.logger.TRACE('BitcoinFees initialization');
        // Instantiate new object of selected implementation
        Catenis.bitcoinFees = new BitcoinFees.availableImplementations[cfgSettings.implementationInUse].class;
    }
}


// Definition of module (private) functions
//


// Module code
//

// Lock class
Object.freeze(BitcoinFees);
