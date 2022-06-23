/**
 * Created by claudio on 2022-04-11
 */

//console.log('[CCUserDataMetadataTest.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import { expect } from 'chai';
import moment from 'moment';
import _und from 'underscore';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from '../Catenis';
import { CCUserDataMetadata } from '../CCUserDataMetadata';
import { EccLibraryProxy } from '../EccLibraryProxy';
import { Bip32 } from '../Bip32';
import { CryptoKeys } from '../CryptoKeys';


describe('CCUserDataMetadata module', function () {
    /**
     * @type {CCUserDataMetadata}
     */
    let ccUserData;
    /**
     * @type {CryptoKeys}
     */
    let cryptoKeys;
    /**
     * @type {CCMetaUserData}
     */
    let assembledData;

    before(function () {
        EccLibraryProxy.initialize();
        Bip32.initialize();
    });

    it('should correctly instantiate an empty Colored Coins user data metadata object', function () {
        ccUserData = new CCUserDataMetadata();

        expect(ccUserData).to.be.an.instanceof(CCUserDataMetadata);
        expect(ccUserData.isEmpty).to.be.true;
    });

    it('should correctly add meta data', function () {
        // Add initial meta data
        ccUserData.addMeta({
            meta1: 'This is a test',
            meta2: 5,
            meta3: true,
        });

        expect(ccUserData.meta).to.deep.equal([
            {
                key: 'meta1',
                type: 'String',
                value: 'This is a test'
            },
            {
                key: 'meta2',
                type: 'Number',
                value: '5'
            },
            {
                key: 'meta3',
                type: 'Boolean',
                value: 'true'
            },
        ]);
        expect(ccUserData.hasMetaKey('meta1')).to.be.true;
        expect(ccUserData.hasMetaKey('meta2')).to.be.true;
        expect(ccUserData.hasMetaKey('meta3')).to.be.true;

        // Add remaining meta data
        ccUserData.addMeta({
            meta4: new Date('2022-04-11'),
            meta5: [
                'URL',
                'https://example.com/nothing'
            ],
            meta6: [
                'Email',
                'nobody@example.com'
            ],
            meta7: {
                meta7_1: 'Hi there!',
                meta7_2: false,
                meta7_3: [
                    'Email',
                    'anything@anywhere.com'
                ]
            }
        });

        expect(ccUserData.meta).to.deep.equal([
            {
                key: 'meta1',
                type: 'String',
                value: 'This is a test'
            },
            {
                key: 'meta2',
                type: 'Number',
                value: '5'
            },
            {
                key: 'meta3',
                type: 'Boolean',
                value: 'true'
            },
            {
                key: 'meta4',
                type: 'Date',
                value: moment(new Date('2022-04-11')).format()
            },
            {
                key: 'meta5',
                type: 'URL',
                value: 'https://example.com/nothing'
            },
            {
                key: 'meta6',
                type: 'Email',
                value: 'nobody@example.com'

            },
            {
                key: 'meta7',
                type: 'Array',
                value: [
                    {
                        key: 'meta7_1',
                        type: 'String',
                        value: 'Hi there!'
                    },
                    {
                        key: 'meta7_2',
                        type: 'Boolean',
                        value: 'false'
                    },
                    {
                        key: 'meta7_3',
                        type: 'Email',
                        value: 'anything@anywhere.com'
                    }
                ]
            }
        ]);
        expect(ccUserData.hasMetaKey('meta1')).to.be.true;
        expect(ccUserData.hasMetaKey('meta2')).to.be.true;
        expect(ccUserData.hasMetaKey('meta3')).to.be.true;
        expect(ccUserData.hasMetaKey('meta4')).to.be.true;
        expect(ccUserData.hasMetaKey('meta5')).to.be.true;
        expect(ccUserData.hasMetaKey('meta6')).to.be.true;
        expect(ccUserData.hasMetaKey('meta7')).to.be.true;
    });

    it('should correctly add free data', function () {
        // Invalid key
        ccUserData
        .addFreeData({}, null)  // Invalid key
        .addFreeData('free1', 'This is a test')
        .addFreeData('free2', 5)
        .addFreeData('meta', Buffer.from('Text #2')) // Reserved key
        .addFreeData('__esc_', Buffer.from('Text #4'))
        .addFreeData('__enc_free5', Buffer.from('Text #3')) // Reserved key
        .addFreeData('free3', {a: 'Hello', b: 5}, true) // Non-buffer (no encryption)
        .addFreeData('free4', Buffer.from('Text #1'), true)
        .addFreeData('__enc_', Buffer.from('Text #3'), true)
        .addFreeData('__esc_free6', Buffer.from('Text #4'), true); // Reserved key

        expect(ccUserData.freeData).to.deep.equal({
            free1: 'This is a test',
            free2: 5,
            meta: Buffer.from('Text #2'),
            __esc_: Buffer.from('Text #4'),
            __enc_free5: Buffer.from('Text #3'),
            free3: {a: 'Hello', b: 5},
            free4: Buffer.from('Text #1'),
            __enc_: Buffer.from('Text #3'),
            __esc_free6: Buffer.from('Text #4')
        });
        expect(ccUserData.hasFreeDataKey({})).to.be.false;
        expect(ccUserData.hasFreeDataKey('free1')).to.be.true;
        expect(ccUserData.hasFreeDataKey('free2')).to.be.true;
        expect(ccUserData.hasFreeDataKey('meta')).to.be.true;
        expect(ccUserData.hasFreeDataKey('__esc_')).to.be.true;
        expect(ccUserData.hasFreeDataKey('__enc_free5')).to.be.true;
        expect(ccUserData.hasFreeDataKey('free3')).to.be.true;
        expect(ccUserData.hasFreeDataKey('free4')).to.be.true;
        expect(ccUserData.hasFreeDataKey('__enc_')).to.be.true;
        expect(ccUserData.hasFreeDataKey('__esc_free6')).to.be.true;

        expect(ccUserData.encryptUserDataKeys).to.not.include('free3');
        expect(ccUserData.encryptUserDataKeys).to.include('free4');
        expect(ccUserData.encryptUserDataKeys).to.include('__enc_');
        expect(ccUserData.encryptUserDataKeys).to.include('__esc_free6');
    });

    it('should correctly clone user data metadata object', function () {
        expect(ccUserData.clone()).to.be.an.instanceof(CCUserDataMetadata).and.deep.equal(ccUserData);
    });

    it('should correctly assemble user data metadata with no encryption', function () {
        assembledData = ccUserData.assemble();

        expect(assembledData).to.not.be.undefined;
        expect(assembledData).to.deep.equal({
            meta: [
                {
                    key: 'meta1',
                    type: 'String',
                    value: 'This is a test'
                },
                {
                    key: 'meta2',
                    type: 'Number',
                    value: '5'
                },
                {
                    key: 'meta3',
                    type: 'Boolean',
                    value: 'true'
                },
                {
                    key: 'meta4',
                    type: 'Date',
                    value: moment(new Date('2022-04-11')).format()
                },
                {
                    key: 'meta5',
                    type: 'URL',
                    value: 'https://example.com/nothing'
                },
                {
                    key: 'meta6',
                    type: 'Email',
                    value: 'nobody@example.com'

                },
                {
                    key: 'meta7',
                    type: 'Array',
                    value: [
                        {
                            key: 'meta7_1',
                            type: 'String',
                            value: 'Hi there!'
                        },
                        {
                            key: 'meta7_2',
                            type: 'Boolean',
                            value: 'false'
                        },
                        {
                            key: 'meta7_3',
                            type: 'Email',
                            value: 'anything@anywhere.com'
                        }
                    ]
                }
            ],
            free1: 'This is a test',
            free2: 5,
            __esc_meta: Buffer.from('Text #2'),
            __esc_: Buffer.from('Text #4'),
            __esc___enc_free5: Buffer.from('Text #3'),
            free3: {a: 'Hello', b: 5},
            free4: Buffer.from('Text #1'),
            __enc_: Buffer.from('Text #3'),
            __esc___esc_free6: Buffer.from('Text #4')
        });
    });

    it('should correctly instantiate Colored Coins user data metadata object from assembled data (with no encryption)', function () {
        const ccUserData2 = new CCUserDataMetadata(assembledData);

        expect(
            _und.omit(ccUserData2, 'encryptUserDataKeys')
        )
        .to.deep.equal(
            _und.omit(ccUserData, 'encryptUserDataKeys')
        );
        expect(ccUserData2.encryptUserDataKeys).to.be.empty;
    });

    it('should correctly assemble user data metadata', function () {
        cryptoKeys = new CryptoKeys(Catenis.bip32.fromSeed(Buffer.from('This is only a test')));

        assembledData = ccUserData.assemble(cryptoKeys);

        expect(assembledData).to.not.be.undefined;
        expect(assembledData).to.deep.equal({
            meta: [
                {
                    key: 'meta1',
                    type: 'String',
                    value: 'This is a test'
                },
                {
                    key: 'meta2',
                    type: 'Number',
                    value: '5'
                },
                {
                    key: 'meta3',
                    type: 'Boolean',
                    value: 'true'
                },
                {
                    key: 'meta4',
                    type: 'Date',
                    value: moment(new Date('2022-04-11')).format()
                },
                {
                    key: 'meta5',
                    type: 'URL',
                    value: 'https://example.com/nothing'
                },
                {
                    key: 'meta6',
                    type: 'Email',
                    value: 'nobody@example.com'

                },
                {
                    key: 'meta7',
                    type: 'Array',
                    value: [
                        {
                            key: 'meta7_1',
                            type: 'String',
                            value: 'Hi there!'
                        },
                        {
                            key: 'meta7_2',
                            type: 'Boolean',
                            value: 'false'
                        },
                        {
                            key: 'meta7_3',
                            type: 'Email',
                            value: 'anything@anywhere.com'
                        }
                    ]
                }
            ],
            free1: 'This is a test',
            free2: 5,
            __esc_meta: Buffer.from('Text #2'),
            __esc_: Buffer.from('Text #4'),
            __esc___enc_free5: Buffer.from('Text #3'),
            free3: {a: 'Hello', b: 5},
            __enc_free4: cryptoKeys.encryptData(Buffer.from('Text #1')).toString('base64'),
            __enc___enc_: cryptoKeys.encryptData(Buffer.from('Text #3')).toString('base64'),
            __enc___esc___esc_free6: cryptoKeys.encryptData(Buffer.from('Text #4')).toString('base64')
        });
    });

    it('should correctly instantiate Colored Coins user data metadata object from assembled data', function () {
        expect(new CCUserDataMetadata(assembledData, cryptoKeys)).to.deep.equal(ccUserData);
    });

    it('should correctly clear Colored Coins user data metadata object', function () {
        ccUserData.clear();

        expect(ccUserData.isEmpty).to.be.true;
    });

    it('should return undefined when assembling an empty object', function () {
        expect(new CCUserDataMetadata().assemble()).to.be.undefined;
    });
});
