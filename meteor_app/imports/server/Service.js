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

// Config entries
const serviceConfig = config.get('service');
const servSysFundConfig = serviceConfig.get('systemFunding');
const servServCreditIssueAddrFundConfig = serviceConfig.get('serviceCreditIssueAddrFunding');
const servPayTxExpFundConfig = serviceConfig.get('payTxExpenseFunding');
const servReadConfPayTxExpFundConfig = serviceConfig.get('readConfirmPayTxExpenseFunding');
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
        averageReadConfirmTxCostPerMessage: averageReadConfirmTxCostPerMessage()
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
    return (unreadMessages + cfgSettings.readConfirmPayTxExpenseFunding.minBalanceMessagesToConfirm) * averageEstimatedReadConfirmTxCostPerMessage();
};

Service.distributeServiceCreditIssuanceFund = function (amount) {
    let totalAmount = Math.ceil(amount / cfgSettings.serviceCreditIssueAddrFunding.unitAmount) * cfgSettings.serviceCreditIssueAddrFunding.unitAmount;

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

Service.distributePayTxExpenseFund = function (amount) {
    const fundUnitAmount = Service.payTxExpFundUnitAmount;
    let totalAmount = Math.ceil(amount / fundUnitAmount) * fundUnitAmount;

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
    let totalAmount = Math.ceil(amount / fundUnitAmount) * fundUnitAmount;

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


// Service function class (public) properties
//

Service.avrgReadConfirmTxCostPerMsgCtrl = {
    lastOptimumRate: undefined,
    lastCostPerMsg: undefined
};


// Definition of module (private) functions
//

function systemFundingCost() {
    return Service.minServiceCreditIssuanceFundAmount + Service.minPayTxExpenseFundAmount + Service.minReadConfirmPayTxExpenseFundAmount;
}

function numActiveSystemDeviceMainAddresses() {
    return Math.ceil((cfgSettings.sysMessage.messagesPerMinute * cfgSettings.sysMessage.minutesToConfirm) / cfgSettings.sysMessage.unconfMainAddrReuses);
}

function estimatedSendSystemMessageTxCost() {
    return Math.ceil((typicalSendSystemMessageTxSize() * Catenis.bitcoinFees.getFeeRateByTime(cfgSettings.sysMessage.minutesToConfirm)) / cfgSettings.paymentResolution) * cfgSettings.paymentResolution;
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
    return Math.ceil(Util.weightedAverage([
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
    ]) / cfgSettings.paymentResolution) * cfgSettings.paymentResolution;
}

function estimatedLogMessageTxCost() {
    return Math.ceil((typicalLogMessageTxSize() * Catenis.bitcoinFees.getFeeRateByTime(cfgSettings.message.minutesToConfirm)) / cfgSettings.paymentResolution) * cfgSettings.paymentResolution;
}

function typicalLogMessageTxSize() {
    return Transaction.computeTransactionSize(cfgSettings.serviceTxConfig.logMessage.numInputs, cfgSettings.serviceTxConfig.logMessage.numOutputs, cfgSettings.serviceTxConfig.logMessage.nullDataPayloadSize);
}

function estimatedSendMessageTxCost() {
    return Math.ceil((typicalSendMessageTxSize() * Catenis.bitcoinFees.getFeeRateByTime(cfgSettings.message.minutesToConfirm)) / cfgSettings.paymentResolution) * cfgSettings.paymentResolution;
}

function typicalSendMessageTxSize() {
    return Transaction.computeTransactionSize(cfgSettings.serviceTxConfig.sendMessage.numInputs, cfgSettings.serviceTxConfig.sendMessage.numOutputs, cfgSettings.serviceTxConfig.sendMessage.nullDataPayloadSize);
}

function estimatedSendMessageReadConfirmTxCost() {
    return Math.ceil((typicalSendMessageReadConfirmTxSize() * Catenis.bitcoinFees.getFeeRateByTime(cfgSettings.message.minutesToConfirm)) / cfgSettings.paymentResolution) * cfgSettings.paymentResolution;
}

function typicalSendMessageReadConfirmTxSize() {
    return Transaction.computeTransactionSize(cfgSettings.serviceTxConfig.sendMsgReadConfirm.numInputs, cfgSettings.serviceTxConfig.sendMsgReadConfirm.numOutputs, cfgSettings.serviceTxConfig.sendMsgReadConfirm.nullDataPayloadSize);
}

function estimatedIssueLockedAssetTxCost() {
    return Math.ceil((typicalIssueLockedAssetTxSize() * Catenis.bitcoinFees.getFeeRateByTime(cfgSettings.asset.issuance.minutesToConfirm)) / cfgSettings.paymentResolution) * cfgSettings.paymentResolution;
}

function typicalIssueLockedAssetTxSize() {
    return Transaction.computeTransactionSize(cfgSettings.serviceTxConfig.issueLockedAsset.numInputs, cfgSettings.serviceTxConfig.issueLockedAsset.numOutputs, cfgSettings.serviceTxConfig.issueLockedAsset.nullDataPayloadSize);
}

function estimatedIssueUnlockedAssetTxCost() {
    return Math.ceil((typicalIssueUnlockedAssetTxSize() * Catenis.bitcoinFees.getFeeRateByTime(cfgSettings.asset.issuance.minutesToConfirm)) / cfgSettings.paymentResolution) * cfgSettings.paymentResolution;
}

function typicalIssueUnlockedAssetTxSize() {
    return Transaction.computeTransactionSize(cfgSettings.serviceTxConfig.issueUnlockedAsset.numInputs, cfgSettings.serviceTxConfig.issueUnlockedAsset.numOutputs, cfgSettings.serviceTxConfig.issueUnlockedAsset.nullDataPayloadSize);
}

function estimatedTransferAssetTxCost() {
    return Math.ceil((typicalTransferAssetTxSize() * Catenis.bitcoinFees.getFeeRateByTime(cfgSettings.asset.transfer.minutesToConfirm)) / cfgSettings.paymentResolution) * cfgSettings.paymentResolution;
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
    return Math.ceil(Util.weightedAverage([
        averageReadConfirmTxCostPerMessage(),
        estimatedTerminalReadConfirmTxCostPerMessage()
    ], [
        cfgSettings.message.readConfirmation.usageWeight.regular,
        cfgSettings.message.readConfirmation.usageWeight.terminal
    ]) / cfgSettings.message.readConfirmation.paymentResolution) * cfgSettings.message.readConfirmation.paymentResolution;
}

function estimatedTerminalReadConfirmTxCostPerMessage() {
    const typicalTxCost = Math.ceil((typicalTerminalReadConfirmTxSize() * Catenis.bitcoinFees.getFeeRateByTime(cfgSettings.message.readConfirmation.terminalReadConfirmTx.minutesToConfirm)) / cfgSettings.message.readConfirmation.paymentResolution) * cfgSettings.message.readConfirmation.paymentResolution;

    return Math.ceil((typicalTxCost / cfgSettings.message.readConfirmation.terminalReadConfirmTx.typicalTxConfig.numMessagesConfirmed) / cfgSettings.message.readConfirmation.paymentResolution) * cfgSettings.message.readConfirmation.paymentResolution;
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
//
function averageReadConfirmTxCostPerMessage() {
    const optimumFeeRate = Catenis.bitcoinFees.getOptimumFeeRate();

    if (Service.avrgReadConfirmTxCostPerMsgCtrl.lastOptimumRate !== optimumFeeRate) {
        Service.avrgReadConfirmTxCostPerMsgCtrl.lastOptimumRate = optimumFeeRate;

        let lastTxFee;
        let numMsgs = 0;
        let sumFeePerMsg = 0;
        const readConfirmTxInfo = new RbfTransactionInfo({
            initNumTxInputs: cfgSettings.message.readConfirmation.initNumTxInputs,
            initNumTxOutputs: cfgSettings.message.readConfirmation.initNumTxOutputs,
            txNullDataPayloadSize: cfgSettings.message.readConfirmation.txNullDataPayloadSize,
            txFeeRateIncrement: cfgSettings.message.readConfirmation.txFeeRateIncrement,
            initTxFeeRate: cfgSettings.message.readConfirmation.initTxFeeRate
        });

        do {
            numMsgs++;

            if (numMsgs > 1) {
                // Add one more tx input to spend a new read confirmation output
                readConfirmTxInfo.incrementNumTxInputs(1);

                if (numMsgs % cfgSettings.readConfirmPayTxExpenseFunding.maxUnitsPerAddr === 0) {
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

            sumFeePerMsg += Math.ceil((lastTxFee.fee / numMsgs) / cfgSettings.message.readConfirmation.paymentResolution) * cfgSettings.message.readConfirmation.paymentResolution;
        }
        while (lastTxFee.feeRate < optimumFeeRate);

        Service.avrgReadConfirmTxCostPerMsgCtrl.lastCostPerMsg = Math.ceil((sumFeePerMsg / numMsgs) / cfgSettings.message.readConfirmation.paymentResolution) * cfgSettings.message.readConfirmation.paymentResolution;
    }

    return Service.avrgReadConfirmTxCostPerMsgCtrl.lastCostPerMsg;
}


// NOTE: totalAmount should be a multiple of payAmount
function distributePayment(totalAmount, payAmount, addressesPerBatch, paysPerAddress) {
    const maxBatchAmount = payAmount * addressesPerBatch * paysPerAddress,
        payments = [];
    let remainAmount = totalAmount;

    for (let batchNum = 1, maxBatches = Math.ceil(totalAmount / maxBatchAmount); batchNum <= maxBatches; batchNum++) {
        const workAmount = remainAmount > maxBatchAmount ? maxBatchAmount : remainAmount,
            payIdxOffset = (batchNum - 1) * addressesPerBatch,
            payPerAddress = Math.floor(workAmount / (payAmount * addressesPerBatch)),
            extraPays = Math.ceil((workAmount % (payAmount * addressesPerBatch)) / payAmount);

        // Fill up pays by address for this batch
        if (payPerAddress > 0) {
            for (let idx = 0; idx < addressesPerBatch; idx++) {
                payments[payIdxOffset + idx] = payPerAddress * payAmount;
            }
        }

        if (extraPays > 0) {
            for (let idx = 0; idx < extraPays; idx++) {
                payments[payIdxOffset + idx] = (payments[payIdxOffset + idx] !== undefined ? payments[payIdxOffset + idx] : 0) + payAmount;
            }
        }

        // Adjust remaining amount
        remainAmount -= workAmount;
    }

    return payments;
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
    payTxExpFundUnitAmount: {
        get: function () {
            return Math.ceil((_.max([estimatedSendSystemMessageTxCost(), highestEstimatedServiceTxCost()]) * (1 + cfgSettings.payTxExpenseFunding.unitAmountSafetyFactor)) / cfgSettings.paymentResolution) * cfgSettings.paymentResolution;
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
            return Math.ceil((highestEstimatedReadConfirmTxCostPerMessage() * (1 + cfgSettings.readConfirmPayTxExpenseFunding.unitAmountSafetyFactor)) / cfgSettings.message.readConfirmation.paymentResolution) * cfgSettings.message.readConfirmation.paymentResolution;
        },
        enumerable: true
    },
    readConfirmPayTxExpBalanceSafetyFactor: {
        get: function () {
            return cfgSettings.readConfirmPayTxExpenseFunding.balanceSafetyFactor;
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

            return Math.ceil((estimatedSendSystemMessageTxCost() * cfgSettings.payTxExpenseFunding.sysMessagesToFund
                + averageEstimatedServiceTxCost() * cfgSettings.payTxExpenseFunding.minBalanceServicesPerDevice * cfgSettings.payTxExpenseFunding.devicesToFund)
                / fundUnitAmount) * fundUnitAmount;
        },
        enumerable: true
    },
    minReadConfirmPayTxExpenseFundAmount: {
        get: function () {
            const fundUnitAmount = Service.readConfirmPayTxExpFundUnitAmount;

            return Math.ceil((averageEstimatedReadConfirmTxCostPerMessage() * cfgSettings.readConfirmPayTxExpenseFunding.messagesToConfirmToFund) / fundUnitAmount) * fundUnitAmount;
        },
        enumerable: true
    }
});

// Lock function class
Object.freeze(Service);
