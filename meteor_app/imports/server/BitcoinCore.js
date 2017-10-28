/**
 * Created by claudio on 24/03/16.
 */

//console.log('[BitcoinCore.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//  NOTE: the reference of these modules are done sing 'require()' instead of 'import' to
//      to avoid annoying WebStorm warning message: 'default export is not defined in
//      imported module'
const util = require('util');
// Third-party node modules
import config from 'config';
import bitcoinCoreLib from 'bitcoin';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';

// Config entries
const bitcoinCoreConfig = config.get('bitcoinCore');

// Configuration settings
const cfgSettings = {
    serverHost: bitcoinCoreConfig.get('serverHost'),
    mainRpcPort: bitcoinCoreConfig.get('mainRpcPort'),
    testnetRpcPort: bitcoinCoreConfig.get('testnetRpcPort'),
    rpcUser: bitcoinCoreConfig.get('rpcUser'),
    rpcPassword: bitcoinCoreConfig.get('rpcPassword'),
    rpcConnectionTimeout: bitcoinCoreConfig.get('rpcConnectionTimeout'),
    rescanTimeout: bitcoinCoreConfig.get('rescanTimeout')
};


// Definition of function classes
//

// BitcoinCore function class
export function BitcoinCore(network, host, username, password, timeout) {
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
        // Note: the 'command' method below should be used when calling a Bitcoin Core
        //  JSON RPC method that is not directly exposed by the bitcoinCoreLib module.
        //  The following Bitcoin Core JSON RPC methods are being called through this
        //  mechanism:
        //  - 'importpubkey'
        //  - 'getmempoolentry'
        //  - 'getblockheader'
        //  - 'abandontransaction'
        command: Meteor.wrapAsync(this.btcClient.cmd, this.btcClient),
        getinfo: Meteor.wrapAsync(this.btcClient.getInfo, this.btcClient),
        getblockchaininfo: Meteor.wrapAsync(this.btcClient.getBlockchainInfo, this.btcClient),
        importprivkey: Meteor.wrapAsync(this.btcClient.importPrivKey, this.btcClient),
        listunspent: Meteor.wrapAsync(this.btcClient.listUnspent, this.btcClient),
        listlockunspent: Meteor.wrapAsync(this.btcClient.listLockUnspent, this.btcClient),
        lockunspent: Meteor.wrapAsync(this.btcClient.lockUnspent, this.btcClient),
        sendrawtransaction: Meteor.wrapAsync(this.btcClient.sendRawTransaction, this.btcClient),
        walletpassphrase: Meteor.wrapAsync(this.btcClient.walletPassphrase, this.btcClient),    // TWO ARGS: PSW AND TIMEOUT (in sec.)
        walletlock: Meteor.wrapAsync(this.btcClient.walletLock, this.btcClient),
        getmempoolinfo: Meteor.wrapAsync(this.btcClient.getMempoolInfo, this.btcClient),
        getrawmempool: Meteor.wrapAsync(this.btcClient.getRawMemPool, this.btcClient),  // TWO VARIANTS: VERBOSE SET AND NOT
        getblock: Meteor.wrapAsync(this.btcClient.getBlock, this.btcClient),    // TOW VARIANTS: VERBOSE SET AND NOT
        getblockcount: Meteor.wrapAsync(this.btcClient.getBlockCount, this.btcClient),
        getblockhash: Meteor.wrapAsync(this.btcClient.getBlockHash, this.btcClient),
        gettxout: Meteor.wrapAsync(this.btcClient.getTxOut, this.btcClient),
        gettransaction: Meteor.wrapAsync(this.btcClient.getTransaction, this.btcClient),
        getrawtransaction: Meteor.wrapAsync(this.btcClient.getRawTransaction, this.btcClient), // TWO VARIANTS: VERBOSE SET AND NOT
        decoderawtransaction: Meteor.wrapAsync(this.btcClient.decodeRawTransaction, this.btcClient),
        decodescript: Meteor.wrapAsync(this.btcClient.decodeScript, this.btcClient),
        getaddressesbyaccount: Meteor.wrapAsync(this.btcClient.getAddressesByAccount, this.btcClient),  // USE IT AS JUST GET_ADDRESSES (ACCOUNT = "")
        getwalletinfo: Meteor.wrapAsync(this.btcClient.getWalletInfo, this.btcClient),
        listtransactions: Meteor.wrapAsync(this.btcClient.listTransactions, this.btcClient),
        listsinceblock: Meteor.wrapAsync(this.btcClient.listSinceBlock, this.btcClient)
    };
}


