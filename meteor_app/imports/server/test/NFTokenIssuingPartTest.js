/**
 * Created by claudio on 2022-03-14
 */

//console.log('[NFTokenIssuingPartTest.js]: This code just ran.');

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
import { NFTokenIssuingBatch } from '../NFTokenIssuingBatch';
import { NFTokenIssuingPart } from '../NFTokenIssuingPart';


describe('NFTokenIssuingPart module', function () {
    describe('First non-fungible token issuing batch', function () {
        let nfTokenIssuingBatch;

        before(function () {
            // Simulate an existing non-fungible token issuing batch
            nfTokenIssuingBatch = new NFTokenIssuingBatch({
                _id: '123451',
                nfTokenIssuingBatchId: 'abcdef1',
                nonFungibleAssetIssuance_id: '123440',
                order: 1,
                isFinal: false,
                createdDate: new Date()
            });
        });

        describe('Failure instantiating non-fungible token issuing part object', function () {
            it('should fail to instantiate object with invalid params (nfTokenIssuingBatch)', function () {
                expect(() => {
                    const nfTokenIssuingPart = new NFTokenIssuingPart(
                        undefined,
                        {},
                        {
                            metadata: {
                                name: 'Test NFT #1',
                                description: 'Non-fungible token #1 used for testing'
                            },
                            contents: Buffer.from('NFT #1 contents')
                        },
                        0
                    );
                })
                .to.throw('Invalid nfTokenIssuingBatch argument');
            });

            it('should fail to instantiate object with invalid params (nfTokenInfo)', function () {
                expect(() => {
                    const nfTokenIssuingPart = new NFTokenIssuingPart(
                        undefined,
                        nfTokenIssuingBatch,
                        'blah',
                        0
                    );
                })
                .to.throw('Invalid nfTokenInfo argument');
            });

            it('should fail to instantiate object with invalid params (index)', function () {
                expect(() => {
                    const nfTokenIssuingPart = new NFTokenIssuingPart(
                        undefined,
                        nfTokenIssuingBatch,
                        {
                            metadata: {
                                name: 'Test NFT #1',
                                description: 'Non-fungible token #1 used for testing'
                            },
                            contents: Buffer.from('NFT #1 contents')
                        },
                        -1
                    );
                })
                .to.throw('Invalid index argument');
            });

            it('should fail to instantiate object with missing non-fungible token metadata', function () {
                expect(() => {
                    const nfTokenIssuingPart = new NFTokenIssuingPart(
                        undefined,
                        nfTokenIssuingBatch,
                        {
                            contents: Buffer.from('NFT #1 contents')
                        },
                        0
                    );
                })
                .to.throw('Unable to create new non-fungible token issuing part: missing non-fungible token metadata');
            });

            it('should fail to instantiate object with missing non-fungible token contents', function () {
                expect(() => {
                    const nfTokenIssuingPart = new NFTokenIssuingPart(
                        undefined,
                        nfTokenIssuingBatch,
                        {
                            metadata: {
                                name: 'Test NFT #1',
                                description: 'Non-fungible token #1 used for testing'
                            }
                        },
                        0
                    );
                })
                .to.throw('Unable to create new non-fungible token issuing part: missing non-fungible token contents');
            });
        });

        describe('Non-fungible token issuing part for the first token in batch', function () {
            const nfTokenInfo = {
                metadata: {
                    name: 'Test NFT #1',
                    description: 'Non-fungible token #1 used for testing'
                },
                contents: Buffer.from('NFT #1 contents')
            };
            let nfTokenIssuingPart;

            before(function () {
                nfTokenIssuingPart = new NFTokenIssuingPart(
                    undefined,
                    nfTokenIssuingBatch,
                    nfTokenInfo,
                    0
                );
            });

            it ('should correctly indicate that this part is for the first token', function () {
                expect(nfTokenIssuingPart.isForFirstToken).to.be.true;
            });

            it ('should correctly indicate that it is not yet saved to the database', function () {
                expect(nfTokenIssuingPart.isSavedToDB).to.be.false;
            });

            it ('should correctly indicate that it has contents', function () {
                expect(nfTokenIssuingPart.hasContents).to.be.true;
            });

            it ('should retrieve the correct contents', function () {
                expect(nfTokenIssuingPart.getContents()).to.deep.equal(nfTokenInfo.contents);
            });

            it('should fail to save to the database if batch is not yet saved', function () {
                let nfTokenIssuingBatch_id;

                // Simulate that batch is not saved yet
                nfTokenIssuingBatch_id = nfTokenIssuingBatch.doc_id;
                nfTokenIssuingBatch.doc_id = undefined;

                expect(() => {
                    nfTokenIssuingPart.saveToDB();
                })
                .to.throw('Unable to save non-fungible token issuing part to database: associated issuing batch not yet saved');

                // Reset batch
                nfTokenIssuingBatch.doc_id = nfTokenIssuingBatch_id;
            });

            it ('should correctly save object to the database', function () {
                nfTokenIssuingPart.saveToDB();

                expect(nfTokenIssuingPart.isSavedToDB).to.be.true;
            });

            describe('Instantiate from database doc', function () {
                describe('Without preloading contents', function () {
                    let nfTokenIssuingPartDB;

                    before(function () {
                        nfTokenIssuingPartDB = new NFTokenIssuingPart(
                            Catenis.db.collection.NonFungibleTokenIssuingPart
                            .findOne(nfTokenIssuingPart.doc_id, {
                                fields: {
                                    contents: 0
                                }
                            })
                        );
                    });

                    it('should correctly instantiate non-fungible token issuing part object from the database', function () {
                        expect(nfTokenIssuingPartDB).to.deep.include({
                            doc_id: nfTokenIssuingPart.doc_id,
                            nonFungibleTokenIssuingBatch_id: nfTokenIssuingBatch.doc_id,
                            index: nfTokenIssuingPart.index,
                            metadata: nfTokenInfo.metadata,
                            _contents: undefined,
                            createdDate: nfTokenIssuingPart.createdDate
                        });
                    });

                    it ('should correctly indicate that it has contents', function () {
                        expect(nfTokenIssuingPartDB.hasContents).to.be.true;
                    });

                    it('should retrieve the correct contents without storing it', function () {
                        expect(nfTokenIssuingPartDB.getContents(false)).to.deep.equal(nfTokenInfo.contents);
                        expect(nfTokenIssuingPartDB._contents).to.deep.equal(Buffer.from(''));
                    });

                    it('should retrieve the correct contents and store it', function () {
                        expect(nfTokenIssuingPartDB.getContents(true)).to.deep.equal(nfTokenInfo.contents);
                        expect(nfTokenIssuingPartDB._contents).to.deep.equal(nfTokenInfo.contents);
                    });
                });

                describe('Preloading contents', function () {
                    let nfTokenIssuingPartDB;

                    before(function () {
                        nfTokenIssuingPartDB = new NFTokenIssuingPart(
                            Catenis.db.collection.NonFungibleTokenIssuingPart
                            .findOne(nfTokenIssuingPart.doc_id)
                        );
                    });

                    it('should correctly instantiate non-fungible token issuing part object from the database', function () {
                        expect(nfTokenIssuingPartDB).to.deep.include({
                            doc_id: nfTokenIssuingPart.doc_id,
                            nonFungibleTokenIssuingBatch_id: nfTokenIssuingBatch.doc_id,
                            index: nfTokenIssuingPart.index,
                            metadata: nfTokenInfo.metadata,
                            _contents: nfTokenInfo.contents,
                            createdDate: nfTokenIssuingPart.createdDate
                        });
                    });

                    it ('should correctly indicate that it has contents', function () {
                        expect(nfTokenIssuingPartDB.hasContents).to.be.true;
                    });

                    it('should retrieve the correct contents', function () {
                        expect(nfTokenIssuingPartDB.getContents(false)).to.deep.equal(nfTokenInfo.contents);
                    });
                });
            });
        });

        describe('Non-fungible token issuing part for a following token without contents (share first token contents)', function () {
            const nfTokenInfo = {
                metadata: {
                    name: 'Test NFT #2',
                    description: 'Non-fungible token #2 used for testing'
                }
            };
            let nfTokenIssuingPart;

            before(function () {
                nfTokenIssuingPart = new NFTokenIssuingPart(
                    undefined,
                    nfTokenIssuingBatch,
                    nfTokenInfo,
                    1
                );
            });

            it ('should correctly indicate that this part is not for the first token', function () {
                expect(nfTokenIssuingPart.isForFirstToken).to.be.false;
            });

            it ('should correctly indicate that it is not yet saved to the database', function () {
                expect(nfTokenIssuingPart.isSavedToDB).to.be.false;
            });

            it ('should correctly indicate that it does not have contents', function () {
                expect(nfTokenIssuingPart.hasContents).to.be.false;
            });

            it ('should retrieve an empty (non-existing) contents', function () {
                expect(nfTokenIssuingPart.getContents()).to.equal(null);
            });

            it ('should correctly save object to the database', function () {
                nfTokenIssuingPart.saveToDB();

                expect(nfTokenIssuingPart.isSavedToDB).to.be.true;
            });

            describe('Instantiate from database doc', function () {
                describe('Without preloading contents', function () {
                    let nfTokenIssuingPartDB;

                    before(function () {
                        nfTokenIssuingPartDB = new NFTokenIssuingPart(
                            Catenis.db.collection.NonFungibleTokenIssuingPart
                            .findOne(nfTokenIssuingPart.doc_id, {
                                fields: {
                                    contents: 0
                                }
                            })
                        );
                    });

                    it('should correctly instantiate non-fungible token issuing part object from the database', function () {
                        expect(nfTokenIssuingPartDB).to.deep.include({
                            doc_id: nfTokenIssuingPart.doc_id,
                            nonFungibleTokenIssuingBatch_id: nfTokenIssuingBatch.doc_id,
                            index: nfTokenIssuingPart.index,
                            metadata: nfTokenInfo.metadata,
                            _contents: undefined,
                            createdDate: nfTokenIssuingPart.createdDate
                        });
                    });

                    it ('should correctly indicate that it does not have contents', function () {
                        expect(nfTokenIssuingPartDB.hasContents).to.be.false;
                    });

                    it('should retrieve an empty (non-existing) contents', function () {
                        expect(nfTokenIssuingPartDB.getContents()).to.equal(null);
                        expect(nfTokenIssuingPartDB._contents).to.equal(null);
                    });
                });

                describe('Preloading contents', function () {
                    let nfTokenIssuingPartDB;

                    before(function () {
                        nfTokenIssuingPartDB = new NFTokenIssuingPart(
                            Catenis.db.collection.NonFungibleTokenIssuingPart
                            .findOne(nfTokenIssuingPart.doc_id)
                        );
                    });

                    it('should correctly instantiate non-fungible token issuing part object from the database', function () {
                        expect(nfTokenIssuingPartDB).to.deep.include({
                            doc_id: nfTokenIssuingPart.doc_id,
                            nonFungibleTokenIssuingBatch_id: nfTokenIssuingBatch.doc_id,
                            index: nfTokenIssuingPart.index,
                            metadata: nfTokenInfo.metadata,
                            _contents: null,
                            createdDate: nfTokenIssuingPart.createdDate
                        });
                    });

                    it ('should correctly indicate that it does not have contents', function () {
                        expect(nfTokenIssuingPartDB.hasContents).to.be.false;
                    });

                    it('should retrieve an empty (non-existing) contents', function () {
                        expect(nfTokenIssuingPartDB.getContents()).to.equal(null);
                    });
                });
            });
        });
    });

    describe('A following non-fungible token issuing batch', function () {
        let nfTokenIssuingBatch;

        before(function () {
            // Simulate an existing non-fungible token issuing batch
            nfTokenIssuingBatch = new NFTokenIssuingBatch({
                _id: '123453',
                nfTokenIssuingBatchId: 'abcdef3',
                nonFungibleAssetIssuance_id: '123440',
                order: 3,
                isFinal: false,
                createdDate: new Date()
            });
        });

        describe('Failure instantiating non-fungible token issuing part object', function () {
            it('should fail to instantiate object with missing non-fungible token contents', function () {
                expect(() => {
                    const nfTokenIssuingPart = new NFTokenIssuingPart(
                        undefined,
                        nfTokenIssuingBatch,
                        {
                            metadata: {
                                name: 'Test NFT #1',
                                description: 'Non-fungible token #1 used for testing'
                            }
                        },
                        0
                    );
                })
                .to.throw('Unable to create new non-fungible token issuing part: missing non-fungible token contents');
            });

            it('should fail to instantiate object - missing previous batch', function () {
                expect(() => {
                    const nfTokenIssuingPart = new NFTokenIssuingPart(
                        undefined,
                        nfTokenIssuingBatch,
                        {
                            metadata: {
                                name: 'Test NFT #1',
                                description: 'Non-fungible token #1 used for testing'
                            },
                            contents: Buffer.from('NFT #1 contents - part #3')
                        },
                        0
                    );
                })
                .to.throw('Previous non-fungible token issuing batch not found');
            });

            describe('Previous batch without contents', function () {
                before(function () {
                   // Simulate previous non-fungible token issuing batch
                   Catenis.db.collection.NonFungibleTokenIssuingBatch.insert({
                       _id: '123452',
                       nonFungibleAssetIssuance_id: '123440',
                       order: 2
                   });

                   Catenis.db.collection.NonFungibleTokenIssuingPart.insert({
                       _id: '123462',
                       nonFungibleTokenIssuingBatch_id: '123452',
                       index: 0,
                       contents: null
                   });
                });

                after(function () {
                    Catenis.db.collection.NonFungibleTokenIssuingBatch.remove({
                        _id: '123452'
                    });

                    Catenis.db.collection.NonFungibleTokenIssuingPart.remove({
                        _id: '123462'
                    });
                });

                it('should fail to instantiate object - non-fungible token contents already finalized', function () {
                    expect(() => {
                        const nfTokenIssuingPart = new NFTokenIssuingPart(
                            undefined,
                            nfTokenIssuingBatch,
                            {
                                metadata: {
                                    name: 'Test NFT #1',
                                    description: 'Non-fungible token #1 used for testing'
                                },
                                contents: Buffer.from('NFT #1 contents - part #3')
                            },
                            0
                        );
                    })
                    .to.throw('Unable to create new non-fungible token issuing part: non-fungible token contents has already been finalized');
                });
            });
        });

        describe('Success instantiating non-fungible token issuing part object', function () {
            before(function () {
                // Simulate previous non-fungible token issuing batch
                Catenis.db.collection.NonFungibleTokenIssuingBatch.insert({
                    _id: '123452',
                    nonFungibleAssetIssuance_id: '123440',
                    order: 2
                });

                Catenis.db.collection.NonFungibleTokenIssuingPart.insert({
                    _id: '123462',
                    nonFungibleTokenIssuingBatch_id: '123452',
                    index: 0,
                    contents: new Uint8Array(Buffer.from('NFT #1 contents - part #2'))
                });
            });

            after(function () {
                Catenis.db.collection.NonFungibleTokenIssuingBatch.remove({
                    _id: '123452'
                });

                Catenis.db.collection.NonFungibleTokenIssuingPart.remove({
                    _id: '123462'
                });
            });

            it('should successfully instantiate object', function () {
                expect(() => {
                    const nfTokenIssuingPart = new NFTokenIssuingPart(
                        undefined,
                        nfTokenIssuingBatch,
                        {
                            metadata: {
                                name: 'Test NFT #1',
                                description: 'Non-fungible token #1 used for testing'
                            },
                            contents: Buffer.from('NFT #1 contents - part #3')
                        },
                        0
                    );
                })
                .not.to.throw();
            });
        });
    });
});