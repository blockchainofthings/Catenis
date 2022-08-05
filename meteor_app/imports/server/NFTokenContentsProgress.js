/**
 * Created by claudio on 2022-07-13
 */

//console.log('[NFTokenContentsProgress.js]: This code just ran.');

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
 * Base class for classes used to handle the progress of reading/writing non-fungible token contents
 */
export class NFTokenContentsProgress {
    /**
     * Method to be used as a callback for reporting the amount of read contents data
     *
     * Note: this method should be implemented in the derived class
     *
     * @param {number} bytesRead Number of additional bytes of contents that have been read
     */
    reportReadProgress(bytesRead) {
        Catenis.logger.WARN('Method not implemented.');
    }

    /**
     * Method to be used as a callback for reporting the amount of written contents data
     *
     * Note: this method should be implemented in the derived class
     *
     * @param {number} bytesWritten Number of additional bytes of contents that have been written
     */
    reportWriteProgress(bytesWritten) {
        Catenis.logger.WARN('Method not implemented.');
    }
}


// Definition of module (private) functions
//


// Module code
//

// Lock class
Object.freeze(NFTokenContentsProgress);