// Public BitcoinCore object methods
//

// NOTE: the getinfo JSON-RPC command is deprecated in Bitcoin Core ver. 0.14.0 onwards. Thus it should be replaced by
//      either getblockchaininfo, getnetworkinfo or getwalletinfo depending on the needed info
BitcoinCore.prototype.getInfo = function () {
    try {
        return this.rpcApi.getinfo();
    }
    catch (err) {
        handleError('getinfo', err);
    }
};

BitcoinCore.prototype.getBlockchainInfo = function () {
    try {
        return this.rpcApi.getblockchaininfo();
    }
    catch (err) {
        handleError('getblockchaininfo', err);
    }
};

// NOTE: this method should not be called since no private keys
//  are going to be added to the wallet but only public keys
BitcoinCore.prototype.importPrivateKey = function (privKeyWif, rescan, callback) {
    if (rescan === undefined) {
        rescan = false;
    }

    // Unlock wallet
    let unlockedWallet = unlockWallet.call(this);

    if (!rescan) {
        try {
            this.rpcApi.importprivkey(privKeyWif, '', rescan);
        }
        catch (err) {
            handleError('importprivkey', err);
        }

        // Lock wallet back
        if (unlockedWallet) {
            lockWallet.call(this);
            unlockedWallet = false;
        }
    }
    else {
        // Request for Bitcoin Core to rescan the blockchain after importing the private key.
        //  The problem is that Bitcoin Core's JSON RPC locks up when its 'importprivkey' method
        //  is called with the rescan option set. So we need to make sure that the connection will
        //  remain open until the RPC call returns or a (sufficient long) timeout takes place. It
        //  is also important not to block this call. In order to do so, we should NOT use the
        //  'bitcoin' module, but make the RPC call manually so we have the necessary control
        const requestJSON = JSON.stringify({id: Date.now(), method: 'importprivkey', params: [privKeyWif, '', true]}),
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

        // Make sure that the connection will remain open, and Bitcoin Core
        //  sends the response back after the rescan is done
        request.setSocketKeepAlive(true);

        request.on('socket', (socket) => {
            socket.on('connect', () => {
                Catenis.logger.TRACE('Connection established to call Bitcoin Core \'importprivkey\' RPC method');
            });
            // noinspection JSUnusedLocalSymbols
            socket.on('close', (had_error) => {
                Catenis.logger.TRACE('Connection to call Bitcoin Core \'importprivkey\' RPC method closed');
                if (Catenis.application.getWaitingBitcoinCoreRescan()) {
                    // Connection closed while still waiting on Bitcoin Core to
                    //  finish rescanning the blockchain. Log error, and clear
                    //  waiting indication
                    Catenis.logger.ERROR('Connection closed while waiting for Bitcoin Core to finish rescanning the blockchain after importing private key');
                    Catenis.application.setWaitingBitcoinCoreRescan(false);

                    // Lock wallet back
                    if (unlockedWallet) {
                        lockWallet.call(this);
                        unlockedWallet = false;
                    }

                    if (callback !== undefined && typeof callback === 'function') {
                        // Return error
                        callback(new Meteor.Error('ctn_btcore_impkey_conn_closed', 'Connection closed while waiting for Bitcoin Core to finish rescanning the blockchain after importing public key'));
                    }
                }
            });
        });

        let rescanTimeout = false;

        request.setTimeout(cfgSettings.rescanTimeout, () => {
            // Timeout while waiting for 'importprivkey' method to return.
            //  Log an error condition, and clear indication that we are waiting
            //  on Bitcoin Core to finish rescanning the blockchain
            Catenis.logger.ERROR('Timeout while waiting for Bitcoin Core to finish rescanning the blockchain after importing private key');
            Catenis.application.setWaitingBitcoinCoreRescan(false);

            // Lock wallet back
            if (unlockedWallet) {
                lockWallet.call(this);
                unlockedWallet = false;
            }

            rescanTimeout = true;
            request.abort();

            if (callback !== undefined && typeof callback === 'function') {
                // Return error
                callback(new Meteor.Error('ctn_btcore_impkey_timeout', 'Timeout while waiting for Bitcoin Core to finish rescanning the blockchain after importing public key'));
            }
        });

        request.on('error', (err) => {
            if (err.code !== 'ECONNRESET' || !rescanTimeout) {
                // Error while waiting for 'importprivkey' method to return.
                //  Log error, and clear indication that we are waiting on
                //  Bitcoin Core to finish rescanning the blockchain
                let errMsg = 'Error while waiting for Bitcoin Core to finish rescanning the blockchain after importing private key.';

                if (typeof err.code !== 'undefined') {
                    errMsg += util.format(' Returned error code: %s.', err.code);
                }

                Catenis.logger.DEBUG(errMsg, err);

                Catenis.application.setWaitingBitcoinCoreRescan(false);

                // Lock wallet back
                if (unlockedWallet) {
                    lockWallet.call(this);
                    unlockedWallet = false;
                }

                const retError = new Meteor.Error('ctn_btcore_impkey_conn_error', errMsg, err.stack);

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
            // 'importprivkey' method returned. Clear indication that we are
            //  waiting on Bitcoin Core to finish rescanning the blockchain
            Catenis.logger.TRACE('Bitcoin Core finished rescanning the blockchain after importing private key');
            Catenis.application.setWaitingBitcoinCoreRescan(false);

            // Lock wallet back
            if (unlockedWallet) {
                lockWallet.call(this);
                unlockedWallet = false;
            }

            if (callback !== undefined && typeof callback === 'function') {
                // Return successful result
                callback(undefined, true);
            }
        });

        // Indicate that we are waiting on Bitcoin Core to finish rescanning
        //  the blockchain before placing the call to import the private key
        Catenis.application.setWaitingBitcoinCoreRescan();

        request.end(requestJSON);
    }
};

BitcoinCore.prototype.importPublicKey = function (pubKeyHex, rescan, callback) {
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
        // Request for Bitcoin Core to rescan the blockchain after importing the public key.
        //  The problem is that Bitcoin Core's JSON RPC locks up when its 'importpubkey' method
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

        // Make sure that the connection will remain open, and Bitcoin Core
        //  sends the response back after the rescan is done
        request.setSocketKeepAlive(true);

        request.on('socket', (socket) => {
            socket.on('connect', () => {
                Catenis.logger.TRACE('Connection established to call Bitcoin Core \'importpubkey\' RPC method');
            });
            // noinspection JSUnusedLocalSymbols
            socket.on('close', (had_error) => {
                Catenis.logger.TRACE('Connection to call Bitcoin Core \'importpubkey\' RPC method closed');
                if (Catenis.application.getWaitingBitcoinCoreRescan()) {
                    // Connection closed while still waiting on Bitcoin Core to
                    //  finish rescanning the blockchain. Log error, and clear
                    //  waiting indication
                    Catenis.logger.ERROR('Connection closed while waiting for Bitcoin Core to finish rescanning the blockchain after importing public key');
                    Catenis.application.setWaitingBitcoinCoreRescan(false);

                    if (callback !== undefined && typeof callback === 'function') {
                        // Return error
                        callback(new Meteor.Error('ctn_btcore_impkey_conn_closed', 'Connection closed while waiting for Bitcoin Core to finish rescanning the blockchain after importing public key'));
                    }
                }
            });
        });

        let rescanTimeout = false;

        request.setTimeout(cfgSettings.rescanTimeout, () => {
            // Timeout while waiting for 'importpubkey' method to return.
            //  Log an error condition, and clear indication that we are waiting
            //  on Bitcoin Core to finish rescanning the blockchain
            Catenis.logger.ERROR('Timeout while waiting for Bitcoin Core to finish rescanning the blockchain after importing public key');
            Catenis.application.setWaitingBitcoinCoreRescan(false);

            rescanTimeout = true;
            request.abort();

            if (callback !== undefined && typeof callback === 'function') {
                // Return error
                callback(new Meteor.Error('ctn_btcore_impkey_timeout', 'Timeout while waiting for Bitcoin Core to finish rescanning the blockchain after importing public key'));
            }
        });

        request.on('error', (err) => {
            if (err.code !== 'ECONNRESET' || !rescanTimeout) {
                // Error while waiting for 'importpubkey' method to return.
                //  Log error, and clear indication that we are waiting on
                //  Bitcoin Core to finish rescanning the blockchain
                let errMsg = 'Error while waiting for Bitcoin Core to finish rescanning the blockchain after importing public key.';

                if (typeof err.code !== 'undefined') {
                    errMsg += util.format(' Returned error code: %s.', err.code);
                }

                Catenis.logger.DEBUG(errMsg, err);

                Catenis.application.setWaitingBitcoinCoreRescan(false);

                const retError = new Meteor.Error('ctn_btcore_impkey_conn_error', errMsg, err.stack);

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
            //  waiting on Bitcoin Core to finish rescanning the blockchain
            Catenis.logger.TRACE('Bitcoin Core finished rescanning the blockchain after importing public key');
            Catenis.application.setWaitingBitcoinCoreRescan(false);

            if (callback !== undefined && typeof callback === 'function') {
                // Return successful result
                callback(undefined, true);
            }
        });

        // Indicate that we are waiting on Bitcoin Core to finish rescanning
        //  the blockchain before placing the call to import the public key
        Catenis.application.setWaitingBitcoinCoreRescan();

        request.end(requestJSON);
    }
};

// Note: the 'addresses' arg can be either a single blockchain address or
//  an array of blockchain addresses
BitcoinCore.prototype.listUnspent = function (minConf, addresses) {
    const args = [];
    
    if (typeof minConf === 'string' && addresses === undefined) {
        addresses = minConf;
        minConf = undefined;
    }

    if (minConf !== undefined) {
        args.push(minConf);
    }

    if (addresses !== undefined) {
        if (minConf === undefined) {
            args.push(1);
        }

        args.push(9999999);

        if (!Array.isArray(addresses)) {
            addresses = [addresses];
        }

        args.push(addresses);
    }

    try {
        return this.rpcApi.listunspent.apply(this.btcClient, args);
    }
    catch (err) {
        handleError('listunspent', err);
    }
};

BitcoinCore.prototype.listLockUnspent = function () {
    try {
        return this.rpcApi.listlockunspent();
    }
    catch (err) {
        handleError('listlockunspent', err);
    }
};

// Note: the 'txouts' arg can be either a single tx output or
//  an array of tx outputs. Also, the tx outputs themselves
//  can be formatted as either a string ('txid:vout') or as
//  an object ({txid:'xxxx', vout:n})
BitcoinCore.prototype.lockUnspent = function (txouts) {
    if (!Array.isArray(txouts)) {
        txouts = [txouts];
    }

    txouts = txouts.map((txout) => {
        return convertTxoutStrToObj(txout);
    });

    try {
        return this.rpcApi.lockunspent(false, txouts);
    }
    catch (err) {
        handleError('lockunspent', err);
    }
};

// Note: the 'txouts' arg can be either a single tx output or
//  an array of tx outputs. Also, the tx outputs themselves
//  can be formatted as either a string ('txid:vout') or as
//  an object ({txid:'xxxx', vout:n})
BitcoinCore.prototype.unlockUnspent = function (txouts) {
    if (!Array.isArray(txouts)) {
        txouts = [txouts];
    }

    txouts = txouts.map((txout) => {
        return convertTxoutStrToObj(txout);
    });

    try {
        return this.rpcApi.lockunspent(true, txouts);
    }
    catch (err) {
        handleError('lockunspent', err);
    }
};

BitcoinCore.prototype.sendRawTransaction = function (hexTx) {
    try {
        return this.rpcApi.sendrawtransaction(hexTx);
    }
    catch (err) {
        handleError('sendrawtransaction', err);
    }
};

BitcoinCore.prototype.getMempoolInfo = function () {
    try {
        return this.rpcApi.getmempoolinfo();
    }
    catch (err) {
        handleError('getmempoolinfo', err);
    }
};

// Note: by default the verbose arg is set to false what makes
//  the method return only a list of transaction IDs. Otherwise,
//  it returns an object where each key is a transaction ID the
//  value of which is an object with the transaction details
BitcoinCore.prototype.getRawMempool = function (verbose) {
    const args = [];

    if (verbose !== undefined) {
        args.push(verbose);
    }

    try {
        return this.rpcApi.getrawmempool.apply(this.btcClient, args);
    }
    catch (err) {
        handleError('getrawmempool', err);
    }
};

// Note: by default the verbose arg is set to true what makes
//  the method return an object. Otherwise (verbose specifically
//  set as false), the method returns a hex encoded string, which
//  represents the block contents
BitcoinCore.prototype.getBlock = function (blockHash, verbose) {
    const args = [blockHash];

    if (verbose !== undefined) {
        args.push(verbose);
    }

    try {
        return this.rpcApi.getblock.apply(this.btcClient, args);
    }
    catch (err) {
        handleError('getblock', err);
    }
};

BitcoinCore.prototype.getBlockCount = function () {
    try {
        return this.rpcApi.getblockcount();
    }
    catch (err) {
        handleError('getblockcount', err);
    }
};

BitcoinCore.prototype.getBlockHash = function (blockIndex) {
    try {
        return this.rpcApi.getblockhash(blockIndex);
    }
    catch (err) {
        handleError('getblockhash', err);
    }
};

BitcoinCore.prototype.getTxOut = function (txid, vout) {
    try {
        // Note: no need to set last arg ('includemempool') because by
        //  default it is always set, which is exactly what we want
        return this.rpcApi.gettxout(txid, vout);
    }
    catch (err) {
        handleError('gettxout', err);
    }
};

// Note: if the includeDetails parameter is set to false, the gettransaction RPC
//  method will be called specifying NOT to include watch-only addresses. When
//  that is done, the method will not fail for watch-only addresses imported onto
//  wallet, but only suppress the details portion of the transaction info returned.
//  So, this can be useful if one only needs to retrieve, say, the raw hex data
//  representation of the transaction.
BitcoinCore.prototype.getTransaction = function (txid, includeDetails = false, logError = true) {
    try {
        return this.rpcApi.gettransaction(txid, includeDetails);
    }
    catch (err) {
        handleError('gettransaction', err, logError);
    }
};

// Note: by default the verbose arg is set to false what makes
//  the method return the transaction as a hex enconded string.
//  Otherwise, it returns an object with the transaction details
BitcoinCore.prototype.getRawTransaction = function (txid, verbose, logError = true) {
    const args = [txid];

    if (verbose !== undefined) {
        // NOTE: the type of the verbose parameter has been changed from Number to Boolean in Bitcoin Core ver. 0.14.0 onwards.
        //      However, as of ver. 0.14.1, passing either 1 or 0 is still accepted. Thus, for now, we better just leave the
        //      way it is so it is also compatible with previous versions.
        args.push(verbose ? 1 : 0);
    }

    try {
        return this.rpcApi.getrawtransaction.apply(this.btcClient, args);
    }
    catch (err) {
        handleError('getrawtransaction', err, logError);
    }
};

BitcoinCore.prototype.decodeRawTransaction = function (hexTx, logError = true) {
    try {
        return this.rpcApi.decoderawtransaction(hexTx);
    }
    catch (err) {
        handleError('decoderawtransaction', err, logError);
    }
};

BitcoinCore.prototype.decodeScript = function (hexScript) {
    try {
        return this.rpcApi.decodescript(hexScript);
    }
    catch (err) {
        handleError('decodescript', err);
    }
};

BitcoinCore.prototype.getAddresses = function () {
    try {
        return this.rpcApi.getaddressesbyaccount('');
    }
    catch (err) {
        handleError('getaddressesbyaccount', err);
    }
};

BitcoinCore.prototype.getWalletInfo = function () {
    try {
        return this.rpcApi.getwalletinfo();
    }
    catch (err) {
        handleError('getwalletinfo', err);
    }
};

BitcoinCore.prototype.listTransactions = function (count, from) {
    count = count ? count : 10;
    from = from ? from : 0;

    try {
        return this.rpcApi.listtransactions('*', count, from, true);
    }
    catch (err) {
        handleError('listtransactions', err);
    }
};

BitcoinCore.prototype.getMempoolEntry = function (txid) {
    try {
        return this.rpcApi.command('getmempoolentry', txid);
    }
    catch (err) {
        handleError('getmempoolentry', err);
    }
};

BitcoinCore.prototype.abandonTransaction = function (txid) {
    try {
        return this.rpcApi.command('abandontransaction', txid);
    }
    catch (err) {
        handleError('abandontransaction', err);
    }
};

BitcoinCore.prototype.listSinceBlock = function (blockHash, targetConfirmations) {
    targetConfirmations = targetConfirmations !== undefined ? targetConfirmations : 1;

    try {
        return this.rpcApi.listsinceblock(blockHash, targetConfirmations, true);
    }
    catch (err) {
        handleError('listsinceblock', err);
    }
};

// Note: by default the verbose arg is set to true what makes
//  the method return an object. Otherwise (verbose specifically
//  set as false), the method returns a hex encoded string, which
//  represents the block header contents
BitcoinCore.prototype.getBlockHeader = function (blockHash, verbose) {
    const args = ['getblockheader', blockHash];

    if (verbose !== undefined) {
        args.push(verbose);
    }

    try {
        return this.rpcApi.command.apply(this.btcClient, args);
    }
    catch (err) {
        handleError('getblockheader', err);
    }
};

// The following are special (more complex) methods that do not
//  match directly to only one RPC method
//

BitcoinCore.prototype.getRawTransactionCheck = function (txid, logError = true) {
    // First try to retrieve the raw hex data representation of the transaction
    //  using getrawtransaction RPC method
    try {
        return this.rpcApi.getrawtransaction(txid, false);
    }
    catch (err) {
        if (err.code === BitcoinCore.rpcErrorCode.RPC_INVALID_ADDRESS_OR_KEY) {
            // No transaction exists (neither in mempool nor the blockchain) with that txid.
            //  Check if it is possibly a transaction that had been sent by Catenis previously
            //  and that have been replaced later
            try {
                return this.rpcApi.gettransaction(txid, false).hex;
            }
            catch (err2) {
                handleError('gettransaction', err2, logError);
            }
        }
        else {
            handleError('getrawtransaction', err, logError);
        }
    }
};

// Note: the actual contents of the returned decoded transaction may vary depending on
//  the fact that it had been gotten by calling either the getrawtransaction or the
//  decoderawtransaction RPC methods. The difference is that, when returned by the first
//  RPC method, it includes three additional properties: hex, blockchash, and confirmations
BitcoinCore.prototype.getDecodedRawTransactionCheck = function (txid, logError = true) {
    // First try to retrieve the decoded transaction using getrawtransaction RPC method
    try {
        return this.rpcApi.getrawtransaction(txid, true);
    }
    catch (err) {
        if (err.code === BitcoinCore.rpcErrorCode.RPC_INVALID_ADDRESS_OR_KEY) {
            // No transaction exists (neither in mempool nor the blockchain) with that txid.
            //  Check if it is possibly a transaction that had been sent by Catenis previously
            //  and that have been replaced later
            let hexTx;

            try {
                hexTx = this.rpcApi.gettransaction(txid, false).hex;
            }
            catch (err2) {
                handleError('gettransaction', err2, logError);
            }

            try {
                return this.rpcApi.decoderawtransaction(hexTx);
            }
            catch (err3) {
                handleError('decoderawtransaction', err3, logError);
            }
        }
        else {
            handleError('getrawtransaction', err, logError);
        }
    }
};


// BitcoinCore function class (public) methods
//

BitcoinCore.initialize = function () {
    Catenis.logger.TRACE('BitcoinCore initialization');
    // Instantiate BitcoinCore object
    Catenis.bitcoinCore = new BitcoinCore(Catenis.application.cryptoNetworkName, cfgSettings.serverHost, cfgSettings.rpcUser, cfgSettings.rpcPassword, cfgSettings.rpcConnectionTimeout);
};


// BitcoinCore function class (public) properties
//

BitcoinCore.rpcErrorCode = {
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

BitcoinCore.rpcErrorMessage = {
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
    let errMsg = util.format('Error calling Bitcoin Core \'%s\' RPC method.', methodName);

    if (typeof err.code !== 'undefined') {
        errMsg += util.format(' Returned error code: %s.', err.code);
    }

    // Log error and rethrow it
    if (logError) {
        Catenis.logger.DEBUG(errMsg, err);
    }
    throw new Meteor.Error('ctn_btcore_rpc_error', errMsg, err);
}

function convertTxoutStrToObj(txout) {
    let result = txout,
        searchResult;

    if (typeof txout === 'string' && (searchResult = txout.match(/^(\w+):(\d+)$/))) {
        result = {txid: searchResult[1], vout: parseInt(searchResult[2])};
    }

    return result;
}

function unlockWallet() {
    let result = false;

    try {
        this.rpcApi.walletpassphrase(Catenis.application.walletPsw.toString(), 1);
        result = true;
    }
    catch (err) {
        if (err.code === BitcoinCore.rpcErrorCode.RPC_WALLET_WRONG_ENC_STATE) {
            // Wallet not encrypted. Issue warning and save state
            Catenis.logger.WARN('Trying to unlock a wallet that is not encrypted');
        }
        else {
            // Error trying to unlock wallet. Log error
            Catenis.logger.DEBUG('Error trying to unlock wallet', err);
        }
    }

    return result;
}

function lockWallet() {
    try {
        this.rpcApi.walletlock();
    }
    catch (err) {
        if (err.code === BitcoinCore.rpcErrorCode.RPC_WALLET_WRONG_ENC_STATE) {
            // Wallet not encrypted. Issue warning and save state
            Catenis.logger.WARN('Trying to lock a wallet that is not encrypted');
        }
        else {
            // Error trying to lock wallet. Log error
            Catenis.logger.DEBUG('Error trying to lock wallet', err);
        }
    }
}


// Module code
//

// Lock function class
Object.freeze(BitcoinCore);
