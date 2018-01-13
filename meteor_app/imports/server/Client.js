/**
 * Created by claudio on 22/06/16.
 */

//console.log('[Client.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//  NOTE: the reference of these modules are done sing 'require()' instead of 'import' to
//      to avoid annoying WebStorm warning message: 'default export is not defined in
//      imported module'
const util = require('util');
const crypto = require('crypto');
// Third-party node modules
import config from 'config';
import _und from 'underscore';     // NOTE: we dot not use the underscore library provided by Meteor because we nee
                                   //        a feature (_und.omit(obj,predicate)) that is not available in that version
// Meteor packages
import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { CriticalSection } from './CriticalSection';
import {
    ClientServiceAccountCreditLineAddress,
    ClientServiceAccountDebitLineAddress,
    ClientBcotPaymentAddress
} from './BlockchainAddress';
import { CatenisNode } from './CatenisNode';
import { Device } from './Device';
import { FundSource } from './FundSource';
import { Permission } from './Permission';
import { CCFundSource } from './CCFundSource';

// Config entries
const clientConfig = config.get('client');

// Configuration settings
export const cfgSettings = {
    deviceDefaultRightsByEvent: clientConfig.get('deviceDefaultRightsByEvent')
};


// Definition of function classes
//

// Client function class
//
//  Constructor arguments:
//    docClient: [Object] - Client database doc/rec
//    ctnNode: [Object] - instance of CatenisNode function class with which client is associated
//    initializeDevices: [boolean] - (optional) indicates whether devices associated with this client
//                              should also be initialized. Defaults to false.
export function Client(docClient, ctnNode, initializeDevices) {
    // Make sure that CatenisNode instance matches Client doc/rec
    if (docClient.catenisNode_id !== ctnNode.doc_id) {
        // CatenisNode instance does not match Client doc/rec. Log error and throw exception
        Catenis.logger.ERROR('Client doc/rec does not match given CatenisNode instance', {docClient: docClient, ctnNode: ctnNode});
        throw new Meteor.Error('ctn_client_invalid_ctn_node', util.format('Client doc/rec (_id: %s, catenisNode_id: %s) does not match given CatenisNode instance (doc_id: %s)', docClient._id, docClient.catenisNode_id, ctnNode.doc_id));
    }

    // Save associated CatenisNode instance
    this.ctnNode = ctnNode;

    // Save relevant info from Client doc/rec
    this.doc_id = docClient._id;
    this.user_id = docClient.user_id;
    this.catenisNode_id = docClient.catenisNode_id;
    this.clientId = docClient.clientId;
    this.clientIndex = docClient.index.clientIndex;
    this.props = docClient.props;
    this.apiAccessGenKey = docClient.apiAccessGenKey;
    this.billingMode = docClient.billingMode;
    this.status = docClient.status;

    Object.defineProperty(this, 'apiAccessSecret', {
        get: function () {
            //noinspection JSPotentiallyInvalidUsageOfThis,JSCheckFunctionSignatures
            return crypto.createHmac('sha512', this.apiAccessGenKey).update('And here it is: the Catenis API key for client' + this.clientId).digest('hex');
        }
    });

    // Instantiate objects to manage blockchain addresses for client
    this.servAccCreditLineAddr = ClientServiceAccountCreditLineAddress.getInstance(this.ctnNode.ctnNodeIndex, this.clientIndex);
    this.servAccDebitLineAddr = ClientServiceAccountDebitLineAddress.getInstance(this.ctnNode.ctnNodeIndex, this.clientIndex);
    this.bcotPaymentAddr = ClientBcotPaymentAddress.getInstance(this.ctnNode.ctnNodeIndex, this.clientIndex);

    // Retrieve (HD node) index of last Device doc/rec created for this client
    const docDevice = Catenis.db.collection.Device.findOne({client_id: this.doc_id}, {fields: {'index.deviceIndex': 1}, sort: {'index.deviceIndex': -1}});

    this.lastDeviceIndex = docDevice !== undefined ? docDevice.index.deviceIndex : 0;

    // Critical section object to avoid concurrent access to database at the
    //  client object level (when creating new devices for this client basically)
    this.clnDbCS = new CriticalSection();

    if (initializeDevices) {
        // Instantiate all (non-deleted) devices associated with this client so their
        //  associated addresses are loaded onto local key storage
        Catenis.db.collection.Device.find({client_id: this.doc_id, status: {$ne: Device.status.deleted.name}}).forEach((doc) => {
            // Instantiate Device object
            Catenis.logger.TRACE('About to initialize device', {deviceId: doc.deviceId});
            new Device(doc, this);
        });
    }
}


