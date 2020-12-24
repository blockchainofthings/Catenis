/**
 * Created by claudio on 2020-06-15
 */

//console.log('[ClientOwnedDomain.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import crypto from "crypto";
// Third-party node modules
//import config from 'config';
// Meteor packages
import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { Client } from './Client';
import { Util } from './Util';


// Definition of classes
//

// ClientOwnedDomain class
export class ClientOwnedDomain {
    // Constructor
    //

    // Constructor arguments:
    //  client: [Object] - instance of Client function class with which device is associated
    constructor(client) {
        // Validate client argument
        if (!(client instanceof Client)) {
            Catenis.logger.ERROR('ClientOwnedDomain class constructor called with invalid argument', {client});
            throw Error('ClientOwnedDomain constructor: Invalid `client` argument');
        }

        this.client = client;
        this.nameDomain = undefined;
        this._refreshDomainList();
    }


    // Public object properties (getters/setters)
    //

    get dnsTextRecName() {
        return `ctn-node${this.client.ctnNode.ctnNodeIndex}-client${this.client.clientIndex}${dnsTxtRecNameSuffix()}`;
    }

    get domainList() {
        return Array.from(this.nameDomain.values());
    }

    get verifiedDomainList() {
        return this.domainList.filter(domain => domain.verified);
    }


    // Public object methods
    //

    hasDomain(domainName) {
        return isValidDomain(domainName) && this.nameDomain.has(conformDomainName(domainName));
    }

    isDomainVerified(domainName) {
        let result = false;

        if (isValidDomain(domainName)) {
            const conformedDomainName = conformDomainName(domainName);

            result = this.nameDomain.has(conformedDomainName) && this.nameDomain.get(conformedDomainName).verified;
        }

        return result;
    }

    verifyDomain(domainName) {
        if (!this.hasDomain(domainName)) {
            // Domain does not exist yet. Log error condition and throw exception
            Catenis.logger.ERROR('Cannot verify domain: client owned domain (%s) does not exist', domainName);
            throw new Meteor.Error('cl_own_dom_not_exist', 'Client owned domain does not exist');
        }

        const conformedDomainName = conformDomainName(domainName);
        const domain = this.nameDomain.get(conformedDomainName);

        if (domain.verified) {
            // Domain already verified. Log error condition and throw exception
            Catenis.logger.ERROR('Cannot verify domain: client owned domain (%s) already verified', domainName);
            throw new Meteor.Error('cl_own_dom_already_verified', 'Client owned domain already verified');
        }

        let records;

        try {
            records = Util.syncDnsResolveTxt(this.dnsTextRecName + `.${domain.conformedName}`);
        }
        catch (err) {
            if ((err instanceof Error) && err.errno === 'ENOTFOUND') {
                // Return indicating that domain could not be verified
                return false;
            }
            else {
                // Error looking up DNS record. Log error condition and throw exception
                Catenis.logger.ERROR('Error looking up DNS record (%s) to verify client owned domain (%s).', this.dnsTextRecName, domain.conformedName, err);
                throw new Meteor.Error('cl_own_dom_update_error', 'Error looking up DNS record to verify client owned domain');
            }
        }

        if (records) {
            const recChunks = records[0];
            const record = recChunks.reduce((rec, chunk) => {
                return rec + chunk;
            }, '');

            if (record === domain.verificationText) {
                // Set domain as verified
                domain.verified = true;
                domain.verificationDate = new Date();

                try {
                    Catenis.db.collection.Client.update(this.client.doc_id, {
                        $set: {
                            ownedDomains: this.domainList
                        }
                    });
                }
                catch (err) {
                    // Error updating Client doc/rec to set owned domain as verified.
                    //  Reset domain locally to not verified, log error condition and throw exception
                    domain.verifed = false;
                    Catenis.logger.ERROR('Error updating Client doc/rec (id: %s) to set owned domain as verified.', this.client.doc_id, err);
                    throw new Meteor.Error('cl_own_dom_update_error', 'Error updating Client doc/rec to set owned domain as verified');
                }
            }
        }

        return domain.verified;
    }

