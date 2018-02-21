import { Asset } from './Asset';

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
const events = require('events');
// Third-party node modules
import config from 'config';
import _und from 'underscore';     // NOTE: we dot not use the underscore library provided by Meteor because we need
                                   //        a feature (_und.omit(obj,predicate)) that is not available in that version

// Meteor packages
import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { CriticalSection } from './CriticalSection';
import {
    SystemDeviceMainAddress,
    SystemFundingPaymentAddress,
    SystemFundingChangeAddress,
    SystemPayTxExpenseAddress,
    SystemReadConfirmSpendNotifyAddress,
    SystemReadConfirmSpendOnlyAddress,
    SystemReadConfirmSpendNullAddress,
    SystemReadConfirmPayTxExpenseAddress,
    SystemServiceCreditIssuingAddress,
    SystemServicePaymentPayTxExpenseAddress,
    SystemMultiSigSigneeAddress
} from './BlockchainAddress';
import {
    Client,
    cfgSettings as clientCfgSettings
} from './Client';
import { FundSource } from './FundSource';
import { FundTransaction } from './FundTransaction';
import { Service } from './Service';
import { Transaction } from './Transaction';
import { Util } from './Util';
import { BitcoinFees } from './BitcoinFees'
import { BalanceInfo } from './BalanceInfo';
import { Permission } from './Permission';
import { TransactionMonitor } from './TransactionMonitor';

// Config entries
const ctnNodeConfig = config.get('catenisNode');
const ctnNodeServCreditAssetConfig = ctnNodeConfig.get('serviceCreditAsset');
const ctnNodeSrvCredAsstIssueOptsConfig = ctnNodeServCreditAssetConfig.get('issuingOpts');

// Configuration settings
const cfgSettings = {
    serviceCreditAsset: {
        nameFormat: ctnNodeServCreditAssetConfig.get('nameFormat'),
        descriptionFormat: ctnNodeServCreditAssetConfig.get('descriptionFormat'),
        issuingOpts: {
            type: ctnNodeSrvCredAsstIssueOptsConfig.get('type'),
            divisibility: ctnNodeSrvCredAsstIssueOptsConfig.get('divisibility'),
            isAggregatable: ctnNodeSrvCredAsstIssueOptsConfig.get('isAggregatable')
        }
    }
};


// Critical section object to avoid concurrent access to database at the
//  module level (when creating new Catenis nodes basically)
const dbCS = new CriticalSection();


// Definition of function classes
//

// CatenisNode function class
export class CatenisNode extends events.EventEmitter {
    constructor (docCtnNode, initializeClients) {
        super();

        // Save relevant info from CatenisNode doc/rec
        this.doc_id = docCtnNode._id;
        this.type = docCtnNode.type;
        this.ctnNodeIndex = docCtnNode.ctnNodeIndex;
        this.props = docCtnNode.props;
        this.status = docCtnNode.status;

        Object.defineProperty(this, 'internalName', {
            get: function () {
                return this.type === CatenisNode.nodeType.hub.name ? 'Catenis Hub node' : util.format('Catenis Gateway #%d node', this.ctnNodeIndex);
            },
            enumerable: true
        });

        // Instantiate objects to manage blockchain addresses for Catenis node
        this.deviceMainAddr = SystemDeviceMainAddress.getInstance(this.ctnNodeIndex);
        this.fundingPaymentAddr = SystemFundingPaymentAddress.getInstance(this.ctnNodeIndex);
        this.fundingChangeAddr = SystemFundingChangeAddress.getInstance(this.ctnNodeIndex);
        this.payTxExpenseAddr = SystemPayTxExpenseAddress.getInstance(this.ctnNodeIndex);
        this.readConfirmSpendNotifyAddr = SystemReadConfirmSpendNotifyAddress.getInstance(this.ctnNodeIndex);
        this.readConfirmSpendOnlyAddr = SystemReadConfirmSpendOnlyAddress.getInstance(this.ctnNodeIndex);
        this.readConfirmSpendNullAddr = SystemReadConfirmSpendNullAddress.getInstance(this.ctnNodeIndex);
        this.readConfirmPayTxExpenseAddr = SystemReadConfirmPayTxExpenseAddress.getInstance(this.ctnNodeIndex);
        this.servCredIssueAddr = SystemServiceCreditIssuingAddress.getInstance(this.ctnNodeIndex);
        this.servPymtPayTxExpenseAddr = SystemServicePaymentPayTxExpenseAddress.getInstance(this.ctnNodeIndex);
        this.multiSigSigneeAddr = SystemMultiSigSigneeAddress.getInstance(this.ctnNodeIndex);

        // Retrieve (HD node) index of last Client doc/rec created for this Catenis node
        const docClient = Catenis.db.collection.Client.findOne({catenisNode_id: this.doc_id}, {
            fields: {'index.clientIndex': 1},
            sort: {'index.clientIndex': -1}
        });

        this.lastClientIndex = docClient !== undefined ? docClient.index.clientIndex : 0;

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

        // Set up handler to process event indicating that credit service account tx has been confirmed
        TransactionMonitor.addEventHandler(TransactionMonitor.notifyEvent.credit_service_account_tx_conf.name, creditServAccTxConfirmed);
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
            devMainAddrBalance = new FundSource(devMainAddresses, {unconfUtxoInfo: {}}).getBalance(true);
        }

