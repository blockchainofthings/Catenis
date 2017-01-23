/**
 * Created by claudio on 25/11/16.
 */

//console.log('[CatenisNode.js]: This code just ran.');

// Module variables
//

// References to external modules
const util = Npm.require('util');
const config = Npm.require('config');

import { CriticalSection } from './CriticalSection.js';
import { ServiceCreditsCounter } from './ServiceCreditsCounter.js';

// Critical section object to avoid concurrent access to database at the
//  module level (when creating new Catenis nodes basically)
const dbCS = new CriticalSection();


// Definition of function classes
//

// CatenisNode function class
function CatenisNode(docCtnNode, initializeClients) {
    // Save relevant info from CatenisNode doc/rec
    this.doc_id = docCtnNode._id;
    this.type = docCtnNode.type;
    this.ctnNodeIndex = docCtnNode.ctnNodeIndex;
    this.status = docCtnNode.status;

    // Instantiate objects to manage blockchain addresses for Catenis node
    this.deviceMainAddr = Catenis.module.BlockchainAddress.SystemDeviceMainAddress.getInstance(this.ctnNodeIndex);
    this.fundingPaymentAddr = Catenis.module.BlockchainAddress.SystemFundingPaymentAddress.getInstance(this.ctnNodeIndex);
    this.fundingChangeAddr = Catenis.module.BlockchainAddress.SystemFundingChangeAddress.getInstance(this.ctnNodeIndex);
    this.payTxExpenseAddr = Catenis.module.BlockchainAddress.SystemPayTxExpenseAddress.getInstance(this.ctnNodeIndex);

    // Retrieve (HD node) index of last Client doc/rec created for this Catenis node
    const docClient = Catenis.db.collection.Client.findOne({catenisNode_id: this.doc_id}, {fields: {'index.clientIndex': 1}, sort: {'index.clientIndex': -1}});

    this.lastClientIndex = docClient != undefined ? docClient.index.clientIndex : 0;

    // Critical section object to avoid concurrent access to database at the Catenis node
    //  object level (when creating new clients for this Catenis node basically)
    this.ctnNodeDbCS = new CriticalSection();

    if (initializeClients) {
        // Instantiate all (non-deleted) clients so their associated addresses are
        //  loaded onto local key storage
        Catenis.db.collection.Client.find({status: {$ne: Catenis.module.Client.status.deleted.name}}).forEach((doc) => {
            // Instantiate Client object making sure that associated devices are also initialized
            Catenis.logger.TRACE('About to initialize client', {clientId: doc.clientId});
            new Catenis.module.Client(doc, this, true);
        });
    }
}


// Public CatenisNode object methods
//

// NOTE: this method should be used ONLY with the Catenis Hub instance
CatenisNode.prototype.startNode = function () {
    // Execute code in critical section to avoid UTXOs concurrency
    Catenis.module.FundSource.utxoCS.execute(() => {
        // Make sure that system is properly funded
        this.checkFundingBalance();

        // Check if system device main addresses are already funded
        const devMainAddresses = this.deviceMainAddr.listAddressesInUse(),
              distribFund = Catenis.module.Service.distributeSystemDeviceMainAddressFund();
        let devMainAddrBalance = undefined;

        if (devMainAddresses.length > 0) {
            // System device main addresses already exist. Check if
            //  balance is as expected
            devMainAddrBalance = (new Catenis.module.FundSource(devMainAddresses, {})).getBalance();
        }

        if (devMainAddrBalance != undefined && devMainAddrBalance > 0) {
            if (devMainAddrBalance != distribFund.totalAmount) {
                // Amount funded to system device main addresses different than expected.
                //  Log inconsistent condition
                Catenis.logger.WARN(util.format('Amount funded to Catenis node #%d system device main addresses different than expected. Current amount: %s, expected amount: %s', this.ctnNodeIndex, Catenis.module.Util.formatCoins(devMainAddrBalance), Catenis.module.Util.formatCoins(distribFund.totalAmount)));
            }
        }
        else {
            // System device main addresses not funded yet, so fund them now
            fundDeviceMainAddresses.call(this, distribFund.amountPerAddress);
        }
    });
};

CatenisNode.prototype.listFundingAddressesInUse = function () {
    return this.fundingPaymentAddr.listAddressesInUse().concat(this.fundingChangeAddr.listAddressesInUse());
};

