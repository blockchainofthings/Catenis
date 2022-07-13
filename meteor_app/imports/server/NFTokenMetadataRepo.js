/**
 * Created by claudio on 2022-07-12
 */

//console.log('[NFTokenMetadataRepo.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
//import config from 'config';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';


// Definition of classes
//

/**
 * Base class for classes used to handle retrieved non-fungible token metadata
 */
export class NFTokenMetadataRepo {
    /**
     * Method to be used as a callback for reporting the size of the retrieved metadata
     *
     * Note: this method should be implemented in the derived class
     *
     * @param {number} bytesRetrieved Number of additional bytes of metadata that have been retrieved
     */
    reportProgress(bytesRetrieved) {
        Catenis.logger.WARN('Method not implemented.');
    }

    /**
     * Save the retrieved metadata
     *
     * Note: this method should be implemented in the derived class
     *
     * @param {Object} metadata The retrieved metadata
     */
    saveToRepo(metadata) {
        Catenis.logger.WARN('Method not implemented.');
    }
}


// Definition of module (private) functions
//


// Module code
//

// Lock class
Object.freeze(NFTokenMetadataRepo);
