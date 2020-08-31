/**
 * Created by Claudio on 2015-11-25.
 */

//console.log('[Startup.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import path from 'path';
import fs from 'fs';
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
import { IpfsClusterClient } from './IpfsClusterClient';
import { IpfsServerMonitor } from './IpfsServerMonitor';
import { BitcoinFees } from './BitcoinFees'
import { BaseBlockchainAddress } from './BaseBlockchainAddress';
import { BaseOffChainAddress } from './BaseOffChainAddress';
import { CatenisNode } from './CatenisNode';
import { Client } from './Client';
import { Database } from './Database';
import { Device } from './Device';
import { KeyStore } from './KeyStore';
import { TransactionMonitor } from './TransactionMonitor';
import './CompressResponseBody';
import './ParseRequestBody';
import { RestApi } from './RestApi';
import { BcotPriceUI } from './adminUI/BcotPriceUI';
import { SystemFundingUI } from './adminUI/SystemFundingUI';
import { ClientsUI } from './adminUI/ClientsUI';
import { DevicesUI } from './adminUI/DevicesUI';
import { ReceiveMessage } from './ReceiveMessage';
import { ReadConfirmation } from './ReadConfirmation';
import { Permission } from './Permission';
import { Notification } from './Notification';
import { WebSocketNotifyMsgDispatcher } from './WebSocketNotifyMsgDispatcher';
import { MalleabilityEventEmitter } from './MalleabilityEventEmitter';
import { C3NodeClient } from './C3NodeClient';
import { OmniCore } from './OmniCore';
import { BitcoinTicker } from './BitcoinTicker';
import { BitcoinPrice } from './BitcoinPrice';
import { BcotPrice } from './BcotPrice';
import { BcotPayment } from './BcotPayment';
import { SpendServiceCredit } from './SpendServiceCredit';
import { BcotUsageReportUI } from './adminUI/BcotUsageReportUI';
import { ReceiveAsset } from './ReceiveAsset';
import { AdminUI } from './adminUI/AdminUI';
import { LoginUI } from './adminUI/LoginUI';
import { AccountsEmail } from './AccountsEmail';
import { LicenseExpireEmailNotify } from './LicenseExpireEmailNotify';
import { LicenseOverdueEmailNotify } from './LicenseOverdueEmailNotify';
import { LicenseExpireRemindEmailNotify } from './LicenseExpireRemindEmailNotify';
import { DevicesDisableEmailNotify } from './DevicesDisableEmailNotify';
import { ClientLicense } from './ClientLicense';
import { LicensesUI } from './adminUI/LicensesUI';
import { PaidServicesUI } from './adminUI/PaidServicesUI';
import { ClientUI } from './clientUI/ClientUI';
import { ClientLicensesUI } from './clientUI/ClientLicensesUI';
import { ClientApiAccessUI } from './clientUI/ClientApiAccessUI';
import { ClientPaidServicesUI } from './clientUI/ClientPaidServicesUI';
import { ClientServiceAccountUI } from './clientUI/ClientServiceAccountUI';
import { ClientOwnedDomainsUI } from './clientUI/ClientOwnedDomainsUI';
import { ClientDevicesUI } from './clientUI/ClientDevicesUI';
import { ServiceBillingUI } from './adminUI/ServiceBillingUI';
import { ClientServiceBillingUI } from './clientUI/ClientServiceBillingUI';
import { AdminAccountUI } from './adminUI/AdminAccountUI';
import { BcotReplenishment } from './BcotReplenishment';
import { StoreBcot } from './StoreBcot';
import { RedeemBcot } from './RedeemBcot';
import { BcotSaleStock } from './BcotSaleStock';
import { BcotProductsUI } from './adminUI/BcotProductsUI';
import { BcotSaleAllocationUI } from './adminUI/BcotSaleAllocationUI';
import { BcotSaleStockUI } from './adminUI/BcotSaleStockUI';
import { ProvisionalMessage } from './ProvisionalMessage';
import { CachedMessage } from './CachedMessage';
import { TwoFactorAuthEventEmitter } from './TwoFactorAuthEventEmitter';
import { TwoFactorAuthenticationUI } from './adminUI/TwoFactorAuthenticationUI';
import { ClientTwoFactorAuthenticationUI } from './clientUI/ClientTwoFactorAuthenticationUI';
import { CatenisOffChainClient } from './CatenisOffChainClient';
import { OffChainMessagesSettlement } from './OffChainMessagesSettlement';
import { CatenisOffChainMonitor } from './CatenisOffChainMonitor';
import { BitcoinInfo } from './BitcoinInfo';
import { TransactionCache } from './TransactionCache';
import { ReCaptcha } from './ReCaptcha';
import { PaidService } from './PaidService';
import { StandbyPurchasedBcotUI } from './adminUI/StandbyPurchasedBcotUI';
// TEST - begin
//import { TestCatenisColoredCoins } from './test/TestCatenisColoredCoins';
// TEST - end

