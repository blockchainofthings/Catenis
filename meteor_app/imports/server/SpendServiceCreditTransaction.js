/**
 * Created by Claudio on 2017-12-11.
 */

//console.log('[SpendServiceCreditTransaction.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import util from 'util';
import events from 'events';
// Third-party node modules
import config from 'config';
import BigNumber from 'bignumber.js';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { CCTransaction } from './CCTransaction';
import { Service } from './Service';
import { RbfTransactionInfo } from './RbfTransactionInfo';
import { FundSource } from './FundSource';
import { CCFundSource } from './CCFundSource';
import { BlockchainAddress } from './BlockchainAddress';
import { MalleabilityEventEmitter } from './MalleabilityEventEmitter';
import { Transaction } from './Transaction';
import { CCMetadata } from './CCMetadata';
import { KeyStore } from './KeyStore';
import { Util } from './Util';
import { CatenisNode } from './CatenisNode';
import { CreditServiceAccTransaction } from './CreditServiceAccTransaction';

// Config entries
const spendServCredTxConfig = config.get('spendServiceCreditTransaction');
const spndSrvCrdTxCcMetaConfig = spendServCredTxConfig.get('ccMetadata');

// Configuration settings
const cfgSettings = {
    maxNumClients: spendServCredTxConfig.get('maxNumClients'),
    ccMetadata: {
        servTxidsKey: spndSrvCrdTxCcMetaConfig.get('servTxidsKey')
    },
    unconfirmedTxTimeout: spendServCredTxConfig.get('unconfirmedTxTimeout'),
    txSizeThresholdRatio: spendServCredTxConfig.get('txSizeThresholdRatio')
};


// Definition of function classes
//

// SpendServiceCreditTransaction function class
export class SpendServiceCreditTransaction extends events.EventEmitter {
    constructor (spendServCredCtrl, ccTransact, unconfirmed, addNoBillingServTxs) {
        super();

        // Properties definition
        Object.defineProperties(this, {
            maxNumClientsReached: {
                get: function () {
                    // noinspection JSPotentiallyInvalidUsageOfThis
                    return this.clientIds.length === cfgSettings.maxNumClients;
                },
                enumerable: true
            },
            lastSentTxChangeTxout: {
                get: function () {
                    let changeOutputPos;

                    if (this.lastSentCcTransact !== undefined && (changeOutputPos = getChangeOutputPos.call(this, this.lastSentCcTransact)) >= 0) {
                        return Util.txoutToString({
                            txid: this.lastSentCcTransact.txid,
                            vout: changeOutputPos
                        });
                    }
                },
                enumerable: true
            }
        });

        this.spendServCredCtrl = spendServCredCtrl !== undefined ? spendServCredCtrl : Catenis.spendServCredit;

        if (ccTransact !== undefined) {
            // Initialize object with existing (spend service credit) transaction
            this.ccTransact = ccTransact;

            // Identify ID of clients for which payments of services have been made by this transaction
            this.clientIds = [];

            this.ccTransact.transferInputSeqs.forEach((inputSeq) => {
                const address = getClientOutputAddress.call(this, inputSeq.startPos);

                if (address !== undefined) {
                    const addrInfo = Catenis.keyStore.getAddressInfo(address, true);

                    if (addrInfo.type !== KeyStore.extKeyType.cln_srv_acc_cred_ln_addr.name) {
                        // Invalid address associated with client service account credit line output.
                        //  Log error condition, and throw exception
                        Catenis.logger.ERROR('Invalid address associated with client service account credit line address output for spend service credit transaction', {
                            addressInfo: addrInfo
                        });
                        throw new Error('Invalid address associated with client service account credit line address output for spend service credit transaction');
                    }

                    this.clientIds.push(CatenisNode.getCatenisNodeByIndex(addrInfo.pathParts.ctnNodeIndex).getClientByIndex(addrInfo.pathParts.clientIndex, true).clientId);
                }
                else {
                    // Could not retrieve address associated with client service account credit line output.
                    //  Log error condition, and throw exception
                    Catenis.logger.ERROR('Could not retrieve address associated with client service account credit line output', {
                        ccTransact: ccTransact
                    });
                    throw new Error('Could not retrieve address associated with client service account credit line output');
                }
            });

            // Identify blockchain assigned ID of service transaction for which payments
            //  have been made by this transaction
            if (this.ccTransact.ccMetadata !== undefined && this.ccTransact.ccMetadata.userData !== undefined
                    && this.ccTransact.ccMetadata.userData[cfgSettings.ccMetadata.servTxidsKey] !== undefined) {
                Catenis.logger.DEBUG('>>>>>> Spend service credit Colored Coins metadata', {
                    raw: this.ccTransact.ccMetadata.userData[cfgSettings.ccMetadata.servTxidsKey],
                    string: this.ccTransact.ccMetadata.userData[cfgSettings.ccMetadata.servTxidsKey].toString()
                });
                this.serviceTxids = JSON.parse(this.ccTransact.ccMetadata.userData[cfgSettings.ccMetadata.servTxidsKey].toString());
            }
            else {
                // Colored Coins metadata missing. Try to get service transactions from
                //  local database
                Catenis.logger.WARN('No Colored Coins metadata associated with spend service credit transaction; trying to retrieve associated service transaction IDs from local database.', {
                    'ccTransact.txid': ccTransact.txid
                });
                const docSpendServCredTx = Catenis.db.collection.SentTransaction.findOne({
                    txid: ccTransact.txid,
                    type: 'spend_service_credit'
                }, {
                    fields: {
                        info: 1
                    }
                });

                if (docSpendServCredTx !== undefined) {
                    this.serviceTxids = docSpendServCredTx.info.spendServiceCredit.serviceTxids;
                }
                else {
                    // Unable to retrieve spend service credit transaction from local database.
                    //  Log error condition, and throw exception
                    Catenis.logger.ERROR('Could not find spend service credit transaction; unable to retrieve associated service transaction IDs', {
                        'ccTransact.txid': ccTransact.txid
                    });
                    throw new Error(util.format('Could not find spend service credit transaction (txid: %s); unable to retrieve associated service transaction IDs', ccTransact.txid));
                }
            }

            this.fee = this.ccTransact.feeAmount();

            const changeOutputPos = getChangeOutputPos.call(this);
            this.change = changeOutputPos >= 0 ? this.ccTransact.totalOutputsAmount(changeOutputPos) : 0;

            this.txChanged = false;

            if (addNoBillingServTxs) {
                const extServTxids = Util.mergeArrays(this.serviceTxids, getServiceTxsWithNoBilling());

                if (extServTxids.length > this.serviceTxids.length) {
                    this.serviceTxids = extServTxids;
                    this.txChanged = true;
                }
            }

            this.txFunded = false;
            this.noMorePaymentsAccepted = this.ccTransact.realSize() > Transaction.maxTxSize * cfgSettings.txSizeThresholdRatio;

            // Instantiate RBF tx info object
            initRbfTxInfo.call(this);

            retrieveReplacedTransactionIds.call(this);
            setLastSentTransaction.call(this, unconfirmed !== undefined && unconfirmed);

            if (this.noMorePaymentsAccepted) {
                // Emit event to notify that no more payments are accepted for this spend service credit transaction
                this.emit(SpendServiceCreditTransaction.notifyEvent.no_more_payments.name, this.lastSentCcTransact.txid);
            }
        }
        else {
            this.ccTransact = new CCTransaction(true);
            this.rbfTxInfo = undefined;
            this.clientIds = [];
            this.serviceTxids = [];
            this.fee = 0;
            this.change = 0;
            this.txChanged = false;
            this.txFunded = false;
            this.noMorePaymentsAccepted = false;
            this.txids = [];
            this.lastSentCcTransact = undefined;
        }

        if (unconfirmed === undefined || unconfirmed) {
            // Set up handler for event notifying that txid has changed due to malleability
            this.txidChangedEventHandler = TransactIdChanged.bind(this);

            Catenis.malleabilityEventEmitter.on(MalleabilityEventEmitter.notifyEvent.txid_changed.name, this.txidChangedEventHandler);
        }
    }
}


