/**
 * Created by Claudio on 2016-06-30.
 */

//console.log('[Service.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import config from 'config';
// noinspection JSFileReferences
import BigNumber from 'bignumber.js';
// Meteor packages
//import { Meteor } from 'meteor/meteor';
// noinspection NpmUsedModulesInstalled
import { _ } from 'meteor/underscore';


// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { RbfTransactionInfo } from './RbfTransactionInfo';
import { Client } from './Client';
import { Device } from './Device';
import { Util } from './Util';
import { BcotToken } from './BcotToken';
import { TransactionSize } from './TransactionSize';
import { Transaction } from './Transaction';

// Config entries
const serviceConfig = config.get('service');

// Configuration settings
const cfgSettings = {
    priceMarkup: serviceConfig.get('priceMarkup'),
    servicePriceResolution: serviceConfig.get('servicePriceResolution'),
    paymentResolution: serviceConfig.get('paymentResolution'),
    maxNumAddrsPerFundingTx: serviceConfig.get('maxNumAddrsPerFundingTx'),
    systemFunding: {
        clientsToFund: serviceConfig.get('systemFunding.clientsToFund'),
        devicesPerClientToFund: serviceConfig.get('systemFunding.devicesPerClientToFund'),
        multiplyFactor: serviceConfig.get('systemFunding.multiplyFactor')
    },
    serviceCreditIssueAddrFunding: {
        maxUnitsPerUtxo: serviceConfig.get('serviceCreditIssueAddrFunding.maxUnitsPerUtxo'),
        minUtxosToFund: serviceConfig.get('serviceCreditIssueAddrFunding.minUtxosToFund'),
        unitsPerPrePaidClients: serviceConfig.get('serviceCreditIssueAddrFunding.unitsPerPrePaidClients'),
        unitsPerPostPaidClients: serviceConfig.get('serviceCreditIssueAddrFunding.unitsPerPostPaidClients'),
        prePaidClientsToFund: serviceConfig.get('serviceCreditIssueAddrFunding.prePaidClientsToFund'),
        postPaidClientsToFund: serviceConfig.get('serviceCreditIssueAddrFunding.postPaidClientsToFund')
    },
    bcotSaleStockAddrFunding: {
        maxUnitsPerUtxo: serviceConfig.get('bcotSaleStockAddrFunding.maxUnitsPerUtxo'),
        minUtxosToFund: serviceConfig.get('bcotSaleStockAddrFunding.minUtxosToFund'),
        unitsPerPrePaidClients: serviceConfig.get('bcotSaleStockAddrFunding.unitsPerPrePaidClients'),
        unitsPerPostPaidClients: serviceConfig.get('bcotSaleStockAddrFunding.unitsPerPostPaidClients'),
        prePaidClientsToFund: serviceConfig.get('bcotSaleStockAddrFunding.prePaidClientsToFund'),
        postPaidClientsToFund: serviceConfig.get('bcotSaleStockAddrFunding.postPaidClientsToFund')
    },
    serviceAccountFunding: {
        unitAmountSafetyFactor: serviceConfig.get('serviceAccountFunding.unitAmountSafetyFactor'),
        maxUnitsPerAddr: serviceConfig.get('serviceAccountFunding.maxUnitsPerAddr'),
        minAddrsToFund: serviceConfig.get('serviceAccountFunding.minAddrsToFund')
    },
    payTxExpenseFunding: {
        unitAmountSafetyFactor: serviceConfig.get('payTxExpenseFunding.unitAmountSafetyFactor'),
        maxUnitsPerAddr: serviceConfig.get('payTxExpenseFunding.maxUnitsPerAddr'),
        minAddrsToFund: serviceConfig.get('payTxExpenseFunding.minAddrsToFund'),
        balanceSafetyFactor: serviceConfig.get('payTxExpenseFunding.balanceSafetyFactor'),
        minBalanceSysMessages: serviceConfig.get('payTxExpenseFunding.minBalanceSysMessages'),
        minBalanceServicesPerDevice: serviceConfig.get('payTxExpenseFunding.minBalanceServicesPerDevice'),
        sysMessagesToFund: serviceConfig.get('payTxExpenseFunding.sysMessagesToFund'),
        devicesToFund: serviceConfig.get('payTxExpenseFunding.devicesToFund')
    },
    readConfirmPayTxExpenseFunding: {
        unitAmountSafetyFactor: serviceConfig.get('readConfirmPayTxExpenseFunding.unitAmountSafetyFactor'),
        maxUnitsPerAddr: serviceConfig.get('readConfirmPayTxExpenseFunding.maxUnitsPerAddr'),
        minAddrsToFund: serviceConfig.get('readConfirmPayTxExpenseFunding.minAddrsToFund'),
        balanceSafetyFactor: serviceConfig.get('readConfirmPayTxExpenseFunding.balanceSafetyFactor'),
        minBalanceMessagesToConfirm: serviceConfig.get('readConfirmPayTxExpenseFunding.minBalanceMessagesToConfirm'),
        messagesToConfirmToFund: serviceConfig.get('readConfirmPayTxExpenseFunding.messagesToConfirmToFund')
    },
    servicePaymentPayTxExpenseFunding: {
        unitAmountSafetyFactor: serviceConfig.get('servicePaymentPayTxExpenseFunding.unitAmountSafetyFactor'),
        maxUnitsPerAddr: serviceConfig.get('servicePaymentPayTxExpenseFunding.maxUnitsPerAddr'),
        minAddrsToFund: serviceConfig.get('servicePaymentPayTxExpenseFunding.minAddrsToFund'),
        balanceSafetyFactor: serviceConfig.get('servicePaymentPayTxExpenseFunding.balanceSafetyFactor'),
        minBalancePrePaidServices: serviceConfig.get('servicePaymentPayTxExpenseFunding.minBalancePrePaidServices'),
        minBalancePostPaidServices: serviceConfig.get('servicePaymentPayTxExpenseFunding.minBalancePostPaidServices'),
        servicesToPayToFund: serviceConfig.get('servicePaymentPayTxExpenseFunding.servicesToPayToFund')
    },
    ocMsgsSettlementPayTxExpenseFunding: {
        unitAmountSafetyFactor: serviceConfig.get('ocMsgsSettlementPayTxExpenseFunding.unitAmountSafetyFactor'),
        maxUnitsPerAddr: serviceConfig.get('ocMsgsSettlementPayTxExpenseFunding.maxUnitsPerAddr'),
        minAddrsToFund: serviceConfig.get('ocMsgsSettlementPayTxExpenseFunding.minAddrsToFund'),
        balanceSafetyFactor: serviceConfig.get('ocMsgsSettlementPayTxExpenseFunding.balanceSafetyFactor'),
        minBalanceSettlementCycles: serviceConfig.get('ocMsgsSettlementPayTxExpenseFunding.minBalanceSettlementCycles'),
        settlementCyclesToFund: serviceConfig.get('ocMsgsSettlementPayTxExpenseFunding.settlementCyclesToFund')
    },
    servicePayment: {
        paymentResolution: serviceConfig.get('servicePayment.paymentResolution'),
        spendServiceCredit: {
            initNumTxWitnessInputs: serviceConfig.get('servicePayment.spendServiceCredit.initNumTxWitnessInputs'),
            initNumTxNonWitnessInputs: serviceConfig.get('servicePayment.spendServiceCredit.initNumTxNonWitnessInputs'),
            initNumTxWitnessOutputs: serviceConfig.get('servicePayment.spendServiceCredit.initNumTxWitnessOutputs'),
            initNumTxNonWitnessOutputs: serviceConfig.get('servicePayment.spendServiceCredit.initNumTxNonWitnessOutputs'),
            initNumPubKeysMultiSigTxOutputs: serviceConfig.get('servicePayment.spendServiceCredit.initNumPubKeysMultiSigTxOutputs'),
            txNullDataPayloadSize: serviceConfig.get('servicePayment.spendServiceCredit.txNullDataPayloadSize'),
            maxNumClients: serviceConfig.get('servicePayment.spendServiceCredit.maxNumClients'),
            servsDistribPerClient: serviceConfig.get('servicePayment.spendServiceCredit.servsDistribPerClient'),
            maxServsPerClientInput: serviceConfig.get('servicePayment.spendServiceCredit.maxServsPerClientInput'),
            numClientsMultiSigOutput: serviceConfig.get('servicePayment.spendServiceCredit.numClientsMultiSigOutput'),
            percMaxUnitsPayTxExp: serviceConfig.get('servicePayment.spendServiceCredit.percMaxUnitsPayTxExp'),
            initTxFeeRate: serviceConfig.get('servicePayment.spendServiceCredit.initTxFeeRate'),
            txFeeRateIncrement: serviceConfig.get('servicePayment.spendServiceCredit.txFeeRateIncrement')
        },
        debitServiceAccount: {
            initNumTxWitnessInputs: serviceConfig.get('servicePayment.debitServiceAccount.initNumTxWitnessInputs'),
            initNumTxNonWitnessInputs: serviceConfig.get('servicePayment.debitServiceAccount.initNumTxNonWitnessInputs'),
            initNumTxWitnessOutputs: serviceConfig.get('servicePayment.debitServiceAccount.initNumTxWitnessOutputs'),
            initNumTxNonWitnessOutputs: serviceConfig.get('servicePayment.debitServiceAccount.initNumTxNonWitnessOutputs'),
            initNumPubKeysMultiSigTxOutputs: serviceConfig.get('servicePayment.debitServiceAccount.initNumPubKeysMultiSigTxOutputs'),
            txNullDataPayloadSize: serviceConfig.get('servicePayment.debitServiceAccount.txNullDataPayloadSize'),
            maxNumClients: serviceConfig.get('servicePayment.debitServiceAccount.maxNumClients'),
            servsDistribPerClient: serviceConfig.get('servicePayment.debitServiceAccount.servsDistribPerClient'),
            numClientsMultiSigOutput: serviceConfig.get('servicePayment.debitServiceAccount.numClientsMultiSigOutput'),
            percMaxUnitsPayTxExp: serviceConfig.get('servicePayment.debitServiceAccount.percMaxUnitsPayTxExp'),
            initTxFeeRate: serviceConfig.get('servicePayment.debitServiceAccount.initTxFeeRate'),
            txFeeRateIncrement: serviceConfig.get('servicePayment.debitServiceAccount.txFeeRateIncrement')
        }
    },
    sysMessage: {
        messagesPerMinute: serviceConfig.get('sysMessage.messagesPerMinute'),
        minutesToConfirm: serviceConfig.get('sysMessage.minutesToConfirm'),
        unconfMainAddrReuses: serviceConfig.get('sysMessage.unconfMainAddrReuses'),
        mainAddrFunding: {
            maxUnitsPerAddr: serviceConfig.get('sysMessage.mainAddrFunding.maxUnitsPerAddr'),
            minAddrsToFund: serviceConfig.get('sysMessage.mainAddrFunding.minAddrsToFund')
        },
        offChainMessagesSettlement: {
            minutesToConfirm: serviceConfig.get('sysMessage.offChainMessagesSettlement.minutesToConfirm')
        }
    },
    sysTxConfig: {
        sendSysMessage: {
            numWitnessInputs: serviceConfig.get('sysTxConfig.sendSysMessage.numWitnessInputs'),
            numNonWitnessInputs: serviceConfig.get('sysTxConfig.sendSysMessage.numNonWitnessInputs'),
            numWitnessOutputs: serviceConfig.get('sysTxConfig.sendSysMessage.numWitnessOutputs'),
            numNonWitnessOutputs: serviceConfig.get('sysTxConfig.sendSysMessage.numNonWitnessOutputs'),
            nullDataPayloadSize: serviceConfig.get('sysTxConfig.sendSysMessage.nullDataPayloadSize')
        },
        settleOffChainMessages: {
            numWitnessInputs: serviceConfig.get('sysTxConfig.settleOffChainMessages.numWitnessInputs'),
            numNonWitnessInputs: serviceConfig.get('sysTxConfig.settleOffChainMessages.numNonWitnessInputs'),
            numWitnessOutputs: serviceConfig.get('sysTxConfig.settleOffChainMessages.numWitnessOutputs'),
            numNonWitnessOutputs: serviceConfig.get('sysTxConfig.settleOffChainMessages.numNonWitnessOutputs'),
            nullDataPayloadSize: serviceConfig.get('sysTxConfig.settleOffChainMessages.nullDataPayloadSize')
        }
    },
    message: {
        messagesPerMinute: serviceConfig.get('message.messagesPerMinute'),
        minutesToConfirm: serviceConfig.get('message.minutesToConfirm'),
        unconfMainAddrReuses: serviceConfig.get('message.unconfMainAddrReuses'),
        mainAddrFunding: {
            maxUnitsPerAddr: serviceConfig.get('message.mainAddrFunding.maxUnitsPerAddr'),
            minAddrsToFund: serviceConfig.get('message.mainAddrFunding.minAddrsToFund')
        },
        readConfirmation: {
            paymentResolution: serviceConfig.get('message.readConfirmation.paymentResolution'),
            initNumTxWitnessInputs: serviceConfig.get('message.readConfirmation.initNumTxWitnessInputs'),
            initNumTxNonWitnessInputs: serviceConfig.get('message.readConfirmation.initNumTxNonWitnessInputs'),
            initNumTxWitnessOutputs: serviceConfig.get('message.readConfirmation.initNumTxWitnessOutputs'),
            initNumTxNonWitnessOutputs: serviceConfig.get('message.readConfirmation.initNumTxNonWitnessOutputs'),
            txNullDataPayloadSize: serviceConfig.get('message.readConfirmation.txNullDataPayloadSize'),
            txInputOutputGrowthRatio: serviceConfig.get('message.readConfirmation.txInputOutputGrowthRatio'),
            percMaxUnitsPayTxExp: serviceConfig.get('message.readConfirmation.percMaxUnitsPayTxExp'),
            initTxFeeRate: serviceConfig.get('message.readConfirmation.initTxFeeRate'),
            txFeeRateIncrement: serviceConfig.get('message.readConfirmation.txFeeRateIncrement'),
            terminalReadConfirmTx: {
                minutesToConfirm: serviceConfig.get('message.readConfirmation.terminalReadConfirmTx.minutesToConfirm'),
                typicalTxConfig: {
                    numMessagesConfirmed: serviceConfig.get('message.readConfirmation.terminalReadConfirmTx.typicalTxConfig.numMessagesConfirmed'),
                    numPayTxExpenseInputs: serviceConfig.get('message.readConfirmation.terminalReadConfirmTx.typicalTxConfig.numPayTxExpenseInputs'),
                    hasChangeOutput: serviceConfig.get('message.readConfirmation.terminalReadConfirmTx.typicalTxConfig.hasChangeOutput'),
                    nullDataPayloadSize: serviceConfig.get('message.readConfirmation.terminalReadConfirmTx.typicalTxConfig.nullDataPayloadSize')
                }
            },
            usageWeight: {
                regular: serviceConfig.get('message.readConfirmation.usageWeight.regular'),
                terminal: serviceConfig.get('message.readConfirmation.usageWeight.terminal')
            }
        },
        offChain: {
            price: {
                numMsgsPayCost: serviceConfig.get('message.offChain.price.numMsgsPayCost'),
                msgReceipt: {
                    percCost: serviceConfig.get('message.offChain.price.msgReceipt.percCost')
                }
            }
        }
    },
    asset: {
        issuance: {
            assetsPerMinute: serviceConfig.get('asset.issuance.assetsPerMinute'),
            minutesToConfirm: serviceConfig.get('asset.issuance.minutesToConfirm'),
            unconfAssetIssueAddrReuses: serviceConfig.get('asset.issuance.unconfAssetIssueAddrReuses'),
            assetIssueAddrFunding: {
                maxUnitsPerAddr: serviceConfig.get('asset.issuance.assetIssueAddrFunding.maxUnitsPerAddr'),
                minAddrsToFund: serviceConfig.get('asset.issuance.assetIssueAddrFunding.minAddrsToFund')
            }
        },
        transfer: {
            minutesToConfirm: serviceConfig.get('asset.transfer.minutesToConfirm'),
        },
        outMigrate: {
            minutesToConfirm: serviceConfig.get('asset.outMigrate.minutesToConfirm'),
        },
        inMigrate: {
            minutesToConfirm: serviceConfig.get('asset.inMigrate.minutesToConfirm'),
        }
    },
    serviceTxConfig: {
        logMessage: {
            numWitnessInputs: serviceConfig.get('serviceTxConfig.logMessage.numWitnessInputs'),
            numNonWitnessInputs: serviceConfig.get('serviceTxConfig.logMessage.numNonWitnessInputs'),
            numWitnessOutputs: serviceConfig.get('serviceTxConfig.logMessage.numWitnessOutputs'),
            numNonWitnessOutputs: serviceConfig.get('serviceTxConfig.logMessage.numNonWitnessOutputs'),
            nullDataPayloadSize: serviceConfig.get('serviceTxConfig.logMessage.nullDataPayloadSize')
        },
        sendMessage: {
            numWitnessInputs: serviceConfig.get('serviceTxConfig.sendMessage.numWitnessInputs'),
            numNonWitnessInputs: serviceConfig.get('serviceTxConfig.sendMessage.numNonWitnessInputs'),
            numWitnessOutputs: serviceConfig.get('serviceTxConfig.sendMessage.numWitnessOutputs'),
            numNonWitnessOutputs: serviceConfig.get('serviceTxConfig.sendMessage.numNonWitnessOutputs'),
            nullDataPayloadSize: serviceConfig.get('serviceTxConfig.sendMessage.nullDataPayloadSize')
        },
        sendMsgReadConfirm: {
            numWitnessInputs: serviceConfig.get('serviceTxConfig.sendMsgReadConfirm.numWitnessInputs'),
            numNonWitnessInputs: serviceConfig.get('serviceTxConfig.sendMsgReadConfirm.numNonWitnessInputs'),
            numWitnessOutputs: serviceConfig.get('serviceTxConfig.sendMsgReadConfirm.numWitnessOutputs'),
            numNonWitnessOutputs: serviceConfig.get('serviceTxConfig.sendMsgReadConfirm.numNonWitnessOutputs'),
            nullDataPayloadSize: serviceConfig.get('serviceTxConfig.sendMsgReadConfirm.nullDataPayloadSize')
        },
        issueAsset: {
            numWitnessInputs: serviceConfig.get('serviceTxConfig.issueAsset.numWitnessInputs'),
            numNonWitnessInputs: serviceConfig.get('serviceTxConfig.issueAsset.numNonWitnessInputs'),
            numWitnessOutputs: serviceConfig.get('serviceTxConfig.issueAsset.numWitnessOutputs'),
            numNonWitnessOutputs: serviceConfig.get('serviceTxConfig.issueAsset.numNonWitnessOutputs'),
            nullDataPayloadSize: serviceConfig.get('serviceTxConfig.issueAsset.nullDataPayloadSize')
        },
        transferAsset: {
            numWitnessInputs: serviceConfig.get('serviceTxConfig.transferAsset.numWitnessInputs'),
            numNonWitnessInputs: serviceConfig.get('serviceTxConfig.transferAsset.numNonWitnessInputs'),
            numWitnessOutputs: serviceConfig.get('serviceTxConfig.transferAsset.numWitnessOutputs'),
            numNonWitnessOutputs: serviceConfig.get('serviceTxConfig.transferAsset.numNonWitnessOutputs'),
            nullDataPayloadSize: serviceConfig.get('serviceTxConfig.transferAsset.nullDataPayloadSize')
        },
        outMigrateAsset: {
            numWitnessInputs: serviceConfig.get('serviceTxConfig.outMigrateAsset.numWitnessInputs'),
            numNonWitnessInputs: serviceConfig.get('serviceTxConfig.outMigrateAsset.numNonWitnessInputs'),
            numWitnessOutputs: serviceConfig.get('serviceTxConfig.outMigrateAsset.numWitnessOutputs'),
            numNonWitnessOutputs: serviceConfig.get('serviceTxConfig.outMigrateAsset.numNonWitnessOutputs'),
            nullDataPayloadSize: serviceConfig.get('serviceTxConfig.outMigrateAsset.nullDataPayloadSize')
        },
        inMigrateAsset: {
            numWitnessInputs: serviceConfig.get('serviceTxConfig.inMigrateAsset.numWitnessInputs'),
            numNonWitnessInputs: serviceConfig.get('serviceTxConfig.inMigrateAsset.numNonWitnessInputs'),
            numWitnessOutputs: serviceConfig.get('serviceTxConfig.inMigrateAsset.numWitnessOutputs'),
            numNonWitnessOutputs: serviceConfig.get('serviceTxConfig.inMigrateAsset.numNonWitnessOutputs'),
            nullDataPayloadSize: serviceConfig.get('serviceTxConfig.inMigrateAsset.nullDataPayloadSize')
        }
    },
    serviceUsageWeight: {
        logMessage: serviceConfig.get('serviceUsageWeight.logMessage'),
        sendMessage: serviceConfig.get('serviceUsageWeight.sendMessage'),
        sendMsgReadConfirm: serviceConfig.get('serviceUsageWeight.sendMsgReadConfirm'),
        logOffChainMessage: serviceConfig.get('serviceUsageWeight.logOffChainMessage'),
        sendOffChainMessage: serviceConfig.get('serviceUsageWeight.sendOffChainMessage'),
        sendOffChainMsgReadConfirm: serviceConfig.get('serviceUsageWeight.sendOffChainMsgReadConfirm'),
        issueAsset: serviceConfig.get('serviceUsageWeight.issueAsset'),
        transferAsset: serviceConfig.get('serviceUsageWeight.transferAsset'),
        outMigrateAsset: serviceConfig.get('serviceUsageWeight.outMigrateAsset'),
        inMigrateAsset: serviceConfig.get('serviceUsageWeight.inMigrateAsset')
    }
};


