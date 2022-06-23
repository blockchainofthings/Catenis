/**
 * Created by claudio on 2022-03-04
 */

//console.log('[NFTokenSourceTest.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import { expect } from 'chai';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
//import { Catenis } from '../Catenis';
import { BitcoinCore } from '../BitcoinCore';
import { C3NodeClient } from '../C3NodeClient';
import { CCTransaction } from '../CCTransaction';
import { NFTokenSource } from '../NFTokenSource';


describe('NFTokenSource module', function () {
    before(function () {
        resetC3NodeClient();
        C3NodeClient.initialize();
        resetBitcoinCore();
        BitcoinCore.initialize();
    });

    describe('Find UTXO holding a given non-fungible token', function () {
        before(function () {
            setTestDataForGetAddressesUtxos(utxosTestData1);
        });

        describe('Search only for confirmed UTXOs', function () {
            const nfTokenSourceOpts = {
                useUnconfirmedUtxo: false
            };

            it('should find confirmed UTXO with single non-fungible token', function () {
                const nfTokenSrc = new NFTokenSource(
                    'Tk97fk8Rg27toQW68faxhnDuYeFEoLC1fYfiE1',
                    [
                        'bcrt1q0zxcuyjwx6fa8g7j0dhxe7judv7l7986rtp8r6',
                        'bcrt1qnhjvnjumn0s9led0gtzka58g8gwzmwy8z5f74c',
                        'bcrt1q5jnhe0gnfucp97hsn0km7zcqxdp2jyl8cyvqkv',
                        'bcrt1qxpd89mf77l3q43ajmwwcxms2smc4uyqh3xpknm',
                        'bcrt1qp54d8p5jd657lre040c4wn2rdvfj2x98ma06n5'
                    ],
                    nfTokenSourceOpts
                );

                expect(nfTokenSrc.holdingUtxoFound).to.be.true;
                expect(nfTokenSrc.holdingUtxo).to.deep.equal({
                    address: 'bcrt1q0zxcuyjwx6fa8g7j0dhxe7judv7l7986rtp8r6',
                    txout: {
                        txid: '841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff',
                        vout: 0,
                        amount: 600,
                        ccAssetId: 'LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v',
                        assetAmount: 1,
                        assetDivisibility: 0,
                        isAggregatableAsset: false,
                        isNonFungible: true,
                        ccTokenIds: [
                            'Tk97fk8Rg27toQW68faxhnDuYeFEoLC1fYfiE1'
                        ]
                    },
                    isWitness: true,
                    scriptPubKey: '0014788d8e124e3693d3a3d27b6e6cfa5c6b3dff14fa',
                    tokenIndex: 0
                });
            });

            it('should find confirmed UTXO with multiple non-fungible tokens (first of a set)', function () {
                const nfTokenSrc = new NFTokenSource(
                    'Tk97fk8Rg27toQW68faxhnDuYeFEoLC1K4DLji',
                    [
                        'bcrt1q0zxcuyjwx6fa8g7j0dhxe7judv7l7986rtp8r6',
                        'bcrt1qnhjvnjumn0s9led0gtzka58g8gwzmwy8z5f74c',
                        'bcrt1q5jnhe0gnfucp97hsn0km7zcqxdp2jyl8cyvqkv',
                        'bcrt1qxpd89mf77l3q43ajmwwcxms2smc4uyqh3xpknm',
                        'bcrt1qp54d8p5jd657lre040c4wn2rdvfj2x98ma06n5'
                    ],
                    nfTokenSourceOpts
                );

                expect(nfTokenSrc.holdingUtxoFound).to.be.true;
                expect(nfTokenSrc.holdingUtxo).to.deep.equal({
                    address: 'bcrt1q5jnhe0gnfucp97hsn0km7zcqxdp2jyl8cyvqkv',
                    txout: {
                        txid: '841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff',
                        vout: 2,
                        amount: 600,
                        ccAssetId: 'LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v',
                        assetAmount: 3,
                        assetDivisibility: 0,
                        isAggregatableAsset: false,
                        isNonFungible: true,
                        ccTokenIds: [
                            'Tk97fk8Rg27toQW68faxhnDuYeFEoLC1K4DLji',
                            'Tk97fk8Rg27toQW68faxhnDuYeFEoLC1Tuiw2M',
                            'Tk97fk8Rg27toQW68faxhnDuYeFEoLC1bFs2is'
                        ]
                    },
                    isWitness: true,
                    scriptPubKey: '0014788d8e124e3693d3a3d27b6e6cfa5c6b3dff14fa',
                    tokenIndex: 0
                });
            });

            it('should find confirmed UTXO with multiple non-fungible tokens (in the middle of a set)', function () {
                const nfTokenSrc = new NFTokenSource(
                    'Tk97fk8Rg27toQW68faxhnDuYeFEoLC1Tuiw2M',
                    [
                        'bcrt1q0zxcuyjwx6fa8g7j0dhxe7judv7l7986rtp8r6',
                        'bcrt1qnhjvnjumn0s9led0gtzka58g8gwzmwy8z5f74c',
                        'bcrt1q5jnhe0gnfucp97hsn0km7zcqxdp2jyl8cyvqkv',
                        'bcrt1qxpd89mf77l3q43ajmwwcxms2smc4uyqh3xpknm',
                        'bcrt1qp54d8p5jd657lre040c4wn2rdvfj2x98ma06n5'
                    ],
                    nfTokenSourceOpts
                );

                expect(nfTokenSrc.holdingUtxoFound).to.be.true;
                expect(nfTokenSrc.holdingUtxo).to.deep.equal({
                    address: 'bcrt1q5jnhe0gnfucp97hsn0km7zcqxdp2jyl8cyvqkv',
                    txout: {
                        txid: '841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff',
                        vout: 2,
                        amount: 600,
                        ccAssetId: 'LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v',
                        assetAmount: 3,
                        assetDivisibility: 0,
                        isAggregatableAsset: false,
                        isNonFungible: true,
                        ccTokenIds: [
                            'Tk97fk8Rg27toQW68faxhnDuYeFEoLC1K4DLji',
                            'Tk97fk8Rg27toQW68faxhnDuYeFEoLC1Tuiw2M',
                            'Tk97fk8Rg27toQW68faxhnDuYeFEoLC1bFs2is'
                        ]
                    },
                    isWitness: true,
                    scriptPubKey: '0014788d8e124e3693d3a3d27b6e6cfa5c6b3dff14fa',
                    tokenIndex: 1
                });
            });

            it('should find confirmed UTXO with multiple non-fungible tokens (last of a set)', function () {
                const nfTokenSrc = new NFTokenSource(
                    'Tk97fk8Rg27toQW68faxhnDuYeFEoK6GZ1AedZ',
                    [
                        'bcrt1q0zxcuyjwx6fa8g7j0dhxe7judv7l7986rtp8r6',
                        'bcrt1qnhjvnjumn0s9led0gtzka58g8gwzmwy8z5f74c',
                        'bcrt1q5jnhe0gnfucp97hsn0km7zcqxdp2jyl8cyvqkv',
                        'bcrt1qxpd89mf77l3q43ajmwwcxms2smc4uyqh3xpknm',
                        'bcrt1qp54d8p5jd657lre040c4wn2rdvfj2x98ma06n5'
                    ],
                    nfTokenSourceOpts
                );

                expect(nfTokenSrc.holdingUtxoFound).to.be.true;
                expect(nfTokenSrc.holdingUtxo).to.deep.equal({
                    address: 'bcrt1qxpd89mf77l3q43ajmwwcxms2smc4uyqh3xpknm',
                    txout: {
                        txid: '254f30129b88b65a9a35378c71a3724aa946c7b0e2696f999a34d5227bde0fe7',
                        vout: 3,
                        amount: 600,
                        ccAssetId: 'Un4zg8Ku1CQvPca9y6wJSPWdV2xkM5BWCnppoD',
                        assetAmount: 2,
                        assetDivisibility: 0,
                        isAggregatableAsset: false,
                        isNonFungible: true,
                        ccTokenIds: [
                            'Tk97fk8Rg27toQW68faxhnDuYeFEoK6GNnWDAH',
                            'Tk97fk8Rg27toQW68faxhnDuYeFEoK6GZ1AedZ'
                        ]
                    },
                    isWitness: true,
                    scriptPubKey: '0014305a72ed3ef7e20ac7b2db9d836e0a86f15e1017',
                    tokenIndex: 1
                });
            });
        });

        describe('Search for both confirmed and unconfirmed UTXOs', function () {
            const nfTokenSourceOpts = {
                useUnconfirmedUtxo: true
            };

            before(function () {
                setTestDataForGetMempoolEntry(mempoolTestData1);
                setTestDataForGetMempoolAncestors(mempoolTestData1);
            });

            it('should find unconfirmed UTXO with single non-fungible token', function () {
                const nfTokenSrc = new NFTokenSource(
                    'Tk97fk8Rg27toQW68faxhnDuYeFEoK6GcCUm9A',
                    [
                        'bcrt1q0zxcuyjwx6fa8g7j0dhxe7judv7l7986rtp8r6',
                        'bcrt1qnhjvnjumn0s9led0gtzka58g8gwzmwy8z5f74c',
                        'bcrt1q5jnhe0gnfucp97hsn0km7zcqxdp2jyl8cyvqkv',
                        'bcrt1qxpd89mf77l3q43ajmwwcxms2smc4uyqh3xpknm',
                        'bcrt1qp54d8p5jd657lre040c4wn2rdvfj2x98ma06n5'
                    ],
                    nfTokenSourceOpts
                );

                expect(nfTokenSrc.holdingUtxoFound).to.be.true;
                expect(nfTokenSrc.holdingUtxo).to.deep.equal({
                    address: 'bcrt1qnhjvnjumn0s9led0gtzka58g8gwzmwy8z5f74c',
                    txout: {
                        txid: '9e358d137e52bfe84b74ec0ad9303238b2b71dfafcdad282bce288ecf80326fb',
                        vout: 1,
                        amount: 600,
                        ccAssetId: 'Un4zg8Ku1CQvPca9y6wJSPWdV2xkM5BWCnppoD',
                        assetAmount: 1,
                        assetDivisibility: 0,
                        isAggregatableAsset: false,
                        isNonFungible: true,
                        ccTokenIds: [
                            'Tk97fk8Rg27toQW68faxhnDuYeFEoK6GcCUm9A'
                        ]
                    },
                    isWitness: true,
                    scriptPubKey: '00149de4c9cb9b9be05fe5af42c56ed0e83a1c2db887',
                    tokenIndex: 0
                });
            });

            it('should find unconfirmed UTXO with multiple non-fungible tokens (last of a set)', function () {
                const nfTokenSrc = new NFTokenSource(
                    'Tk97fk8Rg27toQW68faxhnDuYeFEoLC1s2bHJK',
                    [
                        'bcrt1q0zxcuyjwx6fa8g7j0dhxe7judv7l7986rtp8r6',
                        'bcrt1qnhjvnjumn0s9led0gtzka58g8gwzmwy8z5f74c',
                        'bcrt1q5jnhe0gnfucp97hsn0km7zcqxdp2jyl8cyvqkv',
                        'bcrt1qxpd89mf77l3q43ajmwwcxms2smc4uyqh3xpknm',
                        'bcrt1qp54d8p5jd657lre040c4wn2rdvfj2x98ma06n5'
                    ],
                    nfTokenSourceOpts
                );

                expect(nfTokenSrc.holdingUtxoFound).to.be.true;
                expect(nfTokenSrc.holdingUtxo).to.deep.equal({
                    address: 'bcrt1qp54d8p5jd657lre040c4wn2rdvfj2x98ma06n5',
                    txout: {
                        txid: '5f28421c20e784761fc87f37bb5546cc5687b206fe3cb2af658360fb0db2fefc',
                        vout: 4,
                        amount: 600,
                        ccAssetId: 'LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v',
                        assetAmount: 2,
                        assetDivisibility: 0,
                        isAggregatableAsset: false,
                        isNonFungible: true,
                        ccTokenIds: [
                            'Tk97fk8Rg27toQW68faxhnDuYeFEoLC1oDykd9',
                            'Tk97fk8Rg27toQW68faxhnDuYeFEoLC1s2bHJK'
                        ]
                    },
                    isWitness: true,
                    scriptPubKey: '00140d2ad386926ea9ef8f2fabf1574d436b132518a7',
                    tokenIndex: 1
                });
            });

            describe('Missing unconfirmed transaction', function () {
                before(function () {
                    setTestDataForGetMempoolEntry(mempoolTestData2);
                    setTestDataForGetMempoolAncestors(mempoolTestData2);
                    setTestDataForGetTransaction(txsTestData1);
                });

                it('should find unconfirmed UTXO (missing from mempool, already confirmed) with single non-fungible token', function () {
                    const nfTokenSrc = new NFTokenSource(
                        'Tk97fk8Rg27toQW68faxhnDuYeFEoK6GcCUm9A',
                        [
                            'bcrt1q0zxcuyjwx6fa8g7j0dhxe7judv7l7986rtp8r6',
                            'bcrt1qnhjvnjumn0s9led0gtzka58g8gwzmwy8z5f74c',
                            'bcrt1q5jnhe0gnfucp97hsn0km7zcqxdp2jyl8cyvqkv',
                            'bcrt1qxpd89mf77l3q43ajmwwcxms2smc4uyqh3xpknm',
                            'bcrt1qp54d8p5jd657lre040c4wn2rdvfj2x98ma06n5'
                        ],
                        nfTokenSourceOpts
                    );

                    expect(nfTokenSrc.holdingUtxoFound).to.be.true;
                    expect(nfTokenSrc.holdingUtxo).to.deep.equal({
                        address: 'bcrt1qnhjvnjumn0s9led0gtzka58g8gwzmwy8z5f74c',
                        txout: {
                            txid: '9e358d137e52bfe84b74ec0ad9303238b2b71dfafcdad282bce288ecf80326fb',
                            vout: 1,
                            amount: 600,
                            ccAssetId: 'Un4zg8Ku1CQvPca9y6wJSPWdV2xkM5BWCnppoD',
                            assetAmount: 1,
                            assetDivisibility: 0,
                            isAggregatableAsset: false,
                            isNonFungible: true,
                            ccTokenIds: [
                                'Tk97fk8Rg27toQW68faxhnDuYeFEoK6GcCUm9A'
                            ]
                        },
                        isWitness: true,
                        scriptPubKey: '00149de4c9cb9b9be05fe5af42c56ed0e83a1c2db887',
                        tokenIndex: 0
                    });
                });
            });
        });
    });

    describe('Fail to find UTXO holding a given non-fungible token', function () {
        const nfTokenSourceOpts = {
            useUnconfirmedUtxo: true
        };

        before(function () {
            setTestDataForGetAddressesUtxos(utxosTestData2);
        });

        it('should fail if address not in search list', function () {
            const nfTokenSrc = new NFTokenSource(
                'Tk97fk8Rg27toQW68faxhnDuYeFEoLC1K4DLji',
                [
                    'bcrt1q0zxcuyjwx6fa8g7j0dhxe7judv7l7986rtp8r6',
                    'bcrt1qnhjvnjumn0s9led0gtzka58g8gwzmwy8z5f74c',
                    'bcrt1qxpd89mf77l3q43ajmwwcxms2smc4uyqh3xpknm',
                    'bcrt1qp54d8p5jd657lre040c4wn2rdvfj2x98ma06n5'
                ],
                nfTokenSourceOpts
            );

            expect(nfTokenSrc.holdingUtxoFound).to.be.false;
        });

        it('should fail if token ID does not exist', function () {
            const nfTokenSrc = new NFTokenSource(
                'Tk97fk8Rg27toQW68faxhnDuYeFEoLC1bFs2is',
                [
                    'bcrt1q0zxcuyjwx6fa8g7j0dhxe7judv7l7986rtp8r6',
                    'bcrt1qnhjvnjumn0s9led0gtzka58g8gwzmwy8z5f74c',
                    'bcrt1q5jnhe0gnfucp97hsn0km7zcqxdp2jyl8cyvqkv',
                    'bcrt1qxpd89mf77l3q43ajmwwcxms2smc4uyqh3xpknm',
                    'bcrt1qp54d8p5jd657lre040c4wn2rdvfj2x98ma06n5'
                ],
                nfTokenSourceOpts
            );

            expect(nfTokenSrc.holdingUtxoFound).to.be.false;
        });

        it('should fail if UTXO has asset entries for different assets', function () {
            const nfTokenSrc = new NFTokenSource(
                'Tk97fk8Rg27toQW68faxhnDuYeFEoLC1fYfiE1',
                [
                    'bcrt1q0zxcuyjwx6fa8g7j0dhxe7judv7l7986rtp8r6',
                    'bcrt1qnhjvnjumn0s9led0gtzka58g8gwzmwy8z5f74c',
                    'bcrt1q5jnhe0gnfucp97hsn0km7zcqxdp2jyl8cyvqkv',
                    'bcrt1qxpd89mf77l3q43ajmwwcxms2smc4uyqh3xpknm',
                    'bcrt1qp54d8p5jd657lre040c4wn2rdvfj2x98ma06n5'
                ],
                nfTokenSourceOpts
            );

            expect(nfTokenSrc.holdingUtxoFound).to.be.false;
        });

        it('should fail if UTXO has an unexpected output type', function () {
            const nfTokenSrc = new NFTokenSource(
                'Tk97fk8Rg27toQW68faxhnDuYeFEoK6GZ1AedZ',
                [
                    'bcrt1q0zxcuyjwx6fa8g7j0dhxe7judv7l7986rtp8r6',
                    'bcrt1qnhjvnjumn0s9led0gtzka58g8gwzmwy8z5f74c',
                    'bcrt1q5jnhe0gnfucp97hsn0km7zcqxdp2jyl8cyvqkv',
                    'bcrt1qxpd89mf77l3q43ajmwwcxms2smc4uyqh3xpknm',
                    'bcrt1qp54d8p5jd657lre040c4wn2rdvfj2x98ma06n5'
                ],
                nfTokenSourceOpts
            );

            expect(nfTokenSrc.holdingUtxoFound).to.be.false;
        });

        it('should fail if unconfirmed UTXO does not meet the ancestors count limit', function () {
            const nfTokenSrc = new NFTokenSource(
                'Tk97fk8Rg27toQW68faxhnDuYeFEoLC1oDykd9',
                [
                    'bcrt1q0zxcuyjwx6fa8g7j0dhxe7judv7l7986rtp8r6',
                    'bcrt1qnhjvnjumn0s9led0gtzka58g8gwzmwy8z5f74c',
                    'bcrt1q5jnhe0gnfucp97hsn0km7zcqxdp2jyl8cyvqkv',
                    'bcrt1qxpd89mf77l3q43ajmwwcxms2smc4uyqh3xpknm',
                    'bcrt1qp54d8p5jd657lre040c4wn2rdvfj2x98ma06n5'
                ],
                {
                    ...nfTokenSourceOpts,
                    unconfUtxoInfo: {
                        ancestorsCountDiff: 24
                    }
                }
            );

            expect(nfTokenSrc.holdingUtxoFound).to.be.false;
        });

        it('should fail if unconfirmed UTXO does not meet the ancestors size limit', function () {
            const nfTokenSrc = new NFTokenSource(
                'Tk97fk8Rg27toQW68faxhnDuYeFEoLC1oDykd9',
                [
                    'bcrt1q0zxcuyjwx6fa8g7j0dhxe7judv7l7986rtp8r6',
                    'bcrt1qnhjvnjumn0s9led0gtzka58g8gwzmwy8z5f74c',
                    'bcrt1q5jnhe0gnfucp97hsn0km7zcqxdp2jyl8cyvqkv',
                    'bcrt1qxpd89mf77l3q43ajmwwcxms2smc4uyqh3xpknm',
                    'bcrt1qp54d8p5jd657lre040c4wn2rdvfj2x98ma06n5'
                ],
                {
                    ...nfTokenSourceOpts,
                    unconfUtxoInfo: {
                        ancestorsSizeDiff: 100500
                    }
                }
            );

            expect(nfTokenSrc.holdingUtxoFound).to.be.false;
        });

        it('should fail if unconfirmed UTXO does not meet the descendants count limit', function () {
            const nfTokenSrc = new NFTokenSource(
                'Tk97fk8Rg27toQW68faxhnDuYeFEoLC1oDykd9',
                [
                    'bcrt1q0zxcuyjwx6fa8g7j0dhxe7judv7l7986rtp8r6',
                    'bcrt1qnhjvnjumn0s9led0gtzka58g8gwzmwy8z5f74c',
                    'bcrt1q5jnhe0gnfucp97hsn0km7zcqxdp2jyl8cyvqkv',
                    'bcrt1qxpd89mf77l3q43ajmwwcxms2smc4uyqh3xpknm',
                    'bcrt1qp54d8p5jd657lre040c4wn2rdvfj2x98ma06n5'
                ],
                {
                    ...nfTokenSourceOpts,
                    unconfUtxoInfo: {
                        descendantsCountDiff: 24
                    }
                }
            );

            expect(nfTokenSrc.holdingUtxoFound).to.be.false;
        });

        it('should fail if unconfirmed UTXO does not meet the descendants size limit', function () {
            const nfTokenSrc = new NFTokenSource(
                'Tk97fk8Rg27toQW68faxhnDuYeFEoLC1oDykd9',
                [
                    'bcrt1q0zxcuyjwx6fa8g7j0dhxe7judv7l7986rtp8r6',
                    'bcrt1qnhjvnjumn0s9led0gtzka58g8gwzmwy8z5f74c',
                    'bcrt1q5jnhe0gnfucp97hsn0km7zcqxdp2jyl8cyvqkv',
                    'bcrt1qxpd89mf77l3q43ajmwwcxms2smc4uyqh3xpknm',
                    'bcrt1qp54d8p5jd657lre040c4wn2rdvfj2x98ma06n5'
                ],
                {
                    ...nfTokenSourceOpts,
                    unconfUtxoInfo: {
                        descendantsSizeDiff: 100000
                    }
                }
            );

            expect(nfTokenSrc.holdingUtxoFound).to.be.false;
        });

        describe('Missing unconfirmed transaction', function () {
            before(function () {
                setTestDataForGetMempoolEntry(mempoolTestData2);
                setTestDataForGetMempoolAncestors(mempoolTestData2);
                setTestDataForGetTransaction(txsTestData2);
            });

            it('should fail if unconfirmed UTXO is missing from mempool and replaced', function () {
                const nfTokenSrc = new NFTokenSource(
                    'Tk97fk8Rg27toQW68faxhnDuYeFEoK6GcCUm9A',
                    [
                        'bcrt1q0zxcuyjwx6fa8g7j0dhxe7judv7l7986rtp8r6',
                        'bcrt1qnhjvnjumn0s9led0gtzka58g8gwzmwy8z5f74c',
                        'bcrt1q5jnhe0gnfucp97hsn0km7zcqxdp2jyl8cyvqkv',
                        'bcrt1qxpd89mf77l3q43ajmwwcxms2smc4uyqh3xpknm',
                        'bcrt1qp54d8p5jd657lre040c4wn2rdvfj2x98ma06n5'
                    ],
                    nfTokenSourceOpts,
                );

                expect(nfTokenSrc.holdingUtxoFound).to.be.false;
            });
        });
    });
});

