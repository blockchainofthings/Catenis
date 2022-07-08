/**
 * Created by claudio on 2022-07-01
 */

//console.log('[RetrievedNFTokenDataTest.js]: This code just ran.');

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
import { Catenis } from '../Catenis';
import { NFTokenRetrieval } from '../NFTokenRetrieval';
import { RetrievedNFTokenData } from '../RetrievedNFTokenData';
import { EccLibraryProxy } from '../EccLibraryProxy';
import { Bip32 } from '../Bip32';
import { KeyStore } from '../KeyStore';
import { BitcoinInfo } from '../BitcoinInfo';
import { CatenisNode } from '../CatenisNode';

const clientIndex = 123;


describe('RetrievedNFTokenData module', function () {
    const deviceIndex = 1;
    const devAssetAddresssKeys = [];

    before(function () {
        EccLibraryProxy.initialize();
        Bip32.initialize();
        KeyStore.initialize();
        CatenisNode.initialize();

        Catenis.keyStore.initClientHDNodes(Catenis.application.ctnNode.index, clientIndex);
        Catenis.keyStore.initDeviceHDNodes(Catenis.application.ctnNode.index, clientIndex, deviceIndex);

        for (let addrIndex = 0; addrIndex < 1; addrIndex++) {
            devAssetAddresssKeys.push(
                Catenis.keyStore.getDeviceAssetAddressKeys(
                    Catenis.application.ctnNode.index,
                    clientIndex,
                    deviceIndex,
                    addrIndex,
                    BitcoinInfo.addressType.witness_v0_keyhash
                )
            );
        }

        resetCatenisNode();
    });

    describe('non-fungible token metadata, final', function () {
        let nfTokenRetrieval;
        let retrievedNFTokenData;
        let metadata;

        before(function () {
            // Simulate non-fungible token retrieval database doc/rec
            const doc = {
                tokenRetrievalId: 'r00001',
                deviceId: 'd00001',
                tokenId: 't00001',
                holdingAddressPath: Catenis.keyStore.getAddressInfo(devAssetAddresssKeys[0].getAddress()).path,
                retrieveContents: true,
                contentsOptions: {
                    contentsOnly: false,
                    encoding: 'base64'
                },
                progress: {
                    metadataBytesRetrieved: 0,
                    contentsBytesRetrieved: 0,
                    done: false
                },
                createdDate: new Date()
            };
            doc._id = Catenis.db.collection.NonFungibleTokenRetrieval.insert(doc);

            nfTokenRetrieval = new NFTokenRetrieval(doc);
            metadata = {
                name: 'Test NFT #1',
                description: 'Non-fungible token #1 used for testing',
                contentsEncrypted: false,
                contents: 'https://ipfs.catenis.io/ipfs/QmUkhVi6zRJz5U87jUjK9ZGTazaXLDKLfGbMRHxiai5xUn',
                custom: {
                    custom1: 'Custom property #1',
                    custom2: 'Custom property #2'
                }
            };
        });

        it('should fail to instantiate retrieved non-fungible token data object with invalid params (nfTokenRetrieval)', function () {
            expect(() => {
                new RetrievedNFTokenData(undefined, {});
            })
            .to.throw(Error, 'Invalid nfTokenRetrieval argument');
        });

        it('should successfully instantiate retrieved non-fungible token data object', function () {
            expect(() => {
                retrievedNFTokenData = new RetrievedNFTokenData(undefined, nfTokenRetrieval);
            })
            .not.to.throw();

            expect(retrievedNFTokenData).to.be.an.instanceof(RetrievedNFTokenData);
            expect(retrievedNFTokenData.nonFungibleTokenRetrieval_id).to.equal(nfTokenRetrieval.doc_id);
            expect(retrievedNFTokenData._isSavedToDB).to.be.false;
            expect(retrievedNFTokenData.nfTokenRetrieval).to.equal(nfTokenRetrieval);
            expect(retrievedNFTokenData.continuationToken).to.be.undefined;
            expect(retrievedNFTokenData.metadata).to.be.undefined;
            expect(retrievedNFTokenData.contentsData).to.be.undefined;
            expect(retrievedNFTokenData.metadataSaved).to.be.false;
            expect(retrievedNFTokenData.contentsDataSaved).to.be.false;
        });

        it('should successfully save the metadata', function () {
            expect(() => {
                retrievedNFTokenData.saveMetadata(metadata, true);
            })
            .not.to.throw();

            expect(retrievedNFTokenData.retrievedNFTokenDataId).to.match(/^e[\dA-Za-z]{19}$/);
            expect(retrievedNFTokenData.order).to.be.a('number').that.is.greaterThan(0);
            expect(retrievedNFTokenData.isFinal).to.be.true;
            expect(retrievedNFTokenData.createdDate).to.be.a('date');
            expect(retrievedNFTokenData._isSavedToDB).to.be.true;
            expect(retrievedNFTokenData.continuationToken).to.be.a('string').that.matches(/^e[\dA-Za-z]{19}$/);
            expect(retrievedNFTokenData.metadata).to.equal(metadata);
            expect(retrievedNFTokenData.contentsData).to.be.null;
            expect(retrievedNFTokenData.metadataSaved).to.be.true;
            expect(retrievedNFTokenData.contentsDataSaved).to.be.false;
        });

        it('should fail trying to save more data', function () {
            expect(() => {
                retrievedNFTokenData.saveMetadata({});
            })
            .to.throw(Error, 'Unable to save non-fungible token metadata: non-fungible token data already saved');

            expect(() => {
                retrievedNFTokenData.saveContentsData(Buffer.from('test'));
            })
            .to.throw(Error, 'Unable to save non-fungible token metadata: non-fungible token data already saved');
        });

        it('should correctly instantiate retrieved non-fungible token data from the database', function () {
            const doc = Catenis.db.collection.RetrievedNonFungibleTokenData.findOne({_id: retrievedNFTokenData.doc_id});

            let retrievedNFTokenDataDB;

            expect(() => {
                retrievedNFTokenDataDB = new RetrievedNFTokenData(doc);
            })
            .not.to.throw();

            expect(retrievedNFTokenDataDB).to.be.an.instanceof(RetrievedNFTokenData);
            expect(retrievedNFTokenDataDB).to.deep.include({
                doc_id: retrievedNFTokenData.doc_id,
                retrievedNFTokenDataId: retrievedNFTokenData.retrievedNFTokenDataId,
                nonFungibleTokenRetrieval_id: retrievedNFTokenData.nonFungibleTokenRetrieval_id,
                order: retrievedNFTokenData.order,
                isFinal: retrievedNFTokenData.isFinal,
                createdDate: retrievedNFTokenData.createdDate,
            });
            expect(retrievedNFTokenDataDB.nfTokenRetrieval).to.be.an.instanceof(NFTokenRetrieval)
            .with.property('tokenRetrievalId', retrievedNFTokenData.nfTokenRetrieval.tokenRetrievalId);
            expect(retrievedNFTokenDataDB.metadata).to.deep.equal(retrievedNFTokenData.metadata);
            expect(retrievedNFTokenDataDB.contentsData).to.deep.equal(retrievedNFTokenData.contentsData);
        });
    });

    describe('non-fungible token contents data, not final', function () {
        let nfTokenRetrieval;
        let retrievedNFTokenData;
        let contentsData;

        before(function () {
            // Simulate non-fungible token retrieval database doc/rec
            const doc = {
                tokenRetrievalId: 'r00002',
                deviceId: 'd00001',
                tokenId: 't00001',
                holdingAddressPath: Catenis.keyStore.getAddressInfo(devAssetAddresssKeys[0].getAddress()).path,
                retrieveContents: true,
                contentsOptions: {
                    contentsOnly: false,
                    encoding: 'base64'
                },
                progress: {
                    metadataBytesRetrieved: 0,
                    contentsBytesRetrieved: 0,
                    done: false
                },
                createdDate: new Date()
            };
            doc._id = Catenis.db.collection.NonFungibleTokenRetrieval.insert(doc);

            nfTokenRetrieval = new NFTokenRetrieval(doc);
            contentsData = Buffer.from('Contents for non-fungible token #1');
        });

        it('should successfully instantiate retrieved non-fungible token data object', function () {
            expect(() => {
                retrievedNFTokenData = new RetrievedNFTokenData(undefined, nfTokenRetrieval);
            })
            .not.to.throw();

            expect(retrievedNFTokenData).to.be.an.instanceof(RetrievedNFTokenData);
            expect(retrievedNFTokenData.nonFungibleTokenRetrieval_id).to.equal(nfTokenRetrieval.doc_id);
            expect(retrievedNFTokenData._isSavedToDB).to.be.false;
            expect(retrievedNFTokenData.nfTokenRetrieval).to.equal(nfTokenRetrieval);
            expect(retrievedNFTokenData.continuationToken).to.be.undefined;
            expect(retrievedNFTokenData.metadata).to.be.undefined;
            expect(retrievedNFTokenData.contentsData).to.be.undefined;
            expect(retrievedNFTokenData.metadataSaved).to.be.false;
            expect(retrievedNFTokenData.contentsDataSaved).to.be.false;
        });

        it('should successfully save the contents data', function () {
            expect(() => {
                retrievedNFTokenData.saveContentsData(contentsData, false);
            })
            .not.to.throw();

            expect(retrievedNFTokenData.retrievedNFTokenDataId).to.match(/^e[\dA-Za-z]{19}$/);
            expect(retrievedNFTokenData.order).to.be.a('number').that.is.greaterThan(0);
            expect(retrievedNFTokenData.isFinal).to.be.false;
            expect(retrievedNFTokenData.createdDate).to.be.a('date');
            expect(retrievedNFTokenData._isSavedToDB).to.be.true;
            expect(retrievedNFTokenData.continuationToken).to.be.a('string').that.matches(/^e[\dA-Za-z]{19}$/);
            expect(retrievedNFTokenData.metadata).to.be.null;
            expect(retrievedNFTokenData.contentsData).to.equal(contentsData);
            expect(retrievedNFTokenData.metadataSaved).to.be.false;
            expect(retrievedNFTokenData.contentsDataSaved).to.be.true;
            expect(retrievedNFTokenData.isFinal).to.be.false;
        });

        it('should fail trying to save more data', function () {
            expect(() => {
                retrievedNFTokenData.saveMetadata({});
            })
            .to.throw(Error, 'Unable to save non-fungible token metadata: non-fungible token data already saved');

            expect(() => {
                retrievedNFTokenData.saveContentsData(Buffer.from('test'));
            })
            .to.throw(Error, 'Unable to save non-fungible token metadata: non-fungible token data already saved');
        });

        it('should successfully finalize the contents data', function () {
            expect(() => {
                retrievedNFTokenData.finalizeContentsData();
            })
            .not.to.throw();

            expect(retrievedNFTokenData.isFinal).to.be.true;
        });

        it('should correctly instantiate retrieved non-fungible token data from the database', function () {
            const doc = Catenis.db.collection.RetrievedNonFungibleTokenData.findOne({_id: retrievedNFTokenData.doc_id});

            let retrievedNFTokenDataDB;

            expect(() => {
                retrievedNFTokenDataDB = new RetrievedNFTokenData(doc);
            })
            .not.to.throw();

            expect(retrievedNFTokenDataDB).to.be.an.instanceof(RetrievedNFTokenData);
            expect(retrievedNFTokenDataDB).to.deep.include({
                doc_id: retrievedNFTokenData.doc_id,
                retrievedNFTokenDataId: retrievedNFTokenData.retrievedNFTokenDataId,
                nonFungibleTokenRetrieval_id: retrievedNFTokenData.nonFungibleTokenRetrieval_id,
                order: retrievedNFTokenData.order,
                isFinal: retrievedNFTokenData.isFinal,
                createdDate: retrievedNFTokenData.createdDate,
            });
            expect(retrievedNFTokenDataDB.nfTokenRetrieval).to.be.an.instanceof(NFTokenRetrieval)
            .with.property('tokenRetrievalId', retrievedNFTokenData.nfTokenRetrieval.tokenRetrievalId);
            expect(retrievedNFTokenDataDB.metadata).to.deep.equal(retrievedNFTokenData.metadata);
            expect(retrievedNFTokenDataDB.contentsData).to.deep.equal(retrievedNFTokenData.contentsData);
        });
    });
});

function resetCatenisNode() {
    class LocalDevice {
        constructor(index) {
            this.deviceIndex = index;
            this.deviceId = 'd00001';
        }
    }

    class LocalClient {
        constructor(index) {
            this.clientIndex = index;
            this.clientId = 'c00001';
        }

        getDeviceByIndex(index) {
            return new LocalDevice(index);
        }
    }

    CatenisNode.prototype.__origMethods = {
        getClientByIndex: CatenisNode.prototype.getClientByIndex,
    };

    CatenisNode.prototype.__callOrigMethod = function (name, ...args) {
        return this.__origMethods[name].call(this, ...args);
    };

    CatenisNode.prototype.getClientByIndex = function (index) {
        if (index === clientIndex) {
            return new LocalClient(index);
        }

        return this.__callOrigMethod('getClientByIndex', index);
    };
}