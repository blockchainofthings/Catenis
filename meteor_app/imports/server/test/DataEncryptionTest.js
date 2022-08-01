/**
 * Created by claudio on 2022-07-28
 */

//console.log('[DataEncryptionTest.js]: This code just ran.');

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
//import { Catenis } from '../Catenis';
import { DataEncryption } from '../DataEncryption';
import { EccLibraryProxy } from '../EccLibraryProxy';
import { Bip32 } from '../Bip32';
import { CryptoKeys } from '../CryptoKeys';


describe('DataEncryption module', function () {
    const cryptoKeysList = [];
    const testData = [
        {
            description: 'No data (immediate finalization call)',
            chunkEncryptArgs: [
                []
            ]
        },
        {
            description: 'Single empty chunk',
            chunkEncryptArgs: [
                ['', true]
            ]
        },
        {
            description: 'Single small chunk',
            chunkEncryptArgs: [
                ['Small data', true]
            ]
        },
        {
            description: 'Single large chunk',
            chunkEncryptArgs: [
                [
                    'Line #1: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #2: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #3: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #4: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #5: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #6: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #7: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #8: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #9: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #10: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah',
                    true
                ]
            ]
        },
        {
            description: 'Single empty chunk (w/finalization call)',
            chunkEncryptArgs: [
                [''],
                []
            ]
        },
        {
            description: 'Single small chunk (w/finalization call)',
            chunkEncryptArgs: [
                ['Small data'],
                []
            ]
        },
        {
            description: 'Single large chunk (w/finalization call)',
            chunkEncryptArgs: [
                [
                    'Line #1: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #2: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #3: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #4: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #5: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #6: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #7: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #8: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #9: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #10: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                ],
                []
            ]
        },
        {
            description: 'Multiple small chunks',
            chunkEncryptArgs: [
                ['One'],
                ['Two'],
                ['Three', true]
            ]
        },
        {
            description: 'Multiple small chunks w/empty chunk',
            chunkEncryptArgs: [
                ['One'],
                [''],
                ['Three', true]
            ]
        },
        {
            description: 'Multiple large chunks',
            chunkEncryptArgs: [
                [
                    'Line #1: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #2: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #3: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #4: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #5: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #6: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #7: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #8: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #9: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #10: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                ],
                [
                    'Line #11: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #12: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #13: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #14: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #15: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #16: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #17: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #18: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #19: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #20: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                ],
                [
                    'Line #21: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #22: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #23: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #24: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #25: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #26: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #27: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #28: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #29: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #30: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah',
                    true
                ]
            ]
        },
        {
            description: 'Multiple small chunks (w/finalization call)',
            chunkEncryptArgs: [
                ['One'],
                ['Two'],
                ['Three'],
                []
            ]
        },
        {
            description: 'Multiple small chunks w/empty chunk (w/finalization call)',
            chunkEncryptArgs: [
                ['One'],
                [''],
                ['Three'],
                []
            ]
        },
        {
            description: 'Multiple large chunks (w/finalization call)',
            chunkEncryptArgs: [
                [
                    'Line #1: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #2: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #3: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #4: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #5: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #6: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #7: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #8: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #9: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #10: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                ],
                [
                    'Line #11: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #12: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #13: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #14: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #15: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #16: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #17: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #18: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #19: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #20: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                ],
                [
                    'Line #21: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #22: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #23: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #24: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #25: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #26: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #27: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #28: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #29: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #30: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                ],
                []
            ]
        },
    ];

    before(function () {
        EccLibraryProxy.initialize();
        Bip32.initialize();

        // Create crypto keys
        for (let i = 0; i < 4; i++) {
            cryptoKeysList.push(CryptoKeys.random());
        }

        // Reset encryption scheme of some crypto keys
        cryptoKeysList[2].encryptionScheme = CryptoKeys.encryptionScheme.fixedIV;
        cryptoKeysList[3].encryptionScheme = CryptoKeys.encryptionScheme.randomIV;
    });

    describe('Public key hash IV encryption scheme', function () {
        let srcKeys, dstKeys;

        before(function () {
            srcKeys = cryptoKeysList[0];
            dstKeys = cryptoKeysList[1];
        });

        describe('No destination crypto keys', function () {
            it('should fail to instantiate object: invalid params (srcKeys)', function () {
                expect(() => {
                    new DataEncryption({});
                })
                .to.throw(TypeError, 'Invalid srcKeys argument');
            });

            it('should fail to instantiate object: missing private key', function () {
                // Simulate a crypto key pair with no private key
                const cryptoKeys = CryptoKeys.random();
                cryptoKeys.keyPair = {};

                expect(cryptoKeys.hasPrivateKey()).to.be.false;

                expect(() => {
                    new DataEncryption(cryptoKeys);
                })
                .to.throw(Error, 'Unable to encrypt data: missing private key');
            });

            it('should fail to encrypt data: encryption already finalized', function () {
                let dataEncryption;

                expect(() => {
                    dataEncryption = new DataEncryption(srcKeys);
                })
                .not.to.throw();

                // Simulate a data encryption
                dataEncryption.encryptChunk('This is only a test', true);

                expect(() => {
                    dataEncryption.encryptChunk();
                })
                .to.throw(Error, 'Data encryption already finalized');
            });

            it('should successfully encrypt data', function () {
                for (const dataInfo of testData) {
                    for (const dataType of ['string', 'Buffer']) {
                        let dataEncryption;

                        expect(() => {
                            dataEncryption = new DataEncryption(srcKeys);
                        })
                        .not.to.throw(undefined, undefined, `${dataInfo.description} [${dataType}]`);

                        expect(dataEncryption.inProgress).to.be.false;

                        let completeData = dataType === 'Buffer' ? Buffer.from('') : '';
                        let encryptedData = Buffer.from('');

                        for (let idx = 0, limit = dataInfo.chunkEncryptArgs.length; idx < limit; idx++) {
                            const chunkNum = idx + 1;
                            const args = dataInfo.chunkEncryptArgs[idx];

                            if (args[0] != null) {
                                if (dataType === 'Buffer') {
                                    completeData = Buffer.concat([completeData, Buffer.from(args[0])]);
                                }
                                else {
                                    completeData += args[0];
                                }
                            }

                            let encryptedChunk;

                            expect(() => {
                                encryptedChunk = dataEncryption.encryptChunk(...args);
                            })
                            .not.to.throw(undefined, undefined, `${dataInfo.description} [${dataType}] - chunk #${chunkNum}`);

                            if (args[0] != null && args[1] !== true) {
                                expect(dataEncryption.inProgress).to.be.true;
                            }
                            else {
                                expect(dataEncryption.inProgress).to.be.false;
                            }

                            encryptedData = Buffer.concat([encryptedData, encryptedChunk]);
                        }

                        expect(srcKeys.decryptData(encryptedData), `${dataInfo.description} [${dataType}]`)
                        .to.deep.equal(Buffer.from(completeData));
                    }
                }
            });
        });

        describe('With destination crypto keys', function () {
            it('should fail to instantiate object: invalid params (dstKeys)', function () {
                expect(() => {
                    new DataEncryption(srcKeys, {});
                })
                .to.throw(TypeError, 'Invalid dstKeys argument');
            });

            it('should successfully encrypt data', function () {
                for (const dataInfo of testData) {
                    for (const dataType of ['string', 'Buffer']) {
                        let dataEncryption;

                        expect(() => {
                            dataEncryption = new DataEncryption(srcKeys, dstKeys);
                        })
                        .not.to.throw(undefined, undefined, `${dataInfo.description} [${dataType}]`);

                        let completeData = dataType === 'Buffer' ? Buffer.from('') : '';
                        let encryptedData = Buffer.from('');

                        for (let idx = 0, limit = dataInfo.chunkEncryptArgs.length; idx < limit; idx++) {
                            const chunkNum = idx + 1;
                            const args = dataInfo.chunkEncryptArgs[idx];

                            if (args[0] != null) {
                                if (dataType === 'Buffer') {
                                    completeData = Buffer.concat([completeData, Buffer.from(args[0])]);
                                }
                                else {
                                    completeData += args[0];
                                }
                            }

                            let encryptedChunk;

                            expect(() => {
                                encryptedChunk = dataEncryption.encryptChunk(...args);
                            })
                            .not.to.throw(undefined, undefined, `${dataInfo.description} [${dataType}] - chunk #${chunkNum}`);

                            encryptedData = Buffer.concat([encryptedData, encryptedChunk]);
                        }

                        expect(dstKeys.decryptData(encryptedData, srcKeys), `${dataInfo.description} [${dataType}]`)
                        .to.deep.equal(Buffer.from(completeData));
                    }
                }
            });
        });
    });

    describe('Fixed IV encryption scheme', function () {
        let srcKeys, dstKeys;

        before(function () {
            srcKeys = cryptoKeysList[2];
            dstKeys = cryptoKeysList[1];
        });

        describe('No destination crypto keys', function () {
            it('should fail to instantiate object: invalid params (srcKeys)', function () {
                expect(() => {
                    new DataEncryption({});
                })
                .to.throw(TypeError, 'Invalid srcKeys argument');
            });

            it('should successfully encrypt data', function () {
                for (const dataInfo of testData) {
                    for (const dataType of ['string', 'Buffer']) {
                        let dataEncryption;

                        expect(() => {
                            dataEncryption = new DataEncryption(srcKeys);
                        })
                        .not.to.throw(undefined, undefined, `${dataInfo.description} [${dataType}]`);

                        let completeData = dataType === 'Buffer' ? Buffer.from('') : '';
                        let encryptedData = Buffer.from('');

                        for (let idx = 0, limit = dataInfo.chunkEncryptArgs.length; idx < limit; idx++) {
                            const chunkNum = idx + 1;
                            const args = dataInfo.chunkEncryptArgs[idx];

                            if (args[0] != null) {
                                if (dataType === 'Buffer') {
                                    completeData = Buffer.concat([completeData, Buffer.from(args[0])]);
                                }
                                else {
                                    completeData += args[0];
                                }
                            }

                            let encryptedChunk;

                            expect(() => {
                                encryptedChunk = dataEncryption.encryptChunk(...args);
                            })
                            .not.to.throw(undefined, undefined, `${dataInfo.description} [${dataType}] - chunk #${chunkNum}`);

                            encryptedData = Buffer.concat([encryptedData, encryptedChunk]);
                        }

                        expect(srcKeys.decryptData(encryptedData), `${dataInfo.description} [${dataType}]`)
                        .to.deep.equal(Buffer.from(completeData));
                    }
                }
            });
        });

        describe('With destination crypto keys', function () {
            it('should fail to instantiate object: invalid params (dstKeys)', function () {
                expect(() => {
                    new DataEncryption(srcKeys, {});
                })
                .to.throw(TypeError, 'Invalid dstKeys argument');
            });

            it('should successfully encrypt data', function () {
                for (const dataInfo of testData) {
                    for (const dataType of ['string', 'Buffer']) {
                        let dataEncryption;

                        expect(() => {
                            dataEncryption = new DataEncryption(srcKeys, dstKeys);
                        })
                        .not.to.throw(undefined, undefined, `${dataInfo.description} [${dataType}]`);

                        let completeData = dataType === 'Buffer' ? Buffer.from('') : '';
                        let encryptedData = Buffer.from('');

                        for (let idx = 0, limit = dataInfo.chunkEncryptArgs.length; idx < limit; idx++) {
                            const chunkNum = idx + 1;
                            const args = dataInfo.chunkEncryptArgs[idx];

                            if (args[0] != null) {
                                if (dataType === 'Buffer') {
                                    completeData = Buffer.concat([completeData, Buffer.from(args[0])]);
                                }
                                else {
                                    completeData += args[0];
                                }
                            }

                            let encryptedChunk;

                            expect(() => {
                                encryptedChunk = dataEncryption.encryptChunk(...args);
                            })
                            .not.to.throw(undefined, undefined, `${dataInfo.description} [${dataType}] - chunk #${chunkNum}`);

                            encryptedData = Buffer.concat([encryptedData, encryptedChunk]);
                        }

                        expect(dstKeys.decryptData(encryptedData, srcKeys), `${dataInfo.description} [${dataType}]`)
                        .to.deep.equal(Buffer.from(completeData));
                    }
                }
            });
        });
    });

    describe('Random IV encryption scheme', function () {
        let srcKeys, dstKeys;

        before(function () {
            srcKeys = cryptoKeysList[3];
            dstKeys = cryptoKeysList[1];
        });

        describe('No destination crypto keys', function () {
            it('should fail to instantiate object: invalid params (srcKeys)', function () {
                expect(() => {
                    new DataEncryption({});
                })
                .to.throw(TypeError, 'Invalid srcKeys argument');
            });

            it('should successfully encrypt data', function () {
                for (const dataInfo of testData) {
                    for (const dataType of ['string', 'Buffer']) {
                        let dataEncryption;

                        expect(() => {
                            dataEncryption = new DataEncryption(srcKeys);
                        })
                        .not.to.throw(undefined, undefined, `${dataInfo.description} [${dataType}]`);

                        let completeData = dataType === 'Buffer' ? Buffer.from('') : '';
                        let encryptedData = Buffer.from('');

                        for (let idx = 0, limit = dataInfo.chunkEncryptArgs.length; idx < limit; idx++) {
                            const chunkNum = idx + 1;
                            const args = dataInfo.chunkEncryptArgs[idx];

                            if (args[0] != null) {
                                if (dataType === 'Buffer') {
                                    completeData = Buffer.concat([completeData, Buffer.from(args[0])]);
                                }
                                else {
                                    completeData += args[0];
                                }
                            }

                            let encryptedChunk;

                            expect(() => {
                                encryptedChunk = dataEncryption.encryptChunk(...args);
                            })
                            .not.to.throw(undefined, undefined, `${dataInfo.description} [${dataType}] - chunk #${chunkNum}`);

                            encryptedData = Buffer.concat([encryptedData, encryptedChunk]);
                        }

                        expect(srcKeys.decryptData(encryptedData), `${dataInfo.description} [${dataType}]`)
                        .to.deep.equal(Buffer.from(completeData));
                    }
                }
            });
        });

        describe('With destination crypto keys', function () {
            it('should fail to instantiate object: invalid params (dstKeys)', function () {
                expect(() => {
                    new DataEncryption(srcKeys, {});
                })
                .to.throw(TypeError, 'Invalid dstKeys argument');
            });

            it('should successfully encrypt data', function () {
                for (const dataInfo of testData) {
                    for (const dataType of ['string', 'Buffer']) {
                        let dataEncryption;

                        expect(() => {
                            dataEncryption = new DataEncryption(srcKeys, dstKeys);
                        })
                        .not.to.throw(undefined, undefined, `${dataInfo.description} [${dataType}]`);

                        let completeData = dataType === 'Buffer' ? Buffer.from('') : '';
                        let encryptedData = Buffer.from('');

                        for (let idx = 0, limit = dataInfo.chunkEncryptArgs.length; idx < limit; idx++) {
                            const chunkNum = idx + 1;
                            const args = dataInfo.chunkEncryptArgs[idx];

                            if (args[0] != null) {
                                if (dataType === 'Buffer') {
                                    completeData = Buffer.concat([completeData, Buffer.from(args[0])]);
                                }
                                else {
                                    completeData += args[0];
                                }
                            }

                            let encryptedChunk;

                            expect(() => {
                                encryptedChunk = dataEncryption.encryptChunk(...args);
                            })
                            .not.to.throw(undefined, undefined, `${dataInfo.description} [${dataType}] - chunk #${chunkNum}`);

                            encryptedData = Buffer.concat([encryptedData, encryptedChunk]);
                        }

                        expect(dstKeys.decryptData(encryptedData, srcKeys), `${dataInfo.description} [${dataType}]`)
                        .to.deep.equal(Buffer.from(completeData));
                    }
                }
            });
        });
    });
});
