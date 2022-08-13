/**
 * Created by Claudio on 2018-03-22.
 */

//console.log('[ReceiveAsset.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import util from 'util';
// Third-party node modules
//import config from 'config';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { TransactionMonitor } from './TransactionMonitor';
import { Device } from './Device';
import { Asset } from './Asset';
import { Transaction } from './Transaction';
import { CCTransaction } from './CCTransaction';
import { IssueAssetTransaction } from './IssueAssetTransaction';
import { TransferAssetTransaction } from './TransferAssetTransaction';
import { IssueNFAssetTransaction } from './IssueNFAssetTransaction';
import { TransferNFTokenTransaction } from './TransferNFTokenTransaction';
import { NonFungibleToken } from './NonFungibleToken';

// Config entries
/*const config_entryConfig = config.get('config_entry');

// Configuration settings
const cfgSettings = {
    property: config_entryConfig.get('property_name')
};*/


// Definition of function classes
//

// ReceiveAsset function class
export function ReceiveAsset() {
}


// Public ReceiveAsset object methods
//

/*ReceiveAsset.prototype.pub_func = function () {
};*/


// Module functions used to simulate private ReceiveAsset object methods
//  NOTE: these functions need to be bound to a ReceiveAsset object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// ReceiveAsset function class (public) methods
//

ReceiveAsset.initialize = function () {
    Catenis.logger.TRACE('ReceiveAsset initialization');
    // Set up handler for event indicating that new issue asset transaction has been received
    TransactionMonitor.addEventHandler(TransactionMonitor.notifyEvent.issue_asset_tx_rcvd.name, processIssuedAsset);

    // Set up handler for event indicating that new transfer asset transaction has been received
    TransactionMonitor.addEventHandler(TransactionMonitor.notifyEvent.transfer_asset_tx_rcvd.name, processTransferredAsset);

    // Set up handler for event indicating that issue asset transaction has been confirmed
    TransactionMonitor.addEventHandler(TransactionMonitor.notifyEvent.issue_asset_tx_conf.name, processIssuedAssetConfirmed);

    // Set up handler for event indicating that transfer asset transaction has been confirmed
    TransactionMonitor.addEventHandler(TransactionMonitor.notifyEvent.transfer_asset_tx_conf.name, processTransferredAssetConfirmed);

    // Set up handler for event indicating that new issue non-fungible asset transaction has been received
    TransactionMonitor.addEventHandler(TransactionMonitor.notifyEvent.issue_nf_asset_tx_rcvd.name, processIssuedNFAsset);

    // Set up handler for event indicating that new transfer non-fungible token transaction has been received
    TransactionMonitor.addEventHandler(TransactionMonitor.notifyEvent.transfer_nf_token_tx_rcvd.name, processTransferredNFToken);

    // Set up handler for event indicating that issue non-fungible asset transaction has been confirmed
    TransactionMonitor.addEventHandler(TransactionMonitor.notifyEvent.issue_nf_asset_tx_conf.name, processIssuedNFAssetConfirmed);

    // Set up handler for event indicating that transfer non-fungible token transaction has been confirmed
    TransactionMonitor.addEventHandler(TransactionMonitor.notifyEvent.transfer_nf_token_tx_conf.name, processTransferredNFTokenConfirmed);
};


// ReceiveAsset function class (public) properties
//

/*ReceiveAsset.prop = {};*/


// Definition of module (private) functions
//

