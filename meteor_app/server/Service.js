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

// References code in other (Catenis) modules
import { Catenis } from './Catenis';

// Config entries
const serviceConfig = config.get('service');
const srvMessageConfig = serviceConfig.get('message');
const srvMsgTypTxCfgConfig = srvMessageConfig.get('typicalTxConfig');
const srvMsgTypTxCfgSysMsgConfig = srvMsgTypTxCfgConfig.get('sysMessage');
const srvMsgTypTxCfgSendMsgConfig = srvMsgTypTxCfgConfig.get('sendMessage');
const srvMsgTypTxCfgLogMsgConfig = srvMsgTypTxCfgConfig.get('logMessage');
const srvMsgTypTxCfgReadConfirm = srvMsgTypTxCfgConfig.get('readConfirmation');
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
    percSendMessageCredit: serviceConfig.get('percSendMessageCredit'),
    percLogMessageCredit: serviceConfig.get('percLogMessageCredit'),
    systemMessageCredits: serviceConfig.get('systemMessageCredits'),
    fundPayTxResolution: serviceConfig.get('fundPayTxResolution'),
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
                nullDataPlayloadSize: srvMsgTypTxCfgSysMsgConfig.get('nullDataPlayloadSize')
            },
            sendMessage: {
                numInputs: srvMsgTypTxCfgSendMsgConfig.get('numInputs'),
                numOutputs: srvMsgTypTxCfgSendMsgConfig.get('numOutputs'),
                nullDataPlayloadSize: srvMsgTypTxCfgSendMsgConfig.get('nullDataPlayloadSize')
            },
            logMessage: {
                numInputs: srvMsgTypTxCfgLogMsgConfig.get('numInputs'),
                numOutputs: srvMsgTypTxCfgLogMsgConfig.get('numOutputs'),
                nullDataPlayloadSize: srvMsgTypTxCfgLogMsgConfig.get('nullDataPlayloadSize')
            },
            readConfirmation: {
                numInputs: srvMsgTypTxCfgReadConfirm.get('numInputs'),
                numOutputs: srvMsgTypTxCfgReadConfirm.get('numOutputs'),
                nullDataPlayloadSize: srvMsgTypTxCfgReadConfirm.get('nullDataPlayloadSize')
            }
        }
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
                nullDataPlayloadSize: srvAstTypTxCfgIssueLockedAsset.get('nullDataPlayloadSize')
            },
            issueUnlockedAsset: {
                numInputs: srvAstTypTxCfgIssueUnlockedAsset.get('numInputs'),
                numOutputs: srvAstTypTxCfgIssueUnlockedAsset.get('numOutputs'),
                nullDataPlayloadSize: srvAstTypTxCfgIssueUnlockedAsset.get('nullDataPlayloadSize')
            },
            transferAsset: {
                numInputs: srvAstTypTxCfgTransferAsset.get('numInputs'),
                numOutputs: srvAstTypTxCfgTransferAsset.get('numOutputs'),
                nullDataPlayloadSize: srvAstTypTxCfgTransferAsset.get('nullDataPlayloadSize')
            }
        }
    }
};


// Definition of function classes
//

// Service function class
function Service() {
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
        estimatedSendMessageTotalTxCost: estimatedSendMessageTotalTxCost(),
        estimatedSendMessageTxCost: estimatedSendMessageTxCost(),
        typicalSendMessageTxSize: typicalSendMessageTxSize(),
        estimatedLogMessageTxCost: estimatedLogMessageTxCost(),
        typicalLogMessageTxSize: typicalLogMessageTxSize(),
        typicalReadConfirmationTxPayAmount: typicalReadConfirmationTxPayAmount(),
        deviceAssetProvisionCost: deviceAssetProvisionCost(),
        numActiveDeviceAssetIssuanceAddresses: numActiveDeviceAssetIssuanceAddresses(),
        estimatedAssetTxCost: estimatedAssetTxCost(),
        typicalIssueLockedAssetTxSize: typicalIssueLockedAssetTxSize(),
        typicalIssueUnlockedAssetTxSize: typicalIssueUnlockedAssetTxSize(),
        typicalTransferAssetTxSize: typicalTransferAssetTxSize(),
        typicalAverageAssetTxSize: typicalAverageAssetTxSize()
    };
};