// Public Client object methods
//

Client.prototype.assignUser = function (user_id) {
    // Make sure that there is no user currently assigned to this client
    if (this.user_id === undefined) {
        // Make sure that user ID is valid
        const docUser = Meteor.users.findOne({_id: user_id}, {fields: {_id: 1, 'services.password': 1, 'catenis.client_id': 1}});

        if (docUser === undefined) {
            // ID passed is not from a valid user. Log error and throw exception
            Catenis.logger.ERROR('Invalid user ID for assigning to client', {userId: user_id});
            throw new Meteor.Error('ctn_client_invalid_user_id', util.format('Invalid user ID (%s) for assigning to client', user_id));
        }
        else if (docUser.catenis !== undefined && docUser.catenis.client_id !== undefined) {
            // User already assigned to a client. Log error and throw exception
            Catenis.logger.ERROR('User already assigned to a client', {userId: user_id});
            throw new Meteor.Error('ctn_client_user_already_assigned', util.format('User (Id: %s) already assigned to a client', user_id));
        }

        const updtFields = {user_id: user_id},
            userCanLogin = docUser.services !== undefined && docUser.services.password !== undefined;

        if (userCanLogin) {
            updtFields.status = Client.status.active.name;
            updtFields.lastStatusChangedDate = new Date(Date.now());
        }

        try {
            Catenis.db.collection.Client.update({_id: this.doc_id}, {$set: updtFields});
        }
        catch (err) {
            Catenis.logger.ERROR(util.format('Error trying to update client (doc Id: %s).', this.doc_id), err);
            throw new Meteor.Error('ctn_client_update_error', util.format('Error trying to update client (doc Id: %s)', this.doc_id), err.stack);
        }

        if (userCanLogin) {
            try {
                // Update User doc/rec saving the ID of the client associated with it
                Meteor.users.update({_id: user_id}, {$set: {'catenis.client_id': this.doc_id}});
            }
            catch (err) {
                Catenis.logger.ERROR(util.format('Error updating user (Id: %s) associated with client (clientId: %s).', user_id, this.clientId), err);
                throw new Meteor.Error('ctn_client_update_user_error', util.format('Error updating user (Id: %s) associated with client (clientId: %s).', user_id, this.clientId), err.stack);
            }

            // Update local status
            this.status = Client.status.active.name;
        }

        // Execute code in critical section to avoid UTXOs concurrency
        FundSource.utxoCS.execute(() => {
            // Make sure that system service credit issuance is properly provisioned
            this.ctnNode.checkServiceCreditIssuanceProvision();
        });
    }
    else {
        // Client already has a user assigned to it. Log error
        //  and throw exception
        Catenis.logger.WARN('Trying to assign user to a client that already has a user assigned to it', {client: this});
        throw new Meteor.Error('ctn_client_already_has_user', 'Client already has a user assigned to it');
    }
};

Client.prototype.activate = function () {
    let result = false;

    if (this.status !== Client.status.active.name) {
        if (this.user_id !== undefined) {
            // Check if associated user can log in
            const docUser = Meteor.users.findOne({_id: this.user_id}, {fields: {_id: 1, 'services.password': 1}});

            if (docUser !== undefined && docUser.services !== undefined && docUser.services.password !== undefined) {
                // Activate client
                Catenis.db.collection.Client.update({_id: this.doc_id}, {
                    $set: {
                        status: Client.status.active.name,
                        lastStatusChangedDate: new Date(Date.now())
                    }
                });

                this.active = true;

                // Execute code in critical section to avoid UTXOs concurrency
                FundSource.utxoCS.execute(() => {
                    // Make sure that system service credit issuance is properly provisioned
                    this.ctnNode.checkServiceCreditIssuanceProvision();
                });

                result = true;
            }
        }
    }
    else {
        // Client already active
        Catenis.logger.WARN('Trying to activate client that is already active', {client: this});
        result = true;
    }

    return result;
};

