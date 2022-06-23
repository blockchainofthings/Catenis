/**
 * Created by claudio on 2022-04-11
 */

//console.log('[NFTokenStorageTest.js]: This code just ran.');

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
//import { Catenis } from '../Catenis';
import { NFTokenStorage } from '../NFTokenStorage';
import { IpfsClient } from '../IpfsClient';
import { IpfsClusterClient } from '../IpfsClusterClient';


describe('NFTokenStorage module', function () {
    let nfTokenStorage;
    const data = `Test data (${new Date().toString()})`;
    let dataCID;

    before(function () {
        IpfsClient.initialize();
        IpfsClusterClient.initialize();

        nfTokenStorage = new NFTokenStorage()
    });

    it('should successfully store data to IPFS', function (done) {
        nfTokenStorage.store(data)
        .then(cid => {
            dataCID = cid;
            expect(cid).to.be.a('string').that.match(/^Qm/);

            done();
        })
        .catch(err => {
            done(err);
        })
    });

    it('should successfully retrieve data from IPFS', function (done) {
        const readStream = nfTokenStorage.retrieve(dataCID);
        let readData = Buffer.from('');

        readStream.on('data', chunk => {
            readData = Buffer.concat([readData, chunk])
        });

        readStream.on('end', () => {
            expect(readData.toString()).to.equal(data);

            done();
        });

        readStream.on('error', err => {
            done(err);
        })
    });
});