// Definition of function classes
//

// Service function class
export function Service() {
}


// Service function class (public) methods
//

Service.testFunctions = function () {
    return {
        systemFundingCost: systemFundingCost(),
        numActiveSystemDeviceMainAddresses: numActiveSystemDeviceMainAddresses(),
        estimatedSendSystemMessageTxCost: estimatedSendSystemMessageTxCost(),
        estimatedSettleOffChainMessagesTxCost: estimatedSettleOffChainMessagesTxCost(),
        typicalSendSystemMessageTxVsize: typicalSendSystemMessageTxVsize(),
        typicalSettleOffChainMessagesTxVsize: typicalSettleOffChainMessagesTxVsize(),
        deviceProvisionCost: deviceProvisionCost(),
        deviceMessageProvisionCost: deviceMessageProvisionCost(),
        deviceAssetProvisionCost: Service.deviceAssetProvisionCost(),
        numActiveDeviceMainAddresses: numActiveDeviceMainAddresses(),
        numActiveDeviceAssetIssuanceAddresses: numActiveDeviceAssetIssuanceAddresses(),
        highestEstimatedServiceTxCost: highestEstimatedServiceTxCost(),
        averageEstimatedServiceTxCost: averageEstimatedServiceTxCost(),
        estimatedLogMessageTxCost: estimatedLogMessageTxCost(),
        typicalLogMessageTxVsize: typicalLogMessageTxVsize(),
        estimatedSendMessageTxCost: estimatedSendMessageTxCost(),
        typicalSendMessageTxVsize: typicalSendMessageTxVsize(),
        estimatedSendMessageReadConfirmTxCost: estimatedSendMessageReadConfirmTxCost(),
        typicalSendMessageReadConfirmTxVsize: typicalSendMessageReadConfirmTxVsize(),
        estimatedOffChainMsgEnvelopeCost: estimatedOffChainMsgEnvelopeCost(),
        estimatedOffChaiMsgReceiptCost: estimatedOffChaiMsgReceiptCost(),
        estimatedLogOffChainMessageCost: estimatedLogOffChainMessageCost(),
        estimatedSendOffChainMessageCost: estimatedSendOffChainMessageCost(),
        estimatedSendOffChainMessageReadConfirmCost: estimatedSendOffChainMessageReadConfirmCost(),
        estimatedIssueAssetTxCost: estimatedIssueAssetTxCost(),
        typicalIssueAssetTxVsize: typicalIssueAssetTxVsize(),
        estimatedTransferAssetTxCost: estimatedTransferAssetTxCost(),
        typicalTransferAssetTxVsize: typicalTransferAssetTxVsize(),
        estimatedOutMigrateAssetTxCost: estimatedOutMigrateAssetTxCost(),
        typicalOutMigrateAssetTxVsize: typicalOutMigrateAssetTxVsize(),
        estimatedInMigrateAssetTxCost: estimatedInMigrateAssetTxCost(),
        typicalInMigrateAssetTxVsize: typicalInMigrateAssetTxVsize(),
        estimatedMigrateAssetAverageTxCost: estimatedMigrateAssetAverageTxCost(),
        highestEstimatedReadConfirmTxCostPerMessage: highestEstimatedReadConfirmTxCostPerMessage(),
        averageEstimatedReadConfirmTxCostPerMessage: averageEstimatedReadConfirmTxCostPerMessage(),
        estimatedTerminalReadConfirmTxCostPerMessage: estimatedTerminalReadConfirmTxCostPerMessage(),
        typicalTerminalReadConfirmTxVsize: typicalTerminalReadConfirmTxVsize(),
        numInputsTerminalReadConfirmTx: numInputsTerminalReadConfirmTx(),
        numOutputsTerminalReadConfirmTx: numOutputsTerminalReadConfirmTx(),
        averageReadConfirmTxCostPerMessage: averageReadConfirmTxCostPerMessage(),
        averageServicePrice: averageServicePrice(),
        highestEstimatedServicePaymentTxCostPerService: highestEstimatedServicePaymentTxCostPerService(),
        averageEstimatedServicePaymentTxCostPerService: averageEstimatedServicePaymentTxCostPerService(),
        highestServicePrice: highestServicePrice(),
        averageSpendServCredTxCostPerService: averageSpendServCredTxCostPerService(),
        averageDebitServAccountTxCostPerService: averageDebitServAccountTxCostPerService(),
        numPrePaidServices: numPrePaidServices()
    };
};

