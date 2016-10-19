/**
 * Created by claudio on 22/06/16.
 */

//console.log('[Client.js]: This code just ran.');

// Module variables
//

// References to external modules
var util = Npm.require('util');
var crypto = Npm.require('crypto');
//var config = Npm.require('config');

import {CriticalSection} from './CriticalSection.js'

/*// Config entries
var config_entryConfig = config.get('config_entry');

// Configuration settings
var cfgSettings = {
    property: config_entryConfig.get('property_name')
};*/

// Critical section object to avoid concurrent access to database at the
//  module level (when creating new clients basically)
var dbCS = new CriticalSection();


// Definition of function classes
//

// Client function class
function Client(docClient, initializeDevices) {
    // Save relevant info from Client doc/rec
    this.doc_id = docClient._id;
    this.user_id = docClient.user_id;
    this.catenisNode_id = docClient.catenisNode_id;
    this.clientId = docClient.clientId;
    this.clientIndex = docClient.clientIndex;
    this.apiAccessGenKey = docClient.apiAccessGenKey;
    this.status = docClient.status;

    Object.defineProperty(this, 'apiAccessSecret', {
        get: function () {
            return crypto.createHmac('sha512', docClient.apiAccessGenKey).update('And here it is: the Catenis API key for client' + docClient.clientId).digest('hex');
        }
    });

    // Instantiate objects to manage blockchain addresses for client
    this.messageCreditAddr = Catenis.module.BlockchainAddress.ClientMessageCreditAddress.getInstance(this.clientIndex);
    this.assetCreditAddr = Catenis.module.BlockchainAddress.ClientAssetCreditAddress.getInstance(this.clientIndex);

    // Retrieve (HD node) index of last Device doc/rec created for this client
    var docDevice = Catenis.db.collection.Device.findOne({client_id: this.doc_id}, {fields: {'index.deviceIndex': 1}, sort: {'index.deviceIndex': -1}});

    this.lastDeviceIndex = docDevice != undefined ? docDevice.index.deviceIndex : 0;

    // Critical section object to avoid concurrent access to database at the
    //  client object level (when creating new devices for this client and
    //  handling service credits basically)
    this.clnDbCS = new CriticalSection();

    if (initializeDevices) {
        // Instantiate all (non-deleted) devices associated with this client so their
        //  associated addresses are loaded onto local key storage
        Catenis.db.collection.Device.find({client_id: this.doc_id, status: {$ne: 'deleted'}}).forEach(function (doc) {
            // Instantiate Device object
            new Device(this, doc);
        });
    }
}


// Public Client object methods
//

Client.prototype.assignUser = function (user_id) {
    // Make sure that there is no user currently assigned to this client
    if (this.user_id == undefined) {
        // Make sure that user ID is valid
        var docUser = Meteor.users.findOne({_id: user_id}, {fields: {_id: 1, 'services.password': 1, 'profile.client_id': 1}});

        if (docUser == undefined) {
            // ID passed is not from a valid user. Log error and throw exception
            Catenis.logger.ERROR('Invalid user ID for assigning to client', {userId: user_id});
            throw new Meteor.Error('ctn_client_invalid_user_id', util.format('Invalid user ID (%s) for assigning to client', user_id));
        }
        else if (docUser.profile != undefined && docUser.profile.client_id != undefined) {
            // User already assigned to a client. Log error and throw exception
            Catenis.logger.ERROR('User already assigned to a client', {userId: user_id});
            throw new Meteor.Error('ctn_client_user_already_assigned', util.format('User (Id: %s) already assigned to a client', user_id));
        }

        var updtFields = {user_id: user_id},
            userCanLogin = docUser.services != undefined && docUser.services.password != undefined;

        if (userCanLogin) {
            updtFields.status = 'active';
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
                Meteor.users.update({_id: user_id}, {$set: {'profile.client_id': this.doc_id}});
            }
            catch (err) {
                Catenis.logger.ERROR(util.format('Error updating user (Id: %s) associated with client (doc Id: %s).', user_id, this.doc_id), err);
                throw new Meteor.Error('ctn_client_update_user_error', util.format('Error updating user (Id: %s) associated with client (doc Id: %s).', user_id, this.doc_id), err.stack);
            }

            // Update local status
            this.status = 'active';
        }
    }
    else {
        // Client already has a user assigned to it. Log error
        //  and throw exception
        Catenis.logger.WARN('Trying to assign user to a client that already has a user assigned to it', {client: this});
        throw new Meteor.Error('ctn_client_already_has_user', 'Client already has a user assigned to it');
    }
};