// Config entries
const startupConfig = config.get('startup');

// Configuration settings
const cfgSettings = {
    fixMissingAddresses: startupConfig.get('fixMissingAddresses'),
    legacyDustFunding: startupConfig.get('legacyDustFunding'),
    fixDustFunding: startupConfig.get('fixDustFunding'),
    bypassProcessing: startupConfig.get('bypassProcessing'),
    dataToCipher: startupConfig.get('dataToCipher'),
    pidFilename: startupConfig.get('pidFilename')
};


// Module code
//

// Initialization code (on the server)
Meteor.startup(function () {
    if (!Meteor.isTest) {
        // Record ID of current process
        saveProcessId();

        if (cfgSettings.bypassProcessing || cfgSettings.dataToCipher) {
            Catenis.logger.INFO('Bypassing processing...');

            if (cfgSettings.dataToCipher) {
                Application.initialize(true);
                KeyStore.initialize(true);
                Catenis.logger.INFO('*** Ciphered data (base64): %s', Catenis.application.cipherData(cfgSettings.dataToCipher).toString('base64'));
            }
        }
        else {
            // Normal processing
            Catenis.logger.INFO('Starting initialization...');

            // Make sure that dust funding related configuration settings are consistent
            if (cfgSettings.fixDustFunding && cfgSettings.legacyDustFunding) {
                Catenis.logger.FATAL('Inconsistent dust funding related configuration setting; fix dust funding with legacy dust funding set');
                throw new Error('Inconsistent dust funding related configuration setting; fix dust funding with legacy dust funding set');
            }

            Database.initialize();
            Database.migrateRoles();
            Database.removeInconsistentAssetIndices();
            Database.fixBillingExchangeRate();
            Database.removeBcotExchangeRateColl();
            Database.addMissingClientTimeZone();
            Database.addMissingBtcServicePriceField();
            Application.initialize(false, cfgSettings.legacyDustFunding);
            AccountsEmail.initialize();
            BitcoinInfo.initialize();
            TransactionCache.initialize();
            LicenseExpireEmailNotify.initialize();
            LicenseOverdueEmailNotify.initialize();
            LicenseExpireRemindEmailNotify.initialize();
            DevicesDisableEmailNotify.initialize();
            MalleabilityEventEmitter.initialize();
            BitcoinCore.initialize();
            BitcoinFees.initialize();
            BitcoinTicker.initialize();
            BitcoinPrice.initialize();
            BcotPrice.initialize();
            PaidService.initialize();
            KeyStore.initialize();
            OmniCore.initialize();
            IpfsClient.initialize();
            IpfsClusterClient.initialize();
            IpfsServerMonitor.initialize();
            C3NodeClient.initialize();
            Permission.initialize();
            BcotSaleStock.initialize();
            ProvisionalMessage.initialize();
            CachedMessage.initialize();
            CatenisNode.initialize();
            CatenisOffChainClient.initialize();

            Database.addMissingOmniTxValidityField();

            // Make sure that all addresses are currently imported onto Bitcoin Core
            CheckImportAddresses(cfgSettings.fixMissingAddresses);

            BaseBlockchainAddress.initialize(cfgSettings.fixDustFunding);
            BaseOffChainAddress.initialize();
            Client.initialize();
            Device.initialize();

            // Make sure that permission rights are set for all clients, devices and permission events
            Client.checkDeviceDefaultRights();
            Device.checkDeviceInitialRights();

            Database.fixReceivedTransactionBcotPaymentInfo();

            OffChainMessagesSettlement.initialize();

            ClientLicense.initialize();
            BcotPayment.initialize();
            BcotReplenishment.initialize();
            StoreBcot.initialize();
            RedeemBcot.initialize();
            ReceiveMessage.initialize();
            ReadConfirmation.initialize();
            ReceiveAsset.initialize();
            SpendServiceCredit.initialize();
            TransactionMonitor.initialize();
            CatenisOffChainMonitor.initialize();
            ReCaptcha.initialize();
            TwoFactorAuthEventEmitter.initialize();
            ClientTwoFactorAuthenticationUI.initialize();

            // Initialize all notification message dispatchers first
            WebSocketNotifyMsgDispatcher.initialize();
            // Then the notification module itself
            Notification.initialize();

            // TEST - Begin
            //TestCatenisColoredCoins.init();
            // TEST - End
            RestApi.initialize();

            // Make sure that admin user account is defined
            Catenis.application.checkAdminUser();

            // UI support initialization
            AdminUI.initialize();
            LoginUI.initialize();
            AdminAccountUI.initialize();
            BcotPriceUI.initialize();
            BcotProductsUI.initialize();
            BcotSaleAllocationUI.initialize();
            BcotSaleStockUI.initialize();
            SystemFundingUI.initialize();
            BcotUsageReportUI.initialize();
            LicensesUI.initialize();
            PaidServicesUI.initialize();
            ClientsUI.initialize();
            ServiceBillingUI.initialize();
            DevicesUI.initialize();
            StandbyPurchasedBcotUI.initialize();
            TwoFactorAuthenticationUI.initialize();

            ClientUI.initialize();
            ClientLicensesUI.initialize();
            ClientApiAccessUI.initialize();
            ClientPaidServicesUI.initialize();
            ClientServiceAccountUI.initialize();
            ClientServiceBillingUI.initialize();
            ClientOwnedDomainsUI.initialize();
            ClientDevicesUI.initialize();

            Catenis.logger.INFO('Initialization ended.');

            Catenis.application.startProcessing(cfgSettings.fixDustFunding);
        }
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
    const notImportedOmniAddresses = Catenis.keyStore.listAllClientBcotPaymentAddressesInUse().filter((addr) => {
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
                // TODO: today we do not store the date and time when the address was created, which can be used in the importmulti call, so we would need to make change to the KeyStore module to include that info
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

                Catenis.omniCore.importPublicKey(Catenis.keyStore.getCryptoKeysByAddress(lastAddressToImport).exportPublicKey(), true, (error) => {
                    importingOmniAddresses = false;

                    if (error) {
                        throw error;
                    }

                    Catenis.logger.TRACE('Finished importing public key onto Omni Core with blockchain rescan');

                    if (!importingAddresses) {
                        fut.return();
                    }
                });
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

function saveProcessId() {
    fs.writeFile(path.join(process.env.PWD, cfgSettings.pidFilename), process.pid.toString(), (err) => {
        if (err) {
            // Error recording process ID
            Catenis.logger.ERROR('Error recording process ID.', err);
        }
    });
}

export function removeProcessId() {
    try {
        fs.unlinkSync(path.join(process.env.PWD, cfgSettings.pidFilename));
    }
    catch (err) {
        // Error removing process ID file
        Catenis.logger.ERROR('Error removing process ID file.', err);
    }
}