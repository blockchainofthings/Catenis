/**
 * Created by claudio on 22/07/16.
 */

//console.log('[FundTransaction.js]: This code just ran.');

// Module variables
//

// References to external modules


// Definition of function classes
//

// FundTransaction function class
//
// NOTE: make sure that objects of this function class are instantiated and used (their methods
//  called) from code executed from the FundSource.utxoCS critical section object
function FundTransaction() {
    this.transact = new Catenis.module.Transaction();
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
        this.transact.saveSentTransaction('funding', {
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


// Definition of module (private) functions
//


// Module code
//

// Save module function class reference
if (typeof Catenis === 'undefined')
    Catenis = {};

if (typeof Catenis.module === 'undefined')
    Catenis.module = {};

Catenis.module.FundTransaction = Object.freeze(FundTransaction);
