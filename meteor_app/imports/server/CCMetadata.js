/**
 * Created by claudio on 28/09/17.
 */

//console.log('[CCMetadata.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import util from 'util';
import crypto from 'crypto';
import fs from 'fs';
import Url from 'url';
// Third-party node modules
import config from 'config';
import openssl from 'openssl-wrapper';
import moment from 'moment';
// Meteor packages
import { Meteor } from 'meteor/meteor';
import { HTTP } from 'meteor/http';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';

// Config entries
const ccMetadataConfig = config.get('ccMetadata');

// Configuration settings
const cfgSettings = {
    ctnAssetsIssuer: ccMetadataConfig.get('ctnAssetsIssuer'),
    ctnAssetsDescription: ccMetadataConfig.get('ctnAssetsDescription'),
    ctnAssetsLogoUrl: ccMetadataConfig.get('ctnAssetsLogoUrl'),
    ctnAssetsLogoMimeType: ccMetadataConfig.get('ctnAssetsLogoMimeType'),
    ctnAssetsLogoHash: ccMetadataConfig.get('ctnAssetsLogoHash'),
    ctnAssetsLargeLogoUrl: ccMetadataConfig.get('ctnAssetsLargeLogoUrl'),
    ctnAssetsLargeLogoMimeType: ccMetadataConfig.get('ctnAssetsLargeLogoMimeType'),
    ctnAssetsLargeLogoHash: ccMetadataConfig.get('ctnAssetsLargeLogoHash'),
    signingMessageFormat: ccMetadataConfig.get('signingMessageFormat'),
    signingCertificateFilePath: ccMetadataConfig.get('signingCertificateFilePath'),
    signingCertificateKeyFilePath: ccMetadataConfig.get('signingCertificateKeyFilePath'),
    urlContentTimeout: ccMetadataConfig.get('urlContentTimeout'),
    encryptedUserDataKeyPrefix: ccMetadataConfig.get('encryptedUserDataKeyPrefix')
};

const opensslSync = Meteor.wrapAsync(openssl);


// Definition of function classes
//

// CCMetadata function class
//
//  Arguments:
//   metadata [Object] - (optional) Metadata to use to initialize object
//   decCryptKeys [Object(CryptoKeys)] - (optional) The crypto key-pair associated with a blockchain address that should be used to decrypt encrypted user data
export function CCMetadata(metadata, decCryptoKeys) {
    if (typeof metadata === 'object' && metadata !== null) {
        if (metadata.issuer !== undefined && metadata.issuer !== cfgSettings.ctnAssetsIssuer) {
            // Asset issuer not as expected. Log error and throw exception
            Catenis.logger.ERROR(util.format('Asset issuer in Colored Coins metadata not set as \'%s\' as expected', cfgSettings.ctnAssetsIssuer), {metadata: metadata});
            throw new Meteor.Error('ctn_ccmetadata_invalid_issuer', util.format('Asset issuer in Colored Coins metadata not set as \'%s\' as expected', cfgSettings.ctnAssetsIssuer), metadata);
        }

        // Initialize object with supplied metadata
        this.assetName = metadata.assetName;
        this.assetDescription = metadata.description;
        this.urls = metadata.urls ? metadata.urls : [];

        parseUserData.call(this, metadata.userData, decCryptoKeys);

        if (this.userData && this.userData.meta && typeof this.userData.meta.ctnAssetId === 'string') {
            this.ctnAssetId = this.userData.meta.ctnAssetId;
        }

        this.metadata = metadata;
    }
    else {
        this.ctnAssetId = undefined;
        this.assetName = undefined;
        this.assetDescription = undefined;
        this.urls = [];
        this.userData = undefined;
        this.encryptUserDataKeys = new Set();
        this.signingCertificate = undefined;
        this.metadata = undefined;
        this.storeResult = undefined;
    }

    Object.defineProperties(this, {
        signingMessage: {
            get: function () {
                return util.format(cfgSettings.signingMessageFormat, new Date().toString());
            }
        },
        certificateKeyPsw: {
            get: function () {
                return generateCertificateKeyPsw();
            }
        }
    });
}


// Public CCMetadata object methods
//

