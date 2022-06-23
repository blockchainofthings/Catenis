/**
 * Created by claudio on 2022-02-19
 */

//console.log('[CCUserDataMetadata.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import config from 'config';
import moment from 'moment';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { Util } from './Util';

// Config entries
const ccUserDataMetaConfig = config.get('ccUserDataMetadata');

// Configuration settings
const cfgSettings = {
    encryptedUserDataKeyPrefix: ccUserDataMetaConfig.get('encryptedUserDataKeyPrefix'),
    escapedUserDataKeyPrefix: ccUserDataMetaConfig.get('escapedUserDataKeyPrefix')
};


// Definition of classes
//

/**
 * Colored Coins User Metadata class. It represents the 'metadata.userData' property of
 *  the Colored Coins asset metadata
 */
export class CCUserDataMetadata {
    /**
     * @typedef {Object.<string, *>} CCMetaUserData
     */

    /**
     * Class constructor
     * @param {CCMetaUserData} [userData] User data metadata used to initialize this object
     * @param {CryptoKeys} [decCryptoKeys] The crypto key-pair associated with a blockchain address that should be used
     *                                      to decrypt encrypted free user data
     */
    constructor(userData, decCryptoKeys) {
        /**
         * @type {(CCMetaUserDataMetaEntry[]|undefined)}
         */
        this.meta = undefined;
        this.freeData = undefined;
        /**
         * @type {Set<string>}
         */
        this.encryptUserDataKeys = new Set();

        if (Util.isNonNullObject(userData)) {
            const parsedFreeData = {};

            Object.keys(userData).forEach((key) => {
                if (key === 'meta') {
                    // Make sure that user data 'meta' properties are well-formed
                    const parsedMeta = parseUserDataMeta(userData[key]);

                    if (parsedMeta) {
                        this.meta = formatUserDataMeta(parsedMeta);
                    }
                }
                else {
                    let data = userData[key];

                    const plainKey = checkKeyNameOfEncryptedUserDataKey(key);

                    if (plainKey) {
                        // Encrypted user data key
                        key = checkUnescapeUserDataKey(plainKey);
                        let decryptedData;

                        if (decCryptoKeys) {
                            // Try to decrypt data
                            try {
                                decryptedData = decCryptoKeys.decryptData(Buffer.from(data, 'base64'));
                            }
                            catch (err) {
                                Catenis.logger.ERROR('Error trying to decrypt Colored Coins metadata user data (key: %s, value: %s).', key, data, err);
                            }
                        }
                        else {
                            Catenis.logger.ERROR('Missing crypto keys to decrypt Colored Coins metadata user data (key: %s, value: %s)', key, data);
                        }
                        
                        if (decryptedData) {
                            // Data successfully decrypted
                            data = decryptedData;
                            this.encryptUserDataKeys.add(key);
                        }
                        else {
                            Catenis.logger.WARN('Parsing encrypted Colored Coins metadata user data as plain data (key: %s, value: %s)', key, data);
                        }
                    }
                    else {
                        key = checkUnescapeUserDataKey(key);
                    }

                    parsedFreeData[key] = data;
                }
            });

            if (Object.keys(parsedFreeData).length > 0) {
                this.freeData = parsedFreeData;
            }
        }
    }

    /**
     * Checks whether no data have been specified for user data yet
     * @return {boolean}
     */
    get isEmpty() {
        return this.meta === undefined && this.freeData === undefined;
    }

    /**
     * Clone this object
     * @return {CCUserDataMetadata} The cloned object
     */
    clone() {
        const clone = Util.cloneObj(this);

        if (clone.meta) {
            clone.meta = Util.cloneObjArray(clone.meta);
        }

        if (clone.freeData) {
            clone.freeData = Util.cloneObj(clone.freeData);
        }

        clone.encryptUserDataKeys = new Set(clone.encryptUserDataKeys);

        return clone;
    }

    /**
     * Clear the user data metadata of this object
     */
    clear() {
        this.meta = undefined;
        this.freeData = undefined;
        this.encryptUserDataKeys = new Set();
    }

    /**
     * Add data to the 'meta' property of the user data metadata
     * @param {CCMetaUserDataMetaInput} data Data to be added to the 'meta' property of the user data metadata. It is
     *                                        a dictionary where the keys are the names of the data, and the values the
     *                                        value of the data. To specify a value of a complex type (i.e. 'URL' or
     *                                        'Email'), the value should be a two-element string array where the first
     *                                        element is the type and the second element the value itself. For simple
     *                                        types (String, Number, Boolean, and Date), the data type is inferred from
     *                                        the value itself. When the value is an object, the object is interpreted
     *                                        the same way as the 'data' argument, and an array of data is inserted.
     * @return {boolean} Indicates whether the data was successfully added
     */
    addMeta(data) {
        let dataAdded = false;
        const meta = formatUserDataMeta(data);

        if (meta) {
            if (this.meta !== undefined) {
                this.meta = this.meta.concat(meta);
            }
            else {
                this.meta = meta;
            }

            dataAdded = true;
        }

        return dataAdded;
    }

