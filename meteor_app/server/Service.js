/**
 * Created by claudio on 30/06/16.
 */

//console.log('[Service.js]: This code just ran.');

// Module variables
//

// References to external modules
var config = Npm.require('config');

// Config entries
var serviceConfig = config.get('service');
var srvMessageConfig = serviceConfig.get('message');
var srvMsgTypTxCfgConfig = srvMessageConfig.get('typicalTxConfig');
var srvMsgTypTxCfgSendMsgConfig = srvMsgTypTxCfgConfig.get('sendMessage');
var srvMsgTypTxCfgCtnNodeSendMsgConfig = srvMsgTypTxCfgConfig.get('ctnNodeSendMessage');
var srvMsgTypTxCfgReadConfirm = srvMsgTypTxCfgConfig.get('readConfirmation');
var srvAssetConfig = serviceConfig.get('asset');
var srvAssetTxWeights = srvAssetConfig.get('txWeights');
var srvAstTypTxCfgConfig = srvAssetConfig.get('typicalTxConfig');
var srvAstTypTxCfgIssueLockedAsset = srvAstTypTxCfgConfig.get('issueLockedAsset');
var srvAstTypTxCfgIssueUnlockedAsset = srvAstTypTxCfgConfig.get('issueUnlockedAsset');
var srvAstTypTxCfgTransferAsset = srvAstTypTxCfgConfig.get('transferAsset');


