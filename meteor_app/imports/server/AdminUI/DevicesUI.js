/**
 * Created by claudio on 26/05/17.
 */

//console.log('[DevicesUI.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//  NOTE: the reference of these modules are done sing 'require()' instead of 'import' to
//      to avoid annoying WebStorm warning message: 'default export is not defined in
//      imported module'
//const util = require('util');
// Third-party node modules
//import config from 'config';
// Meteor packages
import { Meteor } from 'meteor/meteor';

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
    // Declaration of RPC methods to be called from client
    Meteor.methods({
        getAPIAccessSecret: function (device_id) {
            const docDevice = Catenis.db.collection.Device.findOne({_id: device_id}, {fields: {deviceId: 1}});

            return docDevice !== undefined ? Device.getDeviceByDeviceId(docDevice.deviceId).apiAccessSecret : undefined;
        },
        createDevice: function (client_id, deviceInfo) {
            const docClient = Catenis.db.collection.Client.findOne({_id: client_id}, {fields: {clientId: 1}});

            if (docClient === undefined) {
                // Invalid client. Log error and throw exception
                Catenis.logger.ERROR('Invalid client doc ID for creating device', {doc_id: client_id});
                throw new Meteor.Error('device.create.invalid-client', 'Invalid client for creating device');
            }

            let deviceId;

            try {
                const props = {};

                if (deviceInfo.name.length > 0) {
                    props.name = deviceInfo.name;
                }

                if (deviceInfo.prodUniqueId.length > 0) {
                    props.prodUniqueId = deviceInfo.prodUniqueId;
                }

                props.public = deviceInfo.public;

                deviceId = Client.getClientByClientId(docClient.clientId).createDevice(props, deviceInfo.ownAPIAccessKey);
            }
            catch (err) {
                // Error trying to create client device. Log error and throw exception
                Catenis.logger.ERROR('Failure trying to create new client device.', err);
                throw new Meteor.Error('device.create.failure', 'Failure trying to create new client device: ' + err.toString());
            }

            return deviceId;
        }
    });

    // Declaration of publications
    Meteor.publish('clientDevices', function (client_id) {
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
    });

    Meteor.publish('deviceRecord', function (device_id) {
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