const utxosTestData1 = [
    // Fabricated UTXO entries
    //
    // Confirmed UTXO with single non-fungible token (asset ID: 'LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v')
    {
        "txid": "841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff",
        "vout": 0,
        "address": "bcrt1q0zxcuyjwx6fa8g7j0dhxe7judv7l7986rtp8r6",
        "label": "",
        "scriptPubKey": "0014788d8e124e3693d3a3d27b6e6cfa5c6b3dff14fa",
        "amount": 0.00000600,
        "confirmations": 10,
        "spendable": false,
        "solvable": true,
        "desc": "wpkh([788d8e12]02ac23301af8b315dc38b910ffaa237a0ff6a2b3bf540b5812bc52880ef9f6a112)#mvz9vxud",
        "safe": true,
        "assets": [{
            assetId: 'LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v',
            amount: 1,
            divisibility: 0,
            aggregationPolicy: CCTransaction.aggregationPolicy.nonFungible,
            tokenId: 'Tk97fk8Rg27toQW68faxhnDuYeFEoLC1fYfiE1'
        }]
    },
    // Unconfirmed UTXO with single non-fungible token (asset ID: 'Un4zg8Ku1CQvPca9y6wJSPWdV2xkM5BWCnppoD')
    {
        "txid": "9e358d137e52bfe84b74ec0ad9303238b2b71dfafcdad282bce288ecf80326fb",
        "vout": 1,
        "address": "bcrt1qnhjvnjumn0s9led0gtzka58g8gwzmwy8z5f74c",
        "label": "",
        "scriptPubKey": "00149de4c9cb9b9be05fe5af42c56ed0e83a1c2db887",
        "amount": 0.00000600,
        "confirmations": 0,
        "spendable": false,
        "solvable": true,
        "desc": "wpkh([9de4c9cb]0266a37e4803c798bb7769a8ebbab4c5fff46715fb2e3f11f6a1088e63fc9e219a)#93jzw8e8",
        "safe": true,
        "assets": [{
            assetId: 'Un4zg8Ku1CQvPca9y6wJSPWdV2xkM5BWCnppoD',
            amount: 1,
            divisibility: 0,
            aggregationPolicy: CCTransaction.aggregationPolicy.nonFungible,
            tokenId: 'Tk97fk8Rg27toQW68faxhnDuYeFEoK6GcCUm9A'
        }]
    },
    // Confirmed UTXO with multiple non-fungible tokens for the same asset (asset ID: 'LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v')
    {
        "txid": "841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff",
        "vout": 2,
        "address": "bcrt1q5jnhe0gnfucp97hsn0km7zcqxdp2jyl8cyvqkv",
        "label": "",
        "scriptPubKey": "0014788d8e124e3693d3a3d27b6e6cfa5c6b3dff14fa",
        "amount": 0.00000600,
        "confirmations": 11,
        "spendable": false,
        "solvable": true,
        "desc": "wpkh([788d8e12]02ac23301af8b315dc38b910ffaa237a0ff6a2b3bf540b5812bc52880ef9f6a112)#mvz9vxud",
        "safe": true,
        "assets": [{
            assetId: 'LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v',
            amount: 1,
            divisibility: 0,
            aggregationPolicy: CCTransaction.aggregationPolicy.nonFungible,
            tokenId: 'Tk97fk8Rg27toQW68faxhnDuYeFEoLC1K4DLji'
        }, {
            assetId: 'LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v',
            amount: 1,
            divisibility: 0,
            aggregationPolicy: CCTransaction.aggregationPolicy.nonFungible,
            tokenId: 'Tk97fk8Rg27toQW68faxhnDuYeFEoLC1Tuiw2M'
        }, {
            assetId: 'LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v',
            amount: 1,
            divisibility: 0,
            aggregationPolicy: CCTransaction.aggregationPolicy.nonFungible,
            tokenId: 'Tk97fk8Rg27toQW68faxhnDuYeFEoLC1bFs2is'
        }]
    },
    // Confirmed UTXO with multiple non-fungible tokens for the same asset (asset ID: 'Un4zg8Ku1CQvPca9y6wJSPWdV2xkM5BWCnppoD')
    {
        "txid": "254f30129b88b65a9a35378c71a3724aa946c7b0e2696f999a34d5227bde0fe7",
        "vout": 3,
        "address": "bcrt1qxpd89mf77l3q43ajmwwcxms2smc4uyqh3xpknm",
        "label": "",
        "scriptPubKey": "0014305a72ed3ef7e20ac7b2db9d836e0a86f15e1017",
        "amount": 0.00000600,
        "confirmations": 12,
        "spendable": false,
        "solvable": true,
        "desc": "wpkh([305a72ed]02ac3649d4c0b460904de168630010aa02bc77c5cf943d11a49d03adab0ed94bcd)#hqedwf9e",
        "safe": true,
        "assets": [{
            assetId: 'Un4zg8Ku1CQvPca9y6wJSPWdV2xkM5BWCnppoD',
            amount: 1,
            divisibility: 0,
            aggregationPolicy: CCTransaction.aggregationPolicy.nonFungible,
            tokenId: 'Tk97fk8Rg27toQW68faxhnDuYeFEoK6GNnWDAH'
        }, {
            assetId: 'Un4zg8Ku1CQvPca9y6wJSPWdV2xkM5BWCnppoD',
            amount: 1,
            divisibility: 0,
            aggregationPolicy: CCTransaction.aggregationPolicy.nonFungible,
            tokenId: 'Tk97fk8Rg27toQW68faxhnDuYeFEoK6GZ1AedZ'
        }]
    },
    // Unconfirmed UTXO with multiple non-fungible tokens for the same asset (asset ID: 'LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v')
    {
        "txid": "5f28421c20e784761fc87f37bb5546cc5687b206fe3cb2af658360fb0db2fefc",
        "vout": 4,
        "address": "bcrt1qp54d8p5jd657lre040c4wn2rdvfj2x98ma06n5",
        "label": "",
        "scriptPubKey": "00140d2ad386926ea9ef8f2fabf1574d436b132518a7",
        "amount": 0.00000600,
        "confirmations": 0,
        "spendable": false,
        "solvable": true,
        "desc": "wpkh([0d2ad386]03517d4b5b4d193d4020c5de29b982b1e3cf04a64169c667bab59ec72cf5725457)#a5sz6252",
        "safe": true,
        "assets": [{
            assetId: 'LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v',
            amount: 1,
            divisibility: 0,
            aggregationPolicy: CCTransaction.aggregationPolicy.nonFungible,
            tokenId: 'Tk97fk8Rg27toQW68faxhnDuYeFEoLC1oDykd9'
        }, {
            assetId: 'LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v',
            amount: 1,
            divisibility: 0,
            aggregationPolicy: CCTransaction.aggregationPolicy.nonFungible,
            tokenId: 'Tk97fk8Rg27toQW68faxhnDuYeFEoLC1s2bHJK'
        }]
    },
];

