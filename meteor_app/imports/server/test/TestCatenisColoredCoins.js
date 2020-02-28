import { Catenis } from '../Catenis';
import { FundSource } from '../FundSource';
import { CCTransaction } from '../CCTransaction';
import { CCMetadata } from '../CCMetadata';
import { Transaction } from '../Transaction';
import { C3NodeClient } from '../C3NodeClient';

export class TestCatenisColoredCoins {
    constructor() {
        this.resetMetadata();
    }

    // Note: this method should be called before calling a different test method. Failure to do so will result
    //      in an error when trying to decrypt the metadata user data (since the crypto key used to decrypt is
    //      different from the crypto key used to encrypt -- this is due to the fact that the UTXO spent by the
    //      first input of the tx issued by the testIssuance method is different from the UTXO spent by the
    //      first input of the tx issued by the testTransfer method)
    resetMetadata() {
        this.ccMeta = new CCMetadata();

        this.ccMeta.setAssetMetadata({ctnAssetId:'fjkajfkjfjdslj'});

        const txids = ['6062e56442ebe60df16b5348fa4dba4c7ff2f95a65377c4f1adce89b3412de85','ecc8cdd2f3aaff6d95a6d520a7cb4b3955b119285d9b88bff4e6e2902288a0b3'];

        this.ccMeta.setFreeUserData('txids',new Buffer(JSON.stringify(txids)),true);
    }

    testIssuance(metadataStorage = TestCatenisColoredCoins.metadataStorage.nullDataOnly) {
        if (TestCatenisColoredCoins.isInitialized()) {
            this.ccTransact = new CCTransaction();

            this.ccTransact.addIssuingInput(TestCatenisColoredCoins.inputs[0].txout, {
                isWitness: TestCatenisColoredCoins.inputs[0].isWitness,
                scriptPubKey: TestCatenisColoredCoins.inputs[0].scriptPubKey,
                address: TestCatenisColoredCoins.inputs[0].address,
                addrInfo: TestCatenisColoredCoins.inputs[0].addrInfo
            }, 123456789);

            let limit = 0;

            if (typeof metadataStorage === 'string') {
                switch (metadataStorage) {
                    case TestCatenisColoredCoins.metadataStorage.nullDataOnly:
                        limit = 1;
                        break;

                    case TestCatenisColoredCoins.metadataStorage.nullDataMultiSig:
                        limit = 14;
                        break;

                    case TestCatenisColoredCoins.metadataStorage.multiSigOnly:
                        limit = 16;
                        break;

                    default:
                        throw new Error('TestCatenisColoredCoins: invalid metadata storage');
                }
            }
            else if (typeof metadataStorage === 'number' && Number.isInteger(metadataStorage) && metadataStorage <= 16) {
                limit = metadataStorage;
            }
            else {
                throw new Error('TestCatenisColoredCoins: invalid metadata storage');
            }

            let idx = 0;

            for (; idx < limit; idx++) {
                this.ccTransact.setTransferOutput(TestCatenisColoredCoins.outAddrs[idx], 123456, 0)
            }

            this.ccTransact.setChangeTransferOutput(TestCatenisColoredCoins.outAddrs[idx], 0);

            this.ccTransact.setCcMetadata(this.ccMeta);

            this.ccTransact.assemble();

            this.ccTransact.getTransaction();

            this.transact2 = Transaction.fromHex(this.ccTransact.rawTransaction);

            this.ccTransact2 = CCTransaction.fromTransaction(this.transact2);
        }
        else {
            throw new Error('TestCatenisColoredCoins: test not initialized yet');
        }
    }

