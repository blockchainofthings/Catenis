/**
 * Created by claudio on 2022-02-23
 */

//console.log('[CCAssetMetadata.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import util from 'util';
import crypto from 'crypto';
import fs from 'fs';
// Third-party node modules
import config from 'config';
import openssl from 'openssl-wrapper';
import got from 'got';
// Meteor packages
import { Meteor } from 'meteor/meteor';
import { Promise } from 'meteor/promise';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import {
    CCUserDataMetadata,
    parseUserDataMetaValue
} from './CCUserDataMetadata';
import { Util } from './Util';

// Config entries
const ccAssetMetaConfig = config.get('ccAssetMetadata');

// Configuration settings
const cfgSettings = {
    ctnAssetsIssuer: ccAssetMetaConfig.get('ctnAssetsIssuer'),
    ctnAssetsDescription: ccAssetMetaConfig.get('ctnAssetsDescription'),
    ctnAssetsLogoUrl: ccAssetMetaConfig.get('ctnAssetsLogoUrl'),
    ctnAssetsLogoMimeType: ccAssetMetaConfig.get('ctnAssetsLogoMimeType'),
    ctnAssetsLogoHash: ccAssetMetaConfig.get('ctnAssetsLogoHash'),
    ctnAssetsLargeLogoUrl: ccAssetMetaConfig.get('ctnAssetsLargeLogoUrl'),
    ctnAssetsLargeLogoMimeType: ccAssetMetaConfig.get('ctnAssetsLargeLogoMimeType'),
    ctnAssetsLargeLogoHash: ccAssetMetaConfig.get('ctnAssetsLargeLogoHash'),
    signingMessageFormat: ccAssetMetaConfig.get('signingMessageFormat'),
    signingCertificateFilePath: ccAssetMetaConfig.get('signingCertificateFilePath'),
    signingCertificateKeyFilePath: ccAssetMetaConfig.get('signingCertificateKeyFilePath'),
    urlContentTimeout: ccAssetMetaConfig.get('urlContentTimeout')
};

// noinspection JSCheckFunctionSignatures
const opensslSync = Meteor.wrapAsync(openssl);


// Definition of classes
//

/**
 * Colored Coins Asset Metadata class. It represents the 'metadata' property of
 *  the Colored Coins metadata
 */
export class CCAssetMetadata {
    /**
     * @typedef {Object} CCMetaAssetUrl
     * @property {string} name
     * @property {string} url
     * @property {string} mimeType
     * @property {string} dataHash
     */

    /**
     * @typedef {Object} CCMetaAssetEncryption
     * @property {string} key
     * @property {string} pubKey
     * @property {string} format
     * @property {string} type
     */

    /**
     * @typedef {Object.<string, Object>} CCMetaAssetVerificationsSocial
     */

    /**
     * @typedef {Object} CCMetaAssetVerificationsDomain
     * @property {string} url
     */

    /**
     * @typedef {Object} CCMetaAssetVerificationsSigned
     * @property {string} message
     * @property {string} signed_message
     * @property {string} cert
     */

    /**
     * @typedef {Object} CCMetaAssetVerifications
     * @property {CCMetaAssetVerificationsSocial} [social]
     * @property {CCMetaAssetVerificationsDomain} [domain]
     * @property {CCMetaAssetVerificationsSigned} [signed]
     */

    /**
     * @typedef {Object} CCMetaAsset
     * @property {string} [assetId]
     * @property {string} assetName
     * @property {string} [assetGenesis]
     * @property {string} [issuer]
     * @property {string} [description]
     * @property {CCMetaAssetUrl[]} [urls]
     * @property {CCMetaUserData} [userData]
     * @property {CCMetaAssetEncryption[]} [encryptions]
     * @property {CCMetaAssetVerifications} [verifications]
     */

    /**
     * Class constructor
     * @param {CCMetaAsset} [assetMetadata] Asset metadata used to initialize object
     * @param {CryptoKeys} [decCryptoKeys] The crypto key-pair associated with a blockchain address that should be used
     *                                      to decrypt encrypted free user data
     */
    constructor(assetMetadata, decCryptoKeys) {
        if (Util.isNonNullObject(assetMetadata)) {
            if (assetMetadata.issuer !== undefined && assetMetadata.issuer !== cfgSettings.ctnAssetsIssuer) {
                // Asset issuer not as expected. Log error and throw exception
                Catenis.logger.ERROR('Asset issuer in Colored Coins asset metadata not set as \'%s\' as expected', cfgSettings.ctnAssetsIssuer, {
                    assetMetadata
                });
                throw new Error(`Asset issuer in Colored Coins asset metadata not set as \'${cfgSettings.ctnAssetsIssuer}\' as expected`);
            }

            // Initialize object with supplied metadata
            this.assetName = assetMetadata.assetName;
            this.assetDescription = assetMetadata.description;
            this.urls = assetMetadata.urls ? assetMetadata.urls : [];

            this.userData = new CCUserDataMetadata(assetMetadata.userData, decCryptoKeys);

            if (this.userData && this.userData.meta) {
                const ctnAssetIdEntry = this.userData.meta.find(entry => entry.key === 'ctnAssetId' && entry.type.toLowerCase() === 'string');

                if (ctnAssetIdEntry) {
                    this.ctnAssetId = parseUserDataMetaValue(ctnAssetIdEntry);
                }
            }
        }
        else {
            this.ctnAssetId = undefined;
            this.assetName = undefined;
            this.assetDescription = undefined;
            this.urls = [];
            this.userData = new CCUserDataMetadata();
            this.signingCertificate = undefined;
        }
    }

