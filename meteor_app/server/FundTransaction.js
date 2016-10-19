/**
 * Created by claudio on 22/07/16.
 */

//console.log('[FundTransaction.js]: This code just ran.');

// Module variables
//

// References to external modules
var util = Npm.require('util');

// Definition of function classes
//

// FundTransaction function class
//
//  Constructor arguments:
//    fundingEvent: [Object] // Object of type FundTransaction.fundingEvent identifying the funding event
//    entityId: [string] (optional) // Should be specified only for 'provision_client_srv_credit' and 'provision_client_device'
//                                      funding events. For the first case, it must match a valid client Id, and, for the
//                                      second case, it must match a valid device Id
//
// NOTE: make sure that objects of this function class are instantiated and used (their methods
//  called) from code executed from the FundSource.utxoCS critical section object
function FundTransaction(fundingEvent, entityId) {
    // Validate funding event argument
    if (!isValidFundingEvent(fundingEvent)) {
        Catenis.logger.ERROR('FundTransaction function class constructor called with invalid argument', {fundingEvent: fundingEvent});
        throw Error('Invalid fundingEvent argument');
    }

    // Validate entity ID argument
    if (fundingEvent.name === FundTransaction.fundingEvent.provision_client_srv_credit || fundingEvent.name === FundTransaction.fundingEvent.provision_client_device) {
        if (entityId == null) {
            Catenis.logger.ERROR('FundTransaction function class constructor called with invalid argument; missing entity ID');
            throw Error('Invalid entityId argument');
        }
        else {
            // Make sure that entity ID is a valid reference to the right entity
            if (fundingEvent.name === FundTransaction.fundingEvent.provision_client_srv_credit) {
                let docClient = Catenis.db.Client.find({clientId: entityId}, {fields: {_id: 1}}).fetch();

                if (docClient == undefined) {
                    Catenis.logger.ERROR('FundTransaction function class constructor called with invalid argument; entity ID not a valid client Id', {entityId: entityId});
                    throw Error('Invalid entityId argument');
                }
            }
            else {
                let docDevice = Catenis.db.Client.find({deviceId: entityId}, {fields: {_id: 1}}).fetch();

                if (docDevice == undefined) {
                    Catenis.logger.ERROR('FundTransaction function class constructor called with invalid argument; entity ID not a valid client Id', {entityId: entityId});
                    throw Error('Invalid entityId argument');
                }
            }
        }
    }


    this.transact = new Catenis.module.Transaction();
    this.fundingEvent = fundingEvent;
    this.entityId = entityId;
    this.payees = [];
    this.fundsAllocated = false;
}


// Public FundTransaction object methods
//

//  blockchainAddress: [BlockchainAddress object]    // Object used to generate addresses to receive payment
//  amountPerAddress: [Array]    // List of amount to be assigned to each individual address
//
FundTransaction.prototype.addPayees = function (blockchainAddress, amountPerAddress) {
    // Prepare list of outputs to be added to transaction by generating
    //  new addresses and associating them with the respective amount
    var p2PKHOutputs = amountPerAddress.map(function (amount) {
        return {
            address: blockchainAddress.newAddressKeys().getAddress(),
            amount: amount
        }
    });

    this.transact.addP2PKHOutputs(p2PKHOutputs);

    // Save type of payee
    this.payees.push(blockchainAddress.type);
};

FundTransaction.prototype.addPayingSource = function () {
    var result = false;

    if (!this.fundsAllocated) {
        var fundSrc = new Catenis.module.FundSource(Catenis.ctnHub.listFundingAddressesInUse(), {});

        // Try to allocate UTXOs to pay for tx expense using optimum fee rate and default
        //  payment resolution
        var fundResult = fundSrc.allocateFundForTxExpense({
            txSize: this.transact.estimateSize(),
            inputAmount: this.transact.totalInputsAmount(),
            outputAmount: this.transact.totalOutputsAmount()
        }, false);

        if (fundResult != null) {
            // NOTE: we DO NOT care to lock the allocated UTXOs because it is expected that
            //  the code used to call this method and the method to actually send the transaction
            //  be executed from a critical section (FundSource.utxoCS) that avoids other UTXOs
            //  to be allocated while that code is running

            // Add inputs spending the allocated UTXOs to the transaction
            var inputs = fundResult.utxos.map(function (utxo) {
                return {
                    txout: utxo.txout,
                    addrKeys: Catenis.keyStore.getCryptoKeysByAddress(utxo.address)
                }
            });

            this.transact.addInputs(inputs);

            if (fundResult.changeAmount > 0) {
                // Add new output to receive change
                this.transact.addP2PKHOutput(Catenis.ctnHub.fundingChangeAddr.newAddressKeys().getAddress(), fundResult.changeAmount);
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
    if (this.transact.txid == undefined) {
        this.transact.sendTransaction();

        // Save sent transaction onto local database
        this.transact.saveSentTransaction(Catenis.module.Transaction.type.funding, {
            event: {
                name: this.fundingEvent.name,
                entityId: this.entityId
            },
            payees: this.payees
        });

        // Check if system funding balance is still within safe limits
        Catenis.ctnHub.checkFundingBalance();
    }

    return this.transact.txid;
};

FundTransaction.prototype.revertPayeeAddresses = function () {
    if (this.payees.length > 0) {
        Catenis.module.BlockchainAddress.BlockchainAddress.revertAddressList(this.transact.listOutputAddresses());
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
    provision_ctn_hub_device: Object.freeze({
        name: 'provision_ctn_hub_device',
        description: 'Provision Catenis Hub device'
    }),
    provision_client_srv_credit: Object.freeze({
        name: 'provision_client_srv_credit',
        description: 'Provision of client service credit'
    }),
    provision_client_device: Object.freeze({
        name: 'provision_client_device',
        description: 'Provision of client device'
    }),
    add_extra_tx_pay_funds: Object.freeze({
        name: 'add_extra_tx_pay_funds',
        description: 'Add extra fund for pay tx expense'
    })
});


// Definition of module (private) functions
//

function isValidFundingEvent(event) {
    isValid = false;

    if (typeof event === 'object' && event != null && typeof event.name === 'string') {
        isValid = Object.keys(FundTransaction.fundingEvent).some(function (key) {
            return FundTransaction.fundingEvent[key].name === event.name;
        });
    }

    return isValid;
}


// Module code
//

// Save module function class reference
if (typeof Catenis === 'undefined')
    Catenis = {};

if (typeof Catenis.module === 'undefined')
    Catenis.module = {};

Catenis.module.FundTransaction = Object.freeze(FundTransaction);
