/**
 * Created by claudio on 2022-02-18
 */

//console.log('[NFTokenStorage.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import util from 'util';
// Third-party node modules
import { CID } from 'ipfs-http-client';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';


// Definition of classes
//

/**
 * Non-Fungible Token Storage class
 */
export class NFTokenStorage {
    /**
     * Asynchronously store the contents of a non-fungible token onto IPFS
     * @param {NodeJS.ReadableStream} nfTokenContentsStream A data stream from where the non-fungible token's
     *                                                       contents can be read
     * @return {Promise<string>} A promise that resolves to the CID (as a string) of the stored contents
     */
    async store(nfTokenContentsStream) {
        try {
            return (await Catenis.ipfsClient.ipfs.add(nfTokenContentsStream)).cid.toString();
        }
        catch (err) {
            Catenis.logger.ERROR('Error storing non-fungible token\'s contents onto IPFS.', err);
            throw new Error(`Error storing non-fungible token\'s contents onto IPFS: ${err}`);
        }
    }

    /**
     * Retrieve the contents of a non-fungible token previously recorded onto IPFS
     * @param {string} nfTokenContentsCid IPFS CID (as a string) of the stored contents
     * @return {NodeJS.ReadableStream} A data stream from where the retrieved non-fungible token's contents can be read
     */
    retrieve(nfTokenContentsCid) {
        return Catenis.ipfsClient.catReadableStream(CID.parse(nfTokenContentsCid));
    }
}


// Module code
//

// Lock class
Object.freeze(NFTokenStorage);