// Public SpendServiceCreditTransaction object methods
//

// Checks whether a transaction output is used to pay for last sent transaction expense
SpendServiceCreditTransaction.prototype.isTxOutputUsedToPayLastSentTxExpense = function (txout) {
    let result = false;

    if (this.lastSentCcTransact !== undefined) {
        result = getPayTxExpInputs.call(this, this.lastSentCcTransact).some((input) => {
            return input.txout.txid === txout.txid && input.txout.vout === txout.vout;
        });
    }

    return result;
};

// Checks whether a transaction ID has been used for this send service credit transaction
SpendServiceCreditTransaction.prototype.hasTxidBeenUsed = function (txid) {
    return this.txids.some((usedTxid) => {
        return usedTxid === txid;
    })
};

SpendServiceCreditTransaction.prototype.needsToFund = function () {
    return this.txChanged && !this.txFunded;
};

SpendServiceCreditTransaction.prototype.needsToSend = function () {
    return this.txChanged && this.txFunded;
};

// NOTE: make sure that this method is called from code executed from the CCFundSource.utxoCS critical section object
SpendServiceCreditTransaction.prototype.payForService = function (client, serviceTxid, price) {
    if (!this.noMorePaymentsAccepted) {
        const newCcTransact = this.ccTransact.clone();

        newCcTransact.saveSizeProfile();

        let allocateServiceCredit = true;
        let excludeUtxos;
        let addUtxoTxInputs;
        let servCredAmountToAllocate = price;
        let newClient = false;
        let clientInputSeqStartPos;
        let clientOutputAddress;

        const clientTransferInputSeq = getClientTransferInputSeq.call(this, client.clientId, newCcTransact);

        if (clientTransferInputSeq !== undefined) {
            // Transaction already includes payment for this client
            clientInputSeqStartPos = clientTransferInputSeq.startPos;
            clientOutputAddress = getClientOutputAddress.call(this, clientInputSeqStartPos, newCcTransact);

            const assetAmountInfo = newCcTransact.getTransferInputSeqAssetAmountInfo(clientInputSeqStartPos);

            const totalPricePaid = assetAmountInfo.assetAmount.totalBurn;
            const servCredChange = assetAmountInfo.assetAmount.totalTransfer;

            if (price <= servCredChange) {
                // No need to allocate more Catenis service credits to pay for service.
                //  Just adjust the service credit change
                newCcTransact.setTransferOutput(clientOutputAddress, -price, clientInputSeqStartPos);
                newCcTransact.setBurnOutput(price, clientInputSeqStartPos);

                allocateServiceCredit = false;
            }
            else {
                // Needs to allocate more Catenis service credits to pay for service.

                if (this.lastSentCcTransact !== undefined) {
                    const lastTxClientInputSeqStartPos = getClientTransferInputSeq.call(this, client.clientId, this.lastSentCcTransact);

                    // Make sure that client was present is last sent tx
                    if (lastTxClientInputSeqStartPos !== undefined) {
                        // Make sure that Catenis service credit transfer change output of
                        //  last sent transaction is excluded
                        excludeUtxos = this.lastSentCcTransact.getTransferTxOutputs(lastTxClientInputSeqStartPos);

                        // Make sure that UTXOs allocated for last sent tx are included
                        addUtxoTxInputs = this.lastSentCcTransact.getTransferInputs(lastTxClientInputSeqStartPos);
                    }
                }

                // Exclude current transfer input sequence
                newCcTransact.removeTransferInputSequence(clientInputSeqStartPos);

                servCredAmountToAllocate += totalPricePaid;
            }
        }
        else if (this.maxNumClientsReached) {
            // Maximum number of clients has already been reached.
            //  Throw exception
            throw new Meteor.Error('ctn_spend_serv_cred_no_more_client', 'Maximum number of clients has already been reached and no more clients are accepted');
        }
        else {
            newClient = true;
        }

        if (allocateServiceCredit) {
            // Prepare to allocate Catenis service credit from client's service account credit line
            Catenis.logger.DEBUG('>>>>>> About to allocate funds for client service account credit line address outputs', {
                unconfUtxoInfo: undefined,
                higherAmountUtxos: true,
                excludeUtxos: excludeUtxos,
                selectUnconfUtxos: this.lastSentCcTransact === undefined ? CreditServiceAccTransaction.clientServAccCredLineAddrsUnconfUtxos(client.clientId) : undefined,
                addUtxoTxInputs: addUtxoTxInputs
            });
            const servAccCredFundSource = new CCFundSource(client.ctnNode.getServiceCreditAsset().ccAssetId, client.servAccCreditLineAddr.listAddressesInUse(), {
                unconfUtxoInfo: undefined,
                higherAmountUtxos: true,
                excludeUtxos: excludeUtxos,
                selectUnconfUtxos: this.lastSentCcTransact === undefined ? CreditServiceAccTransaction.clientServAccCredLineAddrsUnconfUtxos(client.clientId) : undefined,
                addUtxoTxInputs: addUtxoTxInputs
            });
            const servAccCredAllocResult = servAccCredFundSource.allocateFund(servCredAmountToAllocate);

            // Make sure that UTXOs have been correctly allocated
            if (servAccCredAllocResult === null) {
                // Unable to allocate UTXOs. Log error condition and throw exception
                Catenis.logger.ERROR('Unable to allocate UTXOs for client (clientId: %s) service account credit line addresses', client.clientId);
                throw new Meteor.Error('ctn_spend_serv_cred_utxo_alloc_error', util.format('Unable to allocate UTXOs for client (clientId: %s) service account credit line addresses', client.clientId));
            }

            // Add new transfer inputs to pay for service
            clientInputSeqStartPos = newCcTransact.addTransferInputs(servAccCredAllocResult.utxos.map((utxo) => {
                return {
                    txout: utxo.txout,
                    address: utxo.address,
                    addrInfo: Catenis.keyStore.getAddressInfo(utxo.address)
                }
            }), clientInputSeqStartPos, true);

            if (servAccCredAllocResult.changeAssetAmount > 0) {
                // Add output to receive Catenis service credit change
                if (clientOutputAddress === undefined) {
                    clientOutputAddress = client.servAccCreditLineAddr.newAddressKeys().getAddress();
                }

                newCcTransact.setTransferOutput(clientOutputAddress, servAccCredAllocResult.changeAssetAmount, clientInputSeqStartPos);
            }
            else if (clientOutputAddress !== undefined) {
                // Revert address used to transfer Catenis service credit change which is not needed
                BlockchainAddress.revertAddress(clientOutputAddress);
            }

            // Burn Catenis service credit amount used to pay for the services
            newCcTransact.setChangeBurnOutput(clientInputSeqStartPos);
        }

        // Save ID of service transaction the service provided by which is being paid and
        //  add it to Colored Coins metadata
        const newServiceTxids = this.serviceTxids.concat();
        newServiceTxids.push(serviceTxid);

        const ccMetadata = new CCMetadata();
        ccMetadata.setFreeUserData(cfgSettings.ccMetadata.servTxidsKey, Buffer.from(JSON.stringify(newServiceTxids)), true);
        Catenis.logger.DEBUG('>>>>>> New spend service credit Colored Coins metadata', {
            newServiceTxids: newServiceTxids,
            ccMetadata: ccMetadata
        });

        newCcTransact.setCcMetadata(ccMetadata);

        // Now, try to assemble Colored Coins transaction

        // Pre-allocate multi-signature signee address
        const multiSigSigneeAddr = Catenis.ctnHubNode.multiSigSigneeAddr.newAddressKeys().getAddress();
        let assembleOK = false;

        try {
            // Assemble Colored Coins transaction
            assembleOK = newCcTransact.assemble(multiSigSigneeAddr);
        }
        catch (err) {
            if (err instanceof Meteor.Error) {
                if (err.error === 'ctn_cctx_ccdata_too_large') {
                    // Payment does not fit in transaction.
                    //  Flag condition and throw exception
                    this.noMorePaymentsAccepted = true;
                    throw new Meteor.Error('ctn_spend_serv_cred_no_more_payments', 'No more payments can be processed by this spend service credit transaction');
                }
                else if (err.error !== 'ctn_cctx_ccdata_encode_error') {
                    // Just re-throw exception
                    throw err;
                }
            }
            else {
                // Just re-throw exception
                throw err;
            }
        }

        if (!assembleOK) {
            // Error while assembling Colored Coins transaction data.
            //  Log error condition and throw exception
            Catenis.logger.ERROR('Failed to assemble spend service credit (Colored Coins) transaction', {
                spendServiceCreditTransaction: this
            });
            throw new Meteor.Error('ctn_spend_serv_cred_assemble_error', 'Failed to assemble Spend Service Credit (Colored Coins) transaction');
        }

        if (!newCcTransact.includesMultiSigOutput) {
            // Revert pre-allocated multi-signature signee address
            BlockchainAddress.revertAddress(multiSigSigneeAddr);
        }

        if (this.rbfTxInfo !== undefined) {
            // Prepare to update RBF transaction info
            const compareResult = newCcTransact.compareSizeProfile();
            Catenis.logger.DEBUG('>>>>>> About to adjust RbfTxInfo for spend service credit tx', {
                compareResult: compareResult
            });

            if (compareResult !== undefined) {
                // Update parameters that affect size of transaction
                if (compareResult.numInputs !== undefined) {
                    this.rbfTxInfo.incrementNumTxInputs(compareResult.numInputs.delta);
                }

                if (compareResult.numP2PKHOutputs !== undefined) {
                    this.rbfTxInfo.incrementNumTxOutputs(compareResult.numP2PKHOutputs.delta);
                }

                if (compareResult.numPubKeysMultiSigOutputs !== undefined) {
                    if (compareResult.numPubKeysMultiSigOutputs.delta.added !== undefined) {
                        compareResult.numPubKeysMultiSigOutputs.delta.added.forEach((numPubKeys) => {
                            this.rbfTxInfo.addMultiSigOutput(numPubKeys);
                        });
                    }

                    if (compareResult.numPubKeysMultiSigOutputs.delta.deleted !== undefined) {
                        compareResult.numPubKeysMultiSigOutputs.delta.deleted.forEach((numPubKeys) => {
                            this.rbfTxInfo.addMultiSigOutput(-numPubKeys);
                        });
                    }
                }

                if (compareResult.nullDataPayloadSize !== undefined) {
                    this.rbfTxInfo.setNullDataPayloadSize(compareResult.nullDataPayloadSize.current);
                }
            }
            else {
                // No change in size so just force it to recalculate fee
                this.rbfTxInfo.forceRecalculateFee();
            }
        }

        // Now, update spend service credit transaction
        this.ccTransact = newCcTransact;
        this.serviceTxids = newServiceTxids;

        if (newClient) {
            // Save client Id
            this.clientIds.push(client.clientId);
        }

        // Indicate that tx needs to be funded
        this.txChanged = true;
        this.txFunded = false;
    }
    else {
        // No more payments can be processed by this transaction.
        //  Throw exception
        throw new Meteor.Error('ctn_spend_serv_cred_no_more_payments', 'No more payments can be processed by this spend service credit transaction');
    }
};

