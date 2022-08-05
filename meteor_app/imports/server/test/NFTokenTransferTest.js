/**
 * Created by claudio on 2022-07-25
 */

//console.log('[NFTokenTransferTest.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import stream from 'stream';
// Third-party node modules
import { expect } from 'chai';
import  _und from 'underscore';
// Meteor packages
import { Meteor } from 'meteor/meteor';
// noinspection ES6CheckImport
import { Promise } from 'meteor/promise';

// References code in other (Catenis) modules
import { Catenis } from '../Catenis';
import {
    NFTokenTransfer,
    resetClasses as nftTransferResetClasses,
    cfgSettings as nftTransferCfgSettings,
} from '../NFTokenTransfer';
import { NonFungibleToken } from '../NonFungibleToken';
import { Device } from '../Device';
import { CCSingleNFTokenMetadata } from '../CCSingleNFTokenMetadata';
import { NFTokenContentsUrl } from '../NFTokenContentsUrl';
import { NFTokenStorage } from '../NFTokenStorage';
import { EccLibraryProxy } from '../EccLibraryProxy';
import { Bip32 } from '../Bip32';
import { CryptoKeys } from '../CryptoKeys';
import { C3NodeClient } from '../C3NodeClient';

class NFTokenInfo {
    constructor(tokenId, ccTokenId, metadata, contents, encKeys) {
        this.tokenId = tokenId;
        this.ccTokenId = ccTokenId;
        this.metadata = metadata;
        this.contents = contents;
        this.encKeys = encKeys;
        this._ccMetadata = undefined;
        this._contentsUrl = undefined;
        this._storedContents = undefined;
    }

    get ccMetadata() {
        if (!this._ccMetadata) {
            this._ccMetadata = this.getCCMetadata(this.encKeys);
        }

        return this._ccMetadata;
    }

    get contentsUrl() {
        if (!this._contentsUrl) {
            this._contentsUrl = NFTokenContentsUrl.parse(this.metadata.contents);
        }

        return this._contentsUrl;
    }

    get contentsCID() {
        return this.contentsUrl.cid;
    }

    get storedContents() {
        if (!this._storedContents) {
            this._storedContents = this.metadata.contentsEncrypted
                ? this.getEncryptedContents(this.encKeys)
                : this.contents;
        }

        return this._storedContents;
    }

    getCCMetadata(encKeys, contentsCID) {
        const ccNFTokenMetadata = new CCSingleNFTokenMetadata();

        const nfTokenProps = _und.mapObject(this.metadata, (val, key) => {
            return key === 'contents' ? NFTokenContentsUrl.parse(val) : val;
        });

        if (contentsCID) {
            nfTokenProps.contents.cid = contentsCID;
        }

        ccNFTokenMetadata.setNFTokenProperties(nfTokenProps);

        return ccNFTokenMetadata.assemble(encKeys);
    }

    getEncryptedContents(encKeys) {
        return encKeys.encryptData(this.contents);
    }
}

class LocalNonFungibleToken {
    constructor(nfTokenInfo) {
        this.nfTokenInfo = nfTokenInfo;
        this.tokenId = nfTokenInfo.tokenId;
        this.ccTokenId = nfTokenInfo.ccTokenId;
        nfTokens.push(this);
    }
}

class LocalDevice {
    constructor(deviceId) {
        this.deviceId = deviceId;
        devices.push(this);
    }
}

const nfTokens = [];
const devices = [];
const _localIpfsStore = {
    counter: 10001,
    map: new Map(),
};


