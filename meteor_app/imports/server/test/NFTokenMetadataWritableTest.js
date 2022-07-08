/**
 * Created by claudio on 2022-07-05
 */

//console.log('[NFTokenMetadataWritableTest.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import stream from 'stream';
// Third-party node modules
import { expect } from 'chai';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from '../Catenis';
import { NFTokenMetadataWritable } from '../NFTokenMetadataWritable';
import { NFTokenRetrieval } from '../NFTokenRetrieval';
import { EccLibraryProxy } from '../EccLibraryProxy';
import { Bip32 } from '../Bip32';
import { KeyStore } from '../KeyStore';
import { BitcoinInfo } from '../BitcoinInfo';
import { CatenisNode } from '../CatenisNode';

const clientIndex = 123;
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
let savedMetadata;
let metadataBytesRetrieved = 0;


describe('NFTokenMetadataWritable module', function () {
    const deviceIndex = 1;
    const devAssetAddresssKeys = [];
    let nfTokenRetrieval;
    let metaChunkReadable;

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
        resetNFTokenRetrieval();

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

        // Stream to read metadata in (small) chunks
        class _metaChunkReadable extends stream.Readable {
            constructor(metadata, chunkSize, options) {
                super(options);
                this.metadata = metadata;
                this.chunkSize = chunkSize || 10;
                this.bytesRead = 0;
            }

            _read(size) {
                if (this.bytesRead >= this.metadata.length) {
                    this.push(null);
                    return;
                }

                const chunk = Buffer.from(this.metadata.substr(this.bytesRead, this.chunkSize));
                this.bytesRead += chunk.length;
                this.push(chunk);
            }

            _destroy(err, callback) {
                callback(err);
            }
        }

        metaChunkReadable = _metaChunkReadable;
    });

    it('should successfully write non-fungible token metadata', function (done) {
        const metaWritable = new NFTokenMetadataWritable(nfTokenRetrieval);

        metaWritable.once('error', done);
        metaWritable.once('finish', () => {
            try {
                // Make sure that all metadata has been written
                expect(savedMetadata).to.deep.equal(metadata);
                expect(metadataBytesRetrieved).to.equal(JSON.stringify(metadata).length);
            }
            catch (err) {
                done(err);
                return;
            }

            done();
        });

        const strMetadata = JSON.stringify(metadata);
        const metaReadable = new metaChunkReadable(strMetadata, Math.ceil(strMetadata.length / 3));

        metaReadable.once('error', (err) => {
            metaWritable.destroy(err);
        });

        metaReadable.pipe(metaWritable);
    });

    describe('Error while reading metadata', function () {
        let metaErrorReadable;

        before(function () {
            metaErrorReadable = new stream.Readable({
                read: function () {
                    this.destroy(new Error('Simulated error reading metadata'));
                }
            });
        });

        it('should correctly handle error while reading metadata', function (done) {
            const metaWritable = new NFTokenMetadataWritable(nfTokenRetrieval);

            metaWritable.once('error', (err) => {
                try {
                    expect(err.message).to.have.string('Simulated error reading metadata');
                }
                catch (err) {
                    done(err);
                    return;
                }

                done();
            });

            metaWritable.once('finish', () => {
                done(expect.fail('Should not have finished writing metadata'));
            });

            metaErrorReadable.once('error', (err) => {
                metaWritable.destroy(err);
            });

            metaErrorReadable.pipe(metaWritable);
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

function resetNFTokenRetrieval() {
    NFTokenRetrieval.prototype.__origMethods = {
        saveRetrievedMetadata: NFTokenRetrieval.prototype.saveRetrievedMetadata,
        updateRetrievalProgress: NFTokenRetrieval.prototype.updateRetrievalProgress,
    };

    NFTokenRetrieval.__callOrigMethod = function (name, ...args) {
        return this.__origMethods[name].call(this, ...args);
    };

    NFTokenRetrieval.prototype.saveRetrievedMetadata = function (metadata) {
        savedMetadata = metadata;
    };

    NFTokenRetrieval.prototype.updateRetrievalProgress = function (bytesRetrieved) {
        metadataBytesRetrieved += bytesRetrieved;
    }
}
