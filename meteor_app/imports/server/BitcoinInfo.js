/**
 * Created by claudio on 2020-02-19
 */

//console.log('[BitcoinInfo.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import bitcoinLib from 'bitcoinjs-lib';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { add } from 'winston';

// Config entries
/*const config_entryConfig = config.get('config_entry');

// Configuration settings
const cfgSettings = {
    property: config_entryConfig.get('property_name')
};*/


// Definition of classes
//

// BitcoinInfo class
export class BitcoinInfo {
    // Class (public) properties
    static addressType = Object.freeze({
        pubkeyhash: Object.freeze({
            name: 'pubkeyhash',
            description: 'Legacy (base58) address used to pay to a public key hash',
            btcPayment: bitcoinLib.payments.p2pkh
        }),
        scripthash: Object.freeze({
            name: 'scripthash',
            description: 'Legacy (base58) address used to pay to a script hash',
            btcPayment: bitcoinLib.payments.p2sh
        }),
        witness_v0_keyhash: Object.freeze({
            name: 'witness_v0_keyhash',
            description: 'Witness version 0 (bech32) address used to pay to a public key hash (P2WPKH)',
            btcPayment: bitcoinLib.payments.p2wpkh
        }),
        witness_v0_scripthash: Object.freeze({
            name: 'witness_v0_scripthash',
            description: 'Witness version 0 (bech32) address used to pay to a script hash (P2WSH)',
            btcPayment: bitcoinLib.payments.p2wsh
        })
    });
    static outputType = Object.freeze({
        pubkeyhash: Object.freeze({
            name: 'pubkeyhash',
            description: 'Pay to a single public key hash (P2PKH - pay to public key hash)',
            descPrefix: 'pkh(',
            isWitness: false,
            addressType: BitcoinInfo.addressType.pubkeyhash.name
        }),
        scripthash: Object.freeze({
            name: 'scripthash',
            description: 'Pay to a script hash (P2SH - pay to script hash)',
            descPrefix: 'sh(',
            isWitness: false,
            addressType: BitcoinInfo.addressType.scripthash.name
        }),
        witness_v0_keyhash: Object.freeze({
            name: 'witness_v0_keyhash',
            description: 'Pay to a single public key hash using witness (version 0) (P2WPKH - pay to witness public key hash)',
            descPrefix: 'wpkh(',
            isWitness: true,
            addressType: BitcoinInfo.addressType.witness_v0_keyhash.name
        }),
        witness_v0_scripthash: Object.freeze({
            name: 'witness_v0_scripthash',
            description: 'Pay to a script hash using witness (version 0) (P2WSH - pay to witness script hash)',
            descPrefix: 'wsh(',
            isWitness: true,
            addressType: BitcoinInfo.addressType.witness_v0_scripthash.name
        }),
        multisig: Object.freeze({
            name: 'multisig',
            description: 'Pay to one or more (n) public key hashes requiring some of them (k) to sign tx to spend the output (P2MS - pay to multi-signature)',
            descPrefix: 'multi(',
            isWitness: false,
            addressType: BitcoinInfo.addressType.pubkeyhash.name
        }),
        nulldata: Object.freeze({
            name: 'nulldata',
            description: 'Output not used to make any payment but only embed data in the tx (also known as OP_RETURN)'
        }),
        unknown: Object.freeze({
            name: 'unknown',
            description: 'Special entry to designate a tx output of any other type'
        })
    });

    // Constructor
    constructor(network) {
        this.network = network;
    }

    // Public object methods
    getAddressType(address) {
        let addrType;

        if (address.startsWith(this.network.bech32)) {
            // Assume that it is a bech32 address
            try {
                bitcoinLib.payments.p2wpkh({address: address, network: this.network});
                addrType = BitcoinInfo.addressType.witness_v0_keyhash;
            }
            catch (err) {}

            if (!addrType) {
                try {
                    bitcoinLib.payments.p2wsh({address: address, network: this.network});
                    addrType = BitcoinInfo.addressType.witness_v0_scripthash;
                }
                catch (err) {}
            }
        }
        else {
            // Assume that it is a legacy (base58) address
            try {
                bitcoinLib.payments.p2pkh({address: address, network: this.network});
                addrType = BitcoinInfo.addressType.pubkeyhash;
            }
            catch (err) {}

            if (!addrType) {
                try {
                    bitcoinLib.payments.p2sh({address: address, network: this.network});
                    addrType = BitcoinInfo.addressType.scripthash;
                }
                catch (err) {}
            }
        }

        return addrType;
    }

    getOutputTypeForAddress(address) {
        const addrType = this.getAddressType(address);

        if (addrType) {
            return BitcoinInfo.getOutputTypeByAddressType(addrType);
        }
    }

    // Class (public) methods
    static initialize() {
        Catenis.logger.TRACE('BitcoinInfo initialization');
        // Instantiate BitcoinInfo object
        Catenis.bitcoinInfo = new BitcoinInfo(Catenis.application.cryptoNetwork);
    }

    static getAddressTypeByName(name) {
        const foundKey = Object.keys(BitcoinInfo.addressType).find(key => BitcoinInfo.addressType[key].name === name);

        if (foundKey) {
            return BitcoinInfo.addressType[foundKey];
        }
    }

    static isValidAddressType(addrType) {
        return Object.keys(BitcoinInfo.addressType).some(key => BitcoinInfo.addressType[key] === addrType);
    }

    static getOutputTypeByName(name) {
        const foundKey = Object.keys(BitcoinInfo.outputType).find(key => BitcoinInfo.outputType[key].name === name);

        return foundKey ? BitcoinInfo.outputType[foundKey] : BitcoinInfo.outputType.unknown;
    }

    static getOutputTypeByDescriptor(desc) {
        const matchResult = desc.match(/^\w+\(/);

        if (matchResult) {
            const descPrefix = matchResult[0];

            const foundKey = Object.keys(BitcoinInfo.outputType).find(key => BitcoinInfo.outputType[key].descPrefix === descPrefix);

            if (foundKey) {
                return BitcoinInfo.outputType[foundKey];
            }
        }
    }

    static getOutputTypeByAddressType(addrType) {
        const addrTypeName = typeof addrType === 'string' ? addrType : addrType.name;

        const foundKey = Object.keys(BitcoinInfo.outputType).find(key => BitcoinInfo.outputType[key].addressType === addrTypeName);

        if (foundKey) {
            return BitcoinInfo.outputType[foundKey];
        }
    }
}


// Module functions used to simulate private BitcoinInfo object methods
//  NOTE: these functions need to be bound to a BitcoinInfo object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock class
Object.freeze(BitcoinInfo);
