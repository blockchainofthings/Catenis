/**
 * Created by Claudio on 2017-09-21.
 */

//console.log('[C3NodeClient.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import util from 'util';
// Third-party node modules
import config from 'config';
import got from 'got';
// Meteor packages
import { Meteor } from 'meteor/meteor';
import { Promise } from 'meteor/promise';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';

// Config entries
const c3NodeClientConfig = config.get('c3NodeClient');

// Configuration settings
const cfgSettings = {
    serverHost: c3NodeClientConfig.get('serverHost'),
    mainTcpPort: c3NodeClientConfig.get('mainTcpPort'),
    testnetTcpPort: c3NodeClientConfig.get('testnetTcpPort'),
    inetAddress: c3NodeClientConfig.get('inetAddress'),
    user: c3NodeClientConfig.get('user'),
    password: c3NodeClientConfig.get('password'),
    connectionTimeout: c3NodeClientConfig.get('connectionTimeout'),
    methodPath: {
        parseNow: c3NodeClientConfig.get('methodPath.parseNow'),
        getAddressesUtxos: c3NodeClientConfig.get('methodPath.getAddressesUtxos'),
        getUtxos: c3NodeClientConfig.get('methodPath.getUtxos'),
        getTxouts: c3NodeClientConfig.get('methodPath.getTxouts'),
        getAddressesTransactions: c3NodeClientConfig.get('methodPath.getAddressesTransactions'),
        transmit: c3NodeClientConfig.get('methodPath.transmit'),
        getInfo: c3NodeClientConfig.get('methodPath.getInfo'),
        importAddresses: c3NodeClientConfig.get('methodPath.importAddresses'),
        getAssetHolders: c3NodeClientConfig.get('methodPath.getAssetHolders'),
        getAssetBalance: c3NodeClientConfig.get('methodPath.getAssetBalance'),
        getMultiAssetBalance: c3NodeClientConfig.get('methodPath.getMultiAssetBalance'),
        getAssetIssuance: c3NodeClientConfig.get('methodPath.getAssetIssuance'),
        getAssetIssuingAddress: c3NodeClientConfig.get('methodPath.getAssetIssuingAddress'),
        getOwningAssets: c3NodeClientConfig.get('methodPath.getOwningAssets'),
        getAssetMetadata: c3NodeClientConfig.get('methodPath.getAssetMetadata'),
        getNFTokenMetadata: c3NodeClientConfig.get('methodPath.getNFTokenMetadata'),
        getNFTokenAsset: c3NodeClientConfig.get('methodPath.getNFTokenAsset'),
        getNFTokenOwner: c3NodeClientConfig.get('methodPath.getNFTokenOwner'),
        getAllNFTokensOwner: c3NodeClientConfig.get('methodPath.getAllNFTokensOwner'),
        getOwnedNFTokens: c3NodeClientConfig.get('methodPath.getOwnedNFTokens')
    }
};


// Definition of function classes
//

// C3NodeClient function class
export function C3NodeClient(network, host, inetAddr, username, password, timeout) {
    const apiUrl = new URL(`http://${host}`);
    apiUrl.port = network === 'testnet' || network === 'regtest' ? cfgSettings.testnetTcpPort : cfgSettings.mainTcpPort;

    this.httpOptions = {
        prefixUrl: apiUrl.toString(),
        retry: 0
    };

    if (timeout) {
        this.httpOptions.timeout = {
            socket: timeout,
            response: timeout
        };
    }

    if (inetAddr.length > 0) {
        this.httpOptions.localAddress = inetAddr;
    }

    if (username.length > 0) {
        this.httpOptions.username = username;
        this.httpOptions.password = password;
    }
}


// Public C3NodeClient object methods
//


// Call Catenis Colored Coins node server parseNow method
//
C3NodeClient.prototype.parseNow = function () {
    try {
        return Promise.await(
            parseJsonResponse(got(cfgSettings.methodPath.parseNow, this.httpOptions))
        );
    }
    catch (err) {
        handleError('parseNow', err);
    }
};

