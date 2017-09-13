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
import { _ } from 'meteor/underscore';


// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { Transaction } from './Transaction';
import { RbfTransactionInfo } from './RbfTransactionInfo';

// Config entries
const serviceConfig = config.get('service');
const srvMessageConfig = serviceConfig.get('message');
const srvMsgTypTxCfgConfig = srvMessageConfig.get('typicalTxConfig');
const srvMsgTypTxCfgSysMsgConfig = srvMsgTypTxCfgConfig.get('sysMessage');
const srvMsgTypTxCfgSendMsgConfig = srvMsgTypTxCfgConfig.get('sendMessage');
const srvMsgTypTxCfgLogMsgConfig = srvMsgTypTxCfgConfig.get('logMessage');
const srvReadConfirmConfig = serviceConfig.get('readConfirmation');
const srvAssetConfig = serviceConfig.get('asset');
const srvAssetTxWeights = srvAssetConfig.get('txWeights');
const srvAstTypTxCfgConfig = srvAssetConfig.get('typicalTxConfig');
const srvAstTypTxCfgIssueLockedAsset = srvAstTypTxCfgConfig.get('issueLockedAsset');
const srvAstTypTxCfgIssueUnlockedAsset = srvAstTypTxCfgConfig.get('issueUnlockedAsset');
const srvAstTypTxCfgTransferAsset = srvAstTypTxCfgConfig.get('transferAsset');

