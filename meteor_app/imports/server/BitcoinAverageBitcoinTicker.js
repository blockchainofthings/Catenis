/**
 * Created by claudio on 2016-07-09.
 */

//console.log('[BitcoinAverageBitcoinTicker.js]: This code just ran.');

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
const btcAvrgBtcTickerConfig = config.get('bitcoinAverageBitcoinTicker');

// Configuration settings
const cfgSettings = {
    apiUrl: btcAvrgBtcTickerConfig.get('apiUrl'),
    bitcoinTickerEndPoint: btcAvrgBtcTickerConfig.get('bitcoinTickerEndPoint'),
    apiKey: btcAvrgBtcTickerConfig.get('apiKey'),
    localAddress: btcAvrgBtcTickerConfig.get('localAddress'),
    timeout: btcAvrgBtcTickerConfig.get('timeout')
};


// Definition of function classes
//

// BitcoinAverageBitcoinTicker function class
export class BitcoinAverageBitcoinTicker extends BitcoinTickerBase {
    constructor(apiKey, localAddress, timeout) {
        super();

        // Prepare for request
        this.baseApiUrl = cfgSettings.apiUrl;
        this.btcTickerEndPointUrl = this.baseApiUrl + cfgSettings.bitcoinTickerEndPoint;
        this.callOptions = {
            retry: 0
        };

        if (apiKey) {
            this.callOptions.headers = {
                'X-ba-key': Catenis.decipherData(apiKey)
            }
        }

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
                //  Log error condition and throw exception
                if (err.response) {
                    // Error response from BitcoinAverage API endpoint
                    Catenis.logger.ERROR('Error response from BitcoinAverage Short Ticker API endpoint.', err);
                }
                else {
                    // Error when sending request to bitcoin ticker API endpoint
                    Catenis.logger.ERROR('Error when sending request to BitcoinAverage Short Ticker API endpoint.', err);
                }
            }

            throw err;
        }

        // Successful response
        return {
            price: body.BTCUSD.last,
            referenceDate: new Date(body.BTCUSD.timestamp * 1000)
        };
    }

    // Method used to instantiate a new object of the (derived, specialized) bitcoin ticker class
    //
    //  Return: [Object(BitcoinAverageBitcoinTicker)]
    //
    static instantiate() {
        return new BitcoinAverageBitcoinTicker(cfgSettings.apiKey, cfgSettings.localAddress, cfgSettings.timeout);
    }
}


// Module functions used to simulate private BitcoinAverageBitcoinTicker object methods
//  NOTE: these functions need to be bound to a BitcoinAverageBitcoinTicker object reference (this) before
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
Object.freeze(BitcoinAverageBitcoinTicker);