const utxosTestData2 = [
    // Fabricated UTXO entries
    //
    // Confirmed UTXO with single non-fungible token (more than one asset: 'LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v', 'Un4zg8Ku1CQvPca9y6wJSPWdV2xkM5BWCnppoD')
    {
        "txid": "841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff",
        "vout": 0,
        "address": "bcrt1q0zxcuyjwx6fa8g7j0dhxe7judv7l7986rtp8r6",
        "label": "",
        "scriptPubKey": "0014788d8e124e3693d3a3d27b6e6cfa5c6b3dff14fa",
        "amount": 0.00000600,
        "confirmations": 10,
        "spendable": false,
        "solvable": true,
        "desc": "wpkh([788d8e12]02ac23301af8b315dc38b910ffaa237a0ff6a2b3bf540b5812bc52880ef9f6a112)#mvz9vxud",
        "safe": true,
        "assets": [{
            assetId: 'LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v',
            amount: 1,
            divisibility: 0,
            aggregationPolicy: CCTransaction.aggregationPolicy.nonFungible,
            tokenId: 'Tk97fk8Rg27toQW68faxhnDuYeFEoLC1fYfiE1'
        }, {
            assetId: 'Un4zg8Ku1CQvPca9y6wJSPWdV2xkM5BWCnppoD',
            amount: 1,
            divisibility: 0,
            aggregationPolicy: CCTransaction.aggregationPolicy.nonFungible,
            tokenId: 'Tk97fk8Rg27toQW68faxhnDuYeFEoK6GNnWDAH'
        }]
    },
    // Unconfirmed UTXO with single non-fungible token (asset ID: 'Un4zg8Ku1CQvPca9y6wJSPWdV2xkM5BWCnppoD')
    {
        "txid": "9e358d137e52bfe84b74ec0ad9303238b2b71dfafcdad282bce288ecf80326fb",
        "vout": 1,
        "address": "bcrt1qnhjvnjumn0s9led0gtzka58g8gwzmwy8z5f74c",
        "label": "",
        "scriptPubKey": "00149de4c9cb9b9be05fe5af42c56ed0e83a1c2db887",
        "amount": 0.00000600,
        "confirmations": 0,
        "spendable": false,
        "solvable": true,
        "desc": "wpkh([9de4c9cb]0266a37e4803c798bb7769a8ebbab4c5fff46715fb2e3f11f6a1088e63fc9e219a)#93jzw8e8",
        "safe": true,
        "assets": [{
            assetId: 'Un4zg8Ku1CQvPca9y6wJSPWdV2xkM5BWCnppoD',
            amount: 1,
            divisibility: 0,
            aggregationPolicy: CCTransaction.aggregationPolicy.nonFungible,
            tokenId: 'Tk97fk8Rg27toQW68faxhnDuYeFEoK6GcCUm9A'
        }]
    },
    // Confirmed UTXO with multiple non-fungible tokens for the same asset (asset ID: 'LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v')
    {
        "txid": "841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff",
        "vout": 2,
        "address": "bcrt1q5jnhe0gnfucp97hsn0km7zcqxdp2jyl8cyvqkv",
        "label": "",
        "scriptPubKey": "0014788d8e124e3693d3a3d27b6e6cfa5c6b3dff14fa",
        "amount": 0.00000600,
        "confirmations": 11,
        "spendable": false,
        "solvable": true,
        "desc": "wpkh([788d8e12]02ac23301af8b315dc38b910ffaa237a0ff6a2b3bf540b5812bc52880ef9f6a112)#mvz9vxud",
        "safe": true,
        "assets": [{
            assetId: 'LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v',
            amount: 1,
            divisibility: 0,
            aggregationPolicy: CCTransaction.aggregationPolicy.nonFungible,
            tokenId: 'Tk97fk8Rg27toQW68faxhnDuYeFEoLC1K4DLji'
        }, {
            assetId: 'LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v',
            amount: 1,
            divisibility: 0,
            aggregationPolicy: CCTransaction.aggregationPolicy.nonFungible,
            tokenId: 'Tk97fk8Rg27toQW68faxhnDuYeFEoLC1Tuiw2M'
        }]
    },
    // Confirmed UTXO with single non-fungible token and wrong output type (asset ID: 'Un4zg8Ku1CQvPca9y6wJSPWdV2xkM5BWCnppoD')
    {
        "txid": "254f30129b88b65a9a35378c71a3724aa946c7b0e2696f999a34d5227bde0fe7",
        "vout": 3,
        "address": "bcrt1qxpd89mf77l3q43ajmwwcxms2smc4uyqh3xpknm",
        "label": "",
        "scriptPubKey": "0014305a72ed3ef7e20ac7b2db9d836e0a86f15e1017",
        "amount": 0.00000600,
        "confirmations": 12,
        "spendable": false,
        "solvable": true,
        "desc": "wsh([305a72ed]02ac3649d4c0b460904de168630010aa02bc77c5cf943d11a49d03adab0ed94bcd)#hqedwf9e",
        "safe": true,
        "assets": [{
            assetId: 'Un4zg8Ku1CQvPca9y6wJSPWdV2xkM5BWCnppoD',
            amount: 1,
            divisibility: 0,
            aggregationPolicy: CCTransaction.aggregationPolicy.nonFungible,
            tokenId: 'Tk97fk8Rg27toQW68faxhnDuYeFEoK6GZ1AedZ'
        }]
    },
    // Unconfirmed UTXO with multiple non-fungible tokens for the same asset (asset ID: 'LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v')
    {
        "txid": "5f28421c20e784761fc87f37bb5546cc5687b206fe3cb2af658360fb0db2fefc",
        "vout": 4,
        "address": "bcrt1qp54d8p5jd657lre040c4wn2rdvfj2x98ma06n5",
        "label": "",
        "scriptPubKey": "00140d2ad386926ea9ef8f2fabf1574d436b132518a7",
        "amount": 0.00000600,
        "confirmations": 0,
        "spendable": false,
        "solvable": true,
        "desc": "wpkh([0d2ad386]03517d4b5b4d193d4020c5de29b982b1e3cf04a64169c667bab59ec72cf5725457)#a5sz6252",
        "safe": true,
        "assets": [{
            assetId: 'LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v',
            amount: 1,
            divisibility: 0,
            aggregationPolicy: CCTransaction.aggregationPolicy.nonFungible,
            tokenId: 'Tk97fk8Rg27toQW68faxhnDuYeFEoLC1oDykd9'
        }, {
            assetId: 'LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v',
            amount: 1,
            divisibility: 0,
            aggregationPolicy: CCTransaction.aggregationPolicy.nonFungible,
            tokenId: 'Tk97fk8Rg27toQW68faxhnDuYeFEoLC1s2bHJK'
        }]
    },
];

