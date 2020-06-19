/**
 * Created by claudio on 2020-06-19
 */

//console.log('[CommonOwnedDomainsUI.js]: This code just ran.');

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
import { Random } from 'meteor/random';
import _und from 'underscore';


// Definition of function classes
//

// CommonOwnedDomainsUI function class
export function CommonOwnedDomainsUI() {
}


// Public CommonOwnedDomainsUI object methods
//

/*CommonOwnedDomainsUI.prototype.pub_func = function () {
};*/


// Module functions used to simulate private CommonOwnedDomainsUI object methods
//  NOTE: these functions need to be bound to a CommonOwnedDomainsUI object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// CommonOwnedDomainsUI function class (public) methods
//

// Publication auxiliary method for client owned domains
//
//  NOTE: this method should be called via the predefined function method .call() passing the context (this)
//      of the caller publication function (i.e. method.call(this, ...))
CommonOwnedDomainsUI.ownedDomains = function (client_id) {
    let dnsTextRecName;

    try {
        dnsTextRecName = Client.getClientByDocId(client_id).ownedDomain.dnsTextRecName;
    }
    catch (err) {
        // Error trying to retrieve DNS text record name for verifying client owned domains for ownedDomain publication
        Catenis.logger.ERROR('Error trying to retrieve DNS text record name for verifying client owned domains for `ownedDomain` publication (client_id: %s).', client_id, err);
    }

    const domainRecord = domain => ({
        name: domain.name,
        verified: domain.verified,
        verification: domain.verified ? undefined : {
            dnsTextRecName,
            text: domain.verificationText
        }
    });
    const genId = conformedDomainName => Random.createWithSeeds(conformedDomainName).id();

    const observeHandle = Catenis.db.collection.Client.find({
        _id: client_id
    }, {
        fields: {
            ownedDomains: 1
        }
    }).observe({
        added: (doc) => {
            if (doc.ownedDomains) {
                doc.ownedDomains.forEach(domain => {
                    this.added('ClientOwnedDomain', genId(domain.conformedName), domainRecord(domain));
                });
            }
        },
        changed: (newDoc, oldDoc) => {
            if (oldDoc.ownedDomains && !newDoc.ownedDomains) {
                // Whole list of owned domains delete
                oldDoc.ownedDomains.forEach(domain => {
                    this.removed('ClientOwnedDomain', genId(domain.conformedName));
                });
            }
            else if (!oldDoc.ownedDomains && newDoc.ownedDomains) {
                // A whole list of owned domains added
                newDoc.ownedDomains.forEach(domain => {
                    this.added('ClientOwnedDomain', genId(domain.conformedName), domainRecord(domain));
                });
            }
            else if (oldDoc.ownedDomains && newDoc.ownedDomains) {
                // Owned list updated. Check to determined which records have changed and how
                const oldNameDomain = new Map();

                oldDoc.ownedDomains.forEach(domain => {
                    oldNameDomain.set(domain.conformedName, domain);
                });

                const newNameDomain = new Map();

                newDoc.ownedDomains.forEach(domain => {
                    newNameDomain.set(domain.conformedName, domain);
                });

                for (let [conformedDomainName, oldDomain] of oldNameDomain) {
                    if (!newNameDomain.has(conformedDomainName)) {
                        // Owned domain deleted
                        this.removed('ClientOwnedDomain', genId(conformedDomainName));
                    }
                    else {
                        const newDomain = newNameDomain.get(conformedDomainName);

                        if (!_und.isEqual(oldDomain, newDomain)) {
                            // Owned domain updated
                            this.changed('ClientOwnedDomain', genId(conformedDomainName), domainRecord(newDomain));
                        }
                    }
                }

                for (let [conformedDomainName, newDomain] of newNameDomain) {
                    if (!oldNameDomain.has(conformedDomainName)) {
                        // New owned domain added
                        this.added('ClientOwnedDomain', genId(conformedDomainName), domainRecord(newDomain));
                    }
                }
            }
        },
        removed: (doc) => {
            if (doc.ownedDomains) {
                doc.ownedDomains.forEach(domain => {
                    this.removed('ClientOwnedDomain', domain.conformedName);
                });
            }
        }
    });

    this.onStop(() => observeHandle.stop());

    this.ready();
};


// CommonOwnedDomainsUI function class (public) properties
//

/*CommonOwnedDomainsUI.prop = {};*/


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(CommonOwnedDomainsUI);
