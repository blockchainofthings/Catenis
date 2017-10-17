/**
 * Created by claudio on 03/07/17.
 */

//console.log('[ReadConfirmTransaction.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//  NOTE: the reference of these modules are done using 'require()' instead of 'import' to
//      to avoid annoying WebStorm warning message: 'default export is not defined in
//      imported module'
const util = require('util');
// Third-party node modules
//import config from 'config';
import _und from 'underscore';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { Transaction } from './Transaction';
import { KeyStore } from './KeyStore';
import { RbfTransactionInfo } from './RbfTransactionInfo';
import { Service } from './Service';
import { ReadConfirmation } from './ReadConfirmation';
import { FundSource } from './FundSource';
import { Util } from './Util';
import { MalleabilityEventEmitter } from './MalleabilityEventEmitter';
import { CatenisNode } from './CatenisNode';

// Config entries
/*const config_entryConfig = config.get('config_entry');

// Configuration settings
const cfgSettings = {
    property: config_entryConfig.get('property_name')
};*/


// Definition of function classes
//

// ReadConfirmTransaction function class
export function ReadConfirmTransaction(transact) {
    // Definition of properties
    Object.defineProperties(this, {
        readConfirmAddrInputCount: {
            get: function () {
                //noinspection JSPotentiallyInvalidUsageOfThis
                return this.readConfirmAddrSpndNullInputCount + this.readConfirmAddrSpndOnlyInputCount + this.readConfirmAddrSpndNtfyInputCount;
            },
            enumerable: false
        },
        nextReadConfirmAddrSpndNullInputPos: {
            get: function () {
                //noinspection JSPotentiallyInvalidUsageOfThis
                return this.readConfirmAddrSpndNullInputCount;
            },
            enumerable: false
        },
        nextReadConfirmAddrSpndOnlyInputPos: {
            get: function () {
                //noinspection JSPotentiallyInvalidUsageOfThis
                return this.readConfirmAddrSpndNullInputCount + this.readConfirmAddrSpndOnlyInputCount;
            },
            enumerable: false
        },
        nextReadConfirmAddrSpndNtfyInputPos: {
            get: function () {
                //noinspection JSPotentiallyInvalidUsageOfThis
                return this.readConfirmAddrSpndNullInputCount + this.readConfirmAddrSpndOnlyInputCount + this.readConfirmAddrSpndNtfyInputCount;
            },
            enumerable: false
        },
        startReadConfirmAddrSpndNtfyInputPos: {
            get: function () {
                //noinspection JSPotentiallyInvalidUsageOfThis
                return this.readConfirmAddrSpndNtfyInputCount > 0 ? this.readConfirmAddrSpndNullInputCount + this.readConfirmAddrSpndOnlyInputCount : -1;
            },
            enumerable: false
        },
        readConfirmSpendNullOutputPos: {
            get: function () {
                //noinspection JSPotentiallyInvalidUsageOfThis
                return this.hasReadConfirmSpendNullOutput ? 0 : -1;
            },
            enumerable: false
        },
        readConfirmSpendOnlyOutputPos: {
            get: function () {
                //noinspection JSPotentiallyInvalidUsageOfThis
                return this.hasReadConfirmSpendOnlyOutput ? (this.hasReadConfirmSpendNullOutput ? 1 : 0) : -1;
            },
            enumerable: false
        },
        lastReadConfirmSpendOutputPos: {
            get: function () {
                //noinspection JSPotentiallyInvalidUsageOfThis
                return this.ctnNdIdxReadConfirmSpndNtfyOutRelPos.size - 1 + (this.hasReadConfirmSpendNullOutput ? 1 : 0) + (this.hasReadConfirmSpendOnlyOutput ? 1 : 0);
            },
            enumerable: false
        },
        lastTxChangeTxout: {
            get: function () {
                let txout;

                //noinspection JSPotentiallyInvalidUsageOfThis
                if (this.lastTxChangeOutputPos > 0) {
                    //noinspection JSPotentiallyInvalidUsageOfThis
                    txout = {
                        txid: this.lastTxid,
                        vout: this.lastTxChangeOutputPos
                    }
                }

                return txout;
            },
            enumerable: true
        }
    });

    if (transact) {
        // Initialize object with existing (read confirmation) transaction
        this.transact = transact;

        // Compute number of inputs that are associated with a device read confirmation address output,
        //  and also identify the inputs that are used to pay for the transaction fee
        let numReadConfirmAddrInputs = 0;
        this.payFeeInputTxouts = [];

        this.transact.inputs.forEach((input, idx) => {
            if (input.addrInfo !== undefined) {
                if (input.addrInfo.type === KeyStore.extKeyType.dev_read_conf_addr.name) {
                    // Increment number of read confirmation address inputs
                    numReadConfirmAddrInputs++;
                }
                else if (input.addrInfo.type === KeyStore.extKeyType.sys_read_conf_pay_tx_exp_addr.name) {
                    // Save input used to pay for the transaction fee
                    this.payFeeInputTxouts.push(input.txout);
                }
                else {
                    // Transaction has an input of an invalid type.
                    //  Log error condition and throw exception
                    Catenis.logger.ERROR('Inconsistent read confirmation transaction; transaction has an input of an invalid type', {
                        txid: this.transact.txid,
                        input: input,
                        inputPosition: idx
                    });
                    throw new Error('Inconsistent read confirmation transaction; transaction has an input of an invalid type');
                }
            }
            else {
                // Transaction has an input of an unknown type.
                //  Log error condition and throw exception
                Catenis.logger.ERROR('Inconsistent read confirmation transaction; transaction has an input of an unknown type', {
                    txid: this.transact.txid,
                    input: input,
                    inputPosition: idx
                });
                throw new Error('Inconsistent read confirmation transaction; transaction has an input of an unknown type');
            }
        });

        // Initialize variables used to control inputs and outputs
        this.readConfirmAddrSpndNullInputCount = 0;
        this.readConfirmAddrSpndOnlyInputCount = 0;
        this.readConfirmAddrSpndNtfyInputCount = 0;
        this.hasReadConfirmSpendNullOutput = false;
        this.hasReadConfirmSpendOnlyOutput = false;
        this.ctnNdIdxReadConfirmSpndNtfyOutRelPos = new Map();

        this.transact.outputs.forEach((output, idx) => {
            if (output.payInfo.addrInfo !== undefined) {
                if (output.payInfo.addrInfo.type === KeyStore.extKeyType.sys_read_conf_spnd_ntfy_addr.name) {
                    // Save position of output associated with system read confirmation spend notify address
                    //  and continue iteration
                    setReadConfirmSpendNotifyOutputPos.call(this, output.payInfo.addrInfo.pathParts.ctnNodeIndex);

                    // Compute number of read confirmation spend notify address inputs
                    let amount = output.payInfo.amount;

                    for (let pos = this.nextReadConfirmAddrSpndNtfyInputPos; amount > 0 && pos < numReadConfirmAddrInputs; pos++) {
                        amount -= this.transact.inputs[pos].txout.amount;

                        if (amount >= 0) {
                            this.readConfirmAddrSpndNtfyInputCount++;
                        }
                    }

                    if (amount !== 0) {
                        // Not all amount in spend notify output mapped to a read confirmation address input.
                        //  Log error condition and throw exception
                        Catenis.logger.ERROR('Inconsistent read confirmation transaction; not all amount in spend notify output mapped to read confirmation address inputs', {
                            txid: this.transact.txid,
                            output: output,
                            outputPosition: idx
                        });
                        throw new Error('Inconsistent read confirmation transaction; not all amount in spend notify output mapped to read confirmation address inputs');
                    }
                }
                else if (output.payInfo.addrInfo.type === KeyStore.extKeyType.sys_read_conf_spnd_only_addr.name) {
                    // Read confirmation spend only output type

                    // Make sure that this type of output is not yet present
                    if (this.hasReadConfirmSpendOnlyOutput) {
                        // An output of this type already exists.
                        //  Log error condition and throw exception
                        Catenis.logger.ERROR('Inconsistent read confirmation transaction; more than one spend only output', {
                            txid: this.transact.txid,
                            outputs: this.transact.outputs
                        });
                        throw new Error('Inconsistent read confirmation transaction; more than one spend only output');
                    }

                    // Indicate that spend only output is present
                    this.hasReadConfirmSpendOnlyOutput = true;

                    // Check if output position is valid
                    if (idx !== this.readConfirmSpendOnlyOutputPos) {
                        // Output position is not valid.
                        //  Log error condition and throw exception
                        Catenis.logger.ERROR('Inconsistent read confirmation transaction; invalid spend only output position', {
                            txid: this.transact.txid,
                            outputs: this.transact.outputs,
                            outputPosition: idx
                        });
                        throw new Error('Inconsistent read confirmation transaction; invalid spend only output position');
                    }

                    // Compute number of read confirmation spend only address inputs
                    let amount = output.payInfo.amount;

                    for (let pos = this.nextReadConfirmAddrSpndOnlyInputPos; amount > 0 && pos < numReadConfirmAddrInputs; pos++) {
                        amount -= this.transact.inputs[pos].txout.amount;

                        if (amount >= 0) {
                            this.readConfirmAddrSpndOnlyInputCount++;
                        }
                    }

                    if (amount !== 0) {
                        // Not all amount in spend only output mapped to a read confirmation address input.
                        //  Log error condition and throw exception
                        Catenis.logger.ERROR('Inconsistent read confirmation transaction; not all amount in spend only output mapped to ead confirmation address inputs', {
                            txid: this.transact.txid,
                            output: output,
                            outputPosition: idx
                        });
                        throw new Error('Inconsistent read confirmation transaction; not all amount in spend only output mapped to read confirmation address inputs');
                    }
                }
                else if (output.payInfo.addrInfo.type === KeyStore.extKeyType.sys_read_conf_spnd_null_addr.name) {
                    // Read confirmation spend null output type

                    // Make sure that this type of output is not yet present
                    if (this.hasReadConfirmSpendNullOutput) {
                        // An output of this type already exists.
                        //  Log error condition and throw exception
                        Catenis.logger.ERROR('Inconsistent read confirmation transaction; more than one spend null output', {
                            txid: this.transact.txid,
                            outputs: this.transact.outputs
                        });
                        throw new Error('Inconsistent read confirmation transaction; more than one spend null output');
                    }

                    // Indicate that spend null output is present
                    this.hasReadConfirmSpendNullOutput = true;

                    // Check if output position is valid
                    if (idx !== this.readConfirmSpendNullOutputPos) {
                        // Output position is not valid.
                        //  Log error condition and throw exception
                        Catenis.logger.ERROR('Inconsistent read confirmation transaction; invalid spend null output position', {
                            txid: this.transact.txid,
                            outputs: this.transact.outputs,
                            outputPosition: idx
                        });
                        throw new Error('Inconsistent read confirmation transaction; invalid spend null output position');
                    }

                    // Compute number of read confirmation spend null address inputs
                    let amount = output.payInfo.amount;

                    for (let pos = this.nextReadConfirmAddrSpndNullInputPos; amount > 0 && pos < numReadConfirmAddrInputs; pos++) {
                        amount -= this.transact.inputs[pos].txout.amount;

                        if (amount >= 0) {
                            this.readConfirmAddrSpndNullInputCount++;
                        }
                    }

                    if (amount !== 0) {
                        // Not all amount in spend null output mapped to a read confirmation address input.
                        //  Log error condition and throw exception
                        Catenis.logger.ERROR('Inconsistent read confirmation transaction; not all amount in spend null output mapped to read confirmation address inputs', {
                            txid: this.transact.txid,
                            output: output,
                            outputPosition: idx
                        });
                        throw new Error('Inconsistent read confirmation transaction; not all amount in spend null output mapped to read confirmation address inputs');
                    }
                }
                else if (!output.payInfo.addrInfo.type === KeyStore.extKeyType.sys_read_conf_pay_tx_exp_addr.name) {
                    // Transaction has an output of an invalid type.
                    //  Log error condition and throw exception
                    Catenis.logger.ERROR('Inconsistent read confirmation transaction; transaction has an output of an invalid type', {
                        txid: this.transact.txid,
                        output: output,
                        outputPosition: idx
                    });
                    throw new Error('Inconsistent read confirmation transaction; transaction has an output of an invalid type');
                }
            }
            else {
                // Transaction has an output of an unknown type.
                //  Log error condition and throw exception
                Catenis.logger.ERROR('Inconsistent read confirmation transaction; transaction has an output of an unknown type', {
                    txid: this.transact.txid,
                    output: output,
                    outputPosition: idx
                });
                throw new Error('Inconsistent read confirmation transaction; transaction has an output of an unknown type');
            }
        });

        // Make sure that total amount of read confirm address inputs matches total amount of read confirm spend outputs
        if (this.transact.totalInputsAmount(0, this.readConfirmAddrInputCount - 1) !== this.transact.totalOutputsAmount(0, this.lastReadConfirmSpendOutputPos)) {
            // Log error condition and throw exception
            Catenis.logger.ERROR('Inconsistent read confirmation transaction; total amount of read confirmation address inputs does not match total amount of read confirmation spend outputs', {
                inputs: this.transact.inputs,
                outputs: this.transact.outputs
            });
            throw new Error('Inconsistent read confirmation transaction; total amount of read confirmation address inputs does not match total amount of read confirmation spend outputs');
        }

        // Determine current fee and current change
        this.fee = this.transact.totalInputsAmount() - this.transact.totalOutputsAmount();
        this.change = this.transact.totalOutputsAmount(this.lastReadConfirmSpendOutputPos + 1);
        this.txChanged = false;
        this.txFunded = true;

        // Instantiate RBF tx info object
        initReadConfirmTxInfo.call(this);

        this.lastTxChangeOutputPos = this.change > 0 ? this.lastReadConfirmSpendOutputPos + 1 : -1;
        retrieveReplacedTransactionIds.call(this);
        newTransactionId.call(this, this.transact.txid);
    }
    else {
        this.transact = new Transaction(true);
        this.payFeeInputTxouts = [];
        this.readConfirmAddrSpndNullInputCount = 0;
        this.readConfirmAddrSpndOnlyInputCount = 0;
        this.readConfirmAddrSpndNtfyInputCount = 0;
        this.hasReadConfirmSpendNullOutput = false; // If it is present, it will always be the first output
        this.hasReadConfirmSpendOnlyOutput = false; // If it is present, it will always follow the spend null output
        this.ctnNdIdxReadConfirmSpndNtfyOutRelPos = new Map(); // Contains a map of relative position
        this.fee = 0;
        this.change = 0;
        this.txChanged = false;
        this.txFunded = false;
        this.txids = [];
        this.lastTxid = undefined;
        this.lastTxChangeOutputPos = -1;
    }

    // Set up handler for event notifying that txid has changed due to malleability
    this.txidChangedEventHandler = TransactIdChanged.bind(this);

    Catenis.malleabilityEventEmitter.on(MalleabilityEventEmitter.notifyEvent.txid_changed.name, this.txidChangedEventHandler);
}