// NOTE: make sure that this method is called from code executed from the FundSource.utxoCS critical section object
SpendServiceCreditTransaction.prototype.fundTransaction = function () {
    // Make sure that transaction is not yet funded
    if (!this.txFunded) {
        if (this.rbfTxInfo === undefined) {
            initRbfTxInfo.call(this);
        }
        Catenis.logger.DEBUG('>>>>>> RbfTxInfo for spend service credit tx (before funding):', {
            rbfTxInfo: this.rbfTxInfo
        });

        const changeOutputPos = getChangeOutputPos.call(this);
        const payTxExpInputs = getPayTxExpInputs.call(this);
        let allocatePayTxExpense = true;
        let excludeUtxos;
        let addUtxoTxInputs;
        let expectNumPayTxExpInputs;
        let newFee;
        let newChange = 0;

        if (this.fee === 0) {
            // Prepare to allocate UTXOs to pay for transaction expense for the first time
            
            // Assume that no input shall be used to pay for tx expense
            expectNumPayTxExpInputs = 0;
            
            // And assume that there shall be one output for change
            this.rbfTxInfo.incrementNumTxOutputs(1);
            
            // Get amount that should be paid in fee
            newFee = this.rbfTxInfo.getNewTxFee().fee;
        }
        else {
            if (this.change > 0) {
                // Transaction has already a change output
                if (changeOutputPos < 0) {
                    // Inconsistent condition: spend service credit transaction has change but no change output.
                    //  Log error and throw exception
                    Catenis.logger.ERROR('Inconsistent condition: spend service credit transaction has change but no change output', {
                        spendServCredTransact: this
                    });
                    throw new Error('Inconsistent condition: spend service credit transaction has change but no change output');
                }

                // Get amount that should be paid in fee
                newFee = this.rbfTxInfo.getNewTxFee().fee;

                if (newFee > this.fee) {
                    const deltaFee = newFee - this.fee;

                    // Check if change is enough to cover difference in fee
                    if (this.change >= deltaFee) {
                        newChange = this.change - deltaFee;

                        // Make sure that change amount is not below dust amount
                        if (newChange > 0 && newChange < Transaction.txOutputDustAmount) {
                            newFee += newChange;
                            newChange = 0;
                        }

                        // Adjust change
                        if (newChange === 0) {
                            // Remove output to receive change
                            this.ccTransact.revertOutputAddresses(changeOutputPos, changeOutputPos);
                            this.ccTransact.removeOutputAt(changeOutputPos);
                            this.rbfTxInfo.incrementNumTxOutputs(-1);
                        }
                        else {
                            // Reset amount of change output
                            this.ccTransact.resetOutputAmount(changeOutputPos, newChange);
                        }

                        // Indicate that no more UTXOs should be allocated to pay for tx expense
                        allocatePayTxExpense = false;
                    }
                    else {
                        // Change is not enough to cover difference in fee.
                        //  Prepare to allocate UTXOs to pay for new transaction expense

                        // Assume that the same number of inputs currently used to pay for tx expense
                        //  shall be used to pay for the new tx expense
                        expectNumPayTxExpInputs = payTxExpInputs.length;

                        if (this.lastSentCcTransact !== undefined) {
                            // Make sure that change output of last sent transaction is excluded
                            //  if it exists
                            const lastTxChangeOutputPos = getChangeOutputPos.call(this, this.lastSentCcTransact);

                            if (lastTxChangeOutputPos >= 0) {
                                excludeUtxos = Util.txoutToString({
                                    txid: this.lastSentCcTransact.txid,
                                    vout: lastTxChangeOutputPos
                                });
                            }

                            // Make sure UTXOs allocated to pay expense for last sent tx are included
                            addUtxoTxInputs = getPayTxExpInputs.call(this, this.lastSentCcTransact);
                        }

                        if (payTxExpInputs.length > 0) {
                            // Remove current inputs used to pay for tx expense
                            this.ccTransact.removeInputs(getFirstPayTxExpInputPos.call(this), payTxExpInputs.length);
                        }
                    }
                }
                else {
                    // Current fee is already enough to cover required fee.
                    //  Just indicate that no more UTXOs should be allocated to pay for tx expense
                    allocatePayTxExpense = false;
                }
            }
            else {
                // Transaction does not currently have a change output

                // Assume that the same number of inputs currently used to pay for tx expense
                //  shall be used to pay for the new tx expense
                expectNumPayTxExpInputs = payTxExpInputs.length;

                // And that there shall be one output for change
                this.rbfTxInfo.incrementNumTxOutputs(1);

                // Get amount that should be paid in fee
                newFee = this.rbfTxInfo.getNewTxFee().fee;

                if (newFee > this.fee) {
                    //  Prepare to allocate UTXOs to pay for new transaction expense

                    if (this.lastSentCcTransact !== undefined) {
                        // Make sure that change output of last sent transaction is excluded
                        //  if it exists
                        const lastTxChangeOutputPos = getChangeOutputPos.call(this, this.lastSentCcTransact);

                        if (lastTxChangeOutputPos >= 0) {
                            excludeUtxos = Util.txoutToString({
                                txid: this.lastSentCcTransact.txid,
                                vout: lastTxChangeOutputPos
                            });
                        }

                        // Make sure UTXOs allocated to pay expense for last sent tx are included
                        addUtxoTxInputs = getPayTxExpInputs.call(this, this.lastSentCcTransact);
                    }

                    if (payTxExpInputs.length > 0) {
                        // Remove current inputs used to pay for tx expense
                        this.ccTransact.removeInputs(getFirstPayTxExpInputPos.call(this), payTxExpInputs.length);
                    }
                }
                else {
                    // Current fee is already enough to cover required fee

                    // Adjust RBF tx info to discount change out that is not used
                    this.rbfTxInfo.incrementNumTxOutputs(-1);

                    // And indicate that no more UTXOs should be allocated to pay for tx expense
                    allocatePayTxExpense = false;
                }
            }
        }

        if (allocatePayTxExpense) {
            // Get amount to pay for transaction expense
            let txExpenseAmount = calculateTxExpense.call(this, newFee);

            if (txExpenseAmount > 0) {
                let payTxExpFundSource;
                let payTxExpAllocResult;
                let tryAgain;

                do {
                    tryAgain = false;

                    // Allocate UTXOs to pay for transaction expense
                    if (payTxExpFundSource === undefined) {
                        payTxExpFundSource = new FundSource(Catenis.ctnHubNode.servPymtPayTxExpenseAddr.listAddressesInUse(), {
                            unconfUtxoInfo: this.spendServCredCtrl.numUnconfirmedSpendServCredTxs === 0 ? {} : undefined,
                            higherAmountUtxos: true,
                            excludeUtxos: excludeUtxos,
                            selectUnconfUtxos: this.spendServCredCtrl.terminalSpendServCredTxsChangeTxouts,
                            addUtxoTxInputs: addUtxoTxInputs
                        });
                    }
                    payTxExpAllocResult = payTxExpFundSource.allocateFund(txExpenseAmount);

                    // Make sure that UTXOs have been correctly allocated
                    if (payTxExpAllocResult === null) {
                        // Unable to allocate UTXOs. Log error condition and throw exception
                        Catenis.logger.ERROR('Unable to allocate UTXOs for system service payment pay tx expense addresses');
                        throw new Meteor.Error('ctn_spend_serv_cred_utxo_alloc_error', 'Unable to allocate UTXOs for system service payment pay tx expense addresses');
                    }

                    // Make sure that number of allocated UTXOs match expected number of pay tx expense inputs
                    if (payTxExpAllocResult.utxos.length > expectNumPayTxExpInputs) {
                        // Adjust expected number of pay tx expense inputs, recalculate new fee,
                        //  and try to allocate UTXOs again
                        expectNumPayTxExpInputs++;
                        this.rbfTxInfo.incrementNumTxInputs(1);

                        newFee = this.rbfTxInfo.getNewTxFee().fee;
                        txExpenseAmount = calculateTxExpense.call(this, newFee);

                        payTxExpFundSource.clearAllocatedUtxos();

                        tryAgain = true;
                    }
                    else if (payTxExpAllocResult.utxos.length < expectNumPayTxExpInputs) {
                        // Number of allocated UTXOs is less than expected number of pay tx expense inputs.
                        //  Just adjust RBF tx info to reflect correct number of pay tx expense inputs
                        this.rbfTxInfo.incrementNumTxInputs(payTxExpAllocResult.utxos.length - expectNumPayTxExpInputs);
                    }
                }
                while (tryAgain);

                // Add inputs to pay for tx expense
                this.ccTransact.addInputs(payTxExpAllocResult.utxos.map((utxo) => {
                    return {
                        txout: utxo.txout,
                        address: utxo.address,
                        addrInfo: Catenis.keyStore.getAddressInfo(utxo.address)
                    }
                }));

                // Check if change should be added to transaction
                newChange = payTxExpAllocResult.changeAmount;

                // Make sure that change amount is not below dust amount
                if (newChange > 0 && newChange < Transaction.txOutputDustAmount) {
                    newFee += newChange;
                    newChange = 0;
                }

                if (newChange > 0) {
                    if (changeOutputPos >= 0) {
                        // Change output already exists, so just reset its amount
                        this.ccTransact.resetOutputAmount(changeOutputPos, newChange);
                    }
                    else {
                        // Add change output
                        this.ccTransact.addP2PKHOutput(Catenis.ctnHubNode.servPymtPayTxExpenseAddr.newAddressKeys().getAddress(), newChange);
                    }
                }
                else {
                    // No change output needed
                    if (changeOutputPos >= 0) {
                        // Remove existing change output
                        this.ccTransact.revertOutputAddresses(changeOutputPos, changeOutputPos);
                        this.ccTransact.removeOutputAt(changeOutputPos);
                    }

                    // Adjust RBF tx info to discount change out that is not used
                    this.rbfTxInfo.incrementNumTxOutputs(-1);
                }
            }
            else {
                // No expense amount needed to pay for tx fee
                if (txExpenseAmount < 0) {
                    newChange = -txExpenseAmount;

                    if (newChange < Transaction.txOutputDustAmount) {
                        newFee += newChange;
                        newChange = 0;
                    }
                }

                if (payTxExpInputs.length > 0) {
                    // Remove inputs that were used to pay for tx expense
                    this.ccTransact.removeInputs(getFirstPayTxExpInputPos.call(this), payTxExpInputs);
                }

                if (expectNumPayTxExpInputs > 0) {
                    // Adjust RBF tx info to discount inputs used to pay for tx expense
                    this.rbfTxInfo.incrementNumTxInputs(-expectNumPayTxExpInputs);
                }

                if (newChange === 0) {
                    // No change output needed
                    if (changeOutputPos >= 0) {
                        // Remove existing change output
                        this.ccTransact.revertOutputAddresses(changeOutputPos, changeOutputPos);
                        this.ccTransact.removeOutputAt(changeOutputPos);
                    }

                    // Adjust RBF tx info to discount change out that is not used
                    this.rbfTxInfo.incrementNumTxOutputs(-1);
                }
            }
        }

        // Update transaction fee and change and indicate that transaction is funded
        this.fee = newFee;
        this.rbfTxInfo.adjustNewTxFee(this.fee);
        
        this.change = newChange;

        this.txFunded = true;
        Catenis.logger.DEBUG('>>>>>> RbfTxInfo for spend service credit tx (after funding):', {
            rbfTxInfo: this.rbfTxInfo
        });
    }
    else {
        // Trying to fund spend service credit transaction that is already funded.
        //  Log warning condition
        Catenis.logger.WARN("Trying to fund spend service credit transaction that is already funded", {spendServiceTransaction: this});
    }
};

