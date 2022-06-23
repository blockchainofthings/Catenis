/**
 * Created by claudio on 2022-04-18
 */

//console.log('[CCAssetMetadataTest.js]: This code just ran.');

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
import openssl from 'openssl-wrapper';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from '../Catenis';
import { CCAssetMetadata } from '../CCAssetMetadata';
import { CCUserDataMetadata } from '../CCUserDataMetadata';
import { EccLibraryProxy } from '../EccLibraryProxy';
import { Bip32 } from '../Bip32';
import { CryptoKeys } from '../CryptoKeys';


describe('CCAssetMetadata module', function () {
    /**
     * @type {CCAssetMetadata}
     */
    let ccAssetMetadata;
    /**
     * @type {CryptoKeys}
     */
    let cryptoKeys;
    /**
     * @type {CCMetaAsset}
     */
    let assembledAssetMetadata;

    before(function () {
        EccLibraryProxy.initialize();
        Bip32.initialize();
    });

    it('should successfully instantiate an empty Colored Coins asset metadata object', function () {
        ccAssetMetadata = new CCAssetMetadata();

        expect(ccAssetMetadata).to.be.an.instanceof(CCAssetMetadata);
        expect(ccAssetMetadata).to.deep.equal({
            ctnAssetId: undefined,
            assetName: undefined,
            assetDescription: undefined,
            urls: [],
            userData: new CCUserDataMetadata(),
            signingCertificate: undefined,
        });
    });

    it('should correctly retrieve the message for signing the asset metadata', function () {
        const signingMessage = ccAssetMetadata._signingMessage;

        expect(signingMessage).to.be.a('string').and.match(/^Catenis generated asset on (.+)$/);
        const strDate = signingMessage.match(/^Catenis generated asset on (.+)$/)[1];
        const date = new Date(strDate);
        expect(date.toString).to.not.equal('Invalid Date');
        expect(date.toString()).to.equal(strDate);
    });

    it('should correctly retrieve the Catenis signing certificate', function () {
        const signingCertificate = ccAssetMetadata._getSigningCertificate();

        expect(signingCertificate).to.be.a('string');
        expect(ccAssetMetadata.signingCertificate).to.equal(signingCertificate);
        expect(signingCertificate).to.equal(
            '-----BEGIN CERTIFICATE-----\n' +
            'MIIF/zCCA+egAwIBAgIJAI/yhufPQ/n+MA0GCSqGSIb3DQEBCwUAMIGVMQswCQYD\n' +
            'VQQGEwJVUzERMA8GA1UECAwITmV3IFlvcmsxETAPBgNVBAcMCE5ldyBZb3JrMQ0w\n' +
            'CwYDVQQKDARCQ29UMRAwDgYDVQQLDAdDYXRlbmlzMRAwDgYDVQQDDAdDYXRlbmlz\n' +
            'MS0wKwYJKoZIhvcNAQkBFh5jbGF1ZGlvQGJsb2NrY2hhaW5vZnRoaW5ncy5jb20w\n' +
            'HhcNMTcwOTI5MTQ1NzQ5WhcNMTgwOTI5MTQ1NzQ5WjCBlTELMAkGA1UEBhMCVVMx\n' +
            'ETAPBgNVBAgMCE5ldyBZb3JrMREwDwYDVQQHDAhOZXcgWW9yazENMAsGA1UECgwE\n' +
            'QkNvVDEQMA4GA1UECwwHQ2F0ZW5pczEQMA4GA1UEAwwHQ2F0ZW5pczEtMCsGCSqG\n' +
            'SIb3DQEJARYeY2xhdWRpb0BibG9ja2NoYWlub2Z0aGluZ3MuY29tMIICIjANBgkq\n' +
            'hkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAsARqZRD6XftbEPxplIkaiWVQ70QzRRx6\n' +
            'DKQNRQPxZYvrX8mO7aZtoMZfWeavC7Z/EqF1+kZXt3+dwJ5a/SyHwATAYBytuY9h\n' +
            'mK0AL8851GrisVbbsqjnNAIR07NeZYr89679udics99Zt1XfI1Z1IvceuUB22pXB\n' +
            '0ON+Yrxbac+s0VmJ75VdGOdYGbzTMmkUC8jCUKTsdQ/CBJ9Zfeu9kbEUS6EdJ7Di\n' +
            'GIkmAt9MxbzJLO4I3Fs4SGu6d53OxPKaskRrM1BezTTwJLgfezNlQRNzt4KgAXz+\n' +
            '8OFkfnIV3UakZ0d7rOylEJLRT/A13BvDIzDSbOOTyaK2vSPXCchaFJMlDvF/C7lG\n' +
            'tQl6hri6HzFy5gSPxXbRyGOdFxldBTPeqwVKeqs50EBsu9d7tKdOWpJjxk4gZkS2\n' +
            'qaVb1nACnIiJsKVWq1rWl2zpnPmlKO/Fy2+lg2X99iNojlkWEhL3IoyKa/5GlFJ0\n' +
            '9yKhShDxWeDwbg/RTNVwtb5iNXxG/wvi4k5RTLfUIAM63YhW/KU6n+nIT/Xb3yTq\n' +
            'Wuf6uTTlcXBzmCtmujXcg2CnFo2a1rHp3y01YV2VzH3Xfa8tgyFg016LCB413haF\n' +
            '9LWzJY7Meg4nWCDRzKEXZdeMWLkhiEhX0Jr+4/QSl3/e8ibBK4Azf6ofAQJ/Sc3O\n' +
            'yOSx9Q8ZO60CAwEAAaNQME4wHQYDVR0OBBYEFEZpLW2vuI+AlCFdJgUUFbpQt04s\n' +
            'MB8GA1UdIwQYMBaAFEZpLW2vuI+AlCFdJgUUFbpQt04sMAwGA1UdEwQFMAMBAf8w\n' +
            'DQYJKoZIhvcNAQELBQADggIBAGcvJHY7+Q8yiIaOFlrklV1QDL8ZXj6amPoGq/R3\n' +
            'NfaFb13JRLuHGrFdSGycQIkXtlk0gPTydxuMtOLFKCD64UAJ1Oc/YsMR7DWC5ZPg\n' +
            'WeTkEfz/aeGmvydSYNlyM6L29O+Wh6rskaTZhzcHVj+3OLkdRyrKfVPgpFKffADu\n' +
            '1zXYUCjH4VTEfw4uoyIfPYZpO1jX8GoLgeEP1bHQVObhqiznjNqM9BrZjq0qYK4o\n' +
            '+eYsILPOZ+xhAa2rlitkZg9mrWDVgxr4Q5hGHc6cGjeg64xy9JYdzclvtvTe9Lcr\n' +
            'wbzu1AMsAJCRuAt6enEAnqRY9P89l0zR/8k03PCg/sXkqvbN/Ho+OExuWUSzmXiL\n' +
            '8UpWhd+FKxHCUUdMpi0HvoIzVeYOIdjJUR1zAXwfeZf5HCGVjLiRixhdrFLlYo6z\n' +
            '4opMV5kh4afmctEiKbAGJjn3gQ+zvhAx9dBATQ8DKETvtdchyICsJUEqzJUVh4Xf\n' +
            '4ozwViuR1Lte3QADLKRO64t2wyZM+nLAFvtBTz2qYOk5brIrxQlXinKl4JnglB+s\n' +
            'BpmWPNWRMZvki1WwdnJ7LGq1v6bY8iLKKxXoIoH5FIcZMMJXW71vBd0Xa3Jl8l3P\n' +
            'QeRegjIP2eZ465ECOHvCM8WxpiVRcLeOwMgMUaHXLWXr/Pj94a4wsKABcWnd5EQD\n' +
            '5Pu0\n' +
            '-----END CERTIFICATE-----\n'
        );
    });

    it('should correctly sign a message', function (done) {
        const signedMessage = ccAssetMetadata._signMessage('This is only a test');

        expect(signedMessage).to.match(/^-----BEGIN CMS-----\n/);

        openssl(
            'cms.verify',
            Buffer.from(signedMessage),
            {
                inform: 'PEM',
                noverify: true,
                certfile: '/Users/claudio/Documents/Híades/Clientes/Blockchain_of_Things/Projects/Catenis/Development/Test SSL certificate/Test_cert.pem'
            },
            (err, result) => {
                if (err && err.message !== 'CMS Verification successful\n') {
                    done(err);
                }
                else {
                    expect(result).to.deep.equal(Buffer.from('This is only a test'));
                    done();
                }
            }
        );
    });

    it('should retrieve the correct metadata signed message verification', function () {
        const signedVerification = ccAssetMetadata._getMetadataSignedVerification();

        expect(signedVerification).to.be.an('object').that.have.all.keys(
            [
                'message',
                'signed_message',
                'cert'
            ]
        );
        expect(signedVerification.message).to.match(/^Catenis generated asset on (.+)$/);
        expect(signedVerification.signed_message).to.match(/^-----BEGIN CMS-----\n/);
        expect(signedVerification.cert).to.match(/^-----BEGIN CERTIFICATE-----\n/);
    })

    it('should correctly add URLs to metadata', function () {
        this.timeout(5000)

        ccAssetMetadata.addUrls(
            [
                {
                    url: 'https://sandbox.catenis.io/blah'  // URL shall not be included: Error: not found
                },
                {
                    url: 'https://sandbox.catenis.io/logo/empty'  // URL shall not be included: empty body
                },
                {
                    url: 'https://sandbox.catenis.io/logo/Catenis_small.png',
                    label: 'Catenis logo (small)'
                }
            ]
        );

        expect(ccAssetMetadata.urls).to.deep.equal([
            {
                name: 'Catenis logo (small)',
                url: 'https://sandbox.catenis.io/logo/Catenis_small.png',
                mimeType: 'image/png',
                dataHash: 'dcde5882af4ee42617e5f9b1ff56d801be25c0c1af7ea8334eb46596616b15b2'
            }
        ]);

        // Add one more URL
        ccAssetMetadata.addUrls(
            {
                url: 'https://sandbox.catenis.io/logo/Catenis_large.png',
                mimeType: 'image/*'
            }
        );

        expect(ccAssetMetadata.urls).to.have.lengthOf(2);
        console.debug('>>>>>> urls:', ccAssetMetadata.urls);
        expect(ccAssetMetadata.urls).to.have.deep.members([
            {
                name: 'Catenis logo (small)',
                url: 'https://sandbox.catenis.io/logo/Catenis_small.png',
                mimeType: 'image/png',
                dataHash: 'dcde5882af4ee42617e5f9b1ff56d801be25c0c1af7ea8334eb46596616b15b2'
            },
            {
                name: 'Catenis_large.png',
                url: 'https://sandbox.catenis.io/logo/Catenis_large.png',
                mimeType: 'image/*',
                dataHash: '0a5e3d326c0dfd1f87cebdd63fa214faebb9a3d48234a8c7352186985f838261'
            }
        ]);

        // Clear URLs
        ccAssetMetadata.urls = [];
    });

    it('should successfully set asset properties', function () {
        // No properties set: missing asset ID
        ccAssetMetadata.setAssetProperties(
            {
                name: 'Test NFAsset #1',
                description: 'Non-fungible asset #1 used for testing',
                urls: [
                    {
                        url: 'https://sandbox.catenis.io/logo/Catenis_small.png',
                        label: 'Catenis logo (small)'
                    }
                ]
            }
        );

        expect(ccAssetMetadata).to.deep.include({
            ctnAssetId: undefined,
            assetName: undefined,
            assetDescription: undefined,
            urls: []
        });

        // Should successfully set asset properties
        ccAssetMetadata.setAssetProperties(
            {
                ctnAssetId: 'a00001',
                name: 'Test NFAsset #1',
                description: 'Non-fungible asset #1 used for testing',
                urls: [
                    {
                        url: 'https://sandbox.catenis.io/logo/Catenis_small.png',
                        label: 'Catenis logo (small)'
                    }
                ]
            }
        );

        expect(ccAssetMetadata).to.deep.include({
            ctnAssetId: 'a00001',
            assetName: 'Test NFAsset #1',
            assetDescription: 'Non-fungible asset #1 used for testing',
            urls: [
                {
                    name: 'Catenis logo (small)',
                    url: 'https://sandbox.catenis.io/logo/Catenis_small.png',
                    mimeType: 'image/png',
                    dataHash: 'dcde5882af4ee42617e5f9b1ff56d801be25c0c1af7ea8334eb46596616b15b2'
                }
            ]
        });
    });

    it('should successfully add user data meta', function () {
        ccAssetMetadata.addUserDataMeta(
            {
                meta1: 'This is a test',
                meta2: 5,
                meta3: true,
                meta4: new Date('2022-04-11'),
                meta5: [
                    'URL',
                    'https://example.com/nothing'
                ],
                meta6: [
                    'Email',
                    'nobody@example.com'
                ]
            }
        );

        expect(ccAssetMetadata.userData.meta).to.deep.equal(
            [
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

                }
            ]
        );
    });

    it('should successfully add free user data', function () {
        ccAssetMetadata
        .addFreeUserData('free1', 'This is a test')
        .addFreeUserData('free2', 5)
        .addFreeUserData('free3', Buffer.from('Text #1'), true)

        expect(ccAssetMetadata.userData.freeData).to.deep.equal(
            {
                free1: 'This is a test',
                free2: 5,
                free3: Buffer.from('Text #1'),
            }
        );
    });

    it('should correctly clone Colored Coins asset metadata object', function () {
        expect(ccAssetMetadata.clone()).to.be.an.instanceof(CCAssetMetadata).and.deep.equal(ccAssetMetadata);
    });

    it('should correctly assemble Colored Coins asset metadata', function () {
        cryptoKeys = new CryptoKeys(Catenis.bip32.fromSeed(Buffer.from('This is only a test')));

        // noinspection JSValidateTypes
        assembledAssetMetadata = ccAssetMetadata.assemble(cryptoKeys);

        expect(assembledAssetMetadata).to.not.be.undefined;
        expect(
            _und.omit(assembledAssetMetadata, 'verifications')
        )
        .to.deep.equal(
            {
                assetName: 'Test NFAsset #1',
                issuer: 'Catenis',
                description: 'Non-fungible asset #1 used for testing',
                urls: [
                    {
                        name: 'Catenis logo (small)',
                        url: 'https://sandbox.catenis.io/logo/Catenis_small.png',
                        mimeType: 'image/png',
                        dataHash: 'dcde5882af4ee42617e5f9b1ff56d801be25c0c1af7ea8334eb46596616b15b2'
                    },
                    {
                        name: 'icon',
                        url: 'https://sandbox.catenis.io/logo/Catenis_large.png',
                        mimeType: 'image/png',
                        dataHash: '0a5e3d326c0dfd1f87cebdd63fa214faebb9a3d48234a8c7352186985f838261'
                    }
                ],
                userData: {
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
                            key: 'ctnAssetId',
                            type: 'String',
                            value: 'a00001'
                        }
                    ],
                    free1: 'This is a test',
                    free2: 5,
                    __enc_free3: cryptoKeys.encryptData(Buffer.from('Text #1')).toString('base64')
                }
            }
        );
        expect(assembledAssetMetadata.verifications).to.be.an('object').with.all.keys('signed');
        expect(assembledAssetMetadata.verifications.signed).to.be.an('object').that.have.all.keys(
            [
                'message',
                'signed_message',
                'cert'
            ]
        );
        expect(assembledAssetMetadata.verifications.signed.message).to.match(/^Catenis generated asset on (.+)$/);
        expect(assembledAssetMetadata.verifications.signed.signed_message).to.match(/^-----BEGIN CMS-----\n/);
        expect(assembledAssetMetadata.verifications.signed.cert).to.match(/^-----BEGIN CERTIFICATE-----\n/);
    });

    it('should correctly instantiate Colored Coins asset metadata object from assembled asset metadata', function () {
        const ccAssetMetadata2 = new CCAssetMetadata(assembledAssetMetadata, cryptoKeys);

        expect(ccAssetMetadata2)
        .to.deep.equal(
            _und.omit(ccAssetMetadata, 'signingCertificate')
        );
    });
});