Service.getExpectedServiceCreditIssuanceBalance = function () {
    return (Math.ceil(Client.activePrePaidClientsCount() * cfgSettings.serviceCreditIssueAddrFunding.unitsPerPrePaidClients)
            + Math.ceil(Client.activePostPaidClientsCount() * cfgSettings.serviceCreditIssueAddrFunding.unitsPerPostPaidClients))
            * Service.serviceCreditIssuanceAddrAmount;
};

Service.getExpectedBcotSaleStockBalance = function () {
    return (Math.ceil(Client.activePrePaidClientsCount() * cfgSettings.bcotSaleStockAddrFunding.unitsPerPrePaidClients)
        + Math.ceil(Client.activePostPaidClientsCount() * cfgSettings.bcotSaleStockAddrFunding.unitsPerPostPaidClients))
        * Service.bcotSaleStockAddrAmount;
};

Service.getMinimumPayTxExpenseBalance = function () {
    return estimatedSendSystemMessageTxCost() * cfgSettings.payTxExpenseFunding.minBalanceSysMessages + averageEstimatedServiceTxCost() * cfgSettings.payTxExpenseFunding.minBalanceServicesPerDevice * Device.activeDevicesCount();
};

Service.getExpectedReadConfirmPayTxExpenseBalance = function (unreadMessages) {
    return _.max([unreadMessages, cfgSettings.readConfirmPayTxExpenseFunding.minBalanceMessagesToConfirm]) * averageEstimatedReadConfirmTxCostPerMessage();
};

Service.getExpectedServicePaymentPayTxExpenseBalance = function () {
    return _.max([numPrePaidServices(), cfgSettings.servicePaymentPayTxExpenseFunding.minBalancePrePaidServices]) * averageSpendServCredTxCostPerService() + cfgSettings.servicePaymentPayTxExpenseFunding.minBalancePostPaidServices * averageDebitServAccountTxCostPerService();
};

Service.getMinimumOCMsgsSetlmtPayTxExpenseBalance = function () {
    return estimatedSettleOffChainMessagesTxCost() * cfgSettings.ocMsgsSettlementPayTxExpenseFunding.minBalanceSettlementCycles;
};

Service.distributeServiceCreditIssuanceFund = function (amount) {
    let totalAmount = Util.roundToResolution(amount, Service.serviceCreditIssuanceAddrAmount);

    // Make sure that amount to fund is not below minimum
    const minFundAmount = Service.minServiceCreditIssuanceFundAmount;

    if (totalAmount < minFundAmount) {
        totalAmount = minFundAmount;
    }

    return {
        totalAmount: totalAmount,
        amountPerAddress: distributePayment(totalAmount, Service.serviceCreditIssuanceAddrAmount, cfgSettings.serviceCreditIssueAddrFunding.minUtxosToFund, cfgSettings.serviceCreditIssueAddrFunding.maxUnitsPerUtxo)
    };
};

Service.distributeBcotSaleStockFund = function (amount) {
    let totalAmount = Util.roundToResolution(amount, Service.bcotSaleStockAddrAmount);

    // Make sure that amount to fund is not below minimum
    const minFundAmount = Service.minBcotSaleStockFundAmount;

    if (totalAmount < minFundAmount) {
        totalAmount = minFundAmount;
    }

    return {
        totalAmount: totalAmount,
        amountPerAddress: distributePayment(totalAmount, Service.bcotSaleStockAddrAmount, cfgSettings.bcotSaleStockAddrFunding.minUtxosToFund, cfgSettings.bcotSaleStockAddrFunding.maxUnitsPerUtxo)
    };
};

// NOTE 1: the amount argument should have a value expressed in Catenis service credit's lowest units (10^-7)
// NOTE 2: if the given amount is not a multiple of the service price resolution, the amount is rounded down
//        and the remainder is NOT accounted for
Service.distributeServiceAccountFund = function (amount, maxAddresses) {
    const fundUnitAmount = Service.serviceAccountUnitAmount;
    let totalAmount = Util.roundDownToResolution(amount, cfgSettings.servicePriceResolution);

    const distribResult = distributePayment(totalAmount, fundUnitAmount, cfgSettings.serviceAccountFunding.minAddrsToFund, cfgSettings.serviceAccountFunding.maxUnitsPerAddr, maxAddresses);

    if (maxAddresses !== undefined) {
        return {
            totalAmount: distribResult.totalAmount,
            amountPerAddress: distribResult.payments
        }
    }
    else {
        return {
            totalAmount: totalAmount,
            amountPerAddress: distribResult
        };
    }
};

Service.distributePayTxExpenseFund = function (amount) {
    const fundUnitAmount = Service.payTxExpFundUnitAmount;
    let totalAmount = Util.roundToResolution(amount, fundUnitAmount);

    // Make sure that amount to fund is not below minimum
    const minFundAmount = Service.minPayTxExpenseFundAmount;

    if (totalAmount < minFundAmount) {
        totalAmount = minFundAmount;
    }

    // Make sure that required number of addresses to receive total amount to be
    //  paid does not exceed practical limit (so they can fit in a single funding transaction).
    //  If it does, readjust total amount
    const distribResult = distributePayment(totalAmount, fundUnitAmount, cfgSettings.payTxExpenseFunding.minAddrsToFund, cfgSettings.payTxExpenseFunding.maxUnitsPerAddr, cfgSettings.maxNumAddrsPerFundingTx);

    return {
        totalAmount: distribResult.totalAmount,
        amountPerAddress: distribResult.payments
    };
};

Service.distributeReadConfirmPayTxExpenseFund = function (amount) {
    const fundUnitAmount = Service.readConfirmPayTxExpFundUnitAmount;
    let totalAmount = Util.roundToResolution(amount, fundUnitAmount);

    // Make sure that amount to fund is not below minimum
    const minFundAmount = Service.minReadConfirmPayTxExpenseFundAmount;

    if (totalAmount < minFundAmount) {
        totalAmount = minFundAmount;
    }

    // Make sure that required number of addresses to receive total amount to be
    //  paid does not exceed practical limit (so they can fit in a single funding transaction).
    //  If it does, readjust total amount
    const distribResult = distributePayment(totalAmount, fundUnitAmount, cfgSettings.readConfirmPayTxExpenseFunding.minAddrsToFund, cfgSettings.readConfirmPayTxExpenseFunding.maxUnitsPerAddr, cfgSettings.maxNumAddrsPerFundingTx);

    return {
        totalAmount: distribResult.totalAmount,
        amountPerAddress: distribResult.payments
    };
};

Service.distributeServicePaymentPayTxExpenseFund = function (amount) {
    const fundUnitAmount = Service.servicePaymentPayTxExpFundUnitAmount;
    let totalAmount = Util.roundToResolution(amount, fundUnitAmount);

    // Make sure that amount to fund is not below minimum
    const minFundAmount = Service.minServicePaymentPayTxExpenseFundAmount;

    if (totalAmount < minFundAmount) {
        totalAmount = minFundAmount;
    }

    // Make sure that required number of addresses to receive total amount to be
    //  paid does not exceed practical limit (so they can fit in a single funding transaction).
    //  If it does, readjust total amount
    const distribResult = distributePayment(totalAmount, fundUnitAmount, cfgSettings.servicePaymentPayTxExpenseFunding.minAddrsToFund, cfgSettings.servicePaymentPayTxExpenseFunding.maxUnitsPerAddr, cfgSettings.maxNumAddrsPerFundingTx);

    return {
        totalAmount: distribResult.totalAmount,
        amountPerAddress: distribResult.payments
    };
};

Service.distributeOCMsgsSetlmtPayTxExpenseFund = function (amount) {
    const fundUnitAmount = Service.ocMsgsSetlmtPayTxExpFundUnitAmount;
    let totalAmount = Util.roundToResolution(amount, fundUnitAmount);

    // Make sure that amount to fund is not below minimum
    const minFundAmount = Service.minOCMsgsSetlmtPayTxExpenseFundAmount;

    if (totalAmount < minFundAmount) {
        totalAmount = minFundAmount;
    }

    // Make sure that required number of addresses to receive total amount to be
    //  paid does not exceed practical limit (so they can fit in a single funding transaction).
    //  If it does, readjust total amount
    const distribResult = distributePayment(totalAmount, fundUnitAmount, cfgSettings.ocMsgsSettlementPayTxExpenseFunding.minAddrsToFund, cfgSettings.ocMsgsSettlementPayTxExpenseFunding.maxUnitsPerAddr, cfgSettings.maxNumAddrsPerFundingTx);

    return {
        totalAmount: distribResult.totalAmount,
        amountPerAddress: distribResult.payments
    };
};

Service.distributeSystemDeviceMainAddressFund = function () {
    let totalAmount = numActiveSystemDeviceMainAddresses() * Service.sysDevMainAddrAmount;

    return {
        totalAmount: totalAmount,
        amountPerAddress: distributePayment(totalAmount, Service.sysDevMainAddrAmount, cfgSettings.sysMessage.mainAddrFunding.minAddrsToFund, cfgSettings.sysMessage.mainAddrFunding.maxUnitsPerAddr)
    }
};

// This method should be used to fix the funding amount allocated to system main addresses due to the change
//  of the 'messagesPerMinute' and/or 'minutesToConfirm' system configuration settings (and thus the total funding
//  amount that should be allocated)
Service.distributeSystemMainAddressDeltaFund  = function (deltaAmount) {
    return distributePayment(deltaAmount, Service.sysDevMainAddrAmount, cfgSettings.sysMessage.mainAddrFunding.minAddrsToFund, cfgSettings.sysMessage.mainAddrFunding.maxUnitsPerAddr)
};