// NOTE: make sure that this method is called from code executed from the FundSource.utxoCS
//  critical section object
CatenisNode.prototype.checkFundingBalance = function () {
    const checkResult = {
        currBalance: (new Catenis.module.FundSource(this.listFundingAddressesInUse(), {})).getBalance(),
        minBalance: Catenis.module.Service.minimumFundingBalance,
        balanceOK: function () {
            return this.currBalance >= this.minBalance;
        }
    };

    if (checkResult.currBalance < checkResult.minBalance) {
        // Funding balance too low. Send notification refund the system
        Catenis.logger.ACTION('Catenis funding balance too low.', util.format('\nCurrent balance: %s, expected minimum balance: %s\n\nACTION REQUIRED: please refund Catenis immediately.',
            Catenis.module.Util.formatCoins(checkResult.currBalance), Catenis.module.Util.formatCoins(checkResult.minBalance)));
    }

    return checkResult;
};

CatenisNode.prototype.currentServiceCreditsCount = function () {
    const counter = {};

    counter[Catenis.module.Client.serviceCreditType.message] = new ServiceCreditsCounter();
    counter[Catenis.module.Client.serviceCreditType.asset] = new ServiceCreditsCounter();

    // Compute remaining service credits for all clients of this Catenis node
    Catenis.db.collection.Client.find({catenisNode_id: this.doc_id}, {fields: {_id: 1}}).forEach(clientDoc => {
        Catenis.db.collection.ServiceCredit.find({client_id: clientDoc._id, remainCredits: {$gt: 0}}, {fields: {_id: 1, remainCredits: 1, srvCreditType: 1, 'fundingTx.confirmed': 1}}).fetch().reduce((counter, doc) => {
            if (doc.fundingTx.confirmed) {
                counter[doc.srvCreditType].addConfirmed(doc.remainCredits);
            }
            else {
                counter[doc.srvCreditType].addUnconfirmed(doc.remainCredits);
            }

            return counter;
        }, counter);
    });

    return counter;
};

CatenisNode.prototype.currentUnreadMessagesCount = function () {
    return Catenis.db.collection.ReceivedTransaction.find({type: Catenis.module.Transaction.type.send_message.name, 'info.sendMessage.readConfirmation.spent': false}, {fields: {_id: 1}}).count();
};

// NOTE: make sure that this method is called from code executed from the FundSource.utxoCS
//  critical section object
CatenisNode.prototype.checkPayTxExpenseFundingBalance = function () {
    const currServiceCreditsCount = this.currentServiceCreditsCount();
    const checkResult = {
        currBalance: (new Catenis.module.FundSource(this.listFundingAddressesInUse(), {})).getBalance(),
        expectedBalance: Catenis.module.Service.getExpectedPayTxExpenseBalance(currServiceCreditsCount[Catenis.module.Client.serviceCreditType.message].total, this.currentUnreadMessagesCount(), currServiceCreditsCount[Catenis.module.Client.serviceCreditType.asset].total),
        balanceOK: function () {
            return this.currBalance >= this.expectedBalance;
        }
    };

    if (checkResult.currBalance < checkResult.expectedBalance) {
        // Refund system pay tx expense addresses
        // Allocate system pay tx expense addresses...
        let distribFund = Catenis.module.Service.distributePayTxExpenseFund(checkResult.expectedBalance - checkResult.currBalance);

        // ...and try to fund them
        this.fundPayTxExpenseAddresses(distribFund.amountPerAddress);
    }

    return checkResult;
};

CatenisNode.prototype.getClientByIndex = function (clientIndex) {
    // Retrieve Client doc/rec
    const docClient = Catenis.db.collection.Client.findOne({
        'index.ctnNodeIndex': this.ctnNodeIndex,
        'index.clientIndex': clientIndex,
        status: {$ne: Catenis.module.Client.status.deleted.name}
    });

    if (docClient == undefined) {
        // No client available with the given index. Log error and throw exception
        Catenis.logger.ERROR(util.format('Could not find client with given index for this Catenis node (ctnNodeIndex: %s)', this.ctnNodeIndex), {clientIndex: clientIndex});
        throw new Meteor.Error('ctn_client_not_found', util.format('Could not find client with given index (%s) for this Catenis node (ctnNodeIndex: %s)', clientIndex, this.ctnNodeIndex));
    }

    return new Catenis.module.Client(docClient, this);
};