function processIssuedAsset(data) {
    Catenis.logger.TRACE('Received notification of newly received issue asset transaction', data);
    try {
        // Check if newly issued asset comes from a different device (not the one that issued it)
        if (data.holdingDeviceId !== data.issuingDeviceId) {
            // Make sure that holding device is active
            const holdingDevice = Device.getDeviceByDeviceId(data.holdingDeviceId);

            if (holdingDevice.status === Device.status.active.name) {
                const issuingDevice = Device.getDeviceByDeviceId(data.issuingDeviceId);

                // Check if holding device should be notified
                if (holdingDevice.shouldBeNotifiedOfReceivedAssetOf(issuingDevice)
                        || holdingDevice.shouldBeNotifiedOfAssetReceivedFrom(issuingDevice)) {
                    // Get issue asset transaction
                    const issueAssetTransact = IssueAssetTransaction.checkTransaction(CCTransaction.fromTransaction(Transaction.fromTxid(data.txid)));

                    if (issueAssetTransact.asset === undefined) {
                        // Asset info not yet in local database. Create it now
                        issueAssetTransact.asset = Asset.getAssetByAssetId(Asset.createAsset(issueAssetTransact.ccTransact));
                    }

                    // Get transaction received date
                    const receivedDate = Catenis.db.collection.ReceivedTransaction.findOne({
                        txid: data.txid
                    }, {
                        fields: {
                            receivedDate: 1
                        }
                    }).receivedDate;

                    // Notify holding device
                    holdingDevice.notifyAssetReceived(issueAssetTransact.asset, issueAssetTransact.amount, issuingDevice, receivedDate);
                }
            }
        }
    }
    catch (err) {
        // Error while processing received issue asset transaction. Log error condition
        Catenis.logger.ERROR(util.format('Error while processing received issue asset transaction (txid: %s).', data.txid), err);
    }
}

function processTransferredAsset(data) {
    Catenis.logger.TRACE('Received notification of newly received transfer asset transaction', data);
    try {
        // Make sure that receiving device is active
        const receivingDevice = Device.getDeviceByDeviceId(data.receivingDeviceId);

        if (receivingDevice.status === Device.status.active.name) {
            // Get transfer asset transaction
            const transferAssetTransact = TransferAssetTransaction.checkTransaction(CCTransaction.fromTransaction(Transaction.fromTxid(data.txid)));

            if (transferAssetTransact.asset === undefined) {
                // Asset info not yet in local database. Create it now

                // Get transaction(s) used to issue this asset
                const assetIssuance = Catenis.c3NodeClient.getAssetIssuance(Asset.getCcAssetIdFromCcTransaction(transferAssetTransact.ccTransact), false);

                transferAssetTransact.asset = Asset.getAssetByAssetId(Asset.createAsset(CCTransaction.fromTransaction(Transaction.fromTxid(Object.keys(assetIssuance)[0]))));
            }

            // Check if receiving device should be notified
            if (receivingDevice.shouldBeNotifiedOfReceivedAssetOf(transferAssetTransact.asset.issuingDevice)
                    || receivingDevice.shouldBeNotifiedOfAssetReceivedFrom(transferAssetTransact.sendingDevice)) {
                // Get transaction received date
                const receivedDate = Catenis.db.collection.ReceivedTransaction.findOne({
                    txid: data.txid
                }, {
                    fields: {
                        receivedDate: 1
                    }
                }).receivedDate;

                // Notify receiving device
                receivingDevice.notifyAssetReceived(transferAssetTransact.asset, transferAssetTransact.amount, transferAssetTransact.sendingDevice, receivedDate);
            }
        }
    }
    catch (err) {
        // Error while processing received transfer asset transaction. Log error condition
        Catenis.logger.ERROR(util.format('Error while processing received transfer asset transaction (txid: %s).', data.txid), err);
    }
}

function processIssuedAssetConfirmed(data) {
    Catenis.logger.TRACE('Received notification of confirmed issue asset transaction', data);
    try {
        // Make sure that holding device is active
        const holdingDevice = Device.getDeviceByDeviceId(data.holdingDeviceId);

        if (holdingDevice.status === Device.status.active.name) {
            const issuingDevice = Device.getDeviceByDeviceId(data.issuingDeviceId);

            // Check if holding device should be notified
            if (holdingDevice.shouldBeNotifiedOfConfirmedAssetOf(issuingDevice)
                    || holdingDevice.shouldBeNotifiedOfConfirmedAssetFrom(issuingDevice)) {
                // Get issue asset transaction
                const issueAssetTransact = IssueAssetTransaction.checkTransaction(CCTransaction.fromTransaction(Transaction.fromTxid(data.txid)));

                if (issueAssetTransact.asset === undefined) {
                    // This should never happen because, at a minimum, the asset info should have already been
                    //  created while processing received issued asset tx event
                    Catenis.logger.WARN('Asset not yet defined in local database while processing notification of confirmed issue asset transaction', {
                        assetId: data.assetId,
                        txid: data.txid
                    });
                    // Asset info not yet in local database. Create it now
                    issueAssetTransact.asset = Asset.getAssetByAssetId(Asset.createAsset(issueAssetTransact.ccTransact));
                }

                // Get transaction confirmation date
                const confirmationDate = getTxConfirmationDate(data.txid);

                // Notify holding device
                holdingDevice.notifyAssetConfirmed(issueAssetTransact.asset, issueAssetTransact.amount, issuingDevice, confirmationDate);
            }
        }
    }
    catch (err) {
        // Error while processing confirmed issue asset transaction. Log error condition
        Catenis.logger.ERROR(util.format('Error while processing confirmed issue asset transaction (txid: %s).', data.txid), err);
    }
}

