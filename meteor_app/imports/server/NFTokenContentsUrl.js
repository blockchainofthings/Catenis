/**
 * Created by claudio on 2022-04-15
 */

//console.log('[NFTokenContentsUrl.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import util from 'util';
// Third-party node modules
import config from 'config';
import { CID } from 'multiformats/cid';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
//import { Catenis } from './Catenis';

// Config entries
const contentsUrlConfig = config.get('nfTokenContentsUrl');

// Configuration settings
const cfgSettings = {
    defaultOrigin: contentsUrlConfig.get('defaultOrigin'),
    pathFormat: contentsUrlConfig.get('pathFormat'),
    pathRegexFormat: contentsUrlConfig.get('pathRegexFormat'),
    dummyBinaryCID: contentsUrlConfig.get('dummyBinaryCID'),
};


// Definition of classes
//

/**
 * Non-fungible token contents URL class
 */
export class NFTokenContentsUrl {
    static _dummyCID = CID.decode(Buffer.from(cfgSettings.dummyBinaryCID,'hex')).toString();

    /**
     * Class constructor
     * @param {string} cid IPFS CID (formatted as a string) of the stored non-fungible token contents
     * @param {string} [origin] The URL origin (e.g. https://example.com)
     */
    constructor(cid, origin) {
        try {
            this.url = new URL(util.format(cfgSettings.pathFormat, cid), origin || cfgSettings.defaultOrigin);
        }
        catch (err) {
            throw new TypeError('Invalid URL origin');
        }

        // Make sure that provided CID is valid
        if (!this.url.pathname.match(cfgSettings.pathRegexFormat)) {
            throw new TypeError('Invalid CID');
        }
    }

    /**
     * Gets the IPFS CID from within the non-fungible token contents URL
     * @returns {string}
     */
    get cid() {
        return this.url.pathname.match(new RegExp(cfgSettings.pathRegexFormat))[1];
    }

    /**
     * Replaces the IPFS CID in the non-fungible token contents URL
     * @param {string} cid
     */
    set cid(cid) {
        const newPath = util.format(cfgSettings.pathFormat, cid);

        // Make sure that provided CID is valid
        if (!newPath.match(cfgSettings.pathRegexFormat)) {
            throw new TypeError('Invalid CID');
        }

        this.url.pathname = newPath;
    }

    /**
     * Clone this object
     * @returns {NFTokenContentsUrl}
     */
    clone() {
        return new NFTokenContentsUrl(this.cid, this.url.origin);
    }

    /**
     * Returns the non-fungible token contents URL as a string
     * @returns {string}
     */
    toString() {
        return this.url.toString();
    }

    /**
     * Get a new instance of the non-fungible token contents URL object using a dummy CID
     * @returns {NFTokenContentsUrl}
     */
    static get dummyUrl() {
        return new NFTokenContentsUrl(this._dummyCID);
    }

    /**
     * Create a new instance of the non-fungible token contents URL object from a URL string
     * @param {string} strUrl The URL string
     * @returns {NFTokenContentsUrl}
     */
    static parse(strUrl) {
        let url

        try {
            url = new URL(strUrl);
        } catch (err) {
            throw new TypeError('Invalid URL');
        }

        // Make sure that provided CID is valid
        const match = url.pathname.match(cfgSettings.pathRegexFormat);

        if (!match) {
            throw new TypeError('Invalid CID');
        }

        return new NFTokenContentsUrl(match[1], url.origin);
    }
}


// Module code
//

// Lock class
Object.freeze(NFTokenContentsUrl);