Client.prototype.renewApiAccessGenKey = function (resetAllDevicesToClientDefaultKey = false) {
    // Make sure that client is not deleted
    if (this.status !== Client.status.deleted.name &&
            Catenis.db.collection.Client.findOne({_id: this.doc_id, status: Client.status.deleted.name}, {fields:{_id:1}}) !== undefined) {
        // Client has been deleted. Update its status
        this.status = Client.status.deleted.name;
    }

    if (this.status === Client.status.deleted.name) {
        // Cannot renew default API access generator key for deleted client. Log error and throw exception
        Catenis.logger.ERROR('Cannot renew default API access generator key for deleted client', {clientId: this.clientId});
        throw new Meteor.Error('ctn_client_deleted', util.format('Cannot renew default API access generator key for deleted client (clientId: %s)', this.clientId));
    }

    // Generate new key
    const key = Random.secret();
    const now = new Date(Date.now());

    try {
        Catenis.db.collection.Client.update({_id: this.doc_id}, {$set: {apiAccessGenKey: key, lastApiAccessGenKeyModifiedDate: now}});
    }
    catch (err) {
        Catenis.logger.ERROR('Error updating client default API access generator key', err);
        throw new Meteor.Error('ctn_client_update_error', 'Error updating client default API access generator key', err.stack);
    }

    if (resetAllDevicesToClientDefaultKey) {
        try {
            Catenis.db.collection.Device.update({
                client_id: this.doc_id,
                status: {$ne: Device.status.deleted.name},
                apiAccessGenKey: {$ne: null}
            }, {
                $set: {
                    apiAccessGenKey: null,
                    lastApiAccessGenKeyModifiedDate: now
                }
            }, {multi: true});
        }
        catch (err) {
            Catenis.logger.ERROR('Error resetting client\'s devices to use client default API access generator key', err);
            throw new Meteor.Error('ctn_device_update_error', 'Error resetting client\'s devices to use client default API access generator key', err.stack);
        }
    }

    // Update key locally
    this.apiAccessGenKey = key;
};

Client.prototype.delete = function (deletedDate) {
    if (this.status !== Client.status.deleted.name) {
        deletedDate = deletedDate !== undefined ? deletedDate : new Date(Date.now());

        // Iteratively deletes all devices associated with this client
        Catenis.db.collection.Device.find({
            client_id: this.doc_id,
            status: {$ne: Device.status.deleted.name}
        }, {fields: {'index.deviceId': 1}}).forEach(doc => {
            this.getDeviceByIndex(doc.index.deviceIndex).delete(deletedDate);
        });

        // Retrieve current state of fields that shall be changed
        const docClient = Catenis.db.collection.Client.findOne({_id: this.doc_id}, {fields: {'user_id': 1, status: 1}}),
            delField = {};

        if (docClient.user_id !== undefined) {
            delField.user_id = docClient.user_id;
        }

        delField.status = docClient.status;
        delField.deletedDate = deletedDate;

        try {
            // Update Client doc/rec setting its status to 'deleted'
            Catenis.db.collection.Client.update({_id: this.doc_id}, {
                $set: {
                    status: Client.status.deleted.name,
                    lastStatusChangedDate: deletedDate,
                    _deleted: delField
                }, $unset: {'user_id': ''}
            });
        }
        catch (err) {
            // Error updating Client doc/rec. Log error and throw exception
            Catenis.logger.ERROR(util.format('Error trying to delete client (doc_d: %s).', this.doc_id), err);
            throw new Meteor.Error('ctn_client_update_error', util.format('Error trying to delete client (doc_id: %s)', this.doc_id), err.stack);
        }

        // Update local variables
        this.user_id = undefined;
        this.status = Client.status.deleted.name;
    }
    else {
        // Client already deleted
        Catenis.logger.WARN('Trying to delete client that is already deleted', {client: this});
    }
};

Client.prototype.newBcotPaymentAddress = function () {
    return this.bcotPaymentAddr.newAddressKeys().getAddress();
};

