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


// DevicesUI function class (public) method
function verifyUserRole(){
    try{
        var user=Meteor.user();
        if(user && user.roles && user.roles.includes('sys-admin') ){
            return true;
        }else{
            return false;
        }
    }catch(err){
        Catenis.logger.ERROR('Failure trying to verify Meteor user role.', err);
        throw new Meteor.Error('devices.verifyUserRole.failure', 'Failure trying to verify role of current user: ' + err.toString());
    }
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
            if(verifyUserRole()){
                const docDevice = Catenis.db.collection.Device.findOne({_id: device_id}, {fields: {deviceId: 1}});
                return docDevice !== undefined ? Device.getDeviceByDeviceId(docDevice.deviceId).apiAccessSecret : undefined;

            }else{

                Catenis.logger.ERROR('Failure trying to get API access secret, user does not have the right to access this method');
                throw new Meteor.Error('devices.getAPIAccessSecret.failure', 'Failure trying to get API access secret, user does not have the right to access this method');

            }
        },

        resetDeviceAPISecret: function (device_id) {

            if(verifyUserRole()){

                const docDevice = Catenis.db.collection.Device.findOne({_id: device_id}, {fields: {deviceId: 1}});
                Device.getDeviceByDeviceId(docDevice.deviceId).renewApiAccessGenKey();

                return docDevice !== undefined ? Device.getDeviceByDeviceId(docDevice.deviceId).apiAccessSecret : undefined;

            }else{

                Catenis.logger.ERROR('Failure trying to reset API access secret for device, user does not have the right to access this method');
                throw new Meteor.Error('devices.resetDeviceAPISecret.failure', 'Failure trying to get API access secret, user does not have the right to access this method');

            }
        },


        //create device if the logged in user is creating a device for oneself or it's admin
        createDevice: function (client_id, deviceInfo) {
            const userVerified= verifyUserRole();

            var isSameUser=false;
            if(!userVerified) isSameUser = (  Catenis.db.collection.Client.findOne({user_id: this.userId})._id ===client_id);

            if(verifyUserRole() || isSameUser ){
                const docClient = Catenis.db.collection.Client.findOne({_id: client_id}, {fields: {clientId: 1, user_id: 1}});
                const user= Meteor.users.findOne( {_id: docClient.user_id} );

                let licenseType;

                if( user && user.profile && user.profile.license ){

                    licenseType= user.profile.license.licenseType;

                }else{

                    Catenis.logger.ERROR('Error creating Device: Client has no license Type!');
                    throw new Meteor.Error('Error creating Device: Client has no license Type!');
                }

                const numUserDevices= Catenis.db.collection.Device.find( {"client_id": {$eq: client_id } } ).count();
                const numDevicesforLicense= Catenis.db.collection.License.findOne({licenseType: licenseType}).numAllowedDevices;
                if( numUserDevices > numDevicesforLicense){

                    Catenis.logger.ERROR('Error creating new device: Client has already surpassed max number of devices at this license.');
                    throw new Meteor.Error('Error creating new device: Client has already surpassed max number of devices at this license.');

                }else if(numUserDevices === numDevicesforLicense){

                    Catenis.logger.ERROR('Error creating new device: Client has already maxed out the number of devices for this license.');
                    throw new Meteor.Error('Error creating new device: Client has already maxed out the number of devices for this license.');

                }else{

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
            }else{

                Catenis.logger.ERROR('Failure trying to create Device, user does not have the right to access this method');
                throw new Meteor.Error('devices.createDevice.failure', 'Failure trying to create Device, user does not have the right to access this method');

            }


        }
    });

    // Declaration of publications to see the devices of a certain client.
    Meteor.publish('clientDevices', function (user_id) {
        const client= Catenis.db.collection.Client.findOne({ user_id: user_id});
        const user= Meteor.users.findOne({_id: this.userId});
        const client_id= client._id;

        let verifyPublishing= false;

        //user is admin/
        if(user && user.roles && user.roles.includes('sys-admin') ){

            verifyPublishing=true;

            //user is accessing one's own info
        }else if(client.user_id===this.userId){

            verifyPublishing=true;

        }

        if(verifyPublishing){
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

        }else{
            //user has no right to access this data. Return null and let them suffer.
            return null;

        }

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
