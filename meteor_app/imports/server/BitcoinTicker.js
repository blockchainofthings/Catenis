/**
 * Created by claudio on 2016-07-09.
 */

//console.log('[BitcoinTicker.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import config from 'config';
// Meteor packages
import { HTTP } from 'meteor/http';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';

// Config entries
const btcTickerConfig = config.get('bitcoinTicker');

// Configuration settings
const cfgSettings = {
    apiUrl: btcTickerConfig.get('apiUrl'),
    bitcoinTickerEndPoint: btcTickerConfig.get('bitcoinTickerEndPoint'),
    timeout: btcTickerConfig.get('timeout')
};


// Definition of function classes
//

// BitcoinTicker function class
export function BitcoinTicker(timeout) {
    // Prepare for request
    this.baseApiUrl = cfgSettings.apiUrl;
    this.btcTickerEndPointUrl = this.baseApiUrl + cfgSettings.bitcoinTickerEndPoint;
    this.callOptions = {
        timeout: timeout !== undefined ? timeout : cfgSettings.timeout
    };
}


// Public BitcoinTicker object methods
//

BitcoinTicker.prototype.getTicker = function () {
    let getResponse;

    try {
        getResponse = HTTP.get(this.btcTickerEndPointUrl, this.callOptions);
    }
    catch (err) {
        //  Log error condition and throw exception
        if (err.response) {
            // Error response from bitcoin ticker API endpoint
            Catenis.logger.ERROR('Error response from bitcoin ticker API endpoint.', err);
        }
        else {
            // Error when sending request to bitcoin ticker API endpoint
            Catenis.logger.ERROR('Error when sending request to bitcoin ticker API endpoint.', err);
        }

        throw err;
    }

    // Successful response
    return {
        price: getResponse.data.BTCUSD.last,
        referenceDate: new Date(getResponse.data.BTCUSD.timestamp * 1000)
    };
};


// Module functions used to simulate private BitcoinTicker object methods
//  NOTE: these functions need to be bound to a BitcoinTicker object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// BitcoinTicker function class (public) methods
//

BitcoinTicker.initialize = function () {
    Catenis.logger.TRACE('BitcoinTicker initialization');
    Catenis.btcTicker = new BitcoinTicker();
};


// BitcoinTicker function class (public) properties
//

/*BitcoinTicker.prop = {};*/


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(BitcoinTicker);