//  Return value:
//    txid [String] - ID of blockchain transaction that had been issued and sent
SpendServiceCreditTransaction.prototype.sendTransaction = function (isTerminal = false) {
    // Make sure that transaction has already been funded
    if (this.txFunded) {
        // Check if transaction has not yet been created and sent
        if (this.ccTransact.txid === undefined) {
            this.ccTransact.sendTransaction();

            // Reset indication that tx had changed
            this.txChanged = false;

            this.rbfTxInfo.updateTxInfo(this.ccTransact);

            if (isTerminal || this.ccTransact.realSize() > Transaction.maxTxSize * cfgSettings.txSizeThresholdRatio) {
                // Either it has specifically asked for this to the a terminal transaction (no more transactions
                //  should be sent after this one to replace it) or its size is above threshold.
                //  Either way, indicate that no more payments as accepted
                this.noMorePaymentsAccepted = true;
            }

            // Save transaction that had been last sent and update last sent transaction
            const prevLastSentCcTransact = this.lastSentCcTransact;
            setLastSentTransaction.call(this, !isTerminal);

            if (this.noMorePaymentsAccepted) {
                // Emit event to notify that no more payments are accepted for this spend service credit transaction
                this.emit(SpendServiceCreditTransaction.notifyEvent.no_more_payments.name, this.lastSentCcTransact.txid);
            }

            // Save sent transaction onto local database
            this.ccTransact.saveSentTransaction(Transaction.type.spend_service_credit, {
                clientIds: this.clientIds,
                serviceTxids: this.serviceTxids
            });

            if (prevLastSentCcTransact !== undefined) {
                // Update entry of previous spend service credit transaction to indicate that it has been replaced
                const docsUpdated = Catenis.db.collection.SentTransaction.update({
                    txid: prevLastSentCcTransact.txid,
                    'confirmation.confirmed': false,
                    replacedByTxid: {
                        $exists: false
                    }
                }, {
                    $set: {
                        replacedByTxid: this.ccTransact.txid
                    }
                });

                if (docsUpdated === 0) {
                    // Could not find previous spend service credit tx database doc to mark as replaced
                    Catenis.logger.WARN('Could not find previous spend service credit tx database doc to mark as replaced', {
                        txid: prevLastSentCcTransact.txid
                    });
                }
            }

            // Force update of Colored Coins data associated with UTXOs
            Catenis.c3NodeClient.parseNow();

            // Make sure that system addresses (used to pay for spend service credit tx expense) are properly funded
            Meteor.defer(checkSystemFunding);
        }
        else {
            // Trying to send transaction that had already been sent.
            //  Log warning condition and throw exception
            Catenis.logger.WARN('Trying to send spend service credit transaction that had already been sent.', {
                spendServiceCreditTransact: this
            });
            throw new Meteor.Error('ctn_spend_serv_cred_tx_already_sent', 'Trying to send spend service credit transaction that had already been sent');
        }

        return this.ccTransact.txid;
    }
    else {
        // Trying to send spend service credit transaction that is not yet funded.
        //  Log warning condition
        Catenis.logger.WARN("Trying to send spend service credit transaction that is not yet funded", {spendServiceCreditTransaction: this});
    }
};

