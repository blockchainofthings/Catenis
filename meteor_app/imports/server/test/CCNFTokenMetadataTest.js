/**
 * Created by claudio on 2022-04-13
 */

//console.log('[CCNFTokenMetadataTest.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import { expect } from 'chai';
import _und from 'underscore';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from '../Catenis';
import {
    CCNFTokenMetadata,
    CryptoKeysSet
} from '../CCNFTokenMetadata';
import { CCSingleNFTokenMetadata } from '../CCSingleNFTokenMetadata';
import { NFTokenContentsUrl } from '../NFTokenContentsUrl';
import { NFAssetIssuance } from '../NFAssetIssuance';
import { EccLibraryProxy } from '../EccLibraryProxy';
import { Bip32 } from '../Bip32';
import { CryptoKeys } from '../CryptoKeys';
import { IpfsClient } from '../IpfsClient';
import { IpfsClusterClient } from '../IpfsClusterClient';


describe('CCNFTokenMetadata module', function () {
    /**
     * @type {CryptoKeys[]}
     */
    const cryptoKeysList = [];

    before(function () {
        this.timeout(5000);

        IpfsClient.initialize();
        IpfsClusterClient.initialize();
        EccLibraryProxy.initialize();
        Bip32.initialize();

        const masterCryptoKeys = new CryptoKeys(Catenis.bip32.fromSeed(Buffer.from('This is only a test')));

        for (let idx = 0, limit = 6; idx < limit; idx++) {
            cryptoKeysList.push(new CryptoKeys(masterCryptoKeys.keyPair.derive(idx)));
        }
    });

    describe('CryptoKeysSet class', function () {
        describe('Single key (new tokens wildcard)', function () {
            /**
             * @type {CryptoKeys}
             */
            let singleCryptoKeys;
            /**
             * @type {CryptoKeysSet}
             */
            let cryptoKeysSet;

            before(function () {
                singleCryptoKeys = cryptoKeysList[0];
            });

            it('should correctly create a new CryptoKeysSet instance', function () {
                cryptoKeysSet = new CryptoKeysSet(singleCryptoKeys);

                expect(cryptoKeysSet.newTokensWildcard).to.equal(singleCryptoKeys);
                expect(cryptoKeysSet.updateWildcard).to.be.undefined;
                expect(cryptoKeysSet.listCryptoKeys).to.be.undefined;
                expect(cryptoKeysSet.index).to.equal(-1);
            });

            it('should correctly iterate through new keys', function () {
                expect(cryptoKeysSet.next()).to.equal(singleCryptoKeys);
                expect(cryptoKeysSet.next()).to.equal(singleCryptoKeys);

                cryptoKeysSet.rewind();
                expect(cryptoKeysSet.index).to.equal(-1);
            });

            it('should correctly retrieve keys (by index)', function () {
                expect(cryptoKeysSet.get(0)).to.equal(singleCryptoKeys);
                expect(cryptoKeysSet.get(1)).to.equal(singleCryptoKeys);
                expect(cryptoKeysSet.get(-1)).to.equal(singleCryptoKeys);
            });

            it('should correctly retrieve keys (by token ID)', function () {
                expect(cryptoKeysSet.get('tk00001')).to.be.undefined
                expect(cryptoKeysSet.get('tk00002')).to.be.undefined
                expect(cryptoKeysSet.get('*')).to.be.undefined
            });
        });

        describe('Multiple keys (no wildcards)', function () {
            let testCryptoKeys;
            let cryptoKeysSet;

            before(function () {
                testCryptoKeys = [
                    cryptoKeysList[0],
                    cryptoKeysList[1],
                ];
                testCryptoKeys['tk00001'] = cryptoKeysList[2];
                testCryptoKeys['tk00002'] = cryptoKeysList[3];
            });

            it('should correctly create a new CryptoKeysSet instance', function () {
                cryptoKeysSet = new CryptoKeysSet(testCryptoKeys);

                expect(cryptoKeysSet.newTokensWildcard).to.be.undefined;
                expect(cryptoKeysSet.updateWildcard).to.be.undefined;
                expect(cryptoKeysSet.listCryptoKeys).to.equal(testCryptoKeys);
                expect(cryptoKeysSet.index).to.equal(-1);
            });

            it('should correctly iterate through new keys', function () {
                expect(cryptoKeysSet.next()).to.equal(testCryptoKeys[0]);
                expect(cryptoKeysSet.next()).to.equal(testCryptoKeys[1]);
                expect(cryptoKeysSet.next()).to.be.undefined

                cryptoKeysSet.rewind();
                expect(cryptoKeysSet.index).to.equal(-1);
            });

            it('should correctly retrieve keys (by index)', function () {
                expect(cryptoKeysSet.get(0)).to.equal(testCryptoKeys[0]);
                expect(cryptoKeysSet.get(1)).to.equal(testCryptoKeys[1]);
                expect(cryptoKeysSet.get(2)).to.be.undefined;
                expect(cryptoKeysSet.get(-1)).to.be.undefined;
            });

            it('should correctly retrieve keys (by token ID)', function () {
                expect(cryptoKeysSet.get('tk00001')).to.equal(testCryptoKeys['tk00001']);
                expect(cryptoKeysSet.get('tk00002')).to.equal(testCryptoKeys['tk00002']);
                expect(cryptoKeysSet.get('tk00003')).to.be.undefined;
                expect(cryptoKeysSet.get('*')).to.be.undefined;
            });
        });

        describe('Multiple keys (new tokens wildcard)', function () {
            let testCryptoKeys;
            let newTokensWildcard;
            let cryptoKeysSet;

            before(function () {
                testCryptoKeys = [
                    cryptoKeysList[0],
                    cryptoKeysList[1],
                ];
                testCryptoKeys[-1] = newTokensWildcard = cryptoKeysList[4];
                testCryptoKeys['tk00001'] = cryptoKeysList[2];
                testCryptoKeys['tk00002'] = cryptoKeysList[3];
            });

            it('should correctly create a new CryptoKeysSet instance', function () {
                cryptoKeysSet = new CryptoKeysSet(testCryptoKeys);

                expect(cryptoKeysSet.newTokensWildcard).to.equal(newTokensWildcard);
                expect(cryptoKeysSet.updateWildcard).to.be.undefined;
                expect(cryptoKeysSet.listCryptoKeys).to.equal(testCryptoKeys);
                expect(cryptoKeysSet.index).to.equal(-1);
            });

            it('should correctly iterate through new keys', function () {
                expect(cryptoKeysSet.next()).to.equal(testCryptoKeys[0]);
                expect(cryptoKeysSet.next()).to.equal(testCryptoKeys[1]);
                expect(cryptoKeysSet.next()).to.equal(newTokensWildcard);

                cryptoKeysSet.rewind();
                expect(cryptoKeysSet.index).to.equal(-1);
            });

            it('should correctly retrieve keys (by index)', function () {
                expect(cryptoKeysSet.get(0)).to.equal(testCryptoKeys[0]);
                expect(cryptoKeysSet.get(1)).to.equal(testCryptoKeys[1]);
                expect(cryptoKeysSet.get(2)).to.equal(newTokensWildcard);
                expect(cryptoKeysSet.get(-1)).to.equal(newTokensWildcard);
            });

            it('should correctly retrieve keys (by token ID)', function () {
                expect(cryptoKeysSet.get('tk00001')).to.equal(testCryptoKeys['tk00001']);
                expect(cryptoKeysSet.get('tk00002')).to.equal(testCryptoKeys['tk00002']);
                expect(cryptoKeysSet.get('tk00003')).to.be.undefined;
                expect(cryptoKeysSet.get('*')).to.be.undefined;
            });
        });

        describe('Multiple keys (update wildcard)', function () {
            let testCryptoKeys;
            let updateWildcard;
            let cryptoKeysSet;

            before(function () {
                testCryptoKeys = [
                    cryptoKeysList[0],
                    cryptoKeysList[1],
                ];
                testCryptoKeys['tk00001'] = cryptoKeysList[2];
                testCryptoKeys['tk00002'] = cryptoKeysList[3];
                testCryptoKeys['*'] = updateWildcard = cryptoKeysList[5];
            });

            it('should correctly create a new CryptoKeysSet instance', function () {
                cryptoKeysSet = new CryptoKeysSet(testCryptoKeys);

                expect(cryptoKeysSet.newTokensWildcard).to.be.undefined;
                expect(cryptoKeysSet.updateWildcard).to.equal(updateWildcard);
                expect(cryptoKeysSet.listCryptoKeys).to.equal(testCryptoKeys);
                expect(cryptoKeysSet.index).to.equal(-1);
            });

            it('should correctly iterate through new keys', function () {
                expect(cryptoKeysSet.next()).to.equal(testCryptoKeys[0]);
                expect(cryptoKeysSet.next()).to.equal(testCryptoKeys[1]);
                expect(cryptoKeysSet.next()).to.be.undefined;

                cryptoKeysSet.rewind();
                expect(cryptoKeysSet.index).to.equal(-1);
            });

            it('should correctly retrieve keys (by index)', function () {
                expect(cryptoKeysSet.get(0)).to.equal(testCryptoKeys[0]);
                expect(cryptoKeysSet.get(1)).to.equal(testCryptoKeys[1]);
                expect(cryptoKeysSet.get(2)).to.be.undefined;
                expect(cryptoKeysSet.get(-1)).to.be.undefined;
            });

            it('should correctly retrieve keys (by token ID)', function () {
                expect(cryptoKeysSet.get('tk00001')).to.equal(testCryptoKeys['tk00001']);
                expect(cryptoKeysSet.get('tk00002')).to.equal(testCryptoKeys['tk00002']);
                expect(cryptoKeysSet.get('tk00003')).to.equal(updateWildcard);
                expect(cryptoKeysSet.get('*')).to.equal(updateWildcard);
            });
        });

        describe('Multiple keys (both wildcards)', function () {
            let testCryptoKeys;
            let newTokensWildcard;
            let updateWildcard;
            let cryptoKeysSet;

            before(function () {
                testCryptoKeys = [
                    cryptoKeysList[0],
                    cryptoKeysList[1],
                ];
                testCryptoKeys[-1] = newTokensWildcard = cryptoKeysList[4];
                testCryptoKeys['tk00001'] = cryptoKeysList[2];
                testCryptoKeys['tk00002'] = cryptoKeysList[3];
                testCryptoKeys['*'] = updateWildcard = cryptoKeysList[5];
            });

            it('should correctly create a new CryptoKeysSet instance', function () {
                cryptoKeysSet = new CryptoKeysSet(testCryptoKeys);

                expect(cryptoKeysSet.newTokensWildcard).to.equal(newTokensWildcard);
                expect(cryptoKeysSet.updateWildcard).to.equal(updateWildcard);
                expect(cryptoKeysSet.listCryptoKeys).to.equal(testCryptoKeys);
                expect(cryptoKeysSet.index).to.equal(-1);
            });

            it('should correctly iterate through new keys', function () {
                expect(cryptoKeysSet.next()).to.equal(testCryptoKeys[0]);
                expect(cryptoKeysSet.next()).to.equal(testCryptoKeys[1]);
                expect(cryptoKeysSet.next()).to.equal(newTokensWildcard);

                cryptoKeysSet.rewind();
                expect(cryptoKeysSet.index).to.equal(-1);
            });

            it('should correctly retrieve keys (by index)', function () {
                expect(cryptoKeysSet.get(0)).to.equal(testCryptoKeys[0]);
                expect(cryptoKeysSet.get(1)).to.equal(testCryptoKeys[1]);
                expect(cryptoKeysSet.get(2)).to.equal(newTokensWildcard);
                expect(cryptoKeysSet.get(-1)).to.equal(newTokensWildcard);
            });

            it('should correctly retrieve keys (by token ID)', function () {
                expect(cryptoKeysSet.get('tk00001')).to.equal(testCryptoKeys['tk00001']);
                expect(cryptoKeysSet.get('tk00002')).to.equal(testCryptoKeys['tk00002']);
                expect(cryptoKeysSet.get('tk00003')).to.equal(updateWildcard);
                expect(cryptoKeysSet.get('*')).to.equal(updateWildcard);
            });
        });

        describe('No keys', function () {
            let cryptoKeysSet;

            it('should correctly create a new CryptoKeysSet instance', function () {
                cryptoKeysSet = new CryptoKeysSet();

                expect(cryptoKeysSet.newTokensWildcard).to.be.undefined;
                expect(cryptoKeysSet.updateWildcard).to.be.undefined;
                expect(cryptoKeysSet.listCryptoKeys).to.be.undefined;
                expect(cryptoKeysSet.index).to.equal(-1);
            });

            it('should correctly iterate through new keys', function () {
                expect(cryptoKeysSet.next()).to.be.undefined;

                cryptoKeysSet.rewind();
                expect(cryptoKeysSet.index).to.equal(-1);
            });

            it('should correctly retrieve keys (by index)', function () {
                expect(cryptoKeysSet.get(0)).to.be.undefined;
                expect(cryptoKeysSet.get(-1)).to.be.undefined;
            });

            it('should correctly retrieve keys (by token ID)', function () {
                expect(cryptoKeysSet.get('tk00001')).to.be.undefined;
                expect(cryptoKeysSet.get('*')).to.be.undefined;
            });
        });
    });

    describe('CCNFTokenMetadata class', function () {
        describe('New tokens (two, no shared contents, no encrypted contents)', function () {
            /**
             * @type {NFAssetIssuance}
             */
            let nfAssetIssuance;
            /**
             * @type {CCNFTokenMetadata}
             */
            let nfTokenMetadata;
            /**
             * @type {CCMetaNonFungibleToken}
             */
            let assembledNFTokenMetadata;

            before(function () {
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
                    false,
                    false
                );
            });

            it('should correctly instantiate an empty non-fungible token metadata object', function () {
                nfTokenMetadata = new CCNFTokenMetadata();

                expect(nfTokenMetadata).to.be.an.instanceof(CCNFTokenMetadata);
                expect(nfTokenMetadata.newTokens).to.be.an('array').that.is.empty;
                expect(nfTokenMetadata.update).to.be.undefined;
                expect(nfTokenMetadata._fromAssetIssuance).to.be.undefined;
            });

            it('should fail assigning asset issuance with invalid params (nfAssetIssuance)', function () {
                expect(() => {
                    nfTokenMetadata.fromAssetIssuance({});
                }).to.throw('Invalid nfAssetIssuance argument');
            });

            it('should fail assigning asset issuance with invalid params (encCryptoKeys)', function () {
                expect(() => {
                    nfTokenMetadata.fromAssetIssuance(nfAssetIssuance, {});
                }).to.throw('Invalid encCryptoKeys argument');
            });

            it('should successfully assign asset issuance', function () {
                nfTokenMetadata.fromAssetIssuance(
                    nfAssetIssuance,
                    [
                        cryptoKeysList[0],
                        cryptoKeysList[1]
                    ]
                );

                expect(nfTokenMetadata._fromAssetIssuance).to.deep.equal({
                    nfAssetIssuance,
                    encCryptoKeysSet: new CryptoKeysSet([
                        cryptoKeysList[0],
                        cryptoKeysList[1]
                    ])
                });
            });

            it('should fail to assemble non-fungible token metadata', function () {
                expect(() => {
                    nfTokenMetadata.assemble();
                })
                .to.throw('Error while getting non-fungible token metadata from non-fungible asset issuance: Error: Unable to get list of non-fungible tokens with contents: non-fungible asset issuance data not yet complete');
            });

            it('should correctly assemble non-fungible token metadata', function () {
                // Finalize non-fungible asset issuance first
                nfAssetIssuance.newNFTokenIssuingBatch();

                assembledNFTokenMetadata = nfTokenMetadata.assemble();

                expect(assembledNFTokenMetadata).to.not.be.undefined;

                expect(nfTokenMetadata.newTokens).to.have.lengthOf(2);

                const newTokensContentsURLs = nfTokenMetadata.newTokens.map(o => o.contentsUrl);

                expect(
                    Catenis.ipfsClient.cat(newTokensContentsURLs[0].cid),
                    'Non-fungible token #1 contents'
                )
                .to.deep.equal(Buffer.from('NFT #1 contents: bla, bla, bla'));
                expect(
                    Catenis.ipfsClient.cat(newTokensContentsURLs[1].cid),
                    'Non-fungible token #2 contents'
                )
                .to.deep.equal(Buffer.from('NFT #2 contents: bla'));

                expect(assembledNFTokenMetadata).to.deep.equal({
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
                                    value: 'false'
                                },
                                {
                                    key: 'contents',
                                    type: 'URL',
                                    value: newTokensContentsURLs[0].toString()
                                },
                            ],
                            custom1: 'Custom property #1',
                            __enc_secret1: cryptoKeysList[0].encryptData(Buffer.from(JSON.stringify('Secret text #1'))).toString('base64')
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
                                    value: 'false'
                                },
                                {
                                    key: 'contents',
                                    type: 'URL',
                                    value: newTokensContentsURLs[1].toString()
                                },
                            ],
                            custom2: 'Custom property #2',
                            __enc_secret2: cryptoKeysList[1].encryptData(Buffer.from(JSON.stringify('Secret text #2'))).toString('base64')
                        }
                    ]
                });
            });

            it('should correctly clone non-fungible token metadata object', function () {
                expect(nfTokenMetadata.clone()).to.be.an.instanceof(CCNFTokenMetadata).and.deep.equal(nfTokenMetadata);
            });

            it('should correctly instantiate non-fungible token metadata object from assembled data', function () {
                expect(new CCNFTokenMetadata(
                    assembledNFTokenMetadata,
                    [
                        cryptoKeysList[0],
                        cryptoKeysList[1]
                    ]
                ))
                .to.deep.equal(
                    _und.omit(nfTokenMetadata, '_fromAssetIssuance')
                );
            });
        });

        describe('New tokens (two, no shared contents, encrypted contents)', function () {
            /**
             * @type {NFAssetIssuance}
             */
            let nfAssetIssuance;
            /**
             * @type {CCNFTokenMetadata}
             */
            let nfTokenMetadata;
            /**
             * @type {CCMetaNonFungibleToken}
             */
            let assembledNFTokenMetadata;

            before(function () {
                nfAssetIssuance = new NFAssetIssuance(
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
            });

            it('should correctly assemble non-fungible token metadata', function () {
                // Instantiate object
                nfTokenMetadata = new CCNFTokenMetadata();

                // Assign non-fungible asset issuance
                nfTokenMetadata.fromAssetIssuance(
                    nfAssetIssuance,
                    [
                        cryptoKeysList[0],
                        cryptoKeysList[1]
                    ]
                );

                assembledNFTokenMetadata = nfTokenMetadata.assemble();

                expect(assembledNFTokenMetadata).to.not.be.undefined;

                expect(nfTokenMetadata.newTokens).to.have.lengthOf(2);

                const newTokensContentsURLs = nfTokenMetadata.newTokens.map(o => o.contentsUrl);

                expect(
                    cryptoKeysList[0].decryptData(Catenis.ipfsClient.cat(newTokensContentsURLs[0].cid)),
                    'Non-fungible token #1 contents'
                )
                .to.deep.equal(Buffer.from('NFT #1 contents: bla, bla, bla'));
                expect(
                    cryptoKeysList[1].decryptData(Catenis.ipfsClient.cat(newTokensContentsURLs[1].cid)),
                    'Non-fungible token #2 contents'
                )
                .to.deep.equal(Buffer.from('NFT #2 contents: bla'));

                expect(assembledNFTokenMetadata).to.deep.equal({
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
                            __enc_secret1: cryptoKeysList[0].encryptData(Buffer.from(JSON.stringify('Secret text #1'))).toString('base64')
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
                            __enc_secret2: cryptoKeysList[1].encryptData(Buffer.from(JSON.stringify('Secret text #2'))).toString('base64')
                        }
                    ]
                });
            });

            it('should correctly clone non-fungible token metadata object', function () {
                expect(nfTokenMetadata.clone()).to.be.an.instanceof(CCNFTokenMetadata).and.deep.equal(nfTokenMetadata);
            });

            it('should correctly instantiate non-fungible token metadata object from assembled data', function () {
                expect(new CCNFTokenMetadata(
                    assembledNFTokenMetadata,
                    [
                        cryptoKeysList[0],
                        cryptoKeysList[1]
                    ]
                ))
                .to.deep.equal(
                    _und.omit(nfTokenMetadata, '_fromAssetIssuance')
                );
            });
        });

        describe('New tokens (two, shared contents, encrypted contents)', function () {
            /**
             * @type {NFAssetIssuance}
             */
            let nfAssetIssuance;
            /**
             * @type {CCNFTokenMetadata}
             */
            let nfTokenMetadata;
            /**
             * @type {CCMetaNonFungibleToken}
             */
            let assembledNFTokenMetadata;

            before(function () {
                nfAssetIssuance = new NFAssetIssuance(
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
                        },
                    ],
                    true,
                    false
                );
            });

            it('should correctly assemble non-fungible token metadata', function () {
                // Instantiate object
                nfTokenMetadata = new CCNFTokenMetadata();

                // Assign non-fungible asset issuance
                nfTokenMetadata.fromAssetIssuance(nfAssetIssuance, cryptoKeysList[0]);

                assembledNFTokenMetadata = nfTokenMetadata.assemble();

                expect(assembledNFTokenMetadata).to.not.be.undefined;

                expect(nfTokenMetadata.newTokens).to.have.lengthOf(2);

                const newTokensContentsURLs = nfTokenMetadata.newTokens.map(o => o.contentsUrl);

                expect(
                    cryptoKeysList[0].decryptData(Catenis.ipfsClient.cat(newTokensContentsURLs[0].cid)),
                    'Non-fungible token #1 contents'
                )
                .to.deep.equal(Buffer.from('NFT #1 contents: bla, bla, bla'));
                expect(newTokensContentsURLs[0]).to.deep.equal(newTokensContentsURLs[1]);

                expect(assembledNFTokenMetadata).to.deep.equal({
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
                            __enc_secret1: cryptoKeysList[0].encryptData(Buffer.from(JSON.stringify('Secret text #1'))).toString('base64')
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
                            __enc_secret2: cryptoKeysList[0].encryptData(Buffer.from(JSON.stringify('Secret text #2'))).toString('base64')
                        }
                    ]
                });
            });

            it('should correctly clone non-fungible token metadata object', function () {
                expect(nfTokenMetadata.clone()).to.be.an.instanceof(CCNFTokenMetadata).and.deep.equal(nfTokenMetadata);
            });

            it('should correctly instantiate non-fungible token metadata object from assembled data', function () {
                expect(new CCNFTokenMetadata(
                    assembledNFTokenMetadata,
                    cryptoKeysList[0]
                ))
                .to.deep.equal(
                    _und.omit(nfTokenMetadata, '_fromAssetIssuance')
                );
            });
        });

        describe('Update only', function () {
            /**
             * @type {CCSingleNFTokenMetadata[]}
             */
            let nfTokenMetadataList;
            /**
             * @type {CCNFTokenMetadata}
             */
            let nfTokenMetadata;
            /**
             * @type {CCMetaNonFungibleToken}
             */
            let assembledNFTokenMetadata;

            before(function () {
                nfTokenMetadataList = [
                    new CCSingleNFTokenMetadata(),
                    new CCSingleNFTokenMetadata()
                ];

                nfTokenMetadataList[0].setNFTokenProperties({
                    name: 'Test NFT #1',
                    description: 'Non-fungible token #1 used for testing',
                    custom: {
                        sensitiveProps: {
                            secret1: 'Secret text #1',
                        },
                        custom1: 'Custom property #1',
                    },
                    contents: new NFTokenContentsUrl('QmUkhVi6zRJz5U87jUjK9ZGTazaXLDKLfGbMRHxiai5xUn'),
                    contentsEncrypted: true
                });
                nfTokenMetadataList[1].setNFTokenProperties({
                    name: 'Test NFT #2',
                    description: 'Non-fungible token #2 used for testing',
                    custom: {
                        sensitiveProps: {
                            secret1: 'Secret text #2',
                        },
                        custom1: 'Custom property #2',
                    },
                    contents: new NFTokenContentsUrl('QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG'),
                    contentsEncrypted: false
                });
            });

            it('should correctly assemble non-fungible token metadata', function () {
                // Instantiate object
                nfTokenMetadata = new CCNFTokenMetadata();

                // Add single non-fungible token metadata to be updated
                nfTokenMetadata
                .addNFTokenMetadataToUpdate('tk00001', nfTokenMetadataList[0])
                .addNFTokenMetadataToUpdate('tk00002', nfTokenMetadataList[1]);

                expect(nfTokenMetadata.update).to.an('object').and.to.have.all.keys(['tk00001', 'tk00002']);

                const encCryptoKeys = [];
                encCryptoKeys['tk00001'] = cryptoKeysList[0];
                encCryptoKeys['tk00002'] = cryptoKeysList[1];

                assembledNFTokenMetadata = nfTokenMetadata.assemble(encCryptoKeys);

                expect(assembledNFTokenMetadata).to.not.be.undefined;
                expect(assembledNFTokenMetadata).to.deep.equal({
                    update: {
                        tk00001: {
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
                                    value: new NFTokenContentsUrl('QmUkhVi6zRJz5U87jUjK9ZGTazaXLDKLfGbMRHxiai5xUn').toString()
                                },
                            ],
                            custom1: 'Custom property #1',
                            __enc_secret1: cryptoKeysList[0].encryptData(Buffer.from(JSON.stringify('Secret text #1'))).toString('base64')
                        },
                        tk00002: {
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
                                    value: 'false'
                                },
                                {
                                    key: 'contents',
                                    type: 'URL',
                                    value: new NFTokenContentsUrl('QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG').toString()
                                },
                            ],
                            custom1: 'Custom property #2',
                            __enc_secret1: cryptoKeysList[1].encryptData(Buffer.from(JSON.stringify('Secret text #2'))).toString('base64')
                        },
                    }
                });

                it('should correctly clone non-fungible token metadata object', function () {
                    expect(nfTokenMetadata.clone()).to.be.an.instanceof(CCNFTokenMetadata).and.deep.equal(nfTokenMetadata);
                });

                it('should correctly instantiate non-fungible token metadata object from assembled data', function () {
                    expect(new CCNFTokenMetadata(
                        assembledNFTokenMetadata,
                        [
                            cryptoKeysList[0],
                            cryptoKeysList[1]
                        ]
                    ))
                    .to.deep.equal(
                        _und.omit(nfTokenMetadata, '_fromAssetIssuance')
                    );
                });
            });
        });

        describe('new tokens and update', function () {
            /**
             * @type {NFAssetIssuance}
             */
            let nfAssetIssuance;
            /**
             * @type {CCSingleNFTokenMetadata[]}
             */
            let nfTokenMetadataList;
            /**
             * @type {CCNFTokenMetadata}
             */
            let nfTokenMetadata;
            /**
             * @type {CCMetaNonFungibleToken}
             */
            let assembledNFTokenMetadata;

            before(function () {
                nfAssetIssuance = new NFAssetIssuance(
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

                nfTokenMetadataList = [
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
            });

            it('should correctly assemble non-fungible token metadata', function () {
                // Instantiate object
                nfTokenMetadata = new CCNFTokenMetadata();

                // Assign non-fungible asset issuance
                nfTokenMetadata.fromAssetIssuance(
                    nfAssetIssuance,
                    [
                        cryptoKeysList[0],
                        cryptoKeysList[1]
                    ]
                );

                // Add single non-fungible token metadata to be updated
                nfTokenMetadata
                .addNFTokenMetadataToUpdate('tk00003', nfTokenMetadataList[0])
                .addNFTokenMetadataToUpdate('tk00004', nfTokenMetadataList[1]);

                expect(nfTokenMetadata.update).to.an('object').and.to.have.all.keys(['tk00003', 'tk00004']);

                const encCryptoKeys = [];
                encCryptoKeys['tk00003'] = cryptoKeysList[2];
                encCryptoKeys['tk00004'] = cryptoKeysList[3];

                assembledNFTokenMetadata = nfTokenMetadata.assemble(encCryptoKeys);

                expect(assembledNFTokenMetadata).to.not.be.undefined;

                expect(nfTokenMetadata.newTokens).to.have.lengthOf(2);

                const newTokensContentsURLs = nfTokenMetadata.newTokens.map(o => o.contentsUrl);

                expect(
                    cryptoKeysList[0].decryptData(Catenis.ipfsClient.cat(newTokensContentsURLs[0].cid)),
                    'Non-fungible token #1 contents'
                )
                .to.deep.equal(Buffer.from('NFT #1 contents: bla, bla, bla'));
                expect(
                    cryptoKeysList[1].decryptData(Catenis.ipfsClient.cat(newTokensContentsURLs[1].cid)),
                    'Non-fungible token #2 contents'
                )
                .to.deep.equal(Buffer.from('NFT #2 contents: bla'));

                expect(assembledNFTokenMetadata).to.deep.equal({
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
                            __enc_secret1: cryptoKeysList[0].encryptData(Buffer.from(JSON.stringify('Secret text #1'))).toString('base64')
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
                            __enc_secret2: cryptoKeysList[1].encryptData(Buffer.from(JSON.stringify('Secret text #2'))).toString('base64')
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
                            __enc_secret3: cryptoKeysList[2].encryptData(Buffer.from(JSON.stringify('Secret text #3'))).toString('base64')
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
                            __enc_secret4: cryptoKeysList[3].encryptData(Buffer.from(JSON.stringify('Secret text #4'))).toString('base64')
                        },
                    }
                });
            });

            it('should correctly clone non-fungible token metadata object', function () {
                expect(nfTokenMetadata.clone()).to.be.an.instanceof(CCNFTokenMetadata).and.deep.equal(nfTokenMetadata);
            });

            it('should correctly instantiate non-fungible token metadata object from assembled data', function () {
                const decCryptoKeys = [
                    cryptoKeysList[0],
                    cryptoKeysList[1]
                ];
                decCryptoKeys['tk00003'] = cryptoKeysList[2];
                decCryptoKeys['tk00004'] = cryptoKeysList[3];

                expect(new CCNFTokenMetadata(
                    assembledNFTokenMetadata,
                    decCryptoKeys
                ))
                .to.deep.equal(
                    _und.omit(nfTokenMetadata, '_fromAssetIssuance')
                );
            });
        });
    });
});