// Returns current balance of client's service account
//
//  Arguments:
//   credFundSource: [Object(CCFundSource)] - (optional) Instance of CCFundSource containing UTXOs associated with client's service account credit addresses
//   debtFundSource: [Object(CCFundSource)] - (optional) Instance of CCFundSource containing UTXOs associated with client's service account debit addresses
//
//  Return:
//   balance: [Number] - Amount, in Catenis service credit lowest unit, corresponding to the current balance
Client.prototype.serviceAccountBalance = function (credFundSource, debtFundSource) {
    const servCredAsset = this.ctnNode.getServiceCreditAsset();

    let balance = 0;

    if (servCredAsset !== undefined) {
        if (credFundSource === undefined) {
            credFundSource = new CCFundSource(servCredAsset.ccAssetId, this.servAccCreditLineAddr.listAddressesInUse(), {unconfUtxoInfo: {}});
        }

        balance = credFundSource.getBalance();

        if (debtFundSource === undefined) {
            debtFundSource = new CCFundSource(servCredAsset.ccAssetId, this.servAccDebitLineAddr.listAddressesInUse(), {unconfUtxoInfo: {}})
        }

        balance -= debtFundSource.getBalance();
    }

    return balance;
};

Client.prototype.getDeviceByIndex = function (deviceIndex, includeDeleted = true) {
    // Retrieve Device doc/rec
    const query = {
        'index.ctnNodeIndex': this.ctnNode.ctnNodeIndex,
        'index.clientIndex': this.clientIndex,
        'index.deviceIndex': deviceIndex
    };

    if (!includeDeleted) {
        query.status = {$ne: Client.status.deleted.name};
    }

    const docDevice = Catenis.db.collection.Device.findOne(query);

    if (docDevice === undefined) {
        // No device available with the given index. Log error and throw exception
        Catenis.logger.ERROR(util.format('Could not find device with given index for this client (clientId: %s)', this.clientId), {deviceIndex: deviceIndex});
        throw new Meteor.Error('ctn_device_not_found', util.format('Could not find device with given index (%s) for this client (clientId: %s)', deviceIndex, this.clientId));
    }

    return new Device(docDevice, this);
};

// Create new device for this client
//
//  Arguments:
//    props: [string] - device name
//           or
//           {
//      name: [string], - (optional)
//      prodUniqueId: [string], - (optional)
//      public: [boolean] - (optional)
//      (any additional property)
//    }
//    ownApiAccessKey: [boolean]
//    initRightsByEvent: [Object] - (optional) Initial rights for newly created device. Object the keys of which should be the defined permission event names.
//                                -  The value for each event name key should be a rights object as defined for the Permission.setRights method
Client.prototype.createDevice = function (props, ownApiAccessKey = false, initRightsByEvent) {
    props = typeof props === 'string' ? {name: props} : (typeof props === 'object' && props !== null ? props : {});

    // Validate (pre-defined) properties
    const errProp = {};

    if ('name' in props && typeof props.name !== 'string') {
        errProp.name = props.name;
    }

    if ('prodUniqueId' in props && typeof props.prodUniqueId !== 'string') {
        errProp.prodUniqueId = props.prodUniqueId;
    }

    if ('public' in props && typeof props.public !== 'boolean') {
        errProp.public = props.public;
    }

    if (Object.keys(errProp).length > 0) {
        const errProps = Object.keys(errProp);

        Catenis.logger.ERROR(util.format('Client.createDevice method called with invalid propert%s', errProps.length > 1 ? 'ies' : 'y'), errProp);
        throw Error(util.format('Invalid %s propert%s', errProps.join(', '), errProps.length > 1 ? 'ies' : 'y'));
    }

    // Make sure that client is not deleted
    if (this.status === Client.status.deleted.name) {
        // Cannot create device for deleted client. Log error and throw exception
        Catenis.logger.ERROR('Cannot create device for a deleted client', {clientId: this.clientId});
        throw new Meteor.Error('ctn_client_deleted', util.format('Cannot create device for a deleted client (clientId: %s)', this.clientId));
    }

    // Make sure that client is active
    if (this.status !== Client.status.active.name) {
        // Cannot create device for inactive client. Log error and throw exception
        Catenis.logger.ERROR('Cannot create device for an inactive client', {clientId: this.clientId});
        throw new Meteor.Error('ctn_client_inactive', util.format('Cannot create device for an inactive client (clientId: %s)', this.clientId));
    }

    let docDevice = undefined;
    let device;

    // Execute code in critical section to avoid DB concurrency
    this.clnDbCS.execute(() => {
        // Get next device index and validate it
        let deviceIndex = this.lastDeviceIndex;

        // Get next good device index
        let deviceId = undefined;

        do {
            if (Catenis.keyStore.initDeviceHDNodes(this.ctnNode.ctnNodeIndex, this.clientIndex, ++deviceIndex)) {
                deviceId = newDeviceId(this.ctnNode.ctnNodeIndex, this.clientIndex, deviceIndex);
            }
        }
        while (!deviceId);

        // Prepare to create new Device doc/rec
        docDevice = {
            client_id: this.doc_id,
            deviceId: deviceId,
            index: {
                ctnNodeIndex: this.ctnNode.ctnNodeIndex,
                clientIndex: this.clientIndex,
                deviceIndex: deviceIndex
            },
            props: props,
            apiAccessGenKey: ownApiAccessKey ? Random.secret() : null,
            status: Device.status.new.name,
            createdDate: new Date(Date.now())
        };

        try {
            // Create new Device doc/rec
            docDevice._id = Catenis.db.collection.Device.insert(docDevice);
        }
        catch (err) {
            if (err.name === 'MongoError' && err.code === 11000 && err.errmsg.search(/index:\s+props\.prodUniqueId/) >= 0) {
                // Duplicate product unique ID error.
                Catenis.logger.ERROR(util.format('Cannot create device; product unique ID (%s) already associated with another device', docDevice.props.prodUniqueId), err);
                throw new Meteor.Error('ctn_device_duplicate_prodUniqueId', util.format('Cannot create device; product unique ID (%s) already associated with another device', docDevice.props.prodUniqueId), err.stack);
            }
            else {
                // Any other error inserting doc/rec
                Catenis.logger.ERROR(util.format('Error trying to create new device for client (clientId: %s).', this.clientId), err);
                throw new Meteor.Error('ctn_device_insert_error', util.format('Error trying to create new device for client (clientId: %s)', this.clientId), err.stack);
            }
        }

        try {
            // Instantiate device and set initial permission rights. If no initial
            //  rights are specified, get the default rights from the client
            device = new Device(docDevice, this);

            device.setInitialRights(initRightsByEvent !== undefined ? initRightsByEvent : device.client.getDeviceDefaultRights());
        }
        catch (err) {
            Catenis.logger.ERROR(util.format('Error setting initial permission rights for newly created device (deviceId: %s).', device.deviceId), err);
            throw new Meteor.Error('ctn_device_init_rights_error', util.format('Error setting initial permission rights for newly created device (deviceId: %s).', device.deviceId), err.stack);
        }

        // Now, adjust last device index
        this.lastDeviceIndex = deviceIndex;
    });

    // If we hit this point, a Device doc (rec) has been successfully created

    try {
        // Fund recently created device
        // noinspection JSUnusedAssignment
        device.fundAddresses();
    }
    catch (err) {
        // Error trying to fund addresses of newly created device. Log error condition
        Catenis.logger.ERROR(util.format('Error trying to fund addresses of newly created device (deviceId: %s).', docDevice.deviceId), err);
    }

    // Now, return device Id
    return docDevice.deviceId;
};