Service.distributeDeviceMainAddressFund  = function () {
    let totalAmount = numActiveDeviceMainAddresses() * Service.devMainAddrAmount;

    return {
        totalAmount: totalAmount,
        amountPerAddress: distributePayment(totalAmount, Service.devMainAddrAmount, cfgSettings.message.mainAddrFunding.minAddrsToFund, cfgSettings.message.mainAddrFunding.maxUnitsPerAddr)
    };
};

// This method should be used to fix the funding amount allocated to a device's main addresses due to the change
//  of the 'messagesPerMinute' and/or 'minutesToConfirm' system configuration settings (and thus the total funding
//  amount that should be allocated)
Service.distributeDeviceMainAddressDeltaFund  = function (deltaAmount) {
    return distributePayment(deltaAmount, Service.devMainAddrAmount, cfgSettings.message.mainAddrFunding.minAddrsToFund, cfgSettings.message.mainAddrFunding.maxUnitsPerAddr)
};

Service.distributeDeviceAssetIssuanceAddressFund = function () {
    const addrAmount = Service.devAssetIssuanceAddrAmount();
    let totalAmount = numActiveDeviceAssetIssuanceAddresses() * addrAmount;

    return {
        totalAmount: totalAmount,
        amountPerAddress: distributePayment(totalAmount, addrAmount, cfgSettings.asset.issuance.assetIssueAddrFunding.minAddrsToFund, cfgSettings.asset.issuance.assetIssueAddrFunding.maxUnitsPerAddr)
    };
};
// This method should be used to fix the funding amount allocated to a device's main addresses due to the change
//  of the 'messagesPerMinute' and/or 'minutesToConfirm' system configuration settings (and thus the total funding
//  amount that should be allocated)
Service.distributeDeviceAssetIssuanceAddressDeltaFund  = function (deltaAmount) {
    return distributePayment(deltaAmount, Service.devAssetIssuanceAddrAmount(), cfgSettings.asset.issuance.assetIssueAddrFunding.minAddrsToFund, cfgSettings.asset.issuance.assetIssueAddrFunding.maxUnitsPerAddr)
};

// Returns price data for Log Message service
//
//  Return: {
//    estimatedServiceCost: [Number], - Estimated cost, in satoshis, of the service
//    priceMarkup: [Number], - Markup used to calculate the price of the service
//    btcServicePrice: [Number], - Price of the service expressed in (bitcoin) satoshis
//    bitcoinPrice: [Number] - Bitcoin price, in USD, used to calculate exchange rate
//    bcotPrice: [Number] - BCOT token price, in USD, used to calculate exchange rate
//    exchangeRate: [Number], - Bitcoin to BCOT token (1 BTC = x BCOT) exchange rate used to calculate final price
//    finalServicePrice: [Number] - Price charged for the service expressed in Catenis service credit's lowest units
//  }
Service.logMessageServicePrice = function () {
    return getServicePrice(Service.clientPaidService.log_message);
};

// Returns price data for Log Off-Chain Message service
//
//  Return: {
//    estimatedServiceCost: [Number], - Estimated cost, in satoshis, of the service
//    priceMarkup: [Number], - Markup used to calculate the price of the service
//    btcServicePrice: [Number], - Price of the service expressed in (bitcoin) satoshis
//    bitcoinPrice: [Number] - Bitcoin price, in USD, used to calculate exchange rate
//    bcotPrice: [Number] - BCOT token price, in USD, used to calculate exchange rate
//    exchangeRate: [Number], - Bitcoin to BCOT token (1 BTC = x BCOT) exchange rate used to calculate final price
//    finalServicePrice: [Number] - Price charged for the service expressed in Catenis service credit's lowest units
//  }
Service.logOffChainMessageServicePrice = function () {
    return getServicePrice(Service.clientPaidService.log_off_chain_message);
};

// Returns price data for Send Message (with no read confirmation) service
//
//  Return: {
//    estimatedServiceCost: [Number], - Estimated cost, in satoshis, of the service
//    priceMarkup: [Number], - Markup used to calculate the price of the service
//    btcServicePrice: [Number], - Price of the service expressed in (bitcoin) satoshis
//    bitcoinPrice: [Number] - Bitcoin price, in USD, used to calculate exchange rate
//    bcotPrice: [Number] - BCOT token price, in USD, used to calculate exchange rate
//    exchangeRate: [Number], - Bitcoin to BCOT token (1 BTC = x BCOT) exchange rate used to calculate final price
//    finalServicePrice: [Number] - Price charged for the service expressed in Catenis service credit's lowest units
//  }
Service.sendMessageServicePrice = function () {
    return getServicePrice(Service.clientPaidService.send_message);
};

// Returns price data for Send Off-Chain Message (with no read confirmation) service
//
//  Return: {
//    estimatedServiceCost: [Number], - Estimated cost, in satoshis, of the service
//    priceMarkup: [Number], - Markup used to calculate the price of the service
//    btcServicePrice: [Number], - Price of the service expressed in (bitcoin) satoshis
//    bitcoinPrice: [Number] - Bitcoin price, in USD, used to calculate exchange rate
//    bcotPrice: [Number] - BCOT token price, in USD, used to calculate exchange rate
//    exchangeRate: [Number], - Bitcoin to BCOT token (1 BTC = x BCOT) exchange rate used to calculate final price
//    finalServicePrice: [Number] - Price charged for the service expressed in Catenis service credit's lowest units
//  }
Service.sendOffChainMessageServicePrice = function () {
    return getServicePrice(Service.clientPaidService.send_off_chain_message);
};

// Returns price data for Send Message with Read Confirmation service
//
//  Return: {
//    estimatedServiceCost: [Number], - Estimated cost, in satoshis, of the service
//    priceMarkup: [Number], - Markup used to calculate the price of the service
//    btcServicePrice: [Number], - Price of the service expressed in (bitcoin) satoshis
//    bitcoinPrice: [Number] - Bitcoin price, in USD, used to calculate exchange rate
//    bcotPrice: [Number] - BCOT token price, in USD, used to calculate exchange rate
//    exchangeRate: [Number], - Bitcoin to BCOT token exchange rate used to calculate final price
//    finalServicePrice: [Number] - Price charged for the service expressed in Catenis service credit's lowest units
//  }
Service.sendMsgReadConfirmServicePrice = function () {
    return getServicePrice(Service.clientPaidService.send_msg_read_confirm);
};

// Returns price data for Send Off-Chain Message with Read Confirmation service
//
//  Return: {
//    estimatedServiceCost: [Number], - Estimated cost, in satoshis, of the service
//    priceMarkup: [Number], - Markup used to calculate the price of the service
//    btcServicePrice: [Number], - Price of the service expressed in (bitcoin) satoshis
//    bitcoinPrice: [Number] - Bitcoin price, in USD, used to calculate exchange rate
//    bcotPrice: [Number] - BCOT token price, in USD, used to calculate exchange rate
//    exchangeRate: [Number], - Bitcoin to BCOT token exchange rate used to calculate final price
//    finalServicePrice: [Number] - Price charged for the service expressed in Catenis service credit's lowest units
//  }
Service.sendOffChainMsgReadConfirmServicePrice = function () {
    return getServicePrice(Service.clientPaidService.send_off_chain_msg_read_confirm);
};

// Returns price data for Issue Asset service
//
//  Return: {
//    estimatedServiceCost: [Number], - Estimated cost, in satoshis, of the service
//    priceMarkup: [Number], - Markup used to calculate the price of the service
//    btcServicePrice: [Number], - Price of the service expressed in (bitcoin) satoshis
//    bitcoinPrice: [Number] - Bitcoin price, in USD, used to calculate exchange rate
//    bcotPrice: [Number] - BCOT token price, in USD, used to calculate exchange rate
//    exchangeRate: [Number], - Bitcoin to BCOT token (1 BTC = x BCOT) exchange rate used to calculate final price
//    finalServicePrice: [Number] - Price charged for the service expressed in Catenis service credit's lowest units
//  }
Service.issueAssetServicePrice = function () {
    return getServicePrice(Service.clientPaidService.issue_asset);
};

// Returns price data for Transfer Asset service
//
//  Return: {
//    estimatedServiceCost: [Number], - Estimated cost, in satoshis, of the service
//    priceMarkup: [Number], - Markup used to calculate the price of the service
//    btcServicePrice: [Number], - Price of the service expressed in (bitcoin) satoshis
//    bitcoinPrice: [Number] - Bitcoin price, in USD, used to calculate exchange rate
//    bcotPrice: [Number] - BCOT token price, in USD, used to calculate exchange rate
//    exchangeRate: [Number], - Bitcoin to BCOT token (1 BTC = x BCOT) exchange rate used to calculate final price
//    finalServicePrice: [Number] - Price charged for the service expressed in Catenis service credit's lowest units
//  }
Service.transferAssetServicePrice = function () {
    return getServicePrice(Service.clientPaidService.transfer_asset);
};

// Returns price data for Migrate Asset service
//
//  Return: {
//    estimatedServiceCost: [Number], - Estimated cost, in satoshis, of the service
//    priceMarkup: [Number], - Markup used to calculate the price of the service
//    btcServicePrice: [Number], - Price of the service expressed in (bitcoin) satoshis
//    bitcoinPrice: [Number] - Bitcoin price, in USD, used to calculate exchange rate
//    bcotPrice: [Number] - BCOT token price, in USD, used to calculate exchange rate
//    exchangeRate: [Number], - Bitcoin to BCOT token (1 BTC = x BCOT) exchange rate used to calculate final price
//    finalServicePrice: [Number] - Price charged for the service expressed in Catenis service credit's lowest units
//  }
Service.migrateAssetServicePrice = function () {
    return getServicePrice(Service.clientPaidService.migrate_asset);
};

Service.devAssetIssuanceAddrAmount = function (address) {
        return Catenis.application.legacyDustFunding ? Transaction.legacyDustAmount
            : (address ? Transaction.dustAmountByAddress(address) : Transaction.witnessOutputDustAmount);
};

Service.deviceAssetProvisionCost = function (address) {
    return numActiveDeviceAssetIssuanceAddresses() * Service.devAssetIssuanceAddrAmount(address);
};



// Service function class (public) properties
//

Service.avrgReadConfirmTxCostPerMsgCtrl = {
    lastOptimumRate: undefined,
    lastCostPerMsg: undefined
};

Service.avrgSpendServCredTxCostPerServCtrl = {
    lastOptimumRate: undefined,
    lastCostPerServ: undefined
};

Service.avrgDebitServAccTxCostPerServCtrl = {
    lastOptimumRate: undefined,
    lastCostPerServ: undefined
};

Service.clientPaidService = Object.freeze({
    log_off_chain_message: Object.freeze({
        name: 'log_off_chain_message',
        label: 'Log Off-Chain Message',
        abbreviation: 'LOM',
        description: 'Record a message off-chain and later settle it to the blockchain',
        costFunction: estimatedLogOffChainMessageCost
    }),
    log_message: Object.freeze({
        name: 'log_message',
        label: 'Log Standard Message',
        abbreviation: 'LM',
        description: 'Record a message onto the blockchain',
        costFunction: estimatedLogMessageTxCost
    }),
    send_off_chain_message: Object.freeze({
        name: 'send_off_chain_message',
        label: 'Send Off-Chain Message',
        abbreviation: 'SOM',
        description: 'Record a message off-chain addressing it to another device (with no read confirmation) and later settle it to the blockchain',
        costFunction: estimatedSendOffChainMessageCost
    }),
    send_message: Object.freeze({
        name: 'send_message',
        label: 'Send Standard Message',
        abbreviation: 'SM',
        description: 'Record a message onto the blockchain addressing it to another device (with no read confirmation)',
        costFunction: estimatedSendMessageTxCost
    }),
    send_off_chain_msg_read_confirm: Object.freeze({
        name: 'send_off_chain_msg_read_confirm',
        label: 'Send Off-Chain Message w/Read Confirmation',
        abbreviation: 'SOMR',
        description: 'Record a message off-chain addressing it to another device, requesting to receive a read confirm, and later settle it to the blockchain',
        costFunction: estimatedSendOffChainMessageReadConfirmCost
    }),
    send_msg_read_confirm: Object.freeze({
        name: 'send_msg_read_confirm',
        label: 'Send Standard Message w/Read Confirmation',
        abbreviation: 'SMR',
        description: 'Record a message onto the blockchain addressing it to another device, requesting to receive a read confirm',
        costFunction: estimatedSendMessageReadConfirmTxCost
    }),
    issue_asset: Object.freeze({
        name: 'issue_asset',
        label: 'Issue Asset',
        abbreviation: 'IA',
        description: 'Issue an amount of a new Catenis asset',
        costFunction: estimatedIssueAssetTxCost
    }),
    transfer_asset: Object.freeze({
        name: 'transfer_asset',
        label: 'Transfer Asset',
        abbreviation: 'TA',
        description: 'Transfer an amount of a Catenis asset to another device',
        costFunction: estimatedTransferAssetTxCost
    }),
    migrate_asset: Object.freeze({
        name: 'migrate_asset',
        label: 'Migrate Asset',
        abbreviation: 'MA',
        description: 'Migrate an amount of a (previously exported) Catenis asset to or from a foreign blockchain',
        costFunction: estimatedMigrateAssetAverageTxCost
    })
});