SpendServiceCreditTransaction.prototype.setOptimumFeeRate = function () {
    this.rbfTxInfo.checkResetFeeRate(Catenis.bitcoinFees.getOptimumFeeRate());
    this.txChanged = true;
    this.txFunded = false;
};

SpendServiceCreditTransaction.prototype.dispose = function () {
    if (this.txidChangedEventHandler !== undefined) {
        // Remove event handler
        Catenis.malleabilityEventEmitter.removeListener(MalleabilityEventEmitter.notifyEvent.txid_changed.name, this.txidChangedEventHandler);
    }
};

SpendServiceCreditTransaction.prototype.txConfirmed = function () {
    if (this.unconfTxTimeoutHandle !== undefined) {
        // Clear out unconfirmed tx timeout
        Meteor.clearTimeout(this.unconfTxTimeoutHandle);
        this.unconfTxTimeoutHandle = undefined;
    }
};

// Return fee information for last sent transaction
SpendServiceCreditTransaction.prototype.getFeeInfo = function () {
    if (this.lastSentCcTransact !== undefined) {
        const lastSentTxFee = this.lastSentCcTransact.feeAmount();

        if (lastSentTxFee !== this.fee) {
            Catenis.logger.WARN('Inconsistent fee for spend service credit transaction', {
                spendServCredTxFee: this.fee,
                lastSentTxFee: lastSentTxFee
            });
        }

        return {
            fee: lastSentTxFee,
            feeShare: new BigNumber(lastSentTxFee).dividedBy(this.serviceTxids.length).round(0, BigNumber.ROUND_HALF_EVEN).toNumber()
        }
    }
};