const mempoolTestData1 = {
    "9e358d137e52bfe84b74ec0ad9303238b2b71dfafcdad282bce288ecf80326fb": {
        "fees": {
            "base": 0.00010000,
            "modified": 0.00010000,
            "ancestor": 0.00010000,
            "descendant": 0.00050000
        },
        "vsize": 497,
        "weight": 1988,
        "fee": 0.00010000,
        "modifiedfee": 0.00010000,
        "time": 1557439359,
        "height": 101,
        "descendantcount": 5,
        "descendantsize": 2316,
        "descendantfees": 50000,
        "ancestorcount": 1,
        "ancestorsize": 497,
        "ancestorfees": 10000,
        "wtxid": "9e358d137e52bfe84b74ec0ad9303238b2b71dfafcdad282bce288ecf80326fb",
        "depends": [
        ],
        "spentby": [
        ],
        "bip125-replaceable": false,
        "unbroadcast": false
    },
    "5f28421c20e784761fc87f37bb5546cc5687b206fe3cb2af658360fb0db2fefc": {
        "fees": {
            "base": 0.00010000,
            "modified": 0.00010000,
            "ancestor": 0.00020000,
            "descendant": 0.00030000
        },
        "vsize": 361,
        "weight": 1444,
        "fee": 0.00010000,
        "modifiedfee": 0.00010000,
        "time": 1557440748,
        "height": 101,
        "descendantcount": 3,
        "descendantsize": 1310,
        "descendantfees": 30000,
        "ancestorcount": 2,
        "ancestorsize": 858,
        "ancestorfees": 20000,
        "wtxid": "5f28421c20e784761fc87f37bb5546cc5687b206fe3cb2af658360fb0db2fefc",
        "depends": [
            "a34345f69e5beb3618dfca9a22326f6e978d5ec6ab5d5c57e685e6f812cd628d"
        ],
        "spentby": [
        ],
        "bip125-replaceable": false,
        "unbroadcast": false
    }
};

