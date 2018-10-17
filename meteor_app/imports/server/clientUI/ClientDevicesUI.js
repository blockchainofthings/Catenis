/**
 * Created by claudio on 2018-10-12.
 */

//console.log('[ClientDevicesUI.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
//import config from 'config';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from '../Catenis';
import { Client } from '../Client';
import { CommonDevicesUI } from '../commonUI/CommonDevicesUI';
import { Billing } from '../Billing';


// Definition of function classes
//

// ClientDevicesUI function class
export function ClientDevicesUI() {
}


// Public ClientDevicesUI object methods
//

/*ClientDevicesUI.prototype.pub_func = function () {
};*/


// Module functions used to simulate private ClientDevicesUI object methods
//  NOTE: these functions need to be bound to a ClientDevicesUI object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// ClientDevicesUI function class (public) methods
//

ClientDevicesUI.initialize = function () {
    Catenis.logger.TRACE('ClientDevicesUI initialization');
    // Declaration of RPC methods to be called from client
    Meteor.methods({
        getCurrentClientDeviceApiAccessSecret: function (deviceIndex) {
            if (Roles.userIsInRole(this.userId, 'ctn-client')) {
                // Retrieve database doc/rec of client associated with currently logged in user
                const docCurrentClient = Catenis.db.collection.Client.findOne({
                    user_id: this.userId,
                    status: Client.status.active.name
                }, {
                    fields: {
                        _id: 1
                    }
                });

                if (docCurrentClient) {
                    try {
                        return Client.getClientByDocId(docCurrentClient._id).getDeviceByIndex(deviceIndex).apiAccessSecret;
                    }
                    catch (err) {
                        // Error trying to get current client's device's API access secret. Log error and throw exception
                        //  WARNING: internal error should NOT be disclosed to client
                        Catenis.logger.ERROR('Failure trying to get current client\'s (doc_id: %s) device\'s (deviceIndex: %s) API access secret.', docCurrentClient._id, deviceIndex, err);
                        throw new Meteor.Error('client.getCurrentClientDeviceApiAccessSecret.failure', 'Failure trying to get current client\'s device\'s API access secret');
                    }
                }
                else {
                    // No active client is associated with currently logged in user.
                    //  Throw exception
                    Catenis.logger.ERROR('getCurrentClientApiAccessSecret remote method: logged in user not associated with a valid, active client', {
                        user_id: this.userId
                    });
                    throw new Meteor.Error('ctn_client_not_valid', 'Logged in user not associated with a valid client');
                }
            }
            else {
                // User not logged in or not a Catenis client.
                //  Throw exception
                throw new Meteor.Error('ctn_client_no_permission', 'No permission; must be logged in as a Catenis client to perform this task');
            }
        },
        resetCurrentClientDeviceApiAccessSecret: function (deviceIndex, resetToClientDefault) {
            if (Roles.userIsInRole(this.userId, 'ctn-client')) {
                // Retrieve database doc/rec of client associated with currently logged in user
                const docCurrentClient = Catenis.db.collection.Client.findOne({
                    user_id: this.userId,
                    status: Client.status.active.name
                }, {
                    fields: {
                        _id: 1
                    }
                });

                if (docCurrentClient) {
                    try {
                        return Client.getClientByDocId(docCurrentClient._id).getDeviceByIndex(deviceIndex).renewApiAccessGenKey(resetToClientDefault);
                    }
                    catch (err) {
                        // Error trying to reset current client's device's API access secret. Log error and throw exception
                        //  WARNING: internal error should NOT be disclosed to client
                        Catenis.logger.ERROR('Failure trying to renew current client\'s (doc_id: %s) device\'s (deviceIndex: %s) API access secret.', docCurrentClient._id, deviceIndex, err);
                        throw new Meteor.Error('client.resetCurrentClientDeviceApiAccessSecret.failure', 'Failure trying to renew current client\'s device\'s API access secret');
                    }
                }
                else {
                    // No active client is associated with currently logged in user.
                    //  Throw exception
                    Catenis.logger.ERROR('resetCurrentClientDeviceApiAccessSecret remote method: logged in user not associated with a valid, active client', {
                        user_id: this.userId
                    });
                    throw new Meteor.Error('ctn_client_not_valid', 'Logged in user not associated with a valid client');
                }
            }
            else {
                // User not logged in or not a Catenis client.
                //  Throw exception
                throw new Meteor.Error('ctn_client_no_permission', 'No permission; must be logged in as a Catenis client to perform this task');
            }
        },
        createCurrentClientNewDevice: function (deviceInfo) {
            if (Roles.userIsInRole(this.userId, 'ctn-client')) {
                // Retrieve database doc/rec of client associated with currently logged in user
                const docCurrentClient = Catenis.db.collection.Client.findOne({
                    user_id: this.userId,
                    status: Client.status.active.name
                }, {
                    fields: {
                        _id: 1
                    }
                });

                if (docCurrentClient) {
                    try {
                        const props = {};

                        if (deviceInfo.name) {
                            props.name = deviceInfo.name;
                        }

                        if (deviceInfo.prodUniqueId) {
                            props.prodUniqueId = deviceInfo.prodUniqueId;
                        }

                        props.public = deviceInfo.public;

                        return Client.getClientByDocId(docCurrentClient._id).createDevice(props, !deviceInfo.assignClientAPIAccessSecret);
                    }
                    catch (err) {
                        // Error trying to create new device for current client. Log error and throw exception
                        //  Note: exceptionally, for this method, we return the internal error so the end user has
                        //      has some information about invalid data that might have been entered
                        Catenis.logger.ERROR('Failure trying to create new device for current client (doc_id: %s).', docCurrentClient._id, err);
                        throw new Meteor.Error('client.createCurrentClientNewDevice.failure', 'Failure trying to create new device for current client: ' + err.toString());
                    }
                }
                else {
                    // No active client is associated with currently logged in user.
                    //  Throw exception
                    Catenis.logger.ERROR('createCurrentClientNewDevice remote method: logged in user not associated with a valid, active client', {
                        user_id: this.userId
                    });
                    throw new Meteor.Error('ctn_client_not_valid', 'Logged in user not associated with a valid client');
                }
            }
            else {
                // User not logged in or not a Catenis client.
                //  Throw exception
                throw new Meteor.Error('ctn_client_no_permission', 'No permission; must be logged in as a Catenis client to perform this task');
            }
        },
        updateCurrentClientDevice: function (deviceIndex, deviceInfo) {
            if (Roles.userIsInRole(this.userId, 'ctn-client')) {
                // Retrieve database doc/rec of client associated with currently logged in user
                const docCurrentClient = Catenis.db.collection.Client.findOne({
                    user_id: this.userId,
                    status: Client.status.active.name
                }, {
                    fields: {
                        _id: 1
                    }
                });

                if (docCurrentClient) {
                    try {
                        // Prepare to update device's properties
                        const props = {
                            name: deviceInfo.name,
                            public: deviceInfo.public
                        };

                        if (deviceInfo.prodUniqueId) {
                            props.prodUniqueId = deviceInfo.prodUniqueId;
                        }

                        Client.getClientByDocId(docCurrentClient._id).getDeviceByIndex(deviceIndex).updateProperties(props);
                    }
                    catch (err) {
                        // Error trying to update current client's device. Log error and throw exception
                        //  Note: exceptionally, for this method, we return the internal error so the end user has
                        //      has some information about invalid data that might have been entered
                        Catenis.logger.ERROR('Failure trying to update current client\'s (doc_id: %s) device (deviceIndex: %s).', docCurrentClient._id, deviceIndex, err);
                        throw new Meteor.Error('client.updateCurrentClientDevice.failure', 'Failure trying to update current client\'s device: ' + err.toString());
                    }
                }
                else {
                    // No active client is associated with currently logged in user.
                    //  Throw exception
                    Catenis.logger.ERROR('updateCurrentClientDevice remote method: logged in user not associated with a valid, active client', {
                        user_id: this.userId
                    });
                    throw new Meteor.Error('ctn_client_not_valid', 'Logged in user not associated with a valid client');
                }
            }
            else {
                // User not logged in or not a Catenis client.
                //  Throw exception
                throw new Meteor.Error('ctn_client_no_permission', 'No permission; must be logged in as a Catenis client to perform this task');
            }
        },
        activateCurrentClientDevice: function (deviceIndex) {
            if (Roles.userIsInRole(this.userId, 'ctn-client')) {
                // Retrieve database doc/rec of client associated with currently logged in user
                const docCurrentClient = Catenis.db.collection.Client.findOne({
                    user_id: this.userId,
                    status: Client.status.active.name
                }, {
                    fields: {
                        _id: 1
                    }
                });

                if (docCurrentClient) {
                    try {
                        Client.getClientByDocId(docCurrentClient._id).getDeviceByIndex(deviceIndex).enable();
                    }
                    catch (err) {
                        // Error trying to activate current client's device. Log error and throw exception
                        //  WARNING: internal error should NOT be disclosed to client
                        Catenis.logger.ERROR('Failure trying to activate current client\'s (doc_id: %s) device (deviceIndex: %s).', docCurrentClient._id, deviceIndex, err);
                        throw new Meteor.Error('client.activateCurrentClientDevice.failure', 'Failure trying to activate current client\'s device');
                    }
                }
                else {
                    // No active client is associated with currently logged in user.
                    //  Throw exception
                    Catenis.logger.ERROR('activateCurrentClientDevice remote method: logged in user not associated with a valid, active client', {
                        user_id: this.userId
                    });
                    throw new Meteor.Error('ctn_client_not_valid', 'Logged in user not associated with a valid client');
                }
            }
            else {
                // User not logged in or not a Catenis client.
                //  Throw exception
                throw new Meteor.Error('ctn_client_no_permission', 'No permission; must be logged in as a Catenis client to perform this task');
            }
        },
        deactivateCurrentClientDevice: function (deviceIndex) {
            if (Roles.userIsInRole(this.userId, 'ctn-client')) {
                // Retrieve database doc/rec of client associated with currently logged in user
                const docCurrentClient = Catenis.db.collection.Client.findOne({
                    user_id: this.userId,
                    status: Client.status.active.name
                }, {
                    fields: {
                        _id: 1
                    }
                });

                if (docCurrentClient) {
                    try {
                        Client.getClientByDocId(docCurrentClient._id).getDeviceByIndex(deviceIndex).disable();
                    }
                    catch (err) {
                        // Error trying to deactivate current client's device. Log error and throw exception
                        //  WARNING: internal error should NOT be disclosed to client
                        Catenis.logger.ERROR('Failure trying to deactivate current client\'s (doc_id: %s) device (deviceIndex: %s).', docCurrentClient._id, deviceIndex, err);
                        throw new Meteor.Error('client.deactivateCurrentClientDevice.failure', 'Failure trying to deactivate current client\'s device');
                    }
                }
                else {
                    // No active client is associated with currently logged in user.
                    //  Throw exception
                    Catenis.logger.ERROR('deactivateCurrentClientDevice remote method: logged in user not associated with a valid, active client', {
                        user_id: this.userId
                    });
                    throw new Meteor.Error('ctn_client_not_valid', 'Logged in user not associated with a valid client');
                }
            }
            else {
                // User not logged in or not a Catenis client.
                //  Throw exception
                throw new Meteor.Error('ctn_client_no_permission', 'No permission; must be logged in as a Catenis client to perform this task');
            }
        },
        deleteCurrentClientDevice: function (deviceIndex) {
            if (Roles.userIsInRole(this.userId, 'ctn-client')) {
                // Retrieve database doc/rec of client associated with currently logged in user
                const docCurrentClient = Catenis.db.collection.Client.findOne({
                    user_id: this.userId,
                    status: Client.status.active.name
                }, {
                    fields: {
                        _id: 1
                    }
                });

                if (docCurrentClient) {
                    try {
                        Client.getClientByDocId(docCurrentClient._id).getDeviceByIndex(deviceIndex).delete();
                    }
                    catch (err) {
                        // Error trying to delete current client's device. Log error and throw exception
                        //  WARNING: internal error should NOT be disclosed to client
                        Catenis.logger.ERROR('Failure trying to delete current client\'s (doc_id: %s) device (deviceIndex: %s).', docCurrentClient._id, deviceIndex, err);
                        throw new Meteor.Error('client.deleteCurrentClientDevice.failure', 'Failure trying to delete current client\'s device');
                    }
                }
                else {
                    // No active client is associated with currently logged in user.
                    //  Throw exception
                    Catenis.logger.ERROR('deleteCurrentClientDevice remote method: logged in user not associated with a valid, active client', {
                        user_id: this.userId
                    });
                    throw new Meteor.Error('ctn_client_not_valid', 'Logged in user not associated with a valid client');
                }
            }
            else {
                // User not logged in or not a Catenis client.
                //  Throw exception
                throw new Meteor.Error('ctn_client_no_permission', 'No permission; must be logged in as a Catenis client to perform this task');
            }
        }
    });

    // Declaration of publications
    Meteor.publish('currentClientDevices', function(addDeleted = false) {
        if (Roles.userIsInRole(this.userId, 'ctn-client')) {
            // Retrieve database doc/rec of client associated with currently logged in user
            const docCurrentClient = Catenis.db.collection.Client.findOne({
                user_id: this.userId,
                status: Client.status.active.name
            }, {
                fields: {
                    _id: 1
                }
            });

            if (docCurrentClient) {
                const selector = {
                    client_id: docCurrentClient._id
                };

                if (!addDeleted) {
                    selector.status = {
                        $ne: 'deleted'
                    }
                }

                return Catenis.db.collection.Device.find(selector, {
                    fields: {
                        _id: 1,
                        client_id: 1,
                        deviceId: 1,
                        index: 1,
                        props: 1,
                        status: 1
                    }
                });
            }
            else {
                // No active client is associated with currently logged in user.
                //  Make sure that publication is not started and throw exception
                this.stop();
                Catenis.logger.ERROR('currentClientDevices publication: logged in user not associated with a valid, active client', {
                    user_id: this.userId
                });
                throw new Meteor.Error('ctn_client_not_valid', 'Logged in user not associated with a valid client');
            }
        }
        else {
            // User not logged in or not a Catenis client.
            //  Make sure that publication is not started and throw exception
            this.stop();
            throw new Meteor.Error('ctn_client_no_permission', 'No permission; must be logged in as a Catenis client to perform this task');
        }
    });

    Meteor.publish('currentClientDeviceRecord', function(deviceIndex) {
        if (Roles.userIsInRole(this.userId, 'ctn-client')) {
            // Retrieve database doc/rec of client associated with currently logged in user
            const docCurrentClient = Catenis.db.collection.Client.findOne({
                user_id: this.userId,
                status: Client.status.active.name
            }, {
                fields: {
                    index: 1
                }
            });

            if (docCurrentClient) {
                return Catenis.db.collection.Device.find({
                    'index.ctnNodeIndex': docCurrentClient.index.ctnNodeIndex,
                    'index.clientIndex': docCurrentClient.index.clientIndex,
                    'index.deviceIndex': deviceIndex
                }, {
                    fields: {
                        _id: 1,
                        client_id: 1,
                        deviceId: 1,
                        index: 1,
                        props: 1,
                        status: 1
                    }
                });
            }
            else {
                // No active client is associated with currently logged in user.
                //  Make sure that publication is not started and throw exception
                this.stop();
                Catenis.logger.ERROR('currentClientDeviceRecord publication: logged in user not associated with a valid, active client', {
                    user_id: this.userId
                });
                throw new Meteor.Error('ctn_client_not_valid', 'Logged in user not associated with a valid client');
            }
        }
        else {
            // User not logged in or not a Catenis client.
            //  Make sure that publication is not started and throw exception
            this.stop();
            throw new Meteor.Error('ctn_client_no_permission', 'No permission; must be logged in as a Catenis client to perform this task');
        }
    });

    Meteor.publish('currentClientDevicesInfo', function() {
        if (Roles.userIsInRole(this.userId, 'ctn-client')) {
            // Retrieve database doc/rec of client associated with currently logged in user
            const docCurrentClient = Catenis.db.collection.Client.findOne({
                user_id: this.userId,
                status: Client.status.active.name
            }, {
                fields: {
                    _id: 1
                }
            });

            if (docCurrentClient) {
                CommonDevicesUI.clientDevicesInfo.call(this, docCurrentClient._id);
            }
            else {
                // No active client is associated with currently logged in user.
                //  Make sure that publication is not started and throw exception
                this.stop();
                Catenis.logger.ERROR('currentClientDevicesInfo publication: logged in user not associated with a valid, active client', {
                    user_id: this.userId
                });
                throw new Meteor.Error('ctn_client_not_valid', 'Logged in user not associated with a valid client');
            }
        }
        else {
            // User not logged in or not a Catenis client.
            //  Make sure that publication is not started and throw exception
            this.stop();
            throw new Meteor.Error('ctn_client_no_permission', 'No permission; must be logged in as a Catenis client to perform this task');
        }
    });

    Meteor.publish('currentClientBillingDevice', function(billing_id) {
        if (Roles.userIsInRole(this.userId, 'ctn-client')) {
            // Retrieve database doc/rec of client associated with currently logged in user
            const docCurrentClient = Catenis.db.collection.Client.findOne({
                user_id: this.userId,
                status: Client.status.active.name
            }, {
                fields: {
                    _id: 1,
                    clientId: 1
                }
            });

            if (docCurrentClient) {
                // Make sure that billing record is associated with currently logged in client
                const docBilling = Catenis.db.collection.Billing.findOne({
                    _id: billing_id,
                    type: Billing.docType.original.name,
                    clientId: docCurrentClient.clientId
                }, {
                    fields: {
                        deviceId: 1
                    }
                });

                if (docBilling) {
                    return Catenis.db.collection.Device.find({
                        client_id: docCurrentClient._id,
                        deviceId: docBilling.deviceId
                    }, {
                        fields: {
                            _id: 1,
                            client_id: 1,
                            deviceId: 1,
                            index: 1,
                            props: 1,
                            status: 1
                        }
                    });
                }
                else {
                    this.ready();
                }
            }
            else {
                // No active client is associated with currently logged in user.
                //  Make sure that publication is not started and throw exception
                this.stop();
                Catenis.logger.ERROR('currentClientBillingDevice publication: logged in user not associated with a valid, active client', {
                    user_id: this.userId
                });
                throw new Meteor.Error('ctn_client_not_valid', 'Logged in user not associated with a valid client');
            }
        }
        else {
            // User not logged in or not a Catenis client.
            //  Make sure that publication is not started and throw exception
            this.stop();
            throw new Meteor.Error('ctn_client_no_permission', 'No permission; must be logged in as a Catenis client to perform this task');
        }
    });
};


// ClientDevicesUI function class (public) properties
//

/*ClientDevicesUI.prop = {};*/


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(ClientDevicesUI);
