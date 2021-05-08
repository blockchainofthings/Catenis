/**
 * Created by claudio on 2020-01-27
 */

//console.log('[GeminiBitcoinTicker.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import config from 'config';
import got from 'got';
// Meteor packages
import { Promise } from 'meteor/promise';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { BitcoinTickerBase } from './BitcoinTickerBase';

// Config entries
const geminiBtcTickerConfig = config.get('geminiBitcoinTicker');

// Configuration settings
const cfgSettings = {
    apiUrl: geminiBtcTickerConfig.get('apiUrl'),
    bitcoinTickerEndPoint: geminiBtcTickerConfig.get('bitcoinTickerEndPoint'),
    localAddress: geminiBtcTickerConfig.get('localAddress'),
    timeout: geminiBtcTickerConfig.get('timeout')
};


// Definition of function classes
//

// GeminiBitcoinTicker function class
export class GeminiBitcoinTicker extends BitcoinTickerBase {
    constructor(localAddress, timeout) {
        super();

        // Prepare for request
        this.baseApiUrl = cfgSettings.apiUrl;
        this.btcTickerEndPointUrl = this.baseApiUrl + cfgSettings.bitcoinTickerEndPoint;
        this.callOptions = {
            retry: 0
        };

        if (localAddress) {
            this.callOptions.localAddress = localAddress;
        }

        if (timeout) {
            this.callOptions.timeout = {
                socket: timeout,
                response: timeout
            };
        }
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
    getTicker(logError = true) {
        let body;

        try {
            body = Promise.await(
                got(this.btcTickerEndPointUrl, this.callOptions)
                .json()
            );
        }
        catch (err) {
            if (logError) {
                // Log error condition and throw exception
                if (err.response) {
                    // Error response from bitcoin ticker API endpoint
                    Catenis.logger.ERROR('Error response from Gemini Ticker API endpoint.', err);
                }
                else {
                    // Error when sending request to bitcoin ticker API endpoint
                    Catenis.logger.ERROR('Error when sending request to Gemini Ticker API endpoint.', err);
                }
            }

            throw err;
        }

        // Successful response
        return {
            price: body.last,
            referenceDate: new Date(body.volume.timestamp)
        };
    }

    // Method used to instantiate a new object of the (derived, specialized) bitcoin ticker class
    //
    //  Return: [Object(GeminiBitcoinTicker]
    //
    static instantiate() {
        return new GeminiBitcoinTicker(cfgSettings.localAddress, cfgSettings.timeout);
    }
}


// Module functions used to simulate private GeminiBitcoinTicker object methods
//  NOTE: these functions need to be bound to a GeminiBitcoinTicker object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(GeminiBitcoinTicker);
