// Helper module used to show the Catenis bitcoin address associated to an HD path
//  for a given environment
//
// Usage:
//  . start Node.js REPL and load this file (.load <path-to-this-file>)
//  . call the revealAddrInit() function passing the password and environment
//  . then call the addressFromPath() function as many times as needed

const ecc = require('tiny-secp256k1_2');
const BIP32Factory = require('bip32').default;
const bitcoinLib = require('bitcoinjs-lib');
const CatenisCipher = require('catenis-cipher');

const bip32 = BIP32Factory(ecc);

let cryptoNetwork;
let appMasterSeed;
let masterHDNode;

function revealAddrInit(password, environment = 'dev') {
    let cipheredSeed;

    switch (environment) {
        case 'dev':
            cipheredSeed = 'xxSeY1rSHtXifVbYQT8G/MhpNjhmYmsVjf8c74VMUDxO5kwbTZHR9RwVZxJhLW5toglCfA9xNEqoA+cFkHmGfQ==';
            cryptoNetwork = bitcoinLib.networks['regtest'];
            break;

        case 'sandbox':
            cipheredSeed = '6MeMQss0K8Z8GtrFXBZVh7DKsUxSxoGdn9aG18K1v6TXRRw6iKfk2coemsx7dMjgfzFWIOqxB0UUUHWdq1cPig==';
            cryptoNetwork = bitcoinLib.networks['testnet'];
            break;

        case 'prod':
            cipheredSeed = 'SV9DTzGYj1RyBwgDr55C9HGkNF5D6V4QZL01pQN9teSyGBGZmBU/AD+FYK8PCkADHb23YQxbdEl3lV5+GNl7ZQ==';
            cryptoNetwork = bitcoinLib.networks['bitcoin'];
            break;

        default:
            throw Error('Invalid environment');
    }

    appMasterSeed = new CatenisCipher().genCipherFunctions(password).decipher(cipheredSeed);
    masterHDNode = bip32.fromSeed(appMasterSeed, cryptoNetwork);
}

function addressFromPath(path, isWitness = false) {
    return bitcoinLib.payments[isWitness ? 'p2wpkh' : 'p2pkh']({
        pubkey: masterHDNode.derivePath(path).publicKey,
        network: cryptoNetwork
    }).address;
}
