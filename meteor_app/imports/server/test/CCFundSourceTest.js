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
import { Catenis } from '../Catenis';
import { BitcoinCore } from '../BitcoinCore';
import { C3NodeClient } from '../C3NodeClient';
import { CCTransaction } from '../CCTransaction';
import { CCFundSource } from '../CCFundSource';
import { AncestorTransactions } from '../AncestorTransactions';


describe('CCFundSource module', function () {
    describe('instance including unconfirmed UTXOs with recently confirmed txs', function () {
        let ccFundSrc;

        before(function () {
            resetBitcoinCore(mempoolTestData2, recentlyConfTxsTestData1);
            BitcoinCore.initialize();
            resetC3NodeClient(utxosTestData1);
            C3NodeClient.initialize();

            ccFundSrc = new CCFundSource('La8KNZTWQJGEUYfzxSEugGwpDQRUE8JCMeRSXE', 'mrH6bWqKTyntpF9wi7mui4NYxo85frL9X6', {
                unconfUtxoInfo: {}
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
                unconfUtxoInfo: {}
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
                unconfUtxoInfo: {},
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
                unconfUtxoInfo: {},
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
});

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
        "spendable": true,
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
        "spendable": true,
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
        "spendable": true,
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
        "spendable": true,
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
        "spendable": true,
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
        "spendable": true,
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
        "spendable": true,
        "assets": [{
            assetId: 'La8KNZTWQJGEUYfzxSEugGwpDQRUE8JCMeRSXE',
            amount: 1200,
            divisibility: 0,
            aggregationPolicy: CCTransaction.aggregationPolicy.aggregatable
        }]
    }
];

const mempoolTestData1 = {
    "a34345f69e5beb3618dfca9a22326f6e978d5ec6ab5d5c57e685e6f812cd628d": {
        "size": 497,
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
        "size": 361,
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
        "size": 509,
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
        "size": 474,
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
        "size": 475,
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
        "size": 497,
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
        "size": 509,
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
        "size": 475,
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

// Simulate that one UTXO have been recently confirmed and the other had been recently replaced
const recentlyConfTxsTestData1 = {
    "cb5713d8dc0d5825c8bd2f391e6bd0a9f9c0d3164dd1d594959094e27d34d460": {
        txid: "cb5713d8dc0d5825c8bd2f391e6bd0a9f9c0d3164dd1d594959094e27d34d460",
        confirmations: 1
    },
    "3d7b9563008b95c25cdd67ab35f256f228d0edb1a2ab8c9110d2a09a2345d373": {
        txid: "cb5713d8dc0d5825c8bd2f391e6bd0a9f9c0d3164dd1d594959094e27d34d460",
        confirmations: -1
    }
};

function resetBitcoinCore(mempool, recentlyConfTxs) {
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

    if (recentlyConfTxs) {
        if (!BitcoinCore.prototype.origMethods.getTransaction) {
            // Save original method
            BitcoinCore.prototype.origMethods.getTransaction = BitcoinCore.prototype.getTransaction;
        }

        // Replace with test method
        BitcoinCore.prototype.getTransaction = genTestGetTransaction(recentlyConfTxs);
    }
    else if (BitcoinCore.prototype.origMethods.getTransaction) {
        // Restore original method
        BitcoinCore.prototype.getTransaction = BitcoinCore.prototype.origMethods.getTransaction;
        BitcoinCore.prototype.origMethods.getTransaction = undefined;
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

function genTestGetTransaction(recentlyConfTxs) {
    return function testGetTransaction(txid) {
        const txInfo = recentlyConfTxs[txid];

        if (!txInfo) {
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

        return txInfo;
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