// Public ReadConfirmTransaction object methods
//

// Check whether all send message transactions the read confirm address outputs of which
//  spent by this read confirmation transaction are already confirmed
ReadConfirmTransaction.prototype.areReadConfirmAddrTxConfirmed = function () {
    let result = true;

    for (let inputPos = 0; inputPos < this.nextReadConfirmAddrSpndNtfyInputPos; inputPos++) {
        const input = this.transact.getInputAt(inputPos);
        const txoutInfo = Catenis.bitcoinCore.getTxOut(input.txout.txid, input.txout.vout);

        if (txoutInfo.confirmations === 0) {
            result = false;
            break;
        }
    }

    return result;
};

// Checks whether a transaction output is used to pay for transaction fee
ReadConfirmTransaction.prototype.isTxOutputUsedToPayFee = function (txout) {
    return this.payFeeInputTxouts.some((inTxout) => {
        return inTxout.txid === txout.txid && inTxout.vout === txout.vout;
    });
};

// Checks whether a transction ID has been used for this read confirmation transaction
ReadConfirmTransaction.prototype.hasTxidBeenUsed = function (txid) {
    return this.txids.some((usedTxid) => {
        return usedTxid === txid;
    })
};

// Method used to set up a predefined set of inputs and outputs for the transaction
//
//  Arguments:
//   inputs [Array(Object)] - Array of input objects as defined for the Transaction function class (see its constructor)
//   outputs: [Array(Object)] - Array of output objects as defined for the Transactions function class (see its constructor)
ReadConfirmTransaction.prototype.initInputsOutputs = function (inputs, outputs) {
    // Make sure that transaction is not yet funded
    if (!this.txFunded) {
        // Make sure that no inputs or outputs have been added yet
        if (this.readConfirmAddrInputCount > 0 || this.lastReadConfirmSpendOutputPos >= 0) {
            // Trying to to initialize inputs and outputs of read confirmation transaction that is not empty.
            //  Log warning condition and return
            Catenis.logger.WARN('Trying to to initialize inputs and outputs of read confirmation transaction that is not empty', {readConfirmTransaction: this});
            return;
        }

        // Filter out inputs that are associated with a device read confirmation address output
        const readConfirmAddrInputs = [];

        inputs.forEach((input) => {
            if (input.addrInfo.type === KeyStore.extKeyType.dev_read_conf_addr.name) {
                readConfirmAddrInputs.push(input);
            }
            else {
                // An unexpected input type. Log warning condition
                Catenis.logger.WARN('Unexpected input type passed to initialize read confirmation transaction; input discarded', {
                    input: input
                });
            }
        });

        // Add inputs
        this.transact.addInputs(readConfirmAddrInputs);

        // Prepare to add outputs and initialize variables used to control inputs and outputs
        const readConfirmSpendOutputs = [];
        this.readConfirmAddrSpndNullInputCount = 0;
        this.readConfirmAddrSpndOnlyInputCount = 0;
        this.readConfirmAddrSpndNtfyInputCount = 0;
        this.hasReadConfirmSpendNullOutput = false;
        this.hasReadConfirmSpendOnlyOutput = false;
        this.ctnNdIdxReadConfirmSpndNtfyOutRelPos = new Map();

        outputs.forEach((output, idx) => {
            // Make sure that output has address info
            if (output.payInfo.addrInfo === undefined) {
                output.payInfo.addrInfo = Catenis.keyStore.getAddressInfo(output.payInfo.address, true);
            }

            if (output.payInfo.addrInfo.type === KeyStore.extKeyType.sys_read_conf_spnd_ntfy_addr.name) {
                // Save position of output associated with system read confirmation spend notify address
                setReadConfirmSpendNotifyOutputPos.call(this, output.payInfo.addrInfo.pathParts.ctnNodeIndex);

                // Compute number of read confirmation spend notify address inputs
                let amount = output.payInfo.amount;

                for (let pos = this.nextReadConfirmAddrSpndNtfyInputPos; amount > 0 && pos < readConfirmAddrInputs.length; pos++) {
                    amount -= readConfirmAddrInputs[pos].txout.amount;

                    if (amount >= 0) {
                        this.readConfirmAddrSpndNtfyInputCount++;
                    }
                }

                if (amount !== 0) {
                    // Not all amount in spend notify output mapped to a read confirmation address input.
                    //  Log error condition and throw exception
                    Catenis.logger.ERROR('Inconsistency of data used to initialize read confirmation transaction; not all amount in spend notify output mapped to read confirmation address inputs', {
                        inputs: readConfirmAddrInputs,
                        outputs: outputs,
                        outputPosition: idx
                    });
                    throw new Error('Inconsistency of data used to initialize read confirmation transaction; not all amount in spend notify output mapped to read confirmation address inputs');
                }

                // Save output to be added
                readConfirmSpendOutputs.push(output);
            }
            else if (output.payInfo.addrInfo.type === KeyStore.extKeyType.sys_read_conf_spnd_only_addr.name) {
                // Read confirmation spend only output type

                // Make sure that this type of output is not yet present
                if (this.hasReadConfirmSpendOnlyOutput) {
                    // An output of this type already exists.
                    //  Log error condition and throw exception
                    Catenis.logger.ERROR('Inconsistency of data used to initialize read confirmation transaction; more than one spend only output', {
                        outputs: outputs
                    });
                    throw new Error('Inconsistency of data used to initialize read confirmation transaction; more than one spend only output');
                }

                // Indicate that spend only output is present
                this.hasReadConfirmSpendOnlyOutput = true;

                // Check if output position is valid
                if (idx !== this.readConfirmSpendOnlyOutputPos) {
                    // Output position is not valid.
                    //  Log error condition and throw exception
                    Catenis.logger.ERROR('Inconsistency of data used to initialize read confirmation transaction; invalid spend only output position', {
                        outputs: outputs,
                        outputPosition: idx
                    });
                    throw new Error('Inconsistency of data used to initialize read confirmation transaction; invalid spend only output position');
                }

                // Compute number of read confirmation spend only address inputs
                let amount = output.payInfo.amount;

                for (let pos = this.nextReadConfirmAddrSpndOnlyInputPos; amount > 0 && pos < readConfirmAddrInputs.length; pos++) {
                    amount -= readConfirmAddrInputs[pos].txout.amount;

                    if (amount >= 0) {
                        this.readConfirmAddrSpndOnlyInputCount++;
                    }
                }

                if (amount !== 0) {
                    // Not all amount in spend only output mapped to a read confirmation address input.
                    //  Log error condition and throw exception
                    Catenis.logger.ERROR('Inconsistency of data used to initialize read confirmation transaction; not all amount in spend only output mapped to read confirmation address inputs', {
                        inputs: readConfirmAddrInputs,
                        outputs: outputs,
                        outputPosition: idx
                    });
                    throw new Error('Inconsistency of data used to initialize read confirmation transaction; not all amount in spend only output mapped to read confirmation address inputs');
                }

                // Save output to be added
                readConfirmSpendOutputs.push(output);
            }
            else if (output.payInfo.addrInfo.type === KeyStore.extKeyType.sys_read_conf_spnd_null_addr.name) {
                // Read confirmation spend null output type

                // Make sure that this type of output is not yet present
                if (this.hasReadConfirmSpendNullOutput) {
                    // An output of this type already exists.
                    //  Log error condition and throw exception
                    Catenis.logger.ERROR('Inconsistency of data used to initialize read confirmation transaction; more than one spend null output', {
                        outputs: outputs
                    });
                    throw new Error('Inconsistency of data used to initialize read confirmation transaction; more than one spend null output');
                }

                // Indicate that spend null output is present
                this.hasReadConfirmSpendNullOutput = true;

                // Check if output position is valid
                if (idx !== this.readConfirmSpendOnlyOutputPos) {
                    // Output position is not valid.
                    //  Log error condition and throw exception
                    Catenis.logger.ERROR('Inconsistency of data used to initialize read confirmation transaction; invalid spend null output position', {
                        outputs: outputs,
                        outputPosition: idx
                    });
                    throw new Error('Inconsistency of data used to initialize read confirmation transaction; invalid spend null output position');
                }

                // Compute number of read confirmation spend null address inputs
                let amount = output.payInfo.amount;

                for (let pos = this.nextReadConfirmAddrSpndNullInputPos; amount > 0 && pos < readConfirmAddrInputs.length; pos++) {
                    amount -= readConfirmAddrInputs[pos].txout.amount;

                    if (amount >= 0) {
                        this.readConfirmAddrSpndNullInputCount++;
                    }
                }

                if (amount !== 0) {
                    // Not all amount in spend null output mapped to a read confirmation address input.
                    //  Log error condition and throw exception
                    Catenis.logger.ERROR('Inconsistency of data used to initialize read confirmation transaction; not all amount in spend null output mapped to read confirmation address inputs', {
                        inputs: readConfirmAddrInputs,
                        outputs: outputs,
                        outputPosition: idx
                    });
                    throw new Error('Inconsistency of data used to initialize read confirmation transaction; not all amount in spend null output mapped to read confirmation address inputs');
                }

                // Save output to be added
                readConfirmSpendOutputs.push(output);
            }
            else {
                // Unexpected output type. Log warning condition
                Catenis.logger.WARN('Unexpected output type passed to initialize read confirmation transaction; output discarded', {
                    output: output
                });
            }
        });

        // Add outputs
        this.transact.addOutputs(readConfirmSpendOutputs);

        // Make sure that total amount of added inputs matches total amount of added outputs
        if (this.transact.totalInputsAmount() !== this.transact.totalOutputsAmount()) {
            // Log error condition and throw exception
            Catenis.logger.ERROR('Inconsistency of data used to initialize read confirmation transaction; total amount of inputs does not match total amount of outputs', {
                inputs: this.transact.inputs,
                outputs: this.transact.outputs
            });
            throw new Error('Inconsistency of data used to initialize read confirmation transaction; total amount of inputs does not match total amount of outputs');
        }

        if (readConfirmAddrInputs.length > 0 || readConfirmSpendOutputs.length > 0) {
            // Indicate that transaction has changed
            this.txChanged = true;
        }
    }
    else {
        // Trying to initialize inputs and outputs of read confirmation transaction that is already funded.
        //  Log warning condition
        Catenis.logger.WARN("Trying to initialized inputs and outputs of read confirmation transaction that is already funded", {readConfirmTransaction: this});
    }
};

