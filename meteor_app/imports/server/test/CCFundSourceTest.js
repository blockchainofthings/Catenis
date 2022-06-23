/**
 * Created by Claudio on 2019-05-23.
 */

//console.log('[CCFundSourceTest.js]: This code just ran.');

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
import { CCFundSource } from '../CCFundSource';
import { AncestorTransactions } from '../AncestorTransactions';


describe('CCFundSource module', function () {
    describe('instance including only confirmed UTXOs and (only confirmed) additional UTXOs', function () {
        let ccFundSrc;

        before(function () {
            resetBitcoinCore(mempoolTestData0, txsTestData2);
            BitcoinCore.initialize();
            resetC3NodeClient(utxosTestData2);
            C3NodeClient.initialize();

            ccFundSrc = new CCFundSource('La8KNZTWQJGEUYfzxSEugGwpDQRUE8JCMeRSXE', 'mrH6bWqKTyntpF9wi7mui4NYxo85frL9X6', {
                addUtxoTxInputs: [{
                    txout: {
                        txid: 'a34345f69e5beb3618dfca9a22326f6e978d5ec6ab5d5c57e685e6f812cd628d',
                        vout: 0,
                        amount: 600,
                        ccAssetId: 'La8KNZTWQJGEUYfzxSEugGwpDQRUE8JCMeRSXE',
                        assetAmount: 3000,
                        assetDivisibility: 0,
                        isAggregatableAsset: true
                    },
                    address: 'mrH6bWqKTyntpF9wi7mui4NYxo85frL9X6',
                    scriptPubKey: '76a914d47bedbbd448fdaa61c4ecd250866f5c6be8980088ac'
                }, {
                    txout: {
                        txid: '7fa35e8cabf89a25324f7fa25f2f22f47850e97a3c3b05e875ba95c7ead80ad6',
                        vout: 0,
                        amount: 600,
                        ccAssetId: 'La8KNZTWQJGEUYfzxSEugGwpDQRUE8JCMeRSXE',
                        assetAmount: 2000,
                        assetDivisibility: 0,
                        isAggregatableAsset: true
                    },
                    address: 'mrH6bWqKTyntpF9wi7mui4NYxo85frL9X6',
                    scriptPubKey: '76a914d47bedbbd448fdaa61c4ecd250866f5c6be8980088ac'
                }, {
                    txout: {
                        txid: 'cb5713d8dc0d5825c8bd2f391e6bd0a9f9c0d3164dd1d594959094e27d34d460',
                        vout: 0,
                        amount: 600,
                        ccAssetId: 'La8KNZTWQJGEUYfzxSEugGwpDQRUE8JCMeRSXE',
                        assetAmount: 1200,
                        assetDivisibility: 0,
                        isAggregatableAsset: true
                    },
                    address: 'mrH6bWqKTyntpF9wi7mui4NYxo85frL9X6',
                    scriptPubKey: '76a914d47bedbbd448fdaa61c4ecd250866f5c6be8980088ac'
                }]
            });
        });

        it('unconfirmed UTXOs should not have been loaded', function () {
            expect(ccFundSrc.loadedUnconfirmedUtxos).to.be.false;
        });

        it('ancestor transactions control object should not have been instantiated', function () {
            expect(ccFundSrc.ancestorTxs).to.not.exist;
        });

        it('balance should include additional UTXOs', function () {
            const confBalance = ccFundSrc.getBalance(false);
            const unconfBalance = ccFundSrc.getBalance(true);

            expect(confBalance).to.equals(unconfBalance).and.be.equal(19700);
        });
    });

    describe('instance including only confirmed UTXOs and (mixed) additional UTXOs', function () {
        let ccFundSrc;

        before(function () {
            resetBitcoinCore(mempoolTestData3, txsTestData3);
            BitcoinCore.initialize();
            resetC3NodeClient(utxosTestData2);
            C3NodeClient.initialize();

            ccFundSrc = new CCFundSource('La8KNZTWQJGEUYfzxSEugGwpDQRUE8JCMeRSXE', 'mrH6bWqKTyntpF9wi7mui4NYxo85frL9X6', {
                addUtxoTxInputs: [{
                    txout: {
                        txid: 'a34345f69e5beb3618dfca9a22326f6e978d5ec6ab5d5c57e685e6f812cd628d',
                        vout: 0,
                        amount: 600,
                        ccAssetId: 'La8KNZTWQJGEUYfzxSEugGwpDQRUE8JCMeRSXE',
                        assetAmount: 3000,
                        assetDivisibility: 0,
                        isAggregatableAsset: true
                    },
                    address: 'mrH6bWqKTyntpF9wi7mui4NYxo85frL9X6',
                    scriptPubKey: '76a914d47bedbbd448fdaa61c4ecd250866f5c6be8980088ac'
                }, {
                    txout: {
                        txid: '7fa35e8cabf89a25324f7fa25f2f22f47850e97a3c3b05e875ba95c7ead80ad6',
                        vout: 0,
                        amount: 600,
                        ccAssetId: 'La8KNZTWQJGEUYfzxSEugGwpDQRUE8JCMeRSXE',
                        assetAmount: 2000,
                        assetDivisibility: 0,
                        isAggregatableAsset: true
                    },
                    address: 'mrH6bWqKTyntpF9wi7mui4NYxo85frL9X6',
                    scriptPubKey: '76a914d47bedbbd448fdaa61c4ecd250866f5c6be8980088ac'
                }, {
                    txout: {
                        txid: 'cb5713d8dc0d5825c8bd2f391e6bd0a9f9c0d3164dd1d594959094e27d34d460',
                        vout: 0,
                        amount: 600,
                        ccAssetId: 'La8KNZTWQJGEUYfzxSEugGwpDQRUE8JCMeRSXE',
                        assetAmount: 1200,
                        assetDivisibility: 0,
                        isAggregatableAsset: true
                    },
                    address: 'mrH6bWqKTyntpF9wi7mui4NYxo85frL9X6',
                    scriptPubKey: '76a914d47bedbbd448fdaa61c4ecd250866f5c6be8980088ac'
                }, {
                    txout: {
                        txid: '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373',
                        vout: 0,
                        amount: 600,
                        ccAssetId: 'La8KNZTWQJGEUYfzxSEugGwpDQRUE8JCMeRSXE',
                        assetAmount: 5000,
                        assetDivisibility: 0,
                        isAggregatableAsset: true
                    },
                    address: 'mrH6bWqKTyntpF9wi7mui4NYxo85frL9X6',
                    scriptPubKey: '76a914d47bedbbd448fdaa61c4ecd250866f5c6be8980088ac'
                }, {
                    txout: {
                        txid: 'ad244897a99caa76a5698567dd5c43cb42384b530ac158a7d8cf0be5f9638443',
                        vout: 0,
                        amount: 600,
                        ccAssetId: 'La8KNZTWQJGEUYfzxSEugGwpDQRUE8JCMeRSXE',
                        assetAmount: 4000,
                        assetDivisibility: 0,
                        isAggregatableAsset: true
                    },
                    address: 'mrH6bWqKTyntpF9wi7mui4NYxo85frL9X6',
                    scriptPubKey: '76a914d47bedbbd448fdaa61c4ecd250866f5c6be8980088ac'
                }]
            });
        });

        it('unconfirmed UTXOs should have been loaded', function () {
            expect(ccFundSrc.loadedUnconfirmedUtxos).to.be.true;
        });

        it('ancestors/descendants limits should have been set to their default values', function () {
            expect(ccFundSrc.ancestorsCountUpperLimit).to.equals(24);
            expect(ccFundSrc.ancestorsSizeUpperLimit).to.equals(100000);
            expect(ccFundSrc.descendantsCountUpperLimit).to.equals(24);
            expect(ccFundSrc.descendantsSizeUpperLimit).to.equals(100000);
        });

        it('ancestor transactions control object should have been instantiated', function () {
            expect(ccFundSrc.ancestorTxs).to.exist;
        });

        it('balance should include additional UTXOs', function () {
            //const confBalance = fundSrc.getBalance(false);
            const unconfBalance = ccFundSrc.getBalance(true);

            //expect(confBalance).to.equals(19700);
            expect(unconfBalance).to.equals(28700);
        });
    });

    describe('instance including only confirmed UTXOs', function () {
        let ccFundSrc;

        before(function () {
            resetBitcoinCore(mempoolTestData0);
            BitcoinCore.initialize();
            resetC3NodeClient(utxosTestData0);
            C3NodeClient.initialize();

            ccFundSrc = new CCFundSource('La8KNZTWQJGEUYfzxSEugGwpDQRUE8JCMeRSXE', 'mrH6bWqKTyntpF9wi7mui4NYxo85frL9X6');
        });

        it('unconfirmed UTXOs should not have been loaded', function () {
            expect(ccFundSrc.loadedUnconfirmedUtxos).to.be.false;
        });

        it('confirmed and unconfirmed balance should be the same', function () {
            const confBalance = ccFundSrc.getBalance(false);
            const unconfBalance = ccFundSrc.getBalance(true);

            expect(confBalance).to.equals(unconfBalance).and.be.equal(28700);
        });

        it('the expected UTXOs should be returned when allocating fund of 14000 satoshis', function () {
            const result = ccFundSrc.allocateFund(14000);

            expect(result).to.exist.and.to.include({changeAssetAmount: 0}).and.to.have.property('utxos').that.is.a('array').with.lengthOf(3);
            expect(result.utxos[0]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 0, assetAmount: 7000
            });
            expect(result.utxos[1]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373', vout: 0, assetAmount: 5000
            });
            expect(result.utxos[2]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '7fa35e8cabf89a25324f7fa25f2f22f47850e97a3c3b05e875ba95c7ead80ad6', vout: 0, assetAmount: 2000
            });

            expect(ccFundSrc.ancestorTxs).to.not.exist;
        });

        it('the expected UTXOs should be returned when allocating fund of 15900 satoshis', function () {
            ccFundSrc.clearAllocatedUtxos();
            const result = ccFundSrc.allocateFund(15900);

            expect(result).to.exist.and.to.include({changeAssetAmount: 2600}).and.to.have.property('utxos').that.is.a('array').with.lengthOf(3);
            expect(result.utxos[0]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 0, assetAmount: 7000
            });
            expect(result.utxos[1]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 1, assetAmount: 6500
            });
            expect(result.utxos[2]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373', vout: 0, assetAmount: 5000
            });

            expect(ccFundSrc.ancestorTxs).to.not.exist;
        });

        it('the expected UTXOs should be returned when allocating fund of 16000 satoshis', function () {
            ccFundSrc.clearAllocatedUtxos();
            const result = ccFundSrc.allocateFund(16000);

            expect(result).to.exist.and.to.include({changeAssetAmount: 0}).and.to.have.property('utxos').that.is.a('array').with.lengthOf(3);
            expect(result.utxos[0]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 0, assetAmount: 7000
            });
            expect(result.utxos[1]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373', vout: 0, assetAmount: 5000
            });
            expect(result.utxos[2]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: 'ad244897a99caa76a5698567dd5c43cb42384b530ac158a7d8cf0be5f9638443', vout: 0, assetAmount: 4000
            });

            expect(ccFundSrc.ancestorTxs).to.not.exist;
        });

        it('the expected UTXOs should be returned when allocating fund of 24500 satoshis', function () {
            ccFundSrc.clearAllocatedUtxos();
            const result = ccFundSrc.allocateFund(24500);

            expect(result).to.exist.and.to.include({changeAssetAmount: 0}).and.to.have.property('utxos').that.is.a('array').with.lengthOf(5);
            expect(result.utxos[0]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 0, assetAmount: 7000
            });
            expect(result.utxos[1]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 1, assetAmount: 6500
            });
            expect(result.utxos[2]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373', vout: 0, assetAmount: 5000
            });
            expect(result.utxos[3]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: 'ad244897a99caa76a5698567dd5c43cb42384b530ac158a7d8cf0be5f9638443', vout: 0, assetAmount: 4000
            });
            expect(result.utxos[4]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '7fa35e8cabf89a25324f7fa25f2f22f47850e97a3c3b05e875ba95c7ead80ad6', vout: 0, assetAmount: 2000
            });

            expect(ccFundSrc.ancestorTxs).to.not.exist;
        });

        it('the expected UTXOs should be returned when allocating fund of 23700 satoshis', function () {
            ccFundSrc.clearAllocatedUtxos();
            const result = ccFundSrc.allocateFund(23700);

            expect(result).to.exist.and.to.include({changeAssetAmount: 0}).and.to.have.property('utxos').that.is.a('array').with.lengthOf(5);
            expect(result.utxos[0]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 0, assetAmount: 7000
            });
            expect(result.utxos[1]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 1, assetAmount: 6500
            });
            expect(result.utxos[2]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373', vout: 0, assetAmount: 5000
            });
            expect(result.utxos[3]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: 'ad244897a99caa76a5698567dd5c43cb42384b530ac158a7d8cf0be5f9638443', vout: 0, assetAmount: 4000
            });
            expect(result.utxos[4]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: 'cb5713d8dc0d5825c8bd2f391e6bd0a9f9c0d3164dd1d594959094e27d34d460', vout: 0, assetAmount: 1200
            });

            expect(ccFundSrc.ancestorTxs).to.not.exist;
        });

        it('the expected UTXOs should be returned when allocating fund of 28700 satoshis', function () {
            ccFundSrc.clearAllocatedUtxos();
            const result = ccFundSrc.allocateFund(28700);

            expect(result).to.exist.and.to.include({changeAssetAmount: 0}).and.to.have.property('utxos').that.is.a('array').with.lengthOf(7);
            expect(result.utxos[0]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 0, assetAmount: 7000
            });
            expect(result.utxos[1]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 1, assetAmount: 6500
            });
            expect(result.utxos[2]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373', vout: 0, assetAmount: 5000
            });
            expect(result.utxos[3]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: 'ad244897a99caa76a5698567dd5c43cb42384b530ac158a7d8cf0be5f9638443', vout: 0, assetAmount: 4000
            });
            expect(result.utxos[4]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: 'a34345f69e5beb3618dfca9a22326f6e978d5ec6ab5d5c57e685e6f812cd628d', vout: 0, assetAmount: 3000
            });
            expect(result.utxos[5]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '7fa35e8cabf89a25324f7fa25f2f22f47850e97a3c3b05e875ba95c7ead80ad6', vout: 0, assetAmount: 2000
            });
            expect(result.utxos[6]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: 'cb5713d8dc0d5825c8bd2f391e6bd0a9f9c0d3164dd1d594959094e27d34d460', vout: 0, assetAmount: 1200
            });

            expect(ccFundSrc.ancestorTxs).to.not.exist;
        });
    });

    describe('instance including confirmed and selected unconfirmed UTXOs (with default ancestors/descendants limits)', function () {
        let ccFundSrc;

        before(function () {
            resetBitcoinCore(mempoolTestData1);
            BitcoinCore.initialize();
            resetC3NodeClient(utxosTestData1);
            C3NodeClient.initialize();

            ccFundSrc = new CCFundSource('La8KNZTWQJGEUYfzxSEugGwpDQRUE8JCMeRSXE', 'mrH6bWqKTyntpF9wi7mui4NYxo85frL9X6', {
                useUnconfirmedUtxo: false,
                selectUnconfUtxos: [
                    'a34345f69e5beb3618dfca9a22326f6e978d5ec6ab5d5c57e685e6f812cd628d:0',
                    '7fa35e8cabf89a25324f7fa25f2f22f47850e97a3c3b05e875ba95c7ead80ad6:0',
                    '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373:0',
                    'ad244897a99caa76a5698567dd5c43cb42384b530ac158a7d8cf0be5f9638443:0'
                ]
            });
        });

        it('unconfirmed UTXOs should have been loaded', function () {
            expect(ccFundSrc.loadedUnconfirmedUtxos).to.be.true;
        });

        it('ancestors/descendants limits should have been set to their default values', function () {
            expect(ccFundSrc.ancestorsCountUpperLimit).to.equals(24);
            expect(ccFundSrc.ancestorsSizeUpperLimit).to.equals(100000);
            expect(ccFundSrc.descendantsCountUpperLimit).to.equals(24);
            expect(ccFundSrc.descendantsSizeUpperLimit).to.equals(100000);
        });

        it('confirmed balance should exclude any unconfirmed UTXOs', function () {
            const balance = ccFundSrc.getBalance(false);

            expect(balance).to.equals(13500);
        });

        it('unconfirmed balance should include all UTXOs', function () {
            const balance = ccFundSrc.getBalance(true);

            expect(balance).to.equals(27500);
        });

        it('the expected UTXOs should be returned when allocating fund of 14000 satoshis', function () {
            const result = ccFundSrc.allocateFund(14000);

            expect(result).to.exist.and.to.include({changeAssetAmount: 0}).and.to.have.property('utxos').that.is.a('array').with.lengthOf(3);
            expect(result.utxos[0]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 0, assetAmount: 7000
            });
            expect(result.utxos[1]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373', vout: 0, assetAmount: 5000
            });
            expect(result.utxos[2]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '7fa35e8cabf89a25324f7fa25f2f22f47850e97a3c3b05e875ba95c7ead80ad6', vout: 0, assetAmount: 2000
            });

            const ancTxs = new AncestorTransactions({ancestorsCountLimit: 24});

            const utxos = ccFundSrc.collUtxo.find({txout: {$in: [
                '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:0',
                '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373:0',
                '7fa35e8cabf89a25324f7fa25f2f22f47850e97a3c3b05e875ba95c7ead80ad6:0'
            ]}});

            expect(utxos).to.be.an('array').with.lengthOf(3);

            utxos.forEach(utxo => ancTxs.addUtxo(utxo, false));

            expect(ccFundSrc.ancestorTxs.ancestorRefCounter).to.deep.equal(ancTxs.ancestorRefCounter, 'ancestor transactions reference counter not as expected');
        });

        it('the expected UTXOs should be returned when allocating fund of 15900 satoshis', function () {
            ccFundSrc.clearAllocatedUtxos();
            const result = ccFundSrc.allocateFund(15900);

            expect(result).to.exist.and.to.include({changeAssetAmount: 2600}).and.to.have.property('utxos').that.is.a('array').with.lengthOf(3);
            expect(result.utxos[0]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 0, assetAmount: 7000
            });
            expect(result.utxos[1]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 1, assetAmount: 6500
            });
            expect(result.utxos[2]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373', vout: 0, assetAmount: 5000
            });

            const ancTxs = new AncestorTransactions({ancestorsCountLimit: 24});

            const utxos = ccFundSrc.collUtxo.find({txout: {$in: [
                '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:0',
                '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:1',
                '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373:0'
            ]}});

            expect(utxos).to.be.an('array').with.lengthOf(3);

            utxos.forEach(utxo => ancTxs.addUtxo(utxo, false));

            expect(ccFundSrc.ancestorTxs.ancestorRefCounter).to.deep.equal(ancTxs.ancestorRefCounter, 'ancestor transactions reference counter not as expected');
        });

        it('the expected UTXOs should be returned when allocating fund of 16000 satoshis', function () {
            ccFundSrc.clearAllocatedUtxos();
            const result = ccFundSrc.allocateFund(16000);

            expect(result).to.exist.and.to.include({changeAssetAmount: 0}).and.to.have.property('utxos').that.is.a('array').with.lengthOf(3);
            expect(result.utxos[0]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 0, assetAmount: 7000
            });
            expect(result.utxos[1]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373', vout: 0, assetAmount: 5000
            });
            expect(result.utxos[2]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: 'ad244897a99caa76a5698567dd5c43cb42384b530ac158a7d8cf0be5f9638443', vout: 0, assetAmount: 4000
            });

            const ancTxs = new AncestorTransactions({ancestorsCountLimit: 24});

            const utxos = ccFundSrc.collUtxo.find({txout: {$in: [
                '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:0',
                '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373:0',
                'ad244897a99caa76a5698567dd5c43cb42384b530ac158a7d8cf0be5f9638443:0'
            ]}});

            expect(utxos).to.be.an('array').with.lengthOf(3);

            utxos.forEach(utxo => ancTxs.addUtxo(utxo, false));

            expect(ccFundSrc.ancestorTxs.ancestorRefCounter).to.deep.equal(ancTxs.ancestorRefCounter, 'ancestor transactions reference counter not as expected');
        });

        it('the expected UTXOs should be returned when allocating fund of 24500 satoshis', function () {
            ccFundSrc.clearAllocatedUtxos();
            const result = ccFundSrc.allocateFund(24500);

            expect(result).to.exist.and.to.include({changeAssetAmount: 0}).and.to.have.property('utxos').that.is.a('array').with.lengthOf(5);
            expect(result.utxos[0]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 0, assetAmount: 7000
            });
            expect(result.utxos[1]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 1, assetAmount: 6500
            });
            expect(result.utxos[2]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373', vout: 0, assetAmount: 5000
            });
            expect(result.utxos[3]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: 'ad244897a99caa76a5698567dd5c43cb42384b530ac158a7d8cf0be5f9638443', vout: 0, assetAmount: 4000
            });
            expect(result.utxos[4]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '7fa35e8cabf89a25324f7fa25f2f22f47850e97a3c3b05e875ba95c7ead80ad6', vout: 0, assetAmount: 2000
            });

            const ancTxs = new AncestorTransactions({ancestorsCountLimit: 24});

            const utxos = ccFundSrc.collUtxo.find({txout: {$in: [
                '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:0',
                '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:1',
                '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373:0',
                'ad244897a99caa76a5698567dd5c43cb42384b530ac158a7d8cf0be5f9638443:0',
                '7fa35e8cabf89a25324f7fa25f2f22f47850e97a3c3b05e875ba95c7ead80ad6:0'
            ]}});

            expect(utxos).to.be.an('array').with.lengthOf(5);

            utxos.forEach(utxo => ancTxs.addUtxo(utxo, false));

            expect(ccFundSrc.ancestorTxs.ancestorRefCounter).to.deep.equal(ancTxs.ancestorRefCounter, 'ancestor transactions reference counter not as expected');
        });

        it('the expected UTXOs should be returned when allocating fund of 23700 satoshis', function () {
            ccFundSrc.clearAllocatedUtxos();
            const result = ccFundSrc.allocateFund(23700);

            expect(result).to.exist.and.to.include({changeAssetAmount: 1800}).and.to.have.property('utxos').that.is.a('array').with.lengthOf(5);
            expect(result.utxos[0]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 0, assetAmount: 7000
            });
            expect(result.utxos[1]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 1, assetAmount: 6500
            });
            expect(result.utxos[2]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373', vout: 0, assetAmount: 5000
            });
            expect(result.utxos[3]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: 'ad244897a99caa76a5698567dd5c43cb42384b530ac158a7d8cf0be5f9638443', vout: 0, assetAmount: 4000
            });
            expect(result.utxos[4]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: 'a34345f69e5beb3618dfca9a22326f6e978d5ec6ab5d5c57e685e6f812cd628d', vout: 0, assetAmount: 3000
            });

            const ancTxs = new AncestorTransactions({ancestorsCountLimit: 24});

            const utxos = ccFundSrc.collUtxo.find({txout: {$in: [
                '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:0',
                '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:1',
                '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373:0',
                'ad244897a99caa76a5698567dd5c43cb42384b530ac158a7d8cf0be5f9638443:0',
                'a34345f69e5beb3618dfca9a22326f6e978d5ec6ab5d5c57e685e6f812cd628d:0'
            ]}});

            expect(utxos).to.be.an('array').with.lengthOf(5);

            utxos.forEach(utxo => ancTxs.addUtxo(utxo, false));

            expect(ccFundSrc.ancestorTxs.ancestorRefCounter).to.deep.equal(ancTxs.ancestorRefCounter, 'ancestor transactions reference counter not as expected');
        });

        it('the expected UTXOs should be returned when allocating fund of 28700 satoshis', function () {
            ccFundSrc.clearAllocatedUtxos();
            const result = ccFundSrc.allocateFund(28700);

            expect(result).to.be.null;

            const ancTxs = new AncestorTransactions({ancestorsCountLimit: 24});

            expect(ccFundSrc.ancestorTxs.ancestorRefCounter).to.deep.equal(ancTxs.ancestorRefCounter, 'ancestor transactions reference counter not as expected');
        });
    });

    describe('instance including unconfirmed UTXOs with recently confirmed txs', function () {
        let ccFundSrc;

        before(function () {
            resetBitcoinCore(mempoolTestData2, txsTestData1);
            BitcoinCore.initialize();
            resetC3NodeClient(utxosTestData1);
            C3NodeClient.initialize();

            ccFundSrc = new CCFundSource('La8KNZTWQJGEUYfzxSEugGwpDQRUE8JCMeRSXE', 'mrH6bWqKTyntpF9wi7mui4NYxo85frL9X6', {
                useUnconfirmedUtxo: true
            });
        });

        it('recently confirmed UTXOs should have been properly reset', function () {
            const utxos = ccFundSrc.collUtxo.find({txout: {$in: [
                'cb5713d8dc0d5825c8bd2f391e6bd0a9f9c0d3164dd1d594959094e27d34d460:0',
                '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373:0'
            ]}});

            expect(utxos).to.be.an('array').with.lengthOf(1);
            expect(utxos[0]).to.include({txout: 'cb5713d8dc0d5825c8bd2f391e6bd0a9f9c0d3164dd1d594959094e27d34d460:0', confirmations: 1});
        });
    });

    describe('instance including unconfirmed UTXOs and initialization transaction inputs', function () {
        let ccFundSrc;

        before(function () {
            resetBitcoinCore(mempoolTestData1);
            BitcoinCore.initialize();
            resetC3NodeClient(utxosTestData1);
            C3NodeClient.initialize();

            ccFundSrc = new CCFundSource('La8KNZTWQJGEUYfzxSEugGwpDQRUE8JCMeRSXE', 'mrH6bWqKTyntpF9wi7mui4NYxo85frL9X6', {
                useUnconfirmedUtxo: true,
                unconfUtxoInfo: {
                    initTxInputs: [{
                        txout: {
                            txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682',
                            vout: 0,
                            amount: 600,
                            assetAmount: 7000
                        }
                    }, {
                        txout: {
                            txid: 'ad244897a99caa76a5698567dd5c43cb42384b530ac158a7d8cf0be5f9638443',
                            vout: 0,
                            amount: 600,
                            assetAmount: 4000
                        }
                    }, {
                        txout: {
                            txid: '7fa35e8cabf89a25324f7fa25f2f22f47850e97a3c3b05e875ba95c7ead80ad6',
                            vout: 0,
                            amount: 600,
                            assetAmount: 2000
                        }
                    }]
                }
            });
        });

        it('memory pool cache should have been properly initialized', function () {
            expect(ccFundSrc.mempoolTxInfoCache).to.be.a('map').with.keys(
                '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682',
                'ad244897a99caa76a5698567dd5c43cb42384b530ac158a7d8cf0be5f9638443',
                '7fa35e8cabf89a25324f7fa25f2f22f47850e97a3c3b05e875ba95c7ead80ad6'
            );
            expect(ccFundSrc.mempoolTxInfoCache.get('579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682')).to.be.null;
            expect(ccFundSrc.mempoolTxInfoCache.get('ad244897a99caa76a5698567dd5c43cb42384b530ac158a7d8cf0be5f9638443')).to.be.an('object');
            expect(ccFundSrc.mempoolTxInfoCache.get('7fa35e8cabf89a25324f7fa25f2f22f47850e97a3c3b05e875ba95c7ead80ad6')).to.be.an('object');
        });

        it('ancestor transactions state should have been properly initialized', function () {
            const ancTxs = new AncestorTransactions({ancestorsCountLimit: 24});

            const utxos = ccFundSrc.collUtxo.find({txout: {$in: [
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:0',
                        'ad244897a99caa76a5698567dd5c43cb42384b530ac158a7d8cf0be5f9638443:0',
                        '7fa35e8cabf89a25324f7fa25f2f22f47850e97a3c3b05e875ba95c7ead80ad6:0'
                    ]}});

            expect(utxos).to.be.an('array').with.lengthOf(3);

            utxos.forEach(utxo => ancTxs.addUtxo(utxo, false));

            expect(ccFundSrc.ancestorTxs.ancestorRefCounter).to.deep.equal(ancTxs.ancestorRefCounter, 'ancestor transactions reference counter not as expected');
        });
    });

    describe('instance including unconfirmed UTXOs (ancestorCountLimit = 24)', function () {
        let ccFundSrc;

        before(function () {
            resetBitcoinCore(mempoolTestData1);
            BitcoinCore.initialize();
            resetC3NodeClient(utxosTestData1);
            C3NodeClient.initialize();

            ccFundSrc = new CCFundSource('La8KNZTWQJGEUYfzxSEugGwpDQRUE8JCMeRSXE', 'mrH6bWqKTyntpF9wi7mui4NYxo85frL9X6', {
                useUnconfirmedUtxo: true
            });
        });

        it('ancestor count limit should be set as specified', function () {
            expect(ccFundSrc.ancestorsCountUpperLimit).to.equals(24);
        });

        it('confirmed balance should exclude any unconfirmed UTXOs', function () {
            const balance = ccFundSrc.getBalance(false);

            expect(balance).to.equals(13500);
        });

        it('unconfirmed balance should include all UTXOs', function () {
            const balance = ccFundSrc.getBalance(true);

            expect(balance).to.equals(28700);
        });

        it('the expected UTXOs should be returned when allocating fund of 14000 asset units', function () {
            const result = ccFundSrc.allocateFund(14000);

            expect(result).to.exist.and.to.include({changeAssetAmount: 0}).and.to.have.property('utxos').that.is.a('array').with.lengthOf(3);
            expect(result.utxos[0]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 0, assetAmount: 7000
            });
            expect(result.utxos[1]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373', vout: 0, assetAmount: 5000
            });
            expect(result.utxos[2]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '7fa35e8cabf89a25324f7fa25f2f22f47850e97a3c3b05e875ba95c7ead80ad6', vout: 0, assetAmount: 2000
            });

            const ancTxs = new AncestorTransactions({ancestorsCountLimit: 24});

            const utxos = ccFundSrc.collUtxo.find({txout: {$in: [
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:0',
                        '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373:0',
                        '7fa35e8cabf89a25324f7fa25f2f22f47850e97a3c3b05e875ba95c7ead80ad6:0'
                    ]}});

            expect(utxos).to.be.an('array').with.lengthOf(3);

            utxos.forEach(utxo => ancTxs.addUtxo(utxo, false));

            expect(ccFundSrc.ancestorTxs.ancestorRefCounter).to.deep.equal(ancTxs.ancestorRefCounter, 'ancestor transactions reference counter not as expected');
        });

        it('the expected UTXOs should be returned when allocating fund of 15900 asset units', function () {
            ccFundSrc.clearAllocatedUtxos();
            const result = ccFundSrc.allocateFund(15900);

            expect(result).to.exist.and.to.include({changeAssetAmount: 2600}).and.to.have.property('utxos').that.is.a('array').with.lengthOf(3);
            expect(result.utxos[0]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 0, assetAmount: 7000
            });
            expect(result.utxos[1]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 1, assetAmount: 6500
            });
            expect(result.utxos[2]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373', vout: 0, assetAmount: 5000
            });

            const ancTxs = new AncestorTransactions({ancestorsCountLimit: 24});

            const utxos = ccFundSrc.collUtxo.find({txout: {$in: [
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:0',
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:1',
                        '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373:0'
                    ]}});

            expect(utxos).to.be.an('array').with.lengthOf(3);

            utxos.forEach(utxo => ancTxs.addUtxo(utxo, false));

            expect(ccFundSrc.ancestorTxs.ancestorRefCounter).to.deep.equal(ancTxs.ancestorRefCounter, 'ancestor transactions reference counter not as expected');
        });

        it('the expected UTXOs should be returned when allocating fund of 16000 asset units', function () {
            ccFundSrc.clearAllocatedUtxos();
            const result = ccFundSrc.allocateFund(16000);

            expect(result).to.exist.and.to.include({changeAssetAmount: 0}).and.to.have.property('utxos').that.is.a('array').with.lengthOf(3);
            expect(result.utxos[0]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 0, assetAmount: 7000
            });
            expect(result.utxos[1]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373', vout: 0, assetAmount: 5000
            });
            expect(result.utxos[2]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: 'ad244897a99caa76a5698567dd5c43cb42384b530ac158a7d8cf0be5f9638443', vout: 0, assetAmount: 4000
            });

            const ancTxs = new AncestorTransactions({ancestorsCountLimit: 24});

            const utxos = ccFundSrc.collUtxo.find({txout: {$in: [
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:0',
                        '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373:0',
                        'ad244897a99caa76a5698567dd5c43cb42384b530ac158a7d8cf0be5f9638443:0'
                    ]}});

            expect(utxos).to.be.an('array').with.lengthOf(3);

            utxos.forEach(utxo => ancTxs.addUtxo(utxo, false));

            expect(ccFundSrc.ancestorTxs.ancestorRefCounter).to.deep.equal(ancTxs.ancestorRefCounter, 'ancestor transactions reference counter not as expected');
        });

        it('the expected UTXOs should be returned when allocating fund of 24500 asset units', function () {
            ccFundSrc.clearAllocatedUtxos();
            const result = ccFundSrc.allocateFund(24500);

            expect(result).to.exist.and.to.include({changeAssetAmount: 0}).and.to.have.property('utxos').that.is.a('array').with.lengthOf(5);
            expect(result.utxos[0]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 0, assetAmount: 7000
            });
            expect(result.utxos[1]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 1, assetAmount: 6500
            });
            expect(result.utxos[2]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373', vout: 0, assetAmount: 5000
            });
            expect(result.utxos[3]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: 'ad244897a99caa76a5698567dd5c43cb42384b530ac158a7d8cf0be5f9638443', vout: 0, assetAmount: 4000
            });
            expect(result.utxos[4]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '7fa35e8cabf89a25324f7fa25f2f22f47850e97a3c3b05e875ba95c7ead80ad6', vout: 0, assetAmount: 2000
            });

            const ancTxs = new AncestorTransactions({ancestorsCountLimit: 24});

            const utxos = ccFundSrc.collUtxo.find({txout: {$in: [
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:0',
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:1',
                        '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373:0',
                        'ad244897a99caa76a5698567dd5c43cb42384b530ac158a7d8cf0be5f9638443:0',
                        '7fa35e8cabf89a25324f7fa25f2f22f47850e97a3c3b05e875ba95c7ead80ad6:0'
                    ]}});

            expect(utxos).to.be.an('array').with.lengthOf(5);

            utxos.forEach(utxo => ancTxs.addUtxo(utxo, false));

            expect(ccFundSrc.ancestorTxs.ancestorRefCounter).to.deep.equal(ancTxs.ancestorRefCounter, 'ancestor transactions reference counter not as expected');
        });

        it('the expected UTXOs should be returned when allocating fund of 23700 asset units', function () {
            ccFundSrc.clearAllocatedUtxos();
            const result = ccFundSrc.allocateFund(23700);

            expect(result).to.exist.and.to.include({changeAssetAmount: 0}).and.to.have.property('utxos').that.is.a('array').with.lengthOf(5);
            expect(result.utxos[0]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 0, assetAmount: 7000
            });
            expect(result.utxos[1]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 1, assetAmount: 6500
            });
            expect(result.utxos[2]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373', vout: 0, assetAmount: 5000
            });
            expect(result.utxos[3]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: 'ad244897a99caa76a5698567dd5c43cb42384b530ac158a7d8cf0be5f9638443', vout: 0, assetAmount: 4000
            });
            expect(result.utxos[4]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: 'cb5713d8dc0d5825c8bd2f391e6bd0a9f9c0d3164dd1d594959094e27d34d460', vout: 0, assetAmount: 1200
            });

            const ancTxs = new AncestorTransactions({ancestorsCountLimit: 24});

            const utxos = ccFundSrc.collUtxo.find({txout: {$in: [
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:0',
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:1',
                        '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373:0',
                        'ad244897a99caa76a5698567dd5c43cb42384b530ac158a7d8cf0be5f9638443:0',
                        'cb5713d8dc0d5825c8bd2f391e6bd0a9f9c0d3164dd1d594959094e27d34d460:0'
                    ]}});

            expect(utxos).to.be.an('array').with.lengthOf(5);

            utxos.forEach(utxo => ancTxs.addUtxo(utxo, false));

            expect(ccFundSrc.ancestorTxs.ancestorRefCounter).to.deep.equal(ancTxs.ancestorRefCounter, 'ancestor transactions reference counter not as expected');
        });

        it('the expected UTXOs should be returned when allocating fund of 28700 asset units', function () {
            ccFundSrc.clearAllocatedUtxos();
            const result = ccFundSrc.allocateFund(28700);

            expect(result).to.exist.and.to.include({changeAssetAmount: 0}).and.to.have.property('utxos').that.is.a('array').with.lengthOf(7);
            expect(result.utxos[0]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 0, assetAmount: 7000
            });
            expect(result.utxos[1]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 1, assetAmount: 6500
            });
            expect(result.utxos[2]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373', vout: 0, assetAmount: 5000
            });
            expect(result.utxos[3]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: 'ad244897a99caa76a5698567dd5c43cb42384b530ac158a7d8cf0be5f9638443', vout: 0, assetAmount: 4000
            });
            expect(result.utxos[4]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: 'a34345f69e5beb3618dfca9a22326f6e978d5ec6ab5d5c57e685e6f812cd628d', vout: 0, assetAmount: 3000
            });
            expect(result.utxos[5]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '7fa35e8cabf89a25324f7fa25f2f22f47850e97a3c3b05e875ba95c7ead80ad6', vout: 0, assetAmount: 2000
            });
            expect(result.utxos[6]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: 'cb5713d8dc0d5825c8bd2f391e6bd0a9f9c0d3164dd1d594959094e27d34d460', vout: 0, assetAmount: 1200
            });

            const ancTxs = new AncestorTransactions({ancestorsCountLimit: 24});

            const utxos = ccFundSrc.collUtxo.find({txout: {$in: [
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:0',
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:1',
                        '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373:0',
                        'ad244897a99caa76a5698567dd5c43cb42384b530ac158a7d8cf0be5f9638443:0',
                        'a34345f69e5beb3618dfca9a22326f6e978d5ec6ab5d5c57e685e6f812cd628d:0',
                        '7fa35e8cabf89a25324f7fa25f2f22f47850e97a3c3b05e875ba95c7ead80ad6:0',
                        'cb5713d8dc0d5825c8bd2f391e6bd0a9f9c0d3164dd1d594959094e27d34d460:0'
                    ]}});

            expect(utxos).to.be.an('array').with.lengthOf(7);

            utxos.forEach(utxo => ancTxs.addUtxo(utxo, false));

            expect(ccFundSrc.ancestorTxs.ancestorRefCounter).to.deep.equal(ancTxs.ancestorRefCounter, 'ancestor transactions reference counter not as expected');
        });
    });

    describe('instance including unconfirmed UTXOs (ancestorCountLimit = 4)', function () {
        let ccFundSrc;

        before(function () {
            resetBitcoinCore(mempoolTestData1);
            BitcoinCore.initialize();
            resetC3NodeClient(utxosTestData1);
            C3NodeClient.initialize();

            ccFundSrc = new CCFundSource('La8KNZTWQJGEUYfzxSEugGwpDQRUE8JCMeRSXE', 'mrH6bWqKTyntpF9wi7mui4NYxo85frL9X6', {
                useUnconfirmedUtxo: true,
                unconfUtxoInfo: {
                    ancestorsCountDiff: 21
                }
            });
        });

        it('ancestor count limit should be set as specified', function () {
            expect(ccFundSrc.ancestorsCountUpperLimit).to.equals(4);
        });

        it('confirmed balance should exclude any unconfirmed UTXOs', function () {
            const balance = ccFundSrc.getBalance(false);

            expect(balance).to.equals(13500);
        });

        it('unconfirmed balance should exclude some UTXOs (with high ancestor count)', function () {
            const balance = ccFundSrc.getBalance(true);

            expect(balance).to.equals(24700);
        });

        it('the expected UTXOs should be returned when allocating fund of 14000 asset units', function () {
            const result = ccFundSrc.allocateFund(14000);

            expect(result).to.exist.and.to.include({changeAssetAmount: 0}).and.to.have.property('utxos').that.is.a('array').with.lengthOf(3);
            expect(result.utxos[0]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 0, assetAmount: 7000
            });
            expect(result.utxos[1]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373', vout: 0, assetAmount: 5000
            });
            expect(result.utxos[2]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '7fa35e8cabf89a25324f7fa25f2f22f47850e97a3c3b05e875ba95c7ead80ad6', vout: 0, assetAmount: 2000
            });

            const ancTxs = new AncestorTransactions({ancestorsCountLimit: 4});

            const utxos = ccFundSrc.collUtxo.find({txout: {$in: [
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:0',
                        '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373:0',
                        '7fa35e8cabf89a25324f7fa25f2f22f47850e97a3c3b05e875ba95c7ead80ad6:0'
                    ]}});

            expect(utxos).to.be.an('array').with.lengthOf(3);

            utxos.forEach(utxo => ancTxs.addUtxo(utxo, false));

            expect(ccFundSrc.ancestorTxs.ancestorRefCounter).to.deep.equal(ancTxs.ancestorRefCounter, 'ancestor transactions reference counter not as expected');
        });

        it('the expected UTXOs should be returned when allocating fund of 15900 asset units', function () {
            ccFundSrc.clearAllocatedUtxos();
            const result = ccFundSrc.allocateFund(15900);

            expect(result).to.exist.and.to.include({changeAssetAmount: 2600}).and.to.have.property('utxos').that.is.a('array').with.lengthOf(3);
            expect(result.utxos[0]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 0, assetAmount: 7000
            });
            expect(result.utxos[1]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 1, assetAmount: 6500
            });
            expect(result.utxos[2]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373', vout: 0, assetAmount: 5000
            });

            const ancTxs = new AncestorTransactions({ancestorsCountLimit: 4});

            const utxos = ccFundSrc.collUtxo.find({txout: {$in: [
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:0',
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:1',
                        '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373:0'
                    ]}});

            expect(utxos).to.be.an('array').with.lengthOf(3);

            utxos.forEach(utxo => ancTxs.addUtxo(utxo, false));

            expect(ccFundSrc.ancestorTxs.ancestorRefCounter).to.deep.equal(ancTxs.ancestorRefCounter, 'ancestor transactions reference counter not as expected');
        });

        it('the expected UTXOs should be returned when allocating fund of 16000 asset units', function () {
            ccFundSrc.clearAllocatedUtxos();
            const result = ccFundSrc.allocateFund(16000);

            expect(result).to.exist.and.to.include({changeAssetAmount: 2500}).and.to.have.property('utxos').that.is.a('array').with.lengthOf(3);
            expect(result.utxos[0]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 0, assetAmount: 7000
            });
            expect(result.utxos[1]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 1, assetAmount: 6500
            });
            expect(result.utxos[2]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373', vout: 0, assetAmount: 5000
            });

            const ancTxs = new AncestorTransactions({ancestorsCountLimit: 4});

            const utxos = ccFundSrc.collUtxo.find({txout: {$in: [
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:0',
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:1',
                        '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373:0'
                    ]}});

            expect(utxos).to.be.an('array').with.lengthOf(3);

            utxos.forEach(utxo => ancTxs.addUtxo(utxo, false));

            expect(ccFundSrc.ancestorTxs.ancestorRefCounter).to.deep.equal(ancTxs.ancestorRefCounter, 'ancestor transactions reference counter not as expected');
        });

        it('the expected UTXOs should be returned when allocating fund of 24500 asset units', function () {
            ccFundSrc.clearAllocatedUtxos();
            const result = ccFundSrc.allocateFund(24500);

            expect(result).to.exist.and.to.include({changeAssetAmount: 200}).and.to.have.property('utxos').that.is.a('array').with.lengthOf(6);
            expect(result.utxos[0]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 0, assetAmount: 7000
            });
            expect(result.utxos[1]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 1, assetAmount: 6500
            });
            expect(result.utxos[2]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373', vout: 0, assetAmount: 5000
            });
            expect(result.utxos[3]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: 'a34345f69e5beb3618dfca9a22326f6e978d5ec6ab5d5c57e685e6f812cd628d', vout: 0, assetAmount: 3000
            });
            expect(result.utxos[4]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '7fa35e8cabf89a25324f7fa25f2f22f47850e97a3c3b05e875ba95c7ead80ad6', vout: 0, assetAmount: 2000
            });
            expect(result.utxos[5]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: 'cb5713d8dc0d5825c8bd2f391e6bd0a9f9c0d3164dd1d594959094e27d34d460', vout: 0, assetAmount: 1200
            });

            const ancTxs = new AncestorTransactions({ancestorsCountLimit: 4});

            const utxos = ccFundSrc.collUtxo.find({txout: {$in: [
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:0',
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:1',
                        '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373:0',
                        'a34345f69e5beb3618dfca9a22326f6e978d5ec6ab5d5c57e685e6f812cd628d:0',
                        '7fa35e8cabf89a25324f7fa25f2f22f47850e97a3c3b05e875ba95c7ead80ad6:0',
                        'cb5713d8dc0d5825c8bd2f391e6bd0a9f9c0d3164dd1d594959094e27d34d460:0'
                    ]}});

            expect(utxos).to.be.an('array').with.lengthOf(6);

            utxos.forEach(utxo => ancTxs.addUtxo(utxo, false));

            expect(ccFundSrc.ancestorTxs.ancestorRefCounter).to.deep.equal(ancTxs.ancestorRefCounter, 'ancestor transactions reference counter not as expected');
        });

        it('the expected UTXOs should be returned when allocating fund of 23700 asset units', function () {
            ccFundSrc.clearAllocatedUtxos();
            const result = ccFundSrc.allocateFund(23700);

            expect(result).to.exist.and.to.include({changeAssetAmount: 0}).and.to.have.property('utxos').that.is.a('array').with.lengthOf(6);
            expect(result.utxos[0]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 0, assetAmount: 7000
            });
            expect(result.utxos[1]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 1, assetAmount: 6500
            });
            expect(result.utxos[2]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: 'ad244897a99caa76a5698567dd5c43cb42384b530ac158a7d8cf0be5f9638443', vout: 0, assetAmount: 4000
            });
            expect(result.utxos[3]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: 'a34345f69e5beb3618dfca9a22326f6e978d5ec6ab5d5c57e685e6f812cd628d', vout: 0, assetAmount: 3000
            });
            expect(result.utxos[4]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '7fa35e8cabf89a25324f7fa25f2f22f47850e97a3c3b05e875ba95c7ead80ad6', vout: 0, assetAmount: 2000
            });
            expect(result.utxos[5]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: 'cb5713d8dc0d5825c8bd2f391e6bd0a9f9c0d3164dd1d594959094e27d34d460', vout: 0, assetAmount: 1200
            });

            const ancTxs = new AncestorTransactions({ancestorsCountLimit: 4});

            const utxos = ccFundSrc.collUtxo.find({txout: {$in: [
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:0',
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:1',
                        'ad244897a99caa76a5698567dd5c43cb42384b530ac158a7d8cf0be5f9638443:0',
                        'a34345f69e5beb3618dfca9a22326f6e978d5ec6ab5d5c57e685e6f812cd628d:0',
                        '7fa35e8cabf89a25324f7fa25f2f22f47850e97a3c3b05e875ba95c7ead80ad6:0',
                        'cb5713d8dc0d5825c8bd2f391e6bd0a9f9c0d3164dd1d594959094e27d34d460:0'
                    ]}});

            expect(utxos).to.be.an('array').with.lengthOf(6);

            utxos.forEach(utxo => ancTxs.addUtxo(utxo, false));

            expect(ccFundSrc.ancestorTxs.ancestorRefCounter).to.deep.equal(ancTxs.ancestorRefCounter, 'ancestor transactions reference counter not as expected');
        });

        it('the expected UTXOs should be returned when allocating fund of 28700 asset units', function () {
            ccFundSrc.clearAllocatedUtxos();
            const result = ccFundSrc.allocateFund(28700);

            expect(result).to.be.null;

            const ancTxs = new AncestorTransactions({ancestorsCountLimit: 4});

            expect(ccFundSrc.ancestorTxs.ancestorRefCounter).to.deep.equal(ancTxs.ancestorRefCounter, 'ancestor transactions reference counter not as expected');
        });
    });

    describe('instance including unconfirmed UTXOs (ancestorCountLimit = 24) and smallest change', function () {
        let ccFundSrc;

        before(function () {
            resetBitcoinCore(mempoolTestData1);
            BitcoinCore.initialize();
            resetC3NodeClient(utxosTestData1);
            C3NodeClient.initialize();

            ccFundSrc = new CCFundSource('La8KNZTWQJGEUYfzxSEugGwpDQRUE8JCMeRSXE', 'mrH6bWqKTyntpF9wi7mui4NYxo85frL9X6', {
                useUnconfirmedUtxo: true,
                smallestChange: true
            });
        });

        it('ancestor count limit should be set as specified', function () {
            expect(ccFundSrc.ancestorsCountUpperLimit).to.equals(24);
        });

        it('confirmed balance should exclude any unconfirmed UTXOs', function () {
            const balance = ccFundSrc.getBalance(false);

            expect(balance).to.equals(13500);
        });

        it('unconfirmed balance should include all UTXOs', function () {
            const balance = ccFundSrc.getBalance(true);

            expect(balance).to.equals(28700);
        });

        it('the expected UTXOs should be returned when allocating fund of 14000 asset units', function () {
            const result = ccFundSrc.allocateFund(14000);

            expect(result).to.exist.and.to.include({changeAssetAmount: 0}).and.to.have.property('utxos').that.is.a('array').with.lengthOf(3);
            expect(result.utxos[0]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 0, assetAmount: 7000
            });
            expect(result.utxos[1]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373', vout: 0, assetAmount: 5000
            });
            expect(result.utxos[2]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '7fa35e8cabf89a25324f7fa25f2f22f47850e97a3c3b05e875ba95c7ead80ad6', vout: 0, assetAmount: 2000
            });

            const ancTxs = new AncestorTransactions({ancestorsCountLimit: 24});

            const utxos = ccFundSrc.collUtxo.find({txout: {$in: [
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:0',
                        '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373:0',
                        '7fa35e8cabf89a25324f7fa25f2f22f47850e97a3c3b05e875ba95c7ead80ad6:0'
                    ]}});

            expect(utxos).to.be.an('array').with.lengthOf(3);

            utxos.forEach(utxo => ancTxs.addUtxo(utxo, false));

            expect(ccFundSrc.ancestorTxs.ancestorRefCounter).to.deep.equal(ancTxs.ancestorRefCounter, 'ancestor transactions reference counter not as expected');
        });

        it('the expected UTXOs should be returned when allocating fund of 15900 asset units', function () {
            ccFundSrc.clearAllocatedUtxos();
            const result = ccFundSrc.allocateFund(15900);

            expect(result).to.exist.and.to.include({changeAssetAmount: 100}).and.to.have.property('utxos').that.is.a('array').with.lengthOf(3);
            expect(result.utxos[0]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 0, assetAmount: 7000
            });
            expect(result.utxos[1]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373', vout: 0, assetAmount: 5000
            });
            expect(result.utxos[2]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: 'ad244897a99caa76a5698567dd5c43cb42384b530ac158a7d8cf0be5f9638443', vout: 0, assetAmount: 4000
            });

            const ancTxs = new AncestorTransactions({ancestorsCountLimit: 24});

            const utxos = ccFundSrc.collUtxo.find({txout: {$in: [
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:0',
                        '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373:0',
                        'ad244897a99caa76a5698567dd5c43cb42384b530ac158a7d8cf0be5f9638443:0'
                    ]}});

            expect(utxos).to.be.an('array').with.lengthOf(3);

            utxos.forEach(utxo => ancTxs.addUtxo(utxo, false));

            expect(ccFundSrc.ancestorTxs.ancestorRefCounter).to.deep.equal(ancTxs.ancestorRefCounter, 'ancestor transactions reference counter not as expected');
        });

        it('the expected UTXOs should be returned when allocating fund of 16000 asset units', function () {
            ccFundSrc.clearAllocatedUtxos();
            const result = ccFundSrc.allocateFund(16000);

            expect(result).to.exist.and.to.include({changeAssetAmount: 0}).and.to.have.property('utxos').that.is.a('array').with.lengthOf(3);
            expect(result.utxos[0]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 0, assetAmount: 7000
            });
            expect(result.utxos[1]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373', vout: 0, assetAmount: 5000
            });
            expect(result.utxos[2]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: 'ad244897a99caa76a5698567dd5c43cb42384b530ac158a7d8cf0be5f9638443', vout: 0, assetAmount: 4000
            });

            const ancTxs = new AncestorTransactions({ancestorsCountLimit: 24});

            const utxos = ccFundSrc.collUtxo.find({txout: {$in: [
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:0',
                        '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373:0',
                        'ad244897a99caa76a5698567dd5c43cb42384b530ac158a7d8cf0be5f9638443:0'
                    ]}});

            expect(utxos).to.be.an('array').with.lengthOf(3);

            utxos.forEach(utxo => ancTxs.addUtxo(utxo, false));

            expect(ccFundSrc.ancestorTxs.ancestorRefCounter).to.deep.equal(ancTxs.ancestorRefCounter, 'ancestor transactions reference counter not as expected');
        });

        it('the expected UTXOs should be returned when allocating fund of 24500 asset units', function () {
            ccFundSrc.clearAllocatedUtxos();
            const result = ccFundSrc.allocateFund(24500);

            expect(result).to.exist.and.to.include({changeAssetAmount: 0}).and.to.have.property('utxos').that.is.a('array').with.lengthOf(5);
            expect(result.utxos[0]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 0, assetAmount: 7000
            });
            expect(result.utxos[1]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 1, assetAmount: 6500
            });
            expect(result.utxos[2]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373', vout: 0, assetAmount: 5000
            });
            expect(result.utxos[3]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: 'ad244897a99caa76a5698567dd5c43cb42384b530ac158a7d8cf0be5f9638443', vout: 0, assetAmount: 4000
            });
            expect(result.utxos[4]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '7fa35e8cabf89a25324f7fa25f2f22f47850e97a3c3b05e875ba95c7ead80ad6', vout: 0, assetAmount: 2000
            });

            const ancTxs = new AncestorTransactions({ancestorsCountLimit: 24});

            const utxos = ccFundSrc.collUtxo.find({txout: {$in: [
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:0',
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:1',
                        '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373:0',
                        'ad244897a99caa76a5698567dd5c43cb42384b530ac158a7d8cf0be5f9638443:0',
                        '7fa35e8cabf89a25324f7fa25f2f22f47850e97a3c3b05e875ba95c7ead80ad6:0'
                    ]}});

            expect(utxos).to.be.an('array').with.lengthOf(5);

            utxos.forEach(utxo => ancTxs.addUtxo(utxo, false));

            expect(ccFundSrc.ancestorTxs.ancestorRefCounter).to.deep.equal(ancTxs.ancestorRefCounter, 'ancestor transactions reference counter not as expected');
        });

        it('the expected UTXOs should be returned when allocating fund of 23700 asset units', function () {
            ccFundSrc.clearAllocatedUtxos();
            const result = ccFundSrc.allocateFund(23700);

            expect(result).to.exist.and.to.include({changeAssetAmount: 0}).and.to.have.property('utxos').that.is.a('array').with.lengthOf(5);
            expect(result.utxos[0]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 0, assetAmount: 7000
            });
            expect(result.utxos[1]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 1, assetAmount: 6500
            });
            expect(result.utxos[2]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373', vout: 0, assetAmount: 5000
            });
            expect(result.utxos[3]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: 'ad244897a99caa76a5698567dd5c43cb42384b530ac158a7d8cf0be5f9638443', vout: 0, assetAmount: 4000
            });
            expect(result.utxos[4]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: 'cb5713d8dc0d5825c8bd2f391e6bd0a9f9c0d3164dd1d594959094e27d34d460', vout: 0, assetAmount: 1200
            });

            const ancTxs = new AncestorTransactions({ancestorsCountLimit: 24});

            const utxos = ccFundSrc.collUtxo.find({txout: {$in: [
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:0',
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:1',
                        '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373:0',
                        'ad244897a99caa76a5698567dd5c43cb42384b530ac158a7d8cf0be5f9638443:0',
                        'cb5713d8dc0d5825c8bd2f391e6bd0a9f9c0d3164dd1d594959094e27d34d460:0'
                    ]}});

            expect(utxos).to.be.an('array').with.lengthOf(5);

            utxos.forEach(utxo => ancTxs.addUtxo(utxo, false));

            expect(ccFundSrc.ancestorTxs.ancestorRefCounter).to.deep.equal(ancTxs.ancestorRefCounter, 'ancestor transactions reference counter not as expected');
        });

        it('the expected UTXOs should be returned when allocating fund of 28700 asset units', function () {
            ccFundSrc.clearAllocatedUtxos();
            const result = ccFundSrc.allocateFund(28700);

            expect(result).to.exist.and.to.include({changeAssetAmount: 0}).and.to.have.property('utxos').that.is.a('array').with.lengthOf(7);
            expect(result.utxos[0]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 0, assetAmount: 7000
            });
            expect(result.utxos[1]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 1, assetAmount: 6500
            });
            expect(result.utxos[2]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373', vout: 0, assetAmount: 5000
            });
            expect(result.utxos[3]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: 'ad244897a99caa76a5698567dd5c43cb42384b530ac158a7d8cf0be5f9638443', vout: 0, assetAmount: 4000
            });
            expect(result.utxos[4]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: 'a34345f69e5beb3618dfca9a22326f6e978d5ec6ab5d5c57e685e6f812cd628d', vout: 0, assetAmount: 3000
            });
            expect(result.utxos[5]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '7fa35e8cabf89a25324f7fa25f2f22f47850e97a3c3b05e875ba95c7ead80ad6', vout: 0, assetAmount: 2000
            });
            expect(result.utxos[6]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: 'cb5713d8dc0d5825c8bd2f391e6bd0a9f9c0d3164dd1d594959094e27d34d460', vout: 0, assetAmount: 1200
            });

            const ancTxs = new AncestorTransactions({ancestorsCountLimit: 24});

            const utxos = ccFundSrc.collUtxo.find({txout: {$in: [
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:0',
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:1',
                        '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373:0',
                        'ad244897a99caa76a5698567dd5c43cb42384b530ac158a7d8cf0be5f9638443:0',
                        'a34345f69e5beb3618dfca9a22326f6e978d5ec6ab5d5c57e685e6f812cd628d:0',
                        '7fa35e8cabf89a25324f7fa25f2f22f47850e97a3c3b05e875ba95c7ead80ad6:0',
                        'cb5713d8dc0d5825c8bd2f391e6bd0a9f9c0d3164dd1d594959094e27d34d460:0'
                    ]}});

            expect(utxos).to.be.an('array').with.lengthOf(7);

            utxos.forEach(utxo => ancTxs.addUtxo(utxo, false));

            expect(ccFundSrc.ancestorTxs.ancestorRefCounter).to.deep.equal(ancTxs.ancestorRefCounter, 'ancestor transactions reference counter not as expected');
        });
    });

    describe('instance including unconfirmed UTXOs (ancestorCountLimit = 4) and smallest change', function () {
        let ccFundSrc;

        before(function () {
            resetBitcoinCore(mempoolTestData1);
            BitcoinCore.initialize();
            resetC3NodeClient(utxosTestData1);
            C3NodeClient.initialize();

            ccFundSrc = new CCFundSource('La8KNZTWQJGEUYfzxSEugGwpDQRUE8JCMeRSXE', 'mrH6bWqKTyntpF9wi7mui4NYxo85frL9X6', {
                useUnconfirmedUtxo: true,
                unconfUtxoInfo: {
                    ancestorsCountDiff: 21
                },
                smallestChange: true
            });
        });

        it('ancestor count limit should be set as specified', function () {
            expect(ccFundSrc.ancestorsCountUpperLimit).to.equals(4);
        });

        it('confirmed balance should exclude any unconfirmed UTXOs', function () {
            const balance = ccFundSrc.getBalance(false);

            expect(balance).to.equals(13500);
        });

        it('unconfirmed balance should exclude some UTXOs (with high ancestor count)', function () {
            const balance = ccFundSrc.getBalance(true);

            expect(balance).to.equals(24700);
        });

        it('the expected UTXOs should be returned when allocating fund of 14000 asset units', function () {
            const result = ccFundSrc.allocateFund(14000);

            expect(result).to.exist.and.to.include({changeAssetAmount: 0}).and.to.have.property('utxos').that.is.a('array').with.lengthOf(3);
            expect(result.utxos[0]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 0, assetAmount: 7000
            });
            expect(result.utxos[1]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373', vout: 0, assetAmount: 5000
            });
            expect(result.utxos[2]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '7fa35e8cabf89a25324f7fa25f2f22f47850e97a3c3b05e875ba95c7ead80ad6', vout: 0, assetAmount: 2000
            });

            const ancTxs = new AncestorTransactions({ancestorsCountLimit: 4});

            const utxos = ccFundSrc.collUtxo.find({txout: {$in: [
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:0',
                        '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373:0',
                        '7fa35e8cabf89a25324f7fa25f2f22f47850e97a3c3b05e875ba95c7ead80ad6:0'
                    ]}});

            expect(utxos).to.be.an('array').with.lengthOf(3);

            utxos.forEach(utxo => ancTxs.addUtxo(utxo, false));

            expect(ccFundSrc.ancestorTxs.ancestorRefCounter).to.deep.equal(ancTxs.ancestorRefCounter, 'ancestor transactions reference counter not as expected');
        });

        it('the expected UTXOs should be returned when allocating fund of 15900 asset units', function () {
            ccFundSrc.clearAllocatedUtxos();
            const result = ccFundSrc.allocateFund(15900);

            expect(result).to.exist.and.to.include({changeAssetAmount: 600}).and.to.have.property('utxos').that.is.a('array').with.lengthOf(3);
            expect(result.utxos[0]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 0, assetAmount: 7000
            });
            expect(result.utxos[1]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 1, assetAmount: 6500
            });
            expect(result.utxos[2]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: 'a34345f69e5beb3618dfca9a22326f6e978d5ec6ab5d5c57e685e6f812cd628d', vout: 0, assetAmount: 3000
            });

            const ancTxs = new AncestorTransactions({ancestorsCountLimit: 4});

            const utxos = ccFundSrc.collUtxo.find({txout: {$in: [
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:0',
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:1',
                        'a34345f69e5beb3618dfca9a22326f6e978d5ec6ab5d5c57e685e6f812cd628d:0'
                    ]}});

            expect(utxos).to.be.an('array').with.lengthOf(3);

            utxos.forEach(utxo => ancTxs.addUtxo(utxo, false));

            expect(ccFundSrc.ancestorTxs.ancestorRefCounter).to.deep.equal(ancTxs.ancestorRefCounter, 'ancestor transactions reference counter not as expected');
        });

        it('the expected UTXOs should be returned when allocating fund of 16000 asset units', function () {
            ccFundSrc.clearAllocatedUtxos();
            const result = ccFundSrc.allocateFund(16000);

            expect(result).to.exist.and.to.include({changeAssetAmount: 500}).and.to.have.property('utxos').that.is.a('array').with.lengthOf(3);
            expect(result.utxos[0]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 0, assetAmount: 7000
            });
            expect(result.utxos[1]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 1, assetAmount: 6500
            });
            expect(result.utxos[2]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: 'a34345f69e5beb3618dfca9a22326f6e978d5ec6ab5d5c57e685e6f812cd628d', vout: 0, assetAmount: 3000
            });

            const ancTxs = new AncestorTransactions({ancestorsCountLimit: 4});

            const utxos = ccFundSrc.collUtxo.find({txout: {$in: [
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:0',
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:1',
                        'a34345f69e5beb3618dfca9a22326f6e978d5ec6ab5d5c57e685e6f812cd628d:0'
                    ]}});

            expect(utxos).to.be.an('array').with.lengthOf(3);

            utxos.forEach(utxo => ancTxs.addUtxo(utxo, false));

            expect(ccFundSrc.ancestorTxs.ancestorRefCounter).to.deep.equal(ancTxs.ancestorRefCounter, 'ancestor transactions reference counter not as expected');
        });

        it('the expected UTXOs should be returned when allocating fund of 24500 asset units', function () {
            ccFundSrc.clearAllocatedUtxos();
            const result = ccFundSrc.allocateFund(24500);

            expect(result).to.exist.and.to.include({changeAssetAmount: 200}).and.to.have.property('utxos').that.is.a('array').with.lengthOf(6);
            expect(result.utxos[0]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 0, assetAmount: 7000
            });
            expect(result.utxos[1]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 1, assetAmount: 6500
            });
            expect(result.utxos[2]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373', vout: 0, assetAmount: 5000
            });
            expect(result.utxos[3]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: 'a34345f69e5beb3618dfca9a22326f6e978d5ec6ab5d5c57e685e6f812cd628d', vout: 0, assetAmount: 3000
            });
            expect(result.utxos[4]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '7fa35e8cabf89a25324f7fa25f2f22f47850e97a3c3b05e875ba95c7ead80ad6', vout: 0, assetAmount: 2000
            });
            expect(result.utxos[5]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: 'cb5713d8dc0d5825c8bd2f391e6bd0a9f9c0d3164dd1d594959094e27d34d460', vout: 0, assetAmount: 1200
            });

            const ancTxs = new AncestorTransactions({ancestorsCountLimit: 4});

            const utxos = ccFundSrc.collUtxo.find({txout: {$in: [
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:0',
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:1',
                        '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373:0',
                        'a34345f69e5beb3618dfca9a22326f6e978d5ec6ab5d5c57e685e6f812cd628d:0',
                        '7fa35e8cabf89a25324f7fa25f2f22f47850e97a3c3b05e875ba95c7ead80ad6:0',
                        'cb5713d8dc0d5825c8bd2f391e6bd0a9f9c0d3164dd1d594959094e27d34d460:0'
                    ]}});

            expect(utxos).to.be.an('array').with.lengthOf(6);

            utxos.forEach(utxo => ancTxs.addUtxo(utxo, false));

            expect(ccFundSrc.ancestorTxs.ancestorRefCounter).to.deep.equal(ancTxs.ancestorRefCounter, 'ancestor transactions reference counter not as expected');
        });

        it('the expected UTXOs should be returned when allocating fund of 23700 asset units', function () {
            ccFundSrc.clearAllocatedUtxos();
            const result = ccFundSrc.allocateFund(23700);

            expect(result).to.exist.and.to.include({changeAssetAmount: 0}).and.to.have.property('utxos').that.is.a('array').with.lengthOf(6);
            expect(result.utxos[0]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 0, assetAmount: 7000
            });
            expect(result.utxos[1]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 1, assetAmount: 6500
            });
            expect(result.utxos[2]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: 'ad244897a99caa76a5698567dd5c43cb42384b530ac158a7d8cf0be5f9638443', vout: 0, assetAmount: 4000
            });
            expect(result.utxos[3]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: 'a34345f69e5beb3618dfca9a22326f6e978d5ec6ab5d5c57e685e6f812cd628d', vout: 0, assetAmount: 3000
            });
            expect(result.utxos[4]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '7fa35e8cabf89a25324f7fa25f2f22f47850e97a3c3b05e875ba95c7ead80ad6', vout: 0, assetAmount: 2000
            });
            expect(result.utxos[5]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: 'cb5713d8dc0d5825c8bd2f391e6bd0a9f9c0d3164dd1d594959094e27d34d460', vout: 0, assetAmount: 1200
            });

            const ancTxs = new AncestorTransactions({ancestorsCountLimit: 4});

            const utxos = ccFundSrc.collUtxo.find({txout: {$in: [
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:0',
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:1',
                        'ad244897a99caa76a5698567dd5c43cb42384b530ac158a7d8cf0be5f9638443:0',
                        'a34345f69e5beb3618dfca9a22326f6e978d5ec6ab5d5c57e685e6f812cd628d:0',
                        '7fa35e8cabf89a25324f7fa25f2f22f47850e97a3c3b05e875ba95c7ead80ad6:0',
                        'cb5713d8dc0d5825c8bd2f391e6bd0a9f9c0d3164dd1d594959094e27d34d460:0'
                    ]}});

            expect(utxos).to.be.an('array').with.lengthOf(6);

            utxos.forEach(utxo => ancTxs.addUtxo(utxo, false));

            expect(ccFundSrc.ancestorTxs.ancestorRefCounter).to.deep.equal(ancTxs.ancestorRefCounter, 'ancestor transactions reference counter not as expected');
        });

        it('the expected UTXOs should be returned when allocating fund of 28700 asset units', function () {
            ccFundSrc.clearAllocatedUtxos();
            const result = ccFundSrc.allocateFund(28700);

            expect(result).to.be.null;

            const ancTxs = new AncestorTransactions({ancestorsCountLimit: 4});

            expect(ccFundSrc.ancestorTxs.ancestorRefCounter).to.deep.equal(ancTxs.ancestorRefCounter, 'ancestor transactions reference counter not as expected');
        });
    });

    describe('instance including unconfirmed UTXOs (ancestorCountLimit = 24) and higher amount', function () {
        let ccFundSrc;

        before(function () {
            resetBitcoinCore(mempoolTestData1);
            BitcoinCore.initialize();
            resetC3NodeClient(utxosTestData1);
            C3NodeClient.initialize();

            ccFundSrc = new CCFundSource('La8KNZTWQJGEUYfzxSEugGwpDQRUE8JCMeRSXE', 'mrH6bWqKTyntpF9wi7mui4NYxo85frL9X6', {
                useUnconfirmedUtxo: true,
                higherAmountUtxos: true
            });
        });

        it('ancestor count limit should be set as specified', function () {
            expect(ccFundSrc.ancestorsCountUpperLimit).to.equals(24);
        });

        it('confirmed balance should exclude any unconfirmed UTXOs', function () {
            const balance = ccFundSrc.getBalance(false);

            expect(balance).to.equals(13500);
        });

        it('unconfirmed balance should include all UTXOs', function () {
            const balance = ccFundSrc.getBalance(true);

            expect(balance).to.equals(28700);
        });

        it('the expected UTXOs should be returned when allocating fund of 14000 asset units', function () {
            const result = ccFundSrc.allocateFund(14000);

            expect(result).to.exist.and.to.include({changeAssetAmount: 4500}).and.to.have.property('utxos').that.is.a('array').with.lengthOf(3);
            expect(result.utxos[0]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 0, assetAmount: 7000
            });
            expect(result.utxos[1]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 1, assetAmount: 6500
            });
            expect(result.utxos[2]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373', vout: 0, assetAmount: 5000
            });

            const ancTxs = new AncestorTransactions({ancestorsCountLimit: 24});

            const utxos = ccFundSrc.collUtxo.find({txout: {$in: [
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:0',
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:1',
                        '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373:0'
                    ]}});

            expect(utxos).to.be.an('array').with.lengthOf(3);

            utxos.forEach(utxo => ancTxs.addUtxo(utxo, false));

            expect(ccFundSrc.ancestorTxs.ancestorRefCounter).to.deep.equal(ancTxs.ancestorRefCounter, 'ancestor transactions reference counter not as expected');
        });

        it('the expected UTXOs should be returned when allocating fund of 15900 asset units', function () {
            ccFundSrc.clearAllocatedUtxos();
            const result = ccFundSrc.allocateFund(15900);

            expect(result).to.exist.and.to.include({changeAssetAmount: 2600}).and.to.have.property('utxos').that.is.a('array').with.lengthOf(3);
            expect(result.utxos[0]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 0, assetAmount: 7000
            });
            expect(result.utxos[1]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 1, assetAmount: 6500
            });
            expect(result.utxos[2]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373', vout: 0, assetAmount: 5000
            });

            const ancTxs = new AncestorTransactions({ancestorsCountLimit: 24});

            const utxos = ccFundSrc.collUtxo.find({txout: {$in: [
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:0',
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:1',
                        '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373:0'
                    ]}});

            expect(utxos).to.be.an('array').with.lengthOf(3);

            utxos.forEach(utxo => ancTxs.addUtxo(utxo, false));

            expect(ccFundSrc.ancestorTxs.ancestorRefCounter).to.deep.equal(ancTxs.ancestorRefCounter, 'ancestor transactions reference counter not as expected');
        });

        it('the expected UTXOs should be returned when allocating fund of 16000 asset units', function () {
            ccFundSrc.clearAllocatedUtxos();
            const result = ccFundSrc.allocateFund(16000);

            expect(result).to.exist.and.to.include({changeAssetAmount: 2500}).and.to.have.property('utxos').that.is.a('array').with.lengthOf(3);
            expect(result.utxos[0]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 0, assetAmount: 7000
            });
            expect(result.utxos[1]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 1, assetAmount: 6500
            });
            expect(result.utxos[2]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373', vout: 0, assetAmount: 5000
            });

            const ancTxs = new AncestorTransactions({ancestorsCountLimit: 24});

            const utxos = ccFundSrc.collUtxo.find({txout: {$in: [
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:0',
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:1',
                        '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373:0'
                    ]}});

            expect(utxos).to.be.an('array').with.lengthOf(3);

            utxos.forEach(utxo => ancTxs.addUtxo(utxo, false));

            expect(ccFundSrc.ancestorTxs.ancestorRefCounter).to.deep.equal(ancTxs.ancestorRefCounter, 'ancestor transactions reference counter not as expected');
        });

        it('the expected UTXOs should be returned when allocating fund of 24500 asset units', function () {
            ccFundSrc.clearAllocatedUtxos();
            const result = ccFundSrc.allocateFund(24500);

            expect(result).to.exist.and.to.include({changeAssetAmount: 1000}).and.to.have.property('utxos').that.is.a('array').with.lengthOf(5);
            expect(result.utxos[0]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 0, assetAmount: 7000
            });
            expect(result.utxos[1]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 1, assetAmount: 6500
            });
            expect(result.utxos[2]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373', vout: 0, assetAmount: 5000
            });
            expect(result.utxos[3]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: 'ad244897a99caa76a5698567dd5c43cb42384b530ac158a7d8cf0be5f9638443', vout: 0, assetAmount: 4000
            });
            expect(result.utxos[4]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: 'a34345f69e5beb3618dfca9a22326f6e978d5ec6ab5d5c57e685e6f812cd628d', vout: 0, assetAmount: 3000
            });

            const ancTxs = new AncestorTransactions({ancestorsCountLimit: 24});

            const utxos = ccFundSrc.collUtxo.find({txout: {$in: [
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:0',
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:1',
                        '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373:0',
                        'ad244897a99caa76a5698567dd5c43cb42384b530ac158a7d8cf0be5f9638443:0',
                        'a34345f69e5beb3618dfca9a22326f6e978d5ec6ab5d5c57e685e6f812cd628d:0'
                    ]}});

            expect(utxos).to.be.an('array').with.lengthOf(5);

            utxos.forEach(utxo => ancTxs.addUtxo(utxo, false));

            expect(ccFundSrc.ancestorTxs.ancestorRefCounter).to.deep.equal(ancTxs.ancestorRefCounter, 'ancestor transactions reference counter not as expected');
        });

        it('the expected UTXOs should be returned when allocating fund of 23700 asset units', function () {
            ccFundSrc.clearAllocatedUtxos();
            const result = ccFundSrc.allocateFund(23700);

            expect(result).to.exist.and.to.include({changeAssetAmount: 1800}).and.to.have.property('utxos').that.is.a('array').with.lengthOf(5);
            expect(result.utxos[0]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 0, assetAmount: 7000
            });
            expect(result.utxos[1]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 1, assetAmount: 6500
            });
            expect(result.utxos[2]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373', vout: 0, assetAmount: 5000
            });
            expect(result.utxos[3]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: 'ad244897a99caa76a5698567dd5c43cb42384b530ac158a7d8cf0be5f9638443', vout: 0, assetAmount: 4000
            });
            expect(result.utxos[4]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: 'a34345f69e5beb3618dfca9a22326f6e978d5ec6ab5d5c57e685e6f812cd628d', vout: 0, assetAmount: 3000
            });

            const ancTxs = new AncestorTransactions({ancestorsCountLimit: 24});

            const utxos = ccFundSrc.collUtxo.find({txout: {$in: [
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:0',
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:1',
                        '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373:0',
                        'ad244897a99caa76a5698567dd5c43cb42384b530ac158a7d8cf0be5f9638443:0',
                        'a34345f69e5beb3618dfca9a22326f6e978d5ec6ab5d5c57e685e6f812cd628d:0'
                    ]}});

            expect(utxos).to.be.an('array').with.lengthOf(5);

            utxos.forEach(utxo => ancTxs.addUtxo(utxo, false));

            expect(ccFundSrc.ancestorTxs.ancestorRefCounter).to.deep.equal(ancTxs.ancestorRefCounter, 'ancestor transactions reference counter not as expected');
        });

        it('the expected UTXOs should be returned when allocating fund of 28700 asset units', function () {
            ccFundSrc.clearAllocatedUtxos();
            const result = ccFundSrc.allocateFund(28700);

            expect(result).to.exist.and.to.include({changeAssetAmount: 0}).and.to.have.property('utxos').that.is.a('array').with.lengthOf(7);
            expect(result.utxos[0]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 0, assetAmount: 7000
            });
            expect(result.utxos[1]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 1, assetAmount: 6500
            });
            expect(result.utxos[2]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373', vout: 0, assetAmount: 5000
            });
            expect(result.utxos[3]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: 'ad244897a99caa76a5698567dd5c43cb42384b530ac158a7d8cf0be5f9638443', vout: 0, assetAmount: 4000
            });
            expect(result.utxos[4]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: 'a34345f69e5beb3618dfca9a22326f6e978d5ec6ab5d5c57e685e6f812cd628d', vout: 0, assetAmount: 3000
            });
            expect(result.utxos[5]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '7fa35e8cabf89a25324f7fa25f2f22f47850e97a3c3b05e875ba95c7ead80ad6', vout: 0, assetAmount: 2000
            });
            expect(result.utxos[6]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: 'cb5713d8dc0d5825c8bd2f391e6bd0a9f9c0d3164dd1d594959094e27d34d460', vout: 0, assetAmount: 1200
            });

            const ancTxs = new AncestorTransactions({ancestorsCountLimit: 24});

            const utxos = ccFundSrc.collUtxo.find({txout: {$in: [
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:0',
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:1',
                        '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373:0',
                        'ad244897a99caa76a5698567dd5c43cb42384b530ac158a7d8cf0be5f9638443:0',
                        'a34345f69e5beb3618dfca9a22326f6e978d5ec6ab5d5c57e685e6f812cd628d:0',
                        '7fa35e8cabf89a25324f7fa25f2f22f47850e97a3c3b05e875ba95c7ead80ad6:0',
                        'cb5713d8dc0d5825c8bd2f391e6bd0a9f9c0d3164dd1d594959094e27d34d460:0'
                    ]}});

            expect(utxos).to.be.an('array').with.lengthOf(7);

            utxos.forEach(utxo => ancTxs.addUtxo(utxo, false));

            expect(ccFundSrc.ancestorTxs.ancestorRefCounter).to.deep.equal(ancTxs.ancestorRefCounter, 'ancestor transactions reference counter not as expected');
        });
    });

    describe('instance including unconfirmed UTXOs (ancestorCountLimit = 4) and higher amount', function () {
        let ccFundSrc;

        before(function () {
            resetBitcoinCore(mempoolTestData1);
            BitcoinCore.initialize();
            resetC3NodeClient(utxosTestData1);
            C3NodeClient.initialize();

            ccFundSrc = new CCFundSource('La8KNZTWQJGEUYfzxSEugGwpDQRUE8JCMeRSXE', 'mrH6bWqKTyntpF9wi7mui4NYxo85frL9X6', {
                useUnconfirmedUtxo: true,
                unconfUtxoInfo: {
                    ancestorsCountDiff: 21
                },
                higherAmountUtxos: true
            });
        });

        it('ancestor count limit should be set as specified', function () {
            expect(ccFundSrc.ancestorsCountUpperLimit).to.equals(4);
        });

        it('confirmed balance should exclude any unconfirmed UTXOs', function () {
            const balance = ccFundSrc.getBalance(false);

            expect(balance).to.equals(13500);
        });

        it('unconfirmed balance should exclude some UTXOs (with high ancestor count)', function () {
            const balance = ccFundSrc.getBalance(true);

            expect(balance).to.equals(24700);
        });

        it('the expected UTXOs should be returned when allocating fund of 14000 asset units', function () {
            const result = ccFundSrc.allocateFund(14000);

            expect(result).to.exist.and.to.include({changeAssetAmount: 4500}).and.to.have.property('utxos').that.is.a('array').with.lengthOf(3);
            expect(result.utxos[0]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 0, assetAmount: 7000
            });
            expect(result.utxos[1]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 1, assetAmount: 6500
            });
            expect(result.utxos[2]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373', vout: 0, assetAmount: 5000
            });

            const ancTxs = new AncestorTransactions({ancestorsCountLimit: 4});

            const utxos = ccFundSrc.collUtxo.find({txout: {$in: [
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:0',
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:1',
                        '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373:0'
                    ]}});

            expect(utxos).to.be.an('array').with.lengthOf(3);

            utxos.forEach(utxo => ancTxs.addUtxo(utxo, false));

            expect(ccFundSrc.ancestorTxs.ancestorRefCounter).to.deep.equal(ancTxs.ancestorRefCounter, 'ancestor transactions reference counter not as expected');
        });

        it('the expected UTXOs should be returned when allocating fund of 15900 asset units', function () {
            ccFundSrc.clearAllocatedUtxos();
            const result = ccFundSrc.allocateFund(15900);

            expect(result).to.exist.and.to.include({changeAssetAmount: 2600}).and.to.have.property('utxos').that.is.a('array').with.lengthOf(3);
            expect(result.utxos[0]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 0, assetAmount: 7000
            });
            expect(result.utxos[1]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 1, assetAmount: 6500
            });
            expect(result.utxos[2]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373', vout: 0, assetAmount: 5000
            });

            const ancTxs = new AncestorTransactions({ancestorsCountLimit: 4});

            const utxos = ccFundSrc.collUtxo.find({txout: {$in: [
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:0',
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:1',
                        '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373:0'
                    ]}});

            expect(utxos).to.be.an('array').with.lengthOf(3);

            utxos.forEach(utxo => ancTxs.addUtxo(utxo, false));

            expect(ccFundSrc.ancestorTxs.ancestorRefCounter).to.deep.equal(ancTxs.ancestorRefCounter, 'ancestor transactions reference counter not as expected');
        });

        it('the expected UTXOs should be returned when allocating fund of 16000 asset units', function () {
            ccFundSrc.clearAllocatedUtxos();
            const result = ccFundSrc.allocateFund(16000);

            expect(result).to.exist.and.to.include({changeAssetAmount: 2500}).and.to.have.property('utxos').that.is.a('array').with.lengthOf(3);
            expect(result.utxos[0]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 0, assetAmount: 7000
            });
            expect(result.utxos[1]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 1, assetAmount: 6500
            });
            expect(result.utxos[2]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373', vout: 0, assetAmount: 5000
            });

            const ancTxs = new AncestorTransactions({ancestorsCountLimit: 4});

            const utxos = ccFundSrc.collUtxo.find({txout: {$in: [
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:0',
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:1',
                        '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373:0'
                    ]}});

            expect(utxos).to.be.an('array').with.lengthOf(3);

            utxos.forEach(utxo => ancTxs.addUtxo(utxo, false));

            expect(ccFundSrc.ancestorTxs.ancestorRefCounter).to.deep.equal(ancTxs.ancestorRefCounter, 'ancestor transactions reference counter not as expected');
        });

        it('the expected UTXOs should be returned when allocating fund of 24500 asset units', function () {
            ccFundSrc.clearAllocatedUtxos();
            const result = ccFundSrc.allocateFund(24500);

            expect(result).to.exist.and.to.include({changeAssetAmount: 200}).and.to.have.property('utxos').that.is.a('array').with.lengthOf(6);
            expect(result.utxos[0]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 0, assetAmount: 7000
            });
            expect(result.utxos[1]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 1, assetAmount: 6500
            });
            expect(result.utxos[2]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373', vout: 0, assetAmount: 5000
            });
            expect(result.utxos[3]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: 'a34345f69e5beb3618dfca9a22326f6e978d5ec6ab5d5c57e685e6f812cd628d', vout: 0, assetAmount: 3000
            });
            expect(result.utxos[4]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '7fa35e8cabf89a25324f7fa25f2f22f47850e97a3c3b05e875ba95c7ead80ad6', vout: 0, assetAmount: 2000
            });
            expect(result.utxos[5]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: 'cb5713d8dc0d5825c8bd2f391e6bd0a9f9c0d3164dd1d594959094e27d34d460', vout: 0, assetAmount: 1200
            });

            const ancTxs = new AncestorTransactions({ancestorsCountLimit: 4});

            const utxos = ccFundSrc.collUtxo.find({txout: {$in: [
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:0',
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:1',
                        '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373:0',
                        'a34345f69e5beb3618dfca9a22326f6e978d5ec6ab5d5c57e685e6f812cd628d:0',
                        '7fa35e8cabf89a25324f7fa25f2f22f47850e97a3c3b05e875ba95c7ead80ad6:0',
                        'cb5713d8dc0d5825c8bd2f391e6bd0a9f9c0d3164dd1d594959094e27d34d460:0'
                    ]}});

            expect(utxos).to.be.an('array').with.lengthOf(6);

            utxos.forEach(utxo => ancTxs.addUtxo(utxo, false));

            expect(ccFundSrc.ancestorTxs.ancestorRefCounter).to.deep.equal(ancTxs.ancestorRefCounter, 'ancestor transactions reference counter not as expected');
        });

        it('the expected UTXOs should be returned when allocating fund of 23700 asset units', function () {
            ccFundSrc.clearAllocatedUtxos();
            const result = ccFundSrc.allocateFund(23700);

            expect(result).to.exist.and.to.include({changeAssetAmount: 1000}).and.to.have.property('utxos').that.is.a('array').with.lengthOf(6);
            expect(result.utxos[0]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 0, assetAmount: 7000
            });
            expect(result.utxos[1]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 1, assetAmount: 6500
            });
            expect(result.utxos[2]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373', vout: 0, assetAmount: 5000
            });
            expect(result.utxos[3]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: 'a34345f69e5beb3618dfca9a22326f6e978d5ec6ab5d5c57e685e6f812cd628d', vout: 0, assetAmount: 3000
            });
            expect(result.utxos[4]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '7fa35e8cabf89a25324f7fa25f2f22f47850e97a3c3b05e875ba95c7ead80ad6', vout: 0, assetAmount: 2000
            });
            expect(result.utxos[5]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: 'cb5713d8dc0d5825c8bd2f391e6bd0a9f9c0d3164dd1d594959094e27d34d460', vout: 0, assetAmount: 1200
            });

            const ancTxs = new AncestorTransactions({ancestorsCountLimit: 4});

            const utxos = ccFundSrc.collUtxo.find({txout: {$in: [
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:0',
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:1',
                        '3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373:0',
                        'a34345f69e5beb3618dfca9a22326f6e978d5ec6ab5d5c57e685e6f812cd628d:0',
                        '7fa35e8cabf89a25324f7fa25f2f22f47850e97a3c3b05e875ba95c7ead80ad6:0',
                        'cb5713d8dc0d5825c8bd2f391e6bd0a9f9c0d3164dd1d594959094e27d34d460:0'
                    ]}});

            expect(utxos).to.be.an('array').with.lengthOf(6);

            utxos.forEach(utxo => ancTxs.addUtxo(utxo, false));

            expect(ccFundSrc.ancestorTxs.ancestorRefCounter).to.deep.equal(ancTxs.ancestorRefCounter, 'ancestor transactions reference counter not as expected');
        });

        it('the expected UTXOs should be returned when allocating fund of 28700 asset units', function () {
            ccFundSrc.clearAllocatedUtxos();
            const result = ccFundSrc.allocateFund(28700);

            expect(result).to.be.null;

            const ancTxs = new AncestorTransactions({ancestorsCountLimit: 4});

            expect(ccFundSrc.ancestorTxs.ancestorRefCounter).to.deep.equal(ancTxs.ancestorRefCounter, 'ancestor transactions reference counter not as expected');
        });
    });

    describe('instance including unconfirmed UTXOs (ancestorCountLimit = 3)', function () {
        let ccFundSrc;

        before(function () {
            resetBitcoinCore(mempoolTestData1);
            BitcoinCore.initialize();
            resetC3NodeClient(utxosTestData1);
            C3NodeClient.initialize();

            ccFundSrc = new CCFundSource('La8KNZTWQJGEUYfzxSEugGwpDQRUE8JCMeRSXE', 'mrH6bWqKTyntpF9wi7mui4NYxo85frL9X6', {
                useUnconfirmedUtxo: true,
                unconfUtxoInfo: {
                    ancestorsCountDiff: 22
                }
            });
        });

        it('ancestor count limit should be set as specified', function () {
            expect(ccFundSrc.ancestorsCountUpperLimit).to.equals(3);
        });

        it('confirmed balance should exclude any unconfirmed UTXOs', function () {
            const balance = ccFundSrc.getBalance(false);

            expect(balance).to.equals(13500);
        });

        it('unconfirmed balance should exclude some UTXOs (with high ancestor count)', function () {
            const balance = ccFundSrc.getBalance(true);

            expect(balance).to.equals(21700);
        });

        it('the expected UTXOs should be returned when allocating fund of 14000 asset units', function () {
            const result = ccFundSrc.allocateFund(14000);

            expect(result).to.exist.and.to.include({changeAssetAmount: 0}).and.to.have.property('utxos').that.is.a('array').with.lengthOf(3);
            expect(result.utxos[0]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 0, assetAmount: 7000
            });
            expect(result.utxos[1]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: 'ad244897a99caa76a5698567dd5c43cb42384b530ac158a7d8cf0be5f9638443', vout: 0, assetAmount: 4000
            });
            expect(result.utxos[2]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: 'a34345f69e5beb3618dfca9a22326f6e978d5ec6ab5d5c57e685e6f812cd628d', vout: 0, assetAmount: 3000
            });

            const ancTxs = new AncestorTransactions({ancestorsCountLimit: 4});

            const utxos = ccFundSrc.collUtxo.find({txout: {$in: [
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:0',
                        'ad244897a99caa76a5698567dd5c43cb42384b530ac158a7d8cf0be5f9638443:0',
                        'a34345f69e5beb3618dfca9a22326f6e978d5ec6ab5d5c57e685e6f812cd628d:0'
                    ]}});

            expect(utxos).to.be.an('array').with.lengthOf(3);

            utxos.forEach(utxo => ancTxs.addUtxo(utxo, false));

            expect(ccFundSrc.ancestorTxs.ancestorRefCounter).to.deep.equal(ancTxs.ancestorRefCounter, 'ancestor transactions reference counter not as expected');
        });

        it('the expected UTXOs should be returned when allocating fund of 15900 asset units', function () {
            ccFundSrc.clearAllocatedUtxos();
            const result = ccFundSrc.allocateFund(15900);

            expect(result).to.exist.and.to.include({changeAssetAmount: 1600}).and.to.have.property('utxos').that.is.a('array').with.lengthOf(3);
            expect(result.utxos[0]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 0, assetAmount: 7000
            });
            expect(result.utxos[1]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 1, assetAmount: 6500
            });
            expect(result.utxos[2]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: 'ad244897a99caa76a5698567dd5c43cb42384b530ac158a7d8cf0be5f9638443', vout: 0, assetAmount: 4000
            });

            const ancTxs = new AncestorTransactions({ancestorsCountLimit: 4});

            const utxos = ccFundSrc.collUtxo.find({txout: {$in: [
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:0',
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:1',
                        'ad244897a99caa76a5698567dd5c43cb42384b530ac158a7d8cf0be5f9638443:0'
                    ]}});

            expect(utxos).to.be.an('array').with.lengthOf(3);

            utxos.forEach(utxo => ancTxs.addUtxo(utxo, false));

            expect(ccFundSrc.ancestorTxs.ancestorRefCounter).to.deep.equal(ancTxs.ancestorRefCounter, 'ancestor transactions reference counter not as expected');
        });

        it('the expected UTXOs should be returned when allocating fund of 16000 asset units', function () {
            ccFundSrc.clearAllocatedUtxos();
            const result = ccFundSrc.allocateFund(16000);

            expect(result).to.exist.and.to.include({changeAssetAmount: 1500}).and.to.have.property('utxos').that.is.a('array').with.lengthOf(3);
            expect(result.utxos[0]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 0, assetAmount: 7000
            });
            expect(result.utxos[1]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 1, assetAmount: 6500
            });
            expect(result.utxos[2]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: 'ad244897a99caa76a5698567dd5c43cb42384b530ac158a7d8cf0be5f9638443', vout: 0, assetAmount: 4000
            });

            const ancTxs = new AncestorTransactions({ancestorsCountLimit: 4});

            const utxos = ccFundSrc.collUtxo.find({txout: {$in: [
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:0',
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:1',
                        'ad244897a99caa76a5698567dd5c43cb42384b530ac158a7d8cf0be5f9638443:0'
                    ]}});

            expect(utxos).to.be.an('array').with.lengthOf(3);

            utxos.forEach(utxo => ancTxs.addUtxo(utxo, false));

            expect(ccFundSrc.ancestorTxs.ancestorRefCounter).to.deep.equal(ancTxs.ancestorRefCounter, 'ancestor transactions reference counter not as expected');
        });

        it('the expected UTXOs should be returned when allocating fund of 20700 asset units', function () {
            ccFundSrc.clearAllocatedUtxos();
            const result = ccFundSrc.allocateFund(20700);

            expect(result).to.exist.and.to.include({changeAssetAmount: 1000}).and.to.have.property('utxos').that.is.a('array').with.lengthOf(5);
            expect(result.utxos[0]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 0, assetAmount: 7000
            });
            expect(result.utxos[1]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 1, assetAmount: 6500
            });
            expect(result.utxos[2]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: 'ad244897a99caa76a5698567dd5c43cb42384b530ac158a7d8cf0be5f9638443', vout: 0, assetAmount: 4000
            });
            expect(result.utxos[3]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: 'a34345f69e5beb3618dfca9a22326f6e978d5ec6ab5d5c57e685e6f812cd628d', vout: 0, assetAmount: 3000
            });
            expect(result.utxos[4]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: 'cb5713d8dc0d5825c8bd2f391e6bd0a9f9c0d3164dd1d594959094e27d34d460', vout: 0, assetAmount: 1200
            });

            const ancTxs = new AncestorTransactions({ancestorsCountLimit: 4});

            const utxos = ccFundSrc.collUtxo.find({txout: {$in: [
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:0',
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:1',
                        'ad244897a99caa76a5698567dd5c43cb42384b530ac158a7d8cf0be5f9638443:0',
                        'a34345f69e5beb3618dfca9a22326f6e978d5ec6ab5d5c57e685e6f812cd628d:0',
                        'cb5713d8dc0d5825c8bd2f391e6bd0a9f9c0d3164dd1d594959094e27d34d460:0'
                    ]}});

            expect(utxos).to.be.an('array').with.lengthOf(5);

            utxos.forEach(utxo => ancTxs.addUtxo(utxo, false));

            expect(ccFundSrc.ancestorTxs.ancestorRefCounter).to.deep.equal(ancTxs.ancestorRefCounter, 'ancestor transactions reference counter not as expected');
        });

        it('the expected UTXOs should be returned when allocating fund of 23700 asset units', function () {
            ccFundSrc.clearAllocatedUtxos();
            const result = ccFundSrc.allocateFund(21700);

            expect(result).to.exist.and.to.include({changeAssetAmount: 0}).and.to.have.property('utxos').that.is.a('array').with.lengthOf(5);
            expect(result.utxos[0]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 0, assetAmount: 7000
            });
            expect(result.utxos[1]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682', vout: 1, assetAmount: 6500
            });
            expect(result.utxos[2]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: 'ad244897a99caa76a5698567dd5c43cb42384b530ac158a7d8cf0be5f9638443', vout: 0, assetAmount: 4000
            });
            expect(result.utxos[3]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: 'a34345f69e5beb3618dfca9a22326f6e978d5ec6ab5d5c57e685e6f812cd628d', vout: 0, assetAmount: 3000
            });
            expect(result.utxos[4]).to.have.property('txout').that.is.an('object').and.deep.include({
                txid: 'cb5713d8dc0d5825c8bd2f391e6bd0a9f9c0d3164dd1d594959094e27d34d460', vout: 0, assetAmount: 1200
            });

            const ancTxs = new AncestorTransactions({ancestorsCountLimit: 4});

            const utxos = ccFundSrc.collUtxo.find({txout: {$in: [
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:0',
                        '579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682:1',
                        'ad244897a99caa76a5698567dd5c43cb42384b530ac158a7d8cf0be5f9638443:0',
                        'a34345f69e5beb3618dfca9a22326f6e978d5ec6ab5d5c57e685e6f812cd628d:0',
                        'cb5713d8dc0d5825c8bd2f391e6bd0a9f9c0d3164dd1d594959094e27d34d460:0'
                    ]}});

            expect(utxos).to.be.an('array').with.lengthOf(5);

            utxos.forEach(utxo => ancTxs.addUtxo(utxo, false));

            expect(ccFundSrc.ancestorTxs.ancestorRefCounter).to.deep.equal(ancTxs.ancestorRefCounter, 'ancestor transactions reference counter not as expected');
        });

        it('the expected UTXOs should be returned when allocating fund of 28700 asset units', function () {
            ccFundSrc.clearAllocatedUtxos();
            const result = ccFundSrc.allocateFund(28700);

            expect(result).to.be.null;

            const ancTxs = new AncestorTransactions({ancestorsCountLimit: 4});

            expect(ccFundSrc.ancestorTxs.ancestorRefCounter).to.deep.equal(ancTxs.ancestorRefCounter, 'ancestor transactions reference counter not as expected');
        });
    });

    describe('Try to retrieve non-fungible asset', function () {
        before(function () {
            resetC3NodeClient(utxosTestData3);
            C3NodeClient.initialize();
        });

        it ('should fail trying to retrieve non-fungible asset (UTXO with single non-fungible token)', function () {
            expect(() => {
                const ccFundSrc = new CCFundSource('LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v', 'bcrt1q0zxcuyjwx6fa8g7j0dhxe7judv7l7986rtp8r6', {
                    useUnconfirmedUtxo: false
                });
            })
            .to.throw('Unable to retrieve Colored Coins asset info for UTXO; non-fungible assets are not supported');
        });

        it ('should fail trying to retrieve non-fungible asset (UTXO with multiple non-fungible tokens)', function () {
            expect(() => {
                const ccFundSrc = new CCFundSource('Un4zg8Ku1CQvPca9y6wJSPWdV2xkM5BWCnppoD', 'bcrt1qxpd89mf77l3q43ajmwwcxms2smc4uyqh3xpknm', {
                    useUnconfirmedUtxo: false
                });
            })
            .to.throw('Unable to retrieve Colored Coins asset info for UTXO; non-fungible assets are not supported');
        });
    });
});