// Definition of module (private) functions
//

function systemFundingCost() {
    return Service.minServiceCreditIssuanceFundAmount + Service.minBcotSaleStockFundAmount + Service.minPayTxExpenseFundAmount + Service.minReadConfirmPayTxExpenseFundAmount + Service.minServicePaymentPayTxExpenseFundAmount;
}

function numActiveSystemDeviceMainAddresses() {
    return Math.ceil((cfgSettings.sysMessage.messagesPerMinute * cfgSettings.sysMessage.minutesToConfirm) / cfgSettings.sysMessage.unconfMainAddrReuses);
}

function estimatedSendSystemMessageTxCost() {
    return Util.roundToResolution(typicalSendSystemMessageTxVsize() * Catenis.bitcoinFees.getFeeRateByTime(cfgSettings.sysMessage.minutesToConfirm), cfgSettings.paymentResolution);
}

function estimatedSettleOffChainMessagesTxCost() {
    return Util.roundToResolution(typicalSettleOffChainMessagesTxVsize() * Service.feeRateForOffChainMsgsSettlement, cfgSettings.paymentResolution);
}

function typicalSendSystemMessageTxVsize() {
    return new TransactionSize({
        numWitnessInputs: cfgSettings.sysTxConfig.sendSysMessage.numWitnessInputs,
        numNonWitnessInputs: cfgSettings.sysTxConfig.sendSysMessage.numNonWitnessInputs,
        numWitnessOutputs: cfgSettings.sysTxConfig.sendSysMessage.numWitnessOutputs,
        numNonWitnessOutputs: cfgSettings.sysTxConfig.sendSysMessage.numNonWitnessOutputs,
        nullDataPayloadSize: cfgSettings.sysTxConfig.sendSysMessage.nullDataPayloadSize
    }).savedSizeInfo.vsize;
}

function typicalSettleOffChainMessagesTxVsize() {
    return new TransactionSize({
        numWitnessInputs: cfgSettings.sysTxConfig.settleOffChainMessages.numWitnessInputs,
        numNonWitnessInputs: cfgSettings.sysTxConfig.settleOffChainMessages.numNonWitnessInputs,
        numWitnessOutputs: cfgSettings.sysTxConfig.settleOffChainMessages.numWitnessOutputs,
        numNonWitnessOutputs: cfgSettings.sysTxConfig.settleOffChainMessages.numNonWitnessOutputs,
        nullDataPayloadSize: cfgSettings.sysTxConfig.settleOffChainMessages.nullDataPayloadSize
    }).savedSizeInfo.vsize;
}

function deviceProvisionCost() {
    // Includes cost to fund device main addresses and asset issuance addresses
    return deviceMessageProvisionCost() + Service.deviceAssetProvisionCost();
}

function deviceMessageProvisionCost() {
    return numActiveDeviceMainAddresses() * Service.devMainAddrAmount;
}

function numActiveDeviceMainAddresses() {
    return Math.ceil((cfgSettings.message.messagesPerMinute * cfgSettings.message.minutesToConfirm) / cfgSettings.message.unconfMainAddrReuses);
}

function numActiveDeviceAssetIssuanceAddresses() {
    return Math.ceil((cfgSettings.asset.issuance.assetsPerMinute * cfgSettings.asset.issuance.minutesToConfirm) / cfgSettings.asset.issuance.unconfAssetIssueAddrReuses);
}

function highestEstimatedServiceTxCost() {
    return _.max([
        estimatedLogMessageTxCost(),
        estimatedSendMessageTxCost(),
        estimatedSendMessageReadConfirmTxCost(),
        estimatedLogOffChainMessageCost(),
        estimatedSendOffChainMessageCost(),
        estimatedSendOffChainMessageReadConfirmCost(),
        estimatedIssueAssetTxCost(),
        estimatedTransferAssetTxCost(),
        estimatedMigrateAssetAverageTxCost()
    ]);
}

function averageEstimatedServiceTxCost() {
    return Util.roundToResolution(Util.weightedAverage([
        estimatedLogMessageTxCost(),
        estimatedSendMessageTxCost(),
        estimatedSendMessageReadConfirmTxCost(),
        estimatedLogOffChainMessageCost(),
        estimatedSendOffChainMessageCost(),
        estimatedSendOffChainMessageReadConfirmCost(),
        estimatedIssueAssetTxCost(),
        estimatedTransferAssetTxCost(),
        estimatedMigrateAssetAverageTxCost()
    ], [
        cfgSettings.serviceUsageWeight.logMessage,
        cfgSettings.serviceUsageWeight.sendMessage,
        cfgSettings.serviceUsageWeight.sendMsgReadConfirm,
        cfgSettings.serviceUsageWeight.logOffChainMessage,
        cfgSettings.serviceUsageWeight.sendOffChainMessage,
        cfgSettings.serviceUsageWeight.sendOffChainMsgReadConfirm,
        cfgSettings.serviceUsageWeight.issueAsset,
        cfgSettings.serviceUsageWeight.transferAsset,
        cfgSettings.serviceUsageWeight.outMigrateAsset + cfgSettings.serviceUsageWeight.inMigrateAsset
    ]), cfgSettings.paymentResolution);
}

function estimatedLogMessageTxCost() {
    return Util.roundToResolution(typicalLogMessageTxVsize() * Catenis.bitcoinFees.getFeeRateByTime(cfgSettings.message.minutesToConfirm), cfgSettings.paymentResolution);
}

function typicalLogMessageTxVsize() {
    return new TransactionSize({
        numWitnessInputs: cfgSettings.serviceTxConfig.logMessage.numWitnessInputs,
        numNonWitnessInputs: cfgSettings.serviceTxConfig.logMessage.numNonWitnessInputs,
        numWitnessOutputs: cfgSettings.serviceTxConfig.logMessage.numWitnessOutputs,
        numNonWitnessOutputs: cfgSettings.serviceTxConfig.logMessage.numNonWitnessOutputs,
        nullDataPayloadSize: cfgSettings.serviceTxConfig.logMessage.nullDataPayloadSize
    }).savedSizeInfo.vsize;
}

function estimatedSendMessageTxCost() {
    return Util.roundToResolution(typicalSendMessageTxVsize() * Catenis.bitcoinFees.getFeeRateByTime(cfgSettings.message.minutesToConfirm), cfgSettings.paymentResolution);
}

function typicalSendMessageTxVsize() {
    return new TransactionSize({
        numWitnessInputs: cfgSettings.serviceTxConfig.sendMessage.numWitnessInputs,
        numNonWitnessInputs: cfgSettings.serviceTxConfig.sendMessage.numNonWitnessInputs,
        numWitnessOutputs: cfgSettings.serviceTxConfig.sendMessage.numWitnessOutputs,
        numNonWitnessOutputs: cfgSettings.serviceTxConfig.sendMessage.numNonWitnessOutputs,
        nullDataPayloadSize: cfgSettings.serviceTxConfig.sendMessage.nullDataPayloadSize
    }).savedSizeInfo.vsize;
}

function estimatedSendMessageReadConfirmTxCost() {
    return Util.roundToResolution(typicalSendMessageReadConfirmTxVsize() * Catenis.bitcoinFees.getFeeRateByTime(cfgSettings.message.minutesToConfirm), cfgSettings.paymentResolution);
}

function typicalSendMessageReadConfirmTxVsize() {
    return new TransactionSize({
        numWitnessInputs: cfgSettings.serviceTxConfig.sendMsgReadConfirm.numWitnessInputs,
        numNonWitnessInputs: cfgSettings.serviceTxConfig.sendMsgReadConfirm.numNonWitnessInputs,
        numWitnessOutputs: cfgSettings.serviceTxConfig.sendMsgReadConfirm.numWitnessOutputs,
        numNonWitnessOutputs: cfgSettings.serviceTxConfig.sendMsgReadConfirm.numNonWitnessOutputs,
        nullDataPayloadSize: cfgSettings.serviceTxConfig.sendMsgReadConfirm.nullDataPayloadSize
    }).savedSizeInfo.vsize;
}

function estimatedOffChainMsgEnvelopeCost() {
    return Util.roundToResolution(estimatedSettleOffChainMessagesTxCost() / cfgSettings.message.offChain.price.numMsgsPayCost, cfgSettings.paymentResolution);
}

function estimatedOffChaiMsgReceiptCost() {
    return Util.roundToResolution(estimatedOffChainMsgEnvelopeCost() * cfgSettings.message.offChain.price.msgReceipt.percCost, cfgSettings.paymentResolution);
}

function estimatedLogOffChainMessageCost() {
    return estimatedOffChainMsgEnvelopeCost();
}

function estimatedSendOffChainMessageCost() {
    return estimatedOffChainMsgEnvelopeCost();
}

function estimatedSendOffChainMessageReadConfirmCost() {
    return estimatedOffChainMsgEnvelopeCost() + estimatedOffChaiMsgReceiptCost();
}

function estimatedIssueAssetTxCost() {
    return Util.roundToResolution(typicalIssueAssetTxVsize() * Catenis.bitcoinFees.getFeeRateByTime(cfgSettings.asset.issuance.minutesToConfirm), cfgSettings.paymentResolution);
}

function typicalIssueAssetTxVsize() {
    return new TransactionSize({
        numWitnessInputs: cfgSettings.serviceTxConfig.issueAsset.numWitnessInputs,
        numNonWitnessInputs: cfgSettings.serviceTxConfig.issueAsset.numNonWitnessInputs,
        numWitnessOutputs: cfgSettings.serviceTxConfig.issueAsset.numWitnessOutputs,
        numNonWitnessOutputs: cfgSettings.serviceTxConfig.issueAsset.numNonWitnessOutputs,
        nullDataPayloadSize: cfgSettings.serviceTxConfig.issueAsset.nullDataPayloadSize
    }).savedSizeInfo.vsize;
}

function estimatedTransferAssetTxCost() {
    return Util.roundToResolution(typicalTransferAssetTxVsize() * Catenis.bitcoinFees.getFeeRateByTime(cfgSettings.asset.transfer.minutesToConfirm), cfgSettings.paymentResolution);
}

function typicalTransferAssetTxVsize() {
    return new TransactionSize({
        numWitnessInputs: cfgSettings.serviceTxConfig.transferAsset.numWitnessInputs,
        numNonWitnessInputs: cfgSettings.serviceTxConfig.transferAsset.numNonWitnessInputs,
        numWitnessOutputs: cfgSettings.serviceTxConfig.transferAsset.numWitnessOutputs,
        numNonWitnessOutputs: cfgSettings.serviceTxConfig.transferAsset.numNonWitnessOutputs,
        nullDataPayloadSize: cfgSettings.serviceTxConfig.transferAsset.nullDataPayloadSize
    }).savedSizeInfo.vsize;
}

function estimatedOutMigrateAssetTxCost() {
    return Util.roundToResolution(typicalOutMigrateAssetTxVsize() * Catenis.bitcoinFees.getFeeRateByTime(cfgSettings.asset.outMigrate.minutesToConfirm), cfgSettings.paymentResolution);
}