// Return service transaction IDs that are in this spend service credit transact but not in the other one
SpendServiceCreditTransaction.prototype.missingServiceTxids = function (otherSpendServCredTx) {
    const diffResult = Util.diffArrays(otherSpendServCredTx.serviceTxids, this.serviceTxids);

    return diffResult !== undefined && diffResult.added !== undefined ? diffResult.added : [];
};


// Module functions used to simulate private SpendServiceCreditTransaction object methods
//  NOTE: these functions need to be bound to a SpendServiceCreditTransaction object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

function clientIndex(clientId) {
    return this.clientIds.findIndex((curClientId) => curClientId === clientId);
}

function getClientTransferInputSeq(clientId, ccTransact) {
    ccTransact = ccTransact !== undefined ? ccTransact : this.ccTransact;

    const clientIdx = clientIndex.call(this, clientId);

    if (clientIdx >= 0) {
        return ccTransact.transferInputSeqs[clientIdx];
    }
}

function getClientOutputAddress(inputSeqStartPos, ccTransact) {
    ccTransact = ccTransact !== undefined ? ccTransact : this.ccTransact;

    const outputAddresses = ccTransact.getTransferOutputAddresses(inputSeqStartPos);

    if (outputAddresses.length > 0) {
        return outputAddresses[0];
    }
}

