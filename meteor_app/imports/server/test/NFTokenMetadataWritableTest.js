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
//import { Catenis } from '../Catenis';
import { NFTokenMetadataWritable } from '../NFTokenMetadataWritable';
import { NFTokenMetadataRepo } from '../NFTokenMetadataRepo';


describe('NFTokenMetadataWritable module', function () {
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
    let nfTokenMetaRepo;
    let metaChunkReadable;

    before(function () {
        // Object to handle retrieved non-fungible token metadata
        class _metaRepo extends NFTokenMetadataRepo {
            constructor() {
                super();

                this.metadata = undefined;
                this.bytesRetrieved = 0;
            }

            reportProgress(bytesRetrieved) {
                this.bytesRetrieved += bytesRetrieved;
            }

            saveToRepo(metadata) {
                this.metadata = metadata;
            }
        }

        nfTokenMetaRepo = new _metaRepo();

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
        const metaWritable = new NFTokenMetadataWritable(nfTokenMetaRepo);

        metaWritable.once('error', done);
        metaWritable.once('finish', () => {
            try {
                // Make sure that all metadata has been written
                expect(nfTokenMetaRepo.metadata).to.deep.equal(metadata);
                expect(nfTokenMetaRepo.bytesRetrieved).to.equal(JSON.stringify(metadata).length);
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
            const metaWritable = new NFTokenMetadataWritable(nfTokenMetaRepo);

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