function typicalOutMigrateAssetTxVsize() {
    return new TransactionSize({
        numWitnessInputs: cfgSettings.serviceTxConfig.outMigrateAsset.numWitnessInputs,
        numNonWitnessInputs: cfgSettings.serviceTxConfig.outMigrateAsset.numNonWitnessInputs,
        numWitnessOutputs: cfgSettings.serviceTxConfig.outMigrateAsset.numWitnessOutputs,
        numNonWitnessOutputs: cfgSettings.serviceTxConfig.outMigrateAsset.numNonWitnessOutputs,
        nullDataPayloadSize: cfgSettings.serviceTxConfig.outMigrateAsset.nullDataPayloadSize
    }).savedSizeInfo.vsize;
}

function estimatedInMigrateAssetTxCost() {
    return Util.roundToResolution(typicalInMigrateAssetTxVsize() * Catenis.bitcoinFees.getFeeRateByTime(cfgSettings.asset.inMigrate.minutesToConfirm), cfgSettings.paymentResolution);
}

function typicalInMigrateAssetTxVsize() {
    return new TransactionSize({
        numWitnessInputs: cfgSettings.serviceTxConfig.inMigrateAsset.numWitnessInputs,
        numNonWitnessInputs: cfgSettings.serviceTxConfig.inMigrateAsset.numNonWitnessInputs,
        numWitnessOutputs: cfgSettings.serviceTxConfig.inMigrateAsset.numWitnessOutputs,
        numNonWitnessOutputs: cfgSettings.serviceTxConfig.inMigrateAsset.numNonWitnessOutputs,
        nullDataPayloadSize: cfgSettings.serviceTxConfig.inMigrateAsset.nullDataPayloadSize
    }).savedSizeInfo.vsize;
}

function estimatedMigrateAssetAverageTxCost() {
    return Util.roundToResolution(Util.weightedAverage([
        estimatedOutMigrateAssetTxCost(),
        estimatedInMigrateAssetTxCost()
    ], [
        cfgSettings.serviceUsageWeight.outMigrateAsset,
        cfgSettings.serviceUsageWeight.inMigrateAsset
    ]), cfgSettings.paymentResolution);
}

function highestEstimatedReadConfirmTxCostPerMessage() {
    return _.max([
        averageReadConfirmTxCostPerMessage(),
        estimatedTerminalReadConfirmTxCostPerMessage()
    ]);
}

function averageEstimatedReadConfirmTxCostPerMessage() {
    return Util.roundToResolution(Util.weightedAverage([
        averageReadConfirmTxCostPerMessage(),
        estimatedTerminalReadConfirmTxCostPerMessage()
    ], [
        cfgSettings.message.readConfirmation.usageWeight.regular,
        cfgSettings.message.readConfirmation.usageWeight.terminal
    ]), cfgSettings.message.readConfirmation.paymentResolution);
}

function estimatedTerminalReadConfirmTxCostPerMessage() {
    const typicalTxCost = Util.roundToResolution(typicalTerminalReadConfirmTxVsize() * Catenis.bitcoinFees.getFeeRateByTime(cfgSettings.message.readConfirmation.terminalReadConfirmTx.minutesToConfirm), cfgSettings.message.readConfirmation.paymentResolution);

    return Util.roundToResolution(typicalTxCost / cfgSettings.message.readConfirmation.terminalReadConfirmTx.typicalTxConfig.numMessagesConfirmed, cfgSettings.message.readConfirmation.paymentResolution);
}

function typicalTerminalReadConfirmTxVsize() {
    // NOTE: the settings below are for the best case where only segregated witness inputs and outputs are used
    //      (which is true in the long run for the sandbox environment and should be true for the production
    //      environment from inception)
    return new TransactionSize({
        numWitnessInputs: numInputsTerminalReadConfirmTx(),
        numWitnessOutputs: numOutputsTerminalReadConfirmTx(),
        nullDataPayloadSize: cfgSettings.message.readConfirmation.terminalReadConfirmTx.typicalTxConfig.nullDataPayloadSize
    }).savedSizeInfo.vsize;
}

function numInputsTerminalReadConfirmTx() {
    return cfgSettings.message.readConfirmation.terminalReadConfirmTx.typicalTxConfig.numMessagesConfirmed + cfgSettings.message.readConfirmation.terminalReadConfirmTx.typicalTxConfig.numPayTxExpenseInputs;
}

function numOutputsTerminalReadConfirmTx() {
    const numMsgs = cfgSettings.message.readConfirmation.terminalReadConfirmTx.typicalTxConfig.numMessagesConfirmed;
    let numOutputs = cfgSettings.message.readConfirmation.terminalReadConfirmTx.typicalTxConfig.hasChangeOutput ? 1 : 0;

    if (numMsgs > 0) {
        if (numMsgs >= 1) {
            // Account for a single read confirmation send notify output
            numOutputs++;
        }

        if (numMsgs >= 2) {
            // Add a single read confirmation send null output
            numOutputs++;
        }

        if (numMsgs >= 3) {
            // Add a single read confirmation send only output
            numOutputs++;
        }

        if (numMsgs % cfgSettings.message.readConfirmation.txInputOutputGrowthRatio === 0) {
            // Add one more read confirmation send notify output
            numOutputs++;
        }
    }

    return numOutputs;
}

// Calculate average cost (fee paid) of Read Confirmation tx per message
//
//  NOTE: the reason for that is because we use the Replace By Fee (RBF) feature
//   to replace the original transaction every time we need to confirm that a new
//   message was read, and every time we do that, a higher fee and fee rate must be used
function averageReadConfirmTxCostPerMessage() {
    const optimumFeeRate = Catenis.bitcoinFees.getOptimumFeeRate();

    if (Service.avrgReadConfirmTxCostPerMsgCtrl.lastOptimumRate !== optimumFeeRate) {
        Service.avrgReadConfirmTxCostPerMsgCtrl.lastOptimumRate = optimumFeeRate;

        let lastTxFee;
        let numMsgs = 0;
        let sumFeePerMsg = 0;
        const readConfirmTxInfo = new RbfTransactionInfo({
            numWitnessInputs: cfgSettings.message.readConfirmation.initNumTxWitnessInputs,
            numNonWitnessInputs: cfgSettings.message.readConfirmation.initNumTxNonWitnessInputs,
            numWitnessOutputs: cfgSettings.message.readConfirmation.initNumTxWitnessOutputs,
            numNonWitnessOutputs: cfgSettings.message.readConfirmation.initNumTxNonWitnessOutputs,
            nullDataPayloadSize: cfgSettings.message.readConfirmation.txNullDataPayloadSize
        }, {
            paymentResolution: cfgSettings.message.readConfirmation.paymentResolution,
            txFeeRateIncrement: cfgSettings.message.readConfirmation.txFeeRateIncrement,
            initTxFeeRate: cfgSettings.message.readConfirmation.initTxFeeRate
        });
        const maxUnitsPayTxExp = Math.floor(cfgSettings.readConfirmPayTxExpenseFunding.maxUnitsPerAddr * cfgSettings.message.readConfirmation.percMaxUnitsPayTxExp);

        do {
            numMsgs++;

            if (numMsgs > 1) {
                // Add one more tx input to spend a new read confirmation output
                //  Note: we are assuming the best case where inputs that spend read confirmation
                //      outputs are all of the segregated witness type
                readConfirmTxInfo.addInputs(true, 1);

                if (numMsgs % maxUnitsPayTxExp === 0) {
                    // Add one more tx input to pay for tx fee
                    //  Note: we are assuming the best case where inputs to pay for tx fee are all
                    //      of the segregated witness type
                    readConfirmTxInfo.addInputs(true, 1);
                }

                if (numMsgs <= 3) {
                    // Add one more tx output for paying spent read confirmation outputs to both
                    //  system read confirmation spend only and system read confirmation spend null addresses
                    //  Note: we are assuming the best case where outputs for paying spent read confirmation outputs
                    //      are all of the segregated witness type
                    readConfirmTxInfo.addOutputs(true, 1);
                }

                if (numMsgs % cfgSettings.message.readConfirmation.txInputOutputGrowthRatio === 0) {
                    // Add one more tx output for paying spent read confirmation outputs to
                    //  system read confirmation spend notify address of a different Catenis node
                    //  Note: we are assuming the best case where outputs for paying spent read confirmation outputs
                    //      are all of the segregated witness type
                    readConfirmTxInfo.addOutputs(true, 1);
                }
            }

            lastTxFee = readConfirmTxInfo.getNewTxFee();
            readConfirmTxInfo.confirmTxFee();

            sumFeePerMsg += Util.roundToResolution(lastTxFee.fee / numMsgs, cfgSettings.message.readConfirmation.paymentResolution);
        }
        while (lastTxFee.feeRate < optimumFeeRate);

        Service.avrgReadConfirmTxCostPerMsgCtrl.lastCostPerMsg = Util.roundToResolution(sumFeePerMsg / numMsgs, cfgSettings.message.readConfirmation.paymentResolution);
    }

    return Service.avrgReadConfirmTxCostPerMsgCtrl.lastCostPerMsg;
}

// Returns highest service price expressed in Catenis service credit's lowest units
function highestServicePrice() {
    // noinspection JSCheckFunctionSignatures
    return _.max(Object.values(Service.clientPaidService).map((paidService) => {
        return getServicePrice(paidService).finalServicePrice;
    }));
}

function averageServicePrice() {
    return Util.roundToResolution(Util.weightedAverage([
        getServicePrice(Service.clientPaidService.log_message).finalServicePrice,
        getServicePrice(Service.clientPaidService.send_message).finalServicePrice,
        getServicePrice(Service.clientPaidService.send_msg_read_confirm).finalServicePrice,
        getServicePrice(Service.clientPaidService.log_off_chain_message).finalServicePrice,
        getServicePrice(Service.clientPaidService.send_off_chain_message).finalServicePrice,
        getServicePrice(Service.clientPaidService.send_off_chain_msg_read_confirm).finalServicePrice,
        getServicePrice(Service.clientPaidService.issue_asset).finalServicePrice,
        getServicePrice(Service.clientPaidService.transfer_asset).finalServicePrice,
        getServicePrice(Service.clientPaidService.migrate_asset).finalServicePrice
    ], [
        cfgSettings.serviceUsageWeight.logMessage,
        cfgSettings.serviceUsageWeight.sendMessage,
        cfgSettings.serviceUsageWeight.sendMsgReadConfirm,
        cfgSettings.serviceUsageWeight.logOffChainMessage,
        cfgSettings.serviceUsageWeight.sendOffChainMessage,
        cfgSettings.serviceUsageWeight.sendOffChainMsgReadConfirm,
        cfgSettings.serviceUsageWeight.issueAsset,
        cfgSettings.serviceUsageWeight.transferAsset,
        cfgSettings.serviceUsageWeight.outMigrateAsset + cfgSettings.serviceUsageWeight.inMigrateAsset
    ]), cfgSettings.servicePriceResolution);
}

function highestEstimatedServicePaymentTxCostPerService() {
    return _.max([
        averageSpendServCredTxCostPerService(),
        averageDebitServAccountTxCostPerService()
    ]);
}

function averageEstimatedServicePaymentTxCostPerService() {
    let numActvPrePaidClients = Client.activePrePaidClientsCount();
    let numActvPostPaidClients = Client.activePostPaidClientsCount();

    if (numActvPrePaidClients === 0 && numActvPostPaidClients === 0) {
        numActvPrePaidClients = numActvPostPaidClients = 1;
    }

    return Util.roundToResolution(Util.weightedAverage([
        averageSpendServCredTxCostPerService(),
        averageDebitServAccountTxCostPerService()
    ], [
        numActvPrePaidClients,
        numActvPostPaidClients
    ]), cfgSettings.servicePayment.paymentResolution);
}