// Specify metadata for the asset (being issued)
//
//  Arguments:
//   metadata: {
//     ctnAssetId: [String], - The Catenis assigned ID for asset
//     name: [String], - (optional) The name for the asset
//     description: [String], - (optional) The description for the asset
//     urls: [{  - (optional)
//       url: [String], - The URL itself
//       label: [String], - (optional) Label used to identify the content pointed to by this URL
//       mimeType: [String] - (optional) The mime type of the content
//     }]
//   }
CCMetadata.prototype.setAssetMetadata = function (metadata) {
    // Make sure that required data is supplied
    if (typeof metadata !== 'object' || metadata === null) {
        Catenis.logger.ERROR('CCMetadata.setAssetMetadata() method called with invalid \'metadata\' argument', {metadata: metadata});
        return;
    }

    if (metadata.ctnAssetId) {
        this.ctnAssetId = metadata.ctnAssetId;

        if (metadata.name) {
            this.assetName = metadata.name;
        }

        if (metadata.description) {
            this.assetDescription = metadata.description;
        }

        if (metadata.urls) {
            this.setUrls(metadata.urls);
        }

        resetMetadata.call(this);
    }
    else {
        Catenis.logger.ERROR('CCMetadata.setAssetMetadata() method called without required \'metadata\' property \'ctnAssetId\'', {metadata: metadata});
    }
};

// Specify URLs to be added to the metadata
//
//  Arguments:
//   urls: [{  - (optional)
//     url: [String], - The URL itself
//     label: [String], - (optional) Label used to identify the content pointed to by this URL
//     mimeType: [String] - (optional) The mime type of the content
//   }]
CCMetadata.prototype.setUrls = function (urls) {
    urls = Array.isArray(urls) ? urls : [urls];
    let newUrlInserted = false;

    urls.forEach((url) => {
        const urlContentInfo = retrieveUrlContentInfo(url);

        if (urlContentInfo !== undefined) {
            this.urls.push(urlContentInfo);
            newUrlInserted = true;
        }
        else {
            Catenis.logger.ERROR('Unable to retrieve content info from URL to be associated with asset', {url: url});
        }
    });

    if (newUrlInserted) {
        resetMetadata.call(this);
    }
};

// Specify user data of a given type to be added to the metadata
//
//  Arguments:
//   data [Object] - Object the properties of which define the data to add. The name of the properties is the
//                    name of the data, and the value of the properties the value of the data. To specify a value
//                    of a given data type (i.e. 'URL' or 'Email'), the value should be an Array of the format:
//                    [type(String),value]. Otherwise, the data type is inferred from the value itself (String,
//                    Number, Boolean or Date). When the value is an object, the object is interpreted the same
//                    way as the data argument, and an array of data is inserted
CCMetadata.prototype.setMetaUserData = function (data) {
    const meta = formatMetaUserData(data);

    if (meta) {
        if (this.userData === undefined) {
            this.userData = {};
        }

        if (this.userData.meta !== undefined) {
            this.userData.meta = this.userData.meta.concat(meta);
        }
        else {
            this.userData.meta = meta;
        }

        resetMetadata.call(this);
    }
};

// Specify generic user data to be added to the metadata
//
//  Arguments:
//   key [String] - The key to be associated with this data
//   data [Object] - The data to be added. Should be an instance of Buffer if data is intended to be encrypted
//   encryptData [Boolean] - Indicates whether data should be encrypted
CCMetadata.prototype.setFreeUserData = function (key, data, encryptData) {
    // Make sure that key is a string
    if (typeof key !== 'string') {
        Catenis.logger.ERROR('CCMetadata.setFreeUserData() method called with invalid \'key\' argument', {key: key});
        return;
    }

    // Make sure that key is not a reserved key
    if (key !== 'meta') {
        if (this.userData === undefined) {
            this.userData = {};
        }

        this.userData[key] = data;

        if (encryptData && Buffer.isBuffer(data)) {
            this.encryptUserDataKeys.add(key);
        }

        resetMetadata.call(this);
    }
    else {
        Catenis.logger.WARN('Trying to set free user data to Colored Coins metadata with a reserved key', {key: key});
    }
};