// Only confirmed UTXOs
const utxosTestData0 = [
    // Fabricated UTXO entries
    //
    {
        "txid": "579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682",
        "vout": 0,
        "address": "mrH6bWqKTyntpF9wi7mui4NYxo85frL9X6",
        "account": "",
        "scriptPubKey": "76a914d47bedbbd448fdaa61c4ecd250866f5c6be8980088ac",
        "amount": 0.00000600,
        "confirmations": 10,
        "spendable": false,
        "solvable": true,
        "desc": "pkh([492a6fca]0370577560dddf474a8626d9e367a04129d7803572dae7b96758c02b6325d2ea93)#sjdgl7zx",
        "safe": true,
        "assets": [{
            assetId: 'La8KNZTWQJGEUYfzxSEugGwpDQRUE8JCMeRSXE',
            amount: 7000,
            divisibility: 0,
            aggregationPolicy: CCTransaction.aggregationPolicy.aggregatable
        }]
    },
    {
        "txid": "579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682",
        "vout": 1,
        "address": "mrH6bWqKTyntpF9wi7mui4NYxo85frL9X6",
        "account": "",
        "scriptPubKey": "76a914d47bedbbd448fdaa61c4ecd250866f5c6be8980088ac",
        "amount": 0.00000600,
        "confirmations": 50,
        "spendable": false,
        "solvable": true,
        "desc": "pkh([492a6fca]0370577560dddf474a8626d9e367a04129d7803572dae7b96758c02b6325d2ea93)#sjdgl7zx",
        "safe": true,
        "assets": [{
            assetId: 'La8KNZTWQJGEUYfzxSEugGwpDQRUE8JCMeRSXE',
            amount: 6500,
            divisibility: 0,
            aggregationPolicy: CCTransaction.aggregationPolicy.aggregatable
        }]
    },
    {
        "txid": "3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373",
        "vout": 0,
        "address": "mrH6bWqKTyntpF9wi7mui4NYxo85frL9X6",
        "account": "",
        "scriptPubKey": "76a914d47bedbbd448fdaa61c4ecd250866f5c6be8980088ac",
        "amount": 0.00000600,
        "confirmations": 1,
        "spendable": false,
        "solvable": true,
        "desc": "pkh([492a6fca]0370577560dddf474a8626d9e367a04129d7803572dae7b96758c02b6325d2ea93)#sjdgl7zx",
        "safe": true,
        "assets": [{
            assetId: 'La8KNZTWQJGEUYfzxSEugGwpDQRUE8JCMeRSXE',
            amount: 5000,
            divisibility: 0,
            aggregationPolicy: CCTransaction.aggregationPolicy.aggregatable
        }]
    },
    {
        "txid": "ad244897a99caa76a5698567dd5c43cb42384b530ac158a7d8cf0be5f9638443",
        "vout": 0,
        "address": "mrH6bWqKTyntpF9wi7mui4NYxo85frL9X6",
        "account": "",
        "scriptPubKey": "76a914d47bedbbd448fdaa61c4ecd250866f5c6be8980088ac",
        "amount": 0.00000600,
        "confirmations": 1,
        "spendable": false,
        "solvable": true,
        "desc": "pkh([492a6fca]0370577560dddf474a8626d9e367a04129d7803572dae7b96758c02b6325d2ea93)#sjdgl7zx",
        "safe": true,
        "assets": [{
            assetId: 'La8KNZTWQJGEUYfzxSEugGwpDQRUE8JCMeRSXE',
            amount: 4000,
            divisibility: 0,
            aggregationPolicy: CCTransaction.aggregationPolicy.aggregatable
        }]
    },
    {
        "txid": "a34345f69e5beb3618dfca9a22326f6e978d5ec6ab5d5c57e685e6f812cd628d",
        "vout": 0,
        "address": "mrH6bWqKTyntpF9wi7mui4NYxo85frL9X6",
        "account": "",
        "scriptPubKey": "76a914d47bedbbd448fdaa61c4ecd250866f5c6be8980088ac",
        "amount": 0.00000600,
        "confirmations": 1,
        "spendable": false,
        "solvable": true,
        "desc": "pkh([492a6fca]0370577560dddf474a8626d9e367a04129d7803572dae7b96758c02b6325d2ea93)#sjdgl7zx",
        "safe": true,
        "assets": [{
            assetId: 'La8KNZTWQJGEUYfzxSEugGwpDQRUE8JCMeRSXE',
            amount: 3000,
            divisibility: 0,
            aggregationPolicy: CCTransaction.aggregationPolicy.aggregatable
        }]
    },
    {
        "txid": "7fa35e8cabf89a25324f7fa25f2f22f47850e97a3c3b05e875ba95c7ead80ad6",
        "vout": 0,
        "address": "mrH6bWqKTyntpF9wi7mui4NYxo85frL9X6",
        "account": "",
        "scriptPubKey": "76a914d47bedbbd448fdaa61c4ecd250866f5c6be8980088ac",
        "amount": 0.00000600,
        "confirmations": 1,
        "spendable": false,
        "solvable": true,
        "desc": "pkh([492a6fca]0370577560dddf474a8626d9e367a04129d7803572dae7b96758c02b6325d2ea93)#sjdgl7zx",
        "safe": true,
        "assets": [{
            assetId: 'La8KNZTWQJGEUYfzxSEugGwpDQRUE8JCMeRSXE',
            amount: 2000,
            divisibility: 0,
            aggregationPolicy: CCTransaction.aggregationPolicy.aggregatable
        }]
    },
    {
        "txid": "cb5713d8dc0d5825c8bd2f391e6bd0a9f9c0d3164dd1d594959094e27d34d460",
        "vout": 0,
        "address": "mrH6bWqKTyntpF9wi7mui4NYxo85frL9X6",
        "account": "",
        "scriptPubKey": "76a914d47bedbbd448fdaa61c4ecd250866f5c6be8980088ac",
        "amount": 0.00000600,
        "confirmations": 1,
        "spendable": false,
        "solvable": true,
        "desc": "pkh([492a6fca]0370577560dddf474a8626d9e367a04129d7803572dae7b96758c02b6325d2ea93)#sjdgl7zx",
        "safe": true,
        "assets": [{
            assetId: 'La8KNZTWQJGEUYfzxSEugGwpDQRUE8JCMeRSXE',
            amount: 1200,
            divisibility: 0,
            aggregationPolicy: CCTransaction.aggregationPolicy.aggregatable
        }]
    }
];