// Calculate average cost (fee paid) of Spend Service Credit tx per service
//
//  NOTE: the reason for that is because we use the Replace By Fee (RBF) feature
//   to replace the original transaction every time we need to spend service credit
//   to pay to a service, and every time we do that, a higher fee and fee rate must be used
function averageSpendServCredTxCostPerService() {
    const optimumFeeRate = Catenis.bitcoinFees.getOptimumFeeRate();

    if (Service.avrgSpendServCredTxCostPerServCtrl.lastOptimumRate !== optimumFeeRate) {
        Service.avrgSpendServCredTxCostPerServCtrl.lastOptimumRate = optimumFeeRate;

        let lastTxFee;
        let numServs = 0;
        let sumFeePerServ = 0;
        const servsPerClient = [1];
        const spendServCredTxInfo = new RbfTransactionInfo({
            numWitnessInputs: cfgSettings.servicePayment.spendServiceCredit.initNumTxWitnessInputs,
            numNonWitnessInputs: cfgSettings.servicePayment.spendServiceCredit.initNumTxNonWitnessInputs,
            numWitnessOutputs: cfgSettings.servicePayment.spendServiceCredit.initNumTxWitnessOutputs,
            numNonWitnessOutputs: cfgSettings.servicePayment.spendServiceCredit.initNumTxNonWitnessOutputs,
            numPubKeysMultiSigOutputs: cfgSettings.servicePayment.spendServiceCredit.initNumPubKeysMultiSigTxOutputs.concat(),  // Pass a copy of the config array parameter
            nullDataPayloadSize: cfgSettings.servicePayment.spendServiceCredit.txNullDataPayloadSize
        }, {
            paymentResolution: cfgSettings.servicePayment.paymentResolution,
            txFeeRateIncrement: cfgSettings.servicePayment.spendServiceCredit.txFeeRateIncrement,
            initTxFeeRate: cfgSettings.servicePayment.spendServiceCredit.initTxFeeRate
        });
        const maxUnitsPayTxExp = Math.floor(cfgSettings.servicePaymentPayTxExpenseFunding.maxUnitsPerAddr * cfgSettings.servicePayment.spendServiceCredit.percMaxUnitsPayTxExp);

        do {
            numServs++;

            if (numServs > 1) {
                let txChanged = false;
                const clientIdx = Math.floor(((numServs - 1) % (cfgSettings.servicePayment.spendServiceCredit.maxNumClients * cfgSettings.servicePayment.spendServiceCredit.servsDistribPerClient)) / cfgSettings.servicePayment.spendServiceCredit.servsDistribPerClient);

                if (clientIdx > servsPerClient.length - 1) {
                    // Add inputs and outputs for new client
                    servsPerClient[clientIdx] = 0;

                    // Note: we are assuming the best case where client inputs are all
                    //      of the segregated witness type
                    spendServCredTxInfo.addInputs(true, 1);
                    // Note: we are assuming the best case where client outputs are all
                    //      of the segregated witness type
                    spendServCredTxInfo.addOutputs(true, 1);

                    if (servsPerClient.length === cfgSettings.servicePayment.spendServiceCredit.numClientsMultiSigOutput) {
                        // Add multi-signature output
                        spendServCredTxInfo.addMultiSigOutput(3);
                    }

                    txChanged = true;
                }

                if (++servsPerClient[clientIdx] % cfgSettings.servicePayment.spendServiceCredit.maxServsPerClientInput === 0) {
                    // Add a new client service account credit line address input
                    //  Note: we are assuming the best case where client service account credit line
                    //      address inputs to pay for tx fee are all of the segregated witness type
                    spendServCredTxInfo.addInputs(true, 1);

                    txChanged = true;
                }

                if (numServs % maxUnitsPayTxExp === 0) {
                    // Add one more tx input to pay for tx fee
                    //  Note: we are assuming the best case where inputs to pay for tx fee are all
                    //      of the segregated witness type
                    spendServCredTxInfo.addInputs(true, 1);

                    txChanged = true;
                }

                if (!txChanged) {
                    spendServCredTxInfo.forceRecalculateFee();
                }
            }

            lastTxFee = spendServCredTxInfo.getNewTxFee();
            spendServCredTxInfo.confirmTxFee();

            sumFeePerServ += Util.roundToResolution(lastTxFee.fee / numServs, cfgSettings.servicePayment.paymentResolution);
        }
        while (lastTxFee.feeRate < optimumFeeRate);

        Service.avrgSpendServCredTxCostPerServCtrl.lastCostPerServ = Util.roundToResolution(sumFeePerServ / numServs, cfgSettings.servicePayment.paymentResolution);
    }

    return Service.avrgSpendServCredTxCostPerServCtrl.lastCostPerServ;
}

// Calculate average cost (fee paid) of Debit Service Account tx per service
//
//  NOTE: the reason for that is because we use the Replace By Fee (RBF) feature
//   to replace the original transaction every time we need to spend service credit
//   to pay to a service, and every time we do that, a higher fee and fee rate must be used
function averageDebitServAccountTxCostPerService() {
    const optimumFeeRate = Catenis.bitcoinFees.getOptimumFeeRate();

    if (Service.avrgDebitServAccTxCostPerServCtrl.lastOptimumRate !== optimumFeeRate) {
        Service.avrgDebitServAccTxCostPerServCtrl.lastOptimumRate = optimumFeeRate;

        let lastTxFee;
        let numServs = 0;
        let sumFeePerServ = 0;
        const servsPerClient = [1];
        const debitServCredTxInfo = new RbfTransactionInfo({
            numWitnessInputs: cfgSettings.servicePayment.debitServiceAccount.initNumTxWitnessInputs,
            numNonWitnessInputs: cfgSettings.servicePayment.debitServiceAccount.initNumTxNonWitnessInputs,
            numWitnessOutputs: cfgSettings.servicePayment.debitServiceAccount.initNumTxWitnessOutputs,
            numNonWitnessOutputs: cfgSettings.servicePayment.debitServiceAccount.initNumTxNonWitnessOutputs,
            numPubKeysMultiSigOutputs: cfgSettings.servicePayment.debitServiceAccount.initNumPubKeysMultiSigTxOutputs.concat(),  // Pass a copy of the config array parameter
            nullDataPayloadSize: cfgSettings.servicePayment.debitServiceAccount.txNullDataPayloadSize,
        }, {
            paymentResolution: cfgSettings.servicePayment.paymentResolution,
            txFeeRateIncrement: cfgSettings.servicePayment.debitServiceAccount.txFeeRateIncrement,
            initTxFeeRate: cfgSettings.servicePayment.debitServiceAccount.initTxFeeRate
        });
        const maxUnitsPayTxExp = Math.floor(cfgSettings.servicePaymentPayTxExpenseFunding.maxUnitsPerAddr * cfgSettings.servicePayment.debitServiceAccount.percMaxUnitsPayTxExp);

        do {
            numServs++;

            if (numServs > 1) {
                let txChanged = false;
                const clientIdx = Math.floor(((numServs - 1) % (cfgSettings.servicePayment.debitServiceAccount.maxNumClients * cfgSettings.servicePayment.debitServiceAccount.servsDistribPerClient)) / cfgSettings.servicePayment.debitServiceAccount.servsDistribPerClient);

                if (clientIdx > servsPerClient.length - 1) {
                    // Add outputs for new client
                    servsPerClient[clientIdx] = 0;

                    // Note: we are assuming the best case where client outputs are all
                    //      of the segregated witness type
                    debitServCredTxInfo.addOutputs(true, 1);

                    if (servsPerClient.length === cfgSettings.servicePayment.debitServiceAccount.numClientsMultiSigOutput) {
                        // Add multi-signature output
                        debitServCredTxInfo.addMultiSigOutput(3);
                    }

                    txChanged = true;
                }

                ++servsPerClient[clientIdx];

                if (numServs % maxUnitsPayTxExp === 0) {
                    // Add one more tx input to pay for tx fee.
                    //  Note: we are assuming the best case where inputs to pay for tx fee are all
                    //      of the segregated witness type
                    debitServCredTxInfo.addInputs(true, 1);

                    txChanged = true;
                }

                if (!txChanged) {
                    debitServCredTxInfo.forceRecalculateFee();
                }
            }

            lastTxFee = debitServCredTxInfo.getNewTxFee();
            debitServCredTxInfo.confirmTxFee();

            sumFeePerServ += Util.roundToResolution(lastTxFee.fee / numServs, cfgSettings.servicePayment.paymentResolution);
        }
        while (lastTxFee.feeRate < optimumFeeRate);

        Service.avrgDebitServAccTxCostPerServCtrl.lastCostPerServ = Util.roundToResolution(sumFeePerServ / numServs, cfgSettings.servicePayment.paymentResolution);
    }

    return Service.avrgDebitServAccTxCostPerServCtrl.lastCostPerServ;
}

function numPrePaidServices () {
    return Math.floor(Client.allPrePaidClientsServiceAccountCreditLineBalance() / averageServicePrice());
}

// Returns price data for given service
//
//  Arguments:
//   paidService: [Object] - Catenis client paid service. One of the properties of Service.clientPaidService
//
//  Return: {
//    estimatedServiceCost: [Number], - Estimated cost, in satoshis, of the service
//    priceMarkup: [Number], - Markup used to calculate the price of the service
//    btcServicePrice: [Number], - Price of the service expressed in (bitcoin) satoshis
//    bitcoinPrice: [Number] - Bitcoin price, in USD, used to calculate exchange rate
//    bcotPrice: [Number] - BCOT token price, in USD, used to calculate exchange rate
//    exchangeRate: [Number], - Bitcoin to BCOT token (1 BTC = x BCOT) exchange rate used to calculate final price
//    finalServicePrice: [Number] - Price charged for the service expressed in Catenis service credit's lowest units
//  }
export function getServicePrice(paidService) {
    const result = {
        estimatedServiceCost: paidService.costFunction(),
        priceMarkup: cfgSettings.priceMarkup,
    };

    const bnBtcServicePrice = new BigNumber(result.estimatedServiceCost).times(1 + result.priceMarkup);
    const btcExchangeRate = Catenis.bcotPrice.getLatestBitcoinExchangeRate();

    result.btcServicePrice = bnBtcServicePrice.toNumber();
    result.bitcoinPrice = btcExchangeRate.btcPrice;
    result.bcotPrice = btcExchangeRate.bcotPrice;
    result.exchangeRate = btcExchangeRate.exchangeRate;
    result.finalServicePrice = Util.roundToResolution(BcotToken.bcotToServiceCredit(bnBtcServicePrice.multipliedBy(btcExchangeRate.exchangeRate).decimalPlaces(0, BigNumber.ROUND_CEIL).toNumber()), cfgSettings.servicePriceResolution);

    return result;
}

// NOTE: totalAmount should be a multiple of payAmount, though the method will still
//        work if it is not (the remainder shall be added to the last credited address)
function distributePayment(totalAmount, payAmount, addressesPerBatch, paysPerAddress, totalAddresses) {
    // Adjust total amount if necessary
    if (totalAddresses !== undefined) {
        const maxAmount = totalAddresses * paysPerAddress * payAmount;
        totalAmount = totalAmount > maxAmount ? maxAmount : totalAmount;
    }

    const payments = [];
    let remainAmount = totalAmount;
    let remainAddresses = totalAddresses;

    for (let batchNum = 1, maxBatches = Math.ceil(totalAmount / (payAmount * addressesPerBatch * paysPerAddress)); batchNum <= maxBatches; batchNum++) {
        const addressesInBatch = remainAddresses === undefined || remainAddresses > addressesPerBatch ? addressesPerBatch : remainAddresses,
            maxAmountInBatch = addressesInBatch * paysPerAddress * payAmount,
            workAmount = remainAmount > maxAmountInBatch ? maxAmountInBatch : remainAmount,
            payIdxOffset = (batchNum - 1) * addressesPerBatch,
            payPerAddress = Math.floor(workAmount / (payAmount * addressesInBatch));
        let extraPayAmount = workAmount % (payAmount * addressesInBatch);

        // Fill up pays by address for this batch
        if (payPerAddress > 0) {
            for (let idx = 0; idx < addressesInBatch; idx++) {
                payments[payIdxOffset + idx] = payPerAddress * payAmount;
            }
        }

        if (extraPayAmount> 0) {
            for (let idx = 0; extraPayAmount > 0; idx++, extraPayAmount -= payAmount) {
                payments[payIdxOffset + idx] = (payments[payIdxOffset + idx] !== undefined ? payments[payIdxOffset + idx] : 0) + (extraPayAmount > payAmount ? payAmount : extraPayAmount);
            }
        }

        // Adjust remaining amount
        remainAmount -= workAmount;

        if (remainAddresses !== undefined) {
            // Adjust remaining addresses
            remainAddresses -= addressesInBatch;
        }
    }

    if (totalAddresses !== undefined) {
        return {
            totalAmount: totalAmount,
            payments: payments
        };
    }
    else {
        return payments;
    }
}


