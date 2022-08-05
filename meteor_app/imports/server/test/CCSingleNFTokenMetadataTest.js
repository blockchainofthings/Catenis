/**
 * Created by claudio on 2022-04-12
 */

//console.log('[CCSingleNFTokenMetadataTest.js]: This code just ran.');

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
import { CCSingleNFTokenMetadata } from '../CCSingleNFTokenMetadata';
import { NFTokenContentsUrl } from '../NFTokenContentsUrl';
import { EccLibraryProxy } from '../EccLibraryProxy';
import { Bip32 } from '../Bip32';
import { CryptoKeys } from '../CryptoKeys';


describe('CCSingleNFTokenMetadata module', function () {
    /**
     * @type {CCSingleNFTokenMetadata}
     */
    let nfTokenMetadata;
    /**
     * @type {CryptoKeys}
     */
    let cryptoKeys;

    before(function () {
        EccLibraryProxy.initialize();
        Bip32.initialize();
    });

    it('should correctly instantiate an empty single non-fungible token metadata object', function () {
        nfTokenMetadata = new CCSingleNFTokenMetadata();

        expect(nfTokenMetadata).to.be.an.instanceof(CCSingleNFTokenMetadata);
        expect(nfTokenMetadata.isEmpty).to.be.true;
    });

    describe('With sensitive data', function () {
        it('should correctly set the non-fungible token properties', function () {
            const nfTokenProps = {
                name: 'Test NFT #1',
                description: 'Non-fungible token #1 used for testing',
                custom: {
                    sensitiveProps: {
                        secret1: 'Secret text #1',
                        secret2: 123
                    },
                    custom1: 'Custom property #1',
                    custom2: 'Custom property #2'
                },
                contents: new NFTokenContentsUrl('QmUkhVi6zRJz5U87jUjK9ZGTazaXLDKLfGbMRHxiai5xUn'),
                contentsEncrypted: true
            };

            nfTokenMetadata.setNFTokenProperties(nfTokenProps);

            expect(nfTokenMetadata.meta).to.have.deep.members([
                {
                    key: 'name',
                    type: 'String',
                    value: 'Test NFT #1'
                },
                {
                    key: 'description',
                    type: 'String',
                    value: 'Non-fungible token #1 used for testing'
                },
                {
                    key: 'contents',
                    type: 'URL',
                    value: new NFTokenContentsUrl('QmUkhVi6zRJz5U87jUjK9ZGTazaXLDKLfGbMRHxiai5xUn').toString()
                },
                {
                    key: 'contentsEncrypted',
                    type: 'Boolean',
                    value: 'true'
                }
            ]);
            expect(nfTokenMetadata.freeData).to.deep.equal({
                secret1: Buffer.from('"Secret text #1"'),
                secret2: Buffer.from('123'),
                custom1: 'Custom property #1',
                custom2: 'Custom property #2'
            });
            expect(nfTokenMetadata.encryptUserDataKeys).to.include('secret1');
            expect(nfTokenMetadata.encryptUserDataKeys).to.include('secret2');

            expect(nfTokenMetadata.tokenProps).to.deep.equal(nfTokenProps);
            expect(nfTokenMetadata.isEmpty).to.be.false;
            expect(nfTokenMetadata.contentsUrl).to.deep.equal(nfTokenProps.contents);
            expect(nfTokenMetadata.areContentsEncrypted).to.be.true;
            expect(nfTokenMetadata.hasSensitiveProps).to.be.true;
        });

        it('should correctly clone single non-fungible token metadata object', function () {
            expect(nfTokenMetadata.clone()).to.be.an.instanceof(CCSingleNFTokenMetadata).and.deep.equal(nfTokenMetadata);
        });

        it('should correctly clone the non-fungible token properties', function () {
            expect(nfTokenMetadata.cloneTokenProps()).to.deep.equal(nfTokenMetadata.tokenProps);
        });

        it('should correctly instantiate single non-fungible token metadata object from assembled data', function () {
            cryptoKeys = new CryptoKeys(Catenis.bip32.fromSeed(Buffer.from('This is only a test')));

            expect(new CCSingleNFTokenMetadata(nfTokenMetadata.assemble(cryptoKeys), cryptoKeys)).to.deep.equal(nfTokenMetadata);
        });

        it('should correctly clear single non-fungible token metadata object', function () {
            nfTokenMetadata.clear();

            expect(nfTokenMetadata.isEmpty).to.be.true;
        });
    });

    describe('With no sensitive data', function () {
        it('should correctly set the non-fungible token properties', function () {
            const nfTokenProps = {
                name: 'Test NFT #1',
                description: 'Non-fungible token #1 used for testing',
                custom: {
                    custom1: 'Custom property #1',
                    custom2: 'Custom property #2'
                },
                contents: new NFTokenContentsUrl('QmUkhVi6zRJz5U87jUjK9ZGTazaXLDKLfGbMRHxiai5xUn'),
                contentsEncrypted: false
            };

            nfTokenMetadata.setNFTokenProperties(nfTokenProps);

            expect(nfTokenMetadata.meta).to.have.deep.members([
                {
                    key: 'name',
                    type: 'String',
                    value: 'Test NFT #1'
                },
                {
                    key: 'description',
                    type: 'String',
                    value: 'Non-fungible token #1 used for testing'
                },
                {
                    key: 'contents',
                    type: 'URL',
                    value: new NFTokenContentsUrl('QmUkhVi6zRJz5U87jUjK9ZGTazaXLDKLfGbMRHxiai5xUn').toString()
                },
                {
                    key: 'contentsEncrypted',
                    type: 'Boolean',
                    value: 'false'
                }
            ]);
            expect(nfTokenMetadata.freeData).to.deep.equal({
                custom1: 'Custom property #1',
                custom2: 'Custom property #2'
            });
            expect(nfTokenMetadata.encryptUserDataKeys).to.be.empty;

            expect(nfTokenMetadata.tokenProps).to.deep.equal(nfTokenProps);
            expect(nfTokenMetadata.isEmpty).to.be.false;
            expect(nfTokenMetadata.contentsUrl).to.deep.equal(nfTokenProps.contents);
            expect(nfTokenMetadata.areContentsEncrypted).to.be.false;
            expect(nfTokenMetadata.hasSensitiveProps).to.be.false;
        });

        it('should correctly clone single non-fungible token metadata object', function () {
            expect(nfTokenMetadata.clone()).to.be.an.instanceof(CCSingleNFTokenMetadata).and.deep.equal(nfTokenMetadata);
        });

        it('should correctly clone the non-fungible token properties', function () {
            expect(nfTokenMetadata.cloneTokenProps()).to.deep.equal(nfTokenMetadata.tokenProps);
        });

        it('should correctly instantiate single non-fungible token metadata object from assembled data', function () {
            expect(new CCSingleNFTokenMetadata(nfTokenMetadata.assemble())).to.deep.equal(nfTokenMetadata);
        });

        it('should correctly clear single non-fungible token metadata object', function () {
            nfTokenMetadata.clear();

            expect(nfTokenMetadata.isEmpty).to.be.true;
        });
    });
});