        if (devMainAddrBalance !== undefined && devMainAddrBalance > 0) {
            if (devMainAddrBalance !== distribFund.totalAmount) {
                // Amount funded to system device main addresses different than expected
                if (distribFund.totalAmount > devMainAddrBalance) {
                    // Expected funding amount is higher than currently funded amount.
                    //  Allocate amount difference to fix funding of system device main addresses
                    Catenis.logger.INFO('Amount funded to Catenis node system device main addresses lower than expected', {
                        ctnNodeIndex: this.ctnNodeIndex,
                        expectedFundingAmount: Util.formatCoins(distribFund.totalAmount),
                        currentFundingAmount: Util.formatCoins(devMainAddrBalance)
                    });
                    distribFund.totalAmount = distribFund.totalAmount - devMainAddrBalance;
                    distribFund.amountPerAddress = Service.distributeSystemMainAddressDeltaFund(distribFund.totalAmount);

                    // Fix funding of device main addresses
                    fundDeviceMainAddresses.call(this, distribFund.amountPerAddress);
                }
                else {
                    // Expected funding amount lower than currently funded amount.
                    //  Just log inconsistent condition
                    Catenis.logger.WARN('Amount funded to Catenis node system device main addresses higher than expected', {
                        ctnNodeIndex: this.ctnNodeIndex,
                        expectedFundingAmount: Util.formatCoins(distribFund.totalAmount),
                        currentFundingAmount: Util.formatCoins(devMainAddrBalance)
                    });
                }
            }
        }
        else {
            // System device main addresses not funded yet, so fund them now
            fundDeviceMainAddresses.call(this, distribFund.amountPerAddress);
        }

        // Make sure that system service credit issuance is properly provisioned
        this.checkServiceCreditIssuanceProvision();

        // Make sure that system service payment pay tx expense addresses are properly funded
        this.checkServicePaymentPayTxExpenseFundingBalance();

        // Make sure that system pay tx expense addresses are properly funded
        this.checkPayTxExpenseFundingBalance();

        // Make sure that system read confirmation pay tx expense addresses are properly funded
        this.checkReadConfirmPayTxExpenseFundingBalance();
    });

    // Prepare to receive notification that bitcoin fee rates changed
    Catenis.bitcoinFees.on(BitcoinFees.notifyEvent.bitcoin_fees_changed.name, processBitcoinFeesChange.bind(this));
};

CatenisNode.prototype.serviceCreditAssetInfo = function () {
    return {
        name: util.format(cfgSettings.serviceCreditAsset.nameFormat, this.internalName,
            Catenis.application.testPrefix !== undefined ? (' (' + Catenis.application.testPrefix + ')') : ''),
        description: util.format(cfgSettings.serviceCreditAsset.descriptionFormat, this.internalName),
        issuingOpts: cfgSettings.serviceCreditAsset.issuingOpts
    }
};

