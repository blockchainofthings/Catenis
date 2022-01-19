/**
 * Created by claudio on 2021-06-12
 */

//console.log('[PolygonPSGasPrices.js]: This code just ran.');

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
const ppsGasPricesConfig = config.get('polygonPSGasPrices');

// Configuration settings
const cfgSettings = {
    apiUrl: ppsGasPricesConfig.get('apiUrl'),
    gasPricesEndPoint: ppsGasPricesConfig.get('gasPricesEndPoint'),
    localAddress: ppsGasPricesConfig.get('localAddress'),
    timeout: ppsGasPricesConfig.get('timeout')
};

const speedToConfidenceLevel = {
    fastest: 99,
    fast: 90,
    standard: 60,
    safeLow: 35
};
const priceDenomination = 'gwei';

// Definition of classes
//

// PolygonPSGasPrices class
export class PolygonPSGasPrices {
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

        // Already try to retrieve gas price estimates now to make sure that API service is working fine
        this._updatePriceEstimates();

        if (this.priceByConfidenceLevel.size === 0) {
            // Unable to retrieve any gas price estimate for Polygon PoS Chain blockchain.
            //  Log error and throw exception
            Catenis.logger.ERROR('Unable to retrieve any gas price estimate for Polygon PoS Chain');
            throw new Error('Unable to retrieve any gas price estimate for Polygon PoS Chain');
        }
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
                got(this.gasPricesEndPoint, this.callOptions)
                .json()
            );
        }
        catch (err) {
            // Error when sending request to Matic Gas Station API
            Catenis.logger.ERROR('Error when sending request to Matic Gas Station API.', err);
            return;
        }

        // Successful response
        const newPriceByConfidenceLevel = new Map();

        for (const speed of Object.keys(speedToConfidenceLevel)) {
            if (speed in body) {
                newPriceByConfidenceLevel.set(
                    speedToConfidenceLevel[speed],
                    new BigNumber(web3.utils.toWei(new BigNumber(body[speed]).toString(), priceDenomination).toString())
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
     * Create a new instance of the PolygonPSGasPrices class
     * @return {PolygonPSGasPrices}
     */
    static instantiate() {
        // Instantiate PolygonPSGasPrices object
        return new PolygonPSGasPrices(cfgSettings.localAddress, cfgSettings.timeout);
    }
}


// Module code
//

// Lock class
Object.freeze(PolygonPSGasPrices);