ReadConfirmTransaction.prototype.needsToFund = function () {
    return this.txChanged && !this.txFunded;
};

ReadConfirmTransaction.prototype.needsToSend = function () {
    return this.txChanged && this.txFunded;
};

ReadConfirmTransaction.prototype.addSendMsgTxToConfirm = function (sendMsgTransact, readConfirmOutputPos, confirmType) {
    const readConfirmOutput = sendMsgTransact.transact.getOutputAt(readConfirmOutputPos);

    // Prepare input to add
    const readConfirmAddrInput = {
        txout: {
            txid: sendMsgTransact.transact.txid,
            vout: readConfirmOutputPos,
            amount: readConfirmOutput.payInfo.amount,
        },
        address: readConfirmOutput.payInfo.address,
        addrInfo: readConfirmOutput.payInfo.addrInfo
    };

    // Add proper input and output according to the type of confirmation
    let newOutputAdded = false;

    if (confirmType === ReadConfirmation.confirmationType.spendNotify) {
        // Spend notify
        newOutputAdded = addReadConfirmAddrSpendNotify.call(this, readConfirmAddrInput, sendMsgTransact.originDevice.client.ctnNode);
    }
    else if (confirmType === ReadConfirmation.confirmationType.spendOnly) {
        // Spend only
        newOutputAdded = addReadConfirmAddrSpendOnly.call(this, readConfirmAddrInput);
    }
    else if (confirmType === ReadConfirmation.confirmationType.spendNull) {
        // Spend null
        newOutputAdded = addReadConfirmAddrSpendNull.call(this, readConfirmAddrInput);
    }

    if (this.readConfirmTxInfo) {
        // Update read confirmation tx info
        this.readConfirmTxInfo.incrementNumTxInputs(1);

        if (newOutputAdded) {
            this.readConfirmTxInfo.incrementNumTxOutputs(1);
        }
    }

    // Indicate that tx needs to be funded
    this.txChanged = true;
    this.txFunded = false;
};

