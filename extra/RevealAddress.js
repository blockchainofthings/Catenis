const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const bitcoinLib = require('bitcoinjs-lib')

let seedFilename;
let cryptoNetwork;
let appMasterSeed;
let masterHDNode;

revealAddrInit();

function revealAddrInit(environment = 'dev') {
    if (environment === 'dev') {
        seedFilename = 'seed.test2.dat';
        cryptoNetwork = bitcoinLib.networks['regtest'];
    }
    else if (environment === 'sandbox') {
        seedFilename = 'seed.beta2.dat';
        cryptoNetwork = bitcoinLib.networks['testnet'];
    }
    else {
        throw Error('Invalid environment');
    }

    const appSeedPath = path.join(process.env.PWD, seedFilename);
    const encData = fs.readFileSync(appSeedPath, {encoding: 'utf8'});
    appMasterSeed = conformSeed(Buffer.from(encData, 'base64'));
    masterHDNode = bitcoinLib.bip32.fromSeed(appMasterSeed, cryptoNetwork);
}

function conformSeed(data, decrypt = true, master = true) {
    const x = [ 78, 87, 108, 79, 77, 49, 82, 65, 89, 122, 69, 122, 75, 71, 103, 104, 84, 121, 115, 61],
        y = [97, 69, 65, 120, 77, 50, 77, 119, 75, 121, 104, 48, 100, 48, 53, 120, 74, 106, 85, 61],
        cryptoObj = (decrypt ? crypto.createDecipher : crypto.createCipher)('des-ede3-cbc', Buffer.from(Buffer.from(master ? x : y).toString(), 'base64').toString());

    return Buffer.concat([cryptoObj.update(data), cryptoObj.final()]);
}

function addressFromPath(path, isWitness = false) {
    return bitcoinLib.payments[isWitness ? 'p2wpkh' : 'p2pkh']({
        pubkey: masterHDNode.derivePath(path).publicKey,
        network: cryptoNetwork
    }).address;
}