// Configuration settings
const cfgSettings = {
    paymentResolution: serviceConfig.get('paymentResolution'),
    serviceCreditAmount: serviceConfig.get('serviceCreditAmount'),
    serviceCreditMultiplyFactor: serviceConfig.get('serviceCreditMultiplyFactor'),
    minFundClientsProvision: serviceConfig.get('minFundClientsProvision'),
    minFundDevicesProvision: serviceConfig.get('minFundDevicesProvision'),
    minFundMessageCreditsProvision: serviceConfig.get('minFundMessageCreditsProvision'),
    minFundAssetCreditsProvision: serviceConfig.get('minFundAssetCreditsProvision'),
    fundPayTxSafetyFactor: serviceConfig.get('fundPayTxSafetyFactor'),
    percSendMessageCredit: serviceConfig.get('percSendMessageCredit'),
    percLogMessageCredit: serviceConfig.get('percLogMessageCredit'),
    systemMessageCredits: serviceConfig.get('systemMessageCredits'),
    fundPayTxResolutionSafetyFactor: serviceConfig.get('fundPayTxResolutionSafetyFactor'),
    fundPayTxMultiplyFactor: serviceConfig.get('fundPayTxMultiplyFactor'),
    minFundPayTxAmountMultiplyFactor: serviceConfig.get('minFundPayTxAmountMultiplyFactor'),
    message: {
        messagesPerMinute: srvMessageConfig.get('messagesPerMinute'),
        minutesToConfirm: srvMessageConfig.get('minutesToConfirm'),
        unconfMainAddrReuses: srvMessageConfig.get('unconfMainAddrReuses'),
        fundMainAddrAmount: srvMessageConfig.get('fundMainAddrAmount'),
        fundMainAddrMultiplyFactor: srvMessageConfig.get('fundMainAddrMultiplyFactor'),
        readConfimAddrAmount: srvMessageConfig.get('readConfimAddrAmount'),
        typicalTxConfig: {
            sysMessage: {
                numInputs: srvMsgTypTxCfgSysMsgConfig.get('numInputs'),
                numOutputs: srvMsgTypTxCfgSysMsgConfig.get('numOutputs'),
                nullDataPayloadSize: srvMsgTypTxCfgSysMsgConfig.get('nullDataPayloadSize')
            },
            sendMessage: {
                numInputs: srvMsgTypTxCfgSendMsgConfig.get('numInputs'),
                numOutputs: srvMsgTypTxCfgSendMsgConfig.get('numOutputs'),
                nullDataPayloadSize: srvMsgTypTxCfgSendMsgConfig.get('nullDataPayloadSize')
            },
            logMessage: {
                numInputs: srvMsgTypTxCfgLogMsgConfig.get('numInputs'),
                numOutputs: srvMsgTypTxCfgLogMsgConfig.get('numOutputs'),
                nullDataPayloadSize: srvMsgTypTxCfgLogMsgConfig.get('nullDataPayloadSize')
            }
        }
    },
    readConfirmation: {
        paymentResolution: srvReadConfirmConfig.get('paymentResolution'),
        fundPayTxResolutionSafetyFactor: srvReadConfirmConfig.get('fundPayTxResolutionSafetyFactor'),
        fundPayTxMultiplyFactor: srvReadConfirmConfig.get('fundPayTxMultiplyFactor'),
        minFundPayTxAmountMultiplyFactor: srvReadConfirmConfig.get('minFundPayTxAmountMultiplyFactor'),
        fundPayTxSafetyFactor: srvReadConfirmConfig.get('fundPayTxSafetyFactor'),
        initNumTxInputs: srvReadConfirmConfig.get('initNumTxInputs'),
        initNumTxOutputs: srvReadConfirmConfig.get('initNumTxOutputs'),
        txNullDataPayloadSize: srvReadConfirmConfig.get('txNullDataPayloadSize'),
        txInputOutputGrowthRatio: srvReadConfirmConfig.get('txInputOutputGrowthRatio'),
        initTxFeeRate: srvReadConfirmConfig.get('initTxFeeRate'),
        txFeeRateIncrement: srvReadConfirmConfig.get('txFeeRateIncrement'),
        numReadConfirmTxsMinFundBalance: srvReadConfirmConfig.get('numReadConfirmTxsMinFundBalance')
    },
    asset: {
        unlockedAssetsPerMinute: srvAssetConfig.get('unlockedAssetsPerMinute'),
        minutesToConfirm: srvAssetConfig.get('minutesToConfirm'),
        unconfAssetIssueAddrReuses: srvAssetConfig.get('unconfAssetIssueAddrReuses'),
        fundAssetIssueAddrAmount: srvAssetConfig.get('fundAssetIssueAddrAmount'),
        fundAssetIssueAddrMultiplyFactor: srvAssetConfig.get('fundAssetIssueAddrMultiplyFactor'),
        txWeights: {
            issueLockedAsset: srvAssetTxWeights.get('issueLockedAsset'),
            issueUnlockedAsset: srvAssetTxWeights.get('issueUnlockedAsset'),
            transferAsset: srvAssetTxWeights.get('transferAsset')
        },
        typicalTxConfig: {
            issueLockedAsset: {
                numInputs: srvAstTypTxCfgIssueLockedAsset.get('numInputs'),
                numOutputs: srvAstTypTxCfgIssueLockedAsset.get('numOutputs'),
                nullDataPayloadSize: srvAstTypTxCfgIssueLockedAsset.get('nullDataPayloadSize')
            },
            issueUnlockedAsset: {
                numInputs: srvAstTypTxCfgIssueUnlockedAsset.get('numInputs'),
                numOutputs: srvAstTypTxCfgIssueUnlockedAsset.get('numOutputs'),
                nullDataPayloadSize: srvAstTypTxCfgIssueUnlockedAsset.get('nullDataPayloadSize')
            },
            transferAsset: {
                numInputs: srvAstTypTxCfgTransferAsset.get('numInputs'),
                numOutputs: srvAstTypTxCfgTransferAsset.get('numOutputs'),
                nullDataPayloadSize: srvAstTypTxCfgTransferAsset.get('nullDataPayloadSize')
            }
        }
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
        systemProvisionCost: systemProvisionCost(),
        numActiveSystemDeviceMainAddresses: numActiveSystemDeviceMainAddresses(),
        estimatedSystemMessageTxCost: estimatedSystemMessageTxCost(),
        typicalSystemMessageTxSize: typicalSystemMessageTxSize(),
        clientProvisionCost: clientProvisionCost(),
        deviceProvisionCost: deviceProvisionCost(),
        deviceMessageProvisionCost: deviceMessageProvisionCost(),
        numActiveDeviceMainAddresses: numActiveDeviceMainAddresses(),
        estimatedHighestTxCost: estimatedHighestTxCost(),
        estimatedSendMessageTxCost: estimatedSendMessageTxCost(),
        typicalSendMessageTxSize: typicalSendMessageTxSize(),
        estimatedLogMessageTxCost: estimatedLogMessageTxCost(),
        typicalLogMessageTxSize: typicalLogMessageTxSize(),
        estimatedHighestMessageTxCost: estimatedHighestMessageTxCost(),
        typicalHighestMessageTxSize: typicalHighestMessageTxSize(),
        averageReadConfirmTxCostPerMessage: averageReadConfirmTxCostPerMessage(),
        deviceAssetProvisionCost: deviceAssetProvisionCost(),
        numActiveDeviceAssetIssuanceAddresses: numActiveDeviceAssetIssuanceAddresses(),
        estimatedAssetTxCost: estimatedAssetTxCost(),
        typicalIssueLockedAssetTxSize: typicalIssueLockedAssetTxSize(),
        typicalIssueUnlockedAssetTxSize: typicalIssueUnlockedAssetTxSize(),
        typicalTransferAssetTxSize: typicalTransferAssetTxSize(),
        typicalAverageAssetTxSize: typicalAverageAssetTxSize(),
        estimatedHighestAssetTxCost: estimatedHighestAssetTxCost(),
        typicalHighestAssetTxSize: typicalHighestAssetTxSize()
    };
};