describe('NFTokenTransfer module', function () {
    const cryptoKeysList = [];
    let nfTokenStorage;

    function readMetadata(ccTokenId) {
        let promiseOutcome;
        const promise = new Promise((resolve, reject) => {
            promiseOutcome = {
                resolve,
                reject
            };
        });

        let writtenData = Buffer.from('');

        Catenis.c3NodeClient.getNFTokenMetadataReadableStream(ccTokenId)
        .pipe(new stream.Writable({
            write(chunk, encoding, callback) {
                writtenData = Buffer.concat([writtenData, chunk]);
                callback();
            },
            final(callback) {
                promiseOutcome.resolve(JSON.parse(writtenData.toString()));
                callback();
            }
        }));

        return promise;
    }

    function readContents(cid) {
        let promiseOutcome;
        const promise = new Promise((resolve, reject) => {
            promiseOutcome = {
                resolve,
                reject
            };
        });

        let writtenData = Buffer.from('');

        nfTokenStorage.retrieve(cid)
        .pipe(new stream.Writable({
            write(chunk, encoding, callback) {
                writtenData = Buffer.concat([writtenData, chunk]);
                callback();
            },
            final(callback) {
                promiseOutcome.resolve(writtenData);
                callback();
            }
        }));

        return promise;
    }

    before(function () {
        EccLibraryProxy.initialize();
        Bip32.initialize();
        C3NodeClient.initialize();
        resetNFTokenStorage();
        resetNonFungibleToken();
        resetDevice();
        resetC3NodeClient();
        nftTransferResetClasses(Device, NonFungibleToken);

        // Create crypto keys
        for (let i = 0; i < 3; i++) {
            cryptoKeysList.push(CryptoKeys.random());
        }

        // Create non-fungible tokens

        // Token #1, no sensitive data, contents not encrypted
        new NonFungibleToken(new NFTokenInfo(
            't00001',
            'tk00001',
            {
                name: 'Test NFT #1',
                description: 'Non-fungible token #1 used for testing (blah, blah, blah, blah)',
                contentsEncrypted: false,
                contents: 'https://ipfs.catenis.io/ipfs/QmabcdefghijklmnopqrstuvwxyzABCDEFGHIJKLM00001',
                custom: {
                    custom1: 'Custom property #1.1',
                    custom2: 'Custom property #1.2'
                }
            },
            Buffer.from('Test NFT #1 contents. Blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah.')
        ));

        // Token #2, sensitive data, contents not encrypted
        new NonFungibleToken(new NFTokenInfo(
            't00002',
            'tk00002',
            {
                name: 'Test NFT #2',
                description: 'Non-fungible token #2 used for testing (blah, blah, blah)',
                contentsEncrypted: false,
                contents: 'https://ipfs.catenis.io/ipfs/QmabcdefghijklmnopqrstuvwxyzABCDEFGHIJKLM00002',
                custom: {
                    sensitiveProps: {
                        secret1: 'Secret text #2.1'
                    },
                    custom1: 'Custom property #2.2',
                    custom2: 'Custom property #2.3'
                }
            },
            Buffer.from('Test NFT #2 contents. Blah, blah, blah, blah, blah, blah, blah, blah, blah, blah.'),
            cryptoKeysList[0]
        ));

        // Token #3, no sensitive data, contents encrypted
        new NonFungibleToken(new NFTokenInfo(
            't00003',
            'tk00003',
            {
                name: 'Test NFT #3',
                description: 'Non-fungible token #3 used for testing (blah, blah)',
                contentsEncrypted: true,
                contents: 'https://ipfs.catenis.io/ipfs/QmabcdefghijklmnopqrstuvwxyzABCDEFGHIJKLM00003',
                custom: {
                    custom1: 'Custom property #3.1',
                    custom2: 'Custom property #3.2'
                }
            },
            Buffer.from('Test NFT #3 contents. Blah, blah, blah, blah, blah, blah, blah, blah, blah.'),
            cryptoKeysList[0]
        ));

        // Token #4, sensitive data, contents encrypted
        new NonFungibleToken(new NFTokenInfo(
            't00004',
            'tk00004',
            {
                name: 'Test NFT #4',
                description: 'Non-fungible token #4 used for testing (blah)',
                contentsEncrypted: true,
                contents: 'https://ipfs.catenis.io/ipfs/QmabcdefghijklmnopqrstuvwxyzABCDEFGHIJKLM00004',
                custom: {
                    sensitiveProps: {
                        secret1: 'Secret text #4.1'
                    },
                    custom1: 'Custom property #4.2',
                    custom2: 'Custom property #4.3'
                }
            },
            Buffer.from('Test NFT #4 contents. Blah, blah, blah, blah, blah, blah, blah, blah.'),
            cryptoKeysList[0]
        ));

        // Create devices

        // Device #1
        new Device('d00001');

        // Device #2
        new Device('d00002');

        // Instantiate non-fungible token storage object
        nfTokenStorage = new NFTokenStorage();
    });

    describe('Test environment', function () {
        it('should have set up the testing environment correctly', async function () {
            expect(nfTokens.length).to.equal(4);
            expect(nfTokens[0] instanceof NonFungibleToken).to.be.true;
            // Validate token #1
            expect(nfTokens[0]).to.include({
                tokenId: 't00001',
                ccTokenId: 'tk00001'
            });
            expect(nfTokens[0].nfTokenInfo).to.deep.include({
                tokenId: 't00001',
                ccTokenId: 'tk00001',
                metadata: {
                    name: 'Test NFT #1',
                    description: 'Non-fungible token #1 used for testing (blah, blah, blah, blah)',
                    contentsEncrypted: false,
                    contents: 'https://ipfs.catenis.io/ipfs/QmabcdefghijklmnopqrstuvwxyzABCDEFGHIJKLM00001',
                    custom: {
                        custom1: 'Custom property #1.1',
                        custom2: 'Custom property #1.2'
                    }
                },
                contents: Buffer.from('Test NFT #1 contents. Blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah.')
            });
            {
                const ccNFTokenMetadata = new CCSingleNFTokenMetadata();
                ccNFTokenMetadata.setNFTokenProperties({
                    name: 'Test NFT #1',
                    description: 'Non-fungible token #1 used for testing (blah, blah, blah, blah)',
                    contentsEncrypted: false,
                    contents: NFTokenContentsUrl.parse('https://ipfs.catenis.io/ipfs/QmabcdefghijklmnopqrstuvwxyzABCDEFGHIJKLM00001'),
                    custom: {
                        custom1: 'Custom property #1.1',
                        custom2: 'Custom property #1.2'
                    }
                });
                expect(nfTokens[0].nfTokenInfo.ccMetadata).to.deep.equal(ccNFTokenMetadata.assemble(cryptoKeysList[0]));
            }
            expect(nfTokens[0].nfTokenInfo.getCCMetadata(cryptoKeysList[0])).to.deep.equal(nfTokens[0].nfTokenInfo.ccMetadata);
            expect(nfTokens[0].nfTokenInfo.getCCMetadata(cryptoKeysList[1], 'QmabcdefghijklmnopqrstuvwxyzABCDEFGHIJKLM10010')).to.deep.equal({
                meta: [
                    { key: 'name', value: 'Test NFT #1', type: 'String' },
                    {
                        key: 'description',
                        value: 'Non-fungible token #1 used for testing (blah, blah, blah, blah)',
                        type: 'String'
                    },
                    { key: 'contentsEncrypted', value: 'false', type: 'Boolean' },
                    {
                        key: 'contents',
                        value: 'https://ipfs.catenis.io/ipfs/QmabcdefghijklmnopqrstuvwxyzABCDEFGHIJKLM10010',
                        type: 'URL'
                    },
                ],
                custom1: 'Custom property #1.1',
                custom2: 'Custom property #1.2'
            });
            expect(nfTokens[0].nfTokenInfo.contentsCID).to.equal('QmabcdefghijklmnopqrstuvwxyzABCDEFGHIJKLM00001');
            expect(nfTokens[0].nfTokenInfo.storedContents).to.deep.equal(Buffer.from('Test NFT #1 contents. Blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah.'));
            expect(NonFungibleToken.getNFTokenByTokenId('t00001')).to.equal(nfTokens[0]);
            // Validate token #4
            expect(nfTokens[3]).to.include({
                tokenId: 't00004',
                ccTokenId: 'tk00004'
            });
            expect(nfTokens[3].nfTokenInfo).to.deep.include({
                tokenId: 't00004',
                ccTokenId: 'tk00004',
                metadata: {
                    name: 'Test NFT #4',
                    description: 'Non-fungible token #4 used for testing (blah)',
                    contentsEncrypted: true,
                    contents: 'https://ipfs.catenis.io/ipfs/QmabcdefghijklmnopqrstuvwxyzABCDEFGHIJKLM00004',
                    custom: {
                        sensitiveProps: {
                            secret1: 'Secret text #4.1'
                        },
                        custom1: 'Custom property #4.2',
                        custom2: 'Custom property #4.3'
                    }
                },
                contents: Buffer.from('Test NFT #4 contents. Blah, blah, blah, blah, blah, blah, blah, blah.')
            });
            {
                const ccNFTokenMetadata = new CCSingleNFTokenMetadata();
                ccNFTokenMetadata.setNFTokenProperties({
                    name: 'Test NFT #4',
                    description: 'Non-fungible token #4 used for testing (blah)',
                    contentsEncrypted: true,
                    contents: 'https://ipfs.catenis.io/ipfs/QmabcdefghijklmnopqrstuvwxyzABCDEFGHIJKLM00004',
                    custom: {
                        sensitiveProps: {
                            secret1: 'Secret text #4.1'
                        },
                        custom1: 'Custom property #4.2',
                        custom2: 'Custom property #4.3'
                    }
                });
                expect(nfTokens[3].nfTokenInfo.ccMetadata).to.deep.equal(ccNFTokenMetadata.assemble(cryptoKeysList[0]));
            }
            expect(nfTokens[3].nfTokenInfo.getCCMetadata(cryptoKeysList[0])).to.deep.equal(nfTokens[3].nfTokenInfo.ccMetadata);
            expect(nfTokens[3].nfTokenInfo.getCCMetadata(cryptoKeysList[1], 'QmabcdefghijklmnopqrstuvwxyzABCDEFGHIJKLM10011')).to.deep.equal({
                meta: [
                    { key: 'name', value: 'Test NFT #4', type: 'String' },
                    {
                        key: 'description',
                        value: 'Non-fungible token #4 used for testing (blah)',
                        type: 'String'
                    },
                    { key: 'contentsEncrypted', value: 'true', type: 'Boolean' },
                    {
                        key: 'contents',
                        value: 'https://ipfs.catenis.io/ipfs/QmabcdefghijklmnopqrstuvwxyzABCDEFGHIJKLM10011',
                        type: 'URL'
                    },
                ],
                custom1: 'Custom property #4.2',
                custom2: 'Custom property #4.3',
                __enc_secret1: cryptoKeysList[1].encryptData(Buffer.from(JSON.stringify('Secret text #4.1'))).toString('base64')
            });
            expect(nfTokens[3].nfTokenInfo.contentsCID).to.equal('QmabcdefghijklmnopqrstuvwxyzABCDEFGHIJKLM00004');
            expect(nfTokens[3].nfTokenInfo.storedContents).to.deep.equal(
                cryptoKeysList[0].encryptData(Buffer.from('Test NFT #4 contents. Blah, blah, blah, blah, blah, blah, blah, blah.'))
            );
            expect(NonFungibleToken.getNFTokenByTokenId('t00004')).to.equal(nfTokens[3]);

            expect(await readMetadata(nfTokens[0].ccTokenId)).to.deep.equal(nfTokens[0].nfTokenInfo.ccMetadata);

            expect(await readContents(nfTokens[0].nfTokenInfo.contentsCID)).to.deep.equal(nfTokens[0].nfTokenInfo.storedContents);

            const testContents = Buffer.from('This is only a test: one, two, three, four, five, six, seven, eight, nine, ten.');
            const testContentsCID = await nfTokenStorage.store(stream.Readable.from(testContents));

            expect(testContentsCID).to.equal('QmabcdefghijklmnopqrstuvwxyzABCDEFGHIJKLM10001');
            expect(await readContents(testContentsCID)).to.deep.equal(testContents);

            expect(devices.length).to.equal(2);
            expect(devices[0] instanceof Device).to.be.true;
            // Validate device #1
            expect(devices[0]).to.include({
                deviceId: 'd00001'
            });
            expect(Device.getDeviceByDeviceId('d00001')).to.equal(devices[0]);
        });
    });

    describe('NFTokenTransfer class', function () {
        let nfTokenTransfer;

        describe('Object instantiation', function () {
            it('should fail to instantiate object: invalid params (nfToken)', function () {
                expect(() => {
                    nfTokenTransfer = new NFTokenTransfer(undefined, {}, devices[0], devices[1]);
                })
                .to.throw(TypeError, 'Invalid nfToken argument');
            });

            it('should fail to instantiate object: invalid params (sendingDevice)', function () {
                expect(() => {
                    nfTokenTransfer = new NFTokenTransfer(undefined, nfTokens[0], {}, devices[1]);
                })
                .to.throw(TypeError, 'Invalid sendingDevice argument');
            });

            it('should fail to instantiate object: invalid params (sendingDevice)', function () {
                expect(() => {
                    nfTokenTransfer = new NFTokenTransfer(undefined, nfTokens[0], devices[0], {});
                })
                .to.throw(TypeError, 'Invalid receivingDevice argument');
            });

            it('should successfully instantiate object', function () {
                expect(() => {
                    nfTokenTransfer = new NFTokenTransfer(undefined, nfTokens[0], devices[0], devices[1]);
                })
                .not.to.throw();

                expect(nfTokenTransfer).to.be.an.instanceof(NFTokenTransfer);
                expect(nfTokenTransfer._isSavedToDB).to.be.true;
                expect(nfTokenTransfer.progress).to.deep.equal({
                    metadata: {
                        bytesRead: 0
                    },
                    done: false
                });
                expect(nfTokenTransfer.tokenTransferId).to.be.a('string').with.lengthOf(20);
                expect(nfTokenTransfer.createdDate).to.be.a('date');
                expect(nfTokenTransfer.nfToken).to.equal(nfTokens[0]);
                expect(nfTokenTransfer.sendingDevice).to.equal(devices[0]);
                expect(nfTokenTransfer.receivingDevice).to.equal(devices[1]);
                expect(nfTokenTransfer.ccTokenId).to.equal(nfTokens[0].ccTokenId);
            });

            it('should successfully instantiate object from database', function () {
                const docNFTokenTransfer = Catenis.db.collection.NonFungibleTokenTransfer.findOne({tokenTransferId: nfTokenTransfer.tokenTransferId});

                expect(docNFTokenTransfer).to.exist;

                const nfTokenTransferDB = new NFTokenTransfer(docNFTokenTransfer);

                expect(nfTokenTransferDB).to.be.an.instanceof(NFTokenTransfer);
                expect(nfTokenTransferDB.nfToken).to.exist;
                expect(nfTokenTransferDB.sendingDevice).to.exist;
                expect(nfTokenTransferDB.receivingDevice).to.exist;

                expect(nfTokenTransferDB).to.deep.equal(nfTokenTransfer);
            });

            it('should fail trying to retrieve non-fungible token by token transfer ID: invalid token transfer ID', function () {
                expect(() => {
                    NFTokenTransfer.getNFTokenTransferByTokenTransferId('invalid_ID', nfTokenTransfer.tokenId);
                })
                .to.throw(Meteor.Error,'Unable to find non-fungible token transfer with the given token transfer ID')
                .with.property('error', 'nft_transfer_invalid_id');
            });

            it('should fail trying to retrieve non-fungible token by token transfer ID: wrong token', function () {
                expect(() => {
                    NFTokenTransfer.getNFTokenTransferByTokenTransferId(nfTokenTransfer.tokenTransferId, 'tk00002');
                })
                .to.throw(Meteor.Error,'Non-fungible token transfer is for a different non-fungible token')
                .with.property('error', 'nft_transfer_wrong_token');
            });

            it('should fail trying to retrieve non-fungible token by token transfer ID: wrong device', function () {
                expect(() => {
                    NFTokenTransfer.getNFTokenTransferByTokenTransferId(nfTokenTransfer.tokenTransferId, nfTokenTransfer.tokenId, devices[1].deviceId);
                })
                .to.throw(Meteor.Error,'Non-fungible token transfer belongs to a different device')
                .with.property('error', 'nft_transfer_wrong_device');
            });

            it('should successfully retrieve non-fungible token by token transfer ID', function () {
                let nfTokenTransferDB;

                expect(() => {
                    nfTokenTransferDB = NFTokenTransfer.getNFTokenTransferByTokenTransferId(nfTokenTransfer.tokenTransferId, nfTokenTransfer.tokenId, devices[0].deviceId);
                })
                .not.to.throw();

                expect(nfTokenTransferDB).to.be.an.instanceof(NFTokenTransfer);
                expect(nfTokenTransferDB.nfToken).to.exist;
                expect(nfTokenTransferDB.sendingDevice).to.exist;
                expect(nfTokenTransferDB.receivingDevice).to.exist;

                expect(nfTokenTransferDB).to.deep.equal(nfTokenTransfer);
            });
        });

        describe('Object functionality', function () {
            function resetProgressData() {
                nfTokenTransfer.progress = {
                    metadata: {
                        bytesRead: 0
                    },
                    done: false
                };
                Catenis.db.collection.NonFungibleTokenTransfer.update({
                    tokenTransferId: nfTokenTransfer.tokenTransferId
                }, {
                    $set: {
                        progress: nfTokenTransfer.progress
                    }
                });
            }

            function resetProgressFinalization() {
                nfTokenTransfer.progress.done = false;
                delete nfTokenTransfer.progress.success;
                delete nfTokenTransfer.progress.error;
                delete nfTokenTransfer.progress.finishDate;

                Catenis.db.collection.NonFungibleTokenTransfer.update({
                    tokenTransferId: nfTokenTransfer.tokenTransferId
                }, {
                    $set: {
                        progress: nfTokenTransfer.progress
                    }
                });
            }

            it('should fail trying to update transfer progress: bytesRead not integer', function () {
                expect(() => {
                    nfTokenTransfer.updateTransferProgress('', 0);
                })
                .to.throw(TypeError, 'Invalid bytesRead argument');
            });

            it('should fail trying to update transfer progress: bytesRead < 0', function () {
                expect(() => {
                    nfTokenTransfer.updateTransferProgress(-1, 0);
                })
                .to.throw(TypeError, 'Invalid bytesRead argument');
            });

            it('should fail trying to update transfer progress: bytesWritten not integer', function () {
                expect(() => {
                    nfTokenTransfer.updateTransferProgress(0, '');
                })
                .to.throw(TypeError, 'Invalid bytesWritten argument');
            });

            it('should fail trying to update transfer progress: bytesWritten < 0', function () {
                expect(() => {
                    nfTokenTransfer.updateTransferProgress(0, -1);
                })
                .to.throw(TypeError, 'Invalid bytesWritten argument');
            });

            it('should correctly update transfer progress: metadata bytes read', function () {
                expect(() => {
                    nfTokenTransfer.updateTransferProgress(150, 0);
                })
                .not.to.throw();

                expect(nfTokenTransfer.progress).to.deep.equal({
                    metadata: {
                        bytesRead: 150
                    },
                    done: false
                });

                expect(Catenis.db.collection.NonFungibleTokenTransfer.findOne({
                    tokenTransferId: nfTokenTransfer.tokenTransferId
                }, {
                    fields: {
                        progress: 1
                    }
                }).progress).to.deep.equal({
                    metadata: {
                        bytesRead: 150
                    },
                    done: false
                });
            });

            it('should correctly update transfer progress: metadata bytes written', function () {
                expect(() => {
                    nfTokenTransfer.updateTransferProgress(0, 75);
                })
                .not.to.throw();

                expect(nfTokenTransfer.progress).to.deep.equal({
                    metadata: {
                        bytesRead: 150,
                        bytesWritten: 75
                    },
                    done: false
                });

                expect(Catenis.db.collection.NonFungibleTokenTransfer.findOne({
                    tokenTransferId: nfTokenTransfer.tokenTransferId
                }, {
                    fields: {
                        progress: 1
                    }
                }).progress).to.deep.equal({
                    metadata: {
                        bytesRead: 150,
                        bytesWritten: 75
                    },
                    done: false
                });
            });

            it('should correctly update transfer progress: additional metadata bytes read', function () {
                expect(() => {
                    nfTokenTransfer.updateTransferProgress(50, 0);
                })
                .not.to.throw();

                expect(nfTokenTransfer.progress).to.deep.equal({
                    metadata: {
                        bytesRead: 200,
                        bytesWritten: 75
                    },
                    done: false
                });

                expect(Catenis.db.collection.NonFungibleTokenTransfer.findOne({
                    tokenTransferId: nfTokenTransfer.tokenTransferId
                }, {
                    fields: {
                        progress: 1
                    }
                }).progress).to.deep.equal({
                    metadata: {
                        bytesRead: 200,
                        bytesWritten: 75
                    },
                    done: false
                });
            });

            it('should correctly update transfer progress: additional metadata bytes written', function () {
                expect(() => {
                    nfTokenTransfer.updateTransferProgress(0, 15);
                })
                .not.to.throw();

                expect(nfTokenTransfer.progress).to.deep.equal({
                    metadata: {
                        bytesRead: 200,
                        bytesWritten: 90
                    },
                    done: false
                });

                expect(Catenis.db.collection.NonFungibleTokenTransfer.findOne({
                    tokenTransferId: nfTokenTransfer.tokenTransferId
                }, {
                    fields: {
                        progress: 1
                    }
                }).progress).to.deep.equal({
                    metadata: {
                        bytesRead: 200,
                        bytesWritten: 90
                    },
                    done: false
                });
            });

            it('should correctly update transfer progress: contents bytes read', function () {
                expect(() => {
                    nfTokenTransfer.updateTransferProgress(234, 0, true);
                })
                .not.to.throw();

                expect(nfTokenTransfer.progress).to.deep.equal({
                    metadata: {
                        bytesRead: 200,
                        bytesWritten: 90,
                        contents: {
                            bytesRead: 234,
                            bytesWritten: 0
                        }
                    },
                    done: false
                });

                expect(Catenis.db.collection.NonFungibleTokenTransfer.findOne({
                    tokenTransferId: nfTokenTransfer.tokenTransferId
                }, {
                    fields: {
                        progress: 1
                    }
                }).progress).to.deep.equal({
                    metadata: {
                        bytesRead: 200,
                        bytesWritten: 90,
                        contents: {
                            bytesRead: 234,
                            bytesWritten: 0
                        }
                    },
                    done: false
                });
            });

            it('should correctly update transfer progress: contents bytes written', function () {
                expect(() => {
                    nfTokenTransfer.updateTransferProgress(0, 345, true);
                })
                .not.to.throw();

                expect(nfTokenTransfer.progress).to.deep.equal({
                    metadata: {
                        bytesRead: 200,
                        bytesWritten: 90,
                        contents: {
                            bytesRead: 234,
                            bytesWritten: 345
                        }
                    },
                    done: false
                });

                expect(Catenis.db.collection.NonFungibleTokenTransfer.findOne({
                    tokenTransferId: nfTokenTransfer.tokenTransferId
                }, {
                    fields: {
                        progress: 1
                    }
                }).progress).to.deep.equal({
                    metadata: {
                        bytesRead: 200,
                        bytesWritten: 90,
                        contents: {
                            bytesRead: 234,
                            bytesWritten: 345
                        }
                    },
                    done: false
                });
            });

            it('should indirectly update contents data handling to transfer progress: bytes read', function () {
                expect( () => {
                    nfTokenTransfer.reportReadProgress(116);
                })
                .not.to.throw();


                expect(nfTokenTransfer.progress).to.deep.equal({
                    metadata: {
                        bytesRead: 200,
                        bytesWritten: 90,
                        contents: {
                            bytesRead: 350,
                            bytesWritten: 345
                        }
                    },
                    done: false
                });

                expect(Catenis.db.collection.NonFungibleTokenTransfer.findOne({
                    tokenTransferId: nfTokenTransfer.tokenTransferId
                }, {
                    fields: {
                        progress: 1
                    }
                }).progress).to.deep.equal({
                    metadata: {
                        bytesRead: 200,
                        bytesWritten: 90,
                        contents: {
                            bytesRead: 350,
                            bytesWritten: 345
                        }
                    },
                    done: false
                });
            });

            it('should indirectly update contents data handling to transfer progress: bytes written', function () {
                expect( () => {
                    nfTokenTransfer.reportWriteProgress(125);
                })
                .not.to.throw();


                expect(nfTokenTransfer.progress).to.deep.equal({
                    metadata: {
                        bytesRead: 200,
                        bytesWritten: 90,
                        contents: {
                            bytesRead: 350,
                            bytesWritten: 470
                        }
                    },
                    done: false
                });

                expect(Catenis.db.collection.NonFungibleTokenTransfer.findOne({
                    tokenTransferId: nfTokenTransfer.tokenTransferId
                }, {
                    fields: {
                        progress: 1
                    }
                }).progress).to.deep.equal({
                    metadata: {
                        bytesRead: 200,
                        bytesWritten: 90,
                        contents: {
                            bytesRead: 350,
                            bytesWritten: 470
                        }
                    },
                    done: false
                });
            });

            it('should correctly finalize transfer progress (with error ctn_device_low_service_acc_balance)', function () {
                expect(() => {
                    nfTokenTransfer.finalizeTransferProgress(new Meteor.Error('ctn_device_low_service_acc_balance', 'Simulated error'));
                })
                .not.to.throw();

                expect(_und.omit(nfTokenTransfer.progress, 'finishDate')).to.deep.equal({
                    metadata: {
                        bytesRead: 200,
                        bytesWritten: 90,
                        contents: {
                            bytesRead: 350,
                            bytesWritten: 470
                        }
                    },
                    done: true,
                    success: false,
                    error: {
                        code: 400,
                        message: 'Not enough credits to pay for transfer non-fungible token service'
                    }
                });
                expect(nfTokenTransfer.progress.finishDate).to.be.a('date');

                const progressDB = Catenis.db.collection.NonFungibleTokenTransfer.findOne({
                    tokenTransferId: nfTokenTransfer.tokenTransferId
                }, {
                    fields: {
                        progress: 1
                    }
                }).progress;

                expect(_und.omit(progressDB, 'finishDate')).to.deep.equal({
                    metadata: {
                        bytesRead: 200,
                        bytesWritten: 90,
                        contents: {
                            bytesRead: 350,
                            bytesWritten: 470
                        }
                    },
                    done: true,
                    success: false,
                    error: {
                        code: 400,
                        message: 'Not enough credits to pay for transfer non-fungible token service'
                    }
                });
                expect(progressDB.finishDate).to.be.a('date');
            });

            it('should correctly finalize transfer progress (with generic error)', function () {
                resetProgressFinalization();

                expect(() => {
                    nfTokenTransfer.finalizeTransferProgress(new Error('Simulated error'));
                })
                .not.to.throw();

                expect(_und.omit(nfTokenTransfer.progress, 'finishDate')).to.deep.equal({
                    metadata: {
                        bytesRead: 200,
                        bytesWritten: 90,
                        contents: {
                            bytesRead: 350,
                            bytesWritten: 470
                        }
                    },
                    done: true,
                    success: false,
                    error: {
                        code: 500,
                        message: 'Internal server error'
                    }
                });
                expect(nfTokenTransfer.progress.finishDate).to.be.a('date');

                const progressDB = Catenis.db.collection.NonFungibleTokenTransfer.findOne({
                    tokenTransferId: nfTokenTransfer.tokenTransferId
                }, {
                    fields: {
                        progress: 1
                    }
                }).progress;

                expect(_und.omit(progressDB, 'finishDate')).to.deep.equal({
                    metadata: {
                        bytesRead: 200,
                        bytesWritten: 90,
                        contents: {
                            bytesRead: 350,
                            bytesWritten: 470
                        }
                    },
                    done: true,
                    success: false,
                    error: {
                        code: 500,
                        message: 'Internal server error'
                    }
                });
                expect(progressDB.finishDate).to.be.a('date');
            });

            it('should correctly finalize transfer progress (success)', function () {
                resetProgressFinalization();

                expect(() => {
                    nfTokenTransfer.finalizeTransferProgress();
                })
                .not.to.throw();

                expect(_und.omit(nfTokenTransfer.progress, 'finishDate')).to.deep.equal({
                    metadata: {
                        bytesRead: 200,
                        bytesWritten: 90,
                        contents: {
                            bytesRead: 350,
                            bytesWritten: 470
                        }
                    },
                    done: true,
                    success: true
                });
                expect(nfTokenTransfer.progress.finishDate).to.be.a('date');

                const progressDB = Catenis.db.collection.NonFungibleTokenTransfer.findOne({
                    tokenTransferId: nfTokenTransfer.tokenTransferId
                }, {
                    fields: {
                        progress: 1
                    }
                }).progress;

                expect(_und.omit(progressDB, 'finishDate')).to.deep.equal({
                    metadata: {
                        bytesRead: 200,
                        bytesWritten: 90,
                        contents: {
                            bytesRead: 350,
                            bytesWritten: 470
                        }
                    },
                    done: true,
                    success: true
                });
                expect(progressDB.finishDate).to.be.a('date');
            });

            it('should not do anything if trying to finalize transfer progress already finalized', function () {
                expect(() => {
                    nfTokenTransfer.finalizeTransferProgress();
                })
                .not.to.throw();

                expect(_und.omit(nfTokenTransfer.progress, 'finishDate')).to.deep.equal({
                    metadata: {
                        bytesRead: 200,
                        bytesWritten: 90,
                        contents: {
                            bytesRead: 350,
                            bytesWritten: 470
                        }
                    },
                    done: true,
                    success: true
                });
                expect(nfTokenTransfer.progress.finishDate).to.be.a('date');

                const progressDB = Catenis.db.collection.NonFungibleTokenTransfer.findOne({
                    tokenTransferId: nfTokenTransfer.tokenTransferId
                }, {
                    fields: {
                        progress: 1
                    }
                }).progress;

                expect(_und.omit(progressDB, 'finishDate')).to.deep.equal({
                    metadata: {
                        bytesRead: 200,
                        bytesWritten: 90,
                        contents: {
                            bytesRead: 350,
                            bytesWritten: 470
                        }
                    },
                    done: true,
                    success: true
                });
                expect(progressDB.finishDate).to.be.a('date');
            });

            it('should correctly report transfer progress (no activity)', function () {
                resetProgressData();

                expect(nfTokenTransfer.getTransferProgress()).to.deep.equal({
                    progress: {
                        metadata: {
                            bytesRead: 0
                        },
                        done: false
                    }
                });
            });

            it('should correctly retrieve non-fungible token metadata', async function () {
                expect(await nfTokenTransfer._retrieveMetadata(nfTokens[0].ccTokenId)).to.deep.equal(nfTokens[0].nfTokenInfo.ccMetadata);

                expect(nfTokenTransfer.progress).to.deep.equal({
                    metadata: {
                        bytesRead: JSON.stringify(nfTokens[0].nfTokenInfo.ccMetadata).length
                    },
                    done: false
                });

                expect(await nfTokenTransfer._retrieveMetadata(nfTokens[3].ccTokenId)).to.deep.equal(nfTokens[3].nfTokenInfo.ccMetadata);

                expect(nfTokenTransfer.progress).to.deep.equal({
                    metadata: {
                        bytesRead: JSON.stringify(nfTokens[0].nfTokenInfo.ccMetadata).length
                            + JSON.stringify(nfTokens[3].nfTokenInfo.ccMetadata).length
                    },
                    done: false
                });
            });

            it('should correctly report transfer progress (metadata read)', function () {
                expect(nfTokenTransfer.getTransferProgress()).to.deep.equal({
                    progress: {
                        metadata: {
                            bytesRead: JSON.stringify(nfTokens[0].nfTokenInfo.ccMetadata).length
                                + JSON.stringify(nfTokens[3].nfTokenInfo.ccMetadata).length
                        },
                        done: false
                    }
                });
            });

            it('should correctly rewrite non-fungible token contents', async function () {
                let contentsNewCid = await nfTokenTransfer._rewriteContents(nfTokens[2].nfTokenInfo.contentsCID, cryptoKeysList[0], cryptoKeysList[1]);

                expect(contentsNewCid).to.equal('QmabcdefghijklmnopqrstuvwxyzABCDEFGHIJKLM10002');
                expect(await readContents(contentsNewCid)).to.deep.equal(nfTokens[2].nfTokenInfo.getEncryptedContents(cryptoKeysList[1]));

                expect(nfTokenTransfer.progress).to.deep.equal({
                    metadata: {
                        bytesRead: JSON.stringify(nfTokens[0].nfTokenInfo.ccMetadata).length
                            + JSON.stringify(nfTokens[3].nfTokenInfo.ccMetadata).length,
                        contents: {
                            bytesRead: nfTokens[2].nfTokenInfo.contents.length,
                            bytesWritten: nfTokens[2].nfTokenInfo.contents.length
                        }
                    },
                    done: false
                });

                contentsNewCid = await nfTokenTransfer._rewriteContents(nfTokens[3].nfTokenInfo.contentsCID, cryptoKeysList[0], cryptoKeysList[1]);

                expect(contentsNewCid).to.equal('QmabcdefghijklmnopqrstuvwxyzABCDEFGHIJKLM10003');
                expect(await readContents(contentsNewCid)).to.deep.equal(nfTokens[3].nfTokenInfo.getEncryptedContents(cryptoKeysList[1]));

                expect(nfTokenTransfer.progress).to.deep.equal({
                    metadata: {
                        bytesRead: JSON.stringify(nfTokens[0].nfTokenInfo.ccMetadata).length
                            + JSON.stringify(nfTokens[3].nfTokenInfo.ccMetadata).length,
                        contents: {
                            bytesRead: nfTokens[2].nfTokenInfo.contents.length + nfTokens[3].nfTokenInfo.contents.length,
                            bytesWritten: nfTokens[2].nfTokenInfo.contents.length + nfTokens[3].nfTokenInfo.contents.length
                        }
                    },
                    done: false
                });
            });

            it('should correctly report transfer progress (metadata read, and contents rewritten)', function () {
                expect(nfTokenTransfer.getTransferProgress()).to.deep.equal({
                    progress: {
                        metadata: {
                            bytesRead: JSON.stringify(nfTokens[0].nfTokenInfo.ccMetadata).length
                                + JSON.stringify(nfTokens[3].nfTokenInfo.ccMetadata).length
                                + nfTokens[2].nfTokenInfo.contents.length + nfTokens[3].nfTokenInfo.contents.length,
                            bytesWritten: nfTokens[2].nfTokenInfo.contents.length + nfTokens[3].nfTokenInfo.contents.length
                        },
                        done: false
                    }
                });
            });

            it('should correctly get the metadata to be sent with non-fungible token transfer: nothing to send (no sensitive metadata props nor encrypted contents)', async function () {
                resetProgressData();

                const metadata = await nfTokenTransfer.getTransferMetadata(
                    [
                        nfTokens[0].ccTokenId
                    ],
                    cryptoKeysList[0],
                    cryptoKeysList[1],
                    cryptoKeysList[2]
                );

                expect(metadata).to.be.undefined;

                // Make sure that transfer progress has been updated accordingly
                expect(nfTokenTransfer.getTransferProgress()).to.deep.equal({
                    progress: {
                        metadata: {
                            bytesRead: JSON.stringify(nfTokens[0].nfTokenInfo.ccMetadata).length
                        },
                        done: false
                    }
                });
            });

            it('should correctly get the metadata to be sent with non-fungible token transfer', async function () {
                resetProgressData();

                const metadata = await nfTokenTransfer.getTransferMetadata(
                    [
                        nfTokens[0].ccTokenId,
                        nfTokens[1].ccTokenId,
                    ],
                    cryptoKeysList[0],
                    cryptoKeysList[1],
                    cryptoKeysList[2]
                );

                expect(metadata).to.exist;

                const encCryptoKeysList = [];
                encCryptoKeysList[nfTokens[0].ccTokenId] = cryptoKeysList[1];
                encCryptoKeysList[nfTokens[1].ccTokenId] = cryptoKeysList[2];

                metadata.assemble(undefined, encCryptoKeysList);

                expect(metadata.metadata).to.deep.equal({
                    nfTokenMetadata: {
                        update: {
                            tk00002: nfTokens[1].nfTokenInfo.getCCMetadata(cryptoKeysList[2])
                        }
                    }
                });

                // Simulate storage of metadata
                nfTokenTransfer.updateTransferProgress(0, JSON.stringify(nfTokens[1].nfTokenInfo.getCCMetadata(cryptoKeysList[2])).length);

                // Make sure that transfer progress has been updated accordingly
                expect(nfTokenTransfer.getTransferProgress()).to.deep.equal({
                    progress: {
                        metadata: {
                            bytesRead: JSON.stringify(nfTokens[0].nfTokenInfo.ccMetadata).length
                                + JSON.stringify(nfTokens[1].nfTokenInfo.ccMetadata).length,
                            bytesWritten: JSON.stringify(nfTokens[1].nfTokenInfo.getCCMetadata(cryptoKeysList[2])).length
                        },
                        done: false
                    }
                });
            });

            it('should correctly get the metadata to be sent with non-fungible token transfer (token #4)', async function () {
                let nfTokenTransfer2;
                
                expect(() => {
                    nfTokenTransfer2 = new NFTokenTransfer(undefined, nfTokens[3], devices[0], devices[1]);
                })
                .not.to.throw();
                
                const metadata = await nfTokenTransfer2.getTransferMetadata(
                    [
                        nfTokens[0].ccTokenId,
                        nfTokens[1].ccTokenId,
                        nfTokens[2].ccTokenId,
                        nfTokens[3].ccTokenId
                    ],
                    cryptoKeysList[0],
                    cryptoKeysList[1],
                    cryptoKeysList[2]
                );

                expect(metadata).to.exist;

                const encCryptoKeysList = [];
                encCryptoKeysList[nfTokens[0].ccTokenId] = cryptoKeysList[2];
                encCryptoKeysList[nfTokens[1].ccTokenId] = cryptoKeysList[2];
                encCryptoKeysList[nfTokens[2].ccTokenId] = cryptoKeysList[2];
                encCryptoKeysList[nfTokens[3].ccTokenId] = cryptoKeysList[1];

                metadata.assemble(undefined, encCryptoKeysList);

                expect(metadata.metadata).to.deep.equal({
                    nfTokenMetadata: {
                        update: {
                            tk00002: nfTokens[1].nfTokenInfo.getCCMetadata(cryptoKeysList[2]),
                            tk00003: nfTokens[2].nfTokenInfo.getCCMetadata(cryptoKeysList[2], 'QmabcdefghijklmnopqrstuvwxyzABCDEFGHIJKLM10004'),
                            tk00004: nfTokens[3].nfTokenInfo.getCCMetadata(cryptoKeysList[1], 'QmabcdefghijklmnopqrstuvwxyzABCDEFGHIJKLM10005')
                        }
                    }
                });

                // Simulate storage of metadata
                nfTokenTransfer2.updateTransferProgress(
                    0,
                    JSON.stringify(nfTokens[1].nfTokenInfo.getCCMetadata(cryptoKeysList[2])).length
                    + JSON.stringify(nfTokens[2].nfTokenInfo.getCCMetadata(cryptoKeysList[2], 'QmabcdefghijklmnopqrstuvwxyzABCDEFGHIJKLM10004')).length
                    + JSON.stringify(nfTokens[3].nfTokenInfo.getCCMetadata(cryptoKeysList[1], 'QmabcdefghijklmnopqrstuvwxyzABCDEFGHIJKLM10005')).length
                );

                // Make sure that transfer progress has been updated accordingly
                expect(nfTokenTransfer2.getTransferProgress()).to.deep.equal({
                    progress: {
                        metadata: {
                            bytesRead: JSON.stringify(nfTokens[0].nfTokenInfo.ccMetadata).length
                                + JSON.stringify(nfTokens[1].nfTokenInfo.ccMetadata).length
                                + JSON.stringify(nfTokens[2].nfTokenInfo.ccMetadata).length
                                + JSON.stringify(nfTokens[3].nfTokenInfo.ccMetadata).length
                                + nfTokens[2].nfTokenInfo.contents.length + nfTokens[3].nfTokenInfo.contents.length,
                            bytesWritten: JSON.stringify(nfTokens[1].nfTokenInfo.getCCMetadata(cryptoKeysList[2])).length
                                + JSON.stringify(nfTokens[2].nfTokenInfo.getCCMetadata(cryptoKeysList[2], 'QmabcdefghijklmnopqrstuvwxyzABCDEFGHIJKLM10004')).length
                                + JSON.stringify(nfTokens[3].nfTokenInfo.getCCMetadata(cryptoKeysList[1], 'QmabcdefghijklmnopqrstuvwxyzABCDEFGHIJKLM10005')).length
                                + nfTokens[2].nfTokenInfo.contents.length + nfTokens[3].nfTokenInfo.contents.length
                        },
                        done: false
                    }
                });

                expect(await readContents('QmabcdefghijklmnopqrstuvwxyzABCDEFGHIJKLM10004')).to.deep.equal(nfTokens[2].nfTokenInfo.getEncryptedContents(cryptoKeysList[2]));
                expect(await readContents('QmabcdefghijklmnopqrstuvwxyzABCDEFGHIJKLM10005')).to.deep.equal(nfTokens[3].nfTokenInfo.getEncryptedContents(cryptoKeysList[1]));
            });
        });

        describe('Object not saved to database', function () {

            it('should successfully instantiate object without saving it to the database', function () {
                expect(() => {
                    nfTokenTransfer = new NFTokenTransfer(undefined, nfTokens[0], devices[0], devices[1], true);
                })
                .not.to.throw();

                expect(nfTokenTransfer).to.be.an.instanceof(NFTokenTransfer);
                expect(nfTokenTransfer._isSavedToDB).to.be.false;
            });

            it('should fail trying to save progress to database', function () {
                expect(() => {
                    nfTokenTransfer._saveProgressToDB();
                })
                .to.throw(Error, 'Unable to save non-fungible token transfer progress to database: non-fungible token transfer not yet saved to database');
            });
        });

        describe('Purge old non-fungible token transfers', function () {
            const now = new Date();
            const inIncompleteDate = new Date(now);
            inIncompleteDate.setSeconds(inIncompleteDate.getSeconds() - nftTransferCfgSettings.timeKeepIncompleteTransfer + 1);
            const inProcessedDate = new Date(now);
            inProcessedDate.setSeconds(inProcessedDate.getSeconds() - nftTransferCfgSettings.timeKeepProcessedTransfer + 1);
            const outDate = new Date(now);

            const docsNFTokenTransfer = [
                // Incomplete transfers
                {
                    _id: '_x00001',
                    tokenTransferId: 'x00001',
                    tokenId: 't00001',
                    sendingDeviceId: 'd00001',
                    receivingDeviceId: 'd00002',
                    progress: {
                        done: false
                    },
                    createdDate: inIncompleteDate
                },
                {
                    _id: '_x00002',
                    tokenTransferId: 'x00002',
                    tokenId: 't00001',
                    sendingDeviceId: 'd00001',
                    receivingDeviceId: 'd00002',
                    progress: {
                        done: false
                    },
                    createdDate: outDate
                },
                {
                    _id: '_x00003',
                    tokenTransferId: 'x00003',
                    tokenId: 't00001',
                    sendingDeviceId: 'd00001',
                    receivingDeviceId: 'd00002',
                    progress: {
                        done: false
                    },
                    createdDate: inIncompleteDate
                },
                // Processed transfers
                {
                    _id: '_x00010',
                    tokenTransferId: 'x00010',
                    tokenId: 't00001',
                    sendingDeviceId: 'd00001',
                    receivingDeviceId: 'd00002',
                    progress: {
                        done: true,
                        success: true,
                        finishDate: outDate
                    },
                },
                {
                    _id: '_x00011',
                    tokenTransferId: 'x00011',
                    tokenId: 't00001',
                    sendingDeviceId: 'd00001',
                    receivingDeviceId: 'd00002',
                    progress: {
                        done: true,
                        success: true,
                        finishDate: inProcessedDate
                    },
                },
                {
                    _id: '_x00012',
                    tokenTransferId: 'x00012',
                    tokenId: 't00001',
                    sendingDeviceId: 'd00001',
                    receivingDeviceId: 'd00002',
                    progress: {
                        done: true,
                        success: true,
                        finishDate: inProcessedDate
                    },
                },
                {
                    _id: '_x00013',
                    tokenTransferId: 'x00013',
                    tokenId: 't00001',
                    sendingDeviceId: 'd00001',
                    receivingDeviceId: 'd00002',
                    progress: {
                        done: true,
                        success: true,
                        finishDate: outDate
                    },
                },
                {
                    _id: '_x00014',
                    tokenTransferId: 'x00014',
                    tokenId: 't00001',
                    sendingDeviceId: 'd00001',
                    receivingDeviceId: 'd00002',
                    progress: {
                        done: true,
                        success: true,
                        finishDate: inProcessedDate
                    },
                },
            ];

            before(function (done) {
                Catenis.db.mongoCollection.NonFungibleTokenTransfer.drop()
                .then(() => {
                    docsNFTokenTransfer.forEach(doc => {
                        Catenis.db.collection.NonFungibleTokenTransfer.insert(doc);
                    });

                    done();
                })
                .catch(done);
            });

            it('should purge non-fungible token transfer database docs', function () {
                expect(Catenis.db.collection.NonFungibleTokenTransfer.find().count()).to.equal(docsNFTokenTransfer.length);

                NFTokenTransfer.initialize();

                expect(Catenis.db.collection.NonFungibleTokenTransfer.find().count())
                .to.equal(docsNFTokenTransfer.length - 5);
            });
        });
    });
});

