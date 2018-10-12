/**
 * Created by Claudio on 2017-05-26.
 */

//console.log('[DevicesUI.js]: This code just ran.');

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
import { Roles } from 'meteor/alanning:roles';

// References code in other (Catenis) modules
import { Catenis } from '../Catenis';
import { Device } from '../Device';
import { Client } from '../Client';


// Definition of function classes
//

// DevicesUI function class
export function DevicesUI() {
}


// Public DevicesUI object methods
//

/*DevicesUI.prototype.pub_func = function () {
 };*/


// Module functions used to simulate private DevicesUI object methods
//  NOTE: these functions need to be bound to a DevicesUI object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
 }*/


// DevicesUI function class (public) methods
//

DevicesUI.initialize = function () {
    Catenis.logger.TRACE('DevicesUI initialization');
    // Declaration of RPC methods to be called from client
    Meteor.methods({
        getDeviceApiAccessSecret: function (device_id) {
            if (Roles.userIsInRole(this.userId, 'sys-admin')) {
                try {
                    return Device.getDeviceByDocId(device_id).apiAccessSecret;
                }
                catch (err) {
                    // Error trying to get device's API access secret. Log error and throw exception
                    Catenis.logger.ERROR('Failure trying to get device\'s (doc_id: %s) API access secret.', device_id, err);
                    throw new Meteor.Error('device.getDeviceApiAccessSecret.failure', 'Failure trying to get device\'s API access secret: ' + err.toString());
                }
            }
            else {
                // User not logged in or not a system administrator.
                //  Throw exception
                throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
            }
        },
        resetDeviceApiAccessSecret: function (device_id, resetToClientDefault) {
            if (Roles.userIsInRole(this.userId, 'sys-admin')) {
                try {
                    Device.getDeviceByDocId(device_id).renewApiAccessGenKey(resetToClientDefault);
                }
                catch (err) {
                    // Error trying to reset device's API access secret. Log error and throw exception
                    Catenis.logger.ERROR('Failure trying to renew device\'s (doc_id: %s) API access generation key.', device_id, err);
                    throw new Meteor.Error('device.resetDeviceApiAccessSecret.failure', 'Failure trying to renew device\'s API access generation key: ' + err.toString());
                }
            }
            else {
                // User not logged in or not a system administrator.
                //  Throw exception
                throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
            }
        },
        createNewDevice: function (client_id, deviceInfo) {
            if (Roles.userIsInRole(this.userId, 'sys-admin')) {
                try {
                    const props = {};

                    if (deviceInfo.name) {
                        props.name = deviceInfo.name;
                    }

                    if (deviceInfo.prodUniqueId) {
                        props.prodUniqueId = deviceInfo.prodUniqueId;
                    }

                    props.public = deviceInfo.public;

                    return Client.getClientByDocId(client_id).createDevice(props, !deviceInfo.assignClientAPIAccessSecret);
                }
                catch (err) {
                    // Error trying to create new device. Log error and throw exception
                    Catenis.logger.ERROR('Failure trying to create new device.', err);
                    throw new Meteor.Error('device.create.failure', 'Failure trying to create new device: ' + err.toString());
                }
            }
            else {
                // User not logged in or not a system administrator.
                //  Throw exception
                throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
            }
        },
        updateDevice: function (device_id, deviceInfo) {
            if (Roles.userIsInRole(this.userId, 'sys-admin')) {
                try {
                    // Prepare to update device's properties
                    const props = {
                        name: deviceInfo.name,
                        public: deviceInfo.public
                    };

                    if (deviceInfo.prodUniqueId) {
                        props.prodUniqueId = deviceInfo.prodUniqueId;
                    }

                    Device.getDeviceByDocId(device_id).updateProperties(props);
                }
                catch (err) {
                    // Error trying to update device data. Log error and throw exception
                    Catenis.logger.ERROR('Failure trying to update device (doc_id) data.', device_id, err);
                    throw new Meteor.Error('device.update.failure', 'Failure trying to update device data: ' + err.toString());
                }
            }
            else {
                // User not logged in or not a system administrator.
                //  Throw exception
                throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
            }
        },
        activateDevice: function (device_id) {
            if (Roles.userIsInRole(this.userId, 'sys-admin')) {
                try {
                    Device.getDeviceByDocId(device_id).enable();
                }
                catch (err) {
                    // Error trying to activate device. Log error and throw exception
                    Catenis.logger.ERROR('Failure trying to activate device (doc_id: %s).', device_id, err);
                    throw new Meteor.Error('device.activate.failure', 'Failure trying to activate device: ' + err.toString());
                }
            }
            else {
                // User not logged in or not a system administrator.
                //  Throw exception
                throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
            }
        },
        deactivateDevice: function (device_id) {
            if (Roles.userIsInRole(this.userId, 'sys-admin')) {
                try {
                    Device.getDeviceByDocId(device_id).disable();
                }
                catch (err) {
                    // Error trying to deactivate device. Log error and throw exception
                    Catenis.logger.ERROR('Failure trying to deactivate device (doc_id: %s).', device_id, err);
                    throw new Meteor.Error('device.deactivate.failure', 'Failure trying to deactivate device: ' + err.toString());
                }
            }
            else {
                // User not logged in or not a system administrator.
                //  Throw exception
                throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
            }
        },
        deleteDevice: function (device_id) {
            if (Roles.userIsInRole(this.userId, 'sys-admin')) {
                try {
                    Device.getDeviceByDocId(device_id).delete();
                }
                catch (err) {
                    // Error trying to delete device. Log error and throw exception
                    Catenis.logger.ERROR('Failure trying to delete device (doc_id: %s).', device_id, err);
                    throw new Meteor.Error('device.delete.failure', 'Failure trying to delete device: ' + err.toString());
                }
            }
            else {
                // User not logged in or not a system administrator.
                //  Throw exception
                throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
            }
        }
    });

    // Declaration of publications
    Meteor.publish('clientDevices', function (client_id) {
        if (Roles.userIsInRole(this.userId, 'sys-admin')) {
            return Catenis.db.collection.Device.find({
                client_id: client_id,
                status: {$ne: 'deleted'}
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
            // User not logged in or not a system administrator
            //  Make sure that publication is not started and throw exception
            this.stop();
            throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
        }
    });

    Meteor.publish('deviceRecord', function (device_id) {
        if (Roles.userIsInRole(this.userId, 'sys-admin')) {
            return Catenis.db.collection.Device.find({
                _id: device_id
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
            // User not logged in or not a system administrator
            //  Make sure that publication is not started and throw exception
            this.stop();
            throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
        }
    });

    Meteor.publish('clientDevicesInfo', function(client_id) {
        if (Roles.userIsInRole(this.userId, 'sys-admin')) {
            const client = Client.getClientByDocId(client_id);

            let clientDevicesInfo = {
                maxAllowedDevices: client.maximumAllowedDevices,
                numDevicesInUse: client.devicesInUseCount()
            };

            // Monitor license entries associated with client
            const observeHandle = Catenis.db.collection.ClientLicense.find({
                client_id: client_id
            }, {
                fields: {
                    _id: 1,
                    status: 1
                }
            }).observe({
                added: (doc) => {
                    // New license entry for client. Retrieve current client devices info
                    //  and check if it has changed
                    const client = Client.getClientByDocId(client_id);

                    const currClientDevicesInfo = {
                        maxAllowedDevices: client.maximumAllowedDevices,
                        numDevicesInUse: client.devicesInUseCount()
                    };
                    const diffClientDevicesInfo = {};

                    if (currClientDevicesInfo.maxAllowedDevices !== clientDevicesInfo.maxAllowedDevices) {
                        diffClientDevicesInfo.maxAllowedDevices = currClientDevicesInfo.maxAllowedDevices;
                    }

                    if (currClientDevicesInfo.numDevicesInUse !== clientDevicesInfo.numDevicesInUse) {
                        diffClientDevicesInfo.numDevicesInUse = currClientDevicesInfo.numDevicesInUse;
                    }

                    if (Object.keys(diffClientDevicesInfo).length > 0) {
                        // Indicate that client devices info has changed
                        this.changed('ClientDevicesInfo', 1, diffClientDevicesInfo);
                        clientDevicesInfo = currClientDevicesInfo;
                    }
                },
                changed: (newDoc, oldDoc) => {
                    if (newDoc.status !== oldDoc.status) {
                        // Status of client license has changed. Retrieve current client devices info
                        //  and check if it has changed
                        const client = Client.getClientByDocId(client_id);

                        const currClientDevicesInfo = {
                            maxAllowedDevices: client.maximumAllowedDevices,
                            numDevicesInUse: client.devicesInUseCount()
                        };
                        const diffClientDevicesInfo = {};

                        if (currClientDevicesInfo.maxAllowedDevices !== clientDevicesInfo.maxAllowedDevices) {
                            diffClientDevicesInfo.maxAllowedDevices = currClientDevicesInfo.maxAllowedDevices;
                        }

                        if (currClientDevicesInfo.numDevicesInUse !== clientDevicesInfo.numDevicesInUse) {
                            diffClientDevicesInfo.numDevicesInUse = currClientDevicesInfo.numDevicesInUse;
                        }

                        if (Object.keys(diffClientDevicesInfo).length > 0) {
                            // Indicate that client devices info has changed
                            this.changed('ClientDevicesInfo', 1, diffClientDevicesInfo);
                            clientDevicesInfo = currClientDevicesInfo;
                        }
                    }
                },
                removed: (doc) => {
                    // Client license has been removed. Retrieve current client devices info
                    //  and check if it has changed
                    const client = Client.getClientByDocId(client_id);

                    const currClientDevicesInfo = {
                        maxAllowedDevices: client.maximumAllowedDevices,
                        numDevicesInUse: client.devicesInUseCount()
                    };
                    const diffClientDevicesInfo = {};

                    if (currClientDevicesInfo.maxAllowedDevices !== clientDevicesInfo.maxAllowedDevices) {
                        diffClientDevicesInfo.maxAllowedDevices = currClientDevicesInfo.maxAllowedDevices;
                    }

                    if (currClientDevicesInfo.numDevicesInUse !== clientDevicesInfo.numDevicesInUse) {
                        diffClientDevicesInfo.numDevicesInUse = currClientDevicesInfo.numDevicesInUse;
                    }

                    if (Object.keys(diffClientDevicesInfo).length > 0) {
                        // Indicate that client devices info has changed
                        this.changed('ClientDevicesInfo', 1, diffClientDevicesInfo);
                        clientDevicesInfo = currClientDevicesInfo;
                    }
                }
            });

            // Monitor devices of client
            const observeHandle2 = Catenis.db.collection.Device.find({
                client_id: client_id
            }, {
                fields: {
                    _id: 1,
                    status: 1
                }
            }).observe({
                added: (doc) => {
                    // New device added for client. Retrieve current client devices info
                    //  and check if it has changed
                    const client = Client.getClientByDocId(client_id);

                    const currClientDevicesInfo = {
                        maxAllowedDevices: client.maximumAllowedDevices,
                        numDevicesInUse: client.devicesInUseCount()
                    };
                    const diffClientDevicesInfo = {};

                    if (currClientDevicesInfo.maxAllowedDevices !== clientDevicesInfo.maxAllowedDevices) {
                        diffClientDevicesInfo.maxAllowedDevices = currClientDevicesInfo.maxAllowedDevices;
                    }

                    if (currClientDevicesInfo.numDevicesInUse !== clientDevicesInfo.numDevicesInUse) {
                        diffClientDevicesInfo.numDevicesInUse = currClientDevicesInfo.numDevicesInUse;
                    }

                    if (Object.keys(diffClientDevicesInfo).length > 0) {
                        // Indicate that client devices info has changed
                        this.changed('ClientDevicesInfo', 1, diffClientDevicesInfo);
                        clientDevicesInfo = currClientDevicesInfo;
                    }
                },
                changed: (newDoc, oldDoc) => {
                    if (newDoc.status !== oldDoc.status) {
                        // Status of client device has changed. Retrieve current client devices info
                        //  and check if it has changed
                        const client = Client.getClientByDocId(client_id);

                        const currClientDevicesInfo = {
                            maxAllowedDevices: client.maximumAllowedDevices,
                            numDevicesInUse: client.devicesInUseCount()
                        };
                        const diffClientDevicesInfo = {};

                        if (currClientDevicesInfo.maxAllowedDevices !== clientDevicesInfo.maxAllowedDevices) {
                            diffClientDevicesInfo.maxAllowedDevices = currClientDevicesInfo.maxAllowedDevices;
                        }

                        if (currClientDevicesInfo.numDevicesInUse !== clientDevicesInfo.numDevicesInUse) {
                            diffClientDevicesInfo.numDevicesInUse = currClientDevicesInfo.numDevicesInUse;
                        }

                        if (Object.keys(diffClientDevicesInfo).length > 0) {
                            // Indicate that client devices info has changed
                            this.changed('ClientDevicesInfo', 1, diffClientDevicesInfo);
                            clientDevicesInfo = currClientDevicesInfo;
                        }
                    }
                },
                removed: (doc) => {
                    // Client device has been deleted. Retrieve current client devices info
                    //  and check if it has changed
                    const client = Client.getClientByDocId(client_id);

                    const currClientDevicesInfo = {
                        maxAllowedDevices: client.maximumAllowedDevices,
                        numDevicesInUse: client.devicesInUseCount()
                    };
                    const diffClientDevicesInfo = {};

                    if (currClientDevicesInfo.maxAllowedDevices !== clientDevicesInfo.maxAllowedDevices) {
                        diffClientDevicesInfo.maxAllowedDevices = currClientDevicesInfo.maxAllowedDevices;
                    }

                    if (currClientDevicesInfo.numDevicesInUse !== clientDevicesInfo.numDevicesInUse) {
                        diffClientDevicesInfo.numDevicesInUse = currClientDevicesInfo.numDevicesInUse;
                    }

                    if (Object.keys(diffClientDevicesInfo).length > 0) {
                        // Indicate that client devices info has changed
                        this.changed('ClientDevicesInfo', 1, diffClientDevicesInfo);
                        clientDevicesInfo = currClientDevicesInfo;
                    }
                }
            });

            this.added('ClientDevicesInfo', 1, clientDevicesInfo);

            this.ready();

            this.onStop(() => observeHandle.stop());
        }
        else {
            // User not logged in or not a system administrator
            //  Make sure that publication is not started and throw exception
            this.stop();
            throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
        }
    });
};


// DevicesUI function class (public) properties
//

/*DevicesUI.prop = {};*/


// Definition of module (private) functions
//


// Module code
//

// Lock function class
Object.freeze(DevicesUI);