function processTransferredAssetConfirmed(data) {
    Catenis.logger.TRACE('Received notification of confirmed transfer asset transaction', data);
    try {
        // Get transfer asset transaction
        const transferAssetTransact = TransferAssetTransaction.checkTransaction(CCTransaction.fromTransaction(Transaction.fromTxid(data.txid)));

        if (transferAssetTransact.asset === undefined) {
            // Asset info not yet in local database. Create it now

            // Get transaction(s) used to issue this asset
            const assetIssuance = Catenis.c3NodeClient.getAssetIssuance(Asset.getCcAssetIdFromCcTransaction(transferAssetTransact.ccTransact), false);

            transferAssetTransact.asset = Asset.getAssetByAssetId(Asset.createAsset(CCTransaction.fromTransaction(Transaction.fromTxid(Object.keys(assetIssuance)[0]))));
        }

        let confirmationDate;

        // Check if receiving device should be notified
        if (transferAssetTransact.receivingDevice.status === Device.status.active.name && (transferAssetTransact.receivingDevice.shouldBeNotifiedOfConfirmedAssetOf(transferAssetTransact.asset.issuingDevice)
                || transferAssetTransact.receivingDevice.shouldBeNotifiedOfConfirmedAssetFrom(transferAssetTransact.sendingDevice))) {
            // Get transaction confirmation date
            confirmationDate = getTxConfirmationDate(data.txid);

            // Notify receiving device
            transferAssetTransact.receivingDevice.notifyAssetConfirmed(transferAssetTransact.asset, transferAssetTransact.amount, transferAssetTransact.sendingDevice, confirmationDate);
        }

        // Check if sending device should be notified
        if (transferAssetTransact.sendingDevice.deviceId !== transferAssetTransact.receivingDevice.deviceId
                && transferAssetTransact.changeAmount > 0 && transferAssetTransact.sendingDevice.status === Device.status.active.name
                && (transferAssetTransact.sendingDevice.shouldBeNotifiedOfConfirmedAssetOf(transferAssetTransact.asset.issuingDevice)
                || transferAssetTransact.sendingDevice.shouldBeNotifiedOfConfirmedAssetFrom(transferAssetTransact.sendingDevice))) {
            if (confirmationDate === undefined) {
                // Get transaction confirmation date
                confirmationDate = getTxConfirmationDate(data.txid);
            }

            // Notify receiving device
            transferAssetTransact.sendingDevice.notifyAssetConfirmed(transferAssetTransact.asset, transferAssetTransact.changeAmount, transferAssetTransact.sendingDevice, confirmationDate);
        }
    }
    catch (err) {
        // Error while processing confirmed transfer asset transaction. Log error condition
        Catenis.logger.ERROR(util.format('Error while processing confirmed transfer asset transaction (txid: %s).', data.txid), err);
    }
}

