/**
 * Created by claudio on 25/11/15.
 */

//console.log('[Startup.js]: This code just ran.');

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
    Catenis.logger.INFO('Starting initialization...');
    Catenis.module.DB.inititalize();
    Catenis.module.Application.initialize();
    Catenis.module.BitcoinFees.initialize();
    Catenis.module.KeyStore.initialize();
    Catenis.module.BitcoinCore.initialize();
    Catenis.module.ColoredCoins.initialize();
    Catenis.module.BlockchainAddress.BlockchainAddress.initialize();
    Catenis.module.CatenisHub.initialize();
    Catenis.module.Client.initialize();
    Catenis.logger.INFO('Initialization ended.');
    
    // Make sure that all addresses are currently imported onto Bitcoin Core, and import the ones that are not
    CheckImportAddresses();

    Catenis.ctnHub.startProcessing();
});

function CheckImportAddresses() {
    // Retrieve list of addresses currently imported onto Bitcoin Core
    var btcAddresses = new Set(Catenis.bitcoinCore.getAddresses());

    // Identify addresses currently in use that are not yet imported onto Bitcoin Core
    var notImportedAddresses = Catenis.keyStore.listAddressesInUse().filter(function (addr) {
        return !btcAddresses.has(addr);
    });

    if (notImportedAddresses.length > 0) {
        Catenis.logger.WARN('There are system addresses that are not currently imported onto Bitcoin Core. They shall be imported now. The system might be unavailable for a few minutes.');
        
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
}