CatenisNode.prototype.delete = function () {
    if (this.status !== CatenisNode.status.deleted.name) {
        const deletedDate = new Date(Date.now());

        // Iteratively deletes all clients associated with this Catenis node
        Catenis.db.collection.Client.find({
            catenisNode_id: this.doc_id,
            status: {$ne: Catenis.module.Client.status.deleted.name}
        }, {fields: {'index.clientId': 1}}).forEach(doc => {
            this.getClientByIndex(doc.index.clientIndex).delete(deletedDate);
        });

        try {
            // Update Catenis node doc/rec setting its status to 'deleted'
            Catenis.db.collection.CatenisNode.update({_id: this.doc_id}, {
                $set: {
                    status: CatenisNode.status.deleted.name,
                    lastStatusChangedDate: deletedDate,
                    deletedDate: deletedDate
                }
            });
        }
        catch (err) {
            // Error updating CatenisNode doc/rec. Log error and throw exception
            Catenis.logger.ERROR(util.format('Error trying to delete Catenis node (doc_id: %s).', this.doc_id), err);
            throw new Meteor.Error('ctn_node_update_error', util.format('Error trying to delete Catenis node (doc_id: %s)', this.doc_id), err.stack);
        }

        // Update local variables
        this.status = CatenisNode.status.deleted.name;
    }
    else {
        // Client already deleted
        Catenis.logger.WARN('Trying to delete client that is already deleted', {client: this});
    }
};

// Create new client
//
//  Arguments:
//    props: [string] - client name
//           or
//           {
//      name: [string] - (optional)
//      (any additional property)
//    }
//    user_id: [string] - (optional)
//
CatenisNode.prototype.createClient = function (props, user_id) {
    // Make sure that Catenis node is not deleted
    if (this.status === CatenisNode.status.deleted.name) {
        // Cannot create client for deleted Catenis node. Log error and throw exception
        Catenis.logger.ERROR('Cannot create client for deleted Catenis node', {ctnNodeIndex: this.ctnNodeIndex});
        throw new Meteor.Error('ctn_node_deleted', util.format('Cannot create client for deleted Catenis node (ctnNodeIndex: %d)', this.ctnNodeIndex));
    }

    let docUser = undefined;

    if (user_id != undefined) {
        // Make sure that user ID is valid
        docUser = Meteor.users.findOne({_id: user_id}, {fields: {_id: 1, 'services.password': 1, 'profile.client_id': 1}});

        if (docUser == undefined) {
            // ID passed is not from a valid user. Log error and throw exception
            Catenis.logger.ERROR('Invalid user ID for creating client', {userId: user_id});
            throw new Meteor.Error('ctn_client_invalid_user_id', util.format('Invalid user ID (%s) for creating client', user_id));
        }
        else if (docUser.profile != undefined && docUser.profile.client_id != undefined) {
            // User already assigned to a client. Log error and throw exception
            Catenis.logger.ERROR('User already assigned to a client', {userId: user_id});
            throw new Meteor.Error('ctn_client_user_already_assigned', util.format('User (Id: %s) already assigned to a client', user_id));
        }
    }

    let docClient = undefined;

    // Execute code in critical section to avoid DB concurrency
    this.ctnNodeDbCS.execute(() => {
        // Get next client index and validate it
        let clientIndex = this.lastClientIndex;

        // Get next good client index
        let clientId = undefined;

        do {
            if (Catenis.keyStore.initClientHDNodes(this.ctnNodeIndex, ++clientIndex)) {
                clientId = newClientId(this.ctnNodeIndex, clientIndex);
            }
        }
        while (!clientId);

        // Prepare to create Client doc/rec
        docClient = {
            catenisNode_id: this.doc_id,
            clientId: clientId,
            index: {
                ctnNodeIndex: this.ctnNodeIndex,
                clientIndex: clientIndex,
            },
            props: typeof props === 'object' ? props : (typeof props === 'string' ? {name: props} : {}),
            apiAccessGenKey: Random.secret(),
            status: user_id != undefined && docUser.services != undefined && docUser.services.password != undefined ? Catenis.module.Client.status.active.name : Catenis.module.Client.status.new.name,
            createdDate: new Date(Date.now())
        };

        if (user_id != undefined) {
            docClient.user_id = user_id;
        }

        try {
            // Create new Client doc/rec
            docClient._id = Catenis.db.collection.Client.insert(docClient);
        }
        catch (err) {
            Catenis.logger.ERROR('Error trying to create new client.', err);
            throw new Meteor.Error('ctn_client_insert_error', 'Error trying to create new client', err.stack);
        }

        if (user_id != undefined) {
            try {
                // Update User doc/rec saving the ID of the client associated with it
                Meteor.users.update({_id: user_id}, {$set: {'profile.client_id': docClient._id}});
            }
            catch (err) {
                Catenis.logger.ERROR(util.format('Error updating user (Id: %s) associated with new client (doc Id: %s).', user_id, docClient._id), err);
                throw new Meteor.Error('ctn_client_update_user_error', util.format('Error updating user (Id: %s) associated with new client (doc Id: %s).', user_id, docClient._id), err.stack);
            }
        }

        // Now, adjust last client index
        this.lastClientIndex = clientIndex;
    });

    // If we hit this point, a new Client doc (rec) has been successfully created

    // Return ID of newly creadted client
    return docClient.clientId;
};