//  Arguments:
//   encCryptoKeys [Object(CryptoKeys)] - (optional) The crypto key-pair associated with a blockchain address that should be used to encrypt the data
CCMetadata.prototype.assemble = function (encCryptoKeys) {
    if (this.metadata === undefined) {
        this.metadata = {};

        if (this.ctnAssetId !== undefined) {
            // Add asset metadata
            if (this.assetName !== undefined) {
                this.metadata.assetName = this.assetName;
            }

            this.metadata.issuer = cfgSettings.ctnAssetsIssuer;

            this.metadata.description = this.assetDescription ? this.assetDescription : cfgSettings.ctnAssetsDescription;

            this.metadata.urls = [{
                name: 'icon',
                url: cfgSettings.ctnAssetsLargeLogoUrl,
                mimeType: cfgSettings.ctnAssetsLargeLogoMimeType,
                dataHash: cfgSettings.ctnAssetsLargeLogoHash
            }];

            this.metadata.userData = {
                meta: [{
                    key: 'ctnAssetId',
                    value: this.ctnAssetId,
                    type: 'String'
                }]
            };

            this.metadata.verifications = {
                signed: getMetadataSignedVerification.call(this)
            };
        }

        if (this.urls.length > 0) {
            this.metadata.urls = this.metadata.urls === undefined ? this.urls : this.metadata.urls.concat(this.urls);
        }

        if (this.userData !== undefined) {
            if (this.metadata.userData === undefined) {
                this.metadata.userData = {};
            }

            if (this.userData.meta !== undefined) {
                this.metadata.userData.meta = this.metadata.userData.meta === undefined ? this.userData.meta : this.metadata.userData.meta.concat(this.userData.meta);
            }

            Object.keys(this.userData).forEach((key) => {
                if (key !== 'meta') {
                    if (encCryptoKeys && this.encryptUserDataKeys.has(key)) {
                        // Encrypt before saving user data
                        const encKey = cfgSettings.encryptedUserDataKeyPrefix + key;

                        try {
                            this.metadata.userData[encKey] = encCryptoKeys.encryptData(encCryptoKeys, this.userData[key]).toString('base64');
                        }
                        catch (err) {
                            Catenis.logger.ERROR(util.format('Error trying to encrypt Colored Coins metadata user data (key: %s, value: %s).', key, this.userData[key]), err);
                        }
                    }
                    else {
                        this.metadata.userData[key] = this.userData[key];
                    }
                }
            });
        }
    }
    else {
        Catenis.logger.WARN('Trying to assemble Colored Coins metadata that is already assembled', this);
    }
};

//  Result: {
//   torrentHash: [String] - The hash of the torrent file containing the added metadata
//   sha2: [String] - The SHA256 hash of the metadata (JSON.stringify())
//  }
CCMetadata.prototype.store = function () {
    if (this.storeResult === undefined) {
        if (this.metadata) {
            const metadata = {
                metadata: this.metadata
            };

            try {
                this.storeResult = Catenis.ccMdClient.addMetadata(metadata);
            }
            catch (err) {
                Catenis.logger.ERROR('Error while storing Colored Coins metadata.', err);
            }
        }
        else {
            Catenis.logger.WARN('No Colored Coins metadata to store');
        }
    }
    else {
        Catenis.logger.WARN('Trying to store Colored Coins metadata that is already stored', this);
    }

    return this.storeResult;
};

CCMetadata.prototype.isAssembled = function () {
    return this.metadata !== undefined;
};

CCMetadata.prototype.isStored = function () {
    return this.storeResult !== undefined;
};


// Module functions used to simulate private CCMetadata object methods
//  NOTE: these functions need to be bound to a CCMetadata object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

function resetMetadata() {
    this.metadata = this.storeResult = undefined;
}