// Method used to merge inputs and outputs of another read confirmation transaction with this one
//
//  NOTE: it is assumed that a transaction is not a replacement for the other, and as suck that
//      they do not share the same inputs
ReadConfirmTransaction.prototype.mergeReadConfirmTransaction = function (readConfirmTransact) {
    let newInputAdded = false;

    // Process read confirmation address to spend null
    for (let inputPos = 0; inputPos < readConfirmTransact.nextReadConfirmAddrSpndNullInputPos; inputPos++) {
        const newOutputAdded = addReadConfirmAddrSpendNull.call(this, readConfirmTransact.transact.getInputAt(inputPos), readConfirmTransact.transact.getOutputAt(readConfirmTransact.readConfirmSpendNullOutputPos).payInfo.address);

        if (this.readConfirmTxInfo) {
            // Update read confirmation tx info
            this.readConfirmTxInfo.incrementNumTxInputs(1);

            if (newOutputAdded) {
                this.readConfirmTxInfo.incrementNumTxOutputs(1);
            }
        }

        newInputAdded = true;
    }

    // Process read confirmation address to spend only
    for (let inputPos = readConfirmTransact.nextReadConfirmAddrSpndNullInputPos; inputPos < readConfirmTransact.nextReadConfirmAddrSpndOnlyInputPos; inputPos++) {
        const newOutputAdded = addReadConfirmAddrSpendOnly.call(this, readConfirmTransact.transact.getInputAt(inputPos), readConfirmTransact.transact.getOutputAt(readConfirmTransact.readConfirmSpendOnlyOutputPos).payInfo.address);

        if (this.readConfirmTxInfo) {
            // Update read confirmation tx info
            this.readConfirmTxInfo.incrementNumTxInputs(1);

            if (newOutputAdded) {
                this.readConfirmTxInfo.incrementNumTxOutputs(1);
            }
        }

        newInputAdded = true;
    }

    // Process read confirmation address to spend notify
    let inputPos = readConfirmTransact.startReadConfirmAddrSpndNtfyInputPos;

    for (let ctnNodeIdx of readConfirmTransact.ctnNdIdxReadConfirmSpndNtfyOutRelPos.keys()) {
        const ctnNode = CatenisNode.getCatenisNodeByIndex(ctnNodeIdx);
        const readConfirmSpendNotifyOutput = readConfirmTransact.transact.getOutputAt(getReadConfirmSpendNotifyOutputPos.call(readConfirmTransact, ctnNodeIdx));
        let amountLeft = readConfirmSpendNotifyOutput.payInfo.amount;

        do {
            const input = readConfirmTransact.transact.getInputAt(inputPos);
            const newOutputAdded = addReadConfirmAddrSpendNotify.call(this, input, ctnNode, readConfirmSpendNotifyOutput.payInfo.address);

            if (this.readConfirmTxInfo) {
                // Update read confirmation tx info
                this.readConfirmTxInfo.incrementNumTxInputs(1);

                if (newOutputAdded) {
                    this.readConfirmTxInfo.incrementNumTxOutputs(1);
                }
            }

            newInputAdded = true;

            amountLeft -= input.txout.amount;
            inputPos++;
        }
        while (amountLeft > 0);
    }

    if (newInputAdded) {
        // Indicate that tx needs to be funded
        this.txChanged = true;
        this.txFunded = false;
    }
};