// Call Catenis Colored Coins node server getAddressesUtxos method
//
//  Arguments:
//   addresses [String|Array(String)] - Blockchain addresses for which to retrieve UTXOs
//   numOfConfirmations [Number]      - Minimum number of confirmations for UTXO to be returned
//   waitForParsing [Boolean] - (optional) Indicates whether processing of request should wait until parsing of assets
//                               is complete
C3NodeClient.prototype.getAddressesUtxos = function (addresses, numOfConfirmations, waitForParsing = true) {
    const postData = {
        addresses: Array.isArray(addresses) ? addresses : [addresses]
    };

    if (numOfConfirmations !== undefined) {
        postData.numOfConfirmations = numOfConfirmations;
    }

    if (waitForParsing) {
        postData.waitForParsing = true;
    }

    try {
        return Promise.await(
            parseJsonResponse(got.post(cfgSettings.methodPath.getAddressesUtxos, {
                ...this.httpOptions,
                json: postData
            }))
        );
    }
    catch (err) {
        handleError('getAddressesUtxos', err);
    }
};

// Call Catenis Colored Coins node server getUtxos method
//
//  Arguments:
//   utxos: [{ [Object|Array(Object)] - Transaction outputs for which to retrieve UTXOs
//     txid: [String],  - Transaction ID
//     index: [Number]  - Output index (vout)
//   }]
//   numOfConfirmations [Number]  - Minimum number of confirmations for UTXO to be returned
//   waitForParsing [Boolean] - (optional) Indicates whether processing of request should wait until parsing of assets
//                               is complete
C3NodeClient.prototype.getUtxos = function (utxos, numOfConfirmations, waitForParsing = true) {
    const postData = {
        utxos: Array.isArray(utxos) ? utxos : [utxos]
    };

    if (numOfConfirmations !== undefined) {
        postData.numOfConfirmations = numOfConfirmations;
    }

    if (waitForParsing) {
        postData.waitForParsing = true;
    }

    try {
        return Promise.await(
            parseJsonResponse(got.post(cfgSettings.methodPath.getUtxos, {
                ...this.httpOptions,
                json: postData
            }))
        );
    }
    catch (err) {
        handleError('getUtxos', err);
    }
};

// Call Catenis Colored Coins node server getTxouts method
//
//  Arguments:
//   txouts: [{ [Object|Array(Object)] - Transaction outputs for which to retrieve Colored Coins data
//     txid: [String],  - Transaction ID
//     vout: [Number]  - Output index
//   }]
//   waitForParsing [Boolean] - (optional) Indicates whether processing of request should wait until parsing of assets
//                               is complete
C3NodeClient.prototype.getTxouts = function (txouts, waitForParsing = true) {
    const postData = {
        txouts: Array.isArray(txouts) ? txouts : [txouts]
    };

    if (waitForParsing) {
        postData.waitForParsing = true;
    }
    
    try {
        return Promise.await(
            parseJsonResponse(got.post(cfgSettings.methodPath.getTxouts, {
                ...this.httpOptions,
                json: postData
            }))
        );
    }
    catch (err) {
        handleError('getTxouts', err);
    }
};

// Call Catenis Colored Coins node server getAddressesTransactions method
//
//  Arguments:
//   addresses [String|Array(String)] - Blockchain addresses for which to retrieve transactions
//   waitForParsing [Boolean] - (optional) Indicates whether processing of request should wait until parsing of assets
//                               is complete
C3NodeClient.prototype.getAddressesTransactions = function (addresses, waitForParsing = true) {
    const postData = {
        addresses: Array.isArray(addresses) ? addresses : [addresses]
    };

    if (waitForParsing) {
        postData.waitForParsing = true;
    }

    try {
        return Promise.await(
            parseJsonResponse(got.post(cfgSettings.methodPath.getAddressesTransactions, {
                ...this.httpOptions,
                json: postData
            }))
        );
    }
    catch (err) {
        handleError('getAddressesTransactions', err);
    }
};

