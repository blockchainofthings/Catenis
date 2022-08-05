/**
 * Created by claudio on 2022-04-19
 */

//console.log('[CCAssetMetadataTest.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import { expect } from 'chai';
import moment from 'moment';
import _und from 'underscore';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from '../Catenis';
import { CCMetadata } from '../CCMetadata';
import { CCAssetMetadata } from '../CCAssetMetadata';
import {
    CCNFTokenMetadata,
} from '../CCNFTokenMetadata';
import { CCSingleNFTokenMetadata } from '../CCSingleNFTokenMetadata';
import { NFTokenContentsUrl } from '../NFTokenContentsUrl';
import { NFAssetIssuance } from '../NFAssetIssuance';
import { EccLibraryProxy } from '../EccLibraryProxy';
import { Bip32 } from '../Bip32';
import { CryptoKeys } from '../CryptoKeys';
import { IpfsClient } from '../IpfsClient';
import { IpfsClusterClient } from '../IpfsClusterClient';


describe('CCMetadata module', function () {
    /**
     * @type {CryptoKeys[]}
     */
    const cryptoKeysList = [];
    /**
     * @type {CCMetadata}
     */
    let ccMetadata;

    before(function () {
        IpfsClient.initialize();
        IpfsClusterClient.initialize();
        EccLibraryProxy.initialize();
        Bip32.initialize();

        const masterCryptoKeys = new CryptoKeys(Catenis.bip32.fromSeed(Buffer.from('This is only a test')));

        for (let idx = 0, limit = 6; idx < limit; idx++) {
            cryptoKeysList.push(new CryptoKeys(masterCryptoKeys.keyPair.derive(idx)));
        }
    });

    it('should successfully instantiate an empty Colored Coins metadata object', function () {
        ccMetadata = new CCMetadata();

        expect(ccMetadata).to.be.an.instanceof(CCMetadata);
        expect(ccMetadata.assetMetadata).to.be.an.instanceof(CCAssetMetadata);
        expect(ccMetadata.nfTokenMetadata).to.be.an.instanceof(CCNFTokenMetadata);
        expect(ccMetadata.isAssembled).to.be.false;
        expect(ccMetadata.isStored).to.be.false;
    });

    it('should report an estimated metadata size of zero if not yet assembled', function () {
        expect(ccMetadata.isAssembled).to.be.false;
        expect(ccMetadata.estimatedSize).to.equal(0);
    });

    it('should correctly assemble Colored Coins metadata', function () {
        // Set up asset metadata
        ccMetadata.assetMetadata.setAssetProperties(
            {
                ctnAssetId: 'a00001',
                name: 'Test NFAsset #1',
                description: 'Non-fungible asset #1 used for testing',
                urls: [
                    {
                        url: 'https://sandbox.catenis.io/logo/Catenis_small.png',
                        label: 'Catenis logo (small)'
                    }
                ]
            }
        );
        ccMetadata.assetMetadata.addUserDataMeta(
            {
                meta1: 'This is a test',
                meta2: 5,
                meta3: true,
                meta4: new Date('2022-04-11'),
                meta5: [
                    'URL',
                    'https://example.com/nothing'
                ],
                meta6: [
                    'Email',
                    'nobody@example.com'
                ]
            }
        );
        ccMetadata.assetMetadata
        .addFreeUserData('free1', 'This is a test')
        .addFreeUserData('free2', 5)
        .addFreeUserData('free3', Buffer.from('Text #1'), true)

        // Set up non-fungible token metadata
        const nfAssetIssuance = new NFAssetIssuance(
            undefined,
            undefined,
            'd00001',
            {
                name: 'Test NFAsset #1',
                description: 'Non-fungible asset #1 used for testing',
                canReissue: false
            },
            true,
            'd00002',
            [
                {
                    metadata: {
                        name: 'Test NFT #1',
                        description: 'Non-fungible token #1 used for testing',
                        custom: {
                            sensitiveProps: {
                                secret1: 'Secret text #1'
                            },
                            custom1: 'Custom property #1'
                        }
                    },
                    contents: Buffer.from('NFT #1 contents: bla, bla, bla')
                },
                {
                    metadata: {
                        name: 'Test NFT #2',
                        description: 'Non-fungible token #2 used for testing',
                        custom: {
                            sensitiveProps: {
                                secret2: 'Secret text #2'
                            },
                            custom2: 'Custom property #2'
                        }
                    },
                    contents: Buffer.from('NFT #2 contents: bla')
                },
            ],
            true,
            false
        );

        const nfTokenMetadataList = [
            new CCSingleNFTokenMetadata(),
            new CCSingleNFTokenMetadata()
        ];

        nfTokenMetadataList[0].setNFTokenProperties({
            name: 'Test NFT #3',
            description: 'Non-fungible token #3 used for testing',
            custom: {
                sensitiveProps: {
                    secret3: 'Secret text #3',
                },
                custom3: 'Custom property #3',
            },
            contents: new NFTokenContentsUrl('QmWHyrPWQnsz1wxHR219ooJDYTvxJPyZuDUPSDpdsAovN5'),
            contentsEncrypted: true
        });
        nfTokenMetadataList[1].setNFTokenProperties({
            name: 'Test NFT #4',
            description: 'Non-fungible token #4 used for testing',
            custom: {
                sensitiveProps: {
                    secret4: 'Secret text #4',
                },
                custom4: 'Custom property #4',
            },
            contents: new NFTokenContentsUrl('QmbWqxBEKC3P8tqsKc98xmWNzrzDtRLMiMPL8wBuTGsMnR'),
            contentsEncrypted: false
        });

        ccMetadata.nfTokenMetadata.fromAssetIssuance(
            nfAssetIssuance,
            [
                cryptoKeysList[1],
                cryptoKeysList[2]
            ]
        );

        // Add single non-fungible token metadata to be updated
        ccMetadata.nfTokenMetadata
        .addNFTokenMetadataToUpdate('tk00003', nfTokenMetadataList[0])
        .addNFTokenMetadataToUpdate('tk00004', nfTokenMetadataList[1]);

        const nfTokenEncCryptoKeys = [];
        nfTokenEncCryptoKeys['tk00003'] = cryptoKeysList[3];
        nfTokenEncCryptoKeys['tk00004'] = cryptoKeysList[4];

        expect(ccMetadata.isAssembled).to.be.false;

        ccMetadata.assemble(cryptoKeysList[0], nfTokenEncCryptoKeys);

        expect(ccMetadata.isAssembled).to.be.true;

        const newTokensContentsURLs = ccMetadata.nfTokenMetadata.newTokens.map(o => o.contentsUrl);

        expect(
            _und.mapObject(ccMetadata.metadata, (value, key) => {
                if (key === 'metadata') {
                    return _und.omit(value, 'verifications');
                }
                else {
                    return value;
                }
            })
        )
        .to.deep.equal(
            {
                metadata: {
                    assetName: 'Test NFAsset #1',
                    issuer: 'Catenis',
                    description: 'Non-fungible asset #1 used for testing',
                    urls: [
                        {
                            name: 'Catenis logo (small)',
                            url: 'https://sandbox.catenis.io/logo/Catenis_small.png',
                            mimeType: 'image/png',
                            dataHash: 'dcde5882af4ee42617e5f9b1ff56d801be25c0c1af7ea8334eb46596616b15b2'
                        },
                        {
                            name: 'icon',
                            url: 'https://sandbox.catenis.io/logo/Catenis_large.png',
                            mimeType: 'image/png',
                            dataHash: '0a5e3d326c0dfd1f87cebdd63fa214faebb9a3d48234a8c7352186985f838261'
                        }
                    ],
                    userData: {
                        meta: [
                            {
                                key: 'meta1',
                                type: 'String',
                                value: 'This is a test'
                            },
                            {
                                key: 'meta2',
                                type: 'Number',
                                value: '5'
                            },
                            {
                                key: 'meta3',
                                type: 'Boolean',
                                value: 'true'
                            },
                            {
                                key: 'meta4',
                                type: 'Date',
                                value: moment(new Date('2022-04-11')).format()
                            },
                            {
                                key: 'meta5',
                                type: 'URL',
                                value: 'https://example.com/nothing'
                            },
                            {
                                key: 'meta6',
                                type: 'Email',
                                value: 'nobody@example.com'

                            },
                            {
                                key: 'ctnAssetId',
                                type: 'String',
                                value: 'a00001'
                            }
                        ],
                        free1: 'This is a test',
                        free2: 5,
                        __enc_free3: cryptoKeysList[0].encryptData(Buffer.from('Text #1')).toString('base64')
                    }
                },
                nfTokenMetadata: {
                    newTokens: [
                        {
                            meta: [
                                {
                                    key: 'name',
                                    type: 'String',
                                    value: 'Test NFT #1'
                                },
                                {
                                    key: 'description',
                                    type: 'String',
                                    value: 'Non-fungible token #1 used for testing'
                                },
                                {
                                    key: 'contentsEncrypted',
                                    type: 'Boolean',
                                    value: 'true'
                                },
                                {
                                    key: 'contents',
                                    type: 'URL',
                                    value: newTokensContentsURLs[0].toString()
                                },
                            ],
                            custom1: 'Custom property #1',
                            __enc_secret1: cryptoKeysList[1].encryptData(Buffer.from(JSON.stringify('Secret text #1'))).toString('base64')
                        },
                        {
                            meta: [
                                {
                                    key: 'name',
                                    type: 'String',
                                    value: 'Test NFT #2'
                                },
                                {
                                    key: 'description',
                                    type: 'String',
                                    value: 'Non-fungible token #2 used for testing'
                                },
                                {
                                    key: 'contentsEncrypted',
                                    type: 'Boolean',
                                    value: 'true'
                                },
                                {
                                    key: 'contents',
                                    type: 'URL',
                                    value: newTokensContentsURLs[1].toString()
                                },
                            ],
                            custom2: 'Custom property #2',
                            __enc_secret2: cryptoKeysList[2].encryptData(Buffer.from(JSON.stringify('Secret text #2'))).toString('base64')
                        }
                    ],
                    update: {
                        tk00003: {
                            meta: [
                                {
                                    key: 'name',
                                    type: 'String',
                                    value: 'Test NFT #3'
                                },
                                {
                                    key: 'description',
                                    type: 'String',
                                    value: 'Non-fungible token #3 used for testing'
                                },
                                {
                                    key: 'contentsEncrypted',
                                    type: 'Boolean',
                                    value: 'true'
                                },
                                {
                                    key: 'contents',
                                    type: 'URL',
                                    value: new NFTokenContentsUrl('QmWHyrPWQnsz1wxHR219ooJDYTvxJPyZuDUPSDpdsAovN5').toString()
                                },
                            ],
                            custom3: 'Custom property #3',
                            __enc_secret3: cryptoKeysList[3].encryptData(Buffer.from(JSON.stringify('Secret text #3'))).toString('base64')
                        },
                        tk00004: {
                            meta: [
                                {
                                    key: 'name',
                                    type: 'String',
                                    value: 'Test NFT #4'
                                },
                                {
                                    key: 'description',
                                    type: 'String',
                                    value: 'Non-fungible token #4 used for testing'
                                },
                                {
                                    key: 'contentsEncrypted',
                                    type: 'Boolean',
                                    value: 'false'
                                },
                                {
                                    key: 'contents',
                                    type: 'URL',
                                    value: new NFTokenContentsUrl('QmbWqxBEKC3P8tqsKc98xmWNzrzDtRLMiMPL8wBuTGsMnR').toString()
                                },
                            ],
                            custom4: 'Custom property #4',
                            __enc_secret4: cryptoKeysList[4].encryptData(Buffer.from(JSON.stringify('Secret text #4'))).toString('base64')
                        },
                    }
                }
            }
        );
        expect(ccMetadata.metadata.metadata.verifications).to.be.an('object').with.all.keys('signed');
        expect(ccMetadata.metadata.metadata.verifications.signed).to.be.an('object').that.have.all.keys(
            [
                'message',
                'signed_message',
                'cert'
            ]
        );
        expect(ccMetadata.metadata.metadata.verifications.signed.message).to.match(/^Catenis generated asset on (.+)$/);
        expect(ccMetadata.metadata.metadata.verifications.signed.signed_message).to.match(/^-----BEGIN CMS-----\n/);
        expect(ccMetadata.metadata.metadata.verifications.signed.cert).to.match(/^-----BEGIN CERTIFICATE-----\n/);
    });

    it('should correctly estimate the metadata size', function () {
        expect(ccMetadata.isAssembled).to.be.true;
        expect(ccMetadata.estimatedSize).to.equal(Buffer.from(JSON.stringify(ccMetadata.metadata)).length);
    });

    it('should correctly clone Colored Coins metadata object', function () {
        expect(ccMetadata.clone()).to.be.an.instanceof(CCMetadata).that.deep.equals(ccMetadata);
    });

    it('should correctly instantiate Colored Coins metadata object from assembled metadata', function () {
        expect(ccMetadata.isAssembled).to.be.true;

        const nfTokenDecCryptoKeys = [
            cryptoKeysList[1],
            cryptoKeysList[2]
        ];
        nfTokenDecCryptoKeys['tk00003'] = cryptoKeysList[3];
        nfTokenDecCryptoKeys['tk00004'] = cryptoKeysList[4];

        const ccMetadata2 = new CCMetadata(
            ccMetadata.metadata,
            cryptoKeysList[0],
            nfTokenDecCryptoKeys
        );

        expect(ccMetadata2)
        .to.deep.equal(
            _und.mapObject(ccMetadata, (value, key) => {
                if (key === 'assetMetadata') {
                    return _und.omit(value, 'signingCertificate');
                }
                else if (key === 'nfTokenMetadata') {
                    return _und.omit(value, '_fromAssetIssuance');
                }
                else {
                    return value;
                }
            })
        );
    });

    it('should successfully store assembled metadata (without a progress callback)', function () {
        expect(ccMetadata.isStored).to.be.false;

        ccMetadata.store();

        expect(ccMetadata.isStored).to.be.true;
        expect(ccMetadata.storeResult).to.be.an('object').that.has.all.keys(
            [
                'cid'
            ]
        );
        expect(ccMetadata.storeResult.cid).to.be.a('string').that.matches(/^[0-9a-f]{68}$/);
    });

    it('should successfully store assembled metadata with a progress callback', function () {
        // Simulate that metadata is not yet stored
        ccMetadata.storeResult = undefined;

        expect(ccMetadata.isStored).to.be.false;

        const progress = {
            callCount: 0,
            bytesStored: 0
        };

        ccMetadata.store((bytesStored) => {
            progress.callCount++;
            progress.bytesStored = bytesStored;
        });

        expect(ccMetadata.isStored).to.be.true;
        expect(ccMetadata.storeResult).to.be.an('object').that.has.all.keys(
            [
                'cid'
            ]
        );
        expect(ccMetadata.storeResult.cid).to.be.a('string').that.matches(/^[0-9a-f]{68}$/);

        expect(progress.callCount).to.be.greaterThan(0);
        expect(progress.bytesStored).to.equal(Buffer.from(JSON.stringify(ccMetadata.metadata)).length);
    });

    it('should successfully retrieve stored metadata', function () {
        expect(ccMetadata.isStored).to.be.true;

        const nfTokenDecCryptoKeys = [
            cryptoKeysList[1],
            cryptoKeysList[2]
        ];
        nfTokenDecCryptoKeys['tk00003'] = cryptoKeysList[3];
        nfTokenDecCryptoKeys['tk00004'] = cryptoKeysList[4];

        const ccMetadata2 = CCMetadata.fromCID(
            Buffer.from(ccMetadata.storeResult.cid, 'hex'),
            cryptoKeysList[0],
            nfTokenDecCryptoKeys
        );

        expect(ccMetadata2)
        .to.deep.equal(
            _und.mapObject(ccMetadata, (value, key) => {
                if (key === 'assetMetadata') {
                    return _und.omit(value, 'signingCertificate');
                }
                else if (key === 'nfTokenMetadata') {
                    return _und.omit(value, '_fromAssetIssuance');
                }
                else {
                    return value;
                }
            })
        );
    });

    it('should correctly reset the Colored Coins metadata object', function () {
        expect(ccMetadata.isAssembled).to.be.true;
        expect(ccMetadata.isStored).to.be.true;

        ccMetadata.reset();

        expect(ccMetadata.isAssembled).to.be.false;
        expect(ccMetadata.isStored).to.be.false;
    });

    it('should successfully check if stored metadata has been converted', function () {
        const torrentHash = '09f59a2809d8578902c70923896a8420987f54b2';
        const cid = '122013f06bc5f1192cb5f9005611cb0dcb2f602446f43752385f8b7a2e195cd25642';

        // Preparations
        Catenis.db.collection.CCMetadataConversion.insert({
            torrentHash,
            cid,
            createdDate: new Date()
        });

        expect(CCMetadata.checkCIDConverted(torrentHash)).to.deep.equal(Buffer.from(cid, 'hex'));
        expect(CCMetadata.checkCIDConverted('invalid_hash')).to.be.undefined;
    });
});
