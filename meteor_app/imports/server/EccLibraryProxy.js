/**
 * Created by claudio on 2021-12-11
 */

//console.log('[EccLibraryProxy.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import path from 'path';
import cp from 'child_process';
import events from 'events';
// Third-party node modules
import config from 'config';
import _und from 'underscore';
// Meteor packages
import { Promise } from 'meteor/promise';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { IpcRpc } from './IpcRpc';
import { Util } from '../../childProcess/Util.mjs';

// Config entries
const eccLibProxyConfig = config.get('eccLibraryProxy');
const ipcRpcConfig = config.get('ipcRpc');
const childProcConfig = config.get('childProcess')

// Configuration settings
const cfgSettings = {
    inspectPort: eccLibProxyConfig.get('inspectPort'),
    rpcCallTimeout: ipcRpcConfig.get('rpcCallTimeout'),
    nodeJSExec: childProcConfig.get('nodeJSExec'),
    ipcMessageCommand: {
        init: childProcConfig.get('eccLibraryProcess.eccLibraryMain.ipcMessageCommand.init'),
        eccLibraryMethods: childProcConfig.get('eccLibraryProcess.eccLibraryMain.ipcMessageCommand.eccLibraryMethods')
    }
};


// Definition of classes
//

// EccLibraryProxy class
export class EccLibraryProxy extends events.EventEmitter {
    static proxyEvent = Object.freeze({
        ready: Object.freeze({
            name: 'ready',
            description: 'ECC library proxy object is ready for use'
        })
    });

    /**
     * Class constructor
     */
    constructor() {
        super();

        this.ready = false;

        // Instantiate EccLibrary child processes
        const modulePath = path.join(process.env.PWD, 'childProcess/EccLibrary/EccLibraryMain.mjs');
        const env = _und.extend(_und.pick(process.env, 'NODE_ENV', 'NODE_CONFIG_ENV', 'PWD'), {
            NODE_APP_INSTANCE: 'ecc_library' + (process.env.NODE_APP_INSTANCE ? `-${process.env.NODE_APP_INSTANCE}` : '')
        });
        const execArgv = [];

        if (process.execArgv.some(arg => arg.startsWith('--inspect'))) {
            execArgv.push('--inspect-brk=' + cfgSettings.inspectPort);
        }

        const forkOpts = {
            cwd: process.env.PWD,
            env: env,
            execArgv: execArgv
        };

        if (cfgSettings.nodeJSExec) {
            forkOpts.execPath = cfgSettings.nodeJSExec;
        }

        this.eccLibProc = new IpcRpc(cp.fork(modulePath, [], forkOpts));

        // Wait for child process to start
        this.eccLibProc.on('child_proc_started', () => {
            Catenis.logger.TRACE('EccLibraryProxy: child process started');
            // Call command to initiate child process
            this.eccLibProc.call(cfgSettings.ipcMessageCommand.init, {
                psw: Catenis.decipherData(Catenis.cmdLineOpts.cipheredPassword).toString(),
                noCipherProbe: !!Catenis.cmdLineOpts['no-cipher-probe']
            })
            .then(() => {
                // Child process successfully initialized. Indicate that proxy
                //  object is ready for use
                this.ready = true;
                this.emit(EccLibraryProxy.proxyEvent.ready.name);
            })
            .catch(err => {
                Catenis.logger.ERROR('Error calling command to initialize EccLibrary child process.', err);
            });
        });
    }

    /**
     * Make remote procedure call to ECC library method on child process
     * @param {string} method The remote method name
     * @param {*} args The method arguments
     * @return {*}
     * @private
     */
    _callEccLibraryMethod(method, ...args) {
        const result = Promise.await(
            this.eccLibProc.call(method, Util.fromUint8Array(args))
        );

        return Util.toUint8Array(result);
    }

    /**
     * Initialize module
     */
    static initialize() {
        Catenis.logger.TRACE('EccLibraryProxy initialization');
        // Add ECC library methods to local proxy object
        cfgSettings.ipcMessageCommand.eccLibraryMethods
        .forEach(method => {
            this.prototype[method] = function (...args) {
                // noinspection JSPotentiallyInvalidUsageOfClassThis
                return this._callEccLibraryMethod(method, ...args);
            };
        });

        // Instantiate proxy object
        Catenis.eccLibProxy = new EccLibraryProxy();
    }
}


// Definition of module (private) functions
//


// Module code
//

// Lock class
Object.freeze(EccLibraryProxy);