// Module code
//

// Definition of properties
Object.defineProperties(Service, {
    minutesToConfirmSysMessage: {
        get: function () {
            return cfgSettings.sysMessage.minutesToConfirm;
        },
        enumerable: true
    },
    feeRateForOffChainMsgsSettlement: {
        get: function () {
            return cfgSettings.sysMessage.offChainMessagesSettlement.minutesToConfirm ? Catenis.bitcoinFees.getFeeRateByTime(cfgSettings.sysMessage.offChainMessagesSettlement.minutesToConfirm) : Catenis.bitcoinFees.getOptimumFeeRate();
        },
        enumerable: true
    },
    minutesToConfirmMessage: {
        get: function () {
            return cfgSettings.message.minutesToConfirm;
        },
        enumerable: true
    },
    minutesToConfirmAssetIssuance: {
        get: function () {
            return cfgSettings.asset.issuance.minutesToConfirm;
        },
        enumerable: true
    },
    minutesToConfirmAssetTransfer: {
        get: function () {
            return cfgSettings.asset.transfer.minutesToConfirm;
        },
        enumerable: true
    },
    minutesToConfirmAssetOutMigration: {
        get: function () {
            return cfgSettings.asset.outMigrate.minutesToConfirm;
        },
        enumerable: true
    },
    minutesToConfirmAssetInMigrate: {
        get: function () {
            return cfgSettings.asset.inMigrate.minutesToConfirm;
        },
        enumerable: true
    },
    paymentResolution: {
        get: function () {
            return cfgSettings.paymentResolution;
        },
        enumerable: true
    },
    // NOTE: this amount is expressed in Catenis service credit's lowest units (10^-7)
    serviceAccountUnitAmount: {
        get: function () {
            return Util.roundToResolution(highestServicePrice() * (1 + cfgSettings.serviceAccountFunding.unitAmountSafetyFactor), cfgSettings.servicePriceResolution);
        },
        enumerable: true
    },
    payTxExpFundUnitAmount: {
        get: function () {
            return Util.roundToResolution(_.max([estimatedSendSystemMessageTxCost(), highestEstimatedServiceTxCost()]) * (1 + cfgSettings.payTxExpenseFunding.unitAmountSafetyFactor), cfgSettings.paymentResolution);
        },
        enumerable: true
    },
    payTxExpBalanceSafetyFactor: {
        get: function () {
            return cfgSettings.payTxExpenseFunding.balanceSafetyFactor;
        },
        enumerable: true
    },
    readConfirmPaymentResolution: {
        get: function () {
            return cfgSettings.message.readConfirmation.paymentResolution;
        },
        enumerable: true
    },
    readConfirmPayTxExpFundUnitAmount: {
        get: function () {
            return Util.roundToResolution(highestEstimatedReadConfirmTxCostPerMessage() * (1 + cfgSettings.readConfirmPayTxExpenseFunding.unitAmountSafetyFactor), cfgSettings.message.readConfirmation.paymentResolution);
        },
        enumerable: true
    },
    readConfirmPayTxExpBalanceSafetyFactor: {
        get: function () {
            return cfgSettings.readConfirmPayTxExpenseFunding.balanceSafetyFactor;
        },
        enumerable: true
    },
    servicePaymentResolution: {
        get: function () {
            return cfgSettings.servicePayment.paymentResolution;
        },
        enumerable: true
    },
    servicePaymentPayTxExpFundUnitAmount: {
        get: function () {
            return Util.roundToResolution(highestEstimatedServicePaymentTxCostPerService() * (1 + cfgSettings.servicePaymentPayTxExpenseFunding.unitAmountSafetyFactor), cfgSettings.servicePayment.paymentResolution);
        },
        enumerable: true
    },
    servicePaymentPayTxExpBalanceSafetyFactor: {
        get: function () {
            return cfgSettings.servicePaymentPayTxExpenseFunding.balanceSafetyFactor;
        },
        enumerable: true
    },
    ocMsgsSetlmtPayTxExpFundUnitAmount: {
        get: function () {
            return Util.roundToResolution(estimatedSettleOffChainMessagesTxCost() * (1 + cfgSettings.ocMsgsSettlementPayTxExpenseFunding.unitAmountSafetyFactor), cfgSettings.paymentResolution);
        },
        enumerable: true
    },
    ocMsgsSetlmtPayTxExpBalanceSafetyFactor: {
        get: function () {
            return cfgSettings.ocMsgsSettlementPayTxExpenseFunding.balanceSafetyFactor;
        },
        enumerable: true
    },
    minimumFundingBalance: {
        get: function () {
            return systemFundingCost() * cfgSettings.systemFunding.multiplyFactor + deviceProvisionCost() * cfgSettings.systemFunding.clientsToFund * cfgSettings.systemFunding.devicesPerClientToFund;
        },
        enumerable: true
    },
    devMainAddrAmount: {
        get: function () {
            return Catenis.application.legacyDustFunding ? Transaction.legacyDustAmount : Transaction.witnessOutputDustAmount;
        },
        enumerable: true
    },
    devMainAddrMinBalance: {
        get: function () {
            return deviceMessageProvisionCost();
        },
        enumerable: true
    },
    devReadConfirmAddrAmount: {
        get: function () {
            return Transaction.witnessOutputDustAmount;
        },
        enumerable: true
    },
    readConfirmInitNumTxWitnessInputs: {
        get: function () {
            return cfgSettings.message.readConfirmation.initNumTxWitnessInputs;
        },
        enumerable: true
    },
    readConfirmInitNumTxNonWitnessInputs: {
        get: function () {
            return cfgSettings.message.readConfirmation.initNumTxNonWitnessInputs;
        },
        enumerable: true
    },
    readConfirmInitNumTxWitnessOutputs: {
        get: function () {
            return cfgSettings.message.readConfirmation.initNumTxWitnessOutputs;
        },
        enumerable: true
    },
    readConfirmInitNumTxNonWitnessOutputs: {
        get: function () {
            return cfgSettings.message.readConfirmation.initNumTxNonWitnessOutputs;
        },
        enumerable: true
    },
    readConfirmTxNullDataPayloadSize: {
        get: function () {
            return cfgSettings.message.readConfirmation.txNullDataPayloadSize;
        },
        enumerable: true
    },
    readConfirmInitTxFeeRate: {
        get: function () {
            return cfgSettings.message.readConfirmation.initTxFeeRate;
        },
        enumerable: true
    },
    readConfirmTxFeeRateIncrement: {
        get: function () {
            return cfgSettings.message.readConfirmation.txFeeRateIncrement;
        },
        enumerable: true
    },
    readConfirmTerminalTxMinToConfirm: {
        get: function () {
            return cfgSettings.message.readConfirmation.terminalReadConfirmTx.minutesToConfirm;
        },
        enumerable: true
    },
    servicePriceResolution: {
        get: function () {
            return cfgSettings.servicePriceResolution;
        },
        enumerable: true
    },
    sysDevMainAddrAmount: {
        get: function () {
            return Catenis.application.legacyDustFunding ? Transaction.legacyDustAmount : Transaction.witnessOutputDustAmount;
        },
        enumerable: true
    },
    serviceCreditIssuanceAddrAmount: {
        get: function () {
            return Catenis.application.legacyDustFunding ? Transaction.legacyDustAmount : Transaction.dustAmountByAddress(Catenis.ctnHubNode.serviceCreditIssuanceAddress);
        },
        enumerable: true
    },
    bcotSaleStockAddrAmount: {
        get: function () {
            return Catenis.application.legacyDustFunding ? Transaction.legacyDustAmount : Transaction.dustAmountByAddress(Catenis.ctnHubNode.bcotSaleStockAddress);
        },
        enumerable: true
    },
    minServiceCreditIssuanceFundAmount: {
        get: function () {
            return (Math.ceil(cfgSettings.serviceCreditIssueAddrFunding.prePaidClientsToFund * cfgSettings.serviceCreditIssueAddrFunding.unitsPerPrePaidClients)
                + Math.ceil(cfgSettings.serviceCreditIssueAddrFunding.postPaidClientsToFund * cfgSettings.serviceCreditIssueAddrFunding.unitsPerPostPaidClients))
                * Service.serviceCreditIssuanceAddrAmount;
        },
        enumerable: true
    },
    minBcotSaleStockFundAmount: {
        get: function () {
            return (Math.ceil(cfgSettings.bcotSaleStockAddrFunding.prePaidClientsToFund * cfgSettings.bcotSaleStockAddrFunding.unitsPerPrePaidClients)
                + Math.ceil(cfgSettings.bcotSaleStockAddrFunding.postPaidClientsToFund * cfgSettings.bcotSaleStockAddrFunding.unitsPerPostPaidClients))
                * Service.bcotSaleStockAddrAmount;
        },
        enumerable: true
    },
    minPayTxExpenseFundAmount: {
        get: function () {
            const fundUnitAmount = Service.payTxExpFundUnitAmount;

            return Util.roundToResolution(estimatedSendSystemMessageTxCost() * cfgSettings.payTxExpenseFunding.sysMessagesToFund
                + averageEstimatedServiceTxCost() * cfgSettings.payTxExpenseFunding.minBalanceServicesPerDevice * cfgSettings.payTxExpenseFunding.devicesToFund,
                fundUnitAmount);
        },
        enumerable: true
    },
    minReadConfirmPayTxExpenseFundAmount: {
        get: function () {
            const fundUnitAmount = Service.readConfirmPayTxExpFundUnitAmount;

            return Util.roundToResolution(averageEstimatedReadConfirmTxCostPerMessage() * cfgSettings.readConfirmPayTxExpenseFunding.messagesToConfirmToFund, fundUnitAmount);
        },
        enumerable: true
    },
    minServicePaymentPayTxExpenseFundAmount: {
        get: function () {
            const fundUnitAmount = Service.servicePaymentPayTxExpFundUnitAmount;

            return Util.roundToResolution(averageEstimatedServicePaymentTxCostPerService() * cfgSettings.servicePaymentPayTxExpenseFunding.servicesToPayToFund, fundUnitAmount);
        },
        enumerable: true
    },
    minOCMsgsSetlmtPayTxExpenseFundAmount: {
        get: function () {
            const fundUnitAmount = Service.ocMsgsSetlmtPayTxExpFundUnitAmount;

            return Util.roundToResolution(estimatedSettleOffChainMessagesTxCost() * cfgSettings.ocMsgsSettlementPayTxExpenseFunding.settlementCyclesToFund, fundUnitAmount);
        },
        enumerable: true
    },
    spendServiceCreditInitTxFeeRate: {
        get: function () {
            return cfgSettings.message.readConfirmation.initTxFeeRate;
        },
        enumerable: true
    },
    spendServiceCreditTxFeeRateIncrement: {
        get: function () {
            return cfgSettings.message.readConfirmation.txFeeRateIncrement;
        },
        enumerable: true
    },
    numOffChainMsgsToPayCost: {
        get: function () {
            return cfgSettings.message.offChain.price.numMsgsPayCost;
        },
        enumerable: true
    },
    offChainMsgReceiptPercentageCost: {
        get: function () {
            return cfgSettings.message.offChain.price.msgReceipt.percCost;
        }
    },
    highestServicePrice: {
        get: highestServicePrice
    }
});

// Lock function class
Object.freeze(Service);