// Call Catenis Colored Coins node server transmit method
//
//  Arguments:
//   txHex [String] - Hex encoded serialization of transaction to send to the blockchain
C3NodeClient.prototype.transmit = function (txHex) {
    const postData = {
        txHex: txHex
    };

    try {
        return Promise.await(
            parseJsonResponse(got.post(cfgSettings.methodPath.transmit, {
                ...this.httpOptions,
                json: postData
            }))
        );
    }
    catch (err) {
        handleError('transmit', err);
    }
};

// Call Catenis Colored Coins node server getInfo method
//
C3NodeClient.prototype.getInfo = function () {
    try {
        return Promise.await(
            parseJsonResponse(got(cfgSettings.methodPath.getInfo, this.httpOptions))
        );
    }
    catch (err) {
        handleError('getInfo', err);
    }
};

// Call Catenis Colored Coins node server importAddresses method
//
//  Arguments:
//   addresses [String|Array(String)] - Blockchain addresses to import
//   reindex [Boolean]      - Indicates whether Bitcoin Core's database should be reindexed
C3NodeClient.prototype.importAddresses = function (addresses, reindex) {
    const postData = {
        addresses: Array.isArray(addresses) ? addresses : [addresses]
    };

    if (reindex !== undefined) {
        postData.reindex = reindex;
    }

    try {
        return Promise.await(
            parseJsonResponse(got.post(cfgSettings.methodPath.importAddresses, {
                ...this.httpOptions,
                json: postData
            }))
        );
    }
    catch (err) {
        handleError('importAddresses', err);
    }
};

// Call Catenis Colored Coins node server getAssetHolders method
//
//  Arguments:
//   ccAssetId [String] - Colored Coins asset ID
//   numOfConfirmations [Number] - (optional) Minimum number of confirmations to include UTXO amount in accumulated
//                                  asset amount balance per holding address
//   waitForParsing [Boolean] - (optional) Indicates whether processing of request should wait until parsing of assets
//                               is complete
C3NodeClient.prototype.getAssetHolders = function (ccAssetId, numOfConfirmations, waitForParsing = true) {
    const postData = {
        assetId: ccAssetId
    };

    if (numOfConfirmations !== undefined) {
        postData.numOfConfirmations = numOfConfirmations;
    }

    if (waitForParsing) {
        postData.waitForParsing = true;
    }

    try {
        return Promise.await(
            parseJsonResponse(got.post(cfgSettings.methodPath.getAssetHolders, {
                ...this.httpOptions,
                json: postData
            }))
        );
    }
    catch (err) {
        handleError('getAssetHolders', err);
    }
};

// Call Catenis Colored Coins node server getAssetBalance method
//
//  Arguments:
//   ccAssetId [String] - Colored Coins asset ID
//   addresses [String|Array(String)] - (optional) List of addresses (or a single address) used to restrict the balance computation
//   numOfConfirmations [Number] - (optional) Minimum number of confirmations to include UTXO amount in accumulated asset amount balance
//   waitForParsing [Boolean] - (optional) Indicates whether processing of request should wait until parsing of assets
//                               is complete
C3NodeClient.prototype.getAssetBalance = function (ccAssetId, addresses, numOfConfirmations, waitForParsing = true) {
    const postData = {
        assetId: ccAssetId
    };

    if (addresses) {
        postData.addresses = Array.isArray(addresses) ? addresses : [addresses];
    }

    if (numOfConfirmations !== undefined) {
        postData.numOfConfirmations = numOfConfirmations;
    }

    if (waitForParsing) {
        postData.waitForParsing = true;
    }

    try {
        return Promise.await(
            parseJsonResponse(got.post(cfgSettings.methodPath.getAssetBalance, {
                ...this.httpOptions,
                json: postData
            }))
        );
    }
    catch (err) {
        handleError('getAssetBalance', err);
    }
};