// NOTE: make sure that this method is called from code executed from the FundSource.utxoCS critical section object
ReadConfirmTransaction.prototype.fundTransaction = function () {
    // Make sure that transaction is not yet funded
    if (!this.txFunded) {
        if (this.readConfirmTxInfo === undefined) {
            initReadConfirmTxInfo.call(this);
        }

        let numAddPayFeeInputs = 0;
        let nothingToDo = false;
        let readConfirmPayTxExpenseFundSource;

        do {
            // Get new fee to pay for transaction
            const txNewFee = this.readConfirmTxInfo.getNewTxFee();

            if (txNewFee.fee > this.fee) {
                let deltaFee = txNewFee.fee - this.fee;

                // See if we can use current change to cover fee increase
                if (this.change >= deltaFee) {
                    let newChange = this.change - deltaFee;

                    // Make sure that change amount is not below dust amount
                    if (newChange > 0 && newChange < Transaction.txOutputDustAmount) {
                        deltaFee += newChange;
                        newChange = 0;
                    }

                    // Adjust change
                    this.change = newChange;

                    if (newChange === 0) {
                        // Remove output to receive change
                        this.transact.removeOutputAt(this.lastReadConfirmSpendOutputPos + 1);
                        this.readConfirmTxInfo.incrementNumTxOutputs(-1);
                    }
                    else {
                        // Reset amount of change output
                        this.transact.resetOutputAmount(this.lastReadConfirmSpendOutputPos + 1, newChange);
                    }

                    // Update transaction fee and adjust it on RBF tx info object
                    this.fee += deltaFee;
                    this.readConfirmTxInfo.adjustNewTxFee(this.fee);

                    // And indicate that tx has been funded
                    this.txFunded = true;
                }
                else {
                    // Change is not enough to cover fee increase
                    if (numAddPayFeeInputs === 0) {
                        // Assume that tx will require an output for change. So make
                        //  sure that it has a change output
                        if (this.change === 0) {
                            // Transaction did not have change output, so add one now
                            this.readConfirmTxInfo.incrementNumTxOutputs(1);
                        }

                        // And add one more input to pay for tx fee
                        this.readConfirmTxInfo.incrementNumTxInputs(1);
                        numAddPayFeeInputs = 1;

                        // Do not indicate that tx has been funded so an new fee shall be recalculated
                    }
                    else {
                        // Try to allocate UTXOs to pay for transaction additional fee
                        if (readConfirmPayTxExpenseFundSource === undefined) {
                            // Object used to allocate UTXOs is not instantiated yet. Instantiate it now,
                            //  making sure that UTXO of last change be excluded
                            readConfirmPayTxExpenseFundSource = new FundSource(Catenis.ctnHubNode.readConfirmPayTxExpenseAddr.listAddressesInUse(),
                                {}, this.lastTxChangeOutputPos >= 0 ? Util.txoutToString({
                                    txid: this.lastTxid,
                                    vout: this.lastTxChangeOutputPos
                                }) : undefined);
                        }

                        const allocResult = readConfirmPayTxExpenseFundSource.allocateFund(deltaFee);

                        if (allocResult === null) {
                            // Unable to allocate UTXOs. Log error condition and throw exception
                            Catenis.logger.ERROR('No UTXO available to be allocated to pay for expense of read confirmation transaction');
                            throw new Meteor.Error('ctn_read_confirm_no_utxo_pay_tx_expense', 'No UTXO available to be allocated to pay for expense of read confirmation transaction');
                        }

                        if (allocResult.utxos.length === numAddPayFeeInputs) {
                            // Number of allocated UTXOs matches number of additional inputs to pay for tx fee.
                            //  Add inputs spending the allocated UTXOs to the transaction
                            const inputs = allocResult.utxos.map((utxo) => {
                                return {
                                    txout: utxo.txout,
                                    address: utxo.address,
                                    addrInfo: Catenis.keyStore.getAddressInfo(utxo.address)
                                }
                            });

                            this.transact.addInputs(inputs);

                            // Save inputs used to pay for transaction fee
                            inputs.forEach((input) => {
                                this.payFeeInputTxouts.push(input.txout);
                            });

                            // Update transaction fee
                            this.fee += deltaFee;

                            if (allocResult.changeAmount === 0) {
                                // No change output needed
                                if (this.change > 0) {
                                    // Transaction had a change output, remove it and try to discard its address
                                    this.transact.removeOutputAt(this.lastReadConfirmSpendOutputPos + 1);
                                    this.transact.revertOutputAddresses(this.lastReadConfirmSpendOutputPos + 1, this.lastReadConfirmSpendOutputPos + 1);
                                }

                                // Remove change output from RBF tx info object and adjust fee
                                this.readConfirmTxInfo.incrementNumTxOutputs(-1);
                                this.readConfirmTxInfo.adjustNewTxFee(this.fee);
                            }
                            else {
                                // A change output is required
                                if (this.change === 0) {
                                    // Transaction did not have a change output yet, so add a new one
                                    this.transact.addP2PKHOutput(Catenis.ctnHubNode.readConfirmPayTxExpenseAddr.newAddressKeys().getAddress(), allocResult.changeAmount);
                                }
                                else {
                                    // Transaction already had change output, so just reset its amount
                                    this.transact.resetOutputAmount(this.lastReadConfirmSpendOutputPos + 1, allocResult.changeAmount);
                                }
                            }

                            // Update transaction change
                            this.change = allocResult.changeAmount;

                            // And indicate that tx has been funded
                            this.txFunded = true;
                        }
                        else {
                            if (allocResult.utxos.length > numAddPayFeeInputs) {
                                // Number of allocated UTXOs greater than number of additional inputs to pay for tx fee.
                                //  Increment number of additional inputs to pay for tx fee
                                this.readConfirmTxInfo.incrementNumTxInputs(1);
                                numAddPayFeeInputs++;

                                // Release current allocated UTXOs to start over
                                readConfirmPayTxExpenseFundSource.clearAllocatedUtxos();

                                // Do not indicate that tx has been funded so an new fee shall be recalculated
                            }
                            else {
                                // Number of allocated UTXOs less than number of additional inputs to pay for tx fee
                                //  NOTE: this should NEVER happen
                                Catenis.logger.ERROR('Number of allocated UTXOs less than number of additional inputs to pay for tx fee', {
                                    numAllocatedUtxos: allocResult.utxos.length,
                                    numAddPayFeeInputs: numAddPayFeeInputs
                                });
                                throw new Meteor.Error('ctn_read_confirm_fund_tx_error', 'Number of allocated UTXOs less than number of additional inputs to pay for tx fee');
                            }
                        }
                    }
                }
            }
            else {
                // New fee is the same as transaction's previous fee.
                //  Indicate that there is nothing to do
                nothingToDo = true;
            }
        }
        while (!this.txFunded && !nothingToDo);

        if (this.txFunded) {
            this.readConfirmTxInfo.confirmTxFee();
        }
    }
    else {
        // Trying to fund read confirmation transaction that is already funded.
        //  Log warning condition
        Catenis.logger.WARN("Trying to fund read confirmation transaction that is already funded", {readConfirmTransaction: this});
    }
};

