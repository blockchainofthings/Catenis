/**
 * Created by claudio on 2021-12-11
 */

//console.log('[IpcRpc.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import events from 'events';
// Third-party node modules
import config from 'config';
// Meteor packages
import { Random } from 'meteor/random';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { Util } from './Util';

// Config entries
const ipcRpcConfig = config.get('ipcRpc');

// Configuration settings
const cfgSettings = {
    rpcCallTimeout: ipcRpcConfig.get('rpcCallTimeout')
};


// Definition of classes
//

/**
 * Class used to make Remote Procedure Call on a child process
 */
export class IpcRpc extends events.EventEmitter {
    /**
     * Class constructor
     * @param {Object} childProc The child process object returned by child_process.fork()
     */
    constructor(childProc) {
        super();

        this.childProc = childProc;
        this.childProcStarted = false;
        /**
         * Storage for RPC calls that are waiting on a response
         * @type {Map<string, {promiseOutcome: {resolve: Function, reject: Function}, timeout: number}>}
         */
        this.waitingReturns = new Map();

        childProc.on('message', this._processIncomingMessage.bind(this));
    }

    /**
     * Execute a command (call a remote procedure) on the child process, and wait asynchronously
     *  for the result of the call
     * @param {string} command The command to be executed
     * @param {Object} [args] The args for the command
     * @return {Promise<unknown>} Promise used to convey the result of the call
     * @private
     */
    call(command, args) {
        let promiseOutcome;
        const promise = new Promise((resolve, reject) => {
            promiseOutcome = {
                resolve,
                reject
            };
        });

        this._execCommand(command, args, promiseOutcome);

        return promise;
    }

    /**
     * Execute a command (call a remote procedure) on the child process not caring of the result of the call
     * @param {string} command The command to be executed
     * @param {Object} [args] The args for the command
     */
    callImmediate(command, args) {
        this._execCommand(command, args);
    }

    /**
     * Execute a command (call a remote procedure) on the child process
     * @param {string} command The command to be executed
     * @param {Object} [args] The args for the command
     * @param {{resolve: Function, reject: Function}} [promiseOutcome] The RPC call promise outcome info used to pass
     *                                                                  the result of the call back to the caller
     * @private
     */
    _execCommand(command, args, promiseOutcome) {
        let error;

        if (this.childProcStarted) {
            // Prepare to call command on child process
            const message = {
                id: Random.id(12),
                cmd: command
            };

            if (args !== undefined) {
                message.args = args;
            }

            if (!this.childProc.send(message, (err) => {
                if (err) {
                    Catenis.logger.ERROR('Error sending IPC call message.', err);
                    if (promiseOutcome) {
                        promiseOutcome.reject(err);
                    }
                }
                else if (promiseOutcome) {
                    // Prepare to pass result of call back to caller
                    this._addWaitingReturnCall(message.id, promiseOutcome);
                }
            })) {
                Catenis.logger.ERROR('IPC call message could not be sent');
                error = new Error('IPC call message could not be sent');
            }
        }
        else {
            Catenis.logger.ERROR('Cannot execute RPC command on child process: child process has not yet started');
            error = new Error('Cannot execute RPC command on child process: child process has not yet started');
        }

        if (error) {
            if (promiseOutcome) {
                promiseOutcome.reject(error);
            }
            else {
                throw error;
            }
        }
    }

    /**
     * Process message received from child process
     * @param {(*|{id: string, response?: *, errMsg?: string})} message The received message
     * @private
     */
    _processIncomingMessage(message) {
        Catenis.logger.TRACE('IpcRpc: received message from child process [%s]', this.childProc.pid, message);
        if (message === 'started') {
            Catenis.logger.TRACE('IpcRpc: child process [%s] has started', this.childProc.pid);
            // Child process has started. Update status and emit notification event
            this.childProcStarted = true;

            this.emit('child_proc_started');
        }
        else {
            if (isValidIpcResponseMessage(message)) {
                // Look for calls that are waiting for return
                const promiseOutcome = this._getWaitingReturnCall(message.id);

                if (promiseOutcome) {
                    if (message.errMsg) {
                        promiseOutcome.reject(new Error('Error executing RPC command on child process: ' + message.errMsg));
                    }
                    else {
                        promiseOutcome.resolve(message.response);
                    }
                }
            }
            else {
                Catenis.logger.ERROR('Invalid IPC response message', message);
            }
        }
    }

    /**
     * Store info about the RPC call to wait for a response
     * @param {string} msgId The message ID of the RPC call
     * @param {{resolve: Function, reject: Function}} promiseOutcome The promise outcome info for the RPC call, which is
     *                                                                used to pass the call outcome back to the caller
     * @private
     */
    _addWaitingReturnCall(msgId, promiseOutcome) {
        this.waitingReturns.set(msgId, {
            promiseOutcome,
            timeout: setTimeout(this._waitReturnTimeout.bind(this, msgId), cfgSettings.rpcCallTimeout)
        });
    }

    /**
     * Retrieve the promise outcome info for an RPC call that is waiting on a response
     * @param {string} msgId The message ID of the RPC call
     * @return {(undefined|{resolve: Function, reject: Function})} The retrieved RPC call promise outcome info, or
     *                                                              undefined if the RPC call was not found
     * @private
     */
    _getWaitingReturnCall(msgId) {
        let promiseOutcome;

        if (this.waitingReturns.has(msgId)) {
            const entry = this.waitingReturns.get(msgId);
            this.waitingReturns.delete(msgId);

            clearTimeout(entry.timeout);
            promiseOutcome = entry.promiseOutcome;
        }

        return promiseOutcome;
    }

    /**
     * Process timeout for an RPC call 
     * @param {string} msgId The message ID of the RPC call
     * @private
     */
    _waitReturnTimeout(msgId) {
        const promiseOutcome = this._getWaitingReturnCall(msgId);

        if (promiseOutcome) {
            Catenis.logger.ERROR(
                'Timeout while waiting on return from RPC command executed on child process [%s]',
                this.childProc.pid,
                { msgId }
            );
            promiseOutcome.reject(new Error('Timeout while waiting on return from RPC command executed on child process'));
        }
    }
}


// Definition of module (private) functions
//

/**
 * Checks if a message returned from the child process is valid
 * @param {(*|{id: string, response?: *, errMsg?: string})} message The message to validate
 * @return {boolean}
 */
function isValidIpcResponseMessage(message) {
    return Util.isNonNullObject(message) && Util.isNonBlankString(message.id)
        && (message.errMsg === undefined || Util.isNonBlankString(message.errMsg));
}


// Module code
//

// Lock class
Object.freeze(IpcRpc);
