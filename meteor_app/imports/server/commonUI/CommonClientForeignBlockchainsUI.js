/**
 * Created by claudio on 2021-07-16
 */

//console.log('[CommonClientForeignBlockchainsUI.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
//import config from 'config';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from '../Catenis';
import { ClientForeignBcAccount } from '../ClientForeignBcAccount';


// Definition of function classes
//

// CommonClientForeignBlockchainsUI function class
export function CommonClientForeignBlockchainsUI() {
}


// CommonClientForeignBlockchainsUI function class (public) methods
//

/**
 * Publication auxiliary method for retrieving foreign blockchain records for a given client
 *  Note: this method should be called via the predefined function method .call() passing the context (this) of the
 *         caller publication function (i.e. method.call(this, ...))
 * @param {Object} client Catenis client object
 * @param {boolean} includeAdminAccountInfo Control if the client asset export admin account info (address and balance)
 *                                           is returned
 */
CommonClientForeignBlockchainsUI.foreignBlockchains = function (client, includeAdminAccountInfo = false) {
    const clForeignBcAccounts = [];

    for (const [key, blockchain] of Catenis.foreignBlockchains) {
        // Add record
        const record = {
            name: blockchain.name,
            nativeCoin: {
                name: blockchain.nativeCoin.name,
                symbol: blockchain.nativeCoin.symbol,
                description: blockchain.nativeCoin.description
            },
            consumptionProfile: client.foreignBcConsumptionProfile.get(key).name
        };

        if (includeAdminAccountInfo) {
            const clForeignBcAcc = new ClientForeignBcAccount(client, key);

            record.adminAccount = {
                address: clForeignBcAcc.address,
                balance: blockchain.nativeCoin.fromLowestDenomination(clForeignBcAcc.balance)
            }

            clForeignBcAcc.on(ClientForeignBcAccount.notifyEvent.acc_balance_changed.name, newBalance => {
                // Update record
                this.changed('ClientForeignBlockchain', key, {
                    adminAccount: {
                        address: clForeignBcAcc.address,
                        balance: blockchain.nativeCoin.fromLowestDenomination(newBalance)
                    }
                });
            });

            clForeignBcAccounts.push(clForeignBcAcc);
        }

        this.added('ClientForeignBlockchain', key, record);
    }

    this.ready();

    if (includeAdminAccountInfo) {
        // Start monitoring account balance for all foreign blockchains
        for (const clForeignBcAcc of clForeignBcAccounts) {
            clForeignBcAcc.startMonitoring();
        }
    }

    // Start monitoring change in client's foreign blockchain consumption profile settings
    const observeHandle = Catenis.db.collection.Client.find({
        _id: client.doc_id,
    }, {
        fields: {
            _id: 1,
            foreignBlockchainConsumptionProfile: 1
        }
    })
    .observe({
        changed: (newDoc, oldDoc) => {
            // Detect foreign blockchains that had its consumption profile changed
            const oldForeignBcCP = new Map();

            for (const oldEntry of oldDoc.foreignBlockchainConsumptionProfile) {
                oldForeignBcCP.set(oldEntry.blockchainKey, oldEntry.profileName);
            }

            for (const newEntry of newDoc.foreignBlockchainConsumptionProfile) {
                if (!oldForeignBcCP.has(newEntry.blockchainKey)
                        || oldForeignBcCP.get(newEntry.blockchainKey) !== newEntry.profileName) {
                    // Update record
                    this.changed('ClientForeignBlockchain', newEntry.blockchainKey, {
                        consumptionProfile: newEntry.profileName
                    });
                }
            }
        }
    });

    this.onStop(() => {
        if (includeAdminAccountInfo) {
            // Stop monitoring account balance for all foreign blockchains
            for (const clForeignBcAcc of clForeignBcAccounts) {
                clForeignBcAcc.stopMonitoring();
            }
        }

        // Stop monitoring foreign blockchains' consumption profile
        observeHandle.stop();
    });
};

/**
 * Publication auxiliary method for retrieving a single foreign blockchain record for a given client
 *  Note: this method should be called via the predefined function method .call() passing the context (this) of the
 *         caller publication function (i.e. method.call(this, ...))
 * @param {Object} client Catenis client object
 * @param {ForeignBlockchain} blockchain Foreign blockchain object
 */
CommonClientForeignBlockchainsUI.foreignBlockchainRecord = function (client, blockchain) {
    const clForeignBcAcc = new ClientForeignBcAccount(client, blockchain.key);

    // Add record
    this.added('ClientForeignBlockchain', blockchain.key, {
        name: blockchain.name,
        nativeCoin: {
            name: blockchain.nativeCoin.name,
            symbol: blockchain.nativeCoin.symbol,
            description: blockchain.nativeCoin.description
        },
        consumptionProfile: client.foreignBcConsumptionProfile.get(blockchain.key).name,
        adminAccount: {
            address: clForeignBcAcc.address,
            balance: blockchain.nativeCoin.fromLowestDenomination(clForeignBcAcc.balance)
        }
    });

    clForeignBcAcc.on(ClientForeignBcAccount.notifyEvent.acc_balance_changed.name, newBalance => {
        // Update record
        this.changed('ClientForeignBlockchain', blockchain.key, {
            adminAccount: {
                address: clForeignBcAcc.address,
                balance: blockchain.nativeCoin.fromLowestDenomination(newBalance)
            }
        });
    });

    this.ready();

    // Start monitoring foreign blockchain account balance
    clForeignBcAcc.startMonitoring();

    // Start monitoring change in client's foreign blockchain consumption profile setting
    const observeHandle = Catenis.db.collection.Client.find({
        _id: client.doc_id,
    }, {
        fields: {
            _id: 1,
            foreignBlockchainConsumptionProfile: 1
        }
    })
    .observe({
        changed: (newDoc, oldDoc) => {
            // Check if foreign blockchain had its consumption profile changed
            let oldProfile;

            for (const oldEntry of oldDoc.foreignBlockchainConsumptionProfile) {
                if (oldEntry.blockchainKey === blockchain.key) {
                    oldProfile = oldEntry.profileName;
                    break;
                }
            }

            for (const newEntry of newDoc.foreignBlockchainConsumptionProfile) {
                if (newEntry.blockchainKey === blockchain.key) {
                    if (oldProfile !== newEntry.profileName) {
                        // Update record
                        this.changed('ClientForeignBlockchain', newEntry.blockchainKey, {
                            consumptionProfile: newEntry.profileName
                        });
                    }

                    break;
                }
            }
        }
    });

    this.onStop(() => {
        // Stop monitoring foreign blockchain account balance and consumption profile
        clForeignBcAcc.stopMonitoring();
        observeHandle.stop();
    });
};


// Module code
//

// Lock function class
Object.freeze(CommonClientForeignBlockchainsUI);
