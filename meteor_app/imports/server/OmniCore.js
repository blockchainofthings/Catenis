/**
 * Created by Claudio on 2017-11-17.
 */

//console.log('[OmniCore.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import util from 'util';
// Third-party node modules
import config from 'config';
import bitcoinCoreLib from 'bitcoin';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';

// Config entries
const omniCoreConfig = config.get('omniCore');

// Configuration settings
const cfgSettings = {
    serverHost: omniCoreConfig.get('serverHost'),
    mainRpcPort: omniCoreConfig.get('mainRpcPort'),
    testnetRpcPort: omniCoreConfig.get('testnetRpcPort'),
    rpcUser: omniCoreConfig.get('rpcUser'),
    rpcPassword: omniCoreConfig.get('rpcPassword'),
    rpcConnectionTimeout: omniCoreConfig.get('rpcConnectionTimeout'),
    rescanTimeout: omniCoreConfig.get('rescanTimeout')
};


// Definition of function classes
//

// OmniCore function class
export function OmniCore(network, host, username, password, timeout) {
    const opts = {
        host: host,
        port: network === 'testnet' ? cfgSettings.testnetRpcPort : cfgSettings.mainRpcPort,
        user: username,
        pass: password
    };

    if (timeout !== undefined) {
        opts.timeout = timeout;
    }

    this.btcClient = new bitcoinCoreLib.Client(opts);

    //noinspection JSCheckFunctionSignatures
    this.rpcApi = {
        // Note: the 'command' method below should be used when calling a Omni Core
        //  JSON RPC method that is not directly exposed by the bitcoinCoreLib module
        //  (basically all omni specific methods, and a few other generic Bitcoin Core
        //  methods).
        //  The following Omni Core JSON RPC methods are being called through this
        //  mechanism:
        //  - 'importpubkey'
        //  - 'omni_getbalance'
        //  - 'omni_getinfo'
        //  - 'omni_gettransaction'
        //  - 'omni_createpayload_simplesend'
        //  - 'omni_getpropertyid'
        command: Meteor.wrapAsync(this.btcClient.cmd, this.btcClient),
        getaddressesbyaccount: Meteor.wrapAsync(this.btcClient.getAddressesByAccount, this.btcClient)  // USE IT AS JUST GET_ADDRESSES (ACCOUNT = "")
    };
}


// Public OmniCore object methods
//