function resetNFTokenStorage() {
    NFTokenStorage.prototype.__origMethods = {
        store: NFTokenStorage.prototype.store,
        retrieve: NFTokenStorage.prototype.retrieve,
    };

    NFTokenStorage.prototype.__callOrigMethod = function (name, ...args) {
        return this.__origMethods[name].call(this, ...args);
    };

    NFTokenStorage.prototype.store = function (readStream) {
        let promiseOutcome;
        const promise = new Promise((resolve, reject) => {
            promiseOutcome = {
                resolve,
                reject
            };
        });

        const cid = `QmabcdefghijklmnopqrstuvwxyzABCDEFGHIJKLM${_localIpfsStore.counter++}`;
        let writtenData = Buffer.from('');

        readStream.pipe(new stream.Writable({
            write(chunk, encoding, callback) {
                writtenData = Buffer.concat([writtenData, chunk]);
                callback();
            },
            final(callback) {
                _localIpfsStore.map.set(cid, writtenData);
                promiseOutcome.resolve(cid);
                callback();
            }
        }));

        return promise;
    }

    NFTokenStorage.prototype.retrieve = function (cid) {
        let foundNFToken;

        if ((foundNFToken = nfTokens.find(nfToken => nfToken.nfTokenInfo.contentsCID === cid))) {
            return stream.Readable.from(foundNFToken.nfTokenInfo.storedContents);
        }
        else if (_localIpfsStore.map.has(cid)) {
            return stream.Readable.from(_localIpfsStore.map.get(cid));
        }

        return this.__callOrigMethod('retrieve', cid);
    }
}