// Update client properties
//
// Arguments:
//  props: [string] - new name of client
//         or
//         [object] - object containing properties that should be updated and their corresponding new values
//                     To delete a property, set it as undefined.
//
Client.prototype.updateProperties = function (newProps) {
    newProps = typeof newProps === 'string' ? {name: newProps} : (typeof newProps === 'object' && newProps !== null ? newProps : {});

    if (Object.keys(newProps).length > 0) {
        // Validate (pre-defined) properties
        const errProp = {};

        // Allow this property to be undefined so it can be deleted
        if ('name' in newProps && (typeof newProps.name !== 'string' && typeof newProps.name !== 'undefined')) {
            errProp.name = newProps.name;
        }

        if (Object.keys(errProp).length > 0) {
            const errProps = Object.keys(errProp);

            Catenis.logger.ERROR(util.format('Client.updateProperties method called with invalid propert%s', errProps.length > 1 ? 'ies' : 'y'), errProp);
            throw Error(util.format('Invalid %s propert%s', errProps.join(', '), errProps.length > 1 ? 'ies' : 'y'));
        }

        // Make sure that client is not deleted
        if (this.status === Client.status.deleted.name) {
            // Cannot update properties of a deleted client. Log error and throw exception
            Catenis.logger.ERROR('Cannot update properties of a deleted client', {clientId: this.clientId});
            throw new Meteor.Error('ctn_client_deleted', util.format('Cannot update date properties of a deleted client (clientId: %s)', this.clientId));
        }

        // Retrieve current client properties
        const currProps = Catenis.db.collection.Client.findOne({_id: this.doc_id}, {fields: {props: 1}}).props;
        let props = _und.clone(currProps);

        // Merge properties to update
        _und.extend(props, newProps);

        // Extract properties that are undefined
        props = _und.omit(props, (value) => {
            return _und.isUndefined(value);
        });

        if (!_und.isEqual(props, currProps)) {
            try {
                // Update Client doc/rec setting the new properties
                Catenis.db.collection.Client.update({_id: this.doc_id}, {$set: {props: props}});
            }
            catch (err) {
                // Error updating Client doc/rec. Log error and throw exception
                Catenis.logger.ERROR(util.format('Error trying to update client properties (doc_id: %s).', this.doc_id), err);
                throw new Meteor.Error('ctn_client_update_error', util.format('Error trying to update client properties (doc_id: %s)', this.doc_id), err.stack);
            }

            // Update properties locally too
            this.props = props;
        }
    }
};