function processIssuedNFAsset(data) {
    Catenis.logger.TRACE('Received notification of newly received issue non-fungible asset transaction', data);
    try {
        // Separate issued/transferred non-fungible tokens by holding devices
        const holdingDeviceIdNFTokenIds = new Map();

        data.holdingDeviceIds.forEach((holdingDeviceId, idx) => {
            if (!holdingDeviceIdNFTokenIds.has(holdingDeviceId)) {
                holdingDeviceIdNFTokenIds.set(holdingDeviceId, [data.nfTokenIds[idx]]);
            }
            else {
                holdingDeviceIdNFTokenIds.get(holdingDeviceId).push(data.nfTokenIds[idx]);
            }
        });

        // Make sure that non-fungible asset is recorded into local database...
        const issueNFAssetTransact = IssueNFAssetTransaction.checkTransaction(CCTransaction.fromTransaction(Transaction.fromTxid(data.txid)));

        if (issueNFAssetTransact.asset === undefined) {
            // (Non-fungible) Asset not yet in local database. Create it now
            issueNFAssetTransact.asset = Asset.getAssetByAssetId(Asset.createAsset(issueNFAssetTransact.ccTransact));
        }

        // ... and also create the associated non-fungible token database docs/recs (if not yet created)
        NonFungibleToken.createNFTokens(issueNFAssetTransact.asset, issueNFAssetTransact.ccTransact);

        // Iterate through each holding device
        for (const [holdingDeviceId, nfTokenIds] of holdingDeviceIdNFTokenIds) {
            // Check if newly issued non-fungible tokens come from a different device (not the one that issued them)
            if (holdingDeviceId !== data.issuingDeviceId) {
                // Make sure that holding device is active
                const holdingDevice = Device.getDeviceByDeviceId(holdingDeviceId);

                if (holdingDevice.status === Device.status.active.name) {
                    const issuingDevice = Device.getDeviceByDeviceId(data.issuingDeviceId);

                    // Check if holding device should be notified
                    if (holdingDevice.shouldBeNotifiedOfReceivedNFTokenOf(issuingDevice)
                            || holdingDevice.shouldBeNotifiedOfNFTokenReceivedFrom(issuingDevice)) {
                        // Get transaction received date
                        const receivedDate = Catenis.db.collection.ReceivedTransaction.findOne({
                            txid: data.txid
                        }, {
                            fields: {
                                receivedDate: 1
                            }
                        }).receivedDate;

                        // Notify holding device
                        holdingDevice.notifyNFTokenReceived(nfTokenIds, issuingDevice, issuingDevice, receivedDate);
                    }
                }
            }
        }
    }
    catch (err) {
        // Error while processing received issue non-fungible asset transaction. Log error condition
        Catenis.logger.ERROR(util.format('Error while processing received issue non-fungible asset transaction (txid: %s).', data.txid), err);
    }
}

function processTransferredNFToken(data) {
    Catenis.logger.TRACE('Received notification of newly received transfer non-fungible token transaction', data);
    try {
        // Make sure that receiving device is active
        const receivingDevice = Device.getDeviceByDeviceId(data.receivingDeviceId);

        if (receivingDevice.status === Device.status.active.name) {
            const sendingDevice = Device.getDeviceByDeviceId(data.sendingDeviceId);

            // Make sure that non-fungible token and its associated asset are recorded into local database
            let asset;
            const transferNFTokenTransact = TransferNFTokenTransaction.checkTransaction(CCTransaction.fromTransaction(Transaction.fromTxid(data.txid)));

            if (transferNFTokenTransact.nfTokenTransfer === undefined) {
                // Non-fungible token doc/rec not yet in local database. Create it.
                //  But first, check if associated non-fungible asset doc/rec also needs to be created
                const ccAssetId = Asset.getCcAssetIdFromCcTransaction(transferNFTokenTransact.ccTransact);

                try {
                    asset = Asset.getAssetByCcAssetId(ccAssetId);
                }
                catch (err) {
                    if (!((err instanceof Meteor.Error) && err.error === 'ctn_asset_not_found')) {
                        // noinspection ExceptionCaughtLocallyJS
                        throw err;
                    }
                }

                if (!asset) {
                    // Asset info not yet in local database. Create it now

                    // Get transaction(s) used to issue this asset
                    const assetIssuance = Catenis.c3NodeClient.getAssetIssuance(ccAssetId, false);

                    asset = Asset.getAssetByAssetId(Asset.createAsset(CCTransaction.fromTransaction(Transaction.fromTxid(Object.keys(assetIssuance)[0]))));
                }

                // Get transaction used to issue this non-fungible token
                const nfTokenIssuance = Catenis.c3NodeClient.getNFTokenIssuance(transferNFTokenTransact.ccTokenId, false);

                // And also create the associated non-fungible token database docs/recs
                NonFungibleToken.createNFTokens(asset, CCTransaction.fromTransaction(Transaction.fromTxid(nfTokenIssuance.txid)));
            }
            else {
                asset = transferNFTokenTransact.nfTokenTransfer.nfToken.asset;
            }

            // Check if receiving device should be notified
            if (receivingDevice.shouldBeNotifiedOfReceivedNFTokenOf(asset.issuingDevice)
                    || receivingDevice.shouldBeNotifiedOfNFTokenReceivedFrom(sendingDevice)) {
                // Get transaction received date
                const receivedDate = Catenis.db.collection.ReceivedTransaction.findOne({
                    txid: data.txid
                }, {
                    fields: {
                        receivedDate: 1
                    }
                }).receivedDate;

                // Notify receiving device
                receivingDevice.notifyNFTokenReceived([data.tokenId], asset.issuingDevice, sendingDevice, receivedDate);
            }
        }
    }
    catch (err) {
        // Error while processing received transfer non-fungible token transaction. Log error condition
        Catenis.logger.ERROR(util.format('Error while processing received transfer non-fungible token transaction (txid: %s).', data.txid), err);
    }
}

