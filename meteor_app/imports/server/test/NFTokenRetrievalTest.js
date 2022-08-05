/**
 * Created by claudio on 2022-07-04
 */

//console.log('[NFTokenRetrievalTest.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import stream from 'stream';
// Third-party node modules
import { expect } from 'chai';
import _und from 'underscore';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from '../Catenis';
import {
    NFTokenRetrieval,
    cfgSettings as nftRetrievalCfgSettings,
} from '../NFTokenRetrieval';
import { NonFungibleToken } from '../NonFungibleToken';
import { EccLibraryProxy } from '../EccLibraryProxy';
import { Bip32 } from '../Bip32';
import { KeyStore } from '../KeyStore';
import { CatenisNode } from '../CatenisNode';
import { BitcoinInfo } from '../BitcoinInfo';
import { C3NodeClient } from '../C3NodeClient';
import { NFTokenStorage } from '../NFTokenStorage';
import { CCSingleNFTokenMetadata } from '../CCSingleNFTokenMetadata';
import { NFTokenContentsUrl } from '../NFTokenContentsUrl';
import { RetrievedNFTokenData } from '../RetrievedNFTokenData';

const clientIndex = 123;
const ccTokenId = 'Tk97fk8Rg27toQW68faxhnDuYeFEoLC1K4DLji';
const metadata = {
    name: 'Test NFT #1',
    description: 'Non-fungible token #1 used for testing',
    contentsEncrypted: false,
    contents: 'https://ipfs.catenis.io/ipfs/QmUkhVi6zRJz5U87jUjK9ZGTazaXLDKLfGbMRHxiai5xUn',
    custom: {
        custom1: 'Custom property #1',
        custom2: 'Custom property #2'
    }
};
let ccMetadata;
const contentsData = Buffer.from('This is only a test: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
    + '; line #2: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
    + '; line #3: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
    + '; line #4: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
    + '; line #5: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
    + '; line #6: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
    + '; line #7: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
    + '; line #8: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
    + '; line #9: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
    + '; line #10: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
    + '; line #11: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
    + '; line #12: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
    + '; line #13: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
    + '; line #14: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
    + '; line #15: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
    + '; line #16: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
    + '; line #17: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
    + '; line #18: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
    + '; line #19: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
);


