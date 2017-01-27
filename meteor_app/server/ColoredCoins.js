/**
 * Created by claudio on 18/04/16.
 */

//console.log('[ColoredCoins.js]: This code just ran.');

// Module variables
//
    
// References to external modules

// References to external code
//
// Internal node modules
//  NOTE: the reference of these modules are done sing 'require()' instead of 'import' to
//      to avoid annoying WebStorm warning message: 'default export is not defined in
//      imported module'
const util = require('util');
// Third-party node modules
//import config from 'config';
import ColoredcoinsdWrapper from 'coloredcoinsd-wraper';
//import ccAssetIdEncoder from 'cc-assetid-encoder';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';

// Config entries


// Definition of function classes
//

// ColoredCoins function class
function ColoredCoins(network) {
    this.coloredcoinsd = new ColoredcoinsdWrapper({network: network});

    this.coloredcoinsApi = {
        getIssueAssetTx: Meteor.wrapAsync(this.coloredcoinsd.getIssueAssetTx, this.coloredcoinsd),
        getSendAssetTx: Meteor.wrapAsync(this.coloredcoinsd.getSendAssetTx, this.coloredcoinsd),
        getAddressInfo: Meteor.wrapAsync(this.coloredcoinsd.getAddressInfo, this.coloredcoinsd),
        getStakeHolders: Meteor.wrapAsync(this.coloredcoinsd.getStakeHolders, this.coloredcoinsd),
        getAssetMetadata: Meteor.wrapAsync(this.coloredcoinsd.getAssetMetadata, this.coloredcoinsd),
        getAssetData: Meteor.wrapAsync(this.coloredcoinsd.getAssetData, this.coloredcoinsd)
    };
}


// Public ColoredCoins object methods
//