    testTransfer(metadataStorage = TestCatenisColoredCoins.metadataStorage.nullDataOnly) {
        if (TestCatenisColoredCoins.isInitialized()) {
            this.ccTransact = new CCTransaction();

            this.ccTransact.addTransferInput(TestCatenisColoredCoins.assetInput.txout, {
                isWitness: TestCatenisColoredCoins.assetInput.isWitness,
                scriptPubKey: TestCatenisColoredCoins.assetInput.scriptPubKey,
                address: TestCatenisColoredCoins.assetInput.address,
                addrInfo: TestCatenisColoredCoins.assetInput.addrInfo
            });

            let limit = 0;

            if (typeof metadataStorage === 'string') {
                switch (metadataStorage) {
                    case TestCatenisColoredCoins.metadataStorage.nullDataOnly:
                        limit = 1;
                        break;

                    case TestCatenisColoredCoins.metadataStorage.nullDataMultiSig:
                        limit = 14;
                        break;

                    case TestCatenisColoredCoins.metadataStorage.multiSigOnly:
                        // NOTE: this will still leave 1 byte of metadata in the null data output, but is the best that we can do
                        limit = 17;
                        break;

                    default:
                        throw new Error('TestCatenisColoredCoins: invalid metadata storage');
                }
            }
            else if (typeof metadataStorage === 'number' && Number.isInteger(metadataStorage) && metadataStorage > 0) {
                limit = metadataStorage;
            }
            else {
                throw new Error('TestCatenisColoredCoins: invalid metadata storage');
            }

            let idx = 0;

            for (; idx < limit; idx++) {
                if (idx === 1) {
                    this.ccTransact.setBurnOutput(123456, 0);
                }
                else {
                    this.ccTransact.setTransferOutput(TestCatenisColoredCoins.outAddrs[idx], 123456, 0);
                }
            }

            this.ccTransact.setChangeTransferOutput(TestCatenisColoredCoins.outAddrs[idx], 0);

            this.ccTransact.setCcMetadata(this.ccMeta);

            this.ccTransact.assemble();

            this.ccTransact.getTransaction();

            this.transact2 = Transaction.fromHex(this.ccTransact.rawTransaction);

            this.ccTransact2 = CCTransaction.fromTransaction(this.transact2);
        }
        else {
            throw new Error('TestCatenisColoredCoins: test not initialized yet');
        }
    }

    static init() {
        const fundSrc = new FundSource(Catenis.ctnHubNode.listFundingAddressesInUse(),{});

        const utxo = fundSrc.collUtxo.find()[0];

        TestCatenisColoredCoins.assetInput = {
            txout: {
                txid: utxo.txid,
                vout: utxo.vout,
                amount: utxo.amount,
                ccAssetId:'La8KNZTWQJGEUYfzxSEugGwpDQRUE8JCMeRSXE',
                assetAmount: 123456789,
                assetDivisibility: 4,
                isAggregatableAsset: true
            },
            isWitness: utxo.isWitness,
            scriptPubKey: utxo.scriptPubKey,
            address: utxo.address,
            addrInfo: Catenis.keyStore.getAddressInfo(utxo.address)
        };

        const fundSrc2 = new FundSource(Catenis.ctnHubNode.payTxExpenseAddr.listAddressesInUse()[0]);

        TestCatenisColoredCoins.inputs = fundSrc2.collUtxo.find().map(utxo => {
            return {
                txout: {
                    txid: utxo.txid,
                    vout: utxo.vout,
                    amount: utxo.amount
                },
                isWitness: utxo.isWitness,
                scriptPubKey: utxo.scriptPubKey,
                address: utxo.address,
                addrInfo: Catenis.keyStore.getAddressInfo(utxo.address)
            }
        });

        TestCatenisColoredCoins.outAddrs = Catenis.ctnHubNode.payTxExpenseAddr.listAddressesInUse();

        resetC3NodeClient();
    }

    static isInitialized() {
        return TestCatenisColoredCoins.assetInput != undefined && TestCatenisColoredCoins.inputs !== undefined && TestCatenisColoredCoins.outAddrs !== undefined;
    }
}

function resetC3NodeClient() {
    C3NodeClient.prototype.originalGetTxouts = C3NodeClient.prototype.getTxouts;
    C3NodeClient.prototype.getTxouts = function testGetTxouts (utxos, numOfConfirmations, waitForParsing = true) {
        if (!Array.isArray(utxos)) {
            utxos = [utxos];
        }

        if (utxos.some(utxo => utxo.txid === TestCatenisColoredCoins.assetInput.txout.txid && utxo.vout === TestCatenisColoredCoins.assetInput.txout.vout)) {
            return [{
                assets: [{
                    assetId: 'La8KNZTWQJGEUYfzxSEugGwpDQRUE8JCMeRSXE',
                    amount: 123456789,
                    divisibility: 4,
                    aggregationPolicy: CCTransaction.aggregationPolicy.aggregatable
                }]
            }]
        }
        else {
            return this.originalGetTxouts(utxos, numOfConfirmations, waitForParsing);
        }
    };

    // Reinitialize module with new prototype function
    C3NodeClient.initialize();
}

TestCatenisColoredCoins.metadataStorage = {
    nullDataOnly: 'nulldata',
    nullDataMultiSig: 'mixed',
    multiSigOnly: 'multisig'
};