function getPayTxExpInputs(ccTransact) {
    ccTransact = ccTransact !== undefined ? ccTransact : this.ccTransact;

    // noinspection JSPotentiallyInvalidUsageOfThis
    const numCcInputs = ccTransact.numTotalCcInputs;

    // noinspection JSPotentiallyInvalidUsageOfThis
    return ccTransact.inputs.filter((input, pos) => pos >= numCcInputs);
}

function getFirstPayTxExpInputPos(ccTransact) {
    ccTransact = ccTransact !== undefined ? ccTransact : this.ccTransact;

    // noinspection JSPotentiallyInvalidUsageOfThis
    const numCcInputs = ccTransact.numTotalCcInputs;

    // noinspection JSPotentiallyInvalidUsageOfThis
    return ccTransact.countInputs() > numCcInputs ? numCcInputs : -1;
}

function getChangeOutputPos(ccTransact) {
    ccTransact = ccTransact !== undefined ? ccTransact : this.ccTransact;

    const numCcOutputs = ccTransact.numTotalCcOutputs;

    return ccTransact.countOutputs() > numCcOutputs ? ccTransact.outputs.length - 1 : -1;
}

function calculateTxExpense(fee) {
    const delta = this.ccTransact.totalInputsAmount(0, this.ccTransact.numTotalCcInputs) - this.ccTransact.totalOutputsAmount(0, this.ccTransact.numTotalCcOutputs);

    return fee - delta;
}

function TransactIdChanged(data) {
    // Replace reference to txid that has changed due to malleability
    const txidIdx = this.txids.find((txid) => {
        return txid === data.originalTxid;
    });

    if (txidIdx > 0) {
        this.txids[txidIdx] = data.modifiedTxid;

        if (this.lastSentCcTransact !== undefined && this.lastSentCcTransact.txid === data.originalTxid) {
            this.lastSentCcTransact.txid = data.modifiedTxid;
        }
    }
}

function setLastSentTransaction(setUnconfirmedTimer = true) {
    if (this.unconfTxTimeoutHandle !== undefined) {
        // Clear out unconfirmed tx timeout
        Meteor.clearTimeout(this.unconfTxTimeoutHandle);
        this.unconfTxTimeoutHandle = undefined;
    }

    this.txids.push(this.ccTransact.txid);
    this.lastSentCcTransact = this.ccTransact.clone();

    if (setUnconfirmedTimer) {
        // Set up timer to make sure that transaction will not be unconfirmed for too long
        const dtNow = new Date();
        const dtLimit = new Date(this.lastSentCcTransact.sentDate);
        dtLimit.setMinutes(dtLimit.getMinutes() + cfgSettings.unconfirmedTxTimeout);
        let delay = dtLimit.getTime() - dtNow.getTime();

        if (delay < 0) {
            delay = 0;
        }

        this.unconfTxTimeoutHandle = Meteor.setTimeout(unconfirmedTxTimeout.bind(this, this.lastSentCcTransact.txid), delay);
    }
}