function processIssuedNFAssetConfirmed(data) {
    Catenis.logger.TRACE('Received notification of confirmed issue non-fungible asset transaction', data);
    try {
        // Separate issued/transferred non-fungible tokens by holding devices
        const holdingDeviceIdNFTokenIds = new Map();

        data.holdingDeviceIds.forEach((holdingDeviceId, idx) => {
            if (!holdingDeviceIdNFTokenIds.has(holdingDeviceId)) {
                holdingDeviceIdNFTokenIds.set(holdingDeviceId, [data.nfTokenIds[idx]]);
            }
            else {
                holdingDeviceIdNFTokenIds.get(holdingDeviceId).push(data.nfTokenIds[idx]);
            }
        });

        // Make sure that non-fungible asset is recorded in local database...
        const issueNFAssetTransact = IssueNFAssetTransaction.checkTransaction(CCTransaction.fromTransaction(Transaction.fromTxid(data.txid)));

        if (issueNFAssetTransact.asset === undefined) {
            // This should never happen because, at a minimum, the asset should have already been
            //  created while processing received issue non-fungible asset tx event
            Catenis.logger.WARN('Asset not yet defined in local database while processing notification of confirmed issue non-fungible asset transaction', {
                assetId: data.assetId,
                txid: data.txid
            });
            
            // (Non-fungible) Asset not yet in local database. Create it now
            issueNFAssetTransact.asset = Asset.getAssetByAssetId(Asset.createAsset(issueNFAssetTransact.ccTransact));
        }

        // ... and also create the associated non-fungible token database docs/recs (if not yet created)
        NonFungibleToken.createNFTokens(issueNFAssetTransact.asset, issueNFAssetTransact.ccTransact);

        // Iterate through each holding device
        for (const [holdingDeviceId, nfTokenIds] of holdingDeviceIdNFTokenIds) {
            // Make sure that holding device is active
            const holdingDevice = Device.getDeviceByDeviceId(holdingDeviceId);

            if (holdingDevice.status === Device.status.active.name) {
                const issuingDevice = Device.getDeviceByDeviceId(data.issuingDeviceId);

                // Check if holding device should be notified
                if (holdingDevice.shouldBeNotifiedOfConfirmedNFTokenOf(issuingDevice)
                        || holdingDevice.shouldBeNotifiedOfConfirmedNFTokenFrom(issuingDevice)) {
                    // Get transaction confirmation date
                    const confirmationDate = getTxConfirmationDate(data.txid);

                    // Notify holding device
                    holdingDevice.notifyNFTokenConfirmed(nfTokenIds, issuingDevice, issuingDevice, confirmationDate);
                }
            }
        }
    }
    catch (err) {
        // Error while processing confirmed issue non-fungible asset transaction. Log error condition
        Catenis.logger.ERROR(util.format('Error while processing confirmed issue non-fungible asset transaction (txid: %s).', data.txid), err);
    }
}