const utxosTestData1 = [
    // Fabricated UTXO entries
    //
    {
        "txid": "579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682",
        "vout": 0,
        "address": "mrH6bWqKTyntpF9wi7mui4NYxo85frL9X6",
        "account": "",
        "scriptPubKey": "76a914d47bedbbd448fdaa61c4ecd250866f5c6be8980088ac",
        "amount": 0.00000600,
        "confirmations": 10,
        "spendable": false,
        "solvable": true,
        "desc": "pkh([492a6fca]0370577560dddf474a8626d9e367a04129d7803572dae7b96758c02b6325d2ea93)#sjdgl7zx",
        "safe": true,
        "assets": [{
            assetId: 'La8KNZTWQJGEUYfzxSEugGwpDQRUE8JCMeRSXE',
            amount: 7000,
            divisibility: 0,
            aggregationPolicy: CCTransaction.aggregationPolicy.aggregatable
        }]
    },
    {
        "txid": "579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682",
        "vout": 1,
        "address": "mrH6bWqKTyntpF9wi7mui4NYxo85frL9X6",
        "account": "",
        "scriptPubKey": "76a914d47bedbbd448fdaa61c4ecd250866f5c6be8980088ac",
        "amount": 0.00000600,
        "confirmations": 50,
        "spendable": false,
        "solvable": true,
        "desc": "pkh([492a6fca]0370577560dddf474a8626d9e367a04129d7803572dae7b96758c02b6325d2ea93)#sjdgl7zx",
        "safe": true,
        "assets": [{
            assetId: 'La8KNZTWQJGEUYfzxSEugGwpDQRUE8JCMeRSXE',
            amount: 6500,
            divisibility: 0,
            aggregationPolicy: CCTransaction.aggregationPolicy.aggregatable
        }]
    },

    // Fabricated unconfirmed UTXO entries
    //
    {
        "txid": "3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373",
        "vout": 0,
        "address": "mrH6bWqKTyntpF9wi7mui4NYxo85frL9X6",
        "account": "",
        "scriptPubKey": "76a914d47bedbbd448fdaa61c4ecd250866f5c6be8980088ac",
        "amount": 0.00000600,
        "confirmations": 0,
        "spendable": false,
        "solvable": true,
        "desc": "pkh([492a6fca]0370577560dddf474a8626d9e367a04129d7803572dae7b96758c02b6325d2ea93)#sjdgl7zx",
        "safe": true,
        "assets": [{
            assetId: 'La8KNZTWQJGEUYfzxSEugGwpDQRUE8JCMeRSXE',
            amount: 5000,
            divisibility: 0,
            aggregationPolicy: CCTransaction.aggregationPolicy.aggregatable
        }]
    },
    {
        "txid": "ad244897a99caa76a5698567dd5c43cb42384b530ac158a7d8cf0be5f9638443",
        "vout": 0,
        "address": "mrH6bWqKTyntpF9wi7mui4NYxo85frL9X6",
        "account": "",
        "scriptPubKey": "76a914d47bedbbd448fdaa61c4ecd250866f5c6be8980088ac",
        "amount": 0.00000600,
        "confirmations": 0,
        "spendable": false,
        "solvable": true,
        "desc": "pkh([492a6fca]0370577560dddf474a8626d9e367a04129d7803572dae7b96758c02b6325d2ea93)#sjdgl7zx",
        "safe": true,
        "assets": [{
            assetId: 'La8KNZTWQJGEUYfzxSEugGwpDQRUE8JCMeRSXE',
            amount: 4000,
            divisibility: 0,
            aggregationPolicy: CCTransaction.aggregationPolicy.aggregatable
        }]
    },
    {
        "txid": "a34345f69e5beb3618dfca9a22326f6e978d5ec6ab5d5c57e685e6f812cd628d",
        "vout": 0,
        "address": "mrH6bWqKTyntpF9wi7mui4NYxo85frL9X6",
        "account": "",
        "scriptPubKey": "76a914d47bedbbd448fdaa61c4ecd250866f5c6be8980088ac",
        "amount": 0.00000600,
        "confirmations": 0,
        "spendable": false,
        "solvable": true,
        "desc": "pkh([492a6fca]0370577560dddf474a8626d9e367a04129d7803572dae7b96758c02b6325d2ea93)#sjdgl7zx",
        "safe": true,
        "assets": [{
            assetId: 'La8KNZTWQJGEUYfzxSEugGwpDQRUE8JCMeRSXE',
            amount: 3000,
            divisibility: 0,
            aggregationPolicy: CCTransaction.aggregationPolicy.aggregatable
        }]
    },
    {
        "txid": "7fa35e8cabf89a25324f7fa25f2f22f47850e97a3c3b05e875ba95c7ead80ad6",
        "vout": 0,
        "address": "mrH6bWqKTyntpF9wi7mui4NYxo85frL9X6",
        "account": "",
        "scriptPubKey": "76a914d47bedbbd448fdaa61c4ecd250866f5c6be8980088ac",
        "amount": 0.00000600,
        "confirmations": 0,
        "spendable": false,
        "solvable": true,
        "desc": "pkh([492a6fca]0370577560dddf474a8626d9e367a04129d7803572dae7b96758c02b6325d2ea93)#sjdgl7zx",
        "safe": true,
        "assets": [{
            assetId: 'La8KNZTWQJGEUYfzxSEugGwpDQRUE8JCMeRSXE',
            amount: 2000,
            divisibility: 0,
            aggregationPolicy: CCTransaction.aggregationPolicy.aggregatable
        }]
    },
    {
        "txid": "cb5713d8dc0d5825c8bd2f391e6bd0a9f9c0d3164dd1d594959094e27d34d460",
        "vout": 0,
        "address": "mrH6bWqKTyntpF9wi7mui4NYxo85frL9X6",
        "account": "",
        "scriptPubKey": "76a914d47bedbbd448fdaa61c4ecd250866f5c6be8980088ac",
        "amount": 0.00000600,
        "confirmations": 0,
        "spendable": false,
        "solvable": true,
        "desc": "pkh([492a6fca]0370577560dddf474a8626d9e367a04129d7803572dae7b96758c02b6325d2ea93)#sjdgl7zx",
        "safe": true,
        "assets": [{
            assetId: 'La8KNZTWQJGEUYfzxSEugGwpDQRUE8JCMeRSXE',
            amount: 1200,
            divisibility: 0,
            aggregationPolicy: CCTransaction.aggregationPolicy.aggregatable
        }]
    }
];

