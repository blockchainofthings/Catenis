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
import Future from 'fibers/future';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { Application } from './Application';
import { BitcoinCore } from './BitcoinCore';
import { IpfsClient } from './IpfsClient';
import { IpfsServerMonitor } from './IpfsServerMonitor';
import { BitcoinFees } from './BitcoinFees';
import { BlockchainAddress } from './BlockchainAddress';
import { CatenisNode } from './CatenisNode';
import { Client } from './Client';
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
import { MalleabilityEventEmitter } from './MalleabilityEventEmitter';
import { CCFullNodeClient } from './CCFullNodeClient';
import { CCMetadataClient } from './CCMetadataClient';
import { OmniCore } from './OmniCore';

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
        Database.fillClientBillingModeField();
        Application.initialize();
        MalleabilityEventEmitter.initialize();
        BitcoinFees.initialize();
        KeyStore.initialize();
        BitcoinCore.initialize();
        OmniCore.initialize();
        IpfsClient.initialize();
        IpfsServerMonitor.initialize();
        CCFullNodeClient.initialize();
        CCMetadataClient.initialize();
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
    Catenis.logger.TRACE('Checking imported addresses onto Bitcoin Core');
    // Retrieve list of addresses currently imported onto Bitcoin Core
    const btcAddresses = new Set(Catenis.bitcoinCore.getAddresses());

    // Identify addresses currently in use that are not yet imported onto Bitcoin Core
    const notImportedAddresses = Catenis.keyStore.listAddressesInUse().filter((addr) => {
        return !btcAddresses.has(addr);
    });

    Catenis.logger.TRACE('Checking imported addresses onto Omni Core');
    // Retrieve list of addresses currently imported onto Omni Core
    const omniAddresses = new Set(Catenis.omniCore.getAddresses());

    // Identify addresses currently in use that are not yet imported onto Omni Core
    const notImportedOmniAddresses = Catenis.keyStore.listAllClientBcotTokenPaymentAddressesInUse().filter((addr) => {
        return !omniAddresses.has(addr);
    });

    if (notImportedAddresses.length > 0 || notImportedOmniAddresses.length > 0) {
        if (fixMissingAddresses) {
            // Import missing addresses
            const fut = new Future();
            let importingAddresses = false,
                importingOmniAddresses = false;

            if (notImportedAddresses.length > 0) {
                importingAddresses = true;
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

                Catenis.bitcoinCore.importPublicKey(Catenis.keyStore.getCryptoKeysByAddress(lastAddressToImport).exportPublicKey(), true, (error) => {
                    importingAddresses = false;

                    if (error) {
                        throw error;
                    }

                    Catenis.logger.TRACE('Finished importing public key onto Bitcoin Core with blockchain rescan');

                    if (!importingOmniAddresses) {
                        fut.return();
                    }
                });
            }

            if (notImportedOmniAddresses.length > 0) {
                importingOmniAddresses = true;
                Catenis.logger.WARN('There are blockchain addresses missing (not currently imported) from Omni Core. They shall be imported now. The system might be unavailable for several minutes.');

                const lastAddressToImport = notImportedOmniAddresses.pop();

                notImportedOmniAddresses.forEach((addr) => {
                    // Get public key associated with address and import it onto Omni Core
                    //  without rescanning the blockchain
                    Catenis.omniCore.importPublicKey(Catenis.keyStore.getCryptoKeysByAddress(addr).exportPublicKey(), false);
                });

                // Now, import public key associated with last address, this time requesting
                //  that the blockchain be rescanned
                Catenis.logger.TRACE('About to import public key onto Omni Core requesting blockchain to be rescanned');

                Catenis.omniCore.importPublicKey(Catenis.keyStore.getCryptoKeysByAddress(lastAddressToImport).exportPublicKey(), true), (error) => {
                    importingOmniAddresses = false;

                    if (error) {
                        throw error;
                    }

                    Catenis.logger.TRACE('Finished importing public key onto Omni Core with blockchain rescan');

                    if (!importingAddresses) {
                        fut.return();
                    }
                };
            }

            fut.wait();
        }
        else {
            // Throw error indicating that some blockchain addresses are missing
            Catenis.logger.FATAL('There are blockchain addresses missing (not currently imported) from Bitcoin Core and/or Omni Core');
            throw new Meteor.Error('There are blockchain addresses missing (not currently imported) from Bitcoin Core and/or Omni Core');
        }
    }
}