describe('NFTokenRetrieval module', function () {
    const deviceIndex = 1;
    const devAssetAddresssKeys = [];
    const devAssetIssueAddressKeys = [];
    let docAsset;
    let docNFToken;
    let nfToken;

    before(function () {
        EccLibraryProxy.initialize();
        Bip32.initialize();
        KeyStore.initialize();
        CatenisNode.initialize();
        C3NodeClient.initialize();

        Catenis.keyStore.initClientHDNodes(Catenis.application.ctnNode.index, clientIndex);
        Catenis.keyStore.initDeviceHDNodes(Catenis.application.ctnNode.index, clientIndex, deviceIndex);

        for (let addrIndex = 0; addrIndex < 2; addrIndex++) {
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

        for (let addrIndex = 0; addrIndex < 1; addrIndex++) {
            devAssetIssueAddressKeys.push(
                Catenis.keyStore.getDeviceAssetIssuanceAddressKeys(
                    Catenis.application.ctnNode.index,
                    clientIndex,
                    deviceIndex,
                    addrIndex,
                    BitcoinInfo.addressType.witness_v0_keyhash
                )
            );
        }

        setCCMetadata();
        resetCatenisNode();
        resetC3NodeClient();
        resetNFTokenStorage();
    });

    describe('Failure instantiating non-fungible token retrieval object', function () {
        before(() => {
            // Simulate (non-fungible) asset database doc/rec
            docAsset = {
                assetId: 'a00001',
                ccAssetId: 'LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v',
                type: 'device',
                name: 'Test NFAsset #1',
                description: 'Non-fungible asset #1 used for testing',
                issuingType: 'locked',
                issuance: {
                    entityId: 'd00001',
                    addrPath: Catenis.keyStore.getAddressInfo(devAssetIssueAddressKeys[0].getAddress()).path,
                },
                divisibility: 0,
                isAggregatable: true,
                isNonFungible: true,
                createdDate: new Date()
            };
            docAsset._id = Catenis.db.collection.Asset.insert(docAsset);

            // Simulate non-fungible token database doc/rec
            docNFToken = {
                asset_id: docAsset._id,
                tokenId: 't00001',
                ccTokenId,
                name: 'Test NFT #1',
                description: 'Non-fungible token #1 used for testing',
                createdDate: new Date()
            };
            docNFToken._id = Catenis.db.collection.NonFungibleToken.insert(docNFToken);

            nfToken = new NonFungibleToken(docNFToken);
        });

        it('should fail to instantiate object: invalid params (deviceId)', function () {
            expect(() => {
                new NFTokenRetrieval(
                    undefined,
                    123,
                    nfToken,
                    Catenis.keyStore.getAddressInfo(devAssetAddresssKeys[0].getAddress()),
                    true,
                    {
                        contentsOnly: false,
                        encoding: 'base64'
                    }
                );
            })
            .to.throw('Invalid deviceId argument');
        });

        it('should fail to instantiate object: invalid params (nfToken)', function () {
            expect(() => {
                new NFTokenRetrieval(
                    undefined,
                    'd00001',
                    {},
                    Catenis.keyStore.getAddressInfo(devAssetAddresssKeys[0].getAddress()),
                    true,
                    {
                        contentsOnly: false,
                        encoding: 'base64'
                    }
                );
            })
            .to.throw('Invalid nfToken argument');
        });

        it('should fail to instantiate object: invalid params (holdingAddressInfo)', function () {
            expect(() => {
                new NFTokenRetrieval(
                    undefined,
                    'd00001',
                    nfToken,
                    null,
                    true,
                    {
                        contentsOnly: false,
                        encoding: 'base64'
                    }
                );
            })
            .to.throw('Invalid holdingAddressInfo argument');
        });

        it('should fail to instantiate object: invalid params (contentsOptions)', function () {
            expect(() => {
                new NFTokenRetrieval(
                    undefined,
                    'd00001',
                    nfToken,
                    Catenis.keyStore.getAddressInfo(devAssetAddresssKeys[0].getAddress()),
                    true,
                    null
                );
            })
            .to.throw('Invalid contentsOptions argument');
        });

        it('should fail to instantiate object: missing contents options', function () {
            expect(() => {
                new NFTokenRetrieval(
                    undefined,
                    'd00001',
                    nfToken,
                    Catenis.keyStore.getAddressInfo(devAssetAddresssKeys[0].getAddress()),
                    true
                );
            })
            .to.throw('Missing contentsOptions argument');
        });
    });

    describe('non-fungible token retrieval with no contents (metadata only)', function () {
        let nfTokenRetrieval;
        let nfTokenRetrievalDB;

        it('should successfully instantiate non-fungible token retrieval object', function () {
            expect(() => {
                nfTokenRetrieval = new NFTokenRetrieval(
                    undefined,
                    'd00001',
                    nfToken,
                    Catenis.keyStore.getAddressInfo(devAssetAddresssKeys[0].getAddress()),
                    false
                );
            })
            .not.to.throw();

            expect(nfTokenRetrieval).to.be.an.instanceof(NFTokenRetrieval);
            expect(nfTokenRetrieval.deviceId).to.equal('d00001');
            expect(nfTokenRetrieval.tokenId).to.equal(nfToken.tokenId);
            expect(nfTokenRetrieval._nfToken).to.equal(nfToken);
            expect(nfTokenRetrieval.holdingAddressInfo).to.deep.equal(Catenis.keyStore.getAddressInfo(devAssetAddresssKeys[0].getAddress()));
            expect(nfTokenRetrieval.holdingDeviceId).to.equal('d00001');
            expect(nfTokenRetrieval.retrieveContents).to.be.false;
            expect(nfTokenRetrieval.contentsOptions).to.be.undefined;
            expect(nfTokenRetrieval.progress).to.deep.equal({
                metadataBytesRetrieved: 0,
                contentsBytesRetrieved: 0,
                done: false
            });
            expect(nfTokenRetrieval.delivery).to.be.undefined;
            expect(nfTokenRetrieval.contentsInfo).to.be.undefined;
            expect(nfTokenRetrieval._nextRetrievedNFTokenData).to.be.undefined;
            expect(nfTokenRetrieval._isSavedToDB).to.be.true;
            expect(nfTokenRetrieval.tokenRetrievalId).to.match(/^r[\dA-Za-z]{19}$/);
            expect(nfTokenRetrieval._isFinalDataRetrieved).to.be.false;
            expect(() => {
                nfTokenRetrieval._lastRetrievedContentsData;
            })
            .to.throw('Unable to find last retrieved non-fungible token contents data');
            expect(nfTokenRetrieval.ccTokenId).to.equal(nfToken.ccTokenId);
            expect(nfTokenRetrieval.nextContinuationToken).to.be.undefined;
            expect(nfTokenRetrieval.nextDataOrder).to.equal(1);
            expect(nfTokenRetrieval.contentsDataChunkSize).to.be.undefined;
        });

        it('should fail trying to set the holdings properties (invalid address path)', function () {
            expect(() => {
                nfTokenRetrieval._setHoldingProps('invalid_addr_path');
            })
            .to.throw('Unable to get address info for non-fungible token holding address (path: invalid_addr_path)');
        });

        it('should fail trying to finalize retrieval progress (final data not yet retrieved)', function () {
            expect(() => {
                nfTokenRetrieval.finalizeRetrievalProgress();
            })
            .to.throw('Unable to finalize retrieval progress: not all non-fungible token data has been retrieved yet');
        });

        it('should successfully retrieve non-fungible token data (metadata)', async function () {
            try {
                await nfTokenRetrieval.startRetrieval();
            }
            catch (err) {
                expect.fail(`Exception executing nfTokenRetrieval.startRetrieval() method: ${err}`);
            }

            // Get retrieved non-fungible token data docs/recs
            const docsLastRetrievedNFTokenData = Catenis.db.collection.RetrievedNonFungibleTokenData.find({
                nonFungibleTokenRetrieval_id: nfTokenRetrieval.doc_id
            }).fetch();

            expect(docsLastRetrievedNFTokenData.length).to.equal(1);
            expect(docsLastRetrievedNFTokenData[0].metadata).to.deep.equal(
                _und.chain(metadata)
                .pairs()
                .map(pair => pair[0] === 'contents' ? ['contentsURL', pair[1]] : pair)
                .object()
                .value()
            );
            expect(docsLastRetrievedNFTokenData[0].contentsData).to.be.undefined;
            expect(nfTokenRetrieval._isFinalDataRetrieved).to.be.true;
            expect(nfTokenRetrieval.progress).to.deep.equal({
                metadataBytesRetrieved: JSON.stringify(ccMetadata).length,
                contentsBytesRetrieved: 0,
                done: false
            });
            expect(nfTokenRetrieval.getRetrievalProgress()).to.deep.equal({
                progress: {
                    bytesRetrieved: JSON.stringify(ccMetadata).length,
                    done: false
                }
            });
        });

        it('should fail trying to retrieve non-fungible token contents (no contents info)', async function () {
            expect(nfTokenRetrieval.contentsInfo).to.be.undefined;

            let error;

            try {
                await nfTokenRetrieval._retrieveContents();
            }
            catch (err) {
                error = err;
            }

            expect(() => {
                if (error) throw error;
            })
            .to.throw('Unable to retrieve non-fungible token contents: missing contents info');
        });

        it('should fail getting next non-fungible token data to retrieve (inconsistent order for metadata)', function () {
            expect(nfTokenRetrieval.nextDataOrder).to.be.greaterThan(1);

            expect(() => {
                nfTokenRetrieval._nextDataToRetrieve(true);
            })
            .to.throw('Inconsistent non-fungible token data order for metadata retrieval');
        });

        it('should fail trying to update retrieval progress (invalid param: bytesRetrieved)', function () {
            expect(() => {
                nfTokenRetrieval.updateRetrievalProgress(-1);
            })
            .to.throw('Invalid bytesRetrieved argument');
        });

        it('should fail delivering retrieved non-fungible token data (retrieval not yet finalized)', function () {
            expect(() => {
                nfTokenRetrieval.deliverRetrievedData();
            })
            .to.throw(Meteor.Error,'Retrieved non-fungible token data cannot be delivered; data not available')
            .with.property('error', 'nft_retrieval_not_available');
        });

        it('should correctly finalize non-fungible token retrieval (with error)', function () {
            expect(() => {
                nfTokenRetrieval.finalizeRetrievalProgress(new Error('Simulated error while retrieving non-fungible token data'));
            })
            .not.to.throw();

            expect(nfTokenRetrieval.progress).to.deep.include({
                done: true,
                success: false,
                error: {
                    code: 500,
                    message: 'Internal server error'
                }
            });
            expect(nfTokenRetrieval.progress.finishDate).to.be.an.instanceof(Date);
            expect(nfTokenRetrieval.delivery).to.be.undefined;

            // Make sure that progress has been saved to the database
            const docNFTokenRetrieval = Catenis.db.collection.NonFungibleTokenRetrieval.findOne({
                _id: nfTokenRetrieval.doc_id
            }, {
                fields: {
                    progress: 1,
                    delivery: 1
                }
            });

            expect(docNFTokenRetrieval).to.exist;
            expect(docNFTokenRetrieval).to.deep.include({
                progress: nfTokenRetrieval.progress
            });
            expect(docNFTokenRetrieval.delivery).to.be.undefined;
        });

        it('should fail delivering retrieved non-fungible token data (retrieval did not succeed)', function () {
            expect(() => {
                nfTokenRetrieval.deliverRetrievedData();
            })
            .to.throw(Meteor.Error,'Retrieved non-fungible token data cannot be delivered; data not available')
            .with.property('error', 'nft_retrieval_not_available');
        });

        it('should correctly finalize non-fungible token retrieval (success)', function () {
            // Reset progress
            nfTokenRetrieval.progress.done = false;
            delete nfTokenRetrieval.progress.success;
            delete nfTokenRetrieval.progress.error;

            Catenis.db.collection.NonFungibleTokenRetrieval.update({
                _id: nfTokenRetrieval.doc_id
            }, {
                $set: {
                    'progress.done': false
                },
                $unset: {
                    'progress.success': 1,
                    'progress.error': 1
                }
            });

            expect(() => {
                nfTokenRetrieval.finalizeRetrievalProgress();
            })
            .not.to.throw();

            expect(nfTokenRetrieval.progress).to.deep.include({
                done: true,
                success: true
            });
            expect(nfTokenRetrieval.progress.finishDate).to.be.an.instanceof(Date);
            expect(nfTokenRetrieval.delivery).to.deep.equal({
                dataChunksSent: 0,
                done: false
            });
            expect(nfTokenRetrieval._nextRetrievedNFTokenData).to.be.an.instanceof(RetrievedNFTokenData);
            expect(nfTokenRetrieval.nextContinuationToken).to.match(/^e[\dA-Za-z]{19}$/);

            // Make sure that progress has been saved to the database
            const docNFTokenRetrieval = Catenis.db.collection.NonFungibleTokenRetrieval.findOne({
                _id: nfTokenRetrieval.doc_id
            }, {
                fields: {
                    progress: 1,
                    delivery: 1
                }
            });

            expect(docNFTokenRetrieval).to.exist;
            expect(docNFTokenRetrieval).to.deep.include({
                progress: nfTokenRetrieval.progress,
                delivery: nfTokenRetrieval.delivery
            });
        });

        it('should fail trying to update retrieval progress (already finalized)', function () {
            expect(() => {
                nfTokenRetrieval.updateRetrievalProgress(100);
            })
            .to.throw('Trying to update non-fungible token retrieval progress that has already been finalized');
        });

        it('should fail trying to retrieve non-fungible token retrieval by doc/rec ID (invalid ID)', function () {
            expect(() => {
                NFTokenRetrieval.getNFTokenRetrievalByDocId('invalid_id');
            })
            .to.throw('Cannot find non-fungible token retrieval with the given database doc/rec ID: invalid_id');
        });

        it('should successfully retrieve non-fungible token retrieval by doc/rec ID', function () {
            expect(() => {
                nfTokenRetrievalDB = NFTokenRetrieval.getNFTokenRetrievalByDocId(nfTokenRetrieval.doc_id);
            })
            .not.to.throw();

            expect(nfTokenRetrievalDB).to.be.an.instanceof(NFTokenRetrieval);

            // Force non-fungible token object to be loaded
            nfTokenRetrievalDB.ccTokenId;

            expect(
                _und.omit(nfTokenRetrievalDB, 'refMoment')
            )
            .to.deep.equal(
                _und.omit(nfTokenRetrieval, 'contentsInfo')
            );
        });

        it('should fail trying to retrieve non-fungible token retrieval by retrieval ID (invalid ID)', function () {
            expect(() => {
                NFTokenRetrieval.getNFTokenRetrievalByTokenRetrievalId('invalid_id', 't00001');
            })
            .to.throw(Meteor.Error,'Unable to find non-fungible token retrieval with the given token retrieval ID')
            .with.property('error', 'nft_retrieval_invalid_id');
        });

        it('should fail trying to retrieve non-fungible token retrieval by retrieval ID (wrong token ID)', function () {
            expect(() => {
                NFTokenRetrieval.getNFTokenRetrievalByTokenRetrievalId(nfTokenRetrieval.tokenRetrievalId, 't00002');
            })
            .to.throw(Meteor.Error,'Non-fungible token retrieval is for a different non-fungible token')
            .with.property('error', 'nft_retrieval_wrong_token');
        });

        it('should fail trying to retrieve non-fungible token retrieval by retrieval ID (wrong device ID)', function () {
            expect(() => {
                NFTokenRetrieval.getNFTokenRetrievalByTokenRetrievalId(nfTokenRetrieval.tokenRetrievalId, 't00001', 'd00002');
            })
            .to.throw(Meteor.Error,'Non-fungible token retrieval belongs to a different device')
            .with.property('error', 'nft_retrieval_wrong_device');
        });

        it('should successfully retrieve non-fungible token retrieval by retrieval ID', function () {
            expect(() => {
                nfTokenRetrievalDB = NFTokenRetrieval.getNFTokenRetrievalByTokenRetrievalId(nfTokenRetrieval.tokenRetrievalId, 't00001', 'd00001');
            })
            .not.to.throw();

            expect(nfTokenRetrievalDB).to.be.an.instanceof(NFTokenRetrieval);

            // Force non-fungible token object to be loaded
            nfTokenRetrievalDB.ccTokenId;

            expect(
                _und.omit(nfTokenRetrievalDB, 'refMoment')
            )
            .to.deep.equal(
                _und.omit(nfTokenRetrieval, 'contentsInfo')
            );
        });

        it('should fail trying to retrieve non-fungible token retrieval by continuation token (invalid continuation token)', function () {
            expect(() => {
                NFTokenRetrieval.getNFTokenRetrievalByContinuationToken('invalid_cont_token', 't00001');
            })
            .to.throw(Meteor.Error,'Unable to find retrieved non-fungible token data for the given continuation token')
            .with.property('error', 'nft_retrieval_invalid_cont_token');
        });

        it('should fail trying to retrieve non-fungible token retrieval by continuation token (wrong token ID)', function () {
            expect(() => {
                NFTokenRetrieval.getNFTokenRetrievalByContinuationToken(nfTokenRetrieval.nextContinuationToken, 't00002');
            })
            .to.throw(Meteor.Error,'Non-fungible token retrieval is for a different non-fungible token')
            .with.property('error', 'nft_retrieval_wrong_token');
        });

        it('should fail trying to retrieve non-fungible token retrieval by continuation token (wrong device ID)', function () {
            expect(() => {
                NFTokenRetrieval.getNFTokenRetrievalByContinuationToken(nfTokenRetrieval.nextContinuationToken, 't00001', 'd00002');
            })
            .to.throw(Meteor.Error,'Non-fungible token retrieval belongs to a different device')
            .with.property('error', 'nft_retrieval_wrong_device');
        });

        it('should successfully retrieve non-fungible token retrieval by continuation token', function () {
            expect(() => {
                nfTokenRetrievalDB = NFTokenRetrieval.getNFTokenRetrievalByContinuationToken(nfTokenRetrieval.nextContinuationToken, 't00001', 'd00001');
            })
            .not.to.throw();

            expect(nfTokenRetrievalDB).to.be.an.instanceof(NFTokenRetrieval);

            // Force non-fungible token object to be loaded
            nfTokenRetrievalDB.ccTokenId;

            expect(
                _und.omit(nfTokenRetrievalDB, 'refMoment')
            )
            .to.deep.equal(
                _und.omit(nfTokenRetrieval, 'contentsInfo')
            );
        });

        it('should fail delivering retrieved non-fungible token data (invalid continuation token)', function () {
            expect(() => {
                nfTokenRetrievalDB.deliverRetrievedData('invalid_cont_token');
            })
            .to.throw(Meteor.Error,'Retrieved non-fungible token data cannot be delivered; unexpected continuation token')
            .with.property('error', 'nft_retrieval_invalid_cont_token');
        });

        it('should correctly deliver the retrieved non-fungible token data (no continuation token)', function () {
            let dataToDeliver;

            expect(() => {
                dataToDeliver = nfTokenRetrievalDB.deliverRetrievedData();
            })
            .not.to.throw();

            expect(dataToDeliver).to.deep.equal({
                metadata: _und.chain(metadata)
                    .pairs()
                    .map(pair => pair[0] === 'contents' ? ['contentsURL', pair[1]] : pair)
                    .object()
                    .value()
            });

            expect(nfTokenRetrievalDB.delivery).to.include({
                dataChunksSent: 1,
                done: true
            });
            expect(nfTokenRetrievalDB.delivery.lastSentDate).to.be.an.instanceof(Date);
            expect(nfTokenRetrievalDB.nextContinuationToken).to.be.undefined;

            // Make sure that delivery has been saved to the database
            const docNFTokenRetrieval = Catenis.db.collection.NonFungibleTokenRetrieval.findOne({
                _id: nfTokenRetrievalDB.doc_id
            }, {
                fields: {
                    delivery: 1
                }
            });

            expect(docNFTokenRetrieval).to.exist;
            expect(docNFTokenRetrieval).to.deep.include({
                delivery: nfTokenRetrievalDB.delivery
            });
        });

        it('should fail delivering retrieved non-fungible token data (already delivered)', function () {
            expect(() => {
                nfTokenRetrievalDB.deliverRetrievedData();
            })
            .to.throw(Meteor.Error,'Retrieved non-fungible token data cannot be delivered; data already delivered')
            .with.property('error', 'nft_retrieval_already_delivered');
        });
    });

    describe('non-fungible token retrieval with contents (metadata and contents)', function () {
        let nfTokenRetrieval;
        let nfTokenRetrievalDB;
        let firstContinuationToken;

        it('should successfully instantiate non-fungible token retrieval object', function () {
            expect(() => {
                nfTokenRetrieval = new NFTokenRetrieval(
                    undefined,
                    'd00001',
                    nfToken,
                    Catenis.keyStore.getAddressInfo(devAssetAddresssKeys[0].getAddress()),
                    true,
                    {
                        contentsOnly: false,
                        encoding: 'base64',
                        dataChunkSize: Math.ceil(contentsData.length /2)
                    }
                );
            })
            .not.to.throw();

            expect(nfTokenRetrieval).to.be.an.instanceof(NFTokenRetrieval);
            expect(nfTokenRetrieval.deviceId).to.equal('d00001');
            expect(nfTokenRetrieval.tokenId).to.equal(nfToken.tokenId);
            expect(nfTokenRetrieval._nfToken).to.equal(nfToken);
            expect(nfTokenRetrieval.holdingAddressInfo).to.deep.equal(Catenis.keyStore.getAddressInfo(devAssetAddresssKeys[0].getAddress()));
            expect(nfTokenRetrieval.holdingDeviceId).to.equal('d00001');
            expect(nfTokenRetrieval.retrieveContents).to.be.true;
            expect(nfTokenRetrieval.contentsOptions).to.deep.equal({
                contentsOnly: false,
                encoding: 'base64',
                dataChunkSize: Math.ceil(contentsData.length /2)
            });
            expect(nfTokenRetrieval.progress).to.deep.equal({
                metadataBytesRetrieved: 0,
                contentsBytesRetrieved: 0,
                done: false
            });
            expect(nfTokenRetrieval.delivery).to.be.undefined;
            expect(nfTokenRetrieval.contentsInfo).to.be.undefined;
            expect(nfTokenRetrieval._nextRetrievedNFTokenData).to.be.undefined;
            expect(nfTokenRetrieval._isSavedToDB).to.be.true;
            expect(nfTokenRetrieval.tokenRetrievalId).to.match(/^r[\dA-Za-z]{19}$/);
            expect(nfTokenRetrieval._isFinalDataRetrieved).to.be.false;
            expect(() => {
                nfTokenRetrieval._lastRetrievedContentsData;
            })
            .to.throw('Unable to find last retrieved non-fungible token contents data');
            expect(nfTokenRetrieval.ccTokenId).to.equal(nfToken.ccTokenId);
            expect(nfTokenRetrieval.nextContinuationToken).to.be.undefined;
            expect(nfTokenRetrieval.nextDataOrder).to.equal(1);
            expect(nfTokenRetrieval.contentsDataChunkSize).to.equal(Math.ceil(contentsData.length /2));
        });

        it('should successfully retrieve non-fungible token data (metadata & contents)', async function () {
            try {
                await nfTokenRetrieval.startRetrieval();
            }
            catch (err) {
                expect.fail(`Exception executing nfTokenRetrieval.startRetrieval() method: ${err}`);
            }

            // Get retrieved non-fungible token data docs/recs
            const docsLastRetrievedNFTokenData = Catenis.db.collection.RetrievedNonFungibleTokenData.find({
                nonFungibleTokenRetrieval_id: nfTokenRetrieval.doc_id
            }).fetch();

            expect(docsLastRetrievedNFTokenData.length).to.equal(3);

            // Retrieve data #1
            expect(docsLastRetrievedNFTokenData[0].metadata).to.deep.equal(
                _und.chain(metadata)
                .pairs()
                .map(pair => pair[0] === 'contents' ? ['contentsURL', pair[1]] : pair)
                .object()
                .value()
            );
            expect(docsLastRetrievedNFTokenData[0].contentsData).to.be.undefined;
            // Retrieve data #2
            expect(docsLastRetrievedNFTokenData[1].metadata).to.be.undefined;
            expect(docsLastRetrievedNFTokenData[1].contentsData).to.deep.equal(contentsData.slice(0, Math.ceil(contentsData.length /2)));
            // Retrieve data #3
            expect(docsLastRetrievedNFTokenData[2].metadata).to.be.undefined;
            expect(docsLastRetrievedNFTokenData[2].contentsData).to.deep.equal(contentsData.slice(Math.ceil(contentsData.length /2)));

            expect(nfTokenRetrieval._isFinalDataRetrieved).to.be.true;
            expect(nfTokenRetrieval.progress).to.deep.equal({
                metadataBytesRetrieved: JSON.stringify(ccMetadata).length,
                contentsBytesRetrieved: contentsData.length,
                done: false
            });
            expect(nfTokenRetrieval.getRetrievalProgress()).to.deep.equal({
                progress: {
                    bytesRetrieved: JSON.stringify(ccMetadata).length + contentsData.length,
                    done: false
                }
            });
        });

        it('should correctly finalize non-fungible token retrieval (success)', function () {
            expect(() => {
                nfTokenRetrieval.finalizeRetrievalProgress();
            })
            .not.to.throw();

            expect(nfTokenRetrieval.progress).to.deep.include({
                done: true,
                success: true
            });
            expect(nfTokenRetrieval.progress.finishDate).to.be.an.instanceof(Date);
            expect(nfTokenRetrieval.delivery).to.deep.equal({
                dataChunksSent: 0,
                done: false
            });
            expect(nfTokenRetrieval._nextRetrievedNFTokenData).to.be.an.instanceof(RetrievedNFTokenData);
            expect(nfTokenRetrieval.nextContinuationToken).to.match(/^e[\dA-Za-z]{19}$/);

            // Make sure that progress has been saved to the database
            const docNFTokenRetrieval = Catenis.db.collection.NonFungibleTokenRetrieval.findOne({
                _id: nfTokenRetrieval.doc_id
            }, {
                fields: {
                    progress: 1,
                    delivery: 1
                }
            });

            expect(docNFTokenRetrieval).to.exist;
            expect(docNFTokenRetrieval).to.deep.include({
                progress: nfTokenRetrieval.progress,
                delivery: nfTokenRetrieval.delivery
            });
        });

        it('should successfully retrieve non-fungible token retrieval by continuation token', function () {
            expect(() => {
                nfTokenRetrievalDB = NFTokenRetrieval.getNFTokenRetrievalByContinuationToken(nfTokenRetrieval.nextContinuationToken, 't00001', 'd00001');
            })
            .not.to.throw();

            expect(nfTokenRetrievalDB).to.be.an.instanceof(NFTokenRetrieval);

            // Force non-fungible token object to be loaded
            nfTokenRetrievalDB.ccTokenId;

            expect(
                _und.omit(nfTokenRetrievalDB, 'refMoment')
            )
            .to.deep.equal(
                _und.omit(nfTokenRetrieval, 'contentsInfo')
            );
        });

        it('should correctly deliver the retrieved non-fungible token data (chunk #1)', function () {
            let dataToDeliver;

            expect(() => {
                dataToDeliver = nfTokenRetrievalDB.deliverRetrievedData(
                    firstContinuationToken = nfTokenRetrievalDB.nextContinuationToken
                );
            })
            .not.to.throw();

            expect(dataToDeliver).to.deep.equal({
                metadata: _und.chain(metadata)
                    .pairs()
                    .map(pair => pair[0] === 'contents' ? ['contentsURL', pair[1]] : pair)
                    .object()
                    .value(),
                contents: {
                    data: contentsData.slice(0, Math.ceil(contentsData.length /2)).toString('base64')
                }
            });

            expect(nfTokenRetrievalDB.delivery).to.include({
                dataChunksSent: 2,
                done: false
            });
            expect(nfTokenRetrievalDB.delivery.lastSentDate).to.be.an.instanceof(Date);
            expect(nfTokenRetrievalDB.nextContinuationToken).not.to.be.undefined;

            // Make sure that delivery has been saved to the database
            const docNFTokenRetrieval = Catenis.db.collection.NonFungibleTokenRetrieval.findOne({
                _id: nfTokenRetrievalDB.doc_id
            }, {
                fields: {
                    delivery: 1
                }
            });

            expect(docNFTokenRetrieval).to.exist;
            expect(docNFTokenRetrieval).to.deep.include({
                delivery: nfTokenRetrievalDB.delivery
            });
        });

        it('should fail delivering retrieved non-fungible token data (wrong continuation token)', function () {
            expect(firstContinuationToken).not.to.be.undefined

            expect(() => {
                nfTokenRetrievalDB.deliverRetrievedData(firstContinuationToken);
            })
            .to.throw(Meteor.Error,'Retrieved non-fungible token data cannot be delivered; unexpected continuation token')
            .with.property('error', 'nft_retrieval_invalid_cont_token');
        });

        it('should fail delivering retrieved non-fungible token data (data expired)', function () {
            // Simulate delivery in the future
            const origRefMoment = nfTokenRetrievalDB.refMoment.clone();
            nfTokenRetrievalDB.refMoment.add(nftRetrievalCfgSettings.timeContinueDataDelivery + 1, 's');

            expect(firstContinuationToken).not.to.be.undefined

            expect(() => {
                nfTokenRetrievalDB.deliverRetrievedData(nfTokenRetrievalDB.nextContinuationToken);
            })
            .to.throw(Meteor.Error,'Retrieved non-fungible token data cannot be delivered; data expired')
            .with.property('error', 'nft_retrieval_expired');

            // Restore original refMoment
            nfTokenRetrievalDB.refMoment = origRefMoment;
        });

        it('should correctly deliver the retrieved non-fungible token data (chunk #2)', function () {
            let dataToDeliver;

            expect(() => {
                dataToDeliver = nfTokenRetrievalDB.deliverRetrievedData(nfTokenRetrievalDB.nextContinuationToken);
            })
            .not.to.throw();

            expect(dataToDeliver).to.deep.equal({
                contents: {
                    data: contentsData.slice(Math.ceil(contentsData.length /2)).toString('base64')
                }
            });

            expect(nfTokenRetrievalDB.delivery).to.include({
                dataChunksSent: 3,
                done: true
            });
            expect(nfTokenRetrievalDB.delivery.lastSentDate).to.be.an.instanceof(Date);
            expect(nfTokenRetrievalDB.nextContinuationToken).to.undefined;

            // Make sure that delivery has been saved to the database
            const docNFTokenRetrieval = Catenis.db.collection.NonFungibleTokenRetrieval.findOne({
                _id: nfTokenRetrievalDB.doc_id
            }, {
                fields: {
                    delivery: 1
                }
            });

            expect(docNFTokenRetrieval).to.exist;
            expect(docNFTokenRetrieval).to.deep.include({
                delivery: nfTokenRetrievalDB.delivery
            });
        });
    });

    describe('non-fungible token retrieval with only contents (no metadata)', function () {
        let nfTokenRetrieval;
        let nfTokenRetrievalDB;

        it('should successfully instantiate non-fungible token retrieval object', function () {
            expect(() => {
                nfTokenRetrieval = new NFTokenRetrieval(
                    undefined,
                    'd00001',
                    nfToken,
                    Catenis.keyStore.getAddressInfo(devAssetAddresssKeys[0].getAddress()),
                    true,
                    {
                        contentsOnly: true,
                        encoding: 'base64',
                        dataChunkSize: Math.ceil(contentsData.length /2)
                    }
                );
            })
            .not.to.throw();

            expect(nfTokenRetrieval).to.be.an.instanceof(NFTokenRetrieval);
            expect(nfTokenRetrieval.deviceId).to.equal('d00001');
            expect(nfTokenRetrieval.tokenId).to.equal(nfToken.tokenId);
            expect(nfTokenRetrieval._nfToken).to.equal(nfToken);
            expect(nfTokenRetrieval.holdingAddressInfo).to.deep.equal(Catenis.keyStore.getAddressInfo(devAssetAddresssKeys[0].getAddress()));
            expect(nfTokenRetrieval.holdingDeviceId).to.equal('d00001');
            expect(nfTokenRetrieval.retrieveContents).to.be.true;
            expect(nfTokenRetrieval.contentsOptions).to.deep.equal({
                contentsOnly: true,
                encoding: 'base64',
                dataChunkSize: Math.ceil(contentsData.length /2)
            });
            expect(nfTokenRetrieval.progress).to.deep.equal({
                metadataBytesRetrieved: 0,
                contentsBytesRetrieved: 0,
                done: false
            });
            expect(nfTokenRetrieval.delivery).to.be.undefined;
            expect(nfTokenRetrieval.contentsInfo).to.be.undefined;
            expect(nfTokenRetrieval._nextRetrievedNFTokenData).to.be.undefined;
            expect(nfTokenRetrieval._isSavedToDB).to.be.true;
            expect(nfTokenRetrieval.tokenRetrievalId).to.match(/^r[\dA-Za-z]{19}$/);
            expect(nfTokenRetrieval._isFinalDataRetrieved).to.be.false;
            expect(() => {
                nfTokenRetrieval._lastRetrievedContentsData;
            })
            .to.throw('Unable to find last retrieved non-fungible token contents data');
            expect(nfTokenRetrieval.ccTokenId).to.equal(nfToken.ccTokenId);
            expect(nfTokenRetrieval.nextContinuationToken).to.be.undefined;
            expect(nfTokenRetrieval.nextDataOrder).to.equal(1);
            expect(nfTokenRetrieval.contentsDataChunkSize).to.equal(Math.ceil(contentsData.length /2));
        });

        it('should successfully retrieve non-fungible token data (contents)', async function () {
            try {
                await nfTokenRetrieval.startRetrieval();
            }
            catch (err) {
                expect.fail(`Exception executing nfTokenRetrieval.startRetrieval() method: ${err}`);
            }

            // Get retrieved non-fungible token data docs/recs
            const docsLastRetrievedNFTokenData = Catenis.db.collection.RetrievedNonFungibleTokenData.find({
                nonFungibleTokenRetrieval_id: nfTokenRetrieval.doc_id
            }).fetch();

            expect(docsLastRetrievedNFTokenData.length).to.equal(2);

            // Retrieve data #1
            expect(docsLastRetrievedNFTokenData[0].metadata).to.be.undefined;
            expect(docsLastRetrievedNFTokenData[0].contentsData).to.deep.equal(contentsData.slice(0, Math.ceil(contentsData.length /2)));
            // Retrieve data #2
            expect(docsLastRetrievedNFTokenData[1].metadata).to.be.undefined;
            expect(docsLastRetrievedNFTokenData[1].contentsData).to.deep.equal(contentsData.slice(Math.ceil(contentsData.length /2)));

            expect(nfTokenRetrieval._isFinalDataRetrieved).to.be.true;
            expect(nfTokenRetrieval.progress).to.deep.equal({
                metadataBytesRetrieved: JSON.stringify(ccMetadata).length,
                contentsBytesRetrieved: contentsData.length,
                done: false
            });
            expect(nfTokenRetrieval.getRetrievalProgress()).to.deep.equal({
                progress: {
                    bytesRetrieved: JSON.stringify(ccMetadata).length + contentsData.length,
                    done: false
                }
            });
        });

        it('should correctly finalize non-fungible token retrieval (success)', function () {
            expect(() => {
                nfTokenRetrieval.finalizeRetrievalProgress();
            })
            .not.to.throw();

            expect(nfTokenRetrieval.progress).to.deep.include({
                done: true,
                success: true
            });
            expect(nfTokenRetrieval.progress.finishDate).to.be.an.instanceof(Date);
            expect(nfTokenRetrieval.delivery).to.deep.equal({
                dataChunksSent: 0,
                done: false
            });
            expect(nfTokenRetrieval._nextRetrievedNFTokenData).to.be.an.instanceof(RetrievedNFTokenData);
            expect(nfTokenRetrieval.nextContinuationToken).to.match(/^e[\dA-Za-z]{19}$/);

            // Make sure that progress has been saved to the database
            const docNFTokenRetrieval = Catenis.db.collection.NonFungibleTokenRetrieval.findOne({
                _id: nfTokenRetrieval.doc_id
            }, {
                fields: {
                    progress: 1,
                    delivery: 1
                }
            });

            expect(docNFTokenRetrieval).to.exist;
            expect(docNFTokenRetrieval).to.deep.include({
                progress: nfTokenRetrieval.progress,
                delivery: nfTokenRetrieval.delivery
            });
        });

        it('should successfully retrieve non-fungible token retrieval by continuation token', function () {
            expect(() => {
                nfTokenRetrievalDB = NFTokenRetrieval.getNFTokenRetrievalByContinuationToken(nfTokenRetrieval.nextContinuationToken, 't00001', 'd00001');
            })
            .not.to.throw();

            expect(nfTokenRetrievalDB).to.be.an.instanceof(NFTokenRetrieval);

            // Force non-fungible token object to be loaded
            nfTokenRetrievalDB.ccTokenId;

            expect(
                _und.omit(nfTokenRetrievalDB, 'refMoment')
            )
            .to.deep.equal(
                _und.omit(nfTokenRetrieval, 'contentsInfo')
            );
        });

        it('should correctly deliver the retrieved non-fungible token data (chunk #1)', function () {
            let dataToDeliver;

            expect(() => {
                dataToDeliver = nfTokenRetrievalDB.deliverRetrievedData(nfTokenRetrievalDB.nextContinuationToken);
            })
            .not.to.throw();

            expect(dataToDeliver).to.deep.equal({
                contents: {
                    data: contentsData.slice(0, Math.ceil(contentsData.length /2)).toString('base64')
                }
            });

            expect(nfTokenRetrievalDB.delivery).to.include({
                dataChunksSent: 1,
                done: false
            });
            expect(nfTokenRetrievalDB.delivery.lastSentDate).to.be.an.instanceof(Date);
            expect(nfTokenRetrievalDB.nextContinuationToken).not.to.be.undefined;

            // Make sure that delivery has been saved to the database
            const docNFTokenRetrieval = Catenis.db.collection.NonFungibleTokenRetrieval.findOne({
                _id: nfTokenRetrievalDB.doc_id
            }, {
                fields: {
                    delivery: 1
                }
            });

            expect(docNFTokenRetrieval).to.exist;
            expect(docNFTokenRetrieval).to.deep.include({
                delivery: nfTokenRetrievalDB.delivery
            });
        });

        it('should correctly deliver the retrieved non-fungible token data (chunk #2)', function () {
            let dataToDeliver;

            expect(() => {
                dataToDeliver = nfTokenRetrievalDB.deliverRetrievedData(nfTokenRetrievalDB.nextContinuationToken);
            })
            .not.to.throw();

            expect(dataToDeliver).to.deep.equal({
                contents: {
                    data: contentsData.slice(Math.ceil(contentsData.length /2)).toString('base64')
                }
            });

            expect(nfTokenRetrievalDB.delivery).to.include({
                dataChunksSent: 2,
                done: true
            });
            expect(nfTokenRetrievalDB.delivery.lastSentDate).to.be.an.instanceof(Date);
            expect(nfTokenRetrievalDB.nextContinuationToken).to.undefined;

            // Make sure that delivery has been saved to the database
            const docNFTokenRetrieval = Catenis.db.collection.NonFungibleTokenRetrieval.findOne({
                _id: nfTokenRetrievalDB.doc_id
            }, {
                fields: {
                    delivery: 1
                }
            });

            expect(docNFTokenRetrieval).to.exist;
            expect(docNFTokenRetrieval).to.deep.include({
                delivery: nfTokenRetrievalDB.delivery
            });
        });
    });

    describe('Purge old non-fungible token retrievals', function () {
        const now = new Date();
        const inIncompleteDate = new Date(now);
        inIncompleteDate.setSeconds(inIncompleteDate.getSeconds() - nftRetrievalCfgSettings.timeKeepIncompleteRetrieval - 1);
        const inUndeliveredDate = new Date(now);
        inUndeliveredDate.setSeconds(inUndeliveredDate.getSeconds() - nftRetrievalCfgSettings.timeKeepUndeliveredData - 1);
        const inDeliveredDate = new Date(now);
        inDeliveredDate.setSeconds(inDeliveredDate.getSeconds() - nftRetrievalCfgSettings.timeKeepDeliveredData - 1);
        const outDate = new Date(now);

        const docsNFTokenRetrieval = [
            // Incomplete retrievals
            {
                _id: '_r00001',
                tokenRetrievalId: 'r00001',
                progress: {
                    done: false
                },
                //createdDate: inIncompleteDate,
            },
            {
                _id: '_r00002',
                tokenRetrievalId: 'r00002',
                progress: {
                    done: false
                },
                //createdDate: outDate,
            },
            {
                _id: '_r00003',
                tokenRetrievalId: 'r00003',
                progress: {
                    done: false
                },
                //createdDate: inIncompleteDate,
            },
            // No retrieved data
            {
                _id: '_r00004',
                tokenRetrievalId: 'r00004',
                progress: {
                    done: false
                },
                createdDate: outDate,
            },
            {
                _id: '_r00005',
                tokenRetrievalId: 'r00005',
                progress: {
                    done: false
                },
                createdDate: inIncompleteDate,
            },
            {
                _id: '_r00006',
                tokenRetrievalId: 'r00006',
                progress: {
                    done: false
                },
                createdDate: inIncompleteDate,
            },
            {
                _id: '_r00007',
                tokenRetrievalId: 'r00007',
                progress: {
                    done: false
                },
                createdDate: outDate,
            },
            // Undelivered data
            {
                _id: '_r00008',
                tokenRetrievalId: 'r00008',
                progress: {
                    done: true,
                    finishDate: inUndeliveredDate,
                },
                delivery: {
                    done: false
                },
            },
            {
                _id: '_r00009',
                tokenRetrievalId: 'r00009',
                progress: {
                    done: true,
                    finishDate: outDate,
                },
                delivery: {
                    done: false
                },
            },
            {
                _id: '_r00010',
                tokenRetrievalId: 'r00010',
                progress: {
                    done: true,
                    finishDate: inUndeliveredDate,
                },
                delivery: {
                    done: false
                },
            },
            {
                _id: '_r00011',
                tokenRetrievalId: 'r00011',
                progress: {
                    done: true,
                    finishDate: outDate,
                },
                delivery: {
                    done: false
                },
            },
            {
                _id: '_r00012',
                tokenRetrievalId: 'r00012',
                progress: {
                    done: true,
                    finishDate: outDate,
                },
                delivery: {
                    done: false
                },
            },
            // Delivered data
            {
                _id: '_r00013',
                tokenRetrievalId: 'r00013',
                progress: {
                    done: true,
                },
                delivery: {
                    done: true,
                    lastSentDate: inDeliveredDate,
                },
            },
            {
                _id: '_r00014',
                tokenRetrievalId: 'r00014',
                progress: {
                    done: true,
                },
                delivery: {
                    done: true,
                    lastSentDate: inDeliveredDate,
                },
            },
            {
                _id: '_r00015',
                tokenRetrievalId: 'r00015',
                progress: {
                    done: true,
                },
                delivery: {
                    done: true,
                    lastSentDate: outDate,
                },
            },
            {
                _id: '_r00016',
                tokenRetrievalId: 'r00016',
                progress: {
                    done: true,
                },
                delivery: {
                    done: true,
                    lastSentDate: inDeliveredDate,
                },
            },
            {
                _id: '_r00017',
                tokenRetrievalId: 'r00017',
                progress: {
                    done: true,
                },
                delivery: {
                    done: true,
                    lastSentDate: outDate,
                },
            },
        ];
        const docsRetrievedNFTData = [
            // Retrieval #1
            {
                _id: '_e00001',
                retrievedNFTokenDataId: 'e00001',
                nonFungibleTokenRetrieval_id: '_r00001',
                order: 1,
                isFinal: false,
                createdDate: outDate,
            },
            {
                _id: '_e00002',
                retrievedNFTokenDataId: 'e00002',
                nonFungibleTokenRetrieval_id: '_r00001',
                order: 2,
                isFinal: false,
                createdDate: inIncompleteDate,
            },
            // Retrieval #2
            {
                _id: '_e00003',
                retrievedNFTokenDataId: 'e00003',
                nonFungibleTokenRetrieval_id: '_r00002',
                order: 1,
                isFinal: false,
                createdDate: outDate,
            },
            // Retrieval #3
            {
                _id: '_e00004',
                retrievedNFTokenDataId: 'e00004',
                nonFungibleTokenRetrieval_id: '_r00003',
                order: 1,
                isFinal: false,
                createdDate: outDate,
            },
            {
                _id: '_e00005',
                retrievedNFTokenDataId: 'e00005',
                nonFungibleTokenRetrieval_id: '_r00003',
                order: 2,
                isFinal: false,
                createdDate: inIncompleteDate,
            },
            {
                _id: '_e00006',
                retrievedNFTokenDataId: 'e00006',
                nonFungibleTokenRetrieval_id: '_r00003',
                order: 3,
                isFinal: false,
                createdDate: inIncompleteDate,
            },
            // Retrieval #8
            {
                _id: '_e00007',
                retrievedNFTokenDataId: 'e00007',
                nonFungibleTokenRetrieval_id: '_r00008',
                order: 1,
                isFinal: false,
            },
            {
                _id: '_e00008',
                retrievedNFTokenDataId: 'e00008',
                nonFungibleTokenRetrieval_id: '_r00008',
                order: 2,
                isFinal: true,
            },
            // Retrieval #9
            {
                _id: '_e00009',
                retrievedNFTokenDataId: 'e00009',
                nonFungibleTokenRetrieval_id: '_r00009',
                order: 1,
                isFinal: true,
            },
            // Retrieval #10
            {
                _id: '_e00010',
                retrievedNFTokenDataId: 'e00010',
                nonFungibleTokenRetrieval_id: '_r00010',
                order: 1,
                isFinal: false,
            },
            {
                _id: '_e00011',
                retrievedNFTokenDataId: 'e00011',
                nonFungibleTokenRetrieval_id: '_r00010',
                order: 2,
                isFinal: false,
            },
            {
                _id: '_e00012',
                retrievedNFTokenDataId: 'e00012',
                nonFungibleTokenRetrieval_id: '_r00010',
                order: 3,
                isFinal: true,
            },
            // Retrieval #11
            {
                _id: '_e00013',
                retrievedNFTokenDataId: 'e00013',
                nonFungibleTokenRetrieval_id: '_r00011',
                order: 1,
                isFinal: true,
            },
            // Retrieval #12
            {
                _id: '_e00014',
                retrievedNFTokenDataId: 'e00014',
                nonFungibleTokenRetrieval_id: '_r00012',
                order: 1,
                isFinal: true,
            },

            // Retrieval #13
            {
                _id: '_e00015',
                retrievedNFTokenDataId: 'e00015',
                nonFungibleTokenRetrieval_id: '_r00013',
                order: 1,
                isFinal: false,
            },
            {
                _id: '_e00016',
                retrievedNFTokenDataId: 'e00016',
                nonFungibleTokenRetrieval_id: '_r00013',
                order: 2,
                isFinal: true,
            },
            // Retrieval #14
            {
                _id: '_e00017',
                retrievedNFTokenDataId: 'e00017',
                nonFungibleTokenRetrieval_id: '_r00014',
                order: 1,
                isFinal: true,
            },
            // Retrieval #15
            {
                _id: '_e00018',
                retrievedNFTokenDataId: 'e00018',
                nonFungibleTokenRetrieval_id: '_r00015',
                order: 1,
                isFinal: false,
            },
            {
                _id: '_e00019',
                retrievedNFTokenDataId: 'e00019',
                nonFungibleTokenRetrieval_id: '_r00015',
                order: 2,
                isFinal: false,
            },
            {
                _id: '_e00020',
                retrievedNFTokenDataId: 'e00020',
                nonFungibleTokenRetrieval_id: '_r00015',
                order: 3,
                isFinal: true,
            },
            // Retrieval #16
            {
                _id: '_e00021',
                retrievedNFTokenDataId: 'e00021',
                nonFungibleTokenRetrieval_id: '_r00016',
                order: 1,
                isFinal: true,
            },
            // Retrieval #17
            {
                _id: '_e00022',
                retrievedNFTokenDataId: 'e00022',
                nonFungibleTokenRetrieval_id: '_r00017',
                order: 1,
                isFinal: true,
            },
        ];

        before(function (done) {
            Promise.all([
                Catenis.db.mongoCollection.NonFungibleTokenRetrieval.drop(),
                Catenis.db.mongoCollection.RetrievedNonFungibleTokenData.drop(),
            ])
            .then(() => {
                docsNFTokenRetrieval.forEach(doc => Catenis.db.collection.NonFungibleTokenRetrieval.insert(doc));
                docsRetrievedNFTData.forEach(doc => Catenis.db.collection.RetrievedNonFungibleTokenData.insert(doc));

                done();
            })
            .catch(done);
        });

        it('should purge non-fungible token retrieval database docs', function () {
            expect(Catenis.db.collection.NonFungibleTokenRetrieval.find().count()).to.equal(docsNFTokenRetrieval.length);
            expect(Catenis.db.collection.RetrievedNonFungibleTokenData.find().count()).to.equal(docsRetrievedNFTData.length);

            NFTokenRetrieval.initialize();

            expect(Catenis.db.collection.NonFungibleTokenRetrieval.find().count())
            .to.equal(docsNFTokenRetrieval.length - 9);
            expect(Catenis.db.collection.RetrievedNonFungibleTokenData.find().count())
            .to.equal(docsRetrievedNFTData.length - 14);
        })
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

    CatenisNode.prototype.origGetClientByIndex = CatenisNode.prototype.getClientByIndex;

    CatenisNode.prototype.getClientByIndex = function (index) {
        if (index === clientIndex) {
            return new LocalClient(index);
        }

        return this.origGetClientByIndex(index);
    };
}

function resetC3NodeClient() {
    C3NodeClient.prototype.__origMethods = {
        getNFTokenMetadataReadableStream: C3NodeClient.prototype.getNFTokenMetadataReadableStream,
    };

    C3NodeClient.prototype.__callOrigMethod = function (name, ...args) {
        return this.__origMethods[name].call(this, ...args);
    };

    C3NodeClient.prototype.getNFTokenMetadataReadableStream = function (tokenId, waitForParsing) {
        if (tokenId === ccTokenId) {
            return stream.Readable.from(JSON.stringify(ccMetadata));
        }

        return this.__callOrigMethod('getNFTokenMetadataReadableStream', tokenId, waitForParsing);
    }
}

function resetNFTokenStorage() {
    NFTokenStorage.prototype.__origMethods = {
        retrieve: NFTokenStorage.prototype.retrieve,
    };

    NFTokenStorage.prototype.__callOrigMethod = function (name, ...args) {
        return this.__origMethods[name].call(this, ...args);
    };

    NFTokenStorage.prototype.retrieve = function (cid) {
        if (cid === 'QmUkhVi6zRJz5U87jUjK9ZGTazaXLDKLfGbMRHxiai5xUn') {
            return stream.Readable.from(contentsData);
        }

        return this.__callOrigMethod('retrieve', cid);
    }
}

function setCCMetadata() {
    const ccNFTokenMetadata = new CCSingleNFTokenMetadata();

    ccNFTokenMetadata.setNFTokenProperties(_und.mapObject(metadata, (val, key) => {
        return key === 'contents' ? NFTokenContentsUrl.parse(val) : val;
    }));

    ccMetadata = ccNFTokenMetadata.assemble();
}