// Simulate that unconfirmed tx #1 is not in mempool anymore
const mempoolTestData2 = {
    "5f28421c20e784761fc87f37bb5546cc5687b206fe3cb2af658360fb0db2fefc": {
        "fees": {
            "base": 0.00010000,
            "modified": 0.00010000,
            "ancestor": 0.00020000,
            "descendant": 0.00030000
        },
        "vsize": 361,
        "weight": 1444,
        "fee": 0.00010000,
        "modifiedfee": 0.00010000,
        "time": 1557440748,
        "height": 101,
        "descendantcount": 3,
        "descendantsize": 1310,
        "descendantfees": 30000,
        "ancestorcount": 2,
        "ancestorsize": 858,
        "ancestorfees": 20000,
        "wtxid": "5f28421c20e784761fc87f37bb5546cc5687b206fe3cb2af658360fb0db2fefc",
        "depends": [
            "a34345f69e5beb3618dfca9a22326f6e978d5ec6ab5d5c57e685e6f812cd628d"
        ],
        "spentby": [
        ],
        "bip125-replaceable": false,
        "unbroadcast": false
    }
};

// Simulate that unconfirmed tx #1 has already been confirmed
const txsTestData1 = {
    "9e358d137e52bfe84b74ec0ad9303238b2b71dfafcdad282bce288ecf80326fb": {
        tx: {
            txid: "9e358d137e52bfe84b74ec0ad9303238b2b71dfafcdad282bce288ecf80326fb",
            confirmations: 1
        }
    },
};