// Call Catenis Colored Coins node server getMultiAssetBalance method
//
//  Arguments:
//   ccAssetIds [String|Array(String)] - List of Colored Coins asset IDs (or a single ID)
//   addresses [String|Array(String)] - (optional) List of addresses (or a single address) used to restrict the balance computation
//   numOfConfirmations [Number] - (optional) Minimum number of confirmations to include UTXO amount in accumulated asset amount balance
//   waitForParsing [Boolean] - (optional) Indicates whether processing of request should wait until parsing of assets
//                               is complete
C3NodeClient.prototype.getMultiAssetBalance = function (ccAssetIds, addresses, numOfConfirmations, waitForParsing = true) {
    const postData = {
        assetIds: Array.isArray(ccAssetIds) ? ccAssetIds : [ccAssetIds]
    };

    if (addresses) {
        postData.addresses = Array.isArray(addresses) ? addresses : [addresses];
    }

    if (numOfConfirmations !== undefined) {
        postData.numOfConfirmations = numOfConfirmations;
    }

    if (waitForParsing) {
        postData.waitForParsing = true;
    }

    try {
        return Promise.await(
            parseJsonResponse(got.post(cfgSettings.methodPath.getMultiAssetBalance, {
                ...this.httpOptions,
                json: postData
            }))
        );
    }
    catch (err) {
        handleError('getMultiAssetBalance', err);
    }
};

// Call Catenis Colored Coins node server getAssetIssuance method
//
//  Arguments:
//   ccAssetId [String] - Colored Coins asset ID
//   waitForParsing [Boolean] - (optional) Indicates whether processing of request should wait until parsing of assets
//                               is complete
C3NodeClient.prototype.getAssetIssuance = function (ccAssetId, waitForParsing = true) {
    const postData = {
        assetId: ccAssetId
    };

    if (waitForParsing) {
        postData.waitForParsing = true;
    }

    try {
        return Promise.await(
            parseJsonResponse(got.post(cfgSettings.methodPath.getAssetIssuance, {
                ...this.httpOptions,
                json: postData
            }))
        );
    }
    catch (err) {
        handleError('getAssetIssuance', err);
    }
};

// Call Catenis Colored Coins node server getAssetIssuingAddress method
//
//  Arguments:
//   ccAssetId [String] - Colored Coins asset ID
//   waitForParsing [Boolean] - (optional) Indicates whether processing of request should wait until parsing of assets
//                               is complete
C3NodeClient.prototype.getAssetIssuingAddress = function (ccAssetId, waitForParsing = true) {
    const postData = {
        assetId: ccAssetId
    };

    if (waitForParsing) {
        postData.waitForParsing = true;
    }

    try {
        return Promise.await(
            parseJsonResponse(got.post(cfgSettings.methodPath.getAssetIssuingAddress, {
                ...this.httpOptions,
                json: postData
            }))
        );
    }
    catch (err) {
        handleError('getAssetIssuingAddress', err);
    }
};

// Call Catenis Colored Coins node server getOwningAssets method
//
//  Arguments:
//   addresses [String|Array(String)] - List of addresses (or a single address) for which to retrieve the assets
//                                       owned by them
//   numOfConfirmations [Number] - (optional) Minimum number of confirmations to include UTXO amount in accumulated
//                                  asset amount balance
//   waitForParsing [Boolean] - (optional) Indicates whether processing of request should wait until parsing of assets
//                               is complete
C3NodeClient.prototype.getOwningAssets = function (addresses, numOfConfirmations, waitForParsing = true) {
    const postData = {
        addresses: Array.isArray(addresses) ? addresses : [addresses]
    };

    if (numOfConfirmations !== undefined) {
        postData.numOfConfirmations = numOfConfirmations;
    }

    if (waitForParsing) {
        postData.waitForParsing = true;
    }

    try {
        return Promise.await(
            parseJsonResponse(got.post(cfgSettings.methodPath.getOwningAssets, {
                ...this.httpOptions,
                json: postData
            }))
        );
    }
    catch (err) {
        handleError('getOwningAssets', err);
    }
};

