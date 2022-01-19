/**
 * Created by claudio on 2021-06-08
 */

//console.log('[EthereumGasPrices.js]: This code just ran.');

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
const ethGasPricesConfig = config.get('ethereumGasPrices');

// Configuration settings
const cfgSettings = {
    apiUrl: ethGasPricesConfig.get('apiUrl'),
    blockPricesEndPoint: ethGasPricesConfig.get('blockPricesEndPoint'),
    localAddress: ethGasPricesConfig.get('localAddress'),
    timeout: ethGasPricesConfig.get('timeout'),
    apiKey: ethGasPricesConfig.get('apiKey'),
    confidenceLevels: ethGasPricesConfig.get('confidenceLevels')
};


// Definition of classes
//

// EthereumGasPrices class
export class EthereumGasPrices {
    /**
     * Class constructor
     * @param {string} apiKey Ciphered Blocknative API key used for service authentication
     * @param {string} localAddress IP address of local network interface to use for connection
     * @param {number} timeout Connection/request timout in milliseconds
     */
    constructor(apiKey, localAddress, timeout) {
        // Prepare for request
        this.baseApiUrl = cfgSettings.apiUrl;
        this.blockPricesEndPoint = `${this.baseApiUrl}${cfgSettings.blockPricesEndPoint}?confidenceLevels=${cfgSettings.confidenceLevels.join(',')}`;
        this.callOptions = {
            retry: 0,
        };

        this.callOptions.headers = {
            Authorization: Catenis.decipherData(apiKey)
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

        this.priceByConfidenceLevel = new Map();
    }


    // Public object methods
    //

    /**
     * Get estimated gas price for a given confidence level
     * @param {number} confidenceLevel Percentage value represented the expected probability for the estimated price to
     *                                  to be enough for inclusion the next block
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
                got(this.blockPricesEndPoint, this.callOptions)
                .json()
            );
        }
        catch (err) {
            if (!((err instanceof got.HTTPError) && err.response.statusCode === 429)) {
                // Error when sending request to 'blockprices' endpoint of Blocknative API
                Catenis.logger.ERROR('Error when sending request to \'blockprices\' endpoint of Blocknative API.', err);
            }

            return;
        }

        // Successful response
        const newPriceByConfidenceLevel = new Map();

        for (const priceEntry of body.blockPrices[0].estimatedPrices) {
            newPriceByConfidenceLevel.set(priceEntry.confidence, new BigNumber(web3.utils.toWei(new BigNumber(priceEntry.price).toString(), body.unit).toString()));
        }

        if (newPriceByConfidenceLevel.size > 0) {
            this.priceByConfidenceLevel = newPriceByConfidenceLevel;
        }
    }


    // Class (public) methods
    //

    /**
     * Create a new instance of the EthereumGasPrices class
     * @return {EthereumGasPrices}
     */
    static instantiate() {
        // Instantiate EthereumGasPrices object
        return new EthereumGasPrices(cfgSettings.apiKey, cfgSettings.localAddress, cfgSettings.timeout);
    }
}


// Module code
//

// Lock class
Object.freeze(EthereumGasPrices);