// Reduced set, only confirmed
const utxosTestData2 = [
    // Fabricated UTXO entries
    //
    {
        "txid": "579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682",
        "vout": 0,
        "address": "mrH6bWqKTyntpF9wi7mui4NYxo85frL9X6",
        "account": "",
        "scriptPubKey": "76a914d47bedbbd448fdaa61c4ecd250866f5c6be8980088ac",
        "amount": 0.00000600,
        "confirmations": 10,
        "spendable": false,
        "solvable": true,
        "desc": "pkh([492a6fca]0370577560dddf474a8626d9e367a04129d7803572dae7b96758c02b6325d2ea93)#sjdgl7zx",
        "safe": true,
        "assets": [{
            assetId: 'La8KNZTWQJGEUYfzxSEugGwpDQRUE8JCMeRSXE',
            amount: 7000,
            divisibility: 0,
            aggregationPolicy: CCTransaction.aggregationPolicy.aggregatable
        }]
    },
    {
        "txid": "579c4d89751dc8880f389056a6990274dc6b7c60e8143a7d118a6370b6366682",
        "vout": 1,
        "address": "mrH6bWqKTyntpF9wi7mui4NYxo85frL9X6",
        "account": "",
        "scriptPubKey": "76a914d47bedbbd448fdaa61c4ecd250866f5c6be8980088ac",
        "amount": 0.00000600,
        "confirmations": 50,
        "spendable": false,
        "solvable": true,
        "desc": "pkh([492a6fca]0370577560dddf474a8626d9e367a04129d7803572dae7b96758c02b6325d2ea93)#sjdgl7zx",
        "safe": true,
        "assets": [{
            assetId: 'La8KNZTWQJGEUYfzxSEugGwpDQRUE8JCMeRSXE',
            amount: 6500,
            divisibility: 0,
            aggregationPolicy: CCTransaction.aggregationPolicy.aggregatable
        }]
    }
];