// Get client's basic identification information, including Catenis node's identification information
Client.prototype.getIdentityInfo = function () {
    const idInfo = this.ctnNode.getIdentityInfo();

    idInfo.client = {
        clientId: this.clientId
    };

    if (this.props.name !== undefined) {
        idInfo.client.name = this.props.name;
    }

    return idInfo;
};

/** Permission related methods **/
// Set the default permission rights to use for newly created devices
//
//  Arguments:
//   rightsByEvent: [Object] - Object the keys of which should be the defined permission event names.
//                           -  The value for each event name key should be a rights object as defined for the Permission.setRights method
Client.prototype.setDeviceDefaultRights = function(rightsByEvent) {
    Object.keys(rightsByEvent).forEach((eventName) => {
        if (Permission.isValidEventName(eventName)) {
            Catenis.permission.setRights(eventName, this, Permission.fixRightsReplaceOwnHierarchyEntity(rightsByEvent[eventName], this));
        }
    });
};

// Retrieve the default permission rights to use for newly created devices
//
//  Result:
//   rightsByEvent: [Object] - Object the keys of which should be the defined permission event names.
//                           -  The value for each event name key should be a rights object as defined for the Permission.setRights method
Client.prototype.getDeviceDefaultRights = function() {
    const rightsByEvent = {};

    Object.keys(Permission.listEvents()).forEach((eventName) => {
        rightsByEvent[eventName] = Catenis.permission.getRights(eventName, this);
    });

    return rightsByEvent;
};
/** End of permission related methods **/


// Module functions used to simulate private Client object methods
//  NOTE: these functions need to be bound to a Client object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//


// Client function class (public) methods
//

Client.initialize = function () {
    Catenis.logger.TRACE('Client initialization');
};

Client.getClientByClientId = function (clientId, includeDeleted = true) {
    // Retrieve Client doc/rec
    const query = {
        clientId: clientId
    };

    if (!includeDeleted) {
        query.status = {$ne: Client.status.deleted.name};
    }

    const docClient = Catenis.db.collection.Client.findOne(query);

    if (docClient === undefined) {
        // No client available with the given client ID. Log error and throw exception
        Catenis.logger.ERROR('Could not find client with given client ID', {clientId: clientId});
        throw new Meteor.Error('ctn_client_not_found', util.format('Could not find client with given client ID (%s)', clientId));
    }

    return new Client(docClient, CatenisNode.getCatenisNodeByIndex(docClient.index.ctnNodeIndex));
};

Client.getClientByUserId = function (user_id, includeDeleted = true) {
    // Retrieve Client doc/rec
    const query = {
        user_id: user_id
    };

    if (!includeDeleted) {
        query.status = {$ne: Client.status.deleted.name};
    }

    const docClient = Catenis.db.collection.Client.findOne(query);

    if (docClient === undefined) {
        // No client available associated with given user id. Log error and throw exception
        Catenis.logger.ERROR('Could not find client associated with given user id', {user_id: user_id});
        throw new Meteor.Error('ctn_client_not_found', util.format('Could not find client associated with given user id (%s)', user_id));
    }

    return new Client(docClient, CatenisNode.getCatenisNodeByIndex(docClient.index.ctnNodeIndex));
};

Client.activeClientsCount = function (billingMode) {
    const selector = {
        catenisNode_id: Catenis.ctnHubNode.doc_id,
        status: Client.status.active.name
    };

    if (billingMode !== undefined) {
        selector.billingMode = billingMode
    }

    return Catenis.db.collection.Client.find(selector).count();
};

