/**
 * Created by claudio on 2022-04-15
 */

//console.log('[NFTokenContentsUrlTest.js]: This code just ran.');

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
import { NFTokenContentsUrl } from '../NFTokenContentsUrl';


describe('NFTokenContentsUrl module', function () {
    let nfTokenContentsUrl;

    it('should correctly initialize a dummy CID', function () {
        expect(NFTokenContentsUrl._dummyCID).to.equal('QmNLei78zWmzUdbeRB3CiUfAizWUrbeeZh5K1rhAQKCh51')
    });

    it('should correctly retrieve a contents URL for a dummy CID', function () {
        const dummyContentsUrl = NFTokenContentsUrl.dummyUrl;

        expect(dummyContentsUrl).to.be.an.instanceof(NFTokenContentsUrl);
        expect(dummyContentsUrl.toString()).to.equal('https://ipfs.catenis.io/ipfs/QmNLei78zWmzUdbeRB3CiUfAizWUrbeeZh5K1rhAQKCh51');
    });

    it('should fail to instantiate non-fungible token contents url object (invalid CID)', function () {
        expect(function () {
            new NFTokenContentsUrl('blah');
        })
        .to.throw('Invalid CID');
    });

    it('should fail to instantiate non-fungible token contents url object (invalid URL origin)', function () {
        expect(function () {
            new NFTokenContentsUrl('QmUkhVi6zRJz5U87jUjK9ZGTazaXLDKLfGbMRHxiai5xUn', 'blah');
        })
        .to.throw('Invalid URL origin');
    });

    it('should successfully instantiate non-fungible token contents url object (default origin)', function () {
        nfTokenContentsUrl = new NFTokenContentsUrl('QmUkhVi6zRJz5U87jUjK9ZGTazaXLDKLfGbMRHxiai5xUn');

        expect(nfTokenContentsUrl).to.be.an.instanceof(NFTokenContentsUrl);
        expect(nfTokenContentsUrl.cid).to.equal('QmUkhVi6zRJz5U87jUjK9ZGTazaXLDKLfGbMRHxiai5xUn');
        expect(nfTokenContentsUrl.toString()).to.equal('https://ipfs.catenis.io/ipfs/QmUkhVi6zRJz5U87jUjK9ZGTazaXLDKLfGbMRHxiai5xUn');
    });

    it('should successfully instantiate non-fungible token contents url object (custom origin)', function () {
        nfTokenContentsUrl = new NFTokenContentsUrl('QmUkhVi6zRJz5U87jUjK9ZGTazaXLDKLfGbMRHxiai5xUn', 'https://example.com');

        expect(nfTokenContentsUrl).to.be.an.instanceof(NFTokenContentsUrl);
        expect(nfTokenContentsUrl.cid).to.equal('QmUkhVi6zRJz5U87jUjK9ZGTazaXLDKLfGbMRHxiai5xUn');
        expect(nfTokenContentsUrl.toString()).to.equal('https://example.com/ipfs/QmUkhVi6zRJz5U87jUjK9ZGTazaXLDKLfGbMRHxiai5xUn');
    });

    it('should correctly clone the non-fungible token contents url object', function () {
        expect(nfTokenContentsUrl.clone()).to.be.an.instanceof(NFTokenContentsUrl).and.deep.equal(nfTokenContentsUrl);
    });

    it('should fail to update the CID', function () {
        expect(function () {
            nfTokenContentsUrl.cid = 'blah';
        })
        .to.throw('Invalid CID');
    });

    it('should correctly update the CID', function () {
        nfTokenContentsUrl.cid = 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG';

        expect(nfTokenContentsUrl.cid).to.equal('QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG');
    });

    it('should fail to parse contents URL (invalid URL)', function () {
        expect(function () {
            NFTokenContentsUrl.parse('blah');
        })
        .to.throw('Invalid URL');
    });

    it('should fail to parse contents URL (invalid CID)', function () {
        expect(function () {
            NFTokenContentsUrl.parse('https://example.com/ipfs/bla');
        })
        .to.throw('Invalid CID');
    });

    it('should correctly parse contents URL', function () {
        nfTokenContentsUrl = NFTokenContentsUrl.parse('https://example.com/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG');

        expect(nfTokenContentsUrl).to.be.an.instanceof(NFTokenContentsUrl);
        expect(nfTokenContentsUrl.cid).to.equal('QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG');
        expect(nfTokenContentsUrl.toString()).to.equal('https://example.com/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG');
    });
});