function unconfirmedTxTimeout(txid) {
    Catenis.logger.TRACE('Unconfirmed spend service credit transaction timeout', {txid: txid});
    // Spend service credit transaction has not been confirmed for a long time

    // Clear out unconfirmed tx timeout
    this.unconfTxTimeoutHandle = undefined;

    // Make sure that timeout is for last sent transaction
    const lastSentTxid = this.lastSentCcTransact !== undefined ? this.lastSentCcTransact.txid : undefined;

    if (lastSentTxid === txid) {
        // Emit notification event
        this.emit(SpendServiceCreditTransaction.notifyEvent.tx_unconfirmed_too_long.name, txid);
    }
    else {
        // Spend service credit tx for which unconfirmed timeout was set is not the last sent transaction.
        //  Log warning condition
        Catenis.logger.WARN('Spend service credit tx for which unconfirmed timeout was set is not the last sent transaction', {
            lastSentTxid: lastSentTxid,
            timeoutTxid: txid
        });
    }
}

function initRbfTxInfo() {
    const opts = {
        paymentResolution: Service.servicePaymentResolution,
        initNumTxInputs: this.ccTransact.countInputs(),
        initNumTxOutputs: this.ccTransact.countP2PKHOutputs(),
        initNumPubKeysMultiSigTxOutputs: this.ccTransact.getNumPubKeysMultiSigOutputs(),
        initTxNullDataPayloadSize: this.ccTransact.nullDataPayloadSize,
        txFeeRateIncrement: Service.spendServiceCreditTxFeeRateIncrement
    };

    if (this.fee > 0) {
        opts.initTxFee = this.fee;
    }
    else {
        opts.initTxFeeRate = Service.spendServiceCreditInitTxFeeRate;
    }

    this.rbfTxInfo = new RbfTransactionInfo(opts);
}

function retrieveReplacedTransactionIds() {
    this.txids = [];
    let nextTxid = this.ccTransact.txid;

    do {
        const replacedTxDoc = Catenis.db.collection.SentTransaction.findOne({
            type: Transaction.type.spend_service_credit.name,
            replacedByTxid: nextTxid
        }, {
            fields: {
                txid: 1
            }
        });

        if (replacedTxDoc) {
            nextTxid = replacedTxDoc.txid;
            this.txids.unshift(nextTxid);
        }
        else {
            nextTxid = undefined;
        }
    }
    while (nextTxid);
}


// SpendServiceCreditTransaction function class (public) methods
//

// Determines if transaction is a valid Catenis Spend Service Credit transaction
//
//  Arguments:
//   ccTransact: [Object(CCTransaction)] - The instance of the (Colored Coins) transaction to be checked
//
//  Return:
//   spendServCredTransact: [Object(SpendServiceCreditTransaction)] - An instance of the spend service credit transaction, or undefined
//                                                                     if transaction is not a valid spend service credit transaction
SpendServiceCreditTransaction.checkTransaction = function (ccTransact) {
    let spendServCredTransact = undefined;

    // First, check if pattern of transaction's inputs and outputs is consistent
    if ((ccTransact instanceof CCTransaction) && ccTransact.matches(SpendServiceCreditTransaction)) {
        try {
            // Now, try to initialize read confirmation transaction
            spendServCredTransact = new SpendServiceCreditTransaction(undefined, ccTransact);
        }
        catch (err) {
            // Error checking spend credit service transaction. Log error condition
            Catenis.logger.ERROR('Error checking spend service credit transaction (txid: %s).', ccTransact.txid, err);
        }
    }

    return spendServCredTransact;
};


// SpendServiceCreditTransaction function class (public) properties
//

SpendServiceCreditTransaction.matchingPattern = Object.freeze({
    input: util.format('^(?:%s)+(?:%s)*$',
        Transaction.ioToken.p2_cln_srv_acc_cred_ln_addr.token,
        Transaction.ioToken.p2_sys_serv_pymt_pay_tx_exp_addr.token),
    output: util.format('^(?:(?:%s)(?:%s)(?:%s){1,2}(?:%s))?(?:%s)(?:%s)+(?:%s)?$',
        Transaction.ioToken.multisig_start.token,
        Transaction.ioToken.p2_sys_msig_sign_addr.token,
        Transaction.ioToken.p2_unknown_addr.token,
        Transaction.ioToken.multisig_end.token,
        Transaction.ioToken.null_data.token,
        Transaction.ioToken.p2_cln_srv_acc_cred_ln_addr.token,
        Transaction.ioToken.p2_sys_fund_chg_addr.token)
});

SpendServiceCreditTransaction.notifyEvent = Object.freeze({
    tx_unconfirmed_too_long: Object.freeze({
        name: 'tx_unconfirmed_too_long',
        description: 'Last sent transaction has not been confirmed for too long'
    }),
    no_more_payments: Object.freeze({
        name: 'no_more_payments',
        description: 'No more payments are accepted for this spend service credit transaction'
    })
});

// Definition of module (private) functions
//

function checkSystemFunding() {
    // Check if system service payment pay tx expense addresses need to be refunded
    Catenis.ctnHubNode.checkServicePaymentPayTxExpenseFundingBalance();
}

function getServiceTxsWithNoBilling() {
    return Catenis.db.collection.Billing.find({
        servicePaymentTx: {
            $exists: false
        }
    }, {
        fields: {
            'serviceTx.txid': 1
        }
    }).map((doc) => doc.serviceTx.txid);
}

// Module code
//

// Lock function class
Object.freeze(SpendServiceCreditTransaction);