Service.getExpectedPayTxExpenseBalance = function (messageCredits, assetCredits) {
    const splitMsgCredits = splitMessageCredits(messageCredits);

    return splitMsgCredits.logMsgCredits * estimatedLogMessageTxCost() + splitMsgCredits.sendMsgCredits * estimatedSendMessageTxCost() + assetCredits * estimatedAssetTxCost();
};

Service.getExpectedReadConfirmPayTxExpenseBalance = function (unreadMessages) {
    return (unreadMessages + cfgSettings.readConfirmation.numReadConfirmTxsMinFundBalance) * averageReadConfirmTxCostPerMessage();
};

Service.distributeSystemDeviceMainAddressFund = function () {
    let totalAmount = numActiveSystemDeviceMainAddresses() * cfgSettings.message.fundMainAddrAmount;

    return {
        totalAmount: totalAmount,
        amountPerAddress: distributePayment(totalAmount, cfgSettings.message.fundMainAddrAmount, cfgSettings.message.unconfMainAddrReuses, cfgSettings.message.fundMainAddrMultiplyFactor)
    }
};

Service.distributeClientServiceCreditFund = function (credits) {
    let totalAmount = credits * cfgSettings.serviceCreditAmount;

    return {
        totalAmount: totalAmount,
        amountPerAddress: distributePayment(totalAmount, cfgSettings.serviceCreditAmount, cfgSettings.serviceCreditMultiplyFactor, cfgSettings.serviceCreditMultiplyFactor)
    };
};

Service.distributeDeviceMainAddressFund  = function () {
    let totalAmount = numActiveDeviceMainAddresses() * cfgSettings.message.fundMainAddrAmount;

    return {
        totalAmount: totalAmount,
        amountPerAddress: distributePayment(totalAmount, cfgSettings.message.fundMainAddrAmount, cfgSettings.message.unconfMainAddrReuses, cfgSettings.message.fundMainAddrMultiplyFactor)
    };
};

