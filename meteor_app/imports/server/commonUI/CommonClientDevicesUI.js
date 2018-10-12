/**
 * Created by claudio on 2018-10-04.
 */

//console.log('[CommonClientDevicesUI.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
//import config from 'config';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from '../Catenis';
import { Client } from '../Client';

// Config entries
/*const config_entryConfig = config.get('config_entry');

// Configuration settings
const cfgSettings = {
    property: config_entryConfig.get('property_name')
};*/


// Definition of function classes
//

// CommonClientDevicesUI function class
export function CommonClientDevicesUI() {
}


// Public CommonClientDevicesUI object methods
//

/*CommonClientDevicesUI.prototype.pub_func = function () {
};*/


// Module functions used to simulate private CommonClientDevicesUI object methods
//  NOTE: these functions need to be bound to a CommonClientDevicesUI object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// CommonClientDevicesUI function class (public) methods
//

// Publication auxiliary method for including License database doc/recs associated with all ClientLicense
//  database doc/recs for a given client
//
//  NOTE: this method should be called via the predefined function method .call() passing the context (this)
//      of the caller publication function (i.e. method.call(this, ...))
CommonClientDevicesUI.clientDevicesInfo = function (client_id) {
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

    this.onStop(() => {
        observeHandle.stop();
        observeHandle2.stop();
    });

    this.ready();
};


// CommonClientDevicesUI function class (public) properties
//

/*CommonClientDevicesUI.prop = {};*/


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(CommonClientDevicesUI);