    /**
     * Get the message to be signed for asset verification
     * @return {string}
     * @private
     */
    get _signingMessage() {
        return util.format(cfgSettings.signingMessageFormat, new Date().toString());
    }

    /**
     * Produce signed message verification data to be added to the asset metadata
     * @return {CCMetaAssetVerificationsSigned}
     * @private
     */
    _getMetadataSignedVerification() {
        let signedVerification;
        let cert;

        if ((cert = this._getSigningCertificate())) {
            const message = this._signingMessage;
            const signedMessage = this._signMessage(message);

            if (signedMessage) {
                signedVerification = {
                    message: message,
                    signed_message: signedMessage,
                    cert: cert
                };
            }
        }

        return signedVerification;
    }

    /**
     * Retrieve digital certificate used for verification of signed message
     * @return {string}
     * @private
     */
    _getSigningCertificate() {
        if (!this.signingCertificate) {
            try {
                this.signingCertificate = fs.readFileSync(cfgSettings.signingCertificateFilePath, {encoding: 'utf8'});
            }
            catch (err) {
                Catenis.logger.ERROR('Error reading SSL signing certificate for asset verification.', err);
            }
        }

        return this.signingCertificate;
    }

    /**
     * Sign message for asset verification
     * @param {string} message The message to sign
     * @return {(string|undefined)}
     * @private
     */
    _signMessage(message) {
        let signedMsg;

        try {
            signedMsg = opensslSync('cms.sign', Buffer.from(message), {
                binary: true,
                nodetach: true,
                nosmimecap: true,
                nocerts: true,
                outform: 'PEM',
                signer: cfgSettings.signingCertificateFilePath,
                inkey: cfgSettings.signingCertificateKeyFilePath
            });
        }
        catch (err) {
            Catenis.logger.ERROR('Error executing openssl to sign message for asset verification.', err);
        }

        return signedMsg !== undefined ? signedMsg.toString() : undefined;
    }

    /**
     * Clone this object
     * @return {CCAssetMetadata}
     */
    clone() {
        const clone = Util.cloneObj(this);

        clone.urls = Util.cloneObjArray(clone.urls);
        clone.userData = clone.userData.clone();

        return clone;
    }

    /**
     * @typedef {Object} CCMetaAssetProps
     * @property {string} ctnAssetId The Catenis assigned asset ID
     * @property {string} [name] The asset name
     * @property {string} [description] A brief asset description
     * @property {CCMetaAssetUrlInput[]} [urls] Additional asset's resources
     */

    /**
     * Specify the basic properties for the asset
     * @param {CCMetaAssetProps} assetProps The asset properties
     */
    setAssetProperties(assetProps) {
        if (Util.isNonNullObject(assetProps)) {
            if (assetProps.ctnAssetId) {
                this.ctnAssetId = assetProps.ctnAssetId;

                if (assetProps.name) {
                    this.assetName = assetProps.name;
                }

                if (assetProps.description) {
                    this.assetDescription = assetProps.description;
                }

                if (assetProps.urls) {
                    this.addUrls(assetProps.urls);
                }
            }
            else {
                Catenis.logger.ERROR('CCAssetMetadata.setAssetProperties() method called without required property \'ctnAssetId\'', {
                    assetProps
                });
            }
        }
    }

    /**
     * @typedef {Object} CCMetaAssetUrlInput
     * @property {string} url The resource URL
     * @property {string} [label] Label used to identify the resource
     * @property {string} [mimeType] The resource's contents' mime type
     */

    /**
     * Add more resources to the asset's properties
     * @param {(CCMetaAssetUrlInput|CCMetaAssetUrlInput[])} urls List of additional asset's resources
     */
    addUrls(urls) {
        urls = Array.isArray(urls) ? urls : [urls];

        urls.forEach((url) => {
            const urlContentInfo = retrieveUrlContentInfo(url);

            if (urlContentInfo !== undefined) {
                this.urls.push(urlContentInfo);
            }
            else {
                Catenis.logger.ERROR('Unable to retrieve content info for asset\'s resource', {url});
            }
        });
    }