ColoredCoins.prototype.getIssueAssetTx = function (assetName, addr, amount, reissueable, fee, financeOutput, financeOutputTxid, transfers) {
    const args = {
        issueAddress: addr,
        amount: amount,
        divisibility: 0,
        reissueable: reissueable,
        fee: typeof fee === 'number' ? fee : 1000,
        metadata: {
            assetName: assetName,
            issuer: 'Catenis',
            description: 'Catenis ' + assetName + ' digital asset',
            urls: [
                {name: 'icon',
                 url: 'http://blockchainofthings.com/Catenis_purple_Circle_new_154x154.png',
                 mimeType: 'image/png',
                 dataHash: 'c3d98427cdb40905cfdc4a7d6c86b379af7e6f5cb2b2cd168371aa7e2fd3bbf1'}
            ],
            verifications: {
                signed: {
                    message: 'This is only a test',
                    signed_message: `-----BEGIN CMS-----
MIICIwYJKoZIhvcNAQcCoIICFDCCAhACAQExDTALBglghkgBZQMEAgEwJAYJKoZI
hvcNAQcBoBcEFVRoaXMgaXMgb25seSBhIHRlc3QNCjGCAdQwggHQAgEBMIGqMIGc
MQswCQYDVQQGEwJCUjEXMBUGA1UECBMOUmlvIGRlIEphbmVpcm8xFzAVBgNVBAcT
DlJpbyBkZSBKYW5laXJvMREwDwYDVQQKEwhEZUNhc3RybzEjMCEGA1UEAxMaQ1ND
LU1hY0Jvb2tQcm9SZXRpbmEubG9jYWwxIzAhBgkqhkiG9w0BCQEWFGNsYXVkaW9z
ZGNAZ21haWwuY29tAgkApBbJ00N9aF0wCwYJYIZIAWUDBAIBMA0GCSqGSIb3DQEB
AQUABIIBALgHw1eeHPb5yfDVTNdp7zpW7UhY4WY3XMGRHwNtgafxqrqYdlc3On+1
fIvY/kZjtEpTbHcdIdL6GcRB0Rx/QI4ldqR+1FmtZfoo2f/LZLeXbA2r52MlLZs8
NUmPXX83oPZnW1D9qarLLL0LIN72+dx7dNKD1VvxwKfize5H+gYiJ0UAbUI5Ypxg
QJ+S0FpFiS3rMG5Mr1Q068kcslA/tXC6dS6CGNlhT0KQxlmeP9SO/2GghbwVU5Mg
wKSOz/7Dw5h6mRG1+wE2ctk6W/QxPACura8RKU/helr7vzHgXvPJiNKRZo9Sxh0X
quF+WPJqbUWHud1MMCtsgW8QwBPDinc=
-----END CMS-----`,
                    cert: `-----BEGIN CERTIFICATE-----
MIIDtjCCAp4CCQCkFsnTQ31oXTANBgkqhkiG9w0BAQUFADCBnDELMAkGA1UEBhMC
QlIxFzAVBgNVBAgTDlJpbyBkZSBKYW5laXJvMRcwFQYDVQQHEw5SaW8gZGUgSmFu
ZWlybzERMA8GA1UEChMIRGVDYXN0cm8xIzAhBgNVBAMTGkNTQy1NYWNCb29rUHJv
UmV0aW5hLmxvY2FsMSMwIQYJKoZIhvcNAQkBFhRjbGF1ZGlvc2RjQGdtYWlsLmNv
bTAeFw0xNTA2MDgyMDA5NDVaFw0xNjA2MDcyMDA5NDVaMIGcMQswCQYDVQQGEwJC
UjEXMBUGA1UECBMOUmlvIGRlIEphbmVpcm8xFzAVBgNVBAcTDlJpbyBkZSBKYW5l
aXJvMREwDwYDVQQKEwhEZUNhc3RybzEjMCEGA1UEAxMaQ1NDLU1hY0Jvb2tQcm9S
ZXRpbmEubG9jYWwxIzAhBgkqhkiG9w0BCQEWFGNsYXVkaW9zZGNAZ21haWwuY29t
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAw4GrSbI6mwrrUgpMbkFw
yysA9xzL9D4AL6J24g8Ul6/aG/HNEs7Guh9/PZqBiHtQHp+lvoVYra/FMwHkpA2D
0mVQbwuYkHzzMg6qRmRRfWvDSLvcT+JaTGxIojEKgqGr5sDvP525vG3XsG26Xi30
aYjB5SC/9jdttPSdaNZN8isWOyY0r1DxhoYb52e8zIyURiYf0wWezGtrlrao4qh5
nYT+X2H/6XN53U+KzugAanOsjuMWAu3QD+Q2AP7KWcK+cscLW4Rr37Q77n047McT
dimTJDZ9TDHFoJMIHqZe21GVUct28dYA8DJcyoUhSpH3ZDOl7PoIqG6/xI6s5osC
VwIDAQABMA0GCSqGSIb3DQEBBQUAA4IBAQCs4FYsHCuwiGw7JgMSVYvq4xX1dxY1
DqmmdySZs+qqgXwUcPFpOM1owHhDDGMYLYQeYSBp4a4oylnMee7rf9p+CTR/59aj
9c4WjfPep/HHDfo1bks72vB3Lf1wxwloHoBXA72zhEC3k9+hBBiGyB2JkRV0zI07
lBt3FMf0He7TsuriUsuVjH/gLwkTUoj1ku0p/Ng30Q2PGHVqyo+79wfCi4xntAVV
H05UllG9IzlDTSQ1AnDSD0PnpMI9jWJrnxYEq5IIU62xphU5gIgUhBvDUXrq9Ni7
im8XqNWUxw678ZeqCjcaNuX6ZfvFuO9dD9FREg/VG/fpqptlLvYLQDth
-----END CERTIFICATE-----`
                }
            }
        }
    };

    if (typeof financeOutput === 'object' && typeof financeOutputTxid === 'string') {
        args.financeOutput = financeOutput;
        args.financeOutputTxid = financeOutputTxid;
    }

    if (Array.isArray(transfers)) {
        args.transfer = transfers;
    }

    //return this.coloredcoinsApi.getIssueAssetTx(args);
    return HTTP.call('POST', 'http://testnet.api.coloredcoins.org:80/v3/issue', {data: args, headers: {'content-type': 'application/json'}});
};

ColoredCoins.prototype.getSendAssetTx = function (from, assetTransfers, fee, financeOutput, financeOutputTxid) {
    const args = {
        fee: typeof fee === 'number' ? fee : 1000,
        to: assetTransfers
    };

    if (Array.isArray(from) && from.length > 0 && typeof from[0] == 'string') {
        if (from[0].length < 40) {
            args.from = from;
        }
        else {
            args.sendutxo = from;
        }
    }

    if (typeof financeOutput === 'object' && typeof financeOutputTxid === 'string') {
        args.financeOutput = financeOutput;
        args.financeOutputTxid = financeOutputTxid;
    }

    //return this.coloredcoinsApi.getSendAssetTx(args);
    try {
        return HTTP.call('POST', 'http://testnet.api.coloredcoins.org:80/v3/sendasset', {
            data: args,
            headers: {'content-type': 'application/json'}
        });
    }
    catch (err) {
        console.log('getSendAssetTx exeception: ' + err);
        if (err.response) {
            console.log('   response: ' + util.inspect(err.response, {depth: null}));
        }
    }
};