// NOTE: make sure that this method is called from code executed from the FundSource.utxoCS
//  critical section object
CatenisNode.prototype.fundPayTxExpenseAddresses = function (amountPerAddress) {
    let fundTransact = undefined;

    try {
        // Prepare transaction to fund system pay tx expense addresses
        fundTransact = new Catenis.module.FundTransaction(Catenis.module.FundTransaction.fundingEvent.add_extra_tx_pay_funds);

        fundTransact.addPayees(this.payTxExpenseAddr, amountPerAddress);

        if (fundTransact.addPayingSource()) {
            // Now, issue (create and send) the transaction
            fundTransact.sendTransaction();
        }
        else {
            // Could not allocated UTXOs to pay for transaction fee.
            //  Throw exception
            //noinspection ExceptionCaughtLocallyJS
            throw new Meteor.Error('ctn_sys_no_fund', 'Could not allocate UTXOs from system funding addresses to pay for tx expense');
        }
    }
    catch (err) {
        // Error funding client service credit addresses.
        //  Log error condition
        Catenis.logger.ERROR('Error funding system pay tx expense addresses.', err);

        if (fundTransact != undefined) {
            // Revert addresses of payees added to transaction
            fundTransact.revertPayeeAddresses();
        }

        // Rethrows exception
        throw err;
    }
};


// Module functions used to simulate private CatenisNode object methods
//  NOTE: these functions need to be bound to a CatenisNode object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

// NOTE: make sure that this method is called from code executed from the FundSource.utxoCS
//  critical section object
function fundDeviceMainAddresses(amountPerAddress) {
    let fundTransact = undefined;

    try {
        // Prepare transaction to fund system device main addresses
        fundTransact = new Catenis.module.FundTransaction(Catenis.module.FundTransaction.fundingEvent.provision_system_device);

        fundTransact.addPayees(this.deviceMainAddr, amountPerAddress);

        if (fundTransact.addPayingSource()) {
            // Now, issue (create and send) the transaction
            fundTransact.sendTransaction();
        }
        else {
            // Could not allocated UTXOs to pay for transaction fee.
            //  Throw exception
            //noinspection ExceptionCaughtLocallyJS
            throw new Meteor.Error('ctn_sys_no_fund', 'Could not allocate UTXOs from system funding addresses to pay for tx expense');
        }
    }
    catch (err) {
        // Error funding Catenis Hub device main addresses.
        //  Log error condition
        Catenis.logger.ERROR('Error funding system device main addresses.', err);

        if (fundTransact != undefined) {
            // Revert addresses of payees added to transaction
            fundTransact.revertPayeeAddresses();
        }

        // Rethrows exception
        throw err;
    }
}


// CatenisNode function class (public) methods
//

CatenisNode.initialize = function () {
    Catenis.logger.TRACE('CatenisNode initialization');
    // Retrieve (HD node) index of last created CatenisNode doc/rec
    const docCtnNode = Catenis.db.collection.CatenisNode.findOne({}, {
        fields: {ctnNodeIndex: 1},
        sort: {ctnNodeIndex: -1}
    });

    CatenisNode.ctnNodeCtrl.lastCtnNodeIndex = docCtnNode != undefined ? docCtnNode.ctnNodeIndex : 0;

    // Instantiate CatenisNode object for Catenis Hub making sure that associated clients are also initialized
    Catenis.ctnHubNode = new CatenisNode(Catenis.db.collection.CatenisNode.findOne({type: CatenisNode.nodeType.hub.name}), true);

    // Instantiate all gateway Catenis nodes so their associated addresses are
    //  loaded onto local key storage
    Catenis.db.collection.CatenisNode.find({type: CatenisNode.nodeType.gateway.name}).forEach(function (doc) {
        // Instantiate CatenisNode object making sure that associated clients are also initialized
        new CatenisNode(doc, true);
    });
};