/**
 * Call Catenis Colored Coins node server getAssetMetadata method
 * @param {string} assetId The Colored Coins ID of the asset to retrieve the metadata
 * @param {boolean} [waitForParsing=true] Indicates whether processing of request should wait until parsing of assets
 *                                         is complete
 * @returns {(Object|undefined)} A JSON object representing the asset metadata, or undefined if no metadata is found
 */
C3NodeClient.prototype.getAssetMetadata = function (assetId, waitForParsing = true) {
    const postData = {
        assetId
    };

    if (waitForParsing) {
        postData.waitForParsing = true;
    }

    try {
        return Promise.await(
            parseJsonResponse(got.post(cfgSettings.methodPath.getAssetMetadata, {
                ...this.httpOptions,
                json: postData
            }))
        );
    }
    catch (err) {
        handleError('getAssetMetadata', err);
    }
}

/**
 * @external {Readable} https://nodejs.org/api/stream.html#class-streamreadable
 */

/**
 * Call Catenis Colored Coins node server getAssetMetadata method returning a readable stream
 * @param {string} assetId The Colored Coins ID of the asset to retrieve the metadata
 * @param {boolean} [waitForParsing=true] Indicates whether processing of request should wait until parsing of assets
 *                                         is complete
 * @returns {Readable} A readable stream used to retrieve the JSON object representing the asset metadata, or undefined
 *                      if no metadata is found
 */
C3NodeClient.prototype.getAssetMetadataReadableStream = function (assetId, waitForParsing = true) {
    const postData = {
        assetId
    };

    if (waitForParsing) {
        postData.waitForParsing = true;
    }

    try {
        // noinspection JSValidateTypes
        return got.stream.post(cfgSettings.methodPath.getAssetMetadata, {
            ...this.httpOptions,
            json: postData
        });
    }
    catch (err) {
        handleError('getAssetMetadataReadableStream', err);
    }
}

/**
 * Call Catenis Colored Coins node server getNFTokenMetadata method
 * @param {string} tokenId The Colored Coins ID of the non-fungible asset token to retrieve the metadata
 * @param {boolean} [waitForParsing=true] Indicates whether processing of request should wait until parsing of assets
 *                                         is complete
 * @returns {(Object|undefined)} A JSON object representing the non-fungible asset token metadata, or undefined if no
 *                                metadata is found
 */
C3NodeClient.prototype.getNFTokenMetadata = function (tokenId, waitForParsing = true) {
    const postData = {
        tokenId
    };

    if (waitForParsing) {
        postData.waitForParsing = true;
    }

    try {
        return Promise.await(
            parseJsonResponse(got.post(cfgSettings.methodPath.getNFTokenMetadata, {
                ...this.httpOptions,
                json: postData
            }))
        );
    }
    catch (err) {
        handleError('getNFTokenMetadata', err);
    }
}

/**
 * Call Catenis Colored Coins node server getNFTokenMetadata method returning a readable stream
 * @param {string} tokenId The Colored Coins ID of the non-fungible asset token to retrieve the metadata
 * @param {boolean} [waitForParsing=true] Indicates whether processing of request should wait until parsing of assets
 *                                         is complete
 * @returns {Readable} A readable stream used to retrieve the  JSON object representing the non-fungible asset token
 *                      metadata, or undefined if no metadata is found
 */
C3NodeClient.prototype.getNFTokenMetadataReadableStream = function (tokenId, waitForParsing = true) {
    const postData = {
        tokenId
    };

    if (waitForParsing) {
        postData.waitForParsing = true;
    }

    try {
        // noinspection JSValidateTypes
        return got.stream.post(cfgSettings.methodPath.getNFTokenMetadata, {
            ...this.httpOptions,
            json: postData
        });
    }
    catch (err) {
        handleError('getNFTokenMetadataReadableStream', err);
    }
}