ColoredCoins.prototype.getAddressInfo = function (addr) {

    return this.coloredcoinsApi.getAddressInfo(addr);
};

// ColoredCoins function class (public) methods
//

ColoredCoins.initialize = function () {
    // Instantiate ColoredCoins object
    Catenis.coloredCoins = new ColoredCoins(Catenis.application.cryptoNetworkName);
};

// DEBUG - begin
ColoredCoins.test = function () {
    const assetId = new Npm.require('cc-assetid-encoder')({
        ccdata: [
            {
                type: 'issuance',
                lockStatus: false
            }
        ],
        vin: [
            {
                txid: 'd5601397b996fad84a1c427f057d4c69528c32836de6be6c3746e9ce24458480',
                vout: 3,
                address: 'msj9FSPBvTChDNSxD1tzyvTkkPdtDVVw33'
            }
        ]
    });
    console.log('Asset ID: ' + assetId);

    try {
        /*var result = Catenis.coloredCoins.getIssueAssetTx('Test CTN asset #4', 'mjwqkfPW6h6yFwg7sJ5KL78Nfgk2Trdcqv', 50, true, 1000, {
         //var result = Catenis.coloredCoins.getIssueAssetTx('Test CTN asset #4', 'msj9FSPBvTChDNSxD1tzyvTkkPdtDVVw33', 50, true, 1000, {
         value: 1000,
         n: 0,
         scriptPubKey: {
         asm: "OP_DUP OP_HASH160 d47bedbbd448fdaa61c4ecd250866f5c6be89800 OP_EQUALVERIFY OP_CHECKSIG",
         hex: "76a914d47bedbbd448fdaa61c4ecd250866f5c6be8980088ac",
         reqSigs: 1,
         type: "pubkeyhash",
         addresses: ["mztU1SD5Faf5EovTrB6xH7aCSdEqqoFAiS"]
         }
         }, 'a9a91edea9c7a08da11e7115c30fc8c5646555ae9ba5faa92658f22de317d4f3', null);*/
        /*            value: 1600,
         n: 0,
         scriptPubKey: {
         asm: "OP_DUP OP_HASH160 85efa548aa97840f2e7f12ee8cf82884bbca3a07 OP_EQUALVERIFY OP_CHECKSIG",
         hex: "76a91485efa548aa97840f2e7f12ee8cf82884bbca3a0788ac",
         reqSigs: 1,
         type: "pubkeyhash",
         addresses: ["msj9FSPBvTChDNSxD1tzyvTkkPdtDVVw33"]
         }
         }, '2553ba05783dc7ad54cc932c94e333b99cdd7941624be83479ae3b1f43773810', null);*/
        /*            value: 3800,
         n: 3,
         scriptPubKey: {
         asm: "OP_DUP OP_HASH160 a17cd6a7aa55b11bf8b67d2bc6f1209ef096f2f5 OP_EQUALVERIFY OP_CHECKSIG",
         hex: "76a914a17cd6a7aa55b11bf8b67d2bc6f1209ef096f2f588ac",
         reqSigs: 1,
         type: "pubkeyhash",
         addresses: ["mvEpdsPAqkVPEacAD6SrYTGxqmujJidB37"]
         }
         }, 'd5601397b996fad84a1c427f057d4c69528c32836de6be6c3746e9ce24458480', [{
         address: 'mjwqkfPW6h6yFwg7sJ5KL78Nfgk2Trdcqv',
         amount: 50
         }]);*/
        //var result = Catenis.coloredCoins.getIssueAssetTx('Test CTN asset #3', 'mvEpdsPAqkVPEacAD6SrYTGxqmujJidB37', 50, false, 2000, {value: 3800, n: 3, scriptPubKey: {asm: "OP_DUP OP_HASH160 a17cd6a7aa55b11bf8b67d2bc6f1209ef096f2f5 OP_EQUALVERIFY OP_CHECKSIG", hex: "76a914a17cd6a7aa55b11bf8b67d2bc6f1209ef096f2f588ac", reqSigs: 1, type: "pubkeyhash", "addresses": ["mvEpdsPAqkVPEacAD6SrYTGxqmujJidB37"]}}, 'd5601397b996fad84a1c427f057d4c69528c32836de6be6c3746e9ce24458480', [{address: 'mvEpdsPAqkVPEacAD6SrYTGxqmujJidB37', amount: 25}, {address: 'mztU1SD5Faf5EovTrB6xH7aCSdEqqoFAiS', amount: 25}]);
        //var result = Catenis.coloredCoins.getIssueAssetTx('Test CTN asset #1', 'mztU1SD5Faf5EovTrB6xH7aCSdEqqoFAiS', 100, false, {value: 10000, n: 9, scriptPubKey: {asm: "OP_DUP OP_HASH160 a17cd6a7aa55b11bf8b67d2bc6f1209ef096f2f5 OP_EQUALVERIFY OP_CHECKSIG", hex: "76a914a17cd6a7aa55b11bf8b67d2bc6f1209ef096f2f588ac", reqSigs: 1, type: "pubkeyhash", "addresses": ["mvEpdsPAqkVPEacAD6SrYTGxqmujJidB37"]}}, '90049532eabb4ede69f76fe69faec396f0480ac0edb3aa83c96da64d27949441');


        const addrInfoResult = Catenis.coloredCoins.getAddressInfo('mztU1SD5Faf5EovTrB6xH7aCSdEqqoFAiS').utxos.filter((utxo) => {
            return utxo.assets.length > 0 && utxo.assets.some((asset) => {
                    return asset.assetId == 'La6sBfG3yRFPogGmSxc4fcfNunLiE1iM3xrAa6';
                });
        });

        const addrInfoResult2 = Catenis.coloredCoins.getAddressInfo('mvEpdsPAqkVPEacAD6SrYTGxqmujJidB37').utxos.filter((utxo) => {
            return utxo.assets.length > 0 && utxo.assets.some((asset) => {
                    return asset.assetId == 'La6sBfG3yRFPogGmSxc4fcfNunLiE1iM3xrAa6';
                });
        });

        console.log('Address info result: ' + util.inspect(addrInfoResult, {showHidden: false, depth: null}));

        console.log('Address info result 2: ' + util.inspect(addrInfoResult2, {showHidden: false, depth: null}));

        const result = Catenis.coloredCoins.getSendAssetTx(['0c05877567c4cfba0fa23adf4db34860ad224e05e75e37a99fc6dfb8f22daea7:0','8aa4f5b378b2ae6d8bbe47f49de818729b8e8bf7ebfc9a159d739bb430393c3a:0'], [{
            address: 'mztU1SD5Faf5EovTrB6xH7aCSdEqqoFAiS',
            amount: 10,
            assetId: 'La6sBfG3yRFPogGmSxc4fcfNunLiE1iM3xrAa6'
        }/*,
         {
         address: 'mztU1SD5Faf5EovTrB6xH7aCSdEqqoFAiS',
         amount: 60,
         assetId: 'La6sBfG3yRFPogGmSxc4fcfNunLiE1iM3xrAa6'
         }*/], 1600, {
            value: 1600,
            n: 0,
            scriptPubKey: {
                asm: "OP_DUP OP_HASH160 d47bedbbd448fdaa61c4ecd250866f5c6be89800 OP_EQUALVERIFY OP_CHECKSIG",
                hex: "76a914d47bedbbd448fdaa61c4ecd250866f5c6be8980088ac",
                reqSigs: 1,
                type: "pubkeyhash",
                addresses: ["mztU1SD5Faf5EovTrB6xH7aCSdEqqoFAiS"]
            }
        }, 'd43edc32e76693e66b04f4e0edaa0f9350c4d7f52a015c49a5a2ea93c7ffd2da');
    }
    catch (err) {
        console.log('Exception: ' + err);
        if (err.statusCode) {
            console.log('  status code: ' + err.statusCode);
        }
        if (err.status) {
            console.log('  status: ' + err.status);
        }
        if (err.message) {
            console.log('  message: ' + err.message);
        }
    }
    console.log('Send asset tx result: ' + util.inspect(result, {depth: null}));
};
// DEBUG - end


// Module code
//

// Save module function class reference
Catenis.module.ColoredCoins = Object.freeze(ColoredCoins);
