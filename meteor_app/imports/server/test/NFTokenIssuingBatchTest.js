/**
 * Created by claudio on 2022-03-15
 */

//console.log('[NFTokenIssuingBatchTest.js]: This code just ran.');

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
import { NFAssetIssuance } from '../NFAssetIssuance';
import { NFTokenIssuingBatch } from '../NFTokenIssuingBatch';


describe('NFTokenIssuingBatch module', function () {
    describe('First non-fungible token issuing batch', function () {
        let nfAssetIssuance;

        before(function () {
            // Simulate an existing non-fungible asset issuance
            nfAssetIssuance = new NFAssetIssuance({
                _id: '123440',
                assetIssuanceId: 'abcdee0',
                deviceId: 'd00001',
                asset: {
                    name: 'Test NFAsset #1',
                    description: 'Non-fungible asset #1 used for testing',
                    canReissue: false
                },
                isReissuance: false,
                holdingDeviceId: 'd00002',
                asyncProc: false,
                nonFungibleToken: {
                    quantity: 2,
                    encryptContents: false
                },
                createdDate: new Date()
            });
        });

        describe('Failure instantiating non-fungible token issuing batch object', function () {
            const nfTokenInfos = [
                {
                    metadata: {
                        name: 'Test NFT #1',
                        description: 'Non-fungible token #1 used for testing'
                    },
                    contents: Buffer.from('NFT #1 contents')
                },
                {
                    metadata: {
                        name: 'Test NFT #2',
                        description: 'Non-fungible token #2 used for testing'
                    },
                    contents: Buffer.from('NFT #2 contents')
                }
            ];

            it('should fail to instantiate object with invalid params (nfAssetIssuance)', function () {
                expect(() => {
                    const nfTokenIssuingBatch = new NFTokenIssuingBatch(
                        undefined,
                        undefined,
                        {},
                        nfTokenInfos,
                        false
                    );
                })
                .to.throw('Invalid nfAssetIssuance argument');
            });

            it('should fail to instantiate object with invalid params (nfTokenInfos: not an array)', function () {
                expect(() => {
                    const nfTokenIssuingBatch = new NFTokenIssuingBatch(
                        undefined,
                        undefined,
                        nfAssetIssuance,
                        'blah',
                        false
                    );
                })
                .to.throw('Invalid nfTokenInfos argument');
            });

            it('should fail to instantiate object with invalid params (nfTokenInfos: empty array)', function () {
                expect(() => {
                    const nfTokenIssuingBatch = new NFTokenIssuingBatch(
                        undefined,
                        undefined,
                        nfAssetIssuance,
                        [],
                        false
                    );
                })
                .to.throw('Invalid nfTokenInfos argument');
            });

            it('should fail to instantiate object with invalid params (nfTokenInfos: array of the wrong type)', function () {
                expect(() => {
                    const nfTokenIssuingBatch = new NFTokenIssuingBatch(
                        undefined,
                        undefined,
                        nfAssetIssuance,
                        ['blah'],
                        false
                    );
                })
                .to.throw('Invalid nfTokenInfos argument');
            });

            it('should fail to instantiate object with inconsistent number of tokens - too few', function () {
                const errNFTokenInfos = nfTokenInfos.slice(0, 1);

                expect(() => {
                    const nfTokenIssuingBatch = new NFTokenIssuingBatch(
                        undefined,
                        undefined,
                        nfAssetIssuance,
                        errNFTokenInfos,
                        false
                    );
                })
                .to.throw('Unable to create new non-fungible token issuing batch: inconsistent number of tokens');
            });

            it('should fail to instantiate object with inconsistent number of tokens - too many', function () {
                const errNFTokenInfos = nfTokenInfos.concat([
                    {
                        metadata: {
                            name: 'Test NFT #3',
                            description: 'Non-fungible token #3 used for testing'
                        },
                        contents: Buffer.from('NFT #3 contents')
                    }
                ]);

                expect(() => {
                    const nfTokenIssuingBatch = new NFTokenIssuingBatch(
                        undefined,
                        undefined,
                        nfAssetIssuance,
                        errNFTokenInfos,
                        false
                    );
                })
                .to.throw('Unable to create new non-fungible token issuing batch: inconsistent number of tokens');
            });

            it('should fail to instantiate object with inconsistent number of tokens - too few non-null', function () {
                const errNFTokenInfos = nfTokenInfos.slice(0, 1);
                errNFTokenInfos.push(null);

                expect(() => {
                    const nfTokenIssuingBatch = new NFTokenIssuingBatch(
                        undefined,
                        undefined,
                        nfAssetIssuance,
                        errNFTokenInfos,
                        false
                    );
                })
                .to.throw('Unable to create new non-fungible token issuing batch: inconsistent number of tokens');
            });
        });

        describe('Non final batch with two tokens', function () {
            const nfTokenInfos = [
                {
                    metadata: {
                        name: 'Test NFT #1',
                        description: 'Non-fungible token #1 used for testing'
                    },
                    contents: Buffer.from('NFT #1 contents')
                },
                {
                    metadata: {
                        name: 'Test NFT #2',
                        description: 'Non-fungible token #2 used for testing'
                    },
                    contents: Buffer.from('NFT #2 contents')
                }
            ];
            let nfTokenIssuingBatch;

            before(function () {
                nfTokenIssuingBatch = new NFTokenIssuingBatch(
                    undefined,
                    undefined,
                    nfAssetIssuance,
                    nfTokenInfos,
                    false
                );
            });

            it('should correctly indicate that this is the first batch', function () {
                expect(nfTokenIssuingBatch.isFirstBatch).to.be.true;
            });

            it('should correctly return no previous batch doc ID', function () {
                expect(nfTokenIssuingBatch.previousBatchDocId).to.equal(undefined);
            });

            it ('should correctly indicate that it is not yet saved to the database', function () {
                expect(nfTokenIssuingBatch.isSavedToDB).to.be.false;
            });

            it('should have initialized all non-fungible token issuing parts correctly', function () {
                expect(nfTokenIssuingBatch.nfTokenIssuingParts.length).to.equal(nfTokenInfos.length);

                for (let idx = 0, limit = nfTokenInfos.length; idx < limit; idx++) {
                    const nfTokenIssuingPart = nfTokenIssuingBatch.getNFTokenIssuingPart(idx);

                    expect(nfTokenIssuingPart).to.be.an('object');
                    expect(nfTokenIssuingPart).to.deep.include({
                        _nfTokenIssuingBatch: nfTokenIssuingBatch,
                        metadata: nfTokenInfos[idx].metadata
                    });
                }
            });

            it('should fail to save to the database if asset issuance is not yet saved', function () {
                let nfAssetIssuance_id;

                // Simulate that asset issuance is not saved yet
                nfAssetIssuance_id = nfAssetIssuance.doc_id;
                nfAssetIssuance.doc_id = undefined;

                expect(() => {
                    nfTokenIssuingBatch.saveToDB();
                })
                .to.throw('Unable to save non-fungible token issuing batch to database: associated asset issuance not yet saved');

                // Reset batch
                nfAssetIssuance.doc_id = nfAssetIssuance_id;
            });

            it ('should correctly save object to the database', function () {
                nfTokenIssuingBatch.saveToDB();

                expect(nfTokenIssuingBatch.isSavedToDB).to.be.true;
            });

            it('should correctly set batch as final', function () {
                expect(nfTokenIssuingBatch.isFinal, 'Unexpected situation: non-fungible token issuing batch is already set as final').to.be.false;

                nfTokenIssuingBatch.setFinal();

                expect(nfTokenIssuingBatch.isFinal).to.be.true;
                expect(Catenis.db.collection.NonFungibleTokenIssuingBatch.findOne(nfTokenIssuingBatch.doc_id).isFinal).to.be.true;
            });

            describe('Instantiate from database doc', function () {
                describe('Without preloading contents', function () {
                    let nfTokenIssuingBatchDB;

                    before(function () {
                        nfTokenIssuingBatchDB = new NFTokenIssuingBatch(
                            Catenis.db.collection.NonFungibleTokenIssuingBatch.findOne(nfTokenIssuingBatch.doc_id),
                            false
                        );
                    });

                    it('should correctly instantiate non-fungible token issuing batch object from the database', function () {
                        expect(nfTokenIssuingBatchDB).to.deep.include({
                            doc_id: nfTokenIssuingBatch.doc_id,
                            nfTokenIssuingBatchId: nfTokenIssuingBatch.nfTokenIssuingBatchId,
                            nonFungibleAssetIssuance_id: nfAssetIssuance.doc_id,
                            order: nfTokenIssuingBatch.order,
                            isFinal: nfTokenIssuingBatch.isFinal,
                            createdDate: nfTokenIssuingBatch.createdDate
                        });
                    });

                    it('should have loaded all non-fungible token issuing parts correctly', function () {
                        expect(nfTokenIssuingBatchDB.nfTokenIssuingParts.length).to.equal(nfTokenInfos.length);

                        for (let idx = 0, limit = nfTokenInfos.length; idx < limit; idx++) {
                            const nfTokenIssuingPart = nfTokenIssuingBatchDB.getNFTokenIssuingPart(idx);

                            expect(nfTokenIssuingPart).to.be.an('object');
                            expect(nfTokenIssuingPart).to.deep.include({
                                metadata: nfTokenInfos[idx].metadata,
                                _contents: undefined
                            });
                        }
                    });
                });

                describe('Preloading contents', function () {
                    let nfTokenIssuingBatchDB;

                    before(function () {
                        nfTokenIssuingBatchDB = new NFTokenIssuingBatch(
                            Catenis.db.collection.NonFungibleTokenIssuingBatch.findOne(nfTokenIssuingBatch.doc_id),
                            true
                        );
                    });

                    it('should correctly instantiate non-fungible token issuing batch object from the database', function () {
                        expect(nfTokenIssuingBatchDB).to.deep.include({
                            doc_id: nfTokenIssuingBatch.doc_id,
                            nfTokenIssuingBatchId: nfTokenIssuingBatch.nfTokenIssuingBatchId,
                            nonFungibleAssetIssuance_id: nfAssetIssuance.doc_id,
                            order: nfTokenIssuingBatch.order,
                            isFinal: nfTokenIssuingBatch.isFinal,
                            createdDate: nfTokenIssuingBatch.createdDate
                        });
                    });

                    it('should have loaded all non-fungible token issuing parts correctly', function () {
                        expect(nfTokenIssuingBatchDB.nfTokenIssuingParts.length).to.equal(nfTokenInfos.length);

                        for (let idx = 0, limit = nfTokenInfos.length; idx < limit; idx++) {
                            const nfTokenIssuingPart = nfTokenIssuingBatchDB.getNFTokenIssuingPart(idx);

                            expect(nfTokenIssuingPart).to.be.an('object');
                            expect(nfTokenIssuingPart).to.deep.include({
                                metadata: nfTokenInfos[idx].metadata,
                                _contents: nfTokenInfos[idx].contents
                            });
                        }
                    });
                });
            });
        });
    });

    describe('A following non-fungible token issuing batch', function () {
        let nfAssetIssuance;

        before(function () {
            // Simulate an existing non-fungible asset issuance with a single batch
            Catenis.db.collection.NonFungibleTokenIssuingBatch.insert({
                _id: '123451',
                nfTokenIssuingBatchId: 'abcdef1',
                nonFungibleAssetIssuance_id: '123441',
                order: 1,
                isFinal: false,
                createdDate: new Date()
            });

            nfAssetIssuance = new NFAssetIssuance({
                _id: '123441',
                assetIssuanceId: 'abcdee1',
                deviceId: 'd00001',
                asset: {
                    name: 'Test NFAsset #1',
                    description: 'Non-fungible asset #1 used for testing',
                    canReissue: false
                },
                isReissuance: false,
                holdingDeviceId: 'd00002',
                asyncProc: false,
                nonFungibleToken: {
                    quantity: 3,
                    encryptContents: false
                },
                createdDate: new Date()
            });
        });

        describe('Failure instantiating non-fungible token issuing batch object', function () {
            const nfTokenInfos = [
                null,
                {
                    metadata: {
                        name: 'Test NFT #2',
                        description: 'Non-fungible token #2 used for testing'
                    },
                    contents: Buffer.from('NFT #2 contents, part 2')
                }
            ];

            it('should fail to instantiate object - complete non-fungible asset', function () {
                // Simulate that non-fungible asset is complete
                nfAssetIssuance.nfTokenIssuingBatches[0].isFinal = true;

                expect(() => {
                    const nfTokenIssuingBatch = new NFTokenIssuingBatch(
                        undefined,
                        undefined,
                        nfAssetIssuance,
                        nfTokenInfos,
                        true
                    );
                })
                .to.throw('Unable to create new non-fungible token issuing batch: non-fungible asset issuance is already complete');

                // Reset batch of non-fungible asset issuance
                nfAssetIssuance.nfTokenIssuingBatches[0].isFinal = false;
            });

            it('should fail to instantiate object with inconsistent number of tokens - too many', function () {
                const errNFTokenInfos = nfTokenInfos.concat([null, null]);

                expect(() => {
                    const nfTokenIssuingBatch = new NFTokenIssuingBatch(
                        undefined,
                        undefined,
                        nfAssetIssuance,
                        errNFTokenInfos,
                        true
                    );
                })
                .to.throw('Unable to create new non-fungible token issuing batch: inconsistent number of tokens');
            });

            it('should fail to instantiate object with no tokens', function () {
                expect(() => {
                    const nfTokenIssuingBatch = new NFTokenIssuingBatch(
                        undefined,
                        undefined,
                        nfAssetIssuance,
                        [null],
                        true
                    );
                })
                .to.throw('Unable to create new non-fungible token issuing batch: missing non-fungible token info');
            });
        });

        describe('Final batch with only one token', function () {
            const nfTokenInfos = [
                null,
                {
                    metadata: {
                        name: 'Test NFT #2',
                        description: 'Non-fungible token #2 used for testing'
                    },
                    contents: Buffer.from('NFT #2 contents, part 2')
                }
            ];
            let nfTokenIssuingBatch;

            before(function () {
                nfTokenIssuingBatch = new NFTokenIssuingBatch(
                    undefined,
                    undefined,
                    nfAssetIssuance,
                    nfTokenInfos,
                    true
                );
            });

            it('should correctly indicate that this is not the first batch', function () {
                expect(nfTokenIssuingBatch.isFirstBatch).to.be.false;
                expect(nfTokenIssuingBatch.order).to.equal(2);
            });

            it('should correctly return the previous batch doc ID', function () {
                expect(nfTokenIssuingBatch.previousBatchDocId).to.equal('123451');
            });

            it ('should correctly indicate that it is not yet saved to the database', function () {
                expect(nfTokenIssuingBatch.isSavedToDB).to.be.false;
            });

            it('should have initialized all non-fungible token issuing parts correctly', function () {
                expect(nfTokenIssuingBatch.nfTokenIssuingParts.length).to.equal(nfTokenInfos.length);

                for (let idx = 0, limit = nfTokenInfos.length; idx < limit; idx++) {
                    const nfTokenIssuingPart = nfTokenIssuingBatch.getNFTokenIssuingPart(idx);

                    if (nfTokenInfos[idx]) {
                        expect(nfTokenIssuingPart).to.be.an('object');
                        expect(nfTokenIssuingPart).to.deep.include({
                            _nfTokenIssuingBatch: nfTokenIssuingBatch,
                            metadata: nfTokenInfos[idx].metadata
                        });
                    }
                    else {
                        expect(nfTokenIssuingPart).to.equal(undefined);
                    }
                }
            });

            it('should fail to save to the database if asset issuance is not yet saved', function () {
                let nfAssetIssuance_id;

                // Simulate that asset issuance is not saved yet
                nfAssetIssuance_id = nfAssetIssuance.doc_id;
                nfAssetIssuance.doc_id = undefined;

                expect(() => {
                    nfTokenIssuingBatch.saveToDB();
                })
                .to.throw('Unable to save non-fungible token issuing batch to database: associated asset issuance not yet saved');

                // Reset batch
                nfAssetIssuance.doc_id = nfAssetIssuance_id;
            });

            it ('should correctly save object to the database', function () {
                nfTokenIssuingBatch.saveToDB();

                expect(nfTokenIssuingBatch.isSavedToDB).to.be.true;
            });

            describe('Instantiate from database doc', function () {
                describe('Without preloading contents', function () {
                    let nfTokenIssuingBatchDB;

                    before(function () {
                        nfTokenIssuingBatchDB = new NFTokenIssuingBatch(
                            Catenis.db.collection.NonFungibleTokenIssuingBatch.findOne(nfTokenIssuingBatch.doc_id),
                            false
                        );
                    });

                    it('should correctly instantiate non-fungible token issuing batch object from the database', function () {
                        expect(nfTokenIssuingBatchDB).to.deep.include({
                            doc_id: nfTokenIssuingBatch.doc_id,
                            nfTokenIssuingBatchId: nfTokenIssuingBatch.nfTokenIssuingBatchId,
                            nonFungibleAssetIssuance_id: nfAssetIssuance.doc_id,
                            order: nfTokenIssuingBatch.order,
                            isFinal: nfTokenIssuingBatch.isFinal,
                            createdDate: nfTokenIssuingBatch.createdDate
                        });
                    });

                    it('should have loaded all non-fungible token issuing parts correctly', function () {
                        expect(nfTokenIssuingBatchDB.nfTokenIssuingParts.length).to.equal(nfTokenInfos.length);

                        for (let idx = 0, limit = nfTokenInfos.length; idx < limit; idx++) {
                            const nfTokenIssuingPart = nfTokenIssuingBatchDB.getNFTokenIssuingPart(idx);

                            if (nfTokenInfos[idx]) {
                                expect(nfTokenIssuingPart).to.be.an('object');
                                expect(nfTokenIssuingPart).to.deep.include({
                                    metadata: nfTokenInfos[idx].metadata,
                                    _contents: undefined
                                });
                            }
                            else {
                                expect(nfTokenIssuingPart).to.equal(undefined);
                            }
                        }
                    });
                });

                describe('Preloading contents', function () {
                    let nfTokenIssuingBatchDB;

                    before(function () {
                        nfTokenIssuingBatchDB = new NFTokenIssuingBatch(
                            Catenis.db.collection.NonFungibleTokenIssuingBatch.findOne(nfTokenIssuingBatch.doc_id),
                            true
                        );
                    });

                    it('should correctly instantiate non-fungible token issuing batch object from the database', function () {
                        expect(nfTokenIssuingBatchDB).to.deep.include({
                            doc_id: nfTokenIssuingBatch.doc_id,
                            nfTokenIssuingBatchId: nfTokenIssuingBatch.nfTokenIssuingBatchId,
                            nonFungibleAssetIssuance_id: nfAssetIssuance.doc_id,
                            order: nfTokenIssuingBatch.order,
                            isFinal: nfTokenIssuingBatch.isFinal,
                            createdDate: nfTokenIssuingBatch.createdDate
                        });
                    });

                    it('should have loaded all non-fungible token issuing parts correctly', function () {
                        expect(nfTokenIssuingBatchDB.nfTokenIssuingParts.length).to.equal(nfTokenInfos.length);

                        for (let idx = 0, limit = nfTokenInfos.length; idx < limit; idx++) {
                            const nfTokenIssuingPart = nfTokenIssuingBatchDB.getNFTokenIssuingPart(idx);

                            if (nfTokenInfos[idx]) {
                                expect(nfTokenIssuingPart).to.be.an('object');
                                expect(nfTokenIssuingPart).to.deep.include({
                                    metadata: nfTokenInfos[idx].metadata,
                                    _contents: nfTokenInfos[idx].contents
                                });
                            }
                            else {
                                expect(nfTokenIssuingPart).to.equal(undefined);
                            }
                        }
                    });
                });
            });
        });
    });
});
