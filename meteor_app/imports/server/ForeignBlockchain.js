/**
 * Created by claudio on 2021-06-12
 */

//console.log('[ForeignBlockchain.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import config from 'config';
import web3 from 'web3';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
// noinspection ES6UnusedImports
import { EthereumClient } from './EthereumClient';
// noinspection ES6UnusedImports
import { EthereumGasPrices } from './EthereumGasPrices';
// noinspection ES6UnusedImports
import { BinanceSCClient } from './BinanceSCClient';
// noinspection ES6UnusedImports
import { BinanceSCGasPrices } from './BinanceSCGasPrices';
// noinspection ES6UnusedImports
import { PolygonPSClient } from './PolygonPSClient';
// noinspection ES6UnusedImports
import { PolygonPSGasPrices } from './PolygonPSGasPrices';

// Config entries
const foreignBcConfig = config.get('foreignBlockchain');


// Definition of classes
//

// NativeCoin class
class NativeCoin {
    /**
     * Class constructor
     * @param {string} name
     * @param {string} symbol
     */
    constructor(name, symbol) {
        this.name = name;
        this.symbol = symbol;
    }

    get description() {
        let txt = this.name;

        if (txt !== this.symbol) {
            txt = `${txt} (${this.symbol})`;
        }

        return txt;
    }

    /**
     * Convert a value expressed in the native coin's lowest denomination (wei 10 e-18)
     *  into a native coin value
     * @param {(BigNumber|string)} value
     * @return {string}
     */
    fromLowestDenomination(value) {
        return web3.utils.fromWei(web3.utils.toBN(value));
    }
}


// Foreign Blockchain class
export class ForeignBlockchain {
    /**
     * @typedef {Object} NativeCoinConsumptionProfile
     * @property {string} name Profile name. Reflects the expected transaction processing speed
     * @property {number} confidenceLevel Probability for transaction to the included in next block
     * @readonly
     */
    /**
     * Profile for consumption of native coin to pay for gas required to process transactions.
     * @readonly
     * @type {Object}
     * @property {NativeCoinConsumptionProfile} fastest Fastest consumption profile
     * @property {NativeCoinConsumptionProfile} fast Fast consumption profile
     * @property {NativeCoinConsumptionProfile} average Average consumption profile
     * @property {NativeCoinConsumptionProfile} slow Slow consumption profile
     */
    static consumptionProfile = Object.freeze({
        fastest: Object.freeze({
            name: 'fastest',
            confidenceLevel: 99
        }),
        fast: Object.freeze({
            name: 'fast',
            confidenceLevel: 90
        }),
        average: Object.freeze({
            name: 'average',
            confidenceLevel: 60
        }),
        slow: Object.freeze({
            name: 'slow',
            confidenceLevel: 35
        })
    });

    static _keys = [];

    /**
     * Class constructor
     * @param {{key: string, name: string, classPrefix: string, nativeCoin: {name: string, symbol: string}, blockTime: number}} blockchainInfo
     */
    constructor(blockchainInfo) {
        this.key = blockchainInfo.key;
        this.name = blockchainInfo.name;
        this.nativeCoin = new NativeCoin(blockchainInfo.nativeCoin.name, blockchainInfo.nativeCoin.symbol);
        this.blockTime = blockchainInfo.blockTime;
        this.client = getClass(`${blockchainInfo.classPrefix}Client`).instantiate(this);
        this.gasPrices = getClass(`${blockchainInfo.classPrefix}GasPrices`).instantiate();
    }

    static initialize() {
        Catenis.logger.TRACE('ForeignBlockchain initialization');
        // Instantiate ForeignBlockchain objects
        /**
         * @type {Map<string, ForeignBlockchain>}
         */
        Catenis.foreignBlockchains = new Map();

        for (const cfgEntry of foreignBcConfig) {
            ForeignBlockchain._keys.push(cfgEntry.key);
            Catenis.foreignBlockchains.set(cfgEntry.key, new ForeignBlockchain(cfgEntry));
        }
    }

    static isValidKey(key) {
        return ForeignBlockchain._keys.some(_key => key === _key);
    }

    static isValidConsumptionProfileName(name) {
        return Object.keys(ForeignBlockchain.consumptionProfile).some(_key => name === _key);
    }

    static isValidConsumptionProfile(profile) {
        return Object.values(ForeignBlockchain.consumptionProfile).some(_profile => profile === _profile);
    }
}


// Module code
//

/**
 * Get a class by name
 * @param {string} className The class name
 * @return {function}
 */
function getClass(className) {
    const _class = eval(className);

    // Make sure that executed code is made up of only the class name
    if (typeof _class !== 'function' || _class.name !== className) {
        throw new TypeError(`Inconsistent class name: ${className}`);
    }

    return _class;
}

// Lock class
Object.freeze(ForeignBlockchain);
