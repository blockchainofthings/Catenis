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

const verReSource = '^(\\d+)\\.(\\d+)$';


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
            const matchResult = ver.match(new RegExp(verReSource));

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
        return util.format('%d.%d', this.major, this.minor);
    }

    // Test if this version is equal to another version
    eq(ver) {
        ver = ApiVersion.checkVersion(ver);

        return this.major === ver.major && this.minor === ver.minor;
    }

    // Test if this version is not equal to another version
    ne(ver) {
        ver = ApiVersion.checkVersion(ver);

        return this.major !== ver.major || this.minor !== ver.minor;
    }

    // Test if this version is greater than another version
    gt(ver) {
        ver = ApiVersion.checkVersion(ver);

        return this.major > ver.major || (this.major === ver.major && this.minor > ver.minor);
    }

    // Test if this version is less than another version
    lt(ver) {
        ver = ApiVersion.checkVersion(ver);

        return this.major < ver.major || (this.major === ver.major && this.minor < ver.minor);
    }

    // Test if this version is greater than or equal to another version
    gte(ver) {
        ver = ApiVersion.checkVersion(ver);

        return this.major > ver.major || (this.major === ver.major && (this.minor > ver.minor || this.minor === ver.minor));
    }

    // Test if this version is less than or equal to another version
    lte(ver) {
        ver = ApiVersion.checkVersion(ver);

        return this.major < ver.major || (this.major === ver.major && (this.minor < ver.minor || this.minor === ver.minor));
    }
}


// ApiVersion function class (public) methods
//

ApiVersion.checkVersion = function (ver, reportError = true) {
    if (isValidVersion(ver)) {
        return typeof ver === 'string' ? new ApiVersion(ver) : ver;
    }
    else if (reportError) {
        // Invalid API ver. Log error and throw exception
        Catenis.logger.ERROR('Invalid API version', {version: ver});
        throw new Error(util.format('Invalid API version: %s', ver));
    }
};


// Definition of module (private) functions
//

function isValidVersion(ver) {
    return (typeof ver === 'string' && new RegExp(verReSource).test(ver)) || (ver instanceof ApiVersion);
}