// Simulate that unconfirmed tx #1 has already been replaced
const txsTestData2 = {
    "9e358d137e52bfe84b74ec0ad9303238b2b71dfafcdad282bce288ecf80326fb": {
        tx: {
            txid: "9e358d137e52bfe84b74ec0ad9303238b2b71dfafcdad282bce288ecf80326fb",
            confirmations: -1
        }
    },
};


let _getAddressesUtxosSource;

function setTestDataForGetAddressesUtxos(utxos) {
    _getAddressesUtxosSource = utxos;
}

function resetC3NodeClient(restore) {
    if (!C3NodeClient.prototype.origMethods) {
        C3NodeClient.prototype.origMethods = {};
    }

    if (!restore) {
        // Replace original methods
        if (!C3NodeClient.prototype.origMethods.getAddressesUtxos) {
            // Save original 'getAddressesUtxos' method...
            C3NodeClient.prototype.origMethods.getAddressesUtxos = C3NodeClient.prototype.getAddressesUtxos;
            // and replace with test method
            C3NodeClient.prototype.getAddressesUtxos = genTestGetAddressesUtxos();
        }
    }
    else {
        // Restore original methods
        if (C3NodeClient.prototype.origMethods.getAddressesUtxos) {
            // Restore original 'getAddressesUtxos' method
            C3NodeClient.prototype.getAddressesUtxos = C3NodeClient.prototype.origMethods.getAddressesUtxos;
            C3NodeClient.prototype.origMethods.getAddressesUtxos = undefined;
        }
    }
}