// Non-fungible assets
const utxosTestData3 = [
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
    }
];

// Empty memory pool
const mempoolTestData0 = {};

const mempoolTestData1 = {
    "a34345f69e5beb3618dfca9a22326f6e978d5ec6ab5d5c57e685e6f812cd628d": {
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
        "wtxid": "a34345f69e5beb3618dfca9a22326f6e978d5ec6ab5d5c57e685e6f812cd628d",
        "depends": [
        ]
    },
    "cb5713d8dc0d5825c8bd2f391e6bd0a9f9c0d3164dd1d594959094e27d34d460": {
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
        "wtxid": "cb5713d8dc0d5825c8bd2f391e6bd0a9f9c0d3164dd1d594959094e27d34d460",
        "depends": [
            "a34345f69e5beb3618dfca9a22326f6e978d5ec6ab5d5c57e685e6f812cd628d"
        ]
    },
    "7fa35e8cabf89a25324f7fa25f2f22f47850e97a3c3b05e875ba95c7ead80ad6": {
        "vsize": 509,
        "weight": 2036,
        "fee": 0.00010000,
        "modifiedfee": 0.00010000,
        "time": 1557441095,
        "height": 101,
        "descendantcount": 2,
        "descendantsize": 983,
        "descendantfees": 20000,
        "ancestorcount": 2,
        "ancestorsize": 1006,
        "ancestorfees": 20000,
        "wtxid": "7fa35e8cabf89a25324f7fa25f2f22f47850e97a3c3b05e875ba95c7ead80ad6",
        "depends": [
            "a34345f69e5beb3618dfca9a22326f6e978d5ec6ab5d5c57e685e6f812cd628d"
        ]
    },
    "3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373": {
        "vsize": 474,
        "weight": 1996,
        "fee": 0.00010000,
        "modifiedfee": 0.00010000,
        "time": 1557500764,
        "height": 101,
        "descendantcount": 1,
        "descendantsize": 474,
        "descendantfees": 10000,
        "ancestorcount": 4,
        "ancestorsize": 1841,
        "ancestorfees": 40000,
        "wtxid": "3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373",
        "depends": [
            "7fa35e8cabf89a25324f7fa25f2f22f47850e97a3c3b05e875ba95c7ead80ad6",
            "cb5713d8dc0d5825c8bd2f391e6bd0a9f9c0d3164dd1d594959094e27d34d460"
        ]
    },
    "ad244897a99caa76a5698567dd5c43cb42384b530ac158a7d8cf0be5f9638443": {
        "vsize": 475,
        "weight": 1900,
        "fee": 0.00010000,
        "modifiedfee": 0.00010000,
        "time": 1557501112,
        "height": 101,
        "descendantcount": 1,
        "descendantsize": 475,
        "descendantfees": 10000,
        "ancestorcount": 3,
        "ancestorsize": 1333,
        "ancestorfees": 30000,
        "wtxid": "ad244897a99caa76a5698567dd5c43cb42384b530ac158a7d8cf0be5f9638443",
        "depends": [
            "a34345f69e5beb3618dfca9a22326f6e978d5ec6ab5d5c57e685e6f812cd628d",
            "cb5713d8dc0d5825c8bd2f391e6bd0a9f9c0d3164dd1d594959094e27d34d460"
        ]
    }
};