//  Return value:
//    txid [String] - ID of blockchain transaction that had been issued and sent
ReadConfirmTransaction.prototype.sendTransaction = function () {
    // Make sure that transaction has already been funded
    if (this.txFunded) {
        // Check if transaction has not yet been created and sent
        if (this.transact.txid === undefined) {
            this.transact.sendTransaction();

            // Reset indication that tx had changed
            this.txChanged = false;

            this.readConfirmTxInfo.setRealTxSize(this.transact.realSize());

            // Save sent transaction onto local database
            this.transact.saveSentTransaction(Transaction.type.read_confirmation, {
                serializedTx: _und.omit(JSON.parse(this.transact.serialize()), 'useOptInRBF', 'txid'),
                spentReadConfirmTxOutCount: this.readConfirmAddrInputCount
            });

            if (this.lastTxid !== undefined) {
                // Update entry of previous read confirmation transaction to indicate that it has been replaced
                const docsUpdated = Catenis.db.collection.SentTransaction.update({
                    txid: this.lastTxid,
                    'confirmation.confirmed': false,
                    replacedByTxid: {
                        $exists: false
                    }
                }, {
                    $set: {
                        replacedByTxid: this.transact.txid
                    }
                });

                if (docsUpdated === 0) {
                    // Could not find previous read confirmation tx database doc to mark as replaced
                    Catenis.logger.WARN('Could not find previous read confirmation tx database doc to mark as replaced', {
                        txid: this.lastTxid
                    });
                }
            }

            // Save data about last issued read confirmation transaction
            this.lastTxChangeOutputPos = this.change > 0 ? this.lastReadConfirmSpendOutputPos + 1 : -1;
            newTransactionId.call(this, this.transact.txid);

            // Check if system read confirmation pay tx expense addresses need to be refunded
            Catenis.ctnHubNode.checkReadConfirmPayTxExpenseFundingBalance();
        }
        else {
            // Trying to send transaction that had already been sent.
            //  Log warning condition and throw exception
            Catenis.logger.WARN('Trying to send read confirmation transaction that had already been sent.', {
                readConfirmTransact: this
            });
            throw new Meteor.Error('ctn_read_confirm_tx_already_sent', util.format('Trying to send read confirmation transaction (txid: %s) that had already been sent.', this.transact.txid));
        }

        return this.transact.txid;
    }
    else {
        // Trying to send read confirmation transaction that is not yet funded.
        //  Log warning condition
        Catenis.logger.WARN("Trying to send read confirmation transaction that is not yet funded", {readConfirmTransaction: this});
    }
};

