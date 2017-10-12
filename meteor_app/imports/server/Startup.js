/**
 * Created by claudio on 25/11/15.
 */

//console.log('[Startup.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//  NOTE: the reference of these modules are done sing 'require()' instead of 'import' to
//      to avoid annoying WebStorm warning message: 'default export is not defined in
//      imported module'
//const util = require('util');
// Third-party node modules
import config from 'config';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { Application } from './Application';
import { BitcoinCore } from './BitcoinCore';
import { BitcoinFees } from './BitcoinFees';
import { BlockchainAddress } from './BlockchainAddress';
import { CatenisNode } from './CatenisNode';
import { Client } from './Client';
//import { ColoredCoins } from './ColoredCoins';
import { Database } from './Database';
import { Device } from './Device';
import { KeyStore } from './KeyStore';
import { TransactionMonitor } from './TransactionMonitor';
import './ParseRequestBody';
import { RestApi } from './RestApi';
import { SystemFundingUI } from './AdminUI/SystemFundingUI';
import { ClientsUI } from './AdminUI/ClientsUI';
import { DevicesUI } from './AdminUI/DevicesUI';
import { ReceiveMessage } from './ReceiveMessage';
import { ReadConfirmation } from './ReadConfirmation';
import { Permission } from './Permission';
import { Notification } from './Notification';
import { WebSocketNotifyMsgDispatcher } from './WebSocketNotifyMsgDispatcher';

// DEBUG - begin
//import { resetBitcoinCore } from './Test/FundSourceTest';
// DEBUG - end

// Config entries
const startupConfig = config.get('startup');

// Configuration settings
const cfgSettings = {
    fixMissingAddresses: startupConfig.get('fixMissingAddresses'),
    bypassProcessing: startupConfig.get('bypassProcessing')
};


// Module code
//

// Initialization code (on the server)
Meteor.startup(function () {
    // DEBUG - begin
    //resetBitcoinCore();
    // DEBUG - end
    if (cfgSettings.bypassProcessing) {
        Catenis.logger.INFO('Bypassing processing...');
    }
    else {
        // Normal processing
        Catenis.logger.INFO('Starting initialization...');
        Database.initialize();
        Application.initialize();
        BitcoinFees.initialize();
        KeyStore.initialize();
        BitcoinCore.initialize();
        //ColoredCoins.initialize();
        Permission.initialize();
        CatenisNode.initialize();

        // Make sure that all addresses are currently imported onto Bitcoin Core
        CheckImportAddresses(cfgSettings.fixMissingAddresses);

        BlockchainAddress.initialize();
        Client.initialize();
        Device.initialize();

        // Make sure that permission rights are set for all clients, devices and permission events
        Client.checkDeviceDefaultRights();
        Device.checkDeviceInitialRights();

        ReceiveMessage.initialize();
        ReadConfirmation.initialize();
        TransactionMonitor.initialize();

        // Initialize all notification message dispatchers first
        WebSocketNotifyMsgDispatcher.initialize();
        // Then the notification module itself
        Notification.initialize();

        RestApi.initialize();

        // UI support initialization
        SystemFundingUI.initialize();
        ClientsUI.initialize();
        DevicesUI.initialize();

        Catenis.logger.INFO('Initialization ended.');

        Catenis.application.startProcessing();
    }
});

function CheckImportAddresses(fixMissingAddresses) {
    Catenis.logger.TRACE('Checking import addresses');
    // Retrieve list of addresses currently imported onto Bitcoin Core
    const btcAddresses = new Set(Catenis.bitcoinCore.getAddresses());

    // Identify addresses currently in use that are not yet imported onto Bitcoin Core
    const notImportedAddresses = Catenis.keyStore.listAddressesInUse().filter((addr) => {
        return !btcAddresses.has(addr);
    });

    if (notImportedAddresses.length > 0) {
        if (fixMissingAddresses) {
            // Import missing addresses
            Catenis.logger.WARN('There are blockchain addresses missing (not currently imported) from Bitcoin Core. They shall be imported now. The system might be unavailable for several minutes.');

            const lastAddressToImport = notImportedAddresses.pop();

            // TODO: replace this loop with a call to the new (as of Bitcoin Core ver. 0.14.0) importmulti JSON-RPC command, which takes an array of objects to import
            // TODO: today we do not store the date and time when the address was created, which can be used in the importnulti call, so we would need to make change to the KeyStore module to include that info
            notImportedAddresses.forEach((addr) => {
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