function genTestGetAddressesUtxos() {
    return function testGetAddressesUtxos(addresses, numOfConfirmations) {
        if (!Array.isArray(addresses)) {
            addresses = [addresses];
        }

        const setAddresses = new Set(addresses);

        return _getAddressesUtxosSource.filter(function (utxo) {
            return (!numOfConfirmations || utxo.confirmations >= numOfConfirmations) && (!setAddresses || setAddresses.has(utxo.address));
        });
    };
}

let _getMempoolEntrySource;
let _getMempoolAncestorsSource;
let _getTransactionSource;

function setTestDataForGetMempoolEntry(mempool) {
    _getMempoolEntrySource = mempool;
}

function setTestDataForGetMempoolAncestors(mempool) {
    _getMempoolAncestorsSource = mempool;
}

function setTestDataForGetTransaction(txs) {
    _getTransactionSource = txs;
}

function resetBitcoinCore(restore) {
    if (!BitcoinCore.prototype.origMethods) {
        BitcoinCore.prototype.origMethods = {};
    }

    if (!restore) {
        // Replace original methods
        if (!BitcoinCore.prototype.origMethods.getMempoolEntry) {
            // Save original 'getMempoolEntry' method...
            BitcoinCore.prototype.origMethods.getMempoolEntry = BitcoinCore.prototype.getMempoolEntry;
            // and replace with test method
            BitcoinCore.prototype.getMempoolEntry = genTestGetMempoolEntry();
        }

        if (!BitcoinCore.prototype.origMethods.getMempoolAncestors) {
            // Save original 'getMempoolAncestors' method
            BitcoinCore.prototype.origMethods.getMempoolAncestors = BitcoinCore.prototype.getMempoolAncestors;
            // and replace with test method
            BitcoinCore.prototype.getMempoolAncestors = genTestGetMempoolAncestors();
        }

        if (!BitcoinCore.prototype.origMethods.getTransaction) {
            // Save original 'getTransaction' method...
            BitcoinCore.prototype.origMethods.getTransaction = BitcoinCore.prototype.getTransaction;
            // and replace with test method
            BitcoinCore.prototype.getTransaction = genTestGetTransaction();
        }
    }
    else {
        // Restore original methods
        if (BitcoinCore.prototype.origMethods.getMempoolEntry) {
            // Restore original 'getMempoolEntry' method
            BitcoinCore.prototype.getMempoolEntry = BitcoinCore.prototype.origMethods.getMempoolEntry;
            BitcoinCore.prototype.origMethods.getMempoolEntry = undefined;
        }

        if (BitcoinCore.prototype.origMethods.getMempoolAncestors) {
            // Restore original 'getMempoolAncestors' method
            BitcoinCore.prototype.getMempoolAncestors = BitcoinCore.prototype.origMethods.getMempoolAncestors;
            BitcoinCore.prototype.origMethods.getMempoolAncestors = undefined;
        }

        if (BitcoinCore.prototype.origMethods.getTransaction) {
            // Restore original 'getTransaction' method
            BitcoinCore.prototype.getTransaction = BitcoinCore.prototype.origMethods.getTransaction;
            BitcoinCore.prototype.origMethods.getTransaction = undefined;
        }
    }
}

