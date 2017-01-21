/**
 * Created by claudio on 01/01/17.
 */

//console.log('[ServiceCreditsCounter.js]: This code just ran.');

// References to external modules
//const config = Npm.require('config');


// Definition of class
//

class ServiceCreditsCounter {
    constructor() {
        this.confirmed = 0;
        this.unconfirmed = 0;

        Object.defineProperty(this, 'total', {
            get: function () {
                return this.confirmed + this.unconfirmed;
            },
            enumerable: true
        });
    }

    addConfirmed(diffCount) {
        this.confirmed += diffCount;

        if (this.confirmed < 0) {
            Catenis.logger.WARN('Confirmed service credit count just became negative; adjustment required', new Error('Unexpected negative number'));
            this.confirmed = 0;
        }
    }

    addUnconfirmed(diffCount) {
        this.unconfirmed += diffCount;

        if (this.unconfirmed < 0) {
            Catenis.logger.WARN('Unconfirmed service credit count just became negative; adjustment required', new Error('Unexpected negative number'));
            this.unconfirmed = 0;
        }
    }

    // Argument:
    //  compDiffCount: {
    //    confirmed: [Number],
    //    unconfirmed: [Number]
    //  }
    adjust(compDiffCount) {
        this.addConfirmed(compDiffCount.confirmed);
        this.addUnconfirmed(compDiffCount.unconfirmed);
    }
}

export { ServiceCreditsCounter };