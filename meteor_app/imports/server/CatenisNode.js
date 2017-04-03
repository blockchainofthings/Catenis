/**
 * Created by claudio on 25/11/16.
 */

//console.log('[CatenisNode.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//  NOTE: the reference of these modules are done sing 'require()' instead of 'import' to
//      to avoid annoying WebStorm warning message: 'default export is not defined in
//      imported module'
const util = require('util');
const _und = require('underscore');     // NOTE: we dot not use the underscore library provided by Meteor because we need
                                        //        a feature (_und.omit(obj,predicate)) that is not available in that version
// Meteor packages
import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { CriticalSection } from './CriticalSection';
import { ServiceCreditsCounter } from './ServiceCreditsCounter';
import { SystemDeviceMainAddress, SystemFundingPaymentAddress, SystemFundingChangeAddress, SystemPayTxExpenseAddress } from './BlockchainAddress';
import { Client } from './Client';
import { FundSource } from './FundSource';
import { FundTransaction } from './FundTransaction';
import { Service } from './Service';
import { Transaction } from './Transaction';
import { Util } from './Util';

// Critical section object to avoid concurrent access to database at the
//  module level (when creating new Catenis nodes basically)
const dbCS = new CriticalSection();


// Definition of function classes
//

// CatenisNode function class
export function CatenisNode(docCtnNode, initializeClients) {
    // Save relevant info from CatenisNode doc/rec
    this.doc_id = docCtnNode._id;
    this.type = docCtnNode.type;
    this.ctnNodeIndex = docCtnNode.ctnNodeIndex;
    this.props = docCtnNode.props;
    this.status = docCtnNode.status;

    // Instantiate objects to manage blockchain addresses for Catenis node
    this.deviceMainAddr = SystemDeviceMainAddress.getInstance(this.ctnNodeIndex);
    this.fundingPaymentAddr = SystemFundingPaymentAddress.getInstance(this.ctnNodeIndex);
    this.fundingChangeAddr = SystemFundingChangeAddress.getInstance(this.ctnNodeIndex);
    this.payTxExpenseAddr = SystemPayTxExpenseAddress.getInstance(this.ctnNodeIndex);

    // Retrieve (HD node) index of last Client doc/rec created for this Catenis node
    const docClient = Catenis.db.collection.Client.findOne({catenisNode_id: this.doc_id}, {fields: {'index.clientIndex': 1}, sort: {'index.clientIndex': -1}});

    this.lastClientIndex = docClient != undefined ? docClient.index.clientIndex : 0;

    // Critical section object to avoid concurrent access to database at the Catenis node
    //  object level (when creating new clients for this Catenis node basically)
    this.ctnNodeDbCS = new CriticalSection();

    if (initializeClients) {
        // Instantiate all (non-deleted) clients so their associated addresses are
        //  loaded onto local key storage
        Catenis.db.collection.Client.find({status: {$ne: Client.status.deleted.name}}).forEach((doc) => {
            // Instantiate Client object making sure that associated devices are also initialized
            Catenis.logger.TRACE('About to initialize client', {clientId: doc.clientId});
            new Client(doc, this, true);
        });
    }
}


// Public CatenisNode object methods
//