// Create new Catenis node
//
//  Arguments:
//    props: [string] - Catenis node name
//           or
//           {
//      name: [string] - (optional)
//      (any additional property)
//    }
//
//  Returns: (HD node) index of newly created Catenis node
//
//  NOTE: this method is used to create only Catenis nodes of the gateway type
//      since there should be only one Catenis Hub node and it is pre-created
//
CatenisNode.createCatenisNode = function (props) {
    let docCtnNode = undefined;

    // Execute code in critical section to avoid DB concurrency
    dbCS.execute(() => {
        // Get next Catenis node index and validate it
        let ctnNodeIndex = CatenisNode.ctnNodeCtrl.lastCtnNodeIndex;

        //noinspection StatementWithEmptyBodyJS
        while (!Catenis.keyStore.initCatenisNodeHDNodes(++ctnNodeIndex));

        // Prepare to create Catenis node doc/rec
        let ctnNodeProps = typeof props === 'object' ? props : (typeof props === 'string' ? {name: props} : {});

        if (ctnNodeProps.name == undefined) {
            // If no name defined, use default naming for Catenis (gateway) node
            ctnNodeProps.name = util.format('Catenis Gateway #%d', ctnNodeIndex);
        }

        docCtnNode = {
            type: CatenisNode.nodeType.gateway.name,
            ctnNodeIndex: ctnNodeIndex,
            props: ctnNodeProps,
            status: CatenisNode.status.active.name,
            createdDate: new Date(Date.now())
        };

        try {
            // Create new Catenis node doc/rec
            docCtnNode._id = Catenis.db.collection.CatenisNode.insert(docCtnNode);
        }
        catch (err) {
            Catenis.logger.ERROR('Error trying to create new Catenis node.', err);
            throw new Meteor.Error('ctn_node_insert_error', 'Error trying to create new Catenis node', err.stack);
        }

        // Now, adjust last Catenis node index
        CatenisNode.ctnNodeCtrl.lastCtnNodeIndex = ctnNodeIndex;
    });

    // If we hit this point, a CatenisNode doc (rec) has been successfully created

    // Return index of newly created Catenis node
    return docCtnNode.ctnNodeIndex;
};

CatenisNode.getCatenisNodeByIndex = function (ctnNodeIndex) {
    if (ctnNodeIndex == Catenis.application.ctnHubNodeIndex) {
        return Catenis.ctnHubNode;
    }
    else {
        // Retrieve Catenis node doc/rec
        const docCtnNode = Catenis.db.collection.CatenisNode.findOne({
            type: CatenisNode.nodeType.gateway.name,
            ctnNodeIndex: ctnNodeIndex,
            status: {$ne: CatenisNode.status.deleted.name}
        });

        if (docCtnNode == undefined) {
            // No Catenis node available with the given index. Log error and throw exception
            Catenis.logger.ERROR('Could not find Catenis node with given index', {ctnNodeIndex: ctnNodeIndex});
            throw new Meteor.Error('ctn_node_not_found', util.format('Could not find Catenis node with given index (%s)', ctnNodeIndex));
        }

        return new CatenisNode(docCtnNode);
    }
};


// CatenisNode function class (public) properties
//

// NOTE: the lastCtnNodeIndex property below needs to be defined as a field of another property of type object
//      otherwise we shall not be able to change its value later (in the initialize() method) since the
//      CatenisNode object is frozen before it is assigned to the Catenis.module object.
CatenisNode.ctnNodeCtrl = {
    lastCtnNodeIndex: 0
};

CatenisNode.nodeType = Object.freeze({
    hub: Object.freeze({
        name: 'hub',
        description: 'Central Catenis node deployed on the cloud (accessed via the Internet)'
    }),
    gateway: Object.freeze({
        name: 'gateway',
        description: 'Catenis node deployed to client premises'
    }),
});

CatenisNode.status = Object.freeze({
    active: Object.freeze({
        name: 'active',
        description: 'Catenis node is in its normal use mode'
    }),
    deleted: Object.freeze({
        name: 'deleted',
        description: 'Catenis node has been logically deleted'
    })
});

// Definition of module (private) functions
//

// Create new client ID dependent on Catenis node index and client index
function newClientId(ctnNodeIndex, clientIndex) {
    let id = 'c' + Random.createWithSeeds(Array.from(Catenis.application.seed.toString() + ':ctnNodeIndex:' + ctnNodeIndex + ',clientIndex:' + clientIndex)).id(19);
    let doc = undefined;

    if ((doc = Catenis.db.collection.Client.findOne({clientId: id}, {fields:{_id: 1, index: 1}}))) {
        // New client ID is already in use. Log warning condition and reset ID
        Catenis.logger.WARN(util.format('Client ID for Catenis node index %d and client index %d is already in use', ctnNodeIndex, clientIndex), {existingClientDoc: doc});
        id = undefined;
    }

    return id;
}


// Module code
//

// Save module function class reference
if (typeof Catenis === 'undefined')
    Catenis = {};

if (typeof Catenis.module === 'undefined')
    Catenis.module = {};

Catenis.module.CatenisNode = Object.freeze(CatenisNode);