// This method should be used to fix the funding amount allocated to a device's main addresses due to the change
//  of the 'messagesPerMinute' and/or 'minutesToConfirm' system configuration settings (and thus the total funding
//  amount that should be allocated)
Service.distributeDeviceMainAddressDeltaFund  = function (deltaAmount) {
    return distributePayment(deltaAmount, cfgSettings.message.fundMainAddrAmount, cfgSettings.message.unconfMainAddrReuses, cfgSettings.message.fundMainAddrMultiplyFactor)
};

Service.distributeDeviceAssetIssuanceAddressFund = function () {
    let totalAmount = numActiveDeviceAssetIssuanceAddresses() * cfgSettings.asset.fundAssetIssueAddrAmount;

    return {
        totalAmount: totalAmount,
        amountPerAddress: distributePayment(totalAmount, cfgSettings.asset.fundAssetIssueAddrAmount, cfgSettings.asset.unconfAssetIssueAddrReuses, cfgSettings.asset.fundAssetIssueAddrMultiplyFactor)
    };
};

Service.getPayMessageTxExpenseFundAmount = function (credits) {
    const splitMsgCredits = splitMessageCredits(credits);

    return splitMsgCredits.sendMsgCredits * estimatedSendMessageTxCost() + splitMsgCredits.logMsgCredits * estimatedLogMessageTxCost();
};

Service.getPayAssetTxExpenseFundAmount = function (credits) {
    return credits * estimatedAssetTxCost();
};

Service.distributePayTxExpenseFund = function (amount) {
    const fundPayTxResolution = Service.fundPayTxResolution;
    let totalAmount = Math.ceil(amount / fundPayTxResolution) * fundPayTxResolution;

    // Make sure that amount to fund is not below minimum
    const minFundAmount = cfgSettings.minFundPayTxAmountMultiplyFactor * fundPayTxResolution;

    if (totalAmount < minFundAmount) {
        totalAmount = minFundAmount;
    }

    return {
        totalAmount: totalAmount,
        amountPerAddress: distributePayment(totalAmount, fundPayTxResolution, cfgSettings.fundPayTxMultiplyFactor, cfgSettings.fundPayTxMultiplyFactor)
    };
};

