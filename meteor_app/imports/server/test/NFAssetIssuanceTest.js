/**
 * Created by claudio on 2022-04-04
 */

//console.log('[NFAssetIssuanceTest.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import { expect } from 'chai';
import _und from 'underscore';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from '../Catenis';
import { NFAssetIssuance } from '../NFAssetIssuance';
import { NFTokenContentsUrl } from '../NFTokenContentsUrl';
import { EccLibraryProxy } from '../EccLibraryProxy';
import { Bip32 } from '../Bip32';


describe('NFAssetIssuance module', function () {
    before(function () {
        EccLibraryProxy.initialize();
        Bip32.initialize();
    });

    describe('Failure instantiating non-fungible asset issuance object', function () {
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

        it('should fail to instantiate object with invalid params (deviceId)', function () {
            expect(() => {
                const nfTokenIssuingBatch = new NFAssetIssuance(
                    undefined,
                    undefined,
                    null,
                    {
                        name: 'Test NFAsset #1',
                        description: 'Non-fungible asset #1 used for testing',
                        canReissue: false
                    },
                    false,
                    'd00002',
                    nfTokenInfos,
                    false,
                    false
                );
            })
            .to.throw('Invalid deviceId argument');
        });

        it('should fail to instantiate object with invalid params (assetPropsOrId)', function () {
            expect(() => {
                const nfTokenIssuingBatch = new NFAssetIssuance(
                    undefined,
                    undefined,
                    'd00001',
                    null,
                    false,
                    'd00002',
                    nfTokenInfos,
                    false,
                    false
                );
            })
            .to.throw('Invalid assetPropsOrId argument');
        });

        it('should fail to instantiate object with invalid params (holdingDeviceIds: neither a string nor an array)', function () {
            expect(() => {
                const nfTokenIssuingBatch = new NFAssetIssuance(
                    undefined,
                    undefined,
                    'd00001',
                    {
                        name: 'Test NFAsset #1',
                        description: 'Non-fungible asset #1 used for testing',
                        canReissue: false
                    },
                    false,
                    null,
                    nfTokenInfos,
                    false,
                    false
                );
            })
            .to.throw('Invalid holdingDeviceIds argument');
        });

        it('should fail to instantiate object with invalid params (holdingDeviceIds: empty array)', function () {
            expect(() => {
                const nfTokenIssuingBatch = new NFAssetIssuance(
                    undefined,
                    undefined,
                    'd00001',
                    {
                        name: 'Test NFAsset #1',
                        description: 'Non-fungible asset #1 used for testing',
                        canReissue: false
                    },
                    false,
                    [],
                    nfTokenInfos,
                    false,
                    false
                );
            })
            .to.throw('Invalid holdingDeviceIds argument');
        });

        it('should fail to instantiate object with invalid params (holdingDeviceIds: array of the wrong type)', function () {
            expect(() => {
                const nfTokenIssuingBatch = new NFAssetIssuance(
                    undefined,
                    undefined,
                    'd00001',
                    {
                        name: 'Test NFAsset #1',
                        description: 'Non-fungible asset #1 used for testing',
                        canReissue: false
                    },
                    false,
                    [1, 2],
                    nfTokenInfos,
                    false,
                    false
                );
            })
            .to.throw('Invalid holdingDeviceIds argument');
        });

        it('should fail to instantiate object: inconsistent number of holding devices)', function () {
            expect(() => {
                const nfTokenIssuingBatch = new NFAssetIssuance(
                    undefined,
                    undefined,
                    'd00001',
                    {
                        name: 'Test NFAsset #1',
                        description: 'Non-fungible asset #1 used for testing',
                        canReissue: false
                    },
                    false,
                    ['d00002'],
                    nfTokenInfos,
                    false,
                    false
                );
            })
            .to.throw('Number of holding devices is not consistent with the number of non-fungible tokens to be issued');
        });

        it('should fail to instantiate object with invalid params (nfTokenInfos: not an array)', function () {
            expect(() => {
                const nfTokenIssuingBatch = new NFAssetIssuance(
                    undefined,
                    undefined,
                    'd00001',
                    {
                        name: 'Test NFAsset #1',
                        description: 'Non-fungible asset #1 used for testing',
                        canReissue: false
                    },
                    false,
                    'd00002',
                    'blah',
                    false,
                    false
                );
            })
            .to.throw('Invalid nfTokenInfos argument');
        });

        it('should fail to instantiate object with invalid params (nfTokenInfos: empty array)', function () {
            expect(() => {
                const nfTokenIssuingBatch = new NFAssetIssuance(
                    undefined,
                    undefined,
                    'd00001',
                    {
                        name: 'Test NFAsset #1',
                        description: 'Non-fungible asset #1 used for testing',
                        canReissue: false
                    },
                    false,
                    'd00002',
                    [],
                    false,
                    false
                );
            })
            .to.throw('Invalid nfTokenInfos argument');
        });

        it('should fail to instantiate object with invalid params (nfTokenInfos: array of the wrong type)', function () {
            expect(() => {
                const nfTokenIssuingBatch = new NFAssetIssuance(
                    undefined,
                    undefined,
                    'd00001',
                    {
                        name: 'Test NFAsset #1',
                        description: 'Non-fungible asset #1 used for testing',
                        canReissue: false
                    },
                    false,
                    'd00002',
                    ['blah'],
                    false,
                    false
                );
            })
            .to.throw('Invalid nfTokenInfos argument');
        });
    });

    describe('Issuance of new asset with three tokens, incomplete', function () {
        const nfTokenInfos = [
            {
                metadata: {
                    name: 'Test NFT #1',
                    description: 'Non-fungible token #1 used for testing'
                },
                contents: Buffer.from('NFT #1 contents: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + ', blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + ', blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + ', blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + ', blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + ', blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + ', blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + ', blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + ', blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + ', blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + ', blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + ', blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + ', blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + ', blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + ', blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + ', blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + ', blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + ', blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah')
            },
            {
                metadata: {
                    name: 'Test NFT #2',
                    description: 'Non-fungible token #2 used for testing'
                }
            },
            {
                metadata: {
                    name: 'Test NFT #3',
                    description: 'Non-fungible token #3 used for testing'
                },
                contents: Buffer.from('NFT #3 contents: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + ', blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + ', blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + ', blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + ', blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + ', blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + ', blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + ', blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + ', blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + ', blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + ', blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + ', blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + ', blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + ', blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + ', blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + ', blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + ', blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                    + ', blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah')
            }
        ];
        let nfAssetIssuance;
        let firstContinuationToken;
        let dbNFAssetIssuance;
        let filteredNFAssetIssuance;

        before(function () {
            nfAssetIssuance = new NFAssetIssuance(
                undefined,
                undefined,
                'd00001',
                {
                    name: 'Test NFAsset #1',
                    description: 'Non-fungible asset #1 used for testing',
                    canReissue: false
                },
                true,
                'd00002',
                nfTokenInfos,
                false,
                false
            );
        });

        it('should correctly instantiate non-fungible asset issuance object (with multiple holding devices)', function () {
            const nfAssetIssuance = new NFAssetIssuance(
                undefined,
                undefined,
                'd00001',
                {
                    name: 'Test NFAsset #1',
                    description: 'Non-fungible asset #1 used for testing',
                    canReissue: false
                },
                true,
                ['d00002', 'd00003', 'd00004'],
                nfTokenInfos,
                false,
                false
            );

            expect(nfAssetIssuance).to.be.an.instanceof(NFAssetIssuance);
        });

        it('should correctly instantiate non-fungible asset issuance object (with a single holding device)', function () {
            const nfAssetIssuance = new NFAssetIssuance(
                undefined,
                undefined,
                'd00001',
                {
                    name: 'Test NFAsset #1',
                    description: 'Non-fungible asset #1 used for testing',
                    canReissue: false
                },
                true,
                'd00002',
                nfTokenInfos,
                false,
                false
            );

            expect(nfAssetIssuance).to.be.an.instanceof(NFAssetIssuance);
        });

        it('should correctly indicate that this issuance is not complete', function () {
            expect(nfAssetIssuance.isComplete).to.be.false;
        });

        it('should correctly report the number of holding devices', function () {
            expect(nfAssetIssuance.numberOfHoldingDevices).to.equal(1);
        });

        it('should correctly report the number of issued non-fungible tokens', function () {
            expect(nfAssetIssuance.numberOfNFTokens).to.equal(3);
        });

        it('should correctly indicate that non-fungible token contents should be encrypted', function () {
            expect(nfAssetIssuance.encryptNFTokenContents).to.be.true;
        });

        it('should correctly report the next batch order', function () {
            expect(nfAssetIssuance.nextBatchOrder).to.equal(2);
        });

        it('should correctly indicate that it is already saved to the database', function () {
            expect(nfAssetIssuance.isSavedToDB).to.be.true;
        });

        it('should successfully retrieve a non-empty continuation token', function () {
            expect(firstContinuationToken = nfAssetIssuance.continuationToken).to.not.equal(undefined);
        });

        it('should fail trying to retrieve tokens with contents (not complete)', function () {
            expect(() => {
                nfAssetIssuance.nfTokensWithContents();
            })
            .to.throw('Unable to get list of non-fungible tokens with contents: non-fungible asset issuance data not yet complete');
        });

        it('should fail trying to get the total length of the non-fungible tokens\' contents (not complete)', function () {
            expect(() => {
                nfAssetIssuance._totalNFTokensContentsBytes;
            })
            .to.throw('Error computing total non-fungible tokens\' contents length for non-fungible asset issuance: Error: Non-fungible asset issuance data not yet complete');
        });

        it('should fail trying to retrieve the estimated size of the non-fungible asset metadata (not complete)', function () {
            expect(() => {
                nfAssetIssuance._estimatedAssetMetadataSize;
            })
            .to.throw('Error while estimating the size of the metadata for issuing the non-fungible asset: Error: Unable to get non-fungible tokens\' metadata for size estimate: non-fungible asset issuance data not yet complete');
        });

        it('should fail trying to add one more toke issuing batch', function () {
            expect(() => {
                nfAssetIssuance.newNFTokenIssuingBatch(undefined, false);
            })
            .to.throw('Unable to add new non-fungible token issuing batch: missing non-fungible token info');
        });

        it('should fail checking if token has contents (invalid parameter: not a number)', function () {
            expect(() => {
                nfAssetIssuance.nfTokenHasContents('blah');
            })
            .to.throw('Invalid nfTokenIdx argument');
        });

        it('should fail checking if token has contents (invalid parameter: too low)', function () {
            expect(() => {
                nfAssetIssuance.nfTokenHasContents(-1);
            })
            .to.throw('Invalid nfTokenIdx argument');
        });

        it('should fail checking if token has contents (invalid parameter: too high)', function () {
            expect(() => {
                nfAssetIssuance.nfTokenHasContents(3);
            })
            .to.throw('Invalid nfTokenIdx argument');
        });

        it('should correctly indicate that token has contents', function () {
            expect(nfAssetIssuance.nfTokenHasContents(0)).to.be.true;
        });

        it('should correctly indicate that token does not have contents', function () {
            expect(nfAssetIssuance.nfTokenHasContents(1)).to.be.false;
        });

        it('should fail getting token contents parts (invalid parameter: not a number)', function () {
            expect(() => {
                nfAssetIssuance.getNFTokenContentsParts('blah');
            })
            .to.throw('Invalid nfTokenIdx argument');
        });

        it('should fail getting token contents parts (invalid parameter: too low)', function () {
            expect(() => {
                nfAssetIssuance.getNFTokenContentsParts(-1);
            })
            .to.throw('Invalid nfTokenIdx argument');
        });

        it('should fail getting token contents parts (invalid parameter: too high)', function () {
            expect(() => {
                nfAssetIssuance.getNFTokenContentsParts(3);
            })
            .to.throw('Invalid nfTokenIdx argument');
        });

        it('should fail getting token contents parts (not complete)', function () {
            expect(() => {
                nfAssetIssuance.getNFTokenContentsParts(0);
            })
            .to.throw('Unable to get non-fungible token\'s issuing parts: non-fungible asset issuance data not yet complete');
        });

        it('should fail getting tokens metadata (invalid parameter)', function () {
            expect(() => {
                nfAssetIssuance.getNFTokensMetadata(null);
            })
            .to.throw('Invalid contentsCIDs argument');
        });

        it('should fail getting tokens metadata (not complete)', function () {
            expect(() => {
                nfAssetIssuance.getNFTokensMetadata({});
            })
            .to.throw('Unable to get non-fungible tokens\' metadata: non-fungible asset issuance data not yet complete');
        });

        it('should fail getting tokens metadata for size estimate (not complete)', function () {
            expect(() => {
                nfAssetIssuance._getNFTokensMetadataForSizeEstimate();
            })
            .to.throw('Unable to get non-fungible tokens\' metadata for size estimate: non-fungible asset issuance data not yet complete');
        });

        it('should fail updating issuance progress (invalid parameter: not a number)', function () {
            expect(() => {
                nfAssetIssuance.updateIssuanceProgress('blah');
            })
            .to.throw('Invalid bytesStored argument');
        });

        it('should fail updating issuance progress (invalid parameter: too low)', function () {
            expect(() => {
                nfAssetIssuance.updateIssuanceProgress(-1);
            })
            .to.throw('Invalid bytesStored argument');
        });

        it('should fail updating issuance progress (not complete)', function () {
            expect(() => {
                nfAssetIssuance.updateIssuanceProgress(10);
            })
            .to.throw('Unable to update issuance progress: non-fungible asset issuance data not yet complete');
        });

        it('should fail finalizing issuance progress (invalid parameter: tokenIds)', function () {
            expect(() => {
                nfAssetIssuance.finalizeIssuanceProgress(null, 'blah', 'a000001');
            })
            .to.throw('Invalid tokenIds argument');
        });

        it('should fail finalizing issuance progress (invalid parameter: assetId)', function () {
            expect(() => {
                nfAssetIssuance.finalizeIssuanceProgress(null, ['t00001'], null);
            })
            .to.throw('Invalid assetId argument');
        });

        it('should fail finalizing issuance progress (not complete)', function () {
            expect(() => {
                nfAssetIssuance.finalizeIssuanceProgress(null, ['t00001'], 'a000001');
            })
            .to.throw('Unable to finalize issuance progress: non-fungible asset issuance data not yet complete');
        });

        it('should fail retrieving issuance progress (not complete)', function () {
            expect(() => {
                nfAssetIssuance.getIssuanceProgress();
            })
            .to.throw('Unable to retrieve issuance progress: non-fungible asset issuance data not yet complete');
        });

        it('should correctly instantiate non-fungible asset issuance object from the database', function () {
            dbNFAssetIssuance = new NFAssetIssuance(
                Catenis.db.collection.NonFungibleAssetIssuance.findOne(nfAssetIssuance.doc_id),
                true
            );
            filteredNFAssetIssuance = _und.mapObject(nfAssetIssuance, (val, key) => {
                if (key === 'nfTokenIssuingBatches') {
                    return val.map(obj => _und.mapObject(
                        _und.omit(obj, '_nfAssetIssuance'),
                        (val, key) => {
                            if (key === 'nfTokenIssuingParts') {
                                return val.map(obj => _und.omit(obj, '_nfTokenIssuingBatch'));
                            }
                            else {
                                return val;
                            }
                        }
                    ));
                }
                else {
                    return val;
                }
            });

            expect(_und.omit(dbNFAssetIssuance, [
                'assetId',
                'tokenIds',
                'progress'
            ]))
            .to.deep.equal(filteredNFAssetIssuance);
        });

        it('should fail retrieving non-fungible asset issuance by ID (invalid ID)', function () {
            expect(() => {
                NFAssetIssuance.getNFAssetIssuanceByAssetIssuanceId('blah');
            })
            .to.throw('Unable to find non-fungible asset issuance with the given asset issuance ID');
        });

        it('should fail retrieving non-fungible asset issuance by ID (wrong device)', function () {
            expect(() => {
                NFAssetIssuance.getNFAssetIssuanceByAssetIssuanceId(nfAssetIssuance.assetIssuanceId, 'd00003');
            })
            .to.throw('Non-fungible asset issuance belongs to a different device');
        });

        it('should successfully retrieve non-fungible asset issuance by ID', function () {
            const retrievedNFAssetIssuance = NFAssetIssuance.getNFAssetIssuanceByAssetIssuanceId(
                nfAssetIssuance.assetIssuanceId,
                'd00001',
                true
            );

            expect(retrievedNFAssetIssuance).to.deep.equal(dbNFAssetIssuance);
        });

        it('should fail retrieving non-fungible asset issuance by continuation token (invalid continuation token)', function () {
            expect(() => {
                NFAssetIssuance.getNFAssetIssuanceByContinuationToken('blah');
            })
            .to.throw('Unable to find non-fungible asset issuance for the given continuation token');
        });

        it('should fail retrieving non-fungible asset issuance by continuation token (wrong device)', function () {
            expect(() => {
                NFAssetIssuance.getNFAssetIssuanceByContinuationToken(firstContinuationToken, 'd00003');
            })
            .to.throw('Non-fungible asset issuance belongs to a different device');
        });

        it('should fail retrieving non-fungible asset issuance by continuation token (wrong operation)', function () {
            expect(() => {
                NFAssetIssuance.getNFAssetIssuanceByContinuationToken(firstContinuationToken, 'd00003', 'a00001');
            })
            .to.throw('Non-fungible asset issuance is not for the expected operation');
        });

        it('should successfully retrieve non-fungible asset issuance by continuation token', function () {
            const retrievedNFAssetIssuance = NFAssetIssuance.getNFAssetIssuanceByContinuationToken(
                firstContinuationToken,
                'd00001',
                undefined,
                true
            );

            expect(retrievedNFAssetIssuance).to.deep.equal(dbNFAssetIssuance);
        });

        describe('Complete non-fungible asset issuance with one more batch', function () {
            const finalNFTokenInfos = [
                null,
                null,
                {
                    contents: Buffer.from('NFT #3 contents (cont.): blah, blah, blah, blah, blah, blah, blah, blah'
                        + ', blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                        + ', blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                        + ', blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                        + ', blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                        + ', blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                        + ', blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                        + ', blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                        + ', blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                        + ', blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                        + ', blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                        + ', blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                        + ', blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                        + ', blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                        + ', blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                        + ', blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                        + ', blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
                        + ', blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah')
                }
            ];
            let savedProgress;

            it('should add new non-fungible token issuing batch without finalizing issuance', function () {
                nfAssetIssuance.newNFTokenIssuingBatch(finalNFTokenInfos, false);

                expect(nfAssetIssuance.nextBatchOrder).to.equal(3);
                expect(nfAssetIssuance.isComplete).to.be.false;
            });

            it('should successfully finalize non-fungible asset issuance', function () {
                nfAssetIssuance.newNFTokenIssuingBatch();

                expect(nfAssetIssuance.nextBatchOrder).to.equal(3);
                expect(nfAssetIssuance.isComplete).to.be.true;
            });

            it('should correctly instantiate non-fungible asset issuance object from the database', function () {
                dbNFAssetIssuance = new NFAssetIssuance(
                    Catenis.db.collection.NonFungibleAssetIssuance.findOne(nfAssetIssuance.doc_id),
                    true
                );
                filteredNFAssetIssuance = _und.mapObject(nfAssetIssuance, (val, key) => {
                    if (key === 'nfTokenIssuingBatches') {
                        return val.map(obj => _und.mapObject(
                            _und.omit(obj, '_nfAssetIssuance'),
                            (val, key) => {
                                if (key === 'nfTokenIssuingParts') {
                                    return val.map(obj => _und.omit(obj, '_nfTokenIssuingBatch'));
                                }
                                else {
                                    return val;
                                }
                            }
                        ));
                    }
                    else {
                        return val;
                    }
                });

                expect(_und.omit(dbNFAssetIssuance, [
                    'assetId',
                    'tokenIds',
                    'progress'
                ]))
                .to.deep.equal(filteredNFAssetIssuance);
            });

            it('should successfully retrieve tokens with contents', function () {
                expect(nfAssetIssuance.nfTokensWithContents).to.deep.equal([0,2]);
            });

            it('should successfully get the total length of the non-fungible tokens\' contents', function () {
                expect(nfAssetIssuance._totalContentsBytes).to.be.undefined;

                const totalNFTokensContentsBytes = nfAssetIssuance._totalNFTokensContentsBytes;

                expect(totalNFTokensContentsBytes)
                .to.equal(nfTokenInfos[0].contents.length + nfTokenInfos[2].contents.length
                    + finalNFTokenInfos[2].contents.length);
                expect(nfAssetIssuance._totalContentsBytes).to.equal(totalNFTokensContentsBytes);
            });

            it('should correctly retrieve the token contents parts (token #1)', function () {
                expect(nfAssetIssuance.getNFTokenContentsParts(0))
                .to.be.an('array').with.lengthOf(1);
            });

            it('should correctly retrieve the token contents parts (token #2)', function () {
                expect(nfAssetIssuance.getNFTokenContentsParts(1))
                .to.be.an('array').that.is.empty;
            });

            it('should correctly retrieve the token contents parts (token #3)', function () {
                expect(nfAssetIssuance.getNFTokenContentsParts(2))
                .to.be.an('array').with.lengthOf(2);
            });

            it('should fail getting tokens metadata (inconsistent CIDs: key not a number)', function () {
                expect(() => {
                    nfAssetIssuance.getNFTokensMetadata({
                        'blah': 'QmUkhVi6zRJz5U87jUjK9ZGTazaXLDKLfGbMRHxiai5xUn'
                    });
                })
                .to.throw('Stored non-fungible tokens\' contents CIDs are inconsistent');
            });

            it('should fail getting tokens metadata (inconsistent CIDs: key out of range)', function () {
                expect(() => {
                    nfAssetIssuance.getNFTokensMetadata({
                        4: 'QmUkhVi6zRJz5U87jUjK9ZGTazaXLDKLfGbMRHxiai5xUn'
                    });
                })
                .to.throw('Stored non-fungible tokens\' contents CIDs are inconsistent');
            });

            it('should fail getting tokens metadata (inconsistent CIDs: incomplete)', function () {
                expect(() => {
                    nfAssetIssuance.getNFTokensMetadata({
                        0: 'QmUkhVi6zRJz5U87jUjK9ZGTazaXLDKLfGbMRHxiai5xUn'
                    });
                })
                .to.throw('Stored non-fungible tokens\' contents CIDs are inconsistent');
            });

            it('should fail getting tokens metadata (inconsistent CIDs: token without contents)', function () {
                expect(() => {
                    // Simulate non-fungible asset issuance without non-fungible token encryption
                    const encryptContents = nfAssetIssuance.nonFungibleToken.encryptContents;
                    nfAssetIssuance.nonFungibleToken.encryptContents = false;

                    try {
                        nfAssetIssuance.getNFTokensMetadata({
                            0: 'QmUkhVi6zRJz5U87jUjK9ZGTazaXLDKLfGbMRHxiai5xUn',
                            1: 'QmWHyrPWQnsz1wxHR219ooJDYTvxJPyZuDUPSDpdsAovN5',
                            2: 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG'
                        });
                    }
                    finally {
                        // Reset non-fungible token contents encryption
                        nfAssetIssuance.nonFungibleToken.encryptContents = encryptContents;
                    }
                })
                .to.throw('Stored non-fungible tokens\' contents CIDs are inconsistent');
            });

            it('should correctly retrieve tokens metadata (shared, encrypted stored non-fungible token contents)', function () {
                expect(nfAssetIssuance.getNFTokensMetadata({
                    0: 'QmUkhVi6zRJz5U87jUjK9ZGTazaXLDKLfGbMRHxiai5xUn',
                    2: 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG'
                }))
                .to.deep.equal([
                    {
                        name: 'Test NFT #1',
                        description: 'Non-fungible token #1 used for testing',
                        contents: new NFTokenContentsUrl('QmUkhVi6zRJz5U87jUjK9ZGTazaXLDKLfGbMRHxiai5xUn'),
                        contentsEncrypted: true
                    },
                    {
                        name: 'Test NFT #2',
                        description: 'Non-fungible token #2 used for testing',
                        contents: new NFTokenContentsUrl('QmUkhVi6zRJz5U87jUjK9ZGTazaXLDKLfGbMRHxiai5xUn'),
                        contentsEncrypted: true
                    },
                    {
                        name: 'Test NFT #3',
                        description: 'Non-fungible token #3 used for testing',
                        contents: new NFTokenContentsUrl('QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG'),
                        contentsEncrypted: true
                    }
                ]);
            });

            it('should correctly retrieve tokens metadata (non-shared, encrypted stored non-fungible token contents)', function () {
                expect(nfAssetIssuance.getNFTokensMetadata({
                    0: 'QmUkhVi6zRJz5U87jUjK9ZGTazaXLDKLfGbMRHxiai5xUn',
                    1: 'QmWHyrPWQnsz1wxHR219ooJDYTvxJPyZuDUPSDpdsAovN5',
                    2: 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG'
                }))
                .to.deep.equal([
                    {
                        name: 'Test NFT #1',
                        description: 'Non-fungible token #1 used for testing',
                        contents: new NFTokenContentsUrl('QmUkhVi6zRJz5U87jUjK9ZGTazaXLDKLfGbMRHxiai5xUn'),
                        contentsEncrypted: true
                    },
                    {
                        name: 'Test NFT #2',
                        description: 'Non-fungible token #2 used for testing',
                        contents: new NFTokenContentsUrl('QmWHyrPWQnsz1wxHR219ooJDYTvxJPyZuDUPSDpdsAovN5'),
                        contentsEncrypted: true
                    },
                    {
                        name: 'Test NFT #3',
                        description: 'Non-fungible token #3 used for testing',
                        contents: new NFTokenContentsUrl('QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG'),
                        contentsEncrypted: true
                    }
                ]);
            });

            it('should correctly retrieve tokens metadata for size estimate', function () {
                expect(nfAssetIssuance._getNFTokensMetadataForSizeEstimate())
                .to.deep.equal([
                    {
                        name: 'Test NFT #1',
                        description: 'Non-fungible token #1 used for testing',
                        contents: NFTokenContentsUrl.dummyUrl,
                        contentsEncrypted: true
                    },
                    {
                        name: 'Test NFT #2',
                        description: 'Non-fungible token #2 used for testing',
                        contents: NFTokenContentsUrl.dummyUrl,
                        contentsEncrypted: true
                    },
                    {
                        name: 'Test NFT #3',
                        description: 'Non-fungible token #3 used for testing',
                        contents: NFTokenContentsUrl.dummyUrl,
                        contentsEncrypted: true
                    }
                ]);
            });

            it('should correctly retrieve the estimated size of the non-fungible asset metadata', function () {
                expect(nfAssetIssuance._estimatedMetadataSize).to.be.undefined;

                const estimatedAssetMetadataSize = nfAssetIssuance._estimatedAssetMetadataSize;

                expect(estimatedAssetMetadataSize).to.equal(5114);
                expect(nfAssetIssuance._estimatedMetadataSize).to.equal(estimatedAssetMetadataSize);
            });

            it('should correctly retrieve issuance progress (no contents and no metadata stored)', function () {
                expect(nfAssetIssuance.progress).to.equal(undefined);

                expect(nfAssetIssuance.getIssuanceProgress()).to.deep.equal({
                    progress: {
                        percentProcessed: 0,
                        done: false
                    }
                });
                expect(nfAssetIssuance.progress).to.deep.equal({
                    totalContentsBytes: nfAssetIssuance._totalNFTokensContentsBytes,
                    contentsBytesStored: 0,
                    totalMetadataBytes: nfAssetIssuance._estimatedAssetMetadataSize,
                    metadataBytesStored: 0,
                    done: false
                });
            });

            it('should successfully update issuance progress (initial 1,000 contents bytes, and no metadata)', function () {
                nfAssetIssuance.updateIssuanceProgress(1000, true);

                expect(nfAssetIssuance.progress).to.deep.equal({
                    totalContentsBytes: nfAssetIssuance._totalNFTokensContentsBytes,
                    contentsBytesStored: 1000,
                    totalMetadataBytes: nfAssetIssuance._estimatedAssetMetadataSize,
                    metadataBytesStored: 0,
                    done: false
                });

                // Make sure that database was correctly updated
                dbNFAssetIssuance = new NFAssetIssuance(
                    Catenis.db.collection.NonFungibleAssetIssuance.findOne(nfAssetIssuance.doc_id),
                    true
                );
                filteredNFAssetIssuance = _und.mapObject(
                    _und.omit(nfAssetIssuance, '_estimatedMetadataSize', '_totalContentsBytes'),
                    (val, key) => {
                        if (key === 'nfTokenIssuingBatches') {
                            return val.map(obj => _und.mapObject(
                                _und.omit(obj, '_nfAssetIssuance'),
                                (val, key) => {
                                    if (key === 'nfTokenIssuingParts') {
                                        return val.map(obj => _und.omit(obj, '_nfTokenIssuingBatch'));
                                    }
                                    else {
                                        return val;
                                    }
                                }
                            ));
                        }
                        else {
                            return val;
                        }
                    }
                );

                expect(_und.omit(dbNFAssetIssuance, [
                    'assetId',
                    'tokenIds'
                ]))
                .to.deep.equal(filteredNFAssetIssuance);
            });

            it('should correctly retrieve issuance progress (1,000 contents and no metadata stored)', function () {
                const percentProcessed = Math.floor(
                    (1000 / (nfAssetIssuance._totalNFTokensContentsBytes
                        + nfAssetIssuance._estimatedAssetMetadataSize)) * 95
                );
                console.debug('>>>>>> percentProcessed:', percentProcessed);

                expect(nfAssetIssuance.getIssuanceProgress()).to.deep.equal({
                    progress: {
                        percentProcessed,
                        done: false
                    }
                });
            });

            it('should successfully update issuance progress (remaining contents bytes, and no metadata)', function () {
                nfAssetIssuance.updateIssuanceProgress(nfAssetIssuance._totalNFTokensContentsBytes - 1000, true);

                expect(nfAssetIssuance.progress).to.deep.equal({
                    totalContentsBytes: nfAssetIssuance._totalNFTokensContentsBytes,
                    contentsBytesStored: nfAssetIssuance._totalNFTokensContentsBytes,
                    totalMetadataBytes: nfAssetIssuance._estimatedAssetMetadataSize,
                    metadataBytesStored: 0,
                    done: false
                });

                // Make sure that database was correctly updated
                dbNFAssetIssuance = new NFAssetIssuance(
                    Catenis.db.collection.NonFungibleAssetIssuance.findOne(nfAssetIssuance.doc_id),
                    true
                );
                filteredNFAssetIssuance = _und.mapObject(
                    _und.omit(nfAssetIssuance, '_estimatedMetadataSize', '_totalContentsBytes'),
                    (val, key) => {
                        if (key === 'nfTokenIssuingBatches') {
                            return val.map(obj => _und.mapObject(
                                _und.omit(obj, '_nfAssetIssuance'),
                                (val, key) => {
                                    if (key === 'nfTokenIssuingParts') {
                                        return val.map(obj => _und.omit(obj, '_nfTokenIssuingBatch'));
                                    }
                                    else {
                                        return val;
                                    }
                                }
                            ));
                        }
                        else {
                            return val;
                        }
                    }
                );

                expect(_und.omit(dbNFAssetIssuance, [
                    'assetId',
                    'tokenIds'
                ]))
                .to.deep.equal(filteredNFAssetIssuance);
            });

            it('should correctly retrieve issuance progress (all contents and no metadata stored)', function () {
                const percentProcessed = Math.floor(
                    (nfAssetIssuance._totalNFTokensContentsBytes / (nfAssetIssuance._totalNFTokensContentsBytes
                        + nfAssetIssuance._estimatedAssetMetadataSize)) * 95
                );
                console.debug('>>>>>> percentProcessed:', percentProcessed);

                expect(nfAssetIssuance.getIssuanceProgress()).to.deep.equal({
                    progress: {
                        percentProcessed,
                        done: false
                    }
                });
            });

            it('should successfully update issuance progress (all contents, and first 1,200 bytes of metadata)', function () {
                nfAssetIssuance.updateIssuanceProgress(1200, false);

                expect(nfAssetIssuance.progress).to.deep.equal({
                    totalContentsBytes: nfAssetIssuance._totalNFTokensContentsBytes,
                    contentsBytesStored: nfAssetIssuance._totalNFTokensContentsBytes,
                    totalMetadataBytes: nfAssetIssuance._estimatedAssetMetadataSize,
                    metadataBytesStored: 1200,
                    done: false
                });

                // Make sure that database was correctly updated
                dbNFAssetIssuance = new NFAssetIssuance(
                    Catenis.db.collection.NonFungibleAssetIssuance.findOne(nfAssetIssuance.doc_id),
                    true
                );
                filteredNFAssetIssuance = _und.mapObject(
                    _und.omit(nfAssetIssuance, '_estimatedMetadataSize', '_totalContentsBytes'),
                    (val, key) => {
                        if (key === 'nfTokenIssuingBatches') {
                            return val.map(obj => _und.mapObject(
                                _und.omit(obj, '_nfAssetIssuance'),
                                (val, key) => {
                                    if (key === 'nfTokenIssuingParts') {
                                        return val.map(obj => _und.omit(obj, '_nfTokenIssuingBatch'));
                                    }
                                    else {
                                        return val;
                                    }
                                }
                            ));
                        }
                        else {
                            return val;
                        }
                    }
                );

                expect(_und.omit(dbNFAssetIssuance, [
                    'assetId',
                    'tokenIds'
                ]))
                .to.deep.equal(filteredNFAssetIssuance);
            });

            it('should correctly retrieve issuance progress (all contents and 1,200 bytes of metadata stored)', function () {
                const percentProcessed = Math.floor(
                    ((nfAssetIssuance._totalNFTokensContentsBytes + 1200) / (nfAssetIssuance._totalNFTokensContentsBytes
                        + nfAssetIssuance._estimatedAssetMetadataSize)) * 95
                );
                console.debug('>>>>>> percentProcessed:', percentProcessed);

                expect(nfAssetIssuance.getIssuanceProgress()).to.deep.equal({
                    progress: {
                        percentProcessed,
                        done: false
                    }
                });
            });

            it('should successfully update issuance progress (all contents, and remaining bytes of metadata)', function () {
                nfAssetIssuance.updateIssuanceProgress(nfAssetIssuance._estimatedAssetMetadataSize - 1200, false);

                expect(nfAssetIssuance.progress).to.deep.equal({
                    totalContentsBytes: nfAssetIssuance._totalNFTokensContentsBytes,
                    contentsBytesStored: nfAssetIssuance._totalNFTokensContentsBytes,
                    totalMetadataBytes: nfAssetIssuance._estimatedAssetMetadataSize,
                    metadataBytesStored: nfAssetIssuance._estimatedAssetMetadataSize,
                    done: false
                });

                // Make sure that database was correctly updated
                dbNFAssetIssuance = new NFAssetIssuance(
                    Catenis.db.collection.NonFungibleAssetIssuance.findOne(nfAssetIssuance.doc_id),
                    true
                );
                filteredNFAssetIssuance = _und.mapObject(
                    _und.omit(nfAssetIssuance, '_estimatedMetadataSize', '_totalContentsBytes'),
                    (val, key) => {
                        if (key === 'nfTokenIssuingBatches') {
                            return val.map(obj => _und.mapObject(
                                _und.omit(obj, '_nfAssetIssuance'),
                                (val, key) => {
                                    if (key === 'nfTokenIssuingParts') {
                                        return val.map(obj => _und.omit(obj, '_nfTokenIssuingBatch'));
                                    }
                                    else {
                                        return val;
                                    }
                                }
                            ));
                        }
                        else {
                            return val;
                        }
                    }
                );

                expect(_und.omit(dbNFAssetIssuance, [
                    'assetId',
                    'tokenIds'
                ]))
                .to.deep.equal(filteredNFAssetIssuance);
            });

            it('should correctly retrieve issuance progress (all contents and all metadata stored)', function () {
                const percentProcessed = Math.floor(
                    ((nfAssetIssuance._totalNFTokensContentsBytes + nfAssetIssuance._estimatedAssetMetadataSize)
                        / (nfAssetIssuance._totalNFTokensContentsBytes + nfAssetIssuance._estimatedAssetMetadataSize))
                        * 95
                );
                console.debug('>>>>>> percentProcessed:', percentProcessed);

                expect(nfAssetIssuance.getIssuanceProgress()).to.deep.equal({
                    progress: {
                        percentProcessed,
                        done: false
                    }
                });
            });

            it('should fail finalizing issuance progress (missing tokenIds and assetId)', function () {
                expect(() => {
                    nfAssetIssuance.finalizeIssuanceProgress(null)
                })
                .to.throw('Unable to finalize issuance progress: missing or inconsistent number of non-fungible token IDs; missing non-fungible asset Id');
            });

            it('should fail finalizing issuance progress (inconsistent tokenIds)', function () {
                expect(() => {
                    nfAssetIssuance.finalizeIssuanceProgress(null, ['tk00001', 'tk000002'], 'a00001');
                })
                .to.throw('Unable to finalize issuance progress: missing or inconsistent number of non-fungible token IDs');
            });

            it('should fail finalizing issuance progress (missing assetId)', function () {
                expect(() => {
                    nfAssetIssuance.finalizeIssuanceProgress(null, ['tk00001', 'tk000002', 'tk00003']);
                })
                .to.throw('Unable to finalize issuance progress: missing non-fungible asset Id');
            });

            it('should correctly finalize issuance progress (no contents and no metadata stored, error)', function () {
                // Save current issuance progress, and clear it
                savedProgress = nfAssetIssuance.progress;
                nfAssetIssuance.progress = undefined;

                nfAssetIssuance.finalizeIssuanceProgress(new Error('Sample error'));

                expect(_und.omit(nfAssetIssuance.progress, 'finishDate'))
                .to.deep.equal({
                    totalContentsBytes: nfAssetIssuance._totalNFTokensContentsBytes,
                    contentsBytesStored: 0,
                    totalMetadataBytes: nfAssetIssuance._estimatedAssetMetadataSize,
                    metadataBytesStored: 0,
                    done: true,
                    success: false,
                    error: {
                        code: 500,
                        message: 'Internal server error'
                    }
                });
                expect(nfAssetIssuance.progress.finishDate).to.be.a('date');

                // Make sure that database was correctly updated
                dbNFAssetIssuance = new NFAssetIssuance(
                    Catenis.db.collection.NonFungibleAssetIssuance.findOne(nfAssetIssuance.doc_id),
                    true
                );
                filteredNFAssetIssuance = _und.mapObject(
                    _und.omit(nfAssetIssuance, '_estimatedMetadataSize', '_totalContentsBytes'),
                    (val, key) => {
                        if (key === 'nfTokenIssuingBatches') {
                            return val.map(obj => _und.mapObject(
                                _und.omit(obj, '_nfAssetIssuance'),
                                (val, key) => {
                                    if (key === 'nfTokenIssuingParts') {
                                        return val.map(obj => _und.omit(obj, '_nfTokenIssuingBatch'));
                                    }
                                    else {
                                        return val;
                                    }
                                }
                            ));
                        }
                        else {
                            return val;
                        }
                    }
                );

                expect(_und.omit(dbNFAssetIssuance, [
                    'assetId',
                    'tokenIds'
                ]))
                .to.deep.equal(filteredNFAssetIssuance);
            });

            it('should correctly retrieve issuance progress (no contents and no metadata stored, error)', function () {
                expect(nfAssetIssuance.getIssuanceProgress()).to.deep.equal({
                    progress: {
                        percentProcessed: 0,
                        done: true,
                        success: false,
                        error: {
                            code: 500,
                            message: 'Internal server error'
                        }
                    }
                });
            });

            it('should correctly finalize issuance progress (all contents and all metadata stored, success)', function () {
                // Reset issuance progress
                nfAssetIssuance.progress = savedProgress;

                nfAssetIssuance.finalizeIssuanceProgress(
                    null,
                    [
                        'tk00001',
                        'tk00002',
                        'tk00003'
                    ],
                    'a00001'
                );

                expect(_und.omit(nfAssetIssuance.progress, 'finishDate'))
                .to.deep.equal({
                    totalContentsBytes: nfAssetIssuance._totalNFTokensContentsBytes,
                    contentsBytesStored: nfAssetIssuance._totalNFTokensContentsBytes,
                    totalMetadataBytes: nfAssetIssuance._estimatedAssetMetadataSize,
                    metadataBytesStored: nfAssetIssuance._estimatedAssetMetadataSize,
                    done: true,
                    success: true
                });
                expect(nfAssetIssuance.assetId).to.equal('a00001');
                expect(nfAssetIssuance.tokenIds).to.deep.equal([
                    'tk00001',
                    'tk00002',
                    'tk00003'
                ]);

                // Make sure that database was correctly updated
                dbNFAssetIssuance = new NFAssetIssuance(
                    Catenis.db.collection.NonFungibleAssetIssuance.findOne(nfAssetIssuance.doc_id),
                    true
                );
                filteredNFAssetIssuance = _und.mapObject(
                    _und.omit(nfAssetIssuance, '_estimatedMetadataSize', '_totalContentsBytes'),
                    (val, key) => {
                        if (key === 'nfTokenIssuingBatches') {
                            return val.map(obj => _und.mapObject(
                                _und.omit(obj, '_nfAssetIssuance'),
                                (val, key) => {
                                    if (key === 'nfTokenIssuingParts') {
                                        return val.map(obj => _und.omit(obj, '_nfTokenIssuingBatch'));
                                    }
                                    else {
                                        return val;
                                    }
                                }
                            ));
                        }
                        else {
                            return val;
                        }
                    }
                );

                expect(dbNFAssetIssuance)
                .to.deep.equal(filteredNFAssetIssuance);
            });

            it('should correctly retrieve issuance progress (all contents and all metadata stored, success)', function () {
                expect(nfAssetIssuance.getIssuanceProgress()).to.deep.equal({
                    progress: {
                        percentProcessed: 100,
                        done: true,
                        success: true
                    },
                    result: {
                        assetId: 'a00001',
                        tokenIds: [
                            'tk00001',
                            'tk00002',
                            'tk00003'
                        ]
                    }
                });
            });

            it('should fail updating issuance progress (issuance progress already finalized)', function () {
                expect(() => {
                    nfAssetIssuance.updateIssuanceProgress(10);
                })
                .to.throw('Trying to update non-fungible asset issuance progress that has already been finalized');
            });

            it('should successfully retrieve non-fungible asset issuance by ID', function () {
                const retrievedNFAssetIssuance = NFAssetIssuance.getNFAssetIssuanceByAssetIssuanceId(
                    nfAssetIssuance.assetIssuanceId,
                    'd00001',
                    true
                );

                expect(retrievedNFAssetIssuance).to.deep.equal(dbNFAssetIssuance);
            });

            it('should fail retrieving non-fungible asset issuance by continuation token (wrong continuation token)', function () {
                expect(() => {
                    NFAssetIssuance.getNFAssetIssuanceByContinuationToken(firstContinuationToken);
                })
                .to.throw('Continuation token does not match the non-fungible asset issuance\'s continuation token');
            });

            it('should successfully retrieve non-fungible asset issuance by continuation token', function () {
                const retrievedNFAssetIssuance = NFAssetIssuance.getNFAssetIssuanceByContinuationToken(
                    nfAssetIssuance.continuationToken,
                    'd00001',
                    undefined,
                    true
                );

                expect(retrievedNFAssetIssuance).to.deep.equal(dbNFAssetIssuance);
            });
        });
    });

    describe('Asset reissuance', function () {
        let nfAssetIssuance;
        let firstContinuationToken;

        before(function () {
            nfAssetIssuance = new NFAssetIssuance(
                undefined,
                undefined,
                'd00001',
                'a00001',
                false,
                'd00001',
                [{
                    metadata: {
                        name: 'Test NFT #1 (reissuance)',
                        description: 'Non-fungible token #1 used for testing reissuance',
                    },
                    contents: Buffer.from('NFT #1 contents (reissuance)')
                }],
                true,
                false
            );
        });

        it('should successfully retrieve a non-empty continuation token', function () {
            expect(firstContinuationToken = nfAssetIssuance.continuationToken).to.not.equal(undefined);
        });

        it('should fail retrieving non-fungible asset issuance by continuation token (wrong asset)', function () {
            expect(() => {
                NFAssetIssuance.getNFAssetIssuanceByContinuationToken(firstContinuationToken, 'd00001', 'a00002');
            })
            .to.throw('Non-fungible asset reissuance is for a different asset');
        });
    });

    describe('Purge old non-fungible asset issuances', function () {
        const now = new Date();
        const inIncompleteDate = new Date(now);
        inIncompleteDate.setHours(inIncompleteDate.getHours() - 2);
        const inProcessedDate = new Date(now);
        inProcessedDate.setHours(inProcessedDate.getHours() - 25);
        const outDate = new Date(now);

        const docsNFAssetIssuance = [
            // Not yet processed
            {
                _id: '_i00001',
                assetIssuanceId: 'i00001',
                createdDate: inIncompleteDate
            },
            {
                _id: '_i00002',
                assetIssuanceId: 'i00002',
                createdDate: inIncompleteDate
            },
            {
                _id: '_i00003',
                assetIssuanceId: 'i00003',
                createdDate: inIncompleteDate
            },
            {
                _id: '_i00004',
                assetIssuanceId: 'i00004',
                createdDate: outDate
            },
            {
                _id: '_i00005',
                assetIssuanceId: 'i00005',
                createdDate: inIncompleteDate
            },
            {
                _id: '_i00006',
                assetIssuanceId: 'i00006',
                createdDate: outDate
            },
            // Already processed
            {
                _id: '_i00007',
                assetIssuanceId: 'i00007',
                progress: {
                    done: true,
                    finishDate: inProcessedDate
                },
                createdDate: inProcessedDate
            },
            {
                _id: '_i00008',
                assetIssuanceId: 'i00008',
                progress: {
                    done: true,
                    finishDate: outDate
                },
                createdDate: outDate
            },
        ];
        const docsNFTokenIssuingBatch = [
            // Asset issuance #1
            {
                _id: '_b00001',
                nfTokenIssuingBatchId: 'b00001',
                nonFungibleAssetIssuance_id: '_i00001',
                order: 1,
                isFinal: false,
                createdDate: inIncompleteDate,
            },
            {
                _id: '_b00002',
                nfTokenIssuingBatchId: 'b00002',
                nonFungibleAssetIssuance_id: '_i00001',
                order: 2,
                isFinal: true,
                createdDate: inIncompleteDate,
            },
            // Asset issuance #2
            {
                _id: '_b00003',
                nfTokenIssuingBatchId: 'b00003',
                nonFungibleAssetIssuance_id: '_i00002',
                order: 1,
                isFinal: false,
                createdDate: inIncompleteDate,
            },
            // Asset issuance #3
            {
                _id: '_b00004',
                nfTokenIssuingBatchId: 'b00004',
                nonFungibleAssetIssuance_id: '_i00003',
                order: 1,
                isFinal: false,
                createdDate: inIncompleteDate,
            },
            {
                _id: '_b00005',
                nfTokenIssuingBatchId: 'b00005',
                nonFungibleAssetIssuance_id: '_i00003',
                order: 2,
                isFinal: false,
                createdDate: inIncompleteDate,
            },
            // Asset issuance #4
            {
                _id: '_b00006',
                nfTokenIssuingBatchId: 'b00006',
                nonFungibleAssetIssuance_id: '_i00004',
                order: 1,
                isFinal: false,
                createdDate: inIncompleteDate,
            },
            {
                _id: '_b00007',
                nfTokenIssuingBatchId: 'b00007',
                nonFungibleAssetIssuance_id: '_i00004',
                order: 2,
                isFinal: true,
                createdDate: outDate,
            },
            // Asset issuance #7
            {
                _id: '_b00008',
                nfTokenIssuingBatchId: 'b00008',
                nonFungibleAssetIssuance_id: '_i00007',
                order: 1,
                isFinal: false,
                createdDate: inProcessedDate,
            },
            {
                _id: '_b00009',
                nfTokenIssuingBatchId: 'b00009',
                nonFungibleAssetIssuance_id: '_i00007',
                order: 2,
                isFinal: true,
                createdDate: inProcessedDate,
            },
            // Asset issuance #8
            {
                _id: '_b00010',
                nfTokenIssuingBatchId: 'b00010',
                nonFungibleAssetIssuance_id: '_i00008',
                order: 1,
                isFinal: true,
                createdDate: outDate,
            },
        ];
        const docsNFTokenIssuingPart = [
            // Batch #1
            {
                _id: '_p00001',
                nonFungibleTokenIssuingBatch_id: '_b00001',
                index: 0,
                createdDate: inIncompleteDate
            },
            {
                _id: '_p00002',
                nonFungibleTokenIssuingBatch_id: '_b00001',
                index: 1,
                createdDate: inIncompleteDate
            },
            // Batch #2
            {
                _id: '_p00003',
                nonFungibleTokenIssuingBatch_id: '_b00002',
                index: 0,
                createdDate: inIncompleteDate
            },
            {
                _id: '_p00004',
                nonFungibleTokenIssuingBatch_id: '_b00002',
                index: 1,
                createdDate: inIncompleteDate
            },
            // Batch #3
            {
                _id: '_p00005',
                nonFungibleTokenIssuingBatch_id: '_b00003',
                index: 0,
                createdDate: inIncompleteDate
            },
            {
                _id: '_p00006',
                nonFungibleTokenIssuingBatch_id: '_b00003',
                index: 1,
                createdDate: inIncompleteDate
            },
            {
                _id: '_p00007',
                nonFungibleTokenIssuingBatch_id: '_b00003',
                index: 2,
                createdDate: inIncompleteDate
            },
            // Batch #4
            {
                _id: '_p00008',
                nonFungibleTokenIssuingBatch_id: '_b00004',
                index: 0,
                createdDate: inIncompleteDate
            },
            // Batch #5
            {
                _id: '_p00009',
                nonFungibleTokenIssuingBatch_id: '_b00005',
                index: 0,
                createdDate: inIncompleteDate
            },
            // Batch #6
            {
                _id: '_p00010',
                nonFungibleTokenIssuingBatch_id: '_b00006',
                index: 0,
                createdDate: inIncompleteDate
            },
            {
                _id: '_p00011',
                nonFungibleTokenIssuingBatch_id: '_b00006',
                index: 1,
                createdDate: inIncompleteDate
            },
            // Batch #7
            {
                _id: '_p00012',
                nonFungibleTokenIssuingBatch_id: '_b00007',
                index: 0,
                createdDate: outDate
            },
            {
                _id: '_p00013',
                nonFungibleTokenIssuingBatch_id: '_b00007',
                index: 1,
                createdDate: outDate
            },
            // Batch #8
            {
                _id: '_p00014',
                nonFungibleTokenIssuingBatch_id: '_b00008',
                index: 0,
                createdDate: inIncompleteDate
            },
            {
                _id: '_p00015',
                nonFungibleTokenIssuingBatch_id: '_b00008',
                index: 1,
                createdDate: inIncompleteDate
            },
            {
                _id: '_p00016',
                nonFungibleTokenIssuingBatch_id: '_b00008',
                index: 2,
                createdDate: inIncompleteDate
            },
            // Batch #9
            {
                _id: '_p00017',
                nonFungibleTokenIssuingBatch_id: '_b00009',
                index: 0,
                createdDate: inIncompleteDate
            },
            {
                _id: '_p00018',
                nonFungibleTokenIssuingBatch_id: '_b00009',
                index: 1,
                createdDate: inIncompleteDate
            },
            {
                _id: '_p00019',
                nonFungibleTokenIssuingBatch_id: '_b00009',
                index: 2,
                createdDate: inIncompleteDate
            },
            // Batch #10
            {
                _id: '_p00020',
                nonFungibleTokenIssuingBatch_id: '_b00010',
                index: 0,
                createdDate: outDate
            },
        ];

        before(function (done) {
            Promise.all([
                Catenis.db.mongoCollection.NonFungibleAssetIssuance.drop(),
                Catenis.db.mongoCollection.NonFungibleTokenIssuingBatch.drop(),
                Catenis.db.mongoCollection.NonFungibleTokenIssuingPart.drop(),
            ])
            .then(() => {
                docsNFAssetIssuance.forEach(doc => Catenis.db.collection.NonFungibleAssetIssuance.insert(doc));
                docsNFTokenIssuingBatch.forEach(doc => Catenis.db.collection.NonFungibleTokenIssuingBatch.insert(doc));
                docsNFTokenIssuingPart.forEach(doc => Catenis.db.collection.NonFungibleTokenIssuingPart.insert(doc));

                done();
            })
            .catch(err => {
                done(err);
            });
        });

        it('should purge non-fungible asset related database docs', function () {
            expect(Catenis.db.collection.NonFungibleAssetIssuance.find().count()).to.equal(docsNFAssetIssuance.length);
            expect(Catenis.db.collection.NonFungibleTokenIssuingBatch.find().count()).to.equal(docsNFTokenIssuingBatch.length);
            expect(Catenis.db.collection.NonFungibleTokenIssuingPart.find().count()).to.equal(docsNFTokenIssuingPart.length);

            NFAssetIssuance.initialize();

            expect(Catenis.db.collection.NonFungibleAssetIssuance.find().count())
            .to.equal(docsNFAssetIssuance.length - 4);
            expect(Catenis.db.collection.NonFungibleTokenIssuingBatch.find().count())
            .to.equal(docsNFTokenIssuingBatch.length - 5);
            expect(Catenis.db.collection.NonFungibleTokenIssuingPart.find().count())
            .to.equal(docsNFTokenIssuingPart.length - 11);
        })
    });
});
