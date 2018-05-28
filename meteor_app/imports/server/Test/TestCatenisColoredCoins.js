import {Catenis} from '../Catenis'
import {FundSource} from '../FundSource'
import {CCTransaction} from '../CCTransaction'
import {CCMetadata} from '../CCMetadata'
import {Transaction} from '../Transaction'

export class TestCatenisColoredCoins {
    constructor() {}

    init() {
        this.fundSrc = new FundSource(Catenis.ctnHubNode.payTxExpenseAddr.listAddressesInUse()[0]);

        this.inputs = this.fundSrc.collUtxo.find().map(utxo=>{return {txout: {txid: utxo.txid, vout: utxo.vout, amount: utxo.amount}, address: utxo.address, addrInfo: Catenis.keyStore.getAddressInfo(utxo.address)}});

        this.outAddrs = Catenis.ctnHubNode.payTxExpenseAddr.listAddressesInUse();

        this.ccMeta = new CCMetadata();

        this.ccMeta.setAssetMetadata({ctnAssetId:'fjkajfkjfjdslj'});

        this.txids = ['6062e56442ebe60df16b5348fa4dba4c7ff2f95a65377c4f1adce89b3412de85','ecc8cdd2f3aaff6d95a6d520a7cb4b3955b119285d9b88bff4e6e2902288a0b3'];

        this.ccMeta.setFreeUserData('txids',new Buffer(JSON.stringify(this.txids)),true);
    }

    isInitialized() {
        return this.ccMeta !== undefined;
    }

    testIssuance(metadataStorage = TestCatenisColoredCoins.metadataStorage.nullDataOnly) {
        if (this.isInitialized()) {
            this.ccTransact = new CCTransaction();

            this.ccTransact.addIssuingInput(this.inputs[0].txout, this.inputs[0].address, this.inputs[0].addrInfo, 123456789);

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
                this.ccTransact.setTransferOutput(this.outAddrs[idx], 123456, 0)
            }

            this.ccTransact.setChangeTransferOutput(this.outAddrs[idx], 0);

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
}

TestCatenisColoredCoins.metadataStorage = {
    nullDataOnly: 'nulldata',
    nullDataMultiSig: 'mixed',
    multiSigOnly: 'multisig'
};