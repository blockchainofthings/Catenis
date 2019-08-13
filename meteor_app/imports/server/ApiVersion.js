/**
 * Created by Claudio on 2017-07-13.
 */

//console.log('[ApiVersion.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import util from 'util';
// Third-party node modules
//import config from 'config';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';

// Config entries
/*const config_entryConfig = config.get('config_entry');

// Configuration settings
const cfgSettings = {
    property: config_entryConfig.get('property_name')
};*/

const verRegExp = /^(\d+)\.((?:\d+)|(?:\*))$/;


// Definition of classes
//

// ApiVersion class
//
export class ApiVersion {
    constructor (ver) {
        if (!isValidVersion(ver)) {
            // Invalid API ver. Log error and throw exception
            Catenis.logger.ERROR('Invalid API version', {version: ver});
            throw new Error(util.format('Invalid API version: %s', ver));
        }

        if (typeof ver === 'string') {
            // Passed version is a string; parse it
            const matchResult = ver.match(verRegExp);

            this.major = parseInt(matchResult[1]);
            this.minor = parseInt(matchResult[2]);
        }
        else {
            // Passed version is an ApiVersion instance; just copy its properties over
            this.major = ver.major;
            this.minor = ver.minor;
        }
    }

    toString() {
        return util.format('%d.%s', this.major, isNaN(this.minor) ? '*' : this.minor);
    }

    // Test if this version is equal to another version
    eq(ver) {
        ver = ApiVersion.checkVersion(ver);

        return this.major === ver.major && (this.minor === ver.minor || (isNaN(this.minor) && isNaN(ver.minor)));
    }

    // Test if this version is not equal to another version
    ne(ver) {
        ver = ApiVersion.checkVersion(ver);

        return this.major != ver.major || (this.minor !== ver.minor && (!isNaN(this.minor) || !isNaN(ver.minor)))
    }

    // Test if this version is greater than another version
    gt(ver) {
        ver = ApiVersion.checkVersion(ver);

        return this.major > ver.major || (this.major === ver.major && ((isNaN(this.minor) && !isNaN(ver.minor)) || this.minor > ver.minor));
    }

    // Test if this version is less than another version
    lt(ver) {
        ver = ApiVersion.checkVersion(ver);

        return this.major < ver.major || (this.major === ver.major && ((!isNaN(this.minor) && isNaN(ver.minor)) || this.minor < ver.minor));
    }

    // Test if this version is greater than or equal to another version
    gte(ver) {
        ver = ApiVersion.checkVersion(ver);

        return this.major > ver.major || (this.major === ver.major && (((isNaN(this.minor) && !isNaN(ver.minor)) || this.minor > ver.minor) || (this.minor === ver.minor || (isNaN(this.minor) && isNaN(ver.minor)))));
    }

    // Test if this version is less than or equal to another version
    lte(ver) {
        ver = ApiVersion.checkVersion(ver);

        return this.major < ver.major || (this.major === ver.major && (((!isNaN(this.minor) && isNaN(ver.minor)) || this.minor < ver.minor) || (this.minor === ver.minor || (isNaN(this.minor) && isNaN(ver.minor)))));
    }

    // Get previous version
    previous() {
        const prevVer = new ApiVersion(this);

        if (!isNaN(this.minor)) {
            if (this.minor > 0) {
                prevVer.minor--;
            }
            else if (this.major > 0) {
                prevVer.major--;
                prevVer.minor = NaN;
            }
        }

        return prevVer;
    }

    // Get next version
    next() {
        const nextVer = new ApiVersion(this);

        if (isNaN(this.minor)) {
            nextVer.major++;
            nextVer.minor = 0;
        }
        else {
            nextVer.minor++;
        }

        return nextVer;
    }

    static checkVersion(ver, reportError = true) {
        if (isValidVersion(ver)) {
            return typeof ver === 'string' ? new ApiVersion(ver) : ver;
        }
        else if (reportError) {
            // Invalid API ver. Log error and throw exception
            Catenis.logger.ERROR('Invalid API version', {version: ver});
            throw new Error(util.format('Invalid API version: %s', ver));
        }
    }

    static min(...vers) {
        let minVer;

        vers.forEach(ver => {
            ver = ApiVersion.checkVersion(ver);

            if (!minVer || ver.lt(minVer)) {
                minVer = ver;
            }
        });

        return minVer;
    }

    static max(...vers) {
        let maxVer;

        vers.forEach(ver => {
            ver = ApiVersion.checkVersion(ver);

            if (!maxVer || ver.gt(maxVer)) {
                maxVer = ver;
            }
        });

        return maxVer;
    }
}

// ApiVersionBoundary class
//
export class ApiVersionRange {
    constructor (lowBoundary, highBoundary) {
        if (!isValidBoundary(lowBoundary)) {
            // Invalid low API version boundary. Log error and throw exception
            Catenis.logger.ERROR('Invalid low API version boundary', {lowBoundary: lowBoundary});
            throw new Error(util.format('Invalid low API version boundary: %s', lowBoundary));
        }

        if (!isValidBoundary(highBoundary)) {
            // Invalid high API version boundary. Log error and throw exception
            Catenis.logger.ERROR('Invalid high API version boundary', {highBoundary: highBoundary});
            throw new Error(util.format('Invalid high API version boundary: %s', highBoundary));
        }

        lowBoundary = lowBoundary ? ApiVersion.checkVersion(lowBoundary) : lowBoundary;
        highBoundary = highBoundary ? ApiVersion.checkVersion(highBoundary) : highBoundary;

        if (lowBoundary && highBoundary && lowBoundary.gt(highBoundary)) {
            // Invalid API version boundaries; low boundary higher than high boundary.
            //  Log error and throw exception
            Catenis.logger.ERROR('Invalid API version boundaries; low boundary higher than high boundary', {
                lowBoundary: lowBoundary,
                highBoundary: highBoundary
            });
            throw new Error(util.format('Invalid API version boundaries; low boundary (%s) higher than high boundary (%s)', lowBoundary, highBoundary));
        }

        this.lowBoundary = lowBoundary;
        this.highBoundary = highBoundary;
    }

    intersection(range) {
        const lowBoundary = this.lowBoundary && range.lowBoundary ? ApiVersion.max(this.lowBoundary, range.lowBoundary) : (this.lowBoundary ? this.lowBoundary : range.lowBoundary);
        const highBoundary = this.highBoundary && range.highBoundary ? ApiVersion.min(this.highBoundary, range.highBoundary) : (this.highBoundary ? this.highBoundary : range.highBoundary);

        if (!lowBoundary || !highBoundary || lowBoundary.lte(highBoundary)) {
            return new ApiVersionRange(lowBoundary, highBoundary);
        }
    }
}


// Definition of module (private) functions
//

function isValidVersion(ver) {
    return (typeof ver === 'string' && verRegExp.test(ver)) || (ver instanceof ApiVersion);
}

function isValidBoundary(boundary) {
    return boundary === undefined || isValidVersion(boundary);
}
