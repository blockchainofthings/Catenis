/**
 * Created by claudio on 2022-07-29
 */

//console.log('[DataDecryptionTest.js]: This code just ran.');

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
import { DataDecryption } from '../DataDecryption';
import { EccLibraryProxy } from '../EccLibraryProxy';
import { Bip32 } from '../Bip32';
import { CryptoKeys } from '../CryptoKeys';


describe('DataDecryption module', function () {
    const cryptoKeysList = [];
    const testData = [
        {
            description: 'Single empty chunk',
            chunkDecryptInfo: {
                plainData: '',
                chunkBreaks: [
                    // [0]: chunk break weight; [1]: second decrypt argument
                    [1, true]
                ],
            }
        },
        {
            description: 'Single small chunk',
            chunkDecryptInfo: {
                plainData: 'Small data',
                chunkBreaks: [
                    // [0]: chunk break weight; [1]: second decrypt argument
                    [1, true]
                ],
            }
        },
        {
            description: 'Single large chunk',
            chunkDecryptInfo: {
                plainData: 'Line #1: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #2: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #3: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #4: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #5: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #6: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #7: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #8: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #9: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #10: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah',
                chunkBreaks: [
                    // [0]: chunk break weight; [1]: second decrypt argument
                    [1, true]
                ],
            }
        },
        {
            description: 'Single empty chunk (w/finalization call)',
            chunkDecryptInfo: {
                plainData: '',
                chunkBreaks: [
                    // [0]: chunk break weight; [1]: second decrypt argument
                    [1],
                    []
                ],
            }
        },
        {
            description: 'Single small chunk (w/finalization call)',
            chunkDecryptInfo: {
                plainData: 'Small data',
                chunkBreaks: [
                    // [0]: chunk break weight; [1]: second decrypt argument
                    [1],
                    []
                ],
            }
        },
        {
            description: 'Single large chunk (w/finalization call)',
            chunkDecryptInfo: {
                plainData: 'Line #1: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #2: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #3: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #4: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #5: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #6: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #7: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #8: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #9: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #10: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah',
                chunkBreaks: [
                    // [0]: chunk break weight; [1]: second decrypt argument
                    [1],
                    []
                ],
            }
        },
        {
            description: 'Multiple small chunks',
            chunkDecryptInfo: {
                plainData: 'OneTwoThree',
                chunkBreaks: [
                    // [0]: chunk break weight; [1]: second decrypt argument
                    [1],
                    [1],
                    [1, true],
                ],
            }
        },
        {
            description: 'Multiple small chunks w/empty chunk',
            chunkDecryptInfo: {
                plainData: 'OneThree',
                chunkBreaks: [
                    // [0]: chunk break weight; [1]: second decrypt argument
                    [1],
                    [0],
                    [1, true],
                ],
            }
        },
        {
            description: 'Multiple large chunks',
            chunkDecryptInfo: {
                plainData: 'Line #1: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #2: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #3: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #4: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #5: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #6: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #7: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #8: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #9: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #10: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #11: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #12: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #13: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #14: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #15: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #16: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #17: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #18: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #19: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #20: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #21: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #22: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #23: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #24: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #25: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #26: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #27: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #28: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #29: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #30: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah',
                chunkBreaks: [
                    // [0]: chunk break weight; [1]: second decrypt argument
                    [1],
                    [1],
                    [1, true],
                ],
            }
        },
        {
            description: 'Multiple small chunks (w/finalization call)',
            chunkDecryptInfo: {
                plainData: 'OneTwoThree',
                chunkBreaks: [
                    // [0]: chunk break weight; [1]: second decrypt argument
                    [1],
                    [1],
                    [1],
                    []
                ],
            }
        },
        {
            description: 'Multiple small chunks w/empty chunk (w/finalization call)',
            chunkDecryptInfo: {
                plainData: 'OneThree',
                chunkBreaks: [
                    // [0]: chunk break weight; [1]: second decrypt argument
                    [1],
                    [0],
                    [1],
                    []
                ],
            }
        },
        {
            description: 'Multiple large chunks (w/finalization call)',
            chunkDecryptInfo: {
                plainData: 'Line #1: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #2: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #3: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #4: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #5: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #6: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #7: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #8: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #9: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #10: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #11: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #12: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #13: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #14: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #15: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #16: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #17: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #18: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #19: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #20: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #21: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #22: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #23: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #24: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #25: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #26: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #27: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #28: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #29: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + 'Line #30: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah',
                chunkBreaks: [
                    // [0]: chunk break weight; [1]: second decrypt argument
                    [1],
                    [1],
                    [1],
                    []
                ],
            }
        },
    ];

    function getChunkDecryptArgs(chunkDecryptInfo, dstKeys, srcKeys) {
        srcKeys = srcKeys || dstKeys;
        const encryptedData = srcKeys.encryptData(chunkDecryptInfo.plainData, dstKeys);

        // Break up encrypted data into chunks
        const totalWeight = chunkDecryptInfo.chunkBreaks.reduce((sum, chunkBreak) => {
            if (typeof chunkBreak[0] === 'number') {
                sum += chunkBreak[0]
            }

            return sum;
        }, 0);
        const chunkDivisionLength = Math.ceil(encryptedData.length / totalWeight);

        const chunkDecryptArgs = [];
        let chunkStart = 0;

        for (const chunkBreak of chunkDecryptInfo.chunkBreaks) {
            if (chunkBreak[0] !== undefined) {
                const chunkEnd = chunkStart + chunkDivisionLength * chunkBreak[0];
                const argsEntry = [
                    encryptedData.slice(chunkStart, chunkEnd)
                ];

                if (chunkBreak[1] !== undefined) {
                    argsEntry.push(chunkBreak[1]);
                }

                chunkDecryptArgs.push(argsEntry);

                chunkStart = chunkEnd;
            }
            else {
                chunkDecryptArgs.push([]);
            }
        }

        return chunkDecryptArgs;
    }

    before(function() {
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

    xdescribe('Validate chunk break function', function() {
        let srcKeys, dstKeys;

        before(function() {
            srcKeys = cryptoKeysList[3];
            dstKeys = cryptoKeysList[1];
        });

        it('should correctly break test data into chunks', function() {
            for (const dataInfo of testData) {
                console.log(`>>>>>> ${dataInfo.description}`);
                console.log('>>>>>> chunkDecryptArgs:', require('util').inspect(getChunkDecryptArgs(dataInfo.chunkDecryptInfo, dstKeys, srcKeys), {depth: null}));
                console.log();
            }
            expect(true).to.be.true;
        });
    });

    describe('Public key hash IV encryption scheme', function () {
        let srcKeys, dstKeys;

        before(function () {
            srcKeys = cryptoKeysList[0];
            dstKeys = cryptoKeysList[1];
        });

        describe('No source crypto keys', function () {
            before(function () {
                dstKeys = srcKeys;
            });

            it('should fail to instantiate object: invalid params (dstKeys)', function () {
                expect(() => {
                    new DataDecryption({});
                })
                .to.throw(TypeError, 'Invalid dstKeys argument');
            });

            it('should fail to instantiate object: missing private key', function () {
                // Simulate a crypto key pair with no private key
                const cryptoKeys = CryptoKeys.random();
                cryptoKeys.keyPair = {};

                expect(cryptoKeys.hasPrivateKey()).to.be.false;

                expect(() => {
                    new DataDecryption(cryptoKeys);
                })
                .to.throw(Error, 'Unable to decrypt data: missing private key');
            });

            it('should fail to decrypt data: decryption already finalized', function () {
                let dataDecryption;

                expect(() => {
                    dataDecryption = new DataDecryption(dstKeys);
                })
                .not.to.throw();

                // Simulate a data decryption
                dataDecryption.decryptChunk(srcKeys.encryptData('This is only a test'), true);

                expect(() => {
                    dataDecryption.decryptChunk();
                })
                .to.throw(Error, 'Data decryption already finalized');
            });

            it('should fail to decrypt data: finalizing with no data', function () {
                let dataDecryption;

                expect(() => {
                    dataDecryption = new DataDecryption(dstKeys);
                })
                .not.to.throw();

                expect(() => {
                    dataDecryption.decryptChunk();
                })
                .to.throw(Error, /Failure decrypting data:.*:wrong final block length/);
            });

            it('should successfully decrypt data', function () {
                for (const dataInfo of testData) {
                    let dataDecryption;

                    expect(() => {
                        dataDecryption = new DataDecryption(dstKeys);
                    })
                    .not.to.throw(undefined, undefined, `${dataInfo.description}`);

                    expect(dataDecryption.inProgress).to.be.false;

                    const chunkDecryptArgs = getChunkDecryptArgs(dataInfo.chunkDecryptInfo, dstKeys);
                    let plainData = Buffer.from('');

                    for (let idx = 0, limit = chunkDecryptArgs.length; idx < limit; idx++) {
                        const chunkNum = idx + 1;
                        const args = chunkDecryptArgs[idx];
                        let plainChunk;

                        expect(() => {
                            plainChunk = dataDecryption.decryptChunk(...args);
                        })
                        .not.to.throw(undefined, undefined, `${dataInfo.description} - chunk #${chunkNum}`);

                        if (args[0] != null && args[1] !== true) {
                            expect(dataDecryption.inProgress).to.be.true;
                        }
                        else {
                            expect(dataDecryption.inProgress).to.be.false;
                        }

                        plainData = Buffer.concat([plainData, plainChunk]);
                    }

                    expect(plainData, `${dataInfo.description}`).to.deep.equal(Buffer.from(dataInfo.chunkDecryptInfo.plainData));
                }
            });
        });

        describe('With source crypto keys', function () {
            it('should fail to instantiate object: invalid params (srcKeys)', function () {
                expect(() => {
                    new DataDecryption(dstKeys, {});
                })
                .to.throw(TypeError, 'Invalid srcKeys argument');
            });

            it('should successfully decrypt data', function () {
                for (const dataInfo of testData) {
                    let dataDecryption;

                    expect(() => {
                        dataDecryption = new DataDecryption(dstKeys,srcKeys);
                    })
                    .not.to.throw(undefined, undefined, `${dataInfo.description}`);

                    const chunkDecryptArgs = getChunkDecryptArgs(dataInfo.chunkDecryptInfo, dstKeys, srcKeys);
                    let plainData = Buffer.from('');

                    for (let idx = 0, limit = chunkDecryptArgs.length; idx < limit; idx++) {
                        const chunkNum = idx + 1;
                        let plainChunk;

                        expect(() => {
                            plainChunk = dataDecryption.decryptChunk(...chunkDecryptArgs[idx]);
                        })
                        .not.to.throw(undefined, undefined, `${dataInfo.description} - chunk #${chunkNum}`);

                        plainData = Buffer.concat([plainData, plainChunk]);
                    }

                    expect(plainData, `${dataInfo.description}`).to.deep.equal(Buffer.from(dataInfo.chunkDecryptInfo.plainData));
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

        describe('No source crypto keys', function () {
            before(function () {
                dstKeys = srcKeys;
            });

            it('should fail to instantiate object: invalid params (dstKeys)', function () {
                expect(() => {
                    new DataDecryption({});
                })
                .to.throw(TypeError, 'Invalid dstKeys argument');
            });

            it('should successfully decrypt data', function () {
                for (const dataInfo of testData) {
                    let dataDecryption;

                    expect(() => {
                        dataDecryption = new DataDecryption(dstKeys);
                    })
                    .not.to.throw(undefined, undefined, `${dataInfo.description}`);

                    const chunkDecryptArgs = getChunkDecryptArgs(dataInfo.chunkDecryptInfo, dstKeys);
                    let plainData = Buffer.from('');

                    for (let idx = 0, limit = chunkDecryptArgs.length; idx < limit; idx++) {
                        const chunkNum = idx + 1;
                        let plainChunk;

                        expect(() => {
                            plainChunk = dataDecryption.decryptChunk(...chunkDecryptArgs[idx]);
                        })
                        .not.to.throw(undefined, undefined, `${dataInfo.description} - chunk #${chunkNum}`);

                        plainData = Buffer.concat([plainData, plainChunk]);
                    }

                    expect(plainData, `${dataInfo.description}`).to.deep.equal(Buffer.from(dataInfo.chunkDecryptInfo.plainData));
                }
            });
        });

        describe('With source crypto keys', function () {
            it('should fail to instantiate object: invalid params (srcKeys)', function () {
                expect(() => {
                    new DataDecryption(dstKeys, {});
                })
                .to.throw(TypeError, 'Invalid srcKeys argument');
            });

            it('should successfully decrypt data', function () {
                for (const dataInfo of testData) {
                    let dataDecryption;

                    expect(() => {
                        dataDecryption = new DataDecryption(dstKeys,srcKeys);
                    })
                    .not.to.throw(undefined, undefined, `${dataInfo.description}`);

                    const chunkDecryptArgs = getChunkDecryptArgs(dataInfo.chunkDecryptInfo, dstKeys, srcKeys);
                    let plainData = Buffer.from('');

                    for (let idx = 0, limit = chunkDecryptArgs.length; idx < limit; idx++) {
                        const chunkNum = idx + 1;
                        let plainChunk;

                        expect(() => {
                            plainChunk = dataDecryption.decryptChunk(...chunkDecryptArgs[idx]);
                        })
                        .not.to.throw(undefined, undefined, `${dataInfo.description} - chunk #${chunkNum}`);

                        plainData = Buffer.concat([plainData, plainChunk]);
                    }

                    expect(plainData, `${dataInfo.description}`).to.deep.equal(Buffer.from(dataInfo.chunkDecryptInfo.plainData));
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

        describe('No source crypto keys', function () {
            before(function () {
                dstKeys = srcKeys;
            });

            it('should fail to instantiate object: invalid params (dstKeys)', function () {
                expect(() => {
                    new DataDecryption({});
                })
                .to.throw(TypeError, 'Invalid dstKeys argument');
            });

            it('should fail to decrypt data: missing IV', function () {
                let dataDecryption;

                expect(() => {
                    dataDecryption = new DataDecryption(dstKeys);
                })
                .not.to.throw();

                expect(() => {
                    dataDecryption.decryptChunk(Buffer.from('0102030405', 'hex'), true);
                })
                .to.throw(Error, 'Failure decrypting data: Error: Missing or inconsistent IV');
            });

            it('should successfully decrypt data', function () {
                for (const dataInfo of testData) {
                    let dataDecryption;

                    expect(() => {
                        dataDecryption = new DataDecryption(dstKeys);
                    })
                    .not.to.throw(undefined, undefined, `${dataInfo.description}`);

                    const chunkDecryptArgs = getChunkDecryptArgs(dataInfo.chunkDecryptInfo, dstKeys);
                    let plainData = Buffer.from('');

                    for (let idx = 0, limit = chunkDecryptArgs.length; idx < limit; idx++) {
                        const chunkNum = idx + 1;
                        let plainChunk;

                        expect(() => {
                            plainChunk = dataDecryption.decryptChunk(...chunkDecryptArgs[idx]);
                        })
                        .not.to.throw(undefined, undefined, `${dataInfo.description} - chunk #${chunkNum}`);

                        plainData = Buffer.concat([plainData, plainChunk]);
                    }

                    expect(plainData, `${dataInfo.description}`).to.deep.equal(Buffer.from(dataInfo.chunkDecryptInfo.plainData));
                }
            });
        });

        describe('With source crypto keys', function () {
            it('should fail to instantiate object: invalid params (srcKeys)', function () {
                expect(() => {
                    new DataDecryption(dstKeys, {});
                })
                .to.throw(TypeError, 'Invalid srcKeys argument');
            });

            it('should successfully decrypt data', function () {
                for (const dataInfo of testData) {
                    let dataDecryption;

                    expect(() => {
                        dataDecryption = new DataDecryption(dstKeys,srcKeys);
                    })
                    .not.to.throw(undefined, undefined, `${dataInfo.description}`);

                    const chunkDecryptArgs = getChunkDecryptArgs(dataInfo.chunkDecryptInfo, dstKeys, srcKeys);
                    let plainData = Buffer.from('');

                    for (let idx = 0, limit = chunkDecryptArgs.length; idx < limit; idx++) {
                        const chunkNum = idx + 1;
                        let plainChunk;

                        expect(() => {
                            plainChunk = dataDecryption.decryptChunk(...chunkDecryptArgs[idx]);
                        })
                        .not.to.throw(undefined, undefined, `${dataInfo.description} - chunk #${chunkNum}`);

                        plainData = Buffer.concat([plainData, plainChunk]);
                    }

                    expect(plainData, `${dataInfo.description}`).to.deep.equal(Buffer.from(dataInfo.chunkDecryptInfo.plainData));
                }
            });
        });
    });
});