Service.distributeReadConfirmPayTxExpenseFund = function (amount) {
    const fundReadConfirmPayTxResolution = Service.fundReadConfirmPayTxResolution;
    let totalAmount = Math.ceil(amount / fundReadConfirmPayTxResolution) * fundReadConfirmPayTxResolution;

    // Make sure that amount to fund is not below minimum
    const minFundAmount = cfgSettings.readConfirmation.minFundPayTxAmountMultiplyFactor * fundReadConfirmPayTxResolution;

    if (totalAmount < minFundAmount) {
        totalAmount = minFundAmount;
    }

    return {
        totalAmount: totalAmount,
        amountPerAddress: distributePayment(totalAmount, fundReadConfirmPayTxResolution, 1, cfgSettings.readConfirmation.fundPayTxMultiplyFactor)
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

function systemProvisionCost() {
    // Includes cost to pay for expense of txs issued by system device
    return cfgSettings.systemMessageCredits * estimatedSystemMessageTxCost();
}

function numActiveSystemDeviceMainAddresses() {
    return Math.ceil((cfgSettings.message.messagesPerMinute * cfgSettings.message.minutesToConfirm) / cfgSettings.message.unconfMainAddrReuses);
}

function estimatedSystemMessageTxCost() {
    return Math.ceil((typicalSystemMessageTxSize() * Catenis.bitcoinFees.getFeeRateByTime(cfgSettings.message.minutesToConfirm)) / cfgSettings.paymentResolution) * cfgSettings.paymentResolution;
}

function typicalSystemMessageTxSize() {
    return Transaction.computeTransactionSize(cfgSettings.message.typicalTxConfig.sysMessage.numInputs, cfgSettings.message.typicalTxConfig.sysMessage.numOutputs, cfgSettings.message.typicalTxConfig.sysMessage.nullDataPayloadSize);
}

function clientProvisionCost(messageCredits = cfgSettings.minFundMessageCreditsProvision, assetCredits = cfgSettings.minFundAssetCreditsProvision) {
    // Includes cost to pay for expense of txs issued by client's devices + cost to fund client service credit addresses
    const splitMsgCredits = splitMessageCredits(messageCredits);

    return splitMsgCredits.sendMsgCredits * estimatedSendMessageTxCost() + splitMsgCredits.logMsgCredits * estimatedLogMessageTxCost() + assetCredits * estimatedAssetTxCost() + (messageCredits + assetCredits) * cfgSettings.serviceCreditAmount;
}

function deviceProvisionCost() {
    // Includes cost to fund device main addresses and asset issuance addresses
    return deviceMessageProvisionCost() + deviceAssetProvisionCost();
}

function deviceMessageProvisionCost() {
    return numActiveDeviceMainAddresses() * cfgSettings.message.fundMainAddrAmount;
}

function numActiveDeviceMainAddresses() {
    return Math.ceil((cfgSettings.message.messagesPerMinute * cfgSettings.message.minutesToConfirm) / cfgSettings.message.unconfMainAddrReuses);
}

function estimatedHighestTxCost() {
    return _.max([
        estimatedHighestMessageTxCost(),
        estimatedHighestAssetTxCost()
    ]);
}

function estimatedSendMessageTxCost() {
    return Math.ceil((typicalSendMessageTxSize() * Catenis.bitcoinFees.getFeeRateByTime(cfgSettings.message.minutesToConfirm)) / cfgSettings.paymentResolution) * cfgSettings.paymentResolution;
}

function typicalSendMessageTxSize() {
    return Transaction.computeTransactionSize(cfgSettings.message.typicalTxConfig.sendMessage.numInputs, cfgSettings.message.typicalTxConfig.sendMessage.numOutputs, cfgSettings.message.typicalTxConfig.sendMessage.nullDataPayloadSize);
}

function estimatedLogMessageTxCost() {
    return Math.ceil((typicalLogMessageTxSize() * Catenis.bitcoinFees.getFeeRateByTime(cfgSettings.message.minutesToConfirm)) / cfgSettings.paymentResolution) * cfgSettings.paymentResolution;
}

function typicalLogMessageTxSize() {
    return Transaction.computeTransactionSize(cfgSettings.message.typicalTxConfig.logMessage.numInputs, cfgSettings.message.typicalTxConfig.logMessage.numOutputs, cfgSettings.message.typicalTxConfig.logMessage.nullDataPayloadSize);
}

function estimatedHighestMessageTxCost() {
    return Math.ceil((typicalHighestMessageTxSize() * Catenis.bitcoinFees.getFeeRateByTime(cfgSettings.message.minutesToConfirm)) / cfgSettings.paymentResolution) * cfgSettings.paymentResolution;
}

function typicalHighestMessageTxSize() {
    return _.max([
        typicalSendMessageTxSize(),
        typicalLogMessageTxSize()
    ]);
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
            initNumTxInputs: cfgSettings.readConfirmation.initNumTxInputs,
            initNumTxOutputs: cfgSettings.readConfirmation.initNumTxOutputs,
            txNullDataPayloadSize: cfgSettings.readConfirmation.txNullDataPayloadSize,
            txFeeRateIncrement: cfgSettings.readConfirmation.txFeeRateIncrement,
            initTxFeeRate: cfgSettings.readConfirmation.initTxFeeRate
        });

        do {
            numMsgs++;

            if (numMsgs > 1) {
                // Add one more tx input to spend a new read confirmation output
                readConfirmTxInfo.incrementNumTxInputs(1);

                if (numMsgs % cfgSettings.readConfirmation.fundPayTxMultiplyFactor === 0) {
                    // Add one more tx input to pay for tx fee
                    readConfirmTxInfo.incrementNumTxInputs(1);
                }

                if (numMsgs <= 3) {
                    // Add one more tx output for paying spent read confirmation outputs to both
                    //  system read confirmation spend only and system read confirmation spend null addresses
                    readConfirmTxInfo.incrementNumTxOutputs(1);
                }

                if (numMsgs % cfgSettings.readConfirmation.txInputOutputGrowthRatio === 0) {
                    // Add one more tx output for paying spent read confirmation outputs to
                    //  system read confirmation spend notify address of a different Catenis node
                    readConfirmTxInfo.incrementNumTxOutputs(1);
                }
            }

            lastTxFee = readConfirmTxInfo.getNewTxFee();
            readConfirmTxInfo.confirmTxFee();

            sumFeePerMsg += Math.ceil((lastTxFee.fee / numMsgs) / cfgSettings.readConfirmation.paymentResolution) * cfgSettings.readConfirmation.paymentResolution;
        }
        while (lastTxFee.feeRate < optimumFeeRate);

        Service.avrgReadConfirmTxCostPerMsgCtrl.lastCostPerMsg = Math.ceil((sumFeePerMsg / numMsgs) / cfgSettings.readConfirmation.paymentResolution) * cfgSettings.readConfirmation.paymentResolution;
    }

    return Service.avrgReadConfirmTxCostPerMsgCtrl.lastCostPerMsg;
}