// Simulate that two UTXO are not in the memory pool anymore
const mempoolTestData2 = {
    "a34345f69e5beb3618dfca9a22326f6e978d5ec6ab5d5c57e685e6f812cd628d": {
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
        "wtxid": "a34345f69e5beb3618dfca9a22326f6e978d5ec6ab5d5c57e685e6f812cd628d",
        "depends": [
        ]
    },
    "7fa35e8cabf89a25324f7fa25f2f22f47850e97a3c3b05e875ba95c7ead80ad6": {
        "vsize": 509,
        "weight": 2036,
        "fee": 0.00010000,
        "modifiedfee": 0.00010000,
        "time": 1557441095,
        "height": 101,
        "descendantcount": 2,
        "descendantsize": 983,
        "descendantfees": 20000,
        "ancestorcount": 2,
        "ancestorsize": 1006,
        "ancestorfees": 20000,
        "wtxid": "7fa35e8cabf89a25324f7fa25f2f22f47850e97a3c3b05e875ba95c7ead80ad6",
        "depends": [
            "a34345f69e5beb3618dfca9a22326f6e978d5ec6ab5d5c57e685e6f812cd628d"
        ]
    },
    "ad244897a99caa76a5698567dd5c43cb42384b530ac158a7d8cf0be5f9638443": {
        "vsize": 475,
        "weight": 1900,
        "fee": 0.00010000,
        "modifiedfee": 0.00010000,
        "time": 1557501112,
        "height": 101,
        "descendantcount": 1,
        "descendantsize": 475,
        "descendantfees": 10000,
        "ancestorcount": 3,
        "ancestorsize": 1333,
        "ancestorfees": 30000,
        "wtxid": "ad244897a99caa76a5698567dd5c43cb42384b530ac158a7d8cf0be5f9638443",
        "depends": [
            "a34345f69e5beb3618dfca9a22326f6e978d5ec6ab5d5c57e685e6f812cd628d",
            "cb5713d8dc0d5825c8bd2f391e6bd0a9f9c0d3164dd1d594959094e27d34d460"
        ]
    }
};

// Simulate unconfirmed additional UTXOs
const mempoolTestData3 = {
    "3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373": {
        "vsize": 474,
        "weight": 1896,
        "fee": 0.00010000,
        "modifiedfee": 0.00010000,
        "time": 1557500764,
        "height": 101,
        "descendantcount": 1,
        "descendantsize": 474,
        "descendantfees": 10000,
        "ancestorcount": 4,
        "ancestorsize": 1841,
        "ancestorfees": 40000,
        "wtxid": "3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373",
        "depends": [
        ]
    },
    "ad244897a99caa76a5698567dd5c43cb42384b530ac158a7d8cf0be5f9638443": {
        "vsize": 475,
        "weight": 1900,
        "fee": 0.00010000,
        "modifiedfee": 0.00010000,
        "time": 1557501112,
        "height": 101,
        "descendantcount": 1,
        "descendantsize": 475,
        "descendantfees": 10000,
        "ancestorcount": 3,
        "ancestorsize": 1333,
        "ancestorfees": 30000,
        "wtxid": "ad244897a99caa76a5698567dd5c43cb42384b530ac158a7d8cf0be5f9638443",
        "depends": [
        ]
    }
};

// Simulate that one UTXO have been recently confirmed and the other had been recently replaced
const txsTestData1 = {
    "cb5713d8dc0d5825c8bd2f391e6bd0a9f9c0d3164dd1d594959094e27d34d460": {
        tx: {
            txid: "cb5713d8dc0d5825c8bd2f391e6bd0a9f9c0d3164dd1d594959094e27d34d460",
            confirmations: 1
        }
    },
    "3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373": {
        tx: {
            txid: "cb5713d8dc0d5825c8bd2f391e6bd0a9f9c0d3164dd1d594959094e27d34d460",
            confirmations: -1
        }
    }
};

// Simulate transactions for additional UTXOs (all confirmed)
const txsTestData2 = {
    "a34345f69e5beb3618dfca9a22326f6e978d5ec6ab5d5c57e685e6f812cd628d": {
        tx: {
            txid: "a34345f69e5beb3618dfca9a22326f6e978d5ec6ab5d5c57e685e6f812cd628d",
            confirmations: 1,
            hex: "020000000146c0193d47a07bc02684d8636d7e65566755fed85f9f230da512aa42b8d11f08000000004847304402204109438c05f03d6427d389501644b0a1de859c6c4e0bd9b7aa533a1a827f7d7302207933f98d729ef5be14149d828947b10a7db83e7ade24c7c53ab392662ca6995601ffffffff0b00e1f505000000001976a9149d74a09b1345433dba577b22f849a11ede61707488ac00e1f505000000001976a914c662fe85060a627ba5bbdadcfd3e493976622f3988ac00e1f505000000001976a914c6cad328f02bd7f053158afedb2df98951ab381c88ac00e1f505000000001976a91466fdc5f35d9cd21f8f3e477ee10c261a92c4a91088ac00e1f505000000001976a9140ea9617c03a4b2a6090dc9d088c9a9d238892e3d88ac00e1f505000000001976a914e93f7447d0c9c82e5d1d6090121fba5a63bbd04488ac00e1f505000000001976a9145c815f2113ae5dc9b9ec4968dabcf0dc0e04f1f988ac00e1f505000000001976a9140bcccbcf3ef913e82cc0fba05b1e9dc37dd4819a88ac00e1f505000000001976a914c0849ee0d200ba7d903ab6acab465014bc0b7a5588ac00e1f505000000001976a9149acd15e1b68b2faa71455a73b6340ac20118734c88acf0006bee000000001976a9145cbb6340f59cca9adc44b9d7122b304d0a2afac188ac00000000"
        },
        decoded: {
            "txid": "a34345f69e5beb3618dfca9a22326f6e978d5ec6ab5d5c57e685e6f812cd628d",
            "hash": "a34345f69e5beb3618dfca9a22326f6e978d5ec6ab5d5c57e685e6f812cd628d",
            "version": 2,
            "size": 497,
            "vsize": 497,
            "weight": 1988,
            "locktime": 0,
            "vin": [
                {
                    "txid": "081fd1b842aa12a50d239f5fd8fe556756657e6d63d88426c07ba0473d19c046",
                    "vout": 0,
                    "scriptSig": {
                        "asm": "304402204109438c05f03d6427d389501644b0a1de859c6c4e0bd9b7aa533a1a827f7d7302207933f98d729ef5be14149d828947b10a7db83e7ade24c7c53ab392662ca69956[ALL]",
                        "hex": "47304402204109438c05f03d6427d389501644b0a1de859c6c4e0bd9b7aa533a1a827f7d7302207933f98d729ef5be14149d828947b10a7db83e7ade24c7c53ab392662ca6995601"
                    },
                    "sequence": 4294967295
                }
            ],
            "vout": [
                {
                    "value": 1.00000000,
                    "n": 0,
                    "scriptPubKey": {
                        "asm": "OP_DUP OP_HASH160 9d74a09b1345433dba577b22f849a11ede617074 OP_EQUALVERIFY OP_CHECKSIG",
                        "hex": "76a9149d74a09b1345433dba577b22f849a11ede61707488ac",
                        "type": "pubkeyhash",
                        "address": "musW6am226LTg8W6QBSrZASRZJ6dzVYH5G"
                    }
                },
                {
                    "value": 1.00000000,
                    "n": 1,
                    "scriptPubKey": {
                        "asm": "OP_DUP OP_HASH160 c662fe85060a627ba5bbdadcfd3e493976622f39 OP_EQUALVERIFY OP_CHECKSIG",
                        "hex": "76a914c662fe85060a627ba5bbdadcfd3e493976622f3988ac",
                        "type": "pubkeyhash",
                        "address": "mybvgGvB89L2RS8fH8VQTMXWT62edC2bmg"
                    }
                },
                {
                    "value": 1.00000000,
                    "n": 2,
                    "scriptPubKey": {
                        "asm": "OP_DUP OP_HASH160 c6cad328f02bd7f053158afedb2df98951ab381c OP_EQUALVERIFY OP_CHECKSIG",
                        "hex": "76a914c6cad328f02bd7f053158afedb2df98951ab381c88ac",
                        "type": "pubkeyhash",
                        "address": "mye54Z4eBMyZtvapH47Nnw4dk1RfipZ9o1"
                    }
                },
                {
                    "value": 1.00000000,
                    "n": 3,
                    "scriptPubKey": {
                        "asm": "OP_DUP OP_HASH160 66fdc5f35d9cd21f8f3e477ee10c261a92c4a910 OP_EQUALVERIFY OP_CHECKSIG",
                        "hex": "76a91466fdc5f35d9cd21f8f3e477ee10c261a92c4a91088ac",
                        "type": "pubkeyhash",
                        "address": "mpuXE6TSobpx59AHdood9EkeEAgz7vW8oo"
                    }
                },
                {
                    "value": 1.00000000,
                    "n": 4,
                    "scriptPubKey": {
                        "asm": "OP_DUP OP_HASH160 0ea9617c03a4b2a6090dc9d088c9a9d238892e3d OP_EQUALVERIFY OP_CHECKSIG",
                        "hex": "76a9140ea9617c03a4b2a6090dc9d088c9a9d238892e3d88ac",
                        "type": "pubkeyhash",
                        "address": "mgrUfXLVLJiw5XRizaHDbXSPsEpxwB4eDt"
                    }
                },
                {
                    "value": 1.00000000,
                    "n": 5,
                    "scriptPubKey": {
                        "asm": "OP_DUP OP_HASH160 e93f7447d0c9c82e5d1d6090121fba5a63bbd044 OP_EQUALVERIFY OP_CHECKSIG",
                        "hex": "76a914e93f7447d0c9c82e5d1d6090121fba5a63bbd04488ac",
                        "type": "pubkeyhash",
                        "address": "n2nFkdKhPY84LyJGW9fDxoBJqL1kaur1YJ"
                    }
                },
                {
                    "value": 1.00000000,
                    "n": 6,
                    "scriptPubKey": {
                        "asm": "OP_DUP OP_HASH160 5c815f2113ae5dc9b9ec4968dabcf0dc0e04f1f9 OP_EQUALVERIFY OP_CHECKSIG",
                        "hex": "76a9145c815f2113ae5dc9b9ec4968dabcf0dc0e04f1f988ac",
                        "type": "pubkeyhash",
                        "address": "mox5SbgAjc26Yth23i1xCLxK7pDWrpv4QA"
                    }
                },
                {
                    "value": 1.00000000,
                    "n": 7,
                    "scriptPubKey": {
                        "asm": "OP_DUP OP_HASH160 0bcccbcf3ef913e82cc0fba05b1e9dc37dd4819a OP_EQUALVERIFY OP_CHECKSIG",
                        "hex": "76a9140bcccbcf3ef913e82cc0fba05b1e9dc37dd4819a88ac",
                        "type": "pubkeyhash",
                        "address": "mgbM4eapkrJqB8Sss4XCXP5o3CsKQyz9tx"
                    }
                },
                {
                    "value": 1.00000000,
                    "n": 8,
                    "scriptPubKey": {
                        "asm": "OP_DUP OP_HASH160 c0849ee0d200ba7d903ab6acab465014bc0b7a55 OP_EQUALVERIFY OP_CHECKSIG",
                        "hex": "76a914c0849ee0d200ba7d903ab6acab465014bc0b7a5588ac",
                        "type": "pubkeyhash",
                        "address": "my4tuXYub6b2bnijw6vcMzncPgANvAZfdD"
                    }
                },
                {
                    "value": 1.00000000,
                    "n": 9,
                    "scriptPubKey": {
                        "asm": "OP_DUP OP_HASH160 9acd15e1b68b2faa71455a73b6340ac20118734c OP_EQUALVERIFY OP_CHECKSIG",
                        "hex": "76a9149acd15e1b68b2faa71455a73b6340ac20118734c88ac",
                        "type": "pubkeyhash",
                        "address": "mudU3Bf4imGDgXFnKSTBLnxfMS7BwCe6Hv"
                    }
                },
                {
                    "value": 39.99990000,
                    "n": 10,
                    "scriptPubKey": {
                        "asm": "OP_DUP OP_HASH160 5cbb6340f59cca9adc44b9d7122b304d0a2afac1 OP_EQUALVERIFY OP_CHECKSIG",
                        "hex": "76a9145cbb6340f59cca9adc44b9d7122b304d0a2afac188ac",
                        "type": "pubkeyhash",
                        "address": "moyGwdRQd7o4hjURyFzXo8VLmBLi7qSpPk"
                    }
                }
            ],
            "confirmations": 1
        }
    },
    "7fa35e8cabf89a25324f7fa25f2f22f47850e97a3c3b05e875ba95c7ead80ad6": {
        tx: {
            txid: "7fa35e8cabf89a25324f7fa25f2f22f47850e97a3c3b05e875ba95c7ead80ad6",
            confirmations: 1,
            hex: "02000000028d62cd12f8e685e6575c5dabc65e8d976e6f32229acadf1836eb5b9ef64543a3010000006b483045022100ab8ba8a45d06cf6c015ef2e55ce808d122db56ab849551fad9c55470edee6243022037dfa3c3a1a70eff78ef68dd0afe2f19f7cdae9ab3b918fb6652a78bbdc8261b0121037dc0b2a7b076aa8f963f11b5bf445ebb754e7fbd2d4bd55074e452e031b273c9ffffffff8d62cd12f8e685e6575c5dabc65e8d976e6f32229acadf1836eb5b9ef64543a3020000006a47304402201d2c90bef4d71ba7bd8351cbb0c0216fb503f39a8ba87d24169a2ff1798fbd2e02201d833f2e3627b40c06d12bc42110161cd86c5d1a0d20eee72d2665942c3ad1a8012103e4cf2378adbb15102a6845157cd47fd5a39bb73bfe3c8ea4611e85ee0ae2dd04ffffffff06002d3101000000001976a914b31136109e058d290739494275db5b720eee3fa288ac002d3101000000001976a9146c0581c57f1fdd9e93f99d8cc3dc5b77c0c114e788ac002d3101000000001976a9141926e280d26536c41f165d4567a91c61eda34f3b88ac002d3101000000001976a914f79b636b11f558cfa50b117165fe19a82e30f11d88ac002d3101000000001976a914b0c3cec55149984f349f65666451dc283e48205e88acf0b9f505000000001976a9142d5e3313109ec1b49d8c758881abc9ee5722ee0e88ac00000000"
        },
        decoded: {
            "txid": "7fa35e8cabf89a25324f7fa25f2f22f47850e97a3c3b05e875ba95c7ead80ad6",
            "hash": "7fa35e8cabf89a25324f7fa25f2f22f47850e97a3c3b05e875ba95c7ead80ad6",
            "version": 2,
            "size": 509,
            "vsize": 509,
            "weight": 2036,
            "locktime": 0,
            "vin": [
                {
                    "txid": "a34345f69e5beb3618dfca9a22326f6e978d5ec6ab5d5c57e685e6f812cd628d",
                    "vout": 1,
                    "scriptSig": {
                        "asm": "3045022100ab8ba8a45d06cf6c015ef2e55ce808d122db56ab849551fad9c55470edee6243022037dfa3c3a1a70eff78ef68dd0afe2f19f7cdae9ab3b918fb6652a78bbdc8261b[ALL] 037dc0b2a7b076aa8f963f11b5bf445ebb754e7fbd2d4bd55074e452e031b273c9",
                        "hex": "483045022100ab8ba8a45d06cf6c015ef2e55ce808d122db56ab849551fad9c55470edee6243022037dfa3c3a1a70eff78ef68dd0afe2f19f7cdae9ab3b918fb6652a78bbdc8261b0121037dc0b2a7b076aa8f963f11b5bf445ebb754e7fbd2d4bd55074e452e031b273c9"
                    },
                    "sequence": 4294967295
                },
                {
                    "txid": "a34345f69e5beb3618dfca9a22326f6e978d5ec6ab5d5c57e685e6f812cd628d",
                    "vout": 2,
                    "scriptSig": {
                        "asm": "304402201d2c90bef4d71ba7bd8351cbb0c0216fb503f39a8ba87d24169a2ff1798fbd2e02201d833f2e3627b40c06d12bc42110161cd86c5d1a0d20eee72d2665942c3ad1a8[ALL] 03e4cf2378adbb15102a6845157cd47fd5a39bb73bfe3c8ea4611e85ee0ae2dd04",
                        "hex": "47304402201d2c90bef4d71ba7bd8351cbb0c0216fb503f39a8ba87d24169a2ff1798fbd2e02201d833f2e3627b40c06d12bc42110161cd86c5d1a0d20eee72d2665942c3ad1a8012103e4cf2378adbb15102a6845157cd47fd5a39bb73bfe3c8ea4611e85ee0ae2dd04"
                    },
                    "sequence": 4294967295
                }
            ],
            "vout": [
                {
                    "value": 0.20000000,
                    "n": 0,
                    "scriptPubKey": {
                        "asm": "OP_DUP OP_HASH160 b31136109e058d290739494275db5b720eee3fa2 OP_EQUALVERIFY OP_CHECKSIG",
                        "hex": "76a914b31136109e058d290739494275db5b720eee3fa288ac",
                        "type": "pubkeyhash",
                        "address": "mwqmsFERSftPpq96o4FoCwPH4fU4iJyTLZ"
                    }
                },
                {
                    "value": 0.20000000,
                    "n": 1,
                    "scriptPubKey": {
                        "asm": "OP_DUP OP_HASH160 6c0581c57f1fdd9e93f99d8cc3dc5b77c0c114e7 OP_EQUALVERIFY OP_CHECKSIG",
                        "hex": "76a9146c0581c57f1fdd9e93f99d8cc3dc5b77c0c114e788ac",
                        "type": "pubkeyhash",
                        "address": "mqN7sQ7AsWA7HKXQ3D4bM3qp4QEBX2JXXp"
                    }
                },
                {
                    "value": 0.20000000,
                    "n": 2,
                    "scriptPubKey": {
                        "asm": "OP_DUP OP_HASH160 1926e280d26536c41f165d4567a91c61eda34f3b OP_EQUALVERIFY OP_CHECKSIG",
                        "hex": "76a9141926e280d26536c41f165d4567a91c61eda34f3b88ac",
                        "type": "pubkeyhash",
                        "address": "mhowmcRTByg5CLGFN5uWjMmD4bxUSfytvU"
                    }
                },
                {
                    "value": 0.20000000,
                    "n": 3,
                    "scriptPubKey": {
                        "asm": "OP_DUP OP_HASH160 f79b636b11f558cfa50b117165fe19a82e30f11d OP_EQUALVERIFY OP_CHECKSIG",
                        "hex": "76a914f79b636b11f558cfa50b117165fe19a82e30f11d88ac",
                        "type": "pubkeyhash",
                        "address": "n46BM1Rec28gU4xSEELmHcqbSGvtJR2XqK"
                    }
                },
                {
                    "value": 0.20000000,
                    "n": 4,
                    "scriptPubKey": {
                        "asm": "OP_DUP OP_HASH160 b0c3cec55149984f349f65666451dc283e48205e OP_EQUALVERIFY OP_CHECKSIG",
                        "hex": "76a914b0c3cec55149984f349f65666451dc283e48205e88ac",
                        "type": "pubkeyhash",
                        "address": "mwdbnmpXabKaLZXuaF3xiCr8RCp7SguyWp"
                    }
                },
                {
                    "value": 0.99990000,
                    "n": 5,
                    "scriptPubKey": {
                        "asm": "OP_DUP OP_HASH160 2d5e3313109ec1b49d8c758881abc9ee5722ee0e OP_EQUALVERIFY OP_CHECKSIG",
                        "hex": "76a9142d5e3313109ec1b49d8c758881abc9ee5722ee0e88ac",
                        "type": "pubkeyhash",
                        "address": "mjeqYnNUstuceEa8ES5gHqTz34Ysyeqyys"
                    }
                }
            ],
            "confirmations": 1
        }
    },
    "cb5713d8dc0d5825c8bd2f391e6bd0a9f9c0d3164dd1d594959094e27d34d460": {
        tx: {
            txid: "cb5713d8dc0d5825c8bd2f391e6bd0a9f9c0d3164dd1d594959094e27d34d460",
            confirmations: 1,
            hex: "02000000018d62cd12f8e685e6575c5dabc65e8d976e6f32229acadf1836eb5b9ef64543a3000000006a4730440220601618ec0c6051822db73ca412037ba04601cf25e8ffb6a6f2f83c8b1d16a5a30220266009ef30277e0cf247d2bcb65988557f061dfee3787015c058c619fe622f89012102e4b03d40984db90ee71c343a4e94711d1a9afc0c6cdbf033baf675fb625e6351ffffffff0680969800000000001976a91499378b928158b765f779d1a997b017db000f3fb288ac80969800000000001976a914cf6bc15e0d770e5a65619930a705b2d15ba5939288ac80969800000000001976a9146a2f2033d57c191c2581f9c830d7b99ca5e5941188ac80969800000000001976a914a2bd256752b8f8ae144195eeeaba2614752784ba88ac80969800000000001976a9143c23a1a9e6e5f948060a1d36154dda763d5b952488ac70c9fa02000000001976a914a356301a14af2599a6b17a1e2ace3b3a339afcb588ac00000000"
        },
        decoded: {
            "txid": "cb5713d8dc0d5825c8bd2f391e6bd0a9f9c0d3164dd1d594959094e27d34d460",
            "hash": "cb5713d8dc0d5825c8bd2f391e6bd0a9f9c0d3164dd1d594959094e27d34d460",
            "version": 2,
            "size": 361,
            "vsize": 361,
            "weight": 1444,
            "locktime": 0,
            "vin": [
                {
                    "txid": "a34345f69e5beb3618dfca9a22326f6e978d5ec6ab5d5c57e685e6f812cd628d",
                    "vout": 0,
                    "scriptSig": {
                        "asm": "30440220601618ec0c6051822db73ca412037ba04601cf25e8ffb6a6f2f83c8b1d16a5a30220266009ef30277e0cf247d2bcb65988557f061dfee3787015c058c619fe622f89[ALL] 02e4b03d40984db90ee71c343a4e94711d1a9afc0c6cdbf033baf675fb625e6351",
                        "hex": "4730440220601618ec0c6051822db73ca412037ba04601cf25e8ffb6a6f2f83c8b1d16a5a30220266009ef30277e0cf247d2bcb65988557f061dfee3787015c058c619fe622f89012102e4b03d40984db90ee71c343a4e94711d1a9afc0c6cdbf033baf675fb625e6351"
                    },
                    "sequence": 4294967295
                }
            ],
            "vout": [
                {
                    "value": 0.10000000,
                    "n": 0,
                    "scriptPubKey": {
                        "asm": "OP_DUP OP_HASH160 99378b928158b765f779d1a997b017db000f3fb2 OP_EQUALVERIFY OP_CHECKSIG",
                        "hex": "76a91499378b928158b765f779d1a997b017db000f3fb288ac",
                        "type": "pubkeyhash",
                        "address": "muV6DkbkJreV43PcWCKeU8pak516kanoCy"
                    }
                },
                {
                    "value": 0.10000000,
                    "n": 1,
                    "scriptPubKey": {
                        "asm": "OP_DUP OP_HASH160 cf6bc15e0d770e5a65619930a705b2d15ba59392 OP_EQUALVERIFY OP_CHECKSIG",
                        "hex": "76a914cf6bc15e0d770e5a65619930a705b2d15ba5939288ac",
                        "type": "pubkeyhash",
                        "address": "mzRhFjbn1zyLaN5kWypCxLVydorveeZQwC"
                    }
                },
                {
                    "value": 0.10000000,
                    "n": 2,
                    "scriptPubKey": {
                        "asm": "OP_DUP OP_HASH160 6a2f2033d57c191c2581f9c830d7b99ca5e59411 OP_EQUALVERIFY OP_CHECKSIG",
                        "hex": "76a9146a2f2033d57c191c2581f9c830d7b99ca5e5941188ac",
                        "type": "pubkeyhash",
                        "address": "mqCQNkBna1LvV9rnkfaQFQvvniaCX9YUcu"
                    }
                },
                {
                    "value": 0.10000000,
                    "n": 3,
                    "scriptPubKey": {
                        "asm": "OP_DUP OP_HASH160 a2bd256752b8f8ae144195eeeaba2614752784ba OP_EQUALVERIFY OP_CHECKSIG",
                        "hex": "76a914a2bd256752b8f8ae144195eeeaba2614752784ba88ac",
                        "type": "pubkeyhash",
                        "address": "mvMSMESShzK61qfqUbzYGPboWNPXgN3CTw"
                    }
                },
                {
                    "value": 0.10000000,
                    "n": 4,
                    "scriptPubKey": {
                        "asm": "OP_DUP OP_HASH160 3c23a1a9e6e5f948060a1d36154dda763d5b9524 OP_EQUALVERIFY OP_CHECKSIG",
                        "hex": "76a9143c23a1a9e6e5f948060a1d36154dda763d5b952488ac",
                        "type": "pubkeyhash",
                        "address": "mkzwXHQtqViJ7QJM8qtdMwubBx951DT3Dq"
                    }
                },
                {
                    "value": 0.49990000,
                    "n": 5,
                    "scriptPubKey": {
                        "asm": "OP_DUP OP_HASH160 a356301a14af2599a6b17a1e2ace3b3a339afcb5 OP_EQUALVERIFY OP_CHECKSIG",
                        "hex": "76a914a356301a14af2599a6b17a1e2ace3b3a339afcb588ac",
                        "type": "pubkeyhash",
                        "address": "mvQbgmBML6nLmjCNhDTQZvTcqqMg46yiKV"
                    }
                }
            ],
            "confirmations": 1
        }
    }
};