// NOTE: this method should be used ONLY with the Catenis Hub instance
CatenisNode.prototype.startNode = function () {
    // Execute code in critical section to avoid UTXOs concurrency
    FundSource.utxoCS.execute(() => {
        // Make sure that system is properly funded
        this.checkFundingBalance();

        // Check if system device main addresses are already funded
        const devMainAddresses = this.deviceMainAddr.listAddressesInUse(),
              distribFund = Service.distributeSystemDeviceMainAddressFund();
        let devMainAddrBalance = undefined;

        if (devMainAddresses.length > 0) {
            // System device main addresses already exist. Check if
            //  balance is as expected
            devMainAddrBalance = (new FundSource(devMainAddresses, {})).getBalance();
        }

        if (devMainAddrBalance != undefined && devMainAddrBalance > 0) {
            if (devMainAddrBalance != distribFund.totalAmount) {
                // Amount funded to system device main addresses different than expected.
                //  Log inconsistent condition
                Catenis.logger.WARN(util.format('Amount funded to Catenis node #%d system device main addresses different than expected. Current amount: %s, expected amount: %s', this.ctnNodeIndex, Util.formatCoins(devMainAddrBalance), Util.formatCoins(distribFund.totalAmount)));
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
        currBalance: (new FundSource(this.listFundingAddressesInUse(), {})).getBalance(),
        minBalance: Service.minimumFundingBalance,
        balanceOK: function () {
            return this.currBalance >= this.minBalance;
        }
    };

    if (checkResult.currBalance < checkResult.minBalance) {
        // Funding balance too low. Send notification refund the system
        Catenis.logger.ACTION('Catenis funding balance too low.', util.format('\nCurrent balance: %s, expected minimum balance: %s\n\nACTION REQUIRED: please refund Catenis immediately.',
            Util.formatCoins(checkResult.currBalance), Util.formatCoins(checkResult.minBalance)));
    }

    return checkResult;
};

CatenisNode.prototype.currentServiceCreditsCount = function () {
    const counter = {};

    counter[Client.serviceCreditType.message] = new ServiceCreditsCounter();
    counter[Client.serviceCreditType.asset] = new ServiceCreditsCounter();

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
    return Catenis.db.collection.ReceivedTransaction.find({type: Transaction.type.send_message.name, 'info.sendMessage.readConfirmation.spent': false}, {fields: {_id: 1}}).count();
};

// NOTE: make sure that this method is called from code executed from the FundSource.utxoCS
//  critical section object
CatenisNode.prototype.checkPayTxExpenseFundingBalance = function () {
    const currServiceCreditsCount = this.currentServiceCreditsCount();
    const checkResult = {
        currBalance: (new FundSource(this.listFundingAddressesInUse(), {})).getBalance(),
        expectedBalance: Service.getExpectedPayTxExpenseBalance(currServiceCreditsCount[Client.serviceCreditType.message].total, this.currentUnreadMessagesCount(), currServiceCreditsCount[Client.serviceCreditType.asset].total),
        balanceOK: function () {
            return this.currBalance >= this.expectedBalance;
        }
    };

    if (checkResult.currBalance < checkResult.expectedBalance) {
        // Refund system pay tx expense addresses
        // Allocate system pay tx expense addresses...
        const distribFund = Service.distributePayTxExpenseFund(checkResult.expectedBalance - checkResult.currBalance);

        // ...and try to fund them
        this.fundPayTxExpenseAddresses(distribFund.amountPerAddress);
    }

    return checkResult;
};

CatenisNode.prototype.getClientByIndex = function (clientIndex, includeDeleted = true) {
    // Retrieve Client doc/rec
    const query = {
        'index.ctnNodeIndex': this.ctnNodeIndex,
        'index.clientIndex': clientIndex
    };

    if (!includeDeleted) {
        query.status = {$ne: Client.status.deleted.name};
    }

    const docClient = Catenis.db.collection.Client.findOne(query);

    if (docClient == undefined) {
        // No client available with the given index. Log error and throw exception
        Catenis.logger.ERROR(util.format('Could not find client with given index for this Catenis node (ctnNodeIndex: %s)', this.ctnNodeIndex), {clientIndex: clientIndex});
        throw new Meteor.Error('ctn_client_not_found', util.format('Could not find client with given index (%s) for this Catenis node (ctnNodeIndex: %s)', clientIndex, this.ctnNodeIndex));
    }

    return new Client(docClient, this);
};

CatenisNode.prototype.delete = function () {
    if (this.type === CatenisNode.nodeType.hub.name) {
        // Trying to delete Catenis Hub node. Log error and throw exception
        Catenis.logger.ERROR('Trying to delete Catenis Hub node, which cannot be deleted');
        throw new Meteor.Error('ctn_node_hub_delete_error', 'Trying to delete Catenis Hub node, which cannot be deleted');
    }

    if (this.status !== CatenisNode.status.deleted.name) {
        const deletedDate = new Date(Date.now());

        // Iteratively deletes all clients associated with this Catenis node
        Catenis.db.collection.Client.find({
            catenisNode_id: this.doc_id,
            status: {$ne: Client.status.deleted.name}
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

// Update Catenis node properties
//
// Arguments:
//  props: [string] - new name of Catenis node
//         or
//         [object] - object containing properties that should be updated and their corresponding new values.
//                     To delete a property, set it as undefined.
//
CatenisNode.prototype.updateProperties = function (newProps) {
    newProps = typeof newProps === 'string' ? {name: newProps} : (typeof newProps === 'object' && newProps !== null ? newProps : {});

    if (this.type === CatenisNode.nodeType.hub.name) {
        // Avoid that name and description of Catenis Hub node be changed
        if ('name' in newProps) {
            delete newProps.name;
        }

        if ('description' in newProps) {
            delete newProps.description;
        }
    }

    if (Object.keys(newProps).length > 0) {
        // Validate (pre-defined) properties
        const errProp = {};

        // Do not allow this property to be deleted (thus it cannot be undefined)
        if ('name' in newProps && typeof newProps.name !== 'string') {
            errProp.name = newProps.name;
        }

        // Allow this property to be undefined so it can be deleted
        if ('description' in newProps && (typeof newProps.description !== 'string' && typeof newProps.description !== 'undefined')) {
            errProp.description = newProps.description;
        }

        if (Object.keys(errProp).length > 0) {
            const errProps = Object.keys(errProp);

            Catenis.logger.ERROR(util.format('CatenisNode.updateProperties method called with invalid propert%s', errProps.length > 1 ? 'ies' : 'y'), errProp);
            throw Error(util.format('Invalid %s propert%s', errProps.join(', '), errProps.length > 1 ? 'ies' : 'y'));
        }

        // Make sure that Catenis node is not deleted
        if (this.status === CatenisNode.status.deleted.name) {
            // Cannot update properties of a deleted Catenis node. Log error and throw exception
            Catenis.logger.ERROR('Cannot update properties of a deleted Catenis node', {ctnNodeIndex: this.ctnNodeIndex});
            throw new Meteor.Error('ctn_node_deleted', util.format('Cannot update properties of a deleted Catenis node (ctnNodeIndex: %d)', this.ctnNodeIndex));
        }

        // Retrieve current Catenis node properties
        const currProps = Catenis.db.collection.CatenisNode.findOne({_id: this.doc_id}, {fields: {props: 1}}).props;
        let props = _und.clone(currProps);

        // Merge properties to update
        _und.extend(props, newProps);

        // Extract properties that are undefined
        props = _und.omit(props, (value) => {
            return _und.isUndefined(value);
        });

        if (!_und.isEqual(props, currProps)) {
            try {
                // Update Catenis node doc/rec setting the new properties
                Catenis.db.collection.CatenisNode.update({_id: this.doc_id}, {$set: {props: props}});
            }
            catch (err) {
                // Error updating CatenisNode doc/rec. Log error and throw exception
                Catenis.logger.ERROR(util.format('Error trying to update Catenis node properties (doc_id: %s).', this.doc_id), err);
                throw new Meteor.Error('ctn_node_update_error', util.format('Error trying to update Catenis node properties (doc_id: %s)', this.doc_id), err.stack);
            }

            // Update properties locally too
            this.props = props;
        }
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
    props = typeof props === 'string' ? {name: props} : (typeof props === 'object' && props !== null ? props : {});

    // Validate (pre-defined) properties
    const errProp = {};

    if ('name' in props && typeof props.name !== 'string') {
        errProp.name = props.name;
    }

    if (Object.keys(errProp).length > 0) {
        const errProps = Object.keys(errProp);

        Catenis.logger.ERROR(util.format('CatenisNode.createClient method called with invalid propert%s', errProps.length > 1 ? 'ies' : 'y'), errProp);
        throw Error(util.format('Invalid %s propert%s', errProps.join(', '), errProps.length > 1 ? 'ies' : 'y'));
    }

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
            props: props,
            apiAccessGenKey: Random.secret(),
            status: user_id != undefined && docUser.services != undefined && docUser.services.password != undefined ? Client.status.active.name : Client.status.new.name,
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
        fundTransact = new FundTransaction(FundTransaction.fundingEvent.add_extra_tx_pay_funds);

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
        fundTransact = new FundTransaction(FundTransaction.fundingEvent.provision_system_device);

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
    Catenis.db.collection.CatenisNode.find({type: CatenisNode.nodeType.gateway.name}).forEach((doc) => {
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
//      name: [string], - (optional)
//      description: [string] - (optional)
//      (any additional property)
//    }
//
//  Returns: (HD node) index of newly created Catenis node
//
//  NOTE: this method is used to create only Catenis nodes of the gateway type
//      since there should be only one Catenis Hub node and it is pre-created
//
CatenisNode.createCatenisNode = function (props) {
    props = typeof props === 'string' ? {name: props} : (typeof props === 'object' && props !== null ? props : {});

    // Validate (pre-defined) properties
    const errProp = {};

    if ('name' in props && typeof props.name !== 'string') {
        errProp.name = props.name;
    }

    if ('description' in props && typeof props.description !== 'string') {
        errProp.description = props.description;
    }

    if (Object.keys(errProp).length > 0) {
        const errProps = Object.keys(errProp);

        Catenis.logger.ERROR(util.format('CatenisNode.createCatenisNode method called with invalid propert%s', errProps.length > 1 ? 'ies' : 'y'), errProp);
        throw Error(util.format('Invalid %s propert%s', errProps.join(', '), errProps.length > 1 ? 'ies' : 'y'));
    }

    let docCtnNode = undefined;

    // Execute code in critical section to avoid DB concurrency
    dbCS.execute(() => {
        // Get next Catenis node index and validate it
        let ctnNodeIndex = CatenisNode.ctnNodeCtrl.lastCtnNodeIndex;

        //noinspection StatementWithEmptyBodyJS
        while (!Catenis.keyStore.initCatenisNodeHDNodes(++ctnNodeIndex));

        // Prepare to create Catenis node doc/rec
        if (!('name' in props)) {
            // If no name defined, use default naming for Catenis (gateway) node
            props.name = util.format('Catenis Gateway #%d', ctnNodeIndex);
        }

        docCtnNode = {
            type: CatenisNode.nodeType.gateway.name,
            ctnNodeIndex: ctnNodeIndex,
            props: props,
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

CatenisNode.getCatenisNodeByIndex = function (ctnNodeIndex, includeDeleted = true) {
    if (ctnNodeIndex == Catenis.application.ctnHubNodeIndex) {
        return Catenis.ctnHubNode;
    }
    else {
        // Retrieve Catenis node doc/rec
        const query = {
            type: CatenisNode.nodeType.gateway.name,
            ctnNodeIndex: ctnNodeIndex
        };

        if (!includeDeleted) {
            query.status = {$ne: CatenisNode.status.deleted.name};
        }

        const docCtnNode = Catenis.db.collection.CatenisNode.findOne(query);

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
//      CatenisNode (function class) object is frozen.
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
    let doc;

    if ((doc = Catenis.db.collection.Client.findOne({clientId: id}, {fields:{_id: 1, index: 1}}))) {
        // New client ID is already in use. Log warning condition and reset ID
        Catenis.logger.WARN(util.format('Client ID for Catenis node index %d and client index %d is already in use', ctnNodeIndex, clientIndex), {existingClientDoc: doc});
        id = undefined;
    }

    return id;
}


// Module code
//

// Lock function class
Object.freeze(CatenisNode);