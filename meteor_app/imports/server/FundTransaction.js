/**
 * Created by Claudio on 2016-07-22.
 */

//console.log('[FundTransaction.js]: This code just ran.');

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
import { Catenis } from './Catenis';
import { FundSource } from './FundSource';
import { Transaction } from './Transaction';


// Definition of function classes
//

// FundTransaction function class
//
//  Constructor arguments:
//    fundingEvent: [Object] // Object of type FundTransaction.fundingEvent identifying the funding event
//    entityId: [string] (optional) // Should be specified only for 'provision_client_device' funding events,
//                                      and it must match a valid device Id
//
// NOTE: make sure that objects of this function class are instantiated and used (their methods
//  called) from code executed from the FundSource.utxoCS critical section object
export function FundTransaction(fundingEvent, entityId) {
    // Validate funding event argument
    if (!isValidFundingEvent(fundingEvent)) {
        Catenis.logger.ERROR('FundTransaction function class constructor called with invalid argument', {fundingEvent: fundingEvent});
        throw Error('Invalid fundingEvent argument');
    }

    // Validate entity ID argument
    if (fundingEvent.name === FundTransaction.fundingEvent.provision_client_device) {
        if (entityId === undefined) {
            Catenis.logger.ERROR('FundTransaction function class constructor called with invalid argument; missing entity ID');
            throw Error('Invalid entityId argument');
        }
        else {
            // Make sure that entity ID is a valid reference to the right entity
            const docDevice = Catenis.db.collection.Device.find({deviceId: entityId}, {fields: {_id: 1}}).fetch();

            if (docDevice === undefined) {
                Catenis.logger.ERROR('FundTransaction function class constructor called with invalid argument; entity ID not a valid device Id', {entityId: entityId});
                throw Error('Invalid entityId argument');
            }
        }
    }

    this.transact = new Transaction();
    this.fundingEvent = fundingEvent;
    this.entityId = entityId;
    this.payees = [];
    this.fundsAllocated = false;
}


// Public FundTransaction object methods
//

//  Arguments:
//   blockchainAddress: [BlockchainAddress object] - Object used to generate addresses to receive payment
//   amountPerAddress: [Array] - List of amount to be assigned to each individual address
//   singleAddress: [Boolean] - Indicates whether the last issued blockchain address should be used instead of issuing new ones
//
FundTransaction.prototype.addPayees = function (blockchainAddress, amountPerAddress, useLastAddress = false) {
    // Prepare list of outputs to be added to transaction by generating
    //  new addresses and associating them with the respective amount
    const lastAddress = useLastAddress ? blockchainAddress.lastAddressKeys().getAddress() : undefined;

    const payInfos = amountPerAddress.map((amount) => {
        return {
            address: useLastAddress ? lastAddress : blockchainAddress.newAddressKeys().getAddress(),
            amount: amount
        }
    });

    this.transact.addPubKeyHashOutputs(payInfos);

    // Save type of payee
    this.payees.push(blockchainAddress.type);
};

//  Arguments:
//   blockchainAddressType: [String] - Type of blockchain address
//   address: [String] - Blockchain address to which amount should be paid
//   amount: [Number] - Amount to be assigned to address
//
FundTransaction.prototype.addSingleAddressPayee = function (blockchainAddressType, address, amount) {
    // Add transaction output paying the specified amount to the specific address
    this.transact.addPubKeyHashOutput(address, amount);

    // Save type of payee
    this.payees.push(blockchainAddressType);
};