Service.getExpectedPayTxExpenseBalance = function (messageCredits, unreadMessages, assetCredits) {
    const splitMsgCredits = splitMessageCredits(messageCredits);

    return splitMsgCredits.logMsgCredits * estimatedLogMessageTxCost() + splitMsgCredits.sendMsgCredits * estimatedSendMessageTxCost() + unreadMessages * typicalReadConfirmationTxPayAmount() + assetCredits * estimatedAssetTxCost();
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

Service.distributeDeviceAssetIssuanceAddressFund = function () {
    let totalAmount = numActiveDeviceAssetIssuanceAddresses() * cfgSettings.asset.fundAssetIssueAddrAmount;

    return {
        totalAmount: totalAmount,
        amountPerAddress: distributePayment(totalAmount, cfgSettings.asset.fundAssetIssueAddrAmount, cfgSettings.asset.unconfAssetIssueAddrReuses, cfgSettings.asset.fundAssetIssueAddrMultiplyFactor)
    };
};

Service.distributePayMessageTxExpenseFund = function (credits, safetyFactor = 0) {
    const splitMsgCredits = splitMessageCredits(credits);

    return Service.distributePayTxExpenseFund((splitMsgCredits.sendMsgCredits * estimatedSendMessageTotalTxCost() + splitMsgCredits.logMsgCredits * estimatedLogMessageTxCost()) * (1 + safetyFactor));
};

Service.distributePayAssetTxExpenseFund = function (credits, safetyFactor = 0) {
    return Service.distributePayTxExpenseFund(credits * estimatedAssetTxCost() * (1 + safetyFactor));
};

Service.distributePayTxExpenseFund = function (amount) {
    let totalAmount = Math.ceil(amount / cfgSettings.paymentResolution) * cfgSettings.paymentResolution;

    // Make sure that amount to fund is not below minimum
    if (totalAmount < cfgSettings.minFundPayTxAmountMultiplyFactor * cfgSettings.paymentResolution) {
        totalAmount = cfgSettings.minFundPayTxAmountMultiplyFactor * cfgSettings.paymentResolution;
    }

    return {
        totalAmount: totalAmount,
        amountPerAddress: distributePayment(totalAmount, cfgSettings.fundPayTxResolution, cfgSettings.fundPayTxMultiplyFactor, cfgSettings.fundPayTxMultiplyFactor)
    };
};


// Service function class (public) properties
//


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
    return Catenis.module.Transaction.computeTransactionSize(cfgSettings.message.typicalTxConfig.sysMessage.numInputs, cfgSettings.message.typicalTxConfig.sysMessage.numOutputs, cfgSettings.message.typicalTxConfig.sysMessage.nullDataPlayloadSize);
}