function resetNonFungibleToken() {
    // Replace NonFungibleToken class constructor
    LocalNonFungibleToken.prototype = NonFungibleToken.prototype;
    LocalNonFungibleToken.prototype.constructor = LocalNonFungibleToken;
    NonFungibleToken = LocalNonFungibleToken;

    // Replace static method to get NonFungibleToken instance
    NonFungibleToken.__origMethods = {
        getNFTokenByTokenId: NonFungibleToken.getNFTokenByTokenId
    };

    NonFungibleToken.__callOrigMethod = function (methodName, ...args) {
        return NonFungibleToken.__origMethods[methodName].apply(this, args);
    };

    NonFungibleToken.getNFTokenByTokenId = function (tokenId) {
        let foundNFToken;

        if ((foundNFToken = nfTokens.find(nfToken => nfToken.tokenId === tokenId))) {
            return foundNFToken;
        }
        else {
            return NonFungibleToken.__callOrigMethod('getDeviceByDeviceId', tokenId);
        }
    }
}

function resetDevice() {
    // Replace Device class constructor
    LocalDevice.prototype = Device.prototype;
    LocalDevice.prototype.constructor = LocalDevice;
    Device = LocalDevice;

    // Replace static method to get Device instance
    Device.__origMethods = {
        getDeviceByDeviceId: Device.getDeviceByDeviceId
    };

    Device.__callOrigMethod = function (methodName, ...args) {
        return Device.__origMethods[methodName].apply(this, args);
    };

    Device.getDeviceByDeviceId = function (deviceId) {
        let foundDevice;

        if ((foundDevice = devices.find(device => device.deviceId === deviceId))) {
            return foundDevice;
        }
        else {
            return Device.__callOrigMethod('getDeviceByDeviceId', deviceId);
        }
    }
}

function resetC3NodeClient() {
    C3NodeClient.prototype.__origMethods = {
        getNFTokenMetadataReadableStream: C3NodeClient.prototype.getNFTokenMetadataReadableStream,
    };

    C3NodeClient.prototype.__callOrigMethod = function (name, ...args) {
        return this.__origMethods[name].call(this, ...args);
    };

    C3NodeClient.prototype.getNFTokenMetadataReadableStream = function (tokenId, waitForParsing) {
        let foundNFToken;

        if ((foundNFToken = nfTokens.find(nfToken => nfToken.ccTokenId === tokenId))) {
            return stream.Readable.from(JSON.stringify(foundNFToken.nfTokenInfo.ccMetadata));
        }

        return this.__callOrigMethod('getNFTokenMetadataReadableStream', tokenId, waitForParsing);
    }
}