ReadConfirmTransaction.prototype.setOptimumFeeRate = function () {
    this.readConfirmTxInfo.checkResetFeeRate(Catenis.bitcoinFees.getOptimumFeeRate());
    this.txChanged = true;
    this.txFunded = false;
};

ReadConfirmTransaction.prototype.setTerminalFeeRate = function () {
    this.readConfirmTxInfo.checkResetFeeRate(Catenis.bitcoinFees.getFeeRateByTime(Service.readConfirmTerminalTxMinToConfirm));
    this.txChanged = true;
    this.txFunded = false;
};

ReadConfirmTransaction.prototype.dispose = function () {
    // Remove event handler
    Catenis.malleabilityEventEmitter.removeListener(MalleabilityEventEmitter.notifyEvent.txid_changed.name, this.txidChangedEventHandler);
};


// Module functions used to simulate private ReadConfirmTransaction object methods
//  NOTE: these functions need to be bound to a ReadConfirmTransaction object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

function getReadConfirmSpendNotifyOutputPos(ctnNodeIndex) {
    return this.ctnNdIdxReadConfirmSpndNtfyOutRelPos.has(ctnNodeIndex) ? this.ctnNdIdxReadConfirmSpndNtfyOutRelPos.get(ctnNodeIndex) + (this.hasReadConfirmSpendNullOutput ? 1 : 0) + (this.hasReadConfirmSpendOnlyOutput ? 1 : 0) : -1;
}

function setReadConfirmSpendNotifyOutputPos(ctnNodeIndex) {
    if (!this.ctnNdIdxReadConfirmSpndNtfyOutRelPos.has(ctnNodeIndex)) {
        const pos = this.ctnNdIdxReadConfirmSpndNtfyOutRelPos.size;

        this.ctnNdIdxReadConfirmSpndNtfyOutRelPos.set(ctnNodeIndex, pos);
    }
}

function addReadConfirmAddrSpendNull(input, readConfirmSpendAddress) {
    // Add input
    this.transact.addInputs(input, this.nextReadConfirmAddrSpndNullInputPos);
    this.readConfirmAddrSpndNullInputCount++;

    // Prepare to add output
    let newOutputAdded = false;

    if (this.hasReadConfirmSpendNullOutput) {
        // Output is already present. Just increment its amount
        this.transact.incrementOutputAmount(this.readConfirmSpendNullOutputPos, input.txout.amount);
    }
    else {
        // Add new output
        this.hasReadConfirmSpendNullOutput = true;
        readConfirmSpendAddress = readConfirmSpendAddress !== undefined ? readConfirmSpendAddress : Catenis.ctnHubNode.readConfirmSpendNullAddr.newAddressKeys().getAddress();
        this.transact.addP2PKHOutput(readConfirmSpendAddress, input.txout.amount, this.readConfirmSpendNullOutputPos);
        newOutputAdded = true;
    }

    return newOutputAdded;
}