Client.activePrePaidClientsCount = function () {
    return Client.activeClientsCount(Client.billingMode.prePaid);
};

Client.activePostPaidClientsCount = function () {
    return Client.activeClientsCount(Client.billingMode.postPaid);
};

Client.allActiveClientIndices = function (billingMode) {
    const selector = {
        catenisNode_id: Catenis.ctnHubNode.doc_id,
        status: Client.status.active.name
    };

    if (billingMode !== undefined) {
        selector.billingMode = billingMode
    }

    return Catenis.db.collection.Client.find(selector, {fields: {_id: 0, index: 1}}).map((doc) => doc.index);
};

Client.allActivePrePaidClientIndices = function () {
    return Client.allActiveClientIndices(Client.billingMode.prePaid);
};

Client.allActivePostPaidClientIndices = function () {
    return Client.allActiveClientIndices(Client.billingMode.postPaid);
};

// Returns total balance of all pre-paid client's service account credit line
//
//  Return:
//   balance: [Number] - Amount, in Catenis service credit lowest unit, corresponding to the current balance
Client.allPrePaidClientsServiceAccountCreditLineBalance = function () {
    let balance = 0;
    const servCredAsset = Catenis.ctnHubNode.getServiceCreditAsset();

    if (servCredAsset !== undefined) {
        balance = new CCFundSource(servCredAsset.ccAssetId, Catenis.keyStore.listAllClientServiceAccountCreditLineAddressesInUse(Client.allActivePrePaidClientIndices()), {unconfUtxoInfo: {}}).getBalance();
    }

    return balance;
};

// Check if a given client exists
//
//  Argument:
//   clientId [String] - Client ID of client to check existence
//   selfReferenceAccepted [Boolean] - Indicate whether 'self' token should be accepted for client ID
//   wildcardAccepted [Boolean] - Indicate whether wildcard ('*') should be accepted for client ID
//   includeDeleted [Boolean] - Indicate whether deleted clients should also be included in the check
//
//  Result:
//   [Boolean] - Indicates whether the client being checked exists or not
Client.checkExist = function (clientId, selfReferenceAccepted = false, wildcardAccepted = false, includeDeleted = false) {
    if ((selfReferenceAccepted && clientId === Permission.entityToken.ownHierarchy) || (wildcardAccepted && clientId === Permission.entityToken.wildcard)) {
        return true;
    }
    else {
        if (clientId === undefined) {
            return false;
        }

        const selector = {
            clientId: clientId
        };

        if (!includeDeleted) {
            selector.status = {
                $ne: Client.status.deleted.name
            }
        }

        const docClient = Catenis.db.collection.Client.findOne(selector, {fields: {_id: 1}});

        return docClient !== undefined;
    }
};

// Check if one or more clients exist
//
//  Argument:
//   clientIds [Array(String)|String] - List of client IDs (or a single client ID) of clients to check existence
//   selfReferenceAccepted [Boolean] - Indicate whether 'self' token should be accepted for client ID
//   wildcardAccepted [Boolean] - Indicate whether wildcard ('*') should be accepted for client ID
//   includeDeleted [Boolean] - Indicate whether deleted clients should also be included in the check
//
//  Result:
//   result: {
//     doExist: [Boolean] - Indicates whether all clients being checked exist or not
//     nonexistentClientIds: [Array(String)] - List of client IDs of clients, from the ones that were being checked, that do not exist
//   }
Client.checkExistMany = function (clientIds, selfReferenceAccepted = false, wildcardAccepted = false, includeDeleted = false) {
    const result = {};

    if (Array.isArray(clientIds)) {
        if (clientIds.length === 0) {
            return {
                doExist: false
            };
        }

        if (selfReferenceAccepted || wildcardAccepted) {
            // Filter out self reference and/or wildcard ID
            clientIds = clientIds.filter((clientId) => (!selfReferenceAccepted || clientId !== Permission.entityToken.ownHierarchy) && (!wildcardAccepted || clientId !== Permission.entityToken.wildcard));

            if (clientIds.length === 0) {
                return {
                    doExist: true
                }
            }
        }

        const selector = {
            clientId: {
                $in: clientIds
            }
        };

        if (!includeDeleted) {
            selector.status = {
                $ne: Client.status.deleted.name
            };
        }

        const resultSet = Catenis.db.collection.Client.find(selector, {
            fields: {
                clientId: 1
            }
        });

        if (resultSet.count() !== clientIds.length) {
            // Not all IDs returned. Indicated that not all exist and identify the ones that do not
            result.doExist = false;
            result.nonexistentClientIds = [];
            const existingClientIds = new Set(resultSet.fetch().map(doc => doc.clientId));

            clientIds.forEach((clientId) => {
                if (!existingClientIds.has(clientId)) {
                    result.nonexistentClientIds.push(clientId);
                }
            });
        }
        else {
            // Found all indices. Indicate that all exist
            result.doExist = true;
        }
    }
    else {
        // A single client ID had been passed to be checked
        result.doExist = Client.checkExist(clientIds, selfReferenceAccepted, wildcardAccepted, includeDeleted);

        if (!result.doExist) {
            result.nonexistentClientIds = [clientIds];
        }
    }

    return result;
};