function getSigningCertificate() {
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

function getSignedMessage(message) {
    let signedMsg;

    try {
        const opts = {
            binary: true,
            nodetach: true,
            nosmimecap: true,
            nocerts: true,
            outform: 'PEM',
            signer: cfgSettings.signingCertificateFilePath,
            inkey: cfgSettings.signingCertificateKeyFilePath,
            passin: 'pass:' + this.certificateKeyPsw
        };
        signedMsg = opensslSync('cms.sign', new Buffer(message), opts);
    }
    catch (err) {
        Catenis.logger.ERROR('Error executing openssl to sign message for asset verification.', err);
    }

    return signedMsg !== undefined ? signedMsg.toString() : undefined;
}

function getMetadataSignedVerification() {
    let signedVerification;
    let cert;

    if ((cert = getSigningCertificate.call(this))) {
        const message = this.signingMessage;
        const signedMessage = getSignedMessage.call(this, message);

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

// Parse metadata user data entry
//
//  Arguments:
//   userData [Object] - The user data to be parsed
//   decCryptKeys [Object(CryptoKeys)] - (optional) The crypto key-pair associated with a blockchain address that should be used to decrypt encrypted data
function parseUserData(userData, decCryptoKeys) {
    this.userData = undefined;
    this.encryptUserDataKeys = new Set();

    if (typeof userData === 'object' && userData !== null) {
        const parsedUserData = {};

        Object.keys(userData).forEach((key) => {
            if (key === 'meta') {
                const parsedMetaUserData = parseMetaUserData(userData[key]);

                if (parsedMetaUserData) {
                    parsedUserData.meta = parsedMetaUserData;
                }
            }
            else {
                let data = userData[key];

                if (decCryptoKeys && key.startsWith(cfgSettings.encryptedUserDataKeyPrefix) && key.length > cfgSettings.encryptedUserDataKeyPrefix.length
                        && typeof data === 'string') {
                    try {
                        data = decCryptoKeys.decryptData(decCryptoKeys, new Buffer(data, 'base64'));
                    }
                    catch (err) {
                        Catenis.logger.ERROR(util.format('Error trying to decrypt Colored Coins user data (key: %s, value: %s).', key, userData[key]), err);
                    }

                    key = key.substr(cfgSettings.encryptedUserDataKeyPrefix.length);
                    this.encryptUserDataKeys.add(key);
                }

                parsedUserData[key] = data;
            }
        });

        if (Object.keys(parsedUserData).length > 0) {
            this.userData = parsedUserData;
        }
    }
}


// CCMetadata function class (public) methods
//

// Get metadata from torrent
//
//  Arguments:
//   torrentHash: [String] - The hash of the torrent file containing the metadata
//   sha2: [String] - The SHA256 hash of the metadata (JSON.stringify())
//   decCryptKeys [Object(CryptoKeys)] - (optional) The crypto key-pair associated with a blockchain address that should be used to decrypt encrypted user data
CCMetadata.fromTorrent = function (torrentHash, sha2, decCryptoKeys) {
    let metadata;

    try {
        metadata = Catenis.ccMdClient.getMetadata(torrentHash, sha2);
    }
    catch (err) {
        Catenis.logger.ERROR('Error trying to retrieve Colored Coins metadata.', err);
    }

    if (metadata) {
        try {
            const ccMeta = new CCMetadata(metadata, decCryptoKeys);

            ccMeta.storeResult = {
                torrentHash: torrentHash,
                sha2: sha2
            };

            return ccMeta;
        }
        catch (err) {
            Catenis.logger.ERROR('Error parsing Colored Coins metadata.', err);
        }
    }
};


// CCMetadata function class (public) properties
//

/*CCMetadata.prop = {};*/


// Definition of module (private) functions
//

function generateCertificateKeyPsw() {
    return crypto.createHmac("sha256", Catenis.application.seed).update('BlockchainOfThingsSSLCertKey').digest().toString('hex');
}

// Arguments:
//  url: {
//    label: [String] - (options)
//    url: [String] - The URL for the contents
//  }
function retrieveUrlContentInfo(url) {
    let contentInfo;

    try {
        const result = HTTP.get(url.url, {timeout: cfgSettings.urlContentTimeout});

        if (result.content) {
            // Calculate SHA256 hash of content
            contentInfo = {
                dataHash: crypto.createHash('sha256').update(result.content).digest('hex')
            };

            // Get content type if specified
            if (result.headers && result.headers.hasOwnProperty('content-type')) {
                contentInfo.contentType = result.headers['content-type'];
            }
        }
        else {
            Catenis.logger.ERROR(util.format('No content returned from URL %s', url.url));
        }
    }
    catch (err) {
        Catenis.logger.ERROR(util.format('Error trying to access URL %s.', url.url), err);
    }

    if (!url.label) {
        // Try to get content label from URL
        try {
            const parsedUrl = Url.parse(url.url);

            if (parsedUrl.pathname) {
                let lastSlashIdx = parsedUrl.pathname.lastIndexOf('/');

                contentInfo.name = parsedUrl.pathname.substr(lastSlashIdx < 0 || lastSlashIdx === parsedUrl.pathname.length - 1 ? 0 : lastSlashIdx + 1);
            }
        }
        catch (err) {}
    }
    else {
        contentInfo.name = url.label;
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

function formatMetaUserData(data) {
    const meta = [];

    // Make sure that data is of the right type
    if (typeof data === 'object' && data !== null) {
        Object.keys(data).forEach((key) => {
            const entry = {
                key: key
            };

            const value = data[key];

            switch (typeof value) {
                case 'string':
                    entry.value = value;
                    entry.type = 'String';
                    break;

                case 'number':
                    entry.value = value.toString();
                    entry.type = 'Number';
                    break;

                case 'boolean':
                    entry.value = value.toString();
                    entry.type = 'Boolean';
                    break;

                case 'object':
                    if (Array.isArray(value)) {
                        if (value.length >= 2 && typeof value[1] === 'string') {
                            if (value[0].toLowerCase() === 'url') {
                                entry.value = value[1];
                                entry.type = 'URL';
                            }
                            else if (value[0].toLowerCase() === 'email') {
                                entry.value = value[1];
                                entry.type = 'Email';
                            }
                        }
                    }
                    else if (value instanceof Date) {
                        entry.value = moment(value).format();
                        entry.type = 'Date';
                    }
                    else {
                        let formattedValue = formatMetaUserData(value);

                        if (formattedValue) {
                            entry.value = formattedValue;
                            entry.type = 'Array';
                        }
                    }

                    break;
            }

            if ('value' in entry) {
                meta.push(entry);
            }
        });
    }

    return meta.length > 0 ? meta : undefined;
}

function parseMetaUserData(meta) {
    if (Array.isArray(meta)) {
        const data = {};

        meta.forEach((entry) => {
            if (typeof entry.key === 'string' && (typeof entry.type === 'undefined' || typeof entry.type === 'string')) {
                if (entry.type === undefined) {
                    // If no type specified, assume it is string
                    entry.type = 'String';
                }

                if (entry.type.toLowerCase() === 'array' || typeof entry.value === 'string')
                switch (entry.type.toLowerCase()) {
                    case 'string':
                    case 'url':
                    case 'email':
                    default:
                        if (typeof entry.value === 'string') {
                            // Interpret value as string
                            data[entry.key] = entry.value;
                        }

                        break;

                    case 'date':
                        if (typeof entry.value === 'string') {
                            // Interpret value as date
                            const mt = moment(entry.value);

                            if (mt.isValid()) {
                                data[entry.key] = mt.toDate();
                            }
                        }

                        break;

                    case 'number':
                        if (typeof entry.value === 'string') {
                            // Interpret value as number
                            let parsedNumber = Number.parseInt(entry.value);

                            if (Number.isNaN(parsedNumber)) {
                                parsedNumber = Number.parseFloat(entry.value);
                            }

                            data[entry.key] = Number.isFinite(parsedNumber) ? parsedNumber : entry.value;
                        }

                        break;

                    case 'boolean':
                        if (typeof entry.value === 'string') {
                            // Interpret value as boolean
                            data[entry.key] = entry.value.toLowerCase() === 'false' || entry.value.toLowerCase() === '0';
                        }

                        break;

                    case 'array':
                        const parsedData = parseMetaUserData(entry.value);

                        if (parsedData) {
                            data[entry.key] = parsedData;
                        }

                        break;
                }
            }
        });

        return Object.keys(data).length > 0 ? data : undefined;
    }
}


// Module code
//

// Lock function class
Object.freeze(CCMetadata);
