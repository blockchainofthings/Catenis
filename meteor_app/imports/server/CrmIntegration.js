/**
 * Created by claudio on 2021-09-22
 */

//console.log('[CrmIntegration.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import config from 'config';
import got from 'got';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';

// Config entries
const crmIntegrationConfig = config.get('crmIntegration');

// Configuration settings
const cfgSettings = {
    formUrl: crmIntegrationConfig.get('formUrl'),
    localAddress: crmIntegrationConfig.get('localAddress'),
    timeout: crmIntegrationConfig.get('timeout'),
    fields: crmIntegrationConfig.get('fields')
};


// Definition of classes
//

/**
 * CRM Integration class
 */
export class CrmIntegration {
    /**
     * Class constructor
     * @param {string} formUrl
     * @param {string} [localAddress]
     * @param {number} [timeout]
     */
    constructor(formUrl, localAddress, timeout) {
        // Prepare for request
        this.formUrl = formUrl;
        this.callOptions = {
            retry: 0
        };

        if (localAddress) {
            this.callOptions.localAddress = localAddress;
        }

        if (timeout) {
            this.callOptions.timeout = {
                socket: timeout,
                response: timeout
            };
        }
    }

    sendDataAsync(client, callback) {
        if (this.formUrl) {
            const formData = {};

            for (const field of cfgSettings.fields) {
                formData[field.name] = field.value !== null
                    ? field.value
                    : (
                        field.mappedClientProp
                            ? getClientProp(client, field.mappedClientProp)
                            : ''
                    );
            }

            Catenis.logger.DEBUG('Form with data to pass to CRM:', formData);
            got.post(this.formUrl, {
                ...this.callOptions,
                form: formData
            })
            .then(() => callback(null))
            .catch(err => callback(err));
        }
        else {
            // Nothing to do
            Catenis.logger.DEBUG('Bypassing passing customer data to CRM');
            callback(null);
        }
    }

    static initialize() {
        Catenis.logger.TRACE('CrmIntegration initialization');
        // Instantiate CrmIntegration object
        Catenis.crmIntegration = new CrmIntegration(cfgSettings.formUrl, cfgSettings.localAddress, cfgSettings.timeout);
    }
}


// Module functions used to simulate private CrmIntegration object methods
//  NOTE: these functions need to be bound to a CrmIntegration object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// Definition of module (private) functions
//

function getClientProp(client, compoundProp) {
    let source = client;

    for (const prop of compoundProp.split('.')) {
        source = source[prop];
    }

    return source;
}


// Module code
//

// Lock function class
Object.freeze(CrmIntegration);