function deviceAssetProvisionCost() {
    return numActiveDeviceAssetIssuanceAddresses() * cfgSettings.asset.fundAssetIssueAddrAmount;
}

function numActiveDeviceAssetIssuanceAddresses() {
    return Math.ceil((cfgSettings.asset.unlockedAssetsPerMinute * cfgSettings.asset.minutesToConfirm) / cfgSettings.asset.unconfAssetIssueAddrReuses);
}

function estimatedAssetTxCost() {
    return Math.ceil((typicalAverageAssetTxSize() * Catenis.bitcoinFees.getFeeRateByTime(cfgSettings.asset.minutesToConfirm)) / cfgSettings.paymentResolution) * cfgSettings.paymentResolution;
}

function typicalIssueLockedAssetTxSize() {
    return Transaction.computeTransactionSize(cfgSettings.asset.typicalTxConfig.issueLockedAsset.numInputs, cfgSettings.asset.typicalTxConfig.issueLockedAsset.numOutputs, cfgSettings.asset.typicalTxConfig.issueLockedAsset.nullDataPayloadSize);
}

function typicalIssueUnlockedAssetTxSize() {
    return Transaction.computeTransactionSize(cfgSettings.asset.typicalTxConfig.issueUnlockedAsset.numInputs, cfgSettings.asset.typicalTxConfig.issueUnlockedAsset.numOutputs, cfgSettings.asset.typicalTxConfig.issueUnlockedAsset.nullDataPayloadSize);
}

function typicalTransferAssetTxSize() {
    return Transaction.computeTransactionSize(cfgSettings.asset.typicalTxConfig.transferAsset.numInputs, cfgSettings.asset.typicalTxConfig.transferAsset.numOutputs, cfgSettings.asset.typicalTxConfig.transferAsset.nullDataPayloadSize);
}

function typicalAverageAssetTxSize() {
    const totalWeights = cfgSettings.asset.txWeights.issueLockedAsset + cfgSettings.asset.txWeights.issueUnlockedAsset + cfgSettings.asset.txWeights.transferAsset;

    return Math.ceil((typicalIssueLockedAssetTxSize() * cfgSettings.asset.txWeights.issueLockedAsset + typicalIssueUnlockedAssetTxSize() * cfgSettings.asset.txWeights.issueUnlockedAsset + typicalTransferAssetTxSize() * cfgSettings.asset.txWeights.transferAsset) / totalWeights);
}

