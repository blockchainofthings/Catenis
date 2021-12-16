/**
 * Created by claudio on 2021-12-11
 */

//console.log('[EccLibraryMain.mjs]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import crypto from 'crypto';
// Third-party node modules
import config from 'config';
import CatenisCipher from 'catenis-cipher';
import * as ecc from 'tiny-secp256k1_2';

// References code in other (local) modules
import { Logger } from '../Logger.mjs';
import { Util } from '../Util.mjs';

// Config entries
const eccLibMainConfig = config.get('childProcess.eccLibraryProcess.eccLibraryMain');

// Configuration settings
const cfgSettings = {
    ipcMessageCommand: {
        init: eccLibMainConfig.get('ipcMessageCommand.init'),
        eccLibraryMethods: eccLibMainConfig.get('ipcMessageCommand.eccLibraryMethods')
    }
};

const cipherProbe = config.get('setUpCipherFunctions.cipherProbe');


// Definition of classes
//

/**
 * ECC library child process main module class
 */
export class EccLibraryMain {
    static state = {
        cipherFns: undefined,
        initialized: false
    };

    /**
     * Start this child process
     */
    static start() {
        logger.INFO('Starting process...');
        process.on('message', this._processIncomingMessage.bind(this));

        // Send message to parent process notifying that process has started
        process.send('started');
        logger.INFO('Process started');
    }

    /**
     * Process IPC message received by this child process
     * @param {*|{id: string, cmd: string, args?: Object}} message The incoming message
     * @private
     */
    static _processIncomingMessage(message) {
        //logger.TRACE('EccLibraryMain: received message from parent process', Util.maskSensitiveData(message));
        if (isValidIpcCallMessage(message)) {
            if (message.cmd === cfgSettings.ipcMessageCommand.init) {
                if (!this.state.initialized) {
                    this._initProcess(message.id, message.args);
                }
                else {
                    logger.WARN('Initialize process command received after process has been initialized');
                }
            }
            else if (isValidEccLibraryMethodCommand(message.cmd)) {
                this._callEccLibraryMethod(message.id, message.cmd, Util.toUint8Array(message.args));
            }
            else {
                logger.ERROR('Unknown IPC call command:', message.cmd);
            }
        }
        else {
            logger.ERROR('Invalid IPC call message', Util.maskSensitiveData(message));
        }
    }

    /**
     * Initialize process
     * @param {string} msgId The ID of the received IPC call message
     * @param {*|{psw: string, noCipherProbe?: boolean}} [args] Initialization arguments
     * @private
     */
    static _initProcess(msgId, args) {
        let error;

        try {
            if (!isValidInitArgs(args)) {
                logger.ERROR('Invalid initialization arguments', Util.maskSensitiveData(args));
                error = new Error('Invalid initialization arguments');
            }
            else {
                this.state.cipherFns = initCipherFunctions(args);

                // Add email transports to logger
                logger.addEmailTransports(this.state.cipherFns);

                this.state.initialized = true;
                logger.INFO('Process initialized');
            }
        }
        catch (err) {
            logger.ERROR('Error processing initialize process command.', err);
            error = err;
        }

        this._sendResponse(msgId, undefined, error);
    }

    /**
     * Call an ECC library method
     * @param {string} msgId The ID of the received IPC call message
     * @param {string} method The method to be executed
     * @param {*|*[]} args The method arguments
     * @private
     */
    static _callEccLibraryMethod(msgId, method, args) {
        let response;
        let error;

        try {
            // Make sure that process has been initialized
            if (this.state.initialized) {
                if (!isValidCallEccLibraryMethodArgs(args)) {
                    logger.ERROR('Invalid call ECC library method arguments', Util.maskSensitiveData(args));
                    error = new Error('Invalid call ECC library method arguments');
                }
                else {
                    // Call ECC library method
                    response = Util.fromUint8Array(ecc[method](...args));
                }
            }
            else {
                logger.ERROR('Cannot process incoming IPC message; process has not yet been initialized');
                error = new Error('Cannot process incoming IPC message; process has not yet been initialized');
            }
        }
        catch (err) {
            logger.ERROR('Error processing call ECC library method command.', err);
            error = err;
        }

        this._sendResponse(msgId, response, error);
    }

    /**
     * Sends a message back to parent process in response to a previously received IPC call message
     * @param {string} msgId The message ID
     * @param {*} [response] A success response
     * @param {*} [error] An error response
     * @private
     */
    static _sendResponse(msgId, response, error) {
        const resMessage = {
            id: msgId
        };

        if (error) {
            resMessage.errMsg = error.toString();
        }
        else {
            resMessage.response = response;
        }

        process.send(resMessage);
    }
}


// Definition of module (private) functions
//

/**
 * Checks if a message received by this child process is valid
 * @param {*|{id: string, cmd: string, args?: Object}} message The message to validate
 * @return {boolean}
 */
function isValidIpcCallMessage(message) {
    return Util.isNonNullObject(message) && Util.isNonBlankString(message.id) && Util.isNonBlankString(message.cmd)
        && (message.args === undefined || Util.isNonNullObject(message.args));
}

/**
 * Checks if arguments are valid init command arguments
 * @param {*|{psw: string, noCipherProbe?: boolean}} args Arguments to validate
 * @return {*|boolean}
 */
function isValidInitArgs(args) {
    return Util.isNonNullObject(args) && Util.isNonBlankString(args.psw) && (args.noCipherProbe === undefined
        || typeof args.noCipherProbe === 'boolean');
}

/**
 * Checks if arguments are valid call ECC library method arguments
 * @param {*|*[]} args Arguments to validate
 * @return {boolean}
 */
function isValidCallEccLibraryMethodArgs(args) {
    return Array.isArray(args);
}

/**
 * Checks if command is a valid ECC library method call command
 * @param {string} command Command to validate
 * @return {boolean}
 */
function isValidEccLibraryMethodCommand(command) {
    return cfgSettings.ipcMessageCommand.eccLibraryMethods.includes(command);
}

/**
 * Initialize cipher functions
 * @param {{psw: string, noCipherProbe?: boolean}} args Arguments received from init command containing password to
 *                                                       be used by cipher functions
 * @return {{cipher: Function, decipher: Function}}
 */
function initCipherFunctions(args) {
    try {
        const cipherFns = new CatenisCipher().genCipherFunctions(args.psw);

        if (!args.noCipherProbe) {
            let plainTxtBuf;

            try {
                plainTxtBuf = cipherFns.decipher(cipherProbe.data);
            }
            catch (err) {
                if (err.code === 'ERR_OSSL_EVP_BAD_DECRYPT') {
                    // noinspection ExceptionCaughtLocallyJS
                    throw new Error('Error decrypting cipher probe data; please check your password');
                }

                // noinspection ExceptionCaughtLocallyJS
                throw err;
            }

            const hash = crypto.createHash('sha256');

            const computedHash = hash.update(plainTxtBuf).digest().toString('base64');

            if (computedHash !== cipherProbe.hash) {
                // noinspection ExceptionCaughtLocallyJS
                throw new Error('Cipher probe data mismatch');
            }
        }

        // Cipher functions successfully initialized
        return cipherFns;
    }
    catch (err) {
        throw new Error('Error trying to initialize cipher functions: ' + err.toString());
    }
}


// Module code
//

Logger.initialize();
EccLibraryMain.start();

// Lock class
Object.freeze(EccLibraryMain);