    /**
     * Add custom data as properties of the user data metadata
     * @param {string} key The property name
     * @param {*} data The data to be added
     * @param {boolean} [encryptData=false] Indicates whether the data should be encrypted
     * @return {CCUserDataMetadata} Returns this object to allow for method chaining
     */
    addFreeData(key, data, encryptData = false) {
        // Validate 'key' argument
        if (typeof key !== 'string') {
            Catenis.logger.ERROR('CCUserDataMetadata.setFreeData() method called with invalid \'key\' argument', {key: key});
            return this;
        }

        if (this.freeData === undefined) {
            this.freeData = {};
        }

        this.freeData[key] = data;

        if (encryptData && Buffer.isBuffer(data)) {
            this.encryptUserDataKeys.add(key);
        }

        return this;
    }

    /**
     * Checks whether the user data meta currently has an entry with a given key
     * @param {string} key The key to test
     * @return {boolean}
     */
    hasMetaKey(key) {
        return this.meta !== undefined && this.meta.some(entry => entry.key === key);
    }

    /**
     * Checks whether the free user data currently has a given key
     * @param {string} key The key to test
     * @return {boolean}
     */
    hasFreeDataKey(key) {
        return this.freeData !== undefined && Object.keys(this.freeData).some(_key => _key === key);
    }

    /**
     * Render the user data to make it ready to be added to the Colored Coins metadata
     * @param {CryptoKeys} [encCryptoKeys] The crypto key-pair associated with a blockchain address that should be used
     *                                      for encrypting selected free user data
     * @return {(CCMetaUserData|undefined)}
     */
    assemble(encCryptoKeys) {
        const assembledData = {};

        if (this.meta !== undefined) {
            assembledData.meta = this.meta;
        }

        if (this.freeData !== undefined) {
            Object.keys(this.freeData).forEach(key => {
                let data = this.freeData[key];
                let conformedKey = checkEscapeUserDataKey(key);

                if (this.encryptUserDataKeys.has(key)) {
                    // User data should be encrypted
                    let encryptedData;

                    if (encCryptoKeys) {
                        // Try to encrypted data
                        try {
                            encryptedData = encCryptoKeys.encryptData(data).toString('base64');
                        }
                        catch (err) {
                            Catenis.logger.ERROR('Error trying to encrypt Colored Coins metadata user data (key: %s, value: %s).', key, data, err);
                        }
                    }
                    else {
                        Catenis.logger.ERROR('Missing crypto keys to encrypt Colored Coins metadata user data (key: %s, value: %s)', key, data);
                    }

                    if (encryptedData) {
                        data = encryptedData;
                        conformedKey = `${cfgSettings.encryptedUserDataKeyPrefix}${conformedKey}`;
                    }
                    else {
                        Catenis.logger.WARN('Assembling Colored Coins metadata user data that should be encrypted as plain data (key: %s, value: %s)', key, data);
                    }
                }

                assembledData[conformedKey] = data;
            });
        }

        return Object.keys(assembledData).length > 0 ? assembledData : undefined;
    }
}


// Definition of module (private) functions
//

/**
 * @typedef {Object} CCMetaUserDataMetaEntry
 * @property {string} key
 * @property {string} value
 * @property {string} type
 */

/**
 * Parse the 'meta' property of the user data metadata
 * @param {(CCMetaUserDataMetaEntry[]|*)} meta The user data meta to parse
 * @return {(CCMetaUserDataMetaInput|undefined)}
 */
function parseUserDataMeta(meta) {
    if (Array.isArray(meta)) {
        const data = {};

        meta.forEach((entry) => {
            if (typeof entry.key === 'string' && (entry.type === undefined || typeof entry.type === 'string')) {
                if (entry.type === undefined) {
                    // If no type specified, assume it is string
                    entry.type = 'String';
                }

                if (entry.type.toLowerCase() === 'array') {
                    const parsedData = parseUserDataMeta(entry.value);

                    if (parsedData) {
                        data[entry.key] = parsedData;
                    }
                }
                else {
                    const parsedValue = parseUserDataMetaValue(entry);

                    if (parsedValue !== undefined) {
                        if (['string','date','number','boolean'].includes(entry.type.toLowerCase())) {
                            // Regular data type
                            data[entry.key] = parsedValue;
                        }
                        else {
                            // Custom data type
                            data[entry.key] = [entry.type, parsedValue];
                        }
                    }
                }
            }
        });

        return Object.keys(data).length > 0 ? data : undefined;
    }
}

