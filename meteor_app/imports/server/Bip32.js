/**
 * Created by claudio on 2021-12-15
 */

//console.log('[Bip32.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import config from 'config';
import BIP32Factory from 'bip32';
// Meteor packages
import { Promise } from 'meteor/promise';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { EccLibraryProxy } from './EccLibraryProxy';

// Config entries
const bip32Config = config.get('bip32');

// Configuration settings
const cfgSettings = {
    eccLibProxyReadyTimeout: bip32Config.get('eccLibProxyReadyTimeout')
};


// Definition of classes
//

// Bip32 class
export class Bip32 {
    /**
     * Initialize module
     */
    static initialize() {
        Catenis.logger.TRACE('Bip32 initialization');
        this.waitForEccLibraryProxy();
        Catenis.bip32 = BIP32Factory(Catenis.eccLibProxy);
    }

    /**
     * Wait for ECC library proxy object to be ready for use
     */
    static waitForEccLibraryProxy() {
        Promise.await((() => {
            let promiseOutcome;
            const promise = new Promise((resolve, reject) => {
                promiseOutcome = {
                    resolve,
                    reject
                };
            });

            if (Catenis.eccLibProxy.ready) {
                promiseOutcome.resolve();
            }
            else {
                let timeout;

                function onProxyReady() {
                    if (timeout) {
                        clearTimeout(timeout);
                    }

                    promiseOutcome.resolve();
                }

                timeout = setTimeout(() => {
                    timeout = undefined;
                    Catenis.eccLibProxy.off(EccLibraryProxy.proxyEvent.ready.name, onProxyReady);

                    promiseOutcome.reject(new Error('Timeout waiting for ECC library proxy object to be ready for use'));
                }, cfgSettings.eccLibProxyReadyTimeout);

                Catenis.eccLibProxy.once(EccLibraryProxy.proxyEvent.ready.name, onProxyReady);
            }

            return promise;
        })());
    }
}


// Module code
//

// Lock class
Object.freeze(Bip32);
