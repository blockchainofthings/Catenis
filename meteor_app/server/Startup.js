/**
 * Created by claudio on 25/11/15.
 */

//console.log('[Startup.js]: This code just ran.');

// Module variables
//

// References to external modules
var config = Npm.require('config');

// Config entries
var startupConfig = config.get('startup');

// Configuration settings
var startupConfig = {
    fixMissingAddresses: startupConfig.get('fixMissingAddresses'),
    bypassProcessing: startupConfig.get('bypassProcessing')
};


// Module code
//

// DEBUG - begin
//import {resetBitcoinCore} from './Test/FundSourceTest.js';
// DEBUG - end

// Initialization code (on the server)
Meteor.startup(function () {
    // DEBUG - begin
    //resetBitcoinCore();
    // DEBUG - end
    if (startupConfig.bypassProcessing) {
        Catenis.logger.INFO('Bypassing processing...');
    }
    else {
        // Normal processing
        Catenis.logger.INFO('Starting initialization...');
        Catenis.module.DB.initialize();
        Catenis.module.Application.initialize();
        Catenis.module.BitcoinFees.initialize();
        Catenis.module.KeyStore.initialize();
        Catenis.module.BitcoinCore.initialize();
        //Catenis.module.ColoredCoins.initialize();
        Catenis.module.CatenisNode.initialize();

        // Make sure that all addresses are currently imported onto Bitcoin Core
        CheckImportAddresses(startupConfig.fixMissingAddresses);

        Catenis.module.BlockchainAddress.BlockchainAddress.initialize();
        Catenis.module.Client.initialize();
        Catenis.module.Device.initialize();
        Catenis.module.TransactionMonitor.initialize();
        Catenis.logger.INFO('Initialization ended.');

        Catenis.application.startProcessing();
    }
});

function CheckImportAddresses(fixMissingAddresses) {
    Catenis.logger.TRACE('Checking import addresses');
    // Retrieve list of addresses currently imported onto Bitcoin Core
    var btcAddresses = new Set(Catenis.bitcoinCore.getAddresses());

    // Identify addresses currently in use that are not yet imported onto Bitcoin Core
    var notImportedAddresses = Catenis.keyStore.listAddressesInUse().filter(function (addr) {
        return !btcAddresses.has(addr);
    });

    if (notImportedAddresses.length > 0) {
        if (fixMissingAddresses) {
            // Import missing addresses
            Catenis.logger.WARN('There are blockchain addresses missing (not currently imported) from Bitcoin Core. They shall be imported now. The system might be unavailable for several minutes.');

            var lastAddressToImport = notImportedAddresses.pop();

            notImportedAddresses.forEach(function (addr) {
                // Get public key associated with address and import it onto Bitcoin Core
                //  without rescanning the blockchain
                Catenis.bitcoinCore.importPublicKey(Catenis.keyStore.getCryptoKeysByAddress(addr).exportPublicKey(), false);
            });

            // Now, import public key associated with last address, this time requesting
            //  that the blockchain be rescanned
            Catenis.logger.TRACE('About to import public key onto Bitcoin Core requesting blockchain to be rescanned');
            Meteor.wrapAsync(Catenis.bitcoinCore.importPublicKey, Catenis.bitcoinCore)(Catenis.keyStore.getCryptoKeysByAddress(lastAddressToImport).exportPublicKey(), true);
            Catenis.logger.TRACE('Finished importing public key onto Bitcoin Core with blockchain rescan');
        }
        else {
            // Throw error indicating that some blockchain addresses are missing
            Catenis.logger.FATAL('There are blockchain addresses missing (not currently imported) from Bitcoin Core');
            throw new Meteor.Error('There are blockchain addresses missing (not currently imported) from Bitcoin Core');
        }
    }
}