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
    version: bscGasPricesConfig.get('version'),
    localAddress: bscGasPricesConfig.get('localAddress'),
    timeout: bscGasPricesConfig.get('timeout'),
    apiKey: bscGasPricesConfig.get('apiKey'),
    acceptances: bscGasPricesConfig.get('acceptances')
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
     * @param {string} [apiKey] Ciphered Owlracle API key used for getting extended service (more free requests)
     */
    constructor(localAddress, timeout, apiKey) {
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

        const sp = new URLSearchParams({
            version: cfgSettings.version,
            accept: cfgSettings.acceptances.join(',')
        });

        if (apiKey) {
            sp.set('apiKey', Catenis.decipherData(apiKey));
        }

        this.callOptions.searchParams = sp;

        this.priceByConfidenceLevel = new Map();

        // Already try to retrieve gas price estimates now to make sure that API service is working fine
        this._updatePriceEstimates();

        if (this.priceByConfidenceLevel.size === 0) {
            // Unable to retrieve any gas price estimate for Binance Smart Chain blockchain.
            //  Log error and throw exception
            Catenis.logger.ERROR('Unable to retrieve any gas price estimate for Binance Smart Chain');
            throw new Error('Unable to retrieve any gas price estimate for Binance Smart Chain');
        }
    }


    // Public object methods
    //

    /**
     * Get estimated gas price for a given confidence level
     * @param {number} confidenceLevel Percentage value representing the expected probability for the estimated price to
     *                                  be enough for inclusion in the next block
     * @param {boolean} [acceptLower=true] Indicates whether in the event where a price cannot be retrieved for the given
     *                                      confidence level the price can be retrieved for the immediate lower
     *                                      confidence level
     * @return {BigNumber|undefined} The estimated price in wei
     */
    getPriceEstimate(confidenceLevel = 99, acceptLower = true) {
        this._updatePriceEstimates();

        if (confidenceLevel > 99) {
            confidenceLevel = 99;
        }

        let price;

        for (const key of this.priceByConfidenceLevel.keys()) {
            if (key < confidenceLevel) {
                if (!price && acceptLower) {
                    // Get price from the immediate lower confidence level
                    Catenis.logger.WARN('Getting Binance Smart Chain gas price estimate from immediate lower confidence level', {
                        requestedConfidenceLevel: confidenceLevel,
                        acceptedConfidenceLevel: key
                    });
                    price = this.priceByConfidenceLevel.get(key);
                }

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
            // Error when sending request to 'bsc/gas' endpoint of Owlracle multichain gas price tracker API
            Catenis.logger.ERROR('Error when sending request to \'bsc/gas\' endpoint of Owlracle multichain gas price tracker API.', err);
            return;
        }

        // Successful response
        const newPriceByConfidenceLevel = new Map();

        if ('speeds' in body && Array.isArray(body.speeds)) {
            for (const speedEntry of body.speeds) {
                newPriceByConfidenceLevel.set(
                    speedEntry.acceptance * 100,
                    new BigNumber(web3.utils.toWei(new BigNumber(speedEntry.gasPrice).toString(), priceDenomination).toString())
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
        return new BinanceSCGasPrices(cfgSettings.localAddress, cfgSettings.timeout, cfgSettings.apiKey);
    }
}


// Module code
//

// Lock class
Object.freeze(BinanceSCGasPrices);