// Simulate transactions for additional UTXOs (mix of confirmed and unconfirmed)
const txsTestData3 = {
    "3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373": {
        tx: {
            txid: "3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373",
            confirmations: 0,
            hex: "020000000260d4347de294909594d5d14d16d3c0f9a9d06b1e392fbdc825580ddcd81357cb000000006a473044022073fe0d3d6ac46ddaa8c6915a3798c1ab8918ca5add5b56c352c5e1ffb8d1a22802202aab03670a1393c6525cf7cd882134d2526537e18dfe3fdfcea332019936ed7701210241b68979296ccece9048853154aaf3407b8a957077902cd05b044b11fc01c282ffffffffd60ad8eac795ba75e8053b3c7ae95078f4222f5fa27f4f32259af8ab8c5ea37f000000006a47304402200af2cc475bda413f8c49a7a10b77ffb2cc60c2ab1c8cca5c07959218c18731ff022016c74183cf8f15fdabb079ec6324c32814fd02fac7208d2d4b4241b2be3142c5012102ebabca841bad7d705e49b1088cbbfe718b57d9735bccc11d265ca4436b21f587ffffffff05404b4c00000000001976a914d0f7225b7401e5b607eecf50dcadc33cfaef611e88ac404b4c00000000001976a9140bc4a16d97dcd567a3304c6d16bfaa5b7cd6cc8e88ac404b4c00000000001976a914096c454917a007391dac73015f0f0957cf6573d788ac404b4c00000000001976a91481aa8a8d0a3a027f2a02266861fc968bcbb686f588ac706f9800000000001976a914d462b14409646cb4b07f0778b4c0d9e7a336bb0e88ac00000000"
        },
        decoded: {
            "txid": "3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373",
            "hash": "3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373",
            "version": 2,
            "size": 474,
            "vsize": 474,
            "weight": 1896,
            "locktime": 0,
            "vin": [
                {
                    "txid": "cb5713d8dc0d5825c8bd2f391e6bd0a9f9c0d3164dd1d594959094e27d34d460",
                    "vout": 0,
                    "scriptSig": {
                        "asm": "3044022073fe0d3d6ac46ddaa8c6915a3798c1ab8918ca5add5b56c352c5e1ffb8d1a22802202aab03670a1393c6525cf7cd882134d2526537e18dfe3fdfcea332019936ed77[ALL] 0241b68979296ccece9048853154aaf3407b8a957077902cd05b044b11fc01c282",
                        "hex": "473044022073fe0d3d6ac46ddaa8c6915a3798c1ab8918ca5add5b56c352c5e1ffb8d1a22802202aab03670a1393c6525cf7cd882134d2526537e18dfe3fdfcea332019936ed7701210241b68979296ccece9048853154aaf3407b8a957077902cd05b044b11fc01c282"
                    },
                    "sequence": 4294967295
                },
                {
                    "txid": "7fa35e8cabf89a25324f7fa25f2f22f47850e97a3c3b05e875ba95c7ead80ad6",
                    "vout": 0,
                    "scriptSig": {
                        "asm": "304402200af2cc475bda413f8c49a7a10b77ffb2cc60c2ab1c8cca5c07959218c18731ff022016c74183cf8f15fdabb079ec6324c32814fd02fac7208d2d4b4241b2be3142c5[ALL] 02ebabca841bad7d705e49b1088cbbfe718b57d9735bccc11d265ca4436b21f587",
                        "hex": "47304402200af2cc475bda413f8c49a7a10b77ffb2cc60c2ab1c8cca5c07959218c18731ff022016c74183cf8f15fdabb079ec6324c32814fd02fac7208d2d4b4241b2be3142c5012102ebabca841bad7d705e49b1088cbbfe718b57d9735bccc11d265ca4436b21f587"
                    },
                    "sequence": 4294967295
                }
            ],
            "vout": [
                {
                    "value": 0.05000000,
                    "n": 0,
                    "scriptPubKey": {
                        "asm": "OP_DUP OP_HASH160 d0f7225b7401e5b607eecf50dcadc33cfaef611e OP_EQUALVERIFY OP_CHECKSIG",
                        "hex": "76a914d0f7225b7401e5b607eecf50dcadc33cfaef611e88ac",
                        "type": "pubkeyhash",
                        "address": "mzZru974R4AGygK2dQiYQnWyDvZLq7jp8Q"
                    }
                },
                {
                    "value": 0.05000000,
                    "n": 1,
                    "scriptPubKey": {
                        "asm": "OP_DUP OP_HASH160 0bc4a16d97dcd567a3304c6d16bfaa5b7cd6cc8e OP_EQUALVERIFY OP_CHECKSIG",
                        "hex": "76a9140bc4a16d97dcd567a3304c6d16bfaa5b7cd6cc8e88ac",
                        "type": "pubkeyhash",
                        "address": "mgbBHJ8tGz8MU2rF75UUhdiLVLDGFUetKD"
                    }
                },
                {
                    "value": 0.05000000,
                    "n": 2,
                    "scriptPubKey": {
                        "asm": "OP_DUP OP_HASH160 096c454917a007391dac73015f0f0957cf6573d7 OP_EQUALVERIFY OP_CHECKSIG",
                        "hex": "76a914096c454917a007391dac73015f0f0957cf6573d788ac",
                        "type": "pubkeyhash",
                        "address": "mgNn5ZFfaJPe8vxAiL2Nxxb2fmFVnnoU8Y"
                    }
                },
                {
                    "value": 0.05000000,
                    "n": 3,
                    "scriptPubKey": {
                        "asm": "OP_DUP OP_HASH160 81aa8a8d0a3a027f2a02266861fc968bcbb686f5 OP_EQUALVERIFY OP_CHECKSIG",
                        "hex": "76a91481aa8a8d0a3a027f2a02266861fc968bcbb686f588ac",
                        "type": "pubkeyhash",
                        "address": "msLZmDDdvQC4PKRhwq7vbCfXJQnkwj9ZSh"
                    }
                },
                {
                    "value": 0.09990000,
                    "n": 4,
                    "scriptPubKey": {
                        "asm": "OP_DUP OP_HASH160 d462b14409646cb4b07f0778b4c0d9e7a336bb0e OP_EQUALVERIFY OP_CHECKSIG",
                        "hex": "76a914d462b14409646cb4b07f0778b4c0d9e7a336bb0e88ac",
                        "type": "pubkeyhash",
                        "address": "mzswmzZnzGoQMy6rKBVk2MAPWTpxkpNdsj"
                    }
                }
            ],
            "confirmations": 0
        }
    },
    "ad244897a99caa76a5698567dd5c43cb42384b530ac158a7d8cf0be5f9638443": {
        tx: {
            txid: "ad244897a99caa76a5698567dd5c43cb42384b530ac158a7d8cf0be5f9638443",
            confirmations: 0,
            hex: "020000000260d4347de294909594d5d14d16d3c0f9a9d06b1e392fbdc825580ddcd81357cb010000006a473044022002604f0cfa269da9ad55c713baa89e611cab7318c86b85453be86e128a0347c80220382416639c2632e0ecda7f2343da749f5b881c8c31e3ed443813e11d422002bc0121035808d0622b6a044c17f367ae9ea988591ef8a38da54a860dd4401e50ed2f304cffffffff8d62cd12f8e685e6575c5dabc65e8d976e6f32229acadf1836eb5b9ef64543a3030000006b483045022100ff78c3e1a6c8f1e7deba271e7d7816050427eddd23e5d921ff5d12f6f22997580220104ec1f5c660f466528f445b96e6659606365b7140cb1f7ee9e1e728581eab30012103d225b97191f06a7878be73a17ac6d46eacc074af6da2af9cd8c5391b4b522bf8ffffffff05c0e1e400000000001976a914d0f7225b7401e5b607eecf50dcadc33cfaef611e88acc0e1e400000000001976a9140bc4a16d97dcd567a3304c6d16bfaa5b7cd6cc8e88acc0e1e400000000001976a914096c454917a007391dac73015f0f0957cf6573d788acc0e1e400000000001976a91481aa8a8d0a3a027f2a02266861fc968bcbb686f588ac70c9fa02000000001976a914d462b14409646cb4b07f0778b4c0d9e7a336bb0e88ac00000000"
        },
        decoded: {
            "txid": "ad244897a99caa76a5698567dd5c43cb42384b530ac158a7d8cf0be5f9638443",
            "hash": "ad244897a99caa76a5698567dd5c43cb42384b530ac158a7d8cf0be5f9638443",
            "version": 2,
            "size": 475,
            "vsize": 475,
            "weight": 1900,
            "locktime": 0,
            "vin": [
                {
                    "txid": "cb5713d8dc0d5825c8bd2f391e6bd0a9f9c0d3164dd1d594959094e27d34d460",
                    "vout": 1,
                    "scriptSig": {
                        "asm": "3044022002604f0cfa269da9ad55c713baa89e611cab7318c86b85453be86e128a0347c80220382416639c2632e0ecda7f2343da749f5b881c8c31e3ed443813e11d422002bc[ALL] 035808d0622b6a044c17f367ae9ea988591ef8a38da54a860dd4401e50ed2f304c",
                        "hex": "473044022002604f0cfa269da9ad55c713baa89e611cab7318c86b85453be86e128a0347c80220382416639c2632e0ecda7f2343da749f5b881c8c31e3ed443813e11d422002bc0121035808d0622b6a044c17f367ae9ea988591ef8a38da54a860dd4401e50ed2f304c"
                    },
                    "sequence": 4294967295
                },
                {
                    "txid": "a34345f69e5beb3618dfca9a22326f6e978d5ec6ab5d5c57e685e6f812cd628d",
                    "vout": 3,
                    "scriptSig": {
                        "asm": "3045022100ff78c3e1a6c8f1e7deba271e7d7816050427eddd23e5d921ff5d12f6f22997580220104ec1f5c660f466528f445b96e6659606365b7140cb1f7ee9e1e728581eab30[ALL] 03d225b97191f06a7878be73a17ac6d46eacc074af6da2af9cd8c5391b4b522bf8",
                        "hex": "483045022100ff78c3e1a6c8f1e7deba271e7d7816050427eddd23e5d921ff5d12f6f22997580220104ec1f5c660f466528f445b96e6659606365b7140cb1f7ee9e1e728581eab30012103d225b97191f06a7878be73a17ac6d46eacc074af6da2af9cd8c5391b4b522bf8"
                    },
                    "sequence": 4294967295
                }
            ],
            "vout": [
                {
                    "value": 0.15000000,
                    "n": 0,
                    "scriptPubKey": {
                        "asm": "OP_DUP OP_HASH160 d0f7225b7401e5b607eecf50dcadc33cfaef611e OP_EQUALVERIFY OP_CHECKSIG",
                        "hex": "76a914d0f7225b7401e5b607eecf50dcadc33cfaef611e88ac",
                        "type": "pubkeyhash",
                        "address": "mzZru974R4AGygK2dQiYQnWyDvZLq7jp8Q"
                    }
                },
                {
                    "value": 0.15000000,
                    "n": 1,
                    "scriptPubKey": {
                        "asm": "OP_DUP OP_HASH160 0bc4a16d97dcd567a3304c6d16bfaa5b7cd6cc8e OP_EQUALVERIFY OP_CHECKSIG",
                        "hex": "76a9140bc4a16d97dcd567a3304c6d16bfaa5b7cd6cc8e88ac",
                        "type": "pubkeyhash",
                        "address": "mgbBHJ8tGz8MU2rF75UUhdiLVLDGFUetKD"
                    }
                },
                {
                    "value": 0.15000000,
                    "n": 2,
                    "scriptPubKey": {
                        "asm": "OP_DUP OP_HASH160 096c454917a007391dac73015f0f0957cf6573d7 OP_EQUALVERIFY OP_CHECKSIG",
                        "hex": "76a914096c454917a007391dac73015f0f0957cf6573d788ac",
                        "type": "pubkeyhash",
                        "address": "mgNn5ZFfaJPe8vxAiL2Nxxb2fmFVnnoU8Y"
                    }
                },
                {
                    "value": 0.15000000,
                    "n": 3,
                    "scriptPubKey": {
                        "asm": "OP_DUP OP_HASH160 81aa8a8d0a3a027f2a02266861fc968bcbb686f5 OP_EQUALVERIFY OP_CHECKSIG",
                        "hex": "76a91481aa8a8d0a3a027f2a02266861fc968bcbb686f588ac",
                        "type": "pubkeyhash",
                        "address": "msLZmDDdvQC4PKRhwq7vbCfXJQnkwj9ZSh"
                    }
                },
                {
                    "value": 0.49990000,
                    "n": 4,
                    "scriptPubKey": {
                        "asm": "OP_DUP OP_HASH160 d462b14409646cb4b07f0778b4c0d9e7a336bb0e OP_EQUALVERIFY OP_CHECKSIG",
                        "hex": "76a914d462b14409646cb4b07f0778b4c0d9e7a336bb0e88ac",
                        "type": "pubkeyhash",
                        "address": "mzswmzZnzGoQMy6rKBVk2MAPWTpxkpNdsj"
                    }
                }
            ],
            "confirmations": 0
        }
    },
    "a34345f69e5beb3618dfca9a22326f6e978d5ec6ab5d5c57e685e6f812cd628d": {
        tx: {
            txid: "a34345f69e5beb3618dfca9a22326f6e978d5ec6ab5d5c57e685e6f812cd628d",
            confirmations: 1,
            hex: "020000000146c0193d47a07bc02684d8636d7e65566755fed85f9f230da512aa42b8d11f08000000004847304402204109438c05f03d6427d389501644b0a1de859c6c4e0bd9b7aa533a1a827f7d7302207933f98d729ef5be14149d828947b10a7db83e7ade24c7c53ab392662ca6995601ffffffff0b00e1f505000000001976a9149d74a09b1345433dba577b22f849a11ede61707488ac00e1f505000000001976a914c662fe85060a627ba5bbdadcfd3e493976622f3988ac00e1f505000000001976a914c6cad328f02bd7f053158afedb2df98951ab381c88ac00e1f505000000001976a91466fdc5f35d9cd21f8f3e477ee10c261a92c4a91088ac00e1f505000000001976a9140ea9617c03a4b2a6090dc9d088c9a9d238892e3d88ac00e1f505000000001976a914e93f7447d0c9c82e5d1d6090121fba5a63bbd04488ac00e1f505000000001976a9145c815f2113ae5dc9b9ec4968dabcf0dc0e04f1f988ac00e1f505000000001976a9140bcccbcf3ef913e82cc0fba05b1e9dc37dd4819a88ac00e1f505000000001976a914c0849ee0d200ba7d903ab6acab465014bc0b7a5588ac00e1f505000000001976a9149acd15e1b68b2faa71455a73b6340ac20118734c88acf0006bee000000001976a9145cbb6340f59cca9adc44b9d7122b304d0a2afac188ac00000000"
        },
        decoded: {
            "txid": "a34345f69e5beb3618dfca9a22326f6e978d5ec6ab5d5c57e685e6f812cd628d",
            "hash": "a34345f69e5beb3618dfca9a22326f6e978d5ec6ab5d5c57e685e6f812cd628d",
            "version": 2,
            "size": 497,
            "vsize": 497,
            "weight": 1988,
            "locktime": 0,
            "vin": [
                {
                    "txid": "081fd1b842aa12a50d239f5fd8fe556756657e6d63d88426c07ba0473d19c046",
                    "vout": 0,
                    "scriptSig": {
                        "asm": "304402204109438c05f03d6427d389501644b0a1de859c6c4e0bd9b7aa533a1a827f7d7302207933f98d729ef5be14149d828947b10a7db83e7ade24c7c53ab392662ca69956[ALL]",
                        "hex": "47304402204109438c05f03d6427d389501644b0a1de859c6c4e0bd9b7aa533a1a827f7d7302207933f98d729ef5be14149d828947b10a7db83e7ade24c7c53ab392662ca6995601"
                    },
                    "sequence": 4294967295
                }
            ],
            "vout": [
                {
                    "value": 1.00000000,
                    "n": 0,
                    "scriptPubKey": {
                        "asm": "OP_DUP OP_HASH160 9d74a09b1345433dba577b22f849a11ede617074 OP_EQUALVERIFY OP_CHECKSIG",
                        "hex": "76a9149d74a09b1345433dba577b22f849a11ede61707488ac",
                        "type": "pubkeyhash",
                        "address": "musW6am226LTg8W6QBSrZASRZJ6dzVYH5G"
                    }
                },
                {
                    "value": 1.00000000,
                    "n": 1,
                    "scriptPubKey": {
                        "asm": "OP_DUP OP_HASH160 c662fe85060a627ba5bbdadcfd3e493976622f39 OP_EQUALVERIFY OP_CHECKSIG",
                        "hex": "76a914c662fe85060a627ba5bbdadcfd3e493976622f3988ac",
                        "type": "pubkeyhash",
                        "address": "mybvgGvB89L2RS8fH8VQTMXWT62edC2bmg"
                    }
                },
                {
                    "value": 1.00000000,
                    "n": 2,
                    "scriptPubKey": {
                        "asm": "OP_DUP OP_HASH160 c6cad328f02bd7f053158afedb2df98951ab381c OP_EQUALVERIFY OP_CHECKSIG",
                        "hex": "76a914c6cad328f02bd7f053158afedb2df98951ab381c88ac",
                        "type": "pubkeyhash",
                        "address": "mye54Z4eBMyZtvapH47Nnw4dk1RfipZ9o1"
                    }
                },
                {
                    "value": 1.00000000,
                    "n": 3,
                    "scriptPubKey": {
                        "asm": "OP_DUP OP_HASH160 66fdc5f35d9cd21f8f3e477ee10c261a92c4a910 OP_EQUALVERIFY OP_CHECKSIG",
                        "hex": "76a91466fdc5f35d9cd21f8f3e477ee10c261a92c4a91088ac",
                        "type": "pubkeyhash",
                        "address": "mpuXE6TSobpx59AHdood9EkeEAgz7vW8oo"
                    }
                },
                {
                    "value": 1.00000000,
                    "n": 4,
                    "scriptPubKey": {
                        "asm": "OP_DUP OP_HASH160 0ea9617c03a4b2a6090dc9d088c9a9d238892e3d OP_EQUALVERIFY OP_CHECKSIG",
                        "hex": "76a9140ea9617c03a4b2a6090dc9d088c9a9d238892e3d88ac",
                        "type": "pubkeyhash",
                        "address": "mgrUfXLVLJiw5XRizaHDbXSPsEpxwB4eDt"
                    }
                },
                {
                    "value": 1.00000000,
                    "n": 5,
                    "scriptPubKey": {
                        "asm": "OP_DUP OP_HASH160 e93f7447d0c9c82e5d1d6090121fba5a63bbd044 OP_EQUALVERIFY OP_CHECKSIG",
                        "hex": "76a914e93f7447d0c9c82e5d1d6090121fba5a63bbd04488ac",
                        "type": "pubkeyhash",
                        "address": "n2nFkdKhPY84LyJGW9fDxoBJqL1kaur1YJ"
                    }
                },
                {
                    "value": 1.00000000,
                    "n": 6,
                    "scriptPubKey": {
                        "asm": "OP_DUP OP_HASH160 5c815f2113ae5dc9b9ec4968dabcf0dc0e04f1f9 OP_EQUALVERIFY OP_CHECKSIG",
                        "hex": "76a9145c815f2113ae5dc9b9ec4968dabcf0dc0e04f1f988ac",
                        "type": "pubkeyhash",
                        "address": "mox5SbgAjc26Yth23i1xCLxK7pDWrpv4QA"
                    }
                },
                {
                    "value": 1.00000000,
                    "n": 7,
                    "scriptPubKey": {
                        "asm": "OP_DUP OP_HASH160 0bcccbcf3ef913e82cc0fba05b1e9dc37dd4819a OP_EQUALVERIFY OP_CHECKSIG",
                        "hex": "76a9140bcccbcf3ef913e82cc0fba05b1e9dc37dd4819a88ac",
                        "type": "pubkeyhash",
                        "address": "mgbM4eapkrJqB8Sss4XCXP5o3CsKQyz9tx"
                    }
                },
                {
                    "value": 1.00000000,
                    "n": 8,
                    "scriptPubKey": {
                        "asm": "OP_DUP OP_HASH160 c0849ee0d200ba7d903ab6acab465014bc0b7a55 OP_EQUALVERIFY OP_CHECKSIG",
                        "hex": "76a914c0849ee0d200ba7d903ab6acab465014bc0b7a5588ac",
                        "type": "pubkeyhash",
                        "address": "my4tuXYub6b2bnijw6vcMzncPgANvAZfdD"
                    }
                },
                {
                    "value": 1.00000000,
                    "n": 9,
                    "scriptPubKey": {
                        "asm": "OP_DUP OP_HASH160 9acd15e1b68b2faa71455a73b6340ac20118734c OP_EQUALVERIFY OP_CHECKSIG",
                        "hex": "76a9149acd15e1b68b2faa71455a73b6340ac20118734c88ac",
                        "type": "pubkeyhash",
                        "address": "mudU3Bf4imGDgXFnKSTBLnxfMS7BwCe6Hv"
                    }
                },
                {
                    "value": 39.99990000,
                    "n": 10,
                    "scriptPubKey": {
                        "asm": "OP_DUP OP_HASH160 5cbb6340f59cca9adc44b9d7122b304d0a2afac1 OP_EQUALVERIFY OP_CHECKSIG",
                        "hex": "76a9145cbb6340f59cca9adc44b9d7122b304d0a2afac188ac",
                        "type": "pubkeyhash",
                        "address": "moyGwdRQd7o4hjURyFzXo8VLmBLi7qSpPk"
                    }
                }
            ],
            "confirmations": 1
        }
    },
    "7fa35e8cabf89a25324f7fa25f2f22f47850e97a3c3b05e875ba95c7ead80ad6": {
        tx: {
            txid: "7fa35e8cabf89a25324f7fa25f2f22f47850e97a3c3b05e875ba95c7ead80ad6",
            confirmations: 1,
            hex: "02000000028d62cd12f8e685e6575c5dabc65e8d976e6f32229acadf1836eb5b9ef64543a3010000006b483045022100ab8ba8a45d06cf6c015ef2e55ce808d122db56ab849551fad9c55470edee6243022037dfa3c3a1a70eff78ef68dd0afe2f19f7cdae9ab3b918fb6652a78bbdc8261b0121037dc0b2a7b076aa8f963f11b5bf445ebb754e7fbd2d4bd55074e452e031b273c9ffffffff8d62cd12f8e685e6575c5dabc65e8d976e6f32229acadf1836eb5b9ef64543a3020000006a47304402201d2c90bef4d71ba7bd8351cbb0c0216fb503f39a8ba87d24169a2ff1798fbd2e02201d833f2e3627b40c06d12bc42110161cd86c5d1a0d20eee72d2665942c3ad1a8012103e4cf2378adbb15102a6845157cd47fd5a39bb73bfe3c8ea4611e85ee0ae2dd04ffffffff06002d3101000000001976a914b31136109e058d290739494275db5b720eee3fa288ac002d3101000000001976a9146c0581c57f1fdd9e93f99d8cc3dc5b77c0c114e788ac002d3101000000001976a9141926e280d26536c41f165d4567a91c61eda34f3b88ac002d3101000000001976a914f79b636b11f558cfa50b117165fe19a82e30f11d88ac002d3101000000001976a914b0c3cec55149984f349f65666451dc283e48205e88acf0b9f505000000001976a9142d5e3313109ec1b49d8c758881abc9ee5722ee0e88ac00000000"
        },
        decoded: {
            "txid": "7fa35e8cabf89a25324f7fa25f2f22f47850e97a3c3b05e875ba95c7ead80ad6",
            "hash": "7fa35e8cabf89a25324f7fa25f2f22f47850e97a3c3b05e875ba95c7ead80ad6",
            "version": 2,
            "size": 509,
            "vsize": 509,
            "weight": 2036,
            "locktime": 0,
            "vin": [
                {
                    "txid": "a34345f69e5beb3618dfca9a22326f6e978d5ec6ab5d5c57e685e6f812cd628d",
                    "vout": 1,
                    "scriptSig": {
                        "asm": "3045022100ab8ba8a45d06cf6c015ef2e55ce808d122db56ab849551fad9c55470edee6243022037dfa3c3a1a70eff78ef68dd0afe2f19f7cdae9ab3b918fb6652a78bbdc8261b[ALL] 037dc0b2a7b076aa8f963f11b5bf445ebb754e7fbd2d4bd55074e452e031b273c9",
                        "hex": "483045022100ab8ba8a45d06cf6c015ef2e55ce808d122db56ab849551fad9c55470edee6243022037dfa3c3a1a70eff78ef68dd0afe2f19f7cdae9ab3b918fb6652a78bbdc8261b0121037dc0b2a7b076aa8f963f11b5bf445ebb754e7fbd2d4bd55074e452e031b273c9"
                    },
                    "sequence": 4294967295
                },
                {
                    "txid": "a34345f69e5beb3618dfca9a22326f6e978d5ec6ab5d5c57e685e6f812cd628d",
                    "vout": 2,
                    "scriptSig": {
                        "asm": "304402201d2c90bef4d71ba7bd8351cbb0c0216fb503f39a8ba87d24169a2ff1798fbd2e02201d833f2e3627b40c06d12bc42110161cd86c5d1a0d20eee72d2665942c3ad1a8[ALL] 03e4cf2378adbb15102a6845157cd47fd5a39bb73bfe3c8ea4611e85ee0ae2dd04",
                        "hex": "47304402201d2c90bef4d71ba7bd8351cbb0c0216fb503f39a8ba87d24169a2ff1798fbd2e02201d833f2e3627b40c06d12bc42110161cd86c5d1a0d20eee72d2665942c3ad1a8012103e4cf2378adbb15102a6845157cd47fd5a39bb73bfe3c8ea4611e85ee0ae2dd04"
                    },
                    "sequence": 4294967295
                }
            ],
            "vout": [
                {
                    "value": 0.20000000,
                    "n": 0,
                    "scriptPubKey": {
                        "asm": "OP_DUP OP_HASH160 b31136109e058d290739494275db5b720eee3fa2 OP_EQUALVERIFY OP_CHECKSIG",
                        "hex": "76a914b31136109e058d290739494275db5b720eee3fa288ac",
                        "type": "pubkeyhash",
                        "address": "mwqmsFERSftPpq96o4FoCwPH4fU4iJyTLZ"
                    }
                },
                {
                    "value": 0.20000000,
                    "n": 1,
                    "scriptPubKey": {
                        "asm": "OP_DUP OP_HASH160 6c0581c57f1fdd9e93f99d8cc3dc5b77c0c114e7 OP_EQUALVERIFY OP_CHECKSIG",
                        "hex": "76a9146c0581c57f1fdd9e93f99d8cc3dc5b77c0c114e788ac",
                        "type": "pubkeyhash",
                        "address": "mqN7sQ7AsWA7HKXQ3D4bM3qp4QEBX2JXXp"
                    }
                },
                {
                    "value": 0.20000000,
                    "n": 2,
                    "scriptPubKey": {
                        "asm": "OP_DUP OP_HASH160 1926e280d26536c41f165d4567a91c61eda34f3b OP_EQUALVERIFY OP_CHECKSIG",
                        "hex": "76a9141926e280d26536c41f165d4567a91c61eda34f3b88ac",
                        "type": "pubkeyhash",
                        "address": "mhowmcRTByg5CLGFN5uWjMmD4bxUSfytvU"
                    }
                },
                {
                    "value": 0.20000000,
                    "n": 3,
                    "scriptPubKey": {
                        "asm": "OP_DUP OP_HASH160 f79b636b11f558cfa50b117165fe19a82e30f11d OP_EQUALVERIFY OP_CHECKSIG",
                        "hex": "76a914f79b636b11f558cfa50b117165fe19a82e30f11d88ac",
                        "type": "pubkeyhash",
                        "address": "n46BM1Rec28gU4xSEELmHcqbSGvtJR2XqK"
                    }
                },
                {
                    "value": 0.20000000,
                    "n": 4,
                    "scriptPubKey": {
                        "asm": "OP_DUP OP_HASH160 b0c3cec55149984f349f65666451dc283e48205e OP_EQUALVERIFY OP_CHECKSIG",
                        "hex": "76a914b0c3cec55149984f349f65666451dc283e48205e88ac",
                        "type": "pubkeyhash",
                        "address": "mwdbnmpXabKaLZXuaF3xiCr8RCp7SguyWp"
                    }
                },
                {
                    "value": 0.99990000,
                    "n": 5,
                    "scriptPubKey": {
                        "asm": "OP_DUP OP_HASH160 2d5e3313109ec1b49d8c758881abc9ee5722ee0e OP_EQUALVERIFY OP_CHECKSIG",
                        "hex": "76a9142d5e3313109ec1b49d8c758881abc9ee5722ee0e88ac",
                        "type": "pubkeyhash",
                        "address": "mjeqYnNUstuceEa8ES5gHqTz34Ysyeqyys"
                    }
                }
            ],
            "confirmations": 1
        }
    },
    "cb5713d8dc0d5825c8bd2f391e6bd0a9f9c0d3164dd1d594959094e27d34d460": {
        tx: {
            txid: "cb5713d8dc0d5825c8bd2f391e6bd0a9f9c0d3164dd1d594959094e27d34d460",
            confirmations: 1,
            hex: "02000000018d62cd12f8e685e6575c5dabc65e8d976e6f32229acadf1836eb5b9ef64543a3000000006a4730440220601618ec0c6051822db73ca412037ba04601cf25e8ffb6a6f2f83c8b1d16a5a30220266009ef30277e0cf247d2bcb65988557f061dfee3787015c058c619fe622f89012102e4b03d40984db90ee71c343a4e94711d1a9afc0c6cdbf033baf675fb625e6351ffffffff0680969800000000001976a91499378b928158b765f779d1a997b017db000f3fb288ac80969800000000001976a914cf6bc15e0d770e5a65619930a705b2d15ba5939288ac80969800000000001976a9146a2f2033d57c191c2581f9c830d7b99ca5e5941188ac80969800000000001976a914a2bd256752b8f8ae144195eeeaba2614752784ba88ac80969800000000001976a9143c23a1a9e6e5f948060a1d36154dda763d5b952488ac70c9fa02000000001976a914a356301a14af2599a6b17a1e2ace3b3a339afcb588ac00000000"
        },
        decoded: {
            "txid": "cb5713d8dc0d5825c8bd2f391e6bd0a9f9c0d3164dd1d594959094e27d34d460",
            "hash": "cb5713d8dc0d5825c8bd2f391e6bd0a9f9c0d3164dd1d594959094e27d34d460",
            "version": 2,
            "size": 361,
            "vsize": 361,
            "weight": 1444,
            "locktime": 0,
            "vin": [
                {
                    "txid": "a34345f69e5beb3618dfca9a22326f6e978d5ec6ab5d5c57e685e6f812cd628d",
                    "vout": 0,
                    "scriptSig": {
                        "asm": "30440220601618ec0c6051822db73ca412037ba04601cf25e8ffb6a6f2f83c8b1d16a5a30220266009ef30277e0cf247d2bcb65988557f061dfee3787015c058c619fe622f89[ALL] 02e4b03d40984db90ee71c343a4e94711d1a9afc0c6cdbf033baf675fb625e6351",
                        "hex": "4730440220601618ec0c6051822db73ca412037ba04601cf25e8ffb6a6f2f83c8b1d16a5a30220266009ef30277e0cf247d2bcb65988557f061dfee3787015c058c619fe622f89012102e4b03d40984db90ee71c343a4e94711d1a9afc0c6cdbf033baf675fb625e6351"
                    },
                    "sequence": 4294967295
                }
            ],
            "vout": [
                {
                    "value": 0.10000000,
                    "n": 0,
                    "scriptPubKey": {
                        "asm": "OP_DUP OP_HASH160 99378b928158b765f779d1a997b017db000f3fb2 OP_EQUALVERIFY OP_CHECKSIG",
                        "hex": "76a91499378b928158b765f779d1a997b017db000f3fb288ac",
                        "type": "pubkeyhash",
                        "address": "muV6DkbkJreV43PcWCKeU8pak516kanoCy"
                    }
                },
                {
                    "value": 0.10000000,
                    "n": 1,
                    "scriptPubKey": {
                        "asm": "OP_DUP OP_HASH160 cf6bc15e0d770e5a65619930a705b2d15ba59392 OP_EQUALVERIFY OP_CHECKSIG",
                        "hex": "76a914cf6bc15e0d770e5a65619930a705b2d15ba5939288ac",
                        "type": "pubkeyhash",
                        "address": "mzRhFjbn1zyLaN5kWypCxLVydorveeZQwC"
                    }
                },
                {
                    "value": 0.10000000,
                    "n": 2,
                    "scriptPubKey": {
                        "asm": "OP_DUP OP_HASH160 6a2f2033d57c191c2581f9c830d7b99ca5e59411 OP_EQUALVERIFY OP_CHECKSIG",
                        "hex": "76a9146a2f2033d57c191c2581f9c830d7b99ca5e5941188ac",
                        "type": "pubkeyhash",
                        "address": "mqCQNkBna1LvV9rnkfaQFQvvniaCX9YUcu"
                    }
                },
                {
                    "value": 0.10000000,
                    "n": 3,
                    "scriptPubKey": {
                        "asm": "OP_DUP OP_HASH160 a2bd256752b8f8ae144195eeeaba2614752784ba OP_EQUALVERIFY OP_CHECKSIG",
                        "hex": "76a914a2bd256752b8f8ae144195eeeaba2614752784ba88ac",
                        "type": "pubkeyhash",
                        "address": "mvMSMESShzK61qfqUbzYGPboWNPXgN3CTw"
                    }
                },
                {
                    "value": 0.10000000,
                    "n": 4,
                    "scriptPubKey": {
                        "asm": "OP_DUP OP_HASH160 3c23a1a9e6e5f948060a1d36154dda763d5b9524 OP_EQUALVERIFY OP_CHECKSIG",
                        "hex": "76a9143c23a1a9e6e5f948060a1d36154dda763d5b952488ac",
                        "type": "pubkeyhash",
                        "address": "mkzwXHQtqViJ7QJM8qtdMwubBx951DT3Dq"
                    }
                },
                {
                    "value": 0.49990000,
                    "n": 5,
                    "scriptPubKey": {
                        "asm": "OP_DUP OP_HASH160 a356301a14af2599a6b17a1e2ace3b3a339afcb5 OP_EQUALVERIFY OP_CHECKSIG",
                        "hex": "76a914a356301a14af2599a6b17a1e2ace3b3a339afcb588ac",
                        "type": "pubkeyhash",
                        "address": "mvQbgmBML6nLmjCNhDTQZvTcqqMg46yiKV"
                    }
                }
            ],
            "confirmations": 1
        }
    }
};

