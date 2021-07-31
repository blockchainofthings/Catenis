/**
 * Created by claudio on 2021-06-10
 */

//console.log('[BinanceSCGasPrices.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import config from 'config';
import got from 'got';
import web3 from 'web3';
import BigNumber from 'bignumber.js';
// Meteor packages
import { Promise } from 'meteor/promise';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';

// Config entries
const bscGasPricesConfig = config.get('binanceSCGasPrices');

// Configuration settings
const cfgSettings = {
    apiUrl: bscGasPricesConfig.get('apiUrl'),
    gasPricesEndPoint: bscGasPricesConfig.get('gasPricesEndPoint'),
    localAddress: bscGasPricesConfig.get('localAddress'),
    timeout: bscGasPricesConfig.get('timeout')
};

const speedToConfidenceLevel = {
    instant: 99,
    fast: 90,
    standard: 60,
    slow: 35
};
const priceDenomination = 'gwei';

// Definition of classes
//

// BinanceSCGasPrices class
export class BinanceSCGasPrices {
    /**
     * Class constructor
     * @param {string} localAddress IP address of local network interface to use for connection
     * @param {number} timeout Connection/request timout in milliseconds
     */
    constructor(localAddress, timeout) {
        // Prepare for request
        this.baseApiUrl = cfgSettings.apiUrl;
        this.gasPricesEndPoint = `${this.baseApiUrl}${cfgSettings.gasPricesEndPoint}`;
        this.callOptions = {
            retry: 0,
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

        this.priceByConfidenceLevel = new Map();
    }


    // Public object methods
    //

    /**
     * Get estimated gas price for a given confidence level
     * @param {number} confidenceLevel Percentage value representing the expected probability for the estimated price to
     *                                  to be enough for inclusion in the next block
     * @return {BigNumber|undefined} The estimated price in wei
     */
    getPriceEstimate(confidenceLevel = 99) {
        this._updatePriceEstimates();

        if (confidenceLevel > 99) {
            confidenceLevel = 99;
        }

        let price;

        for (const key of this.priceByConfidenceLevel.keys()) {
            if (key < confidenceLevel) {
                break;
            }

            price = this.priceByConfidenceLevel.get(key);
        }

        return price
    }


    // Private object methods
    //

    /**
     * Retrieve new gas price estimates
     * @private
     */
    _updatePriceEstimates() {
        let body;

        try {
            body = Promise.await(
                got(this.gasPricesEndPoint, this.callOptions)
                .json()
            );
        }
        catch (err) {
            // Error when sending request to 'gas' endpoint of BSCGas.info API
            Catenis.logger.ERROR('Error when sending request to \'gas\' endpoint of BSCGas.info API.', err);
            return;
        }

        // Successful response
        const newPriceByConfidenceLevel = new Map();

        for (const speed of Object.keys(speedToConfidenceLevel)) {
            if (speed in body) {
                newPriceByConfidenceLevel.set(
                    speedToConfidenceLevel[speed],
                    new BigNumber(web3.utils.toWei(web3.utils.toBN(body[speed]), priceDenomination).toString())
                );
            }
        }

        if (newPriceByConfidenceLevel.size > 0) {
            this.priceByConfidenceLevel = newPriceByConfidenceLevel;
        }
    }


    // Class (public) methods
    //

    /**
     * Create a new instance of the BinanceSCGasPrices class
     * @return {BinanceSCGasPrices}
     */
    static instantiate() {
        // Instantiate BinanceSCGasPrices object
        return new BinanceSCGasPrices(cfgSettings.localAddress, cfgSettings.timeout);
    }
}


// Module code
//

// Lock class
Object.freeze(BinanceSCGasPrices);