function clientProvisionCost(messageCredits = cfgSettings.minFundMessageCreditsProvision, assetCredits = cfgSettings.minFundAssetCreditsProvision) {
    // Includes cost to pay for expense of txs issued by client's devices + cost to fund client service credit addresses
    const splitMsgCredits = splitMessageCredits(messageCredits);

    return splitMsgCredits.sendMsgCredits * estimatedSendMessageTotalTxCost() + splitMsgCredits.logMsgCredits * estimatedLogMessageTxCost() + assetCredits * estimatedAssetTxCost() + (messageCredits + assetCredits) * cfgSettings.serviceCreditAmount;
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

function estimatedSendMessageTotalTxCost() {
    // Send message tx cost + read confirmation tx cost
    return Math.ceil((typicalSendMessageTxSize() * Catenis.bitcoinFees.getFeeRateByTime(cfgSettings.message.minutesToConfirm) + typicalReadConfirmationTxPayAmount()) / cfgSettings.paymentResolution) * cfgSettings.paymentResolution;
}

function estimatedSendMessageTxCost() {
    return Math.ceil((typicalSendMessageTxSize() * Catenis.bitcoinFees.getFeeRateByTime(cfgSettings.message.minutesToConfirm)) / cfgSettings.paymentResolution) * cfgSettings.paymentResolution;
}

function typicalSendMessageTxSize() {
    return Catenis.module.Transaction.computeTransactionSize(cfgSettings.message.typicalTxConfig.sendMessage.numInputs, cfgSettings.message.typicalTxConfig.sendMessage.numOutputs, cfgSettings.message.typicalTxConfig.sendMessage.nullDataPlayloadSize);
}

function estimatedLogMessageTxCost() {
    return Math.ceil((typicalLogMessageTxSize() * Catenis.bitcoinFees.getFeeRateByTime(cfgSettings.message.minutesToConfirm)) / cfgSettings.paymentResolution) * cfgSettings.paymentResolution;
}

function typicalLogMessageTxSize() {
    return Catenis.module.Transaction.computeTransactionSize(cfgSettings.message.typicalTxConfig.logMessage.numInputs, cfgSettings.message.typicalTxConfig.logMessage.numOutputs, cfgSettings.message.typicalTxConfig.logMessage.nullDataPlayloadSize);
}

function typicalReadConfirmationTxPayAmount() {
    // Since a single transaction could be used to spend one or more
    //  read confirmation outputs (by using the RBF - Replace By Fee
    //  feature), we need to compute an average fee (paid amount) per
    //  message (read confirmation output)
    let lastFee = 0,
        lastFeeRate = 0,
        sumFeePerMsg = 0,
        numMsgs,
        txInputs = cfgSettings.message.typicalTxConfig.readConfirmation.numInputs,
        txOutputs = cfgSettings.message.typicalTxConfig.readConfirmation.numOutputs;

    for (numMsgs = 1; numMsgs <= 10; numMsgs++, txInputs++, txOutputs++) {
        // Compute transaction size
        const txSize = Catenis.module.Transaction.computeTransactionSize(txInputs, txOutputs, cfgSettings.message.typicalTxConfig.readConfirmation.nullDataPlayloadSize);

        // Calculate fee
        const feeRate = lastFeeRate + 1;
        let fee = Math.ceil((txSize * feeRate) / cfgSettings.paymentResolution) * cfgSettings.paymentResolution;

        // Make sure that new fee is larger than latest fee
        if (fee < lastFee) {
            fee = lastFee + cfgSettings.paymentResolution;
        }

        // Accumulate current fee per message ratio
        sumFeePerMsg += Math.ceil((fee / numMsgs) / cfgSettings.paymentResolution) * cfgSettings.paymentResolution;

        // Reset latest fee and fee rate
        lastFee = fee;
        lastFeeRate = Math.ceil(fee / txSize);
    }

    return Math.ceil((sumFeePerMsg / (numMsgs - 1)) / cfgSettings.paymentResolution) * cfgSettings.paymentResolution;
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
    return Catenis.module.Transaction.computeTransactionSize(cfgSettings.asset.typicalTxConfig.issueLockedAsset.numInputs, cfgSettings.asset.typicalTxConfig.issueLockedAsset.numOutputs, cfgSettings.asset.typicalTxConfig.issueLockedAsset.nullDataPlayloadSize);
}

function typicalIssueUnlockedAssetTxSize() {
    return Catenis.module.Transaction.computeTransactionSize(cfgSettings.asset.typicalTxConfig.issueUnlockedAsset.numInputs, cfgSettings.asset.typicalTxConfig.issueUnlockedAsset.numOutputs, cfgSettings.asset.typicalTxConfig.issueUnlockedAsset.nullDataPlayloadSize);
}

function typicalTransferAssetTxSize() {
    return Catenis.module.Transaction.computeTransactionSize(cfgSettings.asset.typicalTxConfig.transferAsset.numInputs, cfgSettings.asset.typicalTxConfig.transferAsset.numOutputs, cfgSettings.asset.typicalTxConfig.transferAsset.nullDataPlayloadSize);
}

function typicalAverageAssetTxSize() {
    const totalWeights = cfgSettings.asset.txWeights.issueLockedAsset + cfgSettings.asset.txWeights.issueUnlockedAsset + cfgSettings.asset.txWeights.transferAsset;

    return Math.ceil((typicalIssueLockedAssetTxSize() * cfgSettings.asset.txWeights.issueLockedAsset + typicalIssueUnlockedAssetTxSize() * cfgSettings.asset.txWeights.issueUnlockedAsset + typicalTransferAssetTxSize() * cfgSettings.asset.txWeights.transferAsset) / totalWeights);
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
                payments[payIdxOffset + idx] = (payments[payIdxOffset + idx] != undefined ? payments[payIdxOffset + idx] : 0) + payAmount;
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
    paymentResolution: {
        get: function () {
            return cfgSettings.paymentResolution;
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
    }
});

// Save module function class reference
Catenis.module.Service = Object.freeze(Service);