CatenisNode.prototype.getServiceCreditAsset = function () {
    try {
        return Asset.getAssetByIssuanceAddressPath(Catenis.keyStore.getAddressInfo(this.servCredIssueAddr.lastAddressKeys().getAddress()).path);
    }
    catch (err) {
        if (!((err instanceof Meteor.Error) && err.error === 'ctn_asset_not_found')) {
            Catenis.logger.ERROR('Error retrieving Catenis service credit asset.', err);
            throw new Meteor.Error('ctn_node_serv_cred_asset_error', 'Error retrieving Catenis service credit asset', err.stack);
        }
    }
};

CatenisNode.prototype.listFundingAddressesInUse = function () {
    return this.fundingPaymentAddr.listAddressesInUse().concat(this.fundingChangeAddr.listAddressesInUse());
};

// NOTE: make sure that this method is called from code executed from the FundSource.utxoCS
//  critical section object
CatenisNode.prototype.checkFundingBalance = function () {
    if (updateFundingBalanceInfo.call(this)) {
        if (this.fundingBalanceInfo.hasLowBalance()) {
            // Funding balance too low. Send notification to refund the system
            Catenis.logger.ACTION('Catenis funding balance too low.', util.format('\nCurrent balance: %s, expected minimum balance: %s\n\nACTION REQUIRED: please refund Catenis immediately.',
                Util.formatCoins(this.fundingBalanceInfo.currentBalance), Util.formatCoins(this.fundingBalanceInfo.minimumBalance)));
        }

        // Emit event notifying that funding balance info has changed
        this.emit(CatenisNode.notifyEvent.funding_balanced_info_changed.name, {
            fundingBalanceInfo: this.fundingBalanceInfo
        });
    }
};

CatenisNode.prototype.currentUnreadMessagesCount = function () {
    return Catenis.db.collection.ReceivedTransaction.find({type: Transaction.type.send_message.name, 'info.sendMessage.readConfirmation.spent': false}, {fields: {_id: 1}}).count();
};

// NOTE: make sure that this method is called from code executed from the FundSource.utxoCS
//  critical section object
CatenisNode.prototype.checkPayTxExpenseFundingBalance = function () {
    const payTxBalanceInfo = new BalanceInfo(Service.getMinimumPayTxExpenseBalance(), this.payTxExpenseAddr.listAddressesInUse(), {
            safetyFactor: Service.payTxExpBalanceSafetyFactor
    });

    if (payTxBalanceInfo.hasLowBalance()) {
        // Prepare to refund system pay tx expense addresses

        // Distribute funds to be allocated
        const distribFund = Service.distributePayTxExpenseFund(payTxBalanceInfo.getBalanceDifference());

        // And try to fund system pay tx expense addresses
        this.fundPayTxExpenseAddresses(distribFund.amountPerAddress);
    }

    return payTxBalanceInfo.hasLowBalance();
};

// NOTE: make sure that this method is called from code executed from the FundSource.utxoCS
//  critical section object
CatenisNode.prototype.checkServiceCreditIssuanceProvision = function () {
    const servCredIssuanceBalanceInfo = new BalanceInfo(Service.getExpectedServiceCreditIssuanceBalance(),
        this.servCredIssueAddr.lastAddressKeys().getAddress(), {
            useSafetyFactor: false
        });

    if (servCredIssuanceBalanceInfo.hasLowBalance()) {
        // Prepare to provision system for service credit issuance

        // Distribute funds to be allocated
        const distribFund = Service.distributeServiceCreditIssuanceFund(servCredIssuanceBalanceInfo.getBalanceDifference());

        // And try to fund system service credit issuance address
        this.provisionServiceCreditIssuance(distribFund.amountPerAddress);
    }

    return servCredIssuanceBalanceInfo.hasLowBalance();
};