function genTestGetMempoolEntry() {
    return function testGetMempoolEntry(txid) {
        const mempoolEntry = _getMempoolEntrySource[txid];

        if (!mempoolEntry) {
            // Simulate 'transaction not in mempool' error
            // noinspection JSCheckFunctionSignatures
            throw new Meteor.Error(
                'ctn_btcore_rpc_error',
                'Error calling Bitcoin Core \'getMempoolEntry\' RPC method. Returned error code: -5',
                {
                    code: -5,
                    message: 'Transaction not in mempool'
                }
            );
        }

        return mempoolEntry;
    }
}

function genTestGetMempoolAncestors() {
    return function testGetMempoolAncestors(txid, verbose) {
        const ancestorTxids = getAncestorTxids(_getMempoolAncestorsSource, txid);

        if (!ancestorTxids) {
            // Simulate 'transaction not in mempool' error
            // noinspection JSCheckFunctionSignatures
            throw new Meteor.Error(
                'ctn_btcore_rpc_error',
                'Error calling Bitcoin Core \'getMempoolAncestors\' RPC method. Returned error code: -5',
                {
                    code: -5,
                    message: 'Transaction not in mempool'
                }
            );
        }

        let result;

        if (verbose) {
            result = {};

            ancestorTxids.forEach(txid => result[txid] = _getMempoolAncestorsSource[txid]);
        }
        else {
            result = ancestorTxids;
        }

        return result;
    }
}

function getAncestorTxids(mempool, txid, result, returnResult = true) {
    result = result || new Set();

    const mempoolEntry = mempool[txid];

    if (mempoolEntry && mempoolEntry.depends.length > 0) {
        mempoolEntry.depends.forEach((dependTxid) => {
            if (!result.has(dependTxid)) {
                result.add(dependTxid);
                getAncestorTxids(mempool, dependTxid, result, false);
            }
        });
    }

    if (returnResult && result) {
        return Array.from(result);
    }
}

function genTestGetTransaction() {
    return function testGetTransaction(txid) {
        const txInfo = _getTransactionSource[txid];

        if (!txInfo || !txInfo.tx) {
            // Simulate 'Invalid or non-wallet transaction id' error
            // noinspection JSCheckFunctionSignatures
            throw new Meteor.Error(
                'ctn_btcore_rpc_error',
                'Error calling Bitcoin Core \'getTransaction\' RPC method. Returned error code: -5',
                {
                    code: -5,
                    message: 'Invalid or non-wallet transaction id'
                }
            );
        }

        return txInfo.tx;
    }
}
