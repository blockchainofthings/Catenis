/**
 * Created by claudio on 2022-07-13
 */

//console.log('[NFTokenContentsTransformTest.js]: This code just ran.');

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
import { NFTokenContentsTransform } from '../NFTokenContentsTransform';
import { NFTokenContentsProgress } from '../NFTokenContentsProgress';
import { EccLibraryProxy } from '../EccLibraryProxy';
import { Bip32 } from '../Bip32';
import { CryptoKeys } from '../CryptoKeys';

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


describe('NFTokenContentsTransform module', function () {
    let contentsProgress;
    let contentsChunkReadable;
    let contentsWritable;

    before(function () {
        EccLibraryProxy.initialize();
        Bip32.initialize();

        // Object to handle the progress of reading/writing non-fungible token contents
        class _contentsProgress extends NFTokenContentsProgress {
            constructor() {
                super();

                this.bytesRead = 0;
                this.bytesWritten = 0;
            }

            reportReadProgress(bytesRead) {
                this.bytesRead += bytesRead;
            }

            reportWriteProgress(bytesWritten) {
                this.bytesWritten += bytesWritten;
            }
        }

        contentsProgress = _contentsProgress;

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

        // Stream to write contents
        class _contentsWritable extends stream.Writable {
            constructor(options) {
                super(options);
                this.contents = Buffer.from('');
            }

            _write(chunk, encoding, callback) {
                this.contents = Buffer.concat([this.contents, chunk]);
                callback();
            }

            _destroy(err, callback) {
                callback(err);
            }
        }

        contentsWritable = _contentsWritable;
    });

    describe('Encrypted contents', function () {
        let cryptoKeys1;
        let cryptoKeys2;
        let encryptedSourceContents;
        let encryptedDestContents;

        before(function () {
            cryptoKeys1 = CryptoKeys.random();
            cryptoKeys2 = CryptoKeys.random();

            encryptedSourceContents = cryptoKeys1.encryptData(contentsData);
            encryptedDestContents = cryptoKeys2.encryptData(contentsData);
        });

        it('should successfully transform the non-fungible token contents', function (done) {
            const nftContentsProgress = new contentsProgress();

            const nftContentsWritable = new contentsWritable();

            nftContentsWritable.once('error', done);
            nftContentsWritable.once('finish', () => {
                try {
                    expect(nftContentsWritable.contents).to.deep.equal(encryptedDestContents);
                    expect(nftContentsProgress.bytesRead, 'Bytes read').to.equal(contentsData.length);
                    expect(nftContentsProgress.bytesWritten, 'Bytes written').to.equal(contentsData.length);
                }
                catch (err) {
                    done(err);
                    return;
                }

                done();
            });

            const nftContentsTransform = new NFTokenContentsTransform(nftContentsProgress);

            nftContentsTransform.once('error', (err) => {
                nftContentsWritable.destroy(err);
            });

            nftContentsTransform.setDecryption(cryptoKeys1);
            nftContentsTransform.setEncryption(cryptoKeys2);

            const nftContentsReadable = new contentsChunkReadable(encryptedSourceContents, Math.ceil(encryptedSourceContents.length / 3));

            nftContentsReadable.once('error', (err) => {
                nftContentsTransform.destroy(err);
            });

            nftContentsReadable
            .pipe(nftContentsTransform)
            .pipe(nftContentsWritable);
        });
    });

    describe('Unencrypted contents', function () {
        it('should successfully transform the non-fungible token contents', function (done) {
            const nftContentsProgress = new contentsProgress();

            const nftContentsWritable = new contentsWritable();

            nftContentsWritable.once('error', done);
            nftContentsWritable.once('finish', () => {
                try {
                    expect(nftContentsWritable.contents).to.deep.equal(contentsData);
                    expect(nftContentsProgress.bytesRead, 'Bytes read').to.equal(contentsData.length);
                    expect(nftContentsProgress.bytesWritten, 'Bytes written').to.equal(contentsData.length);
                }
                catch (err) {
                    done(err);
                    return;
                }

                done();
            });

            const nftContentsTransform = new NFTokenContentsTransform(nftContentsProgress);

            nftContentsTransform.once('error', (err) => {
                nftContentsWritable.destroy(err);
            });

            const nftContentsReadable = new contentsChunkReadable(contentsData, Math.ceil(contentsData.length / 3));

            nftContentsReadable.once('error', (err) => {
                nftContentsTransform.destroy(err);
            });

            nftContentsReadable
            .pipe(nftContentsTransform)
            .pipe(nftContentsWritable);
        });

        describe('Error while reading contents', function () {
            let nftContentsErrorReadable;

            before(function () {
                nftContentsErrorReadable = new stream.Readable({
                    read: function () {
                        this.destroy(new Error('Simulated error reading contents'));
                    }
                });
            });

            it('should correctly handle error while reading contents', function (done) {
                const nftContentsProgress = new contentsProgress();

                const nftContentsWritable = new contentsWritable();

                nftContentsWritable.once('error', (err) => {
                    try {
                        expect(err.message).to.have.string('Simulated error reading contents');
                    }
                    catch (err) {
                        done(err);
                        return;
                    }

                    done();
                });
                nftContentsWritable.once('finish', () => {
                    done(expect.fail('Should not have finished transforming contents'));
                });

                const nftContentsTransform = new NFTokenContentsTransform(nftContentsProgress);

                nftContentsTransform.once('error', (err) => {
                    nftContentsWritable.destroy(err);
                });

                nftContentsErrorReadable.once('error', (err) => {
                    nftContentsTransform.destroy(err);
                });

                nftContentsErrorReadable
                .pipe(nftContentsTransform)
                .pipe(nftContentsWritable);
            });
        });
    });

    describe('Encrypted to unencrypted contents', function () {
        let cryptoKeys1;
        let encryptedSourceContents;

        before(function () {
            cryptoKeys1 = CryptoKeys.random();

            encryptedSourceContents = cryptoKeys1.encryptData(contentsData);
        });

        it('should successfully transform the non-fungible token contents', function (done) {
            const nftContentsProgress = new contentsProgress();

            const nftContentsWritable = new contentsWritable();

            nftContentsWritable.once('error', done);
            nftContentsWritable.once('finish', () => {
                try {
                    expect(nftContentsWritable.contents).to.deep.equal(contentsData);
                    expect(nftContentsProgress.bytesRead, 'Bytes read').to.equal(contentsData.length);
                    expect(nftContentsProgress.bytesWritten, 'Bytes written').to.equal(contentsData.length);
                }
                catch (err) {
                    done(err);
                    return;
                }

                done();
            });

            const nftContentsTransform = new NFTokenContentsTransform(nftContentsProgress);

            nftContentsTransform.once('error', (err) => {
                nftContentsWritable.destroy(err);
            });

            nftContentsTransform.setDecryption(cryptoKeys1);

            const nftContentsReadable = new contentsChunkReadable(encryptedSourceContents, Math.ceil(encryptedSourceContents.length / 3));

            nftContentsReadable.once('error', (err) => {
                nftContentsTransform.destroy(err);
            });

            nftContentsReadable
            .pipe(nftContentsTransform)
            .pipe(nftContentsWritable);
        });
    });

    describe('Unencrypted to encrypted contents', function () {
        let cryptoKeys1;
        let encryptedDestContents;

        before(function () {
            cryptoKeys1 = CryptoKeys.random();

            encryptedDestContents = cryptoKeys1.encryptData(contentsData);
        });

        it('should successfully transform the non-fungible token contents', function (done) {
            const nftContentsProgress = new contentsProgress();

            const nftContentsWritable = new contentsWritable();

            nftContentsWritable.once('error', done);
            nftContentsWritable.once('finish', () => {
                try {
                    expect(nftContentsWritable.contents).to.deep.equal(encryptedDestContents);
                    expect(nftContentsProgress.bytesRead, 'Bytes read').to.equal(contentsData.length);
                    expect(nftContentsProgress.bytesWritten, 'Bytes written').to.equal(contentsData.length);
                }
                catch (err) {
                    done(err);
                    return;
                }

                done();
            });

            const nftContentsTransform = new NFTokenContentsTransform(nftContentsProgress);

            nftContentsTransform.once('error', (err) => {
                nftContentsWritable.destroy(err);
            });

            nftContentsTransform.setEncryption(cryptoKeys1);

            const nftContentsReadable = new contentsChunkReadable(contentsData, Math.ceil(contentsData.length / 3));

            nftContentsReadable.once('error', (err) => {
                nftContentsTransform.destroy(err);
            });

            nftContentsReadable
            .pipe(nftContentsTransform)
            .pipe(nftContentsWritable);
        });
    });
});