function addReadConfirmAddrSpendOnly(input, readConfirmSpendAddress) {
    // Add input
    this.transact.addInputs(input, this.nextReadConfirmAddrSpndOnlyInputPos);
    this.readConfirmAddrSpndOnlyInputCount++;

    // Prepare to add output
    let newOutputAdded = false;

    if (this.hasReadConfirmSpendOnlyOutput) {
        // Output is already present. Just increment its amount
        this.transact.incrementOutputAmount(this.readConfirmSpendOnlyOutputPos, input.txout.amount);
    }
    else {
        // Add new output
        this.hasReadConfirmSpendOnlyOutput = true;
        readConfirmSpendAddress = readConfirmSpendAddress !== undefined ? readConfirmSpendAddress : Catenis.ctnHubNode.readConfirmSpendOnlyAddr.newAddressKeys().getAddress();
        this.transact.addP2PKHOutput(readConfirmSpendAddress, input.txout.amount, this.readConfirmSpendOnlyOutputPos);
        newOutputAdded = true;
    }

    return newOutputAdded;
}

function addReadConfirmAddrSpendNotify(input, ctnNode, readConfirmSpendAddress) {
    // Add input
    this.transact.addInputs(input, this.nextReadConfirmAddrSpndNtfyInputPos);
    this.readConfirmAddrSpndNtfyInputCount++;

    // Prepare to add output
    let newOutputAdded = false;

    if (this.ctnNdIdxReadConfirmSpndNtfyOutRelPos.has(ctnNode.ctnNodeIndex)) {
        // Output is already present. Just increment its amount
        this.transact.incrementOutputAmount(getReadConfirmSpendNotifyOutputPos.call(this, ctnNode.ctnNodeIndex), input.txout.amount);
    }
    else {
        // Add new output
        setReadConfirmSpendNotifyOutputPos.call(this, ctnNode.ctnNodeIndex);
        readConfirmSpendAddress = readConfirmSpendAddress !== undefined ? input.txout : ctnNode.readConfirmSpendNotifyAddr.newAddressKeys().getAddress();
        this.transact.addP2PKHOutput(readConfirmSpendAddress, input.txout.amount, getReadConfirmSpendNotifyOutputPos.call(this, ctnNode.ctnNodeIndex));
        newOutputAdded = true;
    }

    return newOutputAdded;
}

function TransactIdChanged(data) {
    // Replace reference to txid that has changed due to malleability
    const txidIdx = this.txids.find((txid) => {
        return txid === data.originalTxid;
    });

    if (txidIdx > 0) {
        this.txids[txidIdx] = data.modifiedTxid;

        if (this.lastTxid === data.originalTxid) {
            this.lastTxid = data.modifiedTxid;
        }
    }
}

function initReadConfirmTxInfo() {
    const opts = {
        initNumTxInputs: this.transact.countInputs(),
        initNumTxOutputs: this.transact.countOutputs(),
        txNullDataPayloadSize: Service.readConfirmTxNullDataPayloadSize,
        txFeeRateIncrement: Service.readConfirmTxFeeRateIncrement
    };

    if (this.fee > 0) {
        opts.initTxFee = this.fee;
    }
    else {
        opts.initTxFeeRate = Service.readConfirmInitTxFeeRate;
    }

    this.readConfirmTxInfo = new RbfTransactionInfo(opts);
}

function retrieveReplacedTransactionIds() {
    this.txids = [];
    let nextTxid = this.transact.txid;

    do {
        const replacedTxDoc = Catenis.db.collection.SentTransaction.findOne({
            type: Transaction.type.read_confirmation.name,
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

function newTransactionId(txid) {
    this.txids.push(txid);
    this.lastTxid = txid;
}


// ReadConfirmTransaction function class (public) methods
//

// Determines if transaction is a valid Catenis Read Confirmation transaction
//
//  Arguments:
//    transact: [Object] // Object of type Transaction identifying the transaction to be checked
//
//  Return:
//    - If transaction is not valid: undefined
//    - If transaction is valid: Object of type ReadConfirmTransaction created from transaction
//
ReadConfirmTransaction.checkTransaction = function (transact) {
    let readConfirmTransact = undefined;

    // First, check if pattern of transaction's inputs and outputs is consistent
    if (transact.matches(ReadConfirmTransaction)) {
        try {
            // Now, try to initialize read confirmation transaction
            readConfirmTransact = new ReadConfirmTransaction(transact);
        }
        catch (err) {
            // Error checking read confirmation transaction. Log error condition
            Catenis.logger.ERROR(util.format('Error checking read confirmation transaction (txid: %s).', transact.txid), err);
        }
    }

    return readConfirmTransact;
};


// ReadConfirmTransaction function class (public) properties
//

ReadConfirmTransaction.matchingPattern = Object.freeze({
    input: util.format('^(?:%s)+(?:%s)*$',
        Transaction.ioToken.p2_dev_read_conf_addr.token,
        Transaction.ioToken.p2_sys_read_conf_pay_tx_exp_addr.token),
    output: util.format('^(?:(?:%s(?:%s)?(?:%s)*)|(?:%s(?:%s)*)|(?:%s+))(?:%s)?$',
        Transaction.ioToken.p2_sys_read_conf_spnd_null_addr.token,
        Transaction.ioToken.p2_sys_read_conf_spnd_only_addr.token,
        Transaction.ioToken.p2_sys_read_conf_spnd_ntfy_addr.token,
        Transaction.ioToken.p2_sys_read_conf_spnd_only_addr.token,
        Transaction.ioToken.p2_sys_read_conf_spnd_ntfy_addr.token,
        Transaction.ioToken.p2_sys_read_conf_spnd_ntfy_addr.token,
        Transaction.ioToken.p2_sys_read_conf_pay_tx_exp_addr.token)
});


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(ReadConfirmTransaction);