Client.prototype.activate = function () {
    var result = false;

    if (!this.active) {
        if (this.user_id != undefined) {
            // Check if associated user can log in
            var docUser = Meteor.users.findOne({_id: this.user_id}, {fields: {_id: 1, 'services.password': 1}});

            if (docUser != undefined && docUser.services != undefined && docUser.services.password != undefined) {
                // Activate client
                Catenis.db.collection.Client.update({_id: this.doc_id}, {$set: {status: 'active', lastStatusChangedDate: new Date(Date.now())}});

                this.active = true;
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

Client.prototype.renewApiAccessGenKey = function () {
    // Generate new key
    var key = Random.secret();

    try {
        Catenis.db.collection.Client.update({_id: this.doc_id}, {$set: {'apiAccessGenKey': key, 'lastApiAccessGenKeyModifiedDate': new Date(Date.now())}});
    }
    catch (err) {
        Catenis.logger.ERROR('Error updating client default API access generator key', err);
        throw new Meteor.Error('ctn_client_update_error', 'Error updating client default API access generator key', err.stack);
    }

    // Update key locally
    this.apiAccessGenKey = key;
};

Client.prototype.delete = function () {
    if (this.status !== 'deleted') {
        // Retrieve all devices of this client and delete them all
        var deletedDate = new Date(Date.now());

        Catenis.db.collection.Device.find({client_id: this.doc_id}, {fields: {'props.prodUniqueId': 1, status: 1}}).forEach(function (docDevice) {
            if (docDevice.status != 'deleted') {
                let delField = {};

                if (docDevice.props != undefined && docDevice.props.prodUniqueId != undefined) {
                    delField.prodUniqueId = docDevice.props.prodUniqueId;
                }

                delField.status = docDevice.status;
                delField.deletedDate = deletedDate;

                // Update Device doc/rec
                Catenis.db.collection.Device.update({_id: docDevice._id}, {$set: {status: 'deleted', _deleted: delField}, $unset: {'props.prodUniqueId': ''}});
            }
        });

        // Retrieve current state of fields that shall be changed
        var docClient = Catenis.db.collection.Client.findOne({_id: this.doc_id}, {fields: {'user_id': 1, status: 1}}),
            delField = {};

        if (docClient.user_id != undefined) {
            del.user_id = docClient.user_id;
        }

        delField.status = docClient.status;
        delField.deletedDate = deletedDate;

        // Update Client doc/rec
        Catenis.db.collection.Client.update({_id: this.doc_id}, {$set: {status: 'deleted', _deleted: delField}, $unset: {'user_id': ''}});

        // Update local variables
        this.user_id = undefined;
        this.status = 'deleted';
    }
    else {
        // Client already deleted
        Catenis.logger.WARN('Trying to delete client that is already deleted', {client: this});
    }
};

Client.prototype.addServiceCredit = function (srvCreditType, count) {
    // Validate arguments
    var errArg = {};

    if (!isValidServiceCreditType(srvCreditType)) {
        errArg.srvCreditType = srvCreditType;
    }

    if (!isValidServiceCreditCount(count)) {
        errArg.count = count;
    }

    if (Object.keys(errArg).length > 0) {
        var errArgs = Object.keys(errArg);

        Catenis.logger.ERROR(util.format('Client.addServiceCredit method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw new Meteor.Error('ctn_client_add_srv_credit_inv_args', util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    // TODO: determine number of client service credit addresses to use (based on count), allocate those new service credit addresses, create and send transaction to fund them, and to fund pay tx expense too

    try {
        // Record new service credit add transaction to database
        Catenis.db.collection.ServiceCredit.insert({
            client_id: this.doc_id,
            srvCreditType: srvCreditType,
            initCredits: count,
            remainCredits: count,
            createdDate: new Date(Date.now())
        });
    }
    catch (err) {
        Catenis.logger.ERROR('Error trying to insert ServiceCredit doc/rec.', err);
        throw new Meteor.Error('ctn_client_add_srv_credit_insert_error', 'Error trying to insert ServiceCredit doc/rec', err.stack);
    }

    // Adjust total service credits
    Catenis.adjustTotalCredits(srvCreditType, count);
};

Client.prototype.addMessageCredit = function (count) {
    return this.addServiceCredit(Client.serviceCreditType.message, count);
};

Client.prototype.addAssetCredit = function (count) {
    return this.addServiceCredit(Client.serviceCreditType.asset, count);
};

Client.prototype.spendServiceCredit = function (srvCreditType, count) {
    // Validate arguments
    var errArg = {};

    if (!isValidServiceCreditType(srvCreditType)) {
        errArg.srvCreditType = srvCreditType;
    }

    if (!isValidServiceCreditCount(count)) {
        errArg.count = count;
    }

    if (Object.keys(errArg).length > 0) {
        var errArgs = Object.keys(errArg);

        Catenis.logger.ERROR(util.format('Client.spendServiceCredit method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Meteor.Error('ctn_client_spend_srv_credit_inv_args', util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    // Execute code in critical section to avoid DB concurrency
    this.clnDbCS.execute(() => {
        var srvCreditIdsToZero = [],
            docSrvCreditsToUpdate,
            remainCount = count;

        Catenis.db.collection.ServiceCredit.find({client_id: this.doc_id, srvCreditType: srvCreditType, remainCredits: {$gt: 0}}, {fields: {_id: 1, remainCredits: 1}, sort: {createdDate: 1}}).fetch().some(function (doc) {
            if (doc.remainCredits <= remainCount) {
                srvCreditIdsToZero.push(doc._id);
                remainCount -= doc.remainCredits;
            }
            else {
                doc.remainCredits -= remainCount;
                docSrvCreditsToUpdate = doc;
                remainCount = 0;
            }

            return remainCount == 0;
        });

        var updateDate = new Date(Date.now());

        if (srvCreditIdsToZero.length > 0) {
            try {
                Catenis.db.collection.ServiceCredit.update({_id: {$in: srvCreditIdsToZero}}, {$set: {remainCredits: 0, latestCreditUpdatedDate: updateDate}}, {multi: true});
            }
            catch (err) {
                Catenis.logger.ERROR('Error trying to set remaining credits of ServiceCredit docs/recs to zero.', err);
                throw new Meteor.Error('ctn_client_add_srv_credit_update_error', 'Error trying to set remaining credits of ServiceCredit docs/recs to zero', err.stack);
            }
        }

        if (docSrvCreditsToUpdate != undefined) {
            try {
                Catenis.db.collection.ServiceCredit.update({_id: docSrvCreditsToUpdate._id}, {$set: {remainCredits: docSrvCreditsToUpdate.remainCredits, latestCreditUpdatedDate: updateDate}})
            }
            catch (err) {
                Catenis.logger.ERROR('Error trying to update remaining credits of ServiceCredit docs/recs.', err);
                throw new Meteor.Error('ctn_client_add_srv_credit_update_error', 'Error trying to update remaining credits of ServiceCredit docs/recs', err.stack);
            }
        }

        if (remainCount > 0) {
            // Not all credits have been deleted. There were not enough remaining credits
            Catenis.logger.WARN('Not all credits have been deleted; there were not enough remaining credits', {creditsToDelete: count, previouslyRemainCredits: count - remainCount});
        }

        // Adjust total service credits
        Catenis.adjustTotalCredits(srvCreditType, - (count - remainCount));
    });
};

Client.prototype.spendMessageCredit = function (count) {
    return this.spendServiceCredit(Client.serviceCreditType.message, count);
};

Client.prototype.spendAssetCredit = function (count) {
    return this.spendServiceCredit(Client.serviceCreditType.asset, count);
};

Client.prototype.availableServiceCredits = function (srvCreditType) {
    return Catenis.db.collection.ServiceCredit.find({client_id: this.doc_id, srvCreditType: srvCreditType, remainCredits: {$gt: 0}}, {fields: {_id: 1, remainCredits: 1}}).fetch().reduce(function (sum, doc) {
        return sum + doc.remainCredits;
    }, 0);
};

Client.prototype.availableMessageCredits = function () {
    return this.availableServiceCredits(Client.serviceCreditType.message);
};

Client.prototype.availableAssetCredits = function () {
    return this.availableServiceCredits(Client.serviceCreditType.asset);
};

// Create new device for this client
//
//  Arguments:
//    props: [string] - device name
//           or
//           {
//      name: [string], - (optional)
//      productId: [string], - (optional)
//      (any additional property)
//    }
//    ownApiAccessKey: [boolean]
//
Client.prototype.createDevice = function (props, ownApiAccessKey = false) {
    var docDevice;

    // Execute code in critical section to avoid DB concurrency
    this.clnDbCS.execute(() => {
        // Get next device index and validate it
        var deviceIndex = this.lastDeviceIndex;

        //noinspection StatementWithEmptyBodyJS
        while (!Catenis.keyStore.initDeviceHDNodes(this.clientIndex, ++deviceIndex));

        // Prepare to create new Device doc/rec
        docDevice = {
            client_id: this.doc_id,
            deviceId: newDeviceId(),
            index: {
                clientIndex: this.clientIndex,
                deviceIndex: deviceIndex
            },
            props: typeof props === 'object' ? props : (typeof props === 'string' ? {name: props} : {}),
            apiAccessGenKey: ownApiAccessKey ? Random.secret() : null,
            status: 'new',
            createdDate: new Date(Date.now())
        };

        try {
            // Create new Device doc/rec
            Catenis.db.collection.Device.insert(docDevice);
        }
        catch (err) {
            Catenis.logger.ERROR(util.format('Error trying to create new device for client (doc Id: %s).', this.doc_id), err);
            throw new Meteor.Error('ctn_client_device_insert_error', util.format('Error trying to create new device for client (doc Id: %s)', this.doc_id), err.stack);
        }

        // Now, adjust last device index
        this.lastDeviceIndex = deviceIndex;

        // TODO: transfer funds to device main addresses, and asset issuance address
    });

    //noinspection JSUnusedAssignment
    return docDevice.deviceId;
};


// Module functions used to simulate private Client object methods
//  NOTE: these functions need to be bound to a Client object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// Client function class (public) methods
//

Client.initialize = function () {
    // Retrieve (HD node) index of last created Client doc/rec
    var docClient = Catenis.db.collection.Client.findOne({}, {fields: {clientIndex: 1}, sort: {clientIndex: -1}});

    Client.clientCtrl.lastClientIndex = docClient != undefined ? docClient.clientIndex : 0;

    // Instantiate all (non-deleted) clients so their associated addresses are
    //  loaded onto local key storage
    Catenis.db.collection.Client.find({status: {$ne: 'deleted'}}).forEach(function (doc) {
        // Instantiate Client object making sure that associated devices are also initialized
        new Client(doc, true);
    });

    // Get total number of client credits
    Client.clientCtrl.totalCredits = {};

    Client.clientCtrl.totalCredits[Client.serviceCreditType.message] = Catenis.db.collection.ServiceCredit.find({srvCreditType: Client.serviceCreditType.message, remainCredits: {$gt: 0}}, {fields: {_id: 1, remainCredits: 1}})
        .fetch().reduce(function (sum, doc) {
            return sum + doc.remainCredits;
    }, 0);

    Client.clientCtrl.totalCredits[Client.serviceCreditType.asset] = Catenis.db.collection.ServiceCredit.find({srvCreditType: Client.serviceCreditType.asset, remainCredits: {$gt: 0}}, {fields: {_id: 1, remainCredits: 1}})
        .fetch().reduce(function (sum, doc) {
            return sum + doc.remainCredits;
    }, 0);

    Object.defineProperty(Client.clientCtrl.totalCredits, 'all', {
        get: function () {
            return Object.keys(Client.clientCtrl.totalCredits).reduce(function (sum, key) {
                return key !== 'all' ? sum + Client.clientCtrl.totalCredits[key] : sum;
            }, 0);
        },
        enumerable: true
    });
};

Client.adjustTotalCredits = function (srvCreditType, count) {
    Client.clientCtrl.totalCredits[srvCreditType] += count;

    // Make sure that total is not negative
    if (Client.clientCtrl.totalCredits[srvCreditType] < 0) {
        Client.clientCtrl.totalCredits[srvCreditType] = 0;
    }
};

// Create new client
//
//  Arguments:
//    props: [string] - device name
//           or
//           {
//      name: [string] - (optional)
//      (any additional property)
//    }
//    user_id: [string] - (optional)
//
Client.createClient = function (props, user_id) {
    if (user_id != undefined) {
        // Make sure that user ID is valid
        var docUser = Meteor.users.findOne({_id: user_id}, {fields: {_id: 1, 'services.password': 1, 'profile.client_id': 1}});

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

    var docClient;

    // Execute code in critical section to avoid DB concurrency
    dbCS.execute(() => {
        // Get next client index and validate it
        var clientIndex = Client.clientCtrl.lastClientIndex;

        //noinspection StatementWithEmptyBodyJS
        while (!Catenis.keyStore.initClientHDNodes(++clientIndex));

        // Prepare to create Client doc/rec
        docClient = {
            catenisNode_id: Catenis.db.collection.CatenisNode.findOne({type: 'hub'}, {fields: {_id: 1}})._id,
            clientId: newClientId(),
            clientIndex: clientIndex,
            props: typeof props === 'object' ? props : (typeof props === 'string' ? {name: props} : {}),
            apiAccessGenKey: Random.secret(),
            status: user_id != undefined && docUser.services != undefined && docUser.services.password != undefined ? 'active' : 'new',
            createdDate: new Date(Date.now())
        };

        if (user_id != undefined) {
            docClient.user_id = user_id;
        }

        try {
            // Create new Client doc/rec
            var client_id = Catenis.db.collection.Client.insert(docClient);
        }
        catch (err) {
            Catenis.logger.ERROR('Error trying to create new client.', err);
            throw new Meteor.Error('ctn_client_insert_error', 'Error trying to create new client', err.stack);
        }

        if (user_id != undefined) {
            try {
                // Update User doc/rec saving the ID of the client associated with it
                Meteor.users.update({_id: user_id}, {$set: {'profile.client_id': client_id}});
            }
            catch (err) {
                Catenis.logger.ERROR(util.format('Error updating user (Id: %s) associated with new client (doc Id: %s).', user_id, client_id), err);
                throw new Meteor.Error('ctn_client_update_user_error', util.format('Error updating user (Id: %s) associated with new client (doc Id: %s).', user_id, client_id), err.stack);
            }
        }

        // Now, adjust last client index
        Client.clientCtrl.lastClientIndex = clientIndex;
    });

    //noinspection JSUnusedAssignment
    return docClient.clientId;
};

Client.getClientByClientId = function (clientId) {
    // Retrieve Client doc/rec
    var docClient = Catenis.db.collection.Client.findOne({clientId: clientId, status: {$ne: 'deleted'}});

    if (docClient == undefined) {
        // No client available with the given client ID. Log error and throw exception
        Catenis.logger.ERROR('Could not find client with given client ID', {clientId: clientId});
        throw new Meteor.Error('ctn_client_not_found', util.format('Could not find client with given client ID (%s)', clientId));
    }

    return new Client(docClient);
};

Client.getClientByClientIndex = function (clientIndex) {
    // Retrieve Client doc/rec
    var docClient = Catenis.db.collection.Client.findOne({clientIndex: clientIndex, status: {$ne: 'deleted'}});

    if (docClient == undefined) {
        // No client available with the given client index. Log error and throw exception
        Catenis.logger.ERROR('Could not find client with given client index', {clientIndex: clientIndex});
        throw new Meteor.Error('ctn_client_not_found', util.format('Could not find client with given client index (%s)', clientIndex));
    }

    return new Client(docClient);
};

Client.getClientByUserId = function (user_id) {
    // Retrieve Client doc/rec
    var docClient = Catenis.db.collection.Client.findOne({user_id: user_id, status: {$ne: 'deleted'}});

    if (docClient == undefined) {
        // No client available associated with given user id. Log error and throw exception
        Catenis.logger.ERROR('Could not find client associated with given user id', {user_id: user_id});
        throw new Meteor.Error('ctn_client_not_found', util.format('Could not find client associated with given user id (%s)', user_id));
    }

    return new Client(docClient);
};


// Client function class (public) properties
//

Client.clientCtrl = {};

Client.serviceCreditType = Object.freeze({
    message: 'message',
    asset: 'asset'
});

// Definition of module (private) functions
//

function newClientId() {
    return 'c' + Random.id(19);
}

function newDeviceId() {
    return 'd' + Random.id(19);
}

function isValidServiceCreditType(type) {
    return Object.keys(Client.serviceCreditType).some(function (key) {
        return Client.serviceCreditType[key] === type;
    });
}

function isValidServiceCreditCount(count) {
    return typeof count === 'number' && Number.isInteger(count) && count > 0;
}


// Module code
//

Object.defineProperty(Client, 'totalRemainingCredits', {
    get: function () {
        return Catenis.db.collection.ServiceCredit.find({remainCredits: {$gt: 0}}, {fields: {remainCredits: 1}}).fetch().reduce(function (sum, doc) {
            return sum + doc.remainCredits;
        }, 0);
    }
});

// Save module function class reference
if (typeof Catenis === 'undefined')
    Catenis = {};

if (typeof Catenis.module === 'undefined')
    Catenis.module = {};

Catenis.module.Client = Object.freeze(Client);