/**
 * Call Catenis Colored Coins node server getNFTokenAsset method
 * @param {string} tokenId The Colored Coins ID of the non-fungible asset token to retrieve its asset
 * @param {boolean} [waitForParsing=true] Indicates whether processing of request should wait until parsing of assets
 *                                         is complete
 * @returns {(string|undefined)} The Colored Coins ID of the non-fungible asset to which the token pertains, or
 *                                undefined if no non-fungible asset is found (i.e. the token ID is unknown or invalid)
 */
C3NodeClient.prototype.getNFTokenAsset = function (tokenId, waitForParsing = true) {
    const postData = {
        tokenId
    };

    if (waitForParsing) {
        postData.waitForParsing = true;
    }

    try {
        return Promise.await(
            parseJsonResponse(got.post(cfgSettings.methodPath.getNFTokenAsset, {
                ...this.httpOptions,
                json: postData
            }))
        );
    }
    catch (err) {
        handleError('getNFTokenAsset', err);
    }
}

/**
 * Data structure containing information about the possession of a non-fungible asset token
 * @typedef {Object} NFTokenHolding
 * @property {(string|undefined)} address The bitcoin address that holds the non-fungible asset token. If undefined
 *                                         indicates that the non-fungible asset token is not currently held by any
 *                                         address (e.g. a burnt non-fungible asset token)
 * @property {boolean} unconfirmed Indicates whether the possession is still unconfirmed (UTXO is not yet confirmed)
 */

/**
 * Call Catenis Colored Coins node server getNFTokenOwner method
 * @param {string} tokenId The Colored Coins ID of the non-fungible asset token to retrieve its current owner
 * @param {number} [numOfConfirmations=0] The minimum number of confirmations to consider an UTXO as a token holder
 * @param {boolean} [waitForParsing=true] Indicates whether processing of request should wait until parsing of assets
 *                                         is complete
 * @returns {(NFTokenHolding|undefined)} An object containing information about the possession of the non-fungible
 *                                        asset token, or undefined if no possession info is found (i.e. the token ID is
 *                                        unknown or invalid)
 */
C3NodeClient.prototype.getNFTokenOwner = function (tokenId, numOfConfirmations = 0, waitForParsing = true) {
    const postData = {
        tokenId
    };

    if (numOfConfirmations !== undefined) {
        postData.numOfConfirmations = numOfConfirmations;
    }

    if (waitForParsing) {
        postData.waitForParsing = true;
    }

    try {
        return Promise.await(
            parseJsonResponse(got.post(cfgSettings.methodPath.getNFTokenOwner, {
                ...this.httpOptions,
                json: postData
            }))
        );
    }
    catch (err) {
        handleError('getNFTokenOwner', err);
    }
}

/**
 * Data structure containing information about the possession of all tokens of a non-fungible asset
 * @typedef {Object.<string, NFTokenHolding>} AllNFTokenHolding A dictionary of info about non-fungible asset token
 *                                                               possession by token ID
 */

/**
 * Call Catenis Colored Coins node server getAllNFTokensOwner method
 * @param {string} assetId The Colored Coins ID of the non-fungible asset to retrieve the owner of all its tokens
 * @param {number} [numOfConfirmations=0] The minimum number of confirmations to consider an UTXO as a token holder
 * @param {boolean} [waitForParsing=true] Indicates whether processing of request should wait until parsing of assets
 *                                         is complete
 * @returns {(AllNFTokenHolding|undefined)} An object containing information about the possession of all tokens of the
 *                                           non-fungible asset, or undefined if no token is found (i.e. the asset ID is
 *                                           either unknown or invalid, or is not for a non-fungible asset)
 */
C3NodeClient.prototype.getAllNFTokensOwner = function (assetId, numOfConfirmations = 0, waitForParsing = true) {
    const postData = {
        assetId
    };

    if (numOfConfirmations !== undefined) {
        postData.numOfConfirmations = numOfConfirmations;
    }

    if (waitForParsing) {
        postData.waitForParsing = true;
    }

    try {
        return Promise.await(
            parseJsonResponse(got.post(cfgSettings.methodPath.getAllNFTokensOwner, {
                ...this.httpOptions,
                json: postData
            }))
        );
    }
    catch (err) {
        handleError('getAllNFTokensOwner', err);
    }
}