FundTransaction.prototype.addPayingSource = function () {
    let result = false;

    if (!this.fundsAllocated) {
        const fundSrc = new FundSource(Catenis.ctnHubNode.listFundingAddressesInUse(), {
            useUnconfirmedUtxo: true,
            unconfUtxoInfo: {
                initTxInputs: this.transact.inputs
            },
            smallestChange: true
        });

        // Try to allocate UTXOs to pay for tx expense using optimum fee rate and default
        //  payment resolution
        const fundResult = fundSrc.allocateFundForTxExpense({
            txSize: this.transact.estimateSize(),
            inputAmount: this.transact.totalInputsAmount(),
            outputAmount: this.transact.totalOutputsAmount()
        }, false);

        // noinspection DuplicatedCode
        if (fundResult !== null) {
            // NOTE: we DO NOT care to lock the allocated UTXOs because it is expected that
            //  the code used to call this method and the method to actually send the transaction
            //  be executed from a critical section (FundSource.utxoCS) that avoids other UTXOs
            //  to be allocated while that code is running

            // Add inputs spending the allocated UTXOs to the transaction
            const inputs = fundResult.utxos.map((utxo) => {
                return {
                    txout: utxo.txout,
                    isWitness: utxo.isWitness,
                    scriptPubKey: utxo.scriptPubKey,
                    address: utxo.address,
                    addrInfo: Catenis.keyStore.getAddressInfo(utxo.address)
                }
            });

            this.transact.addInputs(inputs);

            if (fundResult.changeAmount >= Transaction.txOutputDustAmount) {
                // Add new output to receive change
                this.transact.addPubKeyHashOutput(Catenis.ctnHubNode.fundingChangeAddr.newAddressKeys().getAddress(), fundResult.changeAmount);
            }

            // Indicate that funds to pay for tx expense have been allocated
            result = this.fundsAllocated = true;
        }
    }
    else {
        // Funds have been already allocated to pay for tx expense.
        //  Just indicate success and leave
        result = true;
    }

    return result;
};

FundTransaction.prototype.sendTransaction = function () {
    // Check if transaction has not yet been created and sent
    if (this.transact.txid === undefined) {
        this.transact.sendTransaction();

        // Save sent transaction onto local database
        this.transact.saveSentTransaction(Transaction.type.funding, {
            event: {
                name: this.fundingEvent.name,
                entityId: this.entityId
            },
            payees: this.payees
        });

        // Check if system funding balance is still within safe limits
        Catenis.ctnHubNode.checkFundingBalance();
    }

    return this.transact.txid;
};

FundTransaction.prototype.revertPayeeAddresses = function () {
    if (this.payees.length > 0) {
        this.transact.revertOutputAddresses();
    }
};

// Module functions used to simulate private FundTransaction object methods
//  NOTE: these functions need to be bound to a FundTransaction object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//


// FundTransaction function class (public) methods
//


// FundTransaction function class (public) properties
//

FundTransaction.fundingEvent = Object.freeze({
    provision_system_device: Object.freeze({
        name: 'provision_system_device',
        description: 'Provision system device'
    }),
    provision_service_credit_issuance: Object.freeze({
        name: 'provision_service_credit_issuance',
        description: 'Provision system for service credit issuance'
    }),
    provision_bcot_sale_stock: Object.freeze({
        name: 'provision_bcot_sale_stock',
        description: 'Provision system for BCOT token sale stock usage'
    }),
    provision_client_device: Object.freeze({
        name: 'provision_client_device',
        description: 'Provision of client device'
    }),
    add_extra_service_payment_tx_pay_funds: Object.freeze({
        name: 'add_extra_service_payment_tx_pay_funds',
        description: 'Add extra fund for service payment pay tx expense'
    }),
    add_extra_tx_pay_funds: Object.freeze({
        name: 'add_extra_tx_pay_funds',
        description: 'Add extra fund for pay tx expense'
    }),
    add_extra_read_confirm_tx_pay_funds: Object.freeze({
        name: 'add_extra_read_confirm_tx_pay_funds',
        description: 'Add extra fund for read confirmation pay tx expense'
    }),
    add_extra_settle_oc_msgs_tx_pay_funds: Object.freeze({
        name: 'add_extra_settle_oc_msgs_tx_pay_funds',
        description: 'Add extra fund for off-chain messages settlement pay tx expense'
    })
});


// Definition of module (private) functions
//

function isValidFundingEvent(event) {
    let isValid = false;

    if (typeof event === 'object' && event !== null && typeof event.name === 'string') {
        isValid = Object.keys(FundTransaction.fundingEvent).some((key) => {
            return FundTransaction.fundingEvent[key].name === event.name;
        });
    }

    return isValid;
}


// Module code
//

// Lock function class
Object.freeze(FundTransaction);
