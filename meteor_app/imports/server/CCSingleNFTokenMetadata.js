/**
 * Created by claudio on 2022-02-21
 */

//console.log('[CCSingleNFTokenMetadata.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import _und from 'underscore';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import {
    CCUserDataMetadata,
    parseUserDataMetaValue
} from './CCUserDataMetadata';
import { NFTokenContentsUrl } from './NFTokenContentsUrl';
import { Util } from './Util';

/**
 * @type {Object.<string, {type: string, required: boolean}>}
 */
const standardTokenProperties = {
    name: {
        type: 'String',
        required: true
    },
    description: {
        type: 'String',
        required: false
    },
    contents: {
        type: 'URL',
        required: true
    },
    contentsEncrypted: {
        type: 'Boolean',
        required: true
    }
};
/**
 * @type {string[]}
 */
const requiredStandardTokenPropNames = Object.keys(standardTokenProperties)
    .reduce((reqKeys, key) => {
        if (standardTokenProperties[key].required) {
            reqKeys.push(key)
        }

        return reqKeys;
    }, []);


// Definition of classes
//

/**
 * Colored Coins Single Non-Fungible Token Metadata
 */
export class CCSingleNFTokenMetadata extends CCUserDataMetadata {
    /**
     * @typedef {CCMetaUserData} CCMetaNonFungibleTokenData
     */

    /**
     * Class constructor
     * @param {CCMetaNonFungibleTokenData} [tokenData] Non-fungible token data metadata used to initialize this object
     * @param {CryptoKeys} [decCryptoKeys] The crypto key-pair associated with a blockchain address that should be used
     *                                      for decrypting encrypted non-fungible token metadata data (token properties)
     */
    constructor(tokenData, decCryptoKeys) {
        super(tokenData, decCryptoKeys);

        this.tokenProps = undefined;

        if (!super.isEmpty) {
            this._parseTokenProperties();
        }
    }

    /**
     * Checks whether no token properties have been specified yet
     * @returns {boolean}
     */
    get isEmpty() {
        return this.tokenProps === undefined;
    }

    /**
     * Gets the non-fungible token contents URL property
     * @returns {(NFTokenContentsUrl|undefined)}
     */
    get contentsUrl() {
        if (this.tokenProps) {
            return this.tokenProps.contents;
        }
    }

    /**
     * Gets indication whether the non-fungible token contents are encrypted
     * @returns {(boolean|undefined)}
     */
    get areContentsEncrypted() {
        if (this.tokenProps) {
            return this.tokenProps.contentsEncrypted;
        }
    }

    /**
     * Indicates whether the non-fungible token metadata has sensitive properties
     * @returns {boolean}
     */
    get hasSensitiveProps() {
        return !!(this.tokenProps && this.tokenProps.custom && this.tokenProps.custom.sensitiveProps);
    }

    /**
     * Parse non-fungible token properties from non-fungible token data
     * @private
     */
    _parseTokenProperties() {
        const tokenProps = {};

        if (this.meta) {
            for (const entry of this.meta) {
                if (!(entry.key in standardTokenProperties)) {
                    Catenis.logger.WARN('Unknown non-fungible token property in Colored Coins metadata non-fungible token data; discarding meta data entry', {
                        metaEntry: entry
                    });
                    continue;
                }

                const stdTokenProp = standardTokenProperties[entry.key];

                if (entry.type.toLowerCase() !== stdTokenProp.type.toLowerCase()) {
                    Catenis.logger.WARN('Mismatched non-fungible token property type in Colored Coins metadata non-fungible token data; discarding meta data entry', {
                        metaEntry: entry
                    });
                    continue;
                }

                // Save non-fungible property
                const value = parseUserDataMetaValue(entry);

                tokenProps[entry.key] = entry.key === 'contents' ? NFTokenContentsUrl.parse(value) : value;
            }

            // Make sure that all required properties are present
            const missingReqProps = requiredStandardTokenPropNames.reduce((missingProps, reqProp) => {
                if (!(reqProp in tokenProps)) {
                    missingProps.push(reqProp);
                }

                return missingProps;
            }, []);

            if (missingReqProps.length > 0) {
                Catenis.logger.ERROR('Missing required non-fungible token property in Colored Coins metadata non-fungible token data: %s', missingReqProps.join(', '));
                throw new Error('Missing required non-fungible token property in Colored Coins metadata non-fungible token data');
            }
        }

        if (this.freeData) {
            if (this.encryptUserDataKeys.size > 0) {
                tokenProps.custom = _und.omit(this.freeData, Array.from(this.encryptUserDataKeys));
                // noinspection JSUnusedLocalSymbols
                tokenProps.custom.sensitiveProps = _und.mapObject(
                    _und.pick(this.freeData, Array.from(this.encryptUserDataKeys)),
                    (val, key) => {
                        return JSON.parse(val.toString());
                    }
                );
            }
            else {
                tokenProps.custom = this.freeData;
            }
        }

        this.tokenProps = tokenProps;
    }

    /**
     * Clone this object
     * @returns {CCSingleNFTokenMetadata}
     */
    clone() {
        const clone = super.clone();

        if (clone.tokenProps) {
            clone.tokenProps = Util.cloneObjDict(clone.tokenProps, true);
        }

        // noinspection JSValidateTypes
        return clone;
    }

    /**
     * Clear the user data metadata of this object
     */
    clear() {
        super.clear();

        this.tokenProps = undefined;
    }

    /**
     * @typedef {NFTokenMetadataStoredContents} CCMetaNonFungibleTokenProps
     */

    /**
     * Set the non-fungible token data metadata to the specified token properties
     * @param {CCMetaNonFungibleTokenProps} nfTokenProps The non-fungible token properties
     */
    setNFTokenProperties(nfTokenProps) {
        this.clear();

        if (Util.isNonNullObject(nfTokenProps)) {
            let customProps;

            if ('custom' in nfTokenProps) {
                customProps = nfTokenProps.custom;
                nfTokenProps = _und.omit(nfTokenProps, 'custom');
            }

            if ('contents' in nfTokenProps) {
                const contents = nfTokenProps.contents;
                nfTokenProps = _und.omit(nfTokenProps, 'contents');
                // noinspection JSValidateTypes
                nfTokenProps.contents = [
                    'URL',
                    contents.toString()
                ];
            }

            // noinspection JSCheckFunctionSignatures
            this.addMeta(nfTokenProps);

            if (customProps) {
                if (Util.isNonNullObject(customProps)) {
                    let sensitiveProps;

                    if ('sensitiveProps' in customProps) {
                        sensitiveProps = customProps.sensitiveProps;
                        customProps = _und.omit(customProps, 'sensitiveProps');
                    }

                    Object.keys(customProps).forEach(key => this.addFreeData(key, customProps[key]));

                    if (Util.isNonNullObject(sensitiveProps)) {
                        Object.keys(sensitiveProps).forEach(key => this.addFreeData(
                            key,
                            Buffer.from(JSON.stringify(sensitiveProps[key])),
                            true
                        ));
                    }
                    else {
                        Catenis.logger.WARN('Unexpected data type for sensitive custom non-fungible token properties when setting the Colored Coins metadata non-fungible token data', {
                            sensitiveProps
                        });
                    }
                }
                else {
                    Catenis.logger.WARN('Unexpected data type for custom non-fungible token properties when setting the Colored Coins metadata non-fungible token data', {
                        customProps
                    });
                }
            }
        }

        this._parseTokenProperties();
    }
}


// Definition of module (private) functions
//


// Module code
//

// Lock class
Object.freeze(CCSingleNFTokenMetadata);
