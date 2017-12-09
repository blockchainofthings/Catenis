/**
 * Created by claudio on 30/06/16.
 */

//console.log('[Service.js]: This code just ran.');

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
import { BcotPayment } from './BcotPayment';

// Config entries
const serviceConfig = config.get('service');
const servSysFundConfig = serviceConfig.get('systemFunding');
const servServCreditIssueAddrFundConfig = serviceConfig.get('serviceCreditIssueAddrFunding');
const servServAccFundConfig = serviceConfig.get('serviceAccountFunding');
const servPayTxExpFundConfig = serviceConfig.get('payTxExpenseFunding');
const servReadConfPayTxExpFundConfig = serviceConfig.get('readConfirmPayTxExpenseFunding');
const servSrvPymtPayTxExpFundConfig = serviceConfig.get('servicePaymentPayTxExpenseFunding');
const servServPayConfig = serviceConfig.get('servicePayment');
const srvServPaySpendServCredConfig = servServPayConfig.get('spendServiceCredit');
const srvServPayDebtServAccConfig = servServPayConfig.get('debitServiceAccount');
const srvSysMessageConfig = serviceConfig.get('sysMessage');
const srvSysMsgMainAddrFundConfig = srvSysMessageConfig.get('mainAddrFunding');
const srvSysTxCfgConfig = serviceConfig.get('sysTxConfig');
const srvSysTxCfgSendSysMsgConfig = srvSysTxCfgConfig.get('sendSysMessage');
const srvMessageConfig = serviceConfig.get('message');
const srvMsgMainAddrFundConfig = srvMessageConfig.get('mainAddrFunding');
const srvMsgReadConfirmConfig = srvMessageConfig.get('readConfirmation');
const srvMsgReadConfTerminalTxConfig = srvMsgReadConfirmConfig.get('terminalReadConfirmTx');
const srvMsgReadConfUseWeightConfig = srvMsgReadConfirmConfig.get('usageWeight');
const srvMsgReadConfTermTxTypTxCfgConfig = srvMsgReadConfTerminalTxConfig.get('typicalTxConfig');
const srvAssetConfig = serviceConfig.get('asset');
const srvAssetIssuanceConfig = srvAssetConfig.get('issuance');
const srvAsstIssuAssetIssueAddrFundConfig = srvAssetIssuanceConfig.get('assetIssueAddrFunding');
const srvAssetTransferConfig = srvAssetConfig.get('transfer');
const srvServTxCfgConfig = serviceConfig.get('serviceTxConfig');
const srvServTxCfgLogMsgConfig = srvServTxCfgConfig.get('logMessage');
const srvServTxCfgSendMsgConfig = srvServTxCfgConfig.get('sendMessage');
const srvServTxCfgSendMsgRdCfConfig = srvServTxCfgConfig.get('sendMsgReadConfirm');
const srvServTxCfgIssueLockAssetConfig = srvServTxCfgConfig.get('issueLockedAsset');
const srvServTxCfgIssueUnlockAssetConfig = srvServTxCfgConfig.get('issueUnlockedAsset');
const srvServTxCfgTransfAssetConfig = srvServTxCfgConfig.get('transferAsset');
const srvServUseWeightConfig = serviceConfig.get('serviceUsageWeight');

