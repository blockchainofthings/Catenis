/**
 * Created by claudio on 2021-07-15
 */

//console.log('[ClientForeignBcAccount.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import events from 'events';
// Third-party node modules
//import config from 'config';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';


// Definition of classes
//

// ClientForeignBcAccount class
export class ClientForeignBcAccount extends events.EventEmitter {
    // Class (public) properties
    //

    static notifyEvent = {
        acc_balance_changed: Object.freeze({
            name: 'acc_balance_changed',
            description: 'Balance of client asset export admin foreign blockchain account has changed'
        })
    };

    /**
     * Class constructor
     * @param {Object} client Catenis client object
     * @param {string} blockchainKey Foreign blockchain key. It should match one of the keys defined in the
     *                                ForeignBlockchain module
     */
    constructor(client, blockchainKey) {
        super();

        this.client = client;
        this.blockchain = Catenis.foreignBlockchains.get(blockchainKey);

        this.clientAccount = client.assetExportAdminForeignBcAccount(blockchainKey);
        this.lastAccBalance = this.blockchain.client.getBalance(this.clientAccount.address);
    }


    // Public object properties (getters/setters)
    //

    /**
     * Address of the client (asset export admin) foreign blockchain account
     * @return {string}
     */
    get address() {
        return this.clientAccount.address;
    }

    /**
     * Balance of the client (asset export admin) foreign blockchain account
     * @return {BigNumber}
     */
    get balance() {
        return this.lastAccBalance;
    }


    // Public object methods
    //

    /**
     * Start monitoring the balance of the client (asset export admin) foreign blockchain account
     */
    startMonitoring() {
        // Subscribe to be notified of blockchain state changes
        this.subscription = this.blockchain.client.web3.eth.subscribe('newBlockHeaders')
        .on('error', err => {
            Catenis.logger.ERROR(`Error while subscribing to get notifications of changed ${this.blockchain.name} blockchain state.`, err);
            if (this.subscriptionId) {
                // Unsubscribe
                this.subscription.unsubscribe(this.subscriptionId);
            }
        })
        .on('data', Meteor.bindEnvironment(() => {
            // Blockchain state has changed. Check if account balance has changed
            Catenis.logger.DEBUG(`${this.blockchain.name} blockchain state has changed`);
            const newAccBalance = this.blockchain.client.getBalance(this.clientAccount.address);

            if (!newAccBalance.eq(this.lastAccBalance)) {
                // Account balance changed. Send notification
                this.lastAccBalance = newAccBalance;
                this.emit(ClientForeignBcAccount.notifyEvent.acc_balance_changed.name, newAccBalance);
            }
        }));
    }

    /**
     * Stop monitoring the balance of the client (asset export admin) foreign blockchain account
     */
    stopMonitoring() {
        if (this.subscription) {
            // Unsubscribe
            this.subscription.unsubscribe((err, success) => {
                if (err) {
                    Catenis.logger.ERROR('Error unsubscribing web3 subscription.', {
                        subscription: this.subscription
                    }, err);
                }
                else if (!success) {
                    Catenis.logger.ERROR('Failed to unsubscribe web3 subscription.', {
                        subscription: this.subscription
                    });
                }

                this.subscription = undefined;
            });
        }
    }
}


// Module code
//

// Lock class
Object.freeze(ClientForeignBcAccount);
