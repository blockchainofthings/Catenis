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
            }
        }
    });

    if (transact === undefined) {
        // Check if there is a previous read confirmation transaction still pending
        retrievePreviousReadConfirmationTx.call(this);
    }
    else {
        this.transact = transact;
    }

    if (this.transact !== undefined) {
        // Compute number of inputs that are associated with a device read confirmation address output
        let numReadConfirmAddrInputs = 0;

        this.transact.inputs.some((input) => {
            if (input.addrInfo !== undefined && input.addrInfo.type === KeyStore.extKeyType.dev_read_conf_addr.name) {
                numReadConfirmAddrInputs++;

                // Continue iteration
                return false;
            }
            else {
                // Input is not associated with a device read confirmation address output.
                //  Just stop iteration
                return true;
            }
        });

        // Initialize variables used to control inputs and outputs
        this.readConfirmAddrSpndNullInputCount = 0;
        this.readConfirmAddrSpndOnlyInputCount = 0;
        this.readConfirmAddrSpndNtfyInputCount = 0;
        this.hasReadConfirmSpendNullOutput = false;
        this.hasReadConfirmSpendOnlyOutput = false;
        this.ctnNdIdxReadConfirmSpndNtfyOutRelPos = new Map();

        this.transact.outputs.some((output, idx) => {
            if (output.payInfo.addrInfo !== undefined) {
                if (output.payInfo.addrInfo.type === KeyStore.extKeyType.sys_read_conf_spnd_ntfy_addr.name) {
                    // Save position of output associated with system read confirmation spend notify address
                    //  and continue iteration
                    this.setReadConfirmSpendNotifyOutputPos(output.payInfo.addrInfo.pathParts.ctnNodeIndex);

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

                    // Continue iteration
                    return false;
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

                    // Continue iteration
                    return false;
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

                    // Continue iteration
                    return false;
                }
            }

            // Output is not associated with a read confirmation spend address.
            //  Just stop iteration
            return true;
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
        this.txFunded = true;

        // Instantiate RBF tx info object
        initReadConfirmTxInfo.call(this);

        this.lastTxid = this.transact.txid;
        this.lastTxChangeOutputPos = this.change > 0 ? this.lastReadConfirmSpendOutputPos + 1 : -1;
    }
    else {
        this.transact = new Transaction(true);
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
        this.lastTxid = undefined;
        this.lastTxChangeOutputPos = -1;
        this.lastSentDate = undefined;
    }
}


// Public ReadConfirmTransaction object methods
//

ReadConfirmTransaction.prototype.getReadConfirmSpendNotifyOutputPos = function (ctnNodeIndex) {
    return this.ctnNdIdxReadConfirmSpndNtfyOutRelPos.has(ctnNodeIndex) ? this.ctnNdIdxReadConfirmSpndNtfyOutRelPos.get(ctnNodeIndex) + (this.hasReadConfirmSpendNullOutput ? 1 : 0) + (this.hasReadConfirmSpendOnlyOutput ? 1 : 0) : -1;
};

ReadConfirmTransaction.prototype.setReadConfirmSpendNotifyOutputPos = function (ctnNodeIndex) {
    if (!this.ctnNdIdxReadConfirmSpndNtfyOutRelPos.has(ctnNodeIndex)) {
        const pos = this.ctnNdIdxReadConfirmSpndNtfyOutRelPos.size;

        this.ctnNdIdxReadConfirmSpndNtfyOutRelPos.set(ctnNodeIndex, pos);
    }
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
                this.setReadConfirmSpendNotifyOutputPos(output.payInfo.addrInfo.pathParts.ctnNodeIndex);

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

ReadConfirmTransaction.prototype.addSendMsgTxToConfirm = function (sendMsgTransact, confirmType) {
    // Find read confirmation output of send message transaction
    let addrInfo;

    const readConfirmOutputPos = sendMsgTransact.transact.outputs.findIndex((output) => {
        if (output.type === Transaction.outputType.P2PKH) {
            addrInfo = typeof output.payInfo.addrInfo !== 'undefined' ? output.payInfo.addrInfo : Catenis.keyStore.getAddressInfo(output.payInfo.address, true);

            return addrInfo !== null && addrInfo.type === KeyStore.extKeyType.dev_read_conf_addr.name;
        }

        return false;
    });

    if (readConfirmOutputPos >= 0) {
        const readConfirmOutput = sendMsgTransact.transact.getOutputAt(readConfirmOutputPos);

        // Prepare input to add
        const readConfirmAddrInput = {
            txout: {
                txid: sendMsgTransact.transact.txid,
                vout: readConfirmOutputPos,
                amount: readConfirmOutput.payInfo.amount,
            },
            address: readConfirmOutput.payInfo.address,
            addrInfo: addrInfo
        };

        // Add proper input and output according to the type of confirmation
        let newOutputAdded = false;

        if (confirmType === ReadConfirmation.confirmationType.spendNotify) {
            // Spend notify

            // Add input
            this.transact.addInputs(readConfirmAddrInput, this.nextReadConfirmAddrSpndNtfyInputPos);
            this.readConfirmAddrSpndNtfyInputCount++;

            // Prepare to add output
            const ctnNode = sendMsgTransact.originDevice.client.ctnNode;

            if (this.ctnNdIdxReadConfirmSpndNtfyOutRelPos.has(ctnNode.ctnNodeIndex)) {
                // Output is already present. Just increment its amount
                this.transact.incrementOutputAmount(this.getReadConfirmSpendNotifyOutputPos(ctnNode.ctnNodeIndex), readConfirmOutput.payInfo.amount);
            }
            else {
                // Add new output
                this.setReadConfirmSpendNotifyOutputPos(ctnNode.ctnNodeIndex);
                this.transact.addP2PKHOutput(ctnNode.readConfirmSpendNotifyAddr.newAddressKeys().getAddress(), readConfirmOutput.payInfo.amount, this.getReadConfirmSpendNotifyOutputPos(ctnNode.ctnNodeIndex));
                newOutputAdded = true;
            }
        }
        else if (confirmType === ReadConfirmation.confirmationType.spendOnly) {
            // Spend only

            // Add input
            this.transact.addInputs(readConfirmAddrInput, this.nextReadConfirmAddrSpndOnlyInputPos);
            this.readConfirmAddrSpndOnlyInputCount++;

            // Prepare to add output
            if (this.hasReadConfirmSpendOnlyOutput) {
                // Output is already present. Just increment its amount
                this.transact.incrementOutputAmount(this.readConfirmSpendOnlyOutputPos, readConfirmOutput.payInfo.amount);
            }
            else {
                // Add new output
                this.hasReadConfirmSpendOnlyOutput = true;
                this.transact.addP2PKHOutput(Catenis.ctnHubNode.readConfirmSpendOnlyAddr.newAddressKeys().getAddress(), readConfirmOutput.payInfo.amount, this.readConfirmSpendOnlyOutputPos);
                newOutputAdded = true;
            }
        }
        else if (confirmType === ReadConfirmation.confirmationType.spendNull) {
            // Spend null

            // Add input
            this.transact.addInputs(readConfirmAddrInput, this.nextReadConfirmAddrSpndNullInputPos);
            this.readConfirmAddrSpndNullInputCount++;

            // Prepare to add output
            if (this.hasReadConfirmSpendNullOutput) {
                // Output is already present. Just increment its amount
                this.transact.incrementOutputAmount(this.readConfirmSpendNullOutputPos, readConfirmOutput.payInfo.amount);
            }
            else {
                // Add new output
                this.hasReadConfirmSpendNullOutput = true;
                this.transact.addP2PKHOutput(Catenis.ctnHubNode.readConfirmSpendNullAddr.newAddressKeys().getAddress(), readConfirmOutput.payInfo.amount, this.readConfirmSpendNullOutputPos);
                newOutputAdded = true;
            }
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
    }
    else {
        // No read configuration output found in send message transaction to confirm.
        //  Log waring condition
        Catenis.logger.WARN('No read confirmation output found in send message transaction to confirm', sendMsgTransact);
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
                txouts:  this.transact.listInputTxouts(0, this.readConfirmAddrInputCount - 1).map((txout) => {
                    return {
                        txid: txout.txid,
                        vout: txout.vout
                    };
                }),
                feeAmount: this.fee,
                txSize: this.transact.realSize()
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
            this.lastTxid = this.transact.txid;
            this.lastTxChangeOutputPos = this.change > 0 ? this.lastReadConfirmSpendOutputPos + 1 : -1;
            this.lastSentDate = new Date();

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


// Module functions used to simulate private ReadConfirmTransaction object methods
//  NOTE: these functions need to be bound to a ReadConfirmTransaction object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

function retrievePreviousReadConfirmationTx() {
    const docSentReadConfirmTxs = Catenis.db.collection.SentTransaction.find({
        type: Transaction.type.read_confirmation.name,
        'confirmation.confirmed': false,
        replacedByTxid: {
            $exists: false
        }
    }, {
        sort: {
            sentDate: -1
        },
        fields: {
            txid: 1,
            sentDate: 1
        }
    }).fetch();

    if (docSentReadConfirmTxs.length > 0) {
        // Make sure that no more than one read confirmation transaction is awaiting confirmation
        if (docSentReadConfirmTxs.length > 1) {
            // Log warning condition
            Catenis.logger.WARN('More than one read confirmation transaction is awaiting confirmation', {
                docsSentTransaction: docSentReadConfirmTxs
            });
        }

        this.transact = Transaction.fromTxid(docSentReadConfirmTxs[0].txid);
        this.lastSentDate = docSentReadConfirmTxs[0].sentDate;
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