/**
 * Parse the value of a user data meta entry.
 *
 * Note: this method can only be used to parse simple (non-array) values
 *
 * @param {CCMetaUserDataMetaEntry} entry The user data meta entry
 * @return {(*|undefined)} The parsed value, or undefined if the value could not be parsed
 */
export function parseUserDataMetaValue(entry) {
    let parsedValue;

    switch (entry.type.toLowerCase()) {
        case 'string':
        case 'url':
        case 'email':
        default:
            if (typeof entry.value === 'string') {
                // Interpret value as string
                parsedValue = entry.value;
            }

            break;

        case 'date':
            if (typeof entry.value === 'string') {
                // Interpret value as date
                const mt = moment(entry.value);

                if (mt.isValid()) {
                    parsedValue = mt.toDate();
                }
            }

            break;

        case 'number':
            if (typeof entry.value === 'string') {
                // Interpret value as number
                let parsedNumber = Number.parseFloat(entry.value);

                if (!Number.isNaN(parsedNumber) && Number.isFinite(parsedNumber)) {
                    parsedValue = parsedNumber;
                }
            }

            break;

        case 'boolean':
            if (typeof entry.value === 'string') {
                // Interpret value as boolean
                parsedValue = !(entry.value.toLowerCase() === 'false' || entry.value.toLowerCase() === '0');
            }

            break;

        case 'array':
            // Unexpected type to parse
            Catenis.logger.ERROR('Unexpect data type when parsing Colored Coins metadata user data meta entry value', {
                metaEntry: entry
            });

            break;
    }

    return parsedValue;
}

/**
 * @typedef {(string|number|boolean|Date|string[]|Object)} CCMetaUserDataMetaInputTypes
 */

/**
 * Type used to pass data to be added to the 'meta' property of the user data metadata
 * @typedef {Object.<string, CCMetaUserDataMetaInputTypes>} CCMetaUserDataMetaInput
 */

/**
 * Format data to be added to the 'meta' property of the user data metadata
 * @param {(CCMetaUserDataMetaInput|*)} data Data to be added to the 'meta' property of the user data metadata
 * @return {(CCMetaUserDataMetaEntry[]|undefined)}
 */
function formatUserDataMeta(data) {
    const meta = [];

    // Make sure that data is of the right type
    if (Util.isNonNullObject(data)) {
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
                        if (value.length === 2 && typeof value[0] === 'string' && typeof value[1] === 'string') {
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
                        let formattedValue = formatUserDataMeta(value);

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

/**
 * Checks whether a given user data key name is a reserved key name
 * @param {string} key The user data key name to check
 * @return {boolean}
 */
function isReservedUserDataKey(key) {
    return key === 'meta' || (typeof key === 'string' && (key.startsWith(cfgSettings.encryptedUserDataKeyPrefix)
        && key.length > cfgSettings.encryptedUserDataKeyPrefix.length)
        || (key.startsWith(cfgSettings.escapedUserDataKeyPrefix)
        && key.length > cfgSettings.escapedUserDataKeyPrefix.length));
}

/**
 * Conditionally escape a user data key name that happens to be a reserved key name
 * @param {string} key The user data key name to escape
 * @return {string}
 */
function checkEscapeUserDataKey(key) {
    return isReservedUserDataKey(key) ? `${cfgSettings.escapedUserDataKeyPrefix}${key}` : key;
}

/**
 * Conditionally unescape a user data key name that happens to be an escaped key name
 * @param {string} key The user data key name to unescape
 * @return {string}
 */
function checkUnescapeUserDataKey(key) {
    let unescapedKey;

    return typeof key === 'string' && key.startsWith(cfgSettings.escapedUserDataKeyPrefix)
        && isReservedUserDataKey(unescapedKey = key.substring(cfgSettings.escapedUserDataKeyPrefix.length))
        ? unescapedKey : key;
}

/**
 * Conditionally gets the original key name of a user data key that happens to be encrypted
 * @param {string} key The user data key name
 * @return {(string|undefined)} The original user data key name or undefined if the key was not encrypted
 */
function checkKeyNameOfEncryptedUserDataKey(key) {
    if (typeof key === 'string' && key.startsWith(cfgSettings.encryptedUserDataKeyPrefix)
            && key.length > cfgSettings.encryptedUserDataKeyPrefix.length) {
        return key.substring(cfgSettings.encryptedUserDataKeyPrefix.length);
    }
}


// Module code
//

// Lock class
Object.freeze(CCUserDataMetadata);