function processTransferredNFTokenConfirmed(data) {
    Catenis.logger.TRACE('Received notification of confirmed transfer non-fungible token transaction', data);
    try {
        const receivingDevice = Device.getDeviceByDeviceId(data.receivingDeviceId);
        const sendingDevice = Device.getDeviceByDeviceId(data.sendingDeviceId);

        // Make sure that non-fungible token and its associated asset are recorded into local database
        let asset;
        const transferNFTokenTransact = TransferNFTokenTransaction.checkTransaction(CCTransaction.fromTransaction(Transaction.fromTxid(data.txid)));

        if (transferNFTokenTransact.nfTokenTransfer === undefined) {
            // Non-fungible token doc/rec not yet in local database. Create it.
            //  But first, check if associated non-fungible asset doc/rec also needs to be created
            const ccAssetId = Asset.getCcAssetIdFromCcTransaction(transferNFTokenTransact.ccTransact);

            try {
                asset = Asset.getAssetByCcAssetId(ccAssetId);
            }
            catch (err) {
                if (!((err instanceof Meteor.Error) && err.error === 'ctn_asset_not_found')) {
                    // noinspection ExceptionCaughtLocallyJS
                    throw err;
                }
            }

            if (!asset) {
                // Asset info not yet in local database. Create it now

                // Get transaction(s) used to issue this asset
                const assetIssuance = Catenis.c3NodeClient.getAssetIssuance(ccAssetId, false);

                asset = Asset.getAssetByAssetId(Asset.createAsset(CCTransaction.fromTransaction(Transaction.fromTxid(Object.keys(assetIssuance)[0]))));
            }

            // Get transaction used to issue this non-fungible token
            const nfTokenIssuance = Catenis.c3NodeClient.getNFTokenIssuance(transferNFTokenTransact.ccTokenId, false);

            // And also create the associated non-fungible token database docs/recs
            NonFungibleToken.createNFTokens(asset, CCTransaction.fromTransaction(Transaction.fromTxid(nfTokenIssuance.txid)));
        }
        else {
            asset = transferNFTokenTransact.nfTokenTransfer.nfToken.asset;
        }

        let confirmationDate;

        // Check if receiving device should be notified
        if (receivingDevice.status === Device.status.active.name && (receivingDevice.shouldBeNotifiedOfConfirmedNFTokenOf(asset.issuingDevice)
                || receivingDevice.shouldBeNotifiedOfConfirmedNFTokenFrom(sendingDevice))) {
            // Get transaction confirmation date
            confirmationDate = getTxConfirmationDate(data.txid);

            // Notify receiving device
            receivingDevice.notifyNFTokenConfirmed([data.tokenId], asset.issuingDevice, sendingDevice, confirmationDate);
        }

        // Check if sending device should be notified
        if (sendingDevice.deviceId !== receivingDevice.deviceId
                && transferNFTokenTransact.returningCCTokenIds.length > 0 && sendingDevice.status === Device.status.active.name
                && (sendingDevice.shouldBeNotifiedOfConfirmedNFTokenOf(asset.issuingDevice)
                || sendingDevice.shouldBeNotifiedOfConfirmedNFTokenFrom(sendingDevice))) {
            if (!confirmationDate) {
                // Get transaction confirmation date
                confirmationDate = getTxConfirmationDate(data.txid);
            }

            // Notify sending device
            sendingDevice.notifyNFTokenConfirmed([data.tokenId], asset.issuingDevice, sendingDevice, confirmationDate);
        }
    }
    catch (err) {
        // Error while processing confirmed transfer non-fungible token transaction. Log error condition
        Catenis.logger.ERROR(util.format('Error while processing confirmed transfer non-fungible token transaction (txid: %s).', data.txid), err);
    }
}

function getTxConfirmationDate(txid) {
    // Check if transaction send by this Catenis node, and try to get confirmation date from
    //  SentTransaction database collection
    const docSentTx = Catenis.db.collection.SentTransaction.findOne({
        txid: txid
    }, {
        fields: {
            confirmation: 1
        }
    });

    if (docSentTx !== undefined) {
        if (docSentTx.confirmation.confirmed) {
            return docSentTx.confirmation.confirmationDate;
        }
    }
    else {
        // Transaction not sent from this Catenis node, so try to get confirmation date from
        //  ReceivedTransaction database collection
        const docRcvdTx = Catenis.db.collection.ReceivedTransaction.findOne({
            txid: txid
        }, {
            fields: {
                confirmation: 1
            }
        });

        if (docRcvdTx !== undefined && docRcvdTx.confirmation !== undefined && docRcvdTx.confirmation.confirmed) {
            return docRcvdTx.confirmation.confirmationDate;
        }
    }
}


// Module code
//

// Lock function class
Object.freeze(ReceiveAsset);