OmniCore.prototype.importPublicKey = function (pubKeyHex, rescan, callback) {
    if (rescan === undefined) {
        rescan = false;
    }

    if (!rescan) {
        try {
            this.rpcApi.command('importpubkey', pubKeyHex, '', rescan);
        }
        catch (err) {
            handleError('importpubkey', err);
        }
    }
    else {
        // Request for Omni Core to rescan the blockchain after importing the public key.
        //  The problem is that Omni Core's JSON RPC locks up when its 'importpubkey' method
        //  is called with the rescan option set. So we need to make sure that the connection will
        //  remain open until the RPC call returns or a (sufficient long) timeout takes place. It
        //  is also important not to block this call. In order to do so, we should NOT use the
        //  'bitcoin' module, but make the RPC call manually so we have the necessary control
        const requestJSON = JSON.stringify({id: Date.now(), method: 'importpubkey', params: [pubKeyHex, '', true]}),
            requestOptions = {
                host: this.btcClient.rpc.opts.host || 'localhost',
                port: this.btcClient.rpc.opts.port || 8332,
                method: 'POST',
                path: '/',
                headers: {
                    'Host': this.btcClient.rpc.opts.host || 'localhost',
                    'Content-Length': requestJSON.length
                },
                agent: false,
                rejectUnauthorized: this.btcClient.rpc.opts.ssl && this.btcClient.rpc.opts.sslStrict !== false
            };

        if (this.btcClient.rpc.opts.ssl && this.btcClient.rpc.opts.sslCa) {
            requestOptions.ca = this.btcClient.rpc.opts.sslCa;
        }

        // use HTTP auth if user and password set
        if (this.btcClient.rpc.opts.user && this.btcClient.rpc.opts.pass) {
            requestOptions.auth = this.btcClient.rpc.opts.user + ':' + this.btcClient.rpc.opts.pass;
        }

        const request = this.btcClient.rpc.http.request(requestOptions);

        // Make sure that the connection will remain open, and Omni Core
        //  sends the response back after the rescan is done
        request.setSocketKeepAlive(true);

        request.on('socket', (socket) => {
            socket.on('connect', () => {
                Catenis.logger.TRACE('Connection established to call Omni Core \'importpubkey\' RPC method');
            });
            // noinspection JSUnusedLocalSymbols
            socket.on('close', (had_error) => {
                Catenis.logger.TRACE('Connection to call Omni Core \'importpubkey\' RPC method closed');
                if (Catenis.application.getWaitingOmniCoreRescan()) {
                    // Connection closed while still waiting on Omni Core to
                    //  finish rescanning the blockchain. Log error, and clear
                    //  waiting indication
                    Catenis.logger.ERROR('Connection closed while waiting for Omni Core to finish rescanning the blockchain after importing public key');
                    Catenis.application.setWaitingOmniCoreRescan(false);

                    if (callback !== undefined && typeof callback === 'function') {
                        // Return error
                        callback(new Meteor.Error('ctn_omcore_impkey_conn_closed', 'Connection closed while waiting for Omni Core to finish rescanning the blockchain after importing public key'));
                    }
                }
            });
        });

        let rescanTimeout = false;

        request.setTimeout(cfgSettings.rescanTimeout, () => {
            // Timeout while waiting for 'importpubkey' method to return.
            //  Log an error condition, and clear indication that we are waiting
            //  on Omni Core to finish rescanning the blockchain
            Catenis.logger.ERROR('Timeout while waiting for Omni Core to finish rescanning the blockchain after importing public key');
            Catenis.application.setWaitingOmniCoreRescan(false);

            rescanTimeout = true;
            request.abort();

            if (callback !== undefined && typeof callback === 'function') {
                // Return error
                callback(new Meteor.Error('ctn_omcore_impkey_timeout', 'Timeout while waiting for Omni Core to finish rescanning the blockchain after importing public key'));
            }
        });

        request.on('error', (err) => {
            if (err.code !== 'ECONNRESET' || !rescanTimeout) {
                // Error while waiting for 'importpubkey' method to return.
                //  Log error, and clear indication that we are waiting on
                //  Omni Core to finish rescanning the blockchain
                let errMsg = 'Error while waiting for Omni Core to finish rescanning the blockchain after importing public key.';

                if (typeof err.code !== 'undefined') {
                    errMsg += util.format(' Returned error code: %s.', err.code);
                }

                Catenis.logger.DEBUG(errMsg, err);

                Catenis.application.setWaitingOmniCoreRescan(false);

                const retError = new Meteor.Error('ctn_omcore_impkey_conn_error', errMsg, err.stack);

                if (callback !== undefined && typeof callback === 'function') {
                    // Return error
                    callback(retError);
                }
                else {
                    // No callback; just throw error
                    throw retError;
                }
            }
        });

        // noinspection JSUnusedLocalSymbols
        request.on('response', (response) => {
            // 'importpubkey' method returned. Clear indication that we are
            //  waiting on Omni Core to finish rescanning the blockchain
            Catenis.logger.TRACE('Omni Core finished rescanning the blockchain after importing public key');
            Catenis.application.setWaitingOmniCoreRescan(false);

            if (callback !== undefined && typeof callback === 'function') {
                // Return successful result
                callback(undefined, true);
            }
        });

        // Indicate that we are waiting on Omni Core to finish rescanning
        //  the blockchain before placing the call to import the public key
        Catenis.application.setWaitingOmniCoreRescan();

        request.end(requestJSON);
    }
};

OmniCore.prototype.getAddresses = function () {
    try {
        return this.rpcApi.getaddressesbyaccount('');
    }
    catch (err) {
        handleError('getaddressesbyaccount', err);
    }
};

OmniCore.prototype.omniGetInfo = function () {
    try {
        return this.rpcApi.command('omni_getinfo');
    }
    catch (err) {
        handleError('omni_getinfo', err);
    }
};

OmniCore.prototype.omniGetBalance = function (address, propertyId) {
    try {
        return this.rpcApi.command('omni_getbalance', address, propertyId);
    }
    catch (err) {
        handleError('omni_getbalance', err);
    }
};

OmniCore.prototype.omniGetTransaction = function (txid, logError = true) {
    try {
        return this.rpcApi.command('omni_gettransaction', txid);
    }
    catch (err) {
        handleError('omni_gettransaction', err, logError);
    }
};

// NOTE: amount should be a string
OmniCore.prototype.omniCreatePayloadSimpleSend = function (propertyId, amount) {
    try {
        return this.rpcApi.command('omni_createpayload_simplesend', propertyId, amount);
    }
    catch (err) {
        handleError('omni_createpayload_simplesend', err);
    }
};

OmniCore.prototype.omniGetProperty = function (propertyId) {
    try {
        return this.rpcApi.command('omni_getproperty', propertyId);
    }
    catch (err) {
        handleError('omni_getproperty', err);
    }
};


// OmniCore function class (public) methods
//

OmniCore.initialize = function () {
    Catenis.logger.TRACE('OmniCore initialization');
    // Instantiate OmniCore object
    Catenis.omniCore = new OmniCore(Catenis.application.cryptoNetworkName, cfgSettings.serverHost, cfgSettings.rpcUser, cfgSettings.rpcPassword, cfgSettings.rpcConnectionTimeout);
};