// Configuration settings
var cfgSettings = {
    paymentResolution: serviceConfig.get('paymentResolution'),
    serviceCreditAmount: serviceConfig.get('serviceCreditAmount'),
    serviceCreditMultiplyFactor: serviceConfig.get('serviceCreditMultiplyFactor'),
    minFundClientsProvision: serviceConfig.get('minFundClientsProvision'),
    minFundDevicesProvision: serviceConfig.get('minFundDevicesProvision'),
    minFundMessageCreditsProvision: serviceConfig.get('minFundMessageCreditsProvision'),
    minFundAssetCreditsProvision: serviceConfig.get('minFundAssetCreditsProvision'),
    catenisNodeMessageCredits: serviceConfig.get('catenisNodeMessageCredits'),
    fundPayTxResolution: serviceConfig.get('fundPayTxResolution'),
    fundPayTxMultiplyFactor: serviceConfig.get('fundPayTxMultiplyFactor'),
    message: {
        messagesPerMinute: srvMessageConfig.get('messagesPerMinute'),
        minutesToConfirm: srvMessageConfig.get('minutesToConfirm'),
        unconfMainAddrReuses: srvMessageConfig.get('unconfMainAddrReuses'),
        fundMainAddrAmount: srvMessageConfig.get('fundMainAddrAmount'),
        fundMainAddrMultiplyFactor: srvMessageConfig.get('fundMainAddrMultiplyFactor'),
        typicalTxConfig: {
            ctnNodeSendMessage: {
                numInputs: srvMsgTypTxCfgCtnNodeSendMsgConfig.get('numInputs'),
                numOutputs: srvMsgTypTxCfgCtnNodeSendMsgConfig.get('numOutputs'),
                nullDataPlayloadSize: srvMsgTypTxCfgCtnNodeSendMsgConfig.get('nullDataPlayloadSize')
            },
            sendMessage: {
                numInputs: srvMsgTypTxCfgSendMsgConfig.get('numInputs'),
                numOutputs: srvMsgTypTxCfgSendMsgConfig.get('numOutputs'),
                nullDataPlayloadSize: srvMsgTypTxCfgSendMsgConfig.get('nullDataPlayloadSize')
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
        catenisNodeProvisionCost: catenisNodeProvisionCost(),
        numActiveCatenisNodeDeviceMainAddresses: numActiveCatenisNodeDeviceMainAddresses(),
        estimatedCatenisNodeMessageTxCost: estimatedCatenisNodeMessageTxCost(),
        typicalCatenisNodeSendMessageTxSize: typicalCatenisNodeSendMessageTxSize(),
        clientProvisionCost: clientProvisionCost(),
        deviceProvisionCost: deviceProvisionCost(),
        deviceMessageProvisionCost: deviceMessageProvisionCost(),
        numActiveDeviceMainAddresses: numActiveDeviceMainAddresses(),
        estimatedMessageTxCost: estimatedMessageTxCost(),
        estimatedSendMessageTxCost: estimatedSendMessageTxCost(),
        typicalSendMessageTxSize: typicalSendMessageTxSize(),
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
    return messageCredits * estimatedSendMessageTxCost() + unreadMessages * typicalReadConfirmationTxPayAmount() + assetCredits * estimatedAssetTxCost();
};

Service.distributeCatenisNodeDeviceMainAddressFund = function () {
    let totalAmount = numActiveCatenisNodeDeviceMainAddresses() * cfgSettings.message.fundMainAddrAmount;

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
    let totalAmount = Math.ceil((credits * estimatedMessageTxCost() * (1 + safetyFactor)) / cfgSettings.paymentResolution) * cfgSettings.paymentResolution;

    return {
        totalAmount: totalAmount,
        amountPerAddress: distributePayment(totalAmount, cfgSettings.fundPayTxResolution, cfgSettings.fundPayTxMultiplyFactor, cfgSettings.fundPayTxMultiplyFactor)
    };
};

Service.distributePayAssetTxExpenseFund = function (credits, safetyFactor = 0) {
    let totalAmount = Math.ceil((credits * estimatedAssetTxCost() * (1 + safetyFactor)) / cfgSettings.paymentResolution) * cfgSettings.paymentResolution;

    return {
        totalAmount: totalAmount,
        amountPerAddress: distributePayment(totalAmount, cfgSettings.fundPayTxResolution, cfgSettings.fundPayTxMultiplyFactor, cfgSettings.fundPayTxMultiplyFactor)
    };
};


// Service function class (public) properties
//


// Definition of module (private) functions
//

function catenisNodeProvisionCost() {
    // Includes cost to pay for expense of txs issued by Catenis Node device
    return cfgSettings.catenisNodeMessageCredits * estimatedCatenisNodeMessageTxCost();
}

function numActiveCatenisNodeDeviceMainAddresses() {
    return Math.ceil((cfgSettings.message.messagesPerMinute * cfgSettings.message.minutesToConfirm) / cfgSettings.message.unconfMainAddrReuses);
}

function estimatedCatenisNodeMessageTxCost() {
    return Math.ceil((typicalCatenisNodeSendMessageTxSize() * Catenis.bitcoinFees.getFeeRateByTime(cfgSettings.message.minutesToConfirm)) / cfgSettings.paymentResolution) * cfgSettings.paymentResolution;
}

function typicalCatenisNodeSendMessageTxSize() {
    return Catenis.module.Transaction.computeTransactionSize(cfgSettings.message.typicalTxConfig.ctnNodeSendMessage.numInputs, cfgSettings.message.typicalTxConfig.ctnNodeSendMessage.numOutputs, cfgSettings.message.typicalTxConfig.ctnNodeSendMessage.nullDataPlayloadSize);
}

function clientProvisionCost(messageCredits = cfgSettings.minFundMessageCreditsProvision, assetCredits = cfgSettings.minFundAssetCreditsProvision) {
    // Includes cost to pay for expense of txs issued by client's devices + cost to fund client service credit addresses
    return messageCredits * estimatedMessageTxCost() + assetCredits * estimatedAssetTxCost() + (messageCredits + assetCredits) * cfgSettings.serviceCreditAmount;
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

function estimatedMessageTxCost() {
    // Send message tx cost + read confirmation tx cost
    return Math.ceil((typicalSendMessageTxSize() * Catenis.bitcoinFees.getFeeRateByTime(cfgSettings.message.minutesToConfirm) + typicalReadConfirmationTxPayAmount()) / cfgSettings.paymentResolution) * cfgSettings.paymentResolution;
}

function estimatedSendMessageTxCost() {
    return Math.ceil((typicalSendMessageTxSize() * Catenis.bitcoinFees.getFeeRateByTime(cfgSettings.message.minutesToConfirm)) / cfgSettings.paymentResolution) * cfgSettings.paymentResolution;
}

function typicalSendMessageTxSize() {
    return Catenis.module.Transaction.computeTransactionSize(cfgSettings.message.typicalTxConfig.sendMessage.numInputs, cfgSettings.message.typicalTxConfig.sendMessage.numOutputs, cfgSettings.message.typicalTxConfig.sendMessage.nullDataPlayloadSize);
}

function typicalReadConfirmationTxPayAmount() {
    // Since a single transaction could be used to spend one or more
    //  read confirmation outputs (by using the RBF - Replace By Fee
    //  feature), we need to compute an average fee (paid amount) per
    //  message (read confirmation output)
    var lastFee = 0,
        lastFeeRate = 0,
        sumFeePerMsg = 0,
        numMsgs,
        txInputs = cfgSettings.message.typicalTxConfig.readConfirmation.numInputs,
        txOutputs = cfgSettings.message.typicalTxConfig.readConfirmation.numOutputs;

    for (numMsgs = 1; numMsgs <= 10; numMsgs++, txInputs++, txOutputs++) {
        // Compute transaction size
        var txSize = Catenis.module.Transaction.computeTransactionSize(txInputs, txOutputs, cfgSettings.message.typicalTxConfig.readConfirmation.nullDataPlayloadSize);

        // Calculate fee
        var feeRate = lastFeeRate + 1,
            fee = Math.ceil((txSize * feeRate) / cfgSettings.paymentResolution) * cfgSettings.paymentResolution;

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
    var totalWeights = cfgSettings.asset.txWeights.issueLockedAsset + cfgSettings.asset.txWeights.issueUnlockedAsset + cfgSettings.asset.txWeights.transferAsset;

    return Math.ceil((typicalIssueLockedAssetTxSize() * cfgSettings.asset.txWeights.issueLockedAsset + typicalIssueUnlockedAssetTxSize() * cfgSettings.asset.txWeights.issueUnlockedAsset + typicalTransferAssetTxSize() * cfgSettings.asset.txWeights.transferAsset) / totalWeights);
}

// NOTE: totalAmount should be a multiple of payAmount
function distributePayment(totalAmount, payAmount, addressesPerBatch, paysPerAddress) {
    var maxBatchAmount = payAmount * addressesPerBatch * paysPerAddress,
        remainAmount = totalAmount,
        payments = [];

    for (let batchNum = 1, maxBatches = Math.ceil(totalAmount / maxBatchAmount); batchNum <= maxBatches; batchNum++) {
        let workAmount = remainAmount > maxBatchAmount ? maxBatchAmount : remainAmount,
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
            return catenisNodeProvisionCost() + cfgSettings.minFundClientsProvision * clientProvisionCost() + cfgSettings.minFundClientsProvision * cfgSettings.minFundDevicesProvision * deviceProvisionCost();
        },
        enumerable: true
    }
});

// Save module function class reference
if (typeof Catenis === 'undefined')
    Catenis = {};

if (typeof Catenis.module === 'undefined')
    Catenis.module = {};

Catenis.module.Service = Object.freeze(Service);
