/**
 * Created by claudio on 2020-01-27
 */

//console.log('[BitcoinTickerBase.js]: This code just ran.');

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
//import config from 'config';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';


// Definition of class
//

// Generic class to be used as the base for the implementation of specialized bitcoin ticker classes
export class BitcoinTickerBase {
    constructor () {
    }

    // Method used to retrieve the lat recorded bitcoin price
    //
    //  Arguments:
    //    logError: [Boolean] - Indicates whether error conditions should be logged
    //
    //  Return: [Object] {
    //    price: [Number],  - Latest bitcoin price in US dollar
    //    referenceDate: [Object(Date)] - Date and time when last bitcoin price was recorded
    //  }
    //
    //  NOTE: this method should be implemented in the derived class
    // noinspection JSUnusedLocalSymbols
    getTicker(logError = true) {
        Catenis.logger.WARN('Method not implemented.');
    }

    // Method used to instantiate a new object of the (derived, specialized) bitcoin ticker class
    //
    //  Return: [Object] - A specialized bitcoin ticker class object
    //
    //  NOTE: this static method should be implemented in the derived class. It is commented out here because
    //      if it was defined in the base class, it would always be called instead of the corresponding
    //      method in the desired derived class (since it is a static instead instead of an instance method)
    /*static instantiate() {
        Catenis.logger.WARN('Method not implemented');
    }*/
}

// Module code
//

// Lock class reference
Object.freeze(BitcoinTickerBase);