// OmniCore function class (public) properties
//

OmniCore.rpcErrorCode = {
    //! Standard JSON-RPC 2.0 errors
    RPC_INVALID_REQUEST: -32600,
    RPC_METHOD_NOT_FOUND: -32601,
    RPC_INVALID_PARAMS: -32602,
    RPC_INTERNAL_ERROR: -32603,
    RPC_PARSE_ERROR: -32700,

    //! General application defined errors
    RPC_MISC_ERROR: -1,
    RPC_FORBIDDEN_BY_SAFE_MODE: -2,
    RPC_TYPE_ERROR: -3,
    RPC_INVALID_ADDRESS_OR_KEY: -5,
    RPC_OUT_OF_MEMORY: -7,
    RPC_INVALID_PARAMETER: -8,
    RPC_DATABASE_ERROR: -20,
    RPC_DESERIALIZATION_ERROR: -22,
    RPC_VERIFY_ERROR: -25,
    RPC_VERIFY_REJECTED: -26,
    RPC_VERIFY_ALREADY_IN_CHAIN: -27,
    RPC_IN_WARMUP: -28,

    //! Aliases for backward compatibility
    RPC_TRANSACTION_ERROR: -25,
    RPC_TRANSACTION_REJECTED: -26,
    RPC_TRANSACTION_ALREADY_IN_CHAIN: -27,

    //! P2P client errors
    RPC_CLIENT_NOT_CONNECTED: -9,
    RPC_CLIENT_IN_INITIAL_DOWNLOAD: -10,
    RPC_CLIENT_NODE_ALREADY_ADDED: -23,
    RPC_CLIENT_NODE_NOT_ADDED: -24,
    RPC_CLIENT_NODE_NOT_CONNECTED: -29,
    RPC_CLIENT_INVALID_IP_OR_SUBNET: -30,

    //! Wallet errors
    RPC_WALLET_ERROR: -4,
    RPC_WALLET_INSUFFICIENT_FUNDS: -6,
    RPC_WALLET_INVALID_ACCOUNT_NAME: -11,
    RPC_WALLET_KEYPOOL_RAN_OUT: -12,
    RPC_WALLET_UNLOCK_NEEDED: -13,
    RPC_WALLET_PASSPHRASE_INCORRECT: -14,
    RPC_WALLET_WRONG_ENC_STATE: -15,
    RPC_WALLET_ENCRYPTION_FAILED: -16,
    RPC_WALLET_ALREADY_UNLOCKED: -17
};

OmniCore.rpcErrorMessage = {
    //! Standard JSON-RPC 2.0 errors
    '-32600': 'Invalid request',
    '-32601': 'Method not found',
    '-32602': 'Invalid params',
    '-32603': 'Internal error',
    '-32700': 'Parse error',

    //! General application defined errors
    '-1': 'std::exception thrown in command handling',
    '-2': 'Server is in safe mode, and command is not allowed in safe mode',
    '-3': 'Unexpected type was passed as parameter',
    '-5': 'Invalid address or key',
    '-7': 'Ran out of memory during operation',
    '-8': 'Invalid, missing or duplicate parameter',
    '-20': 'Database error',
    '-22': 'Error parsing or validating structure in raw format',
    '-25': 'General error during transaction or block submission',
    '-26': 'Transaction or block was rejected by network rules',
    '-27': 'Transaction already in chain',
    '-28': 'Client still warming up',

    //! P2P client errors
    '-9': 'Bitcoin is not connected',
    '-10': 'Still downloading initial blocks',
    '-23': 'Node is already added',
    '-24': 'Node has not been added before',
    '-29': 'Node to disconnect not found in connected nodes',
    '-30': 'Invalid IP/Subnet',

    //! Wallet errors
    '-4': 'Unspecified problem with wallet (key not found etc.)',
    '-6': 'Not enough funds in wallet or account',
    '-11': 'Invalid account name',
    '-12': 'Keypool ran out, call keypoolrefill first',
    '-13': 'Enter the wallet passphrase with walletpassphrase first',
    '-14': 'The wallet passphrase entered was incorrect',
    '-15': 'Command given in wrong wallet encryption state (encrypting an encrypted wallet etc.)',
    '-16': 'Failed to encrypt the wallet',
    '-17': 'Wallet is already unlocked'
};


// Definition of module (private) functions
//

function handleError(methodName, err, logError = true) {
    let errMsg = util.format('Error calling Omni Core \'%s\' RPC method.', methodName);

    if (typeof err.code !== 'undefined') {
        errMsg += util.format(' Returned error code: %s.', err.code);
    }

    // Log error and rethrow it
    if (logError) {
        Catenis.logger.DEBUG(errMsg, err);
    }
    throw new Meteor.Error('ctn_omcore_rpc_error', errMsg, err);
}


// Module code
//

// Lock function class
Object.freeze(OmniCore);