    addDomain(domainName) {
        if (!isValidDomain(domainName)) {
            // Invalid domain name. Log error condition and throw exception
            Catenis.logger.ERROR('Cannot add domain: invalid domain name (%s)', domainName);
            throw new Meteor.Error('cl_own_dom_invalid_name', 'Invalid domain name');
        }

        if (this.hasDomain(domainName)) {
            // Domain already exist. Log error condition and throw exception
            Catenis.logger.ERROR('Cannot add domain: client owned domain (%s) already exists', domainName);
            throw new Meteor.Error('cl_own_dom_already_exist', 'Client owned domain already exist');
        }

        const conformedDomainName = conformDomainName(domainName);
        const domain = {
            name: domainName,
            conformedName: conformedDomainName,
            verificationText: this._getVerificationText(conformedDomainName),
            verified: false
        };

        this.nameDomain.set(domain.conformedName, domain);

        try {
            Catenis.db.collection.Client.update(this.client.doc_id, {
                $set: {
                    ownedDomains: this.domainList
                }
            });
        }
        catch (err) {
            // Error updating Client doc/rec to add new owned domain.
            //  Exclude domain from local list, log error condition and throw exception
            this.nameDomain.delete(domain.conformedName);
            Catenis.logger.ERROR('Error updating Client doc/rec (id: %s) to add new owned domain.', this.client.doc_id, err);
            throw new Meteor.Error('cl_own_dom_update_error', 'Error updating Client doc/rec to add new owned domain');
        }
    }

    deleteDomain(domainName) {
        if (this.hasDomain(domainName)) {
            const conformedDomainName = conformDomainName(domainName);
            const domain = this.nameDomain.get(conformedDomainName);
            this.nameDomain.delete(conformedDomainName);

            try {
                Catenis.db.collection.Client.update(this.client.doc_id, {
                    $set: {
                        ownedDomains: this.domainList
                    }
                });
            }
            catch (err) {
                // Error updating Client doc/rec to delete owned domain.
                //  Add domain back to local list, log error condition and throw exception
                this.nameDomain.set(conformedDomainName, domain);
                Catenis.logger.ERROR('Error updating Client doc/rec (id: %s) to delete owned domain.', this.client.doc_id, err);
                throw new Meteor.Error('cl_own_dom_update_error', 'Error updating Client doc/rec to delete owned domain');
            }
        }
    }

    _refreshDomainList() {
        const docClient = Catenis.db.collection.Client.findOne(this.client.doc_id, {
            fields: {
                ownedDomains: 1
            }
        });

        this.nameDomain = new Map();

        if (docClient && docClient.ownedDomains) {
            docClient.ownedDomains.forEach(domain => {
                this.nameDomain.set(domain.conformedName, domain);
            });
        }
    }

    _getVerificationText(conformedDomainName) {
        return formatVerificationText(crypto.createHash('sha256')
            .update(`key:${Random.secret()},node_index:${this.client.ctnNode.ctnNodeIndex},client_index:${this.client.clientIndex},owned_domain:${conformedDomainName}`)
            .digest().slice(0, 9).toString('hex'));
    }
}


// Definition of module (private) functions
//

function dnsTxtRecNameSuffix() {
    let prefix;

    switch(Catenis.application.environment) {
        case 'production':
            prefix = '';
            break;

        case 'sandbox':
            prefix = '.sandbox';
            break;

        case 'development':
            prefix = '.dev';
            break;
    }

    return prefix;
}

function isValidDomain(domainName) {
    return typeof domainName === 'string' && /^[A-Za-z]([A-Za-z0-9\-]*[A-Za-z0-9])*(\.[A-Za-z]([A-Za-z0-9\-]*[A-Za-z0-9])*)*$/.test(domainName);
}

function conformDomainName(domainName) {
    return domainName.toLowerCase();
}

function formatVerificationText(text) {
    return `${text.substring(0, 6)}-${text.substring(6, 12)}-${text.substring(12)}`;
}


// Module code
//

// Lock class
Object.freeze(ClientOwnedDomain);