// NOTE: make sure that this method is called from code executed from the FundSource.utxoCS
//  critical section object
CatenisNode.prototype.checkServicePaymentPayTxExpenseFundingBalance = function () {
    const servPymtPayTxBalanceInfo = new BalanceInfo(Service.getExpectedServicePaymentPayTxExpenseBalance(),
        this.servPymtPayTxExpenseAddr.listAddressesInUse(), {
            safetyFactor: Service.servicePaymentPayTxExpBalanceSafetyFactor
        });

    if (servPymtPayTxBalanceInfo.hasLowBalance()) {
        // Prepare to refund system service payment pay tx expense addresses

        // Distribute funds to be allocated
        const distribFund = Service.distributeServicePaymentPayTxExpenseFund(servPymtPayTxBalanceInfo.getBalanceDifference());

        // And try to fund system service payment pay tx expense addresses
        this.fundServicePaymentPayTxExpenseAddresses(distribFund.amountPerAddress);
    }

    return servPymtPayTxBalanceInfo.hasLowBalance();
};

// NOTE: make sure that this method is called from code executed from the FundSource.utxoCS
//  critical section object
CatenisNode.prototype.checkReadConfirmPayTxExpenseFundingBalance = function () {
    const readConfirmPayTxBalanceInfo = new BalanceInfo(Service.getExpectedReadConfirmPayTxExpenseBalance(this.currentUnreadMessagesCount()),
        this.readConfirmPayTxExpenseAddr.listAddressesInUse(), {
            safetyFactor: Service.readConfirmPayTxExpBalanceSafetyFactor
        });

    if (readConfirmPayTxBalanceInfo.hasLowBalance()) {
        // Prepare to refund system read confirmation pay tx expense addresses

        // Distribute funds to be allocated
        const distribFund = Service.distributeReadConfirmPayTxExpenseFund(readConfirmPayTxBalanceInfo.getBalanceDifference());

        // And try to fund system read confirmation pay tx expense addresses
        this.fundReadConfirmPayTxExpenseAddresses(distribFund.amountPerAddress);
    }

    return readConfirmPayTxBalanceInfo.hasLowBalance();
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

    if (docClient === undefined) {
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

// Get Catenis node's basic identification information
CatenisNode.prototype.getIdentityInfo = function () {
    const idInfo = {
        catenisNode: {
            ctnNodeIndex: this.ctnNodeIndex
        }
    };

    if (this.props.name !== undefined) {
        idInfo.catenisNode.name = this.props.name;
    }

    if (this.props.description !== undefined) {
        idInfo.catenisNode.description = this.props.description;
    }

    return idInfo;
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
//    billingMode: [String] - (optional) Identifies that billing mode to be used for this client. The value of one of the properties of Client.billingMode object
//    deviceDefaultRightsByEvent: [Object] - (optional) Default rights to be used when creating new devices. Object the keys of which should be the defined permission event names.
//                                         -  The value for each event name key should be a rights object as defined for the Permission.setRights method
CatenisNode.prototype.createClient = function (props, user_id, billingMode = Client.billingMode.prePaid, deviceDefaultRightsByEvent) {
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

    if (user_id !== undefined) {
        // Make sure that user ID is valid
        docUser = Meteor.users.findOne({_id: user_id}, {fields: {_id: 1, 'services.password': 1, 'catenis.client_id': 1}});

        if (docUser === undefined) {
            // ID passed is not from a valid user. Log error and throw exception
            Catenis.logger.ERROR('Invalid user ID for creating client', {userId: user_id});
            throw new Meteor.Error('ctn_client_invalid_user_id', util.format('Invalid user ID (%s) for creating client', user_id));
        }
        else if (docUser.catenis !== undefined && docUser.catenis.client_id !== undefined) {
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
            billingMode: billingMode,
            status: user_id !== undefined && docUser.services !== undefined && docUser.services.password !== undefined ? Client.status.active.name : Client.status.new.name,
            createdDate: new Date(Date.now())
        };

        if (user_id !== undefined) {
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

        if (user_id !== undefined) {
            try {
                // Update User doc/rec saving the ID of the client associated with it
                Meteor.users.update({_id: user_id}, {$set: {'catenis.client_id': docClient._id}});
            }
            catch (err) {
                Catenis.logger.ERROR(util.format('Error updating user (Id: %s) associated with new client (doc Id: %s).', user_id, docClient._id), err);
                throw new Meteor.Error('ctn_client_update_user_error', util.format('Error updating user (Id: %s) associated with new client (doc Id: %s).', user_id, docClient._id), err.stack);
            }
        }

        let client;

        try {
            // Instantiate client and set device default rights. If no device default rights
            //  are specified, get system's configured default
            client = new Client(docClient, this);

            client.setDeviceDefaultRights(deviceDefaultRightsByEvent !== undefined ? deviceDefaultRightsByEvent : clientCfgSettings.deviceDefaultRightsByEvent);
        }
        catch (err) {
            Catenis.logger.ERROR(util.format('Error setting device default permission rights for newly created client (clientId: %s).', client.clientId), err);
            throw new Meteor.Error('ctn_client_device_default_rights_error', util.format('Error setting device default permission rights for newly created client (clientId: %s).', client.clientId), err.stack);
        }

        // Now, adjust last client index
        this.lastClientIndex = clientIndex;
    });

    // If we hit this point, a new Client doc (rec) has been successfully created

    if (docClient.status === Client.status.active.name) {
        // Execute code in critical section to avoid UTXOs concurrency
        FundSource.utxoCS.execute(() => {
            // Make sure that system service credit issuance is properly provisioned
            this.checkServiceCreditIssuanceProvision();
        });
    }

    // Return ID of newly created client
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
        // Error funding system pay tx expense addresses.
        //  Log error condition
        Catenis.logger.ERROR('Error funding system pay tx expense addresses.', err);

        if (fundTransact !== undefined) {
            // Revert addresses of payees added to transaction
            fundTransact.revertPayeeAddresses();
        }

        // Rethrows exception
        throw err;
    }
};

// NOTE: make sure that this method is called from code executed from the FundSource.utxoCS
//  critical section object
CatenisNode.prototype.provisionServiceCreditIssuance = function (amountPerUtxo) {
    let fundTransact = undefined;

    try {
        // Prepare transaction to provision system for service credit issuance
        fundTransact = new FundTransaction(FundTransaction.fundingEvent.provision_service_credit_issuance);

        fundTransact.addPayees(this.servCredIssueAddr, amountPerUtxo, true);

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
        // Error provisioning system for service credit issuance.
        //  Log error condition
        Catenis.logger.ERROR('Error provisioning system for service credit issuance.', err);

        // Rethrows exception
        throw err;
    }
};

// NOTE: make sure that this method is called from code executed from the FundSource.utxoCS
//  critical section object
CatenisNode.prototype.fundServicePaymentPayTxExpenseAddresses = function (amountPerAddress) {

    let fundTransact = undefined;

    try {
        // Prepare transaction to fund system service payment pay tx expense addresses
        fundTransact = new FundTransaction(FundTransaction.fundingEvent.add_extra_service_payment_tx_pay_funds);

        fundTransact.addPayees(this.servPymtPayTxExpenseAddr, amountPerAddress);

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
        // Error funding system service payment pay tx expense addresses.
        //  Log error condition
        Catenis.logger.ERROR('Error funding system service payment pay tx expense addresses.', err);

        if (fundTransact !== undefined) {
            // Revert addresses of payees added to transaction
            fundTransact.revertPayeeAddresses();
        }

        // Rethrows exception
        throw err;
    }
};

// NOTE: make sure that this method is called from code executed from the FundSource.utxoCS
//  critical section object
CatenisNode.prototype.fundReadConfirmPayTxExpenseAddresses = function (amountPerAddress) {
    let fundTransact = undefined;

    try {
        // Prepare transaction to fund system read confirmation pay tx expense addresses
        fundTransact = new FundTransaction(FundTransaction.fundingEvent.add_extra_read_confirm_tx_pay_funds);

        fundTransact.addPayees(this.readConfirmPayTxExpenseAddr, amountPerAddress);

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
        // Error funding system read confirmation pay tx expense addresses.
        //  Log error condition
        Catenis.logger.ERROR('Error funding system read confirmation pay tx expense addresses.', err);

        if (fundTransact !== undefined) {
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

function processBitcoinFeesChange() {
    // Execute code in critical section to avoid UTXOs concurrency
    FundSource.utxoCS.execute(() => {
        // Make sure that funding balance info is updated
        this.checkFundingBalance();
    });
}

// NOTE: make sure that this method is called from code executed from the FundSource.utxoCS
//  critical section object
function updateFundingBalanceInfo() {
    let hasChanged = false;

    const currFundingBalanceInfo = new BalanceInfo(Service.minimumFundingBalance, this.listFundingAddressesInUse(), {
        useSafetyFactor: false
    });

    if (this.fundingBalanceInfo === undefined || this.fundingBalanceInfo.currentBalance !== currFundingBalanceInfo.currentBalance || this.fundingBalanceInfo.minimumBalance !== currFundingBalanceInfo.minimumBalance) {
        this.fundingBalanceInfo = currFundingBalanceInfo;
        hasChanged = true;
    }

    return hasChanged;
}

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

        if (fundTransact !== undefined) {
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

    CatenisNode.ctnNodeCtrl.lastCtnNodeIndex = docCtnNode !== undefined ? docCtnNode.ctnNodeIndex : 0;

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
    if (ctnNodeIndex === Catenis.application.ctnHubNodeIndex) {
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

        if (docCtnNode === undefined) {
            // No Catenis node available with the given index. Log error and throw exception
            Catenis.logger.ERROR('Could not find Catenis node with given index', {ctnNodeIndex: ctnNodeIndex});
            throw new Meteor.Error('ctn_node_not_found', util.format('Could not find Catenis node with given index (%s)', ctnNodeIndex));
        }

        return new CatenisNode(docCtnNode);
    }
};

// Check if a given Catenis node exists
//
//  Argument:
//   ctnNodeIndex [Number] - Index of Catenis node to check existence
//   selfReferenceAccepted [Boolean] - Indicate whether 'self' token should be accepted for Catenis node index
//   wildcardAccepted [Boolean] - Indicate whether wildcard ('*') should be accepted for Catenis node index
//   includeDeleted [Boolean] - Indicate whether deleted Catenis nodes should also be included in the check
//
//  Result:
//   [Boolean] - Indicates whether the Catenis node being checked exists or not
CatenisNode.checkExist = function (ctnNodeIndex, selfReferenceAccepted = false, wildcardAccepted = false, includeDeleted = false) {
    if ((selfReferenceAccepted && ctnNodeIndex === Permission.entityToken.ownHierarchy) || (wildcardAccepted && ctnNodeIndex === Permission.entityToken.wildcard)) {
        return true;
    }
    else {
        if (ctnNodeIndex === undefined) {
            return false;
        }

        const selector = {
            ctnNodeIndex: ctnNodeIndex
        };

        if (!includeDeleted) {
            selector.status = {
                $ne: CatenisNode.status.deleted.name
            }
        }

        const docCtnNode = Catenis.db.collection.CatenisNode.findOne(selector, {fields: {_id: 1}});

        return docCtnNode !== undefined;
    }
};

// Check if one or more Catenis nodes exist
//
//  Argument:
//   ctnNodeIndices [Array(Number|String)|Number|String] - List of UNIQUE indices (or a single index) of Catenis nodes to check existence
//   selfReferenceAccepted [Boolean] - Indicate whether 'self' token should be accepted for Catenis node index
//   wildcardAccepted [Boolean] - Indicate whether wildcard ('*') should be accepted for Catenis node index
//   includeDeleted [Boolean] - Indicate whether deleted Catenis nodes should also be included in the check
//
//  Result:
//   result: {
//     doExist: [Boolean] - Indicates whether all Catenis nodes being checked exist or not
//     nonexistentCtnNodeIndices: [Array(Number)] - List of indices of Catenis nodes, from the ones that were being checked, that do not exist
//   }
CatenisNode.checkExistMany = function (ctnNodeIndices, selfReferenceAccepted = false, wildcardAccepted = false, includeDeleted = false) {
    const result = {};

    if (Array.isArray(ctnNodeIndices)) {
        if (ctnNodeIndices.length === 0) {
            return {
                doExist: false
            };
        }

        if (selfReferenceAccepted || wildcardAccepted) {
            // Filter out self reference and/or wildcard ID
            ctnNodeIndices = ctnNodeIndices.filter((ctnNodeIndex) => (!selfReferenceAccepted || ctnNodeIndex !== Permission.entityToken.ownHierarchy) && (!wildcardAccepted || ctnNodeIndex !== Permission.entityToken.wildcard));

            if (ctnNodeIndices.length === 0) {
                return {
                    doExist: true
                }
            }
        }

        // Try to convert indices to integer if not yet an integer
        ctnNodeIndices = ctnNodeIndices.map((ctnNodeIndex) => {
            let result = ctnNodeIndex;

            if (!Number.isInteger(ctnNodeIndex)) {
                const parsedIndex = parseInt(ctnNodeIndex);

                if (!Number.isNaN(parsedIndex)) {
                    result = parsedIndex;
                }
            }

            return result;
        });

        const selector = {
            ctnNodeIndex: {
                $in: ctnNodeIndices
            }
        };

        if (!includeDeleted) {
            selector.status = {
                $ne: CatenisNode.status.deleted.name
            };
        }

        const resultSet = Catenis.db.collection.CatenisNode.find(selector, {
            fields: {
                ctnNodeIndex: 1
            }
        });

        if (resultSet.count() !== ctnNodeIndices.length) {
            // Not all indices returned. Indicated that not all exist and identify the ones that do not
            result.doExist = false;
            result.nonexistentCtnNodeIndices = [];
            const existingCtnNodeIndices = new Set(resultSet.fetch().map(doc => doc.ctnNodeIndex));

            ctnNodeIndices.forEach((ctnNodeIndex) => {
                if (!existingCtnNodeIndices.has(ctnNodeIndex)) {
                    result.nonexistentCtnNodeIndices.push(ctnNodeIndex);
                }
            });
        }
        else {
            // Found all indices. Indicate that all exist
            result.doExist = true;
        }
    }
    else {
        // A single Catenis node index had been passed to be checked
        result.doExist = CatenisNode.checkExist(ctnNodeIndices, selfReferenceAccepted, wildcardAccepted, includeDeleted);

        if (!result.doExist) {
            result.nonexistentCtnNodeIndices = [ctnNodeIndices];
        }
    }

    return result;
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

CatenisNode.notifyEvent = Object.freeze({
    funding_balanced_info_changed: Object.freeze({
        name: 'funding_balanced_info_changed',
        description: 'System funding balance info (either the current balance or the minimum balance) has changed'
    })
});

CatenisNode.serviceCreditAssetDivisibility = cfgSettings.serviceCreditAsset.issuingOpts.divisibility;


// Definition of module (private) functions
//

// Create new client ID dependent on Catenis node index and client index
function newClientId(ctnNodeIndex, clientIndex) {
    let id = 'c' + Random.createWithSeeds(Array.from(Catenis.application.commonSeed.toString() + ':ctnNodeIndex:' + ctnNodeIndex + ',clientIndex:' + clientIndex)).id(19);
    let doc;

    if ((doc = Catenis.db.collection.Client.findOne({clientId: id}, {fields:{_id: 1, index: 1}}))) {
        // New client ID is already in use. Log warning condition and reset ID
        Catenis.logger.WARN(util.format('Client ID for Catenis node index %d and client index %d is already in use', ctnNodeIndex, clientIndex), {existingClientDoc: doc});
        id = undefined;
    }

    return id;
}

// Method used to process notification of confirmed credit service account transaction
function creditServAccTxConfirmed(data) {
    Catenis.logger.TRACE('Received notification of confirmation of credit service account transaction', data);
    try {
        // Force update of Colored Coins data associated with UTXOs
        Catenis.ccFNClient.parseNow();
    }
    catch (err) {
        // Error while processing notification of confirmed credit service account transaction.
        //  Just log error condition
        Catenis.logger.ERROR('Error while processing notification of confirmed credit service account transaction.', err);
    }
}


// Module code
//

// Lock function class
Object.freeze(CatenisNode);
