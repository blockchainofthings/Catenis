/**
 * Created by Claudio on 2019-07-11.
 */

//console.log('[CompressResponseBody.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import config from 'config';
import compression from 'compression';
// Meteor packages
import { WebApp } from 'meteor/webapp';

// References code in other (Catenis) modules
//import { Catenis } from './Catenis';

// Config entries
const comprResBodyConfig = config.get('compressResponseBody');

// Configuration settings
const cfgSettings = {
    useCompression: comprResBodyConfig.get('useCompression'),
    compressThreshold: comprResBodyConfig.get('compressThreshold')
};


// Definition of module (private) functions
//

// This is the same filter function used by meteor
function shouldCompress(req, res) {
    if (req.headers['x-no-compression']) {
        // don't compress responses with this request header
        return false;
    }

    // fallback to standard filter function
    return compression.filter(req, res);
}


// Module code
//

// We need to replace meteor's internal middleware handler used for compression
//  so we can have control over it. It should be the SECOND handler on the main
//  middleware handler stack (WebApp.connectApp), so let's remove it
WebApp.connectApp.stack.splice(1, 1);

if (cfgSettings.useCompression) {
    // Add our own compression middleware handler exactly at the
    //  same position where the original handler was
    WebApp.connectApp.use(compression({
        filter: shouldCompress,
        threshold: cfgSettings.compressThreshold
    }));
    WebApp.connectApp.stack.splice(1, 0, WebApp.connectApp.stack.pop());
}
