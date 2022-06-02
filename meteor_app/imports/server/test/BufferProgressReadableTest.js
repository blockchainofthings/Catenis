/**
 * Created by claudio on 2022-05-19
 */

//console.log('[BufferProgressReadableTest.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import { expect } from 'chai';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from '../Catenis';
import { BufferProgressReadable } from '../BufferProgressReadable';


describe('BufferProgressReadable module', function () {
    const sourceData = Buffer.from('This is only a test: blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
        + ', blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
        + ', blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
        + ', blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
        + ', blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
        + ', blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
        + ', blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
        + ', blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
        + ', blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah, blah'
    );
    const internalBufferSize = Math.ceil(sourceData.length / 2);

    it('should successfully read the buffer data (without a progress callback)', function (done) {
        const readStream = new BufferProgressReadable(sourceData);

        let readData = Buffer.from('');

        readStream.on('data', chunk => {
            readData = Buffer.concat([readData, chunk]);
        });

        readStream.on('end', () => {
            expect(readData).to.deep.equal(sourceData);

            done();
        });

        readStream.on('error', err => {
            done(err);
        });
    });

    it('should successfully read the buffer data with a progress callback', function (done) {
        const progress = {
            callCount: 0,
            bytesRead: 0
        };

        const readStream = new BufferProgressReadable(sourceData, (bytesRead) => {
            progress.callCount++;
            progress.bytesRead += bytesRead;
        }, {
            highWaterMark: internalBufferSize
        });

        let readData = Buffer.from('');

        readStream.on('data', chunk => {
            readData = Buffer.concat([readData, chunk]);
        });

        readStream.on('end', () => {
            expect(readData).to.deep.equal(sourceData);

            expect(progress).to.deep.equal({
                callCount: Math.ceil(sourceData.length / internalBufferSize),
                bytesRead: sourceData.length
            });

            done();
        });

        readStream.on('error', err => {
            done(err);
        });
    });
});
