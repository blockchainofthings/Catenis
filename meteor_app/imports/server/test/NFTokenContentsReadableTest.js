/**
 * Created by claudio on 2022-04-11
 */

//console.log('[NFTokenContentsReadableTest.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import { expect } from 'chai';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from '../Catenis';
import { NFAssetIssuance } from '../NFAssetIssuance';
import { NFTokenContentsReadable } from '../NFTokenContentsReadable';
import { EccLibraryProxy } from '../EccLibraryProxy';
import { Bip32 } from '../Bip32';
import { CryptoKeys } from '../CryptoKeys';

describe('NFTokenContentsReadable module', function () {
    const nfTokenIssuingBatchesData = [
        // Data for batch #1
        [
            {
                metadata: {
                    name: 'Test NFT #1',
                    description: 'Non-fungible token #1 used for testing'
                },
                contents: Buffer.from('NFT #1 contents: one, two, three')
            }
        ],
        // Data for batch #2
        [
            {
                contents: Buffer.from('four, five, six, seven, eight, nine')
            }
        ],
        // Data for batch #3
        [
            {
                contents: Buffer.from('ten, eleven, twelve')
            }
        ],
    ];
    let nfAssetIssuance;

    before(function () {
        EccLibraryProxy.initialize();
        Bip32.initialize();

        nfAssetIssuance = new NFAssetIssuance(
            undefined,
            undefined,
            'd00001',
            {
                name: 'Test NFAsset #1',
                description: 'Non-fungible asset #1 used for testing',
                canReissue: false
            },
            false,
            ['d00002'],
            nfTokenIssuingBatchesData[0],
            false,
            false
        );

        for (let idx = 1, limit = nfTokenIssuingBatchesData.length; idx < limit; idx++) {
            nfAssetIssuance.newNFTokenIssuingBatch(nfTokenIssuingBatchesData[idx], false);
        }

        nfAssetIssuance.newNFTokenIssuingBatch();
    });

    it('should successfully read non-fungible token contents', function (done) {
        const readStream = new NFTokenContentsReadable(nfAssetIssuance, 0);
        let readContents = Buffer.from('');

        readStream.on('data', chunk => {
            readContents = Buffer.concat([readContents, chunk]);
        });

        readStream.on('end', () => {
            expect(readContents).to.deep.equal(
                nfTokenIssuingBatchesData.reduce((contents, batchData) => {
                    return Buffer.concat([contents, batchData[0].contents]);
                }, Buffer.from(''))
            );

            done();
        });

        readStream.on('error', err => {
            done(err);
        });
    });

    it('should successfully read encrypted non-fungible token contents', function (done) {
        const readStream = new NFTokenContentsReadable(nfAssetIssuance, 0);
        const cryptoKeys = new CryptoKeys(Catenis.bip32.fromSeed(Buffer.from('This is only a test')));

        readStream.setEncryption(cryptoKeys);

        let readContents = Buffer.from('');

        readStream.on('data', chunk => {
            readContents = Buffer.concat([readContents, chunk]);
        });

        readStream.on('end', () => {
            const decryptedContents = cryptoKeys.decryptData(readContents);

            expect(decryptedContents).to.deep.equal(
                nfTokenIssuingBatchesData.reduce((contents, batchData) => {
                    return Buffer.concat([contents, batchData[0].contents]);
                }, Buffer.from(''))
            );

            done();
        });

        readStream.on('error', err => {
            done(err);
        });
    });
});
