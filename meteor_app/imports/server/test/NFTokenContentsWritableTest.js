/**
 * Created by claudio on 2022-07-05
 */

//console.log('[NFTokenContentsWritableTest.js]: This code just ran.');

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
import { NFTokenContentsWritable } from '../NFTokenContentsWritable';
import { NFTokenRetrieval } from '../NFTokenRetrieval';
import { EccLibraryProxy } from '../EccLibraryProxy';
import { Bip32 } from '../Bip32';
import { KeyStore } from '../KeyStore';
import { BitcoinInfo } from '../BitcoinInfo';
import { CatenisNode } from '../CatenisNode';

const clientIndex = 123;
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
let savedContentsData = [];
let contentsFinalized = false;
let contentsBytesRetrieved = 0;


describe('NFTokenContentsWritable module', function () {
    const deviceIndex = 1;
    const devAssetAddresssKeys = [];
    let nfTokenRetrieval;
    let contentsChunkReadable;

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
        // Simulate that contents info have already been retrieved (from metadata)
        nfTokenRetrieval.contentsInfo = {
            CID: 'QmUkhVi6zRJz5U87jUjK9ZGTazaXLDKLfGbMRHxiai5xUn',
            isEncrypted: false,
        };

        // Stream to read contents in (small) chunks
        class _contentsChunkReadable extends stream.Readable {
            constructor(contentsData, chunkSize, options) {
                super(options);
                this.contentsData = contentsData;
                this.chunkSize = chunkSize || 10;
                this.bytesRead = 0;
            }

            _read(size) {
                if (this.bytesRead >= this.contentsData.length) {
                    this.push(null);
                    return;
                }

                const chunk = this.contentsData.slice(this.bytesRead, this.bytesRead + this.chunkSize);
                this.bytesRead += chunk.length;
                this.push(chunk);
            }

            _destroy(err, callback) {
                callback(err);
            }
        }

        contentsChunkReadable = _contentsChunkReadable;
    });

    describe('Unencrypted contents', function () {
        describe('No chunk size', function () {
            it('should successfully write non-fungible token contents', function (done) {
                const contentsWritable = new NFTokenContentsWritable(nfTokenRetrieval);

                contentsWritable.once('error', done);
                contentsWritable.once('finish', () => {
                    try {
                        // Make sure that all contents have been written
                        expect(savedContentsData).to.have.lengthOf(1);
                        expect(savedContentsData[0]).to.deep.equal(contentsData);
                        expect(contentsFinalized).to.be.true;
                        expect(contentsBytesRetrieved).to.equal(contentsData.length);
                    }
                    catch (err) {
                        done(err);
                        return;
                    }

                    done();
                });

                const contentsReadable = new contentsChunkReadable(contentsData, Math.ceil(contentsData.length / 3));

                contentsReadable.once('error', (err) => {
                    contentsWritable.destroy(err);
                });

                contentsReadable.pipe(contentsWritable);
            });

            describe('Error while reading contents', function () {
                let contentsErrorReadable;

                before(function () {
                    contentsErrorReadable = new stream.Readable({
                        read: function () {
                            this.destroy(new Error('Simulated error reading contents'));
                        }
                    });
                });

                it('should correctly handle error while reading contents', function (done) {
                    const contentsWritable = new NFTokenContentsWritable(nfTokenRetrieval);

                    contentsWritable.once('error', (err) => {
                        try {
                            expect(err.message).to.have.string('Simulated error reading contents');
                        }
                        catch (err) {
                            done(err);
                            return;
                        }

                        done();
                    });

                    contentsWritable.once('finish', () => {
                        done(expect.fail('Should not have finished writing contents'));
                    });

                    contentsErrorReadable.once('error', (err) => {
                        contentsWritable.destroy(err);
                    });

                    contentsErrorReadable.pipe(contentsWritable);
                });
            });
        });

        describe('Larger chunk size', function () {
            before(function () {
                // Reset retrieved contents
                savedContentsData = [];
                contentsFinalized = false;
                contentsBytesRetrieved = 0;

                // Simulate a data chunk size larger than the contents data
                nfTokenRetrieval.contentsOptions.dataChunkSize = contentsData.length +1;
            });

            it('should successfully write non-fungible token contents', function (done) {
                const contentsWritable = new NFTokenContentsWritable(nfTokenRetrieval);

                contentsWritable.once('error', done);
                contentsWritable.once('finish', () => {
                    try {
                        // Make sure that all contents have been written
                        expect(savedContentsData).to.have.lengthOf(1);
                        expect(savedContentsData[0]).to.deep.equal(contentsData);
                        expect(contentsFinalized).to.be.true;
                        expect(contentsBytesRetrieved).to.equal(contentsData.length);
                    }
                    catch (err) {
                        done(err);
                        return;
                    }

                    done();
                });

                const contentsReadable = new contentsChunkReadable(contentsData, Math.ceil(contentsData.length / 3));

                contentsReadable.once('error', (err) => {
                    contentsWritable.destroy(err);
                });

                contentsReadable.pipe(contentsWritable);
            });
        });

        describe('Smaller chunk size', function () {
            before(function () {
                // Reset retrieved contents
                savedContentsData = [];
                contentsFinalized = false;
                contentsBytesRetrieved = 0;

                // Simulate a data chunk size half the size of the contents data
                nfTokenRetrieval.contentsOptions.dataChunkSize = Math.ceil(contentsData.length / 2);
            });

            it('should successfully write non-fungible token contents', function (done) {
                const contentsWritable = new NFTokenContentsWritable(nfTokenRetrieval);

                contentsWritable.once('error', done);
                contentsWritable.once('finish', () => {
                    try {
                        // Make sure that all contents have been written
                        expect(savedContentsData).to.have.lengthOf(2);
                        expect(savedContentsData[0]).to.have.lengthOf(nfTokenRetrieval.contentsOptions.dataChunkSize);
                        expect(savedContentsData[1]).to.have.lengthOf.within(
                            nfTokenRetrieval.contentsOptions.dataChunkSize - 1,
                            nfTokenRetrieval.contentsOptions.dataChunkSize
                        );
                        expect(Buffer.concat(savedContentsData)).to.deep.equal(contentsData);
                        expect(contentsFinalized).to.be.true;
                        expect(contentsBytesRetrieved).to.equal(contentsData.length);
                    }
                    catch (err) {
                        done(err);
                        return;
                    }

                    done();
                });

                const contentsReadable = new contentsChunkReadable(contentsData, Math.ceil(contentsData.length / 3));

                contentsReadable.once('error', (err) => {
                    contentsWritable.destroy(err);
                });

                contentsReadable.pipe(contentsWritable);
            });
        });
    });

    describe('Encrypted contents', function () {
        before(function () {
            // Reset retrieved contents
            savedContentsData = [];
            contentsFinalized = false;
            contentsBytesRetrieved = 0;

            // Simulate encrypted contents
            nfTokenRetrieval.contentsInfo.isEncrypted = true;
            // Simulate no data chunk size
            delete nfTokenRetrieval.contentsOptions.dataChunkSize;
        });

        describe('No chunk size', function () {
            it('should successfully write non-fungible token contents', function (done) {
                const contentsWritable = new NFTokenContentsWritable(nfTokenRetrieval);

                contentsWritable.once('error', done);
                contentsWritable.once('finish', () => {
                    try {
                        // Make sure that all contents have been written
                        expect(savedContentsData).to.have.lengthOf(1);
                        expect(savedContentsData[0]).to.deep.equal(contentsData);
                        expect(contentsFinalized).to.be.true;
                        expect(contentsBytesRetrieved).to.equal(contentsData.length);
                    }
                    catch (err) {
                        done(err);
                        return;
                    }

                    done();
                });

                const encryptedContents = devAssetAddresssKeys[0].encryptData(contentsData);
                const contentsReadable = new contentsChunkReadable(encryptedContents, Math.ceil(encryptedContents.length / 3));

                contentsReadable.once('error', (err) => {
                    contentsWritable.destroy(err);
                });

                contentsReadable.pipe(contentsWritable);
            });
        });

        describe('Larger chunk size', function () {
            before(function () {
                // Reset retrieved contents
                savedContentsData = [];
                contentsFinalized = false;
                contentsBytesRetrieved = 0;

                // Simulate a data chunk size larger than the contents data
                nfTokenRetrieval.contentsOptions.dataChunkSize = contentsData.length +1;
            });

            it('should successfully write non-fungible token contents', function (done) {
                const contentsWritable = new NFTokenContentsWritable(nfTokenRetrieval);

                contentsWritable.once('error', done);
                contentsWritable.once('finish', () => {
                    try {
                        // Make sure that all contents have been written
                        expect(savedContentsData).to.have.lengthOf(1);
                        expect(savedContentsData[0]).to.deep.equal(contentsData);
                        expect(contentsFinalized).to.be.true;
                        expect(contentsBytesRetrieved).to.equal(contentsData.length);
                    }
                    catch (err) {
                        done(err);
                        return;
                    }

                    done();
                });

                const encryptedContents = devAssetAddresssKeys[0].encryptData(contentsData);
                const contentsReadable = new contentsChunkReadable(encryptedContents, Math.ceil(encryptedContents.length / 3));

                contentsReadable.once('error', (err) => {
                    contentsWritable.destroy(err);
                });

                contentsReadable.pipe(contentsWritable);
            });
        });

        describe('Smaller chunk size', function () {
            before(function () {
                // Reset retrieved contents
                savedContentsData = [];
                contentsFinalized = false;
                contentsBytesRetrieved = 0;

                // Simulate a data chunk size half the size of the contents data
                nfTokenRetrieval.contentsOptions.dataChunkSize = Math.ceil(contentsData.length / 2);
            });

            it('should successfully write non-fungible token contents', function (done) {
                const contentsWritable = new NFTokenContentsWritable(nfTokenRetrieval);

                contentsWritable.once('error', done);
                contentsWritable.once('finish', () => {
                    try {
                        // Make sure that all contents have been written
                        expect(savedContentsData).to.have.lengthOf(2);
                        expect(savedContentsData[0]).to.have.lengthOf(nfTokenRetrieval.contentsOptions.dataChunkSize);
                        expect(savedContentsData[1]).to.have.lengthOf.within(
                            nfTokenRetrieval.contentsOptions.dataChunkSize - 1,
                            nfTokenRetrieval.contentsOptions.dataChunkSize
                        );
                        expect(Buffer.concat(savedContentsData)).to.deep.equal(contentsData);
                        expect(contentsFinalized).to.be.true;
                        expect(contentsBytesRetrieved).to.equal(contentsData.length);
                    }
                    catch (err) {
                        done(err);
                        return;
                    }

                    done();
                });

                const encryptedContents = devAssetAddresssKeys[0].encryptData(contentsData);
                const contentsReadable = new contentsChunkReadable(encryptedContents, Math.ceil(encryptedContents.length / 3));

                contentsReadable.once('error', (err) => {
                    contentsWritable.destroy(err);
                });

                contentsReadable.pipe(contentsWritable);
            });
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
        saveRetrievedContentsData: NFTokenRetrieval.prototype.saveRetrievedContentsData,
        finalizeRetrievedContentsData: NFTokenRetrieval.prototype.finalizeRetrievedContentsData,
        updateRetrievalProgress: NFTokenRetrieval.prototype.updateRetrievalProgress,
    };

    NFTokenRetrieval.__callOrigMethod = function (name, ...args) {
        return this.__origMethods[name].call(this, ...args);
    };

    NFTokenRetrieval.prototype.saveRetrievedContentsData = function (contentsData, isFinal) {
        savedContentsData.push(contentsData);
        contentsFinalized = isFinal;
    };

    NFTokenRetrieval.prototype.finalizeRetrievedContentsData = function () {
        contentsFinalized = true;
    }

    NFTokenRetrieval.prototype.updateRetrievalProgress = function (bytesRetrieved) {
        contentsBytesRetrieved += bytesRetrieved;
    }
}