// Configuration settings
const cfgSettings = {
    priceMarkup: serviceConfig.get('priceMarkup'),
    servicePriceResolution: serviceConfig.get('servicePriceResolution'),
    paymentResolution: serviceConfig.get('paymentResolution'),
    systemFunding: {
        clientsToFund: servSysFundConfig.get('clientsToFund'),
        devicesPerClientToFund: servSysFundConfig.get('devicesPerClientToFund'),
        multiplyFactor: servSysFundConfig.get('multiplyFactor')
    },
    serviceCreditIssueAddrFunding: {
        unitAmount: servServCreditIssueAddrFundConfig.get('unitAmount'),
        maxUnitsPerUtxo: servServCreditIssueAddrFundConfig.get('maxUnitsPerUtxo'),
        minUtxosToFund: servServCreditIssueAddrFundConfig.get('minUtxosToFund'),
        unitsPerPrePaidClients: servServCreditIssueAddrFundConfig.get('unitsPerPrePaidClients'),
        unitsPerPostPaidClients: servServCreditIssueAddrFundConfig.get('unitsPerPostPaidClients'),
        prePaidClientsToFund: servServCreditIssueAddrFundConfig.get('prePaidClientsToFund'),
        postPaidClientsToFund: servServCreditIssueAddrFundConfig.get('postPaidClientsToFund')
    },
    serviceAccountFunding: {
        unitAmountSafetyFactor: servServAccFundConfig.get('unitAmountSafetyFactor'),
        maxUnitsPerAddr: servServAccFundConfig.get('maxUnitsPerAddr'),
        minAddrsToFund: servServAccFundConfig.get('minAddrsToFund')
    },
    payTxExpenseFunding: {
        unitAmountSafetyFactor: servPayTxExpFundConfig.get('unitAmountSafetyFactor'),
        maxUnitsPerAddr: servPayTxExpFundConfig.get('maxUnitsPerAddr'),
        minAddrsToFund: servPayTxExpFundConfig.get('minAddrsToFund'),
        balanceSafetyFactor: servPayTxExpFundConfig.get('balanceSafetyFactor'),
        minBalanceSysMessages: servPayTxExpFundConfig.get('minBalanceSysMessages'),
        minBalanceServicesPerDevice: servPayTxExpFundConfig.get('minBalanceServicesPerDevice'),
        sysMessagesToFund: servPayTxExpFundConfig.get('sysMessagesToFund'),
        devicesToFund: servPayTxExpFundConfig.get('devicesToFund')
    },
    readConfirmPayTxExpenseFunding: {
        unitAmountSafetyFactor: servReadConfPayTxExpFundConfig.get('unitAmountSafetyFactor'),
        maxUnitsPerAddr: servReadConfPayTxExpFundConfig.get('maxUnitsPerAddr'),
        minAddrsToFund: servReadConfPayTxExpFundConfig.get('minAddrsToFund'),
        balanceSafetyFactor: servReadConfPayTxExpFundConfig.get('balanceSafetyFactor'),
        minBalanceMessagesToConfirm: servReadConfPayTxExpFundConfig.get('minBalanceMessagesToConfirm'),
        messagesToConfirmToFund: servReadConfPayTxExpFundConfig.get('messagesToConfirmToFund')
    },
    servicePaymentPayTxExpenseFunding: {
        unitAmountSafetyFactor: servSrvPymtPayTxExpFundConfig.get('unitAmountSafetyFactor'),
        maxUnitsPerAddr: servSrvPymtPayTxExpFundConfig.get('maxUnitsPerAddr'),
        minAddrsToFund: servSrvPymtPayTxExpFundConfig.get('minAddrsToFund'),
        balanceSafetyFactor: servSrvPymtPayTxExpFundConfig.get('balanceSafetyFactor'),
        minBalancePrePaidServices: servSrvPymtPayTxExpFundConfig.get('minBalancePrePaidServices'),
        minBalancePostPaidServices: servSrvPymtPayTxExpFundConfig.get('minBalancePostPaidServices'),
        servicesToPayToFund: servSrvPymtPayTxExpFundConfig.get('servicesToPayToFund')
    },
    servicePayment: {
        paymentResolution: servServPayConfig.get('paymentResolution'),
        spendServiceCredit: {
            initNumTxInputs: srvServPaySpendServCredConfig.get('initNumTxInputs'),
            initNumTxOutputs: srvServPaySpendServCredConfig.get('initNumTxOutputs'),
            initNumPubKeysMultiSigTxOutputs: srvServPaySpendServCredConfig.get('initNumPubKeysMultiSigTxOutputs'),
            txNullDataPayloadSize: srvServPaySpendServCredConfig.get('txNullDataPayloadSize'),
            maxNumClients: srvServPaySpendServCredConfig.get('maxNumClients'),
            servsDistribPerClient: srvServPaySpendServCredConfig.get('servsDistribPerClient'),
            maxServsPerClientInput: srvServPaySpendServCredConfig.get('maxServsPerClientInput'),
            numClientsMultiSigOutput: srvServPaySpendServCredConfig.get('numClientsMultiSigOutput'),
            percMaxUnitsPayTxExp: srvServPaySpendServCredConfig.get('percMaxUnitsPayTxExp'),
            initTxFeeRate: srvServPaySpendServCredConfig.get('initTxFeeRate'),
            txFeeRateIncrement: srvServPaySpendServCredConfig.get('txFeeRateIncrement')
        },
        debitServiceAccount: {
            initNumTxInputs: srvServPayDebtServAccConfig.get('initNumTxInputs'),
            initNumTxOutputs: srvServPayDebtServAccConfig.get('initNumTxOutputs'),
            initNumPubKeysMultiSigTxOutputs: srvServPayDebtServAccConfig.get('initNumPubKeysMultiSigTxOutputs'),
            txNullDataPayloadSize: srvServPayDebtServAccConfig.get('txNullDataPayloadSize'),
            maxNumClients: srvServPayDebtServAccConfig.get('maxNumClients'),
            servsDistribPerClient: srvServPayDebtServAccConfig.get('servsDistribPerClient'),
            numClientsMultiSigOutput: srvServPayDebtServAccConfig.get('numClientsMultiSigOutput'),
            percMaxUnitsPayTxExp: srvServPayDebtServAccConfig.get('percMaxUnitsPayTxExp'),
            initTxFeeRate: srvServPayDebtServAccConfig.get('initTxFeeRate'),
            txFeeRateIncrement: srvServPayDebtServAccConfig.get('txFeeRateIncrement')
        }
    },
    sysMessage: {
        messagesPerMinute: srvSysMessageConfig.get('messagesPerMinute'),
        minutesToConfirm: srvSysMessageConfig.get('minutesToConfirm'),
        unconfMainAddrReuses: srvSysMessageConfig.get('unconfMainAddrReuses'),
        mainAddrFunding: {
            unitAmount: srvSysMsgMainAddrFundConfig.get('unitAmount'),
            maxUnitsPerAddr: srvSysMsgMainAddrFundConfig.get('maxUnitsPerAddr'),
            minAddrsToFund: srvSysMsgMainAddrFundConfig.get('minAddrsToFund')
        }
    },
    sysTxConfig: {
        sendSysMessage: {
            numInputs: srvSysTxCfgSendSysMsgConfig.get('numInputs'),
            numOutputs: srvSysTxCfgSendSysMsgConfig.get('numOutputs'),
            nullDataPayloadSize: srvSysTxCfgSendSysMsgConfig.get('nullDataPayloadSize')
        }
    },
    message: {
        messagesPerMinute: srvMessageConfig.get('messagesPerMinute'),
        minutesToConfirm: srvMessageConfig.get('minutesToConfirm'),
        unconfMainAddrReuses: srvMessageConfig.get('unconfMainAddrReuses'),
        readConfimAddrAmount: srvMessageConfig.get('readConfimAddrAmount'),
        mainAddrFunding: {
            unitAmount: srvMsgMainAddrFundConfig.get('unitAmount'),
            maxUnitsPerAddr: srvMsgMainAddrFundConfig.get('maxUnitsPerAddr'),
            minAddrsToFund: srvMsgMainAddrFundConfig.get('minAddrsToFund')
        },
        readConfirmation: {
            paymentResolution: srvMsgReadConfirmConfig.get('paymentResolution'),
            initNumTxInputs: srvMsgReadConfirmConfig.get('initNumTxInputs'),
            initNumTxOutputs: srvMsgReadConfirmConfig.get('initNumTxOutputs'),
            txNullDataPayloadSize: srvMsgReadConfirmConfig.get('txNullDataPayloadSize'),
            txInputOutputGrowthRatio: srvMsgReadConfirmConfig.get('txInputOutputGrowthRatio'),
            percMaxUnitsPayTxExp: srvMsgReadConfirmConfig.get('percMaxUnitsPayTxExp'),
            initTxFeeRate: srvMsgReadConfirmConfig.get('initTxFeeRate'),
            txFeeRateIncrement: srvMsgReadConfirmConfig.get('txFeeRateIncrement'),
            terminalReadConfirmTx: {
                minutesToConfirm: srvMsgReadConfTerminalTxConfig.get('minutesToConfirm'),
                typicalTxConfig: {
                    numMessagesConfirmed: srvMsgReadConfTermTxTypTxCfgConfig.get('numMessagesConfirmed'),
                    numPayTxExpenseInputs: srvMsgReadConfTermTxTypTxCfgConfig.get('numPayTxExpenseInputs'),
                    hasChangeOutput: srvMsgReadConfTermTxTypTxCfgConfig.get('hasChangeOutput'),
                    nullDataPayloadSize: srvMsgReadConfTermTxTypTxCfgConfig.get('nullDataPayloadSize')
                }
            },
            usageWeight: {
                regular: srvMsgReadConfUseWeightConfig.get('regular'),
                terminal: srvMsgReadConfUseWeightConfig.get('terminal')
            }
        }
    },
    asset: {
        issuance: {
            unlockedAssetsPerMinute: srvAssetIssuanceConfig.get('unlockedAssetsPerMinute'),
            minutesToConfirm: srvAssetIssuanceConfig.get('minutesToConfirm'),
            unconfAssetIssueAddrReuses: srvAssetIssuanceConfig.get('unconfAssetIssueAddrReuses'),
            assetIssueAddrFunding: {
                unitAmount: srvAsstIssuAssetIssueAddrFundConfig.get('unitAmount'),
                maxUnitsPerAddr: srvAsstIssuAssetIssueAddrFundConfig.get('maxUnitsPerAddr'),
                minAddrsToFund: srvAsstIssuAssetIssueAddrFundConfig.get('minAddrsToFund')
            }
        },
        transfer: {
            minutesToConfirm: srvAssetTransferConfig.get('minutesToConfirm'),
        }
    },
    serviceTxConfig: {
        logMessage: {
            numInputs: srvServTxCfgLogMsgConfig.get('numInputs'),
            numOutputs: srvServTxCfgLogMsgConfig.get('numOutputs'),
            nullDataPayloadSize: srvServTxCfgLogMsgConfig.get('nullDataPayloadSize')
        },
        sendMessage: {
            numInputs: srvServTxCfgSendMsgConfig.get('numInputs'),
            numOutputs: srvServTxCfgSendMsgConfig.get('numOutputs'),
            nullDataPayloadSize: srvServTxCfgSendMsgConfig.get('nullDataPayloadSize')
        },
        sendMsgReadConfirm: {
            numInputs: srvServTxCfgSendMsgRdCfConfig.get('numInputs'),
            numOutputs: srvServTxCfgSendMsgRdCfConfig.get('numOutputs'),
            nullDataPayloadSize: srvServTxCfgSendMsgRdCfConfig.get('nullDataPayloadSize')
        },
        issueLockedAsset: {
            numInputs: srvServTxCfgIssueLockAssetConfig.get('numInputs'),
            numOutputs: srvServTxCfgIssueLockAssetConfig.get('numOutputs'),
            nullDataPayloadSize: srvServTxCfgIssueLockAssetConfig.get('nullDataPayloadSize')
        },
        issueUnlockedAsset: {
            numInputs: srvServTxCfgIssueUnlockAssetConfig.get('numInputs'),
            numOutputs: srvServTxCfgIssueUnlockAssetConfig.get('numOutputs'),
            nullDataPayloadSize: srvServTxCfgIssueUnlockAssetConfig.get('nullDataPayloadSize')
        },
        transferAsset: {
            numInputs: srvServTxCfgTransfAssetConfig.get('numInputs'),
            numOutputs: srvServTxCfgTransfAssetConfig.get('numOutputs'),
            nullDataPayloadSize: srvServTxCfgTransfAssetConfig.get('nullDataPayloadSize')
        }
    },
    serviceUsageWeight: {
        logMessage: srvServUseWeightConfig.get('logMessage'),
        sendMessage: srvServUseWeightConfig.get('sendMessage'),
        sendMsgReadConfirm: srvServUseWeightConfig.get('sendMsgReadConfirm'),
        issueLockedAsset: srvServUseWeightConfig.get('issueLockedAsset'),
        issueUnlockedAsset: srvServUseWeightConfig.get('issueUnlockedAsset'),
        transferAsset: srvServUseWeightConfig.get('transferAsset')
    },
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
        typicalSendSystemMessageTxSize: typicalSendSystemMessageTxSize(),
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
        estimatedIssueLockedAssetTxCost: estimatedIssueLockedAssetTxCost(),
        typicalIssueLockedAssetTxSize: typicalIssueLockedAssetTxSize(),
        estimatedIssueUnlockedAssetTxCost: estimatedIssueUnlockedAssetTxCost(),
        typicalIssueUnlockedAssetTxSize: typicalIssueUnlockedAssetTxSize(),
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

Service.getMinimumPayTxExpenseBalance = function () {
    return estimatedSendSystemMessageTxCost() * cfgSettings.payTxExpenseFunding.minBalanceSysMessages + averageEstimatedServiceTxCost() * cfgSettings.payTxExpenseFunding.minBalanceServicesPerDevice * Device.activeDevicesCount();
};

Service.getExpectedReadConfirmPayTxExpenseBalance = function (unreadMessages) {
    return _.max([unreadMessages, cfgSettings.readConfirmPayTxExpenseFunding.minBalanceMessagesToConfirm]) * averageEstimatedReadConfirmTxCostPerMessage();
};

Service.getExpectedServicePaymentPayTxExpenseBalance = function () {
    return _.max([numPrePaidServices(), cfgSettings.servicePaymentPayTxExpenseFunding.minBalancePrePaidServices]) * averageSpendServCredTxCostPerService() + cfgSettings.servicePaymentPayTxExpenseFunding.minBalancePostPaidServices * averageDebitServAccountTxCostPerService();
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

    return {
        totalAmount: totalAmount,
        amountPerAddress: distributePayment(totalAmount, fundUnitAmount, cfgSettings.payTxExpenseFunding.minAddrsToFund, cfgSettings.payTxExpenseFunding.maxUnitsPerAddr)
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

    return {
        totalAmount: totalAmount,
        amountPerAddress: distributePayment(totalAmount, fundUnitAmount, cfgSettings.readConfirmPayTxExpenseFunding.minAddrsToFund, cfgSettings.readConfirmPayTxExpenseFunding.maxUnitsPerAddr)
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

    return {
        totalAmount: totalAmount,
        amountPerAddress: distributePayment(totalAmount, fundUnitAmount, cfgSettings.servicePaymentPayTxExpenseFunding.minAddrsToFund, cfgSettings.servicePaymentPayTxExpenseFunding.maxUnitsPerAddr)
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
//    exchangeRate: [Number], - Bitcoin to BCOT token exchange rate used to calculate final price
//    finalServicePrice: [Number] - Price charged for the service expressed in Catenis service credit's lowest units
//  }
Service.logMessageServicePrice = function () {
    return getServicePrice(Service.clientPaidService.log_message);
};

// Returns price data for Send Message (with no read confirmation) service
//
//  Return: {
//    estimatedServiceCost: [Number], - Estimated cost, in satoshis, of the service
//    priceMarkup: [Number], - Markup used to calculate the price of the service
//    btcServicePrice: [Number], - Price of the service expressed in (bitcoin) satoshis
//    exchangeRate: [Number], - Bitcoin to BCOT token exchange rate used to calculate final price
//    finalServicePrice: [Number] - Price charged for the service expressed in Catenis service credit's lowest units
//  }
Service.sendMessageServicePrice = function () {
    return getServicePrice(Service.clientPaidService.send_message);
};

// Returns price data for Send Message with Read Confirmation service
//
//  Return: {
//    estimatedServiceCost: [Number], - Estimated cost, in satoshis, of the service
//    priceMarkup: [Number], - Markup used to calculate the price of the service
//    btcServicePrice: [Number], - Price of the service expressed in (bitcoin) satoshis
//    exchangeRate: [Number], - Bitcoin to BCOT token exchange rate used to calculate final price
//    finalServicePrice: [Number] - Price charged for the service expressed in Catenis service credit's lowest units
//  }
Service.sendMsgReadConfirmServicePrice = function () {
    return getServicePrice(Service.clientPaidService.send_msg_read_confirm);
};

// Returns price data for Issue Locked Asset service
//
//  Return: {
//    estimatedServiceCost: [Number], - Estimated cost, in satoshis, of the service
//    priceMarkup: [Number], - Markup used to calculate the price of the service
//    btcServicePrice: [Number], - Price of the service expressed in (bitcoin) satoshis
//    exchangeRate: [Number], - Bitcoin to BCOT token exchange rate used to calculate final price
//    finalServicePrice: [Number] - Price charged for the service expressed in Catenis service credit's lowest units
//  }
Service.issueLockedAssetServicePrice = function () {
    return getServicePrice(Service.clientPaidService.issue_locked_asset);
};

// Returns price data for Issue Unlocked Asset service
//
//  Return: {
//    estimatedServiceCost: [Number], - Estimated cost, in satoshis, of the service
//    priceMarkup: [Number], - Markup used to calculate the price of the service
//    btcServicePrice: [Number], - Price of the service expressed in (bitcoin) satoshis
//    exchangeRate: [Number], - Bitcoin to BCOT token exchange rate used to calculate final price
//    finalServicePrice: [Number] - Price charged for the service expressed in Catenis service credit's lowest units
//  }
Service.issueUnlockedAssetServicePrice = function () {
    return getServicePrice(Service.clientPaidService.issue_unlocked_asset);
};

// Returns price data for Transfer Asset service
//
//  Return: {
//    estimatedServiceCost: [Number], - Estimated cost, in satoshis, of the service
//    priceMarkup: [Number], - Markup used to calculate the price of the service
//    btcServicePrice: [Number], - Price of the service expressed in (bitcoin) satoshis
//    exchangeRate: [Number], - Bitcoin to BCOT token exchange rate used to calculate final price
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
        description: 'Record a message onto the blockchain',
        costFunction: estimatedLogMessageTxCost
    }),
    send_message: Object.freeze({
        name: 'send_message',
        description: 'Record a message onto the blockchain addressing it to another device (with no read confirmation)',
        costFunction: estimatedSendMessageTxCost
    }),
    send_msg_read_confirm: Object.freeze({
        name: 'send_msg_read_confirm',
        description: 'Record a message onto the blockchain addressing it to another device, requesting to receive a read confirm',
        costFunction: estimatedSendMessageReadConfirmTxCost
    }),
    issue_locked_asset: Object.freeze({
        name: 'issue_locked_asset',
        description: 'Issue an amount of a new Catenis asset (no more units of this same asset can be issued later)',
        costFunction: estimatedIssueLockedAssetTxCost
    }),
    issue_unlocked_asset: Object.freeze({
        name: 'issue_unlocked_asset',
        description: 'Issue an amount of a new or already existing Catenis asset',
        costFunction: estimatedIssueUnlockedAssetTxCost
    }),
    transfer_asset: Object.freeze({
        name: 'transfer_asset',
        description: 'Transfer an amount of a Catenis asset to another device',
        costFunction: estimatedTransferAssetTxCost
    })
});


// Definition of module (private) functions
//

function systemFundingCost() {
    return Service.minServiceCreditIssuanceFundAmount + Service.minPayTxExpenseFundAmount + Service.minReadConfirmPayTxExpenseFundAmount + Service.minServicePaymentPayTxExpenseFundAmount;
}

function numActiveSystemDeviceMainAddresses() {
    return Math.ceil((cfgSettings.sysMessage.messagesPerMinute * cfgSettings.sysMessage.minutesToConfirm) / cfgSettings.sysMessage.unconfMainAddrReuses);
}

function estimatedSendSystemMessageTxCost() {
    return Util.roundToResolution(typicalSendSystemMessageTxSize() * Catenis.bitcoinFees.getFeeRateByTime(cfgSettings.sysMessage.minutesToConfirm), cfgSettings.paymentResolution);
}

function typicalSendSystemMessageTxSize() {
    return Transaction.computeTransactionSize(cfgSettings.sysTxConfig.sendSysMessage.numInputs, cfgSettings.sysTxConfig.sendSysMessage.numOutputs, cfgSettings.sysTxConfig.sendSysMessage.nullDataPayloadSize);
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
    return Math.ceil((cfgSettings.asset.issuance.unlockedAssetsPerMinute * cfgSettings.asset.issuance.minutesToConfirm) / cfgSettings.asset.issuance.unconfAssetIssueAddrReuses);
}

function highestEstimatedServiceTxCost() {
    return _.max([
        estimatedLogMessageTxCost(),
        estimatedSendMessageTxCost(),
        estimatedSendMessageReadConfirmTxCost(),
        estimatedIssueLockedAssetTxCost(),
        estimatedIssueUnlockedAssetTxCost(),
        estimatedTransferAssetTxCost()
    ]);
}

function averageEstimatedServiceTxCost() {
    return Util.roundToResolution(Util.weightedAverage([
        estimatedLogMessageTxCost(),
        estimatedSendMessageTxCost(),
        estimatedSendMessageReadConfirmTxCost(),
        estimatedIssueLockedAssetTxCost(),
        estimatedIssueUnlockedAssetTxCost(),
        estimatedTransferAssetTxCost()
    ], [
        cfgSettings.serviceUsageWeight.logMessage,
        cfgSettings.serviceUsageWeight.sendMessage,
        cfgSettings.serviceUsageWeight.sendMsgReadConfirm,
        cfgSettings.serviceUsageWeight.issueLockedAsset,
        cfgSettings.serviceUsageWeight.issueUnlockedAsset,
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

function estimatedIssueLockedAssetTxCost() {
    return Util.roundToResolution(typicalIssueLockedAssetTxSize() * Catenis.bitcoinFees.getFeeRateByTime(cfgSettings.asset.issuance.minutesToConfirm), cfgSettings.paymentResolution);
}

function typicalIssueLockedAssetTxSize() {
    return Transaction.computeTransactionSize(cfgSettings.serviceTxConfig.issueLockedAsset.numInputs, cfgSettings.serviceTxConfig.issueLockedAsset.numOutputs, cfgSettings.serviceTxConfig.issueLockedAsset.nullDataPayloadSize);
}

function estimatedIssueUnlockedAssetTxCost() {
    return Util.roundToResolution(typicalIssueUnlockedAssetTxSize() * Catenis.bitcoinFees.getFeeRateByTime(cfgSettings.asset.issuance.minutesToConfirm), cfgSettings.paymentResolution);
}

function typicalIssueUnlockedAssetTxSize() {
    return Transaction.computeTransactionSize(cfgSettings.serviceTxConfig.issueUnlockedAsset.numInputs, cfgSettings.serviceTxConfig.issueUnlockedAsset.numOutputs, cfgSettings.serviceTxConfig.issueUnlockedAsset.nullDataPayloadSize);
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
        getServicePrice(Service.clientPaidService.issue_locked_asset).finalServicePrice,
        getServicePrice(Service.clientPaidService.issue_unlocked_asset).finalServicePrice,
        getServicePrice(Service.clientPaidService.transfer_asset).finalServicePrice
    ], [
        cfgSettings.serviceUsageWeight.logMessage,
        cfgSettings.serviceUsageWeight.sendMessage,
        cfgSettings.serviceUsageWeight.sendMsgReadConfirm,
        cfgSettings.serviceUsageWeight.issueLockedAsset,
        cfgSettings.serviceUsageWeight.issueUnlockedAsset,
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
    return Util.roundToResolution(Util.weightedAverage([
        averageSpendServCredTxCostPerService(),
        averageDebitServAccountTxCostPerService()
    ], [
        Client.activePrePaidClientsCount(),
        Client.activePostPaidClientsCount()
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
    return Math.floor(Client.allClientsServiceAccountCreditLineBalance() / averageServicePrice());
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
//    exchangeRate: [Number], - Bitcoin to BCOT token exchange rate used to calculate final price
//    finalServicePrice: [Number] - Price charged for the service expressed in Catenis service credit's lowest units
//  }
function getServicePrice(paidService) {
    const result = {
        estimatedServiceCost: paidService.costFunction(),
        priceMarkup: cfgSettings.priceMarkup,
    };

    const bnBtcServicePrice = new BigNumber(result.estimatedServiceCost).times(1 + result.priceMarkup);

    result.btcServicePrice = bnBtcServicePrice.toNumber();
    result.exchangeRate = Catenis.bcotExchRate.getLatestRate().exchangeRate;
    result.finalServicePrice = Util.roundToResolution(BcotPayment.bcotToServiceCredit(bnBtcServicePrice.dividedBy(Catenis.bcotExchRate.getLatestRate().exchangeRate).ceil().toNumber()), cfgSettings.servicePriceResolution);

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
            return cfgSettings.message.readConfimAddrAmount;
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
    minServiceCreditIssuanceFundAmount: {
        get: function () {
            return (Math.ceil(cfgSettings.serviceCreditIssueAddrFunding.prePaidClientsToFund * cfgSettings.serviceCreditIssueAddrFunding.unitsPerPrePaidClients)
                + Math.ceil(cfgSettings.serviceCreditIssueAddrFunding.postPaidClientsToFund * cfgSettings.serviceCreditIssueAddrFunding.unitsPerPostPaidClients))
                * cfgSettings.serviceCreditIssueAddrFunding.unitAmount;
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
    }
});

// Lock function class
Object.freeze(Service);