function estimatedHighestAssetTxCost() {
    return Math.ceil((typicalHighestAssetTxSize() * Catenis.bitcoinFees.getFeeRateByTime(cfgSettings.asset.minutesToConfirm)) / cfgSettings.paymentResolution) * cfgSettings.paymentResolution;
}

function typicalHighestAssetTxSize() {
    return _.max([
        typicalIssueUnlockedAssetTxSize(),
        typicalIssueUnlockedAssetTxSize(),
        typicalTransferAssetTxSize()
    ]);
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

function splitMessageCredits(credits) {
    const sendMsgCredits = Math.round(credits * cfgSettings.percSendMessageCredit / 100);

    return {
        sendMsgCredits: sendMsgCredits,
        logMsgCredits: credits - sendMsgCredits
    }
}

// Module code
//

// Definition of properties
Object.defineProperties(Service, {
    minutesToConfirmMessage: {
        get: function () {
            return cfgSettings.message.minutesToConfirm;
        },
        enumerable: true
    },
    minutesToConfirmAsset: {
        get: function () {
            return cfgSettings.asset.minutesToConfirm;
        },
        enumerable: true
    },
    paymentResolution: {
        get: function () {
            return cfgSettings.paymentResolution;
        },
        enumerable: true
    },
    fundPayTxResolution: {
        get: function () {
            return Math.ceil((estimatedHighestTxCost() * (1 + cfgSettings.fundPayTxResolutionSafetyFactor)) / cfgSettings.paymentResolution) * cfgSettings.paymentResolution;
        },
        enumerable: true
    },
    fundPayTxSafetyFactor: {
        get: function () {
            return cfgSettings.fundPayTxSafetyFactor;
        },
        enumerable: true
    },
    readConfirmPaymentResolution: {
        get: function () {
            return cfgSettings.readConfirmation.paymentResolution;
        },
        enumerable: true
    },
    fundReadConfirmPayTxResolution: {
        get: function () {
            return Math.ceil((averageReadConfirmTxCostPerMessage() * (1 + cfgSettings.readConfirmation.fundPayTxResolutionSafetyFactor)) / cfgSettings.paymentResolution) * cfgSettings.paymentResolution;
        },
        enumerable: true
    },
    fundReadConfirmPayTxSafetyFactor: {
        get: function () {
            return cfgSettings.readConfirmation.fundPayTxSafetyFactor;
        },
        enumerable: true
    },
    minimumFundingBalance: {
        get: function () {
            return systemProvisionCost() + cfgSettings.minFundClientsProvision * clientProvisionCost() + cfgSettings.minFundClientsProvision * cfgSettings.minFundDevicesProvision * deviceProvisionCost();
        },
        enumerable: true
    },
    clientServiceCreditAmount: {
        get: function () {
            return cfgSettings.serviceCreditAmount;
        },
        enumerable: true
    },
    devMainAddrAmount: {
        get: function () {
            return cfgSettings.message.fundMainAddrAmount;
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
            return cfgSettings.asset.fundAssetIssueAddrAmount;
        },
        enumerable: true
    },
    readConfirmInitNumTxInputs: {
        get: function () {
            return cfgSettings.readConfirmation.initNumTxInputs;
        },
        enumerable: true
    },
    readConfirmInitNumTxOutputs: {
        get: function () {
            return cfgSettings.readConfirmation.initNumTxOutputs;
        },
        enumerable: true
    },
    readConfirmTxNullDataPayloadSize: {
        get: function () {
            return cfgSettings.readConfirmation.txNullDataPayloadSize;
        },
        enumerable: true
    },
    readConfirmInitTxFeeRate: {
        get: function () {
            return cfgSettings.readConfirmation.initTxFeeRate;
        },
        enumerable: true
    },
    readConfirmTxFeeRateIncrement: {
        get: function () {
            return cfgSettings.readConfirmation.txFeeRateIncrement;
        },
        enumerable: true
    }
});

// Lock function class
Object.freeze(Service);