function resetBitcoinCore(mempool, txs) {
    if (!BitcoinCore.prototype.origMethods) {
        BitcoinCore.prototype.origMethods = {};
    }

    if (mempool) {
        if (!BitcoinCore.prototype.origMethods.getMempoolEntry) {
            // Save original method
            BitcoinCore.prototype.origMethods.getMempoolEntry = BitcoinCore.prototype.getMempoolEntry;
        }

        if (!BitcoinCore.prototype.origMethods.getMempoolAncestors) {
            // Save original method
            BitcoinCore.prototype.origMethods.getMempoolAncestors = BitcoinCore.prototype.getMempoolAncestors;
        }

        // Replace with test method
        BitcoinCore.prototype.getMempoolEntry = genTestGetMempoolEntry(mempool);
        BitcoinCore.prototype.getMempoolAncestors = genTestGetMempoolAncestors(mempool);
    }
    else {
        if (BitcoinCore.prototype.origMethods.getMempoolEntry) {
            // Restore original method
            BitcoinCore.prototype.getMempoolEntry = BitcoinCore.prototype.origMethods.getMempoolEntry;
            BitcoinCore.prototype.origMethods.getMempoolEntry = undefined;
        }

        if (BitcoinCore.prototype.origMethods.getMempoolAncestors) {
            // Restore original method
            BitcoinCore.prototype.getMempoolAncestors = BitcoinCore.prototype.origMethods.getMempoolAncestors;
            BitcoinCore.prototype.origMethods.getMempoolAncestors = undefined;
        }
    }

    if (txs) {
        if (!BitcoinCore.prototype.origMethods.getTransaction) {
            // Save original method
            BitcoinCore.prototype.origMethods.getTransaction = BitcoinCore.prototype.getTransaction;
        }

        if (!BitcoinCore.prototype.origMethods.getDecodedRawTransactionCheck) {
            // Save original method
            BitcoinCore.prototype.origMethods.getDecodedRawTransactionCheck = BitcoinCore.prototype.getDecodedRawTransactionCheck;
        }

        // Replace with test method
        BitcoinCore.prototype.getTransaction = genTestGetTransaction(txs);
        BitcoinCore.prototype.getDecodedRawTransactionCheck = genTestGetDecodedRawTransactionCheck(txs);
    }
    else {
        if (BitcoinCore.prototype.origMethods.getTransaction) {
            // Restore original method
            BitcoinCore.prototype.getTransaction = BitcoinCore.prototype.origMethods.getTransaction;
            BitcoinCore.prototype.origMethods.getTransaction = undefined;
        }

        if (BitcoinCore.prototype.origMethods.getDecodedRawTransactionCheck) {
            // Restore original method
            BitcoinCore.prototype.getDecodedRawTransactionCheck = BitcoinCore.prototype.origMethods.getDecodedRawTransactionCheck;
            BitcoinCore.prototype.origMethods.getDecodedRawTransactionCheck = undefined;
        }
    }
}

function resetC3NodeClient(utxos) {
    if (!C3NodeClient.prototype.origMethods) {
        C3NodeClient.prototype.origMethods = {};
    }

    if (utxos) {
        if (!C3NodeClient.prototype.origMethods.getAddressesUtxos) {
            // Save original method
            C3NodeClient.prototype.origMethods.getAddressesUtxos = C3NodeClient.prototype.getAddressesUtxos;
        }

        // Replace with test method
        C3NodeClient.prototype.getAddressesUtxos = genTestGetAddressesUtxos(utxos);
    }
    else if (C3NodeClient.prototype.origMethods.getAddressesUtxos) {
        // Restore original method
        C3NodeClient.prototype.getAddressesUtxos = C3NodeClient.prototype.origMethods.getAddressesUtxos;
        C3NodeClient.prototype.origMethods.getAddressesUtxos = undefined;
    }
}

function genTestGetTransaction(txs) {
    return function testGetTransaction(txid) {
        const txInfo = txs[txid];

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

function genTestGetDecodedRawTransactionCheck(txs) {
    return function testGetDecodedRawTransactionCheck(txid) {
        const txInfo = txs[txid];

        if (!txInfo || !txInfo.decoded) {
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

        return txInfo.decoded;
    }
}

function genTestGetMempoolEntry(mempool) {
    return function testGetMempoolEntry(txid) {
        const mempoolEntry = mempool[txid];

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

function genTestGetMempoolAncestors(mempool) {
    return function testGetMempoolAncestors(txid, verbose) {
        const ancestorTxids = getAncestorTxids(mempool, txid);

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

            ancestorTxids.forEach(txid => result[txid] = mempool[txid]);
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

function genTestGetAddressesUtxos(utxos) {
    return function testGetAddressesUtxos(addresses, numOfConfirmations) {
        if (!Array.isArray(addresses)) {
            addresses = [addresses];
        }

        const setAddresses = new Set(addresses);

        return utxos.filter(function (utxo) {
            return (!numOfConfirmations || utxo.confirmations >= numOfConfirmations) && (!setAddresses || setAddresses.has(utxo.address));
        });
    };
}