    /**
     * Add data to the 'meta' property of the asset's user data metadata
     * @param {CCMetaUserDataMetaInput} data Data to be added to the 'meta' property of the user data metadata. It is
     *                                        a dictionary where the keys are the names of the data, and the values the
     *                                        value of the data. To specify a value of a complex type (i.e. 'URL' or
     *                                        'Email'), the value should be a two-element string array where the first
     *                                        element is the type and the second element the value itself. For simple
     *                                        types (String, Number, Boolean, and Date), the data type is inferred from
     *                                        the value itself. When the value is an object, the object is interpreted
     *                                        the same way as the 'data' argument, and an array of data is inserted.
     */
    addUserDataMeta(data) {
        this.userData.addMeta(data);

        return this;
    }

    /**
     * Add custom data as properties of the asset's user data metadata
     * @param {string} key The property name
     * @param {*} data The data to be added
     * @param {boolean} [encryptData=false] Indicates whether the data should be encrypted
     * @return {CCAssetMetadata} Returns this object to allow for method chaining
     */
    addFreeUserData(key, data, encryptData = false) {
        this.userData.addFreeData(key, data, encryptData);

        return this;
    }

    /**
     * Render the asset metadata to be added to the Colored Coins metadata
     * @param {CryptoKeys} [encCryptoKeys] The crypto key-pair associated with a blockchain address that should be used
     *                                      for encrypting selected free user data
     * @return {(CCMetaAsset|undefined)}
     */
    assemble(encCryptoKeys) {
        const assembledAssetMetadata = {};

        if (this.ctnAssetId !== undefined) {
            // Add asset metadata
            if (this.assetName !== undefined) {
                assembledAssetMetadata.assetName = this.assetName;
            }

            assembledAssetMetadata.issuer = cfgSettings.ctnAssetsIssuer;

            assembledAssetMetadata.description = this.assetDescription ? this.assetDescription : cfgSettings.ctnAssetsDescription;

            if (!this.urls.some(url => url.url === cfgSettings.ctnAssetsLargeLogoUrl)) {
                this.urls.push({
                    name: 'icon',
                    url: cfgSettings.ctnAssetsLargeLogoUrl,
                    mimeType: cfgSettings.ctnAssetsLargeLogoMimeType,
                    dataHash: cfgSettings.ctnAssetsLargeLogoHash
                });
            }

            if (!this.userData.hasMetaKey('ctnAssetId')) {
                this.userData.addMeta({
                    ctnAssetId: this.ctnAssetId
                });
            }

            assembledAssetMetadata.verifications = {
                signed: this._getMetadataSignedVerification()
            };
        }

        if (this.urls.length > 0) {
            assembledAssetMetadata.urls = this.urls.concat();
        }

        const assembledUserData = this.userData.assemble(encCryptoKeys);

        if (assembledUserData) {
            assembledAssetMetadata.userData = assembledUserData;
        }

        return Object.keys(assembledAssetMetadata).length > 0 ? assembledAssetMetadata : undefined;
    }
}


// Definition of module (private) functions
//

/**
 * Retrieve information about an asset's resource
 * @param {CCMetaAssetUrlInput} url The resource identification data
 * @return {CCMetaAssetUrl}
 */
function retrieveUrlContentInfo(url) {
    let contentInfo;

    try {
        const response = Promise.await(
            got(url.url, {
                retry: 0,
                responseType: 'buffer',
                timeout: {
                    socket: cfgSettings.urlContentTimeout,
                    response: cfgSettings.urlContentTimeout
                }
            })
        );

        if (response.body && response.body.length > 0) {
            // Calculate SHA256 hash of content
            contentInfo = {
                dataHash: crypto.createHash('sha256').update(response.body).digest('hex')
            };

            // Get content type if specified
            if (response.headers && response.headers.hasOwnProperty('content-type')) {
                contentInfo.contentType = response.headers['content-type'];
            }
        }
        else {
            Catenis.logger.ERROR(util.format('No content returned from URL %s', url.url));
        }
    }
    catch (err) {
        Catenis.logger.ERROR(util.format('Error trying to access URL %s.', url.url), err);
    }

    if (contentInfo) {
        if (!url.label) {
            // Try to get content label from URL
            try {
                const urlObj = new URL(url.url);

                if (urlObj.pathname) {
                    let lastSlashIdx = urlObj.pathname.lastIndexOf('/');

                    contentInfo.name = urlObj.pathname.substring(lastSlashIdx < 0 || lastSlashIdx === urlObj.pathname.length - 1 ? 0 : lastSlashIdx + 1);
                }
            }
            catch (err) {
            }
        }
        else {
            contentInfo.name = url.label;
        }
    }

    let result;

    if (contentInfo) {
        result = {};

        if (contentInfo.name) {
            result.name = contentInfo.name;
        }

        result.url = url.url;

        if (url.mimeType) {
            result.mimeType = url.mimeType;
        }
        else if (contentInfo.contentType) {
            result.mimeType = contentInfo.contentType;
        }

        result.dataHash = contentInfo.dataHash;
    }

    return result;
}


// Module code
//

// Lock class
Object.freeze(CCAssetMetadata);