/**
 * Data structured containing information about an owned non-fungible asset token
 * @typedef {Object} OwnedNFToken
 * @property {string} tokenId The non-fungible asset token ID
 * @property {boolean} unconfirmed Indicates whether the possession is still unconfirmed (UTXO not yet confirmed).
 */

/**
 * Data structured containing information about owned non-fungible asset tokens
 * @typedef {Object.<string, OwnedNFToken[]>} OwnedNFTokens A dictionary of info about owned non-fungible asset tokens
 *                                                           by asset ID
 */

/**
 * Call Catenis Colored Coins node server getOwnedNFTokens method
 * @param {(string|string[])} addresses List of bitcoin addresses (or a single address) to retrieve the owned
 *                                       non-fungible asset tokens
 * @param {string} [assetId] The Colored Coins ID of a non-fungible asset used to restrict the returned info to tokens
 *                            that pertain to that asset
 * @param {number} [numOfConfirmations=0] The minimum number of confirmations to consider an UTXO as a token holder
 * @param {boolean} [waitForParsing=true] Indicates whether processing of request should wait until parsing of assets
 *                                         is complete
 * @returns {(OwnedNFTokens|undefined)} An object containing information about owned non-fungible asset tokens by asset
 *                                       ID, or undefined if the list of addresses is empty or invalid
 */
C3NodeClient.prototype.getOwnedNFTokens = function (addresses, assetId, numOfConfirmations = 0, waitForParsing = true) {
    const postData = {
        addresses: Array.isArray(addresses) ? addresses : [addresses]
    };

    if (assetId) {
        postData.assetId = assetId;
    }

    if (numOfConfirmations !== undefined) {
        postData.numOfConfirmations = numOfConfirmations;
    }

    if (waitForParsing) {
        postData.waitForParsing = true;
    }

    try {
        return Promise.await(
            parseJsonResponse(got.post(cfgSettings.methodPath.getOwnedNFTokens, {
                ...this.httpOptions,
                json: postData
            }))
        );
    }
    catch (err) {
        handleError('getOwnedNFTokens', err);
    }
}


// Module functions used to simulate private C3NodeClient object methods
//  NOTE: these functions need to be bound to a C3NodeClient object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//


// C3NodeClient function class (public) methods
//

C3NodeClient.initialize = function () {
    Catenis.logger.TRACE('C3NodeClient initialization');
    // Instantiate C3NodeClient object
    Catenis.c3NodeClient = new C3NodeClient(Catenis.application.cryptoNetworkName, cfgSettings.serverHost, cfgSettings.inetAddress, cfgSettings.user, cfgSettings.password, cfgSettings.connectionTimeout);
};


// C3NodeClient function class (public) properties
//


// Definition of module (private) functions
//

/**
 * Parse an HTTP response as a JSON object
 * @param {*} gotReturn Value returned from a got library HTTP request method
 * @returns {Promise<any>} A promise that resolves to the parsed JSON object or undefined if the response is empty
 */
async function parseJsonResponse(gotReturn) {
    const retBuf = await gotReturn.buffer();

    if (retBuf.length > 0) {
        try {
            return JSON.parse(retBuf.toString());
        }
        catch (err) {
            throw new Error(`Error parsing returned data: [${err.name}] - ${err.message}`);
        }
    }
}

function handleError(methodName, err) {
    let errMsg = util.format('Error calling Catenis Colored Coins node server \'%s\' method.', methodName);

    // Log error and rethrow it
    Catenis.logger.DEBUG(errMsg, err);

    errMsg += ' ' + err.toString();

    throw new Meteor.Error('ctn_c3_node_svr_error', errMsg, err);
}


// Module code
//

// Lock function class
Object.freeze(C3NodeClient);