// Make sure that device default permission rights are set for all clients and permission events
Client.checkDeviceDefaultRights = function () {
    // Retrieve client ID of all currently defined clients
    const clientIds = Catenis.db.collection.Client.find({
        status: {$ne: Client.status.deleted.name}
    }, {
        fields: {
            clientId: 1
        }
    }).map((doc) => doc.clientId);

    // Identity clients for which device default rights are already set for at least some permission events
    const alreadySetClientIdEvents = new Map();

    Catenis.db.collection.Permission.find({
        subjectEntityId: {
            $in: clientIds
        },
        level: Permission.level.system.name
    }, {
        fields: {
            subjectEntityId: 1,
            event: 1
        }
    }).forEach((doc) => {
        if (!alreadySetClientIdEvents.has(doc.subjectEntityId)) {
            alreadySetClientIdEvents.set(doc.subjectEntityId, new Set([doc.event]));
        }
        else {
            alreadySetClientIdEvents.get(doc.subjectEntityId).add(doc.event);
        }
    });

    // For all existing clients, check if there are any permission event for which
    //  device default rights setting is missing, and fix it
    const numEventsDeviceDefaultRights = Object.keys(cfgSettings.deviceDefaultRightsByEvent).length;

    clientIds.forEach((clientId) => {
        let alreadySetEvents;

        if (!alreadySetClientIdEvents.has(clientId) || (alreadySetEvents = alreadySetClientIdEvents.get(clientId)).size < numEventsDeviceDefaultRights) {
            // Prepare device default rights containing only the events that are missing...
            const deviceDefaultRightsByEvent = _und.omit(cfgSettings.deviceDefaultRightsByEvent, (rights, event) => alreadySetEvents !== undefined && alreadySetEvents.has(event));

            // And set them
            Catenis.logger.DEBUG('Setting device default permission rights for client', {
                clientId: clientId,
                rightsByEvent: deviceDefaultRightsByEvent
            });
            Client.getClientByClientId(clientId).setDeviceDefaultRights(deviceDefaultRightsByEvent);
        }
    });
};


// Client function class (public) properties
//

Client.clientCtrl = {};

Client.status = Object.freeze({
    new: Object.freeze({
        name: 'new',
        description: 'Newly created client awaiting activation'
    }),
    active: Object.freeze({
        name: 'active',
        description: 'Client is in its normal use mode'
    }),
    deleted: Object.freeze({
        name: 'deleted',
        description: 'Client has been logically deleted'
    })
});

Client.billingMode = Object.freeze({
    prePaid: 'pre-paid',
    postPaid: 'post-paid'
});


// Definition of module (private) functions
//

// Create new device ID dependent on Catenis node index, client index and device index
function newDeviceId(ctnNodeIndex, clientIndex, deviceIndex) {
    let id = 'd' + Random.createWithSeeds(Array.from(Catenis.application.seed.toString() + ':ctnNodeIndex:' + ctnNodeIndex + ',clientIndex:' + clientIndex + ',deviceIndex:' + deviceIndex)).id(19);
    let doc;

    if ((doc = Catenis.db.collection.Device.findOne({deviceId: id}, {fields:{_id: 1, index: 1}}))) {
        // New device ID is already in use. Log warning condition and reset ID
        Catenis.logger.WARN(util.format('Device ID for Catenis node index %d, client index %d and device index %d is already in use', ctnNodeIndex, clientIndex, deviceIndex), {existingDeviceDoc: doc});
        id = undefined;
    }

    return id;
}


// Module code
//

// Lock function class
Object.freeze(Client);
