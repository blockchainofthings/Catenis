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
import { Transaction } from './Transaction';
import { RbfTransactionInfo } from './RbfTransactionInfo';
import { Client } from './Client';
import { Device } from './Device';
import { Util } from './Util';
import { BcotToken } from './BcotToken';

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
        unitAmount: serviceConfig.get('serviceCreditIssueAddrFunding.unitAmount'),
        maxUnitsPerUtxo: serviceConfig.get('serviceCreditIssueAddrFunding.maxUnitsPerUtxo'),
        minUtxosToFund: serviceConfig.get('serviceCreditIssueAddrFunding.minUtxosToFund'),
        unitsPerPrePaidClients: serviceConfig.get('serviceCreditIssueAddrFunding.unitsPerPrePaidClients'),
        unitsPerPostPaidClients: serviceConfig.get('serviceCreditIssueAddrFunding.unitsPerPostPaidClients'),
        prePaidClientsToFund: serviceConfig.get('serviceCreditIssueAddrFunding.prePaidClientsToFund'),
        postPaidClientsToFund: serviceConfig.get('serviceCreditIssueAddrFunding.postPaidClientsToFund')
    },
    bcotSaleStockAddrFunding: {
        unitAmount: serviceConfig.get('bcotSaleStockAddrFunding.unitAmount'),
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
            initNumTxInputs: serviceConfig.get('servicePayment.spendServiceCredit.initNumTxInputs'),
            initNumTxOutputs: serviceConfig.get('servicePayment.spendServiceCredit.initNumTxOutputs'),
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
            initNumTxInputs: serviceConfig.get('servicePayment.debitServiceAccount.initNumTxInputs'),
            initNumTxOutputs: serviceConfig.get('servicePayment.debitServiceAccount.initNumTxOutputs'),
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
            unitAmount: serviceConfig.get('sysMessage.mainAddrFunding.unitAmount'),
            maxUnitsPerAddr: serviceConfig.get('sysMessage.mainAddrFunding.maxUnitsPerAddr'),
            minAddrsToFund: serviceConfig.get('sysMessage.mainAddrFunding.minAddrsToFund')
        },
        offChainMessagesSettlement: {
            minutesToConfirm: serviceConfig.get('sysMessage.offChainMessagesSettlement.minutesToConfirm')
        }
    },
    sysTxConfig: {
        sendSysMessage: {
            numInputs: serviceConfig.get('sysTxConfig.sendSysMessage.numInputs'),
            numOutputs: serviceConfig.get('sysTxConfig.sendSysMessage.numOutputs'),
            nullDataPayloadSize: serviceConfig.get('sysTxConfig.sendSysMessage.nullDataPayloadSize')
        },
        settleOffChainMessages: {
            numInputs: serviceConfig.get('sysTxConfig.settleOffChainMessages.numInputs'),
            numOutputs: serviceConfig.get('sysTxConfig.settleOffChainMessages.numOutputs'),
            nullDataPayloadSize: serviceConfig.get('sysTxConfig.settleOffChainMessages.nullDataPayloadSize')
        }
    },
    message: {
        messagesPerMinute: serviceConfig.get('message.messagesPerMinute'),
        minutesToConfirm: serviceConfig.get('message.minutesToConfirm'),
        unconfMainAddrReuses: serviceConfig.get('message.unconfMainAddrReuses'),
        readConfirmAddrAmount: serviceConfig.get('message.readConfirmAddrAmount'),
        mainAddrFunding: {
            unitAmount: serviceConfig.get('message.mainAddrFunding.unitAmount'),
            maxUnitsPerAddr: serviceConfig.get('message.mainAddrFunding.maxUnitsPerAddr'),
            minAddrsToFund: serviceConfig.get('message.mainAddrFunding.minAddrsToFund')
        },
        readConfirmation: {
            paymentResolution: serviceConfig.get('message.readConfirmation.paymentResolution'),
            initNumTxInputs: serviceConfig.get('message.readConfirmation.initNumTxInputs'),
            initNumTxOutputs: serviceConfig.get('message.readConfirmation.initNumTxOutputs'),
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
                unitAmount: serviceConfig.get('asset.issuance.assetIssueAddrFunding.unitAmount'),
                maxUnitsPerAddr: serviceConfig.get('asset.issuance.assetIssueAddrFunding.maxUnitsPerAddr'),
                minAddrsToFund: serviceConfig.get('asset.issuance.assetIssueAddrFunding.minAddrsToFund')
            }
        },
        transfer: {
            minutesToConfirm: serviceConfig.get('asset.transfer.minutesToConfirm'),
        }
    },
    serviceTxConfig: {
        logMessage: {
            numInputs: serviceConfig.get('serviceTxConfig.logMessage.numInputs'),
            numOutputs: serviceConfig.get('serviceTxConfig.logMessage.numOutputs'),
            nullDataPayloadSize: serviceConfig.get('serviceTxConfig.logMessage.nullDataPayloadSize')
        },
        sendMessage: {
            numInputs: serviceConfig.get('serviceTxConfig.sendMessage.numInputs'),
            numOutputs: serviceConfig.get('serviceTxConfig.sendMessage.numOutputs'),
            nullDataPayloadSize: serviceConfig.get('serviceTxConfig.sendMessage.nullDataPayloadSize')
        },
        sendMsgReadConfirm: {
            numInputs: serviceConfig.get('serviceTxConfig.sendMsgReadConfirm.numInputs'),
            numOutputs: serviceConfig.get('serviceTxConfig.sendMsgReadConfirm.numOutputs'),
            nullDataPayloadSize: serviceConfig.get('serviceTxConfig.sendMsgReadConfirm.nullDataPayloadSize')
        },
        issueAsset: {
            numInputs: serviceConfig.get('serviceTxConfig.issueAsset.numInputs'),
            numOutputs: serviceConfig.get('serviceTxConfig.issueAsset.numOutputs'),
            nullDataPayloadSize: serviceConfig.get('serviceTxConfig.issueAsset.nullDataPayloadSize')
        },
        transferAsset: {
            numInputs: serviceConfig.get('serviceTxConfig.transferAsset.numInputs'),
            numOutputs: serviceConfig.get('serviceTxConfig.transferAsset.numOutputs'),
            nullDataPayloadSize: serviceConfig.get('serviceTxConfig.transferAsset.nullDataPayloadSize')
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
        transferAsset: serviceConfig.get('serviceUsageWeight.transferAsset')
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
        typicalSendSystemMessageTxSize: typicalSendSystemMessageTxSize(),
        typicalSettleOffChainMessagesTxSize: typicalSettleOffChainMessagesTxSize(),
        deviceProvisionCost: deviceProvisionCost(),
        deviceMessageProvisionCost: deviceMessageProvisionCost(),
        deviceAssetProvisionCost: deviceAssetProvisionCost(),
        numActiveDeviceMainAddresses: numActiveDeviceMainAddresses(),
        numActiveDeviceAssetIssuanceAddresses: numActiveDeviceAssetIssuanceAddresses(),
        highestEstimatedServiceTxCost: highestEstimatedServiceTxCost(),
        averageEstimatedServiceTxCost: averageEstimatedServiceTxCost(),
        estimatedLogMessageTxCost: estimatedLogMessageTxCost(),
        typicalLogMessageTxSize: typicalLogMessageTxSize(),
        estimatedSendMessageTxCost: estimatedSendMessageTxCost(),
        typicalSendMessageTxSize: typicalSendMessageTxSize(),
        estimatedSendMessageReadConfirmTxCost: estimatedSendMessageReadConfirmTxCost(),
        typicalSendMessageReadConfirmTxSize: typicalSendMessageReadConfirmTxSize(),
        estimatedOffChainMsgEnvelopeCost: estimatedOffChainMsgEnvelopeCost(),
        estimatedOffChaiMsgReceiptCost: estimatedOffChaiMsgReceiptCost(),
        estimatedLogOffChainMessageCost: estimatedLogOffChainMessageCost(),
        estimatedSendOffChainMessageCost: estimatedSendOffChainMessageCost(),
        estimatedSendOffChainMessageReadConfirmCost: estimatedSendOffChainMessageReadConfirmCost(),
        estimatedIssueAssetTxCost: estimatedIssueAssetTxCost(),
        typicalIssueAssetTxSize: typicalIssueAssetTxSize(),
        estimatedTransferAssetTxCost: estimatedTransferAssetTxCost(),
        typicalTransferAssetTxSize: typicalTransferAssetTxSize(),
        highestEstimatedReadConfirmTxCostPerMessage: highestEstimatedReadConfirmTxCostPerMessage(),
        averageEstimatedReadConfirmTxCostPerMessage: averageEstimatedReadConfirmTxCostPerMessage(),
        estimatedTerminalReadConfirmTxCostPerMessage: estimatedTerminalReadConfirmTxCostPerMessage(),
        typicalTerminalReadConfirmTxSize: typicalTerminalReadConfirmTxSize(),
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
            * cfgSettings.serviceCreditIssueAddrFunding.unitAmount;
};

Service.getExpectedBcotSaleStockBalance = function () {
    return (Math.ceil(Client.activePrePaidClientsCount() * cfgSettings.bcotSaleStockAddrFunding.unitsPerPrePaidClients)
        + Math.ceil(Client.activePostPaidClientsCount() * cfgSettings.bcotSaleStockAddrFunding.unitsPerPostPaidClients))
        * cfgSettings.bcotSaleStockAddrFunding.unitAmount;
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
    let totalAmount = Util.roundToResolution(amount, cfgSettings.serviceCreditIssueAddrFunding.unitAmount);

    // Make sure that amount to fund is not below minimum
    const minFundAmount = Service.minServiceCreditIssuanceFundAmount;

    if (totalAmount < minFundAmount) {
        totalAmount = minFundAmount;
    }

    return {
        totalAmount: totalAmount,
        amountPerAddress: distributePayment(totalAmount, cfgSettings.serviceCreditIssueAddrFunding.unitAmount, cfgSettings.serviceCreditIssueAddrFunding.minUtxosToFund, cfgSettings.serviceCreditIssueAddrFunding.maxUnitsPerUtxo)
    };
};

Service.distributeBcotSaleStockFund = function (amount) {
    let totalAmount = Util.roundToResolution(amount, cfgSettings.bcotSaleStockAddrFunding.unitAmount);

    // Make sure that amount to fund is not below minimum
    const minFundAmount = Service.minBcotSaleStockFundAmount;

    if (totalAmount < minFundAmount) {
        totalAmount = minFundAmount;
    }

    return {
        totalAmount: totalAmount,
        amountPerAddress: distributePayment(totalAmount, cfgSettings.bcotSaleStockAddrFunding.unitAmount, cfgSettings.bcotSaleStockAddrFunding.minUtxosToFund, cfgSettings.bcotSaleStockAddrFunding.maxUnitsPerUtxo)
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
    let totalAmount = numActiveSystemDeviceMainAddresses() * cfgSettings.sysMessage.mainAddrFunding.unitAmount;

    return {
        totalAmount: totalAmount,
        amountPerAddress: distributePayment(totalAmount, cfgSettings.sysMessage.mainAddrFunding.unitAmount, cfgSettings.sysMessage.mainAddrFunding.minAddrsToFund, cfgSettings.sysMessage.mainAddrFunding.maxUnitsPerAddr)
    }
};

// This method should be used to fix the funding amount allocated to system main addresses due to the change
//  of the 'messagesPerMinute' and/or 'minutesToConfirm' system configuration settings (and thus the total funding
//  amount that should be allocated)
Service.distributeSystemMainAddressDeltaFund  = function (deltaAmount) {
    return distributePayment(deltaAmount, cfgSettings.sysMessage.mainAddrFunding.unitAmount, cfgSettings.sysMessage.mainAddrFunding.minAddrsToFund, cfgSettings.sysMessage.mainAddrFunding.maxUnitsPerAddr)
};

Service.distributeDeviceMainAddressFund  = function () {
    let totalAmount = numActiveDeviceMainAddresses() * cfgSettings.message.mainAddrFunding.unitAmount;

    return {
        totalAmount: totalAmount,
        amountPerAddress: distributePayment(totalAmount, cfgSettings.message.mainAddrFunding.unitAmount, cfgSettings.message.mainAddrFunding.minAddrsToFund, cfgSettings.message.mainAddrFunding.maxUnitsPerAddr)
    };
};

// This method should be used to fix the funding amount allocated to a device's main addresses due to the change
//  of the 'messagesPerMinute' and/or 'minutesToConfirm' system configuration settings (and thus the total funding
//  amount that should be allocated)
Service.distributeDeviceMainAddressDeltaFund  = function (deltaAmount) {
    return distributePayment(deltaAmount, cfgSettings.message.mainAddrFunding.unitAmount, cfgSettings.message.mainAddrFunding.minAddrsToFund, cfgSettings.message.mainAddrFunding.maxUnitsPerAddr)
};

Service.distributeDeviceAssetIssuanceAddressFund = function () {
    let totalAmount = numActiveDeviceAssetIssuanceAddresses() * cfgSettings.asset.issuance.assetIssueAddrFunding.unitAmount;

    return {
        totalAmount: totalAmount,
        amountPerAddress: distributePayment(totalAmount, cfgSettings.asset.issuance.assetIssueAddrFunding.unitAmount, cfgSettings.asset.issuance.assetIssueAddrFunding.minAddrsToFund, cfgSettings.asset.issuance.assetIssueAddrFunding.maxUnitsPerAddr)
    };
};
// This method should be used to fix the funding amount allocated to a device's main addresses due to the change
//  of the 'messagesPerMinute' and/or 'minutesToConfirm' system configuration settings (and thus the total funding
//  amount that should be allocated)
Service.distributeDeviceAssetIssuanceAddressDeltaFund  = function (deltaAmount) {
    return distributePayment(deltaAmount, cfgSettings.asset.issuance.assetIssueAddrFunding.unitAmount, cfgSettings.asset.issuance.assetIssueAddrFunding.minAddrsToFund, cfgSettings.asset.issuance.assetIssueAddrFunding.maxUnitsPerAddr)
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
    log_message: Object.freeze({
        name: 'log_message',
        label: 'Log Message',
        description: 'Record a message onto the blockchain',
        costFunction: estimatedLogMessageTxCost
    }),
    log_off_chain_message: Object.freeze({
        name: 'log_off_chain_message',
        label: 'Log Off-Chain Message',
        description: 'Record a message off-chain and later settle it to the blockchain',
        costFunction: estimatedLogOffChainMessageCost
    }),
    send_message: Object.freeze({
        name: 'send_message',
        label: 'Send Message',
        description: 'Record a message onto the blockchain addressing it to another device (with no read confirmation)',
        costFunction: estimatedSendMessageTxCost
    }),
    send_off_chain_message: Object.freeze({
        name: 'send_off_chain_message',
        label: 'Send Off-Chain Message',
        description: 'Record a message off-chain addressing it to another device (with no read confirmation) and later settle it to the blockchain',
        costFunction: estimatedSendOffChainMessageCost
    }),
    send_msg_read_confirm: Object.freeze({
        name: 'send_msg_read_confirm',
        label: 'Send Message w/Read Confirmation',
        description: 'Record a message onto the blockchain addressing it to another device, requesting to receive a read confirm',
        costFunction: estimatedSendMessageReadConfirmTxCost
    }),
    send_off_chain_msg_read_confirm: Object.freeze({
        name: 'send_off_chain_msg_read_confirm',
        label: 'Send Off-Chain Message w/Read Confirmation',
        description: 'Record a message off-chain addressing it to another device, requesting to receive a read confirm, and later settle it to the blockchain',
        costFunction: estimatedSendOffChainMessageReadConfirmCost
    }),
    issue_asset: Object.freeze({
        name: 'issue_asset',
        label: 'Issue Asset',
        description: 'Issue an amount of a new Catenis asset',
        costFunction: estimatedIssueAssetTxCost
    }),
    transfer_asset: Object.freeze({
        name: 'transfer_asset',
        label: 'Transfer Asset',
        description: 'Transfer an amount of a Catenis asset to another device',
        costFunction: estimatedTransferAssetTxCost
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
    return Util.roundToResolution(typicalSendSystemMessageTxSize() * Catenis.bitcoinFees.getFeeRateByTime(cfgSettings.sysMessage.minutesToConfirm), cfgSettings.paymentResolution);
}

function estimatedSettleOffChainMessagesTxCost() {
    return Util.roundToResolution(typicalSettleOffChainMessagesTxSize() * Service.feeRateForOffChainMsgsSettlement, cfgSettings.paymentResolution);
}

function typicalSendSystemMessageTxSize() {
    return Transaction.computeTransactionSize(cfgSettings.sysTxConfig.sendSysMessage.numInputs, cfgSettings.sysTxConfig.sendSysMessage.numOutputs, cfgSettings.sysTxConfig.sendSysMessage.nullDataPayloadSize);
}

function typicalSettleOffChainMessagesTxSize() {
    return Transaction.computeTransactionSize(cfgSettings.sysTxConfig.settleOffChainMessages.numInputs, cfgSettings.sysTxConfig.settleOffChainMessages.numOutputs, cfgSettings.sysTxConfig.settleOffChainMessages.nullDataPayloadSize);
}

function deviceProvisionCost() {
    // Includes cost to fund device main addresses and asset issuance addresses
    return deviceMessageProvisionCost() + deviceAssetProvisionCost();
}

function deviceMessageProvisionCost() {
    return numActiveDeviceMainAddresses() * cfgSettings.message.mainAddrFunding.unitAmount;
}

function deviceAssetProvisionCost() {
    return numActiveDeviceAssetIssuanceAddresses() * cfgSettings.asset.issuance.assetIssueAddrFunding.unitAmount;
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
        estimatedTransferAssetTxCost()
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
        estimatedTransferAssetTxCost()
    ], [
        cfgSettings.serviceUsageWeight.logMessage,
        cfgSettings.serviceUsageWeight.sendMessage,
        cfgSettings.serviceUsageWeight.sendMsgReadConfirm,
        cfgSettings.serviceUsageWeight.logOffChainMessage,
        cfgSettings.serviceUsageWeight.sendOffChainMessage,
        cfgSettings.serviceUsageWeight.sendOffChainMsgReadConfirm,
        cfgSettings.serviceUsageWeight.issueAsset,
        cfgSettings.serviceUsageWeight.transferAsset
    ]), cfgSettings.paymentResolution);
}

function estimatedLogMessageTxCost() {
    return Util.roundToResolution(typicalLogMessageTxSize() * Catenis.bitcoinFees.getFeeRateByTime(cfgSettings.message.minutesToConfirm), cfgSettings.paymentResolution);
}

function typicalLogMessageTxSize() {
    return Transaction.computeTransactionSize(cfgSettings.serviceTxConfig.logMessage.numInputs, cfgSettings.serviceTxConfig.logMessage.numOutputs, cfgSettings.serviceTxConfig.logMessage.nullDataPayloadSize);
}

function estimatedSendMessageTxCost() {
    return Util.roundToResolution(typicalSendMessageTxSize() * Catenis.bitcoinFees.getFeeRateByTime(cfgSettings.message.minutesToConfirm), cfgSettings.paymentResolution);
}

function typicalSendMessageTxSize() {
    return Transaction.computeTransactionSize(cfgSettings.serviceTxConfig.sendMessage.numInputs, cfgSettings.serviceTxConfig.sendMessage.numOutputs, cfgSettings.serviceTxConfig.sendMessage.nullDataPayloadSize);
}

function estimatedSendMessageReadConfirmTxCost() {
    return Util.roundToResolution(typicalSendMessageReadConfirmTxSize() * Catenis.bitcoinFees.getFeeRateByTime(cfgSettings.message.minutesToConfirm), cfgSettings.paymentResolution);
}

function typicalSendMessageReadConfirmTxSize() {
    return Transaction.computeTransactionSize(cfgSettings.serviceTxConfig.sendMsgReadConfirm.numInputs, cfgSettings.serviceTxConfig.sendMsgReadConfirm.numOutputs, cfgSettings.serviceTxConfig.sendMsgReadConfirm.nullDataPayloadSize);
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
    return Util.roundToResolution(typicalIssueAssetTxSize() * Catenis.bitcoinFees.getFeeRateByTime(cfgSettings.asset.issuance.minutesToConfirm), cfgSettings.paymentResolution);
}

function typicalIssueAssetTxSize() {
    return Transaction.computeTransactionSize(cfgSettings.serviceTxConfig.issueAsset.numInputs, cfgSettings.serviceTxConfig.issueAsset.numOutputs, cfgSettings.serviceTxConfig.issueAsset.nullDataPayloadSize);
}

function estimatedTransferAssetTxCost() {
    return Util.roundToResolution(typicalTransferAssetTxSize() * Catenis.bitcoinFees.getFeeRateByTime(cfgSettings.asset.transfer.minutesToConfirm), cfgSettings.paymentResolution);
}

function typicalTransferAssetTxSize() {
    return Transaction.computeTransactionSize(cfgSettings.serviceTxConfig.transferAsset.numInputs, cfgSettings.serviceTxConfig.transferAsset.numOutputs, cfgSettings.serviceTxConfig.transferAsset.nullDataPayloadSize);
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
    const typicalTxCost = Util.roundToResolution(typicalTerminalReadConfirmTxSize() * Catenis.bitcoinFees.getFeeRateByTime(cfgSettings.message.readConfirmation.terminalReadConfirmTx.minutesToConfirm), cfgSettings.message.readConfirmation.paymentResolution);

    return Util.roundToResolution(typicalTxCost / cfgSettings.message.readConfirmation.terminalReadConfirmTx.typicalTxConfig.numMessagesConfirmed, cfgSettings.message.readConfirmation.paymentResolution);
}

function typicalTerminalReadConfirmTxSize() {
    return Transaction.computeTransactionSize(numInputsTerminalReadConfirmTx(), numOutputsTerminalReadConfirmTx(), cfgSettings.message.readConfirmation.terminalReadConfirmTx.typicalTxConfig.nullDataPayloadSize);
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
            paymentResolution: cfgSettings.message.readConfirmation.paymentResolution,
            initNumTxInputs: cfgSettings.message.readConfirmation.initNumTxInputs,
            initNumTxOutputs: cfgSettings.message.readConfirmation.initNumTxOutputs,
            initTxNullDataPayloadSize: cfgSettings.message.readConfirmation.txNullDataPayloadSize,
            txFeeRateIncrement: cfgSettings.message.readConfirmation.txFeeRateIncrement,
            initTxFeeRate: cfgSettings.message.readConfirmation.initTxFeeRate
        });
        const maxUnitsPayTxExp = Math.floor(cfgSettings.readConfirmPayTxExpenseFunding.maxUnitsPerAddr * cfgSettings.message.readConfirmation.percMaxUnitsPayTxExp);

        do {
            numMsgs++;

            if (numMsgs > 1) {
                // Add one more tx input to spend a new read confirmation output
                readConfirmTxInfo.incrementNumTxInputs(1);

                if (numMsgs % maxUnitsPayTxExp === 0) {
                    // Add one more tx input to pay for tx fee
                    readConfirmTxInfo.incrementNumTxInputs(1);
                }

                if (numMsgs <= 3) {
                    // Add one more tx output for paying spent read confirmation outputs to both
                    //  system read confirmation spend only and system read confirmation spend null addresses
                    readConfirmTxInfo.incrementNumTxOutputs(1);
                }

                if (numMsgs % cfgSettings.message.readConfirmation.txInputOutputGrowthRatio === 0) {
                    // Add one more tx output for paying spent read confirmation outputs to
                    //  system read confirmation spend notify address of a different Catenis node
                    readConfirmTxInfo.incrementNumTxOutputs(1);
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
        getServicePrice(Service.clientPaidService.transfer_asset).finalServicePrice
    ], [
        cfgSettings.serviceUsageWeight.logMessage,
        cfgSettings.serviceUsageWeight.sendMessage,
        cfgSettings.serviceUsageWeight.sendMsgReadConfirm,
        cfgSettings.serviceUsageWeight.logOffChainMessage,
        cfgSettings.serviceUsageWeight.sendOffChainMessage,
        cfgSettings.serviceUsageWeight.sendOffChainMsgReadConfirm,
        cfgSettings.serviceUsageWeight.issueAsset,
        cfgSettings.serviceUsageWeight.transferAsset
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
            paymentResolution: cfgSettings.servicePayment.paymentResolution,
            initNumTxInputs: cfgSettings.servicePayment.spendServiceCredit.initNumTxInputs,
            initNumTxOutputs: cfgSettings.servicePayment.spendServiceCredit.initNumTxOutputs,
            initNumPubKeysMultiSigTxOutputs: cfgSettings.servicePayment.spendServiceCredit.initNumPubKeysMultiSigTxOutputs,
            initTxNullDataPayloadSize: cfgSettings.servicePayment.spendServiceCredit.txNullDataPayloadSize,
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

                    spendServCredTxInfo.incrementNumTxInputs(1);
                    spendServCredTxInfo.incrementNumTxOutputs(1);

                    if (servsPerClient.length === cfgSettings.servicePayment.spendServiceCredit.numClientsMultiSigOutput) {
                        // Add multi-signature output
                        spendServCredTxInfo.addMultiSigOutput(3);
                    }

                    txChanged = true;
                }

                if (++servsPerClient[clientIdx] % cfgSettings.servicePayment.spendServiceCredit.maxServsPerClientInput === 0) {
                    // Add a new client service account credit line address input
                    spendServCredTxInfo.incrementNumTxInputs(1);

                    txChanged = true;
                }

                if (numServs % maxUnitsPayTxExp === 0) {
                    // Add one more tx input to pay for tx fee
                    spendServCredTxInfo.incrementNumTxInputs(1);

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
        const spendServCredTxInfo = new RbfTransactionInfo({
            paymentResolution: cfgSettings.servicePayment.paymentResolution,
            initNumTxInputs: cfgSettings.servicePayment.debitServiceAccount.initNumTxInputs,
            initNumTxOutputs: cfgSettings.servicePayment.debitServiceAccount.initNumTxOutputs,
            initNumPubKeysMultiSigTxOutputs: cfgSettings.servicePayment.debitServiceAccount.initNumPubKeysMultiSigTxOutputs,
            initTxNullDataPayloadSize: cfgSettings.servicePayment.debitServiceAccount.txNullDataPayloadSize,
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

                    spendServCredTxInfo.incrementNumTxOutputs(1);

                    if (servsPerClient.length === cfgSettings.servicePayment.debitServiceAccount.numClientsMultiSigOutput) {
                        // Add multi-signature output
                        spendServCredTxInfo.addMultiSigOutput(3);
                    }

                    txChanged = true;
                }

                ++servsPerClient[clientIdx];

                if (numServs % maxUnitsPayTxExp === 0) {
                    // Add one more tx input to pay for tx fee
                    spendServCredTxInfo.incrementNumTxInputs(1);

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
//   paidService: [String] - Catenis client paid service. One of the properties of Service.clientPaidService
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
            return cfgSettings.message.mainAddrFunding.unitAmount;
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
            return cfgSettings.message.readConfirmAddrAmount;
        },
        enumerable: true
    },
    devAssetIssuanceAddrAmount: {
        get: function () {
            return cfgSettings.asset.issuance.assetIssueAddrFunding.unitAmount;
        },
        enumerable: true
    },
    readConfirmInitNumTxInputs: {
        get: function () {
            return cfgSettings.message.readConfirmation.initNumTxInputs;
        },
        enumerable: true
    },
    readConfirmInitNumTxOutputs: {
        get: function () {
            return cfgSettings.message.readConfirmation.initNumTxOutputs;
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
    serviceCreditIssuanceAddrAmount: {
        get: function () {
            return cfgSettings.serviceCreditIssueAddrFunding.unitAmount;
        },
        enumerable: true
    },
    bcotSaleStockAddrAmount: {
        get: function () {
            return cfgSettings.bcotSaleStockAddrFunding.unitAmount;
        },
        enumerable: true
    },
    minServiceCreditIssuanceFundAmount: {
        get: function () {
            return (Math.ceil(cfgSettings.serviceCreditIssueAddrFunding.prePaidClientsToFund * cfgSettings.serviceCreditIssueAddrFunding.unitsPerPrePaidClients)
                + Math.ceil(cfgSettings.serviceCreditIssueAddrFunding.postPaidClientsToFund * cfgSettings.serviceCreditIssueAddrFunding.unitsPerPostPaidClients))
                * cfgSettings.serviceCreditIssueAddrFunding.unitAmount;
        },
        enumerable: true
    },
    minBcotSaleStockFundAmount: {
        get: function () {
            return (Math.ceil(cfgSettings.bcotSaleStockAddrFunding.prePaidClientsToFund * cfgSettings.bcotSaleStockAddrFunding.unitsPerPrePaidClients)
                + Math.ceil(cfgSettings.bcotSaleStockAddrFunding.postPaidClientsToFund * cfgSettings.bcotSaleStockAddrFunding.unitsPerPostPaidClients))
                * cfgSettings.bcotSaleStockAddrFunding.unitAmount;
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
    deviceAssetProvisionCost: {
        get: function () {
            return deviceAssetProvisionCost();
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
    }
});

// Lock function class
Object.freeze(Service);
