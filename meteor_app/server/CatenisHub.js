/**
 * Created by claudio on 14/06/16.
 */

//console.log('[CatenisHub.js]: This code just ran.');

// Module variables
//

// References to external modules
var util = Npm.require('util');
/*var config = Npm.require('config');

// Config entries
var config_entryConfig = config.get('config_entry');

// Configuration settings
var cfgSettings = {
    property: config_entryConfig.get('property_name')
};*/


// Definition of function classes
//

// CatenisHub function class
function CatenisHub() {
    // Instantiate objects to manage blockchain addresses for Catenis Hub
    this.deviceMainAddr = Catenis.module.BlockchainAddress.CatenisNodeDeviceMainAddress.getInstance(Catenis.application.ctnHubNodeIndex);
    this.fundingPaymentAddr = Catenis.module.BlockchainAddress.CatenisNodeFundingPaymentAddress.getInstance(Catenis.application.ctnHubNodeIndex);
    this.fundingChangeAddr = Catenis.module.BlockchainAddress.CatenisNodeFundingChangeAddress.getInstance(Catenis.application.ctnHubNodeIndex);
    this.payTxExpenseAddr = Catenis.module.BlockchainAddress.CatenisNodePayTxExpenseAddress.getInstance(Catenis.application.ctnHubNodeIndex);
}


// Public CatenisHub object methods
//

CatenisHub.prototype.startProcessing = function () {
    // Execute code in critical section to avoid UTXOs concurrency
    Catenis.module.FundSource.utxoCS.execute(() => {
        // Make sure that system is properly funded
        this.checkFundingBalance();

        // Check if Catenis Hub device main addresses are already funded
        var devMainAddresses = this.deviceMainAddr.listAddressesInUse(),
            distribFund = Catenis.module.Service.distributeCatenisNodeDeviceMainAddressFund();

        if (devMainAddresses.length > 0) {
            // Catenis Hub device main addresses already exist. Check if
            //  balance is as expected
            var devMainAddrBalance = (new Catenis.module.FundSource(devMainAddresses, {})).getBalance();

            if (devMainAddrBalance != distribFund.totalAmount) {
                // Amount funded to Catenis Hub device main addresses different than expected.
                //  Log inconsistent condition
                Catenis.logger.WARN(util.format('Amount funded to Catenis device main addresses different than expected. Current amount: %s, expected amount: %s', Catenis.module.Util.formatCoins(devMainAddrBalance), Catenis.module.Util.formatCoins(distribFund.totalAmount)));
            }
        }
        else {
            // Catenis Hub device main addresses not available. Assume they
            //  have not yet been funded, so fund them now
            fundDeviceMainAddresses.call(this, distribFund.amountPerAddress);
        }
    });
};

CatenisHub.prototype.listFundingAddressesInUse = function () {
    return this.fundingPaymentAddr.listAddressesInUse().concat(this.fundingChangeAddr.listAddressesInUse());
};

// NOTE: make sure that this method is called from code executed from the FundSource.utxoCS
//  critical section object
CatenisHub.prototype.checkFundingBalance = function () {
    var currBalance = (new Catenis.module.FundSource(this.listFundingAddressesInUse(), {})).getBalance(),
        minBalance = Catenis.module.Service.minimumFundingBalance;

    if (currBalance < minBalance) {
        // Funding balance too low. Send notification refund the system
        Catenis.logger.ACTION('Catenis funding balance too low.', util.format('\nCurrent balance: %s, expected minimum balance: %s\n\nACTION REQUIRED: please refund Catenis immediately.',
                Catenis.module.Util.formatCoins(currBalance), Catenis.module.Util.formatCoins(minBalance)));

        result = false;
    }

    return currBalance;
};

// Module functions used to simulate private CatenisHub object methods
//  NOTE: these functions need to be bound to a CatenisHub object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

function fundDeviceMainAddresses(amountPerAddress) {
    try {
        // Prepare transaction to fund Catenis Hub device main addresses
        var fundTransact = new Catenis.module.FundTransaction();

        fundTransact.addPayees(this.deviceMainAddr, amountPerAddress);

        if (fundTransact.addPayingSource()) {
            // Now, issue (create and send) the transaction
            fundTransact.sendTransaction();
        }
        else {
            // Could not allocated UTXOs to pay for transaction fee.
            //  Throw exception
            //noinspection ExceptionCaughtLocallyJS
            throw new Meteor.Error('ctn_ctnhub_no_fund', 'Could not allocate UTXOs from Catenis funding addresses to pay for tx expense');

            // Revert addresses of payees added to transaction
            fundTransact.revertPayeeAddresses();
        }
    }
    catch (err) {
        // Error funding Catenis Hub device main addresses.
        //  Log error condition
        Catenis.logger.FATAL('Error funding Catenis device main addresses.', err);

        if (fundTransact != undefined) {
            // Revert addresses of payees added to transaction
            fundTransact.revertPayeeAddresses();
        }

        // TODO: put system in an error condition so nothing can be done but generate new fund address to send funds to the system
        // TODO: implement mechanism to check when system receives funds, and reset error the error condition described above
    }
}


// CatenisHub function class (public) methods
//

CatenisHub.initialize = function () {
    Catenis.ctnHub = new CatenisHub();
};


// CatenisHub function class (public) properties
//

/*CatenisHub.prop = {};*/


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Save module function class reference
if (typeof Catenis === 'undefined')
    Catenis = {};

if (typeof Catenis.module === 'undefined')
    Catenis.module = {};

Catenis.module.CatenisHub = Object.freeze(CatenisHub);
